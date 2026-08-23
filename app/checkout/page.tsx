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

// ─── Validation Helpers ─────────────────────────────────────
function validateName(v: string) {
  if (!v.trim()) return "Full name is required.";
  if (v.trim().length < 2) return "Please enter at least 2 characters.";
  if (!/^[a-zA-Z\u0600-\u06FF\s'.'-]+$/.test(v.trim())) return "Name should only contain letters.";
  return "";
}
function validatePhone(v: string) {
  const d = v.replace(/\D/g, "");
  if (!d) return "Phone number is required.";
  if (d.length !== 10) return "Must be exactly 10 digits.";
  if (!/^[6-9]/.test(d)) return "Must start with 6, 7, 8 or 9.";
  return "";
}
function validateEmail(v: string) {
  if (!v.trim()) return ""; // optional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return "Enter a valid email address.";
  return "";
}
function validateLocality(v: string) {
  if (!v.trim()) return "Locality / area landmark is required.";
  if (v.trim().length < 3) return "Please be more specific.";
  return "";
}
function validateHouse(v: string) {
  if (!v.trim()) return "House / flat / lane number is required.";
  return "";
}
function validatePincode(v: string) {
  if (!v.trim()) return "Pin code is required.";
  if (!/^[1-9][0-9]{5}$/.test(v.trim())) return "Enter a valid 6-digit Indian pin code.";
  return "";
}

// ─── Field Input Component (Declared at module level to prevent remounting/focus loss) ───
interface FieldProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  pattern?: string;
  prefix?: string;
  error?: string;
  touched?: boolean;
  onChange: (name: string, value: string) => void;
  onBlur: (name: string) => void;
}

