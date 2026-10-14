"use client";

import React from "react";
import { StaffIncentivePayout } from "@/app/api/vending-log/incentive/route";
import { formatIstDateDisplay, formatKg } from "./page";

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
  thisMonthEarned?: number;
  thisMonthGuttedKg?: number;
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
  thisMonthEarned = 0,
  thisMonthGuttedKg = 0,
  onOpenPayoutModal,
  onOpenLeaveModal,
  onOpenSalaryModal,
}: StaffIncentiveCardProps) {
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
                Worker Compensation &amp; Daily Earnings
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 text-[10.5px] font-bold font-mono">
                {workerName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10.5px] font-mono">
                Standard Rate · ₹{todayRate}.00/Kg
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mt-0.5" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {workerName}&apos;s Daily Incentive &amp; Earnings Overview
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
            <span>{balanceRemaining > 0 ? `₹${balanceRemaining.toLocaleString("en-IN")} Pending Due` : "All Settled ✓"}</span>
          </span>
        </div>
      </div>

      {/* ─── 4-Column Structured Flash Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 my-4">
        {/* CARD 1: EARNED TODAY (THE BIG QUESTION HE ASKS!) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px] text-purple-400">wb_sunny</span>
                <span>Earned Today</span>
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
            <span className="text-purple-300 font-bold">Live Today</span>
          </div>
        </div>

        {/* CARD 2: PENDING UNPAID INCENTIVE BALANCE */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 border border-amber-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">account_balance_wallet</span>
                <span>Incentive Balance Due</span>
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                balanceRemaining > 0 ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-emerald-500/20 text-emerald-300"
              }`}>
                {balanceRemaining > 0 ? "Payable" : "Clear"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-amber-400 font-mono">₹</span>
              <span className="text-3xl font-black text-amber-300 font-mono tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                {balanceRemaining.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Earned: ₹{allTimeEarned.toLocaleString("en-IN")}</span>
            <span>Paid: ₹{totalPaid.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* CARD 3: WHEN WAS HE LAST PAID INCENTIVE? (SECOND BIG QUESTION) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/30 via-slate-900 to-slate-950 border border-cyan-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">history</span>
                <span>Last Incentive Payout</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {lastPayout ? lastPayout.payment_mode : "None"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              {lastPayout ? (
                <>
                  <span className="text-xl font-bold text-cyan-400 font-mono">₹</span>
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
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono truncate">
            {lastPayout ? (
              <span title={`${lastPayout.payout_date} · ${lastPayout.notes || "No notes"}`}>
                Paid on <strong className="text-cyan-300">{formatIstDateDisplay(lastPayout.payout_date)}</strong>
                {lastPayout.payout_time && ` at ${lastPayout.payout_time}`}
              </span>
            ) : (
              <span>Disbursement history will appear here</span>
            )}
          </div>
        </div>

        {/* CARD 4: THIS MONTH WORKER TOTAL */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">calendar_month</span>
                <span>This Month Earned</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Month To Date
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-emerald-400 font-mono">₹</span>
              <span className="text-3xl font-black text-white font-mono tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                {thisMonthEarned.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Month Gutted: <strong className="text-emerald-300">{formatKg(thisMonthGuttedKg)} Kg</strong></span>
            <span>All-time: {formatKg(allTimeGuttedKg)} Kg</span>
          </div>
        </div>
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
