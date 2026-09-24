/**
 * Business Hours Utility — Urban Trout
 * Operating schedule: Saturday to Thursday, 7:00 AM – 10:00 PM IST (Asia/Kolkata, UTC+5:30)
 * Closed on Fridays for scheduled Farm Maintenance & Bio-Security protocols.
 */

export interface BusinessHoursInfo {
  isOpen: boolean;
  /** True when the store is closed specifically for Friday weekly farm maintenance */
  isFridayMaintenance: boolean;
  /** Reason for closure: friday_maintenance | outside_hours | manual | undefined */
  closedReason?: "friday_maintenance" | "outside_hours" | "manual";
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
 * Enforces closure on Fridays for farm maintenance.
 * Works server-side (Node.js) and client-side.
 */
export function getBusinessHoursInfo(now?: Date): BusinessHoursInfo {
  const utcMs = (now ?? new Date()).getTime();
  // IST = UTC + 5 hours 30 minutes
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istMs = utcMs + istOffsetMs;
  const istDate = new Date(istMs);

  const currentISTDay = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
  const currentISTHour = istDate.getUTCHours();
  const currentISTMinute = istDate.getUTCMinutes();

  const isFridayMaintenance = currentISTDay === 5;
  const isOpen = !isFridayMaintenance && currentISTHour >= OPEN_HOUR && currentISTHour < CLOSE_HOUR;

  // Compute next open time
  let nextOpenISO = "";
  let nextOpenLabel = "";
  let closedReason: "friday_maintenance" | "outside_hours" | undefined;

  if (isOpen) {
    // Already open — next open is not applicable
    nextOpenISO = "";
    nextOpenLabel = "";
  } else if (isFridayMaintenance) {
    // All day Friday: Closed for Farm Maintenance -> Opens Saturday at 7:00 AM IST
    closedReason = "friday_maintenance";
    const nextOpen = new Date(istMs);
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 1); // Saturday
    nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
    nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
    nextOpenLabel = "tomorrow (Saturday) at 7:00 AM";
  } else if (currentISTDay === 4 && currentISTHour >= CLOSE_HOUR) {
    // Thursday after 10 PM IST -> Friday is maintenance, so opens Saturday at 7:00 AM IST (+2 days)
    closedReason = "outside_hours";
    const nextOpen = new Date(istMs);
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 2); // Saturday
    nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
    nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
    nextOpenLabel = "Saturday at 7:00 AM";
  } else if (currentISTHour < OPEN_HOUR) {
    // Before 7 AM on any open day (Sat–Thu) -> opens today at 7:00 AM IST
    closedReason = "outside_hours";
    const nextOpen = new Date(istMs);
    nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
    nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
    nextOpenLabel = "today at 7:00 AM";
  } else {
    // After 10 PM on Sat, Sun, Mon, Tue, Wed -> opens tomorrow at 7:00 AM IST
    closedReason = "outside_hours";
    const nextOpen = new Date(istMs);
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
    nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
    nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
    nextOpenLabel = "tomorrow at 7:00 AM";
  }

  return {
    isOpen,
    isFridayMaintenance,
    closedReason,
    nextOpenLabel,
    nextOpenISO,
    currentISTHour,
    currentISTMinute,
    currentISTDay,
  };
}
