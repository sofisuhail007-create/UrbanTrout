import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_TOKEN.includes("AAFWnX")
    ? process.env.TELEGRAM_BOT_TOKEN
    : "8830453300:AAGJGa0-MuS-K_wBW6Zgtonn4zrofONjQII";

async function getTelegramChatId(): Promise<string> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "telegram_chat_id")
      .maybeSingle();
    if (data?.value) return String(data.value);
  } catch (_) {}
  return process.env.TELEGRAM_CHAT_ID || "-5562317661";
}

async function sendTelegramDocument(chatId: string, filename: string, content: string, caption: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  formData.append("parse_mode", "HTML");
  const blob = new Blob([content], { type: "application/json" });
  formData.append("document", blob, filename);
  const res = await fetch(url, { method: "POST", body: formData });
  return res.json();
}

async function sendTelegramText(chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  return res.json();
}

/**
 * POST /api/vending-log/backup
 * Triggered by Vercel cron at 00:30 IST (18:30 UTC) daily.
 * Can also be manually triggered with x-admin-token header.
 * Fetches all Urban Trout data and sends to Telegram as a downloadable JSON file.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = req.headers.get("authorization") || req.headers.get("x-admin-token");
  const isAuthorized =
    (authHeader && cronSecret && (authHeader === `Bearer ${cronSecret}` || authHeader === cronSecret)) ||
    req.headers.get("x-vercel-cron") === "1";

  if (!isAuthorized) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const nowIST = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());

  const dateLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  try {
    const chatId = await getTelegramChatId();

    const [
      { data: vendingEntries },
      { data: stockEntries },
      { data: mortalityEntries },
      { data: customerBalances },
      { data: fallbackRow },
    ] = await Promise.all([
      supabase.from("vending_sales_log").select("*").order("entry_date", { ascending: false }),
      supabase.from("aquarium_stock").select("*").order("stock_date", { ascending: false }),
      supabase.from("aquarium_mortality").select("*").order("mortality_date", { ascending: false }),
      supabase.from("customer_balances").select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "vending_log_data").maybeSingle(),
    ]);

    const fallbackEntries = fallbackRow?.value ? JSON.parse(fallbackRow.value) : [];
    const allVendingMap = new Map<string, any>();
    for (const e of fallbackEntries) { if (e?.id) allVendingMap.set(e.id, e); }
    for (const e of (vendingEntries || [])) { if (e?.id) allVendingMap.set(e.id, e); }
    const allVending = Array.from(allVendingMap.values());

    const backupPayload = {
      backup_metadata: {
        generated_at_ist: nowIST,
        date: dateLabel,
        source: "Urban Trout Admin — Automated Nightly Backup",
        version: "2.0",
        restore_instructions: "To restore: Import the vending_sales_log array back into Supabase using the table import tool, or POST each entry to /api/vending-log. For other tables, use their respective API endpoints.",
      },
      vending_sales_log: allVending,
      aquarium_stock: stockEntries || [],
      aquarium_mortality: mortalityEntries || [],
      customer_balances: customerBalances || [],
      record_counts: {
        vending_log: allVending.length,
        aquarium_stock: (stockEntries || []).length,
        aquarium_mortality: (mortalityEntries || []).length,
        customer_balances: (customerBalances || []).length,
      },
    };

    const jsonString = JSON.stringify(backupPayload, null, 2);
    const filename = `urban_trout_backup_${dateLabel}.json`;
    const { record_counts } = backupPayload;

    const caption =
      `🔒 <b>URBAN TROUT — NIGHTLY DATA BACKUP</b>\n` +
      `📅 <b>Date:</b> ${nowIST} IST\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 <b>Vending Sales Log:</b> ${record_counts.vending_log} entries\n` +
      `🌊 <b>Aquarium Stock:</b> ${record_counts.aquarium_stock} batches\n` +
      `💀 <b>Mortality Log:</b> ${record_counts.aquarium_mortality} entries\n` +
      `📒 <b>Customer Balances:</b> ${record_counts.customer_balances} records\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🛡️ <i>Download this file and keep it safe.\n` +
      `To restore database, give this file to your developer with prompt:</i>\n\n` +
      `<code>Restore the Urban Trout database from this JSON backup. Recreate all Supabase tables and import all data exactly as-is.</code>`;

    const docResult = await sendTelegramDocument(chatId, filename, jsonString, caption);

    if (!docResult?.ok) {
      console.error("[backup] Telegram sendDocument failed:", docResult);
      await sendTelegramText(chatId,
        `🔒 <b>URBAN TROUT NIGHTLY BACKUP — ${nowIST}</b>\n` +
        `⚠️ JSON file send failed (${docResult?.description || "error"})\n` +
        `Records: ${record_counts.vending_log} vending | ${record_counts.aquarium_stock} stock | ${record_counts.aquarium_mortality} mortality | ${record_counts.customer_balances} balances`
      );
      return NextResponse.json({ success: false, error: docResult?.description, counts: record_counts }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `Backup sent to Telegram at ${nowIST} IST`,
      filename,
      counts: record_counts,
      telegramMessageId: docResult?.result?.message_id,
    });
  } catch (err: any) {
    console.error("[backup] Error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Nightly Backup Endpoint Active",
    schedule: "Runs daily at 00:30 IST (18:30 UTC) via Vercel Cron",
    coverage: ["vending_sales_log", "aquarium_stock", "aquarium_mortality", "customer_balances"],
    instructions: "Trigger manually via POST with x-admin-token header.",
  });
}
