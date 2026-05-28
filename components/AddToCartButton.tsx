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
    addItem({
      id: productId,
      name: productName,
      price,
      quantity: qty,
      unit,
      image,
    });
    setAdded(true);
    toast.success(`${qty}x ${productName} added to cart!`, {
      icon: '🐟',
    });
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Dynamic Price (Optional) */}
      {showDynamicPrice && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-headline text-4xl md:text-5xl font-bold text-primary transition-all">
            ₹{(price * qty).toLocaleString("en-IN")}
          </span>
          <span className="font-label text-on-surface-variant text-sm uppercase tracking-wider ml-1">
            {qty === 1 ? `/ ${unit}` : `(Total for ${qty} ${unit})`}
          </span>
        </div>
      )}

      {/* Quantity selector */}
      <div className="flex items-center bg-surface-container-highest rounded-md p-1 border border-outline-variant/20 w-fit">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="w-10 h-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded transition-colors"
          aria-label="Decrease quantity"
        >
          <span className="material-symbols-outlined">remove</span>
        </button>
        <span className="min-w-[60px] text-center font-label font-bold text-on-surface">
          {qty} {unit}
        </span>
        <button
          onClick={() => setQty((q) => q + 1)}
          className="w-10 h-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded transition-colors"
          aria-label="Increase quantity"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      {/* Add to cart button */}
      {variant === "primary" ? (
        <button
          onClick={handleAdd}
          className="group/btn relative px-8 py-4 bg-primary-container text-on-primary-container rounded-md font-bold tracking-widest uppercase text-xs hover:shadow-[0_0_25px_rgba(58,173,204,0.4)] active:scale-95 transition-all w-full overflow-hidden"
        >
          <span className="relative z-10">
            {added ? "✓ Added to Cart" : "Add to Cart"}
          </span>
          <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover/btn:translate-x-0 transition-transform duration-300" />
        </button>
      ) : (
        <button
          onClick={handleAdd}
          className="w-full py-4 bg-surface-variant border border-primary/20 text-primary-fixed rounded-md font-bold tracking-widest uppercase text-xs hover:bg-primary/10 transition-all"
        >
          {added ? "✓ Added" : "Add to Selection"}
        </button>
      )}
    </div>
  );
}
