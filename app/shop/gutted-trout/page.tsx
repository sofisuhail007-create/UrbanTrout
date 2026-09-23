import type { Metadata } from "next";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import StoreClosedBanner from "@/components/StoreClosedBanner";
import { supabase } from "@/lib/supabase";
import { getBusinessHoursInfo } from "@/lib/businessHours";
import { getLiveAquariumStock } from "@/lib/aquariumStock";

export const metadata: Metadata = {
  title: "Premium Cleaned & Gutted Rainbow Trout (₹580/Kg) | Urban Trout Srinagar",
  description:
    "Expertly cleaned, scaled, gutted, and prepared for immediate cooking. Farmed in Malabagh, Srinagar. 100% Free delivery within 2 hours across Srinagar.",
  alternates: {
    canonical: "https://urbantrout.in/shop/gutted-trout",
  },
  openGraph: {
    title: "Cleaned & Gutted Fresh Rainbow Trout | Urban Trout Srinagar",
    description: "Pan-ready, 100% fresh cleaned Rainbow Trout farmed in Srinagar. Delivered within 2 hours in ice.",
    url: "https://urbantrout.in/shop/gutted-trout",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/images/gutted_trout_premium.webp",
        width: 800,
        height: 600,
        alt: "Cleaned and Gutted Fresh Rainbow Trout Srinagar",
      },
    ],
  },
};

const C = {
  bg: "#031018",
  bgHigh: "#10212c",
  primary: "#72ddfd",
  primaryCont: "#3aadcc",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
  outline: "#6a7782",
  outlineVar: "#3d4a53",
};

export const revalidate = 30;

