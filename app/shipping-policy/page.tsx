import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy",
  description: "Official delivery coverage, tiered 100% Free doorstep delivery within 16km perimeter of Malabagh farm, cold-chain packaging, and operating hours.",
  alternates: {
    canonical: "https://urbantrout.in/shipping-policy",
  },
  openGraph: {
    title: "Shipping & Delivery Policy | Urban Trout Srinagar",
    description: "Tiered 100% Free doorstep delivery within 16km perimeter of our Malabagh farm within 2 hours of harvest. Non-toxic cold gel-pack packaging.",
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
    title: "1. Service Area & Delivery Coverage (16km Farm Perimeter & 4 Subsidized Zones)",
    body: "• 16km Express Delivery Perimeter: To guarantee peak live-harvest freshness and an unbroken cold chain within 90–120 minutes, Urban Trout delivers across a 16.0 km perimeter from our aquaculture farm base in Malabagh, Srinagar.\n• Zone 1 (0 to 4.0 km — Core Farm Zone): Malabagh, Hazratbal, Habak, Naseem Bagh, Zakura, Lal Bazar, Soura (SKIMS), Bachpora, Illahibagh, Nowshera, Ahmad Nagar, Zadibal, etc. 100% FREE Doorstep Delivery on min 2 kg (or ₹29 subsidized courier fee for 1 kg).\n• Zone 2 (4.0 to 7.0 km — Mid-City Zone): Hawal, Khanyar, Rainawari, Badamwari, Alamgari Bazar, Saida Kadal, Eidgah, Safakadal, Shalimar, Nagbal, etc. 100% FREE Doorstep Delivery on min 3 kg (or ₹39 on 2 kg / ₹49 on 1 kg).\n• Zone 3 (7.0 to 11.5 km — Greater Srinagar Zone): Lal Chowk, Rajbagh, Dalgate, Boulevard, Jawahar Nagar, Sonwar, Qamarwari, Batamaloo, Khayyam, Bemina, Nishat, Sanat Nagar, Chanapora, Hyderpora, etc. 100% FREE Doorstep Delivery on min 3 kg (or ₹69 on 2 kg / ₹79 on 1 kg).\n• Zone 4 (11.5 to 16.0 km — South Corridor & Outskirts): Rawalpora, Peerbagh, Airport Road, Lasjan, Nowgam, Pantha Chowk, Athwajan, Rangreth, Ganderbal, etc. 100% FREE Doorstep Delivery on our 4 kg Family Pack (or ₹49 on 3 kg / ₹89 on 2 kg / ₹119 on 1 kg).\n• Beyond 16.0 km: Outside our doorstep express delivery perimeter. Customers located beyond 16 km (e.g. Pampore, Chadoora, Budgam town, Baramulla) are warmly invited to place an order for live harvest pickup directly from our dedicated Live Trout Vending Center at our Malabagh farm.",
  },
  {
    title: "2. Harvest-to-Order & Delivery Timelines",
    body: "• Farm-Fresh Quality: Every order is freshly harvested live from our cold-water aquaculture tanks upon order confirmation to ensure maximum freshness and taste.\n• Rapid Delivery Timeframe: Orders within our 16km perimeter are freshly harvested to order, cleaned/gutted if requested, chilled with non-toxic leak-proof ice gel packs, and delivered to your doorstep within 90–120 minutes.\n• Operating Delivery Hours: Saturday to Thursday between 8:00 AM and 9:00 PM IST (Closed on Fridays for scheduled Farm Maintenance).",
  },
  {
    title: "3. 100% Free Shipping & Subsidized Delivery Policy",
    body: "• 100% FREE Doorstep Delivery for Zone 1 (min 2 kg), Zone 2 (min 3 kg), Zone 3 (min 3 kg), and Zone 4 (min 4 kg Family Pack).\n• Urban Trout directly absorbs the majority of courier costs on all sub-minimum orders, ensuring you pay only a nominal fee (as low as ₹29) on ice-chilled door delivery.\n• Product pricing includes free cold-chain insulated packaging and reusable non-toxic ice gel packs (0°C–4°C). There are zero hidden packing charges or surprise fees at checkout.",
  },
  {
    title: "4. Cold-Chain Packaging & Temperature Control",
    body: "• Freshness is our top priority. Every fish is packed immediately following harvest in food-grade insulated packaging with non-toxic, leak-proof reusable ice gel packs (0°C–4°C).\n• This maintains an unbroken dry sub-4°C chill chain from our farm tanks directly to your kitchen without soggy bags or melting ice water, ensuring maximum taste, texture, and nutritional value.",
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
    body: "For questions regarding delivery areas, scheduled orders, or tracking an active delivery:\n• Helpline & WhatsApp: +91 84910 06127\n• Alternate Line: +91 70066 04148\n• Email: founder@urbantrout.in\n• Farm Location: Malabagh, Naseem Bagh, Srinagar — 190006 (Near R P School Girls Wing)",
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
