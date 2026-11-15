"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { RECIPES_DATA, RecipeItem } from "@/lib/recipes-data";

interface CategoryMeta {
  id: string;
  name: string;
  icon: string;
  title: string;
  subtitle: string;
  tagline: string;
  badge: string;
  heroImg: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    id: "kashmiri-heritage",
    name: "Kashmiri Heritage",
    icon: "🏔️",
    title: "Kashmiri Heritage Collection",
    subtitle:
      "Centuries-old Wazwan and home classics: fresh trout paired with crunchy lotus roots (nadroo), sun-dried turnips (gogji aer), sweet Kashmiri apples, wild morels, and pure mustard oil.",
    tagline: "Authentic Valley Flavors",
    badge: "10 Heritage Recipes",
    heroImg: "/images/recipes/kashmiri-trout-lotus-stem-te-nadir.webp",
  },
  {
    id: "indian-regional",
    name: "Indian Regional",
    icon: "🌶️",
    title: "Indian Regional Curries & Tandoor",
    subtitle:
      "From coastal Goan coconut gravies and fiery Chettinad to pungent Bengali shorshe mustard and char-grilled tandoori whole trout.",
    tagline: "Coast-to-Coast Spices",
    badge: "10 Regional Curries",
    heroImg: "/images/recipes/char-grilled-tandoori-spiced-whole-trout.webp",
  },
  {
    id: "western-classics",
    name: "Western Classics",
    icon: "🫒",
    title: "Western & Mediterranean Classics",
    subtitle:
      "Classic French pan-fried Meunière, Mediterranean garlic-herb sears, crispy skillet street tacos, and velvety fettuccine tosses.",
    tagline: "Clean & High-Protein",
    badge: "10 Continental Classics",
    heroImg: "/images/recipes/classic-french-style-pan-fried-trout-meuniere.webp",
  },
  {
    id: "asian-delights",
    name: "Asian Delights",
    icon: "🥢",
    title: "Asian Delights & Sizzling Glazes",
    subtitle:
      "Japanese steakhouse sizzlers, sweet mirin whole-baked trout, fiery Korean gochujang glazes, and silky garlic-ginger noodle bowls.",
    tagline: "Vibrant Umami Profiles",
    badge: "10 Asian Specialties",
    heroImg: "/images/recipes/fiery-korean-gochujang-glazed-seared-trout.webp",
  },
  {
    id: "modern-fusion",
    name: "Modern Fusion",
    icon: "✨",
    title: "Modern Gourmet & Chef Fusion",
    subtitle:
      "Creative chef innovations: pan-fried trout in soft Kashmiri lavas flatbread, dimsums with clotted cream, and charred trout satays.",
    tagline: "Contemporary Innovations",
    badge: "10 Fusion Creations",
    heroImg: "/images/recipes/crispy-spiced-trout-wrapped-kashmiri-lavas-flatbread.webp",
  },
];

