const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export async function sendTelegramMessage(
  text: string,
  parseMode: "Markdown" | "HTML" = "HTML",
  replyMarkup?: InlineKeyboardMarkup,
  targetChatId?: string | number,
  replyToMessageId?: number
) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload: any = {
      chat_id: targetChatId || CHAT_ID,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return null;
  }
}

export async function editTelegramMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
  parseMode: "Markdown" | "HTML" = "HTML"
) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    });
    return await res.json();
  } catch (error) {
    console.error("Failed to edit Telegram message:", error);
    return null;
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    return await res.json();
  } catch (error) {
    console.error("Failed to answer callback query:", error);
    return null;
  }
}

export function getInventoryKeyboard(productId: string, isAvailable: boolean, stockKg: number): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: isAvailable ? "🔴 Mark Out of Stock" : "🟢 Mark In Stock",
          callback_data: `inv:toggle:${productId}`,
        },
      ],
      [
        {
          text: "➕ Add 10 Kg",
          callback_data: `inv:add:${productId}:10`,
        },
        {
          text: "➕ Add 25 Kg",
          callback_data: `inv:add:${productId}:25`,
        },
      ],
    ],
  };
}

export function formatInventoryItemText(item: {
  product_id: string;
  product_name: string;
  price_per_kg: number;
  stock_kg: number;
  available: boolean;
  updated_at?: string;
}): string {
  const isAvailable = Boolean(item.available);
  const stock = Number(item.stock_kg || 0);
  const isLow = stock < 10;

  const statusBadge = isAvailable
    ? "🟢 <b>IN STOCK (LIVE ON WEBSITE)</b>"
    : "🔴 <b>OUT OF STOCK (DISABLED ON WEBSITE)</b>";

  const lowStockBadge = isLow && isAvailable ? "\n⚠️ <b>Low Stock Warning:</b> Only " + stock + " Kg remaining!" : "";

  return `📦 <b>INVENTORY: ${item.product_name.toUpperCase()}</b> 🐟
━━━━━━━━━━━━━━━━━━━━
<b>Status:</b> ${statusBadge}
<b>Price:</b> <b>₹${item.price_per_kg} / Kg</b>
<b>Stock:</b> <b>${stock} Kg</b>${lowStockBadge}
<b>ID:</b> <code>${item.product_id}</code>

━━━━━━━━━━━━━━━━━━━━
👇 <b>1-Tap Stock & Availability Controls:</b>`;
}

