"use client";

import { supabase } from "@/lib/supabase";

/**
 * Client-side fetch helper for Admin Dashboard API calls.
 * Automatically attaches the Supabase Auth session token to the Authorization header.
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let token: string | undefined;

  try {
    let { data: { session } } = await supabase.auth.getSession();
    // Proactively refresh if token expires within 2 minutes
    if (!session?.access_token || (session.expires_at && session.expires_at * 1000 < Date.now() + 120000)) {
      const refreshRes = await supabase.auth.refreshSession();
      if (refreshRes.data?.session) {
        session = refreshRes.data.session;
      }
    }
    token = session?.access_token;
  } catch (_) {}

  const headers = new Headers(init?.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
