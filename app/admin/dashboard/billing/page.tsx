"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";
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
  { id: "gutted-trout", name: "Premium Gutted Rainbow Trout (Cleaned)", pricePerKg: 590, unit: "Kg" },
  { id: "whole-trout", name: "Whole Rainbow Trout", pricePerKg: 550, unit: "Kg" },
];

const POS_CACHE_KEY = "urban_trout_pos_products_v3";

function getInitialProducts() {
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(POS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return DEFAULT_PRODUCTS;
}

export default function POSBillingPage() {
  const [products, setProducts] = useState<typeof DEFAULT_PRODUCTS>(() => getInitialProducts());
  const [selectedProductId, setSelectedProductId] = useState<string>("gutted-trout");
  const [currentWeight, setCurrentWeight] = useState<string>("1.0");

  const [billItems, setBillItems] = useState<BillItem[]>(() => {
    const prods = getInitialProducts();
    const defaultProd = prods.find((p) => p.id === "gutted-trout") || prods[0] || DEFAULT_PRODUCTS[0];
    return [
      {
        id: defaultProd.id,
        name: defaultProd.name,
        pricePerKg: defaultProd.pricePerKg,
        weightKg: 1.0,
        total: defaultProd.pricePerKg,
        unit: "Kg",
      },
    ];
  });

  // Customer Details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"JkBankSoundbox" | "RazorpayQR" | "Cash" | "Card">("JkBankSoundbox");
  const [upiId, setUpiId] = useState("JKBMERC00792230@jkb");
  const [soundboxPaid, setSoundboxPaid] = useState(false);

  // Razorpay Dynamic QR State
  const [rzpQrId, setRzpQrId] = useState<string | null>(null);
  const [rzpQrImageUrl, setRzpQrImageUrl] = useState<string | null>(null);
  const [rzpQrLoading, setRzpQrLoading] = useState(false);
  const [rzpQrError, setRzpQrError] = useState<string | null>(null);
  const [rzpPaid, setRzpPaid] = useState(false);
  const [rzpPaymentDetails, setRzpPaymentDetails] = useState<any>(null);
  const [lastGeneratedAmount, setLastGeneratedAmount] = useState<number>(0);

  // State flags
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [enlargeQrModal, setEnlargeQrModal] = useState(false);
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
          // Keep consistent ordering: gutted-trout first, then whole-trout, then others
          mapped.sort((a, b) => (a.id === "gutted-trout" ? -1 : 1));
          setProducts(mapped);
          try {
            localStorage.setItem(POS_CACHE_KEY, JSON.stringify(mapped));
          } catch {}

          // Synchronize prices to active bill items without wiping user's inputs
          setBillItems((prev) =>
            prev.map((item) => {
              const match = mapped.find((p) => p.id === item.id || item.id.startsWith(p.id));
              if (match && match.pricePerKg !== item.pricePerKg) {
                return {
                  ...item,
                  pricePerKg: match.pricePerKg,
                  name: match.name,
                  total: Math.round(item.weightKg * match.pricePerKg),
                };
              }
              return item;
            })
          );
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

  const activeProduct = products.find((p) => p.id === selectedProductId || selectedProductId?.startsWith(p.id)) || products[0];

  // ─── REAL-TIME AUTO-UPDATE LOGIC (On Keystroke) ──────────────
  const updateActiveWeight = (newWeightStr: string, prodId = selectedProductId) => {
    setCurrentWeight(newWeightStr);
    const prod = products.find((p) => p.id === prodId || prodId.startsWith(p.id)) || activeProduct;
    const w = parseFloat(newWeightStr);

    if (isNaN(w) || w <= 0) {
      setBillItems((prev) =>
        prev.map((item) => (item.id === prodId ? { ...item, weightKg: 0, total: 0 } : item))
      );
      return;
    }

    const lineTotal = Math.round(w * prod.pricePerKg);
    setBillItems((prev) => {
      if (prev.length === 0) {
        return [
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

      if (prev.length === 1 && prev[0].id !== prodId) {
        return [
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

      const exists = prev.some((item) => item.id === prodId);
      if (exists) {
        return prev.map((item) =>
          item.id === prodId
            ? { ...item, name: prod.name, pricePerKg: item.pricePerKg || prod.pricePerKg, weightKg: w, total: Math.round(w * (item.pricePerKg || prod.pricePerKg)) }
            : item
        );
      }

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
    });
  };

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId) || products[0];
    const w = parseFloat(currentWeight) || 1.0;

    setBillItems((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: prod.id,
            name: prod.name,
            pricePerKg: prod.pricePerKg,
            weightKg: w,
            total: Math.round(w * prod.pricePerKg),
            unit: "Kg",
          },
        ];
      }

      // If only 1 item in the bill, SWITCH that item cleanly to the selected product!
      if (prev.length === 1) {
        const currentW = prev[0].weightKg > 0 ? prev[0].weightKg : w;
        return [
          {
            id: prod.id,
            name: prod.name,
            pricePerKg: prod.pricePerKg,
            weightKg: currentW,
            total: Math.round(currentW * prod.pricePerKg),
            unit: "Kg",
          },
        ];
      }

      // If multiple items are in the bill, switch focus to this product's weight
      const existing = prev.find((item) => item.id === prodId || item.id.startsWith(prodId));
      if (existing) {
        setCurrentWeight(existing.weightKg.toString());
        return prev;
      }

      return prev;
    });
  };

  const handleAddProductItem = (prodId?: string) => {
    const targetProd = prodId
      ? products.find((p) => p.id === prodId) || products[0]
      : products.find((p) => !billItems.some((i) => i.id === p.id || i.id.startsWith(p.id))) || products[0];

    const uniqueId = billItems.some((i) => i.id === targetProd.id)
      ? `${targetProd.id}-${Date.now()}`
      : targetProd.id;

    const defaultWeight = 1.0;
    const lineTotal = Math.round(defaultWeight * targetProd.pricePerKg);

    const newItem: BillItem = {
      id: uniqueId,
      name: targetProd.name,
      pricePerKg: targetProd.pricePerKg,
      weightKg: defaultWeight,
      total: lineTotal,
      unit: "Kg",
    };

    setBillItems((prev) => [...prev, newItem]);
    setSelectedProductId(uniqueId);
    setCurrentWeight(defaultWeight.toString());
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
    if (remaining.length > 0) {
      setSelectedProductId(remaining[0].id);
      setCurrentWeight(remaining[0].weightKg.toString());
    } else {
      setCurrentWeight("0");
    }
  };

  // Live Totals
  const grandTotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const totalWeight = billItems.reduce((sum, item) => sum + item.weightKg, 0);

  // Dynamic J&K Bank Soundbox UPI URI & High-Res QR Code
  const upiPayUri = grandTotal > 0
    ? `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&tr=TERM00792230&am=${grandTotal}&cu=INR&tn=Urban%20Trout%20POS`
    : `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&tr=TERM00792230&cu=INR`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
    upiPayUri
  )}&bgcolor=255-255-255&color=2-13-18&margin=2`;

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Play a pleasant two-tone synthesized payment success chime
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Tone 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2: B5 (987.77 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(987.77, now + 0.12);
      gain2.gain.setValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch (_) {}
  };

  // Generate dynamic Razorpay Single-Use BharatQR / UPI QR code
  const generateRazorpayQr = async (targetAmount: number, force = false) => {
    if (targetAmount <= 0) return;
    if (!force && targetAmount === lastGeneratedAmount && rzpQrId && !rzpPaid) return;

    setRzpQrLoading(true);
    setRzpQrError(null);
    setRzpPaid(false);
    setRzpPaymentDetails(null);

    try {
      const res = await fetch("/api/razorpay/pos-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: targetAmount,
          customerName: customerName.trim() || "Walk-in Customer",
          customerPhone: customerPhone.trim() || "N/A",
          billNumber: Math.floor(1000 + Math.random() * 9000),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Could not generate Razorpay QR");
      }

      setRzpQrId(data.qr_id);
      setRzpQrImageUrl(data.image_url);
      setLastGeneratedAmount(targetAmount);
    } catch (err: any) {
      console.error("Razorpay QR generation failed:", err);
      setRzpQrError(err.message || "Failed to generate Razorpay QR code");
    } finally {
      setRzpQrLoading(false);
    }
  };

  // Invalidate QR if grandTotal changes so old amounts are not scanned
  useEffect(() => {
    if (rzpQrId && grandTotal !== lastGeneratedAmount) {
      setRzpQrId(null);
      setRzpQrImageUrl(null);
      setRzpPaid(false);
      setRzpPaymentDetails(null);
    }
  }, [grandTotal, lastGeneratedAmount, rzpQrId]);

  // Real-time polling for incoming Razorpay payment (Ultra-responsive 1.2s interval)
  useEffect(() => {
    if (paymentMethod !== "RazorpayQR" || !rzpQrId || rzpPaid) return;

    let isSubscribed = true;

    const checkPayment = async () => {
      if (!isSubscribed || rzpPaid) return;
      try {
        const res = await fetch(`/api/razorpay/pos-qr?qr_id=${encodeURIComponent(rzpQrId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.paid && data.payment && isSubscribed) {
          setRzpPaid(true);
          setRzpPaymentDetails(data.payment);
          playSuccessChime();

          // Send instant real-time Telegram alert
          fetch("/api/telegram-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "razorpay_payment",
              data: {
                paymentId: data.payment.id,
                amount: data.payment.amount,
                status: "captured",
                method: data.payment.method,
                vpa: data.payment.vpa,
                customerName: customerName.trim() || "Walk-in Customer",
                customerPhone: customerPhone.trim() || undefined,
                description: `Counter POS Billing (${totalWeight.toFixed(2)} Kg)`,
                channel: "Counter POS QR",
              },
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Error polling payment status:", err);
      }
    };

    // Quick initial check after 600ms
    const initialTimer = setTimeout(checkPayment, 600);
    // Rapid polling interval every 1200ms (1.2 seconds)
    const pollInterval = setInterval(checkPayment, 1200);

    return () => {
      isSubscribed = false;
      clearTimeout(initialTimer);
      clearInterval(pollInterval);
    };
  }, [paymentMethod, rzpQrId, rzpPaid]);

  // ─── GENERATE SHORT CLEAN INVOICE (e.g. /invoice/UT-INV-3986) ───
  const handleGenerateInvoice = async () => {
    if (billItems.length === 0 || grandTotal <= 0) {
      alert("Please enter a valid weight greater than 0 kg.");
      return;
    }

    const shortDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const invoiceNumber = `UT-INV-${shortDigits}`;
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);

    const isRzpPaid = paymentMethod === "RazorpayQR" && rzpPaid;
    const isSoundbox = paymentMethod === "JkBankSoundbox";
    const paymentStatus = (isRzpPaid || isSoundbox || paymentMethod === "Cash" || soundboxPaid) ? "PAID" : "PAYMENT DUE";
    const paymentMethodLabel = isSoundbox
      ? "J&K Bank Soundbox UPI"
      : isRzpPaid
      ? "Razorpay UPI (Verified)"
      : paymentMethod === "RazorpayQR"
      ? "Razorpay QR"
      : paymentMethod === "Cash"
      ? "Cash"
      : "Card / POS";

    const invoicePayload = {
      num: invoiceNumber,
      name: customerName.trim() || "Valued Customer",
      phone: cleanPhone || "N/A",
      items: billItems.map((i) => ({ n: i.name, w: i.weightKg, r: i.pricePerKg, t: i.total })),
      tw: totalWeight,
      tot: grandTotal,
      notes: customerNotes,
      paymentMethod: paymentMethodLabel,
      paymentStatus,
      paymentId: rzpPaymentDetails?.id || null,
      ts: Date.now(), // 48-Hour validity timestamp
    };

    // Encode invoice payload directly into URL (fallback if DB save fails)
    const encodedPayload = btoa(encodeURIComponent(JSON.stringify(invoicePayload)));
    const origin = typeof window !== "undefined" ? window.location.origin : "https://urbantrout.in";

    // Try to save to DB via server API — if it works, use short clean URL
    let invoicePublicUrl = `${origin}/invoice/${invoiceNumber}?d=${encodedPayload}`; // fallback
    try {
      const res = await adminFetch("/api/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: shortDigits, data: invoicePayload }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success) {
          invoicePublicUrl = `${origin}/invoice/${invoiceNumber}`;
        }
      }
    } catch (_) {}

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
      paymentMethod: paymentMethodLabel,
      paymentStatus,
      paymentId: rzpPaymentDetails?.id || null,
      notes: customerNotes,
      upiId,
      upiQrCodeUrl: (paymentMethod === "RazorpayQR" && rzpQrImageUrl) ? rzpQrImageUrl : upiQrCodeUrl,
      upiPayUri,
      invoicePublicUrl,
    };

    // Notify Telegram channel about new POS invoice
    fetch("/api/telegram-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "pos_invoice",
        data: {
          invoiceNumber,
          customerName: customerName.trim() || "Walk-in Customer",
          customerPhone: cleanPhone || undefined,
          totalWeight,
          grandTotal,
          paymentMethod: paymentMethodLabel,
          paymentId: rzpPaymentDetails?.id || null,
          paymentStatus,
          itemsSummary: billItems.map((b) => `${b.name} (${b.weightKg} Kg)`).join(", "),
          publicUrl: invoicePublicUrl,
        },
      }),
    }).catch(() => {});

    setGeneratedInvoice(invoiceData);
    setInvoiceModalOpen(true);
  };

  // ─── 100% UNIVERSAL CLEAN WHATSAPP MESSAGE ───
  const handleShareWhatsApp = () => {
    if (!generatedInvoice) return;

    let itemLines = "";
    generatedInvoice.items.forEach((item: BillItem) => {
      itemLines += `- *${item.name}*: ${item.weightKg} Kg @ Rs. ${item.pricePerKg}/Kg = Rs. ${item.total.toLocaleString("en-IN")}\n`;
    });

    const statusLine = generatedInvoice.paymentStatus === "PAID"
      ? `*Payment Status:* PAID ✓ (via ${generatedInvoice.paymentMethod}${generatedInvoice.paymentId ? `, Ref: ${generatedInvoice.paymentId}` : ""})\n\n`
      : `*Payment Status:* Payment Due (Scan QR or Pay upon pickup)\n*Pay via UPI ID:* ${generatedInvoice.upiId}\n\n`;

    const msg = `Hello ${generatedInvoice.customerName},\n\nThank you for choosing Urban Trout, Srinagar! Here is the invoice for your freshly harvested Rainbow Trout:\n\n*Invoice No:* ${generatedInvoice.invoiceNumber}\n*Date:* ${generatedInvoice.date}\n\n*Itemized Details:*\n${itemLines}\n*Total Harvest Weight:* ${generatedInvoice.totalWeight.toFixed(2)} Kg\n*Total Amount Payable:* Rs. ${generatedInvoice.grandTotal.toLocaleString("en-IN")}\n\n${statusLine}*View & Download Invoice PDF (Valid for 48 Hours):*\n${generatedInvoice.invoicePublicUrl}\n\n*Farm Location:* Naseem Bagh / Malabagh, Srinagar\n*Farm Helpline:* +91 84910 06127\n\n_Thank you for supporting sustainable Kashmiri aquaculture!_`;

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
    setRzpQrId(null);
    setRzpQrImageUrl(null);
    setRzpPaid(false);
    setRzpPaymentDetails(null);
    setLastGeneratedAmount(0);
    setRzpQrError(null);
    setSoundboxPaid(false);
    const prods = getInitialProducts();
    const defaultProd = prods.find((p) => p.id === "gutted-trout") || prods[0] || DEFAULT_PRODUCTS[0];
    setSelectedProductId(defaultProd.id);
    setBillItems([
      {
        id: defaultProd.id,
        name: defaultProd.name,
        pricePerKg: defaultProd.pricePerKg,
        weightKg: 1.0,
        total: defaultProd.pricePerKg,
        unit: "Kg",
      },
    ]);
  };

  return (
    <div className="px-3 py-2 sm:px-5 sm:py-3 max-w-7xl mx-auto space-y-3">
      {/* ─── COMPACT HEADER BAR ─── */}
      <div className="flex items-center justify-between py-1 px-0.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
            <span className="material-symbols-outlined text-lg">point_of_sale</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Sales Billing &amp; Invoice POS
            </h1>
            <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 hidden sm:inline">
              ⚡ Auto-Calculator
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Reset Bill
        </button>
      </div>

      {/* ─── MAIN 2-COLUMN GRID (COMPACT ABOVE-THE-FOLD) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* LEFT COLUMN: Weight Input & Customer (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Card 1: Product & Live Real-Time Weight Input */}
          <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                <span className="material-symbols-outlined text-cyan-400 text-base">scale</span>
                1. Harvest Trout &amp; Weight
              </h2>
              <span className="text-[11px] text-cyan-400 font-mono font-bold">₹{activeProduct.pricePerKg}/Kg</span>
            </div>

            {/* Product Selector Chips with direct + Icon */}
            <div className="grid grid-cols-2 gap-2">
              {products.map((p) => {
                const isInBill = billItems.some((i) => i.id === p.id || i.id.startsWith(p.id));
                const itemInBill = billItems.find((i) => i.id === p.id || i.id.startsWith(p.id));
                const isSelected = selectedProductId === p.id || selectedProductId?.startsWith(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p.id)}
                    className="p-2.5 rounded-xl text-left transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-2"
                    style={{
                      background: isSelected ? "rgba(114,221,253,0.18)" : "rgba(3,16,24,0.6)",
                      border: isSelected ? "1.5px solid #72ddfd" : isInBill ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(61,74,83,0.5)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-white text-xs leading-tight truncate" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                          {p.name}
                        </h4>
                        <span className={`text-[9px] font-bold ${isSelected ? "text-cyan-400" : isInBill ? "text-emerald-400" : "text-slate-600"}`}>
                          {isSelected ? "● Active" : isInBill ? "✓ Added" : "○"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-cyan-400 font-bold text-xs sm:text-sm font-mono">₹{p.pricePerKg}/Kg</p>
                        {itemInBill && (
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">
                            {itemInBill.weightKg} Kg
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dedicated + Icon to add this product as an additional item */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddProductItem(p.id);
                      }}
                      title={`Add ${p.name.split(" ")[0]} to Bill`}
                      className="w-7 h-7 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-black text-sm transition-all cursor-pointer flex-shrink-0"
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Instant Live Weight Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <label className="uppercase tracking-wider font-bold text-slate-400">
                  Harvested Weight ({activeProduct.name.split(" ")[0]})
                </label>
                <span className="text-emerald-400 font-semibold animate-pulse">● Live updating</span>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={currentWeight}
                  onChange={(e) => updateActiveWeight(e.target.value)}
                  placeholder="e.g. 1.0"
                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-2 sm:py-2.5 text-xl sm:text-2xl font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 shadow-inner"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs sm:text-sm">
                  KG
                </span>
              </div>

              {/* Quick Weight Adder Chips & Add Product Button */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-mono">Presets:</span>
                  {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.5, 5.0].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => handleQuickWeight(w, false)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] font-semibold border border-slate-700 cursor-pointer"
                    >
                      {w}k
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleQuickWeight(0.5, true)}
                    className="px-2 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-400 font-mono text-[11px] font-bold border border-cyan-500/30 cursor-pointer"
                  >
                    +0.5
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddProductItem()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Add another item or trout variety to bill"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  + Add Item
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Customer Information */}
          <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-xl">
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              <span className="material-symbols-outlined text-cyan-400 text-base">person</span>
              2. Customer Details (WhatsApp Bill &amp; Invoice)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Suhail Ahmed"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">
                  WhatsApp Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">
                  Packaging / Delivery Notes (Optional)
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Extra iced, clean & cut into steaks."
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Bill Summary & Instant QR (5 Cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-3 sm:p-4 space-y-2.5 shadow-2xl">
            {/* Header: Total Payable Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div>
                <span className="text-[9px] uppercase font-bold tracking-widest text-slate-500 font-mono">Live Total</span>
                <h3 className="text-xl sm:text-2xl font-black text-white leading-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Payable: <span className="text-cyan-400">₹{grandTotal.toLocaleString("en-IN")}</span>
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold">
                {totalWeight.toFixed(2)} Kg
              </span>
            </div>

            {/* ─── ITEMIZED PRODUCTS IN BILL (WITH REMOVE ✕ & SELECTION) ─── */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-400 px-0.5">
                <span>Items in Bill ({billItems.length})</span>
                <span>Subtotal</span>
              </div>

              {billItems.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-dashed border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400">No items added to bill yet.</p>
                  <div className="flex items-center justify-center gap-2">
                    {products.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProductItem(p.id)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/25 cursor-pointer"
                      >
                        + Add {p.name.split(" ")[0]} (₹{p.pricePerKg}/kg)
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {billItems.map((item) => {
                    const isFocused = selectedProductId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedProductId(item.id);
                          setCurrentWeight(item.weightKg.toString());
                        }}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          isFocused
                            ? "bg-slate-950 border-cyan-500/50 shadow-sm shadow-cyan-950/40"
                            : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{item.name}</span>
                            {isFocused && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-400 text-[9px] font-bold">
                                Selected
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            <strong className="text-slate-200">{item.weightKg.toFixed(2)} Kg</strong> × ₹{item.pricePerKg}/Kg
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono font-bold text-cyan-400 text-xs sm:text-sm">
                            ₹{item.total.toLocaleString("en-IN")}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveItem(item.id);
                            }}
                            title={`Remove ${item.name}`}
                            className="w-6 h-6 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 flex items-center justify-center font-black text-xs transition-all cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Channel Selector */}
            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              {[
                { id: "JkBankSoundbox", label: "🔊 J&K Soundbox", sub: "Instant Voice" },
                { id: "RazorpayQR", label: "⚡ Razorpay", sub: "Auto-Verify" },
                { id: "Cash", label: "💵 Cash", sub: "Counter" },
                { id: "Card", label: "💳 Card / POS", sub: "Terminal" },
              ].map((channel) => {
                const isSel = paymentMethod === channel.id;
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => setPaymentMethod(channel.id as any)}
                    className="py-1.5 px-1 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer text-center"
                    style={{
                      background: isSel
                        ? channel.id === "JkBankSoundbox"
                          ? "rgba(16,185,129,0.2)"
                          : "rgba(114,221,253,0.18)"
                        : "rgba(3,16,24,0.6)",
                      border: isSel
                        ? channel.id === "JkBankSoundbox"
                          ? "1.5px solid #10b981"
                          : "1.5px solid #72ddfd"
                        : "1px solid rgba(61,74,83,0.5)",
                      color: isSel
                        ? channel.id === "JkBankSoundbox"
                          ? "#34d399"
                          : "#72ddfd"
                        : "#9fadb8",
                      boxShadow: isSel
                        ? channel.id === "JkBankSoundbox"
                          ? "0 0 10px rgba(16,185,129,0.2)"
                          : "0 0 10px rgba(114,221,253,0.15)"
                        : "none",
                    }}
                  >
                    <div className="leading-tight truncate">{channel.label}</div>
                    <span className="text-[8.5px] opacity-75 font-mono normal-case block">
                      {channel.sub}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ─── PAYMENT CHANNEL PANELS ─── */}

            {/* 1. J&K Bank Soundbox Panel (Default) */}
            {paymentMethod === "JkBankSoundbox" && grandTotal > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex flex-col items-center text-center space-y-2">
                {soundboxPaid ? (
                  <div className="w-full py-4 px-3 rounded-xl bg-gradient-to-b from-emerald-950/40 to-slate-950 border border-emerald-500/40 text-center space-y-2 animate-fadeIn">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto text-xl font-black shadow-lg shadow-emerald-500/20">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        Soundbox Payment Confirmed: <span className="text-emerald-400">₹{grandTotal.toLocaleString("en-IN")}</span>
                      </h4>
                      <p className="text-xs text-emerald-300 font-mono mt-0.5">
                        🔊 Voice announcement confirmed on counter soundbox
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundboxPaid(false)}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer pt-1"
                    >
                      Show QR Again
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between w-full pb-1 border-b border-slate-800/80 text-[10px] font-mono">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                        J&amp;K Bank Soundbox QR
                      </span>
                      <span className="text-slate-400">🎙️ Voice Box Active</span>
                    </div>

                    <div
                      onClick={() => setEnlargeQrModal(true)}
                      className="p-2 bg-white border-2 border-emerald-500/30 rounded-xl shadow-xl shadow-emerald-950/30 cursor-pointer hover:border-emerald-400 transition-all group relative"
                      title="Click to enlarge for customer"
                    >
                      <img
                        src={upiQrCodeUrl}
                        alt="J&K Bank Soundbox QR"
                        className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg object-contain"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center text-white text-[11px] font-bold gap-1">
                        <span>🔍 Tap to Enlarge</span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white font-mono">
                        Scan to Pay: <span className="text-emerald-400 font-black">₹{grandTotal.toLocaleString("en-IN")}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Urban Trout Aquaculture • {upiId}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5 w-full">
                      <button
                        type="button"
                        onClick={() => setEnlargeQrModal(true)}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        🔍 Enlarge QR
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSoundboxPaid(true);
                          playSuccessChime();
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                      >
                        🔊 Soundbox Heard ✓
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 2. Razorpay Dynamic BharatQR Panel */}
            {paymentMethod === "RazorpayQR" && grandTotal > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex flex-col items-center text-center space-y-2">
                {rzpPaid ? (
                  /* ─── PAID CELEBRATION CARD ─── */
                  <div className="w-full py-4 px-3 rounded-xl bg-gradient-to-b from-emerald-950/40 to-slate-950 border border-emerald-500/40 text-center space-y-2 animate-fadeIn">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center mx-auto text-xl font-black shadow-lg shadow-emerald-500/20">
                      ✓
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        Payment Received: <span className="text-emerald-400">₹{rzpPaymentDetails?.amount || grandTotal}</span>
                      </h4>
                      <p className="text-xs text-slate-300 font-mono mt-0.5">
                        Ref: <strong className="text-cyan-300">{rzpPaymentDetails?.id || "pay_verified"}</strong>
                      </p>
                      {rzpPaymentDetails?.vpa && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          From: {rzpPaymentDetails.vpa}
                        </p>
                      )}
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-semibold flex items-center justify-center gap-1">
                      <span>⚡</span> Verified via Razorpay. Bill marked PAID.
                    </div>
                  </div>
                ) : rzpQrLoading ? (
                  <div className="py-10 flex flex-col items-center justify-center space-y-2 text-slate-400">
                    <span className="animate-spin text-xl">⏳</span>
                    <p className="text-xs font-mono">Generating Razorpay QR...</p>
                  </div>
                ) : rzpQrError ? (
                  <div className="w-full p-3 rounded-xl bg-red-950/60 border border-red-500/30 text-center space-y-1.5">
                    <p className="text-xs text-red-300">⚠️ {rzpQrError}</p>
                    <button
                      type="button"
                      onClick={() => generateRazorpayQr(grandTotal, true)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Retry QR
                    </button>
                  </div>
                ) : rzpQrImageUrl ? (
                  <>
                    {/* The 100% Clean, Unobstructed QR Box (~180px) */}
                    <div
                      onClick={() => setEnlargeQrModal(true)}
                      className="w-44 h-44 sm:w-48 sm:h-48 bg-white border-2 border-cyan-400/60 rounded-2xl shadow-xl overflow-hidden cursor-pointer group flex items-center justify-center p-1.5 transition-all hover:border-cyan-300"
                      title="Click to view fullscreen"
                    >
                      <div className="w-full h-full overflow-hidden rounded-xl flex items-center justify-center bg-white">
                        <img
                          src={rzpQrImageUrl}
                          alt="Razorpay Dynamic QR"
                          className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-200 group-hover:scale-[1.32]"
                          style={{
                            objectPosition: "center 51.5%",
                            transform: "scale(1.28)",
                          }}
                        />
                      </div>
                    </div>

                    {/* QR Status Bar & Controls */}
                    <div className="flex items-center justify-between w-full px-1 pt-0.5">
                      <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        Listening for scan...
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEnlargeQrModal(true)}
                          className="px-2 py-0.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          Enlarge
                        </button>
                        <button
                          type="button"
                          onClick={() => generateRazorpayQr(grandTotal, true)}
                          className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase cursor-pointer"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ─── READY STATE: ON-DEMAND BUTTON TO GENERATE QR ─── */
                  <div className="w-full py-4 px-3 text-center space-y-2.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto text-lg">
                      <span className="material-symbols-outlined text-xl">qr_code_2</span>
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        Customer QR Code
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Amount locked to <strong className="text-cyan-300 font-mono text-xs sm:text-sm">₹{grandTotal.toLocaleString("en-IN")}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => generateRazorpayQr(grandTotal, true)}
                      disabled={grandTotal <= 0}
                      className="w-full py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black uppercase tracking-wider text-xs transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    >
                      <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                      Generate Customer QR (₹{grandTotal.toLocaleString("en-IN")})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. Cash Payment Panel */}
            {paymentMethod === "Cash" && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-center space-y-2">
                <span className="text-2xl block">💵</span>
                <h4 className="text-sm font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Cash Payment Selected
                </h4>
                <p className="text-xs text-slate-400">
                  Collect <strong className="text-emerald-400 font-mono">₹{grandTotal.toLocaleString("en-IN")}</strong> in cash from the customer at counter.
                </p>
                <p className="text-[10px] text-slate-500 font-mono">Invoice will be recorded with &quot;Cash&quot; status.</p>
              </div>
            )}

            {/* 4. Card / EDC POS Panel */}
            {paymentMethod === "Card" && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/20 text-center space-y-2">
                <span className="text-2xl block">💳</span>
                <h4 className="text-sm font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Card / Physical POS Terminal
                </h4>
                <p className="text-xs text-slate-400">
                  Swipe or tap credit/debit card on EDC POS Machine for <strong className="text-cyan-300 font-mono">₹{grandTotal.toLocaleString("en-IN")}</strong>.
                </p>
                <p className="text-[10px] text-slate-500 font-mono">Invoice will be marked with &quot;Card / POS&quot; payment.</p>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={grandTotal <= 0}
                className="w-full py-2.5 sm:py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50 text-slate-950 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                <span className="material-symbols-outlined text-base sm:text-lg">receipt_long</span>
                Generate Invoice (₹{grandTotal.toLocaleString("en-IN")})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PRINTABLE INVOICE / PDF MODAL (WITH FLOATING TOP ACTION BAR) ─── */}
      {invoiceModalOpen && generatedInvoice && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setInvoiceModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <div className="relative w-full max-w-md sm:max-w-xl bg-white text-slate-900 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-4 my-4 max-h-[95vh] overflow-y-auto">
            {/* ─── FLOATING TOP STICKY BAR: 1-CLICK SHARE & PRINT (NO SCROLLING NEEDED) ─── */}
            <div className="sticky -top-4 sm:-top-7 -mx-4 sm:-mx-7 px-4 sm:px-7 py-3 bg-slate-950 text-white border-b border-slate-800 z-30 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 print:hidden">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg">
                  {generatedInvoice.invoiceNumber}
                </span>
                <span className="text-xs font-bold text-white font-mono sm:hidden">
                  ₹{generatedInvoice.grandTotal.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Floating Quick Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">share</span>
                  Send WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-initial py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  Print / PDF
                </button>

                <button
                  type="button"
                  onClick={() => setInvoiceModalOpen(false)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all cursor-pointer flex items-center justify-center"
                  title="Close Window"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {/* ─── PRINTABLE / DOWNLOADABLE INVOICE CONTENT ─── */}
            <div id="printable-receipt" className="space-y-4 pt-1">
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
                  <p>
                    <strong>Status:</strong>{" "}
                    <span className={generatedInvoice.paymentStatus === "PAID" ? "text-emerald-700 font-bold uppercase" : "text-amber-700 font-bold uppercase"}>
                      {generatedInvoice.paymentStatus}
                    </span>
                  </p>
                  {generatedInvoice.paymentId && (
                    <p className="text-[10px] text-slate-500 font-mono">Ref: {generatedInvoice.paymentId}</p>
                  )}
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

              {/* ─── EMBEDDED UPI QR CODE / PAID VERIFICATION BADGE ─── */}
              {generatedInvoice.paymentStatus === "PAID" ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-xl font-bold shadow-sm">
                    ✓
                  </div>
                  <h4 className="text-sm font-extrabold text-emerald-900 tracking-wide uppercase">
                    Payment Received &amp; Verified
                  </h4>
                  <p className="text-xs text-emerald-800 font-mono font-medium">
                    Method: {generatedInvoice.paymentMethod} {generatedInvoice.paymentId ? `• Ref: ${generatedInvoice.paymentId}` : ""}
                  </p>
                  <p className="text-[10px] text-emerald-600">
                    Payment recorded on {generatedInvoice.date}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2.5">
                  <div className="flex justify-center">
                    <div className="w-44 h-44 sm:w-52 sm:h-52 bg-white border border-slate-300 rounded-2xl shadow-sm overflow-hidden inline-flex items-center justify-center">
                      <img
                        src={generatedInvoice.upiQrCodeUrl}
                        alt="Scan & Pay"
                        className={`w-full h-full ${generatedInvoice.upiQrCodeUrl?.includes("rzp.io") ? "object-cover" : "object-contain p-2"}`}
                        style={
                          generatedInvoice.upiQrCodeUrl?.includes("rzp.io")
                            ? { objectPosition: "center 51.5%", transform: "scale(1.28)" }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Scan with Any UPI App (GPay / PhonePe / Paytm)
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {generatedInvoice.paymentMethod?.includes("Razorpay") ? "Razorpay Dynamic Merchant QR" : `UPI ID: ${generatedInvoice.upiId}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Footer Note */}
              <div className="text-center pt-2 text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                <p className="font-semibold text-slate-700">Fresh Live RAS Tank Harvested Trout</p>
                <p className="mt-0.5">Keep chilled at 0°C - 4°C. Valid for 48 hours.</p>
                <p className="font-mono text-[9px] text-slate-400 mt-1">Thank you for visiting Urban Trout Farm, Srinagar!</p>
              </div>
            </div>

            {/* Bottom Dismiss Button (Hidden in Print) */}
            <div className="pt-2 border-t print:hidden">
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

      {/* ─── FULLSCREEN / GIANT QR MODAL ─── */}
      {enlargeQrModal && (
        <div
          onClick={() => setEnlargeQrModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-emerald-500/40 rounded-3xl p-5 sm:p-7 max-w-sm sm:max-w-md w-full text-center space-y-4 shadow-2xl shadow-emerald-950/60 cursor-default"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 font-mono block">
                  {paymentMethod === "JkBankSoundbox" ? "J&K Bank Soundbox Screen" : "Customer Scan Screen"}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Pay ₹{grandTotal.toLocaleString("en-IN")} via UPI
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEnlargeQrModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Giant QR Box */}
            <div className="flex justify-center py-2">
              <div className="w-72 h-72 sm:w-80 sm:h-80 bg-white border-2 border-emerald-400 rounded-3xl shadow-2xl overflow-hidden relative flex items-center justify-center p-3">
                {paymentMethod === "RazorpayQR" && rzpQrImageUrl ? (
                  <img
                    src={rzpQrImageUrl}
                    alt="Razorpay Dynamic QR"
                    className="w-full h-full object-cover select-none pointer-events-none rounded-2xl"
                    style={{
                      objectPosition: "center 51.5%",
                      transform: "scale(1.28)",
                    }}
                  />
                ) : (
                  <img
                    src={upiQrCodeUrl}
                    alt="J&K Bank Soundbox QR"
                    className="w-full h-full object-contain select-none pointer-events-none rounded-2xl"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-bold text-white">
                {paymentMethod === "JkBankSoundbox"
                  ? "Scan with J&K mPay, Google Pay, PhonePe, or Paytm"
                  : "Scan with Google Pay, PhonePe, Paytm, CRED, or BHIM"}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                {paymentMethod === "JkBankSoundbox"
                  ? `Amount locked to ₹${grandTotal.toLocaleString("en-IN")} • Soundbox Voice Alert Active`
                  : `Amount locked to ₹${grandTotal.toLocaleString("en-IN")} • Instant Auto-Confirmation`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEnlargeQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Back to POS Bill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
