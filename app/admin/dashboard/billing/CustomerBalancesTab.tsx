"use client";

import { useState, useEffect } from "react";
import type { CustomerBalanceRecord } from "@/app/api/customer-balance/route";
import BalanceReminderModal from "./BalanceReminderModal";

interface CustomerBalancesTabProps {
  upiId?: string;
  onRefreshTrigger?: number;
}

export default function CustomerBalancesTab({
  upiId = "JKBMERC00828895@jkb",
  onRefreshTrigger,
}: CustomerBalancesTabProps) {
  const [records, setRecords] = useState<CustomerBalanceRecord[]>([]);
  const [summary, setSummary] = useState<{
    totalPendingAmount: number;
    pendingRecordsCount: number;
    pendingCustomersCount: number;
    settledCount: number;
    totalRecordsCount: number;
  }>({
    totalPendingAmount: 0,
    pendingRecordsCount: 0,
    pendingCustomersCount: 0,
    settledCount: 0,
    totalRecordsCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"pending" | "settled" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CustomerBalanceRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch balances from API
  const fetchBalances = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== "all") query.set("status", statusFilter);
      if (searchTerm) query.set("search", searchTerm);

      const res = await fetch(`/api/customer-balance?${query.toString()}`);
      const data = await res.json();
      if (data?.success) {
        setRecords(data.records || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      console.warn("Error fetching customer balances:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [statusFilter, searchTerm, onRefreshTrigger]);

  const handleOpenAction = (record: CustomerBalanceRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleDeleteRecord = async (record: CustomerBalanceRecord) => {
    if (!window.confirm(`Delete balance record for ${record.customer_name} (Invoice #${record.invoice_id})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/customer-balance?id=${encodeURIComponent(record.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data?.success) {
        fetchBalances();
      } else {
        alert(data?.error || "Failed to delete");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to delete");
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* KPI Flashcards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Total Outstanding Khata</span>
            <span className="material-symbols-outlined text-amber-400 text-lg">account_balance_wallet</span>
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            ₹{summary.totalPendingAmount.toLocaleString("en-IN")}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Across {summary.pendingCustomersCount} customer{summary.pendingCustomersCount === 1 ? "" : "s"} ({summary.pendingRecordsCount} bills)
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950 border border-emerald-500/20 shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Settled &amp; Waived</span>
            <span className="material-symbols-outlined text-emerald-400 text-lg">verified</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-300 font-mono">
            {summary.settledCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cleared bills &amp; final cash settlements
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">Quick Reminder System</span>
            <span className="material-symbols-outlined text-cyan-400 text-lg">notifications_active</span>
          </div>
          <p className="text-xs text-slate-300">
            System generated WhatsApp reminders with instant Razorpay dynamic QR code generation.
          </p>
          <button
            type="button"
            onClick={fetchBalances}
            className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 text-left cursor-pointer flex items-center gap-1 mt-2"
          >
            <span className="material-symbols-outlined text-xs">sync</span>
            Refresh Khata Records
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "pending"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            Pending Balances ({summary.pendingRecordsCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("settled")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "settled"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            Settled / Waived ({summary.settledCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            All ({summary.totalRecordsCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-sm">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer, phone, invoice..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Ledger Table / List */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs font-mono">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Loading customer khata ledger...
        </div>
      ) : records.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-2">
          <span className="material-symbols-outlined text-4xl text-slate-600">check_circle</span>
          <h4 className="text-sm font-bold text-slate-300">
            {statusFilter === "pending" ? "No Pending Balances Found!" : "No Records Found"}
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter === "pending"
              ? "All customer accounts are clear, settled, or waived. When you record a partial payment at the counter, it will appear here."
              : "No customer records matching the current filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Customer &amp; Phone</th>
                <th className="py-3 px-3">Invoice &amp; Date</th>
                <th className="py-3 px-3 text-right">Total Bill</th>
                <th className="py-3 px-3 text-right">Paid So Far</th>
                <th className="py-3 px-3 text-right">Balance Due</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {records.map((r) => {
                const cleanPhone = (r.customer_phone || "").replace(/\D/g, "").slice(-10);
                const isPending = r.status === "pending" && r.balance_amount > 0;

                return (
                  <tr key={r.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{r.customer_name}</div>
                      <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-xs text-cyan-400">phone</span>
                        {cleanPhone ? `+91 ${cleanPhone}` : "N/A"}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="text-slate-300 font-semibold">#{r.invoice_id}</div>
                      <div className="text-slate-500 text-[10px]">
                        {new Date(r.created_at || Date.now()).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                      {r.items_summary && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={r.items_summary}>
                          {r.items_summary}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      ₹{r.total_amount.toLocaleString("en-IN")}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                      ₹{r.paid_amount.toLocaleString("en-IN")}
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      <span className={`text-sm font-extrabold ${isPending ? "text-amber-400" : "text-slate-500"}`}>
                        ₹{r.balance_amount.toLocaleString("en-IN")}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.status === "settled"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : r.status === "waived_final"
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {r.status === "waived_final" ? "Waived Final" : r.status}
                      </span>
                      {r.settlement_note && (
                        <div className="text-[9.5px] text-slate-500 truncate max-w-[120px] mt-0.5" title={r.settlement_note}>
                          {r.settlement_note}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1. Quick Remind / Manage */}
                        <button
                          type="button"
                          onClick={() => handleOpenAction(r)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Send WhatsApp Reminder or Generate QR"
                        >
                          <span className="material-symbols-outlined text-xs">chat</span>
                          Remind / QR
                        </button>

                        {/* 2. Quick Settle */}
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleOpenAction(r)}
                            className="px-2 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Record Cash Payment or Final Waiver"
                          >
                            <span className="material-symbols-outlined text-xs">payments</span>
                            Settle
                          </button>
                        )}

                        {/* 3. Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(r)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors text-xs"
                          title="Delete record"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Reminder, QR, and Settle */}
      <BalanceReminderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        upiId={upiId}
        onBalanceUpdated={fetchBalances}
      />
    </div>
  );
}
