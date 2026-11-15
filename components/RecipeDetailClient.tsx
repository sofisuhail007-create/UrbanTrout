"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RecipeItem } from "@/lib/recipes-data";

interface Props {
  recipe: RecipeItem;
  relatedRecipes: RecipeItem[];
}

export default function RecipeDetailClient({ recipe, relatedRecipes }: Props) {
  const [servings, setServings] = useState<number>(recipe.servings || 4);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"instructions" | "nutrition" | "tips">("instructions");

  const scaleFactor = servings / (recipe.servings || 4);

  // Helper to scale numeric quantities in ingredient lines
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
      // Format cleanly
      if (Number.isInteger(scaled)) return scaled.toString();
      return scaled.toFixed(1).replace(/\.0$/, "");
    });
  };

  const toggleIngredient = (key: string) => {
    setCheckedIngredients((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // WhatsApp order link
  const orderWeightKg = Math.max(1, Math.round((servings / 4) * 2));
  const waOrderText = encodeURIComponent(
    `Hello Urban Trout! I'm cooking "${recipe.title}" for ${servings} people. I'd like to order ${orderWeightKg} kg of Cleaned & Gutted Pan-Ready Trout (400-500g fish) for express delivery.`
  );
  const waOrderUrl = `https://wa.me/919419900004?text=${waOrderText}`;

  const [heroImage, setHeroImage] = useState(
    `/images/recipes/${recipe.slug}.webp`
  );

  return (
    <div className="min-h-screen bg-[#031018] text-[#dfedf9] pt-24 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center text-xs text-[#9fadb8] mb-6 space-x-2">
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
          <span className="text-[#72ddfd] font-medium truncate max-w-[200px] sm:max-w-none">
            {recipe.title}
          </span>
        </nav>

        {/* Recipe Title & Hero Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#102434] text-[#72ddfd] border border-[#72ddfd]/30">
              {recipe.category}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#091a26] text-[#dfedf9] border border-[#1b3446]">
              {recipe.cookingMethod}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
              ⏱️ {recipe.totalTime}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/40 text-cyan-300 border border-cyan-500/30">
              👥 {servings} Servings
            </span>
          </div>

          {recipe.kashmiriName && (
            <span className="text-sm sm:text-base font-semibold text-[#72ddfd]/90 block mb-1">
              {recipe.kashmiriName}
            </span>
          )}

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-4">
            {recipe.title}
          </h1>

          <p className="text-base sm:text-lg text-[#9fadb8] leading-relaxed max-w-3xl">
            {recipe.subtitle}
          </p>
        </header>

        {/* Hero Visual & Quick Order Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 items-start">
          {/* Main Dish Image */}
          <div className="lg:col-span-7">
            <div className="relative aspect-[16/11] w-full rounded-2xl overflow-hidden bg-[#091d2c] border border-[#132838] shadow-2xl">
              <Image
                src={heroImage}
                alt={recipe.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
                onError={() => setHeroImage("/images/gutted_trout_premium.webp")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#031018]/90 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/90">
                <span className="bg-[#031018]/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                  ⚡ 100% Pan-Ready (Cleaned & Gutted)
                </span>
                <span className="bg-[#031018]/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
                  🏔️ Cold-Water Farm Fresh
                </span>
              </div>
            </div>
          </div>

          {/* WhatsApp Express Order Card */}
          <div className="lg:col-span-5 flex flex-col justify-between h-full bg-gradient-to-b from-[#061e2c] to-[#041520] border border-[#72ddfd]/30 rounded-2xl p-6 shadow-xl">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Live Harvest In Stock
                </span>
              </div>

              <h2 className="text-lg font-bold text-white mb-2">
                Cook this dish with Live-Harvested Trout
              </h2>

              <p className="text-xs text-[#9fadb8] leading-relaxed mb-4">
                Delivered across Srinagar within 90–120 minutes. Packed in food-grade biodegradable packaging (0% ice) with zero muddy odor.
              </p>

              {/* Requirement pill */}
              <div className="p-3.5 rounded-xl bg-[#091d2c] border border-[#153448] mb-5 space-y-1">
                <span className="text-[11px] text-[#5f7384] uppercase tracking-wider block">
                  Recommended For {servings} Servings:
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    {orderWeightKg} kg Cleaned & Gutted Trout
                  </span>
                  <span className="text-sm font-bold text-[#72ddfd]">
                    ₹{orderWeightKg * 580}
                  </span>
                </div>
                <span className="text-[10px] text-[#9fadb8] block">
                  ({orderWeightKg * 2} x 400-500g pan-ready fish)
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <a
                href={waOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-[#031018] font-bold text-sm transition-all shadow-lg hover:shadow-green-500/25 flex items-center justify-center gap-2 text-center"
              >
                <span>💬 Order Pan-Ready Trout on WhatsApp</span>
              </a>
              <Link
                href="/shop/gutted-trout"
                className="w-full py-2.5 px-4 rounded-xl bg-[#091d2c] hover:bg-[#10293d] text-[#72ddfd] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-[#17384e] text-center"
              >
                <span>🛒 View in Online Store</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Nutrition & Specs Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-12">
          <div className="p-3.5 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#5f7384] block mb-0.5">
              Prep Time
            </span>
            <span className="text-sm font-bold text-white">{recipe.prepTime}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#5f7384] block mb-0.5">
              Cook Time
            </span>
            <span className="text-sm font-bold text-white">{recipe.cookTime}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#5f7384] block mb-0.5">
              Difficulty
            </span>
            <span className="text-sm font-bold text-[#72ddfd]">{recipe.difficulty}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#5f7384] block mb-0.5">
              Calories
            </span>
            <span className="text-sm font-bold text-white">{recipe.nutrition.calories} kcal</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#5f7384] block mb-0.5">
              Protein
            </span>
            <span className="text-sm font-bold text-emerald-400">{recipe.nutrition.protein}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[#06151f] border border-[#132838] text-center">
            <span className="text-[10px] uppercase tracking-wider text-[#5f7384] block mb-0.5">
              Omega-3
            </span>
            <span className="text-sm font-bold text-cyan-300">{recipe.nutrition.omega3}</span>
          </div>
        </div>

        {/* Editorial Story & Brand Context */}
        <section className="mb-12 p-6 sm:p-8 rounded-2xl bg-[#06151f] border border-[#132838]">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>About this Recipe</span>
            <span className="text-xs font-normal text-[#72ddfd] bg-[#102434] px-2.5 py-0.5 rounded-full border border-[#72ddfd]/20">
              Chef-Crafted
            </span>
          </h2>
          <div className="text-sm sm:text-base text-[#9fadb8] leading-relaxed space-y-4">
            {recipe.description.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </section>

        {/* Main Content Layout: Ingredients (Left) & Instructions (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 items-start">
          {/* INGREDIENTS COLUMN (Interactive Scaler + Checklist) */}
          <div className="lg:col-span-5 bg-[#06151f] border border-[#132838] rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#112738]">
              <div>
                <h3 className="text-lg font-bold text-white">Ingredients</h3>
                <span className="text-[11px] text-[#5f7384]">Tap item to cross off</span>
              </div>

              {/* Portion Scaler Selector */}
              <div className="flex items-center gap-1 bg-[#091a26] p-1 rounded-xl border border-[#152e3f]">
                {[2, 4, 6, 8].map((s) => (
                  <button
                    key={s}
                    onClick={() => setServings(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      servings === s
                        ? "bg-[#72ddfd] text-[#031018]"
                        : "text-[#7a8e9e] hover:text-white"
                    }`}
                  >
                    {s}P
                  </button>
                ))}
              </div>
            </div>

            {/* Ingredients by Section */}
            <div className="space-y-6">
              {recipe.ingredients.map((sec, secIdx) => (
                <div key={secIdx}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#72ddfd] mb-3">
                    {sec.section}
                  </h4>
                  <ul className="space-y-2.5">
                    {sec.items.map((item, itemIdx) => {
                      const key = `${secIdx}-${itemIdx}`;
                      const isChecked = !!checkedIngredients[key];
                      const scaledItem = scaleIngredient(item);
                      return (
                        <li
                          key={itemIdx}
                          onClick={() => toggleIngredient(key)}
                          className={`flex items-start gap-2.5 text-xs sm:text-sm cursor-pointer select-none transition-colors ${
                            isChecked
                              ? "text-[#4b5d6b] line-through"
                              : "text-[#dfedf9] hover:text-[#72ddfd]"
                          }`}
                        >
                          <span
                            className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center flex-shrink-0 border text-[10px] ${
                              isChecked
                                ? "bg-[#72ddfd] border-[#72ddfd] text-[#031018]"
                                : "border-[#1c384e] bg-[#091a26]"
                            }`}
                          >
                            {isChecked && "✓"}
                          </span>
                          <span className="leading-snug">{scaledItem}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* In-Recipe WhatsApp Order CTA */}
            <div className="mt-8 pt-6 border-t border-[#112738]">
              <a
                href={waOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366] text-[#25D366] hover:text-[#031018] border border-[#25D366]/30 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 text-center"
              >
                <span>🛒 Order {orderWeightKg}kg Trout For This Dish</span>
              </a>
            </div>
          </div>

          {/* INSTRUCTIONS COLUMN */}
          <div className="lg:col-span-7 bg-[#06151f] border border-[#132838] rounded-2xl p-6 sm:p-8 shadow-lg">
            {/* View Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-[#112738] pb-3 text-xs sm:text-sm">
              <button
                onClick={() => setActiveTab("instructions")}
                className={`pb-2 font-bold transition-colors ${
                  activeTab === "instructions"
                    ? "text-[#72ddfd] border-b-2 border-[#72ddfd]"
                    : "text-[#9fadb8] hover:text-white"
                }`}
              >
                Cooking Steps ({recipe.instructions.length})
              </button>
              <button
                onClick={() => setActiveTab("tips")}
                className={`pb-2 font-bold transition-colors ${
                  activeTab === "tips"
                    ? "text-[#72ddfd] border-b-2 border-[#72ddfd]"
                    : "text-[#9fadb8] hover:text-white"
                }`}
              >
                Chef Pro-Tips ({recipe.chefTips.length})
              </button>
              <button
                onClick={() => setActiveTab("nutrition")}
                className={`pb-2 font-bold transition-colors ${
                  activeTab === "nutrition"
                    ? "text-[#72ddfd] border-b-2 border-[#72ddfd]"
                    : "text-[#9fadb8] hover:text-white"
                }`}
              >
                Nutritional Facts
              </button>
            </div>

            {/* TAB: Instructions */}
            {activeTab === "instructions" && (
              <div className="space-y-6">
                {recipe.instructions.map((step, idx) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <span className="w-8 h-8 rounded-xl bg-[#102434] border border-[#72ddfd]/30 text-[#72ddfd] font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {step.step || idx + 1}
                    </span>
                    <div className="flex-1">
                      <h4 className="text-sm sm:text-base font-bold text-white mb-1.5">
                        {step.title}
                      </h4>
                      <p className="text-xs sm:text-sm text-[#9fadb8] leading-relaxed">
                        {step.instruction}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Chef Tips */}
            {activeTab === "tips" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs mb-4">
                  💡 Pro-tips from master Kashmiri & international chefs for cooking fresh trout.
                </div>
                {recipe.chefTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#091a26] border border-[#152e3f] flex items-start gap-3"
                  >
                    <span className="text-amber-400 text-base">✦</span>
                    <p className="text-xs sm:text-sm text-[#dfedf9] leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Nutrition */}
            {activeTab === "nutrition" && (
              <div className="space-y-4">
                <p className="text-xs text-[#9fadb8] mb-4">
                  Estimated values per serving (based on {servings} servings with fresh Rainbow Trout):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-[#091a26] border border-[#152e3f]">
                    <span className="text-[10px] text-[#5f7384] uppercase block">Calories</span>
                    <span className="text-base font-bold text-white">{recipe.nutrition.calories} kcal</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#091a26] border border-[#152e3f]">
                    <span className="text-[10px] text-[#5f7384] uppercase block">Protein</span>
                    <span className="text-base font-bold text-emerald-400">{recipe.nutrition.protein}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#091a26] border border-[#152e3f]">
                    <span className="text-[10px] text-[#5f7384] uppercase block">Healthy Fats</span>
                    <span className="text-base font-bold text-white">{recipe.nutrition.fat}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#091a26] border border-[#152e3f]">
                    <span className="text-[10px] text-[#5f7384] uppercase block">Omega-3</span>
                    <span className="text-base font-bold text-cyan-300">{recipe.nutrition.omega3}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#091a26] border border-[#152e3f]">
                    <span className="text-[10px] text-[#5f7384] uppercase block">Carbohydrates</span>
                    <span className="text-base font-bold text-white">{recipe.nutrition.carbs}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#091a26] border border-[#152e3f]">
                    <span className="text-[10px] text-[#5f7384] uppercase block">Fiber</span>
                    <span className="text-base font-bold text-white">{recipe.nutrition.fiber}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Serving Accompaniments */}
            {recipe.pairings.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#112738]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#72ddfd] mb-3">
                  What Goes With It
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recipe.pairings.map((pair, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-[#091a26] border border-[#152e3f] text-xs text-[#dfedf9]"
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
          <section className="mt-16 pt-12 border-t border-[#112738]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                More {recipe.category} Recipes
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
                  className="group rounded-2xl bg-[#06151f] border border-[#132838] hover:border-[#72ddfd]/40 p-4 transition-all"
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
    </div>
  );
}
