import { NextRequest, NextResponse } from "next/server";
import { fetchLiveRoadDistance, calculateDistance, FARM_COORDS } from "@/lib/deliveryZones";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
      return NextResponse.json({ error: "lat and lng query parameters required" }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Invalid lat/lng numbers" }, { status: 400 });
    }

    const dist = await fetchLiveRoadDistance(lat, lng);
    const fallbackDist = parseFloat(calculateDistance(FARM_COORDS.lat, FARM_COORDS.lng, lat, lng).toFixed(1));

    return NextResponse.json({
      ok: true,
      distanceKm: dist,
      calibratedFallbackKm: fallbackDist,
      isLiveRouting: Math.abs(dist - fallbackDist) > 0.05,
      lat,
      lng,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Invalid lat/lng in body" }, { status: 400 });
    }

    const dist = await fetchLiveRoadDistance(lat, lng);
    const fallbackDist = parseFloat(calculateDistance(FARM_COORDS.lat, FARM_COORDS.lng, lat, lng).toFixed(1));

    return NextResponse.json({
      ok: true,
      distanceKm: dist,
      calibratedFallbackKm: fallbackDist,
      isLiveRouting: Math.abs(dist - fallbackDist) > 0.05,
      lat,
      lng,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
