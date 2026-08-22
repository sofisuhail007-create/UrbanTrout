"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";

const C = {
  bg: "#031018", bgHigh: "#10212c", bgHighest: "#152834",
  primary: "#72ddfd", primaryCont: "#3aadcc", onPrimCont: "#002730",
  onSurface: "#dfedf9", onSurfVar: "#9fadb8", outline: "#6a7782", outlineVar: "#3d4a53",
};

export default function CheckoutPage() {
  const { items, total, updateQuantity } = useCart();
  const router = useRouter();
  const [deliveryMode, setDeliveryMode] = useState<"under5" | "over5" | "unavailable" | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");

  const deliveryFee = deliveryMode === "over5" ? 40 : 0;
  const grandTotal = total + deliveryFee;

  // Redirect empty cart to shop
  useEffect(() => {
    if (items.length === 0) {
      router.push("/shop");
    }
  }, [items, router]);

  const FARM_LAT = 34.144831;
  const FARM_LNG = 74.824280;
  const SRINAGAR_MAX_RADIUS_KM = 25;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const detectLocation = () => {
    setIsLocating(true);
    setLocationMsg("Locating...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const distanceInKm = calculateDistance(FARM_LAT, FARM_LNG, userLat, userLng);
          if (distanceInKm > SRINAGAR_MAX_RADIUS_KM) {
            setDeliveryMode("unavailable");
            setLocationMsg(`Out of zone (${distanceInKm.toFixed(1)}km away). We only deliver within Srinagar.`);
          } else {
            const isClose = distanceInKm <= 5;
            setDeliveryMode(isClose ? "under5" : "over5");
            setLocationMsg(
              isClose
                ? `Within 5km (${distanceInKm.toFixed(1)}km) — Free Delivery`
                : `Outside 5km (${distanceInKm.toFixed(1)}km) — ₹40 Fee`
            );
          }
          setIsLocating(false);
        },
        () => {
          setLocationMsg("Please allow location access and try again.");
          setIsLocating(false);
        }
      );
    } else {
      setLocationMsg("Geolocation not supported on this device.");
      setIsLocating(false);
    }
  };

  // Show nothing while redirecting (empty cart)
  if (items.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar }}>Redirecting to shop…</p>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <div className="max-w-7xl mx-auto px-6 pt-32 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* ─── Left: Checkout Form ─── */}
          <section className="lg:col-span-7 space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Link
                href="/shop"
                className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
                style={{ border: `1px solid rgba(61,74,83,0.6)`, color: C.onSurfVar }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </Link>
              <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 800, color: C.onSurface, letterSpacing: "-0.03em", margin: 0 }}>
                Checkout
              </h1>
            </div>

            {/* Main panel */}
            <div style={{ background: "rgba(16,33,44,0.7)", borderRadius: "16px", border: `1px solid rgba(114,221,253,0.1)`, padding: "2rem" }}>

              {/* Smart Delivery Section */}
              <div
                className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl mb-8"
                style={{ background: "rgba(3,16,24,0.6)", border: `1px solid rgba(61,74,83,0.5)` }}
              >
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2" style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                    Smart Delivery Pricing
                  </span>
                  {deliveryMode ? (
                    <div
                      className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{
                        background: deliveryMode === "unavailable" ? "rgba(239,68,68,0.1)" : "rgba(114,221,253,0.08)",
                        border: deliveryMode === "unavailable" ? "1px solid rgba(239,68,68,0.3)" : `1px solid rgba(114,221,253,0.25)`,
                        color: deliveryMode === "unavailable" ? "#f87171" : C.primary,
                      }}
                    >
                      {deliveryMode === "unavailable" ? (
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                      ) : (
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                      <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", fontWeight: 600 }}>{locationMsg}</span>
                    </div>
                  ) : (
                    <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.83rem", color: C.onSurfVar, marginTop: "4px" }}>
                      {locationMsg || "Auto-calculate your delivery charge"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={isLocating}
                  className="flex items-center gap-2 transition-all disabled:opacity-50"
                  style={{
                    padding: "10px 18px",
                    borderRadius: "10px",
                    background: C.primaryCont,
                    color: C.onPrimCont,
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    border: "none",
                    cursor: isLocating ? "not-allowed" : "pointer",
                  }}
                >
                  {isLocating ? (
                    <>
                      <svg className="animate-spin" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                      Detecting…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>
                      Detect Location
                    </>
                  )}
                </button>
              </div>

              <form id="checkout-form" className="space-y-8" onSubmit={(e) => {
                e.preventDefault();
                if (!deliveryMode || deliveryMode === "unavailable") {
                  alert("Please calculate a valid delivery zone first.");
                  return;
                }
                const formData = new FormData(e.currentTarget);
                const fullName = formData.get("fullName");
                const phone = formData.get("phone");
                const locality = formData.get("locality");
                const house = formData.get("house");
                const pincode = formData.get("pincode");

                let cartDetails = "";
                items.forEach(item => {
                  cartDetails += `- ${item.name} (${item.quantity} ${item.unit}): ₹${(item.price * item.quantity).toLocaleString("en-IN")}\n`;
                });

                const message = `*NEW HARVEST REQUEST* 🐟\n\n*Customer Details:*\nName: ${fullName}\nPhone: +91 ${phone}\nAddress: ${house}, ${locality}, ${pincode}\n\n*Requested Items:*\n${cartDetails}*Delivery Zone:* ${deliveryMode === "over5" ? "Outside 5km (₹" + deliveryFee + ")" : "Within 5km (Free)"}\n*Estimated Total:* ₹${grandTotal.toLocaleString("en-IN")}\n\n_Note: This is an estimated total. We will calculate the exact catch weight and send you the final invoice and payment link shortly._`;

                const orderPayload = {
                  customer_name: String(fullName),
                  customer_phone: String(phone),
                  customer_address: `${house}, ${locality}`,
                  customer_locality: String(locality),
                  customer_pincode: String(pincode),
                  items: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, unit: i.unit, image: i.image })),
                  subtotal: total,
                  delivery_fee: deliveryFee,
                  total: grandTotal,
                  delivery_zone: deliveryMode,
                  status: "pending",
                };
                supabase.from("orders").insert(orderPayload).then(() => {
                  supabase.from("customers").upsert({
                    phone: String(phone),
                    name: String(fullName),
                    locality: String(locality),
                    pincode: String(pincode),
                    last_order_at: new Date().toISOString(),
                  }, { onConflict: "phone" });
                });

                const encodedMessage = encodeURIComponent(message);
                window.open(`https://wa.me/917006604148?text=${encodedMessage}`, "_blank");
              }}>

                {/* Delivery Address */}
                <div>
                  <h2 className="flex items-center gap-2 mb-6" style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1rem", fontWeight: 700, color: C.primary }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    Srinagar Delivery Address
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                    {[
                      { label: "Full Name", name: "fullName", placeholder: "e.g. Sameer Ahmed", type: "text", span: false, required: true },
                      { label: "Phone Number (India)", name: "phone", placeholder: "10-digit mobile number", type: "tel", span: false, required: true, pattern: "[0-9]{10}", maxLength: 10, prefix: "+91" },
                      { label: "Locality / Landmark", name: "locality", placeholder: "Near Dal Lake, Boulevard Road", type: "text", span: true, required: true },
                      { label: "House No. / Building", name: "house", placeholder: "Plot 42, Sector B", type: "text", span: false, required: true },
                      { label: "Pin Code", name: "pincode", placeholder: "190001", type: "text", span: false, required: true },
                    ].map((f) => (
                      <div key={f.label} className={`flex flex-col ${f.span ? "md:col-span-2" : ""}`}>
                        <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                          {f.label}{f.required && <span style={{ color: "#f87171", marginLeft: "4px" }}>*</span>}
                        </label>
                        <div className="relative flex items-center">
                          {f.prefix && (
                            <span className="absolute left-4" style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontWeight: 600 }}>{f.prefix}</span>
                          )}
                          <input
                            type={f.type}
                            name={f.name}
                            required={f.required}
                            pattern={f.pattern}
                            maxLength={f.maxLength}
                            placeholder={f.placeholder}
                            style={{
                              width: "100%",
                              background: "rgba(3,16,24,0.8)",
                              border: `1px solid rgba(61,74,83,0.6)`,
                              borderRadius: "10px",
                              padding: f.prefix ? "12px 16px 12px 52px" : "12px 16px",
                              color: C.onSurface,
                              fontFamily: '"Manrope", sans-serif',
                              fontSize: "0.9rem",
                              outline: "none",
                            }}
                            className="focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <h2 className="flex items-center gap-2 mb-6" style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1rem", fontWeight: 700, color: C.primary }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    Payment Process
                  </h2>
                  <div className="space-y-3">
                    <label
                      className="flex items-center gap-4 p-4 rounded-xl cursor-pointer"
                      style={{ border: `1px solid rgba(114,221,253,0.3)`, background: "rgba(114,221,253,0.06)" }}
                    >
                      <input defaultChecked name="payment" type="radio" className="text-primary focus:ring-0 accent-teal-400" />
                      <div className="flex flex-col flex-1">
                        <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.9rem", color: C.onSurface }}>Payment Link via WhatsApp</span>
                        <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.78rem", color: C.onSurfVar }}>Sent after exact harvest weight is calculated</span>
                      </div>
                      <svg width="18" height="18" fill="none" stroke={C.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </label>

                    <div className="flex gap-3 p-4 rounded-xl" style={{ background: "rgba(3,16,24,0.5)", border: `1px solid rgba(61,74,83,0.4)` }}>
                      <svg width="16" height="16" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: "2px" }}>
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <div>
                        <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.onSurface, marginBottom: "4px" }}>Why do we do this?</p>
                        <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.78rem", color: C.onSurfVar, lineHeight: 1.65 }}>
                          Our trout is harvested exclusively to order. We cannot guarantee the exact weight until it is pulled from the water. You will be billed for the exact catch weight via a secure payment link sent to your WhatsApp before delivery.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </section>

          {/* ─── Right: Order Summary ─── */}
          <aside className="lg:col-span-5 sticky top-32 space-y-4">
            <div style={{ borderRadius: "16px", overflow: "hidden", background: "rgba(16,33,44,0.9)", border: `1px solid rgba(61,74,83,0.5)`, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
              {/* Summary header */}
              <div className="flex items-center justify-between p-5" style={{ borderBottom: `1px solid rgba(61,74,83,0.4)`, background: "rgba(21,40,52,0.8)" }}>
                <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800, fontSize: "1.1rem", color: C.onSurface }}>Order Summary</h2>
                <span style={{ background: "rgba(114,221,253,0.12)", color: C.primary, padding: "3px 12px", borderRadius: "100px", fontSize: "11px", fontFamily: '"Inter", sans-serif', fontWeight: 700, border: `1px solid rgba(114,221,253,0.25)` }}>
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="p-5 space-y-5">
                {/* Cart items */}
                <div className="space-y-4 max-h-72 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div style={{ width: "60px", height: "60px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, border: `1px solid rgba(61,74,83,0.4)` }}>
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-1">
                          <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.onSurface }}>{item.name}</h4>
                          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.primary, marginLeft: "8px" }}>
                            ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex items-center gap-0 mt-1 w-max rounded-lg overflow-hidden" style={{ border: `1px solid rgba(61,74,83,0.5)`, background: "rgba(3,16,24,0.6)" }}>
                          <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="w-7 h-6 flex items-center justify-center transition-colors" style={{ color: C.primary }}>−</button>
                          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "11px", color: C.onSurfVar, minWidth: "38px", textAlign: "center", fontWeight: 700 }}>{item.quantity} {item.unit}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-6 flex items-center justify-center transition-colors" style={{ color: C.primary }}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ height: "1px", background: "rgba(61,74,83,0.4)" }} />

                {/* Totals */}
                <div className="space-y-2" style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem" }}>
                  <div className="flex justify-between">
                    <span style={{ color: C.onSurfVar }}>Subtotal</span>
                    <span style={{ color: C.onSurface }}>₹{total.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2" style={{ color: C.onSurfVar }}>
                      Delivery Fee
                      {deliveryMode === "under5" && <span style={{ fontSize: "9px", background: "rgba(114,221,253,0.1)", color: C.primary, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Free</span>}
                      {deliveryMode === "over5" && <span style={{ fontSize: "9px", background: "rgba(61,74,83,0.4)", color: C.onSurfVar, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>5km+</span>}
                      {deliveryMode === "unavailable" && <span style={{ fontSize: "9px", background: "rgba(239,68,68,0.1)", color: "#f87171", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>N/A</span>}
                    </span>
                    <span style={{ color: C.primary, fontWeight: 700 }}>
                      {!deliveryMode ? "—" : deliveryMode === "unavailable" ? "—" : deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}
                    </span>
                  </div>
                </div>

                <div style={{ height: "1px", background: `rgba(114,221,253,0.15)` }} />

                {/* Grand total + Security */}
                <div className="flex justify-between items-end">
                  <div>
                    <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.outline, marginBottom: "4px" }}>Total Payable</p>
                    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2rem", fontWeight: 800, color: C.primary, letterSpacing: "-0.04em", lineHeight: 1 }}>
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-40">
                    <svg width="14" height="14" fill="none" stroke={C.onSurfVar} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    <svg width="14" height="14" fill="none" stroke={C.onSurfVar} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={!deliveryMode || deliveryMode === "unavailable"}
                  className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
                  style={{
                    height: "52px",
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "0.82rem",
                    background: !deliveryMode || deliveryMode === "unavailable" ? "rgba(61,74,83,0.5)" : "#25D366",
                    color: !deliveryMode || deliveryMode === "unavailable" ? C.onSurfVar : "#fff",
                    border: "none",
                    boxShadow: !deliveryMode || deliveryMode === "unavailable" ? "none" : "0 0 24px rgba(37,211,102,0.35)",
                  }}
                >
                  {!deliveryMode ? (
                    "Detect Location First"
                  ) : deliveryMode === "unavailable" ? (
                    "Out of Delivery Zone"
                  ) : (
                    <>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                      </svg>
                      Send Request via WhatsApp
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
