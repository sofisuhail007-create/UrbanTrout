"use client";
import { useEffect, useState, useCallback } from "react";
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
  pending: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  processing: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  out_for_delivery: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
  delivered: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const TANK_LABELS: Record<string, string> = { tank: "Tank", sump: "Sump Tank" };

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-400 font-['Manrope']">{label}</span>
        <span className="material-symbols-outlined text-zinc-500 text-base">{icon}</span>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums tracking-tight font-['Space_Grotesk']">{value}</p>
        {sub && <p className="text-[11px] text-zinc-400 font-mono mt-0.5">{sub}</p>}
      </div>
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
  const [storeStatus, setStoreStatus] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [aquariumStockKg, setAquariumStockKg] = useState<number>(0);
  const [isAquariumOutOfStock, setIsAquariumOutOfStock] = useState<boolean>(false);
  const [todayEntriesCount, setTodayEntriesCount] = useState<number>(0);

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

  const handleMarkLeadContacted = async (leadId: string, phone?: string) => {
    setRecentLeads((prev) =>
      prev.filter(
        (l) =>
          l.id !== leadId &&
          (phone ? (l.customer_phone || "").replace(/\D/g, "").slice(-10) !== phone : true)
      )
    );
    try {
      await adminFetch("/api/lead", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, phone, status: "contacted" }),
      });
    } catch (_) {}
  };

  const loadData = useCallback(async () => {
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
      try {
        const storeRes = await fetch("/api/store-status");
        if (storeRes.ok) {
          const storeJson = await storeRes.json();
          setStoreStatus(storeJson);
        }
      } catch (_) {}

      // Check admin status for staff vs owner
      const storedEmail = (localStorage.getItem("ut_admin_email") || sessionStorage.getItem("ut_admin_email") || "").toLowerCase().trim();
      const storedRole = (localStorage.getItem("ut_admin_role") || sessionStorage.getItem("ut_admin_role") || "").toLowerCase().trim();
      const isOwner = storedEmail === "sofisuhail007@gmail.com" || storedEmail === "info.urbantrout@gmail.com" || storedRole === "super_admin";
      setIsAdmin(isOwner);

      // Fetch live aquarium stock for flash card
      try {
        const stockRes = await fetch("/api/aquarium-stock");
        if (stockRes.ok) {
          const stockJson = await stockRes.json();
          const live = stockJson?.liveSummary || stockJson?.summary;
          if (live) {
            setAquariumStockKg(Number(live.remainingKg || 0));
            setIsAquariumOutOfStock(Boolean(live.isOutOfStock));
          }
        }
      } catch (_) {}

      // Fetch today's vending sales entries count
      try {
        const todayStr = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

        const vendingRes = await adminFetch(`/api/vending-log?startDate=${todayStr}&endDate=${todayStr}`);
        if (vendingRes.ok) {
          const vendingJson = await vendingRes.json();
          if (Array.isArray(vendingJson?.entries)) {
            setTodayEntriesCount(vendingJson.entries.length);
          } else if (vendingJson?.kpis?.today?.count !== undefined) {
            setTodayEntriesCount(Number(vendingJson.kpis.today.count) || 0);
          }
        }
      } catch (_) {}

      setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    // Re-fetch automatically when window gains focus or device wakes up (crucial for iPhone/mobile Safari tabs)
    const handleRefresh = () => {
      loadData();
    };

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    // Background interval refresh every 45 seconds
    const interval = setInterval(handleRefresh, 45000);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
      clearInterval(interval);
    };
  }, [loadData]);

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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-100 font-['Space_Grotesk']">
          Dashboard
        </h1>
        <p className="text-xs text-zinc-400 font-mono mt-0.5">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Kolkata",
          })}
        </p>
      </div>

      {/* Live Store & Facility Status Banner */}
      {storeStatus && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            storeStatus.isOpen
              ? "bg-zinc-900/60 border-emerald-500/30 text-zinc-200"
              : storeStatus.closedReason === "farm_maintenance"
              ? "bg-zinc-900/60 border-amber-500/30 text-zinc-200"
              : storeStatus.closedReason === "friday_maintenance"
              ? "bg-zinc-900/60 border-amber-500/30 text-zinc-200"
              : storeStatus.closedReason === "manual"
              ? "bg-zinc-900/60 border-rose-500/30 text-zinc-200"
              : "bg-zinc-900/60 border-zinc-800 text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              storeStatus.isOpen
                ? "bg-emerald-500/10 text-emerald-400"
                : storeStatus.closedReason === "manual"
                ? "bg-rose-500/10 text-rose-400"
                : "bg-amber-500/10 text-amber-400"
            }`}>
              <span className="material-symbols-outlined text-lg">
                {storeStatus.isOpen
                  ? "storefront"
                  : storeStatus.closedReason === "farm_maintenance"
                  ? "construction"
                  : storeStatus.closedReason === "friday_maintenance"
                  ? "calendar_month"
                  : storeStatus.closedReason === "manual"
                  ? "pause_circle"
                  : "schedule"}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-zinc-100 font-['Space_Grotesk']">
                  Store Status:{" "}
                  {storeStatus.isOpen
                    ? "Open · Accepting Online Orders"
                    : storeStatus.closedReason === "farm_maintenance"
                    ? "Closed for Farm Maintenance"
                    : storeStatus.closedReason === "friday_maintenance"
                    ? "Closed for Friday Maintenance"
                    : storeStatus.closedReason === "manual"
                    ? "Manually Paused"
                    : "Closed Outside Hours"}
                </span>
                <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                  storeStatus.isOpen
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700/60"
                }`}>
                  {storeStatus.isOpen ? "Checkout Active" : "Checkout Paused"}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 font-['Manrope']">
                {storeStatus.isOpen
                  ? "Standard schedule: 8:00 AM – 8:00 PM IST. Delivery radius: 16km."
                  : storeStatus.closedReason === "farm_maintenance"
                  ? "Farm & Vending Center maintenance active. Online checkout is temporarily paused."
                  : storeStatus.closedReason === "friday_maintenance"
                  ? "Closed for regular Friday maintenance. Online checkout can be toggled in Settings."
                  : storeStatus.closedReason === "manual"
                  ? "Store is manually paused by an administrator."
                  : `Store reopens ${storeStatus.nextOpenLabel || "tomorrow at 8:00 AM IST"}.`}
              </p>
            </div>
          </div>

          <Link
            href="/admin/dashboard/settings"
            className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors w-max"
          >
            Manage Operations →
          </Link>
        </div>
      )}

      {/* Bio-Alarm Banner */}
      {alarms.length > 0 && (
        <div
          className={`rounded-xl border p-4 ${
            hasDangerAlarms
              ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
              : "bg-amber-500/10 border-amber-500/30 text-amber-200"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">
                warning
              </span>
              <span className="font-medium text-sm text-zinc-100">
                {alarms.length} Water Parameter Alert{alarms.length > 1 ? "s" : ""} (Last 48 hrs)
              </span>
            </div>
            <Link
              href="/admin/dashboard/farm/alarms"
              className="text-xs text-zinc-400 hover:text-zinc-200 underline"
            >
              View all →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {alarms.slice(0, 6).map((a, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-700/60"
                style={{ color: a.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: a.color }} />
                {a.tank} · {a.parameter}: {a.value}
              </span>
            ))}
            {alarms.length > 6 && (
              <span className="text-xs text-zinc-400 self-center font-mono">+{alarms.length - 6} more</span>
            )}
          </div>
        </div>
      )}

      {/* ─── AQUARIUM LIVE STOCK FLASH CARD (STAFF VIEW - MOHD AMIN) ─── */}
      {!isAdmin && (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700/60 text-cyan-400 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-xl">water_ph</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-zinc-100 text-sm font-['Space_Grotesk']">
                    Aquarium Live Trout Stock
                  </h2>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                      isAquariumOutOfStock
                        ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                        : aquariumStockKg < 10
                        ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    }`}
                  >
                    {isAquariumOutOfStock ? "Restock Required" : aquariumStockKg < 10 ? "Low Stock" : "Optimal Active"}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs mt-0.5 font-['Manrope']">
                  Real-time live biomass available in shop aquarium for counter sales
                </p>
              </div>
            </div>

            <div className="flex items-center flex-wrap sm:flex-nowrap gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-left sm:text-right">
                <div className="text-[10px] font-medium tracking-wide text-zinc-400 font-mono">Current Stock</div>
                <div className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums tracking-tight">
                  {aquariumStockKg.toFixed(3)} <span className="text-xs text-zinc-400 font-normal">kg</span>
                </div>
              </div>

              <div className="text-left sm:text-right border-l border-zinc-800 pl-4 sm:pl-6">
                <div className="text-[10px] font-medium tracking-wide text-zinc-400 font-mono">Today's Entries</div>
                <div className="text-2xl font-semibold text-zinc-100 font-mono tabular-nums tracking-tight">
                  {todayEntriesCount} <span className="text-xs text-zinc-400 font-normal">{todayEntriesCount === 1 ? 'entry' : 'entries'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/admin/dashboard/billing"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">point_of_sale</span>
                  <span>POS Billing</span>
                </Link>
                <Link
                  href="/admin/dashboard/vending-log"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">table_chart</span>
                  <span>Vending Log</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {isAdmin ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard icon="today" label="Today's Orders" value={todayOrders.length} />
          <StatCard icon="currency_rupee" label="Today's Revenue" value={`₹${todayRevenue.toLocaleString("en-IN")}`} />
          <StatCard icon="pending" label="Pending Orders" value={pending} sub="Needs action" />
          <StatCard
            icon="account_balance_wallet"
            label="Pending Khata"
            value={`₹${balanceSummary.totalPendingAmount.toLocaleString("en-IN")}`}
            sub={balanceSummary.pendingRecordsCount > 0 ? `${balanceSummary.pendingRecordsCount} unpaid bills` : "All clear ✓"}
          />
          <StatCard icon="group" label="Total Customers" value={customers} />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon="receipt_long"
            label="Today's Entries"
            value={`${todayEntriesCount} ${todayEntriesCount === 1 ? 'Entry' : 'Entries'}`}
            sub="Counter Sales Logged"
          />
          <StatCard
            icon="water_ph"
            label="Aquarium Stock"
            value={`${aquariumStockKg.toFixed(3)} kg`}
            sub={isAquariumOutOfStock ? "Needs Restock" : "Available in Tank"}
          />
          <StatCard icon="today" label="Today's Orders" value={todayOrders.length} sub="Online Checkout" />
          <StatCard icon="pending" label="Pending Orders" value={pending} sub="Needs action" />
        </div>
      )}

      {/* ─── OUTSTANDING BALANCES FLASHCARD (KHATA WIDGET) ─── */}
      {isAdmin && balanceSummary.pendingRecordsCount > 0 && (
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700/60 text-amber-400 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-zinc-100 text-sm font-['Space_Grotesk']">
                    Outstanding Customer Balances ({balanceSummary.pendingRecordsCount} Unpaid)
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-medium">
                    ₹{balanceSummary.totalPendingAmount.toLocaleString("en-IN")} Due
                  </span>
                </div>
                <p className="text-zinc-400 text-xs mt-0.5 font-['Manrope']">
                  Polite automated WhatsApp ledger reminders and Razorpay balance settlement QR
                </p>
              </div>
            </div>

            <Link
              href="/admin/dashboard/billing?tab=customer_balances"
              className="text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-700 transition-colors"
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
                  className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-100 text-sm truncate">{rec.customer_name}</p>
                      <p className="text-zinc-400 text-xs font-mono flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-xs text-zinc-500">phone</span>
                        {cleanPhone ? `+91 ${cleanPhone}` : "N/A"}
                      </p>
                      <p className="text-zinc-500 text-[10px] font-mono mt-0.5">
                        Invoice #{rec.invoice_id}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-medium tracking-wide text-zinc-500 font-mono">Balance Due</p>
                      <p className="text-sm font-semibold text-amber-400 font-mono tabular-nums">
                        ₹{rec.balance_amount.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono tabular-nums">
                        Paid ₹{rec.paid_amount.toLocaleString("en-IN")} of ₹{rec.total_amount.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBalanceRecord(rec);
                        setIsBalanceModalOpen(true);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
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
                      className="flex-1 py-1.5 px-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
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
                      className="py-1.5 px-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center justify-center transition-colors cursor-pointer"
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
                className="text-xs text-zinc-400 hover:text-zinc-200 underline font-mono"
              >
                + View all {pendingBalances.length} pending customer balances →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Abandoned Leads Alert Widget */}
      {recentLeads.length > 0 && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-400 text-lg">phone_callback</span>
              <h2 className="font-semibold text-zinc-100 text-sm font-['Space_Grotesk']">
                Hot Leads to Call ({recentLeads.length} Abandoned Checkouts)
              </h2>
            </div>
            <Link href="/admin/dashboard/leads" className="text-zinc-400 hover:text-zinc-200 text-xs font-medium">
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
                <div key={lead.id} className="p-3.5 rounded-lg bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100 text-sm truncate">{lead.customer_name || "Guest Customer"}</p>
                    <p className="text-zinc-400 text-xs font-mono">{cleanPhone ? `+91 ${cleanPhone}` : "N/A"}</p>
                    <p className="text-zinc-300 text-xs font-mono tabular-nums font-semibold mt-0.5">₹{Number(lead.estimated_total || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {cleanPhone && (
                      <>
                        <a
                          href={`tel:+91${cleanPhone}`}
                          className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center gap-1 transition-colors"
                          title="Call Customer"
                        >
                          <span className="material-symbols-outlined text-[13px]">call</span>
                          Call
                        </a>
                        <a
                          href={`https://wa.me/91${cleanPhone}?text=${waText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center gap-1 transition-colors"
                          title="WhatsApp Customer"
                        >
                          WhatsApp
                        </a>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleMarkLeadContacted(lead.id, cleanPhone)}
                      className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Mark as Contacted"
                    >
                      <span className="material-symbols-outlined text-[13px] text-emerald-400">check_circle</span>
                      <span>Done</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-zinc-800/80">
          <h2 className="font-semibold text-zinc-100 text-sm font-['Space_Grotesk']">Recent Orders</h2>
          <Link href="/admin/dashboard/orders" className="text-zinc-400 hover:text-zinc-200 text-xs font-medium">View all →</Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm font-mono">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">No orders yet. Orders placed via checkout will appear here.</div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {orders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center gap-4 px-4 sm:px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                <span className="text-zinc-500 text-xs font-mono w-14">#{o.order_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate">{o.customer_name}</p>
                  <p className="text-xs text-zinc-500 font-mono">{o.customer_phone}</p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${STATUS_COLOR[o.status] ?? "bg-zinc-800 text-zinc-400"}`}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                <span className="text-sm font-semibold text-zinc-100 font-mono tabular-nums">₹{o.total?.toLocaleString("en-IN")}</span>
                <span className="text-xs text-zinc-500 font-mono w-20 text-right">{new Date(o.created_at).toLocaleDateString("en-IN")}</span>
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
