"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/supabase";

function ring(value: number, max: number, color: string) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 28, circ = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" className="rotate-[-90deg]">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");

  useEffect(() => {
    supabase.from("orders").select("*").order("created_at", { ascending: true }).then(({ data }) => {
      setOrders(data ?? []);
      setLoading(false);
    });
  }, []);

  const now = new Date();
  const cutoff = period === "7d" ? 7 : period === "30d" ? 30 : 99999;
  const filtered = orders.filter((o) => {
    const diff = (now.getTime() - new Date(o.created_at).getTime()) / 86400000;
    return diff <= cutoff;
  });

  const totalRevenue = filtered.reduce((s, o) => s + (o.total ?? 0), 0);
  const deliveredOrders = filtered.filter((o) => o.status === "delivered");
  const deliveredRevenue = deliveredOrders.reduce((s, o) => s + (o.total ?? 0), 0);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  filtered.forEach((o) => { statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1; });

  // Revenue by product
  const productRevenue: Record<string, number> = {};
  filtered.forEach((o) => {
    (o.items ?? []).forEach((item) => {
      productRevenue[item.name] = (productRevenue[item.name] ?? 0) + item.price * item.quantity;
    });
  });

  // Daily revenue (last N days)
  const dailyRevenue: Record<string, number> = {};
  const days = period === "7d" ? 7 : 30;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyRevenue[d.toISOString().slice(0, 10)] = 0;
  }
  filtered.forEach((o) => {
    const day = o.created_at?.slice(0, 10);
    if (day && day in dailyRevenue) dailyRevenue[day] += o.total ?? 0;
  });

  const dailyEntries = Object.entries(dailyRevenue);
  const maxDay = Math.max(...dailyEntries.map(([, v]) => v), 1);

  const STATUS_META: Record<string, { label: string; color: string; ring: string }> = {
    pending: { label: "Pending", color: "text-amber-400", ring: "#f59e0b" },
    processing: { label: "Processing", color: "text-blue-400", ring: "#60a5fa" },
    out_for_delivery: { label: "Out for Delivery", color: "text-cyan-400", ring: "#22d3ee" },
    delivered: { label: "Delivered", color: "text-green-400", ring: "#4ade80" },
    cancelled: { label: "Cancelled", color: "text-red-400", ring: "#f87171" },
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Business intelligence overview</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                period === p ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40" : "bg-slate-800/60 text-slate-400 border-slate-700"
              }`}
            >
              {p === "all" ? "All Time" : p === "7d" ? "Last 7 Days" : "Last 30 Days"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-600 py-20">Loading analytics...</div>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Orders", value: filtered.length, icon: "receipt_long", color: "text-cyan-400" },
              { label: "Total Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: "currency_rupee", color: "text-green-400" },
              { label: "Delivered Revenue", value: `₹${deliveredRevenue.toLocaleString("en-IN")}`, icon: "local_shipping", color: "text-emerald-400" },
              { label: "Avg Order Value", value: filtered.length > 0 ? `₹${Math.round(totalRevenue / filtered.length).toLocaleString("en-IN")}` : "—", icon: "bar_chart", color: "text-purple-400" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                <span className={`material-symbols-outlined text-xl ${s.color}`}>{s.icon}</span>
                <p className="text-xl font-bold text-white mt-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{s.value}</p>
                <p className="text-xs text-slate-600 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue bar chart */}
          {period !== "all" && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Daily Revenue — Last {days} Days
              </h2>
              <div className="flex items-end gap-1 h-32">
                {dailyEntries.map(([day, val]) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-cyan-500/40 hover:bg-cyan-500/70 rounded-t transition-all"
                      style={{ height: `${(val / maxDay) * 100}%`, minHeight: val > 0 ? "4px" : "0" }}
                    />
                    <span className="text-[8px] text-slate-700 hidden group-hover:block absolute -top-5 bg-slate-800 px-1 py-0.5 rounded whitespace-nowrap">
                      ₹{val.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-700">{dailyEntries[0]?.[0]}</span>
                <span className="text-xs text-slate-700">{dailyEntries[dailyEntries.length - 1]?.[0]}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Status breakdown */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Order Status Breakdown</h2>
              <div className="space-y-3">
                {Object.entries(STATUS_META).map(([status, meta]) => {
                  const count = statusCounts[status] ?? 0;
                  const pct = filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`text-xs w-28 ${meta.color}`}>{meta.label}</span>
                      <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.ring }} />
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Product revenue */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Revenue by Product</h2>
              {Object.keys(productRevenue).length === 0 ? (
                <p className="text-slate-700 text-sm">No data yet.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(productRevenue)
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, rev]) => {
                      const total2 = Object.values(productRevenue).reduce((s, v) => s + v, 0);
                      const pct = total2 > 0 ? Math.round((rev / total2) * 100) : 0;
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-slate-300 truncate">{name}</span>
                            <span className="text-cyan-400 font-mono ml-2">₹{rev.toLocaleString("en-IN")} ({pct}%)</span>
                          </div>
                          <div className="bg-slate-800 rounded-full h-1.5">
                            <div className="h-1.5 bg-cyan-500/60 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
