const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const https = require("https");
const http = require("http");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();
const { sendNightlyBriefing, sendTelegramMessage } = require("./nightly_briefing.js");

// Prevent uncaught exceptions from terminating the Node agent process
process.on("uncaughtException", (err) => {
  console.error("💥 [Process Uncaught Exception Handled]:", err?.stack || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("💥 [Process Unhandled Rejection Handled]:", reason);
});

// ============================================================================
// URBAN TROUT SALES AGENT — BUILD & VERSION TRACKING
// ============================================================================
const BOT_VERSION = "3.7.3";
const BOT_LAST_UPDATED = "27-Nov-2026, 10:05 AM IST";
const BOT_RELEASE_TITLE = "Smart #paid Weight/Fee/Amount Disambiguation & Quoted QR Reply";
const BOT_RELEASE_NOTES = "1. #paid / $paid now supports #paid 2kg +200, #paid 2kg, #Paid 1000, and swipe-replying #paid on any specific QR/link. 2. Auto-matches flat #paid amounts against multiple QRs/links in chat history without falsely inflating or mislabeling kg.";

// ============================================================================
// STRICT MANUAL-ONLY & DRIVER EXCLUSION LIST (AI MUST NEVER TEXT UNDER ANY CIRCUMSTANCE)
// 1. IAS Officer / Executive contacts managed 100% manually by owner Suhail.
// 2. Rapido / Delivery drivers (e.g. MS Wani 9906030280) managed manually for rider dispatch.
// ============================================================================
const VVIP_MANUAL_ONLY_PHONES = new Set([
  "9419153353",
  "919419153353",
  "+919419153353",
  "9906030280",
  "919906030280",
  "+919906030280"
]);

const VVIP_MANUAL_ONLY_JIDS = new Set([
  "9419153353@s.whatsapp.net",
  "919419153353@s.whatsapp.net",
  "208486419951677@lid", // Verified WhatsApp Baileys LID for 9419153353
  "9906030280@s.whatsapp.net",
  "919906030280@s.whatsapp.net",
  "177996883349738@lid" // Verified WhatsApp Baileys LID for MS Wani (Rapido Driver)
]);

// VVIP / VIP & Driver Protection (Manual chat only - AI never replies or messages)

function isVvipManualOnly(chatId, phone) {
  if (chatId) {
    const cleanJid = String(chatId).toLowerCase().trim();
    if (VVIP_MANUAL_ONLY_JIDS.has(cleanJid)) return true;
    if (
      cleanJid.includes("9419153353") ||
      cleanJid.includes("208486419951677") ||
      cleanJid.includes("9906030280") ||
      cleanJid.includes("177996883349738")
    ) return true;
  }
  if (phone) {
    const digits = String(phone).replace(/\D/g, "");
    if (
      digits.endsWith("9419153353") ||
      digits.endsWith("9906030280") ||
      VVIP_MANUAL_ONLY_PHONES.has(digits)
    ) return true;
  }
  return false;
}


// Multi-Account Gemini API Key Pool with automatic rotation & failover
const rawGeminiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const GEMINI_API_KEYS = rawGeminiKeys
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

console.log(`🔑 [Gemini Key Pool] Loaded ${GEMINI_API_KEYS.length} active account key(s) with automatic failover.`);

let activeKeyIndex = 0;
let lastActiveGeminiModel = "gemini-flash-lite-latest";
function getActiveGeminiKey() {
  if (GEMINI_API_KEYS.length === 0) return "";
  return GEMINI_API_KEYS[activeKeyIndex % GEMINI_API_KEYS.length];
}

function rotateGeminiKey() {
  if (GEMINI_API_KEYS.length > 1) {
    activeKeyIndex = (activeKeyIndex + 1) % GEMINI_API_KEYS.length;
    console.log(`[API Key Failover] Switched to Key #${activeKeyIndex + 1} (${getActiveGeminiKey().slice(0, 14)}...)`);
  }
}

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_API_VERSION = "2023-08-01";

// Farm coordinates for automated 16km radius GPS validation
const FARM_LAT = 34.1445563;
const FARM_LNG = 74.8245018;

// ============================================================================
// REAL-TIME WEATHER RADAR & <= 6 KM WET-WEATHER DELIVERY ENGINE
// During active rain or snow: <= 6.0 km delivers with weather-delay notice;
// > 6.0 km pauses express delivery until weather clears (clear = 0–16.0 km).
// ============================================================================
const WEATHER_RESTRICT_RADIUS_KM = 6.0;
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
const WEATHER_STATE_FILE = path.join(__dirname, "weather_state.json");
const RAIN_WMO_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_WMO_CODES = new Set([71, 73, 75, 77, 85, 86]);

let weatherOverride = { mode: "auto", updatedAt: null, updatedBy: null };
try {
  if (fs.existsSync(WEATHER_STATE_FILE)) {
    const savedWeather = JSON.parse(fs.readFileSync(WEATHER_STATE_FILE, "utf8"));
    if (savedWeather && ["auto", "rain", "snow", "clear"].includes(savedWeather.mode)) {
      weatherOverride = {
        mode: savedWeather.mode,
        updatedAt: savedWeather.updatedAt || null,
        updatedBy: savedWeather.updatedBy || null
      };
    }
  }
} catch (_) {}

function writeJsonAtomicSync(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Windows antivirus / concurrent reader fallback
    try { fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8"); } catch (_) {}
  }
}

function saveWeatherOverrideState() {
  try {
    writeJsonAtomicSync(WEATHER_STATE_FILE, weatherOverride);
  } catch (_) {}
}

// ============================================================================
// FRIDAY BUSINESS OPERATIONS OVERRIDE (Control via #friday on / #friday off)
// Standard policy: Closed on Friday for bio-security & filtration maintenance.
// Owner override: Forces business operations OPEN on Friday (8:00 AM - 8:00 PM).
// ============================================================================
const FRIDAY_STATE_FILE = path.join(__dirname, "friday_state.json");
let fridayOverride = { mode: "auto", updatedAt: null, updatedBy: null };
try {
  if (fs.existsSync(FRIDAY_STATE_FILE)) {
    const savedFri = JSON.parse(fs.readFileSync(FRIDAY_STATE_FILE, "utf8"));
    if (savedFri && ["auto", "open", "closed"].includes(savedFri.mode)) {
      fridayOverride = {
        mode: savedFri.mode,
        updatedAt: savedFri.updatedAt || null,
        updatedBy: savedFri.updatedBy || null
      };
    }
  }
} catch (_) {}

function saveFridayOverrideState() {
  try {
    writeJsonAtomicSync(FRIDAY_STATE_FILE, fridayOverride);
  } catch (_) {}
}

let websiteFridayAllowed = false;

function setFridayOverrideMode(mode, updatedBy = "Suhail") {
  const cleanMode = String(mode || "").toLowerCase().trim();
  const normMode = (cleanMode === "open" || cleanMode === "on" || cleanMode === "enable" || cleanMode === "start")
    ? "open"
    : (cleanMode === "closed" || cleanMode === "close" || cleanMode === "off" || cleanMode === "disable" || cleanMode === "stop")
    ? "closed"
    : "auto";
  fridayOverride = {
    mode: normMode,
    updatedAt: new Date().toISOString(),
    updatedBy
  };
  saveFridayOverrideState();

  // 🌐 PAIR WITH WEBSITE: Sync immediately with Supabase app_settings (allow_friday_orders)
  // When Friday is OPEN, allow_friday_orders is "true", unlocking the website store & checkout.
  // When Friday is CLOSED or AUTO, allow_friday_orders is "false", restoring standard Friday maintenance mode.
  const allowFridayOnWebsite = normMode === "open" ? "true" : "false";
  websiteFridayAllowed = (normMode === "open");
  if (typeof updateSupabaseAppSettings === "function") {
    try {
      updateSupabaseAppSettings("allow_friday_orders", allowFridayOnWebsite)
        .then((ok) => {
          if (ok) console.log(`🌐 [Website Sync] Updated allow_friday_orders=${allowFridayOnWebsite} in Supabase app_settings`);
        })
        .catch((err) => console.warn("🌐 [Website Sync Notice]:", err?.message || err));
    } catch (_) {}
  }

  // Also sync local .app_settings_cache.json in urban-trout-app if available in workspace
  try {
    const webCacheCandidates = [
      path.resolve(__dirname, "../urban-trout-app/.app_settings_cache.json"),
      path.resolve(__dirname, ".app_settings_cache.json")
    ];
    for (const cPath of webCacheCandidates) {
      if (fs.existsSync(cPath)) {
        const cache = JSON.parse(fs.readFileSync(cPath, "utf8"));
        cache.allow_friday_orders = allowFridayOnWebsite;
        writeJsonAtomicSync(cPath, cache);
      }
    }
  } catch (_) {}
}

function isFridayOperationsOpen() {
  if (fridayOverride.mode === "open") {
    // Expire owner override only after the active/upcoming Friday ends (do NOT kill Thursday-night #friday on at 00:00 AM Friday!)
    if (fridayOverride.updatedAt) {
      try {
        const setDt = new Date(fridayOverride.updatedAt);
        const nowDt = new Date();
        const setDate = setDt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const todayDate = nowDt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const ageHours = (nowDt.getTime() - setDt.getTime()) / (3600 * 1000);
        const setDayIst = new Date(setDt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getDay();
        const todayDayIst = new Date(nowDt.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })).getDay();
        const isThuToFriCarryover = (setDayIst === 4 && todayDayIst === 5 && ageHours < 36);
        if (setDate !== todayDate && !isThuToFriCarryover) {
          console.log(`[Friday Guard] Auto-expired previous Friday override from ${setDate} (Today is ${todayDate}). Reverting to default CLOSED.`);
          setFridayOverrideMode("auto", "Auto-Expiry");
          return false;
        }
      } catch (_) {}
    }
    return true;
  }
  if (fridayOverride.mode === "closed") return false;
  // Respect website admin toggle when in auto mode
  if (websiteFridayAllowed) return true;
  // Standard Farm Policy: Strictly CLOSED on Fridays for filtration bio-security maintenance
  return false;
}

// Bulletproof amount extractor that strictly respects Total Payable / Grand Total hierarchy
function extractTotalPayableAmount(text) {
  if (!text || typeof text !== "string") return null;
  // 1. Highest priority: Explicit Total Payable / Total Amount / Final Amount
  const payableMatch = text.match(/(?:Total\s*Payable|Payable\s*Amount|Final\s*Amount|Net\s*Amount|Total\s*Due)(?:\s*\([^)\n\r]{1,20}\))?[^0-9\n\r]{0,20}?₹?\s*([\d,]{3,11})\b(?!\s*\/\s*kg)/i);
  if (payableMatch) return parseInt(payableMatch[1].replace(/,/g, ""), 10);

  // 2. Official Order Summary Total
  const summaryTotalMatch = text.match(/(?:Order\s*Total|Grand\s*Total)(?:\s*\([^)\n\r]{1,20}\))?[^0-9\n\r]{0,20}?₹?\s*([\d,]{3,11})\b(?!\s*\/\s*kg)/i);
  if (summaryTotalMatch) return parseInt(summaryTotalMatch[1].replace(/,/g, ""), 10);

  // 3. Amount followed by "total" (e.g. "₹1,215 total", "1840 total", "*₹1,215 total*")
  const trailingTotalMatch = text.match(/₹?\s*([\d,]{3,11})\s*(?:\*)?\s*(?:total|grand\s*total)\b(?!\s*\/\s*kg)/i);
  if (trailingTotalMatch) return parseInt(trailingTotalMatch[1].replace(/,/g, ""), 10);

  // 4. Fallback: Word-bounded Total that is NOT preceded by "Fish " or "Sub" (prevents matching "Subtotal")
  const generalTotalMatch = text.match(/(?<!Fish\s*)\b(?:Total\s*Amount|Total|Amount)(?:\s*\([^)\n\r]{1,20}\))?[^0-9\n\r]{0,20}?₹?\s*([\d,]{3,11})\b(?!\s*\/\s*kg)/i);
  if (generalTotalMatch) return parseInt(generalTotalMatch[1].replace(/,/g, ""), 10);

  return null;
}

let liveWeatherCache = {
  fetchedAt: 0,
  ok: false,
  condition: "clear",
  isBadWeather: false,
  hasRain: false,
  hasSnow: false,
  code: 0,
  label: "Clear",
  tempC: null,
  precipMm: 0,
  rainMm: 0,
  snowCm: 0
};

function describeWmoWeatherCode(code) {
  const map = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Freezing Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Freezing Drizzle",
    57: "Heavy Freezing Drizzle",
    61: "Light Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    66: "Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Light Snowfall",
    73: "Moderate Snowfall",
    75: "Heavy Snowfall",
    77: "Snow Grains",
    80: "Light Rain Showers",
    81: "Moderate Rain Showers",
    82: "Heavy Rain Showers",
    85: "Light Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Hail",
    99: "Severe Thunderstorm with Hail"
  };
  return map[code] || `Weather Code ${code}`;
}

function classifyWeatherMetrics({ code = 0, rainMm = 0, showersMm = 0, snowCm = 0, precipMm = 0, tempC = null }) {
  const numCode = Number(code) || 0;
  const totalRain = (Number(rainMm) || 0) + (Number(showersMm) || 0);
  const totalSnow = Number(snowCm) || 0;
  const totalPrecip = Number(precipMm) || 0;
  const hasSnow = SNOW_WMO_CODES.has(numCode) || totalSnow >= 0.05;
  const hasRain = !hasSnow && (RAIN_WMO_CODES.has(numCode) || totalRain >= 0.1 || totalPrecip >= 0.2);
  const condition = hasSnow ? "snow" : (hasRain ? "rain" : "clear");
  return {
    condition,
    isBadWeather: hasSnow || hasRain,
    hasRain,
    hasSnow,
    code: numCode,
    label: describeWmoWeatherCode(numCode),
    tempC: tempC != null && !isNaN(Number(tempC)) ? Number(tempC) : null,
    precipMm: Number(totalPrecip.toFixed(2)),
    rainMm: Number(totalRain.toFixed(2)),
    snowCm: Number(totalSnow.toFixed(2))
  };
}

let weatherRefreshPromise = null;
function refreshSrinagarWeather(force = false) {
  const now = Date.now();
  if (!force && liveWeatherCache.ok && (now - liveWeatherCache.fetchedAt) < WEATHER_CACHE_TTL_MS) {
    return Promise.resolve(liveWeatherCache);
  }
  if (weatherRefreshPromise) return weatherRefreshPromise;

  weatherRefreshPromise = new Promise((resolve) => {
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${FARM_LAT}&longitude=${FARM_LNG}&current=temperature_2m,precipitation,rain,showers,snowfall,weather_code&timezone=Asia%2FKolkata`;
    const req = https.get(apiUrl, { timeout: 3500 }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        weatherRefreshPromise = null;
        try {
          const data = JSON.parse(body);
          const c = data && data.current;
          if (c) {
            const classified = classifyWeatherMetrics({
              code: c.weather_code,
              rainMm: c.rain,
              showersMm: c.showers,
              snowCm: c.snowfall,
              precipMm: c.precipitation,
              tempC: c.temperature_2m
            });
            liveWeatherCache = {
              fetchedAt: Date.now(),
              ok: true,
              ...classified
            };
            console.log(`🌦️ [Weather Radar] Srinagar (${FARM_LAT.toFixed(3)}, ${FARM_LNG.toFixed(3)}): ${liveWeatherCache.label} (${liveWeatherCache.condition.toUpperCase()}), Temp: ${liveWeatherCache.tempC ?? "?"}°C, Precip: ${liveWeatherCache.precipMm}mm, Snow: ${liveWeatherCache.snowCm}cm`);
          }
        } catch (e) {
          console.warn("⚠️ [Weather Radar] Failed parsing Open-Meteo response:", e.message);
        }
        resolve(liveWeatherCache);
      });
    });
    req.on("error", (err) => {
      weatherRefreshPromise = null;
      console.warn("⚠️ [Weather Radar] Open-Meteo fetch failed:", err.message);
      resolve(liveWeatherCache);
    });
    req.on("timeout", () => {
      req.destroy();
      weatherRefreshPromise = null;
      console.warn("⚠️ [Weather Radar] Open-Meteo request timed out.");
      resolve(liveWeatherCache);
    });
  });
  return weatherRefreshPromise;
}

async function ensureFreshSrinagarWeather() {
  if (process.env.WEATHER_DISABLE_AUTO_FETCH === "1") return getEffectiveSrinagarWeather();
  if (weatherOverride.mode !== "auto") return getEffectiveSrinagarWeather();
  if (!liveWeatherCache.fetchedAt || (Date.now() - liveWeatherCache.fetchedAt) >= WEATHER_CACHE_TTL_MS) {
    await refreshSrinagarWeather(false);
  }
  return getEffectiveSrinagarWeather();
}

function setWeatherOverrideMode(mode, updatedBy = "Owner") {
  const clean = String(mode || "auto").toLowerCase().trim();
  if (!["auto", "rain", "snow", "clear"].includes(clean)) return null;
  weatherOverride = {
    mode: clean,
    updatedAt: new Date().toISOString(),
    updatedBy
  };
  saveWeatherOverrideState();
  return getEffectiveSrinagarWeather();
}

function __setLiveWeatherCacheForTest(data = {}) {
  const classified = classifyWeatherMetrics(data);
  liveWeatherCache = {
    fetchedAt: Date.now(),
    ok: true,
    ...classified
  };
  return liveWeatherCache;
}

function getEffectiveSrinagarWeather() {
  const mode = weatherOverride?.mode || "auto";
  if (mode === "rain") {
    return {
      condition: "rain",
      isBadWeather: true,
      hasRain: true,
      hasSnow: false,
      code: liveWeatherCache.code || 63,
      label: "Rainy Weather (Owner Override)",
      tempC: liveWeatherCache.tempC,
      precipMm: liveWeatherCache.precipMm,
      snowCm: liveWeatherCache.snowCm,
      source: "manual-override",
      mode
    };
  }
  if (mode === "snow") {
    return {
      condition: "snow",
      isBadWeather: true,
      hasRain: false,
      hasSnow: true,
      code: liveWeatherCache.code || 73,
      label: "Snowfall (Owner Override)",
      tempC: liveWeatherCache.tempC,
      precipMm: liveWeatherCache.precipMm,
      snowCm: liveWeatherCache.snowCm,
      source: "manual-override",
      mode
    };
  }
  if (mode === "clear") {
    return {
      condition: "clear",
      isBadWeather: false,
      hasRain: false,
      hasSnow: false,
      code: 0,
      label: "Clear Weather (Owner Override)",
      tempC: liveWeatherCache.tempC,
      precipMm: 0,
      snowCm: 0,
      source: "manual-override",
      mode
    };
  }
  return {
    ...liveWeatherCache,
    source: liveWeatherCache.ok ? "open-meteo" : "default-clear",
    mode: "auto"
  };
}

function isThuClosedFriTomorrowIst() {
  try {
    const nowIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    return nowIst.getDay() === 4 && !isFridayOperationsOpen();
  } catch (_) {
    return false;
  }
}

function evaluateWeatherDeliveryPolicy(distanceKm = null) {
  const w = getEffectiveSrinagarWeather();
  const hasValidDist = distanceKm != null && typeof distanceKm !== "boolean" && String(distanceKm).trim() !== "" && !isNaN(Number(distanceKm));
  const d = hasValidDist ? Number(distanceKm) : null;
  const weatherNoun = w.hasSnow ? "snowfall" : (w.hasRain ? "rain" : "clear weather");
  const weatherTitle = w.hasSnow ? "Snowfall" : (w.hasRain ? "Rain" : "Clear Weather");
  const weatherIcon = w.hasSnow ? "❄️" : (w.hasRain ? "🌧️" : "☀️");
  const maxAllowedKm = w.isBadWeather ? WEATHER_RESTRICT_RADIUS_KM : 16.0;
  const blockedByWeather = Boolean(w.isBadWeather && d !== null && d > WEATHER_RESTRICT_RADIUS_KM);
  const deliverWithDelayWarning = Boolean(w.isBadWeather && d !== null && d <= WEATHER_RESTRICT_RADIUS_KM);
  const delayWarningText = w.isBadWeather
    ? `${weatherIcon} *${weatherNoun === "snowfall" ? "Snowfall" : "Rain"} in your area:* Deliveries within *${WEATHER_RESTRICT_RADIUS_KM} km* are active! Since our riders are navigating extra carefully on wet roads, please allow 15–20 minutes extra transit time for your live-harvested pack (0% ice).`
    : "";
  const shortDelayNote = w.isBadWeather
    ? `${weatherIcon} _${weatherNoun === "snowfall" ? "Snowfall" : "Rain"} in your area: Deliveries within ${WEATHER_RESTRICT_RADIUS_KM} km are active. Please allow 15–20 min extra transit time for rider safety._`
    : "";
  const nextOpenDayWord = isThuClosedFriTomorrowIst() ? "Saturday" : "tomorrow";

  const buildWetWeatherOutOfZoneMessage = (placeName = null, dist = d) => {
    const cleanArea = (placeName && !/^(?:srinagar|kashmir|your\s*area)$/i.test(String(placeName).trim()))
      ? String(placeName).trim()
      : null;
    const distLine = dist != null && !isNaN(Number(dist))
      ? `Your location is approximately *${Number(dist).toFixed(1)} km* from our Recirculatory Aquaculture System at Malabagh.\n\n`
      : "";
    const weatherHeadline = weatherNoun === "snowfall"
      ? `❄️ *Snowfall Detected in Srinagar${cleanArea ? ` — ${cleanArea}` : ""}*`
      : `🌧️ *Rain Detected in Nearby Areas${cleanArea ? ` — ${cleanArea}` : ""}*`;
    const slotLabel = nextOpenDayWord === "Saturday" ? "Saturday Morning" : "Tomorrow Morning";
    const friNote = nextOpenDayWord === "Saturday" ? " (note: we are closed Fridays for maintenance)" : "";
    return (
      `${weatherHeadline}\n\n` +
      distLine +
      `Our dispatch radar has detected active *${weatherNoun}* across Srinagar. To ensure rider safety on wet roads and keep your live-harvested trout 100% fresh (*0% ice* in food-grade biodegradable polythene), same-day 2-hour express delivery beyond *${WEATHER_RESTRICT_RADIUS_KM} km* is temporarily on hold.\n\n` +
      `☀️ Express delivery to *${cleanArea || "your area"}* will resume the moment the ${weatherNoun} clears!\n\n` +
      `📅 *Schedule for ${slotLabel} or Counter Pickup:*\n` +
      `1️⃣ We can gladly schedule your fresh live harvest for *${nextOpenDayWord} morning (8:00 AM – 11:00 AM)*${friNote} once roads are clear.\n` +
      `2️⃣ Or you are warmly welcome to visit our *Live Vending Center in Malabagh* (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout directly from our tanks and watch it cleaned on the spot!\n` +
      `📍 Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9\n\n` +
      `Reply *"${nextOpenDayWord === "Saturday" ? "Saturday" : "Tomorrow"}"* if you'd like to lock in a morning delivery slot!`
    );
  };

  const buildConciseWeatherHoldReminder = (placeName = null, dist = d) => {
    const cleanArea = (placeName && !/^(?:srinagar|kashmir|your\s*area)$/i.test(String(placeName).trim()))
      ? String(placeName).trim()
      : null;
    const distTag = dist != null && !isNaN(Number(dist)) ? ` (~${Number(dist).toFixed(1)} km)` : "";
    return (
      `${weatherIcon} As noted earlier, our dispatch radar has detected active *${weatherNoun}*, so same-day express delivery to *${cleanArea || "your area"}*${distTag} is temporarily on hold beyond *${WEATHER_RESTRICT_RADIUS_KM} km* for rider safety.\n\n` +
      `📅 We can gladly schedule your fresh live-harvest delivery for *${nextOpenDayWord} morning (8:00 AM – 11:00 AM)*, or you're warmly welcome at our *Live Vending Center in Malabagh* (Sat–Thu) for live fresh pickup!\n` +
      `📍 Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9\n\n` +
      `Reply *"${nextOpenDayWord === "Saturday" ? "Saturday" : "Tomorrow"}"* if you'd like us to book ${nextOpenDayWord} morning's slot!`
    );
  };

  const buildBriefWeatherAckReply = (placeName = null) => {
    const cleanArea = (placeName && !/^(?:srinagar|kashmir|your\s*area)$/i.test(String(placeName).trim()))
      ? String(placeName).trim()
      : null;
    return `You're welcome! Delivery to *${cleanArea || "your area"}* remains on hold until the *${weatherNoun}* clears — feel free to drop by our *Live Vending Center in Malabagh* anytime (Sat–Thu), or message us anytime! 🐟`;
  };

  return {
    weather: w,
    distanceKm: d,
    weatherNoun,
    weatherTitle,
    weatherIcon,
    maxAllowedKm,
    blockedByWeather,
    deliverWithDelayWarning,
    delayWarningText,
    shortDelayNote,
    buildWetWeatherOutOfZoneMessage,
    buildConciseWeatherHoldReminder,
    buildBriefWeatherAckReply
  };
}

function isBriefAcknowledgement(text = "") {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.length > 48) return false;
  if (/^[\s👍👌🙏🤝✅❤️😊🙂🐟.,!?]+$/u.test(trimmed)) return true;
  return /^(?:ok(?:ay)?|kk?|alright|all\s*right|noted|got\s*it|understood|fine|good|cool|great|sure|thanks?(?:\s*(?:you|u|a\s*lot|so\s*much|ji))?|thx|ty|shukriya|jazakallah(?:\s*khair)?|ji(?:\s*ok(?:ay)?|\s*shukriya|\s*thanks?)?|theek\s*hai|thik\s*hai|no\s*problem|np)(?:\s+(?:ok(?:ay)?|thanks?(?:\s*(?:you|u))?|ji|thx|noted|shukriya))?[\s👍👌🙏🤝✅❤️😊🙂🐟.,!?]*$/iu.test(trimmed);
}

function hasRecentWeatherAdvisory(chatHistory, targetAreaName = null, lookback = 12) {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) return false;
  const recent = chatHistory.slice(-Math.max(1, lookback));
  const cleanTarget = (targetAreaName && !/^(?:srinagar|kashmir|your\s*area)$/i.test(String(targetAreaName).trim()))
    ? String(targetAreaName).trim().toLowerCase()
    : null;

  for (let i = recent.length - 1; i >= 0; i--) {
    const entry = recent[i];
    if (!entry || entry.role !== "model") continue;
    const txt = String(entry.text || "");
    const isAdvisory =
      /(?:Weather Delivery Advisory|Rain Detected in Nearby Areas|Snowfall Detected in Srinagar)/i.test(txt) ||
      (/(?:temporarily\s*(?:paused|on\s*hold)\s*beyond)\s*\*?\d+(?:\.\d+)?\s*km\*?/i.test(txt) && /Live Vending Center in Malabagh/i.test(txt));
    if (!isAdvisory) continue;

    if (cleanTarget) {
      const headerMatch =
        txt.match(/(?:Weather Delivery Advisory|Rain Detected in Nearby Areas|Snowfall Detected in Srinagar)\s*[—–-]\s*([^\n*]+)/i) ||
        txt.match(/express delivery to \*([^*]+)\*(?:\s*\([^)]+\))?\s+(?:remains|stays|is)\s+(?:temporarily\s+)?(?:paused|on\s*hold)/i) ||
        txt.match(/Express delivery to \*([^*]+)\*\s+(?:will\s+)?resume/i);
      const advisedArea = (headerMatch && headerMatch[1]) ? headerMatch[1].trim().toLowerCase() : "";
      if (
        advisedArea &&
        !/^(?:srinagar|kashmir|your\s*area)$/i.test(advisedArea) &&
        !advisedArea.includes(cleanTarget) &&
        !cleanTarget.includes(advisedArea)
      ) {
        continue;
      }
    }
    return true;
  }
  return false;
}

function hasRecentDelayNotice(chatHistory, lookback = 4) {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) return false;
  const recent = chatHistory.slice(-Math.max(1, lookback));
  return recent.some(entry =>
    entry &&
    entry.role === "model" &&
    (/\*?(?:Weather Delivery Notice|Rain in your area|Snowfall in your area):?\*?|slightly delayed (?:because of|due to) (?:the )?(?:weather|active|rain|snow)|allow 15[–-]20 min(?:utes)? extra/i.test(String(entry.text || "")))
  );
}

function buildWeatherHoldPromptContext({ areaName, distKm, weatherPolicy, alreadyAdvised, sourceLabel = "mentioned" }) {
  const displayArea = areaName || "Your Area";
  const distText = distKm != null && !isNaN(Number(distKm)) ? `~${Number(distKm)} km` : `>${WEATHER_RESTRICT_RADIUS_KM} km`;
  const nextOpenDayUpper = isThuClosedFriTomorrowIst() ? "SATURDAY" : "TOMORROW";
  const nextOpenDayTitle = isThuClosedFriTomorrowIst() ? "Saturday morning" : "tomorrow morning";
  const header = `${weatherPolicy.weatherIcon} ACTIVE WEATHER HOLD (${weatherPolicy.weatherTitle.toUpperCase()}): Customer ${sourceLabel} "${displayArea}" (${distText} from Malabagh), which is BEYOND our ${WEATHER_RESTRICT_RADIUS_KM} km wet-weather delivery limit during active ${weatherPolicy.weatherNoun}.
🛑 STRICT OVERRIDE: SAME-DAY 2-HOUR DISPATCH TO "${displayArea}" IS TEMPORARILY PAUSED TODAY DUE TO ACTIVE ${weatherPolicy.weatherNoun.toUpperCase()}.
📅 NEXT-DAY / ADVANCE SCHEDULE EXCEPTION: If the customer requests delivery for ${nextOpenDayUpper} or asks to schedule (${isThuClosedFriTomorrowIst() ? '"Saturday", "advance"' : '"tomorrow", "kal", "morning", "afternoon", "Saturday"'}), WE GLADLY SCHEDULE FOR ${nextOpenDayUpper} MORNING (8:00 AM – 11:00 AM)! Quote standard delivery terms and output [PAY_LINK: ...] for that scheduled harvest!
⚠️ CONFIDENTIALITY: NEVER mention "Rapido", "third-party", "doorstep", "cold-chain", "chilled", "subsidized", "70%", OR "30%"!`;

  if (alreadyAdvised) {
    return `\n======================================================
${header}
ℹ️ ALREADY NOTIFIED: You ALREADY sent the full *Weather Delivery Advisory* to this customer earlier in this chat!
CRITICAL ANTI-REPEAT INSTRUCTION: DO NOT repeat the full multi-paragraph *Weather Delivery Advisory* or Live Vending Center Maps block verbatim again!
• If customer wants to schedule for ${nextOpenDayTitle} / advance slot, GLADLY CONFIRM! Schedule their fresh live harvest for *${nextOpenDayTitle} (8:00 AM – 11:00 AM)*, quote standard delivery terms, and output [PAY_LINK: ...].
• If customer just replied with a short acknowledgement ("Ok", "Thanks", "Noted", "👍"), reply warmly in 1–2 brief sentences (confirming same-day delivery stays paused until weather clears, inviting them to reserve ${nextOpenDayTitle} or visit Malabagh Sat–Thu).
• If they asked a specific question (rates, Malabagh hours, ${nextOpenDayTitle}), answer briefly in 1–3 short lines without offering same-day delivery.
======================================================`;
  }

  return `\n======================================================
${header}
CRITICAL INSTRUCTION: Reply warmly with this exact message (you may keep it concise and verbatim):
${weatherPolicy.buildWetWeatherOutOfZoneMessage(displayArea, distKm)}
======================================================`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  const aerial = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Srinagar Road Winding & Water Barrier Calibration (Google Maps / Rapido traveling road distance):
  // 1. Dal Lake / Boulevard / Cheshmashahi / Tulip Garden corridor (South-East of Dal Lake):
  // Water barrier forces all vehicles to drive all the way around Dal Lake / Foreshore / Boulevard (~1.62x road detour factor).
  const isEastOfDalLake = (lon2 >= 74.845 && lat2 <= 34.135) || (lat2 <= 34.100 && lon2 >= 74.838);
  if (isEastOfDalLake) {
    return aerial * 1.62;
  }
  // 2. North/North-East corridor (Gulab Bagh, Zakura, Pandach, Ganderbal road): ~1.40x factor.
  if (lat2 >= 34.150 && lon2 >= 74.815) {
    return aerial * 1.40;
  }
  // 3. Central & South Srinagar across Jhelum bridges and city grid: ~1.38x factor.
  return aerial * 1.38;
}

const liveRoadDistanceCache = new Map();

// Real-time road traveling distance calculator (Google Maps / Rapido road network via OSRM with geographic fallback)
async function fetchLiveRoadDistance(lat, lng) {
  if (
    lat === null || lat === undefined || lng === null || lng === undefined ||
    typeof lat === "boolean" || typeof lng === "boolean" ||
    String(lat).trim() === "" || String(lng).trim() === ""
  ) return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  const key = `${latNum.toFixed(4)},${lngNum.toFixed(4)}`;
  if (liveRoadDistanceCache.has(key)) return liveRoadDistanceCache.get(key);

  const fallback = parseFloat(calculateDistance(FARM_LAT, FARM_LNG, latNum, lngNum).toFixed(1));

  return new Promise((resolve) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${FARM_LNG},${FARM_LAT};${lngNum},${latNum}?overview=false`;
    const req = https.get(url, { headers: { "User-Agent": "UrbanTroutBot/1.0" }, timeout: 1200 }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        res.resume();
        return resolve(fallback);
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.routes && json.routes[0]) {
            const dist = parseFloat((json.routes[0].distance / 1000).toFixed(1));
            if (liveRoadDistanceCache.size >= 1000) {
              const oldestKey = liveRoadDistanceCache.keys().next().value;
              if (oldestKey !== undefined) liveRoadDistanceCache.delete(oldestKey);
            }
            liveRoadDistanceCache.set(key, dist);
            return resolve(dist);
          }
        } catch (_) {}
        resolve(fallback);
      });
    });
    req.on("error", () => resolve(fallback));
    req.on("timeout", () => { req.destroy(); resolve(fallback); });
  });
}

// Unwrap WhatsApp message container across ephemeral, viewOnce, and nested wrappers
function getInnerMessage(msg) {
  if (!msg || !msg.message) return null;
  let cur = msg.message;
  const visited = new Set();
  for (let depth = 0; depth < 8 && cur && !visited.has(cur); depth++) {
    visited.add(cur);
    const next = cur.ephemeralMessage?.message ||
      cur.viewOnceMessage?.message ||
      cur.viewOnceMessageV2?.message ||
      cur.documentWithCaptionMessage?.message;
    if (!next) break;
    cur = next;
  }
  return cur;
}

function isAllowedGoogleMapsUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || "").trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    if (
      host === "maps.app.goo.gl" ||
      host === "app.goo.gl" ||
      (host === "goo.gl" && u.pathname.startsWith("/maps")) ||
      /^maps\.google\.[a-z.]{2,}$/.test(host) ||
      (/^(?:www\.|consent\.)?google\.[a-z.]{2,}$/.test(host))
    ) {
      return u;
    }
    return null;
  } catch (_) {
    return null;
  }
}

// Follow multi-hop redirects (and fallback HTML coordinate metadata) ONLY across validated Google Maps hosts
async function resolveGoogleMapsUrl(urlStr, maxHops = 4) {
  let currentUrl = urlStr;
  for (let hop = 0; hop < maxHops; hop++) {
    const parsedUrl = isAllowedGoogleMapsUrl(currentUrl);
    if (!parsedUrl) return currentUrl;

    const hopResult = await new Promise((resolve) => {
      try {
        const client = parsedUrl.protocol === "https:" ? https : http;
        const req = client.get(parsedUrl.toString(), { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, timeout: 4500 }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            try {
              const resolvedNext = new URL(res.headers.location, parsedUrl).toString();
              return resolve({ redirect: resolvedNext, body: "" });
            } catch {
              return resolve({ redirect: null, body: "" });
            }
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            if (body.length < 32768) body += chunk;
          });
          res.on("end", () => resolve({ redirect: null, body }));
        });
        req.on("error", () => resolve({ redirect: null, body: "" }));
        req.on("timeout", () => { req.destroy(); resolve({ redirect: null, body: "" }); });
      } catch {
        resolve({ redirect: null, body: "" });
      }
    });

    if (hopResult.redirect) {
      if (!isAllowedGoogleMapsUrl(hopResult.redirect)) break;
      currentUrl = hopResult.redirect;
      if (extractCoordinates(currentUrl)) return currentUrl;
      continue;
    }

    if (hopResult.body) {
      const embeddedCoords = extractCoordinates(hopResult.body, { allowRawPairs: false });
      if (embeddedCoords) {
        return `${currentUrl}#coords=${embeddedCoords.lat},${embeddedCoords.lng}`;
      }
    }
    break;
  }
  return currentUrl;
}

// Extract GPS latitude and longitude from URL strings, query params, or raw text coordinates
function extractCoordinates(text, { allowRawPairs = true } = {}) {
  if (!text) return null;
  let decoded = text;
  try { decoded = decodeURIComponent(text); } catch {}
  const normalizedQueryText = decoded.replace(/\+/g, " ");

  // 1. Google Maps exact pin data string !3dlat!4dlng (higher accuracy than viewport @lat,lng!)
  const dataMatch = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };

  // 2. Query param q=lat,lng, ll=lat,lng, center=lat,lng, or #coords=lat,lng (handles '+' encoded spaces)
  const qMatch = normalizedQueryText.match(/(?:[?&](?:q|ll|center|sll)|#coords)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  // 3. Google Maps viewport @lat,lng fallback
  const atMatch = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  if (!allowRawPairs) return null;

  // 4. Raw lat, lng in text: e.g. 34.144556, 74.824501 (Requires decimal precision)
  const rawMatch = decoded.match(/(?<![\d.-])(-?\d{1,2}\.\d{3,12})[,\s]+(-?\d{1,3}\.\d{3,12})\b/);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && lat !== 0) {
      return { lat, lng };
    }
  }
  return null;
}

// Detect coordinates from text message or embedded Google Maps links
async function getCoordinatesFromText(text) {
  if (!text) return null;
  let coords = extractCoordinates(text);
  if (coords) return coords;

  const urlMatch = text.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|www\.google\.[a-z.]+\/maps)[^\s]*/i);
  if (urlMatch) {
    const originalUrl = urlMatch[0].replace(/[),.;]+$/, "");
    if (!isAllowedGoogleMapsUrl(originalUrl)) return null;
    const resolvedUrl = await resolveGoogleMapsUrl(originalUrl);
    coords = extractCoordinates(resolvedUrl);
    if (coords) return coords;
  }
  return null;
}

// Srinagar Locality Intelligence (Instant recognition without forcing WhatsApp location pins)
// OSM-verified via Overpass API + OSRM driving distances — 7 Oct 2026
const KNOWN_IN_ZONE_AREAS = [
  // ── Zone 1 (0–4 km, MOQ 2 kg) ──
  { pattern: /\b(?:mala\s*bagh|malabagh|mallabagh|malla\s*bagh)\b/i, name: "Malabagh", dist: 0.2 },
  { pattern: /\b(?:naseem\s*bagh|nasim\s*bagh|nasimbagh|naseembagh|nasim\s*garden)\b/i, name: "Naseem Bagh", dist: 0.3 },
  { pattern: /\b(?:mirza\s*bagh|mirzabagh)\b/i, name: "Mirza Bagh", dist: 0.5 },
  { pattern: /\b(?:hafiz\s*bagh|hafizabagh)\b/i, name: "Hafiz Bagh", dist: 0.7 },
  { pattern: /\b(?:baghati\s*shoora)\b/i, name: "Baghati Shoora", dist: 1.0 },
  { pattern: /\b(?:shah\s*faisal\s*colony)\b/i, name: "Shah Faisal Colony", dist: 1.1 },
  { pattern: /\b(?:tajdar\s*colony)\b/i, name: "Tajdar Colony", dist: 1.2 },
  { pattern: /\b(?:hamza\s*colony)\b/i, name: "Hamza Colony", dist: 1.2 },
  { pattern: /\b(?:awanta\s*bhawan)\b/i, name: "Awanta Bhawan", dist: 1.3 },
  { pattern: /\b(?:shahi\s*mohalla)\b/i, name: "Shahi Mohalla", dist: 1.4 },
  { pattern: /\b(?:zakura|zakoora|zakoor)\b/i, name: "Zakura", dist: 1.4 },
  { pattern: /\b(?:illahi\s*bagh|illahibagh|ellahi\s*bagh|ellahibagh|elahi\s*bagh|elahibagh)\b/i, name: "Illahi Bagh", dist: 1.5 },
  { pattern: /\b(?:90\s*feet|90ft|ninety\s*feet)\b/i, name: "90 Feet Road", dist: 1.6 },
  { pattern: /\b(?:botshah\s*mohalla|botsha\s*mohalla)\b/i, name: "Botshah Mohalla", dist: 1.7 },
  { pattern: /\b(?:sadrebal|saderbal|sadrabal|sadr\s*bal)\b/i, name: "Sadrebal", dist: 1.7 },
  { pattern: /\b(?:sikh\s*bagh|sikhbagh)\b/i, name: "Sikh Bagh", dist: 1.8 },
  { pattern: /\b(?:bismillah\s*colony)\b/i, name: "Bismillah Colony", dist: 1.8 },
  { pattern: /\b(?:habak|habbak|habback)\b/i, name: "Habak", dist: 1.8 },
  { pattern: /\b(?:bhat\s*mohalla)\b/i, name: "Bhat Mohalla", dist: 1.9 },
  { pattern: /\b(?:green\s*avenue|al[\s\-]huda\s*colony|gulshan\s*nagar)\b/i, name: "Malabagh Extensions", dist: 0.8 },
  { pattern: /\b(?:tawheed\s*abad|tawheedabad)\b/i, name: "Tawheed Abad", dist: 2.0 },
  { pattern: /\b(?:noorabad|noor\s*abad)\b/i, name: "Noorabad", dist: 2.0 },
  { pattern: /\b(?:lal\s*bazar|lalbazar|molvi\s*stop)\b/i, name: "Lal Bazar", dist: 2.0 },
  { pattern: /\b(?:rangpura|rang\s*pura|rangpora)\b/i, name: "Rangpura", dist: 2.0 },
  { pattern: /\b(?:ahmad\s*nagar|ahmed\s*nagar)\b/i, name: "Ahmad Nagar", dist: 2.0 },
  { pattern: /\b(?:kashmir\s*university|ku\s*campus|university\s*campus)\b/i, name: "Kashmir University", dist: 2.0 },
  { pattern: /\b(?:upper\s*soura)\b/i, name: "Upper Soura", dist: 2.1 },
  { pattern: /\b(?:bachpora|buchpora|bach\s*pora|buch\s*pora)\b/i, name: "Buchpora", dist: 2.1 },
  { pattern: /\b(?:hazrat\s*bal|hazratbal|dargah|sir\s*syed\s*market)\b/i, name: "Hazratbal", dist: 2.2 },
  { pattern: /\b(?:soura|skims)\b/i, name: "Soura", dist: 2.2 },
  { pattern: /\b(?:vicharnag|vichar\s*nag)\b/i, name: "Vicharnag", dist: 2.2 },
  { pattern: /\b(?:umer\s*colony|omar\s*colony)\b/i, name: "Umer Colony", dist: 2.2 },
  { pattern: /\b(?:usman\s*colony)\b/i, name: "Usman Colony", dist: 2.2 },
  { pattern: /\b(?:shah\s*hamdan\s*colony)\b/i, name: "Shah Hamdan Colony", dist: 2.2 },
  { pattern: /\b(?:gulberg\s*colony)\b/i, name: "Gulberg Colony", dist: 2.2 },
  { pattern: /\b(?:bilal\s*colony)\b/i, name: "Bilal Colony", dist: 2.2 },
  { pattern: /\b(?:mandibal|mandi\s*bal)\b/i, name: "Mandibal", dist: 2.3 },
  { pattern: /\b(?:now\s*shera|nowshera)\b/i, name: "Nowshera", dist: 2.4 },
  { pattern: /\b(?:zaari\s*mohalla)\b/i, name: "Zaari Mohalla", dist: 2.4 },
  { pattern: /\b(?:usman\s*abad|usmanabad)\b/i, name: "Usman Abad", dist: 2.4 },
  { pattern: /\b(?:anchar)\b/i, name: "Anchar", dist: 2.5 },
  { pattern: /\b(?:bakhshi\s*pora|bakshipora)\b/i, name: "Bakhshi Pora", dist: 2.5 },
  { pattern: /\b(?:mustafa\s*abad|mustafaabad)\b/i, name: "Mustafa-abad", dist: 2.5 },
  { pattern: /\b(?:batapora|bata\s*pora)\b/i, name: "Batapora", dist: 2.6 },
  { pattern: /\b(?:bohlochipora|bohlochi\s*pora)\b/i, name: "Bohlochipora", dist: 2.6 },
  { pattern: /\b(?:sarfaraz\s*colony)\b/i, name: "Sarfaraz Colony", dist: 2.7 },
  { pattern: /\b(?:baghwanpora|baghwan\s*pora)\b/i, name: "Baghwanpora", dist: 2.7 },
  { pattern: /\b(?:nigeen|nagin|nagin\s*lake)\b/i, name: "Nigeen", dist: 2.8 },
  { pattern: /\b(?:kanitar)\b/i, name: "Kanitar", dist: 2.8 },
  { pattern: /\b(?:gousia\s*colony|gousha\s*colony)\b/i, name: "Gousia Colony", dist: 2.8 },
  { pattern: /\b(?:nalabal|nala\s*bal)\b/i, name: "Nalabal", dist: 2.8 },
  { pattern: /\b(?:bagh\s*ali\s*mardan(?:\s*khan)?|ali\s*mardan\s*khan)\b/i, name: "Bagh Ali Mardan Khan", dist: 2.9 },
  { pattern: /\b(?:pathan\s*colony)\b/i, name: "Pathan Colony", dist: 3.0 },
  { pattern: /\b(?:bagh[\s\-]?i[\s\-]?usman|baghi\s*usman)\b/i, name: "Bagh-i-Usman Colony", dist: 3.3 },
  { pattern: /\b(?:zoonimar|zooni\s*mar)\b/i, name: "Zoonimar", dist: 3.3 },
  { pattern: /\b(?:tailbal|teilbal|habak\s*shanpora)\b/i, name: "Tailbal", dist: 3.3 },
  { pattern: /\b(?:bota\s*kadal|botakadal)\b/i, name: "Botakadal", dist: 3.6 },
  { pattern: /\b(?:ashaie?\s*bagh)\b/i, name: "Ashaie Bagh", dist: 3.8 },
  { pattern: /\b(?:braiwar|braiwer)\b/i, name: "Braiwar", dist: 3.8 },
  // ── Zone 2 (4–7 km, MOQ 3 kg for Free Delivery, 2 kg has ₹55 fee) ──
  { pattern: /\b(?:gassu)\b/i, name: "Gassu", dist: 5.8 },
  { pattern: /\b(?:zadibal)\b/i, name: "Zadibal", dist: 4.3 },
  { pattern: /\b(?:badamwari|badam\s*wari)\b/i, name: "Badamwari", dist: 4.2 },
  { pattern: /\b(?:madin\s*sahib)\b/i, name: "Madin Sahib", dist: 4.2 },
  { pattern: /\b(?:alamgari\s*bazar|alamgaribazar)\b/i, name: "Alamgari Bazar", dist: 4.3 },
  { pattern: /\b(?:nagbal)\b/i, name: "Nagbal", dist: 4.3 },
  { pattern: /\b(?:saida\s*kadal|saidakadal)\b/i, name: "Saida Kadal", dist: 4.3 },
  { pattern: /\b(?:burzuhama|burzahama|burza\s*hama)\b/i, name: "Burzahama", dist: 4.3 },
  { pattern: /\b(?:mirak\s*shah\s*colony)\b/i, name: "Mirak Shah Colony", dist: 4.4 },
  { pattern: /\b(?:danmar|dan\s*mar)\b/i, name: "Danmar", dist: 4.4 },
  { pattern: /\b(?:kathi\s*darwaza|kati\s*darwaza)\b/i, name: "Kathi Darwaza", dist: 4.5 },
  { pattern: /\b(?:said\s*pora|saidpora)\b/i, name: "Said Pora", dist: 4.5 },
  { pattern: /\b(?:hawal)\b/i, name: "Hawal", dist: 4.6 },
  { pattern: /\b(?:pandach|pandath|pandacha)\b/i, name: "Pandach", dist: 4.6 },
  { pattern: /\b(?:alusteng|alustang|aloo\s*steng)\b/i, name: "Alusteng", dist: 4.6 },
  { pattern: /\b(?:eidgah|idgah|eid\s*gah|aali\s*masjid)\b/i, name: "Eidgah", dist: 4.6 },
  { pattern: /\b(?:bakura)\b/i, name: "Bakura", dist: 4.8 },
  { pattern: /\b(?:gojwara|goj\s*wara)\b/i, name: "Gojwara", dist: 5.0 },
  { pattern: /\b(?:g(?:h)?ulab\s*bagh|g(?:h)?ulabbagh|g(?:h)?ulab\s*garden)\b/i, name: "Gulab Bagh", dist: 5.0 },
  { pattern: /\b(?:shuhama)\b/i, name: "Shuhama", dist: 5.0 },
  { pattern: /\b(?:rakh\s*harran|rakh\s*haran)\b/i, name: "Rakh Harran", dist: 5.0 },
  { pattern: /\b(?:sangam)\b/i, name: "Sangam", dist: 5.1 },
  { pattern: /\b(?:nowhat+a?|nowat+a?|nau\s*hat+a?|nohata?)\b/i, name: "Nowhatta", dist: 5.3 },
  { pattern: /\b(?:safakadal|safa\s*kadal|sufakadal)\b/i, name: "Safakadal", dist: 5.4 },
  { pattern: /\b(?:rainawari|raina\s*wari|reinawari|ranvara|ranwara|ranawari|ranavari)\b/i, name: "Rainawari", dist: 5.4 },
  { pattern: /\b(?:khanyar|khan\s*yar)\b/i, name: "Khanyar", dist: 5.5 },
  { pattern: /\b(?:shalimar|shalimar\s*bagh|shalimar\s*garden)\b/i, name: "Shalimar", dist: 5.5 },
  { pattern: /\b(?:mulphaq)\b/i, name: "Mulphaq", dist: 5.5 },
  { pattern: /\b(?:ali\s*kadal|ali\s*kadel|alikadal)\b/i, name: "Ali Kadal", dist: 5.8 },
  { pattern: /\b(?:rajouri\s*kadal|rajourikadal|rajouri\s*kadel)\b/i, name: "Rajouri Kadal", dist: 6.2 },
  { pattern: /\b(?:saraf\s*kadal|sarafkadal)\b/i, name: "Saraf Kadal", dist: 6.5 },
  { pattern: /\b(?:bohri\s*kadal|bohrikadal|bhori\s*kadal|bhorikadal)\b/i, name: "Bohri Kadal", dist: 6.8 },
  { pattern: /\b(?:khalamul)\b/i, name: "Khalamul", dist: 5.9 },
  // ── Zone 3: Central & City Srinagar (7.0 to 11.5 km, Free Delivery on 3 kg+, 2 kg +₹89 fee / 1 kg +₹130 fee) ──
  { pattern: /\b(?:zaina\s*kadal|zainakadal|zaina\s*kadel|new\s*zaina\s*kadal)\b/i, name: "Zaina Kadal", dist: 7.8, minKg: 3 },
  { pattern: /\b(?:maharaj\s*gunj|maharajgunj|maharaj\s*ganj|maharajganj)\b/i, name: "Maharaj Gunj", dist: 7.8, minKg: 3 },
  { pattern: /\b(?:fateh\s*kadal|fatehkadal|fateh\s*kadel|fatehkadel|astaan\s*syed\s*ali\s*akbar)\b/i, name: "Fateh Kadal", dist: 8.8, minKg: 3 },
  { pattern: /\b(?:habba\s*kadal|habbakadal|habba\s*kadel)\b/i, name: "Habba Kadal", dist: 9.0, minKg: 3 },
  { pattern: /\b(?:karan\s*nagar|karannagar)\b/i, name: "Karan Nagar", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:dalgate|dal\s*gate)\b/i, name: "Dalgate", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:khay+am|khyam|khaiam)(?:\s*(?:chowk|road|cinema))?\b/i, name: "Khayam", dist: 8.5, minKg: 3 },
  { pattern: /\b(?:khyber\s*(?:hospital|medical|institute)|hospital\s*khyber)\b/i, name: "Khayam", dist: 8.5, minKg: 3 },
  { pattern: /\b(?:qamarwari|qamar\s*wari|kamarwari)\b/i, name: "Qamarwari", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:balgarden|bal\s*garden)\b/i, name: "Balgarden", dist: 9.8, minKg: 3 },
  { pattern: /\b(?:nishat)\b/i, name: "Nishat", dist: 8.4, minKg: 3 },
  { pattern: /\b(?:brein(?:\s*nishat)?|brain\s*nishat)\b/i, name: "Brein (Nishat)", dist: 11.2, minKg: 3 },
  { pattern: /\b(?:beehama|bihama|bee\s*hama)\b/i, name: "Beehama (Ganderbal)", dist: 10.9, minKg: 3 },
  { pattern: /\b(?:qamaria|qamaria\s*ground|qamaria\s*park)\b/i, name: "Qamaria (Ganderbal)", dist: 11.0, minKg: 3 },
  { pattern: /\b(?:parimpora(?:\s*fruit\s*mandi)?|parim\s*pora(?:\s*fruit\s*mandi)?|fruit\s*mandi(?:\s*parimpora)?)\b/i, name: "Parimpora", dist: 11.4, minKg: 3 },

  // ── Zone 4: South Srinagar, Outer Corridor & In-Range Ganderbal (11.5 to 16.0 km, Free Delivery on 5 kg+, 2–4 kg 70/30 Split, 1 kg Full Fee ₹190) ──
  { pattern: /\b(?:wayil|wayil\s*bridge|wail\s*bridge)\b/i, name: "Wayil (Ganderbal)", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:manigam|mani\s*gam)\b/i, name: "Manigam (Ganderbal)", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:duderhama|dudurhama|dudarhama|duder\s*hama)\b/i, name: "Duderhama (Ganderbal)", dist: 12.3, minKg: 5 },
  { pattern: /\b(?:saloora|salora)\b/i, name: "Saloora (Ganderbal)", dist: 13.3, minKg: 5 },
  { pattern: /\b(?:kurhama)\b/i, name: "Kurhama (Ganderbal)", dist: 14.1, minKg: 5 },
  { pattern: /\b(?:barsoo|barsoo\s*ganderbal)\b/i, name: "Barsoo (Ganderbal)", dist: 15.5, minKg: 5 },
  { pattern: /\b(?:ganderbal|ganderbal\s*town|ganderbal\s*chowk|dc\s*office\s*ganderbal|ganderbal\s*market)\b/i, name: "Ganderbal Town", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:tulip\s*garden|cheshmashahi|chashmashahi|chashma\s*shahi|botanical\s*garden)\b/i, name: "Tulip Garden", dist: 13.5, minKg: 5 },
  { pattern: /\b(?:baghat\s*barzulla|baghat)\b/i, name: "Baghat Barzulla", dist: 15.0, minKg: 5 },
  { pattern: /\b(?:barzulla|old\s*barzulla)\b/i, name: "Barzulla", dist: 14.2, minKg: 5 },
  { pattern: /\b(?:solina|rambagh|ram\s*bagh)\b/i, name: "Rambagh/Solina", dist: 14.3, minKg: 5 },
  { pattern: /\b(?:gogji\s*bagh|gogjibagh)\b/i, name: "Gogji Bagh", dist: 13.6, minKg: 5 },
  { pattern: /\b(?:wazir\s*bagh|wazirbagh)\b/i, name: "Wazir Bagh", dist: 12.7, minKg: 5 },
  { pattern: /\b(?:tulsi\s*bagh|tulsibagh)\b/i, name: "Tulsi Bagh", dist: 13.0, minKg: 5 },
  { pattern: /\b(?:hazuri\s*bagh|hazuribagh)\b/i, name: "Hazuri Bagh", dist: 12.0, minKg: 5 },
  { pattern: /\b(?:iqbal\s*park)\b/i, name: "Iqbal Park", dist: 12.5, minKg: 5 },
  { pattern: /\b(?:sonwar|sonawar|sona\s*war)\b/i, name: "Sonwar", dist: 12.9, minKg: 5 },
  { pattern: /\b(?:batamaloo|batmaloo)\b/i, name: "Batamaloo", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:bemina)\b/i, name: "Bemina", dist: 12.5, minKg: 5 },
  { pattern: /\b(?:raj\s*bagh|rajbagh)\b/i, name: "Rajbagh", dist: 12.0, minKg: 5 },
  { pattern: /\b(?:jawahar\s*nagar|jawaharnagar)\b/i, name: "Jawahar Nagar", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:lal\s*chowk|lalchowk|residency\s*road|regent\s*cinema|poloview|polo\s*view)\b/i, name: "Lal Chowk", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:al[olu]+chi\s*bagh|al[olu]+chi|elachi\s*bagh)\b/i, name: "Alochi Bagh", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:magarmal\s*bagh|magarmal)\b/i, name: "Magarmal Bagh", dist: 11.6, minKg: 5 },
  { pattern: /\b(?:sanat\s*nagar|sanatnagar|sanat\s*ghar)\b/i, name: "Sanat Nagar", dist: 13.5, minKg: 5 },
  { pattern: /\b(?:rawalpora|rawapora)\b/i, name: "Rawalpora", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:hyder|haider|huder|hadir|heydar)\s*pora\b/i, name: "Hyderpora", dist: 14.5, minKg: 5 },
  { pattern: /\b(?:chanapora|chanpora)\b/i, name: "Chanapora", dist: 13.0, minKg: 5 },
  { pattern: /\b(?:natipora)\b/i, name: "Natipora", dist: 12.5, minKg: 5 },
  { pattern: /\b(?:peerbagh|peer\s*bagh|pirbagh|pir\s*bagh)\b/i, name: "Peerbagh", dist: 14.5, minKg: 5 },
  { pattern: /\b(?:airport\s*road|humhama|srinagar\s*airport|sheikh\s*ul\s*alam\s*airport)\b/i, name: "Airport Road / Humhama", dist: 15.0, minKg: 5 },
  { pattern: /\b(?:bagh[- ]e[- ]mehtab|baghi\s*mehtab)\b/i, name: "Bagh-e-Mehtab", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:kralpora|kral\s*pora)\b/i, name: "Kralpora", dist: 15.5, minKg: 5 },
  { pattern: /\b(?:rangreth)\b/i, name: "Rangreth", dist: 15.5, minKg: 5 },
  { pattern: /\b(?:lasjan|lassjan|lasjan\s*bypass)\b/i, name: "Lasjan", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:nowgam|naugaon|nowgham|nowgam\s*bypass)\b/i, name: "Nowgam", dist: 14.5, minKg: 5 },
  { pattern: /\b(?:padshahi\s*bagh|padshahibagh)\b/i, name: "Padshahi Bagh", dist: 13.0, minKg: 5 },
  { pattern: /\b(?:pantha\s*chowk|panthachowk)\b/i, name: "Pantha Chowk", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:soiteng|suiteng|soitang)\b/i, name: "Soiteng", dist: 13.5, minKg: 5 },
  { pattern: /\b(?:pandrathan)\b/i, name: "Pandrathan", dist: 13.0, minKg: 5 },
  { pattern: /\b(?:athwajan)\b/i, name: "Athwajan", dist: 13.5, minKg: 5 },
  { pattern: /\b(?:pohru|pohroo)\b/i, name: "Pohru", dist: 15.0, minKg: 5 },
  { pattern: /\b(?:mochu|moochu)\b/i, name: "Mochu", dist: 15.0, minKg: 5 },
  { pattern: /\b(?:umerabad|umarabad|umer\s*abad)\b/i, name: "Umerabad", dist: 12.8, minKg: 5 }
];

const KNOWN_OUT_ZONE_AREAS = [
  // ── Beyond 16 km / Outer Districts (Store Walk-in Only) ──
  { pattern: /\b(?:kangan|gund|sonamarg|wangath|safapora|manasbal|tullamulla|tulmulla|nunar|wussan)\b/i, name: "Outer Ganderbal (>16 km: Kangan/Tullamulla/Safapora)" },
  { pattern: /\b(?:bagati\s*kanipora|b\.?k\.?\s*pora|bk\s*pora|kanipora\s*budgam|kanipora)\b/i, name: "Bagati Kanipora (BK Pora)" },
  { pattern: /\b(?:pampore)\b/i, name: "Pampore" },
  { pattern: /\b(?:chadoora|chadure)\b/i, name: "Chadoora" },
  { pattern: /\b(?:lawaypora|lawapora|laway\s*pora|lawa\s*pora)\b/i, name: "Lawaypora" },

  { pattern: /\b(?:harwan)\b/i, name: "Harwan" },
  { pattern: /\b(?:budgam)\b/i, name: "Budgam" },
  { pattern: /\b(?:ompora)\b/i, name: "Ompora" },
  { pattern: /\b(?:narbal|soibugh|magam|beerwah)\b/i, name: "Narbal/Magam" },
  { pattern: /\b(?:baramulla)\b/i, name: "Baramulla" },
  { pattern: /\b(?:anantnag|pulwama|awantipora|sopore|kulgam|shopian)\b/i, name: "Outer Kashmir Districts" },
  { pattern: /\b(?:jammu)\b/i, name: "Jammu" }
];

// ── Multi-Tier Geolocation Intelligence: Local DBs + Google Maps API ──
const customAreasPath = path.join(__dirname, "custom_areas.json");
let customAreas = {};
try {
  if (fs.existsSync(customAreasPath)) {
    customAreas = JSON.parse(fs.readFileSync(customAreasPath, "utf-8"));
  }
} catch (e) {
  console.error("Error reading custom_areas.json:", e.message);
}

const deliveryZoneDbPath = path.join(__dirname, "delivery_zone_db.json");
let deliveryZoneDb = [];
try {
  if (fs.existsSync(deliveryZoneDbPath)) {
    deliveryZoneDb = JSON.parse(fs.readFileSync(deliveryZoneDbPath, "utf-8"));
    console.log(`[Zone DB] Loaded ${deliveryZoneDb.length} Srinagar landmarks and places.`);
  }
} catch (e) {
  console.error("Error reading delivery_zone_db.json:", e.message);
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

function normalizeCustomerText(input = "") {
  if (!input) return "";
  return String(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isSyntheticSystemNote(text = "") {
  return /^\[(?:Customer shared location|Customer sent|GPS PIN)/i.test(String(text || "").trim());
}

function isMalabaghStoreReference(text = "") {
  const s = normalizeCustomerText(text);
  if (!s || !/\bma+l+a+bagh\b/i.test(s)) return false;
  if (isSyntheticSystemNote(s)) return true;
  if (/\b(?:recirculatory\s*aquaculture\s*system|aquaculture\s*system|ras\s*(?:facility|system|plant|unit)?|harvested\s+(?:live\s+)?(?:to\s+order\s+)?(?:at|from)|km\s+from)\b[^.!?\n]*\bma+l+a+bagh\b/i.test(s)) {
    return true;
  }
  if (/\b(?:deliver(?:y)?\s*(?:to|at|in|near)|dispatch\s*(?:to|at|in|near)|send\s*(?:to|at|in|near)|i\s*(?:live|stay|am\s*(?:in|at|from)))\s*ma+l+a+bagh\b/i.test(s)) {
    return false;
  }
  return /\b(?:ma+l+a+bagh\s*(?:farm|counter|vending|center|centre|store|shop|outlet|timing|timings|hours|open|close|closing|opening|location|address|map|pickup|pick\s*up)|(?:live\s*vending\s*center|farm|counter|store|shop|outlet|visit|come\s*to|collect\s*(?:from|at)|pick\s*(?:up\s*)?(?:from|at)|self\s*pick\s*up|timings?|hours)\b[^.!?\n]*\bma+l+a+bagh|ma+l+a+bagh\b[^.!?\n]*\b(?:timings?|hours|open|closed|farm|counter|vending|center|centre|store|shop|pickup|visit|collect))\b/i.test(s);
}

const GENERIC_LANDMARK_NAME_RE = /^(?:police\s*station|hospital|dispensary|masjid|mosque|bank|(?:j&k|jk|sbi|hdfc|axis|icici|pnb)\s*bank|indian\s*oil|chowk|bridge|kadal|school|college|gate|petrol\s*pump|post\s*office|complex|shopping\s*complex|bazar|bazaar|market|stop|stand)$/i;

function matchPlaceNameBoundary(name, cleanText) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const startBoundary = /^\w/.test(name) ? "\\b" : "(?:^|[^a-zA-Z0-9])";
  const endBoundary = /\w$/.test(name) ? "\\b" : "(?:$|[^a-zA-Z0-9])";
  return new RegExp(`${startBoundary}${esc}${endBoundary}`, "i").test(cleanText);
}

function detectSrinagarLocality(text) {
  if (!text) return null;
  const cleanText = normalizeCustomerText(text);
  const ignoreMalabaghStore = isMalabaghStoreReference(cleanText);

  // 1. High-priority hardcoded localities
  for (const item of KNOWN_IN_ZONE_AREAS) {
    if (ignoreMalabaghStore && /^malabagh$/i.test(item.name)) continue;
    if (item.pattern.test(cleanText)) {
      const minKg = item.minKg || (item.dist <= 4.0 ? 2 : item.dist <= 11.5 ? 3 : 5);
      const tier = item.dist <= 4.0 ? "0-4km" : item.dist <= 7.0 ? "4-7km" : item.dist <= 11.5 ? "7-11.5km" : "11.5-16km";
      return { status: "IN_ZONE", name: item.name, dist: item.dist, minKg, tier };
    }
  }

  // 2. Custom & auto-discovered colonies (custom_areas.json)
  for (const [cName, cData] of Object.entries(customAreas)) {
    if (/^(?:srinagar|kashmir|india)$/i.test(cName.trim())) continue;
    if (ignoreMalabaghStore && /^ma+l+a+bagh$/i.test(cName.trim())) continue;
    if (GENERIC_LANDMARK_NAME_RE.test(cName.trim())) continue;
    if (matchPlaceNameBoundary(cName, cleanText)) {
      const dist = cData.dist;
      const minKg = dist <= 4.0 ? 2 : dist <= 11.5 ? 3 : 5;
      const tier = dist <= 4.0 ? "0-4km" : dist <= 7.0 ? "4-7km" : dist <= 11.5 ? "7-11.5km" : dist <= 16.0 ? "11.5-16km" : "Beyond-16km";
      const status = dist <= 16.0 ? "IN_ZONE" : "OUT_ZONE";
      return { status, name: cName, dist, minKg, tier };
    }
  }

  // 3. Known out-of-zone areas BEFORE generic landmark DB so "Near J&K Bank, Pampore" stays OUT_ZONE
  for (const item of KNOWN_OUT_ZONE_AREAS) {
    if (item.pattern.test(cleanText)) {
      return { status: "OUT_ZONE", name: item.name };
    }
  }

  // 4. Srinagar places and landmarks (delivery_zone_db.json) — exclude generic POIs/banks/mosques
  if (deliveryZoneDb && deliveryZoneDb.length > 0) {
    for (const place of deliveryZoneDb) {
      if (!place.name || place.name.length < 4) continue;
      const trimmedPlace = place.name.trim();
      if (ignoreMalabaghStore && /^ma+l+a+bagh$/i.test(trimmedPlace)) continue;
      if (GENERIC_LANDMARK_NAME_RE.test(trimmedPlace)) continue;
      if (matchPlaceNameBoundary(trimmedPlace, cleanText)) {
        const dist = (place.driving_km != null && !isNaN(place.driving_km))
          ? parseFloat(Number(place.driving_km).toFixed(1))
          : (place.lat != null && place.lon != null)
            ? parseFloat(calculateDistance(FARM_LAT, FARM_LNG, place.lat, place.lon).toFixed(1))
            : parseFloat(place.distance_km.toFixed(1));
        const minKg = dist <= 4.0 ? 2 : dist <= 11.5 ? 3 : 5;
        const tier = dist <= 4.0 ? "0-4km" : dist <= 7.0 ? "4-7km" : dist <= 11.5 ? "7-11.5km" : dist <= 16.0 ? "11.5-16km" : "Beyond-16km";
        const status = dist <= 16.0 ? "IN_ZONE" : "OUT_ZONE";
        return { status, name: place.name, dist, minKg, tier };
      }
    }
  }

  // 5. Srinagar & Ganderbal PIN code fallback (checked only when no named locality matched)
  const pinMatch = cleanText.match(/\b(190\d{3}|191[12]01|191121|191131)\b/);
  if (pinMatch) {
    const SRINAGAR_PINCODE_MAP = {
      "190001": "Lal Chowk",
      "190002": "Maharaj Gunj",
      "190003": "Rainawari",
      "190004": "Nishat",
      "190005": "Sanat Nagar",
      "190006": "Hazratbal",
      "190008": "Jawahar Nagar",
      "190009": "Bemina",
      "190010": "Batamaloo",
      "190011": "Soura",
      "190012": "HMT",
      "190014": "Chanapora",
      "190015": "Pantha Chowk",
      "190017": "Parimpora",
      "190019": "Shalimar",
      "190020": "Nowgam",
      "190021": "Humhama",
      "190025": "Eidgah",
      "191121": "Ganderbal Town",
      "191131": "Wayil",
      "191201": "Ganderbal Town"
    };
    const mappedLocality = SRINAGAR_PINCODE_MAP[pinMatch[1]];
    if (mappedLocality) {
      return detectSrinagarLocality(mappedLocality);
    }
  }
  return null;
}

// ─── COLONY-LEVEL REAL-TIME LEARNING ENGINE ───
// Autonomous runtime learning from WhatsApp is disabled per owner mandate.
// All business logic, custom colonies, and directives are curated strictly in Antigravity.
function autoLearnColonyFromLocation() {
  return null;
}

// Asynchronous Geocoding Engine (Google Maps API + OpenStreetMap Nominatim Fallback)
async function geocodeAddressWithGoogle(query) {
  if (!GOOGLE_MAPS_API_KEY) return null;
  const suffix = /ganderbal/i.test(query) ? ", Ganderbal, Kashmir" : ", Srinagar, Kashmir";
  return new Promise((resolve) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + suffix)}&key=${GOOGLE_MAPS_API_KEY}`;
    const req = https.get(url, { timeout: 3500 }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.status === "OK" && json.results && json.results[0]) {
            const loc = json.results[0].geometry.location;
            return resolve({
              source: "GoogleMaps",
              name: json.results[0].formatted_address.split(",")[0],
              lat: loc.lat,
              lng: loc.lng
            });
          }
        } catch {}
        resolve(null);
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

async function geocodeAddressWithNominatim(query) {
  const suffix = /ganderbal/i.test(query) ? ", Ganderbal" : ", Srinagar";
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + suffix)}&format=json&limit=1`;
    const req = https.get(url, { headers: { "User-Agent": "UrbanTroutDeliveryBot/1.0" }, timeout: 3500 }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json && json[0] && json[0].lat && json[0].lon) {
            return resolve({
              source: "Nominatim",
              name: json[0].display_name.split(",")[0],
              lat: parseFloat(json[0].lat),
              lng: parseFloat(json[0].lon)
            });
          }
        } catch {}
        resolve(null);
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}


// In-Memory Geocoding Cache & Address Intent Filter to eliminate 5-10s network lag
const geoCache = new Map();

function hasAddressIndicator(text) {
  if (!text || text.length < 3 || text.length > 180) return false;
  const lower = text.toLowerCase().trim();
  // Filter out general conversation, pricing, greetings, reorders
  if (/^(?:hi|hello|hey|salam|salaam|price|rate|rates|trout|fish|available|today|order|clean|cleaned|gutted|whole|yes|no|ok|haan|ha|ji|repeat|same|wahi|send|bhej|bhejo|book|kardo|how much|kya rate|kitna)[!.,\s]*$/i.test(lower)) {
    return false;
  }
  return /\b(?:near|opp|opposite|behind|beside|road|lane|street|sector|colony|enclave|bazar|chowk|mohalla|kadal|bridge|hospital|school|college|gate|complex|residency|address|location|delivery\s*to)\b|[a-z]{3,}(?:nagar|bagh|pora|wari|kadal|abad)\b/i.test(lower);
}

async function resolveUnknownLocalityWithApi(text) {
  if (!text) return null;
  const cacheKey = text.trim().toLowerCase().slice(0, 200);
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey);
  if (geoCache.size > 500) geoCache.clear();

  let candidate = text.trim();

  // Strip phone numbers (including +91 prefix) from candidate query
  candidate = candidate.replace(/(?:^|\s)(?:\+?91[\s\-]?)?[6-9]\d{9}\b/g, " ").trim();

  // Only strip leading command prefixes like "delivery to:", "address is:", "location is:" at the start of text
  candidate = candidate.replace(/^(?:delivery\s*(?:to|is|address)?|address\s*is|location\s*is|my\s*(?:address|location)\s*is)\s*[:\-–—]?\s*/i, "").trim();

  // Strip explicit order weights with required units only (preserves "Sector 4", "90 Feet Road")
  candidate = candidate.replace(/[,]?\s*\d+(?:\.\d+)?\s*(?:kg|kgs|kilo|kilos|gm|grams?)\b/gi, "").trim();
  candidate = candidate.replace(/\b(?:cleaned|gutted|whole|fresh|steaks|fish|trout|pieces|order|pack)\b/gi, "").trim();

  // Strip conversational slang, speed pleas, pleasantries, and connecting words
  const conversationalStopwords = /\b(?:lekin|lkin|magar|aur|and|ya|or|jddi|jldi|jaldi|fast|faster|express|urgent|urgently|asap|quick|quickly|speed|plz|please|bhejo|bhejna|send|deliver|delivery|karo|kardo|do|de\s*do|chahiye|need|want|bhai|bhaiya|sir|madam|shukriya|thanks|thank\s*you|ok|theek|sahi|ha|haan|yes|no|nahi|bro|yaar)\b/gi;
  candidate = candidate.replace(conversationalStopwords, "").trim();
  candidate = candidate.replace(/^[,\s\-–—.!?;:]+|[,\s\-–—.!?;:]+$/g, "").trim();

  if (candidate.length < 3 || /^[\d\s\-–—.,!?:;]+$/.test(candidate)) {
    return null;
  }
  if (/^(?:hi|hello|salam|price|rate|rates|order|clean|cleaned|gutted|whole|fish|trout|yes|no|ok|kilo|kg)$/i.test(candidate)) {
    return null;
  }
  if (GENERIC_LANDMARK_NAME_RE.test(candidate)) {
    return null;
  }

  let geo = await geocodeAddressWithGoogle(candidate);
  if (!geo) {
    geo = await geocodeAddressWithNominatim(candidate);
  }

  if (geo && geo.lat && geo.lng) {
    const liveRoadDist = await fetchLiveRoadDistance(geo.lat, geo.lng);
    const dist = (liveRoadDist != null && !isNaN(liveRoadDist)) ? liveRoadDist : calculateDistance(FARM_LAT, FARM_LNG, geo.lat, geo.lng);
    const distRounded = parseFloat(dist.toFixed(1));
    const minKg = distRounded <= 4.0 ? 2 : distRounded <= 11.5 ? 3 : 5;
    const tier = distRounded <= 4.0 ? "0-4km" : distRounded <= 7.0 ? "4-7km" : distRounded <= 11.5 ? "7-11.5km" : distRounded <= 16.0 ? "11.5-16km" : "Beyond-16km";
    const status = distRounded <= 16.0 ? "IN_ZONE" : "OUT_ZONE";
    const locResult = { status, name: geo.name || candidate, dist: distRounded, minKg, tier, source: geo.source };

    geoCache.set(cacheKey, locResult);
    return locResult;
  }
  geoCache.set(cacheKey, null);
  return null;
}

// Persistent conversation history across restarts (last 10 turns per customer)
const historiesFilePath = path.join(__dirname, "chat_histories.json");
const chatHistories = new Map();

function loadChatHistories() {
  try {
    if (fs.existsSync(historiesFilePath)) {
      const data = JSON.parse(fs.readFileSync(historiesFilePath, "utf-8"));
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) {
          chatHistories.set(k, v);
        }
      }
      console.log(`[Chat History] Loaded active conversations for ${chatHistories.size} chats from disk.`);
    }
  } catch (e) {
    console.error("Error reading chat_histories.json:", e.message);
  }
}
loadChatHistories();

function saveChatHistories() {
  const obj = {};
  for (const [k, v] of chatHistories.entries()) {
    obj[k] = v;
  }
  const payload = JSON.stringify(obj);
  const tmpPath = `${historiesFilePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, payload, "utf-8");
    fs.renameSync(tmpPath, historiesFilePath);
  } catch (e) {
    try {
      fs.writeFileSync(historiesFilePath, payload, "utf-8");
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (fallbackErr) {
      console.error("Error writing chat_histories.json:", fallbackErr.message || e.message);
    }
  }
}

const dailyArchiveBaseDir = path.join(__dirname, "daily_chat_archive");
function appendDailyChatLog({ jid = "", phone = "", name = "", role = "customer", text = "", meta = null }) {
  try {
    if (!text && !meta) return;
    if (!fs.existsSync(dailyArchiveBaseDir)) fs.mkdirSync(dailyArchiveBaseDir, { recursive: true });
    const now = new Date();
    const dateKey = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const istTime = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    const logPath = path.join(dailyArchiveBaseDir, `${dateKey}.jsonl`);
    const record = {
      ts: now.toLocaleString ? now.toISOString() : new Date().toISOString(),
      istTime,
      jid,
      phone: phone || "",
      name: name || "",
      role,
      text: String(text || "").slice(0, 2000),
      ...(meta ? { meta } : {})
    };
    fs.appendFileSync(logPath, JSON.stringify(record) + "\n", "utf8");
  } catch (_) {}
}

// Clean customer names and informal honorifics so sales agent NEVER calls customer by personal name
/** Returns IST time-of-day greeting (Morning 5-12, Afternoon 12-16, Evening 16+). */
function getTimeOfDayGreetingIst(hourOverride = null) {
  let hour;
  const isEmpty =
    hourOverride === null ||
    hourOverride === undefined ||
    typeof hourOverride === "boolean" ||
    String(hourOverride).trim() === "";
  if (isEmpty || !Number.isFinite(Number(hourOverride))) {
    const istHourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false
    }).format(new Date());
    hour = Number(istHourStr) % 24;
  } else {
    hour = ((Number(hourOverride) % 24) + 24) % 24;
  }
  if (hour >= 5 && hour < 12) return "Good morning!";
  if (hour >= 12 && hour < 16) return "Good afternoon!";
  return "Good evening!";
}

function scrubCustomerNames(text, customerName) {
  if (!text) return text;
  let cleaned = text.trim();

  // 1. Remove honorifics like "Janab", "Sb", "Sahib", "Sahab"
  cleaned = cleaned.replace(/\s*\b(?:janab|sb|sahib|sahab)\b[!,.]*/gi, "");

  // 2. Scrub customerName if available (strictly word-bounded and excluding common brand/English words)
  if (customerName && customerName.trim().length > 1) {
    const rawName = customerName.trim();
    const tokens = rawName.split(/[\s,._-]+/).filter(t =>
      t.length >= 2 &&
      !/^(?:the|and|or|al|wa|user|guest|customer|valued|patron|mr|mrs|ms|dr|shaikh|sheikh|order|fish|trout|srinagar|malabagh|good|morning|afternoon|evening|all|for|are|you|our|hi|ok|sir|dear)$/i.test(t)
    );
    const allNameVariations = [...new Set([
      ...(/^(?:customer|valued\s*customer)$/i.test(rawName) ? [] : [rawName]),
      ...tokens
    ])];

    for (const token of allNameVariations) {
      const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`\\b(Hello|Hi|Hey|Welcome|Dear)[!,\\s]+\\b${esc}\\b[\\s!,.:]*`, 'gi'), (match, greeting) => {
        if (/^Welcome/i.test(greeting)) return "Welcome ";
        if (/^Dear/i.test(greeting)) return "";
        return `${getTimeOfDayGreetingIst()} `;
      });
      cleaned = cleaned.replace(new RegExp(`^(?:Hello[!,,\\s]+)?\\b${esc}\\b[!.,:]+\\s*`, 'i'), `${getTimeOfDayGreetingIst()} `);
      cleaned = cleaned.replace(new RegExp(`[,\\s]+\\b${esc}\\b([!.,?])`, 'gi'), '$1');
    }
  }

  // 3. Scrub generic addressings like "Dear Customer,", "Dear Sir/Madam,"
  cleaned = cleaned.replace(/^(?:Dear\s+(?:Customer|Sir|Madam|Valued\s+Customer)[!.,:\s]*)/gi, "");

  // 4. Clean any accidental single-word name greeting at start: "Hello John!" -> "Hello!"
  cleaned = cleaned.replace(/^(Hello|Hi|Hey)\s+[A-Z][a-z]+[!,.]*\s*/m, "$1! ");
  cleaned = cleaned.replace(/^(?:Hello[!,,\s]*){2,}/i, "Hello! ");

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  cleaned = cleaned.replace(/^(Hello!|Hi!|Hey!)\s+([a-z])/i, (m, g, c) => `${g} ${c.toUpperCase()}`);

  return cleaned.trim();
}

// Clean repetitive follow-up greetings so every message feels like a continuous conversation
function cleanFollowUpGreeting(text, customerName) {
  if (!text) return text;
  let cleaned = scrubCustomerNames(text, customerName);

  // Strip full repeated greeting phrases in follow-up turns without chopping brand/place sentences
  cleaned = cleaned.replace(/^(?:(?:Walaikum\s+Assalam|Wa\s*alaikum\s*assalam|Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Salaam|Hello|Hi|Hey|Good\s+(?:morning|afternoon|evening)|Welcome(?:\s+back)?\s+to\s+\*?Urban\s+Trout(?:\s+Aquaculture)?\*?|Welcome\s+back)[!,\.\-–—\s]*)+(?:🐟[\s!]*)*\s*/i, "");

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned.trim();
}

const humanOverrides = new Map();
const botSentMessageIds = new Set();
const chatDebounceBuffers = new Map();
const activeChatGenerations = new Map(); // remoteJid -> { turnId: number, startTime: number, promptText: string }
const processedIncomingMessageIds = new Set();
const recentUserMessages = new Map(); // remoteJid -> { text: string, timestamp: number }

// Cached live stock check from aquarium-stock API (2-min TTL prevents 6s per-turn network block)
let _stockCache = { remainingKg: null, fetchedAt: 0 };
async function checkStockAvailable(requestedKg = 2) {
  const now = Date.now();
  if (_stockCache.remainingKg !== null && Number.isFinite(_stockCache.remainingKg) && (now - _stockCache.fetchedAt) < 120000) {
    return _stockCache.remainingKg >= requestedKg;
  }
  return new Promise((resolve) => {
    const req = https.get("https://urbantrout.in/api/aquarium-stock", { timeout: 4500 }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve(true);
        }
        try {
          const json = JSON.parse(data);
          const rawRem = json?.liveSummary?.remainingKg;
          const remaining = (rawRem !== undefined && rawRem !== null && String(rawRem).trim() !== "") ? Number(rawRem) : NaN;
          if (!Number.isFinite(remaining)) {
            return resolve(true);
          }
          _stockCache = { remainingKg: remaining, fetchedAt: Date.now() };
          console.log(`[Stock Check] Live biomass in tanks: ${remaining} kg | Requested: ${requestedKg} kg`);
          resolve(remaining >= requestedKg);
        } catch {
          resolve(true);
        }
      });
    });
    req.on("error", () => resolve(true));
    req.on("timeout", () => { req.destroy(); resolve(true); });
  });
}

const SHORT_LINK_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function randomShortCode(len = 5) {
  return Array.from(crypto.randomBytes(len), b => SHORT_LINK_ALPHABET[b % SHORT_LINK_ALPHABET.length]).join("");
}

function saveShortCodeToSupabase(code, cfSlug) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !cfSlug) return Promise.resolve(false);
  return new Promise((resolve) => {
    const body = JSON.stringify({
      key: `cf_short_${code}`,
      value: cfSlug,
      description: "Short Cashfree Payment Link Redirect",
      updated_at: new Date().toISOString()
    });
    const req = https.request(`${SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: 2000
    }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

async function shortenCashfreeSlug(cfSlug) {
  if (!cfSlug) return "https://urbantrout.in/shop";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const code = randomShortCode(5);
      const ok = await saveShortCodeToSupabase(code, cfSlug);
      if (ok) return `https://urbantrout.in/p/${code}`;
    }
  } catch (_) {}
  return `https://urbantrout.in/p/${cfSlug}`;
}

// Generate official locked-amount Cashfree Payment Link (Primary 0%-Fee UPI Gateway)
async function createCashfreePaymentLink({ amount, customerPhone, customerName, description, orderRef, latitude, longitude, distanceKm, googleMapsUrl }) {
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    throw new Error("Cashfree credentials missing");
  }

  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount < 1) {
    throw new Error(`Invalid Cashfree payment amount: ${amount}`);
  }

  const cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  const isValidContact = cleanPhone && cleanPhone.length === 10 && !/^(.)\1{7,}$/.test(cleanPhone);
  const randSuffix = Math.floor(10 + Math.random() * 90);
  const ref = orderRef || `UT-WA-${Date.now().toString().slice(-6)}${randSuffix}`;

  const descLower = (description || "").toLowerCase();
  const isGutted = descLower.includes("gutted") || (!descLower.includes("whole") && !descLower.includes("sabut"));
  const rate = isGutted ? 580 : 540;
  const cutTitle = isGutted ? "Cleaned & Gutted Trout Steaks" : "Whole Fresh Trout";
  let cleanDesc = (description || "").replace(/^urban\s*trout\s*[-–—:]*\s*/i, "").trim();
  const weightMatch = cleanDesc.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)\b/i);
  const weightKg = weightMatch ? parseFloat(weightMatch[1]) : null;
  const hasDelivery = /\(\s*\+?[^)]*(?:express|special)?\s*delivery\s*\)/i.test(cleanDesc) || (weightKg && numAmount > Math.round(weightKg * rate) + 5);
  const isFreeDelivery = weightKg && weightKg >= 2 && !hasDelivery;

  let cfTitle = "";
  if (weightKg) {
    cfTitle = `${weightKg} kg ${cutTitle}`;
    if (hasDelivery || isFreeDelivery || isGutted) cfTitle += " - Express Delivery";
    else cfTitle += " - Self Pickup";
  } else {
    cfTitle = cleanDesc && !/^(?:fresh\s+trout\s+order\s*\(\s*₹?\d+\s*\)|\d+)$/i.test(cleanDesc) ? cleanDesc : `${cutTitle} Order`;
    if (/\b(?:delivery|courier)\b/i.test(cleanDesc)) cfTitle += " - Express Delivery";
  }
  if (isValidContact) {
    cfTitle += ` - +91 ${cleanPhone}`;
  }
  cfTitle = cfTitle.slice(0, 100);

  const safeCustomerName = String(customerName || "Valued Customer").trim().slice(0, 45) || "Valued Customer";
  const expiryIso = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

  const buildPayload = (useRealPhone = true) => JSON.stringify({
    link_id: `link_${ref.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now().toString().slice(-4)}`.slice(0, 48),
    link_amount: Number(numAmount.toFixed(2)),
    link_currency: "INR",
    link_purpose: cfTitle,
    link_expiry_time: expiryIso,
    link_partial_payments: false,
    link_notify: { send_sms: false, send_email: false },
    customer_details: {
      customer_phone: (useRealPhone && isValidContact) ? `91${cleanPhone}` : "919999999999",
      customer_name: safeCustomerName
    },
    link_meta: {
      upi_intent: true,
      payment_methods: "upi",
      notify_url: "https://urbantrout.in/api/cashfree/webhook"
    },
    link_notes: {
      order_ref: String(ref).slice(0, 60),
      channel: "WHATSAPP_AI_AGENT",
      customer_name: safeCustomerName,
      items_summary: String(description || cfTitle).slice(0, 120),
      ...(isValidContact ? { customer_phone: cleanPhone } : {}),
      ...(googleMapsUrl ? { google_maps_url: String(googleMapsUrl).slice(0, 120) } : {}),
      ...(latitude ? { latitude: String(latitude) } : {}),
      ...(longitude ? { longitude: String(longitude) } : {}),
      ...(distanceKm ? { distance_km: String(distanceKm) } : {})
    }
  });

  const executeCfRequest = (postData) => new Promise((resolve, reject) => {
    const req = https.request("https://api.cashfree.com/pg/links", {
      method: "POST",
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": CASHFREE_API_VERSION,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let data = "";
      res.on("data", c => { data += c; });
      res.on("end", async () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.link_url) {
            const rawSlug = json.link_url.includes("/links/") ? json.link_url.split("/links/")[1] : json.link_id;
            const cfSlug = String(rawSlug || json.link_id).split("?")[0].replace(/\/+$/, "");
            const brandedUrl = await shortenCashfreeSlug(cfSlug);
            console.log(`[Cashfree Short Link Generated] Amount: ₹${numAmount} -> ${brandedUrl} (${json.link_id})`);
            resolve({
              id: json.link_id,
              cfLinkId: json.cf_link_id,
              url: brandedUrl,
              short_url: brandedUrl,
              rawUrl: json.link_url,
              slug: cfSlug,
              qrcode: json.link_qrcode,
              orderRef: ref,
              ref
            });
          } else {
            reject(new Error(json.message || `Cashfree error ${res.statusCode}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Cashfree API timeout")); });
    req.write(postData);
    req.end();
  });

  try {
    return await executeCfRequest(buildPayload(true));
  } catch (err) {
    if (isValidContact) {
      console.warn(`Cashfree link creation failed with customer contact (${err.message}). Retrying with placeholder contact...`);
      return await executeCfRequest(buildPayload(false));
    }
    throw err;
  }
}

// Helper to download an image buffer with safe HTTPS redirect handling
function downloadImageBuffer(url, timeoutMs = 12000, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return reject(new Error(`Refused non-HTTPS image URL: ${parsed.protocol}`));
      }
      const req = https.get(parsed.toString(), { timeout: timeoutMs }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) {
            return reject(new Error("Too many image download redirects"));
          }
          try {
            const nextUrl = new URL(res.headers.location, parsed).toString();
            return downloadImageBuffer(nextUrl, timeoutMs, redirectsLeft - 1).then(resolve).catch(reject);
          } catch (redirectErr) {
            return reject(redirectErr);
          }
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Failed to download QR image. Status: ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error(`downloadImageBuffer timed out after ${timeoutMs}ms`)); });
    } catch (err) {
      reject(err);
    }
  });
}

// ─── 🛡️ BULLETPROOF CASHFREE LINK-ONLY + J&K BANK WATERFALL ───
// Tier 1: Primary Mode — Short Cashfree 1-Tap Payment Link (https://urbantrout.in/p/xxxxx)
// Tier 2: Emergency Fallback — Jammu & Kashmir Bank Account Details (Acc: 0724010100000499)

const HDFC_COUNTER_VPA = "Vyapar.178760132267@hdfcbank";
const HDFC_MERCHANT_REF = "STQU178760132267";

function buildHdfcSmartHubUpiUri(amount, orderRef) {
  const numAmt = Number(amount);
  const tn = encodeURIComponent(`Urban Trout ${orderRef || "Order"}`.slice(0, 45));
  return `upi://pay?pa=${HDFC_COUNTER_VPA}&pn=Urban%20Trout%20Aquaculture&mc=8999&tr=${HDFC_MERCHANT_REF}&am=${numAmt.toFixed(2)}&cu=INR&tn=${tn}`;
}

async function generateHdfcSmartHubQrBuffer(amount, orderRef) {
  const upiUri = buildHdfcSmartHubUpiUri(amount, orderRef);
  const qrBuffer = await QRCode.toBuffer(upiUri, {
    type: "png",
    width: 640,
    margin: 3,
    errorCorrectionLevel: "M",
    color: { dark: "#020d12", light: "#ffffff" }
  });
  return { qrBuffer, upiUri, vpa: HDFC_COUNTER_VPA };
}

const JKB_ACCOUNT_DETAILS = {
  bankName: "Jammu & Kashmir Bank (J&K Bank)",
  accountName: "Urban Trout Aquaculture",
  accountNumber: "0724010100000499",
  ifscCode: "JAKA0MALBAG",
  branch: "Malabagh, Srinagar",
  accountType: "Current Account"
};

function formatJkbBankDetailsText(amount, orderRef) {
  const numAmt = Number(amount) || 0;
  return `🏦 *DIRECT BANK TRANSFER / J&K BANK mPay:*
• *Bank:* Jammu & Kashmir Bank (J&K Bank)
• *Account Name:* Urban Trout Aquaculture
• *Account Number:* \`0724010100000499\`
• *IFSC Code:* \`JAKA0MALBAG\`
• *Branch:* Malabagh, Srinagar
• *Account Type:* Current Account
• *Order Ref:* #${orderRef || "LIVE"}
• *Amount:* ₹${numAmt.toLocaleString("en-IN")}

👉 *Kindly complete payment and share your transaction screenshot here. Our farm team will verify and commence your fresh live harvest within 5 minutes!* 🐟`;
}

async function generatePaymentWithWaterfall({
  amount,
  customerPhone,
  customerName,
  description,
  orderRef,
  preferQr = false,
  latitude,
  longitude,
  distanceKm,
  googleMapsUrl
}) {
  const numAmt = Number(amount);
  if (!Number.isFinite(numAmt) || numAmt <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }
  const cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  const randSuffix = Math.floor(10 + Math.random() * 90);
  const ref = orderRef || `UT-WA-${Date.now().toString().slice(-6)}${randSuffix}`;

  // ── TIER 1: CASHFREE 1-TAP SHORT PAYMENT LINK (Primary Gateway) ──
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const cfLink = await createCashfreePaymentLink({
        amount: numAmt,
        customerPhone: cleanPhone,
        customerName,
        description,
        orderRef: ref,
        latitude,
        longitude,
        distanceKm,
        googleMapsUrl
      });
      if (cfLink && cfLink.url) {
        console.log(`✅ [Payment Waterfall Tier 1 SUCCESS] Cashfree Short Link generated: ${cfLink.url}`);
        return {
          tier: 1,
          mode: "cashfree_link",
          qrBuffer: null,
          payUrl: cfLink.url,
          cashfreeLinkId: cfLink.id,
          paymentLinkId: cfLink.id,
          orderRef: cfLink.orderRef || ref,
          bankDetailsText: null
        };
      }
    } catch (tier1Err) {
      console.warn(`[Payment Waterfall Tier 1 Notice] Cashfree attempt ${attempt + 1}/2 failed: ${tier1Err.message}`);
      if (attempt === 0) await new Promise(r => setTimeout(r, 1200));
    }
  }

  // ── TIER 2: JAMMU & KASHMIR BANK ACCOUNT DETAILS (Emergency Fallback) ──
  console.warn("[Payment Waterfall] Cashfree gateway unavailable! Falling back to Tier 2: J&K Bank Account.");
  return {
    tier: 2,
    mode: "jkb_bank_details",
    qrBuffer: null,
    payUrl: null,
    orderRef: ref,
    bankDetailsText: formatJkbBankDetailsText(numAmt, ref)
  };
}


// Strip redundant inline order summary cards or pricing bullet lists authored by Gemini before injecting an authoritative card
function stripInlineOrderSummaries(text = "") {
  return String(text || "")
    .replace(/(?:^|\n)\s*(?:🧾\s*)?\*?(?:URBAN TROUT\s*[•·-]\s*)?\*?(?:Order Summary|ORDER SUMMARY)\b[^\n]*(?:\n(?![ \t]*(?:\[PAY_LINK:|⚡))[^\n]*)*?(?=\n\s*\n\s*(?![•\-\*📷🕒📍])|\n\[PAY_LINK:|$)/gi, "")
    .replace(/(?:^|\n)\s*[•\-\*]\s*(?:\*)?(?:Order|Item|Rate|Fish Price|Fish Amount|Doorstep Delivery|Cold-Chain Delivery|Express Delivery|Express Delivery Fee|Delivery|Delivery Fee|Express Courier|Packaging|Total Payable):(?:\*)?[^\n]*/gi, "")
    .replace(/(?:^|\n)\s*[•\-\*]?\s*(?:\*)?Total Payable:(?:\*)?\s*\*?₹[\d,]+\*?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Organized & Frictionless WhatsApp Order Summary Card Generator ───
function formatOrderSummaryCard({
  orderRef,
  amount,
  totalAmount,
  desc,
  deliveryArea,
  deliveryFee = 0,
  distanceKm,
  localityName,
  scheduledSlot,
  payUrl
}) {
  const rawAmtVal = amount != null ? amount : totalAmount;
  const parsedAmt = Number(String(rawAmtVal ?? "").replace(/[^\d.]/g, ""));
  const numericAmount = Number.isFinite(parsedAmt) ? parsedAmt : 0;
  const isWhole = /\b(?:whole|sabut)\b/i.test(desc || "");
  const cutName = isWhole ? "Whole Fresh" : "Cleaned & Gutted";

  // Parse weight if specified in desc (e.g. "2 kg Cleaned & Gutted" -> 2)
  const weightMatch = (desc || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
  const weightKg = weightMatch ? parseFloat(weightMatch[1]) : null;
  const baseUnitRate = isWhole ? 540 : 580;

  // Strip redundant inline (+₹149 Delivery) / (+Express Delivery) suffix from Order title cleanly
  const cleanTitleDesc = (desc || "")
    .replace(/\s*\(\s*\+?\s*(?:₹\s*\d+\s*)?(?:Special\s+|Express\s+)?Delivery\s*\)/gi, "")
    .trim();

  const orderTitle = weightKg
    ? `${weightKg} kg × ${cutName}`
    : (cleanTitleDesc && !/^(?:fresh\s+trout\s+order\s*\(\s*₹?\d+\s*\)|\d+)$/i.test(cleanTitleDesc) ? cleanTitleDesc : `${cutName} Trout`);

  // Resolve effective delivery fee from explicit arg, description tag, OR total vs base weight price
  const descFeeMatch = (desc || "").match(/\(\s*\+\s*₹?\s*(\d+)\s*(?:Special\s+|Express\s+)?Delivery\s*\)/i);
  let effectiveDeliveryFee = Number(deliveryFee) > 0
    ? Number(deliveryFee)
    : (descFeeMatch ? parseInt(descFeeMatch[1], 10) : 0);
  if (effectiveDeliveryFee === 0 && weightKg && numericAmount > 0) {
    const baseExpected = Math.round(weightKg * baseUnitRate);
    if (numericAmount > baseExpected + 5) {
      effectiveDeliveryFee = numericAmount - baseExpected;
    }
  }

  // Destination / locality (avoid ugly placeholders like "Valued Customer ()")
  const rawPlace = localityName || (deliveryArea && !deliveryArea.includes("Within") && !deliveryArea.includes("Doorstep Delivery") && !deliveryArea.includes("Cold-Chain Delivery") && !deliveryArea.includes("Express Delivery") ? deliveryArea.replace(/\s*\([^)]*\)\s*/g, "").trim() : "");
  const sanitizedPlace = (rawPlace || "").replace(/\(\s*\)/g, "").trim();
  const isGenericPlace = !sanitizedPlace || /^(?:srinagar|kashmir|area pending|valued\s*customer|customer|express\s*delivery)$/i.test(sanitizedPlace);
  const cleanPlace = isGenericPlace ? "" : sanitizedPlace;

  const isExplicitPaidTag = effectiveDeliveryFee > 0 || /\(\s*\+?\s*(?:₹\s*\d+\s*)?(?:Special|Express)\s*Delivery\s*\)/i.test(desc || "") || /\(\s*\+\s*₹?\s*\d+\s*Delivery\s*\)/i.test(desc || "");
  const isAmbiguousCustomTotal = !isExplicitPaidTag && !weightKg && numericAmount > 0 && (numericAmount % 580 !== 0) && (numericAmount % 540 !== 0);

  let deliveryDisplay;
  if (isExplicitPaidTag) {
    if (effectiveDeliveryFee > 0) {
      deliveryDisplay = cleanPlace
        ? `${cleanPlace} (+₹${effectiveDeliveryFee} Express Delivery)`
        : `Express Delivery (+₹${effectiveDeliveryFee})`;
    } else {
      deliveryDisplay = cleanPlace ? `${cleanPlace} (Express Delivery)` : "Express Delivery";
    }
  } else if (isAmbiguousCustomTotal) {
    deliveryDisplay = cleanPlace ? `${cleanPlace} (Express Delivery)` : "Express Delivery Included";
  } else {
    deliveryDisplay = `${cleanPlace || "Srinagar"} (100% FREE)`;
  }

  const slotDisplay = scheduledSlot || "Harvested live, packed in food-grade biodegradable polythene (0% ice) & dispatched within 2 hours of payment";
  const cardWeatherPolicy = typeof evaluateWeatherDeliveryPolicy === "function"
    ? evaluateWeatherDeliveryPolicy(distanceKm)
    : { shortDelayNote: "" };
  const weatherCardLine = cardWeatherPolicy.shortDelayNote ? `\n${cardWeatherPolicy.shortDelayNote}` : "";
  const validPayUrl = (payUrl && typeof payUrl === "string" && /^https?:\/\//i.test(payUrl.trim()) && !/\/urbantrout\.in\/?$/i.test(payUrl.trim()))
    ? `\n🔗 *Instant Payment Link:* ${payUrl.trim()}`
    : "";

  return `🧾 *ORDER SUMMARY (#${orderRef || "LIVE"})*
• *Item:* ${orderTitle}
• *Packaging:* 100% Food-Grade Biodegradable Polythene (0% Ice)
• *Delivery:* ${deliveryDisplay}
• *Total Payable:* *₹${numericAmount.toLocaleString("en-IN")}*

💳 *Tap Secure 1-Tap Link to Pay:*${validPayUrl}
Supports Google Pay, PhonePe, Paytm, J&K Bank mPay & All UPI Apps.
*(Live harvest begins immediately upon payment confirmation)*

🕒 _${slotDisplay}_${weatherCardLine}
📍 _Delivered directly to your shared GPS pin. Please keep your phone reachable — our Express Dispatch Partner calls prior to arrival for a prompt location-based handover._`;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Cache to map WhatsApp privacy LIDs or session IDs to verified phone numbers
const lidToPhone = new Map();

// Google Contacts exporter module
const { exportContacts, enrichContactsFromChats, loadPrimaryPhones, sanitizeRawContactName } = require("./export_contacts");

// Global AI Sales Agent Kill Switch / Pause State (Controllable from Phone via #pause / #resume)
let isAiPausedGlobally = false;
let aiPauseExpiry = 0;

// Per-Chat message concurrency queue to allow handling multiple customers in parallel
const chatProcessingQueues = new Map();

function enqueueChatMessage(remoteJid, fn) {
  const currentQueue = chatProcessingQueues.get(remoteJid) || Promise.resolve();
  const safeTask = () => Promise.race([
    Promise.resolve().then(() => fn()),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Chat task timed out after 90s for ${remoteJid}`)), 90000))
  ]);
  const nextQueue = currentQueue
    .then(safeTask)
    .catch(err => console.error(`❌ [Chat Queue Error] ${remoteJid}:`, err?.message || err))
    .finally(() => {
      if (chatProcessingQueues.get(remoteJid) === nextQueue) {
        chatProcessingQueues.delete(remoteJid);
      }
    });
  chatProcessingQueues.set(remoteJid, nextQueue);
}

// Resolve real 10/12-digit mobile number from JID or Baileys auth reverse LID mappings
function resolveCustomerPhone(jid) {
  if (!jid) return "";
  if (jid.endsWith("@s.whatsapp.net")) {
    return jid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
  }
  const cleanId = jid.replace("@lid", "").replace("@s.whatsapp.net", "");
  if (lidToPhone.has(jid)) return lidToPhone.get(jid);
  if (lidToPhone.has(cleanId)) return lidToPhone.get(cleanId);

  try {
    const revPath = path.join(__dirname, "auth_info_baileys", `lid-mapping-${cleanId}_reverse.json`);
    if (fs.existsSync(revPath)) {
      const mapped = JSON.parse(fs.readFileSync(revPath, "utf-8"));
      if (mapped) {
        const clean = String(mapped).replace(/\D/g, "");
        lidToPhone.set(jid, clean);
        lidToPhone.set(cleanId, clean);
        return clean;
      }
    }
  } catch (_) {}
  return cleanId;
}

// Pretty print Indian phone number for terminal logs
function formatPhoneDisplay(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return digits ? `+${digits}` : "Customer";
}

// ─── CUSTOMER SENTIMENT & DISSATISFACTION ESCALATION DETECTOR ───
function detectCustomerEscalation(text) {
  if (!text || typeof text !== "string") return null;
  const t = text.toLowerCase().trim();

  // 1. Bot confrontation / Automation criticism / Demanding human
  if (/\b(?:automated\s*(?:reply|response|bot|msg|message|system)|bot\s*(?:hai|reply|response|baat)|land\s*(?:you|u)\s*in\s*(?:serious\s*)?trouble|serious\s*trouble|trouble\s*someday|talk\s*to\s*(?:a\s*)?(?:human|person|manager|owner|founder)|robot\s*hai|insan\s*se\s*baat|asli\s*insan|real\s*person|human\s*agent|call\s*karo\s*mujhe|call\s*me\s*now)\b/i.test(t)) {
    return {
      severity: "HIGH",
      category: "Bot Confrontation / Demanding Human",
      reason: "Customer confronted automated replies or demanded a human manager"
    };
  }

  // Strip innocent Srinagar landmark names (e.g. "Near Shergari Police Station", "Near Khyber Hospital", "High Court")
  const sanitizedForThreat = t
    .replace(/\b(?:shergari|saddar|kothibagh|rammunshibagh|rajbagh|safa\s*kadal|m\.?r\.?\s*gunj|khanyar|rainawari|zadibal|zakura|soura|parimpora|batamaloo|bemina|nowgam|pantha\s*chowk|chanapora|lal\s*bazar|nigeen|hazratbal|nishat|harwan|kralkhud|maisuma|shaheed\s*gunj)\s*police\s*(?:station|post|chowki|lines?)\b/gi, "")
    .replace(/\b(?:near|opp(?:osite)?|behind|beside|in\s*front\s*of|next\s*to)\s+[\w\s]{0,30}\b(?:police\s*(?:station|post|chowki|lines?)|thana|court|hospital)\b/gi, "")
    .replace(/\b(?:police\s*station|police\s*lines?|police\s*chowki|skims\s*hospital|smhs\s*hospital|khyber\s*hospital|jlnm\s*hospital|lal\s*ded\s*hospital|bone\s*(?:&|and)\s*joint\s*hospital|high\s*court)\b/gi, "");

  // 2. Legal, Regulatory, Police, Fraud, Scam, Cheating threats
  if (/\b(?:fraud|scam|cheating|cheat|chor|chori|loot|loot\s*rahe|dhokha|420|police\s*(?:complaint|ko|case|report)|call\s*(?:the\s*)?police|go\s*to\s*police|consumer\s*court|consumer\s*forum|legal\s*action|fir\s*(?:karega|karunga|likhunga|darj)|report\s*(?:you|karoonga|karenge|krunga)|drag\s*(?:you\s*)?to\s*court|court\s*case|lawyer|advocate)\b/i.test(sanitizedForThreat)) {
    return {
      severity: "CRITICAL",
      category: "Legal / Fraud / Regulatory Threat",
      reason: "Customer alleged fraud, scam, or threatened legal/police/consumer court action"
    };
  }

  // 3. Product quality / Rotten / Spoiled / Sickness / Food safety
  // Guard against pre-order freshness/dietary questions (e.g. "Is it fresh or stale?", "Does fresh trout smell?", "Doctor suggested trout after sickness")
  const isDietaryOrFreshnessInquiry =
    /^(?:is\s*(?:it|the\s*fish|the\s*trout|your|fresh)|does\s*(?:it|the\s*fish|fresh)|can\s*(?:we|i|he|she|they|a\s*patient|someone)|kya\s*(?:yeh|fish|trout)|doctor\s*(?:suggested|advised|recommended)|good\s*for|patient|recovery|diet)\b/i.test(t) ||
    /\b(?:can|should|could|is\s*it\s*safe|safe\s*to)\s*(?:we|i|he|she|they|a\s*patient|someone)?\s*(?:eat|have|take|consume|order)\b/i.test(t) ||
    /\b(?:fresh\s*or\s*stale|bad\s*smell\s*\?|doctor|protein|prescribed|recommended\s*(?:by|trout|fish))\b/i.test(t);

  const hasDefiniteFoodComplaint = /\b(?:vomit|vomiting|food\s*poisoning|stinking|rotten|sadi\s*hui|sada\s*hua|pet\s*kharab|insects|worm|kharab\s*(?:nikli|nikla|aayi|bheji)|smell\s*aa\s*rahi|bad\s*quality\s*fish)\b/i.test(sanitizedForThreat);
  const hasContextualFoodComplaint = /\b(?:spoiled|stale|kharab|bad\s*smell|smelling|sick|bimar|hospitalized|hospitalised|in\s*hospital|unhygienic|gandi\s*fish)\b/i.test(sanitizedForThreat);

  if (hasDefiniteFoodComplaint || (hasContextualFoodComplaint && !isDietaryOrFreshnessInquiry)) {
    return {
      severity: "CRITICAL",
      category: "Food Safety / Quality Escalation",
      reason: "Customer reported bad smell, stale fish, rotten quality, or food sickness"
    };
  }

  // 4. Extreme dissatisfaction / Abuse
  if (/\b(?:bakwas|worst\s*service|pathetic|third\s*class|disgusting|chutiya|harami|kamine|bewakoof|bloody|nonsense|rubbish|mental|ganda\s*service|fraud\s*company)\b/i.test(t)) {
    return {
      severity: "HIGH",
      category: "Severe Dissatisfaction / Anger",
      reason: "Customer expressed severe anger, abusive language, or extreme discontent"
    };
  }

  return null;
}

// Save or update customer order in local persistent store (Preserves past order history)
// Cached order loader + Shared Payment Receipt Formatter (eliminates 3.5s redundant JSON reads & 3x duplicated receipt templates)
let _ordersFileCache = { mtimeMs: 0, data: null };
function readOrdersCached(ordersFilePath) {
  try {
    if (!fs.existsSync(ordersFilePath)) {
      _ordersFileCache = { mtimeMs: 0, data: {} };
      return {};
    }
    const stat = fs.statSync(ordersFilePath);
    if (_ordersFileCache.data && _ordersFileCache.mtimeMs === stat.mtimeMs) {
      return _ordersFileCache.data;
    }
    const parsed = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8")) || {};
    _ordersFileCache = { mtimeMs: stat.mtimeMs, data: parsed };
    return parsed;
  } catch (_) {
    return _ordersFileCache.data || {};
  }
}

function buildPaymentConfirmedReceipt({ orderRef, itemsDesc, paidAmt, finalSlot, deliveryCommitment, hasGps = true, gatewayLabel = "" }) {
  const gwText = gatewayLabel ? ` via ${gatewayLabel}` : "";
  const pinPrompt = !hasGps
    ? `\n\n📍 *Important Pin-Point Delivery Instructions:*\nPlease share your *WhatsApp Location Pin* (tap 📎 ➔ Location ➔ Send current location) or *Google Maps link* right now so our *Urban Trout Express Dispatch Partner* navigates directly to your shared spot.\n• Your fish is packed fresh in *100% food-grade biodegradable polythene (0% ice)*.\n• Delivery is made *strictly to the shared GPS location pin* (not by searching house numbers or knocking on doors).\n• Our Express Dispatch Partner navigates directly to your shared pin and calls prior to arrival. Please keep your phone reachable for a prompt location-based handover.`
    : `\n\n📍 *Express Dispatch Instructions:*\nYour fish is packed fresh in *100% food-grade biodegradable polythene (0% ice)*. Our *Urban Trout Express Dispatch Partner* will deliver *strictly to your shared GPS location pin* (not house numbers). Kindly keep your phone reachable — our rider calls prior to arrival for a prompt location-based handover.`;

  return `✅ *Payment Received & Order Confirmed!* 🐟\n\nThank you! Your payment of *₹${paidAmt}*${gwText} has been verified successfully.\n\n📋 *Order Summary:*\n• *Order Ref:* #${orderRef}\n• *Items:* ${itemsDesc}\n• *Delivery Slot:* ${finalSlot}\n• *Status:* Confirmed (Live Harvest Scheduled)\n\n${deliveryCommitment}${pinPrompt}`;
}

function normalizeOrderStorageKey(phoneOrKey) {
  const raw = String(phoneOrKey || "").trim();
  if (!raw || /^(?:customer|n\/a|unknown|null|undefined)$/i.test(raw)) return "";
  if (raw.startsWith("QUICK-") || /_ADD_\d+$/.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || (digits.length >= 11 && digits.length <= 13)) return digits.slice(-10);
  if (raw.includes("@lid")) return raw;
  return digits.length >= 6 ? digits.slice(-10) : raw;
}

function recordNewCustomerOrder(phone, orderData) {
  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    let orders = {};
    if (fs.existsSync(ordersFilePath)) {
      try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8")) || {}; } catch (_) {}
    }
    const orderKey = normalizeOrderStorageKey(phone || orderData?.phone) || (orderData?.orderRef ? `ORD-${orderData.orderRef}` : "");
    if (!orderKey) return;

    const digitsOnly = String(orderData?.phone || phone || "").replace(/\D/g, "");
    const storedPhone = (digitsOnly.length >= 10 && digitsOnly.length <= 13) ? digitsOnly.slice(-10) : (orderData?.phone || "");

    const existing = orders[orderKey];
    const isSameOrderRef = Boolean(existing?.orderRef && orderData?.orderRef && existing.orderRef === orderData.orderRef);
    const pastOrders = Array.isArray(orderData?.pastOrders)
      ? [...orderData.pastOrders]
      : (Array.isArray(existing?.pastOrders) ? [...existing.pastOrders] : []);
    if (existing && existing.orderRef && orderData?.orderRef && existing.orderRef !== orderData.orderRef) {
      const { pastOrders: _, ...oldSnapshot } = existing;
      if (!pastOrders.some(po => po.orderRef === oldSnapshot.orderRef)) {
        pastOrders.push(oldSnapshot);
      }
    }

    // Preserve all historical payment link IDs for this customer
    const allPaymentLinkIds = Array.isArray(existing?.allPaymentLinkIds) ? [...existing.allPaymentLinkIds] : (existing?.paymentLinkId ? [existing.paymentLinkId] : []);
    const resolvedPaymentLinkId = orderData.paymentLinkId || (isSameOrderRef ? existing?.paymentLinkId : null) || null;
    const resolvedCashfreeLinkId = orderData.cashfreeLinkId || (isSameOrderRef ? existing?.cashfreeLinkId : null) || null;
    if (resolvedPaymentLinkId && !allPaymentLinkIds.includes(resolvedPaymentLinkId)) {
      allPaymentLinkIds.push(resolvedPaymentLinkId);
    }

    const nowIso = new Date().toISOString();
    const resolvedCreatedAt = isSameOrderRef
      ? (existing?.createdAt || orderData?.createdAt || nowIso)
      : (orderData?.createdAt || nowIso);

    orders[orderKey] = {
      ...orderData,
      phone: storedPhone,
      paymentLinkId: resolvedPaymentLinkId,
      cashfreeLinkId: resolvedCashfreeLinkId,
      allPaymentLinkIds,
      pastOrders,
      createdAt: resolvedCreatedAt,
      updatedAt: nowIso
    };
    writeJsonAtomicSync(ordersFilePath, orders);
    _ordersFileCache = { mtimeMs: 0, data: null };
  } catch (e) {
    console.error("Error saving customer order:", e);
  }
}

// Helper to query Supabase REST API
async function querySupabase(endpoint) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return new Promise((resolve) => {
    const req = https.get(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      timeout: 4000
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

// Helper to PATCH Supabase REST API
async function patchSupabase(endpoint, body) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  const payload = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = https.request(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      timeout: 5000
    }, (res) => {
      let errBody = "";
      res.on("data", c => { if (res.statusCode >= 400 && errBody.length < 200) errBody += c; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(true);
        console.warn(`[Supabase PATCH ${res.statusCode}] ${endpoint}: ${errBody}`);
        resolve(false);
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

// Helper to POST (insert) into Supabase REST API
async function insertSupabase(endpoint, body) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const payload = JSON.stringify(body);
  try {
    return await new Promise((resolve) => {
      const req = https.request(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        timeout: 6000
      }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            console.warn(`[Supabase INSERT ${res.statusCode}] ${endpoint}: ${data.slice(0, 200)}`);
            return resolve(null);
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.write(payload);
      req.end();
    });
  } catch (err) {
    console.error("insertSupabase error:", err?.message || err);
    return null;
  }
}

// Auto-sync confirmed WhatsApp orders into Supabase `orders` table
async function syncWhatsAppOrderToSupabase(order, paymentId) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !order) return null;
  try {
    const ref = order.orderRef || "";
    const pId = paymentId || order.paymentId || "";
    const cleanPhone = String(order.phone || "").replace(/\D/g, "").slice(-10);
    const dbCustomerPhone = cleanPhone || String(order.chatId || "").replace(/@.*/, "").slice(0, 15) || "WhatsApp";

    // 1. Check if already exists in Supabase orders
    if (ref || pId) {
      const filter = ref && pId
        ? `or=(customer_address.ilike.%25${encodeURIComponent(ref)}%25,customer_address.ilike.%25${encodeURIComponent(pId)}%25)`
        : ref
        ? `customer_address.ilike.%25${encodeURIComponent(ref)}%25`
        : `customer_address.ilike.%25${encodeURIComponent(pId)}%25`;
      const existing = await querySupabase(`orders?${filter}&limit=1`);
      if (Array.isArray(existing) && existing.length > 0) {
        const existingOrd = existing[0];
        const mapsLink = order.googleMapsUrl || (order.latitude && order.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}` : "");
        if (mapsLink && !existingOrd.customer_address?.includes("Exact GPS")) {
          const newAddr = `${existingOrd.customer_address} | 📍 Exact GPS: ${mapsLink}`;
          await patchSupabase(`orders?id=eq.${existingOrd.id}`, { customer_address: newAddr });
          console.log(`📍 [Supabase Order Sync] Added GPS pin to existing Order #${existingOrd.order_number}`);
        }
        return existingOrd;
      }
    }

    // 2. Parse items and weights without fabricating fake 2kg weights on direct amounts
    const itemsText = String(order.items || "Cleaned & Gutted Rainbow Trout");
    const weightMatch = itemsText.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\b/i);
    const weightKg = weightMatch ? parseFloat(weightMatch[1]) : null;
    const isGutted = itemsText.toLowerCase().includes("gutted") || (!itemsText.toLowerCase().includes("whole") && !itemsText.toLowerCase().includes("sabut"));
    const rate = isGutted ? 580 : 540;

    let rawAmt = 0;
    if (typeof order.amount === "number" && Number.isFinite(order.amount)) {
      rawAmt = order.amount;
    } else if (typeof order.amount === "string") {
      const amtM = order.amount.match(/₹?\s*([\d,]+(?:\.\d+)?)/);
      if (amtM) rawAmt = parseFloat(amtM[1].replace(/,/g, "")) || 0;
    }
    const subtotal = weightKg ? Math.round(weightKg * rate) : (rawAmt || 1160);
    const deliveryFee = Number(order.deliveryFee) || (weightKg && rawAmt > subtotal ? Math.round(rawAmt - subtotal) : 0);
    const total = rawAmt || (subtotal + deliveryFee);

    const itemsPayload = [
      {
        id: isGutted ? "gutted-trout" : "whole-trout",
        name: isGutted ? "Premium Gutted Rainbow Trout" : "Whole Fresh Rainbow Trout",
        unit: "Kg",
        price: weightKg ? rate : total,
        quantity: weightKg || 1,
        orderedWeightKg: weightKg || 1,
        actualWeight: weightKg || 1,
        image: "/images/gutted_trout_premium.webp"
      }
    ];

    const mapsLink = order.googleMapsUrl || (order.latitude && order.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}` : "");
    const deliveryArea = order.deliveryArea || "Srinagar";
    const localityClean = deliveryArea.replace(/\s*\(~.*?\)/, "").trim();
    const AREA_PIN_REVERSE = {
      "lal chowk": "190001", "maharaj gunj": "190002", "rainawari": "190003", "nishat": "190004",
      "sanat nagar": "190005", "hazratbal": "190006", "jawahar nagar": "190008", "bemina": "190009",
      "batamaloo": "190010", "soura": "190011", "hmt": "190012", "chanapora": "190014",
      "pantha chowk": "190015", "parimpora": "190017", "shalimar": "190019", "nowgam": "190020",
      "humhama": "190021", "eidgah": "190025", "ganderbal town": "191201"
    };
    const inferredPin = order.pincode || AREA_PIN_REVERSE[localityClean.toLowerCase()] || "";

    const gatewayTag = (pId && /^(?:HDFC-|STQU)/i.test(pId)) || /hdfc|vyapar/i.test(String(order.paymentGateway || ""))
      ? `HDFC SmartHub: ${pId}`
      : (pId && /^MANUAL-/i.test(pId))
      ? `Manual UPI: ${pId}`
      : `Cashfree: ${pId}`;

    let addressStr = deliveryArea;
    if (ref || pId) {
      addressStr += ` (Ref: #${ref}${ref && pId ? ", " : ""}${pId ? gatewayTag : ""})`;
    }
    if (order.deliveryTime) {
      addressStr += ` | Slot: ${order.deliveryTime}`;
    }
    if (mapsLink) {
      addressStr += ` | 📍 Exact GPS: ${mapsLink}`;
    }

    const payload = {
      customer_name: order.name || "WhatsApp Customer",
      customer_phone: dbCustomerPhone,
      customer_address: addressStr,
      customer_locality: localityClean,
      customer_pincode: inferredPin,
      items: itemsPayload,
      subtotal: subtotal,
      delivery_fee: deliveryFee,
      total: total,
      delivery_zone: "express_delivery",
      status: "processing",
      created_at: order.paidAt || new Date().toISOString()
    };

    const inserted = await insertSupabase("orders", payload);
    if (inserted && Array.isArray(inserted) && inserted[0]) {
      console.log(`✅ [Supabase Order Sync] Successfully inserted WhatsApp Order #${inserted[0].order_number} for ${cleanPhone} into Supabase orders table!`);
      return inserted[0];
    }
  } catch (err) {
    console.error("[Supabase Order Sync] Error syncing WhatsApp order:", err.message);
  }
  return null;
}

// Auto-settle Khata in Supabase strictly for explicit Khata/Balance links (never regular fish orders!)
async function autoSettleKhataInSupabase(phone, amount, paymentId, orderRef) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !phone) return;
  const isExplicitKhataRef = /^(?:BAL|KHATA|LEDGER)-/i.test(String(orderRef || "").trim());
  if (!isExplicitKhataRef) return;

  const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) return;
  try {
    const vsl = await querySupabase(`vending_sales_log?or=(custom_fields->>customer_phone.eq.${cleanPhone},notes.ilike.%25${cleanPhone}%25)&order=created_at.desc&limit=10`);
    if (Array.isArray(vsl) && vsl.length > 0) {
      for (const item of vsl) {
        const cf = item.custom_fields || {};
        if (cf.balance_status === "settled" || cf.balance_status === "waived_final") continue;
        if (Array.isArray(cf.payment_history) && cf.payment_history.some(ph => ph && ph.payment_id === paymentId)) {
          continue;
        }
        const bal = Number(cf.balance_amount || 0);
        const isKhata = (item.payment_mode || "").toLowerCase().includes("credit") || (item.payment_mode || "").toLowerCase().includes("khata");
        if (bal > 0 || isKhata) {
          const prevPaid = Number(item.amount_paid || 0);
          const exp = Number(cf.expected_amount || item.expected_amount || (Number(item.weight_kg) * Number(item.rate_per_kg)));
          const updatedPaid = prevPaid + Number(amount);
          const newBal = Math.max(0, exp - updatedPaid);
          const isSettled = newBal <= 0;
          cf.balance_amount = newBal;
          cf.balance_status = isSettled ? "settled" : "pending";
          cf.is_full_payment = isSettled;
          if (isSettled) cf.settled_at = new Date().toISOString();
          cf.settled_payment_method = `Cashfree (Verified ${paymentId})`;

          if (!Array.isArray(cf.payment_history)) cf.payment_history = [];
          cf.payment_history.push({
            amount: Number(amount),
            method: "Cashfree Link (Verified)",
            payment_id: paymentId,
            timestamp: new Date().toISOString(),
            note: `Khata auto-settled via Cashfree payment (${orderRef || paymentId})`
          });

          await patchSupabase(`vending_sales_log?id=eq.${item.id}`, {
            amount_paid: updatedPaid,
            payment_mode: isSettled ? "Online Payment (Khata Cleared via Cashfree)" : item.payment_mode,
            custom_fields: cf,
            notes: ((item.notes || "").trim() ? (item.notes + " ") : "") + `[KHATA PAID ✓ ₹${amount} via Cashfree ${paymentId}]`
          });
          console.log(`🎉 [Khata Auto-Settled via Poller] Updated vending_sales_log ${item.id} for ${cleanPhone}: ₹${amount}`);

          // Sync valid columns on customer_balances schema cleanly
          try {
            const openBalRows = await querySupabase(`customer_balances?customer_phone=ilike.%25${cleanPhone}%25&status=eq.pending&order=created_at.desc&limit=1`);
            if (Array.isArray(openBalRows) && openBalRows[0]) {
              const row = openBalRows[0];
              const rowPaid = Number(row.paid_amount || 0) + Number(amount);
              const rowBal = Math.max(0, Number(row.total_amount || 0) - rowPaid);
              const rowSettled = rowBal <= 0;
              await patchSupabase(`customer_balances?id=eq.${row.id}`, {
                paid_amount: rowPaid,
                balance_amount: rowBal,
                status: rowSettled ? "settled" : "pending",
                settlement_note: `Auto-settled ₹${amount} via Cashfree (${paymentId})`,
                updated_at: new Date().toISOString()
              });
            }
          } catch (_) {}
          break;
        }
      }
    }
  } catch (err) {
    console.warn("[Khata Poller Sync Notice]:", err.message);
  }
}

// Helper to update Supabase app_settings
async function updateSupabaseAppSettings(key, value) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  const payload = JSON.stringify({
    key,
    value,
    updated_at: new Date().toISOString()
  });
  return new Promise((resolve) => {
    const req = https.request(`${SUPABASE_URL}/rest/v1/app_settings`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
      },
      timeout: 5000
    }, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve(res.statusCode >= 200 && res.statusCode < 300));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

// Background queue processor: transmits order status changes & webhook confirmations to customer's WhatsApp
let isPollingQueue = false;
async function pollWhatsAppDispatchQueue(sock) {
  if (isPollingQueue || !sock || !sock.user) return;
  isPollingQueue = true;
  try {
    const res = await querySupabase("app_settings?key=in.(whatsapp_dispatch_queue,allow_friday_orders)&select=key,value");
    if (Array.isArray(res) && res.length > 0) {
      const friRow = res.find(r => r.key === "allow_friday_orders");
      if (friRow) {
        websiteFridayAllowed = (friRow.value === "true");
      }
    }
    const qRow = Array.isArray(res) ? res.find(r => r.key === "whatsapp_dispatch_queue") : null;
    if (!qRow || !qRow.value) {
      return;
    }

    let queue = [];
    try {
      queue = JSON.parse(qRow.value);
    } catch (_) {
      return;
    }

    if (!Array.isArray(queue) || queue.length === 0) {
      return;
    }

    let changed = false;
    const processedItemsMap = new Map();
    const ordersFilePath = path.join(__dirname, "customer_orders.json");

    for (const item of queue) {
      if (item && item.dispatched === false && item.phone && item.messageText) {
        const itemKey = item.id || `${item.orderRef || ""}_${item.status || ""}_${item.createdAt || item.phone}`;
        const cleanPhone = String(item.phone).replace(/\D/g, "").slice(-10);
        if (isVvipManualOnly(null, cleanPhone)) {
          console.log(`⛔ [VVIP MANUAL-ONLY] Skipped dispatch queue message for IAS Officer (${cleanPhone}).`);
          item.dispatched = true;
          item.skipped = "VVIP Manual Only";
          processedItemsMap.set(itemKey, item);
          changed = true;
          continue;
        }
        if (cleanPhone.length !== 10) {
          item.dispatched = true;
          item.error = "Invalid phone format";
          processedItemsMap.set(itemKey, item);
          changed = true;
          continue;
        }

        const latestOrdersSnap = readOrdersCached(ordersFilePath);
        const existingEntry = latestOrdersSnap[cleanPhone]
          ? [cleanPhone, latestOrdersSnap[cleanPhone]]
          : Object.entries(latestOrdersSnap).find(([, o]) =>
              o && (
                (item.orderRef && o.orderRef === item.orderRef) ||
                (String(o.phone || "").replace(/\D/g, "").slice(-10) === cleanPhone)
              )
            );
        const existingOrdKey = existingEntry ? existingEntry[0] : cleanPhone;
        const existingOrd = existingEntry ? existingEntry[1] : null;

        // Deduplicate payment_confirmed messages when Cashfree poller or #paid ALREADY sent the confirmation!
        if (item.status === "payment_confirmed" && (
          (item.paymentId && confirmedPaymentIds.has(item.paymentId)) ||
          (existingOrd?.cashfreeLinkId && confirmedPaymentIds.has(existingOrd.cashfreeLinkId)) ||
          (existingOrd && (existingOrd.paidAt || existingOrd.paymentId || isOrderDeliveredOrClosed(existingOrd) || /(?:paid|confirmed|harvested|out\s*for\s*delivery|delivered)/i.test(existingOrd.status || "")))
        )) {
          console.log(`[Dispatch Queue Dedup] Skipped duplicate payment_confirmed WhatsApp message for +91 ${cleanPhone} (#${item.orderRef || existingOrd?.orderRef}).`);
          item.dispatched = true;
          item.skipped = "Duplicate payment confirmation suppressed";
          processedItemsMap.set(itemKey, item);
          changed = true;
          continue;
        }

        // Clean any accidental religious greetings or 'void' placeholders in queued text
        let cleanText = item.messageText
          .replace(/^(?:(?:Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam)[\s!,\.\-–—]*)+/i, "")
          .replace(/\b(?:Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Janab)\b/gi, "")
          .replace(/\bvoid\b/gi, "there")
          .trim();

        const targetJid = existingOrd?.chatId || `91${cleanPhone}@s.whatsapp.net`;

        console.log(`\n🚀 [Order Update -> WhatsApp Transmission]`);
        console.log(`📡 Sending "${item.status}" update to +91 ${cleanPhone} for Order #${item.orderRef}...`);

        try {
          const sentQueueMsg = await sock.sendMessage(targetJid, { text: cleanText });
          if (sentQueueMsg?.key?.id) {
            botSentMessageIds.add(sentQueueMsg.key.id);
            setTimeout(() => botSentMessageIds.delete(sentQueueMsg.key.id), 10 * 60 * 1000);
          }
          console.log(`✅ [WhatsApp Delivered] Successfully notified customer (+91 ${cleanPhone})!`);

          // Re-read latest orders cleanly before patching status (avoids clobbering concurrent orders!)
          const freshOrders = readOrdersCached(ordersFilePath);
          const freshOrd = freshOrders[existingOrdKey] || freshOrders[cleanPhone];
          if (freshOrd) {
            const newStatus = item.status === "out_for_delivery"
              ? "Out for Delivery (Rider Dispatched)"
              : item.status === "delivered"
              ? "Delivered Successfully"
              : (item.status === "processing" || item.status === "harvested")
              ? "Harvested Live & Packed (Non-Refundable)"
              : item.status === "payment_confirmed"
              ? "Paid & Confirmed (Live Harvest Pending)"
              : item.status === "cancelled"
              ? "Order Cancelled"
              : item.status;
            // Never downgrade Delivered / Out for Delivery back to Paid & Confirmed
            const skipDowngrade = item.status === "payment_confirmed" && (isOrderDeliveredOrClosed(freshOrd) || /out\s*for\s*delivery|harvested/i.test(freshOrd.status || ""));
            if (!skipDowngrade) {
              recordNewCustomerOrder(existingOrdKey, {
                ...freshOrd,
                status: newStatus,
                ...(item.status === "payment_confirmed" ? {
                  paidAt: freshOrd.paidAt || new Date().toISOString(),
                  paymentId: item.paymentId || freshOrd.paymentId || undefined
                } : {}),
                ...(item.status === "delivered" ? { deliveredAt: new Date().toISOString() } : {})
              });
              console.log(`[Customer Memory Updated] Status for ${existingOrdKey} set to "${newStatus}"`);
            }
            if (item.status === "payment_confirmed") {
              if (item.paymentId) markPaymentProcessed(item.paymentId);
              if (freshOrd.cashfreeLinkId) markPaymentProcessed(freshOrd.cashfreeLinkId);
              if (freshOrd.paymentLinkId) markPaymentProcessed(freshOrd.paymentLinkId);
            }
          }

          // Append to chat history
          if (chatHistories.has(targetJid)) {
            const h = chatHistories.get(targetJid);
            h.push({ role: "model", text: cleanText });
            if (h.length > 16) h.splice(0, h.length - 16);
            saveChatHistories();
          }

          item.dispatched = true;
          item.dispatchedAt = new Date().toISOString();
          processedItemsMap.set(itemKey, item);
          changed = true;
        } catch (sendErr) {
          console.error(`❌ [WhatsApp Send Failed] Could not deliver to ${targetJid}:`, sendErr.message);
          item.attempts = (item.attempts || 0) + 1;
          item.error = sendErr.message;
          if (item.attempts >= 5) {
            item.dispatched = true;
          }
          processedItemsMap.set(itemKey, item);
          changed = true;
        }
      }
    }

    if (changed) {
      // Re-fetch queue to preserve any new entries inserted by Vercel while we were sending WhatsApp messages
      let mergedQueue = queue;
      try {
        const latestRes = await querySupabase("app_settings?key=eq.whatsapp_dispatch_queue&select=value");
        const latestRaw = Array.isArray(latestRes) && latestRes[0]?.value ? JSON.parse(latestRes[0].value) : null;
        if (Array.isArray(latestRaw)) {
          mergedQueue = latestRaw.map((latestItem) => {
            const k = latestItem && (latestItem.id || `${latestItem.orderRef || ""}_${latestItem.status || ""}_${latestItem.createdAt || latestItem.phone}`);
            return (k && processedItemsMap.has(k)) ? processedItemsMap.get(k) : latestItem;
          });
        }
      } catch (_) {}
      await updateSupabaseAppSettings("whatsapp_dispatch_queue", JSON.stringify(mergedQueue.slice(-50)));
    }
  } catch (err) {
    // Ignore transient network errors during polling
  } finally {
    isPollingQueue = false;
  }
}

// Persistent record of confirmed Cashfree payments to prevent duplicate confirmation receipts
const confirmedPaymentsPath = path.join(__dirname, "confirmed_payments.json");
let confirmedPaymentIds = new Set();
if (fs.existsSync(confirmedPaymentsPath)) {
  try {
    const arr = JSON.parse(fs.readFileSync(confirmedPaymentsPath, "utf8"));
    if (Array.isArray(arr)) confirmedPaymentIds = new Set(arr);
  } catch (_) {}
}
function markPaymentProcessed(paymentId) {
  if (!paymentId) return;
  confirmedPaymentIds.add(paymentId);
  try {
    fs.writeFileSync(confirmedPaymentsPath, JSON.stringify(Array.from(confirmedPaymentIds).slice(-500), null, 2), "utf8");
  } catch (_) {}
}

// Send Instant Telegram Dispatch Card to Owner for Live Harvest & Delivery Routing
const notifiedTelegramOrderRefs = new Set();

async function sendTelegramDispatchCard(order, paymentInfo = {}) {
  const orderRef = order.orderRef || "LIVE";
  if (notifiedTelegramOrderRefs.has(orderRef)) {
    console.log(`[Telegram Dedup] Skipping duplicate dispatch card for #${orderRef}`);
    return;
  }

  const phone = order.phone || paymentInfo.phone || "Customer";
  const name = order.name || "Customer";
  const amtRaw = paymentInfo.amount || (order.amount ? String(order.amount).replace(/,/g, "").match(/\d+/)?.[0] : "");
  const amt = amtRaw ? String(amtRaw) : "";
  const clean10 = String(phone).replace(/\D/g, "").slice(-10);

  // Cross-process Supabase dedup with Vercel Cashfree webhook (`tg_lock_*` keys)
  try {
    const lockKeys = [
      `tg_lock_${orderRef}`,
      paymentInfo.paymentId ? `tg_lock_${paymentInfo.paymentId}` : null,
      (clean10.length === 10 && Number(amt) > 0) ? `tg_lock_amt_ph_${clean10}_${Math.round(Number(amt))}` : null
    ].filter(Boolean);
    if (lockKeys.length > 0 && SUPABASE_URL && SUPABASE_KEY) {
      const lockCheck = await querySupabase(`app_settings?key=in.(${lockKeys.map(k => encodeURIComponent(k)).join(",")})&select=key,updated_at`);
      if (Array.isArray(lockCheck) && lockCheck.some(r => r.updated_at && (Date.now() - new Date(r.updated_at).getTime() < 2 * 60 * 60 * 1000))) {
        notifiedTelegramOrderRefs.add(orderRef);
        console.log(`[Telegram Dedup] Webhook already dispatched Telegram alert for #${orderRef} — skipping duplicate.`);
        return;
      }
      await updateSupabaseAppSettings(`tg_lock_${orderRef}`, JSON.stringify({ ts: Date.now(), source: "whatsapp_agent" }));
    }
  } catch (_) {}

  if (notifiedTelegramOrderRefs.size >= 2000) {
    const oldestRef = notifiedTelegramOrderRefs.values().next().value;
    if (oldestRef !== undefined) notifiedTelegramOrderRefs.delete(oldestRef);
  }
  notifiedTelegramOrderRefs.add(orderRef);

  const mapsLink = order.googleMapsUrl || (order.latitude && order.longitude ? `https://maps.google.com/?q=${order.latitude},${order.longitude}` : null);
  const modeText = paymentInfo.mode || "J&K Bank mPay / Direct Transfer";
  const vpaLine = paymentInfo.vpa ? `🆔 <b>UPI ID:</b> <code>${paymentInfo.vpa}</code>\n` : "";
  const locationLine = mapsLink
    ? `📍 <b>Delivery:</b> <a href="${mapsLink}">1-Tap Google Maps Navigation ↗</a>\n`
    : (order.deliveryArea ? `📍 <b>Delivery Area:</b> ${order.deliveryArea}\n` : "");

  const html = `🐟 <b>ORDER CONFIRMED</b> ✅\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 <b>Order Number:</b> <code>#${orderRef}</code>\n` +
    `⚖️ <b>Quantity:</b> <b>${order.items || "Fresh Rainbow Trout"}</b>\n` +
    `👤 <b>Customer:</b> ${name} (<a href="tel:+91${clean10}">+91 ${clean10}</a>)\n` +
    `💳 <b>Payment Mode:</b> <b>${modeText}</b>\n` +
    vpaLine +
    `💰 <b>Total Amount:</b> <b>₹${amt || "Paid"}</b> [PAID ✅]\n` +
    `🤖 <b>Channel:</b> WhatsApp AI Sales Agent\n` +
    locationLine +
    (order.deliveryTime ? `⏰ <b>Delivery Slot:</b> ${order.deliveryTime}\n` : "") +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👉 <a href="https://wa.me/91${clean10}"><b>Open WhatsApp Chat with Customer</b></a>`;

  try {
    await sendTelegramMessage(html);
    console.log(`📢 [Telegram Dispatch Card Sent] Dispatched brief order card for #${orderRef} to Telegram.`);
  } catch (tgErr) {
    console.error("Failed to send Telegram dispatch alert:", tgErr.message);
  }
}

// Helper to resolve delivery slot and commitment message accurately
// Prevents confusing customer who requested tomorrow/advance delivery with "within 2 hours"
function resolveOrderDeliveryCommitment(order, targetJid, weatherPolicy) {
  let isAdvance = false;
  let slot = order?.deliveryTime || "";

  // Check order deliveryTime
  if (/(?:tomorrow|kal|sunday|monday|tuesday|wednesday|thursday|saturday|advance|morning\s*slot|afternoon\s*slot|evening\s*slot|today\s*(?:morning|afternoon|evening)|evening|afternoon)/i.test(slot)) {
    isAdvance = true;
  }

  // Check recent genuine customer messages in reverse chronological order (most recent preference wins)
  if (!isAdvance && targetJid && chatHistories && chatHistories.has(targetJid)) {
    const recent = (chatHistories.get(targetJid) || []).slice(-8);
    for (let i = recent.length - 1; i >= 0; i--) {
      const m = recent[i];
      if (!m || m.role !== "user") continue;
      const t = m.text || "";
      if (/^\[(?:SYSTEM|ADMIN|HOST)/i.test(t.trim()) || t.includes("[SYSTEM NOTE")) continue;
      const weekdayM = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|saturday)\b/i);
      if (weekdayM) {
        const dayCap = weekdayM[1].charAt(0).toUpperCase() + weekdayM[1].slice(1).toLowerCase();
        isAdvance = true;
        slot = /\bmorning\b/i.test(t) ? `${dayCap} Morning (8:00 AM – 11:00 AM)` : (/\bafternoon\b/i.test(t) ? `${dayCap} Afternoon (12:00 PM – 3:00 PM)` : (/\bevening\b/i.test(t) ? `${dayCap} Evening (4:00 PM – 7:00 PM)` : `${dayCap} (Advance Scheduled)`));
        break;
      } else if (/\b(?:tomorrow\s*morning|kal\s*subah|tomorrow\s*8\s*[-–]\s*11)\b/i.test(t)) {
        isAdvance = true;
        slot = "Tomorrow Morning (8:00 AM – 11:00 AM)";
        break;
      } else if (/\btomorrow\s*afternoon\b/i.test(t)) {
        isAdvance = true;
        slot = "Tomorrow Afternoon (12:00 PM – 3:00 PM)";
        break;
      } else if (/\btomorrow\s*evening\b/i.test(t)) {
        isAdvance = true;
        slot = "Tomorrow Evening (4:00 PM – 7:00 PM)";
        break;
      } else if (/\b(?:tomorrow|kal)\b/i.test(t) && !/\b(?:today|tonight|aaj)\b/i.test(t)) {
        isAdvance = true;
        slot = isThuClosedFriTomorrowIst() ? "Saturday Morning (8:00 AM – 11:00 AM)" : "Tomorrow (Scheduled Slot)";
        break;
      } else if (/\btoday\s*morning\b/i.test(t)) {
        isAdvance = true;
        slot = "Today Morning (8:00 AM – 11:00 AM)";
        break;
      } else if (/\btoday\s*afternoon\b/i.test(t)) {
        isAdvance = true;
        slot = "Today Afternoon (12:00 PM – 3:00 PM)";
        break;
      } else if (/\btoday\s*evening\b/i.test(t)) {
        isAdvance = true;
        slot = "Today Evening (4:00 PM – 7:00 PM)";
        break;
      }
    }
  }

  if (!slot || /within\s*(?:2\s*hours|90|120)/i.test(slot)) {
    if (!isAdvance) {
      const istNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const istHour = istNow.getHours();
      const istDay = istNow.getDay();
      if (istDay === 5 && !isFridayOperationsOpen()) {
        isAdvance = true;
        slot = "Saturday Morning (8:00 AM – 11:00 AM)";
      } else if (istHour >= 20) {
        isAdvance = true;
        slot = isThuClosedFriTomorrowIst()
          ? "Saturday Morning (8:00 AM – 11:00 AM)"
          : "Tomorrow Morning (8:00 AM – 11:00 AM)";
      } else if (istHour < 8) {
        isAdvance = true;
        slot = "Today Morning (8:00 AM – 11:00 AM)";
      } else {
        slot = "Within 90–120 Minutes (Today)";
      }
    }
  }

  const weatherSuffix = (!isAdvance && weatherPolicy?.deliverWithDelayWarning && weatherPolicy?.delayWarningText)
    ? `\n\n${weatherPolicy.delayWarningText}`
    : "";

  let commitment = "";
  if (isAdvance) {
    commitment = `Our farm team at Malabagh will harvest your trout live from our crystal-clear oxygenated cold water tanks, pack it fresh in food-grade biodegradable polythene (0% ice), and dispatch it via our express team during your scheduled slot: *${slot}*!`;
  } else {
    commitment = `Our farm team at Malabagh is now preparing your fresh live harvest from our crystal-clear oxygen-saturated cold water tanks, packed fresh in food-grade biodegradable polythene (0% ice), for express delivery to your shared location within 2 hours!${weatherSuffix}`;
  }

  return { slot, commitment, isAdvance };
}

// Cashfree Payment Poller: directly verifies pending Cashfree links every 3.5 seconds
let isCheckingCashfree = false;
let _lastAgedCashfreePollAt = 0;
async function checkPendingCashfreePayments(sock) {
  if (isCheckingCashfree) return;
  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) return;
  isCheckingCashfree = true;

  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    if (!fs.existsSync(ordersFilePath)) return;

    const orders = readOrdersCached(ordersFilePath);
    const nowMs = Date.now();
    const pollAged = (nowMs - _lastAgedCashfreePollAt) >= 60000;
    if (pollAged) _lastAgedCashfreePollAt = nowMs;

    // Poll recent (<= 6h) unpaid Cashfree links every 3.5s, and 6h–24h links once/minute
    const pendingOrders = [];
    for (const [k, ord] of Object.entries(orders)) {
      if (!ord) continue;
      const cfId = ord.cashfreeLinkId || (ord.paymentLinkId && ord.paymentLinkId.startsWith("link_") ? ord.paymentLinkId : null);
      const isPaid = /(?:paid|confirmed|harvest|dispatch|delivered|completed|cancelled|closed|refunded)/i.test(ord.status || "");
      const ageMs = nowMs - new Date(ord.updatedAt || ord.createdAt || 0).getTime();
      if (cfId && !isPaid && ageMs >= 0 && (ageMs <= 6 * 3600 * 1000 || (pollAged && ageMs <= 24 * 3600 * 1000))) {
        pendingOrders.push({ key: k, order: ord, cfId });
      }
    }

    if (pendingOrders.length === 0) return;

    for (const { key, order, cfId } of pendingOrders) {
      try {
        const linkStatus = await new Promise((resolve, reject) => {
          const req = https.request(`https://api.cashfree.com/pg/links/${cfId}`, {
            method: "GET",
            headers: {
              "x-client-id": CASHFREE_APP_ID,
              "x-client-secret": CASHFREE_SECRET_KEY,
              "x-api-version": CASHFREE_API_VERSION,
              "Content-Type": "application/json"
            },
            timeout: 8000
          }, (res) => {
            let data = "";
            res.on("data", c => { data += c; });
            res.on("end", () => {
              try { resolve({ statusCode: res.statusCode, data: JSON.parse(data) }); }
              catch (e) { resolve({ statusCode: res.statusCode, raw: data }); }
            });
          });
          req.on("error", reject);
          req.on("timeout", () => { req.destroy(); reject(new Error("Cashfree link check timeout")); });
          req.end();
        });

        if (linkStatus.statusCode === 200 && linkStatus.data && (linkStatus.data.link_status === "PAID" || linkStatus.data.link_amount_paid > 0)) {
          const paidAmt = linkStatus.data.link_amount_paid || linkStatus.data.link_amount;
          const targetOrderRef = order.orderRef || `UT-CF-${Date.now().toString().slice(-6)}`;

          if (confirmedPaymentIds.has(cfId)) continue;
          confirmedPaymentIds.add(cfId);

          console.log(`\n🎉 [Instant Payment Confirmed via Cashfree!] Link ID: ${cfId} for ₹${paidAmt} (${targetOrderRef})`);

          // Fetch UPI details from order payments
          let upiVpa = "";
          let bankRef = "";
          try {
            const ordersRes = await new Promise((resolve, reject) => {
              const req = https.request(`https://api.cashfree.com/pg/links/${cfId}/orders`, {
                method: "GET",
                headers: {
                  "x-client-id": CASHFREE_APP_ID,
                  "x-client-secret": CASHFREE_SECRET_KEY,
                  "x-api-version": CASHFREE_API_VERSION
                },
                timeout: 5000
              }, res => {
                let d = "";
                res.on("data", c => { d += c; });
                res.on("end", () => { try { resolve(JSON.parse(d)); } catch (_) { resolve([]); } });
              });
              req.on("error", reject);
              req.on("timeout", () => { req.destroy(); resolve([]); });
              req.end();
            });

            if (Array.isArray(ordersRes) && ordersRes[0]?.order_id) {
              const paymentsRes = await new Promise((resolve, reject) => {
                const req = https.request(`https://api.cashfree.com/pg/orders/${ordersRes[0].order_id}/payments`, {
                  method: "GET",
                  headers: {
                    "x-client-id": CASHFREE_APP_ID,
                    "x-client-secret": CASHFREE_SECRET_KEY,
                    "x-api-version": CASHFREE_API_VERSION
                  },
                  timeout: 5000
                }, res => {
                  let d = "";
                  res.on("data", c => { d += c; });
                  res.on("end", () => { try { resolve(JSON.parse(d)); } catch (_) { resolve([]); } });
                });
                req.on("error", reject);
                req.on("timeout", () => { req.destroy(); resolve([]); });
                req.end();
              });

              if (Array.isArray(paymentsRes) && paymentsRes.length > 0) {
                const successfulPay = paymentsRes.find(p => p.payment_status === "SUCCESS") || paymentsRes[0];
                upiVpa = successfulPay.payment_method?.upi?.upi_id || "";
                bankRef = successfulPay.bank_reference || "";
                order.paymentId = successfulPay.cf_payment_id || cfId;
              }
            }
          } catch (detailErr) {
            console.warn("[Cashfree Details Warning]:", detailErr.message);
          }

          // Target WhatsApp recipient
          const targetPhone = order.phone || key;
          let targetJid = order.chatId;
          if (!targetJid && targetPhone) {
            for (const [jid, meta] of Object.entries(chatMetadata)) {
              if (meta.phone && meta.phone.endsWith(String(targetPhone).slice(-10))) {
                targetJid = jid;
                break;
              }
            }
          }
          if (!targetJid && targetPhone && String(targetPhone).replace(/\D/g, "").length >= 10) {
            targetJid = `91${String(targetPhone).replace(/\D/g, "").slice(-10)}@s.whatsapp.net`;
          }

          const targetItems = order.items || "Cleaned & Gutted Trout";
          const cfWeatherPolicy = evaluateWeatherDeliveryPolicy(order?.distanceKm);
          const { slot: finalSlot, commitment: deliveryCommitment } = resolveOrderDeliveryCommitment(order, targetJid, cfWeatherPolicy);

          order.orderRef = targetOrderRef;
          order.status = "Paid & Confirmed (Live Harvest Pending)";
          order.paidAt = new Date().toISOString();
          if (!order.paymentId) order.paymentId = `cf_${cfId}`;
          order.amount = `₹${paidAmt} [PAID via Cashfree]`;
          order.paymentGateway = "Cashfree";
          order.deliveryTime = finalSlot;

          recordNewCustomerOrder(key, order);
          markPaymentProcessed(cfId);
          if (order.paymentId) markPaymentProcessed(order.paymentId);

          if (targetJid && chatMetadata[targetJid]) {
            chatMetadata[targetJid].followUpSent = true;
            saveChatMetadata();
          }

          // Sync to Supabase
          syncWhatsAppOrderToSupabase(order, order.paymentId).catch(() => {});

          if (targetPhone && paidAmt > 0) {
            autoSettleKhataInSupabase(targetPhone, paidAmt, order.paymentId, targetOrderRef);
          }

          const hasCfGps = Boolean(order.latitude || (chatMetadata[targetJid] && chatMetadata[targetJid].latitude));
          const receiptMsg = buildPaymentConfirmedReceipt({
            orderRef: targetOrderRef,
            itemsDesc: targetItems,
            paidAmt,
            finalSlot,
            deliveryCommitment,
            hasGps: hasCfGps,
            gatewayLabel: "Cashfree UPI"
          });

          if (targetJid && sock) {
            try {
              const sentReceipt = await sock.sendMessage(targetJid, { text: receiptMsg });
              if (sentReceipt?.key?.id) {
                botSentMessageIds.add(sentReceipt.key.id);
                setTimeout(() => botSentMessageIds.delete(sentReceipt.key.id), 10 * 60 * 1000);
              }
              console.log(`✅ [Instant Cashfree WhatsApp Receipt Sent] Delivered directly to ${targetJid}!`);
            } catch (sendErr) {
              console.error("Failed to send WhatsApp confirmation receipt:", sendErr.message);
            }

            if (chatHistories.has(targetJid)) {
              const h = chatHistories.get(targetJid);
              h.push({ role: "model", text: receiptMsg });
              saveChatHistories();
            }
          }

          // Send Telegram Dispatch Card (deduped across Vercel webhook & VPS poller)
          await sendTelegramDispatchCard(order, {
            amount: paidAmt,
            phone: targetPhone,
            paymentId: order.paymentId,
            vpa: upiVpa || "Cashfree Instant UPI",
            mode: "Cashfree 0% Gateway"
          });
        }
      } catch (checkErr) {
        console.warn(`[Cashfree Link Check Warning for ${cfId}]:`, checkErr.message);
      }
    }
  } catch (err) {
    // Silent catch
  } finally {
    isCheckingCashfree = false;
  }
}

// Look up existing order by customer phone number, LID, or explicit order reference
async function lookupCustomerOrder(chatId, customerPhone, userMessage) {
  let cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);

  // Check if this chat/LID was previously verified & linked to a real 10-13 digit phone number (never coerce 14+ digit LIDs)
  const resolved = resolveCustomerPhone(chatId);
  const resolvedDigits = String(resolved || "").replace(/\D/g, "");
  if (resolvedDigits.length >= 10 && !/^\d{14,}$/.test(resolvedDigits)) {
    cleanPhone = resolvedDigits.slice(-10);
  }

  const isCallerOwner = cleanPhone === "7006604148" || String(chatId || "").includes("174637916885151");

  // Extract EXPLICIT order reference keyword ONLY (e.g. "order #1234", "order id UT-WA-1234", "UT-WA-12345", "#4567")
  const explicitRefMatch = String(userMessage || "").match(
    /(?:(?:#|\b(?:order|ord|ref|receipt|invoice)\s*(?:id|number|no|num)?\s*[:#]?\s*)(UT-[A-Z0-9-]{4,}|[0-9]{4,12})\b|\b(UT-(?:WA|CF|WEB|POS)-[A-Z0-9-]{3,}|UT-[A-Z0-9]{4,})\b)/i
  );
  const potentialRef = explicitRefMatch ? (explicitRefMatch[1] || explicitRefMatch[2] || "").trim() : null;

  // Pre-sales inquiries are NOT order tracking (keep "how much time / how much longer" allowed for order tracking)
  const isPreSalesQuery = /\b(?:like\s*to\s*order|want\s*to\s*order|place\s*(?:an?\s*)?order|buy\s*fresh|price|rate|rates|cost|available|order\s*karna|khareedna|chahiye|menu|options?)\b/i.test(userMessage) ||
    /\bhow\s*much\b(?!\s*(?:time|long|longer))/i.test(userMessage);

  // Check if customer is genuinely asking about order tracking, status, or delivery timing of an already placed order
  const isAskingOrder = !isPreSalesQuery && /(?:where\s*is\s*(?:my\s*)?order|order\s*(?:status|id|number|no|num|update|dispatch)|track\s*(?:my\s*)?order|\bmy\s*order\b|dispatch\s*status|check\s*(?:my\s*)?order|when\s*will\s*(?:my\s*)?order\s*(?:arrive|deliver|reach|come)|order\s*kab\s*(?:aayega|pahonchega)|order\s*deliver\s*(?:hua|karo|hoga)|how\s*much\s*(?:time|more|longer)|(?:phone\s*(?:no|num|number)|contact)\s*(?:of\s*)?(?:delivery|rider|driver)|(?:delivery\s*(?:boy|partner|rider|guy|executive)|rider|driver)\s*(?:phone|number|contact|kaha|where|status|kab))/i.test(userMessage);

  if (!isAskingOrder && !potentialRef) {
    return null;
  }

  // 1. Check local persistent store
  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    if (fs.existsSync(ordersFilePath)) {
      const orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));

      // Match by verified phone or chatId
      if (isAskingOrder) {
        const matches = [];
        for (const [phoneKey, ord] of Object.entries(orders)) {
          if (!ord) continue;
          const isOwnerCmd = ord.createdBy === "OWNER_WHATSAPP_COMMAND";
          if (isCallerOwner) {
            if (isOwnerCmd || (ord.phone && !String(ord.phone).endsWith("7006604148"))) continue;
          }
          if (
            (cleanPhone && (phoneKey === cleanPhone || (ord.phone && String(ord.phone).endsWith(cleanPhone)))) ||
            (!isOwnerCmd && ord.chatId && ord.chatId === chatId)
          ) {
            matches.push(ord);
          }
        }
        if (matches.length > 0) {
          matches.sort((a, b) => {
            const aActive = isOrderActivePending(a) ? 1 : 0;
            const bActive = isOrderActivePending(b) ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            const aConfirmed = /(?:paid|confirmed|harvest|dispatch)/i.test(a.status || "") ? 1 : 0;
            const bConfirmed = /(?:paid|confirmed|harvest|dispatch)/i.test(b.status || "") ? 1 : 0;
            if (aConfirmed !== bConfirmed) return bConfirmed - aConfirmed;
            const aTime = new Date(a.updatedAt || a.paidAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.updatedAt || b.paidAt || b.createdAt || 0).getTime();
            return bTime - aTime;
          });

          const bestMatch = matches[0];
          const isTodayOrder = (Date.now() - new Date(bestMatch.updatedAt || bestMatch.paidAt || bestMatch.createdAt || 0).getTime()) < (24 * 60 * 60 * 1000);
          if (isOrderActivePending(bestMatch) || isTodayOrder) {
            console.log(`[Order Recognition] Found active match for ${cleanPhone || chatId}:`, bestMatch.orderRef, bestMatch.status);
            return bestMatch;
          } else {
            console.log(`[Order Recognition] Customer ${cleanPhone || chatId} has historical completed order #${bestMatch.orderRef} (${bestMatch.status}), but no active unfulfilled order today.`);
            return null;
          }
        }
      }

      // Match across caller-owned orders by exact explicit order reference (prevents querying stranger orders!)
      if (potentialRef) {
        const lowerRef = potentialRef.toLowerCase();
        for (const [phoneKey, ord] of Object.entries(orders)) {
          if (!ord || !ord.orderRef) continue;
          const ordRefLower = String(ord.orderRef).toLowerCase();
          const refMatches =
            ordRefLower === lowerRef ||
            ordRefLower.endsWith(`-${lowerRef}`) ||
            ordRefLower === `ut-wa-${lowerRef}` ||
            ordRefLower === `ut-cf-${lowerRef}`;
          if (!refMatches) continue;
          const ordPhone = String(ord.phone || "").replace(/\D/g, "").slice(-10);
          const isOwned =
            isCallerOwner ||
            (cleanPhone && (phoneKey === cleanPhone || ordPhone === cleanPhone)) ||
            (ord.chatId && ord.chatId === chatId && ord.createdBy !== "OWNER_WHATSAPP_COMMAND");
          if (isOwned) {
            console.log(`[Order Recognition] Matched order ${ord.orderRef} in local store`);
            return ord;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Local orders store read error:", err.message);
  }

  // 2. Check recent (<= 48h) Supabase vending_sales_log
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const since48hIso = encodeURIComponent(new Date(Date.now() - 48 * 3600 * 1000).toISOString());
      if (isAskingOrder && cleanPhone && cleanPhone.length === 10) {
        const logs = await querySupabase(`vending_sales_log?created_at=gte.${since48hIso}&or=(notes.ilike.%25${cleanPhone}%25,custom_fields->>customer_phone.eq.${cleanPhone})&order=created_at.desc&limit=1`);
        if (Array.isArray(logs) && logs[0]) {
          const log = logs[0];
          const logPhone = log.custom_fields?.customer_phone;
          const logNotes = log.notes || "";
          if (logPhone === cleanPhone || logNotes.includes(cleanPhone)) {
            console.log(`[Order Recognition] Found in Supabase vending_sales_log for ${cleanPhone}`);
            return {
              orderRef: log.notes?.match(/\[(?:PAID ✓ )?([A-Za-z0-9\-_]+)/)?.[1] || "Live Harvest Order",
              name: log.custom_fields?.customer_name || "Valued Customer",
              amount: `₹${log.amount_paid || 0}`,
              status: "Live Harvest Confirmed / Dispatched",
              deliveryArea: "Srinagar",
              deliveryTime: "Completed / Dispatched",
              items: `${log.weight_kg || log.weight_sold || 2} kg Rainbow Trout`
            };
          }
        }
      }

      if (potentialRef && potentialRef.length >= 4 && (isCallerOwner || (cleanPhone && cleanPhone.length === 10))) {
        const encRef = encodeURIComponent(potentialRef);
        const matchedLogs = await querySupabase(`vending_sales_log?created_at=gte.${since48hIso}&notes.ilike.%25${encRef}%25&order=created_at.desc&limit=1`);
        if (Array.isArray(matchedLogs) && matchedLogs[0]) {
          const log = matchedLogs[0];
          const logPhone = String(log.custom_fields?.customer_phone || "").replace(/\D/g, "").slice(-10);
          const ownerOrMatch = isCallerOwner || !logPhone || logPhone === cleanPhone;
          if (ownerOrMatch && log.notes && log.notes.toLowerCase().includes(potentialRef.toLowerCase())) {
            return {
              orderRef: `#${potentialRef}`,
              name: log.custom_fields?.customer_name || "Valued Customer",
              amount: `₹${log.amount_paid || 0}`,
              status: "Recorded on File",
              deliveryArea: "Srinagar",
              deliveryTime: "Scheduled Slot",
              items: `${log.weight_kg || log.weight_sold || 2} kg Rainbow Trout`
            };
          }
        }
      }
    } catch (err) {
      console.warn("Supabase order lookup notice:", err.message);
    }
  }

  // If customer inquired about a specific order number but it was not found
  if (potentialRef && potentialRef.length >= 4) {
    return {
      notFound: true,
      queryRef: potentialRef
    };
  }

  return null;
}


// Knowledge base cache with 30-second TTL (hot-reload without per-message disk I/O)
let _kbCache = null;
let _kbCacheTime = 0;

// Function to dynamically load knowledge base on every query (cached with 30s TTL)
function getSystemPrompt() {
  if (_kbCache && (Date.now() - _kbCacheTime) < 30000) return _kbCache;
  const kbPath = path.join(__dirname, "KNOWLEDGE_BASE.md");
  try {
    if (fs.existsSync(kbPath)) {
      _kbCache = fs.readFileSync(kbPath, "utf-8");
      _kbCacheTime = Date.now();
      return _kbCache;
    }
  } catch (e) {
    console.error("Error reading KNOWLEDGE_BASE.md:", e);
  }
  return "You are Suhail, sales manager at Urban Trout Aquaculture, Malabagh, Srinagar. Strictly 16km radius delivery across Srinagar (Tiered MOQ: 2kg/3kg/5kg).";
}

// Extract clean, human customer name (ignoring internal CRM tags, numbers, and localities)
function extractCleanCustomerName(rawName) {
  if (!rawName) return null;
  let n = String(rawName).replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, "").trim();
  n = n.replace(/^UT\s*[•★🔥*~-]*\s*[•★🔥*~-]*\s*/i, "").trim();
  n = n.replace(/\s*\([^)]*\)\s*$/i, "").trim();
  n = n.replace(/\s*-\s*[A-Za-z\s]+$/i, "").trim();

  // Strip ending buyer/customer/lead/etc.
  n = n.replace(/\s*(?:buyer|customer|lead|inquiry|visitor|store\s*visit)\s*#?\d*$/i, "").trim();

  if (/^(?:valued|valued\s*customer|customer|buyer|lead|inquiry|price\s*inquiry|delivery\s*inquiry|store\s*visit|hot\s*lead|visitor|srinagar|malabagh)/i.test(n)) return null;
  if (/(?:lead\s*#|inquiry\s*#|visit\s*#|buyer\s*#)/i.test(n)) return null;
  if (/^\+?\d+$/.test(n.replace(/\s+/g, ""))) return null;
  if (/^(?:srinagar|malabagh|kashmir|lalbazar|hazratbal|zakura|ahmad\s*nagar|hyderpora|rajbagh|chanapora|soura|hmt|shalimar|harwan|nishat|naseem\s*bagh)$/i.test(n)) return null;
  if (n.length < 2 || n.length > 35) return null;
  return n;
}

// Helper to detect if current IST time is evening rush surge window (4:00 PM – 7:59 PM)
function isCurrentEveningSurge() {
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = istDate.getHours();
  return hour >= 16 && hour < 20;
}

// Single source of truth for Srinagar 4-Tier Delivery Fees
function getDeliveryFeeForDistance(distKm, weightKg, isSurgeOverride) {
  const hasDist =
    distKm !== null &&
    distKm !== undefined &&
    typeof distKm !== "boolean" &&
    String(distKm).trim() !== "" &&
    Number.isFinite(Number(distKm));
  const dist = hasDist ? Number(distKm) : 2.0;
  const w = Number.isFinite(Number(weightKg)) && Number(weightKg) > 0 ? Number(weightKg) : 1;
  const isSurge = isSurgeOverride !== undefined ? Boolean(isSurgeOverride) : isCurrentEveningSurge();
  const surgeAdd = isSurge ? 40 : 0;

  if (dist <= 4.0) {
    // Tier 1 (0-4 km): Free on 2kg+, 1kg = ₹45 (+₹40 evening)
    return w >= 2 ? 0 : (45 + surgeAdd);
  } else if (dist <= 7.0) {
    // Tier 2 (4-7 km): Free on 3kg+, 2kg = ₹55, 1kg = ₹75 (+₹40 evening)
    if (w >= 3) return 0;
    if (w >= 2) return 55 + surgeAdd;
    return 75 + surgeAdd;
  } else if (dist <= 11.5) {
    // Tier 3 (7-11.5 km): Free on 3kg+, 2kg = ₹89, 1kg = ₹130 (+₹40 evening)
    if (w >= 3) return 0;
    if (w >= 2) return 89 + surgeAdd;
    return 130 + surgeAdd;
  } else {
    // Tier 4 (11.5-16 km — South Corridor, Lal Chowk, Rajbagh, Jawahar Nagar, Batamaloo, Sanat Nagar, Peerbagh, Airport Rd, Nowgam):
    // Free on 5kg+, 4kg = ₹109, 3kg = ₹129, 2kg = ₹139, 1kg = ₹190 (+₹40 evening)
    if (w >= 5) return 0;
    if (w >= 4) return 109 + surgeAdd;
    if (w >= 3) return 129 + surgeAdd;
    if (w >= 2) return 139 + surgeAdd;
    return 190 + surgeAdd;
  }
}

// Calculate exact reorder pricing and description based on distance and past cut (4-Tier Model)
function calculateReorderPricing(weightKg, cutType, distKm, isSurgeOverride) {
  const w = Number.isFinite(Number(weightKg)) && Number(weightKg) > 0 ? Number(weightKg) : 2;
  const safeCut = String(cutType || "Cleaned & Gutted").trim() || "Cleaned & Gutted";
  const isWhole = safeCut.toLowerCase().includes("whole");
  const baseRate = isWhole ? 540 : 580;
  const fishCost = Math.round(w * baseRate);
  const fee = getDeliveryFeeForDistance(distKm, w, isSurgeOverride);

  if (fee === 0) {
    return { amount: fishCost, tagDesc: `${w} kg ${safeCut}` };
  }
  return { amount: fishCost + fee, tagDesc: `${w} kg ${safeCut} (+Express Delivery)` };
}

// Find closest human-friendly neighbourhood name from 453-landmark deliveryZoneDb for raw GPS coords
function resolveNearestLocalityName(lat, lng) {
  if (!deliveryZoneDb || !deliveryZoneDb.length || lat == null || lng == null) return null;
  let best = null;
  let bestScore = Infinity;
  for (const p of deliveryZoneDb) {
    if (p.lat == null || p.lon == null || !p.name) continue;

    // Filter out institutional POIs (places of worship/mosques, hospitals, clinics, hotels, fuel, banks, schools, police)
    // so we return actual residential neighborhoods / settlements / junctions to customers!
    const pType = String(p.type || "").toLowerCase();
    if (/^(?:place_of_worship|hospital|clinic|hotel|school|college|bank|fuel|supermarket|mall|police|blood_bank|bus_stop|bus_station|driving_school)$/.test(pType)) continue;

    // Never return competitor, religious, or institutional building names (e.g. Masjid, Hospital, Khyber)
    const pName = String(p.name || "").toLowerCase();
    if (pName.includes("khyber")) continue;
    if (/^(?:masjid|mosque|shrine|ziyarat|ziarat|astana|mandir|temple|gurudwara|church|hotel|hospital|clinic|nursing\s*home)\b/i.test(pName)) continue;
    if (Array.isArray(p.aliases) && p.aliases.some(a => String(a).toLowerCase().includes("khyber"))) continue;

    const d = calculateDistance(lat, lng, Number(p.lat), Number(p.lon));
    const hasAlias = Array.isArray(p.aliases) && p.aliases.length > 0;
    const penalty = hasAlias ? 0 : 0.25;
    if (d + penalty < bestScore) {
      bestScore = d + penalty;
      best = { place: p, rawKm: d };
    }
  }
  if (!best || best.rawKm > 2.5) return null;
  const p = best.place;
  const resolved = (Array.isArray(p.aliases) && p.aliases[0]) ? p.aliases[0] : p.name;
  if (/khyber/i.test(resolved)) return "Khayam";
  return resolved;
}

// Customer-shareable, copy-paste ready #location delivery rate quote formatter (Cleaned & Gutted pan-ready pieces only)
function buildLocationRateQuote({ name, dist, status }) {
  const distDisplay = dist != null && !isNaN(dist) ? Number(dist).toFixed(1) : null;
  if (status === "OUT_ZONE" || (dist != null && dist > 16.0)) {
    return (
      `📍 *Urban Trout Delivery Check — ${name}*\n` +
      (distDisplay
        ? `_(Approx. ${distDisplay} km from our Recirculatory Aquaculture System at Malabagh — Outside 16.0 km Express Delivery Perimeter)_\n\n`
        : `_(Outside our 16.0 km Express Delivery Perimeter)_\n\n`) +
      `To guarantee peak live-harvest freshness within 90–120 minutes (packed fresh in food-grade biodegradable polythene with 0% ice), express delivery operates strictly within *16.0 km* across Srinagar & nearby Ganderbal.\n\n` +
      `🏪 *Fresh Live Counter Pickup Available at Malabagh:*\n` +
      `• *Cleaned, Gutted & Pan-Ready Pieces:* ₹580 / kg\n` +
      `• *Location:* Live Vending Center, Near R.P. School Girls Wing, Malabagh, Srinagar\n` +
      `• *Timings:* 8:00 AM – 8:00 PM _(Sat–Thu, closed Fridays)_\n` +
      `• *Google Maps:* https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9`
    );
  }

  const d = dist != null && !isNaN(dist) ? Number(dist) : 2.0;
  let freeMinKg = 2;
  let belowWeights = [1];

  if (d <= 4.0) {
    freeMinKg = 2;
    belowWeights = [1];
  } else if (d <= 7.0) {
    freeMinKg = 3;
    belowWeights = [2, 1];
  } else if (d <= 11.5) {
    freeMinKg = 3;
    belowWeights = [2, 1];
  } else {
    freeMinKg = 5;
    belowWeights = [4, 3, 2, 1];
  }

  const freeTotal = (freeMinKg * 580).toLocaleString("en-IN");
  const isEveningNow = isCurrentEveningSurge();
  const locWeather = typeof evaluateWeatherDeliveryPolicy === "function"
    ? evaluateWeatherDeliveryPolicy(d)
    : { blockedByWeather: false, deliverWithDelayWarning: false };
  const wetLimitKm = typeof WEATHER_RESTRICT_RADIUS_KM !== "undefined" ? WEATHER_RESTRICT_RADIUS_KM : 6.0;
  let weatherBanner = "";
  if (locWeather.blockedByWeather) {
    weatherBanner = `${locWeather.weatherIcon} *ACTIVE WEATHER HOLD (${locWeather.weatherTitle.toUpperCase()}):* Location is beyond *${wetLimitKm} km* — automated express delivery is temporarily *PAUSED* during ${locWeather.weatherNoun} until weather clears.\n\n` +
      `_(Standard clear-weather rates below for reference; Malabagh Live Vending Center pickup remains open)_\n\n`;
  } else if (locWeather.deliverWithDelayWarning) {
    weatherBanner = `${locWeather.weatherIcon} *WEATHER ADVISORY (${locWeather.weatherTitle.toUpperCase()}):* Express delivery within *${wetLimitKm} km* is active with possible slight weather delay.\n\n`;
  }

  const belowLines = belowWeights.map((kg) => {
    const feeDay = getDeliveryFeeForDistance(d, kg, false);
    const fishPrice = (kg * 580).toLocaleString("en-IN");
    const totalDay = (kg * 580 + feeDay).toLocaleString("en-IN");
    if (isEveningNow) {
      const feeEve = feeDay + 40;
      const totalEve = (kg * 580 + feeEve).toLocaleString("en-IN");
      return `• *${kg} kg:* ₹${fishPrice} + ₹${feeEve} delivery *(evening rush)* = *₹${totalEve} total* _(Daytime: +₹${feeDay} = ₹${totalDay})_`;
    }
    return `• *${kg} kg:* ₹${fishPrice} + ₹${feeDay} delivery = *₹${totalDay} total*`;
  }).join("\n");

  return (
    `📍 *Urban Trout Delivery Details — ${name}*\n` +
    (distDisplay ? `_(Approx. ${distDisplay} km from our Recirculatory Aquaculture System at Malabagh)_\n\n` : `\n`) +
    weatherBanner +
    `🐟 *Fresh Live-Harvested Trout (Cleaned, Gutted & Cut into Pan-Ready Pieces):*\n` +
    `• *Rate:* ₹580 / kg\n` +
    `• *Packaging:* 100% food-grade biodegradable polythene (0% ice)\n\n` +
    `🛵 *100% FREE Express Delivery:*\n` +
    `• *${freeMinKg} kg & above:* FREE Delivery (*₹${freeTotal}* total for ${freeMinKg} kg)\n\n` +
    `📦 *Standard Express Delivery (Orders below ${freeMinKg} kg):*\n` +
    `${belowLines}\n\n` +
    `⚡ _Note: Evening rush hours (4:00 PM – 8:00 PM) carry a +₹40 express fee surcharge on orders below ${freeMinKg} kg; ${freeMinKg} kg+ remains 100% FREE._\n\n` +
    `📌 *Pin-Point Delivery Policy:* Please share your *WhatsApp Location Pin or Google Maps link* to book. Our Express Dispatch Partner delivers directly to your shared GPS pin (not house numbers). Kindly keep your phone reachable so our rider can call prior to arrival for a prompt, seamless handover at your shared pin. 🐟`
  );
}

// Safe extraction of clean personal name from WhatsApp pushName
function extractCleanWhatsAppName(pushName) {
  if (!pushName) return null;
  const sanitized = typeof sanitizeRawContactName === "function" ? sanitizeRawContactName(pushName) : null;
  let n = sanitized ? sanitized.cleanName : String(pushName).trim();
  if (!n) return null;
  n = n.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, "").trim();
  n = n.replace(/^[~•*-\s]+/, "").trim();
  n = n.replace(/[^\w\s.']/gi, "").trim();
  if (/^\+?\d+$/.test(n.replace(/[\s\-()]/g, ""))) return null;
  if (/^(?:valued\s*customer|customer|user|buyer|lead|srinagar|kashmir|urban\s*trout(?:\s*aquaculture)?|aquaculture|none|null|unknown|guest|assalam[-\s]*o?[-\s]*alaikum|assalamu\s*alaikum|asalamualikum|salam)$/i.test(n)) return null;
  if (/\b(?:lead|buyer)\s*\(?\d{3,4}\)?$/i.test(n) || /^UT\b/i.test(n)) return null;
  if (n.length < 2 || n.length > 30) return null;
  if (!/[a-zA-Z]/.test(n)) return null;
  return n;
}

// Resolve customer display name safely: prefer clean WhatsApp pushName; ignore renamed CRM contacts with internal notes/titles
function resolveCustomerDisplayName(pushName, contactFullName) {
  const cleanPush = extractCleanWhatsAppName(pushName);
  if (cleanPush) return cleanPush;

  if (contactFullName) {
    let n = String(contactFullName).replace(/^UT\s*[•★🔥*~-]*\s*[•★🔥*~-]*\s*/i, "").trim();
    // Strip trailing parenthetical locality like (Soura), (Malabagh), (Zakura)
    n = n.replace(/\s*\([^)]*\)\s*$/i, "").trim();

    // Check if what remains still has notes, dashes, job titles, or CRM tags
    const hasUnsafeNotes = /[-–—#]|\b(?:advocate|adv|doctor|dr|eng|engineer|lead|buyer|customer|from|colony|sector)\b/i.test(n);
    if (!hasUnsafeNotes) {
      if (n.length >= 2 && n.length <= 30 && !/^(?:valued|customer|buyer|lead)/i.test(n)) {
        return n;
      }
    }
  }

  return null;
}

// Persistent WhatsApp Contact Map (Captures pushName from Baileys events and incoming messages)
const contactsMapPath = path.join(__dirname, "whatsapp_contacts_map.json");
let whatsappContactsMap = {};
if (fs.existsSync(contactsMapPath)) {
  try {
    whatsappContactsMap = JSON.parse(fs.readFileSync(contactsMapPath, "utf8"));
  } catch (_) {}
}

let contactMapSaveTimeout = null;
function saveWhatsAppContact(jid, rawName) {
  if (!jid || !rawName) return;
  const cleanName = extractCleanWhatsAppName(rawName);
  if (!cleanName) return;

  const cleanPhone = resolveCustomerPhone(jid);
  const cleanJid = String(jid).replace("@lid", "").replace("@s.whatsapp.net", "");
  const now = new Date().toISOString();

  let changed = false;
  const record = { name: cleanName, rawName, jid, updatedAt: now };

  if (cleanPhone && cleanPhone.length >= 10) {
    const raw10 = cleanPhone.slice(-10);
    if (!whatsappContactsMap[raw10] || whatsappContactsMap[raw10].name !== cleanName) {
      whatsappContactsMap[raw10] = record;
      changed = true;
    }
  }
  if (!whatsappContactsMap[cleanJid] || whatsappContactsMap[cleanJid].name !== cleanName) {
    whatsappContactsMap[cleanJid] = record;
    changed = true;
  }
  if (!whatsappContactsMap[jid] || whatsappContactsMap[jid].name !== cleanName) {
    whatsappContactsMap[jid] = record;
    changed = true;
  }

  if (changed) {
    if (contactMapSaveTimeout) clearTimeout(contactMapSaveTimeout);
    contactMapSaveTimeout = setTimeout(() => {
      try {
        fs.writeFileSync(contactsMapPath, JSON.stringify(whatsappContactsMap, null, 2), "utf8");
      } catch (_) {}
    }, 1000);
  }
}

// Detect explicit order quantity intent: e.g. "Send 2kg", "2kg cleaned", "3 kg bhej do", "1kg", "4kg", "Send 4kg to Qamarwari"
function parseCustomerQuantityRequest(userMessage) {
  if (!userMessage) return null;
  const msg = String(userMessage).trim();

  // Never parse cancellations, negations, or Cash-on-Delivery insistence as an active order quantity
  if (/\b(?:don'?t|do\s*not|not\s*(?:ordering|buying|now)|cancel|no\s*need|nahi\s*chahiye|mat\s*bhejo|cash\s*on\s*delivery|paid\s*on\s*delivery|pay\s*on\s*delivery|cod)\b/i.test(msg)) {
    return null;
  }

  const isOnlyPriceQuestion = /^(?:what\s*is\s*(?:the\s*)?rate|kitne\s*ka\s*hai|kya\s*rate\s*hai|price\s*of|how\s*much\s*is|rate\s*kya\s*hai)\b/i.test(msg) ||
                              /\b(?:kitne\s*ka\s*hai|rate\s*kya\s*hai|how\s*much\s*for)\b/i.test(msg);
  if (isOnlyPriceQuestion && !/\b(?:send|bhej|order|book|deliver|pack)\b/i.test(msg)) {
    return null;
  }

  let weightKg = null;
  // 1. Explicit number with mandatory kg/kilo unit (prevents 'deliver at 5 PM', 'house 4' from being parsed as kg)
  const numWithUnit = msg.match(/\b(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?)\b/i);
  // 2. Number words MUST have mandatory kg/kilo unit (prevents Urdu/Hindi verb "bhej do" or "two hours" from matching 2 kg!)
  const wordNumMatch = msg.match(/\b(ek|do|teen|chaar|char|paanch|panch|one|two|three|four|five)\s*(?:kgs?|kilos?)\b/i);
  // 3. Standalone number ONLY if paired with an explicit order verb or trout cut (excluding time/currency/address/pieces)
  const contextNum = msg.match(/(?:send|order|pack|need|want|bhej|bhejo|chahiye|give)\s+(\d+(?:\.\d+)?)(?!\s*(?:pm|am|o'?clock|baje|hours?|mins?|minutes?|rs|inr|₹|hundred|thousand|flat|lane|house|sector|ward|road|pieces?|pcs?|guests?|people|members?))\b/i) ||
                     msg.match(/\b(\d+(?:\.\d+)?)\s+(?:cleaned|gutted|whole|steaks?)\b/i);

  if (numWithUnit && numWithUnit[1]) {
    const parsed = parseFloat(numWithUnit[1]);
    if (parsed >= 1 && parsed <= 50) {
      weightKg = parsed;
    }
  } else if (wordNumMatch) {
    const wordMap = {
      ek: 1, one: 1,
      do: 2, two: 2,
      teen: 3, three: 3,
      chaar: 4, char: 4, four: 4,
      paanch: 5, panch: 5, five: 5
    };
    weightKg = wordMap[wordNumMatch[1].toLowerCase()] || null;
  } else if (contextNum && contextNum[1]) {
    const parsed = parseFloat(contextNum[1]);
    if (parsed >= 1 && parsed <= 50) {
      weightKg = parsed;
    }
  }

  if (!weightKg) return null;

  let localityName = null;
  let localityDist = null;
  const locDet = detectSrinagarLocality(msg);
  if (locDet && locDet.status === "IN_ZONE") {
    localityName = locDet.name;
    localityDist = locDet.dist;
  }

  const isOrderIntent = /^(?:send|bhej|bhejo|deliver|pack|book|order|chahiye|need|want|give|lao|kar\s*do|bhej\s*do|deliver\s*karo)\b/i.test(msg) ||
                        /\b(?:send|bhej|bhejo|deliver|pack|book|order|chahiye|need|want|give|lao|kar\s*do|bhej\s*do|deliver\s*karo)\b/i.test(msg) ||
                        Boolean((numWithUnit || wordNumMatch) && (localityName || /\b(?:tomorrow|tomm?or?row|kal|subah|morning|afternoon|evening|today|aaj|cleaned|gutted)\b/i.test(msg))) ||
                        /^(?:ek|do|teen|chaar|char|paanch|panch|one|two|three|four|five|[0-9]+(?:\.[0-9]+)?)\s*(?:kgs?|kilos?)(?:\s+(?:cleaned|gutted|whole|fresh|steaks|curry|cut))?(?:\s+(?:tomorrow|tomarow|tomm?or?row|kal|subah|morning|evening|aaj|today|for\s+tomorrow|for\s+saturday|please|plz|bhai|sahib|janab))?[!.,\s]*$/i.test(msg) ||
                        /\b(?:can\s*(?:i|you)\s*(?:get|send|have|order)|please\s*(?:send|deliver)|send\s*link|pay\s*link|please|plz)\b/i.test(msg);

  if (!isOrderIntent) return null;

  let cut = "Cleaned & Gutted";
  let isWholeRequested = false;
  const isNegatedWhole = /\bnot\s+whole\b/i.test(msg);
  if (!isNegatedWhole && /\b(?:whole|round|sabut|uncleaned|bina\s*saaf|without\s*clean(?:ing)?)\b/i.test(msg)) {
    cut = "Cleaned & Gutted";
    isWholeRequested = true;
  } else if (/\b(?:curry|cut|steaks?)\b/i.test(msg)) {
    cut = "Cleaned & Gutted (Curry Cut)";
  } else if (/\b(?:clean|cleaned|gutted|saf)\b/i.test(msg)) {
    cut = "Cleaned & Gutted";
  }

  return { weightKg, cut, localityName, localityDist, isWholeRequested };
}

// Helper to determine if an order is completed, delivered, cancelled or closed
function isOrderDeliveredOrClosed(ord) {
  if (!ord) return true;
  const status = String(ord.status || "").toLowerCase();
  return (
    status.includes("delivered") ||
    status.includes("completed") ||
    status.includes("cancelled") ||
    status.includes("closed") ||
    status.includes("refunded")
  );
}

// Helper to check if an order is ACTIVE & PENDING (not completed/delivered/cancelled)
function isOrderActivePending(ord) {
  if (!ord) return false;
  if (!ord.orderRef && !ord.amount && !ord.payUrl) return false;
  if (isOrderDeliveredOrClosed(ord)) return false;

  const isPaidOrd = isHistoricalOrderPaid(ord);
  const ordTime = new Date(
    isPaidOrd
      ? (ord.paidAt || ord.updatedAt || ord.createdAt || 0)
      : (ord.createdAt || ord.updatedAt || 0)
  ).getTime();
  if (!ordTime) return false;
  const ageHours = (Date.now() - ordTime) / (3600 * 1000);

  const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const ordDateIst = new Date(ordTime).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const sched = String(ord.deliveryTime || "").toLowerCase();
  const todayDayName = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).toLowerCase();

  // 1. Orders placed TODAY in IST:
  if (ordDateIst === todayIst) {
    return isPaidOrd ? (ageHours <= 18) : (ageHours <= 4);
  }

  // 2. Unpaid quotes from previous days are never active
  if (!isPaidOrd) return false;

  // 3. Paid orders placed on a PREVIOUS calendar date: active only if scheduled for today (< 36h)
  if (ageHours > 36) return false;

  const isAdvanceForToday = (
    (sched.includes("tomorrow") && ageHours < 30) ||
    (sched.includes(todayDayName) && ageHours < 36) ||
    (sched.includes("advance") && ageHours < 36)
  );

  return isAdvanceForToday;
}

// Helper to verify if an ACTIVE order is genuinely PAID (NOT awaiting payment, NOT closed/delivered)
function isOrderActiveAndPaid(ord) {
  if (!ord || !isOrderActivePending(ord)) return false;
  // If paymentId or paidAt is present, it is genuinely verified as PAID
  if (ord.paymentId || ord.paidAt) return true;
  const status = String(ord.status || "").toLowerCase();
  if (status.includes("unpaid")) return false;
  if (status.includes("paid") && !status.includes("unpaid")) return true;
  if (status.includes("confirmed") && !status.includes("awaiting") && !status.includes("pending payment")) return true;
  return false;
}

// Helper to check if a historical order was paid in the past (for VIP profile analysis only)
function isHistoricalOrderPaid(ord) {
  if (!ord) return false;
  if (ord.paidAt || ord.paymentId) return true;
  const status = String(ord.status || "").toLowerCase();
  if (status.includes("unpaid")) return false;
  if (status.includes("paid") || status.includes("confirmed") || status.includes("delivered") || status.includes("completed") || status.includes("dispatch")) {
    return true;
  }
  return false;
}

// ═════════════════════════════════════════════════════════════════════════════
// 🧠 TODAY'S DYNAMIC ORDER POOL & INTELLIGENCE BRAIN
// ═════════════════════════════════════════════════════════════════════════════
const TodayOrderPool = {
  getTodayDateIst() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  },

  getAllOrders() {
    try {
      const ordersFilePath = path.join(__dirname, "customer_orders.json");
      if (fs.existsSync(ordersFilePath)) {
        return JSON.parse(fs.readFileSync(ordersFilePath, "utf8")) || {};
      }
    } catch (_) {}
    return {};
  },

  getAllTodayOrders() {
    const all = this.getAllOrders();
    const today = this.getTodayDateIst();
    const todayMap = {};
    for (const [k, ord] of Object.entries(all)) {
      if (!ord || isOrderDeliveredOrClosed(ord)) continue;
      const refTs = ord.createdAt || ord.updatedAt || null;
      const createdDate = refTs ? new Date(refTs).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : null;

      if (this.isOrderPaid(ord)) {
        if (isOrderActivePending(ord)) {
          todayMap[k] = ord;
        }
      } else {
        // UNPAID ORDERS: Only treat as an active order for today if created TODAY strictly within the last 3.5 hours!
        if (createdDate === today) {
          const orderAgeMin = (Date.now() - new Date(refTs || 0).getTime()) / (60 * 1000);
          if (orderAgeMin >= 0 && orderAgeMin < 210) {
            todayMap[k] = ord;
          }
        }
      }
    }
    return todayMap;
  },

  getTodayOrder(cleanPhone, jid) {
    const todayOrders = this.getAllTodayOrders();
    return findActiveCustomerOrder(todayOrders, cleanPhone, jid);
  },

  isOrderPaid(ord) {
    return isOrderActiveAndPaid(ord);
  },

  findReusablePaymentLink(cleanPhone, jid, requiredAmount) {
    const activeOrder = this.getTodayOrder(cleanPhone, jid);
    if (!activeOrder || !activeOrder.payUrl || this.isOrderPaid(activeOrder)) {
      return null;
    }
    const amtMatch = String(activeOrder.amount || "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    const orderAmt = amtMatch ? Math.round(parseFloat(amtMatch[1])) : 0;
    const targetAmt = requiredAmount ? Math.round(Number(requiredAmount)) : 0;
    if (orderAmt && (!targetAmt || Math.abs(orderAmt - targetAmt) <= 1)) {
      const refTs = activeOrder.createdAt || activeOrder.updatedAt || 0;
      const orderDate = new Date(refTs);
      const today = this.getTodayDateIst();
      const orderDay = orderDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const orderAgeMin = (Date.now() - orderDate.getTime()) / (60 * 1000);
      // Valid strictly under 3.5 hours AND strictly created today in IST (Cashfree links expire in 4 hours)
      if (orderAgeMin >= 0 && orderAgeMin < 210 && orderDay === today) {
        return {
          url: activeOrder.payUrl,
          short_url: activeOrder.payUrl,
          id: activeOrder.paymentLinkId || activeOrder.cashfreeLinkId || null,
          paymentLinkId: activeOrder.paymentLinkId || activeOrder.cashfreeLinkId || null,
          cashfreeLinkId: activeOrder.cashfreeLinkId || activeOrder.paymentLinkId || null,
          orderRef: activeOrder.orderRef,
          ref: activeOrder.orderRef,
          amount: orderAmt,
          items: activeOrder.items || null,
          isReused: true
        };
      }
    }
    return null;
  }
};

// Backwards-compatible alias for historical order payment verification
function isOrderConfirmedPaid(ord) {
  return isHistoricalOrderPaid(ord);
}

// Safe lookup for active, unfulfilled customer orders
function findActiveCustomerOrder(ordersMap, phoneNum, jid) {
  if (!ordersMap || typeof ordersMap !== "object") return null;
  const cleanP = String(phoneNum || "").replace(/\D/g, "").slice(-10);
  const isOwner = cleanP === "7006604148" || String(jid || "").includes("174637916885151");

  // 1. Direct phone lookup in orders map
  if (cleanP && cleanP.length === 10 && ordersMap[cleanP]) {
    const directOrd = ordersMap[cleanP];
    if (isOrderActivePending(directOrd)) {
      if (!isOwner || (directOrd.phone === "7006604148" && directOrd.createdBy !== "OWNER_WHATSAPP_COMMAND")) {
        return directOrd;
      }
    }
  }

  // 2. Scan all orders for active pending ones matching phone or non-owner chatId
  const candidates = [];
  for (const [key, ord] of Object.entries(ordersMap)) {
    if (!ord || !isOrderActivePending(ord)) continue;
    const isOwnerCmd = ord.createdBy === "OWNER_WHATSAPP_COMMAND";
    const ordPhone = String(ord.phone || "").replace(/\D/g, "").slice(-10);

    if (isOwner) {
      if (!isOwnerCmd && (ordPhone === "7006604148" || (jid && ord.chatId === jid))) {
        candidates.push(ord);
      }
      continue;
    }

    if (cleanP && cleanP.length === 10 && (ordPhone === cleanP || key === cleanP)) {
      candidates.push(ord);
    } else if (!isOwnerCmd && ord.chatId && jid && ord.chatId === jid) {
      candidates.push(ord);
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    return candidates[0];
  }
  return null;
}

// STRICT LOCATION-FIRST VERIFICATION:
// Resolves whether a customer has a confirmed delivery locality or GPS coordinates in Srinagar (plus distance & name)
function resolveConfirmedCustomerLocationDetails({ remoteJid, cleanPhone, chatHist = [], targetOrder = null }) {
  const currentMeta = (typeof chatMetadata !== "undefined" && chatMetadata) ? chatMetadata : {};
  const meta = (remoteJid && currentMeta[remoteJid]) || (cleanPhone && currentMeta[cleanPhone]) || {};

  // 1. Check recent user messages in chat history for any newly stated Srinagar locality (active conversation wins over stale history!)
  if (Array.isArray(chatHist)) {
    for (let i = chatHist.length - 1; i >= Math.max(0, chatHist.length - 6); i--) {
      if (chatHist[i].role !== "user") continue;
      const t = chatHist[i].text || "";
      if (isSyntheticSystemNote(t)) continue;
      const locMatch = detectSrinagarLocality(t);
      if (locMatch && locMatch.status === "IN_ZONE") {
        return { confirmed: true, distanceKm: locMatch.dist, localityName: locMatch.name };
      }
    }
  }

  // 2. Check chatMetadata for verified GPS coordinates or recognized locality (if updated recently or verified)
  if (meta.latitude != null && meta.longitude != null && meta.distanceKm != null && meta.distanceKm <= 16.0) {
    return { confirmed: true, distanceKm: Number(meta.distanceKm), localityName: meta.localityName || null };
  }
  if (meta.localityName && !/^(?:srinagar|kashmir|malabagh)$/i.test(meta.localityName.trim())) {
    const locMatch = detectSrinagarLocality(meta.localityName);
    if (locMatch && locMatch.status === "IN_ZONE") {
      return { confirmed: true, distanceKm: meta.distanceKm != null ? Number(meta.distanceKm) : locMatch.dist, localityName: locMatch.name };
    }
  }

  // 3. Check if targetOrder has verified coordinates or a recognized locality
  if (targetOrder) {
    if (targetOrder.latitude != null && targetOrder.longitude != null) {
      const d = targetOrder.distanceKm != null ? Number(targetOrder.distanceKm) : (meta.distanceKm != null ? Number(meta.distanceKm) : null);
      return { confirmed: true, distanceKm: d, localityName: targetOrder.deliveryArea || meta.localityName || null };
    }
    const ordArea = String(targetOrder.deliveryArea || "").trim().toLowerCase();
    if (ordArea && !ordArea.startsWith("srinagar") && !ordArea.startsWith("doorstep delivery") && !ordArea.startsWith("within")) {
      const locMatch = detectSrinagarLocality(ordArea);
      if (locMatch && locMatch.status === "IN_ZONE") {
        return { confirmed: true, distanceKm: locMatch.dist, localityName: locMatch.name };
      }
    }
  }

  // 4. Fallback scan deeper in genuine customer chat history if needed
  if (Array.isArray(chatHist)) {
    for (let i = chatHist.length - 1; i >= 0; i--) {
      if (chatHist[i]?.role !== "user") continue;
      const t = chatHist[i].text || "";
      if (isSyntheticSystemNote(t)) continue;
      const locMatch = detectSrinagarLocality(t);
      if (locMatch && locMatch.status === "IN_ZONE") {
        return { confirmed: true, distanceKm: locMatch.dist, localityName: locMatch.name };
      }
    }
  }

  return { confirmed: false, distanceKm: null, localityName: null };
}

// Verifies whether a customer has a confirmed delivery locality or GPS coordinates in Srinagar
function isCustomerDeliveryLocationConfirmed(params) {
  return resolveConfirmedCustomerLocationDetails(params).confirmed;
}

// VIP / Return Customer Memory: STRICTLY FOR CONFIRMED PAID CUSTOMERS ONLY
function lookupCustomerVipProfile(chatId, customerPhone) {
  let cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  if (!cleanPhone || cleanPhone.length < 10) {
    const resolved = resolveCustomerPhone(chatId);
    const resolvedDigits = String(resolved || "").replace(/\D/g, "");
    if (resolvedDigits.length >= 10 && !/^\d{14,}$/.test(resolvedDigits)) {
      cleanPhone = resolvedDigits.slice(-10);
    }
  }
  if ((!cleanPhone || cleanPhone.length < 10) && chatId && lidToPhone.has(chatId)) {
    const lidDigits = String(lidToPhone.get(chatId)).replace(/\D/g, "");
    if (lidDigits.length >= 10 && !/^\d{14,}$/.test(lidDigits)) cleanPhone = lidDigits.slice(-10);
  }
  const raw10 = cleanPhone && cleanPhone.length === 10 ? cleanPhone : "";

  // 1. Scan customer_orders.json STRICTLY for confirmed paid orders
  const confirmedPaidOrders = [];
  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    if (fs.existsSync(ordersFilePath)) {
      const orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));
      for (const [key, ord] of Object.entries(orders)) {
        if (!ord) continue;
        const isOwnerCmd = ord.createdBy === "OWNER_WHATSAPP_COMMAND";
        const oPhone = String(ord.phone || "").replace(/\D/g, "").slice(-10);
        // If created by owner command, ord.chatId or ord.ownerJid is the owner's chat, NOT the customer's chat!
        const oChatId = isOwnerCmd ? null : ord.chatId;

        // Owner guard: never treat owner admin chat or phone as a customer order
        if (cleanPhone === "7006604148" || String(chatId).includes("174637916885151")) {
          if (oPhone !== "7006604148" || isOwnerCmd) continue;
        }

        const matchesPhone = raw10 && (oPhone === raw10 || key === raw10);
        const matchesChat = chatId && !String(chatId).includes("174637916885151") && (oChatId === chatId || (!isOwnerCmd && key === chatId));
        if (matchesPhone || matchesChat) {
          if (isOrderConfirmedPaid(ord)) {
            confirmedPaidOrders.push(ord);
          }
          if (Array.isArray(ord.pastOrders)) {
            for (const pastOrd of ord.pastOrders) {
              if (isOrderConfirmedPaid(pastOrd)) {
                confirmedPaidOrders.push(pastOrd);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("VIP profile order lookup notice:", err.message);
  }

  // STRICT RULE: Returning VIP status requires at least one verified confirmed paid order on file
  const isOwnerTesting = cleanPhone === "7006604148" || String(chatId).includes("174637916885151");
  if (confirmedPaidOrders.length === 0) {
    return null;
  }

  // 2. Merge chatMetadata across phone/JID keys (Owner excluded; prevents pushName-only JID entry from hiding location/phone metadata)
  const meta = isOwnerTesting ? {} : {
    ...(raw10 && chatMetadata[raw10] ? chatMetadata[raw10] : {}),
    ...(customerPhone && chatMetadata[customerPhone] ? chatMetadata[customerPhone] : {}),
    ...(chatId && chatMetadata[chatId] ? chatMetadata[chatId] : {})
  };

  // Sort confirmed paid orders by most recent
  confirmedPaidOrders.sort((a, b) => {
    const tA = new Date(a.paidAt || a.updatedAt || 0).getTime();
    const tB = new Date(b.paidAt || b.updatedAt || 0).getTime();
    return tB - tA;
  });

  const lastOrder = confirmedPaidOrders[0] || null;

  let locality = (meta.localityName && !/^(?:srinagar|kashmir|malabagh)$/i.test(meta.localityName.trim())) ? meta.localityName : null;

  if (!locality && lastOrder && lastOrder.deliveryArea) {
    const cleanArea = String(lastOrder.deliveryArea).replace(/\s*\([^)]*\)\s*/g, "").trim();
    if (cleanArea && !/^(?:doorstep delivery|within \d+km|scheduled|srinagar|kashmir)/i.test(cleanArea)) {
      locality = cleanArea;
    }
  }

  if (!locality && meta.localityName) {
    locality = meta.localityName;
  }

  let distanceKm = meta.distanceKm != null ? Number(meta.distanceKm) : null;
  if (locality && !/^(?:srinagar|kashmir)$/i.test(locality.trim())) {
    const locMatch = detectSrinagarLocality(locality);
    if (locMatch && locMatch.status === "IN_ZONE") {
      distanceKm = locMatch.dist;
    }
  }
  if (distanceKm == null && lastOrder) {
    if (lastOrder.distanceKm != null && !isNaN(Number(lastOrder.distanceKm))) {
      distanceKm = Number(lastOrder.distanceKm);
    } else if (lastOrder.latitude != null && lastOrder.longitude != null) {
      distanceKm = Number(calculateDistance(FARM_LAT, FARM_LNG, Number(lastOrder.latitude), Number(lastOrder.longitude)).toFixed(1));
    } else if (lastOrder.deliveryArea) {
      const areaMatch = detectSrinagarLocality(lastOrder.deliveryArea);
      if (areaMatch && areaMatch.status === "IN_ZONE") {
        distanceKm = areaMatch.dist;
        if (!locality || /^(?:srinagar|kashmir)$/i.test(locality.trim())) locality = areaMatch.name;
      }
    }
  }

  let usualWeightKg = 2;
  let usualCut = "Cleaned & Gutted"; // Whole trout is discontinued; all reorders default to Cleaned & Gutted
  if (lastOrder && lastOrder.items) {
    const wMatch = lastOrder.items.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
    if (wMatch) usualWeightKg = Math.max(1, Math.round(parseFloat(wMatch[1])));
  }

  const reorderPricing = calculateReorderPricing(usualWeightKg, usualCut, distanceKm);

  return {
    isVip: true,
    hasConfirmedPayment: true,
    orderCount: confirmedPaidOrders.length,
    lastOrder: lastOrder ? {
      orderRef: lastOrder.orderRef,
      items: lastOrder.items,
      amount: lastOrder.amount,
      status: lastOrder.status,
      date: lastOrder.paidAt || lastOrder.updatedAt || null
    } : null,
    usualWeightKg,
    usualCut,
    locality: locality || "Srinagar",
    distanceKm: distanceKm != null ? Number(distanceKm) : null,
    reorderAmount: reorderPricing.amount,
    reorderItemDesc: reorderPricing.tagDesc,
    reorderPayTag: `[PAY_LINK: ${reorderPricing.amount} : ${reorderPricing.tagDesc}]`,
    cleanName: null,
    salutation: "Valued Returning Patron"
  };
}

/**
 * Returns true when a customer explicitly insists on Cash on Delivery / paying on delivery
 * without requesting an online payment link or QR in the same message.
 */
function isExplicitCodInsistence(msg) {
  const t = String(msg || "");
  const asksCod = /\b(?:cash\s*on\s*delivery|pay\s*on\s*delivery|paid\s*on\s*delivery|only\s*cod|cod\s*only|cod\s*available|is\s*cod|only\s*cash|prefer\s*cash|cash\s*hi|paisa\s*delivery\s*pe|payment\s*(?:shall|will|can|should)\s*be\s*(?:paid|given|done|made)\s*(?:on|at)\s*delivery)\b/i.test(t);
  const asksOnlineLink = /\b(?:send\s*(?:link|qr)|ok(?:ay)?\s*send|share\s*qr|pay\s*online|upi|gpay|phonepe|paytm)\b/i.test(t);
  return asksCod && !asksOnlineLink;
}

// Call Gemini API
async function generateGeminiReply(chatId, userMessage, customerPhone, customerName, options = {}) {
  // Sanitize input: cap at 500 chars to prevent prompt injection / oversized payloads
  userMessage = String(userMessage || "").slice(0, 500);
  const isGreeting = /^(?:hello|hi|hey|salam|assalam(?:[\s\-]*[uo][\s\-]*[ao]?lai?kum)?|aoa|good\s*(?:morning|afternoon|evening))[!.,\s]*$/i.test(userMessage.trim());
  let history = chatHistories.get(chatId) || [];

  // Only reset history on standalone greeting if conversation is stale (> 4 hours idle) so mid-flow greetings don't lose context
  if (isGreeting && history.length > 0) {
    const cleanP = String(customerPhone || "").replace(/\D/g, "").slice(-10);
    const metaForIdle = chatMetadata[chatId] || (cleanP && chatMetadata[cleanP]) || null;
    const lastActivityMs = metaForIdle?.lastBotMsgTime || metaForIdle?.lastUserMsgTime || 0;
    if (!lastActivityMs || (Date.now() - lastActivityMs) > (4 * 3600 * 1000)) {
      history = [];
      chatHistories.set(chatId, []);
      saveChatHistories();
    }
  }

  const isFirstMessage = history.length === 0;
  const systemPrompt = getSystemPrompt();

  // Real-time IST Clock & Calendar Awareness (Asia/Kolkata)
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const istHour = istDate.getHours();
  const istMinute = istDate.getMinutes();
  const istTimeStr = istDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  const todayDay = istDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayDayName = dayNames[todayDay];
  const tomorrowDayName = dayNames[(todayDay + 1) % 7];
  const formattedDateStr = istDate.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const isThursdayToday = (todayDay === 4);
  const isFridayNormally = (todayDay === 5);
  const isFridayOpen = isFridayOperationsOpen();
  const isFridayToday = isFridayNormally && !isFridayOpen;

  const timeOfDayGreeting = getTimeOfDayGreetingIst(istHour);
  let timeOfDayDesc = "Morning";
  if (istHour >= 12 && istHour < 16) timeOfDayDesc = "Afternoon";
  else if (istHour >= 16 && istHour < 20) timeOfDayDesc = "Evening";
  else if (istHour >= 20 || istHour < 5) timeOfDayDesc = "Late Evening";
  else if (istHour >= 5 && istHour < 12) timeOfDayDesc = "Morning";

  // ORDER & DELIVERY OPERATING WINDOW: 8:00 AM to 8:00 PM (12 Hours Active Same-Day Delivery!)
  const isOperatingHours = istHour >= 8 && istHour < 20; // 8:00 AM to 7:59 PM (Active Daytime Delivery)
  const isNightAfter9PM = istHour >= 20;                 // 8:00 PM to 11:59 PM (Night After-Hours / Winter Closing)
  const isEarlyPreDawn = istHour < 8;                    // 12:00 AM to 7:59 AM (Pre-Dawn)

  // EVENING RUSH SURGE WINDOW: 4:00 PM to 7:59 PM (16:00 – 19:59 IST)
  const isEveningSurge = istHour >= 16 && istHour < 20;
  const surgeAdd = isEveningSurge ? 40 : 0;

  // Real-time Srinagar Weather Radar refresh (auto cached every 15 mins; respects manual #weather overrides)
  const currentWeather = await ensureFreshSrinagarWeather();
  const globalWeatherPolicy = evaluateWeatherDeliveryPolicy(null);

  let cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  if (!cleanPhone || cleanPhone.length < 10) {
    const resDig = String(resolveCustomerPhone(chatId) || "").replace(/\D/g, "");
    if (resDig.length >= 10 && !/^\d{14,}$/.test(resDig)) cleanPhone = resDig.slice(-10);
  }

  const existingOrder = await lookupCustomerOrder(chatId, customerPhone, userMessage);
  const todayOrderForCustomer = TodayOrderPool.getTodayOrder(cleanPhone, chatId);
  const vipProfile = lookupCustomerVipProfile(chatId, customerPhone);
  const isVipCustomer = Boolean(vipProfile && vipProfile.orderCount > 0);

  const trimmedLower = userMessage.trim().toLowerCase();
  const isCustomerSalamEarly = /\b(?:as+al+am(?:[\s\-]*[uo])?[\s\-]*[ao]?lai?kum|as+lam(?:[\s\-]*[uo])?[\s\-]*[ao]?lai?kum|salam(?:[\s\-]*[uo])?[\s\-]*[ao]?lai?kum|salam|salaam|aoa)\b/i.test(trimmedLower);
  const isReorderAffirmative = /^(?:yes|haan|ha|ji|ji\s*haan|same|repeat|same\s*as\s*last\s*time|wahi|wahi\s*bhej\s*do|same\s*bhej\s*do|book\s*it|kardo\s*book|send\s*link|pay\s*link|same\s*order|haan\s*kardo|yes\s*please|done|ok\s*send|send|bhej\s*do|bhejo|haan\s*bhejo)[!.,\s]*$/i.test(trimmedLower) || /\b(?:repeat\s*(?:my\s*)?order|same\s*as\s*last\s*time|wahi\s*order|phir\s*se\s*bhej\s*do|usual\s*order)\b/i.test(trimmedLower);
  const parsedQuantity = parseCustomerQuantityRequest(userMessage);
  const isPureInquiry = isGreeting || /^(?:fish\s*available|trout\s*available|fresh\s*trout|order\s*karna\s*hai|fresh\s*fish|trout\s*hai|fish\s*hai|check\s+delivery\s+time\s+to\s+my\s+area)[!.,?\s]*$/i.test(trimmedLower);
  const isThuForFriRequest = isThursdayToday && !isFridayOpen && /\b(?:tomorrow|kal|friday|jumma|juma)\b/i.test(trimmedLower) && !/\b(?:saturday|hafta|aaj|today|tonight)\b/i.test(trimmedLower);
  const isAdvanceScheduleReq = /\b(?:tomorrow|tomm?or?ro?w|tmrw|2moro|kal|saturday|hafta|advance)\b/i.test(trimmedLower) && !/\b(?:today|tonight|aaj|abhi)\b/i.test(trimmedLower);
  const fastSurgeActive = isAdvanceScheduleReq ? /\b(?:evening|shaam|sham|4\s*[-–]\s*7|4\s*pm|5\s*pm|6\s*pm)\b/i.test(trimmedLower) : isEveningSurge;

  // VIP Fast Path 1: 1-Tap Reorder (Affirmative or Direct Quantity Request)
  let fastReorderReply = null;
  if (vipProfile && !existingOrder && !todayOrderForCustomer && !isFridayToday && !isThuForFriRequest && !isExplicitCodInsistence(userMessage)) {
    if (isReorderAffirmative) {
      const isVipLocConfirmed = vipProfile.locality && !/^(?:srinagar|kashmir)$/i.test(vipProfile.locality.trim());
      if (!isVipLocConfirmed || vipProfile.distanceKm == null) {
        fastReorderReply = `${timeOfDayGreeting} Welcome back to *Urban Trout Aquaculture*! Which area or landmark in Srinagar should we deliver your order to today? Once you confirm your area or location pin, I will instantly send your order summary and payment link! 🐟`;
      } else {
        const vipAffWeather = evaluateWeatherDeliveryPolicy(vipProfile.distanceKm);
        if (vipAffWeather.blockedByWeather && !isAdvanceScheduleReq) {
          fastReorderReply = hasRecentWeatherAdvisory(history, vipProfile.locality)
            ? vipAffWeather.buildConciseWeatherHoldReminder(vipProfile.locality, vipProfile.distanceKm)
            : vipAffWeather.buildWetWeatherOutOfZoneMessage(vipProfile.locality, vipProfile.distanceKm);
        } else {
          const affPricing = calculateReorderPricing(vipProfile.usualWeightKg, vipProfile.usualCut, vipProfile.distanceKm, fastSurgeActive);
          const timeNote = isAdvanceScheduleReq
            ? (isThursdayToday && !isFridayOpen ? "scheduled for Saturday morning (8:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (8:00 AM – 11:00 AM)")
            : isNightAfter9PM
            ? (isThursdayToday && !isFridayOpen ? "scheduled for Saturday morning (8:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (8:00 AM – 11:00 AM)")
            : isEarlyPreDawn
            ? "scheduled for today's morning harvest (8:00 AM – 11:00 AM)"
            : "delivered within 2 hours";
          const delayNote = (!isAdvanceScheduleReq && vipAffWeather.deliverWithDelayWarning) ? `\n\n${vipAffWeather.delayWarningText}` : "";
          fastReorderReply = `Here is your order summary and secure payment link for ${vipProfile.usualWeightKg} kg ${vipProfile.usualCut} to ${vipProfile.locality} (${timeNote} upon payment confirmation):\n\n[PAY_LINK: ${affPricing.amount} : ${affPricing.tagDesc}]${delayNote}\n\n⚡ *Important Note:* Fresh live harvest from our oxygen-saturated cold water tanks begins immediately *after* payment confirmation. Please complete payment above to lock your slot and confirm live harvest! 🐟`;
        }
      }
    } else if (parsedQuantity) {
      if (parsedQuantity.isWholeRequested) {
        fastReorderReply = `We do not deliver Whole Trout anymore — delivery is discontinued for Whole Trout (₹540/kg), though you can buy it in person via self-pickup at our Live Vending Center in Malabagh.\n\nFor express delivery across Srinagar, we exclusively deliver *Cleaned & Gutted* pan-ready steaks at *₹580/kg* (descaled, zero kitchen mess). Would you like ${parsedQuantity.weightKg} kg of Cleaned & Gutted delivered instead? 🐟`;
      } else {
        const reqWeight = parsedQuantity.weightKg;
        const reqCut = parsedQuantity.cut || vipProfile.usualCut || "Cleaned & Gutted";

        let recentChatLoc = null;
        const historyList = chatHistories.get(chatId) || [];
        for (let i = historyList.length - 1; i >= 0; i--) {
          if (!historyList[i] || historyList[i].role !== "user") continue;
          const hText = historyList[i]?.text || "";
          if (isSyntheticSystemNote(hText)) continue;
          const detected = detectSrinagarLocality(hText);
          if (detected && detected.status === "IN_ZONE") {
            recentChatLoc = detected;
            break;
          }
        }

        const targetLocality = (parsedQuantity.localityName && !/^(?:srinagar|kashmir)$/i.test(parsedQuantity.localityName.trim()))
          ? parsedQuantity.localityName
          : (recentChatLoc ? recentChatLoc.name : (vipProfile.locality || "Srinagar"));
        let targetDist = vipProfile.distanceKm;
        if (parsedQuantity.localityName && !/^(?:srinagar|kashmir)$/i.test(parsedQuantity.localityName.trim())) {
          targetDist = parsedQuantity.localityDist != null ? parsedQuantity.localityDist : vipProfile.distanceKm;
        } else if (recentChatLoc) {
          targetDist = recentChatLoc.dist;
        }

        if (!targetLocality || /^(?:srinagar|kashmir)$/i.test(targetLocality.trim()) || targetDist == null) {
          fastReorderReply = `${timeOfDayGreeting} Welcome back to *Urban Trout Aquaculture*! Which area or landmark in Srinagar should we deliver your ${reqWeight} kg order to today? Once you confirm your area or location pin, I will instantly send your order summary and payment link! 🐟`;
        } else {
          const vipQtyWeather = evaluateWeatherDeliveryPolicy(targetDist);
          if (vipQtyWeather.blockedByWeather && !isAdvanceScheduleReq) {
            fastReorderReply = hasRecentWeatherAdvisory(history, targetLocality)
              ? vipQtyWeather.buildConciseWeatherHoldReminder(targetLocality, targetDist)
              : vipQtyWeather.buildWetWeatherOutOfZoneMessage(targetLocality, targetDist);
          } else {
            const pricing = calculateReorderPricing(reqWeight, reqCut, targetDist, fastSurgeActive);

            const timeNote = isAdvanceScheduleReq
              ? (isThursdayToday && !isFridayOpen ? "scheduled for Saturday morning (8:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (8:00 AM – 11:00 AM)")
              : isFridayToday
              ? "scheduled for Saturday morning (8:00 AM – 11:00 AM)"
              : isNightAfter9PM
              ? (isThursdayToday && !isFridayOpen ? "scheduled for Saturday morning (8:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (8:00 AM – 11:00 AM)")
              : isEarlyPreDawn
              ? "scheduled for today's morning harvest (8:00 AM – 11:00 AM)"
              : "delivered within 2 hours";
            const delayNote = (!isAdvanceScheduleReq && vipQtyWeather.deliverWithDelayWarning) ? `\n\n${vipQtyWeather.delayWarningText}` : "";
            fastReorderReply = `Here is your order summary and secure payment link for ${reqWeight} kg ${reqCut} to ${targetLocality} (${timeNote} upon payment confirmation):\n\n[PAY_LINK: ${pricing.amount} : ${pricing.tagDesc}]${delayNote}\n\n⚡ *Important Note:* Fresh live harvest from our oxygen-saturated cold water tanks begins immediately *after* payment confirmation. Please complete payment above to lock your slot and confirm live harvest! 🐟`;
          }
        }
      }
    }
  }

  // VIP Fast Path 2: Returning Customer Greeting & 1-Tap Offer
  if (vipProfile && !existingOrder && !todayOrderForCustomer && !fastReorderReply && isPureInquiry && !isFridayToday) {
    const salamPre = isCustomerSalamEarly ? "Walaikum Assalam! " : "";
    const isVipLocConfirmed = vipProfile.locality && !/^(?:srinagar|kashmir)$/i.test(vipProfile.locality.trim()) && vipProfile.distanceKm != null;
    const vipGreetWeather = evaluateWeatherDeliveryPolicy(vipProfile.distanceKm);
    if (isVipLocConfirmed && vipGreetWeather.blockedByWeather) {
      const fastWeatherGreeting = hasRecentWeatherAdvisory(history, vipProfile.locality)
        ? vipGreetWeather.buildConciseWeatherHoldReminder(vipProfile.locality, vipProfile.distanceKm)
        : `${salamPre}${timeOfDayGreeting} Welcome back to *Urban Trout Aquaculture*! 🐟\n\n${vipGreetWeather.buildWetWeatherOutOfZoneMessage(vipProfile.locality, vipProfile.distanceKm)}`;
      history.push({ role: "user", text: userMessage });
      history.push({ role: "model", text: fastWeatherGreeting });
      if (history.length > 16) history.splice(0, history.length - 16);
      chatHistories.set(chatId, history);
      saveChatHistories();
      return fastWeatherGreeting;
    }

    const harvestStatus = isNightAfter9PM
      ? (isThursdayToday && !isFridayOpen ? "Tonight's deliveries closed at 8:00 PM. Live harvest resumes Saturday morning at 8:00 AM sharp!" : "Tonight's deliveries closed at 8:00 PM. Fresh live harvest resumes tomorrow morning at 8:00 AM sharp!")
      : isEarlyPreDawn
      ? "Our fresh live harvest for today begins at 8:00 AM sharp!"
      : "We have fresh live Himalayan Rainbow Trout harvested today.";
    const slotPrompt = isNightAfter9PM
      ? (isThursdayToday && !isFridayOpen ? "scheduled for Saturday morning (8:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (8:00 AM – 11:00 AM)")
      : isEarlyPreDawn
      ? "scheduled for today's morning harvest (8:00 AM – 11:00 AM)"
      : "as usual";
    const delayNotice = (isVipLocConfirmed && vipGreetWeather.deliverWithDelayWarning) ? `\n\n${vipGreetWeather.delayWarningText}` : "";

    const fastGreeting = isVipLocConfirmed
      ? `${salamPre}${timeOfDayGreeting} Welcome back to *Urban Trout Aquaculture*! 🐟\n\n${harvestStatus}${delayNotice}\n\nWould you like your usual *${vipProfile.usualWeightKg} kg ${vipProfile.usualCut}* delivered to *${vipProfile.locality}* ${slotPrompt}?\n\nJust reply *'Yes'* (or *'Repeat'*) and I'll send your instant payment link right away!`
      : `${salamPre}${timeOfDayGreeting} Welcome back to *Urban Trout Aquaculture*! 🐟\n\n${harvestStatus}\n\nWhich area in Srinagar would you like us to deliver to today, and how many kg of *Cleaned & Gutted* trout (₹580/kg) should we schedule?`;

    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: fastGreeting });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return fastGreeting;
  }

  let orderContext = "";
  if (existingOrder && !existingOrder.notFound) {
    orderContext = `
======================================================
⭐ CUSTOMER RECOGNITION (CONFIRMED ORDER FOUND ON FILE):
This customer has an active confirmed order on file!
- Order Reference: ${existingOrder.orderRef}
- Order Items: ${existingOrder.items || "Fresh Rainbow Trout"}
- Total Amount: ${existingOrder.amount}
- Delivery Location: ${existingOrder.deliveryArea || "Srinagar (Within 16km)"}
- Delivery Time: ${existingOrder.deliveryTime || "Morning Slot (11:00 AM)"}
- Current Status: ${existingOrder.status}
${existingOrder.notes ? `- Delivery Note: ${existingOrder.notes}` : ""}

INSTRUCTION: Provide their order status directly and concisely! Greet warmly ("${timeOfDayGreeting} Welcome back to Urban Trout Aquaculture!"). If this is an ongoing chat, do NOT repeat greetings.
======================================================`;
  } else if (existingOrder && existingOrder.notFound) {
    orderContext = `
======================================================
⚠️ ORDER SEARCH ATTEMPTED — NO RECORD FOUND FOR #${existingOrder.queryRef}:
The customer specifically asked for Order Reference #${existingOrder.queryRef}.
We searched all active harvest logs, invoices, and system records, but could NOT locate Order #${existingOrder.queryRef}.
INSTRUCTION: Politely inform the customer that Order #${existingOrder.queryRef} wasn't found in our system. Ask them to kindly share the 10-digit mobile number used when ordering or re-check the invoice number so we can track it immediately.
======================================================`;
  } else if (vipProfile) {
    orderContext = `
======================================================
👑 VIP RETURNING CUSTOMER PROFILE (${vipProfile.orderCount} Past Orders on File):
• Usual Order: ${vipProfile.usualWeightKg} kg ${vipProfile.usualCut} (${vipProfile.reorderItemDesc})
• Saved Delivery Locality: ${vipProfile.locality} (~${vipProfile.distanceKm} km from Malabagh)
• Reorder Payment Link: ${vipProfile.reorderPayTag}

CRITICAL VIP REORDERING & GREETING INSTRUCTIONS:
1. PAST ORDERS ARE FULLY COMPLETED: Every past order on file was ALREADY harvested, delivered, and completed in the past! Under NO circumstances should you say "Your order is confirmed", "Rider is on the way", "Farm team is harvesting your fish", or "Your delivery slot is reserved" based on past orders!
2. GREETING & TONE: Greet warmly as a valued returning patron: "${timeOfDayGreeting} Welcome back to *Urban Trout Aquaculture*! 🐟".
3. FRESH REORDER ASSISTANCE: Assist them in placing a fresh live-harvest order for today/tomorrow.
4. 1-TAP REORDER RECOGNITION: The customer's usual order is *${vipProfile.usualWeightKg} kg ${vipProfile.usualCut}* delivered to *${vipProfile.locality}*.
5. IF CUSTOMER CONFIRMS OR REPEATS USUAL ORDER (e.g. "yes", "same", "repeat", "wahi", "book it"):
   Immediately output their exact payment link: ${vipProfile.reorderPayTag}
   DO NOT ask for their address or GPS pin! It is already confirmed on file for ${vipProfile.locality}.
6. IF CUSTOMER ASKS FOR A DIFFERENT CUT OR QUANTITY:
   Accommodate them politely, quote the correct rate, and do NOT force them into the old order.
======================================================`;
  } else {
    // STRICT PROFESSIONAL RULE: NEVER pass customer profile name to LLM prompt to prevent informal or awkward name-calling
    orderContext = `\n[STRICT PROFESSIONAL RULE: NEVER address or call the customer by any personal name (no "Hello Munir", "Hi John", "Dear Uzma", etc.)! Greet neutrally ("${timeOfDayGreeting} Welcome to Urban Trout Aquaculture!") or jump straight into the answer without names.]`;
  }

  let detectedLoc = detectSrinagarLocality(userMessage);
  if (!detectedLoc && history && history.length > 0) {
    // Scan genuine customer messages in reverse chronological order (ignore synthetic GPS notes mentioning Malabagh farm!)
    const userMsgs = history.filter(h => h.role === "user" && !isSyntheticSystemNote(h.text)).map(h => h.text).reverse();
    for (const uMsg of userMsgs) {
      detectedLoc = detectSrinagarLocality(uMsg);
      if (detectedLoc) break;
    }
  }

  // Multi-tier Maps API resolution: ONLY if userMessage explicitly contains address keywords
  if (!detectedLoc && hasAddressIndicator(userMessage)) {
    detectedLoc = await resolveUnknownLocalityWithApi(userMessage);
  }
  let localityContext = "";
  if (detectedLoc) {
    if (detectedLoc.status === "IN_ZONE") {
      // Save detected location in chat metadata so future turns remember it!
      const prevMeta = chatMetadata[chatId];
      if (!prevMeta || prevMeta.distanceKm !== detectedLoc.dist || prevMeta.localityName !== detectedLoc.name) {
        const updateIso = new Date().toISOString();
        if (!chatMetadata[chatId]) chatMetadata[chatId] = {};
        chatMetadata[chatId].distanceKm = detectedLoc.dist;
        chatMetadata[chatId].localityName = detectedLoc.name;
        chatMetadata[chatId].locationUpdatedAt = updateIso;
        if (customerPhone) {
          if (!chatMetadata[customerPhone]) chatMetadata[customerPhone] = {};
          chatMetadata[customerPhone].distanceKm = detectedLoc.dist;
          chatMetadata[customerPhone].localityName = detectedLoc.name;
          chatMetadata[customerPhone].locationUpdatedAt = updateIso;
          const r10 = customerPhone.slice(-10);
          if (r10 && r10 !== customerPhone) {
            if (!chatMetadata[r10]) chatMetadata[r10] = {};
            chatMetadata[r10].distanceKm = detectedLoc.dist;
            chatMetadata[r10].localityName = detectedLoc.name;
            chatMetadata[r10].locationUpdatedAt = updateIso;
          }
        }
        saveChatMetadata();
      }

      const detectedWeatherPolicy = evaluateWeatherDeliveryPolicy(detectedLoc.dist);
      if (detectedWeatherPolicy.blockedByWeather) {
        localityContext = buildWeatherHoldPromptContext({
          areaName: detectedLoc.name,
          distKm: detectedLoc.dist,
          weatherPolicy: detectedWeatherPolicy,
          alreadyAdvised: hasRecentWeatherAdvisory(history, detectedLoc.name),
          sourceLabel: "mentioned"
        });
      } else {
        if (detectedLoc.dist <= 4.0) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 1", ZONE NUMBERS, "doorstep", "cold-chain", "cold chain", "chilled", "subsidized", "70%", "30%", "biodegradable", "polythene", OR "Rapido"! Speak naturally: "We deliver express to ${detectedLoc.name} within 2 hours!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 8:00 PM IST) — +₹40 evening rush fee surcharge applies to 1 kg orders. 2 kg+ is 100% FREE!" : ""}
• Express Delivery: 100% FREE on 2 kg or more (within 2 hours)!
• Rate: Cleaned, Gutted & Pan-Ready Pieces = ₹580/kg (Delivery is Cleaned & Gutted only; Whole Trout ₹540/kg is Malabagh counter self-pickup only)
• 2 kg Cleaned & Gutted = *₹1,160 total* (100% FREE delivery)
• ⚠️ STRICT MOQ FIRST POLICY: Pitch 2 kg minimum order for free delivery upfront!
• Pitch for ${detectedLoc.name}:
  "Great! ${detectedLoc.name} is right in our core service area! Express delivery is 100% FREE within 2 hours (minimum order 2 kg, gives 4–5 pan-ready trout for ₹1,160 total). How many kg would you like?"
• IF CUSTOMER ASKS FOR 1 KG:
  "Express delivery is 100% FREE on 2 kg (₹1,160 total). If you'd like just 1 kg as a starter pack to taste today, we can dispatch it express for ₹580 + ₹${45 + surgeAdd} delivery fee (₹${625 + surgeAdd} total), or you can visit our Live Vending Center in Malabagh with zero delivery fee. Which works better for you?"
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${625 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
Ask for a WhatsApp location pin or Google Maps link for pin-point delivery (never house numbers).
======================================================`;
        } else if (detectedLoc.dist <= 7.0) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 2", ZONE NUMBERS, "doorstep", "cold-chain", "cold chain", "chilled", "subsidized", "70%", "30%", "biodegradable", "polythene", OR "Rapido"! Speak naturally: "We deliver express to ${detectedLoc.name} within 2 hours!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 8:00 PM IST) — +₹40 evening rush fee surcharge applies to orders below 3 kg. 3 kg+ is 100% FREE!" : ""}
• Express Delivery: 100% FREE on 3 kg or more!
• 2 kg Order: Available with a nominal express delivery fee of only *₹${55 + surgeAdd}* (₹1,160 + ₹${55 + surgeAdd} = *₹${1215 + surgeAdd} total* for Cleaned & Gutted).
• 1 kg Starter Pack: Available with express delivery fee of *₹${75 + surgeAdd}* (₹580 + ₹${75 + surgeAdd} = *₹${655 + surgeAdd} total*).
• Rate: Cleaned, Gutted & Pan-Ready Pieces = ₹580/kg (Delivery is Cleaned & Gutted only; Whole Trout ₹540/kg is Malabagh counter self-pickup only)
• Pitch for ${detectedLoc.name}:
  "Great! We deliver express to ${detectedLoc.name}! Delivery to your shared location is 100% FREE on 3 kg (gives 6–7 fresh trout at ₹1,740 total). Or we can send 2 kg for just a nominal ₹${55 + surgeAdd} delivery fee (₹${1215 + surgeAdd} total). How many Kgs would you like, and kindly share your WhatsApp location pin or Google Maps link?"
• IF CUSTOMER ASKS FOR 2 KG:
  Gladly confirm! "Sure, we'd be happy to send 2 kg! It comes to ₹1,160 fish + ₹${55 + surgeAdd} express delivery = ₹${1215 + surgeAdd} total. Please share your WhatsApp location pin or Google Maps link (we deliver strictly to the shared pin) and confirm so I can send your payment link!"
• IF CUSTOMER ASKS FOR 1 KG:
  "Express delivery is 100% FREE on 3 kg (or ₹${55 + surgeAdd} on 2 kg). If you'd prefer just 1 kg starter pack to taste today, we can dispatch it express for ₹580 + ₹${75 + surgeAdd} delivery fee (₹${655 + surgeAdd} total). Which would you like?"
• When customer confirms 3 kg Cleaned & Gutted: output [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: ${1215 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${655 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
Ask for a WhatsApp location pin or Google Maps link for pin-point delivery (never house numbers).
======================================================`;
        } else if (detectedLoc.dist <= 11.5) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 3", ZONE NUMBERS, "doorstep", "cold-chain", "cold chain", "chilled", "subsidized", "70%", "30%", "biodegradable", "polythene", OR "Rapido"! Speak naturally: "We deliver express to ${detectedLoc.name} within 2 hours!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 8:00 PM IST) — +₹40 evening rush fee surcharge applies to orders below 3 kg. 3 kg+ is 100% FREE!" : ""}
• Express Delivery: 100% FREE on 3 kg or more!
• 2 kg Order: Available with a nominal express delivery fee of only *₹${89 + surgeAdd}* (₹1,160 + ₹${89 + surgeAdd} = *₹${1249 + surgeAdd} total* for Cleaned & Gutted).
• 1 kg Starter Pack: Available with express delivery fee of *₹${130 + surgeAdd}* (₹580 + ₹${130 + surgeAdd} = *₹${710 + surgeAdd} total*).
• Rate: Cleaned, Gutted & Pan-Ready Pieces = ₹580/kg (Delivery is Cleaned & Gutted only; Whole Trout ₹540/kg is Malabagh counter self-pickup only)
• Pitch for ${detectedLoc.name}:
  "Great! We deliver express to ${detectedLoc.name}! Delivery to your shared location is 100% FREE on 3 kg (gives 6–7 fresh trout at ₹1,740 total). Or we can send 2 kg with an express delivery fee of ₹${89 + surgeAdd} (₹${1249 + surgeAdd} total). How many Kgs would you like, and kindly share your WhatsApp location pin or Google Maps link?"
• IF CUSTOMER ASKS FOR 2 KG:
  Gladly confirm! "Sure, let's do it! We'd be happy to send 2 kg to ${detectedLoc.name}. It comes to ₹1,160 fish + ₹${89 + surgeAdd} express delivery fee = ₹${1249 + surgeAdd} total. Please share your WhatsApp location pin or Google Maps link for pin-point delivery — shall I send your payment link?"
• IF CUSTOMER ASKS FOR 1 KG:
  "Express delivery is 100% FREE on 3 kg (or ₹${89 + surgeAdd} on 2 kg). If you'd prefer just 1 kg starter pack to taste today, we can dispatch it express for ₹580 + ₹${130 + surgeAdd} delivery fee (₹${710 + surgeAdd} total). Which works best for you?"
• When customer confirms 3 kg Cleaned & Gutted: output [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${710 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
Ask for a WhatsApp location pin or Google Maps link for pin-point delivery (never house numbers).
======================================================`;
        } else if (detectedLoc.dist <= 16.0) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 4", ANY ZONE NUMBERS, KM RANGES LIKE "(11.5–16 km)", "doorstep", "cold-chain", "cold chain", "chilled", "subsidized", "70%", "30%", "biodegradable", "polythene", OR "Rapido"! Speak naturally: "We deliver express to ${detectedLoc.name} within 2 hours!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 8:00 PM IST) — +₹40 evening rush fee surcharge applies to orders below 5 kg. 5 kg family pack remains 100% FREE!" : ""}
⛔ ZERO-TOLERANCE MANDATE ON FREE DELIVERY MOQ FOR ${detectedLoc.name} (~${detectedLoc.dist} km, Outer / South Srinagar Corridor):
• 100% FREE DELIVERY IS EXCLUSIVELY ON OUR 5 KG FAMILY PACK (₹2,900)!
• 3 KG AND 4 KG STRICTLY DO NOT QUALIFY FOR FREE DELIVERY!
  - 4 kg order: ₹2,320 fish + ₹${109 + surgeAdd} delivery fee = *₹${2429 + surgeAdd} total*
  - 3 kg order: ₹1,740 fish + ₹${129 + surgeAdd} delivery fee = *₹${1869 + surgeAdd} total*
  - 2 kg order: ₹1,160 fish + ₹${139 + surgeAdd} delivery fee = *₹${1299 + surgeAdd} total*
  - 1 kg starter pack: ₹580 fish + ₹${190 + surgeAdd} delivery fee = *₹${770 + surgeAdd} total*
• ABSOLUTELY NEVER SAY OR WRITE: "upgrade to 3 kg for free delivery", "free delivery on 3 kg", OR "3 kg unlocks free delivery" TO THIS CUSTOMER!
• If you suggest an upgrade for 100% FREE delivery, you MUST ONLY suggest upgrading to 5 KG (₹2,900)!
• Rate: Cleaned, Gutted & Pan-Ready Pieces = ₹580/kg (Delivery is Cleaned & Gutted only; Whole Trout ₹540/kg is Malabagh counter self-pickup only)
• Pitch for ${detectedLoc.name}:
  "Great! We deliver express to ${detectedLoc.name}! Delivery to your shared location is 100% FREE for our 5 kg family pack (gives 10–12 fresh trout at ₹2,900 total). We can also send 2 kg for just ₹${139 + surgeAdd} delivery fee (₹${1299 + surgeAdd} total), 3 kg for ₹${129 + surgeAdd} (₹${1869 + surgeAdd} total), or 4 kg for ₹${109 + surgeAdd} (₹${2429 + surgeAdd} total). Which would you like, and kindly share your WhatsApp location pin or Google Maps link?"
• IF CUSTOMER ASKS FOR 2 KG:
  Gladly confirm with transparent line breakdown AND explicitly state the 5 kg free-delivery tip (NEVER say vague "FREE on eligible orders" — state "100% FREE on our 5 kg family pack"):
  "Sure! We can send 2 kg to ${detectedLoc.name} express for ₹1,160 fish + ₹${139 + surgeAdd} delivery fee = *₹${1299 + surgeAdd} total* (💡 Tip: Ordering our *5 kg* family pack for ₹2,900 unlocks 100% FREE express delivery!). Please share your WhatsApp location pin or Google Maps link for pin-point delivery — shall I send your payment link?"
• IF CUSTOMER ASKS FOR 3 KG:
  "Sure! 3 kg to ${detectedLoc.name} is ₹1,740 fish + ₹${129 + surgeAdd} delivery fee = ₹${1869 + surgeAdd} total (or upgrade to our 5 kg family pack for 100% FREE delivery!). Please share your WhatsApp location pin or Google Maps link — shall I send your payment link?"
• IF CUSTOMER ASKS FOR 4 KG:
  "Sure! 4 kg to ${detectedLoc.name} is ₹2,320 fish + ₹${109 + surgeAdd} delivery fee = ₹${2429 + surgeAdd} total (or upgrade to 5 kg for ₹2,900 with 100% FREE delivery!). Shall I send your payment link?"
• IF CUSTOMER ASKS FOR 1 KG:
  "Express delivery is 100% FREE on 5 kg (or ₹${139 + surgeAdd} on 2 kg). If you'd like just 1 kg as a starter pack, we can send it express for ₹580 + ₹${190 + surgeAdd} delivery fee (₹${770 + surgeAdd} total), or you can visit our Live Vending Center in Malabagh with zero delivery fee. Which would you prefer?"
• When customer confirms 5 kg Cleaned & Gutted: output [PAY_LINK: 2900 : 5 kg Cleaned & Gutted]
• When customer confirms 4 kg Cleaned & Gutted: output [PAY_LINK: ${2429 + surgeAdd} : 4 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 3 kg Cleaned & Gutted: output [PAY_LINK: ${1869 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: ${1299 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${770 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
Ask for a WhatsApp location pin or Google Maps link for pin-point delivery (never house numbers).
======================================================`;
        }
        if (detectedWeatherPolicy.deliverWithDelayWarning && localityContext) {
          localityContext += `\n${detectedWeatherPolicy.weatherIcon} MANDATORY WET-WEATHER DELAY NOTICE (${detectedWeatherPolicy.weatherTitle.toUpperCase()}): Delivery to ${detectedLoc.name} (~${detectedLoc.dist} km) IS ACTIVE during ${detectedWeatherPolicy.weatherNoun}, AND you MUST explicitly mention that delivery might be slightly delayed due to the weather.`;
        }
      }
    } else if (detectedLoc.status === "OUT_ZONE") {
      const isOutsideKashmir = /(?:jammu|delhi|punjab|bangalore|mumbai|outside\s*kashmir)/i.test(detectedLoc.name + " " + userMessage);
      localityContext = isOutsideKashmir
        ? `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (OUTSIDE Kashmir Valley).
CRITICAL INSTRUCTION: Express delivery is strictly restricted to within 16 km of our Recirculatory Aquaculture System at Malabagh, Srinagar to preserve peak live-harvest freshness with 0% ice. We do not deliver outside Kashmir/to Jammu. DO NOT invite them to visit Malabagh in person since they are outside Kashmir.
======================================================`
        : `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}", which is OUTSIDE our 16 km delivery perimeter.
CRITICAL INSTRUCTION: Inform them politely that express delivery is restricted to 16 km across Srinagar to preserve peak live-harvest freshness (NEVER say "doorstep", "cold-chain", or "chilled"). You MUST include this exact phrase:
"However, you are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout and get it cleaned on the spot!" (Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9)
======================================================`;
    }
  } else {
    // If locality was NOT mentioned in current message, check if distance is known on file
    const savedLoc = chatMetadata[chatId] || (customerPhone ? chatMetadata[customerPhone] : null);
    if (savedLoc && savedLoc.distanceKm != null) {
      const sDist = savedLoc.distanceKm;
      const savedWeatherPolicy = evaluateWeatherDeliveryPolicy(sDist);
      if (savedWeatherPolicy.blockedByWeather) {
        localityContext = buildWeatherHoldPromptContext({
          areaName: savedLoc.localityName || "Your Area",
          distKm: sDist,
          weatherPolicy: savedWeatherPolicy,
          alreadyAdvised: hasRecentWeatherAdvisory(history, savedLoc.localityName || null),
          sourceLabel: "distance on file is"
        });
      } else {
        if (sDist <= 4.0) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Nearby Srinagar: 0–4 km).
⚠️ STRICT MANDATE: NEVER SAY "ZONE 1", "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido" TO CUSTOMER!
• Express Delivery: 100% FREE on 2 kg or more (Cleaned & Gutted ₹1,160).
• 1 kg starter pack: ₹580 + ₹${45 + surgeAdd} delivery fee = ₹${625 + surgeAdd} total.
• If confirmed 2 kg: [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]
• If confirmed 1 kg: [PAY_LINK: ${625 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
        } else if (sDist <= 7.0) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Mid Srinagar: 4–7 km).${isEveningSurge ? "\n⚡ EVENING RUSH HOUR (4–8 PM): +₹40 evening rush fee applies below 3 kg. 3 kg+ is 100% FREE!" : ""}
⚠️ STRICT MANDATE: NEVER SAY "ZONE 2", "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido" TO CUSTOMER!
• Express Delivery: 100% FREE on 3 kg or more (Cleaned & Gutted ₹1,740).
• 2 kg: ₹1,160 + ₹${55 + surgeAdd} express delivery fee = ₹${1215 + surgeAdd} total.
• 1 kg: ₹580 + ₹${75 + surgeAdd} express delivery fee = ₹${655 + surgeAdd} total.
• If confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• If confirmed 2 kg: [PAY_LINK: ${1215 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 1 kg: [PAY_LINK: ${655 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
        } else if (sDist <= 11.5) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Central/City Srinagar: 7–11.5 km).${isEveningSurge ? "\n⚡ EVENING RUSH HOUR (4–8 PM): +₹40 evening rush fee applies below 3 kg. 3 kg+ is 100% FREE!" : ""}
⚠️ STRICT MANDATE: NEVER SAY "GREATER SRINAGAR", "ZONE 3", "ZONE", "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido" TO CUSTOMER! Refer directly to the customer's locality or simply say "in Srinagar".
• Express Delivery: 100% FREE on 3 kg or more (Cleaned & Gutted ₹1,740).
• 2 kg: ₹1,160 + ₹${89 + surgeAdd} express delivery fee = ₹${1249 + surgeAdd} total.
• 1 kg: ₹580 + ₹${130 + surgeAdd} express delivery fee = ₹${710 + surgeAdd} total.
• If confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• If confirmed 2 kg: [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 1 kg: [PAY_LINK: ${710 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
        } else if (sDist <= 16.0) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Outer Corridor: 11.5–16 km).${isEveningSurge ? "\n⚡ EVENING RUSH HOUR (4–8 PM): +₹40 evening rush fee applies below 5 kg. 5 kg family pack remains 100% FREE!" : ""}
⚠️ STRICT MANDATE: NEVER SAY "ZONE 4", "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido" TO CUSTOMER!
⛔ ZERO-TOLERANCE MANDATE ON FREE DELIVERY MOQ FOR THIS DISTANCE (~${sDist} km, Outer / South Srinagar Corridor):
• 100% FREE DELIVERY IS EXCLUSIVELY ON 5 KG FAMILY PACK (₹2,900)!
• 3 KG AND 4 KG STRICTLY DO NOT QUALIFY FOR FREE DELIVERY!
  - 4 kg: ₹2,320 + ₹${109 + surgeAdd} express delivery fee = *₹${2429 + surgeAdd} total*
  - 3 kg: ₹1,740 + ₹${129 + surgeAdd} express delivery fee = *₹${1869 + surgeAdd} total*
  - 2 kg: ₹1,160 + ₹${139 + surgeAdd} express delivery fee = *₹${1299 + surgeAdd} total*
  - 1 kg: ₹580 + ₹${190 + surgeAdd} express delivery fee = *₹${770 + surgeAdd} total*
• ABSOLUTELY NEVER SAY OR WRITE: "upgrade to 3 kg for free delivery", "free delivery on 3 kg", OR "3 kg unlocks free delivery" TO THIS CUSTOMER! ONLY 5 KG IS FREE!
• If customer asks for 2 kg or 3 kg, ALWAYS state the fish price + the delivery fee and the total payable!
• If confirmed 5 kg: [PAY_LINK: 2900 : 5 kg Cleaned & Gutted]
• If confirmed 4 kg: [PAY_LINK: ${2429 + surgeAdd} : 4 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 3 kg: [PAY_LINK: ${1869 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 2 kg: [PAY_LINK: ${1299 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 1 kg: [PAY_LINK: ${770 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
        } else {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (OUTSIDE delivery perimeter > 16 km).
• Express delivery NOT available beyond 16 km. Strictly invite to Live Vending Center in Malabagh.
======================================================`;
        }
        if (savedWeatherPolicy.deliverWithDelayWarning && sDist <= 16.0 && localityContext) {
          localityContext += `\n${savedWeatherPolicy.weatherIcon} MANDATORY WET-WEATHER DELAY NOTICE (${savedWeatherPolicy.weatherTitle.toUpperCase()}): Delivery within ${WEATHER_RESTRICT_RADIUS_KM} km IS ACTIVE, AND you MUST clearly inform the customer that their delivery might be delayed due to ongoing ${savedWeatherPolicy.weatherNoun}.`;
        }
      }
    } else {
      // Unverified locality
      localityContext = `\n======================================================
📍 LOCALITY UNVERIFIED (NOT IN CONFIRMED LIST):
CRITICAL REVENUE PROTECTION MANDATE (ZERO BLIND DISCARDING):
NEVER ASSUME OR GUESS THAT AN UNFAMILIAR LOCALITY IS OUTSIDE OUR DELIVERY ZONE!
NEVER tell the customer that their area is outside our delivery zone unless it is a confirmed outside city!
⚠️ STRICT LOCATION-FIRST LAW: DO NOT OUTPUT [PAY_LINK: ...]!
Payment links CANNOT be generated until the customer's delivery area / location pin in Srinagar is identified.
${currentWeather.isBadWeather ? `${globalWeatherPolicy.weatherIcon} ACTIVE WEATHER NOTE: Due to active ${globalWeatherPolicy.weatherNoun} across Srinagar right now, express delivery operates within *${WEATHER_RESTRICT_RADIUS_KM} km* from Malabagh (with slight weather delay) and is temporarily paused beyond *${WEATHER_RESTRICT_RADIUS_KM} km*. Ask for their area/pin first so we can check!` : ""}
INSTRUCTION: If the customer is inquiring about delivery, or asked for fish/price without mentioning their location, state our rates (₹580/kg Cleaned & Gutted) and politely ask for their area AND WhatsApp location pin or Google Maps link:
"Which area in Srinagar should we deliver to (e.g. Soura, Lal Chowk, Rajbagh, Hyderpora)? Please share your WhatsApp location pin or Google Maps link so our system can calculate delivery details for pin-point express delivery (packed fresh in food-grade biodegradable polythene, 0% ice) and send your payment link right away! 🐟"
======================================================`;
    }
  }

  // (trimmedLower declared above)
  let intentContext = "";
  if (
    /^(?:pp\??|p\.p\.?\??|price\s*plz\??|price\s*please\??|rate\??|rates\??|hm\??|how\s*much\??)$/i.test(trimmedLower) ||
    /\b(?:pp|p\.p)\b/i.test(userMessage)
  ) {
    intentContext = `\n======================================================
💡 QUERY INTENT DECODED: Customer asked price ("${userMessage.trim()}").
CRITICAL INSTRUCTION: Answer ONLY what is required (keep it brief and organized):
• Cleaned & Gutted: *₹580/kg* (Pan-ready pieces, descaled & cleaned)

🛵 *Express delivery is 100% FREE* on eligible orders across Srinagar (min 2 kg for nearby areas like Malabagh, Soura, Hazratbal, Lal Bazar; 3 kg for Central Srinagar; 5 kg for South Srinagar corridor; standard delivery fee on smaller orders)!

Which area in Srinagar would you like delivery to (or drop your WhatsApp location pin / Google Maps link), or would you like to visit our Live Vending Center in Malabagh?
======================================================`;
  } else if (
    // Freight & Price Objections ("Discount?", "Kam karo", "Freight zada uorha hy", "600 do 1 kg")
    /\b(?:discount|bargain|kam\s*karo|kuch\s*kam|rate\s*kam|price\s*kam|concession|less\s*karo|thoda\s*kam|koi\s*offer|offer\s*hai|cheaper|sasta)\b/i.test(trimmedLower) ||
    /\b(?:freight|delivery(?:\s*(?:fee|charge|charges|cost))?)\s*(?:is\s*)?(?:zada|zyada|jyada|high|too\s*much|expensive|extra|mehenga|kam)\b/i.test(trimmedLower) ||
    /\b(?:500|520|530|550|600|650)\s*(?:me|mai|mein|rs|rupees|₹)?\s*(?:do|de\s*do|karo|bhej\s*do)\b/i.test(trimmedLower)
  ) {
    intentContext = `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking for a discount, bargaining, or objecting to delivery freight ("${userMessage.trim()}").
CRITICAL DIRECTIVE ON NON-NEGOTIABLE GENUINE PRICING + ZERO-FEE PIVOTS:
• Urban Trout has a STRICT NO NEGOTIATION POLICY. We do NOT negotiate on rates or freight with any customer.
• We already provide the most genuine, transparent, and direct farm rates in the entire Kashmir Valley for pure cold-water live-harvest Rainbow Trout (₹580/kg Cleaned & Gutted).
• Politely, respectfully, and firmly explain, THEN offer BOTH practical zero-delivery-fee alternatives:
"We completely understand! Our fish and standard express rider charges are fixed and genuine across Srinagar. Every trout is swimming live in our cold-water tanks until ordered and harvested fresh with *0% ice* and zero preservatives.

To save the delivery fee completely, you have two easy options:
• *100% FREE Express Delivery:* Order our zone minimum pack (2 kg nearby, 3 kg in central Srinagar, or 5 kg in South Srinagar corridor — great for splitting with family or neighbours!).
• *Zero-Fee Counter Pickup:* Visit our Live Vending Center at *Malabagh* (Near R. P. School Girls Wing, open Sat–Thu 8:00 AM – 8:00 PM — https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9) and pay ₹0 delivery!

Would you like to go ahead with delivery, upgrade to the free-delivery pack, or pick up from Malabagh?"
======================================================`;
  } else if (
    /\b(?:previous(?:ly)?\s*(?:paid|charge|charged|rate|fee|less)|last\s*time\s*(?:i\s*paid|it\s*was|charged|less)|pichli\s*baar\s*(?:kam|diya|tha)|pehle\s*(?:kam\s*tha|to\s*kam|rate\s*kam)|why\s*(?:delivery|charge|rate)\s*(?:increased|more|high|extra)|delivery\s*zyada\s*kyun|rates\s*badh\s*gaye)\b/i.test(trimmedLower)
  ) {
    intentContext = `\n======================================================
💡 QUERY INTENT DECODED: Customer mentions paying less previously or asks about revised delivery rates ("${userMessage.trim()}").
CRITICAL DIRECTIVE ON REVISED DELIVERY RATES (BE COURTEOUS, PROFESSIONAL & REASSURING):
• Do NOT be blunt or defensive! Explain politely and warmly:
"We truly appreciate your continued trust in Urban Trout! To maintain our dedicated live-harvest express delivery economics and ensure our riders navigate directly to your shared GPS location within 90–120 minutes with 0% ice packaging, our delivery rates across Srinagar have been updated to standard actual transit costs.

You can also enjoy 100% FREE express delivery by ordering our zone MOQ (2 kg for nearby areas, 3 kg for Central Srinagar, 5 kg for South Srinagar corridor), which completely waives the delivery fee!

Would you like us to schedule your fresh live-harvest delivery today?"
======================================================`;
  } else if (
    /\b(?:who\s*are\s*you|are\s*you\s*(?:a\s*)?(?:human|bot|ai|robot|machine|real\s*person)|kon\s*ho|tum\s*kon\s*ho|aap\s*kon\s*ho|bot\s*ho\s*ya|insaan\s*ho|ai\s*ho|digital\s*agent|computer\s*ho|kya\s*aap\s*ai\s*ho|what\s*are\s*you)\b/i.test(trimmedLower)
  ) {
    intentContext = `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking about your identity ("${userMessage.trim()}").
CRITICAL IDENTITY DIRECTIVE (BRIEF, PROFESSIONAL & HELPFUL):
"${timeOfDayGreeting} I am the digital sales assistant for *Urban Trout Aquaculture*, here to assist with your live-harvest orders 24/7. 🐟

Our dedicated team at our *Recirculatory Aquaculture System at Malabagh* handles live harvesting, cleaning, food-grade biodegradable packaging (0% ice), and fast delivery directly to your shared GPS location.

How many kilograms (kg) would you like to order today, and which area in Srinagar shall we deliver to?"
======================================================`;
  }

  // ─── 1 KG QUERY INTENT DECODER (4-TIER AWARE PRICING & EXPRESS DELIVERY) ───
  const is1KgIntent = /\b(?:(?:can\s*(?:i|we)\s*order|order|want|give|send|bhej\s*do|deliver|pack|price|rate|chahiye|mangwana|how\s*much\s*for)\s*)?(?:1|one)\s*(?:kg|kilo|kgs)\b/i.test(trimmedLower) || /^(?:1|one)\s*(?:kg|kilo|kgs)$/i.test(trimmedLower);
  if (is1KgIntent) {
    const locDist = detectedLoc?.dist ?? (chatMetadata[chatId]?.distanceKm ?? null);
    const locName = detectedLoc?.name ?? (chatMetadata[chatId]?.localityName ?? "your area");
    const kgWeatherPolicy = evaluateWeatherDeliveryPolicy(locDist);

    if (locDist !== null && kgWeatherPolicy.blockedByWeather) {
      intentContext += `\n======================================================
${kgWeatherPolicy.weatherIcon} WEATHER HOLD OVERRIDE FOR 1 KG (${locName}, ~${locDist} km): Express delivery is paused beyond ${WEATHER_RESTRICT_RADIUS_KM} km during active ${kgWeatherPolicy.weatherNoun}. DO NOT output [PAY_LINK: ...]. Invite the customer to our Live Vending Center in Malabagh or wait for weather to clear${hasRecentWeatherAdvisory(history, locName) ? " (keep your reply brief since the full Weather Delivery Advisory was already shared earlier in this chat)" : ""}!
======================================================`;
    } else if (locDist !== null && locDist > 11.5 && locDist <= 16.0) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 4", ZONE LABELS, "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido"!
• Express delivery is 100% FREE on our 5 kg family pack (₹2,900 total).
• If customer wants 1 kg starter pack: ₹580 + ₹${190 + surgeAdd} delivery fee = *₹${770 + surgeAdd} total*.
• If customer wants 2 kg: ₹1,160 + ₹${139 + surgeAdd} delivery fee = *₹${1299 + surgeAdd} total*.
• When customer confirms 1 kg: output [PAY_LINK: ${770 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: ${1299 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
    } else if (locDist !== null && locDist > 7.0 && locDist <= 11.5) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 3", ZONE LABELS, "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido"!
• Express delivery is 100% FREE on 3 kg (₹1,740 total).
• If customer wants 1 kg starter pack: ₹580 + ₹${130 + surgeAdd} delivery fee = *₹${710 + surgeAdd} total*.
• If customer wants 2 kg: ₹1,160 + ₹${89 + surgeAdd} delivery fee = *₹${1249 + surgeAdd} total*.
• When customer confirms 1 kg: output [PAY_LINK: ${710 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
    } else if (locDist !== null && locDist > 4.0 && locDist <= 7.0) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 2", ZONE LABELS, "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido"!
• Express delivery is 100% FREE on 3 kg (₹1,740 total).
• If customer wants 1 kg starter pack: ₹580 + ₹${75 + surgeAdd} delivery fee = *₹${655 + surgeAdd} total*.
• If customer wants 2 kg: ₹1,160 + ₹${55 + surgeAdd} delivery fee = *₹${1215 + surgeAdd} total*.
• When customer confirms 1 kg: output [PAY_LINK: ${655 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: ${1215 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]${kgWeatherPolicy.deliverWithDelayWarning ? `\n• Weather Delay Notice: Remind customer delivery within ${WEATHER_RESTRICT_RADIUS_KM} km may be slightly delayed due to ${kgWeatherPolicy.weatherNoun}.` : ""}
======================================================`;
    } else if (locDist !== null && locDist <= 4.0) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 1", ZONE LABELS, "doorstep", "cold-chain", "chilled", "subsidized", "70%", "30%", OR "Rapido"!
• Express delivery is 100% FREE on 2 kg (₹1,160 total).
• If customer prefers just 1 kg as a starter pack: ₹580 + ₹${45 + surgeAdd} delivery fee = *₹${625 + surgeAdd} total* (or free counter pickup at our Live Vending Center in Malabagh with zero delivery fee).
• When customer confirms 1 kg: output [PAY_LINK: ${625 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]${kgWeatherPolicy.deliverWithDelayWarning ? `\n• Weather Delay Notice: Remind customer delivery within ${WEATHER_RESTRICT_RADIUS_KM} km may be slightly delayed due to ${kgWeatherPolicy.weatherNoun}.` : ""}
======================================================`;
    } else {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer asked about 1 kg price/order, and their locality in Srinagar is NOT yet known.
⚠️ STRICT BREVITY MANDATE (3 SHORT LINES MAX):
• DO NOT dump delivery fee ranges (NO "₹85 for nearby, ₹115–₹230 for other areas"), DO NOT mention "2 kg+ / 3–5 kg", DO NOT mention "Live Vending Center", DO NOT mention "biodegradable polythene / 0% ice", and DO NOT ask for a WhatsApp location pin or Google Maps link yet!
• Reply cleanly and concisely like this:
  "${isFirstMessage ? `${timeOfDayGreeting} Welcome to *Urban Trout Aquaculture*! 🐟\n\n` : ""}• Cleaned & Gutted (Pan-ready steaks): *₹580/kg*
  🛵 Express delivery across Srinagar within 2 hours (FREE on eligible orders).

  Which area in Srinagar are you in? I'll share your exact total right away!"
${currentWeather.isBadWeather ? `• Note briefly: Due to active ${globalWeatherPolicy.weatherNoun}, express delivery currently covers up to ${WEATHER_RESTRICT_RADIUS_KM} km from Malabagh.` : ""}
======================================================`;
    }
  }

  // ─── META AD CTA FIRST-TURN HOOK BOOSTER ───
  const isMetaAdCtaLead = isFirstMessage && /check\s+delivery\s+time\s+to\s+my\s+area/i.test(trimmedLower) && !detectedLoc;
  if (isMetaAdCtaLead) {
    const adTimingLine = isFridayToday
      ? "Closed Fridays for maintenance — booking *Saturday (8–11 AM)* from our Recirculatory Aquaculture System at Malabagh!"
      : isNightAfter9PM
      ? `Tonight's dispatches closed at 8:00 PM — booking fresh harvests from our Recirculatory Aquaculture System at Malabagh for *tomorrow (${isThursdayToday && !isFridayOpen ? "Saturday" : tomorrowDayName}, 8:00 AM+)*!`
      : "Live harvest to order from our Recirculatory Aquaculture System at Malabagh (0% ice), delivered across Srinagar in *60–90 mins*!";
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Fresh Meta Ad Click Lead asking delivery time without an area yet!
CRITICAL CONVERSION HOOK (ZERO WALL-OF-TEXT — ALWAYS INCLUDE ₹580/KG RATE + TOP AREAS):
Reply warmly and concisely with this exact structure:
"${timeOfDayGreeting} Welcome to *Urban Trout Aquaculture*! 🐟
${adTimingLine}

• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)
🛵 *Express delivery is FREE* on eligible orders (e.g. 2 kg nearby)

*Which area are you in?* (e.g. Hazratbal, Soura, Lal Chowk, Rajbagh, Hyderpora — or tap 📎 ➔ Location 📍)"
======================================================`;
  }

  // ─── SINGLE FISH / SUB-1KG INTENT DECODER ───
  const isSingleFishIntent = /\b(?:only\s*(?:1|one|ek)|(?:1|one|ek)\s*(?:fish|trout|machli|machhli|piece)|single\s*fish|half\s*kg|500\s*g(?:ram|m)?s?|aadha\s*kilo)\b/i.test(trimmedLower) && !/\b(?:kg|kilo|kilos)\b/i.test(trimmedLower);
  if (isSingleFishIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer asked for 1 fish / single piece / <1 kg ("${userMessage.trim()}").
CRITICAL POLICY:
• For home delivery, we supply strictly by weight starting at a *1 kg starter pack* (~2 table-sized trout, ₹580 + express courier fee). We do NOT deliver a single fish.
• For a single fish or smaller purchase, warmly invite them to pick up live trout in person at our Live Vending Center in Malabagh (Near R. P. School Girls Wing, Sat–Thu 8 AM – 8 PM, 📍 https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9)!
======================================================`;
  }

  // ─── WHOLE / UNCLEANED TROUT INQUIRY INTENT DECODER ───
  const isWholeTroutInquiry = !/\bnot\s+whole\b/i.test(trimmedLower) && /\b(?:whole(?:\s*trout|\s*fish)?|round(?:\s*trout|\s*fish)?|sabut(?:\s*machli|\s*fish)?|uncleaned|bina\s*saaf|bina\s*gut|bina\s*clean|without\s*cleaning|without\s*gutting|full\s*fish|un-cleaned)\b/i.test(trimmedLower);
  if (isWholeTroutInquiry) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking about WHOLE / UNCLEANED / SABUT TROUT ("${userMessage.trim()}").
🛑 CRITICAL POLICY: WE DO NOT DELIVER WHOLE TROUT ANYMORE!
• Whole Trout (₹540/kg) delivery is strictly DISCONTINUED — customers CAN still order/buy Whole Trout (₹540/kg) in person for walk-in self-pickup ONLY at our Live Vending Center in Malabagh (Near R. P. School Girls Wing, Sat–Thu 8 AM – 8 PM) and take it themselves!
• For express delivery across Srinagar, we supply EXCLUSIVELY *Cleaned & Gutted* pan-ready pieces at *₹580/kg* (descaled, zero kitchen mess).
⚠️ STRICT CONFIDENTIALITY LAW: NEVER mention internal operational reasons, margins, bulky fish, or packaging splits!
• Reply clearly & politely:
  "We don't deliver Whole Trout anymore. Whole Trout (₹540/kg) is available exclusively for in-person self-pickup at our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Sat–Thu 8 AM–8 PM), where you can pick live trout and take it yourself.

For express delivery across Srinagar, we exclusively deliver *Cleaned & Gutted* pan-ready steaks at *₹580/kg* (completely descaled, zero kitchen mess). Would you like Cleaned & Gutted delivered, or would you prefer picking up Whole Trout at our Malabagh center? 🐟"
======================================================`;
  }

  // ─── FISH PRODUCT PHOTO REQUEST INTENT DECODER ───
  const isPhotoReq = (
    /\b(?:pic|pics|photo|photos|picture|pictures|tasveer|snap|image)\b/i.test(trimmedLower) &&
    !/\b(?:qr|scanner|upi|payment|pay|receipt|screenshot|proof)\b/i.test(trimmedLower)
  );
  if (isPhotoReq) {
    intentContext += `\n======================================================
📸 QUERY INTENT DECODED: Customer explicitly asked to see photos of the trout ("${userMessage.trim()}").
CRITICAL INSTRUCTION:
• Our system is AUTOMATICALLY sending them our real photo of fresh pan-ready Cleaned & Gutted Himalayan Rainbow Trout right below your text message!
• Do NOT say "I cannot send photos" and do NOT ignore their photo request!
• Write warmly: "Here is a photo of our fresh pan-ready *Cleaned & Gutted* Himalayan Rainbow Trout steaks (completely descaled, zero ice)! Every order is harvested live to order from our Recirculatory Aquaculture System at Malabagh upon confirmation."
• Then smoothly invite the next step (e.g., area/GPS pin or payment confirmation if order is already quoted).
======================================================`;
  }

  if (options && options.isVoiceNote) {
    intentContext += `\n======================================================
🎙️ VOICE NOTE INPUT (AUTO-TRANSCRIBED):
• This message came from an audio voice note sent by the customer himself/herself (auto-transcribed text can contain minor phonetic speech-to-text typos).
• Treat it strictly as THIS customer's own trout inquiry/order — NEVER refuse for third-party privacy just because an auto-transcribed word looks like "his/her/uska".
======================================================`;
  }

  if (isExplicitCodInsistence(userMessage)) {
    intentContext += `\n======================================================
💳 CUSTOMER REQUESTED CASH ON DELIVERY (COD):
• The customer asked or insisted to pay on delivery ("${userMessage.trim()}").
• 🛑 DO NOT output [PAY_LINK: ...] or a Cashfree Order Summary card in this turn!
• Politely and briefly explain that we operate strictly 100% Prepaid because every trout is harvested live to order from our oxygen-saturated cold water tanks at Malabagh immediately after confirmation (0% ice, zero cold-storage stock).
• Close warmly by asking: "Would you like me to send our 1-Tap payment link whenever you're ready to confirm your fresh harvest? (Works with Google Pay, PhonePe, Paytm & J&K Bank mPay)"
======================================================`;
  }

  // ─── CUTS & PREPARATION INTENT DECODER ───
  const isCutsIntent = /\b(?:what\s*cuts?|types?\s*of\s*cuts?|cut\s*type|kaise\s*cut|pieces?|cut\s*karke|slice|steak|fillet|cleaned\s*(?:and|&)\s*gutted\s*kya\s*hai|what\s*is\s*cleaned)\b/i.test(trimmedLower);
  if (isCutsIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer asked about cuts & preparation ("${userMessage.trim()}").
CRITICAL DIRECTIVE (PAN-READY CONVENIENCE EXCLUSIVE):
Directly explain our standard preparation without pivoting or asking unrelated questions:
• *Cleaned & Gutted (₹580/kg):*
  Completely gutted, descaled (all scales removed), and cut into cooking pieces/steaks. Arrives 100% pan-ready with ZERO preparation, ZERO mess, and ZERO cleaning needed at home!
• Note: For express delivery we supply Cleaned & Gutted only (Whole trout delivery is discontinued — Whole Trout ₹540/kg is self-pickup only at our Live Vending Center in Malabagh).
======================================================`;
  }

  // ─── VISCERAL WEIGHT LOSS & NET MEAT WEIGHT INTENT DECODER ───
  const isWeightLossIntent = /\b(?:(?:1\s*kg|one\s*kg|kitna|full)\s*(?:of\s*)?meat|meat\s*only|net\s*meat|net\s*weight|final\s*weight|after\s*clean(?:ing)?|after\s*gut(?:ting)?|saaf\s*karne\s*ke\s*baad|cleaning\s*ke\s*baad|cleaning\s*loss|visceral|weight\s*loss|weight\s*kam|kitna\s*(?:meat|weight)\s*(?:milega|bachega|hoga)|cutting\s*loss|sirf\s*meat|meat\s*weight)\b/i.test(trimmedLower);
  if (isWeightLossIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking about NET MEAT WEIGHT / VISCERAL CLEANING LOSS ("${userMessage.trim()}").
⚠️ CRITICAL HONESTY & TRANSPARENCY LAW (ZERO MISREPRESENTATION):
• NEVER tell the customer that they get 1 kg of pure meat for ₹580! That is FALSE and illegal!
• All our trout are swimming live in crystal-clear Recirculatory Aquaculture System (RAS) cold-water tanks and harvested live upon order.
• Directly & transparently explain:
  1. Live fish is weighed whole on certified digital scales at harvest (1.0 kg live harvest weight).
  2. Expert gutting and descaling removes gills, scales, and entrails, which naturally results in a standard 15% to 20% visceral weight loss.
  3. A 1 kg live trout yields approximately 800g to 850g of 100% clean, ready-to-cook, pan-ready steaks with zero kitchen mess.
  4. We bill strictly against the certified live harvest weight at ₹580/kg.
  5. If they specifically require a full 1.0 kg of net cleaned meat on their kitchen scale, we can harvest a ~1.25 kg live trout for them (₹725).
• Ask if they would like a 1 kg live harvest (~800–850g net steaks) or a 1.25 kg live harvest (1 kg net steaks)!
======================================================`;
  }

  // ─── TOMORROW / ADVANCE BOOKING INTENT DECODER ───
  const isAskingTomorrow = /\b(?:tomorrow|kal|planning\s*for\s*tomorrow|tomorrow\s*(?:morning|afternoon|evening)|kal\s*(?:ko|ka|bhej)|advance\s*booking)\b/i.test(trimmedLower);
  if (isAskingTomorrow && !isThursdayToday && !isFridayToday) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about delivery for TOMORROW (${tomorrowDayName}).
TEMPORAL REALITY DIRECTIVE:
• TODAY IS ${todayDayName.toUpperCase()} (${formattedDateStr}). TOMORROW IS ${tomorrowDayName.toUpperCase()}.
• We are FULLY OPEN tomorrow (${tomorrowDayName}) from 8:00 AM to 8:00 PM!
• STRICT PROHIBITION: Under NO circumstances call tomorrow "Saturday" or mention Friday closure!
• Confirm that we are happy to schedule their fresh live-harvest delivery for tomorrow (${tomorrowDayName}) with 3 slots:
  • 🕗 Morning Slot: 8:00 AM – 11:00 AM (Harvest starts 8:00 AM)
  • 🕛 Afternoon Slot: 12:00 PM – 3:00 PM
  • 🕔 Evening Slot: 4:00 PM – 7:00 PM
• Ask which slot works best and confirm their quantity (Cleaned & Gutted @ ₹580/kg, min 2–5 kg depending on area for 100% free delivery)!
======================================================`;
  }

  // ─── CUTTING / BONELESS / SKINLESS POLICY INTENT DECODER ───
  const isCutPreferenceIntent = /\b(?:boneless|bone\s*less|bina\s*kaant[ae]|without\s*bone|remove\s*(?:the\s*)?skin|skin\s*remove|skin\s*less|skinless|skin\s*nikal|chamdi\s*nikal|skin\s*utarna|bina\s*skin|fillet)\b/i.test(trimmedLower);
  if (isCutPreferenceIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking for BONELESS or SKINLESS cut ("${userMessage.trim()}").
CRITICAL DIRECTIVE ON BUTCHERING & CUTTING POLICY:
• State firmly, clearly, and politely:
  "We do not offer boneless or skinless trout cuts.
  At Urban Trout, every fish is descaled using our precision machinery, and our professional farm butchers cut clean, pan-ready steaks (bone-in with skin on).
  Trout skin is extremely delicate, naturally scale-free after our machine descaling, and crisps deliciously in a pan without peeling or curling."
• Confirm their preferred quantity and delivery area!
======================================================`;
  }

  // ─── DELIVERY SPEED / FASTER / 1-HOUR DELIVERY INTENT DECODER ───
  const isDeliverySpeedOrUrgentIntent = /\b(?:faster|fast|jaldi|jddi|jldi|urgent|emergency|early|quick|how\s*(?:fast|soon)|kitna\s*time|kitne\s*(?:baje|ghante|time|der)|kab\s*tak|kitni\s*der|deliver(?:y)?\s*time|time\s*lagega|can\s*(?:it|you)\s*(?:reach|deliver)\s*(?:in|faster|early|within)|1\s*hour|one\s*hour|30\s*min(?:utes?)?|45\s*min(?:utes?)?|delivery\s*(?:speed|duration|window))\b/i.test(trimmedLower);
  if (isDeliverySpeedOrUrgentIntent) {
    const locDist = detectedLoc?.dist ?? (chatMetadata[chatId]?.distanceKm ?? null);
    const locName = detectedLoc?.name ?? (chatMetadata[chatId]?.localityName ?? null);
    const isNearby = locDist !== null && locDist <= 4.0;

    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about delivery speed, timing, or faster/urgent delivery ("${userMessage.trim()}").
CRITICAL DIRECTIVE ON DYNAMIC DELIVERY SPEED & 1-HOUR DELIVERY:
• Standard live-harvest delivery across Srinagar: within 2 hours of payment confirmation (harvested live upon order from our Malabagh tanks, descaled & cleaned pan-ready, and dispatched).
• FASTER DISPATCH QUEUE RULE:
  Explain warmly that if there are fewer orders in our live-harvest queue at the moment, their order will be harvested immediately and dispatched even faster!
${isNearby ? `• ⚡ NEARBY 1-HOUR FAST TRACK (${locName}, ~${locDist} km from farm):
  Since ${locName} is within our nearby 4 km range, if the live-harvest queue is clear, they can expect delivery *within 1 hour (approx. 45–60 minutes)*!
  Reassure them: "Since ${locName} is close to our Recirculatory Aquaculture System at Malabagh (~${locDist} km), if you place your order now and our harvest queue is clear, delivery can arrive within 1 hour (approx. 45–60 minutes)! Standard window across Srinagar is within 2 hours."` : (locDist !== null ? `• For ${locName} (~${locDist} km):
  Standard express delivery is within 2 hours of payment confirmation. If our harvest queue is light, it dispatches immediately and reaches even sooner!` : `• If area is not yet confirmed:
  "Our standard live-harvest express delivery is within 2 hours across Srinagar. If our harvest queue is light, orders dispatch immediately and arrive even faster!
  For nearby areas (within 4 km like Malabagh, Soura, Hazratbal, Zakura, Lal Bazar, Buchpora), delivery can arrive *within 1 hour (approx. 45–60 minutes)* when the harvest queue is clear!
  Which area in Srinagar are you located in?"`)}
• Keep it confident, reassuring, and concise (2–3 short lines).
======================================================`;
  }

  // ─── FISH SIZE / "BIG FISH" / INDIVIDUAL WEIGHT INTENT DECODER ───
  const isSizeOrBigFishIntent = /\b(?:big\s*size|large\s*size|badi\s*machli|bada\s*size|bade\s*size|chota\s*size|small\s*size|fish\s*size|size\s*kya\s*hai|weight\s*per\s*fish|individual\s*fish|individual\s*big|1\s*fish\s*kitne|per\s*fish\s*weight|trout\s*size|kitne\s*gram|size\s*kitna|king\s*size|huge\s*size)\b/i.test(trimmedLower);
  if (isSizeOrBigFishIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer asked about fish size, individual fish weight, or big/large fish ("${userMessage.trim()}").
CRITICAL DIRECTIVE ON TABLE-SIZE CULINARY GOLD STANDARD:
• We do NOT sell by size categories (no small/medium/large/King). All our live Rainbow Trout are healthy, premium table-sized fish (approx. 400g–500g each; ~4 to 5 fish per 2 kg order).
• CULINARY REASONING (WHY TABLE-SIZE IS SUPERIOR):
  1. 400g–500g is the international culinary gold standard (meat is tender, succulent, and absorbs Kashmiri spices to the bone, whereas overgrown fish become fibrous and oily).
  2. Overgrown large trout become fibrous, coarse, tough, and accumulate heavy visceral oil and fat.
  3. STRICT CONSTRAINT: NEVER use words like "bureaucrats", "officers", "IAS", or "VIPs"! Keep the pitch 100% focused on tenderness, culinary excellence, and rich Kashmiri spice absorption.
• Pitch structure (warm, confident & educational):
  "Our live Rainbow Trout are premium table-sized fish (each weighing approx. 400g–500g; a 2 kg order gives 4–5 pan-ready fish).
  400g–500g is the international culinary gold standard (meat is tender, succulent, and absorbs Kashmiri spices to the bone, whereas overgrown fish become fibrous and oily).

  Cleaned & Gutted is ₹580/kg (pan-ready steaks, descaled with zero kitchen mess). How many kilograms would you like to order today?"
======================================================`;
  }

  // ─── CUSTOMER DECLINE / CANCEL / "NO NEED" INTENT DECODER ───
  const isDeclinedIntent = /\b(?:no\s*need|no\s*thanks?|not\s*now|cancel\s*(?:it|order)?|nahi\s*chahiye|na\s*bhejo|mat\s*bhejo|rehne\s*do|nahi\s*lena)\b/i.test(trimmedLower);
  if (isDeclinedIntent) {
    if (!chatMetadata[chatId]) chatMetadata[chatId] = {};
    chatMetadata[chatId].declined = true;
    chatMetadata[chatId].followUpSent = true;
    if (customerPhone) {
      if (!chatMetadata[customerPhone]) chatMetadata[customerPhone] = {};
      chatMetadata[customerPhone].declined = true;
      chatMetadata[customerPhone].followUpSent = true;
    }
    saveChatMetadata();

    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer politely declined, canceled, or said no need ("${userMessage.trim()}").
CRITICAL COURTEOUS EXIT DIRECTIVE:
• Respect their decision immediately with warmth and grace (zero pressure, zero pushiness):
  "No problem at all! Feel free to message us anytime whenever you crave fresh live-harvest trout or visit our Live Vending Center in Malabagh. Have a wonderful day! 🐟"
• Keep it to 1–2 short polite lines. DO NOT push more sales or ask more questions!
======================================================`;
  }

  // ─── MPAY / BANK ACCOUNT DETAILS INTENT DECODER ───
  const isMpayIntent = /\b(?:mpay|m-pay|m\s*pay|jkb\s*mpay|jk\s*bank\s*mpay|account\s*(?:no|number|details)|bank\s*transfer|ifsc|direct\s*transfer|google\s*pay\s*number|phonepe\s*number)\b/i.test(trimmedLower);
  if (isMpayIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking about J&K Bank mPay, direct bank transfer, or account details ("${userMessage.trim()}").
CRITICAL DIRECTIVE ON MPAY & BANK ACCOUNT DETAILS:
• STRICT NEGATIVE CONSTRAINT: NEVER share or mention "JKBMERC00828895@jkb".
• Provide the official J&K Bank account details directly:
  "Yes! For direct J&K Bank mPay or bank transfer, here are our official details:
  • Account Number: 0724010100000499
  • IFSC Code: JAKA0MALBAG
  • Account Name: Urban Trout Aquaculture
  • Bank: J&K Bank, Malabagh Branch

  📸 *Please share your payment screenshot here once transferred!* Our team at the Recirculatory Aquaculture System at Malabagh will verify it within 5 minutes and immediately initiate your live harvest!"
• You MUST explicitly state: "verification takes 5 minutes for our team at the Recirculatory Aquaculture System at Malabagh".
• Also reassure them that tapping our official 1-Tap Cashfree payment link works seamlessly with the J&K Bank mPay app (as well as Google Pay, PhonePe & Paytm — no QR scan needed)!
======================================================`;
  }

  // ─── PAYMENT LINK ON-DEMAND INTENT DECODER ───
  const isPaymentLinkIntent = /\b(?:payment\s*link|pay\s*link|online\s*link|link\s*(?:please|bhejo|de\s*do|bhej\s*do|send|share|share\s*karo)|send\s*(?:me\s*)?(?:the\s*)?link|share\s*(?:me\s*)?(?:the\s*)?link|give\s*(?:me\s*)?(?:the\s*)?link|where\s*(?:is\s*)?(?:the\s*)?link|can\s*you\s*(?:send|give|share)\s*(?:the\s*)?link)\b/i.test(trimmedLower);
  if (isPaymentLinkIntent) {
    const isOrderLinkValid = (ord) => {
      if (!ord || !ord.payUrl || isHistoricalOrderPaid(ord)) return false;
      const d = new Date(ord.createdAt || ord.updatedAt || 0);
      const isToday = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === TodayOrderPool.getTodayDateIst();
      const ageMin = (Date.now() - d.getTime()) / (60 * 1000);
      return isToday && ageMin < 210; // Valid under 3.5 hours and created today
    };

    const validOrderForLink = isOrderLinkValid(todayOrderForCustomer)
      ? todayOrderForCustomer
      : (isOrderLinkValid(existingOrder) ? existingOrder : null);

    const activePayUrl = validOrderForLink?.payUrl || null;
    const activeOrderRef = validOrderForLink?.orderRef || null;
    const activeOrderAmt = validOrderForLink?.amount || null;

    if (activePayUrl) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer explicitly requested an online payment link ("${userMessage.trim()}").
CRITICAL DIRECTIVE: Customer requested their active payment link. Share it directly:
"Here is your secure online payment link for Order #${activeOrderRef || 'LIVE'} (${activeOrderAmt || ''}):
🔗 ${activePayUrl}

You can pay securely via Google Pay, PhonePe, Paytm, J&K Bank mPay, or any UPI app. Once payment is completed, your fresh live harvest will be immediately initiated at our Recirculatory Aquaculture System at Malabagh!"
DO NOT alter price or create a duplicate order.
======================================================`;
    } else {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer requested a payment link ("${userMessage.trim()}"), but no active unexpired order link exists.
CRITICAL DIRECTIVE: Any payment link older than 3.5 hours or from a previous day has EXPIRED. If this is a returning lead, calculate their order with current updated delivery rates. Inform the customer:
1. Confirm their preferred quantity (e.g. 1 kg, 2 kg, 3 kg)
2. Delivery location in Srinagar (or drop GPS pin)
We will immediately generate a fresh 1-Tap payment link!
======================================================`;
    }
  }

  // (Real-time IST Clock moved to top of generateGeminiReply)

  // ─── STORE VISIT / EXACT LOCATION INTENT DECODER ───
  const isVisitLocationIntent = /\b(?:where\s*(?:are\s*you|is\s*(?:your|the)\s*(?:farm|shop|store|counter|location|center|address))|location\s*(?:bhejo|share|do|plz|please)|exact\s*location|maps?\s*link|kahan\s*(?:pe\s*)?hai|kidhar\s*hai|visit\s*karna\s*hai|aana\s*hai|dukaan|counter\s*(?:kahan|kidhar|address))\b/i.test(trimmedLower);
  if (isVisitLocationIntent) {
    const counterHoursNote = isFridayToday
      ? "Counter Hours: STRICTLY CLOSED TODAY (FRIDAY) for weekly maintenance. Re-opens Saturday at 8:00 AM!"
      : (isFridayOpen && isFridayNormally)
      ? "Counter Hours: 8:00 AM to 8:00 PM (SPECIAL OPENING TODAY, FRIDAY)"
      : "Counter Hours: 8:00 AM to 8:00 PM (Saturday to Thursday, strictly closed Fridays)";
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer asked to visit or wants our exact location ("${userMessage.trim()}").
CRITICAL DIRECTIVE: DO NOT ASK FOR THEIR DELIVERY ADDRESS! Answer directly with our store details:
"You are warmly welcome to visit our Live Vending Center in Malabagh directly! 🐟

📍 Address: Near R. P. School Girls Wing, Malabagh, Srinagar
⏰ ${counterHoursNote}
🗺️ Google Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9

You can choose live swimming trout from our counter tanks, watch it harvested live, and get it cleaned and cut into pan-ready steaks on the spot!"
======================================================`;
  }

  // ─── FRIDAY DETERMINISTIC HARD LOCK (ENTIRE OPERATION 100% CLOSED) ───
  const isTargetOutOfZone = (detectedLoc && detectedLoc.status === "OUT_ZONE");
  if (isFridayToday && !/\b(?:saturday|advance|hafta)\b/i.test(trimmedLower) && !isCutPreferenceIntent && !isSizeOrBigFishIntent && !isTargetOutOfZone && !isMpayIntent && !isPaymentLinkIntent) {
    const isFridayInquiry = /(?:deliver|order|open|aaj|today|now|abhi|right\s*now|available|bhej|chahiye|rate|visit|kahan|hai\s*kya|trout|fish|rate|price|cost|timing)/i.test(trimmedLower);
    if (isFridayInquiry) {
      const deterministicFridayReply = `Our Live Vending Center and express delivery operations are strictly closed today (Friday) for weekly bio-security maintenance, filtration backwashing, and staff weekly off.

However, we are actively taking advance bookings for tomorrow, Saturday!
• 🕗 *Morning Slot:* 8:00 AM – 11:00 AM (Harvest starts 8:00 AM)
• 🕛 *Afternoon Slot:* 12:00 PM – 3:00 PM
• 🕔 *Evening Slot:* 4:00 PM – 7:00 PM

• Cleaned & Gutted: *₹580/kg* (Pan-ready pieces — zero prep)

🛵 *Express delivery is 100% FREE* on eligible orders (min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas; standard express delivery fee on smaller orders)!

Would you like us to schedule a fresh live-harvest delivery for you tomorrow (Saturday)?`;

      history.push({ role: "user", text: userMessage });
      history.push({ role: "model", text: deterministicFridayReply });
      if (history.length > 16) history.splice(0, history.length - 16);
      chatHistories.set(chatId, history);
      saveChatHistories();
      return deterministicFridayReply;
    }
  }

  // ─── THURSDAY HARD LOCK FOR FRIDAY / TOMORROW INQUIRIES ───
  const isAskingTomorrowOnThursday = isThursdayToday && !isFridayOpen && /\b(?:tomorrow|kal|friday|jumma|juma|jummah)\b/i.test(trimmedLower);
  if (isAskingTomorrowOnThursday && /(?:available|deliver|delivery|open|bhej|chahiye|order|mil\s*jayega|mil\s*sakega|ho\s*(?:sakta|jayega)|send|timing|slot)/i.test(trimmedLower)) {
    const deterministicThuForFriReply = isNightAfter9PM
      ? `Our deliveries for tonight closed at 8:00 PM, and tomorrow (Friday) our farm and delivery operations are strictly closed for weekly bio-security maintenance and filtration backwashing (zero counter walk-ins and zero express deliveries on Friday).

We would be delighted to schedule your fresh live-harvest delivery for *Saturday* with your preferred slot:
• 🕗 *Morning:* 8:00 AM – 11:00 AM (Harvest starts 8:00 AM)
• 🕛 *Afternoon:* 12:00 PM – 3:00 PM
• 🕔 *Evening:* 4:00 PM – 7:00 PM

🛵 *Express delivery is 100% FREE* on eligible orders (min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas; standard express delivery fee on smaller orders)!

Which Saturday slot works best for you?`
      : `Tomorrow is Friday, and our farm and delivery operations are strictly closed on Fridays for scheduled bio-security maintenance and filtration backwashing (zero counter walk-ins and zero express deliveries on Friday).

We would be delighted to schedule your fresh live-harvest delivery for:
1️⃣ *Today (Thursday):* Fresh express delivery within 2 hours (open until 8:00 PM)!
2️⃣ *Saturday:* Advance booking with your preferred slot:
• 🕗 *Morning:* 8:00 AM – 11:00 AM
• 🕛 *Afternoon:* 12:00 PM – 3:00 PM
• 🕔 *Evening:* 4:00 PM – 7:00 PM

🛵 *Express delivery is 100% FREE* on eligible orders (min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas; standard express delivery fee on smaller orders)!

Would you prefer fresh delivery today (Thursday) within 2 hours, or an advance booking for Saturday?`;

    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: deterministicThuForFriReply });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return deterministicThuForFriReply;
  }

  // DETERMINISTIC HARD LOCK PAST 8:00 PM IST (NIGHT AFTER-HOURS)
  // If local time is outside delivery hours and customer asks for immediate delivery / tonight / 1-2 hours:
  const mentionsTomorrow = /\b(?:tomorrow|kal|subah|morning|afternoon|evening|saturday|hafta)\b/i.test(userMessage);
  const isAskingImmediateTonight = !mentionsTomorrow && /(?:(?:any\s*)?(?:1|2|one|two)\s*hours?|tonight|right\s*now|ab\s*hi|abhi|aaj\s*hi|today\s*night|deliver\s*(?:now|tonight|today)|immediate|jaldi|urgent|asap)/i.test(userMessage);

  if (isNightAfter9PM && isAskingImmediateTonight) {
    let deterministicNightReply = "";
    if (existingOrder && !existingOrder.notFound && /(?:paid|confirmed|harvest|dispatch)/i.test(existingOrder.status || "")) {
      deterministicNightReply = (isThursdayToday && !isFridayOpen)
        ? `Our deliveries for tonight closed at 8:00 PM. Please note our farm is strictly closed on Fridays for weekly filtration and bio-security maintenance.

Your order (*#${existingOrder.orderRef}* - ${existingOrder.items || "Fresh Rainbow Trout"}) is confirmed! It is scheduled for fresh morning live harvest and express dispatch via our Express Dispatch Partner on *Saturday morning between 8:00 AM and 11:00 AM*.

Please keep your phone reachable — our Express Dispatch Partner calls prior to arrival for a prompt handover at your shared pin!`
        : `Our deliveries for tonight closed at 8:00 PM. We start fresh orders from 8:00 AM every morning!

Your order (*#${existingOrder.orderRef}* - ${existingOrder.items || "Fresh Rainbow Trout"}) is confirmed! It is scheduled for fresh morning live harvest from our crystal-clear oxygen-saturated cold water tanks and express dispatch via our Express Dispatch Partner tomorrow morning between *8:00 AM and 11:00 AM*.

Please keep your phone reachable — our Express Dispatch Partner calls prior to arrival for a prompt handover at your shared pin!`;
    } else {
      deterministicNightReply = (isThursdayToday && !isFridayOpen)
        ? `Our deliveries for tonight closed at 8:00 PM. Please note that our farm is strictly closed on Fridays for weekly filtration and bio-security maintenance (zero counter walk-ins and zero express deliveries on Friday).

We start taking fresh live-harvest orders from 8:00 AM every Saturday morning! We would be delighted to schedule your delivery for Saturday:
• 🕗 *Morning Slot:* 8:00 AM – 11:00 AM (Harvest starts 8:00 AM)
• 🕛 *Afternoon Slot:* 12:00 PM – 3:00 PM
• 🕔 *Evening Slot:* 4:00 PM – 7:00 PM

🛵 *Express delivery is 100% FREE* on eligible orders (min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas; standard express delivery fee on smaller orders)!

Which slot on Saturday works best for your delivery, and how many Kgs of Cleaned & Gutted trout (₹580/kg, pan-ready) shall I book for you?`
        : `Our deliveries for tonight closed at 8:00 PM. We start taking fresh live-harvest orders from 8:00 AM every morning!

We would be delighted to schedule your fresh live-harvest delivery for tomorrow:
• 🕗 *Morning Slot:* 8:00 AM – 11:00 AM (Harvest starts 8:00 AM)
• 🕛 *Afternoon Slot:* 12:00 PM – 3:00 PM
• 🕔 *Evening Slot:* 4:00 PM – 7:00 PM

🛵 *Express delivery is 100% FREE* on eligible orders (min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas; standard express delivery fee on smaller orders)!

Which slot tomorrow works best for your delivery, and how many Kgs of Cleaned & Gutted trout (₹580/kg, pan-ready) shall I book for you?`;
    }

    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: deterministicNightReply });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return deterministicNightReply;
  }

  // DETERMINISTIC HARD LOCK PRE-DAWN BEFORE 8:00 AM (EARLY MORNING)
  // Harvest starts at 8:00 AM TODAY! Schedule for today's morning harvest!
  if (isEarlyPreDawn && isAskingImmediateTonight && !isFridayToday) {
    let deterministicEarlyReply = "";
    if (existingOrder && !existingOrder.notFound && /(?:paid|confirmed|harvest|dispatch)/i.test(existingOrder.status || "")) {
      deterministicEarlyReply = `Good morning! We start taking live orders and harvesting from 8:00 AM sharp today!

Your order (*#${existingOrder.orderRef}* - ${existingOrder.items || "Fresh Rainbow Trout"}) is confirmed! It is scheduled for today's first fresh live harvest, packed in food-grade biodegradable polythene (0% ice), and express morning dispatch via our Express Dispatch Partner between *8:00 AM and 11:00 AM*.

Please keep your phone reachable — our Express Dispatch Partner calls prior to arrival for a prompt handover at your shared pin! 🐟`;
    } else {
      deterministicEarlyReply = `Good morning! We start taking live orders and harvesting from 8:00 AM sharp today!

We would be delighted to schedule your fresh live-harvest delivery for this morning:
• 🕗 *Morning Slot:* 8:00 AM – 11:00 AM (Harvest starts at 8:00 AM today)
• 🕛 *Afternoon Slot:* 12:00 PM – 3:00 PM
• 🕔 *Evening Slot:* 4:00 PM – 7:00 PM

• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — descaled, zero kitchen mess, straight to pan)
🛵 *Express delivery is 100% FREE* on eligible orders (min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas; standard express delivery fee on smaller orders)!

Which slot today works best for you, and how many Kgs would you like for your family? 🐟`;
    }

    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: deterministicEarlyReply });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return deterministicEarlyReply;
  }

  const fridayOperatingNote = isFridayToday
    ? `CRITICAL ALERT: TODAY IS FRIDAY — WE ARE 100% CLOSED TODAY:
   - BOTH our Live Vending Center counter in Malabagh AND express delivery operations are STRICTLY CLOSED today for weekly farm bio-security maintenance, filtration backwashing, and staff weekly off.
   - ZERO live harvesting and ZERO dispatches today. Under NO circumstances should you promise or confirm delivery today!
   - If a customer asks for trout today or asks if we are open today, explain politely that we are closed on Fridays, and offer advance bookings for SATURDAY (Morning 8–11 AM, Afternoon 12–3 PM, Evening 4–7 PM).
   - Advance bookings and payment links for SATURDAY or later are warmly welcomed!`
    : (isFridayOpen && isFridayNormally)
    ? `FRIDAY OPERATIONS STATUS: SPECIAL OPEN DAY (ACTIVE BY OWNER OVERRIDE):
   - BOTH our Live Vending Center counter in Malabagh AND express delivery operations are 100% OPEN TODAY (FRIDAY)!
   - Operating Hours Today: 8:00 AM to 8:00 PM.
   - Live harvest begins immediately upon payment confirmation.
   - Express delivery within Srinagar is running within 2 hours of payment!
   - Welcome Friday orders and issue locked 1-Tap Cashfree payment links immediately (no QR needed).`
    : (isThursdayToday && !isFridayOpen)
    ? `CRITICAL ALERT: TODAY IS THURSDAY — TOMORROW IS FRIDAY (100% CLOSED):
   - We are OPEN for orders and deliveries TODAY (Thursday) until 8:00 PM (delivered within 2 hours).
   - ABSOLUTE LAW: TOMORROW IS FRIDAY — WE ARE 100% CLOSED TOMORROW! Both our Live Vending Center counter AND express deliveries are strictly closed on Fridays for farm filtration and bio-security maintenance.
   - ZERO dispatches and ZERO counter walk-ins on Friday!
   - NEVER promise, confirm, or accept orders for tomorrow (Friday).
   - If a customer asks about delivery for tomorrow or Friday, explain Friday closure and offer delivery TODAY (within 2 hours) or advance booking for SATURDAY!`
    : `STORE & DELIVERY HOURS:
   - Express Delivery: 8:00 AM to 8:00 PM (delivered to shared GPS pin within 2 hours).
   - Live Vending Center in Malabagh: Open 8:00 AM to 8:00 PM.`;

  let timeStatusDetail = "";
  if (isFridayToday) {
    timeStatusDetail = `🛑 CURRENT STATUS: FRIDAY — ENTIRE FACILITY & DELIVERIES 100% CLOSED TODAY!
- We are completely closed today (Friday) for weekly filtration bio-security maintenance.
- Zero live harvesting and zero dispatches today.
- We resume fresh operations tomorrow, Saturday morning at 8:00 AM!
- ALWAYS offer advance bookings for SATURDAY (Morning 8-11 AM, Afternoon 12-3 PM, Evening 4-7 PM).`;
  } else if (isOperatingHours) {
    const thuNote = (isThursdayToday && !isFridayOpen)
      ? "\n⚠️ URGENT REMINDER: TODAY IS THURSDAY. TOMORROW (FRIDAY) IS 100% CLOSED! NEVER OFFER OR PROMISE DELIVERY FOR TOMORROW/FRIDAY! If customer asks about tomorrow/Friday, offer delivery TODAY or advance booking for SATURDAY!" 
      : (isFridayOpen && isFridayNormally)
      ? "\n🟢 SPECIAL NOTICE: FRIDAY OPERATIONS ARE CURRENTLY OPEN BY OWNER OVERRIDE! Offer live delivery TODAY (Friday) within 2 hours!"
      : `\n📅 TODAY IS: ${todayDayName}. Tomorrow is ${tomorrowDayName}. We are OPEN today until 8:00 PM, and we are OPEN tomorrow (${tomorrowDayName}) from 8:00 AM! Do NOT mention Friday closure or Saturday!`;
    timeStatusDetail = `✅ CURRENT STATUS: OPEN & ACTIVELY ACCEPTING ORDERS (8:00 AM - 8:00 PM)!
- We start taking fresh live-harvest orders from 8:00 AM every single day${isFridayOpen ? " (including Friday by special override)" : " (except Friday)"}!
- We are currently open and actively taking orders for TODAY (${todayDayName}) right now!
- Live-harvested Rainbow Trout delivered across Srinagar within 2 hours (or at their preferred scheduled time slot today up to 8:00 PM).
- Minimum order for FREE delivery: 2 kg for 0–4 km, 3 kg for 4–11.5 km, 5 kg for 11.5–16 km (Rajbagh, Jawahar Nagar, Batamaloo, Sanat Nagar, Peerbagh, Airport Rd, Nowgam, Hyderpora, etc.); standard express delivery fee on smaller orders.
- ABSOLUTELY NEVER say "deliveries wrapped up" or "book for tomorrow" during daytime (8:00 AM - 8:00 PM)! Offer live delivery TODAY within 2 hours!${thuNote}`;
  } else if (isNightAfter9PM) {
    if (isThursdayToday && !isFridayOpen) {
      timeStatusDetail = `⚠️ CURRENT STATUS: THURSDAY NIGHT AFTER-HOURS (Current time in Srinagar is ${istTimeStr}).
- Tonight's deliveries closed at 8:00 PM.
- ⚠️ CRITICAL: TOMORROW IS FRIDAY — WE ARE 100% CLOSED TOMORROW!
- DO NOT OFFER DELIVERY FOR TOMORROW (FRIDAY)!
- We start taking fresh live-harvest orders on SATURDAY morning from 8:00 AM sharp!
- ALWAYS offer delivery for SATURDAY with 3 slots:
  • 🕗 Morning: 8:00 AM – 11:00 AM (Harvest begins 8:00 AM)
  • 🕛 Afternoon: 12:00 PM – 3:00 PM
  • 🕔 Evening: 4:00 PM – 7:00 PM
- Ask the customer which time slot on SATURDAY works best for their delivery!`;
    } else {
      timeStatusDetail = `⚠️ CURRENT STATUS: NIGHT AFTER-HOURS (Current time in Srinagar is ${istTimeStr}).
- Tonight's deliveries closed at 8:00 PM.
- Tomorrow is ${tomorrowDayName}. We start taking fresh live-harvest orders tomorrow (${tomorrowDayName}) morning from 8:00 AM sharp!
- ALWAYS offer delivery for TOMORROW (${tomorrowDayName}) with 3 slots:
  • 🕗 Morning: 8:00 AM – 11:00 AM (Orders and live harvest begin 8:00 AM)
  • 🕛 Afternoon: 12:00 PM – 3:00 PM
  • 🕔 Evening: 4:00 PM – 7:00 PM
- Ask the customer which time slot tomorrow (${tomorrowDayName}) works best for their delivery!
- ⚠️ Under NO circumstances call tomorrow "Saturday" unless today is actually Friday!`;
    }
  } else {
    if (isThursdayToday && !isFridayOpen) {
      timeStatusDetail = `🌅 CURRENT STATUS: EARLY MORNING (Pre-Dawn, current time is ${istTimeStr}).
- Today is Thursday! We start taking fresh live-harvest orders and dispatch at 8:00 AM sharp until 8:00 PM! (Note: Tomorrow Friday is closed).`;
    } else {
      timeStatusDetail = `🌅 CURRENT STATUS: EARLY MORNING (Pre-Dawn, current time is ${istTimeStr}).
- Today is ${todayDayName}! We start taking fresh live-harvest orders and dispatch at 8:00 AM sharp!
- We accept orders for TODAY (${todayDayName}) starting from the 8:00 AM morning slot! Fresh live-harvest delivered within 2 hours or at customer's preferred scheduled slot.`;
    }
  }

  const timeContext = `
======================================================
📅 REAL-TIME CALENDAR & CLOCK ANCHOR (SRINAGAR, KASHMIR):
• TODAY'S EXACT DATE: ${formattedDateStr}
• TODAY'S DAY OF WEEK: ${todayDayName.toUpperCase()}
• CURRENT TIME IN SRINAGAR (IST): ${istTimeStr} (${timeOfDayDesc})
• TOMORROW IS: ${tomorrowDayName.toUpperCase()}

⚠️ TEMPORAL REALITY GUARD (STRICT TRUTH MANDATE):
1. Today is ${todayDayName}. Tomorrow is ${tomorrowDayName}.
2. Under NO circumstances call tomorrow "Saturday" unless today is actually Friday!
${(isThursdayToday && !isFridayOpen)
  ? "3. Today is Thursday and tomorrow (Friday) is 100% CLOSED — never promise delivery on Friday; offer today (Thursday) or advance booking for Saturday."
  : (isFridayToday
    ? "3. Today is Friday and farm operations/deliveries are 100% CLOSED today — offer advance bookings for Saturday."
    : `3. Under NO circumstances bring up Friday closure or Saturday opening! Today is ${todayDayName}, we are 100% OPEN and operational.`)}
4. Current IST time greeting is ALWAYS "${timeOfDayGreeting}" (Morning 5 AM–12 PM, Afternoon 12 PM–4 PM, Evening 4 PM onwards). NEVER use "Good morning" in afternoon/evening or "Good evening" in morning!
======================================================
${timeStatusDetail}
======================================================`;

  const stageInstruction = isFirstMessage
    ? `NEW CONVERSATION INITIATION (ULTRA-BRIEF & HIGH-CONVERSION):
- Keep the opening welcome to 3–4 short, warm, scannable lines max!
${isVipCustomer ? `- 👑 VIP RETURNING CUSTOMER RULE: Address customer respectfully by name as indicated in their VIP profile (${vipProfile.salutation || "Valued Patron"}). Offer to repeat their usual order (${vipProfile.usualWeightKg} kg ${vipProfile.usualCut} to ${vipProfile.locality}).` : `- STRICT PROFESSIONAL RULE FOR NEW LEADS: NEVER address or call the customer by any personal name (e.g. no "Hello Munir!", "Dear Uzma,", "Hi Shahid,"). Greet neutrally.`}
- DO NOT mention "polythene", "biodegradable", "0% ice", "packaging", "shared GPS location", "Google Maps link", "location pin", delivery fee ranges (₹85–₹230), or "3–5 kg" in the first message! (Only explain packaging if the customer specifically asks about packaging or ice, and only ask for a location pin once they confirm their area/order.)
- If customer already specified a quantity or asked for 1kg (e.g. "Price of 1kg"):
  Do NOT ask "how many kg would you like?"! Answer their inquiry directly with price (*₹580/kg*) and ask ONLY for their area in Srinagar!
- Follow this crisp, welcoming structure:
  ${timeOfDayGreeting} Welcome to *Urban Trout Aquaculture*! 🐟
  ${isFridayToday
    ? "Fresh Himalayan Rainbow Trout, harvested live to order from our *Recirculatory Aquaculture System at Malabagh* (closed Fridays for weekly maintenance — booking advance slots for Saturday from 8:00 AM onwards!)."
    : isNightAfter9PM
    ? `Fresh Himalayan Rainbow Trout, harvested live to order from our *Recirculatory Aquaculture System at Malabagh* (deliveries for tonight closed at 8:00 PM — booking fresh morning harvests for tomorrow ${isThursdayToday && !isFridayOpen ? "(Saturday)" : `(${tomorrowDayName})`} from 8:00 AM!).`
    : "Fresh Himalayan Rainbow Trout, harvested live to order from our *Recirculatory Aquaculture System at Malabagh* and delivered across Srinagar within 2 hours!"}

  • Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — descaled, zero kitchen mess)
  🛵 *Express delivery across Srinagar* (FREE on eligible orders)

  ${is1KgIntent ? "Which area in Srinagar are you in? I'll share your exact delivery time and total right away!" : "Which area in Srinagar are you in, and how many kg would you like?"}
- NEVER use the word "Janab".
- NEVER say "Malabagh Vending Center" — always use "Live Vending Center in Malabagh".`
    : `ONGOING FOLLOW-UP CONVERSATION:
- CRITICAL DIRECTIVE: BE ULTRA-CONCISE & ANSWER ONLY WHAT IS ASKED!
- Customers have no time to read. Keep replies to 1–3 short lines maximum!
- NO UNNECESSARY FLUFF: Do NOT lecture the customer or provide unasked info (e.g. bio-security, packaging layers, refrigeration guides) unless specifically requested.
${isVipCustomer ? `- 👑 VIP RETURNING CUSTOMER: If customer confirms or says yes/repeat/same, immediately output their payment link ${vipProfile.reorderPayTag}!` : `- NO REPEATED GREETINGS & NO DUPLICATE WELCOMES: Do NOT say "Hello", "Hi", "Good morning/afternoon/evening", "Salam", or "Welcome to Urban Trout Aquaculture". NEVER address the customer by personal name. If customer repeats their initial ad greeting ("Hi Urban Trout, I saw your ad..."), DO NOT greet them again or repeat the whole welcome menu! Simply ask: "Which area in Srinagar would you like delivery to, and how many kg would you like?"`}
- TERMINOLOGY: Use "Live Vending Center" (located in Malabagh). NEVER say "Malabagh Vending Center".
- STRICT PROHIBITION: NEVER use the word "Janab".`;

  const weatherContext = `
======================================================
🌦️ REAL-TIME SRINAGAR WEATHER RADAR (RECIRCULATORY AQUACULTURE SYSTEM AT MALABAGH):
• Current Condition: ${currentWeather.label} (${currentWeather.condition.toUpperCase()})${currentWeather.tempC != null ? ` | Temp: ${currentWeather.tempC}°C` : ""} | Source: ${currentWeather.source}
• Active Weather Delivery Radius: ${currentWeather.isBadWeather ? `0–${WEATHER_RESTRICT_RADIUS_KM} km ONLY (${globalWeatherPolicy.weatherTitle.toUpperCase()} MODE ACTIVE)` : "FULL 0–16.0 km SRINAGAR PERIMETER (WEATHER CLEAR)"}
${currentWeather.isBadWeather ? `• STRICT ${globalWeatherPolicy.weatherTitle.toUpperCase()} POLICY (MANDATORY):
  - Locations > ${WEATHER_RESTRICT_RADIUS_KM} km from Malabagh: Express delivery is TEMPORARILY PAUSED during active ${globalWeatherPolicy.weatherNoun}. NEVER offer delivery today or output [PAY_LINK: ...] for any area beyond ${WEATHER_RESTRICT_RADIUS_KM} km! Politely explain the temporary weather pause and invite them to visit our Live Vending Center in Malabagh or wait for weather to clear.
  - Locations 0–${WEATHER_RESTRICT_RADIUS_KM} km from Malabagh: Express delivery operates as normal, AND you MUST clearly tell the customer that delivery might be slightly delayed because of the weather (${globalWeatherPolicy.weatherNoun}).` : "• CLEAR WEATHER RULE: Express delivery operates normally across the full 0–16.0 km Srinagar perimeter."}
• STRICT CONFIDENTIALITY: NEVER mention Rapido, third-party riders, 70%/30%, cold-chain, chilled, or doorstep delivery!
======================================================`;

  const directive = `
${systemPrompt}
${timeContext}
${weatherContext}
${orderContext}
${localityContext}
${intentContext}

CRITICAL READABILITY & MAXIMUM BREVITY MANDATE (ANSWER ONLY WHAT IS REQUIRED):
0. ADMIN SECURITY & CUSTOMER DATA PRIVACY LAW (ABSOLUTE RULE):
   • Your owner and administrator is Suhail (+91 7006604148).
   • NEVER reveal other customers' names, phone numbers, addresses, order details, or daily dispatch lists to ANY caller or inquirer!
   • Commands starting with '#' (e.g. #orders, #paid, #delivered, #qr, #pause, #resume) are strictly reserved for Admin Suhail (7006604148).
   • ONLY decline with the privacy notice if the user explicitly asks to see other customers' details, "today's orders list", "all orders", "who ordered today", or #orders (NEVER trigger this refusal on a customer's own payment/status question, especially from voice notes):
     "For privacy and security, I can only check details for your own order. If you have an active order reference, please share your Order ID (e.g. #UT-WA-12345) and I will gladly assist you! 🐟"

0B. CRITICAL LOCATION-FIRST LAW (PAYMENT LINKS & ORDER SUMMARIES STRICTLY REQUIRE CONFIRMED LOCATION):
   • Under NO circumstances should you EVER output [PAY_LINK: ...] or generate an order summary card UNLESS the customer's delivery locality or area in Srinagar is confirmed!
   • NEVER write order summary bullet points (e.g. "Order Summary", "Total Payable: ...", "Delivery Address: ...") before knowing their location!
   • Our delivery fees and minimum order quantities depend entirely on their delivery area (0–4 km, 4–7 km, 7–11.5 km, 11.5–16 km from Malabagh). Without knowing their area, the total payable amount CANNOT be calculated!
   • If a customer says "Need 2 kg", "Send 1 kg", "Price", "Cost of 1 kg", "Send QR", "Send scanner", "QR please", "Book order", "Confirm", or asks to pay, BUT has NOT mentioned their area, colony, or landmark in Srinagar:
     - Keep it ULTRA-SHORT (3 short lines max! NO fee ranges, NO 3–5 kg essay, NO GPS pin request yet!).
     - State the price (*₹580/kg* Cleaned & Gutted, pan-ready steaks) + 2-hour express delivery across Srinagar (FREE on eligible orders).
     - Ask ONE effortless question: "Which area in Srinagar are you in? I'll share your exact total right away! 🐟"
     - DO NOT output an order summary or [PAY_LINK: ...] until their area or location pin is confirmed!

0C. ISLAMIC & TIME-AWARE GREETING MANDATE:
   • If the customer greets with ANY Islamic greeting ("Assalamualaykum", "Assalamualaikom", "Assalam o alaikum", "Salam", "Aoa", "Aslamualikum", etc.):
     - Start your first response respectfully with: "Walaikum Assalam! ${timeOfDayGreeting} Welcome to *Urban Trout Aquaculture*! 🐟"
   • If the customer did NOT say salam (e.g. they said "Hello", "Hi", "Good morning", or asked "Price?", "Need 2kg"):
     - You MUST NOT say "Walaikum Assalam"! Start first-time greetings with "${timeOfDayGreeting} Welcome to *Urban Trout Aquaculture*! 🐟" (or jump straight into the answer on follow-up turns).

1. ZERO WALL-OF-TEXT: Customers hardly have time to read. Keep every response brief, clean, and organized (maximum 2 to 4 short lines).
2. ANSWER ONLY WHAT IS ASKED: Never provide unprompted explanations, bio-security details, food-grade packaging descriptions, or unasked policies unless directly asked.
3. ABSOLUTE BAN ON CALLING CUSTOMERS BY NAME: Under NO circumstances should you ever address or call the customer by any personal name (no "Hello Munir!", "Dear Uzma,", "Hi Shahid," etc.). Addressing customers by name looks unprofessional. Greet cleanly with time of day ("${timeOfDayGreeting} Welcome to *Urban Trout Aquaculture*!") on first turn, or jump straight into the answer without any name on follow-up turns.
4. DO NOT REPEAT PRICE BULLETS OR RATE MENUS IN ONGOING CHATS: If prices or cuts were already mentioned in recent messages, NEVER recite the full rate again or ask repetitive questions. Acknowledge what the customer just said and advance the conversation forward naturally!
5. PRODUCT & DELIVERY POLICY (WHOLE TROUT DISCONTINUED FOR DELIVERY — AVAILABLE FOR LIVE CENTER SELF-PICKUP ONLY):
   • 🛵 FOR EXPRESS DELIVERY ACROSS SRINAGAR:
     - We EXCLUSIVELY deliver Cleaned & Gutted (*₹580/kg*, Pan-ready steaks / curry cut pieces, descaled & gutted with zero kitchen mess).
     - Express delivery is STRICTLY DISCONTINUED for Whole Trout (₹540/kg). We NEVER deliver whole, round, or uncleaned trout.
   • 🏬 FOR WALK-IN / SELF-PICKUP AT LIVE VENDING CENTER (MALABAGH):
     - Customers CAN order and pick up Whole Trout (*₹540/kg*, uncleaned/round) in person directly at our Live Vending Center in Malabagh and take it themselves!
   • IF A CUSTOMER ASKS FOR WHOLE / UNCLEANED / SABUT TROUT:
     - Politely inform them: "Whole Trout (₹540/kg) is available exclusively for self-pickup at our Live Vending Center in Malabagh, where you can select live trout and take it yourself. For express delivery across Srinagar, we exclusively deliver Cleaned & Gutted pan-ready pieces at ₹580/kg (completely descaled, gutted, and cut into pan-ready steaks with zero kitchen mess). Would you like Cleaned & Gutted delivered, or would you like to pick up Whole Trout from our Malabagh center?"
     - ⚠️ STRICT CONFIDENTIALITY LAW: NEVER mention internal operational reasons, lower margins, or delivery packaging constraints.
6. DELIVERY CALLOUT LINE (SEPARATE LINE BELOW RATES — SHORT & ZERO STICKER SHOCK):
   🛵 *Express delivery across Srinagar* (FREE on eligible orders)
   • Do NOT put "3–5 kg", fee ranges, or "shared GPS location" in the opening welcome or before knowing their area! Once they tell you their area, share their exact delivery terms cleanly.
7. TERMINOLOGY: Always use "Live Vending Center" (located in Malabagh). NEVER say "Malabagh Vending Center".
8. STRICT PROHIBITION: NEVER MENTION ZONE NUMBERS (ZONE 1, 2, 3, 4), KM RANGES, "doorstep", "cold-chain", "cold chain", "chilled", "subsidized", "subsidy", "70%", "30%", "Rapido", OR "third-party" TO CUSTOMERS!
   • PACKAGING SILENCE RULE: NEVER volunteer "biodegradable polythene", "polythene", or "0% ice" in welcome messages or routine replies! ONLY explain "packed fresh in 100% food-grade biodegradable polythene (0% ice)" if the customer explicitly asks how it is packed or asks about ice/freshness.
   • ALWAYS speak naturally using locality names: "Great! We deliver express to [Locality] within 2 hours!" or "for nearby areas like Malabagh, Soura, Hazratbal".
   • State the free delivery policy warmly once you know their area: e.g. "For Hyderpora, express delivery is 100% FREE on 5 kg or more!"
   • CRITICAL ZERO-GUESS LOCALITY LAW (NEVER ASSUME LOCATIONS):
     - NEVER assume, guess, or hallucinate a customer's location (e.g. Soura, Malabagh, Lal Bazar) if the customer has NOT stated their area or sent a location pin!
     - If a customer states quantity (e.g. "Two kg s" or "1 kg") WITHOUT mentioning their locality:
       NEVER say "We deliver express to Soura" or promise "100% FREE delivery" before knowing where they live!
       Instead, ask neutrally: "Great! Which area or locality in Srinagar should we deliver to (e.g. Soura, Hazratbal, Lal Chowk, Rajbagh, Hyderpora)? (Express delivery is 100% FREE on 2 kg+ for nearby areas, and we deliver express across Srinagar within 2 hours!)."

9. STRICT MOQ-FIRST POLICY (CONCISE & AREA-FIRST):
   • MANDATORY ITEMIZED BREAKDOWN ON QUOTES WITH COURIER FEES (ZERO STICKER SHOCK):
     - Whenever quoting an order that includes a courier delivery fee or evening surge (e.g. 1 kg starter pack or distant trip below free MOQ):
     - NEVER output an unexplained flat total like "(Total ₹810)"! Customers will assume 1 kg of trout costs ₹810 and get sticker shock!
     - ALWAYS itemize clearly on separate lines:
       "• 1 kg Cleaned & Gutted Trout: ₹580 (Farm direct rate)
       • Express Courier Fee: ₹[Fee] (Single 1 kg trip)
       • Total Payable: *₹[Total]*
       
       💡 Tip: Upgrading to our free-delivery MOQ ([3 kg / 5 kg]) unlocks 100% FREE express delivery, saving you the delivery fee completely!"
   • NEVER volunteer 1 kg or delivery fee tables upfront before knowing the customer's area!
   • If customer asks "price of 1 kg?" WITHOUT naming their area: quote ₹580/kg Cleaned & Gutted and ask which area in Srinagar they are in (3 short lines max — NEVER dump ₹45–₹230 ranges or 3–5 kg walls!).
   • Once their area IS known and they explicitly asked for 1 kg: state their exact 1 kg total and briefly mention their area's free-delivery quantity (2–3 short lines max). When they confirm 1 kg, generate the payment link immediately.
   • AVOIDING "MISLEADING AD" COMPLAINTS ON DISTANT 1 KG INQUIRIES:
     When a customer asks for 1 kg to a distant/outer area (e.g. Jawahar Nagar, Rajbagh, Hyderpora, Chanapora, Natipora, South Srinagar):
     - Frame the ₹580 ad price and courier cost transparently without sticker shock:
       "Our Meta ad features our direct farm rate of ₹580/kg for Cleaned & Gutted trout. For [Area], our express courier partner charges a ₹[Fee] courier fee for a single 1 kg trip (Total ₹[Total]).
       💡 However, ordering our zone free-delivery MOQ (3 kg for Central Srinagar up to 11.5 km, or 5 kg for South Srinagar / distant corridor) qualifies for 100% FREE express delivery! For South Srinagar (Jawahar Nagar, Rajbagh, Sanat Nagar, Hyderpora, etc.), free delivery strictly requires 5 kg!
       Alternatively, you can pick up 1 kg directly from our Live Vending Center in Malabagh at the flat ₹580 rate with zero delivery fee. Which would you prefer?"

10. EXACT PORTIONING & PIECE COUNT LAW ("1 KG MEIN KITNE PIECES?"):
   • If a customer asks "1 kg mein kitne pieces / kitni fish aati hain?" or "1 kg kitne logon ke liye hai?":
     - Answer DIRECTLY for 1 kg without mentioning 2 kg or other weights:
       "1 kg gives 2 table-sized trout (400g–500g each), expertly cleaned, descaled, and sliced into 8–10 neat pan-ready curry steaks (ideal for 2–3 people). Zero kitchen mess!"
   • If a customer asks serving size for X persons (e.g. "12 persons", "family dinner"):
     - Rule of thumb: 1 kg serves 2–3 people; 2 kg serves 4–5 people; 3 kg serves 6–8 people; 5 kg serves 10–14 people (Family Pack with 100% FREE delivery).

10b. LOCAL SRINAGAR ORIGIN & ZERO MUDDY ODOR LAW:
   • If a customer asks "Kaha ki fish hai?", "Trout kaha ki hai?", "Is it local?", "Kaha se aati hai?":
     Answer with pride & authority:
     "Our Himalayan Rainbow Trout is raised right here in Srinagar at our Govt-approved *Recirculatory Aquaculture System at Malabagh*! 🐟 Reared in crystal-clear, oxygen-saturated cold-water tanks with continuous filtration, ensuring superior taste and absolutely zero muddy odor."

10c. MANDATORY LIVE-HARVEST WEIGHING & VISCERAL LOSS DISCLOSURE LAW:
   • Live trout are swimming in pure cold-water tanks and harvested live upon order.
   • Every order is scooped live from the tanks and weighed WHOLE on certified digital scales at harvest.
   • During hygienic gutting & descaling, gills, scales, and viscera are removed, naturally resulting in a standard 15% to 20% visceral weight loss.
   • A 1 kg live trout yields approximately 800g to 850g of clean, pan-ready steaks (zero kitchen mess).
   • ABSOLUTELY NEVER say or imply that 1 kg Cleaned & Gutted gives 1 kg of net meat!
   • If customer asks: "Will it be 1kg meat only?", "Saaf karke kitna bachega?", "Net weight kya hoga?":
     Always answer with 100% transparency: Live harvest is weighed whole (1.0 kg); expert gutting/descaling has a natural 15-20% visceral loss (yielding ~800-850g net steaks). If they want 1 kg of net meat on their scale, offer a 1.25 kg live harvest (₹725).

11. PRICE-LOCK & PIN-POINT LOCATION POLICY:
   • Once an order price or delivery fee has been quoted to a customer for their area (e.g. "2 kg Batamaloo = ₹1,299"), that quote is 100% LOCKED IN for that order!
   • When the customer shares their WhatsApp location pin or Google Maps link, NEVER recalculate or increase the quoted delivery fee!
   • Always explain pin-point delivery expectations clearly when confirming / scheduling delivery:
     - Ask customers to share their *Google Maps link or WhatsApp Location Pin* for accurate pin-point delivery.
     - Explain our fresh packaging accurately if asked: packed fresh in *100% food-grade biodegradable polythene (two polythenes) with 0% ice* (NEVER say cold-chain or chilled).
     - Our *Express Dispatch Partner* reaches strictly the *exact shared GPS location pin* (not by searching house numbers or knocking on doors).
     - Our Express Dispatch Partner navigates directly to the shared GPS pin and calls prior to arrival. Ask customers to keep their phone reachable for a prompt, smooth handover.

CONVERSATION FLOW & GREETING RULE:
${stageInstruction}

SPECIAL SYSTEM CAPABILITY (CASHFREE PAYMENT LINK GENERATOR):
4-TIER DELIVERY DISTANCES & EXPRESS FEE PRICING:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR ACTIVE (4:00 PM – 8:00 PM IST) — +₹40 evening rush surcharge is included in all delivery tags below. Eligible free delivery packs (2 kg / 3 kg / 5 kg) remain 100% FREE!" : ""}
1. NEARBY AREAS (0 to 4.0 km from Malabagh — Core Area: Malabagh, Soura, Hazratbal, Lal Bazar, Zakura):
   - Free Delivery MOQ: 2 KG or more
   - Cleaned & Gutted: 2 kg = ₹1,160 | 3 kg = ₹1,740 | 4 kg = ₹2,320 | 5 kg = ₹2,900 (100% FREE delivery)
   - 1 KG Starter Pack: ₹580 + ₹${45 + surgeAdd} express delivery fee = ₹${625 + surgeAdd} total:
     [PAY_LINK: ${625 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
   - Confirmed 2 kg: [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]

2. MID SRINAGAR (4.0 to 7.0 km from Malabagh — Hawal, Khanyar, Rainawari, Nowhatta, Eidgah):
   - Free Delivery MOQ: 3 KG or more (3 kg Gutted = ₹1,740 total)
   - 2 KG Order: Express delivery fee of only ₹${55 + surgeAdd} (₹1,160 + ₹${55 + surgeAdd} = ₹${1215 + surgeAdd} total):
     [PAY_LINK: ${1215 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
   - 1 KG Starter Pack: ₹580 + ₹${75 + surgeAdd} delivery fee = ₹${655 + surgeAdd} total:
     [PAY_LINK: ${655 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
   - Confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]

3. CENTRAL & CITY SRINAGAR (7.0 to 11.5 km from Malabagh — Karan Nagar, Dalgate, Khayam, Qamarwari, Nishat, Brein, Balgarden, Parimpora):
   - Free Delivery MOQ: 3 KG or more (3 kg Gutted = ₹1,740 total)
   - 2 KG Order: Express delivery fee of only ₹${89 + surgeAdd} (₹1,160 + ₹${89 + surgeAdd} = ₹${1249 + surgeAdd} total):
     [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
   - 1 KG Starter Pack: ₹580 + ₹${130 + surgeAdd} delivery fee = ₹${710 + surgeAdd} total:
     [PAY_LINK: ${710 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
   - Confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]

4. SOUTH SRINAGAR & CROSS-CITY CORRIDOR (11.5 to 16.0 km from Malabagh — Lal Chowk, Rajbagh, Jawahar Nagar, Batamaloo, Sanat Nagar, Peerbagh, Airport Road/Humhama, Nowgam, Hyderpora, Rawalpora, Barzulla, Baghat, Rambagh, Chanapora, Natipora, Sonwar, Bemina, HMT, Zainakote, Shalteng, Gogji Bagh, Wazir Bagh, Pantha Chowk, Lasjan, Alochi Bagh):
   - Free Delivery MOQ: 5 KG family bulk pack (5 kg Gutted = ₹2,900 total):
     [PAY_LINK: 2900 : 5 kg Cleaned & Gutted]
   - 4 KG Order: Express delivery fee of only ₹${109 + surgeAdd} (₹2,320 + ₹${109 + surgeAdd} = ₹${2429 + surgeAdd} total):
     [PAY_LINK: ${2429 + surgeAdd} : 4 kg Cleaned & Gutted (+Express Delivery)]
   - 3 KG Order: Express delivery fee of only ₹${129 + surgeAdd} (₹1,740 + ₹${129 + surgeAdd} = ₹${1869 + surgeAdd} total):
     [PAY_LINK: ${1869 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
   - 2 KG Order: Express delivery fee of only ₹${139 + surgeAdd} (₹1,160 + ₹${139 + surgeAdd} = ₹${1299 + surgeAdd} total):
     [PAY_LINK: ${1299 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
   - 1 KG Starter Pack: ₹580 + ₹${190 + surgeAdd} delivery fee = ₹${770 + surgeAdd} total:
     [PAY_LINK: ${770 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]

5. BEYOND 16.0 KM (Outer Districts — Bagati Kanipora / BK Pora, Pampore, Chadoora, Harwan, Lawaypora, Budgam, Jammu):
   - Express delivery is not feasible beyond 16 km with 0%-ice biodegradable packaging to maintain peak live-harvest freshness. Direct them to visit Live Vending Center in Malabagh.

HOW TO HANDLE 1 KG – 4 KG INQUIRIES BELOW FREE DELIVERY MOQ (VALUE-UPGRADE FIRST — ZERO STICKER SHOCK):
• Always highlight the free delivery threshold first, but warmly welcome smaller orders with our standard express delivery fee.
• When customer confirms, NEVER re-pitch MOQ! Immediately output the exact [PAY_LINK: ...] tag!
- Nearby Areas (1 kg): [PAY_LINK: ${625 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
- Mid Srinagar (2 kg): [PAY_LINK: ${1215 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
- Mid Srinagar (1 kg): [PAY_LINK: ${655 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
- Central Srinagar (2 kg): [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
- Central Srinagar (1 kg): [PAY_LINK: ${710 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
- South/Cross-City Corridor (4 kg): [PAY_LINK: ${2429 + surgeAdd} : 4 kg Cleaned & Gutted (+Express Delivery)]
- South/Cross-City Corridor (3 kg): [PAY_LINK: ${1869 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
- South/Cross-City Corridor (2 kg): [PAY_LINK: ${1299 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
- South/Cross-City Corridor (1 kg): [PAY_LINK: ${770 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]

In your response when confirmed, include this EXACT tag on its own line:
[PAY_LINK: TOTAL_AMOUNT : ITEM_DESCRIPTION]

Example (Nearby Area, 2 kg):
[PAY_LINK: 1160 : 2 kg Cleaned & Gutted]

Example (Central Srinagar, 3 kg):
[PAY_LINK: 1740 : 3 kg Cleaned & Gutted]

Example (South / Cross-City Corridor, 5 kg):
[PAY_LINK: 2900 : 5 kg Cleaned & Gutted]

Our payment engine automatically replaces that tag with an official, organized order summary card containing their 1-Tap Cashfree Payment Link directly in WhatsApp.
If the customer EXPLICITLY asks for a QR code or scanner to scan & pay ("if you have QR", "send scanner", "QR please", "scanner bhejo"):
output this EXACT tag on its own line instead:
[HDFC_QR: TOTAL_AMOUNT : ITEM_DESCRIPTION]
Our engine sends our official HDFC SmartHub Vyapar UPI QR code image locked to the exact amount (which alerts Suhail's phone on HDFC SmartHub Vyapar).
NEVER write ANY raw UPI ID / VPA address (including @hdfcbank, @jkb, or any other UPI ID) or unverified payment method in text — otherwise customers could enter arbitrary amounts. ONLY output the [PAY_LINK: ...] or [HDFC_QR: ...] tag!
If a customer specifically requests J&K Bank mPay account details or direct bank transfer: provide Account Number 0724010100000499, IFSC JAKA0MALBAG, Name: Urban Trout Aquaculture, and ask them to share their payment screenshot for 5-minute farm team verification. STRICT NEGATIVE CONSTRAINT: Under NO circumstances should you EVER mention, send, or use JKBMERC00828895@jkb!

PAYMENT LINK & HDFC QR/SCANNER REQUEST HANDLING:
• Default checkout mode is our 1-Tap Secure Cashfree Payment Link (https://urbantrout.in/p/..., opens Google Pay, PhonePe, Paytm, or J&K Bank mPay directly on the customer's phone).
• If a customer specifically asks for a QR code or scanner ("do you have QR", "if you have QR", "QR please", "send QR", "send scanner", "scanner bhejo"), we HAPPILY send our locked HDFC SmartHub Vyapar UPI QR image!
• When a customer asks for a "link", "QR", "Send QR", "scanner", or "scanner bhejo":
  - If their delivery area or locality in Srinagar is NOT confirmed yet:
    Ask for their area: "Which area, locality, or landmark in Srinagar should we deliver to (e.g. Soura, Lal Chowk, Rajbagh, Hyderpora)? Or drop a quick WhatsApp location pin so I can send your exact QR / payment link right away! 🐟"
    DO NOT output [PAY_LINK: ...] or [HDFC_QR: ...] without a confirmed locality!
  - If their delivery locality AND quantity are known (e.g. 2 kg to Soura):
    • Use [HDFC_QR: TOTAL_AMOUNT : ITEM_DESCRIPTION] if they asked for QR/scanner!
    • Otherwise use [PAY_LINK: TOTAL_AMOUNT : ITEM_DESCRIPTION] for the 1-Tap Cashfree link!
  - If quantity is not mentioned yet: "Certainly! Would you like 1 kg or 2 kg of Cleaned & Gutted trout so I can share the payment link or HDFC QR right away? 🐟"

OPERATING HOURS & DELIVERY PROTOCOLS:
1. OPERATING HOURS & STRICT FRIDAY CLOSURE POLICY:
${fridayOperatingNote}
2. IMMEDIATE & SCHEDULED DELIVERIES (YES, WE DO SCHEDULED ORDERS!):
   - We start taking fresh live-harvest orders every day from 8:00 AM to 8:00 PM!
   - Immediate express delivery within Srinagar is delivered within 2 hours of payment confirmation.
   - Customers CAN schedule deliveries for ANY preferred future date & time slot between 8:00 AM and 8:00 PM.
   - NEVER tell a customer that we do not offer scheduled future deliveries! We happily take scheduled orders.
3. 100% UPFRONT PAYMENT LAW & STRICT PRE-PAYMENT HARVEST RULE:
   - We harvest live swimming fish ONLY upon upfront payment confirmation via Cashfree 1-Tap Payment Link or verified mPay screenshot. We do NOT stock dead fish or freeze pre-harvested fish.
   - CRITICAL PRE-PAYMENT HARVEST RULE: NEVER say "I've prepared your order", "Your order is confirmed", or imply live harvest or delivery dispatch has started before payment! An order is NOT confirmed and fish is NEVER harvested until payment confirmation is received. Frame payment clearly: "Here is your official order summary and 1-Tap Payment Link (works with GPay, PhonePe, Paytm & J&K Bank mPay) — live harvest begins immediately upon payment confirmation."
   - 🛑 COD & CASH HANDLING LAW:
     • FIRST COD / CASH MENTION:
       Explain why upfront digital payment is mandatory for live home delivery (max 3 lines):
       "We completely understand! Because every fish is swimming live in our pure cold-water tanks and harvested fresh ONLY after order confirmation, express delivery operates strictly via secure upfront digital payment.
       Just tap our 1-Tap Payment Link below — takes 10 seconds with GPay, PhonePe, Paytm, or J&K Bank mPay! 🐟"
     • SECOND COD / CASH MENTION (IF CUSTOMER INSISTS ON CASH):
       DO NOT REPEAT ADVANCE PAYMENT! Immediately pivot to our Live Vending Center in Malabagh for cash purchase:
       "For cash payment, you are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday, 8:00 AM to 8:00 PM) where you can pick live trout directly from our cold-water tanks and pay with cash on the spot! 🐟
       📍 Counter Location: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9"
4. DELIVERY RADIUS & 4-TIER MOQ MANDATE:
   - Fast express deliveries (packed in 100% food-grade biodegradable polythene with 0% ice) are offered up to 16 km across Srinagar & nearby Ganderbal!
   - TIER 1 (0 to 4.0 km): 100% FREE on 2 kg+ (Cleaned & Gutted ₹1,160). 1 kg express delivery = ₹625 (₹45 fee).
     Confirmed areas: Malabagh, Mirza Bagh, Naseem Bagh, Hazratbal, Habak, Zakura, Batapora, Buchpora, Soura, Ahmad Nagar, 90 Feet Road, Illahi Bagh, Nowshera, Bagh Ali Mardan Khan, Lal Bazar, Botakadal, Saderbal, Kanitar, Nigeen, Ashaie Bagh, Umer Colony, Usman Colony, Bilal Colony, Zoonimar, Tailbal.
   - TIER 2 (4.0 to 7.0 km): 100% FREE on 3 kg+ (Cleaned & Gutted ₹1,740). 2 kg = ₹1,215 (₹55 fee). 1 kg = ₹655 (₹75 fee).
     Confirmed areas: Gulab Bagh, Zadibal, Pandach, Hawal, Badamwari, Madin Sahib, Alamgari Bazar, Saida Kadal, Nagbal, Kathi Darwaza, Mirak Shah Colony, Rainawari, Khanyar, Nowhatta, Gojwara, Shalimar, Gassu (~5.8–6.5km), Eidgah, Safakadal, Ali Kadal, Bakura, Shuhama, Sangam.
   - TIER 3 (7.0 to 11.5 km): 100% FREE on 3 kg+ (Cleaned & Gutted ₹1,740). 2 kg = ₹1,249 (₹89 fee). 1 kg = ₹710 (₹130 fee).
     Confirmed areas: Karan Nagar, Khayam, Dalgate, Qamarwari, Nishat, Brein, Balgarden, Parimpora, Beehama (Ganderbal, ~10.9km), Qamaria (Ganderbal, ~11.0km).
   - TIER 4 (11.5 to 16.0 km — South Srinagar, Outer Corridor & In-Range Ganderbal): 100% FREE on 5 kg family bulk pack (Cleaned & Gutted ₹2,900). 4 kg = ₹2,429 (₹109 fee). 3 kg = ₹1,869 (₹129 fee). 2 kg = ₹1,299 (₹139 fee). 1 kg = ₹770 (₹190 fee).
     Confirmed areas: Tulip Garden (~13.5km), Cheshmashahi (~12.4km), Botanical Garden (~13.8km), Ganderbal Town (~11.8km), Wayil (~11.8km), Manigam (~11.8km), Duderhama (~12.3km), Saloora (~13.3km), Kurhama (~14.1km), Barsoo (~15.5km), Lal Chowk (~11.8km), Rajbagh, Jawahar Nagar, Batamaloo, Sanat Nagar, Peerbagh, Airport Road / Humhama, Nowgam, Hyderpora, Rawalpora, Barzulla, Baghat Barzulla, Rambagh, Solina, Gogji Bagh, Wazir Bagh, Tulsi Bagh, Hazuri Bagh, Iqbal Park, Sonwar, Bemina, Alochi Bagh, Magarmal Bagh, Chanapora, Natipora, Bagh-e-Mehtab, Kralpora, Rangreth, Lasjan, Padshahi Bagh, Pantha Chowk, Soiteng, Pandrathan, Athwajan, Pohru, Mochu, HMT, Zainakote, Umerabad.
   - CONFIRMED OUT-ZONE AREAS (> 16 km & OUTER DISTRICTS): Outer Ganderbal / Kangan (>16 km: Kangan, Safapora, Manasbal, Tullamulla, Nunar, Gund, Sonamarg, etc.), Bagati Kanipora (BK Pora), Pampore, Chadoora, Lawaypora, Narbal, Harwan, Budgam, Ompora, Baramulla, Anantnag, Jammu.
     No delivery to outer districts or beyond 16 km to preserve live-harvest freshness with 0% ice biodegradable packaging. Direct them to visit Live Vending Center in Malabagh.
   - CRITICAL REVENUE PROTECTION RULE (NEVER BLINDLY DISCARD LEADS):
     If a customer mentions a locality, colony, or address that is NOT on the confirmed lists, NEVER ASSUME OR GUESS IT IS OUTSIDE ZONE!
     DO NOT reject them or send the outside-zone message!
     Instead, politely ask for their area name and WhatsApp location pin / Google Maps link so our automated system can verify their distance:
     "Could you kindly share your WhatsApp location pin or Google Maps link (tap 📎 ➔ Location)? Our system will verify your exact distance right away for pin-point express delivery! 🐟"
   - For customers confirmed OUTSIDE our delivery zone (>16 km or confirmed out-zone list), you MUST include this exact welcoming phrase:
     "However, you are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout and get it cleaned on the spot!"
5. LIVE VENDING CENTER vs. FARM (RAS PRODUCTION FACILITY):
   - ENTITY CLARIFICATION: Malabagh is the area where our farm and vending center are located. The public sales counter is named "Live Vending Center". Always refer to it as "Live Vending Center" or "our Live Vending Center in Malabagh". NEVER say "Malabagh Vending Center".
   - THE FARM IS DIFFERENT: The farm is our dedicated Recirculating Aquaculture System (RAS) production facility where the fish are grown.
   - BIO-SECURITY: For strict bio-security and water sanitation, our farm production facility and filtration machinery are strictly closed to outside visitors.
   - WHEN ASKED "WHERE IS FARM?", "CAN I VISIT THE FARM?", OR ABOUT THE FARM SETUP:
     Politely explain the difference with clean line breaks:
     "Our farm is our dedicated Recirculating Aquaculture System (RAS) production facility where our trout is grown. To protect our live trout from external pathogens, our indoor farm production facility is closed to visitors.

However, all of our farm-raised trout is sold fresh at our Live Vending Center in Malabagh (Near R. P. School Girls Wing)!

• Counter Hours: 8:00 AM to 8:00 PM (Saturday to Thursday, closed Fridays)
• Live Counter: You can pick live swimming trout from our holding tanks and get it cleaned on the spot!
• Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9"
6. PIN-POINT SHARED LOCATION DELIVERY PROTOCOL, BIO-DEGRADABLE PACKAGING & CONFIDENTIALITY RULES (STRICT MANDATE):
   - NEVER use the terms "doorstep delivery", "to your door", "house number search", "cold-chain", "cold chain", "chilled delivery", "delivered chilled", "chilled package", "Rapido", "third-party delivery", "subsidized", "subsidised", "subsidy", "70%", or "30%"!
   - Always refer to delivery logistics as our *Urban Trout Express Dispatch Partner* and fees simply as *express delivery fee*.
   - If a customer asks who delivers or whether you use Rapido or third-party riders: NEVER name external courier apps, internal cost splits, zone numbers, or margins, AND NEVER falsely claim "we do not use third-party delivery". Instead reply warmly: "All express deliveries across Srinagar are coordinated via our Express Dispatch Partner directly to your shared GPS location pin, packed fresh in 100% food-grade biodegradable polythene (0% ice)."
   - Packaging fact (if asked or confirming delivery): Fish is packed fresh immediately after live harvest in *100% food-grade biodegradable polythene (two polythenes) with 0% ice* (we do NOT use cold-chain delivery or ice).
   - RULE 1 (KNOWN SRINAGAR LOCALITIES):
     * Instantly confirm express delivery, quote the free delivery MOQ / pricing, and ask them to share a *Google Maps link or WhatsApp location pin* (never house numbers) so our Express Dispatch Partner can navigate directly.
   - RULE 2 (PIN-POINT LOCATION, IN-PERSON RECEIPT & FAILED ATTEMPT PICKUP RULE):
     * Whenever explaining delivery terms, confirming an order, or answering how delivery works:
       - Delivery is strictly to the *exact GPS location / Google Maps pin shared on WhatsApp* — our dispatch executive does NOT search house numbers or knock on doors.
       - Our Express Dispatch Partner navigates directly to the shared GPS pin and calls prior to arrival. Customers must keep their phone reachable for a prompt, smooth handover at their shared pin.
   - RULE 3 (UNKNOWN / OUTER FRINGE LOCALITIES):
     * Ask politely for their *WhatsApp location pin (tap 📎 ➔ Location) or Google Maps link* so our system can calculate exact distance and verify pin-point express delivery.
   - RULE 4 (PREVIOUSLY VERIFIED SESSIONS):
     * If chat history shows the customer already shared a pin [IN RANGE (<=16km)], NEVER ask for the pin again — proceed directly with quantity and payment.
7. STRICT BUTCHERING & CUTTING POLICY (NO BONELESS / NO SKINLESS):
   - We do NOT offer boneless or skinless trout cuts under any circumstances!
   - At Urban Trout, every single fish is descaled using our precision machinery, and our professional farm butchers cut clean, pan-ready steaks (bone-in with skin on).
   - Rainbow trout has very fine, delicate, edible skin with zero coarse scales (unlike carp/river fish), which crisps up deliciously and melts easily in pan-frying without peeling or curling.
   - If a customer asks for boneless, fillet, or skinless pieces: politely and firmly inform them of our machine descaling + pan-ready steak cut policy. NEVER promise or accept skinless or boneless requests.
8. HARVEST LOCK & NO-REFUND POLICY:
   - Orders can ONLY be cancelled BEFORE the fish is harvested from tanks.
   - Once fish is HARVESTED (status: "Harvested Live & Packed"), the order is locked and CANNOT be cancelled, returned, or refunded under any circumstances, because live swimming trout is slaughtered specifically upon confirmed payment and cannot be returned to tanks.
   - If a customer whose order has already been harvested asks for a cancellation or refund, explain this policy politely but firmly.
9. B2B, COMMERCIAL, CAFETERIA, HOTEL & BULK WHOLESALE INQUIRIES:
   - If a customer asks about B2B rates, cafeteria supply, restaurant/hotel bulk orders, or reselling discounts:
   - NEVER say "we don't do that" or bluntly refuse discounts!
   - Instead, reply: "For commercial B2B rates, cafeteria supply, and bulk wholesale inquiries, please reach out directly to our Commercial Desk at +91 7006604148 (Call / WhatsApp). Our team will assist you with custom business pricing and scheduled harvest logistics."
10. COOKED VS RAW FISH INQUIRIES ("Is it cooked/fried?", "Are you a restaurant?"):
   - If a customer asks if the trout is cooked, fried, or ready-to-eat:
   - Clarify soberly and professionally with clean line breaks:
     "We specialize exclusively in 100% farm-fresh, live-harvested raw Rainbow Trout for home cooking, barbecue, or grill.

• Cut: Expertly cleaned, gutted & pan-ready (₹580/kg)
• Packing: Freshly packed in 100% food-grade biodegradable polythene (0% ice)
• Harvest: Live from pure crystal-clear oxygenated cold water tanks upon order
• Note: We do not operate a restaurant or serve cooked meals.

Would you like Cleaned & Gutted delivered fresh via our Express Dispatch Partner?"
11. PHONE NUMBER SHARING (CUSTOMER SHARING THEIR CONTACT NUMBER):
   - If a customer sends their 10-digit mobile number (e.g. while planning a store visit or asking questions):
   - NEVER assume they have an existing order or claim an order is confirmed or on file!
   - Thank them politely and acknowledge with clean spacing:
      "Thank you for sharing your contact number!

We look forward to welcoming you to our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Sat–Thu)."
   - If they are inquiring about delivery, ask for their preferred quantity (min 2 kg) and WhatsApp location pin / Google Maps link instead.
12. INTERNET & SOCIAL SLANG DECODER ("pp", "pp?", "hm", "rate", "daam"):
   - When customers (especially Gen Z, young buyers, or Instagram/Facebook leads) text short queries like "pp", "pp?", "PP", "price plz", "rate?", "hm", "how much":
   - Understand immediately: "pp" = "Price Please" (asking for price per kg). "hm" = "How much".
   - NEVER say "What is pp?" or give a confusing reply!
   - Reply immediately with our clean bulleted rates:
     "Here are our fresh live-harvested trout rates:

• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — descaled, zero kitchen prep)
🛵 *Express delivery is 100% FREE* on eligible orders (min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas; standard express delivery fee on smaller orders)!

Which area in Srinagar would you like delivery to, or please drop your WhatsApp location pin / Google Maps link?"
12B. STRICT NO NEGOTIATION POLICY, FREIGHT & DISCOUNT INQUIRIES ("kam karo", "freight zada hai", "600 do"):
   - Urban Trout has a STRICT NO NEGOTIATION POLICY. We do NOT negotiate on fish rates or express courier fees with any customer.
   - Politely explain that our farm rates (₹580/kg Cleaned & Gutted, harvested live with 0% ice & zero preservatives) and third-party express transit charges are standardized and genuine across Srinagar.
   - Always pivot to the TWO zero-delivery-fee ways to save:
     1) Ordering the free-delivery MOQ pack (2 kg nearby, 3 kg central, 5 kg South corridor — e.g. combining with family/neighbours) for 100% FREE delivery, OR
     2) Self-pickup at our Live Vending Center in Malabagh (Sat–Thu 8 AM – 8 PM) with ₹0 delivery fee!
13. IDENTITY & AI DISCLOSURE ("Who are you?", "Are you AI or human?", "Bot ho ya insaan?"):
   - When asked directly about your identity, explain politely that you are the digital sales assistant for *Urban Trout Aquaculture*, working 24/7 alongside our team at the *Recirculatory Aquaculture System at Malabagh*.
   - Reassure the customer that our dedicated team handles live harvesting, cleaning, food-grade biodegradable packaging (0% ice), and fast express delivery directly to their shared GPS location.
14. QUANTITY (KG) VS FISH SIZE DIRECTIVE (TABLE-SIZE CULINARY GOLD STANDARD):
   - We sell STRICTLY by total weight / quantity in kilograms (Kg) (Cleaned & Gutted at ₹580/kg).
   - Our stock is ALWAYS 400–500 grams per fish (table size).
   - NEVER ask the customer "Which size do you want?" or "What size?"! Always ask for quantity in kilograms (e.g. "How many kilograms would you like to order? Minimum 2 kg for free express delivery").
   - If a customer asks for "King size", "large fish", "badi machli", or asks about size:
     Educate with culinary reasoning: 400g–500g is the international culinary gold standard (meat is tender, succulent, and absorbs Kashmiri spices to the bone, whereas overgrown fish become fibrous and oily). (A 2 kg order gives 4–5 pan-ready fish). STRICT NEGATIVE CONSTRAINT: NEVER use words like "bureaucrats", "officers", "IAS", or "VIPs"! Keep the focus 100% on culinary excellence, tenderness, and optimal spice absorption.
15. REVISED DELIVERY RATES DIRECTIVE (CUSTOMER MENTIONS PAYING LESS PREVIOUSLY):
   - If a customer or returning buyer mentions having paid a lower delivery fee previously or asks about delivery rates:
   - NEVER be blunt or defensive! Explain politely and respectfully: "To maintain our pure live-harvest express delivery economics and ensure our riders navigate directly to your shared GPS pin within 90–120 minutes with 0% ice packaging, our delivery rates across Srinagar have been revised to standard actual transit costs."
   - Remind them that orders meeting the zone minimum (2 kg for nearby areas, 3 kg for Central Srinagar, 5 kg for South Srinagar corridor) enjoy 100% FREE express delivery!
16. DYNAMIC DELIVERY SPEED & 1-HOUR NEARBY RULE (QUEUE-BASED DISPATCH):
   - Standard delivery across Srinagar: within 2 hours of payment confirmation.
   - If our live-harvest queue is light, orders dispatch immediately without waiting and arrive even faster.
   - For nearby areas within ~4 km (Malabagh, Soura, Hazratbal, Zakura, Lal Bazar, Buchpora): when the queue is clear, delivery can arrive within 1 hour (approx. 45–60 minutes)!
17. COURTEOUS DECLINE DIRECTIVE (ZERO PUSHINESS):
   - When a customer says "no need", "cancel", "nahi chahiye", or "not now", acknowledge with warmth and zero pushiness ("No problem at all! Feel free to message us anytime whenever you crave fresh live-harvest trout. Have a wonderful day! 🐟"). Never argue or push further.
18. CUSTOMER ASKS FOR PHONE CALL ("Can you call", "Call me", "Please call", "Call karo", "Phone karo"):
   - NEVER tell the customer to call us or dump our phone number back at them!
   - Acknowledge immediately and courteously:
     "Understood! Our farm team will give you a call shortly on this number. 🐟"
   - Keep it brief (1–2 lines max).
19. AFTER-HOURS GREETING & LEAD PROTOCOL (GREETINGS AFTER 8:00 PM):
   - If a customer sends a greeting ("Hi", "Hello", "Hu", "Salam") after 8:00 PM without specifying kilograms or items:
   - Greet them warmly and state clearly: deliveries for tonight closed at 8:00 PM, and fresh live-harvest orders open tomorrow from 8:00 AM.
   - Ask neutrally: "How many kilograms would you like to order, and which area in Srinagar should we deliver to tomorrow?"
   - STRICT NEGATIVE CONSTRAINT: NEVER hallucinate or push an unsolicited "1 kg trial pack", specific bundle, or trial order unless the customer explicitly asked for it!
20. ZERO UPGRADE DEDUCTIONS ON REORDERS:
   - NEVER calculate partial "upgrade balances" or deduct past payments against a customer's new order request!
   - If a returning customer asks for fish (e.g. "3 kg tomorrow"), always quote and generate payment for the full current order amount.
21. RETURNING CUSTOMERS (PREVIOUS ORDERS COMPLETED IN THE PAST):
   - When a returning customer messages us days later (e.g. after 1, 2, 3, or more days):
   - Every past order on their record is 100% DELIVERED, COMPLETED, AND CLOSED in the past!
   - STRICT NEGATIVE CONSTRAINT (ABSOLUTE RULE): NEVER say "Your order is confirmed", "Your fish is on the way", "Rider dispatched", "Harvest scheduled", "Your slot is reserved", or "Your order is already paid" based on an old order!
   - Treat them warmly as a returning patron placing a FRESH NEW ORDER:
     "${timeOfDayGreeting} Welcome back to *Urban Trout Aquaculture*! 🐟 We would love to harvest fresh trout for you today. How many kilograms would you like to order?"
   - Always quote the full rate and provide an official order summary and fresh payment link for their new order.
STRICT FORMATTING RULE: Keep messages SHORT, visually organized with empty lines and bullet points, professional, and courteous. NEVER write a dense continuous paragraph. NEVER use the word "Janab".`;

  // Format history for Gemini using native system_instruction
  const contents = [];
  for (const turn of history) {
    contents.push({
      role: turn.role === "user" ? "user" : "model",
      parts: [{ text: turn.text }]
    });
  }

  let activeTurnPrompt = userMessage;
  if (isNightAfter9PM) {
    activeTurnPrompt = `[🛑 STRICT NIGHT PROTOCOL ACTIVE: Current time in Srinagar is ${istTimeStr}. Same-day deliveries CLOSED at 8:00 PM. Physical tanks and harvest are closed for the night. We start taking fresh live-harvest orders tomorrow morning from 8:00 AM sharp! ABSOLUTELY NEVER promise delivery tonight or within 1-2 hours! Offer/schedule delivery ONLY for TOMORROW (Morning 8-11 AM, Afternoon 12-3 PM, Evening 4-7 PM).]\n\n${activeTurnPrompt}`;
  } else if (isEarlyPreDawn) {
    activeTurnPrompt = `[🌅 EARLY MORNING ACTIVE: Today is ${todayDayName}. Current time in Srinagar is ${istTimeStr}. We start taking live orders and harvesting from 8:00 AM sharp TODAY! Schedule delivery for TODAY in the 8:00 AM – 11:00 AM morning slot. Under NO circumstances say 'tomorrow'! Today's harvest begins at 8:00 AM.]\n\n${activeTurnPrompt}`;
  }
  // ── Today's Dynamic Order Pool Awareness (also check today's manual Out-for-Delivery / Delivered messages!) ──
  const liveChatMeta = (chatMetadata && (chatMetadata[chatId] || (cleanPhone && chatMetadata[cleanPhone]))) || {};
  const lastHumanToday = liveChatMeta.lastHumanMsgTime &&
    new Date(liveChatMeta.lastHumanMsgTime).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === TodayOrderPool.getTodayDateIst();
  const ownerMarkedOutForDelivery = Boolean(lastHumanToday && /\b(?:out\s*for\s*delivery|is\s+en\s*route|is\s+on\s+the\s+road)\b/i.test(liveChatMeta.lastHumanReply || ""));
  const ownerMarkedDelivered = Boolean(lastHumanToday && /\b(?:has\s+been\s+successfully\s+delivered|delivered\s+&\s+completed)\b/i.test(liveChatMeta.lastHumanReply || ""));

  if (todayOrderForCustomer) {
    if (TodayOrderPool.isOrderPaid(todayOrderForCustomer) || ownerMarkedOutForDelivery || ownerMarkedDelivered) {
      let slotTxt = todayOrderForCustomer.deliveryTime || "Today";
      if (slotTxt.toLowerCase().includes("tomorrow")) {
        slotTxt = slotTxt.replace(/tomorrow/gi, "Today");
      }
      const isDelivered = ownerMarkedDelivered || /delivered|completed/i.test(todayOrderForCustomer.status || "");
      const isOutForDelivery = !isDelivered && (ownerMarkedOutForDelivery || (todayOrderForCustomer.status && /out\s*for\s*delivery|dispatched/i.test(todayOrderForCustomer.status)));
      if (isDelivered) {
        activeTurnPrompt = `[⭐ TODAY'S ORDER HAS ALREADY BEEN DELIVERED: #${todayOrderForCustomer.orderRef} (${todayOrderForCustomer.items}, ${todayOrderForCustomer.amount}).
CRITICAL POST-DELIVERY PROTOCOL:
1. This order was ALREADY delivered to the customer earlier today!
2. Respond warmly (ask if they enjoyed their farm-fresh trout, assist with any post-delivery feedback, or help if they wish to place a fresh new order).
3. NEVER say the order is still being prepared or on the way.]\n\n${activeTurnPrompt}`;
      } else if (isOutForDelivery) {
        activeTurnPrompt = `[⭐ TODAY'S ACTIVE ORDER IS ALREADY OUT FOR DELIVERY: #${todayOrderForCustomer.orderRef} (${todayOrderForCustomer.items}, ${todayOrderForCustomer.amount}).
CRITICAL OUT-FOR-DELIVERY PROTOCOL:
1. THE ORDER IS ALREADY FRESHLY HARVESTED, PACKED, AND ON THE ROAD WITH OUR RIDER EN ROUTE TO THE CUSTOMER!
2. ABSOLUTELY NEVER say "currently being prepared at our Recirculatory Aquaculture System", "as soon as they pick up from Malabagh", or imply harvest hasn't left yet! It is ALREADY on the road!
3. If customer asks how much time, rider phone number, or status: Inform them warmly that their fresh trout order #${todayOrderForCustomer.orderRef} is already packed & en route with our Express Dispatch Partner (+91 91037 06261 / dispatch desk), and the rider calls directly upon approaching their location. Ask them to keep their phone reachable.
4. ABSOLUTELY NEVER ASK FOR PAYMENT OR SEND PAYMENT LINKS.]\n\n${activeTurnPrompt}`;
      } else {
        activeTurnPrompt = `[⭐ TODAY'S ACTIVE ORDER ALREADY PAID & CONFIRMED: #${todayOrderForCustomer.orderRef} (${todayOrderForCustomer.items}, ${todayOrderForCustomer.amount}, Scheduled Slot: ${slotTxt}).
Customer has ALREADY paid for this order!
CRITICAL TEMPORAL & FINANCIAL SHIELD:
1. ABSOLUTELY NEVER SAY 'TOMORROW' OR RESCHEDULE THIS ORDER! Today is ${todayDayName}. The order is confirmed for TODAY (${slotTxt}).
2. ABSOLUTELY NEVER ASK FOR PAYMENT OR SEND PAYMENT LINKS.
3. NEVER GENERATE A DUPLICATE ORDER SUMMARY OR NEW ORDER NUMBER.
4. Reassure the customer warmly that their order is confirmed and our team at the Recirculatory Aquaculture System at Malabagh is preparing their live harvest for delivery today! If they shared an address/pin, confirm it is received for rider.]\n\n${activeTurnPrompt}`;
      }
    } else if (todayOrderForCustomer.payUrl) {
      activeTurnPrompt = `[⭐ TODAY'S ORDER PENDING PAYMENT: #${todayOrderForCustomer.orderRef} (${todayOrderForCustomer.items}, ${todayOrderForCustomer.amount}, Slot: ${todayOrderForCustomer.deliveryTime}). Payment link is already generated: ${todayOrderForCustomer.payUrl}. If customer asks for payment or link, provide this exact link. DO NOT change price or generate a different link.]\n\n${activeTurnPrompt}`;
    }
  } else if (ownerMarkedOutForDelivery) {
    activeTurnPrompt = `[⭐ TODAY'S ORDER IS ALREADY OUT FOR DELIVERY (confirmed via dispatch message above):
1. THE ORDER IS ALREADY HARVESTED, PACKED, AND EN ROUTE WITH OUR EXPRESS DISPATCH PARTNER!
2. NEVER say harvest is still being prepared at Malabagh. Confirm the rider is already on the road and will call directly prior to arrival (dispatch helpline: +91 91037 06261).]\n\n${activeTurnPrompt}`;
  } else if (existingOrder && !existingOrder.notFound) {
    const isPastFulfilled = isOrderDeliveredOrClosed(existingOrder);
    const orderDate = new Date(existingOrder.createdAt || existingOrder.updatedAt || existingOrder.paidAt || 0);
    const isOldOrder = (Date.now() - orderDate.getTime()) > (24 * 60 * 60 * 1000);

    if (!isPastFulfilled && !isOldOrder && isHistoricalOrderPaid(existingOrder)) {
      activeTurnPrompt = `[⭐ ACTIVE CONFIRMED ORDER ON FILE: #${existingOrder.orderRef} (${existingOrder.items}, ${existingOrder.amount}, Status: ${existingOrder.status}, Slot: ${existingOrder.deliveryTime || "Today"}). Customer is asking about their confirmed order/delivery. Provide their order status and timing directly. DO NOT generate a duplicate order or ask for payment again.]\n\n${activeTurnPrompt}`;
    } else if (isPastFulfilled || isOldOrder) {
      activeTurnPrompt = `[⭐ RETURNING VALUED CUSTOMER: Customer has ordered from us in the past (Previous completed order #${existingOrder.orderRef}).
CRITICAL DIRECTIVE: They are currently making a NEW inquiry or placing a NEW order today.
1. DO NOT claim order #${existingOrder.orderRef} is currently active or being harvested today! That past order was already completed/delivered.
2. Welcome them back warmly as a returning patron.
3. Answer their questions and assist them in placing their fresh new order for today with current rates.]\n\n${activeTurnPrompt}`;
    } else {
      activeTurnPrompt = `[ℹ️ RETURNING LEAD / PREVIOUS UNPAID QUOTE: Customer had an older quote #${existingOrder.orderRef}. ANY PREVIOUS PAYMENT LINK HAS EXPIRED. Do NOT resend dead payment links! Always apply current updated delivery rates for their area. If they ask to proceed or pay, generate a fresh order summary with updated rates.]\n\n${activeTurnPrompt}`;
    }
  } else if (!existingOrder && vipProfile) {
    activeTurnPrompt = `[⭐ RETURNING VALUED PATRON: Customer previously ordered from us (${vipProfile.orderCount} completed past orders). All previous orders are 100% DELIVERED & CLOSED in the past.
CRITICAL DIRECTIVE: Customer is making a FRESH NEW INQUIRY or placing a NEW order today!
1. DO NOT claim any past order is active, scheduled, reserved, or on the way!
2. Welcome them back warmly ("Welcome back to Urban Trout! 🐟") and ask how many kilograms they would like to order today.
3. If they say "same as last time", "repeat", or "wahi bhej do", output their reorder payment link: ${vipProfile.reorderPayTag}].\n\n${activeTurnPrompt}`;
  }

  contents.push({
    role: "user",
    parts: [{ text: activeTurnPrompt }]
  });

  const payload = JSON.stringify({
    system_instruction: {
      parts: [{ text: directive }]
    },
    contents,
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 1500
    }
  });

  // ─── VIP 1-TAP REORDER FAST-PATH EXECUTION (BYPASS GEMINI API) ───
  if (fastReorderReply) {
    let rawReply = fastReorderReply;
    const payMatch = rawReply.match(/\[PAY_LINK:\s*(\d+)\s*:\s*([^\]]+)\]/i);
    if (payMatch) {
      let amount = Number(payMatch[1]);
      let desc = payMatch[2].trim();
      const isStockOk = await checkStockAvailable(Math.max(1, Math.round(amount / 580)));
      if (!isStockOk) {
        rawReply = rawReply.replace(
          payMatch[0],
          "⚠️ *Our live harvest quota for today is fully committed! Next fresh harvest opens tomorrow morning at 8:00 AM.*"
        );
      } else {
        const savedLoc = chatMetadata[chatId] || (customerPhone ? chatMetadata[customerPhone] : null);
        // Respect any new locality mentioned in current turn or recent customer messages over old VIP locality
        let vipTurnLoc = detectSrinagarLocality(userMessage);
        if (!vipTurnLoc || vipTurnLoc.status !== "IN_ZONE") {
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i]?.role !== "user" || isSyntheticSystemNote(history[i].text)) continue;
            const dLoc = detectSrinagarLocality(history[i].text || "");
            if (dLoc && dLoc.status === "IN_ZONE") {
              vipTurnLoc = dLoc;
              break;
            }
          }
        }
        const activeVipAreaName = (vipTurnLoc && vipTurnLoc.status === "IN_ZONE")
          ? vipTurnLoc.name
          : ((vipProfile?.locality && !/^(?:srinagar|kashmir)$/i.test(vipProfile.locality.trim())) ? vipProfile.locality : (savedLoc?.localityName || "Srinagar"));
        const custDist = (vipTurnLoc && vipTurnLoc.status === "IN_ZONE")
          ? vipTurnLoc.dist
          : ((vipProfile && vipProfile.distanceKm != null) ? vipProfile.distanceKm : (savedLoc?.distanceKm != null ? savedLoc.distanceKm : 2.0));

        const cleanMsgForSlot = userMessage.replace(/\bgood\s+morning\b/gi, "").toLowerCase();
        let targetSlotDay = "Today";
        if (isFridayToday || isAdvanceScheduleReq) {
          targetSlotDay = (isFridayToday || (isThursdayToday && !isFridayOpen)) ? "Saturday" : "Tomorrow";
        } else if (isNightAfter9PM) {
          targetSlotDay = (isThursdayToday && !isFridayOpen) ? "Saturday" : "Tomorrow";
        }
        let scheduledSlot = "Within 2 Hours (Today)";
        if (/\b(?:evening|shaam|sham|4\s*[-–to]*\s*7\s*pm|4\s*pm|5\s*pm|6\s*pm|7\s*pm|16:00)\b/i.test(cleanMsgForSlot)) {
          scheduledSlot = `${targetSlotDay} Evening (4:00 PM – 7:00 PM)`;
        } else if (/\b(?:afternoon|dopahar|noon|12\s*pm|1\s*pm|2\s*pm|3\s*pm|13:00|14:00|15:00)\b/i.test(cleanMsgForSlot)) {
          scheduledSlot = `${targetSlotDay} Afternoon (12:00 PM – 3:00 PM)`;
        } else if (/\b(?:morning|subah|8\s*[-–to]*\s*11\s*am|8\s*am|9\s*am|10\s*am|11\s*am)\b/i.test(cleanMsgForSlot)) {
          scheduledSlot = `${targetSlotDay} Morning (8:00 AM – 11:00 AM)`;
        } else if (targetSlotDay === "Saturday") {
          scheduledSlot = "Saturday Morning (8:00 AM – 11:00 AM)";
        } else if (targetSlotDay === "Tomorrow") {
          scheduledSlot = "Tomorrow Morning (8:00 AM – 11:00 AM)";
        } else if (isEarlyPreDawn) {
          scheduledSlot = "Today Morning (8:00 AM – 11:00 AM)";
        }

        const isSlotEveningVip = targetSlotDay === "Today"
          ? isEveningSurge
          : /evening/i.test(scheduledSlot);

        const vipWeightMatch = (desc || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
        if (vipWeightMatch && custDist !== null) {
          const wKg = parseFloat(vipWeightMatch[1]);
          const verifiedPricing = calculateReorderPricing(wKg, desc.replace(/\s*\(\s*\+?Express\s*Delivery\s*\)/i, "").trim(), custDist, isSlotEveningVip);
          if (amount < verifiedPricing.amount) {
            console.warn(`🛡️ [VIP Fee Guard] Adjusted ${desc} from ₹${amount} to ₹${verifiedPricing.amount} for ${custDist} km.`);
            amount = verifiedPricing.amount;
            desc = verifiedPricing.tagDesc;
          }
        }
        const vipPayWeather = evaluateWeatherDeliveryPolicy(custDist);
        if (vipPayWeather.blockedByWeather && !isAdvanceScheduleReq) {
          console.log(`[Link Guard VIP] Blocked payment link for ${chatId} - ${custDist}km > ${WEATHER_RESTRICT_RADIUS_KM}km during ${vipPayWeather.weather.condition}.`);
          const vipAreaName = activeVipAreaName || "Your Area";
          rawReply = hasRecentWeatherAdvisory(history, vipAreaName)
            ? vipPayWeather.buildConciseWeatherHoldReminder(vipAreaName, custDist)
            : vipPayWeather.buildWetWeatherOutOfZoneMessage(vipAreaName, custDist);
        } else {
          try {
            let payObj = TodayOrderPool.findReusablePaymentLink(cleanPhone, chatId, amount);
            if (payObj) {
              console.log(`[Link Reuse VIP] Reusing single active payment link ${payObj.url} (#${payObj.ref}) for ${cleanPhone || chatId} (Amount ₹${amount})`);
            } else {
              const waterfallRes = await generatePaymentWithWaterfall({
                amount,
                customerPhone,
                customerName: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
                description: desc,
                preferQr: false,
                latitude: (savedLoc && savedLoc.latitude) ? savedLoc.latitude : null,
                longitude: (savedLoc && savedLoc.longitude) ? savedLoc.longitude : null,
                distanceKm: custDist,
                googleMapsUrl: (savedLoc && savedLoc.googleMapsUrl) ? savedLoc.googleMapsUrl : null
              });
              payObj = {
                url: waterfallRes.payUrl,
                id: waterfallRes.paymentLinkId || waterfallRes.cashfreeLinkId,
                orderRef: waterfallRes.orderRef,
                paymentLinkId: waterfallRes.paymentLinkId,
                cashfreeLinkId: waterfallRes.cashfreeLinkId,
                bankDetailsText: waterfallRes.bankDetailsText
              };
            }
            if (payObj) {
              const vipW = (desc || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
              const vipRate = /\b(?:whole|sabut)\b/i.test(desc || "") ? 540 : 580;
              const vipFee = vipW ? Math.max(0, amount - Math.round(parseFloat(vipW[1]) * vipRate)) : 0;
              recordNewCustomerOrder(cleanPhone || chatId, {
                orderRef: payObj.orderRef || payObj.ref,
                paymentLinkId: payObj.paymentLinkId || payObj.id || null,
                cashfreeLinkId: payObj.cashfreeLinkId || null,
                chatId: chatId,
                name: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
                items: desc,
                amount: `₹${amount} (Payment Link Sent)`,
                status: "Payment Link Sent — Awaiting Confirmation",
                deliveryArea: `${activeVipAreaName} (~${Number(custDist).toFixed(1)} km)`,
                distanceKm: custDist,
                deliveryFee: vipFee,
                latitude: savedLoc?.latitude || null,
                longitude: savedLoc?.longitude || null,
                googleMapsUrl: savedLoc?.googleMapsUrl || null,
                deliveryTime: scheduledSlot,
                payUrl: payObj.url || null,
                ...(payObj.isReused ? {} : { createdAt: new Date().toISOString() })
              });
              const payUrl = payObj.url || null;
              const orderCard = formatOrderSummaryCard({
                orderRef: payObj.orderRef || payObj.ref,
                amount,
                desc,
                deliveryArea: `${activeVipAreaName} (~${Number(custDist).toFixed(1)} km)`,
                deliveryFee: vipFee,
                distanceKm: custDist,
                localityName: activeVipAreaName,
                scheduledSlot,
                payUrl
              });
              const bankFallbackSuffix = (!payUrl && payObj.bankDetailsText) ? `\n\n${payObj.bankDetailsText}` : "";
              rawReply = rawReply.replace(payMatch[0], `\n\n${orderCard}${bankFallbackSuffix}`);
              const vipPrefix = stripInlineOrderSummaries(rawReply.split("🧾 *ORDER SUMMARY")[0]);
              rawReply = vipPrefix ? `${vipPrefix}\n\n🧾 *ORDER SUMMARY${rawReply.split("🧾 *ORDER SUMMARY")[1]}` : rawReply;
            }
          } catch (cfErr) {
            console.error("Error creating Cashfree link for VIP reorder:", cfErr.message);
            rawReply = rawReply.replace(payMatch[0], `(Our team will dispatch your secure payment link shortly)`);
          }
        }
      }
    }
    if (options && typeof options.isAborted === "function" && options.isAborted()) {
      return rawReply;
    }
    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: rawReply });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return rawReply;
  }

  const models = [
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite"
  ];
  const totalKeyCycles = GEMINI_API_KEYS.length;

  keyLoop: for (let keyAttempt = 0; keyAttempt < totalKeyCycles; keyAttempt++) {
    const currentApiKey = getActiveGeminiKey();
    if (!currentApiKey) break;

    for (const model of models) {
      let rawReply = null;
      for (let retry = 0; retry < 2; retry++) {
        try {
          rawReply = await new Promise((resolve, reject) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`;
            const req = https.request(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
              },
              timeout: 7000
            }, (res) => {
              let data = "";
              res.on("data", chunk => data += chunk);
              res.on("end", () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  try {
                    const json = JSON.parse(data);
                    const candidate = json.candidates?.[0];
                    const parts = candidate?.content?.parts || [];
                    const reply = parts
                      .filter(p => p.text && !p.thought)
                      .map(p => p.text)
                      .join("")
                      .trim();
                    if (reply) resolve(reply);
                    else reject(new Error("No reply text in response"));
                  } catch (e) {
                    reject(e);
                  }
                } else {
                  const err = new Error(`HTTP ${res.statusCode}: ${data.slice(0, 150)}`);
                  err.statusCode = res.statusCode;
                  reject(err);
                }
              });
            });

            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("Timeout calling Gemini")); });
            req.write(payload);
            req.end();
          });
          break; // Successfully got reply!
        } catch (err) {
          if (err.statusCode === 503 && retry === 0 && model === models[0]) {
            console.warn(`[Gemini Transient 503] Primary ${model} busy. Quick 500ms retry before instant failover...`);
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
          if (err.statusCode === 429 || err.statusCode === 403 || err.statusCode === 402 || err.statusCode === 400) {
            console.warn(`[Key Failover] Model ${model} on Key #${activeKeyIndex + 1} returned ${err.statusCode}. Rotating to next API key...`);
            rotateGeminiKey();
            continue keyLoop;
          } else {
            console.warn(`Model ${model} attempt failed (${err.message}). Failing over immediately.`);
            break;
          }
        }
      }

      if (rawReply) {
        if (options && typeof options.isAborted === "function" && options.isAborted()) {
          return rawReply;
        }
        lastActiveGeminiModel = model;

        // Check for [PAY_LINK: amount : desc] or [HDFC_QR: amount : desc] tag in reply
        const rawPayMatch = rawReply.match(/\[(PAY_LINK|HDFC_QR):\s*(\d+)\s*:\s*([^\]]+)\]/i);
        const payMatch = rawPayMatch;
        const isTagHdfcQr = Boolean(rawPayMatch && rawPayMatch[1].toUpperCase() === "HDFC_QR");
        if (payMatch) {
          let amount = Number(payMatch[2]);
          let desc = payMatch[3].trim();

          // 🛡️ HARD SHIELD: Today's Order Pool & Existing Paid Order Check (Never generate duplicate link/order for already-paid customers)
          const currentPaidToday = TodayOrderPool.getTodayOrder(customerPhone || cleanPhone, chatId);
          const isTodayOrderPaid = currentPaidToday && TodayOrderPool.isOrderPaid(currentPaidToday);
          const existingPaidAgeHours = existingOrder ? (Date.now() - new Date(existingOrder.paidAt || existingOrder.updatedAt || existingOrder.createdAt || 0).getTime()) / (3600 * 1000) : 999;
          const activeExistingPaid = existingOrder && isHistoricalOrderPaid(existingOrder) && !isOrderDeliveredOrClosed(existingOrder) && existingPaidAgeHours < 24;
          const isCustomerAlreadyPaid = Boolean(isTodayOrderPaid || activeExistingPaid);
          const paidRef = currentPaidToday?.orderRef || activeExistingPaid?.orderRef;
          let paidSlot = currentPaidToday?.deliveryTime || activeExistingPaid?.deliveryTime || "Today";
          if (paidSlot.toLowerCase().includes("tomorrow")) {
            paidSlot = paidSlot.replace(/tomorrow/gi, "Today");
          }
          const isExplicitAdditionalOrder = /\b(?:another|new|second|one more|ek aur|separate|different)\s*(?:order|kg|fish|pack)/i.test(userMessage) ||
            Boolean(parsedQuantity && /\b(?:tomorrow|kal|saturday|hafta|advance)\b/i.test(userMessage));

          const isWholeLink = /\b(?:whole|sabut)\b/i.test(desc);

          if (isExplicitCodInsistence(userMessage)) {
            console.log(`[COD Shield] Suppressed unrequested payment link/QR because customer explicitly asked to pay on delivery (${chatId}).`);
            rawReply = stripInlineOrderSummaries(rawReply.replace(payMatch[0], "").trim());
            if (!/Send Link/i.test(rawReply)) {
              rawReply += `\n\nJust reply *"Send Link"* whenever you're ready — click the link to pay directly with PhonePe, Google Pay, Paytm, or J&K Bank mPay! 🐟`;
            }
          } else if (isWholeLink) {
            console.log(`[Whole Trout Guard] Blocked delivery [PAY_LINK] for Whole Trout (${chatId}).`);
            rawReply = stripInlineOrderSummaries(rawReply.replace(payMatch[0], "").trim());
            const wholeNotice = `We don't deliver Whole Trout anymore — Whole Trout (₹540/kg) is available exclusively for in-person self-pickup at our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Sat–Thu 8 AM–8 PM).\n\nFor express delivery across Srinagar, we supply exclusively *Cleaned & Gutted* pan-ready steaks at *₹580/kg*. Would you like Cleaned & Gutted delivered instead? 🐟`;
            rawReply = rawReply ? `${rawReply}\n\n${wholeNotice}` : wholeNotice;
          } else if (isCustomerAlreadyPaid && !isExplicitAdditionalOrder) {
            console.log(`[Paid Shield] Suppressed duplicate payment link for already-paid customer ${chatId} (#${paidRef}).`);
            rawReply = rawReply.replace(payMatch[0], "").trim();
            rawReply = stripInlineOrderSummaries(rawReply);
            if (paidRef && !rawReply.includes(paidRef)) {
              rawReply += `\n\nYour order (*#${paidRef}*) is already paid & confirmed! Our team at the Recirculatory Aquaculture System at Malabagh has it scheduled for fresh live harvest (${paidSlot}). 🐟`;
            }
          } else {
            // 1. Silent stock check
            const isStockOk = await checkStockAvailable(Math.max(1, Math.round(amount / 580)));
            if (!isStockOk) {
              rawReply = rawReply.replace(
                payMatch[0],
                "⚠️ *Our live harvest quota for today is fully committed! Next fresh harvest opens tomorrow morning at 8:00 AM.*"
              );
            } else {
              // Retrieve saved customer location if previously shared (WhatsApp pin or Google Maps link)
              let savedLoc = chatMetadata[chatId] || (customerPhone ? chatMetadata[customerPhone] : null) || (cleanPhone ? chatMetadata[cleanPhone] : null);

              // Scan genuine customer messages in reverse chronological order (ignore synthetic GPS notes mentioning Malabagh farm!)
              const userRecentMsgs = history.filter(h => h.role === "user" && !isSyntheticSystemNote(h.text)).map(h => h.text).reverse();
              let detectedLocMatch = detectSrinagarLocality(userMessage);
              if (!detectedLocMatch) {
                for (const uMsg of userRecentMsgs) {
                  detectedLocMatch = detectSrinagarLocality(uMsg);
                  if (detectedLocMatch) break;
                }
              }
              if (!detectedLocMatch) {
                const candidateLocTexts = [userMessage, ...userRecentMsgs.slice(0, 2)].filter(Boolean).join(" ");
                const hasAddrClue = /\b(?:at|near|in|to|sector|colony|bagh|nagar|chowk|road|rd|pora|pore|bal|kadal|gali|lane|street|mohalla|enclave|housing|vihar|bridge|bund|marg|deliver(?:y)?|area|location|pin(?:code)?|190\d{3})\b/i.test(candidateLocTexts);
                if (hasAddrClue && !isGreeting && !isExplicitCodInsistence(candidateLocTexts)) {
                  detectedLocMatch = await resolveUnknownLocalityWithApi(candidateLocTexts);
                }
              }

              // ACTIVE CONVERSATION OVERRIDES STALE SAVED LOCATION!
              let custDist = null;
              let activeLocalityName = null;
              if (detectedLocMatch && detectedLocMatch.status === "IN_ZONE") {
                custDist = detectedLocMatch.dist;
                activeLocalityName = detectedLocMatch.name;
                // Update metadata with the new locality from this conversation
                const locUpdateIso = new Date().toISOString();
                if (!chatMetadata[chatId]) chatMetadata[chatId] = {};
                chatMetadata[chatId].distanceKm = custDist;
                chatMetadata[chatId].localityName = activeLocalityName;
                chatMetadata[chatId].locationUpdatedAt = locUpdateIso;
                if (customerPhone) {
                  if (!chatMetadata[customerPhone]) chatMetadata[customerPhone] = {};
                  chatMetadata[customerPhone].distanceKm = custDist;
                  chatMetadata[customerPhone].localityName = activeLocalityName;
                  chatMetadata[customerPhone].locationUpdatedAt = locUpdateIso;
                  const r10 = customerPhone.slice(-10);
                  if (r10 && r10 !== customerPhone) {
                    if (!chatMetadata[r10]) chatMetadata[r10] = {};
                    chatMetadata[r10].distanceKm = custDist;
                    chatMetadata[r10].localityName = activeLocalityName;
                    chatMetadata[r10].locationUpdatedAt = locUpdateIso;
                  }
                }
                saveChatMetadata();
              } else if (detectedLocMatch && detectedLocMatch.status === "OUT_ZONE") {
                custDist = 999;
                activeLocalityName = detectedLocMatch.name;
              } else if (savedLoc && savedLoc.distanceKm != null && ((savedLoc.latitude != null && savedLoc.longitude != null) || (savedLoc.localityName && !/^(?:srinagar|kashmir)$/i.test(savedLoc.localityName.trim())))) {
                custDist = savedLoc.distanceKm;
                activeLocalityName = savedLoc.localityName;
              } else {
                custDist = null; // NEVER assume core zone 2.0km for unverified places!
              }

              // Parse order weight and cleaned cut
              const weightMatch = desc.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
              const cleanCutDesc = desc.replace(/\s*\(\s*\+?(?:₹\s*\d+\s*)?(?:Special\s+|Express\s+)?Delivery\s*\)/gi, "").replace(/^\s*\d+(?:\.\d+)?\s*(?:kg|kilos?)\s*/i, "").trim() || "Cleaned & Gutted";
              const orderWeight = weightMatch ? parseFloat(weightMatch[1]) : (amount >= 2160 ? 4 : (amount >= 1620 ? 3 : 2));
              const includesCourierFee = /\(\+(?:Special|Express) Delivery\)/i.test(desc);
              const recentContextForOutZone = (userMessage + " " + history.filter(h => h.role === "user").map(h => h.text).slice(-2).join(" ")).toLowerCase();
              const isFarOutZone = /(?:pampore|chadoora|lawaypora|harwan|budgam|ompora|baramulla|anantnag|jammu|kanipora|bk\s*pora|bagati\s*kanipora|narbal|magam|pulwama)/i.test(recentContextForOutZone);
              const payWeatherPolicy = evaluateWeatherDeliveryPolicy(custDist);

              // Resolve delivery slot across current turn + recent customer turns BEFORE Fee Guard
              const recentUserSlotMsgs = history.filter(h => h.role === "user" && !isSyntheticSystemNote(h.text)).slice(-4).map(h => h.text).join(" ");
              const cleanCurrentSlotText = `${recentUserSlotMsgs} ${userMessage}`
                .replace(/\bgood\s+morning\b/gi, "")
                .toLowerCase();
              const userExplicitTodayNow = /\b(?:today|tonight|aaj|abhi|right\s*now)\b/i.test(userMessage.toLowerCase());
              const isExplicitTomorrow = !userExplicitTodayNow && /\b(?:tomorrow|tomm?or?ro?w|tmrw|2moro|kal|subah\s*kal|kal\s*subah)\b/i.test(cleanCurrentSlotText);
              const isExplicitSaturday = /\b(?:saturday|advance|hafta)\b/i.test(cleanCurrentSlotText);
              const explicitWeekdayMatch = cleanCurrentSlotText.match(/\b(sunday|monday|tuesday|wednesday|thursday|saturday)\b/i);
              const explicitWeekdayCap = explicitWeekdayMatch
                ? explicitWeekdayMatch[1].charAt(0).toUpperCase() + explicitWeekdayMatch[1].slice(1).toLowerCase()
                : null;
              const isAdvanceScheduledOrder = isExplicitTomorrow || isExplicitSaturday || Boolean(explicitWeekdayCap);

              let targetDay = "Today";
              if (explicitWeekdayCap) {
                targetDay = explicitWeekdayCap;
              } else if (isFridayToday || (isThursdayToday && !isFridayOpen && (isExplicitTomorrow || isNightAfter9PM))) {
                targetDay = "Saturday";
              } else if (isExplicitTomorrow || isNightAfter9PM) {
                targetDay = "Tomorrow";
              } else if (isExplicitSaturday) {
                targetDay = "Saturday";
              }

              let scheduledSlot = "Within 90–120 Minutes (Today)";
              if (/\b(?:evening|shaam|sham|4\s*[-–to]*\s*7\s*pm|4\s*pm|5\s*pm|6\s*pm|7\s*pm|4[.:]00|5[.:]00|6[.:]00|7[.:]00|16:00)\b/i.test(cleanCurrentSlotText)) {
                scheduledSlot = `${targetDay} Evening (4:00 PM – 7:00 PM)`;
              } else if (/\b(?:afternoon|dopahar|noon|12\s*pm|1\s*pm|2\s*pm|3\s*pm|12[.:]00|13:00|14:00|15:00)\b/i.test(cleanCurrentSlotText)) {
                scheduledSlot = `${targetDay} Afternoon (12:00 PM – 3:00 PM)`;
              } else if (/\b(?:morning|subah|8\s*[-–to]*\s*11\s*am|8\s*am|9\s*am|10\s*am|11\s*am|8[.:]00|9[.:]00|10[.:]00|11[.:]00)\b/i.test(cleanCurrentSlotText)) {
                scheduledSlot = `${targetDay} Morning (8:00 AM – 11:00 AM)`;
              } else if (targetDay === "Tomorrow") {
                scheduledSlot = "Tomorrow Morning (8:00 AM – 11:00 AM)";
              } else if (explicitWeekdayCap || targetDay === "Saturday") {
                scheduledSlot = `${explicitWeekdayCap || "Saturday"} Morning (8:00 AM – 11:00 AM)`;
              } else if (isEarlyPreDawn) {
                scheduledSlot = "Today Morning (8:00 AM – 11:00 AM)";
              }

              const isSlotEvening = targetDay === "Today"
                ? isEveningSurge
                : /evening/i.test(scheduledSlot);

              const expectedPricing = custDist !== null
                ? calculateReorderPricing(orderWeight, cleanCutDesc, custDist, isSlotEvening)
                : null;
              const expectedFee = custDist !== null
                ? getDeliveryFeeForDistance(custDist, orderWeight, isSlotEvening)
                : 0;
              const baseFishOnly = Math.round(orderWeight * 580);

              if (custDist === null) {
                console.log(`[Link Guard] Blocked payment link for ${chatId} - location is UNVERIFIED. Asking for area name or pin.`);
                rawReply = stripInlineOrderSummaries(rawReply.replace(payMatch[0], "").trim());
                const locPrompt = `📍 *To confirm your express delivery:* Which area in Srinagar should we deliver to (e.g. Soura, Lal Chowk, Rajbagh, Hyderpora)? Please share your *WhatsApp Location Pin or Google Maps link* so our Express Dispatch Partner can reach your exact shared location! 🐟`;
                rawReply = rawReply ? `${rawReply}\n\n${locPrompt}` : locPrompt;
              } else if (custDist !== null ? custDist > 16.0 : isFarOutZone) {
                console.log(`[Link Guard] Blocked payment link for ${chatId} - location ${custDist}km is OUTSIDE delivery perimeter (>16km).`);
                rawReply = stripInlineOrderSummaries(rawReply.replace(payMatch[0], "").trim());
                const displayDist = (custDist && custDist < 900) ? `~${custDist.toFixed(1)} km` : "far beyond our 16.0 km express perimeter";
                const isFarAwayState = /(?:jammu|delhi|punjab|bangalore|mumbai|outside\s*kashmir)/i.test(recentContextForOutZone);
                const outZoneNotice = isFarAwayState
                  ? `📍 *Outside Delivery Zone:* Express delivery is restricted to Srinagar and immediate surrounding areas (within 16 km of our Recirculatory Aquaculture System at Malabagh) to preserve live-harvest freshness with 0% ice. We do not deliver to Jammu or outside Kashmir.`
                  : `📍 *Outside Delivery Zone:* Express delivery is not available for your location (${displayDist}). You are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout on the spot! 🐟\nMaps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9`;
                rawReply = rawReply ? `${rawReply}\n\n${outZoneNotice}` : outZoneNotice;
              } else if (payWeatherPolicy.blockedByWeather && !isAdvanceScheduledOrder) {
                console.log(`[Link Guard] Blocked payment link for ${chatId} - ${custDist}km > ${WEATHER_RESTRICT_RADIUS_KM}km during active ${payWeatherPolicy.weather.condition}.`);
                const linkAreaName = activeLocalityName || savedLoc?.localityName || "Your Area";
                rawReply = hasRecentWeatherAdvisory(history, linkAreaName)
                  ? payWeatherPolicy.buildConciseWeatherHoldReminder(linkAreaName, custDist)
                  : payWeatherPolicy.buildWetWeatherOutOfZoneMessage(linkAreaName, custDist);
              } else if (!includesCourierFee && expectedFee > 0 && amount <= baseFishOnly + 5 && custDist > 11.5 && custDist <= 16.0 && orderWeight < 4.95) {
                console.log(`[Link Guard] Blocked <5kg free-delivery payment link for ${chatId} - zone 4 requires 5kg MOQ for free delivery.`);
                const sGuard = isSlotEvening ? 40 : 0;
                rawReply = rawReply.replace(
                  payMatch[0],
                  `🛵 *Delivery Note (South & Cross-City Srinagar):*\nYour location is ~${custDist ? custDist.toFixed(1) : "12–16"} km from our Recirculatory Aquaculture System at Malabagh. Express delivery is 100% FREE for our *5 kg* family pack (₹2,900 Cleaned & Gutted).\n\nSmaller orders are also gladly delivered via our Express Dispatch Partner:\n• 4 kg: ₹${2429 + sGuard} total (₹${109 + sGuard} delivery fee)\n• 3 kg: ₹${1869 + sGuard} total (₹${129 + sGuard} delivery fee)\n• 2 kg: ₹${1299 + sGuard} total (₹${139 + sGuard} delivery fee)\n• 1 kg: ₹${770 + sGuard} total (₹${190 + sGuard} delivery fee)\n\nWhich option would you like? 🐟`
                );
              } else if (!includesCourierFee && expectedFee > 0 && amount <= baseFishOnly + 5 && custDist > 4.0 && custDist <= 11.5 && orderWeight < 2.95) {
                console.log(`[Link Guard] Blocked <3kg free-delivery payment link for ${chatId} - zone 2/3 requires 3kg MOQ for free delivery.`);
                const sGuard = isSlotEvening ? 40 : 0;
                const isZone2 = custDist <= 7.0;
                const fee2kg = (isZone2 ? 55 : 89) + sGuard;
                const tot2kg = 1160 + fee2kg;
                const fee1kg = (isZone2 ? 75 : 130) + sGuard;
                const tot1kg = 580 + fee1kg;
                rawReply = rawReply.replace(
                  payMatch[0],
                  `🛵 *Delivery Note:*\nYour location is ~${custDist.toFixed(1)} km from our Recirculatory Aquaculture System at Malabagh. For 100% FREE express delivery, our minimum order is *3 kg* (₹1,740 Cleaned & Gutted).\n\nSmaller orders are also gladly delivered express:\n• 2 kg: ₹${tot2kg} total (₹${fee2kg} delivery fee)\n• 1 kg: ₹${tot1kg} total (₹${fee1kg} delivery fee)\n\nWhich option would you prefer? 🐟`
                );
              } else if (
                (isThursdayToday && !isFridayOpen && /\b(?:tomorrow|kal|friday|jumma|juma)\b/i.test(userMessage) && !/\b(?:saturday|hafta|aaj|today|tonight)\b/i.test(userMessage)) ||
                (isFridayToday &&
                  !/\b(?:saturday|sat|advance|hafta|tomorrow|tomm?or?ro?w|tmrw|2moro|kal|morning|subah|afternoon|evening|slot|\d+\s*(?:am|pm)|yes|ok|sure|please|bhejo|book)\b/i.test(userMessage) &&
                  !/\b(?:advance\s*bookings?|saturday|closed\s*today\s*\(friday\)|bio-security)\b/i.test(history.filter(h => h.role === "model").pop()?.text || "")
                )
              ) {
                console.log(`[Link Guard] Blocked payment link for Friday delivery attempt for ${chatId}.`);
                rawReply = rawReply.replace(
                  payMatch[0],
                  `⚠️ *Friday Closure Notice:*\nOur Recirculatory Aquaculture System at Malabagh and express deliveries are strictly closed on Fridays for weekly filtration bio-security maintenance. We cannot harvest or deliver on Friday.\n\nWe would be delighted to schedule fresh delivery for *Saturday* (Morning 8:00 AM – 11:00 AM, Afternoon 12:00 PM – 3:00 PM, or Evening 4:00 PM – 7:00 PM)${isThursdayToday ? " or *today (Thursday)* within 2 hours" : ""}.\n\nPlease let us know if Saturday works, and we will immediately provide your payment link! 🐟`
                );
              } else {
                if (expectedPricing && amount < expectedPricing.amount - 5) {
                  console.warn(`🛡️ [Fee Guard] Corrected ${desc} from ₹${amount} to ₹${expectedPricing.amount} for ${custDist} km (Evening: ${isSlotEvening}).`);
                  amount = expectedPricing.amount;
                  desc = expectedPricing.tagDesc;
                }

                try {
                  const wantHdfcQrForTag = isTagHdfcQr || isExplicitQrScannerAsk(userMessage);
                  if (wantHdfcQrForTag && typeof options?.onDispatchHdfcQr === "function") {
                    const hdfcTagOrderRef = `UT-WA-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
                    const hdfcParsedW = (desc || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
                    const hdfcFee = hdfcParsedW ? Math.max(0, amount - Math.round(parseFloat(hdfcParsedW[1]) * 580)) : 0;
                    const destLocality = activeLocalityName || (detectedLocMatch && detectedLocMatch.status === "IN_ZONE" ? detectedLocMatch.name : (savedLoc?.localityName || null));

                    options.onDispatchHdfcQr({
                      orderRef: hdfcTagOrderRef,
                      amount,
                      desc,
                      deliveryFee: hdfcFee,
                      distanceKm: custDist,
                      localityName: destLocality,
                      scheduledSlot,
                      latitude: savedLoc?.latitude || null,
                      longitude: savedLoc?.longitude || null,
                      googleMapsUrl: savedLoc?.googleMapsUrl || null
                    });

                    const introText = stripInlineOrderSummaries(rawReply.replace(payMatch[0], "").trim());
                    rawReply = introText || "__HDFC_QR_ONLY__";
                  } else {
                  const orderStorageKey = (isCustomerAlreadyPaid && isExplicitAdditionalOrder)
                    ? `${cleanPhone || customerPhone || chatId}_ADD_${Date.now()}`
                    : (cleanPhone || customerPhone || chatId);

                  // 2. Check if customer already has a valid reusable link for the same amount today
                  let payObj = (isCustomerAlreadyPaid && isExplicitAdditionalOrder)
                    ? null
                    : TodayOrderPool.findReusablePaymentLink(customerPhone || cleanPhone, chatId, amount);
                  if (payObj) {
                    console.log(`[Link Reuse] Reusing single active payment link ${payObj.url} (#${payObj.ref}) for ${customerPhone || chatId} (Amount ₹${amount})`);
                  } else {
                    const waterfallRes = await generatePaymentWithWaterfall({
                      amount,
                      customerPhone: cleanPhone || customerPhone,
                      customerName: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
                      description: desc,
                      preferQr: false,
                      latitude: savedLoc?.latitude,
                      longitude: savedLoc?.longitude,
                      distanceKm: savedLoc?.distanceKm != null ? savedLoc.distanceKm : custDist,
                      googleMapsUrl: savedLoc?.googleMapsUrl
                    });
                    payObj = {
                      url: waterfallRes.payUrl,
                      ref: waterfallRes.orderRef,
                      id: waterfallRes.paymentLinkId || waterfallRes.cashfreeLinkId,
                      paymentLinkId: waterfallRes.paymentLinkId,
                      cashfreeLinkId: waterfallRes.cashfreeLinkId,
                      bankDetailsText: waterfallRes.bankDetailsText
                    };
                  }
                  const payUrl = payObj.url || null;
                  const parsedW = (desc || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
                  const inferredFee = parsedW ? Math.max(0, amount - Math.round(parseFloat(parsedW[1]) * 580)) : 0;

                  recordNewCustomerOrder(orderStorageKey, {
                    orderRef: payObj.ref || payObj.orderRef,
                    paymentLinkId: payObj.paymentLinkId || payObj.id || null,
                    cashfreeLinkId: payObj.cashfreeLinkId || null,
                    chatId: chatId,
                    phone: cleanPhone || customerPhone || "",
                    name: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
                    items: desc,
                    amount: `₹${amount} (Payment Link Sent)`,
                    status: "Payment Link Sent — Awaiting Confirmation",
                    deliveryArea: activeLocalityName
                      ? `${activeLocalityName} (~${Number(custDist || 2.0).toFixed(1)} km)`
                      : (custDist != null
                        ? `Srinagar (~${Number(custDist).toFixed(1)} km from farm)`
                        : "Srinagar"),
                    deliveryTime: scheduledSlot,
                    deliveryFee: inferredFee,
                    latitude: savedLoc?.latitude,
                    longitude: savedLoc?.longitude,
                    distanceKm: savedLoc?.distanceKm != null ? savedLoc.distanceKm : custDist,
                    googleMapsUrl: savedLoc?.googleMapsUrl,
                    payUrl
                  });

                  const destLocality = activeLocalityName || (detectedLocMatch && detectedLocMatch.status === "IN_ZONE" ? detectedLocMatch.name : (savedLoc?.localityName || null));
                  const orderCard = formatOrderSummaryCard({
                    orderRef: payObj.ref || payObj.orderRef,
                    amount,
                    desc,
                    deliveryArea: destLocality,
                    deliveryFee: inferredFee,
                    distanceKm: custDist,
                    localityName: destLocality,
                    scheduledSlot,
                    payUrl
                  });
                  const bankFallback = (!payUrl && payObj.bankDetailsText) ? `\n\n${payObj.bankDetailsText}` : "";
                  // Clean up duplicate order summary cards or bullet points generated by AI prior to the authoritative card
                  const introText = stripInlineOrderSummaries(rawReply.replace(payMatch[0], "").trim());

                  rawReply = introText ? `${introText}\n\n${orderCard}${bankFallback}` : `${orderCard}${bankFallback}`;
                  }
                } catch (cfErr) {
                  console.error("Error creating Cashfree link:", cfErr.message);
                  rawReply = rawReply.replace(payMatch[0], `(Our team will dispatch your secure payment link shortly)`);
                }
              }
            }
          }
        }

        // Strictly scrub any customer names or name addressing from the reply
        rawReply = scrubCustomerNames(rawReply, customerName);

        // Clean repetitive follow-up greetings so bot never repeats greetings or customer names in ongoing chats
        if (!isFirstMessage) {
          rawReply = cleanFollowUpGreeting(rawReply, customerName);
        }

        // Enforce Islamic Greeting Mandate: reply "Walaikum Assalam!" ONLY when customer says Salam
        const isCustomerSalam = /\b(?:as+al+am[uo]?(?:[\s\-]*[uo])?[\s\-]*[ao]?lai?kum|as+lam[uo]?[\s\-]*[ao]?lai?kum|salam(?:[\s\-]*[uo])?[\s\-]*[ao]?lai?kum|salam|salaam|aoa)\b/i.test(userMessage.trim());

        if (isCustomerSalam) {
          if (!/^(?:Walaikum\s+Assalam|Wa\s*alaikum\s*assalam)/i.test(rawReply.trim())) {
            rawReply = rawReply.replace(/^(?:(?:Hello|Hi|Hey|Good\s*(?:morning|afternoon|evening))[!,\s]*)+/i, "").trim();
            if (/^Welcome\s+to/i.test(rawReply)) {
              rawReply = `Walaikum Assalam! ${timeOfDayGreeting} ${rawReply}`.trim();
            } else {
              rawReply = `Walaikum Assalam! ${rawReply}`.trim();
            }
          }
        } else {
          rawReply = rawReply.replace(/^(?:(?:Walaikum\s+Assalam|Wa\s*alaikum\s*assalam|Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Salaam)[\s!,\.\-–—]*)+/i, isFirstMessage ? `${timeOfDayGreeting} ` : "").trim();
          rawReply = rawReply.replace(/\b(?:Walaikum\s+Assalam|Wa\s*alaikum\s*assalam|Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Salaam)\b/gi, "");
        }
        rawReply = rawReply.replace(/\b(?:Janab|Sb|Sahib|Sahab)\b/gi, "");

        // Strict post-processing: enforce night protocol (scrub accidental promises of immediate delivery tonight)
        // ONLY applies at night (8:00 PM – 11:59 PM). Pre-dawn morning is TODAY, so never scrub morning to tomorrow!
        if (isNightAfter9PM) {
          if (isThursdayToday && !isFridayOpen) {
            rawReply = rawReply.replace(/\bfor\s+\*?tomorrow\s*\(\s*Saturday\s*,?\s*/gi, "for *Saturday (");
            rawReply = rawReply.replace(/\b(?:(?:we\s*(?:can|will)?\s*)?deliver(?:y|ed)?\s+tonight(?:\s+within\s+(?:1\s*(?:to|-)\s*2|2|1)\s*hours?)?)\b/gi, "scheduled for delivery Saturday morning");
            rawReply = rawReply.replace(/\bwithin\s*(?:1\s*(?:to|-)\s*2|2|1)\s*hours?\s+tonight\b/gi, "Saturday morning");
            rawReply = rawReply.replace(/\bwe\s*(?:can|will)?\s*deliver\s+tonight\b/gi, "we can schedule delivery for Saturday morning");
            rawReply = rawReply.replace(/\b(?:delivering|dispatching)\s+tonight\b/gi, "delivering Saturday morning");
            rawReply = rawReply.replace(/(?<!closed\s+)(?<!scheduled\s+for\s+delivery\s+)\b(?:scheduled\s+for\s+delivery\s+)?tomorrow(?:\s+(?:morning|afternoon|evening))?\b(?!\s*(?:is\s+Friday|\(\s*Friday|,\s*Friday))/gi, "Saturday morning");
          } else {
            rawReply = rawReply.replace(/\b(?:(?:we\s*(?:can|will)?\s*)?deliver(?:y|ed)?\s+tonight(?:\s+within\s+(?:1\s*(?:to|-)\s*2|2|1)\s*hours?)?)\b/gi, "scheduled for delivery tomorrow");
            rawReply = rawReply.replace(/\bwithin\s*(?:1\s*(?:to|-)\s*2|2|1)\s*hours?\s+tonight\b/gi, "tomorrow morning");
            rawReply = rawReply.replace(/\bwe\s*(?:can|will)?\s*deliver\s+tonight\b/gi, "we can schedule delivery for tomorrow");
            rawReply = rawReply.replace(/\b(?:delivering|dispatching)\s+tonight\b/gi, "delivering tomorrow");
          }
        }

        // Pre-dawn morning sanity check (12:00 AM – 7:59 AM): Under NO circumstances say "tomorrow" or "tonight"
        if (isEarlyPreDawn && !isFridayToday) {
          rawReply = rawReply.replace(/\b(?:deliver(?:y|ed)?\s+tonight|delivering\s+tonight)\b/gi, "delivering this morning");
          rawReply = rawReply.replace(/\bscheduled\s+for\s+delivery\s+tomorrow\b/gi, "scheduled for delivery this morning (8:00 AM – 11:00 AM)");
          rawReply = rawReply.replace(/\bdeliver\s+tomorrow\b/gi, "deliver this morning");
        }

        // Strict day guards against accidental delivery claims on Friday or Thursday for Friday
        if (isThursdayToday && !isFridayOpen) {
          rawReply = rawReply.replace(/\b(?:fully\s+open\s+for\s+(?:doorstep|express)\s+deliveries\s+tomorrow|open\s+for\s+deliveries\s+tomorrow|open\s+tomorrow)\b/gi, "closed tomorrow (Friday) for weekly maintenance, but open Saturday");
        }
        if (isFridayToday) {
          rawReply = rawReply.replace(/\b(?:fully\s+open\s+today|deliver\s+today|delivery\s+today|within\s+2\s+hours\s+today)\b/gi, "scheduled for delivery tomorrow (Saturday)");
        }
        // Guard against hallucinated Friday/Saturday mentions on normal operating days (Sunday through Wednesday):
        if (!isThursdayToday && !isFridayToday) {
          rawReply = rawReply.replace(/\btomorrow\s*\(\s*saturday\s*\)/gi, `tomorrow (${tomorrowDayName})`);
          rawReply = rawReply.replace(/\btomorrow,\s*saturday\b/gi, `tomorrow, ${tomorrowDayName}`);
          rawReply = rawReply.replace(/\bstarting\s+Saturday\s+morning\s+at\s+[78](?::00)?\s*AM\b/gi, `tomorrow (${tomorrowDayName}) morning at 8:00 AM`);
          rawReply = rawReply.replace(/\bdelivered\s+to\s+your\s+home\s+on\s+Saturday\b/gi, `delivered to your location tomorrow (${tomorrowDayName})`);
          rawReply = rawReply.replace(/\bharvest\s+fresh\s+for\s+you\s+on\s+Saturday\b/gi, `harvest fresh for you tomorrow (${tomorrowDayName})`);
          rawReply = rawReply.replace(/\bready\s+to\s+take\s+your\s+fresh\s+live-harvest\s+order\s+starting\s+Saturday\s+morning\b/gi, `ready to take your fresh live-harvest order tomorrow (${tomorrowDayName}) morning`);
        }
        // Collapse multiple horizontal spaces on the same line without destroying newlines/paragraphs!
        rawReply = rawReply.replace(/[ \t]{2,}/g, " ").trim();
        // Ensure genuine bullet points (•, or list markers - / * preceded and followed by spaces or starting a line) start on their own fresh line
        // 1. Convert mid-sentence list markers (e.g. "Options: - Cleaned" or "Options: • Cleaned") to newlines with bullet
        rawReply = rawReply.replace(/([:!?.])\s+[-*•]\s+(?=[A-Za-z0-9₹*])/g, "$1\n• ");
        // 2. Normalize leading list markers at start of line (- or * followed by space) to bullet •
        rawReply = rawReply.replace(/(^|\n)[\t ]*[-*]\s+(?=[A-Za-z0-9₹*])/gm, "$1• ");
        // 3. If an explicit unicode bullet • appears without a newline, ensure it starts on a new line
        rawReply = rawReply.replace(/([^\n\s])\s*•\s*/g, "$1\n• ");
        // 4. Ensure numbered lists (e.g. "1. ") start on their own fresh line
        rawReply = rawReply.replace(/([:!?.\n])\s*(\d+\.\s+)/g, "$1\n$2");
        // ─── STRICT ANTI-ZONE SANITIZER (PURGE ALL LOGISTICS JARGON BEFORE SENDING) ───
        rawReply = rawReply.replace(/\b(?:in\s+your\s+area\s+)?\(Zone\s*[1-4]\)/gi, "");
        rawReply = rawReply.replace(/\bmin(?:imum)?\s*2\s*kg\s*for\s*Zone\s*1,\s*3\s*kg\s*for\s*Zone\s*2\s*(?:&|and)\s*3,\s*4\s*kg\s*for\s*Zone\s*4\b/gi, "min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas");
        rawReply = rawReply.replace(/\b(?:min(?:imum)?\s*order\s*)?2\s*kg\s*for\s*Zone\s*1[^,\n)]*,\s*3\s*kg\s*for\s*Zone\s*2[^,\n)]*,\s*4\s*kg\s*for\s*Zone\s*4\b/gi, "min 2 kg for nearby areas, 3–5 kg for wider Srinagar areas");
        rawReply = rawReply.replace(/\bZone\s*1\s*\((?:0[-–]4\s*km|core\s*zone)\)/gi, "nearby areas");
        rawReply = rawReply.replace(/\bZone\s*2\s*\(4[-–]7\s*km\)/gi, "mid Srinagar areas");
        rawReply = rawReply.replace(/\bZone\s*3\s*\(7[-–]11\.5\s*km\)/gi, "central Srinagar areas");
        rawReply = rawReply.replace(/\bZone\s*4\s*\(11\.5[-–]16\s*km\)/gi, "outer corridor areas");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*1\b/gi, "nearby areas");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*2\b/gi, "mid Srinagar");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*3\b/gi, "central Srinagar");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*4\b/gi, "outer Srinagar");
        rawReply = rawReply.replace(/\b(?:in\s+our\s+|in\s+)?greater\s+srinagar\s*(?:express\s*delivery\s*zone|delivery\s*zone|areas?|zone)?\b/gi, "Srinagar");
        rawReply = rawReply.replace(/\bgreater\s+srinagar\b/gi, "Srinagar");
        rawReply = rawReply.replace(/\(\s*greater\s+srinagar\s*(?:area)?\s*\)/gi, "");
        rawReply = rawReply.replace(/\b(?:khyber\s*hospital|masjid\s*aishan\s*sahab\s*sarfi)\b/gi, "Srinagar");
        // ─── STRICT PROHIBITION ON "AI FLEX" & BOT BOASTING ───
        rawReply = rawReply
          .replace(/[-–—]?\s*(?:Jammu\s*&\s*Kashmir(?:’s|'s)?\s*(?:very\s*)?first\s*startup\s*(?:to\s*integrate|integrating|featuring|with|to\s*deliver)?\s*(?:an\s*)?(?:AI(?:\s*sales)?\s*assistant|AI|fresh)?(?:\s*on\s*WhatsApp)?)[!.,\s–—\-]*/gi, "")
          .replace(/[-–—]?\s*(?:Jammu\s*&\s*Kashmir(?:’s|'s)?\s*(?:very\s*)?first\s*startup)[!.,\s–—\-]*/gi, "")
          .replace(/\b(?:I\s*am\s*Urban\s*Trout(?:'s|’s)?\s*AI\s*(?:sales\s*)?assistant)[!.,\s–—\-]*/gi, "We are Urban Trout")
          .replace(/\b(?:our\s*AI\s*(?:sales\s*)?assistant|an\s*AI\s*sales\s*assistant)\b/gi, "our farm team")
          .replace(/\b(?:integrating\s*AI\s*on\s*WhatsApp|utilizing\s*AI\s*assistance\s*on\s*WhatsApp)\b/gi, "")
          .replace(/\b(?:with\s+an\s+AI\s+assistant|featuring\s+an\s+AI\s+assistant)\b/gi, "");
        // ─── STRICT CUSTOMER CONFIDENTIALITY & PIN-POINT LOCATION SANITIZER ───
        rawReply = rawReply
          .replace(/\(\s*70\s*%[^)]*30\s*%[^)]*\)/gi, "")
          .replace(/\b70\s*%\s*(?:customer\s*)?(?:\/|-|and)\s*30\s*%(?:\s*(?:urban\s*trout\s*)?(?:subsidy|split|share))?/gi, "")
          .replace(/\b(?:30\s*%\s*(?:subsidized|subsidised|subsidy)(?:\s*by\s*urban\s*trout)?|70\s*%\s*(?:paid\s*by\s*)?customer\s*(?:share)?)\b/gi, "")
          .replace(/\b(?:70|30)\s*%/gi, "")
          .replace(/\b(?:subsidized|subsidised)\s+by\s+urban\s+trout\b/gi, "")
          .replace(/\b(?:subsidized|subsidised)\s+(?:express\s+)?(?:courier|delivery)\s+(?:fee|charge|rates?)/gi, "express delivery fee")
          .replace(/\b(?:subsidized|subsidised)\s+(?:express\s+)?(?:courier|delivery)/gi, "express delivery")
          .replace(/\b(?:subsidized|subsidised|subsidy)\b/gi, "standard")
          .replace(/(?:no,\s*)?(?:we\s+(?:do\s+not|don['’]?t|never)\s+(?:use|work\s+with|partner\s+with|rely\s+on)|not\s+using)\s+(?:rapido|third[- ]?party(?:\s*(?:apps?|couriers?|deliver(?:y|ies)|riders?|bikes?|partners?|services?))?)(?:\s*(?:or|and|,)\s*(?:rapido|third[- ]?party(?:\s*(?:apps?|couriers?|deliver(?:y|ies)|riders?|bikes?|partners?|services?))?))*[^.!?\n]*[.!?]?/gi, "All express deliveries across Srinagar are coordinated through our Express Dispatch Partner.")
          .replace(/\b(?:rapido|third[- ]party\s*(?:apps?|couriers?|deliver(?:y|ies)|riders?|bikes?|partners?|services?)?)\b/gi, "Express Dispatch Partner")
          .replace(/\b(?:urban\s+trout\s+)?cold[-\s]?chain\s+dispatch\s+partner\b/gi, "Express Dispatch Partner")
          .replace(/\bcold[-\s]?chain\s+(?:dispatch\s+)?executive\b/gi, "express dispatch executive")
          .replace(/\b(?:cold[-\s]?chain\s+)?chilled\s+(vans?|trucks?|vehicles?|boxes?)\b/gi, "refrigerated $1")
          .replace(/\bcold[-\s]?chain\s+(vans?|trucks?|vehicles?|boxes?)\b/gi, "refrigerated $1")
          .replace(/\bcold[-\s]?chain\s+(?:express\s+)?deliver(?:y|ies)\b/gi, "express delivery")
          .replace(/\bexpress\s+cold[-\s]?chain\s+deliver(?:y|ies)\b/gi, "express delivery")
          .replace(/\bcold[-\s]?chain\s+routes?\b/gi, "express routes")
          .replace(/\bcold[-\s]?chain\b/gi, "express")
          .replace(/\bchilled\s+express\s+deliver(?:y|ies)\b/gi, "fresh express delivery")
          .replace(/\bdelivered\s+chilled\b/gi, "delivered fresh")
          .replace(/\bchilled\s+package\b/gi, "fresh sealed package")
          .replace(/\bchilled\b/gi, "fresh")
          .replace(/\bright\s+to\s+your\s+doorstep\b/gi, "across Srinagar")
          .replace(/\bto\s+your\s+doorstep\b/gi, "to your shared location")
          .replace(/\bat\s+your\s+doorstep\b/gi, "at your shared location")
          .replace(/\byour\s+doorstep\b/gi, "your shared location")
          .replace(/\bdoorstep\s+deliver(?:y|ies)\b/gi, "express delivery")
          .replace(/\bstraight\s+to\s+your\s+door\b/gi, "directly to your shared location")
          .replace(/\bto\s+your\s+door\b/gi, "to your shared location")
          .replace(/\bdoorstep\b/gi, "location-based")
          .replace(/\ba\s+(express\b)/gi, "an $1")
          .replace(/\b(?:1\s*kg\s*)?trial\s*pack\b/gi, "fresh live-harvest order")
          .replace(/\btrial\s*pack\b/gi, "order")
          .replace(/\b(?:bureaucrats|officers|IAS|VIPs)\b/gi, "top culinary chefs")
          .replace(/\*\*\s*\*\*/g, "")
          .replace(/\*\*([^\s*](?:[^*\n]*?[^\s*])?)\*\*/g, "*$1*");
        rawReply = rawReply.replace(/\([ \t]*\)/g, "");
        rawReply = rawReply.replace(/[ \t]{2,}/g, " ");
        rawReply = rawReply.replace(/\s+([,.:;!?])/g, "$1");

        // ─── DETERMINISTIC WET-WEATHER POST-PROCESSOR (BOTH >6 KM HOLD & <=6 KM DELAY NOTICE) ───
        const postLocDist = detectedLoc?.status === "IN_ZONE"
          ? detectedLoc.dist
          : (chatMetadata[chatId]?.distanceKm ?? (customerPhone ? chatMetadata[customerPhone]?.distanceKm : null) ?? null);
        const postLocName = detectedLoc?.name || chatMetadata[chatId]?.localityName || (customerPhone ? chatMetadata[customerPhone]?.localityName : null) || "Your Area";
        const postWeatherPolicy = evaluateWeatherDeliveryPolicy(postLocDist);
        const alreadyAdvisedHold = hasRecentWeatherAdvisory(history, postLocName);
        const alreadyGotDelayNotice = hasRecentDelayNotice(history, 4);
        const userSentBriefAck = isBriefAcknowledgement(userMessage);
        const offersDeliveryOrPayment =
          /(?:payments\.cashfree\.com|urbantrout\.in\/p(?:ay)?|\[PAY_LINK|Total Payable|ORDER SUMMARY|express delivery fee|delivery fee|we (?:can|will) deliver|delivery(?:\s+to\s+[^\n]+)?\s+is\s+(?:available|active|possible)|deliver(?:ing|y)? (?:within \d|today|right away|in 2 hours)|dispatch(?:ed|ing)? (?:within|today|right away))/i.test(rawReply) &&
          !/(?:temporarily\s*(?:paused|on\s*hold)|(?:paused|on\s*hold)\s*beyond|not\s*deliver|cannot\s*deliver|unavailable|resumes?\s*automatically|weather\s*clears)/i.test(rawReply);

        const userWantsAdvance = /\b(?:tomorrow|kal|saturday|advance|schedule)\b/i.test(userMessage);
        const isAdvanceOrderCard = /(?:ORDER SUMMARY|payments\.cashfree\.com|urbantrout\.in\/p(?:ay)?|\[PAY_LINK)/i.test(rawReply) && /(?:Tomorrow|Saturday)/i.test(rawReply);
        const isScheduledTomorrowOrSat = !userSentBriefAck && (userWantsAdvance || isAdvanceOrderCard);
        if (!isVisitLocationIntent && !isScheduledTomorrowOrSat) {
          if (postWeatherPolicy.blockedByWeather) {
            if (!alreadyAdvisedHold) {
              if (!/(?:temporarily\s*(?:paused|on\s*hold)|live\s*vending\s*center|weather\s*clears)/i.test(rawReply) || offersDeliveryOrPayment) {
                rawReply = postWeatherPolicy.buildWetWeatherOutOfZoneMessage(postLocName, postLocDist);
              }
            } else if (userSentBriefAck) {
              if (offersDeliveryOrPayment || /(?:Weather Delivery Advisory|Rain Detected|Snowfall Detected)/i.test(rawReply) || (rawReply.length > 260 && /temporarily\s*(?:paused|on\s*hold)\s*beyond/i.test(rawReply))) {
                rawReply = postWeatherPolicy.buildBriefWeatherAckReply(postLocName);
              }
            } else if (offersDeliveryOrPayment || /(?:Weather Delivery Advisory|Rain Detected|Snowfall Detected)/i.test(rawReply)) {
              rawReply = postWeatherPolicy.buildConciseWeatherHoldReminder(postLocName, postLocDist);
            }
          } else if (
            postLocDist !== null &&
            postWeatherPolicy.deliverWithDelayWarning &&
            postWeatherPolicy.delayWarningText &&
            /(?:deliver|express|dispatch|location\s*pin|google\s*maps|payment\s*link|₹\d+)/i.test(rawReply) &&
            !/(?:weather|rain|snow|drizzle|delay)/i.test(rawReply) &&
            (!alreadyGotDelayNotice || /(?:payments\.cashfree\.com|urbantrout\.in\/p(?:ay)?|ORDER SUMMARY|Total Payable)/i.test(rawReply)) &&
            !(userSentBriefAck && alreadyGotDelayNotice)
          ) {
            rawReply = `${rawReply}\n\n${postWeatherPolicy.delayWarningText}`;
          }
        }

        // ─── STRICT LOCATION-FIRST FINAL SAFEGUARD ───
        // Never allow an order summary card or total payable to be delivered without confirmed location
        const isLocConfirmedFinal = isCustomerDeliveryLocationConfirmed({
          remoteJid: chatId,
          cleanPhone: cleanPhone || customerPhone,
          chatHist: [...history, { role: "user", text: userMessage }],
          targetOrder: todayOrderForCustomer || existingOrder
        });
        if (!isLocConfirmedFinal) {
          const hadOrderSummary = /(?:🧾\s*)?(?:URBAN TROUT\s*[•·-]\s*)?(?:Order Summary|ORDER SUMMARY)/i.test(rawReply) ||
                                  /(?:^|\n)\s*[•\-\*]?\s*Total Payable:\s*₹[\d,]+/i.test(rawReply);
          if (hadOrderSummary) {
            console.log(`[Location Guard] Stripped unverified order summary / total payable from reply to ${chatId}`);
            rawReply = stripInlineOrderSummaries(rawReply).trim();
            rawReply = rawReply.replace(/(?:^|\n)\s*[•\-\*]?\s*Total Payable:\s*₹[\d,]+/gi, "");
            rawReply = rawReply.replace(/\n{3,}/g, "\n\n").trim();
            const locAsk = `📍 *To confirm your express delivery:* Which area in Srinagar should we deliver to (e.g. Soura, Lal Chowk, Rajbagh, Hyderpora)? Please share your *WhatsApp Location Pin or Google Maps link* so our Express Dispatch Partner can reach your exact shared location! 🐟`;
            rawReply = rawReply ? `${rawReply}\n\n${locAsk}` : locAsk;
          }
        }

        // ─── STRICT SHIELD: NEVER CLAIM OLD COMPLETED ORDERS ARE ACTIVE / BEING HARVESTED ───
        if (!todayOrderForCustomer) {
          rawReply = rawReply.replace(/Your order \(\*#UT-WA-[A-Za-z0-9\-_]+\*\) is already paid & confirmed![^\n]*/gi, "");
          rawReply = rawReply.replace(/Our (?:Malabagh farm team|team at the Recirculatory Aquaculture System at Malabagh) has it scheduled for fresh live harvest[^\n.]*[.]?/gi, "");
          rawReply = rawReply.replace(/Your order is (?:already )?(?:paid & )?confirmed! Our (?:Malabagh farm team|team at the Recirculatory Aquaculture System at Malabagh) has it scheduled[^\n.]*[.]?/gi, "");
          rawReply = rawReply.replace(/Your (?:live-harvest )?order is (?:already )?confirmed for (?:today|tomorrow)[^\n.]*[.]?/gi, "");
          rawReply = rawReply.replace(/(?:^|\n)[^\n]*rider\s+is\s+on\s+the\s+way[^\n]*/gi, "");
          rawReply = rawReply.replace(/[ \t]{2,}/g, " ").trim();
        }

        // Normalize excessive blank lines (keep max 1 blank line between paragraphs)
        rawReply = rawReply.replace(/\n{3,}/g, "\n\n");

        if (options && typeof options.isAborted === "function" && options.isAborted()) {
          return rawReply;
        }

        // Update history and persist to disk
        history.push({ role: "user", text: userMessage });
        history.push({ role: "model", text: rawReply });
        if (history.length > 16) history.splice(0, history.length - 16);
        chatHistories.set(chatId, history);
        saveChatHistories();

        return rawReply;
      }
    }
  }

  console.error(`[CRITICAL AI OUTAGE] All Gemini models failed for ${chatId}. Sending graceful safety response.`);
  lastActiveGeminiModel = "Safety Fallback (All Models Down)";
  if (options && typeof options.isAborted === "function" && options.isAborted()) {
    return "";
  }
  if (isFirstMessage) {
    const isCustomerSalam = /\b(?:as+al+am[uo]?(?:[\s\-]*[uo])?[\s\-]*[ao]?lai?kum|as+lam[uo]?[\s\-]*[ao]?lai?kum|salam(?:[\s\-]*[uo])?[\s\-]*[ao]?lai?kum|salam|salaam|aoa)\b/i.test(userMessage.trim());
    const greetingPrefix = isCustomerSalam ? `Walaikum Assalam! ${timeOfDayGreeting} ` : `${timeOfDayGreeting} `;
    const fallbackStatusLine = isFridayToday
      ? " (closed Fridays for maintenance — booking advance slots for Saturday morning 8:00 AM+)"
      : isNightAfter9PM
      ? ` (deliveries for tonight closed at 8:00 PM — booking ${isThursdayToday && !isFridayOpen ? "Saturday" : "tomorrow"} morning 8:00 AM+)`
      : isEarlyPreDawn
      ? " (today's morning live harvest starts at 8:00 AM sharp!)"
      : " and delivered across Srinagar within 2 hours!";
    const welcomeFallback = `${greetingPrefix}Welcome to *Urban Trout Aquaculture*! 🐟
Fresh Himalayan Rainbow Trout, harvested live to order from our *Recirculatory Aquaculture System at Malabagh*${fallbackStatusLine}

• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — descaled, zero kitchen mess)
🛵 *Express delivery across Srinagar* (FREE on eligible orders)

Which area in Srinagar are you in, and how many kg would you like?`;
    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: welcomeFallback });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return welcomeFallback;
  }

  // Ongoing chat fallback: Automatically pause AI for 5 minutes so human farm team can take over smoothly!
  humanOverrides.set(chatId, Date.now() + 5 * 60 * 1000);
  console.log(`⏸️ [Auto-Handoff on Fallback] Paused AI for 5m for ${chatId} so human team can take over.`);
  return `Thank you! Our team at the Recirculatory Aquaculture System at Malabagh (*Urban Trout Aquaculture*) has received your message and will assist you in just a moment. 🐟\n\n(Live Vending Center in Malabagh is open 8:00 AM – 8:00 PM Saturday to Thursday)`;
}

// Persistent chat metadata tracking for gentle 60-90 minute follow-ups
const chatMetaFilePath = path.join(__dirname, "chat_metadata.json");
let chatMetadata = {};
if (fs.existsSync(chatMetaFilePath)) {
  try {
    chatMetadata = JSON.parse(fs.readFileSync(chatMetaFilePath, "utf8"));
    let healedCount = 0;
    for (const entry of Object.values(chatMetadata)) {
      if (!entry || typeof entry !== "object") continue;
      const straightKm = (entry.latitude != null && entry.longitude != null)
        ? Number(calculateDistance(FARM_LAT, FARM_LNG, Number(entry.latitude), Number(entry.longitude)).toFixed(1))
        : null;
      if (Number(entry.distanceKm) === 0.2) {
        if (entry.localityName && !/^(?:malabagh|srinagar|kashmir)$/i.test(entry.localityName.trim())) {
          const locMatch = detectSrinagarLocality(entry.localityName);
          if (locMatch && locMatch.status === "IN_ZONE" && locMatch.dist > 0.2) {
            entry.distanceKm = locMatch.dist;
            healedCount++;
          } else if (straightKm !== null && straightKm > 1.2) {
            entry.distanceKm = straightKm;
            healedCount++;
          }
        } else if (straightKm !== null && straightKm > 1.2) {
          const nearest = typeof resolveNearestLocalityName === "function"
            ? resolveNearestLocalityName(Number(entry.latitude), Number(entry.longitude))
            : null;
          if (nearest) entry.localityName = nearest;
          else if (/^malabagh$/i.test(String(entry.localityName || "").trim())) entry.localityName = "Srinagar";
          entry.distanceKm = straightKm;
          healedCount++;
        }
      }
    }
    if (healedCount > 0) {
      console.log(`🩺 [Metadata Self-Heal] Repaired ${healedCount} poisoned 0.2 km locality entries at startup.`);
    }
  } catch (_) {}
}

function saveChatMetadata() {
  const payload = JSON.stringify(chatMetadata);
  const tmpPath = `${chatMetaFilePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, payload, "utf8");
    fs.renameSync(tmpPath, chatMetaFilePath);
  } catch (err) {
    try {
      fs.writeFileSync(chatMetaFilePath, payload, "utf8");
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch (fallbackErr) {
      console.error("Error saving chat metadata:", fallbackErr.message || err.message);
    }
  }
}

// Shared human pause checker (safe across phone keys, LID JIDs, and resolved phone mappings)
function isChatManuallyPaused(jid, phone = null) {
  if (!jid && !phone) return false;
  const cleanP = phone ? String(phone).replace(/\D/g, "") : "";
  const raw10 = cleanP.length >= 10 ? cleanP.slice(-10) : "";
  const resolved = typeof resolveCustomerPhone === "function" && jid ? resolveCustomerPhone(jid) : null;
  const res10 = resolved && String(resolved).replace(/\D/g, "").length >= 10
    ? String(resolved).replace(/\D/g, "").slice(-10)
    : null;
  const now = Date.now();
  for (const k of [jid, phone, cleanP, raw10, resolved, res10]) {
    if (!k) continue;
    const expiry = humanOverrides.get(k);
    if (expiry && now < expiry) return true;
  }
  return false;
}

// Automatic 60-90 Minute Gentle Follow-Up for Inactive Leads (STRICTLY ONE MESSAGE EVER)
let isCheckingFollowUps = false;
async function checkInactiveLeadsFollowUp(sock) {
  if (isCheckingFollowUps) return;
  if (!sock || !sock.user) return;
  if (isAiPausedGlobally) {
    if (aiPauseExpiry > 0 && Date.now() >= aiPauseExpiry) {
      isAiPausedGlobally = false;
      aiPauseExpiry = 0;
    } else {
      return;
    }
  }
  isCheckingFollowUps = true;

  try {
    const now = Date.now();
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    let orders = {};
    if (fs.existsSync(ordersFilePath)) {
      try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
    }

    for (const [chatId, meta] of Object.entries(chatMetadata)) {
      if (!chatId || !chatId.includes("@")) continue;
      const resolvedPhone = resolveCustomerPhone(chatId);
      if (isVvipManualOnly(chatId, resolvedPhone)) continue;
      if (!meta || meta.followUpSent) continue;
      if (meta.lastMsgRole !== "model") continue;
      if (!meta.lastBotMsgTime) continue;

      const elapsedMinutes = (now - meta.lastBotMsgTime) / (60 * 1000);

      if (elapsedMinutes > 1440) {
        meta.followUpSent = true;
        saveChatMetadata();
        continue;
      }

      const isAdLeadChat = /check\s+delivery\s+time\s+to\s+my\s+area/i.test(meta.lastUserText || "");
      const minWaitMins = isAdLeadChat ? 15 : 60;
      if (elapsedMinutes >= minWaitMins && elapsedMinutes <= 1440) {
        const metaDigits = String(meta.phone || resolvedPhone || (chatId.includes("@s.whatsapp.net") ? chatId.split("@")[0] : "")).replace(/\D/g, "");
        const cleanPhone = metaDigits.length >= 10 && !/^\d{14,}$/.test(metaDigits) ? metaDigits.slice(-10) : "";

        // Skip if human override is active on JID, phone, or resolved mapping
        if (isChatManuallyPaused(chatId, cleanPhone)) continue;

        // Skip if customer already placed/paid an order today (Dynamic Order Pool check)
        const todayOrd = TodayOrderPool.getTodayOrder(cleanPhone, chatId);
        if (todayOrd) {
          if (TodayOrderPool.isOrderPaid(todayOrd) || isOrderDeliveredOrClosed(todayOrd)) {
            meta.followUpSent = true;
            saveChatMetadata();
            continue;
          }
          const linkAgeMin = (now - new Date(todayOrd.createdAt || todayOrd.updatedAt || 0).getTime()) / (60 * 1000);
          if (linkAgeMin >= 0 && linkAgeMin < 240) {
            continue;
          }
        }
        const order = (cleanPhone && orders[cleanPhone]) || findActiveCustomerOrder(orders, cleanPhone, chatId);
        if (order && (isOrderActiveAndPaid(order) || isOrderDeliveredOrClosed(order))) {
          meta.followUpSent = true;
          saveChatMetadata();
          continue;
        }

        // Skip if customer conversation was an explicit outside-zone refusal (>16km) or declined
        const history = chatHistories.get(chatId) || [];
        const allHistoryText = history.map(h => h.text || "").join(" ");
        const userHistoryText = history
          .filter(h => h && h.role === "user" && !isSyntheticSystemNote(h.text))
          .map(h => h.text || "")
          .join(" ");

        const isRefusedOutside =
          (meta.distanceKm !== null && meta.distanceKm !== undefined && meta.distanceKm > 16.0) ||
          /(?:outside\s+(?:our\s+)?(?:5|6|8|16)\s*km|outside\s+delivery\s+perimeter|outside\s+delivery\s+zone|not\s+available\s+for\s+your\s+location|limited\s+to\s+16\s*km)/i.test(allHistoryText);

        if (isRefusedOutside) {
          meta.followUpSent = true;
          saveChatMetadata();
          continue;
        }

        const isDeclined =
          meta.declined === true ||
          meta.autoResponder === true ||
          /\b(?:no\s*need|no\s*thanks?|not\s*now|cancel\s*(?:it|order)?|nahi\s*chahiye|na\s*bhejo|mat\s*bhejo|expensive|mehenga|khareed\s*liya|already\s*(?:bought|ordered|taken)|don'?t\s*send|rehne\s*do|nahi\s*lena)\b/i.test(userHistoryText);

        if (isDeclined) {
          meta.followUpSent = true;
          saveChatMetadata();
          continue;
        }

        // Real-time IST Clock for Follow-ups
        const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const istHour = istDate.getHours();

        // Friday bio-security closure: skip unless #friday on override is active
        if (istDate.getDay() === 5 && !isFridayOperationsOpen()) {
          continue;
        }

        // Sleep protection: DO NOT send automated follow-up pings after closing hours (8:00 PM to 8:00 AM IST)
        if (istHour >= 20 || istHour < 8) {
          continue;
        }

        const isDaytime = istHour >= 8 && istHour < 20;
        const followUpText = isDaytime
          ? "Hello! Just checking in to see if you would like us to reserve a fresh live-harvest slot for you today, or if you would like to visit our Live Vending Center in Malabagh. 🐟\n\n(No rush at all—we are always here whenever you crave fresh trout!)"
          : "Hello! Just checking in to see if you would like us to reserve a fresh live-harvest delivery slot for you tomorrow (Morning: 8–11 AM, Afternoon: 12–3 PM, or Evening: 4–7 PM), or visit our Live Vending Center in Malabagh tomorrow. 🐟\n\n(No rush at all—we are always here whenever you crave fresh trout!)";

        try {
          await sock.sendPresenceUpdate("composing", chatId).catch(() => {});
          await new Promise(r => setTimeout(r, 1200));
          await sock.sendMessage(chatId, { text: followUpText });
          await sock.sendPresenceUpdate("available", chatId).catch(() => {});

          meta.followUpSent = true;
          meta.followUpSentAt = new Date().toISOString();
          if (cleanPhone && chatMetadata[cleanPhone]) {
            chatMetadata[cleanPhone].followUpSent = true;
            chatMetadata[cleanPhone].followUpSentAt = meta.followUpSentAt;
          }
          if (resolvedPhone && chatMetadata[resolvedPhone]) {
            chatMetadata[resolvedPhone].followUpSent = true;
            chatMetadata[resolvedPhone].followUpSentAt = meta.followUpSentAt;
          }
          saveChatMetadata();

          history.push({ role: "model", text: followUpText });
          chatHistories.set(chatId, history);
          saveChatHistories();

          const istDateStr = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
          const istTimeStr = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
          const custName = meta.pushName || "Customer";
          const locStr = meta.localityName || "Srinagar";

          console.log(`\n┌──────────────────────────────────────────────────────────────────────────`);
          console.log(`│ ⏳ [AUTOMATED GENTLE FOLLOW-UP] 📅 ${istDateStr} • ⏰ ${istTimeStr}`);
          console.log(`│ 👤 Name: ${custName} | 📞 Phone: ${formatPhoneDisplay(cleanPhone)} | 📍 Area: ${locStr}`);
          console.log(`│ ⌛ Inactivity: ~${elapsedMinutes.toFixed(0)} mins | Message: Single 1-Hour Gentle Nudge`);
          console.log(`│ 📤 Follow-Up: "${followUpText.replace(/\n+/g, ' ')}"`);
          console.log(`└──────────────────────────────────────────────────────────────────────────\n`);
        } catch (sendErr) {
          console.error(`Failed to send follow-up to ${chatId}:`, sendErr.message);
        }
      } else if (elapsedMinutes > 1440) {
        meta.followUpSent = true;
        saveChatMetadata();
      }
    }
  } catch (err) {
    console.error("Error in follow-up check:", err.message);
  } finally {
    isCheckingFollowUps = false;
  }
}

let pollInterval = null;
let paymentInterval = null;
let followUpInterval = null;
let nightlyReportInterval = null;
let weatherInterval = null;
let contactsExportInterval = null;
let pollLoopEpoch = 0;
let isSendingNightlyReport = false;

// Nightly 8:00 PM Telegram Executive Briefing Scheduler (closing time)
async function checkNightlyReportSchedule() {
  if (isSendingNightlyReport) return;
  try {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + istOffset);
    const hour = istDate.getUTCHours();
    const minute = istDate.getUTCMinutes();
    const todayStr = istDate.toISOString().split("T")[0];

    // Trigger daily briefing between 20:00 (8:00 PM) and 20:15 IST
    if (hour === 20 && minute >= 0 && minute <= 15) {
      const statePath = path.join(__dirname, "last_nightly_report.json");
      let alreadySent = false;
      if (fs.existsSync(statePath)) {
        try {
          const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
          if (state.lastSentDate === todayStr) {
            alreadySent = true;
          }
        } catch (_) {}
      }

      if (!alreadySent) {
        isSendingNightlyReport = true;
        try {
          try {
            console.log(`\n👥 [8:00 PM NIGHTLY CHAT SCAN] Scanning all chats & daily archive for customer names & locations...`);
            const enrichedContacts = enrichContactsFromChats({ updateMetadata: true, silent: false });
            const withLocCount = Array.isArray(enrichedContacts) ? enrichedContacts.filter(c => c.customerName && c.area && c.area !== "Srinagar").length : 0;
            console.log(`✅ [8:00 PM Contact Sync] Synced ${Array.isArray(enrichedContacts) ? enrichedContacts.length : 0} contacts (${withLocCount} formatted as "Name - Location").`);
          } catch (scanErr) {
            console.error("Error in 8:00 PM nightly chat contact scan:", scanErr.message);
          }
          console.log(`\n📊 [8:00 PM NIGHTLY BRIEFING TRIGGERED] Compiling and dispatching executive briefing for ${todayStr}...`);
          await sendNightlyBriefing(todayStr);
        } finally {
          isSendingNightlyReport = false;
        }
      }
    }
  } catch (err) {
    console.error("Error in nightly report schedule check:", err.message);
  }
}

// ─── DIRECT SCANNER / QR INTERCEPT HELPER FUNCTIONS ───
function isExplicitQrScannerAsk(userText = "") {
  if (!userText) return false;
  const clean = String(userText || "").trim();
  if (clean.length > 180) return false;
  if (/\b(?:already\s+paid|paid\s+(?:via|through|by)\s*(?:qr|upi|gpay|phonepe|paytm)|payment\s*(?:done|sent|made|completed)|not\s+via\s+qr)\b/i.test(clean)) {
    return false;
  }
  const isAskingAccountDetails = /\b(?:account\s*(?:no|num|number|details)|bank\s*transfer|ifsc|direct\s*transfer|khata\s*(?:no|number)|mpay\s*(?:no|num|number|details|account))\b/i.test(clean);
  if (isAskingAccountDetails) return false;

  return /\b(?:(?:do\s*you|did\s*you|u|if\s*(?:you|u))\s*have\s*(?:a\s*)?(?:qr|scanner|barcode)|(?:send|bhej|bhejo|share|give|provide|want|need|chahiye)\s*(?:me\s*)?(?:a\s*|the\s*)?(?:qr|qr\s*code|scanner|barcode)|(?:qr\s*code|qr|scanner|barcode)\s*(?:bhejo|bhej|send|please|plz|photo|image|pic|code|hai|chahiye|available|milega|\?)?|(?:pay|scan)\s*(?:via|through|using|by|with|karke)?\s*(?:qr|scanner|barcode)|scan\s*(?:and|&|n)\s*pay)\b/i.test(clean);
}

function isCustomerRequestingQr(userText, chatHist = []) {
  if (!userText) return false;
  const clean = userText.trim();

  // 0. Exclude quoted bot messages, long echoes, or "already paid" payment confirmations
  if (
    /\b(?:shall\s+i\s+send|pan-ready\s*steaks|we\s+deliver\s+express|delivery\s+is\s+100%\s+free|cold-water\s+tanks|harvest\s+queue|urban\s*trout|already\s+paid|paid\s+(?:via|through|by)\s*(?:qr|upi|gpay|phonepe|paytm)|payment\s*(?:done|sent|made|completed))\b/i.test(clean) ||
    clean.length > 180
  ) {
    return false;
  }

  // 0a. Account Number / Bank Transfer exemption (handled by AI / mPay intent decoder)
  const isAskingAccountDetails = /\b(?:account\s*(?:no|num|number|details)|bank\s*transfer|ifsc|direct\s*transfer|khata\s*(?:no|number)|mpay\s*(?:no|num|number|details|account)|m-pay\s*(?:no|num|number|details|account)|(?:google\s*pay|gpay|phonepe)\s*(?:number|no|num))\b/i.test(clean);
  if (isAskingAccountDetails) return false;

  // 0a-2. Explicit QR / Scanner requests ("if you have QR", "do you have QR", "send scanner", "QR please") -> ALWAYS route to HDFC SmartHub QR!
  if (isExplicitQrScannerAsk(clean)) return true;

  // 0b. General payment question or failure exemption -> Pass to Gemini to answer properly!
  const isQuestionOrProblem = /\b(?:do\s*you\s*(?:accept|take|have)|is\s*(?:it|there|upi|gpay|phonepe|cash|online)|kya\s*(?:upi|gpay|phonepe|cash|online)|accept\s*kart?e|chalega|chalta\s*hai|available|possible|failed|error|rejected|decline|nahi\s*chal\s*raha|dont\s*have|not\s*have|later|baad\s*mein|cash\s*on\s*delivery|cod)\b/i.test(clean);
  if (isQuestionOrProblem && !/\b(?:send|bhej|share)\s*(?:qr|scanner|link)\b/i.test(clean)) {
    return false;
  }

  // 1. Explicit Direct Actionable Request for QR / Scanner / Payment Link
  const directRegex = /\b(?:(?:send|bhej|bhejo|share|give|provide)\s*(?:me\s*)?(?:the\s*)?(?:qr|scanner|barcode|upi|gpay|phonepe|paytm|payment\s*link)|(?:scanner|qr\s*code|qr)\s*(?:bhejo|bhej|send|please|plz|photo|image|pic|code|hai|\?)?|pay\s*(?:via|through|using)\s*(?:qr|scanner|upi|gpay|phonepe|paytm)|how\s*to\s*pay|kaise\s*pay\s*(?:kare|karein|karna)|kahan\s*pay\s*(?:kare|karein|karna)|payment\s*(?:link|qr|scanner|karna\s*hai))\b/i;
  if (directRegex.test(clean)) return true;

  // 2. Affirmative reply ("Yes", "Sure", "Bhejo", "Ok", etc.) after bot offered unpaid scanner or order summary
  const affirmativeRegex = /^(?:yes|yep|yeah|sure|ok|okay|please|haan|han|hanji|bhejo|send|send\s*it|karo|bhej\s*do|bhej|send\s*please|plz|yes\s*please|done)\b/i;
  if (affirmativeRegex.test(clean) && Array.isArray(chatHist) && chatHist.length > 0) {
    const lastBotMsg = chatHist.filter(m => m.role === "model").pop();
    if (lastBotMsg && lastBotMsg.text) {
      const isConfirmationReceipt = /\b(?:Payment\s+Received|Order\s+Confirmed|OUT\s+FOR\s+DELIVERY|successfully\s+delivered)\b/i.test(lastBotMsg.text);
      const offeredPayment = !isConfirmationReceipt && /\b(?:scanner|qr|qr\s*code|payments\.cashfree\.com|urbantrout\.in\/p(?:ay)?|order\s*summary|total\s*payable|payment\s*link)\b/i.test(lastBotMsg.text);
      if (offeredPayment) return true;
    }
  }

  return false;
}

// Shared helper to parse quick owner order commands (#link 2kg +149, #2kg +149, #qr 2kg +149, #paid 2kg +200, #paid 2kg, #Paid 1000, etc.)
function parseQuickOrderParams(text, defaultPhone = null, { defaultWeightIfMissing = null } = {}) {
  const sanitizedCmd = String(text || "")
    .replace(/\bUT-[A-Z0-9-]+\b/gi, " ")
    .replace(/,/g, "");

  let deliveryFee = 0;
  const plusDelMatch = sanitizedCmd.match(/\+\s*(?:delivery|del|charge|charges|fee)?\s*(?:charge|charges|fee)?\s*(?:rs\.?|inr|₹)?\s*(\d+)\b/i);
  const delFeeMatch = sanitizedCmd.match(/\b(?:delivery|del|d|shipping|charge|charges|fee)\b\s*(?:fee|charges?)?\s*(?:is|=|:|\+)?\s*(?:rs\.?|inr|₹)?\s*(\d+)\b(?!\s*(?:kg|kilos?|kgs|feet|ft|sector|phase|lane|st|road|rd|floor|pin|days?))/i);
  const numDelFeeMatch = sanitizedCmd.match(/\b(\d+)\s*(?:rs\.?|inr|₹)?\s*(?:delivery|del|shipping|charges?|fee)\b/i);

  if (plusDelMatch) {
    deliveryFee = parseInt(plusDelMatch[1], 10) || 0;
  } else if (delFeeMatch) {
    deliveryFee = parseInt(delFeeMatch[1], 10) || 0;
  } else if (numDelFeeMatch) {
    deliveryFee = parseInt(numDelFeeMatch[1], 10) || 0;
  }

  // Strip 10-digit phones, explicit +fees, and command keywords before extracting weight/flat amount
  const withoutPhonesAndPlusFees = sanitizedCmd
    .replace(/\b[6-9]\d{9}\b/g, " ")
    .replace(/\+\s*(?:delivery|del|charge|charges|fee)?\s*(?:charge|charges|fee)?\s*(?:rs\.?|inr|₹)?\s*\d+\b/gi, " ")
    .replace(/\b(?:delivery|del|d|shipping|charge|charges|fee)\b\s*(?:fee|charges?)?\s*(?:is|=|:|\+)?\s*(?:rs\.?|inr|₹)?\s*\d+\b/gi, " ")
    .replace(/\b\d+\s*(?:rs\.?|inr|₹)?\s*(?:delivery|del|shipping|charges?|fee)\b/gi, " ");

  // Parse weight: matches e.g. 2kg, 2 kg, 2.5kg, 3 kilos, or #2 +89 (excluding +fee, 10-digit phones, road/feet numbers)
  let weightKg = null;
  const weightMatchWithUnit = withoutPhonesAndPlusFees.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\b/i);
  if (weightMatchWithUnit) {
    weightKg = Math.round(parseFloat(weightMatchWithUnit[1]) * 100) / 100;
  } else {
    // Only treat a bare number <= 50 as weight when there's no flat >=300 total amount right next to command
    const candidateSmall = withoutPhonesAndPlusFees.match(/#?\s*(?:qr|scanner|link|order|pay|paid|confirm)?\s*(\d+(?:\.\d+)?)\b(?!\s*(?:feet|ft|sector|phase|lane|st|road|rd|floor|pin|days?))/i);
    if (candidateSmall) {
      const val = parseFloat(candidateSmall[1]);
      if (val > 0 && val <= 50) {
        weightKg = Math.round(val * 100) / 100;
      }
    }
  }

  // Extract flat custom total amount:
  // - With explicit weight (e.g. #paid 2kg 1000): only treat >= 600 as flat agreed total (30..599 remains standalone fee e.g. #2kg 149)
  // - Without weight (e.g. #Paid 1000, #paid 9876543210 1259, #qr 1740): treat any >= 300 as flat total
  let directTotalAmount = null;
  const withoutWeights = withoutPhonesAndPlusFees
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|kilos?|kgs)\b/gi, " ")
    .replace(/#\s*(?:qr|scanner|link|pay|order|amount|total|paid|confirm)?/gi, " ");
  const minDirectThreshold = weightKg ? 600 : 300;
  const flatMatches = withoutWeights.matchAll(/(?:rs\.?|inr|₹)?\s*(\d{3,6})\b(?!\s*(?:feet|ft|sector|phase|lane|st|road|rd|floor|pin|days?)\b)/gi);
  for (const m of flatMatches) {
    const val = parseInt(m[1], 10);
    if (val >= minDirectThreshold && val <= 100000) {
      directTotalAmount = val;
      break;
    }
  }

  if (!weightKg && !directTotalAmount && defaultWeightIfMissing) {
    weightKg = defaultWeightIfMissing;
  }

  // Fallback standalone delivery fee if owner typed e.g. "#2kg 149" or "#paid 2kg 200" without '+' sign
  if (deliveryFee === 0 && weightKg && !directTotalAmount) {
    const stripped = withoutWeights
      .replace(new RegExp(`\\b${weightKg}\\b`, "gi"), " ");
    const standaloneFee = stripped.match(/\b([3-9]\d|[1-5]\d{2})\b(?!\s*(?:feet|ft|sector|phase|lane|st|road|rd|floor|pin|days?))/i);
    if (standaloneFee) {
      deliveryFee = parseInt(standaloneFee[1], 10) || 0;
    }
  }

  // Cut type: Whole vs Gutted (Cleaned & Gutted is default Hero Product)
  const isWhole = /\b(?:whole|sabut)\b/i.test(text);
  const rate = isWhole ? 540 : 580;
  const prodType = isWhole ? "Whole Fresh Trout" : "Cleaned & Gutted (Pan-ready)";
  const shortProdType = isWhole ? "Whole Fresh Trout" : "Cleaned & Gutted";

  let totalAmount = null;
  let itemDesc = null;

  if (directTotalAmount) {
    totalAmount = directTotalAmount;
    if (weightKg) {
      itemDesc = `${weightKg} kg ${prodType}${deliveryFee > 0 ? ` (+₹${deliveryFee} Express Delivery)` : ""}`;
    } else {
      itemDesc = `${prodType} Order`;
    }
  } else if (weightKg) {
    const fishTotal = Math.round(weightKg * rate);
    totalAmount = fishTotal + deliveryFee;
    itemDesc = `${weightKg} kg ${prodType}${deliveryFee > 0 ? ` (+₹${deliveryFee} Express Delivery)` : ""}`;
  }

  // 10-digit customer phone
  let explicitPhone = null;
  let targetCustPhone = null;
  const phoneMatch = sanitizedCmd.match(/\b([6-9]\d{9})\b/);
  if (phoneMatch) {
    explicitPhone = phoneMatch[1];
    targetCustPhone = phoneMatch[1];
  } else if (defaultPhone && defaultPhone.length >= 10) {
    targetCustPhone = defaultPhone.slice(-10);
  }

  // Customer / Area Notes
  let notesText = sanitizedCmd
    .replace(/#\s*(?:qr|scanner|link|order|pay|amount|total|paid|confirm)?/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|kilos?|kgs)\b/gi, "")
    .replace(/\b(?:cleaned|gutted|whole|sabut|kg|kilos?|kgs)\b/gi, "")
    .replace(/\b[6-9]\d{9}\b/g, "")
    .replace(/\+\s*(?:delivery|del|charge|charges|fee)?\s*(?:rs\.?|inr|₹)?\s*\d+\s*(?:rs\.?|inr|₹)?/gi, "")
    .replace(/(?:delivery|del|d|shipping|charge|charges|fee)\s*(?:fee|charges?)?\s*(?:is|=|:|\+)?\s*(?:rs\.?|inr|₹)?\s*\d+/gi, "")
    .replace(/\b\d+\s*(?:rs\.?|inr|₹)?\s*(?:delivery|del|shipping|charge|charges|fee)\b/gi, "")
    .replace(/\b(?:delivery|charge|charges|fee|shipping|express)\b/gi, "")
    .replace(/\b([3-9]\d|[1-5]\d{2})\b/g, "")
    .replace(/\b\d{3,6}\b/g, "")
    .replace(/[+*#$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (weightKg && notesText === String(weightKg)) {
    notesText = "";
  }

  const targetCustName = notesText.length > 1
    ? notesText
    : (targetCustPhone ? `Customer (+91 ${targetCustPhone})` : "Valued Customer");

  return {
    explicitPhone,
    deliveryFee,
    directTotalAmount,
    weightKg,
    isWhole,
    rate,
    prodType,
    shortProdType,
    totalAmount,
    itemDesc,
    targetCustPhone,
    targetCustName,
    notesText
  };
}

// Parse amount, items, delivery fee & order ref from any WhatsApp QR / 1-Tap Link / Summary caption
function parsePaymentMessageSnapshot(rawText = "") {
  const txt = String(rawText || "").replace(/\*/g, "");
  if (!txt) return null;

  const amtMatch =
    txt.match(/(?:Amount|Total Payable|Total)\s*:\s*₹?\s*([\d,]{3,7})\b/i) ||
    txt.match(/\[(?:HDFC SmartHub QR|1-Tap Payment Link|Bank Details)\s+₹\s*([\d,]{3,7})\]/i);
  const amount = amtMatch ? parseInt(amtMatch[1].replace(/,/g, ""), 10) : null;

  const itemMatch = txt.match(/^\s*[•\-*]?\s*(?:Order|Items?)\s*:\s*([^\n\r]+)/im);
  const items = itemMatch ? itemMatch[1].trim() : null;

  const feeMatch = txt.match(/Delivery Fee\s*:\s*\+?\s*₹?\s*(\d+)/i) || txt.match(/\(\s*\+\s*₹?\s*(\d+)\s*(?:Express\s+|Special\s+)?Delivery\s*\)/i);
  const deliveryFee = feeMatch ? parseInt(feeMatch[1], 10) : 0;

  const refMatch = txt.match(/\b(UT-[A-Z0-9-]+)\b/i);
  const orderRef = refMatch ? refMatch[1].toUpperCase() : null;

  const isHdfcQr = /HDFC SMARTHUB|HDFC SmartHub QR|Scan this Locked Amount QR/i.test(txt);
  const isCashfree = /1-TAP PAYMENT LINK|urbantrout\.in\/p\/|payments\.cashfree\.com/i.test(txt);

  if (!amount && !items && !orderRef) return null;
  return { amount, items, deliveryFee, orderRef, isHdfcQr, isCashfree };
}

// Infer clean standard catalog weight ONLY when an exact price matches a whole/half-kg cut
function inferExactCatalogItemForFlatAmount(paidAmt) {
  const n = Number(paidAmt);
  if (!n || n <= 0) return null;
  const standardWeights = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 10];
  for (const w of standardWeights) {
    if (Math.round(w * 580) === n) return `${w} kg Cleaned & Gutted`;
  }
  for (const w of standardWeights) {
    if (Math.round(w * 540) === n) return `${w} kg Whole Fresh Trout`;
  }
  return null;
}

// Resolve exact paidAmt, itemsDesc, deliveryFee, orderRef & gateway for #paid / $paid commands
function resolveManualPaidOrderDetails({ cmdText, targetPhone, targetJid, orders = {}, chatHist = [], quotedText = "" }) {
  const parsed = parseQuickOrderParams(cmdText, targetPhone, { defaultWeightIfMissing: null });
  const cmdRefMatch = String(cmdText || "").match(/\b(UT-[A-Z0-9-]+)\b/i);
  const cmdRef = cmdRefMatch ? cmdRefMatch[1].toUpperCase() : null;
  const quotedSnap = parsePaymentMessageSnapshot(quotedText);

  const histSnaps = [];
  if (Array.isArray(chatHist)) {
    for (let i = chatHist.length - 1; i >= 0; i--) {
      if (chatHist[i]?.role !== "model") continue;
      const snap = parsePaymentMessageSnapshot(chatHist[i].text);
      if (snap && (snap.amount || snap.orderRef)) histSnaps.push(snap);
    }
  }

  // Build ordered candidate orders matching targetRef, targetPhone, or targetJid
  const allMatchedOrders = [];
  for (const o of Object.values(orders || {})) {
    if (!o) continue;
    const oPhone10 = String(o.phone || "").replace(/\D/g, "").slice(-10);
    const phoneOk = targetPhone && oPhone10 === targetPhone;
    const jidOk = targetJid && o.chatId === targetJid;
    if (phoneOk || jidOk || (cmdRef && o.orderRef?.toUpperCase() === cmdRef)) {
      allMatchedOrders.push(o);
    }
    if (Array.isArray(o.pastOrders) && (phoneOk || jidOk)) {
      for (let idx = o.pastOrders.length - 1; idx >= 0; idx--) {
        if (o.pastOrders[idx]) allMatchedOrders.push(o.pastOrders[idx]);
      }
    }
  }

  const preferredRef = cmdRef || quotedSnap?.orderRef || null;
  let existingOrder = (preferredRef && allMatchedOrders.find(o => o.orderRef?.toUpperCase() === preferredRef)) ||
    allMatchedOrders.find(o => !isOrderDeliveredOrClosed(o) && !o.status?.includes("Paid")) ||
    allMatchedOrders.find(o => !isOrderDeliveredOrClosed(o)) ||
    allMatchedOrders[0] ||
    null;

  const parseOrderAmt = (ord) => {
    if (!ord?.amount) return 0;
    const m = String(ord.amount).replace(/,/g, "").match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };

  let paidAmt = 0;
  let itemsDesc = "";
  let effectiveDeliveryFee = 0;
  let matchedSnap = null;
  let orderRef = null;

  if (parsed.weightKg) {
    // Explicit weight specified in #paid (#paid 2kg +200, #paid 2kg, #paid 2kg 1000, #paid 3kg whole +149)
    paidAmt = parsed.totalAmount || Math.round(parsed.weightKg * parsed.rate) + parsed.deliveryFee;
    effectiveDeliveryFee = parsed.deliveryFee || 0;
    itemsDesc = `${parsed.weightKg} kg ${parsed.shortProdType}${effectiveDeliveryFee > 0 ? ` (+₹${effectiveDeliveryFee} Express Delivery)` : ""}`;
    matchedSnap = [quotedSnap, ...histSnaps].find(s => s && s.amount && Math.abs(s.amount - paidAmt) <= 2) || null;
    if (preferredRef) {
      orderRef = preferredRef;
    } else if (matchedSnap?.orderRef) {
      orderRef = matchedSnap.orderRef;
    } else if (existingOrder && !existingOrder.status?.includes("Paid") && !isOrderDeliveredOrClosed(existingOrder)) {
      orderRef = existingOrder.orderRef;
    }
  } else if (parsed.directTotalAmount) {
    // Flat amount ONLY in #paid (#Paid 1000, #paid 1299, #paid 1740)
    paidAmt = parsed.directTotalAmount;
    matchedSnap = [quotedSnap, ...histSnaps].find(s => s && s.amount && Math.abs(s.amount - paidAmt) <= 2) || null;
    const exactAmtOrder = allMatchedOrders.find(o => {
      const a = parseOrderAmt(o);
      return a > 0 && Math.abs(a - paidAmt) <= 2;
    }) || null;

    if (matchedSnap) {
      itemsDesc = matchedSnap.items || exactAmtOrder?.items || inferExactCatalogItemForFlatAmount(paidAmt) || "Fresh Trout Order (Agreed Total)";
      effectiveDeliveryFee = matchedSnap.deliveryFee || 0;
      if (effectiveDeliveryFee > 0 && itemsDesc && !/\bdelivery\b/i.test(itemsDesc)) {
        itemsDesc = `${itemsDesc} (+₹${effectiveDeliveryFee} Express Delivery)`;
      }
      orderRef = preferredRef || matchedSnap.orderRef || exactAmtOrder?.orderRef || null;
      if (exactAmtOrder) existingOrder = exactAmtOrder;
    } else if (exactAmtOrder) {
      existingOrder = exactAmtOrder;
      itemsDesc = exactAmtOrder.items || inferExactCatalogItemForFlatAmount(paidAmt) || "Fresh Trout Order";
      effectiveDeliveryFee = Number(exactAmtOrder.deliveryFee) || 0;
      orderRef = preferredRef || (!exactAmtOrder.status?.includes("Paid") ? exactAmtOrder.orderRef : null);
    } else {
      effectiveDeliveryFee = 0;
      itemsDesc = inferExactCatalogItemForFlatAmount(paidAmt) || "Fresh Trout Order (Agreed Total)";
      orderRef = preferredRef || (existingOrder && !existingOrder.status?.includes("Paid") && !isOrderDeliveredOrClosed(existingOrder) ? existingOrder.orderRef : null);
    }
  } else {
    // Plain #paid / $paid (relying on quoted message, active unpaid order, or newest QR/link in chat)
    const fallbackSnap = quotedSnap || histSnaps[0] || null;
    const existingAmt = parseOrderAmt(existingOrder);
    if (quotedSnap && quotedSnap.amount) {
      matchedSnap = quotedSnap;
      paidAmt = quotedSnap.amount;
      itemsDesc = quotedSnap.items || existingOrder?.items || inferExactCatalogItemForFlatAmount(paidAmt) || "Fresh Trout Order";
      effectiveDeliveryFee = quotedSnap.deliveryFee || 0;
      if (effectiveDeliveryFee > 0 && itemsDesc && !/\bdelivery\b/i.test(itemsDesc)) {
        itemsDesc = `${itemsDesc} (+₹${effectiveDeliveryFee} Express Delivery)`;
      }
      orderRef = quotedSnap.orderRef || existingOrder?.orderRef || null;
    } else if (existingOrder && !isOrderDeliveredOrClosed(existingOrder) && existingAmt > 0) {
      paidAmt = existingAmt;
      itemsDesc = existingOrder.items || inferExactCatalogItemForFlatAmount(paidAmt) || "Fresh Trout Order";
      effectiveDeliveryFee = Number(existingOrder.deliveryFee) || 0;
      orderRef = existingOrder.orderRef || null;
    } else if (fallbackSnap && fallbackSnap.amount) {
      matchedSnap = fallbackSnap;
      paidAmt = fallbackSnap.amount;
      itemsDesc = fallbackSnap.items || inferExactCatalogItemForFlatAmount(paidAmt) || "Fresh Trout Order";
      effectiveDeliveryFee = fallbackSnap.deliveryFee || 0;
      orderRef = fallbackSnap.orderRef || null;
    } else {
      paidAmt = 1160;
      itemsDesc = "2 kg Cleaned & Gutted";
      effectiveDeliveryFee = 0;
      orderRef = existingOrder && !existingOrder.status?.includes("Paid") ? existingOrder.orderRef : null;
    }
  }

  if (!orderRef) {
    orderRef = `UT-WA-${Date.now().toString().slice(-8)}`;
  }

  const refMatchedOrder = allMatchedOrders.find(o => o.orderRef === orderRef) || existingOrder;
  const isHdfcPayment = Boolean(
    matchedSnap?.isHdfcQr ||
    (!matchedSnap?.isCashfree && (
      refMatchedOrder?.paymentGateway?.toLowerCase().includes("hdfc") ||
      /hdfc|vyapar|qr/i.test(refMatchedOrder?.status || "") ||
      refMatchedOrder?.upiVpa === HDFC_COUNTER_VPA
    ))
  );

  return {
    parsed,
    existingOrder: refMatchedOrder,
    paidAmt,
    itemsDesc,
    effectiveDeliveryFee,
    orderRef,
    isHdfcPayment
  };
}

async function startBot() {
  const authDir = path.join(__dirname, "auth_info_baileys");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  let waVersion;
  try {
    const latest = await fetchLatestBaileysVersion();
    if (latest && latest.version) waVersion = latest.version;
  } catch (vErr) {
    console.warn("Notice: fetchLatestBaileysVersion failed, using Baileys built-in version:", vErr.message);
  }

  const sock = makeWASocket({
    ...(waVersion ? { version: waVersion } : {}),
    logger: pino({ level: "silent" }),
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false
  });

  // Intercept sock.sendMessage to record message IDs sent by bot to prevent false human override triggers
  const originalSendMessage = sock.sendMessage.bind(sock);
  sock.sendMessage = async (targetJid, content, ...rest) => {
    // HARD VVIP SHIELD: Never send any automated text to VVIP IAS Officer (9419153353)
    if (isVvipManualOnly(targetJid)) {
      console.log(`⛔ [VVIP MANUAL-ONLY SHIELD] Blocked outgoing automated message to ${targetJid} (IAS Officer 9419153353). Manual chat only!`);
      return null;
    }
    // Universal JID normalization: prevent Baileys jidDecode crash if a plain phone number is passed
    let normalizedJid = targetJid;
    if (normalizedJid && typeof normalizedJid === "string" && !normalizedJid.includes("@")) {
      const digits = normalizedJid.replace(/\D/g, "");
      if (digits.length >= 14) {
        console.warn(`[sock.sendMessage] Blocked invalid plain LID string without @lid: "${targetJid}"`);
        return null;
      } else if (digits.length >= 10) {
        normalizedJid = digits.length === 10 ? `91${digits}@s.whatsapp.net` : `${digits}@s.whatsapp.net`;
      } else {
        console.warn(`[sock.sendMessage] Skipped invalid recipient without JID suffix: "${targetJid}"`);
        return null;
      }
    }
    if (!normalizedJid || typeof normalizedJid !== "string" || !normalizedJid.includes("@")) {
      console.warn(`[sock.sendMessage] Invalid JID skipped: "${targetJid}"`);
      return null;
    }
    const sent = await originalSendMessage(normalizedJid, content, ...rest);
    if (sent && sent.key && sent.key.id) {
      botSentMessageIds.add(sent.key.id);
      setTimeout(() => botSentMessageIds.delete(sent.key.id), 10 * 60 * 1000);
    }
    return sent;
  };

  sock.ev.on("creds.update", saveCreds);

  // Sync WhatsApp contact names and pushNames automatically into contacts map
  sock.ev.on("contacts.upsert", (contacts) => {
    try {
      if (Array.isArray(contacts)) {
        for (const contact of contacts) {
          const jid = contact.id;
          const name = contact.notify || contact.verifiedName || contact.name;
          if (jid && name) {
            saveWhatsAppContact(jid, name);
          }
        }
      }
    } catch (_) {}
  });

  sock.ev.on("contacts.update", (updates) => {
    try {
      if (Array.isArray(updates)) {
        for (const update of updates) {
          const jid = update.id;
          const name = update.notify || update.verifiedName || update.name;
          if (jid && name) {
            saveWhatsAppContact(jid, name);
          }
        }
      }
    } catch (_) {}
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📲 SCAN QR CODE TO CONNECT (Saved to qr.html)\n");
      qrcodeTerminal.generate(qr, { small: true });

      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 400, margin: 2 });
        const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="4"><title>Urban Trout WhatsApp Login</title></head><body style="background:#031018;color:#dfedf9;font-family:sans-serif;text-align:center;padding-top:40px;"><div style="display:inline-block;padding:24px;border-radius:16px;background:#061a26;border:2px solid #00d2ff;box-shadow:0 0 25px rgba(0,210,255,0.3);"><h2 style="color:#00d2ff;margin-top:0;">Scan with WhatsApp</h2><img src="${qrDataUrl}" width="320" height="320" style="border-radius:8px;"/><p style="font-size:16px;font-weight:bold;margin:15px 0 5px;">Settings ➔ Linked Devices ➔ Link a Device</p><p style="color:#72ddfd;font-size:12px;margin:0;">QR updates automatically. Scan with your WhatsApp camera.</p></div></body></html>`;
        fs.writeFileSync(path.join(__dirname, "qr.html"), htmlContent);
      } catch (_) {}
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const errorMsg = lastDisconnect?.error?.message || "Unknown error";
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut;
      console.log(`⚠️ Connection closed (Status: ${statusCode || "N/A"} - ${errorMsg}). Automatically reconnecting: ${shouldReconnect}`);
      if (isLoggedOut) {
        console.log("🔴 Logged out from WhatsApp. Resetting session credentials so a fresh QR code is generated on restart...");
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch (e) {
          console.error("Error clearing auth directory:", e.message);
        }
        process.exit(1);
      } else if (shouldReconnect) {
        console.log("🔄 Triggering clean process exit for watchdog auto-restart...");
        try { sock.end(undefined); } catch (_) {}
        process.exit(0);
      }
    } else if (connection === "open") {
      console.log("\n✅ URBAN TROUT SALES AGENT IS LIVE & CONNECTED TO WHATSAPP!");
      console.log("🤖 10 Strict Directives Active | 16km Perimeter Enforced (Tiered MOQ: 2kg/3kg/5kg) | Cashfree Link Ready.");
      console.log("📊 Telegram 8:00 PM Nightly Executive Briefing Active (Auto-reports revenue, orders, inquiries & store walk-ins)");
      console.log("📱 Phone Kill Switch Active: Send #pause / #resume from phone to control AI");

      // Auto-sync Google Contacts on launch
      try {
        exportContacts();
      } catch (e) {
        console.warn("Contact sync notice on launch:", e.message);
      }

      // Auto-sync today's paid orders from customer_orders.json to Supabase orders table
      try {
        const ordersFilePath = path.join(__dirname, "customer_orders.json");
        if (fs.existsSync(ordersFilePath)) {
          const allOrders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));
          const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
          for (const ord of Object.values(allOrders)) {
            if (ord && (ord.status?.includes("Paid") || ord.status?.includes("Confirmed"))) {
              const ordDate = (ord.paidAt || ord.updatedAt) ? new Date(ord.paidAt || ord.updatedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";
              if (ordDate === todayIst) {
                syncWhatsAppOrderToSupabase(ord, ord.paymentId).catch(() => {});
              }
            }
          }
        }
      } catch (syncErr) {
        console.warn("Startup order sync notice:", syncErr.message);
      }

      // Clear existing intervals/timeouts if reconnecting to prevent duplication
      if (pollInterval) { clearTimeout(pollInterval); clearInterval(pollInterval); }
      if (paymentInterval) clearInterval(paymentInterval);
      if (followUpInterval) clearInterval(followUpInterval);
      if (nightlyReportInterval) clearInterval(nightlyReportInterval);
      if (weatherInterval) clearInterval(weatherInterval);
      if (contactsExportInterval) clearInterval(contactsExportInterval);

      // Warm live Open-Meteo Srinagar weather cache & refresh every 15 minutes
      refreshSrinagarWeather(true).catch(() => {});
      weatherInterval = setInterval(() => {
        refreshSrinagarWeather(true).catch(() => {});
      }, WEATHER_CACHE_TTL_MS);

      // Poll order update queue: 25s during farm operating hours (8 AM - 8 PM IST), 90s at night (guarded by epoch)
      const myPollEpoch = ++pollLoopEpoch;
      const scheduleNextQueuePoll = () => {
        if (myPollEpoch !== pollLoopEpoch) return;
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istHour = new Date(Date.now() + istOffset).getUTCHours();
        const delayMs = (istHour >= 8 && istHour < 20) ? 25000 : 90000;
        pollInterval = setTimeout(async () => {
          if (myPollEpoch !== pollLoopEpoch) return;
          try {
            await pollWhatsAppDispatchQueue(sock);
          } catch (_) {}
          scheduleNextQueuePoll();
        }, delayMs);
      };
      scheduleNextQueuePoll();

      // Check active pending Cashfree payment links every 3.5 seconds for instant confirmation
      paymentInterval = setInterval(() => {
        checkPendingCashfreePayments(sock);
      }, 3500);

      // Check inactive leads (60-90 minutes old) for exactly ONE gentle follow-up every 2.5 minutes
      followUpInterval = setInterval(() => {
        checkInactiveLeadsFollowUp(sock);
      }, 150000);

      // Periodic contact export every 30 mins (cleared on reconnect)
      contactsExportInterval = setInterval(() => {
        try { exportContacts(); } catch (_) {}
      }, 30 * 60 * 1000);

      // Check 8:00 PM nightly report schedule every 60 seconds
      nightlyReportInterval = setInterval(() => {
        checkNightlyReportSchedule();
      }, 60000);
      checkNightlyReportSchedule();
    }
  });

  async function dispatchLockedQrImage(sock, remoteJid, { cleanPhone, raw10, customerName, forceAmount, forceRef, forceDesc, forceDeliveryFee = 0, preferHdfcQr = false, bypassLocationGuard = false, bypassHumanOverride = false, chatHist = [] }) {
    try {
      if (!bypassHumanOverride && isChatManuallyPaused(remoteJid, cleanPhone || raw10)) {
        console.log(`[Locked QR Shield] Suppressed QR dispatch for ${remoteJid} — owner manual intervention active.`);
        return false;
      }

      const savedLoc = (remoteJid && chatMetadata[remoteJid]) ||
        (cleanPhone && chatMetadata[cleanPhone]) ||
        (raw10 && chatMetadata[raw10]) ||
        null;

      const ordersFilePath = path.join(__dirname, "customer_orders.json");
      let orders = {};
      if (fs.existsSync(ordersFilePath)) {
        try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
      }

      const targetOrder = findActiveCustomerOrder(orders, cleanPhone || raw10, remoteJid);

      // Guard against sending a duplicate QR for an order that is already Paid & Confirmed
      if (!bypassHumanOverride && targetOrder && isOrderActiveAndPaid(targetOrder) && (!forceRef || forceRef === targetOrder.orderRef)) {
        console.log(`[Locked QR Shield] Suppressed duplicate QR for already paid order #${targetOrder.orderRef} (${remoteJid}).`);
        return false;
      }

      // STRICT LOCATION-FIRST GUARD FOR QR CODE DISPATCH:
      // Never send a locked QR scanner image unless the customer's delivery locality is confirmed!
      const locDetails = resolveConfirmedCustomerLocationDetails({
        remoteJid,
        cleanPhone: cleanPhone || raw10,
        chatHist,
        targetOrder
      });
      const locationConfirmed = locDetails.confirmed;
      const qrWeatherPolicy = evaluateWeatherDeliveryPolicy(locDetails.distanceKm);

      if (!bypassLocationGuard && !locationConfirmed) {
        console.log(`[QR Guard] Blocked QR dispatch for ${remoteJid} — location is unverified.`);
        const askLocText = `📍 *To send your ${preferHdfcQr ? "HDFC SmartHub UPI QR" : "1-Tap Payment Link"}:* Which area, locality, or landmark in Srinagar should we deliver to (e.g. Soura, Lal Chowk, Rajbagh, Hyderpora)?\n\nOr drop a quick WhatsApp location pin so I can share your exact ${preferHdfcQr ? "locked UPI QR" : "payment link"} right away! 🐟`;
        const sentLocPrompt = await sock.sendMessage(remoteJid, { text: askLocText });
        if (sentLocPrompt?.key?.id) {
          botSentMessageIds.add(sentLocPrompt.key.id);
          setTimeout(() => botSentMessageIds.delete(sentLocPrompt.key.id), 10 * 60 * 1000);
        }
        const hLoc = chatHistories.get(remoteJid) || [];
        hLoc.push({ role: "model", text: askLocText });
        if (hLoc.length > 8) hLoc.splice(0, hLoc.length - 8);
        chatHistories.set(remoteJid, hLoc);
        saveChatHistories();
        return true; // Handled
      }

      if (!bypassLocationGuard && qrWeatherPolicy.blockedByWeather) {
        console.log(`[QR Guard] Blocked QR dispatch for ${remoteJid} — ${locDetails.distanceKm}km > ${WEATHER_RESTRICT_RADIUS_KM}km during active ${qrWeatherPolicy.weather.condition}.`);
        const qrAreaName = locDetails.localityName || "Your Area";
        const qrHoldMsg = hasRecentWeatherAdvisory(chatHist, qrAreaName)
          ? qrWeatherPolicy.buildConciseWeatherHoldReminder(qrAreaName, locDetails.distanceKm)
          : qrWeatherPolicy.buildWetWeatherOutOfZoneMessage(qrAreaName, locDetails.distanceKm);
        const sentWeatherMsg = await sock.sendMessage(remoteJid, { text: qrHoldMsg });
        if (sentWeatherMsg?.key?.id) {
          botSentMessageIds.add(sentWeatherMsg.key.id);
          setTimeout(() => botSentMessageIds.delete(sentWeatherMsg.key.id), 10 * 60 * 1000);
        }
        const hWeather = chatHistories.get(remoteJid) || [];
        hWeather.push({ role: "model", text: qrHoldMsg });
        if (hWeather.length > 8) hWeather.splice(0, hWeather.length - 8);
        chatHistories.set(remoteJid, hWeather);
        saveChatHistories();
        return true; // Handled
      }

      // 1. Resolve requested weight & cut type up-front (latest explicit customer weight overrides stale order weight)
      let latestUserWeightKg = null;
      if (!forceAmount && !forceDesc && Array.isArray(chatHist)) {
        for (let i = chatHist.length - 1; i >= 0; i--) {
          if (chatHist[i].role !== "user") continue; // ← SKIP ALL BOT MESSAGES
          const msgText = chatHist[i].text || "";
          const wm = msgText.match(/(?:need|want|send|order|pack|give|for|chahiye|chahie)?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\b/i);
          if (wm) {
            const w = parseFloat(wm[1]);
            if (w >= 1 && w <= 50) {
              latestUserWeightKg = w;
              break;
            }
          }
        }
      }

      const descWeight = (forceDesc || targetOrder?.items || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
      const existingOrderWeightKg = descWeight ? parseFloat(descWeight[1]) : null;
      const detectedWeightKg = (!forceAmount && !forceDesc && latestUserWeightKg)
        ? latestUserWeightKg
        : (existingOrderWeightKg || latestUserWeightKg);
      const weightChangedVsOrder = Boolean(detectedWeightKg && existingOrderWeightKg && Math.abs(detectedWeightKg - existingOrderWeightKg) > 0.01);

      // Only check explicit forceDesc or targetOrder.items — NEVER bot disclaimers in chatHist!
      const isWhole = /\b(?:whole|sabut)\b/i.test(forceDesc || targetOrder?.items || "");
      const baseUnitRate = isWhole ? 540 : 580;
      const minExpectedBase = detectedWeightKg ? Math.round(detectedWeightKg * baseUnitRate) : 0;

      // 2. Resolve numeric amount (ignore stale order amount when customer changed weight)
      let amt = forceAmount ? parseInt(String(forceAmount).replace(/,/g, ""), 10) : null;
      if (!amt && !weightChangedVsOrder && targetOrder && targetOrder.amount) {
        const m = String(targetOrder.amount).replace(/,/g, "").match(/(\d+)/);
        if (m) amt = parseFloat(m[1]);
      }
      if (!amt && Array.isArray(chatHist)) {
        for (let i = chatHist.length - 1; i >= 0; i--) {
          if (chatHist[i].role !== "user") continue;
          const t = chatHist[i].text || "";
          const mPayable = t.match(/(?:Total\s*Payable|Total\s*Amount|Amount|Total)[^0-9\n\r]{0,25}?₹?\s*([\d,]{3,7})\b(?!\s*\/\s*kg)/i);
          if (mPayable) { amt = parseFloat(mPayable[1].replace(/,/g, "")); break; }
        }
      }

      // 🛡️ Resolve customer distance and exact zone delivery fee
      const custDist = locDetails?.distanceKm ?? (savedLoc?.distanceKm != null ? savedLoc.distanceKm : null);
      const isSurgeNow = isCurrentEveningSurge();
      const zoneDeliveryFee = (custDist !== null && detectedWeightKg)
        ? getDeliveryFeeForDistance(custDist, detectedWeightKg, isSurgeNow)
        : 0;
      const effectiveDeliveryFee = Number(forceDeliveryFee) > 0
        ? Number(forceDeliveryFee)
        : zoneDeliveryFee;

      // If amount not explicitly determined yet, check if the bot previously quoted a total for this order weight
      if (!amt || amt <= 0) {
        if (Array.isArray(chatHist)) {
          for (let i = chatHist.length - 1; i >= 0; i--) {
            if (chatHist[i].role !== "model") continue;
            const bText = chatHist[i].text || "";
            // Look for quoted total (e.g. "₹1,299 total" or "Total: ₹1,299" or "Total Payable: *₹1,299*")
            const mBotTot = bText.match(/(?:total\s*payable|total)[^0-9\n\r]{0,25}?₹?\s*([\d,]{3,7})\s*(?:total)?\b/i);
            if (mBotTot) {
              const parsedBotTot = parseFloat(mBotTot[1].replace(/,/g, ""));
              if (detectedWeightKg && parsedBotTot >= minExpectedBase) {
                amt = parsedBotTot;
                break;
              }
            }
          }
        }
      }

      // If still not resolved from chat history, calculate based on detected weight + delivery fee
      if (!amt || amt <= 0) {
        amt = detectedWeightKg
          ? (minExpectedBase + effectiveDeliveryFee)
          : (1160 + (custDist !== null ? getDeliveryFeeForDistance(custDist, 2, isSurgeNow) : 0));
      }

      // 🛡️ HARD AMOUNT & DELIVERY FEE INTEGRITY GUARD:
      // Total amount CANNOT be below base cost + effective delivery fee!
      const minRequiredTotal = minExpectedBase + effectiveDeliveryFee;
      if (detectedWeightKg && detectedWeightKg >= 1.0 && amt < minRequiredTotal) {
        console.warn(`🚨 [QR AMOUNT GUARD] Resolved amt ₹${amt} is below base+fee (₹${minRequiredTotal}) for ${detectedWeightKg}kg at ${custDist}km. Auto-correcting to ₹${minRequiredTotal}!`);
        amt = minRequiredTotal;
      }

      // 3. Resolve order reference (reuse active unpaid ref ONLY if amount/quantity hasn't changed)
      const prevAmtMatch = targetOrder?.amount ? String(targetOrder.amount).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/) : null;
      const prevOrderAmt = prevAmtMatch ? Math.round(parseFloat(prevAmtMatch[1])) : null;
      const isSameAmountAsPrev = !weightChangedVsOrder && prevOrderAmt !== null && Math.abs(prevOrderAmt - Math.round(amt)) <= 1;

      // 4. Resolve items description
      let itemsDesc = forceDesc || (isSameAmountAsPrev ? targetOrder?.items : null);
      if (!itemsDesc) {
        const cutName = isWhole ? "Whole Fresh Trout" : "Cleaned & Gutted";
        if (detectedWeightKg) {
          itemsDesc = `${detectedWeightKg} kg × ${cutName}`;
        } else if (amt >= 2850) itemsDesc = "5 kg Cleaned & Gutted (Family Bulk Pack)";
        else if (amt >= 2300) itemsDesc = "4 kg Cleaned & Gutted";
        else if (amt >= 1700) itemsDesc = "3 kg Cleaned & Gutted (Pan-Ready)";
        else if (amt >= 1160) itemsDesc = "2 kg Cleaned & Gutted (Pan-Ready)";
        else itemsDesc = "1 kg Cleaned & Gutted (Starter Pack)";
      }

      // 5. Route between HDFC SmartHub Vyapar UPI QR (explicit QR/scanner ask) vs Cashfree 1-Tap Short Link (default)
      const reusableQrLink = preferHdfcQr ? null : TodayOrderPool.findReusablePaymentLink(cleanPhone || raw10, remoteJid, amt);
      let orderRef = forceRef || (reusableQrLink?.orderRef) || (isSameAmountAsPrev ? targetOrder?.orderRef : null) || `UT-WA-${Date.now().toString().slice(-8)}`;

      let paymentResult;
      if (preferHdfcQr) {
        const hdfcQr = await generateHdfcSmartHubQrBuffer(amt, orderRef);
        console.log(`📸 [HDFC SmartHub QR Generated] Locked ₹${amt} UPI QR (${HDFC_COUNTER_VPA}) for #${orderRef} -> ${cleanPhone || remoteJid}`);
        paymentResult = {
          tier: 1,
          mode: "hdfc_smarthub_qr",
          qrBuffer: hdfcQr.qrBuffer,
          upiUri: hdfcQr.upiUri,
          payUrl: null,
          cashfreeLinkId: isSameAmountAsPrev ? (targetOrder?.cashfreeLinkId || null) : null,
          paymentLinkId: isSameAmountAsPrev ? (targetOrder?.paymentLinkId || null) : null,
          orderRef,
          bankDetailsText: null,
          isHdfcQr: true
        };
      } else if (reusableQrLink && reusableQrLink.url) {
        console.log(`♻️ [Link Reuse QR-Dispatch] Reusing single active payment link ${reusableQrLink.url} (#${orderRef}) for ${cleanPhone || remoteJid} (₹${amt})`);
        paymentResult = {
          tier: 1,
          mode: "cashfree_link",
          qrBuffer: null,
          payUrl: reusableQrLink.url,
          cashfreeLinkId: reusableQrLink.cashfreeLinkId || reusableQrLink.id || targetOrder?.cashfreeLinkId || null,
          paymentLinkId: reusableQrLink.paymentLinkId || reusableQrLink.id || targetOrder?.paymentLinkId || null,
          orderRef,
          bankDetailsText: null,
          isReused: true
        };
      } else {
        paymentResult = await generatePaymentWithWaterfall({
          amount: amt,
          customerPhone: cleanPhone || raw10,
          customerName: customerName || targetOrder?.name || "Customer",
          orderRef: orderRef,
          description: itemsDesc,
          preferQr: false,
          latitude: targetOrder?.latitude || savedLoc?.latitude || locDetails?.latitude || null,
          longitude: targetOrder?.longitude || savedLoc?.longitude || locDetails?.longitude || null,
          distanceKm: targetOrder?.distanceKm || savedLoc?.distanceKm || locDetails?.distanceKm || null,
          googleMapsUrl: targetOrder?.googleMapsUrl || savedLoc?.googleMapsUrl || null
        });
      }

      if (!paymentResult.qrBuffer && !paymentResult.payUrl && !paymentResult.bankDetailsText) {
        throw new Error("Failed to generate payment QR or link");
      }

      const qrFeeMatch = (itemsDesc || "").match(/\(\s*\+\s*₹?\s*(\d+)\s*(?:Special\s+|Express\s+)?Delivery\s*\)/i);
      const qrIsWhole = /\b(?:whole|sabut)\b/i.test(itemsDesc || "");
      const qrWeightMatch = (itemsDesc || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
      let effectiveQrFee = Number(forceDeliveryFee) > 0
        ? Number(forceDeliveryFee)
        : (qrFeeMatch ? parseInt(qrFeeMatch[1], 10) : (effectiveDeliveryFee || Number(targetOrder?.deliveryFee) || 0));
      // 🛡️ FEE & ZERO-FEE CONSISTENCY GUARD: Guarantee QR caption fee strictly matches (Total - Fish Base)
      if (qrWeightMatch) {
        const expectedBase = Math.round(parseFloat(qrWeightMatch[1]) * (qrIsWhole ? 540 : 580));
        if (amt <= expectedBase) {
          effectiveQrFee = 0;
        } else if (Number(forceDeliveryFee) <= 0 && !qrFeeMatch) {
          const actualFeeDiff = amt - expectedBase;
          if (effectiveQrFee !== actualFeeDiff) {
            effectiveQrFee = actualFeeDiff;
          }
        }
      }

      const cleanItemDesc = (itemsDesc || "Cleaned & Gutted Trout")
        .replace(/\s*\(Pan-Ready\)/i, "")
        .replace(/\s*\(Family Pack\)/i, "")
        .replace(/\s*\(Starter Pack\)/i, "")
        .replace(/\s*\(\s*\+?\s*(?:₹\s*\d+\s*)?(?:Special\s+|Express\s+)?Delivery\s*\)/gi, "")
        .trim();

      const deliveryQrLine = effectiveQrFee > 0
        ? `• *Delivery Fee:* +₹${effectiveQrFee} (Express Delivery)\n`
        : "";

      const qrWeatherLine = qrWeatherPolicy.shortDelayNote ? `\n${qrWeatherPolicy.shortDelayNote}` : "";

      const custPhoneStr = cleanPhone || raw10 || "";
      const custPhoneLine = custPhoneStr ? `• *Customer Phone:* ${formatPhoneDisplay(custPhoneStr)}\n` : "";
      const custNameLine = (customerName && !/^(?:Customer|Valued Customer)(?:\s*\(|$)/i.test(customerName))
        ? `• *Name:* ${customerName}\n`
        : "";

      const payLinkLine = paymentResult.isHdfcQr
        ? `📲 *Scan this Locked Amount QR with Any UPI App* (Google Pay, PhonePe, Paytm, or J&K Bank mPay)\n🔒 _Amount is pre-filled & locked automatically upon scanning._\n👉 _Once paid, kindly share your payment screenshot here so our team can confirm on HDFC SmartHub and begin your fresh live harvest immediately!_\n_(Paying from this same phone without scanning? Reply *"Send Link"* for a 1-Tap link.)_\n\n`
        : paymentResult.payUrl
        ? `🔗 *Tap to Pay Instantly:* ${paymentResult.payUrl}\n_(${paymentResult.isReused ? "Same active link for your order — c" : "C"}lick the link to pay directly using Paytm, PhonePe, Google Pay, or J&K Bank mPay!)_\n\n`
        : "";
      const bankDetailsLine = paymentResult.bankDetailsText ? `\n\n${paymentResult.bankDetailsText}` : "";

      const caption = (paymentResult.isHdfcQr
        ? `📸 *URBAN TROUT • HDFC SMARTHUB UPI QR*\n`
        : paymentResult.payUrl
        ? `💳 *URBAN TROUT • 1-TAP PAYMENT LINK*\n`
        : `🐟 *URBAN TROUT • PAYMENT DETAILS*\n`) +
        `• *Order:* ${cleanItemDesc}\n` +
        custNameLine +
        custPhoneLine +
        deliveryQrLine +
        `• *Amount:* *₹${amt.toLocaleString("en-IN")}*${(paymentResult.isHdfcQr || paymentResult.payUrl) ? " (Exact Amount Locked)" : ""}\n` +
        `• *Ref:* #${orderRef}\n\n` +
        payLinkLine +
        `_Packed fresh in 100% food-grade biodegradable polythene (0% ice). Delivered directly to your shared GPS pin (our rider calls prior to arrival for a prompt handover at your shared pin)._${qrWeatherLine}${bankDetailsLine} 🚀`;

      const qrMsg = paymentResult.qrBuffer
        ? await sock.sendMessage(remoteJid, { image: paymentResult.qrBuffer, caption })
        : await sock.sendMessage(remoteJid, { text: caption });

      if (qrMsg && qrMsg.key && qrMsg.key.id) {
        botSentMessageIds.add(qrMsg.key.id);
        setTimeout(() => botSentMessageIds.delete(qrMsg.key.id), 10 * 60 * 1000);
      }
      await sock.sendPresenceUpdate("available", remoteJid).catch(() => {});
      appendDailyChatLog({
        jid: remoteJid,
        phone: cleanPhone || raw10,
        name: customerName || targetOrder?.name || "Customer",
        role: "ai_bot",
        text: `[${paymentResult.isHdfcQr ? "HDFC SmartHub QR" : paymentResult.payUrl ? "1-Tap Payment Link" : "Bank Details"} ₹${amt}] ${caption}`,
        meta: { payRef: orderRef, amount: amt }
      });

      console.log(`💳 [${paymentResult.isHdfcQr ? "HDFC SmartHub UPI QR" : paymentResult.payUrl ? "Cashfree 1-Tap Link" : "Bank Fallback"} Dispatched] Sent ₹${amt} to ${formatPhoneDisplay(cleanPhone || raw10)} for #${orderRef}`);

      // Update orders store (preserve original createdAt on reused link; reset createdAt on new link/amount)
      const updatedOrder = {
        ...(targetOrder || {}),
        orderRef,
        paymentLinkId: paymentResult.paymentLinkId || (isSameAmountAsPrev ? (targetOrder?.paymentLinkId || null) : null),
        cashfreeLinkId: paymentResult.cashfreeLinkId || (isSameAmountAsPrev ? (targetOrder?.cashfreeLinkId || null) : null),
        ...(paymentResult.isHdfcQr ? { paymentGateway: "HDFC SmartHub UPI", upiVpa: HDFC_COUNTER_VPA } : { paymentGateway: paymentResult.payUrl ? "Cashfree" : (targetOrder?.paymentGateway || "Bank Transfer") }),
        chatId: remoteJid,
        phone: cleanPhone || raw10,
        name: customerName || targetOrder?.name || "Customer",
        items: itemsDesc,
        amount: `₹${amt}`,
        deliveryFee: effectiveQrFee,
        deliveryArea: targetOrder?.deliveryArea || locDetails?.localityName || savedLoc?.localityName || null,
        distanceKm: targetOrder?.distanceKm ?? locDetails?.distanceKm ?? savedLoc?.distanceKm ?? null,
        latitude: targetOrder?.latitude ?? locDetails?.latitude ?? savedLoc?.latitude ?? null,
        longitude: targetOrder?.longitude ?? locDetails?.longitude ?? savedLoc?.longitude ?? null,
        googleMapsUrl: targetOrder?.googleMapsUrl || savedLoc?.googleMapsUrl || null,
        status: targetOrder?.status?.includes("Paid")
          ? targetOrder.status
          : (paymentResult.isHdfcQr ? "HDFC UPI QR Sent — Awaiting Confirmation" : paymentResult.payUrl ? "Payment Link Sent" : "Bank Transfer Details Sent"),
        payUrl: paymentResult.payUrl || (isSameAmountAsPrev ? (targetOrder?.payUrl || null) : null),
        ...(paymentResult.isReused ? { createdAt: targetOrder?.createdAt || new Date().toISOString() } : { createdAt: new Date().toISOString() }),
        updatedAt: new Date().toISOString()
      };
      recordNewCustomerOrder((cleanPhone || raw10) || remoteJid, updatedOrder);

      // Track in chat histories
      let hist = chatHistories.get(remoteJid) || [];
      hist.push({ role: "model", text: caption });
      if (hist.length > 8) hist.splice(0, hist.length - 8);
      chatHistories.set(remoteJid, hist);
      saveChatHistories();

      // Track in metadata
      if (chatMetadata[remoteJid]) {
        chatMetadata[remoteJid].lastBotMsgTime = Date.now();
        chatMetadata[remoteJid].lastMsgRole = "model";
        chatMetadata[remoteJid].lastBotReply = `[Payment Link Dispatched ₹${amt}]`;
      }
      if (raw10 && chatMetadata[raw10]) {
        chatMetadata[raw10].lastBotMsgTime = Date.now();
        chatMetadata[raw10].lastMsgRole = "model";
        chatMetadata[raw10].lastBotReply = `[Payment Link Dispatched ₹${amt}]`;
      }
      saveChatMetadata();

      return true;
    } catch (qrErr) {
      console.error("Direct QR dispatch error:", qrErr.message);
      return false;
    }
  }

  // Independent per-message processor (Executed concurrently across different customers)
  async function processSingleMessage(sock, msg, remoteJid, explicitText = null) {
    // Safety check: Ignore messages sent by the bot itself
    if (botSentMessageIds.has(msg.key?.id)) return;

    const myNumber = sock.user?.id ? sock.user.id.split(":")[0].replace(/\D/g, "") : "";
    const isSelfChat = myNumber && remoteJid.includes(myNumber);

    const innerMessage = getInnerMessage(msg);
    if (!innerMessage) return;

    const rawInputText = (
      explicitText !== null
        ? explicitText
        : (
            innerMessage.conversation ||
            innerMessage.extendedTextMessage?.text ||
            innerMessage.imageMessage?.caption ||
            ""
          )
    ).trim();

    const text = normalizeCustomerText(rawInputText);

    const cleanPhone = resolveCustomerPhone(remoteJid);
    const raw10 = cleanPhone ? cleanPhone.slice(-10) : "";
    const isOwner = msg.key.fromMe || cleanPhone.endsWith("7006604148") || String(remoteJid).includes("174637916885151");
    const isOwnerAdminDesk = isSelfChat || cleanPhone.endsWith("7006604148") || String(remoteJid).includes("174637916885151");
    const ownerDeskJid = isOwnerAdminDesk ? remoteJid : "917006604148@s.whatsapp.net";

    // 0. Runtime WhatsApp Document Ingestion (Disabled per owner mandate — teaching handled strictly via Antigravity)
    if (isOwner) {
      const doc = innerMessage.documentMessage || innerMessage.documentWithCaptionMessage?.message?.documentMessage;
      if (doc) {
        const docFileName = (doc.fileName || "").toLowerCase();
        const docMime = (doc.mimetype || "").toLowerCase();
        const isVcfDoc = docFileName.endsWith(".vcf") || docMime.includes("vcard") || docMime.includes("x-vcard");

        if (isVcfDoc) {
          await sock.sendMessage(ownerDeskJid, {
            text: "ℹ️ *WHATSAPP RUNTIME TEACHING IS DISABLED*\n\n" +
                  "To protect system stability and ensure zero hallucinations, all business logic, contact sync, and agent teaching are managed strictly through Antigravity.\n\n" +
                  "👉 Please share new contacts or rules with Antigravity on your laptop, then run *UPDATE_CLOUD_AGENT.bat* to deploy cleanly!"
          });
          return;
        }
      }
    }

    // ─── STRICT ADMIN COMMAND AUTHENTICATION LOCK ───
    // ONLY Admin Suhail (+91 7006604148 / msg.key.fromMe / 174637916885151) is allowed to execute ANY '#' or '$cmd' commands!
    const isAdminCmdText = text.startsWith("#") || /^\$(?:paid|confirm|delivered|done|complete|orders|queue|dispatch|status|help|commands|link|qr|scanner|pause|resume|bot|report|weather|friday|location|loc|contacts|scanchats|restart|reboot|reload)\b/i.test(text);
    if (isAdminCmdText) {
      if (!isOwner) {
        console.warn(`🚨 [UNAUTHORIZED ADMIN COMMAND ATTEMPT BLOCKED] Caller ${formatPhoneDisplay(cleanPhone)} (${remoteJid}) attempted to run command "${text}". ACCESS DENIED.`);
        return; // SILENTLY DROP - Never execute, never reveal internal orders, never pass to Gemini!
      }
    }

    // 1. Check for Owner Messages & Commands from Phone (Vendor phone OR Suhail's phone 7006604148)
    const cmdText = isAdminCmdText && text.startsWith("$") ? `#${text.slice(1)}` : text;
    if (isOwner && isAdminCmdText) {
      const lower = cmdText.toLowerCase().trim();
      const resolvedCustPhone = resolveCustomerPhone(remoteJid);
      const chatPauseKeys = Array.from(new Set([remoteJid, cleanPhone, raw10, resolvedCustPhone].filter(Boolean)));

      const isExplicitGlobalPause = lower === "#pause all" || lower === "#stop all" || lower === "#kill" || lower === "#kill switch" || lower === "#pause global" || lower === "#ai off" || lower === "#off";
      const isExplicitGlobalResume = lower === "#resume all" || lower === "#start all" || lower === "#ai on" || lower === "#on" || lower === "#unpause all";

      // A. Master Global Kill Switch (Triggered by #kill, #pause all, or #pause in Suhail's 1-on-1 Admin Chat)
      if (isExplicitGlobalPause || (isOwnerAdminDesk && (lower === "#pause" || lower === "#stop"))) {
        isAiPausedGlobally = true;
        aiPauseExpiry = 0;
        console.log(`\n🛑 [MASTER KILL SWITCH ACTIVATED] AI Sales Agent PAUSED globally by Admin Suhail (+91 7006604148).`);
        await sock.sendMessage(ownerDeskJid, {
          text: "🛑 *URBAN TROUT MASTER KILL SWITCH: ACTIVATED*\n\n" +
                "• *Global Status:* 🔴 PAUSED ENTIRELY FOR ALL CHATS\n" +
                "• The AI will NOT auto-reply to any incoming messages across all customer chats.\n" +
                "• All customer conversations are completely safe and untouched.\n\n" +
                "👉 Send *#resume* or *#resume all* anytime to reactivate the AI sales agent."
        });
        return;
      }

      // B. Master Global Resume Switch (Triggered by #resume all, or #resume in Suhail's 1-on-1 Admin Chat)
      if (isExplicitGlobalResume || (isOwnerAdminDesk && (lower === "#resume" || lower === "#start" || lower === "#unpause" || lower === "#bot"))) {
        isAiPausedGlobally = false;
        aiPauseExpiry = 0;
        console.log(`\n✅ [MASTER SWITCH RESUMED] AI Sales Agent RESUMED globally by Admin Suhail (+91 7006604148).`);
        await sock.sendMessage(ownerDeskJid, {
          text: "✅ *URBAN TROUT AI AGENT RESUMED GLOBALLY*\n\n" +
                "• *Global Status:* 🟢 ACTIVE & AUTO-REPLYING\n" +
                "• The AI is actively handling customer inquiries, orders, and live coordination 24/7."
        });
        return;
      }

      // C. Timed Global Pause (e.g. #pause 120 all, or #pause 60 on admin desk)
      if (lower.startsWith("#pause") && (lower.includes("all") || isOwnerAdminDesk)) {
        const mins = parseInt(lower.replace(/\D/g, ""), 10) || 60;
        isAiPausedGlobally = true;
        aiPauseExpiry = Date.now() + mins * 60 * 1000;
        console.log(`\n⏸️ [AI PAUSED GLOBALLY] Paused for ${mins} minutes by Admin Suhail.`);
        await sock.sendMessage(ownerDeskJid, {
          text: `⏸️ *URBAN TROUT AI AGENT PAUSED GLOBALLY FOR ${mins} MINUTES*\n\n` +
                `Will automatically resume at ${new Date(aiPauseExpiry).toLocaleTimeString()}.\n` +
                `Send *#resume* anytime to reactivate sooner.`
        });
        return;
      }

      // D. Per-Chat Pause (inside a customer chat)
      if (lower === "#pause" || lower === "#stop") {
        const pauseExp = Date.now() + 60 * 60 * 1000;
        for (const pk of chatPauseKeys) humanOverrides.set(pk, pauseExp);
        console.log(`\n⏸️ [AI PAUSED FOR CHAT] AI paused for 60m for ${formatPhoneDisplay(cleanPhone)}.`);
        await sock.sendMessage(ownerDeskJid, {
          text: `⏸️ *AI AGENT PAUSED FOR CHAT (${formatPhoneDisplay(cleanPhone) || remoteJid}, 60 MINS)*\n\nSend *#bot* or *#resume* in that chat anytime to reactivate auto-replies for this customer.`
        });
        return;
      }

      // E. Per-Chat Resume (inside a customer chat)
      if (lower === "#resume" || lower === "#bot") {
        for (const pk of chatPauseKeys) humanOverrides.delete(pk);
        console.log(`\n🤖 [AI RESUMED FOR CHAT] Auto-replies resumed for ${formatPhoneDisplay(cleanPhone)}.`);
        await sock.sendMessage(ownerDeskJid, {
          text: `🤖 *URBAN TROUT AI AGENT RESUMED FOR CHAT (${formatPhoneDisplay(cleanPhone) || remoteJid})*\n\nThe AI will now auto-reply to customer messages here.`
        });
        return;
      }

      // F. Per-Chat Timed Pause (inside a customer chat)
      if (lower.startsWith("#pause")) {
        const mins = parseInt(lower.replace(/\D/g, ""), 10) || 30;
        const pauseExp = Date.now() + mins * 60 * 1000;
        for (const pk of chatPauseKeys) humanOverrides.set(pk, pauseExp);
        console.log(`\n⏸️ [AI PAUSED FOR CHAT] Paused for ${mins}m for ${formatPhoneDisplay(cleanPhone)}.`);
        await sock.sendMessage(ownerDeskJid, {
          text: `⏸️ *AI AGENT PAUSED FOR CHAT (${formatPhoneDisplay(cleanPhone) || remoteJid}, ${mins} MINS)*\n\nSend *#bot* or *#resume* in that chat anytime to reactivate auto-replies for this customer.`
        });
        return;
      }

      if (lower === "#status" || lower === "#version" || lower === "#ver") {
        const statusStr = isAiPausedGlobally ? "🔴 PAUSED GLOBALLY" : "🟢 ACTIVE & RUNNING";
        let contactCount = 0;
        try {
          const cdb = JSON.parse(fs.readFileSync(path.join(__dirname, "contacts_database.json"), "utf8"));
          contactCount = Object.keys(cdb).length;
        } catch (_) {}
        await ensureFreshSrinagarWeather();
        const statusWeather = evaluateWeatherDeliveryPolicy(null);
        const chatOverride = chatPauseKeys
          .map(k => humanOverrides.get(k))
          .find(exp => exp && Date.now() < exp) || null;
        const chatStatus = (chatOverride && Date.now() < chatOverride)
          ? `⏸️ Paused (${Math.ceil((chatOverride - Date.now()) / 60000)}m remaining)`
          : (isChatManuallyPaused(remoteJid, cleanPhone || raw10) ? "⏸️ Paused" : "🟢 Active");
        await sock.sendMessage(ownerDeskJid, {
          text: `📊 *URBAN TROUT AI AGENT STATUS*\n\n` +
                `• *Global AI Status:* ${statusStr}\n` +
                `• *Bot Version:* v${BOT_VERSION} (${BOT_RELEASE_TITLE})\n` +
                `• *Last Updated:* ${BOT_LAST_UPDATED}\n` +
                `• *Build Focus:* ${BOT_RELEASE_NOTES}\n\n` +
                `• *This Chat AI Status:* ${chatStatus}\n` +
                `• *Srinagar Weather:* ${statusWeather.weatherIcon} ${statusWeather.weather.label}${statusWeather.weather.tempC != null ? ` (${statusWeather.weather.tempC}°C)` : ""} • Mode: *${statusWeather.weather.mode.toUpperCase()}*\n` +
                `• *Active Delivery Perimeter:* 0–${statusWeather.maxAllowedKm} km${statusWeather.weather.isBadWeather ? ` _(Paused >${WEATHER_RESTRICT_RADIUS_KM} km during ${statusWeather.weatherNoun})_` : " _(Full 4-Tier MOQ: 2kg/3kg/5kg)_"}\n` +
                `• *Friday Operations:* ${isFridayOperationsOpen() ? "🟢 OPEN (Owner Override Active)" : "Standard (Closed Fridays)"}\n` +
                `• *Active Conversations:* ${chatHistories.size}\n` +
                `• *Google Contacts DB:* ${contactCount} Leads Synced\n` +
                `• *Human Pause Window:* 30 minutes per manual intervention\n` +
                `• *Nightly Briefing:* Scheduled at 8:00 PM to Telegram`
        });
        return;
      }

      if (lower === "#restart" || lower === "#reboot" || lower === "#reload") {
        console.log(`🔄 [Admin Restart] Triggered by Suhail (${cleanPhone}) via WhatsApp. Exiting process for PM2 auto-revival.`);
        await sock.sendMessage(ownerDeskJid, {
          text: `🔄 *Restarting Urban Trout Cloud Agent...*\n\nHostinger VPS PM2 watchdog will restart the process cleanly in 5–10 seconds with fresh state.\n\nSend *#status* shortly to verify the agent is back online! 🐟`
        });
        setTimeout(() => {
          process.exit(0);
        }, 1200);
        return;
      }
      if (lower === "#report" || lower === "#briefing" || lower === "#daily" || lower === "#summary") {
        try {
          await sock.sendMessage(ownerDeskJid, { text: "📊 *Compiling Urban Trout Daily Executive Briefing...*" });
          const briefing = await sendNightlyBriefing(undefined, { skipMarkSent: true });
          await sock.sendMessage(ownerDeskJid, {
            text: briefing.whatsAppText
          });
          console.log(`\n📊 [REPORT ON-DEMAND] Daily Executive Briefing generated & sent to Telegram and WhatsApp.`);
        } catch (repErr) {
          console.error("Failed to generate on-demand briefing:", repErr);
          await sock.sendMessage(ownerDeskJid, {
            text: `⚠️ *Error compiling briefing:* ${repErr.message}`
          });
        }
        return;
      }
      if (lower === "#contacts" || lower === "#export" || lower === "#vcf" || lower === "#getcontacts" || lower === "#scanchats" || lower === "#synccontacts") {
        try {
          await sock.sendMessage(ownerDeskJid, { text: "⏳ *Scanning all chats for Name & Location and exporting Urban Trout contacts...*" });
          const contacts = enrichContactsFromChats({ updateMetadata: true, silent: false });
          const withLocCount = Array.isArray(contacts) ? contacts.filter(c => c.customerName && c.area && c.area !== "Srinagar").length : 0;
          const localVcf = path.join(__dirname, "Urban_Trout_Contacts.vcf");
          if (fs.existsSync(localVcf)) {
            await sock.sendMessage(ownerDeskJid, {
              document: fs.readFileSync(localVcf),
              mimetype: "text/vcard",
              fileName: "Urban_Trout_Contacts.vcf",
              caption: `✅ *Urban Trout Contacts Export*\n\n• Total Synced Leads: ${contacts.length}\n• Named with Location: ${withLocCount}\n• Personal primary contacts protected & excluded.\n• Tap this file to import or update into Google Contacts!`
            });
            console.log(`✅ [Owner Contacts Export] Sent Urban_Trout_Contacts.vcf (${contacts.length} contacts, ${withLocCount} Name-Location) to owner.`);
          } else {
            await sock.sendMessage(ownerDeskJid, { text: `⚠️ Contacts file not found on disk.` });
          }
        } catch (expErr) {
          console.error("Failed to export contacts on demand:", expErr);
          await sock.sendMessage(ownerDeskJid, { text: `⚠️ *Error exporting contacts:* ${expErr.message}` });
        }
        return;
      }
      if (lower === "#help" || lower === "#commands") {
        await sock.sendMessage(ownerDeskJid, {
          text: `🛠️ *URBAN TROUT OWNER QUICK COMMANDS*\n\n` +
            `📍 *Instant Delivery & Rate Quote (#location):*\n` +
            `• *#location sanatnagar* (Distance, Free MOQ & <MOQ rates ready to copy-paste)\n` +
            `• *#location 34.112105, 74.823007* (Check GPS coords directly)\n` +
            `• *#loc bemina* / *#location airport road* / *#location <maps link>*\n\n` +
            `🛵 *Mobile Order Dispatch (iPhone Control):*\n` +
            `• *#orders* (View all active undelivered orders right now)\n` +
            `• *#paid 2kg +200* or *$paid 2kg* (Confirm exact weight + optional fee when multiple QRs/links were sent)\n` +
            `• *#paid 1000* or *#Paid 1000* (Confirm flat/custom amount or match QR by exact total)\n` +
            `• *#paid* or *$paid* (Auto-match active order, or swipe-reply *$paid* directly on any QR message!)\n` +
            `• *#paid 9876543210 2kg +200* (Confirm for specific customer phone number)\n` +
            `• *#delivered* (Mark order as delivered & remove from active queue)\n` +
            `• *#delivered 9876543210* (Mark order delivered by phone or ref)\n\n` +
            `⚡ *Instant 1-Tap Payment Link Shortcuts:*\n` +
            `• *#2kg +149* (2kg Gutted + ₹149 delivery = ₹1,309)\n` +
            `• *#3kg +200* (3kg Gutted + ₹200 delivery = ₹1,940)\n` +
            `• *#link 3kg +200* (3kg Gutted + ₹200 delivery)\n` +
            `• *#link 3kg gutted +200* (Cleaned & Gutted @ ₹580 + ₹200)\n` +
            `• *#link 3kg whole +200* (Whole Fresh @ ₹540 + ₹200)\n` +
            `• *#link 2kg* (Standard 2kg Gutted @ ₹1,160 - Free Delivery)\n` +
            `• *#link 1940* (Direct flat amount of ₹1,940)\n` +
            `• *#3kg +200 9876543210* (With customer phone number)\n` +
            `• *#3kg +200 9876543210 Farooq Sb Lalbazar* (With phone & name/address)\n\n` +
            `📸 *HDFC SmartHub Locked UPI QR Commands:*\n` +
            `• *#qr* or *$qr* (Send locked HDFC SmartHub QR for customer's order in this chat)\n` +
            `• *#qr 2kg +149* (Locked ₹1,309 HDFC SmartHub QR directly into chat)\n` +
            `• *#qr 1740* (Locked flat ₹1,740 HDFC SmartHub QR)\n` +
            `• *#qr 3kg 9876543210* (Send locked HDFC QR directly to customer phone)\n` +
            `• _After customer pays & shares screenshot, reply *$paid* in chat to confirm!_\n\n` +
            `👥 *Contacts & Nightly Scan:*\n` +
            `• *#contacts* or *#scanchats* (Scan all chats for Name - Location & export .vcf)\n` +
            `• Automated 8:00 PM nightly chat scan runs daily with the executive report\n\n` +
            `🌦️ *Weather Delivery Radar (#weather):*\n` +
            `• *#weather* (Check live Open-Meteo Srinagar rain/snow status & active radius)\n` +
            `• *#weather auto* (Enable automatic real-time weather switching)\n` +
            `• *#weather rain* / *#weather snow* (Force <=${WEATHER_RESTRICT_RADIUS_KM} km wet-weather hold & delay notice)\n` +
            `• *#weather clear* (Force full 16.0 km delivery perimeter)\n\n` +
            `🕌 *Friday Operations Override (#friday):*\n` +
            `• *#friday* (Check current Friday operating status)\n` +
            `• *#friday on* or *#friday open* (Force business operations & deliveries OPEN on Friday)\n` +
            `• *#friday off* or *#friday closed* (Keep Friday closed for standard weekly maintenance)\n` +
            `• *#friday auto* (Automatic mode: closed on Fridays, open Saturday to Thursday)\n\n` +
            `⏸️ *AI Agent Controls:*\n` +
            `• *#pause* (Pause AI globally, or for 60m in customer chat)\n` +
            `• *#pause 30* (Pause for custom minutes)\n` +
            `• *#resume* or *#bot* (Reactivate AI immediately for this chat or globally)\n` +
            `• *#status* (View agent system status)\n` +
            `• *#restart* (Cleanly reboot cloud agent via PM2)\n` +
            `• *#report* (Generate & send 8:00 PM Daily Executive Briefing now)`
        });
        return;
      }

      // Owner Command: #weather - Real-time weather status & manual override control (auto | rain | snow | clear)
      if (/^#weather\b/i.test(lower)) {
        const arg = lower.replace(/^#weather\b/i, "").trim().split(/\s+/)[0] || "status";

        if (["auto", "rain", "snow", "clear"].includes(arg)) {
          if (arg === "auto") {
            await refreshSrinagarWeather(true);
          }
          setWeatherOverrideMode(arg, cleanPhone || "Suhail");
        } else if (!arg || arg === "status" || arg === "check" || arg === "refresh") {
          await refreshSrinagarWeather(true);
        } else {
          await sock.sendMessage(ownerDeskJid, {
            text: `🌦️ *Weather Radar Command Usage:*\n\n• *#weather* — Check live Open-Meteo weather in Srinagar\n• *#weather auto* — Automatic live detection (rain/snow => 0–${WEATHER_RESTRICT_RADIUS_KM} km only)\n• *#weather rain* — Force Rain Mode (pause >${WEATHER_RESTRICT_RADIUS_KM} km)\n• *#weather snow* — Force Snow Mode (pause >${WEATHER_RESTRICT_RADIUS_KM} km)\n• *#weather clear* — Force Clear Weather Mode (full 0–16.0 km)`
          });
          return;
        }

        const effW = getEffectiveSrinagarWeather();
        const effPolicy = evaluateWeatherDeliveryPolicy(null);
        const liveSummary = liveWeatherCache.ok
          ? `${liveWeatherCache.label} (${liveWeatherCache.tempC ?? "?"}°C, Precip: ${liveWeatherCache.precipMm} mm, Snow: ${liveWeatherCache.snowCm} cm)`
          : "Using default fallback (Open-Meteo unavailable)";

        await sock.sendMessage(ownerDeskJid, {
          text: `${effPolicy.weatherIcon} *URBAN TROUT WEATHER RADAR*\n\n` +
            `• *Control Mode:* *${effW.mode.toUpperCase()}*\n` +
            `• *Effective Policy Status:* *${effPolicy.weatherTitle.toUpperCase()}*\n` +
            `• *Active Delivery Perimeter:* *0–${effPolicy.maxAllowedKm} km* from Malabagh\n` +
            `• *Wet-Weather Rule:* ${effW.isBadWeather ? `Deliveries >${WEATHER_RESTRICT_RADIUS_KM} km PAUSED; 0–${WEATHER_RESTRICT_RADIUS_KM} km ACTIVE with delay advisory.` : "Full 0–16.0 km express delivery OPEN."}\n` +
            `• *Live Open-Meteo (Malabagh):* ${liveSummary}\n\n` +
            `_Quick switch: *#weather auto*, *#weather rain*, *#weather snow*, or *#weather clear*._`
        });
        console.log(`🌦️ [Owner #weather] Mode=${effW.mode} | Policy=${effPolicy.weatherTitle} | MaxRadius=${effPolicy.maxAllowedKm}km`);
        return;
      }

      // Owner Command: #friday - Control Friday business operations (open/on | closed/off/auto | status)
      if (/^#friday\b/i.test(lower)) {
        const arg = lower.replace(/^#friday\b/i, "").trim().split(/\s+/)[0] || "status";

        if (["open", "on", "enable", "start"].includes(arg)) {
          setFridayOverrideMode("open", cleanPhone || "Suhail");
          await sock.sendMessage(ownerDeskJid, {
            text: `🟢 *FRIDAY OPERATIONS ACTIVATED (OPEN)* 🐟\n\n` +
              `• *AI Agent Status:* Friday operations are now **ACTIVE & OPEN**!\n` +
              `• *Website Status:* **Synced to Website!** (allow_friday_orders = true: online checkout & same-day express delivery unlocked)\n` +
              `• *Live Counter:* Malabagh Live Vending Center open 8:00 AM – 8:00 PM.\n` +
              `• *Express Delivery:* Same-day 2-hour delivery active across Srinagar.\n` +
              `• *AI Agent:* Confirms Friday orders, quotes standard rates, and issues locked 1-Tap Cashfree payment links!\n\n` +
              `_To revert back to standard Friday closure, send *#friday off* or *#friday auto*._`
          });
          console.log(`🟢 [Owner #friday] Friday operations forced OPEN by ${cleanPhone || "Suhail"} (Synced to Website)`);
          return;
        } else if (["closed", "close", "off", "disable", "stop", "auto"].includes(arg)) {
          setFridayOverrideMode(arg === "auto" ? "auto" : "closed", cleanPhone || "Suhail");
          await sock.sendMessage(ownerDeskJid, {
            text: `🔴 *FRIDAY OPERATIONS CLOSED (STANDARD)* 🐟\n\n` +
              `• *AI Agent Status:* Friday operations are **CLOSED** (Standard maintenance & filtration backwash policy).\n` +
              `• *Website Status:* **Synced to Website!** (allow_friday_orders = false: website shows Friday maintenance banner & pre-orders for Saturday).\n` +
              `• *AI Agent:* Informs customers Friday is closed for maintenance, and books advance delivery for Saturday morning!\n\n` +
              `_To activate Friday operations, send *#friday on* or *#friday open*._`
          });
          console.log(`🔴 [Owner #friday] Friday operations reset to CLOSED/AUTO by ${cleanPhone || "Suhail"} (Synced to Website)`);
          return;
        } else {
          const isOpen = isFridayOperationsOpen();
          await sock.sendMessage(ownerDeskJid, {
            text: `🕌 *FRIDAY OPERATIONS STATUS*\n\n` +
              `• *Current Setting:* *${isOpen ? "🟢 OPEN (Special Operations Active)" : "🔴 CLOSED (Standard Weekly Maintenance)"}*\n` +
              `• *AI Agent:* ${isOpen ? "Accepting live Friday orders & issuing 1-Tap Cashfree payment links" : "Offering advance bookings for Saturday morning"}\n` +
              `• *Website:* ${isOpen ? "🟢 OPEN (Live checkout & same-day express dispatch active)" : "🔴 CLOSED (Friday maintenance banner active, pre-orders for Saturday)"}\n` +
              `• *Operating Hours:* ${isOpen ? "8:00 AM – 8:00 PM (Live Harvest & Express Delivery Active)" : "Zero Deliveries (Filtration Backwash & Weekly Bio-security)"}\n\n` +
              `👉 *Commands:*\n` +
              `• *#friday on* or *#friday open* — Turn operations ON (Agent + Website)\n` +
              `• *#friday off* or *#friday closed* — Turn operations OFF (Agent + Website)\n` +
              `• *#friday auto* — Restore default calendar mode`
          });
          return;
        }
      }

      // Owner Command: #location / #loc / #zone - Admin-only GPS/locality rate lookup (never auto-sends to customers)
      if (/^#(?:location|loc|zone|checkloc)\b/i.test(lower)) {
        const locQuery = cmdText
          .replace(/^#(?:location|loc|zone|checkloc)\b/i, "")
          .replace(/\s+/g, " ")
          .trim();

        if (!locQuery) {
          await sock.sendMessage(ownerDeskJid, {
            text: `📍 *Location Rate Checker Usage:*\n\n• *#location sanatnagar*\n• *#loc bemina*\n• *#location 34.112105, 74.823007*\n• *#location Iqbal park near Shergari*\n• *#location <Google Maps link>*`
          });
          return;
        }

        let resolved = null;
        try {
          const coords = await getCoordinatesFromText(locQuery);
          if (coords && coords.lat != null && coords.lng != null) {
            const liveRoadDist = await fetchLiveRoadDistance(coords.lat, coords.lng);
            const dist = parseFloat(((liveRoadDist != null && !isNaN(liveRoadDist)) ? liveRoadDist : calculateDistance(FARM_LAT, FARM_LNG, coords.lat, coords.lng)).toFixed(1));
            const labelFromText = locQuery.replace(/https?:\/\/\S+/gi, "").replace(/-?\d{1,2}\.\d+[,\s]+-?\d{1,3}\.\d+/g, "").replace(/[,\s]+/g, " ").trim();
            const textDet = labelFromText ? detectSrinagarLocality(labelFromText) : null;
            const nearestPlace = resolveNearestLocalityName(coords.lat, coords.lng);
            resolved = {
              status: dist <= 16.0 ? "IN_ZONE" : "OUT_ZONE",
              name: (textDet && textDet.name) || nearestPlace || labelFromText || "Your Location",
              dist
            };
          }
        } catch (_) {}

        if (!resolved) {
          resolved = detectSrinagarLocality(locQuery);
        }
        if (!resolved) {
          try {
            resolved = await resolveUnknownLocalityWithApi(locQuery);
          } catch (_) {}
        }

        if (!resolved) {
          await sock.sendMessage(ownerDeskJid, {
            text: `⚠️ Could not resolve location *"${locQuery}"*.\n\nTry a Srinagar colony/landmark (e.g. *#location sanatnagar*, *#location bemina*), GPS coordinates (*#location 34.112105, 74.823007*), or a Google Maps link!`
          });
          return;
        }

        const quoteText = buildLocationRateQuote({
          name: resolved.name || locQuery,
          dist: resolved.dist,
          status: resolved.status
        });

        await sock.sendMessage(ownerDeskJid, { text: quoteText });
        console.log(`📍 [Owner #location] "${locQuery}" -> ${resolved.name} (~${resolved.dist ?? "?"} km, ${resolved.status}) [Replied only to Admin]`);
        return;
      }

      // Owner Command: #qr or #scanner - Send locked HDFC SmartHub UPI QR image into customer chat (#qr 2kg +149, $qr 1740, etc.)
      if (lower.startsWith("#qr") || lower.startsWith("#scanner")) {
        const parsed = parseQuickOrderParams(cmdText, cleanPhone || raw10, { defaultWeightIfMissing: null });

        let targetJid = null;
        let targetPhone = null;

        if (parsed.explicitPhone) {
          // Explicit phone passed in command (e.g. #qr 2kg +149 7006604148 or #qr 1740 9876543210)
          targetPhone = parsed.explicitPhone;
          targetJid = `91${targetPhone}@s.whatsapp.net`;
        } else {
          // No phone in command -> send directly into the current chat
          targetJid = remoteJid;
          targetPhone = cleanPhone || raw10 || (remoteJid.includes("@s.whatsapp.net") ? remoteJid.split("@")[0].replace(/\D/g, "").slice(-10) : null);
        }

        let chatHist = chatHistories.get(targetJid) || [];
        if (chatHist.length === 0 && targetPhone) {
          chatHist = chatHistories.get(`91${targetPhone}@s.whatsapp.net`) || [];
          if (chatHist.length === 0) {
            for (const [hJid, hArr] of chatHistories.entries()) {
              if (resolveCustomerPhone(hJid).slice(-10) === targetPhone && Array.isArray(hArr) && hArr.length > 0) {
                chatHist = hArr;
                break;
              }
            }
          }
        }
        const finalAmt = parsed.totalAmount || null;
        const finalDesc = parsed.itemDesc || null;
        const storedMetaName = (targetJid && chatMetadata[targetJid]?.pushName) ||
          (targetPhone && chatMetadata[targetPhone]?.pushName) ||
          null;
        const resolvedCustName = parsed.explicitPhone
          ? parsed.targetCustName
          : (storedMetaName || parsed.targetCustName);

        const success = await dispatchLockedQrImage(sock, targetJid, {
          cleanPhone: targetPhone,
          raw10: targetPhone,
          customerName: resolvedCustName || "Customer",
          forceAmount: finalAmt,
          forceDesc: finalDesc,
          forceDeliveryFee: parsed.deliveryFee || 0,
          preferHdfcQr: true,
          bypassLocationGuard: true,
          bypassHumanOverride: true,
          chatHist
        });

        if (success) {
          const qrPauseExp = Date.now() + 30 * 60 * 1000;
          humanOverrides.set(targetJid, qrPauseExp);
          if (targetPhone) humanOverrides.set(targetPhone, qrPauseExp);
          if (targetJid !== ownerDeskJid) {
            const nameNote = (resolvedCustName && !/^(?:Customer|Valued Customer)(?:\s*\(|$)/i.test(resolvedCustName))
              ? ` (${resolvedCustName})`
              : "";
            await sock.sendMessage(ownerDeskJid, {
              text: `✅ *HDFC SmartHub UPI QR Dispatched!* 🐟\nDelivered ${finalAmt ? `*₹${finalAmt.toLocaleString("en-IN")}*` : "locked"}${parsed.deliveryFee > 0 ? ` (incl. +₹${parsed.deliveryFee} delivery)` : ""} locked HDFC QR directly to ${formatPhoneDisplay(targetPhone)}${nameNote}.\n\n👉 _Once paid on SmartHub, reply *$paid* in chat to confirm._`
            });
          }
        } else {
          console.error(`⚠️ [#qr/#link Failure] Could not generate/dispatch HDFC QR for ${targetJid}`);
          await sock.sendMessage(ownerDeskJid, {
            text: `⚠️ *HDFC QR Notice:* Could not generate locked HDFC QR automatically for ${formatPhoneDisplay(targetPhone) || targetJid}. Please check connection or use #link.`
          });
        }
        return;
      }

      // Owner Command: #orders or #queue or #dispatch - View all active undelivered orders for TODAY on iPhone
      if (lower === "#orders" || lower === "#queue" || lower === "#dispatch" || lower === "#active" || lower === "#pending") {
        try {
          const ordersFilePath = path.join(__dirname, "customer_orders.json");
          let orders = {};
          if (fs.existsSync(ordersFilePath)) {
            try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
          }

          const todayIst = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
          const isToday = (o) => {
            if (!o) return false;
            for (const t of [o.paidAt, o.createdAt, o.updatedAt]) {
              if (t) {
                const d = new Date(t);
                if (!isNaN(d.getTime()) && d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayIst) return true;
              }
            }
            return false;
          };

          const todayOrders = Object.values(orders).filter(o => o && o.orderRef && isToday(o));
          const pendingDeliveries = todayOrders.filter(o =>
            (isOrderActiveAndPaid(o) || /\b(?:out\s*for\s*delivery|dispatched|confirmed|harvest\s*scheduled)\b/i.test(o.status || "")) &&
            !isOrderDeliveredOrClosed(o)
          );
          const completedDeliveries = todayOrders.filter(o => /\bdelivered\b/i.test(o.status || ""));

          if (pendingDeliveries.length === 0) {
            await sock.sendMessage(ownerDeskJid, {
              text: `✅ *TODAY'S DISPATCH STATUS: ALL DELIVERED!* 🐟\n\n` +
                `There are currently zero pending deliveries remaining for today (${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}).\n` +
                (completedDeliveries.length > 0 ? `\n🎉 *${completedDeliveries.length} order(s)* delivered successfully today.` : `\nNo confirmed orders placed yet today.`)
            });
            return;
          }

          let queueMsg = `🛵 *URBAN TROUT · TODAY'S DISPATCH QUEUE (${pendingDeliveries.length} Pending)*\n` +
            `📅 Date: ${new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

          pendingDeliveries.forEach((o, idx) => {
            const phone = o.phone || "N/A";
            const maps = o.googleMapsUrl ? `\n   🗺️ Maps: ${o.googleMapsUrl}` : "";
            queueMsg += `${idx + 1}. *#${o.orderRef}* · ${o.name || "Customer"} (+91 ${phone})\n`;
            queueMsg += `   📦 ${o.items || "Fresh Trout"} · *${o.amount}* [${o.status || "PAID ✅"}]\n`;
            queueMsg += `   📍 Area: ${o.deliveryArea || "Srinagar"}\n`;
            queueMsg += `   🕒 Slot: ${o.deliveryTime || "Immediate"}${maps}\n\n`;
          });

          queueMsg += `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 *Admin Actions:*\n` +
            `• Reply *#delivered [phone or ref]* to mark delivered\n` +
            `• Reply *#paid [amount]* in customer chat to confirm manual payments\n` +
            `• Reply *#link [amount]* to send 1-Tap payment link`;

          await sock.sendMessage(ownerDeskJid, { text: queueMsg });
        } catch (queueErr) {
          await sock.sendMessage(ownerDeskJid, { text: `⚠️ Error fetching orders queue: ${queueErr.message}` });
        }
        return;
      }

      // Owner Command: #paid / $paid or #confirm - Manually confirm payment (#paid 2kg +200, #paid 2kg, #Paid 1000, or swipe-reply on QR)
      if (lower.startsWith("#paid") || lower.startsWith("#confirm")) {
        try {
          const ordersFilePath = path.join(__dirname, "customer_orders.json");
          let orders = {};
          if (fs.existsSync(ordersFilePath)) {
            try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
          }

          const phoneInCmd = cmdText.match(/\b([6-9]\d{9})\b/);
          let targetPhone = phoneInCmd ? phoneInCmd[1] : (cleanPhone || raw10);
          let targetJid = phoneInCmd
            ? (`91${targetPhone}@s.whatsapp.net`)
            : (!isOwnerAdminDesk ? remoteJid : (targetPhone ? `91${targetPhone}@s.whatsapp.net` : null));

          if (!targetPhone && !targetJid) {
            await sock.sendMessage(ownerDeskJid, {
              text: `⚠️ *Please specify customer phone or run inside customer chat:*\nExamples:\n• *#paid 2kg +200*\n• *#paid 2kg*\n• *#Paid 1000*\n• *#paid 9419084032 2kg +200*`
            });
            return;
          }

          // Load chat history (with @lid / phone fallback) and any WhatsApp quoted message text (swipe-reply)
          let paidChatHist = (targetJid && chatHistories.get(targetJid)) || [];
          if (paidChatHist.length === 0 && targetPhone) {
            paidChatHist = chatHistories.get(`91${targetPhone}@s.whatsapp.net`) || [];
            if (paidChatHist.length === 0) {
              for (const [hJid, hArr] of chatHistories.entries()) {
                if (resolveCustomerPhone(hJid).slice(-10) === targetPhone && Array.isArray(hArr) && hArr.length > 0) {
                  paidChatHist = hArr;
                  if (phoneInCmd) targetJid = hJid;
                  break;
                }
              }
            }
          }

          const qMsg = innerMessage?.extendedTextMessage?.contextInfo?.quotedMessage || null;
          const quotedText = qMsg
            ? (qMsg.conversation || qMsg.extendedTextMessage?.text || qMsg.imageMessage?.caption || "")
            : "";

          const {
            existingOrder,
            paidAmt,
            itemsDesc,
            effectiveDeliveryFee,
            orderRef,
            isHdfcPayment
          } = resolveManualPaidOrderDetails({
            cmdText,
            targetPhone,
            targetJid,
            orders,
            chatHist: paidChatHist,
            quotedText
          });

          const resolvedTargetJid = targetJid || existingOrder?.chatId || (targetPhone ? `91${targetPhone}@s.whatsapp.net` : null);
          const metaForCust = (resolvedTargetJid && chatMetadata[resolvedTargetJid]) || (targetPhone && chatMetadata[targetPhone]) || null;
          const gatewayLabel = isHdfcPayment ? "HDFC SmartHub UPI" : "Verified UPI Transfer";
          const manualPayId = isHdfcPayment ? `HDFC-SMARTHUB-${Date.now()}` : `MANUAL-PAY-${Date.now()}`;
          const isUpdatingSameRef = Boolean(existingOrder?.orderRef && existingOrder.orderRef === orderRef);

          const metaCustName = metaForCust?.pushName || null;
          const updatedOrder = {
            ...(isUpdatingSameRef ? existingOrder : {}),
            orderRef,
            chatId: resolvedTargetJid,
            phone: targetPhone || existingOrder?.phone || "",
            name: existingOrder?.name || metaCustName || "Customer",
            items: itemsDesc,
            deliveryFee: effectiveDeliveryFee,
            amount: `₹${paidAmt} [PAID via ${gatewayLabel}]`,
            status: "Paid & Confirmed (Live Harvest Pending)",
            paymentGateway: gatewayLabel,
            upiVpa: isHdfcPayment ? HDFC_COUNTER_VPA : null,
            paymentId: manualPayId,
            paidAt: new Date().toISOString(),
            deliveryArea: existingOrder?.deliveryArea || metaForCust?.localityName || "Srinagar",
            distanceKm: existingOrder?.distanceKm ?? metaForCust?.distanceKm ?? null,
            latitude: existingOrder?.latitude ?? metaForCust?.latitude ?? null,
            longitude: existingOrder?.longitude ?? metaForCust?.longitude ?? null,
            googleMapsUrl: existingOrder?.googleMapsUrl || metaForCust?.googleMapsUrl || null,
            deliveryTime: existingOrder?.deliveryTime || "Within 90–120 Minutes (Today)"
          };

          const hasGps = Boolean(updatedOrder.latitude || metaForCust?.latitude);
          const manualWeatherPolicy = evaluateWeatherDeliveryPolicy(updatedOrder?.distanceKm);
          const { slot: finalManualSlot, commitment: deliveryCommitmentManual } = resolveOrderDeliveryCommitment(updatedOrder, resolvedTargetJid, manualWeatherPolicy);
          updatedOrder.deliveryTime = finalManualSlot;

          recordNewCustomerOrder(targetPhone || resolvedTargetJid, updatedOrder);
          syncWhatsAppOrderToSupabase(updatedOrder, updatedOrder.paymentId).catch((syncErr) => {
            console.warn("[Supabase Order Sync Notice]:", syncErr?.message || syncErr);
          });
          if (targetPhone && paidAmt > 0) {
            autoSettleKhataInSupabase(targetPhone, paidAmt, updatedOrder.paymentId, orderRef);
          }

          // 1. Send official WhatsApp confirmation receipt to customer
          const receiptMsg = buildPaymentConfirmedReceipt({
            orderRef,
            itemsDesc,
            paidAmt,
            finalSlot: finalManualSlot,
            deliveryCommitment: deliveryCommitmentManual,
            hasGps,
            gatewayLabel
          });

          if (resolvedTargetJid) {
            const sentManualReceipt = await sock.sendMessage(resolvedTargetJid, { text: receiptMsg });
            if (sentManualReceipt?.key?.id) {
              botSentMessageIds.add(sentManualReceipt.key.id);
              setTimeout(() => botSentMessageIds.delete(sentManualReceipt.key.id), 10 * 60 * 1000);
            }
          }

          // 2. Send instant Telegram dispatch card to Suhail
          await sendTelegramDispatchCard(updatedOrder, {
            amount: paidAmt,
            phone: targetPhone,
            paymentId: updatedOrder.paymentId,
            vpa: isHdfcPayment ? HDFC_COUNTER_VPA : undefined,
            mode: gatewayLabel
          });

          // 3. Confirm to owner with exact resolved items & amount
          if (resolvedTargetJid !== ownerDeskJid) {
            await sock.sendMessage(ownerDeskJid, {
              text: `✅ *Order #${orderRef} Confirmed!* 🐟\n\n• Customer: ${updatedOrder.name} (+91 ${targetPhone || "N/A"})\n• Items: ${itemsDesc}\n• Amount: ₹${paidAmt} [PAID via ${gatewayLabel}]\n• Automated WhatsApp receipt delivered to customer\n• Synced to Order Dashboard & Telegram!`
            });
          }
        } catch (payErr) {
          console.error("Error in #paid/$paid command:", payErr);
          await sock.sendMessage(ownerDeskJid, { text: `⚠️ Error recording payment: ${payErr.message}` });
        }
        return;
      }

      // Owner Command: #delivered or #done - Mark order delivered and remove from active dispatch
      const isDeliveredCmd = lower.startsWith("#delivered") || lower.startsWith("#done") || lower.startsWith("#complete") || /^#order\s+(?:delivered|deliverred|done|complete|completed)/i.test(lower);
      if (isDeliveredCmd) {
        try {
          const ordersFilePath = path.join(__dirname, "customer_orders.json");
          let orders = {};
          if (fs.existsSync(ordersFilePath)) {
            try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
          }

          const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
          const refMatch = text.match(/\b(UT-[A-Z0-9-]+)\b/i);

          let targetPhone = phoneMatch ? phoneMatch[1] : (cleanPhone || raw10);
          let targetRef = refMatch ? refMatch[1].toUpperCase() : null;

          let targetKey = null;
          let order = null;

          if (targetRef) {
            for (const [k, ord] of Object.entries(orders)) {
              if (ord && ord.orderRef && ord.orderRef.toUpperCase() === targetRef) {
                targetKey = k;
                order = ord;
                break;
              }
            }
          }
          if (!order) {
            for (const [k, ord] of Object.entries(orders)) {
              if (!ord || isOrderDeliveredOrClosed(ord)) continue;
              const ordPhone10 = String(ord.phone || "").replace(/\D/g, "").slice(-10);
              const k10 = String(k).replace(/\D/g, "").slice(-10);
              if (targetPhone && (k === targetPhone || k10 === targetPhone || ordPhone10 === targetPhone)) {
                targetKey = k;
                order = ord;
                break;
              }
              if (!phoneMatch && ord.chatId === remoteJid) {
                targetKey = k;
                order = ord;
                break;
              }
            }
          }
          if (!order) {
            for (const [k, ord] of Object.entries(orders)) {
              if (!ord) continue;
              const ordPhone10 = String(ord.phone || "").replace(/\D/g, "").slice(-10);
              const k10 = String(k).replace(/\D/g, "").slice(-10);
              if ((targetPhone && (k === targetPhone || k10 === targetPhone || ordPhone10 === targetPhone)) || (!phoneMatch && ord.chatId === remoteJid)) {
                targetKey = k;
                order = ord;
                break;
              }
            }
          }

          if (!order || !targetKey) {
            await sock.sendMessage(ownerDeskJid, {
              text: `⚠️ *Order not found.* Reply with: *#delivered [phone or orderRef]* (e.g. *#delivered 9419084032*)`
            });
            return;
          }

          order.status = "Delivered & Completed ✅";
          order.deliveredAt = new Date().toISOString();
          recordNewCustomerOrder(targetKey, order);

          // If typed in owner self-chat or owner private chat, send admin reply.
          // In customer chats, do NOT send internal admin text to the customer!
          const isCustomerChat = !isOwnerAdminDesk;
          const custName = (order.name && !/^(?:Customer|Valued Customer)(?:\s*\(|$)/i.test(order.name)) ? order.name : "there";
          const reviewPrompt = `Hello ${custName}! ✨ Your fresh trout order (#${order.orderRef}) has been successfully delivered! We hope you and your family love the farm-fresh taste.\n\nYour feedback is truly important to us and helps our local farm grow. If you enjoyed your order, we would be grateful if you could spare 15 seconds to leave a *5-star review* on Google — your review can even get *featured in the Testimonials section on urbantrout.in*! 🌟\n\nhttps://g.page/r/CTVKEpV62HMmECE/review\n\nBon Appetit! — Urban Trout Aquaculture 🐟`;

          const targetCustomerJid = order.chatId || (order.phone ? `91${order.phone.replace(/\D/g, "").slice(-10)}@s.whatsapp.net` : null);

          if (isCustomerChat) {
            // Typed inside customer chat -> Deliver the official 5-star review request directly!
            await sock.sendMessage(remoteJid, { text: reviewPrompt });
            console.log(`🌟 [5-Star Review Request Sent] Delivered to customer in chat ${remoteJid}`);
          } else {
            // Typed from Admin Desk -> Send review request to customer and confirmation to admin!
            if (targetCustomerJid) {
              try {
                await sock.sendMessage(targetCustomerJid, { text: reviewPrompt });
                console.log(`🌟 [5-Star Review Request Sent] Dispatched to customer ${targetCustomerJid}`);
              } catch (_) {}
            }
            await sock.sendMessage(ownerDeskJid, {
              text: `✅ *Order #${order.orderRef} Marked Delivered!* 🐟\n\nCustomer: ${order.name || "Customer"} (+91 ${order.phone || targetKey})\nItems: ${order.items || "Fresh Trout"}\nStatus: Delivered & Completed ✅\n🌟 *5-Star Google Review Request dispatched to customer!*`
            });
          }
        } catch (delivErr) {
          await sock.sendMessage(ownerDeskJid, { text: `⚠️ Error marking delivered: ${delivErr.message}` });
        }
        return;
      }

      // 3. Owner Quick Payment Link & WhatsApp Summary Card Generator
      const isQuickLink = lower.startsWith("#link") || lower.startsWith("#order") || lower.startsWith("#pay") || /^#\s*\d+/i.test(lower);
      if (isQuickLink) {
        try {
          const parsed = parseQuickOrderParams(text, !isOwnerAdminDesk ? (cleanPhone || raw10) : null, { defaultWeightIfMissing: 2.0 });
          const {
            explicitPhone,
            deliveryFee,
            weightKg,
            prodType,
            totalAmount,
            itemDesc,
            targetCustPhone,
            targetCustName,
            notesText
          } = parsed;

          console.log(`\n⚡ [Owner Quick-Link] Generating link for ${targetCustName}: ${itemDesc} @ ₹${totalAmount} (Delivery: ₹${deliveryFee})`);

          // Generate locked single-use Link with 4-Tier Waterfall
          const waterfallRes = await generatePaymentWithWaterfall({
            amount: totalAmount,
            customerPhone: targetCustPhone,
            customerName: targetCustName,
            description: `Urban Trout - ${itemDesc}`,
            preferQr: false
          });
          const payObj = {
            url: waterfallRes.payUrl,
            ref: waterfallRes.orderRef,
            id: waterfallRes.paymentLinkId || waterfallRes.cashfreeLinkId,
            paymentLinkId: waterfallRes.paymentLinkId,
            cashfreeLinkId: waterfallRes.cashfreeLinkId,
            bankDetailsText: waterfallRes.bankDetailsText
          };

          // Customer JID if phone number is provided or if in customer chat
          const customerJid = targetCustPhone ? `91${targetCustPhone}@s.whatsapp.net` : (!isOwnerAdminDesk ? remoteJid : null);

          const linkWeatherPolicy = evaluateWeatherDeliveryPolicy(null);
          const { slot: linkScheduledSlot } = resolveOrderDeliveryCommitment({ deliveryTime: null }, customerJid || remoteJid, linkWeatherPolicy);

          // Record in persistent customer orders store
          recordNewCustomerOrder(targetCustPhone || `QUICK-${payObj.ref}`, {
            orderRef: payObj.ref,
            paymentLinkId: payObj.paymentLinkId || payObj.id || null,
            cashfreeLinkId: payObj.cashfreeLinkId || null,
            chatId: customerJid || remoteJid,
            ownerJid: remoteJid,
            phone: targetCustPhone || "",
            name: targetCustName,
            items: itemDesc,
            amount: `₹${totalAmount}`,
            deliveryFee,
            status: "Payment Link Sent — Awaiting Confirmation",
            deliveryArea: "Express Delivery",
            deliveryTime: linkScheduledSlot,
            payUrl: payObj.url,
            createdBy: "OWNER_WHATSAPP_COMMAND",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });

          // Use customer's known locality from metadata (if any) or notesText; avoid generic "Valued Customer ()"
          const knownMetaLocality = (customerJid && chatMetadata[customerJid]?.localityName) ||
            (targetCustPhone && chatMetadata[targetCustPhone]?.localityName) ||
            (cleanPhone && chatMetadata[cleanPhone]?.localityName) ||
            null;
          const cleanKnownArea = (knownMetaLocality && !/^(?:srinagar|kashmir|area pending)$/i.test(knownMetaLocality))
            ? knownMetaLocality
            : null;
          const resolvedLocalityForCard = (!explicitPhone && cleanKnownArea) ? cleanKnownArea : (notesText && notesText.length > 1 ? notesText : null);

          let orderCard = formatOrderSummaryCard({
            orderRef: payObj.ref,
            amount: totalAmount,
            desc: `${weightKg ? `${weightKg} kg ` : ""}${prodType}${deliveryFee > 0 ? ` (+₹${deliveryFee} Express Delivery)` : ""}`,
            deliveryFee,
            distanceKm: null,
            localityName: resolvedLocalityForCard,
            scheduledSlot: linkScheduledSlot,
            payUrl: payObj.url
          });
          if (!payObj.url && payObj.bankDetailsText) {
            orderCard += `\n\n${payObj.bankDetailsText}`;
          }

          // If customer phone was explicitly provided and differs from the current chat, dispatch to customer!
          if (explicitPhone && customerJid && customerJid !== remoteJid) {
            try {
              await sock.sendMessage(customerJid, { text: orderCard });
              const cardPauseExp = Date.now() + 30 * 60 * 1000;
              humanOverrides.set(customerJid, cardPauseExp);
              if (targetCustPhone) humanOverrides.set(targetCustPhone, cardPauseExp);
              console.log(`✅ [Direct WhatsApp Link Sent] Delivered directly to customer ${customerJid}!`);

              await sock.sendMessage(ownerDeskJid, {
                text: `✅ *Order #${payObj.ref} Generated & Dispatched!* 🚀\n\n` +
                  `• *Customer:* ${targetCustName} (+91 ${targetCustPhone})\n` +
                  `• *Item:* ${weightKg ? `${weightKg} kg ${prodType}` : itemDesc}\n` +
                  (deliveryFee > 0 ? `• *Express Delivery Fee:* +₹${deliveryFee}\n` : "") +
                  `• *Total Payable:* *₹${totalAmount}*\n` +
                  `• *Payment Link:* ${payObj.url || "See Bank Details"}\n\n` +
                  `📩 *Order summary and 1-Tap payment link delivered directly to customer (+91 ${targetCustPhone}) on WhatsApp!*`
              });
              return;
            } catch (custSendErr) {
              console.error(`❌ [Customer Send Error]: Could not send to ${customerJid}:`, custSendErr.message);
            }
          }

          // Otherwise (typed in customer chat or self-chat without another phone), send card to current chat!
          const curPauseExp = Date.now() + 30 * 60 * 1000;
          for (const pk of chatPauseKeys) humanOverrides.set(pk, curPauseExp);
          await sock.sendMessage(remoteJid, { text: orderCard });
          console.log(`✅ [Direct Link in Current Chat] Order #${payObj.ref} sent to ${remoteJid}`);

          // Link-only checkout: orderCard already includes the 1-Tap payment link
          return;
        } catch (linkErr) {
          console.error(`❌ [Owner Quick-Link Error]:`, linkErr);
          await sock.sendMessage(ownerDeskJid, {
            text: `❌ *Error Generating Payment Link:*\n${linkErr.message}\n\nPlease try again (e.g. *#2kg +149* or *#link 3kg +200*).`
          });
          return;
        }
      }
    }

    if (msg.key.fromMe) {
      if (!isSelfChat) {
        console.log(`[Human Entry] Owner messaged ${formatPhoneDisplay(cleanPhone)}. Pausing AI for 30 mins.`);
        const expiry = Date.now() + 30 * 60 * 1000;
        humanOverrides.set(remoteJid, expiry);
        if (cleanPhone) humanOverrides.set(cleanPhone, expiry);
        const resolved = resolveCustomerPhone(remoteJid);
        if (resolved) humanOverrides.set(resolved, expiry);
        const manualPhone = (resolved || cleanPhone || "").slice(-10);
        if (text) {
          appendDailyChatLog({
            jid: remoteJid,
            phone: manualPhone || cleanPhone || "",
            name: (chatMetadata[remoteJid] && chatMetadata[remoteJid].pushName) || "",
            role: text.startsWith("#") ? "owner_command" : "owner_manual",
            text
          });
          if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
          chatMetadata[remoteJid].lastMsgRole = "human";
          chatMetadata[remoteJid].lastHumanMsgTime = Date.now();
          chatMetadata[remoteJid].lastHumanReply = text.slice(0, 150);
          if (manualPhone && manualPhone.length === 10 && !chatMetadata[remoteJid].phone) {
            chatMetadata[remoteJid].phone = `91${manualPhone}`;
          }
          saveChatMetadata();

          // Sync manual WhatsApp dispatch / delivered status directly into customer_orders.json so AI never thinks rider hasn't left!
          const isManualDelivered = /\b(?:has\s+been\s+successfully\s+delivered|delivered\s*&\s*completed|order\s+(?:has\s+been\s+|is\s+)?delivered)\b/i.test(text);
          const isManualDispatched = !isManualDelivered && /\b(?:is\s+out\s+for\s+delivery|out\s*for\s*delivery|is\s+en\s*route|is\s+on\s+the\s+road)\b/i.test(text);
          if (isManualDelivered || isManualDispatched) {
            try {
              const ordersFilePath = path.join(__dirname, "customer_orders.json");
              if (fs.existsSync(ordersFilePath)) {
                const ordersData = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")) || {};
                const manualRefMatch = text.match(/\b(UT-[A-Z0-9-]+)\b/i);
                const manualRef = manualRefMatch ? manualRefMatch[1].toUpperCase() : null;
                let matchedKey = null;
                let matchedOrd = null;
                if (manualRef) {
                  for (const [okKey, okOrd] of Object.entries(ordersData)) {
                    if (okOrd && okOrd.orderRef && okOrd.orderRef.toUpperCase() === manualRef) {
                      matchedKey = okKey;
                      matchedOrd = okOrd;
                      break;
                    }
                  }
                }
                if (!matchedOrd) {
                  matchedOrd = findActiveCustomerOrder(ordersData, manualPhone || cleanPhone, remoteJid);
                  if (matchedOrd) {
                    matchedKey = String(matchedOrd.phone || manualPhone || cleanPhone || "").replace(/\D/g, "").slice(-10) || null;
                  }
                }
                if (matchedOrd && matchedKey) {
                  const newStatus = isManualDelivered ? "Delivered & Completed ✅" : "Out for Delivery (Rider Dispatched)";
                  const statusPatch = {
                    ...matchedOrd,
                    status: newStatus,
                    ...(isManualDelivered ? { deliveredAt: new Date().toISOString() } : { dispatchedAt: new Date().toISOString() })
                  };
                  recordNewCustomerOrder(matchedKey, statusPatch);
                  console.log(`🛵 [Order Status Auto-Synced from Owner Chat] #${matchedOrd.orderRef} (${matchedKey}) -> "${newStatus}"`);
                }
              }
            } catch (syncErr) {
              console.warn("[Manual Dispatch Sync Notice]:", syncErr.message);
            }
          }
        }
        return;
      }
    }

    // 2. Check Global Kill Switch
    if (isAiPausedGlobally) {
      if (aiPauseExpiry > 0 && Date.now() >= aiPauseExpiry) {
        isAiPausedGlobally = false;
        aiPauseExpiry = 0;
        console.log(`\n⏰ [AI Pause Expired] Auto-replies resumed.`);
      } else {
        console.log(`⏸️ [AI Paused Globally] Skipped auto-reply for ${formatPhoneDisplay(resolveCustomerPhone(remoteJid))}`);
        return;
      }
    }

    // 3. Check 30-minute Human Override
    if (!isSelfChat) {
      const resolved = resolveCustomerPhone(remoteJid);
      const overrideExpiry =
        humanOverrides.get(remoteJid) ||
        (cleanPhone ? humanOverrides.get(cleanPhone) : null) ||
        (resolved ? humanOverrides.get(resolved) : null);
      if (overrideExpiry && Date.now() < overrideExpiry) {
        const remainingMins = Math.ceil((overrideExpiry - Date.now()) / (60 * 1000));
        console.log(`⏸️ [Human Intervened] AI paused (${remainingMins}m remaining) for ${formatPhoneDisplay(resolved || cleanPhone)}. Skipping.`);
        return;
      }
    }

    // 4. Check for Native WhatsApp Location Pin or Google Maps Link
    const isLiveLoc = Boolean(innerMessage.liveLocationMessage);
    const locMsg = innerMessage.locationMessage || innerMessage.liveLocationMessage;
    let detectedLat = null;
    let detectedLng = null;
    let isGpsCheck = false;

    if (locMsg && locMsg.degreesLatitude && locMsg.degreesLongitude) {
      detectedLat = locMsg.degreesLatitude;
      detectedLng = locMsg.degreesLongitude;
      isGpsCheck = true;
    } else if (text) {
      const parsedCoords = await getCoordinatesFromText(text);
      if (parsedCoords) {
        detectedLat = parsedCoords.lat;
        detectedLng = parsedCoords.lng;
        isGpsCheck = true;
      }
    }

    const msgStartTime = Date.now();
    const cleanPushName = !msg.key?.fromMe ? extractCleanWhatsAppName(msg.pushName) : null;
    if (!msg.key?.fromMe && msg.pushName) {
      saveWhatsAppContact(remoteJid, msg.pushName);
    }

    const displayPhone = formatPhoneDisplay(cleanPhone);
    const customerName = cleanPushName || (!msg.key?.fromMe ? resolveCustomerDisplayName(msg.pushName, null) : null) || "Customer";

    // 3b. Customer Sentiment & Dissatisfaction Escalation Check
    if (!isSelfChat && !isOwner && text) {
      const escalation = detectCustomerEscalation(text);
      if (escalation) {
        console.log(`\n🚨 [CUSTOMER ESCALATION DETECTED] Category: ${escalation.category} | Customer: ${customerName} (${displayPhone})`);
        console.log(`💬 Message: "${text}"`);

        // 1. Lock 60-minute human override immediately
        const expiry = Date.now() + 60 * 60 * 1000;
        humanOverrides.set(remoteJid, expiry);
        if (cleanPhone) humanOverrides.set(cleanPhone, expiry);
        const resolved = resolveCustomerPhone(remoteJid);
        if (resolved) humanOverrides.set(resolved, expiry);

        // 2. Dispatch High-Priority Telegram Alert to owner
        try {
          const alertPhone = cleanPhone || resolved || "";
          const alertHtml = `🚨 <b>URGENT CUSTOMER ESCALATION ALERT</b> 🚨\n━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Customer:</b> ${customerName || "Customer"} (<code>${displayPhone}</code>)\n⚠️ <b>Category:</b> ${escalation.category}\n🚩 <b>Severity:</b> ${escalation.severity}\n\n💬 <b>Customer Said:</b>\n<i>"${text.slice(0, 350)}"</i>\n\n🛡️ <b>Action Taken:</b> AI Bot has been <b>PAUSED for 60 mins</b> on this chat.\n👉 <a href="https://wa.me/${alertPhone}"><b>Tap here to Open WhatsApp & Reply Personally</b></a>`;
          await sendTelegramMessage(alertHtml);
          console.log(`📢 [Telegram Alert Sent] Escalation alert dispatched to owner.`);
        } catch (tgErr) {
          console.error("Failed to send escalation alert to Telegram:", tgErr.message);
        }

        // 3. Send professional, disarming, empathetic WhatsApp message
        const disarmReply = `We completely understand your concern and sincerely apologize for any confusion or frustration. 🙏\n\nI have directly notified our founder and senior Malabagh team with your message. Someone from our core team will personally connect with you right away to assist you directly.`;

        const chatHist = chatHistories.get(remoteJid) || [];
        chatHist.push({ role: "user", text });
        chatHist.push({ role: "model", text: disarmReply });
        if (chatHist.length > 8) chatHist.splice(0, chatHist.length - 8);
        chatHistories.set(remoteJid, chatHist);
        saveChatHistories();

        const escSent = await sock.sendMessage(remoteJid, { text: disarmReply });
        if (escSent?.key?.id) {
          botSentMessageIds.add(escSent.key.id);
          setTimeout(() => botSentMessageIds.delete(escSent.key.id), 10 * 60 * 1000);
        }
        appendDailyChatLog({
          jid: remoteJid,
          phone: cleanPhone || raw10,
          name: customerName,
          role: "ai_bot",
          text: disarmReply,
          meta: { escalation: escalation.category, severity: escalation.severity }
        });
        return;
      }
    }

    // Detect locality up-front so it is initialized before BOTH GPS pin handling and text handling (prevents TDZ crashes)
    const rawLocText = [text, locMsg?.name, locMsg?.address].filter(Boolean).join(" ").trim();
    const locDetected = rawLocText ? detectSrinagarLocality(rawLocText) : null;
    const savedMetaLoc = chatMetadata[remoteJid]?.localityName || (raw10 ? chatMetadata[raw10]?.localityName : null) || null;
    const detectedLocalityName =
      (locDetected && locDetected.status === "IN_ZONE" ? locDetected.name : null) ||
      (isGpsCheck && detectedLat !== null && detectedLng !== null ? resolveNearestLocalityName(detectedLat, detectedLng) : null) ||
      (savedMetaLoc && !/^(?:srinagar|kashmir)$/i.test(savedMetaLoc) ? savedMetaLoc : null);

    if (isGpsCheck && detectedLat !== null && detectedLng !== null) {
      const liveRoadDist = await fetchLiveRoadDistance(detectedLat, detectedLng);
      const dist = (liveRoadDist != null && !isNaN(liveRoadDist)) ? liveRoadDist : calculateDistance(FARM_LAT, FARM_LNG, detectedLat, detectedLng);
      const distRounded = dist.toFixed(1);
      const istDate = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
      const istTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

      console.log(`\n┌──────────────────────────────────────────────────────────────────────────`);
      console.log(`│ 📍 [LOCATION PIN RECEIVED] 📅 ${istDate} • ⏰ ${istTime}`);
      console.log(`│ 👤 Name: ${customerName}${msg.pushName ? ` (WA: "${msg.pushName}")` : ""} | 📞 Phone: ${displayPhone}`);
      console.log(`│ 🌐 Coords: ${detectedLat}, ${detectedLng} | 📏 Distance to Farm: ${distRounded} km | 📍 Area: ${detectedLocalityName || "Srinagar"}`);

      // Auto-learn colony or landmark from WhatsApp location pin name/address or recent chat
      try {
        autoLearnColonyFromLocation({
          lat: detectedLat,
          lng: detectedLng,
          distKm: Number(distRounded),
          locName: locMsg?.name || locMsg?.address,
          locAddress: locMsg?.address,
          recentUserText: text
        });
      } catch (learnErr) {
        console.error("⚠️ [autoLearnColonyFromLocation Error]:", learnErr.message);
      }

      let locReply = "";
      let historyNote = "";
      let chatHist = chatHistories.get(remoteJid) || [];

      const distNum = Number(distRounded);
      const mapsUrl = `https://maps.google.com/?q=${detectedLat},${detectedLng}`;

      // ── GPS SANITY CHECK: bogus pin guard ──────────────────────────────────
      // If the pin resolves to > 500 km away, the customer almost certainly
      // shared a stale/wrong location (e.g. a previous city, a forwarded pin).
      // Ask them to reshare rather than hard-refusing delivery.
      if (distNum > 500) {
        console.log(`│ ⚠️ [GPS SANITY FAIL] Pin distance ${distRounded} km is implausible — treating as bad pin, not out-of-zone.`);
        locReply = `📍 *Location Pin Error Detected* ⚠️\n\nIt looks like the shared location pin may not be your current location (it appears to be very far from Srinagar).\n\nCould you please *reshare your current WhatsApp location?*\n👉 Tap the 📎 Attach icon → Location → *Send Current Location*\n\nOnce we receive your correct location, we'll confirm delivery details right away! 🐟`;
        historyNote = `[GPS PIN SANITY FAIL: Distance ${distRounded} km is implausible. Likely wrong/stale pin. Asked customer to reshare current location.]`;
        chatHist.push({ role: "user", text: historyNote });
        chatHist.push({ role: "model", text: locReply });
        if (chatHist.length > 8) chatHist.splice(0, chatHist.length - 8);
        chatHistories.set(remoteJid, chatHist);
        saveChatHistories();
        const sentSanity = await sock.sendMessage(remoteJid, { text: locReply });
        if (sentSanity?.key?.id) {
          botSentMessageIds.add(sentSanity.key.id);
          setTimeout(() => botSentMessageIds.delete(sentSanity.key.id), 10 * 60 * 1000);
        }
        await sock.sendPresenceUpdate("available", remoteJid).catch(() => {});
        appendDailyChatLog({ jid: remoteJid, phone: cleanPhone || raw10, name: customerName, role: "ai_bot", text: locReply, meta: { gpsSanityFail: true, distanceKm: distRounded } });
        console.log(`└─────────────────────────────────────────────────────────────`);
        return;
      }
      // ── END GPS SANITY CHECK ───────────────────────────────────────────────
      const istGps = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const gpsHour = istGps.getHours();
      const gpsDay = istGps.getDay();
      const isNightGps = gpsHour >= 20;
      const isEarlyGps = gpsHour < 8;
      const isEveningGps = gpsHour >= 16 && gpsHour < 20;
      const isThuNightOrFriGps = (gpsDay === 4 && isNightGps && !isFridayOperationsOpen()) || (gpsDay === 5 && !isFridayOperationsOpen());
      const effectiveGpsEveningSurge = isThuNightOrFriGps ? false : isEveningGps;
      const surgeGps = effectiveGpsEveningSurge ? 40 : 0;
      const gpsScheduleDayLabel = isThuNightOrFriGps ? "Saturday" : "tomorrow";
      const gpsClosedLeadLine = (gpsDay === 5 && !isFridayOperationsOpen())
        ? "Our Recirculatory Aquaculture System at Malabagh and express deliveries are closed on Fridays for weekly maintenance & filtration backwash."
        : isThuNightOrFriGps
        ? "Deliveries for tonight closed at 8:00 PM (and our farm is strictly closed Fridays for maintenance)."
        : "Deliveries for tonight closed at 8:00 PM.";

      try {
        // ALWAYS save verified coordinates and mapsUrl in chatMetadata regardless of distance!
        const locUpdateIso = new Date().toISOString();
        if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
        chatMetadata[remoteJid].latitude = detectedLat;
        chatMetadata[remoteJid].longitude = detectedLng;
        chatMetadata[remoteJid].distanceKm = distNum;
        chatMetadata[remoteJid].googleMapsUrl = mapsUrl;
        chatMetadata[remoteJid].locationUpdatedAt = locUpdateIso;
        chatMetadata[remoteJid].lastUserMsgTime = msgStartTime;
        chatMetadata[remoteJid].lastUserText = (text || "[WhatsApp Location Pin]").slice(0, 150);
        if (cleanPushName) chatMetadata[remoteJid].pushName = cleanPushName;
        if (cleanPhone) chatMetadata[remoteJid].phone = cleanPhone;
        if (detectedLocalityName) chatMetadata[remoteJid].localityName = detectedLocalityName;
        if (cleanPhone) {
          if (!chatMetadata[cleanPhone]) chatMetadata[cleanPhone] = {};
          chatMetadata[cleanPhone].latitude = detectedLat;
          chatMetadata[cleanPhone].longitude = detectedLng;
          chatMetadata[cleanPhone].distanceKm = distNum;
          chatMetadata[cleanPhone].googleMapsUrl = mapsUrl;
          chatMetadata[cleanPhone].locationUpdatedAt = locUpdateIso;
          if (detectedLocalityName) chatMetadata[cleanPhone].localityName = detectedLocalityName;
        }
        if (raw10) {
          if (!chatMetadata[raw10]) chatMetadata[raw10] = {};
          chatMetadata[raw10].latitude = detectedLat;
          chatMetadata[raw10].longitude = detectedLng;
          chatMetadata[raw10].distanceKm = distNum;
          chatMetadata[raw10].googleMapsUrl = mapsUrl;
          chatMetadata[raw10].locationUpdatedAt = locUpdateIso;
          chatMetadata[raw10].lastUserMsgTime = msgStartTime;
          chatMetadata[raw10].lastUserText = (text || "[WhatsApp Location Pin]").slice(0, 150);
          if (cleanPushName) chatMetadata[raw10].pushName = cleanPushName;
          chatMetadata[raw10].phone = cleanPhone;
          if (detectedLocalityName) chatMetadata[raw10].localityName = detectedLocalityName;
        }
        saveChatMetadata();

        // Check if this customer has an ACTIVE pending order (unfulfilled)
        let orders = {};
        try {
          const ordersFilePath = path.join(__dirname, "customer_orders.json");
          if (fs.existsSync(ordersFilePath)) orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8"));
        } catch (_) {}

        const activeOrder = findActiveCustomerOrder(orders, cleanPhone || raw10, remoteJid);
        const isAlreadyPaid = activeOrder && isOrderActiveAndPaid(activeOrder);

        // Save GPS coordinates to active order record for Express Dispatch navigation
        if (activeOrder) {
          activeOrder.latitude = detectedLat;
          activeOrder.longitude = detectedLng;
          activeOrder.googleMapsUrl = mapsUrl;
          activeOrder.distanceKm = distNum;
          recordNewCustomerOrder((cleanPhone || raw10) || remoteJid, activeOrder);
        }

        const liveLocAdvice = isLiveLoc
          ? `\n\n📌 *Friendly Note:* You shared a WhatsApp Live Location. While our system captured your coordinates, for 100% accurate pin delivery, kindly also drop a static pin (tap 📎 ➔ Location ➔ "Send your current location"). 📍`
          : "";
        const pinPolicyNote = `\n\n📌 *Express Dispatch:* Our rider navigates strictly to your shared GPS pin. Please keep your phone reachable so the rider can call prior to arrival for a smooth handover at your shared pin. 🐟${liveLocAdvice}`;
        const gpsWeatherPolicy = evaluateWeatherDeliveryPolicy(distNum);
        const weatherPinNote = gpsWeatherPolicy.deliverWithDelayWarning ? `\n\n${gpsWeatherPolicy.delayWarningText}` : "";
        const paidWeatherPinNote = gpsWeatherPolicy.weather.isBadWeather
          ? `\n\n${gpsWeatherPolicy.weatherIcon} *${gpsWeatherPolicy.weatherNoun === "snowfall" ? "Snowfall" : "Rain"} in your area:* Deliveries are active! Since our riders are navigating extra carefully on wet roads, please allow 15–20 minutes extra transit time for your live-harvested pack.`
          : "";

        const hasExplicitTomorrowSchedule =
          Boolean(activeOrder?.scheduledSlot) ||
          chatHist.slice(-4).some(m => m.text && /\b(?:scheduled slot:\s*(?:tomorrow|saturday)|slot for tomorrow|delivery for tomorrow|tomorrow morning|tomorrow\s*(?:\([^)]+\)\s*)?(?:8\s*[-–]\s*11|10\s*am|11\s*am|12\s*[-–]\s*3|4\s*[-–]\s*7))\b/i.test(m.text));

        if (activeOrder && isAlreadyPaid) {
          // ── STRICT PAID ORDER SHIELD ──
          // Customer has ALREADY paid! Order is genuine and active.
          console.log(`│ 🛡️ [PAID ORDER SHIELD] Customer ${cleanPhone || customerName} already paid for active order #${activeOrder.orderRef}. Locking coordinates for Express Dispatch!`);
          activeOrder.latitude = detectedLat;
          activeOrder.longitude = detectedLng;
          activeOrder.googleMapsUrl = mapsUrl;
          if (detectedLocalityName) activeOrder.deliveryArea = detectedLocalityName;
          recordNewCustomerOrder((cleanPhone || raw10) || remoteJid, activeOrder);
          syncWhatsAppOrderToSupabase(activeOrder, activeOrder.paymentId).catch((syncErr) => {
            console.warn("[Supabase Location Sync Notice]:", syncErr?.message || syncErr);
          });
          locReply = `📍 *Delivery Location Received & Coordinates Locked!* ✅\n\nThank you! We have locked your exact GPS coordinates for our *Urban Trout Express Dispatch Partner*.\n\nYour order (*#${activeOrder.orderRef}*) is paid & confirmed! Our team at the Recirculatory Aquaculture System at Malabagh has it scheduled for fresh live harvest.${paidWeatherPinNote}${pinPolicyNote}\n\n📍 Maps: ${mapsUrl}`;
          historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh. Active order #${activeOrder.orderRef} is PAID. Coordinates locked for Express Dispatch.]`;

          // If distance happens to be > 16.0 km on a paid order, notify owner immediately on Telegram for personal handling
          if (distNum > 16.0) {
            try {
              sendTelegramMessage(
                `⚠️ <b>PAID ORDER OUTER-ZONE GPS PIN ALERT</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 <b>Customer:</b> ${activeOrder.name || customerName || "Customer"} (<code>${cleanPhone || raw10}</code>)\n` +
                `📦 <b>Order Ref:</b> #${activeOrder.orderRef} (${activeOrder.items || "Fresh Trout"})\n` +
                `💰 <b>Amount Paid:</b> ${activeOrder.amount}\n` +
                `📏 <b>Pin Distance:</b> <b>${distRounded} km</b> from Recirculatory Aquaculture System at Malabagh\n` +
                `📍 <a href="${mapsUrl}"><b>Open Google Maps Pin</b></a>\n\n` +
                `💡 <i>Action: Bot locked coordinates. Dispatch express partner or coordinate directly with customer!</i>`
              ).catch(() => {});
            } catch (_) {}
          }
        } else if (distNum > 16.0) {
          locReply = `📍 *Location Check: Outside Delivery Perimeter* ⚠️\n\nYour location is *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh. Since we pack our live-harvest trout fresh in food-grade biodegradable polythene with *0% ice*, express delivery is limited to 16 km across Srinagar & nearby Ganderbal.\n\nHowever, you are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout and get it cleaned on the spot! 🐟\n📍 Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9`;
          historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh. OUTSIDE 16km perimeter. Express delivery not possible. Direct them to visit Live Vending Center in Malabagh.]`;
          console.log(`│ ⚠️ OUTSIDE 16km (${distRounded} km) — Directed to visit Live Vending Center in Malabagh`);
        } else if (gpsWeatherPolicy.blockedByWeather && !hasExplicitTomorrowSchedule) {
          console.log(`│ ${gpsWeatherPolicy.weatherIcon} [WEATHER HOLD >${WEATHER_RESTRICT_RADIUS_KM}km] Verified pin (${distRounded} km) paused during active ${gpsWeatherPolicy.weather.condition}.`);
          locReply = gpsWeatherPolicy.buildWetWeatherOutOfZoneMessage(detectedLocalityName || "Your Area", distRounded);
          historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh. ACTIVE ${gpsWeatherPolicy.weatherTitle.toUpperCase()} HOLD (>${WEATHER_RESTRICT_RADIUS_KM} km). Express delivery paused until weather clears; invited to Live Vending Center in Malabagh.]`;
        } else {
          // distNum <= 16.0 and not weather-blocked
          const userOnlyHist = chatHist.filter(m =>
            m.role === "user" &&
            m.text &&
            !isSyntheticSystemNote(m.text)
          );
          const isOrderIntentForPin = (s) => {
            if (!s || isExplicitCodInsistence(s)) return false;
            const hasQtyOrPack = /\b(?:\d+(?:\.\d+)?\s*(?:kg|kilo|kgs)|starter\s*pack|family\s*pack)\b/i.test(s);
            const isInfoQuestion = /\b(?:price|rate|cost|how\s+much|charges?|fee|available|availability|how\s+many\s+pieces?|pieces?\s+per|cod|cash\s+on\s+delivery)\b/i.test(s) &&
              !/\b(?:order|book|send|deliver|confirm|pack|want|need|buy|get|give|chahiye|chahie|bhej|de\s*do|kar\s*do|payment\s*link|qr|scanner)\b/i.test(s);
            return hasQtyOrPack && !isInfoQuestion;
          };
          const hasAgreedOrder = isOrderIntentForPin(text || "") || userOnlyHist.some(m => isOrderIntentForPin(m.text));
          const hasExistingPaymentLink = Boolean(activeOrder && !isAlreadyPaid && activeOrder.payUrl) ||
            chatHist.slice(-4).some(m => m.text && (m.text.includes("payments.cashfree.com") || m.text.includes("urbantrout.in/p") || m.text.includes("Official Cashfree Payment Link")));
          const isPendingOrderDiscussed = Boolean(activeOrder && !isAlreadyPaid) || hasAgreedOrder || hasExistingPaymentLink;

          if (isPendingOrderDiscussed) {
            // Customer already requested/discussed an order or has an unpaid order.
            // Recalculate order summary, delivery fee, and payment link dynamically for this newly verified location!
            let orderWeight = 2;
            let isWhole = false;

            if (activeOrder && activeOrder.items) {
              const mAct = activeOrder.items.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kgs)\b/i);
              if (mAct) orderWeight = parseFloat(mAct[1]);
              if (/\b(?:whole|sabut)\b/i.test(activeOrder.items)) isWhole = true;
            }

            const currentTurnWeightMatch = (text || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kgs)\b/i);
            if (currentTurnWeightMatch) {
              orderWeight = parseFloat(currentTurnWeightMatch[1]);
            } else {
              for (let i = userOnlyHist.length - 1; i >= 0; i--) {
                const m = userOnlyHist[i];
                if (m.text) {
                  const wMatch = m.text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|kgs)\b/i);
                  if (wMatch) { orderWeight = parseFloat(wMatch[1]); break; }
                }
              }
            }

            const rate = 580; // Whole trout is pickup-only; all delivery orders are Cleaned & Gutted @ 580/kg
            const fishCost = Math.round(orderWeight * rate);
            const courierFee = getDeliveryFeeForDistance(distNum, orderWeight, effectiveGpsEveningSurge);
            const totalPayable = fishCost + courierFee;
            const itemsDesc = `${orderWeight} kg × ${isWhole ? "Whole Fresh Trout" : "Cleaned & Gutted (Pan-Ready)"}${courierFee > 0 ? " (+Express Delivery)" : ""}`;
            const prevGpsMatch = activeOrder?.amount ? String(activeOrder.amount).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/) : null;
            const prevGpsAmt = prevGpsMatch ? Math.round(parseFloat(prevGpsMatch[1])) : null;
            const sameAmtGps = prevGpsAmt !== null && Math.abs(prevGpsAmt - Math.round(totalPayable)) <= 1;

            const reusablePin = TodayOrderPool.findReusablePaymentLink(cleanPhone || raw10, remoteJid, totalPayable);
            const orderRef = reusablePin?.orderRef || (sameAmtGps ? activeOrder?.orderRef : null) || `UT-WA-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;

            let generatedPayUrl = null;
            let generatedPaymentLinkId = null;
            let generatedCashfreeLinkId = null;
            let generatedBankDetailsText = null;
            try {
              if (reusablePin) {
                console.log(`♻️ [Link Reuse Pin] Reusing single active payment link ${reusablePin.url} (#${orderRef}) for ${cleanPhone || raw10} (₹${totalPayable})`);
                generatedPayUrl = reusablePin.url || reusablePin.short_url;
                generatedPaymentLinkId = reusablePin.paymentLinkId || reusablePin.id || null;
                generatedCashfreeLinkId = reusablePin.cashfreeLinkId || reusablePin.id || null;
              } else {
                const waterfallRes = await generatePaymentWithWaterfall({
                  amount: totalPayable,
                  customerPhone: cleanPhone || raw10,
                  customerName: customerName,
                  orderRef: orderRef,
                  description: itemsDesc,
                  preferQr: false
                });
                generatedPayUrl = waterfallRes.payUrl || null;
                generatedPaymentLinkId = waterfallRes.paymentLinkId || null;
                generatedCashfreeLinkId = waterfallRes.cashfreeLinkId || null;
                generatedBankDetailsText = waterfallRes.bankDetailsText || null;
              }
            } catch (plErr) {
              console.error("Payment link generation failed on location pin:", plErr.message);
            }

            const gpsCardSlot = isThuNightOrFriGps
              ? "Saturday Morning (8:00 AM – 11:00 AM)"
              : isNightGps
              ? "Tomorrow Morning (8:00 AM – 11:00 AM)"
              : (isEarlyGps ? "Today Morning (8:00 AM – 11:00 AM)" : "Within 90–120 Minutes (Today)");

            let card = formatOrderSummaryCard({
              orderRef,
              amount: totalPayable,
              desc: itemsDesc,
              deliveryArea: detectedLocalityName || "Srinagar",
              deliveryFee: courierFee,
              distanceKm: distRounded,
              localityName: detectedLocalityName || "Srinagar",
              scheduledSlot: gpsCardSlot,
              payUrl: generatedPayUrl || (!generatedBankDetailsText ? "https://urbantrout.in" : null)
            });
            if (!generatedPayUrl && generatedBankDetailsText) {
              card += `\n\n${generatedBankDetailsText}`;
            }

            locReply = `📍 *Location Received & Coordinates Locked!* ✅\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh (${detectedLocalityName || "Srinagar"}).\n🛵 Coordinates saved for our *Urban Trout Express Dispatch Partner*!${pinPolicyNote}\n\n${card}`;
            historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh (${detectedLocalityName || "Srinagar"}). Order generated/updated: ${itemsDesc} (₹${totalPayable}). Official payment link: ${generatedPayUrl || "See Bank Details / Payment Link"}]`;

            recordNewCustomerOrder((cleanPhone || raw10) || remoteJid, {
              orderRef,
              paymentLinkId: generatedPaymentLinkId || (sameAmtGps ? (activeOrder?.paymentLinkId || null) : null),
              cashfreeLinkId: generatedCashfreeLinkId || (sameAmtGps ? (activeOrder?.cashfreeLinkId || null) : null),
              chatId: remoteJid,
              phone: cleanPhone || raw10,
              name: customerName,
              items: itemsDesc,
              amount: `₹${totalPayable}`,
              status: generatedPayUrl ? "Payment Link Sent (Awaiting Upfront Payment)" : "Bank Transfer Details Sent",
              payUrl: generatedPayUrl || (sameAmtGps ? (activeOrder?.payUrl || null) : null),
              latitude: detectedLat,
              longitude: detectedLng,
              googleMapsUrl: mapsUrl,
              deliveryArea: detectedLocalityName || "Srinagar",
              distanceKm: distRounded,
              deliveryFee: courierFee,
              deliveryTime: gpsCardSlot,
              ...(sameAmtGps && activeOrder?.createdAt ? { createdAt: activeOrder.createdAt } : { createdAt: new Date().toISOString() }),
              updatedAt: new Date().toISOString()
            });
          } else {
            // First time inquiry via location pin (no order discussed yet) - show tier pricing for their distance
            const gpsPolicyLine = `📌 _Delivered directly to your shared GPS pin. Please keep your phone reachable — our rider calls prior to arrival for a prompt handover at your shared pin._`;
            const useAdvanceSlotGps = isNightGps || isThuNightOrFriGps;
            if (distNum <= 4.0) {
              locReply = useAdvanceSlotGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express delivery is 100% FREE* (min order 2 kg, zero extra fees)!\n${gpsPolicyLine}\n${gpsClosedLeadLine} We can schedule your harvest for ${gpsScheduleDayLabel} (Morning 8–11 AM, Afternoon 12–3 PM, or Evening 4–7 PM).\n\nHow many Kgs and which ${gpsScheduleDayLabel} slot would you prefer? 🐟`
                : isEarlyGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express delivery is 100% FREE* (min order 2 kg, zero extra fees)!\n${gpsPolicyLine}\nGood morning! Live harvest begins at 8:00 AM sharp today (Morning slot: 8:00 AM – 11:00 AM).\n\nHow many Kgs would you like to order today? 🐟`
                : `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express delivery is 100% FREE* within 2 hours of payment confirmation (min order 2 kg, zero extra fees)!\n${gpsPolicyLine}\n\nHow many Kgs would you like to order? 🐟`;
              historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh. Minimum order for free delivery is 2 kg.]`;
            } else if (distNum <= 7.0) {
              locReply = useAdvanceSlotGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹${55 + surgeGps} delivery fee (₹${1215 + surgeGps} total).\n${gpsPolicyLine}\n${gpsClosedLeadLine} We can schedule ${gpsScheduleDayLabel} morning!\n\nWould you like 3 kg free delivery or 2 kg scheduled for ${gpsScheduleDayLabel}? 🐟`
                : isEarlyGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹${55 + surgeGps} delivery fee (₹${1215 + surgeGps} total).\n${gpsPolicyLine}\nGood morning! Harvest begins at 8:00 AM sharp today (Morning slot: 8:00 AM – 11:00 AM).\n\nWould you like 3 kg free delivery or 2 kg for today's morning harvest? 🐟`
                : `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹${55 + surgeGps} delivery fee (₹${1215 + surgeGps} total)${effectiveGpsEveningSurge ? " (includes ₹40 evening rush surcharge)" : ""}.\n${gpsPolicyLine}\n\nWould you like 3 kg free delivery or 2 kg? 🐟`;
              historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh. Free delivery on 3 kg+ (₹1740); 2 kg has ₹${55 + surgeGps} fee (₹${1215 + surgeGps}); 1 kg has ₹${75 + surgeGps} fee (₹${655 + surgeGps}).]`;
            } else if (distNum <= 11.5) {
              locReply = useAdvanceSlotGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹${89 + surgeGps} delivery fee (₹${1249 + surgeGps} total).\n${gpsPolicyLine}\n${gpsClosedLeadLine} We can schedule ${gpsScheduleDayLabel} morning!\n\nWould you like 3 kg free delivery or 2 kg scheduled for ${gpsScheduleDayLabel}? 🐟`
                : isEarlyGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹${89 + surgeGps} delivery fee (₹${1249 + surgeGps} total).\n${gpsPolicyLine}\nGood morning! Harvest begins at 8:00 AM sharp today (Morning slot: 8:00 AM – 11:00 AM).\n\nWould you like 3 kg free delivery or 2 kg for today's morning harvest? 🐟`
                : `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹${89 + surgeGps} delivery fee (₹${1249 + surgeGps} total)${effectiveGpsEveningSurge ? " (includes ₹40 evening rush surcharge)" : ""}.\n${gpsPolicyLine}\n\nWould you like 3 kg free delivery or 2 kg? 🐟`;
              historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh. Free delivery on 3 kg+ (₹1740); 2 kg has ₹${89 + surgeGps} fee (₹${1249 + surgeGps}); 1 kg has ₹${130 + surgeGps} fee (₹${710 + surgeGps}).]`;
            } else {
              locReply = useAdvanceSlotGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on our 5 kg family pack (₹2,900 total)! We can also send 2 kg for ₹${139 + surgeGps} delivery fee (₹${1299 + surgeGps} total), 3 kg for ₹${129 + surgeGps} (₹${1869 + surgeGps} total), or 4 kg for ₹${109 + surgeGps} (₹${2429 + surgeGps} total).\n${gpsPolicyLine}\n${gpsClosedLeadLine} We can schedule ${gpsScheduleDayLabel} morning!\n\nWould you like 5 kg free delivery or 2 kg scheduled for ${gpsScheduleDayLabel}? 🐟`
                : isEarlyGps
                ? `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on our 5 kg family pack (₹2,900 total)! We can also send 2 kg for ₹${139 + surgeGps} delivery fee (₹${1299 + surgeGps} total), 3 kg for ₹${129 + surgeGps} (₹${1869 + surgeGps} total), or 4 kg for ₹${109 + surgeGps} (₹${2429 + surgeGps} total).\n${gpsPolicyLine}\nGood morning! Harvest begins at 8:00 AM sharp today (Morning slot: 8:00 AM – 11:00 AM).\n\nWould you like 5 kg free delivery or 2 kg for today's morning harvest? 🐟`
                : `📍 *Location Received & Verified!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Express Delivery:* 100% FREE on our 5 kg family pack (₹2,900 total)! We can also send 2 kg for ₹${139 + surgeGps} delivery fee (₹${1299 + surgeGps} total), 3 kg for ₹${129 + surgeGps} (₹${1869 + surgeGps} total), or 4 kg for ₹${109 + surgeGps} (₹${2429 + surgeGps} total)${effectiveGpsEveningSurge ? " (includes ₹40 evening rush surcharge)" : ""}.\n${gpsPolicyLine}\n\nWould you like to confirm 5 kg free delivery or 2 kg? 🐟`;
              historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh. Free delivery on 5 kg family pack (₹2900); 4 kg has ₹${109 + surgeGps} fee (₹${2429 + surgeGps}); 3 kg has ₹${129 + surgeGps} fee (₹${1869 + surgeGps}); 2 kg has ₹${139 + surgeGps} fee (₹${1299 + surgeGps}); 1 kg has ₹${190 + surgeGps} fee (₹${770 + surgeGps}).]`;
            }
            if (weatherPinNote && locReply) {
              locReply += weatherPinNote;
            }
          }
          console.log(`│ ✅ IN RANGE (<=16km, ${distRounded} km) — Saved: ${mapsUrl}`);
        }
      } catch (gpsErr) {
        console.error(`❌ [GPS Pin Handler Error] ${gpsErr?.stack || gpsErr}`);
        locReply = `📍 *Location Received!* ✅\n\nYour shared location is approximately *${distRounded} km* from our Recirculatory Aquaculture System at Malabagh.\n\nHow many Kgs of *Cleaned & Gutted* fresh Rainbow Trout (₹580/kg) would you like to order? Packed in food-grade biodegradable polythene (0% ice) and delivered by our *Urban Trout Express Dispatch Partner* directly to your shared GPS pin (please keep phone reachable — our rider calls prior to arrival for a prompt handover at your shared pin). 🐟`;
        historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Recirculatory Aquaculture System at Malabagh.]`;
      }
      console.log(`└─────────────────────────────────────────────────────────────`);

      chatHist.push({ role: "user", text: historyNote });
      chatHist.push({ role: "model", text: locReply });
      if (chatHist.length > 8) chatHist.splice(0, chatHist.length - 8);
      chatHistories.set(remoteJid, chatHist);
      saveChatHistories();

      const sentLocReply = await sock.sendMessage(remoteJid, { text: locReply });
      if (sentLocReply?.key?.id) {
        botSentMessageIds.add(sentLocReply.key.id);
        setTimeout(() => botSentMessageIds.delete(sentLocReply.key.id), 10 * 60 * 1000);
      }
      await sock.sendPresenceUpdate("available", remoteJid).catch(() => {});
      if (chatMetadata[remoteJid]) {
        chatMetadata[remoteJid].lastBotMsgTime = Date.now();
        chatMetadata[remoteJid].lastMsgRole = "model";
        chatMetadata[remoteJid].lastBotReply = locReply.replace(/[\r\n]+/g, " ").slice(0, 150);
      }
      if (raw10 && chatMetadata[raw10]) {
        chatMetadata[raw10].lastBotMsgTime = Date.now();
        chatMetadata[raw10].lastMsgRole = "model";
        chatMetadata[raw10].lastBotReply = locReply.replace(/[\r\n]+/g, " ").slice(0, 150);
      }
      saveChatMetadata();
      appendDailyChatLog({
        jid: remoteJid,
        phone: cleanPhone || raw10,
        name: customerName,
        role: "ai_bot",
        text: locReply,
        meta: { gpsVerified: true, distanceKm: distRounded }
      });

      // Link-only mode: GPS ORDER SUMMARY card already contains the 1-Tap Cashfree Payment Link
      return;
    }

    // Check if customer sent an audio / voice note (supports Gemini audio transcription with key rotation + graceful fallback)
    let effectiveUserText = text;
    let transcribedVoice = "";
    const isVoiceNoteInput = Boolean(innerMessage.audioMessage) || effectiveUserText === "[Voice Note]";
    if (isVoiceNoteInput && !isOwner) {
      if (innerMessage.audioMessage && typeof downloadMediaMessage === "function") {
        try {
          const audioBuf = await downloadMediaMessage(msg, "buffer", {});
          if (audioBuf && audioBuf.length > 0 && audioBuf.length < 4 * 1024 * 1024 && GEMINI_API_KEYS.length > 0) {
            const audioMime = (innerMessage.audioMessage.mimetype || "audio/ogg").split(";")[0];
            const audioPayload = JSON.stringify({
              contents: [{
                role: "user",
                parts: [
                  { text: "Transcribe and translate this customer WhatsApp voice note (may be in Kashmiri, Urdu, Hindi, or English) into a single short plain English/Hinglish sentence preserving any Srinagar area names, quantities in kg, or questions. Return ONLY the clean customer request text." },
                  { inlineData: { mimeType: audioMime, data: audioBuf.toString("base64") } }
                ]
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 200 }
            });
            for (let kTry = 0; kTry < GEMINI_API_KEYS.length; kTry++) {
              const voiceKey = GEMINI_API_KEYS[(activeKeyIndex + kTry) % GEMINI_API_KEYS.length];
              if (!voiceKey) continue;
              const attempt = await new Promise((resolve) => {
                const req = https.request(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${voiceKey}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(audioPayload) },
                  timeout: 8000
                }, (res) => {
                  let d = "";
                  res.on("data", c => d += c);
                  res.on("end", () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                      resolve({ retry: true, status: res.statusCode, text: "" });
                      return;
                    }
                    try {
                      const j = JSON.parse(d);
                      resolve({ retry: false, text: j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "" });
                    } catch { resolve({ retry: true, text: "" }); }
                  });
                });
                req.on("error", () => resolve({ retry: true, text: "" }));
                req.on("timeout", () => { req.destroy(); resolve({ retry: true, text: "" }); });
                req.write(audioPayload);
                req.end();
              });
              if (attempt.text) {
                transcribedVoice = attempt.text;
                activeKeyIndex = (activeKeyIndex + kTry) % GEMINI_API_KEYS.length;
                break;
              }
              if (!attempt.retry) break;
            }
          }
        } catch (vErr) {
          console.warn("[Voice Note Transcription Fallback]:", vErr.message);
        }
      }

      if (transcribedVoice && transcribedVoice.length >= 2) {
        console.log(`🎙️ [Voice Note Transcribed] ${remoteJid} -> "${transcribedVoice}"`);
        effectiveUserText = normalizeCustomerText(transcribedVoice);
      } else {
        console.log(`🎙️ [Voice Note Received] Customer sent an audio note (${remoteJid}). Sending friendly text prompt.`);
        const voiceReply = `Assalam-o-Alaikum! 🐟 Thank you for reaching out to Urban Trout!\n\nWe received your voice note. Our team is listening to it! For the fastest dispatch, you can also text us your *delivery location* and *desired quantity in kg* (or tap 📎 ➔ Location to send your pin 📍).\n\nWe look forward to serving you fresh live-harvest trout!`;
        try {
          const sentVoicePrompt = await sock.sendMessage(remoteJid, { text: voiceReply });
          if (sentVoicePrompt?.key?.id) {
            botSentMessageIds.add(sentVoicePrompt.key.id);
            setTimeout(() => botSentMessageIds.delete(sentVoicePrompt.key.id), 10 * 60 * 1000);
          }
          await sock.sendPresenceUpdate("available", remoteJid).catch(() => {});
          appendDailyChatLog({
            jid: remoteJid,
            phone: cleanPhone || raw10,
            name: customerName,
            role: "ai_bot",
            text: voiceReply,
            meta: { voicePrompt: true }
          });
          let chatHist = chatHistories.get(remoteJid) || [];
          chatHist.push({ role: "user", text: "[Customer sent an audio / voice note]" });
          chatHist.push({ role: "model", text: voiceReply });
          if (chatHist.length > 8) chatHist.splice(0, chatHist.length - 8);
          chatHistories.set(remoteJid, chatHist);
          saveChatHistories();
          if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
          chatMetadata[remoteJid].lastUserMsgTime = msgStartTime;
          chatMetadata[remoteJid].lastBotMsgTime = Date.now();
          chatMetadata[remoteJid].lastMsgRole = "model";
          chatMetadata[remoteJid].lastBotReply = voiceReply.replace(/[\r\n]+/g, " ").slice(0, 150);
          saveChatMetadata();
          sendTelegramMessage(`🎙️ <b>VOICE NOTE RECEIVED (NEEDS LISTEN)</b>\n━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Customer:</b> ${customerName || "Customer"} (<code>${displayPhone}</code>)\n👉 <a href="https://wa.me/${cleanPhone || raw10}">Open WhatsApp Chat</a>`).catch(() => {});
        } catch (_) {}
        return;
      }
    }

    const docAttachment = innerMessage.documentMessage || innerMessage.documentWithCaptionMessage?.message?.documentMessage;
    const isImageAttachment = Boolean(innerMessage.imageMessage);
    const isDocReceiptAttachment = Boolean(docAttachment) && /\b(?:pdf|image|jpeg|jpg|png|webp)\b/i.test(`${docAttachment.mimetype || ""} ${docAttachment.fileName || ""}`);
    const isPaymentProofCaption = Boolean(effectiveUserText) &&
      /\b(?:paid|payment|paytm|gpay|phonepe|upi|mpay|utr|ref|transaction|receipt|screenshot|transfer(?:red)?|done|hdfc)\b/i.test(effectiveUserText) &&
      !/\b(?:link|qr|scanner|how\s+to\s+pay|send\s+qr|send\s+link)\b/i.test(effectiveUserText);

    if ((isImageAttachment || isDocReceiptAttachment) && !isOwner && (!effectiveUserText || isPaymentProofCaption)) {
      console.log(`📸 [Media / Payment Receipt Received] Customer sent ${isDocReceiptAttachment ? "document/PDF" : "image/screenshot"} (${remoteJid}). Sending friendly confirmation.`);
      const imageReply = `Thank you! We have received your ${isDocReceiptAttachment ? "payment receipt document" : "screenshot / image"}. 📸\n\nOur team at the Recirculatory Aquaculture System at Malabagh is reviewing it right now. If this is a payment confirmation for J&K Bank mPay or HDFC Soundbox QR, our team will verify the transaction and schedule your fresh live harvest right away! 🐟`;
      try {
        const sentImgReply = await sock.sendMessage(remoteJid, { text: imageReply });
        if (sentImgReply?.key?.id) {
          botSentMessageIds.add(sentImgReply.key.id);
          setTimeout(() => botSentMessageIds.delete(sentImgReply.key.id), 10 * 60 * 1000);
        }
        await sock.sendPresenceUpdate("available", remoteJid).catch(() => {});
        appendDailyChatLog({
          jid: remoteJid,
          phone: cleanPhone || raw10,
          name: customerName,
          role: "ai_bot",
          text: imageReply,
          meta: { imageReceipt: true, isDoc: isDocReceiptAttachment }
        });
        let chatHist = chatHistories.get(remoteJid) || [];
        chatHist.push({ role: "user", text: effectiveUserText ? `[Customer sent ${isDocReceiptAttachment ? "PDF/receipt" : "screenshot"}: ${effectiveUserText}]` : `[Customer sent an ${isDocReceiptAttachment ? "document/PDF receipt" : "image / payment screenshot"}]` });
        chatHist.push({ role: "model", text: imageReply });
        if (chatHist.length > 8) chatHist.splice(0, chatHist.length - 8);
        chatHistories.set(remoteJid, chatHist);
        saveChatHistories();
        if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
        chatMetadata[remoteJid].lastUserMsgTime = msgStartTime;
        chatMetadata[remoteJid].lastBotMsgTime = Date.now();
        chatMetadata[remoteJid].lastMsgRole = "model";
        chatMetadata[remoteJid].lastBotReply = imageReply.replace(/[\r\n]+/g, " ").slice(0, 150);
        saveChatMetadata();

        // Dispatch an alert to Telegram so Suhail can verify the payment screenshot or receipt!
        try {
          const captionNote = effectiveUserText ? `\n💬 <b>Caption:</b> <i>"${effectiveUserText.slice(0, 180)}"</i>` : "";
          const tgAlert = `📸 <b>NEW PAYMENT / ${isDocReceiptAttachment ? "PDF RECEIPT" : "IMAGE SCREENSHOT"} RECEIVED</b>\n━━━━━━━━━━━━━━━━━━━━━\n👤 <b>Customer:</b> ${customerName || "Customer"} (<code>${displayPhone}</code>)${captionNote}\n📍 <b>Chat:</b> <a href="https://wa.me/${cleanPhone || raw10}">Open WhatsApp Chat</a>\n\n👉 Customer shared a ${isDocReceiptAttachment ? "document/PDF" : "photo/screenshot"} on WhatsApp. Please check and send <code>#paid</code> to confirm!`;
          await sendTelegramMessage(tgAlert);
        } catch (_) {}
      } catch (_) {}
      return;
    }

    if (!effectiveUserText || effectiveUserText.trim().length === 0) {
      return;
    }

    // Locality already resolved above (prior to GPS pin handler)

    // Track user message in metadata
    if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
    chatMetadata[remoteJid].lastUserMsgTime = msgStartTime;
    chatMetadata[remoteJid].lastMsgRole = "user";
    chatMetadata[remoteJid].lastUserText = effectiveUserText.slice(0, 150);
    if (cleanPushName) chatMetadata[remoteJid].pushName = cleanPushName;
    if (cleanPhone) chatMetadata[remoteJid].phone = cleanPhone;

    const activeNewLocality = (locDetected && locDetected.status === "IN_ZONE") ? locDetected.name : detectedLocalityName;
    const activeNewDist = (locDetected && locDetected.status === "IN_ZONE") ? locDetected.dist : null;
    const shouldOverwriteLoc = Boolean(locDetected && locDetected.status === "IN_ZONE");

    if (activeNewLocality) {
      if (shouldOverwriteLoc || !chatMetadata[remoteJid].localityName || /^(?:srinagar|kashmir)$/i.test(chatMetadata[remoteJid].localityName)) {
        chatMetadata[remoteJid].localityName = activeNewLocality;
        if (activeNewDist !== null) chatMetadata[remoteJid].distanceKm = activeNewDist;
        chatMetadata[remoteJid].locationUpdatedAt = new Date().toISOString();
      }
      if (cleanPhone) {
        if (!chatMetadata[cleanPhone]) chatMetadata[cleanPhone] = {};
        if (shouldOverwriteLoc || !chatMetadata[cleanPhone].localityName || /^(?:srinagar|kashmir)$/i.test(chatMetadata[cleanPhone].localityName)) {
          chatMetadata[cleanPhone].localityName = activeNewLocality;
          if (activeNewDist !== null) chatMetadata[cleanPhone].distanceKm = activeNewDist;
          chatMetadata[cleanPhone].locationUpdatedAt = new Date().toISOString();
        }
      }
      if (raw10) {
        if (!chatMetadata[raw10]) chatMetadata[raw10] = {};
        if (shouldOverwriteLoc || !chatMetadata[raw10].localityName || /^(?:srinagar|kashmir)$/i.test(chatMetadata[raw10].localityName)) {
          chatMetadata[raw10].localityName = activeNewLocality;
          if (activeNewDist !== null) chatMetadata[raw10].distanceKm = activeNewDist;
          chatMetadata[raw10].locationUpdatedAt = new Date().toISOString();
        }
      }
    }

    if (raw10) {
      if (!chatMetadata[raw10]) chatMetadata[raw10] = {};
      chatMetadata[raw10].lastUserMsgTime = msgStartTime;
      chatMetadata[raw10].lastMsgRole = "user";
      chatMetadata[raw10].lastUserText = effectiveUserText.slice(0, 150);
      if (cleanPushName) chatMetadata[raw10].pushName = cleanPushName;
      chatMetadata[raw10].phone = cleanPhone;
    }
    saveChatMetadata();

    // ─── 0. BULLETPROOF DIRECT SCANNER / QR & LINK INTERCEPT (ZERO DUPLICATE MESSAGES) ───
    const chatHist = chatHistories.get(remoteJid) || [];
    const isPausedForOwner = isChatManuallyPaused(remoteJid, cleanPhone || raw10);
    const activeTodayOrd = TodayOrderPool.getTodayOrder(cleanPhone || raw10, remoteJid);
    const wantsHdfcQr = isExplicitQrScannerAsk(effectiveUserText);
    const newQtyMatch = effectiveUserText.match(/\b(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\b/i);
    const oldQtyMatch = activeTodayOrd?.items ? String(activeTodayOrd.items).match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\b/i) : null;
    const isChangingOrderQty = Boolean(
      activeTodayOrd && !TodayOrderPool.isOrderPaid(activeTodayOrd) &&
      newQtyMatch && oldQtyMatch && Math.abs(parseFloat(newQtyMatch[1]) - parseFloat(oldQtyMatch[1])) > 0.01
    );
    if (!isPausedForOwner && (!isChangingOrderQty || wantsHdfcQr) && isCustomerRequestingQr(effectiveUserText, chatHist)) {
      const qrSent = await dispatchLockedQrImage(sock, remoteJid, {
        cleanPhone,
        raw10,
        customerName,
        preferHdfcQr: wantsHdfcQr,
        chatHist: [...chatHist, { role: "user", text: effectiveUserText }]
      });
      if (qrSent) return;
    }

    // ─── 0b. CUSTOMER CALL REQUEST INTERCEPT ───
    const isCallRequest = /^(?:can\s+you\s+call|call\s+me|please\s+call|give\s+me\s+a\s+call|call\s+karo|phone\s+karo|call\s+kijiye|call\s+kar\s+sakte\s+ho|call\s+kar\s+lo|call\s+karein)[!.,?\s]*$/i.test(effectiveUserText.trim());
    if (isCallRequest) {
      console.log(`📞 [Customer Call Request] ${customerName} (${cleanPhone || raw10}) asked for a call. Replying with polite confirmation and alerting owner.`);
      const callReply = `Understood! Our farm team will give you a call shortly on this number. 🐟`;
      const callSent = await sock.sendMessage(remoteJid, { text: callReply });
      if (callSent?.key?.id) {
        botSentMessageIds.add(callSent.key.id);
        setTimeout(() => botSentMessageIds.delete(callSent.key.id), 10 * 60 * 1000);
      }
      await sock.sendPresenceUpdate("available", remoteJid).catch(() => {});
      appendDailyChatLog({
        jid: remoteJid,
        phone: cleanPhone || raw10,
        name: customerName,
        role: "ai_bot",
        text: callReply,
        meta: { callRequest: true }
      });
      chatHist.push({ role: "user", text: effectiveUserText });
      chatHist.push({ role: "model", text: callReply });
      if (chatHist.length > 8) chatHist.splice(0, chatHist.length - 8);
      chatHistories.set(remoteJid, chatHist);
      saveChatHistories();
      chatMetadata[remoteJid].lastBotMsgTime = Date.now();
      chatMetadata[remoteJid].lastMsgRole = "model";
      chatMetadata[remoteJid].lastBotReply = callReply;
      saveChatMetadata();

      try {
        const callOwnerDesk = "917006604148@s.whatsapp.net";
        const callPhoneText = displayPhone || cleanPhone || raw10 || remoteJid;
        await sock.sendMessage(callOwnerDesk, {
          text: `📞 *CUSTOMER CALL REQUEST*\n\n• *Name:* ${customerName || "Customer"}\n• *Phone:* ${callPhoneText}\n• *Message:* "${effectiveUserText}"\n\n👉 Customer asked for a phone call on WhatsApp!`
        });
        await sendTelegramMessage(`📞 <b>CUSTOMER CALL REQUEST</b>\n━━━━━━━━━━━━━━━━━━━━\n👤 <b>Customer:</b> ${customerName || "Customer"} (<code>${callPhoneText}</code>)\n💬 <b>Message:</b> "${effectiveUserText}"\n\n👉 <a href="https://wa.me/${cleanPhone || raw10}">Open WhatsApp Chat</a>`);
      } catch (_) {}
      return;
    }

    // Register active generation turn for abort guard
    const currentTurnId = Date.now() + Math.random();
    activeChatGenerations.set(remoteJid, { turnId: currentTurnId, startTime: Date.now(), promptText: effectiveUserText });

    // Maintain typing presence while Gemini prepares the response (non-blocking)
    sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});

    let pendingHdfcQrTagPayload = null;
    try {
      const aiReply = await generateGeminiReply(remoteJid, effectiveUserText, cleanPhone, customerName, {
        isVoiceNote: Boolean(transcribedVoice),
        onDispatchHdfcQr: (qrPayload) => {
          pendingHdfcQrTagPayload = qrPayload;
        },
        isAborted: () => {
          const g = activeChatGenerations.get(remoteJid);
          return !g || g.turnId !== currentTurnId;
        }
      });

      // IN-FLIGHT GENERATION ABORT CHECK:
      // If customer sent another message while AI was generating, discard this reply!
      const currentGen = activeChatGenerations.get(remoteJid);
      if (!currentGen || currentGen.turnId !== currentTurnId) {
        console.log(`🛑 [In-Flight Reply Discarded] Generation aborted for ${formatPhoneDisplay(cleanPhone)} because customer sent a newer message.`);
        return;
      }
      activeChatGenerations.delete(remoteJid);

      const responseTimeMs = Date.now() - msgStartTime;
      const responseTimeSec = (responseTimeMs / 1000).toFixed(1);

      const istDate = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
      const istTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
      const activeLocality = (chatMetadata[remoteJid] && chatMetadata[remoteJid].localityName) || (raw10 && chatMetadata[raw10] && chatMetadata[raw10].localityName) || "Srinagar (Area Pending)";
      const activeKeyNum = (activeKeyIndex % (GEMINI_API_KEYS.length || 1)) + 1;

      console.log(`\n┌──────────────────────────────────────────────────────────────────────────`);
      console.log(`│ 💬 [INCOMING WHATSAPP CHAT] 📅 ${istDate} • ⏰ ${istTime}`);
      console.log(`│ 👤 Name: ${customerName}${msg.pushName ? ` (WA: "${msg.pushName}")` : ""} | 📞 Phone: ${displayPhone}`);
      console.log(`│ 📍 Area: ${activeLocality}`);
      console.log(`│ 📩 Customer: "${effectiveUserText}"`);
      console.log(`├──────────────────────────────────────────────────────────────────────────`);
      console.log(`│ 🤖 [AI SALES AGENT] Model: ${lastActiveGeminiModel} | Key #${activeKeyNum} | ⚡ Speed: ${responseTimeMs}ms (${responseTimeSec}s)`);
      console.log(`│ 📤 Reply: "${aiReply.replace(/\n+/g, ' ')}"`);
      console.log(`└──────────────────────────────────────────────────────────────────────────\n`);

      // Send verified text reply (unless reply is strictly a [HDFC_QR] dispatch)
      if (aiReply && aiReply.trim() !== "__HDFC_QR_ONLY__") {
        const sentMsg = await sock.sendMessage(remoteJid, { text: aiReply });
        if (sentMsg && sentMsg.key && sentMsg.key.id) {
          botSentMessageIds.add(sentMsg.key.id);
          setTimeout(() => botSentMessageIds.delete(sentMsg.key.id), 10 * 60 * 1000);
        }
        await sock.sendPresenceUpdate("available", remoteJid).catch(() => {});
        appendDailyChatLog({
          jid: remoteJid,
          phone: cleanPhone || raw10,
          name: customerName,
          role: "ai_bot",
          text: aiReply,
          meta: { responseMs: responseTimeMs, locality: activeLocality }
        });
      }

      if (pendingHdfcQrTagPayload) {
        await dispatchLockedQrImage(sock, remoteJid, {
          cleanPhone,
          raw10,
          customerName,
          forceAmount: pendingHdfcQrTagPayload.amount,
          forceRef: pendingHdfcQrTagPayload.orderRef,
          forceDesc: pendingHdfcQrTagPayload.desc,
          forceDeliveryFee: pendingHdfcQrTagPayload.deliveryFee || 0,
          preferHdfcQr: true,
          bypassLocationGuard: true,
          chatHist: [...(chatHistories.get(remoteJid) || [])]
        });
      }

      // Link-only mode: Gemini ORDER SUMMARY card already contains the short 1-Tap Cashfree link (no companion QR image sent)

      // ─── PROACTIVE FISH PHOTO DISPATCH WHEN CUSTOMER EXPLICITLY ASKS FOR PICTURES ───
      const customerWantsFishPhoto = (
        /\b(?:pic|pics|photo|photos|picture|pictures|tasveer|snap|image)\b/i.test(effectiveUserText) &&
        !/\b(?:qr|scanner|upi|payment|pay|receipt|screenshot|proof)\b/i.test(effectiveUserText)
      );
      if (customerWantsFishPhoto) {
        const fishPhotoPath = path.join(__dirname, "cleaned_gutted_trout.jpg");
        if (fs.existsSync(fishPhotoPath)) {
          try {
            const photoSent = await sock.sendMessage(remoteJid, {
              image: fs.readFileSync(fishPhotoPath),
              caption: `🐟 *Urban Trout Aquaculture — Fresh Cleaned & Gutted Trout*\n• Pan-ready steaks (descaled, gutted & zero kitchen mess)\n• Harvested live to order with *0% Ice* — *₹580/kg*`
            });
            if (photoSent?.key?.id) {
              botSentMessageIds.add(photoSent.key.id);
              setTimeout(() => botSentMessageIds.delete(photoSent.key.id), 10 * 60 * 1000);
            }
            console.log(`📸 [Product Photo Dispatched] Sent Cleaned & Gutted trout photo to ${displayPhone}`);
          } catch (photoErr) {
            console.warn("Notice: Product photo dispatch error:", photoErr.message);
          }
        }
      }

      // Track bot response in metadata
      chatMetadata[remoteJid].lastBotMsgTime = Date.now();
      chatMetadata[remoteJid].lastMsgRole = "model";
      chatMetadata[remoteJid].lastResponseTimeMs = responseTimeMs;
      chatMetadata[remoteJid].lastBotReply = aiReply.replace(/[\r\n]+/g, ' ').slice(0, 150);

      if (raw10) {
        chatMetadata[raw10].lastBotMsgTime = Date.now();
        chatMetadata[raw10].lastMsgRole = "model";
        chatMetadata[raw10].lastResponseTimeMs = responseTimeMs;
        chatMetadata[raw10].lastBotReply = aiReply.replace(/[\r\n]+/g, ' ').slice(0, 150);
      }
      saveChatMetadata();


    } catch (err) {
      console.error(`❌ Error generating/sending reply for ${displayPhone}:`, err.message);
    } finally {
      const g = activeChatGenerations.get(remoteJid);
      if (g && g.turnId === currentTurnId) activeChatGenerations.delete(remoteJid);
    }
  }

  // ─── SMART MULTI-MESSAGE RAPID-FIRE FLUSHER ───
  function flushDebounce(remoteJid) {
    const batch = chatDebounceBuffers.get(remoteJid);
    if (!batch) return;

    // If customer is actively typing and has been buffered for less than 25s safety cap, hold reply!
    const elapsed = Date.now() - batch.firstMsgTime;
    if (batch.isTyping && elapsed < 25000) {
      console.log(`✍️ [Typing Hold] Customer ${formatPhoneDisplay(resolveCustomerPhone(remoteJid))} is still typing. Holding reply...`);
      clearTimeout(batch.timer);
      batch.timer = setTimeout(() => flushDebounce(remoteJid), 3000);
      return;
    }

    chatDebounceBuffers.delete(remoteJid);
    const activeMsg = batch?.pinMsg || batch?.imageMsg || batch?.docMsg || batch?.msg;
    const innerMsg = activeMsg ? getInnerMessage(activeMsg) : null;
    const hasAudio = Boolean(innerMsg?.audioMessage);
    const hasImage = Boolean(innerMsg?.imageMessage);
    const hasDoc = Boolean(innerMsg?.documentMessage || innerMsg?.documentWithCaptionMessage?.message?.documentMessage);
    const hasLoc = Boolean(innerMsg?.locationMessage || innerMsg?.liveLocationMessage);
    if (batch && ((batch.text && batch.text.trim()) || hasAudio || hasImage || hasDoc || hasLoc)) {
      const fallbackPayload = hasAudio ? "[Voice Note]" : "";
      enqueueChatMessage(remoteJid, async () => {
        await processSingleMessage(sock, activeMsg, remoteJid, batch.text?.trim() || fallbackPayload);
      });
    }
  }

  // ─── REAL-TIME PRESENCE LISTENER (TYPING INDICATOR) ───
  sock.ev.on("presence.update", ({ id, presences }) => {
    if (!id) return;
    const p = presences ? (presences[id] || Object.values(presences)[0]) : null;
    if (!p) return;
    const state = p.lastKnownPresence;
    const clean = resolveCustomerPhone(id);

    const existing = chatDebounceBuffers.get(id);
    if (existing) {
      if (state === "composing" || state === "recording") {
        existing.isTyping = true;
        clearTimeout(existing.timer);
        const elapsed = Date.now() - existing.firstMsgTime;
        const holdTime = elapsed > 25000 ? 1500 : 5000;
        existing.timer = setTimeout(() => flushDebounce(id), holdTime);
        console.log(`✍️ [Customer Typing Detected] ${formatPhoneDisplay(clean)} is typing... Holding AI reply.`);
      } else if (state === "paused" || state === "available") {
        if (existing.isTyping) {
          existing.isTyping = false;
          clearTimeout(existing.timer);
          existing.timer = setTimeout(() => flushDebounce(id), 2500);
          console.log(`✍️ [Customer Stopped Typing] ${formatPhoneDisplay(clean)} paused. Flushing in 2.5s.`);
        }
      }
    }
  });

  // Send blue double-tick ("Seen") read receipt once an incoming message is cleared for AI handling
  function markMessageSeen(msgObj) {
    try {
      const k = msgObj?.key;
      if (!k || k.fromMe || !k.id || !k.remoteJid || k.remoteJid.endsWith("@newsletter")) return;
      setTimeout(() => {
        sock.readMessages([k]).catch(() => {});
      }, 350);
    } catch (_) {}
  }

  // Concurrent WhatsApp message ingress: Process with smart rapid-fire debouncing per customer
  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;

        // Ignore group chats and status broadcasts
        if (remoteJid.endsWith("@g.us") || remoteJid.includes("broadcast")) continue;

        // Persist sender's WhatsApp pushName immediately (never overwrite with owner's self pushName)
        if (!msg.key?.fromMe && msg.pushName) {
          saveWhatsAppContact(remoteJid, msg.pushName);
        }

        // Ignore messages sent by the bot itself or already processed
        const msgId = msg.key?.id;
        if (msgId) {
          if (botSentMessageIds.has(msgId)) continue;
          if (processedIncomingMessageIds.has(msgId)) {
            console.log(`🛡️ [Duplicate MsgId Dropped] ${msgId} already processed for ${remoteJid}.`);
            continue;
          }
          processedIncomingMessageIds.add(msgId);
          setTimeout(() => processedIncomingMessageIds.delete(msgId), 10 * 60 * 1000);
        }

        // STRICT VVIP GUARD: If sender is VVIP IAS Officer (9419153353), AI MUST NEVER REPLY!
        if (isVvipManualOnly(remoteJid, resolveCustomerPhone(remoteJid))) {
          console.log(`🛡️ [VVIP MANUAL-ONLY] Received message from IAS Officer (9419153353 / ${remoteJid}). Silently ignored by AI for 100% manual handling by Suhail.`);
          // Lock permanent human override for 1 year
          humanOverrides.set(remoteJid, Date.now() + (365 * 24 * 60 * 60 * 1000));
          continue;
        }

        const inner = getInnerMessage(msg);
        if (!inner) continue;

        let rawText = (
          inner.conversation ||
          inner.extendedTextMessage?.text ||
          inner.imageMessage?.caption ||
          ""
        ).trim();

        const cleanPhone = resolveCustomerPhone(remoteJid);
        const isOwner = msg.key.fromMe || cleanPhone.endsWith("7006604148") || String(remoteJid).includes("174637916885151");

        // 🛡️ AUTO-RESPONDER GUARD: Detect and silently drop WhatsApp Business automated out-of-office / away replies
        if (!isOwner && rawText) {
          const isAutoResponder = /\b(?:we(?:'re| are)\s+(?:currently\s+)?unavailable\s+right\s+now|will\s+respond\s+as\s+soon\s+as\s+possible|auto(?:mated)?\s+reply|out\s+of\s+office|thanks\s+for\s+contacting\s+us[.,\s]+we('ll| will)\s+get\s+back|we\s+are\s+away\s+right\s+now|thank\s+you\s+for\s+reaching\s+out[.,\s]+we'll\s+get\s+back|this\s+is\s+an\s+automated\s+(?:message|response)|automated\s+greeting)\b/i.test(rawText);
          if (isAutoResponder) {
            console.log(`🛡️ [Auto-Responder Ignored] Automated WhatsApp out-of-office response from ${remoteJid}: "${rawText.slice(0, 45)}...". Silently skipped.`);
            if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
            chatMetadata[remoteJid].autoResponder = true;
            chatMetadata[remoteJid].followUpSent = true;
            if (cleanPhone) {
              if (!chatMetadata[cleanPhone]) chatMetadata[cleanPhone] = {};
              chatMetadata[cleanPhone].autoResponder = true;
              chatMetadata[cleanPhone].followUpSent = true;
            }
            saveChatMetadata();
            continue;
          }
        }

        // Duplicate text debounce: If the exact same text is received from customer within 15 seconds, drop it
        if (!isOwner && rawText) {
          const lastMsg = recentUserMessages.get(remoteJid);
          const now = Date.now();
          if (lastMsg && lastMsg.text === rawText && (now - lastMsg.timestamp < 15000)) {
            console.log(`🛡️ [Duplicate Text Dropped] Repeated message from ${remoteJid} ("${rawText.slice(0, 35)}...") ignored within 15s.`);
            continue;
          }
          recentUserMessages.set(remoteJid, { text: rawText, timestamp: now });
        }

        // Persist every incoming customer message into daily archive for supervised learning (even during manual takeover / pause)
        if (!isOwner) {
          const fallbackLabel = inner.locationMessage || inner.liveLocationMessage
            ? "[WhatsApp Location Pin]"
            : inner.audioMessage
            ? "[Voice Note]"
            : inner.imageMessage
            ? "[Image]"
            : inner.documentMessage
            ? "[Document]"
            : "";
          appendDailyChatLog({
            jid: remoteJid,
            phone: cleanPhone,
            name: msg.pushName || "",
            role: "customer",
            text: rawText || fallbackLabel
          });
        }

        // 1. If message is from owner (either manual message or # command)
        if (isOwner) {
          markMessageSeen(msg);
          // If owner sends a message in a customer chat, immediately cancel any pending customer debounce buffer!
          if (chatDebounceBuffers.has(remoteJid)) {
            clearTimeout(chatDebounceBuffers.get(remoteJid).timer);
            chatDebounceBuffers.delete(remoteJid);
          }
          // 🛡️ CRITICAL: If AI was actively generating a response to an earlier customer message, abort it immediately!
          // This prevents the AI from blurting out an outdated prompt (e.g. asking for location pin) after owner intervened!
          if (activeChatGenerations.has(remoteJid)) {
            console.log(`🛑 [Owner Intercept] Owner messaged/intervened in ${remoteJid}. Aborting in-flight AI generation.`);
            activeChatGenerations.delete(remoteJid);
          }
          enqueueChatMessage(remoteJid, async () => {
            await processSingleMessage(sock, msg, remoteJid, rawText);
          });
          continue;
        }

        // 2. Customer message: Check if Human Override is active for this chat
        const resolved = resolveCustomerPhone(remoteJid);
        const overrideExpiry =
          humanOverrides.get(remoteJid) ||
          (cleanPhone ? humanOverrides.get(cleanPhone) : null) ||
          (resolved ? humanOverrides.get(resolved) : null);
        if (overrideExpiry && Date.now() < overrideExpiry) {
          const remainingMins = Math.ceil((overrideExpiry - Date.now()) / (60 * 1000));
          console.log(`⏸️ [Human Intervened] AI paused (${remainingMins}m remaining) for ${formatPhoneDisplay(resolved || cleanPhone)}. Skipping.`);
          continue;
        }

        // 3. Check if Global Kill Switch is active
        if (isAiPausedGlobally) {
          if (aiPauseExpiry > 0 && Date.now() >= aiPauseExpiry) {
            isAiPausedGlobally = false;
            aiPauseExpiry = 0;
            console.log(`\n⏰ [AI Pause Expired] Auto-replies resumed.`);
          } else {
            console.log(`⏸️ [AI Paused Globally] Skipped auto-reply for ${formatPhoneDisplay(cleanPhone)}`);
            continue;
          }
        }

        // Mark customer message as Seen (blue double ticks) once cleared for AI handling
        markMessageSeen(msg);

        // 4. WhatsApp Location Pin or Live Location: coalesce briefly (2.0s) so simultaneous Pin + "2kg" merge cleanly!
        const locMsg = inner.locationMessage || inner.liveLocationMessage;
        if (locMsg) {
          if (activeChatGenerations.has(remoteJid)) {
            console.log(`🛑 [In-Flight Pin Intercept] Customer ${formatPhoneDisplay(cleanPhone)} shared location pin while AI was generating. Aborting stale generation.`);
            activeChatGenerations.delete(remoteJid);
          }
          const PIN_COALESCE_MS = 2000;
          if (chatDebounceBuffers.has(remoteJid)) {
            const existing = chatDebounceBuffers.get(remoteJid);
            clearTimeout(existing.timer);
            existing.pinMsg = msg;
            existing.msg = msg;
            if (rawText) existing.text = existing.text ? `${existing.text}\n${rawText}` : rawText;
            existing.lastMsgTime = Date.now();
            existing.isTyping = false;
            existing.timer = setTimeout(() => flushDebounce(remoteJid), 1200);
          } else {
            const entry = {
              firstMsgTime: Date.now(),
              lastMsgTime: Date.now(),
              msg,
              pinMsg: msg,
              imageMsg: null,
              docMsg: null,
              text: rawText,
              isTyping: false,
              timer: setTimeout(() => flushDebounce(remoteJid), PIN_COALESCE_MS)
            };
            chatDebounceBuffers.set(remoteJid, entry);
          }
          continue;
        }

        // 4a. WhatsApp Audio / Voice Note Message: process immediately without debouncing
        const isAudioNote = Boolean(inner.audioMessage);
        if (isAudioNote && !isOwner) {
          if (chatDebounceBuffers.has(remoteJid)) {
            clearTimeout(chatDebounceBuffers.get(remoteJid).timer);
            chatDebounceBuffers.delete(remoteJid);
          }
          if (activeChatGenerations.has(remoteJid)) {
            console.log(`🛑 [In-Flight Voice Intercept] Customer ${formatPhoneDisplay(cleanPhone)} sent voice note while AI was generating. Aborting stale generation.`);
            activeChatGenerations.delete(remoteJid);
          }
          enqueueChatMessage(remoteJid, async () => {
            await processSingleMessage(sock, msg, remoteJid, "[Voice Note]");
          });
          continue;
        }

        // 4b. In-Flight Turn Intercept: If AI is actively generating a reply for an earlier message from this customer,
        // invalidate the in-flight reply and prepend the earlier message so customer gets ONE combined response.
        const activeGen = activeChatGenerations.get(remoteJid);
        if (activeGen) {
          console.log(`🛑 [In-Flight Intercept] Customer ${formatPhoneDisplay(cleanPhone)} sent a new message while AI was generating reply for earlier message. Aborting in-flight reply and merging!`);
          activeChatGenerations.delete(remoteJid);
          if (activeGen.promptText && !rawText.includes(activeGen.promptText)) {
            rawText = `${activeGen.promptText}\n${rawText}`;
          }
        }

        // Subscribe to presence updates for this customer so we know when they are typing
        try {
          sock.presenceSubscribe(remoteJid).catch(() => {});
        } catch (_) {}

        // 5. Smart Adaptive Multi-Message Buffer (waits 4000ms for regular typing, 1200ms for captionless image/doc, 600ms for quick actions)
        const isQuickAction = isCustomerRequestingQr(rawText) || rawText.startsWith("#") || /^\$(?:paid|confirm|delivered|orders|link|qr|help|status)/i.test(rawText);
        const isDocMsg = Boolean(inner.documentMessage || inner.documentWithCaptionMessage?.message?.documentMessage);
        const isCaptionlessImage = (Boolean(inner.imageMessage) || isDocMsg) && !rawText;
        const DEBOUNCE_DELAY_MS = isQuickAction ? 600 : (isCaptionlessImage ? 1200 : 4000);
        if (chatDebounceBuffers.has(remoteJid)) {
          const existing = chatDebounceBuffers.get(remoteJid);
          clearTimeout(existing.timer);
          existing.text = rawText ? (existing.text ? `${existing.text}\n${rawText}` : rawText) : existing.text;
          if (inner.imageMessage) existing.imageMsg = msg;
          if (isDocMsg) existing.docMsg = msg;
          if (!existing.pinMsg) existing.msg = msg;
          existing.lastMsgTime = Date.now();
          const elapsed = Date.now() - existing.firstMsgTime;
          const delay = existing.pinMsg ? 1200 : (isQuickAction ? 600 : (elapsed > 20000 ? 1000 : DEBOUNCE_DELAY_MS));
          console.log(`⏳ [Smart Debounce] Buffered rapid message #${(existing.text || "").split('\n').filter(Boolean).length || 1} from ${formatPhoneDisplay(cleanPhone)} (Elapsed: ${Math.round(elapsed / 1000)}s): "${rawText.replace(/\n+/g, ' ')}"`);
          existing.timer = setTimeout(() => flushDebounce(remoteJid), delay);
        } else {
          const entry = {
            firstMsgTime: Date.now(),
            lastMsgTime: Date.now(),
            msg,
            imageMsg: inner.imageMessage ? msg : null,
            docMsg: isDocMsg ? msg : null,
            text: rawText,
            isTyping: false,
            timer: null
          };
          entry.timer = setTimeout(() => flushDebounce(remoteJid), DEBOUNCE_DELAY_MS);
          chatDebounceBuffers.set(remoteJid, entry);
          console.log(`⏳ [Smart Debounce] New customer message buffer started for ${formatPhoneDisplay(cleanPhone)} (${(DEBOUNCE_DELAY_MS / 1000).toFixed(1)}s window): "${rawText.replace(/\n+/g, ' ')}"`);
        }
      } catch (msgErr) {
        console.error("❌ [Message Ingress Exception Handled]:", msgErr?.stack || msgErr);
      }
    }
  });
}

if (require.main === module) {
  console.log("Starting Urban Trout WhatsApp Sales Agent with All 9 Rules...");
  startBot().catch(console.error);
} else {
  module.exports = {
    detectSrinagarLocality,
    resolveUnknownLocalityWithApi,
    generateGeminiReply,
    lookupCustomerVipProfile,
    isVvipManualOnly,
    extractCleanCustomerName,
    calculateReorderPricing,
    parseCustomerQuantityRequest,
    resolveCustomerDisplayName,
    extractCleanWhatsAppName,
    geocodeAddressWithGoogle,
    geocodeAddressWithNominatim,
    customAreas,
    deliveryZoneDb,
    formatOrderSummaryCard,
    WEATHER_RESTRICT_RADIUS_KM,
    refreshSrinagarWeather,
    getEffectiveSrinagarWeather,
    evaluateWeatherDeliveryPolicy,
    hasRecentWeatherAdvisory,
    hasRecentDelayNotice,
    isBriefAcknowledgement,
    setWeatherOverrideMode,
    classifyWeatherMetrics,
    buildLocationRateQuote,
    resolveNearestLocalityName,
    resolveConfirmedCustomerLocationDetails,
    isCustomerDeliveryLocationConfirmed,
    extractTotalPayableAmount,
    isFridayOperationsOpen,
    isOrderActivePending,
    TodayOrderPool,
    recordNewCustomerOrder,
    __setLiveWeatherCacheForTest,
    getDeliveryFeeForDistance,
    calculateDistance,
    fetchLiveRoadDistance,
    createCashfreePaymentLink,
    checkPendingCashfreePayments,
    generatePaymentWithWaterfall,
    JKB_ACCOUNT_DETAILS,
    formatJkbBankDetailsText,
    isCurrentEveningSurge,
    getTimeOfDayGreetingIst,
    isSyntheticSystemNote,
    isMalabaghStoreReference,
    stripInlineOrderSummaries,
    isExplicitCodInsistence,
    isCustomerRequestingQr,
    isExplicitQrScannerAsk,
    parseQuickOrderParams,
    parsePaymentMessageSnapshot,
    resolveManualPaidOrderDetails,
    HDFC_COUNTER_VPA,
    HDFC_MERCHANT_REF,
    buildHdfcSmartHubUpiUri,
    generateHdfcSmartHubQrBuffer,
    BOT_VERSION,
    saveChatMetadata,
    chatMetadata,
    chatHistories
  };
}
