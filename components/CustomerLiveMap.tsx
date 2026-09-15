"use client";

import { useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import "leaflet/dist/leaflet.css";

interface CustomerLiveMapProps {
  customerLat: number;
  customerLng: number;
  farmLat?: number;
  farmLng?: number;
  deliveryRadiusKm?: number;
  distanceKm?: number;
  isInZone: boolean;
  localityName?: string;
  onRecenter?: () => void;
}

export default function CustomerLiveMap({
  customerLat,
  customerLng,
  farmLat = 34.144709,
  farmLng = 74.824525,
  deliveryRadiusKm = 5.0,
  distanceKm,
  isInZone,
  localityName,
}: CustomerLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    async function setupMap() {
      const L = (await import("leaflet")).default || (await import("leaflet"));

      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize Leaflet Map
      const map = L.map(mapContainerRef.current, {
        center: [customerLat, customerLng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Add Zoom Control
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Google Roadmap Tiles (Uber / Ola style)
      L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        attribution: "Google Maps",
      }).addTo(map);

      // 1. Delivery Zone Circle around Farm (5 km)
      L.circle([farmLat, farmLng], {
        radius: deliveryRadiusKm * 1000,
        color: isInZone ? "#22c55e" : "#ef4444",
        fillColor: isInZone ? "#22c55e" : "#ef4444",
        fillOpacity: 0.1,
        weight: 2,
        dashArray: "6, 6",
      }).addTo(map);

      // 2. Farm Marker (Naseem Bagh Farm)
      const farmIcon = L.divIcon({
        className: "custom-farm-icon",
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #031018 0%, #10212c 100%);
            border: 2px solid #72ddfd;
            border-radius: 50%;
            box-shadow: 0 0 15px rgba(114,221,253,0.6);
            font-size: 18px;
            cursor: pointer;
          ">
            🐟
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      L.marker([farmLat, farmLng], { icon: farmIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #000; padding: 2px;">
            <strong>Urban Trout Farm</strong><br/>
            Naseem Bagh, Srinagar<br/>
            <span style="color: #22c55e; font-size: 11px;">Live Cold-Water Tank Origin</span>
          </div>
        `);

      // 3. Customer Uber-Style Live Marker
      const customerIcon = L.divIcon({
        className: "custom-uber-user-icon",
        html: `
          <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <div style="
              position: absolute;
              width: 38px;
              height: 38px;
              border-radius: 50%;
              background: ${isInZone ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"};
              animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
            <div style="
              width: 20px;
              height: 20px;
              border-radius: 50%;
              background: ${isInZone ? "#22c55e" : "#ef4444"};
              border: 3px solid #ffffff;
              box-shadow: 0 0 16px ${isInZone ? "rgba(34,197,94,0.8)" : "rgba(239,68,68,0.8)"};
              z-index: 10;
            "></div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      L.marker([customerLat, customerLng], { icon: customerIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; color: #000; padding: 2px;">
            <strong>Your Doorstep</strong><br/>
            ${localityName || "Verified GPS Pin"}<br/>
            <span style="color: ${isInZone ? "#16a34a" : "#dc2626"}; font-weight: bold;">
              ${distanceKm ? `${distanceKm.toFixed(1)} km from Farm` : ""}
            </span>
          </div>
        `);

      // 4. Trajectory Path connecting Farm to Customer
      L.polyline([[farmLat, farmLng], [customerLat, customerLng]], {
        color: isInZone ? "#22c55e" : "#ef4444",
        weight: 3,
        dashArray: "6, 8",
        opacity: 0.85,
      }).addTo(map);

      // Fit bounds to comfortably display both points
      const bounds = L.latLngBounds([
        [farmLat, farmLng],
        [customerLat, customerLng],
      ]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });

      setMapReady(true);
    }

    setupMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [customerLat, customerLng, farmLat, farmLng, deliveryRadiusKm, distanceKm, isInZone, localityName]);

  const handleCenterCustomer = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([customerLat, customerLng], 15, { duration: 1 });
    }
  };

  const handleFitRoute = () => {
    if (mapInstanceRef.current) {
      const bounds = [
        [farmLat, farmLng],
        [customerLat, customerLng],
      ];
      mapInstanceRef.current.fitBounds(bounds as any, { padding: [50, 50] });
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-[#031018]">

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-[280px] sm:h-[320px] z-0" />

      {/* Floating Uber-Style Top Status Pill */}
      <div className="absolute top-3 left-3 right-3 z-[400] pointer-events-none flex items-center justify-between">
        <div
          className="pointer-events-auto px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg flex items-center gap-2 text-xs font-bold"
          style={{
            background: isInZone ? "rgba(6,35,20,0.88)" : "rgba(40,10,10,0.88)",
            borderColor: isInZone ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)",
            color: isInZone ? "#86efac" : "#fca5a5",
          }}
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: isInZone ? "#22c55e" : "#ef4444",
              boxShadow: `0 0 8px ${isInZone ? "#22c55e" : "#ef4444"}`,
            }}
          />
          <span>
            {isInZone
              ? `Delivery Zone Verified • ${distanceKm?.toFixed(1) || "0"} km from Farm`
              : `Outside Zone • ${distanceKm?.toFixed(1) || "0"} km (Limit: ${deliveryRadiusKm} km)`}
          </span>
        </div>

        {/* Quick Map Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCenterCustomer}
            title="Center on My Location"
            className="w-8 h-8 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white flex items-center justify-center text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            🎯
          </button>
          <button
            type="button"
            onClick={handleFitRoute}
            title="View Full Delivery Route"
            className="px-2.5 h-8 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center text-[11px] font-mono shadow-md transition-all active:scale-95 cursor-pointer"
          >
            🗺️ Route
          </button>
        </div>
      </div>

      {/* Floating Bottom Legend */}
      <div className="absolute bottom-3 left-3 z-[400] pointer-events-none hidden sm:flex items-center gap-2 text-[10px] font-mono">
        <div className="px-2 py-1 rounded bg-slate-950/85 border border-slate-800 text-slate-300 backdrop-blur-sm">
          🐟 Naseem Bagh Farm
        </div>
        <div className="px-2 py-1 rounded bg-slate-950/85 border border-slate-800 text-slate-300 backdrop-blur-sm">
          🟢 5km Live Catch Zone
        </div>
      </div>
    </div>
  );
}
