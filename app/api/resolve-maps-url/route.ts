import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function extractCoordsFromText(text: string): { lat: number; lng: number } | null {
  if (!text) return null;

  // 1. Google Maps @lat,lng
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 2. Google Maps search/lat,+lng or place/lat,+lng
  const searchMatch = text.match(/(?:search|place)\/(-?\d+\.\d+)[,\s+/%20]+(-?\d+\.\d+)/i);
  if (searchMatch) {
    const lat = parseFloat(searchMatch[1]);
    const lng = parseFloat(searchMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 3. Query param ?q=lat,lng or ?q=lat+lng or destination=...
  const qMatch = text.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)[,\s+/%20]+(-?\d+\.\d+)/i);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  // 4. Any pair of decimal coordinates in text
  const pairMatch = text.match(/(-?\d{1,2}\.\d{3,})[,\s+/%20]+(-?\d{1,3}\.\d{3,})/);
  if (pairMatch) {
    const lat = parseFloat(pairMatch[1]);
    const lng = parseFloat(pairMatch[2]);
    if (lat >= 32 && lat <= 36 && lng >= 73 && lng <= 77) return { lat, lng };
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl || !targetUrl.trim()) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const cleanUrl = targetUrl.trim();

    // Direct coords check first
    const directCoords = extractCoordsFromText(cleanUrl);
    if (directCoords) {
      return NextResponse.json({ success: true, ...directCoords });
    }

    // Follow redirect on server side for short links
    const response = await fetch(cleanUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(6000),
    });

    const finalUrl = response.url || "";
    let coords = extractCoordsFromText(finalUrl);

    // If not found in final URL, inspect response HTML for coordinates
    if (!coords) {
      const html = await response.text();
      coords = extractCoordsFromText(html);
    }

    if (coords) {
      return NextResponse.json({
        success: true,
        lat: coords.lat,
        lng: coords.lng,
        resolvedUrl: finalUrl,
      });
    }

    return NextResponse.json({
      success: false,
      error: "Could not find coordinates in this Google Maps link",
      resolvedUrl: finalUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
