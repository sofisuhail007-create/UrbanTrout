import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Urban Trout Srinagar",
  description: "Official delivery coverage, 100% Free doorstep delivery across Srinagar, cold-chain packaging, and operating hours.",
  alternates: {
    canonical: "https://urbantrout.in/shipping-policy",
  },
  openGraph: {
    title: "Shipping & Delivery Policy | Urban Trout Srinagar",
    description: "100% Free doorstep delivery across Srinagar within 2 hours of harvest. Food-grade ice packaging.",
    url: "https://urbantrout.in/shipping-policy",
    siteName: "Urban Trout",
  },
};

const C = {
  bg: "#031018",
  bgHigh: "#10212c",
  primary: "#72ddfd",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
  outlineVar: "#3d4a53",
};

const sections = [
  {
    title: "1. Service Area & Delivery Coverage",
    body: "• Urban Trout provides 100% Free Doorstep Delivery across the entire Srinagar municipal area and all surrounding neighborhoods.\n• Localities Served: Malabagh, Hazratbal, Habak, Naseem Bagh, Zakura, Lal Bazar, Soura (SKIMS), Bachpora, Illahibagh, Rainawari, Dalgate, Rajbagh, Lal Chowk, Jawahar Nagar, Hyderpora, Sanat Nagar, Bemina, and all other Srinagar pin codes.\n• Farm Gate Pickup: You are also welcome to visit and pick up live catch directly from our farm counter in Malabagh, Srinagar.",
  },
  {
    title: "2. Harvest-to-Order & Delivery Timelines",
    body: "• Farm-Fresh Quality: Every order is freshly harvested live from our cold-water aquaculture tanks upon order confirmation to ensure maximum freshness and taste.\n• Rapid Delivery Timeframe: Orders are freshly harvested to order, cleaned/gutted if requested, chilled in food-grade ice, and delivered to your doorstep within 2 hours across Srinagar.\n• Operating Delivery Hours: Monday to Sunday between 7:00 AM and 10:00 PM IST.",
  },
  {
    title: "3. 100% Free Shipping & Delivery Policy",
    body: "• 100% FREE Doorstep Delivery across all Srinagar neighborhoods on every order.\n• Product pricing includes free bio-thermal cold-chain insulated packaging and food-grade crushed ice. There are zero hidden delivery fees, packing charges, or surprise shipping costs at checkout.",
  },
  {
    title: "4. Cold-Chain Packaging & Temperature Control",
    body: "• Freshness is our top priority. Every fish is packed immediately following harvest in food-grade bio-thermal insulated packaging with crushed food-grade ice.\n• This maintains an unbroken sub-4°C chill chain from our farm tanks directly to your kitchen, ensuring maximum taste, texture, and nutritional value.",
  },
  {
    title: "5. Order Tracking & WhatsApp Notifications",
    body: "• Once your order is harvested and handed over to our delivery rider, you will receive an instant dispatch alert and rider contact details via WhatsApp and SMS.\n• Our delivery agent will contact you on the registered mobile number prior to doorstep delivery.",
  },
  {
    title: "6. Customer Responsibilities at Delivery",
    body: "• Please ensure the recipient or a family representative is available at the provided delivery address to receive the perishable package.\n• We strongly advise transferring the fresh fish into refrigeration (or cooking immediately) upon receipt.\n• If there is an unexpected delay due to extreme weather or road conditions in Srinagar, our support team will keep you updated promptly.",
  },
  {
    title: "7. Delivery Support & Inquiries",
    body: "For questions regarding delivery areas, scheduled orders, or tracking an active delivery:\n• Helpline & WhatsApp: +91 84910 06127\n• Alternate Line: +91 70066 04148\n• Email: info.urbantrout@gmail.com\n• Farm Location: Malabagh, Naseem Bagh, Srinagar — 190006 (Near R P School Girls Wing)",
  },
];

export default function ShippingPolicyPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "8rem 1.5rem 5rem" }}>
        <Link
          href="/"
          className="back-link inline-flex items-center gap-2 mb-10"
          style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: "0.8rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: C.onSurfVar,
            textDecoration: "none",
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Home
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
          <div style={{ width: "32px", height: "1px", background: "rgba(114,221,253,0.5)" }} />
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary }}>
            Logistics &amp; Fulfillment
          </span>
        </div>

        <h1
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: "clamp(2rem, 5vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.04em",
            color: C.onSurface,
            marginBottom: "0.5rem",
          }}
        >
          Shipping &amp; Delivery Policy
        </h1>
        <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar, marginBottom: "3rem" }}>
          Last updated: September 2026 • Urban Trout (Operated by Skindar Mohd Sideeq)
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {sections.map((s) => (
            <div
              key={s.title}
              style={{
                padding: "1.5rem",
                borderRadius: "14px",
                background: "rgba(16,33,44,0.6)",
                border: `1px solid rgba(61,74,83,0.4)`,
              }}
            >
              <h2
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: C.onSurface,
                  marginBottom: "0.75rem",
                  letterSpacing: "-0.01em",
                }}
              >
                {s.title}
              </h2>
              <p
                style={{
                  fontFamily: '"Manrope", sans-serif',
                  fontSize: "0.88rem",
                  color: C.onSurfVar,
                  lineHeight: 1.75,
                  whiteSpace: "pre-line",
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
