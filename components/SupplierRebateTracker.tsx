"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { adminFetch } from "@/lib/adminClient";
import { KHYBER_SLABS, RebateSlab, MonthRebateSummary, CreditDeduction } from "@/app/api/supplier-rebates/route";

interface SupplierRebateTrackerProps {
  onRebateUpdated?: () => void;
  onFilterToMonth?: (monthKey: string) => void;
  currentFilterMonth?: string;
  className?: string;
}

export default function SupplierRebateTracker({
  onRebateUpdated,
  onFilterToMonth,
  currentFilterMonth,
  className = "",
}: SupplierRebateTrackerProps) {
  const [loading, setLoading] = useState(true);
  const [rebatesData, setRebatesData] = useState<{
    supplier: any;
    slabs: RebateSlab[];
    monthlySummaries: Record<string, MonthRebateSummary>;
    activeMonthKey: string;
    creditLedger: {
      availableCreditBalance: number;
      totalEarnedCreditsAllTime: number;
      totalDeductedCredits: number;
      deductions: CreditDeduction[];
    };
  } | null>(null);

  // Month selection for inspecting specific historical or current months
  const [selectedMonth, setSelectedMonth] = useState<string>("2026-10");

  // Interactive Simulator state
  const [simulatorKg, setSimulatorKg] = useState<number>(350);

  // Credit Deduction Modal state
  const [deductModalOpen, setDeductModalOpen] = useState(false);
  const [deductAmount, setDeductAmount] = useState<string>("");
  const [deductDate, setDeductDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [deductNote, setDeductNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active view tab: "overview" | "ladder" | "simulator" | "ledger"
  const [activeTab, setActiveTab] = useState<"overview" | "ladder" | "simulator" | "ledger">("overview");

  // Fetch Supplier Rebate Intelligence Data
  const loadRebateData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch("/api/supplier-rebates");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRebatesData(data);
          if (data.activeMonthKey && !selectedMonth) {
            setSelectedMonth(data.activeMonthKey);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load supplier rebate data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadRebateData();
  }, [loadRebateData]);

  // Derived active month data
  const currentMonthData = useMemo(() => {
    if (!rebatesData?.monthlySummaries) return null;
    return rebatesData.monthlySummaries[selectedMonth] || null;
  }, [rebatesData, selectedMonth]);

  // September benchmark data (Finalized milestone)
  const septData = useMemo(() => {
    return rebatesData?.monthlySummaries?.["2026-09"] || null;
  }, [rebatesData]);

  // October live data
  const octData = useMemo(() => {
    return rebatesData?.monthlySummaries?.["2026-10"] || null;
  }, [rebatesData]);

  // Simulator dynamic calculation
  const simulatorResult = useMemo(() => {
    const kg = Number(simulatorKg) || 0;
    let slab = KHYBER_SLABS[0];
    let nextTarget = 300;
    let nextSlab: RebateSlab | null = KHYBER_SLABS[1];

    if (kg >= 1500) {
      slab = KHYBER_SLABS[4];
      nextSlab = null;
      nextTarget = 1500;
    } else if (kg >= 1001) {
      slab = KHYBER_SLABS[3];
      nextSlab = KHYBER_SLABS[4];
      nextTarget = 1500;
    } else if (kg >= 501) {
      slab = KHYBER_SLABS[2];
      nextSlab = KHYBER_SLABS[3];
      nextTarget = 1001;
    } else if (kg >= 300) {
      slab = KHYBER_SLABS[1];
      nextSlab = KHYBER_SLABS[2];
      nextTarget = 501;
    } else {
      slab = KHYBER_SLABS[0];
      nextSlab = KHYBER_SLABS[1];
      nextTarget = 300;
    }

    const rebateAmount = Math.round(kg * slab.rebatePerKg);
    const standardCost = Math.round(kg * 435);
    const rebatedCost = standardCost - rebateAmount;
    const kgNeeded = nextSlab ? Math.max(0, nextTarget - kg) : 0;
    const nextRebateGain = nextSlab ? Math.round(nextTarget * nextSlab.rebatePerKg) - rebateAmount : 0;

    return {
      kg,
      slab,
      nextSlab,
      rebateAmount,
      standardCost,
      rebatedCost,
      kgNeeded,
      nextRebateGain,
      effectiveBase: slab.effectiveBaseRate,
      effectiveDelivered: slab.effectiveDeliveredRate,
    };
  }, [simulatorKg]);

  // Handle Recording Credit Deduction
  const handleRecordDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(deductAmount);
    if (!amount || amount <= 0) {
      setErrorMsg("Please enter a valid deduction amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await adminFetch("/api/supplier-rebates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deduct_credit",
          amount,
          date: deductDate,
          notes: deductNote,
          logged_by: "Admin",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Successfully deducted ₹${amount.toLocaleString("en-IN")} from Khyber credit balance.`);
        setDeductAmount("");
        setDeductNote("");
        setDeductModalOpen(false);
        await loadRebateData();
        if (onRebateUpdated) onRebateUpdated();
      } else {
        setErrorMsg(data.error || "Failed to record deduction");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit deduction");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Deleting a recorded deduction
  const handleDeleteDeduction = async (id: string) => {
    if (!confirm("Are you sure you want to revert this credit deduction?")) return;
    try {
      const res = await adminFetch("/api/supplier-rebates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_deduction", id }),
      });
      if (res.ok) {
        await loadRebateData();
        if (onRebateUpdated) onRebateUpdated();
      }
    } catch (err) {
      console.error("Failed to delete deduction:", err);
    }
  };

  const availableCredit = rebatesData?.creditLedger?.availableCreditBalance ?? 3020;
  const octKg = octData?.totalKg ?? 110;
  const octProgress = octData?.progressPercent ?? 36.7;
  const octKgNeeded = octData?.kgToNext ?? 190;

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      {/* ══════════ MAIN HEADER BANNER ══════════ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-blue-950/70 to-slate-900 border border-blue-500/30 p-4 sm:p-5 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                Primary Live Trout Supplier
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                <span className="material-symbols-outlined text-xs">verified</span>
                ERP Confirmed: Syed Ihtsham Qadri / Ubaid
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 font-mono">
              <span className="text-blue-400">🏢 Khyber Aquaculture</span>
              <span className="text-slate-400 text-sm font-normal">| Volume Slab &amp; Credit Tracker</span>
            </h2>

            <p className="text-xs text-slate-300 font-mono leading-relaxed max-w-3xl">
              <strong>Billing Model:</strong> Fixed invoice base ₹410/Kg + ₹25/Kg fixed transport = ₹435/Kg delivered.
              Monthly volume crossing slab thresholds unlocks cash rebate credits applied against your supplier ledger.
            </p>
          </div>

          {/* Quick Credit Pill & Actions */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 backdrop-blur-md self-start md:self-center">
            <div className="text-right pr-2 border-r border-slate-800">
              <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Available Credit Balance
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono tracking-tight flex items-center justify-end gap-1">
                <span>₹{availableCredit.toLocaleString("en-IN")}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  CR
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDeductModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
              title="Record when you deduct from payment of a stock batch"
            >
              <span className="material-symbols-outlined text-sm">payments</span>
              <span>Deduct Credit</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                activeTab === "overview"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📊 Live Flash Cards
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ladder")}
              className={`px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                activeTab === "ladder"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🪜 Slab Ladder (5 Tiers)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("simulator")}
              className={`px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                activeTab === "simulator"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🧮 What-If Simulator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`px-3 py-1 rounded-lg transition-all font-bold cursor-pointer ${
                activeTab === "ledger"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              💳 Credit Ledger ({rebatesData?.creditLedger?.deductions?.length || 0})
            </button>
          </div>

          {/* Month Filter Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Inspect Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="2026-10">October 2026 (Live Current)</option>
              <option value="2026-09">September 2026 (Settled: ₹3,020)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ══════════ SUCCESS / ERROR MESSAGES ══════════ */}
      {successMsg && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-sm">check_circle</span>
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 1: LIVE FLASH CARDS SUITE
          ══════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-3.5">
          {/* Top 3 Primary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Card 1: October 2026 Live Target & Milestone */}
            <div className="rounded-2xl bg-gradient-to-br from-blue-950/50 via-slate-900/90 to-slate-950 border border-blue-500/40 p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-blue-300 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                    OCTOBER 2026 · LIVE PROGRESS
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                    Tier 1 (Base)
                  </span>
                </div>

                <div className="pt-1 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-white font-mono">{octKg.toFixed(1)}</span>
                    <span className="text-slate-400 font-mono text-xs ml-1">/ 300.0 Kg</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">{octProgress}%</span>
                </div>

                {/* Progress bar to 300 Kg slab */}
                <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, octProgress)}%` }}
                  />
                </div>

                <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Remaining to ₹10/Kg Rebate:</span>
                    <strong className="text-amber-400 font-bold">{octKgNeeded.toFixed(1)} Kg</strong>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Batches Lifted so far:</span>
                    <span className="text-white font-bold">{octData?.batchCount ?? 2} batches</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Unlock at 300 Kg:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  +₹3,000+ Cashback Credit
                </span>
              </div>
            </div>

            {/* Card 2: Khyber Available Credit Ledger */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900/90 to-slate-950 border border-emerald-500/40 p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-emerald-400">account_balance_wallet</span>
                    KHYBER CREDIT LEDGER
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    Holding Credit
                  </span>
                </div>

                <div className="pt-1 flex items-baseline gap-1">
                  <span className="text-emerald-400 font-bold text-lg font-mono">₹</span>
                  <span className="text-3xl font-black text-white font-mono">
                    {availableCredit.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs text-slate-400 font-mono ml-2">Available</span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Earned in September:</span>
                    <strong className="text-emerald-300 font-bold">+₹3,020.00</strong>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Deducted from Invoices:</span>
                    <span className="text-slate-400">
                      -₹{(rebatesData?.creditLedger?.totalDeductedCredits || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Next batch discount:</span>
                <button
                  type="button"
                  onClick={() => setDeductModalOpen(true)}
                  className="text-emerald-400 hover:text-emerald-300 font-bold underline cursor-pointer"
                >
                  Record Deduction ➔
                </button>
              </div>
            </div>

            {/* Card 3: September 2026 Milestone Finalized */}
            <div className="rounded-2xl bg-gradient-to-br from-violet-950/50 via-slate-900/90 to-slate-950 border border-violet-500/40 p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-violet-300 font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-violet-400">verified</span>
                    SEPTEMBER 2026 · ACHIEVED
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                    Slab 2 (₹10/Kg)
                  </span>
                </div>

                <div className="pt-1 flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-black text-white font-mono">302.0</span>
                    <span className="text-slate-400 font-mono text-xs ml-1">Kg Lifted</span>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold font-mono text-lg">+₹3,020</span>
                    <div className="text-[10px] text-slate-400 font-mono">Rebate Credited</div>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Effective Base Rate:</span>
                    <strong className="text-cyan-300 font-bold">₹400 / Kg</strong>
                    <span className="text-[10px] text-slate-500">(Saved ₹10/Kg)</span>
                  </div>
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-slate-400">Profit Boost:</span>
                    <strong className="text-emerald-400">+₹3,020 in Sept P&amp;L</strong>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Confirmed by Khyber ERP:</span>
                <span className="text-slate-300 font-mono text-[10px]">-3,020.00 Cr verified</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Selected Month Breakdown & Insights */}
          {currentMonthData && (
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 font-mono text-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-base">analytics</span>
                  <span className="font-bold text-white text-sm">
                    Detailed Analysis: {currentMonthData.monthLabel}
                  </span>
                  {selectedMonth === "2026-09" && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      Settled Slab
                    </span>
                  )}
                  {selectedMonth === "2026-10" && (
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold">
                      In Progress (190 Kg to next slab)
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400">
                  {currentMonthData.batchCount} Procurement Batches Logged
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-slate-400 text-[10px] uppercase">Total Weight Lifted</div>
                  <div className="text-lg font-black text-white mt-0.5">
                    {currentMonthData.totalKg.toFixed(3)} Kg
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Standard billing: ₹435/Kg
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-slate-400 text-[10px] uppercase">Unlocked Slab Tier</div>
                  <div className="text-lg font-black text-cyan-300 mt-0.5">
                    {currentMonthData.currentSlab.name}
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5 font-bold">
                    ₹{currentMonthData.currentSlab.rebatePerKg}/Kg Volume Rebate
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-slate-400 text-[10px] uppercase">Total Rebate Earned</div>
                  <div className="text-lg font-black text-emerald-400 mt-0.5">
                    ₹{currentMonthData.rebateEarned.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Credited to Khyber Ledger
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="text-slate-400 text-[10px] uppercase">Effective Net Cost</div>
                  <div className="text-lg font-black text-teal-300 mt-0.5">
                    ₹{currentMonthData.effectiveDeliveredRate}/Kg
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Base: ₹{currentMonthData.effectiveBaseRate} + Transport: ₹25
                  </div>
                </div>
              </div>

              {/* Batches list for this month */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-[11px] font-bold text-slate-300 mb-2">
                  Batches Lifted in {currentMonthData.monthLabel}:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {currentMonthData.batches.map((b: any, idx: number) => (
                    <div
                      key={b.id || idx}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-200">
                          {b.stock_date} <span className="text-slate-500 text-[10px]">{b.stock_time}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {b.notes || b.batch_notes || "Standard Delivery"}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-cyan-300">{Number(b.weight_kg).toFixed(1)} Kg</span>
                        <div className="text-[10px] text-slate-500">₹{b.cost_per_kg || 435}/Kg</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 2: SLAB LADDER (5 TIERS ROADMAP)
          ══════════════════════════════════════════════════════════ */}
      {activeTab === "ladder" && (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 font-mono text-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🪜 Khyber Aquaculture Volume Rebate Scheme Ladder</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Evaluated cumulatively at month-end on all live trout lifted from Khyber. Rebate is applied uniformly to all kilograms.
              </p>
            </div>
            <div className="text-[11px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              Fixed Base: <strong className="text-white">₹410/Kg</strong> • Transport: <strong className="text-white">₹25/Kg</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {KHYBER_SLABS.map((slab) => {
              const isSeptAchieved = slab.tier === 2;
              const isOctCurrent = slab.tier === 1;

              return (
                <div
                  key={slab.tier}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all relative ${
                    isSeptAchieved
                      ? "bg-violet-950/40 border-violet-500/60 shadow-lg shadow-violet-950/30"
                      : isOctCurrent
                      ? "bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-950/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400"
                  }`}
                >
                  {isSeptAchieved && (
                    <span className="absolute -top-2.5 right-3 px-2 py-0.2 rounded-full bg-violet-600 text-[9px] font-bold text-white uppercase tracking-wider shadow">
                      Sep Unlocked (302 Kg)
                    </span>
                  )}
                  {isOctCurrent && (
                    <span className="absolute -top-2.5 right-3 px-2 py-0.2 rounded-full bg-blue-600 text-[9px] font-bold text-white uppercase tracking-wider shadow">
                      Oct Current (110 Kg)
                    </span>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">Tier {slab.tier}</span>
                      <span
                        className={`text-xs font-black ${
                          slab.rebatePerKg > 0 ? "text-emerald-400" : "text-slate-500"
                        }`}
                      >
                        {slab.rebatePerKg > 0 ? `₹${slab.rebatePerKg}/Kg Rebate` : "₹0 Rebate"}
                      </span>
                    </div>

                    <div className="text-base font-black text-white">
                      {slab.maxKg ? `${slab.minKg} – ${Math.floor(slab.maxKg)} Kg` : `${slab.minKg}+ Kg`}
                    </div>

                    <div className="text-[10px] text-slate-400 leading-tight">
                      {slab.description}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-800 space-y-1 text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Effective Base:</span>
                      <span className="text-cyan-300 font-bold">₹{slab.effectiveBaseRate}/Kg</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Delivered Cost:</span>
                      <span className="text-teal-300 font-bold">₹{slab.effectiveDeliveredRate}/Kg</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-amber-400 text-sm mt-0.5">info</span>
            <div>
              <strong>Important Rule from Khyber Aquaculture:</strong> Daily and weekly deliveries are invoiced at the standard ₹435/Kg rate.
              Rebates are computed retroactively at month-end based on total cumulative volume and credited into your supplier account (e.g., ₹3,020 credited for September),
              which you can deduct directly against subsequent stock delivery payments.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 3: INTERACTIVE "WHAT-IF" SIMULATOR
          ══════════════════════════════════════════════════════════ */}
      {activeTab === "simulator" && (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 font-mono text-xs space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🧮 Interactive "What-If" Volume Slab Simulator</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simulate lifting different monthly volumes from Khyber to calculate your unlocked rebate, net procurement rate, and extra farm profit.
            </p>
          </div>

          {/* Slider and Quick Presets */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label htmlFor="simulator-kg-input" className="text-xs font-bold text-slate-200">Target Monthly Lifting Weight (Kg):</label>
              <div className="flex items-center gap-2">
                <input
                  id="simulator-kg-input"
                  type="number"
                  min="0"
                  max="2500"
                  step="10"
                  value={simulatorKg}
                  onChange={(e) => setSimulatorKg(Math.max(0, Number(e.target.value) || 0))}
                  className="w-28 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm font-bold text-right outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-slate-400 font-bold">Kg</span>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="2000"
              step="10"
              value={simulatorKg}
              onChange={(e) => setSimulatorKg(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Quick Presets:</span>
              {[250, 300, 350, 500, 550, 800, 1000, 1200, 1500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSimulatorKg(preset)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    simulatorKg === preset
                      ? "bg-blue-600 text-white"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {preset} Kg
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Simulation Result Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-950/40 via-slate-950 to-slate-950 border border-blue-500/30">
              <div className="text-slate-400 text-[10px] uppercase">Unlocked Slab</div>
              <div className="text-lg font-black text-cyan-300 mt-1">
                {simulatorResult.slab.name}
              </div>
              <div className="text-[11px] text-emerald-400 font-bold mt-1">
                ₹{simulatorResult.slab.rebatePerKg}/Kg Volume Rebate
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-500/30">
              <div className="text-slate-400 text-[10px] uppercase">Total Cash Rebate</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                ₹{simulatorResult.rebateAmount.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {simulatorResult.slab.rebatePerKg > 0
                  ? `Across all ${simulatorResult.kg} Kg lifted`
                  : "Lift 300+ Kg to unlock rebate"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-br from-teal-950/40 via-slate-950 to-slate-950 border border-teal-500/30">
              <div className="text-slate-400 text-[10px] uppercase">Effective Net Rates</div>
              <div className="text-lg font-black text-white mt-1">
                ₹{simulatorResult.effectiveDelivered}/Kg Delivered
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Base: ₹{simulatorResult.effectiveBase}/Kg (+₹25 Transport)
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/30">
              <div className="text-slate-400 text-[10px] uppercase">Next Milestone Target</div>
              {simulatorResult.nextSlab ? (
                <>
                  <div className="text-lg font-black text-amber-300 mt-1">
                    +{simulatorResult.kgNeeded} Kg Needed
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    to unlock ₹{simulatorResult.nextSlab.rebatePerKg}/Kg ({simulatorResult.nextSlab.name})
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-black text-emerald-400 mt-1">Maximum Tier!</div>
                  <div className="text-[10px] text-slate-400 mt-1">Top platinum volume tier achieved</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 4: CREDIT LEDGER & DEDUCTION AUDIT
          ══════════════════════════════════════════════════════════ */}
      {activeTab === "ledger" && (
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 font-mono text-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>💳 Khyber Aquaculture Credit Ledger &amp; Deductions</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Audit trail of volume rebate credits earned from monthly procurement and deductions used against stock invoices.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDeductModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Record Credit Deduction
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Total Earned Credits</div>
              <div className="text-xl font-black text-emerald-400 mt-1">
                ₹{(rebatesData?.creditLedger?.totalEarnedCreditsAllTime || 3020).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-500">From finalized volume slabs</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase">Total Deductions Applied</div>
              <div className="text-xl font-black text-rose-400 mt-1">
                -₹{(rebatesData?.creditLedger?.totalDeductedCredits || 0).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-500">Subtracted from stock payments</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 uppercase font-bold">Available Credit Balance</div>
              <div className="text-xl font-black text-emerald-300 mt-1">
                ₹{availableCredit.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-slate-400">Available to deduct on next order</div>
            </div>
          </div>

          {/* Deductions Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <div className="p-2.5 bg-slate-900 border-b border-slate-800 text-[11px] font-bold text-slate-300">
              Recorded Payment Deductions
            </div>
            {(!rebatesData?.creditLedger?.deductions || rebatesData.creditLedger.deductions.length === 0) ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                No deductions recorded yet. The full ₹3,020.00 credit is currently available with Khyber.
                Click &quot;Record Credit Deduction&quot; when you subtract an amount from your next batch payment.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount (₹)</th>
                    <th className="py-2.5 px-3">Notes</th>
                    <th className="py-2.5 px-3">Logged By</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {rebatesData.creditLedger.deductions.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-900/50">
                      <td className="py-2 px-3 text-slate-300">{d.date}</td>
                      <td className="py-2 px-3 text-rose-400 font-bold">
                        -₹{Number(d.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2 px-3 text-slate-400">{d.notes || "—"}</td>
                      <td className="py-2 px-3 text-slate-500">{d.logged_by || "Admin"}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteDeduction(d.id)}
                          className="text-rose-400 hover:text-rose-300 text-[10px] font-bold underline cursor-pointer"
                        >
                          Revert
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════ DEDUCT CREDIT MODAL ══════════ */}
      {deductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">payments</span>
                <h4 className="text-sm font-bold text-white">Record Credit Deduction</h4>
              </div>
              <button
                type="button"
                onClick={() => setDeductModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              When you pay Khyber Aquaculture for a new batch and deduct part (or all) of your available rebate balance (₹{availableCredit.toLocaleString("en-IN")}), record it here to keep your credit ledger in sync.
            </p>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px]">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRecordDeduction} className="space-y-3">
              <div>
                <label htmlFor="deduct-amount-input" className="block text-[10.5px] uppercase text-slate-400 mb-1">
                  Deduction Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">₹</span>
                  <input
                    id="deduct-amount-input"
                    type="number"
                    max={availableCredit}
                    min="1"
                    required
                    value={deductAmount}
                    onChange={(e) => setDeductAmount(e.target.value)}
                    placeholder={`e.g. ${Math.min(3020, availableCredit)}`}
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                  <span>Available balance: ₹{availableCredit.toLocaleString("en-IN")}</span>
                  <button
                    type="button"
                    onClick={() => setDeductAmount(String(availableCredit))}
                    className="text-emerald-400 hover:underline cursor-pointer"
                  >
                    Use Full ₹{availableCredit}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="deduct-date-input" className="block text-[10.5px] uppercase text-slate-400 mb-1">
                  Deduction Date
                </label>
                <input
                  id="deduct-date-input"
                  type="date"
                  value={deductDate}
                  onChange={(e) => setDeductDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="deduct-notes-input" className="block text-[10.5px] uppercase text-slate-400 mb-1">
                  Notes / Batch Reference
                </label>
                <input
                  id="deduct-notes-input"
                  type="text"
                  value={deductNote}
                  onChange={(e) => setDeductNote(e.target.value)}
                  placeholder="e.g. Deducted against Batch #7 (08-Oct-2026) payment"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeductModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {isSubmitting ? "Recording..." : "Confirm Deduction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
