import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Cook Kashmiri-Style Trout: Authentic Pan-Fry & Mujh Gaad | Urban Trout",
  description:
    "Master cooking fresh Rainbow Trout the authentic Kashmiri way. Mustard oil, dried ginger (shonth), and fennel (saunf) marinade, crispy pan-fry, and classic Mujh Gaad.",
  alternates: {
    canonical: "https://urbantrout.in/kashmiri-trout-recipe",
  },
  openGraph: {
    title: "How to Cook Kashmiri-Style Trout: Pan-Fry & Mujh Gaad | Urban Trout",
    description:
      "Traditional Kashmiri trout recipes: mustard oil sear, shonth & saunf marinade, and Mujh Gaad. Pan-ready trout delivered fresh in Srinagar.",
    url: "https://urbantrout.in/kashmiri-trout-recipe",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Kashmiri Style Trout Cooking - Urban Trout",
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

const recipeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Recipe",
      "name": "Crispy Kashmiri Pan-Fried Rainbow Trout",
      "description": "Authentic Kashmiri style pan-fried Rainbow Trout seared in smoking mustard oil with dried ginger (shonth), ground fennel (badiyan), and Kashmiri deghi chili.",
      "image": "https://urbantrout.in/images/gutted_trout_premium.webp",
      "author": {
        "@type": "Person",
        "name": "Skindar Mohd Sideeq",
      },
      "cookTime": "PT10M",
      "prepTime": "PT15M",
      "totalTime": "PT25M",
      "recipeYield": "4 servings",
      "recipeCuisine": "Kashmiri",
      "recipeCategory": "Main Course",
      "keywords": "kashmiri trout recipe, pan fried trout kashmir, mujh gaad, trout fish marinade",
      "recipeIngredient": [
        "1 kg Cleaned & Gutted Rainbow Trout (from Urban Trout)",
        "3 tablespoons pure cold-pressed Kashmiri mustard oil (Kaer tuel)",
        "1 teaspoon dried ginger powder (shonth)",
        "1.5 teaspoons ground fennel powder (badiyan / saunf)",
        "1 teaspoon Kashmiri red chili powder (deghi mirch)",
        "0.5 teaspoon turmeric powder (haldi)",
        "1 teaspoon sea salt or Himalayan pink salt",
        "1 lemon, sliced into wedges for serving"
      ],
      "recipeInstructions": [
        {
          "@type": "HowToStep",
          "name": "Prepare the Trout",
          "text": "Pat the cleaned & gutted trout completely dry with a clean kitchen towel. Make 2-3 shallow diagonal slits across each side of the fish to allow aromatics to penetrate.",
        },
        {
          "@type": "HowToStep",
          "name": "Apply the Kashmiri Spice Rub",
          "text": "In a small bowl, blend shonth (dried ginger), badiyan (fennel powder), deghi mirch, turmeric, salt, and 1 tablespoon of mustard oil into a wet rub. Massage gently into the fish cavity and skin. Rest for 15 minutes.",
        },
        {
          "@type": "HowToStep",
          "name": "Heat the Mustard Oil",
          "text": "Heat 2 tablespoons of mustard oil in a heavy-bottomed iron skillet or cast iron pan until lightly smoking, then reduce flame to medium. This eliminates pungent raw mustard fumes.",
        },
        {
          "@type": "HowToStep",
          "name": "Sear to Crispy Perfection",
          "text": "Carefully place trout in the pan. Sear undisturbed for 4 to 5 minutes until skin turns golden and shatteringly crisp. Gently flip and sear the other side for another 3 to 4 minutes until flesh flakes easily with a fork.",
        },
        {
          "@type": "HowToStep",
          "name": "Debone and Serve",
          "text": "Transfer to a serving platter, squeeze fresh lemon over the top, and serve hot with Kashmiri saffron rice or steamed basmati. Lift the single central backbone out effortlessly in one piece before eating.",
        }
      ],
    }
  ],
};

