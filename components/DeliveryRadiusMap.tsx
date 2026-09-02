"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type * as LType from "leaflet";

export interface ZoneLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  pincode: string;
  landmark?: string;
}

export const SRINAGAR_LOCALITIES: ZoneLocation[] = [
  { id: "naseem-bagh", name: "Naseem Bagh", lat: 34.1450, lng: 74.8250, pincode: "190006", landmark: "Near Kashmir University" },
  { id: "malabagh", name: "Malabagh", lat: 34.1485, lng: 74.8210, pincode: "190006", landmark: "Near RP School / Farm Base" },
  { id: "hazratbal", name: "Hazratbal", lat: 34.1265, lng: 74.8425, pincode: "190006", landmark: "Hazratbal Dargah & Promenade" },
  { id: "habak", name: "Habak", lat: 34.1420, lng: 74.8430, pincode: "190006", landmark: "Habak Crossing & Dal Shore" },
  { id: "zakura", name: "Zakura", lat: 34.1610, lng: 74.8220, pincode: "190024", landmark: "Zakura Industrial / Crossing" },
  { id: "lal-bazar", name: "Lal Bazar", lat: 34.1210, lng: 74.8160, pincode: "190011", landmark: "G.D. Goenka / Bota Kadal" },
  { id: "soura", name: "Soura / SKIMS", lat: 34.1350, lng: 74.8010, pincode: "190011", landmark: "SKIMS Medical Institute" },
  { id: "bachpora", name: "Bachpora", lat: 34.1460, lng: 74.7950, pincode: "190020", landmark: "Bachpora Main Market" },
  { id: "illahibagh", name: "Illahibagh", lat: 34.1380, lng: 74.8120, pincode: "190011", landmark: "Illahibagh Main Road" },
  { id: "nowshera", name: "Nowshera", lat: 34.1180, lng: 74.8090, pincode: "190011", landmark: "Nowshera Grid Station" },
  { id: "rainawari", name: "Rainawari", lat: 34.0980, lng: 74.8280, pincode: "190003", landmark: "JLNM Hospital / Naidyar" },
  { id: "dalgate", name: "Dalgate & Boulevard", lat: 34.0840, lng: 74.8320, pincode: "190001", landmark: "Dal Lake Gate 1 & Boulevard" },
  { id: "khanyar", name: "Khanyar", lat: 34.0930, lng: 74.8190, pincode: "190003", landmark: "Dastgeer Sahib Shrine" },
  { id: "rajbagh", name: "Rajbagh", lat: 34.0680, lng: 74.8240, pincode: "190008", landmark: "Rajbagh Market & River Walk" },
  { id: "lal-chowk", name: "Lal Chowk", lat: 34.0725, lng: 74.8090, pincode: "190001", landmark: "Ghanta Ghar / Residency Road" },
  { id: "shalimar", name: "Shalimar", lat: 34.1480, lng: 74.8720, pincode: "190025", landmark: "Mughal Garden Shalimar" },
  { id: "nishat", name: "Nishat", lat: 34.1230, lng: 74.8780, pincode: "190019", landmark: "Nishat Bagh & Dal Foreshore" },
  { id: "harwan", name: "Harwan", lat: 34.1650, lng: 74.8980, pincode: "190023", landmark: "Harwan Garden & Trout Stream" },
  { id: "sanat-nagar", name: "Sanat Nagar", lat: 34.0320, lng: 74.7950, pincode: "190005", landmark: "Sanat Nagar Chowk" },
  { id: "hyderpora", name: "Hyderpora", lat: 34.0370, lng: 74.7820, pincode: "190014", landmark: "Hyderpora Bypass & Flyover" },
  { id: "jawahar-nagar", name: "Jawahar Nagar", lat: 34.0580, lng: 74.8170, pincode: "190008", landmark: "Jawahar Nagar Park" },
  { id: "bemina", name: "Bemina", lat: 34.0850, lng: 74.7680, pincode: "190018", landmark: "Bemina Degree College" },
  { id: "rawalpora", name: "Rawalpora", lat: 34.0290, lng: 74.7880, pincode: "190005", landmark: "Rawalpora Main Market" },
  { id: "nowgam", name: "Nowgam", lat: 34.0220, lng: 74.8290, pincode: "190015", landmark: "Srinagar Railway Station Link" },
  { id: "ganderbal", name: "Ganderbal Town", lat: 34.2160, lng: 74.7780, pincode: "191201", landmark: "Sindh River Basin" },
];

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type TileStyle = "google_hybrid" | "google_roadmap" | "dark_matter" | "google_terrain";

