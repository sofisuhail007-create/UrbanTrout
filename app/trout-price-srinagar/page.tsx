import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Rainbow Trout Price Per Kg in Srinagar (2026 Live Rates) | Urban Trout",
  description:
    "Official 2026 Rainbow Trout rates in Srinagar. Whole trout at ₹540/kg, cleaned & gutted at ₹580/kg with 100% Free Doorstep Delivery. Compare direct producer vs market rates.",
  alternates: {
    canonical: "https://urbantrout.in/trout-price-srinagar",
  },
  openGraph: {
    title: "Rainbow Trout Price Per Kg in Srinagar (2026 Rates) | Urban Trout",
    description:
      "Farm-direct live harvest rates for Rainbow Trout in Srinagar: ₹540/kg whole, ₹580/kg gutted with free chilled delivery across Srinagar within 2 hours.",
    url: "https://urbantrout.in/trout-price-srinagar",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Rainbow Trout Price in Srinagar - Urban Trout",
      },
    ],
    locale: "en_IN",
    type: "article",
  },
};

const C = {
  bg: "#031018",
  bgLow: "#06151e",
  bgHigh: "#10212c",
  primary: "#72ddfd",
  primaryCont: "#3aadcc",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
};

const priceFaqs = [
  {
    q: "What is the current rate of Rainbow Trout per kg in Srinagar for 2026?",
    a: "At Urban Trout farm in Malabagh, Srinagar, fresh Whole Rainbow Trout is priced at ₹540 per kg, and Premium Cleaned & Gutted Trout is ₹580 per kg. Both include 100% Free chilled doorstep delivery across Srinagar within 2 hours of harvest.",
  },
  {
    q: "Why are market fish and IndiaMART rates higher than Urban Trout?",
    a: "Market fish sellers and IndiaMART brokers operate through multiple layers of middlemen, transit freight, and packaging surcharges, charging between ₹650 and ₹1,000 per kg. Because Urban Trout harvests directly from our Malabagh cold-water RAS tanks and fulfills through our dedicated Srinagar vending center, there are zero middleman commissions or freight overheads.",
  },
  {
    q: "What is the minimum order quantity for free delivery in Srinagar?",
    a: "Our minimum order is 2 kg. This ensures efficient live harvesting and allows our bio-thermal ice packing to maintain strict 0°C–2°C temperatures throughout transit to your kitchen.",
  },
  {
    q: "Is there any extra charge for descaling, gutting, or doorstep delivery?",
    a: "No hidden charges whatsoever. Doorstep delivery across all Srinagar localities is 100% Free. Our Cleaned & Gutted option (₹580/kg) arrives 100% pan-ready with scales and viscera removed.",
  },
];

const articleJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Rainbow Trout Price Per Kg in Srinagar: 2026 Market Rates & Direct Producer Comparison",
      "description": "Comprehensive 2026 price guide comparing direct producer rates, market rates, and restaurant pricing for Rainbow Trout in Srinagar, Kashmir.",
      "image": "https://urbantrout.in/og-image.jpg",
      "author": {
        "@type": "Person",
        "name": "Skindar Mohd Sideeq",
        "jobTitle": "Head Aquaculturist & Founder",
      },
      "publisher": {
        "@type": "Organization",
        "name": "Urban Trout",
        "logo": "https://urbantrout.in/sitelogo.png",
      },
      "datePublished": "2026-01-15T08:00:00+05:30",
      "dateModified": "2026-03-23T22:00:00+05:30",
      "mainEntityOfPage": "https://urbantrout.in/trout-price-srinagar",
    },
    {
      "@type": "FAQPage",
      "mainEntity": priceFaqs.map((faq) => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.a,
        },
      })),
    },
  ],
};

