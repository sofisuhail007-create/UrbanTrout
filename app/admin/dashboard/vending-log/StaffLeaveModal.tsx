"use client";

import React, { useState } from "react";
import { WorkerSalaryDeduction } from "@/app/api/vending-log/salary/route";
import { formatIstDateDisplay } from "./page";

interface StaffLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerName?: string;
  baseMonthlySalary?: number;
  deductions: WorkerSalaryDeduction[];
  activeMonthLabel: string;
  onDeductionRecorded: () => void;
  onDeleteDeduction: (id: string) => Promise<void>;
}

const LEAVE_REASONS = [
  "Sick Leave",
  "Casual Leave",
  "Personal Emergency",
  "Friday Deal Pact (Incentive-Only)",
  "Unannounced Absence",
  "Other",
];

export default function StaffLeaveModal({
  isOpen,
  onClose,
  workerName = "Mohd Amin",
  baseMonthlySalary = 10500,
  deductions,
  activeMonthLabel,
  onDeductionRecorded,
  onDeleteDeduction,
}: StaffLeaveModalProps) {
  const defaultDailyRate = Math.round(baseMonthlySalary / 30); // 10500 / 30 = 350
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("Sick Leave");
  const [daysCount, setDaysCount] = useState<number>(1);
  const [dailyRate, setDailyRate] = useState<number>(defaultDailyRate);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const calculatedAmount = Math.round(daysCount * dailyRate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/vending-log/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_deduction",
          worker_name: workerName,
          salary_month: activeMonthLabel,
          date,
          reason,
          days_count: daysCount,
          daily_rate: dailyRate,
          notes,
        }),
      });
      if (res.ok) {
        setNotes("");
        onDeductionRecorded();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record salary deduction");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete and reverse this deduction?")) return;
    setDeletingId(id);
    try {
      await onDeleteDeduction(id);
    } finally {
      setDeletingId(null);
    }
  };

  const monthDeductions = deductions.filter(
    (d) => !d.salary_month || d.salary_month.toLowerCase() === activeMonthLabel.toLowerCase()
  );
  const monthTotalDeductions = monthDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn"
    >
      <div className="w-full max-w-xl bg-[#0b1322] border-2 border-rose-500/40 rounded-3xl shadow-2xl shadow-rose-950/40 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <span className="material-symbols-outlined text-xl">event_busy</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 font-mono">
                  Attendance &amp; Payroll
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold font-mono">
                  ₹{defaultDailyRate}/Day Base
                </span>
              </div>
              <h3 className="text-base font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Leave &amp; Salary Deductions · {workerName}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
            title="Close"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs font-mono">
          {/* Summary Box */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Month ({activeMonthLabel})</span>
              <span className="text-sm font-black text-white font-['Space_Grotesk']">
                Base ₹{baseMonthlySalary.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-rose-400 block">
                {monthDeductions.length} {monthDeductions.length === 1 ? "Deduction" : "Deductions"}
              </span>
              <span className="text-base font-black text-rose-400 font-['Space_Grotesk']">
                -₹{monthTotalDeductions.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="text-right border-l border-slate-800 pl-3">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Net Base Due</span>
              <span className="text-base font-black text-emerald-400 font-['Space_Grotesk']">
                ₹{Math.max(0, baseMonthlySalary - monthTotalDeductions).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Form to Record New Deduction */}
          <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">remove_circle</span>
                <span>Record New Leave / Absence</span>
              </span>
              <span className="text-[11px] text-slate-400">
                1 Day = ₹{defaultDailyRate} (from ₹{baseMonthlySalary.toLocaleString("en-IN")}/mo)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Leave Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-rose-400"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Reason / Type</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-rose-400 cursor-pointer"
                >
                  {LEAVE_REASONS.map((r) => (
                    <option key={r} value={r} className="bg-slate-900 text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Days Count</label>
                <div className="flex items-center gap-2">
                  <select
                    value={daysCount}
                    onChange={(e) => setDaysCount(Number(e.target.value))}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-rose-400 cursor-pointer"
                  >
                    <option value={1}>1 Full Day (100%)</option>
                    <option value={0.5}>0.5 Half Day (50%)</option>
                    <option value={2}>2 Days</option>
                    <option value={3}>3 Days</option>
                    <option value={4}>4 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Daily Rate (₹)
                </label>
                <input
                  type="number"
                  value={dailyRate}
                  onChange={(e) => setDailyRate(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-rose-400"
                  min={0}
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Notes / Circumstance (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Rest day due to fever / Friday shop opened on incentive pact"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="text-xs">
                <span className="text-slate-400">Total Deduction: </span>
                <span className="font-extrabold text-rose-400 font-mono text-sm">
                  -₹{calculatedAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white font-bold uppercase tracking-wider transition-all shadow-md shadow-rose-950/40 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Apply Deduction"}
              </button>
            </div>
          </form>

          {/* History of Deductions */}
          <div>
            <h4 className="text-[11px] uppercase font-bold text-slate-400 mb-2 flex items-center justify-between">
              <span>Recorded Leaves for {activeMonthLabel} ({monthDeductions.length})</span>
              <span>Total: -₹{monthTotalDeductions.toLocaleString("en-IN")}</span>
            </h4>

            {monthDeductions.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
                No leave deductions recorded for {activeMonthLabel}. Mohd Amin has 100% full attendance!
              </div>
            ) : (
              <div className="space-y-2">
                {monthDeductions.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{formatIstDateDisplay(d.date)}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                          {d.reason}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          ({d.days_count} {d.days_count === 1 ? "day" : "days"} @ ₹{d.daily_rate}/day)
                        </span>
                      </div>
                      {d.notes && <p className="text-[11px] text-slate-400 mt-0.5">{d.notes}</p>}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-rose-400 font-mono text-sm">
                        -₹{Number(d.amount || 0).toLocaleString("en-IN")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(d.id)}
                        disabled={deletingId === d.id}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                        title="Delete / Reverse Deduction"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
