import deliveryZoneDb from "./delivery_zone_db.json";

export const FARM_LAT = 34.144709;
export const FARM_LNG = 74.824525;

export interface GeocodeResult {
  status: "IN_ZONE" | "OUT_ZONE";
  name: string;
  dist: number;
  minKg: number;
  tier: "0-4km" | "4-7km" | "7-11.5km" | "11.5-16km" | "Out-of-Zone";
  lat?: number;
  lng?: number;
  source: "known_core" | "zone_db" | "nominatim" | "device_gps" | "google_maps" | "unknown";
  isDeliverable: boolean;
  deliveryFee: number;
  message: string;
}

// Haversine distance formula with Srinagar Road Winding Calibration (Exact sync with AI Sales Agent)
// Converts straight-line aerial distance into actual driving road distance:
// Direct local routes <=2km have ~1.10x factor.
// East/SE Dal Lake corridor (water barrier detour): ~1.62x factor.
// North/NE corridor (Zakura, Pandach, Gulab Bagh): ~1.40x factor.
// Central & South Srinagar (bridges & city grid): ~1.38x factor.
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  const aerial = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (aerial <= 2.0) {
    return aerial * 1.10;
  }

  // Identify destination coordinates
  const isLat1Farm = Math.abs(lat1 - FARM_LAT) < 0.02 && Math.abs(lon1 - FARM_LNG) < 0.02;
  const destLat = isLat1Farm ? lat2 : lat1;
  const destLon = isLat1Farm ? lon2 : lon1;

  // 1. Dal Lake / Boulevard / Cheshmashahi / Tulip Garden corridor (South-East of Dal Lake):
  const isEastOfDalLake = (destLon >= 74.845 && destLat <= 34.135) || (destLat <= 34.100 && destLon >= 74.838);
  if (isEastOfDalLake) {
    return aerial * 1.62;
  }

  // 2. North/North-East corridor (Gulab Bagh, Zakura, Pandach, Ganderbal road): ~1.40x factor.
  if (destLat >= 34.150 && destLon >= 74.815) {
    return aerial * 1.40;
  }

  // 3. Central & South Srinagar across Jhelum bridges and city grid: ~1.38x factor.
  return aerial * 1.38;
}

