/**
 * Business Hours Utility — Urban Trout
 * Operating schedule: Saturday to Thursday, 7:00 AM – 10:00 PM IST (Asia/Kolkata, UTC+5:30)
 * Closed on Fridays for scheduled Farm Maintenance & Bio-Security protocols,
 * unless overridden via Admin Panel settings (e.g. allow_friday_orders).
 */

export interface StoreSettingsOverrides {
  /** If true, the store is manually closed for a break or emergency */
  storeManuallyClosed?: boolean;
  /** If true, the farm/vending center is put into active maintenance mode on any day */
  farmMaintenanceActive?: boolean;
  /** If true, bypasses the automatic Friday closure and allows online orders on Friday (7 AM - 10 PM IST) */
  allowFridayOrders?: boolean;
  /** If true, forces the store to appear open 24/7 (for testing or emergency override) */
  forceStoreOpen?: boolean;
}

export interface BusinessHoursInfo {
  isOpen: boolean;
  /** True when the store is closed specifically for Friday weekly farm maintenance */
  isFridayMaintenance: boolean;
  /** True when the store is closed for manual or active farm maintenance */
  isFarmMaintenance?: boolean;
  /** True when Friday ordering is permitted via admin toggle */
  allowFridayOrders?: boolean;
  /** Reason for closure: friday_maintenance | farm_maintenance | outside_hours | manual | undefined */
  closedReason?: "friday_maintenance" | "farm_maintenance" | "outside_hours" | "manual";
  /** Human-readable next open time, e.g. "today at 7:00 AM", "tomorrow at 7:00 AM", or "Saturday at 7:00 AM" */
  nextOpenLabel: string;
  /** ISO string of exact next open timestamp */
  nextOpenISO: string;
  /** Current IST hour (0–23) */
  currentISTHour: number;
  /** Current IST minutes */
  currentISTMinute: number;
  /** Current IST Day of week (0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat) */
  currentISTDay: number;
}

const OPEN_HOUR = 7;   // 7:00 AM
const CLOSE_HOUR = 22; // 10:00 PM

/**
 * Returns current IST date (UTC + 5h30m) info.
 * Enforces closure on Fridays for farm maintenance unless allowFridayOrders is enabled.
 * Also supports active farm maintenance, manual closure, and force-open overrides.
 * Works server-side (Node.js) and client-side.
 */
export function getBusinessHoursInfo(
  now?: Date,
  overrides?: StoreSettingsOverrides
): BusinessHoursInfo {
  const utcMs = (now ?? new Date()).getTime();
  // IST = UTC + 5 hours 30 minutes
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istMs = utcMs + istOffsetMs;
  const istDate = new Date(istMs);

  const currentISTDay = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
  const currentISTHour = istDate.getUTCHours();
  const currentISTMinute = istDate.getUTCMinutes();

  const isFriday = currentISTDay === 5;
  const allowFridayOrders = Boolean(overrides?.allowFridayOrders);
  const farmMaintenanceActive = Boolean(overrides?.farmMaintenanceActive);
  const storeManuallyClosed = Boolean(overrides?.storeManuallyClosed);
  const forceStoreOpen = Boolean(overrides?.forceStoreOpen);

  // Friday is closed for maintenance by default, UNLESS allowFridayOrders is enabled or forceStoreOpen is active
  const isFridayMaintenance = isFriday && !allowFridayOrders && !forceStoreOpen;
  const isWithinOperatingHours = currentISTHour >= OPEN_HOUR && currentISTHour < CLOSE_HOUR;

  let isOpen = false;
  let closedReason: "friday_maintenance" | "farm_maintenance" | "outside_hours" | "manual" | undefined;
  let nextOpenISO = "";
  let nextOpenLabel = "";

  if (forceStoreOpen) {
    isOpen = true;
    closedReason = undefined;
    nextOpenISO = "";
    nextOpenLabel = "";
  } else if (storeManuallyClosed) {
    isOpen = false;
    closedReason = "manual";
    nextOpenISO = "";
    nextOpenLabel = "when we reopen";
  } else if (farmMaintenanceActive) {
    isOpen = false;
    closedReason = "farm_maintenance";
    nextOpenISO = "";
    nextOpenLabel = "when maintenance completes";
  } else if (isFridayMaintenance) {
    isOpen = false;
    closedReason = "friday_maintenance";
    const nextOpen = new Date(istMs);
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 1); // Saturday
    nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
    nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
    nextOpenLabel = "tomorrow (Saturday) at 7:00 AM";
  } else if (!isWithinOperatingHours) {
    isOpen = false;
    closedReason = "outside_hours";

    if (currentISTDay === 4 && currentISTHour >= CLOSE_HOUR) {
      // Thursday after 10 PM IST
      if (allowFridayOrders) {
        // Friday is open! Opens tomorrow at 7:00 AM IST (+1 day)
        const nextOpen = new Date(istMs);
        nextOpen.setUTCDate(nextOpen.getUTCDate() + 1); // Friday
        nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
        nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
        nextOpenLabel = "tomorrow (Friday) at 7:00 AM";
      } else {
        // Friday is maintenance -> opens Saturday at 7:00 AM IST (+2 days)
        const nextOpen = new Date(istMs);
        nextOpen.setUTCDate(nextOpen.getUTCDate() + 2); // Saturday
        nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
        nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
        nextOpenLabel = "Saturday at 7:00 AM";
      }
    } else if (currentISTHour < OPEN_HOUR) {
      // Before 7 AM on an operating day -> opens today at 7:00 AM IST
      const nextOpen = new Date(istMs);
      nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
      nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
      nextOpenLabel = "today at 7:00 AM";
    } else {
      // After 10 PM on operating day
      const nextOpen = new Date(istMs);
      nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
      nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
      nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
      nextOpenLabel = "tomorrow at 7:00 AM";
    }
  } else {
    // Within operating hours, not Friday maintenance, not farm maintenance, not manually closed
    isOpen = true;
    closedReason = undefined;
    nextOpenISO = "";
    nextOpenLabel = "";
  }

  return {
    isOpen,
    isFridayMaintenance,
    isFarmMaintenance: farmMaintenanceActive,
    allowFridayOrders,
    closedReason,
    nextOpenLabel,
    nextOpenISO,
    currentISTHour,
    currentISTMinute,
    currentISTDay,
  };
}
