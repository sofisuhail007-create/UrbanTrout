"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  // ─── Google OAuth Sign-In (Exclusive Auth Method) ─────────────
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://urbantrout.in";
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/admin/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setGoogleLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize Google Sign-In.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020d12] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/headerfooterlogo.png"
              alt="Urban Trout"
              className="h-11 w-auto object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold tracking-widest uppercase mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            Admin Control Panel
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-900/85 border border-slate-800 rounded-3xl p-8 md:p-10 backdrop-blur-xl shadow-2xl space-y-6 text-center">
          <div>
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center mx-auto mb-4 text-cyan-400">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Authorized Sign In
            </h1>
            <p className="text-slate-400 text-xs leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
              Restricted management console for Urban Trout operations. Sign in with your whitelisted Google account.
            </p>
          </div>

          {/* ─── GOOGLE SIGN-IN BUTTON ─── */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full py-4 px-6 bg-white hover:bg-slate-100 active:scale-[0.98] disabled:opacity-60 text-slate-900 font-bold rounded-2xl transition-all flex items-center justify-center gap-3.5 shadow-xl shadow-white/5 cursor-pointer"
            style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1rem" }}
          >
            {googleLoading ? (
              <>
                <svg className="w-5 h-5 animate-spin text-slate-900" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>Connecting to Google…</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 10.03 0 12s.46 3.83 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-left">
              <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Security Notice */}
          <div className="pt-2 border-t border-slate-800/80">
            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-cyan-500">lock</span>
              Protected by Google OAuth 2.0 &amp; Supabase RBAC
            </p>
          </div>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6" style={{ fontFamily: '"Manrope", sans-serif' }}>
          © 2026 Urban Trout Aquaculture · Srinagar, J&amp;K
        </p>
      </div>
    </div>
  );
}