export default async function GuttedTroutPage() {
  // ── Business Hours ──────────────────────────────────────────────────────
  const hoursInfo = getBusinessHoursInfo();

  // ── Manual closure override ─────────────────────────────────────────────
  const { data: closedRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "store_manually_closed")
    .single();
  const isManuallyClosedFlag = closedRow?.value === "true";
  const effectivelyOpen = hoursInfo.isOpen && !isManuallyClosedFlag;
  const effectiveHoursInfo = { ...hoursInfo, isOpen: effectivelyOpen };

  const { data } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", "gutted-trout")
    .single();

  const price = data ? data.price_per_kg : 580;
  const minQuantity = data?.min_order_kg ? Number(data.min_order_kg) : 2;
  const originalPrice = data?.original_price_per_kg ? Number(data.original_price_per_kg) : 650;

  // ── Aquarium Stock (shared pool) ────────────────────────────────────────
  let aquariumStockKg: number | undefined;
  try {
    const liveStock = await getLiveAquariumStock();
    aquariumStockKg = liveStock.remainingKg;
  } catch {
    aquariumStockKg = undefined;
  }

  // ── Fetch primary phone for closed banner ───────────────────────────────
  const { data: phoneRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "primary_phone")
    .single();
  const primaryPhone = phoneRow?.value ?? "+918491006127";

  const isOutOfStock = aquariumStockKg !== undefined && (aquariumStockKg <= 0 || aquariumStockKg < minQuantity);
  const canOrder = effectiveHoursInfo.isOpen && !isOutOfStock;


  const productJsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Premium Gutted Rainbow Trout",
    "image": ["https://urbantrout.in/images/gutted_trout_premium.png"],
    "description": "Expertly cleaned, gutted, and prepared for immediate cooking. Farmed locally in Srinagar and delivered fresh.",
    "sku": "UT-GUTTED-TROUT",
    "brand": {
      "@type": "Brand",
      "name": "Urban Trout"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "42",
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": [
      {
        "@type": "Review",
        "author": {
          "@type": "Person",
          "name": "Bilal M."
        },
        "datePublished": "2026-07-10",
        "reviewBody": "100% pan-ready and completely fresh. Scaled and gutted thoroughly, delivered chilled in ice within Srinagar.",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": "5"
        }
      }
    ],
    "offers": {
      "@type": "Offer",
      "url": "https://urbantrout.in/shop/gutted-trout",
      "priceCurrency": "INR",
      "price": price,
      "validFrom": "2025-01-01",
      "priceValidUntil": "2027-12-31",
      "availability": "https://schema.org/InStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "Urban Trout"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "INR"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "IN",
          "addressRegion": "Jammu and Kashmir",
          "addressLocality": "Srinagar"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 0,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY"
          }
        }
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "IN",
        "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
        "merchantReturnDays": 0
      }
    }
  };

  // ── Render closed banner if outside hours ─────────────────────────────
  if (!effectiveHoursInfo.isOpen) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
        <StoreClosedBanner
          nextOpenISO={effectiveHoursInfo.nextOpenISO}
          nextOpenLabel={isManuallyClosedFlag ? "when we reopen" : effectiveHoursInfo.nextOpenLabel}
          primaryPhone={primaryPhone}
        />
      </>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "7rem 1.5rem 5rem" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: "2.5rem" }}>
          <Link
            href="/shop"
            className="back-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: '"Inter", sans-serif',
              fontSize: "0.8rem",
              letterSpacing: "0.05em",
              color: C.onSurfVar,
              textDecoration: "none",
              textTransform: "uppercase",
              transition: "color 0.2s",
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Shop
          </Link>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* Image Gallery */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Main Image */}
            <div
              className="relative overflow-hidden rounded-2xl group"
              style={{
                aspectRatio: "4/3",
                background: C.bgHigh,
                border: `1px solid rgba(61,74,83,0.5)`,
              }}
            >
              <img
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                src="/images/gutted_trout_premium.png"
                alt="Premium Gutted Rainbow Trout"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(3,16,24,0.5) 0%, transparent 50%)" }}
              />
              {/* Badges */}
              <div className="absolute bottom-5 left-5 flex gap-2">
                {["Cleaned & Gutted", "Farm Fresh"].map((badge) => (
                  <span
                    key={badge}
                    style={{
                      padding: "4px 12px",
                      background: "rgba(16,33,44,0.85)",
                      backdropFilter: "blur(12px)",
                      borderRadius: "6px",
                      border: "1px solid rgba(114,221,253,0.2)",
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "10px",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: C.primary,
                    }}
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Thumbnails */}
            <div className="grid grid-cols-3 gap-3">
              {[
                "/images/gutted_trout_detail_1_1779973776067.png",
                "/images/gutted_trout_detail_2_1779973796564.png",
                "/images/gutted_trout_detail_3_1779973815991.png",
              ].map((src, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl"
                  style={{
                    aspectRatio: "1/1",
                    background: C.bgHigh,
                    border: "1px solid rgba(61,74,83,0.4)",
                    cursor: "pointer",
                  }}
                >
                  <img
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    src={src}
                    alt={`Gutted Trout detail ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:col-span-5 flex flex-col gap-7">
            {/* Category + Title */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.75rem" }}>
                <div style={{ width: "24px", height: "1px", background: `rgba(114,221,253,0.5)` }} />
                <span
                  style={{
                    fontFamily: '"Inter", sans-serif',
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: C.primary,
                  }}
                >
                  Fresh From Our Farm
                </span>
              </div>
              <h1
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "clamp(2rem, 4vw, 2.75rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.05,
                  color: C.onSurface,
                  margin: 0,
                }}
              >
                Premium Gutted<br />Rainbow Trout
              </h1>
            </div>

            {/* Description card */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                background: "rgba(16,33,44,0.7)",
                borderRadius: "14px",
                border: "1px solid rgba(61,74,83,0.5)",
              }}
            >
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", color: C.onSurfVar, lineHeight: 1.75, margin: 0 }}>
                Expertly scaled, cleaned, and gutted so it is pan-ready the moment it arrives.
                Harvested from our fresh water tanks and packed in ice to retain peak firmness
                and delicate, mild flavor.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
                {[
                  { icon: "🌿", label: "Zero Antibiotics" },
                  { icon: "🍳", label: "Pan-Ready" },
                  { icon: "💧", label: "Pure Spring Water" },
                ].map((tag) => (
                  <div key={tag.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "14px" }}>{tag.icon}</span>
                    <span
                      style={{
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "11px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: C.onSurfVar,
                      }}
                    >
                      {tag.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(61,74,83,0.4)" }} />

            {/* Add to cart — or store closed / out of stock state */}
            <div>
              {canOrder ? (
                <>
                  <p
                    style={{
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "10px",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: C.outline,
                      marginBottom: "0.75rem",
                    }}
                  >
                    Select Quantity (KG)
                  </p>
                  <AddToCartButton
                    productId="gutted-trout"
                    productName="Premium Gutted Rainbow Trout"
                    price={price}
                    originalPrice={originalPrice}
                    unit="Kg"
                    image="/images/gutted_trout_premium.png"
                    showDynamicPrice={true}
                    minQuantity={minQuantity}
                    maxQuantity={aquariumStockKg !== undefined ? Math.floor(aquariumStockKg) : 99}
                  />
                </>
              ) : !hoursInfo.isOpen ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "1rem 1.25rem",
                    background: "rgba(3,16,24,0.8)",
                    border: "1px solid rgba(61,74,83,0.5)",
                    borderRadius: "14px",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9fadb8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <div>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.9rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>
                      Store Closed
                    </p>
                    <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfVar, margin: 0 }}>
                      Opens {isManuallyClosedFlag ? "when we reopen" : effectiveHoursInfo.nextOpenLabel} · 7:00 AM – 10:00 PM daily
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "1rem 1.25rem",
                    background: "rgba(239,68,68,0.07)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: "14px",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.9rem", fontWeight: 700, color: "#f87171", margin: 0 }}>
                      Out of Stock for Today
                    </p>
                    <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfVar, margin: 0 }}>
                      All available live aquarium stock has been sold out for today. Fresh harvest opens again tomorrow at 7:00 AM!
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              {[
                { label: "Protein / 100g", value: "20.5g" },
                { label: "Omega-3", value: "Rich" },
                { label: "Antibiotics", value: "Zero" },
                { label: "Harvest", value: "To Order" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    padding: "14px 16px",
                    background: "rgba(16,33,44,0.6)",
                    borderRadius: "12px",
                    border: "1px solid rgba(61,74,83,0.4)",
                  }}
                >
                  <p
                    style={{
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "9px",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: C.primary,
                      margin: "0 0 4px",
                    }}
                  >
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: "1.4rem",
                      fontWeight: 700,
                      color: C.onSurface,
                      margin: 0,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cooking & Nutritional Section */}
        <section style={{ marginTop: "5rem" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cooking Notes */}
            <div
              style={{
                padding: "2.5rem",
                borderRadius: "20px",
                background: "rgba(16,33,44,0.6)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(61,74,83,0.4)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: "100px",
                  background: "rgba(114,221,253,0.12)",
                  border: "1px solid rgba(114,221,253,0.25)",
                  fontFamily: '"Inter", sans-serif',
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.primary,
                  marginBottom: "1.25rem",
                }}
              >
                Cooking Tips
              </span>
              <h2
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "1.75rem",
                  fontWeight: 800,
                  color: C.onSurface,
                  marginBottom: "0.75rem",
                  letterSpacing: "-0.03em",
                }}
              >
                Pan-Seared or Grilled
              </h2>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: C.onSurfVar, lineHeight: 1.75, marginBottom: "1.5rem" }}>
                Because it is already gutted and cleaned, this fish cooks evenly and quickly. Season simply with salt, pepper, garlic, and fresh lemon butter.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  "Delicate, tender flesh that flakes cleanly",
                  "Crispy skin when pan-seared on medium-high heat for 4-5 mins each side",
                  "Naturally sweet and mild taste with no muddy odor",
                ].map((item) => (
                  <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: C.onSurface }}>
                    <span style={{ color: C.primaryCont, marginTop: "2px", flexShrink: 0 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Nutritional */}
            <div
              style={{
                padding: "2.5rem",
                borderRadius: "20px",
                background: "rgba(16,33,44,0.8)",
                border: "1px solid rgba(61,74,83,0.4)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", right: "-60px", bottom: "-60px", width: "280px", height: "280px", background: "rgba(114,221,253,0.05)", borderRadius: "50%", filter: "blur(60px)", pointerEvents: "none" }} />
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 14px",
                  borderRadius: "100px",
                  background: "rgba(61,74,83,0.5)",
                  border: "1px solid rgba(61,74,83,0.7)",
                  fontFamily: '"Inter", sans-serif',
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.onSurfVar,
                  marginBottom: "1.25rem",
                }}
              >
                Health & Nutrition
              </span>
              <h2
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "1.75rem",
                  fontWeight: 800,
                  color: C.onSurface,
                  marginBottom: "0.75rem",
                  letterSpacing: "-0.03em",
                }}
              >
                Naturally Healthy
              </h2>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: C.onSurfVar, lineHeight: 1.75, marginBottom: "1.5rem" }}>
                Grown in cold, clean water with quality feed. A lean, protein-dense superfood for your family.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", position: "relative", zIndex: 1 }}>
                {[
                  { label: "Protein (Per 100g)", value: "20.5g" },
                  { label: "Omega-3 (EPA/DHA)", value: "High" },
                  { label: "Chemicals", value: "Zero" },
                  { label: "Calories / 100g", value: "~135 kcal" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      background: "rgba(3,16,24,0.6)",
                      border: "1px solid rgba(61,74,83,0.4)",
                    }}
                  >
                    <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: C.primary, margin: "0 0 6px" }}>{s.label}</p>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.35rem", fontWeight: 700, color: C.onSurface, margin: 0, letterSpacing: "-0.02em" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Farm Freshness Promise */}
        <section style={{ marginTop: "4rem" }}>
          <div
            style={{
              padding: "3rem",
              borderRadius: "20px",
              background: "rgba(16,33,44,0.6)",
              border: "1px solid rgba(61,74,83,0.4)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", right: "-80px", bottom: "-80px", width: "360px", height: "360px", background: "rgba(114,221,253,0.04)", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "1.25rem" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(114,221,253,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "20px" }}>💧</span>
                </div>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem", fontWeight: 800, color: C.onSurface, margin: 0, letterSpacing: "-0.03em" }}>
                  Our Farm Freshness Promise
                </h3>
              </div>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "1rem", color: C.onSurfVar, lineHeight: 1.75, maxWidth: "640px", marginBottom: "2rem" }}>
                Raised in clean, continuously filtered cold water right here in Srinagar. Harvested only when you order, immediately chilled in ice, and delivered to your doorstep.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1.5rem" }}>
                {[
                  { label: "Water Source", val: "Deep Borewell" },
                  { label: "Harvest", val: "To Order" },
                  { label: "Antibiotics", val: "Zero" },
                  { label: "Delivery", val: "Same Day" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.primary, margin: "0 0 6px" }}>{stat.label}</p>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.35rem", fontWeight: 700, color: C.onSurface, margin: 0, letterSpacing: "-0.03em" }}>{stat.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
