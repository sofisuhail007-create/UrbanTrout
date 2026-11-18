import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

function getServerWriteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabase;
  return createClient(url, key);
}

export interface GoogleReviewItem {
  id: string;
  author: string;
  rating: number;
  text: string;
  relativeTime?: string;
  publishTime?: string;
  photoUrl?: string;
  locality?: string;
  authorUrl?: string;
  source?: "google" | "curated";
}

export interface GoogleReviewsData {
  rating: number;
  reviewCount: number;
  reviewUrl: string;
  mapsUrl: string;
  reviewsUri?: string;
  reviewSummary?: string;
  placeId: string;
  featurableWidgetId?: string;
  items: GoogleReviewItem[];
  lastSyncedAt?: string;
  isLiveSynced?: boolean;
}

export const DEFAULT_FEATURABLE_WIDGET_ID = "04434651-2643-44d9-8fda-a3c132081f20";

export const FALLBACK_REVIEW_ITEMS: GoogleReviewItem[] = [
  {
    id: "g-obaid-hafiz",
    author: "Obaid Hafiz",
    locality: "Google Maps Verified",
    rating: 5,
    relativeTime: "Verified Review",
    text: "Got 4 kilos of Rainbow trout caught right infront of me and it tastes super delicious. Highly recommended, and also amazed how clean, well maintained and hi-tech the farm is.",
    source: "google",
  },
  {
    id: "g-natasha-thakur",
    author: "Natasha Thakur",
    locality: "Google Maps Verified",
    rating: 5,
    relativeTime: "Verified Review",
    text: "Clean, Fresh and tasty. One of best Trout fishes in the valley. Excellent service. Keep it up.",
    source: "google",
  },
  {
    id: "g-bhat-shazia",
    author: "Bhat Shazia",
    locality: "Google Maps Verified",
    rating: 5,
    relativeTime: "Verified Review",
    text: "Excellent service! The fish was of great quality, delivered super fast, and available at the best price. Very happy with the overall experience. Highly recommended!",
    source: "google",
  },
];

export const DEFAULT_REVIEWS: GoogleReviewsData = {
  rating: 4.9,
  reviewCount: 46,
  reviewUrl: "https://g.page/r/CTVKEpV62HMmECE/review",
  mapsUrl: "https://maps.app.goo.gl/4N8A8ywhJpys9EaDA",
  placeId: "ChIJO-ZGTo2F4TgRNUoSlXrYcyY",
  featurableWidgetId: DEFAULT_FEATURABLE_WIDGET_ID,
  items: FALLBACK_REVIEW_ITEMS,
};

