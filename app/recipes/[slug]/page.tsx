import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RECIPES_DATA } from "@/lib/recipes-data";
import { getRecipeRating, type RecipeRatingStats } from "@/lib/recipe-ratings";
import RecipeDetailClient from "@/components/RecipeDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 86400; // 24 hours ISR

export async function generateStaticParams() {
  return RECIPES_DATA.map((recipe) => ({
    slug: recipe.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const recipe = RECIPES_DATA.find((r) => r.slug === slug);

  if (!recipe) {
    return {
      title: "Recipe Not Found | Urban Trout",
      description: "The requested trout recipe could not be found.",
    };
  }

  const pageUrl = `https://urbantrout.in/recipes/${recipe.slug}`;
  const ogImg = `https://urbantrout.in/images/recipes/${recipe.slug}.webp`;

  return {
    title: `${recipe.title} Recipe | Authentic Himalayan Rainbow Trout`,
    description: recipe.metaDescription,
    alternates: {
      canonical: pageUrl,
    },
    keywords: [
      recipe.title,
      recipe.subtitle,
      recipe.category,
      recipe.cuisine,
      "trout recipe",
      "kashmiri trout recipe",
      "fresh rainbow trout cooking",
      "buy fresh trout srinagar",
      "urban trout recipes",
    ],
    openGraph: {
      title: `${recipe.title} | Urban Trout Recipe`,
      description: recipe.subtitle,
      url: pageUrl,
      siteName: "Urban Trout",
      images: [
        {
          url: ogImg,
          width: 1200,
          height: 630,
          alt: `${recipe.title} - Urban Trout`,
        },
      ],
      locale: "en_IN",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: recipe.title,
      description: recipe.subtitle,
      images: [ogImg],
    },
  };
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const recipe = RECIPES_DATA.find((r) => r.slug === slug);

  if (!recipe) {
    notFound();
  }

  // Find 3 related recipes in the same category and fetch live per-recipe rating if any
  const relatedRecipes = RECIPES_DATA.filter(
    (r) => r.category === recipe.category && r.slug !== recipe.slug
  ).slice(0, 3);
  const recipeRating: RecipeRatingStats | null = await getRecipeRating(recipe.slug);

  const pageUrl = `https://urbantrout.in/recipes/${recipe.slug}`;
  const recipeImageUrl = `https://urbantrout.in/images/recipes/${recipe.slug}.webp`;

  // Parse ISO 8601 duration helper
  const parseIsoDuration = (timeStr: string) => {
    const num = timeStr.match(/\d+/)?.[0] || "20";
    return `PT${num}M`;
  };

  // Flatten ingredients for Schema.org
  const allIngredients = recipe.ingredients.flatMap((sec) => sec.items);

  // Generate Schema.org Recipe JSON-LD with full HowToStep URL + Image attributes
  const recipeNode: Record<string, unknown> = {
    "@type": "Recipe",
    name: recipe.title,
    description: recipe.subtitle,
    image: [recipeImageUrl],
    author: {
      "@type": "Organization",
      name: "Urban Trout Culinary Team",
      url: "https://urbantrout.in",
    },
    prepTime: parseIsoDuration(recipe.prepTime),
    cookTime: parseIsoDuration(recipe.cookTime),
    totalTime: parseIsoDuration(recipe.totalTime),
    recipeYield: `${recipe.servings} servings`,
    recipeCuisine: recipe.cuisine,
    recipeCategory: "Main Course",
    keywords: `${recipe.title}, trout recipe, kashmiri fish, rainbow trout recipe, pan ready trout`,
    nutrition: {
      "@type": "NutritionInformation",
      calories: `${recipe.nutrition.calories} calories`,
      proteinContent: recipe.nutrition.protein,
      fatContent: recipe.nutrition.fat,
      carbohydrateContent: recipe.nutrition.carbs,
      fiberContent: recipe.nutrition.fiber,
    },
    recipeIngredient: allIngredients,
    recipeInstructions: recipe.instructions.map((step, idx) => {
      const stepNum = step.step || idx + 1;
      return {
        "@type": "HowToStep",
        name: step.title,
        text: step.instruction,
        url: `${pageUrl}#step-${stepNum}`,
        image: recipeImageUrl,
      };
    }),
  };

  if (recipeRating && recipeRating.count >= 1) {
    recipeNode.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: recipeRating.ratingValue,
      ratingCount: String(recipeRating.count),
      bestRating: "5",
      worstRating: "1",
    };
  }

  if (recipe.video && (recipe.video.contentUrl || recipe.video.embedUrl)) {
    recipeNode.video = {
      "@type": "VideoObject",
      name: recipe.video.name || `${recipe.title} - Video Guide`,
      description: recipe.video.description || recipe.subtitle,
      thumbnailUrl: [recipe.video.thumbnailUrl || recipeImageUrl],
      ...(recipe.video.contentUrl ? { contentUrl: recipe.video.contentUrl } : {}),
      ...(recipe.video.embedUrl ? { embedUrl: recipe.video.embedUrl } : {}),
      ...(recipe.video.durationIso ? { duration: recipe.video.durationIso } : {}),
      ...(recipe.video.uploadDate ? { uploadDate: recipe.video.uploadDate } : {}),
    };
  }

  const recipeJsonLd = {
    "@context": "https://schema.org",
    "@graph": [recipeNode],
  };

  return (
    <>
      {/* Schema.org Rich Recipe Snippet */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeJsonLd) }}
      />
      <RecipeDetailClient
        recipe={recipe}
        relatedRecipes={relatedRecipes}
        initialRating={recipeRating}
      />
    </>
  );
}
