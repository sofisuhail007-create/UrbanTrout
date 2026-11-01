const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const https = require("https");
const http = require("http");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const { sendNightlyBriefing, sendTelegramMessage } = require("./nightly_briefing.js");

// ============================================================================
// STRICT VVIP MANUAL-ONLY LIST (AI MUST NEVER TEXT UNDER ANY CIRCUMSTANCE)
// IAS Officer / Executive contacts managed 100% manually by owner Suhail.
// ============================================================================
const VVIP_MANUAL_ONLY_PHONES = new Set([
  "9419153353",
  "919419153353",
  "+919419153353"
]);

const VVIP_MANUAL_ONLY_JIDS = new Set([
  "9419153353@s.whatsapp.net",
  "919419153353@s.whatsapp.net",
  "208486419951677@lid" // Verified WhatsApp Baileys LID for 9419153353
]);

// ─── PRIMARY CONTACTS SHIELD (Protects all 1,294 Personal Friends, Family, & VIPs) ───
const primaryContactsShield = new Map(); // phoneLast10 -> { name, rawFn }
function loadPrimaryContactsShield() {
  const desktopDir = path.join(process.env.USERPROFILE || 'C:\\Users\\Suhail - CGIT', 'Desktop');
  const possiblePaths = [
    path.join(desktopDir, 'My Primary Contacts.vcf'),
    path.join(__dirname, 'My Primary Contacts.vcf')
  ];

  for (const vcfPath of possiblePaths) {
    if (fs.existsSync(vcfPath)) {
      try {
        const content = fs.readFileSync(vcfPath, 'utf8');
        const cards = content.split('END:VCARD');
        for (const card of cards) {
          const fnMatch = card.match(/FN:(.+)/i);
          const fn = fnMatch ? fnMatch[1].trim() : '';
          // Skip contacts that are specifically tagged as Urban Trout contacts (e.g. "UTA ...")
          if (/\b(?:UTA|Urban Trout)\b/i.test(fn)) continue;

          const lines = card.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith('TEL')) {
              const rawVal = line.substring(line.indexOf(':') + 1);
              const digits = rawVal.replace(/\D/g, '');
              if (digits.length >= 10) {
                const last10 = digits.slice(-10);
                primaryContactsShield.set(last10, { name: fn, rawFn: fn });
                primaryContactsShield.set(`91${last10}`, { name: fn, rawFn: fn });
              }
            }
          }
        }
        console.log(`🛡️ [Primary Contacts Protection] Loaded ${primaryContactsShield.size / 2} unique personal primary contacts from "${path.basename(vcfPath)}".`);
        break;
      } catch (err) {
        console.warn(`Error reading primary contacts shield from ${vcfPath}:`, err.message);
      }
    }
  }
}
loadPrimaryContactsShield();

function getPrimaryContactProfile(chatId, phone) {
  if (isVvipManualOnly(chatId, phone)) {
    return { name: "VVIP IAS Officer", isVvip: true };
  }
  if (!primaryContactsShield || primaryContactsShield.size === 0) return null;

  let raw10 = "";
  if (phone) {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length >= 10) raw10 = digits.slice(-10);
  }
  if (!raw10 && chatId) {
    const resolved = resolveCustomerPhone(chatId);
    if (resolved && resolved.length >= 10) raw10 = resolved.slice(-10);
  }

  if (raw10 && primaryContactsShield.has(raw10)) {
    return primaryContactsShield.get(raw10);
  }
  return null;
}

function isPrimaryPersonalContact(chatId, phone) {
  return Boolean(getPrimaryContactProfile(chatId, phone));
}

function isVvipManualOnly(chatId, phone) {
  if (chatId) {
    const cleanJid = String(chatId).toLowerCase().trim();
    if (VVIP_MANUAL_ONLY_JIDS.has(cleanJid)) return true;
    if (cleanJid.includes("9419153353") || cleanJid.includes("208486419951677")) return true;
  }
  if (phone) {
    const digits = String(phone).replace(/\D/g, "");
    if (digits.endsWith("9419153353") || VVIP_MANUAL_ONLY_PHONES.has(digits)) return true;
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

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

// Farm coordinates for automated 16km radius GPS validation
const FARM_LAT = 34.1445563;
const FARM_LNG = 74.8245018;

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  const aerial = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Srinagar Road Winding Calibration (converts straight-line aerial distance into actual driving road distance):
  // Direct local routes <=4km have ~1.10x factor; routes >4km across Dal Lake / Jhelum bridges have ~1.32x road winding factor.
  const roadFactor = aerial <= 4.0 ? 1.10 : 1.32;
  return aerial * roadFactor;
}

// Unwrap WhatsApp message container across ephemeral, viewOnce, and nested wrappers
function getInnerMessage(msg) {
  if (!msg || !msg.message) return null;
  let cur = msg.message;
  while (cur && (cur.ephemeralMessage || cur.viewOnceMessage || cur.viewOnceMessageV2 || cur.documentWithCaptionMessage)) {
    cur = cur.ephemeralMessage?.message || cur.viewOnceMessage?.message || cur.viewOnceMessageV2?.message || cur.documentWithCaptionMessage?.message || cur;
  }
  return cur;
}

// Follow redirects for Google Maps shortlinks (maps.app.goo.gl, goo.gl/maps) to extract destination URL
async function resolveGoogleMapsUrl(urlStr) {
  return new Promise((resolve) => {
    try {
      const client = urlStr.startsWith("https") ? https : http;
      const req = client.get(urlStr, { headers: { "User-Agent": "Mozilla/5.0" }, timeout: 3500 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(res.headers.location);
        } else {
          resolve(urlStr);
        }
      });
      req.on("error", () => resolve(urlStr));
      req.on("timeout", () => { req.destroy(); resolve(urlStr); });
    } catch {
      resolve(urlStr);
    }
  });
}

// Extract GPS latitude and longitude from URL strings, query params, or raw text coordinates
function extractCoordinates(text) {
  if (!text) return null;

  // 1. Google Maps @lat,lng format
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  // 2. Query param q=lat,lng or ll=lat,lng
  const qMatch = text.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  // 3. Google Maps data string !3dlat!4dlng
  const dataMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };

  // 4. Raw lat, lng in text: e.g. 34.144556, 74.824501
  const rawMatch = text.match(/\b([1-8]?\d(?:\.\d+)?|90(?:\.0+)?)[,\s]+(-?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?))\b/);
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

  const urlMatch = text.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[a-z.]+|www\.google\.[a-z.]+\/maps)[^\s]+/i);
  if (urlMatch) {
    const originalUrl = urlMatch[0];
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
  { pattern: /\b(?:baghati\s*shoora|baghati)\b/i, name: "Baghati Shoora", dist: 1.0 },
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
  { pattern: /\b(?:karanagar|karan\s*nagar)\b/i, name: "Karanagar", dist: 2.8 },
  { pattern: /\b(?:gousia\s*colony|gousha\s*colony)\b/i, name: "Gousia Colony", dist: 2.8 },
  { pattern: /\b(?:nalabal|nala\s*bal)\b/i, name: "Nalabal", dist: 2.8 },
  { pattern: /\b(?:bagh\s*ali\s*mardan(?:\s*khan)?|ali\s*mardan\s*khan)\b/i, name: "Bagh Ali Mardan Khan", dist: 2.9 },
  { pattern: /\b(?:pathan\s*colony)\b/i, name: "Pathan Colony", dist: 3.0 },
  { pattern: /\b(?:bagh[\s\-]?i[\s\-]?usman|baghi\s*usman)\b/i, name: "Bagh-i-Usman Colony", dist: 3.3 },
  { pattern: /\b(?:zoonimar|zooni\s*mar)\b/i, name: "Zoonimar", dist: 3.3 },
  { pattern: /\b(?:tailbal|teilbal|habak\s*shanpora)\b/i, name: "Tailbal", dist: 3.3 },
  { pattern: /\b(?:g(?:h)?ulab\s*bagh|g(?:h)?ulabbagh|g(?:h)?ulab\s*garden)\b/i, name: "Gulab Bagh", dist: 3.6 },
  { pattern: /\b(?:bota\s*kadal|botakadal)\b/i, name: "Botakadal", dist: 3.6 },
  { pattern: /\b(?:pandach|pandath|pandacha)\b/i, name: "Pandach", dist: 3.6 },
  { pattern: /\b(?:ashaie?\s*bagh)\b/i, name: "Ashaie Bagh", dist: 3.8 },
  { pattern: /\b(?:braiwar|braiwer)\b/i, name: "Braiwar", dist: 3.8 },
  { pattern: /\b(?:gassu)\b/i, name: "Gassu", dist: 3.9 },
  { pattern: /\b(?:zadibal)\b/i, name: "Zadibal", dist: 4.0 },
  // ── Zone 2 (4–6 km, MOQ 3 kg) ──
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
  { pattern: /\b(?:alusteng|alustang|aloo\s*steng)\b/i, name: "Alusteng", dist: 4.6 },
  { pattern: /\b(?:eidgah|idgah|eid\s*gah|aali\s*masjid)\b/i, name: "Eidgah", dist: 4.6 },
  { pattern: /\b(?:bakura)\b/i, name: "Bakura", dist: 4.8 },
  { pattern: /\b(?:gojwara|goj\s*wara)\b/i, name: "Gojwara", dist: 5.0 },
  { pattern: /\b(?:shuhama)\b/i, name: "Shuhama", dist: 5.0 },
  { pattern: /\b(?:rakh\s*harran|rakh\s*haran)\b/i, name: "Rakh Harran", dist: 5.0 },
  { pattern: /\b(?:sangam)\b/i, name: "Sangam", dist: 5.1 },
  { pattern: /\b(?:nowhat+a?|nowat+a?|nau\s*hat+a?|nohata?)\b/i, name: "Nowhatta", dist: 5.3 },
  { pattern: /\b(?:safakadal|safa\s*kadal|sufakadal)\b/i, name: "Safakadal", dist: 5.4 },
  { pattern: /\b(?:rainawari|raina\s*wari|reinawari)\b/i, name: "Rainawari", dist: 5.4 },
  { pattern: /\b(?:khanyar|khan\s*yar)\b/i, name: "Khanyar", dist: 5.5 },
  { pattern: /\b(?:shalimar|shalimar\s*bagh|shalimar\s*garden)\b/i, name: "Shalimar", dist: 5.5 },
  { pattern: /\b(?:mulphaq)\b/i, name: "Mulphaq", dist: 5.5 },
  { pattern: /\b(?:ali\s*kadal|ali\s*kadel|alikadal)\b/i, name: "Ali Kadal", dist: 5.8 },
  { pattern: /\b(?:khalamul)\b/i, name: "Khalamul", dist: 5.9 },
  // ── Zone 3: Greater Srinagar (7.0 to 11.5 km, Free Delivery on 3 kg+, 2 kg +₹69 fee) ──
  { pattern: /\b(?:karan\s*nagar|karannagar)\b/i, name: "Karan Nagar", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:lal\s*chowk|lalchowk)\b/i, name: "Lal Chowk", dist: 11.0, minKg: 3 },
  { pattern: /\b(?:dalgate|dal\s*gate)\b/i, name: "Dalgate", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:khay+am|khyam|khaiam)(?:\s*(?:chowk|road|cinema))?\b/i, name: "Khayam", dist: 8.5, minKg: 3 },
  { pattern: /\b(?:khyber\s*hospital|khyber)\b/i, name: "Khayam (Khyber Hospital)", dist: 8.5, minKg: 3 },
  { pattern: /\b(?:sonwar|sonawar|sona\s*war)\b/i, name: "Sonwar", dist: 11.0, minKg: 3 },
  { pattern: /\b(?:qamarwari|qamar\s*wari|kamarwari)\b/i, name: "Qamarwari", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:balgarden|bal\s*garden)\b/i, name: "Balgarden", dist: 9.8, minKg: 3 },
  { pattern: /\b(?:gogji\s*bagh|gogjibagh)\b/i, name: "Gogji Bagh", dist: 10.5, minKg: 3 },
  { pattern: /\b(?:wazir\s*bagh|wazirbagh)\b/i, name: "Wazir Bagh", dist: 10.0, minKg: 3 },
  { pattern: /\b(?:tulsi\s*bagh|tulsibagh)\b/i, name: "Tulsi Bagh", dist: 10.2, minKg: 3 },
  { pattern: /\b(?:hazuri\s*bagh|hazuribagh)\b/i, name: "Hazuri Bagh", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:iqbal\s*park)\b/i, name: "Iqbal Park", dist: 10.0, minKg: 3 },
  { pattern: /\b(?:solina|rambagh|ram\s*bagh)\b/i, name: "Rambagh/Solina", dist: 10.8, minKg: 3 },
  { pattern: /\b(?:barzulla|barzulla\s*baghat|baghat\s*barzulla|baghat)\b/i, name: "Barzulla", dist: 11.2, minKg: 3 },
  { pattern: /\b(?:brein|brain)\b/i, name: "Brein (Nishat)", dist: 11.0, minKg: 3 },
  { pattern: /\b(?:nishat)\b/i, name: "Nishat", dist: 8.0, minKg: 3 },

  // ── Zone 4: South Srinagar & Outer Corridor (11.5 to 16.0 km, Free Delivery on 4 kg+, 2 kg +₹89 fee) ──
  { pattern: /\b(?:batamaloo|batmaloo)\b/i, name: "Batamaloo", dist: 11.8, minKg: 4 },
  { pattern: /\b(?:bemina)\b/i, name: "Bemina", dist: 12.5, minKg: 4 },
  { pattern: /\b(?:raj\s*bagh|rajbagh)\b/i, name: "Rajbagh", dist: 12.0, minKg: 4 },
  { pattern: /\b(?:jawahar\s*nagar|jawaharnagar)\b/i, name: "Jawahar Nagar", dist: 11.8, minKg: 4 },
  { pattern: /\b(?:al[ol]+chi\s*bagh|al[ol]+chi|alochi|allochi|aloochi|elachi\s*bagh)\b/i, name: "Alochi Bagh", dist: 11.8, minKg: 4 },
  { pattern: /\b(?:magarmal\s*bagh|magarmal)\b/i, name: "Magarmal Bagh", dist: 11.6, minKg: 4 },
  { pattern: /\b(?:sanat\s*nagar|sanatnagar)\b/i, name: "Sanat Nagar", dist: 13.5, minKg: 4 },
  { pattern: /\b(?:rawalpora|rawapora)\b/i, name: "Rawalpora", dist: 14.0, minKg: 4 },
  { pattern: /\b(?:hyder|haider|huder|hadir|heydar)\s*pora\b/i, name: "Hyderpora", dist: 14.5, minKg: 4 },
  { pattern: /\b(?:chanapora|chanpora)\b/i, name: "Chanapora", dist: 13.0, minKg: 4 },
  { pattern: /\b(?:natipora)\b/i, name: "Natipora", dist: 12.5, minKg: 4 },
  { pattern: /\b(?:peerbagh|peer\s*bagh|pirbagh|pir\s*bagh)\b/i, name: "Peerbagh", dist: 14.5, minKg: 4 },
  { pattern: /\b(?:airport\s*road|humhama)\b/i, name: "Airport Road / Humhama", dist: 15.0, minKg: 4 },
  { pattern: /\b(?:ganderbal)\b/i, name: "Ganderbal", dist: 12.0, minKg: 4 },
  { pattern: /\b(?:bagh[- ]e[- ]mehtab|baghi\s*mehtab)\b/i, name: "Bagh-e-Mehtab", dist: 14.0, minKg: 4 },
  { pattern: /\b(?:kralpora|kral\s*pora)\b/i, name: "Kralpora", dist: 15.5, minKg: 4 },
  { pattern: /\b(?:rangreth)\b/i, name: "Rangreth", dist: 15.5, minKg: 4 },
  { pattern: /\b(?:lasjan|lassjan|lasjan\s*bypass)\b/i, name: "Lasjan", dist: 14.0, minKg: 4 },
  { pattern: /\b(?:nowgam|naugaon|nowgam\s*bypass)\b/i, name: "Nowgam", dist: 14.5, minKg: 4 },
  { pattern: /\b(?:padshahi\s*bagh|padshahibagh)\b/i, name: "Padshahi Bagh", dist: 13.0, minKg: 4 },
  { pattern: /\b(?:pantha\s*chowk|panthachowk)\b/i, name: "Pantha Chowk", dist: 14.0, minKg: 4 },
  { pattern: /\b(?:soiteng|suiteng|soitang)\b/i, name: "Soiteng", dist: 13.5, minKg: 4 },
  { pattern: /\b(?:pandrathan)\b/i, name: "Pandrathan", dist: 13.0, minKg: 4 },
  { pattern: /\b(?:athwajan)\b/i, name: "Athwajan", dist: 13.5, minKg: 4 },
  { pattern: /\b(?:pohru|pohroo)\b/i, name: "Pohru", dist: 15.0, minKg: 4 },
  { pattern: /\b(?:mochu|moochu)\b/i, name: "Mochu", dist: 15.0, minKg: 4 }
];

const KNOWN_OUT_ZONE_AREAS = [
  // ── Beyond 16 km / Outer Districts (Store Walk-in Only) ──
  { pattern: /\b(?:pampore)\b/i, name: "Pampore" },
  { pattern: /\b(?:chadoora|chadure)\b/i, name: "Chadoora" },
  { pattern: /\b(?:lawaypora|lawapora|laway\s*pora|lawa\s*pora)\b/i, name: "Lawaypora" },
  { pattern: /\b(?:hmt|zainakote|mustafabad)\b/i, name: "HMT" },
  { pattern: /\b(?:harwan)\b/i, name: "Harwan" },
  { pattern: /\b(?:budgam)\b/i, name: "Budgam" },
  { pattern: /\b(?:ompora)\b/i, name: "Ompora" },
  { pattern: /\b(?:baramulla)\b/i, name: "Baramulla" },
  { pattern: /\b(?:anantnag)\b/i, name: "Anantnag" },
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

function saveCustomAreas() {
  try {
    fs.writeFileSync(customAreasPath, JSON.stringify(customAreas, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving custom_areas.json:", e.message);
  }
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

function detectSrinagarLocality(text) {
  if (!text) return null;

  // 1. High-priority hardcoded localities
  for (const item of KNOWN_IN_ZONE_AREAS) {
    if (item.pattern.test(text)) {
      const minKg = item.minKg || (item.dist <= 4.0 ? 2 : item.dist <= 11.5 ? 3 : 4);
      const tier = item.dist <= 4.0 ? "0-4km" : item.dist <= 7.0 ? "4-7km" : item.dist <= 11.5 ? "7-11.5km" : "11.5-16km";
      return { status: "IN_ZONE", name: item.name, dist: item.dist, minKg, tier };
    }
  }

  // 2. Custom & auto-discovered colonies (custom_areas.json)
  for (const [cName, cData] of Object.entries(customAreas)) {
    if (/^(?:police\s*station|hospital|masjid|mosque|bank|chowk|bridge|kadal|school|college|gate|petrol\s*pump|post\s*office|complex|bazar|market|stop|stand)$/i.test(cName.trim())) continue;
    const escaped = cName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
      const dist = cData.dist;
      const minKg = dist <= 4.0 ? 2 : dist <= 11.5 ? 3 : 4;
      const tier = dist <= 4.0 ? "0-4km" : dist <= 7.0 ? "4-7km" : dist <= 11.5 ? "7-11.5km" : "11.5-16km";
      const status = dist <= 16.0 ? "IN_ZONE" : "OUT_ZONE";
      return { status, name: cName, dist, minKg, tier };
    }
  }

  // 3. 451 Srinagar places and landmarks (delivery_zone_db.json)
  if (deliveryZoneDb && deliveryZoneDb.length > 0) {
    for (const place of deliveryZoneDb) {
      if (!place.name || place.name.length < 4) continue;
      const escaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
        const dist = parseFloat(place.distance_km.toFixed(1));
        const minKg = dist <= 4.0 ? 2 : dist <= 11.5 ? 3 : 4;
        const tier = dist <= 4.0 ? "0-4km" : dist <= 7.0 ? "4-7km" : dist <= 11.5 ? "7-11.5km" : "11.5-16km";
        const status = dist <= 16.0 ? "IN_ZONE" : "OUT_ZONE";
        return { status, name: place.name, dist, minKg, tier };
      }
    }
  }

  // 4. Known out of zone areas
  for (const item of KNOWN_OUT_ZONE_AREAS) {
    if (item.pattern.test(text)) {
      return { status: "OUT_ZONE", name: item.name };
    }
  }
  return null;
}

// ─── COLONY-LEVEL REAL-TIME LEARNING ENGINE ───
// Automatically indexes new colonies, gated communities, and landmarks from WhatsApp pins and chats
function autoLearnColonyFromLocation({ lat, lng, distKm, locName, locAddress, recentUserText }) {
  try {
    if (!distKm || isNaN(distKm) || distKm > 18.0) return null; // Restrict learning to Srinagar perimeter

    // 1. Extract colony/place candidate
    let candidate = null;
    if (locName && typeof locName === "string") {
      const trimmed = locName.trim();
      // Ignore generic names
      if (!/^(?:location|dropped\s*pin|my\s*location|whatsapp|srinagar|kashmir|pin|current\s*location)$/i.test(trimmed) && trimmed.length >= 4 && trimmed.length <= 40) {
        candidate = trimmed;
      }
    }

    if (!candidate && recentUserText) {
      const colonyMatch = recentUserText.match(/\b([A-Za-z]+(?:\s+[A-Za-z]+)?\s+(?:colony|enclave|avenue|sector|phase|nagar|estate|mohalla|bagh|chowk|vihar|layout|stop|stand|lane|road))\b/i);
      if (colonyMatch) {
        candidate = colonyMatch[1].trim();
      }
    }

    if (!candidate) return null;

    // Normalize candidate name (Title Case)
    const normName = candidate.replace(/\b\w/g, l => l.toUpperCase()).trim();

    // Skip if already hardcoded in KNOWN_IN_ZONE_AREAS or customAreas
    const alreadyKnown = KNOWN_IN_ZONE_AREAS.some(k => k.pattern.test(normName));
    if (alreadyKnown || customAreas[normName]) return null;

    const minKg = distKm <= 4.0 ? 2 : distKm <= 11.5 ? 3 : 4;
    const tier = distKm <= 4.0 ? "0-4km" : distKm <= 7.0 ? "4-7km" : distKm <= 11.5 ? "7-11.5km" : "11.5-16km";
    const status = distKm <= 16.0 ? "IN_ZONE" : "OUT_ZONE";

    customAreas[normName] = {
      dist: Number(distKm.toFixed(1)),
      minKg,
      tier,
      status,
      lat,
      lng,
      source: "colony_learning_engine",
      learnedAt: new Date().toISOString()
    };
    saveCustomAreas();

    console.log(`🧠 [COLONY LEARNED] Added "${normName}" (~${distKm.toFixed(1)} km, ${tier}) to custom_areas.json!`);
    return normName;
  } catch (err) {
    console.error("Colony learning error:", err.message);
    return null;
  }
}

// Asynchronous Geocoding Engine (Google Maps API + OpenStreetMap Nominatim Fallback)
async function geocodeAddressWithGoogle(query) {
  if (!GOOGLE_MAPS_API_KEY) return null;
  return new Promise((resolve) => {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + ", Srinagar, Kashmir")}&key=${GOOGLE_MAPS_API_KEY}`;
    https.get(url, { timeout: 3500 }, (res) => {
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
    }).on("error", () => resolve(null));
  });
}

async function geocodeAddressWithNominatim(query) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", Srinagar")}&format=json&limit=1`;
    https.get(url, { headers: { "User-Agent": "UrbanTroutDeliveryBot/1.0" }, timeout: 3500 }, (res) => {
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
    }).on("error", () => resolve(null));
  });
}


// In-Memory Geocoding Cache & Address Intent Filter to eliminate 5-10s network lag
const geoCache = new Map();

function hasAddressIndicator(text) {
  if (!text || text.length < 3 || text.length > 120) return false;
  const lower = text.toLowerCase().trim();
  // Filter out general conversation, pricing, greetings, reorders
  if (/^(?:hi|hello|hey|salam|salaam|price|rate|rates|trout|fish|available|today|order|clean|cleaned|gutted|whole|yes|no|ok|haan|ha|ji|repeat|same|wahi|send|bhej|bhejo|book|kardo|how much|kya rate|kitna)[!.,\s]*$/i.test(lower)) {
    return false;
  }
  return /\b(?:near|opp|opposite|behind|beside|road|lane|street|sector|colony|enclave|bazar|chowk|mohalla|kadal|bridge|hospital|school|college|gate|nagar|bagh|pora|wari|complex|residency|address|location|delivery\s*to)\b/i.test(lower);
}

