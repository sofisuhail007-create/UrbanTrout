import { NextResponse } from "next/server";
import { notifyNewOrder, notifyAbandonedLead, notifyBioAlarm } from "@/lib/telegram";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === "new_order") {
      await notifyNewOrder(data);
    } else if (type === "abandoned_lead") {
      await notifyAbandonedLead(data);
    } else if (type === "bio_alarm") {
      await notifyBioAlarm(data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telegram notify API error:", error);
    return NextResponse.json({ success: false, error: "Failed to send notification" }, { status: 500 });
  }
}
