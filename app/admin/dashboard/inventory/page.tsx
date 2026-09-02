"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/supabase";

interface FullInventoryItem extends InventoryItem {
  image_url?: string;
  label?: string;
  description?: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<FullInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<FullInventoryItem>>>({});
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
    image_url: "",
    label: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    const { data: invData } = await supabase.from("inventory").select("*").order("product_name");
    const { data: metaRows } = await supabase.from("app_settings").select("*").like("key", "product_meta_%");

    const metaMap: Record<string, any> = {};
    (metaRows || []).forEach((r) => {
      try {
        metaMap[r.key.replace("product_meta_", "")] = JSON.parse(r.value);
      } catch (e) {}
    });

    const PRODUCT_META_DEFAULTS: Record<string, any> = {
      "gutted-trout": {
        img: "/images/gutted_trout_premium.png",
        label: "CLEANED & GUTTED",
        desc: "Expertly cleaned, gutted, and ready to cook. Harvested fresh to order and chilled for delivery.",
        originalPrice: 650,
      },
      "whole-trout": {
        img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6az_W5rdEt8WkOzLnn861EIuB2tv1E9ZBuYuxXAnLFmG7ZsCCb0WyuI___JpO7YjI9Vf_XYBLXYanCVvdJyrbf-CarB6-5xxisc34AV5zB1gV5AElNc-POwd_DAA12ADx0vUX87WKN2GVXZapRsMugASCSZsBjri-8d9uI957NqfLv1Hau8-DgJfLrNJoRtSKwJo6uFM1V-GDVCSznDSww8vBl8jD_s-iPkmhUcOhQ6ekndTbbBSJCBon4pCpkvihVwAcuF4JCTVc",
        label: "WHOLE FRESH FISH",
        desc: "Fresh whole trout straight from our farm. Ideal for pan-frying, roasting, grilling, or curries.",
        originalPrice: 600,
      },
    };

