import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBusinessHoursInfo } from "@/lib/businessHours";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const hoursInfo = getBusinessHoursInfo();

    // Check manual store closure override from app_settings
    let isManuallyClosed = false;
    try {
      const { data: closedRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "store_manually_closed")
        .single();
      isManuallyClosed = closedRow?.value === "true";
    } catch {
      // ignore supabase read failures, fallback to business hours
    }

    const isOpen = hoursInfo.isOpen && !isManuallyClosed;

    return NextResponse.json(
      {
        isOpen,
        isManuallyClosed,
        nextOpenISO: hoursInfo.nextOpenISO,
        nextOpenLabel: isManuallyClosed ? "when we reopen" : hoursInfo.nextOpenLabel,
        serverTimeISO: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to check store status" },
      { status: 500 }
    );
  }
}
