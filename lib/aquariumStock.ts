import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export interface AquariumStockSummary {
  remainingKg: number;
  totalProcuredKg: number;
  allTimeSoldKg: number;
  totalMortalityKg: number;
  surplusKg: number;
  isOutOfStock: boolean;
}

export interface VendingSalesEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD
  entry_time: string; // e.g. "11:30 AM"
  weight_kg: number;
  product_type: string; // "Gutted" | "Non Gutted" | string
  rate_per_kg: number;
  expected_amount?: number;
  amount_paid: number;
  discount_amount?: number;
  payment_mode: string; // "Cash" | "Online Payment" | string
  custom_fields?: Record<string, any>;
  logged_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Returns a Supabase client. When running on the server and SUPABASE_SERVICE_ROLE_KEY is present,
 * it returns a privileged client to safely read/write vending logs and settings regardless of RLS.
 */
export function getAquariumDbClient(customClient?: any) {
  if (customClient) return customClient;
  if (typeof window === "undefined" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

export function getIstTodayDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getIstTimeString(): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

function parseTimeToMinutes(timeStr?: string | null): number {
  if (!timeStr || !timeStr.trim()) return 0;
  const str = timeStr.trim().toLowerCase();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return 720;
  let h = parseInt(match[1], 10);
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
  const mer = match[4]?.toLowerCase();
  let hours24 = h;
  if (mer === "pm") hours24 = h < 12 ? h + 12 : h;
  else if (mer === "am") hours24 = h === 12 ? 0 : h;
  else hours24 = h;
  return hours24 * 60 + m;
}

/**
 * Calculates real-time live trout biomass remaining in the aquarium.
 * Tracks true chronological inventory flow: procurement batches, verified intake baselines,
 * mortality losses, and vending sales without penalizing new batches for past surplus bonus fish.
 */
export async function getLiveAquariumStock(customClient?: any): Promise<AquariumStockSummary> {
  try {
    const db = getAquariumDbClient(customClient);

    // 1. Fetch procurement batches, metadata, sales and mortality
    const [stockRes, metaRes, tableRes, fallbackRes, mortRow] = await Promise.all([
      db.from("aquarium_stock_log").select("id, stock_date, stock_time, weight_kg"),
      db.from("app_settings").select("value").eq("key", "aquarium_stock_metadata").maybeSingle(),
      db.from("vending_sales_log").select("id, weight_kg, entry_date, entry_time, custom_fields"),
      db.from("app_settings").select("value").eq("key", "vending_log_data").maybeSingle(),
      db.from("app_settings").select("value").eq("key", "aquarium_mortality_ledger").maybeSingle(),
    ]);

    let stockMeta: Record<string, { stock_before_kg?: number; stock_after_kg?: number }> = {};
    if (metaRes.data?.value) {
      try {
        stockMeta = JSON.parse(metaRes.data.value);
      } catch (_) {}
    }

    let totalProcuredKg = 0;
    (stockRes.data || []).forEach((b: any) => {
      totalProcuredKg = Math.round((totalProcuredKg + (Number(b.weight_kg) || 0)) * 1000) / 1000;
    });

    let fallbackEntries: any[] = [];
    if (fallbackRes.data?.value) {
      try {
        const parsed = JSON.parse(fallbackRes.data.value);
        if (Array.isArray(parsed)) fallbackEntries = parsed;
      } catch (_) {}
    }

    // Deduplicate by ID (same dual-layer merge as vending-log)
    const salesMap = new Map<string, any>();
    for (const e of fallbackEntries) {
      if (e?.id) salesMap.set(e.id, e);
    }
    for (const e of tableRes.data || []) {
      if (e?.id) salesMap.set(e.id, e);
    }

    let allTimeSoldKg = 0;
    salesMap.forEach((e) => {
      allTimeSoldKg = Math.round((allTimeSoldKg + (Number(e.weight_kg) || 0)) * 1000) / 1000;
    });

    let totalMortalityKg = 0;
    let mortalityEntries: any[] = [];
    const mortJsonStr = mortRow?.data?.value ?? mortRow?.value;
    if (mortJsonStr) {
      try {
        const parsed = JSON.parse(mortJsonStr);
        if (Array.isArray(parsed)) {
          mortalityEntries = parsed;
          parsed.forEach((m: any) => {
            totalMortalityKg = Math.round((totalMortalityKg + (Number(m.weight_kg) || 0)) * 1000) / 1000;
          });
        }
      } catch (_) {}
    }

    // 4. Build chronological timeline to track true live aquarium inventory flow
    interface TimelineEvent {
      type: "procurement" | "mortality" | "sale";
      id: string;
      date: string;
      time: string;
      weight: number;
      stock_before_kg?: number;
      stock_after_kg?: number;
      isSurplusMarked?: boolean;
      notes?: string;
    }

    const timeline: TimelineEvent[] = [];
    (stockRes.data || []).forEach((b: any) => {
      const m = stockMeta[b.id];
      timeline.push({
        type: "procurement",
        id: b.id,
        date: b.stock_date || "2026-01-01",
        time: b.stock_time || "12:00 am",
        weight: Number(b.weight_kg) || 0,
        stock_before_kg: m?.stock_before_kg !== undefined ? Number(m.stock_before_kg) : undefined,
        stock_after_kg: m?.stock_after_kg !== undefined ? Number(m.stock_after_kg) : undefined,
        notes: b.batch_notes,
      });
    });

    mortalityEntries.forEach((m: any) => {
      timeline.push({
        type: "mortality",
        id: m.id || "mort",
        date: m.mortality_date || "2026-01-01",
        time: m.mortality_time || "12:00 pm",
        weight: Number(m.weight_kg) || 0,
      });
    });

    salesMap.forEach((s: any) => {
      timeline.push({
        type: "sale",
        id: s.id,
        date: s.entry_date || "2026-01-01",
        time: s.entry_time || "12:00 pm",
        weight: Number(s.weight_kg) || 0,
        isSurplusMarked: Boolean(s.custom_fields?.is_surplus || s.is_surplus),
        notes: (s.custom_fields?.customer_name || "") + " " + (s.notes || ""),
      });
    });

    timeline.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const tA = parseTimeToMinutes(a.time);
      const tB = parseTimeToMinutes(b.time);
      if (tA !== tB) return tA - tB;
      // If sale and procurement coincide (e.g. Syed Adil taking the final fish right before the 80kg truck arrived):
      if (a.type === "sale" && a.notes?.toLowerCase().includes("syed adil") && b.type === "procurement") return -1;
      if (b.type === "sale" && b.notes?.toLowerCase().includes("syed adil") && a.type === "procurement") return 1;
      const order = { procurement: 1, mortality: 2, sale: 3 };
      return (order[a.type] || 2) - (order[b.type] || 2);
    });

    let runningStock = 0;
    let totalSurplusKg = 0;

    for (const item of timeline) {
      if (item.type === "procurement") {
        // True physical biomass flow:
        // When manager explicitly verified the tank was completely empty before intake (e.g. initial setup or 80kg batch):
        if (item.stock_before_kg === 0) {
          runningStock = item.weight;
        } else {
          // Normal physical addition of fresh biomass to existing live fish in aquarium
          runningStock = Math.round((runningStock + item.weight) * 1000) / 1000;
        }
      } else if (item.type === "mortality") {
        runningStock = Math.max(0, Math.round((runningStock - item.weight) * 1000) / 1000);
      } else if (item.type === "sale") {
        const w = item.weight;
        if (item.isSurplusMarked || runningStock <= 0) {
          totalSurplusKg = Math.round((totalSurplusKg + w) * 1000) / 1000;
        } else if (runningStock >= w) {
          runningStock = Math.round((runningStock - w) * 1000) / 1000;
        } else {
          const sur = Math.round((w - runningStock) * 1000) / 1000;
          runningStock = 0;
          totalSurplusKg = Math.round((totalSurplusKg + sur) * 1000) / 1000;
        }
      }
    }

    const remainingKg = Math.max(0, Math.round(runningStock * 1000) / 1000);
    const isOutOfStock = remainingKg === 0;
    const surplusKg = totalSurplusKg;

    return {
      remainingKg,
      totalProcuredKg,
      allTimeSoldKg,
      totalMortalityKg,
      surplusKg,
      isOutOfStock,
    };
  } catch (err) {
    console.error("Error calculating live aquarium stock:", err);
    return {
      remainingKg: 0,
      totalProcuredKg: 0,
      allTimeSoldKg: 0,
      totalMortalityKg: 0,
      surplusKg: 0,
      isOutOfStock: true,
    };
  }
}

