/**
 * Delivery Schedule Utility — Urban Trout
 * Operating schedule: Saturday to Thursday, 7:00 AM – 10:00 PM IST (Asia/Kolkata, UTC+5:30)
 * Closed on Fridays for Farm Maintenance.
 *
 * When store operations are paused (outside operating hours, Friday maintenance,
 * or temporary farm maintenance), customers can schedule an order for the next
 * operating day and choose their preferred delivery time slot.
 */

import { StoreSettingsOverrides, getBusinessHoursInfo } from "./businessHours";

export interface DeliveryDateOption {
  dateStr: string; // YYYY-MM-DD (in IST)
  dateIso: string; // YYYY-MM-DD alias
  displayDate: string; // e.g. "Tomorrow (Tuesday, Sep 29)"
  shortLabel: string; // e.g. "Tomorrow" or "Saturday"
  dayName: string; // "Tuesday", "Saturday", etc.
  dateLabel: string; // e.g. "Sep 29"
  formattedLabel: string; // e.g. "Tomorrow (Tuesday, Sep 29)"
  isDefault: boolean;
}

export interface DeliverySlotOption {
  id: string;
  timeWindow: string; // e.g. "08:00 AM – 10:00 AM"
  label: string; // e.g. "Morning Fresh Catch"
  icon: string;
  isPopular?: boolean;
}

export interface DeliveryScheduleInfo {
  canSchedule: boolean;
  isStoreClosed: boolean;
  closedReason?: "friday_maintenance" | "farm_maintenance" | "outside_hours" | "manual";
  closedReasonLabel: string;
  badgeLabel: string;
  headline: string;
  message: string;
  nextOperatingDayName: string;
  availableDates: DeliveryDateOption[];
  availableSlots: string[];
  slotOptions: DeliverySlotOption[];
  defaultDate: string; // formattedLabel e.g. "Tomorrow (Tuesday, Sep 29)"
  defaultDateDisplay: string;
  defaultDateStr: string; // YYYY-MM-DD
  defaultSlot: string; // e.g. "10:00 AM – 12:00 PM"
  nextOpenLabel: string;
}

