"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Srinagar Major Delivery Clusters with typical Rapido bike fares & recommended customer shares
interface LocalityPreset {
  name: string;
  zone: string;
  distanceKm: string;
  rapidoAvg: number;
  customerShareRec: number;
}

const ROOT_OWNER_EMAILS = ["sofisuhail007@gmail.com", "info.urbantrout@gmail.com"];

const SRINAGAR_LOCALITY_PRESETS: LocalityPreset[] = [
  { name: "Lal Bazar / Hazratbal / Nigeen", zone: "Zone 1 (0-4 km)", distanceKm: "2-4 km", rapidoAvg: 60, customerShareRec: 29 },
  { name: "Soura / Buchpora / Zakura", zone: "Zone 1 (3-6 km)", distanceKm: "4-6 km", rapidoAvg: 80, customerShareRec: 39 },
  { name: "Khayam / Dalgate / Rainawari", zone: "Zone 2 (5-8 km)", distanceKm: "6-8 km", rapidoAvg: 100, customerShareRec: 39 },
  { name: "Lal Chowk / Rajbagh / Jawahar Ngr", zone: "Zone 2 (8-11 km)", distanceKm: "9-11 km", rapidoAvg: 120, customerShareRec: 49 },
  { name: "Chanapora / Natipora / Barzulla", zone: "Zone 3 (10-13 km)", distanceKm: "11-13 km", rapidoAvg: 140, customerShareRec: 69 },
  { name: "Rawalpora / Hyderpora / Sanat Ngr", zone: "Zone 3 (12-15 km)", distanceKm: "13-15 km", rapidoAvg: 180, customerShareRec: 89 },
  { name: "Bemina / Qamarwari / Parimpora", zone: "Zone 3 (9-13 km)", distanceKm: "10-12 km", rapidoAvg: 140, customerShareRec: 69 },
  { name: "Humhama / Airport Road / Peerbagh", zone: "Zone 4 (15-18 km)", distanceKm: "15-18 km", rapidoAvg: 200, customerShareRec: 89 },
  { name: "Budgam Town / Ompora", zone: "Zone 4 (18-22 km)", distanceKm: "19-22 km", rapidoAvg: 240, customerShareRec: 120 },
];

