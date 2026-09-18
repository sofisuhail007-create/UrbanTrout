/**
 * Business Hours Utility — Urban Trout
 * Operating hours: 7:00 AM – 10:00 PM IST (Asia/Kolkata, UTC+5:30)
 */

export interface BusinessHoursInfo {
  isOpen: boolean;
  /** Human-readable next open time, e.g. "today at 7:00 AM" or "tomorrow at 7:00 AM" */
  nextOpenLabel: string;
  /** ISO string of exact next open timestamp */
  nextOpenISO: string;
  /** Current IST hour (0–23) */
  currentISTHour: number;
  /** Current IST minutes */
  currentISTMinute: number;
}

const OPEN_HOUR = 7;   // 7:00 AM
const CLOSE_HOUR = 22; // 10:00 PM

/**
 * Returns current IST date (UTC + 5h30m) info.
 * Works server-side (Node.js) and client-side.
 */
export function getBusinessHoursInfo(now?: Date): BusinessHoursInfo {
  const utcMs = (now ?? new Date()).getTime();
  // IST = UTC + 5 hours 30 minutes
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istMs = utcMs + istOffsetMs;
  const istDate = new Date(istMs);

  const currentISTHour = istDate.getUTCHours();
  const currentISTMinute = istDate.getUTCMinutes();

  const isOpen = currentISTHour >= OPEN_HOUR && currentISTHour < CLOSE_HOUR;

  // Compute next open time
  let nextOpenISO: string;
  let nextOpenLabel: string;

  if (isOpen) {
    // Already open — next open is for reference only (closing time)
    nextOpenISO = "";
    nextOpenLabel = "";
  } else if (currentISTHour < OPEN_HOUR) {
    // Before 7 AM — opens today
    const nextOpen = new Date(istMs);
    nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
    nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
    nextOpenLabel = "today at 7:00 AM";
  } else {
    // After 10 PM — opens tomorrow at 7 AM
    const nextOpen = new Date(istMs);
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
    nextOpen.setUTCHours(OPEN_HOUR, 0, 0, 0);
    nextOpenISO = new Date(nextOpen.getTime() - istOffsetMs).toISOString();
    nextOpenLabel = "tomorrow at 7:00 AM";
  }

  return {
    isOpen,
    nextOpenLabel,
    nextOpenISO,
    currentISTHour,
    currentISTMinute,
  };
}
