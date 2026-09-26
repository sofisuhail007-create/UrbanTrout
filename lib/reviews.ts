import { supabase } from "@/lib/supabase";

export interface GoogleReviewsData {
  rating: number;
  reviewCount: number;
  reviewUrl: string;
  mapsUrl: string;
  placeId: string;
}

export const DEFAULT_REVIEWS: GoogleReviewsData = {
  rating: 4.9,
  reviewCount: 15,
  reviewUrl: "https://g.page/r/CTVKEpV62HMmECE/review",
  mapsUrl: "https://maps.app.goo.gl/4N8A8ywhJpys9EaDA",
  placeId: "ChIJO-ZGTo2F4TgRNUoSlXrYcyY",
};

/**
 * Fetches dynamic Google Review metrics from Supabase app_settings.
 * Falls back to DEFAULT_REVIEWS if not yet set in database.
 */
export async function getGoogleReviewsData(): Promise<GoogleReviewsData> {
  try {
    const { data: rows, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "google_reviews_count",
        "google_rating",
        "google_review_url",
        "google_maps_url",
        "google_place_id",
      ]);

    if (error || !rows || rows.length === 0) {
      return DEFAULT_REVIEWS;
    }

    const map: Record<string, string> = {};
    rows.forEach((r) => {
      if (r.key && r.value !== undefined) {
        map[r.key] = r.value;
      }
    });

    const parsedCount = parseInt(map.google_reviews_count || "", 10);
    const parsedRating = parseFloat(map.google_rating || "");

    return {
      rating: !isNaN(parsedRating) && parsedRating > 0 ? parsedRating : DEFAULT_REVIEWS.rating,
      reviewCount: !isNaN(parsedCount) && parsedCount > 0 ? parsedCount : DEFAULT_REVIEWS.reviewCount,
      reviewUrl: map.google_review_url || DEFAULT_REVIEWS.reviewUrl,
      mapsUrl: map.google_maps_url || DEFAULT_REVIEWS.mapsUrl,
      placeId: map.google_place_id || DEFAULT_REVIEWS.placeId,
    };
  } catch (err) {
    console.warn("Notice: could not load dynamic reviews from Supabase, using default:", err);
    return DEFAULT_REVIEWS;
  }
}
