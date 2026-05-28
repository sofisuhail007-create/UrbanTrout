import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Farm | Precision Aquaculture",
  description:
    "Srinagar's first Recirculating Aquaculture System — clinical, pollution-free, sustainable.",
};

const C = {
  bg: "#031018", bgLow: "#06151e", bgHigh: "#10212c", bgHighest: "#152834",
  primary: "#72ddfd", primaryCont: "#3aadcc", onPrimCont: "#002730",
  onSurface: "#dfedf9", onSurfVar: "#9fadb8", outline: "#6a7782", outlineVar: "#3d4a53",
};

export default function OurFarmPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      {/* ── Hero ── */}
      <section style={{ position: "relative", paddingTop: "9rem", paddingBottom: "6rem", paddingLeft: "1.5rem", paddingRight: "1.5rem", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "20%", right: "0", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(114,221,253,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <div>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "1.25rem" }}>Precision Aquaculture</span>
            <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(3rem, 6vw, 5.5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9, color: C.onSurface, margin: "0 0 1.75rem" }}>
              The Future of{" "}
              <span style={{ color: "#63cfee", textShadow: "0 0 30px rgba(99,207,238,0.4)" }}>Purity.</span>
            </h1>
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "1.1rem", color: C.onSurfVar, lineHeight: 1.75, margin: "0 0 2.5rem", maxWidth: "480px" }}>
              We&apos;ve reimagined the relationship between environment and flavor. Deep within Srinagar, our Recirculating Aquaculture System creates a clinical, pollution-free sanctuary for premium trout.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <a href="#purity-cycle" style={{ padding: "13px 28px", borderRadius: "8px", background: C.primaryCont, color: C.onPrimCont, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.875rem", textDecoration: "none", boxShadow: "0 0 20px rgba(58,173,204,0.3)" }}>Explore the Tech</a>
              <Link href="/traceability" style={{ padding: "13px 28px", borderRadius: "8px", border: "1px solid rgba(114,221,253,0.15)", color: C.onSurface, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: "0.875rem", textDecoration: "none", background: "rgba(255,255,255,0.03)" }}>View Lab Reports</Link>
            </div>
          </div>

          {/* Hero image */}
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(114,221,253,0.15)", borderRadius: "18px", transform: "rotate(2deg)" }} />
            <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjxUcblURhTrP1CWfLxzenmfIH8NxsCNoca6Jl9lTR42DileafFoh7Zuc_MVvxSsAyokdscU5c0gorZNdDZSkT8NgkPGTeQjp3x8zZgJ0KhRXfPl8fYIkxTfX4i7cMTIW4GNQt-L7T0J4p2OZlKdBKkc8iqSpWGw506uCFoZMHD_kgEZhVqw3KrrU-Rhm8A_fPEb0yYOHvwHooaJHoHcEam4MgrT2xXP08FHGo-jsgthIzqT94lD_-ZreNGtwnkFsoNIHDAOeRUQSX"
                alt="Aquaculture lab"
                style={{ width: "100%", height: "400px", objectFit: "cover", opacity: 0.7 }}
              />
              {/* Status overlay */}
              <div style={{ position: "absolute", bottom: "1.5rem", left: "1.5rem", right: "1.5rem", padding: "1rem 1.25rem", background: "rgba(6,21,30,0.85)", backdropFilter: "blur(16px)", borderRadius: "10px", border: "1px solid rgba(114,221,253,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.primary, boxShadow: "0 0 8px #72ddfd" }} />
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>System Online</span>
                </div>
                <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "1.1rem", color: C.onSurface }}>12.4°C Groundwater Flow</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Purity Cycle ── */}
      <section id="purity-cycle" style={{ padding: "6rem 1.5rem", background: C.bgLow, borderTop: "1px solid rgba(114,221,253,0.07)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ marginBottom: "3.5rem" }}>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: "0 0 0.75rem" }}>The Purity Cycle</h2>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, maxWidth: "520px", lineHeight: 1.7, margin: 0 }}>Our proprietary RAS technology continuously filters and rejuvenates mountain groundwater, eliminating contaminants found in open-river farming.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
            {/* Filtration — large */}
            <div style={{ padding: "2.5rem", borderRadius: "16px", background: C.bgHigh, border: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "340px" }}>
              <div>
                <span className="material-symbols-outlined" style={{ fontSize: "36px", color: C.primary, marginBottom: "1.25rem", display: "block", filter: "drop-shadow(0 0 8px rgba(114,221,253,0.5))" }}>filter_alt</span>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.625rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>0.01 Micron Filtration</h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, lineHeight: 1.7, maxWidth: "480px", margin: 0, fontSize: "0.9rem" }}>Multi-stage filtration removes all sedimentary impurities. UV sterilization and ozone treatments ensure biological sterility before water reaches the tanks.</p>
              </div>
              {/* Bar chart decoration */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "60px", marginTop: "1.5rem" }}>
                {[40, 65, 30, 80, 55, 90, 45, 70].map((h, i) => (
                  <div key={i} style={{ flex: 1, borderRadius: "3px 3px 0 0", background: i === 3 || i === 5 ? "linear-gradient(to top, #3aadcc, #72ddfd)" : "rgba(114,221,253,0.15)", height: `${h}%`, boxShadow: (i === 3 || i === 5) ? "0 0 8px rgba(114,221,253,0.4)" : "none" }} />
                ))}
              </div>
            </div>

            {/* Temperature */}
            <div style={{ padding: "2.5rem", borderRadius: "16px", background: C.bgHigh, border: "1px solid rgba(255,255,255,0.04)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <span className="material-symbols-outlined" style={{ fontSize: "36px", color: C.primary, marginBottom: "1.25rem", display: "block" }}>thermostat</span>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>Thermal Stability</h3>
                <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontSize: "0.85rem", lineHeight: 1.65, margin: 0 }}>Constant 12.4°C mimics optimal mountain spring conditions for peak metabolic growth.</p>
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
                <div style={{ width: "110px", height: "110px", borderRadius: "50%", border: "3px dashed rgba(114,221,253,0.25)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 30px rgba(114,221,253,0.1)" }}>
                  <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 700, color: C.onSurface }}>12.4°</span>
                </div>
              </div>
            </div>

            {/* Oxygen */}
            <div style={{ padding: "2.5rem", borderRadius: "16px", background: C.bgHigh, border: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: C.primary, marginBottom: "1.25rem", display: "block" }}>air</span>
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>Oxygen Saturation</h3>
              <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontSize: "0.85rem", lineHeight: 1.65, margin: "0 0 1.25rem" }}>Supersaturated oxygen levels create lean, energetic fish with superior muscle density.</p>
              <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: "94%", background: "linear-gradient(90deg, #3aadcc, #72ddfd)", boxShadow: "0 0 10px rgba(114,221,253,0.5)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontFamily: '"Inter", sans-serif', fontSize: "10px", color: C.primary, letterSpacing: "0.1em" }}>
                <span>O₂ LEVEL</span><span>94% SATURATION</span>
              </div>
            </div>

            {/* Circular water */}
            <div style={{ padding: "2.5rem", borderRadius: "16px", background: C.bgHigh, border: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "36px", color: C.primary, marginBottom: "1.25rem", display: "block" }}>recycling</span>
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 700, color: C.onSurface, margin: "0 0 0.75rem" }}>Circular Economy</h3>
              <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontSize: "0.85rem", lineHeight: 1.65, margin: 0 }}>99% water recycled every 24 hours. Waste repurposed as organic fertilizer — net-zero valley footprint.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bio Security ── */}
      <section style={{ padding: "6rem 1.5rem", background: C.bg, borderTop: "1px solid rgba(114,221,253,0.07)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: "-40px", left: "-40px", width: "200px", height: "200px", background: "radial-gradient(circle, rgba(114,221,253,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ padding: "2px", borderRadius: "20px", background: "linear-gradient(135deg, rgba(114,221,253,0.15), rgba(114,221,253,0.03))", position: "relative" }}>
              <div style={{ borderRadius: "18px", overflow: "hidden", background: C.bgHigh }}>
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAnTdh6PR2eopu_Ol_RXqnt1PFRyuMlYoLImxdiByTFewGp-WsEVWw27Rx-TuaeGYUEFiYs6uyPCVppAHHscqAGo2lBcwfKBC6t-jIJG7FVy6ASCDzzEIPfUcEF5C-6hPmpMWJFaaDzepgQ7Co0gEoIDW10IRQchBLWmaNQ4NYh-1AbTz15i-Fpr7Nz4BscX3A2v72PHNojY4ko5QOrKNs-R9SWd6qu6LvkWjZCvF5_enNQVlS2aod1APQ0WV4asc30YVNvqUofkG3Q"
                  alt="Biosecurity"
                  style={{ width: "100%", height: "380px", objectFit: "cover", opacity: 0.5, mixBlendMode: "overlay" }}
                />
              </div>
            </div>
          </div>

          <div>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: "0 0 2.5rem" }}>Clinical Bio-Security</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {[
                { icon: "verified", title: "Pathogen Exclusion", desc: "Closed systems prevent wild parasites and viruses, eliminating the need for antibiotics." },
                { icon: "science", title: "Daily Lab Analysis", desc: "Hourly water chemistry checks and bi-weekly meat quality assays in our on-site laboratory." },
                { icon: "shield", title: "Zero Environmental Leakage", desc: "No physical contact with external waterways, protecting native valley species." },
              ].map(item => (
                <div key={item.title} style={{ display: "flex", gap: "1.25rem" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(114,221,253,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: "20px", color: C.primary }}>{item.icon}</span>
                  </div>
                  <div>
                    <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "1.05rem", color: C.onSurface, margin: "0 0 0.4rem" }}>{item.title}</h4>
                    <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.875rem", color: C.onSurfVar, lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Product CTA ── */}
      <section style={{ padding: "5rem 1.5rem", background: C.bgLow, borderTop: "1px solid rgba(114,221,253,0.07)" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: "0 0 0.5rem" }}>Experience the Purity</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {[
              { href: "/shop/gutted-trout", label: "LIMITED BATCH", title: "Gutted Srinagar Trout", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBxZybEV-ayfzChDWIOUrK_DIe3AhpmGR6ex62I0Uuu4VWmKvN_dRATXjhDl4KnaeVtPjfqAYheK1p9DEmBWhpeFO5z-ZaCcL5riNBaPDwieXcP1OQelhH03ORXkDaAgKO69w8bfPIRg-D9W18bQYVd6t-99s3_69bw2GlEqoqhRqHZX7MpD47UGHrepWHYuX2KCBpIvsMVWsSnzN3EdQUiwghP8X-O0H7F5Cl07ehM-SW_LWdUxp2N_vEQIfjStm0iHHwNZs5pC3mc" },
              { href: "/shop/whole-trout", label: "FARM GATE", title: "Whole Rainbow Trout", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6az_W5rdEt8WkOzLnn861EIuB2tv1E9ZBuYuxXAnLFmG7ZsCCb0WyuI___JpO7YjI9Vf_XYBLXYanCVvdJyrbf-CarB6-5xxisc34AV5zB1gV5AElNc-POwd_DAA12ADx0vUX87WKN2GVXZapRsMugASCSZsBjri-8d9uI957NqfLv1Hau8-DgJfLrNJoRtSKwJo6uFM1V-GDVCSznDSww8vBl8jD_s-iPkmhUcOhQ6ekndTbbBSJCBon4pCpkvihVwAcuF4JCTVc" },
            ].map(p => (
              <Link key={p.href} href={p.href} className="group" style={{ position: "relative", borderRadius: "16px", overflow: "hidden", display: "block", textDecoration: "none", aspectRatio: "4/3" }}>
                <img src={p.img} alt={p.title} className="group-hover:scale-105" style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.6s" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(3,16,24,0.85) 0%, transparent 55%)" }} />
                <div style={{ position: "absolute", bottom: "1.75rem", left: "1.75rem" }}>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "0.4rem" }}>{p.label}</span>
                  <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.4rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>{p.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