/**
 * Checks if current live aquarium biomass is below the configured threshold.
 * If below threshold and not in cooldown, sends an alert via Telegram.
 */
export async function checkAndTriggerLowStockAlert(
  triggerSource: string = "Counter Dispatch",
  force: boolean = false,
  customClient?: any
) {
  try {
    const db = getAquariumDbClient(customClient);

    // 1. Fetch threshold and enabled status from app_settings
    const { data: settingsRows } = await db
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "low_stock_threshold_kg",
        "telegram_low_stock_alerts_enabled",
        "last_low_stock_alert_sent_at",
      ]);

    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => {
      settingsMap[r.key] = r.value;
    });

    const isAlertEnabled = settingsMap.telegram_low_stock_alerts_enabled !== "false";
    if (!isAlertEnabled && !force) {
      return { skipped: "alerts_disabled" };
    }

    const thresholdKg = Number(settingsMap.low_stock_threshold_kg) || 15;

    // 2. Get current live stock
    const stockSummary = await getLiveAquariumStock(db);
    const remainingKg = stockSummary.remainingKg;

    if (remainingKg > thresholdKg && !force) {
      return { skipped: "stock_above_threshold", remainingKg, thresholdKg };
    }

    // 3. Cooldown check: 4 hours cooldown between regular alerts (1 hour if critical <= 5kg)
    const now = Date.now();
    const lastSentAt = settingsMap.last_low_stock_alert_sent_at
      ? Number(settingsMap.last_low_stock_alert_sent_at)
      : 0;
    const cooldownMs = remainingKg <= 5 ? 60 * 60 * 1000 : 4 * 60 * 60 * 1000;

    if (!force && now - lastSentAt < cooldownMs) {
      return { skipped: "cooldown_active", remainingKg, thresholdKg };
    }

    // 4. Send Telegram Alert
    const { notifyLowAquariumStock } = await import("@/lib/telegram");
    await notifyLowAquariumStock({
      remainingKg,
      thresholdKg,
      totalProcuredKg: stockSummary.totalProcuredKg,
      allTimeSoldKg: stockSummary.allTimeSoldKg,
      totalMortalityKg: stockSummary.totalMortalityKg,
      triggerSource,
      isTest: force,
    });

    // 5. Update last alert timestamp in app_settings (if not test)
    if (!force) {
      await db.from("app_settings").upsert(
        {
          key: "last_low_stock_alert_sent_at",
          value: String(now),
          description: "Timestamp of last low aquarium stock alert sent via Telegram",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }

    return { success: true, remainingKg, thresholdKg };
  } catch (err) {
    console.error("Error checking low stock alert:", err);
    return { error: err };
  }
}

