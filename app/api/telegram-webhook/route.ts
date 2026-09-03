import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  answerCallbackQuery,
  editTelegramMessageText,
  formatInventoryItemText,
  formatOrderTelegramText,
  getInventoryKeyboard,
  getOrderKeyboard,
  sendTelegramMessage,
  type InlineKeyboardButton,
} from "@/lib/telegram";
import { sendOrderStatusUpdateEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

async function findAndUpdateOrder(rawIdOrNum: string, newStatus: string) {
  const cleanDigits = rawIdOrNum.replace(/\D/g, "");
  const cleanNum = cleanDigits ? parseInt(cleanDigits, 10) : NaN;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawIdOrNum);

  // 1. Try by numeric order_number (e.g. 8, 9, UT-8, #8)
  if (!isNaN(cleanNum) && cleanNum > 0) {
    const { data } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("order_number", cleanNum)
      .select("*")
      .maybeSingle();

    if (data) return data;
  }

  // 2. Try by UUID if it matches UUID format
  if (isUUID) {
    const { data } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", rawIdOrNum)
      .select("*")
      .maybeSingle();

    if (data) return data;
  }

  // 3. Try lookup in invoices table if generated via POS billing
  try {
    const invoiceLookup = cleanDigits || rawIdOrNum;
    const { data: invRow } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceLookup)
      .maybeSingle();

    if (invRow && invRow.data) {
      const updatedInvData = { ...invRow.data, deliveryStatus: newStatus };
      if (newStatus === "cancelled") updatedInvData.paymentStatus = "CANCELLED";
      await supabase
        .from("invoices")
        .update({ data: updatedInvData })
        .eq("id", invoiceLookup);

      return {
        order_number: invRow.id,
        customer_name: invRow.data.customerName || "Customer",
        customer_phone: invRow.data.customerPhone || "",
        total: invRow.data.grandTotal || 0,
        status: newStatus,
        items: (invRow.data.items || []).map((it: any) => ({
          name: it.name,
          quantity: it.weightKg || 1,
          price: it.pricePerKg || it.total,
          unit: "Kg",
        })),
      };
    }
  } catch (_) {}

  return null;
}

async function findOrder(queryNum: string) {
  const cleanDigits = queryNum.replace(/\D/g, "");
  const cleanNum = cleanDigits ? parseInt(cleanDigits, 10) : NaN;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryNum);

  if (!isNaN(cleanNum) && cleanNum > 0) {
    const { data } = await supabase.from("orders").select("*").eq("order_number", cleanNum).maybeSingle();
    if (data) return data;
  }

  if (isUUID) {
    const { data } = await supabase.from("orders").select("*").eq("id", queryNum).maybeSingle();
    if (data) return data;
  }

  return null;
}

// Helper to determine status display name
const STATUS_NAMES: Record<string, string> = {
  pending: "Awaiting Verification",
  processing: "Confirmed & Harvesting",
  confirmed: "Confirmed & Harvesting",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  out_of_stock: "Out of Stock (Refund Due)",
  cancelled: "Cancelled",
};

