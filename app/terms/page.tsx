import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Urban Trout terms and conditions of service.",
};

const C = {
  bg: "#031018", bgHigh: "#10212c",
  primary: "#72ddfd", onSurface: "#dfedf9", onSurfVar: "#9fadb8", outlineVar: "#3d4a53",
};

const sections = [
  {
    title: "Service Coverage",
    body: "Urban Trout delivers exclusively within the Srinagar city limits (approximately 25km from our farm in Naseem Bagh). We reserve the right to decline orders outside this zone.",
  },
  {
    title: "Order Process",
    body: "Orders are requests for harvest and are confirmed via WhatsApp. As our trout is harvested exclusively to order, the final billing weight may vary slightly from the requested quantity. You will be informed of the exact weight before payment is requested.",
  },
  {
    title: "Pricing & Payment",
    body: "Prices displayed are per kilogram (Kg) and are subject to change. Final payment is due before delivery via a secure link shared on WhatsApp. We accept UPI and major payment methods through our payment gateway.",
  },
  {
    title: "Delivery",
    body: "We aim to deliver within 24 hours of order confirmation. Deliveries within 5km of our farm are free; deliveries beyond 5km carry a flat ₹40 fee. Delivery times may vary due to harvest schedules or weather conditions in Srinagar.",
  },
  {
    title: "Quality Guarantee",
    body: "All fish is dispatched fresh, chilled in ice, and packed in bio-thermal insulation. If you are unsatisfied with the quality upon delivery, please contact us immediately at +91 84910 06127.",
  },
  {
    title: "Cancellation",
    body: "Orders may be cancelled at no cost before the harvest begins. Once the fish has been harvested, cancellations are not accepted. Please contact us immediately via WhatsApp if you need to cancel.",
  },
  {
    title: "Contact",
    body: "For any questions or concerns, contact us at info.urbantrout@gmail.com or +91 84910 06127 (Alt: +91 70066 04148).",
  },
];

export default function TermsPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "8rem 1.5rem 5rem" }}>
        <Link
          href="/"
          className="back-link inline-flex items-center gap-2 mb-10"
          style={{ fontFamily: '"Inter", sans-serif', fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: C.onSurfVar, textDecoration: "none" }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Home
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
          <div style={{ width: "32px", height: "1px", background: "rgba(114,221,253,0.5)" }} />
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.25em", textTransform: "uppercase", color: C.primary }}>Legal</span>
        </div>
        <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 800, letterSpacing: "-0.04em", color: C.onSurface, marginBottom: "0.5rem" }}>
          Terms of Service
        </h1>
        <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar, marginBottom: "3rem" }}>
          Last updated: August 2026
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {sections.map((s) => (
            <div
              key={s.title}
              style={{ padding: "1.5rem", borderRadius: "14px", background: "rgba(16,33,44,0.6)", border: `1px solid rgba(61,74,83,0.4)` }}
            >
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1rem", fontWeight: 700, color: C.onSurface, marginBottom: "0.75rem", letterSpacing: "-0.01em" }}>
                {s.title}
              </h2>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: C.onSurfVar, lineHeight: 1.75 }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
