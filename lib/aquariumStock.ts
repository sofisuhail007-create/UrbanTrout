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
