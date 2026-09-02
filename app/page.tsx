import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { products } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Fresh Rainbow Trout in Srinagar | Buy Online | Urban Trout",
  description:
    "Buy fresh Rainbow Trout online in Srinagar. Farmed in Naseem Bagh in clean mountain water. Harvested to order with same-day home delivery across Srinagar.",
  alternates: {
    canonical: "https://urbantrout.in",
  },
};

const C = {
  bg: "#031018",
  bgLow: "#06151e",
  bgHigh: "#10212c",
  bgHighest: "#152834",
  primary: "#72ddfd",
  primaryContainer: "#3aadcc",
  onPrimaryContainer: "#002730",
  onSurface: "#dfedf9",
  onSurfaceVariant: "#9fadb8",
  outline: "#6a7782",
  outlineVariant: "#3d4a53",
};

const farmConditions = [
  { label: "Water Temperature", value: "12°C", sub: "Cold Alpine Range", icon: "thermostat" },
  { label: "Water Source", value: "Borewell", sub: "Clean & Filtered", icon: "water_drop" },
  { label: "Oxygen Saturation", value: "98%+", sub: "Fast Swimming Currents", icon: "air" },
  { label: "Harvest Policy", value: "To Order", sub: "Never Stored Frozen", icon: "timer" },
];

const faqs = [
  {
    q: "Where can I buy fresh trout fish in Srinagar?",
    a: "You can order fresh trout online directly through urbantrout.in for same-day delivery within a 5km radius from our farm, or pick it up fresh from our farm counter at Malabagh, Naseem Bagh (near R P School Girls Wing).",
  },
  {
    q: "What is the price of Rainbow Trout per Kg in Srinagar?",
    a: "Our fresh Whole Rainbow Trout is ₹500 per Kg, and our Premium Cleaned & Gutted Trout is ₹550 per Kg. We deliver fresh within a 5km radius from our farm.",
  },
  {
    q: "Do you clean and gut the trout before delivery?",
    a: "Yes! You can choose our Premium Gutted Trout, which is expertly scaled, cleaned, and gutted so it is 100% pan-ready the moment it arrives at your home.",
  },
  {
    q: "Which areas do you deliver to?",
    a: "We only deliver within a 5km radius from our farm in Malabagh, Srinagar. You can also pick up fresh catch directly at our farm counter in Malabagh (near R P School Girls Wing).",
  },
  {
    q: "How fresh is Urban Trout compared to market fish?",
    a: "Unlike market fish that sits on ice for days, our trout is swimming in our fresh water tanks until you place your order. It is harvested to order, packed in ice, and delivered to your doorstep within hours.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(item => ({
    "@type": "Question",
    "name": item.q,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.a
    }
  }))
};

