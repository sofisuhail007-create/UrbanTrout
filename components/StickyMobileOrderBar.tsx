"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

export default function StickyMobileOrderBar() {
  const pathname = usePathname();
  const { items, total, itemCount, openCart, addItem, isOpen } = useCart();

  // 1. Strict suppression on checkout, admin, invoices, and auth callbacks
  if (
    !pathname ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/invoice") ||
    pathname.startsWith("/auth") ||
    isOpen
  ) {
    return null;
  }

  // 2. Identify if on a specific product detail route
  const isGuttedPage = pathname.includes("gutted-trout");
  const isWholePage = pathname.includes("whole-trout");

  return (
    <div
      className="block lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-2xl border-t border-cyan-500/30 px-4 py-2.5 sm:py-3 shadow-[0_-12px_36px_rgba(0,0,0,0.85)]"
      style={{
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* ── Case 1: Cart has items — Show Quick Checkout Pill ── */}
      {items.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold text-white font-['Space_Grotesk'] leading-tight">
                ₹{total.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({itemCount} {itemCount === 1 ? "kg" : "kg"})
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold tracking-tight mt-0.5">
              <span>🛵</span>
              <span>FREE Chilled Delivery Applied</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openCart}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer font-['Space_Grotesk']"
            >
              <span>View Cart</span>
              <span>→</span>
            </button>
          </div>
        </div>
      ) : isGuttedPage ? (
        /* ── Case 2: On Cleaned & Gutted Trout Page ── */
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold text-white font-['Space_Grotesk'] leading-tight">
                ₹750
              </span>
              <span className="text-[11px] text-slate-400">/Kg</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                FREE DELIVERY 🛵
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              Cleaned, Gutted &amp; Ready to Cook
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              addItem({
                id: "gutted-trout",
                name: "Cleaned & Gutted Rainbow Trout",
                price: 750,
                originalPrice: 850,
                quantity: 1,
                unit: "Kg",
                image: "/images/gutted_trout_premium.webp",
                minQuantity: 1,
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-400/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer font-['Space_Grotesk'] shrink-0"
          >
            <span>Add 1 Kg ⚡</span>
          </button>
        </div>
      ) : isWholePage ? (
        /* ── Case 3: On Whole Fresh Trout Page ── */
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold text-white font-['Space_Grotesk'] leading-tight">
                ₹650
              </span>
              <span className="text-[11px] text-slate-400">/Kg</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                FREE DELIVERY 🛵
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              Fresh Whole Cold-Water Trout
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              addItem({
                id: "whole-trout",
                name: "Whole Fresh Rainbow Trout",
                price: 650,
                originalPrice: 750,
                quantity: 1,
                unit: "Kg",
                image: "/images/whole_trout.jpg",
                minQuantity: 1,
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-400/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer font-['Space_Grotesk'] shrink-0"
          >
            <span>Add 1 Kg ⚡</span>
          </button>
        </div>
      ) : (
        /* ── Case 4: General Browsing (Homepage / Shop Listing) ── */
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">From</span>
              <span className="text-base font-extrabold text-white font-['Space_Grotesk'] leading-tight">
                ₹650/Kg
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                FREE DELIVERY 🛵
              </span>
            </div>
            <p className="text-[10px] text-cyan-300 font-medium truncate mt-0.5">
              Farmed in Srinagar • Cold Mountain Water
            </p>
          </div>

          <Link
            href="/shop"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center gap-1 cursor-pointer font-['Space_Grotesk'] shrink-0"
          >
            <span>Order Fresh ⚡</span>
          </Link>
        </div>
      )}
    </div>
  );
}
