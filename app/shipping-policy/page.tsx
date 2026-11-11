import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy",
  description: "Official delivery coverage, tiered 100% Free cold-chain express delivery within 16km perimeter of Malabagh farm, pin-point GPS handover, and operating hours.",
  alternates: {
    canonical: "https://urbantrout.in/shipping-policy",
  },
  openGraph: {
    title: "Shipping & Delivery Policy | Urban Trout Srinagar",
    description: "Tiered 100% Free cold-chain express delivery to your shared GPS location within 16km perimeter of our Malabagh farm within 2 hours of harvest.",
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
    title: "1. Service Area & Delivery Coverage (16km Farm Perimeter & 4 Delivery Zones)",
    body: "• 16km Cold-Chain Express Perimeter: To guarantee peak live-harvest freshness and an unbroken cold chain within 90–120 minutes, Urban Trout delivers across a 16.0 km perimeter from our aquaculture farm base in Malabagh, Srinagar.\n• Zone 1 (0 to 4.0 km — Core Farm Zone): Malabagh, Hazratbal, Habak, Naseem Bagh, Zakura, Lal Bazar, Soura (SKIMS), Bachpora, Illahibagh, Nowshera, Ahmad Nagar, Zadibal, etc. 100% FREE Express Delivery on min 2 kg (or ₹35 delivery fee for 1 kg).\n• Zone 2 (4.0 to 7.0 km — Mid-City Zone): Hawal, Khanyar, Rainawari, Badamwari, Alamgari Bazar, Saida Kadal, Eidgah, Safakadal, Shalimar, Nagbal, etc. 100% FREE Express Delivery on min 3 kg (or ₹55 on 2 kg / ₹65 on 1 kg).\n• Zone 3 (7.0 to 11.5 km — Greater Srinagar Zone): Lal Chowk, Dalgate, Boulevard, Qamarwari, Khayyam, Nishat, Karan Nagar, etc. 100% FREE Express Delivery on min 3 kg (or ₹89 on 2 kg / ₹99 on 1 kg).\n• Zone 4 (11.5 to 16.0 km — South & Cross-City Corridor): Sanat Nagar, Peerbagh, Airport Road / Humhama, Nowgam, Rajbagh, Jawahar Nagar, Batamaloo, Bemina, Sonwar, Wazir Bagh, Chanapora, Hyderpora, Rawalpora, Lasjan, Pantha Chowk, Athwajan, Rangreth, HMT / Zainakote, etc. 100% FREE Express Delivery on our 5 kg Family Pack (or ₹109 on 4 kg / ₹129 on 3 kg / ₹139 on 2 kg / ₹149 on 1 kg).\n• Beyond 16.0 km & Outer Districts: Outside our 16 km cold-chain express perimeter. Customers located in outer districts or beyond 16 km (e.g. Ganderbal, Pampore, Chadoora, Budgam town, Baramulla) are warmly invited to place an order for live harvest pickup directly from our dedicated Live Trout Vending Center at our Malabagh farm.",
  },
  {
    title: "2. Harvest-to-Order & Delivery Timelines",
    body: "• Farm-Fresh Quality: Every order is freshly harvested live from our cold-water aquaculture tanks upon order confirmation to ensure maximum freshness and taste.\n• Rapid Delivery Timeframe: Orders within our 16km perimeter are freshly harvested to order, cleaned/gutted if requested, packed in clean food-grade packaging (double polythene), and dispatched chilled to your shared GPS location within 90–120 minutes.\n• Operating Delivery Hours: Saturday to Thursday between 8:00 AM and 8:00 PM IST (Closed on Fridays for scheduled Farm Maintenance).",
  },
  {
    title: "3. 100% Free Delivery Tiers & Express Delivery Fees",
    body: "• 100% FREE Cold-Chain Express Delivery for Zone 1 (min 2 kg), Zone 2 (min 3 kg), Zone 3 (min 3 kg), and Zone 4 (min 5 kg Family Pack).\n• For orders below the free delivery threshold in each zone, standard location-based express delivery charges apply (from ₹35 in Zone 1 to ₹109–₹149 in Zone 4).\n• Product pricing includes clean food-grade packaging (two polythenes). There are zero hidden packing charges or surprise fees at checkout.",
  },
  {
    title: "4. Pin-Point Shared GPS Delivery Policy (No House-Number Search)",
    body: "• Google Maps Link or WhatsApp Location Pin Required: Every delivery requires an accurate Google Maps location link or WhatsApp Location Pin for pin-point navigation.\n• Strictly Shared-Location Delivery Only: Our Urban Trout Cold-Chain Dispatch Partner navigates strictly to the exact GPS location point shared with your order — we do NOT search house numbers or knock on doors.\n• In-Person Handover Mandatory: Customers (or a designated recipient) must collect the chilled package in person at the shared GPS location pin.",
  },
  {
    title: "5. Phone Reachability & Single-Attempt Cold-Chain Routing",
    body: "• Multiple Active Cold-Chain Orders: Our Cold-Chain Dispatch Partner carries multiple time-sensitive, live-harvested orders along an active scheduled route.\n• No Second Delivery Attempt: Please ensure your registered mobile number remains switched on and reachable at delivery time. We cannot arrange a second delivery attempt if your phone goes unanswered or is switched off upon arrival at the shared location.",
  },
  {
    title: "6. Fresh Food-Grade Packaging & Notifications",
    body: "• Sealed Food-Grade Hygiene: Every fish is packed immediately following harvest in clean, food-grade double packaging (two polythenes) with zero messy melting ice.\n• WhatsApp & SMS Updates: You will receive harvest and dispatch updates via WhatsApp/SMS prior to our Cold-Chain Dispatch Partner's arrival at your shared location pin.",
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
