"use client";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { usePathname } from "next/navigation";

const C = {
  bg: "#031018", bgHigh: "#10212c", bgHighest: "#152834",
  primary: "#72ddfd", primaryCont: "#3aadcc", onPrimCont: "#002730",
  onSurface: "#dfedf9", onSurfVar: "#9fadb8", outline: "#6a7782", outlineVar: "#3d4a53",
};

export default function CartDrawer() {
  const { isOpen, closeCart, items, removeItem, updateQuantity, total } = useCart();
  const pathname = usePathname();
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
            items.map((item) => (
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
                  <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.outline, marginBottom: "8px" }}>
                    ₹{item.price} / {item.unit}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid rgba(61,74,83,0.5)`, background: "rgba(3,16,24,0.6)" }}>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: "28px", height: "28px", color: C.primary }}
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      </button>
                      <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "12px", fontWeight: 700, color: C.onSurface, minWidth: "32px", textAlign: "center" }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: "28px", height: "28px", color: C.primary }}
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
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-5 space-y-4" style={{ borderTop: `1px solid rgba(61,74,83,0.4)` }}>
            {/* Subtotal */}
            <div className="flex justify-between items-center">
              <div>
                <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.outline, marginBottom: "4px" }}>
                  Subtotal (excl. delivery)
                </p>
                <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 800, color: C.primary, letterSpacing: "-0.04em", lineHeight: 1 }}>
                  ₹{total.toLocaleString("en-IN")}
                </h3>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.outline, marginBottom: "4px" }}>
                  Packaging
                </p>
                <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.9rem", fontWeight: 700, color: C.onSurfVar }}>Bio-Thermal</p>
              </div>
            </div>

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