interface DeliveryRadiusMapProps {
  radiusKm: number;
  farmLat: number;
  farmLng: number;
  farmName?: string;
  onRadiusChange?: (newRadius: number) => void;
  onCoordinatesChange?: (lat: number, lng: number) => void;
  allowDragFarmPin?: boolean;
  interactiveLocalityFilter?: (zone: ZoneLocation, dist: number, eligible: boolean) => void;
  height?: string;
}

export default function DeliveryRadiusMap({
  radiusKm,
  farmLat,
  farmLng,
  farmName = "Urban Trout Farm (Malabagh, Naseem Bagh)",
  onRadiusChange,
  onCoordinatesChange,
  allowDragFarmPin = true,
  interactiveLocalityFilter,
  height = "560px",
}: DeliveryRadiusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const leafletRef = useRef<any>(null);
  const circleLayerRef = useRef<LType.Circle | null>(null);
  const outerGlowCircleRef = useRef<LType.Circle | null>(null);
  const farmMarkerRef = useRef<LType.Marker | null>(null);
  const zoneMarkersGroupRef = useRef<LType.LayerGroup | null>(null);
  const tileLayerRef = useRef<LType.TileLayer | null>(null);

  const [tileStyle, setTileStyle] = useState<TileStyle>("google_hybrid");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"interactive" | "google_embed">("interactive");
  const [selectedLocality, setSelectedLocality] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [testPoint, setTestPoint] = useState<{ lat: number; lng: number; dist: number } | null>(null);

  // Compute stats
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

  const coveredCount = calculatedLocalities.filter((l) => l.eligible).length;
  const totalCount = calculatedLocalities.length;
  const coverageAreaSqKm = (Math.PI * radiusKm * radiusKm).toFixed(1);

  // ─── TILE LAYER CONFIGURATIONS ──────────────────────────────
  const getTileConfig = useCallback((style: TileStyle) => {
    switch (style) {
      case "google_hybrid":
        return {
          url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          attribution: "&copy; Google Maps (Satellite &amp; Roads)",
          maxZoom: 20,
        };
      case "google_roadmap":
        return {
          url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          attribution: "&copy; Google Maps",
          maxZoom: 20,
        };
      case "dark_matter":
        return {
          url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          maxZoom: 19,
        };
      case "google_terrain":
        return {
          url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
          attribution: "&copy; Google Maps Terrain",
          maxZoom: 20,
        };
    }
  }, []);

  // ─── INITIALIZE LEAFLET MAP (CLIENT-SIDE ONLY) ───────────────
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    async function initMap() {
      const L = await import("leaflet");
      leafletRef.current = L;
      (window as any).L = L;

      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous map if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [farmLat, farmLng],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      // Add zoom control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Add Tile Layer
      const cfg = getTileConfig(tileStyle);
      const tiles = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        maxZoom: cfg.maxZoom,
      }).addTo(map);
      tileLayerRef.current = tiles;

      // Outer glow circle (faint)
      const outerGlow = L.circle([farmLat, farmLng], {
        radius: radiusKm * 1000 * 1.03,
        color: "#25D366",
        weight: 1.5,
        opacity: 0.35,
        fillColor: "#72ddfd",
        fillOpacity: 0.03,
        dashArray: "6, 8",
      }).addTo(map);
      outerGlowCircleRef.current = outerGlow;

      // Primary Deliverable Radius Circle
      const mainCircle = L.circle([farmLat, farmLng], {
        radius: radiusKm * 1000,
        color: "#72ddfd",
        weight: 3,
        opacity: 0.95,
        fillColor: "#008cb3",
        fillOpacity: 0.16,
      }).addTo(map);
      circleLayerRef.current = mainCircle;

      // Custom Farm Hub Icon
      const farmIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 rounded-full bg-cyan-400/30 animate-ping"></div>
          <div class="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-cyan-400 border-2 border-white shadow-xl shadow-cyan-500/50 flex items-center justify-center text-slate-950 font-black text-lg">
            🐟
          </div>
        </div>
      `;

      const farmIcon = L.divIcon({
        className: "custom-farm-marker",
        html: farmIconHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const farmMarker = L.marker([farmLat, farmLng], {
        icon: farmIcon,
        draggable: allowDragFarmPin,
      }).addTo(map);

      farmMarker.bindPopup(`
        <div style="font-family: 'Space Grotesk', sans-serif; color: #dfedf9; background: #0b1b25; padding: 12px; border-radius: 12px; border: 1px solid rgba(114,221,253,0.3); min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
            <span style="font-size: 16px;">🐟</span>
            <strong style="color: #72ddfd; font-size: 13px;">Urban Trout Farm Hub</strong>
          </div>
          <p style="font-family: 'Manrope', sans-serif; font-size: 11px; color: #9fadb8; margin: 0 0 8px;">
            Malabagh, Naseem Bagh, Srinagar<br/>(34.144709, 74.824525)
          </p>
          <div style="background: rgba(37,211,102,0.15); border: 1px solid rgba(37,211,102,0.4); padding: 4px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; color: #25D366; text-transform: uppercase;">
            Farm Fresh Fish Counter
          </div>
        </div>
      `);

      if (allowDragFarmPin) {
        farmMarker.on("dragend", (e) => {
          const latLng = (e.target as LType.Marker).getLatLng();
          if (onCoordinatesChange) {
            onCoordinatesChange(parseFloat(latLng.lat.toFixed(6)), parseFloat(latLng.lng.toFixed(6)));
          }
        });
      }

      farmMarkerRef.current = farmMarker;

      // Zone Markers Layer Group
      const zoneGroup = L.layerGroup().addTo(map);
      zoneMarkersGroupRef.current = zoneGroup;

      // Handle map click to test distance / coordinates
      map.on("click", (e) => {
        const clickDist = calculateDistanceKm(farmLat, farmLng, e.latlng.lat, e.latlng.lng);
        setTestPoint({
          lat: parseFloat(e.latlng.lat.toFixed(6)),
          lng: parseFloat(e.latlng.lng.toFixed(6)),
          dist: parseFloat(clickDist.toFixed(2)),
        });
      });

      mapInstanceRef.current = map;
      setMapLoaded(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [allowDragFarmPin, getTileConfig]);

  // ─── INVALIDATE SIZE ON TAB SWITCH ───────────────────────────
  useEffect(() => {
    if (activeTab === "interactive" && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // ─── SWITCH TILE LAYER ───────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const L = leafletRef.current || (window as any).L;
    if (!L) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const cfg = getTileConfig(tileStyle);
    const newTiles = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
    }).addTo(mapInstanceRef.current);
    tileLayerRef.current = newTiles;
  }, [tileStyle, getTileConfig]);

  // ─── UPDATE RADIUS CIRCLE & FARM POSITION ────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (circleLayerRef.current) {
      circleLayerRef.current.setLatLng([farmLat, farmLng]);
      circleLayerRef.current.setRadius(radiusKm * 1000);
    }

    if (outerGlowCircleRef.current) {
      outerGlowCircleRef.current.setLatLng([farmLat, farmLng]);
      outerGlowCircleRef.current.setRadius(radiusKm * 1000 * 1.03);
    }

    if (farmMarkerRef.current) {
      farmMarkerRef.current.setLatLng([farmLat, farmLng]);
    }
  }, [radiusKm, farmLat, farmLng]);

  // ─── RENDER / UPDATE LOCALITY MARKERS ON MAP ─────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !zoneMarkersGroupRef.current || !mapLoaded) return;
    const L = leafletRef.current || (window as any).L;
    if (!L) return;

    zoneMarkersGroupRef.current.clearLayers();

    calculatedLocalities.forEach((loc) => {
      const isSelected = selectedLocality === loc.id;
      const isEligible = loc.eligible;

      const markerHtml = `
        <div class="transition-all duration-200 hover:scale-125 cursor-pointer flex flex-col items-center">
          <div class="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight shadow-lg border flex items-center gap-1 ${
            isEligible
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/60 shadow-emerald-500/20"
              : "bg-slate-950/90 text-slate-400 border-slate-700 shadow-black/40"
          } ${isSelected ? "ring-2 ring-cyan-400 scale-110" : ""}">
            <span class="w-1.5 h-1.5 rounded-full ${isEligible ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}"></span>
            <span>${loc.name}</span>
          </div>
          <div class="w-1 h-2 ${isEligible ? "bg-emerald-500" : "bg-slate-600"}"></div>
        </div>
      `;

      const zoneIcon = L.divIcon({
        className: "custom-zone-marker",
        html: markerHtml,
        iconSize: [80, 30],
        iconAnchor: [40, 30],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: zoneIcon });

      const popupContent = `
        <div style="font-family: 'Space Grotesk', sans-serif; color: #dfedf9; background: #06151e; padding: 14px; border-radius: 14px; border: 1.5px solid ${
          isEligible ? "rgba(37,211,102,0.4)" : "rgba(61,74,83,0.6)"
        }; min-width: 220px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <strong style="color: #ffffff; font-size: 14px;">${loc.name}</strong>
            <span style="font-size: 10px; font-mono: true; padding: 2px 6px; border-radius: 4px; background: rgba(114,221,253,0.15); color: #72ddfd;">${loc.pincode}</span>
          </div>
          <p style="font-family: 'Manrope', sans-serif; font-size: 11px; color: #9fadb8; margin: 0 0 10px;">
            ${loc.landmark || "Srinagar Locality"}
          </p>
          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 8px; border-top: 1px solid rgba(61,74,83,0.4); font-size: 11px;">
            <span style="color: #9fadb8;">Distance:</span>
            <strong style="color: #72ddfd; font-family: 'Space Grotesk', sans-serif;">${loc.distanceKm.toFixed(1)} km</strong>
          </div>
          <div style="margin-top: 8px; padding: 5px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; text-align: center; ${
            isEligible
              ? "background: rgba(37,211,102,0.2); color: #25D366; border: 1px solid rgba(37,211,102,0.4);"
              : "background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3);"
          }">
            ${isEligible ? "✓ INSIDE DELIVERABLE RADIUS (FREE)" : "✕ OUTSIDE FREE RADIUS"}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on("click", () => {
        setSelectedLocality(loc.id);
        if (interactiveLocalityFilter) {
          interactiveLocalityFilter(loc, loc.distanceKm, isEligible);
        }
      });

      zoneMarkersGroupRef.current?.addLayer(marker);
    });
  }, [calculatedLocalities, mapLoaded, selectedLocality, interactiveLocalityFilter]);

  // ─── ZOOM TO SPECIFIC LOCALITY ───────────────────────────────
  const handleFlyToLocality = (loc: typeof calculatedLocalities[0]) => {
    setSelectedLocality(loc.id);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 14, { duration: 1.2 });
    }
  };

  // ─── RESET MAP VIEW TO FARM CENTER ───────────────────────────
  const handleRecenterFarm = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([farmLat, farmLng], 12, { duration: 1 });
    }
    setTestPoint(null);
    setSelectedLocality(null);
  };

  return (
    <div className="space-y-4">
      {/* ─── TOP CONTROL BAR ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl">
        {/* Left: View Mode Toggles */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("interactive")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "interactive"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">radar</span>
              Interactive Radar Map
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("google_embed")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "google_embed"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">map</span>
              Official Google Maps Embed
            </button>
          </div>
        </div>

        {/* Right: Map Style Selector & Actions */}
        {activeTab === "interactive" && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Map Style:</span>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {[
                { id: "google_hybrid", label: "🛰️ Satellite + Roads" },
                { id: "google_roadmap", label: "🗺️ Google Roads" },
                { id: "dark_matter", label: "🌌 Dark Cyber" },
                { id: "google_terrain", label: "⛰️ Terrain" },
              ].map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setTileStyle(style.id as TileStyle)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    tileStyle === style.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRecenterFarm}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 transition-colors cursor-pointer"
              title="Recenter Map to Farm Base"
            >
              <span className="material-symbols-outlined text-base">center_focus_strong</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── LIVE COVERAGE SUMMARY BANNER ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Configured Radius</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-cyan-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {radiusKm.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-bold">KM</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coverage Area</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-emerald-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {coverageAreaSqKm}
            </span>
            <span className="text-xs text-slate-400 font-bold">KM²</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Localities Covered</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {coveredCount} / {totalCount}
            </span>
            <span className="text-xs text-emerald-400 font-bold">({Math.round((coveredCount / totalCount) * 100)}%)</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Dispatch</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl font-bold text-amber-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {radiusKm <= 5 ? "30-45" : radiusKm <= 10 ? "45-60" : "60-90"}
            </span>
            <span className="text-xs text-slate-400 font-bold">MINS</span>
          </div>
        </div>
      </div>

      {/* ─── MAP CANVAS / GOOGLE EMBED CONTAINER ─── */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-[#031018] shadow-2xl">
        {/* Leaflet CSS Link */}
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

        {/* The Interactive Map (Preserved in DOM to prevent blank canvas) */}
        <div style={{ display: activeTab === "interactive" ? "block" : "none" }} className="relative">
          <div ref={mapContainerRef} style={{ width: "100%", height }} className="z-10" />

          {/* Overlaid Floating Info Box: Test Point Distance */}
          {testPoint && (
            <div className="absolute top-4 left-4 z-20 max-w-xs p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 backdrop-blur-md shadow-xl text-xs space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-cyan-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">straighten</span>
                  Measured Test Point
                </span>
                <button
                  type="button"
                  onClick={() => setTestPoint(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <div className="text-slate-300">
                Distance from Farm: <strong className="text-white font-mono">{testPoint.dist} km</strong>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Coordinates: {testPoint.lat}, {testPoint.lng}
              </div>
              <div
                className={`px-2 py-1 rounded text-[10px] font-bold text-center uppercase tracking-wider ${
                  testPoint.dist <= radiusKm
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-red-500/20 text-red-300 border border-red-500/30"
                }`}
              >
                {testPoint.dist <= radiusKm ? "✓ Deliverable" : "✕ Outside Delivery Radius"}
              </div>
            </div>
          )}

          {/* Map Legend (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-20 p-3 rounded-xl bg-slate-950/90 border border-slate-800 backdrop-blur-md shadow-lg text-[11px] space-y-1.5 hidden sm:block">
            <div className="font-bold text-white flex items-center gap-1.5 pb-1 border-b border-slate-800">
              <span className="material-symbols-outlined text-cyan-400 text-sm">map</span>
              Map Radar Legend
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="text-base">🐟</span>
              <span>Urban Trout Farm Center</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-3 h-3 rounded-full border-2 border-cyan-400 bg-cyan-400/20"></span>
              <span>Active Deliverable Radius ({radiusKm} km)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Eligible Zone (Inside Radius)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
              <span>Outside Free Radius</span>
            </div>
          </div>
        </div>

        {/* Official Google Maps Embed Frame */}
        <div style={{ display: activeTab === "google_embed" ? "block" : "none", width: "100%", height }} className="relative">
          <iframe
            title="Google Maps Farm Location"
            width="100%"
            height="100%"
            style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)" }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps?q=${farmLat},${farmLng}&hl=en&z=13&output=embed`}
          />
          <div className="absolute top-4 right-4 z-10">
            <a
              href={`https://maps.google.com/?q=${farmLat},${farmLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xl transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Open Official Google Maps
            </a>
          </div>
        </div>
      </div>

      {/* ─── QUICK LOCALITY FILTER CHIPS ─── */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-sm">near_me</span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Srinagar Locality Radar Coverage ({coveredCount} of {totalCount} Inside Radius)
            </h4>
          </div>

          {/* Quick search input */}
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search locality (e.g. SKIMS, Dalgate)..."
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
          {calculatedLocalities
            .filter((l) => !searchFilter || l.name.toLowerCase().includes(searchFilter.toLowerCase()) || l.pincode.includes(searchFilter))
            .map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => handleFlyToLocality(loc)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                  loc.eligible
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                    : "bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300"
                } ${selectedLocality === loc.id ? "ring-2 ring-cyan-400 font-bold" : ""}`}
              >
                <span>{loc.eligible ? "✓" : "✕"}</span>
                <span>{loc.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({loc.distanceKm.toFixed(1)}km)</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
