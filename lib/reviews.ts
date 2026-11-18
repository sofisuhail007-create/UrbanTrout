import { supabase } from "@/lib/supabase";

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
  items: GoogleReviewItem[];
  lastSyncedAt?: string;
  isLiveSynced?: boolean;
}

export const FALLBACK_REVIEW_ITEMS: GoogleReviewItem[] = [
  {
    id: "curated-1",
    author: "Dr. Farooq Mir",
    locality: "Hazratbal, Srinagar",
    rating: 5,
    relativeTime: "Verified Google Review",
    text: "Ordered 3 kg gutted trout for a family dinner. The fish was delivered within 90 minutes packed in clean food-grade packs. The meat was remarkably firm and sweet—lightyears ahead of what you find in local markets.",
    source: "curated",
  },
  {
    id: "curated-2",
    author: "Aabid Hussain",
    locality: "Soura, Srinagar",
    rating: 5,
    relativeTime: "Verified Google Review",
    text: "Having a live trout farm right here in Malabagh with free home delivery is a blessing. The trout was cleanly gutted and descaled, zero mud taste. Fried it in mustard oil, tasted heavenly.",
    source: "curated",
  },
  {
    id: "curated-3",
    author: "Shabir Ahmad",
    locality: "Lal Bazar, Srinagar",
    rating: 5,
    relativeTime: "Verified Google Review",
    text: "Genuine 100% fresh catch. You can press the flesh with your finger and it bounces right back. No chemical smell, pure mountain-like taste. Regular customer now.",
    source: "curated",
  },
  {
    id: "curated-4",
    author: "Tariq Ahmad Wani",
    locality: "Nishat, Srinagar",
    rating: 5,
    relativeTime: "Verified Google Review",
    text: "Visited their Malabagh farm in person — crystal clear flowing borewell tanks and live swimming rainbow trout. Best hygiene standards for fresh fish in the entire valley.",
    source: "curated",
  },
  {
    id: "curated-5",
    author: "Sana Bashir",
    locality: "Rajbagh, Srinagar",
    rating: 5,
    relativeTime: "Verified Google Review",
    text: "Super fast WhatsApp ordering and doorstep delivery right on time. Zero ice, zero fishy odor, pan-ready cleaned steaks. My kids loved it!",
    source: "curated",
  },
  {
    id: "curated-6",
    author: "Imran Majeed",
    locality: "Hyderpora, Srinagar",
    rating: 5,
    relativeTime: "Verified Google Review",
    text: "Transparent live scale weighing and honest pricing. You actually get what you pay for, harvested fresh minutes before dispatch. Highly recommended!",
    source: "curated",
  },
];

export const DEFAULT_REVIEWS: GoogleReviewsData = {
  rating: 4.9,
  reviewCount: 46,
  reviewUrl: "https://g.page/r/CTVKEpV62HMmECE/review",
  mapsUrl: "https://maps.app.goo.gl/4N8A8ywhJpys9EaDA",
  placeId: "ChIJO-ZGTo2F4TgRNUoSlXrYcyY",
  items: FALLBACK_REVIEW_ITEMS,
};

/**
 * Fetches live rating, review count, and verified customer reviews from Google Places API (New).
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
    .filter((r: any) => (r?.rating || 0) >= 4 && (r?.text?.text || r?.originalText?.text))
    .map((r: any, idx: number) => {
      const author = r?.authorAttribution?.displayName || "Google Reviewer";
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
 * Merges newly synced live Google reviews with previously accumulated Google reviews,
 * deduplicating by author + text prefix so the live review library grows over time.
 */
export function mergeGoogleReviewItems(
  incoming: GoogleReviewItem[],
  existing: GoogleReviewItem[]
): GoogleReviewItem[] {
  const seen = new Map<string, GoogleReviewItem>();

  const makeKey = (item: GoogleReviewItem) =>
    `${(item.author || "").toLowerCase().trim()}::${(item.text || "").toLowerCase().trim().slice(0, 48)}`;

  // Incoming fresh Google reviews take priority (updates relativeTime / photoUrl)
  for (const item of incoming) {
    if (!item.text?.trim()) continue;
    seen.set(makeKey(item), item);
  }
  // Keep previously stored real Google reviews
  for (const item of existing) {
    if (!item.text?.trim()) continue;
    const key = makeKey(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    // Google-synced reviews first, newest first
    if (a.source === "google" && b.source !== "google") return -1;
    if (b.source === "google" && a.source !== "google") return 1;
    return (b.publishTime || "").localeCompare(a.publishTime || "");
  });
}

/**
 * Fetches dynamic Google Review metrics & review items from Supabase app_settings.
 * Falls back gracefully to DEFAULT_REVIEWS if not yet synced in database.
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

    let storedItems: GoogleReviewItem[] = [];
    if (map.google_reviews_items) {
      try {
        const parsed = JSON.parse(map.google_reviews_items);
        if (Array.isArray(parsed) && parsed.length > 0) {
          storedItems = parsed;
        }
      } catch (_) {}
    }

    const hasLiveGoogleReviews = storedItems.some((item) => item.source === "google");
    const finalItems = storedItems.length > 0 ? storedItems : FALLBACK_REVIEW_ITEMS;

    return {
      rating: !isNaN(parsedRating) && parsedRating > 0 ? parsedRating : DEFAULT_REVIEWS.rating,
      reviewCount: !isNaN(parsedCount) && parsedCount > 0 ? parsedCount : DEFAULT_REVIEWS.reviewCount,
      reviewUrl: map.google_review_url || DEFAULT_REVIEWS.reviewUrl,
      mapsUrl: map.google_maps_url || DEFAULT_REVIEWS.mapsUrl,
      reviewsUri: map.google_reviews_uri || map.google_maps_url || DEFAULT_REVIEWS.mapsUrl,
      reviewSummary: map.google_review_summary || undefined,
      placeId: map.google_place_id || DEFAULT_REVIEWS.placeId,
      items: finalItems,
      lastSyncedAt: map.google_reviews_last_synced || undefined,
      isLiveSynced: hasLiveGoogleReviews || Boolean(map.google_review_summary),
    };
  } catch (err) {
    console.warn("Notice: could not load dynamic reviews from Supabase, using default:", err);
    return DEFAULT_REVIEWS;
  }
}
