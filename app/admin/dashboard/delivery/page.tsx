"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { SRINAGAR_LOCALITIES, calculateDistanceKm, type ZoneLocation } from "@/components/DeliveryRadiusMap";

// Dynamically import map to avoid SSR window issues
const DeliveryRadiusMap = dynamic(() => import("@/components/DeliveryRadiusMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[560px] rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-3 text-cyan-400">
      <span className="material-symbols-outlined text-4xl animate-spin">radar</span>
      <span className="text-sm font-semibold tracking-wider font-mono">Initializing Google Maps Radar…</span>
    </div>
  ),
});

const DEFAULT_FARM_LAT = 34.144709;
const DEFAULT_FARM_LNG = 74.824525;
const DEFAULT_FARM_NAME = "Urban Trout Farm (Malabagh, Naseem Bagh, Srinagar)";
const DEFAULT_RADIUS_KM = 5.0;

export default function DeliveryRadiusPage() {
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [farmLat, setFarmLat] = useState<number>(DEFAULT_FARM_LAT);
  const [farmLng, setFarmLng] = useState<number>(DEFAULT_FARM_LNG);
  const [farmName, setFarmName] = useState<string>(DEFAULT_FARM_NAME);
  const [deliveryFeeOutside, setDeliveryFeeOutside] = useState<string>("40");
  const [allowOutsideRadius, setAllowOutsideRadius] = useState<boolean>(false);
  const [maxDispatchMins, setMaxDispatchMins] = useState<string>("60");

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Table filter state
  const [tableTab, setTableTab] = useState<"all" | "inside" | "outside">("all");
  const [tableSearch, setTableSearch] = useState("");

  // Load Settings from Supabase
  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await supabase.from("app_settings").select("*");
        if (data) {
          data.forEach((row) => {
            if (row.key === "delivery_radius_km") {
              const val = parseFloat(row.value);
              if (!isNaN(val) && val > 0) setRadiusKm(val);
            }
            if (row.key === "farm_latitude") {
              const val = parseFloat(row.value);
              if (!isNaN(val)) setFarmLat(val);
            }
            if (row.key === "farm_longitude") {
              const val = parseFloat(row.value);
              if (!isNaN(val)) setFarmLng(val);
            }
            if (row.key === "farm_address_label" && row.value) {
              setFarmName(row.value);
            }
            if (row.key === "delivery_fee_outside_5km" || row.key === "delivery_fee_outside_radius") {
              setDeliveryFeeOutside(row.value);
            }
            if (row.key === "allow_outside_radius_delivery") {
              setAllowOutsideRadius(row.value === "true");
            }
            if (row.key === "max_dispatch_mins") {
              setMaxDispatchMins(row.value);
            }
          });
        }
      } catch (err) {
        console.error("Error loading delivery settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Compute zone distances
  const calculatedLocalities = useMemo(() => {
    return SRINAGAR_LOCALITIES.map((loc) => {
      const dist = calculateDistanceKm(farmLat, farmLng, loc.lat, loc.lng);
      const eligible = dist <= radiusKm;
      return {
        ...loc,
        distanceKm: dist,
        eligible,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [farmLat, farmLng, radiusKm]);

  const insideCount = calculatedLocalities.filter((l) => l.eligible).length;
  const outsideCount = calculatedLocalities.filter((l) => !l.eligible).length;
  const totalCount = calculatedLocalities.length;
  const coverageAreaSqKm = (Math.PI * radiusKm * radiusKm).toFixed(1);

  // Filtered table rows
  const filteredLocalities = useMemo(() => {
    return calculatedLocalities.filter((loc) => {
      const matchesTab =
        tableTab === "all" ? true : tableTab === "inside" ? loc.eligible : !loc.eligible;
      const matchesSearch =
        !tableSearch ||
        loc.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        loc.pincode.includes(tableSearch) ||
        (loc.landmark && loc.landmark.toLowerCase().includes(tableSearch.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  }, [calculatedLocalities, tableTab, tableSearch]);

  // Reset to default Naseem Bagh coordinates
  const handleResetToDefault = () => {
    setFarmLat(DEFAULT_FARM_LAT);
    setFarmLng(DEFAULT_FARM_LNG);
    setFarmName(DEFAULT_FARM_NAME);
  };

  // Copy coordinates
  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${farmLat}, ${farmLng}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  // Save Settings to Supabase
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSavedMsg("");

    try {
      const updates = [
        {
          key: "delivery_radius_km",
          value: radiusKm.toString(),
          description: "Deliverable radius in KM from Urban Trout Farm base for free live harvest dispatch",
        },
        {
          key: "farm_latitude",
          value: farmLat.toString(),
          description: "Latitude coordinate of Urban Trout Farm Hub",
        },
        {
          key: "farm_longitude",
          value: farmLng.toString(),
          description: "Longitude coordinate of Urban Trout Farm Hub",
        },
        {
          key: "farm_address_label",
          value: farmName.trim(),
          description: "Label and physical landmark of Urban Trout Farm Center",
        },
        {
          key: "delivery_fee_outside_5km",
          value: deliveryFeeOutside.trim(),
          description: "Delivery fee surcharge for orders beyond deliverable radius in Srinagar",
        },
        {
          key: "allow_outside_radius_delivery",
          value: allowOutsideRadius ? "true" : "false",
          description: "Whether customer checkout permits orders outside delivery radius with fee",
        },
        {
          key: "max_dispatch_mins",
          value: maxDispatchMins.trim(),
          description: "Target live dispatch delivery turnaround time in minutes",
        },
      ];

      for (const item of updates) {
        await supabase.from("app_settings").upsert(item, { onConflict: "key" });
      }

      setSavedMsg("Delivery Radius & Google Maps Radar settings saved successfully!");
      setTimeout(() => setSavedMsg(""), 4500);
    } catch (err) {
      console.error("Error saving delivery radius:", err);
      alert("Failed to save delivery settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ─── TOP HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
            <span className="material-symbols-outlined text-2xl">radar</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Delivery Radius &amp; Google Maps Radar
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold font-mono">
                Live Zone
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5" style={{ fontFamily: '"Manrope", sans-serif' }}>
              Configure the deliverable radius from Urban Trout Farm, visualize Srinagar zones on Google Maps, and manage delivery rules.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a
            href={`https://maps.google.com/?q=${farmLat},${farmLng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-cyan-400">open_in_new</span>
            Google Maps
          </a>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">save</span>
            {isSaving ? "Saving…" : "Save Delivery Rules"}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {savedMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-fadeIn shadow-lg shadow-emerald-500/10">
          <span className="material-symbols-outlined text-base">check_circle</span>
          {savedMsg}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-slate-500 font-mono">Loading Delivery Radar configuration…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ══════════════════════════════════════════════════════════
              LEFT COLUMN: INTERACTIVE GOOGLE MAPS RADAR & COVERAGE TABLE (8 cols)
              ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-6">
            {/* Map Visualizer Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    <span className="material-symbols-outlined text-cyan-400">explore</span>
                    Live Google Maps Radar &amp; Radius Zone
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Drag the farm marker or adjust the radius slider below to see real-time deliverable boundaries.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold font-mono">
                    {radiusKm} KM Radius
                  </span>
                </div>
              </div>

              {/* The Map Component */}
              <DeliveryRadiusMap
                radiusKm={radiusKm}
                farmLat={farmLat}
                farmLng={farmLng}
                farmName={farmName}
                onRadiusChange={(r) => setRadiusKm(r)}
                onCoordinatesChange={(lat, lng) => {
                  setFarmLat(lat);
                  setFarmLng(lng);
                }}
                allowDragFarmPin={true}
                height="540px"
              />

              {/* ─── RADIUS CONTROLLER & PRESETS ─── */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-300">
                      Deliverable Radius Range
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Adjust how far from Naseem Bagh farm orders are accepted with free same-day dispatch.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        step="0.5"
                        value={radiusKm}
                        onChange={(e) => setRadiusKm(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-right font-mono font-bold text-cyan-400 text-sm focus:outline-none focus:border-cyan-400"
                      />
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-slate-500 font-mono"></span>
                    </div>
                    <span className="text-xs font-bold text-slate-400">KM</span>
                  </div>
                </div>

                {/* Range Slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="0.5"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>1 KM</span>
                    <span>5 KM (Default)</span>
                    <span>10 KM</span>
                    <span>15 KM</span>
                    <span>20 KM</span>
                    <span>30 KM</span>
                  </div>
                </div>

                {/* Preset Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Presets:</span>
                  {[3, 5, 7.5, 10, 12, 15, 20, 25].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRadiusKm(preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                        radiusKm === preset
                          ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                          : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {preset} KM
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── LOCALITY COVERAGE MATRIX TABLE ─── */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    <span className="material-symbols-outlined text-emerald-400">table_chart</span>
                    Srinagar Locality Coverage Directory
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Real-time distance calculations from Naseem Bagh farm base for all tracked zones.
                  </p>
                </div>

                {/* Tab Filter */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setTableTab("all")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      tableTab === "all" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableTab("inside")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      tableTab === "inside" ? "bg-emerald-500 text-slate-950" : "text-emerald-400 hover:text-emerald-300"
                    }`}
                  >
                    Inside ({insideCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableTab("outside")}
                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      tableTab === "outside" ? "bg-red-500 text-white" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Outside ({outsideCount})
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-base">
                  search
                </span>
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter by locality name, landmark, or pincode (e.g. 190006, Hazratbal)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Locality / Landmark</th>
                      <th className="py-3 px-4">Pincode</th>
                      <th className="py-3 px-4">Distance</th>
                      <th className="py-3 px-4">Delivery Status</th>
                      <th className="py-3 px-4">Est. Dispatch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-medium text-slate-300">
                    {filteredLocalities.map((loc) => (
                      <tr key={loc.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{loc.name}</div>
                          {loc.landmark && <div className="text-[11px] text-slate-500">{loc.landmark}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-400">{loc.pincode}</td>
                        <td className="py-3 px-4 font-mono font-bold text-white">{loc.distanceKm.toFixed(1)} km</td>
                        <td className="py-3 px-4">
                          {loc.eligible ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                              <span>✓</span> Free Delivery
                            </span>
                          ) : allowOutsideRadius ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                              <span>+₹{deliveryFeeOutside}</span> Surcharge
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold inline-flex items-center gap-1">
                              <span>✕</span> Beyond Free Radius
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {loc.distanceKm <= 3
                            ? "20-35 mins"
                            : loc.distanceKm <= 6
                            ? "35-50 mins"
                            : loc.distanceKm <= 10
                            ? "50-70 mins"
                            : "75-90 mins"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              RIGHT COLUMN: FARM BASE CONFIG & DELIVERY POLICIES (4 cols)
              ══════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-4 space-y-6">
            {/* Farm Coordinates Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🐟</span>
                  <h3 className="text-base font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                    Farm Center Base
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
                >
                  Reset Default
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
                    Farm Base Label
                  </label>
                  <input
                    type="text"
                    value={farmName}
                    onChange={(e) => setFarmName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={farmLat}
                      onChange={(e) => setFarmLat(parseFloat(e.target.value) || DEFAULT_FARM_LAT)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={farmLng}
                      onChange={(e) => setFarmLng(parseFloat(e.target.value) || DEFAULT_FARM_LNG)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCoords}
                    className="flex-1 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-cyan-400">content_copy</span>
                    {copiedCoords ? "Copied!" : "Copy GPS Coords"}
                  </button>

                  <a
                    href={`https://maps.google.com/?q=${farmLat},${farmLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-emerald-400">directions</span>
                    Directions
                  </a>
                </div>
              </div>
            </div>

            {/* Delivery Policies Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  <span className="material-symbols-outlined text-cyan-400">policy</span>
                  Delivery Fee &amp; Order Policies
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
                    Delivery Fee Beyond Radius (₹)
                  </label>
                  <input
                    type="number"
                    value={deliveryFeeOutside}
                    onChange={(e) => setDeliveryFeeOutside(e.target.value)}
                    placeholder="40"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Surcharge charged when delivery is outside the {radiusKm} KM radius.
                  </p>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
                    Target Dispatch SLA (Minutes)
                  </label>
                  <input
                    type="number"
                    value={maxDispatchMins}
                    onChange={(e) => setMaxDispatchMins(e.target.value)}
                    placeholder="60"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Promised live fish harvest-to-doorstep delivery window displayed in checkout.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer hover:bg-slate-950">
                    <input
                      type="checkbox"
                      checked={allowOutsideRadius}
                      onChange={(e) => setAllowOutsideRadius(e.target.checked)}
                      className="mt-0.5 rounded accent-cyan-500"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">
                        Allow Checkout Outside Radius (with Surcharge)
                      </span>
                      <span className="text-[11px] text-slate-400 block leading-relaxed">
                        If unchecked, customer checkout strictly blocks orders located beyond {radiusKm} KM.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Coverage Quick Insights */}
            <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs space-y-2">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">info</span>
                Live Harvest Dispatch Guarantee
              </div>
              <p className="text-slate-400 leading-relaxed">
                Rainbow Trout are sensitive cold-water fish. Restricting delivery to a{" "}
                <strong className="text-cyan-300">{radiusKm} KM radius</strong> guarantees fish arrive with zero ice-melt degradation and maximum live freshness.
              </p>
            </div>

            {/* Bottom Save Action Button */}
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">save</span>
              {isSaving ? "Saving All Delivery Rules…" : "Save Delivery Rules to Database"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
