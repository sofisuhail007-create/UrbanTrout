import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { notifyRazorpayPayment } from "@/lib/telegram";
import { sendPaymentLinkConfirmationEmail } from "@/lib/email";
import { enqueueWhatsAppDispatch } from "@/lib/whatsappDispatch";
import { autoSettleKhataPayment } from "@/lib/khataAutoSettle";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ─── Persistent Deduplication (Supabase-backed) ───────────────────────────────
// The in-memory Map is lost on every Vercel cold start, causing duplicate Telegram
// messages and double DB inserts when Razorpay retries webhooks.
// We use Supabase app_settings as a persistent store with a 2-hour TTL per paymentId.

const DEDUP_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
// In-process L1 cache (still useful within the same function instance)
const inMemoryDedup = new Map<string, number>();

async function isDuplicatePayment(keys: string | (string | null | undefined)[]): Promise<boolean> {
  const now = Date.now();

  const keyList = (Array.isArray(keys) ? keys : [keys])
    .filter((k): k is string => Boolean(k && typeof k === "string" && k.trim().length > 0))
    .map((k) => k.trim());

  if (keyList.length === 0) return false;

  // L1: In-memory check (fast path within same instance)
  for (const k of keyList) {
    if (inMemoryDedup.has(k) && now - (inMemoryDedup.get(k) || 0) < DEDUP_TTL_MS) {
      console.log("[webhook dedup] In-memory duplicate detected for key:", k);
      return true;
    }
  }

  // L2: Persistent Supabase Atomic Lock Check via PostgreSQL Primary Key Constraint
  // When Razorpay pushes concurrent webhook events (payment_link.paid, payment.captured, order.paid)
  // at the exact same millisecond across distributed serverless instances, atomic INSERT guarantees
  // that only ONE request succeeds in inserting pay_lock_<key>. All concurrent requests receive
  // Postgres error code 23505 (unique_violation) and are immediately rejected as duplicates.
  try {
    const dbKeys = keyList.map((k) => `pay_lock_${k}`);

    const { data: existingRows } = await supabase
      .from("app_settings")
      .select("key, updated_at")
      .in("key", dbKeys);

    if (existingRows && existingRows.length > 0) {
      const activeLock = existingRows.find((r) => {
        const rowTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;
        return now - rowTime < DEDUP_TTL_MS;
      });

      if (activeLock) {
        console.log(`[webhook dedup] Active DB lock detected: ${activeLock.key}`);
        keyList.forEach((k) => inMemoryDedup.set(k, now));
        return true;
      }
    }

    const primaryKey = keyList[0];
    const primaryDbKey = `pay_lock_${primaryKey}`;

    const { error: insertError } = await supabase.from("app_settings").insert({
      key: primaryDbKey,
      value: JSON.stringify({ ts: now, keys: keyList }),
      description: "Atomic Webhook Payment Lock (2hr TTL)",
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      if (
        insertError.code === "23505" ||
        insertError.message?.toLowerCase().includes("duplicate key") ||
        insertError.message?.toLowerCase().includes("unique constraint")
      ) {
        console.log(`[webhook dedup] Atomic lock collision on ${primaryDbKey} — duplicate caught!`);
        keyList.forEach((k) => inMemoryDedup.set(k, now));
        return true;
      }
      console.warn("[webhook dedup] Lock insert notice:", insertError);
    }

    if (keyList.length > 1) {
      const secondaryRows = keyList.slice(1).map((k) => ({
        key: `pay_lock_${k}`,
        value: JSON.stringify({ ts: now, primary: primaryKey }),
        description: "Atomic Webhook Payment Lock Secondary",
        updated_at: new Date().toISOString(),
      }));
      try {
        await supabase.from("app_settings").upsert(secondaryRows, { onConflict: "key" });
      } catch (_) {}
    }

    keyList.forEach((k) => inMemoryDedup.set(k, now));
    return false;
  } catch (err) {
    console.warn("[webhook dedup] Supabase atomic lock error, falling back to memory:", err);
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
      const googleMapsUrl = notes.google_maps_url || null;
      const latitude = notes.latitude ? Number(notes.latitude) : null;
      const longitude = notes.longitude ? Number(notes.longitude) : null;
      const distanceKm = notes.distance_km ? Number(notes.distance_km) : null;

      const cleanPhone = customerPhone ? String(customerPhone).replace(/\D/g, "").slice(-10) : "";
      const amtPhoneKey = cleanPhone && amount ? `amt_ph_${cleanPhone}_${Math.round(amount)}` : null;
      const isDuplicate = await isDuplicatePayment([paymentId, paymentLinkId, orderRef, orderId, amtPhoneKey]);

      const channelLabel = notes.channel === "WHATSAPP_DEAL"
        ? "🤝 WhatsApp Deal (Deal Desk)"
        : notes.channel === "WHATSAPP_AI_AGENT"
        ? "🤖 WhatsApp AI Agent"
        : notes.channel === "POS_BILLING"
        ? "Counter POS QR"
        : !notes.channel
        ? "📱 Razorpay Mobile App"
        : "🛵 Home Delivery (Razorpay Link)";

      const bank = payment?.bank || null;
      const wallet = payment?.wallet || null;
      const card = payment?.card || null;
      const fee = payment?.fee || null;
      const tax = payment?.tax || null;

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
            bank,
            wallet,
            card,
            fee,
            tax,
            customerName,
            customerPhone,
            customerEmail,
            description: itemsSummary,
            channel: channelLabel,
            googleMapsUrl,
            latitude,
            longitude,
            distanceKm,
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

        // 3. Instant WhatsApp Order Confirmation to Customer
        if (customerPhone) {
          const safeName = (!customerName || customerName.toLowerCase() === "void" || customerName.toLowerCase() === "customer") ? "" : `, ${customerName}`;
          try {
            await enqueueWhatsAppDispatch({
              orderRef,
              phone: customerPhone,
              customerName: customerName || "Valued Customer",
              status: "payment_confirmed",
              messageText: `✅ *Payment Received & Order Confirmed!* 🐟\n\nThank you${safeName}! Your payment of *₹${amount}* has been verified successfully.\n\n📋 *Order Details:*\n• *Order Ref:* #${orderRef}\n• *Items:* ${itemsSummary}\n• *Payment ID:* ${paymentId}\n• *Status:* Live Harvest Scheduled\n\nOur farm team at Malabagh is preparing your fresh harvest. We will deliver it fresh to your doorstep within 2 hours!`,
            });
          } catch (waErr) {
            console.error("WhatsApp notification error for payment_link.paid:", waErr);
          }
        }
      }

      // 4. Vending log is 100% manually maintained by farm staff at the vending counter.
      // Invoicing, remote links, and catch-weight must never affect or auto-insert into vending_sales_log.
      console.log(`[webhook] Vending log entries are strictly manual — skipping vending log auto-insert for paymentId ${paymentId}.`);

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
              const paidAmt = Number(prev.tot || prev.grandTotal || amount);
              await supabase
                .from("invoices")
                .update({
                  data: {
                    ...prev,
                    paymentStatus: "PAID",
                    paymentMethod: "Razorpay Link (Verified)",
                    paymentId,
                    paidAt: new Date().toISOString(),
                    paidAmount: paidAmt,
                    balanceAmount: 0,
                    balanceStatus: "settled",
                  },
                })
                .eq("id", inv.id);
            }
          }
        }
      } catch (invErr) {
        console.warn("Invoices sync notice for payment_link.paid:", invErr);
      }

      // 5. Check and Auto-Settle Customer Balance (Khata) if customer has open balance
      try {
        await autoSettleKhataPayment({
          paymentId,
          paymentLinkId,
          orderRef,
          amount,
          customerPhone: cleanPhone || customerPhone,
          customerName,
          notes,
          method,
        });
      } catch (autoKhataErr) {
        console.warn("[webhook] autoSettleKhataPayment notice for payment_link.paid:", autoKhataErr);
      }

      return NextResponse.json({ success: true, processed: paymentId, type: "payment_link.paid" });
    }

    // ── 2. Payment Captured / Order Paid / QR Code Credited (Checkout, POS QR, or Links) ──
    if (eventType === "payment.captured" || eventType === "order.paid" || eventType === "qr_code.credited") {
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
      const qrCodeEntity = event.payload?.qr_code?.entity;
      const notes = (payment.notes && Object.keys(payment.notes).length > 0)
        ? payment.notes
        : (qrCodeEntity?.notes || {});
      const description = payment.description || qrCodeEntity?.description || null;
      const orderRef = notes.order_ref || notes.bill_number || null;
      const paymentLinkId = notes.payment_link_id || payment.invoice_id || null;
      const cleanPhone = (notes.customer_phone || notes.phone || contact) ? String(notes.customer_phone || notes.phone || contact).replace(/\D/g, "").slice(-10) : "";
      const amtPhoneKey = cleanPhone && amount ? `amt_ph_${cleanPhone}_${Math.round(amount)}` : null;

      // Prevent duplicate notification: Razorpay fires payment_link.paid, payment.captured AND order.paid
      const isDuplicate = await isDuplicatePayment([paymentId, orderId, orderRef, paymentLinkId, amtPhoneKey]);


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
      const isRiderCod = notes.channel === "RIDER_COD_QR";

      const channelLabel = notes.channel === "WHATSAPP_DEAL"
        ? "🤝 WhatsApp Deal (Deal Desk)"
        : notes.channel === "WHATSAPP_AI_AGENT"
        ? "🤖 WhatsApp AI Agent"
        : isRiderCod
        ? "🛵 Doorstep Rider COD (Razorpay QR)"
        : isHomeDelivery
        ? "🛵 Home Delivery (Razorpay Link)"
        : isPos
        ? "Counter POS QR"
        : !notes.channel
        ? "📱 Razorpay Mobile App"
        : "Website Checkout";

      const googleMapsUrl = notes.google_maps_url || null;
      const latitude = notes.latitude ? Number(notes.latitude) : null;
      const longitude = notes.longitude ? Number(notes.longitude) : null;
      const distanceKm = notes.distance_km ? Number(notes.distance_km) : null;

      const bank = payment.bank || null;
      const wallet = payment.wallet || null;
      const card = payment.card || null;
      const fee = payment.fee || null;
      const tax = payment.tax || null;

      // 1. Send Instant Telegram Alert ONLY ONCE per payment ID
      if (!isDuplicate) {
        await notifyRazorpayPayment({
          paymentId,
          orderId: orderRef || orderId,
          amount,
          status: "captured",
          method,
          vpa,
          bank,
          wallet,
          card,
          fee,
          tax,
          customerName,
          customerPhone: cleanPhone || customerPhone,
          customerEmail: email,
          description: notes.items_summary || description,
          channel: channelLabel,
          googleMapsUrl,
          latitude,
          longitude,
          distanceKm,
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
                paidAmount: Number(invRow.data.tot || invRow.data.grandTotal || amount),
                balanceAmount: 0,
                balanceStatus: "settled",
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

      // 4. Check and Auto-Settle Customer Balance (Khata) if customer has open balance
      try {
        await autoSettleKhataPayment({
          paymentId,
          paymentLinkId,
          orderRef: orderRef || notes?.order_ref || null,
          amount,
          customerPhone: cleanPhone || customerPhone,
          customerName,
          notes,
          method: payment.method ? payment.method.toUpperCase() : "Online Payment (Razorpay)",
        });
      } catch (autoKhataErr) {
        console.warn("[webhook] autoSettleKhataPayment notice for payment.captured:", autoKhataErr);
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
