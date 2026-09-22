"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";

export interface StaffMember {
  email: string;
  name: string;
  role: "super_admin" | "sales_staff" | "farm_manager" | "custom";
  permissions: {
    billing: boolean;
    orders: boolean;
    leads: boolean;
    inventory: boolean;
    customers: boolean;
    analytics: boolean;
    farm: boolean;
    settings: boolean;
    can_delete: boolean;
  };
  addedAt: string;
}

const DEFAULT_STAFF: StaffMember[] = [
  {
    email: "sofisuhail007@gmail.com",
    name: "Suhail",
    role: "super_admin",
    permissions: {
      billing: true,
      orders: true,
      leads: true,
      inventory: true,
      customers: true,
      analytics: true,
      farm: true,
      settings: true,
      can_delete: true,
    },
    addedAt: new Date().toISOString(),
  },
  {
    email: "work.suhail007@gmail.com",
    name: "Mohd Amin",
    role: "sales_staff",
    permissions: {
      billing: true,
      orders: false,
      leads: false,
      inventory: false,
      customers: false,
      analytics: false,
      farm: false,
      settings: false,
      can_delete: false,
    },
    addedAt: new Date().toISOString(),
  },
];

export default function AdminSettingsPage() {
  const [upiId, setUpiId] = useState("JKBMERC00828895@jkb");
  const [primaryPhone, setPrimaryPhone] = useState("+918491006127");
  const [alternatePhone, setAlternatePhone] = useState("+917006604148");
  const [email, setEmail] = useState("info.urbantrout@gmail.com");
  const [deliveryFee, setDeliveryFee] = useState("40");
  const [deliveryRadius, setDeliveryRadius] = useState("5.0");
  const [farmLat, setFarmLat] = useState("34.144709");
  const [farmLng, setFarmLng] = useState("74.824525");
  const [staffList, setStaffList] = useState<StaffMember[]>(DEFAULT_STAFF);

  // Rename staff state
  const [editingStaffEmail, setEditingStaffEmail] = useState<string | null>(null);
  const [editingStaffName, setEditingStaffName] = useState<string>("");

  // New staff form state
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"sales_staff" | "farm_manager" | "super_admin" | "custom">("sales_staff");
  const [newPermissions, setNewPermissions] = useState({
    billing: true,
    orders: true,
    leads: false,
    inventory: true,
    customers: true,
    analytics: false,
    farm: false,
    settings: false,
    can_delete: false,
  });

  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [storeManuallyClosed, setStoreManuallyClosed] = useState(false);
  const [isTogglingStore, setIsTogglingStore] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState("15");
  const [lowStockAlertsEnabled, setLowStockAlertsEnabled] = useState(true);
  const [isTestingTelegramAlert, setIsTestingTelegramAlert] = useState(false);
  const [testAlertFeedback, setTestAlertFeedback] = useState<string | null>(null);

  // ─── LIVE PRICE BOARD STATE ───
  const [priceProducts, setPriceProducts] = useState<Array<{ product_id: string; product_name: string; price_per_kg: number }>>([
    { product_id: "gutted-trout", product_name: "Premium Gutted Rainbow Trout (Cleaned)", price_per_kg: 590 },
    { product_id: "whole-trout", product_name: "Whole Rainbow Trout", price_per_kg: 550 },
  ]);
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceSavedMsg, setPriceSavedMsg] = useState("");

  // ─── GOOGLE REVIEW URL STATE ───
  const [googleReviewUrl, setGoogleReviewUrl] = useState("https://g.page/r/CTVKEpV62HMmECE/review");
  const [reviewUrlSaving, setReviewUrlSaving] = useState(false);
  const [reviewUrlSavedMsg, setReviewUrlSavedMsg] = useState("");


  useEffect(() => {
    async function loadSettings() {
      // 1. Instant local cache read
      try {
        const local = localStorage.getItem("urban_trout_store_settings");
        if (local) {
          const map = JSON.parse(local);
          if (map.upi_id) setUpiId(map.upi_id);
          if (map.primary_phone) setPrimaryPhone(map.primary_phone);
          if (map.alternate_phone) setAlternatePhone(map.alternate_phone);
          if (map.email) setEmail(map.email);
          if (map.delivery_fee_outside_5km) setDeliveryFee(map.delivery_fee_outside_5km);
          if (map.delivery_radius_km) setDeliveryRadius(map.delivery_radius_km);
          if (map.farm_latitude) setFarmLat(map.farm_latitude);
          if (map.farm_longitude) setFarmLng(map.farm_longitude);
          if (map.low_stock_threshold_kg) setLowStockThreshold(map.low_stock_threshold_kg);
          if (map.telegram_low_stock_alerts_enabled !== undefined) {
            setLowStockAlertsEnabled(map.telegram_low_stock_alerts_enabled !== "false");
          }
        }
      } catch (_) {}

      // 2. Fetch from API endpoint & Supabase
      try {
        const res = await adminFetch("/api/settings");
        if (res.ok) {
          const json = await res.json();
          const map = json.settingsMap || {};
          if (map.upi_id) setUpiId(map.upi_id);
          if (map.primary_phone) setPrimaryPhone(map.primary_phone);
          if (map.alternate_phone) setAlternatePhone(map.alternate_phone);
          if (map.email) setEmail(map.email);
          if (map.delivery_fee_outside_5km || map.delivery_fee_outside_radius) {
            setDeliveryFee(map.delivery_fee_outside_5km || map.delivery_fee_outside_radius);
          }
          if (map.delivery_radius_km) setDeliveryRadius(map.delivery_radius_km);
          if (map.farm_latitude) setFarmLat(map.farm_latitude);
          if (map.farm_longitude) setFarmLng(map.farm_longitude);
          if (map.store_manually_closed) {
            setStoreManuallyClosed(map.store_manually_closed === "true");
          }
          if (map.low_stock_threshold_kg) {
            setLowStockThreshold(map.low_stock_threshold_kg);
          }
          if (map.telegram_low_stock_alerts_enabled !== undefined) {
            setLowStockAlertsEnabled(map.telegram_low_stock_alerts_enabled !== "false");
          }
          if (map.staff_permissions) {
            try {
              const parsed = JSON.parse(map.staff_permissions);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setStaffList(parsed);
              }
            } catch {}
          }
          if (map.google_review_url) {
            setGoogleReviewUrl(map.google_review_url);
          }
          localStorage.setItem("urban_trout_store_settings", JSON.stringify(map));
        }
      } catch (err) {
        console.warn("Notice loading settings from API:", err);
      }

      // Load live prices from Supabase inventory
      try {
        const { data: invData } = await supabase.from("inventory").select("product_id, product_name, price_per_kg");
        if (invData && invData.length > 0) {
          setPriceProducts(invData.map((r: any) => ({
            product_id: r.product_id,
            product_name: r.product_name,
            price_per_kg: Number(r.price_per_kg),
          })));
        }
      } catch (_) {}

      setLoading(false);
    }
    loadSettings();
  }, []);

  // ─── SAVE PRICES HANDLER ───
  const handleSavePrices = async () => {
    if (priceProducts.some((p) => p.price_per_kg <= 0)) {
      alert("All prices must be greater than ₹0.");
      return;
    }
    setPriceSaving(true);
    setPriceSavedMsg("");
    try {
      const res = await adminFetch("/api/inventory/update-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: priceProducts }),
      });
      const json = await res.json();
      if (json.success) {
        // Also update local POS cache so billing page picks it up instantly
        try {
          const cached = JSON.parse(localStorage.getItem("urban_trout_pos_products_v3") || "[]");
          const merged = priceProducts.map((pp) => {
            const existing = cached.find((c: any) => c.id === pp.product_id) || {};
            return { ...existing, id: pp.product_id, name: pp.product_name, pricePerKg: pp.price_per_kg, unit: "Kg" };
          });
          localStorage.setItem("urban_trout_pos_products_v3", JSON.stringify(merged));
        } catch (_) {}
        setPriceSavedMsg("✓ Prices updated! POS & Remote Bills will reflect the new rates.");
        setTimeout(() => setPriceSavedMsg(""), 5000);
      } else {
        setPriceSavedMsg("⚠️ " + (json.error || "Failed to save prices."));
        setTimeout(() => setPriceSavedMsg(""), 5000);
      }
    } catch (err: any) {
      setPriceSavedMsg("⚠️ Error: " + err.message);
      setTimeout(() => setPriceSavedMsg(""), 5000);
    } finally {
      setPriceSaving(false);
    }
  };

  // ─── SAVE GOOGLE REVIEW URL HANDLER ───
  const handleSaveReviewUrl = async () => {
    if (!googleReviewUrl.trim().startsWith("http")) {
      alert("Please enter a valid URL starting with https://");
      return;
    }
    setReviewUrlSaving(true);
    setReviewUrlSavedMsg("");
    try {
      await adminFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ key: "google_review_url", value: googleReviewUrl.trim(), description: "Google Business Profile review deep-link URL" }]),
      });
      setReviewUrlSavedMsg("✓ Review link saved! Billing page will now use this URL.");
      setTimeout(() => setReviewUrlSavedMsg(""), 4000);
    } catch (err: any) {
      setReviewUrlSavedMsg("⚠️ Error: " + err.message);
      setTimeout(() => setReviewUrlSavedMsg(""), 4000);
    } finally {
      setReviewUrlSaving(false);
    }
  };

  // Update new staff role preset permissions
  const handleRoleSelect = (role: typeof newRole) => {
    setNewRole(role);
    if (role === "super_admin") {
      setNewPermissions({
        billing: true,
        orders: true,
        leads: true,
        inventory: true,
        customers: true,
        analytics: true,
        farm: true,
        settings: true,
        can_delete: true,
      });
    } else if (role === "sales_staff") {
      setNewPermissions({
        billing: true,
        orders: true,
        leads: false,
        inventory: true,
        customers: true,
        analytics: false,
        farm: false,
        settings: false,
        can_delete: false,
      });
    } else if (role === "farm_manager") {
      setNewPermissions({
        billing: false,
        orders: true,
        leads: false,
        inventory: true,
        customers: false,
        analytics: true,
        farm: true,
        settings: false,
        can_delete: false,
      });
    }
  };

  // Add staff member
  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      alert("Please enter a valid Google email address.");
      return;
    }

    if (staffList.some((s) => s.email.toLowerCase() === cleanEmail)) {
      alert("This email is already in the staff access list.");
      return;
    }

    const member: StaffMember = {
      email: cleanEmail,
      name: newName.trim() || cleanEmail.split("@")[0],
      role: newRole,
      permissions: { ...newPermissions },
      addedAt: new Date().toISOString(),
    };

    const updated = [...staffList, member];
    setStaffList(updated);
    setNewEmail("");
    setNewName("");
    handleRoleSelect("sales_staff");
  };

  // Remove staff member
  const handleRemoveStaff = (emailToRemove: string) => {
    if (emailToRemove.toLowerCase() === "sofisuhail007@gmail.com") {
      alert("Primary root admin cannot be removed.");
      return;
    }
    if (confirm(`Remove staff access for ${emailToRemove}?`)) {
      setStaffList(staffList.filter((s) => s.email.toLowerCase() !== emailToRemove.toLowerCase()));
    }
  };

  // Rename staff member (e.g. Mohd Amin, Suhail, etc.)
  const handleRenameStaff = async (emailToRename: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      alert("Please enter a valid staff name.");
      return;
    }
    const updated = staffList.map((s) =>
      s.email.toLowerCase() === emailToRename.toLowerCase() ? { ...s, name: trimmed } : s
    );
    setStaffList(updated);
    setEditingStaffEmail(null);

    // If current logged-in user is this staff, update their local name
    const currentEmail = (localStorage.getItem("ut_admin_email") || "").toLowerCase().trim();
    if (currentEmail === emailToRename.toLowerCase()) {
      localStorage.setItem("ut_admin_name", trimmed);
    }

    // Auto-save to server so it immediately affects vending log and billing
    try {
      const updates = [
        {
          key: "staff_permissions",
          value: JSON.stringify(updated),
          description: "Granular RBAC feature permissions & whitelisted Google accounts for staff",
        },
      ];
      await adminFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      localStorage.setItem("urban_trout_staff_list", JSON.stringify(updated));
      setSavedMsg(`Updated worker name to "${trimmed}" successfully!`);
      setTimeout(() => setSavedMsg(""), 3500);
    } catch (err) {
      console.warn("Auto-save staff rename notice:", err);
    }
  };

  // Toggle specific permission for existing staff
  const handleToggleStaffPermission = (
    staffEmail: string,
    permKey: keyof StaffMember["permissions"]
  ) => {
    if (staffEmail.toLowerCase() === "sofisuhail007@gmail.com") return;
    setStaffList(
      staffList.map((s) => {
        if (s.email.toLowerCase() === staffEmail.toLowerCase()) {
          return {
            ...s,
            permissions: {
              ...s.permissions,
              [permKey]: !s.permissions[permKey],
            },
          };
        }
        return s;
      })
    );
  };

  // Instantly toggle the manual store closure (no need to hit Save All)
  const handleToggleStore = async () => {
    const newVal = !storeManuallyClosed;
    setStoreManuallyClosed(newVal);
    setIsTogglingStore(true);
    try {
      const item = {
        key: "store_manually_closed",
        value: String(newVal),
        description: "Manual store closure override — bypasses business hours check",
      };
      await adminFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([item]),
      });
      await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      setSavedMsg(newVal ? "🔴 Store marked as CLOSED — customers will see closed banner." : "🟢 Store is now OPEN — customers can order normally.");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.warn("Store toggle save notice:", err);
    } finally {
      setIsTogglingStore(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedMsg("");

    const updates = [
      { key: "upi_id", value: upiId.trim(), description: "Primary UPI ID for customer direct checkout payments" },
      { key: "primary_phone", value: primaryPhone.trim(), description: "Primary WhatsApp and contact phone" },
      { key: "alternate_phone", value: alternatePhone.trim(), description: "Alternate contact phone" },
      { key: "email", value: email.trim(), description: "Official support email" },
      { key: "delivery_fee_outside_5km", value: deliveryFee.trim(), description: "Delivery fee beyond deliverable radius in Srinagar" },
      { key: "delivery_radius_km", value: deliveryRadius.trim(), description: "Deliverable radius in KM from Urban Trout Farm" },
      { key: "farm_latitude", value: farmLat.trim(), description: "Latitude of Urban Trout Farm Hub" },
      { key: "farm_longitude", value: farmLng.trim(), description: "Longitude of Urban Trout Farm Hub" },
      {
        key: "staff_permissions",
        value: JSON.stringify(staffList),
        description: "Granular RBAC feature permissions & whitelisted Google accounts for staff",
      },
      {
        key: "admin_whitelist",
        value: staffList.map((s) => s.email).join(","),
        description: "Comma-separated list of permitted Google accounts",
      },
      {
        key: "low_stock_threshold_kg",
        value: lowStockThreshold.trim() || "15",
        description: "Low aquarium live stock alert threshold in kg",
      },
      {
        key: "telegram_low_stock_alerts_enabled",
        value: lowStockAlertsEnabled ? "true" : "false",
        description: "Whether to send Telegram alerts when aquarium live stock drops below threshold",
      },
    ];

    // 1. Instant local persistence
    try {
      const localMap: Record<string, string> = {};
      updates.forEach((u) => (localMap[u.key] = u.value));
      localStorage.setItem("urban_trout_store_settings", JSON.stringify(localMap));
      localStorage.setItem("urban_trout_delivery_settings", JSON.stringify(localMap));
    } catch (_) {}

    // 2. Server API persistence
    try {
      await adminFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (apiErr) {
      console.warn("API save notice:", apiErr);
    }

    // 3. Supabase direct upsert attempt
    try {
      for (const item of updates) {
        await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      }
    } catch (_) {}

    setIsSaving(false);
    setSavedMsg("Settings & Staff Permissions saved successfully!");
    setTimeout(() => setSavedMsg(""), 4000);
  };

  const handleSendTestAlert = async () => {
    setIsTestingTelegramAlert(true);
    setTestAlertFeedback(null);
    try {
      const res = await adminFetch("/api/telegram-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "low_stock_test",
          data: {
            triggerSource: "Manual Test from Admin Settings",
            isTest: true,
          },
        }),
      });
      if (res.ok) {
        setTestAlertFeedback("✓ Test alert sent to Telegram!");
      } else {
        setTestAlertFeedback("⚠️ Failed to send Telegram alert.");
      }
    } catch (_) {
      setTestAlertFeedback("⚠️ Error reaching notification server.");
    } finally {
      setIsTestingTelegramAlert(false);
      setTimeout(() => setTestAlertFeedback(null), 5000);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
          <span className="material-symbols-outlined text-2xl">settings</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Store &amp; Staff Access Management
          </h1>
          <p className="text-slate-400 text-sm mt-0.5" style={{ fontFamily: '"Manrope", sans-serif' }}>
            Control staff Google accounts, granular feature permissions, and store checkout rules.
          </p>
        </div>
      </div>

      {savedMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {savedMsg}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-slate-500">Loading settings…</div>
      ) : (
        <div className="space-y-8">
          {/* ══════════════════════════════════════════════════════════
              SECTION 0: MANUAL STORE CLOSURE OVERRIDE
              ══════════════════════════════════════════════════════════ */}
          <div
            className={`relative overflow-hidden rounded-3xl p-6 md:p-8 border transition-all duration-500 shadow-xl ${
              storeManuallyClosed
                ? "bg-red-950/40 border-red-500/40"
                : "bg-slate-900/60 border-slate-800"
            }`}
          >
            {/* Ambient glow when closed */}
            {storeManuallyClosed && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "radial-gradient(ellipse at top left, rgba(239,68,68,0.08) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />
            )}

            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              {/* Left: icon + text */}
              <div className="flex items-start gap-4">
                {/* Animated icon */}
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    storeManuallyClosed
                      ? "bg-red-500/20 border border-red-500/40"
                      : "bg-emerald-500/15 border border-emerald-500/30"
                  }`}
                >
                  {storeManuallyClosed ? (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2
                      className={`text-lg font-bold transition-colors duration-300 ${storeManuallyClosed ? "text-red-300" : "text-white"}`}
                      style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                    >
                      Manual Store Closure Override
                    </h2>
                    {/* Live status pill */}
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        storeManuallyClosed
                          ? "bg-red-500/20 border-red-500/40 text-red-400"
                          : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      }`}
                    >
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full"
                        style={{
                          background: storeManuallyClosed ? "#f87171" : "#4ade80",
                          animation: "pulse 2s infinite",
                        }}
                      />
                      {storeManuallyClosed ? "Store Closed" : "Store Open"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    {storeManuallyClosed
                      ? "⚠️ Your store is manually closed. Customers will see the \"Store Closed\" banner and cannot place orders."
                      : "Toggle ON to instantly close the store for the day — for breaks, restocking, or special occasions. Customers will see a closed banner with a WhatsApp CTA."}
                  </p>
                  {storeManuallyClosed && (
                    <p className="text-xs text-red-400/70 mt-1.5 font-medium">
                      Remember to toggle OFF when you&apos;re ready to accept orders again.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Big Toggle */}
              <div className="flex flex-col items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleToggleStore}
                  disabled={isTogglingStore}
                  className={`relative flex items-center rounded-full transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 ${
                    storeManuallyClosed
                      ? "focus:ring-red-500"
                      : "focus:ring-emerald-500"
                  }`}
                  style={{ width: "72px", height: "36px", padding: "3px" }}
                  aria-label={storeManuallyClosed ? "Open store" : "Close store"}
                >
                  {/* Track */}
                  <span
                    className={`absolute inset-0 rounded-full transition-all duration-300 ${
                      storeManuallyClosed
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      boxShadow: storeManuallyClosed
                        ? "0 0 20px rgba(239,68,68,0.4)"
                        : "0 0 20px rgba(74,222,128,0.3)",
                    }}
                  />
                  {/* Thumb */}
                  <span
                    className="relative z-10 inline-block w-7 h-7 bg-white rounded-full shadow-md transition-all duration-300"
                    style={{
                      transform: storeManuallyClosed ? "translateX(36px)" : "translateX(0px)",
                    }}
                  />
                </button>
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${
                    storeManuallyClosed ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {isTogglingStore ? "Saving…" : storeManuallyClosed ? "Closed" : "Open"}
                </span>
              </div>
            </div>

            {/* Bottom info bar */}
            <div
              className={`mt-5 pt-4 border-t flex flex-wrap items-center gap-4 text-xs transition-colors duration-300 ${
                storeManuallyClosed ? "border-red-500/20 text-red-400/60" : "border-slate-800 text-slate-500"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Business hours: 7:00 AM – 10:00 PM IST
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                Changes apply instantly — no page reload needed
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Customers see WhatsApp CTA when closed
              </span>
            </div>

            {/* Pulse animation */}
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
          </div>

          {/* ══════════════════════════════════════════════════════════
              💰 LIVE PRICE BOARD
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-3xl p-6 md:p-8 space-y-5 shadow-xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <span className="material-symbols-outlined text-2xl">price_change</span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    Live Price Board
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                    Instant Sync
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1" style={{ fontFamily: '"Manrope", sans-serif' }}>
                  Update fish prices here and they will instantly reflect across POS billing, Remote Order bills, and Deal Calculator — no deploy needed.
                </p>
              </div>
            </div>

            {/* Price inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {priceProducts.map((prod, idx) => (
                <div key={prod.product_id} className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block">
                    {prod.product_name}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm font-mono">₹</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={prod.price_per_kg}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setPriceProducts((prev) =>
                          prev.map((p, i) => i === idx ? { ...p, price_per_kg: isNaN(val) ? 0 : val } : p)
                        );
                      }}
                      className="w-full pl-8 pr-14 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 font-mono font-bold transition-all"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">/Kg</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Save feedback */}
            {priceSavedMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${priceSavedMsg.startsWith("✓") ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-red-500/15 border border-red-500/30 text-red-400"}`}>
                {priceSavedMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleSavePrices}
              disabled={priceSaving}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              {priceSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-800 border-t-transparent animate-spin rounded-full" />
                  <span>Updating Prices…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Update Prices Now</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-500 font-mono">
              Tip: After saving, reload the POS billing tab to see the updated prices in the counter.
            </p>
          </div>

          {/* ══════════════════════════════════════════════════════════
              ⭐ GOOGLE REVIEW LINK
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/80 border border-yellow-500/30 rounded-3xl p-6 md:p-8 space-y-5 shadow-xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-yellow-500/6 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400 flex-shrink-0">
                <span className="material-symbols-outlined text-2xl">star</span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    Google Review Link
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 font-mono">
                    SEO Boost
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1" style={{ fontFamily: '"Manrope", sans-serif' }}>
                  Paste your Google Business Profile review URL here. The billing page will use it to send customers a WhatsApp review request after payment.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block">
                Google Review URL:
              </label>
              <input
                type="url"
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                placeholder="https://g.page/r/XXXXXX/review"
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-yellow-400 font-mono transition-all"
              />
              <p className="text-[10px] text-slate-500 font-mono">
                Find this link in your Google Business Profile → Get more reviews → Copy the link
              </p>
            </div>

            {reviewUrlSavedMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${reviewUrlSavedMsg.startsWith("✓") ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-red-500/15 border border-red-500/30 text-red-400"}`}>
                {reviewUrlSavedMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveReviewUrl}
              disabled={reviewUrlSaving}
              className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-yellow-500/20"
            >
              {reviewUrlSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-800 border-t-transparent animate-spin rounded-full" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>Save Review Link</span>
                </>
              )}
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════
              LOW AQUARIUM STOCK TELEGRAM ALERTS CARD
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl">notifications_active</span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      Low Aquarium Stock Telegram Alerts
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                      Telegram Bot Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    Automatically alerts you on Telegram when available aquarium fish biomass drops below safety threshold.
                  </p>
                </div>
              </div>

              {/* Test Alert Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendTestAlert}
                  disabled={isTestingTelegramAlert}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {isTestingTelegramAlert ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent animate-spin rounded-full" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <span>📲</span>
                      <span>Send Test Alert</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {testAlertFeedback && (
              <div
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  testAlertFeedback.startsWith("✓")
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-red-500/15 text-red-300 border border-red-500/30"
                }`}
              >
                <span>{testAlertFeedback}</span>
              </div>
            )}

            {/* Settings Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
              {/* Alert Toggle */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-white mb-1" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    Telegram Automation
                  </p>
                  <p className="text-[11px] text-slate-400" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    Send automated high-priority message when stock is low
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLowStockAlertsEnabled(!lowStockAlertsEnabled)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    lowStockAlertsEnabled ? "bg-cyan-500" : "bg-slate-700"
                  }`}
                  aria-label="Toggle low stock alerts"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      lowStockAlertsEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Threshold Input */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-bold text-white mb-0.5" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    Restock Threshold (Kg)
                  </label>
                  <p className="text-[11px] text-slate-400" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    Alert fires when live stock $\le$ this amount
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-center text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-xs text-slate-400 font-bold">KG</span>
                </div>
              </div>
            </div>

            {/* Details Footer */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Smart 4-hour cooldown prevents notification spam during rush hours
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Triggers on Counter POS sales &amp; Vending logs
              </span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECTION 1: STAFF PERMISSIONS & GOOGLE ACCOUNT RBAC
              ══════════════════════════════════════════════════════════ */}

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  <span className="material-symbols-outlined text-cyan-400">badge</span>
                  Sales &amp; Farm Staff Role-Based Access Control (RBAC)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Add personal Google accounts for staff and customize exactly what features they can view or delete.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold font-mono">
                {staffList.length} Active {staffList.length === 1 ? "Member" : "Members"}
              </span>
            </div>

            {/* Existing Staff Members Table */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Authorized Staff Members
              </h3>

              <div className="space-y-3">
                {staffList.map((staff) => {
                  const isOwner = staff.email.toLowerCase() === "sofisuhail007@gmail.com";
                  return (
                    <div
                      key={staff.email}
                      className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-sm">
                            {staff.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            {editingStaffEmail === staff.email ? (
                              <div className="flex items-center gap-1.5 my-0.5">
                                <input
                                  type="text"
                                  value={editingStaffName}
                                  onChange={(e) => setEditingStaffName(e.target.value)}
                                  className="bg-slate-900 border border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none"
                                  placeholder="Staff Name (e.g. Mohd Amin)"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRenameStaff(staff.email, editingStaffName)}
                                  className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 cursor-pointer"
                                  title="Save Name"
                                >
                                  <span className="material-symbols-outlined text-sm font-black">check</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingStaffEmail(null)}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                                  title="Cancel"
                                >
                                  <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-white text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                                  {staff.name}
                                </h4>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStaffEmail(staff.email);
                                    setEditingStaffName(staff.name);
                                  }}
                                  className="p-1 rounded-md text-slate-500 hover:text-cyan-300 hover:bg-slate-850 transition-colors cursor-pointer"
                                  title="Rename Staff Worker"
                                >
                                  <span className="material-symbols-outlined text-xs">edit</span>
                                </button>
                                {isOwner && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                    👑 Super Admin
                                  </span>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{staff.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-lg bg-slate-900 text-slate-300 text-xs font-medium border border-slate-800 capitalize">
                            {staff.role.replace("_", " ")}
                          </span>
                          {!isOwner && (
                            <button
                              type="button"
                              onClick={() => handleRemoveStaff(staff.email)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Revoke Staff Access"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Granular Feature Toggles */}
                      <div className="pt-3 border-t border-slate-800/80">
                        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block mb-2">
                          Enabled Features &amp; Actions:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: "billing", label: "⚡ POS Billing" },
                            { key: "orders", label: "📦 Orders" },
                            { key: "leads", label: "📞 Leads" },
                            { key: "inventory", label: "🐟 Inventory" },
                            { key: "customers", label: "👥 Customers" },
                            { key: "analytics", label: "📊 Analytics" },
                            { key: "farm", label: "🌾 Farm Logs" },
                            { key: "settings", label: "⚙️ Settings" },
                            { key: "can_delete", label: "🗑️ Delete Access" },
                          ].map((perm) => {
                            const isAllowed = staff.permissions[perm.key as keyof StaffMember["permissions"]];
                            const isDelete = perm.key === "can_delete";
                            return (
                              <button
                                key={perm.key}
                                type="button"
                                disabled={isOwner}
                                onClick={() =>
                                  handleToggleStaffPermission(
                                    staff.email,
                                    perm.key as keyof StaffMember["permissions"]
                                  )
                                }
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                  isOwner ? "cursor-default" : "cursor-pointer"
                                } ${
                                  isAllowed
                                    ? isDelete
                                      ? "bg-red-500/20 text-red-400 border border-red-500/40 font-bold"
                                      : "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                    : "bg-slate-900/60 text-slate-600 border border-slate-800 line-through"
                                }`}
                              >
                                <span>{isAllowed ? "✓" : "×"}</span>
                                <span>{perm.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── ADD NEW STAFF MEMBER FORM ─── */}
            <form onSubmit={handleAddStaff} className="p-6 rounded-2xl bg-slate-950/90 border border-cyan-500/30 space-y-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400 text-lg">person_add</span>
                <h4 className="font-bold text-white text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  Authorize New Staff Personal Google Account
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                    Staff Name / Counter Tag <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Tariq (Sales Desk)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">
                    Personal Google Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff.personal@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Role Preset Selector */}
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                  Role Preset Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "sales_staff", label: "🛒 Sales / POS Staff" },
                    { id: "farm_manager", label: "🌾 Farm Manager" },
                    { id: "super_admin", label: "👑 Full Admin" },
                    { id: "custom", label: "⚙️ Custom" },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleSelect(r.id as typeof newRole)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        newRole === r.id
                          ? "bg-cyan-500 text-slate-950"
                          : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature Checkboxes */}
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                  Feature Permissions Matrix:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: "billing", label: "⚡ POS Billing & Invoicing" },
                    { key: "orders", label: "📦 View Orders" },
                    { key: "leads", label: "📞 Leads Recovery" },
                    { key: "inventory", label: "🐟 Inventory & Rates" },
                    { key: "customers", label: "👥 Customers" },
                    { key: "analytics", label: "📊 Revenue Analytics" },
                    { key: "farm", label: "🌾 Farm RAS Logs" },
                    { key: "settings", label: "⚙️ Store Settings" },
                    { key: "can_delete", label: "🗑️ Can Delete Records" },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:bg-slate-800/40"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(newPermissions[item.key as keyof typeof newPermissions])}
                        onChange={(e) =>
                          setNewPermissions({
                            ...newPermissions,
                            [item.key]: e.target.checked,
                          })
                        }
                        className="rounded accent-cyan-500"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">person_add</span>
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECTION 2: STORE & PAYMENT SETTINGS
              ══════════════════════════════════════════════════════════ */}
          <form onSubmit={handleSave} className="space-y-6">
            {/* Payment Settings Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-5">
              <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                <span className="material-symbols-outlined text-base">qr_code_2</span>
                UPI Payment Gateway Configuration
              </h2>

              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                  Primary UPI ID for Checkout &amp; POS <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                  placeholder="e.g. JKBMERC00828895@jkb"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
                />
                <p className="text-xs text-slate-500">
                  Used to generate dynamic QR codes in both customer checkout and staff POS billing. Default: <code className="text-cyan-300">JKBMERC00828895@jkb</code>
                </p>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════
                SECTION 3: DELIVERY RADIUS & GOOGLE MAPS RADAR
                ══════════════════════════════════════════════════════════ */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    <span className="material-symbols-outlined text-base text-cyan-400">radar</span>
                    Deliverable Radius &amp; Google Maps Radar
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Control the live harvest delivery radius from Urban Trout Farm base in Naseem Bagh, Srinagar.
                  </p>
                </div>

                <a
                  href="/admin/dashboard/delivery"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/10 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">map</span>
                  Open Full Interactive Radar Map
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                    Deliverable Radius (KM) <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0.1"
                      max="50"
                      step="0.1"
                      value={deliveryRadius}
                      onChange={(e) => setDeliveryRadius(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                    />
                    <span className="text-xs font-bold text-cyan-400">KM</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Orders within this radius qualify for free live harvest dispatch.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                    Delivery Fee Beyond Radius (₹)
                  </label>
                  <input
                    type="number"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <p className="text-[11px] text-slate-500">
                    Surcharge applied if customer address is beyond the {deliveryRadius}km boundary.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                    Farm Base GPS Coordinates
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={farmLat}
                      onChange={(e) => setFarmLat(e.target.value)}
                      placeholder="Lat"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                    <input
                      type="text"
                      value={farmLng}
                      onChange={(e) => setFarmLng(e.target.value)}
                      placeholder="Lng"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Default: <code className="text-cyan-300">34.144709, 74.824525</code>
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Information Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                <span className="material-symbols-outlined text-base text-cyan-400">contact_mail</span>
                Store Contact Channels
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                    Primary WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                    Alternate Phone Number
                  </label>
                  <input
                    type="text"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                    Official Support Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            {/* Save All Changes Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer"
              >
                {isSaving ? "Saving All Changes…" : "Save All Staff Permissions & Store Settings"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
