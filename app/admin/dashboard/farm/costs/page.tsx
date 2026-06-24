"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type TankStocking, type FeedLogEntry, type EnergyLogEntry, type InventoryItem } from "@/lib/supabase";

const TANK_LABELS: Record<string, string> = { tank: "Tank", sump: "Sump Tank" };

const SUB_NAV = [
  { href: "/admin/dashboard/farm", label: "Water Parameters", icon: "water_drop" },
  { href: "/admin/dashboard/farm/feed-log", label: "Feed Log", icon: "restaurant" },
  { href: "/admin/dashboard/farm/tanks", label: "Tanks", icon: "set_meal" },
  { href: "/admin/dashboard/farm/yield", label: "Yield & Costs", icon: "monitoring" },
  { href: "/admin/dashboard/farm/energy", label: "Energy Log", icon: "bolt" },
  { href: "/admin/dashboard/farm/fcr", label: "FCR & Growth", icon: "calculate" },
  { href: "/admin/dashboard/farm/harvest", label: "Harvest Forecast", icon: "event" },
  { href: "/admin/dashboard/farm/costs", label: "Cost of Production", icon: "price_check" },
  { href: "/admin/dashboard/farm/alarms", label: "Bio-Alarms", icon: "crisis_alert" },
];

type BatchCost = {
  stocking: TankStocking;
  aliveFish: number;
  currentBiomassKg: number;
  fingerlingCost: number;
  feedKg: number;
  feedCost: number;
  energyCost: number;
  totalCost: number;
  costPerKg: number | null;
  sellingPriceWhole: number;
  sellingPriceGutted: number;
  marginWhole: number | null;
  marginGutted: number | null;
};

