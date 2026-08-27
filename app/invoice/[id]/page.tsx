"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface DecodedInvoice {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ name: string; weightKg: number; pricePerKg: number; total: number }>;
  totalWeight: number;
  grandTotal: number;
  notes?: string;
  createdAt: number;
  isExpired: boolean;
  expiresInHours?: number;
}

export default function PublicInvoicePage() {
  const params = useParams();
  const rawParam = (params?.id as string) || "";
  const [invoice, setInvoice] = useState<DecodedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [upiId, setUpiId] = useState("urbantrout@ybl");
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    async function loadInvoice() {
      try {
        // 1. Fetch Store UPI ID
        const { data: upiData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "upi_id")
          .single();
        if (upiData?.value) setUpiId(upiData.value);

        // 2. PRIMARY: Read invoice data from URL ?d= query param (100% reliable, zero DB)
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get("d");
        if (encodedData) {
          try {
            const parsed = JSON.parse(decodeURIComponent(atob(encodedData)));
            const createdTimestamp = parsed.ts || Date.now();
            const elapsedMs = Date.now() - createdTimestamp;
            const maxAgeMs = 48 * 60 * 60 * 1000;
            const isExpired = elapsedMs > maxAgeMs;
            const remainingHours = Math.max(0, Math.ceil((maxAgeMs - elapsedMs) / (1000 * 60 * 60)));

            setInvoice({
              invoiceNumber: parsed.num || rawParam,
              customerName: parsed.name || "Valued Customer",
              customerPhone: parsed.phone || "N/A",
              items: (parsed.items || []).map((i: any) => ({
                name: i.n || i.name,
                weightKg: i.w ?? i.weightKg ?? 1,
                pricePerKg: i.r ?? i.pricePerKg ?? 550,
                total: i.t ?? i.total ?? 550,
              })),
              totalWeight: parsed.tw ?? parsed.totalWeight ?? 0,
              grandTotal: parsed.tot ?? parsed.grandTotal ?? 0,
              notes: parsed.notes || "",
              createdAt: createdTimestamp,
              isExpired,
              expiresInHours: remainingHours,
            });
            setLoading(false);
            return;
          } catch (e) {
            console.warn("Could not decode ?d= param:", e);
          }
        }

        // 3. FALLBACK: Fetch from /api/invoice server endpoint
        const cleanDigits = rawParam.replace(/\D/g, "");
        const res = await fetch(`/api/invoice?id=${encodeURIComponent(cleanDigits || rawParam)}`);
        
        if (res.ok) {
          const json = await res.json();
          if (json?.success && json.invoice) {
            const parsed = json.invoice;
            const createdTimestamp = parsed.ts || Date.now();
            const elapsedMs = Date.now() - createdTimestamp;
            const maxAgeMs = 48 * 60 * 60 * 1000; // 48 Hours
            const isExpired = elapsedMs > maxAgeMs;
            const remainingHours = Math.max(0, Math.ceil((maxAgeMs - elapsedMs) / (1000 * 60 * 60)));

            setInvoice({
              invoiceNumber: parsed.num || `UT-INV-${cleanDigits || rawParam}`,
              customerName: parsed.name || "Valued Customer",
              customerPhone: parsed.phone || "N/A",
              items: (parsed.items || []).map((i: any) => ({
                name: i.n || i.name,
                weightKg: i.w ?? i.weightKg ?? 1,
                pricePerKg: i.r ?? i.pricePerKg ?? 550,
                total: i.t ?? i.total ?? 550,
              })),
              totalWeight: parsed.tw ?? parsed.totalWeight ?? 0,
              grandTotal: parsed.tot ?? parsed.grandTotal ?? 0,
              notes: parsed.notes || "",
              createdAt: createdTimestamp,
              isExpired,
              expiresInHours: remainingHours,
            });
            setLoading(false);
            return;
          }
        }

        // 3. Fallback: Base64 decoding if legacy
        let decodedObj: any = null;
        try {
          const jsonStr = decodeURIComponent(atob(rawParam));
          decodedObj = JSON.parse(jsonStr);
        } catch {}

        if (decodedObj && (decodedObj.ts || decodedObj.tot)) {
          const createdTimestamp = decodedObj.ts || Date.now();
          const elapsedMs = Date.now() - createdTimestamp;
          const maxAgeMs = 48 * 60 * 60 * 1000;
          const isExpired = elapsedMs > maxAgeMs;
          const remainingHours = Math.max(0, Math.ceil((maxAgeMs - elapsedMs) / (1000 * 60 * 60)));

          setInvoice({
            invoiceNumber: decodedObj.num || "UT-INV-LIVE",
            customerName: decodedObj.name || "Valued Customer",
            customerPhone: decodedObj.phone || "N/A",
            items: (decodedObj.items || []).map((i: any) => ({
              name: i.n || i.name,
              weightKg: i.w ?? i.weightKg ?? 1,
              pricePerKg: i.r ?? i.pricePerKg ?? 550,
              total: i.t ?? i.total ?? 550,
            })),
            totalWeight: decodedObj.tw ?? decodedObj.totalWeight ?? 0,
            grandTotal: decodedObj.tot ?? decodedObj.grandTotal ?? 0,
            notes: decodedObj.notes || "",
            createdAt: createdTimestamp,
            isExpired,
            expiresInHours: remainingHours,
          });
          setLoading(false);
          return;
        }

        // 4. Fallback: Direct DB query for Online Store orders
        const numId = parseInt(cleanDigits, 10);
        let query = supabase.from("orders").select("*");
        if (!isNaN(numId)) {
          query = query.eq("order_number", numId);
        } else {
          query = query.eq("id", rawParam);
        }

        const { data: dbOrder } = await query.single();
        if (dbOrder) {
          const orderItems = Array.isArray(dbOrder.items) ? dbOrder.items : [];
          const tw = orderItems.reduce((s: number, i: any) => s + (parseFloat(i.quantity) || 0), 0);
          const orderCreated = new Date(dbOrder.created_at).getTime();

          setInvoice({
            invoiceNumber: `UT-INV-${dbOrder.order_number || dbOrder.id.slice(0, 6)}`,
            customerName: dbOrder.customer_name || "Valued Customer",
            customerPhone: dbOrder.customer_phone || "N/A",
            items: orderItems.map((i: any) => ({
              name: i.name,
              weightKg: parseFloat(i.quantity) || 1,
              pricePerKg: i.price || 550,
              total: (parseFloat(i.quantity) || 1) * (i.price || 550),
            })),
            totalWeight: tw,
            grandTotal: dbOrder.total || 0,
            createdAt: orderCreated,
            isExpired: false,
          });
        }
      } catch (err) {
        console.error("Invoice parse error:", err);
      } finally {
        setLoading(false);
      }
    }

    if (rawParam) loadInvoice();
  }, [rawParam]);

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4 text-center">
        <div className="space-y-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-cyan-400 text-sm font-semibold">Loading Invoice…</p>
        </div>
      </div>
    );
  }

  // EXPIRED INVOICE STATE (48-Hour Validity Period Ended)
  if (invoice?.isExpired) {
    return (
      <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-slate-900/90 border border-amber-500/30 rounded-3xl p-8 space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-3xl">timer_off</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Invoice Link Expired
            </h2>
            <p className="text-slate-400 text-xs leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
              This invoice link has exceeded its <strong>48-hour live validity period</strong>. To request a fresh invoice or order live-harvested trout, please contact our farm counter.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <a
              href="tel:+918491006127"
              className="py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all"
            >
              📞 Call Farm Helpline (+91 84910 06127)
            </a>
            <Link
              href="/"
              className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-700 transition-all"
            >
              Go to Homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 space-y-4 shadow-2xl">
          <span className="material-symbols-outlined text-4xl text-slate-500">receipt_long</span>
          <h2 className="text-xl font-bold text-white">Invoice Not Found</h2>
          <p className="text-slate-400 text-xs">
            We could not find an active invoice matching reference <code className="text-cyan-400">{rawParam}</code>.
          </p>
          <Link
            href="/"
            className="inline-block py-2.5 px-6 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const grandTotal = invoice.grandTotal;
  const upiPayUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Farm&am=${grandTotal}&cu=INR&tn=Invoice-${invoice.invoiceNumber}`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
    upiPayUri
  )}&bgcolor=255-255-255&color=2-13-18&margin=2`;

  return (
    <div className="min-h-screen bg-[#020d12] py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-5">
        {/* Top Controls (Hidden in Print) */}
        <div className="flex items-center justify-between print:hidden">
          <Link href="/" className="flex items-center gap-2">
            <img src="/headerfooterlogo.png" alt="Urban Trout" className="h-6 w-auto object-contain" />
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer active:scale-95"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Download PDF / Print
          </button>
        </div>

        {/* 48-Hour Timer Badge */}
        {invoice.expiresInHours !== undefined && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-amber-400 text-xs font-semibold print:hidden">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">timer</span>
              <span>48-Hour Live Invoice</span>
            </div>
            <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded text-[11px]">
              Expires in ~{invoice.expiresInHours} Hours
            </span>
          </div>
        )}

        {/* ─── PRINTABLE INVOICE CARD ─── */}
        <div
          id="printable-invoice"
          className="bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-200"
        >
          {/* Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-300">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              URBAN TROUT AQUACULTURE
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Naseem Bagh / Malabagh, Srinagar, J&amp;K — 190006</p>
            <p className="text-xs text-slate-500 font-medium">Helpline: +91 84910 06127 | info.urbantrout@gmail.com</p>
            <div className="inline-block mt-2 px-3 py-1 rounded bg-slate-100 text-slate-800 text-[10px] font-black uppercase tracking-widest">
              TAX INVOICE &amp; PAYMENT REQUEST
            </div>
          </div>

          {/* Metadata */}
          <div className="flex justify-between text-xs text-slate-600 font-mono">
            <div>
              <p><strong>Invoice No:</strong> {invoice.invoiceNumber}</p>
              <p><strong>Customer:</strong> {invoice.customerName}</p>
              <p><strong>Phone:</strong> {invoice.customerPhone}</p>
            </div>
            <div className="text-right">
              <p>
                <strong>Date:</strong>{" "}
                {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span className="text-amber-700 font-bold uppercase">PAYMENT DUE</span>
              </p>
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
                {invoice.items.map((item, idx) => (
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

          {/* Total Payable Summary */}
          <div className="space-y-1 text-right">
            {invoice.totalWeight > 0 && (
              <div className="flex justify-between text-xs text-slate-600 font-mono">
                <span>Total Harvest Weight:</span>
                <span className="font-bold">{invoice.totalWeight.toFixed(2)} Kg</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 font-mono pt-2 border-t">
              <span>TOTAL AMOUNT DUE:</span>
              <span className="text-xl text-slate-950">₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* ─── EMBEDDED UPI QR CODE ─── */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-2 bg-white border border-slate-300 rounded-2xl shadow-sm inline-block">
                <img src={upiQrCodeUrl} alt="Scan & Pay" className="w-36 h-36 object-contain" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Scan QR or Tap an App to Pay
              </p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs text-slate-600 font-mono font-bold">UPI ID: {upiId}</span>
                <button
                  type="button"
                  onClick={copyUpi}
                  className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold uppercase print:hidden cursor-pointer"
                >
                  {copiedUpi ? "Copied! ✓" : "Copy"}
                </button>
              </div>
            </div>

            {/* ─── ONE-TAP UPI APP BUTTONS ─── */}
            <div className="print:hidden space-y-2">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Tap to Open & Pay Directly
              </p>
              <div className="grid grid-cols-2 gap-2">
                {/* PhonePe */}
                <a
                  href={`phonepe://pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl border transition-all active:scale-95 cursor-pointer"
                  style={{ background: "#5f259f", borderColor: "#4a1a7a" }}
                >
                  {/* PhonePe Icon */}
                  <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
                    <rect width="64" height="64" rx="14" fill="#5f259f"/>
                    <path d="M32 8C18.7 8 8 18.7 8 32s10.7 24 24 24 24-10.7 24-24S45.3 8 32 8zm8.8 28.5c-1.3 2.5-3.6 4.1-6.4 4.6v3.7c0 .6-.5 1.1-1.1 1.1h-2.2c-.6 0-1.1-.5-1.1-1.1v-3.7c-4.5-.8-7.7-4.9-7.7-9.8V22.2c0-.6.5-1.1 1.1-1.1h2.2c.6 0 1.1.5 1.1 1.1v9.1c0 3.1 2.3 5.7 5.4 5.9 3.3.2 6-2.4 6-5.7v-9.3c0-.6.5-1.1 1.1-1.1h2.2c.6 0 1.1.5 1.1 1.1v9.3c0 1.9-.5 3.6-1.7 5z" fill="white"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-white font-bold text-xs">PhonePe</p>
                    <p className="text-purple-200 text-[10px]">₹{grandTotal.toLocaleString("en-IN")}</p>
                  </div>
                </a>

                {/* Google Pay */}
                <a
                  href={`tez://upi/pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl border transition-all active:scale-95 cursor-pointer"
                  style={{ background: "#1a73e8", borderColor: "#1558b0" }}
                >
                  {/* GPay Icon */}
                  <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
                    <rect width="64" height="64" rx="14" fill="white"/>
                    <text x="50%" y="56%" dominantBaseline="middle" textAnchor="middle" fontSize="28" fontWeight="bold" fontFamily="Arial">
                      <tspan fill="#4285F4">G</tspan>
                    </text>
                    <circle cx="43" cy="43" r="10" fill="#34A853"/>
                    <text x="43" y="47" dominantBaseline="middle" textAnchor="middle" fontSize="11" fontWeight="bold" fill="white">P</text>
                  </svg>
                  <div className="text-left">
                    <p className="text-white font-bold text-xs">Google Pay</p>
                    <p className="text-blue-200 text-[10px]">₹{grandTotal.toLocaleString("en-IN")}</p>
                  </div>
                </a>

                {/* Paytm */}
                <a
                  href={`paytmmp://pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl border transition-all active:scale-95 cursor-pointer"
                  style={{ background: "#00BAF2", borderColor: "#0096c4" }}
                >
                  {/* Paytm Icon */}
                  <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
                    <rect width="64" height="64" rx="14" fill="#00BAF2"/>
                    <rect x="12" y="24" width="40" height="8" rx="2" fill="white"/>
                    <rect x="12" y="36" width="28" height="8" rx="2" fill="white"/>
                  </svg>
                  <div className="text-left">
                    <p className="text-white font-bold text-xs">Paytm</p>
                    <p className="text-blue-100 text-[10px]">₹{grandTotal.toLocaleString("en-IN")}</p>
                  </div>
                </a>

                {/* BHIM UPI */}
                <a
                  href={`upi://pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl border transition-all active:scale-95 cursor-pointer"
                  style={{ background: "#FF6600", borderColor: "#cc5200" }}
                >
                  {/* BHIM Icon */}
                  <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
                    <rect width="64" height="64" rx="14" fill="#FF6600"/>
                    <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="18" fontWeight="900" fill="white" fontFamily="Arial">UPI</text>
                  </svg>
                  <div className="text-left">
                    <p className="text-white font-bold text-xs">BHIM / Any App</p>
                    <p className="text-orange-100 text-[10px]">₹{grandTotal.toLocaleString("en-IN")}</p>
                  </div>
                </a>
              </div>

              <p className="text-[10px] text-slate-400 text-center leading-tight mt-1">
                Tap a button above → your UPI app opens with the amount pre-filled
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-2 text-xs text-slate-500 leading-tight">
            <p className="font-semibold text-slate-700">Fresh Live RAS Tank Harvested Trout</p>
            <p className="mt-0.5">Keep chilled at 0°C - 4°C. Valid for 48 hours.</p>
            <p className="font-mono text-[10px] text-slate-400 mt-1">Thank you for supporting sustainable Kashmiri aquaculture!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
