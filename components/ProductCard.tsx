"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { Product } from "@/lib/data";

export default function ProductCard({ p }: { p: Product }) {
  const { addItem } = useCart();
  const effectiveMin = Math.max(1, Number(p.minQuantity) || 1);
  const [qty, setQty] = useState(effectiveMin);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (p.minQuantity) {
      const min = Math.max(1, Number(p.minQuantity));
      setQty((prev) => (prev < min ? min : prev));
    }
  }, [p.minQuantity]);

  const handleAdd = () => {
    addItem({ id: p.id, name: p.name, price: p.price, quantity: qty, unit: p.unit, image: p.img });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div
      className="group flex flex-col w-full rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: "rgba(16, 33, 44, 0.9)",
        border: "1px solid rgba(61, 74, 83, 0.5)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(114,221,253,0.3)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(114,221,253,0.12), 0 4px 24px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.border = "1px solid rgba(61, 74, 83, 0.5)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)";
      }}
    >
      {/* Clickable Image */}
      <Link
        href={`/shop/${p.id}`}
        className="relative block overflow-hidden cursor-pointer"
        style={{ aspectRatio: "16/9" }}
      >
        <img
          src={p.img}
          alt={p.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient overlay — subtle, only at bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(16,33,44,0.85) 0%, rgba(16,33,44,0.1) 50%, transparent 100%)" }}
        />

        {/* Label badge */}
        <span
          className="absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm pointer-events-none"
          style={{
            background: "rgba(114,221,253,0.12)",
            border: "1px solid rgba(114,221,253,0.35)",
            color: "#72ddfd",
            fontFamily: '"Inter", sans-serif',
          }}
        >
          {p.label}
        </span>

        {/* Details badge */}
        <span
          className="absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm transition-all duration-200 group-hover:text-white group-hover:border-white/30"
          style={{
            background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#9fadb8",
            fontFamily: '"Inter", sans-serif',
          }}
        >
          Details →
        </span>
      </Link>

      {/* Body */}
      <div className="flex flex-col gap-4 p-6">
        {/* Name + Description */}
        <div>
          <Link href={`/shop/${p.id}`} className="block group/title">
            <h2
              className="font-bold tracking-tight mb-1 transition-colors duration-200 group-hover/title:text-cyan-300"
              style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.35rem", color: "#dfedf9" }}
            >
              {p.name}
            </h2>
          </Link>
          <p
            className="leading-relaxed line-clamp-2"
            style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.84rem", color: "#9fadb8" }}
          >
            {p.desc}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-baseline justify-between gap-1">
          <div className="flex items-baseline gap-1">
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.95rem", color: "#9fadb8", fontWeight: 600 }}>₹</span>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 800, color: "#72ddfd", letterSpacing: "-0.03em" }}>
              {p.price.toLocaleString("en-IN")}
            </span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: "#6a7782", marginLeft: "2px" }}>/ {p.unit}</span>
          </div>
          {effectiveMin > 1 && (
            <span
              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "rgba(114,221,253,0.15)",
                color: "#72ddfd",
                border: "1px solid rgba(114,221,253,0.3)",
                fontFamily: '"Space Grotesk", sans-serif',
              }}
            >
              Min. {effectiveMin} {p.unit}
            </span>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(61,74,83,0.5)" }} />

        {/* Qty + Add to Cart */}
        <div className="flex items-center gap-3">
          {/* Quantity control */}
          <div
            className="flex items-center rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)" }}
          >
            <button
              onClick={() => setQty((q) => Math.max(effectiveMin, q - 1))}
              disabled={qty <= effectiveMin}
              className="flex items-center justify-center transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ width: "38px", height: "40px", color: "#72ddfd" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(114,221,253,0.1)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              aria-label="Decrease"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span
              className="text-center font-bold"
              style={{ minWidth: "52px", fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", color: "#dfedf9" }}
            >
              {qty} {p.unit}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="flex items-center justify-center transition-colors duration-150"
              style={{ width: "38px", height: "40px", color: "#72ddfd" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(114,221,253,0.1)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              aria-label="Increase"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Add to Cart */}
          <button
            onClick={handleAdd}
            className="flex-1 relative overflow-hidden rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-200 active:scale-95"
            style={{
              height: "40px",
              fontFamily: '"Space Grotesk", sans-serif',
              background: added ? "rgba(114,221,253,0.15)" : "#3aadcc",
              color: added ? "#72ddfd" : "#002730",
              border: added ? "1px solid rgba(114,221,253,0.4)" : "1px solid transparent",
              boxShadow: added ? "none" : "0 0 20px rgba(58,173,204,0.35)",
            }}
            onMouseEnter={(e) => {
              if (!added) (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(58,173,204,0.55)";
            }}
            onMouseLeave={(e) => {
              if (!added) (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(58,173,204,0.35)";
            }}
          >
            {added ? "✓ Added to Cart" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
