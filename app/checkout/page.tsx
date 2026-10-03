"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Script from "next/script";
import dynamic from "next/dynamic";
import { fbPurchase, fbInitiateCheckout } from "@/lib/fbpixel";
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
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { supabase } from "@/lib/supabase";
import { getBusinessHoursInfo } from "@/lib/businessHours";
import { getDeliveryScheduleInfo, DeliveryScheduleInfo } from "@/lib/deliverySchedule";
import { calculateTroutNutrition } from "@/lib/nutrition";

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
const FARM_LAT = 34.1445563;
const FARM_LNG = 74.8245018;
const DELIVERY_RADIUS_KM = 5.0;

// ─── Srinagar Landmark Coordinates for Distance Lookup & GPS Fallback ───
interface SrinagarLandmark {
  name: string;
  lat: number;
  lng: number;
  pincode: string;
  aliases?: string[];
}

const SRINAGAR_LANDMARKS: SrinagarLandmark[] = [
  {
    name: "Malabagh",
    lat: 34.145,
    lng: 74.825,
    pincode: "190006",
    aliases: ["malabagh", "mala bagh", "mallabagh", "malla bagh", "malabagh srinagar", "elahi bagh road malabagh"],
  },
  {
    name: "Illahibagh",
    lat: 34.14,
    lng: 74.812,
    pincode: "190011",
    aliases: [
      "illahibagh",
      "illahi bagh",
      "ellahi bagh",
      "ellahibagh",
      "elahi bagh",
      "elahibagh",
      "ilahi bagh",
      "ilahibagh",
      "ellahi",
      "illahi",
      "elahi",
      "ilahi",
      "illahi bagh srinagar",
      "ellahi bagh srinagar",
      "elahibagh srinagar",
    ],
  },
  {
    name: "Naseem Bagh",
    lat: 34.1378,
    lng: 74.8385,
    pincode: "190006",
    aliases: ["naseem bagh", "naseembagh", "nasim bagh", "nasimbagh", "kashmir university", "ku", "hazratbal road"],
  },
  {
    name: "Hazratbal",
    lat: 34.125,
    lng: 74.843,
    pincode: "190006",
    aliases: ["hazratbal", "hazrat bal", "hazratbal shrine", "dargah", "dargah hazratbal", "hazratbal srinagar"],
  },
  {
    name: "Habak",
    lat: 34.148,
    lng: 74.841,
    pincode: "190006",
    aliases: ["habak", "habbak", "habak crossing", "habbak crossing", "habak naseembagh", "habak srinagar"],
  },
  {
    name: "Zakura",
    lat: 34.159,
    lng: 74.819,
    pincode: "190024",
    aliases: ["zakura", "zakoora", "zakura crossing", "zakoora crossing", "zakura industrial area", "zakura srinagar"],
  },
  {
    name: "Soura / SKIMS",
    lat: 34.133,
    lng: 74.808,
    pincode: "190011",
    aliases: ["soura", "skims", "skims soura", "sowra", "90 feet soura", "90 feet", "90ft", "90ft road", "soura srinagar"],
  },
  {
    name: "Bachpora",
    lat: 34.152,
    lng: 74.805,
    pincode: "190020",
    aliases: ["bachpora", "buchpora", "batpora", "bhatpora", "bach pora", "buch pora", "bachpora srinagar", "buchpora srinagar"],
  },
  {
    name: "Lal Bazar",
    lat: 34.116,
    lng: 74.818,
    pincode: "190011",
    aliases: ["lal bazar", "lalbazar", "lal bazaar", "lalbazaar", "molvi stop", "bota kadal", "lal bazar srinagar"],
  },
  {
    name: "Umar Colony",
    lat: 34.136,
    lng: 74.821,
    pincode: "190011",
    aliases: ["umar colony", "umer colony", "umar colony a", "umar colony b", "umer colony a", "umer colony b"],
  },
  {
    name: "Gulab Bagh",
    lat: 34.161,
    lng: 74.832,
    pincode: "190006",
    aliases: ["gulab bagh", "gulabbagh", "gulab bagh srinagar"],
  },
  {
    name: "Nowshera",
    lat: 34.122,
    lng: 74.812,
    pincode: "190011",
    aliases: ["nowshera", "nowshehra", "nowshera srinagar"],
  },
  {
    name: "Hawal",
    lat: 34.11,
    lng: 74.813,
    pincode: "190002",
    aliases: ["hawal", "hawal chowk", "hawal srinagar"],
  },
  {
    name: "Alamgiri Bazar",
    lat: 34.108,
    lng: 74.817,
    pincode: "190002",
    aliases: ["alamgiri bazar", "alamgiri bazaar", "alamgiribazar"],
  },
  {
    name: "Khanyar",
    lat: 34.095,
    lng: 74.82,
    pincode: "190003",
    aliases: ["khanyar", "dastgeer sahib", "khanyar srinagar"],
  },
  {
    name: "Rainawari",
    lat: 34.095,
    lng: 74.831,
    pincode: "190003",
    aliases: ["rainawari", "raina wari", "rainawari srinagar", "jlnm hospital"],
  },
  {
    name: "Dalgate",
    lat: 34.078,
    lng: 74.834,
    pincode: "190001",
    aliases: ["dalgate", "dal gate", "boulevard", "boulevard road", "dalgate srinagar", "nehru park"],
  },
  {
    name: "Rajbagh",
    lat: 34.062,
    lng: 74.825,
    pincode: "190008",
    aliases: ["rajbagh", "raj bagh", "rajbagh srinagar", "zero bridge", "kursoo rajbagh", "rajbagh extension"],
  },
  {
    name: "Lal Chowk",
    lat: 34.071,
    lng: 74.811,
    pincode: "190001",
    aliases: ["lal chowk", "lalchowk", "clock tower", "ghanta ghar", "residency road", "maisuma", "regal chowk", "lal chowk srinagar"],
  },
  {
    name: "Sanat Nagar",
    lat: 34.032,
    lng: 74.801,
    pincode: "190005",
    aliases: ["sanat nagar", "sanatnagar", "sanat nagar srinagar"],
  },
  {
    name: "Hyderpora",
    lat: 34.037,
    lng: 74.789,
    pincode: "190014",
    aliases: ["hyderpora", "hyder pora", "hyderpora flyover", "hyderpora chowk", "hyderpora srinagar"],
  },
  {
    name: "Bemina",
    lat: 34.088,
    lng: 74.779,
    pincode: "190018",
    aliases: ["bemina", "sd colony", "hamdania colony", "bemina byepass", "bemina chowk", "bemina srinagar"],
  },
  {
    name: "Batamaloo",
    lat: 34.074,
    lng: 74.792,
    pincode: "190009",
    aliases: ["batamaloo", "batamalo", "batmaloo", "batamaloo srinagar"],
  },
  {
    name: "Jawahar Nagar",
    lat: 34.058,
    lng: 74.818,
    pincode: "190008",
    aliases: ["jawahar nagar", "jawaharnagar", "jawahar nagar srinagar"],
  },
  {
    name: "Chanapora",
    lat: 34.035,
    lng: 74.808,
    pincode: "190015",
    aliases: ["chanapora", "channapora", "chanapora srinagar", "chanapora bypass"],
  },
  {
    name: "Nishat",
    lat: 34.12,
    lng: 74.88,
    pincode: "190019",
    aliases: ["nishat", "nishat garden", "brein", "brein nishat", "nishat srinagar"],
  },
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

function findMatchingLandmark(localityInput: string): SrinagarLandmark | null {
  if (!localityInput || !localityInput.trim()) return null;

  const raw = localityInput.toLowerCase().trim();
  const normalized = raw.replace(/[^a-z0-9]/g, "");
  if (!normalized) return null;

  // 1. Exact match with primary name or any alias
  for (const lm of SRINAGAR_LANDMARKS) {
    const normPrimary = lm.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalized === normPrimary) return lm;
    if (lm.aliases) {
      for (const alias of lm.aliases) {
        const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normalized === normAlias) return lm;
      }
    }
  }

  // 2. Contains match: if user's input contains landmark name or alias (e.g. "Ellahi Bagh near masjid")
  const sortedLandmarks = [...SRINAGAR_LANDMARKS].sort((a, b) => b.name.length - a.name.length);
  for (const lm of sortedLandmarks) {
    const normPrimary = lm.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normPrimary.length >= 4 && normalized.includes(normPrimary)) return lm;
    if (lm.aliases) {
      const sortedAliases = [...lm.aliases].sort((a, b) => b.length - a.length);
      for (const alias of sortedAliases) {
        const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normAlias.length >= 4 && normalized.includes(normAlias)) return lm;
      }
    }
  }

  // 3. Reverse contains: if landmark name or alias contains input (min length 4)
  if (normalized.length >= 4) {
    for (const lm of SRINAGAR_LANDMARKS) {
      const normPrimary = lm.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normPrimary.includes(normalized)) return lm;
      if (lm.aliases) {
        for (const alias of lm.aliases) {
          const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (normAlias.includes(normalized)) return lm;
        }
      }
    }
  }

  return null;
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
  if (!/^[a-zA-Z\u0600-\u06FF\s'.\-]+$/.test(v.trim())) return "Name should only contain letters.";
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
  const { user, savedProfile, saveCustomerProfile } = useCustomerAuth();
  const router = useRouter();

  const totalTroutKg = useMemo(() => {
    return items
      .filter((i) => i.id === "gutted-trout" || i.id === "whole-trout" || i.unit?.toLowerCase().includes("kg"))
      .reduce((sum, i) => sum + i.quantity, 0);
  }, [items]);

  const checkoutNutrition = useMemo(() => {
    return calculateTroutNutrition(totalTroutKg, true);
  }, [totalTroutKg]);

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
  const [farmLat, setFarmLat] = useState<number>(34.1445563);
  const [farmLng, setFarmLng] = useState<number>(74.8245018);
  const [allowOutsideRadius, setAllowOutsideRadius] = useState<boolean>(false);

  // ─── Payment & Settings State ───
  const [upiId, setUpiId] = useState("JKBMERC00828895@jkb");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [razorpayError, setRazorpayError] = useState("");
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [rememberDetails, setRememberDetails] = useState(true);
  const [showPrefillBanner, setShowPrefillBanner] = useState(false);
  const [storeStatus, setStoreStatus] = useState(() => getBusinessHoursInfo());
  const [scheduleInfo, setScheduleInfo] = useState<DeliveryScheduleInfo>(() => getDeliveryScheduleInfo());
  const [selectedScheduledDate, setSelectedScheduledDate] = useState<string>(() => getDeliveryScheduleInfo().defaultDate);
  const [selectedScheduledSlot, setSelectedScheduledSlot] = useState<string>(() => getDeliveryScheduleInfo().defaultSlot);

  useEffect(() => {
    fetch("/api/store-status")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.isOpen === "boolean") {
          setStoreStatus({
            isOpen: data.isOpen,
            isFridayMaintenance: Boolean(data.isFridayMaintenance),
            isFarmMaintenance: Boolean(data.farmMaintenanceActive),
            allowFridayOrders: Boolean(data.allowFridayOrders),
            closedReason: data.closedReason,
            nextOpenLabel: data.nextOpenLabel || "",
            nextOpenISO: data.nextOpenISO || "",
            currentISTHour: 0,
            currentISTMinute: 0,
            currentISTDay: 0,
          });
          if (data.scheduleInfo) {
            setScheduleInfo(data.scheduleInfo);
            if (data.scheduleInfo.defaultDate) {
              setSelectedScheduledDate(data.scheduleInfo.defaultDate);
            }
            if (data.scheduleInfo.defaultSlot) {
              setSelectedScheduledSlot(data.scheduleInfo.defaultSlot);
            }
          }
        }
      })
      .catch(() => {});
  }, []);

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

  // ─── Auto-Pre-fill Saved Address or Logged-in Profile ───
  useEffect(() => {
    if (savedProfile) {
      setFormData((prev) => {
        const isBlank = !prev.phone && !prev.house;
        if (!isBlank) return prev;
        if (savedProfile.house || savedProfile.phone || savedProfile.fullName) {
          setShowPrefillBanner(true);
        }
        return {
          fullName: savedProfile.fullName || prev.fullName,
          phone: savedProfile.phone || prev.phone,
          email: savedProfile.email || user?.email || prev.email,
          locality: savedProfile.locality || prev.locality,
          house: savedProfile.house || prev.house,
          pincode: savedProfile.pincode || prev.pincode,
          notes: savedProfile.notes || prev.notes,
        };
      });
    } else if (user) {
      const meta = user.user_metadata || {};
      setFormData((prev) => {
        if (prev.fullName || prev.email) return prev;
        return {
          ...prev,
          fullName: meta.full_name || meta.name || user.email?.split("@")[0] || "",
          email: user.email || "",
          phone: meta.phone || prev.phone,
        };
      });
    }
  }, [savedProfile, user]);

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

      const navUrl = detectedCoords
        ? `https://www.google.com/maps/dir/?api=1&destination=${detectedCoords.lat},${detectedCoords.lng}`
        : null;

      const gpsNote = detectedCoords
        ? ` | 📍 GPS: ${navUrl} (~${(calculatedDistance || 0).toFixed(1)} km from Urban Trout Aquaculture Farm, Malabagh)`
        : "";

      try {
        const payload = {
          customer_name: currentData.fullName?.trim() || "Interested Customer",
          customer_phone: cleanPhone,
          customer_email: currentData.email?.trim() || null,
          customer_locality: currentData.locality?.trim() || selectedZoneName || null,
          customer_address: `${currentData.house?.trim() || ""}${gpsNote}`.trim() || null,
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
          notes: `Abandoned checkout step ${currentStep} (₹${currentTotal})${gpsNote}`,
          latitude: detectedCoords ? String(detectedCoords.lat) : null,
          longitude: detectedCoords ? String(detectedCoords.lng) : null,
          distance_km: calculatedDistance ? calculatedDistance.toFixed(1) : null,
          google_maps_url: navUrl,
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
            notes: `Abandoned checkout step ${currentStep} (₹${currentTotal})${gpsNote}`,
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
                googleMapsUrl: navUrl,
                latitude: detectedCoords?.lat,
                longitude: detectedCoords?.lng,
                distanceKm: calculatedDistance || undefined,
              },
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Lead capture notice:", err);
      }
    },
    [currentStep, selectedZoneName, detectedCoords, calculatedDistance]
  );

  const handleInputChange = (field: string, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);

    // If customer changes the locality text, reset previous coordinates so the new locality recalculates cleanly
    if (field === "locality") {
      setDetectedCoords(null);
      setDeliveryMode(null);
      setSelectedZoneName("");
      setCalculatedDistance(null);
      setLocationMsg("");
      setLocatingStep("idle");
    }

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
        setLocationMsg("Calculating direct distance to Urban Trout Aquaculture Farm (Malabagh, Srinagar)…");

        const { latitude, longitude } = pos.coords;
        const dist = calculateDistance(farmLat, farmLng, latitude, longitude);
        setDetectedCoords({ lat: latitude, lng: longitude });
        setCalculatedDistance(dist);

        // Reverse-geocode to get actual human-readable Srinagar neighborhood
        const geo = await reverseGeocodeCoords(latitude, longitude);
        setSelectedZoneName(geo.locality);
        const updatedForm = {
          ...formData,
          locality: formData.locality || geo.locality,
          pincode: formData.pincode || geo.pincode,
        };
        setFormData(updatedForm);

        if (dist <= deliveryRadiusKm) {
          setDeliveryMode("under5");
          setLocatingStep("locked");
          setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub, Malabagh • Free Express Delivery within 2 Hours ✓`);
        } else {
          setDeliveryMode("unavailable");
          setLocatingStep("locked");
          setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub • Outside our ${deliveryRadiusKm}km live harvest delivery perimeter.`);
        }

        // Immediately sync lead with exact coordinates if phone is already known
        if (updatedForm.phone && updatedForm.phone.replace(/\D/g, "").length >= 8) {
          captureLead(updatedForm, grandTotal, items);
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

  // ─── Return to Step 1 & Reset Stale Location Calculations ─────
  const handleBackToAddressEdit = () => {
    setDeliveryMode(null);
    setDetectedCoords(null);
    setSelectedZoneName("");
    setCalculatedDistance(null);
    setLocationMsg("");
    setLocatingStep("idle");
    setPermissionErrorHelp("");
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── STEP 1 -> STEP 2 Transition (Customer Details -> Location Check) ───
  const handleProceedToLocation = (e: React.FormEvent) => {
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

    if (Object.values(newErrors).some((err) => err !== "")) {
      return;
    }

    // Capture lead immediately upon proceeding
    captureLead(formData, grandTotal, items);

    // Match customer-entered locality against Srinagar landmarks and calculate distance
    if (formData.locality) {
      const matched = findMatchingLandmark(formData.locality);
      if (matched) {
        setSelectedZoneName(matched.name);
        setDetectedCoords({ lat: matched.lat, lng: matched.lng });
        const dist = calculateDistance(farmLat, farmLng, matched.lat, matched.lng);
        setCalculatedDistance(dist);
        setLocatingStep("locked");
        if (dist <= deliveryRadiusKm) {
          setDeliveryMode("under5");
          setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub, Malabagh • Free Express Delivery within 2 Hours ✓`);
        } else {
          setDeliveryMode("unavailable");
          setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub • Outside our ${deliveryRadiusKm}km live harvest delivery perimeter.`);
        }
      } else if (detectedCoords) {
        // Fallback: If customer had previous device GPS coordinates locked
        const dist = calculateDistance(farmLat, farmLng, detectedCoords.lat, detectedCoords.lng);
        setCalculatedDistance(dist);
        setLocatingStep("locked");
        if (dist <= deliveryRadiusKm) {
          setDeliveryMode("under5");
          setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub, Malabagh • Free Express Delivery within 2 Hours ✓`);
        } else {
          setDeliveryMode("unavailable");
          setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub • Outside our ${deliveryRadiusKm}km live harvest delivery perimeter.`);
        }
      } else {
        // Locality not recognized in landmark list and no device GPS locked yet
        setDeliveryMode(null);
        setLocatingStep("idle");
      }
    }

    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Quick Landmark Select Helper for Step 2 ────────────────────
  const handleSelectLandmarkBeat = (landmark: SrinagarLandmark) => {
    setSelectedZoneName(landmark.name);
    setDetectedCoords({ lat: landmark.lat, lng: landmark.lng });
    const dist = calculateDistance(farmLat, farmLng, landmark.lat, landmark.lng);
    setCalculatedDistance(dist);
    setLocatingStep("locked");

    const updatedForm = {
      ...formData,
      locality: landmark.name,
      pincode: formData.pincode || landmark.pincode,
    };
    setFormData(updatedForm);

    if (dist <= deliveryRadiusKm) {
      setDeliveryMode("under5");
      setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub, Malabagh • Free Express Delivery within 2 Hours ✓`);
    } else {
      setDeliveryMode("unavailable");
      setLocationMsg(`${dist.toFixed(1)} km from Urban Trout Hub • Outside our ${deliveryRadiusKm}km live harvest delivery perimeter.`);
    }

    if (updatedForm.phone && updatedForm.phone.replace(/\D/g, "").length >= 8) {
      captureLead(updatedForm, grandTotal, items);
    }
  };

  // ─── STEP 2 -> STEP 3 Transition (Location Check -> Payment) ──
  const handleConfirmLocationProceed = () => {
    if (!deliveryMode || !detectedCoords) {
      alert("Please auto-detect your delivery location using device GPS or select your Srinagar delivery area first.");
      return;
    }
    if (deliveryMode === "unavailable" && !allowOutsideRadius) {
      alert(`We currently deliver fresh catch only within ${deliveryRadiusKm}km of Urban Trout Farm, Srinagar.`);
      return;
    }
    captureLead(formData, grandTotal, items);
    // ─── FB Pixel: User reached payment step ─────────────────────
    fbInitiateCheckout({ value: grandTotal, numItems: items.reduce((s, i) => s + i.quantity, 0) });
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  // ─── STEP 3: Razorpay Standard Checkout ──────────────────────
  const handleRazorpayPayment = async () => {
    setRazorpayError("");

    const isScheduledOrder = !storeStatus.isOpen;
    if (isScheduledOrder && !selectedScheduledSlot) {
      setRazorpayError("Please select a delivery time slot for your scheduled order.");
      return;
    }

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
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
          deliveryMode,
          deliveryFee,
          currency: "INR",
          receipt: `ut_${Date.now()}`,
          customerName: formData.fullName,
          customerPhone: formData.phone,
          customerEmail: formData.email,
          isScheduled: isScheduledOrder,
          scheduledDate: isScheduledOrder ? selectedScheduledDate : undefined,
          scheduledSlot: isScheduledOrder ? selectedScheduledSlot : undefined,
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
          description: isScheduledOrder
            ? `Fresh Trout Scheduled (${selectedScheduledSlot})`
            : `Fresh Trout Order — ${items.length} item${items.length > 1 ? "s" : ""}`,
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
            is_scheduled: isScheduledOrder ? "true" : "false",
            scheduled_date: isScheduledOrder ? selectedScheduledDate : "",
            scheduled_slot: isScheduledOrder ? selectedScheduledSlot : "",
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
              const scheduleNote = isScheduledOrder
                ? ` | 📅 SCHEDULED: ${selectedScheduledDate} (${selectedScheduledSlot})`
                : "";
              const mapsUrl = detectedCoords
                ? `https://www.google.com/maps/dir/?api=1&destination=${detectedCoords.lat},${detectedCoords.lng}`
                : "";
              const gpsNote = detectedCoords
                ? ` | 📍 Exact GPS: ${mapsUrl} (~${(calculatedDistance || 0).toFixed(1)} km from Urban Trout Aquaculture Farm, Malabagh)`
                : "";

              const orderPayload = {
                customer_name: formData.fullName.trim(),
                customer_phone: cleanPhone,
                customer_address: `${formData.house.trim()}, ${formData.locality.trim()}${scheduleNote}${emailNote}${rzpNote}${notesNote}${gpsNote}`,
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
                user_id: user?.id || null,
                customer_email: formData.email?.trim() || user?.email || "",
                is_scheduled: isScheduledOrder,
                scheduled_date: isScheduledOrder ? selectedScheduledDate : undefined,
                scheduled_slot: isScheduledOrder ? selectedScheduledSlot : undefined,
              };

              const placeRes = await fetch("/api/orders/place", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: rzpRes.razorpay_order_id,
                  razorpay_payment_id: rzpRes.razorpay_payment_id,
                  razorpay_signature: rzpRes.razorpay_signature,
                  orderData: orderPayload,
                }),
              });

              let insertedOrder: any = null;
              if (placeRes.ok) {
                const placeData = await placeRes.json();
                insertedOrder = placeData.order;
              } else {
                const errData = await placeRes.json().catch(() => ({}));
                console.error("Order placement API error:", errData);
              }

              // Save to customer profile / localStorage for instant 1-tap reordering
              if (rememberDetails) {
                saveCustomerProfile({
                  fullName: formData.fullName.trim(),
                  phone: cleanPhone,
                  email: formData.email?.trim() || user?.email || "",
                  locality: formData.locality.trim(),
                  house: formData.house.trim(),
                  pincode: formData.pincode.trim(),
                  notes: formData.notes?.trim() || "",
                });
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

              // Telegram & Email notification fallback (only if server-side orders/place did not handle it)
              if (!insertedOrder) {
                fetch("/api/telegram-notify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "new_order",
                    data: {
                      orderNumber: "UT-" + Math.floor(1000 + Math.random() * 9000),
                      customerName: formData.fullName,
                      phone: cleanPhone,
                      email: formData.email?.trim() || undefined,
                      locality: formData.locality,
                      address: `${formData.house.trim()}, ${formData.locality.trim()}${notesNote}${gpsNote}`,
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
              }

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
                isScheduled: !storeStatus.isOpen,
                scheduledDate: selectedScheduledDate,
                scheduledSlot: selectedScheduledSlot,
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

              // ─── FB Pixel: Confirmed Purchase ─────────────────────────
              fbPurchase({
                value: grandTotal,
                contentName: items.map((i) => i.name).join(", "),
                contentIds: items.map((i) => String(i.id)),
                numItems: items.reduce((s, i) => s + i.quantity, 0),
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

    const successTroutKg = (orderSuccess.items || [])
      .filter((i: any) => i.id === "gutted-trout" || i.id === "whole-trout" || (i.unit && i.unit.toLowerCase().includes("kg")))
      .reduce((sum: number, i: any) => sum + (Number(i.quantity) || 0), 0);
    const successNutrition = calculateTroutNutrition(successTroutKg, true);

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
              {orderSuccess.isScheduled ? "Scheduled Pre-Order Confirmed • Paid" : "Payment Verified • Order Confirmed"}
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
              Your order <strong className="text-cyan-300">#{orderSuccess.orderNumber}</strong> has been confirmed and paid.{" "}
              {orderSuccess.isScheduled ? (
                <>
                  It is scheduled for live harvest and delivery on{" "}
                  <strong className="text-white">{orderSuccess.scheduledDate}</strong> during the{" "}
                  <strong className="text-emerald-400">{orderSuccess.scheduledSlot}</strong> slot.
                </>
              ) : (
                <>
                  Our aquaculture specialists at Urban Trout Aquaculture Farm in Malabagh are preparing your live harvest for express delivery within 2 hours.
                </>
              )}
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
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {orderSuccess.isScheduled ? "Delivery Slot" : "Delivery Window"}
                </span>
                <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-1 truncate" title={orderSuccess.scheduledSlot || "Within 90 Mins"}>
                  {orderSuccess.isScheduled ? orderSuccess.scheduledSlot : "Within 90 Mins"}
                </div>
                <span className="text-[10px] text-cyan-400 block truncate">
                  {orderSuccess.isScheduled ? `📅 ${orderSuccess.scheduledDate}` : "Same-Day Express"}
                </span>
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
                {orderSuccess.isScheduled ? "Scheduled Harvest & Delivery Schedule" : "Live Harvest & Delivery Progress"}
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
                  <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    {orderSuccess.isScheduled ? "2. Harvest Slot" : "2. Harvesting"}
                  </span>
                </div>
                <p className="text-xs text-white font-semibold">
                  {orderSuccess.isScheduled ? "Fresh Live Catch" : "Fresh RAS Catch"}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {orderSuccess.isScheduled
                    ? `Harvested fresh before your ${orderSuccess.scheduledSlot} slot.`
                    : "Harvested to order from clean spring tanks."}
                </p>
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
                <p className="text-xs text-slate-400 font-semibold">
                  {orderSuccess.isScheduled ? "Slot Delivery" : "Express Rider"}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {orderSuccess.isScheduled
                    ? `Delivered within your chosen slot: ${orderSuccess.scheduledSlot}.`
                    : "Delivered fresh within 90 minutes."}
                </p>
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

              {successTroutKg > 0 && (
                <div
                  className="p-3.5 rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(8,27,38,0.9) 0%, rgba(13,38,52,0.8) 100%)",
                    border: "1px solid rgba(114,221,253,0.25)",
                  }}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300 font-['Space_Grotesk'] uppercase tracking-wider mb-1.5">
                    <span className="flex items-center gap-1.5"><span>🧬</span> {successTroutKg} Kg Catch Nutrition Yield</span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">Fact-Checked</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    Delivers <strong>~{successNutrition.proteinGrams}g lean protein</strong> (≈ {successNutrition.eggWhiteEquivalent} egg whites), <strong>~{(successNutrition.omega3Mg / 1000).toFixed(1)}g natural Omega-3s</strong>, and <strong>~{successNutrition.vitaminDIU.toLocaleString("en-IN")} IU Vitamin D3</strong> with 0g carbs.
                  </p>
                </div>
              )}

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
                    {orderSuccess.calculatedDistance ? ` • ~${orderSuccess.calculatedDistance.toFixed(1)} km from Urban Trout Aquaculture Farm, Malabagh` : ""}
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
                <p>Urban Trout Aquaculture Farm, Malabagh, Srinagar — 190006</p>
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

        {/* ─── Scheduled Order Mode Banner (Visible when store operations are paused) ─── */}
        {!storeStatus.isOpen && (
          <div className="max-w-3xl mx-auto mb-8">
            <div
              className="p-5 sm:p-6 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-start sm:items-center gap-4 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(14,165,233,0.14) 0%, rgba(16,185,129,0.08) 50%, rgba(16,33,44,0.95) 100%)",
                border: "1px solid rgba(56,189,248,0.35)",
                boxShadow: "0 8px 30px rgba(14,165,233,0.12)",
              }}
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "linear-gradient(135deg, rgba(14,165,233,0.25), rgba(16,185,129,0.2))",
                  border: "1px solid rgba(56,189,248,0.4)",
                  color: "#38bdf8",
                }}
              >
                <span className="text-2xl">📅</span>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs uppercase font-extrabold tracking-wider text-cyan-400">
                    Schedule Order Active
                  </span>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-mono">
                    {scheduleInfo.badgeLabel}
                  </span>
                </div>
                <h4
                  className="font-bold text-base sm:text-lg text-white mb-1"
                  style={{ fontFamily: '"Space Grotesk", sans-serif' }}
                >
                  {scheduleInfo.headline}
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {scheduleInfo.message} Choose your preferred delivery date and time slot in Step 1 to guarantee your fresh morning harvest.
                </p>
              </div>
            </div>
          </div>
        )}

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

            {/* Step 1 Node: Fill Details */}
            <button
              type="button"
              onClick={handleBackToAddressEdit}
              className="relative z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all cursor-pointer"
              style={{
                background: currentStep === 1 ? "#10212c" : "rgba(16,33,44,0.95)",
                border:
                  currentStep === 1
                    ? "1.5px solid #72ddfd"
                    : formData.phone.replace(/\D/g, "").length === 10
                    ? "1.5px solid rgba(37,211,102,0.7)"
                    : "1px solid rgba(61,74,83,0.6)",
                boxShadow: currentStep === 1 ? "0 0 20px rgba(114,221,253,0.3)" : "none",
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                style={{
                  background:
                    currentStep > 1 && formData.phone.replace(/\D/g, "").length === 10
                      ? "#25D366"
                      : currentStep === 1
                      ? "#72ddfd"
                      : "rgba(61,74,83,0.8)",
                  color: "#002730",
                }}
              >
                {currentStep > 1 && formData.phone.replace(/\D/g, "").length === 10 ? "✓" : "1"}
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
                  Fill Details
                </span>
                <span
                  className="hidden sm:block"
                  style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.onSurfVar }}
                >
                  Address &amp; Contact
                </span>
              </div>
            </button>

            {/* Step 2 Node: Location Check */}
            <button
              type="button"
              onClick={() => {
                if (formData.phone.replace(/\D/g, "").length === 10) setCurrentStep(2);
              }}
              disabled={formData.phone.replace(/\D/g, "").length !== 10}
              className="relative z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all"
              style={{
                background: currentStep === 2 ? "#10212c" : "rgba(16,33,44,0.95)",
                border:
                  currentStep === 2
                    ? "1.5px solid #72ddfd"
                    : currentStep === 3 && deliveryMode === "under5"
                    ? "1.5px solid rgba(37,211,102,0.7)"
                    : "1px solid rgba(61,74,83,0.6)",
                boxShadow: currentStep === 2 ? "0 0 20px rgba(114,221,253,0.3)" : "none",
                opacity: formData.phone.replace(/\D/g, "").length === 10 ? 1 : 0.6,
                cursor: formData.phone.replace(/\D/g, "").length === 10 ? "pointer" : "not-allowed",
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                style={{
                  background:
                    currentStep === 3 && deliveryMode === "under5"
                      ? "#25D366"
                      : currentStep === 2
                      ? "#72ddfd"
                      : "rgba(61,74,83,0.8)",
                  color: currentStep >= 2 ? "#002730" : C.onSurfVar,
                }}
              >
                {currentStep === 3 && deliveryMode === "under5" ? "✓" : "2"}
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
                  Location Check
                </span>
                <span
                  className="hidden sm:block"
                  style={{ fontFamily: '"Inter", sans-serif', fontSize: "9px", color: C.onSurfVar }}
                >
                  5km Zone &amp; GPS
                </span>
              </div>
            </button>

            {/* Step 3 Node: Payment */}
            <button
              type="button"
              onClick={() => {
                if (deliveryMode === "under5" && formData.fullName && formData.phone && formData.house) {
                  setCurrentStep(3);
                }
              }}
              disabled={currentStep < 2 || deliveryMode !== "under5" || !formData.phone}
              className="relative z-10 flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all"
              style={{
                background: currentStep === 3 ? "#10212c" : "rgba(16,33,44,0.95)",
                border: currentStep === 3 ? "1.5px solid #72ddfd" : "1px solid rgba(61,74,83,0.6)",
                boxShadow: currentStep === 3 ? "0 0 20px rgba(114,221,253,0.3)" : "none",
                opacity: (currentStep === 3 || (deliveryMode === "under5" && formData.phone)) ? 1 : 0.6,
                cursor: (currentStep === 3 || (deliveryMode === "under5" && formData.phone)) ? "pointer" : "not-allowed",
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
                  Razorpay (Instant UPI)
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
                STAGE 1: FILL CUSTOMER & DELIVERY DETAILS
                ══════════════════════════════════════════════════════ */}
            {currentStep === 1 && (
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
                    <Link
                      href="/shop"
                      className="flex items-center justify-center w-10 h-10 rounded-xl transition-all flex-shrink-0 cursor-pointer"
                      style={{
                        background: "rgba(3,16,24,0.7)",
                        border: "1px solid rgba(61,74,83,0.6)",
                        color: C.onSurfVar,
                      }}
                      title="Back to Shop"
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
                          Stage 1 of 3
                        </span>
                        <span style={{ color: C.outline }}>•</span>
                        <span style={{ fontFamily: '"Manrope", sans-serif', fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
                          Contact &amp; Address
                        </span>
                      </div>
                      <h1
                        style={{
                          fontFamily: '"Space Grotesk", sans-serif',
                          fontSize: "1.55rem",
                          fontWeight: 800,
                          color: C.onSurface,
                          letterSpacing: "-0.03em",
                          margin: "2px 0 0",
                        }}
                      >
                        Customer &amp; Delivery Details
                      </h1>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-[11px] text-cyan-300 font-mono">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    Express Harvest to Doorstep
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleProceedToLocation} noValidate className="space-y-6">
                  {/* Account Status / Guest Sign-In Notice */}
                  {user ? (
                    <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        <span className="text-slate-200">
                          Ordering as <strong>{user.user_metadata?.full_name || user.email}</strong>
                        </span>
                      </div>
                      <Link href="/account" className="text-cyan-400 hover:text-cyan-300 font-semibold underline text-[11px]">
                        My Account
                      </Link>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                      <span>Have an Urban Trout account?</span>
                      <Link
                        href="/account"
                        className="text-cyan-400 hover:text-cyan-300 font-bold tracking-wide uppercase text-[11px]"
                      >
                        Sign In for 1-Tap Checkout →
                      </Link>
                    </div>
                  )}

                  {/* Saved Address Prefill Notice */}
                  {showPrefillBanner && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                      <div className="flex items-center gap-2">
                        <span>✨</span>
                        <span>Saved delivery details loaded for this device.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPrefillBanner(false)}
                        className="text-emerald-400 hover:text-emerald-200 text-[11px] underline cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Scheduled Delivery Date & Slot Selector (Active when store operations are paused) */}
                  {!storeStatus.isOpen && (
                    <div
                      className="p-5 rounded-2xl space-y-4"
                      style={{
                        background: "linear-gradient(135deg, rgba(8,27,38,0.95) 0%, rgba(14,40,55,0.85) 100%)",
                        border: "1px solid rgba(56,189,248,0.35)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">📅</span>
                          <h3
                            style={{
                              fontFamily: '"Space Grotesk", sans-serif',
                              fontWeight: 700,
                              fontSize: "1rem",
                              color: "#f8fafc",
                              margin: 0,
                            }}
                          >
                            Preferred Delivery Schedule
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 self-start sm:self-auto">
                          Fresh Morning Harvest
                        </span>
                      </div>

                      <p className="text-xs text-slate-300">
                        Since farm operations are currently paused, our aquaculture team will harvest your trout fresh on your selected delivery day.
                      </p>

                      {/* 1. Date Selection */}
                      <div>
                        <label
                          className="block text-[11px] uppercase tracking-wider font-semibold text-slate-300 mb-2"
                          style={{ fontFamily: '"Inter", sans-serif' }}
                        >
                          1. Select Delivery Date <span className="text-rose-400">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {scheduleInfo.availableDates.map((d) => {
                            const isSelected = selectedScheduledDate === d.formattedLabel;
                            return (
                              <button
                                key={d.dateIso}
                                type="button"
                                onClick={() => setSelectedScheduledDate(d.formattedLabel)}
                                className={`text-left p-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? "bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.25)] text-white"
                                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700"
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                                    <span>{d.dayName}</span>
                                    <span className="text-xs font-normal text-slate-400">({d.dateLabel})</span>
                                  </div>
                                  <span className="text-[11px] text-cyan-400 font-mono mt-0.5 block">
                                    {d.formattedLabel.startsWith("Tomorrow") ? "⚡ Earliest Available Harvest" : "Next Operating Day"}
                                  </span>
                                </div>
                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold ${
                                    isSelected
                                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                                      : "border-slate-700 text-transparent"
                                  }`}
                                >
                                  ✓
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Slot Selection */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label
                            className="text-[11px] uppercase tracking-wider font-semibold text-slate-300"
                            style={{ fontFamily: '"Inter", sans-serif' }}
                          >
                            2. Select Preferred Time Slot <span className="text-rose-400">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400">2-hour arrival window</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {scheduleInfo.availableSlots.map((slot) => {
                            const isSelected = selectedScheduledSlot === slot;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setSelectedScheduledSlot(slot)}
                                className={`px-2.5 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-emerald-950/70 border-emerald-400 text-emerald-300 font-bold shadow-[0_0_12px_rgba(52,211,153,0.25)]"
                                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 font-medium"
                                }`}
                              >
                                <div className="text-[11px] sm:text-xs font-mono">{slot}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <span>
                          Selected: <strong className="text-white">{selectedScheduledDate}</strong> between{" "}
                          <strong className="text-emerald-400">{selectedScheduledSlot}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Card 1: Contact Info */}
                  <div
                    className="p-5 rounded-xl space-y-4"
                    style={{ background: "rgba(3,16,24,0.6)", border: "1px solid rgba(61,74,83,0.5)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ color: C.primary, fontSize: "16px" }}>👤</span>
                        <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface, margin: 0 }}>
                          1. Contact Information
                        </h3>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-mono">Instant WhatsApp Updates</span>
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
                        helperText="We send live harvest video & order status here"
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span style={{ color: C.primary, fontSize: "16px" }}>🏠</span>
                        <h3 style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 700, fontSize: "0.95rem", color: C.onSurface, margin: 0 }}>
                          2. Srinagar Delivery Address
                        </h3>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold">5km Free Delivery Radius</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Field
                          label="Locality / Landmark in Srinagar"
                          name="locality"
                          value={formData.locality}
                          placeholder="e.g. Near Hazratbal Dargah, Naseem Bagh, Lal Bazar, Malabagh"
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

                  {/* Remember Details Checkbox */}
                  <div className="px-1">
                    <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberDetails}
                        onChange={(e) => setRememberDetails(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 text-cyan-400 focus:ring-cyan-500 bg-slate-900 cursor-pointer accent-cyan-500"
                      />
                      <span>Remember my address &amp; contact details on this device for fast 1-tap reordering</span>
                    </label>
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
                    <Link
                      href="/shop"
                      className="px-6 py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all order-2 sm:order-1 text-center flex items-center justify-center cursor-pointer"
                      style={{
                        background: "rgba(3,16,24,0.8)",
                        border: "1px solid rgba(61,74,83,0.6)",
                        color: C.onSurfVar,
                        fontFamily: '"Space Grotesk", sans-serif',
                      }}
                    >
                      ← Back to Shop
                    </Link>
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all rounded-xl py-4 order-1 sm:order-2 cursor-pointer shadow-lg active:scale-98"
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontSize: "0.95rem",
                        background: C.primaryCont,
                        color: C.onPrimCont,
                        boxShadow: "0 0 30px rgba(58,173,204,0.35)",
                        border: "none",
                      }}
                    >
                      Continue to Step 2: Confirm Location &amp; Distance
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-[11px] text-center text-slate-400 font-mono">
                    🔒 Instant lead recovery • 100% Free Doorstep Delivery inside 5km • Live Catch Harvested to Order • Instant UPI &amp; Cards
                  </p>
                </form>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                STAGE 2: CONFIRM DELIVERY LOCATION & 5KM RADIUS
                ══════════════════════════════════════════════════════ */}
            {currentStep === 2 && (
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
                    <button
                      type="button"
                      onClick={handleBackToAddressEdit}
                      className="flex items-center justify-center w-10 h-10 rounded-xl transition-all flex-shrink-0 cursor-pointer"
                      style={{
                        background: "rgba(3,16,24,0.7)",
                        border: "1px solid rgba(61,74,83,0.6)",
                        color: C.onSurfVar,
                      }}
                      title="Back to Customer Details"
                    >
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
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
                          Step 2 of 3
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

                  <button
                    type="button"
                    onClick={handleBackToAddressEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-[11px] text-cyan-300 hover:text-white cursor-pointer transition-colors"
                  >
                    <span>✏️</span>
                    <span>Edit Customer Details</span>
                  </button>
                </div>

                {/* ─── CONFIRMED CUSTOMER DETAILS SUMMARY PILL ─── */}
                <div
                  className="p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{ background: "rgba(114,221,253,0.06)", border: "1px solid rgba(114,221,253,0.22)" }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">👤</span>
                      <strong className="text-white text-sm" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        {formData.fullName || "Customer"}
                      </strong>
                      <span className="text-xs text-cyan-300 font-mono">
                        +91 {formData.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="text-slate-400">📍</span>
                      <span>
                        {formData.house}, {formData.locality}
                        {formData.pincode ? ` (${formData.pincode})` : ""}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToAddressEdit}
                    className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/60 border border-cyan-800 transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0"
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit Address
                  </button>
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
                        Delivery Radius &amp; GPS Verification
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/30">
                        Live Farm-to-Doorstep
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                      We use your location <strong>solely to calculate delivery distance</strong> from Urban Trout Aquaculture Farm in Malabagh and guide our express delivery driver directly to your doorstep.
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
                        className="absolute inset-0 rounded-full blur-xl transition-all duration-700"
                        style={{
                          background:
                            locatingStep === "denied"
                              ? "rgba(245, 158, 11, 0.25)"
                              : locatingStep === "error"
                              ? "rgba(239, 68, 68, 0.25)"
                              : "rgba(114, 221, 253, 0.2)",
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
                    <div className="w-full max-w-sm space-y-4">
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
                            Auto-Detect Doorstep Location
                          </>
                        )}
                      </button>

                      {/* Quick Srinagar Areas Selector (Zero friction fallback) */}
                      <div className="pt-2 text-left w-full">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2 flex items-center justify-between">
                          <span>Or select your Srinagar delivery area:</span>
                          <span className="text-[10px] text-cyan-300 font-mono">Popular Srinagar Hubs</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-1.5 bg-slate-950/60 rounded-xl border border-slate-800">
                          {SRINAGAR_LANDMARKS.map((lm) => {
                            const d = calculateDistance(farmLat, farmLng, lm.lat, lm.lng);
                            const inZone = d <= deliveryRadiusKm;
                            return (
                              <button
                                key={lm.name}
                                type="button"
                                onClick={() => handleSelectLandmarkBeat(lm)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                                  inZone
                                    ? "bg-slate-900 hover:bg-cyan-950/70 border border-slate-700 hover:border-cyan-400 text-slate-200"
                                    : "bg-slate-950/40 border border-slate-800 text-slate-400 hover:text-slate-300"
                                }`}
                              >
                                <span>{lm.name}</span>
                                <span className={`text-[10px] font-mono ${inZone ? "text-emerald-400" : "text-amber-400"}`}>
                                  {d.toFixed(1)}km
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── UBER / OLA STYLE INTERACTIVE LIVE MAP & VERIFIED LOCATION (ONCE DETECTED) ─── */}
                {detectedCoords && deliveryMode && (
                  <div className="space-y-6 pt-2">
                    {/* Status Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                      <div className="flex-1 min-w-0 pr-2">
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
                        <h3 className="text-lg sm:text-xl font-extrabold text-white truncate" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                          {selectedZoneName || "GPS Location Confirmed"}
                        </h3>
                        <p
                          className={`text-xs mt-0.5 ${
                            deliveryMode === "under5" ? "text-emerald-300/90" : "text-red-300/90"
                          }`}
                        >
                          {locationMsg ||
                            (deliveryMode === "under5"
                              ? `${calculatedDistance?.toFixed(1)} km from Urban Trout Hub, Malabagh • Free Express Delivery within 2 Hours ✓`
                              : `${calculatedDistance?.toFixed(1)} km from Urban Trout Hub • Outside our ${deliveryRadiusKm}km live harvest delivery perimeter.`)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0 self-start md:self-auto">
                        <button
                          type="button"
                          onClick={detectLocation}
                          disabled={isLocating}
                          className="px-3 py-1.5 rounded-lg text-xs text-cyan-300 hover:text-white bg-cyan-950/80 border border-cyan-800 transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Re-check device GPS"
                        >
                          <span>📍</span>
                          <span>Re-check GPS</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetLocation}
                          className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-cyan-300 bg-slate-900 border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Choose another Srinagar locality"
                        >
                          <span>🔄</span>
                          <span>Change Location</span>
                        </button>
                      </div>
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
                          {calculatedDistance !== null && ` • ~${calculatedDistance.toFixed(1)} km from Urban Trout Aquaculture Farm, Malabagh`}
                        </span>
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${detectedCoords.lat},${detectedCoords.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-semibold hover:text-white transition-colors flex items-center gap-1.5 flex-shrink-0"
                      >
                        🗺️ 1-Tap Google Maps (Navigate) ↗
                      </a>
                    </div>

                    {/* CASE 1: IN-ZONE -> PROCEED TO STEP 3: PAYMENT */}
                    {deliveryMode === "under5" && (
                      <div className="space-y-3 pt-2">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            onClick={handleBackToAddressEdit}
                            className="px-6 py-4 rounded-xl font-bold uppercase text-xs tracking-wider transition-all order-2 sm:order-1 text-center cursor-pointer"
                            style={{
                              background: "rgba(3,16,24,0.8)",
                              border: "1px solid rgba(61,74,83,0.6)",
                              color: C.onSurfVar,
                              fontFamily: '"Space Grotesk", sans-serif',
                            }}
                          >
                            ← Back to Details
                          </button>
                          <button
                            type="button"
                            onClick={handleConfirmLocationProceed}
                            className="flex-1 flex items-center justify-center gap-2.5 font-bold uppercase tracking-widest rounded-xl py-4 px-6 transition-all cursor-pointer shadow-lg active:scale-98 order-1 sm:order-2"
                            style={{
                              fontFamily: '"Space Grotesk", sans-serif',
                              fontSize: "0.95rem",
                              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                              color: "#ffffff",
                              boxShadow: "0 0 30px rgba(34,197,94,0.4)",
                            }}
                          >
                            Proceed to Step 3: Payment
                            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <line x1="5" y1="12" x2="19" y2="12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                          </button>
                        </div>
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
                            Because live harvested trout requires express aeration within 90 minutes, doorstep delivery is restricted to our {deliveryRadiusKm}km perimeter. You are always welcome to pick up freshly harvested catch directly from our dedicated Live Trout Vending Center:
                          </p>
                          <span className="text-slate-200 block font-semibold pt-1">
                            📍 Malabagh, Srinagar — 190006 (Near R P School, Girls Wing)
                          </span>
                        </div>

                        {/* Quick 1-tap in-zone selector if customer wants delivery to a friend/office in-zone */}
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-2">
                          <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                            <span>Delivering to an office, friend, or relative within 5km?</span>
                            <span className="text-[10px] text-emerald-400 font-mono">1-Tap Select</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                            {SRINAGAR_LANDMARKS.filter((lm) => calculateDistance(farmLat, farmLng, lm.lat, lm.lng) <= deliveryRadiusKm).map((lm) => {
                              const d = calculateDistance(farmLat, farmLng, lm.lat, lm.lng);
                              return (
                                <button
                                  key={lm.name}
                                  type="button"
                                  onClick={() => handleSelectLandmarkBeat(lm)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 bg-slate-900 hover:bg-cyan-950/70 border border-slate-700 hover:border-cyan-400 text-slate-200"
                                >
                                  <span>{lm.name}</span>
                                  <span className="text-[10px] font-mono text-emerald-400">
                                    {d.toFixed(1)}km
                                  </span>
                                </button>
                              );
                            })}
                          </div>
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
                            href="https://maps.app.goo.gl/4N8A8ywhJpys9EaDA"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 bg-slate-900 border border-slate-700 text-slate-200 hover:text-white shadow-md"
                          >
                            📍 Vending Center Route on Google Maps
                          </a>
                        </div>

                        <div className="pt-2 text-center">
                          <button
                            type="button"
                            onClick={handleBackToAddressEdit}
                            className="text-xs text-cyan-300 underline cursor-pointer"
                          >
                            ← Change Delivery Address
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                    ← Back to Location
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
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        style={{
                          fontFamily: '"Inter", sans-serif',
                          fontSize: "9px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: C.outline,
                        }}
                      >
                        Delivering To
                      </span>
                      <button
                        type="button"
                        onClick={handleBackToAddressEdit}
                        className="text-[10px] text-cyan-300 hover:text-white underline cursor-pointer"
                      >
                        Edit Details
                      </button>
                    </div>
                    <p
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700,
                        color: C.onSurface,
                        margin: 0,
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
                        margin: 0,
                      }}
                    >
                      {formData.house}, {formData.locality}{formData.pincode ? `, ${formData.pincode}` : ""}
                    </p>
                  </div>
                  <div className="text-left md:text-right space-y-1">
                    <div className="flex items-center md:justify-end gap-2">
                      <span
                        style={{
                          fontFamily: '"Inter", sans-serif',
                          fontSize: "9px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          color: C.outline,
                        }}
                      >
                        Delivery Radius
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentStep(2);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="text-[10px] text-cyan-300 hover:text-white underline cursor-pointer"
                      >
                        Edit Location
                      </button>
                    </div>
                    <p
                      style={{
                        fontFamily: '"Space Grotesk", sans-serif',
                        fontWeight: 700,
                        color: "#4ade80",
                        margin: 0,
                        fontSize: "0.9rem",
                      }}
                    >
                      Within {deliveryRadiusKm}km — Free Delivery ✓
                    </p>
                    {calculatedDistance !== null && (
                      <p className="text-[11px] font-mono text-cyan-300/80 m-0">
                        ~{calculatedDistance.toFixed(1)} km from Malabagh Farm
                      </p>
                    )}
                  </div>
                </div>

                {/* ─── WHY WE DON'T OFFER CASH ON DELIVERY (LIVE HARVEST POLICY) ─── */}
                <div
                  className="p-5 sm:p-6 rounded-2xl space-y-4"
                  style={{
                    background: "linear-gradient(135deg, rgba(8,27,38,0.95) 0%, rgba(13,38,52,0.85) 100%)",
                    border: "1.5px solid rgba(114,221,253,0.3)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">🐟</span>
                      <div>
                        <h4
                          style={{
                            fontFamily: '"Space Grotesk", sans-serif',
                            fontWeight: 800,
                            fontSize: "1.05rem",
                            color: "#ffffff",
                            margin: 0,
                          }}
                        >
                          Why Advance Payment is Required (No COD)
                        </h4>
                        <span className="text-[11px] text-cyan-300 font-mono">
                          Live Farm Harvest Policy · Zero Dead Fish Waste
                        </span>
                      </div>
                    </div>
                    <span className="self-start sm:self-auto text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 uppercase tracking-wider">
                      Prepaid Only
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed" style={{ fontFamily: '"Manrope", sans-serif' }}>
                    Unlike supermarkets selling pre-slaughtered frozen fish, <strong>every Rainbow Trout is swimming alive in our cold-water Recirculating Aquaculture System (RAS) tanks in Malabagh right now</strong>. We only net, humanely harvest, descale, and pack it on ice <em>after</em> your order is confirmed and paid.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                      <span className="text-amber-400 text-base mt-0.5">🚫</span>
                      <div>
                        <strong className="text-xs text-white block" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                          Why We Do Not Do Cash on Delivery
                        </strong>
                        <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">
                          Once harvested from pristine borewell water, trout cannot be returned to the RAS tanks alive. Advance payment protects our fresh, ethically raised fish from refusal or last-minute cancellation.
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5">
                      <span className="text-emerald-400 text-base mt-0.5">⚡</span>
                      <div>
                        <strong className="text-xs text-white block" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                          Guaranteed &lt; 2-Hour Delivery on Ice
                        </strong>
                        <span className="text-[11px] text-slate-400 leading-normal block mt-0.5">
                          Prepaid orders trigger instant priority harvest and chilled dispatch directly to your doorstep with zero cash delays, OTP friction, or loose change hassles.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 100% Quality & Freshness Guarantee */}
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start sm:items-center gap-3 text-xs">
                    <span className="text-xl flex-shrink-0">🛡️</span>
                    <div className="flex-1">
                      <strong className="text-emerald-300 block" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                        100% Freshness &amp; Weight Guarantee
                      </strong>
                      <span className="text-emerald-200/90 text-[11px] leading-relaxed block">
                        If your trout is not fresh, pristine, and perfectly cleaned upon doorstep arrival, we provide an immediate 100% refund or free replacement catch — guaranteed.
                      </span>
                    </div>
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
                      Free Doorstep Delivery • Instant 1-Tap UPI (GPay, PhonePe, Paytm, Cards)
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
                    {["UPI / QR", "Google Pay", "PhonePe", "Paytm", "Cards", "Net Banking"].map((m) => (
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
                      256-bit SSL secured · Bank-grade encrypted · Powered by Razorpay
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

                {/* Scheduled summary pill if store closed */}
                {!storeStatus.isOpen && (
                  <div className="p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">📅</span>
                      <div>
                        <span className="text-white font-bold block">Scheduled Delivery Slot Confirmed</span>
                        <span className="text-cyan-300 font-mono text-[11px]">
                          {selectedScheduledDate} • {selectedScheduledSlot}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentStep(1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-cyan-400 hover:text-cyan-200 underline font-semibold text-[11px] cursor-pointer"
                    >
                      Change Slot
                    </button>
                  </div>
                )}

                {/* Pay Now CTA */}
                <button
                  type="button"
                  onClick={handleRazorpayPayment}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 font-bold uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-5 cursor-pointer"
                  style={{
                    fontFamily: '"Space Grotesk", sans-serif',
                    fontSize: "1rem",
                    background: isSubmitting
                      ? "rgba(58,173,204,0.6)"
                      : !storeStatus.isOpen
                      ? "linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)"
                      : "linear-gradient(135deg, #3aadcc 0%, #72ddfd 100%)",
                    color: !storeStatus.isOpen ? "#ffffff" : "#002730",
                    border: "none",
                    boxShadow: isSubmitting
                      ? "none"
                      : !storeStatus.isOpen
                      ? "0 0 35px rgba(16,185,129,0.35)"
                      : "0 0 35px rgba(114,221,253,0.45)",
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
                  ) : !storeStatus.isOpen ? (
                    <>
                      <span>📅</span>
                      <span>Pay ₹{grandTotal.toLocaleString("en-IN")} · Confirm Pre-Order ({selectedScheduledSlot})</span>
                    </>
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

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span>✓</span> Zero Convenience Fees
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-cyan-300">
                    <span>⚡</span> Priority Live Harvest Triggered
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span>🛡️</span> 100% Money-Back Guarantee
                  </span>
                </div>
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

                {/* Catch Nutritional Power Yield Card */}
                {totalTroutKg > 0 && (
                  <div
                    className="p-3.5 rounded-2xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(8,27,38,0.95) 0%, rgba(13,38,52,0.85) 100%)",
                      border: "1px solid rgba(114,221,253,0.25)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-cyan-300 font-['Space_Grotesk'] uppercase tracking-wider flex items-center gap-1.5">
                        <span>🧬</span> {totalTroutKg} Kg Catch Nutrition Yield
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Fact-Checked
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center py-1">
                      <div className="bg-slate-950/70 p-1.5 rounded-xl border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block font-mono uppercase tracking-tight">Pure Protein</span>
                        <strong className="text-xs sm:text-sm text-cyan-300 font-bold font-['Space_Grotesk']">
                          ~{checkoutNutrition.proteinGrams}g
                        </strong>
                        <span className="text-[8px] text-emerald-400 block">≈ {checkoutNutrition.eggWhiteEquivalent} Eggs</span>
                      </div>

                      <div className="bg-slate-950/70 p-1.5 rounded-xl border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block font-mono uppercase tracking-tight">EPA + DHA</span>
                        <strong className="text-xs sm:text-sm text-emerald-400 font-bold font-['Space_Grotesk']">
                          ~{(checkoutNutrition.omega3Mg / 1000).toFixed(1)}g
                        </strong>
                        <span className="text-[8px] text-slate-400 block">Omega-3s</span>
                      </div>

                      <div className="bg-slate-950/70 p-1.5 rounded-xl border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block font-mono uppercase tracking-tight">Natural D3</span>
                        <strong className="text-xs sm:text-sm text-amber-300 font-bold font-['Space_Grotesk']">
                          ~{checkoutNutrition.vitaminDIU.toLocaleString("en-IN")} IU
                        </strong>
                        <span className="text-[8px] text-slate-400 block">Immunity</span>
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-300 leading-snug mt-1.5 text-center">
                      ⚡ <strong>Fact Check:</strong> {checkoutNutrition.headlineFact}
                    </p>
                  </div>
                )}

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
                        ? "Check zone (Step 2)"
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

                {!storeStatus.isOpen && (
                  <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-xs text-cyan-200 mt-2 flex items-center gap-2.5">
                    <span className="text-base">📅</span>
                    <div>
                      <span className="font-bold text-white block">Scheduled Delivery Mode</span>
                      <span className="text-[11px] text-cyan-300 font-mono">{selectedScheduledDate} • {selectedScheduledSlot}</span>
                    </div>
                  </div>
                )}

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
                    <span>{!storeStatus.isOpen ? `Fresh Harvest for ${selectedScheduledSlot}` : "Cold-Chain 90-Min Dispatch"}</span>
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
