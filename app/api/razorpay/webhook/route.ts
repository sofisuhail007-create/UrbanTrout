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

// ─── Persistent Deduplication (Supabase-backed) ───────────────────────────────
// The in-memory Map is lost on every Vercel cold start, causing duplicate Telegram
// messages and double DB inserts when Razorpay retries webhooks.
// We use Supabase app_settings as a persistent store with a 2-hour TTL per paymentId.

const DEDUP_SETTINGS_KEY = "processed_webhook_payments";
// In-process L1 cache (still useful within the same function instance)
const inMemoryDedup = new Map<string, number>();

async function isDuplicatePayment(keys: string | (string | null | undefined)[]): Promise<boolean> {
  const now = Date.now();
  const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

  const keyList = (Array.isArray(keys) ? keys : [keys])
    .filter((k): k is string => Boolean(k && typeof k === "string" && k.trim().length > 0))
    .map((k) => k.trim());

  if (keyList.length === 0) return false;

  // L1: In-memory check (fast path within same instance)
  for (const k of keyList) {
    if (inMemoryDedup.has(k)) {
      return true;
    }
  }

  // L2: Persistent Supabase check (survives cold starts and multi-instance deploys)
  try {
    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", DEDUP_SETTINGS_KEY)
      .maybeSingle();

    let processed: { id: string; ts: number }[] = [];
    if (row?.value) {
      try {
        processed = JSON.parse(row.value);
      } catch (_) {}
    }

    // Prune stale entries (older than TTL)
    const pruned = processed.filter((p) => now - p.ts < TTL_MS);

    // Check if any key in keyList is in the processed list
    const isDup = pruned.some((p) => keyList.includes(p.id));
    if (isDup) {
      console.log('[webhook dedup] Duplicate detected for keys:', keyList.join(', '));
      keyList.forEach((k) => inMemoryDedup.set(k, now));
      return true;
    }

    // Not a duplicate — register all keys
    keyList.forEach((k) => {
      pruned.push({ id: k, ts: now });
      inMemoryDedup.set(k, now);
    });

    // Await persistence so serverless functions don't drop the write!
    try {
      await supabase.from("app_settings").upsert(
        {
          key: DEDUP_SETTINGS_KEY,
          value: JSON.stringify(pruned.slice(-300)), // cap at 300 entries
          description: "Persistent payment dedup store for Razorpay webhook (2hr TTL)",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    } catch (saveErr) {
      console.warn("[webhook dedup] Error saving to Supabase dedup cache:", saveErr);
    }

    return false;
  } catch (err) {
    console.warn("[webhook dedup] Supabase check failed, using in-memory only:", err);
    keyList.forEach((k) => inMemoryDedup.set(k, now));
    return false;
  }
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

      const paymentLinkId = paymentLink?.id;
      const paymentId =
        payment?.id ||
        (Array.isArray(paymentLink?.payments) && paymentLink.payments[0]?.payment_id) ||
        paymentLinkId;
      const rawAmt = paymentLink?.amount_paid || payment?.amount || paymentLink?.amount || 0;
      const amount = (Number(rawAmt) || 0) / 100;
      const notes = paymentLink?.notes || payment?.notes || {};
      const orderRef = notes.order_ref || paymentLink?.reference_id || `UT-DEL-${paymentLinkId?.slice(-6) || Date.now()}`;
      const orderId = payment?.order_id || paymentLink?.order_id || null;
      const customerName = notes.customer_name || paymentLink?.customer?.name || payment?.notes?.customer_name || "Valued Customer";
      const customerPhone = notes.customer_phone || paymentLink?.customer?.contact || payment?.contact || "";
      const customerEmail = notes.customer_email || paymentLink?.customer?.email || payment?.email || null;
      const itemsSummary = notes.items_summary || paymentLink?.description || "Fresh Himalayan Rainbow Trout";
      const method = payment?.method ? payment.method.toUpperCase() : "UPI / Razorpay Link";
      const vpa = payment?.vpa || null;

      const isDuplicate = await isDuplicatePayment([paymentId, paymentLinkId, orderRef, orderId]);

      const channelLabel = notes.channel === "WHATSAPP_DEAL"
        ? "🤝 WhatsApp Deal (Deal Desk)"
        : "🛵 Home Delivery (Razorpay Link)";

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
            channel: channelLabel,
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
      // ⚠️ SKIP auto-insert for POS_BILLING channel — counter staff add entries manually.
      const isPosChannel = notes.channel === "POS_BILLING";
      if (!isPosChannel) {
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

          // First check if an entry already exists with this payment_id (prevents double-insert)
          const { data: existingByPaymentId } = await supabase
            .from("vending_sales_log")
            .select("id")
            .or(`custom_fields->>payment_id.eq.${paymentId},custom_fields->>payment_link_id.eq.${paymentLinkId || paymentId}`)
            .limit(1);

          if (existingByPaymentId && existingByPaymentId.length > 0) {
            console.log(`[webhook] Vending log entry already exists for paymentId ${paymentId}, skipping insert.`);
          } else {
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
              let tw = 1.0;
              let prodType = "Gutted";
              let rate = 570;
              let expAmount = amount;
              let discAmount = 0;

              if (invData) {
                tw = Number(invData.tw) || 1.0;
                const firstItem = invData.items?.[0];
                const itemN = (firstItem?.n || "").toLowerCase();
                prodType = itemN.includes("gutted") && !itemN.includes("non") ? "Gutted" : "Non Gutted";
                rate = firstItem?.r ? Number(firstItem.r) : Math.round(amount / (tw || 1));
                expAmount = invData.standardTotal ? Number(invData.standardTotal) : (invData.tot || amount);
                discAmount = invData.discountAmount !== undefined ? Number(invData.discountAmount) : Math.max(0, expAmount - amount);
              } else {
                // Fallback to structured notes from Razorpay
                if (notes.weight_kg) tw = parseFloat(notes.weight_kg) || 1.0;
                if (notes.product_type) prodType = notes.product_type;
                if (notes.rate_per_kg) rate = parseFloat(notes.rate_per_kg) || Math.round((amount / tw) * 10) / 10;
                if (notes.standard_total) expAmount = parseFloat(notes.standard_total) || amount;
                if (notes.discount_amount) discAmount = parseFloat(notes.discount_amount) || 0;

                // Fallback parsing from itemsSummary
                if (tw === 1.0 && itemsSummary) {
                  const wtMatch = itemsSummary.match(/([\d.]+)\s*kg/i);
                  if (wtMatch) tw = parseFloat(wtMatch[1]) || 1.0;
                  if (itemsSummary.toLowerCase().includes("gutted") && !itemsSummary.toLowerCase().includes("non")) {
                    prodType = "Gutted";
                  }
                  if (!notes.rate_per_kg) rate = Math.round((amount / tw) * 10) / 10;
                }
              }

              const newLog = {
                id: crypto.randomUUID(),
                entry_date: new Date().toISOString().split("T")[0],
                entry_time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
                weight_kg: tw,
                product_type: prodType,
                rate_per_kg: rate,
                expected_amount: expAmount,
                amount_paid: amount,
                discount_amount: discAmount,
                payment_mode: "Razorpay Link",
                logged_by: "WhatsApp Remote Pay",
                notes: `Remote Order #${orderRef} - ${customerName} (Phone: ${customerPhone}) [Paid ✓ ${paymentId}]`,
                custom_fields: {
                  expected_amount: expAmount,
                  discount_amount: discAmount,
                  effective_rate: rate,
                  payment_status: "PAID",
                  payment_id: paymentId,
                  payment_link_id: paymentLinkId,
                  customer_name: customerName,
                  customer_phone: customerPhone,
                  paid_at: new Date().toISOString(),
                },
              };

              try {
                const { error: insErr } = await supabase.from("vending_sales_log").insert(newLog);
                if (insErr) {
                  // Retry without top-level expected_amount/discount_amount if schema cache mismatch
                  const sanitized = { ...newLog };
                  delete (sanitized as any).expected_amount;
                  delete (sanitized as any).discount_amount;
                  await supabase.from("vending_sales_log").insert(sanitized);
                }
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
          }
        } catch (dbErr) {
          console.warn("Vending log update notice for payment_link.paid:", dbErr);
        }
      } else {
        console.log(`[webhook] POS_BILLING channel — skipping vending log auto-insert for paymentId ${paymentId}. Staff will log manually.`);
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

      // 5. If this is a Customer Balance (Khata) Payment Link:
      if (String(orderRef).startsWith("BAL-") || String(orderRef).startsWith("Bal-")) {
        try {
          const balanceRef = String(orderRef).replace(/^(BAL-|Bal-)/, "");
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://urbantrout.in";
          const adminAuthToken = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_API_SECRET || "";
          await fetch(`${siteUrl}/api/customer-balance`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-admin-token": adminAuthToken,
            },
            body: JSON.stringify({
              id: balanceRef,
              action: "RECORD_PAYMENT",
              amountReceived: amount,
              paymentMethod: "Razorpay Link (Verified)",
              settlementNote: `Paid in full via Razorpay Online Link (Payment ID: ${paymentId})`,
            }),
          });
        } catch (balErr) {
          console.warn("Error auto-settling customer balance via webhook:", balErr);
        }
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
      const orderRef = notes.order_ref || notes.bill_number || null;
      const paymentLinkId = notes.payment_link_id || payment.invoice_id || null;

      // Prevent duplicate notification: Razorpay fires payment_link.paid, payment.captured AND order.paid
      const isDuplicate = await isDuplicatePayment([paymentId, orderId, orderRef, paymentLinkId]);


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

      // 4. Update customer balance / vending log if this was a Balance QR or Balance Order
      const rawRef = notes.order_ref || notes.bill_number || description || "";
      if (String(rawRef).includes("BAL-") || String(rawRef).includes("Bal-")) {
        try {
          const match = String(rawRef).match(/Bal(?:ance)?-([A-Za-z0-9\-_]+)/i);
          const balanceRef = match ? match[1] : null;
          if (balanceRef) {
            const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://urbantrout.in";
            const adminAuthToken = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ADMIN_API_SECRET || "";
            await fetch(`${siteUrl}/api/customer-balance`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "x-admin-token": adminAuthToken,
              },
              body: JSON.stringify({
                id: balanceRef,
                action: "RECORD_PAYMENT",
                amountReceived: amount,
                paymentMethod: "Razorpay QR (Verified)",
                settlementNote: `Paid in full via Razorpay Dynamic QR (Payment ID: ${paymentId})`,
              }),
            });
          }
        } catch (balQrErr) {
          console.warn("Error auto-settling balance QR via webhook:", balQrErr);
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
