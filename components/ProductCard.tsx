"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { Product } from "@/lib/data";

/** Derive stock badge appearance from kg available */
function getStockBadge(stockKg?: number): { label: string; color: string; bg: string; border: string } | null {
  if (stockKg === undefined || stockKg === null) return null;
  if (stockKg <= 0) return { label: "Out of Stock", color: "#f87171", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.35)" };
  if (stockKg <= 5) return { label: `~${stockKg.toFixed(1)} kg — Low Stock`, color: "#fbbf24", bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)" };
  return { label: `~${stockKg % 1 === 0 ? stockKg : stockKg.toFixed(1)} kg Available Today`, color: "#4ade80", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)" };
}

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
    addItem({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      quantity: Math.max(effectiveMin, qty),
      unit: p.unit,
      image: p.img,
      minQuantity: effectiveMin,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const hasDiscount = Boolean(p.originalPrice && p.originalPrice > p.price);
  const discountAmount = hasDiscount ? (p.originalPrice! - p.price) : 0;
  const discountPercent = hasDiscount ? Math.round(((p.originalPrice! - p.price) / p.originalPrice!) * 100) : 0;
  const stockBadge = getStockBadge(p.stockKg);
  const isOpen = p.isOpen !== false; // default to open if not specified
  const isOutOfStock = p.stockKg !== undefined && p.stockKg <= 0;

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
        <Image
          src={p.img}
          alt={p.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient overlay — subtle, only at bottom */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: "linear-gradient(to top, rgba(16,33,44,0.85) 0%, rgba(16,33,44,0.1) 50%, transparent 100%)" }}
        />

        {/* Label badge */}
        <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 pointer-events-none">
          <span
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm"
            style={{
              background: "rgba(114,221,253,0.12)",
              border: "1px solid rgba(114,221,253,0.35)",
              color: "#72ddfd",
              fontFamily: '"Inter", sans-serif',
            }}
          >
            {p.label}
          </span>
          {hasDiscount && (
            <span
              className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md"
              style={{
                background: "rgba(34,197,94,0.2)",
                border: "1px solid rgba(34,197,94,0.45)",
                color: "#4ade80",
                fontFamily: '"Space Grotesk", sans-serif',
              }}
            >
              {discountPercent}% OFF
            </span>
          )}
        </div>

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

        {/* Aquarium Stock Badge */}
        {stockBadge && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Pulsing dot */}
            <span style={{ position: "relative", display: "inline-flex", width: "8px", height: "8px", flexShrink: 0 }}>
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: stockBadge.color,
                  opacity: 0.5,
                  animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: stockBadge.color,
                }}
              />
            </span>
            <span
              style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: stockBadge.color,
              }}
            >
              {stockBadge.label}
            </span>
          </div>
        )}

        {/* Price & Strikethrough Section */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.95rem", color: "#9fadb8", fontWeight: 600 }}>₹</span>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 800, color: "#72ddfd", letterSpacing: "-0.03em" }}>
              {p.price.toLocaleString("en-IN")}
            </span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: "#6a7782" }}>/ {p.unit}</span>

            {/* Strikethrough Original Price */}
            {hasDiscount && (
              <span
                className="line-through ml-1 text-xs md:text-sm font-semibold"
                style={{
                  color: "#64748b",
                  fontFamily: '"Space Grotesk", sans-serif',
                  textDecorationColor: "#ef4444",
                }}
              >
                ₹{p.originalPrice?.toLocaleString("en-IN")}
              </span>
            )}

            {/* Savings Tag */}
            {hasDiscount && (
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ml-1"
                style={{
                  background: "rgba(34,197,94,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(34,197,94,0.3)",
                  fontFamily: '"Space Grotesk", sans-serif',
                }}
              >
                Save ₹{discountAmount}
              </span>
            )}
          </div>

          {/* Minimum Order Badge */}
          <span
            className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
            style={{
              background: "rgba(114,221,253,0.15)",
              color: "#72ddfd",
              border: "1px solid rgba(114,221,253,0.35)",
              fontFamily: '"Space Grotesk", sans-serif',
              boxShadow: "0 0 10px rgba(114,221,253,0.1)",
            }}
          >
            MIN. {effectiveMin} {p.unit}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(61,74,83,0.5)" }} />

        {/* Qty + Add to Cart — OR — Closed / Out of Stock state */}
        {!isOpen ? (
          /* ── Store Closed ── */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "0.75rem 1rem",
              background: "rgba(3,16,24,0.7)",
              border: "1px solid rgba(61,74,83,0.5)",
              borderRadius: "12px",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9fadb8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <div>
              <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.8rem", fontWeight: 700, color: "#dfedf9", margin: 0 }}>
                Store Closed
              </p>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.72rem", color: "#9fadb8", margin: 0 }}>
                Opens at 7:00 AM — order tomorrow
              </p>
            </div>
          </div>
        ) : isOutOfStock ? (
          /* ── Out of Stock ── */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "0.75rem 1rem",
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: "12px",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.8rem", fontWeight: 700, color: "#f87171", margin: 0 }}>
              Out of Stock — Check back tomorrow
            </p>
          </div>
        ) : (
          /* ── Normal Add to Cart ── */
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
        )}
      </div>

      {/* Ping animation for stock dot */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
