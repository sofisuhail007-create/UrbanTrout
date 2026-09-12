"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Order, WaterParameter, Lead } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";
import Link from "next/link";
import BalanceReminderModal from "./billing/BalanceReminderModal";
import type { CustomerBalanceRecord } from "@/app/api/customer-balance/route";
import {
  validateDO,
  getAmmoniaStatus,
  getPHStatus,
  getTempStatus,
  getNitriteStatus,
  getNitrateStatus,
} from "@/lib/do-saturation";

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

const TANK_LABELS: Record<string, string> = { tank: "Tank", sump: "Sump Tank" };

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

type AlarmSummary = { tank: string; parameter: string; value: number | string; color: string; date: string };

function getAlarms(entries: WaterParameter[]): AlarmSummary[] {
  const alarms: AlarmSummary[] = [];
  for (const e of entries) {
    const doV = validateDO(e.temperature, e.dissolved_oxygen);
    if (doV && (doV.status === "danger" || doV.status === "warning" || doV.status === "supersaturated")) {
      alarms.push({ tank: TANK_LABELS[e.tank_id] ?? e.tank_id, parameter: "DO", value: `${e.dissolved_oxygen} mg/L`, color: doV.color, date: e.date });
    }
    const amm = getAmmoniaStatus(e.ammonia);
    if (amm.status !== "optimal") {
      alarms.push({ tank: TANK_LABELS[e.tank_id] ?? e.tank_id, parameter: "Ammonia", value: `${e.ammonia} ppm`, color: amm.color, date: e.date });
    }
    const ph = getPHStatus(e.ph);
    if (ph.status !== "optimal") {
      alarms.push({ tank: TANK_LABELS[e.tank_id] ?? e.tank_id, parameter: "pH", value: e.ph, color: ph.color, date: e.date });
    }
    const tmp = getTempStatus(e.temperature);
    if (tmp.status !== "optimal") {
      alarms.push({ tank: TANK_LABELS[e.tank_id] ?? e.tank_id, parameter: "Temp", value: `${e.temperature}°C`, color: tmp.color, date: e.date });
    }
    const no2 = getNitriteStatus(e.nitrite);
    if (no2.status !== "optimal") {
      alarms.push({ tank: TANK_LABELS[e.tank_id] ?? e.tank_id, parameter: "Nitrite", value: `${e.nitrite} ppm`, color: no2.color, date: e.date });
    }
    const no3 = getNitrateStatus(e.nitrate);
    if (no3.status !== "optimal") {
      alarms.push({ tank: TANK_LABELS[e.tank_id] ?? e.tank_id, parameter: "Nitrate", value: `${e.nitrate} ppm`, color: no3.color, date: e.date });
    }
  }
  return alarms;
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentParams, setRecentParams] = useState<WaterParameter[]>([]);

  // Customer Balances / Khata State
  const [balanceSummary, setBalanceSummary] = useState<{
    totalPendingAmount: number;
    pendingRecordsCount: number;
    pendingCustomersCount: number;
  }>({
    totalPendingAmount: 0,
    pendingRecordsCount: 0,
    pendingCustomersCount: 0,
  });
  const [pendingBalances, setPendingBalances] = useState<CustomerBalanceRecord[]>([]);
  const [selectedBalanceRecord, setSelectedBalanceRecord] = useState<CustomerBalanceRecord | null>(null);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  const fetchBalancesData = async () => {
    try {
      const res = await adminFetch("/api/customer-balance?status=pending");
      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          setPendingBalances(json.records || []);
          if (json.summary) {
            setBalanceSummary({
              totalPendingAmount: json.summary.totalPendingAmount || 0,
              pendingRecordsCount: json.summary.pendingRecordsCount || 0,
              pendingCustomersCount: json.summary.pendingCustomersCount || 0,
            });
          }
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    async function load() {
      const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      
      // Fetch orders, customer count, water params, and deduplicated leads
      const [{ data: ord }, { count }, { data: wp }] = await Promise.all([
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(6),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase
          .from("water_parameters")
          .select("*")
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false }),
      ]);

      setOrders(ord ?? []);
      setCustomers(count ?? 0);
      setRecentParams((wp as WaterParameter[]) ?? []);

      // Fetch deduplicated leads via API endpoint
      try {
        const res = await adminFetch("/api/lead");
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.leads)) {
            const abandoned = json.leads.filter((l: Lead) => l.status === "abandoned").slice(0, 4);
            setRecentLeads(abandoned);
          }
        }
      } catch (_) {
        // Fallback: direct Supabase query with in-memory deduplication
        const { data: leadsData } = await supabase
          .from("leads")
          .select("*")
          .eq("status", "abandoned")
          .order("created_at", { ascending: false });

        if (leadsData) {
          const seen = new Set<string>();
          const deduped: Lead[] = [];
          for (const l of leadsData as Lead[]) {
            const clean = (l.customer_phone || "").replace(/\D/g, "").slice(-10);
            if (!seen.has(clean)) {
              seen.add(clean);
              deduped.push(l);
            }
          }
          setRecentLeads(deduped.slice(0, 4));
        }
      }

      await fetchBalancesData();
      setLoading(false);
    }
    load();
  }, []);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayOrders = orders.filter((o) => o.created_at?.slice(0, 10) === today);
  const todayRevenue = todayOrders.reduce((s, o) => s + (o.total ?? 0), 0);
  const pending = orders.filter((o) => o.status === "pending").length;

  const alarms = getAlarms(recentParams);
  const hasDangerAlarms = alarms.some((a) => a.color === "#f87171" || a.color === "#ef4444");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1" style={{ fontFamily: '"Manrope", sans-serif' }}>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Kolkata",
          })}
        </p>
      </div>

      {/* Bio-Alarm Banner */}
      {alarms.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{
            background: hasDangerAlarms ? "#f8717115" : "#fbbf2415",
            borderColor: hasDangerAlarms ? "#f8717140" : "#fbbf2440",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-outlined text-xl"
                style={{ color: hasDangerAlarms ? "#f87171" : "#fbbf24", animation: hasDangerAlarms ? "pulse 2s infinite" : "none" }}
              >
                crisis_alert
              </span>
              <span className="font-semibold text-sm" style={{ color: hasDangerAlarms ? "#f87171" : "#fbbf24" }}>
                {alarms.length} Water Parameter Alert{alarms.length > 1 ? "s" : ""} (Last 48 hrs)
              </span>
            </div>
            <Link
              href="/admin/dashboard/farm/alarms"
              className="text-xs text-slate-400 hover:text-slate-200 underline"
            >
              View all →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {alarms.slice(0, 6).map((a, i) => (
              <span
                key={i}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: `${a.color}20`, color: a.color }}
              >
                <span className="material-symbols-outlined text-[12px]">warning</span>
                {a.tank} · {a.parameter}: {a.value}
              </span>
            ))}
            {alarms.length > 6 && (
              <span className="text-xs text-slate-600 self-center">+{alarms.length - 6} more</span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard icon="today" label="Today's Orders" value={todayOrders.length} color="bg-cyan-500/15 text-cyan-400" />
        <StatCard icon="currency_rupee" label="Today's Revenue" value={`₹${todayRevenue.toLocaleString("en-IN")}`} color="bg-green-500/15 text-green-400" />
        <StatCard icon="pending" label="Pending Orders" value={pending} color="bg-amber-500/15 text-amber-400" sub="Needs action" />
        <StatCard
          icon="account_balance_wallet"
          label="Pending Khata"
          value={`₹${balanceSummary.totalPendingAmount.toLocaleString("en-IN")}`}
          color="bg-amber-500/15 text-amber-400"
          sub={balanceSummary.pendingRecordsCount > 0 ? `${balanceSummary.pendingRecordsCount} unpaid bills` : "All clear ✓"}
        />
        <StatCard icon="group" label="Total Customers" value={customers} color="bg-purple-500/15 text-purple-400" />
      </div>

      {/* ─── OUTSTANDING BALANCES FLASHCARD (KHATA WIDGET) ─── */}
      {balanceSummary.pendingRecordsCount > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden animate-fadeIn">
          <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-white text-base" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    Outstanding Customer Balances ({balanceSummary.pendingRecordsCount} Unpaid)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10.5px] font-mono font-extrabold animate-pulse">
                    ₹{balanceSummary.totalPendingAmount.toLocaleString("en-IN")} DUE
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  Automated polite system-generated WhatsApp reminders with dynamic Razorpay balance QR
                </p>
              </div>
            </div>

            <Link
              href="/admin/dashboard/billing?tab=customer_balances"
              className="text-amber-400 hover:text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 rounded-xl border border-amber-500/30 transition-all shadow-sm"
            >
              <span>Manage Khata Ledger</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingBalances.slice(0, 6).map((rec) => {
              const cleanPhone = (rec.customer_phone || "").replace(/\D/g, "").slice(-10);
              return (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex flex-col justify-between gap-3 hover:border-amber-500/30 transition-all shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-white text-sm truncate">{rec.customer_name}</p>
                      <p className="text-slate-400 text-xs font-mono flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-xs text-cyan-400">phone</span>
                        {cleanPhone ? `+91 ${cleanPhone}` : "N/A"}
                      </p>
                      <p className="text-slate-500 text-[10px] font-mono mt-0.5">
                        Invoice #{rec.invoice_id}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Balance Due</p>
                      <p className="text-base font-extrabold text-amber-400 font-mono">
                        ₹{rec.balance_amount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Paid ₹{rec.paid_amount.toLocaleString("en-IN")} of ₹{rec.total_amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBalanceRecord(rec);
                        setIsBalanceModalOpen(true);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Send Polite System Reminder on WhatsApp"
                    >
                      <span className="material-symbols-outlined text-xs">chat</span>
                      WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBalanceRecord(rec);
                        setIsBalanceModalOpen(true);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Generate Razorpay Balance QR"
                    >
                      <span className="material-symbols-outlined text-xs">qr_code_2</span>
                      Scan QR
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBalanceRecord(rec);
                        setIsBalanceModalOpen(true);
                      }}
                      className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center transition-all cursor-pointer"
                      title="Settle or Record Payment"
                    >
                      Settle
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {pendingBalances.length > 6 && (
            <div className="text-center pt-3">
              <Link
                href="/admin/dashboard/billing?tab=customer_balances"
                className="text-xs text-slate-400 hover:text-amber-300 underline font-mono"
              >
                + View all {pendingBalances.length} pending customer balances →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Abandoned Leads Alert Widget */}
      {recentLeads.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400">phone_callback</span>
              <h2 className="font-bold text-white text-base" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Hot Leads to Call ({recentLeads.length} Abandoned Checkouts)
              </h2>
            </div>
            <Link href="/admin/dashboard/leads" className="text-amber-400 hover:text-amber-300 text-xs font-bold uppercase tracking-wider">
              View All Leads →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentLeads.map((lead) => {
              const cleanPhone = (lead.customer_phone || "").replace(/\D/g, "").slice(-10);
              const itemsList = Array.isArray(lead.cart_items) ? lead.cart_items : [];
              const itemsSummary = itemsList.map((i: any) => `${i.name} (${i.quantity} ${i.unit || 'Kg'})`).join(", ") || "Fresh Catch";
              const waText = encodeURIComponent(
                `Hi ${lead.customer_name || 'there'}! This is Urban Trout Srinagar. We noticed you started an order for ${itemsSummary}. Would you like us to confirm and arrange same-day delivery to your doorstep?`
              );

              return (
                <div key={lead.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{lead.customer_name || "Guest Customer"}</p>
                    <p className="text-slate-400 text-xs font-mono">{cleanPhone ? `+91 ${cleanPhone}` : "N/A"}</p>
                    <p className="text-cyan-400 text-xs font-semibold mt-0.5">₹{Number(lead.estimated_total || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {cleanPhone && (
                      <>
                        <a
                          href={`tel:+91${cleanPhone}`}
                          className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-bold flex items-center gap-1"
                          title="Call Customer"
                        >
                          <span className="material-symbols-outlined text-[13px]">call</span>
                          Call
                        </a>
                        <a
                          href={`https://wa.me/91${cleanPhone}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold flex items-center gap-1"
                          title="WhatsApp Customer"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Customer Balance Reminder & Razorpay QR Modal */}
      <BalanceReminderModal
        isOpen={isBalanceModalOpen}
        onClose={() => {
          setIsBalanceModalOpen(false);
          setSelectedBalanceRecord(null);
        }}
        record={selectedBalanceRecord}
        onBalanceUpdated={fetchBalancesData}
      />
    </div>
  );
}
