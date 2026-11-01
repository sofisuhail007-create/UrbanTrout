const fs = require("fs");
const path = require("path");
const https = require("https");
const dotenv = require("dotenv");

// Load environment variables
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

// Helper to get current IST date string (YYYY-MM-DD)
function getISTDate(date = new Date()) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  return istDate.toISOString().split("T")[0];
}

// Fetch Supabase Vending Store Sales
function fetchSupabaseSales(dateStr) {
  return new Promise((resolve) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return resolve([]);
    const endpoint = `/rest/v1/vending_sales_log?entry_date=eq.${dateStr}&order=created_at.asc`;
    const req = https.get(SUPABASE_URL + endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(Array.isArray(parsed) ? parsed : []);
        } catch (_) {
          resolve([]);
        }
      });
    });
    req.on("error", () => resolve([]));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

// Fetch Live Aquarium Stock Summary from API
function fetchLiveAquariumStock() {
  return new Promise((resolve) => {
    const req = https.get("https://urbantrout.in/api/aquarium-stock", { timeout: 6000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.liveSummary || { remainingKg: 0, isOutOfStock: false });
        } catch (_) {
          resolve({ remainingKg: 0, isOutOfStock: false });
        }
      });
    });
    req.on("error", () => resolve({ remainingKg: 0, isOutOfStock: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ remainingKg: 0, isOutOfStock: false });
    });
  });
}

// Send single chunk to Telegram
function sendSingleTelegramMessage(htmlText) {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return reject(new Error("Telegram Bot Token or Chat ID missing."));
    }
    const payload = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: htmlText,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });

    const options = {
      hostname: "api.telegram.org",
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) {
            resolve(parsed);
          } else {
            reject(new Error(`Telegram API Error: ${parsed.description || body}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Telegram response: ${e.message}`));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Telegram API request timed out"));
    });
    req.write(payload);
    req.end();
  });
}

// Send message to Telegram with automatic safe chunking (<3900 chars)
async function sendTelegramMessage(htmlText) {
  if (htmlText.length <= 3900) {
    return sendSingleTelegramMessage(htmlText);
  }

  const chunks = [];
  let remaining = htmlText;

  while (remaining.length > 0) {
    if (remaining.length <= 3900) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n", 3900);
    if (splitIdx === -1 || splitIdx < 1500) {
      splitIdx = remaining.lastIndexOf("\n\n", 3900);
    }
    if (splitIdx === -1 || splitIdx < 1500) {
      splitIdx = remaining.lastIndexOf("\n", 3900);
    }
    if (splitIdx === -1) {
      splitIdx = 3900;
    }
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  let lastRes = null;
  for (let i = 0; i < chunks.length; i++) {
    lastRes = await sendSingleTelegramMessage(chunks[i]);
    if (i < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 600));
    }
  }
  return lastRes;
}

/**
 * Generates the Executive Briefing Data for a given date
 */
