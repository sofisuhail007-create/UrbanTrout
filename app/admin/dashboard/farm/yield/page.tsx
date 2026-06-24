"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type TankStocking, type FeedLogEntry } from "@/lib/supabase";

const SUB_NAV = [
  { href: "/admin/dashboard/farm", label: "Water Parameters", icon: "water_drop" },
  { href: "/admin/dashboard/farm/feed-log", label: "Feed Log", icon: "restaurant" },
  { href: "/admin/dashboard/farm/tanks", label: "Tanks", icon: "set_meal" },
  { href: "/admin/dashboard/farm/yield", label: "Yield & Costs", icon: "monitoring" },
  { href: "/admin/dashboard/farm/energy", label: "Energy Log", icon: "bolt" },
];

const TANK_LABELS: Record<string, string> = {
  tank: "Tank",
  sump: "Sump Tank",
};

export default function YieldPage() {
  const pathname = usePathname();
  const [stockings, setStockings] = useState<TankStocking[]>([]);
  const [feedLogs, setFeedLogs] = useState<FeedLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Fetch all stockings
    const { data: stData } = await supabase
      .from("tank_stocking")
      .select("*")
      .order("stocking_date", { ascending: false });
    
    // Fetch all feed logs
    const { data: flData } = await supabase
      .from("feed_log")
      .select("*")
      .order("date", { ascending: true });

    setStockings((stData as TankStocking[]) || []);
    setFeedLogs((flData as FeedLogEntry[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Analytics Engine
  const analytics = stockings.map((s) => {
    // 1. Calculate Feed Consumed by this batch
    // We sum feed logs for the tank where date >= stocking_date and <= harvest_date (if harvested) or today (if active)
    const endDate = s.harvest_date || new Date().toISOString().split("T")[0];
    const batchFeed = feedLogs.filter(
      (f) => f.tank_id === s.tank_id && f.date >= s.stocking_date && f.date <= endDate
    );
    const totalFeedKg = batchFeed.reduce((sum, f) => sum + f.quantity_kg, 0);

    // 2. Calculate Biomass
    const initialBiomassKg = (s.fish_count * s.avg_size_grams) / 1000;
    const currentAlive = s.fish_count - s.mortality_count;
    const finalBiomassKg = s.status === "harvested" && s.total_harvest_kg 
      ? s.total_harvest_kg 
      : (currentAlive * s.current_avg_size_grams) / 1000;
    
    const biomassGainedKg = finalBiomassKg - initialBiomassKg;

    // 3. FCR (Feed Conversion Ratio)
    // FCR = Total Feed Given / Total Biomass Gained
    const fcr = biomassGainedKg > 0 ? (totalFeedKg / biomassGainedKg) : 0;

    // 4. Costs
    const feedCost = totalFeedKg * (s.feed_cost_per_kg || 0);
    const totalCost = (s.fingerling_cost || 0) + feedCost;
    const costPerKg = finalBiomassKg > 0 ? (totalCost / finalBiomassKg) : 0;

    return {
      ...s,
      totalFeedKg,
      initialBiomassKg,
      finalBiomassKg,
      biomassGainedKg,
      fcr,
      feedCost,
      totalCost,
      costPerKg,
      durationDays: Math.floor(
        (new Date(endDate).getTime() - new Date(s.stocking_date).getTime()) / (1000 * 60 * 60 * 24)
      )
    };
  });

  const activeBatches = analytics.filter(a => a.status === "active");
  const harvestedBatches = analytics.filter(a => a.status === "harvested");

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Sub Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        {SUB_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
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
      <div>
        <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
          Yield & Cost Analytics
        </h1>
        <p className="text-sm text-slate-400 mt-1">Track Feed Conversion Ratios (FCR) and production costs</p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading analytics engine...</div>
      ) : (
        <div className="space-y-10">
          
          {/* Active Batches Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-300 border-b border-slate-800 pb-2">Active Batches (Estimated)</h2>
            {activeBatches.length === 0 ? (
              <p className="text-sm text-slate-500">No active batches.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {activeBatches.map(b => (
                  <div key={b.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-100 text-lg">{TANK_LABELS[b.tank_id]} <span className="text-xs font-normal text-slate-500 ml-2">{b.batch_name}</span></h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">Day {b.durationDays} • Stocked: {b.stocking_date}</p>
                      </div>
                      <span className="bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">Live Est.</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Total Feed</p>
                        <p className="text-lg font-bold text-slate-200">{b.totalFeedKg.toFixed(1)} <span className="text-xs text-slate-500">kg</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Est. Biomass</p>
                        <p className="text-lg font-bold text-slate-200">{b.finalBiomassKg.toFixed(1)} <span className="text-xs text-slate-500">kg</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Current FCR</p>
                        <p className={`text-lg font-bold ${b.fcr > 1.5 ? 'text-amber-400' : 'text-emerald-400'}`}>{b.fcr.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500">Sunk Cost (Fingerlings + Feed)</p>
                        <p className="font-bold text-slate-300">₹{b.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-slate-500">Est. Cost / Kg</p>
                        <p className="font-bold text-cyan-400">₹{b.costPerKg.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Harvested Batches Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-300 border-b border-slate-800 pb-2">Harvest History (Finalized)</h2>
            {harvestedBatches.length === 0 ? (
              <p className="text-sm text-slate-500">No harvested batches yet.</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {harvestedBatches.map(b => (
                  <div key={b.id} className="bg-slate-900 border border-slate-700/50 rounded-xl p-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-100 text-lg">{TANK_LABELS[b.tank_id]} <span className="text-xs font-normal text-slate-500 ml-2">{b.batch_name}</span></h3>
                        <p className="text-[10px] text-slate-500 mt-0.5">{b.durationDays} days • {b.stocking_date} to {b.harvest_date}</p>
                      </div>
                      <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md">Final</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Total Feed</p>
                        <p className="text-lg font-bold text-slate-200">{b.totalFeedKg.toFixed(1)} <span className="text-xs text-slate-500">kg</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-emerald-500 mb-1">Harvested</p>
                        <p className="text-lg font-bold text-emerald-400">{b.finalBiomassKg.toFixed(1)} <span className="text-xs text-emerald-500/50">kg</span></p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 mb-1">Final FCR</p>
                        <p className={`text-lg font-bold ${b.fcr > 1.5 ? 'text-amber-400' : 'text-emerald-400'}`}>{b.fcr.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="bg-slate-800/80 rounded-lg p-3 flex justify-between items-center border border-slate-700">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500">Total Production Cost</p>
                        <p className="font-bold text-slate-300">₹{b.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-slate-500">Final Cost / Kg</p>
                        <p className="font-bold text-emerald-400 text-xl">₹{b.costPerKg.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
