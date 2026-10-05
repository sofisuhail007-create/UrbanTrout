"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import CustomerAutocompleteInput, { DbCustomer } from "./CustomerAutocompleteInput";
import { InvoiceSlipData } from "@/components/FourUpInvoiceSheet";

interface CatchWeightWorkspaceTabProps {
  upiId: string;
  activeScaleWeight?: string;
  onOpenFourUpPrint: (slip: InvoiceSlipData) => void;
  onSwitchTab?: (tab: any) => void;
  customers?: DbCustomer[];
  loadingCustomers?: boolean;
}

export default function CatchWeightWorkspaceTab({
  upiId,
  activeScaleWeight,
  onOpenFourUpPrint,
  onSwitchTab,
  customers = [],
  loadingCustomers = false,
}: CatchWeightWorkspaceTabProps) {
  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  // Variety & Rates
  const [productType, setProductType] = useState<"Gutted" | "Whole">("Gutted");
  const [ratePerKg, setRatePerKg] = useState<number>(580);

  // Weights
  const [orderedWeight, setOrderedWeight] = useState<string>("2.00");
  const [actualWeight, setActualWeight] = useState<string>("1.80");

  // Advance Payment
  const [isPrepaid, setIsPrepaid] = useState<boolean>(true);
  const [advancePaid, setAdvancePaid] = useState<string>("1160");

  // Output / Generated State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSlip, setGeneratedSlip] = useState<InvoiceSlipData | null>(null);
  const [recentSlips, setRecentSlips] = useState<InvoiceSlipData[]>([]);

  // Numeric Calculations
  const numRate = Number(ratePerKg) || 580;
  const numOrdered = parseFloat(orderedWeight) || 0;
  const numActual = parseFloat(actualWeight) || 0;
  const numDeliveryFee = Number(deliveryFee) || 0;

  const harvestSubtotal = Math.round(numActual * numRate);
  const harvestGrandTotal = harvestSubtotal + numDeliveryFee;

  const numAdvance = isPrepaid ? (parseFloat(advancePaid) || 0) : 0;

  const varianceKg = numOrdered - numActual; // positive = under-weight (refund), negative = over-weight (balance)
  const refundAmount = isPrepaid && numAdvance > harvestGrandTotal ? numAdvance - harvestGrandTotal : 0;
  const balanceAmount = isPrepaid
    ? (harvestGrandTotal > numAdvance ? harvestGrandTotal - numAdvance : 0)
    : harvestGrandTotal;

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setDeliveryFee(0);
    setProductType("Gutted");
    setRatePerKg(580);
    setOrderedWeight("2.00");
    setActualWeight("1.80");
    setAdvancePaid("1160");
    setIsPrepaid(true);
    setGeneratedSlip(null);
  };

  const handleGenerateAndSave = async (printDirectly: boolean = false) => {
    if (numActual <= 0) {
      alert("Please enter a valid harvest scale weight greater than 0 kg.");
      return;
    }

    const shortDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const invoiceNumber = `UT-INV-${shortDigits}`;
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);
    const cleanName = customerName.trim() || "Valued Customer";

    setIsGenerating(true);
    try {
      const invoicePayload = {
        num: invoiceNumber,
        name: cleanName,
        customerName: cleanName,
        phone: cleanPhone || "N/A",
        customerPhone: cleanPhone || "N/A",
        items: [
          {
            n: `${productType === "Gutted" ? "Premium Gutted" : "Farm-Fresh Whole"} Rainbow Trout`,
            name: `${productType === "Gutted" ? "Premium Gutted" : "Farm-Fresh Whole"} Rainbow Trout`,
            w: numActual,
            weightKg: numActual,
            ow: numOrdered,
            orderedWeightKg: numOrdered,
            r: numRate,
            pricePerKg: numRate,
            t: harvestSubtotal,
            total: harvestSubtotal,
          },
        ],
        tw: numActual,
        totalWeight: numActual,
        tot: harvestGrandTotal,
        grandTotal: harvestGrandTotal,
        subtotal: harvestSubtotal,
        deliveryFee: numDeliveryFee,
        orderedWeight: numOrdered,
        paidAmount: numAdvance,
        balanceAmount,
        refundAmount,
        balanceStatus: balanceAmount > 0 ? "pending" : "settled",
        paymentStatus: isPrepaid ? (refundAmount > 0 ? "REFUND DUE" : "PAID") : "PAYMENT DUE",
        paymentMethod: isPrepaid ? "WhatsApp Advance / Online UPI" : "Cash on Delivery",
        notes: customerAddress ? `Delivery: ${customerAddress}` : "",
        address: customerAddress,
        ts: Date.now(),
      };

      // Persist to Supabase invoices table
      await supabase.from("invoices").insert([
        {
          id: shortDigits,
          data: invoicePayload,
        },
      ]);

      const slipData: InvoiceSlipData = {
        invoiceNumber,
        orderNumber: shortDigits,
        customerName: cleanName,
        customerPhone: cleanPhone,
        customerAddress,
        createdAt: Date.now(),
        items: [
          {
            name: `${productType === "Gutted" ? "Premium Gutted" : "Farm-Fresh Whole"} Rainbow Trout`,
            weightKg: numActual,
            orderedWeightKg: numOrdered,
            pricePerKg: numRate,
            total: harvestSubtotal,
          },
        ],
        orderedWeight: numOrdered,
        totalWeight: numActual,
        subtotal: harvestSubtotal,
        deliveryFee: numDeliveryFee,
        grandTotal: harvestGrandTotal,
        paidAmount: numAdvance,
        balanceAmount,
        refundAmount,
        paymentStatus: isPrepaid ? (refundAmount > 0 ? "REFUND DUE" : "PAID") : "PAYMENT DUE",
        paymentMethod: isPrepaid ? "WhatsApp Advance / Online UPI" : "Cash on Delivery",
        upiId: upiId || "JKBMERC00828895@jkb",
      };

      setGeneratedSlip(slipData);
      setRecentSlips((prev) => [slipData, ...prev.slice(0, 9)]);

      if (printDirectly) {
        onOpenFourUpPrint(slipData);
      }
    } catch (err: any) {
      console.error("Catch-weight invoice save error:", err);
      alert(`Could not save invoice: ${err?.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getWhatsAppMessage = (slip: InvoiceSlipData) => {
    const cleanPhone = slip.customerPhone ? String(slip.customerPhone).replace(/\D/g, "").slice(-10) : "";
    const isRefund = (slip.refundAmount || 0) > 0;
    const isDue = (slip.balanceAmount || 0) > 0;

    let outcomeText = "";
    if (isRefund) {
      outcomeText = `💵 *CASH REFUND / CASHBACK DUE TO YOU: ₹${slip.refundAmount}*\n(Our delivery rider will hand you ₹${slip.refundAmount} in cash or UPI at handover)`;
    } else if (isDue) {
      outcomeText = `⚠️ *BALANCE DUE ON DELIVERY: ₹${slip.balanceAmount}*\n(A Locked J&K Bank Dynamic UPI QR is pre-filled on your bill for 1-tap payment)`;
    } else {
      outcomeText = `✓ *VERIFIED PAID IN FULL (₹${slip.grandTotal})*\n(Do not pay any cash to delivery rider)`;
    }

    const text = `*URBAN TROUT AQUACULTURE* — Harvest & Delivery Bill\n` +
      `Invoice: *#${slip.invoiceNumber}*\n` +
      `Customer: ${slip.customerName}\n\n` +
      `Ordered Weight: ${slip.orderedWeight?.toFixed(2) || "2.00"} Kg (Advance Paid: ₹${slip.paidAmount?.toLocaleString("en-IN") || 0})\n` +
      `Actual Harvest Scale Weight: *${slip.totalWeight?.toFixed(2)} Kg*\n` +
      `Rate: ₹${numRate}/Kg\n` +
      `Net Bill Amount: *₹${slip.grandTotal.toLocaleString("en-IN")}*\n\n` +
      `${outcomeText}\n\n` +
      `View digital bill & receipt:\n` +
      `https://urbantrout.in/invoice/${slip.invoiceNumber}`;

    return {
      encodedUrl: cleanPhone
        ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`,
      rawText: text,
    };
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* ─── BANNER HEADER ─── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-2 border-amber-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-amber-500/10">
            ⚖️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                WhatsApp Catch-Weight &amp; Delivery Billing
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                SEPARATE DESK
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono mt-0.5">
              Reconcile WhatsApp advance weight vs actual harvest scale weight • Instant cash refund instructions or locked J&amp;K Bank balance QR codes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={resetForm}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-slate-700"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Reset Form</span>
          </button>
        </div>
      </div>

      {/* ─── MAIN 2-COLUMN WORKSPACE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN: Data Entry (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card 1: Customer & Delivery Details */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span>👤</span> Customer &amp; Delivery Details
              </span>
              <span className="text-[10px] text-slate-500 font-mono">WhatsApp Customer</span>
            </div>

            <CustomerAutocompleteInput
              customerName={customerName}
              customerPhone={customerPhone}
              customerNotes={customerAddress}
              onNameChange={setCustomerName}
              onPhoneChange={setCustomerPhone}
              onNotesChange={setCustomerAddress}
              customers={customers}
              loadingCustomers={loadingCustomers}
              showNotesField={false}
              theme="emerald"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className="text-[10.5px] font-bold text-slate-400 uppercase font-mono block mb-1">
                  Delivery Address / Landmark:
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Rajbagh near Zero Bridge"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-400 uppercase font-mono block mb-1">
                  Delivery Charge (₹):
                </label>
                <input
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono font-bold"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Catch-Weight Scales & Advance */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span>🐟</span> Variety &amp; Weights
              </span>
              <span className="text-xs text-cyan-400 font-mono font-bold">
                Rate: ₹{ratePerKg}/Kg
              </span>
            </div>

            {/* Variety Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setProductType("Gutted");
                  setRatePerKg(580);
                  const ord = parseFloat(orderedWeight) || 0;
                  if (ord > 0) setAdvancePaid(String(Math.round(ord * 580)));
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  productType === "Gutted"
                    ? "bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10 font-bold"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs">Gutted Rainbow Trout</div>
                <div className="text-cyan-400 font-mono text-xs font-bold mt-0.5">₹580 / Kg</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProductType("Whole");
                  setRatePerKg(550);
                  const ord = parseFloat(orderedWeight) || 0;
                  if (ord > 0) setAdvancePaid(String(Math.round(ord * 550)));
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  productType === "Whole"
                    ? "bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/10 font-bold"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs">Whole Rainbow Trout</div>
                <div className="text-cyan-400 font-mono text-xs font-bold mt-0.5">₹550 / Kg</div>
              </button>
            </div>

            {/* STEP 1: Ordered Weight */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
                  <span>1️⃣</span> Ordered Weight (What customer requested on WhatsApp):
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  Target: <strong className="text-white">{numOrdered} Kg</strong>
                </span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={orderedWeight}
                  onChange={(e) => {
                    const val = e.target.value;
                    setOrderedWeight(val);
                    const n = parseFloat(val);
                    if (!isNaN(n) && n > 0) {
                      setAdvancePaid(String(Math.round(n * numRate)));
                    }
                  }}
                  placeholder="e.g. 2.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xl font-mono text-cyan-300 font-black focus:outline-none focus:border-cyan-400"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                  KG
                </span>
              </div>

              {/* Quick ordered chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-500 font-mono">Presets:</span>
                {["1.0", "1.5", "2.0", "2.5", "3.0", "4.0", "5.0"].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setOrderedWeight(w);
                      setAdvancePaid(String(Math.round(parseFloat(w) * numRate)));
                    }}
                    className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer ${
                      orderedWeight === w
                        ? "bg-cyan-500/25 text-cyan-300 border-cyan-400 font-bold"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800"
                    }`}
                  >
                    {w} Kg
                  </button>
                ))}
              </div>
            </div>

            {/* STEP 2: Actual Harvest Scale Weight */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border-2 border-amber-500/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-300 font-mono flex items-center gap-1.5">
                  <span>2️⃣</span> Actual Harvest Scale Weight (What you weighed/killed):
                </label>
                <div className="flex items-center gap-2">
                  {activeScaleWeight && (
                    <button
                      type="button"
                      onClick={() => setActualWeight(activeScaleWeight)}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer font-mono"
                    >
                      📥 Pull Scale ({activeScaleWeight} Kg)
                    </button>
                  )}
                  <span className="text-[11px] text-amber-400 font-mono font-bold">
                    {numActual > 0 ? `${(numActual * 1000).toFixed(0)} grams` : ""}
                  </span>
                </div>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={actualWeight}
                  onChange={(e) => setActualWeight(e.target.value)}
                  placeholder="e.g. 1.80"
                  className="w-full bg-slate-900 border border-amber-500/60 rounded-xl px-4 py-2.5 text-2xl font-mono text-amber-300 font-black focus:outline-none focus:border-amber-400 shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm">
                  KG
                </span>
              </div>

              {/* Quick scale presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-500 font-mono">Scale Presets:</span>
                {["1.50", "1.75", "1.80", "1.85", "1.90", "1.95", "2.00", "2.05", "2.10", "2.15", "2.20"].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setActualWeight(w)}
                    className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-semibold border transition-all cursor-pointer ${
                      actualWeight === w
                        ? "bg-amber-500 text-slate-950 border-amber-400 font-bold"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* STEP 3: Payment Status & Advance Received */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <label className="text-xs font-bold text-slate-300 font-mono block">
                3️⃣ Customer Advance / Payment Mode:
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPrepaid(true);
                    if (!advancePaid || advancePaid === "0") {
                      setAdvancePaid(String(Math.round(numOrdered * numRate)));
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isPrepaid
                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold shadow-md shadow-emerald-950/30"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="text-xs flex items-center gap-1.5">
                    <span>💳</span>
                    <span>Paid in Advance via WhatsApp</span>
                  </div>
                  <div className="text-[10px] text-emerald-300/80 font-mono mt-0.5">
                    Customer already sent UPI / Online
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrepaid(false)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !isPrepaid
                      ? "bg-amber-500/20 border-amber-400 text-amber-200 font-bold shadow-md shadow-amber-950/30"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="text-xs flex items-center gap-1.5">
                    <span>💵</span>
                    <span>Pay on Delivery (COD)</span>
                  </div>
                  <div className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                    Collect via Locked J&amp;K Bank QR
                  </div>
                </button>
              </div>

              {isPrepaid && (
                <div className="pt-1 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Advance Amount Received from Customer:</span>
                    <button
                      type="button"
                      onClick={() => setAdvancePaid(String(Math.round(numOrdered * numRate)))}
                      className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                    >
                      Reset to Est. (₹{Math.round(numOrdered * numRate)})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={advancePaid}
                      onChange={(e) => setAdvancePaid(e.target.value)}
                      placeholder="e.g. 1160"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-base font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Calculation Preview & Action Center (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card: Calculation Breakdown */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span>📊</span> Live Reconciliation Breakdown
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold">
                {productType} Trout
              </span>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Ordered Weight:</span>
                <span className="text-slate-200 font-bold">{numOrdered.toFixed(2)} Kg</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Actual Harvest Scale:</span>
                <span className="text-cyan-300 font-black text-sm">{numActual.toFixed(2)} Kg</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Rate per Kg:</span>
                <span className="text-slate-300 font-bold">₹{numRate}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Harvest Trout Subtotal:</span>
                <span className="text-white font-bold">₹{harvestSubtotal.toLocaleString("en-IN")}</span>
              </div>
              {numDeliveryFee > 0 && (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Delivery Charge:</span>
                  <span className="text-white font-bold">₹{numDeliveryFee}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-200">Total Harvest Bill:</span>
                <span className="font-black font-mono text-cyan-300 text-base">
                  ₹{harvestGrandTotal.toLocaleString("en-IN")}
                </span>
              </div>
              {isPrepaid && (
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span>Advance Received:</span>
                  <span className="text-emerald-300 font-bold font-mono">₹{numAdvance.toLocaleString("en-IN")}</span>
                </div>
              )}
            </div>

            {/* ─── LIVE OUTCOME BANNER ─── */}
            <div className="pt-2">
              {/* CASE 1: REFUND DUE (e.g. ordered 2.00 Kg, actual 1.80 Kg) */}
              {isPrepaid && refundAmount > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500 space-y-2 text-emerald-200 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-emerald-300 flex items-center gap-1.5 font-mono">
                      <span>💵</span>
                      <span>CASH REFUND / CASHBACK DUE:</span>
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-300">
                      ₹{refundAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-200/90 leading-tight">
                    Customer paid for {numOrdered.toFixed(2)} Kg (₹{numAdvance}), but harvest weight is {numActual.toFixed(2)} Kg (₹{harvestGrandTotal}).
                  </p>
                  <div className="pt-2 border-t border-emerald-500/30 text-[11px] text-emerald-100 font-semibold space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span>🛵</span>
                      <span><strong>Rider Handover:</strong> Return ₹{refundAmount} cash/UPI to customer</span>
                    </div>
                    <div className="text-[10px] text-emerald-300/80">
                      Printed on slip: Handover checkbox for rider &amp; customer sign-off.
                    </div>
                  </div>
                </div>
              )}

              {/* CASE 2: EXTRA BALANCE DUE (e.g. ordered 2.00 Kg, actual 2.10 Kg) */}
              {isPrepaid && balanceAmount > 0 && (
                <div className="p-4 rounded-2xl bg-amber-950/80 border-2 border-amber-500 space-y-2 text-amber-200 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-mono">
                      <span>⚠️</span>
                      <span>EXTRA BALANCE DUE FROM CUSTOMER:</span>
                    </span>
                    <span className="text-2xl font-black font-mono text-amber-300">
                      ₹{balanceAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-tight">
                    Customer paid ₹{numAdvance}, but actual harvest scale weight is {numActual.toFixed(2)} Kg (Total ₹{harvestGrandTotal}).
                  </p>
                  <div className="pt-2 border-t border-amber-500/30 text-[11px] text-amber-100 font-semibold space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span>📱</span>
                      <span><strong>Locked J&amp;K Bank Dynamic UPI QR:</strong></span>
                    </div>
                    <div className="text-[10.5px] text-amber-200/90">
                      Slip generates QR locked to exactly <strong>₹{balanceAmount}</strong>. Customer scans to pay balance.
                    </div>
                  </div>
                </div>
              )}

              {/* CASE 3: EXACT MATCH */}
              {isPrepaid && refundAmount === 0 && balanceAmount === 0 && (
                <div className="p-3.5 rounded-2xl bg-blue-950/70 border border-blue-500/50 text-blue-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>✓</span>
                    <span>Exact weight match. Verified Paid in full (₹{harvestGrandTotal}).</span>
                  </div>
                  <span className="text-[11px] font-bold text-blue-300 font-mono">Zero Balance</span>
                </div>
              )}

              {/* CASE 4: COD / UNPAID */}
              {!isPrepaid && (
                <div className="p-4 rounded-2xl bg-amber-950/80 border-2 border-amber-500 space-y-2 text-amber-200 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5 font-mono">
                      <span>⚠️</span>
                      <span>FULL PAYMENT DUE ON DELIVERY:</span>
                    </span>
                    <span className="text-2xl font-black font-mono text-amber-300">
                      ₹{harvestGrandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/90 leading-tight">
                    Order is unpaid. Delivery slip will feature a <strong>Locked J&amp;K Bank Dynamic UPI QR</strong> for ₹{harvestGrandTotal}.
                  </p>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                type="button"
                disabled={isGenerating || numActual <= 0}
                onClick={() => handleGenerateAndSave(true)}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
              >
                <span>🖨️</span>
                <span>{isGenerating ? "Generating..." : "Generate & Print 4-Up Slip (Canon)"}</span>
              </button>

              <button
                type="button"
                disabled={isGenerating || numActual <= 0}
                onClick={() => handleGenerateAndSave(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 disabled:opacity-50"
              >
                <span>💾</span>
                <span>Save Invoice Record Only</span>
              </button>

              {/* Generated Success Links */}
              {generatedSlip && (
                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold font-mono">
                      ✓ Created #{generatedSlip.invoiceNumber}
                    </span>
                    <a
                      href={`/invoice/${generatedSlip.invoiceNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline text-[11px] font-mono"
                    >
                      Open Web Invoice ↗
                    </a>
                  </div>

                  {(() => {
                    const wa = getWhatsAppMessage(generatedSlip);
                    return (
                      <a
                        href={wa.encodedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">chat</span>
                        <span>Send WhatsApp Receipt to Customer</span>
                      </a>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── RECENT CATCH-WEIGHT SLIPS TABLE (TODAY'S DISPATCHES) ─── */}
      {recentSlips.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <span>📋</span> Recent WhatsApp Catch-Weight Slips
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Today&apos;s Dispatches</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {recentSlips.map((s, idx) => {
              const wa = getWhatsAppMessage(s);
              return (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-white">{s.customerName}</strong>
                      <span className="text-slate-500 font-mono">#{s.invoiceNumber}</span>
                      {(s.refundAmount || 0) > 0 ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold font-mono">
                          💵 Refund ₹{s.refundAmount}
                        </span>
                      ) : (s.balanceAmount || 0) > 0 ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold font-mono">
                          ⚠️ Balance ₹{s.balanceAmount}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold font-mono">
                          ✓ Paid
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Scale: {s.totalWeight?.toFixed(2)} Kg · Bill: ₹{s.grandTotal} · Phone: +91 {s.customerPhone}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenFourUpPrint(s)}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Print on Canon MF244dw"
                    >
                      <span>🖨️</span>
                      <span>Print</span>
                    </button>
                    <a
                      href={wa.encodedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 transition-all cursor-pointer"
                      title="Send WhatsApp"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
