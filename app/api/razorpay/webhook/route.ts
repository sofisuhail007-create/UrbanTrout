import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { notifyRazorpayPayment } from "@/lib/telegram";
import { sendPaymentLinkConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// In-memory deduplication cache to prevent duplicate alerts when Razorpay fires both payment.captured & order.paid
const processedPayments = new Map<string, number>();

function isDuplicatePayment(paymentId: string): boolean {
  const now = Date.now();
  for (const [key, ts] of processedPayments.entries()) {
    if (now - ts > 30 * 60 * 1000) {
      processedPayments.delete(key);
    }
  }
  if (processedPayments.has(paymentId)) {
    return true;
  }
  processedPayments.set(paymentId, now);
  return false;
}

/**
 * POST /api/razorpay/webhook
 * Receives real-time payment events pushed by Razorpay servers.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify signature if secret is configured in environment
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== signature) {
        console.error("Razorpay webhook signature mismatch");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = event.event;
    console.log("Razorpay Webhook received event: " + eventType);

    // ── 1. Payment Link Paid (Home Delivery Orders & Locked WhatsApp Bills) ──
    if (eventType === "payment_link.paid") {
      const paymentLink = event.payload?.payment_link?.entity;
      const payment = event.payload?.payment?.entity;
      if (!paymentLink && !payment) {
        return NextResponse.json({ status: "ignored_no_payment_link_entity" });
      }

      const paymentId = payment?.id || paymentLink?.id;
      const paymentLinkId = paymentLink?.id;
      const rawAmt = paymentLink?.amount_paid || payment?.amount || paymentLink?.amount || 0;
      const amount = (Number(rawAmt) || 0) / 100;
      const notes = paymentLink?.notes || payment?.notes || {};
      const orderRef = notes.order_ref || paymentLink?.reference_id || `UT-DEL-${paymentLinkId?.slice(-6) || Date.now()}`;
      const customerName = notes.customer_name || paymentLink?.customer?.name || payment?.notes?.customer_name || "Valued Customer";
      const customerPhone = notes.customer_phone || paymentLink?.customer?.contact || payment?.contact || "";
      const customerEmail = notes.customer_email || paymentLink?.customer?.email || payment?.email || null;
      const itemsSummary = notes.items_summary || paymentLink?.description || "Fresh Himalayan Rainbow Trout";
      const method = payment?.method ? payment.method.toUpperCase() : "UPI / Razorpay Link";
      const vpa = payment?.vpa || null;

      const isDuplicate = isDuplicatePayment(paymentId);

      if (!isDuplicate) {
        // 1. Instant Telegram Alert
        try {
          await notifyRazorpayPayment({
            paymentId,
            orderId: orderRef,
            amount,
            status: "captured",
            method,
            vpa,
            customerName,
            customerPhone,
            customerEmail,
            description: itemsSummary,
            channel: "🛵 Home Delivery (Razorpay Link)",
          });
        } catch (tgErr) {
          console.error("Telegram notification error for payment_link.paid:", tgErr);
        }

        // 2. Branded HTML Email to info.urbantrout@gmail.com and customer
        try {
          await sendPaymentLinkConfirmationEmail({
            orderRef,
            customerName,
            customerPhone,
            customerEmail: customerEmail || undefined,
            amount,
            itemsSummary,
            paymentId,
            paymentLinkId,
            paymentMethod: method,
          });
        } catch (emErr) {
          console.error("Email notification error for payment_link.paid:", emErr);
        }
      }

      // 3. Mark or auto-insert into vending sales log
      try {
        const cleanRef = String(orderRef).replace(/\D/g, "") || String(orderRef);
        let invData: any = null;
        try {
          const { data: matchedInvs } = await supabase
            .from("invoices")
            .select("id, data")
            .or(`id.eq.${cleanRef},id.ilike.%${orderRef}%`)
            .limit(1);
          if (matchedInvs && matchedInvs[0]?.data) {
            invData = typeof matchedInvs[0].data === "object" ? matchedInvs[0].data : JSON.parse(matchedInvs[0].data);
          }
        } catch (_) {}

        const { data: matchedLogs } = await supabase
          .from("vending_sales_log")
          .select("id, notes, custom_fields")
          .or(`notes.ilike.%${orderRef}%,notes.ilike.%${paymentLinkId}%`)
          .limit(5);

        if (matchedLogs && matchedLogs.length > 0) {
          for (const log of matchedLogs) {
            const existingCustom = (typeof log.custom_fields === "object" && log.custom_fields) ? log.custom_fields : {};
            await supabase
              .from("vending_sales_log")
              .update({
                payment_mode: "Razorpay Link",
                amount_paid: amount,
                notes: `${log.notes || ""} [PAID ✓ ${paymentId} via Razorpay Link]`.trim(),
                custom_fields: {
                  ...existingCustom,
                  payment_status: "PAID",
                  payment_id: paymentId,
                  payment_link_id: paymentLinkId,
                  paid_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", log.id);
          }
        } else {
          // AUTO-INSERT NEW VENDING LOG ENTRY for this remote payment!
          const tw = invData?.tw ? Number(invData.tw) : 1.0;
          const firstItem = invData?.items?.[0];
          const prodType = firstItem?.n?.toLowerCase().includes("gutted") && !firstItem?.n?.toLowerCase().includes("non") ? "Gutted" : "Non Gutted";
          const rate = firstItem?.r ? Number(firstItem.r) : Math.round(amount / (tw || 1));

          const newLog = {
            id: `VSL-WP-${Date.now()}`,
            entry_date: new Date().toISOString().split("T")[0],
            entry_time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
            weight_kg: tw,
            product_type: prodType,
            rate_per_kg: rate,
            expected_amount: amount,
            amount_paid: amount,
            discount_amount: 0,
            payment_mode: "Razorpay Link",
            logged_by: "WhatsApp Remote Pay",
            notes: `Remote Order #${orderRef} - ${customerName} (Phone: ${customerPhone}) [Paid ✓ ${paymentId}]`,
            custom_fields: {
              payment_status: "PAID",
              payment_id: paymentId,
              payment_link_id: paymentLinkId,
              customer_name: customerName,
              customer_phone: customerPhone,
              paid_at: new Date().toISOString(),
            },
          };

          try {
            await supabase.from("vending_sales_log").insert(newLog);
          } catch (insertErr) {
            console.warn("Could not insert to vending_sales_log table:", insertErr);
          }

          // Also append to fallback app_settings vending_log_data
          try {
            const { data: setRow } = await supabase
              .from("app_settings")
              .select("value")
              .eq("key", "vending_log_data")
              .single();
            const currentList = setRow?.value ? JSON.parse(setRow.value) : [];
            currentList.unshift(newLog);
            await supabase.from("app_settings").upsert({
              key: "vending_log_data",
              value: JSON.stringify(currentList.slice(0, 1000)),
              updated_at: new Date().toISOString(),
            }, { onConflict: "key" });
          } catch (_) {}
        }
      } catch (dbErr) {
        console.warn("Vending log update notice for payment_link.paid:", dbErr);
      }

      // 4. Mark invoices as PAID if matching
      try {
        const cleanRef = String(orderRef).replace(/\D/g, "") || String(orderRef);
        const { data: matchedInvoices } = await supabase
          .from("invoices")
          .select("id, data")
          .or(`id.eq.${cleanRef},id.ilike.%${orderRef}%`)
          .limit(5);

        if (matchedInvoices && matchedInvoices.length > 0) {
          for (const inv of matchedInvoices) {
            if (inv && inv.data) {
              const prev = typeof inv.data === "object" ? inv.data : JSON.parse(inv.data || "{}");
              await supabase
                .from("invoices")
                .update({
                  data: {
                    ...prev,
                    paymentStatus: "PAID",
                    paymentMethod: "Razorpay Link (Verified)",
                    paymentId,
                    paidAt: new Date().toISOString(),
                  },
                })
                .eq("id", inv.id);
            }
          }
        }
      } catch (invErr) {
        console.warn("Invoices sync notice for payment_link.paid:", invErr);
      }

      return NextResponse.json({ success: true, processed: paymentId, type: "payment_link.paid" });
    }

    // ── 2. Payment Captured / Order Paid (Checkout, POS QR, or Links) ──
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const payment = event.payload?.payment?.entity;
      if (!payment) {
        return NextResponse.json({ status: "ignored_no_payment_entity" });
      }

      const amount = (Number(payment.amount) || 0) / 100;
      const paymentId = payment.id;
      const orderId = payment.order_id || null;
      const method = payment.method;
      const vpa = payment.vpa || null;
      const email = payment.email || null;
      const contact = payment.contact || null;
      const notes = payment.notes || {};
      const description = payment.description || null;

      // Prevent duplicate notification: Razorpay fires both payment.captured AND order.paid
      const isDuplicate = isDuplicatePayment(paymentId);

      // Check if order exists in Supabase
      let matchedOrder: any = null;
      if (orderId) {
        try {
          const { data: ord } = await supabase
            .from("orders")
            .select("*")
            .or("razorpay_order_id.eq." + orderId + ",razorpay_payment_id.eq." + paymentId)
            .maybeSingle();
          matchedOrder = ord;
        } catch (_) {}
      }

      // Resolve Real Customer Name (Priority: notes > order DB > email > Valued Customer; NEVER use description)
      let customerName =
        notes.customer_name ||
        notes.name ||
        payment.notes?.customer_name ||
        matchedOrder?.customer_name ||
        (email && email.includes("@") ? email.split("@")[0] : null) ||
        "Valued Customer";

      const customerPhone =
        notes.customer_phone ||
        notes.phone ||
        matchedOrder?.customer_phone ||
        contact ||
        "";

      const isPos = notes.channel === "POS_BILLING" || (description && description.includes("POS"));
      const isHomeDelivery = notes.channel === "HOME_DELIVERY" || (description && description.toLowerCase().includes("home delivery"));

      const channelLabel = isHomeDelivery
        ? "🛵 Home Delivery (Razorpay Link)"
        : isPos
        ? "Counter POS QR"
        : "Website Checkout";

      // 1. Send Instant Telegram Alert ONLY ONCE per payment ID
      if (!isDuplicate) {
        await notifyRazorpayPayment({
          paymentId,
          orderId,
          amount,
          status: "captured",
          method,
          vpa,
          customerName,
          customerPhone,
          customerEmail: email,
          description,
          channel: channelLabel,
        });

        // If this was a home delivery payment captured, trigger email receipt too!
        if (isHomeDelivery) {
          try {
            await sendPaymentLinkConfirmationEmail({
              orderRef: notes.order_ref || orderId || `UT-${Date.now()}`,
              customerName,
              customerPhone,
              customerEmail: email || undefined,
              amount,
              itemsSummary: notes.items_summary || description || "Fresh Rainbow Trout",
              paymentId,
              paymentMethod: method ? method.toUpperCase() : "Razorpay",
            });
          } catch (emErr) {
            console.error("Email notification fallback error:", emErr);
          }
        }
      }

      // 2. Update matching order in Supabase if linked
      if (matchedOrder && matchedOrder.status !== "confirmed" && matchedOrder.status !== "processing") {
        try {
          await supabase
            .from("orders")
            .update({
              status: "processing",
              razorpay_payment_id: paymentId,
            })
            .eq("id", matchedOrder.id);
        } catch (dbErr) {
          console.warn("Webhook order sync notice:", dbErr);
        }
      }

      // 3. Update matching invoice in Supabase if POS Invoice
      if (description && description.includes("POS Invoice #")) {
        const invMatch = description.match(/#(\d+)/);
        if (invMatch) {
          const invId = invMatch[1];
          try {
            const { data: invRow } = await supabase
              .from("invoices")
              .select("data")
              .eq("id", invId)
              .maybeSingle();

            if (invRow && invRow.data) {
              const updatedData = {
                ...invRow.data,
                paymentStatus: "PAID",
                paymentMethod: "Razorpay QR",
                paymentId,
                paidAt: new Date().toISOString(),
              };
              await supabase
                .from("invoices")
                .update({ data: updatedData })
                .eq("id", invId);
            }
          } catch (invErr) {
            console.warn("Webhook invoice sync notice:", invErr);
          }
        }
      }

      return NextResponse.json({ success: true, processed: paymentId });
    }

    // ── 2. Payment Failed ──
    if (eventType === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      if (payment) {
        const amount = (Number(payment.amount) || 0) / 100;
        const errReason = payment.error_description || payment.error_reason || "Declined by bank";
        console.warn("Razorpay Payment Failed: Rs." + amount + " - " + errReason);
      }
      return NextResponse.json({ success: true, handled: "failed" });
    }

    return NextResponse.json({ success: true, handled: eventType });
  } catch (err: any) {
    console.error("Razorpay webhook exception:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

/**
 * GET /api/razorpay/webhook
 * Info & status endpoint for admin.
 */
export async function GET() {
  const webhookUrl = "https://urbantrout.in/api/razorpay/webhook";
  return NextResponse.json({
    status: "Razorpay Webhook Handler Active",
    webhookUrl,
    activeEvents: [
      "payment.captured",
      "order.paid",
      "payment_link.paid",
      "payment.failed",
      "qr_code.credited",
    ],
    instructions:
      "In Razorpay Dashboard > Account & Settings > Webhooks, add this Webhook URL with events: payment.captured, order.paid, payment_link.paid, payment.failed.",
  });
}
