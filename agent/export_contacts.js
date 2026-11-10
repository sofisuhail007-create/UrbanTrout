const fs = require('fs');
const path = require('path');

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getISTDateObj(d) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(d.getTime() + istOffset);
}

function loadPrimaryPhones() {
  const desktopDir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null;
  const candidateDirs = [];
  if (desktopDir && fs.existsSync(desktopDir)) {
    candidateDirs.push(path.join(desktopDir, 'Urban Trout', 'Contacts'));
    candidateDirs.push(desktopDir);
  }
  candidateDirs.push(__dirname);

  const existingCandidates = [];
  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (/primary.*contact.*\.vcf$/i.test(f)) {
          const full = path.join(dir, f);
          const stat = fs.statSync(full);
          existingCandidates.push({ path: full, mtime: stat.mtimeMs });
        }
      }
    } catch (_) {}
  }
  // Prefer most recently modified primary contacts VCF
  existingCandidates.sort((a, b) => b.mtime - a.mtime);
  const possiblePaths = existingCandidates.map(c => c.path);

  const primaryPhones = new Set(["9419153353", "919419153353"]); // VVIP IAS Officer protected
  const utaPrimaryMap = new Map();
  let loadedFrom = null;

  for (const vcfPath of possiblePaths) {
    if (fs.existsSync(vcfPath)) {
      try {
        const content = fs.readFileSync(vcfPath, 'utf8');
        const cards = content.split('END:VCARD');
        for (const card of cards) {
          const fnMatch = card.match(/FN:(.+)/i);
          const fn = fnMatch ? fnMatch[1].trim() : '';

          // If this card is an existing Urban Trout contact (UTA / UT / Urban Trout), DO NOT exclude it!
          if (/\b(?:UTA|Urban Trout)\b/i.test(fn)) {
            const telMatch = card.match(/TEL.*:(.+)/i);
            if (telMatch) {
              const rawTel = telMatch[1].replace(/\D/g, '').slice(-10);
              if (rawTel.length === 10) {
                let cleanName = fn.replace(/^UTA\s*[-–•*:\s]*/i, '').replace(/\s*[-–•*:\s]*UTA$/i, '').trim();
                utaPrimaryMap.set(rawTel, { rawFn: fn, cleanName });
              }
            }
            continue; // Keep eligible for Urban Trout updates
          }

          const lines = card.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith('TEL')) {
              const rawVal = line.substring(line.indexOf(':') + 1);
              const digits = rawVal.replace(/\D/g, '');
              if (digits.length >= 10) {
                const last10 = digits.slice(-10);
                primaryPhones.add(last10);
                primaryPhones.add(`91${last10}`);
              }
            }
          }
        }
        loadedFrom = vcfPath;
        break;
      } catch (err) {
        console.warn(`Error reading primary contacts from ${vcfPath}:`, err.message);
      }
    }
  }

  if (loadedFrom) {
    console.log(`🛡️ [Primary Contacts Protection] Loaded ${primaryPhones.size / 2} unique personal primary contacts from "${path.basename(loadedFrom)}".`);
  } else {
    console.warn(`⚠️ [Primary Contacts Protection] No primary contacts VCF found. Exclusions skipped.`);
  }

  return { primaryPhones, utaPrimaryMap };
}

// Kashmir & Srinagar pincode mapping
const PINCODE_MAP = {
  '190001': 'Lal Chowk',
  '190002': 'Rainawari',
  '190003': 'Khanyar',
  '190004': 'Soura',
  '190005': 'Hyderpora',
  '190006': 'Hazratbal',
  '190007': 'Batamaloo',
  '190008': 'Rajbagh',
  '190009': 'Sanat Nagar',
  '190010': 'Karan Nagar',
  '190011': 'Bemina',
  '190012': 'Khanyar',
  '190014': 'Chanapora',
  '190015': 'Pantha Chowk',
  '190018': 'Shalimar',
  '190019': 'Zakura',
  '190020': 'Nishat',
  '190021': 'Ganderbal',
  '190024': 'Parimpora',
  '190025': 'Budgam',
  '191111': 'Ganderbal',
  '191121': 'Kangan'
};

