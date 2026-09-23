"use client";

import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/adminClient";
import toast from "react-hot-toast";

interface SubscriberStats {
  totalSubscribers: number;
  sampleSubscribers: any[];
}

function getDeviceLabel(ua?: string) {
  if (!ua) return "Connected Device";
  if (/iphone/i.test(ua)) return "📱 Apple iPhone (iOS PWA)";
  if (/ipad/i.test(ua)) return "📱 Apple iPad (iOS PWA)";
  if (/android/i.test(ua)) return "🤖 Android Device";
  if (/windows/i.test(ua)) return "💻 Windows PC (Chrome/Edge)";
  if (/macintosh|mac os x/i.test(ua)) return "💻 Apple Mac (Safari/Chrome)";
  return "🌐 Web Browser Device";
}

const PRESET_TEMPLATES = [
  {
    name: "Morning Harvest",
    icon: "🐟",
    title: "Morning Harvest Alert 🐟",
    body: "Fresh Rainbow Trout just harvested at our Malabagh farm! Order now for rapid 2-hour chilled delivery across Srinagar.",
    url: "/shop",
  },
  {
    name: "Weekend Special",
    icon: "⚡",
    title: "Weekend BBQ Trout Special ⚡",
    body: "Fresh cold-water trout available for your weekend feast. Cleaned, gutted, and packed on ice to your doorstep.",
    url: "/shop/gutted-trout",
  },
  {
    name: "Live Tanks Restocked",
    icon: "🌊",
    title: "Live Aquarium Restocked 🌊",
    body: "Our high-density RAS tanks at Malabagh are fully stocked with fresh trout. Reserve your catch before stock runs out.",
    url: "/shop",
  },
  {
    name: "Express Delivery",
    icon: "🛵",
    title: "Express Chilled Delivery Today 🛵",
    body: "Order fresh trout before 4 PM today for immediate harvesting & dispatch within 90 minutes anywhere in Srinagar.",
    url: "/shop",
  },
];

