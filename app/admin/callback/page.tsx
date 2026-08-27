"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminAuthCallback() {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState("");
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    async function handleAuth() {
      try {
        // Retrieve current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setErrorMsg(sessionError.message || "Failed to retrieve authentication session.");
          return;
        }

        if (!session?.user?.email) {
          // Listen for onAuthStateChange if session is still processing URL hash
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession?.user?.email) {
              authListener.subscription.unsubscribe();
              validateAndRedirect(currentSession.user.email);
            }
          });

          // Timeout fallback
          setTimeout(() => {
            if (!session?.user?.email) {
              setErrorMsg("Authentication timed out or no user found. Please try again.");
            }
          }, 6000);
          return;
        }

        validateAndRedirect(session.user.email);
      } catch (err: any) {
        setErrorMsg(err.message || "Unexpected authentication error occurred.");
      }
    }

    async function validateAndRedirect(email: string) {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Check Hardcoded Root & Env Whitelist
      const rawEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "sofisuhail007@gmail.com";
      const envAllowed = rawEnv
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      let isAuthorized = cleanEmail === "sofisuhail007@gmail.com" || envAllowed.includes(cleanEmail);

      // 2. Also check dynamic DB whitelist from app_settings
      if (!isAuthorized) {
        try {
          const { data: settingRow } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "admin_whitelist")
            .single();

          if (settingRow?.value) {
            const dbAllowed = settingRow.value
              .split(",")
              .map((e: string) => e.trim().toLowerCase())
              .filter(Boolean);
            if (dbAllowed.includes(cleanEmail)) {
              isAuthorized = true;
            }
          }
        } catch (dbErr) {
          console.warn("Could not fetch DB admin whitelist:", dbErr);
        }
      }

      if (isAuthorized) {
        sessionStorage.setItem("ut_admin_auth", "1");
        sessionStorage.setItem("ut_admin_email", cleanEmail);
        router.replace("/admin/dashboard");
      } else {
        // Sign out unauthorized user immediately
        await supabase.auth.signOut();
        sessionStorage.removeItem("ut_admin_auth");
        sessionStorage.removeItem("ut_admin_email");
        setErrorMsg(
          `Access Denied: "${cleanEmail}" is not an authorized administrator. Please sign in with an approved Google account.`
        );
      }
    }

    handleAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#020d12] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md text-center">
        {errorMsg ? (
          <div className="bg-slate-900/90 border border-red-500/30 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">gpp_bad</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Access Denied
              </h2>
              <p className="text-red-300/90 text-xs leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                {errorMsg}
              </p>
            </div>
            <a
              href="/admin"
              className="inline-block w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all text-xs uppercase tracking-wider cursor-pointer"
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            >
              ← Back to Sign In
            </a>
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin mx-auto" />
            <div>
              <h3 className="text-lg font-bold text-white mb-1" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Verifying Admin Privileges…
              </h3>
              <p className="text-slate-400 text-xs" style={{ fontFamily: '"Manrope", sans-serif' }}>
                Authenticating with Google OAuth &amp; checking whitelist
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
