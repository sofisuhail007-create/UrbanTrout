"use client";

import { supabase } from "@/lib/supabase";

/**
 * Client-side fetch helper for Admin Dashboard API calls.
 * Automatically attaches the Supabase Auth session token to the Authorization header.
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let token: string | undefined;

  try {
    const { data: { session } } = await supabase.auth.getSession();
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
