"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState("");
  const isVerifyingRef = useRef(false);

  useEffect(() => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    async function handleAuth() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          setErrorMsg(sessionError.message || "Failed to retrieve authentication session.");
          return;
        }

        const nextParam = searchParams.get("next");
        const destination = nextParam && nextParam.startsWith("/") ? nextParam : "/account";

        if (session?.user) {
          router.replace(destination);
          return;
        }

        // Listen for auth state change if session hasn't settled yet
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
          if (currentSession?.user) {
            authListener.subscription.unsubscribe();
            router.replace(destination);
          }
        });

        const timer = setTimeout(() => {
          if (!session?.user) {
            setErrorMsg("Authentication session could not be established. Please try signing in again.");
          }
        }, 5000);

        return () => clearTimeout(timer);
      } catch (err: any) {
        setErrorMsg(err.message || "Unexpected authentication error occurred.");
      }
    }

    handleAuth();
  }, [router, searchParams]);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#031018] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#10212c] border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400 text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">
            Sign-in Incomplete
          </h2>
          <p className="text-sm text-slate-300 font-['Manrope']">{errorMsg}</p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => router.replace("/account")}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-wider hover:bg-cyan-400 transition-all cursor-pointer"
            >
              Try Again
            </button>
            <button
              onClick={() => router.replace("/")}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-medium text-xs hover:text-white transition-all cursor-pointer"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#031018] flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-3 border-cyan-400 border-t-transparent animate-spin mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-cyan-300 font-['Space_Grotesk'] tracking-wide">
            Securing Your Session…
          </h3>
          <p className="text-xs text-slate-400 font-['Manrope']">
            Redirecting you to Urban Trout
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CustomerAuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#031018] flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
