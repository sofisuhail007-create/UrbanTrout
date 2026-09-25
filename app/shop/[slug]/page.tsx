
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddToCartButton from "@/components/AddToCartButton";
import StoreClosedBanner from "@/components/StoreClosedBanner";
import { supabase } from "@/lib/supabase";
import { products } from "@/lib/data";
import { getBusinessHoursInfo } from "@/lib/businessHours";

// Enable ISR (Incremental Static Regeneration) - cached at Edge CDN and refreshed every 60s
export const revalidate = 60;

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

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await supabase
    .from("inventory")
    .select("product_name, price_per_kg")
    .eq("product_id", slug)
    .single();

  const title = data?.product_name || (slug === "gutted-trout" ? "Cleaned & Gutted Rainbow Trout" : "Whole Fresh Rainbow Trout");
  const price = data?.price_per_kg ? `₹${data.price_per_kg}/Kg` : (slug === "gutted-trout" ? "₹580/Kg" : "₹540/Kg");
  const desc = `Order fresh ${title} (${price}) harvested live to order in Malabagh, Srinagar. 100% Free chilled doorstep delivery within 2 hours within our 5km farm zone.`;
  const canonicalUrl = `https://urbantrout.in/shop/${slug}`;

  return {
    title: `${title} (${price}) - Fresh Srinagar Farm Harvest`,
    description: desc,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${title} (${price}) | Urban Trout Srinagar`,
      description: desc,
      url: canonicalUrl,
      siteName: "Urban Trout",
      images: [
        {
          url: slug === "gutted-trout" ? "https://urbantrout.in/images/gutted_trout_premium.webp" : "https://urbantrout.in/images/whole_trout.jpg",
          width: 1200,
          height: 630,
          alt: `${title} - Urban Trout Srinagar`,
        },
      ],
      locale: "en_IN",
      type: "website",
    },
  };
}

export default async function DynamicProductPage({ params }: Props) {
  const { slug } = await params;

  // 1. Fetch inventory record
  const { data: invItem } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", slug)
    .single();

  // 2. Fetch metadata from app_settings
  const { data: metaRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "product_meta_" + slug)
    .single();

  let savedMeta: Record<string, any> = {};
  if (metaRow?.value) {
    try {
      savedMeta = JSON.parse(metaRow.value);
    } catch (e) {}
  }

  // Fallback to static data if not found in DB
  const staticFallback = products.find((p) => p.id === slug);

  if (!invItem && !staticFallback) {
    notFound();
  }

  const name = invItem?.product_name || staticFallback?.name || "Fresh Rainbow Trout";
  const price = invItem ? Number(invItem.price_per_kg) : (staticFallback?.price || 500);
  const minQuantity = invItem?.min_order_kg
    ? Number(invItem.min_order_kg)
    : savedMeta.min_order_kg
    ? Number(savedMeta.min_order_kg)
    : (staticFallback?.minQuantity || 1);
  const originalPrice = invItem?.original_price_per_kg
    ? Number(invItem.original_price_per_kg)
    : savedMeta.original_price_per_kg
    ? Number(savedMeta.original_price_per_kg)
    : (staticFallback?.originalPrice || Math.round(price * 1.2));

  const image = savedMeta.image_url || (invItem as any)?.image_url || staticFallback?.img || "/images/gutted_trout_premium.png";
  const label = savedMeta.label || (invItem as any)?.label || staticFallback?.label || "FRESH HARVEST";
  const description =
    savedMeta.description ||
    (invItem as any)?.description ||
    staticFallback?.desc ||
    "Sustainably farmed in the cold waters of Srinagar. Harvested live to order and delivered chilled in ice for peak freshness and flavor.";

  const hasDiscount = originalPrice > price;
  const discountPercent = hasDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: name,
    alternateName: "Oncorhynchus mykiss",
    description: description,
    image: image.startsWith("http") ? image : `https://urbantrout.in${image}`,
    sku: slug === "whole-trout" ? "UT-WHOLE-TROUT" : slug === "gutted-trout" ? "UT-GUTTED-TROUT" : slug,
    mpn: slug === "whole-trout" ? "UT-WHOLE-TROUT" : slug === "gutted-trout" ? "UT-GUTTED-TROUT" : slug,
    brand: {
      "@type": "Brand",
      name: "Urban Trout",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: slug === "whole-trout" ? "34" : "42",
      bestRating: "5",
      worstRating: "1",
    },
    review: [
      {
        "@type": "Review",
        author: {
          "@type": "Person",
          name: slug === "whole-trout" ? "Tariq A." : "Bilal M.",
        },
        datePublished: slug === "whole-trout" ? "2026-06-15" : "2026-07-10",
        reviewBody:
          slug === "whole-trout"
            ? "Exceptionally fresh trout harvested directly to order in Srinagar. Perfect texture and delicate clean taste."
            : "100% pan-ready and completely fresh. Scaled and gutted thoroughly, delivered chilled in ice within Srinagar.",
        reviewRating: {
          "@type": "Rating",
          ratingValue: "5",
          bestRating: "5",
        },
      },
    ],
    offers: {
      "@type": "Offer",
      price: price,
      priceCurrency: "INR",
      validFrom: "2025-01-01",
      priceValidUntil: "2027-12-31",
      itemCondition: "https://schema.org/NewCondition",
      availability: "https://schema.org/InStock",
      url: `https://urbantrout.in/shop/${slug}`,
      seller: {
        "@type": "Organization",
        name: "Urban Trout",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          value: "0",
          currency: "INR",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "IN",
          addressRegion: "Jammu and Kashmir",
          addressLocality: "Srinagar",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 0,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 1,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
        merchantReturnDays: 0,
      },
    },
  };

  // ── Business Hours & Store Overrides Check ──────────────────────────
  const { data: settingsRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["store_manually_closed", "farm_maintenance_active", "allow_friday_orders", "force_store_open"]);

  const overrides: Record<string, boolean> = {};
  settingsRows?.forEach((r) => {
    overrides[r.key] = r.value === "true";
  });

  const effectiveHoursInfo = getBusinessHoursInfo(new Date(), {
    storeManuallyClosed: overrides.store_manually_closed,
    farmMaintenanceActive: overrides.farm_maintenance_active,
    allowFridayOrders: overrides.allow_friday_orders,
    forceStoreOpen: overrides.force_store_open,
  });

  const { data: phoneRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "primary_phone")
    .single();
  const primaryPhone = phoneRow?.value ?? "+918491006127";

  if (!effectiveHoursInfo.isOpen) {
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
        <StoreClosedBanner
          nextOpenISO={effectiveHoursInfo.nextOpenISO}
          nextOpenLabel={effectiveHoursInfo.nextOpenLabel}
          primaryPhone={primaryPhone}
          isFridayMaintenance={effectiveHoursInfo.isFridayMaintenance}
          closedReason={effectiveHoursInfo.closedReason}
        />
      </>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "7rem 1.5rem 5rem" }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: "2.5rem" }}>
          <Link
            href="/shop"
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
          {/* Image */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div
              className="relative overflow-hidden rounded-2xl group"
              style={{
                aspectRatio: "4/3",
                background: C.bgHigh,
                border: "1px solid rgba(61,74,83,0.5)",
              }}
            >
              <img
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                src={image}
                alt={name}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(3,16,24,0.5) 0%, transparent 50%)" }}
              />

              {/* Badges */}
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center gap-2 pointer-events-none z-20">
                <span
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
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </span>
                {hasDiscount && (
                  <span
                    style={{
                      padding: "4px 12px",
                      background: "rgba(34,197,94,0.22)",
                      backdropFilter: "blur(12px)",
                      borderRadius: "6px",
                      border: "1px solid rgba(74,222,128,0.5)",
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: "10px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "#4ade80",
                      whiteSpace: "nowrap",
                      boxShadow: "0 0 10px rgba(74, 222, 128, 0.2)",
                    }}
                  >
                    {discountPercent}% OFF
                  </span>
                )}
                <span
                  style={{
                    padding: "4px 12px",
                    background: "rgba(16,185,129,0.25)",
                    backdropFilter: "blur(12px)",
                    borderRadius: "6px",
                    border: "1px solid rgba(16,185,129,0.45)",
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#34d399",
                    whiteSpace: "nowrap",
                  }}
                >
                  🛵 FREE DELIVERY
                </span>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="lg:col-span-5 flex flex-col gap-7">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "0.75rem" }}>
                <div style={{ width: "24px", height: "1px", background: "rgba(114,221,253,0.5)" }} />
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
                {name}
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
                {description}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
                {[
                  { icon: "🌿", label: "Zero Antibiotics" },
                  { icon: "💧", label: "Himalayan Spring" },
                  { icon: "🧊", label: "Ice-Chilled" },
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

            {/* Add to cart */}
            <div>
              {/* Free Delivery Callout Banner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 14px",
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.35)",
                  borderRadius: "12px",
                  marginBottom: "1.25rem",
                }}
              >
                <span style={{ fontSize: "18px" }}>🛵</span>
                <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.82rem", color: "#a7f3d0", margin: 0, fontWeight: 600 }}>
                  <strong style={{ color: "#34d399" }}>100% Free Doorstep Delivery</strong> within 5km of our farm. Harvested live to order &amp; delivered ice-chilled within 2 hours.
                </p>
              </div>

              <p
                style={{
                  fontFamily: '"Inter", sans-serif',
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: C.outline,
                  marginBottom: "1rem",
                }}
              >
                Select Quantity (Kg)
              </p>
              <AddToCartButton
                productId={slug}
                productName={name}
                price={price}
                originalPrice={originalPrice}
                unit="Kg"
                image={image}
                showDynamicPrice={true}
                minQuantity={minQuantity}
              />
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
                { label: "Origin", value: "Srinagar" },
                { label: "Harvest", value: "To Order" },
                { label: "Antibiotics", value: "Zero" },
                { label: "Delivery", value: "FREE • 2 Hours" },
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
                      fontSize: "1.3rem",
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
      </div>
    </div>
  );
}
