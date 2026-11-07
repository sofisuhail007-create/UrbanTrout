"use client";

import React, { useState } from "react";
import { StaffIncentivePayout } from "@/app/api/vending-log/incentive/route";
import { formatIstDateDisplay, formatKg } from "./page";

export interface MonthIncentiveSummary {
  monthKey: string;
  monthLabel: string;
  guttedKg: number;
  earned: number;
  paid: number;
  balance: number;
  payoutCount: number;
  payouts: StaffIncentivePayout[];
  isCurrent: boolean;
  isPrevious: boolean;
}

interface StaffIncentiveCardProps {
  isAdmin?: boolean;
  workerName?: string;
  todayStr: string; // YYYY-MM-DD
  todayGuttedKg: number;
  todayEarned: number;
  todayRate?: number; // ₹5/Kg standard
  allTimeEarned: number;
  allTimeGuttedKg: number;
  allTimeSelfCleanedKg?: number;
  totalPaid: number;
  balanceRemaining: number;
  lastPayout?: StaffIncentivePayout | null;
  thisMonthKey?: string;
  thisMonthLabel?: string;
  thisMonthEarned?: number;
  thisMonthGuttedKg?: number;
  thisMonthPaid?: number;
  prevMonthKey?: string;
  prevMonthLabel?: string;
  prevMonthEarned?: number;
  prevMonthGuttedKg?: number;
  prevMonthPaid?: number;
  monthWiseIncentives?: MonthIncentiveSummary[];
  payoutsList?: StaffIncentivePayout[];
  salaryPaymentsList?: any[];
  salaryStats?: any;
  onOpenPayoutModal?: () => void;
  onOpenLeaveModal?: () => void;
  onOpenSalaryModal?: () => void;
}

