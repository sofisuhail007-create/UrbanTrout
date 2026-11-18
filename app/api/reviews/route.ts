import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";
import {
  getGoogleReviewsData,
  DEFAULT_REVIEWS,
  fetchLiveGooglePlacesReviews,
  mergeGoogleReviewItems,
  type GoogleReviewItem,
} from "@/lib/reviews";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const data = await getGoogleReviewsData();
    return NextResponse.json(
      {
        success: true,
        reviews: data,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
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
    const { action, reviewCount, rating, reviewUrl, mapsUrl, placeId, apiKey, customReview, reviewId } = body;

    // Fetch existing stored reviews & saved API key from Supabase
    const { data: existingSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["google_places_api_key", "google_reviews_items", "google_place_id"]);

    const settingsMap: Record<string, string> = {};
    (existingSettings || []).forEach((r) => {
      if (r.key && r.value !== undefined) settingsMap[r.key] = r.value;
    });

    let existingItems: GoogleReviewItem[] = [];
    if (settingsMap.google_reviews_items) {
      try {
        const parsed = JSON.parse(settingsMap.google_reviews_items);
        if (Array.isArray(parsed)) existingItems = parsed;
      } catch (_) {}
    }

    // Manual add/delete curated Google review
    if (action === "add_review" && customReview?.author && customReview?.text) {
      const newItem: GoogleReviewItem = {
        id: `manual-${Date.now()}`,
        author: String(customReview.author).trim(),
        rating: Math.min(5, Math.max(1, Number(customReview.rating) || 5)),
        text: String(customReview.text).trim(),
        locality: String(customReview.locality || "Srinagar, J&K").trim(),
        relativeTime: String(customReview.relativeTime || "Verified Google Review").trim(),
        publishTime: new Date().toISOString(),
        source: "google",
      };
      const merged = mergeGoogleReviewItems([newItem], existingItems);
      await supabase.from("app_settings").upsert(
        {
          key: "google_reviews_items",
          value: JSON.stringify(merged),
          description: "Synced & verified Google customer review items for dynamic homepage marquee",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      try {
        revalidatePath("/");
      } catch (_) {}
      const updated = await getGoogleReviewsData();
      return NextResponse.json({
        success: true,
        message: `Added verified review from ${newItem.author}!`,
        reviews: updated,
      });
    }

    if (action === "delete_review" && reviewId) {
      const filtered = existingItems.filter((item) => item.id !== reviewId);
      await supabase.from("app_settings").upsert(
        {
          key: "google_reviews_items",
          value: JSON.stringify(filtered),
          description: "Synced & verified Google customer review items for dynamic homepage marquee",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );
      try {
        revalidatePath("/");
      } catch (_) {}
      const updated = await getGoogleReviewsData();
      return NextResponse.json({
        success: true,
        message: "Review removed.",
        reviews: updated,
      });
    }

    let finalCount = reviewCount !== undefined ? parseInt(String(reviewCount), 10) : undefined;
    let finalRating = rating !== undefined ? parseFloat(String(rating)) : undefined;
    let mergedReviews: GoogleReviewItem[] | null = null;
    let syncMessage = "";

    // If action is 'sync', fetch LIVE rating, count, AND real reviews via Google Places API (New)
    if (action === "sync") {
      const activePlaceId = placeId || settingsMap.google_place_id || DEFAULT_REVIEWS.placeId;
      const activeKey = apiKey || settingsMap.google_places_api_key || process.env.GOOGLE_MAPS_API_KEY;

      if (!activeKey) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Google Places API key is required to auto-sync live reviews from Google Maps. Enable 'Places API (New)' in Google Cloud Console and paste your key.",
          },
          { status: 400 }
        );
      }

      try {
        const live = await fetchLiveGooglePlacesReviews(activePlaceId, activeKey);
        if (live.reviewCount !== undefined) finalCount = live.reviewCount;
        if (live.rating !== undefined) finalRating = live.rating;

        if (live.reviews.length > 0) {
          mergedReviews = mergeGoogleReviewItems(live.reviews, existingItems);
        }

        syncMessage = `Synced live from Google Maps: ${finalRating} ★ (${finalCount} total reviews) • ${live.reviews.length} live reviews fetched (${mergedReviews?.length || existingItems.length} total in marquee)!`;
      } catch (syncErr: any) {
        const rawErr = String(syncErr?.message || syncErr);
        const friendlyHint = rawErr.toLowerCase().includes("permission")
          ? " Enable 'Places API (New)' for this API key in Google Cloud Console → APIs & Services → Library → Places API (New)."
          : "";
        return NextResponse.json(
          {
            success: false,
            error: `Google Sync failed: ${rawErr}${friendlyHint}`,
          },
          { status: 502 }
        );
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

    if (mergedReviews) {
      updates.push({
        key: "google_reviews_items",
        value: JSON.stringify(mergedReviews),
        description: "Synced & verified Google customer review items for dynamic homepage marquee",
      });
      updates.push({
        key: "google_reviews_last_synced",
        value: new Date().toISOString(),
        description: "Last live Google Places API (New) sync timestamp",
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

    // Update local cache file if exists
    try {
      const cachePath = path.join(process.cwd(), ".app_settings_cache.json");
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, "utf-8");
        const json = JSON.parse(raw);
        if (finalCount !== undefined) json.google_reviews_count = String(finalCount);
        if (finalRating !== undefined) json.google_rating = String(finalRating);
        if (reviewUrl) json.google_review_url = String(reviewUrl).trim();
        if (mapsUrl) json.google_maps_url = String(mapsUrl).trim();
        if (placeId) json.google_place_id = String(placeId).trim();
        fs.writeFileSync(cachePath, JSON.stringify(json, null, 2), "utf-8");
      }
    } catch (_) {}

    // Force Next.js ISR cache revalidation on customer-facing pages
    try {
      revalidatePath("/", "layout");
      revalidatePath("/");
      revalidatePath("/our-farm");
      revalidatePath("/farm-visits");
      revalidatePath("/contact");
      revalidatePath("/shop/gutted-trout");
      revalidatePath("/shop/whole-trout");
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
