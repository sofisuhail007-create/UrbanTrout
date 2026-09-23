"use client";

import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array, serializePushSubscription } from "@/lib/vapidKeys";
import toast from "react-hot-toast";

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

    // 3. Check snooze (3 days)
    const snoozedAt = localStorage.getItem("ut_push_snooze");
    if (snoozedAt) {
      const days = (Date.now() - Number(snoozedAt)) / (1000 * 60 * 60 * 24);
      if (days < 3) return;
    }

    // 4. Show gentle banner after 6 seconds
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, [user, savedProfile]);

  const syncExistingSubscription = async () => {
    try {
      if (!("serviceWorker" in navigator)) return;
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }

      // Safe ready promise with 5s timeout safeguard
      const readyTimeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout waiting for SW")), 5000)
      );
      const activeReg = (await Promise.race([navigator.serviceWorker.ready, readyTimeout]).catch(() => reg)) || reg;
      if (!activeReg || !activeReg.pushManager) return;

      let sub = await activeReg.pushManager.getSubscription();

      // If user previously granted permission on iOS but subscription got stuck, auto-create it now
      if (!sub && Notification.permission === "granted" && VAPID_PUBLIC_KEY) {
        try {
          sub = await activeReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        } catch (subErr) {
          console.warn("[PushPrompt] Auto-subscribe error:", subErr);
        }
      }

      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: serializePushSubscription(sub),
            phone: savedProfile?.phone,
            email: user?.email || savedProfile?.email,
            userId: user?.id,
          }),
        });
      }
    } catch (_) {}
  };

  const handleSubscribe = async () => {
    const vapidKey = VAPID_PUBLIC_KEY;
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

      // 2. Ensure Service Worker is registered & active (never hang on iOS)
      let registration: ServiceWorkerRegistration | undefined = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }

      const readyTimeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
        setTimeout(() => reject(new Error("Service Worker activation timeout. Please refresh and try again.")), 7000)
      );
      const activeReg = (await Promise.race([navigator.serviceWorker.ready, readyTimeout]).catch(() => registration)) || registration;

      if (!activeReg || !activeReg.pushManager) {
        throw new Error("Push notifications are not supported or ready on this browser.");
      }

      // 3. Subscribe to push manager
      let subscription = await activeReg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await activeReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      // 4. Send subscription to backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: serializePushSubscription(subscription),
          phone: savedProfile?.phone,
          email: user?.email || savedProfile?.email,
          userId: user?.id,
        }),
      });

      if (res.ok) {
        toast.success("Fresh catch alerts enabled! 🐟");
        setShowPrompt(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Could not register notifications.");
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
      className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 max-w-[360px] sm:max-w-[390px] w-[calc(100vw-2rem)] p-4 sm:p-5 rounded-3xl bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/40 text-white shadow-2xl animate-slide-in-right overflow-hidden"
      style={{
        boxShadow: "0 16px 40px -4px rgba(6, 182, 212, 0.35), 0 0 35px rgba(0,0,0,0.9)",
        fontFamily: '"Manrope", sans-serif',
      }}
    >
      {/* Ambient background glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Bar with Badge & Close Button */}
      <div className="relative flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <span>🎁</span> VIP TROUT CLUB
          </span>
          <span className="text-[10px] text-cyan-400 font-mono">Srinagar</span>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close notification prompt"
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="relative space-y-2">
        <h4 className="text-sm font-bold text-white tracking-tight font-['Space_Grotesk'] leading-snug">
          Don&apos;t miss the 7 AM morning catch! 🐟✨
        </h4>

        <p className="text-xs text-slate-300 leading-relaxed font-['Manrope']">
          Fresh Himalayan trout sells out in 90 minutes. Get 1-tap alerts when the live tanks harvest + unlock secret surprise flash perks!
        </p>

        <p className="text-[11px] text-slate-400 italic">
          (Zero spam: We hate spam as much as you hate dry chicken breast 🙅‍♂️)
        </p>

        {/* Psychological Two-Choice Buttons */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={isSubscribing}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all duration-200 active:scale-98 shadow-lg shadow-cyan-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            style={{ fontFamily: '"Space Grotesk", sans-serif' }}
          >
            {isSubscribing ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Unlocking VIP Perks…</span>
              </>
            ) : (
              <span>Yes, send me secret perks! 🐟⚡</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full text-center py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer font-medium"
          >
            Nah, I prefer boring frozen fish 🥶
          </button>
        </div>

        {/* Reassurance Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400 font-mono">
          <span>🛡️ 1-click unsubscribe anytime</span>
          <span>Max 2-3 fun alerts / week</span>
        </div>
      </div>
    </div>
  );
}
