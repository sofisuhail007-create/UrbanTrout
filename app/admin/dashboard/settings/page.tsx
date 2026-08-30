"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
    name: "Suhail (Primary Owner)",
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
];

export default function AdminSettingsPage() {
  const [upiId, setUpiId] = useState("urbantrout@ybl");
  const [primaryPhone, setPrimaryPhone] = useState("+918491006127");
  const [alternatePhone, setAlternatePhone] = useState("+917006604148");
  const [email, setEmail] = useState("info.urbantrout@gmail.com");
  const [deliveryFee, setDeliveryFee] = useState("40");
  const [deliveryRadius, setDeliveryRadius] = useState("5.0");
  const [farmLat, setFarmLat] = useState("34.144709");
  const [farmLng, setFarmLng] = useState("74.824525");
  const [staffList, setStaffList] = useState<StaffMember[]>(DEFAULT_STAFF);

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

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from("app_settings").select("*");
        if (data) {
          data.forEach((row) => {
            if (row.key === "upi_id") setUpiId(row.value);
            if (row.key === "primary_phone") setPrimaryPhone(row.value);
            if (row.key === "alternate_phone") setAlternatePhone(row.value);
            if (row.key === "email") setEmail(row.value);
            if (row.key === "delivery_fee_outside_5km" || row.key === "delivery_fee_outside_radius") setDeliveryFee(row.value);
            if (row.key === "delivery_radius_km") setDeliveryRadius(row.value);
            if (row.key === "farm_latitude") setFarmLat(row.value);
            if (row.key === "farm_longitude") setFarmLng(row.value);
            if (row.key === "staff_permissions") {
              try {
                const parsed = JSON.parse(row.value);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setStaffList(parsed);
                }
              } catch {}
            }
          });
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedMsg("");

    try {
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
      ];

      for (const item of updates) {
        await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      }

      setSavedMsg("Settings & Staff Permissions saved successfully!");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
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
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-white text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                                {staff.name}
                              </h4>
                              {isOwner && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                  👑 Super Admin
                                </span>
                              )}
                            </div>
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
                  placeholder="e.g. urbantrout@ybl"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
                />
                <p className="text-xs text-slate-500">
                  Used to generate dynamic QR codes in both customer checkout and staff POS billing. Default: <code className="text-cyan-300">urbantrout@ybl</code>
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
                      min="1"
                      max="50"
                      step="0.5"
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