export default async function HomePage() {
  const { data: dbProducts } = await supabase.from("inventory").select("*");
  const updatedProducts = products.map((p) => {
    const dbItem = dbProducts?.find((item) => item.product_id === p.id);
    const price = dbItem?.price_per_kg || p.price;
    const minQuantity = dbItem?.min_order_kg ? Number(dbItem.min_order_kg) : (p.minQuantity || 2);
    const originalPrice = dbItem?.original_price_per_kg
      ? Number(dbItem.original_price_per_kg)
      : (p.originalPrice || (p.id === "gutted-trout" ? 650 : 600));
    return {
      ...p,
      price,
      minQuantity,
      originalPrice,
    };
  });

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-16">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes heroDrift {
            0% { transform: scale(1.05) translate(0px, 0px) rotate(0deg); }
            33% { transform: scale(1.08) translate(-15px, 10px) rotate(0.5deg); }
            66% { transform: scale(1.06) translate(10px, -15px) rotate(-0.5deg); }
            100% { transform: scale(1.05) translate(0px, 0px) rotate(0deg); }
          }
          .animate-hero-drift {
            animation: heroDrift 30s ease-in-out infinite;
          }
          @keyframes ambientBubbles {
            0% { transform: translateY(100vh) scale(0.5) translateX(0px); opacity: 0; }
            50% { opacity: 0.4; }
            100% { transform: translateY(-20vh) scale(1.5) translateX(20px); opacity: 0; }
          }
          .ambient-bubble {
            position: absolute;
            background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.6), rgba(114, 221, 253, 0.1) 60%, transparent 80%);
            border-radius: 50%;
            border: 1px solid rgba(114, 221, 253, 0.2);
            animation: ambientBubbles 12s linear infinite;
            z-index: 5;
            pointer-events: none;
          }
        `}} />

        {/* Background image */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBzsgreAxmSUuY16l46SuMrUrm-FYT8H80nikIPS7yYwGm9-I2pOkscmW2FVw1BmrRVkAJ8rbYHvkA0vfdbLwR9XHXTANxRa2kukMU82pX1_ShQ9pwdsRAwYpJHu8oYRZJ2av8Qz2BIlCedGAjS8VrTId2Xh-4qjp1CDQBxGXDlmGr2AqrMblwYX-dXBXtJvuTR86Q-jzZuSEWDcYdmc_hE9qSZhQMsSwQAhoJ_Pdw832jsUMNdWKIDNLJ0u43uSnVdGze5cTFtzFD2"
            alt="Fresh Rainbow Trout in Srinagar Kashmir"
            fill
            priority
            quality={75}
            sizes="100vw"
            className="animate-hero-drift object-cover"
            style={{ filter: "brightness(0.35) saturate(0.8)" }}
          />
        </div>
        
        {/* Ambient Bubbles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="ambient-bubble" style={{ left: '10%', width: '30px', height: '30px', animationDelay: '0s', animationDuration: '15s' }} />
          <div className="ambient-bubble" style={{ left: '85%', width: '45px', height: '45px', animationDelay: '2s', animationDuration: '18s' }} />
          <div className="ambient-bubble" style={{ left: '45%', width: '25px', height: '25px', animationDelay: '5s', animationDuration: '12s' }} />
          <div className="ambient-bubble" style={{ left: '70%', width: '50px', height: '50px', animationDelay: '8s', animationDuration: '20s' }} />
          <div className="ambient-bubble" style={{ left: '25%', width: '35px', height: '35px', animationDelay: '11s', animationDuration: '16s' }} />
          <div className="ambient-bubble" style={{ left: '60%', width: '20px', height: '20px', animationDelay: '14s', animationDuration: '14s' }} />
          <div className="ambient-bubble" style={{ left: '5%', width: '15px', height: '15px', animationDelay: '17s', animationDuration: '10s' }} />
          <div className="ambient-bubble" style={{ left: '95%', width: '60px', height: '60px', animationDelay: '20s', animationDuration: '25s' }} />
        </div>
        
        {/* Gradient overlays */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, #031018 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(3,16,24,0.7) 0%, transparent 40%, rgba(3,16,24,0.7) 100%)" }} />
        {/* Neon radial glow */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(114,221,253,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "0 1.5rem", maxWidth: "900px", margin: "0 auto" }}>
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "1rem" }}>
            Fresh Farm Catch • Srinagar, Kashmir
          </span>
          <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(3.25rem, 9vw, 6.5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9, color: "#dfedf9", marginBottom: "1.75rem" }}>
            Fresh. Local.<br />
            <span style={{ color: "#72ddfd", textShadow: "0 0 40px rgba(114,221,253,0.5), 0 0 80px rgba(114,221,253,0.2)" }}>
              Rainbow Trout.
            </span>
          </h1>

          <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "1.125rem", color: C.onSurfaceVariant, maxWidth: "580px", margin: "0 auto 2.5rem", lineHeight: 1.7 }}>
            Farmed right here in Malabagh, Srinagar. Harvested to order and delivered to your doorstep within hours.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
            <Link href="/shop" style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "14px 32px", borderRadius: "10px", background: "#3aadcc", color: "#002730", fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", textDecoration: "none", boxShadow: "0 0 30px rgba(58,173,204,0.4), 0 4px 20px rgba(0,0,0,0.3)", transition: "all 0.3s" }}>
              Order Fresh Trout
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }}>
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </Link>
            <Link href="/our-farm" style={{ display: "inline-flex", alignItems: "center", padding: "14px 32px", borderRadius: "10px", border: "1px solid rgba(114,221,253,0.2)", color: C.onSurface, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: "0.95rem", textDecoration: "none", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(8px)", transition: "all 0.3s" }}>
              About Our Farm
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{ position: "absolute", bottom: "2rem", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", opacity: 0.4 }}>
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase" }}>Scroll</span>
          <div style={{ width: "1px", height: "36px", background: "linear-gradient(to bottom, #72ddfd, transparent)" }} />
        </div>
      </section>

      {/* ── Why Choose Urban Trout ── */}
      <section style={{ padding: "6rem 1.5rem", background: C.bg, position: "relative", overflow: "hidden" }}>
        {/* Decorative glow */}
        <div style={{ position: "absolute", top: "50%", right: 0, transform: "translate(50%, -50%)", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(114,221,253,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "0.75rem" }}>Freshness Guaranteed</span>
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: C.onSurface, margin: 0 }}>
                Why Choose<br />
                <span style={{ color: "#63cfee" }}>Urban Trout?</span>
              </h2>
            </div>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, maxWidth: "360px", lineHeight: 1.7, borderLeft: `2px solid rgba(114,221,253,0.3)`, paddingLeft: "1.25rem", fontSize: "0.95rem" }}>
              Clean borewell water, zero antibiotics, and harvested fresh right here in Srinagar.
            </p>
          </div>

          {/* Bento Grid - Robust & Responsive */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Large: Borewell */}
            <div
              className="md:col-span-2 group relative overflow-hidden rounded-2xl p-8 md:p-10 flex flex-col justify-end min-h-[280px] transition-all hover:border-[#72ddfd]/30"
              style={{ background: C.bgLow, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAw2idJIrz9hjno5I1VpNsfjqfQnhqLPidbIRKttyWvaFYDCXn39gfFxbhzDkp01U8HcCCb9gTEBrCeOymPH_AzeyZBx_Yx8hr7s1Y71Cw3EAJseHs-q4N5ZCwSLxM0_DIj89VHy2rnRL-9hfVugHv39MDQ_0m368etR-norK3BNf3JBvjTaos9qVnQIaHfv3D_48h2G4W8T2Y3SlQjou3TtMSflhEb6T3b6RY5bbBsllLqCkQ2TvW96_cxg9sPUysMkjb6hK1naVV3"
                alt="Clean borewell water trout farm Srinagar"
                className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-700 pointer-events-none"
              />
              <div className="relative z-10">
                <svg className="w-9 h-9 text-[#72ddfd] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0m-18 5c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                </svg>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem", color: C.onSurface }}>100% Deep Borewell Water</h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, maxWidth: "600px", lineHeight: 1.7, margin: 0, fontSize: "0.95rem" }}>
                  Raised in clean, filtered groundwater isolated from surface runoff, open canal pollution, and river silt.
                </p>
              </div>
            </div>

            {/* Zero Antibiotics */}
            <div
              className="rounded-2xl p-8 md:p-10 flex flex-col justify-between transition-all hover:border-[#72ddfd]/30"
              style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <svg className="w-9 h-9 text-[#63cfee] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.4rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>Zero Antibiotics</h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>
                  Continuous clean water flow keeps fish naturally healthy, with zero chemical treatments or growth boosters.
                </p>
              </div>
            </div>

            {/* Harvested to Order */}
            <div
              className="rounded-2xl p-8 md:p-10 flex flex-col justify-between transition-all hover:border-[#72ddfd]/30"
              style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <svg className="w-9 h-9 text-[#72ddfd] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.4rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>Harvested to Order</h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, fontSize: "0.9rem", lineHeight: 1.7, margin: 0 }}>
                  We don&apos;t store dead fish in deep freezers. We harvest exclusively when you place an order for unmatched firmness.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Farm Conditions Strip ── */}
      <section style={{ padding: "4rem 1.5rem", borderTop: "1px solid rgba(114,221,253,0.07)", borderBottom: "1px solid rgba(114,221,253,0.07)", background: C.bgLow }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {farmConditions.map((item, i) => (
              <div key={i} className="flex flex-col gap-2">
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVariant }}>{item.label}</span>
                <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, color: C.primary, letterSpacing: "-0.02em" }}>{item.value}</span>
                <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.outline }}>{item.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Preview ── */}
      <section style={{ padding: "6rem 1.5rem", background: C.bg }}>
        <div className="max-w-7xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "1rem" }}>Fresh Catch Srinagar</span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4vw, 3.25rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: 0 }}>Buy Fresh Rainbow Trout</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {updatedProducts.map(p => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Local Srinagar FAQs (Rank Booster) ── */}
      <section style={{ padding: "6rem 1.5rem", background: C.bgLow, borderTop: "1px solid rgba(114,221,253,0.07)" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "0.75rem" }}>Frequently Asked Questions</span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: 0 }}>
              Trout Fish Delivery in Srinagar
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {faqs.map((faq, i) => (
              <div
                key={i}
                style={{
                  padding: "1.75rem",
                  borderRadius: "16px",
                  background: "rgba(16,33,44,0.7)",
                  border: "1px solid rgba(61,74,83,0.45)",
                }}
              >
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.1rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem", letterSpacing: "-0.01em" }}>
                  {faq.q}
                </h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", color: C.onSurfaceVariant, lineHeight: 1.75, margin: 0 }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <section style={{ padding: "4rem 1.5rem", borderTop: "1px solid rgba(114,221,253,0.07)", background: C.bg }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Fresh from Our Farm</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>Malabagh, Srinagar</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Zero Antibiotics</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>100% clean &amp; natural</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Same-Day Delivery</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>Chilled to your doorstep</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v4l-2 3v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-9L3 7V3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-8a2 2 0 012-2h2a2 2 0 012 2v8" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Farm Gate Pickup</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>Pick up fresh in person</span>
          </div>
        </div>
      </section>
    </div>
  );
}
