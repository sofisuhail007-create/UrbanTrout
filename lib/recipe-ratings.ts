import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export interface RecipeRatingEntry {
  sum: number;
  count: number;
}

export interface RecipeRatingStats extends RecipeRatingEntry {
  ratingValue: string;
}

const RECIPE_RATINGS_SETTING_KEY = "recipe_ratings_map";

function getServerWriteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return supabase;
  return createClient(url, key);
}

/**
 * Loads the persisted per-recipe rating aggregates from app_settings.
 * Returns an empty map cleanly when offline or uninitialized so builds/ISR never fail.
 */
export async function getAllRecipeRatingsMap(): Promise<Record<string, RecipeRatingEntry>> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return {};
    }
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", RECIPE_RATINGS_SETTING_KEY)
      .maybeSingle();

    if (error || !data?.value) return {};
    const parsed = JSON.parse(data.value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Returns formatted aggregate rating stats for a recipe when at least 1 real vote exists.
 */
export async function getRecipeRating(slug: string): Promise<RecipeRatingStats | null> {
  const map = await getAllRecipeRatingsMap();
  const entry = map[slug];
  if (!entry || typeof entry.count !== "number" || entry.count < 1 || typeof entry.sum !== "number") {
    return null;
  }
  const avg = Math.min(5, Math.max(1, entry.sum / entry.count));
  return {
    sum: entry.sum,
    count: entry.count,
    ratingValue: avg.toFixed(1),
  };
}

/**
 * Persists a validated 1-5 star recipe rating into app_settings and returns updated stats.
 */
export async function submitRecipeRating(slug: string, rating: number): Promise<RecipeRatingStats> {
  const writeClient = getServerWriteSupabase();

  let currentMap: Record<string, RecipeRatingEntry> = {};
  try {
    const { data } = await writeClient
      .from("app_settings")
      .select("value")
      .eq("key", RECIPE_RATINGS_SETTING_KEY)
      .maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        currentMap = parsed;
      }
    }
  } catch {
    currentMap = {};
  }

  const prev = currentMap[slug];
  const prevSum = prev && typeof prev.sum === "number" ? prev.sum : 0;
  const prevCount = prev && typeof prev.count === "number" ? prev.count : 0;

  const updatedEntry: RecipeRatingEntry = {
    sum: prevSum + rating,
    count: prevCount + 1,
  };
  currentMap[slug] = updatedEntry;

  const { error } = await writeClient.from("app_settings").upsert(
    {
      key: RECIPE_RATINGS_SETTING_KEY,
      value: JSON.stringify(currentMap),
      description: "Aggregated visitor star ratings per recipe slug for Recipe schema and UI",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(error.message || "Failed to persist recipe rating");
  }

  const avg = Math.min(5, Math.max(1, updatedEntry.sum / updatedEntry.count));
  return {
    sum: updatedEntry.sum,
    count: updatedEntry.count,
    ratingValue: avg.toFixed(1),
  };
}