function formatRelativeDate(isoDate?: string | null): string {
  if (!isoDate) return "Google Review";
  const ts = Date.parse(isoDate);
  if (isNaN(ts)) return "Google Review";
  const diffMs = Math.max(0, Date.now() - ts);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return diffHours <= 1 ? "Just now" : `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  return new Date(ts).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function normalizeDisplayName(rawName: string): string {
  const clean = (rawName || "Google Reviewer").trim();
  // Title-case names that are entirely lowercase (e.g. "om sanjay" -> "Om Sanjay")
  if (clean === clean.toLowerCase()) {
    return clean.replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return clean;
}

/**
 * Fetches LIVE real Google Maps reviews + customer profile photos + live rating/count
 * from Featurable v2 JSON API (cached for 1 hour via Next.js revalidate, ₹0/month).
 */
export async function fetchLiveFeaturableReviews(
  widgetId: string = DEFAULT_FEATURABLE_WIDGET_ID,
  bypassCache = false
): Promise<{
  rating?: number;
  reviewCount?: number;
  reviews: GoogleReviewItem[];
}> {
  if (!widgetId) return { reviews: [] };

  const res = await fetch(
    `https://featurable.com/api/v2/widgets/${encodeURIComponent(widgetId)}`,
    bypassCache
      ? { cache: "no-store", signal: AbortSignal.timeout(6000) }
      : { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4500) }
  );

  if (!res.ok) {
    throw new Error(`Featurable API HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data?.success || !data?.widget) {
    return { reviews: [] };
  }

  const rawReviews = Array.isArray(data.widget.reviews) ? data.widget.reviews : [];
  const parsed: GoogleReviewItem[] = rawReviews
    .filter((r: any) => {
      const val = Number(r?.rating?.value ?? r?.rating ?? 0);
      const txt = String(r?.text || "").trim();
      // Only showcase & auto-archive verified 5-star written reviews
      return val >= 5 && txt.length >= 6;
    })
    .map((r: any, idx: number) => {
      const author = normalizeDisplayName(r?.author?.name || "Google Reviewer");
      const text = String(r?.text || "").trim();
      const publishTime = r?.publishedAt || r?.createdAt || "";
      return {
        id: r?.id || `f-${author.toLowerCase().replace(/[^a-z0-9]/g, "")}-${idx}`,
        author,
        rating: Number(r?.rating?.value ?? r?.rating ?? 5),
        text,
        relativeTime: formatRelativeDate(publishTime),
        publishTime,
        photoUrl: r?.author?.avatarUrl || r?.author?.profile_photo_url || undefined,
        authorUrl: r?.author?.profileUrl || r?.url || undefined,
        locality: "Google Maps Verified",
        source: "google" as const,
      };
    });

  const summary = data.widget.gbpLocationSummary;
  return {
    rating: summary?.rating !== undefined ? Number(summary.rating) : undefined,
    reviewCount: summary?.reviewsCount !== undefined ? Number(summary.reviewsCount) : undefined,
    reviews: parsed,
  };
}

/**
 * Fetches live rating, review count, official Gemini summary, and links from Google Places API (New).
 * Endpoint: https://places.googleapis.com/v1/places/{placeId}
 */
export async function fetchLiveGooglePlacesReviews(
  placeId: string,
  apiKey: string
): Promise<{
  rating?: number;
  reviewCount?: number;
  reviewSummary?: string;
  reviewsUri?: string;
  reviews: GoogleReviewItem[];
}> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews,reviewSummary,googleMapsLinks",
      },
      cache: "no-store",
    }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    const errMsg = data?.error?.message || `Places API (New) HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  const rawReviews = Array.isArray(data.reviews) ? data.reviews : [];
  const parsedReviews: GoogleReviewItem[] = rawReviews
    .filter((r: any) => (r?.rating || 0) >= 5 && (r?.text?.text || r?.originalText?.text))
    .map((r: any, idx: number) => {
      const author = normalizeDisplayName(r?.authorAttribution?.displayName || "Google Reviewer");
      const text = (r?.text?.text || r?.originalText?.text || "").trim();
      const publishTime = r?.publishTime || "";
      const stableId = `g-${author.toLowerCase().replace(/[^a-z0-9]/g, "")}-${publishTime || idx}`;
      return {
        id: stableId,
        author,
        rating: Number(r.rating) || 5,
        text,
        relativeTime: r.relativePublishTimeDescription || "Google Review",
        publishTime,
        photoUrl: r?.authorAttribution?.photoUri || undefined,
        authorUrl: r?.authorAttribution?.uri || undefined,
        locality: "Google Maps Verified",
        source: "google" as const,
      };
    });

  return {
    rating: data.rating !== undefined ? Number(data.rating) : undefined,
    reviewCount: data.userRatingCount !== undefined ? Number(data.userRatingCount) : undefined,
    reviewSummary: data?.reviewSummary?.text?.text || undefined,
    reviewsUri: data?.googleMapsLinks?.reviewsUri || data?.reviewSummary?.reviewsUri || undefined,
    reviews: parsedReviews,
  };
}

/**
 * Merges incoming live Google reviews (e.g. from Featurable with real photos & full text)
 * with previously stored Supabase reviews, deduplicating cleanly by normalized author name
 * while preserving Google Maps contributor profile links & Local Guide labels.
 */
export function mergeGoogleReviewItems(
  incoming: GoogleReviewItem[],
  existing: GoogleReviewItem[]
): GoogleReviewItem[] {
  const byAuthor = new Map<string, GoogleReviewItem>();
  const normAuthor = (name: string) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const isFiveStar = (item: GoogleReviewItem) => Math.round(Number(item.rating ?? 5)) >= 5;

  // Index existing 5-star reviews first so we can preserve authorUrl / Local Guide badges
  const existingByAuthor = new Map<string, GoogleReviewItem>();
  for (const item of existing) {
    if (!item.text?.trim() || !isFiveStar(item)) continue;
    const key = normAuthor(item.author);
    if (key) existingByAuthor.set(key, item);
  }

  // Incoming fresh live 5-star reviews take priority (full untruncated text + real Google avatars + fresh relative dates)
  for (const item of incoming) {
    if (!item.text?.trim() || !isFiveStar(item)) continue;
    const key = normAuthor(item.author);
    const prev = key ? existingByAuthor.get(key) : undefined;
    byAuthor.set(key || item.id, {
      ...item,
      // Prefer longer text if one was fuller
      text: prev && prev.text.length > item.text.length + 15 ? prev.text : item.text,
      photoUrl: item.photoUrl || prev?.photoUrl,
      authorUrl: item.authorUrl || prev?.authorUrl,
      locality: prev?.locality === "Google Local Guide" ? "Google Local Guide" : (item.locality || prev?.locality || "Google Maps Verified"),
    });
  }

  // Append older historical verified 5-star reviews not in the latest Featurable top-15 window
  for (const item of existing) {
    if (!item.text?.trim() || !isFiveStar(item)) continue;
    const key = normAuthor(item.author);
    if (!byAuthor.has(key || item.id)) {
      byAuthor.set(key || item.id, item);
    }
  }

  return Array.from(byAuthor.values()).sort((a, b) => {
    // Live reviews with Google profile photos & newest publishTime first
    const timeDiff = (b.publishTime || "").localeCompare(a.publishTime || "");
    if (timeDiff !== 0) return timeDiff;
    return (b.photoUrl ? 1 : 0) - (a.photoUrl ? 1 : 0);
  });
}

/**
 * Fetches dynamic Google Review metrics, official Gemini summary, and auto-updating live
 * Google Maps reviews (Featurable v2 JSON + Supabase archive merged cleanly).
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
        "google_reviews_items",
        "google_reviews_last_synced",
        "google_review_summary",
        "google_reviews_uri",
        "featurable_widget_id",
      ]);

    const map: Record<string, string> = {};
    if (!error && rows) {
      rows.forEach((r) => {
        if (r.key && r.value !== undefined) {
          map[r.key] = r.value;
        }
      });
    }

    const widgetId = map.featurable_widget_id || DEFAULT_FEATURABLE_WIDGET_ID;

    let storedItems: GoogleReviewItem[] = [];
    if (map.google_reviews_items) {
      try {
        const parsed = JSON.parse(map.google_reviews_items);
        if (Array.isArray(parsed) && parsed.length > 0) {
          storedItems = parsed;
        }
      } catch (_) {}
    }

    // Auto-fetch live Google Maps reviews + avatars + live rating/count from Featurable (hourly cached!)
    let liveFeaturable: { rating?: number; reviewCount?: number; reviews: GoogleReviewItem[] } = {
      reviews: [],
    };
    try {
      liveFeaturable = await fetchLiveFeaturableReviews(widgetId);
    } catch (featErr) {
      console.warn("Notice: Featurable live fetch skipped, serving stored Google reviews:", featErr);
    }

    const dbCount = parseInt(map.google_reviews_count || "", 10);
    const dbRating = parseFloat(map.google_rating || "");

    const finalRating =
      liveFeaturable.rating && liveFeaturable.rating > 0
        ? liveFeaturable.rating
        : !isNaN(dbRating) && dbRating > 0
        ? dbRating
        : DEFAULT_REVIEWS.rating;

    const finalCount =
      liveFeaturable.reviewCount && liveFeaturable.reviewCount > 0
        ? Math.max(liveFeaturable.reviewCount, !isNaN(dbCount) ? dbCount : 0)
        : !isNaN(dbCount) && dbCount > 0
        ? dbCount
        : DEFAULT_REVIEWS.reviewCount;

    const mergedItems = mergeGoogleReviewItems(liveFeaturable.reviews, storedItems);
    const finalItems = mergedItems.length > 0 ? mergedItems : FALLBACK_REVIEW_ITEMS;

    // ─── Permanent Auto-Archive Vault (Unlimited 5★ Reviews Forever on ₹0/mo Free Plan) ───
    // Whenever Featurable delivers a brand-new 5★ review (or a Google avatar / fuller text / higher count),
    // automatically archive it into Supabase so it never disappears when older reviews roll past Featurable's 15-review window.
    if (liveFeaturable.reviews.length > 0 && mergedItems.length > 0) {
      const normAuthor = (name: string) => (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const storedMap = new Map<string, GoogleReviewItem>();
      storedItems.forEach((s) => {
        const k = normAuthor(s.author);
        if (k) storedMap.set(k, s);
      });

      const hasNewOrUpgradedReview = mergedItems.some((m) => {
        const prev = storedMap.get(normAuthor(m.author));
        if (!prev) return true;
        if (m.photoUrl && !prev.photoUrl) return true;
        if (m.text.length > (prev.text?.length || 0) + 15) return true;
        if (m.publishTime && !prev.publishTime) return true;
        return false;
      });

      const hasHigherCount = finalCount > (isNaN(dbCount) ? 0 : dbCount);
      const hasRatingChange =
        liveFeaturable.rating !== undefined &&
        liveFeaturable.rating > 0 &&
        (isNaN(dbRating) || Math.abs(liveFeaturable.rating - dbRating) >= 0.05);

      if (hasNewOrUpgradedReview || hasHigherCount || hasRatingChange) {
        try {
          const writeDb = getServerWriteSupabase();
          const nowIso = new Date().toISOString();
          await writeDb.from("app_settings").upsert(
            [
              {
                key: "google_reviews_items",
                value: JSON.stringify(mergedItems),
                description: "Auto-archived 5-star verified Google customer reviews for dynamic homepage marquee",
                updated_at: nowIso,
              },
              {
                key: "google_reviews_count",
                value: String(finalCount),
                description: "Total verified Google Reviews count",
                updated_at: nowIso,
              },
              {
                key: "google_rating",
                value: String(finalRating),
                description: "Google Reviews star rating",
                updated_at: nowIso,
              },
              {
                key: "google_reviews_last_synced",
                value: nowIso,
                description: "Last timestamp when live 5-star Google reviews were auto-archived",
                updated_at: nowIso,
              },
            ],
            { onConflict: "key" }
          );
        } catch (archiveErr) {
          console.warn("Notice: auto-archive of 5-star reviews skipped:", archiveErr);
        }
      }
    }

    return {
      rating: finalRating,
      reviewCount: finalCount,
      reviewUrl: map.google_review_url || DEFAULT_REVIEWS.reviewUrl,
      mapsUrl: map.google_maps_url || DEFAULT_REVIEWS.mapsUrl,
      reviewsUri: map.google_reviews_uri || map.google_maps_url || DEFAULT_REVIEWS.mapsUrl,
      reviewSummary: map.google_review_summary || undefined,
      placeId: map.google_place_id || DEFAULT_REVIEWS.placeId,
      featurableWidgetId: widgetId,
      items: finalItems,
      lastSyncedAt: map.google_reviews_last_synced || undefined,
      isLiveSynced: liveFeaturable.reviews.length > 0 || Boolean(map.google_review_summary),
    };
  } catch (err) {
    console.warn("Notice: could not load dynamic reviews, using default:", err);
    return DEFAULT_REVIEWS;
  }
}
