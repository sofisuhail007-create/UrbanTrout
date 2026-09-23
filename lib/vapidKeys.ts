// ─── Urban Trout VAPID Keypair for Web Push (RFC 8291/8292) ───────────
// These keys authenticate and encrypt browser push notifications delivered to Chrome, Safari, Android & iOS.
// Environment variables in Vercel / .env.local take precedence if specified.

export const DEFAULT_VAPID_PUBLIC_KEY =
  "BC0i2x-GIhDkQLL80sJxbY8SWXakV-jx8h_PPas8NukE7EkmGeOCABq5fyE4-Dhs2M6DU9GjmCR0wBB3_E2hOp4";

export const DEFAULT_VAPID_PRIVATE_KEY =
  "XUj19mdwOX6ncxXm6MM-ZNW8uKs2rPRU4UmitKscX-E";

export const DEFAULT_VAPID_SUBJECT = "mailto:info.urbantrout@gmail.com";

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;

export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || DEFAULT_VAPID_PRIVATE_KEY;

export const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;

export function urlBase64ToUint8Array(base64String: string): any {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData =
    typeof window !== "undefined"
      ? window.atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function serializePushSubscription(sub: PushSubscription): any {
  const json = sub.toJSON();
  const keys: { p256dh?: string; auth?: string } = { ...json.keys };

  if (!keys.p256dh && typeof sub.getKey === "function") {
    try {
      const rawKey = sub.getKey("p256dh");
      if (rawKey) {
        const arr = new Uint8Array(rawKey);
        let binary = "";
        for (let i = 0; i < arr.length; i++) {
          binary += String.fromCharCode(arr[i]);
        }
        keys.p256dh = btoa(binary);
      }
    } catch (_) {}
  }

  if (!keys.auth && typeof sub.getKey === "function") {
    try {
      const rawAuth = sub.getKey("auth");
      if (rawAuth) {
        const arr = new Uint8Array(rawAuth);
        let binary = "";
        for (let i = 0; i < arr.length; i++) {
          binary += String.fromCharCode(arr[i]);
        }
        keys.auth = btoa(binary);
      }
    } catch (_) {}
  }

  return {
    endpoint: sub.endpoint,
    expirationTime: sub.expirationTime,
    keys,
  };
}
