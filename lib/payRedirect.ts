import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SHORT_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const SHORT_PREFIX = "cf_short_";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function randomShortCode(length = 5): string {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += SHORT_ALPHABET[bytes[i] % SHORT_ALPHABET.length];
  }
  return code;
}

/**
 * Maps a long Cashfree link slug (e.g. "Fbchrjiqd9i0_AAAAAAAVSuc") to a short
 * 5-char code in `app_settings` and returns `https://urbantrout.in/p/<code>`.
 * Falls back cleanly to the unshortened slug URL if Supabase is unavailable.
 */
export async function createShortCashfreeUrl(
  cfSlug: string,
  baseOrigin = "https://urbantrout.in"
): Promise<string> {
  const cleanSlug = String(cfSlug || "").trim();
  const base = baseOrigin.replace(/\/+$/, "");
  if (!cleanSlug) return `${base}/shop`;

  try {
    const supabase = getAdminSupabase();
    if (supabase) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const code = randomShortCode(5);
        const { error } = await supabase.from("app_settings").insert({
          key: `${SHORT_PREFIX}${code}`,
          value: cleanSlug,
          description: "Short Cashfree Payment Link Redirect",
          updated_at: new Date().toISOString(),
        });
        if (!error) {
          return `${base}/p/${code}`;
        }
      }
    }
  } catch (err) {
    console.warn("[createShortCashfreeUrl] Fallback to full slug:", err);
  }

  return `${base}/p/${cleanSlug}`;
}

/**
 * Shared resolver for both `/p/[slug]` and legacy `/pay/[slug]` redirect routes.
 */
export async function resolvePaySlugRedirect(
  requestUrl: string,
  rawSlug: string
): Promise<NextResponse> {
  const cleanSlug = (rawSlug || "").trim();

  if (!cleanSlug) {
    return NextResponse.redirect(new URL("/shop", requestUrl), 307);
  }

  // 1. Short-code lookup in Supabase `app_settings` (e.g. `k7m4p` -> `cf_short_k7m4p`)
  if (/^[a-zA-Z0-9]{4,10}$/.test(cleanSlug) && !cleanSlug.toUpperCase().startsWith("UT-")) {
    try {
      const supabase = getAdminSupabase();
      if (supabase) {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", `${SHORT_PREFIX}${cleanSlug}`)
          .maybeSingle();

        const targetSlug = typeof data?.value === "string" ? data.value.trim() : "";
        if (targetSlug) {
          return NextResponse.redirect(`https://payments.cashfree.com/links/${targetSlug}`, 307);
        }
      }
    } catch (err) {
      console.warn("[resolvePaySlugRedirect] Short code lookup warning:", err);
    }
  }

  // 2. Direct Cashfree Link Slug (e.g. Fbchrjiqd9i0_AAAAAAAVSuc)
  const isCashfreeSlug = /^[a-zA-Z0-9_\-]{16,}$/.test(cleanSlug);
  if (isCashfreeSlug && !cleanSlug.toUpperCase().startsWith("UT-")) {
    return NextResponse.redirect(`https://payments.cashfree.com/links/${cleanSlug}`, 307);
  }

  // 3. Order Reference Slug (e.g. UT-CF-VERIFY-1 or UT-WA-12345)
  if (cleanSlug.toUpperCase().startsWith("UT-") || /^\d{4,8}$/.test(cleanSlug)) {
    try {
      const supabase = getAdminSupabase();
      if (supabase) {
        const { data: order } = await supabase
          .from("orders")
          .select("id, order_number, notes, delivery_notes")
          .or(`order_number.eq.${cleanSlug},id.eq.${cleanSlug}`)
          .maybeSingle();

        if (order) {
          const notesStr = `${order.notes || ""} ${order.delivery_notes || ""}`;
          const cfMatch = notesStr.match(/https:\/\/payments\.cashfree\.com\/links\/([a-zA-Z0-9_\-]+)/i);
          if (cfMatch) {
            return NextResponse.redirect(cfMatch[0], 307);
          }
        }
      }
    } catch (err) {
      console.warn("[resolvePaySlugRedirect] Order lookup notice:", err);
    }

    return NextResponse.redirect(new URL(`/qr?ord=${encodeURIComponent(cleanSlug)}`, requestUrl), 307);
  }

  // 4. Legacy Cashfree link ID / generic fallback
  if (cleanSlug.startsWith("link_") || cleanSlug.startsWith("cf_")) {
    return NextResponse.redirect(`https://payments.cashfree.com/links/${cleanSlug}`, 307);
  }

  return NextResponse.redirect(new URL(`/qr?ord=${encodeURIComponent(cleanSlug)}`, requestUrl), 307);
}