    if (invData) {
      const itemsWithDefaults = invData.map((item) => {
        const hardcoded = PRODUCT_META_DEFAULTS[item.product_id] || {};
        const saved = metaMap[item.product_id] || {};
        return {
          ...item,
          image_url: saved.image_url || (item as any).image_url || hardcoded.img || "/images/gutted_trout_premium.png",
          label: saved.label || (item as any).label || hardcoded.label || "FARM FRESH",
          description: saved.description || (item as any).description || hardcoded.desc || "Fresh premium farm trout harvested to order.",
          original_price_per_kg:
            item.original_price_per_kg ||
            saved.original_price_per_kg ||
            hardcoded.originalPrice ||
            Math.round(item.price_per_kg * 1.2),
          min_order_kg: item.min_order_kg || saved.min_order_kg || 1,
        };
      });
      setItems(itemsWithDefaults as FullInventoryItem[]);
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

  function getValue<K extends keyof FullInventoryItem>(item: FullInventoryItem, field: K): FullInventoryItem[K] {
    return (edits[item.id]?.[field] ?? item[field]) as FullInventoryItem[K];
  }

  async function save(item: FullInventoryItem) {
    const patch = edits[item.id];
    if (!patch) return;
    setSaving(item.id);

    try {
      // 1. Update core inventory fields
      const corePatch: any = {
        updated_at: new Date().toISOString(),
      };
      if ("price_per_kg" in patch) corePatch.price_per_kg = Number(patch.price_per_kg);
      if ("min_order_kg" in patch) corePatch.min_order_kg = Number(patch.min_order_kg);
      if ("stock_kg" in patch) corePatch.stock_kg = Number(patch.stock_kg);
      if ("available" in patch) corePatch.available = Boolean(patch.available);
      if ("product_name" in patch) corePatch.product_name = String(patch.product_name);

      const { error: invErr } = await supabase
        .from("inventory")
        .update(corePatch)
        .eq("id", item.id);
      if (invErr) throw invErr;

      // 2. Save metadata to app_settings
      const currentMeta = {
        image_url: patch.image_url !== undefined ? patch.image_url : item.image_url,
        label: patch.label !== undefined ? patch.label : item.label,
        description: patch.description !== undefined ? patch.description : item.description,
        original_price_per_kg: patch.original_price_per_kg !== undefined ? Number(patch.original_price_per_kg) : item.original_price_per_kg,
        min_order_kg: patch.min_order_kg !== undefined ? Number(patch.min_order_kg) : item.min_order_kg,
      };

      await supabase.from("app_settings").upsert({
        key: `product_meta_${item.product_id}`,
        value: JSON.stringify(currentMeta),
        description: `Product metadata for ${item.product_id}`,
        updated_at: new Date().toISOString(),
      });

      showToast("Inventory & product details saved!", "success");
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
      // 1. Insert core record to inventory
      const corePayload: any = {
        product_name: newProduct.product_name.trim(),
        product_id: slug,
        price_per_kg: Number(newProduct.price_per_kg),
        min_order_kg: Number(newProduct.min_order_kg),
        stock_kg: Number(newProduct.stock_kg),
        available: Boolean(newProduct.available),
        updated_at: new Date().toISOString(),
      };

      const { error: invErr } = await supabase.from("inventory").insert([corePayload]);
      if (invErr) throw invErr;

      // 2. Save metadata to app_settings
      const meta = {
        image_url: newProduct.image_url.trim() || "/images/gutted_trout_premium.png",
        label: newProduct.label.trim() || "FRESH HARVEST",
        description: newProduct.description.trim() || "Fresh premium farm trout harvested to order.",
        original_price_per_kg: Number(newProduct.original_price_per_kg) || Math.round(Number(newProduct.price_per_kg) * 1.2),
        min_order_kg: Number(newProduct.min_order_kg) || 1,
      };

      await supabase.from("app_settings").upsert({
        key: `product_meta_${slug}`,
        value: JSON.stringify(meta),
        description: `Product metadata for ${slug}`,
        updated_at: new Date().toISOString(),
      });

      showToast(`Product "${newProduct.product_name}" added and live in shop!`, "success");
      setShowAddModal(false);
      setNewProduct({
        product_name: "",
        product_id: "",
        price_per_kg: 550,
        original_price_per_kg: 650,
        min_order_kg: 2,
        stock_kg: 50,
        available: true,
        image_url: "",
        label: "",
        description: "",
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
              Inventory &amp; Product Management
            </h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Configure offered selling prices, MRP, minimum orders, stock, photos, badges, and descriptions for the shop.
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
          <span className="text-5xl block">📦</span>
          <h3 className="text-lg font-bold text-slate-300">No inventory products found</h3>
          <p className="text-sm text-slate-500">Click &quot;Add Product&quot; to initialize your catalog.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {items.map((item) => {
            const price = Number(getValue(item, "price_per_kg")) || 0;
            const originalPrice = Number(getValue(item, "original_price_per_kg")) || 0;
            const minOrder = Number(getValue(item, "min_order_kg")) || 1;
            const stock = Number(getValue(item, "stock_kg")) || 0;
            const available = Boolean(getValue(item, "available"));
            const imageUrl = String(getValue(item, "image_url") || "/images/gutted_trout_premium.png");
            const label = String(getValue(item, "label") || "FARM FRESH");
            const description = String(getValue(item, "description") || "");
            const isDirty = !!edits[item.id];
            const isLow = stock < 10;

            const hasDiscount = originalPrice > price;
            const discountAmount = hasDiscount ? originalPrice - price : 0;
            const discountPercent = hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

            return (
              <div
                key={item.id}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-xl transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Product Header, Thumbnail & Availability */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0 relative">
                      <img src={imageUrl} alt={item.product_name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="font-bold text-white text-base tracking-tight truncate" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                            {item.product_name}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-cyan-400/80 font-mono bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50 inline-block">
                              {item.product_id}
                            </span>
                            <Link
                              href={`/shop/${item.product_id}`}
                              target="_blank"
                              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-0.5"
                            >
                              Live Page ↗
                            </Link>
                          </div>
                        </div>

                        {/* Availability Toggle */}
                        <button
                          type="button"
                          onClick={() => edit(item.id, "available", !available)}
                          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-bold transition-all cursor-pointer flex-shrink-0 ${
                            available
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-red-500/15 text-red-400 border-red-500/30"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          {available ? "In Stock" : "Out of Stock"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Customer Preview Pill */}
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
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          MIN. {minOrder} KG
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock Warning */}
                  {isLow && available && (
                    <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      <span>⚠️</span> Low stock alert: only {stock} kg remaining
                    </div>
                  )}

                  {/* Numeric Inputs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] text-cyan-400 uppercase tracking-wider mb-1 font-bold">
                        Offered (₹)
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
                        MRP (₹)
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
                        Min (Kg)
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

                  {/* Photo & Badge Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">
                        Badge Label
                      </label>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => edit(item.id, "label", e.target.value)}
                        placeholder="e.g. CLEANED & GUTTED"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">
                        Image URL
                      </label>
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => edit(item.id, "image_url", e.target.value)}
                        placeholder="https://... or /images/..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-bold">
                      Product Description
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => edit(item.id, "description", e.target.value)}
                      placeholder="Product details, flavor notes, preparation..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-2">
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
                  <p className="text-[10px] text-slate-600 text-right mt-1.5">
                    Last updated: {new Date(item.updated_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })},{" "}
                    {new Date(item.updated_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Add New Product to Shop
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Smoked Trout Fillets"
                    value={newProduct.product_name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                      setNewProduct((p) => ({ ...p, product_name: name, product_id: p.product_id || slug }));
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    URL Slug / ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. smoked-trout"
                    value={newProduct.product_id}
                    onChange={(e) => setNewProduct((p) => ({ ...p, product_id: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-cyan-300 text-sm font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FRESH HARVEST or SMOKED"
                    value={newProduct.label}
                    onChange={(e) => setNewProduct((p) => ({ ...p, label: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Image URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://... or /images/..."
                    value={newProduct.image_url}
                    onChange={(e) => setNewProduct((p) => ({ ...p, image_url: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {newProduct.image_url && (
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
                  <img src={newProduct.image_url} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                  <span className="text-xs text-slate-400 truncate">Image preview loaded</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Details about harvest, cut, cooking style..."
                  value={newProduct.description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
                    Offered Price (₹/kg) *
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
                    Original Price / MRP (₹/kg)
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
                    Min Order (Kg) *
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
                    Initial Stock (Kg) *
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
                  {creating ? "Adding..." : "Add to Inventory & Shop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