// 75+ Core Verified Localities in Srinagar
export const CORE_IN_ZONE_AREAS: Array<{ pattern: RegExp; name: string; dist: number; minKg?: number }> = [
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
  { pattern: /\b(?:illahi\s*bagh|illahibagh|ellahi\s*bagh|ellahibagh)\b/i, name: "Illahi Bagh", dist: 1.5 },
  { pattern: /\b(?:90\s*feet|90ft|ninety\s*feet)\b/i, name: "90 Feet Road", dist: 1.6 },
  { pattern: /\b(?:botshah\s*mohalla|botsha\s*mohalla)\b/i, name: "Botshah Mohalla", dist: 1.7 },
  { pattern: /\b(?:sadrebal|saderbal|sadrabal|sadr\s*bal)\b/i, name: "Sadrebal", dist: 1.7 },
  { pattern: /\b(?:sikh\s*bagh|sikhbagh)\b/i, name: "Sikh Bagh", dist: 1.8 },
  { pattern: /\b(?:bismillah\s*colony)\b/i, name: "Bismillah Colony", dist: 1.8 },
  { pattern: /\b(?:habak|habbak|habback)\b/i, name: "Habak", dist: 1.8 },
  { pattern: /\b(?:bhat\s*mohalla)\b/i, name: "Bhat Mohalla", dist: 1.9 },
  { pattern: /\b(?:tawheed\s*abad|tawheedabad)\b/i, name: "Tawheed Abad", dist: 2.0 },
  { pattern: /\b(?:lal\s*bazar|lalbazar|molvi\s*stop)\b/i, name: "Lal Bazar", dist: 2.0 },
  { pattern: /\b(?:rangpura|rang\s*pura|rangpora)\b/i, name: "Rangpura", dist: 2.0 },
  { pattern: /\b(?:ahmad\s*nagar|ahmed\s*nagar)\b/i, name: "Ahmad Nagar", dist: 2.0 },
  { pattern: /\b(?:kashmir\s*university|ku\s*campus|university\s*campus)\b/i, name: "Kashmir University", dist: 2.0 },
  { pattern: /\b(?:bachpora|buchpora|bach\s*pora|buch\s*pora)\b/i, name: "Buchpora", dist: 2.1 },
  { pattern: /\b(?:nit\s*srinagar|nit\s*campus)\b/i, name: "NIT Srinagar", dist: 2.6 },
  { pattern: /\b(?:hazrat\s*bal|hazratbal|dargah|sir\s*syed\s*market)\b/i, name: "Hazratbal", dist: 2.2 },
  { pattern: /\b(?:soura|skims)\b/i, name: "Soura", dist: 2.2 },
  { pattern: /\b(?:vicharnag|vichar\s*nag)\b/i, name: "Vicharnag", dist: 2.2 },
  { pattern: /\b(?:umer\s*colony|omar\s*colony)\b/i, name: "Umer Colony", dist: 2.2 },
  { pattern: /\b(?:now\s*shera|nowshera)\b/i, name: "Nowshera", dist: 2.4 },
  { pattern: /\b(?:anchar)\b/i, name: "Anchar", dist: 2.5 },
  { pattern: /\b(?:batapora|bata\s*pora|batpora|bat\s*pora|fazalhaq\s*colony|chinar\s*lane)\b/i, name: "Batpora (Fazalhaq Colony)", dist: 2.5 },
  { pattern: /\b(?:nigeen|nagin|nagin\s*lake)\b/i, name: "Nigeen", dist: 2.8 },
  { pattern: /\b(?:kanitar)\b/i, name: "Kanitar", dist: 2.8 },
  { pattern: /\b(?:karanagar|karan\s*nagar)\b/i, name: "Karanagar", dist: 2.8 },
  { pattern: /\b(?:bagh\s*ali\s*mardan(?:\s*khan)?|ali\s*mardan\s*khan)\b/i, name: "Bagh Ali Mardan Khan", dist: 2.9 },
  { pattern: /\b(?:zoonimar|zooni\s*mar)\b/i, name: "Zoonimar", dist: 3.3 },
  { pattern: /\b(?:tailbal|teilbal|habak\s*shanpora)\b/i, name: "Tailbal", dist: 3.3 },
  { pattern: /\b(?:g(?:h)?ulab\s*bagh|g(?:h)?ulabbagh)\b/i, name: "Gulab Bagh", dist: 3.6 },
  { pattern: /\b(?:bota\s*kadal|botakadal)\b/i, name: "Botakadal", dist: 3.6 },
  { pattern: /\b(?:pandach|pandath|pandacha)\b/i, name: "Pandach", dist: 3.6 },
  { pattern: /\b(?:zadibal)\b/i, name: "Zadibal", dist: 4.0 },

  // ── Zone 2 (4–6 km, MOQ 3 kg) ──
  { pattern: /\b(?:badamwari|badam\s*wari)\b/i, name: "Badamwari", dist: 4.2 },
  { pattern: /\b(?:alamgari\s*bazar|alamgaribazar)\b/i, name: "Alamgari Bazar", dist: 4.3 },
  { pattern: /\b(?:nagbal)\b/i, name: "Nagbal", dist: 4.3 },
  { pattern: /\b(?:saida\s*kadal|saidakadal)\b/i, name: "Saida Kadal", dist: 4.3 },
  { pattern: /\b(?:burzuhama|burzahama|burza\s*hama)\b/i, name: "Burzahama", dist: 4.3 },
  { pattern: /\b(?:hawal)\b/i, name: "Hawal", dist: 4.6 },
  { pattern: /\b(?:alusteng|alustang|aloo\s*steng)\b/i, name: "Alusteng", dist: 4.6 },
  { pattern: /\b(?:eidgah|idgah|eid\s*gah|aali\s*masjid)\b/i, name: "Eidgah", dist: 4.6 },
  { pattern: /\b(?:gojwara|goj\s*wara)\b/i, name: "Gojwara", dist: 5.0 },
  { pattern: /\b(?:nowhatta|nau\s*hatta)\b/i, name: "Nowhatta", dist: 5.3 },
  { pattern: /\b(?:safakadal|safa\s*kadal|sufakadal)\b/i, name: "Safakadal", dist: 5.4 },
  { pattern: /\b(?:rainawari|raina\s*wari|reinawari)\b/i, name: "Rainawari", dist: 5.4 },
  { pattern: /\b(?:khanyar|khan\s*yar)\b/i, name: "Khanyar", dist: 5.5 },
  { pattern: /\b(?:shalimar|shalimar\s*bagh|shalimar\s*garden)\b/i, name: "Shalimar", dist: 5.5 },
  { pattern: /\b(?:ali\s*kadal|ali\s*kadel|alikadal)\b/i, name: "Ali Kadal", dist: 5.8 },
  { pattern: /\b(?:rajouri\s*kadal|rajourikadal|rajouri\s*kadel)\b/i, name: "Rajouri Kadal", dist: 6.2 },
  { pattern: /\b(?:saraf\s*kadal|sarafkadal)\b/i, name: "Saraf Kadal", dist: 6.5 },
  { pattern: /\b(?:bohri\s*kadal|bohrikadal|bhori\s*kadal|bhorikadal)\b/i, name: "Bohri Kadal", dist: 6.8 },

  // ── Zone 3: Central & City Srinagar (7–11.5 km, Included on 3 kg) ──
  { pattern: /\b(?:zaina\s*kadal|zainakadal|zaina\s*kadel|new\s*zaina\s*kadal)\b/i, name: "Zaina Kadal", dist: 7.8, minKg: 3 },
  { pattern: /\b(?:maharaj\s*gunj|maharajgunj|maharaj\s*ganj|maharajganj)\b/i, name: "Maharaj Gunj", dist: 7.8, minKg: 3 },
  { pattern: /\b(?:fateh\s*kadal|fatehkadal|fateh\s*kadel|fatehkadel|astaan\s*syed\s*ali\s*akbar)\b/i, name: "Fateh Kadal", dist: 8.8, minKg: 3 },
  { pattern: /\b(?:habba\s*kadal|habbakadal|habba\s*kadel)\b/i, name: "Habba Kadal", dist: 9.0, minKg: 3 },
  { pattern: /\b(?:lal\s*chowk|lalchowk)\b/i, name: "Lal Chowk", dist: 8.0, minKg: 3 },
  { pattern: /\b(?:dalgate|dal\s*gate)\b/i, name: "Dalgate", dist: 7.5, minKg: 3 },
  { pattern: /\b(?:khay+am|khyam|khaiam)(?:\s*(?:chowk|road|cinema))?\b/i, name: "Khayam", dist: 7.2, minKg: 3 },
  { pattern: /\b(?:khyber\s*hospital|khyber)\b/i, name: "Khayam", dist: 7.2, minKg: 3 },
  { pattern: /\b(?:sonwar|sonawar|sona\s*war)\b/i, name: "Sonwar", dist: 8.0, minKg: 3 },
  { pattern: /\b(?:qamarwari|qamar\s*wari|kamarwari)\b/i, name: "Qamarwari", dist: 9.5, minKg: 3 },
  { pattern: /\b(?:habba\s*kadal|habbakadal)\b/i, name: "Habba Kadal", dist: 9.0, minKg: 3 },
  { pattern: /\b(?:nishat)\b/i, name: "Nishat", dist: 8.0, minKg: 3 },
  { pattern: /\b(?:brein|brain)\b/i, name: "Brein/Nishat", dist: 11.0, minKg: 3 },
  { pattern: /\b(?:harwan|harwan\s*garden)\b/i, name: "Harwan", dist: 9.5, minKg: 3 },

  // ── Zone 4: South Corridor, Rajbagh, Jawahar Nagar, Batamaloo, Sanat Nagar, Peerbagh, Airport Rd, Nowgam (11.5–16 km, Included on 5 kg) ──
  { pattern: /\b(?:batamaloo|batmaloo)\b/i, name: "Batamaloo", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:jawahar\s*nagar|jawaharnagar)\b/i, name: "Jawahar Nagar", dist: 11.8, minKg: 5 },
  { pattern: /\b(?:raj\s*bagh|rajbagh)\b/i, name: "Rajbagh", dist: 12.0, minKg: 5 },
  { pattern: /\b(?:wazir\s*bagh|wazirbagh)\b/i, name: "Wazir Bagh", dist: 12.7, minKg: 5 },
  { pattern: /\b(?:sonwar|sonawar|sona\s*war)\b/i, name: "Sonwar", dist: 12.9, minKg: 5 },
  { pattern: /\b(?:bemina)\b/i, name: "Bemina", dist: 12.5, minKg: 5 },
  { pattern: /\b(?:natipora|nati\s*pora)\b/i, name: "Natipora", dist: 12.5, minKg: 5 },
  { pattern: /\b(?:padshahi\s*bagh|padshahibagh)\b/i, name: "Padshahi Bagh", dist: 13.0, minKg: 5 },
  { pattern: /\b(?:chanapora|chanpora)\b/i, name: "Chanapora", dist: 13.0, minKg: 5 },
  { pattern: /\b(?:pandrathan)\b/i, name: "Pandrathan", dist: 13.0, minKg: 5 },
  { pattern: /\b(?:sanat\s*nagar|sanatnagar)\b/i, name: "Sanat Nagar", dist: 13.5, minKg: 5 },
  { pattern: /\b(?:baghat|barzulla|baghat\s*barzulla)\b/i, name: "Baghat / Barzulla", dist: 14.2, minKg: 5 },
  { pattern: /\b(?:hyderpora|hyder\s*pora)\b/i, name: "Hyderpora", dist: 14.5, minKg: 5 },
  { pattern: /\b(?:rawalpora|rawapora)\b/i, name: "Rawalpora", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:athwajan)\b/i, name: "Athwajan", dist: 13.5, minKg: 5 },
  { pattern: /\b(?:peerbagh|peer\s*bagh|pirbagh)\b/i, name: "Peerbagh", dist: 14.5, minKg: 5 },
  { pattern: /\b(?:soiteng|suiteng)\b/i, name: "Soiteng", dist: 13.5, minKg: 5 },
  { pattern: /\b(?:bagh[- ]e[- ]mehtab|baghi\s*mehtab)\b/i, name: "Bagh-e-Mehtab", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:pantha\s*chowk|panthachowk)\b/i, name: "Pantha Chowk", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:airport\s*road|humhama|srinagar\s*airport)\b/i, name: "Airport Road / Humhama", dist: 15.0, minKg: 5 },
  { pattern: /\b(?:lasjan|lassjan)\b/i, name: "Lasjan", dist: 14.0, minKg: 5 },
  { pattern: /\b(?:nowgam|naugaon|nowgham|nowgam\s*bypass)\b/i, name: "Nowgam", dist: 14.5, minKg: 5 },
  { pattern: /\b(?:rangreth)\b/i, name: "Rangreth", dist: 15.5, minKg: 5 },
  { pattern: /\b(?:mochu|moochu)\b/i, name: "Mochu", dist: 15.0, minKg: 5 },
  { pattern: /\b(?:kralpora|kral\s*pora)\b/i, name: "Kralpora", dist: 15.5, minKg: 5 },
  { pattern: /\b(?:pohru|pohroo)\b/i, name: "Pohru", dist: 15.0, minKg: 5 },
  { pattern: /\b(?:hmt|zainakote|mustafabad)\b/i, name: "HMT / Zainakote", dist: 15.0, minKg: 5 }
];

