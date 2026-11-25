import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { RECIPES_DATA } from "@/lib/recipes-data";
import { getRecipeRating, submitRecipeRating } from "@/lib/recipe-ratings";

const VALID_SLUGS = new Set(RECIPES_DATA.map((r) => r.slug));

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get("slug") || "").trim();

    if (!slug || !VALID_SLUGS.has(slug)) {
      return NextResponse.json({ success: false, error: "Invalid recipe slug" }, { status: 400 });
    }

    const stats = await getRecipeRating(slug);
    return NextResponse.json({ success: true, slug, rating: stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load rating";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    const rawRating = Number(body?.rating);

    if (!slug || !VALID_SLUGS.has(slug)) {
      return NextResponse.json({ success: false, error: "Unknown recipe slug" }, { status: 400 });
    }

    if (!Number.isInteger(rawRating) || rawRating < 1 || rawRating > 5) {
      return NextResponse.json({ success: false, error: "Rating must be an integer between 1 and 5" }, { status: 400 });
    }

    const updated = await submitRecipeRating(slug, rawRating);
    try {
      revalidatePath(`/recipes/${slug}`);
    } catch {
      // Ignore revalidation errors in local non-ISR dev contexts
    }

    return NextResponse.json({ success: true, slug, rating: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save rating";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
