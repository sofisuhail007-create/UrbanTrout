"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import FourUpInvoiceSheet, { InvoiceSlipData } from "@/components/FourUpInvoiceSheet";
import { numberToIndianWords } from "@/lib/numberWords";

interface DecodedInvoice {
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  items: Array<{
    name: string;
    weightKg: number;
    orderedWeightKg?: number;
    pricePerKg: number;
    total: number;
    standardRate?: number;
    standardTotal?: number;
    discountAmount?: number;
  }>;
  orderedWeight?: number;
  totalWeight: number;
  subtotal?: number;
  deliveryFee?: number;
  grandTotal: number;
  standardTotal?: number;
  discountAmount?: number;
  paidAmount?: number;
  balanceAmount?: number;
  refundAmount?: number;
  balanceStatus?: string;
  notes?: string;
  createdAt: number;
  isExpired: boolean;
  expiresInHours?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentId?: string;
  qrImageUrl?: string;
  upiId?: string;
}

function mapInvoiceData(parsed: any, fallbackNum: string): DecodedInvoice {
  const createdTimestamp = parsed.ts || parsed.createdAt || Date.now();
  const elapsedMs = Date.now() - createdTimestamp;
  const isPaidOrSettled =
    parsed.paymentStatus === "PAID" ||
    parsed.balanceStatus === "settled" ||
    parsed.balanceStatus === "waived_final" ||
    (parsed.balanceAmount !== undefined && parsed.balanceAmount <= 0);
  const maxAgeMs = 48 * 60 * 60 * 1000;
  const isExpired = !isPaidOrSettled && elapsedMs > maxAgeMs;
  const remainingHours = Math.max(0, Math.ceil((maxAgeMs - elapsedMs) / (1000 * 60 * 60)));

  const grandTot = parsed.tot ?? parsed.grandTotal ?? 0;
  const paid = parsed.paidAmount !== undefined
    ? parsed.paidAmount
    : (parsed.balanceAmount !== undefined ? Math.max(0, grandTot - parsed.balanceAmount) : (isPaidOrSettled ? grandTot : undefined));
  const refund = parsed.refundAmount !== undefined
    ? parsed.refundAmount
    : (paid !== undefined && paid > grandTot ? paid - grandTot : 0);
  const balance = parsed.balanceAmount !== undefined
    ? parsed.balanceAmount
    : (paid !== undefined && grandTot > paid ? grandTot - paid : (isPaidOrSettled ? 0 : grandTot));

  return {
    invoiceNumber: parsed.num || parsed.invoiceNumber || fallbackNum,
    customerName: parsed.name || parsed.customerName || "Valued Customer",
    customerPhone: parsed.phone || parsed.customerPhone || "N/A",
    customerAddress: parsed.address || parsed.customerAddress || "",
    items: (parsed.items || []).map((i: any) => ({
      name: i.n || i.name || "Himalayan Rainbow Trout",
      weightKg: i.w ?? i.weightKg ?? 1,
      orderedWeightKg: i.ow ?? i.orderedWeightKg ?? (i.w ?? i.weightKg ?? 1),
      pricePerKg: i.r ?? i.pricePerKg ?? 550,
      total: i.t ?? i.total ?? 550,
      standardRate: i.standardRate,
      standardTotal: i.standardTotal,
      discountAmount: i.discountAmount,
    })),
    orderedWeight: parsed.ow ?? parsed.orderedWeight,
    totalWeight: parsed.tw ?? parsed.totalWeight ?? 0,
    subtotal: parsed.subtotal ?? (grandTot - (parsed.deliveryFee || 0)),
    deliveryFee: parsed.deliveryFee ?? 0,
    grandTotal: grandTot,
    standardTotal: parsed.standardTotal,
    discountAmount: parsed.discountAmount,
    paidAmount: paid,
    balanceAmount: balance,
    refundAmount: refund,
    balanceStatus: parsed.balanceStatus || (balance > 0 ? "pending" : undefined),
    notes: parsed.notes || "",
    createdAt: createdTimestamp,
    isExpired,
    expiresInHours: remainingHours,
    paymentStatus: parsed.paymentStatus || (refund > 0 ? "REFUND DUE" : (isPaidOrSettled ? "PAID" : "PAYMENT DUE")),
    paymentMethod: parsed.paymentMethod || "UPI",
    paymentId: parsed.paymentId || undefined,
    qrImageUrl: parsed.qrImageUrl || undefined,
    upiId: parsed.upiId || parsed.jkBankDetails?.upiId,
  };
}

