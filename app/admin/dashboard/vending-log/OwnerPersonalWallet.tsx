"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { OwnerPersonalExpense, OwnerWalletConfig } from "@/app/api/vending-log/personal-expenses/route";

interface OwnerPersonalWalletProps {
  finalProfit: number; // Final business net profit (Sold Profit - Overheads - Mortality)
  activeMonth: string; // e.g. "2026-10" or "all"
  isAdmin: boolean;
  onSpentChange?: (totalSpentThisMonth: number) => void;
}

const CATEGORY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  "Food & Dining": { icon: "restaurant", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  "Personal Fuel & Travel": { icon: "local_gas_station", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  "Family & Home": { icon: "cottage", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  "Personal Shopping": { icon: "shopping_bag", color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20" },
  "Health & Medical": { icon: "medication", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
  "Personal Utilities": { icon: "bolt", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  "Cash Drawer Draw": { icon: "payments", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  "Other": { icon: "receipt", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" },
};

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export default function OwnerPersonalWallet({
  finalProfit,
  activeMonth,
  isAdmin,
  onSpentChange,
}: OwnerPersonalWalletProps) {
  const [entries, setEntries] = useState<OwnerPersonalExpense[]>([]);
  const [config, setConfig] = useState<OwnerWalletConfig>({
    monthly_budget_cap: 25000,
    warning_threshold_pct: 80,
  });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showLogModal, setShowLogModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State for Log Modal
  const [formTitle, setFormTitle] = useState("");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("Food & Dining");
  const [formPaymentSource, setFormPaymentSource] = useState<string>("Cash from Drawer");
  const [formNotes, setFormNotes] = useState("");
  const [formDate, setFormDate] = useState(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch (_) {
      return new Date().toISOString().split("T")[0];
    }
  });

  // Budget Edit Form
  const [budgetCapInput, setBudgetCapInput] = useState<string>("25000");

  // Fetch entries & config
  const fetchWalletData = useCallback(async () => {
    try {
      const res = await fetch(`/api/vending-log/personal-expenses?month=${activeMonth || "all"}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEntries(data.entries || []);
          if (data.budgetConfig) {
            setConfig(data.budgetConfig);
            setBudgetCapInput(String(data.budgetConfig.monthly_budget_cap || 25000));
          }
        }
      }
    } catch (err) {
      console.warn("Error fetching personal wallet data:", err);
    } finally {
      setLoading(false);
    }
  }, [activeMonth]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Filtered month entries
  const currentMonthEntries = useMemo(() => {
    if (!activeMonth || activeMonth === "all") return entries;
    return entries.filter((e) => e.expense_date.startsWith(activeMonth));
  }, [entries, activeMonth]);

  // Total spent this month
  const totalMonthSpent = useMemo(() => {
    return currentMonthEntries.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [currentMonthEntries]);

  // Inform parent of current month spent for subtle dashboard card indicator
  useEffect(() => {
    if (onSpentChange) {
      onSpentChange(totalMonthSpent);
    }
  }, [totalMonthSpent, onSpentChange]);

  // Filtered list for display in ledger
  const displayedEntries = useMemo(() => {
    return currentMonthEntries.filter((item) => {
      if (selectedCategoryFilter !== "all" && item.category !== selectedCategoryFilter) {
        return false;
      }
      if (selectedSourceFilter !== "all" && item.payment_source !== selectedSourceFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        const matchesCat = item.category?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesCat) return false;
      }
      return true;
    });
  }, [currentMonthEntries, selectedCategoryFilter, selectedSourceFilter, searchQuery]);

  // Accounting Math
  const netRetainedProfit = Math.round(finalProfit - totalMonthSpent);
  const profitDrawnPct = finalProfit > 0 ? Math.min(100, (totalMonthSpent / finalProfit) * 100) : 0;
  const budgetCap = config.monthly_budget_cap || 25000;
  const budgetUsedPct = budgetCap > 0 ? Math.min(100, (totalMonthSpent / budgetCap) * 100) : 0;
  const budgetRemaining = Math.max(0, budgetCap - totalMonthSpent);

  // Daily burn rate telemetry
  const daysInMonth = 30; // Approx
  const dayOfMonth = (() => {
    try {
      const d = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric" }).format(new Date());
      return parseInt(d, 10) || 1;
    } catch (_) {
      return new Date().getDate();
    }
  })();
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);
  const currentDailyPace = Math.round(totalMonthSpent / Math.max(1, dayOfMonth));
  const safeDailyRemainingPace = Math.round(budgetRemaining / daysRemaining);

  // Status indicator
  const isBudgetExceeded = totalMonthSpent > budgetCap;
  const isBudgetWarning = budgetUsedPct >= (config.warning_threshold_pct || 80);

  // Submit new expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Math.round(Number(formAmount));
    if (!formTitle.trim() || !parsedAmount || parsedAmount <= 0) {
      alert("Please enter a valid expense title and positive amount.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/vending-log/personal-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          amount: parsedAmount,
          category: formCategory,
          payment_source: formPaymentSource,
          notes: formNotes.trim() || undefined,
          expense_date: formDate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.entry) {
          setEntries((prev) => [data.entry, ...prev]);
          setShowLogModal(false);
          setFormTitle("");
          setFormAmount("");
          setFormNotes("");
        } else {
          alert(data.error || "Failed to log expense");
        }
      } else {
        alert("Server error logging expense");
      }
    } catch (err: any) {
      alert("Network error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete expense
  const handleDeleteExpense = async (id: string) => {
    try {
      const res = await fetch(`/api/vending-log/personal-expenses?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // Save budget cap
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCap = Math.max(0, Math.round(Number(budgetCapInput) || 0));
    try {
      const res = await fetch("/api/vending-log/personal-expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_budget",
          monthly_budget_cap: parsedCap,
          warning_threshold_pct: 80,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.budgetConfig) {
          setConfig(data.budgetConfig);
          setShowBudgetModal(false);
        }
      }
    } catch (err) {
      console.error("Save budget cap failed:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* SECTION BANNER & CONTROLS                                                  */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-purple-950/20 to-slate-900/90 border border-purple-500/20 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 material-symbols-outlined text-lg">
                account_balance_wallet
              </span>
              <h2 className="text-base font-bold text-white tracking-wide font-sans flex items-center gap-2">
                Owner Personal Wallet &amp; Profit Drawings
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  Peace-of-Mind Isolation
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-sans">
              Personal expenses and drawings are deducted <span className="text-purple-300 font-semibold underline underline-offset-2">only from Final Profit</span>. Vending center sales, inventory, and operational metrics remain 100% untouched.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setShowBudgetModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer shadow-sm"
              title="Set Monthly Budget Limit"
            >
              <span className="material-symbols-outlined text-sm text-purple-400">tune</span>
              Budget Guard
            </button>

            <button
              type="button"
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/40 shadow-lg shadow-purple-900/30 transition-all cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Log Personal Expense
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4 EXECUTIVE KPI FLASH CARDS                                               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Personal Spent */}
        <div className="relative p-4 rounded-2xl bg-slate-900/80 border border-rose-500/30 shadow-lg backdrop-blur-md overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5 text-rose-300 font-semibold">
              <span className="material-symbols-outlined text-sm text-rose-400">payments</span>
              Personal Drawings
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
              {currentMonthEntries.length} draws
            </span>
          </div>

          <div className="text-2xl font-black font-mono text-rose-400 tracking-tight">
            ₹{totalMonthSpent.toLocaleString("en-IN")}
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Drawn from profit:</span>
            <span className="text-rose-300 font-semibold">
              {profitDrawnPct.toFixed(1)}% of net
            </span>
          </div>
        </div>

        {/* Card 2: Vending Center Net Profit Pool */}
        <div className="relative p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30 shadow-lg backdrop-blur-md overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
              <span className="material-symbols-outlined text-sm text-cyan-400">trending_up</span>
              Business Net Profit
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Starting Pool
            </span>
          </div>

          <div className="text-2xl font-black font-mono text-cyan-400 tracking-tight">
            ₹{finalProfit.toLocaleString("en-IN")}
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Business Status:</span>
            <span className="text-cyan-300 font-semibold">100% Intact</span>
          </div>
        </div>

        {/* Card 3: Retained In-Pocket Profit */}
        <div className={`relative p-4 rounded-2xl bg-slate-900/80 border shadow-lg backdrop-blur-md overflow-hidden group ${
          netRetainedProfit >= 0
            ? "border-emerald-500/40 shadow-emerald-950/20"
            : "border-red-500/50 shadow-red-950/20"
        }`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-xl pointer-events-none ${
            netRetainedProfit >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
          }`} />
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span className={`flex items-center gap-1.5 font-semibold ${
              netRetainedProfit >= 0 ? "text-emerald-300" : "text-red-300"
            }`}>
              <span className="material-symbols-outlined text-sm">
                {netRetainedProfit >= 0 ? "savings" : "warning"}
              </span>
              In-Pocket Retained
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              netRetainedProfit >= 0
                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                : "bg-red-500/10 text-red-300 border-red-500/20"
            }`}>
              Net Savings
            </span>
          </div>

          <div className={`text-2xl font-black font-mono tracking-tight ${
            netRetainedProfit >= 0 ? "text-emerald-400" : "text-red-400"
          }`}>
            ₹{netRetainedProfit.toLocaleString("en-IN")}
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Formula:</span>
            <span className="text-slate-300 font-semibold text-[10px]">
              Profit - Personal Draws
            </span>
          </div>
        </div>

        {/* Card 4: Budget Guard & Pace Telemetry */}
        <div className={`relative p-4 rounded-2xl bg-slate-900/80 border shadow-lg backdrop-blur-md overflow-hidden group ${
          isBudgetExceeded
            ? "border-red-500/50"
            : isBudgetWarning
            ? "border-amber-500/50"
            : "border-purple-500/30"
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5 text-purple-300 font-semibold">
              <span className="material-symbols-outlined text-sm text-purple-400">shield</span>
              Budget Guard
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${
              isBudgetExceeded
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : isBudgetWarning
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-purple-500/20 text-purple-300 border-purple-500/40"
            }`}>
              {isBudgetExceeded ? "Exceeded!" : isBudgetWarning ? "Warning" : "Safe Pace"}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-lg font-black font-mono text-white">
              ₹{totalMonthSpent.toLocaleString("en-IN")}{" "}
              <span className="text-xs font-normal text-slate-400">/ ₹{budgetCap.toLocaleString("en-IN")}</span>
            </div>
            <span className="text-xs font-mono font-bold text-purple-300">
              {budgetUsedPct.toFixed(0)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isBudgetExceeded
                  ? "bg-red-500 shadow-sm shadow-red-500"
                  : isBudgetWarning
                  ? "bg-amber-500 shadow-sm shadow-amber-500"
                  : "bg-gradient-to-r from-purple-500 to-indigo-500"
              }`}
              style={{ width: `${Math.min(100, budgetUsedPct)}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Burn: ₹{currentDailyPace}/day</span>
            <span className="text-purple-300 font-semibold">Rem: ₹{safeDailyRemainingPace}/day</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FILTER CONTROLS & LEDGER TOOLBAR                                          */}
      {/* ========================================================================= */}
      <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-md backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-[11px] text-slate-500 font-bold uppercase mr-1">Filter:</span>
          <button
            type="button"
            onClick={() => setSelectedCategoryFilter("all")}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              selectedCategoryFilter === "all"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            All Categories ({currentMonthEntries.length})
          </button>
          {Object.keys(CATEGORY_ICONS).map((cat) => {
            const count = currentMonthEntries.filter((e) => e.category === cat).length;
            if (count === 0 && selectedCategoryFilter !== cat) return null;
            const { icon, color } = CATEGORY_ICONS[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <span className={`material-symbols-outlined text-[13px] ${color}`}>{icon}</span>
                <span>{cat}</span>
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Source & Search */}
        <div className="flex items-center gap-2">
          {/* Source Filter */}
          <select
            value={selectedSourceFilter}
            onChange={(e) => setSelectedSourceFilter(e.target.value)}
            className="text-xs font-mono bg-slate-800/80 text-slate-300 border border-slate-700/60 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:border-purple-500/50"
          >
            <option value="all">All Sources</option>
            <option value="Cash from Drawer">Cash from Drawer</option>
            <option value="Personal UPI / Bank">Personal UPI / Bank</option>
            <option value="Other">Other</option>
          </select>

          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-sm pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses..."
              className="text-xs font-mono bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-xl pl-8 pr-3 py-1.5 outline-none placeholder:text-slate-500 focus:border-purple-500/50 w-36 sm:w-44"
            />
          </div>

          <button
            type="button"
            onClick={fetchWalletData}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PERSONAL DRAWINGS LEDGER TABLE                                             */}
      {/* ========================================================================= */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-md">
        <div className="p-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-400 text-sm">list_alt</span>
            <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              Personal Drawings Ledger ({displayedEntries.length} entries)
            </h3>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Total Displayed: <span className="font-bold text-rose-400">₹{displayedEntries.reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {displayedEntries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
            </div>
            <p className="text-sm font-sans font-medium text-slate-300">
              No personal expenses recorded for this month
            </p>
            <p className="text-xs font-sans text-slate-500 max-w-sm mx-auto">
              Whenever you withdraw cash from the register or pay personal bills from vending earnings, log it here to keep your peace of mind.
            </p>
            <button
              type="button"
              onClick={() => setShowLogModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Log First Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Date &amp; Time</th>
                  <th className="py-2.5 px-4 font-bold">Category</th>
                  <th className="py-2.5 px-4 font-bold">Description</th>
                  <th className="py-2.5 px-4 font-bold">Payment Source</th>
                  <th className="py-2.5 px-4 font-bold text-right">Amount</th>
                  <th className="py-2.5 px-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {displayedEntries.map((item) => {
                  const catStyle = CATEGORY_ICONS[item.category] || CATEGORY_ICONS["Other"];
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-400 text-[11px]">
                        <div className="font-semibold text-slate-200">{item.expense_date}</div>
                        <div className="text-[10px] text-slate-500">{item.expense_time}</div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${catStyle.bg} ${catStyle.color}`}>
                          <span className="material-symbols-outlined text-[13px]">{catStyle.icon}</span>
                          {item.category}
                        </span>
                      </td>

                      {/* Title & Notes */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-white tracking-wide">{item.title}</div>
                        {item.notes && (
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5 line-clamp-1 italic">
                            &quot;{item.notes}&quot;
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                          item.payment_source === "Cash from Drawer"
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/20"
                            : item.payment_source === "Personal UPI / Bank"
                            ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700"
                        }`}>
                          <span className="material-symbols-outlined text-[12px]">
                            {item.payment_source === "Cash from Drawer" ? "payments" : "qr_code_2"}
                          </span>
                          {item.payment_source}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 whitespace-nowrap text-right font-black text-rose-400 text-sm">
                        -₹{Number(item.amount).toLocaleString("en-IN")}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        {deleteConfirmId === item.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(item.id)}
                              className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold cursor-pointer transition-all"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] cursor-pointer transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(item.id)}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                            title="Delete entry"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: LOG PERSONAL EXPENSE                                               */}
      {/* ========================================================================= */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-purple-500/30 shadow-2xl p-6 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 material-symbols-outlined text-base">
                  account_balance_wallet
                </span>
                <h3 className="text-base font-bold text-white font-sans">Log Personal Drawing</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="mt-4 space-y-4">
              {/* Preset Amount Chips */}
              <div>
                <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1.5">
                  Quick Amount Select (₹)
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFormAmount(String(amt))}
                      className={`py-1.5 px-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                        formAmount === String(amt)
                          ? "bg-purple-600 text-white border-purple-400 shadow-sm"
                          : "bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700"
                      }`}
                    >
                      ₹{amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                  Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">₹</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="Enter amount..."
                    className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-lg outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                  Expense Title / Purpose *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Lunch with friends, Car fuel, Home groceries..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-purple-500"
                />
              </div>

              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-purple-500 cursor-pointer"
                  >
                    {Object.keys(CATEGORY_ICONS).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Source */}
                <div>
                  <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                    Drawn From
                  </label>
                  <select
                    value={formPaymentSource}
                    onChange={(e) => setFormPaymentSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Cash from Drawer">Cash from Drawer</option>
                    <option value="Personal UPI / Bank">Personal UPI / Bank</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono outline-none focus:border-purple-500"
                />
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Additional context or bill memo..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs outline-none focus:border-purple-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">check</span>
                  {isSubmitting ? "Logging..." : "Confirm Drawing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SET BUDGET CAP                                                      */}
      {/* ========================================================================= */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-purple-500/30 shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 material-symbols-outlined text-base">
                  tune
                </span>
                <h3 className="text-base font-bold text-white font-sans">Monthly Budget Guard</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBudgetModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="mt-4 space-y-4">
              <p className="text-xs text-slate-400 font-sans">
                Set a monthly maximum cap on personal drawings from vending center profits. If spending approaches this cap, the telemetry cards will turn amber/red to protect your peace of mind.
              </p>

              <div>
                <label className="block text-[11px] font-mono uppercase font-bold text-slate-400 mb-1">
                  Monthly Drawing Cap (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={budgetCapInput}
                    onChange={(e) => setBudgetCapInput(e.target.value)}
                    placeholder="25000"
                    className="w-full pl-8 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-lg outline-none focus:border-purple-500"
                  />
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  Current: ₹{budgetCap.toLocaleString("en-IN")} / month
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBudgetModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-mono font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition-all cursor-pointer"
                >
                  Save Budget Guard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
