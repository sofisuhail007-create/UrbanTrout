import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/lib/data";

interface ScheduledCatalogProps {
  productList: Product[];
  nextOpenLabel?: string;
}

export default function ScheduledCatalog({
  productList,
  nextOpenLabel,
}: ScheduledCatalogProps) {
  return (
    <section
      id="scheduled-catalog"
      style={{
        padding: "4rem 1.5rem 6rem",
        maxWidth: "1280px",
        margin: "0 auto",
        scrollMarginTop: "2rem",
      }}
    >
      <div
        style={{
          padding: "1.5rem 2rem",
          borderRadius: "20px",
          background: "linear-gradient(135deg, rgba(58,173,204,0.15) 0%, rgba(16,33,44,0.95) 100%)",
          border: "1.5px solid rgba(114,221,253,0.35)",
          marginBottom: "3rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1.25rem",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(114,221,253,0.15)",
              border: "1px solid rgba(114,221,253,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            📅
          </div>
          <div>
            <h2
              style={{
                fontFamily: '"Space Grotesk", sans-serif',
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "#ffffff",
                margin: 0,
              }}
            >
              Schedule Your Fresh Catch Order
            </h2>
            <p
              style={{
                fontFamily: '"Manrope", sans-serif',
                fontSize: "0.88rem",
                color: "#c4ebff",
                margin: "4px 0 0",
              }}
            >
              Guaranteed live harvest for{" "}
              <strong style={{ color: "#72ddfd" }}>{nextOpenLabel || "tomorrow"}</strong> delivery. Select your delivery slot at checkout!
            </p>
          </div>
        </div>
        <Link
          href="/checkout"
          style={{
            padding: "10px 22px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            color: "#ffffff",
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: "0.82rem",
            fontWeight: 800,
            textDecoration: "none",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow: "0 0 20px rgba(16,185,129,0.35)",
          }}
        >
          Go to Checkout →
        </Link>
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {productList.map((p) => (
          <ProductCard
            key={p.id}
            p={{
              ...p,
              isOpen: false, // In schedule mode: ProductCard displays "📅 Schedule Order" button
            }}
          />
        ))}
      </div>
    </section>
  );
}
