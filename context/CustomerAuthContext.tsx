"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export interface SavedCustomerProfile {
  fullName: string;
  phone: string;
  email: string;
  locality: string;
  house: string;
  pincode: string;
  notes?: string;
}

interface CustomerAuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  savedProfile: SavedCustomerProfile | null;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signInWithEmail: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  saveCustomerProfile: (profile: SavedCustomerProfile) => void;
  clearSavedProfile: () => void;
}

const STORAGE_KEY = "ut_saved_customer_profile";

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedProfile, setSavedProfile] = useState<SavedCustomerProfile | null>(null);

  // 1. Load locally saved guest/customer address on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedProfile(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

  // 2. Listen to Supabase Auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrSyncCustomerProfile(session.user);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchOrSyncCustomerProfile(currentSession.user);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch or infer profile for logged in user
  const fetchOrSyncCustomerProfile = async (authUser: User) => {
    try {
      const meta = authUser.user_metadata || {};
      const userEmail = authUser.email || "";
      const userName = meta.full_name || meta.name || authUser.email?.split("@")[0] || "";
      const userPhone = meta.phone || "";

      setSavedProfile((prev) => {
        const updated: SavedCustomerProfile = {
          fullName: prev?.fullName || userName,
          phone: prev?.phone || userPhone,
          email: userEmail,
          locality: prev?.locality || "",
          house: prev?.house || "",
          pincode: prev?.pincode || "",
          notes: prev?.notes || "",
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    } catch (e) {
      console.warn("[CustomerAuth] Profile sync error:", e);
    }
  };

  // Save profile to localStorage & state
  const saveCustomerProfile = useCallback((profile: SavedCustomerProfile) => {
    setSavedProfile(profile);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (_) {}
  }, []);

  const clearSavedProfile = useCallback(() => {
    setSavedProfile(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, []);

  // ─── Google 1-Tap Sign In ──────────────────────────────────────
  const signInWithGoogle = async (redirectTo?: string) => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://urbantrout.in";
      const targetNext = redirectTo || (typeof window !== "undefined" ? window.location.pathname : "/account");
      const callbackUrl = `${origin}/auth/callback?next=${encodeURIComponent(targetNext)}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        toast.error(error.message || "Failed to start Google sign-in.");
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err: any) {
      toast.error(err.message || "Google sign-in error.");
    }
  };

  // ─── Email Sign In (Password or Magic Link) ────────────────────
  const signInWithEmail = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { success: false, error: error.message };
        if (data.user) {
          toast.success("Welcome back!");
          return { success: true };
        }
      } else {
        // Passwordless Magic Link / OTP
        const origin = typeof window !== "undefined" ? window.location.origin : "https://urbantrout.in";
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=/account`,
          },
        });
        if (error) return { success: false, error: error.message };
        toast.success("Magic sign-in link sent to your email!");
        return { success: true };
      }
      return { success: false, error: "Sign-in could not be completed." };
    } catch (err: any) {
      return { success: false, error: err.message || "Unexpected sign-in error." };
    }
  };

  // ─── Email Sign Up ─────────────────────────────────────────────
  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone ? phone.replace(/\D/g, "").slice(-10) : "",
          },
        },
      });

      if (error) return { success: false, error: error.message };

      if (data.user) {
        // Also save profile locally
        const newProfile: SavedCustomerProfile = {
          fullName,
          phone: phone ? phone.replace(/\D/g, "").slice(-10) : "",
          email,
          locality: "",
          house: "",
          pincode: "",
        };
        saveCustomerProfile(newProfile);
        toast.success("Account created successfully!");
        return { success: true };
      }
      return { success: false, error: "Sign-up could not be completed." };
    } catch (err: any) {
      return { success: false, error: err.message || "Sign-up error." };
    }
  };

  // ─── Sign Out ──────────────────────────────────────────────────
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      toast.success("Signed out successfully.");
    } catch (e: any) {
      toast.error(e.message || "Sign-out error.");
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        savedProfile,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        saveCustomerProfile,
        clearSavedProfile,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return ctx;
}
