"use client";

import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import toast from "react-hot-toast";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PushNotificationPrompt() {
  const { user, savedProfile } = useCustomerAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // 1. Verify browser support
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);
    if (!supported) return;

    // 2. If already granted or blocked, don't show initial opt-in banner
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      // Sync subscription with phone/email if already granted
      if (Notification.permission === "granted") {
        syncExistingSubscription();
      }
      return;
    }

    // 3. Check snooze (7 days)
    const snoozedAt = localStorage.getItem("ut_push_snooze");
    if (snoozedAt) {
      const days = (Date.now() - Number(snoozedAt)) / (1000 * 60 * 60 * 24);
      if (days < 7) return;
    }

    // 4. Show gentle banner after 6 seconds
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, [user, savedProfile]);

  const syncExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: sub.toJSON(),
            phone: savedProfile?.phone,
            email: user?.email || savedProfile?.email,
            userId: user?.id,
          }),
        });
      }
    } catch (_) {}
  };

  const handleSubscribe = async () => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast.error("Push service is currently being configured.");
      return;
    }

    setIsSubscribing(true);

    try {
      // 1. Request native browser notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast("Notifications not enabled. You can enable them anytime in site settings.", { icon: "ℹ️" });
        setShowPrompt(false);
        setIsSubscribing(false);
        return;
      }

      // 2. Wait for active Service Worker
      const registration = await navigator.serviceWorker.ready;

      // 3. Subscribe to push manager
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      // 4. Send subscription to backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          phone: savedProfile?.phone,
          email: user?.email || savedProfile?.email,
          userId: user?.id,
        }),
      });

      if (res.ok) {
        toast.success("Fresh catch alerts enabled! 🐟");
        setShowPrompt(false);
      } else {
        toast.error("Could not register notifications.");
      }
    } catch (err: any) {
      console.error("Push subscription error:", err);
      toast.error(err.message || "Failed to enable notifications.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("ut_push_snooze", String(Date.now()));
  };

  if (!isSupported || !showPrompt) return null;

  return (
    <div
      className="fixed bottom-6 right-4 sm:right-6 z-40 max-w-[340px] sm:max-w-[380px] w-[90vw] p-4 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 text-white shadow-2xl animate-slide-in-right"
      style={{
        boxShadow: "0 12px 36px -4px rgba(6, 182, 212, 0.35), 0 0 25px rgba(0,0,0,0.9)",
        fontFamily: '"Manrope", sans-serif',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Bell Icon with Pulse */}
        <div className="relative shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-cyan-500/50 flex items-center justify-center text-cyan-300 text-lg shadow-lg shadow-cyan-500/20">
            🔔
          </div>
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 border-2 border-slate-950 rounded-full animate-ping" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-1.5 mb-1">
            <h4 className="text-xs font-bold text-white tracking-wide font-['Space_Grotesk']">
              Morning Catch Alerts
            </h4>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              NEW
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug font-medium mb-3">
            Get instant alerts when fresh Rainbow Trout is harvested at our Malabagh farm &amp; track your delivery live.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-[11px] uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-md shadow-cyan-500/25 cursor-pointer disabled:opacity-50"
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            >
              {isSubscribing ? "Enabling…" : "Enable Alerts ⚡"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
            >
              Later
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close notification prompt"
          className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
