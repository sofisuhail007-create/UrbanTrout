import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  answerCallbackQuery,
  escapeHtml,
  sendTelegramMessage,
} from "@/lib/telegram";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Compiles the complete Daily Status & Operations Report (Live Aquarium Stock, Today's Sales Entries, Cash Collected, Online Orders)
 */
async function generateStatusReport(): Promise<string> {
  const istDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date());

  const timeStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());

  // 1. Fetch live aquarium stock availability
  let liveStockRemainingKg = 0;
  let isOutOfStock = false;
  try {
    const { getLiveAquariumStock } = await import("@/lib/aquariumStock");
    const stockSummary = await getLiveAquariumStock(supabase);
    liveStockRemainingKg = Number(stockSummary.remainingKg || 0);
    isOutOfStock = Boolean(stockSummary.isOutOfStock || liveStockRemainingKg <= 0);
  } catch (err) {
    console.warn("Could not calculate live aquarium stock directly, trying API fallback:", err);
    try {
      const res = await fetch("https://urbantrout.in/api/aquarium-stock", { next: { revalidate: 0 } });
      const json = await res.json();
      if (json?.liveSummary) {
        liveStockRemainingKg = Number(json.liveSummary.remainingKg || 0);
        isOutOfStock = Boolean(json.liveSummary.isOutOfStock || liveStockRemainingKg <= 0);
      }
    } catch (_) {}
  }

  // 2. Fetch today's farm vending sales log entries
  const { data: salesEntries } = await supabase
    .from("vending_sales_log")
    .select("*")
    .eq("entry_date", istDateStr)
    .order("created_at", { ascending: true });

  let storeKg = 0;
  let storeRevenue = 0;
  let storeCash = 0;
  let storeCashCount = 0;
  let storeOnline = 0;
  let storeOnlineCount = 0;

  const entriesList = (salesEntries || []).map((e: any, i: number) => {
    const w = Number(e.weight_kg || 0);
    const p = Number(e.amount_paid || 0);
    storeKg += w;
    storeRevenue += p;
    const isCash = (e.payment_mode || "").toLowerCase().includes("cash");
    if (isCash) {
      storeCash += p;
      storeCashCount++;
    } else {
      storeOnline += p;
      storeOnlineCount++;
    }

    const t = e.entry_time || (e.created_at ? new Date(e.created_at).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) : "");
    const payIcon = isCash ? "💵 Cash" : "📱 Online";
    const cust = e.custom_fields?.customer_name ? ` (${escapeHtml(String(e.custom_fields.customer_name))})` : "";
    const prod = e.product_type || "Gutted";
    return `  ${i + 1}. <i>${t}</i> — <b>${w.toFixed(2)} Kg</b> ${escapeHtml(prod)}${cust} • <b>₹${p.toLocaleString("en-IN")}</b> [${payIcon}]`;
  });

  // 3. Fetch today's website / delivery orders
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data: ordersToday } = await supabase
    .from("orders")
    .select("*")
    .gte("created_at", startOfDay.toISOString())
    .order("created_at", { ascending: false });

  const paidOrders = (ordersToday || []).filter((o: any) =>
    ["delivered", "processing", "confirmed", "out_for_delivery"].includes(o.status)
  );
  const pendingOrders = (ordersToday || []).filter((o: any) => o.status === "pending");
  const onlineOrderRevenue = paidOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
  const onlineOrderKg = paidOrders.reduce((sum: number, o: any) => {
    const it = o.items || [];
    return sum + (Array.isArray(it) ? it.reduce((s: number, item: any) => s + (Number(item.quantity) || 1), 0) : 1);
  }, 0);

  const totalCombinedRevenue = storeRevenue + onlineOrderRevenue;
  const totalCombinedKg = storeKg + onlineOrderKg;

  // 4. Construct Telegram HTML message
  let msg = `🐟 <b>URBAN TROUT AQUACULTURE</b>\n`;
  msg += `📊 <b>LIVE OPERATIONS &amp; BUSINESS STATUS</b>\n`;
  msg += `📅 <b>Date:</b> ${formattedDate} | <i>${timeStr} IST</i>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `🐠 <b>AQUARIUM LIVE STOCK AVAILABILITY</b>\n`;
  msg += `• <b>Live Biomass in Tanks:</b> <b>${liveStockRemainingKg.toFixed(2)} Kg</b> ${isOutOfStock ? "(🔴 OUT OF STOCK)" : "(🟢 Active Stock)"}\n`;
  msg += `• <b>Status:</b> ${isOutOfStock ? "Zero biomass remaining in tanks" : "Ready for live harvest &amp; express dispatch"}\n\n`;

  msg += `💰 <b>TODAY'S REVENUE &amp; SALES SNAPSHOT</b>\n`;
  msg += `• <b>Total Combined Revenue:</b> <b>₹${totalCombinedRevenue.toLocaleString("en-IN")}</b>\n`;
  msg += `• <b>Total Volume Sold / Prepped:</b> <b>${totalCombinedKg.toFixed(2)} Kg</b>\n\n`;

  msg += `🏪 <b>FARM VENDING CENTRE (MALABAGH)</b>\n`;
  msg += `• <b>Counter Sales:</b> ${salesEntries?.length || 0} Entries (${storeKg.toFixed(2)} Kg)\n`;
  msg += `• <b>Counter Revenue:</b> ₹${storeRevenue.toLocaleString("en-IN")}\n`;
  msg += `  💵 <b>Cash in Drawer:</b> <b>₹${storeCash.toLocaleString("en-IN")}</b> (${storeCashCount} sales)\n`;
  msg += `  📱 <b>UPI / Online Payments:</b> <b>₹${storeOnline.toLocaleString("en-IN")}</b> (${storeOnlineCount} payments)\n\n`;

  if (entriesList.length > 0) {
    msg += `📋 <b>TODAY'S COUNTER ENTRIES LOG:</b>\n`;
    msg += entriesList.join("\n") + "\n\n";
  } else {
    msg += `📋 <i>(No counter sales logged yet today)</i>\n\n`;
  }

  msg += `🛵 <b>ONLINE DELIVERIES &amp; ORDERS</b>\n`;
  msg += `• <b>Confirmed &amp; Paid:</b> ${paidOrders.length} Orders (${onlineOrderKg.toFixed(1)} Kg) • ₹${onlineOrderRevenue.toLocaleString("en-IN")}\n`;
  if (paidOrders.length > 0) {
    paidOrders.forEach((o: any, idx: number) => {
      const custName = o.customer_name || "Customer";
      const locality = o.customer_locality ? ` (${o.customer_locality})` : "";
      msg += `  ${idx + 1}. <b>${escapeHtml(custName)}</b>${escapeHtml(locality)} — ₹${Number(o.total || 0).toLocaleString("en-IN")} [${o.status}]\n`;
    });
  }
  if (pendingOrders.length > 0) {
    msg += `• <b>Pending Payment Links:</b> ${pendingOrders.length} Orders\n`;
  }
  msg += `\n`;

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚡ <i>Type <code>/status</code> anytime in this group to refresh live report.</i>`;

  return msg;
}

export async function POST(request: Request) {
  // ─── Security: Verify request is genuinely from Telegram ───
  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && incomingSecret !== expectedSecret) {
    console.error("[telegram-webhook] Unauthorized access attempt: invalid secret token");
    return NextResponse.json({ error: "Unauthorized: Invalid webhook secret" }, { status: 401 });
  }

  try {
    const update = await request.json();

    // ─── 1. Reject ALL callback queries (No editing products, stock, or orders via Telegram) ───
    if (update.callback_query) {
      await answerCallbackQuery(
        update.callback_query.id,
        "🔒 Management via Telegram is disabled. Please use the admin dashboard at urbantrout.in",
        true
      );
      return NextResponse.json({ ok: true, note: "Callback query rejected per security policy" });
    }

    // ─── 2. Handle Text Messages & Slash Commands ───
    if (update.message && (update.message.text || update.message.caption)) {
      const msg = update.message;
      const rawText: string = (msg.text || msg.caption || "").trim();
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

      const lowerText = rawText.toLowerCase();

      // Normalize command (strip bot mention like /status@UrbanTroutBot)
      const command = lowerText.split("@")[0].split(/\s+/)[0];

      // ── Main Allowed Command: /status (or /today, /report, /briefing) ──
      if (command === "/status" || command === "/today" || command === "/report" || command === "/briefing") {
        try {
          const reportHtml = await generateStatusReport();
          await sendTelegramMessage(reportHtml, "HTML", undefined, chatId);
        } catch (err: any) {
          console.error("Error generating status report for Telegram:", err);
          await sendTelegramMessage(
            `⚠️ <b>Failed to generate status report:</b> ${escapeHtml(err?.message || "Unknown error")}`,
            "HTML",
            undefined,
            chatId
          );
        }
        return NextResponse.json({ success: true, command: "/status" });
      }

      // ── Information & Connection Commands: /start, /help, /connect, /id ──
      if (command === "/start" || command === "/help" || command === "/connect" || command === "/id") {
        await sendTelegramMessage(
          `🐟 <b>URBAN TROUT STATUS BOT</b> ⚡\n━━━━━━━━━━━━━━━━━━━━\nThis bot provides real-time operational briefings directly in this group.\n\n🔒 <b>Notice:</b> All management functions (editing products, updating stock, changing prices, and toggling store settings) via Telegram have been disabled for system security.\n\n📊 <b>Available Command:</b>\n• <b>/status</b> — Sends live aquarium stock, today's entries, cash collected, online payments, and delivery orders.`,
          "HTML",
          undefined,
          chatId
        );
        return NextResponse.json({ success: true, command: "/help" });
      }

      // ── Explicit Block Notice for Disabled Management Commands ──
      if (
        command.startsWith("/stock") ||
        command.startsWith("/inventory") ||
        command.startsWith("/setstock") ||
        command.startsWith("/addstock") ||
        command.startsWith("/price") ||
        command.startsWith("/friday") ||
        command.startsWith("/order") ||
        command.startsWith("/pending") ||
        command.startsWith("/chats") ||
        command.startsWith("/r") ||
        command.startsWith("/reply")
      ) {
        await sendTelegramMessage(
          `🔒 <b>Management via Telegram is Disabled</b>\n━━━━━━━━━━━━━━━━━━━━\nProduct editing, stock modifications, pricing, and order changes cannot be made via Telegram.\n\nPlease manage inventory and store settings securely via the admin dashboard at <a href="https://urbantrout.in">urbantrout.in</a>.\n\n👉 <i>Type <code>/status</code> to get today's live business report.</i>`,
          "HTML",
          undefined,
          chatId
        );
        return NextResponse.json({ success: true, blocked: command });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false, error: error?.message || "Internal server error" }, { status: 500 });
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
    status: "Telegram Status Bot Active (Management Actions Locked)",
    webhookUrl,
    setWebhookApi,
    instructions: "Send /status in your Telegram group to receive real-time operations, aquarium stock, and sales briefing.",
  });
}
