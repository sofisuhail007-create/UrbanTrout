import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendOrderStatusUpdateEmail } from "@/lib/email";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ success: false, error: "Missing orderId or status" }, { status: 400 });
    }

    // 1. Update status in Supabase
    const { data: updatedOrder, error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .select("*")
      .single();

    if (error || !updatedOrder) {
      return NextResponse.json({ success: false, error: error?.message || "Order not found" }, { status: 404 });
    }

    // 2. Trigger Customer Email if email exists
    if (updatedOrder.customer_email) {
      await sendOrderStatusUpdateEmail({
        orderNumber: updatedOrder.order_number,
        customerName: updatedOrder.customer_name,
        email: updatedOrder.customer_email,
        phone: updatedOrder.customer_phone,
        total: updatedOrder.total,
      }, status);
    }

    // 3. Log status change in Telegram group
    const statusLabels: Record<string, string> = {
      processing: "✅ Payment Verified (Order Confirmed & Harvesting)",
      out_for_delivery: "🚚 Out for Delivery (Rider Dispatched)",
      delivered: "✨ Delivered to Customer",
      cancelled: "❌ Order Cancelled",
    };

    if (statusLabels[status]) {
      await sendTelegramMessage(
        `📋 <b>ORDER STATUS UPDATED</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>Order ID:</b> <code>#${updatedOrder.order_number}</code>\n<b>Customer:</b> ${updatedOrder.customer_name} (+91 ${updatedOrder.customer_phone})\n<b>New Status:</b> <b>${statusLabels[status]}</b>`,
        "HTML"
      );
    }

    return NextResponse.json({ success: true, order: updatedOrder });

  } catch (err) {
    console.error("Order status API error:", err);
    return NextResponse.json({ success: false, error: "Failed to update order status" }, { status: 500 });
  }
}
