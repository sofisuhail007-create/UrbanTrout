import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from "./vapidKeys";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseKey);

// ─── Initialize VAPID Keys ────────────────────────────────────────────
const vapidPublicKey = VAPID_PUBLIC_KEY;
const vapidPrivateKey = VAPID_PRIVATE_KEY;
const vapidSubject = VAPID_SUBJECT;

let isVapidConfigured = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isVapidConfigured = true;
  } catch (err) {
    console.error("[pushNotifications] Failed to initialize VAPID:", err);
  }
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
}

export interface StoredSubscription {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  user_agent?: string | null;
  created_at?: string;
  last_used_at?: string;
}

// ─── Save Subscription (Table + App Settings Fallback) ────────────────
export async function savePushSubscription(
  sub: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  },
  meta?: {
    phone?: string | null;
    email?: string | null;
    userId?: string | null;
    userAgent?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const cleanPhone = meta?.phone ? String(meta.phone).replace(/\D/g, "").slice(-10) : null;
  const cleanEmail = meta?.email ? String(meta.email).trim().toLowerCase() : null;

  const payload: StoredSubscription = {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    customer_phone: cleanPhone,
    customer_email: cleanEmail,
    user_id: meta?.userId || null,
    user_agent: meta?.userAgent || null,
    last_used_at: new Date().toISOString(),
  };

  // 1. Try push_subscriptions table
  try {
    const { error } = await supabaseServer
      .from("push_subscriptions")
      .upsert(payload, { onConflict: "endpoint" });

    if (!error) return { success: true };
  } catch (_) {}

  // 2. Fallback to app_settings key 'push_subscriptions_data'
  try {
    const { data: existingRow } = await supabaseServer
      .from("app_settings")
      .select("value")
      .eq("key", "push_subscriptions_data")
      .maybeSingle();

    let list: StoredSubscription[] = [];
    if (existingRow?.value) {
      try {
        list = JSON.parse(existingRow.value);
      } catch (_) {}
    }

    // Replace existing or append
    const idx = list.findIndex((item) => item.endpoint === sub.endpoint);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...payload };
    } else {
      list.push(payload);
    }

    await supabaseServer.from("app_settings").upsert({
      key: "push_subscriptions_data",
      value: JSON.stringify(list),
      description: "Fallback active Web Push subscriptions",
      updated_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (err: any) {
    console.error("[pushNotifications] Failed to save subscription fallback:", err);
    return { success: false, error: err.message };
  }
}

// ─── Delete Subscription ──────────────────────────────────────────────
export async function removePushSubscription(endpoint: string): Promise<void> {
  try {
    await supabaseServer.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch (_) {}

  try {
    const { data: existingRow } = await supabaseServer
      .from("app_settings")
      .select("value")
      .eq("key", "push_subscriptions_data")
      .maybeSingle();

    if (existingRow?.value) {
      const list: StoredSubscription[] = JSON.parse(existingRow.value);
      const filtered = list.filter((item) => item.endpoint !== endpoint);
      await supabaseServer.from("app_settings").upsert({
        key: "push_subscriptions_data",
        value: JSON.stringify(filtered),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (_) {}
}

// ─── Get Active Subscriptions ─────────────────────────────────────────
export async function getActiveSubscriptions(): Promise<StoredSubscription[]> {
  // Try table first
  try {
    const { data, error } = await supabaseServer
      .from("push_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (_) {}

  // Fallback to app_settings
  try {
    const { data } = await supabaseServer
      .from("app_settings")
      .select("value")
      .eq("key", "push_subscriptions_data")
      .maybeSingle();

    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (_) {}

  return [];
}

// ─── Send Push to Single Subscription ────────────────────────────────
export async function sendPushToSubscription(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<boolean> {
  if (!isVapidConfigured) {
    console.warn("[pushNotifications] VAPID keys not configured in environment.");
    return false;
  }

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };

  const notificationData = JSON.stringify({
    title: payload.title || "Urban Trout 🐟",
    body: payload.body,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    url: payload.url || "/shop",
    image: payload.image || undefined,
    tag: payload.tag || "urban-trout",
  });

  try {
    await webpush.sendNotification(pushSubscription, notificationData, {
      TTL: 60 * 60 * 24, // 24 hours
    });
    return true;
  } catch (err: any) {
    // 404 or 410 means subscription expired or uninstalled
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log("[pushNotifications] Pruning expired subscription:", sub.endpoint);
      await removePushSubscription(sub.endpoint);
    } else {
      console.error("[pushNotifications] Error sending notification:", err.message);
    }
    return false;
  }
}

// ─── Send Targeted Push to Specific Customer ─────────────────────────
export async function sendPushToCustomer(params: {
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
  title: string;
  body: string;
  url?: string;
}): Promise<{ sent: number; total: number }> {
  const allSubs = await getActiveSubscriptions();
  const cleanPhone = params.phone ? String(params.phone).replace(/\D/g, "").slice(-10) : null;
  const cleanEmail = params.email ? String(params.email).trim().toLowerCase() : null;

  const targetSubs = allSubs.filter((sub) => {
    if (params.userId && sub.user_id === params.userId) return true;
    if (cleanPhone && sub.customer_phone === cleanPhone) return true;
    if (cleanEmail && sub.customer_email === cleanEmail) return true;
    return false;
  });

  let sent = 0;
  for (const sub of targetSubs) {
    const ok = await sendPushToSubscription(sub, {
      title: params.title,
      body: params.body,
      url: params.url || "/account",
    });
    if (ok) sent++;
  }

  return { sent, total: targetSubs.length };
}

// ─── Broadcast to All Active Subscribers ──────────────────────────────
export async function broadcastPushToAll(payload: PushPayload): Promise<{
  sent: number;
  failed: number;
  total: number;
}> {
  const allSubs = await getActiveSubscriptions();
  if (allSubs.length === 0) {
    return { sent: 0, failed: 0, total: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Send in parallel chunks of 10
  const CHUNK_SIZE = 10;
  for (let i = 0; i < allSubs.length; i += CHUNK_SIZE) {
    const chunk = allSubs.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((sub) => sendPushToSubscription(sub, payload))
    );
    results.forEach((ok) => {
      if (ok) sent++;
      else failed++;
    });
  }

  return { sent, failed, total: allSubs.length };
}
