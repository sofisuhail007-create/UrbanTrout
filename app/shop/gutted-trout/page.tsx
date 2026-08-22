import type { Metadata } from "next";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Premium Gutted Rainbow Trout",
  description:
    "Expertly cleaned, gutted, and prepared for immediate cooking. Farmed locally in Srinagar and delivered fresh.",
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

export default async function GuttedTroutPage() {
  const { data } = await supabase
    .from("inventory")
    .select("price_per_kg")
    .eq("product_id", "gutted-trout")
    .single();

  const price = data ? data.price_per_kg : 550;

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
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

            {/* Add to cart */}
            <div>
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
                productId="gutted-trout"
                productName="Premium Gutted Rainbow Trout"
                price={price}
                unit="Kg"
                image="/images/gutted_trout_premium.png"
                showDynamicPrice={true}
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
