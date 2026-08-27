"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "admin@urbantrout.in";
const ADMIN_PASSWORD = "e1)P3z1}8t=7";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const router = useRouter();

  // ─── Google OAuth Sign-In ──────────────────────────────────────
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

  // ─── Password Fallback Login ───────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    await new Promise((r) => setTimeout(r, 600));
    if (email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      sessionStorage.setItem("ut_admin_auth", "1");
      sessionStorage.setItem("ut_admin_email", ADMIN_EMAIL);
      router.push("/admin/dashboard");
    } else {
      setError("Invalid credentials. Please use your authorized Google Account or correct password.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020d12] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <img
              src="/headerfooterlogo.png"
              alt="Urban Trout"
              className="h-10 w-auto object-contain"
            />
          </div>
          <p className="text-slate-500 text-xs uppercase tracking-[0.3em]" style={{ fontFamily: '"Manrope", sans-serif' }}>
            Admin Control Panel
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div>
            <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Sign In
            </h1>
            <p className="text-slate-500 text-sm" style={{ fontFamily: '"Manrope", sans-serif' }}>
              Restricted access — authorized personnel only
            </p>
          </div>

          {/* ─── GOOGLE SIGN-IN BUTTON (PRIMARY) ─── */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full py-3.5 px-4 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-bold rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.99] cursor-pointer"
            style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.95rem" }}
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
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 10.03 0 12s.46 3.83 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-[1px] bg-slate-800" />
            <span className="text-slate-600 text-xs font-semibold uppercase tracking-wider">or sign in with password</span>
            <div className="flex-1 h-[1px] bg-slate-800" />
          </div>

          {/* ─── EMAIL / PASSWORD FORM ─── */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2" style={{ fontFamily: '"Manrope", sans-serif' }}>
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@urbantrout.in"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-slate-400 mb-2" style={{ fontFamily: '"Manrope", sans-serif' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">{showPw ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <span className="material-symbols-outlined text-base flex-shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-900 disabled:text-cyan-700 text-slate-950 font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">refresh</span>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">login</span>
                  Sign In with Password
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-700 text-xs mt-6" style={{ fontFamily: '"Manrope", sans-serif' }}>
          © 2026 Urban Trout · Srinagar, J&amp;K
        </p>
      </div>
    </div>
  );
}
