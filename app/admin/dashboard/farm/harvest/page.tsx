"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type TankStocking, type WaterParameter } from "@/lib/supabase";

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

// Target weights for rainbow trout (grams)
const TARGET_MIN_G = 300;
const TARGET_OPT_G = 400;

type HarvestForecast = {
  stocking: TankStocking;
  aliveFish: number;
  daysOnFarm: number;
  sgr: number; // % per day
  latestTemp: number | null;
  daysToMin: number | null;
  daysToOpt: number | null;
  dateMin: Date | null;
  dateOpt: Date | null;
  projectedBiomassMin: number;
  projectedBiomassOpt: number;
  percentToMin: number;
};

export default function HarvestForecastPage() {
  const pathname = usePathname();
  const [stockings, setStockings] = useState<TankStocking[]>([]);
  const [waterParams, setWaterParams] = useState<WaterParameter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: w }] = await Promise.all([
        supabase.from("tank_stocking").select("*").order("stocking_date", { ascending: false }),
        supabase
          .from("water_parameters")
          .select("*")
          .order("date", { ascending: false })
          .limit(50),
      ]);
      setStockings((s as TankStocking[]) ?? []);
      setWaterParams((w as WaterParameter[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const forecasts: HarvestForecast[] = stockings
    .filter((s) => s.status === "active")
    .map((s) => {
      const today = new Date();
      const stockDate = new Date(s.stocking_date);
      const daysOnFarm = Math.max(
        Math.round((today.getTime() - stockDate.getTime()) / 86400000),
        1
      );
      const aliveFish = s.fish_count - s.mortality_count;

      // SGR = ((ln(W2) - ln(W1)) / days) × 100
      const w1 = s.avg_size_grams;
      const w2 = s.current_avg_size_grams;
      const sgr =
        w1 > 0 && w2 > w1 && daysOnFarm > 0
          ? ((Math.log(w2) - Math.log(w1)) / daysOnFarm) * 100
          : 0;

      // Latest water temp for this tank
      const latestTemp =
        waterParams.find((wp) => wp.tank_id === s.tank_id)?.temperature ?? null;

      // Project days to reach target using SGR
      // W(t) = W_current × e^(SGR/100 × t)
      // Solve: TARGET = W2 × e^(sgr/100 × t) → t = ln(TARGET/W2) / (sgr/100)
      let daysToMin: number | null = null;
      let daysToOpt: number | null = null;
      let dateMin: Date | null = null;
      let dateOpt: Date | null = null;

      if (sgr > 0) {
        if (w2 < TARGET_MIN_G) {
          daysToMin = Math.ceil(Math.log(TARGET_MIN_G / w2) / (sgr / 100));
          dateMin = new Date(today.getTime() + daysToMin * 86400000);
        } else {
          daysToMin = 0;
          dateMin = today;
        }
        if (w2 < TARGET_OPT_G) {
          daysToOpt = Math.ceil(Math.log(TARGET_OPT_G / w2) / (sgr / 100));
          dateOpt = new Date(today.getTime() + daysToOpt * 86400000);
        } else {
          daysToOpt = 0;
          dateOpt = today;
        }
      }

      const projectedBiomassMin = daysToMin !== null ? (aliveFish * TARGET_MIN_G) / 1000 : 0;
      const projectedBiomassOpt = daysToOpt !== null ? (aliveFish * TARGET_OPT_G) / 1000 : 0;
      const percentToMin =
        TARGET_MIN_G > 0 ? Math.min((w2 / TARGET_MIN_G) * 100, 100) : 0;

      return {
        stocking: s,
        aliveFish,
        daysOnFarm,
        sgr,
        latestTemp,
        daysToMin,
        daysToOpt,
        dateMin,
        dateOpt,
        projectedBiomassMin,
        projectedBiomassOpt,
        percentToMin,
      };
    });

  const soonest = forecasts
    .filter((f) => f.daysToOpt !== null && f.daysToOpt > 0)
    .sort((a, b) => (a.daysToOpt ?? 9999) - (b.daysToOpt ?? 9999))[0];

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
            Harvest Forecast
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Growth trajectory and projected harvest dates using Specific Growth Rate (SGR)
          </p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-400 space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-600">Harvest Targets</p>
          <p>
            <span className="text-amber-400 font-semibold">{TARGET_MIN_G}g</span>{" "}
            <span className="text-slate-500">minimum</span>
            <span className="mx-2 text-slate-700">·</span>
            <span className="text-green-400 font-semibold">{TARGET_OPT_G}g</span>{" "}
            <span className="text-slate-500">optimal</span>
          </p>
        </div>
      </div>

      {/* Soonest harvest callout */}
      {soonest && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4">
          <span className="material-symbols-outlined text-emerald-400 text-3xl">event_available</span>
          <div>
            <p className="text-emerald-400 font-bold text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Soonest Optimal Harvest — {soonest.stocking.batch_name}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              In ~{soonest.daysToOpt} days &nbsp;({soonest.dateOpt?.toLocaleDateString("en-IN")})&nbsp; ·&nbsp;
              Projected yield: <strong className="text-emerald-400">{soonest.projectedBiomassOpt.toFixed(1)} kg</strong>
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-600 py-20">Loading forecast...</div>
      ) : forecasts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-10 text-center text-slate-600">
          <span className="material-symbols-outlined text-5xl block mb-3 text-slate-800">event</span>
          No active batches found. Stock a tank to see harvest forecasts.
        </div>
      ) : (
        <div className="space-y-5">
          {forecasts.map((f) => (
            <div
              key={f.stocking.id}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5"
            >
              {/* Batch header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white text-base" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    {f.stocking.batch_name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {TANK_LABELS[f.stocking.tank_id] ?? f.stocking.tank_id} &bull; {f.aliveFish.toLocaleString()} fish alive &bull;{" "}
                    {f.daysOnFarm} days on farm
                    {f.latestTemp !== null && <> &bull; Latest temp: <span className="text-cyan-400">{f.latestTemp}°C</span></>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-600 uppercase tracking-wider">SGR</p>
                  <p
                    className="text-xl font-bold"
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      color: f.sgr > 1 ? "#4ade80" : f.sgr > 0 ? "#fbbf24" : "#f87171",
                    }}
                  >
                    {f.sgr > 0 ? `${f.sgr.toFixed(2)}%/day` : "Not enough growth data"}
                  </p>
                </div>
              </div>

              {/* Progress to minimum harvest */}
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-500">Progress to minimum harvest ({TARGET_MIN_G}g)</span>
                  <span
                    className="font-bold"
                    style={{ color: f.percentToMin >= 100 ? "#4ade80" : f.percentToMin >= 70 ? "#fbbf24" : "#94a3b8" }}
                  >
                    {f.stocking.current_avg_size_grams}g / {TARGET_MIN_G}g ({Math.round(f.percentToMin)}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${f.percentToMin}%`,
                      background:
                        f.percentToMin >= 100
                          ? "linear-gradient(90deg, #4ade80, #22d3ee)"
                          : f.percentToMin >= 70
                          ? "linear-gradient(90deg, #fbbf24, #4ade80)"
                          : "linear-gradient(90deg, #22d3ee, #818cf8)",
                    }}
                  />
                </div>
              </div>

              {/* Forecast timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Minimum harvest */}
                <div
                  className="rounded-xl p-4 border"
                  style={{ background: "#fbbf2410", borderColor: "#fbbf2430" }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 mb-1">Minimum Harvest</p>
                  {f.daysToMin === 0 ? (
                    <p className="text-amber-400 font-bold text-sm">✓ Ready now</p>
                  ) : f.daysToMin !== null ? (
                    <>
                      <p className="text-amber-400 font-bold text-lg" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        ~{f.daysToMin} days
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Est. {f.dateMin?.toLocaleDateString("en-IN")}
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Yield: <span className="text-amber-400 font-semibold">{f.projectedBiomassMin.toFixed(1)} kg</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-600 text-xs italic">Cannot forecast — no growth data</p>
                  )}
                </div>

                {/* Optimal harvest */}
                <div
                  className="rounded-xl p-4 border"
                  style={{ background: "#4ade8010", borderColor: "#4ade8030" }}
                >
                  <p className="text-[10px] uppercase tracking-wider text-green-600 mb-1">Optimal Harvest</p>
                  {f.daysToOpt === 0 ? (
                    <p className="text-green-400 font-bold text-sm">✓ At or above target</p>
                  ) : f.daysToOpt !== null ? (
                    <>
                      <p className="text-green-400 font-bold text-lg" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        ~{f.daysToOpt} days
                      </p>
                      <p className="text-slate-400 text-xs mt-1">
                        Est. {f.dateOpt?.toLocaleDateString("en-IN")}
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Yield: <span className="text-green-400 font-semibold">{f.projectedBiomassOpt.toFixed(1)} kg</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-600 text-xs italic">Cannot forecast — no growth data</p>
                  )}
                </div>
              </div>

              {f.sgr === 0 && (
                <p className="text-xs text-slate-600 italic">
                  ⚠️ SGR cannot be calculated — update the current average size in the Tanks tab to enable forecasting.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