function Field({
  label, name, type = "text", value, placeholder, required, maxLength, pattern, prefix,
  error, touched, onChange, onBlur,
}: FieldProps) {
  const hasErr = touched && Boolean(error);
  return (
    <div className="flex flex-col">
      <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: hasErr ? "#f87171" : C.onSurfVar, marginBottom: "8px", fontWeight: 600 }}>
        {label} {required && <span style={{ color: "#f87171" }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: C.onSurfVar, fontWeight: 600, fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", pointerEvents: "none" }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={e => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          placeholder={placeholder}
          maxLength={maxLength}
          pattern={pattern}
          style={{
            width: "100%",
            background: "rgba(3,16,24,0.8)",
            border: `1.5px solid ${hasErr ? "rgba(248,113,113,0.6)" : "rgba(61,74,83,0.6)"}`,
            borderRadius: "10px",
            padding: prefix ? "12px 16px 12px 50px" : "12px 16px",
            color: C.onSurface,
            fontFamily: '"Manrope", sans-serif',
            fontSize: "0.9rem",
            outline: "none",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
        />
      </div>
      {hasErr && (
        <span style={{ fontSize: "11px", color: "#f87171", marginTop: "4px", fontFamily: '"Manrope", sans-serif' }}>
          ⚠ {error}
        </span>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const { items, total, updateQuantity, clearCart } = useCart();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [deliveryMode, setDeliveryMode] = useState<"under5" | "over5" | "unavailable" | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiId, setUpiId] = useState("urbantrout@ybl");
  const [utrRef, setUtrRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  const [formData, setFormData] = useState({
    fullName: "", phone: "", email: "", locality: "", house: "", pincode: "",
  });

  // Per-field validation errors
  const [errors, setErrors] = useState({
    fullName: "", phone: "", email: "", locality: "", house: "", pincode: "",
  });

  const [touched, setTouched] = useState({
    fullName: false, phone: false, email: false, locality: false, house: false, pincode: false,
  });

  const leadIdRef = useRef<string | null>(null);
  // Track the phone that already had a Telegram lead sent, to avoid duplicates
  const telegramLeadPhoneRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const deliveryFee = deliveryMode === "over5" ? 40 : 0;
  const grandTotal = total + deliveryFee;

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await supabase.from("app_settings").select("value").eq("key", "upi_id").single();
        if (data?.value) setUpiId(data.value);
      } catch { /* use default */ }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    if (items.length === 0 && !orderSuccess) router.push("/shop");
  }, [items, orderSuccess, router]);

  // ─── Lead Capture ────────────────────────────────────────────
  const captureLead = useCallback(async (
    currentData: typeof formData,
    currentTotal: number,
    currentItems: typeof items,
    forceTelegram = false
  ) => {
    const rawPhone = currentData.phone.replace(/\D/g, "");
    // Require at least phone (and name for quality data)
    if (!rawPhone || rawPhone.length < 8) return;
    const cleanPhone = rawPhone.slice(-10);

    try {
      const payload = {
        customer_name: currentData.fullName?.trim() || "Interested Customer",
        customer_phone: cleanPhone,
        customer_email: currentData.email?.trim() || null,
        customer_locality: currentData.locality?.trim() || null,
        customer_address: currentData.house?.trim() || null,
        customer_pincode: currentData.pincode?.trim() || null,
        cart_items: currentItems.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, unit: i.unit })),
        estimated_total: currentTotal,
        status: "abandoned",
        updated_at: new Date().toISOString(),
      };

      // Upsert leads by phone to avoid redundant entries
      if (leadIdRef.current) {
        await supabase.from("leads").update(payload).eq("id", leadIdRef.current);
      } else {
        // Check if we already have a lead for this phone to avoid duplicates
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("customer_phone", cleanPhone)
          .eq("status", "abandoned")
          .maybeSingle();

        if (existing?.id) {
          leadIdRef.current = existing.id;
          await supabase.from("leads").update(payload).eq("id", existing.id);
        } else {
          const { data } = await supabase.from("leads").insert([payload]).select("id").single();
          if (data?.id) leadIdRef.current = data.id;
        }
      }

      // Upsert into customers (resilient fallback)
      await supabase.from("customers").upsert({
        phone: cleanPhone,
        name: currentData.fullName?.trim() || "Interested Customer",
        locality: currentData.locality?.trim() || "Srinagar",
        pincode: currentData.pincode?.trim() || "190006",
        notes: `Abandoned checkout (₹${currentTotal} — ${currentItems.map(i => `${i.name} x${i.quantity}`).join(", ")})`,
        last_order_at: new Date().toISOString(),
      }, { onConflict: "phone" });

      // Send Telegram alert ONCE per unique phone (not on every keystroke)
      if (forceTelegram || telegramLeadPhoneRef.current !== cleanPhone) {
        telegramLeadPhoneRef.current = cleanPhone;
        fetch("/api/telegram-notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "abandoned_lead",
            data: {
              name: currentData.fullName?.trim() || "Interested Customer",
              phone: cleanPhone,
              email: currentData.email?.trim() || undefined,
              locality: currentData.locality?.trim() || "Srinagar",
              pincode: currentData.pincode?.trim() || "190006",
              total: currentTotal,
              cartSummary: currentItems.map(i => `${i.name} x${i.quantity}`).join(", "),
            },
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("Lead capture notice:", err);
    }
  }, []);

  // Validate on every change, capture lead on debounce
  const handleInputChange = (field: string, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);

    // Real-time validation
    const validators: Record<string, (v: string) => string> = {
      fullName: validateName, phone: validatePhone, email: validateEmail,
      locality: validateLocality, house: validateHouse, pincode: validatePincode,
    };
    if (touched[field as keyof typeof touched]) {
      setErrors(prev => ({ ...prev, [field]: validators[field]?.(value) || "" }));
    }

    // Debounced lead capture
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      captureLead(next, grandTotal, items);
    }, 600);
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const validators: Record<string, (v: string) => string> = {
      fullName: validateName, phone: validatePhone, email: validateEmail,
      locality: validateLocality, house: validateHouse, pincode: validatePincode,
    };
    setErrors(prev => ({ ...prev, [field]: validators[field]?.(formData[field as keyof typeof formData]) || "" }));
    captureLead(formData, grandTotal, items);
  };

  // Capture on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (formData.phone.replace(/\D/g, "").length >= 8) {
        captureLead(formData, grandTotal, items, true);
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
  const DELIVERY_RADIUS_KM = 5;   // Issue #4: Only within 5km shown form
  const MAX_RANGE_KM = 25;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const detectLocation = () => {
    setIsLocating(true);
    setLocationMsg("Locating your address…");
    if (!("geolocation" in navigator)) {
      setLocationMsg("Geolocation not supported on this device.");
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = calculateDistance(FARM_LAT, FARM_LNG, pos.coords.latitude, pos.coords.longitude);
        if (dist > MAX_RANGE_KM) {
          setDeliveryMode("unavailable");
          setLocationMsg(`${dist.toFixed(1)}km from our farm — outside delivery zone.`);
        } else if (dist <= DELIVERY_RADIUS_KM) {
          setDeliveryMode("under5");
          setLocationMsg(`${dist.toFixed(1)}km from Urban Trout Farm — Free Delivery ✓`);
        } else {
          // Issue #4: outside 5km → unavailable (we only deliver within 5km per user directive)
          setDeliveryMode("unavailable");
          setLocationMsg(`${dist.toFixed(1)}km from our farm — We currently deliver only within a 5km radius of Urban Trout Farm.`);
        }
        setIsLocating(false);
      },
      () => {
        setLocationMsg("Please allow location access to check delivery availability.");
        setIsLocating(false);
      }
    );
  };

  // Full form validation before proceeding
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all touched
    setTouched({ fullName: true, phone: true, email: true, locality: true, house: true, pincode: true });

    const newErrors = {
      fullName: validateName(formData.fullName),
      phone: validatePhone(formData.phone),
      email: validateEmail(formData.email),
      locality: validateLocality(formData.locality),
      house: validateHouse(formData.house),
      pincode: validatePincode(formData.pincode),
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some(e => e !== "")) return;

    if (!deliveryMode) {
      alert("Please detect your delivery zone first.");
      return;
    }
    if (deliveryMode === "unavailable") {
      alert("Sorry, we currently only deliver within 5km of Urban Trout Farm, Srinagar.");
      return;
    }

    captureLead(formData, grandTotal, items);
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const upiPayUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Srinagar&am=${grandTotal}&cu=INR&tn=Urban%20Trout%20Fresh%20Order`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiPayUri)}&bgcolor=16-33-44&color=114-221-253&margin=2`;

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleFinalOrderSubmit = async () => {
    setIsSubmitting(true);
    try {
      let cartDetails = "";
      items.forEach(item => {
        cartDetails += `- ${item.name} (${item.quantity} ${item.unit}): ₹${(item.price * item.quantity).toLocaleString("en-IN")}\n`;
      });

      const cleanPhone = formData.phone.replace(/\D/g, "").slice(-10);
      const emailNote = formData.email?.trim() ? ` (Email: ${formData.email.trim()})` : "";

      const orderPayload = {
        customer_name: formData.fullName.trim(),
        customer_phone: cleanPhone,
        customer_address: `${formData.house.trim()}, ${formData.locality.trim()}${emailNote}`,
        customer_locality: formData.locality.trim(),
        customer_pincode: formData.pincode.trim(),
        items: items.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, unit: i.unit, image: i.image })),
        subtotal: total,
        delivery_fee: deliveryFee,
        total: grandTotal,
        delivery_zone: deliveryMode,
        status: "pending",
      };

      const { data: insertedOrder, error: insertErr } = await supabase.from("orders").insert(orderPayload).select("*").single();
      if (insertErr) {
        console.error("Order Supabase insert error:", insertErr);
      }

      // 1. Mark any lead matching this phone or leadId as converted
      try {
        await supabase.from("leads").update({
          status: "converted",
          notes: `Converted to Order #${insertedOrder?.order_number || ""}. Payment via UPI (${upiId}). UTR: ${utrRef || "Direct"}`,
          updated_at: new Date().toISOString(),
        }).eq("customer_phone", cleanPhone);
      } catch (e) {}

      // 2. Upsert customer profile with order record
      try {
        await supabase.from("customers").upsert({
          phone: cleanPhone,
          name: formData.fullName,
          locality: formData.locality,
          pincode: formData.pincode,
          notes: `Order #${insertedOrder?.order_number || ""}`,
          total_orders: 1,
          last_order_at: new Date().toISOString(),
        }, { onConflict: "phone" });
      } catch (e) {}

      // Telegram + Email alert
      fetch("/api/telegram-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_order",
          data: {
            orderNumber: String(insertedOrder?.order_number || "UT-" + Math.floor(1000 + Math.random() * 9000)),
            customerName: formData.fullName,
            phone: formData.phone.replace(/\D/g, "").slice(-10),
            email: formData.email?.trim() || undefined,
            locality: formData.locality,
            address: formData.house,
            pincode: formData.pincode,
            items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, unit: i.unit })),
            subtotal: total,
            deliveryFee,
            total: grandTotal,
            paymentMethod: "UPI",
            utrNumber: utrRef || undefined,
          },
        }),
      }).catch(() => {});

      const whatsappMessage = `*NEW HARVEST ORDER (PAID VIA UPI)* 🐟\n\n*Order ID:* #${insertedOrder?.order_number || "NEW"}\n*Customer:*\nName: ${formData.fullName}\nPhone: +91 ${formData.phone}\n${formData.email ? `Email: ${formData.email}\n` : ""}Address: ${formData.house}, ${formData.locality}, ${formData.pincode}\n\n*Ordered Items:*\n${cartDetails}\n*Delivery Zone:* ${deliveryMode === "over5" ? `Outside 5km (₹${deliveryFee})` : "Within 5km (Free)"}\n*Total Paid via UPI:* ₹${grandTotal.toLocaleString("en-IN")}\n*UPI ID Paid To:* ${upiId}\n${utrRef ? `*UTR / Ref No:* ${utrRef}\n` : ""}\n_Please verify payment & confirm harvest!_`;

      setOrderSuccess({
        orderNumber: insertedOrder?.order_number || "UT-" + Math.floor(1000 + Math.random() * 9000),
        total: grandTotal,
        phone: formData.phone,
        name: formData.fullName,
        email: formData.email,
      });

      if (clearCart) clearCart();
      const encodedMsg = encodeURIComponent(whatsappMessage);
      window.open(`https://wa.me/918491006127?text=${encodedMsg}`, "_blank");
    } catch (err) {
      console.error("Order submission error:", err);
      alert("Order placed! We will confirm your delivery shortly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success / Thank You Screen ───────────────────────────────
  if (orderSuccess) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }}>
        {/* Navbar spacer */}
        <div style={{ height: "80px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", minHeight: "calc(100vh - 80px)" }}>
          <div
            className="max-w-lg w-full text-center rounded-2xl"
            style={{
              background: "rgba(16,33,44,0.95)",
              border: "1px solid rgba(114,221,253,0.3)",
              boxShadow: "0 0 60px rgba(114,221,253,0.12)",
              overflow: "hidden",
            }}
          >
            {/* Top accent bar */}
            <div style={{ height: "4px", background: "linear-gradient(to right, #3aadcc, #72ddfd)" }} />

            <div style={{ padding: "2.5rem 2rem" }}>
              {/* Icon */}
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "rgba(251,191,36,0.12)", border: "2px solid rgba(251,191,36,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1.25rem",
              }}>
                <span style={{ fontSize: "32px" }}>⏳</span>
              </div>

              {/* Status badge */}
              <div style={{
                display: "inline-block",
                background: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: "100px",
                padding: "4px 14px",
                fontSize: "10px",
                fontFamily: '"Inter", sans-serif',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#fbbf24",
                fontWeight: 700,
                marginBottom: "1rem",
              }}>
                Order Received • Awaiting Payment Verification
              </div>

              {/* Heading */}
              <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.75rem", fontWeight: 800, color: C.onSurface, margin: "0 0 0.75rem", lineHeight: 1.2 }}>
                Thank You, {orderSuccess.name}!
              </h2>
              <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.9rem", color: C.onSurfVar, lineHeight: 1.7, marginBottom: "1.5rem" }}>
                Your order <strong style={{ color: C.primary }}>#{orderSuccess.orderNumber}</strong> is received. Our team at Urban Trout Farm is verifying your UPI payment — once confirmed, your fresh trout will be harvested and dispatched same-day.
              </p>

              {/* Notice box */}
              <div style={{
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.2)",
                borderRadius: "12px",
                padding: "14px 16px",
                marginBottom: "1.5rem",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                textAlign: "left",
              }}>
                <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>🔒</span>
                <p style={{ margin: 0, fontSize: "12px", color: "#fde68a", lineHeight: 1.6, fontFamily: '"Manrope", sans-serif' }}>
                  <strong>What happens next?</strong> We manually verify every UPI payment before harvesting from ponds.
                  {orderSuccess.email ? " You'll receive a status email once confirmed!" : " Share your payment screenshot on WhatsApp for faster confirmation!"}
                </p>
              </div>

              {/* Summary box */}
              <div style={{
                background: "rgba(3,16,24,0.7)",
                border: "1px solid rgba(61,74,83,0.5)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "1.5rem",
                textAlign: "left",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem" }}>
                  <span style={{ color: C.onSurfVar }}>Order ID</span>
                  <span style={{ color: C.primary, fontWeight: 700 }}>#{orderSuccess.orderNumber}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem" }}>
                  <span style={{ color: C.onSurfVar }}>Total Amount</span>
                  <span style={{ color: C.primary, fontWeight: 700 }}>₹{orderSuccess.total.toLocaleString("en-IN")}</span>
                </div>
                {orderSuccess.email && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem" }}>
                    <span style={{ color: C.onSurfVar }}>Status Updates</span>
                    <span style={{ color: "#22c55e", fontWeight: 600, fontSize: "0.8rem" }}>{orderSuccess.email}</span>
                  </div>
                )}
                <div style={{ borderTop: "1px solid rgba(61,74,83,0.4)", paddingTop: "10px", display: "flex", justifyContent: "space-between", fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem" }}>
                  <span style={{ color: C.onSurfVar }}>Farm Hotline</span>
                  <span style={{ color: C.onSurface, fontWeight: 600 }}>+91 84910 06127</span>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <a
                  href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20I%20placed%20order%20%23${orderSuccess.orderNumber}.%20Please%20verify%20my%20UPI%20payment.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "#25D366",
                    color: "#fff",
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textDecoration: "none",
                  }}
                >
                  📱 Share Payment Screenshot on WhatsApp
                </a>
                <Link
                  href="/"
                  style={{
                    display: "block",
                    padding: "13px",
                    borderRadius: "12px",
                    background: "rgba(114,221,253,0.1)",
                    border: "1px solid rgba(114,221,253,0.25)",
                    color: C.primary,
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textDecoration: "none",
                  }}
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        {/* ─── Step Progress ─── */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-slate-800 -z-0" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] transition-all duration-500 -z-0"
              style={{ width: currentStep === 1 ? "25%" : "100%", background: "linear-gradient(to right, #3aadcc, #72ddfd)" }} />

            <button onClick={() => setCurrentStep(1)} className="relative z-10 flex items-center gap-2.5 px-4 py-2 rounded-full transition-all"
              style={{ background: currentStep === 1 ? "#10212c" : "rgba(16,33,44,0.9)", border: currentStep === 1 ? "1.5px solid #72ddfd" : "1px solid rgba(37,211,102,0.6)", boxShadow: currentStep === 1 ? "0 0 15px rgba(114,221,253,0.3)" : "none" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background: currentStep === 1 ? "#72ddfd" : "#25D366", color: "#002730" }}>
                {currentStep === 2 ? "✓" : "1"}
              </span>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.onSurface }}>Delivery Details</span>
            </button>

            <div className="relative z-10 flex items-center gap-2.5 px-4 py-2 rounded-full transition-all"
              style={{ background: currentStep === 2 ? "#10212c" : "rgba(16,33,44,0.7)", border: currentStep === 2 ? "1.5px solid #72ddfd" : "1px solid rgba(61,74,83,0.5)", boxShadow: currentStep === 2 ? "0 0 20px rgba(114,221,253,0.3)" : "none" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black" style={{ background: currentStep === 2 ? "#72ddfd" : "rgba(61,74,83,0.8)", color: currentStep === 2 ? "#002730" : C.onSurfVar }}>2</span>
              <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: currentStep === 2 ? C.primary : C.onSurfVar }}>UPI Payment</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <section className="lg:col-span-7 space-y-8">

            {/* ─── STEP 1 ─── */}
            {currentStep === 1 && (
              <div style={{ background: "rgba(16,33,44,0.7)", borderRadius: "16px", border: "1px solid rgba(114,221,253,0.12)", padding: "2rem" }}>
                <div className="flex items-center gap-4 mb-6">
                  <Link href="/shop" className="flex items-center justify-center w-10 h-10 rounded-xl transition-colors" style={{ border: "1px solid rgba(61,74,83,0.6)", color: C.onSurfVar }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                  </Link>
                  <div>
                    <h1 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.5rem", fontWeight: 800, color: C.onSurface, letterSpacing: "-0.03em", margin: 0 }}>Step 1: Delivery Details</h1>
                    <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: C.onSurfVar, margin: "2px 0 0" }}>Verify your 5km delivery zone before payment.</p>
                  </div>
                </div>

                {/* ─── Location Detection ─── */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl mb-6"
                  style={{ background: "rgba(3,16,24,0.6)", border: "1px solid rgba(61,74,83,0.5)" }}>
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-2" style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.primary }}>
                      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>
                      5km Delivery Zone Check
                    </span>
                    {deliveryMode ? (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: deliveryMode === "unavailable" ? "rgba(239,68,68,0.1)" : "rgba(37,211,102,0.08)", border: deliveryMode === "unavailable" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(37,211,102,0.3)", color: deliveryMode === "unavailable" ? "#f87171" : "#4ade80" }}>
                        {deliveryMode === "unavailable"
                          ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                          : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>}
                        <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", fontWeight: 600 }}>{locationMsg}</span>
                      </div>
                    ) : (
                      <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.83rem", color: C.onSurfVar, marginTop: "4px" }}>
                        {locationMsg || "Click to check if we deliver to your location (5km radius only)"}
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={detectLocation} disabled={isLocating}
                    style={{ padding: "10px 18px", borderRadius: "10px", background: C.primaryCont, color: C.onPrimCont, fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", border: "none", cursor: isLocating ? "not-allowed" : "pointer", opacity: isLocating ? 0.6 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                    {isLocating
                      ? <><svg className="animate-spin" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> Checking…</>
                      : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg> Check My Location</>}
                  </button>
                </div>

                {/* ─── Issue #4: Out of zone animated block ─── */}
                {deliveryMode === "unavailable" && (
                  <div
                    className="rounded-2xl p-6 mb-6 text-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                    }}
                  >
                    <div style={{ fontSize: "40px", marginBottom: "10px" }}>🚫</div>
                    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800, color: "#f87171", fontSize: "1.1rem", margin: "0 0 8px" }}>
                      We Don&apos;t Deliver Here Yet
                    </h3>
                    <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: "#fca5a5", lineHeight: 1.7, margin: "0 0 16px" }}>
                      Urban Trout currently delivers only within a <strong>5km radius of Urban Trout Farm &amp; Vending Center</strong>, Srinagar. Your location appears to be outside our current delivery zone.
                    </p>
                    <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "12px", fontSize: "0.83rem", color: "#fca5a5", marginBottom: "16px" }}>
                      🏪 <strong>Alternative:</strong> You can visit our Live Vending Center at<br />
                      <strong style={{ color: "#f87171" }}>Malabagh, Naseem Bagh, Srinagar — 190006 (Near R P School, Girls Wing)</strong>
                    </div>
                    <a
                      href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20I%20am%20outside%20your%205km%20delivery%20zone.%20Can%20you%20help?`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-block", padding: "10px 20px", borderRadius: "10px", background: "#25D366", color: "#fff", fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.82rem", textDecoration: "none", letterSpacing: "0.06em" }}
                    >
                      💬 Contact Us on WhatsApp
                    </a>
                  </div>
                )}

                {/* ─── Form: only show when within delivery zone ─── */}
                {(deliveryMode === "under5" || deliveryMode === null) && (
                  <form onSubmit={handleProceedToPayment} noValidate className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-5">
                      <Field
                        label="Full Name"
                        name="fullName"
                        value={formData.fullName}
                        placeholder="e.g. Sameer Ahmed"
                        required
                        error={errors.fullName}
                        touched={touched.fullName}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                      />
                      <Field
                        label="Phone Number (WhatsApp)"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        placeholder="10-digit mobile"
                        required
                        maxLength={10}
                        prefix="+91"
                        error={errors.phone}
                        touched={touched.phone}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                      />
                      <div className="md:col-span-2">
                        <Field
                          label="Email Address (Optional — for order updates)"
                          name="email"
                          type="email"
                          value={formData.email}
                          placeholder="your.email@gmail.com"
                          error={errors.email}
                          touched={touched.email}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Field
                          label="Locality / Area Landmark in Srinagar"
                          name="locality"
                          value={formData.locality}
                          placeholder="e.g. Near Hazratbal Dargah, Naseem Bagh"
                          required
                          error={errors.locality}
                          touched={touched.locality}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                        />
                      </div>
                      <Field
                        label="House / Flat / Lane No."
                        name="house"
                        value={formData.house}
                        placeholder="e.g. House No. 24, Lane 2"
                        required
                        error={errors.house}
                        touched={touched.house}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                      />
                      <Field
                        label="Pin Code"
                        name="pincode"
                        value={formData.pincode}
                        placeholder="190006"
                        required
                        maxLength={6}
                        error={errors.pincode}
                        touched={touched.pincode}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                      />
                    </div>

                    <div className="pt-4 space-y-3">
                      <button type="submit"
                        className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all rounded-xl py-4"
                        style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.9rem", background: C.primaryCont, color: C.onPrimCont, boxShadow: "0 0 30px rgba(58,173,204,0.35)", border: "none", cursor: "pointer" }}>
                        Proceed to UPI Payment
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                      </button>
                      <p className="text-center text-[11px] text-slate-500" style={{ fontFamily: '"Manrope", sans-serif' }}>
                        Protected by reCAPTCHA •{" "}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-400">Privacy</a> &amp;{" "}
                        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-cyan-400">Terms</a>
                      </p>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ─── STEP 2 ─── */}
            {currentStep === 2 && (
              <div style={{ background: "rgba(16,33,44,0.8)", borderRadius: "16px", border: "1px solid rgba(114,221,253,0.25)", padding: "2rem" }}>
                <div className="flex items-center justify-between pb-5 mb-6" style={{ borderBottom: "1px solid rgba(61,74,83,0.5)" }}>
                  <button type="button" onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors" style={{ background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)", color: C.onSurfVar }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
                    ← Edit Details
                  </button>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", color: C.primary, letterSpacing: "0.15em", textTransform: "uppercase" }}>Step 2 of 2</span>
                </div>

                <div className="p-4 rounded-xl mb-6 flex flex-col md:flex-row justify-between gap-3" style={{ background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.5)" }}>
                  <div>
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>Delivering To</span>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: C.onSurface, margin: "2px 0 0", fontSize: "0.95rem" }}>{formData.fullName} (+91 {formData.phone})</p>
                    <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar, fontSize: "0.82rem", margin: "2px 0 0" }}>{formData.house}, {formData.locality}, {formData.pincode}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.outline }}>Delivery Zone</span>
                    <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, color: C.primary, margin: "2px 0 0", fontSize: "0.9rem" }}>Within 5km — Free Delivery ✓</p>
                  </div>
                </div>

                {/* UPI Card */}
                <div className="p-6 md:p-8 rounded-2xl mb-6" style={{ background: "rgba(6,21,30,0.9)", border: "1px solid rgba(114,221,253,0.3)", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="p-3 rounded-2xl flex-shrink-0 flex flex-col items-center" style={{ background: "#10212c", border: "1px solid rgba(114,221,253,0.3)" }}>
                      <img src={upiQrCodeUrl} alt="Scan to Pay via UPI" style={{ width: "180px", height: "180px", borderRadius: "10px" }} />
                      <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.primary, letterSpacing: "0.1em", marginTop: "8px", textTransform: "uppercase" }}>Scan with Any UPI App</span>
                    </div>
                    <div className="flex-1 space-y-4 text-center md:text-left w-full">
                      <div>
                        <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar }}>Total Amount to Pay</span>
                        <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2.25rem", fontWeight: 800, color: C.primary, letterSpacing: "-0.03em", margin: "2px 0 0" }}>₹{grandTotal.toLocaleString("en-IN")}</h3>
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl gap-3" style={{ background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.6)" }}>
                        <div className="flex flex-col text-left">
                          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.outline, textTransform: "uppercase", letterSpacing: "0.1em" }}>UPI ID</span>
                          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.95rem", fontWeight: 700, color: C.onSurface }}>{upiId}</span>
                        </div>
                        <button type="button" onClick={copyUpiId} className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                          style={{ background: copiedUpi ? "rgba(37,211,102,0.2)" : "rgba(114,221,253,0.15)", color: copiedUpi ? "#25D366" : C.primary, border: `1px solid ${copiedUpi ? "#25D366" : "rgba(114,221,253,0.3)"}` }}>
                          {copiedUpi ? "Copied! ✓" : "Copy ID"}
                        </button>
                      </div>
                      <a href={upiPayUri} className="flex md:hidden items-center justify-center gap-2 w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                        style={{ background: C.primaryCont, color: C.onPrimCont, textDecoration: "none", boxShadow: "0 0 20px rgba(58,173,204,0.3)" }}>
                        Pay via GPay / PhonePe / Paytm
                      </a>
                    </div>
                  </div>

                  <div className="mt-6 pt-5" style={{ borderTop: "1px solid rgba(61,74,83,0.4)" }}>
                    <label style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.15em", textTransform: "uppercase", color: C.onSurfVar, display: "block", marginBottom: "6px" }}>
                      Transaction UTR / Reference No. (Optional)
                    </label>
                    <input type="text" value={utrRef} onChange={e => setUtrRef(e.target.value)} placeholder="e.g. 423871928371 (from your UPI app)"
                      style={{ width: "100%", background: "rgba(3,16,24,0.8)", border: "1px solid rgba(61,74,83,0.5)", borderRadius: "10px", padding: "12px 14px", color: C.onSurface, fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                <button type="button" onClick={handleFinalOrderSubmit} disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 rounded-xl py-4"
                  style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.95rem", background: "#25D366", color: "#fff", border: "none", boxShadow: "0 0 30px rgba(37,211,102,0.4)", cursor: isSubmitting ? "not-allowed" : "pointer" }}>
                  {isSubmitting ? "Confirming Harvest Order…" : (
                    <>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" /></svg>
                      I Have Paid ₹{grandTotal.toLocaleString("en-IN")} • Confirm Order
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          {/* ─── Order Summary Sidebar ─── */}
          <aside className="lg:col-span-5 sticky top-32 space-y-4">
            <div style={{ borderRadius: "16px", overflow: "hidden", background: "rgba(16,33,44,0.9)", border: "1px solid rgba(61,74,83,0.5)", boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }}>
              <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid rgba(61,74,83,0.4)", background: "rgba(21,40,52,0.8)" }}>
                <h2 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800, fontSize: "1.1rem", color: C.onSurface }}>Order Summary</h2>
                <span style={{ background: "rgba(114,221,253,0.12)", color: C.primary, padding: "3px 12px", borderRadius: "100px", fontSize: "11px", fontFamily: '"Inter", sans-serif', fontWeight: 700, border: "1px solid rgba(114,221,253,0.25)" }}>
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="p-5 space-y-5">
                <div className="space-y-4 max-h-72 overflow-y-auto">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div style={{ width: "60px", height: "60px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(61,74,83,0.4)" }}>
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-1">
                          <h4 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.onSurface }}>{item.name}</h4>
                          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: C.primary, marginLeft: "8px" }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                        </div>
                        <div className="flex items-center gap-0 mt-1 w-max rounded-lg overflow-hidden" style={{ border: "1px solid rgba(61,74,83,0.5)", background: "rgba(3,16,24,0.6)" }}>
                          <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="w-7 h-6 flex items-center justify-center transition-colors" style={{ color: C.primary }}>−</button>
                          <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "11px", color: C.onSurfVar, minWidth: "38px", textAlign: "center", fontWeight: 700 }}>{item.quantity} {item.unit}</span>
                          <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-6 flex items-center justify-center transition-colors" style={{ color: C.primary }}>+</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ height: "1px", background: "rgba(61,74,83,0.4)" }} />

                <div className="space-y-2" style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem" }}>
                  <div className="flex justify-between">
                    <span style={{ color: C.onSurfVar }}>Subtotal</span>
                    <span style={{ color: C.onSurface }}>₹{total.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: C.onSurfVar }}>Delivery Fee</span>
                    <span style={{ color: C.primary, fontWeight: 700 }}>
                      {!deliveryMode ? "Check zone first" : deliveryMode === "unavailable" ? "—" : "Free (Within 5km)"}
                    </span>
                  </div>
                </div>

                <div style={{ height: "1px", background: "rgba(114,221,253,0.15)" }} />

                <div className="flex justify-between items-end">
                  <div>
                    <p style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: C.outline, marginBottom: "4px" }}>Total Payable</p>
                    <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "2rem", fontWeight: 800, color: C.primary, letterSpacing: "-0.04em", lineHeight: 1 }}>₹{grandTotal.toLocaleString("en-IN")}</h3>
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
