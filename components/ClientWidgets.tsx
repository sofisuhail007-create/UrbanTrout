"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useCart } from "@/context/CartContext";

const CartDrawer = dynamic(() => import("@/components/CartDrawer"), { ssr: false });
const WhatsAppButton = dynamic(() => import("@/components/WhatsAppButton"), { ssr: false });
const LiveChatWidget = dynamic(() => import("@/components/LiveChatWidget"), { ssr: false });
const InstallPwaPrompt = dynamic(() => import("@/components/InstallPwaPrompt"), { ssr: false });
const PushNotificationPrompt = dynamic(() => import("@/components/PushNotificationPrompt"), { ssr: false });

export default function ClientWidgets() {
  const { isOpen } = useCart();
  const [loadDeferred, setLoadDeferred] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

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
  }, []);

  return (
    <>
      {isOpen && <CartDrawer />}
      {loadDeferred && (
        <>
          <WhatsAppButton />
          <LiveChatWidget />
          <InstallPwaPrompt />
          <PushNotificationPrompt />
        </>
      )}
    </>
  );
}
