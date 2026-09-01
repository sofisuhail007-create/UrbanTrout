import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Urban Trout Srinagar",
  description: "Urban Trout terms and conditions of service, ordering, and payment processing.",
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
    title: "1. Acceptance of Terms & Business Entity",
    body: "These Terms of Service govern your access to and use of the Urban Trout website and delivery services. The platform is owned and operated by Urban Trout (Proprietor: Skindar Mohd Sideeq), located in Srinagar, Jammu & Kashmir. By placing an order or using this website, you agree to be bound by these terms.",
  },
  {
    title: "2. Service Area & Eligibility",
    body: "Urban Trout operates a live aquaculture farm in Naseem Bagh and fulfills fresh doorstep deliveries within the Srinagar city limits (up to an approximate 25km radius). We reserve the right to decline or reschedule orders located outside our viable refrigerated delivery routes.",
  },
  {
    title: "3. Live Harvest Order Process & Weight Verification",
    body: "• All products offered are harvested live to order from our high-tech aquaculture tanks to ensure ultimate freshness.\n• As each Rainbow Trout is a naturally grown live fish, the final harvested weight may have minor natural variations from the requested quantity.\n• The customer will receive an exact harvest weight summary and digital invoice upon catch verification.",
  },
  {
    title: "4. Pricing, Currency & Payment Terms",
    body: "• All prices are quoted in Indian Rupees (₹ / INR) inclusive of applicable taxes unless stated otherwise.\n• We accept online payments securely via Razorpay Payment Gateway (UPI, Debit/Credit Cards, Net Banking) as well as direct UPI or authorized COD on delivery.\n• Urban Trout reserves the right to revise pricing per kilogram based on seasonal farm yield and feed costs without prior notice.",
  },
  {
    title: "5. Shipping, Delivery & Packaging",
    body: "• Doorstep deliveries are fulfilled using food-grade bio-thermal insulation and crushed ice to maintain temperature control.\n• Deliveries within 5km of our farm are free; deliveries beyond 5km incur a flat delivery charge of ₹40.\n• Detailed terms regarding delivery timelines and zones are governed by our Shipping & Delivery Policy.",
  },
  {
    title: "6. Cancellation, Return & Refund Policy",
    body: "• Pre-harvest cancellations are accepted at no charge prior to the commencement of harvesting.\n• Due to the perishable nature of fresh fish, cancellations or returns post-harvest cannot be accepted unless quality is compromised upon delivery.\n• For full terms and 5-7 business day refund timelines, please review our Refund & Cancellation Policy.",
  },
  {
    title: "7. Limitation of Liability",
    body: "Urban Trout shall not be held liable for indirect, incidental, or consequential damages arising from unforeseen delivery delays caused by extreme weather, road blockages, or force majeure events in Srinagar.",
  },
  {
    title: "8. Governing Law & Jurisdiction",
    body: "These terms and any disputes arising from transactions on this website shall be governed by and construed in accordance with the laws of India. The courts of Srinagar, Jammu & Kashmir shall have exclusive jurisdiction over all matters.",
  },
  {
    title: "9. Grievance Officer & Contact Information",
    body: "For inquiries, disputes, or regulatory concerns, please reach out to our Grievance Officer:\n• Legal Entity: Urban Trout (Operated by Skindar Mohd Sideeq)\n• Office: Malabagh, Naseem Bagh, Srinagar, Jammu & Kashmir — 190006\n• Phone: +91 84910 06127 (Alt: +91 70066 04148)\n• Email: info.urbantrout@gmail.com",
  },
];

export default function TermsPage() {
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
            Legal &amp; Terms
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
          Terms of Service
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
