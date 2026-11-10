const fs = require('fs');
const path = require('path');

function getISTDateObj(d) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(d.getTime() + istOffset);
}

// Haversine distance in km (used to reverse-match shared GPS pins against delivery_zone_db.json)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

// Comprehensive dictionary of Kashmir & Srinagar localities (Synchronized with AI Agent zones 1-4 & Outer)
const expandedAreas = [
  // Zone 1 (0 - 4.0 km)
  { name: 'Malabagh', re: /\b(?:malabagh|mallabagh|malla\s*bagh|mala\s*bagh)\b/i },
  { name: 'Buchpora', re: /\b(?:buchpora|buchpore|bachpora|bachpore|bakshpora)\b/i },
  { name: 'Soura', re: /\b(?:soura|upper\s*soura|skims|skims\s*soura|dr\s*ali\s*jan\s*road)\b/i },
  { name: 'Ahmed Nagar', re: /\b(?:ahmed\s*nagar|ahmad\s*nagar|shadab\s*colony)\b/i },
  { name: 'Illahi Bagh', re: /\b(?:illahi\s*bagh|ellahi\s*bagh|elahi\s*bagh|ilahibagh)\b/i },
  { name: 'Zakura', re: /\b(?:zakura|zakoora|industrial\s*estate\s*zakura)\b/i },
  { name: 'Hazratbal', re: /\b(?:hazratbal|dargah|kashmir\s*university)\b/i },
  { name: 'Habak', re: /\b(?:habak|habak\s*naseem\s*bagh|habak\s*crossing)\b/i },
  { name: 'Naseem Bagh', re: /\b(?:naseem\s*bagh|nasimbagh|professor\s*colony\s*naseem)\b/i },
  { name: 'Mirza Bagh', re: /\b(?:mirza\s*bagh|mirzabagh)\b/i },
  { name: 'Batapora', re: /\b(?:batapora|bata\s*pora)\b/i },
  { name: '90 Feet Road', re: /\b(?:90\s*feet|ninety\s*feet)\b/i },
  { name: 'Nowshera', re: /\b(?:nowshera|naushera)\b/i },
  { name: 'Bagh Ali Mardan', re: /\b(?:bagh\s*ali\s*mardan(?:\s*khan)?|ali\s*mardan(?:\s*khan)?|mill\s*stop)\b/i },
  { name: 'Lal Bazar', re: /\b(?:lal\s*bazar|lalbazar)\b/i },
  { name: 'Botakadal', re: /\b(?:botakadal|bota\s*kadal)\b/i },
  { name: 'Zadibal', re: /\b(?:zadibal)\b/i },
  { name: 'Nigeen', re: /\b(?:nigeen|nagin)\b/i },
  { name: 'Saderbal', re: /\b(?:saderbal|sader\s*bal|sadribal)\b/i },
  { name: 'Kanitar', re: /\b(?:kanitar|kaniter)\b/i },
  { name: 'Ashaie Bagh', re: /\b(?:ashaie?\s*bagh|ashai\s*bagh)\b/i },
  { name: 'Umer Colony', re: /\b(?:umer\s*colony|omer\s*colony)\b/i },
  { name: 'Usman Colony', re: /\b(?:usman\s*colony|bagh[\s\-]?i[\s\-]?usman)\b/i },
  { name: 'Bilal Colony', re: /\b(?:bilal\s*colony)\b/i },
  { name: 'Zoonimar', re: /\b(?:zoonimar|zonimar|zooni\s*mar)\b/i },
  { name: 'Pandach', re: /\b(?:pandach|pandath|pandacha)\b/i },
  { name: 'Sheribhat', re: /\b(?:sheribhat|sheri\s*bhat)\b/i },
  { name: 'Nalabal', re: /\b(?:nalabal|nala\s*bal)\b/i },
  { name: 'Gulab Bagh', re: /\b(?:g(?:h)?ulab\s*bagh|g(?:h)?ulabbagh|gulabagh|gulab\s*garden)\b/i },
  { name: 'Tailbal', re: /\b(?:tailbal|teilbal)\b/i },

  // Zone 2 (4.0 - 7.0 km)
  { name: 'Hawal', re: /\b(?:hawal)\b/i },
  { name: 'Badamwari', re: /\b(?:badamwari|badam\s*wari)\b/i },
  { name: 'Madin Sahib', re: /\b(?:madin\s*sahib)\b/i },
  { name: 'Alamgari Bazar', re: /\b(?:alamgari\s*bazar|alamgaribazar|alamgari)\b/i },
  { name: 'Saida Kadal', re: /\b(?:saida\s*kadal|saidakadal)\b/i },
  { name: 'Rainawari', re: /\b(?:rainawari|raina\s*wari|reinawari)\b/i },
  { name: 'Khanyar', re: /\b(?:khanyar|khan\s*yar|khanyaar)\b/i },
  { name: 'Nowhatta', re: /\b(?:nowhat+a?|nau\s*hat+a?|naushatta|nohat+a?)\b/i },
  { name: 'Gojwara', re: /\b(?:gojwara|goj\s*wara)\b/i },
  { name: 'Eidgah', re: /\b(?:eidgah|idgah|eid\s*gah|aali\s*masjid)\b/i },
  { name: 'Safa Kadal', re: /\b(?:safa\s*kadal|safakadal|sufakadal)\b/i },
  { name: 'Shalimar', re: /\b(?:shalimar)\b/i },
  { name: 'Mirak Shah Colony', re: /\b(?:mirak\s*shah(?:\s*colony)?)\b/i },
  { name: 'Kathi Darwaza', re: /\b(?:kathi\s*darwaza|kati\s*darwaza)\b/i },
  { name: 'Nagbal', re: /\b(?:nagbal)\b/i },
  { name: 'Alusteng', re: /\b(?:alusteng|alesteng|alasteng|aloo\s*steng)\b/i },
  { name: 'Shuhama', re: /\b(?:shuhama)\b/i },
  { name: 'Burzahama', re: /\b(?:burzahama|burzuhama|burza\s*hama)\b/i },
  { name: 'Ali Kadal', re: /\b(?:ali\s*kadal|alikadal|ali\s*kadel)\b/i },
  { name: 'Rajouri Kadal', re: /\b(?:rajouri\s*kadal|rajourikadal)\b/i },
  { name: 'Saraf Kadal', re: /\b(?:saraf\s*kadal|sarafkadal)\b/i },
  { name: 'Bohri Kadal', re: /\b(?:bohri\s*kadal|bohrikadal|bhori\s*kadal)\b/i },

  // Zone 3 (7.0 - 11.5 km)
  { name: 'Zaina Kadal', re: /\b(?:zaina\s*kadal|zainakadal|zaina\s*kadel)\b/i },
  { name: 'Maharaj Gunj', re: /\b(?:maharaj\s*gunj|maharajgunj|maharaj\s*ganj|maharajganj)\b/i },
  { name: 'Fateh Kadal', re: /\b(?:fateh\s*kadal|fatehkadal)\b/i },
  { name: 'Habba Kadal', re: /\b(?:habba\s*kadal|habbakadal)\b/i },
  { name: 'Karan Nagar', re: /\b(?:karan\s*nagar|karannagar)\b/i },
  { name: 'Lal Chowk', re: /\b(?:lal\s*chowk|lalchowk|regent\s*cinema|residency\s*road|poloview|polo\s*view)\b/i },
  { name: 'Dalgate', re: /\b(?:dalgate|dal\s*gate|boulevard)\b/i },
  { name: 'Khayam', re: /\b(?:khay+am|khyam|khaiam|khyber\s*(?:hospital|medical|institute))\b/i },
  { name: 'Qamarwari', re: /\b(?:qamarwari|qamar\s*wari|kamarwari)\b/i },
  { name: 'Balgarden', re: /\b(?:balgarden|bal\s*garden)\b/i },
  { name: 'Brein', re: /\b(?:brein|brain|ishber)\b/i },
  { name: 'Nishat', re: /\b(?:nishat)\b/i },
  { name: 'Nawa Kadal', re: /\b(?:nawa\s*kadal|nawakadal|nawa\s*bazaar|nawabazar|kokermasjid)\b/i },
  { name: 'Nehru Park', re: /\b(?:nehru\s*park|dal\s*lake)\b/i },
  { name: 'Munawarabad', re: /\b(?:munawarabad|munawar\s*abad)\b/i },

  // Zone 4 (11.5 - 16.0 km — 5 kg Free Delivery Corridor)
  { name: 'Sanat Nagar', re: /\b(?:sanat\s*nagar|sanatnagar)\b/i },
  { name: 'Peerbagh', re: /\b(?:peerbagh|peer\s*bagh|pirbagh|pir\s*bagh)\b/i },
  { name: 'Airport Road', re: /\b(?:airport\s*road|humhama|srinagar\s*airport|sheikh\s*ul\s*alam\s*airport)\b/i },
  { name: 'Nowgam', re: /\b(?:nowgam|nowgham|naogam|naugaon|railway\s*station)\b/i },
  { name: 'Rajbagh', re: /\b(?:rajbagh|raj\s*bagh|radio\s*colony)\b/i },
  { name: 'Jawahar Nagar', re: /\b(?:jawahar\s*nagar|jawaharnagar|jawar\s*nagar|jawhar\s*nagar|jawaher\s*nagar|dav\s*school)\b/i },
  { name: 'Batamaloo', re: /\b(?:batamaloo|batmaloo|batmalo)\b/i },
  { name: 'Bemina', re: /\b(?:bemina|khumani\s*chowk|hamdania\s*colony|jvc\s*bemina)\b/i },
  { name: 'Sonwar', re: /\b(?:sonwar|sonawar|sona\s*war|gb\s*pant)\b/i },
  { name: 'Iqbal Park', re: /\b(?:iqbal\s*park|shergari\s*police\s*station)\b/i },
  { name: 'Gogji Bagh', re: /\b(?:gogji\s*bagh|gogjibagh)\b/i },
  { name: 'Wazir Bagh', re: /\b(?:wazir\s*bagh|wazirbagh)\b/i },
  { name: 'Tulsi Bagh', re: /\b(?:tulsi\s*bagh|tulsibagh)\b/i },
  { name: 'Hazuri Bagh', re: /\b(?:hazuri\s*bagh|hazuribagh)\b/i },
  { name: 'Alochi Bagh', re: /\b(?:al[ol]+chi\s*bagh|alochi|allochi|aloochi|elachi\s*bagh)\b/i },
  { name: 'Magarmal Bagh', re: /\b(?:magarmal\s*bagh|magarmal)\b/i },
  { name: 'Baghat Barzulla', re: /\b(?:baghat\s*barzulla|baghat)\b/i },
  { name: 'Barzulla', re: /\b(?:barzulla|old\s*barzulla|bone\s*(?:&|and)\s*joint)\b/i },
  { name: 'Solina', re: /\b(?:solina|solina\s*balla|solina\s*payeen|rambagh|ram\s*bagh|silk\s*factory)\b/i },
  { name: 'Padshahi Bagh', re: /\b(?:padshahi\s*bagh|padshahibagh)\b/i },
  { name: 'Hyderpora', re: /\b(?:hyderpora|hyder\s*pora|hyderpura|haider\s*pora)\b/i },
  { name: 'Chanapora', re: /\b(?:chanapora|channapora|chanpora)\b/i },
  { name: 'Natipora', re: /\b(?:natipora|natipura)\b/i },
  { name: 'Rawalpora', re: /\b(?:rawalpora|rawalpora|rawapora)\b/i },
  { name: 'Bagh-e-Mehtab', re: /\b(?:bagh[- ]?e[- ]?mehtab|baghi\s*mehtab)\b/i },
  { name: 'Kralpora', re: /\b(?:kralpora|kral\s*pora)\b/i },
  { name: 'Rangreth', re: /\b(?:rangreth)\b/i },
  { name: 'Lasjan', re: /\b(?:lasjan|lassjan)\b/i },
  { name: 'Pantha Chowk', re: /\b(?:pantha\s*chowk|panthachowk|dps\s*school)\b/i },
  { name: 'Athwajan', re: /\b(?:athwajan|atwajan)\b/i },
  { name: 'Pandrathan', re: /\b(?:pandrathan)\b/i },
  { name: 'Soiteng', re: /\b(?:soiteng|suiteng|soitang)\b/i },
  { name: 'Pohru', re: /\b(?:pohru|pohroo)\b/i },
  { name: 'Mochu', re: /\b(?:mochu|moochu)\b/i },

  // Beyond 16 km / Outer Districts / Suburbs
  { name: 'Parimpora', re: /\b(?:parimpora|parim\s*pora|fruit\s*mandi)\b/i },
  { name: 'Shalteng', re: /\b(?:shalteng)\b/i },
  { name: 'HMT', re: /\b(?:hmt|zainakote|mustafabad)\b/i },
  { name: 'Lawaypora', re: /\b(?:lawaypora|lawapora|laway\s*pora)\b/i },
  { name: 'Harwan', re: /\b(?:harwan|chandpora|chinar\s*colony)\b/i },
  { name: 'Bagati Kanipora', re: /\b(?:bagati\s*kanipora|bk\s*pora|b\.?k\.?\s*pora|kanipora)\b/i },
  { name: 'Chadoora', re: /\b(?:chadoora|chadure)\b/i },
  { name: 'Ganderbal', re: /\b(?:ganderbal|beehama|duderhama|tulmulla|tullamulla|kangan)\b/i },
  { name: 'Budgam', re: /\b(?:budgam|ompora)\b/i },
  { name: 'Narbal', re: /\b(?:narbal|magam|beerwah)\b/i },
  { name: 'Pampore', re: /\b(?:pampore)\b/i },
  { name: 'Bandipora', re: /\b(?:bandipora|bandipore)\b/i },
  { name: 'Baramulla', re: /\b(?:baramulla)\b/i },
  { name: 'Sopore', re: /\b(?:sopore)\b/i },
  { name: 'Anantnag', re: /\b(?:anantnag|islamabad\s*kashmir)\b/i },
  { name: 'Pulwama', re: /\b(?:pulwama|awantipora|kakapora)\b/i },
  { name: 'Shopian', re: /\b(?:shopian)\b/i },
  { name: 'Kulgam', re: /\b(?:kulgam)\b/i },
  { name: 'Kupwara', re: /\b(?:kupwara|handwara)\b/i }
];

