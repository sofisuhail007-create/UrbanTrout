import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Spot Fresh Trout vs Stale Fish: Srinagar Buyer's Guide | Urban Trout",
  description:
    "Learn the 5 biological freshness tests for Rainbow Trout: clear eyes, crimson gills, firm flesh, and zero fishy odor. Compare Rainbow vs Brown Trout species in Kashmir.",
  alternates: {
    canonical: "https://urbantrout.in/fresh-trout-guide",
  },
  openGraph: {
    title: "How to Spot Fresh Trout vs Stale Fish in Srinagar | Urban Trout",
    description:
      "Biological freshness checklist for trout buyers in Srinagar. Eyes, gills, flesh resilience tests, Rainbow vs Brown Trout species science, and kid-safe bone anatomy.",
    url: "https://urbantrout.in/fresh-trout-guide",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Fresh Trout Inspection Guide - Urban Trout Srinagar",
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
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
};

const checklistJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Identify Fresh Trout vs Stale Fish: Biological Tests & Species Guide",
  "description": "Expert checklist on evaluating trout freshness, Rainbow vs Brown trout distinctions, and bone safety for family cooking in Srinagar.",
  "image": "https://urbantrout.in/og-image.jpg",
  "author": {
    "@type": "Person",
    "name": "Skindar Mohd Sideeq",
    "jobTitle": "Head Aquaculturist",
  },
  "publisher": {
    "@type": "Organization",
    "name": "Urban Trout",
    "logo": "https://urbantrout.in/sitelogo.png",
  },
  "datePublished": "2026-02-01T08:00:00+05:30",
  "dateModified": "2026-03-23T22:00:00+05:30",
  "mainEntityOfPage": "https://urbantrout.in/fresh-trout-guide",
};

