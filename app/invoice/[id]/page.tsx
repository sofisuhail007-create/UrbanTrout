"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function PublicInvoicePage() {
  const params = useParams();
  const idParam = (params?.id as string) || "";
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upiId, setUpiId] = useState("urbantrout@ybl");
  const [copiedUpi, setCopiedUpi] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        // Fetch Store UPI ID
        const { data: upiData } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "upi_id")
          .single();
        if (upiData?.value) setUpiId(upiData.value);

        // Normalize ID (support "UT-INV-16", "16", or UUID)
        const cleanId = idParam.replace(/[^0-9a-fA-F-]/g, "");
        const numId = parseInt(cleanId, 10);

        let query = supabase.from("orders").select("*");
        if (!isNaN(numId) && !idParam.includes("-") && idParam.length < 8) {
          query = query.eq("order_number", numId);
        } else if (idParam.toUpperCase().startsWith("UT-INV-")) {
          const extractedNum = parseInt(idParam.replace("UT-INV-", ""), 10);
          if (!isNaN(extractedNum)) {
            query = query.eq("order_number", extractedNum);
          } else {
            query = query.eq("id", idParam);
          }
        } else {
          query = query.eq("id", idParam);
        }

        const { data, error } = await query.single();
        if (data) {
          setOrder(data);
        } else {
          // Try fetching by order_number if not found
          const parsed = parseInt(idParam.replace(/\D/g, ""), 10);
          if (!isNaN(parsed)) {
            const { data: fallbackData } = await supabase
              .from("orders")
              .select("*")
              .eq("order_number", parsed)
              .single();
            if (fallbackData) setOrder(fallbackData);
          }
        }
      } catch (err) {
        console.error("Error loading invoice:", err);
      } finally {
        setLoading(false);
      }
    }

    if (idParam) fetchOrder();
  }, [idParam]);

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const grandTotal = order?.total || 0;
  const upiPayUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Farm&am=${grandTotal}&cu=INR&tn=Invoice-${order?.order_number || idParam}`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    upiPayUri
  )}&bgcolor=255-255-255&color=2-13-18&margin=2`;

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

  if (!order) {
    return (
      <div className="min-h-screen bg-[#020d12] flex items-center justify-center p-4 text-center">
        <div className="max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 space-y-4">
          <span className="material-symbols-outlined text-4xl text-slate-500">receipt_long</span>
          <h2 className="text-xl font-bold text-white">Invoice Not Found</h2>
          <p className="text-slate-400 text-xs">
            We could not find an invoice matching reference <code className="text-cyan-400">{idParam}</code>.
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

  const items = Array.isArray(order.items) ? order.items : [];
  const totalWeight = items.reduce((sum: number, i: any) => sum + (parseFloat(i.quantity) || 0), 0);

  return (
    <div className="min-h-screen bg-[#020d12] py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Top Controls (Hidden in Print) */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <img src="/headerfooterlogo.png" alt="Urban Trout" className="h-6 w-auto object-contain" />
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">print</span>
            Download PDF / Print
          </button>
        </div>

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
              <p><strong>Invoice No:</strong> UT-INV-{order.order_number || order.id?.slice(0, 6)}</p>
              <p><strong>Customer:</strong> {order.customer_name || "Valued Customer"}</p>
              <p><strong>Phone:</strong> {order.customer_phone || "N/A"}</p>
            </div>
            <div className="text-right">
              <p>
                <strong>Date:</strong>{" "}
                {new Date(order.created_at || Date.now()).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span className="text-amber-700 font-bold uppercase">{order.status === "delivered" ? "COMPLETED" : "PAYMENT DUE"}</span>
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
                {items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2 pr-2 font-sans font-medium text-slate-800">{item.name}</td>
                    <td className="py-2 text-center font-bold">{item.quantity} {item.unit || "Kg"}</td>
                    <td className="py-2 text-right">₹{item.price}</td>
                    <td className="py-2 text-right font-bold">₹{((parseFloat(item.quantity) || 1) * (item.price || 0)).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total Payable Summary */}
          <div className="space-y-1 text-right">
            {totalWeight > 0 && (
              <div className="flex justify-between text-xs text-slate-600 font-mono">
                <span>Total Harvest Weight:</span>
                <span className="font-bold">{totalWeight.toFixed(2)} Kg</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 font-mono pt-2 border-t">
              <span>TOTAL AMOUNT DUE:</span>
              <span className="text-xl text-slate-950">₹{grandTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* ─── EMBEDDED UPI QR CODE ─── */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-2 bg-white border border-slate-300 rounded-2xl shadow-sm inline-block">
                <img src={upiQrCodeUrl} alt="Scan & Pay" className="w-32 h-32 sm:w-36 sm:h-36 object-contain" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Scan with Any UPI App (GPay / PhonePe / Paytm)
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
          </div>

          {/* Footer Note */}
          <div className="text-center pt-2 text-xs text-slate-500 leading-tight">
            <p className="font-semibold text-slate-700">Fresh Live RAS Tank Harvested Trout</p>
            <p className="mt-0.5">Keep chilled at 0°C - 4°C. Consume fresh within 48 hours.</p>
            <p className="font-mono text-[10px] text-slate-400 mt-1">Thank you for supporting sustainable Kashmiri aquaculture!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
