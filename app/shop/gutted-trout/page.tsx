import type { Metadata } from "next";
import AddToCartButton from "@/components/AddToCartButton";
import { supabase } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Premium Gutted Rainbow Trout",
  description:
    "Expertly cleaned, gutted, and prepared for immediate cooking. Preserving flavor through precision cold-chain management.",
};

export default async function GuttedTroutPage() {
  const { data } = await supabase
    .from("inventory")
    .select("price_per_kg")
    .eq("product_id", "gutted-trout")
    .single();

  const price = data ? data.price_per_kg : 550;

  return (
    <div className="pt-36 pb-16 px-6 lg:px-12 max-w-7xl mx-auto">
      {/* Product Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Image Gallery */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="relative aspect-[4/3] bg-surface-container-low rounded-xl overflow-hidden ghost-border group">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent pointer-events-none" />
            <img
              className="w-full h-full object-cover mix-blend-luminosity hover:mix-blend-normal transition-all duration-700"
              src="/images/gutted_trout_premium.png"
              alt="Premium Gutted Rainbow Trout"
            />
            <div className="absolute bottom-6 left-6 flex gap-3">
              <span className="px-3 py-1 bg-surface-container-highest/80 backdrop-blur-md rounded text-[10px] uppercase tracking-widest font-label text-primary">
                Premium Gutted
              </span>
              <span className="px-3 py-1 bg-surface-container-highest/80 backdrop-blur-md rounded text-[10px] uppercase tracking-widest font-label text-primary">
                PH Level: 7.2
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              "/images/gutted_trout_detail_1_1779973776067.png",
              "/images/gutted_trout_detail_2_1779973796564.png",
              "/images/gutted_trout_detail_3_1779973815991.png",
            ].map((src, i) => (
              <div
                key={i}
                className="aspect-square bg-surface-container-high rounded-lg overflow-hidden ghost-border"
              >
                <img
                  className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  src={src}
                  alt={`Trout detail ${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          <div className="space-y-2">
            <p className="font-label text-primary-fixed uppercase tracking-[0.2em] text-xs">
              Premium Processed Specimen
            </p>
            <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tighter text-on-surface leading-tight">
              Premium Gutted Rainbow Trout
            </h1>
          </div>

          <div className="p-6 bg-surface-container-low rounded-xl ghost-border space-y-4">
            <p className="text-on-surface-variant leading-relaxed">
              Expertly cleaned, gutted, and prepared for immediate cooking.
              Preserving absolute freshness through precision cold-chain management. Our
              team ensures the fish is dispatched within 4 hours of
              harvest, maintaining peak texture and a mild, delicate flavor profile.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { icon: "eco", label: "Zero Antibiotics" },
                { icon: "restaurant", label: "Pan-Ready" },
              ].map((tag) => (
                <div key={tag.label} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-sm">
                    {tag.icon}
                  </span>
                  <span className="text-xs font-label text-on-surface-variant uppercase tracking-wider">
                    {tag.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
              Select Mass (Kg)
            </label>
            <AddToCartButton
              productId="gutted-trout"
              productName="Premium Gutted Rainbow Trout"
              price={price}
              unit="Kg"
              image="/images/gutted_trout_premium.png"
              showDynamicPrice={true}
            />
          </div>
        </div>
      </div>

      {/* Culinary & Nutritional Bento Box */}
      <section className="mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Culinary Notes */}
          <div className="glass-panel p-10 md:p-12 rounded-3xl ghost-border flex flex-col justify-center">
            <span className="px-4 py-1.5 w-fit rounded-full bg-primary/20 text-primary font-label text-xs uppercase tracking-widest border border-primary/30 mb-6">
              Culinary Lab Notes
            </span>
            <h2 className="font-headline text-3xl md:text-4xl font-bold mb-4 text-on-surface">
              Searing & Flaking
            </h2>
            <p className="text-on-surface-variant leading-relaxed mb-8">
              The gutted format maximizes direct heat transfer to the flesh. The absence of internal organs allows for a faster, more uniform cook. We recommend a high-heat pan sear with a compound butter baste.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-4 text-on-surface font-body">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                Mild, delicate flavor without earthy undertones
              </li>
              <li className="flex items-center gap-4 text-on-surface font-body">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                Flesh flakes beautifully upon contact with fork
              </li>
              <li className="flex items-center gap-4 text-on-surface font-body">
                <span className="material-symbols-outlined text-primary">check_circle</span>
                Skin crisps rapidly in high-heat environments
              </li>
            </ul>
          </div>

          {/* Nutritional Profile */}
          <div className="bg-surface-container-high rounded-3xl ghost-border p-10 md:p-12 relative overflow-hidden group">
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-primary/5 rounded-full blur-[100px] group-hover:bg-primary/10 transition-colors" />
            <div className="relative z-10 flex flex-col h-full">
              <span className="px-4 py-1.5 w-fit rounded-full bg-surface-variant text-on-surface-variant font-label text-xs uppercase tracking-widest border border-outline-variant/30 mb-6">
                Nutritional Excellence
              </span>
              <h2 className="font-headline text-3xl md:text-4xl font-bold mb-4 text-on-surface">
                Clinical Dietetics
              </h2>
              <p className="text-on-surface-variant leading-relaxed mb-8">
                Raised in pristine RAS environments, our trout are free from microplastics, heavy metals, and antibiotics, resulting in an exceptionally clean nutritional profile.
              </p>
              
              <div className="grid grid-cols-2 gap-4 md:gap-6 mt-auto">
                <div className="bg-surface-container-highest/50 rounded-xl p-4 border border-outline-variant/10">
                  <p className="font-label text-primary text-[10px] uppercase tracking-widest mb-1">Protein (Per 100g)</p>
                  <p className="font-headline text-3xl font-medium text-on-surface">20.5g</p>
                </div>
                <div className="bg-surface-container-highest/50 rounded-xl p-4 border border-outline-variant/10">
                  <p className="font-label text-primary text-[10px] uppercase tracking-widest mb-1">Omega-3 (EPA/DHA)</p>
                  <p className="font-headline text-3xl font-medium text-on-surface">1,200mg</p>
                </div>
                <div className="bg-surface-container-highest/50 rounded-xl p-4 border border-outline-variant/10">
                  <p className="font-label text-primary text-[10px] uppercase tracking-widest mb-1">Heavy Metals</p>
                  <p className="font-headline text-3xl font-medium text-on-surface">ND</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">Not Detected</p>
                </div>
                <div className="bg-surface-container-highest/50 rounded-xl p-4 border border-outline-variant/10">
                  <p className="font-label text-primary text-[10px] uppercase tracking-widest mb-1">Microplastics</p>
                  <p className="font-headline text-3xl font-medium text-on-surface">0.0%</p>
                  <p className="text-[10px] text-on-surface-variant uppercase tracking-wider mt-1">Lab Verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lab Systems Section */}
      <section className="mt-24 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="font-headline text-4xl font-bold text-on-surface">
              Submerged Laboratory Systems
            </h2>
            <p className="text-on-surface-variant mt-4 leading-relaxed">
              Our Recirculating Aquaculture Systems (RAS) represent the pinnacle
              of sustainable protein production, creating a closed-loop
              environment of clinical purity.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* RAS Purity Standards */}
          <div className="bg-surface-container-low rounded-2xl ghost-border p-10 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-primary/5 rounded-full blur-[100px] group-hover:bg-primary/10 transition-colors" />
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">
                    fluid_med
                  </span>
                </div>
                <h3 className="font-headline text-3xl font-bold">
                  RAS Purity Standards
                </h3>
              </div>
              <p className="text-xl text-on-surface-variant max-w-2xl font-light leading-relaxed">
                Every drop of water is filtered through 12 stages of mechanical
                and biological processing. We maintain ozone-sanitized
                environments that exceed international organic standards.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8">
                {[
                  { label: "Nitrate", val: "< 5ppm" },
                  { label: "Oxygen", val: "99.8%" },
                  { label: "UV Index", val: "High" },
                  { label: "Pesticides", val: "0.0%" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="font-label text-primary text-xs uppercase tracking-widest mb-2">
                      {stat.label}
                    </p>
                    <p className="font-headline text-3xl font-medium">
                      {stat.val}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
