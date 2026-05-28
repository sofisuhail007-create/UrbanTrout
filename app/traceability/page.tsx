import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Traceability & Lab Reports",
  description:
    "Zero antibiotics. Zero microplastics. Every harvest anchored to the blockchain — radical transparency from lab to kitchen.",
};

const C = {
  bg: "#031018", bgLow: "#06151e", bgHigh: "#10212c", bgHighest: "#152834",
  primary: "#72ddfd", primaryCont: "#3aadcc", onPrimCont: "#002730",
  onSurface: "#dfedf9", onSurfVar: "#9fadb8", outline: "#6a7782", outlineVar: "#3d4a53",
};

const metrics = [
  { icon: "science", label: "pH Level", val: "7.2", unit: "pH", trend: "trending_up", msg: "Optimal range stabilized", color: "#72ddfd" },
  { icon: "air", label: "Dissolved O₂", val: "9.4", unit: "mg/L", trend: "check_circle", msg: "Saturated atmosphere", color: "#63cfee" },
  { icon: "thermostat", label: "Cold-Chain", val: "14.1", unit: "°C", trend: "remove", msg: "Constant alpine temp", color: "#aed3f1" },
  { icon: "water_drop", label: "Bio-Filter", val: "0.02", unit: "mg/L", trend: "verified_user", msg: "Ultra-pure detection", color: "#c4ebff" },
];