export default function FreshTroutGuidePage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="pt-28 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(checklistJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6 font-mono" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-cyan-300">Home</Link>
          <span>/</span>
          <span className="text-cyan-400">Freshness &amp; Species Guide</span>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold font-mono">
            Aquaculture Knowledge &amp; Buyer Protection
          </span>
          <h1
            style={{ fontFamily: '"Space Grotesk", sans-serif', color: C.onSurface }}
            className="text-3xl md:text-5xl font-extrabold tracking-tight mt-3 mb-5 leading-tight"
          >
            How to Spot 100% Fresh Trout vs. Stale Market Fish
          </h1>
          <p
            style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar }}
            className="text-base md:text-lg leading-relaxed"
          >
            Because fish in local wet markets is frequently transported from remote streams or kept on melting municipal ice for days, knowing how to verify freshness is vital for flavor and family health. Here are the 5 biological tests used by professional aquaculturists.
          </p>
        </header>

        {/* 5 Biological Tests Comparison Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 mb-14 shadow-2xl">
          <table className="w-full text-left text-xs md:text-sm">
            <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 font-['Space_Grotesk']">
              <tr>
                <th className="p-4 md:p-5">Indicator</th>
                <th className="p-4 md:p-5 text-emerald-400 font-bold bg-emerald-950/20">Live Farm Fresh (Urban Trout)</th>
                <th className="p-4 md:p-5 text-rose-400 font-bold">Stale / Days-Old Market Fish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 font-sans">
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="p-4 md:p-5 font-bold text-white">1. Eyes</td>
                <td className="p-4 md:p-5 bg-emerald-950/10 text-emerald-300 font-medium">
                  Bulging, crystal-clear, transparent cornea with jet-black pupil.
                </td>
                <td className="p-4 md:p-5 text-slate-400">
                  Sunken, cloudy, dull, milky white or glazed appearance.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="p-4 md:p-5 font-bold text-white">2. Gills</td>
                <td className="p-4 md:p-5 bg-emerald-950/10 text-emerald-300 font-medium">
                  Vibrant ruby/crimson red, clean, moist, zero sticky slime.
                </td>
                <td className="p-4 md:p-5 text-slate-400">
                  Dull brownish-gray, pale pink, coated in thick sticky mucus.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="p-4 md:p-5 font-bold text-white">3. Flesh Bounce</td>
                <td className="p-4 md:p-5 bg-emerald-950/10 text-emerald-300 font-medium">
                  Firm, dense, and springy. Finger press bounces back instantly.
                </td>
                <td className="p-4 md:p-5 text-slate-400">
                  Soft, flabby, and waterlogged. Finger press leaves a permanent dent.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="p-4 md:p-5 font-bold text-white">4. Odor / Scent</td>
                <td className="p-4 md:p-5 bg-emerald-950/10 text-emerald-300 font-medium">
                  Fresh, clean mountain spring aroma. Zero fishy or ammonia smell.
                </td>
                <td className="p-4 md:p-5 text-slate-400">
                  Pungent, sour, sulfurous, or strong municipal chemical odor.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/40 transition-colors">
                <td className="p-4 md:p-5 font-bold text-white">5. Skin &amp; Colors</td>
                <td className="p-4 md:p-5 bg-emerald-950/10 text-emerald-300 font-medium">
                  Luminescent pink-red lateral band with distinct black spots.
                </td>
                <td className="p-4 md:p-5 text-slate-400">
                  Bleached, yellowed, dried-out or peeling skin.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 2: Species Comparison */}
        <section className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 mb-14">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold">Species Science</span>
          <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mt-2 mb-4">
            Rainbow Trout vs. Brown Trout in Kashmir
          </h2>
          <p className="text-sm text-slate-300 font-sans leading-relaxed mb-6">
            Both species belong to the Salmonidae family, introduced to Kashmir&apos;s waters in the early 1900s. However, their culinary and farming characteristics differ significantly:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-slate-950/70 border border-cyan-500/30">
              <h3 className="text-lg font-bold text-cyan-300 font-['Space_Grotesk'] mb-2">Rainbow Trout (Oncorhynchus mykiss)</h3>
              <ul className="text-xs text-slate-300 space-y-2 font-sans">
                <li>• <strong>Nicknamed:</strong> &ldquo;Himalayan Salmon&rdquo;</li>
                <li>• <strong>Flavor:</strong> Mild, sweet, clean, and non-fishy</li>
                <li>• <strong>Flesh:</strong> Succulent, delicate flakes with rich Omega-3 fat marbling</li>
                <li>• <strong>Aquaculture:</strong> Thrives in fast-flowing oxygenated raceways with zero antibiotics</li>
                <li>• <strong>Culinary use:</strong> Ideal for pan-frying, baking, and Kashmiri Mujh Gaad</li>
              </ul>
            </div>

            <div className="p-6 rounded-xl bg-slate-950/70 border border-slate-800">
              <h3 className="text-lg font-bold text-slate-300 font-['Space_Grotesk'] mb-2">Brown Trout (Salmo trutta)</h3>
              <ul className="text-xs text-slate-400 space-y-2 font-sans">
                <li>• <strong>Nicknamed:</strong> Wild River Trout</li>
                <li>• <strong>Flavor:</strong> Earthy, stronger gamey undertone</li>
                <li>• <strong>Flesh:</strong> Denser, firmer muscle texture</li>
                <li>• <strong>Habitat:</strong> Wild torrential upper-Himalayan streams; difficult to farm sustainably</li>
                <li>• <strong>Culinary use:</strong> Traditionally smoked or heavy curry preparation</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Bone Safety for Kids */}
        <section className="p-8 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 mb-14">
          <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono font-bold">Child &amp; Family Safety</span>
          <h2 className="text-2xl font-bold text-white font-['Space_Grotesk'] mt-2 mb-3">
            Why Rainbow Trout is the Safest Fish for Kids and Toddlers
          </h2>
          <p className="text-sm text-slate-300 font-sans leading-relaxed mb-4">
            Common local freshwater fish such as Kashmiri carp, Rohu, or Katla contain thousands of microscopic &ldquo;Y-shaped&rdquo; pin-bones deeply embedded within every muscle fiber. This makes them dangerous and frustrating for young children to eat.
          </p>
          <p className="text-sm text-slate-300 font-sans leading-relaxed mb-4">
            In contrast, Rainbow Trout has an <strong>uncomplicated, single central spine</strong> with soft, flexible ribs that attach only to the center. When you cook the trout:
          </p>
          <ul className="text-xs text-slate-300 space-y-2 font-sans pl-4 list-disc">
            <li>Slide a butter knife or fork down the central dorsal seam.</li>
            <li>Lift the head and spine: the entire bone structure comes out in <strong>one complete piece</strong>.</li>
            <li>Leaves two completely boneless, pure fillets of tender meat ready for children to enjoy safely.</li>
          </ul>
        </section>

        {/* CTAs */}
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white font-['Space_Grotesk']">Taste the Live Catch Difference</h3>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Harvested live upon order from our Malabagh farm. Free chilled delivery across Srinagar in 2 hours.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/trout-price-srinagar"
              className="py-3 px-5 rounded-xl text-xs font-bold font-['Space_Grotesk'] bg-slate-800 text-cyan-300 hover:bg-slate-700 transition-colors"
            >
              2026 Price List →
            </Link>
            <Link
              href="/shop"
              className="py-3 px-6 rounded-xl text-xs font-bold font-['Space_Grotesk'] bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors uppercase tracking-wider"
            >
              Order Fresh Catch →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
