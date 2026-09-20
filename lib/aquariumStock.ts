import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

export interface AquariumStockSummary {
  remainingKg: number;
  totalProcuredKg: number;
  allTimeSoldKg: number;
  totalMortalityKg: number;
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

/**
 * Calculates real-time live trout biomass remaining in the aquarium.
 * Formula: Total Live Fish Procured − Total Sold (Vending Counter) − Mortality/Scrap Loss
 * This matches the exact calculation shown on /admin/dashboard/vending-log.
 */
export async function getLiveAquariumStock(customClient?: any): Promise<AquariumStockSummary> {
  try {
    const db = getAquariumDbClient(customClient);

    // 1. Fetch procurement batches (aquarium_stock_log)
    const { data: stockBatches } = await db
      .from("aquarium_stock_log")
      .select("weight_kg");

    let totalProcuredKg = 0;
    (stockBatches || []).forEach((b: any) => {
      totalProcuredKg = Math.round((totalProcuredKg + (Number(b.weight_kg) || 0)) * 1000) / 1000;
    });

    // 2. Fetch sales from vending_sales_log and fallback app_settings
    const [tableRes, fallbackRes] = await Promise.all([
      db.from("vending_sales_log").select("id, weight_kg"),
      db.from("app_settings").select("value").eq("key", "vending_log_data").maybeSingle(),
    ]);

    let fallbackEntries: any[] = [];
    if (fallbackRes.data?.value) {
      try {
        const parsed = JSON.parse(fallbackRes.data.value);
        if (Array.isArray(parsed)) fallbackEntries = parsed;
      } catch (_) {}
    }

    // Deduplicate by ID (same dual-layer merge as vending-log)
    const salesMap = new Map<string, number>();
    for (const e of fallbackEntries) {
      if (e?.id) salesMap.set(e.id, Number(e.weight_kg) || 0);
    }
    for (const e of tableRes.data || []) {
      if (e?.id) salesMap.set(e.id, Number(e.weight_kg) || 0);
    }

    let allTimeSoldKg = 0;
    salesMap.forEach((w) => {
      allTimeSoldKg = Math.round((allTimeSoldKg + w) * 1000) / 1000;
    });

    // 3. Fetch mortality ledger from app_settings
    const { data: mortRow } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "aquarium_mortality_ledger")
      .maybeSingle();

    let totalMortalityKg = 0;
    if (mortRow?.value) {
      try {
        const parsed = JSON.parse(mortRow.value);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: any) => {
            totalMortalityKg = Math.round((totalMortalityKg + (Number(m.weight_kg) || 0)) * 1000) / 1000;
          });
        }
      } catch (_) {}
    }

    const remainingKg = Math.max(
      0,
      Math.round((totalProcuredKg - allTimeSoldKg - totalMortalityKg) * 1000) / 1000
    );

    return {
      remainingKg,
      totalProcuredKg,
      allTimeSoldKg,
      totalMortalityKg,
    };
  } catch (err) {
    console.error("Error calculating live aquarium stock:", err);
    return {
      remainingKg: 0,
      totalProcuredKg: 0,
      allTimeSoldKg: 0,
      totalMortalityKg: 0,
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
        notes: `Website Online Order #${orderNum} (${customerName}) | Item: ${item.name || productType} | Razorpay: ${razorpayPaymentId || "Verified"}`,
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

    // 1. Delete from vending_sales_log table
    try {
      await db
        .from("vending_sales_log")
        .delete()
        .or(`notes.ilike.%#${strVal}%,notes.ilike.%Order ${strVal}%`);
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
            const num = e.custom_fields?.order_number;
            const id = e.custom_fields?.order_id;
            const notes = e.notes || "";
            if (num && String(num) === strVal) return false;
            if (id && String(id) === strVal) return false;
            if (notes.includes(`#${strVal}`) || notes.includes(`Order ${strVal}`)) return false;
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