// Exhaustive dictionary of 60+ Kashmir & Srinagar localities with phonetic and colloquial variants
const expandedAreas = [
  // Core & Zone 1
  { name: 'Malabagh', re: /\b(?:malabagh|mallabagh|malla\s*bagh|mala\s*bagh)\b/i },
  { name: 'Buchpora', re: /\b(?:buchpora|buchpore|bachpora|bachpore|bakshpora)\b/i },
  { name: 'Soura', re: /\b(?:soura|upper\s*soura|skims|skims\s*soura|dr\s*ali\s*jan\s*road)\b/i },
  { name: 'Ahmed Nagar', re: /\b(?:ahmed\s*nagar|ahmad\s*nagar|shadab\s*colony)\b/i },
  { name: 'Illahi Bagh', re: /\b(?:illahi\s*bagh|ellahi\s*bagh|elahi\s*bagh)\b/i },
  { name: 'Zakura', re: /\b(?:zakura|zakoora|industrial\s*estate\s*zakura)\b/i },
  { name: 'Hazratbal', re: /\b(?:hazratbal|dargah|kashmir\s*university)\b/i },
  { name: 'Habak', re: /\b(?:habak|habak\s*naseem\s*bagh|habak\s*crossing)\b/i },
  { name: 'Naseem Bagh', re: /\b(?:naseem\s*bagh|nasimbagh|professor\s*colony\s*naseem)\b/i },
  { name: 'Mirza Bagh', re: /\b(?:mirza\s*bagh|mirzabagh)\b/i },
  { name: 'Batapora', re: /\b(?:batapora|bata\s*pora)\b/i },
  { name: '90 Feet Road', re: /\b(?:90\s*feet|ninety\s*feet)\b/i },
  { name: 'Nowshera', re: /\b(?:nowshera|naushera)\b/i },
  { name: 'Bagh Ali Mardan', re: /\b(?:bagh\s*ali\s*mardan|ali\s*mardan|mill\s*stop)\b/i },
  { name: 'Lal Bazar', re: /\b(?:lal\s*bazar|lalbazar)\b/i },
  { name: 'Botakadal', re: /\b(?:botakadal|bota\s*kadal)\b/i },
  { name: 'Zadibal', re: /\b(?:zadibal)\b/i },
  { name: 'Nigeen', re: /\b(?:nigeen|nagin)\b/i },
  { name: 'Saderbal', re: /\b(?:saderbal|sader\s*bal|sadribal)\b/i },
  { name: 'Kanitar', re: /\b(?:kanitar|kaniter)\b/i },
  { name: 'Ashaie Bagh', re: /\b(?:ashaie\s*bagh|ashai\s*bagh)\b/i },
  { name: 'Umer Colony', re: /\b(?:umer\s*colony|omer\s*colony)\b/i },
  { name: 'Usman Colony', re: /\b(?:usman\s*colony)\b/i },
  { name: 'Bilal Colony', re: /\b(?:bilal\s*colony)\b/i },
  { name: 'Zoonimar', re: /\b(?:zoonimar|zonimar)\b/i },
  { name: 'Pandach', re: /\b(?:pandach)\b/i },
  { name: 'Sheribhat', re: /\b(?:sheribhat|sheri\s*bhat)\b/i },

  // Tier 2 (4-6 km)
  { name: 'Gulab Bagh', re: /\b(?:gulab\s*bagh|gulabbagh|gulabagh|gulab\s*garden|rose\s*colony|rosemary\s*colony)\b/i },
  { name: 'Hawal', re: /\b(?:hawal)\b/i },
  { name: 'Badamwari', re: /\b(?:badamwari|badam\s*wari)\b/i },
  { name: 'Madin Sahib', re: /\b(?:madin\s*sahib)\b/i },
  { name: 'Alamgari Bazar', re: /\b(?:alamgari\s*bazar|alamgari)\b/i },
  { name: 'Saida Kadal', re: /\b(?:saida\s*kadal|saidakadal)\b/i },
  { name: 'Rainawari', re: /\b(?:rainawari)\b/i },
  { name: 'Khanyar', re: /\b(?:khanyar|khanyaar)\b/i },
  { name: 'Nowhatta', re: /\b(?:nowhatt|nowhatta|naushatta)\b/i },
  { name: 'Gojwara', re: /\b(?:gojwara)\b/i },
  { name: 'Shalimar', re: /\b(?:shalimar)\b/i },
  { name: 'Tailbal', re: /\b(?:tailbal|teilbal)\b/i },
  { name: 'Mirak Shah Colony', re: /\b(?:mirak\s*shah)\b/i },
  { name: 'Kathi Darwaza', re: /\b(?:kathi\s*darwaza)\b/i },
  { name: 'Nagbal', re: /\b(?:nagbal)\b/i },
  { name: 'Alesteng', re: /\b(?:alesteng|alasteng)\b/i },
  { name: 'Shuhama', re: /\b(?:shuhama)\b/i },
  { name: 'Burzahama', re: /\b(?:burzahama)\b/i },

  // Tier 3 Extended (MOQ 4 kg)
  { name: 'Hyderpora', re: /\b(?:hyderpora|hyder\s*pora|hyderpura)\b/i },
  { name: 'Peerbagh', re: /\b(?:peerbagh|peer\s*bagh|pirbagh|pir\s*bagh)\b/i },
  { name: 'Airport Road', re: /\b(?:airport\s*road|humhama|humhama\s*airport)\b/i },
  { name: 'Lal Chowk', re: /\b(?:lal\s*chowk|lalchowk|regent\s*cinema|residency\s*road)\b/i },
  { name: 'Dalgate', re: /\b(?:dalgate|dal\s*gate|boulevard)\b/i },
  { name: 'Sonwar', re: /\b(?:sonwar|sonawar|sona\s*war)\b/i },
  { name: 'Qamarwari', re: /\b(?:qamarwari|qamar\s*wari|kamarwari)\b/i },

  // Out of Zone / Greater Srinagar
  { name: 'Jawahar Nagar', re: /\b(?:jawahar\s*nagar|jawaharnagar|jawar\s*nagar|jawhar\s*nagar|jawaher\s*nagar|jawar|dav\s*school)\b/i },
  { name: 'Rajbagh', re: /\b(?:rajbagh|raj\s*bagh)\b/i },
  { name: 'Parimpora', re: /\b(?:parimpora|parim\s*pora|fruit\s*mandi)\b/i },
  { name: 'Sanat Nagar', re: /\b(?:sanat\s*nagar|sanatnagar)\b/i },
  { name: 'Batamaloo', re: /\b(?:batamaloo|batmaloo|batmalo)\b/i },
  { name: 'Bemina', re: /\b(?:bemina|khumani\s*chowk|hamdania\s*colony)\b/i },
  { name: 'HMT', re: /\b(?:hmt|zainakote|mustafabad)\b/i },
  { name: 'Harwan', re: /\b(?:harwan|chandpora|chinar\s*colony)\b/i },
  { name: 'Nishat', re: /\b(?:nishat|brein|brain|ishber)\b/i },
  { name: 'Nawa Kadal', re: /\b(?:nawa\s*kadal|nawakadal|nawa\s*bazaar|nawabazar|kokermasjid)\b/i },
  { name: 'Chanapora', re: /\b(?:chanapora|channapora|chanpora)\b/i },
  { name: 'Natipora', re: /\b(?:natipora|natipura)\b/i },
  { name: 'Baghat Barzulla', re: /\b(?:baghat\s*barzulla|baghat)\b/i },
  { name: 'Barzulla', re: /\b(?:barzulla|old\s*barzulla)\b/i },
  { name: 'Rawalpora', re: /\b(?:rawalpora|rawalpura|rawapora)\b/i },
  { name: 'Karan Nagar', re: /\b(?:karan\s*nagar|karannagar)\b/i },
  { name: 'Ganderbal', re: /\b(?:ganderbal)\b/i },
  { name: 'Pantha Chowk', re: /\b(?:pantha\s*chowk|panthachowk|athwajan|atwajan|dps\s*school)\b/i },
  { name: 'Budgam', re: /\b(?:budgam|ompora)\b/i },
  { name: 'Nehru Park', re: /\b(?:nehru\s*park|dal\s*lake)\b/i },
  { name: 'Lawaypora', re: /\b(?:lawaypora|lawapora)\b/i },
  { name: 'Nowgam', re: /\b(?:nowgam|naogam|railway\s*station)\b/i },
  { name: 'Solina', re: /\b(?:solina|solina\s*balla|solina\s*payeen|rambagh|ram\s*bagh|silk\s*factory)\b/i },
  { name: 'Kralpora', re: /\b(?:kralpora|kral\s*pora)\b/i },
  { name: 'Safa Kadal', re: /\b(?:safa\s*kadal|safakadal)\b/i },
  { name: 'Khayam', re: /\b(?:khayam|khayam\s*chowk)\b/i },
  { name: 'Munawarabad', re: /\b(?:munawarabad|munawar\s*abad)\b/i },
  { name: 'Pampore', re: /\b(?:pampore)\b/i },
  { name: 'Lasjan', re: /\b(?:lasjan)\b/i },
  { name: 'Rangreth', re: /\b(?:rangreth)\b/i },
  { name: 'Shalteng', re: /\b(?:shalteng)\b/i }
];