async function resolveUnknownLocalityWithApi(text) {
  if (!text) return null;
  const cacheKey = text.trim().toLowerCase();
  if (geoCache.has(cacheKey)) return geoCache.get(cacheKey);
  if (!text) return null;

  let candidate = text.trim();

  // Strip phone numbers (e.g. 7889415578) from candidate query
  candidate = candidate.replace(/\b(?:\+?91[\s\-]?)?[6-9]\d{9}\b/g, "").trim();

  // Only strip leading command prefixes like "delivery to:", "address is:", "location is:" at the start of text
  candidate = candidate.replace(/^(?:delivery\s*(?:to|is|address)?|address\s*is|location\s*is|my\s*(?:address|location)\s*is)\s*[:\-–—]?\s*/i, "").trim();

  // Strip order weights, cuts, and quantities from locality candidate (e.g. "Aloochi bagh, 1 kg" -> "Aloochi bagh")
  candidate = candidate.replace(/[,]?\s*\d+(?:\.\d+)?\s*(?:kg|kilo|kilos|gm|grams)?\b/gi, "").trim();
  candidate = candidate.replace(/\b(?:cleaned|gutted|whole|fresh|steaks|fish|trout|pieces|order|pack)\b/gi, "").trim();
  candidate = candidate.replace(/^[,\s\-–—]+|[,\s\-–—]+$/g, "").trim();

  // Filter out non-location generic greetings/phrases or standalone generic landmarks without area
  if (/^(?:hi|hello|salam|price|rate|rates|order|clean|cleaned|gutted|whole|fish|trout|yes|no|ok|kilo|kg)$/i.test(candidate)) {
    return null;
  }
  if (/^(?:police\s*station|hospital|masjid|mosque|bank|chowk|bridge|kadal|school|college|gate|petrol\s*pump|post\s*office|complex|bazar|market|stop|stand)$/i.test(candidate)) {
    return null;
  }

  // 1. Try Google Maps Geocoding API
  let geo = await geocodeAddressWithGoogle(candidate);
  // 2. Fallback to OpenStreetMap Nominatim
  if (!geo) {
    geo = await geocodeAddressWithNominatim(candidate);
  }

  if (geo && geo.lat && geo.lng) {
    const dist = calculateDistance(FARM_LAT, FARM_LNG, geo.lat, geo.lng);
    const distRounded = parseFloat(dist.toFixed(1));
    const minKg = distRounded <= 4.0 ? 2 : distRounded <= 11.5 ? 3 : 4;
    const tier = distRounded <= 4.0 ? "0-4km" : distRounded <= 7.0 ? "4-7km" : distRounded <= 11.5 ? "7-11.5km" : "11.5-16km";
    const status = distRounded <= 16.0 ? "IN_ZONE" : "OUT_ZONE";
    const locResult = { status, name: geo.name || candidate, dist: distRounded, minKg, tier, source: geo.source };

    // Auto-cache into customAreas ONLY if not a generic landmark name
    const isGeneric = /^(?:police\s*station|hospital|masjid|mosque|bank|chowk|bridge|kadal|school|college|gate|petrol\s*pump|post\s*office|complex|bazar|market|stop|stand)$/i.test(locResult.name.trim());
    if (!isGeneric && !customAreas[locResult.name]) {
      customAreas[locResult.name] = { dist: distRounded, minKg, tier, status, source: geo.source };
      saveCustomAreas();
      console.log(`[Smart Geocoder] Auto-saved new locality "${locResult.name}" (~${distRounded}km, ${tier}, ${geo.source}) to custom_areas.json`);
    }

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
  try {
    const obj = {};
    for (const [k, v] of chatHistories.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(historiesFilePath, JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing chat_histories.json:", e.message);
  }
}

// Clean customer names, "Salam", and informal titles so sales agent NEVER calls customer by name or uses informal greetings
function scrubCustomerNames(text, customerName) {
  if (!text) return text;
  let cleaned = text.trim();

  // 1. Replace Salam / Salaam / Assalamu Alaikum greetings with clean professional "Hello!"
  cleaned = cleaned.replace(/^(?:Assalam(?:u|-o)?[\s-]?[aA]laikum|Salam|Salaam)[!,\.\s]*/i, "Hello! ");
  cleaned = cleaned.replace(/\b(?:Assalam(?:u|-o)?[\s-]?[aA]laikum|Salam|Salaam)\b/gi, "Hello");

  // 2. Remove honorifics like "Janab", "Sb", "Sahib", "Sahab"
  cleaned = cleaned.replace(/\s*\b(?:janab|sb|sahib|sahab)\b[!,.]*/gi, "");

  // 3. Scrub customerName if available
  if (customerName && customerName.trim().length > 1) {
    const rawName = customerName.trim();
    const tokens = rawName.split(/[\s,._-]+/).filter(t => t.length >= 2 && !/^(?:the|and|user|guest|customer|mr|mrs|ms|dr|shaikh|sheikh)$/i.test(t));
    const allNameVariations = [rawName, ...tokens];

    for (const token of allNameVariations) {
      const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`\\b(Hello|Hi|Hey|Welcome|Dear)[!,\\s]*\\s*${esc}[\\s!,.:]*`, 'gi'), (match, greeting) => {
        if (/^Welcome/i.test(greeting)) return "Welcome to Urban Trout! ";
        if (/^Dear/i.test(greeting)) return "";
        return "Hello! ";
      });
      cleaned = cleaned.replace(new RegExp(`^(?:Hello[!,,\\s]*\\s*)?${esc}[\\s!,.:]*\\s*`, 'i'), "Hello! ");
      cleaned = cleaned.replace(new RegExp(`[,\\s]+${esc}([!.,?])`, 'gi'), '$1');
    }
  }

  // 4. Scrub generic addressings like "Dear Customer,", "Dear Sir/Madam,", etc.
  cleaned = cleaned.replace(/^(?:Dear\\s+(?:Customer|Sir|Madam|Valued\\s+Customer)[!.,:\\s]*)/gi, "");

  // 5. Clean any accidental single-word name greeting at start: "Hello John!" -> "Hello!"
  cleaned = cleaned.replace(/^(Hello|Hi|Hey)\\s+[A-Z][a-z]+[!,.\\]\\s*/m, "$1! ");
  cleaned = cleaned.replace(/^(?:Hello[!,,\\s]*){2,}/i, "Hello! ");

  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  cleaned = cleaned.replace(/^(Hello!|Hi!|Hey!)\\s+([a-z])/i, (m, g, c) => `${g} ${c.toUpperCase()}`);

  return cleaned.trim();
}

// Clean repetitive follow-up greetings so every message feels like a continuous conversation
function cleanFollowUpGreeting(text, customerName) {
  if (!text) return text;
  let cleaned = scrubCustomerNames(text, customerName);

  // Strip leading greetings in follow-up turns
  cleaned = cleaned.replace(/^(?:(?:Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Salaam|Hello|Hi|Hey|Welcome(?:\s+to\s+Urban\s+Trout)?)(?:\s+[A-Za-z]+){0,2}[\s!,\.\-–—]+)\s*/i, "");

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

// Silently check live stock from aquarium-stock API
async function checkStockAvailable(requestedKg = 2) {
  return new Promise((resolve) => {
    const req = https.get("https://urbantrout.in/api/aquarium-stock", { timeout: 6000 }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const remaining = Number(json.liveSummary?.remainingKg ?? 30);
          console.log(`[Stock Check] Live biomass in tanks: ${remaining} kg | Requested: ${requestedKg} kg`);
          resolve(remaining >= requestedKg);
        } catch {
          resolve(true); // default fallback
        }
      });
    });
    req.on("error", () => resolve(true));
    req.on("timeout", () => { req.destroy(); resolve(true); });
  });
}

