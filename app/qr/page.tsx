"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function QuickQrContent() {
  const searchParams = useSearchParams();
  const urlAm = searchParams.get("am") || searchParams.get("amount") || "";
  const urlOrd = searchParams.get("ord") || searchParams.get("order") || "";
  const urlMode = searchParams.get("gateway") || searchParams.get("mode") || "jk_bank";

  const [amount, setAmount] = useState<string>(urlAm || "1160");
  const [orderRef, setOrderRef] = useState<string>(urlOrd);
  const [gateway, setGateway] = useState<"jk_bank" | "razorpay">(urlMode === "razorpay" ? "razorpay" : "jk_bank");
  const [copied, setCopied] = useState<boolean>(false);
  const [paidCelebration, setPaidCelebration] = useState<boolean>(false);
  const [rzpLoading, setRzpLoading] = useState<boolean>(false);
  const [rzpQrData, setRzpQrData] = useState<{ qr_id: string; image_url: string; amount: number } | null>(null);

  useEffect(() => {
    if (urlAm) setAmount(urlAm);
    if (urlOrd) setOrderRef(urlOrd);
  }, [urlAm, urlOrd]);

  const numAmount = parseFloat(amount) || 0;
  const upiId = "JKBMERC00828895@jkb";
  const noteText = orderRef ? `Order ${orderRef}` : "Urban Trout Fresh Fish";
  const upiUri = numAmount > 0
    ? `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Aquaculture&am=${numAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(noteText)}`
    : "";

  const jkQrImageUrl = upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(upiUri)}&bgcolor=255-255-255&color=0-0-0&margin=2`
    : "";

  // Fetch dynamic Razorpay QR if gateway is razorpay
  useEffect(() => {
    if (gateway !== "razorpay" || numAmount <= 0) {
      setRzpQrData(null);
      return;
    }

    let isSubscribed = true;
    setRzpLoading(true);

    fetch(`/api/razorpay/quick-qr?amount=${numAmount}&format=json`)
      .then((res) => res.json())
      .then((data) => {
        if (isSubscribed && data.success && data.image_url) {
          setRzpQrData(data);
        }
      })
      .catch((err) => console.warn("Failed to load Razorpay dynamic QR:", err))
      .finally(() => {
        if (isSubscribed) setRzpLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [gateway, numAmount]);

  // Poll for payment when in Razorpay mode
  useEffect(() => {
    if (gateway !== "razorpay" || !rzpQrData?.qr_id || paidCelebration) return;

    let isSubscribed = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/razorpay/pos-qr?qr_id=${encodeURIComponent(rzpQrData.qr_id)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && data.paid && isSubscribed) {
          triggerPaidChime();
        }
      } catch (_) {}
    }, 2500);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [gateway, rzpQrData?.qr_id, paidCelebration]);

  const handleQuickAmount = (val: number) => {
    setAmount(String(val));
    setPaidCelebration(false);
  };

  const handleCopyLink = () => {
    if (!upiUri) return;
    navigator.clipboard.writeText(upiUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!upiUri) return;
    const msg = `Hi! 🐟\nHere is your locked UPI payment link for Urban Trout:\n\n*Amount: ₹${numAmount.toLocaleString("en-IN")}*\n\nTap to pay with Google Pay / PhonePe / Paytm / mPay:\n${upiUri}\n\nThank you!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const triggerPaidChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      }
    } catch (_) {}
    setPaidCelebration(true);
  };

  const activeQrImage = gateway === "razorpay" ? rzpQrData?.image_url : jkQrImageUrl;

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-4 pb-8 max-w-md mx-auto select-none">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pt-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐟</span>
          <div>
            <h1 className="text-base font-black tracking-tight text-white leading-none">URBAN TROUT</h1>
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mt-0.5">Rider Instant Locked QR</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-full text-xs font-bold font-mono">
          <span>{gateway === "razorpay" ? "⚡ Auto-Telegram" : "🔒 0% Fee J&K"}</span>
        </div>
      </div>

      {/* Gateway Selector Tabs */}
      <div className="w-full grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl mt-2">
        <button
          type="button"
          onClick={() => {
            setGateway("jk_bank");
            setPaidCelebration(false);
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            gateway === "jk_bank"
              ? "bg-emerald-500 text-slate-950 shadow-md font-black"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>🏦 J&K Bank (0% Fee)</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGateway("razorpay");
            setPaidCelebration(false);
          }}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            gateway === "razorpay"
              ? "bg-cyan-500 text-slate-950 shadow-md font-black"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>⚡ Razorpay + Telegram</span>
        </button>
      </div>

      {/* Amount Input & Quick Chips */}
      <div className="w-full my-2 space-y-2">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-xl">
          <div className="flex-1">
            <span className="text-[11px] text-slate-400 uppercase tracking-widest font-bold block mb-0.5">
              Rupees to Collect (Locked)
            </span>
            <div className="flex items-center gap-1">
              <span className="text-2xl font-black text-cyan-400">₹</span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPaidCelebration(false);
                }}
                placeholder="0"
                className="w-full bg-transparent text-3xl font-black font-mono text-white focus:outline-none placeholder-slate-600"
                autoFocus
              />
            </div>
          </div>
          {amount && (
            <button
              type="button"
              onClick={() => setAmount("")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* Quick Amount Chips (Multiples of Trout Weight) */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "1 Kg", amt: 580 },
            { label: "1.5 Kg", amt: 870 },
            { label: "2 Kg", amt: 1160 },
            { label: "3 Kg", amt: 1740 },
          ].map((chip) => (
            <button
              key={chip.amt}
              type="button"
              onClick={() => handleQuickAmount(chip.amt)}
              className={`py-1.5 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                numAmount === chip.amt
                  ? "bg-cyan-500 text-slate-950 font-black border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]"
                  : "bg-slate-900 border-slate-800 text-slate-300 font-semibold hover:bg-slate-800 text-xs"
              }`}
            >
              <div className="text-[10px] opacity-75">{chip.label}</div>
              <div className="text-xs font-mono font-bold">₹{chip.amt}</div>
            </button>
          ))}
        </div>
      </div>

      {/* QR Code Presentation Box */}
      <div className="w-full flex-1 flex flex-col items-center justify-center p-4 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative">
        {paidCelebration ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-3 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-4xl text-emerald-400 shadow-xl shadow-emerald-500/30 animate-bounce">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-black text-emerald-400">Payment Collected!</h2>
              <p className="text-sm font-mono text-slate-300 mt-1">₹{numAmount.toLocaleString("en-IN")}</p>
              {gateway === "razorpay" && (
                <p className="text-xs text-cyan-300 mt-1 font-semibold">📲 Telegram notification sent to group</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPaidCelebration(false)}
              className="mt-4 px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
            >
              Show QR Again
            </button>
          </div>
        ) : rzpLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400">Generating Razorpay Dynamic QR...</span>
          </div>
        ) : numAmount > 0 && activeQrImage ? (
          <div className="flex flex-col items-center">
            {/* Crisp High-Contrast QR Card */}
            <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-white">
              <img
                src={activeQrImage}
                alt={`Locked UPI QR for ₹${numAmount}`}
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain block rounded-lg"
              />
            </div>

            {/* Mode-specific status pill */}
            {gateway === "razorpay" ? (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-500/50 text-cyan-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span>⚡ Auto-Detects &amp; Sends Telegram Alert</span>
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>🔒 ₹{numAmount.toLocaleString("en-IN")} Locked in Customer&apos;s UPI App</span>
              </div>
            )}

            {/* Supported App Badges */}
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-slate-400 font-semibold">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Google Pay</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">PhonePe</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">Paytm</span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">mPay</span>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-500">
            <span className="material-symbols-outlined text-5xl mb-2 block opacity-40">qr_code_2</span>
            <p className="text-sm font-semibold">Enter an amount above to generate QR</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="w-full mt-3 space-y-2">
        {numAmount > 0 && !paidCelebration && (
          <button
            type="button"
            onClick={triggerPaidChime}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer"
          >
            <span>✓</span>
            <span>Customer Paid ₹{numAmount.toLocaleString("en-IN")}</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={numAmount <= 0}
            className="py-2.5 px-3 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            <span>WhatsApp Link</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            disabled={numAmount <= 0}
            className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
            <span>{copied ? "Copied!" : "Copy UPI Link"}</span>
          </button>
        </div>
      </div>
    </main>
  );
}

export default function QuickQrPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <QuickQrContent />
    </Suspense>
  );
}
