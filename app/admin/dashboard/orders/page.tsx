"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";
import PaginationBar from "@/components/PaginationBar";
import FourUpInvoiceSheet, { InvoiceSlipData } from "@/components/FourUpInvoiceSheet";

function orderToSlipData(order: Order, upi: string): InvoiceSlipData {
  const items = Array.isArray(order.items)
    ? order.items.map((i: any) => {
        const qty = typeof i.quantity === "number" ? i.quantity : parseFloat(i.quantity) || 1;
        const rate = typeof i.price === "number" ? i.price : parseFloat(i.price) || 580;
        return {
          name: i.name || "Fresh Rainbow Trout",
          quantity: qty,
          weightKg: qty,
          unit: i.unit || "Kg",
          price: rate,
          pricePerKg: rate,
          total: qty * rate,
        };
      })
    : [];

  const totalWeight = items.reduce((sum, item) => sum + (item.weightKg || 0), 0);
  const isPaid =
    order.status === "processing" ||
    order.status === "out_for_delivery" ||
    order.status === "delivered";

  return {
    invoiceNumber: String(order.order_number),
    orderNumber: order.order_number,
    customerName: order.customer_name || "Valued Customer",
    customerPhone: order.customer_phone || "",
    customerAddress: order.customer_address || "",
    customerLocality: order.customer_locality || "",
    createdAt: order.created_at,
    items,
    totalWeight,
    subtotal: order.subtotal || order.total,
    deliveryFee: order.delivery_fee,
    grandTotal: order.total || 0,
    paymentStatus: isPaid ? "PAID" : "PAYMENT DUE",
    paymentMethod: isPaid ? "Razorpay Online / UPI" : "Cash on Delivery",
    upiId: upi,
  };
}

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

function getOrderMapsUrl(order: any): string | null {
  if (order.google_maps_url) {
    const qMatch = order.google_maps_url.match(/\?q=([0-9.-]+),([0-9.-]+)/);
    if (qMatch) {
      return `https://www.google.com/maps/dir/?api=1&destination=${qMatch[1]},${qMatch[2]}`;
    }
    return order.google_maps_url;
  }
  if (order.latitude && order.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}`;
  }
  if (order.customer_address) {
    const qMatch = order.customer_address.match(/https:\/\/(?:maps\.google\.com\/\?q=|www\.google\.com\/maps\/dir\/\?api=1&destination=)([0-9.-]+),([0-9.-]+)/);
    if (qMatch) {
      return `https://www.google.com/maps/dir/?api=1&destination=${qMatch[1]},${qMatch[2]}`;
    }
    const match = order.customer_address.match(/https:\/\/(?:www\.)?google\.com\/maps[^\s]+|https:\/\/maps\.google\.com\/[^\s]+/);
    if (match) return match[0];
  }
  return null;
}