// Generate official locked-amount Razorpay Payment Link
async function createRazorpayPaymentLink({ amount, customerPhone, customerName, description, latitude, longitude, distanceKm, googleMapsUrl }) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials missing");
  }

  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  const isValidContact = cleanPhone && cleanPhone.length === 10 && !/^(.)\1{7,}$/.test(cleanPhone);
  const ref = `UT-WA-${Date.now().toString().slice(-6)}`;

  const numAmount = Number(amount);
  const isGutted = (description || "").toLowerCase().includes("gutted") || !(description || "").toLowerCase().includes("whole");
  const rate = isGutted ? 580 : 540;
  const prodType = isGutted ? "Gutted" : "Whole";

  // Build clean, professional Razorpay payment title (e.g. "1 kg Cleaned & Gutted Trout (+ Express Delivery)")
  let cleanDesc = (description || "").replace(/^urban\s*trout\s*[-–—:]*\s*/i, "").trim();
  const weightMatch = cleanDesc.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
  const weightKg = weightMatch ? parseFloat(weightMatch[1]) : null;
  const cutTitle = isGutted ? "Cleaned & Gutted Trout" : "Whole Fresh Trout";
  const hasDelivery = /\(\+(?:express|special)\s*delivery\)/i.test(cleanDesc) || (weightKg && weightKg <= 2 && numAmount > (weightKg * rate));
  const isFreeDelivery = weightKg && weightKg >= 2 && !hasDelivery;

  let rzpTitle = "";
  if (weightKg) {
    rzpTitle = `${weightKg} kg ${cutTitle}`;
    if (hasDelivery) {
      rzpTitle += " (+ Express Delivery)";
    } else if (isFreeDelivery) {
      rzpTitle += " (Free Doorstep Delivery)";
    }
  } else {
    // DIRECT AMOUNT LINK (No explicit weight specified, e.g. #link 1650)
    // NEVER calculate fake fractional weights (e.g. 1650 / 580 = 2.8kg)!
    if (cleanDesc && !/^(?:fresh\s+trout\s+order\s*\(\s*₹?\d+\s*\)|\d+)$/i.test(cleanDesc)) {
      rzpTitle = cleanDesc;
    } else {
      rzpTitle = `${cutTitle} Order`;
    }
    if (/\b(?:delivery|courier)\b/i.test(cleanDesc)) {
      rzpTitle += " (+ Express Delivery)";
    }
  }
  rzpTitle = rzpTitle.slice(0, 120);

  const getPayload = (withCustomer = true) => {
    const data = {
      amount: Math.round(numAmount * 100), // in paise
      currency: "INR",
      accept_partial: false,
      description: rzpTitle,
      expire_by: Math.floor(Date.now() / 1000) + (4 * 60 * 60), // Automatically expires in 4 hours
      notify: { sms: false, email: false, whatsapp: false },
      reminder_enable: true,
      notes: {
        order_ref: ref,
        channel: "WHATSAPP_AI_AGENT",
        customer_phone: cleanPhone || "N/A",
        customer_name: customerName || "Customer",
        items_summary: description || (weightKg ? `${weightKg}kg Fresh Rainbow Trout` : `${cutTitle} Order`),
        weight_kg: weightKg ? String(weightKg) : "Direct Amount",
        product_type: prodType,
        rate_per_kg: weightKg ? String(rate) : "Direct Deal",
        standard_total: String(numAmount),
        ...(googleMapsUrl ? { google_maps_url: googleMapsUrl } : {}),
        ...(latitude ? { latitude: String(latitude) } : {}),
        ...(longitude ? { longitude: String(longitude) } : {}),
        ...(distanceKm ? { distance_km: String(distanceKm) } : {})
      }
    };
    if (withCustomer && isValidContact) {
      data.customer = { contact: `+91${cleanPhone}` };
    }
    return JSON.stringify(data);
  };

  const executeRequest = (payload) => new Promise((resolve, reject) => {
    const req = https.request("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.short_url) {
            console.log(`[Razorpay Link Generated] Amount: ₹${amount} -> ${json.short_url} (${json.id})`);
            resolve({
              url: json.short_url,
              id: json.id,
              ref
            });
          } else {
            reject(new Error(json.error?.description || "Razorpay API error"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Razorpay API timeout")); });
    req.write(payload);
    req.end();
  });

  try {
    return await executeRequest(getPayload(true));
  } catch (err) {
    if (isValidContact) {
      console.warn(`Razorpay link creation failed with customer contact (${err.message}). Retrying without customer field...`);
      return await executeRequest(getPayload(false));
    }
    throw err;
  }
}

// Helper to download an image buffer with redirect handling
function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download QR image. Status: ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

// Create an official single-use Razorpay UPI QR Code locked to the exact order amount
async function createRazorpayQrCode({ amount, customerPhone, customerName, orderRef, description }) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error("Razorpay credentials not configured");
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const numAmount = Number(amount);
  const amountInPaise = Math.round(numAmount * 100);
  const cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  const ref = orderRef || `UT-DEL-${Date.now().toString().slice(-6)}`;

  const payload = JSON.stringify({
    type: "upi_qr",
    name: "Urban Trout Aquaculture",
    usage: "single_use",
    fixed_amount: true,
    payment_amount: amountInPaise,
    description: (description || `Order #${ref}`).slice(0, 30),
    close_by: Math.floor(Date.now() / 1000) + (4 * 60 * 60), // 4 hours validity
    notes: {
      channel: "WHATSAPP_AI_AGENT",
      order_ref: ref,
      customer_name: (customerName || "Customer").slice(0, 40),
      customer_phone: cleanPhone || "N/A",
      items_summary: (description || "Fresh Rainbow Trout").slice(0, 100)
    }
  });

  const qrData = await new Promise((resolve, reject) => {
    const req = https.request("https://api.razorpay.com/v1/payments/qr_codes", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.id) {
            resolve(json);
          } else {
            reject(new Error(json.error?.description || "Razorpay QR creation failed"));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Razorpay QR creation timeout")); });
    req.write(payload);
    req.end();
  });

  console.log(`[Razorpay QR Generated] ID: ${qrData.id} for Order #${ref} (₹${numAmount})`);

  // Download the official high-resolution Razorpay QR PNG image
  const imageBuffer = await downloadImageBuffer(`https://api.razorpay.com/v1/l/qrcode/${qrData.id}`);

  return {
    qrId: qrData.id,
    imageUrl: qrData.image_url,
    imageBuffer,
    orderRef: ref
  };
}


// ─── Organized & Brief WhatsApp Order Summary Card Generator ───
function formatOrderSummaryCard({
  orderRef,
  amount,
  desc,
  deliveryArea,
  distanceKm,
  localityName,
  scheduledSlot,
  payUrl
}) {
  const isWhole = /\b(?:whole|sabut)\b/i.test(desc || "");
  const rate = isWhole ? 540 : 580;
  const cutName = isWhole ? "Whole Fresh Trout" : "Cleaned & Gutted (Pan-Ready)";

  // Parse weight if specified in desc (e.g. "2 kg Cleaned & Gutted" -> 2)
  const weightMatch = (desc || "").match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
  let weightKg = weightMatch ? parseFloat(weightMatch[1]) : null;

  let fishAmount = 0;
  let deliveryFee = 0;

  if (weightKg) {
    fishAmount = Math.round(weightKg * rate);
    deliveryFee = Math.max(0, amount - fishAmount);
  } else {
    // Standard price tier inference ONLY for standard fixed amounts
    if ([580, 609, 629, 649, 659, 699, 739].includes(amount)) {
      weightKg = 1; fishAmount = 580; deliveryFee = amount - 580;
    } else if ([540, 569, 589, 609, 619, 659, 699].includes(amount)) {
      weightKg = 1; fishAmount = 540; deliveryFee = amount - 540;
    } else if ([1160, 1199, 1229, 1249, 1269, 1289].includes(amount)) {
      weightKg = 2; fishAmount = 1160; deliveryFee = amount - 1160;
    } else if ([1080, 1119, 1149, 1169, 1189, 1209].includes(amount)) {
      weightKg = 2; fishAmount = 1080; deliveryFee = amount - 1080;
    } else if ([1740, 1789, 1829].includes(amount)) {
      weightKg = 3; fishAmount = 1740; deliveryFee = amount - 1740;
    } else if ([1620, 1669, 1709].includes(amount)) {
      weightKg = 3; fishAmount = 1620; deliveryFee = amount - 1620;
    } else if (amount === 2320) {
      weightKg = 4; fishAmount = 2320; deliveryFee = 0;
    } else if (amount === 2160) {
      weightKg = 4; fishAmount = 2160; deliveryFee = 0;
    } else {
      // Direct amount link (e.g. ₹1,650) - do NOT infer fake weight
      fishAmount = amount; deliveryFee = 0;
    }
  }

  // Delivery breakdown line
  let deliveryLine = "";
  if (deliveryFee === 0) {
    deliveryLine = "🛵 *Doorstep Delivery:* *100% FREE* (Subsidized by Urban Trout)";
  } else {
    deliveryLine = `🛵 *Express Courier:* *₹${deliveryFee}* (Subsidized courier)`;
  }

  // Destination / locality
  let destText = "";
  const placeName = localityName || (deliveryArea && !deliveryArea.includes("Within 6km") && !deliveryArea.includes("Within 8km") ? deliveryArea : null);
  if (placeName) {
    const distText = (distanceKm != null && distanceKm > 0) ? ` (~${Number(distanceKm).toFixed(1)} km)` : "";
    destText = `\n📍 *Delivery Address:* ${placeName}${distText}`;
  }

  const slotText = scheduledSlot || "Within 90–120 Minutes of Payment";

  const orderTitle = weightKg
    ? `${weightKg} kg × ${cutName}`
    : (desc && !/^(?:fresh\s+trout\s+order\s*\(\s*₹?\d+\s*\)|\d+)$/i.test(desc) ? desc : `${cutName} Order`);

  return `🧾 *URBAN TROUT · ORDER SUMMARY*
_Ref: #${orderRef || "LIVE"}_
━━━━━━━━━━━━━━━━━━━━━━
📦 *Order:* ${orderTitle}
${weightKg ? `💵 *Fish Price:* ₹${rate}/kg (₹${fishAmount})\n` : ""}💵 *Total Payable:* *₹${amount.toLocaleString("en-IN")}*${!weightKg ? " (Direct Order Amount)" : ""}
${deliveryLine}
🛍️ *Packaging:* Clean food-grade double packaging (Zero Ice)${destText}
━━━━━━━━━━━━━━━━━━━━━━
💰 *Total Payable:* *₹${amount}*
━━━━━━━━━━━━━━━━━━━━━━

🔗 *Tap to Pay Online (UPI / GPay / PhonePe / Card):*
${payUrl}

📷 _Need a QR Code scanner instead? Reply *"Send Scanner"* to receive your locked QR code image._

⚡ *Live-Harvest Guarantee:* Net-harvested live from pure cold-water tanks upon payment confirmation.
🕒 *Delivery Window:* ${slotText}
⚠️ _Payment link is valid for 4 hours. Tap above to complete payment._`;
}

// Fetch status of Razorpay payment link directly from Razorpay API
function getRazorpayLinkStatus(linkId) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !linkId) return Promise.resolve(null);
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  return new Promise((resolve) => {
    const req = https.get(`https://api.razorpay.com/v1/payment_links/${linkId}`, {
      headers: { "Authorization": `Basic ${auth}` },
      timeout: 5000
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Cache to map WhatsApp privacy LIDs or session IDs to verified phone numbers
const lidToPhone = new Map();

// Google Contacts exporter module
const { exportContacts } = require("./export_contacts");

// Global AI Sales Agent Kill Switch / Pause State (Controllable from Phone via #pause / #resume)
let isAiPausedGlobally = false;
let aiPauseExpiry = 0;

// Per-Chat message concurrency queue to allow handling multiple customers in parallel
const chatProcessingQueues = new Map();

function enqueueChatMessage(remoteJid, fn) {
  const currentQueue = chatProcessingQueues.get(remoteJid) || Promise.resolve();
  const nextQueue = currentQueue
    .then(() => fn())
    .catch(err => console.error(`❌ [Chat Queue Error] ${remoteJid}:`, err))
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

  // 2. Legal, Regulatory, Police, Fraud, Scam, Cheating threats
  if (/\b(?:fraud|scam|cheating|cheat|chor|chori|loot|loot\s*rahe|dhokha|420|police|consumer\s*court|consumer\s*forum|fssai|legal\s*action|police\s*complaint|fir\s*karega|report\s*(?:you|karoonga|karenge|krunga)|court|lawyer|advocate)\b/i.test(t)) {
    return {
      severity: "CRITICAL",
      category: "Legal / Fraud / Regulatory Threat",
      reason: "Customer alleged fraud, scam, or threatened legal/police/consumer court action"
    };
  }

  // 3. Product quality / Rotten / Spoiled / Sickness / Food safety
  if (/\b(?:spoiled|stale|kharab|sadi\s*hui|sada\s*hua|bad\s*smell|smelling|stinking|rotten|vomit|vomiting|food\s*poisoning|poison|sick|bimar|hospital|hospitalized|pet\s*kharab|loose\s*motion|unhygienic|gandi\s*fish|insects|worm)\b/i.test(t)) {
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

// Save or update customer order in local persistent store
function recordNewCustomerOrder(phone, orderData) {
  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    let orders = {};
    if (fs.existsSync(ordersFilePath)) {
      orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));
    }
    const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
    orders[cleanPhone] = {
      phone: cleanPhone,
      ...orderData,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf-8");
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
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
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
      res.on("data", () => {});
      res.on("end", () => resolve(true));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.write(payload);
    req.end();
  });
}

// Auto-settle Khata in Supabase if customer has an open balance
async function autoSettleKhataInSupabase(phone, amount, paymentId, orderRef) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !phone) return;
  const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) return;
  try {
    const vsl = await querySupabase(`vending_sales_log?or=(custom_fields->>customer_phone.eq.${cleanPhone},notes.ilike.%25${cleanPhone}%25)&order=created_at.desc&limit=3`);
    if (Array.isArray(vsl) && vsl.length > 0) {
      for (const item of vsl) {
        const cf = item.custom_fields || {};
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
          cf.settled_at = new Date().toISOString();
          cf.settled_payment_method = `Razorpay (Verified ${paymentId})`;

          if (!Array.isArray(cf.payment_history)) cf.payment_history = [];
          cf.payment_history.push({
            amount: Number(amount),
            method: "Razorpay Link (Verified)",
            payment_id: paymentId,
            timestamp: new Date().toISOString(),
            note: `Khata auto-settled via Razorpay payment (${orderRef || paymentId})`
          });

          await patchSupabase(`vending_sales_log?id=eq.${item.id}`, {
            amount_paid: updatedPaid,
            payment_mode: isSettled ? "Online Payment (Khata Cleared via Razorpay)" : item.payment_mode,
            custom_fields: cf,
            notes: ((item.notes || "").trim() ? (item.notes + " ") : "") + `[KHATA PAID ✓ ₹${amount} via Razorpay ${paymentId}]`
          });
          console.log(`🎉 [Khata Auto-Settled via Poller] Updated vending_sales_log ${item.id} for ${cleanPhone}: ₹${amount}`);

          // Also settle customer_balances if matching entry exists
          try {
            await patchSupabase(`customer_balances?customer_phone=ilike.%25${cleanPhone}%25&status=eq.pending`, {
              balance_amount: 0,
              status: "settled",
              payment_status: "PAID",
              settled_at: new Date().toISOString(),
              notes: `Auto-settled via Razorpay payment (${paymentId})`
            });
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
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
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
      res.on("end", () => resolve(true));
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
  if (isPollingQueue) return;
  isPollingQueue = true;
  try {
    const res = await querySupabase("app_settings?key=eq.whatsapp_dispatch_queue&select=value");
    if (!res || !res[0] || !res[0].value) {
      isPollingQueue = false;
      return;
    }

    let queue = [];
    try {
      queue = JSON.parse(res[0].value);
    } catch (_) {
      isPollingQueue = false;
      return;
    }

    if (!Array.isArray(queue) || queue.length === 0) {
      isPollingQueue = false;
      return;
    }

    let changed = false;
    for (const item of queue) {
      if (item && item.dispatched === false && item.phone && item.messageText) {
        const cleanPhone = String(item.phone).replace(/\D/g, "").slice(-10);
        if (isVvipManualOnly(null, cleanPhone)) {
          console.log(`⛔ [VVIP MANUAL-ONLY] Skipped dispatch queue message for IAS Officer (${cleanPhone}).`);
          item.dispatched = true;
          item.skipped = "VVIP Manual Only";
          changed = true;
          continue;
        }
        if (cleanPhone.length !== 10) {
          item.dispatched = true;
          item.error = "Invalid phone format";
          changed = true;
          continue;
        }

        // Clean any accidental religious greetings or 'void' placeholders in queued text
        let cleanText = item.messageText
          .replace(/^(?:(?:Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam)[\s!,\.\-–—]*)+/i, "")
          .replace(/\b(?:Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Janab)\b/gi, "")
          .replace(/\bvoid\b/gi, "there")
          .trim();

        // Check if customer chat is active via LID
        const ordersFilePath = path.join(__dirname, "customer_orders.json");
        let orders = {};
        if (fs.existsSync(ordersFilePath)) {
          try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8")); } catch (_) {}
        }
        const targetJid = orders[cleanPhone]?.chatId || `91${cleanPhone}@s.whatsapp.net`;

        console.log(`\n🚀 [Order Update -> WhatsApp Transmission]`);
        console.log(`📡 Sending "${item.status}" update to +91 ${cleanPhone} for Order #${item.orderRef}...`);

        try {
          await sock.sendMessage(targetJid, { text: cleanText });
          console.log(`✅ [WhatsApp Delivered] Successfully notified customer (+91 ${cleanPhone})!`);

          // Update local customer_orders.json
          if (orders[cleanPhone]) {
            orders[cleanPhone].status = item.status === "out_for_delivery"
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
            orders[cleanPhone].updatedAt = new Date().toISOString();
            fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf-8");
            console.log(`[Customer Memory Updated] Status for ${cleanPhone} set to "${orders[cleanPhone].status}"`);
          }

          // Append to chat history
          if (chatHistories.has(targetJid)) {
            const h = chatHistories.get(targetJid);
            h.push({ role: "model", text: cleanText });
            saveChatHistories();
          }

          item.dispatched = true;
          item.dispatchedAt = new Date().toISOString();
          changed = true;
        } catch (sendErr) {
          console.error(`❌ [WhatsApp Send Failed] Could not deliver to ${targetJid}:`, sendErr.message);
          item.dispatched = true; // Mark dispatched so it doesn't get stuck in infinite loop
          item.error = sendErr.message;
          changed = true;
        }
      }
    }

    if (changed) {
      await updateSupabaseAppSettings("whatsapp_dispatch_queue", JSON.stringify(queue.slice(-50)));
    }
  } catch (err) {
    // Ignore transient network errors during polling
  } finally {
    isPollingQueue = false;
  }
}

// Instant Razorpay Payment Poller: directly checks pending payment links every 3.5 seconds
let isCheckingPayments = false;
async function checkPendingRazorpayPayments(sock) {
  if (isCheckingPayments) return;
  isCheckingPayments = true;
  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    if (!fs.existsSync(ordersFilePath)) return;

    let orders = {};
    try {
      orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));
    } catch (_) {
      return;
    }

    const pendingKeys = Object.keys(orders).filter(k => 
      orders[k] &&
      orders[k].status === "Payment Link Sent — Awaiting Confirmation" && 
      orders[k].paymentLinkId
    );

    if (pendingKeys.length === 0) return;

    for (const key of pendingKeys) {
      const order = orders[key];
      const linkId = order.paymentLinkId;
      if (!linkId) continue;

      try {
        const linkData = await getRazorpayLinkStatus(linkId);
        if (linkData && linkData.status === "paid") {
          console.log(`\n🎉 [Instant Payment Confirmed via Razorpay!] Order #${order.orderRef} for ${key}`);

          order.status = "Paid & Confirmed (Live Harvest Pending)";
          order.paidAt = new Date().toISOString();
          order.paymentId = linkData.payments?.[0]?.payment_id || "Razorpay Paid";
          fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf-8");

          const targetJid = order.chatId || `91${order.phone}@s.whatsapp.net`;
          const displayAmt = order.amount ? order.amount.split(" ")[0] : `₹${(linkData.amount_paid || 0) / 100}`;
          
          const receiptMsg = `✅ *Payment Received & Order Confirmed!* 🐟\n\nThank you! Your payment of *${displayAmt}* has been verified successfully.\n\n📋 *Order Summary:*\n• *Order Ref:* #${order.orderRef}\n• *Items:* ${order.items || "Fresh Rainbow Trout"}\n• *Status:* Confirmed (Live Harvest Scheduled)\n\nOur farm team at Malabagh is now preparing your fresh live harvest from our high-tech oxygen-saturated RAS tanks. We will deliver it chilled to your doorstep within 2 hours!`;

          await sock.sendMessage(targetJid, { text: receiptMsg });
          console.log(`✅ [Instant WhatsApp Confirmation Sent] Delivered directly to ${targetJid}!`);

          // If this order was generated by owner for a customer, notify owner as well
          if (order.ownerJid && order.ownerJid !== targetJid) {
            try {
              await sock.sendMessage(order.ownerJid, {
                text: `🎉 *Payment Confirmed!* 🐟\n\nCustomer (+91 ${order.phone || "Customer"}) just completed payment of *${displayAmt}* for Order *#${order.orderRef}* (${order.items || "Fresh Trout"}).\nAutomated confirmation receipt delivered to customer's WhatsApp!`
              });
            } catch (_) {}
          }

          // Auto-settle Khata in Supabase if this was a customer with open balance
          const paidRupees = (linkData.amount_paid || 0) / 100;
          if (order.phone && paidRupees > 0) {
            autoSettleKhataInSupabase(order.phone, paidRupees, order.paymentId, order.orderRef);
          }

          // Append to chat history so sales agent remembers the customer has paid
          if (chatHistories.has(targetJid)) {
            const h = chatHistories.get(targetJid);
            h.push({ role: "model", text: receiptMsg });
            saveChatHistories();
          }
        }
      } catch (checkErr) {
        // Transient error check
      }
    }
  } catch (err) {
    // Transient error
  } finally {
    isCheckingPayments = false;
  }
}

// Look up existing order by customer phone number, LID, or message queries (e.g. order numbers)
async function lookupCustomerOrder(chatId, customerPhone, userMessage) {
  let cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);

  // Check if this chat/LID was previously linked to a phone number or reverse auth map
  const resolved = resolveCustomerPhone(chatId);
  if (resolved && resolved.length >= 10) {
    cleanPhone = resolved.slice(-10);
  }

  // Check if customer typed a 10-digit mobile number in their message
  const phoneInMsg = userMessage.match(/\b([6-9]\d{9})\b/);
  if (phoneInMsg) {
    cleanPhone = phoneInMsg[1];
    lidToPhone.set(chatId, cleanPhone);
    console.log(`[Order Recognition] Captured phone ${cleanPhone} from chat`);
  }

  // Extract EXPLICIT order reference keyword (e.g. "order #123", "order id 456", "UT-WA-12345", "#4567")
  // CRITICAL: Do NOT allow bare phone numbers or random words to match as order references!
  const explicitRefMatch = userMessage.match(/(?:(?:order|ord|ref|receipt|invoice)\s*(?:id|number|no|num)?[:\s#]*|#|(?:UT-WA-))([a-zA-Z0-9\-_]{4,15})/i);
  const potentialRef = explicitRefMatch ? explicitRefMatch[1].trim() : null;

  // Check if customer is asking about order tracking, status, or delivery timing
  const isAskingOrder = /(?:where\s*is\s*(?:my\s*)?order|order\s*(?:status|id|number|no|num|update|delivered|delivery|dispatch)|track\s*(?:my\s*)?order|my\s*order|delivery\s*(?:status|dispatch|time|timing|update|schedule)|dispatch\s*status|check\s*(?:my\s*)?order|when\s*will\s*(?:it|order|fish)\s*(?:arrive|deliver|reach|come)|(?:deliver|delivered|delivery)\s*(?:any\s*)?(?:1|2|one|two)\s*hours?|(?:any\s*)?(?:1|2|one|two)\s*hours?|kab\s*(?:aayega|pahonchega|deliver)|deliver\s*(?:hua|karo|hoga))/i.test(userMessage);

  // If the customer is NOT asking about an existing order AND did NOT provide an explicit order ID, DO NOT trigger order lookup!
  if (!isAskingOrder && !potentialRef) {
    return null;
  }

  // 1. Check local persistent store
  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    if (fs.existsSync(ordersFilePath)) {
      const orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));

      // Match by phone or chatId (if customer asked about an order or delivery)
      if (isAskingOrder) {
        const matches = [];
        for (const [phoneKey, ord] of Object.entries(orders)) {
          const isOwnerCmd = ord.createdBy === "OWNER_WHATSAPP_COMMAND";
          if (String(chatId).includes("174637916885151") || cleanPhone === "7006604148") {
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
          // Prioritize active paid & confirmed orders, then most recently updated
          matches.sort((a, b) => {
            const aConfirmed = /(?:paid|confirmed|harvest|dispatch)/i.test(a.status || "") ? 1 : 0;
            const bConfirmed = /(?:paid|confirmed|harvest|dispatch)/i.test(b.status || "") ? 1 : 0;
            if (aConfirmed !== bConfirmed) return bConfirmed - aConfirmed;
            const aTime = new Date(a.updatedAt || a.paidAt || 0).getTime();
            const bTime = new Date(b.updatedAt || b.paidAt || 0).getTime();
            return bTime - aTime;
          });
          console.log(`[Order Recognition] Found best match for ${cleanPhone || chatId}:`, matches[0].orderRef, matches[0].status);
          return matches[0];
        }
      }

      // Match across all orders by explicit order reference
      if (potentialRef) {
        const lowerRef = potentialRef.toLowerCase();
        for (const [phoneKey, ord] of Object.entries(orders)) {
          if (ord.orderRef && ord.orderRef.toLowerCase().includes(lowerRef)) {
            console.log(`[Order Recognition] Matched order ${ord.orderRef} in local store`);
            if (cleanPhone) lidToPhone.set(chatId, phoneKey);
            return ord;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Local orders store read error:", err.message);
  }

  // 2. Check Supabase vending_sales_log
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      if (isAskingOrder && cleanPhone && cleanPhone.length === 10) {
        const logs = await querySupabase(`vending_sales_log?or=(notes.ilike.%25${cleanPhone}%25,custom_fields->>customer_phone.eq.${cleanPhone})&order=created_at.desc&limit=1`);
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

      if (potentialRef && potentialRef.length >= 4) {
        const encRef = encodeURIComponent(potentialRef);
        const matchedLogs = await querySupabase(`vending_sales_log?notes.ilike.%25${encRef}%25&order=created_at.desc&limit=1`);
        if (Array.isArray(matchedLogs) && matchedLogs[0]) {
          const log = matchedLogs[0];
          if (log.notes && log.notes.toLowerCase().includes(potentialRef.toLowerCase())) {
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
  return "You are Suhail, sales manager at Urban Trout Aquaculture, Malabagh, Srinagar. Strictly 8km radius delivery.";
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

// Helper to detect if current IST time is evening rush surge window (4:00 PM – 8:59 PM)
function isCurrentEveningSurge() {
  const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = istDate.getHours();
  return hour >= 16 && hour < 21;
}

// Calculate exact reorder pricing and description based on distance and past cut (4-Tier Model)
function calculateReorderPricing(weightKg, cutType, distKm, isSurgeOverride) {
  const isWhole = cutType.toLowerCase().includes("whole");
  const baseRate = isWhole ? 540 : 580;
  const dist = (distKm != null && !isNaN(distKm)) ? distKm : 2.0;
  const isSurge = isSurgeOverride !== undefined ? Boolean(isSurgeOverride) : isCurrentEveningSurge();
  const surgeAdd = isSurge ? 40 : 0;

  if (dist <= 4.0) {
    // Tier 1 (0-4 km): Free on 2kg+, 1kg has +₹29 (or +₹69 evening) subsidized courier fee
    if (weightKg === 1) return { amount: baseRate + 29 + surgeAdd, tagDesc: `1 kg ${cutType} (+Express Delivery)` };
    return { amount: Math.round(weightKg * baseRate), tagDesc: `${weightKg} kg ${cutType}` };
  } else if (dist <= 7.0) {
    // Tier 2 (4-7 km): Free on 3kg+, 2kg has +₹39 (or +₹79 evening), 1kg has +₹49 (or +₹89 evening) fee
    if (weightKg >= 3) return { amount: Math.round(weightKg * baseRate), tagDesc: `${weightKg} kg ${cutType}` };
    if (weightKg === 2) return { amount: Math.round(2 * baseRate) + 39 + surgeAdd, tagDesc: `2 kg ${cutType} (+Express Delivery)` };
    return { amount: baseRate + 49 + surgeAdd, tagDesc: `1 kg ${cutType} (+Express Delivery)` };
  } else if (dist <= 11.5) {
    // Tier 3 (7-11.5 km): Free on 3kg+, 2kg has +₹69 (or +₹109 evening), 1kg has +₹79 (or +₹119 evening) fee
    if (weightKg >= 3) return { amount: Math.round(weightKg * baseRate), tagDesc: `${weightKg} kg ${cutType}` };
    if (weightKg === 2) return { amount: Math.round(2 * baseRate) + 69 + surgeAdd, tagDesc: `2 kg ${cutType} (+Express Delivery)` };
    return { amount: baseRate + 79 + surgeAdd, tagDesc: `1 kg ${cutType} (+Express Delivery)` };
  } else {
    // Tier 4 (11.5-16 km): Free on 4kg+, 3kg has +₹49 (or +₹89 evening), 2kg has +₹89 (or +₹129 evening), 1kg has +₹119 (or +₹159 evening) fee
    if (weightKg >= 4) return { amount: Math.round(weightKg * baseRate), tagDesc: `${weightKg} kg ${cutType}` };
    if (weightKg === 3) return { amount: Math.round(3 * baseRate) + 49 + surgeAdd, tagDesc: `3 kg ${cutType} (+Express Delivery)` };
    if (weightKg === 2) return { amount: Math.round(2 * baseRate) + 89 + surgeAdd, tagDesc: `2 kg ${cutType} (+Express Delivery)` };
    return { amount: baseRate + 119 + surgeAdd, tagDesc: `1 kg ${cutType} (+Express Delivery)` };
  }
}

// Safe extraction of clean personal name from WhatsApp pushName
function extractCleanWhatsAppName(pushName) {
  if (!pushName) return null;
  let n = String(pushName).trim();
  n = n.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, "").trim();
  n = n.replace(/^[~•*-\s]+/, "").trim();
  n = n.replace(/[^\w\s.']/gi, "").trim();
  if (/^\+?\d+$/.test(n.replace(/[\s\-()]/g, ""))) return null;
  if (/^(?:valued\s*customer|customer|user|buyer|lead|srinagar|kashmir|urban\s*trout|none|null|unknown|guest)$/i.test(n)) return null;
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
  const msg = userMessage.trim();

  const isOnlyPriceQuestion = /^(?:what\s*is\s*(?:the\s*)?rate|kitne\s*ka\s*hai|kya\s*rate\s*hai|price\s*of|how\s*much\s*is|rate\s*kya\s*hai)\b/i.test(msg) ||
                              /\b(?:kitne\s*ka\s*hai|rate\s*kya\s*hai|how\s*much\s*for)\b/i.test(msg);
  if (isOnlyPriceQuestion && !/\b(?:send|bhej|order|book|deliver|pack)\b/i.test(msg)) {
    return null;
  }

  let weightKg = null;
  const numMatch = msg.match(/\b(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kg)?\b/i);
  const wordNumMatch = msg.match(/\b(ek|do|teen|chaar|char|paanch|panch|one|two|three|four|five)\s*(?:kgs?|kilos?|kg)?\b/i);

  if (numMatch && numMatch[1]) {
    const parsed = parseFloat(numMatch[1]);
    if (parsed >= 1 && parsed <= 25) {
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
  }

  if (!weightKg) return null;

  const isOrderIntent = /^(?:send|bhej|bhejo|deliver|pack|book|order|chahiye|need|want|give|lao|kar\s*do|bhej\s*do|deliver\s*karo|do\s*mujhe)\b/i.test(msg) ||
                        /\b(?:send|bhej|bhejo|deliver|pack|book|order|chahiye|need|want|give|lao|kar\s*do|bhej\s*do|deliver\s*karo)\b/i.test(msg) ||
                        /^(?:[0-9]+(?:\.[0-9]+)?\s*(?:kg|kgs|kilos?|kilo)?(?:\s+(?:cleaned|gutted|whole|fresh|steaks|curry|cut))?)[!.,\s]*$/i.test(msg) ||
                        /\b(?:can\s*(?:i|you)\s*(?:get|send|have|order)|please\s*(?:send|deliver)|send\s*link|pay\s*link)\b/i.test(msg);

  if (!isOrderIntent) return null;

  let cut = null;
  if (/\b(?:whole|round|sabut|uncleaned)\b/i.test(msg)) {
    cut = "Whole Fresh";
  } else if (/\b(?:curry|cut|steaks?)\b/i.test(msg)) {
    cut = "Cleaned & Gutted (Curry Cut)";
  } else if (/\b(?:clean|cleaned|gutted|saf)\b/i.test(msg)) {
    cut = "Cleaned & Gutted";
  }

  let localityName = null;
  let localityDist = null;
  const locDet = detectSrinagarLocality(msg);
  if (locDet && locDet.status === "IN_ZONE") {
    localityName = locDet.name;
    localityDist = locDet.dist;
  }

  return { weightKg, cut, localityName, localityDist };
}

// Helper to verify if an order was genuinely PAID and CONFIRMED (Not just an unpaid inquiry or link sent)
function isOrderConfirmedPaid(ord) {
  if (!ord) return false;
  if (ord.paidAt || ord.paymentId) return true;
  const status = String(ord.status || "").toLowerCase();
  if (status.includes("awaiting") || status.includes("pending") || status.includes("link sent") || status.includes("created")) {
    return false;
  }
  return status.includes("paid") || status.includes("confirmed") || status.includes("delivered") || status.includes("dispatch");
}

// VIP / Return Customer Memory: STRICTLY FOR CONFIRMED PAID CUSTOMERS ONLY
function lookupCustomerVipProfile(chatId, customerPhone) {
  let cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  if (!cleanPhone || cleanPhone.length < 10) {
    const resolved = resolveCustomerPhone(chatId);
    const resolvedDigits = String(resolved || "").replace(/\D/g, "");
    if (resolvedDigits.length >= 10) {
      cleanPhone = resolvedDigits.slice(-10);
    }
  }
  if ((!cleanPhone || cleanPhone.length < 10) && chatId && lidToPhone.has(chatId)) {
    const lidDigits = String(lidToPhone.get(chatId)).replace(/\D/g, "");
    if (lidDigits.length >= 10) cleanPhone = lidDigits.slice(-10);
  }

  // 1. Scan customer_orders.json STRICTLY for confirmed paid orders
  const confirmedPaidOrders = [];
  try {
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    if (fs.existsSync(ordersFilePath)) {
      const orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf-8"));
      for (const [key, ord] of Object.entries(orders)) {
        const isOwnerCmd = ord.createdBy === "OWNER_WHATSAPP_COMMAND";
        const oPhone = String(ord.phone || "").replace(/\D/g, "").slice(-10);
        // If created by owner command, ord.chatId or ord.ownerJid is the owner's chat, NOT the customer's chat!
        const oChatId = isOwnerCmd ? null : ord.chatId;

        // Owner guard: never treat owner admin chat or phone as a customer order
        if (cleanPhone === "7006604148" || String(chatId).includes("174637916885151")) {
          if (oPhone !== "7006604148" || isOwnerCmd) continue;
        }

        const matchesPhone = cleanPhone && cleanPhone.length === 10 && (oPhone === cleanPhone || key === cleanPhone);
        const matchesChat = chatId && !String(chatId).includes("174637916885151") && (oChatId === chatId || (!isOwnerCmd && key === chatId));
        if (matchesPhone || matchesChat) {
          if (isOrderConfirmedPaid(ord)) {
            confirmedPaidOrders.push(ord);
          }
        }
      }
    }
  } catch (err) {
    console.warn("VIP profile order lookup notice:", err.message);
  }

  // Owner guard: Suhail / owner admin chat is NEVER treated as a returning customer unless they have a confirmed paid order
  const isOwnerTesting = cleanPhone === "7006604148" || String(chatId).includes("174637916885151");
  if (isOwnerTesting && confirmedPaidOrders.length === 0) {
    return null;
  }

  // 2. Check chatMetadata STRICTLY for confirmed paid status (Owner excluded)
  const meta = isOwnerTesting ? {} : ((chatId && chatMetadata[chatId]) || (cleanPhone && chatMetadata[cleanPhone]) || {});
  const hasPaidOrderMeta = !isOwnerTesting && Boolean(meta.hasPaidOrder === true);

  // STRICT RULE: Returning customers are ONLY those whose payment was confirmed!
  // Price inquiries, unpaid links, and general contacts do NOT qualify as returning patrons.
  if (confirmedPaidOrders.length === 0 && !hasPaidOrderMeta) {
    return null;
  }

  // Sort confirmed paid orders by most recent
  confirmedPaidOrders.sort((a, b) => {
    const tA = new Date(a.paidAt || a.updatedAt || 0).getTime();
    const tB = new Date(b.paidAt || b.updatedAt || 0).getTime();
    return tB - tA;
  });

  const lastOrder = confirmedPaidOrders[0] || null;

  let locality = (meta.localityName && !/^(?:srinagar|kashmir|malabagh)$/i.test(meta.localityName.trim())) ? meta.localityName : null;

  if (!locality && lastOrder && lastOrder.deliveryArea) {
    const cleanArea = lastOrder.deliveryArea.replace(/\s*\([^)]*\)\s*/g, "").trim();
    if (!/^(?:doorstep delivery|within \d+km|scheduled|srinagar|kashmir)/i.test(cleanArea)) {
      locality = cleanArea;
    }
  }

  if (!locality && meta.localityName) {
    locality = meta.localityName;
  }

  let distanceKm = meta.distanceKm != null ? meta.distanceKm : null;
  if (locality && !/^(?:srinagar|kashmir)$/i.test(locality.trim())) {
    const locMatch = detectSrinagarLocality(locality);
    if (locMatch && locMatch.status === "IN_ZONE") {
      distanceKm = locMatch.dist;
    }
  }

  let usualWeightKg = 2;
  let usualCut = "Cleaned & Gutted";
  if (lastOrder && lastOrder.items) {
    const wMatch = lastOrder.items.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
    if (wMatch) usualWeightKg = Math.round(parseFloat(wMatch[1]));
    if (/\b(?:whole|round|sabut|uncleaned)\b/i.test(lastOrder.items)) {
      usualCut = "Whole Fresh";
    }
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
    distanceKm: distanceKm != null ? distanceKm : 2.0,
    reorderAmount: reorderPricing.amount,
    reorderItemDesc: reorderPricing.tagDesc,
    reorderPayTag: `[PAY_LINK: ${reorderPricing.amount} : ${reorderPricing.tagDesc}]`,
    cleanName: null,
    salutation: "Valued Returning Patron"
  };
}

// Call Gemini API
async function generateGeminiReply(chatId, userMessage, customerPhone, customerName) {
  // Sanitize input: cap at 500 chars to prevent prompt injection / oversized payloads
  userMessage = String(userMessage || "").slice(0, 500);
  const isGreeting = /^(?:hello|hi|hey|salam|assalam|aoa|good\s*(?:morning|afternoon|evening))[!.,\s]*$/i.test(userMessage.trim());
  let history = chatHistories.get(chatId) || [];

  // If customer is sending a fresh standalone greeting, reset stale history so past inquiries don't pollute the new conversation
  if (isGreeting) {
    history = [];
    chatHistories.set(chatId, []);
    saveChatHistories();
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
  const isFridayToday = (todayDay === 5);

  let timeOfDayDesc = "Morning";
  if (istHour >= 12 && istHour < 16) timeOfDayDesc = "Afternoon";
  else if (istHour >= 16 && istHour < 20) timeOfDayDesc = "Evening";
  else if (istHour >= 20 || istHour < 5) timeOfDayDesc = "Night";
  else if (istHour >= 5 && istHour < 12) timeOfDayDesc = "Morning";

  // ORDER & DELIVERY OPERATING WINDOW: 7:00 AM to 9:00 PM (14 Hours Active Same-Day Delivery!)
  const isOperatingHours = istHour >= 7 && istHour < 21; // 7:00 AM to 8:59 PM (Active Daytime Delivery)
  const isNightAfter9PM = istHour >= 21;                 // 9:00 PM to 11:59 PM (Night After-Hours)
  const isEarlyPreDawn = istHour < 7;                    // 12:00 AM to 6:59 AM (Pre-Dawn)

  // EVENING RUSH SURGE WINDOW: 4:00 PM to 8:59 PM (16:00 – 20:59 IST)
  // During peak rush hours, Rapido & courier costs surge. +₹40 surge is added to subsidized courier fees.
  // 4 kg family pack (and eligible 2-3 kg free deliveries) remains 100% FREE!
  const isEveningSurge = istHour >= 16 && istHour < 21;
  const surgeAdd = isEveningSurge ? 40 : 0;

  let cleanPhone = String(customerPhone || "").replace(/\D/g, "").slice(-10);
  if (!cleanPhone || cleanPhone.length < 10) {
    const resDig = String(resolveCustomerPhone(chatId) || "").replace(/\D/g, "");
    if (resDig.length >= 10) cleanPhone = resDig.slice(-10);
  }

  const existingOrder = await lookupCustomerOrder(chatId, customerPhone, userMessage);
  const vipProfile = lookupCustomerVipProfile(chatId, customerPhone);
  const isVipCustomer = Boolean(vipProfile && vipProfile.orderCount > 0);

  const trimmedLower = userMessage.trim().toLowerCase();
  const isReorderAffirmative = /^(?:yes|haan|ha|ji|ji\s*haan|same|repeat|same\s*as\s*last\s*time|wahi|wahi\s*bhej\s*do|same\s*bhej\s*do|book\s*it|kardo\s*book|send\s*link|pay\s*link|same\s*order|haan\s*kardo|yes\s*please|done|ok\s*send|send|bhej\s*do|bhejo|haan\s*bhejo)[!.,\s]*$/i.test(trimmedLower) || /\b(?:repeat\s*(?:my\s*)?order|same\s*as\s*last\s*time|wahi\s*order|phir\s*se\s*bhej\s*do|usual\s*order)\b/i.test(trimmedLower);
  const parsedQuantity = parseCustomerQuantityRequest(userMessage);
  const isPureInquiry = isFirstMessage || isGreeting || /^(?:fish\s*available|trout\s*available|fresh\s*trout|order\s*karna\s*hai|fresh\s*fish|trout\s*hai|fish\s*hai)[!.,?\s]*$/i.test(trimmedLower);

  // VIP Fast Path 1: 1-Tap Reorder (Affirmative or Direct Quantity Request "No Strings Attached")
  let fastReorderReply = null;
  if (vipProfile && !existingOrder && !isFridayToday) {
    if (isReorderAffirmative) {
      const timeNote = (isNightAfter9PM || isEarlyPreDawn)
        ? (isThursdayToday ? "scheduled for Saturday morning (7:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (7:00 AM – 11:00 AM)")
        : "delivered within 2 hours";
      fastReorderReply = `Wonderful! I've prepared your usual order for ${vipProfile.usualWeightKg} kg ${vipProfile.usualCut} to ${vipProfile.locality} (${timeNote}).\n\nPlease tap the link below to complete payment and confirm live harvest:\n${vipProfile.reorderPayTag}\n\nOur farm team in Malabagh will harvest them fresh from our cold-water tanks, pack them in clean food-grade packs, and dispatch straight to your door! 🐟`;
    } else if (parsedQuantity) {
      // Customer asked for ANY quantity (e.g. 1kg, 2kg, 3kg, 4kg) — share payment link NO STRINGS ATTACHED!
      const reqWeight = parsedQuantity.weightKg;
      const reqCut = parsedQuantity.cut || vipProfile.usualCut || "Cleaned & Gutted";

      // Check if current chat history has an explicitly mentioned locality (e.g. customer said "Location Paraypora")
      let recentChatLoc = null;
      const history = chatHistories[chatId] || [];
      for (let i = history.length - 1; i >= 0; i--) {
        const hText = history[i]?.text || "";
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

      const pricing = calculateReorderPricing(reqWeight, reqCut, targetDist, isEveningSurge);

      const timeNote = (isNightAfter9PM || isEarlyPreDawn)
        ? (isThursdayToday ? "scheduled for Saturday morning (7:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (7:00 AM – 11:00 AM)")
        : "delivered within 2 hours";
      fastReorderReply = `Wonderful! I've prepared your order for ${reqWeight} kg ${reqCut} to ${targetLocality} (${timeNote}).\n\nPlease tap the link below to complete payment and confirm live harvest:\n[PAY_LINK: ${pricing.amount} : ${pricing.tagDesc}]\n\nOur farm team in Malabagh will harvest them fresh from our cold-water tanks, pack them in clean food-grade packs, and dispatch straight to your door! 🐟`;
    }
  }

  // VIP Fast Path 2: Returning Customer Greeting & 1-Tap Offer
  if (vipProfile && !existingOrder && !fastReorderReply && isPureInquiry && !isFridayToday) {
    const harvestStatus = (isNightAfter9PM || isEarlyPreDawn)
      ? (isThursdayToday ? "Tonight's deliveries closed at 9:00 PM. Live harvest resumes Saturday morning at 7:00 AM sharp!" : "Tonight's deliveries closed at 9:00 PM. Fresh live harvest resumes tomorrow morning at 7:00 AM sharp!")
      : "We have fresh live Himalayan Rainbow Trout harvested today.";
    const slotPrompt = (isNightAfter9PM || isEarlyPreDawn)
      ? (isThursdayToday ? "scheduled for Saturday morning (7:00 AM – 11:00 AM)" : "scheduled for tomorrow morning (7:00 AM – 11:00 AM)")
      : "as usual";

    const fastGreeting = `Hello! Welcome back to Urban Trout. 🐟 ${harvestStatus}\n\nWould you like your usual *${vipProfile.usualWeightKg} kg ${vipProfile.usualCut}* delivered to *${vipProfile.locality}* ${slotPrompt}?\n\nJust reply *'Yes'* (or *'Repeat'*) and I'll send your instant payment link right away!`;

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

INSTRUCTION: Provide their order status directly and concisely! Greet professionally ("Hello! Welcome back to Urban Trout."). If this is an ongoing chat, do NOT repeat greetings.
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
1. GREETING & TONE: Greet warmly as a valued returning patron: "Welcome back to Urban Trout!".
2. 1-TAP REORDER RECOGNITION: The customer's usual order is *${vipProfile.usualWeightKg} kg ${vipProfile.usualCut}* delivered to *${vipProfile.locality}*.
3. IF CUSTOMER CONFIRMS OR REPEATS USUAL ORDER (e.g. "yes", "same", "repeat", "wahi", "book it"):
   Immediately output their exact payment link: ${vipProfile.reorderPayTag}
   DO NOT ask for their address or GPS pin! It is already confirmed on file for ${vipProfile.locality}.
4. IF CUSTOMER ASKS FOR A DIFFERENT CUT OR QUANTITY:
   Accommodate them politely, quote the correct rate, and do NOT force them into the old order.
======================================================`;
  } else {
    // STRICT PROFESSIONAL RULE: NEVER pass customer profile name to LLM prompt to prevent informal or awkward name-calling
    orderContext = `\n[STRICT PROFESSIONAL RULE: NEVER address or call the customer by any personal name (no "Hello Munir", "Hi John", "Dear Uzma", etc.)! Greet neutrally ("Hello! Welcome to Urban Trout.") or jump straight into the answer without names.]`;
  }

  let detectedLoc = detectSrinagarLocality(userMessage);
  if (!detectedLoc && history && history.length > 0) {
    // Scan user messages in reverse chronological order (most recent first!)
    const userMsgs = history.filter(h => h.role === "user").map(h => h.text).reverse();
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
        if (!chatMetadata[chatId]) chatMetadata[chatId] = {};
        chatMetadata[chatId].distanceKm = detectedLoc.dist;
        chatMetadata[chatId].localityName = detectedLoc.name;
        if (customerPhone) {
          if (!chatMetadata[customerPhone]) chatMetadata[customerPhone] = {};
          chatMetadata[customerPhone].distanceKm = detectedLoc.dist;
          chatMetadata[customerPhone].localityName = detectedLoc.name;
        }
        saveChatMetadata();
      }

      if (detectedLoc.dist <= 4.0) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 1" OR ANY ZONE NUMBERS TO THE CUSTOMER! Speak naturally: "We deliver express right to your doorstep in ${detectedLoc.name}!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 9:00 PM IST) — +₹40 evening rush courier surge applies to subsidized 1 kg orders. 2 kg+ is 100% FREE!" : ""}
• Doorstep Delivery: 100% FREE on 2 kg or more (within 2 hours)!
• Rates: Cleaned & Gutted = ₹580/kg | Whole Fresh = ₹540/kg
• 2 kg Cleaned & Gutted = *₹1,160 total* (100% FREE delivery)
• ⚠️ STRICT MOQ FIRST POLICY: Pitch 2 kg minimum order for free delivery upfront!
• Pitch for ${detectedLoc.name}:
  "Great! ${detectedLoc.name} is right in our core delivery zone! Doorstep delivery is 100% FREE within 2 hours (minimum order 2 kg, gives 4–5 pan-ready trout for ₹1,160 total). How many Kgs of Cleaned & Gutted trout would you like for your family?"
• IF CUSTOMER ASKS FOR 1 KG:
  "Doorstep delivery is 100% FREE on 2 kg (₹1,160 total). If you'd like just 1 kg as a starter pack to taste today, we can dispatch it express for ₹580 + ₹${29 + surgeAdd} courier fee (₹${609 + surgeAdd} total), or you can visit our Live Vending Center in Malabagh with zero delivery fee. Which works better for you?"
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${609 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
DO NOT ask them for a WhatsApp GPS location pin!
======================================================`;
      } else if (detectedLoc.dist <= 7.0) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 2" OR ANY ZONE NUMBERS TO THE CUSTOMER! Speak naturally: "We deliver express right to your doorstep in ${detectedLoc.name}!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 9:00 PM IST) — +₹40 evening rush courier surge applies to subsidized courier orders. 3 kg+ is 100% FREE!" : ""}
• Doorstep Delivery: 100% FREE on 3 kg or more!
• 2 kg Order: Available with a nominal subsidized express courier fee of only *₹${39 + surgeAdd}* (₹1,160 + ₹${39 + surgeAdd} = *₹${1199 + surgeAdd} total* for Cleaned & Gutted).
• 1 kg Starter Pack: Available with subsidized courier fee of *₹${49 + surgeAdd}* (₹580 + ₹${49 + surgeAdd} = *₹${629 + surgeAdd} total*).
• Rates: Cleaned & Gutted = ₹580/kg | Whole Fresh = ₹540/kg
• Pitch for ${detectedLoc.name}:
  "Great! We deliver express to ${detectedLoc.name}! Doorstep delivery is 100% FREE on 3 kg (gives 6–7 fresh trout at ₹1,740 total). Or we can send 2 kg for just a nominal ₹${39 + surgeAdd} courier fee (₹${1199 + surgeAdd} total). How many Kgs would you like for your family?"
• IF CUSTOMER ASKS FOR 2 KG:
  Gladly confirm! "Sure, we'd be happy to send 2 kg! It comes to ₹1,160 fish + ₹${39 + surgeAdd} subsidized courier = ₹${1199 + surgeAdd} total. Shall I send your payment link?"
• IF CUSTOMER ASKS FOR 1 KG:
  "Doorstep delivery is 100% FREE on 3 kg (or ₹${39 + surgeAdd} on 2 kg). If you'd prefer just 1 kg starter pack to taste today, we can dispatch it express for ₹580 + ₹${49 + surgeAdd} courier fee (₹${629 + surgeAdd} total). Which would you like?"
• When customer confirms 3 kg Cleaned & Gutted: output [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: ${1199 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${629 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
DO NOT ask them for a WhatsApp GPS location pin!
======================================================`;
      } else if (detectedLoc.dist <= 11.5) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 3" OR ANY ZONE NUMBERS TO THE CUSTOMER! Speak naturally: "We deliver express right to your doorstep in ${detectedLoc.name}!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 9:00 PM IST) — +₹40 evening rush courier surge applies to subsidized courier orders. 3 kg+ is 100% FREE!" : ""}
• Doorstep Delivery: 100% FREE on 3 kg or more!
• 2 kg Order: Available with a nominal subsidized express courier fee of only *₹${69 + surgeAdd}* (₹1,160 + ₹${69 + surgeAdd} = *₹${1229 + surgeAdd} total* for Cleaned & Gutted).
• 1 kg Starter Pack: Available with subsidized courier fee of *₹${79 + surgeAdd}* (₹580 + ₹${79 + surgeAdd} = *₹${659 + surgeAdd} total*).
• Rates: Cleaned & Gutted = ₹580/kg | Whole Fresh = ₹540/kg
• Pitch for ${detectedLoc.name}:
  "Great! We deliver express to ${detectedLoc.name}! Doorstep delivery is 100% FREE on 3 kg (gives 6–7 fresh trout at ₹1,740 total). Or we can send 2 kg with just a subsidized ₹${69 + surgeAdd} courier fee (₹${1229 + surgeAdd} total). How many Kgs would you like for your family?"
• IF CUSTOMER ASKS FOR 2 KG:
  Gladly confirm! "Sure, let's do it! We'd be happy to send 2 kg to ${detectedLoc.name}. It comes to ₹1,160 fish + ₹${69 + surgeAdd} subsidized courier fee = ₹${1229 + surgeAdd} total. Shall I send your payment link?"
• IF CUSTOMER ASKS FOR 1 KG:
  "Doorstep delivery is 100% FREE on 3 kg (or ₹${69 + surgeAdd} on 2 kg). If you'd prefer just 1 kg starter pack to taste today, we can dispatch it express for ₹580 + ₹${79 + surgeAdd} courier fee (₹${659 + surgeAdd} total). Which works best for you?"
• When customer confirms 3 kg Cleaned & Gutted: output [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: ${1229 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${659 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
DO NOT ask them for a WhatsApp GPS location pin!
======================================================`;
      } else if (detectedLoc.dist <= 16.0) {
        localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}" (~${detectedLoc.dist} km from Malabagh).
⚠️ STRICT MANDATE: NEVER MENTION "Zone 4", ANY ZONE NUMBERS, OR KM RANGES LIKE "(11.5–16 km)" TO THE CUSTOMER! Speak naturally: "We deliver express right to your doorstep in ${detectedLoc.name}!".
CRITICAL DELIVERY & PRICING INSTRUCTIONS:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR (4:00 PM – 9:00 PM IST) — +₹40 evening rush courier surge applies to subsidized courier orders. 4 kg family pack remains 100% FREE!" : ""}
• Doorstep Delivery: 100% FREE on 4 kg family pack (gives 8–10 fresh trout at *₹2,320 total*)!
• 3 kg Order: Available with a nominal subsidized courier fee of *₹${49 + surgeAdd}* (₹1,740 + ₹${49 + surgeAdd} = *₹${1789 + surgeAdd} total*).
• 2 kg Order: Available with a nominal subsidized courier fee of *₹${89 + surgeAdd}* (₹1,160 + ₹${89 + surgeAdd} = *₹${1249 + surgeAdd} total*).
• 1 kg Starter Pack: Available with subsidized courier fee of *₹${119 + surgeAdd}* (₹580 + ₹${119 + surgeAdd} = *₹${699 + surgeAdd} total*).
• Rates: Cleaned & Gutted = ₹580/kg | Whole Fresh = ₹540/kg
• Pitch for ${detectedLoc.name}:
  "Great! We deliver express to ${detectedLoc.name}! Doorstep delivery is 100% FREE for our 4 kg family pack (gives 8–10 fresh trout at ₹2,320 total). We can also send 2 kg for just ₹${89 + surgeAdd} express courier fee (₹${1249 + surgeAdd} total) or 3 kg for ₹${49 + surgeAdd} courier fee (₹${1789 + surgeAdd} total). Which would you like for your home?"
• IF CUSTOMER ASKS FOR 2 KG:
  Gladly confirm! "Sure, let's do it! We can send 2 kg to ${detectedLoc.name} express for ₹1,160 fish + ₹${89 + surgeAdd} subsidized courier fee = ₹${1249 + surgeAdd} total. Shall I send your payment link?"
• IF CUSTOMER ASKS FOR 3 KG:
  "Sure! 3 kg to ${detectedLoc.name} is ₹1,740 fish + ₹${49 + surgeAdd} subsidized courier fee = ₹${1789 + surgeAdd} total. Shall I send your payment link?"
• IF CUSTOMER ASKS FOR 1 KG:
  "Doorstep delivery is 100% FREE on 4 kg (or ₹${89 + surgeAdd} on 2 kg). If you'd like just 1 kg as a starter pack, we can send it express for ₹580 + ₹${119 + surgeAdd} courier fee (₹${699 + surgeAdd} total), or you can visit our Live Vending Center in Malabagh with zero delivery fee. Which would you prefer?"
• When customer confirms 4 kg Cleaned & Gutted: output [PAY_LINK: 2320 : 4 kg Cleaned & Gutted]
• When customer confirms 3 kg Cleaned & Gutted: output [PAY_LINK: ${1789 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg Cleaned & Gutted: output [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 1 kg Cleaned & Gutted: output [PAY_LINK: ${699 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
DO NOT ask them for a WhatsApp GPS location pin!
======================================================`;
      }
    } else if (detectedLoc.status === "OUT_ZONE") {
      localityContext = `\n======================================================
📍 SMART LOCALITY DETECTED: Customer mentioned "${detectedLoc.name}", which is OUTSIDE our 16 km delivery perimeter.
CRITICAL INSTRUCTION: Inform them politely that doorstep delivery is restricted to 16 km across Srinagar to preserve cold chain freshness. You MUST include this exact phrase:
"However, you are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout and get it cleaned on the spot!" (Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9)
======================================================`;
    }
  } else {
    // If locality was NOT mentioned in current message, check if distance is known on file
    const savedLoc = chatMetadata[chatId] || (customerPhone ? chatMetadata[customerPhone] : null);
    if (savedLoc && savedLoc.distanceKm != null) {
      const sDist = savedLoc.distanceKm;
      if (sDist <= 4.0) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Nearby Srinagar: 0–4 km).
⚠️ STRICT MANDATE: NEVER SAY "ZONE 1" TO CUSTOMER!
• Doorstep Delivery: 100% FREE on 2 kg or more (Cleaned & Gutted ₹1,160).
• 1 kg starter pack: ₹580 + ₹${29 + surgeAdd} courier fee = ₹${609 + surgeAdd} total.
• If confirmed 2 kg: [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]
• If confirmed 1 kg: [PAY_LINK: ${609 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
      } else if (sDist <= 7.0) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Mid Srinagar: 4–7 km).${isEveningSurge ? "\n⚡ EVENING RUSH HOUR (5–9 PM): +₹40 evening rush courier surge applies to subsidized orders. 3 kg+ is 100% FREE!" : ""}
⚠️ STRICT MANDATE: NEVER SAY "ZONE 2" TO CUSTOMER!
• Doorstep Delivery: 100% FREE on 3 kg or more (Cleaned & Gutted ₹1,740).
• 2 kg: ₹1,160 + ₹${39 + surgeAdd} subsidized courier fee = ₹${1199 + surgeAdd} total.
• 1 kg: ₹580 + ₹${49 + surgeAdd} subsidized courier fee = ₹${629 + surgeAdd} total.
• If confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• If confirmed 2 kg: [PAY_LINK: ${1199 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 1 kg: [PAY_LINK: ${629 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
      } else if (sDist <= 11.5) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Greater Srinagar: 7–11.5 km).${isEveningSurge ? "\n⚡ EVENING RUSH HOUR (5–9 PM): +₹40 evening rush courier surge applies to subsidized orders. 3 kg+ is 100% FREE!" : ""}
⚠️ STRICT MANDATE: NEVER SAY "ZONE 3" TO CUSTOMER!
• Doorstep Delivery: 100% FREE on 3 kg or more (Cleaned & Gutted ₹1,740).
• 2 kg: ₹1,160 + ₹${69 + surgeAdd} subsidized courier fee = ₹${1229 + surgeAdd} total.
• 1 kg: ₹580 + ₹${79 + surgeAdd} subsidized courier fee = ₹${659 + surgeAdd} total.
• If confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]
• If confirmed 2 kg: [PAY_LINK: ${1229 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 1 kg: [PAY_LINK: ${659 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
      } else if (sDist <= 16.0) {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (Outer Corridor: 11.5–16 km).${isEveningSurge ? "\n⚡ EVENING RUSH HOUR (5–9 PM): +₹40 evening rush courier surge applies to subsidized orders. 4 kg family pack remains 100% FREE!" : ""}
⚠️ STRICT MANDATE: NEVER SAY "ZONE 4" TO CUSTOMER!
• Doorstep Delivery: 100% FREE on 4 kg family pack (Cleaned & Gutted ₹2,320).
• 3 kg: ₹1,740 + ₹${49 + surgeAdd} subsidized courier fee = ₹${1789 + surgeAdd} total.
• 2 kg: ₹1,160 + ₹${89 + surgeAdd} subsidized courier fee = ₹${1249 + surgeAdd} total.
• 1 kg: ₹580 + ₹${119 + surgeAdd} subsidized courier fee = ₹${699 + surgeAdd} total.
• If confirmed 4 kg: [PAY_LINK: 2320 : 4 kg Cleaned & Gutted]
• If confirmed 3 kg: [PAY_LINK: ${1789 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 2 kg: [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
• If confirmed 1 kg: [PAY_LINK: ${699 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
      } else {
        localityContext = `\n======================================================
📍 CUSTOMER DISTANCE ON FILE: ~${sDist} km (OUTSIDE delivery perimeter > 16 km).
• Doorstep delivery NOT available beyond 16 km. Strictly invite to Live Vending Center in Malabagh.
======================================================`;
      }
    } else {
      // Unverified locality
      localityContext = `\n======================================================
📍 LOCALITY UNVERIFIED (NOT IN CONFIRMED LIST):
CRITICAL REVENUE PROTECTION MANDATE (ZERO BLIND DISCARDING):
NEVER ASSUME OR GUESS THAT AN UNFAMILIAR LOCALITY IS OUTSIDE OUR 8 KM DELIVERY ZONE!
NEVER tell the customer that their area is outside our delivery zone unless it is a confirmed outside city!
INSTRUCTION: If the customer is inquiring about delivery to their location, politely ask for their WhatsApp location pin or nearest landmark to verify distance:
"Could you kindly share your WhatsApp location pin (tap 📎 ➔ Location ➔ Send current location) or nearest landmark? Our system will check your exact distance right away to confirm express doorstep delivery!"
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
• Cleaned & Gutted: *₹580/kg* (Pan-ready, scaled & cleaned)
• Whole Fresh: *₹540/kg*

🛵 *Doorstep delivery is 100% FREE* on eligible orders across Srinagar (min 2 kg for nearby areas like Malabagh, Soura, Hazratbal, Lal Bazar; 3–4 kg for other areas; subsidized express courier on smaller orders)!

Which area in Srinagar would you like delivery to, or would you like to visit our Live Vending Center in Malabagh?
======================================================`;
  } else if (
    /\b(?:discount|bargain|kam\s*karo|kuch\s*kam|rate\s*kam|price\s*kam|concession|less\s*karo|thoda\s*kam|koi\s*offer|offer\s*hai|cheaper|sasta)\b/i.test(trimmedLower) ||
    /\b(?:500|520|530|550)\s*(?:me|mai|de\s*do|karo)\b/i.test(trimmedLower)
  ) {
    intentContext = `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking for a discount ("${userMessage.trim()}").
CRITICAL DIRECTIVE ON DISCOUNTS (BE POLITE, CHARMING & CLOSE FORWARD — MAXIMUM 3 SHORT LINES):
- NEVER say "we have a strict policy on rates" or sound blunt!
- DO NOT send the customer backwards to the top of funnel (do NOT ask "Which cut do you want?").
- Reframe free delivery as the discount, suggest 2 kg upgrade, and close forward:
"We completely understand! Our prices hold firm because every fish is harvested alive just for you — no ice, no preservatives — and we absorb the full delivery cost.

The good news: upgrading to 2 kg (₹1,160 total) makes doorstep delivery 100% FREE — you save the delivery fee right there!

Shall I send your payment link for 2 kg?"
======================================================`;
  } else if (
    /\b(?:who\s*are\s*you|are\s*you\s*(?:a\s*)?(?:human|bot|ai|robot|machine|real\s*person)|kon\s*ho|tum\s*kon\s*ho|aap\s*kon\s*ho|bot\s*ho\s*ya|insaan\s*ho|ai\s*ho|digital\s*agent|computer\s*ho|kya\s*aap\s*ai\s*ho|what\s*are\s*you)\b/i.test(trimmedLower)
  ) {
    intentContext = `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking about your identity ("${userMessage.trim()}").
CRITICAL IDENTITY DIRECTIVE (BRIEF, PROUD & COURTEOUS):
Flex that Urban Trout is Jammu & Kashmir’s very first startup to integrate an AI sales assistant with WhatsApp:
"I am Urban Trout's AI sales assistant—proudly Jammu & Kashmir’s first startup to integrate AI on WhatsApp! 🚀

Our human farm team in Malabagh handles the live harvesting, cleaning, and express delivery directly to your kitchen.

How can I help you today? Would you like Cleaned & Gutted (₹580/kg) or Whole Fresh (₹540/kg) delivered to your home?"
======================================================`;
  }

  // ─── 1 KG QUERY INTENT DECODER (4-TIER AWARE PRICING & SUBSIDIZED COURIER) ───
  const is1KgIntent = /\b(?:(?:can\s*(?:i|we)\s*order|order|want|give|send|bhej\s*do|deliver|pack|price|rate|chahiye|mangwana|how\s*much\s*for)\s*)?(?:1|one)\s*(?:kg|kilo|kgs)\b/i.test(trimmedLower) || /^(?:1|one)\s*(?:kg|kilo|kgs)$/i.test(trimmedLower);
  if (is1KgIntent) {
    const locDist = detectedLoc?.dist ?? (chatMetadata[chatId]?.distanceKm ?? null);
    const locName = detectedLoc?.name ?? (chatMetadata[chatId]?.localityName ?? "your area");

    if (locDist !== null && locDist > 11.5 && locDist <= 16.0) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 4" OR ANY ZONE LABELS TO THE CUSTOMER!
• Doorstep delivery is 100% FREE on our 4 kg family pack (₹2,320 total).
• If customer wants 1 kg starter pack: ₹580 + ₹119 subsidized courier fee = *₹699 total*.
• If customer wants 2 kg: ₹1,160 + ₹89 subsidized courier fee = *₹1,249 total*.
• When customer confirms 1 kg: output [PAY_LINK: 699 : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: 1249 : 2 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
    } else if (locDist !== null && locDist > 7.0 && locDist <= 11.5) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 3" OR ANY ZONE LABELS TO THE CUSTOMER!
• Doorstep delivery is 100% FREE on 3 kg (₹1,740 total).
• If customer wants 1 kg starter pack: ₹580 + ₹79 subsidized courier fee = *₹659 total*.
• If customer wants 2 kg: ₹1,160 + ₹69 subsidized courier fee = *₹1,229 total*.
• When customer confirms 1 kg: output [PAY_LINK: 659 : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: 1229 : 2 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
    } else if (locDist !== null && locDist > 4.0 && locDist <= 7.0) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 2" OR ANY ZONE LABELS TO THE CUSTOMER!
• Doorstep delivery is 100% FREE on 3 kg (₹1,740 total).
• If customer wants 1 kg starter pack: ₹580 + ₹49 subsidized courier fee = *₹629 total*.
• If customer wants 2 kg: ₹1,160 + ₹39 subsidized courier fee = *₹1,199 total*.
• When customer confirms 1 kg: output [PAY_LINK: 629 : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: 1199 : 2 kg Cleaned & Gutted (+Express Delivery)]
======================================================`;
    } else if (locDist !== null && locDist <= 4.0) {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg for ${locName} (~${locDist} km from farm).
⚠️ STRICT MANDATE: NEVER MENTION "ZONE 1" OR ANY ZONE LABELS TO THE CUSTOMER!
• Doorstep delivery is 100% FREE on 2 kg (₹1,160 total).
• If customer prefers just 1 kg as a starter pack: ₹580 + ₹29 subsidized courier fee = *₹609 total* (or free counter pickup at our Live Vending Center in Malabagh with zero delivery fee).
• When customer confirms 1 kg: output [PAY_LINK: 609 : 1 kg Cleaned & Gutted (+Express Delivery)]
• When customer confirms 2 kg: output [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]
======================================================`;
    } else {
      intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer inquired about 1 kg, but their locality in Srinagar is NOT yet known.
⚠️ ABSOLUTE MANDATE: NEVER MENTION "ZONE 1" OR ANY ZONE NUMBERS! DO NOT ASSUME THEIR AREA!
• Explain warmly:
  "Great! For 1 kg, doorstep delivery is available with a nominal subsidized express courier fee (e.g. ₹29 for nearby areas like Malabagh, Soura, Hazratbal, Lal Bazar; ₹49–₹89 across other Srinagar localities).
  Alternatively, doorstep delivery is *100% FREE* on 2 kg or more (₹1,160 total), or you can pick up 1 kg fresh with zero delivery fee at our Live Vending Center in Malabagh.
  Which area in Srinagar shall we deliver to?"
• Always ask for their area so our system can calculate the exact delivery distance!
======================================================`;
    }
  }

  // ─── CUTS & PREPARATION INTENT DECODER ───
  const isCutsIntent = /\b(?:what\s*cuts?|types?\s*of\s*cuts?|cut\s*type|kaise\s*cut|pieces?|cut\s*karke|slice|steak|fillet|cleaned\s*(?:and|&)\s*gutted\s*kya\s*hai|what\s*is\s*cleaned)\b/i.test(trimmedLower);
  if (isCutsIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer asked about cuts & preparation ("${userMessage.trim()}").
CRITICAL DIRECTIVE (EMPHASIZE PAN-READY CONVENIENCE):
Directly explain the 2 options without pivoting to address or asking unrelated questions:
• *Cleaned & Gutted (₹580/kg) — Most Popular:*
  Completely gutted, descaled (all scales removed), and cut into cooking pieces/steaks. Arrives 100% pan-ready with ZERO preparation, ZERO mess, and ZERO cleaning needed at home!
• *Whole Fresh Trout (₹540/kg):*
  Full round live-harvested trout with head, tail, and skin intact for whole roasting, tandoor, or custom cutting.
Ask which cut they would prefer!
======================================================`;
  }

  // ─── VISCERAL WEIGHT LOSS & NET MEAT WEIGHT INTENT DECODER ───
  const isWeightLossIntent = /\b(?:(?:1\s*kg|one\s*kg|kitna|full)\s*(?:of\s*)?meat|meat\s*only|net\s*meat|net\s*weight|final\s*weight|after\s*clean(?:ing)?|after\s*gut(?:ting)?|saaf\s*karne\s*ke\s*baad|cleaning\s*ke\s*baad|cleaning\s*loss|visceral|weight\s*loss|weight\s*kam|kitna\s*(?:meat|weight)\s*(?:milega|bachega|hoga)|cutting\s*loss|sirf\s*meat|meat\s*weight)\b/i.test(trimmedLower);
  if (isWeightLossIntent) {
    intentContext += `\n======================================================
💡 QUERY INTENT DECODED: Customer is asking about NET MEAT WEIGHT / VISCERAL CLEANING LOSS ("${userMessage.trim()}").
⚠️ CRITICAL HONESTY & TRANSPARENCY LAW (ZERO MISREPRESENTATION):
• NEVER tell the customer that they get 1 kg of pure meat for ₹580! That is FALSE and illegal!
• All our trout are swimming live in spring-fed tanks and harvested live upon order.
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
• We are FULLY OPEN tomorrow (${tomorrowDayName}) from 7:00 AM to 9:00 PM!
• STRICT PROHIBITION: Under NO circumstances call tomorrow "Saturday" or mention Friday closure!
• Confirm that we are happy to schedule their fresh live-harvest delivery for tomorrow (${tomorrowDayName}) with 3 slots:
  • 🕗 Morning Slot: 7:00 AM – 11:00 AM (Harvest starts 7:00 AM)
  • 🕛 Afternoon Slot: 12:00 PM – 3:00 PM
  • 🕔 Evening Slot: 4:00 PM – 7:00 PM
• Ask which slot works best and confirm their quantity (Cleaned & Gutted @ ₹580/kg, minimum order 2 kg for free delivery)!
======================================================`;
  }

  // (Real-time IST Clock moved to top of generateGeminiReply)

  // ─── STORE VISIT / EXACT LOCATION INTENT DECODER ───
  const isVisitLocationIntent = /\b(?:where\s*(?:are\s*you|is\s*(?:your|the)\s*(?:farm|shop|store|counter|location|center|address))|location\s*(?:bhejo|share|do|plz|please)|exact\s*location|maps?\s*link|kahan\s*(?:pe\s*)?hai|kidhar\s*hai|visit\s*karna\s*hai|aana\s*hai|dukaan|counter\s*(?:kahan|kidhar|address))\b/i.test(trimmedLower);
  if (isVisitLocationIntent) {
    const counterHoursNote = isFridayToday
      ? "Counter Hours: STRICTLY CLOSED TODAY (FRIDAY) for weekly maintenance. Re-opens Saturday at 8:00 AM!"
      : "Counter Hours: 8:00 AM to 9:00 PM (Saturday to Thursday, strictly closed Fridays)";
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
  if (isFridayToday && !/\b(?:saturday|advance|hafta)\b/i.test(trimmedLower)) {
    const isFridayInquiry = /(?:deliver|order|open|aaj|today|now|abhi|right\s*now|available|bhej|chahiye|rate|visit|kahan|hai\s*kya|trout|fish|rate|price|cost|timing)/i.test(trimmedLower);
    if (isFridayInquiry) {
      const deterministicFridayReply = `Our Live Vending Center and doorstep delivery operations are strictly closed today (Friday) for weekly RAS bio-security maintenance, filtration backwashing, and staff weekly off.

However, we are actively taking advance bookings for tomorrow, Saturday!
• 🕗 *Morning Slot:* 7:00 AM – 11:00 AM (Harvest starts 7:00 AM)
• 🕛 *Afternoon Slot:* 12:00 PM – 3:00 PM
• 🕔 *Evening Slot:* 4:00 PM – 7:00 PM

• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero prep)
• Whole Fresh: *₹540/kg*

🛵 *Doorstep delivery is 100% FREE* on eligible orders (2 kg for 0–4 km, 3 kg for 4–11.5 km, 4 kg for 11.5–16 km; subsidized courier on smaller orders)!

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
  const isAskingTomorrowOnThursday = isThursdayToday && /\b(?:tomorrow|kal|friday|jumma|juma|jummah)\b/i.test(trimmedLower);
  if (isAskingTomorrowOnThursday && /(?:available|deliver|delivery|open|bhej|chahiye|order|mil\s*jayega|mil\s*sakega|ho\s*(?:sakta|jayega)|send|timing|slot)/i.test(trimmedLower)) {
    const deterministicThuForFriReply = `Tomorrow is Friday, and our farm and delivery operations are strictly closed on Fridays for scheduled RAS bio-security maintenance and filtration backwashing (zero counter walk-ins and zero doorstep deliveries on Friday).

We would be delighted to schedule your fresh live-harvest delivery for:
1️⃣ *Today (Thursday):* Delivered within 2 hours to your doorstep (we are open until 9:00 PM)!
2️⃣ *Saturday:* Advance booking with your preferred slot:
• 🕗 *Morning:* 7:00 AM – 11:00 AM
• 🕛 *Afternoon:* 12:00 PM – 3:00 PM
• 🕔 *Evening:* 4:00 PM – 7:00 PM

🛵 *Doorstep delivery is 100% FREE* on eligible orders (2 kg for 0–4 km, 3 kg for 4–11.5 km, 4 kg for 11.5–16 km; subsidized courier on smaller orders)!

Would you prefer fresh delivery today (Thursday) within 2 hours, or an advance booking for Saturday?`;

    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: deterministicThuForFriReply });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return deterministicThuForFriReply;
  }

  // DETERMINISTIC HARD LOCK PAST 9:00 PM IST (OR PRE-DAWN BEFORE 7:00 AM)
  // If local time is outside delivery hours and customer asks for immediate delivery / tonight / 1-2 hours:
  const mentionsTomorrow = /\b(?:tomorrow|kal|subah|morning|afternoon|evening|saturday|hafta)\b/i.test(userMessage);
  const isAskingImmediateTonight = !mentionsTomorrow && /(?:(?:any\s*)?(?:1|2|one|two)\s*hours?|tonight|right\s*now|ab\s*hi|abhi|aaj\s*hi|today\s*night|deliver\s*(?:now|tonight|today)|immediate|jaldi|urgent|asap)/i.test(userMessage);

  if ((isNightAfter9PM || isEarlyPreDawn) && isAskingImmediateTonight) {
    let deterministicNightReply = "";
    if (existingOrder && !existingOrder.notFound && /(?:paid|confirmed|harvest|dispatch)/i.test(existingOrder.status || "")) {
      deterministicNightReply = isThursdayToday
        ? `Our deliveries for tonight closed at 9:00 PM. Please note our farm is strictly closed on Fridays for weekly RAS filtration and bio-security maintenance.

Your order (*#${existingOrder.orderRef}* - ${existingOrder.items || "Fresh Rainbow Trout"}) is confirmed! It is scheduled for fresh morning live harvest and express dispatch on *Saturday morning between 7:00 AM and 11:00 AM*.

We will deliver it fresh to your doorstep!`
        : `Our deliveries for tonight closed at 9:00 PM. We start fresh orders from 7:00 AM every morning!

Your order (*#${existingOrder.orderRef}* - ${existingOrder.items || "Fresh Rainbow Trout"}) is confirmed! It is scheduled for fresh morning live harvest from our crystal-clear oxygen-saturated cold water tanks and express dispatch tomorrow morning between *7:00 AM and 11:00 AM*.

We will deliver it fresh to your doorstep!`;
    } else {
      deterministicNightReply = isThursdayToday
        ? `Our deliveries for tonight closed at 9:00 PM. Please note that our farm is strictly closed on Fridays for weekly RAS filtration and bio-security maintenance (zero counter walk-ins and zero doorstep deliveries on Friday).

We start taking fresh live-harvest orders from 7:00 AM every Saturday morning! We would be delighted to schedule your delivery for Saturday:
• 🕗 *Morning Slot:* 7:00 AM – 11:00 AM (Harvest starts 7:00 AM)
• 🕛 *Afternoon Slot:* 12:00 PM – 3:00 PM
• 🕔 *Evening Slot:* 4:00 PM – 7:00 PM

🛵 *Doorstep delivery is 100% FREE* on eligible orders (2 kg for 0–4 km, 3 kg for 4–11.5 km, 4 kg for 11.5–16 km; subsidized courier on smaller orders)!

Which slot on Saturday works best for your delivery, and how many Kgs of Cleaned & Gutted trout (₹580/kg, pan-ready) shall I book for you?`
        : `Our deliveries for tonight closed at 9:00 PM. We start taking fresh live-harvest orders from 7:00 AM every morning!

We would be delighted to schedule your fresh live-harvest delivery for tomorrow:
• 🕗 *Morning Slot:* 7:00 AM – 11:00 AM (Harvest starts 7:00 AM)
• 🕛 *Afternoon Slot:* 12:00 PM – 3:00 PM
• 🕔 *Evening Slot:* 4:00 PM – 7:00 PM

🛵 *Doorstep delivery is 100% FREE* on eligible orders (2 kg for 0–4 km, 3 kg for 4–11.5 km, 4 kg for 11.5–16 km; subsidized courier on smaller orders)!

Which slot tomorrow works best for your delivery, and how many Kgs of Cleaned & Gutted trout (₹580/kg, pan-ready) shall I book for you?`;
    }

    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: deterministicNightReply });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return deterministicNightReply;
  }

  const fridayOperatingNote = isFridayToday
    ? `CRITICAL ALERT: TODAY IS FRIDAY — WE ARE 100% CLOSED TODAY:
   - BOTH our Live Vending Center counter in Malabagh AND doorstep delivery operations are STRICTLY CLOSED today for weekly farm bio-security maintenance, RAS filtration backwashing, and staff weekly off.
   - ZERO live harvesting and ZERO dispatches today. Under NO circumstances should you promise or confirm delivery today!
   - If a customer asks for trout today or asks if we are open today, explain politely that we are closed on Fridays, and offer advance bookings for SATURDAY (Morning 7–11 AM, Afternoon 12–3 PM, Evening 4–7 PM).
   - Advance bookings and payment links for SATURDAY or later are warmly welcomed!`
    : isThursdayToday
    ? `CRITICAL ALERT: TODAY IS THURSDAY — TOMORROW IS FRIDAY (100% CLOSED):
   - We are OPEN for orders and deliveries TODAY (Thursday) until 9:00 PM (delivered within 2 hours).
   - ABSOLUTE LAW: TOMORROW IS FRIDAY — WE ARE 100% CLOSED TOMORROW! Both our Live Vending Center counter AND doorstep deliveries are strictly closed on Fridays for farm RAS filtration and bio-security maintenance.
   - ZERO dispatches and ZERO counter walk-ins on Friday!
   - NEVER promise, confirm, or accept orders for tomorrow (Friday).
   - If a customer asks about delivery for tomorrow or Friday, explain Friday closure and offer delivery TODAY (within 2 hours) or advance booking for SATURDAY!`
    : `STORE & DELIVERY HOURS:
   - Doorstep Delivery: 7:00 AM to 9:00 PM, Saturday through Thursday (delivered within 2 hours). STRICTLY CLOSED ON FRIDAYS.
   - Live Vending Center in Malabagh: Open 8:00 AM to 9:00 PM, Saturday to Thursday (strictly closed Fridays for scheduled RAS filtration and bio-security maintenance).
   ⚠️ NOTE: Today is ${todayDayName}. Tomorrow is ${tomorrowDayName}. We are 100% OPEN today and tomorrow! Do NOT mention Friday or Saturday closure unless today is Thursday or Friday!`;

  let timeStatusDetail = "";
  if (isFridayToday) {
    timeStatusDetail = `🛑 CURRENT STATUS: FRIDAY — ENTIRE FACILITY & DELIVERIES 100% CLOSED TODAY!
- We are completely closed today (Friday) for weekly RAS filtration bio-security maintenance.
- Zero live harvesting and zero dispatches today.
- We resume fresh operations tomorrow, Saturday morning at 7:00 AM!
- ALWAYS offer advance bookings for SATURDAY (Morning 7-11 AM, Afternoon 12-3 PM, Evening 4-7 PM).`;
  } else if (isOperatingHours) {
    const thuNote = isThursdayToday 
      ? "\n⚠️ URGENT REMINDER: TODAY IS THURSDAY. TOMORROW (FRIDAY) IS 100% CLOSED! NEVER OFFER OR PROMISE DELIVERY FOR TOMORROW/FRIDAY! If customer asks about tomorrow/Friday, offer delivery TODAY or advance booking for SATURDAY!" 
      : `\n📅 TODAY IS: ${todayDayName}. Tomorrow is ${tomorrowDayName}. We are OPEN today until 9:00 PM, and we are OPEN tomorrow (${tomorrowDayName}) from 7:00 AM! Do NOT mention Friday closure or Saturday!`;
    timeStatusDetail = `✅ CURRENT STATUS: OPEN & ACTIVELY ACCEPTING ORDERS (7:00 AM - 9:00 PM)!
- We start taking fresh live-harvest orders from 7:00 AM every single day (except Friday)!
- We are currently open and actively taking orders for TODAY (${todayDayName}) right now!
- Live-harvested Rainbow Trout delivered straight to the customer's doorstep WITHIN 2 HOURS (or at their preferred scheduled time slot today up to 9:00 PM).
- Minimum order: 2 kg for 0–4 km, 3 kg for 4–6 km, 4 kg for 6–8 km.
- ABSOLUTELY NEVER say "deliveries wrapped up" or "book for tomorrow" during daytime (7:00 AM - 9:00 PM)! Offer live delivery TODAY within 2 hours!${thuNote}`;
  } else if (isNightAfter9PM) {
    if (isThursdayToday) {
      timeStatusDetail = `⚠️ CURRENT STATUS: THURSDAY NIGHT AFTER-HOURS (Current time in Srinagar is ${istTimeStr}).
- Tonight's deliveries closed at 9:00 PM.
- ⚠️ CRITICAL: TOMORROW IS FRIDAY — WE ARE 100% CLOSED TOMORROW!
- DO NOT OFFER DELIVERY FOR TOMORROW (FRIDAY)!
- We start taking fresh live-harvest orders on SATURDAY morning from 7:00 AM sharp!
- ALWAYS offer delivery for SATURDAY with 3 slots:
  • 🕗 Morning: 7:00 AM – 11:00 AM (Harvest begins 7:00 AM)
  • 🕛 Afternoon: 12:00 PM – 3:00 PM
  • 🕔 Evening: 4:00 PM – 7:00 PM
- Ask the customer which time slot on SATURDAY works best for their delivery!`;
    } else {
      timeStatusDetail = `⚠️ CURRENT STATUS: NIGHT AFTER-HOURS (Current time in Srinagar is ${istTimeStr}).
- Tonight's deliveries closed at 9:00 PM.
- Tomorrow is ${tomorrowDayName}. We start taking fresh live-harvest orders tomorrow (${tomorrowDayName}) morning from 7:00 AM sharp!
- ALWAYS offer delivery for TOMORROW (${tomorrowDayName}) with 3 slots:
  • 🕗 Morning: 7:00 AM – 11:00 AM (Orders and live harvest begin 7:00 AM)
  • 🕛 Afternoon: 12:00 PM – 3:00 PM
  • 🕔 Evening: 4:00 PM – 7:00 PM
- Ask the customer which time slot tomorrow (${tomorrowDayName}) works best for their delivery!
- ⚠️ Under NO circumstances call tomorrow "Saturday" unless today is actually Friday!`;
    }
  } else {
    if (isThursdayToday) {
      timeStatusDetail = `🌅 CURRENT STATUS: EARLY MORNING (Pre-Dawn, current time is ${istTimeStr}).
- Today is Thursday! We start taking fresh live-harvest orders and dispatch at 7:00 AM sharp until 9:00 PM! (Note: Tomorrow Friday is closed).`;
    } else {
      timeStatusDetail = `🌅 CURRENT STATUS: EARLY MORNING (Pre-Dawn, current time is ${istTimeStr}).
- Today is ${todayDayName}! We start taking fresh live-harvest orders and dispatch at 7:00 AM sharp!
- We accept orders for TODAY (${todayDayName}) starting from the 7:00 AM morning slot! Fresh live-harvest delivered within 2 hours or at customer's preferred scheduled slot.`;
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
3. Under NO circumstances bring up Friday closure or Saturday opening unless today is Thursday or Friday! Today is ${todayDayName}, we are 100% OPEN and operational.
4. It is currently ${timeOfDayDesc} (${istTimeStr}). NEVER say "Good evening" or "Have a wonderful evening" when it is ${timeOfDayDesc}!
======================================================
${timeStatusDetail}
======================================================`;

  const stageInstruction = isFirstMessage
    ? `NEW CONVERSATION INITIATION:
- Begin with a friendly, brief greeting leading with our outcome and live-harvest hook.
${isVipCustomer ? `- 👑 VIP RETURNING CUSTOMER RULE: Address customer respectfully by name as indicated in their VIP profile (${vipProfile.salutation || "Valued Patron"}). Offer to repeat their usual order (${vipProfile.usualWeightKg} kg ${vipProfile.usualCut} to ${vipProfile.locality}).` : `- STRICT PROFESSIONAL RULE FOR NEW LEADS: NEVER address or call the customer by any personal name (e.g. no "Hello Munir!", "Dear Uzma,", "Hi Shahid,"). Greet neutrally.`}
- Keep the message brief, to the point, and scannable in 3 seconds.
- NEVER use the word "Janab".
- NEVER say "Malabagh Vending Center" — always use "Live Vending Center in Malabagh".`
    : `ONGOING FOLLOW-UP CONVERSATION:
- CRITICAL DIRECTIVE: BE ULTRA-CONCISE & ANSWER ONLY WHAT IS ASKED!
- Customers have no time to read. Keep replies to 1–3 short lines maximum!
- NO UNNECESSARY FLUFF: Do NOT lecture the customer or provide unasked info (e.g. bio-security, packaging layers, refrigeration guides) unless specifically requested.
${isVipCustomer ? `- 👑 VIP RETURNING CUSTOMER: If customer confirms or says yes/repeat/same, immediately output their payment link ${vipProfile.reorderPayTag}!` : `- NO REPEATED GREETINGS & NO DUPLICATE WELCOMES: Do NOT say "Hello", "Hi", "Salam", or "Welcome to Urban Trout". NEVER address the customer by personal name. If customer repeats their initial ad greeting ("Hi Urban Trout, I saw your ad..."), DO NOT greet them again or repeat the whole welcome menu! Simply ask: "Which area in Srinagar would you like delivery to, and how many kg would you like?"`}
- TERMINOLOGY: Use "Live Vending Center" (located in Malabagh). NEVER say "Malabagh Vending Center".
- STRICT PROHIBITION: NEVER use the word "Janab".`;

  const directive = `
${systemPrompt}
${timeContext}
${orderContext}
${localityContext}
${intentContext}

CRITICAL READABILITY & MAXIMUM BREVITY MANDATE (ANSWER ONLY WHAT IS REQUIRED):
1. ZERO WALL-OF-TEXT: Customers hardly have time to read. Keep every response brief, clean, and organized (maximum 2 to 4 short lines).
2. ANSWER ONLY WHAT IS ASKED: Never provide unprompted explanations, bio-security details, food-grade packaging descriptions, or unasked policies unless directly asked.
3. ABSOLUTE BAN ON CALLING CUSTOMERS BY NAME: Under NO circumstances should you ever address or call the customer by any personal name (no "Hello Munir!", "Dear Uzma,", "Hi Shahid," etc.). Addressing customers by name looks unprofessional. Greet completely neutrally ("Hello! Welcome to Urban Trout.") or jump straight into the answer without any name.
4. DO NOT REPEAT PRICE BULLETS OR RATE MENUS IN ONGOING CHATS: If prices or cuts were already mentioned in recent messages, NEVER recite the full rate again or ask repetitive questions. Acknowledge what the customer just said and advance the conversation forward naturally!
5. HERO PRODUCT MANDATE (MAXIMIZE PROFIT & ELIMINATE CHOICE FRICTION):
   • Always quote Cleaned & Gutted (*₹580/kg*, Pan-ready steaks) by default. This is our highest-margin, advertised product.
   • NEVER mention or push Whole Fresh Trout (*₹540/kg*) upfront!
   • Whole Fresh Trout (*₹540/kg*, uncleaned/round) is an unadvertised on-demand fallback option. ONLY reveal it if the customer specifically asks: "bina saaf kiye", "whole fish", "sabut", "uncleaned", or pushes hard on price.
   • When customer asks about whole/uncleaned: "Yes, we also offer Whole Fresh Trout (uncleaned/round) at ₹540/kg if you prefer cleaning it at home. However, most families choose our Cleaned & Gutted (₹580/kg) because it arrives completely descaled, gutted, and cut into pan-ready steaks with zero kitchen mess. Which would you prefer?"
6. DELIVERY CALLOUT LINE (SEPARATE LINE BELOW RATES):
   🛵 *Doorstep delivery is 100% FREE* on eligible orders across Srinagar (min 2 kg for nearby areas, 3–4 kg for other Srinagar areas; subsidized express courier on smaller orders)!
7. TERMINOLOGY: Always use "Live Vending Center" (located in Malabagh). NEVER say "Malabagh Vending Center".
8. STRICT PROHIBITION: NEVER MENTION ZONE NUMBERS (ZONE 1, 2, 3, 4) OR KM RANGES TO CUSTOMERS:
   • Internal delivery zones are for backend fee calculations ONLY. Customers find zone labels confusing, cold, and robotic!
   • ABSOLUTELY NEVER say: "Zone 1", "Zone 2", "Zone 3", "Zone 4", "(Zone 1)", "in your area (Zone 1)", "Zone 3 area", or "(11.5–16 km)"!
   • ALWAYS speak naturally using locality names: "Great! We deliver express right to your doorstep in [Locality]!" or "for nearby areas like Malabagh, Soura, Hazratbal".
   • State the free delivery policy warmly: e.g. "For Hyderpora, doorstep delivery is 100% FREE on 4 kg or more!"

9. STRICT MOQ-FIRST POLICY (ZERO PROACTIVE 1 KG DOWNSELLING):
   • When greeting a new lead, sharing prices, or confirming a delivery locality: ALWAYS state or ask for the Area Minimum Order Quantity (MOQ: 2 kg for nearby areas like Malabagh/Soura/Hazratbal, 3 kg for mid/greater Srinagar, 4 kg for outer corridor).
   • NEVER volunteer 1 kg or mention delivery fees upfront! Pitching 1 kg upfront hurts basket size and causes customer confusion.
   • ONLY when a customer explicitly asks: "Can I get 1 kg?", "1 kg kitne ka hai?", "1kg chahiye", or asks for an amount below the Area MOQ:
     - Step 1: Explain that the Area MOQ gives 100% free delivery.
     - Step 2: Gladly accommodate them with our nominal subsidized express courier (+₹29 for nearby areas, +₹49 to +₹89 for other areas) or free counter pickup at our Live Vending Center in Malabagh.
     - Step 3: When customer confirms, generate the payment link immediately.

10. MANDATORY LIVE-HARVEST WEIGHING & VISCERAL LOSS DISCLOSURE LAW:
   • Live trout are swimming in pure cold-water tanks and harvested live upon order.
   • Every order is scooped live from the tanks and weighed WHOLE on certified digital scales at harvest.
   • During hygienic gutting & descaling, gills, scales, and viscera are removed, naturally resulting in a standard 15% to 20% visceral weight loss.
   • A 1 kg live trout yields approximately 800g to 850g of clean, pan-ready steaks (zero kitchen mess).
   • ABSOLUTELY NEVER say or imply that 1 kg Cleaned & Gutted gives 1 kg of net meat!
   • If customer asks: "Will it be 1kg meat only?", "Saaf karke kitna bachega?", "Net weight kya hoga?":
     Always answer with 100% transparency: Live harvest is weighed whole (1.0 kg); expert gutting/descaling has a natural 15-20% visceral loss (yielding ~800-850g net steaks). If they want 1 kg of net meat on their scale, offer a 1.25 kg live harvest (₹725).

11. PRICE-LOCK & NO BAIT-AND-SWITCH GUARANTEE:
   • Once an order price or courier fee has been quoted to a customer for their area (e.g. "2 kg Batamaloo = ₹1,249"), that quote is 100% LOCKED IN for that order!
   • When the customer shares their WhatsApp location pin or exact colony name, NEVER recalculate or increase the courier fee! The GPS pin is solely for our delivery rider's navigation.
   • If a customer inquired before 4:00 PM and confirms during evening rush hours (4:00 PM – 9:00 PM), ALWAYS honor the original daytime quote without adding rush surcharges. Bait-and-switch pricing destroys customer trust.

CONVERSATION FLOW & GREETING RULE:
${stageInstruction}

SPECIAL SYSTEM CAPABILITY (RAZORPAY PAYMENT LINK GENERATOR):
4-TIER DELIVERY DISTANCES & PRICING:${isEveningSurge ? "\n⚡ CURRENT TIME: EVENING RUSH HOUR ACTIVE (4:00 PM – 9:00 PM IST) — +₹40 evening rush courier surge is included in all subsidized courier tags below. 4 kg family pack (and 2-3 kg eligible free deliveries) remains 100% FREE!" : ""}
1. NEARBY AREAS (0 to 4.0 km from Malabagh — Core Area: Malabagh, Soura, Hazratbal, Lal Bazar, Zakura):
   - Free Delivery MOQ: 2 KG or more
   - Cleaned & Gutted: 2 kg = ₹1,160 | 3 kg = ₹1,740 | 4 kg = ₹2,320 (100% FREE delivery)
   - 1 KG Starter Pack: ₹580 + ₹${29 + surgeAdd} subsidized courier fee = ₹${609 + surgeAdd} total:
     [PAY_LINK: ${609 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
   - Confirmed 2 kg: [PAY_LINK: 1160 : 2 kg Cleaned & Gutted]

2. MID SRINAGAR (4.0 to 7.0 km from Malabagh — Hawal, Khanyar, Rainawari, Nowhatta, Eidgah):
   - Free Delivery MOQ: 3 KG or more (3 kg Gutted = ₹1,740 total)
   - 2 KG Order: Subsidized express courier fee of only ₹${39 + surgeAdd} (₹1,160 + ₹${39 + surgeAdd} = ₹${1199 + surgeAdd} total):
     [PAY_LINK: ${1199 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
   - 1 KG Starter Pack: ₹580 + ₹${49 + surgeAdd} courier fee = ₹${629 + surgeAdd} total:
     [PAY_LINK: ${629 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
   - Confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]

3. GREATER SRINAGAR (7.0 to 11.5 km from Malabagh — Lal Chowk, Rajbagh, Dalgate, Jawahar Nagar, Bemina):
   - Free Delivery MOQ: 3 KG or more (3 kg Gutted = ₹1,740 total)
   - 2 KG Order: Subsidized express courier fee of only ₹${69 + surgeAdd} (₹1,160 + ₹${69 + surgeAdd} = ₹${1229 + surgeAdd} total):
     [PAY_LINK: ${1229 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
   - 1 KG Starter Pack: ₹580 + ₹${79 + surgeAdd} courier fee = ₹${659 + surgeAdd} total:
     [PAY_LINK: ${659 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
   - Confirmed 3 kg: [PAY_LINK: 1740 : 3 kg Cleaned & Gutted]

4. SOUTH SRINAGAR & OUTER CORRIDOR (11.5 to 16.0 km from Malabagh — Rawalpora, Hyderpora, Sanat Nagar, Peerbagh):
   - Free Delivery MOQ: 4 KG family pack (4 kg Gutted = ₹2,320 total):
     [PAY_LINK: 2320 : 4 kg Cleaned & Gutted]
   - 3 KG Order: Subsidized courier fee of only ₹${49 + surgeAdd} (₹1,740 + ₹${49 + surgeAdd} = ₹${1789 + surgeAdd} total):
     [PAY_LINK: ${1789 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
   - 2 KG Order: Subsidized courier fee of only ₹${89 + surgeAdd} (₹1,160 + ₹${89 + surgeAdd} = ₹${1249 + surgeAdd} total):
     [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
   - 1 KG Starter Pack: ₹580 + ₹${119 + surgeAdd} courier fee = ₹${699 + surgeAdd} total:
     [PAY_LINK: ${699 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]

5. BEYOND 16.0 KM (Outer Districts — Pampore, Chadoora, Harwan, HMT/Lawaypora, Budgam, Jammu):
   - Doorstep delivery is not feasible beyond 16 km to maintain cold chain. Direct them to visit Live Vending Center in Malabagh.

HOW TO HANDLE 1 KG & 2 KG INQUIRIES (VALUE-UPGRADE FIRST — ZERO STICKER SHOCK):
• Always highlight the free delivery threshold first, but warmly welcome 1 kg / 2 kg with our small subsidized courier fee.
• When customer confirms, NEVER re-pitch MOQ! Immediately output the exact [PAY_LINK: ...] tag!
- Nearby Areas (1 kg): [PAY_LINK: ${609 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
- Mid Srinagar (2 kg): [PAY_LINK: ${1199 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
- Mid Srinagar (1 kg): [PAY_LINK: ${629 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
- Greater Srinagar (2 kg): [PAY_LINK: ${1229 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
- Greater Srinagar (1 kg): [PAY_LINK: ${659 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]
- Outer Corridor (2 kg): [PAY_LINK: ${1249 + surgeAdd} : 2 kg Cleaned & Gutted (+Express Delivery)]
- Outer Corridor (3 kg): [PAY_LINK: ${1789 + surgeAdd} : 3 kg Cleaned & Gutted (+Express Delivery)]
- Outer Corridor (1 kg): [PAY_LINK: ${699 + surgeAdd} : 1 kg Cleaned & Gutted (+Express Delivery)]

In your response when confirmed, include this EXACT tag on its own line:
[PAY_LINK: TOTAL_AMOUNT : ITEM_DESCRIPTION]

Example (Nearby Area, 2 kg):
[PAY_LINK: 1160 : 2 kg Cleaned & Gutted]

Example (Mid / Greater Srinagar, 3 kg):
[PAY_LINK: 1740 : 3 kg Cleaned & Gutted]

Example (Outer Corridor, 4 kg):
[PAY_LINK: 2320 : 4 kg Cleaned & Gutted]

Our payment engine will automatically replace that tag with an official, organized order summary card breaking down all charges (fish price, delivery fee, clean double packaging, total amount) and a secure Razorpay payment link.
NEVER write any raw UPI ID, bank details, or generic payment methods in text. ONLY output the [PAY_LINK: ...] tag!

SCANNER & QR CODE REQUEST HANDLING ("SCANNER BHEJO" / "SEND QR CODE"):
• Customers often prefer scanning a QR code with PhonePe, Google Pay, or J&K Bank mPay.
• NEVER deflect the customer, never say "we don't have a scanner", and never insist that they can only use a text link!
• When a customer asks for a "scanner", "QR", "scanner bhejo", or "send scanner":
  - If their quantity is known (e.g. 1 kg or 2 kg), output the [PAY_LINK: TOTAL_AMOUNT : ITEM_DESCRIPTION] tag immediately! Our payment engine will automatically render and send a locked-amount QR code scanner image directly to their WhatsApp!
  - If their quantity is not mentioned yet, warmly ask: "Certainly! Would you like 1 kg or 2 kg of Cleaned & Gutted trout so our automated system can generate your exact locked-amount QR scanner for you? 🐟"

OPERATING HOURS & DELIVERY PROTOCOLS:
1. OPERATING HOURS & STRICT FRIDAY CLOSURE POLICY:
${fridayOperatingNote}
2. IMMEDIATE & SCHEDULED DELIVERIES (YES, WE DO SCHEDULED ORDERS!):
   - We start taking fresh live-harvest orders every day from 7:00 AM to 9:00 PM!
   - Immediate express delivery within Srinagar is delivered within 2 hours of payment confirmation.
   - Customers CAN schedule deliveries for ANY preferred future date & time slot between 7:00 AM and 9:00 PM.
   - NEVER tell a customer that we do not offer scheduled future deliveries! We happily take scheduled orders.
3. 100% UPFRONT PAYMENT LAW & TRUST-BUILDER FOR CASH/COD INQUIRIES:
   - We harvest live swimming fish ONLY upon upfront payment confirmation via locked Razorpay link. We do NOT stock dead fish or freeze pre-harvested fish.
   - TRUST-BUILDER WHEN CUSTOMER ASKS FOR COD, CASH, POD, OR HESITATES TO PAY VIA LINK:
     Explain concisely (maximum 4 lines):
     "We completely understand! Here is why we operate strictly via secure upfront link:
     ✅ Fish is ALIVE in our tanks right now — harvested fresh ONLY after you confirm.
     ✅ Govt-approved facility (Dept of Fisheries, J&K) in Malabagh.
     ✅ Prefer cash? You are warmly welcome to visit our Live Vending Center in Malabagh to pick live trout in person!

     Or lock your slot via Razorpay — takes 30 seconds. Which works better for you?"
4. DELIVERY RADIUS & 4-TIER MOQ MANDATE:
   - Doorstep deliveries are offered up to 16 km across Srinagar!
   - TIER 1 (0 to 4.0 km): 100% FREE on 2 kg+ (Cleaned & Gutted ₹1,160). 1 kg via express courier = ₹609.
     Confirmed areas: Malabagh, Mirza Bagh, Naseem Bagh, Hazratbal, Habak, Zakura, Batapora, Gulab Bagh, Buchpora, Soura, Ahmad Nagar, 90 Feet Road, Illahi Bagh, Nowshera, Bagh Ali Mardan Khan, Zadibal, Lal Bazar, Botakadal, Saderbal, Kanitar, Nigeen, Ashaie Bagh, Umer Colony, Usman Colony, Bilal Colony, Zoonimar, Pandach.
   - TIER 2 (4.0 to 7.0 km): 100% FREE on 3 kg+ (Cleaned & Gutted ₹1,740). 2 kg = ₹1,199 (only ₹39 courier fee). 1 kg = ₹629 (₹49 fee).
     Confirmed areas: Hawal, Badamwari, Madin Sahib, Alamgari Bazar, Saida Kadal, Nagbal, Kathi Darwaza, Mirak Shah Colony, Tailbal, Rainawari, Khanyar, Nowhatta, Gojwara, Shalimar, Eidgah, Safakadal, Ali Kadal, Bakura, Shuhama, Sangam.
   - TIER 3 (7.0 to 11.5 km): 100% FREE on 3 kg+ (Cleaned & Gutted ₹1,740). 2 kg = ₹1,229 (only ₹69 courier fee). 1 kg = ₹659 (₹79 fee).
     Confirmed areas: Karan Nagar, Lal Chowk, Jawahar Nagar, Khayam, Dalgate, Rajbagh, Sonwar, Qamarwari, Batamaloo, Bemina, Nishat, Brein, Alochi Bagh, Magarmal Bagh, Balgarden, Gogji Bagh, Wazir Bagh, Tulsi Bagh, Hazuri Bagh, Iqbal Park, Rambagh/Solina, Barzulla.
   - TIER 4 (11.5 to 16.0 km): 100% FREE on 4 kg family pack (Cleaned & Gutted ₹2,320). 3 kg = ₹1,789 (₹49 fee). 2 kg = ₹1,249 (₹89 fee). 1 kg = ₹699 (₹119 fee).
     Confirmed areas: Sanat Nagar, Rawalpora, Hyderpora, Chanapora, Natipora, Peerbagh, Airport Road / Humhama, Ganderbal, Bagh-e-Mehtab, Kralpora, Rangreth, Lasjan, Nowgam, Padshahi Bagh, Pantha Chowk, Soiteng, Pandrathan, Athwajan, Pohru, Mochu.
   - CONFIRMED OUT-ZONE AREAS (> 16 km): Pampore, Chadoora, Lawaypora, HMT, Harwan, Budgam, Ompora, Baramulla, Anantnag, Jammu.
     No delivery beyond 16 km to maintain cold chain. Direct them to visit Live Vending Center in Malabagh.
   - CRITICAL REVENUE PROTECTION RULE (NEVER BLINDLY DISCARD LEADS):
     If a customer mentions a locality, colony, or address that is NOT on the confirmed lists, NEVER ASSUME OR GUESS IT IS OUTSIDE ZONE!
     DO NOT reject them or send the outside-zone message!
     Instead, politely ask for their WhatsApp location pin so our automated system can verify their distance:
     "Could you kindly share your WhatsApp location pin (tap 📎 ➔ Location ➔ Send current location) or nearest landmark? Our system will verify your exact distance right away to confirm express doorstep delivery!"
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

• Counter Hours: 8:00 AM to 9:00 PM (Saturday to Thursday, closed Fridays)
• Live Counter: You can pick live swimming trout from our holding tanks and get it cleaned on the spot!
• Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9"
6. LOCATION PIN & GPS VERIFICATION FLOW:
   - If the customer has already named an in-zone area (e.g. Buchpora, Soura, Hazratbal, Lal Bazar, Zakura, etc.), DO NOT ASK FOR A LOCATION PIN! Confirm delivery right away.
   - If the conversation history indicates that the customer already shared their location pin or Google Maps link and was verified [IN RANGE (<=16km)], DO NOT ask for their address or location pin again! Immediately proceed with confirming quantity, cut, delivery slot, and generating the payment link.
   - Only if you are unsure of the customer's exact location, invite them to share their WhatsApp location pin (tap 📎 -> Location -> Send your current location) or paste a Google Maps link for instant automated verification.
7. HARVEST LOCK & NO-REFUND POLICY:
   - Orders can ONLY be cancelled BEFORE the fish is harvested from tanks.
   - Once fish is HARVESTED (status: "Harvested Live & Packed"), the order is locked and CANNOT be cancelled, returned, or refunded under any circumstances, because live swimming trout is slaughtered specifically upon confirmed payment and cannot be returned to tanks.
   - If a customer whose order has already been harvested asks for a cancellation or refund, explain this policy politely but firmly.
8. B2B, COMMERCIAL, CAFETERIA, HOTEL & BULK WHOLESALE INQUIRIES:
   - If a customer asks about B2B rates, cafeteria supply, restaurant/hotel bulk orders, or reselling discounts:
   - NEVER say "we don't do that" or bluntly refuse discounts!
   - Instead, reply: "For commercial B2B rates, cafeteria supply, and bulk wholesale inquiries, please reach out directly to our Commercial Desk at +91 7006604148 (Call / WhatsApp). Our team will assist you with custom business pricing and scheduled harvest logistics."
9. COOKED VS RAW FISH INQUIRIES ("Is it cooked/fried?", "Are you a restaurant?"):
   - If a customer asks if the trout is cooked, fried, or ready-to-eat:
   - Clarify soberly and professionally with clean line breaks:
     "We specialize exclusively in 100% farm-fresh, live-harvested raw Rainbow Trout for home cooking, barbecue, or grill.

• Cut: Expertly cleaned, gutted & pan-ready (₹580/kg)
• Harvest: Live from pure crystal-clear oxygenated cold water tanks upon order
• Note: We do not operate a restaurant or serve cooked meals.

Would you like Cleaned & Gutted delivered fresh to your home?"
10. PHONE NUMBER SHARING (CUSTOMER SHARING THEIR CONTACT NUMBER):
   - If a customer sends their 10-digit mobile number (e.g. while planning a store visit or asking questions):
   - NEVER assume they have an existing order or claim an order is confirmed or on file!
   - Thank them politely and acknowledge with clean spacing:
      "Thank you for sharing your contact number!

We look forward to welcoming you to our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Sat–Thu)."
   - If they are inquiring about delivery, ask for their preferred quantity (min 2 kg) and cut preference instead.
11. INTERNET & SOCIAL SLANG DECODER ("pp", "pp?", "hm", "rate", "daam"):
   - When customers (especially Gen Z, young buyers, or Instagram/Facebook leads) text short queries like "pp", "pp?", "PP", "price plz", "rate?", "hm", "how much":
   - Understand immediately: "pp" = "Price Please" (asking for price per kg). "hm" = "How much".
   - NEVER say "What is pp?" or give a confusing reply!
   - Reply immediately with our clean bulleted rates:
     "Here are our fresh live-harvested trout rates:

• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — descaled, zero kitchen prep)
🛵 *Doorstep delivery is 100% FREE* on eligible orders (2 kg for 0–4 km, 3 kg for 4–11.5 km, 4 kg for 11.5–16 km; subsidized courier on smaller orders)!

Which area in Srinagar would you like delivery to?"
12. DISCOUNT & BARGAINING INQUIRIES ("kam karo", "discount please", "500 me do", "any concession?"):
   - When a customer asks for a discount or price reduction:
   - NEVER say "we have a strict policy on rates" or sound rigid/blunt!
   - Be polite and warm: highlight that we offer 100% FREE doorstep delivery for their complete convenience (zero delivery fees, zero packing fees).
   - Tell them courteously that our fish tastes completely different from ordinary market fish because it is swimming live in crystal-clear oxygen-saturated cold water tanks until ordered (never kept dead on ice with preservatives). They will truly taste the difference!
13. IDENTITY & AI DISCLOSURE ("Who are you?", "Are you AI or human?", "Bot ho ya insaan?"):
   - Flex proudly that Urban Trout is Jammu & Kashmir’s very first startup to integrate an AI sales assistant on WhatsApp!
   - Explain that you are Urban Trout’s digital sales assistant, working 24/7 alongside our farm and harvesting team in Malabagh, Srinagar.
   - State that our human aquaculture team handles the live harvest, cleaning, and express delivery directly to the customer's kitchen.
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
    activeTurnPrompt = `[🛑 STRICT NIGHT PROTOCOL ACTIVE: Current time in Srinagar is ${istTimeStr}. Same-day deliveries CLOSED at 9:00 PM. Physical tanks and harvest are closed for the night. We start taking fresh live-harvest orders tomorrow morning from 7:00 AM sharp! ABSOLUTELY NEVER promise delivery tonight or within 1-2 hours! Offer/schedule delivery ONLY for TOMORROW (Morning 7-11 AM, Afternoon 12-3 PM, Evening 4-7 PM).]\n\n${activeTurnPrompt}`;
  } else if (isEarlyPreDawn) {
    activeTurnPrompt = `[🌅 EARLY MORNING PRE-DAWN ACTIVE: Current time in Srinagar is ${istTimeStr}. We start taking live orders and harvesting from 7:00 AM sharp today! Schedule their delivery for TODAY starting from the 7:00 AM – 11:00 AM morning slot.]\n\n${activeTurnPrompt}`;
  }
  if (existingOrder && !existingOrder.notFound) {
    activeTurnPrompt = `[⭐ EXISTING ORDER ON FILE: #${existingOrder.orderRef} (${existingOrder.items}, ${existingOrder.amount}, Status: ${existingOrder.status}, Slot: ${existingOrder.deliveryTime}). Customer is asking about their order/delivery. DO NOT GENERATE A PAYMENT LINK. Provide their order status and timing directly.]\n\n${activeTurnPrompt}`;
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
      const amount = Number(payMatch[1]);
      const desc = payMatch[2].trim();
      const isStockOk = await checkStockAvailable(amount > 1000 ? 2 : 1);
      if (!isStockOk) {
        rawReply = rawReply.replace(
          payMatch[0],
          "⚠️ *Our live harvest quota for today is fully committed! Next fresh harvest opens tomorrow morning at 7:00 AM.*"
        );
      } else {
        const savedLoc = chatMetadata[chatId] || (customerPhone ? chatMetadata[customerPhone] : null);
        let custDist = (vipProfile && vipProfile.distanceKm != null) ? vipProfile.distanceKm : (savedLoc?.distanceKm != null ? savedLoc.distanceKm : 2.0);
        let scheduledSlot = "Within 2 Hours (Today)";
        if (isFridayToday) {
          scheduledSlot = "Saturday (Advance Scheduled)";
        } else if (isNightAfter9PM || isEarlyPreDawn) {
          scheduledSlot = isThursdayToday 
            ? "Saturday Morning (7:00 AM – 11:00 AM)" 
            : "Tomorrow Morning (7:00 AM – 11:00 AM)";
        }
        try {
          const payObj = await createRazorpayPaymentLink({
            amount,
            customerPhone,
            customerName: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
            description: desc,
            latitude: (savedLoc && savedLoc.latitude) ? savedLoc.latitude : null,
            longitude: (savedLoc && savedLoc.longitude) ? savedLoc.longitude : null,
            distanceKm: custDist,
            googleMapsUrl: (savedLoc && savedLoc.googleMapsUrl) ? savedLoc.googleMapsUrl : null
          });
          if (payObj && payObj.url) {
            recordNewCustomerOrder(cleanPhone || chatId, {
              orderRef: payObj.orderRef,
              paymentLinkId: payObj.paymentLinkId,
              chatId: chatId,
              name: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
              items: desc,
              amount: `₹${amount}`,
              deliveryArea: vipProfile?.locality ? `${vipProfile.locality} (~${custDist} km)` : (savedLoc?.localityName ? `${savedLoc.localityName} (~${custDist} km)` : `Srinagar (~${custDist} km)`),
              deliveryTime: scheduledSlot,
              payUrl: payObj.url,
              createdAt: new Date().toISOString()
            });
            const payUrl = payObj.url;
            const urgencyNote = (isNightAfter9PM || isEarlyPreDawn)
              ? `\n\n⏰ *Delivery Slot:* ${scheduledSlot}\n(Live harvest commences at 7:00 AM sharp)`
              : "\n\n🛵 *Express Delivery:* Live harvested from our cold-water tanks & dispatched within 2 hours of payment!";
            const orderCard = formatOrderSummaryCard({
              orderRef: payObj.orderRef || payObj.ref,
              amount,
              desc,
              deliveryArea: vipProfile?.locality ? `${vipProfile.locality} (~${custDist} km)` : (savedLoc?.localityName ? `${savedLoc.localityName} (~${custDist} km)` : null),
              distanceKm: custDist,
              localityName: vipProfile?.locality || savedLoc?.localityName,
              scheduledSlot,
              payUrl
            });
            rawReply = rawReply.replace(payMatch[0], `\n\n${orderCard}`);
          }
        } catch (rzpErr) {
          console.error("Error creating Razorpay link for VIP reorder:", rzpErr.message);
        }
      }
    }
    history.push({ role: "user", text: userMessage });
    history.push({ role: "model", text: rawReply });
    if (history.length > 16) history.splice(0, history.length - 16);
    chatHistories.set(chatId, history);
    saveChatHistories();
    return rawReply;
  }

  const models = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.6-flash"
  ];
  const totalKeyCycles = Math.max(1, GEMINI_API_KEYS.length);

  for (let keyAttempt = 0; keyAttempt < totalKeyCycles; keyAttempt++) {
    const currentApiKey = getActiveGeminiKey();

    for (const model of models) {
      let rawReply = null;
      for (let retry = 0; retry < 3; retry++) {
        try {
          rawReply = await new Promise((resolve, reject) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${currentApiKey}`;
            const req = https.request(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
              },
              timeout: 18000
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
          if ((err.statusCode === 503 || err.statusCode === 429) && retry < 2) {
            const waitMs = retry === 0 ? 1000 : 3000;
            console.warn(`[Gemini Transient ${err.statusCode}] Model ${model} busy. Retrying in ${waitMs}ms...`);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          if (err.statusCode === 429 || err.statusCode === 403 || err.statusCode === 402) {
            console.warn(`[Key Failover] Model ${model} on Key #${activeKeyIndex + 1} returned ${err.statusCode}. Rotating to next API key...`);
            rotateGeminiKey();
            break;
          } else {
            console.warn(`Model ${model} attempt failed:`, err.message);
            break;
          }
        }
      }

      if (rawReply) {

        // Check for [PAY_LINK: amount : desc] tag in reply
        const payMatch = rawReply.match(/\[PAY_LINK:\s*(\d+)\s*:\s*([^\]]+)\]/i);
        if (payMatch) {
          const amount = Number(payMatch[1]);
          const desc = payMatch[2].trim();

          // Guard 1: Duplicate Order Guard
          // Only block if order was placed recently (< 12 hours) and customer is NOT explicitly reordering
          const isAlreadyConfirmed = existingOrder && !existingOrder.notFound && /(?:paid|confirmed|harvest|dispatch)/i.test(existingOrder.status || "");
          const existingOrderDate = existingOrder?.updatedAt || existingOrder?.paidAt;
          const isOrderRecent = existingOrderDate ? (Date.now() - new Date(existingOrderDate).getTime() < 12 * 60 * 60 * 1000) : false;
          const isExplicitNewOrder = /\b(?:another|new|second|one more|ek aur|separate|repeat|reorder|same|wahi|send|bhej|bhejo|order|pack|deliver)\s*(?:order|kg|fish|pack)?/i.test(userMessage) || Boolean(parsedQuantity) || isReorderAffirmative;

          if (isAlreadyConfirmed && isOrderRecent && !isExplicitNewOrder) {
            console.log(`[Order Safety] Blocked duplicate payment link for ${chatId} (${existingOrder.orderRef})`);
            rawReply = rawReply.replace(payMatch[0], "").trim();
            if (!rawReply.includes(existingOrder.orderRef)) {
              rawReply += `\n\nYour order (*#${existingOrder.orderRef}*) is already ${existingOrder.status}! Our team has it scheduled for delivery in your selected slot.`;
            }
          } else {
            // 1. Silent stock check
            const isStockOk = await checkStockAvailable(amount > 1000 ? 2 : 1);
            if (!isStockOk) {
              rawReply = rawReply.replace(
                payMatch[0],
                "⚠️ *Our live harvest quota for today is fully committed! Next fresh harvest opens tomorrow morning at 7:00 AM.*"
              );
            } else {
              // Retrieve saved customer location if previously shared (WhatsApp pin or Google Maps link)
              let savedLoc = chatMetadata[chatId] || (customerPhone ? chatMetadata[customerPhone] : null);

              // Scan chat messages in reverse chronological order (newest message takes priority over stale history!)
              const userRecentMsgs = history.filter(h => h.role === "user").map(h => h.text).reverse();
              let detectedLocMatch = detectSrinagarLocality(userMessage);
              if (!detectedLocMatch) {
                for (const uMsg of userRecentMsgs) {
                  detectedLocMatch = detectSrinagarLocality(uMsg);
                  if (detectedLocMatch) break;
                }
              }
              if (!detectedLocMatch) {
                const fullChatText = (history.filter(h => h.role === "user").map(h => h.text).join(" ") + " " + userMessage);
                detectedLocMatch = await resolveUnknownLocalityWithApi(fullChatText);
              }

              // ACTIVE CONVERSATION OVERRIDES STALE SAVED LOCATION!
              let custDist = null;
              let activeLocalityName = null;
              if (detectedLocMatch && detectedLocMatch.status === "IN_ZONE") {
                custDist = detectedLocMatch.dist;
                activeLocalityName = detectedLocMatch.name;
                // Update metadata with the new locality from this conversation
                if (!chatMetadata[chatId]) chatMetadata[chatId] = {};
                chatMetadata[chatId].distanceKm = custDist;
                chatMetadata[chatId].localityName = activeLocalityName;
                if (customerPhone) {
                  if (!chatMetadata[customerPhone]) chatMetadata[customerPhone] = {};
                  chatMetadata[customerPhone].distanceKm = custDist;
                  chatMetadata[customerPhone].localityName = activeLocalityName;
                }
                saveChatMetadata();
              } else if (savedLoc && savedLoc.distanceKm != null) {
                custDist = savedLoc.distanceKm;
                activeLocalityName = savedLoc.localityName;
              } else {
                custDist = 2.0; // fallback to core zone
              }

              // Parse order weight if indicated in description (e.g. "2 kg Cleaned & Gutted" -> 2)
              const weightMatch = desc.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i);
              const orderWeight = weightMatch ? parseFloat(weightMatch[1]) : (amount >= 1620 ? 3 : 2);

              const isSpecialDeliveryOrder = /\(\+(?:Special|Express) Delivery\)/i.test(desc) || [609, 629, 659, 699, 1199, 1229, 1249, 1789, 569, 589, 619, 1119, 1149, 1169, 1669, 830, 790, 880, 1410, 1460, 680].includes(amount);
              const recentContextForOutZone = (userMessage + " " + history.filter(h => h.role === "user").map(h => h.text).slice(-2).join(" ")).toLowerCase();
              const isFarOutZone = /(?:pampore|chadoora|lawaypora|hmt|harwan|budgam|ompora|baramulla|anantnag|jammu)/i.test(recentContextForOutZone);

              if ((custDist !== null && custDist > 16.0) || isFarOutZone) {
                console.log(`[Link Guard] Blocked payment link for ${chatId} - location ${custDist}km is OUTSIDE delivery perimeter (>16km).`);
                rawReply = rawReply.replace(
                  payMatch[0],
                  `📍 *Outside Delivery Zone:* Doorstep delivery is not available for your location (~${custDist ? custDist.toFixed(1) : "far"} km). You are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout on the spot! 🐟\nMaps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9`
                );
              } else if (!isSpecialDeliveryOrder && custDist !== null && custDist > 11.5 && custDist <= 16.0 && (orderWeight < 3.95 || amount < 2160)) {
                console.log(`[Link Guard] Blocked <4kg free-delivery payment link for ${chatId} - zone 4 requires 4kg MOQ for free delivery.`);
                rawReply = rawReply.replace(
                  payMatch[0],
                  `🛵 *Delivery Note (South & Outer Srinagar Zone):*\nYour address is ~${custDist ? custDist.toFixed(1) : "12–16"} km from our farm. Doorstep delivery is 100% FREE for our *4 kg* family pack (₹2,320 Cleaned & Gutted / ₹2,160 Whole).\n\nSmaller orders are also gladly delivered with nominal subsidized courier:\n• 3 kg: ₹1,789 total (₹49 courier fee)\n• 2 kg: ₹1,249 total (₹89 courier fee)\n• 1 kg: ₹699 total (₹119 courier fee)\n\nWhich option would you like? 🐟`
                );
              } else if (!isSpecialDeliveryOrder && custDist !== null && custDist > 4.0 && custDist <= 11.5 && (orderWeight < 2.95 || amount < 1620)) {
                console.log(`[Link Guard] Blocked <3kg free-delivery payment link for ${chatId} - zone 2/3 requires 3kg MOQ for free delivery.`);
                const isZone2 = custDist <= 7.0;
                const fee2kg = isZone2 ? 39 : 69;
                const tot2kg = 1160 + fee2kg;
                const fee1kg = isZone2 ? 49 : 79;
                const tot1kg = 580 + fee1kg;
                rawReply = rawReply.replace(
                  payMatch[0],
                  `🛵 *Delivery Note:*\nYour address is ~${custDist.toFixed(1)} km from our farm. For 100% FREE doorstep delivery, our minimum order is *3 kg* (₹1,740 Cleaned & Gutted / ₹1,620 Whole Fresh).\n\nSmaller orders are also gladly delivered express:\n• 2 kg: ₹${tot2kg} total (₹${fee2kg} courier fee)\n• 1 kg: ₹${tot1kg} total (₹${fee1kg} courier fee)\n\nWhich option would you prefer? 🐟`
                );
              } else if (
                (isThursdayToday && /\b(?:tomorrow|kal|friday|jumma|juma|afternoon|morning|evening)\b/i.test(userMessage) && !/\b(?:saturday|hafta|aaj|today|tonight)\b/i.test(userMessage)) ||
                (isFridayToday && !/\b(?:saturday|advance|hafta|tomorrow|kal)\b/i.test(userMessage))
              ) {
                console.log(`[Link Guard] Blocked payment link for Friday delivery attempt for ${chatId}.`);
                rawReply = rawReply.replace(
                  payMatch[0],
                  `⚠️ *Friday Closure Notice:*\nOur farm and deliveries are strictly closed on Fridays for weekly RAS filtration bio-security maintenance. We cannot harvest or deliver on Friday.\n\nWe would be delighted to schedule fresh delivery for *Saturday* (Morning 7–11 AM, Afternoon 12–3 PM, or Evening 4–7 PM)${isThursdayToday ? " or *today (Thursday)* within 2 hours" : ""}.\n\nPlease let us know if Saturday works, and we will immediately provide your payment link! 🐟`
                );
              } else {
                try {
                  // Determine delivery slot based on customer selection and time
                  let scheduledSlot = "Within 90–120 Minutes (Today)";
                  const combinedText = (rawReply + " " + userMessage + " " + history.filter(h => h.role === "user").map(h => h.text).join(" ")).toLowerCase();
                  
                  const targetDay = isFridayToday 
                    ? "Saturday" 
                    : (isThursdayToday && (isNightAfter9PM || isEarlyPreDawn) ? "Saturday" : (isNightAfter9PM || isEarlyPreDawn ? "Tomorrow" : "Today"));

                  if (/\b(?:evening|shaam|sham|night|4\s*pm|5\s*pm|6\s*pm|7\s*pm|4:00|5:00|6:00|7:00|16:00)\b/i.test(combinedText)) {
                    scheduledSlot = `${targetDay} Evening (4:00 PM – 7:00 PM)`;
                  } else if (/\b(?:afternoon|dopahar|noon|12\s*pm|1\s*pm|2\s*pm|3\s*pm|12:00|13:00|14:00|15:00)\b/i.test(combinedText)) {
                    scheduledSlot = `${targetDay} Afternoon (12:00 PM – 3:00 PM)`;
                  } else if (/\b(?:morning|subah|early|7\s*am|8\s*am|9\s*am|10\s*am|11\s*am|7:00|8:00|9:00|10:00|11:00)\b/i.test(combinedText)) {
                    scheduledSlot = `${targetDay} Morning (7:00 AM – 11:00 AM)`;
                  } else if (isNightAfter9PM || isEarlyPreDawn) {
                    scheduledSlot = `${targetDay} Morning (7:00 AM – 11:00 AM)`;
                  } else if (/\b(?:saturday|advance)\b/i.test(userMessage)) {
                    scheduledSlot = "Saturday (Advance Scheduled)";
                  }

                  // 2. Generate actual Razorpay single-use link
                  const payObj = await createRazorpayPaymentLink({
                    amount,
                    customerPhone,
                    customerName: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
                    description: desc,
                    latitude: savedLoc?.latitude,
                    longitude: savedLoc?.longitude,
                    distanceKm: savedLoc?.distanceKm != null ? savedLoc.distanceKm : custDist,
                    googleMapsUrl: savedLoc?.googleMapsUrl
                  });
                  const payUrl = payObj.url;
                  recordNewCustomerOrder(customerPhone, {
                    orderRef: payObj.ref,
                    paymentLinkId: payObj.id,
                    chatId: chatId,
                    name: (vipProfile && vipProfile.cleanName) ? vipProfile.cleanName : (customerName || "Customer"),
                    items: desc,
                    amount: `₹${amount} (Payment Link Sent)`,
                    status: "Payment Link Sent — Awaiting Confirmation",
                    deliveryArea: activeLocalityName 
                      ? `${activeLocalityName} (~${(custDist || 2.0).toFixed(1)} km)`
                      : (custDist != null 
                        ? `Srinagar (~${custDist.toFixed(1)} km from farm)` 
                        : "Srinagar"),
                    deliveryTime: scheduledSlot,
                    latitude: savedLoc?.latitude,
                    longitude: savedLoc?.longitude,
                    distanceKm: savedLoc?.distanceKm != null ? savedLoc.distanceKm : custDist,
                    googleMapsUrl: savedLoc?.googleMapsUrl,
                    payUrl
                  });
                  const urgencyNote = isOperatingHours 
                    ? `\n\n🕒 *Complete payment to lock your fresh live-harvest slot* — slots fill up fast!` 
                    : ``;
                  const destLocality = activeLocalityName || (detectedLocMatch && detectedLocMatch.status === "IN_ZONE" ? detectedLocMatch.name : (savedLoc?.localityName || null));
                  const orderCard = formatOrderSummaryCard({
                    orderRef: payObj.ref || payObj.orderRef,
                    amount,
                    desc,
                    deliveryArea: destLocality,
                    distanceKm: custDist,
                    localityName: destLocality,
                    scheduledSlot,
                    payUrl
                  });
                  rawReply = rawReply.replace(payMatch[0], `\n\n${orderCard}`);
                } catch (rzpErr) {
                  console.error("Error creating Razorpay link:", rzpErr.message);
                  rawReply = rawReply.replace(payMatch[0], `(Our team will dispatch your secure Razorpay link shortly)`);
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

        rawReply = rawReply.replace(/^(?:(?:Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Salaam)[\s!,\.\-–—]*)+/i, isFirstMessage ? "Hello! " : "");
        rawReply = rawReply.replace(/\b(?:Assalam(?:u|\-o)?[\s\-]?[aA]laikum|Salam|Salaam|Janab|Sb|Sahib|Sahab)\b/gi, "");

        // Strict post-processing: enforce night protocol (scrub accidental promises of immediate delivery tonight)
        if (isNightAfter9PM || isEarlyPreDawn) {
          if (isThursdayToday) {
            rawReply = rawReply.replace(/\b(?:(?:we\s*(?:can|will)?\s*)?deliver(?:y|ed)?\s*(?:tonight\s*)?)?within\s*(?:1\s*(?:to|-)\s*2|2|1)\s*hours?(?:\s*tonight)?\b/gi, "scheduled for delivery Saturday morning");
            rawReply = rawReply.replace(/\bwe\s*(?:can|will)?\s*deliver\s+tonight\b/gi, "we can schedule delivery for Saturday morning");
            rawReply = rawReply.replace(/\b(?:delivering|dispatching)\s+tonight\b/gi, "delivering Saturday morning");
            rawReply = rawReply.replace(/\b(?:scheduled\s+for\s+delivery\s+)?tomorrow(?:\s+morning|\s+afternoon|\s+evening)?\b/gi, "scheduled for delivery Saturday morning");
          } else {
            rawReply = rawReply.replace(/\b(?:(?:we\s*(?:can|will)?\s*)?deliver(?:y|ed)?\s*(?:tonight\s*)?)?within\s*(?:1\s*(?:to|-)\s*2|2|1)\s*hours?(?:\s*tonight)?\b/gi, "scheduled for delivery tomorrow");
            rawReply = rawReply.replace(/\bwe\s*(?:can|will)?\s*deliver\s+tonight\b/gi, "we can schedule delivery for tomorrow");
            rawReply = rawReply.replace(/\b(?:delivering|dispatching)\s+tonight\b/gi, "delivering tomorrow");
          }
        }

        // Strict day guards against accidental delivery claims on Friday or Thursday for Friday
        if (isThursdayToday) {
          rawReply = rawReply.replace(/\b(?:fully\s+open\s+for\s+doorstep\s+deliveries\s+tomorrow|open\s+for\s+deliveries\s+tomorrow|open\s+tomorrow)\b/gi, "closed tomorrow (Friday) for weekly maintenance, but open Saturday");
        }
        if (isFridayToday) {
          rawReply = rawReply.replace(/\b(?:fully\s+open\s+today|deliver\s+today|delivery\s+today|within\s+2\s+hours\s+today)\b/gi, "scheduled for delivery tomorrow (Saturday)");
        }
        // Guard against hallucinated Friday/Saturday mentions on normal operating days (Sunday through Wednesday):
        if (!isThursdayToday && !isFridayToday) {
          rawReply = rawReply.replace(/\btomorrow\s*\(\s*saturday\s*\)/gi, `tomorrow (${tomorrowDayName})`);
          rawReply = rawReply.replace(/\btomorrow,\s*saturday\b/gi, `tomorrow, ${tomorrowDayName}`);
          rawReply = rawReply.replace(/\bstarting\s+Saturday\s+morning\s+at\s+7(?::00)?\s*AM\b/gi, `tomorrow (${tomorrowDayName}) morning at 7:00 AM`);
          rawReply = rawReply.replace(/\bdelivered\s+to\s+your\s+home\s+on\s+Saturday\b/gi, `delivered to your home tomorrow (${tomorrowDayName})`);
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
        rawReply = rawReply.replace(/\bmin(?:imum)?\s*2\s*kg\s*for\s*Zone\s*1,\s*3\s*kg\s*for\s*Zone\s*2\s*(?:&|and)\s*3,\s*4\s*kg\s*for\s*Zone\s*4\b/gi, "min 2 kg for nearby areas, 3–4 kg for other Srinagar areas");
        rawReply = rawReply.replace(/\b(?:min(?:imum)?\s*order\s*)?2\s*kg\s*for\s*Zone\s*1[^,\n)]*,\s*3\s*kg\s*for\s*Zone\s*2[^,\n)]*,\s*4\s*kg\s*for\s*Zone\s*4\b/gi, "min 2 kg for nearby areas, 3–4 kg for other Srinagar areas");
        rawReply = rawReply.replace(/\bZone\s*1\s*\((?:0[-–]4\s*km|core\s*zone)\)/gi, "nearby areas");
        rawReply = rawReply.replace(/\bZone\s*2\s*\(4[-–]7\s*km\)/gi, "mid Srinagar areas");
        rawReply = rawReply.replace(/\bZone\s*3\s*\(7[-–]11\.5\s*km\)/gi, "greater Srinagar areas");
        rawReply = rawReply.replace(/\bZone\s*4\s*\(11\.5[-–]16\s*km\)/gi, "outer corridor areas");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*1\b/gi, "nearby areas");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*2\b/gi, "mid Srinagar");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*3\b/gi, "greater Srinagar");
        rawReply = rawReply.replace(/\b(?:in\s+)?Zone\s*4\b/gi, "outer Srinagar");
        rawReply = rawReply.replace(/\([ \t]*\)/g, "");
        rawReply = rawReply.replace(/[ \t]{2,}/g, " ");
        rawReply = rawReply.replace(/\s+([,.:;!?])/g, "$1");

        // Normalize excessive blank lines (keep max 1 blank line between paragraphs)
        rawReply = rawReply.replace(/\n{3,}/g, "\n\n");

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
  if (isFirstMessage) {
    const welcomeFallback = `Hello! Welcome to Urban Trout 🐟 — Srinagar's only live-harvest farm delivering fresh trout straight to your kitchen within 2 hours, harvested live the moment you order from our crystal-clear oxygen-saturated cold water tanks.

• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — descaled, zero kitchen mess, straight to pan)
🛵 *Express doorstep delivery* across Srinagar (100% FREE delivery available: min 2 kg for nearby areas, 3–4 kg for other Srinagar areas; subsidized express courier on smaller orders). Which area in Srinagar shall we deliver to?`;
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
  return `Thank you! Our farm team in Malabagh has received your message and will assist you with your order in just a moment. 🐟\n\n(Live Vending Center in Malabagh is open 8:00 AM – 9:00 PM Saturday to Thursday)`;
}

// Persistent chat metadata tracking for gentle 60-90 minute follow-ups
const chatMetaFilePath = path.join(__dirname, "chat_metadata.json");
let chatMetadata = {};
if (fs.existsSync(chatMetaFilePath)) {
  try {
    chatMetadata = JSON.parse(fs.readFileSync(chatMetaFilePath, "utf8"));
  } catch (_) {}
}

function saveChatMetadata() {
  try {
    fs.writeFileSync(chatMetaFilePath, JSON.stringify(chatMetadata, null, 2), "utf8");
  } catch (err) {
    console.error("Error saving chat metadata:", err.message);
  }
}

// Automatic 60-90 Minute Gentle Follow-Up for Inactive Leads (STRICTLY ONE MESSAGE EVER)
let isCheckingFollowUps = false;
async function checkInactiveLeadsFollowUp(sock) {
  if (isCheckingFollowUps) return;
  if (isAiPausedGlobally) return;
  isCheckingFollowUps = true;

  try {
    const now = Date.now();
    const ordersFilePath = path.join(__dirname, "customer_orders.json");
    let orders = {};
    if (fs.existsSync(ordersFilePath)) {
      try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
    }

    for (const [chatId, meta] of Object.entries(chatMetadata)) {
      if (isVvipManualOnly(chatId, resolveCustomerPhone(chatId)) || isPrimaryPersonalContact(chatId, resolveCustomerPhone(chatId))) continue;
      if (!meta || meta.followUpSent) continue;
      if (meta.lastMsgRole !== "model") continue; // Only nudge if bot spoke last and customer went silent
      if (!meta.lastBotMsgTime) continue;

      const elapsedMinutes = (now - meta.lastBotMsgTime) / (60 * 1000);

      // If already past the window (>1440m / 24h), permanently mark as handled so we never disturb them later
      if (elapsedMinutes > 1440) {
        meta.followUpSent = true;
        saveChatMetadata();
        continue;
      }

      // Target window: between 60 and 1440 minutes (24 hours) of inactivity
      if (elapsedMinutes >= 60 && elapsedMinutes <= 1440) {
        // Skip if human override is active
        const overrideExpiry = humanOverrides.get(chatId);
        if (overrideExpiry && Date.now() < overrideExpiry) continue;

        // Skip if customer already placed/paid an order
        const cleanPhone = resolveCustomerPhone(chatId);
        const order = orders[cleanPhone];
        if (order && (order.status.includes("Paid") || order.status.includes("Confirmed") || order.status.includes("Delivered"))) {
          meta.followUpSent = true;
          saveChatMetadata();
          continue;
        }

        // Skip if customer conversation was an explicit outside-zone refusal
        const history = chatHistories.get(chatId) || [];
        const historyText = history.map(h => h.text).join(" ");
        if (/outside\s+(?:our\s+)?(?:5|6|8)\s*km/i.test(historyText)) {
          meta.followUpSent = true;
          saveChatMetadata();
          continue;
        }

        // Real-time IST Clock for Follow-ups
        const istDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const istHour = istDate.getHours();
        const istMin = istDate.getMinutes();

        // Sleep protection: DO NOT send automated follow-up pings late at night (between 11:00 PM and 7:30 AM)!
        // Do NOT mark as sent — simply skip this tick so the customer gets a morning follow-up once awake!
        if (istHour >= 23 || istHour < 7 || (istHour === 7 && istMin < 30)) {
          continue;
        }

        // STRICT SAFETY CONSTRAINT: Mark followUpSent = true BEFORE sending so it can NEVER double-send!
        meta.followUpSent = true;
        meta.followUpSentAt = new Date().toISOString();
        saveChatMetadata();

        // Active daytime delivery window: 7:00 AM to 9:00 PM
        const isDaytime = istHour >= 7 && istHour < 21;

        const followUpText = isDaytime
          ? "Hello! Just checking in to see if you would like us to reserve a fresh live-harvest slot for you today, or if you would like to visit our Live Vending Center in Malabagh. 🐟\n\n(No rush at all—we are always here whenever you crave fresh trout!)"
          : "Hello! Just checking in to see if you would like us to reserve a fresh live-harvest delivery slot for you tomorrow (Morning: 8–11 AM, Afternoon: 12–3 PM, or Evening: 4–7 PM), or visit our Live Vending Center in Malabagh tomorrow. 🐟\n\n(No rush at all—we are always here whenever you crave fresh trout!)";

        try {
          await sock.sendPresenceUpdate("composing", chatId);
          await new Promise(r => setTimeout(r, 1200));
          await sock.sendMessage(chatId, { text: followUpText });
          await sock.sendPresenceUpdate("available", chatId);

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
        // Window expired! Mark followUpSent = true so we NEVER disturb them days later
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

// Nightly 9:00 PM Telegram Executive Briefing Scheduler (closing time)
async function checkNightlyReportSchedule() {
  try {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(Date.now() + istOffset);
    const hour = istDate.getUTCHours();
    const minute = istDate.getUTCMinutes();
    const todayStr = istDate.toISOString().split("T")[0];

    // Trigger daily briefing between 21:00 (9:00 PM) and 21:15 IST
    if (hour === 21 && minute >= 0 && minute <= 15) {
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
        console.log(`\n📊 [9:00 PM NIGHTLY BRIEFING TRIGGERED] Compiling and dispatching executive briefing for ${todayStr}...`);
        await sendNightlyBriefing(todayStr);
      }
    }
  } catch (err) {
    console.error("Error in nightly report schedule check:", err.message);
  }
}

async function startBot() {
  const authDir = path.join(__dirname, "auth_info_baileys");
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
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
    const sent = await originalSendMessage(targetJid, content, ...rest);
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
      console.log("🤖 10 Strict Directives Active | 16km Perimeter Enforced (Tiered MOQ: 2kg/3kg/4kg) | Razorpay Link Ready.");
      console.log("⚡ Telegram 1-Click Status Bridge Active (Transmits Harvested, Out-for-Delivery & Delivered updates)");
      console.log("📊 Telegram 9:00 PM Nightly Executive Briefing Active (Auto-reports revenue, orders, inquiries & store walk-ins)");
      console.log("📱 Phone Kill Switch Active: Send #pause / #resume from phone to control AI");

      // Auto-sync Google Contacts on launch
      try {
        exportContacts();
      } catch (e) {
        console.warn("Contact sync notice on launch:", e.message);
      }

      // Clear existing intervals/timeouts if reconnecting to prevent duplication
      if (pollInterval) { clearTimeout(pollInterval); clearInterval(pollInterval); }
      if (paymentInterval) clearInterval(paymentInterval);
      if (followUpInterval) clearInterval(followUpInterval);
      if (nightlyReportInterval) clearInterval(nightlyReportInterval);

      // Poll order update queue: 25s during farm operating hours (8 AM - 9 PM IST), 90s at night
      // Throttling prevents hammering Supabase egress quota (keeps total monthly egress comfortably under 1 GB out of 5 GB free limit)
      const scheduleNextQueuePoll = () => {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istHour = new Date(Date.now() + istOffset).getUTCHours();
        const delayMs = (istHour >= 8 && istHour < 21) ? 25000 : 90000;
        pollInterval = setTimeout(async () => {
          try {
            await pollWhatsAppDispatchQueue(sock);
          } catch (_) {}
          scheduleNextQueuePoll();
        }, delayMs);
      };
      scheduleNextQueuePoll();

      // Check active pending Razorpay payment links every 3.5 seconds for instant confirmation
      paymentInterval = setInterval(() => {
        checkPendingRazorpayPayments(sock);
      }, 3500);

      // Check inactive leads (60-90 minutes old) for exactly ONE gentle follow-up every 2.5 minutes
      followUpInterval = setInterval(() => {
        checkInactiveLeadsFollowUp(sock);
      }, 150000);

      // Check 9:00 PM nightly report schedule every 60 seconds
      nightlyReportInterval = setInterval(() => {
        checkNightlyReportSchedule();
      }, 60000);
      checkNightlyReportSchedule();
    }
  });

  // Independent per-message processor (Executed concurrently across different customers)
  async function processSingleMessage(sock, msg, remoteJid, explicitText = null) {
    // Safety check: Ignore messages sent by the bot itself
    if (botSentMessageIds.has(msg.key?.id)) return;

    const myNumber = sock.user?.id ? sock.user.id.split(":")[0].replace(/\D/g, "") : "";
    const isSelfChat = myNumber && remoteJid.includes(myNumber);

    const innerMessage = getInnerMessage(msg);
    if (!innerMessage) return;

    const text = (
      explicitText !== null
        ? explicitText
        : (
            innerMessage.conversation ||
            innerMessage.extendedTextMessage?.text ||
            innerMessage.imageMessage?.caption ||
            ""
          )
    ).trim();

    const cleanPhone = resolveCustomerPhone(remoteJid);
    const isOwner = msg.key.fromMe || cleanPhone.endsWith("7006604148") || String(remoteJid).includes("174637916885151");

    // 1. Check for Owner Messages & Commands from Phone (Vendor phone OR Suhail's phone 7006604148)
    if (isOwner && text.startsWith("#")) {
      const lower = text.toLowerCase();
      if (lower === "#pause" || lower === "#stop" || lower === "#ai off" || lower === "#off") {
        if (!isSelfChat) {
          humanOverrides.set(remoteJid, Date.now() + 60 * 60 * 1000);
          console.log(`\n⏸️ [AI PAUSED FOR CHAT] AI paused for 60m for ${formatPhoneDisplay(cleanPhone)}.`);
          await sock.sendMessage(remoteJid, {
            text: "⏸️ *AI AGENT PAUSED FOR THIS CHAT (60 MINS)*\n\nSend *#bot* or *#resume* anytime to reactivate auto-replies for this customer."
          });
          return;
        }
        isAiPausedGlobally = true;
        aiPauseExpiry = 0;
        console.log(`\n🛑 [KILL SWITCH ACTIVATED] AI Sales Agent PAUSED globally by owner.`);
        await sock.sendMessage(remoteJid, {
          text: "🛑 *URBAN TROUT AI AGENT PAUSED GLOBALLY*\n\nThe AI will NOT auto-reply to any incoming messages.\nSend *#resume* or *#ai on* anytime to reactivate auto-replies."
        });
        return;
      }
      if (lower === "#resume" || lower === "#start" || lower === "#ai on" || lower === "#on" || lower === "#bot" || lower === "#unpause") {
        if (!isSelfChat) {
          humanOverrides.delete(remoteJid);
          console.log(`\n🤖 [AI RESUMED FOR CHAT] Auto-replies resumed for ${formatPhoneDisplay(cleanPhone)}.`);
          await sock.sendMessage(remoteJid, {
            text: "🤖 *URBAN TROUT AI AGENT RESUMED FOR THIS CHAT*\n\nThe AI will now auto-reply to customer messages here."
          });
          return;
        }
        isAiPausedGlobally = false;
        aiPauseExpiry = 0;
        console.log(`\n✅ [AI RESUMED] AI Sales Agent RESUMED globally by owner.`);
        await sock.sendMessage(remoteJid, {
          text: "✅ *URBAN TROUT AI AGENT RESUMED GLOBALLY*\n\nAuto-replies are now active for all incoming messages."
        });
        return;
      }
      if (lower.startsWith("#pause")) {
        const mins = parseInt(lower.replace(/\D/g, ""), 10) || 30;
        if (!isSelfChat) {
          humanOverrides.set(remoteJid, Date.now() + mins * 60 * 1000);
          console.log(`\n⏸️ [AI PAUSED FOR CHAT] Paused for ${mins}m for ${formatPhoneDisplay(cleanPhone)}.`);
          await sock.sendMessage(remoteJid, {
            text: `⏸️ *AI AGENT PAUSED FOR THIS CHAT (${mins} MINS)*\n\nSend *#bot* or *#resume* anytime to reactivate auto-replies for this customer.`
          });
          return;
        }
        isAiPausedGlobally = true;
        aiPauseExpiry = Date.now() + mins * 60 * 1000;
        console.log(`\n⏸️ [AI PAUSED] Paused for ${mins} minutes by owner.`);
        await sock.sendMessage(remoteJid, {
          text: `⏸️ *URBAN TROUT AI AGENT PAUSED FOR ${mins} MINUTES*\n\nWill automatically resume at ${new Date(aiPauseExpiry).toLocaleTimeString()}.\nSend *#resume* to reactivate sooner.`
        });
        return;
      }
      if (lower === "#status") {
        const statusStr = isAiPausedGlobally ? "⏸️ PAUSED GLOBALLY" : "🟢 ACTIVE & RUNNING";
        let contactCount = 0;
        try {
          const cdb = JSON.parse(fs.readFileSync(path.join(__dirname, "contacts_database.json"), "utf8"));
          contactCount = Object.keys(cdb).length;
        } catch (_) {}
        const chatOverride = humanOverrides.get(remoteJid);
        const chatStatus = (chatOverride && Date.now() < chatOverride)
          ? `⏸️ Paused (${Math.ceil((chatOverride - Date.now()) / 60000)}m remaining)`
          : "🟢 Active";
        await sock.sendMessage(remoteJid, {
          text: `📊 *URBAN TROUT AGENT STATUS*\n\n• Global AI Status: ${statusStr}\n• This Chat AI Status: ${chatStatus}\n• Delivery Perimeter: Up to 16.0 km (Tiered MOQ: 2kg/3kg/4kg)\n• Active Conversations: ${chatHistories.size}\n• Google Contacts DB: ${contactCount} Leads Synced\n• Human Pause Window: 30 minutes per manual intervention\n• Nightly Executive Briefing: Scheduled at 9:00 PM to Telegram`
        });
        return;
      }
      if (lower === "#report" || lower === "#briefing" || lower === "#daily" || lower === "#summary") {
        try {
          await sock.sendMessage(remoteJid, { text: "📊 *Compiling Urban Trout Daily Executive Briefing...*" });
          const briefing = await sendNightlyBriefing();
          await sock.sendMessage(remoteJid, {
            text: briefing.whatsAppText
          });
          console.log(`\n📊 [REPORT ON-DEMAND] Daily Executive Briefing generated & sent to Telegram and WhatsApp.`);
        } catch (repErr) {
          console.error("Failed to generate on-demand briefing:", repErr);
          await sock.sendMessage(remoteJid, {
            text: `⚠️ *Error compiling briefing:* ${repErr.message}`
          });
        }
        return;
      }
      if (lower === "#help" || lower === "#commands") {
        await sock.sendMessage(remoteJid, {
          text: `🛠️ *URBAN TROUT OWNER QUICK COMMANDS*\n\n` +
            `⚡ *Instant Payment Link Shortcuts:*\n` +
            `• *#3kg +200* (3kg Gutted + ₹200 delivery = ₹1,940)\n` +
            `• *#link 3kg +200* (3kg Gutted + ₹200 delivery)\n` +
            `• *#link 3kg gutted +200* (Cleaned & Gutted @ ₹580 + ₹200)\n` +
            `• *#link 3kg whole +200* (Whole Fresh @ ₹540 + ₹200)\n` +
            `• *#link 2kg* (Standard 2kg Gutted @ ₹1,160 - Free Delivery)\n` +
            `• *#link 1940* (Direct flat amount of ₹1,940)\n` +
            `• *#3kg +200 9876543210* (With customer phone number)\n` +
            `• *#3kg +200 9876543210 Farooq Sb Lalbazar* (With phone & name/address)\n\n` +
            `💡 *Pro-Tip:* Type *#3kg +200* directly inside a customer's WhatsApp chat to post the official order summary & payment link instantly!\n\n` +
            `⏸️ *AI Agent Controls:*\n` +
            `• *#pause* (Pause AI globally, or for 60m in customer chat)\n` +
            `• *#pause 30* (Pause for custom minutes)\n` +
            `• *#resume* or *#bot* (Reactivate AI immediately for this chat or globally)\n` +
            `• *#status* (View agent system status)\n` +
            `• *#report* (Generate & send 9:00 PM Daily Executive Briefing now)`
        });
        return;
      }

      // 3. Owner Quick Payment Link & WhatsApp Summary Card Generator
      const isQuickLink = lower.startsWith("#link") || lower.startsWith("#order") || lower.startsWith("#pay") || /^#\d+/i.test(lower);
      if (isQuickLink) {
        try {
          // Parse explicit delivery fee (e.g. +200, + 200, +₹200, delivery 200, del 200, d200, 200 delivery)
          let deliveryFee = 0;
          const plusFeeMatch = text.match(/\+\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
          const delFeeMatch = text.match(/(?:delivery|del|d|shipping|charge|charges|fee)\s*(?:fee|charges?)?\s*(?:is|=|:|\+)?\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
          const numDelFeeMatch = text.match(/(\d+)\s*(?:rs\.?|inr|₹)?\s*(?:delivery|del|shipping)/i);

          if (plusFeeMatch) {
            deliveryFee = parseInt(plusFeeMatch[1], 10) || 0;
          } else if (delFeeMatch) {
            deliveryFee = parseInt(delFeeMatch[1], 10) || 0;
          } else if (numDelFeeMatch) {
            deliveryFee = parseInt(numDelFeeMatch[1], 10) || 0;
          }

          // Parse optional direct total amount if owner typed e.g. #link 1940 or #pay 1940 or #1940
          let directTotalAmount = null;
          const directAmtMatch = text.match(/(?:#link|#pay|#order|#amount|#total|#)\s*(?:rs\.?|inr|₹)?\s*(\d{3,6})\b/i);
          if (directAmtMatch && !text.match(new RegExp(`${directAmtMatch[1]}\\s*(?:kg|kilos?|kgs)`, 'i'))) {
            const possibleAmt = parseInt(directAmtMatch[1], 10);
            if (possibleAmt >= 400 && !/\b[6-9]\d{9}\b/.test(directAmtMatch[1])) {
              directTotalAmount = possibleAmt;
            }
          }

          // Parse weight: matches e.g. 3kg, 3.5kg, 3 kilos, 3 kgs, or explicit weight
          let weightKg = null;
          const weightMatchWithUnit = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\b/i);
          if (weightMatchWithUnit) {
            weightKg = Math.round(parseFloat(weightMatchWithUnit[1]) * 100) / 100;
          } else if (!directTotalAmount) {
            const smallNumMatch = text.match(/#?(?:link|order|pay)?\s*(\d+(?:\.\d+)?)\b/i);
            if (smallNumMatch) {
              const val = parseFloat(smallNumMatch[1]);
              if (val > 0 && val <= 50) {
                weightKg = Math.round(val * 100) / 100;
              }
            }
          }

          if (!weightKg && !directTotalAmount) {
            weightKg = 2.0; // default 2kg if nothing specified
          }

          // Fallback delivery fee: if user typed e.g. "#3kg 200" without + sign
          if (deliveryFee === 0 && weightKg && !directTotalAmount) {
            const stripped = text
              .replace(new RegExp(`\\b${weightKg}\\s*(?:kg|kilos?|kgs)?\\b`, "gi"), "")
              .replace(/\b[6-9]\d{9}\b/g, "")
              .replace(/#(?:link|order|pay)?/gi, "");
            const standaloneFee = stripped.match(/\b([5-9]0|[1-5]\d{2})\b/);
            if (standaloneFee) {
              deliveryFee = parseInt(standaloneFee[1], 10) || 0;
            }
          }

          // Parse cut type (Whole vs Gutted)
          const isWhole = /\b(?:whole|sabut)\b/i.test(text);
          const rate = isWhole ? 540 : 580;
          const prodType = isWhole ? "Whole Fresh Trout" : "Cleaned & Gutted (Pan-ready)";

          let totalAmount;
          let itemDesc;

          if (directTotalAmount) {
            totalAmount = directTotalAmount;
            if (weightKg) {
              itemDesc = `${weightKg}kg ${prodType}${deliveryFee > 0 ? ` (+₹${deliveryFee} Delivery)` : ""}`;
            } else {
              itemDesc = `${prodType} Order`;
            }
          } else {
            const fishTotal = Math.round(weightKg * rate);
            totalAmount = fishTotal + deliveryFee;
            itemDesc = `${weightKg}kg ${prodType}${deliveryFee > 0 ? ` (+₹${deliveryFee} Delivery)` : ""}`;
          }

          // Parse optional 10-digit customer phone
          let targetCustPhone = null;
          const phoneMatch = text.match(/\b([6-9]\d{9})\b/);
          if (phoneMatch) {
            targetCustPhone = phoneMatch[1];
          } else if (!isSelfChat && cleanPhone && cleanPhone.length >= 10) {
            targetCustPhone = cleanPhone.slice(-10);
          }

          // Parse customer name / notes
          let notesText = text
            .replace(/#(?:link|order|pay)?/gi, "")
            .replace(new RegExp(`\\b${weightKg || ""}\\s*(?:kg|kilos?|kgs)?\\b`, "gi"), "")
            .replace(/\b(?:cleaned|gutted|whole|sabut|kg|kilos?|kgs)\b/gi, "")
            .replace(/\b[6-9]\d{9}\b/g, "")
            .replace(/\+\s*(?:rs\.?|inr|₹)?\s*\d+/gi, "")
            .replace(/(?:delivery|del|d|shipping|charge|charges|fee)\s*(?:fee|charges?)?\s*(?:is|=|:|\+)?\s*(?:rs\.?|inr|₹)?\s*\d+/gi, "")
            .replace(/\b\d+\s*(?:rs\.?|inr|₹)?\s*(?:delivery|del|shipping)\b/gi, "")
            .replace(/\b([5-9]0|[1-5]\d{2})\b/g, "")
            .replace(/\s+/g, " ")
            .trim();

          const targetCustName = notesText || (targetCustPhone ? `Customer (+91 ${targetCustPhone})` : "Valued Customer");

          console.log(`\n⚡ [Owner Quick-Link] Generating link for ${targetCustName}: ${itemDesc} @ ₹${totalAmount} (Delivery: ₹${deliveryFee})`);

          // Generate locked single-use Razorpay Link
          const payObj = await createRazorpayPaymentLink({
            amount: totalAmount,
            customerPhone: targetCustPhone,
            customerName: targetCustName,
            description: `Urban Trout - ${itemDesc}`
          });

          // Customer JID if phone number is provided or if in customer chat
          const customerJid = targetCustPhone ? `91${targetCustPhone}@s.whatsapp.net` : (!isSelfChat ? remoteJid : null);

          // Record in persistent customer orders store
          recordNewCustomerOrder(targetCustPhone || `QUICK-${payObj.ref}`, {
            orderRef: payObj.ref,
            paymentLinkId: payObj.id,
            chatId: customerJid || remoteJid,
            ownerJid: remoteJid,
            phone: targetCustPhone || "",
            name: targetCustName,
            items: itemDesc,
            amount: `₹${totalAmount}`,
            status: "Payment Link Sent — Awaiting Confirmation",
            deliveryArea: deliveryFee > 0 ? "Extended Doorstep Delivery" : "Doorstep Delivery",
            deliveryTime: "Immediate / Scheduled",
            payUrl: payObj.url,
            createdBy: "OWNER_WHATSAPP_COMMAND"
          });

          // Clean WhatsApp summary card with delivery breakdown
          const fishAmount = weightKg ? Math.round(weightKg * rate) : (totalAmount - deliveryFee);
          const deliveryLine = deliveryFee > 0
            ? `• *Delivery Fee:* 🛵 ₹${deliveryFee} (Special Express Delivery)`
            : `• *Delivery:* 🛵 *100% FREE Doorstep Delivery*`;

          const orderCard = formatOrderSummaryCard({
            orderRef: payObj.ref,
            amount: totalAmount,
            desc: `${weightKg ? `${weightKg} kg ` : ""}${prodType}${deliveryFee > 0 ? ` (+₹${deliveryFee} Delivery)` : ""}`,
            distanceKm: null,
            localityName: targetCustName ? `${targetCustName} (${formatPhoneDisplay(targetCustPhone)})` : null,
            scheduledSlot: "Within 90–120 Minutes of Payment",
            payUrl: payObj.url
          });

          // If owner typed directly inside customer chat, send card straight to customer!
          if (!isSelfChat) {
            humanOverrides.set(remoteJid, Date.now() + 30 * 60 * 1000);
            await sock.sendMessage(remoteJid, { text: orderCard });
            console.log(`✅ [Direct Link in Customer Chat] Order #${payObj.ref} sent directly to ${remoteJid}`);
            return;
          }

          // If in self-chat and customer phone was provided, dispatch to customer!
          let sentDirectToCustomer = false;
          if (customerJid) {
            try {
              await sock.sendMessage(customerJid, { text: orderCard });
              sentDirectToCustomer = true;
              console.log(`✅ [Direct WhatsApp Link Sent] Delivered directly to customer ${customerJid}!`);
            } catch (custSendErr) {
              console.error(`❌ [Customer Send Error]: Could not send to ${customerJid}:`, custSendErr.message);
            }
          }

          // Message to Owner in self chat
          if (sentDirectToCustomer) {
            await sock.sendMessage(remoteJid, {
              text: `✅ *Order #${payObj.ref} Generated & Dispatched!* 🚀\n\n` +
                `• *Customer:* ${targetCustName} (+91 ${targetCustPhone})\n` +
                `• *Item:* ${weightKg ? `${weightKg} kg ${prodType}` : itemDesc}\n` +
                `• *Total Payable:* *₹${totalAmount}*\n` +
                `• *Payment Link:* ${payObj.url}\n\n` +
                `📩 *Order summary and payment link delivered directly to customer (+91 ${targetCustPhone}) on WhatsApp!* They will receive an automated payment receipt the moment they complete payment.`
            });
          } else {
            await sock.sendMessage(remoteJid, {
              text: `✅ *Order #${payObj.ref} Generated Successfully!*\n\n` +
                `• *Item:* ${weightKg ? `${weightKg} kg ${prodType}` : itemDesc}\n` +
                `• *Total Payable:* *₹${totalAmount}*\n` +
                `• *Payment Link:* ${payObj.url}\n\n` +
                `👇 *Forward the message below directly to your customer:*`
            });
            await sock.sendMessage(remoteJid, { text: orderCard });
          }
          console.log(`✅ [Owner Quick-Link Sent] Order #${payObj.ref} processed`);
          return;
        } catch (linkErr) {
          console.error(`❌ [Owner Quick-Link Error]:`, linkErr);
          await sock.sendMessage(remoteJid, {
            text: `❌ *Error Generating Payment Link:*\n${linkErr.message}\n\nPlease try again (e.g. *#link 3kg +200* or *#3kg +200*).`
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
    const raw10 = cleanPhone ? cleanPhone.slice(-10) : "";
    const cleanPushName = extractCleanWhatsAppName(msg.pushName);
    if (msg.pushName) {
      saveWhatsAppContact(remoteJid, msg.pushName);
    }

    const displayPhone = formatPhoneDisplay(cleanPhone);
    const customerName = cleanPushName || resolveCustomerDisplayName(msg.pushName, null) || "Customer";

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

        await sock.sendMessage(remoteJid, { text: disarmReply });
        return;
      }
    }

    if (isGpsCheck && detectedLat !== null && detectedLng !== null) {
      const dist = calculateDistance(FARM_LAT, FARM_LNG, detectedLat, detectedLng);
      const distRounded = dist.toFixed(1);
      const istDate = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
      const istTime = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

      console.log(`\n┌──────────────────────────────────────────────────────────────────────────`);
      console.log(`│ 📍 [LOCATION PIN RECEIVED] 📅 ${istDate} • ⏰ ${istTime}`);
      console.log(`│ 👤 Name: ${customerName}${msg.pushName ? ` (WA: "${msg.pushName}")` : ""} | 📞 Phone: ${displayPhone}`);
      console.log(`│ 🌐 Coords: ${detectedLat}, ${detectedLng} | 📏 Distance to Farm: ${distRounded} km`);

      // Auto-learn colony or landmark from WhatsApp location pin name/address or recent chat
      autoLearnColonyFromLocation({
        lat: detectedLat,
        lng: detectedLng,
        distKm: Number(distRounded),
        locName: locMsg?.name || locMsg?.address,
        locAddress: locMsg?.address,
        recentUserText: text
      });

      let locReply = "";
      let historyNote = "";
      let chatHist = chatHistories.get(remoteJid) || [];

      const distNum = Number(distRounded);
      const istGps = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const isNightGps = istGps.getHours() >= 21 || istGps.getHours() < 7;

      if (distNum <= 16.0) {
        // Within 16 km delivery perimeter
        const mapsUrl = `https://maps.google.com/?q=${detectedLat},${detectedLng}`;
        if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
        chatMetadata[remoteJid].latitude = detectedLat;
        chatMetadata[remoteJid].longitude = detectedLng;
        chatMetadata[remoteJid].distanceKm = distNum;
        chatMetadata[remoteJid].googleMapsUrl = mapsUrl;
        chatMetadata[remoteJid].locationUpdatedAt = new Date().toISOString();
        if (cleanPhone) {
          if (!chatMetadata[cleanPhone]) chatMetadata[cleanPhone] = {};
          chatMetadata[cleanPhone].latitude = detectedLat;
          chatMetadata[cleanPhone].longitude = detectedLng;
          chatMetadata[cleanPhone].distanceKm = distNum;
          chatMetadata[cleanPhone].googleMapsUrl = mapsUrl;
          chatMetadata[cleanPhone].locationUpdatedAt = new Date().toISOString();
        }
        saveChatMetadata();

        const hasExistingPaymentLink = chatHist.some(m => m.text && (m.text.includes("rzp.io") || m.text.includes("Official Razorpay Payment Link")));
        const hasAgreedOrder = chatHist.some(m => m.text && (/\b(?:2\s*kg|3\s*kg|4\s*kg|5\s*kg|1\s*kg|gutted|whole|starter\s*pack|family\s*pack)\b/i.test(m.text)));

        const istGps = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const isNightGps = istGps.getHours() >= 21 || istGps.getHours() < 7;
        const isEveningGps = istGps.getHours() >= 16 && istGps.getHours() < 21;
        const surgeGps = isEveningGps ? 40 : 0;

        if (hasExistingPaymentLink) {
          locReply = isNightGps
            ? `📍 *Location Received & Saved!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n🛵 We have saved your exact location coordinates for our delivery rider.\n\nDeliveries for tonight closed at 9:00 PM. Please complete payment using the official Razorpay link above so our team can schedule your morning harvest in our 7:00 AM – 11:00 AM slot tomorrow! 🐟`
            : `📍 *Location Received & Saved!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n🛵 We have saved your exact location coordinates for our delivery rider.\n\nPlease complete payment using the official Razorpay link above so our team can harvest your trout live from the tanks and dispatch immediately! 🐟`;
          historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Malabagh farm. IN RANGE (<=16 km). Payment link already provided, awaiting payment completion.]`;
        } else if (hasAgreedOrder) {
          // PRICE LOCK: Customer already requested/discussed an order. Lock in coordinates and generate payment link without re-pitching or price jumping!
          locReply = `📍 *Location Received & Saved!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n🛵 *Coordinates locked for our delivery rider!*\n\nLet me generate your official payment link for your order right away. 🐟`;
          historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Malabagh farm. IN RANGE (<=16 km). Order already discussed/requested. Price locked in - generate payment link immediately for agreed amount without changing price.]`;
        } else {
          // First time inquiry via location pin (no order discussed yet) - show tier pricing for their distance
          if (distNum <= 4.0) {
            locReply = isNightGps
              ? `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep delivery is 100% FREE* (min order 2 kg, zero delivery or packing fees)!\nDeliveries for tonight closed at 9:00 PM. We can schedule your express live-harvest delivery for tomorrow (Morning 7–11 AM, Afternoon 12–3 PM, or Evening 4–7 PM).\n\nWhich cut, quantity, and slot tomorrow would you prefer? 🐟`
              : `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep delivery is 100% FREE* within 2 Hours of payment confirmation (min order 2 kg, zero extra delivery or packing fees)!\n\nWhich cut and quantity would you like to order? 🐟`;
            historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Malabagh farm. Minimum order for free delivery is 2 kg.]`;
          } else if (distNum <= 7.0) {
            locReply = isNightGps
              ? `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹39 express courier fee (₹1,199 total).\nDeliveries for tonight closed at 9:00 PM. We can schedule your express live-harvest delivery for tomorrow morning!\n\nWould you like 3 kg free delivery or 2 kg scheduled for tomorrow? 🐟`
              : `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a ₹39 express courier fee (₹1,199 total).\n\nWould you like 3 kg free delivery or 2 kg delivered fresh to your door? 🐟`;
            historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Malabagh farm. Free delivery on 3 kg+ (₹1740); 2 kg has ₹39 courier fee (₹1199); 1 kg has ₹49 fee (₹629).]`;
          } else if (distNum <= 11.5) {
            locReply = isNightGps
              ? `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a subsidized ₹${69 + surgeGps} courier fee (₹${1229 + surgeGps} total).\nDeliveries for tonight closed at 9:00 PM. We can schedule your express live-harvest delivery for tomorrow morning!\n\nWould you like 3 kg free delivery or 2 kg scheduled for tomorrow? 🐟`
              : `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep Delivery:* 100% FREE on 3 kg (₹1,740 total)! We can also send 2 kg for just a subsidized ₹${69 + surgeGps} courier fee (₹${1229 + surgeGps} total)${isEveningGps ? " (includes ₹40 evening rush surcharge)" : ""}.\n\nWould you like 3 kg free delivery or 2 kg delivered fresh to your door? 🐟`;
            historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Malabagh farm. Free delivery on 3 kg+ (₹1740); 2 kg has ₹${69 + surgeGps} courier fee (₹${1229 + surgeGps}); 1 kg has ₹${79 + surgeGps} fee (₹${659 + surgeGps}).]`;
          } else {
            locReply = isNightGps
              ? `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep Delivery:* 100% FREE on our 4 kg family pack (₹2,320 total)! We can also send 2 kg for just ₹${89 + surgeGps} express courier fee (₹${1249 + surgeGps} total) or 3 kg for ₹${49 + surgeGps} courier fee (₹${1789 + surgeGps} total).\nDeliveries for tonight closed at 9:00 PM. We can schedule your express live-harvest delivery for tomorrow morning!\n\nWould you like 4 kg free delivery or 2 kg scheduled for tomorrow? 🐟`
              : `📍 *Location Received & Verified!* ✅\n\nYour address is approximately *${distRounded} km* from our Malabagh farm.\n\n• Cleaned & Gutted: *₹580/kg* (Pan-ready steaks — zero mess)\n\n🛵 *Doorstep Delivery:* 100% FREE on our 4 kg family pack (₹2,320 total)! We can also send 2 kg for just ₹${89 + surgeGps} express courier fee (₹${1249 + surgeGps} total) or 3 kg for ₹${49 + surgeGps} courier fee (₹${1789 + surgeGps} total)${isEveningGps ? " (includes ₹40 evening rush courier surcharge)" : ""}.\n\nWould you like to confirm 4 kg free delivery or 2 kg for doorstep delivery? 🐟`;
            historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Malabagh farm. Free delivery on 4 kg family pack (₹2320); 3 kg has ₹${49 + surgeGps} fee (₹${1789 + surgeGps}); 2 kg has ₹${89 + surgeGps} fee (₹${1249 + surgeGps}); 1 kg has ₹${119 + surgeGps} fee (₹${699 + surgeGps}).]`;
          }
        }
        console.log(`│ ✅ IN RANGE (<=16km, ${distRounded} km) — Saved: ${mapsUrl}`);
      } else {
        locReply = `📍 *Location Check: Outside Delivery Perimeter* ⚠️\n\nYour location is *${distRounded} km* from our Malabagh farm. To guarantee live-harvest freshness without ice or chemicals, doorstep delivery is limited to 16 km across Srinagar.\n\nHowever, you are warmly welcome to visit our Live Vending Center in Malabagh (Near R. P. School Girls Wing, open Saturday to Thursday) where you can pick live trout and get it cleaned on the spot! 🐟\n📍 Maps: https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9`;
        historyNote = `[Customer shared location - Verified distance: ${distRounded} km from Malabagh farm. OUTSIDE 16km perimeter. Doorstep delivery not possible. Direct them to visit Live Vending Center in Malabagh.]`;
        console.log(`│ ⚠️ OUTSIDE 16km (${distRounded} km) — Directed to visit Live Vending Center in Malabagh`);
      }
      console.log(`└─────────────────────────────────────────────────────────────`);

      chatHist.push({ role: "user", text: historyNote });
      chatHist.push({ role: "model", text: locReply });
      if (chatHist.length > 8) chatHist.splice(0, chatHist.length - 8);
      chatHistories.set(remoteJid, chatHist);
      saveChatHistories();

      await sock.sendMessage(remoteJid, { text: locReply });
      await sock.sendPresenceUpdate("available", remoteJid);
      return;
    }

    if (!text || text.trim().length === 0) return;

    // Detect locality from user message
    const locDetected = detectSrinagarLocality(text);
    const detectedLocalityName = locDetected && locDetected.status === "IN_ZONE" ? locDetected.name : null;

    // Track user message in metadata
    if (!chatMetadata[remoteJid]) chatMetadata[remoteJid] = {};
    chatMetadata[remoteJid].lastUserMsgTime = msgStartTime;
    chatMetadata[remoteJid].lastMsgRole = "user";
    chatMetadata[remoteJid].lastUserText = text.slice(0, 150);
    if (cleanPushName) chatMetadata[remoteJid].pushName = cleanPushName;
    if (cleanPhone) chatMetadata[remoteJid].phone = cleanPhone;
    if (detectedLocalityName && (!chatMetadata[remoteJid].localityName || chatMetadata[remoteJid].localityName === "Srinagar")) {
      chatMetadata[remoteJid].localityName = detectedLocalityName;
    }

    if (raw10) {
      if (!chatMetadata[raw10]) chatMetadata[raw10] = {};
      chatMetadata[raw10].lastUserMsgTime = msgStartTime;
      chatMetadata[raw10].lastMsgRole = "user";
      chatMetadata[raw10].lastUserText = text.slice(0, 150);
      if (cleanPushName) chatMetadata[raw10].pushName = cleanPushName;
      chatMetadata[raw10].phone = cleanPhone;
      if (detectedLocalityName && (!chatMetadata[raw10].localityName || chatMetadata[raw10].localityName === "Srinagar")) {
        chatMetadata[raw10].localityName = detectedLocalityName;
      }
    }
    saveChatMetadata();

    // ─── 0. DIRECT SCANNER / QR INTERCEPT (ZERO DUPLICATE MESSAGES) ───
    const isAskingForQr = /\b(?:scanner|qr|qr\s*code|barcode|scan|scanner\s*bhejo|bhejo\s*scanner|send\s*scanner|send\s*qr|scanner\s*hai|qr\s*send)\b/i.test(text);
    if (isAskingForQr) {
      try {
        const ordersFilePath = path.join(__dirname, "customer_orders.json");
        let orders = {};
        if (fs.existsSync(ordersFilePath)) {
          try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
        }
        const targetOrder = orders[raw10] || orders[cleanPhone] || Object.values(orders).find(o => o.chatId === remoteJid);
        if (targetOrder && targetOrder.orderRef) {
          const numMatch = String(targetOrder.amount || "").match(/(\d+)/);
          const amt = numMatch ? parseFloat(numMatch[1]) : null;
          if (amt && amt > 0) {
            let qrBuffer = null;
            let isRazorpayQr = false;
            try {
              const rzpQr = await createRazorpayQrCode({
                amount: amt,
                customerPhone: cleanPhone,
                customerName: targetOrder.name,
                orderRef: targetOrder.orderRef,
                description: targetOrder.items
              });
              qrBuffer = rzpQr.imageBuffer;
              isRazorpayQr = true;
              targetOrder.razorpayQrId = rzpQr.qrId;
              targetOrder.razorpayQrUrl = rzpQr.imageUrl;
              recordNewCustomerOrder(cleanPhone || raw10, targetOrder);
            } catch (rzpQrErr) {
              console.warn("Could not create Razorpay QR, falling back to local UPI QR:", rzpQrErr.message);
              const upiPayUri = `upi://pay?pa=JKBMERC00828895@jkb&pn=Urban%20Trout%20Aquaculture&am=${amt.toFixed(2)}&cu=INR&tn=Order-${targetOrder.orderRef}`;
              qrBuffer = await QRCode.toBuffer(upiPayUri, {
                width: 600,
                margin: 2,
                color: { dark: "#000000", light: "#ffffff" }
              });
            }

            if (qrBuffer) {
              const qrMsg = await sock.sendMessage(remoteJid, {
                image: qrBuffer,
                caption: `🐟 *URBAN TROUT AQUACULTURE*\n\n🔒 *LOCKED ${isRazorpayQr ? "RAZORPAY " : ""}UPI SCANNER (₹${amt})*\nOrder Reference: *#${targetOrder.orderRef}*\nItems: *${targetOrder.items || "Fresh Rainbow Trout"}*\n\n👉 *Scan with any UPI App:* Google Pay, PhonePe, Paytm, BHIM, or J&K Bank mPay.\n• Amount *₹${amt}* is already pre-filled & locked.\n• Instant auto-reconciliation & Telegram alert.\n\nOnce paid, your live-harvest slot is confirmed immediately! 🚀\n\n*(Or tap your online payment link if you prefer paying on this phone: ${targetOrder.payUrl || "https://urbantrout.in"})*`
              });
              if (qrMsg && qrMsg.key && qrMsg.key.id) {
                botSentMessageIds.add(qrMsg.key.id);
                setTimeout(() => botSentMessageIds.delete(qrMsg.key.id), 10 * 60 * 1000);
              }
              await sock.sendPresenceUpdate("available", remoteJid);
              console.log(`📷 [${isRazorpayQr ? "Razorpay" : "UPI"} Locked QR Dispatched Directly] Sent ₹${amt} locked QR image to ${formatPhoneDisplay(cleanPhone)} for #${targetOrder.orderRef}`);

              // Track bot response in metadata
              chatMetadata[remoteJid].lastBotMsgTime = Date.now();
              chatMetadata[remoteJid].lastMsgRole = "model";
              chatMetadata[remoteJid].lastBotReply = `[Locked QR Code Dispatched ₹${amt}]`;
              if (raw10) {
                chatMetadata[raw10].lastBotMsgTime = Date.now();
                chatMetadata[raw10].lastMsgRole = "model";
                chatMetadata[raw10].lastBotReply = `[Locked QR Code Dispatched ₹${amt}]`;
              }
              saveChatMetadata();
              return; // STOP! Direct QR sent, no Gemini call, zero duplicate text message!
            }
          }
        }
      } catch (qrPreErr) {
        console.error("Direct QR dispatch error:", qrPreErr.message);
      }
    }

    // Register active generation turn for abort guard
    const currentTurnId = Date.now() + Math.random();
    activeChatGenerations.set(remoteJid, { turnId: currentTurnId, startTime: Date.now(), promptText: text });

    // Maintain typing presence while Gemini prepares the response (non-blocking)
    sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});

    try {
      const aiReply = await generateGeminiReply(remoteJid, text, cleanPhone, customerName);

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
      console.log(`│ 📩 Customer: "${text}"`);
      console.log(`├──────────────────────────────────────────────────────────────────────────`);
      console.log(`│ 🤖 [AI SALES AGENT] Model: gemini-2.5-flash | Key #${activeKeyNum} | ⚡ Speed: ${responseTimeMs}ms (${responseTimeSec}s)`);
      console.log(`│ 📤 Reply: "${aiReply.replace(/\n+/g, ' ')}"`);
      console.log(`└──────────────────────────────────────────────────────────────────────────\n`);

      // ─── DYNAMIC LOCKED RAZORPAY QR DISPATCH WHEN CUSTOMER ASKS FOR SCANNER / QR IN THIS TURN ───
      let sentQrOnly = false;
      if (isAskingForQr) {
        try {
          const ordersFilePath = path.join(__dirname, "customer_orders.json");
          let orders = {};
          if (fs.existsSync(ordersFilePath)) {
            try { orders = JSON.parse(fs.readFileSync(ordersFilePath, "utf8")); } catch (_) {}
          }
          const targetOrder = orders[raw10] || orders[cleanPhone] || Object.values(orders).find(o => o.chatId === remoteJid);
          if (targetOrder && targetOrder.orderRef) {
            const numMatch = String(targetOrder.amount || "").match(/(\d+)/);
            const amt = numMatch ? parseFloat(numMatch[1]) : null;
            if (amt && amt > 0) {
              let qrBuffer = null;
              let isRazorpayQr = false;

              // 1. Generate official Razorpay UPI QR Code
              try {
                const rzpQr = await createRazorpayQrCode({
                  amount: amt,
                  customerPhone: cleanPhone,
                  customerName: targetOrder.name,
                  orderRef: targetOrder.orderRef,
                  description: targetOrder.items
                });
                qrBuffer = rzpQr.imageBuffer;
                isRazorpayQr = true;
                targetOrder.razorpayQrId = rzpQr.qrId;
                targetOrder.razorpayQrUrl = rzpQr.imageUrl;
                recordNewCustomerOrder(cleanPhone || raw10, targetOrder);
              } catch (rzpQrErr) {
                console.warn("Could not create Razorpay QR, falling back to local UPI QR:", rzpQrErr.message);
                const upiPayUri = `upi://pay?pa=JKBMERC00828895@jkb&pn=Urban%20Trout%20Aquaculture&am=${amt.toFixed(2)}&cu=INR&tn=Order-${targetOrder.orderRef}`;
                qrBuffer = await QRCode.toBuffer(upiPayUri, {
                  width: 600,
                  margin: 2,
                  color: { dark: "#000000", light: "#ffffff" }
                });
              }

              if (qrBuffer) {
                const qrMsg = await sock.sendMessage(remoteJid, {
                  image: qrBuffer,
                  caption: `🐟 *URBAN TROUT AQUACULTURE*\n\n🔒 *LOCKED ${isRazorpayQr ? "RAZORPAY " : ""}UPI SCANNER (₹${amt})*\nOrder Reference: *#${targetOrder.orderRef}*\nItems: *${targetOrder.items || "Fresh Rainbow Trout"}*\n\n👉 *Scan with any UPI App:* Google Pay, PhonePe, Paytm, BHIM, or J&K Bank mPay.\n• Amount *₹${amt}* is already pre-filled & locked.\n• Instant auto-reconciliation & Telegram alert.\n\nOnce paid, your live-harvest slot is confirmed immediately! 🚀\n\n*(Or tap your online payment link if you prefer paying on this phone: ${targetOrder.payUrl || "https://urbantrout.in"})*`
                });
                if (qrMsg && qrMsg.key && qrMsg.key.id) {
                  botSentMessageIds.add(qrMsg.key.id);
                  setTimeout(() => botSentMessageIds.delete(qrMsg.key.id), 10 * 60 * 1000);
                }
                sentQrOnly = true;
                console.log(`📷 [${isRazorpayQr ? "Razorpay" : "UPI"} Locked QR Dispatched] Sent ₹${amt} locked QR image to ${formatPhoneDisplay(cleanPhone)} for #${targetOrder.orderRef}`);
              }
            }
          }
        } catch (qrErr) {
          console.error("Error generating/dispatching locked QR code:", qrErr.message);
        }
      }

      // Send text reply only if QR wasn't already sent (guarantees exactly ONE message)
      if (!sentQrOnly) {
        const sentMsg = await sock.sendMessage(remoteJid, { text: aiReply });
        if (sentMsg && sentMsg.key && sentMsg.key.id) {
          botSentMessageIds.add(sentMsg.key.id);
          setTimeout(() => botSentMessageIds.delete(sentMsg.key.id), 10 * 60 * 1000);
        }
      }
      await sock.sendPresenceUpdate("available", remoteJid);

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

      // Auto-export contacts so vCard is continuously kept fresh
      setTimeout(() => {
        try {
          exportContacts();
        } catch (_) {}
      }, 1500);
    } catch (err) {
      console.error(`❌ Error generating/sending reply for ${displayPhone}:`, err.message);
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
    if (batch && batch.text && batch.text.trim()) {
      enqueueChatMessage(remoteJid, async () => {
        await processSingleMessage(sock, batch.msg, remoteJid, batch.text.trim());
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

  // Concurrent WhatsApp message ingress: Process with smart rapid-fire debouncing per customer
  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid) continue;

      // Ignore group chats and status broadcasts
      if (remoteJid.endsWith("@g.us") || remoteJid.includes("broadcast")) continue;

      // Persist sender's WhatsApp pushName immediately
      if (msg.pushName) {
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

      // STRICT PRIMARY CONTACTS SHIELD: If sender is in Suhail's personal Primary Contacts (1,294 friends, family, personal VIPs)
      const primaryContact = getPrimaryContactProfile(remoteJid, resolveCustomerPhone(remoteJid));
      if (primaryContact) {
        // If message is casual personal chat (not a trout purchase order), AI stays 100% silent for manual chat by Suhail!
        const innerCheck = getInnerMessage(msg);
        const checkText = innerCheck ? (innerCheck.conversation || innerCheck.extendedTextMessage?.text || innerCheck.imageMessage?.caption || "").trim() : "";
        const isTroutInquiry = /\b(?:trout|fish|order|rate|580|kg|kilo|cleaned|gutted|delivery|harvest|vending)\b/i.test(checkText);
        if (!isTroutInquiry) {
          console.log(`🛡️ [PRIMARY CONTACT SHIELD] Received message from personal contact "${primaryContact.name}" (${remoteJid}). Silently ignored by AI for 100% manual handling by Suhail.`);
          humanOverrides.set(remoteJid, Date.now() + (365 * 24 * 60 * 60 * 1000));
          continue;
        }
      }

      const inner = getInnerMessage(msg);
      if (!inner) continue;

      const rawText = (
        inner.conversation ||
        inner.extendedTextMessage?.text ||
        inner.imageMessage?.caption ||
        ""
      ).trim();

      const cleanPhone = resolveCustomerPhone(remoteJid);
      const isOwner = msg.key.fromMe || cleanPhone.endsWith("7006604148") || String(remoteJid).includes("174637916885151");

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

      // 1. If message is from owner (either manual message or # command)
      if (isOwner) {
        // If owner sends a message in a customer chat, immediately cancel any pending customer debounce buffer!
        if (chatDebounceBuffers.has(remoteJid)) {
          clearTimeout(chatDebounceBuffers.get(remoteJid).timer);
          chatDebounceBuffers.delete(remoteJid);
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

      // 4. WhatsApp Location Pin or Live Location: process immediately without debouncing
      const locMsg = inner.locationMessage || inner.liveLocationMessage;
      if (locMsg) {
        let combinedText = rawText;
        if (chatDebounceBuffers.has(remoteJid)) {
          const existing = chatDebounceBuffers.get(remoteJid);
          clearTimeout(existing.timer);
          chatDebounceBuffers.delete(remoteJid);
          if (existing.text) combinedText = (existing.text + "\n" + rawText).trim();
        }
        enqueueChatMessage(remoteJid, async () => {
          await processSingleMessage(sock, msg, remoteJid, combinedText);
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

      // 5. Smart Adaptive Multi-Message Buffer (waits 5000ms, holds while customer is typing)
      const DEBOUNCE_DELAY_MS = 5000;
      if (chatDebounceBuffers.has(remoteJid)) {
        const existing = chatDebounceBuffers.get(remoteJid);
        clearTimeout(existing.timer);
        existing.text = existing.text ? (existing.text + "\n" + rawText) : rawText;
        existing.msg = msg;
        existing.lastMsgTime = Date.now();
        const elapsed = Date.now() - existing.firstMsgTime;
        const delay = elapsed > 25000 ? 1500 : DEBOUNCE_DELAY_MS;
        console.log(`⏳ [Smart Debounce] Buffered rapid message #${existing.text.split('\n').length} from ${formatPhoneDisplay(cleanPhone)} (Elapsed: ${Math.round(elapsed / 1000)}s): "${rawText.replace(/\n+/g, ' ')}"`);
        existing.timer = setTimeout(() => flushDebounce(remoteJid), delay);
      } else {
        const entry = {
          firstMsgTime: Date.now(),
          lastMsgTime: Date.now(),
          msg,
          text: rawText,
          isTyping: false,
          timer: null
        };
        entry.timer = setTimeout(() => flushDebounce(remoteJid), DEBOUNCE_DELAY_MS);
        chatDebounceBuffers.set(remoteJid, entry);
        console.log(`⏳ [Smart Debounce] New customer message buffer started for ${formatPhoneDisplay(cleanPhone)} (5.0s window): "${rawText.replace(/\n+/g, ' ')}"`);
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
    formatOrderSummaryCard
  };
}
