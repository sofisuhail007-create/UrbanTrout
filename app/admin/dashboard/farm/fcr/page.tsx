"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type TankStocking, type FeedLogEntry } from "@/lib/supabase";

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

function fcrColor(fcr: number): string {
  if (fcr <= 1.5) return "#4ade80";
  if (fcr <= 2.0) return "#fbbf24";
  return "#f87171";
}

function fcrLabel(fcr: number): string {
  if (fcr <= 1.5) return "Excellent";
  if (fcr <= 2.0) return "Acceptable";
  return "Poor";
}

type BatchFCR = {
  stocking: TankStocking;
  aliveFish: number;
  initialBiomass: number;
  currentBiomass: number;
  biomassGained: number;
  totalFeedKg: number;
  fcr: number | null;
  growthRate: number; // g/day
  daysOnFarm: number;
};

export default function FCRPage() {
  const pathname = usePathname();
  const [stockings, setStockings] = useState<TankStocking[]>([]);
  const [feedLogs, setFeedLogs] = useState<FeedLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: f }] = await Promise.all([
        supabase.from("tank_stocking").select("*").order("stocking_date", { ascending: false }),
        supabase.from("feed_log").select("*").order("date", { ascending: true }),
      ]);
      setStockings((s as TankStocking[]) ?? []);
      setFeedLogs((f as FeedLogEntry[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const batches: BatchFCR[] = stockings.map((s) => {
    const aliveFish = s.fish_count - s.mortality_count;
    const initialBiomass = (s.fish_count * s.avg_size_grams) / 1000; // kg
    const currentBiomass = (aliveFish * s.current_avg_size_grams) / 1000; // kg
    const biomassGained = Math.max(currentBiomass - initialBiomass, 0);

    // Sum feed for this tank from stocking_date onwards
    const stockDate = new Date(s.stocking_date);
    const totalFeedKg = feedLogs
      .filter((f) => f.tank_id === s.tank_id && new Date(f.date) >= stockDate)
      .reduce((acc, f) => acc + f.quantity_kg, 0);

    const fcr = biomassGained > 0 ? totalFeedKg / biomassGained : null;

    const today = new Date();
    const daysOnFarm = Math.max(
      Math.round((today.getTime() - stockDate.getTime()) / 86400000),
      1
    );
    const growthRate =
      daysOnFarm > 0
        ? (s.current_avg_size_grams - s.avg_size_grams) / daysOnFarm
        : 0;

    return { stocking: s, aliveFish, initialBiomass, currentBiomass, biomassGained, totalFeedKg, fcr, growthRate, daysOnFarm };
  });

  const activeBatches = batches.filter((b) => b.stocking.status === "active");
  const allBatches = batches;

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
      <div>
        <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
          FCR &amp; Growth Calculator
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Feed Conversion Ratio and daily growth tracking per batch
        </p>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Batches", value: activeBatches.length, icon: "set_meal", color: "text-cyan-400" },
          {
            label: "Total Active Biomass",
            value: `${activeBatches.reduce((s, b) => s + b.currentBiomass, 0).toFixed(1)} kg`,
            icon: "scale",
            color: "text-emerald-400",
          },
          {
            label: "Avg FCR (Active)",
            value:
              activeBatches.filter((b) => b.fcr !== null).length > 0
                ? (
                    activeBatches.filter((b) => b.fcr !== null).reduce((s, b) => s + (b.fcr ?? 0), 0) /
                    activeBatches.filter((b) => b.fcr !== null).length
                  ).toFixed(2)
                : "—",
            icon: "calculate",
            color: "text-amber-400",
          },
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
        <div className="text-center text-slate-600 py-20">Loading batches...</div>
      ) : allBatches.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-10 text-center text-slate-600">
          <span className="material-symbols-outlined text-5xl block mb-3 text-slate-800">calculate</span>
          No stocking batches found. Add a batch in the Tanks tab.
        </div>
      ) : (
        <div className="space-y-4">
          {allBatches.map((b) => {
            const color = b.fcr !== null ? fcrColor(b.fcr) : "#64748b";
            const label = b.fcr !== null ? fcrLabel(b.fcr) : "Insufficient Data";
            return (
              <div
                key={b.stocking.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5"
                style={{ borderLeftColor: color, borderLeftWidth: 3 }}
              >
                {/* Batch header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-white text-base" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {b.stocking.batch_name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {TANK_LABELS[b.stocking.tank_id] ?? b.stocking.tank_id} &bull; Stocked{" "}
                      {new Date(b.stocking.stocking_date).toLocaleDateString("en-IN")} &bull;{" "}
                      {b.daysOnFarm} days on farm
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                      style={{ background: `${color}20`, color }}
                    >
                      {label}
                    </span>
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
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Initial Fish", value: b.stocking.fish_count.toLocaleString() },
                    { label: "Alive Fish", value: b.aliveFish.toLocaleString() },
                    { label: "Mortality", value: b.stocking.mortality_count.toLocaleString(), warn: b.stocking.mortality_count > 0 },
                    { label: "Initial Avg Size", value: `${b.stocking.avg_size_grams}g` },
                    { label: "Current Avg Size", value: `${b.stocking.current_avg_size_grams}g` },
                    { label: "Growth Rate", value: `${b.growthRate.toFixed(2)} g/day` },
                    { label: "Initial Biomass", value: `${b.initialBiomass.toFixed(2)} kg` },
                    { label: "Current Biomass", value: `${b.currentBiomass.toFixed(2)} kg` },
                    { label: "Biomass Gained", value: `${b.biomassGained.toFixed(2)} kg` },
                    { label: "Total Feed Used", value: `${b.totalFeedKg.toFixed(2)} kg` },
                    {
                      label: "FCR",
                      value: b.fcr !== null ? b.fcr.toFixed(2) : "—",
                      highlight: true,
                      highlightColor: color,
                    },
                    { label: "Ideal FCR (Trout)", value: "1.0 – 1.5" },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                      <p
                        className="text-sm font-bold"
                        style={
                          stat.highlight
                            ? { color: stat.highlightColor, fontSize: "1.1rem" }
                            : stat.warn
                            ? { color: "#f87171" }
                            : { color: "#e2e8f0" }
                        }
                      >
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* FCR bar visual */}
                {b.fcr !== null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-widest text-slate-600">FCR Gauge (lower = better)</span>
                      <span className="text-xs font-bold" style={{ color }}>{b.fcr.toFixed(2)}</span>
                    </div>
                    <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                      {/* zones */}
                      <div className="absolute inset-0 flex">
                        <div className="flex-[1.5] bg-green-500/25 rounded-l-full" />
                        <div className="flex-[0.5] bg-amber-500/25" />
                        <div className="flex-1 bg-red-500/25 rounded-r-full" />
                      </div>
                      {/* pointer */}
                      <div
                        className="absolute top-0 h-full w-1 rounded-full"
                        style={{
                          left: `${Math.min((b.fcr / 3) * 100, 100)}%`,
                          background: color,
                          boxShadow: `0 0 6px ${color}`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-700 mt-0.5">
                      <span>0</span>
                      <span className="text-green-600">1.5 excellent</span>
                      <span className="text-amber-600">2.0 acceptable</span>
                      <span>3+</span>
                    </div>
                  </div>
                )}

                {b.fcr === null && (
                  <p className="text-xs text-slate-600 italic">
                    ⚠️ Not enough data to compute FCR — ensure feed logs are recorded from the stocking date onwards.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
