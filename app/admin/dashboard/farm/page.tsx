"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type WaterParameter } from "@/lib/supabase";
import {
  validateDO,
  getMaxDO,
  getAmmoniaStatus,
  getPHStatus,
  getTempStatus,
  getNitriteStatus,
  getNitrateStatus,
  type DOValidation,
} from "@/lib/do-saturation";

const TANKS = ["tank_a", "tank_b", "tank_c", "tank_d"];
const TANK_LABELS: Record<string, string> = {
  tank_a: "Tank A",
  tank_b: "Tank B",
  tank_c: "Tank C",
  tank_d: "Tank D",
};

const SUB_NAV = [
  { href: "/admin/dashboard/farm", label: "Water Parameters", icon: "water_drop" },
  { href: "/admin/dashboard/farm/feed-log", label: "Feed Log", icon: "restaurant" },
  { href: "/admin/dashboard/farm/tanks", label: "Tanks", icon: "set_meal" },
];

const today = () => new Date().toISOString().split("T")[0];

export default function WaterParametersPage() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<WaterParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doValidation, setDoValidation] = useState<DOValidation | null>(null);

  // Form state
  const [form, setForm] = useState({
    tank_id: "tank_a",
    date: today(),
    dissolved_oxygen: "",
    ammonia: "",
    ph: "",
    temperature: "",
    nitrite: "",
    nitrate: "",
    notes: "",
  });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("water_parameters")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setEntries((data as WaterParameter[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Validate DO whenever temp or DO changes
  useEffect(() => {
    const temp = parseFloat(form.temperature);
    const doVal = parseFloat(form.dissolved_oxygen);
    if (!isNaN(temp) && !isNaN(doVal)) {
      setDoValidation(validateDO(temp, doVal));
    } else {
      setDoValidation(null);
    }
  }, [form.temperature, form.dissolved_oxygen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      tank_id: form.tank_id,
      date: form.date,
      dissolved_oxygen: parseFloat(form.dissolved_oxygen) || 0,
      ammonia: parseFloat(form.ammonia) || 0,
      ph: parseFloat(form.ph) || 0,
      temperature: parseFloat(form.temperature) || 0,
      nitrite: parseFloat(form.nitrite) || 0,
      nitrate: parseFloat(form.nitrate) || 0,
      notes: form.notes || null,
    };
    await supabase.from("water_parameters").insert(payload);
    setForm({ ...form, dissolved_oxygen: "", ammonia: "", ph: "", temperature: "", nitrite: "", nitrate: "", notes: "" });
    await fetchEntries();
    setSaving(false);
  };

  const handleExport = async () => {
    const XLSX = await import("xlsx");
    const month = form.date.substring(0, 7); // YYYY-MM
    const { data } = await supabase
      .from("water_parameters")
      .select("*")
      .gte("date", `${month}-01`)
      .lte("date", `${month}-31`)
      .order("date", { ascending: true });
    if (!data || data.length === 0) return alert("No data for this month.");

    const rows = data.map((r: WaterParameter) => ({
      Date: r.date,
      Tank: TANK_LABELS[r.tank_id] || r.tank_id,
      "DO (mg/L)": r.dissolved_oxygen,
      "Max DO at Temp": getMaxDO(r.temperature) ?? "-",
      "Ammonia (mg/L)": r.ammonia,
      pH: r.ph,
      "Temp (°C)": r.temperature,
      "Nitrite (mg/L)": r.nitrite,
      "Nitrate (mg/L)": r.nitrate,
      Notes: r.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Water Parameters");
    XLSX.writeFile(wb, `water_parameters_${month}.xlsx`);
  };

  // Get today's latest per tank for flash cards
  const todayStr = today();
  const todayEntries = entries.filter((e) => e.date === todayStr);
  const latestPerTank = TANKS.map((t) => todayEntries.find((e) => e.tank_id === t) || null);

  const maxDOForTemp = (temp: number) => getMaxDO(temp);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Water Parameters
          </h1>
          <p className="text-sm text-slate-400 mt-1">Daily monitoring with DO saturation intelligence</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/25 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Month (Excel)
        </button>
      </div>

      {/* Today's Flash Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TANKS.map((tankId, idx) => {
          const entry = latestPerTank[idx];
          const doVal = entry ? validateDO(entry.temperature, entry.dissolved_oxygen) : null;
          const ammoniaS = entry ? getAmmoniaStatus(entry.ammonia) : null;
          const phS = entry ? getPHStatus(entry.ph) : null;
          const tempS = entry ? getTempStatus(entry.temperature) : null;

          return (
            <div
              key={tankId}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-100 text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  {TANK_LABELS[tankId]}
                </h3>
                {entry && doVal && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ background: `${doVal.color}20`, color: doVal.color }}
                  >
                    {doVal.status.replace("_", " ")}
                  </span>
                )}
              </div>
              {entry ? (
                <div className="grid grid-cols-2 gap-2">
                  {/* DO */}
                  <div className="bg-slate-800/60 rounded-lg p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">DO</p>
                    <p className="text-lg font-bold" style={{ color: doVal?.color || "#94a3b8" }}>
                      {entry.dissolved_oxygen}
                      <span className="text-[10px] text-slate-500 ml-1">/ {maxDOForTemp(entry.temperature)}</span>
                    </p>
                  </div>
                  {/* Ammonia */}
                  <div className="bg-slate-800/60 rounded-lg p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">NH₃</p>
                    <p className="text-lg font-bold" style={{ color: ammoniaS?.color || "#94a3b8" }}>
                      {entry.ammonia}
                    </p>
                  </div>
                  {/* pH */}
                  <div className="bg-slate-800/60 rounded-lg p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">pH</p>
                    <p className="text-lg font-bold" style={{ color: phS?.color || "#94a3b8" }}>
                      {entry.ph}
                    </p>
                  </div>
                  {/* Temp */}
                  <div className="bg-slate-800/60 rounded-lg p-2.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Temp</p>
                    <p className="text-lg font-bold" style={{ color: tempS?.color || "#94a3b8" }}>
                      {entry.temperature}°C
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">No reading today</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Entry Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
          Log Water Parameters
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Tank */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tank</label>
            <select
              value={form.tank_id}
              onChange={(e) => setForm({ ...form, tank_id: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              {TANKS.map((t) => (
                <option key={t} value={t}>{TANK_LABELS[t]}</option>
              ))}
            </select>
          </div>
          {/* Date */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {/* Temperature (enter first for DO validation) */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Temperature (°C)
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 15.7"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
            {form.temperature && !isNaN(parseFloat(form.temperature)) && (
              <p className="text-[10px] text-cyan-400 mt-1">
                Max DO at {form.temperature}°C: <strong>{getMaxDO(parseFloat(form.temperature)) ?? "N/A"} mg/L</strong>
              </p>
            )}
          </div>
          {/* DO */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">DO (mg/L)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 8.2"
              value={form.dissolved_oxygen}
              onChange={(e) => setForm({ ...form, dissolved_oxygen: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              style={doValidation ? { borderColor: doValidation.color } : {}}
            />
          </div>
        </div>

        {/* DO Validation Alert */}
        {doValidation && (
          <div
            className="rounded-lg p-3 text-sm font-medium flex items-center gap-2"
            style={{ background: `${doValidation.color}15`, color: doValidation.color, border: `1px solid ${doValidation.color}30` }}
          >
            <span className="material-symbols-outlined text-[18px]">
              {doValidation.status === "optimal" ? "check_circle" : doValidation.status === "calibration_error" ? "error" : "warning"}
            </span>
            {doValidation.message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Ammonia */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Ammonia (mg/L)</label>
            <input
              type="number"
              step="0.001"
              placeholder="e.g. 0.02"
              value={form.ammonia}
              onChange={(e) => setForm({ ...form, ammonia: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {/* pH */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">pH</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 7.2"
              value={form.ph}
              onChange={(e) => setForm({ ...form, ph: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {/* Nitrite */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Nitrite (mg/L)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 0.05"
              value={form.nitrite}
              onChange={(e) => setForm({ ...form, nitrite: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {/* Nitrate */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Nitrate (mg/L)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 20"
              value={form.nitrate}
              onChange={(e) => setForm({ ...form, nitrate: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Notes (optional)</label>
          <input
            type="text"
            placeholder="Any observations..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-cyan-500/20 text-cyan-400 font-bold text-sm rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">{saving ? "hourglass_empty" : "save"}</span>
          {saving ? "Saving..." : "Save Entry"}
        </button>
      </form>

      {/* History Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Recent Readings
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Tank</th>
                <th className="text-center px-4 py-3">Temp °C</th>
                <th className="text-center px-4 py-3">DO (mg/L)</th>
                <th className="text-center px-4 py-3">Max DO</th>
                <th className="text-center px-4 py-3">Sat %</th>
                <th className="text-center px-4 py-3">NH₃</th>
                <th className="text-center px-4 py-3">pH</th>
                <th className="text-center px-4 py-3">NO₂</th>
                <th className="text-center px-4 py-3">NO₃</th>
                <th className="text-left px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-600">No entries yet. Start logging above.</td></tr>
              ) : (
                entries.map((e) => {
                  const doV = validateDO(e.temperature, e.dissolved_oxygen);
                  const amm = getAmmoniaStatus(e.ammonia);
                  const phS = getPHStatus(e.ph);
                  const tmpS = getTempStatus(e.temperature);
                  const no2 = getNitriteStatus(e.nitrite);
                  const no3 = getNitrateStatus(e.nitrate);
                  const mDO = getMaxDO(e.temperature);
                  const satPct = mDO ? Math.round((e.dissolved_oxygen / mDO) * 1000) / 10 : null;

                  return (
                    <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 text-slate-300">{e.date}</td>
                      <td className="px-4 py-3 text-slate-300 font-semibold">{TANK_LABELS[e.tank_id]}</td>
                      <td className="px-4 py-3 text-center">
                        <span style={{ color: tmpS.color }} className="font-semibold">{e.temperature}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span style={{ color: doV?.color || "#94a3b8" }} className="font-semibold">{e.dissolved_oxygen}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">{mDO ?? "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span style={{ color: doV?.color || "#94a3b8" }} className="font-semibold">
                          {satPct !== null ? `${satPct}%` : "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span style={{ color: amm.color }} className="font-semibold">{e.ammonia}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span style={{ color: phS.color }} className="font-semibold">{e.ph}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span style={{ color: no2.color }} className="font-semibold">{e.nitrite}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span style={{ color: no3.color }} className="font-semibold">{e.nitrate}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate">{e.notes || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
