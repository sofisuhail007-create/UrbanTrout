"use client";
import { useState, useEffect, useRef } from "react";
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
  const [isSaving, setIsSaving] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<any>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Load Inventory prices and UPI settings from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch Store UPI ID
        const { data: upiData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "upi_id")
          .single();
        if (upiData?.value) setUpiId(upiData.value);

        // Fetch Inventory
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

  // Selected product object
  const activeProduct = products.find((p) => p.id === selectedProductId) || products[0];

  // Live Calculations
  const grandTotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const totalWeight = billItems.reduce((sum, item) => sum + item.weightKg, 0);

  // Add or Update Line Item
  const handleAddOrUpdateItem = () => {
    const weight = parseFloat(currentWeight);
    if (isNaN(weight) || weight <= 0) {
      alert("Please enter a valid weight greater than 0 kg.");
      return;
    }

    const price = activeProduct.pricePerKg;
    const lineTotal = Math.round(weight * price);

    const existingIndex = billItems.findIndex((item) => item.id === activeProduct.id);
    if (existingIndex > -1) {
      const updated = [...billItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        weightKg: weight,
        total: lineTotal,
      };
      setBillItems(updated);
    } else {
      setBillItems([
        ...billItems,
        {
          id: activeProduct.id,
          name: activeProduct.name,
          pricePerKg: price,
          weightKg: weight,
          total: lineTotal,
          unit: "Kg",
        },
      ]);
    }
  };

  // Quick weight helper
  const handleQuickWeight = (val: number, isAdd = false) => {
    let w = parseFloat(currentWeight) || 0;
    if (isAdd) {
      w = Math.round((w + val) * 100) / 100;
    } else {
      w = val;
    }
    setCurrentWeight(w.toString());
  };

  const handleRemoveItem = (id: string) => {
    setBillItems(billItems.filter((i) => i.id !== id));
  };

  // Dynamic UPI URI & QR Code
  const upiPayUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Farm&am=${grandTotal}&cu=INR&tn=Invoice%20Billing`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    upiPayUri
  )}&bgcolor=16-33-44&color=114-221-253&margin=2`;

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Save Order to Supabase and Open Invoice Modal
  const handleGenerateInvoice = async () => {
    if (billItems.length === 0 || grandTotal <= 0) {
      alert("Please add at least one item with valid weight.");
      return;
    }

    setIsSaving(true);
    try {
      const invoiceNumber = "INV-" + Math.floor(100000 + Math.random() * 900000);
      const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);

      const orderPayload = {
        customer_name: customerName.trim() || "Walk-in Customer",
        customer_phone: cleanPhone || "9999999999",
        customer_address: "Live Vending Center / Farm POS, Naseem Bagh, Srinagar",
        customer_locality: "Naseem Bagh / Malabagh",
        customer_pincode: "190006",
        items: billItems.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.weightKg,
          price: i.pricePerKg,
          unit: i.unit,
        })),
        subtotal: grandTotal,
        delivery_fee: 0,
        total: grandTotal,
        delivery_zone: "Farm POS / Live Vending",
        status: "delivered",
      };

      const { data: insertedOrder } = await supabase.from("orders").insert(orderPayload).select("*").single();

      // Upsert customer profile if phone exists
      if (cleanPhone && cleanPhone.length === 10) {
        try {
          await supabase.from("customers").upsert(
            {
              phone: cleanPhone,
              name: customerName.trim() || "Walk-in Customer",
              locality: "Srinagar (Farm Counter)",
              notes: `POS Invoice #${invoiceNumber}`,
              last_order_at: new Date().toISOString(),
            },
            { onConflict: "phone" }
          );
        } catch (e) {}
      }

      const invoiceData = {
        invoiceNumber: insertedOrder?.order_number ? `UT-INV-${insertedOrder.order_number}` : invoiceNumber,
        date: new Date().toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        customerName: customerName.trim() || "Walk-in Customer",
        customerPhone: cleanPhone || "N/A",
        items: billItems,
        totalWeight,
        grandTotal,
        paymentMethod,
        notes: customerNotes,
        upiId,
      };

      setGeneratedInvoice(invoiceData);
      setInvoiceModalOpen(true);
    } catch (err) {
      console.error("Error generating invoice:", err);
      alert("Failed to save invoice. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // WhatsApp Share Invoice
  const handleShareWhatsApp = () => {
    if (!generatedInvoice) return;
    let itemLines = "";
    generatedInvoice.items.forEach((item: BillItem) => {
      itemLines += `• ${item.name}: ${item.weightKg} Kg @ ₹${item.pricePerKg}/Kg = ₹${item.total.toLocaleString("en-IN")}\n`;
    });

    const msg = `*URBAN TROUT AQUACULTURE — TAX INVOICE / RECEIPT* 🐟\n\n*Invoice No:* ${generatedInvoice.invoiceNumber}\n*Date:* ${generatedInvoice.date}\n*Customer:* ${generatedInvoice.customerName} (${generatedInvoice.customerPhone})\n\n*Purchased Items:*\n${itemLines}\n*Total Weight:* ${generatedInvoice.totalWeight.toFixed(2)} Kg\n*Total Paid:* ₹${generatedInvoice.grandTotal.toLocaleString("en-IN")}\n*Payment Mode:* ${generatedInvoice.paymentMethod}\n\n*Farm Location:* Naseem Bagh / Malabagh, Srinagar\n*Helpline:* +91 84910 06127\n_Thank you for choosing freshest live-harvested trout!_`;

    const encoded = encodeURIComponent(msg);
    const phoneParam = customerPhone.replace(/\D/g, "").slice(-10);
    const url = phoneParam.length === 10 ? `https://wa.me/91${phoneParam}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  // Reset Bill
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
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <span className="material-symbols-outlined text-2xl">point_of_sale</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                Live POS Counter
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-xs text-emerald-400 font-semibold">Real-Time Weight Calculator</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Sales Billing &amp; Invoice Tool
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Reset Calculator
        </button>
      </div>

      {/* ─── MAIN 2-COLUMN POS LAYOUT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Weight Input & Item Customizer (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Product & Exact Weight Input */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                <span className="material-symbols-outlined text-cyan-400 text-lg">scale</span>
                1. Select Harvest Trout &amp; Exact Weight
              </h2>
              <span className="text-xs text-slate-400 font-mono">Live Rate: ₹{activeProduct.pricePerKg}/Kg</span>
            </div>

            {/* Product Selector Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((p) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(p.id);
                    }}
                    className="p-4 rounded-xl text-left transition-all cursor-pointer"
                    style={{
                      background: isSelected ? "rgba(114,221,253,0.12)" : "rgba(3,16,24,0.6)",
                      border: isSelected ? "1.5px solid #72ddfd" : "1px solid rgba(61,74,83,0.6)",
                      boxShadow: isSelected ? "0 0 15px rgba(114,221,253,0.15)" : "none",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-white text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        {p.name}
                      </h4>
                      <span className={`text-xs font-bold ${isSelected ? "text-cyan-400" : "text-slate-500"}`}>
                        {isSelected ? "● Active" : "○"}
                      </span>
                    </div>
                    <p className="text-cyan-400 font-bold text-base mt-2 font-mono">₹{p.pricePerKg} / Kg</p>
                  </button>
                );
              })}
            </div>

            {/* Decimal Weight Input */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                Harvested Weight (in Kilograms)
              </label>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value)}
                    placeholder="e.g. 4.5"
                    className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-5 py-4 text-2xl font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                    KG
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddOrUpdateItem}
                  className="px-6 py-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-base">add_shopping_cart</span>
                  Update Bill
                </button>
              </div>

              {/* Quick Weight Adder Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500 mr-1">Quick Select:</span>
                {[1.0, 1.5, 2.0, 2.5, 3.0, 4.5, 5.0].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => handleQuickWeight(w, false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                  >
                    {w} Kg
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleQuickWeight(0.5, true)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-400 font-mono text-xs font-bold transition-all border border-cyan-500/30 cursor-pointer"
                >
                  +0.5 Kg
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Customer Information */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              <span className="material-symbols-outlined text-cyan-400 text-lg">person</span>
              2. Customer Details (For WhatsApp Bill &amp; Records)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Suhail Ahmed"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                  WhatsApp Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                  Notes / Packaging Instructions (Optional)
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Clean and cut into 6 steaks, pack with ice."
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Bill Summary & Instant UPI QR (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl space-y-6 p-6">
            {/* Bill Title */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Live POS Bill</span>
                <h3 className="text-xl font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Current Total: <span className="text-cyan-400">₹{grandTotal.toLocaleString("en-IN")}</span>
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold">
                {totalWeight.toFixed(2)} Kg Total
              </span>
            </div>

            {/* Line Items List */}
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {billItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <h5 className="font-bold text-white text-xs" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      {item.name}
                    </h5>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {item.weightKg} Kg × ₹{item.pricePerKg}/Kg
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-cyan-400 font-mono text-sm">
                      ₹{item.total.toLocaleString("en-IN")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                Payment Method
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
              <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 flex flex-col items-center text-center space-y-3">
                <div className="p-2 bg-slate-900 border border-cyan-500/30 rounded-xl shadow-lg">
                  <img src={upiQrCodeUrl} alt="UPI QR" className="w-40 h-40 rounded-lg" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white font-mono">Scan to Pay: ₹{grandTotal.toLocaleString("en-IN")}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{upiId}</p>
                </div>
                <button
                  type="button"
                  onClick={copyUpi}
                  className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  {copiedUpi ? "Copied UPI ID! ✓" : "Copy UPI ID"}
                </button>
              </div>
            )}

            {/* Primary Generate & Save Invoice Button */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleGenerateInvoice}
                disabled={isSaving || grandTotal <= 0}
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold uppercase tracking-wider text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                {isSaving ? (
                  "Processing Invoice…"
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">receipt</span>
                    Generate Invoice &amp; Save (₹{grandTotal.toLocaleString("en-IN")})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PRINTABLE INVOICE / RECEIPT MODAL ─── */}
      {invoiceModalOpen && generatedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex items-center justify-between border-b pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">
                  ✓ Invoice Generated
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* ─── PRINTABLE RECEIPT CONTENT ─── */}
            <div id="printable-receipt" className="space-y-6">
              {/* Receipt Header */}
              <div className="text-center pb-4 border-b border-dashed border-slate-300">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  URBAN TROUT AQUACULTURE
                </h2>
                <p className="text-xs text-slate-500 font-medium">Naseem Bagh / Malabagh, Srinagar, J&amp;K — 190006</p>
                <p className="text-xs text-slate-500 font-medium">Helpline: +91 84910 06127 | info.urbantrout@gmail.com</p>
                <p className="text-xs font-bold text-slate-800 mt-2">TAX INVOICE / CASH MEMO</p>
              </div>

              {/* Invoice Meta */}
              <div className="flex justify-between text-xs text-slate-600 font-mono">
                <div>
                  <p><strong>Invoice:</strong> {generatedInvoice.invoiceNumber}</p>
                  <p><strong>Customer:</strong> {generatedInvoice.customerName}</p>
                  <p><strong>Phone:</strong> {generatedInvoice.customerPhone}</p>
                </div>
                <div className="text-right">
                  <p><strong>Date:</strong> {generatedInvoice.date}</p>
                  <p><strong>Mode:</strong> {generatedInvoice.paymentMethod}</p>
                  <p><strong>Status:</strong> PAID ✓</p>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border-t border-b border-dashed border-slate-300 py-3">
                <table className="w-full text-xs text-left">
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
                <div className="flex justify-between text-base font-black text-slate-900 font-mono pt-2 border-t">
                  <span>GRAND TOTAL PAID:</span>
                  <span className="text-lg">₹{generatedInvoice.grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[11px] text-slate-500 leading-relaxed">
                <p className="font-semibold text-slate-700">Live RAS Tank Fresh Harvested</p>
                <p>Keep refrigerated at 0°C - 4°C. Consume within 48 hours for optimal taste.</p>
                <p className="font-mono text-[10px] mt-1">Thank you for visiting Urban Trout Farm!</p>
              </div>
            </div>

            {/* Action Buttons (Hidden in Print) */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print Invoice
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span className="material-symbols-outlined text-base">share</span>
                Send WhatsApp Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