// Clean any UT / UTA / Lead auto-tags, bot placeholders, or greetings out of a raw contact string
function sanitizeRawContactName(raw) {
  if (!raw) return { cleanName: '', inferredArea: null };
  let s = String(raw).replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, '').trim();
  let inferredArea = null;

  // Strip repeated UT / UTA / star / flame / bullet prefixes
  let prev;
  do {
    prev = s;
    s = s
      .replace(/^UTA\s*[-–•*:\s]*/i, '')
      .replace(/^UT\s*[★🔥•*:\-–—\s]*/i, '')
      .replace(/^[★🔥•*:\-–—\s]+/, '')
      .replace(/\s*[-–•*:\s]*UTA$/i, '')
      .trim();
  } while (s !== prev && s.length > 0);

  // Strip auto-generated CRM suffixes like "Lead (3792)", "Hot Lead 1234", "Buyer (1234)", "Inquiry #5"
  if (/\b(?:Buyer|Hot\s*Lead|Price\s*Inquiry|Delivery\s*Inquiry|Store\s*Visit|Lead)\s*(?:\(?\d{3,4}\)?|#\d+)?$/i.test(s)) {
    // Rescue area if string was e.g. "Hyderpora Lead 3792" or "Qamarwari Buyer 1234"
    for (const a of expandedAreas) {
      if (a.re.test(s)) {
        inferredArea = a.name;
        break;
      }
    }
    s = s
      .replace(/\b(?:Buyer|Hot\s*Lead|Price\s*Inquiry|Delivery\s*Inquiry|Store\s*Visit|Lead)\s*(?:\(?\d{3,4}\)?|#\d+)?$/i, '')
      .trim();
  }

  s = s.replace(/\s{2,}/g, ' ').replace(/^[-–—•\s]+|[-–—•\s]+$/g, '').trim();

  // Strip trailing "(+91 ...)" or phone fragments before placeholder checks
  s = s.replace(/\s*\(\s*(?:\+?91[\s\-]?)?[6-9]\d{9}\s*\)\s*$/g, '').trim();

  // Reject non-name placeholders, greetings, bot brand strings, or phone numbers
  if (
    !s ||
    /^\+?\d[\d\s\-()]{5,}$/.test(s) ||
    /^(?:Customer|Valued\s*Customer|No\s*Name|Unknown|Guest|User|None|Null|Urban\s*Trout(?:\s*Aquaculture)?|Buyer|Hot\s*Lead|Lead|Inquiry|Store\s*Visit|Doorstep\s*COD\s*Customer|\d+(?:\.\d+)?\s*k(?:g|g?s)?|Cleaned|Gutted|Whole|Assalam[-\s]*o?[-\s]*Alaikum|Assalamu\s*alaikum|Asalamualikum|Salam|Walikum\s*Assalam|Hello|Hi|Hey|Okay|Ok|Thanks|Thank\s*you)$/i.test(s)
  ) {
    return { cleanName: '', inferredArea };
  }

  // If the entire string is ONLY a locality name (e.g. "Sanatnagar", "Hyderpora", "Batamaloo"), treat it as area, not personal name
  for (const a of expandedAreas) {
    const bare = s.replace(/[-–—]/g, ' ').trim();
    const wholeRe = new RegExp(`^(?:${a.re.source})$`, 'i');
    if (wholeRe.test(bare)) {
      return { cleanName: '', inferredArea: a.name };
    }
  }

  // If string ends with a known locality (e.g. "Abdal Mehjoor Peerbagh" or "Rafi Bakkal - Rajbagh"), separate cleanly
  for (const a of expandedAreas) {
    const trailingRe = new RegExp(`(?:\\s*[-–—]\\s*|\\s+)(?:${a.re.source})$`, 'i');
    if (trailingRe.test(s)) {
      const stripped = s.replace(trailingRe, '').replace(/[-–—\s]+$/, '').trim();
      if (stripped.length >= 2) {
        inferredArea = a.name;
        s = stripped;
        break;
      }
    }
  }

  // Ignore trailing area-less noise like "(Alt)" or dangling digits
  s = s.replace(/\s*\(\d{4}\)\s*$/, '').trim();
  if (!/[a-zA-Z]/.test(s) || s.length < 2) {
    return { cleanName: '', inferredArea };
  }

  return { cleanName: s, inferredArea };
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
  existingCandidates.sort((a, b) => b.mtime - a.mtime);
  const possiblePaths = existingCandidates.map(c => c.path);

  const primaryPhones = new Set(['9419153353', '919419153353']); // VVIP IAS Officer protected
  const utaPrimaryMap = new Map();
  let loadedFrom = null;
  let totalCards = 0;

  for (const vcfPath of possiblePaths) {
    if (fs.existsSync(vcfPath)) {
      try {
        const content = fs.readFileSync(vcfPath, 'utf8');
        const cards = content.split('END:VCARD').filter(c => c.includes('BEGIN:VCARD'));
        totalCards = cards.length;
        for (const card of cards) {
          const fnMatch = card.match(/FN:(.+)/i);
          const fn = fnMatch ? fnMatch[1].trim() : '';

          // Existing Urban Trout contacts (UTA / Urban Trout / UT •) stay eligible for Urban Trout updates
          if (/\b(?:UTA|Urban Trout)\b/i.test(fn) || /^UT\s*[★🔥•]/i.test(fn)) {
            const lines = card.split(/\r?\n/);
            for (const line of lines) {
              if (line.startsWith('TEL')) {
                const rawTel = line.substring(line.indexOf(':') + 1).replace(/\D/g, '').slice(-10);
                if (rawTel.length === 10) {
                  const sanitized = sanitizeRawContactName(fn);
                  utaPrimaryMap.set(rawTel, {
                    rawFn: fn,
                    cleanName: sanitized.cleanName,
                    inferredArea: sanitized.inferredArea
                  });
                }
              }
            }
            continue;
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
    console.log(
      `🛡️ [Primary Contacts Protection] Analysed ${totalCards} cards from "${path.basename(loadedFrom)}": ` +
      `${primaryPhones.size / 2} personal contacts protected, ${utaPrimaryMap.size} UTA business contacts synced.`
    );
  } else {
    console.warn(`⚠️ [Primary Contacts Protection] No primary contacts VCF found. Exclusions skipped.`);
  }

  return { primaryPhones, utaPrimaryMap, loadedFrom, totalCards };
}

function loadZoneDatabases() {
  let zoneDb = [];
  let customAreas = {};
  try {
    const p = path.join(__dirname, 'delivery_zone_db.json');
    if (fs.existsSync(p)) zoneDb = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}
  try {
    const cp = path.join(__dirname, 'custom_areas.json');
    if (fs.existsSync(cp)) customAreas = JSON.parse(fs.readFileSync(cp, 'utf8'));
  } catch (_) {}
  return { zoneDb, customAreas };
}

function findNearestDbLocality(lat, lng, zoneDb) {
  if (!lat || !lng || !Array.isArray(zoneDb) || zoneDb.length === 0) return null;
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return null;

  let best = null;
  let bestDist = Infinity;
  for (const place of zoneDb) {
    if (!place || place.lat == null || place.lon == null) continue;
    const d = haversineKm(latNum, lngNum, Number(place.lat), Number(place.lon));
    if (d < bestDist) {
      bestDist = d;
      best = place;
    }
  }
  if (!best || bestDist > 1.8) return null;

  // Prefer expandedArea canonical name if aliases/name map to a clean neighbourhood name
  const hay = [best.name, ...(Array.isArray(best.aliases) ? best.aliases : [])].join(' ');
  for (const a of expandedAreas) {
    if (a.re.test(hay)) return a.name;
  }
  return best.name;
}

// Strip farm-boilerplate references so "Malabagh farm" never overrides customer's real neighbourhood
function stripFarmBoilerplate(text) {
  if (!text) return '';
  return String(text)
    .replace(/\b(?:from|to|at|in|our|the|visit(?:\s+our)?|pickup\s+(?:at|from))\s+(?:our\s+)?(?:live\s+(?:trout\s+)?vending\s+cent(?:er|re)\s+(?:in|at)\s+)?malabagh(?:\s+(?:farm|hub|aquaculture|outlet|counter|tanks?))?\b/gi, ' ')
    .replace(/\bmalabagh\s+(?:farm|hub|aquaculture|outlet|counter|tanks?)\b/gi, ' ');
}

function extractLocality({
  userText = '',
  modelText = '',
  ownerText = '',
  meta = {},
  matchedOrder = null,
  inferredNameArea = null,
  locInfo = null,
  zoneDb = [],
  customAreas = {}
}) {
  const cleanUserText = stripFarmBoilerplate(userText);

  // 1. Customer's own words + pincode (highest source of truth!)
  const userPin = userText.match(/\b(19\d{4})\b/);
  if (userPin && PINCODE_MAP[userPin[1]]) {
    return PINCODE_MAP[userPin[1]];
  }

  if (cleanUserText) {
    for (const a of expandedAreas) {
      if (a.re.test(cleanUserText)) return a.name;
    }
    for (const cName of Object.keys(customAreas || {})) {
      if (cName.length < 4) continue;
      if (/^(?:police\s*station|hospital|masjid|mosque|bank|chowk|bridge|kadal|school|college|gate|petrol\s*pump|post\s*office|complex|bazar|market|stop|stand|srinagar)$/i.test(cName.trim())) continue;
      const esc = cName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${esc}\\b`, 'i').test(cleanUserText)) return cName;
    }
    for (const place of zoneDb || []) {
      if (!place.name || place.name.length < 4 || place.group === 'Road') continue;
      const esc = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${esc}\\b`, 'i').test(cleanUserText)) {
        for (const a of expandedAreas) {
          if (a.re.test(place.name)) return a.name;
        }
        return place.name;
      }
    }
  }

  // 2. Owner manual chat text (Suhail typing locality/address note)
  const cleanOwnerText = stripFarmBoilerplate(ownerText);
  if (cleanOwnerText) {
    for (const a of expandedAreas) {
      if (a.re.test(cleanOwnerText)) return a.name;
    }
  }

  // 3. Verified Order deliveryArea
  if (matchedOrder && matchedOrder.deliveryArea) {
    for (const a of expandedAreas) {
      if (a.re.test(matchedOrder.deliveryArea)) return a.name;
    }
  }

  // 4. Area rescued from saved primary/UTA name (e.g. "Abdal Mehjoor - Peerbagh")
  if (inferredNameArea) {
    return inferredNameArea;
  }

  // 5. Saved chatMetadata locality (guard against stale Malabagh/Khyber false positives!)
  if (meta && meta.localityName && !/^(?:Srinagar|Police Station|Hospital|Doorstep Delivery)$/i.test(meta.localityName)) {
    const mLoc = meta.localityName;
    if (mLoc === 'Khayam (Khyber Hospital)' && !/\b(?:khyber\s*hospital|khay+am)\b/i.test(userText)) {
      // Ignore false Khyber milk mention
    } else if (mLoc === 'Malabagh' && !/\bmalabagh\b/i.test(cleanUserText) && Number(meta.distanceKm) > 4.0) {
      // Ignore stale farm mention when GPS clearly says customer is >4km away
    } else {
      for (const a of expandedAreas) {
        if (a.re.test(mLoc)) return a.name;
      }
      return mLoc;
    }
  }

  // 6. Model explicit confirmation / pincode
  const modelPin = modelText.match(/\b(19\d{4})\b/);
  if (modelPin && PINCODE_MAP[modelPin[1]]) {
    return PINCODE_MAP[modelPin[1]];
  }

  const cleanModelText = stripFarmBoilerplate(modelText);
  if (cleanModelText) {
    for (const a of expandedAreas) {
      if (a.name === 'Malabagh') continue;
      const ackPattern = new RegExp(`(?:deliver(?:y|ing)?\\s+(?:express\\s+)?(?:right\\s+)?(?:in|to)\\s+(?:your\\s+doorstep\\s+in\\s+)?|rates\\s+for\\s+)(?:${a.re.source})`, 'i');
      if (ackPattern.test(cleanModelText)) return a.name;
    }
  }

  // 7. Reverse-geocode GPS pin via 453-landmark DB
  if (locInfo && locInfo.lat && locInfo.lng) {
    const nearest = findNearestDbLocality(locInfo.lat, locInfo.lng, zoneDb);
    if (nearest) return nearest;
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
        if (!/^(?:fresh|rainbow|trout|gutted|cleaned|steaks|delivery|doorstep|payment|price|rates|counter|please|assalam|salam|thank)/i.test(trimmed)) {
          return trimmed;
        }
      }
    }
  }
  return null;
}

function buildSmartContactName({ isBuyer, isPaymentSent, customerName, area, raw10, userLower = '' }) {
  const last4 = (raw10 || '').slice(-4);
  const prefix = isBuyer ? 'UT ★ •' : (isPaymentSent ? 'UT 🔥 •' : 'UT •');

  const sanitized = sanitizeRawContactName(customerName);
  const cleanName = sanitized.cleanName;
  const finalArea = (area && area !== 'Srinagar') ? area : (sanitized.inferredArea || null);

  if (cleanName) {
    if (finalArea && !cleanName.toLowerCase().includes(finalArea.toLowerCase())) {
      return `${prefix} ${cleanName} - ${finalArea}`;
    }
    return `${prefix} ${cleanName}`;
  }

  if (finalArea) {
    if (isBuyer) return `${prefix} ${finalArea} Buyer (${last4})`;
    if (isPaymentSent) return `${prefix} ${finalArea} Hot Lead (${last4})`;
    if (/visit|come to store|your location|outlet|counter/i.test(userLower)) {
      return `${prefix} ${finalArea} Store Visit (${last4})`;
    }
    return `${prefix} ${finalArea} Lead (${last4})`;
  }

  if (isBuyer) return `${prefix} Buyer (${last4})`;
  if (isPaymentSent) return `${prefix} Hot Lead (${last4})`;
  if (/visit|come to store|your location|outlet|counter/i.test(userLower)) {
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

/**
 * Full Nightly & On-Demand Chat-Archive Scan + Contact Enrichment + Primary-Safe vCard Export.
 * Scans chat_histories.json, daily_chat_archive/*.jsonl, customer_orders.json, chat_metadata.json,
 * and whatsapp_contacts_map.json; repairs polluted UT prefixes; backfills Name - Location into
 * metadata & contacts; and exports clean Urban_Trout_Contacts.vcf.
 */
function enrichContactsFromChats(options = {}) {
  const { updateMetadata = true, silent = false } = options;
  const authDir = path.join(__dirname, 'auth_info_baileys');
  const chatsPath = path.join(__dirname, 'chat_histories.json');
  if (!fs.existsSync(chatsPath)) {
    if (!silent) console.error('chat_histories.json not found');
    return [];
  }

  const { primaryPhones, utaPrimaryMap } = loadPrimaryPhones();
  const { zoneDb, customAreas } = loadZoneDatabases();
  let skippedPrimaryCount = 0;

  const chats = JSON.parse(fs.readFileSync(chatsPath, 'utf8'));

  let orders = {};
  const ordersPath = path.join(__dirname, 'customer_orders.json');
  if (fs.existsSync(ordersPath)) {
    try { orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8')); } catch (_) {}
  }

  let chatMetadata = {};
  const metaPath = path.join(__dirname, 'chat_metadata.json');
  if (fs.existsSync(metaPath)) {
    try { chatMetadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) {}
  }

  let whatsappContactsMap = {};
  const contactsMapPath = path.join(__dirname, 'whatsapp_contacts_map.json');
  if (fs.existsSync(contactsMapPath)) {
    try { whatsappContactsMap = JSON.parse(fs.readFileSync(contactsMapPath, 'utf8')); } catch (_) {}
  }

  // Clean polluted UT/Lead names out of whatsappContactsMap in memory (and persist if updateMetadata)
  let cleanedMapCount = 0;
  for (const [k, rec] of Object.entries(whatsappContactsMap)) {
    if (!rec || !rec.name) continue;
    const { cleanName } = sanitizeRawContactName(rec.name);
    if (!cleanName) {
      delete whatsappContactsMap[k];
      cleanedMapCount++;
    } else if (cleanName !== rec.name) {
      whatsappContactsMap[k].name = cleanName;
      cleanedMapCount++;
    }
  }
  if (updateMetadata && cleanedMapCount > 0) {
    try {
      fs.writeFileSync(contactsMapPath, JSON.stringify(whatsappContactsMap, null, 2), 'utf8');
    } catch (_) {}
  }

  const OWNER_EXCLUDED_PHONES = new Set(['7006604148']);

  // Build LID -> real phone index from chatMetadata, customer_orders, and whatsapp_contacts_map
  const lidToPhoneMap = new Map();
  for (const [k, v] of Object.entries(chatMetadata)) {
    if (k.endsWith('@lid') && v && v.phone) {
      const d = String(v.phone).replace(/\D/g, '');
      if (/^(?:91)?[6-9]\d{9}$/.test(d) || (d.length >= 11 && d.length <= 13)) {
        lidToPhoneMap.set(k, d);
      }
    }
  }
  for (const o of Object.values(orders)) {
    if (o && o.chatId && String(o.chatId).endsWith('@lid') && o.phone) {
      const d = String(o.phone).replace(/\D/g, '');
      if (d.length >= 10 && d.length <= 13) lidToPhoneMap.set(o.chatId, d);
    }
  }
  for (const [k, rec] of Object.entries(whatsappContactsMap)) {
    if (rec && rec.jid && String(rec.jid).endsWith('@lid') && /^(?:91)?[6-9]\d{9}$/.test(k)) {
      lidToPhoneMap.set(rec.jid, k.length === 10 ? `91${k}` : k);
    }
  }

  function isValidMobileDigits(digits) {
    if (!digits) return false;
    if (/^(?:91)?[6-9]\d{9}$/.test(digits)) return true;
    // Allow non-Indian international numbers only if explicitly <= 13 digits and not a 14+ digit @lid
    return digits.length >= 10 && digits.length <= 13 && !digits.startsWith('1') && !digits.startsWith('2');
  }

  function resolvePhoneFromJid(jid) {
    if (!jid) return '';
    const key = String(jid).trim();
    if (key.endsWith('@s.whatsapp.net')) {
      const d = key.replace('@s.whatsapp.net', '').replace(/\D/g, '');
      return d.length >= 10 && d.length <= 13 ? d : '';
    }
    if (key.endsWith('@lid')) {
      if (lidToPhoneMap.has(key)) return lidToPhoneMap.get(key);
      const cleanId = key.replace('@lid', '');
      try {
        const revPath = path.join(authDir, `lid-mapping-${cleanId}_reverse.json`);
        if (fs.existsSync(revPath)) {
          const mapped = JSON.parse(fs.readFileSync(revPath, 'utf8'));
          if (mapped) {
            const d = String(mapped).replace(/\D/g, '');
            if (d.length >= 10 && d.length <= 13) return d;
          }
        }
      } catch (_) {}
      return ''; // Unresolved @lid must NEVER become a fake +91 contact
    }
    const bare = key.replace(/\D/g, '');
    return isValidMobileDigits(bare) ? bare : '';
  }

  // Merge all messages per last-10 phone from BOTH chat_histories.json AND daily_chat_archive/*.jsonl
  const archiveByPhone = new Map(); // raw10 -> { jids: Set, userMsgs: [], ownerMsgs: [], modelMsgs: [], pushNames: [], latestTs: 0 }
  function ensurePhoneBucket(raw10) {
    if (!raw10 || raw10.length !== 10 || OWNER_EXCLUDED_PHONES.has(raw10)) return null;
    if (!archiveByPhone.has(raw10)) {
      archiveByPhone.set(raw10, {
        jids: new Set(),
        userMsgs: [],
        ownerMsgs: [],
        modelMsgs: [],
        pushNames: [],
        latestTs: 0
      });
    }
    return archiveByPhone.get(raw10);
  }

  // Load daily JSONL archive files (oldest to newest)
  const dailyDir = path.join(__dirname, 'daily_chat_archive');
  if (fs.existsSync(dailyDir)) {
    const jsonlFiles = fs.readdirSync(dailyDir).filter(f => f.endsWith('.jsonl')).sort();
    for (const jf of jsonlFiles) {
      try {
        const lines = fs.readFileSync(path.join(dailyDir, jf), 'utf8').split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          try {
            const ev = JSON.parse(line);
            const rawPhone = String(ev.phone || '').replace(/\D/g, '');
            const p = isValidMobileDigits(rawPhone) ? rawPhone : resolvePhoneFromJid(ev.jid || '');
            if (!p || p.length < 10) continue;
            const raw10 = p.slice(-10);
            const bucket = ensurePhoneBucket(raw10);
            if (!bucket) continue;
            if (ev.jid) bucket.jids.add(ev.jid);
            const ts = ev.ts ? new Date(ev.ts).getTime() : 0;
            if (ts > bucket.latestTs) bucket.latestTs = ts;
            if (ev.role === 'customer') {
              if (ev.text) bucket.userMsgs.push(ev.text);
              if (ev.name) bucket.pushNames.push(ev.name);
            } else if (ev.role === 'owner_manual') {
              if (ev.text) bucket.ownerMsgs.push(ev.text);
            } else if (ev.role === 'ai_bot') {
              if (ev.text) bucket.modelMsgs.push(ev.text);
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
  }

  // Merge chat_histories.json into buckets
  for (const [jid, msgs] of Object.entries(chats)) {
    if (!Array.isArray(msgs)) continue;
    const p = resolvePhoneFromJid(jid);
    if (!p || p.length < 10) continue;
    const raw10 = p.slice(-10);
    const bucket = ensurePhoneBucket(raw10);
    if (!bucket) continue;
    bucket.jids.add(jid);
    for (const m of msgs) {
      if (!m || !m.text) continue;
      if (m.role === 'user') bucket.userMsgs.push(m.text);
      else if (m.role === 'model') bucket.modelMsgs.push(m.text);
    }
  }

  // Merge chat_metadata keys into buckets so metadata-only inquiries are included too
  for (const [k, v] of Object.entries(chatMetadata)) {
    if (!v) continue;
    const metaPhone = String(v.phone || '').replace(/\D/g, '');
    const p = isValidMobileDigits(metaPhone) ? metaPhone : resolvePhoneFromJid(k);
    if (!p || p.length < 10) continue;
    const raw10 = p.slice(-10);
    const bucket = ensurePhoneBucket(raw10);
    if (!bucket) continue;
    if (k.includes('@')) bucket.jids.add(k);
    const ts = Math.max(Number(v.lastUserMsgTime) || 0, Number(v.lastBotMsgTime) || 0);
    if (ts > bucket.latestTs) bucket.latestTs = ts;
    if (v.pushName) bucket.pushNames.push(v.pushName);
    if (v.lastUserText) bucket.userMsgs.push(v.lastUserText);
  }

  // Build verified GPS pin index across metadata, orders, and merged chats
  const phoneToLocation = new Map();
  for (const [k, v] of Object.entries(chatMetadata)) {
    if (!v) continue;
    const phone = (v.phone || resolvePhoneFromJid(k)).replace(/\D/g, '');
    if (phone.length < 10) continue;
    const last10 = phone.slice(-10);
    if (v.latitude && v.longitude) {
      phoneToLocation.set(last10, {
        lat: v.latitude,
        lng: v.longitude,
        mapsUrl: v.googleMapsUrl || `https://maps.google.com/?q=${v.latitude},${v.longitude}`,
        dist: v.distanceKm != null ? Number(v.distanceKm).toFixed(1) : null
      });
    }
  }
  for (const o of Object.values(orders)) {
    if (!o) continue;
    const p = (o.customerPhone || o.phone || '').replace(/\D/g, '').slice(-10);
    if (p.length === 10 && o.latitude && o.longitude) {
      phoneToLocation.set(p, {
        lat: o.latitude,
        lng: o.longitude,
        mapsUrl: o.googleMapsUrl || `https://maps.google.com/?q=${o.latitude},${o.longitude}`,
        dist: o.distanceKm != null ? Number(o.distanceKm).toFixed(1) : null
      });
    }
  }
  for (const [raw10, bucket] of archiveByPhone.entries()) {
    for (const msgText of [...bucket.userMsgs, ...bucket.modelMsgs]) {
      const urlMatch = msgText.match(/(https?:\/\/(?:maps\.google\.com|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]*)/i);
      const coordMatch = msgText.match(/(-?\d{1,2}\.\d{4,10})[,\s]+(-?\d{1,3}\.\d{4,10})/);
      const distMatch = msgText.match(/(\d+(?:\.\d+)?)\s*km\s*from\s*(?:our\s*)?Malabagh/i);
      if (urlMatch || coordMatch) {
        if (urlMatch && /6FT5iLk5n8mbKSRU9/i.test(urlMatch[1])) continue;
        const existing = phoneToLocation.get(raw10) || {};
        if (urlMatch && !existing.mapsUrl && !/6FT5iLk5n8mbKSRU9/i.test(urlMatch[1])) existing.mapsUrl = urlMatch[1];
        if (coordMatch && !existing.lat) {
          existing.lat = coordMatch[1];
          existing.lng = coordMatch[2];
          if (!existing.mapsUrl) existing.mapsUrl = `https://maps.google.com/?q=${existing.lat},${existing.lng}`;
        }
        if (distMatch && !existing.dist) existing.dist = Number(distMatch[1]).toFixed(1);
        phoneToLocation.set(raw10, existing);
      }
    }
  }

  if (!silent) {
    console.log(`📍 [Location Intelligence] Loaded verified Google Maps links for ${phoneToLocation.size} contacts.`);
  }

  const contacts = [];
  const seenPhones = new Set();
  let enrichedMetaUpdates = 0;

  // Helper to resolve merged metadata across @lid + @s.whatsapp.net + raw10 keys
  function getMergedMeta(raw10, jidsSet) {
    const merged = { ...(chatMetadata[raw10] || {}), ...(chatMetadata[`91${raw10}`] || {}) };
    for (const j of jidsSet) {
      if (chatMetadata[j]) Object.assign(merged, chatMetadata[j]);
    }
    return merged;
  }

  // Helper to pick best non-polluted customer name + any rescued area
  function resolveBestCustomerName({ raw10, jidsSet, matchedOrder, meta, userMsgs, modelMsgs, bucketPushNames }) {
    let candidates = [];

    if (matchedOrder && matchedOrder.name) candidates.push(matchedOrder.name);

    // Check whatsapp_contacts_map (raw10, 91+raw10, @lid, cleanId)
    for (const key of [raw10, `91${raw10}`, `${raw10}@s.whatsapp.net`, ...jidsSet, ...[...jidsSet].map(j => j.replace('@lid', '').replace('@s.whatsapp.net', ''))]) {
      const entry = whatsappContactsMap[key];
      if (entry && entry.name) candidates.push(entry.name);
    }

    if (meta && meta.pushName) candidates.push(meta.pushName);
    for (const pn of bucketPushNames || []) candidates.push(pn);

    // UTA primary map (placed after live WhatsApp pushName if UTA entry was ONLY a bare area like "Sanatnagar")
    let utaInfo = utaPrimaryMap && utaPrimaryMap.has(raw10) ? utaPrimaryMap.get(raw10) : null;
    if (utaInfo && utaInfo.cleanName) {
      candidates.unshift(utaInfo.cleanName);
    }

    let chosenName = '';
    let rescuedArea = utaInfo && utaInfo.inferredArea ? utaInfo.inferredArea : null;

    for (const cand of candidates) {
      const res = sanitizeRawContactName(cand);
      if (res.inferredArea && !rescuedArea) rescuedArea = res.inferredArea;
      if (res.cleanName && !chosenName) {
        chosenName = res.cleanName;
      }
    }

    // Extract self-introductions or multi-line address headers if still missing
    if (!chosenName) {
      for (const text of userMsgs || []) {
        const introMatch = text.match(/\b(?:my\s*name\s*is|name\s*is|name\s*:|this\s*is)\s+([A-Za-z\s]{3,25})/i);
        if (introMatch) {
          const res = sanitizeRawContactName(introMatch[1]);
          if (res.cleanName && !/^(?:fresh|trout|delivery|order|pan|cleaned|gutted|kg|kilo|cash|online|upi|getting|outside|in\s*a\s*meeting)/i.test(res.cleanName)) {
            chosenName = res.cleanName;
            break;
          }
        }
        const addrName = extractNameFromAddressLines(text);
        if (addrName) {
          const res = sanitizeRawContactName(addrName);
          if (res.cleanName) {
            chosenName = res.cleanName;
            break;
          }
        }
      }
    }

    if (!chosenName) {
      for (const text of modelMsgs || []) {
        const greetingMatch = text.match(/Assalam-o-Alaikum[,\s]+([A-Za-z\s]{3,20})[!]/i);
        if (greetingMatch) {
          const candidate = greetingMatch[1].trim();
          if (!['welcome', 'glad', 'customer', 'valued', 'munir', 'tabasum', 'abdul majid', 'idrees', 'ayesha', 'syed shabnum'].includes(candidate.toLowerCase())) {
            chosenName = candidate;
            break;
          }
        }
      }
    }

    return { customerName: chosenName, inferredNameArea: rescuedArea };
  }

  // 1. Export & enrich all contacts with chat/archive/metadata footprint
  for (const [raw10, bucket] of archiveByPhone.entries()) {
    const fullPhone = `91${raw10}`;
    if (seenPhones.has(fullPhone) || OWNER_EXCLUDED_PHONES.has(raw10)) continue;

    const meta = getMergedMeta(raw10, bucket.jids);
    const matchedOrder =
      orders[raw10] ||
      Object.values(orders).find(o => bucket.jids.has(o.chatId) || (o.phone && o.phone.replace(/\D/g, '').endsWith(raw10)));

    const userText = bucket.userMsgs.join(' ');
    const ownerText = bucket.ownerMsgs.join(' ');
    const modelText = bucket.modelMsgs.join(' ');
    const allText = `${userText} ${ownerText} ${modelText}`;

    const isBuyer =
      (matchedOrder && /(?:paid|confirmed|harvest|deliver|out)/i.test(matchedOrder.status || '')) ||
      /(?:payment (?:has been )?(?:successfully )?received|payment (?:received & )?order confirmed|payment verified|live harvest scheduled|\bpaid & confirmed\b)/i.test(allText);

    const isPaymentSent =
      !isBuyer &&
      ((matchedOrder && /payment link sent/i.test(matchedOrder.status || '')) ||
        /(?:rzp\.io|payment link)/i.test(allText));

    // Skip personal primary contacts (unless UTA business contact or verified buyer)
    if (primaryPhones.has(raw10) && !isBuyer && !(utaPrimaryMap && utaPrimaryMap.has(raw10))) {
      skippedPrimaryCount++;
      continue;
    }

    seenPhones.add(fullPhone);

    // Resolve CreatedAt timestamp cleanly
    let createdAtTs = bucket.latestTs || Number(meta.lastUserMsgTime) || Number(meta.lastBotMsgTime) || 0;
    if (!createdAtTs) {
      for (const j of bucket.jids) {
        if (j.endsWith('@lid')) {
          const revPath = path.join(authDir, `lid-mapping-${j.replace('@lid', '')}_reverse.json`);
          if (fs.existsSync(revPath)) {
            try { createdAtTs = fs.statSync(revPath).mtimeMs; break; } catch (_) {}
          }
        }
      }
    }
    if (!createdAtTs) createdAtTs = new Date('2026-10-01T08:00:00Z').getTime();

    const { customerName, inferredNameArea } = resolveBestCustomerName({
      raw10,
      jidsSet: bucket.jids,
      matchedOrder,
      meta,
      userMsgs: bucket.userMsgs,
      modelMsgs: bucket.modelMsgs,
      bucketPushNames: bucket.pushNames
    });

    const locInfo = phoneToLocation.get(raw10) || null;
    const area = extractLocality({
      userText,
      ownerText,
      modelText,
      meta,
      matchedOrder,
      inferredNameArea,
      locInfo,
      zoneDb,
      customAreas
    });

    // Backfill newly discovered locality/name back into chat_metadata.json during nightly scan!
    if (updateMetadata) {
      const targetKeys = [raw10, ...bucket.jids];
      for (const k of targetKeys) {
        if (chatMetadata[k]) {
          if (area && area !== 'Srinagar' && chatMetadata[k].localityName !== area) {
            // Avoid clobbering if we merely had Malabagh/Khyber false tag earlier
            if (
              !chatMetadata[k].localityName ||
              chatMetadata[k].localityName === 'Srinagar' ||
              chatMetadata[k].localityName === 'Police Station' ||
              chatMetadata[k].localityName === 'Khayam (Khyber Hospital)' ||
              (chatMetadata[k].localityName === 'Malabagh' && area !== 'Malabagh')
            ) {
              chatMetadata[k].localityName = area;
              enrichedMetaUpdates++;
            }
          }
          if (customerName && !chatMetadata[k].resolvedCustomerName) {
            chatMetadata[k].resolvedCustomerName = customerName;
          }
        }
      }
    }

    const userLower = userText.toLowerCase();
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

    const lastUserText = bucket.userMsgs.length > 0
      ? bucket.userMsgs[bucket.userMsgs.length - 1].replace(/[\r\n",]/g, ' ').slice(0, 120).trim()
      : 'Inquiry';

    const dateTag = new Date(createdAtTs).toISOString().slice(0, 10);
    let contactNotes = `Urban Trout Customer | Name: ${customerName || 'Inquirer'} | Locality: ${area || 'Srinagar'} | Date: ${dateTag}`;
    if (locInfo && locInfo.mapsUrl) {
      contactNotes = `📍 Google Maps: ${locInfo.mapsUrl}${locInfo.dist ? ` (~${locInfo.dist} km from farm)` : ''}\n${contactNotes}`;
    }
    contactNotes += ` | Last: ${lastUserText}`;

    contacts.push({
      fullName,
      givenName,
      familyName,
      phone: `+${fullPhone}`,
      cleanPhone: raw10,
      customerName: customerName || '',
      area: area || 'Srinagar',
      createdAt: createdAtTs,
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
            customerName: customerName || '',
            area: area || 'Srinagar',
            createdAt: createdAtTs,
            notes: `Urban Trout Customer (Alt Phone) | Locality: ${area || 'Srinagar'} | For: ${fullName}`
          });
        }
      }
    }
  }

  // 2. Standalone orders from customer_orders.json without chat histories
  for (const [orderKey, order] of Object.entries(orders)) {
    const orderPhone = (order.phone || (order.name && order.name.match(/\d{10}/) ? order.name.match(/\d{10}/)[0] : '') || '').replace(/\D/g, '');
    if (orderPhone.length < 10) continue;
    const raw10 = orderPhone.slice(-10);
    const fullPhone = '91' + raw10;
    if (seenPhones.has(fullPhone) || OWNER_EXCLUDED_PHONES.has(raw10)) continue;

    const isBuyer = /(?:paid|confirmed|harvest|deliver|out)/i.test(order.status || '');
    const isPaymentSent = !isBuyer && /payment link sent/i.test(order.status || '');

    if (primaryPhones.has(raw10) && !isBuyer && !(utaPrimaryMap && utaPrimaryMap.has(raw10))) {
      skippedPrimaryCount++;
      continue;
    }
    seenPhones.add(fullPhone);

    const { customerName, inferredNameArea } = resolveBestCustomerName({
      raw10,
      jidsSet: new Set(order.chatId ? [order.chatId] : []),
      matchedOrder: order,
      meta: {},
      userMsgs: [],
      modelMsgs: [],
      bucketPushNames: []
    });

    const locInfo = phoneToLocation.get(raw10) || null;
    const area = extractLocality({
      userText: order.notes || '',
      matchedOrder: order,
      inferredNameArea,
      locInfo,
      zoneDb,
      customAreas
    });

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
  }

  // Persist backfilled locality & cleaned names to chat_metadata.json
  if (updateMetadata && enrichedMetaUpdates > 0) {
    try {
      fs.writeFileSync(metaPath, JSON.stringify(chatMetadata, null, 2), 'utf8');
      if (!silent) console.log(`🧠 [Chat Enrichment] Updated ${enrichedMetaUpdates} locality entries across chat_metadata.json.`);
    } catch (_) {}
  }

  // Sort newest first
  contacts.sort((a, b) => b.createdAt - a.createdAt);

  // Standard vCard 3.0 (.vcf) Format
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
    if (c.mapsUrl) lines.push(`URL;TYPE=WORK:${c.mapsUrl}`);
    if (c.lat && c.lng) lines.push(`GEO:${c.lat};${c.lng}`);
    lines.push(`NOTE:${c.notes.replace(/\r?\n/g, '\\n')}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  }).join('\r\n') + '\r\n';

  const desktopDir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null;
  const localVcf = path.join(__dirname, 'Urban_Trout_Contacts.vcf');
  const jsonDbPath = path.join(__dirname, 'contacts_database.json');

  if (desktopDir && fs.existsSync(desktopDir)) {
    try {
      const contactsFolder = path.join(desktopDir, 'Urban Trout', 'Contacts');
      if (!fs.existsSync(contactsFolder)) fs.mkdirSync(contactsFolder, { recursive: true });
      const desktopVcf = path.join(contactsFolder, 'Urban_Trout_Contacts.vcf');
      fs.writeFileSync(desktopVcf, vcfContent, 'utf8');
      if (!silent) console.log(`📁 Desktop vCard: ${desktopVcf}`);
    } catch (_) {}
  }
  fs.writeFileSync(localVcf, vcfContent, 'utf8');
  fs.writeFileSync(jsonDbPath, JSON.stringify(contacts, null, 2), 'utf8');

  if (!silent) {
    const namedWithLoc = contacts.filter(c => c.customerName && c.area && c.area !== 'Srinagar').length;
    console.log(`✅ Exported ${contacts.length} unique Urban Trout contacts (${namedWithLoc} with "Name - Location"):`);
    if (skippedPrimaryCount > 0) {
      console.log(`🛡️ Preserved privacy: excluded ${skippedPrimaryCount} personal contacts from My Primary Contacts.vcf.`);
    }
    console.log(`📁 Local vCard:   ${localVcf}`);
    console.log(`📁 JSON Database: ${jsonDbPath}`);
  }

  return contacts;
}

function exportContacts() {
  return enrichContactsFromChats({ updateMetadata: true, silent: false });
}

if (require.main === module) {
  exportContacts();
}

module.exports = { exportContacts, enrichContactsFromChats, loadPrimaryPhones, sanitizeRawContactName };
