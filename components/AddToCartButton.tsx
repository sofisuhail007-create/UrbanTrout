"use client";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import toast from "react-hot-toast";

type Props = {
  productId: string;
  productName: string;
  price: number;
  unit: string;
  image: string;
  variant?: "primary" | "secondary";
  showDynamicPrice?: boolean;
};

export default function AddToCartButton({
  productId,
  productName,
  price,
  unit,
  image,
  variant = "primary",
  showDynamicPrice = false,
}: Props) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem({ id: productId, name: productName, price, quantity: qty, unit, image });
    setAdded(true);
    toast.success(`${qty}x ${productName} added to cart!`, { icon: "🐟" });
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Dynamic Price */}
      {showDynamicPrice && (
        <div className="flex items-baseline gap-2">
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
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex items-center justify-center transition-colors duration-150"
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
            color: "#6a7782",
          }}
        >
          Min. 1 {unit}
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
