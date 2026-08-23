import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Farm | Fresh Trout in Srinagar",
  description:
    "Learn how we farm fresh, healthy rainbow trout in Srinagar using clean water recirculating systems. Zero antibiotics, harvested to order.",
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
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div style={{ position: "absolute", top: "20%", right: "0", width: "500px", height: "500px", background: "radial-gradient(circle, rgba(114,221,253,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "1.25rem" }}>Freshwater Aquaculture</span>
            <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2.75rem, 6vw, 4.75rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.95, color: C.onSurface, margin: "0 0 1.75rem" }}>
              Pure Water.<br />
              <span style={{ color: "#63cfee", textShadow: "0 0 30px rgba(99,207,238,0.4)" }}>Fresh Harvest.</span>
            </h1>
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "1.05rem", color: C.onSurfVar, lineHeight: 1.75, margin: "0 0 2.5rem", maxWidth: "480px" }}>
              Located in Srinagar at Malabagh, Naseem Bagh, our farm raises Rainbow Trout in clean, continuously filtered cold water. We farm with care, harvest only when you order, and deliver fresh to your door.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link href="/shop" style={{ padding: "13px 28px", borderRadius: "10px", background: C.primaryCont, color: C.onPrimCont, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.875rem", textDecoration: "none", boxShadow: "0 0 20px rgba(58,173,204,0.3)" }}>
                Shop Fresh Catch
              </Link>
              <a href="#how-we-farm" style={{ padding: "13px 28px", borderRadius: "10px", border: "1px solid rgba(114,221,253,0.2)", color: C.onSurface, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 600, fontSize: "0.875rem", textDecoration: "none", background: "rgba(255,255,255,0.03)" }}>
                How We Farm
              </a>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative">
            <div style={{ position: "absolute", inset: 0, border: "1px solid rgba(114,221,253,0.15)", borderRadius: "18px", transform: "rotate(2deg)" }} />
            <div className="relative rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjxUcblURhTrP1CWfLxzenmfIH8NxsCNoca6Jl9lTR42DileafFoh7Zuc_MVvxSsAyokdscU5c0gorZNdDZSkT8NgkPGTeQjp3x8zZgJ0KhRXfPl8fYIkxTfX4i7cMTIW4GNQt-L7T0J4p2OZlKdBKkc8iqSpWGw506uCFoZMHD_kgEZhVqw3KrrU-Rhm8A_fPEb0yYOHvwHooaJHoHcEam4MgrT2xXP08FHGo-jsgthIzqT94lD_-ZreNGtwnkFsoNIHDAOeRUQSX"
                alt="Urban Trout Farm in Srinagar"
                className="w-full h-80 md:h-96 object-cover opacity-85"
              />
              {/* Status overlay */}
              <div className="absolute bottom-5 left-5 right-5 p-4 rounded-xl" style={{ background: "rgba(6,21,30,0.88)", backdropFilter: "blur(16px)", border: "1px solid rgba(114,221,253,0.15)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: C.primary, boxShadow: "0 0 8px #72ddfd" }} />
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>Farm Active</span>
                </div>
                <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "1rem", color: C.onSurface }}>Malabagh, Srinagar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How We Farm ── */}
      <section id="how-we-farm" className="py-20 px-6" style={{ background: C.bgLow, borderTop: "1px solid rgba(114,221,253,0.07)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "0.5rem" }}>Our Process</span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: "0 0 0.75rem" }}>How We Farm Fresh Trout</h2>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, maxWidth: "560px", lineHeight: 1.7, margin: 0 }}>We use modern recirculating freshwater tanks to provide our fish with clean, continuous cold water currents, free from pollutants and mud.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Deep Borewell Water */}
            <div className="p-8 rounded-2xl flex flex-col gap-3" style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(114,221,253,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "24px" }}>💧</span>
              </div>
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.2rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>Deep Borewell Water</h3>
              <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, lineHeight: 1.7, fontSize: "0.88rem", margin: 0 }}>
                Our water comes from deep ground aquifers, completely isolated from surface runoff, open canal pollution, and seasonal mud.
              </p>
            </div>

            {/* Continuous Aeration & Filtration */}
            <div className="p-8 rounded-2xl flex flex-col gap-3" style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(114,221,253,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "24px" }}>💨</span>
              </div>
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.2rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>Oxygen-Rich Currents</h3>
              <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, lineHeight: 1.7, fontSize: "0.88rem", margin: 0 }}>
                Trout thrive in fast, cold water. Our tanks maintain high oxygen levels so the fish stay active, lean, and firm.
              </p>
            </div>

            {/* Zero Antibiotics */}
            <div className="p-8 rounded-2xl flex flex-col gap-3" style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(114,221,253,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "24px" }}>🌿</span>
              </div>
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.2rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>Zero Antibiotics</h3>
              <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, lineHeight: 1.7, fontSize: "0.88rem", margin: 0 }}>
                Because our water is continuously filtered and clean, our fish stay healthy naturally without needing preventative antibiotics.
              </p>
            </div>

            {/* Harvested to Order */}
            <div className="p-8 rounded-2xl flex flex-col gap-3" style={{ background: C.bgHigh, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(114,221,253,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "24px" }}>🐟</span>
              </div>
              <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.2rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>Harvested to Order</h3>
              <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, lineHeight: 1.7, fontSize: "0.88rem", margin: 0 }}>
                We don&apos;t keep fish sitting in cold storage. Once you confirm your order, we harvest, clean, chill in ice, and deliver directly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Farm Values ── */}
      <section className="py-20 px-6" style={{ background: C.bg, borderTop: "1px solid rgba(114,221,253,0.07)" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "1rem" }}>Our Promise</span>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2.25rem, 5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: C.onSurface, margin: "0 0 1.5rem" }}>
              What Makes Our<br />
              <span style={{ color: "#72ddfd" }}>Trout Taste Better?</span>
            </h2>
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "1rem", color: C.onSurfVar, lineHeight: 1.75, margin: "0 0 2rem" }}>
              Traditional market fish is often caught hours or days earlier and stored on melting ice. At Urban Trout, our fish is swimming in water just hours before it reaches your pan.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {[
                { title: "No Muddy Odor", desc: "Filtered water means clean gills and fresh, sweet flesh without riverbed taint." },
                { title: "Firm, Flaky Texture", desc: "Continuous swimming currents ensure firm muscle structure that flakes perfectly." },
                { title: "Same-Day Delivery in Srinagar", desc: "Delivered chilled within hours of harvest to preserve original moisture and flavor." },
              ].map(item => (
                <div key={item.title} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  <span style={{ color: C.primaryCont, fontSize: "16px", marginTop: "2px" }}>✓</span>
                  <div>
                    <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "1rem", color: C.onSurface, margin: "0 0 2px" }}>{item.title}</h4>
                    <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar, lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Image */}
          <div className="relative rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(114,221,253,0.15)" }}>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCs8Cf-c8I2mgJK97P70dN1ASvgBrTtnrds7ocR8HR0jAxFqFzx_HKUJcRiGBahaZFddGACw-AJIGjONIpDBorLw7p0pX7EqPw-IsXa6-_XwQZBoKdqB8wqKq_hVTzCTLw40Y13u8KZyEvpQx5wgeEg5X8ZTbVUrH4qSnAWs5jCvBRO5BDMbVkxarxbSPPCI-3Jr2WbRygAT6XXzhipUu-agJDbeoAqJsf8bD85wLI-u3jvghBmT0LVHp0o8rkRJ2I5tNGLtqlYw6nL"
              alt="Fish tanks"
              className="w-full h-80 md:h-[420px] object-cover"
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #031018 0%, transparent 60%)" }} />
            <div style={{ position: "absolute", bottom: "2rem", left: "2rem", right: "2rem" }}>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "1.25rem", color: C.onSurface }}>Urban Trout Farm</span>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar, margin: "4px 0 0" }}>Malabagh, Naseem Bagh, Srinagar</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Product CTA ── */}
      <section className="py-20 px-6" style={{ background: C.bgLow, borderTop: "1px solid rgba(114,221,253,0.07)" }}>
        <div className="max-w-7xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: C.onSurface, margin: "0 0 0.5rem" }}>Taste the Difference</h2>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontSize: "0.95rem" }}>Order today and get fresh catch delivered to your doorstep.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              { href: "/shop/gutted-trout", label: "CLEANED & GUTTED", title: "Premium Gutted Trout", img: "/images/gutted_trout_premium.png" },
              { href: "/shop/whole-trout", label: "WHOLE FISH", title: "Whole Rainbow Trout", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA6az_W5rdEt8WkOzLnn861EIuB2tv1E9ZBuYuxXAnLFmG7ZsCCb0WyuI___JpO7YjI9Vf_XYBLXYanCVvdJyrbf-CarB6-5xxisc34AV5zB1gV5AElNc-POwd_DAA12ADx0vUX87WKN2GVXZapRsMugASCSZsBjri-8d9uI957NqfLv1Hau8-DgJfLrNJoRtSKwJo6uFM1V-GDVCSznDSww8vBl8jD_s-iPkmhUcOhQ6ekndTbbBSJCBon4pCpkvihVwAcuF4JCTVc" },
            ].map(p => (
              <Link key={p.href} href={p.href} className="group relative rounded-2xl overflow-hidden block aspect-[16/10]" style={{ border: `1px solid rgba(61,74,83,0.5)`, textDecoration: "none" }}>
                <img src={p.img} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(3,16,24,0.85) 0%, transparent 55%)" }} />
                <div style={{ position: "absolute", bottom: "1.5rem", left: "1.5rem" }}>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary, display: "block", marginBottom: "0.3rem" }}>{p.label}</span>
                  <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.25rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>{p.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
