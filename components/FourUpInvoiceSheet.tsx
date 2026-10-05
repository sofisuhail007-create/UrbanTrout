"use client";

import React, { useState } from "react";

export interface InvoiceSlipData {
  invoiceNumber: string;
  orderNumber?: string | number;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerLocality?: string;
  createdAt?: number | string;
  items: Array<{
    name: string;
    weightKg?: number;
    orderedWeightKg?: number;
    quantity?: number;
    unit?: string;
    pricePerKg?: number;
    price?: number;
    total: number;
  }>;
  orderedWeight?: number;
  totalWeight?: number;
  subtotal?: number;
  deliveryFee?: number;
  grandTotal: number;
  paidAmount?: number;
  balanceAmount?: number;
  refundAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  paymentId?: string;
  notes?: string;
  upiId?: string;
  qrImageUrl?: string;
}

interface FourUpInvoiceSheetProps {
  invoices: InvoiceSlipData[];
  repeatSingle?: boolean;
  onClose?: () => void;
  showControls?: boolean;
}

/**
 * Single Quarter-A4 Invoice Slip Component
 * Formatted to fit inside ~100mm x 142mm (A6 size) with crisp monochrome laser typography.
 */
function SingleInvoiceSlip({
  data,
  isRightCol,
  isBottomRow,
  copyLabel,
}: {
  data: InvoiceSlipData;
  isRightCol: boolean;
  isBottomRow: boolean;
  copyLabel?: string;
}) {
  const orderedWeight = data.orderedWeight || 0;
  const actualWeight = data.totalWeight || 0;
  const hasWeightVariance = orderedWeight > 0 && actualWeight > 0 && Math.abs(orderedWeight - actualWeight) >= 0.02;

  const paidAmount = data.paidAmount !== undefined ? data.paidAmount : (data.paymentStatus === "PAID" ? data.grandTotal : 0);
  const refundAmount = data.refundAmount !== undefined ? data.refundAmount : (paidAmount > data.grandTotal ? paidAmount - data.grandTotal : 0);
  const remainingAmount = data.balanceAmount !== undefined ? data.balanceAmount : (data.grandTotal > paidAmount ? data.grandTotal - paidAmount : (data.paymentStatus === "PAID" ? 0 : data.grandTotal));
  const isPaid = (data.paymentStatus === "PAID" || paidAmount >= data.grandTotal) && refundAmount <= 0;

  const cleanPhone = String(data.customerPhone || "").replace(/\D/g, "").slice(-10);
  const upi = data.upiId || "JKBMERC00828895@jkb";

  const terminalId = upi.includes("@")
    ? `TERM${upi.split("@")[0].replace(/^JKBMERC/, "")}`
    : "TERM00828895";
  const upiPayUri = `upi://pay?pa=${upi}&pn=Urban%20Trout%20Aquaculture&tr=${terminalId}&am=${remainingAmount.toFixed(2)}&cu=INR&tn=Inv-${data.invoiceNumber || data.orderNumber}`;
  const qrUrl = data.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiPayUri)}&bgcolor=255-255-255&color=0-0-0&margin=1`;

  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

  const timeStr = data.createdAt
    ? new Date(data.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  return (
    <div
      className={`relative p-2.5 sm:p-3 flex flex-col justify-between bg-white text-black font-sans box-border overflow-hidden ${
        !isRightCol ? "border-r border-dashed border-slate-400" : ""
      } ${!isBottomRow ? "border-b border-dashed border-slate-400" : ""}`}
      style={{
        height: "100%",
        maxHeight: "142mm",
        width: "100%",
        color: "#000000",
        backgroundColor: "#ffffff",
      }}
    >
      {/* ─── 1. COMPACT HEADER ─── */}
      <div className="border-b border-black pb-1 mb-1">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[12px] font-black tracking-tight leading-none text-black">
              URBAN TROUT AQUACULTURE
            </h1>
            <p className="text-[8px] text-slate-700 font-medium leading-tight mt-0.5">
              Fresh Live RAS Trout Farm • Malabagh, Srinagar
            </p>
            <p className="text-[7.5px] text-slate-600 font-mono leading-tight">
              Helpline / WhatsApp: +91 84910 06127 / +91 70066 04148
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block border border-black px-1.5 py-0.2 rounded text-[7px] font-black uppercase tracking-wider bg-slate-100">
              {copyLabel || "TAX INVOICE / DELIVERY SLIP"}
            </span>
            <p className="text-[8px] font-mono font-bold mt-0.5">
              #{data.invoiceNumber || data.orderNumber}
            </p>
          </div>
        </div>
      </div>

      {/* ─── 2. CUSTOMER & ORDER META (2 COLUMNS) ─── */}
      <div className="grid grid-cols-2 gap-1 text-[8px] leading-tight pb-1 mb-1 border-b border-dotted border-slate-300">
        <div>
          <p className="truncate">
            <strong className="text-black">Customer:</strong> {data.customerName || "Valued Customer"}
          </p>
          <p className="font-mono">
            <strong className="text-black">Phone:</strong> {cleanPhone ? `+91 ${cleanPhone}` : "N/A"}
          </p>
          <p className="truncate">
            <strong className="text-black">Delivery:</strong> {data.customerLocality || data.customerAddress || "Srinagar"}
          </p>
        </div>
        <div className="text-right font-mono">
          <p>
            <strong className="text-black">Date:</strong> {dateStr} {timeStr}
          </p>
          <p>
            <strong className="text-black">Status:</strong>{" "}
            {refundAmount > 0 ? (
              <span className="font-bold border border-black px-1 bg-slate-200 text-black">
                REFUND DUE (₹{refundAmount})
              </span>
            ) : isPaid ? (
              <span className="font-bold underline text-black">PAID IN FULL ✓</span>
            ) : (
              <span className="font-bold border border-black px-1 bg-slate-100 text-black">
                PAYMENT DUE (₹{remainingAmount})
              </span>
            )}
          </p>
          {data.paymentId && (
            <p className="text-[7px] text-slate-600 truncate">Ref: {data.paymentId}</p>
          )}
        </div>
      </div>

      {/* ─── 3. ITEMIZED ORDER TABLE ─── */}
      <div className="mb-1">
        <table className="w-full text-[8px] leading-tight">
          <thead>
            <tr className="border-b border-black text-slate-800 font-bold">
              <th className="text-left py-0.5">Item Description</th>
              <th className="text-center py-0.5">Weight/Qty</th>
              <th className="text-right py-0.5">Rate</th>
              <th className="text-right py-0.5">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-mono">
            {(data.items || []).slice(0, 3).map((item, idx) => {
              const wt = item.weightKg ?? item.quantity ?? 1;
              const rate = item.pricePerKg ?? item.price ?? 580;
              return (
                <tr key={idx}>
                  <td className="py-0.5 font-sans font-medium text-black truncate max-w-[45mm]">
                    {item.name}
                  </td>
                  <td className="py-0.5 text-center font-bold">
                    {wt} {item.unit || "Kg"}
                  </td>
                  <td className="py-0.5 text-right">₹{rate}</td>
                  <td className="py-0.5 text-right font-bold">₹{item.total.toLocaleString("en-IN")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Total Summary Row */}
        <div className="border-t border-black pt-0.5 mt-0.5 font-mono text-[7.5px]">
          <div className="flex justify-between items-center font-black">
            <span>
              {hasWeightVariance ? (
                <span>Scale: <strong>{actualWeight.toFixed(2)} Kg</strong> (Ordered: {orderedWeight.toFixed(2)} Kg)</span>
              ) : (
                actualWeight > 0 ? `Harvest Wt: ${actualWeight.toFixed(2)} Kg` : "NET PAYABLE"
              )}
            </span>
            <span className="text-[10px]">
              ACTUAL TOTAL: ₹{data.grandTotal.toLocaleString("en-IN")}
            </span>
          </div>

          {paidAmount > 0 && (
            <div className="flex justify-between text-[6.5px] text-slate-700 font-mono mt-0.5">
              <span>Advance Paid ({data.paymentMethod || "Online / UPI"}):</span>
              <span className="font-bold">₹{paidAmount.toLocaleString("en-IN")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── 4. CATCH-WEIGHT RECONCILIATION & PAYMENT ACTION BANNER ─── */}
      {refundAmount > 0 ? (
        <div className="border border-black rounded p-1 mb-1 bg-slate-100 text-black leading-tight">
          <div className="flex items-center justify-between text-[7.5px] font-black">
            <span className="flex items-center gap-1">
              <span>💵</span>
              <span>CASH REFUND DUE TO CUSTOMER:</span>
            </span>
            <span className="text-[9.5px] font-mono underline font-black">₹{refundAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="text-[6.5px] mt-0.5 space-y-0.2">
            <p>
              Client paid for {orderedWeight ? `${orderedWeight.toFixed(2)} Kg` : "ordered wt"} (₹{paidAmount.toLocaleString("en-IN")}) • Actual net scale wt is {actualWeight.toFixed(2)} Kg (₹{data.grandTotal.toLocaleString("en-IN")}).
            </p>
            <p className="font-bold text-black">
              🛵 RIDER ACTION: Please return ₹{refundAmount.toLocaleString("en-IN")} cash or UPI refund to customer!
            </p>
          </div>
        </div>
      ) : remainingAmount > 0 ? (
        <div className="border border-black rounded p-1 mb-1 bg-white text-black leading-tight">
          <div className="flex items-center justify-between text-[7.5px] font-black">
            <span className="flex items-center gap-1">
              <span>⚠️</span>
              <span>PAYMENT DUE ON DELIVERY:</span>
            </span>
            <span className="text-[9.5px] font-mono font-black">₹{remainingAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="text-[6.5px] mt-0.5">
            {paidAmount > 0 ? (
              <p>Advance Paid: ₹{paidAmount.toLocaleString("en-IN")} • Actual Total: ₹{data.grandTotal.toLocaleString("en-IN")} • <strong>Balance Due: ₹{remainingAmount.toLocaleString("en-IN")}</strong></p>
            ) : (
              <p>Order not prepaid • Pay rider via Cash or scan locked J&amp;K Bank QR below</p>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-black rounded p-1 mb-1 bg-slate-50 text-black text-[7px] leading-tight flex items-center justify-between">
          <span className="font-bold flex items-center gap-1">
            <span>✓</span>
            <span>PAID IN FULL (PREPAID):</span>
          </span>
          <span className="font-mono font-bold">₹{data.grandTotal.toLocaleString("en-IN")} • DO NOT COLLECT PAYMENT</span>
        </div>
      )}

      {/* ─── 5. VISCERAL LOSS EDUCATION NOTICE (USER MANDATE) ─── */}
      <div className="bg-slate-50 border border-slate-400 rounded p-1 mb-1 text-[7px] leading-snug">
        <p className="font-bold text-black flex items-center gap-1">
          <span>⚖️</span>
          <span>Net Weight &amp; Visceral Loss Notice (Cleaned &amp; Gutted Trout):</span>
        </p>
        <p className="text-slate-800 mt-0.2">
          Fresh trout is weighed whole at harvest. During hygienic cleaning &amp; gutting, internal viscera and gills are removed, naturally resulting in a <strong>~12% to 18%</strong> weight reduction. You receive 100% clean, prime, ready-to-cook meat with zero kitchen waste!
        </p>
      </div>

      {/* ─── 6. FRESH TROUT CULINARY TIPS & CARE ─── */}
      <div className="border border-slate-400 rounded p-1 mb-1 text-[7px] leading-tight">
        <div className="grid grid-cols-2 gap-1">
          <div>
            <p className="font-bold text-black">✅ DO&apos;S (Gourmet Tips):</p>
            <ul className="text-slate-800 list-disc pl-2.5 space-y-0.2">
              <li>Store in refrigerator (0°C–4°C) to lock in natural sweetness.</li>
              <li>Cook fresh within 24–48h for peak mountain flavour.</li>
              <li>Rinse gently in cold water; cooks tender &amp; fast (6–8 mins)!</li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-black">❌ DON&apos;TS:</p>
            <ul className="text-slate-800 list-disc pl-2.5 space-y-0.2">
              <li>Do NOT wash with warm or hot water (keeps meat firm).</li>
              <li>Do NOT leave standing at room temperature.</li>
              <li>Do NOT refreeze once thawed (preserves flaky texture).</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ─── 7. FOOTER: VERIFICATION STAMP / LOCKED J&K BANK QR CODE ─── */}
      <div className="flex items-center justify-between border-t border-black pt-1 mt-0.5">
        <div className="text-[6.5px] text-slate-700 leading-tight">
          <p className="font-bold text-black">Urban Trout RAS Aquaculture Farm</p>
          <p>Near R. P. School Girls Wing, Malabagh, Srinagar</p>
          <p className="font-mono text-[6px]">Live mountain spring harvest • Best enjoyed fresh within 48 hours</p>
        </div>

        {refundAmount > 0 ? (
          <div className="border border-black px-1.5 py-0.5 rounded text-center bg-slate-100">
            <span className="text-[7.5px] font-black block">💵 CASH REFUND HANDOVER</span>
            <span className="text-[6px] font-mono block">Rider Handover: [ ] Cash  [ ] UPI</span>
            <span className="text-[6px] font-mono block font-bold">₹{refundAmount.toLocaleString("en-IN")} Returned</span>
          </div>
        ) : remainingAmount > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="text-right text-[6px] font-mono leading-tight">
              <span className="font-black block text-black text-[7px]">LOCKED J&amp;K BANK QR</span>
              <span className="font-black block text-black">₹{remainingAmount.toLocaleString("en-IN")}</span>
              <span className="text-[5.5px] block text-slate-600 truncate max-w-[28mm]">{upi}</span>
              <span className="text-[5px] block text-slate-500">Scan: GPay / mPay / PhonePe</span>
            </div>
            <div className="w-10 h-10 border border-black p-0.5 bg-white flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Locked UPI QR" className="w-full h-full object-contain" />
            </div>
          </div>
        ) : (
          <div className="border border-black px-2 py-0.5 rounded text-center bg-slate-100">
            <span className="text-[7.5px] font-black uppercase tracking-wider block">
              ✓ VERIFIED PREPAID
            </span>
            <span className="text-[6px] font-mono text-slate-600 block">
              {data.paymentMethod || "Online / UPI"}
            </span>
            <span className="text-[5.5px] font-mono text-slate-500 block">
              Do Not Collect Payment
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const COPY_LABELS = [
  "TAX INVOICE • CUSTOMER COPY",
  "DELIVERY SLIP • RIDER COPY",
  "GATE PASS • FARM LOG RECORD",
  "ACCOUNTS SLIP • OFFICE COPY",
];

/**
 * 4-in-1 A4 Sheet Layout (Canon MF244dw Laser Printer Optimized)
 * Formats up to 4 orders/invoices per A4 portrait page with waste-free print output.
 */
export default function FourUpInvoiceSheet({
  invoices,
  repeatSingle = false,
  onClose,
  showControls = true,
}: FourUpInvoiceSheetProps) {
  // If only 1 invoice is provided, default to repeating 4 useful copies (Customer + Rider + Farm + Accounts)
  // or allow 1 single slip with 100% clean blank paper on the other 3 quadrants to cut and reuse.
  const [repeatMode, setRepeatMode] = useState<boolean>(
    repeatSingle || invoices.length === 1
  );

  // Prepare slips array: if repeatMode is active for a single invoice, duplicate 4 times
  const displayInvoices: InvoiceSlipData[] =
    repeatMode && invoices.length === 1
      ? [invoices[0], invoices[0], invoices[0], invoices[0]]
      : invoices;

  // Chunk invoices into pages of 4 slips per A4 sheet
  const pages: InvoiceSlipData[][] = [];
  for (let i = 0; i < displayInvoices.length; i += 4) {
    pages.push(displayInvoices.slice(i, i + 4));
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ─── BROWSER SCREEN CONTROLS (Hidden during printing) ─── */}
      {showControls && (
        <div className="print:hidden sticky top-3 z-30 p-3 sm:p-4 rounded-2xl bg-slate-900/95 border border-slate-800 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">print</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Canon MF244dw 4-in-1 A4 Sheet</span>
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-semibold">
                  Zero-Waste Mode
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                4 bills per A4 page • Monochrome laser crisp • ✂ Zero ink on blank spaces
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {invoices.length === 1 && (
              <div className="inline-flex rounded-xl bg-slate-800 p-1 border border-slate-700 gap-1">
                <button
                  type="button"
                  onClick={() => setRepeatMode(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    repeatMode
                      ? "bg-cyan-500 text-slate-950 shadow-md"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Fill all 4 quadrants with Customer, Rider, Farm, and Accounts copies"
                >
                  📄 4 Copies (Customer + Rider + Farm + Accounts)
                </button>
                <button
                  type="button"
                  onClick={() => setRepeatMode(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !repeatMode
                      ? "bg-cyan-500 text-slate-950 shadow-md"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Print 1 slip only in the top-left and leave 3/4th of the page 100% blank to cut and reuse paper"
                >
                  ✂️ 1 Slip Only (Save Paper)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Print A4 Sheet</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── PRINTABLE A4 SHEETS CONTAINER ─── */}
      <div id="four-up-sheet-root" className="space-y-6">
        {pages.map((pageInvoices, pageIdx) => {
          const activeCount = pageInvoices.length;
          return (
            <div
              key={pageIdx}
              className="a4-sheet-container mx-auto bg-white text-black shadow-2xl relative border border-slate-300"
              style={{
                width: "210mm",
                height: "297mm",
                maxHeight: "297mm",
                boxSizing: "border-box",
                padding: "4mm",
                backgroundColor: "#ffffff",
                pageBreakAfter: pageIdx < pages.length - 1 ? "always" : "auto",
                breakAfter: pageIdx < pages.length - 1 ? "page" : "auto",
              }}
            >
              {/* Scissor cutting guides: drawn only along borders of active slips */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {activeCount > 1 ? (
                  <>
                    {/* Full Vertical center cut line */}
                    <div
                      className="absolute top-0 bottom-0 border-l border-dashed border-slate-400"
                      style={{ left: "50%" }}
                    >
                      <span className="absolute top-1 -left-2 text-[9px] text-slate-500">✂</span>
                      <span className="absolute top-1/2 -left-2 text-[9px] text-slate-500 -translate-y-1/2">✂</span>
                      <span className="absolute bottom-1 -left-2 text-[9px] text-slate-500">✂</span>
                    </div>
                    {/* Full Horizontal center cut line */}
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-slate-400"
                      style={{ top: "50%" }}
                    >
                      <span className="absolute left-1 -top-2 text-[9px] text-slate-500">✂</span>
                      <span className="absolute left-1/2 -top-2 text-[9px] text-slate-500 -translate-x-1/2">✂</span>
                      <span className="absolute right-1 -top-2 text-[9px] text-slate-500">✂</span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Only 1 slip (Top-Left): Cut lines ONLY outline the top-left quadrant so the rest of the sheet is 100% untouched clean paper */}
                    <div
                      className="absolute border-l border-dashed border-slate-400"
                      style={{ left: "50%", top: 0, height: "50%" }}
                    >
                      <span className="absolute top-1 -left-2 text-[9px] text-slate-500">✂</span>
                      <span className="absolute bottom-1 -left-2 text-[9px] text-slate-500">✂</span>
                    </div>
                    <div
                      className="absolute border-t border-dashed border-slate-400"
                      style={{ top: "50%", left: 0, width: "50%" }}
                    >
                      <span className="absolute left-1 -top-2 text-[9px] text-slate-500">✂</span>
                      <span className="absolute right-1 -top-2 text-[9px] text-slate-500">✂</span>
                    </div>
                  </>
                )}
              </div>

              {/* 2x2 Grid of Invoices */}
              <div
                className="grid grid-cols-2 grid-rows-2 h-full w-full box-border"
                style={{
                  height: "100%",
                  width: "100%",
                }}
              >
                {[0, 1, 2, 3].map((slotIdx) => {
                  const invoice = pageInvoices[slotIdx];
                  const isRightCol = slotIdx % 2 === 1;
                  const isBottomRow = slotIdx >= 2;

                  if (!invoice) {
                    // Empty quadrant: 100% clean white paper with ZERO text, ZERO lines, ZERO ink
                    return (
                      <div
                        key={slotIdx}
                        className="bg-white pointer-events-none"
                        style={{
                          height: "100%",
                          width: "100%",
                          backgroundColor: "#ffffff",
                        }}
                      />
                    );
                  }

                  const copyLabel =
                    repeatMode && invoices.length === 1
                      ? COPY_LABELS[slotIdx] || "TAX INVOICE / DELIVERY SLIP"
                      : undefined;

                  return (
                    <SingleInvoiceSlip
                      key={slotIdx}
                      data={invoice}
                      isRightCol={isRightCol}
                      isBottomRow={isBottomRow}
                      copyLabel={copyLabel}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Global Print Media CSS injection for Canon MF244dw */}
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
            margin: 0mm !important;
          }

          /* Hide all UI elements except the printable sheets */
          header,
          footer,
          nav,
          aside,
          .print\\:hidden,
          #header,
          #footer {
            display: none !important;
          }

          .a4-sheet-container {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 4mm !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          #four-up-sheet-root {
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
