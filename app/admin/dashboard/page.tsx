"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/supabase";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  processing: "bg-blue-500/15 text-blue-400",
  out_for_delivery: "bg-cyan-500/15 text-cyan-400",
  delivered: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
      <p className="text-slate-500 text-xs uppercase tracking-widest mb-1" style={{ fontFamily: '"Manrope", sans-serif' }}>{label}</p>
      <p className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ord }, { count }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(6),
        supabase.from("customers").select("*", { count: "exact", head: true }),
      ]);
      setOrders(ord ?? []);
      setCustomers(count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.created_at?.slice(0, 10) === today);
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total ?? 0), 0);
  const pending = orders.filter((o) => o.status === "pending").length;
  const totalRevenue = orders.reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1" style={{ fontFamily: '"Manrope", sans-serif' }}>
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="today" label="Today's Orders" value={todayOrders.length} color="bg-cyan-500/15 text-cyan-400" />
        <StatCard icon="currency_rupee" label="Today's Revenue" value={`₹${todayRevenue.toLocaleString("en-IN")}`} color="bg-green-500/15 text-green-400" />
        <StatCard icon="pending" label="Pending Orders" value={pending} color="bg-amber-500/15 text-amber-400" sub="Needs action" />
        <StatCard icon="group" label="Total Customers" value={customers} color="bg-purple-500/15 text-purple-400" />
      </div>

      {/* Recent Orders */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Recent Orders</h2>
          <Link href="/admin/dashboard/orders" className="text-cyan-400 text-xs hover:underline">View all →</Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-600 text-sm">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-600 text-sm">No orders yet. Orders placed via checkout will appear here.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {orders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/40 transition-colors">
                <span className="text-slate-600 text-xs font-mono w-12">#{o.order_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{o.customer_name}</p>
                  <p className="text-xs text-slate-600">{o.customer_phone}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[o.status] ?? "bg-slate-700 text-slate-400"}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className="text-sm font-bold text-cyan-400 font-mono">₹{o.total?.toLocaleString("en-IN")}</span>
                <span className="text-xs text-slate-600 w-20 text-right">{new Date(o.created_at).toLocaleDateString("en-IN")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
