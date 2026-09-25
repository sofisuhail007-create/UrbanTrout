import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { products } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Fresh Rainbow Trout in Srinagar from ₹540/kg | Urban Trout",
  description:
    "Fresh Rainbow Trout in Srinagar from ₹540/kg. Harvested live to order & delivered chilled in 2 hrs. Free delivery or vending center pickup.",
  alternates: {
    canonical: "https://urbantrout.in",
  },
  openGraph: {
    title: "Fresh Rainbow Trout in Srinagar from ₹540/kg | Urban Trout",
    description:
      "Fresh Rainbow Trout in Srinagar from ₹540/kg. Harvested live to order & delivered chilled in 2 hrs. Free delivery or vending center pickup.",
    url: "https://urbantrout.in",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Fresh Rainbow Trout in Srinagar - Urban Trout",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
};

// Enable ISR (Incremental Static Regeneration) - cached at Edge CDN and refreshed every 60s
export const revalidate = 60;

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
  { label: "Water Temperature", value: "10°C – 12°C", sub: "Deep Himalayan Aquifer (Naturally Cold)", icon: "thermostat" },
  { label: "Water Source", value: "100% Borewell", sub: "Clean Groundwater • Zero Surface Silt", icon: "water_drop" },
  { label: "Oxygen Saturation", value: "98%+", sub: "Continuous High-Velocity Aeration", icon: "air" },
  { label: "Harvest Policy", value: "Live to Order", sub: "Swimming in Tanks Until You Order", icon: "timer" },
];

const faqs = [
  {
    q: "Where can I buy fresh trout fish in Srinagar?",
    a: "You can order fresh Rainbow Trout online directly through urbantrout.in or via WhatsApp (+91 84910 06127) for free doorstep delivery within 2 hours within our 5km radius delivery zone from our Malabagh farm. Customers outside our 5km perimeter are welcome to pick up orders directly from our dedicated Live Trout Vending Center.",
  },
  {
    q: "What is the price of Rainbow Trout per Kg in Srinagar?",
    a: "Our fresh Whole Rainbow Trout is ₹540 per Kg, and our Premium Cleaned & Gutted Trout is ₹580 per Kg. Unlike marketplace suppliers who charge extra for packing and delivery, our prices include 100% Free chilled bio-thermal doorstep delivery within our 5km farm radius in Srinagar.",
  },
  {
    q: "Do you clean and gut the trout before delivery?",
    a: "Yes! When you select our Cleaned & Gutted Rainbow Trout (₹580/kg), our farm team expertly descales, cleans, and guts the fish immediately after harvest. The fish is thoroughly washed and packed on food-grade ice so it is 100% pan-ready the moment it arrives at your kitchen.",
  },
  {
    q: "Which areas in Srinagar do you deliver to?",
    a: "To ensure peak freshness and cold-chain integrity, we deliver exclusively within a 5km radius zone from our Malabagh farm. This includes nearby areas such as Malabagh, Naseem Bagh, Hazratbal, Habak, Zakura, Lal Bazar, Soura (SKIMS), Bachpora, Illahibagh, and Nowshera. We do not deliver to outer municipal zones; customers outside our 5km radius are welcome to pick up their fresh catch directly from our Malabagh farm vending center.",
  },
  {
    q: "How fresh is Urban Trout compared to market fish?",
    a: "Market fish is often caught days in advance and transported on melting ice. At Urban Trout, your fish (Oncorhynchus mykiss) is alive and swimming in pure cold-water tanks when you place your order. We net it live, prepare it to your specifications, pack it in bio-thermal insulation with food-grade ice, and deliver it within 2 hours. The flesh is firm, bouncy, and completely free of fishy odor.",
  },
  {
    q: "What is the minimum order quantity for home delivery?",
    a: "Our minimum order quantity is 2 Kg (approx. 4–6 table-sized trout, 350g–500g each). This ensures optimal harvest efficiency and guarantees that the bio-thermal cold-chain insulation maintains its sub-4°C chill during transit.",
  },
  {
    q: "How should I store fresh trout and how long does it last?",
    a: "If cooking within 48 hours, keep the trout chilled in its ice pack inside your refrigerator chiller (0°C–4°C). For longer storage, wrap the trout in airtight freezer film or vacuum bags and freeze at -18°C for up to 3 months without compromising moisture or texture.",
  },
  {
    q: "What are your operating hours and are you open every day?",
    a: "We are open for fresh live harvesting, farm pickups, and doorstep delivery Saturday through Thursday from 7:00 AM to 10:00 PM IST. We are closed on Fridays for scheduled Farm Maintenance, water filtration bio-security sanitization, and RAS system upkeep.",
  },
  {
    q: "Is Rainbow Trout skin edible and how is it traditionally cooked in Kashmir?",
    a: "Yes! Rainbow Trout scales are microscopic and delicate. When cooked, the skin crisps up deliciously and is packed with healthy Omega-3 fatty acids. In Kashmir, it is most popularly pan-fried in mustard oil with salt and Kashmiri red chili, cooked as traditional Mujh Gaad (trout with radishes), or grilled with garlic butter and lemon.",
  },
];

