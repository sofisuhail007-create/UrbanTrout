"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase, type EnergyLogEntry } from "@/lib/supabase";

const SUB_NAV = [
  { href: "/admin/dashboard/farm", label: "Water Parameters", icon: "water_drop" },
  { href: "/admin/dashboard/farm/feed-log", label: "Feed Log", icon: "restaurant" },
  { href: "/admin/dashboard/farm/tanks", label: "Tanks", icon: "set_meal" },
  { href: "/admin/dashboard/farm/yield", label: "Yield & Costs", icon: "monitoring" },
  { href: "/admin/dashboard/farm/energy", label: "Energy Log", icon: "bolt" },
];

const today = () => new Date().toISOString().split("T")[0];

export default function EnergyLogPage() {
  const pathname = usePathname();
  const [entries, setEntries] = useState<EnergyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: today(),
    expense_type: "Diesel",
    quantity: "",
    total_cost: "",
    notes: "",
  });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("energy_log")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    setEntries((data as EnergyLogEntry[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await supabase.from("energy_log").insert({
      date: form.date,
      expense_type: form.expense_type,
      quantity: parseFloat(form.quantity) || 0,
      total_cost: parseFloat(form.total_cost) || 0,
      notes: form.notes || null,
    });
    setForm({ ...form, quantity: "", total_cost: "", notes: "" });
    await fetchEntries();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this energy log?")) return;
    await supabase.from("energy_log").delete().eq("id", id);
    await fetchEntries();
  };

  const handleExport = async () => {
    const XLSX = await import("xlsx");
    if (entries.length === 0) return alert("No energy data to export.");

    const rows = entries.map((r) => ({
      Date: r.date,
      Type: r.expense_type,
      "Quantity (Liters or kWh)": r.quantity,
      "Total Cost (₹)": r.total_cost,
      Notes: r.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Energy Log");
    XLSX.writeFile(wb, `energy_log_${today()}.xlsx`);
  };

  // Summary logic for current month
  const currentMonth = today().substring(0, 7); // YYYY-MM
  const monthEntries = entries.filter((e) => e.date.startsWith(currentMonth));
  
  const totalDieselCost = monthEntries
    .filter(e => e.expense_type === 'Diesel')
    .reduce((sum, e) => sum + e.total_cost, 0);
    
  const totalElecCost = monthEntries
    .filter(e => e.expense_type === 'Electricity')
    .reduce((sum, e) => sum + e.total_cost, 0);

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Sub Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4 overflow-x-auto">
        {SUB_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap ${
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
            Energy & Utilities Log
          </h1>
          <p className="text-sm text-slate-400 mt-1">Track farm-wide diesel and electricity expenses</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-lg text-sm font-semibold hover:bg-emerald-500/25 transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export All (Excel)
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 relative overflow-hidden flex items-center justify-between">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-amber-500 text-[14px]">local_gas_station</span>
              Diesel Cost (This Month)
            </p>
            <p className="text-3xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              ₹{totalDieselCost.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 relative overflow-hidden flex items-center justify-between">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-blue-500 text-[14px]">bolt</span>
              Electricity Cost (This Month)
            </p>
            <p className="text-3xl font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              ₹{totalElecCost.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Entry Form */}
      <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
          Log Expense
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Type</label>
            <select
              value={form.expense_type}
              onChange={(e) => setForm({ ...form, expense_type: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="Diesel">Diesel</option>
              <option value="Electricity">Electricity</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {form.expense_type === "Diesel" ? "Quantity (Liters)" : "Quantity (kWh/Units)"}
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 50"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Total Cost (₹)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 4500"
              value={form.total_cost}
              onChange={(e) => setForm({ ...form, total_cost: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              required
            />
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
          {saving ? "Saving..." : "Log Expense"}
        </button>
      </form>

      {/* History Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Expense History
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-center px-4 py-3">Quantity</th>
                <th className="text-center px-4 py-3">Total Cost (₹)</th>
                <th className="text-left px-4 py-3">Notes</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">No logs found.</td></tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{e.date}</td>
                    <td className="px-4 py-3 font-semibold flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${e.expense_type === 'Diesel' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <span className={e.expense_type === 'Diesel' ? 'text-amber-400' : 'text-blue-400'}>
                        {e.expense_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300">
                      {e.quantity} <span className="text-[10px] text-slate-500">{e.expense_type === 'Diesel' ? 'L' : 'kWh'}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-200 font-bold">₹{e.total_cost.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[150px] truncate">{e.notes || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all" title="Delete">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
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