export function getOrderKeyboard(
  orderNumber: string | number,
  currentStatus: string = "pending",
  cleanPhone?: string,
  customerName?: string
): InlineKeyboardMarkup {
  const isPending = currentStatus === "pending";
  const isProcessing = currentStatus === "processing";
  const isOut = currentStatus === "out_for_delivery";
  const isDelivered = currentStatus === "delivered";
  const isCancelled = currentStatus === "cancelled";

  const rows: InlineKeyboardButton[][] = [
    [
      {
        text: isProcessing ? "● ✅ Confirmed" : "✅ Confirm & Harvest",
        callback_data: `ord:processing:${orderNumber}`,
      },
      {
        text: isOut ? "● 🚚 Dispatched" : "🚚 Out for Delivery",
        callback_data: `ord:out_for_delivery:${orderNumber}`,
      },
    ],
    [
      {
        text: isDelivered ? "● 🎉 Delivered" : "🎉 Mark Delivered",
        callback_data: `ord:delivered:${orderNumber}`,
      },
      {
        text: isCancelled ? "● ❌ Cancelled" : "❌ Cancel Order",
        callback_data: `ord:cancelled:${orderNumber}`,
      },
    ],
  ];

  if (cleanPhone) {
    let updateMsg = `Hi ${customerName || "there"}! Urban Trout here regarding your fresh trout order #${orderNumber}.`;
    if (isProcessing) {
      updateMsg = `Hi ${customerName || "there"}! Your Urban Trout order #${orderNumber} is CONFIRMED! Our team in Naseem Bagh is harvesting fresh from tanks now and packing in crushed ice. 🐟`;
    } else if (isOut) {
      updateMsg = `Hi ${customerName || "there"}! Your fresh Rainbow Trout order #${orderNumber} is packed chilled and OUT FOR DELIVERY with our rider! 🚚`;
    } else if (isDelivered) {
      updateMsg = `Hi ${customerName || "there"}! Your fresh Rainbow Trout order #${orderNumber} has been DELIVERED. Thank you for choosing Urban Trout! ✨`;
    } else if (isCancelled) {
      updateMsg = `Hi ${customerName || "there"}! Your order #${orderNumber} has been cancelled. Please reach out if you have any questions.`;
    }

    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(updateMsg)}`;

    rows.push([
      {
        text: "💬 Send Customer WhatsApp Update",
        url: waUrl,
      },
    ]);
  }

  return { inline_keyboard: rows };
}

export function formatOrderTelegramText(order: {
  orderNumber: string | number;
  status?: string;
  total: number;
  paymentMethod?: string;
  utrNumber?: string;
  customerName: string;
  phone: string;
  locality?: string;
  address?: string;
  pincode?: string;
  items?: Array<{ name: string; quantity: number; unit?: string; price: number }>;
}): string {
  const cleanPhone = String(order.phone || "").replace(/\D/g, "").slice(-10);
  const status = order.status || "pending";

  const statusLabel =
    status === "processing"
      ? "✅ <b>PAYMENT VERIFIED (CONFIRMED & HARVESTING)</b>"
      : status === "out_for_delivery"
      ? "🚚 <b>OUT FOR DELIVERY (RIDER DISPATCHED)</b>"
      : status === "delivered"
      ? "🎉 <b>DELIVERED SUCCESSFULLY</b>"
      : status === "cancelled"
      ? "❌ <b>ORDER CANCELLED</b>"
      : "⏳ <b>AWAITING VERIFICATION</b>";

  const itemsText = order.items && order.items.length > 0
    ? order.items.map(i => `• <b>${i.name}</b> x ${i.quantity} ${i.unit || "Kg"} (₹${i.price * i.quantity})`).join("\n")
    : "• Rainbow Trout Order";

  return `🚨 <b>ORDER #${order.orderNumber}</b> 🐟✨
━━━━━━━━━━━━━━━━━━━━
<b>Status:</b> ${statusLabel}
<b>Total:</b> <b>₹${Number(order.total || 0).toLocaleString("en-IN")}</b>
<b>Payment:</b> ${(order.paymentMethod || "UPI").toUpperCase()}${order.utrNumber ? ` (UTR: <code>${order.utrNumber}</code>)` : ""}

👤 <b>Customer Details:</b>
• <b>Name:</b> ${order.customerName}
• <b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>
• <b>Location:</b> ${order.locality || "Srinagar"} ${order.pincode ? `(${order.pincode})` : ""}
${order.address ? `• <b>House/Lane:</b> ${order.address}\n` : ""}
🛒 <b>Items:</b>
${itemsText}

━━━━━━━━━━━━━━━━━━━━
👇 <b>1-Tap Status Buttons:</b>`;
}

export async function notifyNewOrder(order: {
  orderNumber: string;
  customerName: string;
  phone: string;
  locality?: string;
  address?: string;
  pincode?: string;
  items: Array<{ name: string; quantity: number; unit?: string; price: number }>;
  total: number;
  paymentMethod: string;
  utrNumber?: string;
  status?: string;
}) {
  const cleanPhone = String(order.phone || "").replace(/\D/g, "").slice(-10);
  const msg = formatOrderTelegramText(order);
  const keyboard = getOrderKeyboard(order.orderNumber, order.status || "pending", cleanPhone, order.customerName);

  return sendTelegramMessage(msg, "HTML", keyboard);
}

export async function notifyContactInquiry(inquiry: {
  name: string;
  phone: string;
  email?: string;
  subject?: string;
  message: string;
}) {
  const cleanPhone = inquiry.phone.replace(/\D/g, "").slice(-10);
  const waLink = `https://wa.me/91${cleanPhone}?text=Hi%20${encodeURIComponent(inquiry.name)}!%20Thank%20you%20for%20contacting%20Urban%20Trout%20Srinagar.`;

  const msg = `📩 <b>NEW WEBSITE INQUIRY!</b>
━━━━━━━━━━━━━━━━━━━━
<b>Name:</b> ${inquiry.name}
<b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>
${inquiry.email ? `<b>Email:</b> ${inquiry.email}\n` : ""}<b>Topic:</b> ${inquiry.subject || "General Inquiry"}

💬 <b>Message:</b>
<i>"${inquiry.message}"</i>

━━━━━━━━━━━━━━━━━━━━
📞 <a href="tel:+91${cleanPhone}">Call Customer</a> | 💬 <a href="${waLink}">WhatsApp Reply</a>`;

  return sendTelegramMessage(msg, "HTML");
}