// Strict Out-of-Zone Localities (> 16 km & Outer Districts)
export const CORE_OUT_ZONE_AREAS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\b(?:ganderbal|beehama|bihama|duderhama|dudurhama|saloora|salora|tullamulla|tulmulla|kangan|wayil|manigam|safapora|wussan)\b/i, name: "Ganderbal District" },
  { pattern: /\b(?:pampore)\b/i, name: "Pampore" },
  { pattern: /\b(?:chadoora|chadure)\b/i, name: "Chadoora" },
  { pattern: /\b(?:lawaypora|lawapora|narbal)\b/i, name: "Lawaypora / Narbal" },
  { pattern: /\b(?:budgam|ompora)\b/i, name: "Budgam" },
  { pattern: /\b(?:baramulla|anantnag|sopore|kupwara)\b/i, name: "Outside Srinagar District" }
];

const dbList: any[] = Array.isArray(deliveryZoneDb) ? deliveryZoneDb : Object.values(deliveryZoneDb);

/**
 * Intelligent Location Resolver for Urban Trout
 */
export function resolveLocationFromText(inputText: string, weightKg: number = 2): GeocodeResult {
  if (!inputText || !inputText.trim()) {
    return {
      status: "OUT_ZONE",
      name: "Unknown Location",
      dist: 15.0,
      minKg: 0,
      tier: "Out-of-Zone",
      source: "unknown",
      isDeliverable: false,
      deliveryFee: 0,
      message: "Please enter your specific Srinagar locality or tap Auto-Detect Location."
    };
  }

  const cleanText = inputText.trim();

  // 1. Check Strict Out-of-Zone keywords
  for (const outArea of CORE_OUT_ZONE_AREAS) {
    if (outArea.pattern.test(cleanText)) {
      return {
        status: "OUT_ZONE",
        name: outArea.name,
        dist: 14.5,
        minKg: 0,
        tier: "Out-of-Zone",
        source: "known_core",
        isDeliverable: false,
        deliveryFee: 0,
        message: `${outArea.name} is beyond our 16 km express delivery perimeter. Available for Live Vending Centre pickup at Malabagh Farm.`
      };
    }
  }

  // 2. Check Core In-Zone Localities (Prioritized by specificity)
  // Sort pattern list so specific items like "Batpora" or "Fazalhaq Colony" match before broader "Hazratbal"
  const sortedCore = [...CORE_IN_ZONE_AREAS].sort((a, b) => b.name.length - a.name.length);
  for (const item of sortedCore) {
    if (item.pattern.test(cleanText)) {
      const dist = item.dist;
      return buildResult(item.name, dist, "known_core", weightKg);
    }
  }

  // 3. Search 451-place local database
  const db = dbList;
  if (db && db.length > 0) {
    for (const place of db) {
      if (!place.name || place.name.length < 3) continue;
      const cleanName = place.name.replace(/^(government|govt|boys|girls|high school|school|masjid|mosque|shrine|hospital|bridge|park)\s+/gi, "").trim();
      if (cleanName.length >= 4) {
        const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const reg = new RegExp(`\\b${escaped}\\b`, "i");
        if (reg.test(cleanText)) {
          const dist = parseFloat(place.distance_km.toFixed(1));
          return buildResult(place.name, dist, "zone_db", weightKg, place.lat, place.lon);
        }
      }
    }
  }

  // 4. Default: If truly unrecognized, prompt user to use GPS
  return {
    status: "OUT_ZONE",
    name: cleanText,
    dist: 13.0,
    minKg: 4,
    tier: "Out-of-Zone",
    source: "unknown",
    isDeliverable: false,
    deliveryFee: 0,
    message: `We could not verify "${cleanText}" within our standard 16 km Srinagar delivery perimeter. Please tap "Auto-Detect My GPS" for exact pin-point delivery verification.`
  };
}