export default function DeliveryProfitCalculatorPage() {
  // Authentication & Access Control (Owner Only)
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Core Calculator Inputs
  const [weight, setWeight] = useState<number>(2.0);
  const [productCut, setProductCut] = useState<"gutted" | "whole">("gutted");
  const [guttedRate, setGuttedRate] = useState<number>(580);
  const [wholeRate, setWholeRate] = useState<number>(540);
  const [customRateOverride, setCustomRateOverride] = useState<number | null>(null);

  // Cost & Fare Inputs
  const [cogsPerKg, setCogsPerKg] = useState<number>(435); // Base procurement cost
  const [laborPerKg, setLaborPerKg] = useState<number>(5);  // Mohd Amin gutting incentive
  const [riderFare, setRiderFare] = useState<number>(150); // Rapido / rider bike payout
  const [customerShare, setCustomerShare] = useState<number>(69); // Customer delivery charge

  // Metadata
  const [locality, setLocality] = useState<string>("Rawalpora / Hyderpora");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Strictly verify owner authentication on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = (session?.user?.email || localStorage.getItem("ut_admin_email") || "").toLowerCase().trim();
      const isOwner = ROOT_OWNER_EMAILS.includes(email);
      if (!isOwner) {
        // Staff or unauthenticated users are kicked back to vending log
        window.location.replace("/admin/dashboard/vending-log");
        return;
      }
      setIsAdmin(true);
      setCheckingAuth(false);
    }).catch(() => {
      window.location.replace("/admin/dashboard/vending-log");
    });
  }, []);

  // Active retail rate per kg
  const activeRate = useMemo(() => {
    if (customRateOverride !== null && customRateOverride > 0) {
      return customRateOverride;
    }
    return productCut === "gutted" ? guttedRate : wholeRate;
  }, [productCut, guttedRate, wholeRate, customRateOverride]);

  // Financial Engine
  const financials = useMemo(() => {
    const fishBill = Math.round(weight * activeRate);
    const totalCustomerBill = fishBill + customerShare;

    // Delivery logistics
    const farmDeliverySubsidy = Math.max(0, riderFare - customerShare);
    const riderSurplusContribution = Math.max(0, customerShare - riderFare);

    // Direct out-of-pocket costs to farm
    const fishProcurementCost = Math.round(weight * cogsPerKg);
    const workerLaborCost = productCut === "gutted" ? Math.round(weight * laborPerKg) : 0;
    const totalDirectCost = fishProcurementCost + workerLaborCost + riderFare;

    // Clean In-Hand Net Profit
    const netProfit = totalCustomerBill - totalDirectCost;
    const marginPercent = totalCustomerBill > 0 ? ((netProfit / totalCustomerBill) * 100).toFixed(1) : "0.0";
    const profitPerKg = weight > 0 ? Math.round(netProfit / weight) : 0;

    // Deal Health Classification
    let health: "high" | "healthy" | "thin" | "loss" = "healthy";
    if (netProfit >= 200) health = "high";
    else if (netProfit >= 100) health = "healthy";
    else if (netProfit >= 0) health = "thin";
    else health = "loss";

    return {
      fishBill,
      totalCustomerBill,
      farmDeliverySubsidy,
      riderSurplusContribution,
      fishProcurementCost,
      workerLaborCost,
      totalDirectCost,
      netProfit,
      marginPercent,
      profitPerKg,
      health,
    };
  }, [weight, activeRate, customerShare, cogsPerKg, laborPerKg, riderFare, productCut]);

  // WhatsApp Quote Text Formatter
  const whatsappQuote = useMemo(() => {
    const cutName = productCut === "gutted" ? "Fresh Gutted & Cleaned Trout" : "Whole / Round Fresh Trout";
    const delivLine = customerShare > 0
      ? `• *Doorstep Express Delivery:* ₹${customerShare} ${locality ? `(${locality})` : ""}`
      : `• *Doorstep Delivery:* *FREE DELIVERY 🎁* ${locality ? `(${locality})` : ""}`;

    return `*URBAN TROUT™ — EXPRESS ORDER QUOTE* 🐟
━━━━━━━━━━━━━━━━━━━━━━
📦 *Order Summary:*
• *Item:* ${cutName}
• *Weight:* ${weight.toFixed(2)} Kg @ ₹${activeRate}/Kg
• *Fish Amount:* ₹${financials.fishBill.toLocaleString("en-IN")}
${delivLine}
━━━━━━━━━━━━━━━━━━━━━━
💰 *TOTAL AMOUNT PAYABLE:* *₹${financials.totalCustomerBill.toLocaleString("en-IN")}*
━━━━━━━━━━━━━━━━━━━━━━
⚡ *Freshness Promise:* Harvested live from spring-fed raceways upon dispatch. Delivered chilled on crushed ice in under 90 minutes.

📍 *Payment Mode:* Cash on Delivery / UPI Scanner on Handover.`;
  }, [productCut, weight, activeRate, customerShare, locality, financials]);

  // Rider Handover Slip Text
  const riderSlip = useMemo(() => {
    return `*URBAN TROUT — RIDER DELIVERY SLIP* 🛵
━━━━━━━━━━━━━━━━━━━━━━
📍 *Pickup:* Urban Trout Vending Hub, Srinagar
📍 *Destination:* ${locality || "Customer Address"}
${customerPhone ? `📞 *Customer Phone:* ${customerPhone}\n` : ""}
💵 *Cash to Collect from Customer:* ₹${financials.totalCustomerBill.toLocaleString("en-IN")}
🛵 *Rider Delivery Fare:* ₹${riderFare}
━━━━━━━━━━━━━━━━━━━━━━
⚠️ Please carry upright on ice. Do not shake. Contact customer before arriving.`;
  }, [locality, customerPhone, financials.totalCustomerBill, riderFare]);

  const handleCopyQuote = async () => {
    try {
      await navigator.clipboard.writeText(whatsappQuote);
      setCopyToast("WhatsApp quote copied to clipboard! ✓");
      setTimeout(() => setCopyToast(null), 3000);
    } catch {
      setCopyToast("Failed to copy quote. Please copy manually.");
    }
  };

  const handleCopyRiderSlip = async () => {
    try {
      await navigator.clipboard.writeText(riderSlip);
      setCopyToast("Rider delivery slip copied! ✓");
      setTimeout(() => setCopyToast(null), 3000);
    } catch {
      setCopyToast("Failed to copy slip.");
    }
  };

  const handleOpenWhatsApp = () => {
    const cleanPhone = customerPhone.replace(/\D/g, "");
    const phoneWithCountry = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const encoded = encodeURIComponent(whatsappQuote);
    if (cleanPhone.length >= 10) {
      window.open(`https://wa.me/${phoneWithCountry}?text=${encoded}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  };

  const handleSelectLocality = (preset: LocalityPreset) => {
    setLocality(preset.name);
    setRiderFare(preset.rapidoAvg);
    setCustomerShare(preset.customerShareRec);
  };

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
    <div className="min-h-screen bg-[#020d12] text-slate-100 p-3 sm:p-5 md:p-6 pb-28 max-w-4xl mx-auto space-y-4 sm:space-y-6 font-['Manrope']">
      {/* ─── TOAST NOTIFICATION ─── */}
      {copyToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-400 animate-in fade-in slide-in-from-top-3">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span className="text-xs sm:text-sm">{copyToast}</span>
        </div>
      )}

      {/* ─── HEADER BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard/vending-log"
            className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-sm"
            title="Back to Vending Center Log"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight font-['Space_Grotesk']">
                Delivery Profit Calculator
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Admin Exclusive
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Instant mobile delivery profitability checker &amp; customer quote engine
            </p>
          </div>
        </div>

        {/* Admin Verified Status */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold self-start sm:self-auto">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          <span>Admin (Suhail)</span>
        </div>
      </div>

      {/* ─── LIVE FINANCIAL FLASHCARD (HERO) ─── */}
      <div
        className={`p-4 sm:p-6 rounded-3xl border shadow-2xl relative overflow-hidden transition-all duration-300 ${
          financials.health === "high"
            ? "bg-gradient-to-br from-emerald-950/80 via-slate-900/95 to-slate-900 border-emerald-500/50 shadow-emerald-950/40"
            : financials.health === "healthy"
            ? "bg-gradient-to-br from-teal-950/80 via-slate-900/95 to-slate-900 border-teal-500/50 shadow-teal-950/40"
            : financials.health === "thin"
            ? "bg-gradient-to-br from-amber-950/80 via-slate-900/95 to-slate-900 border-amber-500/50 shadow-amber-950/40"
            : "bg-gradient-to-br from-rose-950/80 via-slate-900/95 to-slate-900 border-rose-500/50 shadow-rose-950/40"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-mono">
              Deal Profitability Engine
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-3xl sm:text-5xl font-black tracking-tight font-['Space_Grotesk'] ${
                  financials.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {financials.netProfit >= 0 ? "+" : "-"}₹{Math.abs(financials.netProfit).toLocaleString("en-IN")}
              </span>
              <div className="flex flex-col">
                <span
                  className={`text-xs sm:text-sm font-bold font-mono ${
                    financials.netProfit >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {financials.marginPercent}% Net Margin
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  +₹{financials.profitPerKg}/Kg clean
                </span>
              </div>
            </div>
          </div>

          {/* Deal Health Badge */}
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-2 self-start sm:self-auto ${
              financials.health === "high"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : financials.health === "healthy"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                : financials.health === "thin"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full animate-ping bg-current" />
            <span>
              {financials.health === "high" && "🟢 HIGH PROFIT DEAL (Safe to dispatch)"}
              {financials.health === "healthy" && "🟢 VIABLE PROFIT (Good delivery)"}
              {financials.health === "thin" && "🟡 THIN MARGIN (+₹20 Deliv suggested)"}
              {financials.health === "loss" && "🔴 LOSS DEAL (Rider fare too high)"}
            </span>
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs font-mono">
          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Customer Pays</span>
            <span className="text-base font-bold text-white block mt-0.5 font-['Space_Grotesk']">
              ₹{financials.totalCustomerBill.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              Fish ₹{financials.fishBill} + Deliv ₹{customerShare}
            </span>
          </div>

          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Rider Payout</span>
            <span className="text-base font-bold text-cyan-300 block mt-0.5 font-['Space_Grotesk']">
              ₹{riderFare}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">Rapido / Courier fare</span>
          </div>

          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Farm Subsidy</span>
            <span
              className={`text-base font-bold block mt-0.5 font-['Space_Grotesk'] ${
                financials.farmDeliverySubsidy > 0 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {financials.farmDeliverySubsidy > 0 ? `-₹${financials.farmDeliverySubsidy}` : "₹0 (100% Paid)"}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {financials.farmDeliverySubsidy > 0 ? "Borne by Urban Trout" : "Customer covered 100%"}
            </span>
          </div>

          <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[10px] uppercase">Direct Farm COGS</span>
            <span className="text-base font-bold text-amber-300 block mt-0.5 font-['Space_Grotesk']">
              ₹{financials.totalDirectCost}
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              Fish ₹{financials.fishProcurementCost} + Labor ₹{financials.workerLaborCost} + Deliv
            </span>
          </div>
        </div>
      </div>

      {/* ─── CONTROLS SECTION ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT COLUMN: Weight & Fish Product */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-base">scale</span>
              <span>1. Biomass &amp; Cut Selection</span>
            </h2>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              ₹{activeRate}/Kg
            </span>
          </div>

          {/* Product Cut Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setProductCut("gutted");
                setCustomRateOverride(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                productCut === "gutted"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Gutted &amp; Cleaned</span>
              <span className="text-[10px] opacity-80">(₹{guttedRate})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setProductCut("whole");
                setCustomRateOverride(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                productCut === "whole"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Whole / Round</span>
              <span className="text-[10px] opacity-80">(₹{wholeRate})</span>
            </button>
          </div>

          {/* Weight Stepper & Display */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
              <span>Order Weight</span>
              <span className="text-white font-bold">{weight.toFixed(2)} Kg</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWeight((prev) => Math.max(0.5, Math.round((prev - 0.25) * 100) / 100))}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-lg flex items-center justify-center transition-all cursor-pointer border border-slate-700"
              >
                -
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="50"
                  value={weight}
                  onChange={(e) => setWeight(Math.max(0.1, Number(e.target.value) || 0))}
                  className="w-full h-11 bg-slate-950 border border-slate-700/80 rounded-xl text-center font-['Space_Grotesk'] text-xl font-black text-white focus:outline-none focus:border-emerald-400 transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                  Kg
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWeight((prev) => Math.round((prev + 0.25) * 100) / 100)}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-lg flex items-center justify-center transition-all cursor-pointer border border-slate-700"
              >
                +
              </button>
            </div>
          </div>

          {/* Weight Quick Chips */}
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-400 block">Quick Weight Chips</span>
            <div className="grid grid-cols-6 gap-1.5">
              {[1.0, 1.5, 2.0, 2.5, 3.0, 4.0].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeight(w)}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${
                    weight === w
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700"
                  }`}
                >
                  {w.toFixed(1)}k
                </button>
              ))}
            </div>
          </div>

          {/* Special Negotiation Rate Override */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
              <span>Negotiated Rate Override</span>
              {customRateOverride && (
                <button
                  type="button"
                  onClick={() => setCustomRateOverride(null)}
                  className="text-[10px] text-amber-400 hover:underline"
                >
                  Reset to standard
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {[540, 550, 560, 580, 600].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setCustomRateOverride(r)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                    activeRate === r
                      ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  ₹{r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Rapido Rider Fare & Customer Delivery Share */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400 text-base">local_shipping</span>
              <span>2. Delivery Logistics &amp; Rider</span>
            </h2>
            <span className="text-xs font-mono text-blue-400">
              Subsidy: ₹{financials.farmDeliverySubsidy}
            </span>
          </div>

          {/* Quick Locality Preset Selector */}
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1.5">
              Select Destination Locality (Auto-fills Fares)
            </label>
            <select
              value={locality}
              onChange={(e) => {
                const found = SRINAGAR_LOCALITY_PRESETS.find((p) => p.name === e.target.value);
                if (found) handleSelectLocality(found);
                else setLocality(e.target.value);
              }}
              className="w-full h-10 bg-slate-950 border border-slate-700/80 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-blue-400 font-mono transition-all"
            >
              {SRINAGAR_LOCALITY_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} — Rapido ~₹{p.rapidoAvg} (Cust Rec: ₹{p.customerShareRec})
                </option>
              ))}
            </select>
          </div>

          {/* Rapido Rider Cost Input & Chips */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
              <span>Rapido Rider Cost (Paid to Rider)</span>
              <span className="text-cyan-300 font-bold">₹{riderFare}</span>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              {[60, 90, 100, 120, 150, 180, 200, 240].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setRiderFare(amt)}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                    riderFare === amt
                      ? "bg-blue-500/25 text-blue-300 border-blue-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={riderFare}
              onChange={(e) => setRiderFare(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Or enter custom rider payout"
              className="w-full h-9 bg-slate-950 border border-slate-700/80 rounded-lg px-3 text-xs text-white font-mono focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Customer Delivery Share Input & Chips */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-mono">
              <span>Customer Delivery Share (Collected)</span>
              <span className="text-emerald-300 font-bold">₹{customerShare}</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 mb-2">
              {[
                { label: "Free (₹0)", val: 0 },
                { label: "₹29 (Z1)", val: 29 },
                { label: "₹39 (Z2)", val: 39 },
                { label: "₹69 (Z3)", val: 69 },
                { label: "₹89 (Z4)", val: 89 },
                { label: `Full (₹${riderFare})`, val: riderFare },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setCustomerShare(chip.val)}
                  className={`py-1.5 rounded-lg text-[10px] font-mono font-bold border truncate transition-all ${
                    customerShare === chip.val
                      ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={customerShare}
              onChange={(e) => setCustomerShare(Math.max(0, Number(e.target.value) || 0))}
              placeholder="Or enter custom customer delivery fee"
              className="w-full h-9 bg-slate-950 border border-slate-700/80 rounded-lg px-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>
      </div>

      {/* ─── REAL PRESETS: TODAY'S TEST ORDERS (1-TAP CHECK) ─── */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-amber-400">bolt</span>
            <span>1-Tap Real-World Test Orders</span>
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Load actual orders into calculator</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setWeight(1.94);
              setProductCut("gutted");
              setRiderFare(190);
              setCustomerShare(89);
              setLocality("Rawalpora (Aijaz Shanthoo)");
            }}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all group flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                Rawalpora Order (1.94 Kg Gutted)
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Rapido ₹190 • Cust Paid ₹89 • Fish ₹1,125
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
              +₹205 Net
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setWeight(2.76);
              setProductCut("whole");
              setCustomRateOverride(550);
              setRiderFare(100);
              setCustomerShare(0);
              setLocality("Khayam (Omar Rafiq Malik)");
            }}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all group flex items-center justify-between"
          >
            <div>
              <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                Khayam Order (2.76 Kg Whole @ ₹550)
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Rider ₹100 • Free Deliv (₹0) • Fish ₹1,520
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
              +₹219 Net
            </span>
          </button>
        </div>
      </div>

      {/* ─── WHATSAPP QUOTE & ACTIONS (1-TAP SHARING) ─── */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-lg">chat</span>
            <h3 className="text-sm font-bold text-white font-['Space_Grotesk']">
              1-Tap Customer WhatsApp Quote
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Cust Phone (e.g. 9419...)"
              className="h-8 bg-slate-950 border border-slate-700 rounded-lg px-2.5 text-xs text-white font-mono w-44 focus:outline-none focus:border-emerald-400"
            />
          </div>
        </div>

        {/* Quote Preview Box */}
        <pre className="bg-[#01080d] p-3.5 rounded-xl border border-slate-800/80 text-[11.5px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
          {whatsappQuote}
        </pre>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopyQuote}
            className="h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs font-mono flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base font-black">content_copy</span>
            <span>Copy WhatsApp Quote</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="h-11 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-xs font-mono flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border border-emerald-500/40"
          >
            <span className="material-symbols-outlined text-base">send</span>
            <span>Send in WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleCopyRiderSlip}
            className="h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border border-slate-700"
          >
            <span className="material-symbols-outlined text-base text-blue-400">two_wheeler</span>
            <span>Copy Rider Slip</span>
          </button>
        </div>
      </div>

      {/* ─── COGS & COST CONFIGURATION (ADMIN ONLY) ─── */}
      <div className="bg-slate-900/40 border border-slate-800/70 rounded-2xl p-4 text-xs font-mono space-y-3">
        <div className="flex items-center justify-between text-slate-400">
          <span className="font-bold flex items-center gap-1.5 text-slate-300">
            <span className="material-symbols-outlined text-sm text-cyan-400">tune</span>
            <span>Farm Procurement &amp; Labor Parameters (Admin Settings)</span>
          </span>
          <span className="text-[10px] text-slate-500">Live for this session</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Farm Procurement Cost (₹/Kg)
            </label>
            <input
              type="number"
              value={cogsPerKg}
              onChange={(e) => setCogsPerKg(Number(e.target.value) || 0)}
              className="w-full h-8 bg-slate-950 border border-slate-700 rounded-lg px-2.5 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Mohd Amin Gutting Labor (₹/Kg)
            </label>
            <input
              type="number"
              value={laborPerKg}
              onChange={(e) => setLaborPerKg(Number(e.target.value) || 0)}
              className="w-full h-8 bg-slate-950 border border-slate-700 rounded-lg px-2.5 text-xs text-white"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Standard Gutted Retail (₹/Kg)
            </label>
            <input
              type="number"
              value={guttedRate}
              onChange={(e) => setGuttedRate(Number(e.target.value) || 0)}
              className="w-full h-8 bg-slate-950 border border-slate-700 rounded-lg px-2.5 text-xs text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
