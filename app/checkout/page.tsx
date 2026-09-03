"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";

// ─── Razorpay global type ───────────────────────────────────────
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, handler: (response: unknown) => void): void;
    };
  }
}

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
  const { items, total, totalSavings, updateQuantity, removeItem, clearCart } = useCart();
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
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number>(5.0);
  const [farmLat, setFarmLat] = useState<number>(34.144709);
  const [farmLng, setFarmLng] = useState<number>(74.824525);
  const [allowOutsideRadius, setAllowOutsideRadius] = useState<boolean>(false);

  // ─── Payment & Settings State ───
  const [upiId, setUpiId] = useState("urbantrout@ybl");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [razorpayError, setRazorpayError] = useState("");
  const [copiedOrderId, setCopiedOrderId] = useState(false);

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
      // 1. Instant local read
      try {
        const local = localStorage.getItem("urban_trout_delivery_settings") || localStorage.getItem("urban_trout_store_settings");
        if (local) {
          const map = JSON.parse(local);
          if (map.upi_id) setUpiId(map.upi_id);
          if (map.delivery_radius_km) {
            const r = parseFloat(map.delivery_radius_km);
            if (!isNaN(r) && r > 0) setDeliveryRadiusKm(r);
          }
          if (map.farm_latitude) {
            const lat = parseFloat(map.farm_latitude);
            if (!isNaN(lat)) setFarmLat(lat);
          }
          if (map.farm_longitude) {
            const lng = parseFloat(map.farm_longitude);
            if (!isNaN(lng)) setFarmLng(lng);
          }
          if (map.allow_outside_radius_delivery !== undefined) {
            setAllowOutsideRadius(map.allow_outside_radius_delivery === "true");
          }
        }
      } catch (_) {}

      // 2. Fetch from API endpoint
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const json = await res.json();
          const map = json.settingsMap || {};
          if (map.upi_id) setUpiId(map.upi_id);
          if (map.delivery_radius_km) {
            const r = parseFloat(map.delivery_radius_km);
            if (!isNaN(r) && r > 0) setDeliveryRadiusKm(r);
          }
          if (map.farm_latitude) {
            const lat = parseFloat(map.farm_latitude);
            if (!isNaN(lat)) setFarmLat(lat);
          }
          if (map.farm_longitude) {
            const lng = parseFloat(map.farm_longitude);
            if (!isNaN(lng)) setFarmLng(lng);
          }
          if (map.allow_outside_radius_delivery !== undefined) {
            setAllowOutsideRadius(map.allow_outside_radius_delivery === "true");
          }
        }
      } catch {
        /* use default */
      }
    }
    fetchSettings();
  }, []);

  useEffect(() => {
    if (items.length === 0 && !orderSuccess) router.push("/shop");
  }, [items, orderSuccess, router]);

  // Filtered zones based on dynamic radius and search query
  const filteredZones = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const dynamicZones = SRINAGAR_ZONES.map((z) => ({
      ...z,
      eligible: z.distanceKm <= deliveryRadiusKm,
    }));
    if (!q) return dynamicZones;
    return dynamicZones.filter(
      (z) => z.name.toLowerCase().includes(q) || z.pincode.includes(q)
    );
  }, [searchQuery, deliveryRadiusKm]);

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
        const dist = calculateDistance(farmLat, farmLng, latitude, longitude);
        setCalculatedDistance(dist);

        if (dist <= deliveryRadiusKm) {
          setDeliveryMode("under5");
          setSelectedZoneName("GPS Detected Location");
          setLocationMsg(`${dist.toFixed(1)} km from Farm — Free Delivery Eligible ✓`);
        } else {
          setDeliveryMode("unavailable");
          setSelectedZoneName("GPS Detected Location");
          setLocationMsg(`${dist.toFixed(1)} km from Farm — Outside ${deliveryRadiusKm}km delivery zone.`);
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
    const isEligible = zone.distanceKm <= deliveryRadiusKm;
    if (isEligible) {
      setDeliveryMode("under5");
      setLocationMsg(`${zone.name} (~${zone.distanceKm} km) — Free Delivery ✓`);
      setFormData((prev) => ({
        ...prev,
        locality: zone.name,
        pincode: zone.pincode,
      }));
    } else {
      setDeliveryMode("unavailable");
      setLocationMsg(`${zone.name} (~${zone.distanceKm} km) — Outside ${deliveryRadiusKm}km zone.`);
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
      const match = SRINAGAR_ZONES.find((z) => z.pincode === pin);
      const dist = match ? match.distanceKm : 6.0;
      if (dist <= deliveryRadiusKm) {
        setDeliveryMode("under5");
        setCalculatedDistance(dist);
        setSelectedZoneName(match ? match.name : `Pin Code ${pin}`);
        setLocationMsg(`Pin Code ${pin} is within our ${deliveryRadiusKm}km fresh delivery zone ✓`);
        setFormData((prev) => ({ ...prev, pincode: pin }));
      } else {
        setDeliveryMode("unavailable");
        setCalculatedDistance(dist);
        setSelectedZoneName(match ? match.name : `Pin Code ${pin}`);
        setLocationMsg(`Pin Code ${pin} is outside our ${deliveryRadiusKm}km radius.`);
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
    if (deliveryMode === "unavailable" && !allowOutsideRadius) {
      alert(`We currently deliver fresh catch only within ${deliveryRadiusKm}km of Urban Trout Farm, Srinagar.`);
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


  // ─── STEP 3: Razorpay Standard Checkout ──────────────────────
  const handleRazorpayPayment = async () => {
    setRazorpayError("");

    if (!window.Razorpay) {
      setRazorpayError("Payment gateway not loaded yet. Please wait a moment and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Razorpay order server-side
      const amountPaise = grandTotal * 100; // ₹ → paise
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `ut_${Date.now()}`,
          customerName: formData.fullName,
          customerPhone: formData.phone,
          customerEmail: formData.email,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || "Failed to create payment order.");
      }

      const { order_id, amount, currency } = await orderRes.json();

      // 2. Open Razorpay modal
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount,
          currency,
          order_id,
          name: "Urban Trout",
          description: `Fresh Trout Order — ${items.length} item${items.length > 1 ? "s" : ""}`,
          image: "/icon.png",
          prefill: {
            name: formData.fullName,
            contact: `91${formData.phone.replace(/\D/g, "").slice(-10)}`,
            email: formData.email || "",
          },
          notes: {
            customer_name: formData.fullName,
            customer_phone: formData.phone,
            customer_email: formData.email || "",
            address: `${formData.house}, ${formData.locality}, ${formData.pincode}`,
            delivery_zone: deliveryMode,
            special_notes: formData.notes || "",
          },
          theme: { color: "#3aadcc" },
          modal: {
            ondismiss: () => {
              setIsSubmitting(false);
              setRazorpayError("Payment cancelled. You can try again.");
              reject(new Error("dismissed"));
            },
          },
          handler: async (response: unknown) => {
            const rzpRes = response as {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            };

            try {
              // 3. Verify signature server-side
              const verifyRes = await fetch("/api/razorpay/verify-payment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: rzpRes.razorpay_order_id,
                  razorpay_payment_id: rzpRes.razorpay_payment_id,
                  razorpay_signature: rzpRes.razorpay_signature,
                }),
              });

              const verifyJson = await verifyRes.json();
              if (!verifyJson.success) {
                throw new Error(verifyJson.error || "Payment verification failed.");
              }

              // 4. Save order to Supabase (payment confirmed)
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
                status: "confirmed",
                payment_method: "razorpay",
                razorpay_payment_id: rzpRes.razorpay_payment_id,
                razorpay_order_id: rzpRes.razorpay_order_id,
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
                    notes: `Converted to Order #${insertedOrder?.order_number || ""}. Payment via Razorpay (${rzpRes.razorpay_payment_id})`,
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

              // Telegram & Email notification
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
                    status: "confirmed",
                    paymentMethod: "Razorpay",
                    razorpayPaymentId: rzpRes.razorpay_payment_id,
                    razorpayOrderId: rzpRes.razorpay_order_id,
                  },
                }),
              }).catch(() => {});

              setOrderSuccess({
                orderNumber: insertedOrder?.order_number || "UT-" + Math.floor(1000 + Math.random() * 9000),
                total: grandTotal,
                subtotal: total,
                deliveryFee,
                phone: cleanPhone,
                name: formData.fullName,
                email: formData.email?.trim() || null,
                house: formData.house,
                locality: formData.locality,
                pincode: formData.pincode,
                notes: formData.notes,
                paymentId: rzpRes.razorpay_payment_id,
                orderId: rzpRes.razorpay_order_id,
                items: items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  quantity: i.quantity,
                  price: i.price,
                  unit: i.unit,
                  image: i.image,
                })),
                date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
                time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
              });

              if (clearCart) clearCart();
              resolve();
            } catch (handlerErr) {
              console.error("Post-payment error:", handlerErr);
              reject(handlerErr);
            }
          },
        });

        rzp.on("payment.failed", (response: unknown) => {
          const r = response as { error?: { description?: string } };
          setRazorpayError(r?.error?.description || "Payment failed. Please try again.");
          setIsSubmitting(false);
          reject(new Error("payment_failed"));
        });

        rzp.open();
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message === "dismissed" || err.message === "payment_failed")) {
        // Already handled above
      } else {
        console.error("Razorpay payment error:", err);
        const msg = err instanceof Error ? err.message : "Something went wrong. Please try again or contact us on WhatsApp.";
        setRazorpayError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  // ─── Success Screen (Order Confirmed via Razorpay) ───────────
  if (orderSuccess) {
    const handleCopyOrderId = () => {
      navigator.clipboard.writeText(String(orderSuccess.orderNumber));
      setCopiedOrderId(true);
      setTimeout(() => setCopiedOrderId(false), 2500);
    };

    return (
      <div style={{ background: C.bg, minHeight: "100vh", padding: "6rem 1rem 5rem" }}>
        <div className="max-w-3xl mx-auto space-y-6">

          {/* ─── Hero Confirmation Card ─── */}
          <div
            className="text-center rounded-3xl overflow-hidden p-6 sm:p-10 relative"
            style={{
              background: "linear-gradient(180deg, rgba(16,33,44,0.98) 0%, rgba(6,21,30,0.98) 100%)",
              border: "1px solid rgba(114,221,253,0.3)",
              boxShadow: "0 0 60px rgba(58,173,204,0.15)",
            }}
          >
            <div style={{ height: "4px", background: "linear-gradient(to right, #3aadcc, #72ddfd, #22c55e)", position: "absolute", top: 0, left: 0, right: 0 }} />

            {/* Glowing Emerald Badge */}
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center relative"
              style={{
                background: "rgba(34,197,94,0.12)",
                border: "2px solid rgba(34,197,94,0.45)",
                boxShadow: "0 0 35px rgba(34,197,94,0.3)",
              }}
            >
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3"
              style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80" }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Payment Verified • Order Confirmed
            </div>

            <h1
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-2"
              style={{ fontFamily: '"Space Grotesk", sans-serif' }}
            >
              Thank You, {orderSuccess.name}!
            </h1>
            <p
              className="text-sm sm:text-base max-w-xl mx-auto text-slate-400 leading-relaxed mb-6"
              style={{ fontFamily: '"Manrope", sans-serif' }}
            >
              Your order <strong className="text-cyan-300">#{orderSuccess.orderNumber}</strong> has been confirmed and paid.
              Our aquaculture specialists in Naseem Bagh are preparing your live harvest for express same-day delivery.
            </p>

            {/* Quick Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Order Number</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-bold text-cyan-300 font-mono">#{orderSuccess.orderNumber}</span>
                  <button
                    onClick={handleCopyOrderId}
                    className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800 text-cyan-400 hover:text-white transition-colors"
                  >
                    {copiedOrderId ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Paid</span>
                <div className="text-base font-bold text-white font-mono mt-1">₹{orderSuccess.total.toLocaleString("en-IN")}</div>
                <span className="text-[10px] text-emerald-400 font-semibold block">Razorpay Verified ✓</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Delivery Window</span>
                <div className="text-base font-bold text-emerald-400 mt-1">Within 90 Mins</div>
                <span className="text-[10px] text-slate-500 block">Same-Day Express</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Payment ID</span>
                <div className="text-xs font-mono text-slate-300 truncate mt-1" title={orderSuccess.paymentId}>
                  {orderSuccess.paymentId || "Instant Verified"}
                </div>
                <span className="text-[10px] text-cyan-400 font-semibold block">Zero Pending Steps</span>
              </div>
            </div>
          </div>

          {/* ─── Live Harvest & Delivery Tracker ─── */}
          <div
            className="p-6 sm:p-8 rounded-3xl"
            style={{
              background: "rgba(16,33,44,0.75)",
              border: "1px solid rgba(61,74,83,0.5)",
            }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="text-xl">🐟</span>
              <h2 className="text-base font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Live Harvest &amp; Delivery Progress
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative">
              {/* Step 1: Paid */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/40 relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black flex items-center justify-center">✓</span>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">1. Confirmed</span>
                </div>
                <p className="text-xs text-slate-300 font-semibold">Payment Verified</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Automated Razorpay verification complete.</p>
              </div>

              {/* Step 2: Harvesting */}
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/50 relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-400 text-slate-950 text-xs font-black flex items-center justify-center animate-pulse">2</span>
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">2. Harvesting</span>
                </div>
                <p className="text-xs text-white font-semibold">Fresh RAS Catch</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Harvested to order from clean spring tanks.</p>
              </div>

              {/* Step 3: Packing */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">3</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">3. Ice-Packing</span>
                </div>
                <p className="text-xs text-slate-400 font-semibold">Cold-Chain Prep</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Gutted/cleaned &amp; sealed in food-grade ice.</p>
              </div>

              {/* Step 4: Out for delivery */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-400 text-xs font-bold flex items-center justify-center">4</span>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">4. Dispatched</span>
                </div>
                <p className="text-xs text-slate-400 font-semibold">Express Rider</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Delivered fresh within 90 minutes.</p>
              </div>
            </div>
          </div>

          {/* ─── Two-Column Details Grid ─── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left: Ordered Items Summary */}
            <div
              className="md:col-span-7 p-6 rounded-3xl space-y-4"
              style={{ background: "rgba(16,33,44,0.75)", border: "1px solid rgba(61,74,83,0.5)" }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Order Summary &amp; Items
              </h3>

              <div className="divide-y divide-slate-800/80">
                {(orderSuccess.items || []).map((item: any, idx: number) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-12 h-12 object-cover rounded-xl bg-slate-950 border border-slate-800 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xl flex-shrink-0">
                          🐟
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {item.quantity} {item.unit || "Kg"} × ₹{item.price}/kg
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-cyan-300 font-mono flex-shrink-0">
                      ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono text-slate-200">₹{(orderSuccess.subtotal || orderSuccess.total).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Farm-Fresh Delivery:</span>
                  <span className="font-semibold text-emerald-400">FREE (Under 5km Zone)</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-800">
                  <span style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Total Paid:</span>
                  <span className="text-cyan-300 font-mono text-base">₹{orderSuccess.total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            {/* Right: Delivery Destination & Notifications */}
            <div
              className="md:col-span-5 p-6 rounded-3xl space-y-4"
              style={{ background: "rgba(16,33,44,0.75)", border: "1px solid rgba(61,74,83,0.5)" }}
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                Delivery Destination
              </h3>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1 text-xs">
                <p className="font-bold text-white text-sm">{orderSuccess.name}</p>
                <p className="text-slate-300 font-mono">+91 {orderSuccess.phone}</p>
                <p className="text-slate-400 leading-relaxed pt-1">
                  {orderSuccess.house ? `${orderSuccess.house}, ` : ""}
                  {orderSuccess.locality || "Srinagar"}
                  {orderSuccess.pincode ? ` - ${orderSuccess.pincode}` : ""}
                </p>
                {orderSuccess.notes && (
                  <p className="text-amber-400/90 text-[11px] pt-1">
                    <strong>Note:</strong> {orderSuccess.notes}
                  </p>
                )}
              </div>

              {/* Email Receipt Notification Alert */}
              {orderSuccess.email ? (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 flex items-start gap-2.5">
                  <span className="text-base">📧</span>
                  <div className="text-xs">
                    <span className="font-bold text-cyan-300 block">Confirmation Email Sent</span>
                    <span className="text-slate-400 text-[11px] break-all">
                      A detailed receipt has been dispatched to <strong>{orderSuccess.email}</strong>.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
                  <span className="text-base">📱</span>
                  <div className="text-xs">
                    <span className="font-bold text-slate-300 block">SMS / WhatsApp Confirmation</span>
                    <span className="text-slate-400 text-[11px]">
                      Updates will be dispatched to +91 {orderSuccess.phone}.
                    </span>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                  <span>📍</span> Farm Origin
                </div>
                <p>Urban Trout Farm &amp; Hatchery, Malabagh, Naseem Bagh, Srinagar — 190006</p>
              </div>
            </div>
          </div>

          {/* ─── Actions & Support ─── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                <span>🖨️</span> Print / Save Receipt
              </button>

              <Link
                href="/shop"
                className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                style={{ fontFamily: '"Space Grotesk", sans-serif' }}
              >
                <span>🐟</span> Continue Shopping
              </Link>
            </div>

            <a
              href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20Question%20regarding%20my%20confirmed%20order%20%23${orderSuccess.orderNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <span>💬</span> Questions? Chat on WhatsApp
            </a>
          </div>

          <p className="text-center text-xs text-slate-600 pt-2">
            Farm Direct Hotline: <strong className="text-slate-400">+91 84910 06127</strong> • Guaranteed Fresh Delivery within 90 Minutes
          </p>

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
      {/* ─── Razorpay Checkout.js Script ─── */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
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
                  Razorpay Instant Pay
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
                          {deliveryRadiusKm}km Free Delivery Radius
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
                              {locationMsg || `Within our ${deliveryRadiusKm}km live harvest radius • Dispatched in 90 mins.`}
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
                            {selectedZoneName ? `${selectedZoneName} is outside ${deliveryRadiusKm}km zone` : `Outside ${deliveryRadiusKm}km Delivery Radius`}
                          </h4>
                          <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.85rem", color: "#fca5a5", margin: 0 }}>
                            {locationMsg || `Urban Trout delivers within ${deliveryRadiusKm}km of Naseem Bagh to guarantee live freshness.`}
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
                          href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20I%20am%20outside%20the%20${deliveryRadiusKm}km%20zone.%20Can%20I%20arrange%20pickup%20or%20special%20delivery?`}
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
                          href={`https://maps.google.com/?q=${farmLat},${farmLng}`}
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
                        Verified Delivery Zone ({selectedZoneName || `Srinagar ${deliveryRadiusKm}km Zone`})
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
                      Within {deliveryRadiusKm}km — Free Delivery ✓
                    </p>
                  </div>
                </div>

                {/* ─── Razorpay Payment Card ─── */}
                <div
                  className="p-6 md:p-8 rounded-2xl space-y-6"
                  style={{
                    background: "rgba(6,21,30,0.95)",
                    border: "1.5px solid rgba(114,221,253,0.35)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* Amount display */}
                  <div className="text-center space-y-1">
                    <span
                      style={{
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "10px",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: C.onSurfVar,
                        display: "block",
                      }}
                    >
                      Total Amount to Pay
                    </span>
                    <h3
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "2.8rem",
                        fontWeight: 800,
                        color: C.primary,
                        letterSpacing: "-0.03em",
                        margin: 0,
                      }}
                    >
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </h3>
                    <p
                      style={{
                        fontFamily: '"Manrope", sans-serif',
                        fontSize: "0.82rem",
                        color: C.onSurfVar,
                        margin: 0,
                      }}
                    >
                      Free Delivery • Secure Payment via Razorpay
                    </p>
                  </div>

                  {/* Payment method badges */}
                  <div
                    className="flex flex-wrap items-center justify-center gap-2 py-3 px-4 rounded-xl"
                    style={{ background: "rgba(3,16,24,0.7)", border: "1px solid rgba(61,74,83,0.5)" }}
                  >
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.outline, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                      Accepts:
                    </span>
                    {["UPI", "Cards", "Net Banking", "Wallets"].map((m) => (
                      <span
                        key={m}
                        style={{
                          fontFamily: '"Space Grotesk", sans-serif',
                          fontSize: "11px",
                          fontWeight: 700,
                          color: C.primary,
                          background: "rgba(114,221,253,0.1)",
                          border: "1px solid rgba(114,221,253,0.25)",
                          borderRadius: "6px",
                          padding: "3px 10px",
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>

                  {/* Security note */}
                  <div className="flex items-center justify-center gap-2">
                    <svg width="14" height="14" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span style={{ fontFamily: '"Inter", sans-serif', fontSize: "11px", color: "#4ade80" }}>
                      256-bit SSL secured · PCI-DSS compliant · Powered by Razorpay
                    </span>
                  </div>

                  {/* Error message */}
                  {razorpayError && (
                    <div
                      className="flex items-start gap-3 p-4 rounded-xl"
                      style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.35)" }}
                    >
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                      <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "0.88rem", color: "#f87171", margin: 0 }}>
                        {razorpayError}
                      </p>
                    </div>
                  )}
                </div>

                {/* Pay Now CTA */}
                <button
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 rounded-xl py-5 cursor-pointer"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "1rem",
                    background: isSubmitting
                      ? "rgba(58,173,204,0.6)"
                      : "linear-gradient(135deg, #3aadcc 0%, #72ddfd 100%)",
                    color: "#002730",
                    border: "none",
                    boxShadow: isSubmitting ? "none" : "0 0 35px rgba(114,221,253,0.45)",
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Processing…
                    </span>
                  ) : (
                    <>
                      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      Pay ₹{grandTotal.toLocaleString("en-IN")} Securely
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
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <h4
                            style={{
                              fontFamily: '"Space Grotesk", sans-serif',
                              fontSize: "0.88rem",
                              fontWeight: 700,
                              color: C.onSurface,
                              margin: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="flex flex-col items-end">
                              <span
                                style={{
                                  fontFamily: '"Space Grotesk", sans-serif',
                                  fontSize: "0.9rem",
                                  fontWeight: 800,
                                  color: C.primary,
                                }}
                              >
                                ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                              </span>
                              {item.originalPrice && item.originalPrice > item.price && (
                                <span
                                  className="line-through text-[11px] font-semibold"
                                  style={{
                                    color: "#64748b",
                                    fontFamily: '"Space Grotesk", sans-serif',
                                    textDecorationColor: "#ef4444",
                                  }}
                                >
                                  ₹{(item.originalPrice * item.quantity).toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>

                            {/* Remove Close Button */}
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-500/30 transition-all cursor-pointer ml-1"
                              title="Remove product"
                              aria-label={`Remove ${item.name}`}
                            >
                              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
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
                  {totalSavings > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold" style={{ color: "#4ade80" }}>
                      <span className="flex items-center gap-1">🎉 Promotional Savings</span>
                      <span>-₹{totalSavings.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span style={{ color: C.onSurfVar }}>{deliveryRadiusKm}km Fresh Delivery</span>
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
                        ? `Outside ${deliveryRadiusKm}km`
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
