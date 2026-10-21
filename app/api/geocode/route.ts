import { NextRequest, NextResponse } from "next/server";
import {
  resolveLocationFromText,
  resolveLocationFromCoords,
  calculateHaversineDistance,
  FARM_LAT,
  FARM_LNG,
  GeocodeResult
} from "@/lib/geolocationEngine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address, coords, weightKg = 2 } = body;

    // 1. Direct device GPS resolution (highest precision)
    if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
      const result = resolveLocationFromCoords(coords.lat, coords.lng, Number(weightKg));
      return NextResponse.json(result);
    }

    if (!address || typeof address !== "string" || !address.trim()) {
      return NextResponse.json(
        { error: "Address or coordinates required" },
        { status: 400 }
      );
    }

    // 2. Intelligent local resolution (Core 75+ + 451 local database)
    const localResult = resolveLocationFromText(address, Number(weightKg));
    if (localResult.source !== "unknown") {
      return NextResponse.json(localResult);
    }

    // 3. Google Maps Geocoding API Resolution (Same as AI Agent)
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey) {
      try {
        const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim() + ", Srinagar, Kashmir")}&key=${googleApiKey}`;
        const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(4000) });
        if (gRes.ok) {
          const gData = await gRes.json();
          if (gData.status === "OK" && Array.isArray(gData.results) && gData.results.length > 0) {
            const loc = gData.results[0].geometry.location;
            const lat = loc.lat;
            const lng = loc.lng;
            const dist = parseFloat(calculateHaversineDistance(FARM_LAT, FARM_LNG, lat, lng).toFixed(1));
            const name = gData.results[0].formatted_address.split(",")[0] || address;

            let tier: GeocodeResult["tier"] = "Out-of-Zone";
            let fee = 0;
            let minKg = 2;

            if (dist <= 4.0) {
              tier = "0-4km";
              minKg = 2;
              fee = Number(weightKg) >= 2 ? 0 : 100;
            } else if (dist <= 6.0) {
              tier = "4-6km";
              minKg = 3;
              fee = Number(weightKg) >= 3 ? 0 : 250;
            } else if (dist <= 12.0) {
              tier = "Extended-4kg";
              minKg = 4;
              fee = 250;
            }

            return NextResponse.json({
              status: dist <= 12.0 ? "IN_ZONE" : "OUT_ZONE",
              name,
              dist,
              minKg,
              tier,
              lat,
              lng,
              source: "google_maps",
              isDeliverable: dist <= 12.0,
              deliveryFee: fee,
              message: `~${dist} km from Malabagh Farm Hub • ${tier}`
            });
          }
        }
      } catch (_) {}
    }

    // 4. Dynamic OpenStreetMap Nominatim Fallback
    try {
      const osmQuery = encodeURIComponent(`${address.trim()}, Srinagar, Jammu and Kashmir`);
      const osmUrl = `https://nominatim.openstreetmap.org/search?q=${osmQuery}&format=json&limit=1`;
      
      const osmRes = await fetch(osmUrl, {
        headers: {
          "User-Agent": "UrbanTroutCheckout/2.0 (orders@urbantrout.in)"
        },
        signal: AbortSignal.timeout(3500)
      });

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        if (Array.isArray(osmData) && osmData.length > 0 && osmData[0].lat && osmData[0].lon) {
          const lat = parseFloat(osmData[0].lat);
          const lng = parseFloat(osmData[0].lon);
          const dist = parseFloat(calculateHaversineDistance(FARM_LAT, FARM_LNG, lat, lng).toFixed(1));
          const name = osmData[0].display_name ? osmData[0].display_name.split(",")[0] : address;

          let tier: GeocodeResult["tier"] = "Out-of-Zone";
          let fee = 0;
          let minKg = 2;

          if (dist <= 4.0) {
            tier = "0-4km";
            minKg = 2;
            fee = Number(weightKg) >= 2 ? 0 : 100;
          } else if (dist <= 6.0) {
            tier = "4-6km";
            minKg = 3;
            fee = Number(weightKg) >= 3 ? 0 : 250;
          } else if (dist <= 12.0) {
            tier = "Extended-4kg";
            minKg = 4;
            fee = 250;
          }

          return NextResponse.json({
            status: dist <= 12.0 ? "IN_ZONE" : "OUT_ZONE",
            name,
            dist,
            minKg,
            tier,
            lat,
            lng,
            source: "nominatim",
            isDeliverable: dist <= 12.0,
            deliveryFee: fee,
            message: `~${dist} km from Malabagh Farm Hub • ${tier}`
          });
        }
      }
    } catch (_) {}

    // Fallback if Nominatim also fails or times out
    return NextResponse.json(localResult);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