function extractLocality(userText = '', modelText = '', meta = {}, matchedOrder = null) {
  // 1. Explicit locality saved in metadata (if not generic 'Srinagar' or faulty 'Police Station')
  if (meta && meta.localityName && meta.localityName !== 'Srinagar' && meta.localityName !== 'Police Station') {
    return meta.localityName;
  }

  // 2. Pincode match in user text
  const userPin = userText.match(/\b(19\d{4})\b/);
  if (userPin && PINCODE_MAP[userPin[1]]) {
    return PINCODE_MAP[userPin[1]];
  }

  // 3. Locality keywords in user text (raw source of truth directly from customer)
  if (userText) {
    for (const a of expandedAreas) {
      if (a.re.test(userText)) return a.name;
    }
  }

  // 4. Delivery area from verified order
  if (matchedOrder && matchedOrder.deliveryArea) {
    for (const a of expandedAreas) {
      if (a.re.test(matchedOrder.deliveryArea)) return a.name;
    }
  }

  // 5. Pincode acknowledged by model
  const modelPin = modelText.match(/\b(19\d{4})\b/);
  if (modelPin && PINCODE_MAP[modelPin[1]]) {
    return PINCODE_MAP[modelPin[1]];
  }

  // 6. Locality acknowledged by model (exclude Malabagh to avoid farm footer false positive)
  if (modelText) {
    for (const a of expandedAreas) {
      if (a.name === 'Malabagh') continue;
      const ackPattern = new RegExp(`(?:${a.name}|${a.re.source})\\s+(?:area|is\\s+(?:approximately|outside|within|around)|deliver|delivery)`, 'i');
      if (ackPattern.test(modelText)) return a.name;
    }
  }

  return null;
}

