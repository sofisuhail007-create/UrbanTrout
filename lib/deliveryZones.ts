// Srinagar Locality Intelligence & Tiered Delivery Zones
// Synchronized with Urban Trout Sales Agent (OSM-verified coordinates from Malabagh Farm Hub)
import { resolveLocationFromText, resolveLocationFromCoords } from "./geolocationEngine";

export interface LocalityData {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
  pincode: string;
  distKm: number;
  tier: "zone1" | "zone2" | "zone3" | "zone4" | "out_of_zone";
  minKgFree: number;
}

export const FARM_COORDS = {
  lat: 34.144709,
  lng: 74.824525,
  name: "Urban Trout Aquaculture Farm Hub, Malabagh",
  address: "Near R.P. School Girls Wing, Malabagh, Srinagar 190006",
  mapsUrl: "https://maps.app.goo.gl/6FT5iLk5n8mbKSRU9",
};

export const MAX_DELIVERY_RADIUS_KM = 16.0;

export interface ZoneConfig {
  id: "zone1" | "zone2" | "zone3" | "zone4" | "out_of_zone";
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
    specialDeliveryFee: 45,
    deliveryTime: "Within 90–120 mins",
    color: "#22c55e",
    badgeBg: "rgba(34, 197, 94, 0.15)",
    badgeBorder: "rgba(34, 197, 94, 0.35)",
    badgeText: "#4ade80",
    description: "100% FREE express delivery on min 2 kg (or ₹45 delivery fee for 1 kg).",
  },
  zone2: {
    id: "zone2",
    title: "Zone 2: Mid-City Zone",
    shortLabel: "4 – 7 km",
    rangeKm: "4.0 – 7.0 km",
    minKgFree: 3,
    minOrderFreeText: "3 kg",
    specialDeliveryFee: 55,
    deliveryTime: "Within 2 hours",
    color: "#38bdf8",
    badgeBg: "rgba(56, 189, 248, 0.15)",
    badgeBorder: "rgba(56, 189, 248, 0.35)",
    badgeText: "#7dd3fc",
    description: "100% FREE express delivery on min 3 kg (or ₹55 delivery fee for 2 kg, ₹75 for 1 kg).",
  },
  zone3: {
    id: "zone3",
    title: "Zone 3: Greater Srinagar Zone",
    shortLabel: "7 – 11.5 km",
    rangeKm: "7.0 – 11.5 km",
    minKgFree: 3,
    minOrderFreeText: "3 kg",
    specialDeliveryFee: 89,
    deliveryTime: "Within 2 hours",
    color: "#a855f7",
    badgeBg: "rgba(168, 85, 247, 0.15)",
    badgeBorder: "rgba(168, 85, 247, 0.35)",
    badgeText: "#c084fc",
    description: "100% FREE express delivery on min 3 kg (or ₹89 delivery fee for 2 kg, ₹130 for 1 kg).",
  },
  zone4: {
    id: "zone4",
    title: "Zone 4: South Corridor & Cross-City Srinagar",
    shortLabel: "11.5 – 16 km",
    rangeKm: "11.5 – 16.0 km",
    minKgFree: 5,
    minOrderFreeText: "5 kg",
    specialDeliveryFee: 139,
    deliveryTime: "Within 2 hours",
    color: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    badgeBorder: "rgba(245, 158, 11, 0.35)",
    badgeText: "#fbbf24",
    description: "100% FREE express delivery on 5 kg family pack (or ₹109 for 4 kg, ₹129 for 3 kg, ₹139 for 2 kg, ₹190 for 1 kg).",
  },
  out_of_zone: {
    id: "out_of_zone",
    title: "Beyond 16 km Perimeter",
    shortLabel: "> 16 km",
    rangeKm: "Beyond 16.0 km",
    minKgFree: 0,
    minOrderFreeText: "Counter Pickup",
    specialDeliveryFee: 0,
    deliveryTime: "Live Vending Center Pickup",
    color: "#ef4444",
    badgeBg: "rgba(239, 68, 68, 0.15)",
    badgeBorder: "rgba(239, 68, 68, 0.35)",
    badgeText: "#f87171",
    description: "Outside 16 km express delivery perimeter. 100% free live harvest pickup at our Malabagh Farm.",
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
  { name: "Hazratbal", aliases: ["hazratbal", "hazrat bal", "dargah", "dargah hazratbal"], lat: 34.1303, lng: 74.8428, pincode: "190006", distKm: 2.2, tier: "zone1", minKgFree: 2 },
  { name: "Batpora", aliases: ["batpora", "batapora", "fazalhaq colony", "chinar lane"], lat: 34.1592, lng: 74.8449, pincode: "190006", distKm: 2.5, tier: "zone1", minKgFree: 2 },
  { name: "NIT Srinagar", aliases: ["nit srinagar", "nit", "national institute of technology"], lat: 34.1265, lng: 74.8425, pincode: "190006", distKm: 2.6, tier: "zone1", minKgFree: 2 },
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
  { name: "Nagbal", aliases: ["nagbal", "nagbal crossing"], lat: 34.1850, lng: 74.8210, pincode: "190024", distKm: 4.3, tier: "zone2", minKgFree: 3 },
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
  { name: "Rajouri Kadal", aliases: ["rajouri kadal", "rajourikadal", "rajouri kadel"], lat: 34.0950, lng: 74.8100, pincode: "190002", distKm: 6.2, tier: "zone2", minKgFree: 3 },
  { name: "Saraf Kadal", aliases: ["saraf kadal", "sarafkadal"], lat: 34.0910, lng: 74.8080, pincode: "190002", distKm: 6.5, tier: "zone2", minKgFree: 3 },
  { name: "Bohri Kadal", aliases: ["bohri kadal", "bohrikadal", "bhori kadal", "bhorikadal"], lat: 34.0920, lng: 74.8110, pincode: "190002", distKm: 6.8, tier: "zone2", minKgFree: 3 },

  // ─── ZONE 3 (7.0 to 11.5 km — Greater Srinagar, Free from 3 kg) ───
  { name: "Zaina Kadal", aliases: ["zaina kadal", "zainakadal", "zaina kadel", "new zaina kadal"], lat: 34.0900, lng: 74.8060, pincode: "190002", distKm: 7.8, tier: "zone3", minKgFree: 3 },
  { name: "Maharaj Gunj", aliases: ["maharaj gunj", "maharajgunj", "maharaj ganj", "maharajganj"], lat: 34.0890, lng: 74.8090, pincode: "190002", distKm: 7.8, tier: "zone3", minKgFree: 3 },
  { name: "Fateh Kadal", aliases: ["fateh kadal", "fatehkadal", "fateh kadel", "fatehkadel", "astaan syed ali akbar"], lat: 34.0868, lng: 74.8045, pincode: "190002", distKm: 8.8, tier: "zone3", minKgFree: 3 },
  { name: "Habba Kadal", aliases: ["habba kadal", "habbakadal", "habba kadel"], lat: 34.0820, lng: 74.8100, pincode: "190001", distKm: 9.0, tier: "zone3", minKgFree: 3 },
  { name: "Khayam", aliases: ["khayam", "khayyam", "khyam", "khaiam", "khayam chowk", "khayyam chowk", "khyber hospital"], lat: 34.0810, lng: 74.8180, pincode: "190001", distKm: 7.2, tier: "zone3", minKgFree: 3 },
  { name: "Dalgate & Boulevard", aliases: ["dalgate", "dal gate", "boulevard", "nehru park", "boulevard road", "gate 1"], lat: 34.0840, lng: 74.8320, pincode: "190001", distKm: 7.0, tier: "zone3", minKgFree: 3 },
  { name: "Lal Chowk", aliases: ["lal chowk", "lalchowk", "clock tower", "ghanta ghar", "residency road", "regal chowk", "maisuma"], lat: 34.0725, lng: 74.8090, pincode: "190001", distKm: 7.2, tier: "zone3", minKgFree: 3 },
  { name: "Qamarwari", aliases: ["qamarwari", "qamar wari", "kamarwari", "qamarwari chowk"], lat: 34.0880, lng: 74.7780, pincode: "190010", distKm: 9.5, tier: "zone3", minKgFree: 3 },
  { name: "Nishat", aliases: ["nishat", "nishat bagh", "brein", "brain"], lat: 34.1230, lng: 74.8780, pincode: "190019", distKm: 8.0, tier: "zone3", minKgFree: 3 },
  { name: "Harwan", aliases: ["harwan", "harwan garden", "dara"], lat: 34.1650, lng: 74.8980, pincode: "190023", distKm: 9.5, tier: "zone3", minKgFree: 3 },

  // ─── ZONE 4 (11.5 to 16.0 km — South Corridor, Rajbagh, Jawahar Nagar, Batamaloo, Sanat Nagar, Peerbagh, Airport Rd, Nowgam — Free from 5 kg) ───
  { name: "Batamaloo", aliases: ["batamaloo", "batamalo", "batmaloo"], lat: 34.0740, lng: 74.7920, pincode: "190009", distKm: 11.8, tier: "zone4", minKgFree: 5 },
  { name: "Jawahar Nagar", aliases: ["jawahar nagar", "jawaharnagar"], lat: 34.0580, lng: 74.8170, pincode: "190008", distKm: 11.8, tier: "zone4", minKgFree: 5 },
  { name: "Rajbagh", aliases: ["rajbagh", "raj bagh", "zero bridge", "kursoo rajbagh"], lat: 34.0680, lng: 74.8240, pincode: "190008", distKm: 12.0, tier: "zone4", minKgFree: 5 },
  { name: "Wazir Bagh", aliases: ["wazir bagh", "wazirbagh"], lat: 34.0670, lng: 74.8150, pincode: "190008", distKm: 12.7, tier: "zone4", minKgFree: 5 },
  { name: "Sonwar", aliases: ["sonwar", "sonawar", "sona war", "sonwar bazar"], lat: 34.0700, lng: 74.8390, pincode: "190004", distKm: 12.9, tier: "zone4", minKgFree: 5 },
  { name: "Bemina", aliases: ["bemina", "sd colony", "hamdania colony", "bemina byepass"], lat: 34.0850, lng: 74.7680, pincode: "190018", distKm: 12.5, tier: "zone4", minKgFree: 5 },
  { name: "Natipora", aliases: ["natipora", "nati pora"], lat: 34.0450, lng: 74.8080, pincode: "190015", distKm: 12.5, tier: "zone4", minKgFree: 5 },
  { name: "Chanapora", aliases: ["chanapora", "chanpora"], lat: 34.0400, lng: 74.8050, pincode: "190015", distKm: 13.0, tier: "zone4", minKgFree: 5 },
  { name: "Barzulla / Baghat", aliases: ["barzulla", "baghat", "baghat barzulla"], lat: 34.0420, lng: 74.7920, pincode: "190005", distKm: 14.2, tier: "zone4", minKgFree: 5 },
  { name: "Sanat Nagar", aliases: ["sanat nagar", "sanatnagar"], lat: 34.0320, lng: 74.7950, pincode: "190005", distKm: 13.5, tier: "zone4", minKgFree: 5 },
  { name: "Hyderpora", aliases: ["hyderpora", "hyder pora", "hyderpora flyover"], lat: 34.0370, lng: 74.7820, pincode: "190014", distKm: 14.5, tier: "zone4", minKgFree: 5 },
  { name: "Rawalpora", aliases: ["rawalpora", "rawapora"], lat: 34.0290, lng: 74.7880, pincode: "190005", distKm: 14.0, tier: "zone4", minKgFree: 5 },
  { name: "Peerbagh", aliases: ["peerbagh", "peer bagh", "pirbagh"], lat: 34.0250, lng: 74.7800, pincode: "190014", distKm: 14.5, tier: "zone4", minKgFree: 5 },
  { name: "Airport Road / Humhama", aliases: ["airport road", "humhama", "srinagar airport"], lat: 34.0150, lng: 74.7750, pincode: "190014", distKm: 15.0, tier: "zone4", minKgFree: 5 },
  { name: "Lasjan", aliases: ["lasjan", "lassjan"], lat: 34.0200, lng: 74.8450, pincode: "190015", distKm: 14.0, tier: "zone4", minKgFree: 5 },
  { name: "Nowgam", aliases: ["nowgam", "naugaon", "nowgham", "nowgam bypass"], lat: 34.0100, lng: 74.8250, pincode: "190015", distKm: 14.5, tier: "zone4", minKgFree: 5 },
  { name: "Pantha Chowk", aliases: ["pantha chowk", "panthachowk"], lat: 34.0280, lng: 74.8850, pincode: "191101", distKm: 14.0, tier: "zone4", minKgFree: 5 },
  { name: "Athwajan", aliases: ["athwajan"], lat: 34.0320, lng: 74.8700, pincode: "190004", distKm: 13.5, tier: "zone4", minKgFree: 5 },
  { name: "Bagh-e-Mehtab", aliases: ["bagh-e-mehtab", "baghi mehtab"], lat: 34.0200, lng: 74.7950, pincode: "190019", distKm: 14.0, tier: "zone4", minKgFree: 5 },
  { name: "Rangreth", aliases: ["rangreth", "sidco rangreth"], lat: 34.0050, lng: 74.7900, pincode: "190007", distKm: 15.5, tier: "zone4", minKgFree: 5 },
  { name: "HMT / Zainakote", aliases: ["hmt", "zainakote", "mustafabad"], lat: 34.1000, lng: 74.7300, pincode: "190012", distKm: 15.0, tier: "zone4", minKgFree: 5 },

  // ─── OUT OF ZONE (> 16.0 km & Outer Districts — Counter Pickup) ───
  { name: "Ganderbal District", aliases: ["ganderbal", "ganderbal town", "beehama", "duderhama", "saloora", "tullamulla", "kangan", "wayil", "manigam", "safapora"], lat: 34.2160, lng: 74.7780, pincode: "191201", distKm: 12.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Budgam", aliases: ["budgam", "ompora"], lat: 34.0180, lng: 74.7250, pincode: "191111", distKm: 16.5, tier: "out_of_zone", minKgFree: 0 },
  { name: "Pampore", aliases: ["pampore", "saffron town"], lat: 34.0200, lng: 74.9100, pincode: "192121", distKm: 17.0, tier: "out_of_zone", minKgFree: 0 },
  { name: "Chadoora", aliases: ["chadoora", "chadure"], lat: 33.9500, lng: 74.8000, pincode: "191113", distKm: 19.0, tier: "out_of_zone", minKgFree: 0 },
];

// Haversine distance formula with Srinagar Road Winding Calibration (Same as AI Agent)
// Converts straight-line aerial distance into actual driving road distance:
// Direct local routes <=4km have ~1.10x factor; routes >4km across Dal Lake / Jhelum bridges have ~1.32x road winding factor.
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  const aerial = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadFactor = aerial <= 4.0 ? 1.10 : 1.32;
  return aerial * roadFactor;
}

