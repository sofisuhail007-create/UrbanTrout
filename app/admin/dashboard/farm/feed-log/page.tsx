"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type FeedLogEntry } from "@/lib/supabase";

const TANKS = ["tank"];
const TANK_LABELS: Record<string, string> = {
  tank: "Tank",
  sump: "Sump Tank",
};

const FEED_TYPES = [
  "Starter (1.2mm)",
  "Starter (1.8mm)",
  "Pre-Grower (3.0mm)",
  "Grower (6.0mm)",
  "Brood Stock (8.0mm)",
];
const FEEDING_TIMES = ["Morning", "Afternoon", "Evening"];

const SUB_NAV = [
  { href: "/admin/dashboard/farm", label: "Water Parameters", icon: "water_drop" },
  { href: "/admin/dashboard/farm/feed-log", label: "Feed Log", icon: "restaurant" },
  { href: "/admin/dashboard/farm/tanks", label: "Tanks", icon: "set_meal" },
  { href: "/admin/dashboard/farm/yield", label: "Yield & Costs", icon: "monitoring" },
  { href: "/admin/dashboard/farm/energy", label: "Energy Log", icon: "bolt" },
];

const today = () => new Date().toISOString().split("T")[0];

export default function FeedLogPage() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<FeedLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tank_id: "tank",
    date: today(),
    feed_type: "Grower (6.0mm)",
    quantity_kg: "",
    feeding_time: "Morning",
    notes: "",
  });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feed_log")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    setEntries((data as FeedLogEntry[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from("feed_log").insert({
      tank_id: form.tank_id,
      date: form.date,
      feed_type: form.feed_type,
      quantity_kg: parseFloat(form.quantity_kg) || 0,
      feeding_time: form.feeding_time,
      notes: form.notes || null,
    });
    setForm({ ...form, quantity_kg: "", notes: "" });
    await fetchEntries();
    setSaving(false);
  };

  const handleExport = async () => {
    const XLSX = await import("xlsx");
    const month = form.date.substring(0, 7);
    const { data } = await supabase
      .from("feed_log")
      .select("*")
      .gte("date", `${month}-01`)
      .lte("date", `${month}-31`)
      .order("date", { ascending: true });
    if (!data || data.length === 0) return alert("No data for this month.");

    const rows = data.map((r: FeedLogEntry) => ({
      Date: r.date,
      Tank: TANK_LABELS[r.tank_id] || r.tank_id,
      "Feed Type": r.feed_type,
      "Quantity (Kg)": r.quantity_kg,
      "Feeding Time": r.feeding_time,
      Notes: r.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Feed Log");
    XLSX.writeFile(wb, `feed_log_${month}.xlsx`);
  };

  // Summary cards
  const todayStr = today();
  const todayEntries = entries.filter((e) => e.date === todayStr);
  const totalFeedToday = todayEntries.reduce((sum, e) => sum + e.quantity_kg, 0);
  const feedPerTank = TANKS.map((t) => ({
    tank: TANK_LABELS[t],
    total: todayEntries.filter((e) => e.tank_id === t).reduce((sum, e) => sum + e.quantity_kg, 0),
    count: todayEntries.filter((e) => e.tank_id === t).length,
  }));

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
            Feed Log
          </h1>
          <p className="text-sm text-slate-400 mt-1">Track daily feeding across all tanks</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/25 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export Month (Excel)
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {/* Total Today */}
        <div className="bg-slate-900/80 border border-cyan-500/20 rounded-xl p-5 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Feed Today</p>
          <p className="text-3xl font-bold text-cyan-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            {totalFeedToday.toFixed(1)} <span className="text-sm text-slate-500">Kg</span>
          </p>
          <p className="text-[10px] text-slate-500">{todayEntries.length} feeding(s)</p>
        </div>
        {/* Per Tank */}
        {feedPerTank.map((t) => (
          <div key={t.tank} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{t.tank}</p>
            <p className="text-2xl font-bold text-slate-200" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {t.total.toFixed(1)} <span className="text-sm text-slate-500">Kg</span>
            </p>
            <p className="text-[10px] text-slate-500">{t.count} feeding(s)</p>
          </div>
        ))}
      </div>

      {/* Entry Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
          Log Feeding
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Feed Type</label>
            <select
              value={form.feed_type}
              onChange={(e) => setForm({ ...form, feed_type: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              {FEED_TYPES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Quantity (Kg)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 2.5"
              value={form.quantity_kg}
              onChange={(e) => setForm({ ...form, quantity_kg: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Time</label>
            <select
              value={form.feeding_time}
              onChange={(e) => setForm({ ...form, feeding_time: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              {FEEDING_TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Notes</label>
            <input
              type="text"
              placeholder="Optional"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-cyan-500/20 text-cyan-400 font-bold text-sm rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">{saving ? "hourglass_empty" : "save"}</span>
          {saving ? "Saving..." : "Log Feed"}
        </button>
      </form>

      {/* History Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Recent Feed Entries
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Tank</th>
                <th className="text-left px-4 py-3">Feed Type</th>
                <th className="text-center px-4 py-3">Qty (Kg)</th>
                <th className="text-left px-4 py-3">Time</th>
                <th className="text-left px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">No entries yet.</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{e.date}</td>
                    <td className="px-4 py-3 text-slate-300 font-semibold">{TANK_LABELS[e.tank_id]}</td>
                    <td className="px-4 py-3 text-slate-300">{e.feed_type}</td>
                    <td className="px-4 py-3 text-center text-cyan-400 font-bold">{e.quantity_kg}</td>
                    <td className="px-4 py-3 text-slate-400">{e.feeding_time}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate">{e.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