export default function CostOfProductionPage() {
  const pathname = usePathname();
  const [stockings, setStockings] = useState<TankStocking[]>([]);
  const [feedLogs, setFeedLogs] = useState<FeedLogEntry[]>([]);
  const [energyLogs, setEnergyLogs] = useState<EnergyLogEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: f }, { data: e }, { data: inv }] = await Promise.all([
        supabase.from("tank_stocking").select("*").order("stocking_date", { ascending: false }),
        supabase.from("feed_log").select("*"),
        supabase.from("energy_log").select("*"),
        supabase.from("inventory").select("*"),
      ]);
      setStockings((s as TankStocking[]) ?? []);
      setFeedLogs((f as FeedLogEntry[]) ?? []);
      setEnergyLogs((e as EnergyLogEntry[]) ?? []);
      setInventory((inv as InventoryItem[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Get selling prices from inventory or use defaults
  const wholeFishItem = inventory.find((i) => i.product_name?.toLowerCase().includes("whole"));
  const guttedFishItem = inventory.find((i) => i.product_name?.toLowerCase().includes("gutted"));
  const defaultWholePrice = wholeFishItem?.price_per_kg ?? 500;
  const defaultGuttedPrice = guttedFishItem?.price_per_kg ?? 550;

  // Total energy cost across all time
  const totalEnergyAllTime = energyLogs.reduce((s, e) => s + e.total_cost, 0);

  const batches: BatchCost[] = stockings.map((s) => {
    const aliveFish = s.fish_count - s.mortality_count;
    const currentBiomassKg = (aliveFish * s.current_avg_size_grams) / 1000;

    // Fingerling cost
    const fingerlingCost = s.fingerling_cost * s.fish_count;

    // Feed cost
    const stockDate = new Date(s.stocking_date);
    const harvestDate = s.harvest_date ? new Date(s.harvest_date) : new Date();
    const batchFeedEntries = feedLogs.filter(
      (f) =>
        f.tank_id === s.tank_id &&
        new Date(f.date) >= stockDate &&
        new Date(f.date) <= harvestDate
    );
    const feedKg = batchFeedEntries.reduce((acc, f) => acc + f.quantity_kg, 0);
    const feedCost = feedKg * s.feed_cost_per_kg;

    // Energy cost (proportional: batch days / total days × total energy)
    const today = new Date();
    const allDates = energyLogs.map((e) => new Date(e.date));
    const minDate = allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : today;
    const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : today;
    const totalFarmDays = Math.max(
      Math.round((maxDate.getTime() - minDate.getTime()) / 86400000),
      1
    );
    const batchDays = Math.max(
      Math.round((harvestDate.getTime() - stockDate.getTime()) / 86400000),
      1
    );
    const energyCost =
      totalFarmDays > 0
        ? (batchDays / totalFarmDays) * totalEnergyAllTime
        : 0;

    const totalCost = fingerlingCost + feedCost + energyCost;
    const costPerKg = currentBiomassKg > 0 ? totalCost / currentBiomassKg : null;

    const marginWhole =
      costPerKg !== null && defaultWholePrice > 0
        ? ((defaultWholePrice - costPerKg) / defaultWholePrice) * 100
        : null;
    const marginGutted =
      costPerKg !== null && defaultGuttedPrice > 0
        ? ((defaultGuttedPrice - costPerKg) / defaultGuttedPrice) * 100
        : null;

    return {
      stocking: s,
      aliveFish,
      currentBiomassKg,
      fingerlingCost,
      feedKg,
      feedCost,
      energyCost,
      totalCost,
      costPerKg,
      sellingPriceWhole: defaultWholePrice,
      sellingPriceGutted: defaultGuttedPrice,
      marginWhole,
      marginGutted,
    };
  });

  const activeBatches = batches.filter((b) => b.stocking.status === "active");
  const totalInvestment = batches.reduce((s, b) => s + b.totalCost, 0);
  const totalBiomass = activeBatches.reduce((s, b) => s + b.currentBiomassKg, 0);

  function marginColor(m: number | null): string {
    if (m === null) return "#64748b";
    if (m >= 30) return "#4ade80";
    if (m >= 10) return "#fbbf24";
    return "#f87171";
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-4">
        {SUB_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-cyan-500/15 text-cyan-400 font-semibold"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Cost of Production
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Per-batch breakdown of fingerling, feed, and energy costs with margin analysis
          </p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-sm space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-600">Selling Prices (from Inventory)</p>
          <p>
            <span className="text-slate-500 text-xs">Whole:</span>{" "}
            <span className="text-cyan-400 font-bold">₹{defaultWholePrice}/kg</span>
            <span className="mx-2 text-slate-700">·</span>
            <span className="text-slate-500 text-xs">Gutted:</span>{" "}
            <span className="text-cyan-400 font-bold">₹{defaultGuttedPrice}/kg</span>
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Investment", value: `₹${totalInvestment.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: "payments", color: "text-purple-400" },
          { label: "Active Biomass", value: `${totalBiomass.toFixed(1)} kg`, icon: "scale", color: "text-cyan-400" },
          { label: "Total Energy Cost", value: `₹${totalEnergyAllTime.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: "bolt", color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <span className={`material-symbols-outlined text-xl ${s.color}`}>{s.icon}</span>
            <p className="text-2xl font-bold text-white mt-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {s.value}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-600 py-20">Calculating costs...</div>
      ) : batches.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-10 text-center text-slate-600">
          <span className="material-symbols-outlined text-5xl block mb-3 text-slate-800">price_check</span>
          No batches found. Add stocking data in the Tanks tab.
        </div>
      ) : (
        <div className="space-y-5">
          {batches.map((b) => {
            const wColor = marginColor(b.marginWhole);
            const gColor = marginColor(b.marginGutted);
            const costs = [
              { label: "Fingerlings", amount: b.fingerlingCost, color: "#818cf8" },
              { label: "Feed", amount: b.feedCost, color: "#22d3ee" },
              { label: "Energy (proportional)", amount: b.energyCost, color: "#fbbf24" },
            ];
            const maxCost = Math.max(...costs.map((c) => c.amount), 1);

            return (
              <div
                key={b.stocking.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5"
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-white text-base" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {b.stocking.batch_name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {TANK_LABELS[b.stocking.tank_id] ?? b.stocking.tank_id} &bull;{" "}
                      {b.aliveFish.toLocaleString()} fish &bull; {b.currentBiomassKg.toFixed(1)} kg biomass
                    </p>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider ${
                      b.stocking.status === "active"
                        ? "border-cyan-500/40 text-cyan-400"
                        : b.stocking.status === "harvested"
                        ? "border-green-500/40 text-green-400"
                        : "border-slate-600 text-slate-500"
                    }`}
                  >
                    {b.stocking.status}
                  </span>
                </div>

                {/* Cost breakdown bars */}
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-widest text-slate-600">Cost Breakdown</p>
                  {costs.map((c) => (
                    <div key={c.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">{c.label}</span>
                        <span className="font-mono" style={{ color: c.color }}>
                          ₹{c.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min((c.amount / maxCost) * 100, 100)}%`,
                            background: c.color,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm">
                    <span className="text-slate-300 font-semibold">Total Cost</span>
                    <span className="text-white font-bold" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      ₹{b.totalCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Cost per kg + margins */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Cost per kg</p>
                    <p className="text-xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {b.costPerKg !== null ? `₹${b.costPerKg.toFixed(0)}` : "—"}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Margin — Whole (₹{b.sellingPriceWhole}/kg)</p>
                    <p className="text-xl font-bold" style={{ fontFamily: '"Space Grotesk", sans-serif', color: wColor }}>
                      {b.marginWhole !== null ? `${b.marginWhole.toFixed(1)}%` : "—"}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Margin — Gutted (₹{b.sellingPriceGutted}/kg)</p>
                    <p className="text-xl font-bold" style={{ fontFamily: '"Space Grotesk", sans-serif', color: gColor }}>
                      {b.marginGutted !== null ? `${b.marginGutted.toFixed(1)}%` : "—"}
                    </p>
                  </div>
                </div>

                {/* Feed summary */}
                <div className="flex items-center gap-4 text-xs text-slate-500 bg-slate-800/30 rounded-lg px-4 py-2.5">
                  <span>Feed used: <strong className="text-slate-300">{b.feedKg.toFixed(2)} kg</strong></span>
                  <span className="text-slate-700">·</span>
                  <span>@ ₹{b.stocking.feed_cost_per_kg}/kg</span>
                  <span className="text-slate-700">·</span>
                  <span>Fingerling rate: <strong className="text-slate-300">₹{b.stocking.fingerling_cost}/fish</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
