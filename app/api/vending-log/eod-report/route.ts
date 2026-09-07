import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { requireAdminAuth } from "@/lib/adminAuth";

export interface EodReportPayload {
  reportDate?: string;
  totalSoldKg?: number;
  guttedSoldKg?: number;
  nonGuttedSoldKg?: number;
  grossRevenue?: number;
  expectedRevenue?: number;
  netRealizedProfit?: number;
  profitMarginPercent?: string;
  onlineRevenue?: number;
  onlineCount?: number;
  cashRevenue?: number;
  cashCount?: number;
  negotiationLoss?: number;
  totalBills?: number;
  liveStockRemainingKg?: number;
  stockWorthGutted?: number;
  stockWorthNonGutted?: number;
  todayMortalityKg?: number;
  todayMortalityCost?: number;
  todayMortalityCount?: number;
  aminDailyIncentive?: number;
  aminIncentivePending?: number;
  aminSalaryMonthPaid?: number;
  aminSalaryBalanceDue?: number;
  aminBaseSalary?: number;
  customNote?: string;
  previewOnly?: boolean;
}

export function formatEodTelegramMessage(p: EodReportPayload): string {
  const dateStr = p.reportDate || new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const nowTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const totalKg = Number(p.totalSoldKg || 0).toFixed(2);
  const guttedKg = Number(p.guttedSoldKg || 0).toFixed(2);
  const nonGuttedKg = Number(p.nonGuttedSoldKg || 0).toFixed(2);
  const revenue = Number(p.grossRevenue || 0).toLocaleString("en-IN");
  const profit = Number(p.netRealizedProfit || 0).toLocaleString("en-IN");
  const margin = p.profitMarginPercent || "0.0";
  const cash = Number(p.cashRevenue || 0).toLocaleString("en-IN");
  const cashCount = p.cashCount ?? 0;
  const online = Number(p.onlineRevenue || 0).toLocaleString("en-IN");
  const onlineCount = p.onlineCount ?? 0;
  const loss = Number(p.negotiationLoss || 0).toLocaleString("en-IN");
  const bills = p.totalBills ?? 0;
  const liveStock = Number(p.liveStockRemainingKg || 0).toFixed(2);
  const worthG = Number(p.stockWorthGutted || 0).toLocaleString("en-IN");
  const worthNG = Number(p.stockWorthNonGutted || 0).toLocaleString("en-IN");
  const mortKg = Number(p.todayMortalityKg || 0).toFixed(2);
  const mortCost = Number(p.todayMortalityCost || 0).toLocaleString("en-IN");
  const mortCount = p.todayMortalityCount ?? 0;

  const aminIncentive = Number(p.aminDailyIncentive || 0).toLocaleString("en-IN");
  const aminPending = Number(p.aminIncentivePending || 0).toLocaleString("en-IN");
  const aminBase = Number(p.aminBaseSalary || 15000).toLocaleString("en-IN");
  const aminSalPaid = Number(p.aminSalaryMonthPaid || 0).toLocaleString("en-IN");
  const aminSalDue = Number(p.aminSalaryBalanceDue || 0).toLocaleString("en-IN");

  let msg = `🐟 <b>URBAN TROUT — VENDING CENTER EOD REPORT</b>\n`;
  msg += `📅 <b>Date:</b> ${dateStr} | <i>${nowTime}</i>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📊 <b>TODAY'S DISPATCH &amp; SALES:</b>\n`;
  msg += `• <b>Total Weight Sold:</b> ${totalKg} Kg (${bills} bills)\n`;
  msg += `  ↳ <i>Gutted:</i> ${guttedKg} Kg | <i>Non-Gutted:</i> ${nonGuttedKg} Kg\n`;
  msg += `• <b>Gross Revenue:</b> ₹${revenue}\n`;
  msg += `• <b>Net Realized Profit:</b> <b>₹${profit}</b> (${margin}% net margin)\n`;
  if (Number(p.negotiationLoss || 0) > 0) {
    msg += `• <b>Negotiation Discount Loss:</b> ₹${loss}\n`;
  }
  msg += `\n`;

  msg += `💳 <b>PAYMENT COLLECTION:</b>\n`;
  msg += `• <b>Cash in Drawer:</b> ₹${cash} (${cashCount} sales)\n`;
  msg += `• <b>UPI / Soundbox / Online:</b> ₹${online} (${onlineCount} orders)\n\n`;

  msg += `🌊 <b>LIVE AQUARIUM STATUS:</b>\n`;
  msg += `• <b>Current Live Stock Remaining:</b> <b>${liveStock} Kg</b>\n`;
  msg += `• <b>Stock Value:</b> ₹${worthG} (Gutted) | ₹${worthNG} (Non-Gutted)\n`;
  if (Number(p.todayMortalityKg || 0) > 0) {
    msg += `• ⚠️ <b>Today's Mortality / Scrap:</b> ${mortKg} Kg (${mortCount} fish · ₹${mortCost} loss)\n`;
  } else {
    msg += `• <b>Today's Mortality / Scrap:</b> 0.00 Kg (Zero loss ✓)\n`;
  }
  msg += `\n`;

  msg += `👷 <b>STAFF COMPENSATION (MOHD AMIN):</b>\n`;
  msg += `• <b>Today's Gutted Incentive Earned:</b> ₹${aminIncentive}\n`;
  msg += `• <b>All-Time Incentive Pending:</b> ₹${aminPending}\n`;
  msg += `• <b>Monthly Salary:</b> ₹${aminBase}/mo (Paid: ₹${aminSalPaid} | Due: ₹${aminSalDue})\n`;

  if (p.customNote && p.customNote.trim()) {
    msg += `\n📝 <b>Closing Note:</b>\n<i>${p.customNote.trim()}</i>\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📍 <i>Urban Trout Counter Auditing · Live Vending Center</i>`;

  return msg;
}

export async function POST(req: NextRequest) {
  try {
    const authError = await requireAdminAuth(req);
    if (authError) return authError;

    const payload: EodReportPayload = await req.json();
    const formattedHtml = formatEodTelegramMessage(payload);

    if (payload.previewOnly) {
      return NextResponse.json({
        success: true,
        previewHtml: formattedHtml,
      });
    }

    const telegramRes = await sendTelegramMessage(formattedHtml, "HTML");

    if (!telegramRes || !telegramRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: telegramRes?.description || "Failed to dispatch Telegram message",
          previewHtml: formattedHtml,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: telegramRes.result?.message_id,
      previewHtml: formattedHtml,
    });
  } catch (err: any) {
    console.error("[vending-log EOD Report Error]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to send EOD report" },
      { status: 500 }
    );
  }
}
