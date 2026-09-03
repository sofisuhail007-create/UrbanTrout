import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { notifyRazorpayPayment } from "@/lib/telegram";

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

    // ── 1. Payment Captured / Order Paid (Checkout, POS QR, or Links) ──
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
          channel: isPos ? "Counter POS QR" : "Website Checkout",
        });
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
      "payment.failed",
      "qr_code.credited",
    ],
    instructions:
      "In Razorpay Dashboard > Account & Settings > Webhooks, add this Webhook URL with events: payment.captured, order.paid, payment.failed.",
  });
}