export async function POST(request: Request) {
  // ─── Security: Verify request is genuinely from Telegram ───
  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && incomingSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await request.json();

    // ─── 1. Handle Inline Button Callback Queries (1-Tap Status Updates) ───
    if (update.callback_query) {
      const cq = update.callback_query;
      const dataStr: string = cq.data || "";
      const message = cq.message;
      const chatId = message?.chat?.id;
      const messageId = message?.message_id;

      // ── Handle Order Status Callbacks: "ord:<status>:<orderNumber>" ──
      if (dataStr.startsWith("ord:")) {
        const parts = dataStr.split(":");
        const newStatus = parts[1] as "pending" | "processing" | "out_for_delivery" | "delivered" | "cancelled" | "out_of_stock";
        const orderNumberOrId = parts[2];

        // 1. Fetch & Update order in Supabase
        const updatedOrder = await findAndUpdateOrder(orderNumberOrId, newStatus);
        const statusName = STATUS_NAMES[newStatus] || newStatus;

        // 2. Answer Telegram with a top toast notification
        await answerCallbackQuery(cq.id, `✅ Order #${orderNumberOrId} marked as ${statusName}!`);

        const existingText = message?.text || "";
        const phoneMatch = existingText.match(/\+91\s*(\d{10})/);
        const nameMatch = existingText.match(/Name:\s*([^\n\r]+)/);
        const totalMatch = existingText.match(/Total:\s*[₹Rs.]*\s*([0-9,]+)/i);
        const emailMatch = (updatedOrder?.customer_address || existingText).match(/Email:\s*([^\s)\n<]+@[^\s)\n<]+)/i);

        const customerPhone = updatedOrder?.customer_phone || (phoneMatch ? phoneMatch[1] : "");
        const customerName = updatedOrder?.customer_name || (nameMatch ? nameMatch[1].trim() : "Valued Customer");
        const totalAmount = updatedOrder?.total || (totalMatch ? parseInt(totalMatch[1].replace(/\D/g, ""), 10) : 0);
        const customerEmail = extractEmail(updatedOrder) || (emailMatch ? emailMatch[1].trim() : undefined);

        // 3. Send email update to customer if email is recorded
        if (customerEmail) {
          try {
            await sendOrderStatusUpdateEmail(
              {
                orderNumber: String(updatedOrder?.order_number || orderNumberOrId),
                customerName: customerName,
                email: customerEmail,
                phone: customerPhone,
                total: totalAmount,
              },
              newStatus
            );
          } catch (mailErr) {
            console.error("Failed to send order status update email:", mailErr);
          }
        }

        // 4. Update the Telegram message text and inline buttons in-place
        if (chatId && messageId) {
          const newText = formatOrderTelegramText({
            orderNumber: updatedOrder?.order_number || orderNumberOrId,
            status: newStatus,
            total: totalAmount,
            paymentMethod: "Razorpay / UPI",
            customerName: customerName,
            phone: customerPhone,
            locality: updatedOrder?.customer_locality,
            address: updatedOrder?.customer_address,
            pincode: updatedOrder?.customer_pincode,
            items: updatedOrder?.items,
          });

          const newKeyboard = getOrderKeyboard(
            updatedOrder?.order_number || orderNumberOrId,
            newStatus,
            customerPhone,
            customerName
          );

          await editTelegramMessageText(chatId, messageId, newText, newKeyboard);
        }

        return NextResponse.json({ success: true, updated: orderNumberOrId, status: newStatus });
      }

      // ── Handle Inventory Availability Toggle: "inv:toggle:<productId>" ──
      if (dataStr.startsWith("inv:toggle:")) {
        const productId = dataStr.replace("inv:toggle:", "").trim();

        const { data: currentItem, error: fetchErr } = await supabase
          .from("inventory")
          .select("*")
          .eq("product_id", productId)
          .single();

        if (fetchErr || !currentItem) {
          await answerCallbackQuery(cq.id, `❌ Product "${productId}" not found.`, true);
          return NextResponse.json({ success: false });
        }

        const newAvailable = !currentItem.available;
        const { data: updatedItem, error: updateErr } = await supabase
          .from("inventory")
          .update({ available: newAvailable, updated_at: new Date().toISOString() })
          .eq("product_id", productId)
          .select("*")
          .single();

        if (updateErr || !updatedItem) {
          await answerCallbackQuery(cq.id, `❌ Failed to update availability.`, true);
          return NextResponse.json({ success: false });
        }

        const stateText = newAvailable ? "🟢 IN STOCK (Available on site)" : "🔴 OUT OF STOCK (Disabled)";
        await answerCallbackQuery(cq.id, `✅ ${updatedItem.product_name} is now ${stateText}!`);

        if (chatId && messageId) {
          const newText = formatInventoryItemText(updatedItem);
          const newKb = getInventoryKeyboard(updatedItem.product_id, updatedItem.available, updatedItem.stock_kg);
          await editTelegramMessageText(chatId, messageId, newText, newKb);
        }

        return NextResponse.json({ success: true });
      }

      // ── Handle Inventory Stock Add: "inv:add:<productId>:<amount>" ──
      if (dataStr.startsWith("inv:add:")) {
        const parts = dataStr.split(":");
        const productId = parts[2];
        const addAmount = parseFloat(parts[3]) || 0;

        const { data: currentItem, error: fetchErr } = await supabase
          .from("inventory")
          .select("*")
          .eq("product_id", productId)
          .single();

        if (fetchErr || !currentItem) {
          await answerCallbackQuery(cq.id, `❌ Product "${productId}" not found.`, true);
          return NextResponse.json({ success: false });
        }

        const newStock = Math.max(0, (Number(currentItem.stock_kg) || 0) + addAmount);
        const { data: updatedItem, error: updateErr } = await supabase
          .from("inventory")
          .update({ stock_kg: newStock, updated_at: new Date().toISOString() })
          .eq("product_id", productId)
          .select("*")
          .single();

        if (updateErr || !updatedItem) {
          await answerCallbackQuery(cq.id, `❌ Failed to update stock.`, true);
          return NextResponse.json({ success: false });
        }

        await answerCallbackQuery(cq.id, `✅ +${addAmount} Kg added! Total Stock: ${newStock} Kg`);

        if (chatId && messageId) {
          const newText = formatInventoryItemText(updatedItem);
          const newKb = getInventoryKeyboard(updatedItem.product_id, updatedItem.available, updatedItem.stock_kg);
          await editTelegramMessageText(chatId, messageId, newText, newKb);
        }

        return NextResponse.json({ success: true });
      }

      // ── Handle Live Chat Close Callback: "chat:close:<threadId>" ──
      if (dataStr.startsWith("chat:close:")) {
        const targetThreadId = dataStr.replace("chat:close:", "");
        const nowIso = new Date().toISOString();

        try {
          // Update thread in Supabase
          await supabase.from("live_chat_threads").update({
            status: "closed",
            updated_at: nowIso,
          }).eq("id", targetThreadId);

          // Insert closing message into chat history
          await supabase.from("live_chat_messages").insert({
            id: `msg_${Date.now()}_close`,
            thread_id: targetThreadId,
            sender: "staff",
            sender_name: "Urban Trout Support",
            text: "This chat conversation has been ended by the farm team. Feel free to start a new chat anytime! 🐟",
            created_at: nowIso,
          });

          await answerCallbackQuery(cq.id, "🔴 Chat session ended and visitor notified!");

          if (chatId && messageId) {
            const originalText = message?.text || "";
            await editTelegramMessageText(
              chatId,
              messageId,
              `${originalText}\n\n<i>[🔴 Conversation Closed by Staff]</i>`
            );
          }

          return NextResponse.json({ success: true, closedThread: targetThreadId });
        } catch (closeErr: any) {
          await answerCallbackQuery(cq.id, "❌ Error closing chat", true);
        }
      }
    }

    // ─── 2. Handle Slash Commands & Text Messages ───
    if (update.message && update.message.text) {
      const msg = update.message;
      const text: string = msg.text.trim();
      const chatId = msg.chat.id;

      // Automatically store/update active group Chat ID whenever any message is sent in group
      if (chatId) {
        try {
          await supabase.from("app_settings").upsert({
            key: "telegram_chat_id",
            value: String(chatId),
            updated_at: new Date().toISOString(),
          }, { onConflict: "key" });
        } catch (_) {}
      }

      // ── Command: /connect or /start or /id (Bind Group & Verify) ──
      if (text === "/connect" || text === "/start" || text === "/id" || text.startsWith("/start") || text.startsWith("/connect")) {
        await sendTelegramMessage(
          `✅ <b>URBAN TROUT BOT CONNECTED TO THIS GROUP!</b> 🐟⚡\n━━━━━━━━━━━━━━━━━━━━\n<b>Group:</b> ${msg.chat?.title || "Urban Trout Alerts"}\n<b>Chat ID:</b> <code>${chatId}</code>\n\nAll website live chat messages, customer orders, and farm alerts will now be sent directly to this group in real time!`,
          "HTML",
          undefined,
          chatId
        );
        return NextResponse.json({ success: true, connectedChatId: chatId });
      }

      // ── Handle Live Chat Replies (Swipe reply to website chat in Telegram) ──
      if (msg.reply_to_message) {
        const replyTo = msg.reply_to_message;
        const replyText = replyTo.text || "";
        const replyMsgId = replyTo.message_id;

        let targetThreadId: string | null = null;

        // 1. Try extracting thread ID from hashtag #chat_<threadId>
        const tagMatch = replyText.match(/#chat_([a-zA-Z0-9_\-]+)/);
        if (tagMatch) {
          targetThreadId = tagMatch[1];
        }

        // 2. Try looking up in live_chat_threads table by telegram_message_id
        if (!targetThreadId) {
          try {
            const { data: threadRow } = await supabase
              .from("live_chat_threads")
              .select("id")
              .eq("telegram_message_id", replyMsgId)
              .maybeSingle();

            if (threadRow?.id) {
              targetThreadId = threadRow.id;
            }
          } catch (_) {}
        }

        if (targetThreadId) {
          const staffName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Farm Team";
          const nowIso = new Date().toISOString();
          const newMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

          try {
            // Ensure thread exists in live_chat_threads before inserting staff message
            await supabase.from("live_chat_threads").upsert({
              id: targetThreadId,
              status: "active",
              last_message: text,
              last_message_at: nowIso,
              updated_at: nowIso,
            }, { onConflict: "id" });

            await supabase.from("live_chat_messages").insert({
              id: newMsgId,
              thread_id: targetThreadId,
              sender: "staff",
              sender_name: `${staffName} (Urban Trout)`,
              text: text,
              created_at: nowIso,
            });

            await supabase.from("live_chat_threads").update({
              last_message: text,
              last_message_at: nowIso,
              updated_at: nowIso,
            }).eq("id", targetThreadId);

            await sendTelegramMessage(
              `⚡ <b>REPLY DELIVERED LIVE TO VISITOR!</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>Visitor:</b> <code>#chat_${targetThreadId}</code>\n<b>Your Message:</b> <i>"${text}"</i>`,
              "HTML",
              undefined,
              chatId
            );

            return NextResponse.json({ success: true, repliedToThread: targetThreadId });
          } catch (replyErr) {
            console.error("Failed to route Telegram reply to live chat:", replyErr);
          }
        }
      }

      // ── Command: /chats or /active (View Active Live Chats) ──
      if (text === "/chats" || text === "/active") {
        try {
          const { data: activeThreads, error } = await supabase
            .from("live_chat_threads")
            .select("*")
            .eq("status", "active")
            .order("last_message_at", { ascending: false })
            .limit(10);

          if (error || !activeThreads || activeThreads.length === 0) {
            await sendTelegramMessage(
              "💬 <b>ACTIVE LIVE CHATS:</b>\n━━━━━━━━━━━━━━━━━━━━\n<i>No active customer conversations right now.</i>",
              "HTML",
              undefined,
              chatId
            );
            return NextResponse.json({ success: true });
          }

          let report = `💬 <b>ACTIVE WEBSITE LIVE CHATS (${activeThreads.length})</b> ⚡\n━━━━━━━━━━━━━━━━━━━━\n`;
          const buttons: InlineKeyboardButton[][] = [];

          activeThreads.forEach((th: any, idx: number) => {
            const timeAgo = th.last_message_at ? new Date(th.last_message_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Recently";
            report += `<b>${idx + 1}. ${th.customer_name || "Visitor"}</b> (${th.customer_locality || "Srinagar"})\n`;
            if (th.customer_phone) report += `   📞 +91 ${th.customer_phone}\n`;
            report += `   💬 <i>"${(th.last_message || "").substring(0, 60)}"</i> (${timeAgo})\n`;
            report += `   ID: <code>#chat_${th.id}</code>\n\n`;

            const row: InlineKeyboardButton[] = [];
            if (th.customer_phone) {
              row.push({ text: "💬 WhatsApp", url: `https://wa.me/91${th.customer_phone}` });
            }
            row.push({ text: `🔴 End #${idx + 1}`, callback_data: `chat:close:${th.id}` });
            buttons.push(row);
          });

          report += `👉 <i>To reply to any visitor, swipe reply to their message, or type:</i>\n<code>/r &lt;name/id&gt; &lt;your reply&gt;</code>`;

          await sendTelegramMessage(report, "HTML", { inline_keyboard: buttons }, chatId);
          return NextResponse.json({ success: true });
        } catch (err: any) {
          console.error("Error listing chats:", err);
        }
      }

      // ── Command: /r <threadId or customerName> <reply text> ──
      if (text.startsWith("/r ") || text.startsWith("/reply ")) {
        const parts = text.split(" ");
        if (parts.length >= 3) {
          const targetQuery = parts[1].toLowerCase().replace("#chat_", "").trim();
          const replyBody = parts.slice(2).join(" ").trim();

          const { data: matchingThreads } = await supabase
            .from("live_chat_threads")
            .select("*")
            .eq("status", "active")
            .order("last_message_at", { ascending: false });

          const found = matchingThreads?.find((t: any) => 
            t.id.toLowerCase().includes(targetQuery) || 
            (t.customer_name && t.customer_name.toLowerCase().includes(targetQuery)) ||
            (t.customer_phone && t.customer_phone.includes(targetQuery))
          );

          if (found) {
            const staffName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Farm Team";
            const nowIso = new Date().toISOString();
            const newMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

            await supabase.from("live_chat_messages").insert({
              id: newMsgId,
              thread_id: found.id,
              sender: "staff",
              sender_name: `${staffName} (Urban Trout)`,
              text: replyBody,
              created_at: nowIso,
            });

            await supabase.from("live_chat_threads").update({
              last_message: replyBody,
              last_message_at: nowIso,
              updated_at: nowIso,
            }).eq("id", found.id);

            await sendTelegramMessage(
              `⚡ <b>REPLY DELIVERED LIVE TO ${found.customer_name || "VISITOR"}!</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>Sent:</b> <i>"${replyBody}"</i>`,
              "HTML",
              undefined,
              chatId,
              found.telegram_message_id ? Number(found.telegram_message_id) : undefined
            );

            return NextResponse.json({ success: true });
          } else {
            await sendTelegramMessage(
              `❌ No active chat found matching "<b>${targetQuery}</b>".\nType <code>/chats</code> to see open conversations.`,
              "HTML",
              undefined,
              chatId
            );
            return NextResponse.json({ success: true });
          }
        }
      }

      // ── Command: /stock or /inventory (Interactive Inventory Dashboard) ──
      if (text === "/stock" || text === "/inventory") {
        const { data: invItems, error } = await supabase
          .from("inventory")
          .select("*")
          .order("product_name");

        if (error || !invItems || invItems.length === 0) {
          await sendTelegramMessage("📦 No inventory records found in database.", "HTML", undefined, chatId);
          return NextResponse.json({ success: true });
        }

        await sendTelegramMessage(
          `🐟 <b>LIVE FARM INVENTORY DASHBOARD</b> 📊\n━━━━━━━━━━━━━━━━━━━━\nManage stock levels and availability below:`,
          "HTML",
          undefined,
          chatId
        );

        for (const item of invItems) {
          const itemText = formatInventoryItemText(item);
          const kb = getInventoryKeyboard(item.product_id, item.available, item.stock_kg);
          await sendTelegramMessage(itemText, "HTML", kb, chatId);
        }

        return NextResponse.json({ success: true });
      }

      // ── Command: /setstock <whole|gutted> <amount> ──
      if (text.startsWith("/setstock")) {
        const parts = text.split(/\s+/);
        if (parts.length >= 3) {
          const productKey = parts[1].toLowerCase().includes("gut") ? "gutted-trout" : "whole-trout";
          const newStock = parseFloat(parts[2]);

          if (isNaN(newStock) || newStock < 0) {
            await sendTelegramMessage("⚠️ Please provide a valid stock number, e.g. <code>/setstock whole 50</code>", "HTML", undefined, chatId);
            return NextResponse.json({ success: true });
          }

          const { data: updated, error } = await supabase
            .from("inventory")
            .update({ stock_kg: newStock, updated_at: new Date().toISOString() })
            .eq("product_id", productKey)
            .select("*")
            .single();

          if (error || !updated) {
            await sendTelegramMessage(`❌ Failed to update stock: ${error?.message}`, "HTML", undefined, chatId);
          } else {
            const kb = getInventoryKeyboard(updated.product_id, updated.available, updated.stock_kg);
            await sendTelegramMessage(
              `✅ <b>STOCK LEVEL UPDATED!</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>${updated.product_name}</b> stock is now set to <b>${newStock} Kg</b>.`,
              "HTML",
              kb,
              chatId
            );
          }
          return NextResponse.json({ success: true });
        } else {
          await sendTelegramMessage("ℹ️ <b>Usage:</b> <code>/setstock whole 50</code> or <code>/setstock gutted 35</code>", "HTML", undefined, chatId);
          return NextResponse.json({ success: true });
        }
      }

      // ── Command: /addstock <whole|gutted> <amount> ──
      if (text.startsWith("/addstock")) {
        const parts = text.split(/\s+/);
        if (parts.length >= 3) {
          const productKey = parts[1].toLowerCase().includes("gut") ? "gutted-trout" : "whole-trout";
          const addQty = parseFloat(parts[2]);

          if (isNaN(addQty)) {
            await sendTelegramMessage("⚠️ Please provide a valid number, e.g. <code>/addstock whole 20</code>", "HTML", undefined, chatId);
            return NextResponse.json({ success: true });
          }

          const { data: curr } = await supabase.from("inventory").select("*").eq("product_id", productKey).single();
          const newStock = Math.max(0, (Number(curr?.stock_kg) || 0) + addQty);

          const { data: updated, error } = await supabase
            .from("inventory")
            .update({ stock_kg: newStock, updated_at: new Date().toISOString() })
            .eq("product_id", productKey)
            .select("*")
            .single();

          if (error || !updated) {
            await sendTelegramMessage(`❌ Failed to add stock: ${error?.message}`, "HTML", undefined, chatId);
          } else {
            const kb = getInventoryKeyboard(updated.product_id, updated.available, updated.stock_kg);
            await sendTelegramMessage(
              `✅ <b>STOCK RESTOCKED!</b>\n━━━━━━━━━━━━━━━━━━━━\nAdded <b>+${addQty} Kg</b> to <b>${updated.product_name}</b>.\n<b>Total Stock:</b> ${newStock} Kg`,
              "HTML",
              kb,
              chatId
            );
          }
          return NextResponse.json({ success: true });
        } else {
          await sendTelegramMessage("ℹ️ <b>Usage:</b> <code>/addstock whole 20</code> or <code>/addstock gutted 15</code>", "HTML", undefined, chatId);
          return NextResponse.json({ success: true });
        }
      }

      // ── Command: /orders or /pending (List recent active orders) ──
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
          const kb = getOrderKeyboard(ord.order_number, ord.status, ord.customer_phone, ord.customer_name);
          await sendTelegramMessage(ordText, "HTML", kb, chatId);
        }

        return NextResponse.json({ success: true });
      }

      // ── Command: /order <orderNumber> (Lookup single order) ──
      if (text.startsWith("/order ")) {
        const queryNum = text.replace("/order", "").trim();
        const ord = await findOrder(queryNum);

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
        const kb = getOrderKeyboard(ord.order_number, ord.status, ord.customer_phone, ord.customer_name);
        await sendTelegramMessage(ordText, "HTML", kb, chatId);
        return NextResponse.json({ success: true });
      }

      // ── Command: /price <whole|gutted> <amount> (Update live price) ──
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
          const invList = inv?.map(i => `• <b>${i.product_name || i.product_id}:</b> ₹${i.price_per_kg} / Kg (Stock: ${i.stock_kg || 0} Kg)`).join("\n") || "No inventory records.";
          await sendTelegramMessage(`💰 <b>CURRENT LIVE PRICES:</b>\n━━━━━━━━━━━━━━━━━━━━\n${invList}\n\n<i>To change price:</i> <code>/price whole 520</code> or <code>/price gutted 580</code>`, "HTML", undefined, chatId);
          return NextResponse.json({ success: true });
        }
      }

      // ── Command: /stats or /today (Sales stats) ──
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

      // ── Command: /help or /start ──
      if (text.startsWith("/help") || text.startsWith("/start")) {
        await sendTelegramMessage(
          `🐟 <b>URBAN TROUT ADMIN BOT</b> ⚡\n━━━━━━━━━━━━━━━━━━━━\nHere are all available management commands:\n\n📦 <b>INVENTORY MANAGEMENT:</b>\n• <b>/stock</b> or <b>/inventory</b> - Interactive stock dashboard with 1-tap toggles\n• <b>/setstock [whole|gutted] [kg]</b> - Set exact stock quantity (e.g. <code>/setstock whole 50</code>)\n• <b>/addstock [whole|gutted] [kg]</b> - Add quantity to stock (e.g. <code>/addstock gutted 20</code>)\n• <b>/price [whole|gutted] [price]</b> - Update live website price (e.g. <code>/price whole 520</code>)\n\n🛒 <b>ORDER MANAGEMENT:</b>\n• <b>/orders</b> - View recent orders with 1-tap action buttons\n• <b>/order [number]</b> - Lookup a specific order\n• <b>/stats</b> - View today's sales and order stats\n• <b>/help</b> - Show this help menu`,
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
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }
  const webhookUrl = `https://urbantrout.in/api/telegram-webhook`;
  const setWebhookApi = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;

  return NextResponse.json({
    status: "Telegram Webhook Handler Active",
    webhookUrl,
    setWebhookApi,
    instructions: "Open setWebhookApi URL in browser or make a GET request to link Telegram Bot to this webhook endpoint.",
  });
}
