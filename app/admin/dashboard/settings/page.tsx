"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminSettingsPage() {
  const [upiId, setUpiId] = useState("urbantrout@ybl");
  const [primaryPhone, setPrimaryPhone] = useState("+918491006127");
  const [alternatePhone, setAlternatePhone] = useState("+917006604148");
  const [email, setEmail] = useState("info.urbantrout@gmail.com");
  const [deliveryFee, setDeliveryFee] = useState("40");
  const [adminWhitelist, setAdminWhitelist] = useState("sofisuhail007@gmail.com");
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
            if (row.key === "delivery_fee_outside_5km") setDeliveryFee(row.value);
            if (row.key === "admin_whitelist") setAdminWhitelist(row.value);
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
        { key: "delivery_fee_outside_5km", value: deliveryFee.trim(), description: "Delivery fee beyond 5km in Srinagar" },
        { key: "admin_whitelist", value: adminWhitelist.trim(), description: "Comma-separated list of Google emails allowed into Admin Panel" },
      ];

      for (const item of updates) {
        await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      }

      setSavedMsg("Settings saved successfully! Admin whitelist & store settings updated.");
      setTimeout(() => setSavedMsg(""), 4000);
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
          <span className="material-symbols-outlined">settings</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
            Store &amp; Admin Settings
          </h1>
          <p className="text-slate-400 text-sm mt-0.5" style={{ fontFamily: '"Manrope", sans-serif' }}>
            Manage your checkout UPI ID, delivery rules, and authorized Admin Google Accounts.
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
        <form onSubmit={handleSave} className="space-y-6">
          {/* Admin Google Accounts Access Whitelist */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                Authorized Admin Google Accounts (Whitelist)
              </h2>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[11px] font-bold uppercase tracking-wider">
                Google OAuth
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                Permitted Google Email Addresses <span className="text-red-400">*</span>
              </label>
              <textarea
                value={adminWhitelist}
                onChange={(e) => setAdminWhitelist(e.target.value)}
                rows={3}
                required
                placeholder="sofisuhail007@gmail.com, manager@gmail.com, partner@urbantrout.in"
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-cyan-400 resize-y"
              />
              <p className="text-xs text-slate-500 leading-relaxed">
                Enter comma-separated Google email accounts that are permitted to sign in to the Admin Panel. Any other account attempting to sign in with Google will be denied access automatically.
              </p>
            </div>
          </div>

          {/* Payment Settings Card */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-5">
            <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              <span className="material-symbols-outlined text-base">qr_code_2</span>
              UPI Payment Gateway Configuration
            </h2>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                Primary UPI ID for Checkout <span className="text-red-400">*</span>
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
                This UPI ID is used to generate the dynamic QR Code and payment intents shown to customers on the checkout page. Default: <code className="text-cyan-300">urbantrout@ybl</code>
              </p>
            </div>
          </div>

          {/* Delivery & Contact Configuration */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              <span className="material-symbols-outlined text-base text-cyan-400">contact_mail</span>
              Contact &amp; Delivery Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  Official Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs uppercase tracking-wider font-bold text-slate-400">
                  Delivery Fee Beyond 5km (₹)
                </label>
                <input
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {isSaving ? "Saving…" : "Save All Changes"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
