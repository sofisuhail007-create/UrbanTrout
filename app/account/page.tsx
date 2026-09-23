"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCustomerAuth, SavedCustomerProfile } from "@/context/CustomerAuthContext";
import { useCart } from "@/context/CartContext";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array, serializePushSubscription } from "@/lib/vapidKeys";
import toast from "react-hot-toast";

const SRINAGAR_LOCALITIES = [
  "Malabagh",
  "Naseem Bagh",
  "Hazratbal",
  "Habak",
  "Zakura",
  "Lal Bazar",
  "Soura",
  "Illahi Bagh",
  "Buchpora",
  "Ahmad Nagar",
  "Umer Colony",
  "Sadarbal",
  "Nigeen",
  "Zadibal",
  "Hawal",
  "Rajbagh",
  "Jawahar Nagar",
  "Lal Chowk",
  "Karan Nagar",
  "Hyderpora",
  "Sanat Nagar",
  "Other Area (Srinagar)",
];

export default function CustomerAccountPage() {
  const router = useRouter();
  const {
    user,
    session,
    isLoading: authLoading,
    savedProfile,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    saveCustomerProfile,
  } = useCustomerAuth();

  const { addItem, openCart } = useCart();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"orders" | "address" | "notifications">("orders");

  // Push Notifications state
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  // Orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersFetched, setOrdersFetched] = useState(false);

  // Guest phone lookup
  const [guestPhone, setGuestPhone] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");

  // Auth form state
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Address edit state
  const [addressForm, setAddressForm] = useState<SavedCustomerProfile>({
    fullName: "",
    phone: "",
    email: "",
    locality: "",
    house: "",
    pincode: "190006",
    notes: "",
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Sync profile into addressForm
  useEffect(() => {
    if (savedProfile) {
      setAddressForm({
        fullName: savedProfile.fullName || "",
        phone: savedProfile.phone || "",
        email: savedProfile.email || user?.email || "",
        locality: savedProfile.locality || "",
        house: savedProfile.house || "",
        pincode: savedProfile.pincode || "190006",
        notes: savedProfile.notes || "",
      });
      if (savedProfile.phone && !lookupPhone) {
        setLookupPhone(savedProfile.phone);
      }
    } else if (user) {
      const meta = user.user_metadata || {};
      setAddressForm((prev) => ({
        ...prev,
        fullName: meta.full_name || meta.name || user.email?.split("@")[0] || "",
        email: user.email || "",
        phone: meta.phone || "",
      }));
    }
  }, [savedProfile, user, lookupPhone]);

  // Fetch orders from API
  const fetchOrders = useCallback(async (phoneToSearch?: string) => {
    setLoadingOrders(true);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const params = new URLSearchParams();
      const targetPhone = phoneToSearch || lookupPhone || savedProfile?.phone;
      if (targetPhone) {
        params.set("phone", targetPhone.replace(/\D/g, "").slice(-10));
      }

      const url = `/api/customer/orders${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { headers });
      const data = await res.json();

      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        setOrders([]);
      }
    } catch (e) {
      console.warn("Error fetching customer orders:", e);
      setOrders([]);
    } finally {
      setLoadingOrders(false);
      setOrdersFetched(true);
    }
  }, [session, lookupPhone, savedProfile]);

  useEffect(() => {
    if (!authLoading && (user || lookupPhone || savedProfile?.phone)) {
      fetchOrders();
    }
  }, [authLoading, user, lookupPhone, savedProfile, fetchOrders]);

  // Handle Guest Lookup
  const handleGuestLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = guestPhone.replace(/\D/g, "").slice(-10);
    if (clean.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    setLookupPhone(clean);
    fetchOrders(clean);
  };

  // Handle Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) {
      toast.error("Please enter your email.");
      return;
    }
    setAuthSubmitting(true);

    try {
      if (authMode === "signin") {
        const res = await signInWithEmail(authEmail, authPassword || undefined);
        if (!res.success) {
          toast.error(res.error || "Sign-in failed.");
        }
      } else {
        if (!authPassword || authPassword.length < 6) {
          toast.error("Password must be at least 6 characters.");
          setAuthSubmitting(false);
          return;
        }
        const res = await signUpWithEmail(authEmail, authPassword, authName || "Customer", authPhone);
        if (!res.success) {
          toast.error(res.error || "Registration failed.");
        }
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handle Address Save
  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAddress(true);
    saveCustomerProfile(addressForm);
    setTimeout(() => {
      setIsSavingAddress(false);
      toast.success("Delivery address saved!");
    }, 300);
  };

  // 1-Tap Reorder
  const handleReorder = (orderItems: any[]) => {
    if (!orderItems || orderItems.length === 0) return;
    let addedCount = 0;
    orderItems.forEach((item) => {
      if (item.id && item.name) {
        addItem({
          id: item.id,
          name: item.name,
          price: Number(item.price) || 0,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || "kg",
          image: item.image || "/images/whole-rainbow-trout.webp",
          minQuantity: item.minQuantity || 1,
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      toast.success("Past catch items added to cart!");
      openCart();
    } else {
      toast.error("Could not add items to cart.");
    }
  };

  // Check Web Push status on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
      if ("serviceWorker" in navigator && "PushManager" in window) {
        // Ensure SW is registered
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (!reg) {
            navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
          }
        });

        const readyTimeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 4000)
        );
        Promise.race([navigator.serviceWorker.ready, readyTimeout])
          .then(async (reg: any) => {
            if (reg?.pushManager) {
              const sub = await reg.pushManager.getSubscription();
              setPushSubscribed(Boolean(sub));
              // If permission is already granted on iOS but sub was not recorded, auto-subscribe
              if (!sub && Notification.permission === "granted" && VAPID_PUBLIC_KEY) {
                try {
                  const newSub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
                  });
                  if (newSub) {
                    setPushSubscribed(true);
                    await fetch("/api/push/subscribe", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        subscription: serializePushSubscription(newSub),
                        phone: savedProfile?.phone || addressForm.phone,
                        email: user?.email || savedProfile?.email,
                        userId: user?.id,
                      }),
                    });
                  }
                } catch (_) {}
              }
            }
          })
          .catch(() => {});
      }
    } else {
      setPushPermission("unsupported");
    }
  }, [user, savedProfile, addressForm.phone]);

  const handleEnablePush = async () => {
    const vapidKey = VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      toast.error("VAPID public key not configured.");
      return;
    }
    setIsPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== "granted") {
        toast.error("Notification permission was not granted.");
        setIsPushLoading(false);
        return;
      }

      // Ensure SW registration exists
      let reg: ServiceWorkerRegistration | undefined = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }

      const readyTimeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
        setTimeout(() => reject(new Error("Service Worker activation timeout. Please refresh and try again.")), 7000)
      );
      const activeReg = (await Promise.race([navigator.serviceWorker.ready, readyTimeout]).catch(() => reg)) || reg;

      if (!activeReg || !activeReg.pushManager) {
        throw new Error("Push notifications are not supported or ready on this browser.");
      }

      let sub = await activeReg.pushManager.getSubscription();
      if (!sub) {
        sub = await activeReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: serializePushSubscription(sub),
          phone: savedProfile?.phone || addressForm.phone,
          email: user?.email || savedProfile?.email,
          userId: user?.id,
        }),
      });

      if (res.ok) {
        setPushSubscribed(true);
        toast.success("Push notifications enabled on this device! 🐟");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to register notifications.");
      }
    } catch (err: any) {
      console.error("Account push subscription error:", err);
      toast.error(err.message || "Failed to subscribe to notifications.");
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      if (!("serviceWorker" in navigator)) return;
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
      const readyTimeout = new Promise<ServiceWorkerRegistration>((_, reject) =>
        setTimeout(() => reject(new Error("Service Worker timeout")), 4000)
      );
      const activeReg = (await Promise.race([navigator.serviceWorker.ready, readyTimeout]).catch(() => reg)) || reg;

      if (activeReg && activeReg.showNotification) {
        await activeReg.showNotification("Urban Trout Test Alert 🐟", {
          body: "Web Push is working! You will receive live harvest and delivery updates.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          data: { url: "/account" },
          vibrate: [100, 50, 100],
        } as any);
        toast.success("Test notification displayed on your device!");
      }
    } catch (err: any) {
      toast.error(err.message || "Test notification error.");
    }
  };

  // Status Chip Formatter
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "delivered":
        return {
          label: "Delivered ✓",
          bg: "bg-emerald-500/15",
          border: "border-emerald-500/40",
          text: "text-emerald-400",
        };
      case "out_for_delivery":
        return {
          label: "Out for Delivery 🛵",
          bg: "bg-cyan-500/20",
          border: "border-cyan-400/50",
          text: "text-cyan-300",
        };
      case "processing":
        return {
          label: "Harvested & Packing ❄️",
          bg: "bg-sky-500/15",
          border: "border-sky-400/40",
          text: "text-sky-300",
        };
      case "cancelled":
        return {
          label: "Cancelled",
          bg: "bg-red-500/15",
          border: "border-red-500/40",
          text: "text-red-400",
        };
      case "confirmed":
      default:
        return {
          label: "Confirmed ✓",
          bg: "bg-amber-500/15",
          border: "border-amber-500/40",
          text: "text-amber-300",
        };
    }
  };

  return (
    <main className="min-h-screen bg-[#031018] text-white pt-28 pb-20 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-cyan-500/20 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase">
                Urban Trout Customer Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-['Space_Grotesk']">
              {user ? (
                <>Welcome back, <span className="text-cyan-400">{user.user_metadata?.full_name || user.email?.split("@")[0]}</span></>
              ) : savedProfile?.fullName ? (
                <>Welcome, <span className="text-cyan-400">{savedProfile.fullName}</span></>
              ) : (
                "My Orders & Account"
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-['Manrope']">
              Track live harvest orders, reorder in 1-tap, and manage your Srinagar delivery address.
            </p>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-white truncate max-w-[180px]">{user.email}</p>
                <p className="text-[10px] text-cyan-400/80 font-mono">Verified Customer</p>
              </div>
              <button
                onClick={() => signOut()}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:border-red-500/50 hover:bg-red-500/10 text-slate-300 hover:text-red-300 text-xs font-medium transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-cyan-500/20"
            >
              Order Fresh Trout ⚡
            </Link>
          )}
        </div>

        {/* ── Logged-Out Authentication Card (if not logged in) ── */}
        {!user && (
          <div className="mb-10 p-6 rounded-3xl bg-slate-950/80 border border-cyan-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Left Column: 1-Tap Google + Benefits */}
              <div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                  Quick Access
                </span>
                <h2 className="text-xl font-bold text-white mt-2 mb-2 font-['Space_Grotesk']">
                  Sign in for 1-Tap Reordering
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed font-['Manrope'] mb-5">
                  Save your Srinagar delivery address, view live trout harvest status, and reorder your favorite catch in 10 seconds.
                </p>

                {/* Google 1-Tap Button */}
                <button
                  onClick={() => signInWithGoogle("/account")}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-white/10 active:scale-[0.99] cursor-pointer mb-3"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Continue with Google
                </button>

                {/* Guest Phone Track Box */}
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <p className="text-[11px] text-slate-400 font-medium mb-2">
                    Already ordered as a guest? Look up by mobile number:
                  </p>
                  <form onSubmit={handleGuestLookup} className="flex gap-2">
                    <input
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      maxLength={10}
                      className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Track Catch
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Email Sign In / Sign Up */}
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white font-['Space_Grotesk']">
                    {authMode === "signin" ? "Sign In with Email" : "Create New Account"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                  >
                    {authMode === "signin" ? "Need an account? Register" : "Have an account? Sign In"}
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  {authMode === "signup" && (
                    <>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="e.g. Suhail Sofi"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Password {authMode === "signin" && <span className="text-slate-500 font-normal">(Leave blank for magic link)</span>}
                    </label>
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder={authMode === "signin" ? "Password (optional for magic link)" : "Create a password (min 6 chars)"}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-500/20"
                  >
                    {authSubmitting ? "Processing…" : authMode === "signin" ? (authPassword ? "Sign In" : "Send Magic Link 📧") : "Create Account ⚡"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("orders")}
            className={`pb-3 px-4 font-['Space_Grotesk'] text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === "orders" ? "text-cyan-400" : "text-slate-400 hover:text-white"
            }`}
          >
            My Orders & Tracking ({orders.length})
            {activeTab === "orders" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("address")}
            className={`pb-3 px-4 font-['Space_Grotesk'] text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === "address" ? "text-cyan-400" : "text-slate-400 hover:text-white"
            }`}
          >
            Saved Srinagar Address
            {activeTab === "address" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`pb-3 px-4 font-['Space_Grotesk'] text-sm font-bold transition-all relative cursor-pointer ${
              activeTab === "notifications" ? "text-cyan-400" : "text-slate-400 hover:text-white"
            }`}
          >
            Push Alerts {pushSubscribed ? "🔔" : ""}
            {activeTab === "notifications" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
            )}
          </button>
        </div>

        {/* ── TAB 1: ORDERS & TRACKING ── */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {loadingOrders ? (
              <div className="p-12 text-center rounded-2xl bg-slate-950/40 border border-slate-800 space-y-3">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-mono">Fetching fresh harvest orders…</p>
              </div>
            ) : orders.length > 0 ? (
              orders.map((ord) => {
                const badge = getStatusBadge(ord.status);
                const orderDate = new Date(ord.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={ord.id}
                    className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/40 transition-all space-y-4 shadow-xl"
                  >
                    {/* Order Top Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-['Space_Grotesk'] font-bold text-white text-base">
                            Order #{ord.order_number || ord.id.slice(0, 8)}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.border} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{orderDate}</p>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <span className="text-xs text-slate-400 block font-['Manrope']">Total Amount</span>
                          <span className="text-base font-extrabold text-white font-['Space_Grotesk']">
                            ₹{Number(ord.total).toLocaleString("en-IN")}
                          </span>
                        </div>

                        {/* Reorder Button */}
                        <button
                          onClick={() => handleReorder(ord.items)}
                          className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/30 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                        >
                          Reorder ⚡
                        </button>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Ordered Items
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {Array.isArray(ord.items) &&
                          ord.items.map((item: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-base">🐟</span>
                                <div>
                                  <p className="font-medium text-slate-200">{item.name}</p>
                                  <p className="text-[10px] text-slate-400">
                                    Qty: {item.quantity} {item.unit || "kg"}
                                  </p>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-cyan-300">
                                ₹{(Number(item.price) * Number(item.quantity)).toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Delivery Address Details */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span>📍</span>
                        <span className="text-slate-300 font-medium">
                          {ord.customer_locality || "Srinagar"} • {ord.customer_pincode || "190006"}
                        </span>
                      </div>
                      <Link
                        href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout%2C%20checking%20status%20for%20Order%20%23${ord.order_number || ""}`}
                        target="_blank"
                        className="text-cyan-400 hover:text-cyan-300 font-medium text-[11px] flex items-center gap-1"
                      >
                        Need Help? WhatsApp Farm 💬
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-10 text-center rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-2xl">
                  🐟
                </div>
                <div>
                  <h3 className="font-['Space_Grotesk'] font-bold text-white text-base">
                    No orders found yet
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 font-['Manrope']">
                    {lookupPhone || user?.email
                      ? `No orders matching ${lookupPhone || user?.email}. Place your first fresh catch order today!`
                      : "Sign in with Google or look up your orders using the mobile number you ordered with."}
                  </p>
                </div>
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-cyan-500/25"
                >
                  Order Fresh Catch ⚡
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: SAVED ADDRESS ── */}
        {activeTab === "address" && (
          <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-xl">
            <div className="mb-5">
              <h2 className="text-base font-bold text-white font-['Space_Grotesk']">
                Default Srinagar Delivery Address
              </h2>
              <p className="text-xs text-slate-400 font-['Manrope'] mt-0.5">
                This address will automatically pre-fill on checkout so you can complete orders in 1 tap.
              </p>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.fullName}
                    onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                    placeholder="Suhail Sofi"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Phone Number (10 digits) *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value.replace(/\D/g, "") })}
                    placeholder="9876543210"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Srinagar Locality / Area *
                  </label>
                  <select
                    value={addressForm.locality}
                    onChange={(e) => setAddressForm({ ...addressForm, locality: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="">Select your area…</option>
                    {SRINAGAR_LOCALITIES.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                    Pin Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={addressForm.pincode}
                    onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                    placeholder="190006"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                  House / Flat / Lane & Nearby Landmark *
                </label>
                <textarea
                  required
                  rows={2}
                  value={addressForm.house}
                  onChange={(e) => setAddressForm({ ...addressForm, house: e.target.value })}
                  placeholder="e.g. House No. 12, Lane 4 near R P School Girls Wing"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-500/20"
                >
                  {isSavingAddress ? "Saving…" : "Save Delivery Address ✓"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── TAB 3: PUSH ALERTS ── */}
        {activeTab === "notifications" && (
          <div className="p-6 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white font-['Space_Grotesk']">
                  Morning Harvest &amp; Order Push Alerts
                </h2>
                <p className="text-xs text-slate-400 font-['Manrope'] mt-0.5">
                  Receive instant notifications when fresh trout is harvested at Malabagh or dispatched for delivery.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    pushSubscribed ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  }`}
                />
                <span className="text-xs font-mono font-medium text-slate-300">
                  {pushSubscribed ? "Active on this Device ✓" : "Not Active"}
                </span>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-['Space_Grotesk']">
                  Device Status
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-['Manrope']">
                  {pushPermission === "unsupported"
                    ? "Push notifications are not supported on this browser."
                    : pushSubscribed
                    ? "This device is registered to receive instant harvest alerts and live dispatch updates."
                    : "Notifications are not active yet on this device. Click below to enable."}
                </p>

                <div className="pt-1 flex flex-wrap gap-2">
                  {!pushSubscribed ? (
                    <button
                      type="button"
                      onClick={handleEnablePush}
                      disabled={isPushLoading}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-500/20"
                    >
                      {isPushLoading ? "Enabling…" : "Enable Push Alerts 🔔"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendTestPush}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Test Alert on My Device 📲
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider font-['Space_Grotesk']">
                  What You&apos;ll Receive
                </h3>
                <ul className="text-xs text-slate-300 space-y-2 font-['Manrope']">
                  <li className="flex items-center gap-2">
                    <span>🐟</span>
                    <span><strong>Daily Fresh Harvest:</strong> First alerts when morning trout is pulled.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>🛵</span>
                    <span><strong>Live Dispatch:</strong> Alerts when your order leaves Malabagh on ice.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>⚡</span>
                    <span><strong>Weekend Catch Deals:</strong> Exclusive flash discounts for regulars.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
