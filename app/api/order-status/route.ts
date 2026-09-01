import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { getOrderKeyboard, sendTelegramMessage } from "@/lib/telegram";
import { requireAdminAuth } from "@/lib/adminAuth";

function extractEmail(order: any): string | undefined {
  if (order.customer_email && typeof order.customer_email === "string" && order.customer_email.includes("@")) {
    return order.customer_email.trim();
  }
  if (order.customer_address && typeof order.customer_address === "string") {
    const match = order.customer_address.match(/Email:\s*([^\s)]+@[^\s)]+)/i);
    if (match) return match[1].trim();
  }
  return undefined;
}

export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ success: false, error: "Missing orderId or status" }, { status: 400 });
    }

    // 1. Update status in Supabase
    let query = supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() });

    const isNumeric = /^\d+$/.test(String(orderId));
    if (isNumeric) {
      query = query.eq("order_number", parseInt(orderId, 10));
    } else {
      query = query.eq("id", orderId);
    }

    const { data: updatedOrder, error } = await query.select("*").single();

    if (error || !updatedOrder) {
      return NextResponse.json({ success: false, error: error?.message || "Order not found" }, { status: 404 });
    }

    // 2. Trigger Customer Email if email exists
    const customerEmail = extractEmail(updatedOrder);
    if (customerEmail) {
      await sendOrderStatusUpdateEmail({
        orderNumber: String(updatedOrder.order_number),
        customerName: updatedOrder.customer_name,
        email: customerEmail,
        phone: updatedOrder.customer_phone,
        total: updatedOrder.total,
      }, status);
    }

    // 3. Log status change in Telegram group with WhatsApp customer update button
    const statusLabels: Record<string, string> = {
      processing: "✅ Payment Verified (Order Confirmed & Harvesting)",
      out_for_delivery: "🚚 Out for Delivery (Rider Dispatched)",
      delivered: "✨ Delivered to Customer",
      cancelled: "❌ Order Cancelled",
    };

    if (statusLabels[status]) {
      const cleanPhone = String(updatedOrder.customer_phone || "").replace(/\D/g, "").slice(-10);
      const kb = getOrderKeyboard(updatedOrder.order_number, status, cleanPhone, updatedOrder.customer_name);
      await sendTelegramMessage(
        `📋 <b>ORDER STATUS UPDATED VIA ADMIN PANEL</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>Order ID:</b> <code>#${updatedOrder.order_number}</code>\n<b>Customer:</b> ${updatedOrder.customer_name} (<a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>)\n<b>New Status:</b> <b>${statusLabels[status]}</b>`,
        "HTML",
        kb
      );
    }

    return NextResponse.json({ success: true, order: updatedOrder });

  } catch (err) {
    console.error("Order status API error:", err);
    return NextResponse.json({ success: false, error: "Failed to update order status" }, { status: 500 });
  }
}
