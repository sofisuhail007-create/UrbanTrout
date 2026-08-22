import type { Metadata } from "next";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Whole Rainbow Trout (Non-Gutted)",
  description:
    "Untouched and pristine rainbow trout, straight from our crystal-clear waters. Ideal for roasting or traditional preparations.",
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

export default async function WholeTroutPage() {
  const { data } = await supabase
    .from("inventory")
    .select("price_per_kg")
    .eq("product_id", "whole-trout")
    .single();

  const price = data ? data.price_per_kg : 500;

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
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfyCpJNmCwVzBHTZw6kqPtCRfTVXNYWrm9Ixqy89okmBbaSGqKYMtEAZ5Jwv4MOwZIKpC3ugBZ1ISA5EfIUrq2lWmta28vvGV-ygjESie53QYIOJoDMgX9cJJWH5V960DeAviDBjjohZeT4WWrdrHC0tY2VnrZZsvftETpZ8ocCU2eupUdyTEoqKa8lgPe2dIHnERZTds7HMPfLKCtr56KHLPC08YZCzexEINcVe6nIrChDatBpMYRAOjGBVKCP2WsVyZicAZsG-kB"
                alt="Whole Rainbow Trout"
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(3,16,24,0.5) 0%, transparent 50%)" }}
              />
              {/* Badges */}
              <div className="absolute bottom-5 left-5 flex gap-2">
                {["Batch ID: UT-992-R", "PH Level: 7.2"].map((badge) => (
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
                "https://lh3.googleusercontent.com/aida-public/AB6AXuDcmSV_cdylrxXiBNmQvRZ2BKJU_a1m3slJm4NgMgtcEWXg9q5uRp1RQTVENbxTH6_4JyvosNNbD4MS8qln0r94oVYVIfIGXoLUQuVReHoKgzpK2eZw-6vgCXPIgSw-SsOEWJpiHfyDIHwTKBohp5Wf5nbM-dtELMicdCPC8RumjYPcZ_RlDRmJF98hNh8heNGAhPFTfe-Ooi25w6vbLqP0QUDYDpb-JFzjYDEa1X6ddVaLOzks2DJVQC9TD6rnA-IHsmuUKeddbEFv",
                "https://lh3.googleusercontent.com/aida-public/AB6AXuBd5lVg_5xsB-_LMZKBeqMjyh-HiynvebbPjJD3o8AFUP6e_Io5X0rmsANLLhRHuJenYk_Cqk24nCNcSKeShZznuuSU4TusiYgVzCmot0FYnfFCu1WRLmzYGJ2-l_FYAjyDN3Gv3uHFqASLo2kRbyz7HxXNeYkjRr-H1o_dCjkUrrRB9ft2FNV7R4vRERHj6Byf34nfSE3Hd70PrUSxdTpyKe5Gr3UnPNkyBpeKucjhd4vHq85_kiEtPXMctqAgbI0PpSFIbBVYwctQ",
                "https://lh3.googleusercontent.com/aida-public/AB6AXuAT1vwPaZSfiYdMfFy9DFvN52q73RQFbYqLJdKsJjuGpXS18wB_fPvgu4683RIdUxq7MhHJFBD_e84istQKcaiNHWsc8ScXGGjt6SyRUfuwY91LLAb8ECRF2NdT_eO3ud1xAYNQHcz0lwIjhd8TB_QG4_6I-USJXcwxMavIRVNkj01zhUJyitqT9vhLsFW-jdPdP1OyG66wISKFWdaOjuDSUusbUWR1ODFXUE71CoxbuFKxDL-ScGfqWFSk0vF_lvTm8t3bsdHcULCH",
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
                    alt={`Whole Trout detail ${i + 1}`}
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
                  Freshwater Specimen
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
                Whole Rainbow<br />Trout (Non-Gutted)
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
                Untouched and pristine, straight from our crystal-clear waters. Ideal for
                roasting or traditional preparations. This non-gutted specimen retains full
                physiological integrity for maximum flavor preservation, dispatched within
                4 hours of harvest.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
                {[
                  { icon: "🔬", label: "Lab Verified" },
                  { icon: "🌿", label: "Zero Antibiotics" },
                  { icon: "🐟", label: "Whole Specimen" },
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
                productId="whole-trout"
                productName="Whole Rainbow Trout (Non-Gutted)"
                price={price}
                unit="Kg"
                image="https://lh3.googleusercontent.com/aida-public/AB6AXuCfyCpJNmCwVzBHTZw6kqPtCRfTVXNYWrm9Ixqy89okmBbaSGqKYMtEAZ5Jwv4MOwZIKpC3ugBZ1ISA5EfIUrq2lWmta28vvGV-ygjESie53QYIOJoDMgX9cJJWH5V960DeAviDBjjohZeT4WWrdrHC0tY2VnrZZsvftETpZ8ocCU2eupUdyTEoqKa8lgPe2dIHnERZTds7HMPfLKCtr56KHLPC08YZCzexEINcVe6nIrChDatBpMYRAOjGBVKCP2WsVyZicAZsG-kB"
                showDynamicPrice={true}
              />
            </div>

            {/* Quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "Protein / 100g", value: "20.5g" },
                { label: "Omega-3", value: "1,200mg" },
                { label: "Heavy Metals", value: "ND" },
                { label: "Harvest to Door", value: "< 4h" },
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
                  <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.primary, margin: "0 0 4px" }}>
                    {stat.label}
                  </p>
                  <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.4rem", fontWeight: 700, color: C.onSurface, margin: 0, letterSpacing: "-0.02em" }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Culinary & Nutritional Section */}
        <section style={{ marginTop: "5rem" }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Culinary Notes */}
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
                Culinary Lab Notes
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
                Precision Roasting
              </h2>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: C.onSurfVar, lineHeight: 1.75, marginBottom: "1.5rem" }}>
                Because this trout is non-gutted, the interior temperature remains more stable during roasting. We recommend a high-heat quick sear followed by a 12-minute convection roast at 200°C.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  "Preserves natural omega oils within the tissue",
                  "Maintains skeletal structure for presentation",
                  "Deeper, richer flavor profile compared to fillets",
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
                Nutritional Excellence
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
                Clinical Dietetics
              </h2>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: C.onSurfVar, lineHeight: 1.75, marginBottom: "1.5rem" }}>
                Raised in pristine RAS environments, free from microplastics, heavy metals, and antibiotics.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", position: "relative", zIndex: 1 }}>
                {[
                  { label: "Protein (Per 100g)", value: "20.5g" },
                  { label: "Omega-3 (EPA/DHA)", value: "1,200mg" },
                  { label: "Heavy Metals", value: "ND" },
                  { label: "Microplastics", value: "0.0%" },
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
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem", fontWeight: 700, color: C.onSurface, margin: 0, letterSpacing: "-0.02em" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RAS Systems Section */}
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
                  RAS Purity Standards
                </h3>
              </div>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "1rem", color: C.onSurfVar, lineHeight: 1.75, maxWidth: "640px", marginBottom: "2rem" }}>
                Every drop of water is filtered through 12 stages of mechanical and biological processing. Ozone-sanitized environments that exceed international organic standards.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "1.5rem" }}>
                {[
                  { label: "Nitrate", val: "< 5ppm" },
                  { label: "Oxygen", val: "99.8%" },
                  { label: "UV Index", val: "High" },
                  { label: "Pesticides", val: "0.0%" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.primary, margin: "0 0 6px" }}>{stat.label}</p>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 700, color: C.onSurface, margin: 0, letterSpacing: "-0.03em" }}>{stat.val}</p>
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