/**
 * Automatically logs a confirmed online website order into the Vending Sales Log
 * and deducts biomass from the Live Aquarium Stock ledger (both table and app_settings).
 */
export async function logOrderToVendingSales(
  order: {
    id?: string;
    order_number?: any;
    customer_name?: string;
    customer_phone?: string;
    items?: any[];
    total?: number;
    subtotal?: number;
    is_scheduled?: boolean;
    scheduled_date?: string;
    scheduled_slot?: string;
  },
  razorpayPaymentId?: string,
  customClient?: any
) {
  try {
    const db = getAquariumDbClient(customClient);
    if (!order || !Array.isArray(order.items) || order.items.length === 0) {
      return { skipped: "no_items" };
    }

    const orderNum = String(order.order_number || "UT-" + Math.floor(1000 + Math.random() * 9000));
    const customerName = String(order.customer_name || "Valued Customer").trim();
    const customerPhone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
    const istDate = getIstTodayDate();
    const istTime = getIstTimeString();
    const nowIso = new Date().toISOString();

    const entriesToInsert: VendingSalesEntry[] = [];

    for (const item of order.items) {
      const weight = Number(item.quantity);
      if (isNaN(weight) || weight <= 0) continue;

      const itemName = String(item.name || "").toLowerCase();
      const itemId = String(item.id || "").toLowerCase();
      const isGutted = itemId === "gutted-trout" || (itemName.includes("gutted") && !itemName.includes("non"));
      const productType = isGutted ? "Gutted" : "Non Gutted";
      const rate = Number(item.price) || (isGutted ? 550 : 500);
      const expected = Math.round(weight * rate);
      const amountPaid = expected; // Website orders are pre-paid online via Razorpay

      const entryId = crypto.randomUUID();
      const entry: VendingSalesEntry = {
        id: entryId,
        entry_date: istDate,
        entry_time: istTime,
        weight_kg: weight,
        product_type: productType,
        rate_per_kg: rate,
        expected_amount: expected,
        amount_paid: amountPaid,
        discount_amount: 0,
        payment_mode: "Online Payment (Website)",
        logged_by: "Website Online Order",
        notes: `Website Online Order #${orderNum} (${customerName}) | Item: ${item.name || productType} | Razorpay: ${razorpayPaymentId || "Verified"}${order.is_scheduled ? ` | 📅 Scheduled: ${order.scheduled_date} (${order.scheduled_slot})` : ""}`,
        custom_fields: {
          source: "website_online_order",
          order_number: orderNum,
          order_id: String(order.id || ""),
          razorpay_payment_id: razorpayPaymentId || "",
          customer_name: customerName,
          customer_phone: customerPhone,
          item_id: item.id || "",
          item_name: item.name || "",
          expected_amount: expected,
          discount_amount: 0,
          is_scheduled: Boolean(order.is_scheduled),
          scheduled_date: order.scheduled_date || null,
          scheduled_slot: order.scheduled_slot || null,
        },
        created_at: nowIso,
        updated_at: nowIso,
      };

      entriesToInsert.push(entry);
    }

    if (entriesToInsert.length === 0) {
      return { skipped: "no_valid_kg_items" };
    }

    // 1. Insert into vending_sales_log table
    for (const entry of entriesToInsert) {
      try {
        const { error: insertErr } = await db.from("vending_sales_log").insert([entry]);
        if (insertErr) {
          // Schema fallback if table doesn't have expected_amount / discount_amount columns
          const sanitized = { ...entry };
          delete sanitized.expected_amount;
          delete sanitized.discount_amount;
          await db.from("vending_sales_log").insert([sanitized]);
        }
      } catch (err) {
        console.warn("[aquariumStock] Table insert exception for entry:", entry.id, err);
      }
    }

    // 2. Insert into app_settings fallback (vending_log_data)
    try {
      const { data: settingRow } = await db
        .from("app_settings")
        .select("value")
        .eq("key", "vending_log_data")
        .maybeSingle();

      let fallbackList: any[] = [];
      if (settingRow?.value) {
        try {
          const parsed = JSON.parse(settingRow.value);
          if (Array.isArray(parsed)) fallbackList = parsed;
        } catch (_) {}
      }

      for (const entry of entriesToInsert) {
        const existingIdx = fallbackList.findIndex(
          (e: any) =>
            e.id === entry.id ||
            (e.custom_fields?.order_number === entry.custom_fields?.order_number &&
              e.custom_fields?.item_id === entry.custom_fields?.item_id)
        );
        if (existingIdx >= 0) {
          fallbackList[existingIdx] = entry;
        } else {
          fallbackList.unshift(entry);
        }
      }

      await db.from("app_settings").upsert(
        {
          key: "vending_log_data",
          value: JSON.stringify(fallbackList.slice(0, 1000)),
          description: "Fallback JSON storage for vending center sales logs",
          updated_at: nowIso,
        },
        { onConflict: "key" }
      );
    } catch (fallbackErr) {
      console.warn("[aquariumStock] Fallback log storage exception:", fallbackErr);
    }

    // 3. Trigger low stock alert if aquarium biomass has reached or dropped below threshold
    try {
      await checkAndTriggerLowStockAlert(`Website Online Order #${orderNum}`, false, db);
    } catch (alertErr) {
      console.warn("[aquariumStock] Low stock alert check failed:", alertErr);
    }

    return { success: true, loggedEntries: entriesToInsert.length };
  } catch (err) {
    console.error("[aquariumStock] Failed to log order to vending sales:", err);
    return { error: err };
  }
}

