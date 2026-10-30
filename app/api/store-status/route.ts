import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getBusinessHoursInfo, StoreSettingsOverrides } from "@/lib/businessHours";

export const dynamic = "force-dynamic";

// In-memory 15-second cache to prevent hammering Supabase egress quota during multi-visitor store closed polling
let cachedOverrides: StoreSettingsOverrides | null = null;
let lastOverridesFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

export async function GET() {
  try {
    const nowMs = Date.now();
    let overrides: StoreSettingsOverrides = {
      storeManuallyClosed: false,
      farmMaintenanceActive: false,
      allowFridayOrders: false,
      forceStoreOpen: false,
    };

    if (cachedOverrides && nowMs - lastOverridesFetchTime < CACHE_TTL_MS) {
      overrides = { ...cachedOverrides };
    } else {
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
        cachedOverrides = { ...overrides };
        lastOverridesFetchTime = nowMs;
      } catch {
        // fallback to defaults or previous cache if database read fails
        if (cachedOverrides) {
          overrides = { ...cachedOverrides };
        }
      }
    }

    const hoursInfo = getBusinessHoursInfo(new Date(), overrides);
    const { getDeliveryScheduleInfo } = await import("@/lib/deliverySchedule");
    const scheduleInfo = getDeliveryScheduleInfo(new Date(), overrides);

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
        canSchedule: !hoursInfo.isOpen,
        scheduleInfo: !hoursInfo.isOpen ? scheduleInfo : null,
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
