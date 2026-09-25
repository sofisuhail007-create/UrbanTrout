"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";
import { getBusinessHoursInfo } from "@/lib/businessHours";
import { calculateTroutNutrition } from "@/lib/nutrition";

const C = {
  bg: "#031018", bgHigh: "#10212c", bgHighest: "#152834",
  primary: "#72ddfd", primaryCont: "#3aadcc", onPrimCont: "#002730",
  onSurface: "#dfedf9", onSurfVar: "#9fadb8", outline: "#6a7782", outlineVar: "#3d4a53",
};

export default function CartDrawer() {
  const { isOpen, closeCart, items, removeItem, updateQuantity, total, totalSavings, aquariumStockKg } = useCart();
  const pathname = usePathname();
  const [storeStatus, setStoreStatus] = useState(() => getBusinessHoursInfo());

  const totalTroutKg = items
    .filter((i) => i.id === "gutted-trout" || i.id === "whole-trout" || i.unit.toLowerCase().includes("kg"))
    .reduce((sum, i) => sum + i.quantity, 0);

  const cartNutrition = calculateTroutNutrition(totalTroutKg, true);

  useEffect(() => {
    fetch("/api/store-status")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.isOpen === "boolean") {
          setStoreStatus({
            isOpen: data.isOpen,
            isFridayMaintenance: Boolean(data.isFridayMaintenance),
            isFarmMaintenance: Boolean(data.farmMaintenanceActive),
            allowFridayOrders: Boolean(data.allowFridayOrders),
            closedReason: data.closedReason,
            nextOpenLabel: data.nextOpenLabel || "",
            nextOpenISO: data.nextOpenISO || "",
            currentISTHour: 0,
            currentISTMinute: 0,
            currentISTDay: 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[55] transition-opacity"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed right-0 top-0 h-full z-[60] flex flex-col transition-transform duration-500 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "rgba(6,21,30,0.98)",
          backdropFilter: "blur(28px)",
          borderLeft: `1px solid rgba(61,74,83,0.5)`,
          boxShadow: "-12px 0 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid rgba(61,74,83,0.4)` }}>
          <div>
            <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.15rem", fontWeight: 800, color: C.primary, margin: 0, letterSpacing: "-0.02em" }}>
              Your Selection
            </h2>
            <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.onSurfVar, margin: "4px 0 0" }}>
              Premium Srinagar Stock
            </p>
          </div>
          <button
            onClick={closeCart}
            className="flex items-center justify-center rounded-xl transition-colors"
            style={{ width: "38px", height: "38px", border: `1px solid rgba(61,74,83,0.5)`, color: C.onSurfVar, background: "transparent" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.1)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,0.3)";
              (e.currentTarget as HTMLElement).style.color = "#f87171";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(61,74,83,0.5)";
              (e.currentTarget as HTMLElement).style.color = C.onSurfVar;
            }}
            aria-label="Close cart"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-grow overflow-y-auto px-6 py-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4">
              <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(114,221,253,0.06)", border: `1px solid rgba(114,221,253,0.12)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="32" height="32" fill="none" stroke={C.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
                  <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              </div>
              <div>
                <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.9rem", fontWeight: 600, color: C.onSurfVar, marginBottom: "4px" }}>Your cart is empty</p>
                <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.8rem", color: C.outline }}>Add fresh trout to get started.</p>
              </div>
              <Link
                href="/shop"
                onClick={closeCart}
                style={{
                  display: "inline-block",
                  padding: "10px 24px",
                  borderRadius: "10px",
                  background: C.primaryCont,
                  color: C.onPrimCont,
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  marginTop: "4px",
                }}
              >
                Browse Products
              </Link>
            </div>
          ) : (
            items.map((item) => {
              const hasItemDiscount = Boolean(item.originalPrice && item.originalPrice > item.price);
              const itemSavings = hasItemDiscount ? (item.originalPrice! - item.price) * item.quantity : 0;

              const isAquarium = item.id === "gutted-trout" || item.id === "whole-trout";
              const otherAquariumQty = items
                .filter((i) => (i.id === "gutted-trout" || i.id === "whole-trout") && i.id !== item.id)
                .reduce((sum, i) => sum + i.quantity, 0);
              const maxStock = aquariumStockKg !== null && isAquarium
                ? Math.floor(aquariumStockKg)
                : (item.maxQuantity || 99);
              const canIncrease = isAquarium
                ? (item.quantity + otherAquariumQty) < maxStock
                : item.quantity < maxStock;

              return (
                <div
                  key={item.id}
                  className="flex gap-3 p-4 rounded-2xl"
                  style={{ background: "rgba(16,33,44,0.8)", border: `1px solid rgba(61,74,83,0.4)` }}
                >
                  {/* Image */}
                  <div style={{ width: "60px", height: "60px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, border: `1px solid rgba(61,74,83,0.4)` }}>
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>

                  {/* Info */}
                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-1">
                      <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.onSurface, lineHeight: 1.2 }}>{item.name}</h4>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex items-center justify-center transition-colors ml-2 flex-shrink-0"
                        style={{ color: C.outline, width: "22px", height: "22px" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#f87171")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = C.outline)}
                        aria-label="Remove item"
                      >
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>

                    {/* Price and Original Strikethrough */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.primary }}>
                        ₹{item.price} / {item.unit}
                      </span>
                      {hasItemDiscount && (
                        <span
                          className="line-through text-xs font-semibold"
                          style={{ color: "#64748b", fontFamily: '"Space Grotesk", sans-serif', textDecorationColor: "#ef4444" }}
                        >
                          ₹{item.originalPrice}
                        </span>
                      )}
                      {hasItemDiscount && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          Save ₹{itemSavings}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid rgba(61,74,83,0.5)`, background: "rgba(3,16,24,0.6)" }}>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= (item.minQuantity || 1)}
                          className="flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ width: "28px", height: "28px", color: C.primary }}
                        >
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "12px", fontWeight: 700, color: C.onSurface, minWidth: "32px", textAlign: "center" }}>
                          {item.quantity} {item.unit}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={!canIncrease}
                          className="flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          style={{ width: "28px", height: "28px", color: C.primary }}
                          title={!canIncrease ? "Maximum available stock reached" : "Increase"}
                        >
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                      </div>
                      <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.9rem", fontWeight: 800, color: C.primary }}>
                        ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 space-y-4" style={{ borderTop: `1px solid rgba(61,74,83,0.4)` }}>
            {/* Catch Nutritional Powerhouse (Interactive Fact Check) */}
            {totalTroutKg > 0 && (
              <div
                className="p-3.5 rounded-2xl transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, rgba(8,27,38,0.95) 0%, rgba(13,38,52,0.85) 100%)",
                  border: "1px solid rgba(114,221,253,0.28)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-cyan-300 font-['Space_Grotesk'] uppercase tracking-wider flex items-center gap-1.5">
                    <span>🧬</span> {totalTroutKg} Kg Catch Nutritional Yield
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Fact-Checked
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-1">
                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-tight">Pure Protein</span>
                    <strong className="text-sm md:text-base text-cyan-300 font-bold font-['Space_Grotesk']">
                      ~{cartNutrition.proteinGrams}g
                    </strong>
                    <span className="text-[9px] text-emerald-400 block">≈ {cartNutrition.eggWhiteEquivalent} Eggs</span>
                  </div>

                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-tight">EPA + DHA</span>
                    <strong className="text-sm md:text-base text-emerald-400 font-bold font-['Space_Grotesk']">
                      ~{(cartNutrition.omega3Mg / 1000).toFixed(1)}g
                    </strong>
                    <span className="text-[9px] text-slate-400 block">Omega-3s</span>
                  </div>

                  <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-mono uppercase tracking-tight">Natural D3</span>
                    <strong className="text-sm md:text-base text-amber-300 font-bold font-['Space_Grotesk']">
                      ~{cartNutrition.vitaminDIU.toLocaleString("en-IN")} IU
                    </strong>
                    <span className="text-[9px] text-slate-400 block">Immunity</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug mt-2 text-center">
                  ⚡ <strong>Fact Check:</strong> {cartNutrition.headlineFact}
                </p>
              </div>
            )}

            {/* Total Savings Banner */}
            {totalSavings > 0 && (
              <div
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  color: "#4ade80",
                  fontFamily: '"Space Grotesk", sans-serif',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span>🎉</span> You Save on This Order:
                </span>
                <span className="text-sm">₹{totalSavings.toLocaleString("en-IN")}</span>
              </div>
            )}

            {/* 100% Free Delivery Assurance */}
            <div
              className="flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.35)",
                color: "#34d399",
                fontFamily: '"Space Grotesk", sans-serif',
              }}
            >
              <span className="flex items-center gap-1.5">
                <span>🛵</span> Delivery (5km Farm Radius):
              </span>
              <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-500/25 px-2 py-0.5 rounded-full text-emerald-300">
                100% FREE
              </span>
            </div>

            {/* Subtotal */}
            <div className="flex justify-between items-center">
              <div>
                <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.outline, marginBottom: "4px" }}>
                  Total Amount (Free Delivery)
                </p>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 800, color: C.primary, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  ₹{total.toLocaleString("en-IN")}
                </h3>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.outline, marginBottom: "4px" }}>
                  Packaging
                </p>
                <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.9rem", fontWeight: 700, color: "#34d399" }}>FREE Bio-Thermal</p>
              </div>
            </div>

            {/* Store Status Notification */}
            {!storeStatus.isOpen && (
              <div
                className="p-3 rounded-xl text-xs flex items-center gap-2.5 my-1"
                style={{
                  background: (storeStatus.isFridayMaintenance || storeStatus.closedReason === "farm_maintenance") ? "rgba(245,158,11,0.12)" : "rgba(248,113,113,0.12)",
                  border: (storeStatus.isFridayMaintenance || storeStatus.closedReason === "farm_maintenance") ? "1px solid rgba(245,158,11,0.3)" : "1px solid rgba(248,113,113,0.3)",
                  color: (storeStatus.isFridayMaintenance || storeStatus.closedReason === "farm_maintenance") ? "#fbbf24" : "#f87171",
                  fontFamily: '"Manrope", sans-serif',
                }}
              >
                <span className="text-base flex-shrink-0">{(storeStatus.isFridayMaintenance || storeStatus.closedReason === "farm_maintenance") ? "🛠️" : "⏰"}</span>
                <span className="leading-tight font-medium">
                  {storeStatus.closedReason === "farm_maintenance"
                    ? "Closed for Farm & Vending Center Maintenance. Online checkout will resume once maintenance concludes."
                    : storeStatus.isFridayMaintenance
                    ? "Closed Fridays for Farm Maintenance. Online checkout reopens Saturday at 7:00 AM."
                    : `Currently closed. Orders reopen ${storeStatus.nextOpenLabel || "tomorrow at 7:00 AM"}.`}
                </span>
              </div>
            )}

            <Link
              href="/checkout"
              onClick={closeCart}
              className="flex items-center justify-center gap-2 w-full font-bold uppercase tracking-widest transition-all active:scale-[0.98]"
              style={{
                height: "50px",
                borderRadius: "12px",
                background: C.primaryCont,
                color: C.onPrimCont,
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "0.82rem",
                textDecoration: "none",
                boxShadow: "0 0 24px rgba(58,173,204,0.35)",
              }}
            >
              Proceed to Checkout
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