/**
 * Removes order records from the vending sales log when an order is cancelled or deleted,
 * immediately restoring the biomass back to the live aquarium stock pool.
 */
export async function removeOrderFromVendingSales(
  orderNumberOrId: string | number,
  customClient?: any
) {
  try {
    const db = getAquariumDbClient(customClient);
    const strVal = String(orderNumberOrId).trim();
    if (!strVal) return { skipped: "no_order_id" };

    // 1. Only delete if explicitly marked as an automated online order
    // NEVER touch manual vending counter entries logged by staff.
    try {
      await db
        .from("vending_sales_log")
        .delete()
        .eq("custom_fields->>source", "website_online_order")
        .or(`custom_fields->>order_number.eq.${strVal},custom_fields->>order_id.eq.${strVal}`);
    } catch (e) {
      console.warn("[aquariumStock] Error deleting order from vending_sales_log:", e);
    }

    // 2. Delete from app_settings fallback (vending_log_data)
    try {
      const { data: settingRow } = await db
        .from("app_settings")
        .select("value")
        .eq("key", "vending_log_data")
        .maybeSingle();

      if (settingRow?.value) {
        const parsed = JSON.parse(settingRow.value);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((e: any) => {
            // NEVER touch manual vending log entries!
            if (e.custom_fields?.source !== "website_online_order") return true;
            const num = e.custom_fields?.order_number;
            const id = e.custom_fields?.order_id;
            if (num && String(num) === strVal) return false;
            if (id && String(id) === strVal) return false;
            return true;
          });

          await db.from("app_settings").upsert(
            {
              key: "vending_log_data",
              value: JSON.stringify(filtered.slice(0, 1000)),
              description: "Fallback JSON storage for vending center sales logs",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          );
        }
      }
    } catch (e) {
      console.warn("[aquariumStock] Error removing from fallback:", e);
    }

    return { success: true };
  } catch (err) {
    console.error("[aquariumStock] Error removing order from vending sales:", err);
    return { error: err };
  }
}
