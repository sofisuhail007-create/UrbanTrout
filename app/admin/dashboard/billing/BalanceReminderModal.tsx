"use client";

import { useState, useEffect } from "react";
import type { CustomerBalanceRecord } from "@/app/api/customer-balance/route";

interface BalanceReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: CustomerBalanceRecord | null;
  upiId?: string;
  onBalanceUpdated?: () => void;
}

function formatSafeDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, day] = match;
    const fallback = new Date(parseInt(y), parseInt(m) - 1, parseInt(day));
    if (!isNaN(fallback.getTime())) {
      return fallback.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  return dateStr;
}

export default function BalanceReminderModal({
  isOpen,
  onClose,
  record,
  upiId = "JKBMERC00828895@jkb",
  onBalanceUpdated,
}: BalanceReminderModalProps) {
  // Tabs: "remind" | "qr" | "settle"
  const [activeTab, setActiveTab] = useState<"remind" | "qr" | "settle">("remind");

  // Razorpay Dynamic QR State
  const [rzpQrLoading, setRzpQrLoading] = useState(false);
  const [rzpQrImageUrl, setRzpQrImageUrl] = useState<string | null>(null);
  const [rzpQrId, setRzpQrId] = useState<string | null>(null);
  const [rzpPaid, setRzpPaid] = useState(false);
  const [rzpError, setRzpError] = useState<string | null>(null);

  // Razorpay Payment Link State (for WhatsApp)
  const [paymentLink, setPaymentLink] = useState<string>("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  // Settlement Form State
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("Cash");
  const [settlementNote, setSettlementNote] = useState<string>("");
  const [settling, setSettling] = useState(false);

  // Reset when record changes
  useEffect(() => {
    if (record) {
      setPaymentAmount((record.balance_amount ?? 0).toString());
      setPaymentLink(record.razorpay_payment_link_url || "");
      setRzpQrId(record.razorpay_qr_id || null);
      setRzpQrImageUrl(null);
      setRzpPaid(false);
      setRzpError(null);
      setActiveTab("remind");
    }
  }, [record]);

  // Poll for QR payment verification (HOOK MUST REMAIN UNCONDITIONAL AT COMPONENT ROOT)
  useEffect(() => {
    if (!isOpen || !record || !rzpQrId || rzpPaid || activeTab !== "qr") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/razorpay/pos-qr?qr_id=${encodeURIComponent(rzpQrId)}`);
        const data = await res.json();
        if (data?.success && data.paid) {
          setRzpPaid(true);
          clearInterval(interval);

          // Mark settled in API
          await fetch("/api/customer-balance", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: record.id,
              action: "RECORD_PAYMENT",
              amountReceived: record.balance_amount,
              paymentMethod: "Razorpay QR (Verified)",
              settlementNote: `Paid in full via Razorpay Dynamic QR (Payment Ref: ${data.payment?.id || "N/A"})`,
            }),
          });

          if (onBalanceUpdated) onBalanceUpdated();
        }
      } catch (_) {}
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, record?.id, record?.balance_amount, rzpQrId, rzpPaid, activeTab, onBalanceUpdated]);

  // Early return strictly AFTER all hooks have executed
  if (!isOpen || !record) return null;

  const cleanPhone = (record.customer_phone || "").replace(/\D/g, "").slice(-10);

  // Generate automated polite WhatsApp reminder text
  const generateWhatsAppMessage = (directPayLink?: string) => {
    const link = directPayLink || paymentLink;
    const paySection = link
      ? `\n💳 *Clear Balance Online (Instant UPI / Cards / NetBanking):*\n👉 ${link}\n\n*Store UPI ID:* ${upiId}`
      : `\n💳 *Pay via Store UPI ID:* ${upiId}`;

    return `*AUTOMATED ACCOUNT STATEMENT / PAYMENT UPDATE*
_Urban Trout Aquaculture · Srinagar, Kashmir_

Dear *${record.customer_name}*,

This is an automated system-generated billing update regarding your recent order with Urban Trout.

📄 *Statement Details:*
• *Order / Invoice Ref:* #${record.invoice_id}
• *Date:* ${formatSafeDate(record.created_at)}
• *Order Items:* ${record.items_summary || "Fresh Rainbow Trout"}

💰 *Payment Breakdown:*
• *Total Bill Amount:* Rs. ${(Number(record.total_amount) || 0).toLocaleString("en-IN")}
• *Amount Received:* Rs. ${(Number(record.paid_amount) || 0).toLocaleString("en-IN")}
• *Outstanding Balance Due:* *Rs. ${(Number(record.balance_amount) || 0).toLocaleString("en-IN")}*
${paySection}

━━━━━━━━━━━━━━━━━━━━
_ℹ️ Automated Notice: This is a system-generated statement. If you have already cleared this payment in cash or via recent transfer, please disregard this message or reply to this chat so our team can update your ledger._

Warm regards,
*Urban Trout Aquaculture, Srinagar*
Helpline: +91 84910 06127`;
  };

  // 1. Generate Razorpay Payment Link for WhatsApp
  const handleGeneratePaymentLink = async () => {
    if (record.balance_amount <= 0) return;
    setGeneratingLink(true);
    try {
      const res = await fetch("/api/razorpay/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: record.balance_amount,
          customerName: record.customer_name,
          customerPhone: cleanPhone,
          orderRef: `BAL-${record.invoice_id}`,
          itemsSummary: `Remaining Balance for Inv #${record.invoice_id}`,
          notes: `Remaining balance for ${record.customer_name} (#${record.invoice_id})`,
        }),
      });
      const data = await res.json();
      if (data?.success && data.paymentLink?.short_url) {
        const url = data.paymentLink.short_url;
        setPaymentLink(url);

        // Update record
        await fetch("/api/customer-balance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: record.id,
            action: "UPDATE_LINKS",
            razorpayPaymentLinkUrl: url,
          }),
        });

        return url;
      }
    } catch (e) {
      console.warn("Could not generate payment link:", e);
    } finally {
      setGeneratingLink(false);
    }
    return null;
  };

  // 2. Open WhatsApp with prefilled polite system reminder
  const handleSendWhatsApp = async () => {
    let currentLink = paymentLink;
    if (!currentLink && record.balance_amount > 0) {
      currentLink = (await handleGeneratePaymentLink()) || "";
    }

    const message = generateWhatsAppMessage(currentLink);
    const encoded = encodeURIComponent(message);
    const url = cleanPhone.length === 10
      ? `https://wa.me/91${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, "_blank");

    // Mark reminder timestamp in API
    try {
      await fetch("/api/customer-balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, action: "REMINDER_SENT" }),
      });
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (_) {}
  };

  // 3. Generate Razorpay Dynamic QR for Balance Amount
  const handleGenerateBalanceQr = async () => {
    if (record.balance_amount <= 0) return;
    setRzpQrLoading(true);
    setRzpError(null);
    try {
      const res = await fetch("/api/razorpay/pos-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: record.balance_amount,
          customerName: record.customer_name,
          customerPhone: cleanPhone,
          billNumber: `Bal-${record.invoice_id}`,
        }),
      });
      const data = await res.json();
      if (data?.success && data.image_url) {
        setRzpQrImageUrl(data.image_url);
        setRzpQrId(data.qr_id);

        // Update record in API
        await fetch("/api/customer-balance", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: record.id,
            action: "UPDATE_LINKS",
            razorpayQrId: data.qr_id,
          }),
        });
      } else {
        setRzpError(data?.error || "Failed to generate QR");
      }
    } catch (err: any) {
      setRzpError(err?.message || "Failed to generate Razorpay QR");
    } finally {
      setRzpQrLoading(false);
    }
  };



  // 4. Record Payment or Settle as Final Waiver
  const handleRecordRepayment = async () => {
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount greater than ₹0");
      return;
    }

    setSettling(true);
    try {
      const res = await fetch("/api/customer-balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          action: "RECORD_PAYMENT",
          amountReceived: amount,
          paymentMethod: paymentMode,
          settlementNote: settlementNote.trim() || `Received ₹${amount} via ${paymentMode}`,
        }),
      });

      const data = await res.json();
      if (data?.success) {
        if (onBalanceUpdated) onBalanceUpdated();
        onClose();
      } else {
        alert(data?.error || "Failed to record payment");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to record payment");
    } finally {
      setSettling(false);
    }
  };

  // 5. Mark as Final Payment / Settle Balance with Discount Waiver
  const handleSettleFinalWaiver = async () => {
    const reason = window.prompt(
      `Mark remaining balance of ₹${record.balance_amount} as settled/waived? Enter settlement reason:`,
      "Cash payment agreed as final settlement / courtesy discount"
    );

    if (reason === null) return;

    setSettling(true);
    try {
      const res = await fetch("/api/customer-balance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          action: "SETTLE_FINAL_WAIVER",
          settlementNote: reason.trim() || "Agreed cash settlement as final payment",
        }),
      });

      const data = await res.json();
      if (data?.success) {
        if (onBalanceUpdated) onBalanceUpdated();
        onClose();
      } else {
        alert(data?.error || "Failed to settle balance");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to settle balance");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-lg">
              <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
            </div>
            <div>
              <h3 className="font-bold text-white text-base" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Customer Khata & Balance
              </h3>
              <p className="text-slate-400 text-xs font-mono">
                Invoice #{record.invoice_id} · {record.customer_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* Balance Overview Card */}
        <div className="p-4 bg-gradient-to-r from-amber-950/30 via-slate-900 to-cyan-950/20 border-b border-slate-800">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Bill</p>
              <p className="text-sm font-bold text-white font-mono mt-0.5">₹{(Number(record.total_amount) || 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-emerald-500/20">
              <p className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">Paid So Far</p>
              <p className="text-sm font-bold text-emerald-300 font-mono mt-0.5">₹{(Number(record.paid_amount) || 0).toLocaleString("en-IN")}</p>
            </div>
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-amber-500/40 shadow-inner">
              <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Remaining Balance</p>
              <p className="text-base font-extrabold text-amber-300 font-mono mt-0.5">₹{(Number(record.balance_amount) || 0).toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-cyan-400">phone</span>
              <span className="font-mono text-slate-200">{cleanPhone ? `+91 ${cleanPhone}` : "No Phone"}</span>
            </div>
            <div>
              Status:{" "}
              <span
                className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase ${
                  record.status === "settled"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : record.status === "waived_final"
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {record.status === "waived_final" ? "Waived as Final" : record.status}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("remind")}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "remind"
                ? "border-emerald-400 text-emerald-300 bg-emerald-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            WhatsApp Reminder
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("qr");
              if (!rzpQrImageUrl && record.balance_amount > 0) handleGenerateBalanceQr();
            }}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "qr"
                ? "border-cyan-400 text-cyan-300 bg-cyan-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-sm">qr_code_2</span>
            Razorpay Balance QR
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settle")}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === "settle"
                ? "border-amber-400 text-amber-300 bg-amber-500/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className="material-symbols-outlined text-sm">payments</span>
            Settle / Record Cash
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: WHATSAPP REMINDER */}
          {activeTab === "remind" && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-emerald-400 flex-shrink-0 mt-0.5">verified</span>
                <div>
                  <p className="font-bold">Polite &amp; Automated System Reminder</p>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Structured as an official system billing statement with invoice reference and secure Razorpay payment link so customers feel completely at ease.
                  </p>
                </div>
              </div>

              {/* Message Preview Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                {generateWhatsAppMessage()}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  disabled={!cleanPhone}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  Send on WhatsApp (+91 {cleanPhone || "N/A"})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generateWhatsAppMessage());
                    setMsgCopied(true);
                    setTimeout(() => setMsgCopied(false), 2000);
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  {msgCopied ? "✓ Copied" : "Copy Message"}
                </button>
              </div>

              {record.last_reminder_sent_at && (
                <p className="text-center text-[11px] text-slate-400 font-mono">
                  Last reminder sent: {formatSafeDate(record.last_reminder_sent_at)}
                </p>
              )}
            </div>
          )}

          {/* TAB 2: RAZORPAY BALANCE QR */}
          {activeTab === "qr" && (
            <div className="flex flex-col items-center text-center space-y-3">
              {rzpPaid ? (
                <div className="p-6 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl w-full text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto text-2xl font-bold">
                    ✓
                  </div>
                  <h4 className="text-base font-bold text-white">Payment Received!</h4>
                  <p className="text-xs text-emerald-300">
                    Remaining balance of ₹{(Number(record.balance_amount) || 0).toLocaleString("en-IN")} cleared via Razorpay UPI.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-300">
                    Scan using any UPI App (Google Pay, PhonePe, Paytm) to pay exact balance:
                  </p>
                  <div className="p-2.5 bg-white border-2 border-cyan-500/40 rounded-2xl shadow-xl">
                    {rzpQrLoading ? (
                      <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-800 gap-2">
                        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[11px] font-mono">Creating QR...</span>
                      </div>
                    ) : rzpQrImageUrl ? (
                      <img src={rzpQrImageUrl} alt="Razorpay Balance QR" className="w-44 h-44 rounded-lg object-contain" />
                    ) : (
                      <div className="w-44 h-44 flex flex-col items-center justify-center text-slate-700 gap-2">
                        <span className="material-symbols-outlined text-3xl text-cyan-600">qr_code_2</span>
                        <button
                          type="button"
                          onClick={handleGenerateBalanceQr}
                          className="text-xs bg-cyan-600 text-white px-3 py-1.5 rounded-lg font-bold"
                        >
                          Generate QR
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-base font-extrabold text-white font-mono">
                      Amount Locked: <span className="text-cyan-400">₹{(Number(record.balance_amount) || 0).toLocaleString("en-IN")}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {rzpQrId ? "🟢 Live auto-checking payment status..." : "Click button to generate dynamic QR"}
                    </p>
                  </div>

                  {rzpError && <p className="text-xs text-rose-400 font-mono">{rzpError}</p>}
                </>
              )}
            </div>
          )}

          {/* TAB 3: SETTLE / RECORD PAYMENT */}
          {activeTab === "settle" && (
            <div className="space-y-4">
              {/* Option 1: Record Cash / UPI Repayment */}
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Record Customer Repayment
                  </h4>
                  <span className="text-[11px] text-amber-400 font-mono font-bold">
                    Balance: ₹{(Number(record.balance_amount) || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Amount Received (₹)</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-amber-400 focus:outline-none"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Payment Method</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-amber-400 focus:outline-none"
                    >
                      <option value="Cash">Cash at Counter</option>
                      <option value="J&K Bank Soundbox">J&K Bank Soundbox UPI</option>
                      <option value="Razorpay QR">Razorpay UPI</option>
                      <option value="Bank Transfer">Direct Bank Transfer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    value={settlementNote}
                    onChange={(e) => setSettlementNote(e.target.value)}
                    placeholder="e.g. Handed over at shop"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRecordRepayment}
                  disabled={settling}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/40 transition-all cursor-pointer"
                >
                  {settling ? "Recording..." : `Record ₹${paymentAmount || 0} Payment`}
                </button>
              </div>

              {/* Option 2: Settle as Final Amount / Discount Waiver */}
              <div className="p-3.5 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-400 text-base">handshake</span>
                  <h4 className="text-xs font-bold text-blue-300">
                    Settle as Final Amount (Discount / Waiver)
                  </h4>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  If the customer paid partial in cash and both agreed that it was the final amount, click below to mark it settled. This completely clears the balance to ₹0 so no false balance remains.
                </p>

                <button
                  type="button"
                  onClick={handleSettleFinalWaiver}
                  disabled={settling}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Mark as Agreed Final Payment (Zero Balance)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono text-[11px]">Urban Trout Khata Ledger</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
