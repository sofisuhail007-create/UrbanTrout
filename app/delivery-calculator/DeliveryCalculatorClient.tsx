"use client";

import React, { useState, useMemo, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  SRINAGAR_LOCALITY_CATALOG,
  calculateDistance,
  LocalityData,
} from "@/lib/deliveryZones";
import deliveryZoneDb from "@/lib/delivery_zone_db.json";

// Farm Base Coordinates: Malabagh Farm Hub, Srinagar
const FARM_LAT = 34.144709;
const FARM_LNG = 74.824525;
const WHATSAPP_PHONE = "917006604148";
const FOUNDER_PIN = "4148"; // Last 4 digits of official phone 7006604148

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

/**
 * Universal Coordinate Parser:
 * Supports DMS (34°09'43.0"N 74°50'46.7"E), Decimal (34.1619, 74.8463),
 * Google Maps links (@lat,lng or ?q=lat,lng).
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // 1. DMS Format: 34°09'43.0"N 74°50'46.7"E or 34° 9' 43" N, 74° 50' 46" E
  const dmsRegex = /(\d+)[°\s]+(\d+)['′\s]+([\d.]+)[″"]?\s*([NSEW])/gi;
  const matches = [...trimmed.matchAll(dmsRegex)];
  if (matches.length >= 2) {
    const toDec = (deg: string, min: string, sec: string, dir: string) => {
      let d = parseFloat(deg) + parseFloat(min) / 60 + parseFloat(sec) / 3600;
      if (dir.toUpperCase() === "S" || dir.toUpperCase() === "W") d = -d;
      return d;
    };
    const lat = toDec(matches[0][1], matches[0][2], matches[0][3], matches[0][4]);
    const lng = toDec(matches[1][1], matches[1][2], matches[1][3], matches[1][4]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) {
      return { lat, lng };
    }
  }

  // 2. Google Maps @lat,lng
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 3. Google Maps search/lat,+lng or place/lat,+lng
  const searchMatch = trimmed.match(/(?:search|place)\/(-?\d+\.\d+)[,\s+/%20]+(-?\d+\.\d+)/i);
  if (searchMatch) {
    const lat = parseFloat(searchMatch[1]);
    const lng = parseFloat(searchMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 4. Query param ?q=lat,lng or ?q=lat+lng or destination=...
  const qMatch = trimmed.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)[,\s+/%20]+(-?\d+\.\d+)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 5. Plain decimal lat, lng (e.g. 34.0837, 74.7973 or 34.0837 74.7973)
  const plainMatch = trimmed.match(/(-?\d{1,2}\.\d{3,})[,\s+]+(-?\d{1,3}\.\d{3,})/);
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
  const [isUrlResolving, setIsUrlResolving] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Founder Mode State (Protected with PIN 4148)
  const [isFounderUnlocked, setIsFounderUnlocked] = useState(false);
  const [showFounderModal, setShowFounderModal] = useState(false);
  const [founderPinInput, setFounderPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Customer Share Modal State
  const [showShareModal, setShowShareModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const resolveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Helper to find nearest landmark for coordinates
  const findNearestLandmarkName = (lat: number, lng: number): string => {
    let nearest = allPlaces[0];
    let minD = Infinity;
    for (const p of allPlaces) {
      const d = calculateDistance(lat, lng, p.lat, p.lng);
      if (d < minD) {
        minD = d;
        nearest = p;
      }
    }
    if (minD <= 1.8) {
      return `${nearest.name} Area Pin`;
    }
    return `Location Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  };

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
      const latParam = searchParams?.get("lat");
      const lngParam = searchParams?.get("lng");
      if (latParam && lngParam) {
        const lat = parseFloat(latParam);
        const lng = parseFloat(lngParam);
        if (!isNaN(lat) && !isNaN(lng)) {
          const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, lat, lng).toFixed(1));
          const name = searchParams?.get("name") || findNearestLandmarkName(lat, lng);
          setSelectedPlace({
            name,
            lat,
            lng,
            distKm: dist,
            tier: getTierFromDistance(dist),
            source: "custom",
          });
          setSearchQuery(name);
          return;
        }
      }

      if (searchQuery) {
        const coords = parseCoordinates(searchQuery);
        if (coords) {
          const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, coords.lat, coords.lng).toFixed(1));
          const name = findNearestLandmarkName(coords.lat, coords.lng);
          setSelectedPlace({
            name,
            lat: coords.lat,
            lng: coords.lng,
            distKm: dist,
            tier: getTierFromDistance(dist),
            source: "custom",
          });
          return;
        }

        const match = allPlaces.find((p) => p.name.toLowerCase() === searchQuery.toLowerCase());
        if (match) {
          setSelectedPlace(match);
          return;
        }
      }

      // Default sample: Lal Chowk as standard reference
      const defaultPlace = allPlaces.find((p) => p.name === "Lal Chowk") || allPlaces[0];
      if (defaultPlace) {
        setSelectedPlace(defaultPlace);
        setSearchQuery(defaultPlace.name);
      }
    }
  }, [allPlaces, searchQuery, selectedPlace, searchParams]);

  // Handle direct text change or paste
  const handleInputChange = (val: string) => {
    setSearchQuery(val);
    setIsDropdownOpen(true);
    setStatusNotice(null);

    // 1. Direct Coordinate / DMS parsing (Instant)
    const coords = parseCoordinates(val);
    if (coords) {
      const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, coords.lat, coords.lng).toFixed(1));
      const placeName = findNearestLandmarkName(coords.lat, coords.lng);
      setSelectedPlace({
        name: placeName,
        lat: coords.lat,
        lng: coords.lng,
        distKm: dist,
        tier: getTierFromDistance(dist),
        source: "custom",
      });
      setIsDropdownOpen(false);
      setStatusNotice(`✓ Exact coordinates detected (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
      return;
    }

    // 2. Google Maps Short URL Check (e.g. maps.app.goo.gl/...)
    if (val.includes("maps.app.goo.gl") || val.includes("goo.gl/maps") || (val.startsWith("http") && val.includes("maps"))) {
      setIsDropdownOpen(false);
      setIsUrlResolving(true);
      setStatusNotice("🔍 Resolving Google Maps pin on server...");

      if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current);
      resolveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/resolve-maps-url?url=${encodeURIComponent(val.trim())}`);
          const data = await res.json();
          setIsUrlResolving(false);

          if (data.success && data.lat && data.lng) {
            const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, data.lat, data.lng).toFixed(1));
            const placeName = findNearestLandmarkName(data.lat, data.lng);
            setSelectedPlace({
              name: placeName,
              lat: data.lat,
              lng: data.lng,
              distKm: dist,
              tier: getTierFromDistance(dist),
              source: "custom",
            });
            setStatusNotice(`✓ Google Maps Pin verified: ${placeName} (~${dist} km)`);
          } else {
            setStatusNotice("⚠️ Could not extract exact pin coordinates. Please type your locality name.");
          }
        } catch (_) {
          setIsUrlResolving(false);
          setStatusNotice("⚠️ Network timeout resolving Maps pin. Please type your locality name.");
        }
      }, 350);
    }
  };

  // Select place from dropdown
  const handleSelectPlace = (place: SearchPlace) => {
    setSelectedPlace(place);
    setSearchQuery(place.name);
    setIsDropdownOpen(false);
    setStatusNotice(null);
  };

  // GPS Auto-detect
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setStatusNotice("Geolocation is not supported by your browser/device.");
      return;
    }
    setIsGpsLoading(true);
    setStatusNotice(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsGpsLoading(false);
        const { latitude, longitude } = pos.coords;
        const dist = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, latitude, longitude).toFixed(1));
        const tier = getTierFromDistance(dist);
        const placeName = findNearestLandmarkName(latitude, longitude);
        const gpsPlace: SearchPlace = {
          name: `${placeName} (GPS Verified)`,
          lat: latitude,
          lng: longitude,
          distKm: dist,
          tier,
          source: "gps",
        };
        setSelectedPlace(gpsPlace);
        setSearchQuery(gpsPlace.name);
        setStatusNotice(`✓ Live GPS Location detected: ~${dist} km from Malabagh Farm Hub`);
      },
      (err) => {
        setIsGpsLoading(false);
        setStatusNotice(`Unable to fetch device location: ${err.message}. Please search your locality instead.`);
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

  // Logistics & Economics
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
        text: "🎉 You have unlocked 100% FREE Doorstep Delivery on this order!",
      };
    }
    if (tier === "zone1" && weightKg < 2) {
      return {
        isFree: false,
        text: `Add +${2 - weightKg} kg to unlock 100% FREE doorstep delivery (Save ₹29)!`,
      };
    }
    if (tier === "zone2" && weightKg < 3) {
      return {
        isFree: false,
        text: `Add +${3 - weightKg} kg to unlock 100% FREE doorstep delivery (Save ₹${deliveryFee})!`,
      };
    }
    if (tier === "zone3" && weightKg < 3) {
      return {
        isFree: false,
        text: `Add +${3 - weightKg} kg to unlock 100% FREE doorstep delivery (Save ₹${deliveryFee})!`,
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
  const cutName = cutType === "cleaned" ? "Cleaned & Gutted (Steaks)" : "Whole Fresh Trout";
  const whatsappMessage = encodeURIComponent(
    `Hi Urban Trout! I checked the Delivery Calculator on your website for my order:\n\n` +
      `📍 Location: ${selectedPlace?.name || searchQuery}\n` +
      `📏 Distance: ~${distance} km (${tierBadges[tier]?.label.split("•")[0].trim()})\n` +
      `🐟 Item: ${weightKg} kg × ${cutName} (@ ₹${ratePerKg}/kg = ₹${fishCost})\n` +
      `🚚 Subsidized Courier Fee: ${deliveryFee === 0 ? "₹0 (100% FREE)" : `₹${deliveryFee}`}\n` +
      (subsidyAmount > 0 ? `🤝 Urban Trout Contribution: −₹${subsidyAmount} (Subsidized)\n` : "") +
      `💰 Total Payable: ₹${totalAmount}\n\n` +
      `Please confirm my delivery slot today.`
  );

  const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${whatsappMessage}`;

  // Customer Share Link Generator
  const generateCustomerLink = () => {
    if (typeof window === "undefined") return "";
    const base = `${window.location.origin}/delivery-calculator`;
    const params = new URLSearchParams();
    if (selectedPlace?.name) params.set("loc", selectedPlace.name);
    else if (searchQuery) params.set("loc", searchQuery);
    if (selectedPlace?.lat && selectedPlace?.lng) {
      params.set("lat", selectedPlace.lat.toFixed(6));
      params.set("lng", selectedPlace.lng.toFixed(6));
    }
    params.set("weight", String(weightKg));
    params.set("cut", cutType);
    return `${base}?${params.toString()}`;
  };

  // Customer Ready Text Summary
  const getCustomerSummaryText = () => {
    const link = generateCustomerLink();
    return (
      `🐟 Urban Trout Srinagar — Fresh Catch Delivery Quote\n\n` +
      `📍 Location: ${selectedPlace?.name || searchQuery} (~${distance} km from Malabagh Farm Hub)\n` +
      `📦 Order: ${weightKg} kg × ${cutName}\n` +
      `💵 Fish Price: ₹${fishCost} (@ ₹${ratePerKg}/kg)\n` +
      `🚚 Express Courier on Ice: ${deliveryFee === 0 ? "100% FREE DOORSTEP DELIVERY ✓" : `₹${deliveryFee} only`}\n` +
      (subsidyAmount > 0 ? `🤝 Urban Trout Contribution: −₹${subsidyAmount} (Subsidized for you)\n` : "") +
      `✅ Total Payable at Doorstep: ₹${totalAmount} (Cash or UPI)\n\n` +
      `⚡ Farm-Harvested Guarantee: Fish is swimming in cold water until you order, prepped fresh and dispatched on ice within 90–120 minutes.\n\n` +
      `🔗 View quote or modify order:\n${link}`
    );
  };

  const handleCopy = (type: "summary" | "link") => {
    if (type === "link") {
      navigator.clipboard.writeText(generateCustomerLink());
      setCopyFeedback("🔗 Direct quote link copied to clipboard!");
    } else {
      navigator.clipboard.writeText(getCustomerSummaryText());
      setCopyFeedback("📋 Customer summary copied to clipboard!");
    }
    setTimeout(() => setCopyFeedback(null), 3500);
  };

  // Unlock Founder Mode with PIN
  const handleUnlockFounder = (e: React.FormEvent) => {
    e.preventDefault();
    if (founderPinInput.trim() === FOUNDER_PIN) {
      setIsFounderUnlocked(true);
      setShowFounderModal(false);
      setPinError(false);
      setFounderPinInput("");
    } else {
      setPinError(true);
    }
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
                disabled={isGpsLoading || isUrlResolving}
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
                placeholder="Search Srinagar locality (e.g. Lal Chowk, Sanat Nagar) or paste Maps link / coordinates..."
                className="w-full bg-[#10212c] text-white placeholder-[#5a6b77] border border-[rgba(114,221,253,0.2)] focus:border-[#72ddfd] focus:ring-1 focus:ring-[#72ddfd] rounded-xl px-4 py-3.5 text-sm sm:text-base outline-none transition"
              />

              {isUrlResolving && (
                <div className="absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-[#72ddfd]">
                  <span className="w-3.5 h-3.5 border-2 border-[#72ddfd] border-t-transparent rounded-full animate-spin" />
                  <span>Resolving Pin...</span>
                </div>
              )}

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedPlace(null);
                    setStatusNotice(null);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#9fadb8] hover:text-white bg-white/5 hover:bg-white/10 rounded-full px-2 py-0.5 cursor-pointer"
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
                      className="w-full text-left px-4 py-3 hover:bg-[#142d3f] transition flex items-center justify-between text-sm group cursor-pointer"
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

            {statusNotice && (
              <p className="mt-2 text-xs text-[#72ddfd] bg-[#72ddfd]/10 border border-[#72ddfd]/20 rounded-lg p-2.5 flex items-center gap-2">
                <span>📍</span>
                <span>{statusNotice}</span>
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
                    className="text-xs px-2.5 py-1 rounded-md bg-[#10212c] hover:bg-[#152e3e] text-[#9fadb8] hover:text-[#72ddfd] border border-white/5 hover:border-[#72ddfd]/30 transition cursor-pointer"
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
                  className={`p-3.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    cutType === "cleaned"
                      ? "bg-[#142e3e] border-[#72ddfd] shadow-[0_0_15px_rgba(114,221,253,0.15)]"
                      : "bg-[#10212c] border-white/5 hover:border-white/20 text-[#9fadb8]"
                  }`}
                >
                  <span className="text-xs font-bold text-white block">Cleaned & Gutted</span>
                  <span className="text-[11px] text-[#9fadb8]">Pan-ready clean steaks</span>
                  <span className="text-sm font-bold text-[#72ddfd] mt-1.5">₹580 / kg</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCutType("whole")}
                  className={`p-3.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    cutType === "whole"
                      ? "bg-[#142e3e] border-[#72ddfd] shadow-[0_0_15px_rgba(114,221,253,0.15)]"
                      : "bg-[#10212c] border-white/5 hover:border-white/20 text-[#9fadb8]"
                  }`}
                >
                  <span className="text-xs font-bold text-white block">Whole Fresh Trout</span>
                  <span className="text-[11px] text-[#9fadb8]">Round live-harvested</span>
                  <span className="text-sm font-bold text-[#72ddfd] mt-1.5">₹540 / kg</span>
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
          <div className="rounded-xl bg-[#031018] border border-white/10 p-5 mb-5 shadow-inner">
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
                    Reusable gel chillers (0°C–4°C) & food-grade insulation
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

              {/* Urban Trout Contribution Line Item */}
              {!isOutOfZone && subsidyAmount > 0 && (
                <div className="flex items-center justify-between text-xs py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#72ddfd]/10 to-teal-500/10 border border-[#72ddfd]/25 text-[#72ddfd]">
                  <span className="font-semibold flex items-center gap-1.5">
                    <span>🤝</span> Urban Trout Contribution:
                  </span>
                  <span className="font-bold">−₹{subsidyAmount} (Subsidized on ice)</span>
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
              <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs sm:text-sm">
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
              onClick={() => setShowShareModal(true)}
              className="py-3 px-5 rounded-xl bg-[#142e3e] hover:bg-[#1a3c52] text-[#72ddfd] font-bold text-xs sm:text-sm border border-[#72ddfd]/30 hover:border-[#72ddfd] transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#72ddfd]/10"
            >
              <span>📤</span> Share with Customer
            </button>
          </div>

          {copyFeedback && (
            <p className="mt-3 text-center text-xs text-emerald-400 font-medium animate-fade-in bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/20">
              {copyFeedback}
            </p>
          )}

          {/* Secure Founder Mode Trigger */}
          <div className="mt-8 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-[#5a6b77]">
            <button
              type="button"
              onClick={() => {
                if (isFounderUnlocked) {
                  setIsFounderUnlocked(false);
                } else {
                  setShowFounderModal(true);
                }
              }}
              className="hover:text-[#72ddfd] flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>{isFounderUnlocked ? "🔓" : "🔒"}</span>
              <span>{isFounderUnlocked ? "Hide Founder Economics Mode" : "Internal Founder Economics"}</span>
            </button>
            {isFounderUnlocked && (
              <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                Confidential Founder View Active
              </span>
            )}
          </div>

          {/* Unlocked Founder Economics View */}
          {isFounderUnlocked && (
            <div className="mt-3 p-4 rounded-xl bg-[#050e14] border border-amber-400/30 text-xs text-[#9fadb8] space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="block text-[11px] text-[#5a6b77]">Stock COGS</span>
                  <span className="text-sm font-bold text-white">₹{totalCOGS}</span>
                  <span className="block text-[10px] text-[#5a6b77] mt-0.5">₹440/kg (₹435+₹5)</span>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="block text-[11px] text-[#5a6b77]">Est. Real Courier</span>
                  <span className="text-sm font-bold text-amber-400">₹{realCourierCost}</span>
                  <span className="block text-[10px] text-[#5a6b77] mt-0.5">We subsidize ₹{subsidyAmount}</span>
                </div>

                <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                  <span className="block text-[11px] text-[#5a6b77]">Net Profit (₹)</span>
                  <span className={`text-sm font-bold ${netProfit > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ₹{netProfit}
                  </span>
                  <span className="block text-[10px] text-[#5a6b77] mt-0.5">In pocket</span>
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
                  <span className="block text-[10px] text-[#5a6b77] mt-0.5">After courier</span>
                </div>
              </div>

              <p className="text-[11px] text-[#5a6b77] pt-2 border-t border-white/5">
                💡 <strong>Founder Formula:</strong> Revenue (₹{totalAmount}) − COGS (₹{totalCOGS}) − Real Logistics (₹{realCourierCost}) = Net Profit ₹{netProfit}.
              </p>
            </div>
          )}
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
                • ₹39 on 2 kg | ₹49 on 1 kg (Subsidized on ice)
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

      {/* ── Modal: Share with Customer ── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0c1f2e] border border-[rgba(114,221,253,0.3)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📤</span> Share Delivery Quote with Customer
              </h3>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="text-[#9fadb8] hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9fadb8]">
              Send this transparent breakdown to the customer via WhatsApp or copy the pre-filled quote link:
            </p>

            {/* Preview Box */}
            <div className="p-3.5 rounded-xl bg-[#031018] border border-white/10 text-xs font-mono text-[#dfedf9] whitespace-pre-line max-h-48 overflow-y-auto">
              {getCustomerSummaryText()}
            </div>

            {/* Action Buttons in Modal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(getCustomerSummaryText())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition text-center cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <span>💬</span> WhatsApp
              </a>

              <button
                type="button"
                onClick={() => handleCopy("summary")}
                className="py-2.5 px-3 rounded-xl bg-[#142e3e] hover:bg-[#1a3c52] text-[#72ddfd] font-bold text-xs flex items-center justify-center gap-1.5 border border-[#72ddfd]/30 transition cursor-pointer"
              >
                <span>📋</span> Copy Text
              </button>

              <button
                type="button"
                onClick={() => handleCopy("link")}
                className="py-2.5 px-3 rounded-xl bg-[#10212c] hover:bg-[#152e3e] text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition cursor-pointer"
              >
                <span>🔗</span> Copy Link
              </button>
            </div>

            {copyFeedback && (
              <p className="text-center text-xs text-emerald-400 font-medium bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/20">
                {copyFeedback}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Founder Mode PIN Lock ── */}
      {showFounderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0c1f2e] border border-amber-400/40 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <span>🔒</span> Founder PIN Required
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowFounderModal(false);
                  setPinError(false);
                  setFounderPinInput("");
                }}
                className="text-[#9fadb8] hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#9fadb8]">
              Internal procurement costs and margins are confidential. Enter your founder PIN to reveal economics:
            </p>

            <form onSubmit={handleUnlockFounder} className="space-y-3">
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={founderPinInput}
                onChange={(e) => {
                  setFounderPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="Enter 4-digit PIN"
                className="w-full text-center tracking-widest text-lg font-bold bg-[#031018] text-white border border-amber-400/30 focus:border-amber-400 rounded-xl px-4 py-2.5 outline-none"
              />

              {pinError && (
                <p className="text-center text-xs text-rose-400 font-medium">
                  Incorrect PIN. Please try again.
                </p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
              >
                Unlock Founder View
              </button>
            </form>
          </div>
        </div>
      )}
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
