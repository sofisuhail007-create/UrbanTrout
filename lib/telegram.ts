const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8830453300:AAFWnXz1eyTdPo5zX2lIAGYVjr7ZMA3QGIM";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-5562317661";

export async function sendTelegramMessage(text: string, parseMode: "Markdown" | "HTML" = "HTML") {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return null;
  }
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
}) {
  const itemsText = order.items
    .map(i => `• <b>${i.name}</b> x ${i.quantity} ${i.unit || 'Kg'} (₹${i.price * i.quantity})`)
    .join("\n");

  const cleanPhone = order.phone.replace(/\D/g, "").slice(-10);
  const waLink = `https://wa.me/91${cleanPhone}?text=Hi%20${encodeURIComponent(order.customerName)}!%20Urban%20Trout%20here.%20We%20received%20your%20order%20%23${order.orderNumber}.`;

  const msg = `🚨 <b>NEW ORDER RECEIVED!</b> 🐟✨
━━━━━━━━━━━━━━━━━━━━
<b>Order ID:</b> <code>#${order.orderNumber}</code>
<b>Total Amount:</b> <b>₹${order.total.toLocaleString("en-IN")}</b>
<b>Payment:</b> ${order.paymentMethod.toUpperCase()}${order.utrNumber ? ` (UTR: <code>${order.utrNumber}</code>)` : ""}

👤 <b>Customer Details:</b>
• <b>Name:</b> ${order.customerName}
• <b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>
• <b>Location:</b> ${order.locality || "Srinagar"} ${order.pincode ? `(${order.pincode})` : ""}
${order.address ? `• <b>House/Lane:</b> ${order.address}\n` : ""}
🛒 <b>Items:</b>
${itemsText}

━━━━━━━━━━━━━━━━━━━━
📞 <a href="tel:+91${cleanPhone}">Call Customer</a> | 💬 <a href="${waLink}">Chat on WhatsApp</a>`;

  return sendTelegramMessage(msg, "HTML");
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

⚠️ <i>Please inspect raceways & oxygenators immediately!</i>`;

  return sendTelegramMessage(msg, "HTML");
}
