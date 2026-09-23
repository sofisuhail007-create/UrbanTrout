import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bulk & Wholesale Trout Supply in Srinagar | Urban Trout",
  description:
    "Direct producer wholesale supply of fresh Rainbow Trout for Srinagar restaurants, hotels, weddings, and caterers. GST invoices, cold-chain delivery, and bulk rates from 10 kg.",
  alternates: {
    canonical: "https://urbantrout.in/bulk",
  },
  openGraph: {
    title: "Bulk & Wholesale Trout Supply in Srinagar | Urban Trout",
    description:
      "Farm-direct wholesale Rainbow Trout supply for Srinagar restaurants and caterers. Guaranteed live harvest, GST invoicing, and early morning doorstep delivery.",
    url: "https://urbantrout.in/bulk",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Bulk Rainbow Trout Supply Srinagar - Urban Trout",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
};

const C = {
  bg: "#031018",
  bgLow: "#06151e",
  bgHigh: "#10212c",
  primary: "#72ddfd",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
};

const bulkJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Bulk Wholesale Rainbow Trout Supply Srinagar",
  "description": "Commercial trout supply for restaurants, hotels, caterers, and wazwan events in Srinagar with GST invoicing.",
  "publisher": {
    "@type": "Organization",
    "name": "Urban Trout",
    "url": "https://urbantrout.in",
  },
};

export default function BulkSupplyPage() {
  const whatsappUrl =
    "https://wa.me/918491006127?text=" +
    encodeURIComponent("Hi Urban Trout! I am inquiring about commercial bulk supply for my restaurant/event in Srinagar.");

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="pt-28 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bulkJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6 font-mono" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-cyan-300">Home</Link>
          <span>/</span>
          <span className="text-cyan-400">Bulk &amp; Wholesale Supply</span>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold font-mono">
            B2B Commercial &amp; Catering Channel
          </span>
          <h1
            style={{ fontFamily: '"Space Grotesk", sans-serif', color: C.onSurface }}
            className="text-3xl md:text-5xl font-extrabold tracking-tight mt-3 mb-5 leading-tight"
          >
            Bulk Rainbow Trout Supply in Srinagar for Restaurants &amp; Events
          </h1>
          <p
            style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar }}
            className="text-base md:text-lg leading-relaxed"
          >
            Direct commercial cold-water aquaculture partnership for Srinagar restaurateurs, hotel chefs, wazwan caterers, and wedding planners. Freshly harvested to schedule with guaranteed cold-chain temperature control and GST invoicing.
          </p>
        </header>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-2xl">⚡</span>
            <h2 className="text-base font-bold text-white font-['Space_Grotesk'] mt-3 mb-1">Pre-Dawn Harvest</h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Harvested from Malabagh tanks at 6:00 AM and delivered to your kitchen door before 9:00 AM prep window.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-2xl">🧾</span>
            <h2 className="text-base font-bold text-white font-['Space_Grotesk'] mt-3 mb-1">GST Tax Invoices</h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Fully compliant commercial billing with GST tax invoice provided for formal business input accounting.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
            <span className="text-2xl">🧊</span>
            <h2 className="text-base font-bold text-white font-['Space_Grotesk'] mt-3 mb-1">Sub-2°C Cold Chain</h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Packed in food-grade insulated tubs with hygienic crushed ice. Zero drip-loss or flesh degradation.
            </p>
          </div>
        </div>

        {/* Commercial Specifications Table */}
        <section className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 mb-12 shadow-2xl">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold">Wholesale Tiers</span>
          <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mt-2 mb-4">
            Commercial Supply Parameters &amp; Pricing
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 mb-6">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-900 text-slate-300 border-b border-slate-800 font-['Space_Grotesk']">
                <tr>
                  <th className="p-4">Volume Tier</th>
                  <th className="p-4 text-cyan-300">Minimum Order</th>
                  <th className="p-4">Delivery Window</th>
                  <th className="p-4">Target Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-sans">
                <tr>
                  <td className="p-4 font-bold text-white">Daily Restaurant Supply</td>
                  <td className="p-4">5 Kg – 15 Kg daily</td>
                  <td className="p-4">7:00 AM – 9:30 AM</td>
                  <td className="p-4 font-bold text-emerald-400">Competitive Contract Rates</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">Event / Wedding Lot</td>
                  <td className="p-4">25 Kg – 100+ Kg</td>
                  <td className="p-4">Scheduled 2h prior to cooking</td>
                  <td className="p-4 font-bold text-emerald-400">Direct Producer Discount</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-white">Bulk Cleaned &amp; Gutted</td>
                  <td className="p-4">10 Kg minimum</td>
                  <td className="p-4">Same-day iced delivery</td>
                  <td className="p-4 font-bold text-emerald-400">100% Pan-Ready (No waste)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Unlike intermediary directories charging ₹650–₹1,000/kg plus freight for frozen stock, Urban Trout gives your kitchen restaurant-grade, live-harvested trout that flakes with unbeatable sweet moisture.
          </p>
        </section>

        {/* Contact Farm Desk Directly */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-cyan-950/70 to-slate-900 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-white font-['Space_Grotesk']">Speak with our Commercial Harvest Lead</h3>
            <p className="text-xs text-slate-400 font-sans">
              Connect directly with Skindar Mohd Sideeq at our Malabagh farm desk.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="tel:+918491006127"
              className="py-3 px-5 rounded-xl text-xs font-bold font-['Space_Grotesk'] bg-slate-800 text-cyan-300 hover:bg-slate-700 transition-colors font-mono"
            >
              📞 +91 84910 06127
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3 px-6 rounded-xl text-xs font-bold font-['Space_Grotesk'] bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors uppercase tracking-wider"
            >
              WhatsApp Inquiries ⚡
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
