"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/supabase";

interface BillItem {
  id: string;
  name: string;
  pricePerKg: number;
  weightKg: number;
  total: number;
  unit: string;
}

const DEFAULT_PRODUCTS = [
  { id: "gutted-trout", name: "Premium Gutted Rainbow Trout (Cleaned)", pricePerKg: 600, unit: "Kg" },
  { id: "whole-trout", name: "Whole Live-Harvest Rainbow Trout", pricePerKg: 550, unit: "Kg" },
];

export default function POSBillingPage() {
  const [products, setProducts] = useState<typeof DEFAULT_PRODUCTS>(DEFAULT_PRODUCTS);
  const [selectedProductId, setSelectedProductId] = useState<string>("gutted-trout");
  const [currentWeight, setCurrentWeight] = useState<string>("1.0");

  const [billItems, setBillItems] = useState<BillItem[]>([
    {
      id: "gutted-trout",
      name: "Premium Gutted Rainbow Trout (Cleaned)",
      pricePerKg: 600,
      weightKg: 1.0,
      total: 600,
      unit: "Kg",
    },
  ]);

  // Customer Details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Cash" | "Card">("UPI");
  const [upiId, setUpiId] = useState("urbantrout@ybl");

  // State flags
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<any>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Load Inventory prices and UPI settings from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const { data: upiData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "upi_id")
          .single();
        if (upiData?.value) setUpiId(upiData.value);

        const { data: invData } = await supabase.from("inventory").select("*");
        if (invData && invData.length > 0) {
          const mapped = invData.map((item: InventoryItem) => ({
            id: item.product_id || item.id,
            name: item.product_name,
            pricePerKg: item.price_per_kg,
            unit: "Kg",
          }));
          setProducts(mapped);
          if (mapped[0]) {
            setSelectedProductId(mapped[0].id);
            setBillItems([
              {
                id: mapped[0].id,
                name: mapped[0].name,
                pricePerKg: mapped[0].pricePerKg,
                weightKg: 1.0,
                total: mapped[0].pricePerKg,
                unit: "Kg",
              },
            ]);
          }
        }
      } catch (err) {
        console.warn("Could not load inventory prices:", err);
      }
    }
    loadData();
  }, []);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInvoiceModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeProduct = products.find((p) => p.id === selectedProductId) || products[0];

  // ─── REAL-TIME AUTO-UPDATE LOGIC (On Keystroke) ──────────────
  const updateActiveWeight = (newWeightStr: string, prodId = selectedProductId) => {
    setCurrentWeight(newWeightStr);
    const prod = products.find((p) => p.id === prodId) || activeProduct;
    const w = parseFloat(newWeightStr);

    if (isNaN(w) || w <= 0) {
      setBillItems((prev) =>
        prev.map((item) => (item.id === prod.id ? { ...item, weightKg: 0, total: 0 } : item))
      );
      return;
    }

    const lineTotal = Math.round(w * prod.pricePerKg);
    setBillItems((prev) => {
      const exists = prev.some((item) => item.id === prod.id);
      if (exists) {
        return prev.map((item) =>
          item.id === prod.id
            ? { ...item, name: prod.name, pricePerKg: prod.pricePerKg, weightKg: w, total: lineTotal }
            : item
        );
      } else {
        return [
          ...prev,
          {
            id: prod.id,
            name: prod.name,
            pricePerKg: prod.pricePerKg,
            weightKg: w,
            total: lineTotal,
            unit: "Kg",
          },
        ];
      }
    });
  };

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const existing = billItems.find((i) => i.id === prodId);
    const wStr = existing ? existing.weightKg.toString() : currentWeight || "1.0";
    updateActiveWeight(wStr, prodId);
  };

  const handleQuickWeight = (val: number, isAdd = false) => {
    let w = parseFloat(currentWeight) || 0;
    if (isAdd) {
      w = Math.round((w + val) * 100) / 100;
    } else {
      w = val;
    }
    updateActiveWeight(w.toString());
  };

  const handleRemoveItem = (id: string) => {
    const remaining = billItems.filter((i) => i.id !== id);
    setBillItems(remaining);
    if (id === selectedProductId && remaining.length > 0) {
      setSelectedProductId(remaining[0].id);
      setCurrentWeight(remaining[0].weightKg.toString());
    }
  };

  // Live Totals
  const grandTotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const totalWeight = billItems.reduce((sum, item) => sum + item.weightKg, 0);

  // Dynamic UPI URI & High-Res QR Code
  const upiPayUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Farm&am=${grandTotal}&cu=INR&tn=Invoice-Payment`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    upiPayUri
  )}&bgcolor=255-255-255&color=2-13-18&margin=2`;

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // ─── GENERATE SHORT CLEAN INVOICE (e.g. /invoice/UT-INV-3986) ───
  const handleGenerateInvoice = async () => {
    if (billItems.length === 0 || grandTotal <= 0) {
      alert("Please enter a valid weight greater than 0 kg.");
      return;
    }

    const shortDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const invoiceNumber = `UT-INV-${shortDigits}`;
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);

    const invoicePayload = {
      num: invoiceNumber,
      name: customerName.trim() || "Valued Customer",
      phone: cleanPhone || "N/A",
      items: billItems.map((i) => ({ n: i.name, w: i.weightKg, r: i.pricePerKg, t: i.total })),
      tw: totalWeight,
      tot: grandTotal,
      notes: customerNotes,
      ts: Date.now(), // 48-Hour validity timestamp
    };

    // Store in app_settings under key inv_3986 (Takes ~150 bytes, zero order pollution)
    try {
      await supabase.from("app_settings").upsert(
        {
          key: `inv_${shortDigits}`,
          value: JSON.stringify(invoicePayload),
        },
        { onConflict: "key" }
      );
    } catch (err) {
      console.warn("Could not write short invoice key to settings:", err);
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "https://urbantrout.in";
    const invoicePublicUrl = `${origin}/invoice/${invoiceNumber}`;

    const invoiceData = {
      invoiceNumber,
      date: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      customerName: customerName.trim() || "Valued Customer",
      customerPhone: cleanPhone || "N/A",
      items: billItems,
      totalWeight,
      grandTotal,
      paymentMethod,
      notes: customerNotes,
      upiId,
      upiQrCodeUrl,
      upiPayUri,
      invoicePublicUrl,
    };

    setGeneratedInvoice(invoiceData);
    setInvoiceModalOpen(true);
  };

  // ─── POLITE & WARM WHATSAPP GREETING & INVOICE MESSAGE ───
  const handleShareWhatsApp = () => {
    if (!generatedInvoice) return;

    let itemLines = "";
    generatedInvoice.items.forEach((item: BillItem) => {
      itemLines += `• *${item.name}*: ${item.weightKg} Kg @ ₹${item.pricePerKg}/Kg = ₹${item.total.toLocaleString("en-IN")}\n`;
    });

    const msg = `Hello ${generatedInvoice.customerName},\n\nThank you for choosing Urban Trout, Srinagar! Here is the invoice for your freshly harvested Rainbow Trout:\n\n📄 *Invoice No:* ${generatedInvoice.invoiceNumber}\n🗓 *Date:* ${generatedInvoice.date}\n\n*Itemized Details:*\n${itemLines}\n⚖️ *Total Harvest Weight:* ${generatedInvoice.totalWeight.toFixed(2)} Kg\n💰 *Total Amount Payable:* ₹${generatedInvoice.grandTotal.toLocaleString("en-IN")}\n\n💳 *Pay via UPI ID:* ${generatedInvoice.upiId}\n\n📄 *View & Download Invoice PDF (Valid for 48 Hours):*\n${generatedInvoice.invoicePublicUrl}\n\n📍 *Farm Location:* Naseem Bagh / Malabagh, Srinagar\n📞 *Farm Helpline:* +91 84910 06127\n\n_Thank you for supporting sustainable Kashmiri aquaculture!_`;

    const encoded = encodeURIComponent(msg);
    const phoneParam = customerPhone.replace(/\D/g, "").slice(-10);
    const url = phoneParam.length === 10 ? `https://wa.me/91${phoneParam}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  const handleReset = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerNotes("");
    setCurrentWeight("1.0");
    if (products[0]) {
      setSelectedProductId(products[0].id);
      setBillItems([
        {
          id: products[0].id,
          name: products[0].name,
          pricePerKg: products[0].pricePerKg,
          weightKg: 1.0,
          total: products[0].pricePerKg,
          unit: "Kg",
        },
      ]);
    }
  };

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <span className="material-symbols-outlined text-xl sm:text-2xl">point_of_sale</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                ⚡ Real-Time Auto Calculator
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-[10px] text-slate-400 font-mono">48-Hr QR Invoicing</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Sales Billing &amp; Invoice Tool
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Reset Bill
        </button>
      </div>

      {/* ─── MAIN 2-COLUMN / MOBILE RESPONSIVE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* LEFT COLUMN: Weight Input & Customer (7 Cols) */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Card 1: Product & Live Real-Time Weight Input */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                <span className="material-symbols-outlined text-cyan-400 text-base sm:text-lg">scale</span>
                1. Select Harvest Trout &amp; Weight
              </h2>
              <span className="text-[11px] sm:text-xs text-slate-400 font-mono">₹{activeProduct.pricePerKg}/Kg</span>
            </div>

            {/* Product Selector Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {products.map((p) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p.id)}
                    className="p-3.5 rounded-xl text-left transition-all cursor-pointer active:scale-[0.99]"
                    style={{
                      background: isSelected ? "rgba(114,221,253,0.12)" : "rgba(3,16,24,0.6)",
                      border: isSelected ? "1.5px solid #72ddfd" : "1px solid rgba(61,74,83,0.6)",
                      boxShadow: isSelected ? "0 0 15px rgba(114,221,253,0.15)" : "none",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm leading-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        {p.name}
                      </h4>
                      <span className={`text-[10px] font-bold ${isSelected ? "text-cyan-400" : "text-slate-500"}`}>
                        {isSelected ? "● Active" : "○"}
                      </span>
                    </div>
                    <p className="text-cyan-400 font-bold text-sm sm:text-base mt-1.5 font-mono">₹{p.pricePerKg} / Kg</p>
                  </button>
                );
              })}
            </div>

            {/* Instant Live Weight Input */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  Harvested Weight (Auto-calculates on typing)
                </label>
                <span className="text-[11px] text-emerald-400 font-semibold animate-pulse">● Live updating</span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={currentWeight}
                  onChange={(e) => updateActiveWeight(e.target.value)}
                  placeholder="e.g. 4.5"
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-3.5 sm:py-4 text-xl sm:text-3xl font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm sm:text-base">
                  KG
                </span>
              </div>

              {/* Quick Weight Adder Chips */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
                <span className="text-[11px] text-slate-500 mr-0.5">Presets:</span>
                {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.5, 5.0].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleQuickWeight(w, false)}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-[11px] sm:text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                  >
                    {w} Kg
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleQuickWeight(0.5, true)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 active:scale-95 text-cyan-400 font-mono text-[11px] sm:text-xs font-bold transition-all border border-cyan-500/30 cursor-pointer"
                >
                  +0.5 Kg
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Customer Information */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
            <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              <span className="material-symbols-outlined text-cyan-400 text-base sm:text-lg">person</span>
              2. Customer Details (For WhatsApp Bill &amp; QR Invoice)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Suhail Ahmed"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  WhatsApp Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile (e.g. 7006604148)"
                  maxLength={10}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                  Notes / Packaging Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Extra iced, clean & cut into steaks."
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3.5 py-2.5 sm:py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Bill Summary & Instant QR (5 Cols) */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl space-y-5 p-4 sm:p-6">
            {/* Bill Title */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 font-mono">Live Calculator Total</span>
                <h3 className="text-lg sm:text-2xl font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Total Payable: <span className="text-cyan-400">₹{grandTotal.toLocaleString("en-IN")}</span>
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[11px] font-mono font-bold">
                {totalWeight.toFixed(2)} Kg
              </span>
            </div>

            {/* Line Items List */}
            <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
              {billItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-white text-xs truncate" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {item.name}
                    </h5>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {item.weightKg} Kg × ₹{item.pricePerKg}/Kg
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="font-bold text-cyan-400 font-mono text-sm">
                      ₹{item.total.toLocaleString("en-IN")}
                    </span>
                    {billItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer p-1"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-1 border-t border-slate-800">
              <label className="block text-[11px] uppercase tracking-wider font-bold text-slate-400">
                Payment Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["UPI", "Cash", "Card"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className="py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    style={{
                      background: paymentMethod === method ? "rgba(114,221,253,0.18)" : "rgba(3,16,24,0.6)",
                      border: paymentMethod === method ? "1.5px solid #72ddfd" : "1px solid rgba(61,74,83,0.5)",
                      color: paymentMethod === method ? "#72ddfd" : "#9fadb8",
                    }}
                  >
                    {method === "UPI" ? "📱 UPI QR" : method === "Cash" ? "💵 Cash" : "💳 Card / POS"}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic UPI QR Code Section */}
            {paymentMethod === "UPI" && grandTotal > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex flex-col items-center text-center space-y-2.5">
                <div className="p-2 bg-white border border-slate-300 rounded-xl shadow-lg">
                  <img src={upiQrCodeUrl} alt="UPI QR Code" className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg object-contain" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white font-mono">Scan with Any App: ₹{grandTotal.toLocaleString("en-IN")}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{upiId}</p>
                </div>
                <button
                  type="button"
                  onClick={copyUpi}
                  className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  {copiedUpi ? "Copied! ✓" : "Copy UPI ID"}
                </button>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={grandTotal <= 0}
                className="w-full py-4 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                <span className="material-symbols-outlined text-lg">receipt_long</span>
                Generate Invoice (₹{grandTotal.toLocaleString("en-IN")})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PRINTABLE INVOICE / PDF MODAL ─── */}
      {invoiceModalOpen && generatedInvoice && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setInvoiceModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="relative w-full max-w-md sm:max-w-lg bg-white text-slate-900 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            {/* Sticky Top Modal Header with Clear Close Button */}
            <div className="sticky -top-5 sm:-top-8 -mx-5 sm:-mx-8 px-5 sm:px-8 py-3 bg-white/95 backdrop-blur border-b z-20 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  ✓ {generatedInvoice.invoiceNumber}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
                Close
              </button>
            </div>

            {/* ─── PRINTABLE / DOWNLOADABLE INVOICE CONTENT ─── */}
            <div id="printable-receipt" className="space-y-4 sm:space-y-5 pt-2">
              {/* Receipt Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  URBAN TROUT AQUACULTURE
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">Naseem Bagh / Malabagh, Srinagar, J&amp;K — 190006</p>
                <p className="text-[11px] text-slate-500 font-medium">Helpline: +91 84910 06127 | info.urbantrout@gmail.com</p>
                <div className="inline-block mt-2 px-3 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-extrabold uppercase tracking-widest">
                  TAX INVOICE &amp; PAYMENT REQUEST
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="flex justify-between text-[11px] sm:text-xs text-slate-600 font-mono">
                <div>
                  <p><strong>Invoice:</strong> {generatedInvoice.invoiceNumber}</p>
                  <p><strong>Customer:</strong> {generatedInvoice.customerName}</p>
                  <p><strong>Phone:</strong> {generatedInvoice.customerPhone}</p>
                </div>
                <div className="text-right">
                  <p><strong>Date:</strong> {generatedInvoice.date}</p>
                  <p><strong>Status:</strong> <span className="text-amber-700 font-bold">PAYMENT DUE</span></p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border-t border-b border-dashed border-slate-300 py-2.5">
                <table className="w-full text-[11px] sm:text-xs text-left">
                  <thead>
                    <tr className="border-b font-bold text-slate-700">
                      <th className="py-1">Item Description</th>
                      <th className="py-1 text-center">Weight</th>
                      <th className="py-1 text-right">Rate</th>
                      <th className="py-1 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {generatedInvoice.items.map((item: BillItem, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 pr-2 font-sans font-medium text-slate-800">{item.name}</td>
                        <td className="py-2 text-center font-bold">{item.weightKg} Kg</td>
                        <td className="py-2 text-right">₹{item.pricePerKg}</td>
                        <td className="py-2 text-right font-bold">₹{item.total.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Grand Total Summary */}
              <div className="space-y-1 text-right">
                <div className="flex justify-between text-xs text-slate-600 font-mono">
                  <span>Total Harvest Weight:</span>
                  <span className="font-bold">{generatedInvoice.totalWeight.toFixed(2)} Kg</span>
                </div>
                <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 font-mono pt-1.5 border-t">
                  <span>TOTAL PAYABLE:</span>
                  <span className="text-base sm:text-xl text-slate-950">₹{generatedInvoice.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* ─── EMBEDDED UPI QR CODE FOR CUSTOMER TO SCAN & PAY ─── */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
                <div className="flex justify-center">
                  <div className="p-2 bg-white border border-slate-300 rounded-2xl shadow-sm inline-block">
                    <img src={generatedInvoice.upiQrCodeUrl} alt="Scan & Pay" className="w-32 h-32 sm:w-36 sm:h-36 object-contain" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Scan with Any UPI App (GPay / PhonePe / Paytm)
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">UPI ID: {generatedInvoice.upiId}</p>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center pt-2 text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                <p className="font-semibold text-slate-700">Fresh Live RAS Tank Harvested Trout</p>
                <p className="mt-0.5">Keep chilled at 0°C - 4°C. Valid for 48 hours.</p>
                <p className="font-mono text-[9px] text-slate-400 mt-1">Thank you for visiting Urban Trout Farm, Srinagar!</p>
              </div>
            </div>

            {/* Action Buttons (Hidden in Print) */}
            <div className="space-y-2.5 pt-3 border-t print:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print / Save PDF
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-base">share</span>
                  Send WhatsApp Bill
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Done &amp; Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
