"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";

const C = {
  bg: "#031018",
  bgHigh: "#10212c",
  bgHighest: "#152834",
  cardBg: "rgba(16,33,44,0.75)",
  cardBorder: "rgba(114,221,253,0.18)",
  primary: "#72ddfd",
  primaryCont: "#3aadcc",
  onPrimCont: "#002730",
  onSurface: "#dfedf9",
  onSurfVar: "#9fadb8",
  outline: "#6a7782",
  outlineVar: "#3d4a53",
  emerald: "#25D366",
  emeraldDim: "rgba(37,211,102,0.15)",
  emeraldBorder: "rgba(37,211,102,0.4)",
  gold: "#fbbf24",
  error: "#f87171",
};

// ─── Farm Coordinates (Malabagh / Naseem Bagh, Srinagar) ────────
const FARM_LAT = 34.144709;
const FARM_LNG = 74.824525;
const DELIVERY_RADIUS_KM = 5.0;

// ─── Srinagar Preset Locations with Distances from Farm ─────────
interface SrinagarZone {
  name: string;
  distanceKm: number;
  pincode: string;
  eligible: boolean;
}

const SRINAGAR_ZONES: SrinagarZone[] = [
  { name: "Naseem Bagh", distanceKm: 0.5, pincode: "190006", eligible: true },
  { name: "Malabagh", distanceKm: 0.8, pincode: "190006", eligible: true },
  { name: "Hazratbal", distanceKm: 1.2, pincode: "190006", eligible: true },
  { name: "Habak", distanceKm: 2.1, pincode: "190006", eligible: true },
  { name: "Zakura", distanceKm: 2.8, pincode: "190024", eligible: true },
  { name: "Lal Bazar", distanceKm: 3.5, pincode: "190011", eligible: true },
  { name: "Soura / SKIMS", distanceKm: 4.2, pincode: "190011", eligible: true },
  { name: "Bachpora", distanceKm: 4.6, pincode: "190020", eligible: true },
  { name: "Illahibagh", distanceKm: 4.8, pincode: "190011", eligible: true },
  { name: "Rainawari", distanceKm: 5.8, pincode: "190003", eligible: false },
  { name: "Dalgate", distanceKm: 7.2, pincode: "190001", eligible: false },
  { name: "Rajbagh", distanceKm: 9.5, pincode: "190008", eligible: false },
  { name: "Lal Chowk", distanceKm: 8.5, pincode: "190001", eligible: false },
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  if (!v.trim()) return "";
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

// ─── Field Input Component ───────────────────────────────────
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
  helperText?: string;
  error?: string;
  touched?: boolean;
  onChange: (name: string, value: string) => void;
  onBlur: (name: string) => void;
}

