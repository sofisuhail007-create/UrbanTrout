import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBusinessHoursInfo, StoreSettingsOverrides } from "@/lib/businessHours";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const overrides: StoreSettingsOverrides = {
      storeManuallyClosed: false,
      farmMaintenanceActive: false,
      allowFridayOrders: false,
      forceStoreOpen: false,
    };

    try {
      const { data: rows } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", [
          "store_manually_closed",
          "farm_maintenance_active",
          "allow_friday_orders",
          "force_store_open",
        ]);

      if (rows && rows.length > 0) {
        for (const row of rows) {
          if (row.key === "store_manually_closed") {
            overrides.storeManuallyClosed = row.value === "true";
          } else if (row.key === "farm_maintenance_active") {
            overrides.farmMaintenanceActive = row.value === "true";
          } else if (row.key === "allow_friday_orders") {
            overrides.allowFridayOrders = row.value === "true";
          } else if (row.key === "force_store_open") {
            overrides.forceStoreOpen = row.value === "true";
          }
        }
      }
    } catch {
      // fallback to defaults if database read fails
    }

    const hoursInfo = getBusinessHoursInfo(new Date(), overrides);

    return NextResponse.json(
      {
        isOpen: hoursInfo.isOpen,
        isManuallyClosed: Boolean(overrides.storeManuallyClosed),
        farmMaintenanceActive: Boolean(overrides.farmMaintenanceActive),
        allowFridayOrders: Boolean(overrides.allowFridayOrders),
        forceStoreOpen: Boolean(overrides.forceStoreOpen),
        isFridayMaintenance: hoursInfo.isFridayMaintenance,
        closedReason: hoursInfo.closedReason,
        nextOpenISO: hoursInfo.nextOpenISO,
        nextOpenLabel: hoursInfo.nextOpenLabel,
        currentISTHour: hoursInfo.currentISTHour,
        currentISTMinute: hoursInfo.currentISTMinute,
        currentISTDay: hoursInfo.currentISTDay,
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
