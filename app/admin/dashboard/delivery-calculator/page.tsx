"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const ROOT_OWNER_EMAILS = ["sofisuhail007@gmail.com", "info.urbantrout@gmail.com"];
const DEFAULT_COGS = 435; // Base procurement cost per kg
const DEFAULT_LABOR = 5;  // Mohd Amin gutting incentive per kg

export default function DeliveryProfitCalculatorPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Core Inputs — ALL START BLANK (No pre-filled defaults, no forced templates)
  const [weightStr, setWeightStr] = useState<string>("");
  const [rateStr, setRateStr] = useState<string>("");
  const [riderFareStr, setRiderFareStr] = useState<string>("");
  const [customerShareStr, setCustomerShareStr] = useState<string>("");
  const [actualPaidStr, setActualPaidStr] = useState<string>(""); // Optional override (e.g. ₹1,249 for 2kg link)
  const [productCut, setProductCut] = useState<"gutted" | "whole">("gutted");

  // Procurement & Labor Parameters
  const [cogsPerKg, setCogsPerKg] = useState<number>(DEFAULT_COGS);
  const [laborPerKg, setLaborPerKg] = useState<number>(DEFAULT_LABOR);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Strictly verify owner authentication on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = (session?.user?.email || localStorage.getItem("ut_admin_email") || "").toLowerCase().trim();
      const isOwner = ROOT_OWNER_EMAILS.includes(email);
      if (!isOwner) {
        window.location.replace("/admin/dashboard/vending-log");
        return;
      }
      setIsAdmin(true);
      setCheckingAuth(false);
    }).catch(() => {
      window.location.replace("/admin/dashboard/vending-log");
    });
  }, []);

  // Parse numerical inputs safely
  const weight = parseFloat(weightStr) || 0;
  const rate = parseFloat(rateStr) || 0;
  const riderFare = parseFloat(riderFareStr) || 0;
  const customerShare = parseFloat(customerShareStr) || 0;
  const actualPaid = parseFloat(actualPaidStr) || 0;

  // Clear all inputs back to blank
  const handleClear = () => {
    setWeightStr("");
    setRateStr("");
    setRiderFareStr("");
    setCustomerShareStr("");
    setActualPaidStr("");
  };

  const hasInputs = weight > 0 && rate > 0;

  // Exact Mathematical Financial Engine
  const math = useMemo(() => {
    if (!hasInputs) return null;

    const fishBill = Math.round(weight * rate);
    const theoreticalCollected = fishBill + customerShare;
    const totalCollected = actualPaid > 0 ? actualPaid : theoreticalCollected;
    const surplusOrDifference = actualPaid > 0 ? actualPaid - theoreticalCollected : 0;

    // Direct farm out-of-pocket costs
    const procurementCost = Math.round(weight * cogsPerKg);
    const laborCost = productCut === "gutted" ? Math.round(weight * laborPerKg) : 0;
    const fishDirectCost = procurementCost + laborCost;

    // Fish profit before delivery
    const fishGrossProfit = fishBill - fishDirectCost;

    // Delivery economics
    const farmSubsidy = Math.max(0, riderFare - customerShare);
    const riderSurplus = Math.max(0, customerShare - riderFare);
    const totalDirectCost = fishDirectCost + riderFare;

    // Clean In-Hand Net Profit
    const netProfit = totalCollected - totalDirectCost;
    const marginPercent = totalCollected > 0 ? ((netProfit / totalCollected) * 100).toFixed(1) : "0.0";
    const profitPerKg = weight > 0 ? (Math.round((netProfit / weight) * 10) / 10).toFixed(1) : "0";

    let verdict: "high" | "healthy" | "thin" | "loss" = "healthy";
    if (netProfit < 0) verdict = "loss";
    else if (netProfit < 100) verdict = "thin";
    else if (netProfit >= 200) verdict = "high";
    else verdict = "healthy";

    return {
      fishBill,
      theoreticalCollected,
      totalCollected,
      surplusOrDifference,
      procurementCost,
      laborCost,
      fishDirectCost,
      fishGrossProfit,
      farmSubsidy,
      riderSurplus,
      totalDirectCost,
      netProfit,
      marginPercent,
      profitPerKg,
      verdict,
    };
  }, [hasInputs, weight, rate, riderFare, customerShare, actualPaid, productCut, cogsPerKg, laborPerKg]);

  if (checkingAuth || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Verifying owner access…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020d12] text-slate-100 p-3 sm:p-5 md:p-6 pb-24 max-w-2xl mx-auto space-y-4 font-mono">
      {/* ─── HEADER BAR ─── */}
      <div className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-2xl p-3 sm:p-4">
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/dashboard/vending-log"
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-all"
            title="Back to Vending Log"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-sm sm:text-base font-black text-white tracking-tight">
              Delivery Profit Calculator
            </h1>
            <p className="text-[10px] text-slate-400">
              Direct Reference • In-Hand Net Profit @ ₹{cogsPerKg}/Kg COGS
            </p>
          </div>
        </div>

        {/* Quick Clear All Button */}
        <button
          type="button"
          onClick={handleClear}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          title="Clear all fields back to blank"
        >
          <span className="material-symbols-outlined text-sm text-amber-400">restart_alt</span>
          <span>Clear All</span>
        </button>
      </div>

      {/* ─── LIVE PROFIT FLASHCARD (HERO RESULT) ─── */}
      {!math ? (
        <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/50 border border-slate-800 text-center space-y-2">
          <span className="material-symbols-outlined text-3xl text-emerald-400/60 block">calculate</span>
          <div className="text-sm font-bold text-slate-300">Enter Weight &amp; Rate Below</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Input the order weight, selling price, and delivery numbers to see your exact in-hand profit instantly without opening a calculator.
          </p>
        </div>
      ) : (
        <div
          className={`p-4 sm:p-5 rounded-3xl border-2 shadow-2xl space-y-3 transition-all ${
            math.verdict === "loss"
              ? "bg-rose-950/40 border-rose-500/50 shadow-rose-950/40"
              : math.verdict === "thin"
              ? "bg-amber-950/40 border-amber-500/50 shadow-amber-950/40"
              : "bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/40"
          }`}
        >
          {/* Main Profit Figure */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                In-Hand Net Profit
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span
                  className={`text-3xl sm:text-4xl font-black tracking-tight ${
                    math.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {math.netProfit >= 0 ? "+" : "-"}₹{Math.abs(math.netProfit).toLocaleString("en-IN")}
                </span>
                <span
                  className={`text-xs font-bold ${
                    math.netProfit >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  ({math.marginPercent}%)
                </span>
                <span className="text-xs text-slate-300">
                  • +₹{math.profitPerKg}/Kg
                </span>
              </div>
            </div>

            {/* Verdict Badge */}
            <div
              className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold ${
                math.verdict === "loss"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : math.verdict === "thin"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              }`}
            >
              {math.verdict === "loss" && "🔴 LOSS DEAL"}
              {math.verdict === "thin" && "🟡 THIN MARGIN"}
              {math.verdict === "high" && "🟢 HIGH PROFIT"}
              {math.verdict === "healthy" && "🟢 VIABLE PROFIT"}
            </div>
          </div>

          {/* 4-Box Clean Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
                {actualPaid > 0 ? "Actual Collected" : "Customer Bill"}
              </span>
              <span className="text-sm font-black text-white block mt-0.5">
                ₹{math.totalCollected.toLocaleString("en-IN")}
              </span>
              <span className="text-[9px] text-slate-500 block truncate">
                {actualPaid > 0
                  ? `Actual (Bill: ₹${math.theoreticalCollected})`
                  : `Fish ₹${math.fishBill} + Del ₹${customerShare}`}
              </span>
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[9.5px] uppercase font-bold text-cyan-400 block">Rider Fare</span>
              <span className="text-sm font-black text-cyan-300 block mt-0.5">
                ₹{riderFare}
              </span>
              <span className="text-[9px] text-slate-500 block truncate">
                {riderFare > 0 ? "Paid to courier" : "No rider cost"}
              </span>
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[9.5px] uppercase font-bold text-rose-400 block">Our Subsidy</span>
              <span
                className={`text-sm font-black block mt-0.5 ${
                  math.farmSubsidy > 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {math.farmSubsidy > 0 ? `-₹${math.farmSubsidy}` : "₹0 (100% Paid)"}
              </span>
              <span className="text-[9px] text-slate-500 block truncate">
                {math.farmSubsidy > 0 ? "Borne from margin" : "Customer covered"}
              </span>
            </div>

            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[9.5px] uppercase font-bold text-amber-400 block">Fish Cost</span>
              <span className="text-sm font-black text-amber-300 block mt-0.5">
                ₹{math.fishDirectCost}
              </span>
              <span className="text-[9px] text-slate-500 block truncate">
                @ ₹{cogsPerKg} COGS {math.laborCost > 0 ? `+ ₹${math.laborCost} lab` : ""}
              </span>
            </div>
          </div>

          {/* Simple Math Step-by-Step */}
          <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800/80 text-[11px] space-y-0.5">
            <div className="flex items-center justify-between text-slate-300">
              <span>🐟 Fish Margin (₹{math.fishBill} bill - ₹{math.fishDirectCost} cost):</span>
              <span className="font-bold text-emerald-400">+₹{math.fishGrossProfit}</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>🚚 Delivery Difference (₹{customerShare} cust - ₹{riderFare} rider):</span>
              <span className={`font-bold ${math.farmSubsidy > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {math.farmSubsidy > 0 ? `-₹${math.farmSubsidy}` : `+₹${math.riderSurplus}`}
              </span>
            </div>
            {math.surplusOrDifference !== 0 && (
              <div className="flex items-center justify-between text-slate-300">
                <span>⚖️ Link / Weight Surplus (₹{actualPaid} paid vs ₹{math.theoreticalCollected} bill):</span>
                <span className={`font-bold ${math.surplusOrDifference > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {math.surplusOrDifference > 0 ? `+₹${math.surplusOrDifference}` : `-₹${Math.abs(math.surplusOrDifference)}`}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold text-xs text-white">
              <span>Net In-Hand Profit:</span>
              <span className={math.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {math.netProfit >= 0 ? "+" : "-"}₹{Math.abs(math.netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── INPUT FIELDS (CLEAN & BLANK BY DEFAULT) ─── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        {/* Row 1: Weight & Cut */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase font-bold text-emerald-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">scale</span>
              <span>1. Order Weight (Kg)</span>
            </label>
            {/* Cut Toggle */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setProductCut("gutted")}
                className={`px-2.5 py-0.5 rounded text-[10.5px] font-bold transition-all ${
                  productCut === "gutted"
                    ? "bg-emerald-500 text-slate-950 font-black shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Gutted (₹580)
              </button>
              <button
                type="button"
                onClick={() => setProductCut("whole")}
                className={`px-2.5 py-0.5 rounded text-[10.5px] font-bold transition-all ${
                  productCut === "whole"
                    ? "bg-cyan-500 text-slate-950 font-black shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Whole (₹540)
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={weightStr}
              placeholder="Enter weight in Kg (e.g. 2.76 or 1.94)"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setWeightStr(e.target.value)}
              className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm font-black text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            {weight > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                {weight} Kg
              </span>
            )}
          </div>

          {/* Quick Weight Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {["1.0", "1.5", "1.94", "2.0", "2.5", "2.76", "3.0", "4.0"].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWeightStr(w)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  weightStr === w
                    ? "bg-emerald-500/30 text-emerald-200 border-emerald-400"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {w} kg
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Selling Rate (₹/Kg) */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase font-bold text-cyan-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">payments</span>
              <span>2. Selling Rate (₹/Kg)</span>
            </label>
            <span className="text-[11px] text-slate-400">
              {rate > 0 ? `Fish Bill: ₹${Math.round(weight * rate)}` : "Per Kg selling price"}
            </span>
          </div>

          <div className="relative">
            <input
              type="number"
              step="any"
              inputMode="numeric"
              value={rateStr}
              placeholder={`Enter rate (e.g. ${productCut === "gutted" ? "580" : "540"} or custom like 550)`}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setRateStr(e.target.value)}
              className="w-full h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 text-sm font-black text-cyan-300 focus:outline-none focus:border-cyan-400"
            />
            {rate > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                ₹{rate}/Kg
              </span>
            )}
          </div>

          {/* Quick Rate Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {[
              { label: "₹540 (Whole)", val: "540", cut: "whole" as const },
              { label: "₹550 (Deal)", val: "550", cut: null },
              { label: "₹580 (Gutted)", val: "580", cut: "gutted" as const },
              { label: "₹600 (Std)", val: "600", cut: "gutted" as const },
            ].map((chip) => (
              <button
                key={chip.val}
                type="button"
                onClick={() => {
                  setRateStr(chip.val);
                  if (chip.cut) setProductCut(chip.cut);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  rateStr === chip.val
                    ? "bg-cyan-500/30 text-cyan-200 border-cyan-400"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Rider Cost & Customer Delivery Share */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          {/* Rider Cost */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase font-bold text-amber-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">two_wheeler</span>
                <span>3. Rider Fare (₹)</span>
              </label>
              <span className="text-[9.5px] text-slate-500">Rapido / Auto</span>
            </div>
            <input
              type="number"
              step="any"
              inputMode="numeric"
              value={riderFareStr}
              placeholder="e.g. 100 or 190"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setRiderFareStr(e.target.value)}
              className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-black text-amber-300 focus:outline-none focus:border-amber-400"
            />
            {/* Quick chips */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {["60", "80", "100", "120", "150", "190"].map((fare) => (
                <button
                  key={fare}
                  type="button"
                  onClick={() => setRiderFareStr(fare)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                    riderFareStr === fare
                      ? "bg-amber-500/30 text-amber-200 border-amber-400"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  ₹{fare}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Delivery Paid */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">person_check</span>
                <span>4. Customer Paid (₹)</span>
              </label>
              <span className="text-[9.5px] text-slate-500">Delivery Share</span>
            </div>
            <input
              type="number"
              step="any"
              inputMode="numeric"
              value={customerShareStr}
              placeholder="0 if Free Delivery"
              onFocus={(e) => e.target.select()}
              onChange={(e) => setCustomerShareStr(e.target.value)}
              className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-black text-emerald-300 focus:outline-none focus:border-emerald-400"
            />
            {/* Quick chips */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {[
                { label: "Free (₹0)", v: "0" },
                { label: "+₹20", v: "20" },
                { label: "+₹29", v: "29" },
                { label: "+₹39", v: "39" },
                { label: "+₹69", v: "69" },
                { label: "+₹89", v: "89" },
              ].map((chip) => (
                <button
                  key={chip.v}
                  type="button"
                  onClick={() => setCustomerShareStr(chip.v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                    customerShareStr === chip.v
                      ? "bg-emerald-500/30 text-emerald-200 border-emerald-400"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 5: Actual Total Collected Override (Optional) */}
        <div className="pt-2.5 border-t border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase font-bold text-violet-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">receipt_long</span>
              <span>5. Actual Collected Override (₹) — Optional</span>
            </label>
            <span className="text-[9.5px] text-slate-500">
              {math ? `Calculated: ₹${math.theoreticalCollected}` : "Leave blank to use calculated"}
            </span>
          </div>

          <div className="relative">
            <input
              type="number"
              step="any"
              inputMode="numeric"
              value={actualPaidStr}
              placeholder={
                math
                  ? `Leave blank for ₹${math.theoreticalCollected} (or enter e.g. 1249 if preset link)`
                  : "Leave blank for calculated bill"
              }
              onFocus={(e) => e.target.select()}
              onChange={(e) => setActualPaidStr(e.target.value)}
              className="w-full h-10 bg-slate-950 border border-slate-700 rounded-xl px-3 text-xs font-black text-violet-300 focus:outline-none focus:border-violet-400"
            />
            {actualPaid > 0 && (
              <button
                type="button"
                onClick={() => setActualPaidStr("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            Use when a customer paid for a preset link (e.g. 2 kg preset link @ ₹1,249) but actual delivered weight was slightly different (e.g. 1.94 kg).
          </p>
        </div>
      </div>

      {/* ─── OPTIONAL PROCUREMENT PARAMETERS (COLLAPSED) ─── */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 text-xs">
        <button
          type="button"
          onClick={() => setShowSettings((prev) => !prev)}
          className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-cyan-400">tune</span>
            <span className="font-bold text-[11px]">
              Procurement Base: ₹{cogsPerKg}/Kg • Labor: ₹{productCut === "gutted" ? laborPerKg : 0}/Kg
            </span>
          </div>
          <span className="text-[10px] text-cyan-400 font-bold">
            {showSettings ? "Hide ▲" : "Adjust ▼"}
          </span>
        </button>

        {showSettings && (
          <div className="grid grid-cols-2 gap-3 pt-3 mt-2 border-t border-slate-800">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Fish Procurement Cost (₹/Kg)
              </label>
              <input
                type="number"
                value={cogsPerKg}
                onChange={(e) => setCogsPerKg(Number(e.target.value) || 0)}
                className="w-full h-8 bg-slate-950 border border-slate-700 rounded-lg px-2.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Gutting Labor Incentive (₹/Kg)
              </label>
              <input
                type="number"
                value={laborPerKg}
                onChange={(e) => setLaborPerKg(Number(e.target.value) || 0)}
                className="w-full h-8 bg-slate-950 border border-slate-700 rounded-lg px-2.5 text-xs text-white"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
