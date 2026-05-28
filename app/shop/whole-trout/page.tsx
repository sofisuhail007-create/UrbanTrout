import type { Metadata } from "next";
import AddToCartButton from "@/components/AddToCartButton";

export const metadata: Metadata = {
  title: "Whole Rainbow Trout (Non-Gutted)",
  description:
    "Untouched and pristine rainbow trout, straight from our crystal-clear waters. Ideal for roasting or traditional preparations.",
};

export default function WholeTroutPage() {
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
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfyCpJNmCwVzBHTZw6kqPtCRfTVXNYWrm9Ixqy89okmBbaSGqKYMtEAZ5Jwv4MOwZIKpC3ugBZ1ISA5EfIUrq2lWmta28vvGV-ygjESie53QYIOJoDMgX9cJJWH5V960DeAviDBjjohZeT4WWrdrHC0tY2VnrZZsvftETpZ8ocCU2eupUdyTEoqKa8lgPe2dIHnERZTds7HMPfLKCtr56KHLPC08YZCzexEINcVe6nIrChDatBpMYRAOjGBVKCP2WsVyZicAZsG-kB"
              alt="Whole Rainbow Trout"
            />
            <div className="absolute bottom-6 left-6 flex gap-3">
              <span className="px-3 py-1 bg-surface-container-highest/80 backdrop-blur-md rounded text-[10px] uppercase tracking-widest font-label text-primary">
                Batch ID: UT-992-R
              </span>
              <span className="px-3 py-1 bg-surface-container-highest/80 backdrop-blur-md rounded text-[10px] uppercase tracking-widest font-label text-primary">
                PH Level: 7.2
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              "https://lh3.googleusercontent.com/aida-public/AB6AXuDcmSV_cdylrxXiBNmQvRZ2BKJU_a1m3slJm4NgMgtcEWXg9q5uRp1RQTVENbxTH6_4JyvosNNbD4MS8qln0r94oVYVIfIGXoLUQuVReHoKgzpK2eZw-6vgCXPIgSw-SsOEWJpiHfyDIHwTKBohp5Wf5nbM-dtELMicdCPC8RumjYPcZ_RlDRmJF98hNh8heNGAhPFTfe-Ooi25w6vbLqP0QUDYDpb-JFzjYDEa1X6ddVaLOzks2DJVQC9TD6rnA-IHsmuUKeddbEFv",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuBd5lVg_5xsB-_LMZKBeqMjyh-HiynvebbPjJD3o8AFUP6e_Io5X0rmsANLLhRHuJenYk_Cqk24nCNcSKeShZznuuSU4TusiYgVzCmot0FYnfFCu1WRLmzYGJ2-l_FYAjyDN3Gv3uHFqASLo2kRbyz7HxXNeYkjRr-H1o_dCjkUrrRB9ft2FNV7R4vRERHj6Byf34nfSE3Hd70PrUSxdTpyKe5Gr3UnPNkyBpeKucjhd4vHq85_kiEtPXMctqAgbI0PpSFIbBVYwctQ",
              "https://lh3.googleusercontent.com/aida-public/AB6AXuAT1vwPaZSfiYdMfFy9DFvN52q73RQFbYqLJdKsJjuGpXS18wB_fPvgu4683RIdUxq7MhHJFBD_e84istQKcaiNHWsc8ScXGGjt6SyRUfuwY91LLAb8ECRF2NdT_eO3ud1xAYNQHcz0lwIjhd8TB_QG4_6I-USJXcwxMavIRVNkj01zhUJyitqT9vhLsFW-jdPdP1OyG66wISKFWdaOjuDSUusbUWR1ODFXUE71CoxbuFKxDL-ScGfqWFSk0vF_lvTm8t3bsdHcULCH",
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
              Freshwater Specimen
            </p>
            <h1 className="font-headline text-4xl md:text-5xl font-bold tracking-tighter text-on-surface leading-tight">
              Whole Rainbow Trout (Non-Gutted)
            </h1>
          </div>


          <div className="p-6 bg-surface-container-low rounded-xl ghost-border space-y-4">
            <p className="text-on-surface-variant leading-relaxed">
              Untouched and pristine, straight from our crystal-clear waters.
              Ideal for roasting or traditional preparations. This non-gutted
              specimen retains full physiological integrity for maximum flavor
              preservation, dispatched within 4 hours of harvest.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { icon: "science", label: "Lab Verified" },
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

          <div className="space-y-3">
            <label className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
              Select Mass (Kg)
            </label>
            <AddToCartButton
              productId="whole-trout"
              productName="Whole Rainbow Trout (Non-Gutted)"
              price={500}
              unit="Kg"
              image="https://lh3.googleusercontent.com/aida-public/AB6AXuCfyCpJNmCwVzBHTZw6kqPtCRfTVXNYWrm9Ixqy89okmBbaSGqKYMtEAZ5Jwv4MOwZIKpC3ugBZ1ISA5EfIUrq2lWmta28vvGV-ygjESie53QYIOJoDMgX9cJJWH5V960DeAviDBjjohZeT4WWrdrHC0tY2VnrZZsvftETpZ8ocCU2eupUdyTEoqKa8lgPe2dIHnERZTds7HMPfLKCtr56KHLPC08YZCzexEINcVe6nIrChDatBpMYRAOjGBVKCP2WsVyZicAZsG-kB"
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
              Precision Roasting
            </h2>
            <p className="text-on-surface-variant leading-relaxed mb-8">
              Because this trout is non-gutted, the interior temperature remains
              more stable during roasting. We recommend a high-heat quick sear
              followed by a 12-minute convection roast at 200°C.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-4 text-on-surface font-body">
                <span className="material-symbols-outlined text-primary">
                  check_circle
                </span>
                Preserves natural omega oils within the tissue
              </li>
              <li className="flex items-center gap-4 text-on-surface font-body">
                <span className="material-symbols-outlined text-primary">
                  check_circle
                </span>
                Maintains skeletal structure for presentation
              </li>
              <li className="flex items-center gap-4 text-on-surface font-body">
                <span className="material-symbols-outlined text-primary">
                  check_circle
                </span>
                Deeper, richer flavor profile compared to fillets
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
                  { label: "Nitrate", val: "< 5mg/L" },
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
