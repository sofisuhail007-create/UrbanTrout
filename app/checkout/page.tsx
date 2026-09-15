"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Script from "next/script";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const CustomerLiveMap = dynamic(() => import("@/components/CustomerLiveMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[260px] sm:h-[300px] rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-400 font-mono text-xs">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        Loading Live Map…
      </div>
    </div>
  ),
});
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

// ─── Srinagar Landmark Coordinates for Distance Lookup & GPS Fallback ───
interface SrinagarLandmark {
  name: string;
  lat: number;
  lng: number;
  pincode: string;
}

const SRINAGAR_LANDMARKS: SrinagarLandmark[] = [
  { name: "Naseem Bagh", lat: 34.1378, lng: 74.8385, pincode: "190006" },
  { name: "Malabagh", lat: 34.1450, lng: 74.8250, pincode: "190006" },
  { name: "Hazratbal", lat: 34.1250, lng: 74.8430, pincode: "190006" },
  { name: "Habak", lat: 34.1480, lng: 74.8410, pincode: "190006" },
  { name: "Zakura", lat: 34.1590, lng: 74.8190, pincode: "190024" },
  { name: "Lal Bazar", lat: 34.1160, lng: 74.8180, pincode: "190011" },
  { name: "Soura / SKIMS", lat: 34.1330, lng: 74.8080, pincode: "190011" },
  { name: "Bachpora", lat: 34.1520, lng: 74.8050, pincode: "190020" },
  { name: "Illahibagh", lat: 34.1400, lng: 74.8120, pincode: "190011" },
  { name: "Rainawari", lat: 34.0950, lng: 74.8310, pincode: "190003" },
  { name: "Dalgate", lat: 34.0780, lng: 74.8340, pincode: "190001" },
  { name: "Rajbagh", lat: 34.0620, lng: 74.8250, pincode: "190008" },
  { name: "Lal Chowk", lat: 34.0710, lng: 74.8110, pincode: "190001" },
];

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearestLandmark(lat: number, lng: number): { name: string; pincode: string } {
  let closest = SRINAGAR_LANDMARKS[0];
  let minD = Infinity;
  for (const l of SRINAGAR_LANDMARKS) {
    const d = calculateDistance(lat, lng, l.lat, l.lng);
    if (d < minD) {
      minD = d;
      closest = l;
    }
  }
  return { name: closest.name, pincode: closest.pincode };
}