const liveRoadDistanceCache = new Map<string, number>();

/**
 * Real-time road traveling distance calculator (Google Maps / Rapido road network via OSRM with geographic fallback)
 * Exact match with AI Sales Agent's fetchLiveRoadDistance()
 */
export async function fetchLiveRoadDistance(lat: number, lng: number): Promise<number> {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return 2.0;
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (liveRoadDistanceCache.has(key)) return liveRoadDistanceCache.get(key)!;

  const fallback = parseFloat(calculateHaversineDistance(FARM_LAT, FARM_LNG, lat, lng).toFixed(1));

  try {
    if (typeof window !== "undefined") {
      // Client-side: query internal API route
      const res = await fetch(`/api/route-distance?lat=${lat}&lng=${lng}`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.distanceKm === "number" && !isNaN(data.distanceKm)) {
          liveRoadDistanceCache.set(key, data.distanceKm);
          return data.distanceKm;
        }
      }
    } else {
      // Server-side: call OSRM driving route directly
      const url = `https://router.project-osrm.org/route/v1/driving/${FARM_LNG},${FARM_LAT};${lng},${lat}?overview=false`;
      const res = await fetch(url, {
        headers: { "User-Agent": "UrbanTroutBot/1.0" },
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.routes && json.routes[0] && typeof json.routes[0].distance === "number") {
          const dist = parseFloat((json.routes[0].distance / 1000).toFixed(1));
          liveRoadDistanceCache.set(key, dist);
          return dist;
        }
      }
    }
  } catch (_) {}

  return fallback;
}

