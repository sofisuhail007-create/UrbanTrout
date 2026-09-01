import { NextResponse } from "next/server";
import { notifyNewOrder, notifyAbandonedLead, notifyBioAlarm } from "@/lib/telegram";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

// In-memory cooldown cache: prevent sending duplicate Telegram alerts for same phone within 15 mins
const lastAbandonedLeadSent = new Map<string, number>();

export async function POST(request: Request) {
  // Rate limit: max 20 notifications per minute per IP
  const { limited } = checkRateLimit(request, 20, 60 * 1000);
  if (limited) {
    return NextResponse.json(
      { success: false, error: "Too many notification requests. Please throttle." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === "new_order") {
      // 1. Send Telegram Alert
      await notifyNewOrder(data);
      // 2. Send Resend Email Confirmation (to customer & admin)
      await sendOrderConfirmationEmail(data);
    } else if (type === "abandoned_lead") {
      const cleanPhone = String(data?.phone || "").replace(/\D/g, "").slice(-10);
      const now = Date.now();
      const lastSent = lastAbandonedLeadSent.get(cleanPhone) || 0;

      // Enforce 15-minute cooldown per customer phone number
      if (cleanPhone && now - lastSent < 15 * 60 * 1000) {
        return NextResponse.json({ success: true, skipped: "cooldown_active" });
      }

      if (cleanPhone) {
        lastAbandonedLeadSent.set(cleanPhone, now);
      }

      await notifyAbandonedLead(data);
    } else if (type === "bio_alarm") {
      await notifyBioAlarm(data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification API error:", error);
    return NextResponse.json({ success: false, error: "Failed to send notification" }, { status: 500 });
  }
}