export const STANDARD_DELIVERY_SLOTS: DeliverySlotOption[] = [
  { id: "slot-08-10", timeWindow: "08:00 AM – 10:00 AM", label: "Morning Fresh Harvest & Dispatch", icon: "🌅" },
  { id: "slot-10-12", timeWindow: "10:00 AM – 12:00 PM", label: "Mid-Morning Delivery Slot", icon: "☀️", isPopular: true },
  { id: "slot-12-14", timeWindow: "12:00 PM – 02:00 PM", label: "Lunch Delivery Slot", icon: "🍽️" },
  { id: "slot-14-16", timeWindow: "02:00 PM – 04:00 PM", label: "Afternoon Delivery Slot", icon: "🕒" },
  { id: "slot-16-18", timeWindow: "04:00 PM – 06:00 PM", label: "Evening Fresh Harvest & Dispatch", icon: "🌆", isPopular: true },
  { id: "slot-18-20", timeWindow: "06:00 PM – 08:00 PM", label: "Dinner Delivery Slot", icon: "🌙" },
  { id: "slot-20-22", timeWindow: "08:00 PM – 10:00 PM", label: "Late Evening Delivery Slot", icon: "🌌" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function buildDateOption(istDate: Date, prefix: string, isDefault: boolean): DeliveryDateOption {
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;

  const dayName = DAY_NAMES[istDate.getUTCDay()];
  const monthName = MONTH_NAMES[istDate.getUTCMonth()];
  const dayNum = istDate.getUTCDate();
  const dateLabel = `${monthName} ${dayNum}`;

  const displayDate = prefix
    ? `${prefix} (${dayName}, ${dateLabel})`
    : `${dayName}, ${dateLabel}`;

  return {
    dateStr,
    dateIso: dateStr,
    displayDate,
    shortLabel: prefix || dayName,
    dayName,
    dateLabel,
    formattedLabel: displayDate,
    isDefault,
  };
}

/**
 * Computes available delivery dates and slots when store operations are paused.
 */
export function getDeliveryScheduleInfo(
  now?: Date,
  overrides?: StoreSettingsOverrides
): DeliveryScheduleInfo {
  const hoursInfo = getBusinessHoursInfo(now, overrides);

  const utcMs = (now ?? new Date()).getTime();
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istMs = utcMs + istOffsetMs;
  const istDate = new Date(istMs);

  const currentISTDay = istDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const currentISTHour = istDate.getUTCHours();

  const allowFridayOrders = Boolean(overrides?.allowFridayOrders);
  const isFriday = currentISTDay === 5;
  const isFridayMaintenance = isFriday && !allowFridayOrders && !Boolean(overrides?.forceStoreOpen);

  let closedReasonLabel = "Farm Operations Paused";
  let badgeLabel = "Pre-Order Available";
  let headline = "Farm Operations Paused · Booking Next Available Delivery";
  let message = "We are accepting scheduled pre-orders for fresh live harvest and delivery.";
  let nextOperatingDayName = "Tomorrow";

  if (hoursInfo.closedReason === "friday_maintenance") {
    closedReasonLabel = "Friday Weekly Farm Maintenance";
    badgeLabel = "Friday Farm Maintenance";
    headline = "Scheduled for Saturday Morning Live Harvest";
    message = "Our Malabagh farm observes regular maintenance on Fridays. Live catch is harvested fresh and delivered Saturday.";
    nextOperatingDayName = "Saturday";
  } else if (hoursInfo.closedReason === "farm_maintenance") {
    closedReasonLabel = "Scheduled Biosecurity Maintenance";
    badgeLabel = "Biosecurity Maintenance";
    headline = "Scheduled Pre-Orders Active";
    message = "Farm maintenance protocols are in progress. Reserve your fresh live catch for the next delivery slot.";
    nextOperatingDayName = "Next Operating Day";
  } else if (hoursInfo.closedReason === "manual") {
    closedReasonLabel = "Temporary Store Break";
    badgeLabel = "Temporary Break";
    headline = "Scheduled Pre-Orders Active";
    message = "Store operations are temporarily paused. Choose your delivery slot and checkout securely.";
    nextOperatingDayName = "Next Available";
  } else if (hoursInfo.closedReason === "outside_hours") {
    closedReasonLabel = "Non-Operating Hours (Opens 7:00 AM IST)";
    badgeLabel = "Opens 7:00 AM IST";
    headline = "Night Hours · Pre-Order for Fresh Morning Catch";
    message = "We deliver live harvest daily between 7:00 AM – 10:00 PM IST. Pre-order now to secure your live morning catch.";
    nextOperatingDayName = currentISTHour < 7 ? "Today" : "Tomorrow";
  }

  // Calculate Available Next Operating Delivery Dates
  const availableDates: DeliveryDateOption[] = [];

  const addDays = (numDays: number) => {
    const d = new Date(istMs);
    d.setUTCDate(d.getUTCDate() + numDays);
    return d;
  };

  if (isFridayMaintenance) {
    // Today is Friday (maintenance). Next operating day is Saturday (+1 day) & Sunday (+2 days)
    availableDates.push(buildDateOption(addDays(1), "Tomorrow", true));
    availableDates.push(buildDateOption(addDays(2), "", false));
  } else if (currentISTDay === 4 && currentISTHour >= 22) {
    // Thursday after 10 PM. Tomorrow is Friday (maintenance unless allowed).
    if (allowFridayOrders) {
      availableDates.push(buildDateOption(addDays(1), "Tomorrow", true));
      availableDates.push(buildDateOption(addDays(2), "", false));
    } else {
      availableDates.push(buildDateOption(addDays(2), "Saturday", true));
      availableDates.push(buildDateOption(addDays(3), "Sunday", false));
    }
  } else if (currentISTHour < 7) {
    // Early morning before 7 AM on an operating day (Sat-Thu)
    // Customer can order for today (starting 8 AM slot) or tomorrow!
    availableDates.push(buildDateOption(addDays(0), "Today", true));
    availableDates.push(buildDateOption(addDays(1), "Tomorrow", false));
  } else {
    // Night after 10 PM (or middle of day if paused)
    // Next day is Tomorrow (+1 day)
    const tomorrowDate = addDays(1);
    const tomorrowDay = tomorrowDate.getUTCDay();

    if (tomorrowDay === 5 && !allowFridayOrders) {
      // Tomorrow is Friday maintenance -> next operating day is Saturday (+2 days)
      availableDates.push(buildDateOption(addDays(2), "Saturday", true));
      availableDates.push(buildDateOption(addDays(3), "Sunday", false));
    } else {
      availableDates.push(buildDateOption(tomorrowDate, "Tomorrow", true));
      const dayAfterTomorrow = addDays(2);
      if (dayAfterTomorrow.getUTCDay() === 5 && !allowFridayOrders) {
        // Skip Friday maintenance
        availableDates.push(buildDateOption(addDays(3), "Saturday", false));
      } else {
        availableDates.push(buildDateOption(dayAfterTomorrow, "", false));
      }
    }
  }

  // Ensure at least one date option
  if (availableDates.length === 0) {
    availableDates.push(buildDateOption(addDays(1), "Tomorrow", true));
  }

  const defaultDateObj = availableDates.find((d) => d.isDefault) || availableDates[0];
  const defaultSlot = STANDARD_DELIVERY_SLOTS[1].timeWindow; // "10:00 AM – 12:00 PM"

  return {
    canSchedule: !hoursInfo.isOpen,
    isStoreClosed: !hoursInfo.isOpen,
    closedReason: hoursInfo.closedReason,
    closedReasonLabel,
    badgeLabel,
    headline,
    message,
    nextOperatingDayName,
    availableDates,
    availableSlots: STANDARD_DELIVERY_SLOTS.map((s) => s.timeWindow),
    slotOptions: STANDARD_DELIVERY_SLOTS,
    defaultDate: defaultDateObj.formattedLabel,
    defaultDateDisplay: defaultDateObj.displayDate,
    defaultDateStr: defaultDateObj.dateStr,
    defaultSlot,
    nextOpenLabel: hoursInfo.nextOpenLabel,
  };
}
