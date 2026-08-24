import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  answerCallbackQuery,
  editTelegramMessageText,
  formatOrderTelegramText,
  getOrderKeyboard,
  sendTelegramMessage,
} from "@/lib/telegram";
import { sendOrderStatusUpdateEmail } from "@/lib/email";

// Helper to determine status display name
const STATUS_NAMES: Record<string, string> = {
  pending: "Awaiting Verification",
  processing: "Confirmed & Harvesting",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export async function POST(request: Request) {
  try {
    const update = await request.json();

    // ─── 1. Handle Inline Button Callback Queries (1-Tap Status Updates) ───
    if (update.callback_query) {
      const cq = update.callback_query;
      const dataStr: string = cq.data || "";
      const message = cq.message;
      const chatId = message?.chat?.id;
      const messageId = message?.message_id;

      // Handle order status callbacks: "ord:<status>:<orderNumber>"
      if (dataStr.startsWith("ord:")) {
        const parts = dataStr.split(":");
        const newStatus = parts[1] as "pending" | "processing" | "out_for_delivery" | "delivered" | "cancelled";
        const orderNumberOrId = parts[2];

        // 1. Fetch & Update order in Supabase
        let query = supabase.from("orders").update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        });

        // Determine if lookup by order_number or id
        const isNumeric = /^\d+$/.test(orderNumberOrId);
        if (isNumeric) {
          query = query.eq("order_number", parseInt(orderNumberOrId, 10));
        } else {
          query = query.eq("id", orderNumberOrId);
        }

        const { data: updatedOrder, error: dbErr } = await query.select("*").single();

        if (dbErr || !updatedOrder) {
          await answerCallbackQuery(cq.id, `❌ Failed to find Order #${orderNumberOrId}`, true);
          return NextResponse.json({ success: false, error: "Order not found" });
        }

        // 2. Answer Telegram with a top toast notification
        const statusName = STATUS_NAMES[newStatus] || newStatus;
        await answerCallbackQuery(cq.id, `✅ Order #${updatedOrder.order_number} marked as ${statusName}!`);

        // 3. Send email to customer if email is recorded
        if (updatedOrder.customer_email) {
          await sendOrderStatusUpdateEmail(
            {
              orderNumber: String(updatedOrder.order_number),
              customerName: updatedOrder.customer_name,
              email: updatedOrder.customer_email,
              phone: updatedOrder.customer_phone,
              total: updatedOrder.total,
            },
            newStatus
          );
        }

        // 4. Update the Telegram message text and inline buttons in-place
        if (chatId && messageId) {
          const newText = formatOrderTelegramText({
            orderNumber: updatedOrder.order_number,
            status: newStatus,
            total: updatedOrder.total,
            paymentMethod: "UPI",
            customerName: updatedOrder.customer_name,
            phone: updatedOrder.customer_phone,
            locality: updatedOrder.customer_locality,
            address: updatedOrder.customer_address,
            pincode: updatedOrder.customer_pincode,
            items: updatedOrder.items,
          });

          const newKeyboard = getOrderKeyboard(
            updatedOrder.order_number,
            newStatus,
            updatedOrder.customer_phone
          );

          await editTelegramMessageText(chatId, messageId, newText, newKeyboard);
        }

        return NextResponse.json({ success: true, updated: updatedOrder.order_number, status: newStatus });
      }
    }

    // ─── 2. Handle Slash Commands & Text Messages ───
    if (update.message && update.message.text) {
      const msg = update.message;
      const text: string = msg.text.trim();
      const chatId = msg.chat.id;

      // Command: /orders or /pending (List recent active orders)
      if (text.startsWith("/orders") || text.startsWith("/pending")) {
        const { data: recentOrders } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!recentOrders || recentOrders.length === 0) {
          await sendTelegramMessage("📦 No orders found in the database.", "HTML", undefined, chatId);
          return NextResponse.json({ success: true });
        }

        await sendTelegramMessage(
          `📦 <b>LATEST ${recentOrders.length} ORDERS:</b>\n━━━━━━━━━━━━━━━━━━━━`,
          "HTML",
          undefined,
          chatId
        );

        for (const ord of recentOrders) {
          const ordText = formatOrderTelegramText({
            orderNumber: ord.order_number,
            status: ord.status,
            total: ord.total,
            paymentMethod: "UPI",
            customerName: ord.customer_name,
            phone: ord.customer_phone,
            locality: ord.customer_locality,
            address: ord.customer_address,
            pincode: ord.customer_pincode,
            items: ord.items,
          });
          const kb = getOrderKeyboard(ord.order_number, ord.status, ord.customer_phone);
          await sendTelegramMessage(ordText, "HTML", kb, chatId);
        }

        return NextResponse.json({ success: true });
      }

      // Command: /order <orderNumber> (Lookup single order)
      if (text.startsWith("/order ")) {
        const queryNum = text.replace("/order", "").trim();
        const isNumeric = /^\d+$/.test(queryNum);

        let q = supabase.from("orders").select("*");
        if (isNumeric) {
          q = q.eq("order_number", parseInt(queryNum, 10));
        } else {
          q = q.eq("id", queryNum);
        }

        const { data: ord } = await q.single();
        if (!ord) {
          await sendTelegramMessage(`❌ Order <code>#${queryNum}</code> not found.`, "HTML", undefined, chatId);
          return NextResponse.json({ success: true });
        }

        const ordText = formatOrderTelegramText({
          orderNumber: ord.order_number,
          status: ord.status,
          total: ord.total,
          paymentMethod: "UPI",
          customerName: ord.customer_name,
          phone: ord.customer_phone,
          locality: ord.customer_locality,
          address: ord.customer_address,
          pincode: ord.customer_pincode,
          items: ord.items,
        });
        const kb = getOrderKeyboard(ord.order_number, ord.status, ord.customer_phone);
        await sendTelegramMessage(ordText, "HTML", kb, chatId);
        return NextResponse.json({ success: true });
      }

      // Command: /price <whole|gutted> <amount> (Update live price)
      if (text.startsWith("/price")) {
        const parts = text.split(/\s+/);
        if (parts.length >= 3) {
          const productKey = parts[1].toLowerCase().includes("gut") ? "gutted-trout" : "whole-trout";
          const newPrice = parseFloat(parts[2]);

          if (isNaN(newPrice) || newPrice <= 0) {
            await sendTelegramMessage("⚠️ Please provide a valid price number, e.g. <code>/price whole 520</code>", "HTML", undefined, chatId);
            return NextResponse.json({ success: true });
          }

          const { error } = await supabase
            .from("inventory")
            .update({ price_per_kg: newPrice, updated_at: new Date().toISOString() })
            .eq("product_id", productKey);

          if (error) {
            await sendTelegramMessage(`❌ Failed to update price: ${error.message}`, "HTML", undefined, chatId);
          } else {
            const prodName = productKey === "gutted-trout" ? "Premium Gutted Trout" : "Whole Rainbow Trout";
            await sendTelegramMessage(`💰 <b>PRICE UPDATED!</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>${prodName}</b> is now <b>₹${newPrice} / Kg</b> on <a href="https://urbantrout.in">urbantrout.in</a>`, "HTML", undefined, chatId);
          }
          return NextResponse.json({ success: true });
        } else {
          // Show current prices
          const { data: inv } = await supabase.from("inventory").select("*");
          const invList = inv?.map(i => `• <b>${i.product_id}:</b> ₹${i.price_per_kg} / Kg`).join("\n") || "No inventory records.";
          await sendTelegramMessage(`💰 <b>CURRENT LIVE PRICES:</b>\n━━━━━━━━━━━━━━━━━━━━\n${invList}\n\n<i>To change price:</i> <code>/price whole 520</code> or <code>/price gutted 580</code>`, "HTML", undefined, chatId);
          return NextResponse.json({ success: true });
        }
      }

      // Command: /stats or /today (Sales stats)
      if (text.startsWith("/stats") || text.startsWith("/today")) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: todayOrders } = await supabase
          .from("orders")
          .select("*")
          .gte("created_at", todayStart.toISOString());

        const totalRevenue = todayOrders?.reduce((acc, o) => acc + (Number(o.total) || 0), 0) || 0;
        const totalCount = todayOrders?.length || 0;

        await sendTelegramMessage(
          `📊 <b>TODAY'S SUMMARY (${new Date().toLocaleDateString("en-IN")})</b>\n━━━━━━━━━━━━━━━━━━━━\n• <b>Total Orders:</b> ${totalCount}\n• <b>Total Revenue:</b> ₹${totalRevenue.toLocaleString("en-IN")}\n• <b>Status Breakdown:</b>\n  - Confirmed/Harvesting: ${todayOrders?.filter(o => o.status === "processing").length || 0}\n  - Out for Delivery: ${todayOrders?.filter(o => o.status === "out_for_delivery").length || 0}\n  - Delivered: ${todayOrders?.filter(o => o.status === "delivered").length || 0}\n  - Pending: ${todayOrders?.filter(o => o.status === "pending").length || 0}`,
          "HTML",
          undefined,
          chatId
        );
        return NextResponse.json({ success: true });
      }

      // Command: /help or /start
      if (text.startsWith("/help") || text.startsWith("/start")) {
        await sendTelegramMessage(
          `🐟 <b>URBAN TROUT ADMIN BOT</b> ⚡\n━━━━━━━━━━━━━━━━━━━━\nHere are the commands you can use:\n\n📦 <b>/orders</b> - View recent orders with 1-tap status buttons\n🔍 <b>/order [number]</b> - Lookup a specific order\n💰 <b>/price [whole|gutted] [amount]</b> - Update live website prices\n📊 <b>/stats</b> - View today's sales and order stats\n❓ <b>/help</b> - Show this message\n\n<i>You can also tap the inline buttons directly under any new order alert to confirm, dispatch, or mark it delivered instantly!</i>`,
          "HTML",
          undefined,
          chatId
        );
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN || "8830453300:AAFWnXz1eyTdPo5zX2lIAGYVjr7ZMA3QGIM";
  const webhookUrl = `https://urbantrout.in/api/telegram-webhook`;
  const setWebhookApi = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

  return NextResponse.json({
    status: "Telegram Webhook Handler Active",
    webhookUrl,
    setWebhookApi,
    instructions: "Open setWebhookApi URL in browser or make a GET request to link Telegram Bot to this webhook endpoint.",
  });
}
