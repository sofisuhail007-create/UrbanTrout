import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServer = createClient(supabaseUrl, supabaseKey);

// Whitelisted owner emails
const DEFAULT_ALLOWED_EMAILS = [
  "sofisuhail007@gmail.com",
  "info.urbantrout@gmail.com",
];

/**
 * Validates that an API request comes from an authorized admin session.
 * Checks for:
 * 1. An 'x-admin-token' matching ADMIN_API_SECRET
 * 2. A Supabase Auth Bearer token from an authorized user email
 */
export async function requireAdminAuth(request: Request): Promise<NextResponse | null> {
  // 1. Secret token header check (for cron / external webhooks / scripts)
  const adminSecret = process.env.ADMIN_API_SECRET;
  const tokenHeader = request.headers.get("x-admin-token");
  if (adminSecret && tokenHeader === adminSecret) {
    return null; // Authorized
  }

  // 2. Supabase Auth Bearer Token Check
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  let bearerToken: string | null = null;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    bearerToken = authHeader.substring(7).trim();
  }

  if (bearerToken) {
    try {
      const { data: { user }, error } = await supabaseServer.auth.getUser(bearerToken);
      if (!error && user && user.email) {
        const userEmail = user.email.toLowerCase().trim();

        // 2a. Primary whitelisted owners
        if (DEFAULT_ALLOWED_EMAILS.includes(userEmail)) {
          return null; // Authorized
        }

        // 2b. Check database staff_permissions or admin_whitelist
        try {
          const { data: staffRow } = await supabaseServer
            .from("app_settings")
            .select("value")
            .eq("key", "staff_permissions")
            .maybeSingle();

          if (staffRow?.value) {
            const parsed = JSON.parse(staffRow.value);
            if (Array.isArray(parsed) && parsed.some((s: any) => s.email?.toLowerCase() === userEmail)) {
              return null; // Authorized staff member
            }
          }

          const { data: whitelistRow } = await supabaseServer
            .from("app_settings")
            .select("value")
            .eq("key", "admin_whitelist")
            .maybeSingle();

          if (whitelistRow?.value) {
            const allowed = whitelistRow.value.split(",").map((e: string) => e.trim().toLowerCase());
            if (allowed.includes(userEmail)) {
              return null; // Authorized whitelist
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.warn("[adminAuth] Bearer token verification error:", err);
    }
  }

  return NextResponse.json(
    { success: false, error: "Unauthorized: Admin access required." },
    { status: 401 }
  );
}
