"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { RECIPES_DATA, RecipeItem } from "@/lib/recipes-data";

const CATEGORIES = [
  "All",
  "Kashmiri Heritage",
  "Indian Regional",
  "Western Classics",
  "Asian Delights",
  "Modern Fusion",
];

const METHODS = [
  "All Methods",
  "Pan-Fried",
  "Curried / Simmered",
  "Baked / Roasted",
  "Grilled / Tandoori",
  "Poached / Steamed",
  "Appetizer / Snack",
];

export default function RecipesDirectoryPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All Methods");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRecipes = useMemo(() => {
    return RECIPES_DATA.filter((recipe) => {
      // Category match
      if (selectedCategory !== "All" && recipe.category !== selectedCategory) {
        return false;
      }
      // Method match
      if (selectedMethod !== "All Methods" && recipe.cookingMethod !== selectedMethod) {
        return false;
      }
      // Search match (title, subtitle, ingredients, cuisine)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = recipe.title.toLowerCase().includes(q);
        const inSub = recipe.subtitle.toLowerCase().includes(q);
        const inKashmiri = recipe.kashmiriName.toLowerCase().includes(q);
        const inCuisine = recipe.cuisine.toLowerCase().includes(q);
        const inIng = recipe.ingredients.some((sec) =>
          sec.items.some((item) => item.toLowerCase().includes(q))
        );
        if (!inTitle && !inSub && !inKashmiri && !inCuisine && !inIng) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, selectedMethod, searchQuery]);

  return (
    <div className="min-h-screen bg-[#031018] text-[#dfedf9] pt-28 pb-24 px-4 sm:px-6 lg:px-8">
      {/* Schema.org CollectionPage ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "50 Best Trout Recipes from Kashmir & Around the World | Urban Trout",
            description:
              "Master cooking fresh Himalayan Rainbow Trout with 50 chef-crafted recipes. Authentic Kashmiri curries, Indian regional gravies, continental pan-sears, and Asian glazes.",
            url: "https://urbantrout.in/recipes",
            mainEntity: {
              "@type": "ItemList",
              itemListElement: RECIPES_DATA.slice(0, 30).map((r, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `https://urbantrout.in/recipes/${r.slug}`,
                name: r.title,
              })),
            },
          }),
        }}
      />

      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="flex items-center text-xs text-[#9fadb8] mb-6 space-x-2">
          <Link href="/" className="hover:text-[#72ddfd] transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#72ddfd] font-medium">Trout Recipes Hub</span>
        </nav>

        {/* Hero Header */}
        <header className="mb-12 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10212c] border border-[#72ddfd]/30 text-[#72ddfd] text-xs font-semibold uppercase tracking-wider mb-4">
            <span>✨ 50 Chef-Crafted Recipes</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#72ddfd]"></span>
            <span>100% Pan-Ready Trout</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            The Ultimate <span className="text-[#72ddfd]">Trout Recipe</span> Collection
          </h1>

          <p className="text-base sm:text-lg text-[#9fadb8] max-w-3xl leading-relaxed mb-8">
            From centuries-old Kashmiri wazwan specialties like <strong className="text-white">Gaad Te Nadir</strong> and{" "}
            <strong className="text-white">Gaad Te Tamatar</strong>, to vibrant Indian coastal curries, crispy Mediterranean pan-sears, and fiery Korean glazes. 
            Every dish is calibrated specifically for <strong className="text-white">Urban Trout 400–500g Himalayan Rainbow Trout</strong> — harvested live from cold spring water with zero muddy odor.
          </p>

          {/* Quick Express Order Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#061e2c] via-[#09293b] to-[#061e2c] border border-[#72ddfd]/25 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#72ddfd]/10 border border-[#72ddfd]/30 flex items-center justify-center text-2xl flex-shrink-0">
                🐟
              </div>
              <div>
                <h3 className="text-white font-semibold text-base sm:text-lg">
                  Cooking tonight? Get Pan-Ready Trout Delivered in 2 Hours!
                </h3>
                <p className="text-xs sm:text-sm text-[#9fadb8]">
                  Descaled, hygienically gutted, 100% usable meat. Delivered across Srinagar (16km radius) within 90–120 mins of live harvest.
                </p>
              </div>
            </div>
            <a
              href="https://wa.me/919419900004?text=Hi%20Urban%20Trout%2C%20I%20am%20exploring%20your%20recipes%20and%20want%20to%20order%202kg%20fresh%20cleaned%20trout%20for%20express%20delivery!"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-[#031018] font-bold text-sm tracking-wide transition-all shadow-lg hover:shadow-green-500/20 text-center flex-shrink-0 flex items-center justify-center gap-2"
            >
              <span>💬 Order Trout on WhatsApp</span>
            </a>
          </div>
        </header>

        {/* Filters & Search Bar */}
        <section className="mb-10 space-y-5">
          {/* Search Input */}
          <div className="relative max-w-xl">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by recipe, ingredient (e.g. Nadroo, Mustard, Apple, Ghee)..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#0a1924] border border-[#1b3446] text-[#dfedf9] placeholder-[#5f7384] text-sm focus:outline-none focus:border-[#72ddfd] transition-colors"
            />
            <span className="absolute left-4 top-3.5 text-[#5f7384] text-base">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-3.5 text-xs text-[#9fadb8] hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const count =
                cat === "All"
                  ? RECIPES_DATA.length
                  : RECIPES_DATA.filter((r) => r.category === cat).length;
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? "bg-[#72ddfd] text-[#031018] shadow-md shadow-[#72ddfd]/20 font-semibold"
                      : "bg-[#091a26] text-[#9fadb8] border border-[#152e3f] hover:border-[#72ddfd]/40 hover:text-white"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      active ? "bg-[#031018]/20 text-[#031018]" : "bg-[#102434] text-[#72ddfd]"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Cooking Method Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[#5f7384] font-medium mr-1">Method:</span>
            {METHODS.map((m) => {
              const active = selectedMethod === m;
              return (
                <button
                  key={m}
                  onClick={() => setSelectedMethod(m)}
                  className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#153448] text-[#72ddfd] border border-[#72ddfd]/50 font-semibold"
                      : "bg-[#06151f] text-[#7a8e9e] border border-transparent hover:text-white"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </section>

        {/* Recipe Grid */}
        <div className="mb-8 flex items-center justify-between text-xs text-[#7a8e9e]">
          <span>
            Showing <strong className="text-white">{filteredRecipes.length}</strong> of {RECIPES_DATA.length} recipes
          </span>
          {(selectedCategory !== "All" || selectedMethod !== "All Methods" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedCategory("All");
                setSelectedMethod("All Methods");
                setSearchQuery("");
              }}
              className="text-[#72ddfd] hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>

        {filteredRecipes.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-[#06151e] border border-[#102434] p-8">
            <span className="text-4xl block mb-3">🔍</span>
            <h3 className="text-lg font-semibold text-white mb-2">No recipes match your criteria</h3>
            <p className="text-sm text-[#9fadb8] mb-4">
              Try searching for a different ingredient like &quot;nadroo&quot;, &quot;tomato&quot;, or &quot;mustard&quot;.
            </p>
            <button
              onClick={() => {
                setSelectedCategory("All");
                setSelectedMethod("All Methods");
                setSearchQuery("");
              }}
              className="px-4 py-2 rounded-xl bg-[#102434] text-[#72ddfd] hover:bg-[#153448] text-xs font-semibold transition-colors"
            >
              Show All 50 Recipes
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.slug} recipe={recipe} />
            ))}
          </div>
        )}

        {/* Bottom Trust & SEO Section */}
        <section className="mt-20 pt-12 border-t border-[#102434] grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div className="space-y-2">
            <div className="text-2xl">🏔️</div>
            <h4 className="text-white font-semibold text-base">Himalayan Cold-Water Purity</h4>
            <p className="text-xs text-[#9fadb8] leading-relaxed">
              Harvested from crystal-clear, oxygen-saturated spring water tanks at Malabagh, Srinagar. Zero muddy river bottom odor — guaranteed sweet, delicate taste.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">🔪</div>
            <h4 className="text-white font-semibold text-base">Pan-Ready: 100% Usable Meat</h4>
            <p className="text-xs text-[#9fadb8] leading-relaxed">
              Descaled, gutted, with gills and entrails removed by skilled fishmongers. Simply rinse and cook — single pull deboning after cooking.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-2xl">⚡</div>
            <h4 className="text-white font-semibold text-base">2-Hour Express Srinagar Delivery</h4>
            <p className="text-xs text-[#9fadb8] leading-relaxed">
              Harvested only after you confirm your order. Packed in 100% food-grade biodegradable polythene (0% ice) and dispatched directly to your GPS pin.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeItem }) {
  const [imgSrc, setImgSrc] = useState(
    `/images/recipes/${recipe.slug}.webp`
  );

  return (
    <article className="group flex flex-col rounded-2xl bg-[#06151f] border border-[#132838] hover:border-[#72ddfd]/40 transition-all duration-300 overflow-hidden shadow-lg hover:shadow-cyan-950/20">
      {/* Card Image Header */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#091d2c]">
        <Image
          src={imgSrc}
          alt={recipe.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={() => setImgSrc("/images/gutted_trout_premium.webp")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06151f] via-transparent to-transparent opacity-80" />

        {/* Category & Method Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#031018]/80 backdrop-blur-md text-[#72ddfd] border border-[#72ddfd]/30">
            {recipe.category}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#102434]/80 backdrop-blur-md text-[#dfedf9]">
            {recipe.cookingMethod}
          </span>
        </div>

        {/* Hero Tag */}
        {recipe.heroTag && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              ★ {recipe.heroTag}
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {recipe.kashmiriName && (
            <span className="text-[11px] font-semibold text-[#72ddfd]/80 tracking-wider block mb-1">
              {recipe.kashmiriName}
            </span>
          )}

          <h3 className="text-lg font-bold text-white group-hover:text-[#72ddfd] transition-colors leading-snug mb-2">
            <Link href={`/recipes/${recipe.slug}`}>{recipe.title}</Link>
          </h3>

          <p className="text-xs text-[#9fadb8] line-clamp-2 leading-relaxed mb-4">
            {recipe.subtitle}
          </p>
        </div>

        <div>
          {/* Quick Stats Meta */}
          <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-[#091a26] border border-[#11293a] text-center text-[11px] mb-4">
            <div>
              <span className="text-[#5f7384] block text-[9px] uppercase tracking-wider">Time</span>
              <span className="text-white font-medium">{recipe.totalTime}</span>
            </div>
            <div>
              <span className="text-[#5f7384] block text-[9px] uppercase tracking-wider">Yield</span>
              <span className="text-white font-medium">{recipe.servings} Servings</span>
            </div>
            <div>
              <span className="text-[#5f7384] block text-[9px] uppercase tracking-wider">Protein</span>
              <span className="text-[#72ddfd] font-semibold">{recipe.nutrition.protein}</span>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <Link
              href={`/recipes/${recipe.slug}`}
              className="flex-1 py-2 rounded-xl bg-[#102434] hover:bg-[#72ddfd] hover:text-[#031018] text-[#72ddfd] text-xs font-semibold transition-all text-center"
            >
              View Recipe →
            </Link>
            <a
              href={`https://wa.me/919419900004?text=Hi%20Urban%20Trout%2C%20I%20am%20making%20${encodeURIComponent(
                recipe.title
              )}%20and%20want%20to%20order%20fresh%20trout!`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Order trout for ${recipe.title} on WhatsApp`}
              className="p-2 rounded-xl bg-[#1f382a] hover:bg-[#25D366] text-green-400 hover:text-[#031018] text-xs transition-colors flex items-center justify-center"
              title="Order Trout for this recipe on WhatsApp"
            >
              🛒
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
