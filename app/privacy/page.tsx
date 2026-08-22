import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Urban Trout privacy policy and data handling practices.",
};

const C = {
  bg: "#031018", bgHigh: "#10212c",
  primary: "#72ddfd", onSurface: "#dfedf9", onSurfVar: "#9fadb8", outlineVar: "#3d4a53",
};

const sections = [
  {
    title: "Information We Collect",
    body: "When you place an order, we collect your name, phone number, and delivery address. This information is used solely to process and deliver your order. We do not collect payment card information — payments are handled via secure links sent to your WhatsApp.",
  },
  {
    title: "How We Use Your Information",
    body: "Your personal information is used to: process and fulfil your orders, calculate delivery logistics, communicate your order status via WhatsApp, and improve our service. We do not sell or share your data with third parties for marketing purposes.",
  },
  {
    title: "Data Storage",
    body: "Your order and contact details are stored securely on Supabase servers with row-level security enabled. Access is restricted to authorised Urban Trout staff only.",
  },
  {
    title: "WhatsApp Communication",
    body: "By placing an order, you consent to receiving order confirmations, payment links, and delivery updates via WhatsApp on the phone number provided.",
  },
  {
    title: "Contact",
    body: "For any privacy-related concerns, please contact us at hello@urbantrout.in or call +91 70066 04148.",
  },
];

export default function PrivacyPage() {
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
          Privacy Policy
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
