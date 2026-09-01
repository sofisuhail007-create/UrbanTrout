"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const C = {
  primary: "#72ddfd",
  onSurfVar: "#9fadb8",
  outline: "#6a7782",
  outlineVar: "#3d4a53",
};

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  return (
    <footer
      className="w-full mt-20"
      style={{ background: "#020d14", borderTop: "1px solid rgba(61,74,83,0.35)" }}
    >
      <div className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* 1. Brand & Entity Info */}
        <div>
          <div className="mb-4">
            <img
              src="/headerfooterlogo.png"
              alt="Urban Trout"
              className="h-9 md:h-10 w-auto object-contain"
            />
          </div>
          <p
            style={{
              fontFamily: '"Manrope", sans-serif',
              fontSize: "0.84rem",
              color: C.onSurfVar,
              lineHeight: 1.75,
              maxWidth: "280px",
              marginBottom: "0.75rem",
            }}
          >
            Fresh, locally farmed Rainbow Trout in Srinagar. Harvested live to order and delivered directly to your doorstep.
          </p>
          <span
            style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: "11px",
              color: C.outline,
              lineHeight: 1.5,
              display: "block",
            }}
          >
            Operated by <strong style={{ color: "#c4ebff" }}>Skindar Mohd Sideeq</strong>
          </span>
        </div>

        {/* 2. Explore */}
        <div>
          <h5
            style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: C.onSurfVar,
              fontWeight: 700,
              marginBottom: "1.25rem",
            }}
          >
            Explore
          </h5>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { href: "/shop", label: "Shop Fresh Catch" },
              { href: "/our-farm", label: "About Our Farm" },
              { href: "/shop/gutted-trout", label: "Cleaned & Gutted Trout" },
              { href: "/shop/whole-trout", label: "Whole Rainbow Trout" },
              { href: "/farm-visits", label: "Pre-Notify Farm Visit" },
              { href: "/contact", label: "Contact Us" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  style={{
                    fontFamily: '"Manrope", sans-serif',
                    fontSize: "0.85rem",
                    color: C.onSurfVar,
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  className="hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Customer Policies & Compliance (Mandatory for Razorpay) */}
        <div>
          <h5
            style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: C.onSurfVar,
              fontWeight: 700,
              marginBottom: "1.25rem",
            }}
          >
            Policies &amp; Support
          </h5>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { href: "/refund-policy", label: "Refund & Cancellation" },
              { href: "/shipping-policy", label: "Shipping & Delivery" },
              { href: "/privacy", label: "Privacy Policy" },
              { href: "/terms", label: "Terms of Service" },
              { href: "/contact", label: "Grievance Redressal" },
            ].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  style={{
                    fontFamily: '"Manrope", sans-serif',
                    fontSize: "0.85rem",
                    color: C.onSurfVar,
                    textDecoration: "none",
                    transition: "color 0.2s",
                  }}
                  className="hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* 4. Contact & Farm Location */}
        <div>
          <h5
            style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: "10px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: C.onSurfVar,
              fontWeight: 700,
              marginBottom: "1.25rem",
            }}
          >
            Contact &amp; Farm Location
          </h5>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "1.25rem" }}>
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.84rem", color: C.onSurfVar }}>Malabagh, Naseem Bagh</p>
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.84rem", color: C.onSurfVar }}>Srinagar — 190006, J&amp;K</p>
            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.76rem", color: C.outline }}>Near R P School (Girls Wing)</p>
            
            {/* Primary number */}
            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>Primary &amp; WhatsApp</span>
              <a
                href="tel:+918491006127"
                style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1rem", fontWeight: 700, color: C.primary, textDecoration: "none" }}
              >
                +91 84910 06127
              </a>
            </div>

            {/* Alternate number */}
            <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>Alternate</span>
              <a
                href="tel:+917006604148"
                style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.88rem", fontWeight: 600, color: C.onSurfVar, textDecoration: "none" }}
              >
                +91 70066 04148
              </a>
            </div>

            {/* Email */}
            <div style={{ marginTop: "4px" }}>
              <a
                href="mailto:info.urbantrout@gmail.com"
                style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.82rem", color: C.onSurfVar, textDecoration: "none" }}
                className="hover:text-primary transition-colors"
              >
                info.urbantrout@gmail.com
              </a>
            </div>
          </div>
          {/* Social links */}
          <div style={{ display: "flex", gap: "10px" }}>
            {/* WhatsApp */}
            <a
              href="https://wa.me/918491006127"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-xl transition-all"
              style={{
                width: "38px", height: "38px",
                border: `1px solid rgba(61,74,83,0.5)`,
                color: C.onSurfVar,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#25D366";
                (e.currentTarget as HTMLElement).style.color = "#25D366";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(61,74,83,0.5)";
                (e.currentTarget as HTMLElement).style.color = C.onSurfVar;
              }}
              aria-label="WhatsApp"
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
            </a>
            {/* Email */}
            <a
              href="mailto:info.urbantrout@gmail.com"
              className="flex items-center justify-center rounded-xl transition-all"
              style={{
                width: "38px", height: "38px",
                border: `1px solid rgba(61,74,83,0.5)`,
                color: C.onSurfVar,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = C.primary;
                (e.currentTarget as HTMLElement).style.color = C.primary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(61,74,83,0.5)";
                (e.currentTarget as HTMLElement).style.color = C.onSurfVar;
              }}
              aria-label="Email"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar with all compliance links */}
      <div
        className="max-w-7xl mx-auto px-8 py-5 flex flex-col md:flex-row justify-between items-center gap-4"
        style={{ borderTop: "1px solid rgba(61,74,83,0.25)" }}
      >
        <span
          style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: "11px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: C.outline,
          }}
        >
          © 2026 Urban Trout (Skindar Mohd Sideeq). Srinagar, J&amp;K. All rights reserved.
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", justifyContent: "center" }}>
          {[
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/terms", label: "Terms of Service" },
            { href: "/refund-policy", label: "Refund Policy" },
            { href: "/shipping-policy", label: "Shipping Policy" },
            { href: "/contact", label: "Contact Us" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: '"Inter", sans-serif',
                fontSize: "11px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: C.outline,
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              className="hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