function Field({
  label,
  name,
  type = "text",
  value,
  placeholder,
  required,
  maxLength,
  pattern,
  prefix,
  helperText,
  error,
  touched,
  onChange,
  onBlur,
}: FieldProps) {
  const hasErr = touched && Boolean(error);
  return (
    <div className="flex flex-col">
      <label
        style={{
          fontFamily: '"Inter", sans-serif',
          fontSize: "11px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: hasErr ? "#f87171" : C.onSurfVar,
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        {label} {required && <span style={{ color: "#f87171" }}>*</span>}
      </label>
      <div style={{ position: "relative" }}>
        {prefix && (
          <span
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: C.onSurfVar,
              fontWeight: 600,
              fontFamily: '"Manrope", sans-serif',
              fontSize: "0.9rem",
              pointerEvents: "none",
            }}
          >
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          placeholder={placeholder}
          maxLength={maxLength}
          pattern={pattern}
          style={{
            width: "100%",
            background: "rgba(3,16,24,0.85)",
            border: `1.5px solid ${hasErr ? "rgba(248,113,113,0.7)" : "rgba(61,74,83,0.7)"}`,
            borderRadius: "12px",
            padding: prefix ? "13px 16px 13px 52px" : "13px 16px",
            color: C.onSurface,
            fontFamily: '"Manrope", sans-serif',
            fontSize: "0.92rem",
            outline: "none",
            boxSizing: "border-box",
            transition: "all 0.2s ease",
          }}
          onFocus={(e) => {
            if (!hasErr) e.target.style.borderColor = "rgba(114,221,253,0.7)";
          }}
          onBlurCapture={(e) => {
            if (!hasErr) e.target.style.borderColor = "rgba(61,74,83,0.7)";
          }}
        />
      </div>
      {hasErr ? (
        <span
          style={{
            fontSize: "11px",
            color: "#f87171",
            marginTop: "5px",
            fontFamily: '"Manrope", sans-serif',
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>⚠</span> {error}
        </span>
      ) : helperText ? (
        <span
          style={{
            fontSize: "11px",
            color: C.onSurfVar,
            marginTop: "4px",
            fontFamily: '"Manrope", sans-serif',
          }}
        >
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

export default function CheckoutPage() {
  const { items, total, updateQuantity, clearCart } = useCart();
  const router = useRouter();

  // ─── 3-Stage Process: 1 = Location Check, 2 = Customer Details, 3 = Payment ───
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // ─── Location Check State ───
  const [deliveryMode, setDeliveryMode] = useState<"under5" | "unavailable" | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [selectedZoneName, setSelectedZoneName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // ─── Payment & Settings State ───
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [upiId, setUpiId] = useState("urbantrout@ybl");
  const [utrRef, setUtrRef] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  // ─── Form Data State ───
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    locality: "",
    house: "",
    pincode: "",
    notes: "",
  });

  // ─── Errors & Touched State ───
  const [errors, setErrors] = useState({
    fullName: "",
    phone: "",
    email: "",
    locality: "",
    house: "",
    pincode: "",
  });

  const [touched, setTouched] = useState({
    fullName: false,
    phone: false,
    email: false,
    locality: false,
    house: false,
    pincode: false,
  });

  const leadIdRef = useRef<string | null>(null);
  const telegramSentPhonesRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const deliveryFee = 0;
  const grandTotal = total + deliveryFee;

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await supabase.from("app_settings").select("value").eq("key", "upi_id").single();
        if (data?.value) setUpiId(data.value);
      } catch {
        /* use default */
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    if (items.length === 0 && !orderSuccess) router.push("/shop");
  }, [items, orderSuccess, router]);

  // Filtered zones based on search query
  const filteredZones = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return SRINAGAR_ZONES;
    return SRINAGAR_ZONES.filter(
      (z) => z.name.toLowerCase().includes(q) || z.pincode.includes(q)
    );
  }, [searchQuery]);

  // ─── Lead Capture ────────────────────────────────────────────
  const captureLead = useCallback(
    async (
      currentData: typeof formData,
      currentTotal: number,
      currentItems: typeof items
    ) => {
      const rawPhone = currentData.phone.replace(/\D/g, "");
      if (!rawPhone || rawPhone.length < 8) return;
      const cleanPhone = rawPhone.slice(-10);

      try {
        const payload = {
          customer_name: currentData.fullName?.trim() || "Interested Customer",
          customer_phone: cleanPhone,
          customer_email: currentData.email?.trim() || null,
          customer_locality: currentData.locality?.trim() || selectedZoneName || null,
          customer_address: currentData.house?.trim() || null,
          customer_pincode: currentData.pincode?.trim() || null,
          cart_items: currentItems.map((i) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            unit: i.unit,
          })),
          estimated_total: currentTotal,
          status: "abandoned",
          notes: `Abandoned checkout step ${currentStep} (₹${currentTotal})`,
          updated_at: new Date().toISOString(),
        };

        // 1. Primary: Save via server API endpoint (bypasses RLS issues)
        fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead: payload }),
        })
          .then((res) => res.json())
          .then((json) => {
            if (json?.leadId) leadIdRef.current = json.leadId;
          })
          .catch(() => {});

        // 2. Direct client Supabase fallback
        if (leadIdRef.current) {
          await supabase.from("leads").update(payload).eq("id", leadIdRef.current);
        } else {
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

        await supabase.from("customers").upsert(
          {
            phone: cleanPhone,
            name: currentData.fullName?.trim() || "Interested Customer",
            locality: currentData.locality?.trim() || selectedZoneName || "Srinagar",
            pincode: currentData.pincode?.trim() || "190006",
            notes: `Abandoned checkout step ${currentStep} (₹${currentTotal})`,
            last_order_at: new Date().toISOString(),
          },
          { onConflict: "phone" }
        );

        // 3. Send Telegram alert EXACTLY ONCE per customer phone per session
        if (cleanPhone && !telegramSentPhonesRef.current.has(cleanPhone)) {
          telegramSentPhonesRef.current.add(cleanPhone);
          fetch("/api/telegram-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "abandoned_lead",
              data: {
                name: currentData.fullName?.trim() || "Interested Customer",
                phone: cleanPhone,
                email: currentData.email?.trim() || undefined,
                locality: currentData.locality?.trim() || selectedZoneName || "Srinagar",
                pincode: currentData.pincode?.trim() || "190006",
                total: currentTotal,
                cartSummary: currentItems.map((i) => `${i.name} x${i.quantity}`).join(", "),
              },
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Lead capture notice:", err);
      }
    },
    [currentStep, selectedZoneName]
  );

  const handleInputChange = (field: string, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);

    const validators: Record<string, (v: string) => string> = {
      fullName: validateName,
      phone: validatePhone,
      email: validateEmail,
      locality: validateLocality,
      house: validateHouse,
      pincode: validatePincode,
    };

    if (validators[field]) {
      setErrors((prev) => ({ ...prev, [field]: validators[field](value) }));
    }

    if (field === "phone" && value.replace(/\D/g, "").length === 10) {
      captureLead(next, grandTotal, items);
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const validators: Record<string, (v: string) => string> = {
      fullName: validateName,
      phone: validatePhone,
      email: validateEmail,
      locality: validateLocality,
      house: validateHouse,
      pincode: validatePincode,
    };
    if (validators[field]) {
      setErrors((prev) => ({ ...prev, [field]: validators[field](formData[field as keyof typeof formData]) }));
    }
    captureLead(formData, grandTotal, items);
  };

  // ─── Trigger abandoned lead on step change ───────────────────
  useEffect(() => {
    if (formData.phone.replace(/\D/g, "").length >= 10) {
      const timer = setTimeout(() => {
        captureLead(formData, grandTotal, items);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [formData.phone, currentStep, grandTotal, items, captureLead]);

  // ─── Location Detection (GPS) ────────────────────────────────
  const detectLocation = () => {
    setIsLocating(true);
    setLocationMsg("Detecting your location…");
    if (!("geolocation" in navigator)) {
      setLocationMsg("Geolocation not supported on this browser.");
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = calculateDistance(FARM_LAT, FARM_LNG, latitude, longitude);
        setCalculatedDistance(dist);

        if (dist <= DELIVERY_RADIUS_KM) {
          setDeliveryMode("under5");
          setSelectedZoneName("GPS Detected Location");
          setLocationMsg(`${dist.toFixed(1)} km from Farm — Free Delivery Eligible ✓`);
        } else {
          setDeliveryMode("unavailable");
          setSelectedZoneName("GPS Detected Location");
          setLocationMsg(`${dist.toFixed(1)} km from Farm — Outside 5km delivery zone.`);
        }
        setIsLocating(false);
      },
      () => {
        setLocationMsg("Location permission needed. Please select your locality below.");
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // ─── Select Preset Srinagar Zone ─────────────────────────────
  const handleSelectZone = (zone: SrinagarZone) => {
    setSelectedZoneName(zone.name);
    setCalculatedDistance(zone.distanceKm);
    if (zone.eligible) {
      setDeliveryMode("under5");
      setLocationMsg(`${zone.name} (~${zone.distanceKm} km) — Free Delivery ✓`);
      setFormData((prev) => ({
        ...prev,
        locality: zone.name,
        pincode: zone.pincode,
      }));
    } else {
      setDeliveryMode("unavailable");
      setLocationMsg(`${zone.name} (~${zone.distanceKm} km) — Outside 5km zone.`);
    }
  };

  // ─── Reset Location Selection (to pick another) ──────────────
  const handleResetLocation = () => {
    setDeliveryMode(null);
    setSelectedZoneName("");
    setLocationMsg("");
    setCalculatedDistance(null);
    setSearchQuery("");
  };

  // ─── Manual Pincode Quick-Check (when user types 6 digits) ───
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = searchQuery.trim();
    if (/^[1-9][0-9]{5}$/.test(pin)) {
      if (["190006", "190011", "190024", "190020"].includes(pin)) {
        setDeliveryMode("under5");
        setCalculatedDistance(2.5);
        setSelectedZoneName(`Pin Code ${pin}`);
        setLocationMsg(`Pin Code ${pin} is within our 5km live harvest zone ✓`);
        setFormData((prev) => ({ ...prev, pincode: pin }));
      } else {
        setDeliveryMode("unavailable");
        setCalculatedDistance(8.0);
        setSelectedZoneName(`Pin Code ${pin}`);
        setLocationMsg(`Pin Code ${pin} is outside our 5km radius.`);
      }
    } else if (filteredZones.length > 0) {
      handleSelectZone(filteredZones[0]);
    }
  };

  // ─── STEP 1 -> STEP 2 Transition ────────────────────────────
  const handleConfirmLocationProceed = () => {
    if (!deliveryMode) {
      alert("Please select or detect your Srinagar delivery area first.");
      return;
    }
    if (deliveryMode === "unavailable") {
      alert("We currently deliver only within 5km of Urban Trout Farm, Srinagar.");
      return;
    }
    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── STEP 2 -> STEP 3 Transition ────────────────────────────
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      fullName: true,
      phone: true,
      email: true,
      locality: true,
      house: true,
      pincode: true,
    });

    const newErrors = {
      fullName: validateName(formData.fullName),
      phone: validatePhone(formData.phone),
      email: validateEmail(formData.email),
      locality: validateLocality(formData.locality),
      house: validateHouse(formData.house),
      pincode: validatePincode(formData.pincode),
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some((e) => e !== "")) {
      return;
    }

    captureLead(formData, grandTotal, items);
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── STEP 3: Final Order Submission ──────────────────────────
  const upiPayUri = `upi://pay?pa=${upiId}&pn=Urban%20Trout%20Srinagar&am=${grandTotal}&cu=INR&tn=Urban%20Trout%20Fresh%20Order`;
  const upiQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    upiPayUri
  )}&bgcolor=16-33-44&color=114-221-253&margin=2`;

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  const handleFinalOrderSubmit = async () => {
    setIsSubmitting(true);
    try {
      let cartDetails = "";
      items.forEach((item) => {
        cartDetails += `- ${item.name} (${item.quantity} ${item.unit}): ₹${(
          item.price * item.quantity
        ).toLocaleString("en-IN")}\n`;
      });

      const cleanPhone = formData.phone.replace(/\D/g, "").slice(-10);
      const emailNote = formData.email?.trim() ? ` (Email: ${formData.email.trim()})` : "";
      const notesNote = formData.notes?.trim() ? ` | Notes: ${formData.notes.trim()}` : "";

      const orderPayload = {
        customer_name: formData.fullName.trim(),
        customer_phone: cleanPhone,
        customer_address: `${formData.house.trim()}, ${formData.locality.trim()}${emailNote}${notesNote}`,
        customer_locality: formData.locality.trim(),
        customer_pincode: formData.pincode.trim(),
        items: items.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          unit: i.unit,
          image: i.image,
        })),
        subtotal: total,
        delivery_fee: deliveryFee,
        total: grandTotal,
        delivery_zone: deliveryMode,
        status: "pending",
      };

      const { data: insertedOrder, error: insertErr } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select("*")
        .single();
      if (insertErr) {
        console.error("Order Supabase insert error:", insertErr);
      }

      // Mark lead as converted
      try {
        await supabase
          .from("leads")
          .update({
            status: "converted",
            notes: `Converted to Order #${insertedOrder?.order_number || ""}. Payment via UPI (${upiId}). UTR: ${
              utrRef || "Direct"
            }`,
            updated_at: new Date().toISOString(),
          })
          .eq("customer_phone", cleanPhone);
      } catch (e) {}

      // Upsert customer profile
      try {
        await supabase.from("customers").upsert(
          {
            phone: cleanPhone,
            name: formData.fullName,
            locality: formData.locality,
            pincode: formData.pincode,
            notes: `Order #${insertedOrder?.order_number || ""}`,
            total_orders: 1,
            last_order_at: new Date().toISOString(),
          },
          { onConflict: "phone" }
        );
      } catch (e) {}

      // Telegram notification
      fetch("/api/telegram-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "new_order",
          data: {
            orderNumber: String(insertedOrder?.order_number || "UT-" + Math.floor(1000 + Math.random() * 9000)),
            customerName: formData.fullName,
            phone: cleanPhone,
            email: formData.email?.trim() || undefined,
            locality: formData.locality,
            address: formData.house,
            pincode: formData.pincode,
            items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, unit: i.unit })),
            subtotal: total,
            deliveryFee,
            total: grandTotal,
            paymentMethod: "UPI",
            utrNumber: utrRef || undefined,
          },
        }),
      }).catch(() => {});

      const whatsappMessage = `*NEW HARVEST ORDER (PAID VIA UPI)* 🐟\n\n*Order ID:* #${
        insertedOrder?.order_number || "NEW"
      }\n*Customer:*\nName: ${formData.fullName}\nPhone: +91 ${formData.phone}\n${
        formData.email ? `Email: ${formData.email}\n` : ""
      }Address: ${formData.house}, ${formData.locality}, ${formData.pincode}\n${
        formData.notes ? `Delivery Note: ${formData.notes}\n` : ""
      }\n*Ordered Items:*\n${cartDetails}\n*Delivery Zone:* Within 5km (Free Delivery)\n*Total Paid via UPI:* ₹${grandTotal.toLocaleString(
        "en-IN"
      )}\n*UPI ID Paid To:* ${upiId}\n${
        utrRef ? `*UTR / Ref No:* ${utrRef}\n` : ""
      }\n_Please verify payment & confirm live harvest dispatch!_`;

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

  // ─── Success Screen ──────────────────────────────────────────
  if (orderSuccess) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }}>
        <div style={{ height: "80px" }} />
        <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
          <div
            className="max-w-lg w-full text-center rounded-3xl overflow-hidden"
            style={{
              background: "rgba(16,33,44,0.95)",
              border: "1px solid rgba(114,221,253,0.3)",
              boxShadow: "0 0 60px rgba(114,221,253,0.15)",
            }}
          >
            <div style={{ height: "5px", background: "linear-gradient(to right, #3aadcc, #72ddfd, #25D366)" }} />
            <div className="p-8 md:p-10">
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "rgba(37,211,102,0.12)",
                  border: "2px solid rgba(37,211,102,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.5rem",
                  boxShadow: "0 0 25px rgba(37,211,102,0.25)",
                }}
              >
                <span style={{ fontSize: "36px" }}>🐟</span>
              </div>

              <div
                style={{
                  display: "inline-block",
                  background: "rgba(251,191,36,0.12)",
                  border: "1px solid rgba(251,191,36,0.4)",
                  borderRadius: "100px",
                  padding: "6px 16px",
                  fontSize: "11px",
                  fontFamily: '"Inter", sans-serif',
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#fbbf24",
                  fontWeight: 700,
                  marginBottom: "1.25rem",
                }}
              >
                Order Placed • Live Harvest Verification
              </div>

              <h2
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: "1.85rem",
                  fontWeight: 800,
                  color: C.onSurface,
                  margin: "0 0 0.75rem",
                  lineHeight: 1.2,
                }}
              >
                Thank You, {orderSuccess.name}!
              </h2>
              <p
                style={{
                  fontFamily: '"Manrope", sans-serif',
                  fontSize: "0.92rem",
                  color: C.onSurfVar,
                  lineHeight: 1.7,
                  marginBottom: "1.75rem",
                }}
              >
                Your order <strong style={{ color: C.primary }}>#{orderSuccess.orderNumber}</strong> has been received at{" "}
                <strong>Urban Trout Farm, Srinagar</strong>. We are preparing fresh harvest from our RAS tanks.
              </p>

              <div
                style={{
                  background: "rgba(3,16,24,0.75)",
                  border: "1px solid rgba(61,74,83,0.5)",
                  borderRadius: "16px",
                  padding: "20px",
                  marginBottom: "1.75rem",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                    fontFamily: '"Manrope", sans-serif',
                    fontSize: "0.9rem",
                  }}
                >
                  <span style={{ color: C.onSurfVar }}>Order Number</span>
                  <span style={{ color: C.primary, fontWeight: 700 }}>#{orderSuccess.orderNumber}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                    fontFamily: '"Manrope", sans-serif',
                    fontSize: "0.9rem",
                  }}
                >
                  <span style={{ color: C.onSurfVar }}>Total Amount</span>
                  <span style={{ color: C.primary, fontWeight: 700 }}>
                    ₹{orderSuccess.total.toLocaleString("en-IN")}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                    fontFamily: '"Manrope", sans-serif',
                    fontSize: "0.9rem",
                  }}
                >
                  <span style={{ color: C.onSurfVar }}>Delivery Window</span>
                  <span style={{ color: "#22c55e", fontWeight: 700 }}>Within 90 Mins (Same-Day)</span>
                </div>
                <div
                  style={{
                    borderTop: "1px solid rgba(61,74,83,0.4)",
                    paddingTop: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: '"Manrope", sans-serif',
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ color: C.onSurfVar }}>Farm Helpline</span>
                  <span style={{ color: C.onSurface, fontWeight: 600 }}>+91 84910 06127</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <a
                  href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20I%20placed%20order%20%23${orderSuccess.orderNumber}.%20Please%20verify%20my%20UPI%20payment.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "15px",
                    borderRadius: "14px",
                    background: "#25D366",
                    color: "#fff",
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textDecoration: "none",
                    boxShadow: "0 0 25px rgba(37,211,102,0.35)",
                  }}
                >
                  📱 Share Payment Screenshot on WhatsApp
                </a>
                <Link
                  href="/"
                  style={{
                    display: "block",
                    padding: "14px",
                    borderRadius: "14px",
                    background: "rgba(114,221,253,0.1)",
                    border: "1px solid rgba(114,221,253,0.25)",
                    color: C.primary,
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    textDecoration: "none",
                  }}
                >
                  Return to Home
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
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.bg,
        }}
      >
        <p style={{ fontFamily: '"Manrope", sans-serif', color: C.onSurfVar }}>Redirecting to shop…</p>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-32 pb-24">

        {/* ─── 3-STAGE PROGRESS STEPPER ─── */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="flex items-center justify-between relative px-2">
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800 -z-0" />
            <div
              className="absolute left-6 top-1/2 -translate-y-1/2 h-[2px] transition-all duration-500 -z-0"
              style={{
                width: currentStep === 1 ? "10%" : currentStep === 2 ? "50%" : "95%",
                background: "linear-gradient(to right, #3aadcc, #72ddfd, #25D366)",
              }}
            />

            {/* Step 1 Node */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="relative z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all cursor-pointer"
              style={{
                background: currentStep === 1 ? "#10212c" : "rgba(16,33,44,0.95)",
                border:
                  currentStep === 1
                    ? "1.5px solid #72ddfd"
                    : deliveryMode === "under5"
                    ? "1.5px solid rgba(37,211,102,0.7)"
                    : "1px solid rgba(61,74,83,0.6)",
                boxShadow: currentStep === 1 ? "0 0 20px rgba(114,221,253,0.3)" : "none",
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                style={{
                  background:
                    currentStep > 1 && deliveryMode === "under5"
                      ? "#25D366"
                      : currentStep === 1
                      ? "#72ddfd"
                      : "rgba(61,74,83,0.8)",
                  color: "#002730",
                }}
              >
                {currentStep > 1 && deliveryMode === "under5" ? "✓" : "1"}
              </span>
              <div className="text-left">
                <span
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: currentStep === 1 ? C.primary : C.onSurface,
                    display: "block",
                    lineHeight: 1.1,
                  }}
                >
                  Location Check
                </span>
                <span
                  className="hidden sm:block"
                  style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.onSurfVar }}
                >
                  5km Zone
                </span>
              </div>
            </button>

            {/* Step 2 Node */}
            <button
              type="button"
              onClick={() => {
                if (deliveryMode === "under5") setCurrentStep(2);
              }}
              disabled={deliveryMode !== "under5"}
              className="relative z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all"
              style={{
                background: currentStep === 2 ? "#10212c" : "rgba(16,33,44,0.95)",
                border:
                  currentStep === 2
                    ? "1.5px solid #72ddfd"
                    : currentStep === 3
                    ? "1.5px solid rgba(37,211,102,0.7)"
                    : "1px solid rgba(61,74,83,0.6)",
                boxShadow: currentStep === 2 ? "0 0 20px rgba(114,221,253,0.3)" : "none",
                opacity: deliveryMode === "under5" ? 1 : 0.6,
                cursor: deliveryMode === "under5" ? "pointer" : "not-allowed",
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                style={{
                  background:
                    currentStep === 3 ? "#25D366" : currentStep === 2 ? "#72ddfd" : "rgba(61,74,83,0.8)",
                  color: currentStep >= 2 ? "#002730" : C.onSurfVar,
                }}
              >
                {currentStep === 3 ? "✓" : "2"}
              </span>
              <div className="text-left">
                <span
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: currentStep === 2 ? C.primary : C.onSurface,
                    display: "block",
                    lineHeight: 1.1,
                  }}
                >
                  Fill Details
                </span>
                <span
                  className="hidden sm:block"
                  style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.onSurfVar }}
                >
                  Address & Contact
                </span>
              </div>
            </button>

            {/* Step 3 Node */}
            <button
              type="button"
              onClick={() => {
                if (deliveryMode === "under5" && formData.fullName && formData.phone && formData.house) {
                  setCurrentStep(3);
                }
              }}
              disabled={currentStep < 2 || !formData.phone}
              className="relative z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all"
              style={{
                background: currentStep === 3 ? "#10212c" : "rgba(16,33,44,0.95)",
                border: currentStep === 3 ? "1.5px solid #72ddfd" : "1px solid rgba(61,74,83,0.6)",
                boxShadow: currentStep === 3 ? "0 0 20px rgba(114,221,253,0.3)" : "none",
                opacity: currentStep === 3 || formData.phone ? 1 : 0.6,
                cursor: currentStep === 3 || formData.phone ? "pointer" : "not-allowed",
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                style={{
                  background: currentStep === 3 ? "#72ddfd" : "rgba(61,74,83,0.8)",
                  color: currentStep === 3 ? "#002730" : C.onSurfVar,
                }}
              >
                3
              </span>
              <div className="text-left">
                <span
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: currentStep === 3 ? C.primary : C.onSurface,
                    display: "block",
                    lineHeight: 1.1,
                  }}
                >
                  Payment
                </span>
                <span
                  className="hidden sm:block"
                  style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.onSurfVar }}
                >
                  UPI & Verification
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* ─── MAIN 2-COLUMN GRID ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Multi-Step Content */}
          <section className="lg:col-span-7 space-y-6">

            {/* ══════════════════════════════════════════════════════
                STAGE 1: CHECK DELIVERY LOCATION (AUTO-HIDES UPON SELECTION)
                ══════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div
                className="p-6 md:p-8 rounded-2xl space-y-6"
                style={{
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4" style={{ borderBottom: "1px solid rgba(61,74,83,0.4)" }}>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/shop"
                      className="flex items-center justify-center w-10 h-10 rounded-xl transition-all flex-shrink-0"
                      style={{
                        background: "rgba(3,16,24,0.7)",
                        border: "1px solid rgba(61,74,83,0.6)",
                        color: C.onSurfVar,
                      }}
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </Link>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            fontFamily: '"Inter", sans-serif',
                            fontSize: "10px",
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: C.primary,
                            fontWeight: 700,
                          }}
                        >
                          Step 1 of 3
                        </span>
                        <span style={{ color: C.outline }}>•</span>
                        <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
                          5km Free Delivery Radius
                        </span>
                      </div>
                      <h1
                        style={{
                          fontFamily: '"Space Grotesk", sans-serif',
                          fontSize: "1.65rem",
                          fontWeight: 800,
                          color: C.onSurface,
                          letterSpacing: "-0.03em",
                          margin: "2px 0 0",
                        }}
                      >
                        Select Delivery Area
                      </h1>
                    </div>
                  </div>

                  {/* Sleek Compact GPS Auto-Detect Button in Header */}
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={isLocating}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold uppercase text-xs tracking-wider cursor-pointer active:scale-95 flex-shrink-0"
                    style={{
                      background: "rgba(114,221,253,0.15)",
                      border: "1px solid rgba(114,221,253,0.4)",
                      color: C.primary,
                      fontFamily: '"Space Grotesk", sans-serif',
                      boxShadow: "0 0 15px rgba(114,221,253,0.15)",
                    }}
                  >
                    {isLocating ? (
                      <>
                        <svg className="animate-spin" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Locating…
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                        📍 Auto-Detect GPS
                      </>
                    )}
                  </button>
                </div>

                {/* ─── CASE A: LOCATION IS SELECTED/DETECTED -> HIDE LOCALITY DETAILS ─── */}
                {deliveryMode === "under5" && (
                  <div className="space-y-5">
                    <div
                      className="p-5 rounded-2xl space-y-3"
                      style={{
                        background: "linear-gradient(135deg, rgba(37,211,102,0.15) 0%, rgba(6,35,20,0.7) 100%)",
                        border: "1.5px solid rgba(37,211,102,0.6)",
                        boxShadow: "0 0 30px rgba(37,211,102,0.18)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: "#25D366", color: "#002730", fontWeight: 900, fontSize: "16px" }}
                          >
                            ✓
                          </div>
                          <div>
                            <span
                              style={{
                                fontFamily: '"Inter", sans-serif',
                                fontSize: "10px",
                                letterSpacing: "0.15em",
                                textTransform: "uppercase",
                                color: "#86efac",
                                fontWeight: 700,
                                display: "block",
                              }}
                            >
                              Location Verified • Free Delivery Eligible
                            </span>
                            <h3
                              style={{
                                fontFamily: '"Space Grotesk", sans-serif',
                                fontWeight: 800,
                                color: "#ffffff",
                                fontSize: "1.2rem",
                                margin: "2px 0 0",
                              }}
                            >
                              {selectedZoneName || "GPS Location"} {calculatedDistance !== null && `(~${calculatedDistance.toFixed(1)} km from Farm)`}
                            </h3>
                            <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: "#bbf7d0", margin: "2px 0 0" }}>
                              {locationMsg || "Within our 5km live harvest radius • Dispatched in 90 mins."}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleResetLocation}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex-shrink-0"
                          style={{
                            background: "rgba(3,16,24,0.75)",
                            border: "1px solid rgba(114,221,253,0.35)",
                            color: C.primary,
                            fontFamily: '"Space Grotesk", sans-serif',
                          }}
                        >
                          Change Area
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmLocationProceed}
                      className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all rounded-xl py-4 cursor-pointer"
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "0.98rem",
                        background: C.primaryCont,
                        color: C.onPrimCont,
                        boxShadow: "0 0 30px rgba(58,173,204,0.45)",
                        border: "none",
                      }}
                    >
                      Confirm Location &amp; Fill Details
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* ─── CASE B: OUT OF ZONE -> HIDE LOCALITY DETAILS & SHOW PICKUP NOTICE ─── */}
                {deliveryMode === "unavailable" && (
                  <div className="space-y-5">
                    <div
                      className="p-5 rounded-2xl space-y-3.5 text-center"
                      style={{
                        background: "linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(40,10,10,0.7) 100%)",
                        border: "1.5px solid rgba(239,68,68,0.45)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-4 text-left">
                        <div>
                          <h4
                            style={{
                              fontFamily: '"Space Grotesk", sans-serif',
                              fontWeight: 800,
                              color: "#f87171",
                              fontSize: "1.1rem",
                              margin: "0 0 2px",
                            }}
                          >
                            {selectedZoneName ? `${selectedZoneName} is outside 5km zone` : "Outside 5km Delivery Radius"}
                          </h4>
                          <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: "#fca5a5", margin: 0 }}>
                            {locationMsg || "Urban Trout delivers within 5km of Naseem Bagh to guarantee live freshness."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetLocation}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex-shrink-0"
                          style={{
                            background: "rgba(3,16,24,0.75)",
                            border: "1px solid rgba(239,68,68,0.4)",
                            color: "#fca5a5",
                            fontFamily: '"Space Grotesk", sans-serif',
                          }}
                        >
                          Pick Another
                        </button>
                      </div>

                      <div
                        className="p-3 rounded-xl text-left text-xs"
                        style={{ background: "rgba(3,16,24,0.85)", border: "1px solid rgba(239,68,68,0.25)" }}
                      >
                        <strong style={{ color: "#fca5a5", display: "block", marginBottom: "2px" }}>
                          🏪 Live Vending Center Pickup Available:
                        </strong>
                        <span style={{ color: C.onSurface }}>
                          Malabagh, Naseem Bagh, Srinagar — 190006 (Near R P School, Girls Wing)
                        </span>
                      </div>

                      <div className="flex gap-2.5 justify-center pt-1">
                        <a
                          href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20I%20am%20outside%20the%205km%20zone.%20Can%20I%20arrange%20pickup%20or%20special%20delivery?`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 rounded-xl font-bold uppercase text-xs flex items-center gap-1.5"
                          style={{
                            background: "#25D366",
                            color: "#fff",
                            fontFamily: '"Space Grotesk", sans-serif',
                            textDecoration: "none",
                          }}
                        >
                          💬 WhatsApp Inquiry
                        </a>
                        <a
                          href="https://maps.google.com/?q=34.144709,74.824525"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 rounded-xl font-bold uppercase text-xs flex items-center gap-1.5"
                          style={{
                            background: "rgba(114,221,253,0.1)",
                            border: "1px solid rgba(114,221,253,0.25)",
                            color: C.primary,
                            fontFamily: '"Space Grotesk", sans-serif',
                            textDecoration: "none",
                          }}
                        >
                          📍 Directions to Farm
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── CASE C: NO LOCATION DETECTED YET -> SHOW SEARCH & LOCALITIES LIST ─── */}
                {!deliveryMode && (
                  <div className="space-y-5">
                    {/* Combined Search & Filter Bar */}
                    <form onSubmit={handleSearchSubmit} className="relative">
                      <div style={{ position: "relative" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: "14px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: C.onSurfVar,
                            pointerEvents: "none",
                          }}
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </span>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search Srinagar locality or 6-digit pin code (e.g. 190006)…"
                          style={{
                            width: "100%",
                            background: "rgba(3,16,24,0.85)",
                            border: "1.5px solid rgba(61,74,83,0.7)",
                            borderRadius: "12px",
                            padding: "12px 16px 12px 42px",
                            color: C.onSurface,
                            fontFamily: '"Manrope", sans-serif',
                            fontSize: "0.88rem",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                          onFocus={(e) => (e.target.style.borderColor = "rgba(114,221,253,0.7)")}
                          onBlur={(e) => (e.target.style.borderColor = "rgba(61,74,83,0.7)")}
                        />
                      </div>
                    </form>

                    {/* Srinagar Localities Chips Grid */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.onSurfVar, fontWeight: 600 }}>
                          Popular Srinagar Localities (from Naseem Bagh farm):
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                        {filteredZones.map((zone) => {
                          return (
                            <button
                              key={zone.name}
                              type="button"
                              onClick={() => handleSelectZone(zone)}
                              className="px-3 py-2.5 rounded-xl text-left transition-all flex flex-col justify-between cursor-pointer active:scale-95"
                              style={{
                                background: "rgba(3,16,24,0.7)",
                                border: "1px solid rgba(61,74,83,0.5)",
                              }}
                            >
                              <div className="flex items-center justify-between w-full">
                                <span
                                  style={{
                                    fontFamily: '"Space Grotesk", sans-serif',
                                    fontWeight: 700,
                                    fontSize: "0.84rem",
                                    color: C.onSurface,
                                  }}
                                >
                                  {zone.name}
                                </span>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    color: zone.eligible ? "#4ade80" : "#f87171",
                                  }}
                                >
                                  {zone.eligible ? "✓" : "×"}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontFamily: '"Manrope", sans-serif',
                                  fontSize: "10px",
                                  color: zone.eligible ? "#86efac" : C.onSurfVar,
                                  marginTop: "2px",
                                }}
                              >
                                ~{zone.distanceKm} km {zone.eligible ? "• Free Delivery" : "• Out of zone"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STAGE 2: FILL CUSTOMER & DELIVERY DETAILS
                ══════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
              <div
                className="p-6 md:p-8 rounded-2xl space-y-8"
                style={{
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-5" style={{ borderBottom: "1px solid rgba(61,74,83,0.4)" }}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      style={{
                        background: "rgba(3,16,24,0.8)",
                        border: "1px solid rgba(61,74,83,0.6)",
                        color: C.onSurfVar,
                      }}
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      Change Location
                    </button>
                    <div>
                      <span
                        style={{
                          fontFamily: '"Inter", sans-serif',
                          fontSize: "10px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: C.primary,
                          fontWeight: 700,
                        }}
                      >
                        Stage 2 of 3
                      </span>
                      <h1
                        style={{
                          fontFamily: '"Space Grotesk", sans-serif',
                          fontSize: "1.55rem",
                          fontWeight: 800,
                          color: C.onSurface,
                          letterSpacing: "-0.03em",
                          margin: 0,
                        }}
                      >
                        Customer &amp; Delivery Details
                      </h1>
                    </div>
                  </div>
                </div>

                {/* Location Pill Banner */}
                <div
                  className="p-3.5 rounded-xl flex items-center justify-between gap-3"
                  style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.3)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ fontSize: "16px" }}>📍</span>
                    <div>
                      <span style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: "0.85rem", fontWeight: 700, color: "#4ade80" }}>
                        Verified Delivery Zone ({selectedZoneName || "Srinagar 5km Zone"})
                      </span>
                      <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "11px", color: "#86efac", margin: 0 }}>
                        Free Same-Day Cold-Chain Delivery Active
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    style={{
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "11px",
                      color: C.primary,
                      textDecoration: "underline",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Edit Zone
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleProceedToPayment} noValidate className="space-y-6">
                  {/* Card 1: Contact Info */}
                  <div
                    className="p-5 rounded-xl space-y-4"
                    style={{ background: "rgba(3,16,24,0.6)", border: "1px solid rgba(61,74,83,0.5)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: C.primary, fontSize: "16px" }}>👤</span>
                      <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface, margin: 0 }}>
                        1. Contact Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        label="WhatsApp Phone Number"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        placeholder="10-digit mobile"
                        required
                        maxLength={10}
                        prefix="+91"
                        helperText="We send harvest video & order status here"
                        error={errors.phone}
                        touched={touched.phone}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                      />
                      <div className="md:col-span-2">
                        <Field
                          label="Email Address (Optional)"
                          name="email"
                          type="email"
                          value={formData.email}
                          placeholder="sameer.ahmed@gmail.com"
                          helperText="For order invoice & receipts"
                          error={errors.email}
                          touched={touched.email}
                          onChange={handleInputChange}
                          onBlur={handleBlur}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Address */}
                  <div
                    className="p-5 rounded-xl space-y-4"
                    style={{ background: "rgba(3,16,24,0.6)", border: "1px solid rgba(61,74,83,0.5)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: C.primary, fontSize: "16px" }}>🏠</span>
                      <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface, margin: 0 }}>
                        2. Srinagar Delivery Address
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Field
                          label="Locality / Landmark in Srinagar"
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
                        placeholder="e.g. House No. 24, Lane 3"
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
                  </div>

                  {/* Card 3: Harvest & Delivery Notes */}
                  <div
                    className="p-5 rounded-xl space-y-3"
                    style={{ background: "rgba(3,16,24,0.6)", border: "1px solid rgba(61,74,83,0.5)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: C.primary, fontSize: "16px" }}>📝</span>
                      <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface, margin: 0 }}>
                        3. Harvest &amp; Packaging Notes (Optional)
                      </h3>
                    </div>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. Clean extra thoroughly, ring the bell upon arrival, or pack with extra ice."
                      rows={2}
                      style={{
                        width: "100%",
                        background: "rgba(3,16,24,0.85)",
                        border: "1.5px solid rgba(61,74,83,0.7)",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        color: C.onSurface,
                        fontFamily: '"Manrope", sans-serif',
                        fontSize: "0.88rem",
                        outline: "none",
                        resize: "none",
                      }}
                    />
                  </div>

                  {/* Navigation Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-6 py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all order-2 sm:order-1 cursor-pointer"
                      style={{
                        background: "rgba(3,16,24,0.8)",
                        border: "1px solid rgba(61,74,83,0.6)",
                        color: C.onSurfVar,
                        fontFamily: '"Space Grotesk", sans-serif',
                      }}
                    >
                      ← Back to Location
                    </button>
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all rounded-xl py-4 order-1 sm:order-2 cursor-pointer"
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "0.95rem",
                        background: C.primaryCont,
                        color: C.onPrimCont,
                        boxShadow: "0 0 30px rgba(58,173,204,0.35)",
                        border: "none",
                      }}
                    >
                      Proceed to UPI Payment
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STAGE 3: PAYMENT & CONFIRMATION
                ══════════════════════════════════════════════════════ */}
            {currentStep === 3 && (
              <div
                className="p-6 md:p-8 rounded-2xl space-y-8"
                style={{
                  background: C.cardBg,
                  border: "1px solid rgba(114,221,253,0.25)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-5" style={{ borderBottom: "1px solid rgba(61,74,83,0.5)" }}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    style={{
                      background: "rgba(3,16,24,0.8)",
                      border: "1px solid rgba(61,74,83,0.6)",
                      color: C.onSurfVar,
                    }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    ← Edit Details
                  </button>
                  <span
                    style={{
                      fontFamily: '"Inter", sans-serif',
                      fontSize: "10px",
                      color: C.primary,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    Stage 3 of 3 • Payment
                  </span>
                </div>

                {/* Recipient & Delivery Snapshot Card */}
                <div
                  className="p-4 rounded-xl flex flex-col md:flex-row justify-between gap-3"
                  style={{ background: "rgba(3,16,24,0.85)", border: "1px solid rgba(61,74,83,0.6)" }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "9px",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: C.outline,
                        display: "block",
                      }}
                    >
                      Delivering To
                    </span>
                    <p
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700,
                        color: C.onSurface,
                        margin: "2px 0 0",
                        fontSize: "0.95rem",
                      }}
                    >
                      {formData.fullName} (+91 {formData.phone})
                    </p>
                    <p
                      style={{
                        fontFamily: '"Manrope", sans-serif',
                        color: C.onSurfVar,
                        fontSize: "0.82rem",
                        margin: "2px 0 0",
                      }}
                    >
                      {formData.house}, {formData.locality}, {formData.pincode}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <span
                      style={{
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "9px",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: C.outline,
                        display: "block",
                      }}
                    >
                      Delivery Radius
                    </span>
                    <p
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700,
                        color: "#4ade80",
                        margin: "2px 0 0",
                        fontSize: "0.9rem",
                      }}
                    >
                      Within 5km — Free Delivery ✓
                    </p>
                  </div>
                </div>

                {/* ─── UPI Payment Glass Card ─── */}
                <div
                  className="p-6 md:p-8 rounded-2xl space-y-6"
                  style={{
                    background: "rgba(6,21,30,0.95)",
                    border: "1.5px solid rgba(114,221,253,0.35)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                  }}
                >
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* QR Code Container */}
                    <div
                      className="p-3 rounded-2xl flex-shrink-0 flex flex-col items-center"
                      style={{
                        background: "#10212c",
                        border: "1px solid rgba(114,221,253,0.3)",
                        boxShadow: "0 0 20px rgba(114,221,253,0.15)",
                      }}
                    >
                      <img
                        src={upiQrCodeUrl}
                        alt="Scan to Pay via UPI"
                        style={{ width: "180px", height: "180px", borderRadius: "10px" }}
                      />
                      <span
                        style={{
                          fontFamily: '"Inter", sans-serif',
                          fontSize: "9px",
                          color: C.primary,
                          letterSpacing: "0.1em",
                          marginTop: "8px",
                          textTransform: "uppercase",
                          fontWeight: 700,
                        }}
                      >
                        Scan with Any UPI App
                      </span>
                    </div>

                    {/* Payment Info */}
                    <div className="flex-1 space-y-4 text-center md:text-left w-full">
                      <div>
                        <span
                          style={{
                            fontFamily: '"Inter", sans-serif',
                            fontSize: "10px",
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: C.onSurfVar,
                          }}
                        >
                          Total Amount to Pay
                        </span>
                        <h3
                          style={{
                            fontFamily: '"Space Grotesk", sans-serif',
                            fontSize: "2.4rem",
                            fontWeight: 800,
                            color: C.primary,
                            letterSpacing: "-0.03em",
                            margin: "2px 0 0",
                          }}
                        >
                          ₹{grandTotal.toLocaleString("en-IN")}
                        </h3>
                      </div>

                      {/* Copy UPI Box */}
                      <div
                        className="flex items-center justify-between p-3.5 rounded-xl gap-3"
                        style={{ background: "rgba(3,16,24,0.85)", border: "1px solid rgba(61,74,83,0.6)" }}
                      >
                        <div className="flex flex-col text-left">
                          <span
                            style={{
                              fontFamily: '"Inter", sans-serif',
                              fontSize: "9px",
                              color: C.outline,
                              textTransform: "uppercase",
                              letterSpacing: "0.1em",
                            }}
                          >
                            Official Farm UPI ID
                          </span>
                          <span
                            style={{
                              fontFamily: '"Space Grotesk", sans-serif',
                              fontSize: "0.95rem",
                              fontWeight: 700,
                              color: C.onSurface,
                            }}
                          >
                            {upiId}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={copyUpiId}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                          style={{
                            background: copiedUpi ? "rgba(37,211,102,0.2)" : "rgba(114,221,253,0.15)",
                            color: copiedUpi ? "#25D366" : C.primary,
                            border: `1px solid ${copiedUpi ? "#25D366" : "rgba(114,221,253,0.3)"}`,
                          }}
                        >
                          {copiedUpi ? "Copied! ✓" : "Copy ID"}
                        </button>
                      </div>

                      {/* ─── ONE-TAP UPI APP BUTTONS ─── */}
                      <div className="space-y-2">
                        <span
                          style={{
                            fontFamily: '"Inter", sans-serif',
                            fontSize: "9px",
                            color: "rgba(180,195,205,0.7)",
                            textTransform: "uppercase",
                            letterSpacing: "0.12em",
                            fontWeight: 700,
                            display: "block",
                          }}
                        >
                          Tap to Open &amp; Pay Directly
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {/* PhonePe */}
                          <a
                            href={`phonepe://pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=UrbanTrout-Order`}
                            className="flex items-center gap-2 p-2.5 rounded-xl border transition-all active:scale-95"
                            style={{ background: "#5f259f", borderColor: "#4a1a7a", textDecoration: "none" }}
                          >
                            <img src="/icons8-phone-pe-480.svg" alt="PhonePe" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0 }} />
                            <div>
                              <p style={{ color: "white", fontWeight: 700, fontSize: "11px", fontFamily: '"Space Grotesk", sans-serif' }}>PhonePe</p>
                              <p style={{ color: "#c9a8f7", fontSize: "10px", fontFamily: '"Inter", sans-serif' }}>₹{grandTotal.toLocaleString("en-IN")}</p>
                            </div>
                          </a>

                          {/* Google Pay */}
                          <a
                            href={`tez://upi/pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=UrbanTrout-Order`}
                            className="flex items-center gap-2 p-2.5 rounded-xl border transition-all active:scale-95"
                            style={{ background: "#1a73e8", borderColor: "#1558b0", textDecoration: "none" }}
                          >
                            <img src="/icons8-google-pay-480.svg" alt="Google Pay" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: "white", padding: 2 }} />
                            <div>
                              <p style={{ color: "white", fontWeight: 700, fontSize: "11px", fontFamily: '"Space Grotesk", sans-serif' }}>Google Pay</p>
                              <p style={{ color: "#93c5fd", fontSize: "10px", fontFamily: '"Inter", sans-serif' }}>₹{grandTotal.toLocaleString("en-IN")}</p>
                            </div>
                          </a>

                          {/* Paytm */}
                          <a
                            href={`paytmmp://pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=UrbanTrout-Order`}
                            className="flex items-center gap-2 p-2.5 rounded-xl border transition-all active:scale-95"
                            style={{ background: "#00BAF2", borderColor: "#0096c4", textDecoration: "none" }}
                          >
                            <img src="/icons8-paytm-480.svg" alt="Paytm" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: "white", padding: 2 }} />
                            <div>
                              <p style={{ color: "white", fontWeight: 700, fontSize: "11px", fontFamily: '"Space Grotesk", sans-serif' }}>Paytm</p>
                              <p style={{ color: "#bae6fd", fontSize: "10px", fontFamily: '"Inter", sans-serif' }}>₹{grandTotal.toLocaleString("en-IN")}</p>
                            </div>
                          </a>

                          {/* BHIM / Any UPI */}
                          <a
                            href={`upi://pay?pa=${upiId}&pn=Urban%20Trout&am=${grandTotal}&cu=INR&tn=UrbanTrout-Order`}
                            className="flex items-center gap-2 p-2.5 rounded-xl border transition-all active:scale-95"
                            style={{ background: "#FF6600", borderColor: "#cc5200", textDecoration: "none" }}
                          >
                            <img src="/icons8-bhim-480.svg" alt="BHIM UPI" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0 }} />
                            <div>
                              <p style={{ color: "white", fontWeight: 700, fontSize: "11px", fontFamily: '"Space Grotesk", sans-serif' }}>BHIM / Any</p>
                              <p style={{ color: "#fed7aa", fontSize: "10px", fontFamily: '"Inter", sans-serif' }}>₹{grandTotal.toLocaleString("en-IN")}</p>
                            </div>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* UTR Input */}
                  <div className="pt-4" style={{ borderTop: "1px solid rgba(61,74,83,0.4)" }}>
                    <label
                      style={{
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "11px",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: C.onSurfVar,
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: 600,
                      }}
                    >
                      Transaction UTR / Reference No. (Optional)
                    </label>
                    <input
                      type="text"
                      value={utrRef}
                      onChange={(e) => setUtrRef(e.target.value)}
                      placeholder="e.g. 423871928371 (from your UPI receipt)"
                      style={{
                        width: "100%",
                        background: "rgba(3,16,24,0.85)",
                        border: "1px solid rgba(61,74,83,0.6)",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        color: C.onSurface,
                        fontFamily: '"Manrope", sans-serif',
                        fontSize: "0.9rem",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                {/* Final Confirmation CTA Button */}
                <button
                  type="button"
                  onClick={handleFinalOrderSubmit}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 rounded-xl py-4 cursor-pointer"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "0.98rem",
                    background: "#25D366",
                    color: "#fff",
                    border: "none",
                    boxShadow: "0 0 30px rgba(37,211,102,0.45)",
                  }}
                >
                  {isSubmitting ? (
                    "Confirming Live Harvest Order…"
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

          {/* ══════════════════════════════════════════════════════
              RIGHT COLUMN: REDESIGNED ORDER SUMMARY SIDEBAR
              ══════════════════════════════════════════════════════ */}
          <aside className="lg:col-span-5 sticky top-32 space-y-4">
            <div
              style={{
                borderRadius: "20px",
                overflow: "hidden",
                background: "rgba(16,33,44,0.92)",
                border: "1px solid rgba(114,221,253,0.2)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between p-5"
                style={{
                  borderBottom: "1px solid rgba(61,74,83,0.4)",
                  background: "rgba(21,40,52,0.85)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "16px" }}>🛒</span>
                  <h2
                    style={{
                      fontFamily: '"Space Grotesk", sans-serif',
                      fontWeight: 800,
                      fontSize: "1.1rem",
                      color: C.onSurface,
                      margin: 0,
                    }}
                  >
                    Order Summary
                  </h2>
                </div>
                <span
                  style={{
                    background: "rgba(114,221,253,0.12)",
                    color: C.primary,
                    padding: "4px 12px",
                    borderRadius: "100px",
                    fontSize: "11px",
                    fontFamily: '"Inter", sans-serif',
                    fontWeight: 700,
                    border: "1px solid rgba(114,221,253,0.25)",
                  }}
                >
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {/* Items List */}
              <div className="p-5 space-y-5">
                <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(3,16,24,0.5)", border: "1px solid rgba(61,74,83,0.4)" }}
                    >
                      <div
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "10px",
                          overflow: "hidden",
                          flexShrink: 0,
                          border: "1px solid rgba(61,74,83,0.4)",
                        }}
                      >
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-grow flex flex-col justify-center">
                        <div className="flex justify-between items-start mb-1">
                          <h4
                            style={{
                              fontFamily: '"Space Grotesk", sans-serif',
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              color: C.onSurface,
                              margin: 0,
                            }}
                          >
                            {item.name}
                          </h4>
                          <span
                            style={{
                              fontFamily: '"Space Grotesk", sans-serif',
                              fontSize: "0.9rem",
                              fontWeight: 800,
                              color: C.primary,
                              marginLeft: "8px",
                            }}
                          >
                            ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div
                            className="flex items-center gap-0 w-max rounded-lg overflow-hidden"
                            style={{ border: "1px solid rgba(61,74,83,0.6)", background: "rgba(3,16,24,0.8)" }}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, Math.max(item.minQuantity || 1, item.quantity - 1))}
                              disabled={item.quantity <= (item.minQuantity || 1)}
                              className="w-7 h-6 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ color: C.primary, fontWeight: 700 }}
                            >
                              −
                            </button>
                            <span
                              style={{
                                fontFamily: '"Space Grotesk", sans-serif',
                                fontSize: "11px",
                                color: C.onSurfVar,
                                minWidth: "40px",
                                textAlign: "center",
                                fontWeight: 700,
                              }}
                            >
                              {item.quantity} {item.unit}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-6 flex items-center justify-center transition-colors cursor-pointer"
                              style={{ color: C.primary, fontWeight: 700 }}
                            >
                              +
                            </button>
                          </div>
                          {(item.minQuantity || 1) > 1 && (
                            <span
                              style={{
                                fontFamily: '"Space Grotesk", sans-serif',
                                fontSize: "10px",
                                color: "#72ddfd",
                                background: "rgba(114,221,253,0.1)",
                                border: "1px solid rgba(114,221,253,0.25)",
                                borderRadius: "6px",
                                padding: "1px 6px",
                                fontWeight: 700,
                              }}
                            >
                              Min. {item.minQuantity} {item.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ height: "1px", background: "rgba(61,74,83,0.4)" }} />

                {/* Pricing Breakdown */}
                <div className="space-y-2.5" style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem" }}>
                  <div className="flex justify-between">
                    <span style={{ color: C.onSurfVar }}>Subtotal</span>
                    <span style={{ color: C.onSurface, fontWeight: 600 }}>₹{total.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: C.onSurfVar }}>5km Fresh Delivery</span>
                    <span
                      style={{
                        color: deliveryMode === "under5" ? "#4ade80" : C.primary,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                      }}
                    >
                      {!deliveryMode
                        ? "Check zone (Step 1)"
                        : deliveryMode === "unavailable"
                        ? "Outside 5km"
                        : "FREE ✓"}
                    </span>
                  </div>
                </div>

                <div style={{ height: "1px", background: "rgba(114,221,253,0.2)" }} />

                {/* Total Payable */}
                <div className="flex justify-between items-end pt-1">
                  <div>
                    <p
                      style={{
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "10px",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: C.outline,
                        marginBottom: "4px",
                        fontWeight: 700,
                      }}
                    >
                      Total Payable
                    </p>
                    <h3
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "2.1rem",
                        fontWeight: 800,
                        color: C.primary,
                        letterSpacing: "-0.04em",
                        lineHeight: 1,
                        margin: 0,
                      }}
                    >
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </h3>
                  </div>
                </div>

                {/* Trust Badges */}
                <div
                  className="p-3.5 rounded-xl space-y-2 text-xs"
                  style={{
                    background: "rgba(3,16,24,0.6)",
                    border: "1px solid rgba(61,74,83,0.4)",
                    fontFamily: '"Manrope", sans-serif',
                  }}
                >
                  <div className="flex items-center gap-2" style={{ color: "#86efac" }}>
                    <span>✓</span>
                    <span>Live RAS Tank Harvested</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: "#86efac" }}>
                    <span>✓</span>
                    <span>Cold-Chain 90-Min Dispatch</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: "#86efac" }}>
                    <span>✓</span>
                    <span>Direct Farm Support: +91 84910 06127</span>
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
