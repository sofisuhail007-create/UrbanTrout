"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const C = {
  bg: "#031018",
  bgHigh: "#10212c",
  bgHighest: "#152834",
  primary: "#72ddfd",
  primaryCont: "#3aadcc",
  onPrimCont: "#002730",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
  outline: "#6a7782",
  outlineVar: "#3d4a53",
};

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6Le7xJQtAAAAAGZUTG4KU1grtYTF_1nVRAiSrL2l";

declare global {
  interface Window {
    grecaptcha: any;
  }
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "Home Delivery Inquiry",
    message: "",
  });

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Load Google reCAPTCHA v3 script dynamically
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scriptId = "google-recaptcha-v3";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      let token = "";
      if (window.grecaptcha) {
        token = await new Promise<string>((resolve) => {
          window.grecaptcha.ready(async () => {
            try {
              const res = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "contact_submit" });
              resolve(res);
            } catch {
              resolve("");
            }
          });
        });
      }

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          token,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send your message.");
      }

      setStatus("success");
      setFormData({
        name: "",
        phone: "",
        email: "",
        subject: "Home Delivery Inquiry",
        message: "",
      });

    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again or WhatsApp us.");
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="pt-28 pb-20 px-6">
      <div className="max-w-7xl mx-auto">

        {/* ─── Breadcrumb ─── */}
        <nav className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400 mb-8">
          <Link href="/" className="hover:text-cyan-400 transition-colors">Home</Link>
          <span className="opacity-40">/</span>
          <span className="text-cyan-400">Contact Us</span>
        </nav>

        {/* ─── Hero Header ─── */}
        <div className="max-w-3xl mb-12">
          <span
            style={{
              fontFamily: '"Inter", sans-serif',
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: C.primary,
              display: "block",
              marginBottom: "0.75rem",
            }}
          >
            Direct Farm Connect
          </span>
          <h1
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: C.onSurface,
              marginBottom: "1rem",
            }}
          >
            We&apos;re Here to Help You with <br />
            <span style={{ color: "#63cfee" }}>Fresh Rainbow Trout</span>
          </h1>
          <p
            style={{
              fontFamily: '"Manrope", sans-serif',
              fontSize: "1.05rem",
              color: C.onSurfVar,
              lineHeight: 1.75,
            }}
          >
            Have a question regarding same-day delivery in Srinagar, bulk supply for events, or visiting our Urban Trout Farm &amp; live vending center? Reach out directly to our team.
          </p>
        </div>

        {/* ─── Main Grid: Contact Info & Interactive Form ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

          {/* ── Left Column: Farm Information & Instant Channels (5 cols) ── */}
          <div className="lg:col-span-5 space-y-6">

            {/* Farm Location Card */}
            <div
              className="p-7 rounded-2xl"
              style={{
                background: "rgba(16,33,44,0.85)",
                border: "1px solid rgba(114,221,253,0.15)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(114,221,253,0.15)", color: C.primary }}
                >
                  <span className="material-symbols-outlined text-xl">location_on</span>
                </div>
                <div>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>
                    Farm &amp; Live Vending Center
                  </span>
                  <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.15rem", fontWeight: 700, color: C.onSurface, margin: 0 }}>
                    Urban Trout Farm &amp; Vending Center
                  </h3>
                </div>
              </div>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", color: C.onSurfVar, lineHeight: 1.7, marginBottom: "1.25rem" }}>
                Malabagh, Naseem Bagh, Srinagar, Jammu &amp; Kashmir — 190006<br />
                <span className="text-slate-400 text-xs">(Near R P School Girls Wing)</span>
              </p>
              <a
                href="https://maps.google.com/?q=34.144709,74.824525"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                <span>Open in Google Maps</span>
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </a>
            </div>

            {/* Direct Phone & WhatsApp Card */}
            <div
              className="p-7 rounded-2xl"
              style={{
                background: "rgba(16,33,44,0.85)",
                border: "1px solid rgba(114,221,253,0.15)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              }}
            >
              <div className="space-y-5">
                {/* Primary Number */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>
                      Primary Hotline & WhatsApp
                    </span>
                    <a
                      href="tel:+918491006127"
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "1.25rem",
                        fontWeight: 800,
                        color: C.primary,
                        display: "block",
                        textDecoration: "none",
                        marginTop: "2px",
                      }}
                    >
                      +91 84910 06127
                    </a>
                  </div>
                  <a
                    href="https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20I%20have%20an%20inquiry."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-transform hover:scale-105"
                    style={{ background: "#25D366" }}
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </a>
                </div>

                <div style={{ height: "1px", background: "rgba(61,74,83,0.4)" }} />

                {/* Alternate Number */}
                <div>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>
                    Alternate Farm Line
                  </span>
                  <a
                    href="tel:+917006604148"
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: C.onSurface,
                      display: "block",
                      textDecoration: "none",
                      marginTop: "2px",
                    }}
                  >
                    +91 70066 04148
                  </a>
                </div>

                <div style={{ height: "1px", background: "rgba(61,74,83,0.4)" }} />

                {/* Email Address */}
                <div>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>
                    Official Email
                  </span>
                  <a
                    href="mailto:info.urbantrout@gmail.com"
                    style={{
                      fontFamily: '"Manrope", sans-serif',
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: C.primary,
                      display: "block",
                      textDecoration: "none",
                      marginTop: "2px",
                    }}
                  >
                    info.urbantrout@gmail.com
                  </a>
                </div>

                <div style={{ height: "1px", background: "rgba(61,74,83,0.4)" }} />

                {/* Working Hours */}
                <div>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>
                    Harvest & Delivery Hours
                  </span>
                  <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", color: C.onSurface, margin: "2px 0 0", fontWeight: 600 }}>
                    Monday – Sunday: 8:00 AM – 8:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Column: Interactive Contact Form Protected by reCAPTCHA (7 cols) ── */}
          <div className="lg:col-span-7">
            <div
              className="p-8 md:p-10 rounded-2xl"
              style={{
                background: "rgba(16,33,44,0.9)",
                border: "1px solid rgba(114,221,253,0.2)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              }}
            >
              <div className="mb-8">
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>
                  Send an Inquiry
                </span>
                <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 800, color: C.onSurface, margin: "4px 0 0" }}>
                  Message the Farm Team
                </h2>
                <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: C.onSurfVar, marginTop: "4px" }}>
                  Fill in your details below. We usually respond within an hour during farm hours.
                </p>
              </div>

              {status === "success" ? (
                <div className="text-center py-10 space-y-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: "rgba(37,211,102,0.15)", border: "1px solid #25D366" }}
                  >
                    <svg width="32" height="32" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem", fontWeight: 800, color: C.onSurface }}>
                    Message Sent Successfully!
                  </h3>
                  <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.95rem", color: C.onSurfVar, maxWidth: "450px", margin: "0 auto" }}>
                    Thank you for reaching out. A representative from our Urban Trout Farm team will contact you shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="mt-6 px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-colors"
                    style={{ background: C.primaryCont, color: C.onPrimCont }}
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">

                  {status === "error" && (
                    <div
                      className="p-4 rounded-xl flex items-center gap-3 text-sm"
                      style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Full Name */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Your Full Name <span style={{ color: "#f87171" }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Sameer Ahmed"
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)",
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem",
                        }}
                      />
                    </div>

                    {/* Phone Number */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Phone Number (WhatsApp) <span style={{ color: "#f87171" }}>*</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4 font-bold text-slate-500 text-sm">+91</span>
                        <input
                          type="tel"
                          required
                          pattern="[0-9]{10}"
                          maxLength={10}
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="10-digit number"
                          style={{
                            width: "100%", background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)",
                            borderRadius: "10px", padding: "12px 16px 12px 52px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Email */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="your.email@gmail.com"
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)",
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem",
                        }}
                      />
                    </div>

                    {/* Subject / Topic */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Topic / Subject
                      </label>
                      <select
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)",
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem",
                        }}
                      >
                        <option value="Home Delivery Inquiry">Home Delivery (5km Radius)</option>
                        <option value="Bulk / Event Order">Bulk Order / Special Event</option>
                        <option value="Restaurant Supply">Hotel & Restaurant Supply</option>
                        <option value="Farm Gate Pickup">Farm Gate Pickup Inquiry</option>
                        <option value="Other Question">General Question</option>
                      </select>
                    </div>
                  </div>

                  {/* Message textarea */}
                  <div className="flex flex-col">
                    <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                      Your Message <span style={{ color: "#f87171" }}>*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Write your questions or order requirements here..."
                      style={{
                        width: "100%", background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)",
                        borderRadius: "10px", padding: "14px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", lineHeight: 1.6,
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold uppercase tracking-widest transition-all active:scale-[0.99] disabled:opacity-50"
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontSize: "0.9rem",
                      background: C.primaryCont,
                      color: C.onPrimCont,
                      boxShadow: "0 0 25px rgba(58,173,204,0.35)",
                      border: "none",
                      cursor: status === "loading" ? "not-allowed" : "pointer",
                    }}
                  >
                    {status === "loading" ? (
                      <>
                        <svg className="animate-spin" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        Sending Message…
                      </>
                    ) : (
                      <>
                        Send Message to Farm
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                      </>
                    )}
                  </button>

                  {/* ─── Google reCAPTCHA Mandated Inline Disclaimer (Replaces Floating Badge) ─── */}
                  <p
                    className="text-center text-xs text-slate-500 pt-2"
                    style={{ fontFamily: '"Manrope", sans-serif', lineHeight: 1.6 }}
                  >
                    This site is protected by reCAPTCHA and the Google{" "}
                    <a
                      href="https://policies.google.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      Privacy Policy
                    </a>{" "}
                    and{" "}
                    <a
                      href="https://policies.google.com/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      Terms of Service
                    </a>{" "}
                    apply.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
