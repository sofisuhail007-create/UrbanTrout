"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

interface AnalyticsDeferredProps {
  fbPixelId?: string;
  gaMeasurementId?: string;
}

export default function AnalyticsDeferred({
  fbPixelId,
  gaMeasurementId,
}: AnalyticsDeferredProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Initialize dataLayer and gtag early stub so custom events don't throw errors
    if (gaMeasurementId) {
      window.dataLayer = window.dataLayer || [];
      if (!window.gtag) {
        window.gtag = function (...args: unknown[]) {
          window.dataLayer?.push(args);
        };
        window.gtag("js", new Date());
        window.gtag("config", gaMeasurementId, {
          page_path: window.location.pathname,
        });
      }
    }

    // 2. Initialize fbq early stub so fbEvent/fbAddToCart/fbPurchase queue immediately
    if (fbPixelId && !(window as any).fbq) {
      const fbqStub: any = function (...args: unknown[]) {
        if (fbqStub.callMethod) {
          fbqStub.callMethod.apply(fbqStub, args);
        } else {
          fbqStub.queue = fbqStub.queue || [];
          fbqStub.queue.push(args);
        }
      };
      fbqStub.push = fbqStub;
      fbqStub.loaded = true;
      fbqStub.version = "2.0";
      fbqStub.queue = [];
      (window as any).fbq = fbqStub;
      (window as any)._fbq = fbqStub;
      (window as any).fbq("init", fbPixelId);
      (window as any).fbq("track", "PageView");
    }

    // 3. Load heavy 3rd-party remote scripts only on user interaction or idle time
    let loaded = false;
    const loadScripts = () => {
      if (loaded) return;
      loaded = true;

      cleanup();

      // Load GA4
      if (gaMeasurementId && !document.getElementById("gtag-script")) {
        const gaScript = document.createElement("script");
        gaScript.id = "gtag-script";
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
        gaScript.async = true;
        document.head.appendChild(gaScript);
      }

      // Load Facebook Pixel
      if (fbPixelId && !document.getElementById("fb-pixel-script")) {
        const fbScript = document.createElement("script");
        fbScript.id = "fb-pixel-script";
        fbScript.src = "https://connect.facebook.net/en_US/fbevents.js";
        fbScript.async = true;
        document.head.appendChild(fbScript);
      }
    };

    const events = ["scroll", "touchstart", "pointerdown", "keydown"] as const;
    const onInteract = () => {
      loadScripts();
    };

    events.forEach((ev) => {
      window.addEventListener(ev, onInteract, { passive: true, once: true });
    });

    let idleId: number | null = null;
    let timerId: NodeJS.Timeout | null = null;

    if ("requestIdleCallback" in window) {
      idleId = (window as any).requestIdleCallback(loadScripts, { timeout: 4500 });
    } else {
      timerId = setTimeout(loadScripts, 4500);
    }

    function cleanup() {
      events.forEach((ev) => {
        window.removeEventListener(ev, onInteract);
      });
      if (idleId && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timerId) {
        clearTimeout(timerId);
      }
    }

    return () => {
      cleanup();
    };
  }, [fbPixelId, gaMeasurementId]);

  return null;
}
