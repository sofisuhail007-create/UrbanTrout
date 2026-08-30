"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";

type Props = {
  productId: string;
  productName: string;
  price: number;
  originalPrice?: number;
  unit: string;
  image: string;
  variant?: "primary" | "secondary";
  showDynamicPrice?: boolean;
  minQuantity?: number;
};

export default function AddToCartButton({
  productId,
  productName,
  price,
  originalPrice,
  unit,
  image,
  variant = "primary",
  showDynamicPrice = false,
  minQuantity = 1,
}: Props) {
  const { addItem } = useCart();
  const effectiveMin = Math.max(1, Number(minQuantity) || 1);
  const [qty, setQty] = useState(effectiveMin);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (minQuantity) {
      const min = Math.max(1, Number(minQuantity));
      setQty((prev) => (prev < min ? min : prev));
    }
  }, [minQuantity]);

  const handleAdd = () => {
    addItem({
      id: productId,
      name: productName,
      price,
      originalPrice,
      quantity: Math.max(effectiveMin, qty),
      unit,
      image,
      minQuantity: effectiveMin,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const hasDiscount = Boolean(originalPrice && originalPrice > price);
  const discountAmount = hasDiscount ? (originalPrice! - price) * qty : 0;
  const discountPercent = hasDiscount ? Math.round(((originalPrice! - price) / originalPrice!) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Dynamic Price */}
      {showDynamicPrice && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "0.95rem",
                color: "#9fadb8",
                fontWeight: 600,
              }}
            >
              ₹
            </span>
            <span
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "3rem",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "#72ddfd",
                lineHeight: 1,
              }}
            >
              {(price * qty).toLocaleString("en-IN")}
            </span>

            {/* Strikethrough Original Total */}
            {hasDiscount && (
              <span
                className="line-through text-lg font-semibold"
                style={{
                  color: "#64748b",
                  fontFamily: '"Space Grotesk", sans-serif',
                  textDecorationColor: "#ef4444",
                }}
              >
                ₹{(originalPrice! * qty).toLocaleString("en-IN")}
              </span>
            )}

            <span
              style={{
                fontFamily: '"Manrope", sans-serif',
                fontSize: "0.85rem",
                color: "#6a7782",
                marginLeft: "2px",
              }}
            >
              {qty === 1 ? `/ ${unit}` : `(${qty} ${unit} total)`}
            </span>
          </div>

          {/* Savings Pill */}
          {hasDiscount && (
            <div className="flex items-center gap-2">
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "#4ade80",
                  border: "1px solid rgba(34,197,94,0.35)",
                  fontFamily: '"Space Grotesk", sans-serif',
                }}
              >
                ✓ Save ₹{discountAmount.toLocaleString("en-IN")} ({discountPercent}% OFF)
              </span>
              <span className="text-xs text-slate-500 font-mono">
                (Original: ₹{originalPrice}/kg → Special: ₹{price}/kg)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quantity selector */}
      <div className="flex items-center gap-4">
        <div
          className="flex items-center rounded-xl overflow-hidden"
          style={{
            background: "rgba(3,16,24,0.8)",
            border: "1px solid rgba(61,74,83,0.6)",
          }}
        >
          <button
            onClick={() => setQty((q) => Math.max(effectiveMin, q - 1))}
            disabled={qty <= effectiveMin}
            className="flex items-center justify-center transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ width: "44px", height: "44px", color: "#72ddfd" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(114,221,253,0.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            aria-label="Decrease quantity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <span
            style={{
              minWidth: "70px",
              textAlign: "center",
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "#dfedf9",
            }}
          >
            {qty} {unit}
          </span>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="flex items-center justify-center transition-colors duration-150"
            style={{ width: "44px", height: "44px", color: "#72ddfd" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(114,221,253,0.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            aria-label="Increase quantity"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <span
          style={{
            fontFamily: '"Manrope", sans-serif',
            fontSize: "0.8rem",
            color: effectiveMin > 1 ? "#72ddfd" : "#6a7782",
            fontWeight: effectiveMin > 1 ? 600 : 400,
          }}
        >
          Min. {effectiveMin} {unit}
        </span>
      </div>

      {/* Add to cart button */}
      {variant === "primary" ? (
        <button
          onClick={handleAdd}
          className="relative overflow-hidden rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-200 active:scale-[0.98] w-full"
          style={{
            height: "52px",
            fontFamily: '"Space Grotesk", sans-serif',
            background: added ? "rgba(114,221,253,0.12)" : "#3aadcc",
            color: added ? "#72ddfd" : "#002730",
            border: added ? "1px solid rgba(114,221,253,0.35)" : "1px solid transparent",
            boxShadow: added ? "none" : "0 0 28px rgba(58,173,204,0.4), 0 4px 16px rgba(0,0,0,0.2)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            if (!added) (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(58,173,204,0.6), 0 4px 16px rgba(0,0,0,0.3)";
          }}
          onMouseLeave={(e) => {
            if (!added) (e.currentTarget as HTMLElement).style.boxShadow = "0 0 28px rgba(58,173,204,0.4), 0 4px 16px rgba(0,0,0,0.2)";
          }}
        >
          {/* Shimmer */}
          {!added && (
            <div
              className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
              style={{
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
              }}
            />
          )}
          <span className="relative z-10">
            {added ? "✓ Added to Cart" : "Add to Cart"}
          </span>
        </button>
      ) : (
        <button
          onClick={handleAdd}
          className="w-full rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-200 active:scale-[0.98]"
          style={{
            height: "52px",
            fontFamily: '"Space Grotesk", sans-serif',
            background: "rgba(114,221,253,0.07)",
            color: "#72ddfd",
            border: "1px solid rgba(114,221,253,0.2)",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(114,221,253,0.14)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(114,221,253,0.07)")}
        >
          {added ? "✓ Added" : "Add to Selection"}
        </button>
      )}
    </div>
  );
}
