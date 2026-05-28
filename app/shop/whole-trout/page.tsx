import type { Metadata } from "next";
import AddToCartButton from "@/components/AddToCartButton";
import Link from "next/link";

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
              preservation.
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:h-[600px]">
          {/* RAS Purity Standards */}
          <div className="md:col-span-8 bg-surface-container-low rounded-2xl ghost-border p-10 flex flex-col justify-between relative overflow-hidden group">
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

          {/* Traceability */}
          <div className="md:col-span-4 bg-surface-container-high rounded-2xl ghost-border p-10 flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-primary-fixed">
                location_on
              </span>
              <h3 className="font-headline text-2xl font-bold">Traceability</h3>
            </div>
            <p className="text-on-surface-variant font-body">
              Scan your unique QR code on delivery to see the full life cycle,
              feed composition, and water chemistry logs of this specific trout
              specimen.
            </p>
            <div className="mt-auto pt-6 border-t border-outline-variant/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white p-1 rounded-lg">
                  <img
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBGZeUIOhVXUzpRmdtuLI5qbmDXihcy3y4QIbLKP9BVRs59TwAdltu4Gvupv58ozFBMUFDhNM5hEOzU9EnA76eYqYdXIMtH8mRSsYKQK0AsAf8lv99LUDpbXRMFnSIvJk1OnMGwE09ycYoX4vcSffDm_EqJLlk-d-c57PZqDfbAFXHxaBpon39wBZeQUoIAFFpfepbPX0MGbdd02J4LBefe7FnoQ18D7IrSRSJYkXYSNLT1wmlnKotG3ZBZ1rgGtO8XKHl96_8Quy8P"
                    alt="QR Code"
                  />
                </div>
                <div className="font-label text-xs space-y-1">
                  <p className="text-on-surface">UNIT_ID: 8820-X</p>
                  <p className="text-on-surface-variant">HARVEST: 12.04.24</p>
                  <p className="text-primary">VERIFIED ON CHAIN</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Culinary Notes */}
      <section className="mt-24">
        <div className="glass-panel p-12 rounded-3xl ghost-border grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="px-4 py-1.5 rounded-full bg-primary/20 text-primary font-label text-xs uppercase tracking-widest border border-primary/30">
              Culinary Lab Notes
            </span>
            <h2 className="font-headline text-4xl font-bold">
              Precision Roasting
            </h2>
            <p className="text-on-surface-variant leading-relaxed">
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
            </ul>
          </div>
          <div className="aspect-video rounded-2xl overflow-hidden ghost-border relative">
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7XSoc-m8iX2ot4lUGhn6M7uvRj3mdRPtD-4i7TqT6qUTxKKsCysBEB2SLvPditq1tu0KckXXbyrFSbz30WA8_EkMIgGzxZNWlkhXEorP4cx1OPMACz9ef9K-rXAtM556oAMR4mnhXDR-Q0k4WDbesmbyNFrqu4TYVsmsBE9cq8YNjiEozDNW9UJBHzaKMQZf-zSn5oPK2OkpZDOJPc3gmHPRxTxfo70eVUWRhGxvTte45aOsBzZSgyzFgiu5ocodX3Bax4vLnS06b"
              alt="Gourmet roasted whole fish"
            />
            <div className="absolute inset-0 bg-primary/10 mix-blend-color" />
          </div>
        </div>
      </section>
    </div>
  );
}
