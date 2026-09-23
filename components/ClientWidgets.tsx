"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { isDistractionFreeSession } from "@/lib/adTrafficShield";

const CartDrawer = dynamic(() => import("@/components/CartDrawer"), { ssr: false });
const StickyMobileOrderBar = dynamic(() => import("@/components/StickyMobileOrderBar"), { ssr: false });
const WhatsAppButton = dynamic(() => import("@/components/WhatsAppButton"), { ssr: false });
const LiveChatWidget = dynamic(() => import("@/components/LiveChatWidget"), { ssr: false });
const InstallPwaPrompt = dynamic(() => import("@/components/InstallPwaPrompt"), { ssr: false });
const PushNotificationPrompt = dynamic(() => import("@/components/PushNotificationPrompt"), { ssr: false });

export default function ClientWidgets() {
  const pathname = usePathname();
  const { isOpen } = useCart();
  const [loadDeferred, setLoadDeferred] = useState(false);
  const [isAdTraffic, setIsAdTraffic] = useState(false);

  const isCheckoutOrAdmin =
    pathname?.startsWith("/checkout") ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/invoice");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if user came from a paid ad campaign (Meta, Google, etc.) or is in an in-app browser
    setIsAdTraffic(isDistractionFreeSession());

    // Immediately register Service Worker so PWA & push alerts are always ready
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    if ("requestIdleCallback" in window) {
      const handle = (window as any).requestIdleCallback(
        () => setLoadDeferred(true),
        { timeout: 3000 }
      );
      return () => (window as any).cancelIdleCallback?.(handle);
    } else {
      const timer = setTimeout(() => setLoadDeferred(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <>
      {isOpen && <CartDrawer />}
      <StickyMobileOrderBar />
      {loadDeferred && !isCheckoutOrAdmin && (
        <>
          <WhatsAppButton />
          <LiveChatWidget />
          {/* ZERO POPUP DISTRACTIONS for Paid Ad traffic or in-app browsers */}
          {!isAdTraffic && (
            <>
              <InstallPwaPrompt />
              <PushNotificationPrompt />
            </>
          )}
        </>
      )}
    </>
  );
}