export default function TraceabilityPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      {/* ── Hero ── */}
      <section style={{ position: "relative", padding: "9rem 1.5rem 5rem", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(114,221,253,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "100px", border: "1px solid rgba(114,221,253,0.2)", background: "rgba(58,173,204,0.08)", marginBottom: "1.5rem" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: C.primary, boxShadow: "0 0 8px #72ddfd" }} />
              <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>Live Data Stream</span>
            </div>
            <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(3rem, 7vw, 6rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.88, color: C.onSurface, margin: "0 0 1.75rem" }}>
              Pure{" "}
              <span style={{ background: "linear-gradient(135deg, #72ddfd, #c4ebff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Biology.</span>
              <br />Open Logic.
            </h1>
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "1.1rem", color: C.onSurfVar, lineHeight: 1.75, margin: 0, maxWidth: "480px" }}>
              Zero antibiotics. Zero microplastics. Every harvest is anchored to the blockchain, offering radical transparency from the submerged laboratory to your kitchen.
            </p>
          </div>

          <div style={{ position: "relative", borderRadius: "20px", overflow: "hidden", border: "1px solid rgba(114,221,253,0.12)" }}>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCs8Cf-c8I2mgJK97P70dN1ASvgBrTtnrds7ocR8HR0jAxFqFzx_HKUJcRiGBahaZFddGACw-AJIGjONIpDBorLw7p0pX7EqPw-IsXa6-_XwQZBoKdqB8wqKq_hVTzCTLw40Y13u8KZyEvpQx5wgeEg5X8ZTbVUrH4qSnAWs5jCvBRO5BDMbVkxarxbSPPCI-3Jr2WbRygAT6XXzhipUu-agJDbeoAqJsf8bD85wLI-u3jvghBmT0LVHp0o8rkRJ2I5tNGLtqlYw6nL"
              alt="Lab" style={{ width: "100%", height: "380px", objectFit: "cover", opacity: 0.55 }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #031018 0%, transparent 50%)" }} />
            <div style={{ position: "absolute", bottom: "1.5rem", left: "1.5rem", right: "1.5rem", padding: "1rem 1.25rem", background: "rgba(6,21,30,0.8)", backdropFilter: "blur(16px)", borderRadius: "10px", border: "1px solid rgba(114,221,253,0.12)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", color: C.onSurfVar, letterSpacing: "0.1em" }}>SYSTEM INTEGRITY</span>
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", color: C.primary }}>99.9% Purity</span>
              </div>
              <div style={{ height: "3px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: "99.9%", background: "linear-gradient(90deg, #3aadcc, #72ddfd)", boxShadow: "0 0 8px #72ddfd" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Metric Widgets ── */}
      <section style={{ padding: "0 1.5rem 5rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem" }}>
          {metrics.map(m => (
            <div key={m.label} 
              className="group relative p-8 rounded-2xl border border-white/5 transition-all duration-500 hover:-translate-y-2 hover:border-[#72ddfd]/30 hover:shadow-[0_8px_30px_rgba(114,221,253,0.15)] overflow-hidden"
              style={{ background: "linear-gradient(145deg, #10212c 0%, #06151e 100%)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#72ddfd]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", position: "relative" }}>
                <span className="material-symbols-outlined transform group-hover:scale-110 transition-transform duration-500" style={{ fontSize: "24px", color: m.color, filter: "drop-shadow(0 0 6px currentColor)" }}>{m.icon}</span>
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.2em", color: C.onSurfVar }}>{m.label}</span>
              </div>
              <div style={{ marginBottom: "1rem", position: "relative" }}>
                <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "3rem", fontWeight: 300, color: C.onSurface }}>{m.val}</span>
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "0.875rem", color: m.color, marginLeft: "4px", textTransform: "uppercase" }}>{m.unit}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
                <span className="material-symbols-outlined group-hover:animate-pulse" style={{ fontSize: "14px", color: m.color }}>{m.trend}</span>
                <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.onSurfVar }}>{m.msg}</span>
              </div>
            </div>
          ))}
        </div>
      </section>



      {/* ── Feed + Purity Bento ── */}
      <section style={{ padding: "0 1.5rem 6rem" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
          {/* Feed Composition */}
          <div style={{ padding: "2.5rem", borderRadius: "16px", background: "rgba(16,33,44,0.6)", border: "1px solid rgba(255,255,255,0.04)", backdropFilter: "blur(20px)" }}>
            <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem", fontWeight: 800, color: C.onSurface, margin: "0 0 0.75rem" }}>Feed Composition</h3>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, maxWidth: "480px", lineHeight: 1.65, margin: "0 0 2.5rem", fontSize: "0.9rem" }}>
              Our specialized diet eliminates wild-caught fish meal, utilizing insect protein and algae oils for a sustainable, toxin-free lifecycle.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
              {[
                { label: "Crude Protein", val: "45%", highlight: true },
                { label: "Crude Fat", val: "18%", highlight: false },
                { label: "Crude Fiber", val: "2.0%", highlight: false },
                { label: "Moisture", val: "12%", highlight: false },
              ].map(item => (
                <div key={item.label} style={{ padding: "1rem", background: item.highlight ? "rgba(114,221,253,0.06)" : "rgba(255,255,255,0.03)", borderRadius: "10px", border: `1px solid ${item.highlight ? "rgba(114,221,253,0.2)" : "rgba(255,255,255,0.04)"}` }}>
                  <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.15em", color: item.highlight ? C.primary : C.onSurfVar, margin: "0 0 8px" }}>{item.label}</p>
                  <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.625rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Purity Pledge */}
          <div style={{ padding: "2.5rem", borderRadius: "16px", background: "rgba(114,221,253,0.04)", border: "1px solid rgba(114,221,253,0.1)", position: "relative", overflow: "hidden" }}>
            <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem", fontWeight: 800, color: C.onSurface, margin: "0 0 2rem" }}>Purity Pledge</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {["No GMO", "No Hormones", "No Microplastics"].map(pledge => (
                <div key={pledge} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className="material-symbols-outlined" style={{ color: C.primary, fontSize: "20px", filter: "drop-shadow(0 0 4px #72ddfd)" }}>check_circle</span>
                  <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "1.05rem", color: C.onSurface }}>{pledge}</span>
                </div>
              ))}
            </div>
            <span className="material-symbols-outlined" style={{ position: "absolute", bottom: "-24px", right: "-24px", fontSize: "160px", color: "rgba(114,221,253,0.06)", transform: "rotate(10deg)", pointerEvents: "none" }}>verified</span>
          </div>
        </div>
      </section>
    </div>
  );
}
