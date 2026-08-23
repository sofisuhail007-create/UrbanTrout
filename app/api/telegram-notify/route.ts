import { NextResponse } from "next/server";
import { notifyNewOrder, notifyAbandonedLead, notifyBioAlarm } from "@/lib/telegram";
import { sendOrderConfirmationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === "new_order") {
      // 1. Send Telegram Alert
      await notifyNewOrder(data);
      // 2. Send Resend Email Confirmation (to customer & admin)
      await sendOrderConfirmationEmail(data);
    } else if (type === "abandoned_lead") {
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