export default function StaffIncentiveCard({
  isAdmin = false,
  workerName = "Mohd Amin",
  todayStr,
  todayGuttedKg,
  todayEarned,
  todayRate = 5,
  allTimeEarned,
  allTimeGuttedKg,
  allTimeSelfCleanedKg = 0,
  totalPaid,
  balanceRemaining,
  lastPayout,
  thisMonthKey,
  thisMonthLabel = "November 2026",
  thisMonthEarned = 0,
  thisMonthGuttedKg = 0,
  thisMonthPaid = 0,
  prevMonthKey,
  prevMonthLabel = "October 2026",
  prevMonthEarned = 0,
  prevMonthGuttedKg = 0,
  prevMonthPaid = 0,
  monthWiseIncentives = [],
  payoutsList = [],
  salaryPaymentsList = [],
  salaryStats,
  onOpenPayoutModal,
  onOpenLeaveModal,
  onOpenSalaryModal,
}: StaffIncentiveCardProps) {
  // Toggle full statement & passbook drawer
  const [passbookOpen, setPassbookOpen] = useState(false);
  const [passbookTab, setPassbookTab] = useState<"months" | "payouts" | "salary">("months");

  const thisMonthBalanceDue = Math.max(0, thisMonthEarned - thisMonthPaid);
  const prevMonthBalanceDue = Math.max(0, prevMonthEarned - prevMonthPaid);

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-950/40 via-slate-900/90 to-slate-950 border border-purple-500/40 shadow-2xl relative overflow-hidden animate-fadeIn">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ─── Header & Status ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center flex-shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-2xl">volunteer_activism</span>
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 font-mono">
                Staff Compensation &amp; Incentive Intelligence
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[10.5px] font-bold font-mono">
                {workerName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10.5px] font-mono">
                Standard Gutting Incentive · ₹{todayRate}.00/Kg
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {workerName}&apos;s Live Earnings, Monthly Incentives &amp; Payout Statement
            </h2>
          </div>
        </div>

        {/* Right Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border flex items-center gap-1.5 shadow-sm ${
              balanceRemaining > 0
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${balanceRemaining > 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`}
            />
            <span>
              {balanceRemaining > 0
                ? `₹${balanceRemaining.toLocaleString("en-IN")} Pending Due`
                : "All Settled ✓ (Hisaab Clear)"}
            </span>
          </span>
        </div>
      </div>

      {/* ─── 5-Column Structured Flash Cards (Includes Dedicated Due Balance Card) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-3.5 my-4">
        {/* CARD 0: TOTAL NET DUE BALANCE */}
        <div
          className={`p-4 rounded-2xl bg-gradient-to-br ${
            balanceRemaining > 0
              ? "from-amber-950/40 via-slate-900 to-slate-950 border-amber-500/50 shadow-lg shadow-amber-950/20"
              : "from-emerald-950/40 via-slate-900 to-slate-950 border-emerald-500/40 shadow-lg shadow-emerald-950/20"
          } border relative overflow-hidden flex flex-col justify-between group`}
        >
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span
                className={`text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 ${
                  balanceRemaining > 0 ? "text-amber-300" : "text-emerald-300"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                <span>Due Balance</span>
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  balanceRemaining > 0
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {balanceRemaining > 0 ? "Pending Due" : "Settled ✓"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span
                className={`text-xl font-bold font-mono ${
                  balanceRemaining > 0 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                ₹
              </span>
              <span
                className="text-3xl font-black text-white font-mono tracking-tight"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                {balanceRemaining.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span className="truncate">
              {thisMonthBalanceDue > 0
                ? `${thisMonthLabel.split(" ")[0]}: ₹${thisMonthBalanceDue}`
                : "Month Clear"}
              {balanceRemaining - thisMonthBalanceDue > 0
                ? ` · Past: ₹${balanceRemaining - thisMonthBalanceDue}`
                : ""}
            </span>
            {balanceRemaining > 0 && onOpenPayoutModal ? (
              <button
                type="button"
                onClick={onOpenPayoutModal}
                className="text-[10.5px] font-bold text-amber-300 hover:text-amber-200 underline font-mono cursor-pointer flex items-center gap-0.5"
                title="Disburse pending incentive payout"
              >
                <span>Pay</span>
                <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
              </button>
            ) : (
              <span className="text-emerald-400 font-bold">Clear ✓</span>
            )}
          </div>
        </div>

        {/* CARD 1: EARNED TODAY */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-purple-400">wb_sunny</span>
                <span>Today · Live Gutting</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                ₹{todayRate}/Kg Rate
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-purple-400 font-mono">₹</span>
              <span className="text-3xl font-black text-white font-mono tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                {todayEarned.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Gutted: <strong className="text-white">{formatKg(todayGuttedKg)} Kg</strong></span>
            <span className="text-purple-300 font-bold">Live Counter</span>
          </div>
        </div>

        {/* CARD 2: THIS MONTH (NOVEMBER 2026 · LIVE CURRENT) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-950 border border-blue-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-blue-400">event_repeat</span>
                <span>{thisMonthLabel} · Live</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Active Month
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-blue-400 font-mono">₹</span>
                <span className="text-3xl font-black text-white font-mono tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  {thisMonthEarned.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-right text-[10.5px] font-mono">
                <span className="text-slate-400">Paid: </span>
                <strong className="text-emerald-400 font-bold">₹{thisMonthPaid.toLocaleString("en-IN")}</strong>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Gutted: <strong className="text-cyan-300">{formatKg(thisMonthGuttedKg)} Kg</strong></span>
            <span className={thisMonthBalanceDue > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
              {thisMonthBalanceDue > 0 ? `₹${thisMonthBalanceDue} Due` : "Hisaab Clear ✓"}
            </span>
          </div>
        </div>

        {/* CARD 3: PREVIOUS MONTH (OCTOBER 2026 · FINALIZED MILESTONE) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-emerald-400">verified</span>
                <span>{prevMonthLabel} · Closed</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Finalized
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-emerald-400 font-mono">₹</span>
                <span className="text-3xl font-black text-white font-mono tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  {prevMonthEarned.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-right text-[10.5px] font-mono">
                <span className="text-slate-400">Disbursed: </span>
                <strong className="text-emerald-300 font-bold">₹{prevMonthPaid.toLocaleString("en-IN")}</strong>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Gutted: <strong className="text-white">{formatKg(prevMonthGuttedKg)} Kg</strong></span>
            <span className="text-emerald-300 font-bold">
              {prevMonthBalanceDue > 0 ? `₹${prevMonthBalanceDue} Pending` : "100% Cleared ✓"}
            </span>
          </div>
        </div>

        {/* CARD 4: LAST PAYOUT SLIP (EXACT RECORD & HISAAB) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border border-amber-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">payments</span>
                <span>Last Payout Slip</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {lastPayout ? lastPayout.payment_mode : "None"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              {lastPayout ? (
                <>
                  <span className="text-xl font-bold text-amber-400 font-mono">₹</span>
                  <span className="text-3xl font-black text-white font-mono tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    {lastPayout.amount.toLocaleString("en-IN")}
                  </span>
                </>
              ) : (
                <span className="text-sm font-bold text-slate-400 font-mono mt-1 block">
                  No payouts recorded yet
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[10.5px] text-slate-300 font-mono truncate" title={lastPayout?.notes || ""}>
            {lastPayout ? (
              <span>
                Paid <strong className="text-amber-300">{formatIstDateDisplay(lastPayout.payout_date)}</strong>
                {lastPayout.payout_time ? ` (${lastPayout.payout_time})` : ""}: {lastPayout.notes || "Incentive payout"}
              </span>
            ) : (
              <span>Disbursement history will appear here</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Collapsible Detailed Passbook & Monthly Statement ─── */}
      <div className="my-3">
        <button
          type="button"
          onClick={() => setPassbookOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-purple-500/30 text-xs font-mono transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-400 text-base">receipt_long</span>
            <span className="font-bold text-white group-hover:text-purple-300 transition-colors">
              📜 Mohd Amin&apos;s Month-by-Month Statement &amp; Passbook ({payoutsList.length} Disbursements)
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Clear Hisaab Details
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-white">
            <span className="text-[11px]">{passbookOpen ? "Hide Breakdown" : "View Statement"}</span>
            <span className="material-symbols-outlined text-sm">
              {passbookOpen ? "expand_less" : "expand_more"}
            </span>
          </div>
        </button>

        {passbookOpen && (
          <div className="mt-3 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 animate-in fade-in duration-200 font-mono text-xs">
            {/* Sub-Tab Navigation */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setPassbookTab("months")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  passbookTab === "months"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                📊 Month-Wise Performance &amp; Hisaab
              </button>
              <button
                type="button"
                onClick={() => setPassbookTab("payouts")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  passbookTab === "payouts"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                🧾 Complete Cash Payout Passbook ({payoutsList.length})
              </button>
              <button
                type="button"
                onClick={() => setPassbookTab("salary")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  passbookTab === "salary"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "bg-slate-900 text-slate-400 hover:text-white"
                }`}
              >
                💼 Base Salary vs Gutting Incentive Clarification
              </button>
            </div>

            {/* TAB 1: MONTH-WISE BREAKDOWN TABLE */}
            {passbookTab === "months" && (
              <div className="space-y-3">
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Clear month-by-month record showing exact kilograms gutted by Mohd Amin, incentive accrued at ₹5/Kg, cash advances/payments disbursed, and net balance remaining.
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-[10.5px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="py-2.5 px-3">Month</th>
                        <th className="py-2.5 px-3 text-right">Gutted Trout</th>
                        <th className="py-2.5 px-3 text-right">Incentive Rate</th>
                        <th className="py-2.5 px-3 text-right text-purple-300">Total Earned</th>
                        <th className="py-2.5 px-3 text-right text-emerald-400">Total Paid</th>
                        <th className="py-2.5 px-3 text-right">Disbursements</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {monthWiseIncentives.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-4 text-center text-slate-500">
                            No monthly sales entries recorded yet.
                          </td>
                        </tr>
                      ) : (
                        monthWiseIncentives.map((m) => {
                          const isCleared = m.balance === 0 || m.paid >= m.earned;
                          return (
                            <tr
                              key={m.monthKey}
                              className={`hover:bg-slate-900/50 transition-colors ${
                                m.isCurrent ? "bg-blue-950/20" : m.isPrevious ? "bg-purple-950/20" : ""
                              }`}
                            >
                              <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                                <span>{m.monthLabel}</span>
                                {m.isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-bold">
                                    Live Current
                                  </span>
                                )}
                                {m.isPrevious && (
                                  <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold">
                                    Milestone
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-200">
                                {formatKg(m.guttedKg)} Kg
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400">
                                ₹5/Kg
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-purple-300">
                                ₹{m.earned.toLocaleString("en-IN")}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                                ₹{m.paid.toLocaleString("en-IN")}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400">
                                {m.payoutCount} {m.payoutCount === 1 ? "payment" : "payments"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                                {m.balance > 0 ? `₹${m.balance.toLocaleString("en-IN")}` : "₹0"}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isCleared
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  }`}
                                >
                                  {isCleared ? "Hisaab Clear ✓" : `Pending ₹${m.balance}`}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: COMPLETE CASH DISBURSEMENTS PASSBOOK */}
            {passbookTab === "payouts" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Every individual cash or UPI payment disbursed to Mohd Amin from the counter drawer:</span>
                  <span className="text-white font-bold">Total Paid: ₹{totalPaid.toLocaleString("en-IN")}</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                      <tr className="text-[10.5px] uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Time</th>
                        <th className="py-2.5 px-3 text-right text-emerald-400">Amount</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Notes &amp; Hisaab Details</th>
                        <th className="py-2.5 px-3 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {payoutsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            No disbursements recorded in ledger.
                          </td>
                        </tr>
                      ) : (
                        payoutsList.map((p, idx) => (
                          <tr key={p.id || idx} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-2 px-3 text-center text-slate-500 text-[11px]">{idx + 1}</td>
                            <td className="py-2 px-3 text-white font-bold whitespace-nowrap">
                              {formatIstDateDisplay(p.payout_date)}
                            </td>
                            <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {p.payout_time || "—"}
                            </td>
                            <td className="py-2 px-3 text-right font-black text-emerald-400 text-sm whitespace-nowrap">
                              ₹{Number(p.amount).toLocaleString("en-IN")}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                                {p.payment_mode || "Cash"}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-300 max-w-xs truncate" title={p.notes || ""}>
                              {p.notes || "Incentive disbursement"}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9.5px]">
                                Disbursed ✓
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: SALARY VS INCENTIVE CLARIFICATION */}
            {passbookTab === "salary" && (
              <div className="space-y-3.5">
                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 text-sky-200 leading-relaxed text-[11px]">
                  <strong className="text-white block mb-1">💡 How Mohd Amin&apos;s Total Compensation Works:</strong>
                  Mohd Amin receives two distinct earnings:
                  <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-300">
                    <li>
                      <strong className="text-sky-300">1. Fixed Monthly Salary:</strong> Base wage of <strong>₹10,500/month</strong>, disbursed at month-end after deducting any personal advances, ration, recharge, or sick leave days.
                    </li>
                    <li>
                      <strong className="text-purple-300">2. Fish Gutting Incentive:</strong> Extra bonus of <strong>₹5.00/Kg</strong> for every kilogram of fresh rainbow trout gutted at the counter (or ₹20/Kg during Friday deals). This is paid out in small cash advances whenever requested.
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <div className="p-2.5 bg-slate-900 border-b border-slate-800 font-bold text-white text-[11px]">
                    Recent Monthly Salary Disbursements:
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {salaryPaymentsList.length === 0 ? (
                      <div className="p-3 text-center text-slate-500">No salary payments recorded yet.</div>
                    ) : (
                      salaryPaymentsList.map((sp: any) => (
                        <div key={sp.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/40">
                          <div>
                            <div className="font-bold text-white">
                              {sp.salary_month} · ₹{Number(sp.amount).toLocaleString("en-IN")} Wage
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Paid on {formatIstDateDisplay(sp.payment_date)} {sp.payment_time ? `at ${sp.payment_time}` : ""} via {sp.payment_mode || "Cash"}
                            </div>
                            {sp.notes && (
                              <div className="text-[10.5px] text-amber-300 mt-1 bg-slate-900/80 p-1.5 rounded border border-slate-800">
                                Note: {sp.notes}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              Salary Cleared ✓
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Informative Footer & Admin Controls ─── */}
      <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="text-slate-400 flex items-center flex-wrap gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-slate-300">
            <span className="material-symbols-outlined text-[13px] text-purple-400">info</span>
            <span>Policy: ₹{todayRate}.00/Kg for counter gutted trout</span>
          </span>
          <span>•</span>
          <span>Owner self-cleaned stock ({formatKg(allTimeSelfCleanedKg)} Kg) is excluded (₹0)</span>
          <span>•</span>
          <span>All-time gutted: <strong className="text-white">{formatKg(allTimeGuttedKg)} Kg</strong></span>
        </div>

        {/* Admin Action Buttons */}
        {isAdmin && (
          <div className="flex items-center flex-wrap gap-2 self-stretch sm:self-auto justify-end">
            {/* Record Sick Leave / Deduction */}
            {onOpenLeaveModal && (
              <button
                type="button"
                onClick={onOpenLeaveModal}
                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                title="Record sick leave or unpaid day deduction based on ₹10,500 salary"
              >
                <span className="material-symbols-outlined text-sm">event_busy</span>
                <span>Deduct Leave</span>
              </button>
            )}

            {/* Disburse Payout */}
            {onOpenPayoutModal && (
              <button
                type="button"
                onClick={onOpenPayoutModal}
                className="px-3 py-1.5 rounded-xl bg-purple-500/25 hover:bg-purple-500/35 text-purple-200 border border-purple-500/50 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                title="Pay incentive to Mohd Amin and record disbursement in ledger"
              >
                <span className="material-symbols-outlined text-sm">payments</span>
                <span>Pay Incentive</span>
              </button>
            )}

            {/* Pay Monthly Salary */}
            {onOpenSalaryModal && (
              <button
                type="button"
                onClick={onOpenSalaryModal}
                className="px-3 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                title="Disburse monthly wage payment"
              >
                <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                <span>Pay Salary</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
