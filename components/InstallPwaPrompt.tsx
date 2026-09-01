"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // 2. Check if user dismissed prompt recently (snooze for 7 days)
    const dismissedAt = localStorage.getItem("ut_pwa_dismissed");
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // 3. Detect iOS WebKit
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 4. Listen for Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait 3 seconds after page load before showing prompt for better UX
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // If iOS and not standalone, show prompt after 4 seconds
    if (isIosDevice && !isStandaloneMode) {
      const iosTimer = setTimeout(() => {
        setShowPrompt(true);
      }, 4000);
      return () => clearTimeout(iosTimer);
    }

    // 5. Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIosGuide(false);
    localStorage.setItem("ut_pwa_dismissed", String(Date.now()));
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <>
      {/* ── Floating PWA Install Banner (Bottom Left on Desktop, Bottom Center on Mobile) ── */}
      <div
        className="fixed bottom-6 left-4 sm:left-6 z-40 max-w-[340px] sm:max-w-[380px] w-[90vw] p-3.5 sm:p-4 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-cyan-500/40 text-white shadow-2xl animate-slide-in-right"
        style={{
          boxShadow: "0 12px 36px -4px rgba(6, 182, 212, 0.35), 0 0 25px rgba(0,0,0,0.9)",
          fontFamily: '"Manrope", sans-serif',
        }}
      >
        <div className="flex items-start gap-3">
          {/* Glowing App Icon */}
          <div className="relative shrink-0 mt-0.5">
            <div className="w-11 h-11 rounded-xl bg-slate-900 border border-cyan-500/50 p-1.5 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <img
                src="/sitelogo.png"
                alt="Urban Trout App"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-slate-950 rounded-full animate-pulse" />
          </div>

          {/* Text Info */}
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h4
                className="text-xs font-bold text-white tracking-wide"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                Urban Trout App
              </h4>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                FAST
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug font-medium mb-2.5">
              Install our mobile app for fast 1-tap fresh catch ordering in Srinagar.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-[11px] uppercase tracking-wider transition-all duration-200 active:scale-95 shadow-md shadow-cyan-500/25 cursor-pointer"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                {isIos ? "Add to Phone 📲" : "Install App ⚡"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
              >
                Not now
              </button>
            </div>
          </div>

          {/* Dismiss Cross */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close install prompt"
            className="absolute top-2.5 right-2.5 text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── iOS 2-Step Installation Guide Modal ── */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full max-w-sm p-5 rounded-3xl bg-slate-950 border border-cyan-500/40 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: '"Manrope", sans-serif' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-cyan-500/40 p-1 flex items-center justify-center">
                  <img src="/sitelogo.png" alt="Urban Trout" className="w-full h-full object-contain" />
                </div>
                <h3 className="text-sm font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Install on iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Add Urban Trout to your iPhone Home Screen in 2 easy steps:
            </p>

            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs">
                  1
                </span>
                <p className="text-xs text-slate-200">
                  Tap the Safari <strong>Share</strong> button (
                  <svg className="inline w-4 h-4 text-cyan-400 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  ) at the bottom.
                </p>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs">
                  2
                </span>
                <p className="text-xs text-slate-200">
                  Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong> (➕).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
