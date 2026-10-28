import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes("AAFWnX")
    ? process.env.TELEGRAM_BOT_TOKEN
    : "8830453300:AAGJGa0-MuS-K_wBW6Zgtonn4zrofONjQII";
const FALLBACK_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-5562317661";

let cachedChatId: string | number | null = null;
let lastCacheTime = 0;

export async function getDynamicChatId(): Promise<string | number> {
  const now = Date.now();
  if (cachedChatId && now - lastCacheTime < 10000) {
    return cachedChatId;
  }
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "telegram_chat_id")
      .maybeSingle();
    if (data?.value) {
      cachedChatId = data.value;
      lastCacheTime = now;
      return String(data.value);
    }
  } catch (_) {}
  return FALLBACK_CHAT_ID;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

const TG_DEDUP_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const inMemoryTgDedup = new Map<string, number>();

export async function isTelegramDuplicate(keys: (string | null | undefined)[]): Promise<boolean> {
  const validKeys = Array.from(
    new Set(
      keys
        .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
        .map((k) => k.trim())
    )
  );

  if (validKeys.length === 0) return false;

  const now = Date.now();

  // 1. In-memory fast check (survives within the same node process)
  for (const k of validKeys) {
    const ts = inMemoryTgDedup.get(k);
    if (ts && now - ts < TG_DEDUP_TTL_MS) {
      console.log(`[Telegram Dedup] In-memory duplicate detected for key: ${k}`);
      return true;
    }
  }

  // 2. Persistent Atomic Lock Check via PostgreSQL Primary Key Constraint
  // In serverless environments, multiple concurrent webhook invocations (e.g. payment_link.paid
  // and payment.captured) arrive at the exact same millisecond. Non-atomic SELECT-then-UPSERT
  // suffers from race conditions. Atomic INSERT on primary key (app_settings.key) guarantees
  // that only ONE concurrent invocation succeeds; all other concurrent invocations receive
  // Postgres error 23505 (unique_violation) and are immediately rejected as duplicates.
  try {
    const dbKeys = validKeys.map((k) => `tg_lock_${k}`);

    // Fast check: Did any of these keys exist previously within TTL?
    const { data: existingRows } = await supabase
      .from("app_settings")
      .select("key, updated_at")
      .in("key", dbKeys);

    if (existingRows && existingRows.length > 0) {
      const activeLock = existingRows.find((r) => {
        const rowTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;
        return now - rowTime < TG_DEDUP_TTL_MS;
      });

      if (activeLock) {
        console.log(`[Telegram Dedup] Active DB lock detected: ${activeLock.key}`);
        validKeys.forEach((k) => inMemoryTgDedup.set(k, now));
        return true;
      }
    }

    // Atomic insert of the primary lock key
    const primaryKey = validKeys[0];
    const primaryDbKey = `tg_lock_${primaryKey}`;

    const { error: insertError } = await supabase.from("app_settings").insert({
      key: primaryDbKey,
      value: JSON.stringify({ ts: now, keys: validKeys }),
      description: "Atomic Telegram Dedup Lock (2hr TTL)",
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      // 23505 = unique_violation in PostgreSQL
      if (
        insertError.code === "23505" ||
        insertError.message?.toLowerCase().includes("duplicate key") ||
        insertError.message?.toLowerCase().includes("unique constraint")
      ) {
        console.log(`[Telegram Dedup] Atomic lock collision on ${primaryDbKey} — duplicate caught!`);
        validKeys.forEach((k) => inMemoryTgDedup.set(k, now));
        return true;
      }
      console.warn("[Telegram Dedup] Lock insert notice:", insertError);
    }

    // Also register secondary keys so future queries on any alternate key match immediately
    if (validKeys.length > 1) {
      const secondaryRows = validKeys.slice(1).map((k) => ({
        key: `tg_lock_${k}`,
        value: JSON.stringify({ ts: now, primary: primaryKey }),
        description: "Atomic Telegram Dedup Lock Secondary",
        updated_at: new Date().toISOString(),
      }));
      try {
        await supabase.from("app_settings").upsert(secondaryRows, { onConflict: "key" });
      } catch (_) {}
    }

    validKeys.forEach((k) => inMemoryTgDedup.set(k, now));
    return false;
  } catch (err) {
    console.warn("[Telegram Dedup] Supabase atomic lock error, falling back to memory:", err);
    validKeys.forEach((k) => inMemoryTgDedup.set(k, now));
    return false;
  }
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function sendTelegramMessage(
  text: string,
  parseMode: "Markdown" | "HTML" = "HTML",
  replyMarkup?: InlineKeyboardMarkup,
  targetChatId?: string | number,
  replyToMessageId?: number
) {
  try {
    const resolvedChatId = targetChatId || (await getDynamicChatId());
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const payload: any = {
      chat_id: resolvedChatId,
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
    
    // If Telegram returned error and we had a reply_to_message_id, retry without it
    if (!data.ok && payload.reply_to_message_id) {
      console.warn("Telegram reply_to_message failed, retrying unchained:", data.description);
      delete payload.reply_to_message_id;
      const retryRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await retryRes.json();
    }

    if (!data.ok) {
      console.error("Telegram sendMessage API error:", data);
    }
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
          text: "📊 View in Admin Dashboard",
          url: "https://urbantrout.in/admin",
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
  currentStatus: string = "confirmed",
  cleanPhone?: string,
  customerName?: string,
  googleMapsUrl?: string | null
): InlineKeyboardMarkup | undefined {
  const rows: InlineKeyboardButton[][] = [];

  // Top action row: Google Maps Navigation (if GPS coordinates provided) & WhatsApp Customer
  const contactRow: InlineKeyboardButton[] = [];
  if (googleMapsUrl) {
    contactRow.push({
      text: "🗺️ 1-Tap Google Maps (Navigate)",
      url: googleMapsUrl,
    });
  }

  if (cleanPhone) {
    const safeName = (!customerName || customerName.toLowerCase() === "void") ? "there" : customerName;
    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Hello ${safeName}! Urban Trout here regarding your fresh trout order #${orderNumber}.`)}`;
    contactRow.push({
      text: "💬 WhatsApp Customer",
      url: waUrl,
    });
  }

  if (contactRow.length > 0) {
    rows.push(contactRow);
  }

  // NOTE: Status callback badges ("Delivered", "Out for Delivery", "Harvested", "Cancelled")
  // have been removed per user instruction.

  return rows.length > 0 ? { inline_keyboard: rows } : undefined;
}

export function formatOrderTelegramText(order: {
  orderNumber: string | number;
  status?: string;
  total: number;
  paymentMethod?: string;
  razorpayPaymentId?: string;
  utrNumber?: string;
  customerName: string;
  phone: string;
  locality?: string;
  address?: string;
  pincode?: string;
  items?: Array<{ name: string; quantity: number; unit?: string; price: number }>;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  isScheduled?: boolean;
  scheduledDate?: string;
  scheduledSlot?: string;
}): string {
  const cleanPhone = String(order.phone || "").replace(/\D/g, "").slice(-10);
  const status = order.status || "pending";

  const statusLabel =
    status === "out_of_stock"
      ? "⚠️ <b>OUT OF STOCK (REFUND DUE)</b>"
      : status === "harvested" || status === "processing"
      ? "🐟 <b>HARVESTED & PACKED (LOCKED / NON-REFUNDABLE)</b>"
      : status === "confirmed"
      ? (order.isScheduled ? "📅 <b>PAYMENT CONFIRMED (SCHEDULED HARVEST)</b>" : "✅ <b>PAYMENT VERIFIED (CONFIRMED & READY TO HARVEST)</b>")
      : status === "out_for_delivery"
      ? "🛵 <b>OUT FOR DELIVERY (RIDER DISPATCHED)</b>"
      : status === "delivered"
      ? "🎉 <b>DELIVERED SUCCESSFULLY</b>"
      : status === "cancelled"
      ? "❌ <b>ORDER CANCELLED (REFUNDABLE)</b>"
      : "⏳ <b>AWAITING VERIFICATION</b>";

  const itemsText = order.items && order.items.length > 0
    ? order.items.map(i => `• <b>${i.name}</b> x ${i.quantity} ${i.unit || "Kg"} (₹${i.price * i.quantity})`).join("\n")
    : "• Rainbow Trout Order";

  const paymentText = order.razorpayPaymentId
    ? `RAZORPAY ✅ (ID: <code>${order.razorpayPaymentId}</code>)`
    : (order.paymentMethod || "UPI").toUpperCase() + (order.utrNumber ? ` (UTR: <code>${order.utrNumber}</code>)` : "");

  // Resolve Google Maps 1-tap navigation link from parameters or parse from address if embedded
  let resolvedMapsUrl = order.googleMapsUrl || null;
  if (!resolvedMapsUrl && order.latitude && order.longitude) {
    resolvedMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
  }
  if (!resolvedMapsUrl && order.address) {
    const match = order.address.match(/https:\/\/(?:www\.)?google\.com\/maps[^\s]+|https:\/\/maps\.google\.com\/[^\s]+/);
    if (match) resolvedMapsUrl = match[0];
  }

  const distanceInfo = order.distanceKm !== undefined && order.distanceKm !== null
    ? ` (~${Number(order.distanceKm).toFixed(1)} km from Urban Trout Aquaculture Farm, Malabagh)`
    : "";

  const gpsLine = resolvedMapsUrl
    ? `\n📍 <b>1-Tap Navigation:</b> <a href="${resolvedMapsUrl}">Start Google Maps Navigation ↗</a>${distanceInfo}`
    : "";

  const scheduleHeader = order.isScheduled && order.scheduledSlot
    ? `📅 <b>SCHEDULED PRE-ORDER #${order.orderNumber}</b> 🐟✨\n━━━━━━━━━━━━━━━━━━━━\n🗓️ <b>Delivery Date:</b> <b>${order.scheduledDate || "Next Day"}</b>\n⏰ <b>Preferred Slot:</b> <b>${order.scheduledSlot}</b>\n`
    : `🚨 <b>ORDER #${order.orderNumber}</b> 🐟✨\n━━━━━━━━━━━━━━━━━━━━\n`;

  return `${scheduleHeader}<b>Status:</b> ${statusLabel}
<b>Total:</b> <b>₹${Number(order.total || 0).toLocaleString("en-IN")}</b>
<b>Payment:</b> ${paymentText}

👤 <b>Customer Details:</b>
• <b>Name:</b> ${order.customerName}
• <b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>
• <b>Location:</b> ${order.locality || "Srinagar"} ${order.pincode ? `(${order.pincode})` : ""}
${order.address ? `• <b>House/Lane:</b> ${order.address}\n` : ""}${gpsLine}
🛒 <b>Items:</b>
${itemsText}
━━━━━━━━━━━━━━━━━━━━`;
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
  razorpayPaymentId?: string;
  utrNumber?: string;
  status?: string;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  isScheduled?: boolean;
  scheduledDate?: string;
  scheduledSlot?: string;
}) {
  const cleanPhone = String(order.phone || "").replace(/\D/g, "").slice(-10);

  // Centralized Telegram Deduplication: prevent duplicate new order alerts
  const amtPhoneKey = cleanPhone && order.total ? `amt_ph_${cleanPhone}_${Math.round(order.total)}` : null;
  const isDup = await isTelegramDuplicate([
    order.orderNumber,
    order.razorpayPaymentId,
    amtPhoneKey,
  ]);
  if (isDup) {
    console.log(`[Telegram Dedup] Skipping duplicate new order notification for #${order.orderNumber}`);
    return { ok: true, duplicate: true };
  }
  
  // Resolve Google Maps URL (1-tap driving navigation mode)
  let resolvedMapsUrl = order.googleMapsUrl || null;
  if (!resolvedMapsUrl && order.latitude && order.longitude) {
    resolvedMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
  }
  if (!resolvedMapsUrl && order.address) {
    const match = order.address.match(/https:\/\/(?:www\.)?google\.com\/maps[^\s]+|https:\/\/maps\.google\.com\/[^\s]+/);
    if (match) resolvedMapsUrl = match[0];
  }

  const msg = formatOrderTelegramText(order);
  const keyboard = getOrderKeyboard(order.orderNumber, order.status || "confirmed", cleanPhone, order.customerName, resolvedMapsUrl);

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
<b>Name:</b> ${escapeHtml(inquiry.name)}
<b>Phone:</b> +91 ${cleanPhone}
${inquiry.email ? `<b>Email:</b> ${escapeHtml(inquiry.email)}\n` : ""}<b>Topic:</b> ${escapeHtml(inquiry.subject || "General Inquiry")}

💬 <b>Message:</b>
<i>"${escapeHtml(inquiry.message)}"</i>

━━━━━━━━━━━━━━━━━━━━
📞 Call: +91 ${cleanPhone} | 💬 <a href="${waLink}">WhatsApp Reply</a>`;

  return sendTelegramMessage(msg, "HTML");
}

export async function notifyAbandonedLead(lead: {
  name?: string;
  phone: string;
  locality?: string;
  pincode?: string;
  cartSummary?: string;
  total?: number;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  distanceKm?: number | null;
}) {
  const cleanPhone = lead.phone.replace(/\D/g, "").slice(-10);
  const waLink = `https://wa.me/91${cleanPhone}?text=Hi%20${encodeURIComponent(lead.name || 'there')}!%20We%20saw%20you%20were%20ordering%20fresh%20Rainbow%20Trout%20from%20Urban%20Trout.%20Would%20you%20like%20any%20help%20completing%20your%20order?`;

  let navUrl = lead.googleMapsUrl || null;
  if (!navUrl && lead.latitude && lead.longitude) {
    navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lead.latitude},${lead.longitude}`;
  }

  const distanceInfo = lead.distanceKm !== undefined && lead.distanceKm !== null
    ? ` (~${Number(lead.distanceKm).toFixed(1)} km from Urban Trout Aquaculture Farm, Malabagh)`
    : "";

  const gpsLine = navUrl
    ? `\n📍 <b>1-Tap Navigation:</b> <a href="${navUrl}">Open Google Maps</a>${distanceInfo}`
    : "";

  const msg = `⚠️ <b>ABANDONED CHECKOUT LEAD!</b>
━━━━━━━━━━━━━━━━━━━━
A customer started checkout but hasn't finalized payment:

• <b>Name:</b> ${escapeHtml(lead.name || "Interested Customer")}
• <b>Phone:</b> +91 ${cleanPhone}
• <b>Location:</b> ${escapeHtml(lead.locality || "Srinagar")} ${lead.pincode ? `(${escapeHtml(lead.pincode)})` : ""}${gpsLine}
• <b>Cart Total:</b> <b>₹${lead.total || 550}</b>
${lead.cartSummary ? `• <b>Items:</b> ${escapeHtml(lead.cartSummary)}\n` : ""}
━━━━━━━━━━━━━━━━━━━━
⚡ <i>Follow up now to close this sale:</i>
📞 Call: +91 ${cleanPhone} | 💬 <a href="${waLink}">WhatsApp Now</a>`;

  const keyboardRows: InlineKeyboardButton[][] = [];
  const actionButtons: InlineKeyboardButton[] = [];

  if (navUrl) {
    actionButtons.push({
      text: "🗺️ 1-Tap Google Maps (Navigate)",
      url: navUrl,
    });
  }
  actionButtons.push({
    text: "💬 WhatsApp Lead",
    url: waLink,
  });
  keyboardRows.push(actionButtons);

  return sendTelegramMessage(msg, "HTML", { inline_keyboard: keyboardRows });
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
<b>Tank:</b> ${escapeHtml(alarm.tank)}
<b>Parameter:</b> <b>${escapeHtml(alarm.parameter)}</b>
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
  const waReplyMsg = `Hi ${visit.visitor_name}! Urban Trout here regarding your farm visit pre-notification for ${visit.visit_date} (${visit.time_slot}). We look forward to welcoming you to Urban Trout Aquaculture Farm in Malabagh, Srinagar! 🐟`;
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waReplyMsg)}`;

  const msg = `🌿 <b>NEW FARM VISIT PRE-NOTIFICATION!</b> 🐟
━━━━━━━━━━━━━━━━━━━━
👤 <b>Visitor:</b> ${escapeHtml(visit.visitor_name)}
📞 <b>Phone:</b> +91 ${cleanPhone}
${visit.email ? `✉️ <b>Email:</b> ${escapeHtml(visit.email)}\n` : ""}📅 <b>Date of Visit:</b> <b>${visit.visit_date}</b>
⏰ <b>Time Slot:</b> <b>${visit.time_slot}</b>
👥 <b>Guests / Group Size:</b> <b>${visit.guest_count} Person(s)</b>
🎯 <b>Purpose:</b> ${escapeHtml(visit.visit_purpose)}
${visit.special_requests ? `📝 <b>Notes:</b> <i>"${escapeHtml(visit.special_requests)}"</i>\n` : ""}
━━━━━━━━━━━━━━━━━━━━
👇 <b>Quick Actions:</b>`;

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "💬 Confirm via WhatsApp", url: waUrl },
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
  const safeName = escapeHtml(params.senderName || "Website Visitor");
  const safeEmail = params.email ? escapeHtml(params.email) : undefined;
  const safeLocality = params.locality ? escapeHtml(params.locality) : undefined;
  const safeText = escapeHtml(params.text);
  
  let msg = isFollowUp
    ? `💬 <b>Follow-up from ${safeName}:</b>\n<i>"${safeText}"</i>\n\n👉 <i>Swipe reply here to answer live</i>\n<code>#chat_${params.threadId}</code>`
    : `💬 <b>NEW LIVE CHAT INQUIRY</b> ⚡\n━━━━━━━━━━━━━━━━━━━━\n👤 <b>Customer:</b> ${safeName}\n${cleanPhone ? `📞 <b>Phone:</b> +91 ${cleanPhone}\n` : ""}${safeEmail ? `✉️ <b>Email:</b> ${safeEmail}\n` : ""}${safeLocality ? `📍 <b>Locality:</b> ${safeLocality}\n` : ""}━━━━━━━━━━━━━━━━━━━━\n💬 <b>Message:</b>\n<i>"${safeText}"</i>\n\n👉 <b>To reply:</b> <i>Swipe right and Reply to THIS message in Telegram. Your reply appears live on their screen!</i>\n<code>#chat_${params.threadId}</code>`;

  const buttons: InlineKeyboardButton[][] = [];
  const actionRow: InlineKeyboardButton[] = [];

  if (cleanPhone) {
    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Hi ${params.senderName || "there"}! Urban Trout here replying to your website inquiry: "${params.text}"`)}`;
    actionRow.push({ text: "💬 WhatsApp", url: waUrl });
  }

  actionRow.push({ text: "🔴 End Chat", callback_data: `chat:close:${params.threadId}` });
  buttons.push(actionRow);

  const keyboard: InlineKeyboardMarkup = {
    inline_keyboard: buttons,
  };

  return sendTelegramMessage(msg, "HTML", keyboard, undefined, params.parentTelegramMsgId);
}

export const BANK_NAME_MAP: Record<string, string> = {
  JAKA: "J&K Bank (Jammu & Kashmir Bank)",
  HDFC: "HDFC Bank",
  SBIN: "State Bank of India (SBI)",
  ICIC: "ICICI Bank",
  UTIB: "Axis Bank",
  AXIS: "Axis Bank",
  PUNB: "Punjab National Bank (PNB)",
  KKBK: "Kotak Mahindra Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  YESB: "Yes Bank",
  IDFB: "IDFC First Bank",
  INDB: "IndusInd Bank",
  CBIN: "Central Bank of India",
  IOBA: "Indian Overseas Bank",
  BKID: "Bank of India",
  MAHB: "Bank of Maharashtra",
  PSIB: "Punjab & Sind Bank",
  UCOB: "UCO Bank",
  FDRL: "Federal Bank",
  KVBL: "Karur Vysya Bank",
  JSFB: "Jana Small Finance Bank",
  ESFB: "Equitas Small Finance Bank",
};

export function formatPaymentSource(params: {
  method?: string | null;
  vpa?: string | null;
  bank?: string | null;
  wallet?: string | null;
  card?: {
    last4?: string;
    network?: string;
    type?: string;
    issuer?: string;
  } | null;
  fee?: number | null;
  tax?: number | null;
  amount?: number;
}): { sourceText: string; feeText: string; netText: string } {
  const methodRaw = (params.method || "UPI").toLowerCase();
  let sourceText = "";

  if (methodRaw.includes("upi")) {
    sourceText = params.vpa
      ? `🔵 <b>UPI</b> (<code>${escapeHtml(params.vpa)}</code>)`
      : "🔵 <b>UPI Direct</b>";
  } else if (methodRaw.includes("netbanking") || methodRaw === "nb") {
    const bankCode = (params.bank || "").toUpperCase();
    const bankName = BANK_NAME_MAP[bankCode] || bankCode || "Net Banking";
    sourceText = `🟢 <b>Net Banking</b> — ${escapeHtml(bankName)}${bankCode ? ` (<code>${escapeHtml(bankCode)}</code>)` : ""}`;
  } else if (methodRaw.includes("card")) {
    const network = (params.card?.network || "").toUpperCase();
    const type = (params.card?.type || "Card").toUpperCase();
    const last4 = params.card?.last4 ? ` ending in •••• ${params.card.last4}` : "";
    const issuer = params.card?.issuer ? ` (${params.card.issuer})` : "";
    sourceText = `💳 <b>${escapeHtml(network || "Bank")} ${escapeHtml(type)}</b>${last4}${issuer}`;
  } else if (methodRaw.includes("wallet")) {
    const walletName = (params.wallet || "Wallet").toUpperCase();
    sourceText = `📱 <b>Wallet</b> — ${escapeHtml(walletName)}`;
  } else {
    sourceText = `💳 <b>${escapeHtml(methodRaw.toUpperCase())}</b>`;
  }

  // Calculate Fee & Tax Breakdown
  // Razorpay returns fee and tax in paise (e.g. 2552 paise = Rs 25.52, 460 paise = Rs 4.60)
  let feeRupees = 0;
  let taxRupees = 0;

  if (typeof params.fee === "number" && params.fee > 0) {
    feeRupees = params.fee > 100 ? params.fee / 100 : params.fee;
  }
  if (typeof params.tax === "number" && params.tax > 0) {
    taxRupees = params.tax > 100 ? params.tax / 100 : params.tax;
  }

  const totalFeeDeducted = feeRupees + taxRupees;
  const grossAmount = params.amount || 0;
  const netSettled = grossAmount > totalFeeDeducted ? grossAmount - totalFeeDeducted : grossAmount;

  let feeText = "";
  let netText = "";

  if (totalFeeDeducted > 0) {
    feeText = `⚠️ <b>-₹${totalFeeDeducted.toFixed(2)}</b> (₹${feeRupees.toFixed(2)} fee + ₹${taxRupees.toFixed(2)} GST)`;
    netText = `<b>₹${netSettled.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>`;
  } else {
    feeText = `✨ <b>₹0.00 (Zero Fee / 100% Payout)</b>`;
    netText = `<b>₹${grossAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>`;
  }

  return { sourceText, feeText, netText };
}

export async function notifyRazorpayPayment(params: {
  paymentId: string;
  orderId?: string | null;
  amount: number;
  status: string;
  method?: string;
  vpa?: string | null;
  bank?: string | null;
  wallet?: string | null;
  card?: {
    last4?: string;
    network?: string;
    type?: string;
    issuer?: string;
  } | null;
  fee?: number | null;
  tax?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  description?: string | null;
  channel?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
}) {
  const cleanPhone = params.customerPhone ? String(params.customerPhone).replace(/\D/g, "").slice(-10) : "";
  const name = params.customerName || "Customer";
  const channel = params.channel || (params.description?.includes("POS") ? "Counter POS QR" : "Website Checkout");

  // Centralized Atomic Telegram Deduplication: prevent duplicate payment alerts across webhooks/lambdas
  const amtPhoneKey = cleanPhone && params.amount ? `amt_ph_${cleanPhone}_${Math.round(params.amount)}` : null;
  const isDup = await isTelegramDuplicate([
    params.paymentId,
    params.orderId,
    amtPhoneKey,
  ]);
  if (isDup) {
    console.log(`[Telegram Dedup] Skipping duplicate payment notification for ${params.paymentId} / ${params.orderId}`);
    return { ok: true, duplicate: true };
  }

  const { sourceText, feeText, netText } = formatPaymentSource({
    method: params.method,
    vpa: params.vpa,
    bank: params.bank,
    wallet: params.wallet,
    card: params.card,
    fee: params.fee,
    tax: params.tax,
    amount: params.amount,
  });

  let resolvedMapsUrl = params.googleMapsUrl || null;
  if (!resolvedMapsUrl && params.latitude && params.longitude) {
    resolvedMapsUrl = `https://maps.google.com/?q=${params.latitude},${params.longitude}`;
  }

  const distanceInfo = params.distanceKm !== undefined && params.distanceKm !== null
    ? ` (~${Number(params.distanceKm).toFixed(1)} km from Malabagh Farm)`
    : "";

  const istDateTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const orderRef = params.orderId || params.paymentId;
  const isWhatsAppAgent =
    channel.toLowerCase().includes("whatsapp") ||
    (params.orderId && params.orderId.startsWith("UT-WA-")) ||
    (params.description && params.description.toLowerCase().includes("whatsapp"));

  let msg: string;
  if (isWhatsAppAgent) {
    msg = `🐟 <b>NEW CONFIRMED ORDER (WHATSAPP SALES AGENT)</b> ⚡
━━━━━━━━━━━━━━━━━━━━
📋 <b>Order Ref:</b> <code>#${orderRef}</code>
👤 <b>Customer Name:</b> <b>${escapeHtml(name)}</b>
📞 <b>Contact Number:</b> ${cleanPhone ? `<a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a> | <a href="https://wa.me/91${cleanPhone}">💬 WhatsApp</a>` : "N/A"}
🗓️ <b>Date & Time:</b> <b>${istDateTime} IST</b>
🛒 <b>Items / Summary:</b> <b>${escapeHtml(params.description || "Fresh Rainbow Trout Harvest")}</b>
💰 <b>Amount Paid:</b> <b>₹${Number(params.amount || 0).toLocaleString("en-IN")}</b> (PAID ✓)
💳 <b>Payment Source:</b> ${sourceText}
💸 <b>Gateway Fee:</b> ${feeText}
💵 <b>Net Settled:</b> ${netText}
💳 <b>Payment ID:</b> <code>${params.paymentId}</code>
🤖 <b>Channel:</b> WhatsApp AI Sales Agent
📍 <b>Delivery Location:</b>
${resolvedMapsUrl ? `🗺️ <a href="${resolvedMapsUrl}"><b>Click here for 1-Tap Google Maps Navigation</b> ↗</a>${distanceInfo}` : `<i>Customer confirmed in-zone via WhatsApp (no GPS pin shared)</i>`}
━━━━━━━━━━━━━━━━━━━━
⚡ <i>Payment auto-captured & verified. Ready for live harvest!</i>`;
  } else {
    const gpsLine = resolvedMapsUrl
      ? `\n📍 <b>GPS Pinpoint:</b> <a href="${resolvedMapsUrl}">Open in Google Maps</a>${distanceInfo}`
      : "";

    msg = `💰 <b>RAZORPAY PAYMENT RECEIVED!</b> ⚡
━━━━━━━━━━━━━━━━━━━━
<b>Amount Paid:</b> <b>₹${Number(params.amount || 0).toLocaleString("en-IN")}</b> (PAID ✓)
<b>Customer:</b> ${escapeHtml(name)}
${cleanPhone ? `<b>Phone:</b> <a href="tel:+91${cleanPhone}">+91 ${cleanPhone}</a>\n` : ""}${params.customerEmail ? `<b>Email:</b> ${escapeHtml(params.customerEmail)}\n` : ""}💳 <b>Payment Source:</b> ${sourceText}
💸 <b>Gateway Fee:</b> ${feeText}
💵 <b>Net Settled:</b> ${netText}
<b>Txn Ref:</b> <code>${params.paymentId}</code>
${params.orderId ? `<b>Order ID:</b> <code>${params.orderId}</code>\n` : ""}${params.description ? `<b>Desc:</b> ${escapeHtml(params.description)}\n` : ""}<b>Channel:</b> <b>${escapeHtml(channel)}</b>${gpsLine}
<b>Time:</b> ${istDateTime} IST
━━━━━━━━━━━━━━━━━━━━
⚡ <i>Payment auto-captured & verified</i>`;
  }

  const buttons: InlineKeyboardButton[][] = [];
  if (resolvedMapsUrl) {
    buttons.push([
      {
        text: "🗺️ Navigate on Google Maps",
        url: resolvedMapsUrl,
      },
    ]);
  }

  const keyboard: InlineKeyboardMarkup | undefined = buttons.length > 0 ? { inline_keyboard: buttons } : undefined;
  return sendTelegramMessage(msg, "HTML", keyboard);
}

export async function notifyPosInvoice(params: {
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  totalWeight: number;
  grandTotal: number;
  paymentMethod: string;
  paymentId?: string | null;
  paymentStatus: string;
  itemsSummary: string;
  publicUrl?: string;
}) {
  const cleanPhone = params.customerPhone ? String(params.customerPhone).replace(/\D/g, "").slice(-10) : "";
  const isPaid = params.paymentStatus === "PAID";
  const statusBadge = isPaid ? "✅ PAID & VERIFIED" : "⏳ PAYMENT DUE";

  const msg = `🧾 <b>COUNTER POS INVOICE #${params.invoiceNumber}</b> 🐟
━━━━━━━━━━━━━━━━━━━━
<b>Status:</b> <b>${statusBadge}</b>
<b>Total:</b> <b>₹${Number(params.grandTotal || 0).toLocaleString("en-IN")}</b> (${params.totalWeight.toFixed(2)} Kg)
<b>Customer:</b> ${escapeHtml(params.customerName || "Walk-in Customer")}
${cleanPhone ? `<b>Phone:</b> +91 ${cleanPhone}\n` : ""}<b>Channel:</b> ${params.paymentMethod.toUpperCase()}${params.paymentId ? ` (Ref: <code>${params.paymentId}</code>)` : ""}
<b>Items:</b> ${escapeHtml(params.itemsSummary)}
━━━━━━━━━━━━━━━━━━━━`;

  const buttons: InlineKeyboardButton[][] = [];
  const actionRow: InlineKeyboardButton[] = [];

  if (params.publicUrl) {
    actionRow.push({ text: "📄 View Invoice", url: params.publicUrl });
  }
  if (cleanPhone) {
    const waMsg = `Hi ${params.customerName}! Urban Trout invoice #${params.invoiceNumber} (Rs. ${params.grandTotal}): ${params.publicUrl || "https://urbantrout.in"}`;
    actionRow.push({ text: "💬 WhatsApp", url: `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(waMsg)}` });
  }
  if (actionRow.length > 0) {
    buttons.push(actionRow);
  }

  return sendTelegramMessage(msg, "HTML", buttons.length > 0 ? { inline_keyboard: buttons } : undefined);
}

export async function notifyLowAquariumStock(params: {
  remainingKg: number;
  thresholdKg: number;
  totalProcuredKg: number;
  allTimeSoldKg: number;
  totalMortalityKg?: number;
  triggerSource?: string;
  isTest?: boolean;
}) {
  const isCritical = params.remainingKg <= 5;
  const statusEmoji = params.isTest ? "🧪" : isCritical ? "🚨" : "⚠️";
  const statusHeader = params.isTest
    ? "TEST ALERT — LOW AQUARIUM STOCK"
    : isCritical
    ? "CRITICAL EMERGENCY — AQUARIUM ALMOST EMPTY!"
    : "LOW AQUARIUM LIVE STOCK ALERT!";

  const statusLabel = params.isTest
    ? "Test Notification from Settings"
    : isCritical
    ? "🔴 CRITICAL: IMMEDIATE RESTOCK REQUIRED"
    : "🟡 ATTENTION: BIOMASS BELOW THRESHOLD";

  const msg = `${statusEmoji} <b>${statusHeader}</b> 🐟
━━━━━━━━━━━━━━━━━━━━
<b>Remaining in Aquarium:</b> <b>${params.remainingKg.toFixed(2)} Kg</b>
<b>Alert Threshold:</b> <b>${params.thresholdKg} Kg</b>
<b>Alert Status:</b> <b>${statusLabel}</b>
━━━━━━━━━━━━━━━━━━━━
<b>Total Procured:</b> ${params.totalProcuredKg.toFixed(2)} Kg
<b>Dispatched / Sold:</b> ${params.allTimeSoldKg.toFixed(2)} Kg
${params.totalMortalityKg !== undefined ? `<b>Mortality Loss:</b> ${params.totalMortalityKg.toFixed(2)} Kg\n` : ""}<b>Triggered By:</b> ${escapeHtml(params.triggerSource || "Counter Dispatch")}
<b>Time:</b> ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
━━━━━━━━━━━━━━━━━━━━
💡 <i>Action Recommended: Arrange transfer of fresh rainbow trout batches to maintain counter sales & online order fulfillment.</i>`;

  const buttons: InlineKeyboardButton[][] = [
    [
      { text: "📊 Vending Center Log", url: "https://urbantrout.in/admin/dashboard/vending-log" },
      { text: "📦 Inventory & Stock", url: "https://urbantrout.in/admin/dashboard/inventory" },
    ],
  ];

  return sendTelegramMessage(msg, "HTML", { inline_keyboard: buttons });
}


