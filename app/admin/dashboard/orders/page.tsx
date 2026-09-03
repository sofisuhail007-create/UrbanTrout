"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";

const STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending", label: "Awaiting Verification", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  { value: "processing", label: "Payment Verified / Confirmed", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { value: "out_for_delivery", label: "Out for Delivery", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  { value: "delivered", label: "Delivered", color: "bg-green-500/15 text-green-400 border-green-500/30" },
  { value: "out_of_stock", label: "⚠️ Out of Stock (Refund Due)", color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500/15 text-red-400 border-red-500/30" },
];

function statusStyle(s: string) {
  return STATUSES.find((x) => x.value === s)?.color ?? "bg-slate-700 text-slate-400 border-slate-600";
}
function statusLabel(s: string) {
  return STATUSES.find((x) => x.value === s)?.label ?? s;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: OrderStatus) {
    setUpdating(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    try {
      await adminFetch("/api/order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, status }),
      });
    } catch (err) {
      console.warn("Status update error:", err);
    } finally {
      setUpdating(null);
    }
  }

  async function handleDeleteOrder(id: string, orderNumber: number) {
    if (!window.confirm(`Are you sure you want to delete Order #${orderNumber}? This action cannot be undone.`)) {
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await supabase.from("orders").delete().eq("id", id);
    } catch (err) {
      console.error("Error deleting order:", err);
      alert("Failed to delete order from database.");
      fetchOrders();
    }
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Orders</h1>
        <p className="text-slate-500 text-sm mt-1">{orders.length} total orders</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[{ value: "all", label: "All" }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              filter === s.value
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                : "bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-600"
            }`}
          >
            {s.label} {s.value !== "all" && `(${orders.filter((o) => o.status === s.value).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-600 py-20">Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-600 py-20 bg-slate-900/40 rounded-xl border border-slate-800">
          <span className="material-symbols-outlined text-4xl mb-3 block text-slate-700">receipt_long</span>
          No orders found.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <div key={order.id} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <span className="text-slate-600 text-xs font-mono w-10 flex-shrink-0">#{order.order_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{order.customer_name}</p>
                  <p className="text-xs text-slate-500">+91 {order.customer_phone}</p>
                </div>
                <span className={`hidden sm:inline-flex text-xs px-2.5 py-1 rounded-full border font-medium ${statusStyle(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
                <span className="text-sm font-bold text-cyan-400 font-mono">₹{order.total?.toLocaleString("en-IN")}</span>
                <span className="text-xs text-slate-600 hidden md:block w-20 text-right">
                  {new Date(order.created_at).toLocaleDateString("en-IN")}
                </span>
                <span className="material-symbols-outlined text-slate-600 text-base">
                  {expanded === order.id ? "expand_less" : "expand_more"}
                </span>
              </div>

              {/* Expanded */}
              {expanded === order.id && (
                <div className="border-t border-slate-800 px-4 py-4 bg-slate-950/50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-widest mb-1">Delivery Address</p>
                      <p className="text-slate-300">{order.customer_address}</p>
                      <p className="text-slate-500 text-xs">{order.customer_locality} — {order.customer_pincode}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-widest mb-1">Items Ordered</p>
                      {(order.items ?? []).map((item, i) => (
                        <p key={i} className="text-slate-300">
                          {item.name} × {item.quantity} {item.unit} — ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                        </p>
                      ))}
                      <p className="text-slate-500 text-xs mt-1">
                        Delivery: {order.delivery_fee === 0 ? "Free" : `₹${order.delivery_fee}`} · Zone: {order.delivery_zone ?? "—"}
                      </p>
                    </div>
                  </div>

                  {/* Status updater */}
                  <div>
                    <p className="text-xs text-slate-600 uppercase tracking-widest mb-2">Update Status</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s.value}
                          disabled={order.status === s.value || updating === order.id}
                          onClick={() => updateStatus(order.id, s.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 ${
                            order.status === s.value ? s.color + " opacity-100" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions (WhatsApp + Delete) */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <a
                      href={`https://wa.me/91${order.customer_phone}?text=${encodeURIComponent(`Hi ${order.customer_name}! Your Urban Trout order #${order.order_number} update:`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium hover:bg-green-500/25 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">chat</span>
                      WhatsApp Customer
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order.id, order.order_number)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      Delete Order
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
