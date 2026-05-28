"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Customer, Order } from "@/lib/supabase";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: o }] = await Promise.all([
        supabase.from("customers").select("*").order("last_order_at", { ascending: false, nullsFirst: false }),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
      ]);
      setCustomers(c ?? []);
      setOrders(o ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.locality ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const customerOrders = selected ? orders.filter((o) => o.customer_phone === selected.phone) : [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Customers</h1>
        <p className="text-slate-500 text-sm mt-1">{customers.length} registered customers</p>
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

          {loading ? (
            <div className="text-slate-600 text-sm text-center py-10">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-10 bg-slate-900/40 rounded-xl border border-slate-800">
              No customers yet.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c) => (
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
                    <span className="text-xs font-mono text-cyan-400">₹{c.total_spent?.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-xs text-slate-500">+91 {c.phone}</p>
                  {c.locality && <p className="text-xs text-slate-600 mt-0.5">{c.locality}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-slate-600">{c.total_orders} order{c.total_orders !== 1 ? "s" : ""}</span>
                    {c.last_order_at && (
                      <span className="text-xs text-slate-700">Last: {new Date(c.last_order_at).toLocaleDateString("en-IN")}</span>
                    )}
                  </div>
                </div>
              ))}
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
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{selected.name}</h2>
                  <p className="text-slate-500 text-sm">+91 {selected.phone}</p>
                  {selected.locality && <p className="text-slate-600 text-xs mt-0.5">{selected.locality}, {selected.pincode}</p>}
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
                    <p className="text-lg font-bold text-cyan-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{s.value}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
                  </div>
                ))}
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