async function generateExecutiveBriefing(targetDateStr = null) {
  const dateStr = targetDateStr || getISTDate();
  const formattedDate = new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  // 0. Fetch Live Aquarium Stock
  const liveStock = await fetchLiveAquariumStock();
  const liveStockKg = Number(liveStock?.remainingKg || 0);
  const isOutOfStock = Boolean(liveStock?.isOutOfStock || liveStockKg <= 0);

  // 1. Process Online WhatsApp Delivery Orders (customer_orders.json)
  const ordersPath = path.join(__dirname, "customer_orders.json");
  let orders = {};
  if (fs.existsSync(ordersPath)) {
    try {
      orders = JSON.parse(fs.readFileSync(ordersPath, "utf8"));
    } catch (_) {}
  }

  const confirmedPaidOrders = [];
  const pendingOrders = [];
  let onlineRevenue = 0;
  let onlineKg = 0;
  let pendingRevenue = 0;

  for (const [id, o] of Object.entries(orders)) {
    const isUpdatedToday = (o.updatedAt && o.updatedAt.startsWith(dateStr)) || (o.paidAt && o.paidAt.startsWith(dateStr));
    if (!isUpdatedToday) continue;

    // Parse amount
    let rawAmt = 0;
    if (typeof o.amount === "number") rawAmt = o.amount;
    else if (typeof o.amount === "string") {
      const match = o.amount.match(/\d+/);
      if (match) rawAmt = parseInt(match[0], 10);
    }

    // Parse Kg
    let kg = 0;
    if (o.items) {
      const kgMatch = o.items.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (kgMatch) kg = parseFloat(kgMatch[1]);
    }

    const isPaid = (o.status && (o.status.includes("Paid") || o.status.includes("Delivered"))) || !!o.paidAt;

    if (isPaid) {
      confirmedPaidOrders.push({
        id,
        name: o.name || "Customer",
        phone: o.phone || id,
        items: o.items || "Rainbow Trout",
        amount: rawAmt,
        kg: kg || 2,
        area: o.deliveryArea || (o.distanceKm ? `~${o.distanceKm} km` : "Doorstep Delivery"),
        status: o.status
      });
      onlineRevenue += rawAmt;
      onlineKg += (kg || 2);
    } else {
      pendingOrders.push({
        id,
        name: o.name || "Customer",
        phone: o.phone || id,
        items: o.items || "Rainbow Trout",
        amount: rawAmt,
        kg: kg || 2,
        area: o.deliveryArea || (o.distanceKm ? `~${o.distanceKm} km` : "Doorstep Delivery")
      });
      pendingRevenue += rawAmt;
    }
  }

  // 2. Process Supabase Farm Vending Counter Sales
  const storeSales = await fetchSupabaseSales(dateStr);
  let storeKg = 0;
  let storeRevenue = 0;
  let storeCash = 0;
  let storeCashCount = 0;
  let storeOnline = 0;
  let storeOnlineCount = 0;

  const entriesList = [];
  for (let i = 0; i < storeSales.length; i++) {
    const s = storeSales[i];
    const kg = Number(s.weight_kg || 0);
    const paid = Number(s.amount_paid || 0);
    storeKg += kg;
    storeRevenue += paid;
    const isCash = (s.payment_mode || "").toLowerCase().includes("cash");
    if (isCash) {
      storeCash += paid;
      storeCashCount++;
    } else {
      storeOnline += paid;
      storeOnlineCount++;
    }
    const t = s.entry_time || (s.created_at ? new Date(s.created_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "");
    const cust = s.custom_fields?.customer_name ? ` (${s.custom_fields.customer_name})` : "";
    const prod = s.product_type || "Gutted";
    const payIcon = isCash ? "💵 Cash" : "📱 Online";
    entriesList.push(`  ${i + 1}. <i>${t}</i> — <b>${kg.toFixed(2)} Kg</b> ${prod}${cust} • <b>₹${paid.toLocaleString("en-IN")}</b> [${payIcon}]`);
  }

  // 3. Process WhatsApp Inquiries & Locality Footprint (chat_metadata.json)
  const metaPath = path.join(__dirname, "chat_metadata.json");
  let metadata = {};
  if (fs.existsSync(metaPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch (_) {}
  }

  let totalActiveChats = 0;
  const zoneStats = {
    zone1: 0, // 0 - 4km
    zone2: 0, // 4 - 6km
    zone3: 0, // 6 - 12km
    outOfZone: 0, // > 12km
    unspecified: 0
  };
  const localityFrequency = {};

  for (const [jid, m] of Object.entries(metadata)) {
    const t = m.lastUserMsgTime || m.lastBotMsgTime;
    if (!t) continue;
    const dStr = new Date(t).toISOString();
    if (dStr.startsWith(dateStr)) {
      totalActiveChats++;
      const dist = m.distanceKm;
      if (dist !== undefined && dist !== null) {
        if (dist <= 4.0) zoneStats.zone1++;
        else if (dist <= 6.0) zoneStats.zone2++;
        else if (dist <= 12.0) zoneStats.zone3++;
        else zoneStats.outOfZone++;
      } else {
        zoneStats.unspecified++;
      }

      if (m.localityName) {
        localityFrequency[m.localityName] = (localityFrequency[m.localityName] || 0) + 1;
      }
    }
  }

  // Sort top localities
  const topLocalities = Object.entries(localityFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([loc, count]) => `${loc} (${count})`)
    .join(", ") || "General Srinagar Inquiries";

  // Combined Business Totals
  const totalCombinedRevenue = onlineRevenue + storeRevenue;
  const totalCombinedKg = onlineKg + storeKg;

  // Format Telegram HTML Message
  let msg = `🐟 <b>URBAN TROUT AQUACULTURE</b>\n`;
  msg += `📊 <b>DAILY EXECUTIVE BRIEFING — ${formattedDate.toUpperCase()}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `🐠 <b>AQUARIUM LIVE STOCK AVAILABILITY</b>\n`;
  msg += `• <b>Live Biomass in Tanks:</b> <b>${liveStockKg.toFixed(2)} Kg</b> ${isOutOfStock ? "(🔴 OUT OF STOCK)" : "(🟢 Active Stock)"}\n`;
  msg += `• <b>Status:</b> ${isOutOfStock ? "Zero biomass remaining in tanks" : "Ready for live harvest &amp; express dispatch"}\n\n`;

  msg += `💰 <b>REVENUE &amp; SALES SNAPSHOT</b>\n`;
  msg += `• <b>Total Combined Revenue:</b> <b>₹${totalCombinedRevenue.toLocaleString("en-IN")}</b>\n`;
  msg += `• <b>Total Volume Sold / Prepped:</b> <b>${totalCombinedKg.toFixed(2)} Kg</b>\n\n`;

  msg += `🏪 <b>FARM VENDING CENTRE (MALABAGH)</b>\n`;
  msg += `• <b>Counter Sales:</b> ${storeSales.length} Entries (${storeKg.toFixed(2)} Kg)\n`;
  msg += `• <b>Counter Revenue:</b> ₹${storeRevenue.toLocaleString("en-IN")}\n`;
  msg += `  💵 <b>Cash in Drawer:</b> <b>₹${storeCash.toLocaleString("en-IN")}</b> (${storeCashCount} sales)\n`;
  msg += `  📱 <b>UPI / Online Payments:</b> <b>₹${storeOnline.toLocaleString("en-IN")}</b> (${storeOnlineCount} payments)\n\n`;

  if (entriesList.length > 0) {
    msg += `📋 <b>TODAY'S COUNTER ENTRIES LOG:</b>\n`;
    msg += entriesList.join("\n") + "\n\n";
  }

  msg += `🛵 <b>ONLINE WHATSAPP DELIVERIES</b>\n`;
  msg += `• <b>Confirmed &amp; Paid:</b> ${confirmedPaidOrders.length} Orders (${onlineKg.toFixed(1)} Kg) • ₹${onlineRevenue.toLocaleString("en-IN")}\n`;
  if (confirmedPaidOrders.length > 0) {
    confirmedPaidOrders.forEach((o, i) => {
      msg += `  ${i + 1}. <b>${o.name}</b> (${o.area}): ${o.items} — ₹${o.amount} ✅\n`;
    });
  } else {
    msg += `  <i>(No paid delivery orders today)</i>\n`;
  }

  if (pendingOrders.length > 0) {
    msg += `• <b>Pending Payment Links:</b> ${pendingOrders.length} Links • ₹${pendingRevenue.toLocaleString("en-IN")}\n`;
    pendingOrders.forEach((o, i) => {
      msg += `  • ${o.name} (${o.area}): ${o.items} — ₹${o.amount} ⏳\n`;
    });
  }
  msg += `\n`;

  msg += `📱 <b>LEADS &amp; INQUIRIES ENGINE</b>\n`;
  msg += `• <b>Active WhatsApp Conversations:</b> ${totalActiveChats}\n`;
  msg += `• <b>Geographic Distribution:</b>\n`;
  msg += `  - Zone 1 (0–4 km): ${zoneStats.zone1} inquiries\n`;
  msg += `  - Zone 2 (4–6 km): ${zoneStats.zone2} inquiries\n`;
  msg += `  - Zone 3 (6–12 km): ${zoneStats.zone3} inquiries\n`;
  if (zoneStats.outOfZone > 0) {
    msg += `  - Out of Zone (&gt;12 km): ${zoneStats.outOfZone} inquiries (Store Visit)\n`;
  }
  msg += `  - General / Location Pending: ${zoneStats.unspecified}\n`;
  msg += `• <b>Top Localities:</b> ${topLocalities}\n\n`;

  // 4. Process Today's Detailed WhatsApp Incoming Chats & Leads Breakdown
  const todayChatsList = [];
  const chatsHistPath = path.join(__dirname, "chat_histories.json");
  let chats = {};
  if (fs.existsSync(chatsHistPath)) {
    try { chats = JSON.parse(fs.readFileSync(chatsHistPath, "utf8")); } catch (_) {}
  }

  const contactsDbPath = path.join(__dirname, "contacts_database.json");
  let contactsDb = [];
  if (fs.existsSync(contactsDbPath)) {
    try { contactsDb = JSON.parse(fs.readFileSync(contactsDbPath, "utf8")); } catch (_) {}
  }
  const phoneToContact = new Map();
  for (const c of contactsDb) {
    if (c.cleanPhone) phoneToContact.set(c.cleanPhone, c);
  }

  const authDir = path.join(__dirname, "auth_info_baileys");
  function resolveCustomerPhoneForReport(jid) {
    if (!jid) return "";
    if (jid.endsWith("@s.whatsapp.net")) return jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    const cleanId = jid.replace("@lid", "").replace("@s.whatsapp.net", "");
    try {
      const revPath = path.join(authDir, `lid-mapping-${cleanId}_reverse.json`);
      if (fs.existsSync(revPath)) {
        return JSON.parse(fs.readFileSync(revPath, "utf8")).replace(/\D/g, "");
      }
    } catch (_) {}
    return cleanId;
  }

  for (const [jid, m] of Object.entries(metadata)) {
    const t = m.lastUserMsgTime || m.lastBotMsgTime;
    if (!t) continue;
    const dStr = new Date(t).toISOString();
    if (!dStr.startsWith(dateStr)) continue;

    const phone = resolveCustomerPhoneForReport(jid);
    const raw10 = phone.slice(-10);
    const cObj = phoneToContact.get(raw10);

    const history = chats[jid] || [];
    const userMsgs = history.filter(x => x.role === "user");
    const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].text : (m.lastUserText || "Inquiry");

    const matchedOrder = orders[raw10] || Object.values(orders).find(o => o.chatId === jid || (o.phone && o.phone.includes(raw10)));

    let status = "Inquiry Active 💬";
    if (matchedOrder) {
      if (matchedOrder.status && (matchedOrder.status.includes("Paid") || matchedOrder.status.includes("Confirmed") || matchedOrder.status.includes("Delivered"))) {
        status = "Order Paid ✅";
      } else if (matchedOrder.status && matchedOrder.status.includes("Payment Link Sent")) {
        status = "Payment Link Sent ⏳";
      }
    } else if (m.followUpSent) {
      status = "Follow-Up Sent ⏳";
    }

    const timeStr = new Date(t).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });

    let displayName = m.pushName || (matchedOrder && matchedOrder.name) || (cObj && cObj.customerName) || "";
    if (!displayName || /^(?:Customer|Valued Customer|No Name)/i.test(displayName)) {
      if (m.localityName) displayName = `${m.localityName} Lead (${raw10.slice(-4)})`;
      else displayName = `Lead (${raw10.slice(-4)})`;
    }

    const locText = m.localityName ? (m.distanceKm ? `${m.localityName} (~${m.distanceKm} km)` : m.localityName) : (m.distanceKm ? `~${m.distanceKm} km` : "Srinagar");
    const speedText = m.lastResponseTimeMs ? `${(m.lastResponseTimeMs / 1000).toFixed(1)}s` : "1.2s";

    todayChatsList.push({
      timestamp: t,
      timeStr,
      name: displayName,
      phone: raw10.length === 10 ? `+91 ${raw10.slice(0, 5)} ${raw10.slice(5)}` : phone,
      area: locText,
      query: lastUserMsg.replace(/[\r\n",]/g, " ").slice(0, 65).trim(),
      speed: speedText,
      status
    });
  }

  todayChatsList.sort((a, b) => a.timestamp - b.timestamp);

  if (todayChatsList.length > 0) {
    msg += `📋 <b>TODAY'S INCOMING WHATSAPP CHATS &amp; LEADS LOG (${todayChatsList.length}):</b>\n`;
    todayChatsList.forEach((c, idx) => {
      msg += `  ${idx + 1}. <b>${c.name}</b> (<i>${c.timeStr}</i>) • 📍 ${c.area}\n`;
      msg += `     📞 <code>${c.phone}</code> | ⚡ ${c.speed} | <b>${c.status}</b>\n`;
      if (c.query) {
        msg += `     💬 <i>"${c.query}"</i>\n`;
      }
    });
    msg += `\n`;
  }

  msg += `🌙 <i>Evening Service Closed (9:00 PM)</i>\n`;
  msg += `⚡ <i>Next Morning Live Harvest resumes at 9:00 AM</i>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // WhatsApp plain text format (uses *bold* instead of <b>)
  const waText = msg
    .replace(/<b>(.*?)<\/b>/g, "*$1*")
    .replace(/<i>(.*?)<\/i>/g, "_$1_")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<");

  return {
    dateStr,
    telegramHtml: msg,
    whatsAppText: waText,
    metrics: {
      totalCombinedRevenue,
      totalCombinedKg,
      onlineRevenue,
      onlineOrdersCount: confirmedPaidOrders.length,
      storeRevenue,
      storeOrdersCount: storeSales.length,
      totalActiveChats
    }
  };
}

/**
 * Dispatches the briefing to Telegram
 */
async function sendNightlyBriefing(targetDateStr = null) {
  const briefing = await generateExecutiveBriefing(targetDateStr);
  console.log(`[Nightly Briefing] Dispatching for date ${briefing.dateStr} to Telegram...`);
  const res = await sendTelegramMessage(briefing.telegramHtml);
  console.log(`[Nightly Briefing] ✅ Successfully delivered to Telegram:`, res.result?.message_id);
  
  // Record last sent date to avoid double dispatching
  const statePath = path.join(__dirname, "last_nightly_report.json");
  fs.writeFileSync(statePath, JSON.stringify({
    lastSentDate: briefing.dateStr,
    sentAt: new Date().toISOString(),
    telegramMessageId: res.result?.message_id,
    metrics: briefing.metrics
  }, null, 2));

  return briefing;
}

module.exports = {
  getISTDate,
  generateExecutiveBriefing,
  sendNightlyBriefing,
  sendTelegramMessage
};

if (require.main === module) {
  sendNightlyBriefing().then(() => {
    console.log("Nightly Briefing Completed.");
  }).catch((err) => {
    console.error("Nightly Briefing Error:", err);
  });
}