export async function notifyAbandonedLead(lead: {
  name?: string;
  phone: string;
  locality?: string;
  pincode?: string;
  cartSummary?: string;
  total?: number;
}) {
  const cleanPhone = lead.phone.replace(/\D/g, "").slice(-10);
  const waLink = `https://wa.me/91${cleanPhone}?text=Hi%20${encodeURIComponent(lead.name || 'there')}!%20We%20saw%20you%20were%20ordering%20fresh%20Rainbow%20Trout%20from%20Urban%20Trout.%20Would%20you%20like%20any%20help%20completing%20your%20order?`;

  const msg = `⚠️ <b>ABANDONED CHECKOUT LEAD!</b>
━━━━━━━━━━━━━━━━━━━━
A customer started checkout but hasn't finalized payment:

• <b>Name:</b> ${lead.name || "Interested Customer"}
• <b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>
• <b>Location:</b> ${lead.locality || "Srinagar"} ${lead.pincode ? `(${lead.pincode})` : ""}
• <b>Cart Total:</b> <b>₹${lead.total || 550}</b>
${lead.cartSummary ? `• <b>Items:</b> ${lead.cartSummary}\n` : ""}
━━━━━━━━━━━━━━━━━━━━
⚡ <i>Follow up now to close this sale:</i>
📞 <a href="tel:+91${cleanPhone}">Call Now</a> | 💬 <a href="${waLink}">WhatsApp Now</a>`;

  return sendTelegramMessage(msg, "HTML");
}

export async function notifyBioAlarm(alarm: {
  tank: string;
  parameter: string;
  value: string | number;
  status: "warning" | "danger" | "supersaturated";
  readingDate?: string;
}) {
  const isDanger = alarm.status === "danger";
  const icon = isDanger ? "🚨🚨 <b>CRITICAL BIO-ALARM!</b>" : "⚠️ <b>WATER PARAMETER WARNING!</b>";

  const msg = `${icon}
━━━━━━━━━━━━━━━━━━━━
<b>Tank:</b> ${alarm.tank}
<b>Parameter:</b> <b>${alarm.parameter}</b>
<b>Current Value:</b> <code>${alarm.value}</code>
<b>Status:</b> ${alarm.status.toUpperCase()}
<b>Time:</b> ${alarm.readingDate || new Date().toLocaleString("en-IN")}

⚠️ <i>Please inspect RAS tanks & oxygenators immediately!</i>`;

  return sendTelegramMessage(msg, "HTML");
}

