"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Customer, Order } from "@/lib/supabase";

type CustomerWithNotes = Customer & { notes?: string | null };

function loyaltyTier(c: Customer): { label: string; color: string; bg: string; icon: string } {
  if (c.total_orders >= 5 || c.total_spent >= 5000) {
    return { label: "Premium", color: "#fbbf24", bg: "#fbbf2420", icon: "workspace_premium" };
  }
  if (c.total_orders >= 2) {
    return { label: "Regular", color: "#94a3b8", bg: "#94a3b820", icon: "verified_user" };
  }
  return { label: "New", color: "#22d3ee", bg: "#22d3ee20", icon: "fiber_new" };
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithNotes[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CustomerWithNotes | null>(null);
  const [search, setSearch] = useState("");
  const [noteValue, setNoteValue] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [filterInactive, setFilterInactive] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: o }] = await Promise.all([
        supabase.from("customers").select("*").order("last_order_at", { ascending: false, nullsFirst: false }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
      ]);
      setCustomers((c as CustomerWithNotes[]) ?? []);
      setOrders(o ?? []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (selected) {
      setNoteValue(selected.notes ?? "");
      setNoteSaved(false);
    }
  }, [selected]);

  const handleSaveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    await supabase.from("customers").update({ notes: noteValue }).eq("id", selected.id);
    setCustomers((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, notes: noteValue } : c))
    );
    setSelected((prev) => (prev ? { ...prev, notes: noteValue } : prev));
    setSavingNote(false);
    setNoteSaved(true);
  };

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.locality ?? "").toLowerCase().includes(search.toLowerCase());
    if (filterInactive) {
      const days = daysSince(c.last_order_at);
      return matchSearch && days !== null && days > 30;
    }
    return matchSearch;
  });

  const customerOrders = selected ? orders.filter((o) => o.customer_phone === selected.phone) : [];

  const inactiveCount = customers.filter((c) => {
    const days = daysSince(c.last_order_at);
    return days !== null && days > 30;
  }).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Customers
          </h1>
          <p className="text-slate-500 text-sm mt-1">{customers.length} registered customers</p>
        </div>
        {/* Tier legend */}
        <div className="flex items-center gap-3 text-xs">
          {[
            { label: "Premium", color: "#fbbf24", icon: "workspace_premium" },
            { label: "Regular", color: "#94a3b8", icon: "verified_user" },
            { label: "New", color: "#22d3ee", icon: "fiber_new" },
          ].map((t) => (
            <span key={t.label} className="flex items-center gap-1" style={{ color: t.color }}>
              <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Customer list */}
        <div className="lg:col-span-2 space-y-3">
          <input
            placeholder="Search by name, phone, area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
          />

          {/* Inactive filter */}
          {inactiveCount > 0 && (
            <button
              onClick={() => setFilterInactive((v) => !v)}
              className={`w-full flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                filterInactive
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">schedule</span>
              {filterInactive ? "Showing inactive only" : `${inactiveCount} customers inactive 30+ days`}
              {filterInactive && (
                <span className="ml-auto material-symbols-outlined text-[14px]">close</span>
              )}
            </button>
          )}

          {loading ? (
            <div className="text-slate-600 text-sm text-center py-10">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-10 bg-slate-900/40 rounded-xl border border-slate-800">
              No customers found.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => {
                const tier = loyaltyTier(c);
                const days = daysSince(c.last_order_at);
                const isInactive = days !== null && days > 30;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selected?.id === c.id
                        ? "bg-cyan-500/10 border-cyan-500/40"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm text-white">{c.name}</p>
                      <div className="flex items-center gap-1.5">
                        {/* Inactive pulse */}
                        {isInactive && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title={`No order in ${days} days`} />
                        )}
                        {/* Loyalty tier badge */}
                        <span
                          className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: tier.bg, color: tier.color }}
                        >
                          <span className="material-symbols-outlined text-[11px]">{tier.icon}</span>
                          {tier.label}
                        </span>
                        <span className="text-xs font-mono text-cyan-400">₹{c.total_spent?.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">+91 {c.phone}</p>
                    {c.locality && <p className="text-xs text-slate-600 mt-0.5">{c.locality}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-600">{c.total_orders} order{c.total_orders !== 1 ? "s" : ""}</span>
                      {c.last_order_at && (
                        <span className={`text-xs ${isInactive ? "text-amber-600" : "text-slate-700"}`}>
                          Last: {new Date(c.last_order_at).toLocaleDateString("en-IN")}
                          {isInactive && ` (${days}d ago)`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-slate-700 text-sm bg-slate-900/30 rounded-xl border border-slate-800 min-h-64">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl block mb-2 text-slate-800">person_search</span>
                Select a customer to view details
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {selected.name}
                    </h2>
                    {/* Loyalty tier badge */}
                    {(() => {
                      const tier = loyaltyTier(selected);
                      return (
                        <span
                          className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: tier.bg, color: tier.color }}
                        >
                          <span className="material-symbols-outlined text-[13px]">{tier.icon}</span>
                          {tier.label}
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-slate-500 text-sm">+91 {selected.phone}</p>
                  {selected.locality && (
                    <p className="text-slate-600 text-xs mt-0.5">{selected.locality}, {selected.pincode}</p>
                  )}
                  {/* Inactive warning */}
                  {(() => {
                    const days = daysSince(selected.last_order_at);
                    if (days !== null && days > 30) {
                      return (
                        <div className="flex items-center gap-1.5 mt-2 text-amber-400 text-xs">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          No order in {days} days — consider re-engagement
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <a
                  href={`https://wa.me/91${selected.phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium hover:bg-green-500/25 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">chat</span>
                  WhatsApp
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Orders", value: selected.total_orders },
                  { label: "Total Spent", value: `₹${selected.total_spent?.toLocaleString("en-IN")}` },
                  { label: "Member Since", value: new Date(selected.created_at).toLocaleDateString("en-IN") },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-cyan-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {s.value}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Delivery Notes */}
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-widest mb-2">Delivery Notes</p>
                <textarea
                  value={noteValue}
                  onChange={(e) => { setNoteValue(e.target.value); setNoteSaved(false); }}
                  placeholder="E.g. Ring bell at gate B, prefer morning deliveries, landmark details..."
                  rows={3}
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none resize-none transition-colors"
                />
                <div className="flex items-center justify-between mt-2">
                  {noteSaved && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      Saved
                    </span>
                  )}
                  <button
                    onClick={handleSaveNote}
                    disabled={savingNote}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-xs font-semibold hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {savingNote ? "hourglass_empty" : "save"}
                    </span>
                    {savingNote ? "Saving..." : "Save Note"}
                  </button>
                </div>
              </div>

              {/* Order history */}
              <div>
                <p className="text-xs text-slate-600 uppercase tracking-widest mb-3">Order History</p>
                {customerOrders.length === 0 ? (
                  <p className="text-slate-700 text-sm">No orders found for this customer.</p>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.map((o) => (
                      <div key={o.id} className="flex items-center gap-3 bg-slate-800/40 rounded-lg px-4 py-2.5">
                        <span className="text-xs font-mono text-slate-600">#{o.order_number}</span>
                        <span className="flex-1 text-sm text-slate-300 truncate">
                          {(o.items ?? []).map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                        </span>
                        <span className="text-xs font-bold text-cyan-400">₹{o.total?.toLocaleString("en-IN")}</span>
                        <span className="text-xs text-slate-600">{new Date(o.created_at).toLocaleDateString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
