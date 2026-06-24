"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type WaterParameter } from "@/lib/supabase";
import {
  validateDO,
  getAmmoniaStatus,
  getPHStatus,
  getTempStatus,
  getNitriteStatus,
  getNitrateStatus,
} from "@/lib/do-saturation";

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

type AlarmEntry = {
  entry: WaterParameter;
  alarms: { parameter: string; value: number; status: string; color: string; message: string }[];
  severity: "danger" | "warning";
};

function checkEntry(e: WaterParameter): AlarmEntry["alarms"] {
  const alarms: AlarmEntry["alarms"] = [];

  const doV = validateDO(e.temperature, e.dissolved_oxygen);
  if (doV && doV.status !== "optimal" && doV.status !== "calibration_error") {
    const isDanger = doV.status === "critical" || doV.status === "hypoxic";
    if (isDanger || doV.status === "low") {
      alarms.push({
        parameter: "Dissolved Oxygen",
        value: e.dissolved_oxygen,
        status: doV.status,
        color: doV.color,
        message: doV.message,
      });
    }
  }

  const amm = getAmmoniaStatus(e.ammonia);
  if (amm.status !== "safe") {
    alarms.push({
      parameter: "Ammonia (NH₃)",
      value: e.ammonia,
      status: amm.status,
      color: amm.color,
      message: `Ammonia at ${e.ammonia} ppm — ${amm.status}`,
    });
  }

  const ph = getPHStatus(e.ph);
  if (ph.status !== "optimal") {
    alarms.push({
      parameter: "pH",
      value: e.ph,
      status: ph.status,
      color: ph.color,
      message: `pH at ${e.ph} — ${ph.status}`,
    });
  }

  const tmp = getTempStatus(e.temperature);
  if (tmp.status !== "optimal") {
    alarms.push({
      parameter: "Temperature",
      value: e.temperature,
      status: tmp.status,
      color: tmp.color,
      message: `Temperature at ${e.temperature}°C — ${tmp.status}`,
    });
  }

  const no2 = getNitriteStatus(e.nitrite);
  if (no2.status !== "safe") {
    alarms.push({
      parameter: "Nitrite (NO₂)",
      value: e.nitrite,
      status: no2.status,
      color: no2.color,
      message: `Nitrite at ${e.nitrite} ppm — ${no2.status}`,
    });
  }

  const no3 = getNitrateStatus(e.nitrate);
  if (no3.status !== "safe") {
    alarms.push({
      parameter: "Nitrate (NO₃)",
      value: e.nitrate,
      status: no3.status,
      color: no3.color,
      message: `Nitrate at ${e.nitrate} ppm — ${no3.status}`,
    });
  }

  return alarms;
}

export default function BioAlarmsPage() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<WaterParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "danger" | "warning">("all");

  useEffect(() => {
    supabase
      .from("water_parameters")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setEntries((data as WaterParameter[]) ?? []);
        setLoading(false);
      });
  }, []);

  // Build alarm list — only entries with at least one triggered alarm
  const alarmEntries: AlarmEntry[] = entries
    .map((e) => {
      const alarms = checkEntry(e);
      if (alarms.length === 0) return null;
      const hasDanger = alarms.some(
        (a) => a.status === "danger" || a.status === "critical" || a.status === "hypoxic" || a.status === "high" || a.status === "toxic"
      );
      return {
        entry: e,
        alarms,
        severity: hasDanger ? "danger" : "warning",
      } as AlarmEntry;
    })
    .filter(Boolean) as AlarmEntry[];

  const filtered = alarmEntries.filter((a) => filter === "all" || a.severity === filter);
  const dangerCount = alarmEntries.filter((a) => a.severity === "danger").length;
  const warningCount = alarmEntries.filter((a) => a.severity === "warning").length;

  // 48h recent alarms
  const now = Date.now();
  const recentAlarms = alarmEntries.filter(
    (a) => now - new Date(a.entry.created_at).getTime() < 48 * 3600 * 1000
  );

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
          Bio-Alarm Console
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Historical record of all water parameter readings that exceeded safe thresholds
        </p>
      </div>

      {/* Active alarms banner */}
      {recentAlarms.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="material-symbols-outlined text-red-400 text-2xl animate-pulse">crisis_alert</span>
            <p className="text-red-400 font-bold text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {recentAlarms.length} alarm{recentAlarms.length > 1 ? "s" : ""} in the last 48 hours
            </p>
          </div>
          <div className="space-y-2">
            {recentAlarms.slice(0, 3).map((a, i) => (
              <div key={i} className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500">{a.entry.date} · {TANK_LABELS[a.entry.tank_id] ?? a.entry.tank_id}</span>
                {a.alarms.map((alarm, j) => (
                  <span
                    key={j}
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: `${alarm.color}20`, color: alarm.color }}
                  >
                    {alarm.parameter}: {alarm.value}
                  </span>
                ))}
              </div>
            ))}
            {recentAlarms.length > 3 && (
              <p className="text-xs text-slate-600">+{recentAlarms.length - 3} more…</p>
            )}
          </div>
        </div>
      )}

      {/* Summary + Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3">
          {[
            { key: "all", label: `All (${alarmEntries.length})`, color: "text-slate-400" },
            { key: "danger", label: `Danger (${dangerCount})`, color: "text-red-400" },
            { key: "warning", label: `Warning (${warningCount})`, color: "text-amber-400" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as "all" | "danger" | "warning")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                filter === f.key
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
                  : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-600">Showing {filtered.length} alarm entries</p>
      </div>

      {loading ? (
        <div className="text-center text-slate-600 py-20">Scanning parameter history...</div>
      ) : alarmEntries.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-10 text-center">
          <span className="material-symbols-outlined text-5xl block mb-3 text-slate-800">verified</span>
          <p className="text-green-400 font-semibold text-sm">All Clear</p>
          <p className="text-slate-600 text-xs mt-1">No parameter readings have exceeded safe thresholds.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a, idx) => (
            <div
              key={idx}
              className="bg-slate-900/80 border rounded-xl p-5"
              style={{
                borderColor: a.severity === "danger" ? "#f8717130" : "#fbbf2430",
                borderLeftColor: a.severity === "danger" ? "#f87171" : "#fbbf24",
                borderLeftWidth: 3,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {TANK_LABELS[a.entry.tank_id] ?? a.entry.tank_id}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.entry.date}</p>
                </div>
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                  style={{
                    background: a.severity === "danger" ? "#f8717120" : "#fbbf2420",
                    color: a.severity === "danger" ? "#f87171" : "#fbbf24",
                  }}
                >
                  {a.severity}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.alarms.map((alarm, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: `${alarm.color}15`, border: `1px solid ${alarm.color}30` }}
                  >
                    <span className="material-symbols-outlined text-[13px]" style={{ color: alarm.color }}>
                      warning
                    </span>
                    <span style={{ color: alarm.color }} className="font-semibold">{alarm.parameter}:</span>
                    <span className="text-slate-300">{alarm.message.split("—")[1]?.trim() ?? alarm.status}</span>
                  </div>
                ))}
              </div>
              {a.entry.notes && (
                <p className="text-xs text-slate-600 mt-2 italic">{a.entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
