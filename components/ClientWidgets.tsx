"use client";

import dynamic from "next/dynamic";

const CartDrawer = dynamic(() => import("@/components/CartDrawer"), { ssr: false });
const WhatsAppButton = dynamic(() => import("@/components/WhatsAppButton"), { ssr: false });
const LiveChatWidget = dynamic(() => import("@/components/LiveChatWidget"), { ssr: false });
const InstallPwaPrompt = dynamic(() => import("@/components/InstallPwaPrompt"), { ssr: false });

export default function ClientWidgets() {
  return (
    <>
      <CartDrawer />
      <WhatsAppButton />
      <LiveChatWidget />
      <InstallPwaPrompt />
    </>
  );
}
