"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { adminFetch } from "@/lib/adminClient";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SocialPayRecord {
  id: string; // local ID, e.g. "SP-123456"
  paymentLinkId: string | null; // Razorpay plink_xxx
  paymentLinkUrl: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  amount: number;
  note: string;
  channel: "whatsapp" | "email" | "telegram" | "copy" | "sms";
  status: "PENDING" | "PAID" | "CANCELLED";
  paymentId?: string | null;
  createdAt: string; // ISO
}

const STORAGE_KEY = "ut_social_pay_records_v1";
const POLL_INTERVAL_MS = 7000;

const CHANNEL_META = {
  whatsapp: { label: "WhatsApp", icon: "💬", color: "emerald", bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25" },
  email: { label: "Email", icon: "📧", color: "blue", bg: "bg-blue-500/15 border-blue-500/40 text-blue-300 hover:bg-blue-500/25" },
  telegram: { label: "Telegram", icon: "✈️", color: "sky", bg: "bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25" },
  sms: { label: "SMS", icon: "💬", color: "violet", bg: "bg-violet-500/15 border-violet-500/40 text-violet-300 hover:bg-violet-500/25" },
  copy: { label: "Copy Link", icon: "📋", color: "amber", bg: "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25" },
};

// ─── Helper: build the branded message ────────────────────────────────────────
function buildMessage(record: SocialPayRecord, payUrl: string): string {
  const amtStr = record.amount.toLocaleString("en-IN");
  const name = record.customerName || "Valued Customer";
  return `*URBAN TROUT AQUACULTURE*
_Fresh Himalayan Rainbow Trout · Srinagar_

Dear *${name}*,

Your payment of *₹${amtStr}* is due.
${record.note ? `\n*Ref:* ${record.note}\n` : ""}
*Pay Securely Here:*
${payUrl}

• Accepted: UPI / Google Pay / PhonePe / Paytm / Card
• Amount Locked: ₹${amtStr} (exact)
• Instant confirmation upon payment

*Urban Trout Helpline:* +91 84910 06127
Naseem Bagh / Malabagh, Srinagar`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SocialPayPage() {
  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<"whatsapp" | "email" | "telegram" | "copy" | "sms">("whatsapp");

  // Records & UI state
  const [records, setRecords] = useState<SocialPayRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (_) {}
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Audio ref for success chime
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Persist records to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
      } catch (_) {}
    }
  }, [records]);

  // ─── Success chime ───────────────────────────────────────────────────────
  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.36);
      });
    } catch (_) {}
  }, []);

  // ─── Payment Link Poller ─────────────────────────────────────────────────
  useEffect(() => {
    const pending = records.filter((r) => r.status === "PENDING" && r.paymentLinkId);
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      for (const rec of pending) {
        try {
          const res = await fetch(`/api/razorpay/payment-link?link_id=${encodeURIComponent(rec.paymentLinkId!)}`);
          const data = await res.json();
          if (data.success && data.paid) {
            const payId = data.payment?.id || `paid_${Date.now()}`;
            playChime();
            setRecords((prev) =>
              prev.map((r) =>
                r.id === rec.id ? { ...r, status: "PAID", paymentId: payId } : r
              )
            );
          }
        } catch (err) {
          console.warn("[social-pay] Poll error for", rec.id, err);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [records, playChime]);

  // ─── Send Handler ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!customerPhone && !customerEmail && selectedChannel !== "copy") {
      setError("Please enter a phone number or email.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const spId = `SP-${Date.now().toString().slice(-6)}`;
      const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);
      const cleanName = customerName.trim() || "Valued Customer";

      // Create Razorpay payment link
      let payUrl = "";
      let plId = "";

      const linkRes = await adminFetch("/api/razorpay/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          customerName: cleanName,
          customerPhone: cleanPhone,
          customerEmail: customerEmail.trim() || undefined,
          orderRef: spId,
          itemsSummary: note || "Urban Trout Remote Payment",
          channel: "SOCIAL_PAY",
        }),
      });

      const linkData = await linkRes.json();
      if (linkData.success && linkData.paymentLink?.short_url) {
        payUrl = linkData.paymentLink.short_url;
        plId = linkData.paymentLink.id;
      } else {
        throw new Error(linkData.error || "Failed to create payment link");
      }

      // Build the record
      const record: SocialPayRecord = {
        id: spId,
        paymentLinkId: plId,
        paymentLinkUrl: payUrl,
        customerName: cleanName,
        customerPhone: cleanPhone,
        customerEmail: customerEmail.trim(),
        amount: numAmount,
        note: note.trim(),
        channel: selectedChannel,
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };

      // Save to local records
      setRecords((prev) => [record, ...prev]);
      setSuccessId(spId);

      // Dispatch via chosen channel
      const msg = buildMessage(record, payUrl);

      if (selectedChannel === "whatsapp") {
        const waUrl = cleanPhone
          ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
          : `https://wa.me/?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, "_blank");
      } else if (selectedChannel === "email") {
        const subject = encodeURIComponent(`Urban Trout – Payment of ₹${numAmount.toLocaleString("en-IN")}`);
        const body = encodeURIComponent(
          `Dear ${cleanName},\n\nYour payment of ₹${numAmount.toLocaleString("en-IN")} is due.\n${note ? `\nRef: ${note}\n` : ""}\nPay here: ${payUrl}\n\nAccepted: UPI / Google Pay / PhonePe / Paytm / Card\nAmount Locked: ₹${numAmount.toLocaleString("en-IN")}\n\nUrban Trout Helpline: +91 84910 06127`
        );
        const emailTarget = customerEmail.trim() || "";
        window.open(`mailto:${emailTarget}?subject=${subject}&body=${body}`, "_self");
      } else if (selectedChannel === "telegram") {
        // Telegram doesn't support pre-filled contacts, copy to clipboard and open app
        await navigator.clipboard.writeText(`${msg}`);
        setCopiedId(spId);
        setTimeout(() => setCopiedId(null), 3000);
        window.open("https://t.me", "_blank");
      } else if (selectedChannel === "sms") {
        const smsBody = encodeURIComponent(`Urban Trout: Pay ₹${numAmount.toLocaleString("en-IN")} here: ${payUrl}`);
        window.open(`sms:${cleanPhone ? `+91${cleanPhone}` : ""}?body=${smsBody}`, "_self");
      } else {
        // Copy link
        await navigator.clipboard.writeText(payUrl);
        setCopiedId(spId);
        setTimeout(() => setCopiedId(null), 3000);
      }

      // Reset form (keep channel & name)
      setAmount("");
      setNote("");
      setCustomerPhone("");
      setCustomerEmail("");
      setTimeout(() => setSuccessId(null), 8000);
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {}
  };

  const handleMarkPaid = (id: string) => {
    if (!confirm("Mark this payment as PAID manually?")) return;
    setRecords((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "PAID", paymentId: `manual_${Date.now().toString().slice(-6)}` } : r
      )
    );
    playChime();
  };

  const handleCancel = async (rec: SocialPayRecord) => {
    if (!confirm(`Cancel payment link for ${rec.customerName}?`)) return;
    if (rec.paymentLinkId) {
      try {
        await adminFetch(`/api/razorpay/payment-link?link_id=${rec.paymentLinkId}`, { method: "DELETE" });
      } catch (_) {}
    }
    setRecords((prev) => prev.map((r) => (r.id === rec.id ? { ...r, status: "CANCELLED" } : r)));
  };

  const handleClearAll = () => {
    if (confirm("Clear all completed/cancelled records? Pending records will remain.")) {
      setRecords((prev) => prev.filter((r) => r.status === "PENDING"));
    }
  };

  const pendingCount = records.filter((r) => r.status === "PENDING").length;

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
      {/* ─── Page Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-xl sm:text-2xl font-black text-white flex items-center gap-2"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            <span className="material-symbols-outlined text-cyan-400 text-xl">send_to_mobile</span>
            Social / Remote Pay
          </h1>
          <p className="text-sm text-slate-400 font-mono mt-0.5">
            Collect payments from any customer via WhatsApp, Email, Telegram, SMS, or a shareable link.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            {pendingCount} Awaiting Payment
          </div>
        )}
      </div>

      {/* ─── Send New Payment ─── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <h2
          className="text-sm font-bold text-white flex items-center gap-1.5"
          style={{ fontFamily: '"Space Grotesk", sans-serif' }}
        >
          <span className="material-symbols-outlined text-cyan-400 text-base">add_card</span>
          Send New Payment Request
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Customer Name */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Mushtaq Ahmad"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">
              Amount to Collect (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 font-bold font-mono">₹</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 1200"
                className="w-full bg-slate-950 border-2 border-cyan-500/40 rounded-xl pl-7 pr-4 py-2 text-lg font-mono text-white font-bold focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">
              Mobile Number (WhatsApp / SMS)
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="10-digit mobile"
              maxLength={10}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">
              Email (Optional)
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@email.com"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>

        {/* Note / Description */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">
            Payment Note / Description (Optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 2 Kg Premium Gutted Trout – Special Price"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        {/* Channel Selector */}
        <div className="space-y-2">
          <label className="text-[11px] text-slate-400 uppercase font-mono tracking-wider block">
            Send Via
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(Object.keys(CHANNEL_META) as Array<keyof typeof CHANNEL_META>).map((ch) => {
              const meta = CHANNEL_META[ch];
              const isActive = selectedChannel === ch;
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setSelectedChannel(ch)}
                  className={`py-2.5 px-2 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 cursor-pointer transition-all ${
                    isActive
                      ? meta.bg + " shadow-md"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="text-lg leading-none">{meta.icon}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] text-slate-500 font-mono">
            {selectedChannel === "whatsapp" && "Opens WhatsApp with a pre-filled payment message and secure link."}
            {selectedChannel === "email" && "Opens your email client with a pre-filled payment request email."}
            {selectedChannel === "telegram" && "Copies the message to your clipboard — paste it in Telegram."}
            {selectedChannel === "sms" && "Opens your SMS app with a short payment link."}
            {selectedChannel === "copy" && "Copies the payment link to clipboard — paste anywhere."}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            ❌ {error}
          </div>
        )}

        {/* Success Flash */}
        {successId && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-2">
            <span className="text-base">✓</span>
            <span>Payment request sent! Monitoring for payment in the list below.</span>
          </div>
        )}
        {copiedId && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2">
            <span className="text-base">📋</span>
            <span>
              {selectedChannel === "telegram"
                ? "Message copied to clipboard — paste it in Telegram!"
                : "Payment link copied to clipboard!"}
            </span>
          </div>
        )}

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !amount}
          className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <span className="animate-spin text-base">⏳</span>
              <span>Generating Link…</span>
            </>
          ) : (
            <>
              <span className="text-lg">{CHANNEL_META[selectedChannel].icon}</span>
              <span>
                Generate Link &amp; Send via {CHANNEL_META[selectedChannel].label}
                {amount && parseFloat(amount) > 0
                  ? ` — ₹${parseFloat(amount).toLocaleString("en-IN")}`
                  : ""}
              </span>
            </>
          )}
        </button>

        {/* Info strip */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { icon: "🔒", label: "Amount Locked", sub: "Customer cannot modify" },
            { icon: "⚡", label: "Instant Confirm", sub: "No screenshot needed" },
            { icon: "📊", label: "Live Tracking", sub: "Status updates below" },
          ].map((tip) => (
            <div key={tip.label} className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <div className="text-base">{tip.icon}</div>
              <div className="text-[10px] font-bold text-white font-mono">{tip.label}</div>
              <div className="text-[9px] text-slate-500 font-mono">{tip.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Recent Payment Requests ─── */}
      <div className="bg-slate-900/85 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3
              className="text-sm font-bold text-white flex items-center gap-1.5"
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            >
              <span className="material-symbols-outlined text-cyan-400 text-base">history</span>
              Recent Payment Requests
              {pendingCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/40 animate-pulse">
                  {pendingCount} live
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              Auto-refreshes every 7 seconds. Status updates automatically when paid.
            </p>
          </div>
          {records.filter((r) => r.status !== "PENDING").length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-mono underline cursor-pointer"
            >
              Clear Completed
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-mono text-xs space-y-1">
            <div className="text-2xl opacity-40">💸</div>
            <div>No payment requests yet. Fill in the form above to send your first one.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div
                key={rec.id}
                className={`p-3 sm:p-4 rounded-xl border transition-all ${
                  rec.status === "PAID"
                    ? "bg-emerald-950/30 border-emerald-500/30"
                    : rec.status === "CANCELLED"
                    ? "bg-slate-950/40 border-slate-700/50 opacity-60"
                    : "bg-slate-950/60 border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Customer + Amount */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{rec.customerName}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase font-mono border ${
                          rec.status === "PAID"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : rec.status === "CANCELLED"
                            ? "bg-slate-700/50 text-slate-400 border-slate-600"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                        }`}
                      >
                        {rec.status === "PAID" ? "✓ PAID" : rec.status === "CANCELLED" ? "CANCELLED" : "⏳ PENDING"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {CHANNEL_META[rec.channel].icon} {CHANNEL_META[rec.channel].label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-lg font-black text-cyan-300 font-mono">
                        ₹{rec.amount.toLocaleString("en-IN")}
                      </span>
                      {rec.customerPhone && (
                        <span className="text-[11px] text-slate-400 font-mono">📞 +91 {rec.customerPhone}</span>
                      )}
                      {rec.customerEmail && (
                        <span className="text-[11px] text-slate-400 font-mono">✉️ {rec.customerEmail}</span>
                      )}
                    </div>

                    {rec.note && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{rec.note}</p>
                    )}

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-slate-600 font-mono">{rec.id}</span>
                      <span className="text-[10px] text-slate-600 font-mono">
                        {new Date(rec.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                      {rec.status === "PAID" && rec.paymentId && (
                        <span className="text-[10px] text-emerald-400/70 font-mono">Ref: {rec.paymentId}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    {rec.paymentLinkUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopyLink(rec.paymentLinkUrl!, rec.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono cursor-pointer transition-colors"
                      >
                        {copiedId === rec.id ? "✓ Copied!" : "📋 Copy Link"}
                      </button>
                    )}

                    {rec.status === "PENDING" && rec.customerPhone && (
                      <button
                        type="button"
                        onClick={() => {
                          const msg = buildMessage(rec, rec.paymentLinkUrl || "");
                          window.open(
                            `https://wa.me/91${rec.customerPhone}?text=${encodeURIComponent(msg)}`,
                            "_blank"
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800/60 text-emerald-300 text-[10px] font-mono cursor-pointer transition-colors"
                      >
                        💬 Resend WA
                      </button>
                    )}

                    {rec.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(rec.id)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono cursor-pointer transition-colors"
                        >
                          ✓ Mark Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(rec)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 text-[10px] font-mono cursor-pointer transition-colors"
                        >
                          ✕ Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── How It Works ─── */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase font-mono tracking-wider">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { step: "1", title: "Enter Details", desc: "Customer name, amount, and optional note" },
            { step: "2", title: "Choose Channel", desc: "WhatsApp, Email, Telegram, SMS, or Copy Link" },
            { step: "3", title: "Send", desc: "A locked Razorpay payment link is generated and sent" },
            { step: "4", title: "Auto-Confirm", desc: "Status flips to PAID automatically when customer pays" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-black font-mono flex items-center justify-center shrink-0">
                {s.step}
              </div>
              <div>
                <div className="text-xs font-bold text-white">{s.title}</div>
                <div className="text-[10.5px] text-slate-500 font-mono">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