function getScheduledInfo(order: any): { isScheduled: boolean; date?: string; slot?: string; text?: string } {
  if (order.is_scheduled || order.scheduled_date || order.scheduled_slot) {
    const date = order.scheduled_date || "Scheduled";
    const slot = order.scheduled_slot || "";
    return {
      isScheduled: true,
      date,
      slot,
      text: slot ? `${date} (${slot})` : date,
    };
  }
  if (typeof order.customer_address === "string") {
    const match = order.customer_address.match(/\[SCHEDULED DELIVERY:\s*([^|]+)\s*\|\s*Slot:\s*([^\]]+)\]/i);
    if (match) {
      const date = match[1].trim();
      const slot = match[2].trim();
      return {
        isScheduled: true,
        date,
        slot,
        text: `${date} (${slot})`,
      };
    }
  }
  return { isScheduled: false };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [printModalOrders, setPrintModalOrders] = useState<Order[] | null>(null);
  const [upiId, setUpiId] = useState<string>("JKBMERC00828895@jkb");

  useEffect(() => {
    fetchOrders();
    fetchUpi();
  }, []);

  async function fetchUpi() {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "upi_id")
        .maybeSingle();
      if (data?.value) setUpiId(data.value);
    } catch (err) {
      console.warn("Could not load store UPI ID:", err);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  const toggleSelectOrder = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = (pageOrders: Order[]) => {
    const pageIds = pageOrders.map((o) => o.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedOrderIds.has(id));
    if (allSelected) {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

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
      const res = await adminFetch(`/api/order-status?orderId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json?.success) {
        throw new Error(json?.error || "Failed to delete order from server");
      }
    } catch (err: any) {
      console.error("Error deleting order:", err);
      alert(`Failed to delete order: ${err?.message || err}`);
      fetchOrders();
    }
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * 50;
    return filtered.slice(start, start + 50);
  }, [filtered, currentPage]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Orders</h1>
          <p className="text-slate-500 text-sm mt-1">{orders.length} total orders</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Active Deliveries 4-Up button */}
          <button
            type="button"
            onClick={() => {
              const active = orders.filter(
                (o) => o.status === "processing" || o.status === "out_for_delivery" || o.status === "pending"
              );
              if (active.length === 0) {
                alert("No active delivery orders currently pending or out for delivery.");
                return;
              }
              setPrintModalOrders(active);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Print all active deliveries on Canon MF244dw (4 slips per A4 sheet)"
          >
            <span>🖨️</span>
            <span>Print Active Deliveries (4-Up)</span>
          </button>

          {/* Batch Print Selected Button */}
          {selectedOrderIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                const selected = orders.filter((o) => selectedOrderIds.has(o.id));
                setPrintModalOrders(selected);
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer animate-pulse"
              title="Print selected orders on Canon MF244dw (4 slips per A4 sheet)"
            >
              <span>🖨️</span>
              <span>Print Selected ({selectedOrderIds.size}) (4-Up)</span>
            </button>
          )}

          {selectedOrderIds.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedOrderIds(new Set())}
              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-medium border border-slate-800 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap mb-4">
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

      {/* Select All on Page bar */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between pb-3 px-1 text-xs text-slate-500">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedOrderIds.has(o.id))}
              onChange={() => toggleSelectAllPage(paginatedOrders)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer"
            />
            <span className="hover:text-slate-300 transition-colors font-medium">
              Select all on page ({paginatedOrders.length})
            </span>
          </label>
          {selectedOrderIds.size > 0 && (
            <span className="text-cyan-400 font-mono text-[11px] font-semibold">
              {selectedOrderIds.size} order{selectedOrderIds.size > 1 ? "s" : ""} selected for 4-up printing
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-600 py-20">Loading orders...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-600 py-20 bg-slate-900/40 rounded-xl border border-slate-800">
          <span className="material-symbols-outlined text-4xl mb-3 block text-slate-700">receipt_long</span>
          No orders found.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedOrders.map((order) => (
            <div key={order.id} className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-800/40 transition-colors"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedOrderIds.has(order.id)}
                  onChange={() => {}}
                  onClick={(e) => toggleSelectOrder(order.id, e)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20 cursor-pointer flex-shrink-0"
                  title="Select for batch 4-up printing"
                />
                <span className="text-slate-600 text-xs font-mono w-10 flex-shrink-0">#{order.order_number}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white truncate">{order.customer_name}</p>
                    {(() => {
                      const sched = getScheduledInfo(order);
                      if (!sched.isScheduled) return null;
                      return (
                        <span
                          title={`Scheduled Delivery: ${sched.text}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold tracking-tight flex-shrink-0"
                        >
                          <span>📅</span>
                          <span className="truncate max-w-[130px] sm:max-w-none">{sched.text}</span>
                        </span>
                      );
                    })()}
                    {(() => {
                      const mapsUrl = getOrderMapsUrl(order);
                      if (!mapsUrl) return null;
                      return (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="1-Tap Google Maps Navigation"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[11px] font-semibold transition-colors flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-xs">near_me</span>
                          <span>Map</span>
                        </a>
                      );
                    })()}
                  </div>
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
                      {(() => {
                        const sched = getScheduledInfo(order);
                        if (!sched.isScheduled) return null;
                        return (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-xs text-cyan-200">
                            <span className="font-bold text-white block mb-0.5">📅 Scheduled Pre-Order Delivery</span>
                            <span>Date: <strong className="text-white">{sched.date}</strong></span>
                            {sched.slot && <span> | Slot: <strong className="text-emerald-400">{sched.slot}</strong></span>}
                          </div>
                        );
                      })()}
                      {(() => {
                        const mapsUrl = getOrderMapsUrl(order);
                        if (!mapsUrl) return null;
                        return (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold hover:bg-emerald-500/25 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">near_me</span>
                            🗺️ 1-Tap Google Maps (Navigate)
                          </a>
                        );
                      })()}
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

                  {/* Actions (Print 4-Up + Navigate + WhatsApp + Delete) */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setPrintModalOrders([order])}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-colors shadow-sm cursor-pointer"
                        title="Print 4 slips on 1 A4 sheet using Canon MF244dw laser printer"
                      >
                        <span>🖨️</span>
                        <span>Print 4-Up Slip (Canon)</span>
                      </button>

                      {(() => {
                        const mapsUrl = getOrderMapsUrl(order);
                        if (!mapsUrl) return null;
                        return (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-colors shadow-sm"
                          >
                            <span className="material-symbols-outlined text-base">near_me</span>
                            🗺️ 1-Tap Google Maps (Navigate)
                          </a>
                        );
                      })()}

                      {(() => {
                        const cleanPhone = String(order.customer_phone || "").replace(/\D/g, "").slice(-10);
                        const text = encodeURIComponent(`Hi ${order.customer_name}! Your Urban Trout order #${order.order_number} update:`);
                        const waUrl = cleanPhone.length === 10 ? `https://wa.me/91${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
                        return (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium hover:bg-green-500/25 transition-colors"
                          >
                            <span className="material-symbols-outlined text-base">chat</span>
                            WhatsApp Customer
                          </a>
                        );
                      })()}
                    </div>

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
        <PaginationBar
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={50}
          onPageChange={setCurrentPage}
          itemLabel="orders"
          themeColor="cyan"
          className="mt-4 rounded-xl border border-slate-800/80"
        />
      </>
    )}

      {/* ─── 4-UP BATCH INVOICE MODAL (CANON MF244DW) ─── */}
      {printModalOrders && printModalOrders.length > 0 && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPrintModalOrders(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="relative w-full max-w-4xl my-4">
            <FourUpInvoiceSheet
              invoices={printModalOrders.map((o) => orderToSlipData(o, upiId))}
              repeatSingle={printModalOrders.length === 1}
              onClose={() => setPrintModalOrders(null)}
              showControls={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