export interface DeliveryCheckResult {
  isDeliverable: boolean;
  tier: "zone1" | "zone2" | "zone3" | "zone4" | "out_of_zone";
  zoneConfig: ZoneConfig;
  distanceKm: number;
  matchedLocality?: LocalityData;
  localityDisplayName: string;
  minKgFree: number;
  deliveryFee: number;
  baseDeliveryFee: number;
  isEveningRush: boolean;
  eveningSurcharge: number;
  isFreeDelivery: boolean;
  statusHeadline: string;
  deliveryMessage: string;
  upgradeAdvice?: string;
  savingsAmount?: number;
}

/**
 * Returns true if the current time in IST is between 4:00 PM and 7:59 PM (16:00 – 19:59).
 * During this peak rush hour window, dispatch demand surges across Srinagar,
 * so a +₹40 evening rush surcharge is applied to sub-minimum express deliveries (matching AI agent).
 * Free delivery thresholds (e.g. 5 kg in Zone 4, 3 kg in Zone 2/3, 2 kg in Zone 1) remain 100% Free!
 */
export function isEveningRushHour(date?: Date): boolean {
  const now = date ?? new Date();
  const istOffset = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const hour = istDate.getUTCHours();
  return hour >= 16 && hour < 20;
}

// Evaluate delivery zone from text search or GPS coordinates and optional weight
export function evaluateDeliveryZone(params: {
  localityInput?: string;
  coords?: { lat: number; lng: number } | null;
  weightKg?: number;
  now?: Date;
}): DeliveryCheckResult {
  const { localityInput = "", coords, weightKg = 2, now } = params;
  let dist = 0;
  let matchedLoc: LocalityData | undefined;
  let isDeliverable = false;
  let displayName = "";

  // 1. If GPS coordinates provided, use exact distance
  if (coords && coords.lat && coords.lng) {
    const geo = resolveLocationFromCoords(coords.lat, coords.lng, weightKg);
    dist = geo.dist;
    displayName = geo.name;
    isDeliverable = geo.isDeliverable;
  } else if (localityInput.trim()) {
    // 2. Intelligent multi-tier search across 75+ core and 451 local database
    const geo = resolveLocationFromText(localityInput, weightKg);
    dist = geo.dist;
    displayName = geo.name;
    isDeliverable = geo.isDeliverable;
  } else {
    // Default fallback
    dist = 2.0;
    matchedLoc = SRINAGAR_LOCALITY_CATALOG[0];
    displayName = "Malabagh & Nearby";
    isDeliverable = true;
  }

  // Determine tier based on exact distance
  let tierId: "zone1" | "zone2" | "zone3" | "zone4" | "out_of_zone";
  if (dist <= 4.0) {
    tierId = "zone1";
  } else if (dist <= 7.0) {
    tierId = "zone2";
  } else if (dist <= 11.5) {
    tierId = "zone3";
  } else if (dist <= 16.0) {
    tierId = "zone4";
  } else {
    tierId = "out_of_zone";
  }

  const zoneConfig = DELIVERY_ZONES[tierId];
  if (tierId === "out_of_zone") {
    isDeliverable = false;
  } else {
    isDeliverable = true;
  }
  const minKg = zoneConfig.minKgFree;

  // Calculate delivery fee based on 4-tier model
  let fee = 0;
  let upgradeAdvice: string | undefined;
  let savingsAmount: number | undefined;

  if (!isDeliverable) {
    fee = 0;
  } else if (tierId === "zone1") {
    fee = weightKg >= 2 ? 0 : 45;
    if (fee > 0) {
      upgradeAdvice = `Add +${2 - weightKg} kg to get 100% FREE express delivery and save ₹45!`;
      savingsAmount = fee;
    }
  } else if (tierId === "zone2") {
    if (weightKg >= 3) {
      fee = 0;
    } else if (weightKg >= 2) {
      fee = 55;
      upgradeAdvice = `Add +1 kg to get 100% FREE express delivery and save ₹55!`;
      savingsAmount = fee;
    } else {
      fee = 75;
      upgradeAdvice = `Upgrade to 2 kg for lower ₹55 delivery fee, or 3 kg for 100% FREE delivery!`;
      savingsAmount = fee;
    }
  } else if (tierId === "zone3") {
    if (weightKg >= 3) {
      fee = 0;
    } else if (weightKg >= 2) {
      fee = 89;
      upgradeAdvice = `Add +1 kg to get 100% FREE express delivery and save ₹89!`;
      savingsAmount = fee;
    } else {
      fee = 130;
      upgradeAdvice = `Upgrade to 2 kg for lower ₹89 delivery fee, or 3 kg for 100% FREE delivery!`;
      savingsAmount = fee;
    }
  } else if (tierId === "zone4") {
    if (weightKg >= 5) {
      fee = 0;
    } else if (weightKg >= 4) {
      fee = 109;
      upgradeAdvice = `Add +1 kg to unlock 100% FREE express delivery on our 5 kg family pack!`;
      savingsAmount = fee;
    } else if (weightKg >= 3) {
      fee = 129;
      upgradeAdvice = `Upgrade to our 5 kg family pack for 100% FREE express delivery!`;
      savingsAmount = fee;
    } else if (weightKg >= 2) {
      fee = 139;
      upgradeAdvice = `Upgrade to 5 kg family pack for 100% FREE delivery!`;
      savingsAmount = fee;
    } else {
      fee = 190;
      upgradeAdvice = `Upgrade to 2 kg (lower ₹139 fee) or 5 kg family pack for 100% FREE delivery!`;
      savingsAmount = fee;
    }
  }

  const baseDeliveryFee = fee;
  const isRush = isDeliverable && fee > 0 && isEveningRushHour(now);
  const eveningSurcharge = isRush ? 40 : 0;
  if (isRush) {
    fee += eveningSurcharge;
    if (savingsAmount) {
      savingsAmount = fee;
    }
    if (tierId === "zone1" && weightKg < 2) {
      upgradeAdvice = `Add +${2 - weightKg} kg to unlock 100% FREE express delivery and save ₹${fee} (avoids evening rush surge)!`;
    } else if (tierId === "zone2" && weightKg < 3) {
      upgradeAdvice = `Add +${3 - weightKg} kg to unlock 100% FREE express delivery and save ₹${fee} (avoids evening rush surge)!`;
    } else if (tierId === "zone3" && weightKg < 3) {
      upgradeAdvice = `Add +${3 - weightKg} kg to unlock 100% FREE express delivery and save ₹${fee} (avoids evening rush surge)!`;
    } else if (tierId === "zone4" && weightKg < 5) {
      upgradeAdvice = `Upgrade to our 5 kg family pack to get 100% FREE express delivery and save ₹${fee}!`;
    }
  }

  const isFreeDelivery = isDeliverable && fee === 0;

  // Build headline and message
  let statusHeadline = "";
  let deliveryMessage = "";

  if (tierId === "zone1") {
    statusHeadline = isRush && fee > 0
      ? `✓ Free Delivery from 2 kg (~${dist.toFixed(1)} km) · ⚡ Evening Rush Express`
      : `✓ 100% Free Express Delivery from 2 kg (~${dist.toFixed(1)} km)`;
    deliveryMessage = isRush && fee > 0
      ? `Deliverable within 90–120 minutes to your shared GPS location. Free on 2+ kg, or ₹${fee} express delivery fee (includes ₹40 evening rush surcharge 4–8 PM).`
      : `Deliverable within 90–120 minutes to your shared GPS location in clean food-grade packaging. Free on 2+ kg, or ₹${fee} delivery fee for 1 kg.`;
  } else if (tierId === "zone2") {
    statusHeadline = isRush && fee > 0
      ? `✓ Mid-City Delivery — Free from 3 kg (~${dist.toFixed(1)} km) · ⚡ Evening Rush Express`
      : `✓ Mid-City Delivery — Free from 3 kg (~${dist.toFixed(1)} km)`;
    deliveryMessage = isRush && fee > 0
      ? `Deliverable within 2 hours to your shared GPS location. Free on 3+ kg, or ₹${fee} express delivery fee for ${weightKg} kg (includes ₹40 evening rush surcharge 4–8 PM).`
      : `Deliverable within 2 hours to your shared GPS location. Free on 3+ kg, or express delivery fee (₹55 for 2 kg / ₹75 for 1 kg).`;
  } else if (tierId === "zone3") {
    statusHeadline = isRush && fee > 0
      ? `✓ Greater Srinagar Delivery — Free from 3 kg (~${dist.toFixed(1)} km) · ⚡ Evening Rush Express`
      : `✓ Greater Srinagar Delivery — Free from 3 kg (~${dist.toFixed(1)} km)`;
    deliveryMessage = isRush && fee > 0
      ? `Deliverable within 2 hours to your shared GPS location. Free on 3+ kg, or ₹${fee} express delivery fee for ${weightKg} kg (includes ₹40 evening rush surcharge 4–8 PM).`
      : `Deliverable within 2 hours to your shared GPS location in food-grade biodegradable polythene (0% ice). Free on 3+ kg, or express delivery fee (₹89 for 2 kg / ₹130 for 1 kg).`;
  } else if (tierId === "zone4") {
    statusHeadline = isRush && fee > 0
      ? `✓ South Corridor Delivery — Free on 5 kg (~${dist.toFixed(1)} km) · ⚡ Evening Rush Express`
      : `✓ South Corridor Delivery — Free on 5 kg (~${dist.toFixed(1)} km)`;
    deliveryMessage = isRush && fee > 0
      ? `Deliverable within 2 hours to your shared GPS location. 100% Free on 5 kg family pack, or ₹${fee} express delivery fee for ${weightKg} kg (includes ₹40 evening rush surcharge 4–8 PM).`
      : `Deliverable within 2 hours to your shared GPS location in food-grade biodegradable polythene (0% ice). 100% Free on 5 kg family pack, or express delivery fee (₹109 for 4 kg / ₹129 for 3 kg / ₹139 for 2 kg / ₹190 for 1 kg).`;
  } else {
    statusHeadline = `📍 Outside 16 km Express Delivery Perimeter (~${dist.toFixed(1)} km)`;
    deliveryMessage = `To preserve peak live-harvest freshness with 0% ice biodegradable packaging within 2 hours, express delivery is restricted to 16 km. You are warmly welcome to pick up fresh live catch directly from our Live Vending Center in Malabagh with ZERO delivery fee!`;
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
    baseDeliveryFee,
    isEveningRush: isRush,
    eveningSurcharge,
    isFreeDelivery,
    statusHeadline,
    deliveryMessage,
    upgradeAdvice,
    savingsAmount,
  };
}