export async function notifyFarmVisit(visit: {
  visitor_name: string;
  phone: string;
  email?: string | null;
  visit_date: string;
  time_slot: string;
  guest_count: number;
  visit_purpose: string;
  special_requests?: string | null;
  status?: string;
}) {
  const cleanPhone = String(visit.phone || "").replace(/\D/g, "").slice(-10);
  const waReplyMsg = `Hi ${visit.visitor_name}! Urban Trout here regarding your farm visit pre-notification for ${visit.visit_date} (${visit.time_slot}). We look forward to welcoming you to our Naseem Bagh farm! 🐟`;
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waReplyMsg)}`;

  const msg = `🌿 <b>NEW FARM VISIT PRE-NOTIFICATION!</b> 🐟
━━━━━━━━━━━━━━━━━━━━
👤 <b>Visitor:</b> ${visit.visitor_name}
📞 <b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>
${visit.email ? `✉️ <b>Email:</b> ${visit.email}\n` : ""}📅 <b>Date of Visit:</b> <b>${visit.visit_date}</b>
⏰ <b>Time Slot:</b> <b>${visit.time_slot}</b>
👥 <b>Guests / Group Size:</b> <b>${visit.guest_count} Person(s)</b>
🎯 <b>Purpose:</b> ${visit.visit_purpose}
${visit.special_requests ? `📝 <b>Notes:</b> <i>"${visit.special_requests}"</i>\n` : ""}
━━━━━━━━━━━━━━━━━━━━
👇 <b>Quick Actions:</b>`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "💬 Confirm via WhatsApp", url: waUrl },
        { text: "📞 Call Visitor", url: `tel:+91${cleanPhone}` },
      ],
      [
        { text: "📍 Open Admin Dashboard", url: "https://urbantrout.in/admin/dashboard/visits" },
      ],
    ],
  };

  return sendTelegramMessage(msg, "HTML", keyboard);
}

export async function notifyLiveChatMessage(params: {
  threadId: string;
  senderName: string;
  phone?: string;
  email?: string;
  locality?: string;
  text: string;
  parentTelegramMsgId?: number;
}) {
  const cleanPhone = params.phone ? String(params.phone).replace(/\D/g, "").slice(-10) : undefined;
  const isFollowUp = !!params.parentTelegramMsgId;
  
  let msg = isFollowUp
    ? `💬 <b>Follow-up from ${params.senderName || "Visitor"}:</b>\n<i>"${params.text}"</i>\n\n👉 <i>Swipe reply here to answer live</i>\n<code>#chat_${params.threadId}</code>`
    : `💬 <b>NEW LIVE CHAT INQUIRY</b> ⚡\n━━━━━━━━━━━━━━━━━━━━\n👤 <b>Customer:</b> ${params.senderName || "Website Visitor"}\n${cleanPhone ? `📞 <b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>\n` : ""}${params.email ? `✉️ <b>Email:</b> ${params.email}\n` : ""}${params.locality ? `📍 <b>Locality:</b> ${params.locality}\n` : ""}━━━━━━━━━━━━━━━━━━━━\n💬 <b>Message:</b>\n<i>"${params.text}"</i>\n\n👉 <b>To reply:</b> <i>Swipe right and Reply to THIS message in Telegram. Your reply appears live on their screen!</i>\n<code>#chat_${params.threadId}</code>`;

  const buttons: InlineKeyboardButton[][] = [];
  const actionRow: InlineKeyboardButton[] = [];

  if (cleanPhone) {
    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Hi ${params.senderName || "there"}! Urban Trout here replying to your website inquiry: "${params.text}"`)}`;
    actionRow.push({ text: "💬 WhatsApp", url: waUrl });
    actionRow.push({ text: "📞 Call", url: `tel:+91${cleanPhone}` });
  }

  actionRow.push({ text: "🔴 End Chat", callback_data: `chat:close:${params.threadId}` });
  buttons.push(actionRow);

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: buttons,
  };

  return sendTelegramMessage(msg, "HTML", keyboard, undefined, params.parentTelegramMsgId);
}