function extractNameFromAddressLines(text) {
  if (!text) return null;
  const lines = text.split(/[\r\n]+/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(?:send|order|want|need|house|h\s*no|lane|colony|ward|road|street|avenue|near|behind|opposite|srinagar|kashmir|ph\s*no|phone|cell|mobile|contact|nowhatt|\d+)/i.test(trimmed)) continue;
    if (trimmed.length >= 3 && trimmed.length <= 30 && /^[A-Za-z\s.'-]+$/.test(trimmed)) {
      const words = trimmed.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        if (!/^(?:fresh|rainbow|trout|gutted|cleaned|steaks|delivery|doorstep|payment|price|rates|counter|please)/i.test(trimmed)) {
          return trimmed;
        }
      }
    }
  }
  return null;
}

function exportContacts() {
  const authDir = path.join(__dirname, 'auth_info_baileys');
  const chatsPath = path.join(__dirname, 'chat_histories.json');
  if (!fs.existsSync(chatsPath)) {
    console.error('chat_histories.json not found');
    return [];
  }

  const { primaryPhones, utaPrimaryMap } = loadPrimaryPhones();
  let skippedPrimaryCount = 0;

  const chats = JSON.parse(fs.readFileSync(chatsPath, 'utf8'));

  let orders = {};
  const ordersPath = path.join(__dirname, 'customer_orders.json');
  if (fs.existsSync(ordersPath)) {
    try {
      orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    } catch (_) {}
  }

  let chatMetadata = {};
  const metaPath = path.join(__dirname, 'chat_metadata.json');
  if (fs.existsSync(metaPath)) {
    try {
      chatMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (_) {}
  }

  let whatsappContactsMap = {};
  const contactsMapPath = path.join(__dirname, 'whatsapp_contacts_map.json');
  if (fs.existsSync(contactsMapPath)) {
    try {
      whatsappContactsMap = JSON.parse(fs.readFileSync(contactsMapPath, 'utf8'));
    } catch (_) {}
  }

  // Helper to resolve real mobile number from Baileys auth reverse LID mappings
  function resolvePhoneFromJid(jid) {
    if (!jid) return '';
    if (jid.endsWith('@s.whatsapp.net')) return jid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
    const cleanId = jid.replace('@lid', '').replace('@s.whatsapp.net', '');
    try {
      const revPath = path.join(__dirname, 'auth_info_baileys', `lid-mapping-${cleanId}_reverse.json`);
      if (fs.existsSync(revPath)) {
        const mapped = JSON.parse(fs.readFileSync(revPath, 'utf8'));
        if (mapped) return String(mapped).replace(/\D/g, '');
      }
    } catch (_) {}
    return cleanId;
  }

  // Pre-build index of all customers who have shared location/GPS across metadata, orders, and chats
  const phoneToLocation = new Map();

  // 1. Index from chatMetadata (handles both phone entries and reverse LID mapped entries)
  for (const [k, v] of Object.entries(chatMetadata)) {
    if (!v) continue;
    let phone = v.phone || resolvePhoneFromJid(k);
    if (!phone || phone.length < 10) continue;
    const last10 = phone.replace(/\D/g, '').slice(-10);
    if (v.latitude && v.longitude) {
      phoneToLocation.set(last10, {
        lat: v.latitude,
        lng: v.longitude,
        mapsUrl: v.googleMapsUrl || `https://maps.google.com/?q=${v.latitude},${v.longitude}`,
        dist: v.distanceKm != null ? Number(v.distanceKm).toFixed(1) : null
      });
    }
  }

  // 2. Index from customer_orders
  for (const [k, o] of Object.entries(orders)) {
    if (!o) continue;
    const p = (o.customerPhone || o.phone || '').replace(/\D/g, '').slice(-10);
    if (!p) continue;
    if (o.latitude && o.longitude) {
      phoneToLocation.set(p, {
        lat: o.latitude,
        lng: o.longitude,
        mapsUrl: o.googleMapsUrl || `https://maps.google.com/?q=${o.latitude},${o.longitude}`,
        dist: o.distanceKm != null ? Number(o.distanceKm).toFixed(1) : null
      });
    }
  }

  // 3. Index from chat histories (extract coordinates or Google Maps links from raw messages)
  for (const [jid, msgs] of Object.entries(chats)) {
    if (!Array.isArray(msgs)) continue;
    const p = resolvePhoneFromJid(jid);
    if (!p || p.length < 10) continue;
    const last10 = p.replace(/\D/g, '').slice(-10);

    for (const m of msgs) {
      if (!m || !m.text) continue;
      const urlMatch = m.text.match(/(https?:\/\/(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*)/i);
      const coordMatch = m.text.match(/(-?\d{1,2}\.\d{4,10})[,\s]+(-?\d{1,3}\.\d{4,10})/);
      const distMatch = m.text.match(/(\d+(?:\.\d+)?)\s*km\s*from\s*(?:our\s*)?Malabagh/i);

      if (urlMatch || coordMatch) {
        // Exclude the farm's own Malabagh Live Vending Center map link
        if (urlMatch && (urlMatch[1].includes('6FT5iLk5n8mbKSRU9') || urlMatch[1].includes('6ft5ilk5n8mbksru9'))) {
          continue;
        }
        const existing = phoneToLocation.get(last10) || {};
        if (urlMatch && !existing.mapsUrl && !urlMatch[1].includes('6FT5iLk5n8mbKSRU9')) existing.mapsUrl = urlMatch[1];
        if (coordMatch && !existing.lat) {
          existing.lat = coordMatch[1];
          existing.lng = coordMatch[2];
          if (!existing.mapsUrl) existing.mapsUrl = `https://maps.google.com/?q=${existing.lat},${existing.lng}`;
        }
        if (distMatch && !existing.dist) existing.dist = Number(distMatch[1]).toFixed(1);
        phoneToLocation.set(last10, existing);
      }
    }
  }

  console.log(`📍 [Location Intelligence] Loaded verified Google Maps navigation links for ${phoneToLocation.size} customer contacts.`);

  const contacts = [];
  const seenPhones = new Set();

  function buildSmartContactName({ isBuyer, isPaymentSent, customerName, area, raw10, userLower = '' }) {
    const last4 = (raw10 || '').slice(-4);
    const prefix = isBuyer ? 'UT ★ •' : (isPaymentSent ? 'UT 🔥 •' : 'UT •');

    let cleanName = customerName ? String(customerName).trim() : '';
    cleanName = cleanName.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (/^(?:Customer|Valued Customer|No Name|2k|2kg|1kg|3kg|4kg|Cleaned|Gutted|Whole|\+?91)/i.test(cleanName)) {
      cleanName = '';
    }

    // 1. If customer has a real personal or WhatsApp name
    if (cleanName) {
      if (area && !cleanName.toLowerCase().includes(area.toLowerCase())) {
        return `${prefix} ${cleanName} - ${area}`;
      }
      return `${prefix} ${cleanName}`;
    }

    // 2. If locality is known but no personal name
    if (area) {
      if (isBuyer) return `${prefix} ${area} Buyer (${last4})`;
      if (isPaymentSent) return `${prefix} ${area} Lead (${last4})`;
      if (/visit|come to store|your location|address/i.test(userLower)) {
        return `${prefix} ${area} Store Visit (${last4})`;
      }
      return `${prefix} ${area} Lead (${last4})`;
    }

    // 3. If neither name nor locality is known (identifiable by phone last 4 digits)
    if (isBuyer) return `${prefix} Buyer (${last4})`;
    if (isPaymentSent) return `${prefix} Hot Lead (${last4})`;
    if (/visit|come to store|your location|address/i.test(userLower)) {
      return `${prefix} Store Visit (${last4})`;
    }
    if (/price|rate|cost|kitne/i.test(userLower)) {
      return `${prefix} Price Inquiry (${last4})`;
    }
    if (/deliver|doorstep/i.test(userLower)) {
      return `${prefix} Delivery Inquiry (${last4})`;
    }
    return `${prefix} Lead (${last4})`;
  }

  for (const [jid, msgs] of Object.entries(chats)) {
    const cleanId = jid.replace('@lid', '').replace('@s.whatsapp.net', '');
    let phone = '';
    let createdAt = null;

    if (jid.endsWith('@s.whatsapp.net')) {
      phone = cleanId;
    } else {
      const revPath = path.join(authDir, `lid-mapping-${cleanId}_reverse.json`);
      if (fs.existsSync(revPath)) {
        try {
          phone = JSON.parse(fs.readFileSync(revPath, 'utf8'));
          createdAt = fs.statSync(revPath).mtime;
        } catch (_) {}
      }
    }

    if (!phone) continue;
    phone = phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const raw10 = phone.slice(-10);

    const userMsgs = msgs.filter(m => m.role === 'user');
    const userText = userMsgs.map(m => m.text || '').join(' ');
    const userLower = userText.toLowerCase();
    const modelMsgs = msgs.filter(m => m.role === 'model');
    const modelText = modelMsgs.map(m => m.text || '').join(' ');
    const allText = msgs.map(m => m.text || '').join(' ');

    const meta = chatMetadata[jid] || chatMetadata[raw10] || {};
    const matchedOrder = orders[raw10] || Object.values(orders).find(o => o.chatId === jid || (o.phone && o.phone.includes(raw10)));

    // Check Order / Buyer status
    const isBuyer = (matchedOrder && /(?:paid|confirmed|harvest|deliver|out)/i.test(matchedOrder.status || '')) ||
                    /(?:payment (?:has been )?(?:successfully )?received|payment (?:received & )?order confirmed|payment verified|live harvest scheduled|order summary \(#ut-wa-|\bpaid & confirmed\b)/i.test(allText);

    const isPaymentSent = !isBuyer && ((matchedOrder && /payment link sent/i.test(matchedOrder.status || '')) ||
                          /(?:rzp\.io|payment link)/i.test(allText));

    // Skip personal primary contacts (excluding UTA contacts and confirmed buyers)
    if (primaryPhones.has(raw10) && !isBuyer && !(utaPrimaryMap && utaPrimaryMap.has(raw10))) {
      skippedPrimaryCount++;
      continue;
    }

    if (seenPhones.has(phone)) continue;
    seenPhones.add(phone);
    if (!createdAt) createdAt = new Date('2026-10-01T08:00:00Z');

    // 1. Extract Customer Name (Prioritize verified customer order name like 'Er Rashid', 'Jausia Bhat')
    let customerName = '';
    if (matchedOrder && matchedOrder.name) {
      const n = matchedOrder.name.trim();
      if (!/^(?:Customer|Valued Customer|No Name|2k|2kg|1kg|3kg|4kg|Cleaned|Gutted|Whole|\+?91)/i.test(n)) {
        customerName = n;
      }
    }
    if (!customerName && utaPrimaryMap && utaPrimaryMap.has(raw10)) {
      customerName = utaPrimaryMap.get(raw10).cleanName;
    }
    if (!customerName) {
      const mapEntry = whatsappContactsMap[raw10] || whatsappContactsMap[cleanId] || whatsappContactsMap[jid];
      if (mapEntry && mapEntry.name) {
        customerName = mapEntry.name;
      }
    }
    if (!customerName && meta && meta.pushName) {
      customerName = meta.pushName;
    }
    if (!customerName) {
      for (const m of userMsgs) {
        const text = m.text || '';
        const introMatch = text.match(/\b(?:my\s*name\s*is|name\s*is|name\s*:|this\s*is)\s+([A-Za-z\s]{3,25})/i);
        if (introMatch) {
          const cand = introMatch[1].trim();
          if (!/^(?:fresh|trout|delivery|order|pan|cleaned|gutted|kg|kilo|cash|online|upi|getting|outside|in\s*a\s*meeting)/i.test(cand)) {
            customerName = cand;
            break;
          }
        }
        const addrName = extractNameFromAddressLines(text);
        if (addrName) {
          customerName = addrName;
          break;
        }
      }
    }
    if (!customerName) {
      for (const m of modelMsgs) {
        const text = m.text || '';
        const greetingMatch = text.match(/Assalam-o-Alaikum[,\s]+([A-Za-z\s]{3,20})[!]/i);
        if (greetingMatch) {
          const candidate = greetingMatch[1].trim();
          if (!['welcome', 'glad', 'customer', 'valued', 'munir', 'tabasum', 'abdul majid', 'idrees', 'ayesha', 'syed shabnum'].includes(candidate.toLowerCase())) {
            customerName = candidate;
            break;
          }
        }
      }
    }

    // 2. Extract Locality
    const area = extractLocality(userText, modelText, meta, matchedOrder);

    // 3. Construct Clean, Smart Contact Name (Zero numbered duplicates!)
    let fullName = buildSmartContactName({
      isBuyer,
      isPaymentSent,
      customerName,
      area,
      raw10,
      userLower
    });

    fullName = fullName.replace(/\s+•\s+•\s+/g, ' • ').replace(/\s{2,}/g, ' ').trim();
    const parts = fullName.split(' • ');
    const givenName = parts[0] || 'UT';
    const familyName = parts.slice(1).join(' • ') || fullName;

    const lastUserText = userMsgs.length > 0
      ? userMsgs[userMsgs.length - 1].text.replace(/[\r\n",]/g, ' ').slice(0, 120).trim()
      : 'Inquiry';

    const locInfo = phoneToLocation.get(raw10) || null;
    let contactNotes = `Urban Trout Customer | Name: ${customerName || 'Inquirer'} | Locality: ${area || 'Srinagar'}`;
    if (locInfo && locInfo.mapsUrl) {
      contactNotes = `📍 Google Maps: ${locInfo.mapsUrl}${locInfo.dist ? ` (~${locInfo.dist} km from farm)` : ''}\n${contactNotes}`;
    }
    contactNotes += ` | Last: ${lastUserText}`;

    contacts.push({
      fullName,
      givenName,
      familyName,
      phone: `+${phone}`,
      cleanPhone: raw10,
      customerName: customerName || '',
      area: area || 'Srinagar',
      createdAt: createdAt.getTime(),
      notes: contactNotes,
      ...(locInfo && locInfo.mapsUrl ? {
        mapsUrl: locInfo.mapsUrl,
        lat: locInfo.lat,
        lng: locInfo.lng,
        distanceKm: locInfo.dist
      } : {})
    });

    if (matchedOrder && matchedOrder.notes) {
      const altMatch = matchedOrder.notes.match(/\b(?:contact|cell|phone|alternate)?[:\s]*([6-9]\d{9})\b/i);
      if (altMatch) {
        const altRaw10 = altMatch[1];
        const altFull = '91' + altRaw10;
        if (!seenPhones.has(altFull) && !(primaryPhones.has(altRaw10) && !isBuyer)) {
          seenPhones.add(altFull);
          contacts.push({
            fullName: `${fullName} (Alt)`,
            givenName,
            familyName: `${familyName} (Alt)`,
            phone: `+${altFull}`,
            cleanPhone: altRaw10,
            createdAt: createdAt.getTime(),
            notes: `Urban Trout Customer (Alt Phone) | Locality: ${area || 'Srinagar'} | For: ${fullName}`
          });
        }
      }
    }
  }

  // Also process all standalone orders from customer_orders.json (ensuring paid buyers without chat histories are exported)
  for (const [orderKey, order] of Object.entries(orders)) {
    let orderPhone = (order.phone || (order.name && order.name.match(/\d{10}/) ? order.name.match(/\d{10}/)[0] : '') || '').replace(/\D/g, '');
    if (orderPhone.length >= 10) {
      const raw10 = orderPhone.slice(-10);
      const fullPhone = '91' + raw10;
      if (seenPhones.has(fullPhone)) continue;

      const isBuyer = /(?:paid|confirmed|harvest|deliver|out)/i.test(order.status || '');
      const isPaymentSent = !isBuyer && /payment link sent/i.test(order.status || '');

      let customerName = '';
      if (utaPrimaryMap && utaPrimaryMap.has(raw10)) {
        customerName = utaPrimaryMap.get(raw10).cleanName;
      }
      if (!customerName && order.name) {
        const n = order.name.trim();
        if (!/^(?:Customer|Valued Customer|No Name|2k|2kg|1kg|3kg|4kg|Cleaned|Gutted|Whole|\+?91)/i.test(n)) {
          customerName = n;
        }
      }

      let area = extractLocality('', '', {}, order);
      if (!area && order.deliveryArea) {
        for (const a of expandedAreas) {
          if (a.re.test(order.deliveryArea)) {
            area = a.name;
            break;
          }
        }
      }

      if (primaryPhones.has(raw10) && !isBuyer && !(utaPrimaryMap && utaPrimaryMap.has(raw10))) {
        skippedPrimaryCount++;
        continue;
      }

      seenPhones.add(fullPhone);

      let fullName = buildSmartContactName({
        isBuyer,
        isPaymentSent,
        customerName,
        area,
        raw10,
        userLower: ''
      });

      fullName = fullName.replace(/\s+•\s+•\s+/g, ' • ').replace(/\s{2,}/g, ' ').trim();
      const parts = fullName.split(' • ');
      const givenName = parts[0] || 'UT';
      const familyName = parts.slice(1).join(' • ') || fullName;

      const locInfo = phoneToLocation.get(raw10) || null;
      let contactNotes = `Urban Trout Customer | Name: ${customerName || 'Inquirer'} | Locality: ${area || 'Srinagar'} | Order: ${order.orderRef || orderKey} (${order.amount || ''})`;
      if (locInfo && locInfo.mapsUrl) {
        contactNotes = `📍 Google Maps: ${locInfo.mapsUrl}${locInfo.dist ? ` (~${locInfo.dist} km from farm)` : ''}\n${contactNotes}`;
      }

      contacts.push({
        fullName,
        givenName,
        familyName,
        phone: `+${fullPhone}`,
        cleanPhone: raw10,
        customerName: customerName || '',
        area: area || 'Srinagar',
        createdAt: order.paidAt ? new Date(order.paidAt).getTime() : (order.updatedAt ? new Date(order.updatedAt).getTime() : Date.now()),
        notes: contactNotes,
        ...(locInfo && locInfo.mapsUrl ? {
          mapsUrl: locInfo.mapsUrl,
          lat: locInfo.lat,
          lng: locInfo.lng,
          distanceKm: locInfo.dist
        } : {})
      });

      // If delivery notes has an alternate contact number, also add it
      if (order.notes) {
        const altMatch = order.notes.match(/\b(?:contact|cell|phone|alternate)?[:\s]*([6-9]\d{9})\b/i);
        if (altMatch) {
          const altRaw10 = altMatch[1];
          const altFull = '91' + altRaw10;
          if (!seenPhones.has(altFull) && !(primaryPhones.has(altRaw10) && !isBuyer)) {
            seenPhones.add(altFull);
            contacts.push({
              fullName: `${fullName} (Alt)`,
              givenName,
              familyName: `${familyName} (Alt)`,
              phone: `+${altFull}`,
              cleanPhone: altRaw10,
              customerName: customerName || '',
              area: area || 'Srinagar',
              createdAt: Date.now(),
              notes: `Urban Trout Customer (Alt Phone) | Locality: ${area || 'Srinagar'} | For: ${fullName}`
            });
          }
        }
      }
    }
  }

  // Also process all customer chat leads from chat_metadata.json (ensuring all inquiring customers are exported)
  for (const [metaKey, metaData] of Object.entries(chatMetadata)) {
    const cleanId = metaKey.replace('@lid', '').replace('@s.whatsapp.net', '');
    let phone = '';
    let createdAt = metaData.lastUserMsgTime ? new Date(metaData.lastUserMsgTime) : (metaData.lastBotMsgTime ? new Date(metaData.lastBotMsgTime) : new Date());

    if (metaKey.endsWith('@s.whatsapp.net')) {
      phone = cleanId;
    } else if (/^\d{10,12}$/.test(cleanId)) {
      phone = cleanId;
    } else {
      const revPath = path.join(authDir, `lid-mapping-${cleanId}_reverse.json`);
      if (fs.existsSync(revPath)) {
        try {
          phone = JSON.parse(fs.readFileSync(revPath, 'utf8'));
          const st = fs.statSync(revPath).mtime;
          if (!metaData.lastUserMsgTime) createdAt = st;
        } catch (_) {}
      }
    }

    if (!phone) continue;
    phone = phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const raw10 = phone.slice(-10);
    const fullPhone = '91' + raw10;

    if (seenPhones.has(fullPhone)) continue;

    // Check personal contacts protection
    if (primaryPhones.has(raw10) && !(utaPrimaryMap && utaPrimaryMap.has(raw10))) {
      skippedPrimaryCount++;
      continue;
    }

    seenPhones.add(fullPhone);

    let customerName = '';
    if (utaPrimaryMap && utaPrimaryMap.has(raw10)) {
      customerName = utaPrimaryMap.get(raw10).cleanName;
    }
    if (!customerName) {
      const mapEntry = whatsappContactsMap[raw10] || whatsappContactsMap[cleanId] || whatsappContactsMap[metaKey];
      if (mapEntry && mapEntry.name) {
        customerName = mapEntry.name;
      }
    }
    if (!customerName && metaData.pushName) {
      customerName = metaData.pushName;
    }

    const area = metaData.localityName || null;

    let fullName = buildSmartContactName({
      isBuyer: false,
      isPaymentSent: false,
      customerName,
      area,
      raw10,
      userLower: metaData.lastUserText ? metaData.lastUserText.toLowerCase() : ''
    });

    fullName = fullName.replace(/\s+•\s+•\s+/g, ' • ').replace(/\s{2,}/g, ' ').trim();
    const parts = fullName.split(' • ');
    const givenName = parts[0] || 'UT';
    const familyName = parts.slice(1).join(' • ') || fullName;

    const locInfo = phoneToLocation.get(raw10) || null;
    let contactNotes = `Urban Trout Customer | Name: ${customerName || 'Inquirer'} | Locality: ${area || 'Srinagar'} | Inquiry Date: ${createdAt.toISOString().slice(0, 10)}`;
    if (locInfo && locInfo.mapsUrl) {
      contactNotes = `📍 Google Maps: ${locInfo.mapsUrl}${locInfo.dist ? ` (~${locInfo.dist} km from farm)` : ''}\n${contactNotes}`;
    }

    contacts.push({
      fullName,
      givenName,
      familyName,
      phone: `+${fullPhone}`,
      cleanPhone: raw10,
      customerName: customerName || '',
      area: area || 'Srinagar',
      createdAt: createdAt.getTime(),
      notes: contactNotes,
      ...(locInfo && locInfo.mapsUrl ? {
        mapsUrl: locInfo.mapsUrl,
        lat: locInfo.lat,
        lng: locInfo.lng,
        distanceKm: locInfo.dist
      } : {})
    });
  }

  // Sort newest first
  contacts.sort((a, b) => b.createdAt - a.createdAt);

  // Standard vCard 3.0 (.vcf) Format with ADR, URL, GEO, and rich multi-line NOTE
  const vcfContent = contacts.map(c => {
    const loc = c.area || 'Srinagar';
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${c.fullName}`,
      `N:${c.familyName};${c.givenName};;;`,
      `TEL;TYPE=CELL,VOICE:${c.phone}`,
      `ADR;TYPE=HOME:;;;${loc};Srinagar;J&K;;`
    ];
    if (c.mapsUrl) {
      lines.push(`URL;TYPE=WORK:${c.mapsUrl}`);
    }
    if (c.lat && c.lng) {
      lines.push(`GEO:${c.lat};${c.lng}`);
    }
    lines.push(`NOTE:${c.notes.replace(/\r?\n/g, '\\n')}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }).join('\r\n') + '\r\n';

  const desktopDir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null;
  const localVcf = path.join(__dirname, 'Urban_Trout_Contacts.vcf');
  const jsonDbPath = path.join(__dirname, 'contacts_database.json');

  // Clean up any legacy CSV files
  const legacyFiles = [
    path.join(__dirname, 'Urban_Trout_Google_Contacts.csv'),
    path.join(__dirname, 'Urban_Trout_Outlook_Contacts.csv')
  ];
  if (desktopDir && fs.existsSync(desktopDir)) {
    legacyFiles.push(path.join(desktopDir, 'Urban_Trout_Google_Contacts.csv'));
    legacyFiles.push(path.join(desktopDir, 'Urban_Trout_Outlook_Contacts.csv'));
  }
  legacyFiles.forEach(f => {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (_) {}
  });

  // Write vCard files cleanly inside Desktop\Urban Trout\Contacts\
  if (desktopDir && fs.existsSync(desktopDir)) {
    try {
      const contactsFolder = path.join(desktopDir, 'Urban Trout', 'Contacts');
      if (!fs.existsSync(contactsFolder)) fs.mkdirSync(contactsFolder, { recursive: true });
      const desktopVcf = path.join(contactsFolder, 'Urban_Trout_Contacts.vcf');
      fs.writeFileSync(desktopVcf, vcfContent, 'utf8');
      console.log(`📁 1. Organized Desktop vCard: ${desktopVcf}`);
    } catch (_) {}
  }
  fs.writeFileSync(localVcf, vcfContent, 'utf8');

  // Write JSON DB
  fs.writeFileSync(jsonDbPath, JSON.stringify(contacts, null, 2), 'utf8');

  console.log(`✅ Successfully exported ${contacts.length} unique contacts exclusively to vCard (.vcf):`);
  if (skippedPrimaryCount > 0) {
    console.log(`🛡️ Preserved privacy: excluded ${skippedPrimaryCount} primary/personal contacts from Urban Trout export!`);
  }
  console.log(`📁 Local vCard:   ${localVcf}`);
  console.log(`📁 JSON Database: ${jsonDbPath}`);

  return contacts;
}

if (require.main === module) {
  exportContacts();
}

module.exports = { exportContacts, loadPrimaryPhones };