export default function AdminNotificationsPage() {
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Form State
  const [title, setTitle] = useState(PRESET_TEMPLATES[0].title);
  const [body, setBody] = useState(PRESET_TEMPLATES[0].body);
  const [url, setUrl] = useState(PRESET_TEMPLATES[0].url);
  const [targetMode, setTargetMode] = useState<"broadcast" | "targeted">("broadcast");
  const [targetPhone, setTargetPhone] = useState("");

  const [isSending, setIsSending] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<any>(null);

  // Load subscriber stats
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await adminFetch("/api/push/send");
      const data = await res.json();
      if (data.success) {
        setStats(data);
      } else {
        console.warn("Failed to load subscriber stats:", data.error);
      }
    } catch (err: any) {
      console.warn("Error fetching subscriber stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const applyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setTitle(preset.title);
    setBody(preset.body);
    setUrl(preset.url);
    toast.success(`Loaded "${preset.name}" template`);
  };

  const handleSendPush = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Please enter a title and message body.");
      return;
    }

    if (targetMode === "targeted" && !targetPhone.trim()) {
      toast.error("Please enter the recipient phone number.");
      return;
    }

    const confirmMsg =
      targetMode === "broadcast"
        ? `Are you sure you want to broadcast this push notification to all ${stats?.totalSubscribers ?? "active"} subscribers?`
        : `Send targeted push notification to ${targetPhone}?`;

    if (!window.confirm(confirmMsg)) return;

    setIsSending(true);
    try {
      const res = await adminFetch("/api/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: targetMode,
          title,
          body,
          url,
          phone: targetMode === "targeted" ? targetPhone : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Push notification sent successfully! 🚀");
        setLastBroadcast({
          title,
          body,
          time: new Date().toLocaleTimeString(),
          sent: data.sent,
        });
        fetchStats();
      } else {
        toast.error(data.error || "Failed to send notification.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while sending push.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendLocalTest = async () => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      toast.error("Notifications not supported in this browser window.");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied on this device.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title || "Urban Trout Alert", {
        body: body || "Test push notification preview.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: url || "/" },
        vibrate: [100, 50, 100],
      } as any);

      toast.success("Test notification triggered on your screen!");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger test.");
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono tracking-widest text-cyan-400 uppercase">
              Web Push Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-['Space_Grotesk'] mt-1">
            Push Alerts &amp; Broadcast Center
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-['Manrope']">
            Send instant harvest alerts and promotion toasts to customers&apos; phone lock screens &amp; desktops.
          </p>
        </div>

        {/* Stats Chip & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-slate-900/80 border border-cyan-500/30 px-4 py-2.5 rounded-2xl shadow-lg">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-sm">
              🔔
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                Active Subscribers
              </p>
              <p className="text-lg font-black text-white font-['Space_Grotesk'] leading-tight">
                {loadingStats ? "…" : stats?.totalSubscribers ?? 0}{" "}
                <span className="text-xs text-cyan-400 font-normal">Devices</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchStats}
            disabled={loadingStats}
            title="Refresh subscriber count"
            className="w-10 h-10 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-base ${loadingStats ? "animate-spin text-cyan-400" : ""}`}>
              sync
            </span>
          </button>
        </div>
      </div>

      {/* ── Active Subscriber Devices Panel ── */}
      {stats && stats.totalSubscribers > 0 && (
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/20 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-['Space_Grotesk']">
                Connected Subscriber Devices ({stats.totalSubscribers})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Ready for Instant Web Push
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {stats.sampleSubscribers?.map((sub, idx) => {
              const deviceLabel = getDeviceLabel(sub.userAgent);
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate font-['Space_Grotesk']">
                      {deviceLabel}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                      {sub.phone ? `Phone: ${sub.phone}` : sub.email ? sub.email : "Customer PWA"}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                    Active ✓
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Preset Templates ── */}
      <div>
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 font-['Space_Grotesk']">
          Quick Preset Templates
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRESET_TEMPLATES.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset)}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/80 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-lg">{preset.icon}</span>
                <span className="text-[10px] text-cyan-400 group-hover:underline font-mono">Use ↵</span>
              </div>
              <p className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                {preset.name}
              </p>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                {preset.body}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Composer & Live Preview Grid ── */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Message Composer (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-white font-['Space_Grotesk']">
            Notification Composer
          </h2>

          {/* Target Audience Selector */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Audience
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetMode("broadcast")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  targetMode === "broadcast"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
                }`}
              >
                Broadcast to All ({stats?.totalSubscribers ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("targeted")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  targetMode === "targeted"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "bg-slate-900 text-slate-300 border border-slate-800 hover:text-white"
                }`}
              >
                Target Specific Customer
              </button>
            </div>
          </div>

          {targetMode === "targeted" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                Customer Phone Number (10 digits)
              </label>
              <input
                type="tel"
                maxLength={10}
                value={targetPhone}
                onChange={(e) => setTargetPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Notification Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Morning Harvest Alert 🐟"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
            />
          </div>

          {/* Message Body */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Message Text ({body.length} characters)
            </label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What should customers see on their lock screen?"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Destination URL */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              On-Click Destination URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/shop or /account"
              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSendPush}
              disabled={isSending}
              className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-lg shadow-cyan-500/25 active:scale-[0.99]"
            >
              {isSending ? "Sending Alert…" : targetMode === "broadcast" ? "Broadcast to All Subscribers 🚀" : "Send Customer Alert 📲"}
            </button>

            <button
              type="button"
              onClick={handleSendLocalTest}
              className="py-3 px-4 rounded-xl border border-slate-700 hover:border-cyan-500/50 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              Preview on My Screen 👁️
            </button>
          </div>
        </div>

        {/* Right: Live Device Mockup (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-['Space_Grotesk']">
              Live Lock Screen Preview
            </h3>

            {/* Simulated Phone Toast */}
            <div className="p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl space-y-2 backdrop-blur-xl">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <span className="w-3.5 h-3.5 rounded bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[9px] font-bold">
                    UT
                  </span>
                  <span className="text-slate-300 font-semibold">URBAN TROUT</span>
                </div>
                <span>now</span>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-cyan-500/40 p-1 flex items-center justify-center shrink-0">
                  <img src="/icon-192.png" alt="Urban Trout" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white tracking-wide leading-snug">
                    {title || "Notification Title"}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-3">
                    {body || "Message preview will appear here as you type in the composer."}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 text-[10px] text-slate-400">
                <span>Tapping opens: <strong className="text-cyan-400 font-mono">{url || "/shop"}</strong></span>
                <span className="text-cyan-400">Tap to view →</span>
              </div>
            </div>

            {/* Last Broadcast Report */}
            {lastBroadcast && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-slate-200 space-y-1">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span> Last Broadcast Sent at {lastBroadcast.time}
                </p>
                <p className="text-[11px] text-slate-300">
                  Delivered to <strong>{lastBroadcast.sent}</strong> device(s).
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
