"use client";

import React, { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  SRINAGAR_LOCALITY_CATALOG,
  calculateDistance,
  DELIVERY_ZONES,
  LocalityData,
} from "@/lib/deliveryZones";
import deliveryZoneDb from "@/lib/delivery_zone_db.json";

// Farm Base Coordinates: Malabagh Farm Hub, Srinagar
const FARM_LAT = 34.144709;
const FARM_LNG = 74.824525;
const WHATSAPP_PHONE = "917006604148";

// Pricing & COGS
const PRICE_CLEANED = 580; // ₹/kg
const PRICE_WHOLE = 540;   // ₹/kg
const COGS_PER_KG = 440;   // ₹435 supplier + ₹5 staff incentive

// Real courier cost benchmarks (Rapido / courier bike)
const REAL_COURIER_ESTIMATE: Record<string, number> = {
  zone1: 45,
  zone2: 75,
  zone3: 135,
  zone4: 175,
  out_of_zone: 220,
};

interface SearchPlace {
  name: string;
  lat: number;
  lng: number;
  distKm: number;
  tier: "zone1" | "zone2" | "zone3" | "zone4" | "out_of_zone";
  source: "curated" | "database" | "custom" | "gps";
}

function parseCoordinates(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. Google Maps @lat,lng
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 2. Query param ?q=lat,lng or ll=lat,lng
  const qMatch = trimmed.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 3. Plain lat, lng (e.g., 34.0837, 74.7973)
  const plainMatch = trimmed.match(/(-?\d{1,2}\.\d+)[,\s]+(-?\d{1,3}\.\d+)/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lng = parseFloat(plainMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  return null;
}

function getTierFromDistance(dist: number): "zone1" | "zone2" | "zone3" | "zone4" | "out_of_zone" {
  if (dist <= 4.0) return "zone1";
  if (dist <= 7.0) return "zone2";
  if (dist <= 11.5) return "zone3";
  if (dist <= 16.0) return "zone4";
  return "out_of_zone";
}

function computeDeliveryFee(tier: string, weightKg: number): number {
  if (tier === "zone1") {
    return weightKg >= 2 ? 0 : 29;
  }
  if (tier === "zone2") {
    if (weightKg >= 3) return 0;
    if (weightKg === 2) return 39;
    return 49;
  }
  if (tier === "zone3") {
    if (weightKg >= 3) return 0;
    if (weightKg === 2) return 69;
    return 79;
  }
  if (tier === "zone4") {
    if (weightKg >= 4) return 0;
    if (weightKg === 3) return 49;
    if (weightKg === 2) return 89;
    return 119;
  }
  return 0; // out of zone has no doorstep delivery fee (counter pickup)
}

function CalculatorInner() {
  const searchParams = useSearchParams();

  // Inputs
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("loc") || "");
  const [cutType, setCutType] = useState<"cleaned" | "whole">("cleaned");
  const [weightKg, setWeightKg] = useState<number>(Number(searchParams?.get("weight")) || 2);
  const [selectedPlace, setSelectedPlace] = useState<SearchPlace | null>(null);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showFounderMode, setShowFounderMode] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Combined searchable database
  const allPlaces: SearchPlace[] = useMemo(() => {
    const list: SearchPlace[] = [];
    const seenNames = new Set<string>();

    // 1. Curated primary localities
    SRINAGAR_LOCALITY_CATALOG.forEach((item: LocalityData) => {
      seenNames.add(item.name.toLowerCase());
      list.push({
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        distKm: item.distKm,
        tier: getTierFromDistance(item.distKm),
        source: "curated",
      });
    });

    // 2. 450+ place landmark database
    const rawDb = Array.isArray(deliveryZoneDb) ? deliveryZoneDb : Object.values(deliveryZoneDb);
    (rawDb as any[]).forEach((place) => {
      if (place.name && place.lat && place.lon) {
        const lower = place.name.toLowerCase();
        if (!seenNames.has(lower)) {
          seenNames.add(lower);
          const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, place.lat, place.lon).toFixed(1));
          list.push({
            name: place.name,
            lat: place.lat,
            lng: place.lon,
            distKm: dist,
            tier: getTierFromDistance(dist),
            source: "database",
          });
        }
      }
    });

    return list;
  }, []);

  // Filtered dropdown matches
  const filteredPlaces = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return allPlaces
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, allPlaces]);

  // Initial auto-select fallback
  useEffect(() => {
    if (!selectedPlace) {
      if (searchQuery) {
        // Try parsing coordinates first
        const coords = parseCoordinates(searchQuery);
        if (coords) {
          const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, coords.lat, coords.lng).toFixed(1));
          setSelectedPlace({
            name: `Coordinates (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
            lat: coords.lat,
            lng: coords.lng,
            distKm: dist,
            tier: getTierFromDistance(dist),
            source: "custom",
          });
          return;
        }

        // Try matching name
        const match = allPlaces.find((p) => p.name.toLowerCase() === searchQuery.toLowerCase());
        if (match) {
          setSelectedPlace(match);
          return;
        }
      }

      // Default to Lal Chowk as standard reference
      const defaultPlace = allPlaces.find((p) => p.name === "Lal Chowk") || allPlaces[0];
      if (defaultPlace) {
        setSelectedPlace(defaultPlace);
        setSearchQuery(defaultPlace.name);
      }
    }
  }, [allPlaces, searchQuery, selectedPlace]);

  // Handle direct text change or paste
  const handleInputChange = (val: string) => {
    setSearchQuery(val);
    setIsDropdownOpen(true);
    setGpsError(null);

    // Check if user pasted coordinates or Google Maps link
    const coords = parseCoordinates(val);
    if (coords) {
      const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, coords.lat, coords.lng).toFixed(1));
      setSelectedPlace({
        name: `Pin (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`,
        lat: coords.lat,
        lng: coords.lng,
        distKm: dist,
        tier: getTierFromDistance(dist),
        source: "custom",
      });
      setIsDropdownOpen(false);
    }
  };

  // Select place from dropdown
  const handleSelectPlace = (place: SearchPlace) => {
    setSelectedPlace(place);
    setSearchQuery(place.name);
    setIsDropdownOpen(false);
  };

  // GPS Auto-detect
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser/device.");
      return;
    }
    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const { latitude, longitude } = pos.coords;
        const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, latitude, longitude).toFixed(1));
        const tier = getTierFromDistance(dist);
        const gpsPlace: SearchPlace = {
          name: `My GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          lat: latitude,
          lng: longitude,
          distKm: dist,
          tier,
          source: "gps",
        };
        setSelectedPlace(gpsPlace);
        setSearchQuery(gpsPlace.name);
      },
      (err) => {
        setIsGpsLoading(false);
        setGpsError(`Unable to fetch location: ${err.message}. Please search your locality instead.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Active calculations
  const distance = selectedPlace?.distKm ?? 7.2;
  const tier = selectedPlace?.tier ?? "zone3";
  const isOutOfZone = tier === "out_of_zone";

  const ratePerKg = cutType === "cleaned" ? PRICE_CLEANED : PRICE_WHOLE;
  const fishCost = ratePerKg * weightKg;
  const deliveryFee = computeDeliveryFee(tier, weightKg);
  const isFreeDelivery = !isOutOfZone && deliveryFee === 0;
  const totalAmount = isOutOfZone ? fishCost : fishCost + deliveryFee;

  // Real logistics & Founder Mode values
  const realCourierCost = REAL_COURIER_ESTIMATE[tier] || 100;
  const subsidyAmount = isOutOfZone ? 0 : Math.max(0, realCourierCost - deliveryFee);
  const totalCOGS = COGS_PER_KG * weightKg;
  const totalExpense = isOutOfZone ? totalCOGS : totalCOGS + realCourierCost;
  const netProfit = totalAmount - totalExpense;
  const profitMarginPercent = totalAmount > 0 ? ((netProfit / totalAmount) * 100).toFixed(1) : "0";

  // Tier info metadata
  const tierBadges: Record<string, { label: string; color: string; bg: string; border: string }> = {
    zone1: {
      label: "Zone 1 • Core Farm Hub (0–4 km)",
      color: "#34d399",
      bg: "rgba(52, 211, 153, 0.12)",
      border: "rgba(52, 211, 153, 0.3)",
    },
    zone2: {
      label: "Zone 2 • Mid-City Srinagar (4–7 km)",
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.12)",
      border: "rgba(56, 189, 248, 0.3)",
    },
    zone3: {
      label: "Zone 3 • Greater Srinagar (7–11.5 km)",
      color: "#818cf8",
      bg: "rgba(129, 140, 248, 0.12)",
      border: "rgba(129, 140, 248, 0.3)",
    },
    zone4: {
      label: "Zone 4 • South Corridor (11.5–16 km)",
      color: "#fbbf24",
      bg: "rgba(251, 191, 36, 0.12)",
      border: "rgba(251, 191, 36, 0.3)",
    },
    out_of_zone: {
      label: "Outside Express Zone (> 16 km)",
      color: "#f87171",
      bg: "rgba(248, 113, 113, 0.12)",
      border: "rgba(248, 113, 113, 0.3)",
    },
  };

  // Next free delivery advice
  const getFreeDeliveryAdvice = () => {
    if (isOutOfZone) return null;
    if (isFreeDelivery) {
      return {
        isFree: true,
        text: "🎉 Congratulations! You have unlocked 100% FREE Doorstep Delivery on this order.",
      };
    }
    if (tier === "zone1" && weightKg < 2) {
      return {
        isFree: false,
        text: `Add +${2 - weightKg} kg to qualify for 100% FREE doorstep delivery (Save ₹29)!`,
      };
    }
    if (tier === "zone2" && weightKg < 3) {
      return {
        isFree: false,
        text: `Add +${3 - weightKg} kg to qualify for 100% FREE doorstep delivery (Save ₹${deliveryFee})!`,
      };
    }
    if (tier === "zone3" && weightKg < 3) {
      return {
        isFree: false,
        text: `Add +${3 - weightKg} kg to qualify for 100% FREE doorstep delivery (Save ₹${deliveryFee})!`,
      };
    }
    if (tier === "zone4" && weightKg < 4) {
      return {
        isFree: false,
        text: `Upgrade to our 4 kg Family Pack for 100% FREE doorstep delivery (Save ₹${deliveryFee})!`,
      };
    }
    return null;
  };

  const freeDeliveryAdvice = getFreeDeliveryAdvice();

  // WhatsApp Order Text
  const cutName = cutType === "cleaned" ? "Cleaned, Gutted & Steaked" : "Whole Fresh Trout";
  const whatsappMessage = encodeURIComponent(
    `Hi Urban Trout! I checked the Delivery Calculator on your website for my order:\n\n` +
      `📍 Location: ${selectedPlace?.name || searchQuery}\n` +
      `📏 Distance: ~${distance} km (${tierBadges[tier]?.label.split("•")[0].trim()})\n` +
      `🐟 Item: ${weightKg} kg × ${cutName} (@ ₹${ratePerKg}/kg = ₹${fishCost})\n` +
      `🚚 Subsidized Courier Fee: ${deliveryFee === 0 ? "₹0 (FREE)" : `₹${deliveryFee}`}\n` +
      `💰 Total Payable: ₹${totalAmount}\n\n` +
      `Please confirm my delivery slot today.`
  );

  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${whatsappMessage}`;

  // Copy Summary to Clipboard
  const handleCopySummary = (type: "customer" | "link") => {
    if (type === "link") {
      const url = `${window.location.origin}/delivery-calculator?loc=${encodeURIComponent(
        selectedPlace?.name || searchQuery
      )}&weight=${weightKg}&cut=${cutType}`;
      navigator.clipboard.writeText(url);
      setCopyFeedback("🔗 Direct link copied to clipboard!");
    } else {
      const summary =
        `🐟 Urban Trout Delivery Summary:\n` +
        `📍 Locality: ${selectedPlace?.name || searchQuery} (~${distance} km from Malabagh Farm)\n` +
        `📦 Order: ${weightKg} kg (${cutName})\n` +
        `💵 Fish Price: ₹${fishCost}\n` +
        `🚚 Subsidized Courier on Ice: ${deliveryFee === 0 ? "100% FREE" : `₹${deliveryFee}`}\n` +
        `✅ Total Payable at Doorstep: ₹${totalAmount}\n` +
        `⚡ Cold-Chain: Farm-harvested on ice, dispatched within 90-120 mins.`;
      navigator.clipboard.writeText(summary);
      setCopyFeedback("📋 Customer summary copied to clipboard!");
    }
    setTimeout(() => setCopyFeedback(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[#031018] text-[#dfedf9] pt-24 pb-20 px-4 sm:px-6 lg:px-8 selection:bg-[#72ddfd]/30">
      <div className="max-w-4xl mx-auto">
        {/* Header Breadcrumb & Notice */}
        <div className="flex items-center justify-between text-xs text-[#9fadb8] mb-4">
          <Link href="/" className="hover:text-[#72ddfd] transition flex items-center gap-1">
            ← Return to Urban Trout Home
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10212c] border border-white/5 text-[#9fadb8]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Cold-Chain Engine v4.0
          </span>
        </div>

        {/* Title & Tagline */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-3">
            Srinagar Delivery Calculator
          </h1>
          <p className="text-sm sm:text-base text-[#9fadb8] max-w-2xl mx-auto">
            Instant transparent delivery rates, distance calculation from our Malabagh Farm Hub, and subsidized courier on ice across Srinagar.
          </p>
        </div>

        {/* Main Interactive Card */}
        <div className="rounded-2xl bg-[#0a1924]/80 backdrop-blur-xl border border-[rgba(114,221,253,0.15)] shadow-2xl p-5 sm:p-8 mb-8">
          {/* STEP 1: Location Input */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-white flex items-center gap-2">
                <span>📍 Step 1: Customer Locality, Coordinates or Google Maps Pin</span>
              </label>
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isGpsLoading}
                className="text-xs font-medium text-[#72ddfd] hover:text-white flex items-center gap-1 bg-[#10212c] hover:bg-[#152e3e] px-2.5 py-1 rounded-lg border border-[#72ddfd]/20 transition disabled:opacity-50 cursor-pointer"
              >
                {isGpsLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-[#72ddfd] border-t-transparent rounded-full animate-spin" />
                    Locating GPS...
                  </>
                ) : (
                  <>
                    <span>📡</span> Detect Device GPS
                  </>
                )}
              </button>
            </div>

            {/* Search Input Box */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search area (e.g. Lal Chowk, Sanat Nagar, Dalgate) or paste Maps link / coordinates..."
                className="w-full bg-[#10212c] text-white placeholder-[#5a6b77] border border-[rgba(114,221,253,0.2)] focus:border-[#72ddfd] focus:ring-1 focus:ring-[#72ddfd] rounded-xl px-4 py-3.5 text-sm sm:text-base outline-none transition"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedPlace(null);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#9fadb8] hover:text-white bg-white/5 hover:bg-white/10 rounded-full px-2 py-0.5"
                >
                  Clear
                </button>
              )}

              {/* Autocomplete Dropdown */}
              {isDropdownOpen && filteredPlaces.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0c1f2e] border border-[rgba(114,221,253,0.25)] rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 max-h-64 overflow-y-auto">
                  {filteredPlaces.map((place, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPlace(place)}
                      className="w-full text-left px-4 py-3 hover:bg-[#142d3f] transition flex items-center justify-between text-sm group"
                    >
                      <div>
                        <span className="font-medium text-white group-hover:text-[#72ddfd] transition">
                          {place.name}
                        </span>
                        <span className="text-xs text-[#9fadb8] block">
                          ~{place.distKm} km from Malabagh Farm Hub
                        </span>
                      </div>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: tierBadges[place.tier]?.bg,
                          color: tierBadges[place.tier]?.color,
                          border: `1px solid ${tierBadges[place.tier]?.border}`,
                        }}
                      >
                        {place.tier === "zone1" && "Zone 1 (0–4 km)"}
                        {place.tier === "zone2" && "Zone 2 (4–7 km)"}
                        {place.tier === "zone3" && "Zone 3 (7–11.5 km)"}
                        {place.tier === "zone4" && "Zone 4 (11.5–16 km)"}
                        {place.tier === "out_of_zone" && "> 16 km"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {gpsError && (
              <p className="mt-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">
                {gpsError}
              </p>
            )}

            {/* Quick Popular Locality Chips */}
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[#9fadb8] mr-1">Popular:</span>
              {["Malabagh", "Lal Bazar", "Dalgate", "Lal Chowk", "Bemina", "Sanat Nagar", "Rawalpora"].map(
                (loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      const found = allPlaces.find((p) => p.name.toLowerCase() === loc.toLowerCase());
                      if (found) handleSelectPlace(found);
                      else handleInputChange(loc);
                    }}
                    className="text-xs px-2 py-1 rounded-md bg-[#10212c] hover:bg-[#152e3e] text-[#9fadb8] hover:text-[#72ddfd] border border-white/5 hover:border-[#72ddfd]/30 transition cursor-pointer"
                  >
                    {loc}
                  </button>
                )
              )}
            </div>
          </div>

          {/* STEP 2: Cut Type & Weight Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 pt-5 border-t border-white/5">
            {/* Cut Selection */}
            <div>
              <label className="text-sm font-semibold text-white block mb-2">
                🐟 Step 2: Fish Preparation
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCutType("cleaned")}
                  className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    cutType === "cleaned"
                      ? "bg-[#142e3e] border-[#72ddfd] shadow-[0_0_15px_rgba(114,221,253,0.15)]"
                      : "bg-[#10212c] border-white/5 hover:border-white/20 text-[#9fadb8]"
                  }`}
                >
                  <span className="text-xs font-bold text-white block">Cleaned & Gutted</span>
                  <span className="text-[11px] text-[#9fadb8]">Steaked into clean cuts</span>
                  <span className="text-sm font-bold text-[#72ddfd] mt-1">₹580 / kg</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCutType("whole")}
                  className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    cutType === "whole"
                      ? "bg-[#142e3e] border-[#72ddfd] shadow-[0_0_15px_rgba(114,221,253,0.15)]"
                      : "bg-[#10212c] border-white/5 hover:border-white/20 text-[#9fadb8]"
                  }`}
                >
                  <span className="text-xs font-bold text-white block">Whole Fresh Trout</span>
                  <span className="text-[11px] text-[#9fadb8]">Round live-harvested</span>
                  <span className="text-sm font-bold text-[#72ddfd] mt-1">₹540 / kg</span>
                </button>
              </div>
            </div>

            {/* Weight Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-white">⚖️ Step 3: Order Weight</label>
                <span className="text-xs font-bold text-[#72ddfd] bg-[#72ddfd]/10 px-2 py-0.5 rounded-full border border-[#72ddfd]/20">
                  {weightKg} kg ({weightKg >= 4 ? "Family Pack" : "Standard"})
                </span>
              </div>

              {/* Weight Pills */}
              <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                {[1, 2, 3, 4, 5].map((kg) => (
                  <button
                    key={kg}
                    type="button"
                    onClick={() => setWeightKg(kg)}
                    className={`py-2 text-center rounded-lg font-bold text-xs sm:text-sm border transition cursor-pointer ${
                      weightKg === kg
                        ? "bg-[#72ddfd] text-[#031018] border-[#72ddfd] shadow-md shadow-[#72ddfd]/20"
                        : "bg-[#10212c] text-[#dfedf9] border-white/5 hover:border-white/20"
                    }`}
                  >
                    {kg} kg
                  </button>
                ))}
              </div>

              {/* Custom Increment Stepper */}
              <div className="flex items-center justify-between bg-[#10212c] border border-white/5 rounded-xl px-3 py-2 text-xs text-[#9fadb8]">
                <span>Custom Quantity:</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setWeightKg((prev) => Math.max(1, prev - 1))}
                    disabled={weightKg <= 1}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-base flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold text-white min-w-8 text-center">{weightKg} kg</span>
                  <button
                    type="button"
                    onClick={() => setWeightKg((prev) => Math.min(15, prev + 1))}
                    disabled={weightKg >= 15}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-base flex items-center justify-center disabled:opacity-30 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: Live Calculation Breakdown Card */}
          <div className="rounded-xl bg-[#031018] border border-white/10 p-5 mb-5">
            {/* Location & Tier Badge Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/10">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#9fadb8] font-mono">
                  Calculated Route From Malabagh
                </span>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{selectedPlace?.name || searchQuery || "Srinagar Locality"}</span>
                </h3>
                <p className="text-xs text-[#9fadb8] mt-0.5">
                  Driving distance: <span className="font-semibold text-white">~{distance} km</span> from Malabagh Live Farm Tanks
                </p>
              </div>

              <div className="self-start sm:self-auto">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: tierBadges[tier]?.bg,
                    color: tierBadges[tier]?.color,
                    border: `1px solid ${tierBadges[tier]?.border}`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: tierBadges[tier]?.color }}
                  />
                  {tierBadges[tier]?.label}
                </span>
              </div>
            </div>

            {/* Pricing Line Items */}
            <div className="py-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-[#9fadb8]">
                <span>
                  Fish Cost ({weightKg} kg × ₹{ratePerKg}/kg):
                </span>
                <span className="font-semibold text-white">₹{fishCost.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[#9fadb8] block">Express Courier on Ice:</span>
                  <span className="text-[11px] text-[#5a6b77]">
                    Reusable gel chillers (0°C–4°C) & thermal packaging
                  </span>
                </div>
                <div className="text-right">
                  {isOutOfZone ? (
                    <span className="text-xs font-semibold text-rose-400">
                      Outside Doorstep Zone (Pickup Only)
                    </span>
                  ) : isFreeDelivery ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1 justify-end">
                      <span>✓</span> 100% FREE DOORSTEP
                    </span>
                  ) : (
                    <div>
                      <span className="font-bold text-white">₹{deliveryFee}</span>
                      <span className="text-[11px] text-[#72ddfd] block">Subsidized courier</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cold-Chain Subsidy Callout */}
              {!isOutOfZone && subsidyAmount > 0 && (
                <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-[#72ddfd]/10 border border-[#72ddfd]/20 text-[#72ddfd]">
                  <span>Urban Trout Cold-Chain Contribution:</span>
                  <span className="font-bold">−₹{subsidyAmount} absorbed for you</span>
                </div>
              )}
            </div>

            {/* Total Payable Box */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#9fadb8] block uppercase tracking-wider font-mono">
                  Total Payable on Delivery
                </span>
                <span className="text-[11px] text-[#5a6b77]">Cash on Delivery or UPI on Doorstep</span>
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-extrabold text-[#72ddfd]">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Smart Upsell / Free Delivery Advice Banner */}
            {freeDeliveryAdvice && (
              <div
                className={`mt-4 p-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
                  freeDeliveryAdvice.isFree
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-sky-500/10 border-sky-500/30 text-sky-200"
                }`}
              >
                <span className="text-base">{freeDeliveryAdvice.isFree ? "🎉" : "💡"}</span>
                <span>{freeDeliveryAdvice.text}</span>
              </div>
            )}

            {/* Out of zone note */}
            {isOutOfZone && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm">
                <strong>📍 Walk-In Counter Pickup at Malabagh Farm:</strong> This location is beyond our 16 km express cold-chain perimeter. You are warmly welcome to visit our Malabagh farm tanks to pick up live catch directly with ZERO delivery fee!
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!isOutOfZone ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition transform active:scale-95 cursor-pointer"
              >
                <span>📲 Order This via WhatsApp</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">
                  +91 70066 04148
                </span>
              </a>
            ) : (
              <a
                href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
                  `Hi Urban Trout! I am located at ${selectedPlace?.name || searchQuery} (~${distance} km) and would like to arrange pickup from your Malabagh Farm.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3.5 px-6 rounded-xl bg-[#10212c] hover:bg-[#152e3e] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 border border-white/10 transition cursor-pointer"
              >
                <span>📍 Inquire for Farm Pickup via WhatsApp</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => handleCopySummary("customer")}
              className="py-3 px-4 rounded-xl bg-[#10212c] hover:bg-[#152e3e] text-[#dfedf9] font-medium text-xs sm:text-sm border border-white/10 hover:border-white/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>📋</span> Copy Summary
            </button>

            <button
              type="button"
              onClick={() => handleCopySummary("link")}
              className="py-3 px-4 rounded-xl bg-[#10212c] hover:bg-[#152e3e] text-[#dfedf9] font-medium text-xs sm:text-sm border border-white/10 hover:border-white/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🔗</span> Share Link
            </button>
          </div>

          {copyFeedback && (
            <p className="mt-3 text-center text-xs text-emerald-400 font-medium animate-fade-in">
              {copyFeedback}
            </p>
          )}

          {/* Founder Mode Discreet Accordion */}
          <div className="mt-8 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowFounderMode(!showFounderMode)}
                className="text-xs text-[#9fadb8] hover:text-[#72ddfd] flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>{showFounderMode ? "🔓" : "🔒"}</span>
                <span>Internal Founder Economics Mode</span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-[#5a6b77]">
                  {showFounderMode ? "Hide" : "Reveal (Confidential)"}
                </span>
              </button>
              {showFounderMode && (
                <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  Strictly Confidential • Keep Hidden from Customer
                </span>
              )}
            </div>

            {showFounderMode && (
              <div className="mt-3 p-4 rounded-xl bg-[#050e14] border border-amber-400/30 text-xs text-[#9fadb8] space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="block text-[11px] text-[#5a6b77]">Stock COGS</span>
                    <span className="text-sm font-bold text-white">
                      ₹{totalCOGS}
                    </span>
                    <span className="block text-[10px] text-[#5a6b77] mt-0.5">
                      ₹440/kg (₹435+₹5)
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="block text-[11px] text-[#5a6b77]">Est. Rapido/Logistics</span>
                    <span className="text-sm font-bold text-amber-400">
                      ₹{realCourierCost}
                    </span>
                    <span className="block text-[10px] text-[#5a6b77] mt-0.5">
                      Subsidized by ₹{subsidyAmount}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="block text-[11px] text-[#5a6b77]">Net Profit (₹)</span>
                    <span
                      className={`text-sm font-bold ${
                        netProfit > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      ₹{netProfit}
                    </span>
                    <span className="block text-[10px] text-[#5a6b77] mt-0.5">
                      Net in pocket
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                    <span className="block text-[11px] text-[#5a6b77]">Profit Margin</span>
                    <span
                      className={`text-sm font-bold ${
                        Number(profitMarginPercent) >= 15 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {profitMarginPercent}%
                    </span>
                    <span className="block text-[10px] text-[#5a6b77] mt-0.5">
                      After courier
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[#5a6b77] pt-2 border-t border-white/5">
                  💡 <strong>Founder Formula:</strong> Revenue (₹{totalAmount}) − COGS (₹{totalCOGS}) − Real Logistics (₹{realCourierCost}) = Net Profit ₹{netProfit}.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Customer Transparency Guide: How Delivery Works */}
        <div className="rounded-2xl bg-[#0a1924]/60 border border-white/5 p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Why Our Srinagar Delivery Is Transparent & Subsidized
          </h2>
          <p className="text-sm text-[#9fadb8] mb-6 leading-relaxed">
            Unlike retail supermarket fish that sits dead in frozen displays,{" "}
            <strong className="text-white">Urban Trout is 100% farm-live harvested</strong>. Every order is swimming in fresh flowing spring water at Malabagh until you confirm your order. It is immediately prepped, sealed with non-toxic reusable ice chillers (0°C–4°C), and dispatched directly to your kitchen in 90–120 minutes.
          </p>

          {/* 4-Tier Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[#10212c] border border-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-emerald-400 text-sm">Zone 1: Core Farm Hub</span>
                <span className="text-xs bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  0 to 4.0 km
                </span>
              </div>
              <p className="text-xs text-[#9fadb8] mb-2">
                Malabagh, Naseem Bagh, Lal Bazar, Hazratbal, Soura, Bachpora, Zakura, Ahmad Nagar, Illahibagh.
              </p>
              <div className="text-xs text-white font-medium bg-black/30 p-2 rounded-lg">
                • <strong className="text-emerald-300">100% Free Delivery</strong> on 2+ kg<br />
                • Nominal ₹29 courier fee on 1 kg
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#10212c] border border-sky-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sky-400 text-sm">Zone 2: Mid-City Srinagar</span>
                <span className="text-xs bg-sky-500/10 text-sky-300 px-2 py-0.5 rounded-full font-mono">
                  4.0 to 7.0 km
                </span>
              </div>
              <p className="text-xs text-[#9fadb8] mb-2">
                Hawal, Khanyar, Rainawari, Nowhatta, Badamwari, Eidgah, Safakadal, Shalimar, Saida Kadal.
              </p>
              <div className="text-xs text-white font-medium bg-black/30 p-2 rounded-lg">
                • <strong className="text-sky-300">100% Free Delivery</strong> on 3+ kg<br />
                • ₹39 on 2 kg | ₹49 on 1 kg (We absorb the rest!)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#10212c] border border-indigo-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-indigo-400 text-sm">Zone 3: Greater Srinagar</span>
                <span className="text-xs bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full font-mono">
                  7.0 to 11.5 km
                </span>
              </div>
              <p className="text-xs text-[#9fadb8] mb-2">
                Lal Chowk, Rajbagh, Dalgate, Bemina, Jawahar Nagar, Sonwar, Sanat Nagar, Hyderpora, Nishat.
              </p>
              <div className="text-xs text-white font-medium bg-black/30 p-2 rounded-lg">
                • <strong className="text-indigo-300">100% Free Delivery</strong> on 3+ kg<br />
                • ₹69 on 2 kg | ₹79 on 1 kg (Subsidized on ice)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#10212c] border border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-400 text-sm">Zone 4: South Corridor</span>
                <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-mono">
                  11.5 to 16.0 km
                </span>
              </div>
              <p className="text-xs text-[#9fadb8] mb-2">
                Rawalpora, Peerbagh, Airport Road, Lasjan, Nowgam, Pantha Chowk, Athwajan, Rangreth.
              </p>
              <div className="text-xs text-white font-medium bg-black/30 p-2 rounded-lg">
                • <strong className="text-amber-300">100% Free Delivery</strong> on 4 kg Family Pack<br />
                • ₹49 on 3 kg | ₹89 on 2 kg | ₹119 on 1 kg
              </div>
            </div>
          </div>

          {/* Farm Contact & Hours */}
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-[#9fadb8] gap-3">
            <div>
              📍 <strong>Malabagh Farm Hub:</strong> Near RP School Girls Wing, Naseem Bagh, Srinagar — 190006
            </div>
            <div>
              🕒 <strong>Live Catch Dispatch:</strong> Sat–Thu, 8:00 AM – 9:00 PM (Closed Fridays)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DeliveryCalculatorClient() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#031018] flex items-center justify-center text-[#72ddfd]">
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-[#72ddfd] border-t-transparent rounded-full animate-spin" />
            <span>Loading Srinagar Delivery Calculator...</span>
          </div>
        </div>
      }
    >
      <CalculatorInner />
    </Suspense>
  );
}