const customerReviews = [
  {
    name: "Dr. Farooq Mir",
    locality: "Hazratbal, Srinagar",
    rating: 5,
    text: "Ordered 3 kg gutted trout for a family dinner. The fish was delivered within 90 minutes packed on crushed ice. The meat was remarkably firm and sweet—lightyears ahead of what you find in local markets.",
  },
  {
    name: "Aabid Hussain",
    locality: "Soura, Srinagar",
    rating: 5,
    text: "Having a live trout farm right here in Malabagh with free home delivery is a blessing. The trout was cleanly gutted and descaled, zero mud taste. Fried it in mustard oil, tasted heavenly.",
  },
  {
    name: "Shabir Ahmad",
    locality: "Lal Bazar, Srinagar",
    rating: 5,
    text: "Genuine 100% fresh catch. You can press the flesh with your finger and it bounces right back. No chemical smell, pure mountain-like taste. Regular customer now.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map((item) => ({
    "@type": "Question",
    "name": item.q,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.a,
    },
  })),
};

export default async function HomePage() {
  const { data: dbProducts } = await supabase.from("inventory").select("*");
  const updatedProducts = products.map((p) => {
    const dbItem = dbProducts?.find((item) => item.product_id === p.id);
    const price = dbItem?.price_per_kg ? Number(dbItem.price_per_kg) : p.price;
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

  const whatsappOrderUrl =
    "https://wa.me/918491006127?text=" +
    encodeURIComponent("Hi Urban Trout! I would like to order fresh Rainbow Trout for doorstep delivery in Srinagar.");

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Hero ── */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden pt-28 pb-16" aria-label="Hero — Fresh Rainbow Trout in Srinagar, Kashmir">
        {/* Background image */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <Image
            src="/images/hero-trout-bg.webp"
            alt="Fresh Rainbow Trout in Srinagar Kashmir - Urban Trout Farm"
            fill
            priority
            fetchPriority="high"
            unoptimized
            sizes="100vw"
            className="animate-hero-drift object-cover"
            style={{ filter: "brightness(0.32) saturate(0.85)" }}
          />
        </div>

        {/* Ambient Bubbles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
          <div className="ambient-bubble" style={{ left: "10%", width: "30px", height: "30px", animationDelay: "0s", animationDuration: "15s" }} />
          <div className="ambient-bubble" style={{ left: "85%", width: "45px", height: "45px", animationDelay: "2s", animationDuration: "18s" }} />
          <div className="ambient-bubble" style={{ left: "45%", width: "25px", height: "25px", animationDelay: "5s", animationDuration: "12s" }} />
          <div className="ambient-bubble" style={{ left: "70%", width: "50px", height: "50px", animationDelay: "8s", animationDuration: "20s" }} />
          <div className="ambient-bubble" style={{ left: "25%", width: "35px", height: "35px", animationDelay: "11s", animationDuration: "16s" }} />
        </div>

        {/* Gradient overlays */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, #031018 100%)" }} aria-hidden="true" />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(3,16,24,0.7) 0%, transparent 40%, rgba(3,16,24,0.7) 100%)" }} aria-hidden="true" />
        {/* Neon radial glow */}
        <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(114,221,253,0.06) 0%, transparent 70%)", pointerEvents: "none" }} aria-hidden="true" />

        {/* Hero Content */}
        <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "0 1.5rem", maxWidth: "940px", margin: "0 auto" }}>
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 text-xs font-semibold mb-4 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', letterSpacing: "0.08em" }} className="uppercase text-[11px] font-bold">
              Malabagh Farm Live Harvest • Srinagar, Kashmir
            </span>
          </div>

          {/* Primary SEO H1 */}
          <h1
            className="font-headline"
            style={{
              fontFamily: 'var(--font-space-grotesk), "Space Grotesk", sans-serif',
              fontSize: "clamp(2.4rem, 6.5vw, 5.25rem)",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.02,
              color: "#dfedf9",
              marginBottom: "1.5rem",
              textRendering: "optimizeSpeed",
            }}
          >
            Fresh Rainbow Trout in Srinagar,<br />
            <span style={{ color: "#72ddfd", textShadow: "0 0 35px rgba(114,221,253,0.4)" }}>
              Harvested to Order
            </span>
          </h1>

          {/* Value Hook with Explicit Transparent Pricing & Delivery */}
          <p
            style={{
              fontFamily: '"Manrope", sans-serif',
              fontSize: "clamp(1rem, 2vw, 1.15rem)",
              color: C.onSurfaceVariant,
              maxWidth: "680px",
              margin: "0 auto 2.5rem",
              lineHeight: 1.75,
            }}
          >
            Your trout is still swimming when you place your order. Farmed in clean, subterranean borewell water in Malabagh using advanced RAS tanks, packed on crushed ice, and delivered chilled to your doorstep: whole from <strong style={{ color: "#72ddfd" }}>₹540/kg</strong>, cleaned &amp; gutted from <strong style={{ color: "#72ddfd" }}>₹580/kg</strong> with <strong style={{ color: "#34d399" }}>100% Free Doorstep Delivery</strong> within 5km of our farm (or farm pickup) within 2 hours. Min 2 kg for thermal cold-chain insulation.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
            <Link
              href="/shop"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "15px 36px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #3aadcc 0%, #72ddfd 100%)",
                color: "#002730",
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 800,
                fontSize: "0.95rem",
                textDecoration: "none",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                boxShadow: "0 0 30px rgba(58,173,204,0.45), 0 4px 20px rgba(0,0,0,0.3)",
                transition: "all 0.3s",
              }}
            >
              Order Fresh Trout
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "18px", height: "18px" }} aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>

            <a
              href={whatsappOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "15px 30px",
                borderRadius: "12px",
                background: "rgba(37, 211, 102, 0.12)",
                border: "1px solid rgba(37, 211, 102, 0.4)",
                color: "#4ade80",
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 700,
                fontSize: "0.95rem",
                textDecoration: "none",
                backdropFilter: "blur(8px)",
                transition: "all 0.3s",
              }}
            >
              <span>Order on WhatsApp ⚡</span>
            </a>

            <Link
              href="/our-farm"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "15px 28px",
                borderRadius: "12px",
                border: "1px solid rgba(114,221,253,0.25)",
                color: C.onSurface,
                fontFamily: '"Space Grotesk", sans-serif',
                fontWeight: 600,
                fontSize: "0.95rem",
                textDecoration: "none",
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(8px)",
                transition: "all 0.3s",
              }}
            >
              About Our Farm
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{ position: "absolute", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", opacity: 0.5 }} aria-hidden="true">
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.25em", textTransform: "uppercase", color: "#72ddfd" }}>Fresh Catch Below</span>
          <div style={{ width: "1px", height: "30px", background: "linear-gradient(to bottom, #72ddfd, transparent)" }} />
        </div>
      </section>

      {/* ── Direct Fresh Catch Product Section (Promoted Above the Fold for Immediate Conversion) ── */}
      <section style={{ padding: "5rem 1.5rem", background: C.bg }} aria-label="Fresh Rainbow Trout Products and Live Pricing">
        <div className="max-w-7xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "0.75rem" }}>
              Live Farm Harvest • 5km Radius Doorstep Delivery
            </span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2.2rem, 5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: 0 }}>
              Today&apos;s Fresh Rainbow Trout Rates
            </h2>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, fontSize: "0.95rem", marginTop: "0.5rem", maxWidth: "600px", margin: "0.5rem auto 0" }}>
              Farmed in cold borewell water in Malabagh. 100% Free bio-thermal chilled delivery within our 5km farm zone on every order.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {updatedProducts.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>

          <div className="text-center mt-6">
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: "#9fadb8" }}>
              Need bulk supply for weddings, family wazwan, or Srinagar restaurants? Call our farm desk directly at{" "}
              <a href="tel:+918491006127" className="text-cyan-400 font-bold hover:underline font-mono">
                +91 84910 06127
              </a>
            </p>
          </div>

          {/* Understanding Your Catch: Whole vs. Cleaned Dressing Yield */}
          <div className="mt-10 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-cyan-400">Yield &amp; Butchery Transparency</span>
                <h3 className="text-base font-bold text-white font-['Space_Grotesk'] mt-0.5">Whole vs. Cleaned &amp; Gutted Dressing Yield</h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-xs font-mono text-cyan-300 font-semibold">
                Anatomical Viscera Loss: 15% – 18%
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans mb-3">
              When ordering Whole Trout (₹540/kg), the fish is weighed whole as harvested from our RAS cold-water tanks. When electing our Cleaned &amp; Gutted option (₹580/kg), our farm butchers eviscerate, gill-bleed, and descale the fish immediately. This standard preparation removes roughly 150g–180g of inedible viscera and gills per kg, delivering approximately <strong>820g–850g of 100% pan-ready edible fish</strong> with intact single-bone spine, saving you 20 minutes of messy kitchen prep. A standard 2 Kg order provides approximately 4 to 6 fresh trout (350g–500g each), perfectly portioned for family dining.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="font-bold text-white block mb-0.5">Whole Trout (₹540/kg):</span>
                <span className="text-slate-400">Best for experienced cooks, traditional open-fire charcoal grilling, or those using the nutrient-rich head for authentic fish broth (Gaad Soup).</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="font-bold text-emerald-400 block mb-0.5">Cleaned &amp; Gutted (₹580/kg):</span>
                <span className="text-slate-400">100% pan-ready. Descaled and eviscerated with chilled groundwater wash. Straight onto the tawa or into the oven upon delivery.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2026 Srinagar Rainbow Trout Price Comparison Matrix (Price Hook & Transparency) ── */}
      <section style={{ padding: "5rem 1.5rem", background: C.bgHigh, borderTop: "1px solid rgba(114,221,253,0.1)", borderBottom: "1px solid rgba(114,221,253,0.1)" }} aria-label="Srinagar Rainbow Trout Price Comparison Table">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, fontWeight: 700 }}>
              Transparent Price Benchmark (2026 Guide)
            </span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4.5vw, 3.25rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, marginTop: "0.5rem" }}>
              Farm Direct vs. Srinagar Markets &amp; Directories
            </h2>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, fontSize: "0.95rem", lineHeight: 1.7 }}>
              Directories and marketplaces in Srinagar list trout between ₹650 and ₹1,000 per kg with extra packaging and transit charges. At Urban Trout, you get live-harvested fish delivered chilled to your doorstep at direct producer rates.
            </p>
          </div>

          {/* Responsive Comparison Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/70 shadow-2xl backdrop-blur-md">
            <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80">
                  <th className="p-4 md:p-5 font-semibold text-slate-300">Feature / Channel</th>
                  <th className="p-4 md:p-5 font-bold text-cyan-300 bg-cyan-950/40 border-x border-cyan-500/20">
                    <span className="block text-xs uppercase tracking-wider text-cyan-400">Urban Trout</span>
                    <span className="text-base md:text-lg">Farm Direct Live</span>
                  </th>
                  <th className="p-4 md:p-5 font-semibold text-slate-400">Srinagar Wet Fish Markets</th>
                  <th className="p-4 md:p-5 font-semibold text-slate-400">IndiaMART / B2B Directories</th>
                  <th className="p-4 md:p-5 font-semibold text-slate-400">Srinagar Specialty Restaurants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-sans text-slate-300">
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4 md:p-5 font-medium text-white">Whole Trout Rate / Kg</td>
                  <td className="p-4 md:p-5 font-bold text-emerald-400 bg-cyan-950/30 border-x border-cyan-500/20 text-base">₹540 / Kg</td>
                  <td className="p-4 md:p-5 text-slate-400">₹650 – ₹700 / Kg</td>
                  <td className="p-4 md:p-5 text-slate-400">₹650 – ₹1,000 / Kg</td>
                  <td className="p-4 md:p-5 text-slate-400">₹1,000 – ₹1,400 / Kg (Cooked)</td>
                </tr>
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4 md:p-5 font-medium text-white">Cleaned &amp; Gutted Rate / Kg</td>
                  <td className="p-4 md:p-5 font-bold text-emerald-400 bg-cyan-950/30 border-x border-cyan-500/20 text-base">₹580 / Kg <span className="text-[11px] font-normal text-slate-400">(100% Pan-Ready)</span></td>
                  <td className="p-4 md:p-5 text-slate-400">₹720 – ₹780 / Kg</td>
                  <td className="p-4 md:p-5 text-slate-400">₹750 – ₹1,100 / Kg</td>
                  <td className="p-4 md:p-5 text-slate-400">₹1,200 – ₹1,600 / Kg</td>
                </tr>
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4 md:p-5 font-medium text-white">Harvesting &amp; Freshness</td>
                  <td className="p-4 md:p-5 text-cyan-200 bg-cyan-950/30 border-x border-cyan-500/20">
                    <strong className="text-emerald-400">Live harvest to order</strong>. Swimming in circular RAS tanks until confirmed.
                  </td>
                  <td className="p-4 md:p-5 text-slate-400">Caught days prior; stored on melting municipal ice.</td>
                  <td className="p-4 md:p-5 text-slate-400">Bulk frozen blocks; transit haul delays.</td>
                  <td className="p-4 md:p-5 text-slate-400">Prepared from refrigerated or frozen inventory.</td>
                </tr>
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4 md:p-5 font-medium text-white">Doorstep Delivery (5km Farm Zone)</td>
                  <td className="p-4 md:p-5 text-cyan-200 bg-cyan-950/30 border-x border-cyan-500/20 font-semibold text-emerald-400">
                    100% FREE within 2 Hours (Chilled on ice)
                  </td>
                  <td className="p-4 md:p-5 text-slate-400">Self-pickup required or ₹100+ local courier.</td>
                  <td className="p-4 md:p-5 text-slate-400">₹200–₹400 extra packing &amp; freight box.</td>
                  <td className="p-4 md:p-5 text-slate-400">Dine-in only (no raw fish supply).</td>
                </tr>
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4 md:p-5 font-medium text-white">Minimum Order Quantity</td>
                  <td className="p-4 md:p-5 text-white bg-cyan-950/30 border-x border-cyan-500/20 font-medium">2 Kg (Family friendly)</td>
                  <td className="p-4 md:p-5 text-slate-400">1 Kg</td>
                  <td className="p-4 md:p-5 text-slate-400">5 – 10 Kg wholesale lot</td>
                  <td className="p-4 md:p-5 text-slate-400">Single plate portion</td>
                </tr>
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4 md:p-5 font-medium text-white">Bone &amp; Edibility Profile</td>
                  <td className="p-4 md:p-5 text-cyan-200 bg-cyan-950/30 border-x border-cyan-500/20">
                    <strong className="text-white">Single central spine</strong>. Soft pin-bones pull out cleanly in 1 piece. <em>Kid-friendly &amp; safe.</em>
                  </td>
                  <td className="p-4 md:p-5 text-slate-400">Variable species quality; risk of broken bones.</td>
                  <td className="p-4 md:p-5 text-slate-400">Standard commercial harvest.</td>
                  <td className="p-4 md:p-5 text-slate-400">Deboned fillet at 2x premium.</td>
                </tr>
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4 md:p-5 font-medium text-white">Water Purity &amp; Chemicals</td>
                  <td className="p-4 md:p-5 text-cyan-200 bg-cyan-950/30 border-x border-cyan-500/20">
                    <strong className="text-emerald-400">100% Deep Groundwater</strong>. Zero antibiotics, zero mud taste.
                  </td>
                  <td className="p-4 md:p-5 text-slate-400">Often open canal or river water with silt.</td>
                  <td className="p-4 md:p-5 text-slate-400">Unverified aquaculture practices.</td>
                  <td className="p-4 md:p-5 text-slate-400">Depends on vendor source.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <span>Rates verified for Srinagar, Kashmir (2026). Urban Trout rates include 100% free insulated doorstep delivery within our 5km farm zone.</span>
            <Link href="/trout-price-srinagar" className="inline-flex items-center gap-1.5 text-cyan-400 font-bold hover:underline">
              <span>Read Full Srinagar Trout Price Guide &amp; Wholesale Rates</span>
              <span>→</span>
            </Link>
          </div>

          {/* Farm-Direct vs. Government Fisheries Sale Counters Callout */}
          <div className="mt-8 p-6 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1.5 text-center md:text-left">
              <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-amber-400">Srinagar Trout Buying Channels</span>
              <h4 className="text-sm font-bold text-white font-['Space_Grotesk']">Farm-Direct Doorstep Delivery vs. J&amp;K Fisheries Department Outlets</h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-3xl">
                The J&amp;K Department of Fisheries operates respected retail counters at <strong>Gagribal (Boulevard)</strong>, <strong>Laribal Hatchery</strong>, and <strong>Kokernag</strong>. While official outlets provide subsidized public stock, they operate during strict morning windows (typically 8:00 AM – 11:00 AM), enforce strict per-citizen purchase quotas, and require in-person queuing. Urban Trout complements this ecosystem with <strong>on-demand live harvest from our modern RAS facility, distribution via our dedicated Srinagar vending center, and 100% Free Doorstep Delivery</strong> directly to your home within 2 hours across our 5km farm delivery zone (or farm pickup for customers outside 5km).
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link href="/trout-price-srinagar" className="px-4 py-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-xs font-bold text-cyan-300 hover:bg-cyan-900 transition-colors inline-block whitespace-nowrap">
                Compare Srinagar Rates →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Evidence-Backed Farm Conditions Strip ── */}
      <section style={{ padding: "4rem 1.5rem", borderTop: "1px solid rgba(114,221,253,0.1)", borderBottom: "1px solid rgba(114,221,253,0.1)", background: C.bgLow }} aria-label="Verified Farm Conditions">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, fontWeight: 700 }}>
              Live Water Quality &amp; Farming Standards
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {farmConditions.map((item, i) => (
              <div key={i} className="flex flex-col gap-1.5 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.15em", color: C.onSurfaceVariant }}>{item.label}</span>
                <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(1.6rem, 2.5vw, 2.1rem)", fontWeight: 800, color: C.primary, letterSpacing: "-0.02em" }}>{item.value}</span>
                <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: "#a5b4fc", lineHeight: 1.4 }}>{item.sub}</span>
              </div>
            ))}
          </div>

          {/* Cold Chain Harvest-to-Doorstep Timeline */}
          <div className="mt-12 pt-10 border-t border-slate-800">
            <div className="text-center mb-6">
              <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#34d399", fontWeight: 700 }}>
                From Malabagh RAS Tanks to Your Kitchen in Under 120 Minutes
              </span>
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.4rem", fontWeight: 700, color: C.onSurface, margin: "4px 0 0" }}>
                Our 4-Stage Fresh Harvest Timeline
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">00:00 MIN</span>
                  <span className="text-base">🐟</span>
                </div>
                <h4 className="font-bold text-sm text-white">Live Netting</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Fish is netted live from cold 10°C borewell water solely after order verification.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">00:15 MIN</span>
                  <span className="text-base">🔪</span>
                </div>
                <h4 className="font-bold text-sm text-white">Precision Prep</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Expertly descaled and gutted with cold groundwater rinse. 100% pan-ready.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30">00:25 MIN</span>
                  <span className="text-base">🧊</span>
                </div>
                <h4 className="font-bold text-sm text-white">Bio-Thermal Chilling</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Packed in insulated food-grade containers on crushed ice at 0°C–2°C.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">&lt; 120 MIN</span>
                  <span className="text-base">🚀</span>
                </div>
                <h4 className="font-bold text-sm text-white">Doorstep Arrival</h4>
                <p className="text-xs text-slate-400 leading-relaxed">Handed directly to you within our 5km farm delivery zone with zero delivery fees.</p>
              </div>
            </div>
          </div>

          {/* Verified Lab Water Test Report & Measurement Audit (March 2026) */}
          <div className="mt-10 p-6 rounded-2xl bg-slate-950/80 border border-cyan-500/20 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-mono font-bold text-emerald-400">Verified Aquifer Test Report • March 2026</span>
              </div>
              <h4 className="text-base font-bold text-white font-['Space_Grotesk']">Malabagh Deep Borewell Aquifer Quality Audit</h4>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Continuous probe telemetry &amp; laboratory titration: <strong>11.2°C Temperature</strong>, <strong>9.8 mg/L Dissolved Oxygen (Near-Saturation Cold Water)</strong>, <strong>pH 7.6</strong>, <strong>Ammonia &lt;0.01 mg/L</strong>. Unlike surface canal or river waters exposed to agricultural runoff and cyanobacterial blooms that produce earthy <em>Geosmin</em> and <em>2-Methylisoborneol (2-MIB)</em>, our subterranean aquifer is 100% silt-free and sun-shielded, ensuring sweet, clean-tasting white flesh with <strong>zero mud taste</strong>. Farm aquaculture standards aligned with the <a href="https://fisheries.jk.gov.in" target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-semibold underline hover:text-cyan-300">Jammu &amp; Kashmir Department of Fisheries</a>.
              </p>
            </div>
            <div className="flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-xs font-mono font-bold text-cyan-300 shadow-md shadow-cyan-950/50">
                <span>100% Silt-Free</span>
                <span className="text-emerald-400">✓</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Choose Urban Trout (Bento Grid) ── */}
      <section style={{ padding: "6rem 1.5rem", background: C.bg, position: "relative", overflow: "hidden" }} aria-label="Why Choose Urban Trout">
        <div className="max-w-7xl mx-auto">
          {/* Section header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <Link href="/refund-policy" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-widest hover:underline mb-2">
                <span>🛡️ 100% Freshness Guaranteed</span>
                <span>→</span>
              </Link>
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: C.onSurface, margin: 0 }}>
                Why Srinagar Chooses<br />
                <span style={{ color: "#63cfee" }}>Urban Trout</span>
              </h2>
            </div>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, maxWidth: "420px", lineHeight: 1.7, borderLeft: "2px solid rgba(114,221,253,0.3)", paddingLeft: "1.25rem", fontSize: "0.95rem" }}>
              Clean borewell water, zero preventive antibiotics, live netting, and 100% free doorstep delivery within our 5km farm zone in 2 hours.
            </p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Large: Borewell */}
            <div
              className="md:col-span-2 group relative overflow-hidden rounded-2xl p-8 md:p-10 flex flex-col justify-end min-h-[280px] transition-all hover:border-[#72ddfd]/30"
              style={{ background: C.bgLow, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Image
                src="/images/borewell-farm-bg.webp"
                alt="Clean borewell water trout farm Malabagh Srinagar"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 1200px"
                className="object-cover opacity-20 group-hover:scale-105 transition-transform duration-700 pointer-events-none"
              />
              <div className="relative z-10">
                <svg className="w-9 h-9 text-[#72ddfd] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 10c2-2 4-2 6 0s4 2 6 0 4-2 6 0m-18 5c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
                </svg>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.5rem", color: C.onSurface }}>
                  100% Deep Groundwater (Borewell) System
                </h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, maxWidth: "660px", lineHeight: 1.75, margin: 0, fontSize: "0.95rem" }}>
                  Raised in clean, filtered subterranean groundwater at a steady 10°C–12°C. Completely isolated from Dal Lake contaminants, open agricultural runoff, and muddy river silt, resulting in pristine, clean-tasting white flesh.
                </p>
              </div>
            </div>

            {/* Zero Antibiotics */}
            <div
              className="rounded-2xl p-8 md:p-10 flex flex-col justify-between transition-all hover:border-[#72ddfd]/30"
              style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <svg className="w-9 h-9 text-[#63cfee] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.4rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>Zero Preventive Antibiotics</h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, fontSize: "0.9rem", lineHeight: 1.75, margin: 0 }}>
                  High-velocity continuous flow and high dissolved oxygen keep our trout naturally active and vigorous without chemical feeds, hormones, or prophylactic antibiotics.
                </p>
              </div>
            </div>

            {/* Harvested to Order */}
            <div
              className="rounded-2xl p-8 md:p-10 flex flex-col justify-between transition-all hover:border-[#72ddfd]/30"
              style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div>
                <svg className="w-9 h-9 text-[#72ddfd] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.4rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>Harvested Live to Order</h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, fontSize: "0.9rem", lineHeight: 1.75, margin: 0 }}>
                  Never pre-harvested or kept in stagnant cold storage. Fish swim in clean, continuous cold-water currents until your order is confirmed, then hand-harvested live, cleaned, and packed on food-grade ice for delivery within 2 hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Semantic Trout Knowledge & Culinary Guide (Topical Depth Boost) ── */}
      <section style={{ padding: "6rem 1.5rem", background: C.bgLow, borderTop: "1px solid rgba(114,221,253,0.08)" }} aria-label="Srinagar Rainbow Trout Guide">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, fontWeight: 700 }}>
              Species, Cooking &amp; Freshness Guide
            </span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4.5vw, 3.25rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, marginTop: "0.5rem" }}>
              Everything About Rainbow Trout in Srinagar
            </h2>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfaceVariant, fontSize: "0.95rem", lineHeight: 1.75 }}>
              Known scientifically as <em className="text-cyan-300 font-serif">Oncorhynchus mykiss</em>, and locally in Kashmir as <strong className="text-white">ٹراؤٹ مچھلی / Trout Machli (ट्राउट मछली)</strong>, this cold-water salmonid is famous for its clean flavor, tender texture, and rich Omega-3 profile.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Card 1: Freshness Verification */}
            <div className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xl font-bold mb-3">
                  🔍
                </div>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.3rem", fontWeight: 700, color: C.onSurface, marginBottom: "0.75rem" }}>
                  How to Spot 100% Fresh Trout
                </h3>
                <ul className="text-xs text-slate-300 space-y-2.5 leading-relaxed font-sans">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Convex, crystal-clear eyes:</strong> Fresh trout has bulging, shiny eyes. Sunken, clouded, or milky eyes indicate days-old fish.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Vibrant crimson red gills:</strong> Gills must be moist and deep scarlet. Avoid fish with dull brown or mucus-covered gills.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Elastic, firm flesh:</strong> Gently press the skin—the muscle must spring back immediately without leaving a permanent dent.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span><strong>Clean freshwater scent:</strong> Smells like clean Himalayan river currents, with zero sour or ammonia odor.</span>
                  </li>
                </ul>
              </div>
              <Link href="/fresh-trout-guide" className="inline-flex items-center gap-1.5 text-xs text-cyan-400 font-bold hover:underline pt-2">
                <span>View Full Trout Freshness &amp; Identification Guide</span>
                <span>→</span>
              </Link>
            </div>

            {/* Card 2: Single-Bone Anatomy & Child-Safe Nutrition */}
            <div className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xl font-bold mb-3">
                  🦴
                </div>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.3rem", fontWeight: 700, color: C.onSurface, marginBottom: "0.75rem" }}>
                  Single Pin-Bone Anatomy &amp; Kid-Safe Dining
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans mb-3">
                  Unlike local river carp, Rohu, or Katla which are packed with sharp, hazardous intramuscular &ldquo;Y-bones&rdquo;, Rainbow Trout features an uncomplicated, single central backbone.
                </p>
                <ul className="text-xs text-slate-300 space-y-2.5 leading-relaxed font-sans">
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>Effortless deboning:</strong> Once steamed, pan-fried, or baked, the central spine lifts out completely in one single motion.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>100% Safe for children &amp; elders:</strong> Zero tiny hidden bones embedded in the meat.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span><strong>High Omega-3 &amp; Protein:</strong> Delivers 20.5g lean protein and ~1,000mg essential EPA/DHA Omega-3s per 100g serving for heart and cognitive vitality.</span>
                  </li>
                </ul>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono">Favored by health-conscious families &amp; parents for kid-safe, bone-free dining</span>
            </div>

            {/* Card 3: Species Science & The "Himalayan Salmon" */}
            <div className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xl font-bold mb-3">
                  🧬
                </div>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.3rem", fontWeight: 700, color: C.onSurface, marginBottom: "0.75rem" }}>
                  Rainbow vs. Brown Trout &amp; &ldquo;Himalayan Salmon&rdquo;
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans mb-3">
                  Rainbow Trout (<em className="text-cyan-300 font-serif">Oncorhynchus mykiss</em>) is widely celebrated as the <strong>&ldquo;Himalayan Salmon&rdquo;</strong> of Kashmir. Both belong to the esteemed <em className="text-slate-300">Salmonidae</em> family.
                </p>
                <ul className="text-xs text-slate-300 space-y-2.5 leading-relaxed font-sans">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">★</span>
                    <span><strong>Rainbow Trout:</strong> Distinguished by its vibrant iridescent pink lateral stripe, tender white-to-light-pink meat, mild sweetness, and rapid even cooking.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">★</span>
                    <span><strong>Brown Trout (Salmo trutta):</strong> Darker with red halos, denser gamey flesh, primarily stocked in hill streams and hatcheries for sport angling rather than commercial table aquaculture.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">★</span>
                    <span><strong>Why Rainbow Trout leads:</strong> Superior disease resistance in pure borewell currents and unmatched culinary tenderness.</span>
                  </li>
                </ul>
              </div>
              <span className="text-[11px] text-cyan-300 font-mono">100% Pure Bred Oncorhynchus mykiss stock</span>
            </div>

            {/* Card 4: Authentic Kashmiri Culinary Traditions & Marinade */}
            <div className="p-7 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-xl font-bold mb-3">
                  🍳
                </div>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.3rem", fontWeight: 700, color: C.onSurface, marginBottom: "0.75rem" }}>
                  Authentic Kashmiri Marinade &amp; Recipes
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans mb-3">
                  Kashmiri culinary heritage pairs trout with warm digestive aromatics and cold-pressed mustard oil (<em className="text-amber-300">Kaer tuel</em>), whose high smoking point (~250°C) flashes the delicate scales into a micro-crisp crust while pungent ginger (<em className="text-amber-300">shonth</em>) and fennel neutralise any residual fishy amines:
                </p>
                <ul className="text-xs text-slate-300 space-y-2.5 leading-relaxed font-sans">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">1.</span>
                    <span><strong>The Signature Marinade:</strong> Rub gutted trout with pure mustard oil, dried ginger powder (<em className="text-white">shonth</em>), ground fennel (<em className="text-white">badiyan / saunf</em>), Kashmiri deghi chili, and rock salt. Rest 15 mins.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">2.</span>
                    <span><strong>Versatile Kitchen Cuts:</strong> Cook whole for festive table dining, cross-cut into 1-inch thick steaks (<em>darne</em>) for golden pan-searing, or gently butterfly along the spine for oven baking.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">3.</span>
                    <span><strong>Mujh Gaad &amp; Gaad Soup:</strong> Slow-simmer with sliced winter radishes and aromatic <em className="text-white">ver</em> masala, or simmer heads and bones with garlic into a collagen-rich Kashmiri fish broth (<em>Gaad Soup</em>).</span>
                  </li>
                </ul>
              </div>
              <Link href="/kashmiri-trout-recipe" className="inline-flex items-center gap-1.5 text-xs text-cyan-400 font-bold hover:underline pt-2">
                <span>Explore Full Kashmiri Trout Recipes &amp; Step-by-Step Cooking</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Verified Local Reviews (E-E-A-T Social Proof) ── */}
      <section style={{ padding: "5rem 1.5rem", background: C.bg }} aria-label="Customer Reviews and Testimonials">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, fontWeight: 700 }}>
              Real Customer Feedback
            </span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, marginTop: "0.5rem" }}>
              Trusted by Srinagar Homes &amp; Food Lovers
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {customerReviews.map((r, i) => (
              <div key={i} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-400 text-sm">
                    {"★".repeat(r.rating)}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans italic">
                    &ldquo;{r.text}&rdquo;
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-['Space_Grotesk']">{r.name}</span>
                  <span className="text-[11px] text-cyan-400 font-mono">{r.locality}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Local Srinagar FAQs (Rank Booster) ── */}
      <section style={{ padding: "6rem 1.5rem", background: C.bgLow, borderTop: "1px solid rgba(114,221,253,0.07)" }} aria-label="Frequently Asked Questions">
        <div style={{ maxWidth: "880px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "0.75rem" }}>
              Got Questions? We Have Answers
            </span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: 0 }}>
              Trout Fish Delivery in Srinagar FAQs
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
      <section style={{ padding: "4rem 1.5rem", borderTop: "1px solid rgba(114,221,253,0.07)", background: C.bg }} aria-label="Our Commitments">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10" aria-hidden="true">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Malabagh Farm Catch</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>Operated by Skindar Mohd Sideeq</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10" aria-hidden="true">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Zero Preventive Antibiotics</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>100% natural cold-water flow</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10" aria-hidden="true">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>100% Free Doorstep Delivery</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>Delivered chilled within 5km farm radius</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px" }}>
            <div className="w-12 h-12 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/10" aria-hidden="true">
              <svg className="w-6 h-6 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v4l-2 3v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-9L3 7V3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-8a2 2 0 012-2h2a2 2 0 012 2v8" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Vending Center Pickup</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfaceVariant }}>Live Trout Center (Srinagar)</span>
          </div>
        </div>

        {/* E-E-A-T Compliance, FSSAI Registration & Freshness Guarantee */}
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-lg">
              🛡️
            </div>
            <div>
              <span className="block text-xs font-bold text-white font-['Space_Grotesk'] uppercase tracking-wider">
                FSSAI Reg. No: <span className="text-emerald-400">21026414000392</span> • J&amp;K Fisheries Compliant
              </span>
              <span className="text-[11px] text-slate-400 font-sans">
                Dept. of Health &amp; Medical Education, J&amp;K • 0°C–2°C food-grade ice insulation.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-sans">
            <a
              href="https://maps.app.goo.gl/4N8A8ywhJpys9EaDA"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 hover:text-cyan-300 font-bold"
            >
              <span>📍 Google Maps (4.9 ★ 8 Reviews)</span>
              <span>↗</span>
            </a>
            <div className="text-slate-400 max-w-sm text-left hidden sm:block">
              <strong className="text-emerald-400">100% Freshness Guarantee:</strong> Harvested live to order with instant free replacement or refund.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
