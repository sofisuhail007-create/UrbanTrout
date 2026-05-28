"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type TankStocking } from "@/lib/supabase";

const TANKS = ["tank_a", "tank_b", "tank_c", "tank_d"];
const TANK_LABELS: Record<string, string> = {
  tank_a: "Tank A",
  tank_b: "Tank B",
  tank_c: "Tank C",
  tank_d: "Tank D",
};
const TANK_COLORS: Record<string, string> = {
  tank_a: "#22d3ee",
  tank_b: "#a78bfa",
  tank_c: "#34d399",
  tank_d: "#fb923c",
};

const SUB_NAV = [
  { href: "/admin/dashboard/farm", label: "Water Parameters", icon: "water_drop" },
  { href: "/admin/dashboard/farm/feed-log", label: "Feed Log", icon: "restaurant" },
  { href: "/admin/dashboard/farm/tanks", label: "Tanks", icon: "set_meal" },
  { href: "/admin/dashboard/farm/yield", label: "Yield & Costs", icon: "monitoring" },
];

export default function TanksPage() {
  const pathname = usePathname();
  const [stockings, setStockings] = useState<TankStocking[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    tank_id: "tank_a",
    stocking_date: new Date().toISOString().split("T")[0],
    fish_count: "",
    avg_size_grams: "",
    current_avg_size_grams: "",
    feed_percentage: "",
    fingerling_cost: "",
    feed_cost_per_kg: "",
    batch_name: "",
    notes: "",
  });

  const fetchStockings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tank_stocking")
      .select("*")
      .order("stocking_date", { ascending: false });
    setStockings((data as TankStocking[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStockings();
  }, [fetchStockings]);

  const resetForm = () => {
    setForm({ tank_id: "tank_a", stocking_date: new Date().toISOString().split("T")[0], fish_count: "", avg_size_grams: "", current_avg_size_grams: "", feed_percentage: "", fingerling_cost: "", feed_cost_per_kg: "", batch_name: "", notes: "" });
    setEditId(null);
  };

  const startEdit = (s: TankStocking) => {
    setForm({
      tank_id: s.tank_id,
      stocking_date: s.stocking_date,
      fish_count: String(s.fish_count),
      avg_size_grams: String(s.avg_size_grams),
      current_avg_size_grams: String(s.current_avg_size_grams),
      feed_percentage: String(s.feed_percentage),
      fingerling_cost: String(s.fingerling_cost),
      feed_cost_per_kg: String(s.feed_cost_per_kg),
      batch_name: s.batch_name,
      notes: s.notes || "",
    });
    setEditId(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this stocking record?")) return;
    await supabase.from("tank_stocking").delete().eq("id", id);
    await fetchStockings();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      tank_id: form.tank_id,
      stocking_date: form.stocking_date,
      fish_count: parseInt(form.fish_count) || 0,
      avg_size_grams: parseFloat(form.avg_size_grams) || 0,
      current_avg_size_grams: parseFloat(form.current_avg_size_grams || form.avg_size_grams) || 0,
      feed_percentage: parseFloat(form.feed_percentage) || 0,
      fingerling_cost: parseFloat(form.fingerling_cost) || 0,
      feed_cost_per_kg: parseFloat(form.feed_cost_per_kg) || 0,
      batch_name: form.batch_name,
      notes: form.notes || null,
    };
    if (editId) {
      await supabase.from("tank_stocking").update(payload).eq("id", editId);
    } else {
      await supabase.from("tank_stocking").insert({ ...payload, mortality_count: 0, status: "active" });
    }
    resetForm();
    setShowForm(false);
    await fetchStockings();
    setSaving(false);
  };

  const handleUpdate = async (id: string, field: string, value: string | number) => {
    await supabase.from("tank_stocking").update({ [field]: value }).eq("id", id);
    await fetchStockings();
  };

  const handleExport = async () => {
    const XLSX = await import("xlsx");
    const { data } = await supabase.from("tank_stocking").select("*").order("stocking_date", { ascending: true });
    if (!data || data.length === 0) return alert("No stocking data.");
    const rows = data.map((r: TankStocking) => ({
      Tank: TANK_LABELS[r.tank_id] || r.tank_id,
      "Batch Name": r.batch_name,
      "Stocking Date": r.stocking_date,
      "Fish Count": r.fish_count,
      "Avg Size (g)": r.avg_size_grams,
      "Current Avg Size (g)": r.current_avg_size_grams,
      "Mortality": r.mortality_count,
      "Alive Count": r.fish_count - r.mortality_count,
      "Feed %": r.feed_percentage,
      "Fingerling Cost": r.fingerling_cost,
      "Feed Cost/Kg": r.feed_cost_per_kg,
      "Harvest Kg": r.total_harvest_kg || "-",
      "Harvest Date": r.harvest_date || "-",
      Status: r.status,
      Notes: r.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tank Stocking");
    XLSX.writeFile(wb, `tank_stocking_records.xlsx`);
  };

  // Get active stocking per tank for cards
  const activePer = TANKS.map(
    (t) => stockings.find((s) => s.tank_id === t && s.status === "active") || null
  );

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
            Tank Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">Stocking records, fish size tracking & mortality</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/25 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export (Excel)
          </button>
          <button
            onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-semibold hover:bg-cyan-500/30 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">{showForm ? "close" : "add"}</span>
            {showForm ? "Cancel" : "New Stocking"}
          </button>
        </div>
      </div>

      {/* New Stocking Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-cyan-500/20 rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            {editId ? "Edit Stocking Record" : "Record New Stocking"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Tank</label>
              <select value={form.tank_id} onChange={(e) => setForm({ ...form, tank_id: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none">
                {TANKS.map((t) => (<option key={t} value={t}>{TANK_LABELS[t]}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Stocking Date</label>
              <input type="date" value={form.stocking_date} onChange={(e) => setForm({ ...form, stocking_date: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Fish Count</label>
              <input type="number" placeholder="e.g. 500" value={form.fish_count} onChange={(e) => setForm({ ...form, fish_count: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Avg Size (grams)</label>
              <input type="number" step="0.1" placeholder="e.g. 50" value={form.avg_size_grams} onChange={(e) => setForm({ ...form, avg_size_grams: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Daily Feed % (Body Wt)</label>
              <input type="number" step="0.1" placeholder="e.g. 3.0" value={form.feed_percentage} onChange={(e) => setForm({ ...form, feed_percentage: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Fingerling Cost (₹)</label>
              <input type="number" placeholder="e.g. 15000" value={form.fingerling_cost} onChange={(e) => setForm({ ...form, fingerling_cost: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Feed Cost/Kg (₹)</label>
              <input type="number" placeholder="e.g. 120" value={form.feed_cost_per_kg} onChange={(e) => setForm({ ...form, feed_cost_per_kg: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Batch Name</label>
              <input type="text" placeholder="e.g. Batch 2026-Q2" value={form.batch_name} onChange={(e) => setForm({ ...form, batch_name: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
            <div className="col-span-2 md:col-span-4 space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Notes</label>
              <input type="text" placeholder="Optional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-6 py-3 bg-cyan-500/20 text-cyan-400 font-bold text-sm rounded-lg hover:bg-cyan-500/30 transition-all disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">{saving ? "hourglass_empty" : "save"}</span>
            {saving ? "Saving..." : editId ? "Update Record" : "Save Stocking Record"}
          </button>
        </form>
      )}

      {/* Tank Flash Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {TANKS.map((tankId, idx) => {
          const s = activePer[idx];
          const color = TANK_COLORS[tankId];
          const alive = s ? s.fish_count - s.mortality_count : 0;
          const mortalityPct = s && s.fish_count > 0 ? ((s.mortality_count / s.fish_count) * 100).toFixed(1) : "0";
          const totalBiomass = s ? (alive * s.current_avg_size_grams) / 1000 : 0; // in Kg
          const dailyFeed = s ? (totalBiomass * s.feed_percentage) / 100 : 0; // in Kg
          const daysSinceStocking = s
            ? Math.floor((Date.now() - new Date(s.stocking_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return (
            <div
              key={tankId}
              className="bg-slate-900/80 border rounded-2xl p-6 space-y-4 relative overflow-hidden"
              style={{ borderColor: `${color}30` }}
            >
              {/* Decorative glow */}
              <div
                className="absolute -right-8 -top-8 w-32 h-32 rounded-full blur-[60px] opacity-20"
                style={{ background: color }}
              />

              {/* Header */}
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                    <span className="material-symbols-outlined" style={{ color, fontSize: "20px" }}>set_meal</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {TANK_LABELS[tankId]}
                    </h3>
                    {s && (
                      <p className="text-[10px] text-slate-500">{s.batch_name || "No batch"}</p>
                    )}
                  </div>
                </div>
                {s && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: s.status === "active" ? "#22c55e20" : s.status === "harvested" ? "#eab30820" : "#94a3b820",
                      color: s.status === "active" ? "#22c55e" : s.status === "harvested" ? "#eab308" : "#94a3b8",
                    }}
                  >
                    {s.status}
                  </span>
                )}
              </div>

              {s ? (
                <div className="relative z-10 space-y-3">
                  {/* Main Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">🐟 Alive</p>
                      <p className="text-xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        {alive.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">📏 Avg Size</p>
                      <p className="text-xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        {s.current_avg_size_grams}g
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">📊 Feed/Day</p>
                      <p className="text-lg font-bold" style={{ color, fontFamily: '"Space Grotesk", sans-serif' }}>
                        {dailyFeed.toFixed(2)} Kg
                      </p>
                    </div>
                    <div className="bg-slate-800/60 rounded-lg p-3">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">💀 Mortality</p>
                      <p className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        {s.mortality_count}
                        <span className="text-xs text-slate-500 ml-1">({mortalityPct}%)</span>
                      </p>
                    </div>
                  </div>

                  {/* Info Line */}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                    <span>📅 Stocked: {s.stocking_date}</span>
                    <span>{daysSinceStocking}d ago</span>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const val = prompt("Enter new current avg size (grams):", String(s.current_avg_size_grams));
                        if (val) handleUpdate(s.id, "current_avg_size_grams", parseFloat(val));
                      }}
                      className="flex-1 text-[10px] py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all font-semibold uppercase tracking-wider"
                    >
                      Update Size
                    </button>
                    <button
                      onClick={() => {
                        const val = prompt("Enter total mortality count:", String(s.mortality_count));
                        if (val) handleUpdate(s.id, "mortality_count", parseInt(val));
                      }}
                      className="flex-1 text-[10px] py-1.5 bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-all font-semibold uppercase tracking-wider"
                    >
                      Log Mortality
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const val = prompt("New feed % of body weight:", String(s.feed_percentage));
                        if (val) handleUpdate(s.id, "feed_percentage", parseFloat(val));
                      }}
                      className="flex-1 text-[10px] py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all font-semibold uppercase tracking-wider"
                    >
                      Update Feed %
                    </button>
                    <button
                      onClick={async () => {
                        const val = prompt(`Mark ${TANK_LABELS[tankId]} as harvested? Enter final harvest weight (Kg):`);
                        if (val && !isNaN(parseFloat(val))) {
                          await supabase.from("tank_stocking").update({
                            status: "harvested",
                            total_harvest_kg: parseFloat(val),
                            harvest_date: new Date().toISOString().split("T")[0],
                          }).eq("id", s.id);
                          fetchStockings();
                        }
                      }}
                      className="flex-1 text-[10px] py-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded-lg transition-all font-semibold uppercase tracking-wider"
                    >
                      Harvest
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(s)}
                      className="flex-1 text-[10px] py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-all font-semibold uppercase tracking-wider"
                    >
                      ✏️ Edit All
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="flex-1 text-[10px] py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all font-semibold uppercase tracking-wider"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex flex-col items-center py-6 text-slate-600">
                  <span className="material-symbols-outlined text-3xl mb-2">add_circle_outline</span>
                  <p className="text-xs">No active stocking</p>
                  <button
                    onClick={() => {
                      setForm({ ...form, tank_id: tankId });
                      setShowForm(true);
                    }}
                    className="mt-3 text-[10px] px-3 py-1.5 bg-slate-800 text-cyan-400 rounded-lg hover:bg-slate-700 transition-all font-semibold uppercase tracking-wider"
                  >
                    Add Stocking
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All Stocking Records Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            All Stocking Records
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-3">Tank</th>
                <th className="text-left px-4 py-3">Batch</th>
                <th className="text-left px-4 py-3">Stocked</th>
                <th className="text-center px-4 py-3">Fish Count</th>
                <th className="text-center px-4 py-3">Init Size (g)</th>
                <th className="text-center px-4 py-3">Curr Size (g)</th>
                <th className="text-center px-4 py-3">Mortality</th>
                <th className="text-center px-4 py-3">Alive</th>
                <th className="text-center px-4 py-3">Feed %</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : stockings.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-600">No stocking records yet.</td></tr>
              ) : (
                stockings.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-semibold" style={{ color: TANK_COLORS[s.tank_id] }}>{TANK_LABELS[s.tank_id]}</td>
                    <td className="px-4 py-3 text-slate-300">{s.batch_name}</td>
                    <td className="px-4 py-3 text-slate-400">{s.stocking_date}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{s.fish_count}</td>
                    <td className="px-4 py-3 text-center text-slate-400">{s.avg_size_grams}g</td>
                    <td className="px-4 py-3 text-center text-slate-200 font-semibold">{s.current_avg_size_grams}g</td>
                    <td className="px-4 py-3 text-center text-red-400">{s.mortality_count}</td>
                    <td className="px-4 py-3 text-center text-emerald-400 font-semibold">{s.fish_count - s.mortality_count}</td>
                    <td className="px-4 py-3 text-center text-cyan-400">{s.feed_percentage}%</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: s.status === "active" ? "#22c55e20" : s.status === "harvested" ? "#eab30820" : "#94a3b820",
                          color: s.status === "active" ? "#22c55e" : s.status === "harvested" ? "#eab308" : "#94a3b8",
                        }}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => startEdit(s)} className="p-1 rounded hover:bg-cyan-500/20 text-slate-500 hover:text-cyan-400 transition-all" title="Edit">
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all" title="Delete">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
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
