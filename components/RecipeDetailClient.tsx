"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RecipeItem } from "@/lib/recipes-data";

export interface ClientRecipeRating {
  sum: number;
  count: number;
  ratingValue: string;
}

interface Props {
  recipe: RecipeItem;
  relatedRecipes: RecipeItem[];
  initialRating?: ClientRecipeRating | null;
}

export default function RecipeDetailClient({ recipe, relatedRecipes, initialRating = null }: Props) {
  const [servings, setServings] = useState<number>(recipe.servings || 4);
  const [copied, setCopied] = useState(false);
  const [ratingStats, setRatingStats] = useState<ClientRecipeRating | null>(initialRating);
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverStar, setHoverStar] = useState<number>(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingStatus, setRatingStatus] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ut_rated_recipes") || "{}");
      if (saved && typeof saved[recipe.slug] === "number") {
        setUserRating(saved[recipe.slug]);
      }
    } catch {}

    let active = true;
    fetch(`/api/recipes/rate?slug=${encodeURIComponent(recipe.slug)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.success && data.rating) {
          setRatingStats(data.rating);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [recipe.slug]);

  const handleRateRecipe = async (stars: number) => {
    if (submittingRating || userRating > 0) return;
    setSubmittingRating(true);
    setRatingStatus(null);
    try {
      const res = await fetch("/api/recipes/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: recipe.slug, rating: stars }),
      });
      const data = await res.json();
      if (res.ok && data?.success && data.rating) {
        setRatingStats(data.rating);
        setUserRating(stars);
        setRatingStatus("Thanks for rating this recipe!");
        try {
          const saved = JSON.parse(localStorage.getItem("ut_rated_recipes") || "{}");
          saved[recipe.slug] = stars;
          localStorage.setItem("ut_rated_recipes", JSON.stringify(saved));
        } catch {}
      } else {
        setRatingStatus(data?.error || "Could not save rating right now.");
      }
    } catch {
      setRatingStatus("Network error while saving rating.");
    } finally {
      setSubmittingRating(false);
    }
  };

  const scaleFactor = servings / (recipe.servings || 4);

  // Helper to dynamically scale numeric quantities in ingredient lines
  const scaleIngredient = (text: string) => {
    if (scaleFactor === 1) return text;
    return text.replace(/(\d+(?:\.\d+)?|\d+\/\d+)/g, (match) => {
      let val = 0;
      if (match.includes("/")) {
        const [n, d] = match.split("/").map(Number);
        val = n / d;
      } else {
        val = parseFloat(match);
      }
      const scaled = val * scaleFactor;
      if (Number.isInteger(scaled)) return scaled.toString();
      return scaled.toFixed(1).replace(/\.0$/, "");
    });
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // WhatsApp express order calculation
  const orderWeightKg = Math.max(1, Math.round((servings / 4) * 2));
  const waOrderText = encodeURIComponent(
    `Hello Urban Trout! I am cooking "${recipe.title}" for ${servings} people. I would like to order ${orderWeightKg} kg of Cleaned & Gutted Pan-Ready Trout (400–500g fish) for express delivery.`
  );
  const waOrderUrl = `https://wa.me/919419900004?text=${waOrderText}`;

  const [heroImage, setHeroImage] = useState(
    `/images/recipes/${recipe.slug}.webp`
  );

  return (
    <div className="min-h-screen bg-[#031018] text-[#dfedf9] pt-24 pb-28 px-4 sm:px-6 lg:px-8 selection:bg-[#72ddfd]/20 selection:text-[#72ddfd]">
      <div className="max-w-6xl mx-auto">
        {/* Top Header Utilities */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#122838]">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center text-xs text-[#9fadb8] space-x-2">
            <Link href="/" className="hover:text-[#72ddfd] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/recipes" className="hover:text-[#72ddfd] transition-colors">
              Recipes
            </Link>
            <span>/</span>
            <span className="text-[#9fadb8]">{recipe.category}</span>
            <span>/</span>
            <span className="text-[#72ddfd] font-medium truncate max-w-[180px] sm:max-w-xs">
              {recipe.title}
            </span>
          </nav>

          {/* Action Utilities (Share & Print) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleShare}
              className="px-3 py-1.5 rounded-xl bg-[#091d2c] hover:bg-[#122d42] border border-[#17384e] text-xs font-semibold text-[#dfedf9] hover:text-[#72ddfd] transition-all flex items-center gap-1.5 shadow-sm"
              title="Share Recipe Link"
            >
              <span>{copied ? "✓ Copied!" : "🔗 Share"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-[#091d2c] hover:bg-[#122d42] border border-[#17384e] text-xs font-semibold text-[#dfedf9] hover:text-[#72ddfd] transition-all flex items-center gap-1.5 shadow-sm"
              title="Print Recipe"
            >
              <span>🖨️ Print</span>
            </button>
          </div>
        </div>

        {/* Recipe Title & Hero Meta */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3.5">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#102434] text-[#72ddfd] border border-[#72ddfd]/30 shadow-sm">
              {recipe.category}
            </span>
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#091a26] text-[#dfedf9] border border-[#1b3446]">
              {recipe.cookingMethod}
            </span>
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
              ⏱️ {recipe.totalTime}
            </span>
            <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-cyan-950/40 text-cyan-300 border border-cyan-500/30">
              👥 {servings} Servings
            </span>
            {ratingStats && ratingStats.count > 0 && (
              <a
                href="#rate-recipe"
                className="px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-950/40 text-amber-300 border border-amber-500/35 hover:border-amber-400 transition-colors"
              >
                ★ {ratingStats.ratingValue} ({ratingStats.count} {ratingStats.count === 1 ? "rating" : "ratings"})
              </a>
            )}
          </div>

          {recipe.kashmiriName && (
            <span className="text-sm sm:text-base font-semibold text-[#72ddfd] tracking-wide block mb-1">
              Traditional: {recipe.kashmiriName}
            </span>
          )}

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-3">
            {recipe.title}
          </h1>

          <p className="text-base sm:text-lg text-[#9fadb8] leading-relaxed max-w-3xl">
            {recipe.subtitle}
          </p>
        </header>

        {/* Hero Visual & Fresh Trout Order Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10 items-stretch">
          {/* Main Dish Photography */}
          <div className="lg:col-span-7">
            <div className="relative aspect-[16/11] w-full rounded-2xl overflow-hidden bg-[#091d2c] border border-[#162e40] shadow-2xl">
              <Image
                src={heroImage}
                alt={recipe.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                onError={() => setHeroImage("/images/gutted_trout_premium.webp")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#031018]/90 via-transparent to-transparent opacity-90" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/95">
                <span className="bg-[#031018]/85 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 font-medium">
                  ✨ 100% Pan-Ready (Cleaned &amp; Gutted)
                </span>
                <span className="bg-[#031018]/85 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 font-medium">
                  🏔️ Cold-Water Spring Harvest
                </span>
              </div>
            </div>
          </div>

          {/* Farm-Direct Fresh Catch Booking Card */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-gradient-to-b from-[#061e2c] via-[#051926] to-[#04131d] border border-[#72ddfd]/30 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#72ddfd]/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Live Harvest Available Today
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2 leading-snug">
                Cook with Fresh Himalayan Trout
              </h2>

              <p className="text-xs text-[#9fadb8] leading-relaxed mb-5">
                Delivered across Srinagar in 90–120 mins of live harvest. Packed in 100% food-grade packaging (0% ice) with sweet, delicate meat and zero muddy odor.
              </p>

              {/* Requirement Summary Box */}
              <div className="p-4 rounded-xl bg-[#091d2c]/90 border border-[#16364c] mb-6 space-y-1.5 shadow-inner">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#72ddfd] block">
                  Recommended For {servings} Servings:
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    {orderWeightKg} kg Cleaned &amp; Gutted Trout
                  </span>
                  <span className="text-base font-extrabold text-[#72ddfd]">
                    ₹{orderWeightKg * 580}
                  </span>
                </div>
                <span className="text-[11px] text-[#9fadb8] block">
                  ({orderWeightKg * 2} x 400–500g pan-ready gutted fish • 100% meat yield)
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <a
                href={waOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-[#031018] font-bold text-sm transition-all shadow-lg hover:shadow-green-500/25 flex items-center justify-center gap-2 text-center"
              >
                <span>💬 Order Fresh Trout on WhatsApp</span>
              </a>
              <Link
                href="/shop/gutted-trout"
                className="w-full py-2.5 px-4 rounded-xl bg-[#091a26] hover:bg-[#102434] text-[#72ddfd] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-[#153448] text-center"
              >
                <span>🛒 View in Store</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Culinary Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-10">
          <div className="p-4 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5f7384] block mb-1">
              Prep Time
            </span>
            <span className="text-sm sm:text-base font-bold text-white">{recipe.prepTime}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5f7384] block mb-1">
              Cook Time
            </span>
            <span className="text-sm sm:text-base font-bold text-white">{recipe.cookTime}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5f7384] block mb-1">
              Difficulty
            </span>
            <span className="text-sm sm:text-base font-bold text-[#72ddfd]">{recipe.difficulty}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5f7384] block mb-1">
              Calories
            </span>
            <span className="text-sm sm:text-base font-bold text-white">{recipe.nutrition.calories} kcal</span>
          </div>
          <div className="p-4 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5f7384] block mb-1">
              Protein
            </span>
            <span className="text-sm sm:text-base font-bold text-emerald-400">{recipe.nutrition.protein}</span>
          </div>
          <div className="p-4 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#5f7384] block mb-1">
              Omega-3
            </span>
            <span className="text-sm sm:text-base font-bold text-cyan-300">{recipe.nutrition.omega3}</span>
          </div>
        </div>

        {/* Editorial Culinary Context */}
        <section className="mb-12 p-6 sm:p-8 rounded-2xl bg-[#06151f] border border-[#132838] shadow-lg">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>Culinary Background &amp; Technique</span>
            <span className="text-[11px] font-semibold text-[#72ddfd] bg-[#102434] px-2.5 py-0.5 rounded-full border border-[#72ddfd]/25">
              Chef Insight
            </span>
          </h2>
          <div className="text-sm sm:text-base text-[#9fadb8] leading-relaxed space-y-3.5">
            {recipe.description.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>

        {/* WORKSPACE: Ingredients (Left 40%) & Method/Tips (Right 60%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 items-start">
          {/* LEFT: THE PANTRY & INGREDIENTS (Clean, No Checkboxes, No Strikethroughs) */}
          <div className="lg:col-span-5 bg-[#06151f] border border-[#162e40] rounded-2xl p-6 sm:p-7 shadow-xl">
            {/* Header + Modern Servings Scaler */}
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#142e40]">
              <div>
                <h3 className="text-xl font-black text-white">Ingredients</h3>
                <span className="text-[11px] text-[#5f7384]">Adjust portions below</span>
              </div>

              {/* Minimalist Portion Counter: [-] 4 [+] */}
              <div className="flex items-center gap-2 bg-[#091a26] px-3 py-1.5 rounded-xl border border-[#153448]">
                <button
                  onClick={() => setServings((prev) => Math.max(2, prev - 2))}
                  disabled={servings <= 2}
                  className="w-6 h-6 rounded-lg bg-[#102434] hover:bg-[#153448] disabled:opacity-40 text-[#72ddfd] font-bold text-xs flex items-center justify-center transition-colors"
                  aria-label="Decrease servings"
                >
                  −
                </button>
                <span className="text-xs font-bold text-white min-w-[50px] text-center">
                  {servings} Servings
                </span>
                <button
                  onClick={() => setServings((prev) => Math.min(12, prev + 2))}
                  disabled={servings >= 12}
                  className="w-6 h-6 rounded-lg bg-[#102434] hover:bg-[#153448] disabled:opacity-40 text-[#72ddfd] font-bold text-xs flex items-center justify-center transition-colors"
                  aria-label="Increase servings"
                >
                  +
                </button>
              </div>
            </div>

            {/* Structured Ingredient Sections */}
            <div className="space-y-6">
              {recipe.ingredients.map((sec, secIdx) => (
                <div key={secIdx} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#72ddfd]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#72ddfd]">
                      {sec.section}
                    </h4>
                  </div>
                  <ul className="space-y-2 pl-3 border-l border-[#132c3f]">
                    {sec.items.map((item, itemIdx) => {
                      const scaledItem = scaleIngredient(item);
                      return (
                        <li
                          key={itemIdx}
                          className="text-xs sm:text-sm text-[#dfedf9] leading-snug flex items-start gap-2 py-0.5"
                        >
                          <span className="text-[#72ddfd] text-xs select-none">•</span>
                          <span>{scaledItem}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bottom In-Card Order CTA */}
            <div className="mt-8 pt-6 border-t border-[#142e40]">
              <a
                href={waOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366] text-[#25D366] hover:text-[#031018] border border-[#25D366]/30 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 text-center shadow-sm"
              >
                <span>🛒 Order {orderWeightKg}kg Trout For This Dish</span>
              </a>
            </div>
          </div>

          {/* RIGHT: STEP-BY-STEP METHOD & CULINARY EXECUTION */}
          <div className="lg:col-span-7 space-y-8">
            {/* Steps Timeline Card */}
            <div className="bg-[#06151f] border border-[#162e40] rounded-2xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#142e40]">
                <h3 className="text-xl font-black text-white">Cooking Method</h3>
                <span className="text-xs font-semibold text-[#72ddfd] bg-[#091a26] px-3 py-1 rounded-xl border border-[#142e40]">
                  {recipe.instructions.length} Steps
                </span>
              </div>

              {/* Numbered Steps */}
              <div className="space-y-6">
                {recipe.instructions.map((step, idx) => {
                  const stepNum = step.step || idx + 1;
                  return (
                    <div
                      key={idx}
                      id={`step-${stepNum}`}
                      className="scroll-mt-28 relative flex gap-4 items-start group"
                    >
                      {/* Step Number Circle */}
                      <span className="w-8 h-8 rounded-full bg-[#102434] border border-[#72ddfd]/40 text-[#72ddfd] font-bold text-xs flex items-center justify-center flex-shrink-0 group-hover:border-[#72ddfd] transition-colors shadow-sm">
                        {String(stepNum).padStart(2, "0")}
                      </span>

                      <div className="flex-1 pb-2">
                        <h4 className="text-sm sm:text-base font-bold text-white mb-1.5 leading-snug">
                          {step.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-[#9fadb8] leading-relaxed">
                          {step.instruction}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Interactive Community Recipe Rating Card */}
            <div
              id="rate-recipe"
              className="scroll-mt-28 bg-[#06151f] border border-[#162e40] rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <h4 className="text-sm sm:text-base font-bold text-white mb-1">
                  Rate This Recipe
                </h4>
                <p className="text-xs text-[#9fadb8]">
                  {ratingStats && ratingStats.count > 0
                    ? `Rated ${ratingStats.ratingValue} / 5 across ${ratingStats.count} ${ratingStats.count === 1 ? "home chef rating" : "home chef ratings"}`
                    : "Tried cooking this trout dish? Share your star rating below."}
                </p>
                {ratingStatus && (
                  <p className="text-[11px] text-[#72ddfd] mt-1 font-medium">{ratingStatus}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5" role="group" aria-label="Rate this recipe">
                {[1, 2, 3, 4, 5].map((star) => {
                  const activeLevel = hoverStar || userRating || Math.round(Number(ratingStats?.ratingValue || 0));
                  const isFilled = star <= activeLevel;
                  return (
                    <button
                      key={star}
                      type="button"
                      disabled={submittingRating || userRating > 0}
                      onMouseEnter={() => userRating === 0 && setHoverStar(star)}
                      onMouseLeave={() => setHoverStar(0)}
                      onClick={() => handleRateRecipe(star)}
                      aria-label={`Rate ${star} out of 5 stars`}
                      className={`w-9 h-9 rounded-xl border text-lg flex items-center justify-center transition-all ${
                        isFilled
                          ? "bg-amber-500/15 border-amber-400/50 text-amber-300"
                          : "bg-[#091a26] border-[#153448] text-[#5f7384] hover:border-amber-400/40 hover:text-amber-300"
                      } disabled:cursor-default`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chef's Pro-Tips Box (Always visible, prominent amber card) */}
            {recipe.chefTips.length > 0 && (
              <div className="bg-gradient-to-br from-[#1c1809] to-[#120f06] border border-amber-500/35 rounded-2xl p-6 sm:p-7 shadow-xl">
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="text-xl">💡</span>
                  <h4 className="text-base font-bold text-amber-200">
                    Master Chef Secrets &amp; Pro-Tips
                  </h4>
                </div>
                <div className="space-y-3">
                  {recipe.chefTips.map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-amber-100/90 leading-relaxed">
                      <span className="text-amber-400 font-bold select-none">✦</span>
                      <p>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nutritional Matrix Box */}
            <div className="bg-[#06151f] border border-[#162e40] rounded-2xl p-6 sm:p-7 shadow-xl">
              <h4 className="text-base font-bold text-white mb-3">
                Nutritional Breakdown (Per Serving)
              </h4>
              <p className="text-xs text-[#9fadb8] mb-4">
                Nutrient analysis based on fresh cold-water Rainbow Trout:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#091a26] border border-[#142e40]">
                  <span className="text-[10px] text-[#5f7384] uppercase font-bold block mb-0.5">
                    Calories
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {recipe.nutrition.calories} kcal
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#091a26] border border-[#142e40]">
                  <span className="text-[10px] text-[#5f7384] uppercase font-bold block mb-0.5">
                    Protein
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-400">
                    {recipe.nutrition.protein}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#091a26] border border-[#142e40]">
                  <span className="text-[10px] text-[#5f7384] uppercase font-bold block mb-0.5">
                    Healthy Fats
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {recipe.nutrition.fat}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#091a26] border border-[#142e40]">
                  <span className="text-[10px] text-[#5f7384] uppercase font-bold block mb-0.5">
                    Omega-3
                  </span>
                  <span className="text-sm sm:text-base font-bold text-cyan-300">
                    {recipe.nutrition.omega3}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#091a26] border border-[#142e40]">
                  <span className="text-[10px] text-[#5f7384] uppercase font-bold block mb-0.5">
                    Carbohydrates
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {recipe.nutrition.carbs}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#091a26] border border-[#142e40]">
                  <span className="text-[10px] text-[#5f7384] uppercase font-bold block mb-0.5">
                    Dietary Fiber
                  </span>
                  <span className="text-sm sm:text-base font-bold text-white">
                    {recipe.nutrition.fiber}
                  </span>
                </div>
              </div>
            </div>

            {/* Serving Accompaniments */}
            {recipe.pairings.length > 0 && (
              <div className="bg-[#06151f] border border-[#162e40] rounded-2xl p-5 sm:p-6 shadow-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#72ddfd] mb-3">
                  What to Serve With It
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recipe.pairings.map((pair, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-[#091a26] border border-[#142e40] text-xs text-[#dfedf9] font-medium"
                    >
                      🍚 {pair}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Recipes Section */}
        {relatedRecipes.length > 0 && (
          <section className="mt-16 pt-10 border-t border-[#122838]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                More {recipe.category} Dishes
              </h3>
              <Link
                href="/recipes"
                className="text-xs text-[#72ddfd] hover:underline font-semibold"
              >
                Browse All 50 Recipes →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {relatedRecipes.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/recipes/${rel.slug}`}
                  className="group rounded-2xl bg-[#06151f] border border-[#132838] hover:border-[#72ddfd]/40 p-4 transition-all shadow-md hover:shadow-cyan-950/20"
                >
                  <span className="text-[10px] font-bold text-[#72ddfd] uppercase tracking-wider block mb-1">
                    {rel.cookingMethod}
                  </span>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#72ddfd] transition-colors mb-1 line-clamp-1">
                    {rel.title}
                  </h4>
                  <p className="text-xs text-[#9fadb8] line-clamp-2 leading-relaxed mb-3">
                    {rel.subtitle}
                  </p>
                  <span className="text-[11px] text-[#5f7384]">⏱️ {rel.totalTime}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Floating Mobile Bottom Booking Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-[#031018]/95 backdrop-blur-md border-t border-[#16364c] z-40 flex items-center justify-between gap-3 shadow-2xl">
        <div className="flex flex-col">
          <span className="text-[10px] text-[#9fadb8]">Fresh Trout for {servings}P</span>
          <span className="text-xs font-bold text-white">{orderWeightKg} kg (₹{orderWeightKg * 580})</span>
        </div>
        <a
          href={waOrderUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2.5 px-4 rounded-xl bg-[#25D366] text-[#031018] font-bold text-xs flex items-center gap-1.5 shadow-lg"
        >
          <span>💬 Order on WhatsApp</span>
        </a>
      </div>
    </div>
  );
}
