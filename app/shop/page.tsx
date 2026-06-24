"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

const C = {
  bg: "#031018", bgLow: "#06151e", bgHigh: "#10212c", bgHighest: "#152834",
  primary: "#72ddfd", primaryCont: "#3aadcc", onPrimCont: "#002730",
  onSurface: "#dfedf9", onSurfVar: "#9fadb8", outline: "#6a7782", outlineVar: "#3d4a53",
};

import { products } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import { supabase } from "@/lib/supabase";

export default function ShopPage() {
  const [productList, setProductList] = useState(products);

  useEffect(() => {
    async function loadPrices() {
      const { data } = await supabase.from("inventory").select("*");
      if (data) {
        setProductList(prev => 
          prev.map(p => {
            const dbItem = data.find(item => item.product_id === p.id);
            return dbItem ? { ...p, price: dbItem.price_per_kg } : p;
          })
        );
      }
    }
    loadPrices();
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      {/* ── Header ── */}
      <section style={{ padding: "9rem 1.5rem 4rem", maxWidth: "1280px", margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "2rem", marginBottom: "3.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.25rem" }}>
              <div style={{ width: "32px", height: "1px", background: "rgba(114,221,253,0.5)" }} />
              <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary }}>Fresh from Srinagar</span>
            </div>
            <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.92, color: C.onSurface, margin: 0 }}>
              The Purest <span style={{ background: "linear-gradient(135deg, #72ddfd, #c4ebff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Rainbow Trout</span> Available.
            </h1>
          </div>
          <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, maxWidth: "380px", lineHeight: 1.75, fontSize: "1rem", margin: 0 }}>
            Sustainably farmed in the icy currents of the Himalayas. Delivered within 24 hours of harvest.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {productList.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section style={{ borderTop: "1px solid rgba(114,221,253,0.07)", background: C.bgLow }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "3.5rem 1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem 3rem" }}>
          {[
            { icon: "ac_unit", title: "Cold Chain Guaranteed", desc: "Maintained at exactly 1.5°C with real-time biometric sensors." },
            { icon: "verified", title: "Zero Waste Ethics", desc: "100% of harvest utilised. Minimal carbon footprint." },
            { icon: "qr_code_2", title: "Full Traceability", desc: "Scan your QR to see the exact pond & harvest timestamp." },
          ].map(t => (
            <div key={t.title} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "rgba(114,221,253,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "22px", color: C.primary }}>{t.icon}</span>
              </div>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>{t.title}</span>
              <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.82rem", color: C.onSurfVar, lineHeight: 1.65 }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
