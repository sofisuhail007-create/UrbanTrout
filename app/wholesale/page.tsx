import type { Metadata } from "next";
import Link from "next/link";
import WholesaleForm from "@/components/WholesaleForm";

export const metadata: Metadata = {
  title: "Wholesale & B2B Inquiry",
  description:
    "Precision aquaculture for the valley's finest hotels and restaurants. Volume-optimized pricing, traceability, and 4-hour delivery for high-demand menus.",
};

export default function WholesalePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[716px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            className="w-full h-full object-cover opacity-40 grayscale-[0.5] brightness-[0.6]"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqL4AdMcX3pOhSpisaUJMYQ_Pkk4t2UuFF07Qx1ktNV8oTSrZJWVOSiFU9TkZk6nhHRd4qG05MXSu1-b3zHUbbgziW-fONRlhulc3KYVY0uKCWz_kxH34SbqQ2mWok8nPT3BgJvKQqzgMzfu4Yf3ss41kKJxD0S9ubbM6aoa4vpxaetaX0gjVg-gyq2hoky-uKJTb_xDDcYCWTS_RbuZVTkOnP1Kzr36rseOVZR1DVzGuEUFqXIrFLl4FVzMjlZrL-tKrQ_b65jhnQ"
            alt="Aquaculture facility cinematic"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        </div>
        <div className="relative z-10 max-w-screen-2xl mx-auto px-8 w-full">
          <div className="max-w-3xl">
            <span className="text-primary font-label tracking-[0.3em] uppercase text-xs mb-4 block">
              Srinagar&apos;s Premier Hospitality Partner
            </span>
            <h1 className="text-6xl md:text-8xl font-headline font-bold leading-tight tracking-tighter text-on-surface mb-6">
              From Mountain <br />
              <span className="text-primary neon-glow-text">
                Streams to Table.
              </span>
            </h1>
            <p className="text-on-surface-variant text-xl max-w-xl font-light leading-relaxed mb-8">
              Precision aquaculture for the valley&apos;s finest hotels and
              restaurants. Freshness, traceability, and volume-optimized pricing
              for high-demand menus.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#inquiry-form"
                className="bg-primary-container text-on-primary-container px-8 py-4 rounded-md font-label font-semibold flex items-center gap-2 hover:bg-primary transition-all duration-300 shadow-[0_0_15px_rgba(99,207,238,0.2)]"
              >
                Request Wholesale Access
                <span className="material-symbols-outlined text-lg">
                  arrow_forward
                </span>
              </a>
              <a
                href="#benefits"
                className="border border-outline-variant text-on-surface px-8 py-4 rounded-md font-label font-medium hover:bg-surface-variant/30 transition-all duration-300 backdrop-blur-sm"
              >
                Explore Benefits
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Bento */}
      <section className="py-24 px-8 max-w-screen-2xl mx-auto" id="benefits">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Large Feature */}
          <div className="md:col-span-2 glass-card p-10 rounded-xl overflow-hidden group relative">
            <div className="relative z-10">
              <div className="text-primary mb-6">
                <span
                  className="material-symbols-outlined text-5xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  eco
                </span>
              </div>
              <h3 className="text-3xl font-headline font-bold mb-4">
                Precision Traceability
              </h3>
              <p className="text-on-surface-variant text-lg max-w-md mb-8">
                Every trout delivered to your kitchen comes with a digital
                bio-passport. Verify harvest time, water oxygen levels, and feed
                composition in real-time.
              </p>
              <div className="flex gap-12 border-t border-outline-variant/30 pt-8">
                {[
                  { val: "04 Hours", label: "Harvest to Delivery" },
                  { val: "100%", label: "Pathogen Free" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <span className="block text-2xl font-bold text-primary font-headline">
                      {stat.val}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-on-surface-variant font-label">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 group-hover:opacity-20 transition-opacity duration-500">
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQ_YSWTXDHJTyfA1LBo5xy0LRT3ejVj9wpWHk2RC_8YgjO7gqfiYeO4PGixxN9XGY1kYqWOvVWawbGePKkhC6nUsNY0hNmF9IMQ1MEWlQYquAfTbmshdPuYeCzqnGQhlcePcsDss7Od4C-CG86J_IxKDhf0cahkaQRPIAUhORC8vCyRs86Tl8B2TghFnTch7GUnHNe327FFLV6rC0S2o_lHI7st8zsUPwiRonU7KCJLcsParDIl2pjNv_6qte8--7fz-UJZn5DNVtf"
                alt="Precision data"
              />
            </div>
          </div>

          {/* Small Feature 1 */}
          <div className="bg-surface-container-high p-8 rounded-xl flex flex-col justify-between hover:bg-surface-container-highest transition-colors duration-300">
            <div className="text-primary mb-4">
              <span className="material-symbols-outlined text-4xl">
                ac_unit
              </span>
            </div>
            <div>
              <h4 className="text-xl font-headline font-bold mb-2">
                Cold-Chain Ethics
              </h4>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Our proprietary logistics ensure the trout never leaves the
                1-3°C range until it hits your prep station.
              </p>
            </div>
          </div>

          {/* Small Feature 2 */}
          <div className="bg-surface-container-high p-8 rounded-xl flex flex-col justify-between hover:bg-surface-container-highest transition-colors duration-300">
            <div className="text-primary mb-4">
              <span className="material-symbols-outlined text-4xl">
                inventory_2
              </span>
            </div>
            <div>
              <h4 className="text-xl font-headline font-bold mb-2">
                Custom Scaling
              </h4>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                From 20kg boutique orders to 500kg daily hospitality contracts.
                We scale with your occupancy.
              </p>
            </div>
          </div>

          {/* Medium Feature */}
          <div className="md:col-span-2 glass-card p-10 rounded-xl flex flex-col md:flex-row gap-8 items-center">
            <div className="w-full md:w-1/2">
              <h3 className="text-3xl font-headline font-bold mb-4">
                The Urban Trout Advantage
              </h3>
              <ul className="space-y-4">
                {[
                  "Sustainably sourced from high-altitude springs.",
                  "Consistent yield & sizing for plating precision.",
                  "Exclusive seasonal cuts for premium dining rooms.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      className="material-symbols-outlined text-primary"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span className="text-on-surface-variant">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 rounded-lg overflow-hidden h-48">
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBVPm3dEqCdaHdoMtAV-k0nojI7xlT68JyKlx9elS1PYHwDiHzPyCIAsJG2Gno18pDXVhDHzPyCIAsJG2Gno18pDXVhDDKpOkvCIssVFX6Uq2sIkw8qyGF0NRnWI75kgH5KRC6of80ItfsjXsTvWvwDQ210OPfkDUcXOlKP6moGHF3q2zpcIt_Y7lWKA7rgxGk3QAmbJHty9ncqStZt-5dIYtHSI4vlKjQ_gD4ITBtNHaJxiA-kjrnUyfdx_qwPV3Uwau_sHwkgaHnM3aSolvilq-pc1M06YGNL2vn"
                alt="Chef preparing trout"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Tiers */}
      <section className="bg-surface-container-low py-24">
        <div className="max-w-screen-2xl mx-auto px-8">
          <div className="mb-16 text-center">
            <h2 className="text-4xl font-headline font-bold mb-4">
              Wholesale Volume Tiers
            </h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto">
              Dynamic pricing designed for the valley&apos;s diverse hospitality
              ecosystem.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                tier: "Boutique",
                name: "Culinary Tier",
                min: "25kg / Weekly",
                ideal: "Independent fine dining, specialty cafes.",
                note: "Customized harvesting schedule available.",
                featured: false,
              },
              {
                tier: "Hospitality",
                name: "Resort Tier",
                min: "100kg / Weekly",
                ideal: "Luxury hotels, large banquet halls.",
                note: "Priority harvest queue and 4-hour delivery guarantee.",
                featured: true,
              },
              {
                tier: "Enterprise",
                name: "Network Tier",
                min: "500kg / Monthly",
                ideal: "Hotel chains, wholesale distributors.",
                note: "Direct cold-chain integration and API inventory access.",
                featured: false,
              },
            ].map((t) => (
              <div
                key={t.tier}
                className={`p-8 rounded-lg relative overflow-hidden ${
                  t.featured
                    ? "bg-surface-container-high border border-primary/30"
                    : "border border-outline-variant/20 hover:border-primary/50 transition-all duration-300"
                }`}
              >
                {t.featured && (
                  <div className="absolute top-0 right-0 bg-primary text-on-primary px-4 py-1 text-[10px] font-bold uppercase tracking-tighter">
                    Most Popular
                  </div>
                )}
                <span className="text-xs font-label uppercase tracking-widest text-primary mb-4 block">
                  {t.tier}
                </span>
                <h4 className="text-2xl font-headline font-bold mb-6">
                  {t.name}
                </h4>
                <div className="space-y-2 mb-8 text-on-surface-variant">
                  <p>Minimum: {t.min}</p>
                  <p>Ideal for: {t.ideal}</p>
                </div>
                <div
                  className={`pt-6 border-t border-outline-variant/10 text-sm ${
                    t.featured ? "font-medium text-primary" : "italic opacity-60"
                  }`}
                >
                  {t.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry Form */}
      <section
        className="py-32 px-8 max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-start"
        id="inquiry-form"
      >
        <div>
          <h2 className="text-5xl font-headline font-bold mb-6 leading-tight">
            Elevate Your Menu with <br />
            <span className="text-primary neon-glow-text">
              Urban Trout Precision.
            </span>
          </h2>
          <p className="text-on-surface-variant text-lg mb-12 leading-relaxed">
            Our partnership team is ready to design a delivery protocol that fits
            your kitchen&apos;s unique rhythm. Fill out the form, and a dedicated
            account manager will reach out within 2 hours.
          </p>
          <div className="space-y-8">
            {[
              {
                icon: "call",
                label: "Immediate Direct Line",
                val: "+91 0194 882 110",
              },
              {
                icon: "pin_drop",
                label: "Production Hub",
                val: "Harwan High-Altitude Lab, Srinagar",
              },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">{c.icon}</span>
                </div>
                <div>
                  <p className="text-xs uppercase text-on-surface-variant font-label tracking-widest">
                    {c.label}
                  </p>
                  <p className="text-xl font-headline">{c.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-12 rounded-xl">
          <WholesaleForm />
        </div>
      </section>
    </div>
  );
}