export default function KashmiriTroutRecipePage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="pt-28 pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(recipeJsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6 font-mono" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-cyan-300">Home</Link>
          <span>/</span>
          <span className="text-cyan-400">Kashmiri Trout Recipes</span>
        </nav>

        {/* Header */}
        <header className="mb-12">
          <span className="text-xs uppercase tracking-widest text-amber-400 font-bold font-mono">
            Kashmiri Culinary Heritage
          </span>
          <h1
            style={{ fontFamily: '"Space Grotesk", sans-serif', color: C.onSurface }}
            className="text-3xl md:text-5xl font-extrabold tracking-tight mt-3 mb-5 leading-tight"
          >
            How to Cook Kashmiri-Style Trout: Pan-Fry, Marinade &amp; Mujh Gaad
          </h1>
          <p
            style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar }}
            className="text-base md:text-lg leading-relaxed"
          >
            Because <Link href="/" className="text-cyan-400 font-semibold underline hover:text-cyan-300">fresh Rainbow Trout in Srinagar</Link> (<em className="text-cyan-300 font-serif">Oncorhynchus mykiss</em>) is naturally delicate, clean-tasting, and packed with healthy Omega-3 fats, Kashmiri home cooks never overpower it with heavy masalas. Here is the authentic guide to preparing trout like a true Kashmiri gourmet.
          </p>
        </header>

        {/* Feature Highlights: Bones & Nutrition */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-12">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xl">🦴</span>
            <h2 className="text-sm font-bold text-white font-['Space_Grotesk'] mt-2 mb-1">Single Central Spine</h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              No fine intramuscular &ldquo;Y-bones&rdquo;. Central backbone lifts cleanly out in one piece—100% child-safe.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xl">💪</span>
            <h2 className="text-sm font-bold text-white font-['Space_Grotesk'] mt-2 mb-1">20.5g Lean Protein</h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              High bioavailable protein and over 1,200mg Omega-3 fatty acids (EPA/DHA) per 100g serving.
            </p>
          </div>
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-xl">⚡</span>
            <h2 className="text-sm font-bold text-white font-['Space_Grotesk'] mt-2 mb-1">10-Minute Cook Time</h2>
            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Cooks in just 4 minutes per side. Microscopic scales turn into an ultra-crisp, savory skin.
            </p>
          </div>
        </div>

        {/* Recipe 1: Signature Pan-Fry */}
        <article className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 mb-12 shadow-2xl">
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono font-bold">Recipe #1 • Quick &amp; Crispy</span>
          <h2 className="text-2xl md:text-3xl font-bold text-white font-['Space_Grotesk'] mt-2 mb-4">
            Traditional Kashmiri Crispy Pan-Fried Trout
          </h2>
          <p className="text-sm text-slate-300 font-sans leading-relaxed mb-6">
            The definitive Kashmir valley method. Requires pure cold-pressed mustard oil, dried ginger, and fragrant fennel.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 font-['Space_Grotesk'] mb-3">
                Ingredients (Serves 4)
              </h3>
              <ul className="text-xs text-slate-300 space-y-2 font-sans">
                <li>• <strong>1 kg Cleaned &amp; Gutted Rainbow Trout</strong> (from Urban Trout)</li>
                <li>• <strong>3 tbsp Mustard Oil</strong> (<em className="text-amber-300">Kaer tuel</em>)</li>
                <li>• <strong>1 tsp Dried Ginger Powder</strong> (<em className="text-white">Shonth</em>)</li>
                <li>• <strong>1.5 tsp Fennel Powder</strong> (<em className="text-white">Badiyan / Saunf</em>)</li>
                <li>• <strong>1 tsp Kashmiri Deghi Mirch</strong></li>
                <li>• <strong>0.5 tsp Turmeric</strong> (<em className="text-white">Lidar</em>)</li>
                <li>• <strong>1 tsp Salt</strong> &amp; fresh lemon wedges</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 font-['Space_Grotesk'] mb-3">
                Why Shonth &amp; Badiyan?
              </h3>
              <p className="text-xs text-slate-400 font-sans leading-relaxed mb-3">
                In traditional Kashmiri Unani and Ayurvedic culinary science, cold-water trout is naturally cooling (<em className="text-slate-300">sard</em>). Warming spices like ginger (<em className="text-white">shonth</em>) and fennel (<em className="text-white">badiyan</em>) balance digestion while enhancing the trout&apos;s natural sweetness.
              </p>
              <span className="text-[11px] text-emerald-400 font-mono font-bold">Tip: Pat skin bone-dry before cooking for maximum crunch.</span>
            </div>
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-white font-['Space_Grotesk'] mb-4">
            Step-by-Step Cooking Method
          </h3>
          <ol className="text-xs text-slate-300 space-y-3 font-sans list-decimal pl-4">
            <li><strong>Score:</strong> Make 2–3 light shallow cuts across each side of the cleaned trout.</li>
            <li><strong>Rub:</strong> Mix shonth, badiyan, deghi mirch, turmeric, salt, and 1 tbsp mustard oil. Rub thoroughly into skin and cavity. Let rest 15 minutes.</li>
            <li><strong>Smoke Oil:</strong> Heat remaining mustard oil in a heavy cast-iron skillet until it just starts to smoke, then reduce flame to medium.</li>
            <li><strong>Sear:</strong> Place trout in hot skillet. Sear undisturbed for 4 minutes until golden and crisp. Flip gently and cook 3 minutes on the reverse side.</li>
            <li><strong>Serve:</strong> Squeeze fresh lemon juice over the fish and serve piping hot with steamed rice.</li>
          </ol>
        </article>

        {/* Recipe 2: Kashmiri Mujh Gaad */}
        <article className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 mb-12 shadow-2xl">
          <span className="text-xs uppercase tracking-widest text-amber-400 font-mono font-bold">Recipe #2 • Winter Specialty</span>
          <h2 className="text-2xl md:text-3xl font-bold text-white font-['Space_Grotesk'] mt-2 mb-4">
            Kashmiri Mujh Gaad (Trout Slow-Simmered with Radish)
          </h2>
          <p className="text-sm text-slate-300 font-sans leading-relaxed mb-4">
            <em className="text-white font-semibold">Mujh Gaad</em> is the quintessential Kashmiri winter dish. Sweet, pungent Kashmiri winter radishes (<em className="text-amber-300">mujh</em>) absorb the rich omega juices of the trout, flavored with Kashmiri <em className="text-white">ver masala</em> cake.
          </p>
          <ul className="text-xs text-slate-300 space-y-2.5 font-sans mb-6">
            <li>1. Slice white radishes into 1-inch thick rounds. Shallow-fry in mustard oil until translucent and golden.</li>
            <li>2. Flash-fry whole or gutted trout pieces for 2 minutes to seal the delicate skin.</li>
            <li>3. In a deep degchi, combine fried radishes, trout, crushed <em className="text-white">ver masala</em>, dried ginger, and fennel with 1 cup of hot water.</li>
            <li>4. Simmer gently on low heat for 12 minutes until a silky, aromatic red gravy forms.</li>
          </ul>
        </article>

        {/* CTA to Order */}
        <div className="p-8 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold text-white font-['Space_Grotesk']">Get 100% Pan-Ready Trout Delivered</h3>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Descaled, gutted, and chilled on food-grade ice. Delivered within 2 hours anywhere in Srinagar.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/shop/gutted-trout"
              className="py-3 px-6 rounded-xl text-xs font-bold font-['Space_Grotesk'] bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors uppercase tracking-wider"
            >
              Order Gutted Trout (₹580/kg)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