export default function RecipesDirectoryPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Group recipes by category
  const categorizedRecipes = useMemo(() => {
    const map: Record<string, RecipeItem[]> = {};
    CATEGORIES.forEach((cat) => {
      map[cat.name] = RECIPES_DATA.filter((r) => r.category === cat.name);
    });
    return map;
  }, []);

  // Filtered list when searching or filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return RECIPES_DATA.filter((r) => {
      const inTitle = r.title.toLowerCase().includes(q);
      const inSub = r.subtitle.toLowerCase().includes(q);
      const inKashmiri = r.kashmiriName?.toLowerCase().includes(q);
      const inCuisine = r.cuisine.toLowerCase().includes(q);
      const inIng = r.ingredients.some((sec) =>
        sec.items.some((item) => item.toLowerCase().includes(q))
      );
      return inTitle || inSub || inKashmiri || inCuisine || inIng;
    });
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#031018] text-[#dfedf9] pt-28 pb-28 px-4 sm:px-6 lg:px-8 selection:bg-[#72ddfd]/20 selection:text-[#72ddfd]">
      {/* Schema.org CollectionPage ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "50 Best Trout Recipes from Kashmir & Around the World | Urban Trout",
            description:
              "Explore 50 chef-crafted rainbow trout recipes organized by cuisine: Kashmiri Heritage, Indian Regional, Western Classics, Asian Delights, and Modern Fusion.",
            url: "https://urbantrout.in/recipes",
            mainEntity: {
              "@type": "ItemList",
              itemListElement: RECIPES_DATA.map((r, i) => ({
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
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center text-xs text-[#9fadb8] mb-6 space-x-2">
          <Link href="/" className="hover:text-[#72ddfd] transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-[#72ddfd] font-medium">Trout Recipes Hub</span>
          {selectedCategory !== "All" && (
            <>
              <span>/</span>
              <span className="text-white font-medium">{selectedCategory}</span>
            </>
          )}
        </nav>

        {/* Hero Header */}
        <header className="mb-10 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#102434] border border-[#72ddfd]/30 text-[#72ddfd] text-xs font-semibold uppercase tracking-wider mb-4 shadow-sm">
            <span>✨ 50 Chef Recipes</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#72ddfd]"></span>
            <span>5 Organized Collections</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-4 leading-tight">
            The <span className="text-[#72ddfd]">Trout Recipe</span> Vault
          </h1>

          <p className="text-base sm:text-lg text-[#9fadb8] max-w-3xl leading-relaxed mb-8">
            50 chef-developed recipes grouped into 5 culinary traditions. Each dish is tailored for <strong className="text-white">Urban Trout 400–500g Himalayan Rainbow Trout</strong> — harvested live from cold spring water in Malabagh, Srinagar, with zero muddy odor and 100% pan-ready yield.
          </p>

          {/* Quick Express WhatsApp Order Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#061e2c] via-[#09293b] to-[#061e2c] border border-[#72ddfd]/30 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#72ddfd]/10 border border-[#72ddfd]/30 flex items-center justify-center text-2xl flex-shrink-0">
                🐟
              </div>
              <div className="text-left">
                <h3 className="text-white font-bold text-base sm:text-lg">
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

        {/* 5 CATEGORY SHOWCASE CARDS (Visual Category Directory) */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#72ddfd]">
              Browse By Recipe Collection
            </h2>
            {selectedCategory !== "All" && (
              <button
                onClick={() => setSelectedCategory("All")}
                className="text-xs text-[#72ddfd] hover:underline font-semibold"
              >
                ← View All Collections
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.name;
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    setSelectedCategory(isActive ? "All" : cat.name)
                  }
                  className={`group relative rounded-2xl p-4 text-left transition-all duration-300 border flex flex-col justify-between overflow-hidden ${
                    isActive
                      ? "bg-gradient-to-b from-[#102d42] to-[#071926] border-[#72ddfd] shadow-lg shadow-[#72ddfd]/15 ring-1 ring-[#72ddfd]"
                      : "bg-[#06151f] hover:bg-[#091f2e] border-[#142e40] hover:border-[#72ddfd]/40"
                  }`}
                >
                  {/* Subtle Background Glow on Active */}
                  {isActive && (
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#72ddfd]/10 rounded-full blur-xl pointer-events-none" />
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{cat.icon}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-[#72ddfd] text-[#031018]"
                            : "bg-[#0c2231] text-[#72ddfd] border border-[#1b384c]"
                        }`}
                      >
                        10 Dishes
                      </span>
                    </div>

                    <h3
                      className={`text-sm font-bold transition-colors leading-snug mb-1 ${
                        isActive ? "text-white" : "text-[#dfedf9] group-hover:text-white"
                      }`}
                    >
                      {cat.name}
                    </h3>
                    <p className="text-[11px] text-[#7a8e9e] line-clamp-2 leading-relaxed">
                      {cat.tagline}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#122838] flex items-center justify-between text-[10px] font-semibold">
                    <span className={isActive ? "text-[#72ddfd]" : "text-[#5f7384] group-hover:text-[#9fadb8]"}>
                      {isActive ? "Viewing Collection" : "Explore →"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Search Bar */}
        <section className="mb-10">
          <div className="relative max-w-xl">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all 50 recipes (e.g. Nadroo, Mustard, Apples, Tandoori)..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-[#091a26] border border-[#142e40] text-[#dfedf9] placeholder-[#5f7384] text-sm focus:outline-none focus:border-[#72ddfd] transition-colors shadow-inner"
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
        </section>

        {/* SEARCH RESULTS VIEW (When search active) */}
        {searchQuery.trim() ? (
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-[#142e40]">
              <h2 className="text-xl font-bold text-white">
                Search Results ({searchResults.length})
              </h2>
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-[#72ddfd] hover:underline"
              >
                Clear Search
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-16 text-center rounded-2xl bg-[#06151e] border border-[#102434] p-8">
                <span className="text-4xl block mb-3">🔍</span>
                <h3 className="text-lg font-semibold text-white mb-2">
                  No recipes found matching &quot;{searchQuery}&quot;
                </h3>
                <p className="text-sm text-[#9fadb8] mb-4">
                  Try searching for ingredients like &quot;nadroo&quot;, &quot;turnip&quot;, &quot;yogurt&quot;, or &quot;garlic&quot;.
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-4 py-2 rounded-xl bg-[#102434] text-[#72ddfd] hover:bg-[#153448] text-xs font-semibold transition-colors"
                >
                  Show All Recipes
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                {searchResults.map((recipe) => (
                  <RecipeCard key={recipe.slug} recipe={recipe} />
                ))}
              </div>
            )}
          </section>
        ) : selectedCategory !== "All" ? (
          /* SINGLE CATEGORY VIEW (When user clicks a specific category) */
          <section className="mb-16">
            {(() => {
              const catMeta = CATEGORIES.find(
                (c) => c.name === selectedCategory
              );
              const list = categorizedRecipes[selectedCategory] || [];
              return (
                <div>
                  {/* Category Header Banner */}
                  <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-[#06151f] border border-[#162e40] shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-3xl">{catMeta?.icon}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-[#72ddfd]">
                            {catMeta?.tagline}
                          </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
                          {catMeta?.title}
                        </h2>
                        <p className="text-sm text-[#9fadb8] max-w-3xl leading-relaxed">
                          {catMeta?.subtitle}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedCategory("All")}
                        className="self-start md:self-auto px-4 py-2 rounded-xl bg-[#102434] hover:bg-[#16364c] text-xs font-semibold text-[#72ddfd] border border-[#1b384c] transition-colors"
                      >
                        ← View All Categories
                      </button>
                    </div>
                  </div>

                  {/* Category Dishes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                    {list.map((recipe) => (
                      <RecipeCard key={recipe.slug} recipe={recipe} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        ) : (
          /* ORGANIZED CATEGORY-BY-CATEGORY STRUCTURE (When "All" is active) */
          <div className="space-y-16">
            {CATEGORIES.map((cat) => {
              const list = categorizedRecipes[cat.name] || [];
              return (
                <section
                  key={cat.id}
                  id={cat.id}
                  className="scroll-mt-28 pb-8 border-b border-[#102434] last:border-b-0"
                >
                  {/* Section Title & Subtitle Header */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-2xl">{cat.icon}</span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#72ddfd]">
                          {cat.badge}
                        </span>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {cat.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-[#9fadb8] max-w-2xl mt-1 leading-relaxed">
                        {cat.subtitle}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedCategory(cat.name)}
                      className="text-xs font-bold text-[#72ddfd] hover:text-white transition-colors self-start md:self-auto flex items-center gap-1"
                    >
                      <span>Focus on {cat.name} ({list.length})</span>
                      <span>→</span>
                    </button>
                  </div>

                  {/* 10 Recipes Grid for this Specific Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                    {list.map((recipe) => (
                      <RecipeCard key={recipe.slug} recipe={recipe} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Bottom Trust & Quality Section */}
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
  const [imgSrc, setImgSrc] = useState(`/images/recipes/${recipe.slug}.webp`);

  return (
    <article className="group flex flex-col rounded-2xl bg-[#06151f] border border-[#142e40] hover:border-[#72ddfd]/50 transition-all duration-300 overflow-hidden shadow-lg hover:shadow-cyan-950/20">
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
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#031018]/85 backdrop-blur-md text-[#72ddfd] border border-[#72ddfd]/30">
            {recipe.category}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#102434]/85 backdrop-blur-md text-[#dfedf9]">
            {recipe.cookingMethod}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {recipe.kashmiriName && (
            <span className="text-[11px] font-semibold text-[#72ddfd]/90 tracking-wider block mb-1">
              {recipe.kashmiriName}
            </span>
          )}

          <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#72ddfd] transition-colors leading-snug mb-2">
            <Link href={`/recipes/${recipe.slug}`}>{recipe.title}</Link>
          </h3>

          <p className="text-xs text-[#9fadb8] line-clamp-2 leading-relaxed mb-4">
            {recipe.subtitle}
          </p>
        </div>

        <div>
          {/* Quick Stats Meta */}
          <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-[#091a26] border border-[#11293a] text-center text-[11px] mb-4">
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
              className="flex-1 py-2.5 rounded-xl bg-[#102434] hover:bg-[#72ddfd] hover:text-[#031018] text-[#72ddfd] text-xs font-semibold transition-all text-center"
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
              className="p-2.5 rounded-xl bg-[#1f382a] hover:bg-[#25D366] text-green-400 hover:text-[#031018] text-xs transition-colors flex items-center justify-center"
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
