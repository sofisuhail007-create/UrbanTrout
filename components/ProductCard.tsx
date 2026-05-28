"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { Product } from "@/lib/data";

export default function ProductCard({ p }: { p: Product }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addItem({ id: p.id, name: p.name, price: p.price, quantity: qty, unit: p.unit, image: p.img });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="group flex flex-col w-full mx-auto rounded-3xl overflow-hidden bg-surface-container-high border border-outline-variant/10 hover:border-primary/30 transition-colors shadow-lg">
      {/* Image container */}
      <div className="relative aspect-[4/3] md:aspect-[16/10] overflow-hidden">
        <img 
          src={p.img} 
          alt={p.name} 
          className="w-full h-full object-cover mix-blend-luminosity hover:mix-blend-normal transition-all duration-700 group-hover:scale-105" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container-high/90 via-surface-container-high/20 to-transparent pointer-events-none" />
        
        <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 font-label text-[10px] uppercase tracking-widest text-primary backdrop-blur-sm">
          {p.label}
        </span>
        
        <Link 
          href={`/shop/${p.id}`}
          className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/40 border border-white/10 font-label text-[10px] uppercase tracking-widest text-on-surface-variant backdrop-blur-sm hover:text-white transition-colors"
        >
          DETAILS →
        </Link>
      </div>

      {/* Body */}
      <div className="p-6 md:p-8 flex flex-col gap-5 flex-grow">
        <div>
          <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface tracking-tight mb-2 line-clamp-1">{p.name}</h2>
          <p className="font-body text-sm md:text-base text-on-surface-variant leading-relaxed line-clamp-2">{p.desc}</p>
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="font-headline text-2xl font-bold text-primary">₹{p.price}</span>
          <span className="font-label text-xs text-on-surface-variant">/ {p.unit}</span>
        </div>

        {/* Qty + Add UI Update */}
        <div className="flex flex-wrap gap-3 items-center mt-auto pt-2">
          <div className="flex items-center bg-surface-container-highest rounded-lg border border-primary/10 overflow-hidden min-w-[110px] flex-shrink-0">
            <button 
              onClick={() => setQty(q => Math.max(1, q - 1))} 
              className="w-9 h-11 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-base">remove</span>
            </button>
            <span className="flex-1 text-center font-headline font-bold text-sm text-on-surface">
              {qty} {p.unit}
            </span>
            <button 
              onClick={() => setQty(q => q + 1)} 
              className="w-9 h-11 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-base">add</span>
            </button>
          </div>
          
          <button 
            onClick={handleAdd} 
            className={`flex-1 h-11 rounded-lg font-headline font-bold text-xs uppercase tracking-widest transition-all ${
              added 
                ? "bg-primary/15 text-primary border border-primary/30 shadow-none" 
                : "bg-primary-container text-on-primary-container border border-transparent shadow-[0_0_15px_rgba(58,173,204,0.2)] hover:brightness-110 active:scale-95"
            }`}
          >
            {added ? "✓ Added" : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
