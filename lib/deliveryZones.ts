// Srinagar Locality Intelligence & Tiered Delivery Zones
// Synchronized with Urban Trout Sales Agent (OSM-verified coordinates from Malabagh Farm Hub)

export interface LocalityData {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  pincode: string;
  distKm: number;
  tier: "zone1" | "zone2" | "zone3" | "out_of_zone";
  minKgFree: number;
}

export const FARM_COORDS = {
  lat: 34.144709,
  lng: 74.824525,
  name: "Urban Trout Aquaculture Farm Hub, Malabagh",
  address: "Near R.P. School Girls Wing, Malabagh, Srinagar 190006",
  mapsUrl: "https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9",
};

export const MAX_DELIVERY_RADIUS_KM = 8.0;

export interface ZoneConfig {
  id: "zone1" | "zone2" | "zone3" | "out_of_zone";
  title: string;
  shortLabel: string;
  rangeKm: string;
  minKgFree: number;
  minOrderFreeText: string;
  specialDeliveryFee: number;
  deliveryTime: string;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  description: string;
}

export const DELIVERY_ZONES: Record<string, ZoneConfig> = {
  zone1: {
    id: "zone1",
    title: "Zone 1: Core Farm Zone",
    shortLabel: "0 – 4 km",
    rangeKm: "0 – 4.0 km",
    minKgFree: 2,
    minOrderFreeText: "2 kg",
    specialDeliveryFee: 100,
    deliveryTime: "Within 90–120 mins",
    color: "#22c55e",
    badgeBg: "rgba(34, 197, 94, 0.15)",
    badgeBorder: "rgba(34, 197, 94, 0.35)",
    badgeText: "#4ade80",
    description: "100% FREE doorstep delivery on min 2 kg (or ₹100 special fee for 1 kg).",
  },
  zone2: {
    id: "zone2",
    title: "Zone 2: Mid-Perimeter Zone",
    shortLabel: "4 – 6 km",
    rangeKm: "4.0 – 6.0 km",
    minKgFree: 3,
    minOrderFreeText: "3 kg",
    specialDeliveryFee: 250,
    deliveryTime: "Within 2 hours",
    color: "#38bdf8",
    badgeBg: "rgba(56, 189, 248, 0.15)",
    badgeBorder: "rgba(56, 189, 248, 0.35)",
    badgeText: "#7dd3fc",
    description: "100% FREE doorstep delivery on min 3 kg (or ₹250 special delivery for 1–2 kg).",
  },
  zone3: {
    id: "zone3",
    title: "Zone 3: Extended City Zone",
    shortLabel: "6 – 8 km",
    rangeKm: "6.0 – 8.0 km",
    minKgFree: 4,
    minOrderFreeText: "4 kg",
    specialDeliveryFee: 300,
    deliveryTime: "Within 2 hours",
    color: "#a855f7",
    badgeBg: "rgba(168, 85, 247, 0.15)",
    badgeBorder: "rgba(168, 85, 247, 0.35)",
    badgeText: "#c084fc",
    description: "100% FREE doorstep delivery on min 4 kg (or ₹300 special delivery for 1–3 kg).",
  },
  out_of_zone: {
    id: "out_of_zone",
    title: "Beyond 8 km Perimeter",
    shortLabel: "> 8 km",
    rangeKm: "Beyond 8.0 km",
    minKgFree: 0,
    minOrderFreeText: "Counter Pickup",
    specialDeliveryFee: 0,
    deliveryTime: "Live Vending Center Pickup",
    color: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    badgeBorder: "rgba(245, 158, 11, 0.35)",
    badgeText: "#fbbf24",
    description: "Outside doorstep express perimeter. 100% free live harvest pickup at our Malabagh Farm.",
  },
};

