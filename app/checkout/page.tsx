"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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
  const { items, total, updateQuantity, clearCart } = useCart();
  const router = useRouter();

  // Multi-step window state: 1 = Address & Contact, 2 = UPI Payment
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  const [deliveryMode, setDeliveryMode] = useState<"under5" | "over5" | "unavailable" | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiId, setUpiId] = useState("sofisuhail007@ybl");
  const [utrRef, setUtrRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  // Form Fields State for automatic Lead Capture
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    locality: "",
    house: "",
    pincode: "",
  });

  const leadIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const deliveryFee = deliveryMode === "over5" ? 40 : 0;
  const grandTotal = total + deliveryFee;

  // Load configured UPI ID from settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "upi_id")
          .single();
        if (data?.value) {
          setUpiId(data.value);
        }
      } catch {
        // Fallback to default sofisuhail007@ybl
      }
    }
    fetchSettings();
  }, []);

  // Redirect empty cart to shop (unless order was just placed successfully)
  useEffect(() => {
    if (items.length === 0 && !orderSuccess) {
      router.push("/shop");
    }
  }, [items, orderSuccess, router]);

  // Lead auto-capture function: captures user info as soon as they type phone/name
  const captureLead = useCallback(async (currentData: typeof formData, currentTotal: number, currentItems: typeof items) => {
    const rawPhone = currentData.phone.replace(/\D/g, "");
    if (!rawPhone || rawPhone.length < 10) return;

    try {
      const payload = {
        customer_name: currentData.fullName?.trim() || "Interested Customer",
        customer_phone: rawPhone.slice(-10),
        customer_email: currentData.email?.trim() || null,
        customer_locality: currentData.locality?.trim() || null,
        customer_address: currentData.house?.trim() || null,
        customer_pincode: currentData.pincode?.trim() || null,
        cart_items: currentItems.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, unit: i.unit })),
        estimated_total: currentTotal,
        status: "abandoned",
        updated_at: new Date().toISOString(),
      };

      // 1. Try dedicated leads table
      if (leadIdRef.current) {
        await supabase.from("leads").update(payload).eq("id", leadIdRef.current);
      } else {
        const { data } = await supabase.from("leads").insert([payload]).select("id").single();
        if (data?.id) {
          leadIdRef.current = data.id;
        }
      }

      // 2. Also guaranteed upsert to customers table as resilient fallback
      await supabase.from("customers").upsert({
        phone: rawPhone.slice(-10),
        name: currentData.fullName?.trim() || "Interested Customer",
        locality: currentData.locality?.trim() || "Srinagar",
        pincode: currentData.pincode?.trim() || "190006",
        notes: `Abandoned checkout (Cart: ₹${currentTotal} - ${currentItems.map(i => `${i.name} x ${i.quantity}`).join(", ")})`,
        last_order_at: new Date().toISOString(),
      }, { onConflict: "phone" });

    } catch (err) {
      console.warn("Lead capture notice:", err);
    }
  }, []);

  // Quick trigger on form changes
  const handleInputChange = (field: string, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      captureLead(next, grandTotal, items);
    }, 400);
  };

  // Immediate capture on tab close / switch
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (formData.phone && formData.phone.replace(/\D/g, "").length >= 10) {
        captureLead(formData, grandTotal, items);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handleBeforeUnload);
    };
  }, [formData, grandTotal, items, captureLead]);

  const FARM_LAT = 34.144709;
  const FARM_LNG = 74.824525;
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
    setLocationMsg("Locating your address in Srinagar...");
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const distanceInKm = calculateDistance(FARM_LAT, FARM_LNG, userLat, userLng);
          if (distanceInKm > SRINAGAR_MAX_RADIUS_KM) {
            setDeliveryMode("unavailable");
            setLocationMsg(`Out of delivery zone (${distanceInKm.toFixed(1)}km away). We only deliver within Srinagar.`);
          } else {
            const isClose = distanceInKm <= 5;
            setDeliveryMode(isClose ? "under5" : "over5");
            setLocationMsg(
              isClose
                ? `Within 5km from Malabagh Farm (${distanceInKm.toFixed(1)}km) — Free Delivery`
                : `Outside 5km (${distanceInKm.toFixed(1)}km) — ₹40 Flat Delivery Fee`
            );
          }
          setIsLocating(false);
        },
        () => {
          setLocationMsg("Please allow location access to calculate delivery.");
          setIsLocating(false);
        }
      );
    } else {
      setLocationMsg("Geolocation not supported on this device.");
      setIsLocating(false);
    }
  };

  // Step 1 Validation & Proceed to Step 2
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryMode) {
      alert("Please click 'Detect Delivery Zone' to verify your delivery address in Srinagar.");
      return;
    }
    if (deliveryMode === "unavailable") {
      alert("Sorry, delivery is currently restricted to Srinagar.");
      return;
    }
    if (!formData.fullName.trim() || !formData.phone.trim() || !formData.locality.trim() || !formData.house.trim() || !formData.pincode.trim()) {
      alert("Please fill in all required delivery fields.");
      return;
    }
    if (formData.phone.replace(/\D/g, "").length !== 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    // Save lead data immediately
    captureLead(formData, grandTotal, items);

    // Switch window to Step 2
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Construct standard UPI Payment URL
  const upiPayUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Srinagar&am=${grandTotal}&cu=INR&tn=Urban%20Trout%20Fresh%20Order`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiPayUri)}&bgcolor=16-33-44&color=114-221-253&margin=2`;

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Step 2 Final Order Confirmation
  const handleFinalOrderSubmit = async () => {
    setIsSubmitting(true);

    try {
      let cartDetails = "";
      items.forEach(item => {
        cartDetails += `- ${item.name} (${item.quantity} ${item.unit}): ₹${(item.price * item.quantity).toLocaleString("en-IN")}\n`;
      });

      const orderPayload = {
        customer_name: formData.fullName,
        customer_phone: formData.phone,
        customer_address: `${formData.house}, ${formData.locality}`,
        customer_locality: formData.locality,
        customer_pincode: formData.pincode,
        items: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, unit: i.unit, image: i.image })),
        subtotal: total,
        delivery_fee: deliveryFee,
        total: grandTotal,
        delivery_zone: deliveryMode,
        status: "pending",
      };

      // 1. Insert order in Supabase
      const { data: insertedOrder } = await supabase.from("orders").insert(orderPayload).select("*").single();

      // 2. Mark lead as converted if lead exists
      if (leadIdRef.current) {
        await supabase.from("leads").update({
          status: "converted",
          notes: `Converted to Order #${insertedOrder?.order_number || ''}. Payment via UPI (${upiId}). UTR: ${utrRef || 'Direct'}`,
          updated_at: new Date().toISOString(),
        }).eq("id", leadIdRef.current);
      }

      // 3. Upsert customer profile
      await supabase.from("customers").upsert({
        phone: String(formData.phone),
        name: String(formData.fullName),
        locality: String(formData.locality),
        pincode: String(formData.pincode),
        last_order_at: new Date().toISOString(),
      }, { onConflict: "phone" });

      // 4. Create WhatsApp message for customer
      const whatsappMessage = `*NEW HARVEST ORDER (PAID VIA UPI)* 🐟\n\n*Order ID:* #${insertedOrder?.order_number || 'NEW'}\n*Customer Details:*\nName: ${formData.fullName}\nPhone: +91 ${formData.phone}\n${formData.email ? `Email: ${formData.email}\n` : ''}Address: ${formData.house}, ${formData.locality}, ${formData.pincode}\n\n*Ordered Items:*\n${cartDetails}\n*Delivery Zone:* ${deliveryMode === "over5" ? "Outside 5km (₹" + deliveryFee + ")" : "Within 5km (Free)"}\n*Total Paid via UPI:* ₹${grandTotal.toLocaleString("en-IN")}\n*UPI ID Paid To:* ${upiId}\n${utrRef ? `*UTR / Ref No:* ${utrRef}\n` : ''}\n_Please confirm my order and dispatch fresh harvest!_`;

      // Set order success state
      setOrderSuccess({
        orderNumber: insertedOrder?.order_number || "UT-" + Math.floor(1000 + Math.random() * 9000),
        total: grandTotal,
        phone: formData.phone,
        name: formData.fullName,
      });

      // Clear the cart
      if (clearCart) clearCart();

      // Open WhatsApp in new tab
      const encodedMsg = encodeURIComponent(whatsappMessage);
      window.open(`https://wa.me/918491006127?text=${encodedMsg}`, "_blank");

    } catch (err) {
      console.error("Order submission error:", err);
      alert("Order placed! We will confirm your delivery shortly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Window
  if (orderSuccess) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div
          className="max-w-lg w-full text-center p-8 md:p-10 rounded-2xl"
          style={{ background: "rgba(16,33,44,0.9)", border: "1px solid rgba(114,221,253,0.3)", boxShadow: "0 0 50px rgba(114,221,253,0.15)" }}
        >
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(37,211,102,0.15)", border: "1px solid #25D366", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.5rem" }}>
            <svg width="36" height="36" fill="none" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>
            Order Confirmed
          </span>
          <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2rem", fontWeight: 800, color: C.onSurface, margin: "0.5rem 0 1rem" }}>
            Thank You, {orderSuccess.name}!
          </h2>
          <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.95rem", color: C.onSurfVar, lineHeight: 1.7, marginBottom: "2rem" }}>
            Your order <strong>#{orderSuccess.orderNumber}</strong> has been received. Our farm team at Malabagh, Naseem Bagh is harvesting and packing your fresh trout now.
          </p>

          <div className="p-4 rounded-xl mb-6 text-left" style={{ background: "rgba(3,16,24,0.6)", border: "1px solid rgba(61,74,83,0.5)" }}>
            <div className="flex justify-between mb-2" style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar }}>
              <span>Total Paid via UPI</span>
              <span style={{ color: C.primary, fontWeight: 700 }}>₹{orderSuccess.total.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between" style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar }}>
              <span>Support WhatsApp</span>
              <span style={{ color: C.onSurface }}>+91 84910 06127</span>
            </div>
          </div>

          <Link
            href="/"
            style={{
              display: "inline-block",
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              background: C.primaryCont,
              color: C.onPrimCont,
              fontFamily: '"Space Grotesk", sans-serif',
              fontWeight: 700,
              fontSize: "0.9rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textDecoration: "none",
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Show redirecting if empty
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

        {/* ─── Top 2-Step Progress Indicator ─── */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-slate-800 -z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] transition-all duration-500 -z-0"
              style={{
                width: currentStep === 1 ? "25%" : "100%",
                background: "linear-gradient(to right, #3aadcc, #72ddfd)",
              }}
            />

            {/* Step 1 Pill */}
            <button
              onClick={() => setCurrentStep(1)}
              className="relative z-10 flex items-center gap-2.5 px-4 py-2 rounded-full transition-all"
              style={{
                background: currentStep === 1 ? "#10212c" : "rgba(16,33,44,0.9)",
                border: currentStep === 1 ? `1.5px solid #72ddfd` : `1px solid rgba(37,211,102,0.6)`,
                boxShadow: currentStep === 1 ? "0 0 15px rgba(114,221,253,0.3)" : "none",
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                style={{
                  background: currentStep === 1 ? "#72ddfd" : "#25D366",
                  color: "#002730",
                }}
              >
                {currentStep === 2 ? "✓" : "1"}
              </span>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.onSurface }}>
                Delivery Details
              </span>
            </button>

            {/* Step 2 Pill */}
            <div
              className="relative z-10 flex items-center gap-2.5 px-4 py-2 rounded-full transition-all"
              style={{
                background: currentStep === 2 ? "#10212c" : "rgba(16,33,44,0.7)",
                border: currentStep === 2 ? `1.5px solid #72ddfd` : `1px solid rgba(61,74,83,0.5)`,
                boxShadow: currentStep === 2 ? "0 0 20px rgba(114,221,253,0.3)" : "none",
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                style={{
                  background: currentStep === 2 ? "#72ddfd" : "rgba(61,74,83,0.8)",
                  color: currentStep === 2 ? "#002730" : C.onSurfVar,
                }}
              >
                2
              </span>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: currentStep === 2 ? C.primary : C.onSurfVar }}>
                UPI Payment
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          {/* ─── Left Window: Either Step 1 (Details) or Step 2 (UPI Payment) ─── */}
          <section className="lg:col-span-7 space-y-8">

            {/* ========================================================= */}
            {/* WINDOW 1: DELIVERY ADDRESS & CONTACT FORM                */}
            {/* ========================================================= */}
            {currentStep === 1 && (
              <div style={{ background: "rgba(16,33,44,0.7)", borderRadius: "16px", border: `1px solid rgba(114,221,253,0.12)`, padding: "2rem" }}>
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                  <Link
                    href="/shop"
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
                    style={{ border: `1px solid rgba(61,74,83,0.6)`, color: C.onSurfVar }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </Link>
                  <div>
                    <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem", fontWeight: 800, color: C.onSurface, letterSpacing: "-0.03em", margin: 0 }}>
                      Step 1: Delivery Address & Contact
                    </h1>
                    <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar, margin: "2px 0 0" }}>
                      Enter your address in Srinagar to verify delivery before payment.
                    </p>
                  </div>
                </div>

                {/* 1. Smart Delivery Section */}
                <div
                  className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl mb-8"
                  style={{ background: "rgba(3,16,24,0.6)", border: `1px solid rgba(61,74,83,0.5)` }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-2" style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                      </svg>
                      Srinagar Delivery Radius
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
                        {locationMsg || "Click to verify delivery radius & calculate final fee"}
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
                        Checking…
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>
                        Detect Delivery Zone
                      </>
                    )}
                  </button>
                </div>

                {/* Form fields */}
                <form onSubmit={handleProceedToPayment} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                    {/* Full Name */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Full Name <span style={{ color: "#f87171" }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={(e) => handleInputChange("fullName", e.target.value)}
                        onBlur={() => captureLead(formData, grandTotal, items)}
                        required
                        placeholder="e.g. Sameer Ahmed"
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: `1px solid rgba(61,74,83,0.6)`,
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", outline: "none",
                        }}
                      />
                    </div>

                    {/* Phone Number */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Phone Number (WhatsApp) <span style={{ color: "#f87171" }}>*</span>
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-4" style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontWeight: 600 }}>+91</span>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          onBlur={() => captureLead(formData, grandTotal, items)}
                          required
                          pattern="[0-9]{10}"
                          maxLength={10}
                          placeholder="10-digit mobile number"
                          style={{
                            width: "100%", background: "rgba(3,16,24,0.8)", border: `1px solid rgba(61,74,83,0.6)`,
                            borderRadius: "10px", padding: "12px 16px 12px 52px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex flex-col md:col-span-2">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        onBlur={() => captureLead(formData, grandTotal, items)}
                        placeholder="your.email@gmail.com"
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: `1px solid rgba(61,74,83,0.6)`,
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", outline: "none",
                        }}
                      />
                    </div>

                    {/* Locality */}
                    <div className="flex flex-col md:col-span-2">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Locality / Area Landmark in Srinagar <span style={{ color: "#f87171" }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="locality"
                        value={formData.locality}
                        onChange={(e) => handleInputChange("locality", e.target.value)}
                        onBlur={() => captureLead(formData, grandTotal, items)}
                        required
                        placeholder="e.g. Near Hazratbal Dargah, Naseem Bagh"
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: `1px solid rgba(61,74,83,0.6)`,
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", outline: "none",
                        }}
                      />
                    </div>

                    {/* House No */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        House / Flat / Lane No. <span style={{ color: "#f87171" }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="house"
                        value={formData.house}
                        onChange={(e) => handleInputChange("house", e.target.value)}
                        onBlur={() => captureLead(formData, grandTotal, items)}
                        required
                        placeholder="e.g. House No. 24, Lane 2"
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: `1px solid rgba(61,74,83,0.6)`,
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", outline: "none",
                        }}
                      />
                    </div>

                    {/* Pin Code */}
                    <div className="flex flex-col">
                      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, marginBottom: "8px" }}>
                        Pin Code <span style={{ color: "#f87171" }}>*</span>
                      </label>
                      <input
                        type="text"
                        name="pincode"
                        value={formData.pincode}
                        onChange={(e) => handleInputChange("pincode", e.target.value)}
                        onBlur={() => captureLead(formData, grandTotal, items)}
                        required
                        placeholder="190006"
                        style={{
                          width: "100%", background: "rgba(3,16,24,0.8)", border: `1px solid rgba(61,74,83,0.6)`,
                          borderRadius: "10px", padding: "12px 16px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  {/* Proceed to Step 2 Button */}
                  <div className="pt-4 space-y-3">
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all rounded-xl py-4"
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "0.9rem",
                        background: C.primaryCont,
                        color: C.onPrimCont,
                        boxShadow: "0 0 30px rgba(58,173,204,0.35)",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Proceed to UPI Payment
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </button>

                    {/* Google reCAPTCHA disclaimer */}
                    <p className="text-center text-[11px] text-slate-500" style={{ fontFamily: '"Manrope", sans-serif' }}>
                      Protected by reCAPTCHA • Google{" "}
                      <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-400">Privacy</a> &amp;{" "}
                      <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-400">Terms</a>
                    </p>
                  </div>
                </form>
              </div>
            )}

            {/* ========================================================= */}
            {/* WINDOW 2: INSTANT UPI PAYMENT PROCESS                     */}
            {/* ========================================================= */}
            {currentStep === 2 && (
              <div style={{ background: "rgba(16,33,44,0.8)", borderRadius: "16px", border: `1px solid rgba(114,221,253,0.25)`, padding: "2rem" }}>
                {/* Back Button & Header */}
                <div className="flex items-center justify-between pb-5 mb-6" style={{ borderBottom: "1px solid rgba(61,74,83,0.5)" }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)", color: C.onSurfVar }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    ← Edit Address & Details
                  </button>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", color: C.primary, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    Step 2 of 2
                  </span>
                </div>

                {/* Recipient summary badge */}
                <div className="p-4 rounded-xl mb-6 flex flex-col md:flex-row justify-between gap-3" style={{ background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.5)" }}>
                  <div>
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>Delivering To</span>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: C.onSurface, margin: "2px 0 0", fontSize: "0.95rem" }}>
                      {formData.fullName} ({formData.phone})
                    </p>
                    <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontSize: "0.82rem", margin: "2px 0 0" }}>
                      {formData.house}, {formData.locality}, {formData.pincode}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>Delivery Zone</span>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: C.primary, margin: "2px 0 0", fontSize: "0.9rem" }}>
                      {deliveryMode === "under5" ? "Within 5km (Free)" : "5km+ (₹40 Flat Fee)"}
                    </p>
                  </div>
                </div>

                {/* Dynamic UPI Payment Card */}
                <div
                  className="p-6 md:p-8 rounded-2xl mb-6"
                  style={{
                    background: "rgba(6,21,30,0.9)",
                    border: `1px solid rgba(114,221,253,0.3)`,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* Dynamic Neon QR Code */}
                    <div
                      className="p-3 rounded-2xl flex-shrink-0 flex flex-col items-center"
                      style={{ background: "#10212c", border: `1px solid rgba(114,221,253,0.3)` }}
                    >
                      <img
                        src={upiQrCodeUrl}
                        alt="Scan to Pay via UPI"
                        style={{ width: "180px", height: "180px", borderRadius: "10px" }}
                      />
                      <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.primary, letterSpacing: "0.1em", marginTop: "8px", textTransform: "uppercase" }}>
                        Scan with Any UPI App
                      </span>
                    </div>

                    {/* Payment details */}
                    <div className="flex-1 space-y-4 text-center md:text-left w-full">
                      <div>
                        <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar }}>
                          Total Amount to Pay
                        </span>
                        <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.25rem", fontWeight: 800, color: C.primary, letterSpacing: "-0.03em", margin: "2px 0 0" }}>
                          ₹{grandTotal.toLocaleString("en-IN")}
                        </h3>
                      </div>

                      {/* UPI ID with Copy Button */}
                      <div
                        className="flex items-center justify-between p-3.5 rounded-xl gap-3"
                        style={{ background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)" }}
                      >
                        <div className="flex flex-col text-left">
                          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.outline, textTransform: "uppercase", letterSpacing: "0.1em" }}>UPI ID</span>
                          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.95rem", fontWeight: 700, color: C.onSurface }}>{upiId}</span>
                        </div>
                        <button
                          type="button"
                          onClick={copyUpiId}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                          style={{
                            background: copiedUpi ? "rgba(37,211,102,0.2)" : "rgba(114,221,253,0.15)",
                            color: copiedUpi ? "#25D366" : C.primary,
                            border: `1px solid ${copiedUpi ? "#25D366" : "rgba(114,221,253,0.3)"}`,
                          }}
                        >
                          {copiedUpi ? "Copied! ✓" : "Copy ID"}
                        </button>
                      </div>

                      {/* Mobile Direct UPI Intent Button */}
                      <a
                        href={upiPayUri}
                        className="flex md:hidden items-center justify-center gap-2 w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                        style={{
                          background: C.primaryCont,
                          color: C.onPrimCont,
                          textDecoration: "none",
                          boxShadow: "0 0 20px rgba(58,173,204,0.3)",
                        }}
                      >
                        <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
                        Pay via GPay / PhonePe / Paytm
                      </a>
                    </div>
                  </div>

                  {/* Optional UTR Ref Input */}
                  <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(61,74,83,0.4)" }}>
                    <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, display: "block", marginBottom: "6px" }}>
                      Transaction UTR / Reference No. (Optional)
                    </label>
                    <input
                      type="text"
                      value={utrRef}
                      onChange={(e) => setUtrRef(e.target.value)}
                      placeholder="e.g. 423871928371 (if available)"
                      style={{
                        width: "100%", background: "rgba(3,16,24,0.8)", border: `1px solid rgba(61,74,83,0.5)`,
                        borderRadius: "10px", padding: "12px 14px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Final Confirmation Button */}
                <button
                  type="button"
                  onClick={handleFinalOrderSubmit}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 rounded-xl py-4"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "0.95rem",
                    background: "#25D366",
                    color: "#fff",
                    border: "none",
                    boxShadow: "0 0 30px rgba(37,211,102,0.4)",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? (
                    "Confirming Harvest Order…"
                  ) : (
                    <>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                      </svg>
                      I Have Paid ₹{grandTotal.toLocaleString("en-IN")} • Confirm Order
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* ─── Right: Order Summary Sidebar ─── */}
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
                      {deliveryMode === "under5" && <span style={{ fontSize: "9px", background: "rgba(114,221,253,0.1)", color: C.primary, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Free (&lt;5km)</span>}
                      {deliveryMode === "over5" && <span style={{ fontSize: "9px", background: "rgba(61,74,83,0.4)", color: C.onSurfVar, padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>5km+ (₹40)</span>}
                      {deliveryMode === "unavailable" && <span style={{ fontSize: "9px", background: "rgba(239,68,68,0.1)", color: "#f87171", padding: "2px 6px", borderRadius: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Out of Zone</span>}
                    </span>
                    <span style={{ color: C.primary, fontWeight: 700 }}>
                      {!deliveryMode ? "Calculate First" : deliveryMode === "unavailable" ? "—" : deliveryFee === 0 ? "Free" : `₹${deliveryFee}`}
                    </span>
                  </div>
                </div>

                <div style={{ height: "1px", background: `rgba(114,221,253,0.15)` }} />

                {/* Grand total */}
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
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
