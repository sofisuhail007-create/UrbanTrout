import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";
import { getGoogleReviewsData, DEFAULT_REVIEWS } from "@/lib/reviews";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const data = await getGoogleReviewsData();
    return NextResponse.json({
      success: true,
      reviews: data,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, reviews: DEFAULT_REVIEWS },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action, reviewCount, rating, reviewUrl, mapsUrl, placeId, apiKey } = body;

    let finalCount = reviewCount !== undefined ? parseInt(String(reviewCount), 10) : undefined;
    let finalRating = rating !== undefined ? parseFloat(String(rating)) : undefined;
    let syncMessage = "";

    // If action is 'sync', attempt fetching from official Google Places API
    if (action === "sync" || apiKey) {
      const activePlaceId = placeId || DEFAULT_REVIEWS.placeId;
      const activeKey = apiKey || process.env.GOOGLE_MAPS_API_KEY;

      if (!activeKey) {
        return NextResponse.json({
          success: false,
          error: "Google Places API key is required to auto-sync directly from Google. You can manually enter the count above or provide a Google Cloud API key.",
        }, { status: 400 });
      }

      try {
        const placeRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${activePlaceId}&fields=rating,user_ratings_total&key=${activeKey}`
        );
        const placeData = await placeRes.json();

        if (placeData.status === "OK" && placeData.result) {
          if (placeData.result.user_ratings_total !== undefined) {
            finalCount = Number(placeData.result.user_ratings_total);
          }
          if (placeData.result.rating !== undefined) {
            finalRating = Number(placeData.result.rating);
          }
          syncMessage = `Successfully synced live from Google Maps: ${finalRating} ★ with ${finalCount} reviews!`;
        } else {
          throw new Error(placeData.error_message || `Google Places API returned status: ${placeData.status}`);
        }
      } catch (syncErr: any) {
        return NextResponse.json({
          success: false,
          error: `Google Sync failed: ${syncErr.message || syncErr}`,
        }, { status: 502 });
      }
    }

    const updates: Array<{ key: string; value: string; description: string }> = [];

    if (finalCount !== undefined && !isNaN(finalCount) && finalCount >= 0) {
      updates.push({
        key: "google_reviews_count",
        value: String(finalCount),
        description: "Dynamic Google Maps verified reviews counter",
      });
    }

    if (finalRating !== undefined && !isNaN(finalRating) && finalRating > 0) {
      updates.push({
        key: "google_rating",
        value: String(finalRating),
        description: "Dynamic Google Maps average star rating",
      });
    }

    if (reviewUrl) {
      updates.push({
        key: "google_review_url",
        value: String(reviewUrl).trim(),
        description: "Google Business Profile direct review write URL",
      });
    }

    if (mapsUrl) {
      updates.push({
        key: "google_maps_url",
        value: String(mapsUrl).trim(),
        description: "Google Maps store location listing URL",
      });
    }

    if (placeId) {
      updates.push({
        key: "google_place_id",
        value: String(placeId).trim(),
        description: "Google Maps Place ID",
      });
    }

    if (apiKey) {
      updates.push({
        key: "google_places_api_key",
        value: String(apiKey).trim(),
        description: "Google Cloud Places API key for auto-synchronization",
      });
    }

    // Upsert into Supabase app_settings
    for (const item of updates) {
      await supabase.from("app_settings").upsert(
        {
          key: item.key,
          value: item.value,
          description: item.description,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
    }

    // Force Next.js ISR cache revalidation on customer-facing pages
    try {
      revalidatePath("/");
      revalidatePath("/our-farm");
      revalidatePath("/contact");
    } catch (_) {}

    const updatedData = await getGoogleReviewsData();

    return NextResponse.json({
      success: true,
      message: syncMessage || "Google reviews tracking metrics updated successfully!",
      reviews: updatedData,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