// Comprehensive list of Srinagar localities with distances from Malabagh Farm Hub
export const SRINAGAR_LOCALITY_CATALOG: LocalityData[] = [
  // ─── ZONE 1 (0 to 4.0 km — Free from 2 kg) ───
  { name: "Malabagh", aliases: ["malabagh", "mallabagh", "malla bagh", "mala bagh"], lat: 34.1485, lng: 74.8210, pincode: "190006", distKm: 0.2, tier: "zone1", minKgFree: 2 },
  { name: "Naseem Bagh", aliases: ["naseem bagh", "naseembagh", "nasim bagh", "nasimbagh"], lat: 34.1450, lng: 74.8250, pincode: "190006", distKm: 0.3, tier: "zone1", minKgFree: 2 },
  { name: "Mirza Bagh", aliases: ["mirza bagh", "mirzabagh"], lat: 34.1465, lng: 74.8230, pincode: "190006", distKm: 0.5, tier: "zone1", minKgFree: 2 },
  { name: "Hafiz Bagh", aliases: ["hafiz bagh", "hafizabagh"], lat: 34.1470, lng: 74.8190, pincode: "190006", distKm: 0.7, tier: "zone1", minKgFree: 2 },
  { name: "Baghati Shoora", aliases: ["baghati shoora", "baghati", "shoor"], lat: 34.1430, lng: 74.8180, pincode: "190006", distKm: 1.0, tier: "zone1", minKgFree: 2 },
  { name: "Shah Faisal Colony", aliases: ["shah faisal colony", "shah faisal"], lat: 34.1490, lng: 74.8290, pincode: "190006", distKm: 1.1, tier: "zone1", minKgFree: 2 },
  { name: "Tajdar Colony", aliases: ["tajdar colony", "tajdar"], lat: 34.1510, lng: 74.8280, pincode: "190006", distKm: 1.2, tier: "zone1", minKgFree: 2 },
  { name: "Hamza Colony", aliases: ["hamza colony", "hamzacolony"], lat: 34.1420, lng: 74.8290, pincode: "190006", distKm: 1.2, tier: "zone1", minKgFree: 2 },
  { name: "Awanta Bhawan", aliases: ["awanta bhawan", "awantabhawan"], lat: 34.1400, lng: 74.8150, pincode: "190011", distKm: 1.3, tier: "zone1", minKgFree: 2 },
  { name: "Zakura", aliases: ["zakura", "zakoora", "zakura crossing", "zakura industrial area"], lat: 34.1610, lng: 74.8220, pincode: "190024", distKm: 1.4, tier: "zone1", minKgFree: 2 },
  { name: "Illahi Bagh", aliases: ["illahi bagh", "illahibagh", "ellahi bagh", "ellahibagh"], lat: 34.1380, lng: 74.8120, pincode: "190011", distKm: 1.5, tier: "zone1", minKgFree: 2 },
  { name: "90 Feet Road", aliases: ["90 feet", "90ft", "90 feet road", "ninety feet"], lat: 34.1360, lng: 74.8100, pincode: "190011", distKm: 1.6, tier: "zone1", minKgFree: 2 },
  { name: "Sadrebal", aliases: ["sadrebal", "saderbal", "sadrabal"], lat: 34.1330, lng: 74.8340, pincode: "190006", distKm: 1.7, tier: "zone1", minKgFree: 2 },
  { name: "Habak", aliases: ["habak", "habbak", "habak crossing", "habak dal"], lat: 34.1420, lng: 74.8430, pincode: "190006", distKm: 1.8, tier: "zone1", minKgFree: 2 },
  { name: "Lal Bazar", aliases: ["lal bazar", "lalbazar", "molvi stop", "bota kadal"], lat: 34.1210, lng: 74.8160, pincode: "190011", distKm: 2.0, tier: "zone1", minKgFree: 2 },
  { name: "Ahmad Nagar", aliases: ["ahmad nagar", "ahmed nagar", "ahmadnagar"], lat: 34.1550, lng: 74.8110, pincode: "190020", distKm: 2.0, tier: "zone1", minKgFree: 2 },
  { name: "Kashmir University", aliases: ["kashmir university", "ku campus", "university campus"], lat: 34.1300, lng: 74.8370, pincode: "190006", distKm: 2.0, tier: "zone1", minKgFree: 2 },
  { name: "Buchpora", aliases: ["buchpora", "bachpora", "buch pora", "bach pora"], lat: 34.1460, lng: 74.7950, pincode: "190020", distKm: 2.1, tier: "zone1", minKgFree: 2 },
  { name: "Hazratbal", aliases: ["hazratbal", "hazrat bal", "dargah", "dargah hazratbal"], lat: 34.1265, lng: 74.8425, pincode: "190006", distKm: 2.2, tier: "zone1", minKgFree: 2 },
  { name: "Soura / SKIMS", aliases: ["soura", "skims", "skims soura", "soura hospital"], lat: 34.1350, lng: 74.8010, pincode: "190011", distKm: 2.2, tier: "zone1", minKgFree: 2 },
  { name: "Umer Colony", aliases: ["umer colony", "omar colony", "umar colony a", "umar colony b"], lat: 34.1360, lng: 74.8210, pincode: "190011", distKm: 2.2, tier: "zone1", minKgFree: 2 },
  { name: "Nowshera", aliases: ["nowshera", "nowshehra", "now shera"], lat: 34.1180, lng: 74.8090, pincode: "190011", distKm: 2.4, tier: "zone1", minKgFree: 2 },
  { name: "Anchar", aliases: ["anchar", "anchar lake", "soura anchar"], lat: 34.1400, lng: 74.7900, pincode: "190011", distKm: 2.5, tier: "zone1", minKgFree: 2 },
  { name: "Nigeen", aliases: ["nigeen", "nagin", "nigeen lake", "nagin club"], lat: 34.1190, lng: 74.8300, pincode: "190006", distKm: 2.8, tier: "zone1", minKgFree: 2 },
  { name: "Bagh Ali Mardan Khan", aliases: ["bagh ali mardan khan", "ali mardan khan", "bagh ali mardan"], lat: 34.1190, lng: 74.8010, pincode: "190011", distKm: 2.9, tier: "zone1", minKgFree: 2 },
  { name: "Zoonimar", aliases: ["zoonimar", "zooni mar"], lat: 34.1150, lng: 74.8050, pincode: "190011", distKm: 3.3, tier: "zone1", minKgFree: 2 },
  { name: "Tailbal", aliases: ["tailbal", "teilbal", "tailbal road", "habak shanpora"], lat: 34.1520, lng: 74.8620, pincode: "190006", distKm: 3.3, tier: "zone1", minKgFree: 2 },
  { name: "Gulab Bagh", aliases: ["gulab bagh", "gulabbagh"], lat: 34.1610, lng: 74.8320, pincode: "190006", distKm: 3.6, tier: "zone1", minKgFree: 2 },
  { name: "Pandach", aliases: ["pandach", "pandacha", "pandach crossing"], lat: 34.1750, lng: 74.8180, pincode: "190024", distKm: 3.6, tier: "zone1", minKgFree: 2 },
  { name: "Zadibal", aliases: ["zadibal", "zadi bal", "khanyar zadibal"], lat: 34.1100, lng: 74.8080, pincode: "190011", distKm: 4.0, tier: "zone1", minKgFree: 2 },

  // ─── ZONE 2 (4.0 to 6.0 km — Free from 3 kg) ───
  { name: "Badamwari", aliases: ["badamwari", "badam wari", "badamwari garden"], lat: 34.1050, lng: 74.8150, pincode: "190003", distKm: 4.2, tier: "zone2", minKgFree: 3 },
  { name: "Alamgari Bazar", aliases: ["alamgari bazar", "alamgari bazaar", "alamgaribazar"], lat: 34.1080, lng: 74.8170, pincode: "190002", distKm: 4.3, tier: "zone2", minKgFree: 3 },
  { name: "Nagbal", aliases: ["nagbal", "nagbal crossing", "nagbal ganderbal"], lat: 34.1850, lng: 74.8210, pincode: "190024", distKm: 4.3, tier: "zone2", minKgFree: 3 },
  { name: "Saida Kadal", aliases: ["saida kadal", "saidakadal", "saida kadal bridge"], lat: 34.1090, lng: 74.8320, pincode: "190003", distKm: 4.3, tier: "zone2", minKgFree: 3 },
  { name: "Burzahama", aliases: ["burzahama", "burzuhama", "burza hama"], lat: 34.1680, lng: 74.8620, pincode: "190006", distKm: 4.3, tier: "zone2", minKgFree: 3 },
  { name: "Hawal", aliases: ["hawal", "hawal chowk", "hawal srinagar", "mirwaiz manzil"], lat: 34.1100, lng: 74.8130, pincode: "190002", distKm: 4.6, tier: "zone2", minKgFree: 3 },
  { name: "Alusteng", aliases: ["alusteng", "alustang", "aloo steng"], lat: 34.1890, lng: 74.8250, pincode: "190024", distKm: 4.6, tier: "zone2", minKgFree: 3 },
  { name: "Eidgah", aliases: ["eidgah", "idgah", "eid gah", "aali masjid"], lat: 34.1050, lng: 74.7950, pincode: "190002", distKm: 4.6, tier: "zone2", minKgFree: 3 },
  { name: "Gojwara", aliases: ["gojwara", "goj wara", "gojwara chowk"], lat: 34.1000, lng: 74.8120, pincode: "190002", distKm: 5.0, tier: "zone2", minKgFree: 3 },
  { name: "Shuhama", aliases: ["shuhama", "shuhama skuast"], lat: 34.1950, lng: 74.8260, pincode: "190024", distKm: 5.0, tier: "zone2", minKgFree: 3 },
  { name: "Nowhatta", aliases: ["nowhatta", "nau hatta", "jamia masjid"], lat: 34.0980, lng: 74.8140, pincode: "190002", distKm: 5.3, tier: "zone2", minKgFree: 3 },
  { name: "Safakadal", aliases: ["safakadal", "safa kadal", "sufakadal"], lat: 34.0950, lng: 74.7950, pincode: "190002", distKm: 5.4, tier: "zone2", minKgFree: 3 },
  { name: "Rainawari", aliases: ["rainawari", "raina wari", "jlnm hospital", "naidyar"], lat: 34.0980, lng: 74.8280, pincode: "190003", distKm: 5.4, tier: "zone2", minKgFree: 3 },
  { name: "Khanyar", aliases: ["khanyar", "khan yar", "dastgeer sahib"], lat: 34.0930, lng: 74.8190, pincode: "190003", distKm: 5.5, tier: "zone2", minKgFree: 3 },
  { name: "Shalimar", aliases: ["shalimar", "shalimar bagh", "shalimar garden"], lat: 34.1480, lng: 74.8720, pincode: "190025", distKm: 5.5, tier: "zone2", minKgFree: 3 },
  { name: "Ali Kadal", aliases: ["ali kadal", "alikadal", "ali kadel"], lat: 34.0920, lng: 74.8050, pincode: "190002", distKm: 5.8, tier: "zone2", minKgFree: 3 },

  // ─── ZONE 3 (6.0 to 8.0 km — Free from 4 kg) ───
  { name: "Dalgate & Boulevard", aliases: ["dalgate", "dal gate", "boulevard", "nehru park", "boulevard road", "gate 1"], lat: 34.0840, lng: 74.8320, pincode: "190001", distKm: 7.0, tier: "zone3", minKgFree: 4 },
  { name: "Lal Chowk", aliases: ["lal chowk", "lalchowk", "clock tower", "ghanta ghar", "residency road", "regal chowk", "maisuma"], lat: 34.0725, lng: 74.8090, pincode: "190001", distKm: 7.2, tier: "zone3", minKgFree: 4 },
  { name: "Qamarwari", aliases: ["qamarwari", "qamar wari", "kamarwari", "qamarwari chowk"], lat: 34.0880, lng: 74.7780, pincode: "190010", distKm: 7.4, tier: "zone3", minKgFree: 4 },
  { name: "Batamaloo", aliases: ["batamaloo", "batamalo", "batmaloo"], lat: 34.0740, lng: 74.7920, pincode: "190009", distKm: 7.5, tier: "zone3", minKgFree: 4 },
  { name: "Rajbagh", aliases: ["rajbagh", "raj bagh", "zero bridge", "kursoo rajbagh"], lat: 34.0680, lng: 74.8240, pincode: "190008", distKm: 7.6, tier: "zone3", minKgFree: 4 },
  { name: "Jawahar Nagar", aliases: ["jawahar nagar", "jawaharnagar"], lat: 34.0580, lng: 74.8170, pincode: "190008", distKm: 7.8, tier: "zone3", minKgFree: 4 },
  { name: "Sonwar", aliases: ["sonwar", "sonawar", "sona war", "sonwar bazar"], lat: 34.0700, lng: 74.8390, pincode: "190004", distKm: 7.8, tier: "zone3", minKgFree: 4 },

  // ─── OUT OF ZONE (> 8.0 km — Counter Pickup) ───
  { name: "Bemina", aliases: ["bemina", "sd colony", "hamdania colony", "bemina byepass"], lat: 34.0850, lng: 74.7680, pincode: "190018", distKm: 8.8, tier: "out_of_zone", minKgFree: 0 },
  { name: "Nishat", aliases: ["nishat", "nishat bagh", "brein", "brain"], lat: 34.1230, lng: 74.8780, pincode: "190019", distKm: 9.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Harwan", aliases: ["harwan", "harwan garden", "dara"], lat: 34.1650, lng: 74.8980, pincode: "190023", distKm: 9.5, tier: "out_of_zone", minKgFree: 0 },
  { name: "Sanat Nagar", aliases: ["sanat nagar", "sanatnagar"], lat: 34.0320, lng: 74.7950, pincode: "190005", distKm: 11.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Hyderpora", aliases: ["hyderpora", "hyder pora", "hyderpora flyover"], lat: 34.0370, lng: 74.7820, pincode: "190014", distKm: 12.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Peerbagh", aliases: ["peerbagh", "peer bagh", "pirbagh"], lat: 34.0250, lng: 74.7800, pincode: "190014", distKm: 13.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Airport Road / Humhama", aliases: ["airport road", "humhama", "srinagar airport"], lat: 34.0150, lng: 74.7750, pincode: "190014", distKm: 14.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Rawalpora", aliases: ["rawalpora", "rawapora"], lat: 34.0290, lng: 74.7880, pincode: "190005", distKm: 12.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Chanapora", aliases: ["chanapora", "chanpora"], lat: 34.0400, lng: 74.8050, pincode: "190015", distKm: 11.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Ganderbal Town", aliases: ["ganderbal", "ganderbal town", "beehama"], lat: 34.2160, lng: 74.7780, pincode: "191201", distKm: 12.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Budgam", aliases: ["budgam", "ompora"], lat: 34.0180, lng: 74.7250, pincode: "191111", distKm: 16.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Pampore", aliases: ["pampore", "pantha chowk"], lat: 34.0200, lng: 74.9100, pincode: "192121", distKm: 16.0, tier: "out_of_zone", minKgFree: 0 },
];

// Haversine distance formula in km
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface DeliveryCheckResult {
  isDeliverable: boolean;
  tier: "zone1" | "zone2" | "zone3" | "out_of_zone";
  zoneConfig: ZoneConfig;
  distanceKm: number;
  matchedLocality?: LocalityData;
  localityDisplayName: string;
  minKgFree: number;
  deliveryFee: number;
  isFreeDelivery: boolean;
  statusHeadline: string;
  deliveryMessage: string;
  upgradeAdvice?: string;
  savingsAmount?: number;
}

// Evaluate delivery zone from text search or GPS coordinates and optional weight
export function evaluateDeliveryZone(params: {
  localityInput?: string;
  coords?: { lat: number; lng: number } | null;
  weightKg?: number;
}): DeliveryCheckResult {
  const { localityInput = "", coords, weightKg = 2 } = params;
  let dist = 0;
  let matchedLoc: LocalityData | undefined;
  let displayName = "";

  // 1. If GPS coordinates provided, use exact distance
  if (coords && coords.lat && coords.lng) {
    dist = calculateDistance(FARM_COORDS.lat, FARM_COORDS.lng, coords.lat, coords.lng);
    // Find closest landmark for a nice name
    let closestDist = Infinity;
    for (const loc of SRINAGAR_LOCALITY_CATALOG) {
      const d = calculateDistance(coords.lat, coords.lng, loc.lat, loc.lng);
      if (d < closestDist) {
        closestDist = d;
        matchedLoc = loc;
      }
    }
    displayName = matchedLoc ? `Near ${matchedLoc.name}` : "Your GPS Location";
  } else if (localityInput.trim()) {
    // 2. Intelligent search across names and aliases
    const q = localityInput.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");

    // Exact name match
    matchedLoc = SRINAGAR_LOCALITY_CATALOG.find(
      (loc) => loc.name.toLowerCase() === q || loc.aliases.some((a) => a === q)
    );

    // Substring / word match
    if (!matchedLoc) {
      matchedLoc = SRINAGAR_LOCALITY_CATALOG.find((loc) =>
        loc.aliases.some((a) => q.includes(a) || a.includes(q))
      );
    }

    if (matchedLoc) {
      dist = matchedLoc.distKm;
      displayName = matchedLoc.name;
    } else {
      // Unrecognized locality fallback: assume inside Srinagar city zone 3 (~6.5km)
      dist = 6.5;
      displayName = localityInput.trim();
    }
  } else {
    // Default fallback
    dist = 2.0;
    matchedLoc = SRINAGAR_LOCALITY_CATALOG[0];
    displayName = "Malabagh & Nearby";
  }

  // Determine tier based on exact distance
  let tierId: "zone1" | "zone2" | "zone3" | "out_of_zone";
  if (dist <= 4.0) {
    tierId = "zone1";
  } else if (dist <= 6.0) {
    tierId = "zone2";
  } else if (dist <= 8.0) {
    tierId = "zone3";
  } else {
    tierId = "out_of_zone";
  }

  const zoneConfig = DELIVERY_ZONES[tierId];
  const isDeliverable = tierId !== "out_of_zone";
  const minKg = zoneConfig.minKgFree;

  // Calculate delivery fee
  let fee = 0;
  let upgradeAdvice: string | undefined;
  let savingsAmount: number | undefined;

  if (!isDeliverable) {
    fee = 0;
  } else if (weightKg >= minKg) {
    fee = 0;
  } else {
    fee = zoneConfig.specialDeliveryFee;
    const neededKg = minKg - weightKg;
    upgradeAdvice = `Upgrade by +${neededKg} kg to get 100% FREE doorstep delivery and save ₹${fee} in delivery fees!`;
    savingsAmount = fee;
  }

  const isFreeDelivery = isDeliverable && fee === 0;

  // Build headline and message
  let statusHeadline = "";
  let deliveryMessage = "";

  if (tierId === "zone1") {
    statusHeadline = `✓ 100% Free Doorstep Delivery from 2 kg (~${dist.toFixed(1)} km)`;
    deliveryMessage = `Deliverable within 90–120 minutes in food-grade bio-thermal crushed ice. Free on 2+ kg, or ₹${fee} special fee for smaller orders.`;
  } else if (tierId === "zone2") {
    statusHeadline = `✓ Doorstep Delivery Available — Free from 3 kg (~${dist.toFixed(1)} km)`;
    deliveryMessage = `Deliverable within 2 hours. Free delivery on family pack (3+ kg), or ₹${fee} special delivery fee for smaller orders.`;
  } else if (tierId === "zone3") {
    statusHeadline = `✓ Extended City Delivery — Free from 4 kg (~${dist.toFixed(1)} km)`;
    deliveryMessage = `Deliverable within 2 hours. Free delivery on 4+ kg, or ₹${fee} special delivery fee for 1–3 kg.`;
  } else {
    statusHeadline = `📍 Outside 8 km Express Delivery Perimeter (~${dist.toFixed(1)} km)`;
    deliveryMessage = `To ensure live-harvest cold chain integrity within 2 hours, doorstep delivery is restricted to 8 km. You are warmly welcome to pick up fresh live catch directly from our Live Vending Center in Malabagh with ZERO delivery fee!`;
  }

  return {
    isDeliverable,
    tier: tierId,
    zoneConfig,
    distanceKm: dist,
    matchedLocality: matchedLoc,
    localityDisplayName: displayName,
    minKgFree: minKg,
    deliveryFee: fee,
    isFreeDelivery,
    statusHeadline,
    deliveryMessage,
    upgradeAdvice,
    savingsAmount,
  };
}
