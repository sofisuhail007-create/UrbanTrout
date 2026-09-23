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
