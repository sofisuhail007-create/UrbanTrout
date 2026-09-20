import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  // 1. Rate Limiting: 10 order placement calls per minute per IP
  const { limited } = checkRateLimit(req, 10, 60 * 1000);
  if (limited) {
    return NextResponse.json(
      { success: false, error: "Too many order submissions. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData,
    } = body;

    // 2. Validate Payment Information
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { success: false, error: "Missing required Razorpay payment confirmation details." },
        { status: 400 }
      );
    }

    if (!orderData || !orderData.customer_phone || !orderData.items) {
      return NextResponse.json(
        { success: false, error: "Missing required order information." },
        { status: 400 }
      );
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ success: false, error: "Payment server configuration error." }, { status: 500 });
    }

    // 3. Verify Razorpay HMAC-SHA256 Cryptographic Signature
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("[orders/place] Signature mismatch detected!", {
        razorpay_order_id,
        razorpay_payment_id,
      });
      return NextResponse.json(
        { success: false, error: "Cryptographic payment verification failed. Order not placed." },
        { status: 400 }
      );
    }

    // 4. Prevent Replay Attacks: Check if this payment ID was already used
    const { data: existingOrder } = await supabaseServer
      .from("orders")
      .select("id, order_number")
      .like("customer_address", `%${razorpay_payment_id}%`)
      .maybeSingle();

    if (existingOrder) {
      console.warn("[orders/place] Duplicate order placement attempt for payment ID:", razorpay_payment_id);
      return NextResponse.json({
        success: true,
        order: existingOrder,
        message: "Order was already confirmed.",
      });
    }

    // 5. Clean customer data
    const cleanPhone = String(orderData.customer_phone).replace(/\D/g, "").slice(-10);
    const orderPayload = {
      customer_name: String(orderData.customer_name || "Valued Customer").trim(),
      customer_phone: cleanPhone,
      customer_address: String(orderData.customer_address || "").trim(),
      customer_locality: String(orderData.customer_locality || "").trim(),
      customer_pincode: String(orderData.customer_pincode || "").trim(),
      items: orderData.items,
      subtotal: Number(orderData.subtotal) || 0,
      delivery_fee: Number(orderData.delivery_fee) || 0,
      total: Number(orderData.total) || 0,
      delivery_zone: orderData.delivery_zone || "express_delivery",
      status: "confirmed",
    };

    // 6. Insert order using server-side service role client (bypasses RLS safely)
    const { data: insertedOrder, error: insertErr } = await supabaseServer
      .from("orders")
      .insert(orderPayload)
      .select("*")
      .single();

    if (insertErr || !insertedOrder) {
      console.error("[orders/place] Database insert failed:", insertErr);
      return NextResponse.json(
        { success: false, error: "Database error while confirming order." },
        { status: 500 }
      );
    }

    // 7. Update Lead status to converted
    try {
      await supabaseServer
        .from("leads")
        .update({
          status: "converted",
          notes: `Converted to Order #${insertedOrder.order_number || ""}. Payment via Razorpay (${razorpay_payment_id})`,
          updated_at: new Date().toISOString(),
        })
        .eq("customer_phone", cleanPhone);
    } catch (err) {
      console.warn("[orders/place] Failed to mark lead as converted:", err);
    }

    // 8. Upsert customer record
    try {
      await supabaseServer.from("customers").upsert(
        {
          phone: cleanPhone,
          name: orderPayload.customer_name,
          locality: orderPayload.customer_locality,
          pincode: orderPayload.customer_pincode,
          notes: `Order #${insertedOrder.order_number || ""}`,
          total_orders: 1,
          last_order_at: new Date().toISOString(),
        },
        { onConflict: "phone" }
      );
    } catch (err) {
      console.warn("[orders/place] Failed to upsert customer:", err);
    }

    // 9. Dispatch Telegram Notification
    try {
      const origin = req.nextUrl.origin || "https://urbantrout.in";
      fetch(`${origin}/api/telegram-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_order",
          data: {
            orderNumber: String(insertedOrder.order_number || "UT-" + Math.floor(1000 + Math.random() * 9000)),
            customerName: orderPayload.customer_name,
            phone: cleanPhone,
            locality: orderPayload.customer_locality,
            address: orderPayload.customer_address,
            pincode: orderPayload.customer_pincode,
            items: orderPayload.items,
            subtotal: orderPayload.subtotal,
            deliveryFee: orderPayload.delivery_fee,
            total: orderPayload.total,
            status: "confirmed",
            paymentMethod: "Razorpay",
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
          },
        }),
      }).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      order: insertedOrder,
    });
  } catch (err: any) {
    console.error("[orders/place] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