export default function TroutPriceSrinagarPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="pt-28 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6 font-mono" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-cyan-300">Home</Link>
          <span>/</span>
          <span className="text-cyan-400">Price Guide 2026</span>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold font-mono">
            Srinagar Cold-Water Aquaculture Benchmark
          </span>
          <h1
            style={{ fontFamily: '"Space Grotesk", sans-serif', color: C.onSurface }}
            className="text-3xl md:text-5xl font-extrabold tracking-tight mt-3 mb-5 leading-tight"
          >
            Rainbow Trout Price Per Kg in Srinagar (2026 Live Rates)
          </h1>
          <p
            style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar }}
            className="text-base md:text-lg leading-relaxed"
          >
            Looking to buy <Link href="/" className="text-cyan-400 font-semibold underline hover:text-cyan-300">fresh Rainbow Trout in Srinagar</Link> (<em className="text-cyan-300 font-serif">Oncorhynchus mykiss</em>) without overpaying? Here is the transparent breakdown of live harvest rates from our modern RAS tanks versus local wet markets and online directories.
          </p>
        </header>

        {/* Live Rates Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="p-8 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-xl shadow-cyan-950/30">
            <span className="text-xs uppercase tracking-widest font-mono text-cyan-300 font-bold">Live Weight</span>
            <h2 className="text-2xl font-bold text-white mt-1 mb-2 font-['Space_Grotesk']">Whole Rainbow Trout</h2>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-extrabold text-emerald-400 font-mono">₹540</span>
              <span className="text-slate-400 text-sm">/ Kilogram</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 mb-6 font-sans">
              <li>✓ 100% natural weight (gills, scales, and head intact)</li>
              <li>✓ Netted live from Malabagh tanks upon order confirmation</li>
              <li>✓ 100% Free chilled doorstep delivery across Srinagar</li>
              <li>✓ Minimum order: 2 Kg</li>
            </ul>
            <Link
              href="/shop/whole-trout"
              className="block text-center py-3 px-6 rounded-xl font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors uppercase tracking-wider text-xs font-['Space_Grotesk']"
            >
              Order Whole Trout (₹540/kg)
            </Link>
          </div>

          <div className="p-8 rounded-2xl bg-slate-900/90 border border-emerald-500/40 shadow-xl shadow-emerald-950/30">
            <span className="text-xs uppercase tracking-widest font-mono text-emerald-300 font-bold">100% Pan-Ready</span>
            <h2 className="text-2xl font-bold text-white mt-1 mb-2 font-['Space_Grotesk']">Cleaned &amp; Gutted Trout</h2>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-extrabold text-emerald-400 font-mono">₹580</span>
              <span className="text-slate-400 text-sm">/ Kilogram</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 mb-6 font-sans">
              <li>✓ Descaled, cleaned, and gutted by farm specialists</li>
              <li>✓ Washed in cold borewell water, zero kitchen mess</li>
              <li>✓ 100% Free chilled doorstep delivery across Srinagar</li>
              <li>✓ Single central spine, effortless to debone (child-friendly)</li>
            </ul>
            <Link
              href="/shop/gutted-trout"
              className="block text-center py-3 px-6 rounded-xl font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors uppercase tracking-wider text-xs font-['Space_Grotesk']"
            >
              Order Gutted Trout (₹580/kg)
            </Link>
          </div>
        </div>

        {/* Content Section 1: Detailed Comparison Table */}
        <section className="prose prose-invert max-w-none mb-14 text-slate-300">
          <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mb-4">
            How Urban Trout Compares Against Local Sellers (2026 Matrix)
          </h2>
          <p className="text-sm leading-relaxed mb-6 font-sans">
            In Srinagar, fish buyers typically purchase trout from three channels: local wet fish stalls (e.g., in Batamaloo, Dalgate, or Hazratbal), marketplace listings on IndiaMART, or high-end dining restaurants. Here is how they compare in cost, freshness, and convenience:
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 mb-8">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="p-4">Channel</th>
                  <th className="p-4 text-cyan-300">Rate / Kg</th>
                  <th className="p-4">Delivery Fee</th>
                  <th className="p-4">Freshness State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-400 font-sans">
                <tr>
                  <td className="p-4 font-bold text-white">Urban Trout (Farm Direct)</td>
                  <td className="p-4 font-bold text-emerald-400">₹540 – ₹580</td>
                  <td className="p-4 text-emerald-400 font-bold">FREE (Chilled)</td>
                  <td className="p-4 text-slate-300">Live harvested to order from RAS tanks</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-slate-300">Srinagar Wet Fish Markets</td>
                  <td className="p-4">₹650 – ₹720</td>
                  <td className="p-4">Self pickup / ₹100 auto</td>
                  <td className="p-4">Pre-harvested, stored on melting ice</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-slate-300">IndiaMART / Marketplace B2B</td>
                  <td className="p-4">₹650 – ₹1,000</td>
                  <td className="p-4">₹200–₹400 thermocol box</td>
                  <td className="p-4">Frozen stock / transit delays</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-slate-300">Srinagar Specialty Restaurants</td>
                  <td className="p-4">₹1,000 – ₹1,400</td>
                  <td className="p-4">Dine-in only</td>
                  <td className="p-4">Cooked portion</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-xl font-bold text-white font-['Space_Grotesk'] mt-8 mb-3">
            Why Cleaned &amp; Gutted Trout at ₹580/kg is the Smart Choice
          </h3>
          <p className="text-sm leading-relaxed font-sans mb-4">
            Whole trout contains approximately 15%–18% internal viscera weight. When local market vendors sell &ldquo;whole trout&rdquo; at ₹650 and clean it afterwards, your effective pan-ready cost exceeds ₹770 per kg.
          </p>
          <p className="text-sm leading-relaxed font-sans mb-6">
            At Urban Trout, our Cleaned &amp; Gutted rate is just ₹580 per kg. You receive 100% pristine, pan-ready meat descaled with cold groundwater rinse, delivering maximum value with zero prep time.
          </p>
        </section>

        {/* FAQs */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mb-6">
            Frequently Asked Questions: Srinagar Trout Pricing
          </h2>
          <div className="space-y-4">
            {priceFaqs.map((faq, idx) => (
              <div key={idx} className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
                <h3 className="text-base font-bold text-cyan-200 font-['Space_Grotesk'] mb-2">{faq.q}</h3>
                <p className="text-xs md:text-sm text-slate-400 font-sans leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Next Guides Nav */}
        <div className="p-8 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">Ready to Cook Kashmiri Style?</h3>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Learn our authentic mustard oil, dried ginger (shonth), and fennel marinade.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/kashmiri-trout-recipe"
              className="py-2.5 px-5 rounded-lg text-xs font-bold font-['Space_Grotesk'] bg-slate-800 text-cyan-300 hover:bg-slate-700 transition-colors"
            >
              Recipe Guide →
            </Link>
            <Link
              href="/shop"
              className="py-2.5 px-5 rounded-lg text-xs font-bold font-['Space_Grotesk'] bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              Order Now →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
