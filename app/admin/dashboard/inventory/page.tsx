"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/supabase";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<InventoryItem>>>({});

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    const { data } = await supabase.from("inventory").select("*").order("product_name");
    setItems(data ?? []);
    setLoading(false);
  }

  function edit(id: string, field: string, value: string | number | boolean) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function getValue<K extends keyof InventoryItem>(item: InventoryItem, field: K): InventoryItem[K] {
    return (edits[item.id]?.[field] ?? item[field]) as InventoryItem[K];
  }

  async function save(item: InventoryItem) {
    const patch = edits[item.id];
    if (!patch) return;
    setSaving(item.id);
    await supabase.from("inventory").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", item.id);
    await fetchInventory();
    setEdits((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    setSaving(null);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Inventory</h1>
        <p className="text-slate-500 text-sm mt-1">Manage product prices, stock and availability</p>
      </div>

      {loading ? (
        <div className="text-center text-slate-600 py-20">Loading inventory...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-slate-600 py-20 bg-slate-900/40 rounded-xl border border-slate-800">
          <span className="material-symbols-outlined text-4xl mb-3 block text-slate-700">inventory_2</span>
          No inventory found. Run the SQL setup in Supabase first.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const stock = Number(getValue(item, "stock_kg"));
            const available = Boolean(getValue(item, "available"));
            const isDirty = !!edits[item.id];
            const isLow = stock < 10;

            return (
              <div key={item.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-white text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {item.product_name}
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5 font-mono">{item.product_id}</p>
                  </div>
                  {/* Availability toggle */}
                  <button
                    onClick={() => edit(item.id, "available", !available)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                      available
                        ? "bg-green-500/15 text-green-400 border-green-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{available ? "check_circle" : "cancel"}</span>
                    {available ? "Available" : "Out of Stock"}
                  </button>
                </div>

                {/* Low stock alert */}
                {isLow && (
                  <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    Low stock — only {stock} kg remaining
                  </div>
                )}

                {/* Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 uppercase tracking-widest mb-1.5">Price / Kg (₹)</label>
                    <input
                      type="number"
                      value={String(getValue(item, "price_per_kg"))}
                      onChange={(e) => edit(item.id, "price_per_kg", Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 uppercase tracking-widest mb-1.5">Stock (Kg)</label>
                    <input
                      type="number"
                      value={String(getValue(item, "stock_kg"))}
                      onChange={(e) => edit(item.id, "stock_kg", Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Save */}
                <button
                  disabled={!isDirty || saving === item.id}
                  onClick={() => save(item)}
                  className="w-full py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
                >
                  {saving === item.id ? (
                    <><span className="material-symbols-outlined text-sm animate-spin">refresh</span>Saving...</>
                  ) : (
                    <><span className="material-symbols-outlined text-sm">save</span>Save Changes</>
                  )}
                </button>

                <p className="text-xs text-slate-700 text-right">
                  Updated {new Date(item.updated_at).toLocaleString("en-IN")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
