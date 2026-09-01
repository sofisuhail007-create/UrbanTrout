import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Urban Trout Srinagar",
  description: "Urban Trout privacy policy, data protection, and payment security standards.",
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
    title: "1. Information We Collect",
    body: "When you interact with Urban Trout (operated by Skindar Mohd Sideeq) or place an order for fresh trout, we collect necessary personal details including:\n• Customer Contact Details: Full Name, WhatsApp mobile number, email address.\n• Delivery Information: House/apartment details, locality/landmark in Srinagar, GPS coordinates, and 6-digit pin code.\n• Order Details: Product selections, quantities (in Kg), custom cleaning preferences, and order notes.",
  },
  {
    title: "2. How We Use Your Information",
    body: "Your information is used strictly to provide you with the best farm-to-table service:\n• Processing, harvesting, and scheduling doorstep deliveries in Srinagar.\n• Dispatching real-time harvest and order tracking alerts via WhatsApp / SMS.\n• Responding to customer inquiries and processing customer service or refund requests.\n• Improving our farm logistics and product availability in your area.\n• We do NOT sell, rent, or trade your personal information to third parties for marketing purposes.",
  },
  {
    title: "3. Payment Gateway & Card Data Security",
    body: "• All online card, UPI, and net banking payments on Urban Trout are securely handled through our PCI-DSS Level 1 compliant payment gateway partner, Razorpay Software Private Limited.\n• Urban Trout does not collect, process, or store raw credit/debit card numbers, CVVs, card expiry dates, or banking passwords on our servers.\n• All communication with the payment gateway is encrypted with industry-standard 256-bit SSL / TLS encryption.",
  },
  {
    title: "4. Data Storage & Platform Security",
    body: "• Customer profiles, farm logs, and order records are stored in secure cloud database infrastructure with Row-Level Security (RLS) and strict access controls.\n• Access is restricted exclusively to authorized operational personnel responsible for fulfillment and support.",
  },
  {
    title: "5. WhatsApp & Communication Consent",
    body: "By submitting your phone number on our website or checkout form, you consent to receiving transaction-related messages, digital receipts, payment links, and delivery status notifications via WhatsApp and SMS.",
  },
  {
    title: "6. User Rights & Data Protection (DPDP Act)",
    body: "In accordance with Indian data protection laws, you have the right to review, update, or request the deletion of your personal data stored with us. To exercise these rights, please email our Grievance Officer at info.urbantrout@gmail.com.",
  },
  {
    title: "7. Grievance Redressal & Contact Details",
    body: "If you have questions regarding this Privacy Policy or wish to raise a privacy concern, please contact our Grievance Redressal Officer:\n• Operating Business: Urban Trout\n• Authorized Signatory / Grievance Officer: Skindar Mohd Sideeq\n• Office Address: Malabagh, Naseem Bagh, Srinagar, Jammu & Kashmir — 190006\n• Phone / WhatsApp: +91 84910 06127 (Alt: +91 70066 04148)\n• Email: info.urbantrout@gmail.com",
  },
];

export default function PrivacyPage() {
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
            Legal &amp; Privacy
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
          Privacy Policy
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
