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
        setProductList((prev) =>
          prev.map((p) => {
            const dbItem = data.find((item) => item.product_id === p.id);
            const price = dbItem?.price_per_kg || p.price;
            const minQuantity = dbItem?.min_order_kg ? Number(dbItem.min_order_kg) : (p.minQuantity || 2);
            const originalPrice = dbItem?.original_price_per_kg
              ? Number(dbItem.original_price_per_kg)
              : (p.originalPrice || (p.id === "gutted-trout" ? 650 : 600));
            return {
              ...p,
              price,
              minQuantity,
              originalPrice,
            };
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          {productList.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section style={{ borderTop: "1px solid rgba(114,221,253,0.07)", background: C.bgLow }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "3.5rem 1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem 3rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(114,221,253,0.1)", border: "1px solid rgba(114,221,253,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg className="w-5 h-5 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Pure Filtered Water</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.82rem", color: C.onSurfVar, lineHeight: 1.65 }}>Raised in clean groundwater systems, isolated from pollutants.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(114,221,253,0.1)", border: "1px solid rgba(114,221,253,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg className="w-5 h-5 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Harvested to Order</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.82rem", color: C.onSurfVar, lineHeight: 1.65 }}>Freshly harvested to order and chilled in food-grade ice.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(114,221,253,0.1)", border: "1px solid rgba(114,221,253,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg className="w-5 h-5 text-[#72ddfd]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Direct to Your Door</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.82rem", color: C.onSurfVar, lineHeight: 1.65 }}>Delivered chilled within hours of harvest across Srinagar.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
