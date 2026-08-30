"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/supabase";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<InventoryItem>>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    product_name: "",
    product_id: "",
    price_per_kg: 550,
    original_price_per_kg: 650,
    min_order_kg: 2,
    stock_kg: 50,
    available: true,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    const { data } = await supabase.from("inventory").select("*").order("product_name");
    if (data) {
      const itemsWithDefaults = data.map((item) => ({
        ...item,
        original_price_per_kg:
          item.original_price_per_kg || (item.product_id === "gutted-trout" ? 650 : item.product_id === "whole-trout" ? 600 : Math.round(item.price_per_kg * 1.2)),
        min_order_kg: item.min_order_kg || 2,
      }));
      setItems(itemsWithDefaults);
    }
    setLoading(false);
  }

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
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

    try {
      // First try updating all fields including original_price_per_kg
      const { error: fullUpdateErr } = await supabase
        .from("inventory")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", item.id);

      if (fullUpdateErr) {
        // If column original_price_per_kg does not exist in schema, omit it from DB patch
        const safePatch: any = { ...patch };
        delete safePatch.original_price_per_kg;

        const { error: safeErr } = await supabase
          .from("inventory")
          .update({ ...safePatch, updated_at: new Date().toISOString() })
          .eq("id", item.id);

        if (safeErr) throw safeErr;
        showToast("Prices and stock updated in inventory! (Run SQL migration for DB MRP column)", "success");
      } else {
        showToast("Inventory & pricing rules saved successfully!", "success");
      }

      await fetchInventory();
      setEdits((prev) => {
        const n = { ...prev };
        delete n[item.id];
        return n;
      });
    } catch (err: any) {
      showToast("Error updating inventory: " + (err.message || "Unknown error"), "error");
    } finally {
      setSaving(null);
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProduct.product_name.trim() || !newProduct.product_id.trim()) {
      showToast("Please provide product name and URL slug / ID", "error");
      return;
    }

    setCreating(true);
    const slug = newProduct.product_id.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    try {
      const payload: any = {
        product_name: newProduct.product_name.trim(),
        product_id: slug,
        price_per_kg: Number(newProduct.price_per_kg),
        min_order_kg: Number(newProduct.min_order_kg),
        stock_kg: Number(newProduct.stock_kg),
        available: Boolean(newProduct.available),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("inventory").insert([payload]);
      if (error) throw error;

      showToast(`Product "${newProduct.product_name}" added to inventory!`, "success");
      setShowAddModal(false);
      setNewProduct({
        product_name: "",
        product_id: "",
        price_per_kg: 550,
        original_price_per_kg: 650,
        min_order_kg: 2,
        stock_kg: 50,
        available: true,
      });
      await fetchInventory();
    } catch (err: any) {
      showToast("Could not add product: " + (err.message || "Unknown error"), "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border text-sm font-semibold flex items-center gap-2 shadow-2xl transition-all ${
            toastMsg.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300"
              : "bg-red-950/90 border-red-500/50 text-red-300"
          }`}
        >
          <span>{toastMsg.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📦</span>
            <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Inventory &amp; Pricing Management
            </h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Configure offered selling prices, original strikethrough prices (MRP), minimum order quantities, and stock.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
        >
          <span className="text-base font-black">+</span> Add Product
        </button>
      </div>

      {/* Inventory Cards Grid */}
      {loading ? (
        <div className="text-center text-slate-500 py-20">Loading inventory catalog...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-slate-500 py-20 bg-slate-900/40 rounded-2xl border border-slate-800 p-8 space-y-3">
          <span className="material-symbols-outlined text-5xl text-slate-600 block">inventory_2</span>
          <h3 className="text-lg font-bold text-slate-300">No inventory products found</h3>
          <p className="text-sm text-slate-500">Click &quot;Add Product&quot; to initialize your catalog.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map((item) => {
            const price = Number(getValue(item, "price_per_kg")) || 0;
            const originalPrice = Number(getValue(item, "original_price_per_kg")) || 0;
            const minOrder = Number(getValue(item, "min_order_kg")) || 1;
            const stock = Number(getValue(item, "stock_kg")) || 0;
            const available = Boolean(getValue(item, "available"));
            const isDirty = !!edits[item.id];
            const isLow = stock < 10;

            const hasDiscount = originalPrice > price;
            const discountAmount = hasDiscount ? originalPrice - price : 0;
            const discountPercent = hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

            return (
              <div
                key={item.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-xl transition-all"
              >
                {/* Product Header & Availability */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-white text-base tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {item.product_name}
                    </h2>
                    <span className="text-xs text-cyan-400/80 font-mono bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50 mt-1 inline-block">
                      {item.product_id}
                    </span>
                  </div>

                  {/* Availability Toggle */}
                  <button
                    type="button"
                    onClick={() => edit(item.id, "available", !available)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-bold transition-all cursor-pointer ${
                      available
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                    {available ? "In Stock" : "Out of Stock"}
                  </button>
                </div>

                {/* Live Customer Preview Pill */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                    👁️ Customer Display Preview
                  </span>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-black text-cyan-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        ₹{price}/kg
                      </span>
                      {hasDiscount && (
                        <span className="line-through text-slate-500 text-xs font-semibold" style={{ textDecorationColor: "#ef4444" }}>
                          ₹{originalPrice}
                        </span>
                      )}
                      {hasDiscount && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Save ₹{discountAmount} ({discountPercent}% OFF)
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      MIN. {minOrder} KG
                    </span>
                  </div>
                </div>

                {/* Stock Warning */}
                {isLow && available && (
                  <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <span>⚠️</span> Low stock alert: only {stock} kg remaining
                  </div>
                )}

                {/* Editable Fields Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] text-cyan-400 uppercase tracking-wider mb-1 font-bold">
                      Offered Price (₹)
                    </label>
                    <input
                      type="number"
                      value={String(price)}
                      onChange={(e) => edit(item.id, "price_per_kg", Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">
                      Original / MRP (₹)
                    </label>
                    <input
                      type="number"
                      value={String(originalPrice)}
                      onChange={(e) => edit(item.id, "original_price_per_kg", Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-300 text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-emerald-400 uppercase tracking-wider mb-1 font-bold">
                      Min Order (Kg)
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={String(minOrder)}
                      onChange={(e) => edit(item.id, "min_order_kg", Math.max(0.5, Number(e.target.value)))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">
                      Stock (Kg)
                    </label>
                    <input
                      type="number"
                      value={String(stock)}
                      onChange={(e) => edit(item.id, "stock_kg", Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <button
                  disabled={!isDirty || saving === item.id}
                  onClick={() => save(item)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {saving === item.id ? (
                    <>
                      <span className="animate-spin text-sm">⏳</span> Saving Changes...
                    </>
                  ) : (
                    <>
                      <span>💾</span> {isDirty ? "Save Updates" : "Saved"}
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-600 text-right">
                  Last updated: {new Date(item.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })},{" "}
                  {new Date(item.updated_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Add New Inventory Product
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Smoked Himalayan Trout"
                  value={newProduct.product_name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    setNewProduct((p) => ({ ...p, product_name: name, product_id: p.product_id || slug }));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Product ID / URL Slug
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. smoked-trout"
                  value={newProduct.product_id}
                  onChange={(e) => setNewProduct((p) => ({ ...p, product_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-cyan-300 text-sm font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                    Offered Price (₹/kg)
                  </label>
                  <input
                    type="number"
                    required
                    value={newProduct.price_per_kg}
                    onChange={(e) => setNewProduct((p) => ({ ...p, price_per_kg: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Original Price (₹/kg)
                  </label>
                  <input
                    type="number"
                    value={newProduct.original_price_per_kg}
                    onChange={(e) => setNewProduct((p) => ({ ...p, original_price_per_kg: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-300 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    Min Order (Kg)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={newProduct.min_order_kg}
                    onChange={(e) => setNewProduct((p) => ({ ...p, min_order_kg: Math.max(0.5, Number(e.target.value)) }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Initial Stock (Kg)
                  </label>
                  <input
                    type="number"
                    value={newProduct.stock_kg}
                    onChange={(e) => setNewProduct((p) => ({ ...p, stock_kg: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold uppercase tracking-wider hover:bg-cyan-400 transition-all cursor-pointer disabled:opacity-50"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {creating ? "Adding..." : "Add to Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
