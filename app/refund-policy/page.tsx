import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy | Urban Trout Srinagar",
  description: "Official cancellation, return, and refund policy for Urban Trout fresh harvest orders.",
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
    title: "1. Policy Overview",
    body: "At Urban Trout (operated by Skindar Mohd Sideeq), we are committed to delivering the freshest farm-harvested Rainbow Trout directly from our farm in Srinagar to your doorstep. Due to the perishable nature of fresh fish, this policy outlines the terms and conditions governing order cancellations, returns, and refunds in compliance with Indian consumer protection regulations.",
  },
  {
    title: "2. Order Cancellation Policy",
    body: "• Pre-Harvest Cancellation: You may cancel your order free of charge at any time before the farm harvest and packing process begins for your order slot.\n• Post-Harvest Cancellation: Once the fish has been freshly harvested and prepared (cleaned/gutted/iced), cancellations cannot be accepted as perishable food products cannot be restocked.\n• To cancel an order before harvest, please contact our helpline immediately via call or WhatsApp at +91 84910 06127.",
  },
  {
    title: "3. Perishable Goods & Quality Guarantee",
    body: "• We take extreme care to pack our trout with food-grade ice and bio-thermal insulation to ensure peak freshness upon arrival.\n• We strongly advise customers or their representatives to inspect the order package at the time of delivery.\n• In the unlikely event that your delivery arrives damaged, compromised in temperature, spoiled, or if the wrong item/quantity was delivered, please notify us within 2 hours of delivery with photographic evidence via WhatsApp (+91 84910 06127) or email (info.urbantrout@gmail.com).",
  },
  {
    title: "4. Refund Eligibility & Resolution",
    body: "Upon receiving your complaint and verifying the issue, we will offer one of the following resolutions based on your preference:\n1. Immediate Free Replacement: Priority harvest and re-delivery of the fresh catch in the next available delivery slot.\n2. Full or Partial Refund: A direct refund for the affected items credited back to your original payment source.",
  },
  {
    title: "5. Refund Method & Processing Timeline",
    body: "• Approved refunds are initiated immediately and processed through our authorized payment gateway partner (Razorpay).\n• The refund amount will be credited back to the original payment source (UPI ID, Debit/Credit Card, or Net Banking account) within 5 to 7 business days, in accordance with standard banking and payment gateway settlement cycles.\n• For direct UPI transfers where applicable, refunds are issued via direct UPI transfer within 24 hours of approval.",
  },
  {
    title: "6. Non-Refundable Scenarios",
    body: "Refunds will not be issued in the following circumstances:\n• Incorrect or incomplete delivery address / uncontactable recipient at the delivery location.\n• Delayed receipt caused by recipient unavailability leading to product spoilage.\n• Quality complaints raised beyond 2 hours after delivery without photographic evidence.\n• Cancellation requests made after the fresh harvest has already been completed.",
  },
  {
    title: "7. Contact for Refund & Cancellation Support",
    body: "If you have any questions, wish to cancel an order, or need assistance with a refund, please contact us:\n• Business Name: Urban Trout (Proprietorship: Skindar Mohd Sideeq)\n• Helpline / WhatsApp: +91 84910 06127 (Alt: +91 70066 04148)\n• Email: info.urbantrout@gmail.com\n• Operating Address: Malabagh, Naseem Bagh, Srinagar, Jammu & Kashmir — 190006\n• Support Hours: Monday to Sunday, 8:00 AM – 8:00 PM IST",
  },
];

export default function RefundPolicyPage() {
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
            Compliance &amp; Consumer Protection
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
          Refund &amp; Cancellation Policy
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
