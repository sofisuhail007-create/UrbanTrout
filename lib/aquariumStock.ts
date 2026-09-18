import { supabase } from "@/lib/supabase";

export interface AquariumStockSummary {
  remainingKg: number;
  totalProcuredKg: number;
  allTimeSoldKg: number;
  totalMortalityKg: number;
}

/**
 * Calculates real-time live trout biomass remaining in the aquarium.
 * Formula: Total Live Fish Procured − Total Sold (Vending Counter) − Mortality/Scrap Loss
 * This matches the exact calculation shown on /admin/dashboard/vending-log.
 */
export async function getLiveAquariumStock(): Promise<AquariumStockSummary> {
  try {
    // 1. Fetch procurement batches (aquarium_stock_log)
    const { data: stockBatches } = await supabase
      .from("aquarium_stock_log")
      .select("weight_kg");

    let totalProcuredKg = 0;
    (stockBatches || []).forEach((b) => {
      totalProcuredKg = Math.round((totalProcuredKg + (Number(b.weight_kg) || 0)) * 1000) / 1000;
    });

    // 2. Fetch sales from vending_sales_log and fallback app_settings
    const [tableRes, fallbackRes] = await Promise.all([
      supabase.from("vending_sales_log").select("id, weight_kg"),
      supabase.from("app_settings").select("value").eq("key", "vending_log_data").maybeSingle(),
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
    const { data: mortRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "aquarium_mortality_ledger")
      .maybeSingle();

    let totalMortalityKg = 0;
    if (mortRow?.value) {
      try {
        const parsed = JSON.parse(mortRow.value);
        if (Array.isArray(parsed)) {
          parsed.forEach((m) => {
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
  force: boolean = false
) {
  try {
    // 1. Fetch threshold and enabled status from app_settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "low_stock_threshold_kg",
        "telegram_low_stock_alerts_enabled",
        "last_low_stock_alert_sent_at",
      ]);

    const settingsMap: Record<string, string> = {};
    (settingsRows || []).forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    const isAlertEnabled = settingsMap.telegram_low_stock_alerts_enabled !== "false";
    if (!isAlertEnabled && !force) {
      return { skipped: "alerts_disabled" };
    }

    const thresholdKg = Number(settingsMap.low_stock_threshold_kg) || 15;

    // 2. Get current live stock
    const stockSummary = await getLiveAquariumStock();
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
      await supabase.from("app_settings").upsert(
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