/**
 * Resolver for Exact Device GPS Coordinates
 */
export function resolveLocationFromCoords(lat: number, lng: number, weightKg: number = 2): GeocodeResult {
  const dist = parseFloat(calculateHaversineDistance(FARM_LAT, FARM_LNG, lat, lng).toFixed(1));
  return buildResult("GPS Verified Location", dist, "device_gps", weightKg, lat, lng);
}

export async function resolveLocationFromCoordsAsync(lat: number, lng: number, weightKg: number = 2): Promise<GeocodeResult> {
  const roadDist = await fetchLiveRoadDistance(lat, lng);
  const dist = (roadDist != null && !isNaN(roadDist)) ? roadDist : parseFloat(calculateHaversineDistance(FARM_LAT, FARM_LNG, lat, lng).toFixed(1));
  return buildResult("GPS Verified Location", dist, "device_gps", weightKg, lat, lng);
}

export function buildResult(name: string, dist: number, source: GeocodeResult["source"], weightKg: number, lat?: number, lng?: number): GeocodeResult {
  if (dist <= 4.0) {
    const minKg = 2;
    const fee = weightKg >= minKg ? 0 : 45;
    return {
      status: "IN_ZONE",
      name,
      dist,
      minKg,
      tier: "0-4km",
      lat,
      lng,
      source,
      isDeliverable: true,
      deliveryFee: fee,
      message: `Zone 1 (~${dist} km from Malabagh Farm) • ${fee === 0 ? "Express Delivery Included ✓" : `₹${fee} Express Delivery Fee (Included from ${minKg} kg)`}`
    };
  } else if (dist <= 7.0) {
    const minKg = 3;
    const fee = weightKg >= 3 ? 0 : (weightKg >= 2 ? 55 : 75);
    return {
      status: "IN_ZONE",
      name,
      dist,
      minKg,
      tier: "4-7km",
      lat,
      lng,
      source,
      isDeliverable: true,
      deliveryFee: fee,
      message: `Zone 2 (~${dist} km from Malabagh Farm) • ${fee === 0 ? "Express Delivery Included ✓" : `₹${fee} Express Delivery Fee (Included from ${minKg} kg)`}`
    };
  } else if (dist <= 11.5) {
    const minKg = 3;
    const fee = weightKg >= 3 ? 0 : (weightKg >= 2 ? 89 : 130);
    return {
      status: "IN_ZONE",
      name,
      dist,
      minKg,
      tier: "7-11.5km",
      lat,
      lng,
      source,
      isDeliverable: true,
      deliveryFee: fee,
      message: `Zone 3 (~${dist} km from Malabagh Farm) • ${fee === 0 ? "Express Delivery Included ✓" : `₹${fee} Express Delivery Fee (Included from ${minKg} kg)`}`
    };
  } else if (dist <= 16.0) {
    const minKg = 5;
    const fee = weightKg >= 5 ? 0 : (weightKg >= 4 ? 109 : (weightKg >= 3 ? 129 : (weightKg >= 2 ? 139 : 190)));
    return {
      status: "IN_ZONE",
      name,
      dist,
      minKg,
      tier: "11.5-16km",
      lat,
      lng,
      source,
      isDeliverable: true,
      deliveryFee: fee,
      message: `Zone 4 (~${dist} km from Malabagh Farm) • ${fee === 0 ? "Express Delivery Included (5 kg Family Pack) ✓" : `₹${fee} Express Delivery Fee (Included on 5 kg)`}`
    };
  } else {
    return {
      status: "OUT_ZONE",
      name,
      dist,
      minKg: 0,
      tier: "Out-of-Zone",
      lat,
      lng,
      source,
      isDeliverable: false,
      deliveryFee: 0,
      message: `~${dist} km from Malabagh Farm Hub • Outside 16 km express delivery perimeter. Available for Live Vending Center pickup.`
    };
  }
}
