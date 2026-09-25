import type { Metadata } from "next";
import Link from "next/link";
import { products } from "@/lib/data";
import ProductCard from "@/components/ProductCard";
import StoreClosedBanner from "@/components/StoreClosedBanner";
import { supabase } from "@/lib/supabase";
import { getBusinessHoursInfo } from "@/lib/businessHours";
import { getLiveAquariumStock } from "@/lib/aquariumStock";

export const metadata: Metadata = {
  title: "Shop Fresh Rainbow Trout Online in Srinagar",
  description:
    "Order live-harvested whole (₹540/kg) and cleaned & gutted (₹580/kg) Rainbow Trout online in Srinagar. 100% Free bio-thermal doorstep delivery within 2 hours within our 5km farm zone.",
  alternates: {
    canonical: "https://urbantrout.in/shop",
  },
  openGraph: {
    title: "Shop Fresh Rainbow Trout Online in Srinagar | Urban Trout",
    description:
      "Buy fresh Rainbow Trout from our Malabagh farm. Whole from ₹540/kg, gutted from ₹580/kg. Free delivery within 5km farm radius.",
    url: "https://urbantrout.in/shop",
    siteName: "Urban Trout",
    images: [
      {
        url: "https://urbantrout.in/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Shop Fresh Rainbow Trout Srinagar",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
};

// Enable ISR (Incremental Static Regeneration) - refreshed every 30s
// Use a short revalidation so hours change is reflected quickly
export const revalidate = 30;

const C = {
  bg: "#031018", bgLow: "#06151e", bgHigh: "#10212c", bgHighest: "#152834",
  primary: "#72ddfd", primaryCont: "#3aadcc", onPrimCont: "#002730",
  onSurface: "#dfedf9", onSurfVar: "#9fadb8", outline: "#6a7782", outlineVar: "#3d4a53",
};

// Metadata lookup for known products
const PRODUCT_META: Record<string, { img: string; label: string; desc: string }> = {
  "gutted-trout": {
    img: "/images/gutted_trout_premium.webp",
    label: "CLEANED & GUTTED",
    desc: "Expertly cleaned, gutted, and ready to cook. Harvested fresh to order and chilled for delivery.",
  },
  "whole-trout": {
    img: "/images/whole_trout.jpg",
    label: "WHOLE FRESH FISH",
    desc: "Fresh whole trout straight from our farm. Ideal for pan-frying, roasting, grilling, or curries.",
  },
};

export default async function ShopPage() {
  // ── Business Hours & Store Overrides Check ────────────────────────────────
  const { data: settingsRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["store_manually_closed", "farm_maintenance_active", "allow_friday_orders", "force_store_open"]);

  const overrides: Record<string, boolean> = {};
  settingsRows?.forEach((r) => {
    overrides[r.key] = r.value === "true";
  });

  const effectiveHoursInfo = getBusinessHoursInfo(new Date(), {
    storeManuallyClosed: overrides.store_manually_closed,
    farmMaintenanceActive: overrides.farm_maintenance_active,
    allowFridayOrders: overrides.allow_friday_orders,
    forceStoreOpen: overrides.force_store_open,
  });
  const isManuallyClosedFlag = Boolean(overrides.store_manually_closed);

  // ── Fetch inventory data ──────────────────────────────────────────────────
  const { data: invData } = await supabase
    .from("inventory")
    .select("*")
    .eq("available", true)
    .order("product_name");

  const { data: metaRows } = await supabase
    .from("app_settings")
    .select("*")
    .like("key", "product_meta_%");

  // ── Fetch primary phone for WhatsApp CTA ─────────────────────────────────
  const { data: phoneRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "primary_phone")
    .single();
  const primaryPhone = phoneRow?.value ?? "+918491006127";

  // ── Fetch aquarium remaining live stock (shared pool for both products) ──
  let aquariumStockKg: number | undefined;
  try {
    const liveStock = await getLiveAquariumStock();
    aquariumStockKg = liveStock.remainingKg;
  } catch (err) {
    console.error("Failed to calculate live aquarium stock:", err);
    aquariumStockKg = undefined;
  }

  const metaMap: Record<string, any> = {};
  (metaRows || []).forEach((r) => {
    try {
      metaMap[r.key.replace("product_meta_", "")] = JSON.parse(r.value);
    } catch (e) {}
  });

  const productList =
    invData && invData.length > 0
      ? invData.map((item) => {
          const hardcoded = PRODUCT_META[item.product_id];
          const savedMeta = metaMap[item.product_id] || {};
          const price = Number(item.price_per_kg);
          const originalPrice = item.original_price_per_kg
            ? Number(item.original_price_per_kg)
            : savedMeta.original_price_per_kg
            ? Number(savedMeta.original_price_per_kg)
            : item.product_id === "gutted-trout"
            ? 650
            : item.product_id === "whole-trout"
            ? 600
            : Math.round(price * 1.2);
          const minQuantity = item.min_order_kg
            ? Number(item.min_order_kg)
            : savedMeta.min_order_kg
            ? Number(savedMeta.min_order_kg)
            : 2;

          return {
            id: item.product_id,
            name: item.product_name,
            price,
            originalPrice,
            unit: "Kg",
            label: (item as any).label || savedMeta.label || hardcoded?.label || "FRESH TROUT",
            desc:
              (item as any).description ||
              savedMeta.description ||
              hardcoded?.desc ||
              "Fresh premium farm trout harvested to order.",
            img:
              (item as any).image_url ||
              savedMeta.image_url ||
              hardcoded?.img ||
              "/images/gutted_trout_premium.png",
            minQuantity,
            // Both products share the same aquarium pool
            stockKg: aquariumStockKg,
            isOpen: effectiveHoursInfo.isOpen,
          };
        })
      : products.map((p) => ({
          ...p,
          stockKg: aquariumStockKg,
          isOpen: effectiveHoursInfo.isOpen,
        }));

  // ── If store is closed, render the closed banner ──────────────────────────
  if (!effectiveHoursInfo.isOpen) {
    return (
      <StoreClosedBanner
        nextOpenISO={effectiveHoursInfo.nextOpenISO}
        nextOpenLabel={effectiveHoursInfo.nextOpenLabel}
        primaryPhone={primaryPhone}
        isFridayMaintenance={effectiveHoursInfo.isFridayMaintenance}
        closedReason={effectiveHoursInfo.closedReason}
      />
    );
  }

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
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "flex-end" }}>
            <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, maxWidth: "380px", lineHeight: 1.75, fontSize: "1rem", margin: 0 }}>
              Sustainably farmed in the icy currents of the Himalayas. Delivered within 2 hours of harvest.
            </p>
            {/* Free Delivery & Business hours indicators */}
            <div className="flex flex-wrap items-center gap-2">
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "0.5rem 0.9rem",
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.35)",
                borderRadius: "100px",
              }}>
                <span className="text-xs">🛵</span>
                <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", color: "#34d399", textTransform: "uppercase" }}>
                  Free Delivery (5km Farm Radius)
                </span>
              </div>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "0.5rem 1rem",
                background: "rgba(114,221,253,0.06)",
                border: "1px solid rgba(114,221,253,0.15)",
                borderRadius: "100px",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#72ddfd" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", fontWeight: 600, letterSpacing: "0.06em", color: C.primary }}>
                  Open Today · 7:00 AM – 10:00 PM (Closed Fridays)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
          {productList.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
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
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface }}>Direct to Your Door</span>
            <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.82rem", color: C.onSurfVar, lineHeight: 1.65 }}>Delivered chilled within hours of harvest within 5km farm zone.</span>
          </div>
        </div>
      </section>

      {/* Ping animation */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
