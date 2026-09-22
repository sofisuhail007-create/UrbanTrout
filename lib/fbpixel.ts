/**
 * Facebook Pixel utility — Urban Trout
 * Wraps window.fbq with TypeScript safety and deduplication guard.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

/** Fire a standard Pixel event (PageView, AddToCart, InitiateCheckout …) */
export function fbEvent(name: string, options?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", name, options);
}

/** Fire a custom Pixel event */
export function fbCustomEvent(name: string, options?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("trackCustom", name, options);
}

/**
 * Track a confirmed purchase.
 * Call this ONCE after the order is fully confirmed.
 */
export function fbPurchase({
  value,
  currency = "INR",
  contentName,
  contentIds,
  numItems,
}: {
  value: number;
  currency?: string;
  contentName?: string;
  contentIds?: string[];
  numItems?: number;
}) {
  fbEvent("Purchase", {
    value,
    currency,
    content_name: contentName,
    content_ids: contentIds,
    num_items: numItems,
    content_type: "product",
  });
}

/** Track when a user views a product */
export function fbViewContent({
  value,
  contentName,
  contentIds,
}: {
  value: number;
  contentName: string;
  contentIds?: string[];
}) {
  fbEvent("ViewContent", {
    value,
    currency: "INR",
    content_name: contentName,
    content_ids: contentIds,
    content_type: "product",
  });
}

/** Track when user adds an item to cart */
export function fbAddToCart({
  value,
  contentName,
  contentId,
}: {
  value: number;
  contentName: string;
  contentId?: string;
}) {
  fbEvent("AddToCart", {
    value,
    currency: "INR",
    content_name: contentName,
    content_ids: contentId ? [contentId] : undefined,
    content_type: "product",
  });
}

/** Track when a user begins checkout */
export function fbInitiateCheckout({
  value,
  numItems,
}: {
  value: number;
  numItems?: number;
}) {
  fbEvent("InitiateCheckout", {
    value,
    currency: "INR",
    num_items: numItems,
    content_type: "product",
  });
}