async function reverseGeocodeCoords(lat: number, lng: number): Promise<{ locality: string; pincode: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`, {
      signal: controller.signal,
      headers: { "Accept-Language": "en" },
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.city_district || addr.quarter || addr.village || addr.road;
      const pincode = (addr.postcode || "").replace(/\D/g, "").slice(0, 6);
      if (locality) {
        return {
          locality: `${locality}, Srinagar`,
          pincode: pincode || "190006",
        };
      }
    }
  } catch (_) {
    // Network or abort fallback
  }

  // Fallback to closest known landmark
  const nearest = findNearestLandmark(lat, lng);
  return {
    locality: `${nearest.name}, Srinagar`,
    pincode: nearest.pincode,
  };
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
  const [locatingStep, setLocatingStep] = useState<"idle" | "requesting" | "scanning" | "verifying" | "locked" | "denied" | "error">("idle");
  const [locationMsg, setLocationMsg] = useState("");
  const [permissionErrorHelp, setPermissionErrorHelp] = useState("");
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [selectedZoneName, setSelectedZoneName] = useState<string>("");
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number>(5.0);
  const [farmLat, setFarmLat] = useState<number>(34.144709);
  const [farmLng, setFarmLng] = useState<number>(74.824525);
  const [allowOutsideRadius, setAllowOutsideRadius] = useState<boolean>(false);

  // ─── Payment & Settings State ───
  const [upiId, setUpiId] = useState("JKBMERC00828895@jkb");
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

  // ─── Location Detection (Auto-Detect GPS Only) ──────────────
  const detectLocation = () => {
    setIsLocating(true);
    setLocatingStep("requesting");
    setLocationMsg("Requesting satellite GPS signal…");
    setPermissionErrorHelp("");

    if (!("geolocation" in navigator)) {
      setLocationMsg("Geolocation is not supported by this browser.");
      setLocatingStep("error");
      setIsLocating(false);
      return;
    }

    const timer = setTimeout(() => {
      setLocatingStep("scanning");
      setLocationMsg("Pinging GPS satellites for high-accuracy coordinates…");
    }, 450);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearTimeout(timer);
        setLocatingStep("verifying");
        setLocationMsg("Calculating direct distance to Urban Trout Farm (Naseem Bagh)…");

        const { latitude, longitude } = pos.coords;
        const dist = calculateDistance(farmLat, farmLng, latitude, longitude);
        setDetectedCoords({ lat: latitude, lng: longitude });
        setCalculatedDistance(dist);

        // Reverse-geocode to get actual human-readable Srinagar neighborhood
        const geo = await reverseGeocodeCoords(latitude, longitude);
        setSelectedZoneName(geo.locality);
        setFormData((prev) => ({
          ...prev,
          locality: prev.locality || geo.locality,
          pincode: prev.pincode || geo.pincode,
        }));

        if (dist <= deliveryRadiusKm) {
          setDeliveryMode("under5");
          setLocatingStep("locked");
          setLocationMsg(`${dist.toFixed(1)} km from Farm • Free 90-Min Fresh Catch Delivery ✓`);
        } else {
          setDeliveryMode("unavailable");
          setLocatingStep("locked");
          setLocationMsg(`${dist.toFixed(1)} km from Farm • Outside our ${deliveryRadiusKm}km live harvest delivery radius.`);
        }
        setIsLocating(false);
      },
      (err) => {
        clearTimeout(timer);
        setIsLocating(false);
        if (err.code === 1) {
          // Permission denied
          setLocatingStep("denied");
          setLocationMsg("Location permission was denied.");
          setPermissionErrorHelp("Please tap the lock (🔒) icon next to the URL in your browser and toggle 'Location' to Allow, then tap Retry.");
        } else if (err.code === 3) {
          // Timeout
          setLocatingStep("error");
          setLocationMsg("GPS signal timed out. Please retry with high accuracy or Wi-Fi enabled.");
        } else {
          setLocatingStep("error");
          setLocationMsg("Unable to retrieve GPS coordinates from your device.");
        }
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  // ─── Reset Location Selection ────────────────────────────────
  const handleResetLocation = () => {
    setDeliveryMode(null);
    setDetectedCoords(null);
    setSelectedZoneName("");
    setLocationMsg("");
    setLocatingStep("idle");
    setPermissionErrorHelp("");
    setCalculatedDistance(null);
  };

  // ─── STEP 1 -> STEP 2 Transition ────────────────────────────
  const handleConfirmLocationProceed = () => {
    if (!deliveryMode || !detectedCoords) {
      alert("Please auto-detect your delivery location using device GPS first.");
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
            latitude: detectedCoords ? String(detectedCoords.lat) : "",
            longitude: detectedCoords ? String(detectedCoords.lng) : "",
            distance_km: calculatedDistance ? calculatedDistance.toFixed(1) : "",
            google_maps_url: detectedCoords ? `https://maps.google.com/?q=${detectedCoords.lat},${detectedCoords.lng}` : "",
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
              const rzpNote = rzpRes.razorpay_payment_id ? ` (Razorpay: ${rzpRes.razorpay_payment_id})` : "";
              const notesNote = formData.notes?.trim() ? ` | Notes: ${formData.notes.trim()}` : "";
              const mapsUrl = detectedCoords ? `https://maps.google.com/?q=${detectedCoords.lat},${detectedCoords.lng}` : "";
              const gpsNote = detectedCoords
                ? ` | 📍 Exact GPS: ${mapsUrl} (~${(calculatedDistance || 0).toFixed(1)} km from Naseem Bagh Farm)`
                : "";

              const orderPayload = {
                customer_name: formData.fullName.trim(),
                customer_phone: cleanPhone,
                customer_address: `${formData.house.trim()}, ${formData.locality.trim()}${emailNote}${rzpNote}${notesNote}${gpsNote}`,
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
                    address: `${formData.house.trim()}${gpsNote}`,
                    pincode: formData.pincode,
                    items: items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price, unit: i.unit })),
                    subtotal: total,
                    deliveryFee,
                    total: grandTotal,
                    status: "confirmed",
                    paymentMethod: "Razorpay",
                    razorpayPaymentId: rzpRes.razorpay_payment_id,
                    razorpayOrderId: rzpRes.razorpay_order_id,
                    googleMapsUrl: mapsUrl || undefined,
                    latitude: detectedCoords?.lat,
                    longitude: detectedCoords?.lng,
                    distanceKm: calculatedDistance || undefined,
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
                detectedCoords,
                calculatedDistance,
                googleMapsUrl: mapsUrl || null,
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

              {/* Exact GPS Pinpoint Card */}
              {orderSuccess.googleMapsUrl && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      📍 Exact GPS Pinpoint Locked
                    </span>
                    <a
                      href={orderSuccess.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold hover:bg-emerald-500/30 transition-all flex-shrink-0"
                    >
                      Open in Maps
                    </a>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Doorstep GPS coordinates ({orderSuccess.detectedCoords?.lat?.toFixed(5)}°, {orderSuccess.detectedCoords?.lng?.toFixed(5)}°)
                    {orderSuccess.calculatedDistance ? ` • ~${orderSuccess.calculatedDistance.toFixed(1)} km from Naseem Bagh Farm` : ""}
                    {" "}have been securely sent to our delivery dispatch team.
                  </p>
                </div>
              )}

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
            {/* ══════════════════════════════════════════════════════
                STAGE 1: AUTO-DETECT DELIVERY LOCATION ONLY
                ══════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
              <div
                className="p-6 md:p-8 rounded-3xl space-y-6 relative overflow-hidden"
                style={{
                  background: C.cardBg,
                  border: `1px solid ${C.cardBorder}`,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* CSS Keyframe Animations for Radar */}
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes radarSweep {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes radarPulse {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.08); opacity: 0.9; }
                  }
                  @keyframes beaconRing {
                    0% { transform: scale(0.6); opacity: 0.9; }
                    100% { transform: scale(2.2); opacity: 0; }
                  }
                  @keyframes pinBounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                  }
                `}} />

                {/* Header Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
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
                          Strict {deliveryRadiusKm}km Fresh Catch Zone
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
                        Delivery Location Verification
                      </h1>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-[11px] text-cyan-300 font-mono">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    GPS Auto-Detect Only
                  </div>
                </div>

                {/* ─── TRANSPARENT PRIVACY & PURPOSE GUARANTEE NOTICE ─── */}
                <div
                  className="p-4 rounded-2xl flex items-start gap-3.5"
                  style={{
                    background: "linear-gradient(135deg, rgba(6,33,48,0.7) 0%, rgba(3,16,24,0.85) 100%)",
                    border: "1px solid rgba(114,221,253,0.22)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-cyan-300"
                    style={{ background: "rgba(114,221,253,0.12)", border: "1px solid rgba(114,221,253,0.3)" }}
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                        Privacy &amp; Location Purpose Notice
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                        Zero Marketing Use
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                      We use your device location <strong>solely to calculate delivery distance</strong> from our Naseem Bagh farm and guide our express courier directly to your doorstep. We never sell, share, or store your GPS coordinates for any other purpose.
                    </p>
                  </div>
                </div>

                {/* ─── RADAR SCANNER & DETECTION STAGE (WHEN NO GPS DETECTED YET) ─── */}
                {!detectedCoords && (
                  <div className="flex flex-col items-center justify-center text-center py-4 sm:py-6">
                    {/* Radar Graphics Container */}
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center mb-6">
                      {/* Outer ambient glow */}
                      <div
                        className="absolute inset-0 rounded-full filter blur-xl transition-all duration-700"
                        style={{
                          background: isLocating
                            ? "radial-gradient(circle, rgba(114,221,253,0.35) 0%, transparent 70%)"
                            : locatingStep === "denied"
                            ? "radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)"
                            : "radial-gradient(circle, rgba(114,221,253,0.15) 0%, transparent 70%)",
                        }}
                      />

                      {/* Concentric Radar Rings */}
                      <div
                        className="absolute inset-0 rounded-full border transition-all duration-500"
                        style={{
                          borderColor: locatingStep === "denied" ? "rgba(245,158,11,0.4)" : "rgba(114,221,253,0.2)",
                          background: "rgba(3,16,24,0.6)",
                        }}
                      />
                      <div
                        className="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border transition-all duration-500"
                        style={{
                          borderColor: locatingStep === "denied" ? "rgba(245,158,11,0.3)" : "rgba(114,221,253,0.25)",
                        }}
                      />
                      <div
                        className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border transition-all duration-500"
                        style={{
                          borderColor: locatingStep === "denied" ? "rgba(245,158,11,0.5)" : "rgba(114,221,253,0.35)",
                        }}
                      />

                      {/* Crosshairs */}
                      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-700/40 pointer-events-none" />
                      <div className="absolute inset-y-0 left-1/2 w-[1px] bg-slate-700/40 pointer-events-none" />

                      {/* Animated Radar Sweep Beam (active when locating) */}
                      {isLocating && (
                        <div
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{
                            background: "conic-gradient(from 0deg, rgba(114,221,253,0.45) 0deg, transparent 65deg, transparent 360deg)",
                            animation: "radarSweep 2s linear infinite",
                          }}
                        />
                      )}

                      {/* Center Beacon / Pin */}
                      <div className="relative z-10 flex flex-col items-center justify-center">
                        {isLocating ? (
                          <div className="relative flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300">
                              <svg className="animate-spin w-7 h-7" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            </div>
                            <div className="absolute inset-0 rounded-full bg-cyan-400/30" style={{ animation: "beaconRing 2s cubic-bezier(0,0,0.2,1) infinite" }} />
                          </div>
                        ) : locatingStep === "denied" ? (
                          <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400 flex items-center justify-center text-2xl">
                            🔒
                          </div>
                        ) : (
                          <div className="relative group cursor-pointer" onClick={detectLocation}>
                            <div
                              className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_30px_rgba(114,221,253,0.35)] hover:scale-105"
                              style={{ background: "linear-gradient(135deg, #10212c 0%, #152834 100%)", border: "1.5px solid #72ddfd" }}
                            >
                              <svg className="w-7 h-7 text-cyan-300" style={{ animation: "pinBounce 2s ease-in-out infinite" }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                                <circle cx="12" cy="12" r="8" strokeDasharray="2 2" />
                              </svg>
                            </div>
                            <div className="absolute -inset-2 rounded-full border border-cyan-400/30" style={{ animation: "beaconRing 3s ease-out infinite" }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Indicator Title & Descriptions */}
                    <div className="max-w-md mx-auto space-y-2 mb-6">
                      {isLocating ? (
                        <div>
                          <h3 className="text-base font-bold text-cyan-300 font-mono uppercase tracking-wider">
                            {locatingStep === "scanning" ? "Scanning GPS Satellites…" : "Calculating Distance…"}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            {locationMsg || "Locking high-accuracy device coordinates for delivery radius validation…"}
                          </p>
                        </div>
                      ) : locatingStep === "denied" ? (
                        <div className="space-y-3">
                          <h3 className="text-base font-bold text-amber-300 font-mono">Location Permission Blocked</h3>
                          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left text-xs text-slate-300 space-y-2">
                            <p className="font-semibold text-amber-300">How to allow location access:</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                              <li><strong>iOS / Safari:</strong> Tap the <em>aA</em> or page settings icon in the address bar → <em>Website Settings</em> → set <em>Location</em> to <strong>Allow</strong>.</li>
                              <li><strong>Android / Chrome:</strong> Tap the <em>🔒 (Lock)</em> icon in the URL bar → <em>Permissions</em> → set <em>Location</em> to <strong>Allow</strong>.</li>
                            </ul>
                          </div>
                        </div>
                      ) : locatingStep === "error" ? (
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-red-300 font-mono">GPS Signal Issue</h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {locationMsg || "Unable to acquire accurate GPS coordinates. Please ensure device location / GPS is turned ON and retry."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                            Auto-Detect Your Delivery Location
                          </h3>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                            Tap below to verify delivery eligibility via your device GPS and lock your exact doorstep pin for courier navigation.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Detection / Retry Button */}
                    <div className="w-full max-w-sm">
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={isLocating}
                        className="w-full flex items-center justify-center gap-2.5 font-bold uppercase tracking-wider rounded-xl py-3.5 px-6 transition-all cursor-pointer shadow-lg active:scale-98"
                        style={{
                          fontFamily: '"Space Grotesk", sans-serif',
                          fontSize: "0.92rem",
                          background: "linear-gradient(135deg, #72ddfd 0%, #3aadcc 100%)",
                          color: "#002730",
                          boxShadow: "0 0 25px rgba(114,221,253,0.35)",
                        }}
                      >
                        {isLocating ? (
                          <>
                            <svg className="animate-spin" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                            Acquiring GPS Signal…
                          </>
                        ) : locatingStep === "denied" || locatingStep === "error" ? (
                          <>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                            </svg>
                            Retry GPS Detection
                          </>
                        ) : (
                          <>
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="3" />
                              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                              <circle cx="12" cy="12" r="8" strokeDasharray="2 2" />
                            </svg>
                            Auto-Detect My Location
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── UBER / OLA STYLE INTERACTIVE LIVE MAP & VERIFIED LOCATION (ONCE DETECTED) ─── */}
                {detectedCoords && deliveryMode && (
                  <div className="space-y-6 pt-2">
                    {/* Status Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              deliveryMode === "under5"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/15 text-red-400 border border-red-500/30"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                deliveryMode === "under5" ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                              }`}
                            />
                            {deliveryMode === "under5" ? "Delivery Zone Verified" : "Outside Delivery Zone"}
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                          {selectedZoneName || "GPS Location Confirmed"}
                        </h3>
                        <p
                          className={`text-xs mt-0.5 ${
                            deliveryMode === "under5" ? "text-emerald-300/90" : "text-red-300/90"
                          }`}
                        >
                          {locationMsg ||
                            (deliveryMode === "under5"
                              ? `${calculatedDistance?.toFixed(1)} km from Naseem Bagh Farm • Free 90-Min Live Catch Delivery ✓`
                              : `${calculatedDistance?.toFixed(1)} km from Farm • Outside our ${deliveryRadiusKm}km live harvest delivery radius.`)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetLocation}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-cyan-300 bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
                      >
                        🔄 Re-detect GPS
                      </button>
                    </div>

                    {/* Interactive Uber / Ola Live Map */}
                    <CustomerLiveMap
                      customerLat={detectedCoords.lat}
                      customerLng={detectedCoords.lng}
                      farmLat={farmLat}
                      farmLng={farmLng}
                      deliveryRadiusKm={deliveryRadiusKm}
                      distanceKm={calculatedDistance || undefined}
                      isInZone={deliveryMode === "under5"}
                      localityName={selectedZoneName}
                    />

                    {/* Doorstep Coordinates Bar & Google Maps Direct Link */}
                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="text-left font-mono">
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Exact Doorstep Pinpoint</span>
                        <span className="text-cyan-300 font-semibold">
                          {detectedCoords.lat.toFixed(5)}° N, {detectedCoords.lng.toFixed(5)}° E
                          {calculatedDistance !== null && ` • ~${calculatedDistance.toFixed(1)} km from Naseem Bagh Farm`}
                        </span>
                      </div>
                      <a
                        href={`https://maps.google.com/?q=${detectedCoords.lat},${detectedCoords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-semibold hover:text-white transition-colors flex items-center gap-1.5 flex-shrink-0"
                      >
                        🗺️ Open on Google Maps ↗
                      </a>
                    </div>

                    {/* CASE 1: IN-ZONE -> PROCEED TO STEP 2 */}
                    {deliveryMode === "under5" && (
                      <div className="space-y-3 pt-2">
                        <button
                          type="button"
                          onClick={handleConfirmLocationProceed}
                          className="w-full flex items-center justify-center gap-2.5 font-bold uppercase tracking-widest rounded-xl py-4 px-6 transition-all cursor-pointer shadow-lg active:scale-98"
                          style={{
                            fontFamily: '"Space Grotesk", sans-serif',
                            fontSize: "0.95rem",
                            background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                            color: "#ffffff",
                            boxShadow: "0 0 30px rgba(34,197,94,0.4)",
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

                    {/* CASE 2: OUT-OF-ZONE -> EXPLANATION & SELF PICKUP */}
                    {deliveryMode === "unavailable" && (
                      <div className="space-y-4 pt-2">
                        <div className="p-4 rounded-xl text-left text-xs bg-slate-950/80 border border-red-500/30 space-y-2">
                          <strong className="text-red-400 block font-semibold text-sm">
                            🏪 Live Vending Center Self-Pickup Available:
                          </strong>
                          <p className="text-slate-300">
                            Because live harvested trout requires express aeration within 90 minutes, doorstep delivery is restricted to a {deliveryRadiusKm}km perimeter. You are always welcome to pick up freshly harvested catch directly from our live raceways:
                          </p>
                          <span className="text-slate-200 block font-semibold pt-1">
                            📍 Malabagh, Naseem Bagh, Srinagar — 190006 (Near R P School, Girls Wing)
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <a
                            href={`https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20My%20location%20is%20${calculatedDistance?.toFixed(1)}km%20away.%20Can%20I%20arrange%20special%20delivery%20or%20pickup?`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 bg-emerald-500 text-slate-950 transition-all hover:bg-emerald-400 shadow-md"
                          >
                            💬 WhatsApp Support
                          </a>
                          <a
                            href={`https://maps.google.com/?q=${farmLat},${farmLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 text-slate-200 hover:text-white shadow-md"
                          >
                            📍 Farm Route on Google Maps
                          </a>
                        </div>
                      </div>
                    )}
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
                        Verified Delivery Location ({selectedZoneName || `Srinagar ${deliveryRadiusKm}km Zone`})
                      </span>
                      <p style={{ fontFamily: '"Manrope", sans-serif', fontSize: "11px", color: "#86efac", margin: 0 }}>
                        {calculatedDistance ? `~${calculatedDistance.toFixed(1)} km from Naseem Bagh Farm • ` : ""}
                        Free Same-Day Live Catch Delivery Active
                      </p>
                      {detectedCoords && (
                        <a
                          href={`https://maps.google.com/?q=${detectedCoords.lat},${detectedCoords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-cyan-300 underline font-mono inline-block mt-0.5"
                        >
                          View Doorstep Pin on Google Maps ↗
                        </a>
                      )}
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
                    Change GPS Pin
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
