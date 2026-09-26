"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch } from "@/lib/adminClient";
import { getBusinessHoursInfo } from "@/lib/businessHours";

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
  const [jkBankAccountNumber, setJkBankAccountNumber] = useState("");
  const [jkBankIfsc, setJkBankIfsc] = useState("JAKA0MALBAG");
  const [jkBankAccountName, setJkBankAccountName] = useState("Urban Trout Aquaculture");
  const [jkBankBranch, setJkBankBranch] = useState("Malabagh, Srinagar");
  const [primaryPhone, setPrimaryPhone] = useState("+918491006127");
  const [alternatePhone, setAlternatePhone] = useState("+917006604148");
  const [email, setEmail] = useState("info.urbantrout@gmail.com");
  const [deliveryFee, setDeliveryFee] = useState("40");
  const [deliveryRadius, setDeliveryRadius] = useState("5.0");
  const [farmLat, setFarmLat] = useState("34.1445563");
  const [farmLng, setFarmLng] = useState("74.8245018");
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
  const [farmMaintenanceActive, setFarmMaintenanceActive] = useState(false);
  const [isTogglingFarmMaintenance, setIsTogglingFarmMaintenance] = useState(false);
  const [allowFridayOrders, setAllowFridayOrders] = useState(false);
  const [isTogglingFridayOrders, setIsTogglingFridayOrders] = useState(false);
  const [forceStoreOpen, setForceStoreOpen] = useState(false);
  const [isTogglingForceOpen, setIsTogglingForceOpen] = useState(false);
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

  // ─── DYNAMIC GOOGLE REVIEW TRACKER STATE ───
  const [googleReviewUrl, setGoogleReviewUrl] = useState("https://g.page/r/CTVKEpV62HMmECE/review");
  const [googleReviewsCount, setGoogleReviewsCount] = useState("15");
  const [googleRating, setGoogleRating] = useState("4.9");
  const [googleMapsUrl, setGoogleMapsUrl] = useState("https://maps.app.goo.gl/4N8A8ywhJpys9EaDA");
  const [googlePlaceId, setGooglePlaceId] = useState("ChIJO-ZGTo2F4TgRNUoSlXrYcyY");
  const [googlePlacesApiKey, setGooglePlacesApiKey] = useState("");
  const [reviewTrackerSaving, setReviewTrackerSaving] = useState(false);
  const [reviewTrackerSavedMsg, setReviewTrackerSavedMsg] = useState("");
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);


  useEffect(() => {
    async function loadSettings() {
      // 1. Instant local cache read
      try {
        const local = localStorage.getItem("urban_trout_store_settings");
        if (local) {
          const map = JSON.parse(local);
          if (map.upi_id) setUpiId(map.upi_id);
          if (map.jk_bank_account_number !== undefined) setJkBankAccountNumber(map.jk_bank_account_number);
          if (map.jk_bank_ifsc) setJkBankIfsc(map.jk_bank_ifsc);
          if (map.jk_bank_account_name) setJkBankAccountName(map.jk_bank_account_name);
          if (map.jk_bank_branch) setJkBankBranch(map.jk_bank_branch);
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
          if (map.jk_bank_account_number !== undefined) setJkBankAccountNumber(map.jk_bank_account_number);
          if (map.jk_bank_ifsc) setJkBankIfsc(map.jk_bank_ifsc);
          if (map.jk_bank_account_name) setJkBankAccountName(map.jk_bank_account_name);
          if (map.jk_bank_branch) setJkBankBranch(map.jk_bank_branch);
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
          if (map.farm_maintenance_active !== undefined) {
            setFarmMaintenanceActive(map.farm_maintenance_active === "true");
          }
          if (map.allow_friday_orders !== undefined) {
            setAllowFridayOrders(map.allow_friday_orders === "true");
          }
          if (map.force_store_open !== undefined) {
            setForceStoreOpen(map.force_store_open === "true");
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
          if (map.google_review_url) setGoogleReviewUrl(map.google_review_url);
          if (map.google_reviews_count) setGoogleReviewsCount(map.google_reviews_count);
          if (map.google_rating) setGoogleRating(map.google_rating);
          if (map.google_maps_url) setGoogleMapsUrl(map.google_maps_url);
          if (map.google_place_id) setGooglePlaceId(map.google_place_id);
          if (map.google_places_api_key) setGooglePlacesApiKey(map.google_places_api_key);
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

  // ─── DYNAMIC GOOGLE REVIEW TRACKER HANDLERS ───
  const handleSaveReviewTracker = async (countOverride?: number) => {
    setReviewTrackerSaving(true);
    setReviewTrackerSavedMsg("");
    try {
      const countToSave = countOverride !== undefined ? countOverride : parseInt(googleReviewsCount, 10) || 15;
      const res = await adminFetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewCount: countToSave,
          rating: parseFloat(googleRating) || 4.9,
          reviewUrl: googleReviewUrl.trim(),
          mapsUrl: googleMapsUrl.trim(),
          placeId: googlePlaceId.trim(),
          apiKey: googlePlacesApiKey.trim() || undefined,
          action: "update",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to update review tracker");
      if (data.reviews) {
        setGoogleReviewsCount(String(data.reviews.reviewCount));
        setGoogleRating(String(data.reviews.rating));
      }
      setReviewTrackerSavedMsg(`✓ Live website updated to ${googleRating} ★ with ${countToSave} reviews!`);
      setTimeout(() => setReviewTrackerSavedMsg(""), 5000);
    } catch (err: any) {
      setReviewTrackerSavedMsg("⚠️ " + (err.message || err));
      setTimeout(() => setReviewTrackerSavedMsg(""), 5000);
    } finally {
      setReviewTrackerSaving(false);
    }
  };

  const handleQuickIncrementReview = () => {
    const next = (parseInt(googleReviewsCount, 10) || 15) + 1;
    setGoogleReviewsCount(String(next));
    handleSaveReviewTracker(next);
  };

  const handleSyncFromGoogle = async () => {
    if (!googlePlacesApiKey.trim()) {
      alert("Please enter a Google Cloud Places API key in the field below to enable direct Google server synchronization.");
      return;
    }
    setIsSyncingGoogle(true);
    setReviewTrackerSavedMsg("");
    try {
      const res = await adminFetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: googlePlaceId.trim(),
          apiKey: googlePlacesApiKey.trim(),
          action: "sync",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Sync failed");
      if (data.reviews) {
        setGoogleReviewsCount(String(data.reviews.reviewCount));
        setGoogleRating(String(data.reviews.rating));
      }
      setReviewTrackerSavedMsg("✓ " + data.message);
      setTimeout(() => setReviewTrackerSavedMsg(""), 5000);
    } catch (err: any) {
      setReviewTrackerSavedMsg("⚠️ " + (err.message || err));
      setTimeout(() => setReviewTrackerSavedMsg(""), 5000);
    } finally {
      setIsSyncingGoogle(false);
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

  // Toggle Farm & Vending Center Maintenance
  const handleToggleFarmMaintenance = async () => {
    const newVal = !farmMaintenanceActive;
    setFarmMaintenanceActive(newVal);
    setIsTogglingFarmMaintenance(true);
    try {
      const item = {
        key: "farm_maintenance_active",
        value: String(newVal),
        description: "Farm & Vending Center Maintenance mode — pauses online checkout and displays maintenance notice",
      };
      await adminFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([item]),
      });
      await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      setSavedMsg(newVal ? "🛠️ Farm & Vending Center Maintenance is now ACTIVE — checkout paused." : "✅ Farm Maintenance concluded — normal operations restored.");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.warn("Farm maintenance toggle notice:", err);
    } finally {
      setIsTogglingFarmMaintenance(false);
    }
  };

  // Toggle Friday Farm Operations (Open for Online Orders)
  const handleToggleFridayOrders = async () => {
    const newVal = !allowFridayOrders;
    setAllowFridayOrders(newVal);
    setIsTogglingFridayOrders(true);
    try {
      const item = {
        key: "allow_friday_orders",
        value: String(newVal),
        description: "Allow online orders on Fridays (7:00 AM – 10:00 PM IST) when farm/vending center is open",
      };
      await adminFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([item]),
      });
      await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      setSavedMsg(newVal ? "🟢 Friday Farm & Vending Center is OPEN — customers can place online orders on Fridays!" : "📅 Friday maintenance schedule restored — closed on Fridays.");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.warn("Friday orders toggle notice:", err);
    } finally {
      setIsTogglingFridayOrders(false);
    }
  };

  // Toggle Force Store Open (24/7)
  const handleToggleForceOpen = async () => {
    const newVal = !forceStoreOpen;
    setForceStoreOpen(newVal);
    setIsTogglingForceOpen(true);
    try {
      const item = {
        key: "force_store_open",
        value: String(newVal),
        description: "Force store open override — bypasses all operating hours and maintenance checks",
      };
      await adminFetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([item]),
      });
      await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      setSavedMsg(newVal ? "⚡ 24/7 Force Open is ACTIVE — store will accept orders regardless of hours." : "⏰ 24/7 Force Open disabled — standard operating hours enforced.");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.warn("Force open toggle notice:", err);
    } finally {
      setIsTogglingForceOpen(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedMsg("");

    const updates = [
      { key: "store_manually_closed", value: String(storeManuallyClosed), description: "Manual store closure override" },
      { key: "farm_maintenance_active", value: String(farmMaintenanceActive), description: "Farm & Vending Center Maintenance active toggle" },
      { key: "allow_friday_orders", value: String(allowFridayOrders), description: "Allow customer online orders on Fridays" },
      { key: "force_store_open", value: String(forceStoreOpen), description: "Force store open override" },
      { key: "upi_id", value: upiId.trim(), description: "Primary UPI ID for customer direct checkout payments" },
      { key: "jk_bank_account_number", value: jkBankAccountNumber.trim(), description: "J&K Bank account number for direct mPay and IMPS/NEFT transfers" },
      { key: "jk_bank_ifsc", value: jkBankIfsc.trim(), description: "J&K Bank IFSC Code" },
      { key: "jk_bank_account_name", value: jkBankAccountName.trim(), description: "J&K Bank account beneficiary holder name" },
      { key: "jk_bank_branch", value: jkBankBranch.trim(), description: "J&K Bank account branch name" },
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
              SECTION 0: FACILITY & STORE OPERATIONS COMMAND CENTER
              ══════════════════════════════════════════════════════════ */}
          {(() => {
            const liveStatus = getBusinessHoursInfo(new Date(), {
              storeManuallyClosed,
              farmMaintenanceActive,
              allowFridayOrders,
              forceStoreOpen,
            });

            return (
              <div className="space-y-4">
                {/* 1. Live Real-Time Customer Status Beacon */}
                <div
                  className={`relative overflow-hidden rounded-3xl p-6 md:p-7 border transition-all duration-500 shadow-2xl ${
                    liveStatus.isOpen
                      ? "bg-gradient-to-r from-emerald-950/50 via-slate-900/90 to-slate-900/90 border-emerald-500/40"
                      : liveStatus.closedReason === "farm_maintenance"
                      ? "bg-gradient-to-r from-amber-950/60 via-slate-900/90 to-slate-900/90 border-amber-500/40"
                      : liveStatus.closedReason === "friday_maintenance"
                      ? "bg-gradient-to-r from-amber-950/50 via-slate-900/90 to-slate-900/90 border-amber-500/35"
                      : liveStatus.closedReason === "manual"
                      ? "bg-gradient-to-r from-red-950/60 via-slate-900/90 to-slate-900/90 border-red-500/40"
                      : "bg-gradient-to-r from-cyan-950/40 via-slate-900/90 to-slate-900/90 border-cyan-500/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 border ${
                          liveStatus.isOpen
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                            : liveStatus.closedReason === "farm_maintenance"
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                            : liveStatus.closedReason === "friday_maintenance"
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                            : liveStatus.closedReason === "manual"
                            ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                        }`}
                      >
                        {liveStatus.isOpen
                          ? "🟢"
                          : liveStatus.closedReason === "farm_maintenance"
                          ? "🛠️"
                          : liveStatus.closedReason === "friday_maintenance"
                          ? "📅"
                          : liveStatus.closedReason === "manual"
                          ? "🔴"
                          : "⏰"}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-bold text-white font-['Space_Grotesk']">
                            Live Customer View:{" "}
                            <span
                              className={
                                liveStatus.isOpen
                                  ? "text-emerald-300"
                                  : liveStatus.closedReason === "farm_maintenance"
                                  ? "text-amber-300"
                                  : liveStatus.closedReason === "friday_maintenance"
                                  ? "text-amber-300"
                                  : liveStatus.closedReason === "manual"
                                  ? "text-red-300"
                                  : "text-cyan-300"
                              }
                            >
                              {liveStatus.isOpen
                                ? "Store Open · Accepting Orders"
                                : liveStatus.closedReason === "farm_maintenance"
                                ? "Closed for Farm Maintenance"
                                : liveStatus.closedReason === "friday_maintenance"
                                ? "Closed for Friday Maintenance"
                                : liveStatus.closedReason === "manual"
                                ? "Manually Paused"
                                : "Closed Outside Operating Hours"}
                            </span>
                          </h2>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono border ${
                              liveStatus.isOpen
                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                : "bg-slate-800/80 border-slate-700 text-slate-300"
                            }`}
                          >
                            {liveStatus.isOpen ? "Ordering Active" : "Ordering Paused"}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 mt-1 font-['Manrope']">
                          {liveStatus.isOpen
                            ? "✅ Checkout is enabled. Customers can order fresh harvest online."
                            : liveStatus.closedReason === "farm_maintenance"
                            ? "⚠️ Customers see the Farm Maintenance banner with our WhatsApp contact CTA."
                            : liveStatus.closedReason === "friday_maintenance"
                            ? "⚠️ Closed for regular Friday maintenance. Toggle 'Friday Store Operations' below if your farm is open today!"
                            : liveStatus.closedReason === "manual"
                            ? "⚠️ Store manually closed by administrator. Toggle Emergency Pause below to resume."
                            : `⏰ Standard schedule: 7:00 AM – 10:00 PM IST. Next opening: ${liveStatus.nextOpenLabel}.`}
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">Srinagar Local Time</span>
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        {new Intl.DateTimeFormat("en-IN", {
                          timeZone: "Asia/Kolkata",
                          weekday: "short",
                          hour: "numeric",
                          minute: "numeric",
                          hour12: true,
                        }).format(new Date())} IST
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Operations Controls Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                  {/* CONTROL 1: FARM & VENDING CENTER MAINTENANCE */}
                  <div
                    className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                      farmMaintenanceActive
                        ? "bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-950/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg">
                          🛠️
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            farmMaintenanceActive
                              ? "bg-amber-500/25 border-amber-500/40 text-amber-300"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          {farmMaintenanceActive ? "Maintenance Active" : "Operational"}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base font-['Space_Grotesk'] mb-1">
                        Farm &amp; Vending Maintenance
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-['Manrope'] mb-4">
                        Turn ON when doing RAS bio-filter backwashing, deep sanitization, or tank upkeep. Pauses online checkout and displays the transparent maintenance banner.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        {isTogglingFarmMaintenance ? "Saving…" : farmMaintenanceActive ? "Maintenance Mode ON" : "Maintenance Mode OFF"}
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleFarmMaintenance}
                        disabled={isTogglingFarmMaintenance}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                          farmMaintenanceActive ? "bg-amber-500" : "bg-slate-700"
                        }`}
                        aria-label="Toggle Farm Maintenance"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                            farmMaintenanceActive ? "translate-x-8" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* CONTROL 2: FRIDAY STORE OPERATIONS */}
                  <div
                    className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                      allowFridayOrders
                        ? "bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-950/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-lg">
                          📅
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            allowFridayOrders
                              ? "bg-emerald-500/25 border-emerald-500/40 text-emerald-300"
                              : "bg-slate-800 border-slate-700 text-slate-400"
                          }`}
                        >
                          {allowFridayOrders ? "Open on Fridays" : "Closed Fridays (Default)"}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base font-['Space_Grotesk'] mb-1">
                        Friday Store Operations
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-['Manrope'] mb-4">
                        By default, Fridays are reserved for weekly farm maintenance. Turn this ON whenever you keep the farm or vending center open on a Friday (7 AM – 10 PM IST) to accept orders.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        {isTogglingFridayOrders ? "Saving…" : allowFridayOrders ? "Friday Ordering Allowed" : "Friday Orders Blocked"}
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleFridayOrders}
                        disabled={isTogglingFridayOrders}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                          allowFridayOrders ? "bg-emerald-500" : "bg-slate-700"
                        }`}
                        aria-label="Toggle Friday Operations"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                            allowFridayOrders ? "translate-x-8" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* CONTROL 3: EMERGENCY STORE PAUSE OVERRIDE */}
                  <div
                    className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                      storeManuallyClosed
                        ? "bg-red-950/40 border-red-500/50 shadow-lg shadow-red-950/30"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 text-lg">
                          ⏸️
                        </div>
                        <span
                          className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            storeManuallyClosed
                              ? "bg-red-500/25 border-red-500/40 text-red-300"
                              : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                          }`}
                        >
                          {storeManuallyClosed ? "Store Paused" : "Accepting Orders"}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base font-['Space_Grotesk'] mb-1">
                        Emergency Store Pause
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-['Manrope'] mb-4">
                        Instantly pause all online orders for short breaks, inventory restocking, or adverse weather. Customers will see a closed banner with a WhatsApp contact CTA.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        {isTogglingStore ? "Saving…" : storeManuallyClosed ? "Orders Paused" : "Active & Accepting"}
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleStore}
                        disabled={isTogglingStore}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                          storeManuallyClosed ? "bg-red-500" : "bg-emerald-500"
                        }`}
                        aria-label="Toggle Manual Store Closure"
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                            storeManuallyClosed ? "translate-x-8" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                </div>

                {/* Optional Quick Force-Open / Advance Note bar */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-cyan-400">info</span>
                    <span>
                      Standard Operating Schedule: <strong>Sat – Thu: 7:00 AM – 10:00 PM IST</strong> (Closed Fridays unless toggled above).
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-slate-300">Force Open 24/7 (Testing Mode):</span>
                    <button
                      type="button"
                      onClick={handleToggleForceOpen}
                      disabled={isTogglingForceOpen}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                        forceStoreOpen ? "bg-cyan-500" : "bg-slate-700"
                      }`}
                      title="Force Store Open (Bypasses all business hours and maintenance)"
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform ${
                          forceStoreOpen ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
              ⭐ DYNAMIC GOOGLE REVIEW TRACKER & LIVE STORE BADGE
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-slate-900/80 border border-yellow-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center text-yellow-400 flex-shrink-0">
                  <span className="material-symbols-outlined text-2xl">star</span>
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                      Dynamic Google Review Tracker &amp; Live Badges
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                      Live Synced
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    Controls the review count and star rating dynamically displayed across your homepage, about farm page, and contact page. No code deployments needed.
                  </p>
                </div>
              </div>

              {/* Quick +1 Review Button */}
              <button
                type="button"
                onClick={handleQuickIncrementReview}
                disabled={reviewTrackerSaving}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer shrink-0 disabled:opacity-50"
                title="Quickly add 1 to the review count and update the website instantly"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>+1 Review (Now {(parseInt(googleReviewsCount, 10) || 15) + 1})</span>
              </button>
            </div>

            {/* Live Store Badge Preview */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Live Customer Preview (How it renders on website):
                </span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  ● Real-time
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 font-bold text-xs">
                  <span>📍 Google Maps ({googleRating} ★ {googleReviewsCount} Reviews)</span>
                  <span>↗</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold font-mono">
                  <span>★ {googleRating} on Google Maps</span>
                  <span className="w-1 h-1 rounded-full bg-amber-400/60" />
                  <span>{googleReviewsCount} Verified Reviews</span>
                </div>
              </div>
            </div>

            {/* Metric Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase font-mono block">
                  Total Reviews Count:
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={googleReviewsCount}
                  onChange={(e) => setGoogleReviewsCount(e.target.value)}
                  placeholder="15"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-yellow-400 font-mono transition-all"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  Currently: {googleReviewsCount} reviews on Google
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase font-mono block">
                  Star Rating (out of 5.0):
                </label>
                <input
                  type="number"
                  min="1.0"
                  max="5.0"
                  step="0.1"
                  value={googleRating}
                  onChange={(e) => setGoogleRating(e.target.value)}
                  placeholder="4.9"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-yellow-400 focus:outline-none focus:border-yellow-400 font-mono transition-all"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  e.g. 4.9 or 5.0
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase font-mono block">
                  Google Place ID:
                </label>
                <input
                  type="text"
                  value={googlePlaceId}
                  onChange={(e) => setGooglePlaceId(e.target.value)}
                  placeholder="ChIJO-ZGTo2F4TgRNUoSlXrYcyY"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-yellow-400 font-mono transition-all"
                />
                <p className="text-[10px] text-slate-500 font-mono">
                  Urban Trout Aquaculture Place ID
                </p>
              </div>
            </div>

            {/* Links Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block">
                  Customer Review Write Link (Sent on WhatsApp):
                </label>
                <input
                  type="url"
                  value={googleReviewUrl}
                  onChange={(e) => setGoogleReviewUrl(e.target.value)}
                  placeholder="https://g.page/r/CTVKEpV62HMmECE/review"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-yellow-400 font-mono transition-all"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Used by POS billing &amp; customer ledger WhatsApp buttons</span>
                  <a
                    href={googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    Test Link ↗
                  </a>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase font-mono block">
                  Google Maps Store URL (Badges Click Destination):
                </label>
                <input
                  type="url"
                  value={googleMapsUrl}
                  onChange={(e) => setGoogleMapsUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/4N8A8ywhJpys9EaDA"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-yellow-400 font-mono transition-all"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Target URL when visitors click the Google Maps badge</span>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    Open Maps ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Optional Google Cloud API Key for Automatic Sync */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 font-mono uppercase">
                  Google Places API Key (Optional — For 1-Click Server Sync):
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Google Cloud Console
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={googlePlacesApiKey}
                  onChange={(e) => setGooglePlacesApiKey(e.target.value)}
                  placeholder="AIzaSy... (Leave blank if updating manually)"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-yellow-400 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSyncFromGoogle}
                  disabled={isSyncingGoogle || !googlePlacesApiKey.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 font-mono text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  {isSyncingGoogle ? (
                    <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent animate-spin rounded-full" />
                  ) : (
                    <span className="material-symbols-outlined text-base">sync</span>
                  )}
                  <span>Sync from Google</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                When provided, clicking &ldquo;Sync from Google&rdquo; queries Google Places API directly to fetch the exact review count &amp; star rating.
              </p>
            </div>

            {reviewTrackerSavedMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${reviewTrackerSavedMsg.startsWith("✓") ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400" : "bg-red-500/15 border border-red-500/30 text-red-400"}`}>
                {reviewTrackerSavedMsg}
              </div>
            )}

            {/* Action Row */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleSaveReviewTracker()}
                disabled={reviewTrackerSaving}
                className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-yellow-500/20"
              >
                {reviewTrackerSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-800 border-t-transparent animate-spin rounded-full" />
                    <span>Updating Live Site…</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>Save &amp; Update Live Website</span>
                  </>
                )}
              </button>

              <a
                href="https://www.google.com/search?q=Urban+Trout+Aquaculture+Srinagar"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold border border-slate-700 transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                <span>Check Live Reviews on Google Search ↗</span>
              </a>
            </div>
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    <span className="material-symbols-outlined text-base">account_balance</span>
                    UPI &amp; J&amp;K Bank Settlement Configuration
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure your UPI Merchant ID and J&amp;K Bank details for instant direct WhatsApp bill settlements (0-day wait, zero gateway fees).
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
                  ⚡ 0-Day Settlement
                </span>
              </div>

              {/* UPI ID */}
              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
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
                <p className="text-xs text-slate-500 font-mono">
                  Used to generate dynamic QR codes in customer checkout, public invoices, and WhatsApp bills. Default: <code className="text-cyan-300">JKBMERC00828895@jkb</code>
                </p>
              </div>

              {/* J&K Bank Direct Transfer Details Grid */}
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-mono">
                  <span>🏦</span>
                  <span>J&amp;K Bank Direct Account Transfer (mPay Delight+ &amp; IMPS / NEFT)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                      J&amp;K Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={jkBankAccountNumber}
                      onChange={(e) => setJkBankAccountNumber(e.target.value)}
                      placeholder="e.g. 0082040100001234"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-400"
                    />
                    <p className="text-[11px] text-slate-500 font-mono">
                      Included in WhatsApp bill templates so customers can transfer directly via mPay Delight+.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                      J&amp;K Bank IFSC Code
                    </label>
                    <input
                      type="text"
                      value={jkBankIfsc}
                      onChange={(e) => setJkBankIfsc(e.target.value.toUpperCase())}
                      placeholder="e.g. JAKA0MALBAG"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono uppercase focus:outline-none focus:border-emerald-400"
                    />
                    <p className="text-[11px] text-slate-500 font-mono">
                      Branch IFSC for IMPS/NEFT transfers. Default: <code className="text-emerald-300">JAKA0MALBAG</code>
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                      Beneficiary Account Name
                    </label>
                    <input
                      type="text"
                      value={jkBankAccountName}
                      onChange={(e) => setJkBankAccountName(e.target.value)}
                      placeholder="e.g. Urban Trout Aquaculture"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 font-mono">
                      J&amp;K Bank Branch Name
                    </label>
                    <input
                      type="text"
                      value={jkBankBranch}
                      onChange={(e) => setJkBankBranch(e.target.value)}
                      placeholder="e.g. Malabagh, Srinagar"
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
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
                    Default: <code className="text-cyan-300">34.1445563, 74.8245018</code>
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