export default function PublicInvoicePage() {
  const params = useParams();
  const rawParam = (params?.id as string) || "";
  const [invoice, setInvoice] = useState<DecodedInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [upiId, setUpiId] = useState("JKBMERC00828895@jkb");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [viewMode, setViewMode] = useState<"standard" | "4up">("standard");
  const autoPrintedRef = useRef(false);

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

        // Check if 4-up mode is requested via URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("format") === "4up" || urlParams.get("mode") === "4up") {
          setViewMode("4up");
        }

        // 2. PRIMARY: Read invoice data from URL ?d= query param (100% reliable, zero DB)
        const encodedData = urlParams.get("d");
        if (encodedData) {
          try {
            const parsed = JSON.parse(decodeURIComponent(atob(encodedData)));
            setInvoice(mapInvoiceData(parsed, rawParam));
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
            setInvoice(mapInvoiceData(json.invoice, `UT-INV-${cleanDigits || rawParam}`));
            setLoading(false);
            return;
          }
        }

        // 3b. Direct Supabase invoices table query fallback
        try {
          const { data: dbRow } = await supabase
            .from("invoices")
            .select("data")
            .or(`id.eq.${cleanDigits || rawParam},id.eq.${rawParam}`)
            .maybeSingle();

          if (dbRow?.data) {
            const parsed = typeof dbRow.data === "object" ? dbRow.data : JSON.parse(dbRow.data);
            setInvoice(mapInvoiceData(parsed, `UT-INV-${cleanDigits || rawParam}`));
            setLoading(false);
            return;
          }
        } catch (dbErr) {
          console.warn("Direct Supabase invoice lookup error:", dbErr);
        }

        // 3c. Fallback: Base64 decoding if legacy
        let decodedObj: any = null;
        try {
          const jsonStr = decodeURIComponent(atob(rawParam));
          decodedObj = JSON.parse(jsonStr);
        } catch {}

        if (decodedObj && (decodedObj.ts || decodedObj.tot)) {
          setInvoice(mapInvoiceData(decodedObj, "UT-INV-LIVE"));
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
          let totalOrdWeight = 0;
          let totalActWeight = 0;
          const mappedItems = orderItems.map((i: any) => {
            const ordQty = typeof i.orderedWeight === "number" ? i.orderedWeight : (typeof i.orderedWeightKg === "number" ? i.orderedWeightKg : parseFloat(i.quantity) || 1);
            const actQty = typeof i.actualWeight === "number" ? i.actualWeight : (typeof i.weightKg === "number" ? i.weightKg : parseFloat(i.quantity) || 1);
            const rate = typeof i.price === "number" ? i.price : parseFloat(i.price) || 580;
            totalOrdWeight += ordQty;
            totalActWeight += actQty;
            return {
              name: i.name || "Fresh Rainbow Trout",
              weightKg: actQty,
              orderedWeightKg: ordQty,
              pricePerKg: rate,
              total: actQty * rate,
            };
          });

          const isPaid = dbOrder.status === "processing" || dbOrder.status === "out_for_delivery" || dbOrder.status === "delivered";
          const grandTotal = Number(dbOrder.total) || 0;
          const paidAmount = dbOrder.paid_amount !== undefined
            ? Number(dbOrder.paid_amount)
            : ((orderItems[0] as any)?.paidAmount !== undefined
                ? Number((orderItems[0] as any).paidAmount)
                : ((orderItems[0] as any)?.originalTotal !== undefined
                    ? Number((orderItems[0] as any).originalTotal)
                    : (isPaid ? grandTotal : 0)));
          const refundAmount = paidAmount > grandTotal ? paidAmount - grandTotal : 0;
          const balanceAmount = grandTotal > paidAmount ? grandTotal - paidAmount : (isPaid ? 0 : grandTotal);
          const orderCreated = new Date(dbOrder.created_at).getTime();

          setInvoice({
            invoiceNumber: `UT-INV-${dbOrder.order_number || dbOrder.id.slice(0, 6)}`,
            customerName: dbOrder.customer_name || "Valued Customer",
            customerPhone: dbOrder.customer_phone || "N/A",
            customerAddress: dbOrder.shipping_address || dbOrder.address || "",
            items: mappedItems,
            orderedWeight: totalOrdWeight > 0 ? totalOrdWeight : totalActWeight,
            totalWeight: totalActWeight,
            subtotal: grandTotal,
            deliveryFee: 0,
            grandTotal,
            paidAmount,
            balanceAmount,
            refundAmount,
            createdAt: orderCreated,
            isExpired: false,
            paymentStatus: isPaid ? (refundAmount > 0 ? "REFUND DUE" : "PAID") : "PAYMENT DUE",
            paymentMethod: isPaid ? "Online / Advance" : "Cash on Delivery",
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

  // Handle auto-print if ?autoprint=true or ?pdf=true in URL
  useEffect(() => {
    if (!loading && invoice && !autoPrintedRef.current) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("autoprint") === "true" || urlParams.get("pdf") === "true") {
        autoPrintedRef.current = true;
        const timer = setTimeout(() => {
          window.print();
        }, 600);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, invoice]);

  const copyUpi = () => {
    const activeUpi = invoice?.upiId || upiId;
    navigator.clipboard.writeText(activeUpi);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const copyInvoiceLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleShareWhatsApp = () => {
    if (!invoice) return;
    const cleanPhone = invoice.customerPhone.replace(/\D/g, "").slice(-10);
    const origin = typeof window !== "undefined" ? window.location.origin : "https://urbantrout.in";
    const invoiceUrl = `${origin}/invoice/${invoice.invoiceNumber}`;

    const text = `*URBAN TROUT AQUACULTURE* — Official Tax Invoice\n` +
      `Invoice No: *#${invoice.invoiceNumber}*\n` +
      `Customer: ${invoice.customerName}\n` +
      `Total Weight: ${invoice.totalWeight.toFixed(2)} Kg\n` +
      `Total Bill: *₹${invoice.grandTotal.toLocaleString("en-IN")}*\n` +
      `Status: *${invoice.paymentStatus || "PAYMENT DUE"}*\n\n` +
      `*View & Download Invoice:* ${invoiceUrl}\n\n` +
      `Urban Trout Farm Helpline: +91 84910 06127`;

    const url = cleanPhone.length === 10
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4 text-center">
        <div className="space-y-3">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent animate-spin rounded-full mx-auto" />
          <p className="text-cyan-400 text-sm font-semibold">Loading Tax Invoice…</p>
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
              This invoice link has exceeded its <strong>48-hour validity period</strong>. To request a fresh invoice or order farm-fresh trout, please contact our farm counter.
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
  const remainingAmount = (invoice.balanceAmount !== undefined && invoice.balanceAmount > 0)
    ? invoice.balanceAmount
    : (invoice.paidAmount !== undefined ? Math.max(0, grandTotal - invoice.paidAmount) : grandTotal);

  const activeUpiId = invoice.upiId || upiId;
  const terminalId = activeUpiId.includes("@")
    ? `TERM${activeUpiId.split("@")[0].replace(/^JKBMERC/, "")}`
    : "TERM00828895";
  const upiPayUri = `upi://pay?pa=${activeUpiId}&pn=Urban%20Trout%20Aquaculture&tr=${terminalId}&am=${remainingAmount}&cu=INR&tn=Invoice-${invoice.invoiceNumber}`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    upiPayUri
  )}&bgcolor=255-255-255&color=2-13-18&margin=2`;

  // 4-in-1 Sheet Mode (Canon MF244dw Laser Printer Optimized)
  if (viewMode === "4up") {
    return (
      <div className="min-h-screen bg-[#020d12] py-6 px-3 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between print:hidden">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/headerfooterlogo.png" alt="Urban Trout" className="h-6 w-auto object-contain" />
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("standard")}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                ← Full Page A4 View
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-base">print</span>
                Print A4 Sheet (4 Slips)
              </button>
            </div>
          </div>

          <FourUpInvoiceSheet
            invoices={[
              {
                invoiceNumber: invoice.invoiceNumber,
                customerName: invoice.customerName,
                customerPhone: invoice.customerPhone,
                customerAddress: invoice.customerAddress,
                createdAt: invoice.createdAt,
                items: invoice.items,
                orderedWeight: invoice.orderedWeight,
                totalWeight: invoice.totalWeight,
                subtotal: invoice.subtotal,
                deliveryFee: invoice.deliveryFee,
                grandTotal: invoice.grandTotal,
                paidAmount: invoice.paidAmount,
                balanceAmount: invoice.balanceAmount,
                refundAmount: invoice.refundAmount,
                paymentStatus: invoice.paymentStatus,
                paymentMethod: invoice.paymentMethod,
                paymentId: invoice.paymentId,
                notes: invoice.notes,
                upiId: activeUpiId,
                qrImageUrl: invoice.qrImageUrl,
              },
            ]}
            repeatSingle={true}
            onClose={() => setViewMode("standard")}
            showControls={false}
          />
        </div>
      </div>
    );
  }

  // ─── STANDARD EXECUTIVE A4 TAX INVOICE VIEW ───
  return (
    <div className="invoice-page-wrapper min-h-screen bg-[#020d12] py-6 px-3 sm:px-6">
      <div className="invoice-max-width max-w-3xl mx-auto space-y-4">
        {/* Top Controls Toolbar (Hidden in Print) */}
        <div className="flex items-center justify-between print:hidden gap-2 flex-wrap bg-slate-900/90 border border-slate-800 p-3 rounded-2xl shadow-xl">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/headerfooterlogo.png" alt="Urban Trout" className="h-7 w-auto object-contain" />
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2 px-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Share Invoice Link on WhatsApp"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={copyInvoiceLink}
              className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
              title="Copy Invoice Link"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              <span>{copiedLink ? "Copied! ✓" : "Copy Link"}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 cursor-pointer active:scale-95 transition-all"
              title="Download or Print Invoice PDF"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              <span>Download Invoice PDF</span>
            </button>
          </div>
        </div>

        {/* 48-Hour Timer Badge (Hidden in Print) */}
        {invoice.expiresInHours !== undefined && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-amber-400 text-xs font-semibold print:hidden">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">timer</span>
              <span>Live Tax Invoice &amp; Payment Desk</span>
            </div>
            <span className="font-mono bg-amber-500/20 px-2 py-0.5 rounded text-[11px]">
              Expires in ~{invoice.expiresInHours} Hours
            </span>
          </div>
        )}

        {/* ─── PRINTABLE A4 INVOICE SHEET ─── */}
        <div
          id="printable-invoice"
          className="bg-white text-slate-950 rounded-2xl p-6 sm:p-9 shadow-2xl border border-slate-200 font-sans space-y-5"
        >
          {/* 1. Official Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/headerfooterlogo.png"
                alt="Urban Trout Aquaculture"
                className="h-10 w-auto object-contain shrink-0"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-none" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  URBAN TROUT AQUACULTURE
                </h1>
                <p className="text-[11px] text-slate-600 font-semibold tracking-wide uppercase mt-1">
                  High-Altitude Mountain Spring RAS Facility · Srinagar, Kashmir
                </p>
                <p className="text-[10.5px] text-slate-500 font-mono mt-0.5">
                  Malabagh / Naseem Bagh, Srinagar, J&amp;K — 190006 · Helpline: +91 84910 06127
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <div className="inline-block px-3 py-1 rounded-md bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                TAX INVOICE
              </div>
              <p className="text-[11px] font-mono font-bold text-slate-700 mt-1">
                GSTIN: <span className="font-normal text-slate-600">Exempt (0% Farm Produce)</span>
              </p>
              <p className="text-[10px] text-slate-600 font-mono">
                State: <strong>Jammu &amp; Kashmir (Code: 01)</strong>
              </p>
              <p className="text-[10px] text-slate-500 font-mono">Original for Recipient</p>
            </div>
          </div>

          {/* 2. Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono print-avoid-break">
            {/* Customer Details Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-sans">
                BILLED TO / CUSTOMER
              </span>
              <p className="text-sm font-bold text-slate-900 font-sans">
                {invoice.customerName}
              </p>
              <p className="text-slate-700">
                <strong>Phone:</strong> {invoice.customerPhone ? `+91 ${invoice.customerPhone}` : "N/A"}
              </p>
              {invoice.customerAddress && (
                <p className="text-slate-600 leading-snug pt-0.5">
                  <strong>Delivery:</strong> {invoice.customerAddress}
                </p>
              )}
            </div>

            {/* Invoice & Status Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-sans">
                INVOICE &amp; PAYMENT DETAILS
              </span>
              <div className="flex justify-between">
                <span className="text-slate-600">Invoice Number:</span>
                <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Date &amp; Time:</span>
                <span className="font-semibold text-slate-800">
                  {new Date(invoice.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Place of Supply:</span>
                <span className="font-semibold text-slate-800">Jammu &amp; Kashmir (01)</span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-slate-600">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded font-black text-[10.5px] uppercase tracking-wide ${
                    invoice.paymentStatus === "PAID"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : invoice.refundAmount && invoice.refundAmount > 0
                      ? "bg-blue-100 text-blue-800 border border-blue-300"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  {invoice.paymentStatus || "PAYMENT DUE"}
                </span>
              </div>
              {invoice.paymentMethod && (
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Method:</span>
                  <span className="font-semibold">{invoice.paymentMethod}</span>
                </div>
              )}
              {invoice.paymentId && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Txn Ref:</span>
                  <span className="font-mono truncate max-w-[150px]">{invoice.paymentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Itemized Harvest Table */}
          <div className="border border-slate-300 rounded-xl overflow-hidden print-avoid-break">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-2.5 text-center">HSN/SAC</th>
                  <th className="py-2.5 px-3 text-center">Harvest Weight</th>
                  <th className="py-2.5 px-3 text-right">Rate / Kg</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {invoice.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-500 font-sans">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {item.orderedWeightKg && Math.abs(item.orderedWeightKg - item.weightKg) > 0.02 && (
                        <div className="text-[10.5px] text-slate-500 font-mono">
                          Ordered on WhatsApp: {item.orderedWeightKg.toFixed(2)} Kg
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-slate-600 font-mono text-[11px]">
                      03021100
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                      {item.weightKg.toFixed(2)} Kg
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-800">
                      ₹{item.pricePerKg.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-950">
                      ₹{item.total.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 4. Accounting & Financial Reconciliation Summary */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-1 print-avoid-break">
            {/* Left: Notes / Delivery Instructions */}
            <div className="text-xs text-slate-600 max-w-sm space-y-1">
              {invoice.notes && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800 font-sans block text-[11px]">Note / Memo:</span>
                  <p className="font-mono text-slate-700 mt-0.5">{invoice.notes}</p>
                </div>
              )}
              <p className="text-[11px] text-slate-500 leading-tight">
                * Live harvest pricing is calculated strictly against actual calibrated precision scale weight.
              </p>
            </div>

            {/* Right: Numbers Summary */}
            <div className="w-full sm:w-72 space-y-1.5 font-mono text-xs text-right">
              {invoice.totalWeight > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Total Harvest Weight:</span>
                  <span className="font-bold text-slate-900">{invoice.totalWeight.toFixed(2)} Kg</span>
                </div>
              )}

              {invoice.subtotal !== undefined && invoice.deliveryFee !== undefined && invoice.deliveryFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Harvest Subtotal:</span>
                  <span>₹{invoice.subtotal.toLocaleString("en-IN")}</span>
                </div>
              )}

              {invoice.deliveryFee !== undefined && invoice.deliveryFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Delivery Charges:</span>
                  <span>₹{invoice.deliveryFee.toLocaleString("en-IN")}</span>
                </div>
              )}

              {invoice.discountAmount !== undefined && invoice.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Special Deal Discount:</span>
                  <span>-₹{invoice.discountAmount.toLocaleString("en-IN")}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-black text-slate-950 pt-2 border-t-2 border-slate-900">
                <span>TOTAL PAYABLE:</span>
                <span className="text-xl">₹{grandTotal.toLocaleString("en-IN")}</span>
              </div>

              {/* Advance & Balance / Refund Outcome */}
              {invoice.refundAmount !== undefined && invoice.refundAmount > 0 ? (
                <div className="space-y-1 pt-2 text-left">
                  <div className="flex justify-between text-xs text-slate-600 font-mono">
                    <span>Advance Received:</span>
                    <span>₹{invoice.paidAmount?.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-black">
                    <div className="flex justify-between text-sm">
                      <span>💵 CASH REFUND DUE:</span>
                      <span>₹{invoice.refundAmount.toLocaleString("en-IN")}</span>
                    </div>
                    <p className="text-[10.5px] font-sans font-medium text-emerald-800 mt-1 leading-tight">
                      Rider Handover Note: Delivery executive will return ₹{invoice.refundAmount} in cash or UPI at your doorstep.
                    </p>
                  </div>
                </div>
              ) : invoice.paidAmount !== undefined && invoice.paidAmount < grandTotal ? (
                <div className="space-y-1 pt-2 text-left">
                  <div className="flex justify-between text-xs text-slate-600 font-mono">
                    <span>Amount Paid / Advance:</span>
                    <span>₹{invoice.paidAmount.toLocaleString("en-IN")}</span>
                  </div>
                  {invoice.balanceAmount && invoice.balanceAmount > 0 ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-950 font-black">
                      <div className="flex justify-between text-sm">
                        <span>⚠️ REMAINING BALANCE:</span>
                        <span>₹{invoice.balanceAmount.toLocaleString("en-IN")}</span>
                      </div>
                      <p className="text-[10.5px] font-sans font-medium text-amber-800 mt-1 leading-tight">
                        Please scan the UPI QR code below or pay cash upon handover.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-center font-bold text-xs">
                      ✓ Settled as Agreed Final Payment (Nil Balance)
                    </div>
                  )}
                </div>
              ) : invoice.paymentStatus === "PAID" ? (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-center font-black text-xs pt-1">
                  ✓ VERIFIED PAID IN FULL (₹{grandTotal.toLocaleString("en-IN")})
                </div>
              ) : null}
            </div>
          </div>

          {/* 4b. Amount Chargeable in Words & Statutory GST Schedule Analysis */}
          <div className="space-y-2.5 print-avoid-break">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              <span className="text-slate-500 uppercase tracking-wider text-[10px] block font-sans font-bold">
                Amount Chargeable (in words):
              </span>
              <span className="font-bold text-slate-900 text-xs">
                INR {numberToIndianWords(grandTotal)}
              </span>
            </div>

            {/* GST Tax Breakdown Table (Standard Aquaculture Exemption Box) */}
            <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-1 font-bold text-slate-800 text-[10.5px] uppercase tracking-wider">
                <span>Tax Breakdown &amp; GST Exemption (Chapter 3)</span>
                <span className="text-[10px] text-slate-600 font-mono normal-case">
                  Place of Supply: <strong>Jammu &amp; Kashmir (State Code: 01)</strong>
                </span>
              </div>
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase">
                  <tr>
                    <th className="py-1.5 px-3">HSN/SAC</th>
                    <th className="py-1.5 px-3 text-right">Taxable Value</th>
                    <th className="py-1.5 px-3 text-center">CGST (0%)</th>
                    <th className="py-1.5 px-3 text-center">SGST (0%)</th>
                    <th className="py-1.5 px-3 text-right">Total Tax Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-900">03021100</td>
                    <td className="py-2 px-3 text-right">₹{grandTotal.toLocaleString("en-IN")}</td>
                    <td className="py-2 px-3 text-center">₹0.00</td>
                    <td className="py-2 px-3 text-center">₹0.00</td>
                    <td className="py-2 px-3 text-right font-black text-emerald-800">NIL</td>
                  </tr>
                </tbody>
              </table>
              <div className="bg-slate-50/90 px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-600 font-mono flex flex-wrap items-center justify-between gap-2">
                <span>Tax Amount (in words): <strong>INR NIL</strong></span>
                <span className="italic text-slate-500">
                  * Exempt commodity under GST Notification No. 2/2017-Central Tax (Rate), Chapter 3 (Live, fresh, or chilled fish).
                </span>
              </div>
            </div>
          </div>

          {/* 5. Payment QR Code & Settlement (Print-Friendly) */}
          {invoice.paymentStatus !== "PAID" && (!invoice.refundAmount || invoice.refundAmount === 0) && remainingAmount > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 print-avoid-break flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 sm:w-36 sm:h-36 bg-white border border-slate-300 rounded-xl p-1 shrink-0 flex items-center justify-center shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={invoice.qrImageUrl || upiQrCodeUrl}
                    alt="Scan UPI QR to Pay"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="space-y-1">
                  <div className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
                    Instant Bank Settlement
                  </div>
                  <h3 className="text-sm font-black text-slate-900">
                    Scan with any UPI App to Pay
                  </h3>
                  <p className="text-xs font-mono font-bold text-slate-700">
                    Amount: ₹{remainingAmount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5">
                    <span>UPI ID: {activeUpiId}</span>
                    <button
                      type="button"
                      onClick={copyUpi}
                      className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold print:hidden cursor-pointer"
                    >
                      {copiedUpi ? "Copied! ✓" : "Copy"}
                    </button>
                  </p>
                  <p className="text-[10px] text-slate-500 font-sans">
                    Supports Google Pay, PhonePe, Paytm, BHIM, and J&amp;K Bank mPay.
                  </p>
                </div>
              </div>

              {/* 1-Tap UPI App Buttons (Hidden in Print) */}
              <div className="print:hidden w-full sm:w-auto shrink-0 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center sm:text-left">
                  1-Tap Pay on Phone:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <a
                    href={`phonepe://pay?pa=${activeUpiId}&pn=Urban%20Trout&am=${remainingAmount.toFixed(2)}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#5f259f] hover:bg-[#4d1e82] text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <span>PhonePe</span>
                  </a>
                  <a
                    href={`tez://upi/pay?pa=${activeUpiId}&pn=Urban%20Trout&am=${remainingAmount.toFixed(2)}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1558b0] text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <span>Google Pay</span>
                  </a>
                  <a
                    href={`paytmmp://pay?pa=${activeUpiId}&pn=Urban%20Trout&am=${remainingAmount.toFixed(2)}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#00BAF2] hover:bg-[#0096c4] text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <span>Paytm</span>
                  </a>
                  <a
                    href={`upi://pay?pa=${activeUpiId}&pn=Urban%20Trout&am=${remainingAmount.toFixed(2)}&cu=INR&tn=Invoice%20${invoice.invoiceNumber}`}
                    className="px-2.5 py-1.5 rounded-lg bg-[#FF6600] hover:bg-[#cc5200] text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <span>BHIM / All</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 6. Regulatory Disclosures: Visceral Loss Notice & Care Tips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] leading-relaxed print-avoid-break">
            {/* Visceral Loss Notice */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                <span>⚖️</span>
                <span>Net Weight &amp; Visceral Loss Disclosure</span>
              </div>
              <p className="text-slate-600 text-[10.5px]">
                Live trout is weighed whole at harvest. During hygienic gutting, gills and entrails are carefully removed, resulting in a standard natural loss of <strong>12% to 18%</strong> in weight. You receive 100% wholesome, clean, ready-to-cook mountain trout!
              </p>
            </div>

            {/* Culinary Care */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1">
                <span>🐟</span>
                <span>Culinary &amp; Freshness Care</span>
              </div>
              <p className="text-slate-600 text-[10.5px]">
                Keep refrigerated (0°C–4°C) and best cooked fresh within 24–48 hours. Rinse gently in cold water. Trout cooks quickly (6–8 mins gentle heat) to preserve natural mountain sweetness and rich omega-3 oils.
              </p>
            </div>
          </div>

          {/* 6b. Statutory Declaration & Authorized Signatory Block (Commercial Standard) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 print-avoid-break">
            {/* Left: Bank Account Details */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-sans">
                BANK DETAILS (FOR RTGS / NEFT / IMPS)
              </span>
              <div className="flex justify-between text-slate-700">
                <span>Bank:</span>
                <strong className="text-slate-900">The Jammu &amp; Kashmir Bank Ltd</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Branch:</span>
                <span className="text-slate-900">Malabagh, Srinagar</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>A/C Name:</span>
                <span className="text-slate-900">Urban Trout Aquaculture</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>IFSC Code:</span>
                <strong className="font-bold text-slate-900">JAKA0MALBAG</strong>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>UPI ID:</span>
                <strong className="text-cyan-700 font-bold">{activeUpiId}</strong>
              </div>
            </div>

            {/* Right: Statutory Declaration & Signatory Seal */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between text-[11px] font-mono space-y-2">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block font-sans">
                  DECLARATION
                </span>
                <p className="text-slate-600 text-[10px] italic leading-tight mt-1 font-sans">
                  &ldquo;We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.&rdquo;
                </p>
              </div>

              <div className="text-right pt-2 border-t border-slate-200 flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block font-sans">
                  for URBAN TROUT AQUACULTURE
                </span>
                <div className="relative my-0.5 flex justify-end">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/urban-trout-seal.png"
                    alt="Urban Trout Aquaculture Authorized Signatory Seal"
                    className="w-24 h-24 sm:w-28 sm:h-28 object-contain -my-3 opacity-95 mix-blend-multiply pointer-events-none select-none"
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-mono border-t border-slate-400 pt-0.5 inline-block">
                  Authorized Signatory
                </span>
              </div>
            </div>
          </div>

          {/* 7. Sign-off & Support Footer */}
          <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left text-[10.5px] text-slate-500 font-mono print-avoid-break">
            <div>
              <p className="font-bold text-slate-700 font-sans">Thank you for supporting sustainable Kashmiri aquaculture!</p>
              <p>For inquiries, bulk orders, or chef support: +91 84910 06127 · info.urbantrout@gmail.com</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-slate-800">Urban Trout Aquaculture</p>
              <p className="text-[10px] text-slate-400">Computer Generated Official Tax Invoice</p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Print Media CSS injection for Executive A4 Portrait Output */}
      <style jsx global>{`
        @media print {
          html,
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: A4 portrait !important;
            margin: 8mm 10mm !important;
          }

          /* Hide all chrome and navigational elements */
          header,
          footer,
          nav,
          aside,
          .print\\:hidden,
          #header,
          #footer {
            display: none !important;
          }

          .invoice-page-wrapper {
            background-color: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            width: 100% !important;
          }

          .invoice-max-width {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #printable-invoice {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            color: #000000 !important;
          }

          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
