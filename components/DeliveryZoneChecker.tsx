"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  DELIVERY_ZONES,
  SRINAGAR_LOCALITY_CATALOG,
  evaluateDeliveryZone,
  FARM_COORDS,
  DeliveryCheckResult,
  LocalityData,
} from "@/lib/deliveryZones";

export default function DeliveryZoneChecker() {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [activeZoneTab, setActiveZoneTab] = useState<"all" | "zone1" | "zone2" | "zone3" | "out_of_zone">("all");
  const [checkResult, setCheckResult] = useState<DeliveryCheckResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtered localities for autocomplete dropdown
  const filteredSuggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return SRINAGAR_LOCALITY_CATALOG.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.pincode.includes(q) ||
        loc.aliases.some((a) => a.includes(q))
    ).slice(0, 8);
  }, [query]);

  // Handle locality selection
  const handleSelectLocality = (loc: LocalityData) => {
    setQuery(loc.name);
    setShowDropdown(false);
    const res = evaluateDeliveryZone({ localityInput: loc.name, weightKg: 2 });
    setCheckResult(res);
  };

  // Handle manual input search
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setShowDropdown(false);
    setIsSearching(true);
    setTimeout(() => {
      const res = evaluateDeliveryZone({ localityInput: query, weightKg: 2 });
      setCheckResult(res);
      setIsSearching(false);
    }, 150);
  };

  // Handle browser GPS detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser. Please type your locality name.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        const res = evaluateDeliveryZone({
          coords: { lat: latitude, lng: longitude },
          weightKg: 2,
        });
        setQuery(res.localityDisplayName);
        setCheckResult(res);
      },
      (err) => {
        setIsLocating(false);
        alert("Could not detect location. Please type your Srinagar area / locality name.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="max-w-4xl mx-auto mb-12">
      {/* ── Outer Cyber-Aquatic Card ── */}
      <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-b from-[#061824] to-[#031018] border border-cyan-500/30 backdrop-blur-xl shadow-2xl shadow-cyan-950/40 relative overflow-hidden">
        {/* Glow corner accent */}
        <div className="absolute -top-24 -right-24 w-52 h-52 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* ── Header Area ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 border-b border-cyan-500/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-inner shadow-cyan-500/30">
              <span className="text-2xl">🐟</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Live Harvest Cold-Chain
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Active Delivery Radius: Up to 8 km
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white mt-1 tracking-tight" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Check Doorstep Delivery for Your Srinagar Area
              </h3>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span>🏪</span>
              <span>Counter Pickup: All Srinagar</span>
            </span>
          </div>
        </div>

        {/* ── Interactive Search & GPS Bar ── */}
        <div className="relative mb-5" ref={dropdownRef}>
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Type your locality (e.g. Lal Chowk, Khanyar, Hawal, Shalimar, Soura, Dalgate)..."
                className="w-full pl-10 pr-24 py-3 rounded-xl bg-slate-950/80 border border-cyan-500/40 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-sans"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCheckResult(null);
                  }}
                  className="absolute inset-y-0 right-2 px-2 flex items-center text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="px-3.5 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-xs font-bold text-slate-200 hover:text-cyan-300 transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer shadow-md"
                title="Detect delivery zone using device GPS"
              >
                {isLocating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>Detecting...</span>
                  </>
                ) : (
                  <>
                    <span>📍</span>
                    <span>Use GPS</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 shadow-lg shadow-cyan-500/30 cursor-pointer"
              >
                <span>Check Zone</span>
                <span>→</span>
              </button>
            </div>
          </form>

          {/* Autocomplete Dropdown */}
          {showDropdown && filteredSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 py-1.5 rounded-2xl bg-slate-950 border border-cyan-500/40 shadow-2xl z-30 max-h-60 overflow-y-auto backdrop-blur-xl">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
                Matching Srinagar Localities ({filteredSuggestions.length})
              </div>
              {filteredSuggestions.map((loc) => {
                const zone = DELIVERY_ZONES[loc.tier];
                return (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => handleSelectLocality(loc)}
                    className="w-full px-3.5 py-2 text-left hover:bg-cyan-950/50 flex items-center justify-between text-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400">📍</span>
                      <span className="font-semibold text-white group-hover:text-cyan-300">
                        {loc.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">({loc.pincode})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">~{loc.distKm} km</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: zone.badgeBg,
                          borderColor: zone.badgeBorder,
                          color: zone.badgeText,
                          borderWidth: "1px",
                        }}
                      >
                        {zone.shortLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Live Result Banner (When user checked a locality) ── */}
        {checkResult && (
          <div
            className="mb-5 p-4 rounded-2xl border transition-all animate-fadeIn"
            style={{
              backgroundColor: checkResult.isDeliverable ? "rgba(6, 32, 45, 0.9)" : "rgba(35, 20, 10, 0.9)",
              borderColor: checkResult.isDeliverable ? checkResult.zoneConfig.badgeBorder : "rgba(245, 158, 11, 0.4)",
            }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                    style={{
                      backgroundColor: checkResult.zoneConfig.badgeBg,
                      color: checkResult.zoneConfig.badgeText,
                      border: `1px solid ${checkResult.zoneConfig.badgeBorder}`,
                    }}
                  >
                    {checkResult.zoneConfig.title}
                  </span>
                  <span className="text-xs font-mono text-cyan-300 font-bold">
                    📍 {checkResult.localityDisplayName} (~{checkResult.distanceKm.toFixed(1)} km from Malabagh Farm)
                  </span>
                </div>

                <h4 className="text-sm sm:text-base font-bold text-white mt-1.5" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                  {checkResult.statusHeadline}
                </h4>

                <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
                  {checkResult.deliveryMessage}
                </p>

                {checkResult.upgradeAdvice && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-semibold">
                    <span>💡</span>
                    <span>{checkResult.upgradeAdvice}</span>
                  </div>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
                {checkResult.isDeliverable ? (
                  <Link
                    href="/shop"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-slate-950 font-bold text-xs uppercase tracking-wider text-center shadow-lg transition-all"
                  >
                    Order Fresh Trout →
                  </Link>
                ) : (
                  <a
                    href={FARM_COORDS.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wider text-center transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Maps & Vending Center</span>
                    <span>↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 4-Zone Interactive Overview Pills ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[10px] text-slate-300">
              Delivery Coverage Tiers & Minimum Orders
            </span>
            <span className="text-[11px] text-cyan-400">Click a tier to see sample localities</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Zone 1 Pill */}
            <button
              type="button"
              onClick={() => setActiveZoneTab(activeZoneTab === "zone1" ? "all" : "zone1")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeZoneTab === "zone1"
                  ? "bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-500/30"
                  : "bg-slate-950/60 border-slate-800 hover:border-emerald-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">Zone 1 (0–4 km)</span>
                <span className="text-xs">🟢</span>
              </div>
              <div className="font-extrabold text-white text-xs mt-1">FREE from 2 kg</div>
              <div className="text-[10px] text-slate-400 mt-0.5">₹100 fee for 1 kg</div>
            </button>

            {/* Zone 2 Pill */}
            <button
              type="button"
              onClick={() => setActiveZoneTab(activeZoneTab === "zone2" ? "all" : "zone2")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeZoneTab === "zone2"
                  ? "bg-sky-950/80 border-sky-400 ring-2 ring-sky-500/30"
                  : "bg-slate-950/60 border-slate-800 hover:border-sky-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-sky-400 uppercase">Zone 2 (4–6 km)</span>
                <span className="text-xs">🔵</span>
              </div>
              <div className="font-extrabold text-white text-xs mt-1">FREE from 3 kg</div>
              <div className="text-[10px] text-slate-400 mt-0.5">₹250 fee for 1–2 kg</div>
            </button>

            {/* Zone 3 Pill */}
            <button
              type="button"
              onClick={() => setActiveZoneTab(activeZoneTab === "zone3" ? "all" : "zone3")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeZoneTab === "zone3"
                  ? "bg-purple-950/80 border-purple-400 ring-2 ring-purple-500/30"
                  : "bg-slate-950/60 border-slate-800 hover:border-purple-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-purple-400 uppercase">Zone 3 (6–8 km)</span>
                <span className="text-xs">🟣</span>
              </div>
              <div className="font-extrabold text-white text-xs mt-1">FREE from 4 kg</div>
              <div className="text-[10px] text-slate-400 mt-0.5">₹300 fee for 1–3 kg</div>
            </button>

            {/* Counter Pickup Pill */}
            <button
              type="button"
              onClick={() => setActiveZoneTab(activeZoneTab === "out_of_zone" ? "all" : "out_of_zone")}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                activeZoneTab === "out_of_zone"
                  ? "bg-amber-950/80 border-amber-400 ring-2 ring-amber-500/30"
                  : "bg-slate-950/60 border-slate-800 hover:border-amber-500/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">Beyond 8 km</span>
                <span className="text-xs">🏪</span>
              </div>
              <div className="font-extrabold text-white text-xs mt-1">Counter Pickup</div>
              <div className="text-[10px] text-slate-400 mt-0.5">All Srinagar welcome</div>
            </button>
          </div>

          {/* Locality list for active tier */}
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {activeZoneTab === "all"
                  ? "Key Localities Across All Srinagar Zones (Click any to test)"
                  : activeZoneTab === "zone1"
                  ? "Zone 1 Localities (0–4 km — 100% Free on 2 kg+)"
                  : activeZoneTab === "zone2"
                  ? "Zone 2 Localities (4–6 km — 100% Free on 3 kg+)"
                  : activeZoneTab === "zone3"
                  ? "Zone 3 Extended Localities (6–8 km — 100% Free on 4 kg+)"
                  : "Beyond 8 km Localities (Counter Pickup at Malabagh Farm Hub)"}
              </span>
              {activeZoneTab !== "all" && (
                <button
                  type="button"
                  onClick={() => setActiveZoneTab("all")}
                  className="text-[10px] text-cyan-400 hover:underline"
                >
                  Show All Tiers
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {SRINAGAR_LOCALITY_CATALOG.filter((loc) =>
                activeZoneTab === "all" ? true : loc.tier === activeZoneTab
              ).map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => handleSelectLocality(loc)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                    loc.tier === "zone1"
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/50"
                      : loc.tier === "zone2"
                      ? "bg-sky-950/40 border-sky-500/30 text-sky-300 hover:bg-sky-900/50"
                      : loc.tier === "zone3"
                      ? "bg-purple-950/40 border-purple-500/30 text-purple-300 hover:bg-purple-900/50"
                      : "bg-slate-900/60 border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <span>{loc.name}</span>
                  <span className="text-[9px] opacity-75 font-mono ml-1">({loc.distKm}km)</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer Vending Center & Hours Callout ── */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400 text-center sm:text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400">📍</span>
            <span>
              <strong>Live Vending Center:</strong> Malabagh (Near R.P. School Girls Wing) • Open <strong>8:00 AM – 9:00 PM</strong>, Sat–Thu (Closed Fridays).
            </span>
          </div>
          <a
            href={FARM_COORDS.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline font-semibold shrink-0"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
}
