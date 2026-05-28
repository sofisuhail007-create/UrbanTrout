import type { Metadata } from "next";
import AddToCartButton from "@/components/AddToCartButton";

export const metadata: Metadata = {
  title: "Premium Gutted Rainbow Trout",
  description:
    "Expertly cleaned, gutted, and prepared for immediate cooking. Preserving flavor through precision cold-chain management.",
};

export default function GuttedTroutPage() {
  return (
    <div className="pt-36 pb-16 px-6 lg:px-12 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Image */}
        <div className="lg:col-span-7">
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
        </div>

        {/* Info */}
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
              Preserving flavor through precision cold-chain management. Our
              team ensures the fish is ready for the pan within 4 hours of
              harvest.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { icon: "eco", label: "Zero Antibiotics" },
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

          <AddToCartButton
            productId="gutted-trout"
            productName="Premium Gutted Rainbow Trout"
            price={550}
            unit="Kg"
            image="/images/gutted_trout_premium.png"
            showDynamicPrice={true}
          />
        </div>
      </div>
    </div>
  );
}
