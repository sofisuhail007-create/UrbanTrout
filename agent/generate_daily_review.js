const fs = require('fs');
const path = require('path');

function getIstDateKey(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
}

function getIstTimeStr(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatPm2DateMatch(dateKey) {
  // Converts 2026-11-10 -> "10 Nov 2026" (matching toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }))
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function readJsonSafe(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (_) {}
  return fallback;
}

function normalizePhone(str = '') {
  const digits = String(str).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return '';
}

function generateDailyReview(targetDate = null) {
  const dateKey = targetDate || getIstDateKey(Date.now());
  const pm2DateLabel = formatPm2DateMatch(dateKey);
  const agentDir = __dirname;
  const archiveDayDir = path.join(agentDir, 'daily_chat_archive', dateKey);
  const rawDayDir = path.join(archiveDayDir, 'raw');

  if (!fs.existsSync(archiveDayDir)) fs.mkdirSync(archiveDayDir, { recursive: true });

  // Prefer pulled snapshot inside rawDayDir if present, otherwise fall back to agentDir
  const pickFile = (name) => {
    const p1 = path.join(rawDayDir, name);
    const p2 = path.join(agentDir, name);
    return fs.existsSync(p1) ? p1 : p2;
  };

  const metadata = readJsonSafe(pickFile('chat_metadata.json'), {});
  const histories = readJsonSafe(pickFile('chat_histories.json'), {});
  const orders = readJsonSafe(pickFile('customer_orders.json'), {});
  const contactsMap = readJsonSafe(pickFile('whatsapp_contacts_map.json'), {});

  // Check full JSONL transcript from daily_chat_archive/YYYY-MM-DD.jsonl (or raw)
  const jsonlCandidates = [
    path.join(rawDayDir, 'daily_chat_archive', `${dateKey}.jsonl`),
    path.join(agentDir, 'daily_chat_archive', `${dateKey}.jsonl`)
  ];
  const jsonlEvents = [];
  for (const jp of jsonlCandidates) {
    if (fs.existsSync(jp)) {
      const lines = fs.readFileSync(jp, 'utf8').split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          jsonlEvents.push(JSON.parse(line));
        } catch (_) {}
      }
      break;
    }
  }

  // Group JSONL events by customer phone/JID
  const jsonlByKey = new Map();
  for (const ev of jsonlEvents) {
    const key = normalizePhone(ev.phone) || ev.jid || 'unknown';
    if (!jsonlByKey.has(key)) jsonlByKey.set(key, []);
    jsonlByKey.get(key).push(ev);
  }

  // Extract active chats from metadata matching target date
  const activeChatsByPhone = new Map();
  for (const [jidOrPhone, meta] of Object.entries(metadata)) {
    if (!meta || typeof meta !== 'object') continue;
    const isToday = [
      meta.lastUserMsgTime,
      meta.lastBotMsgTime,
      meta.lastHumanMsgTime,
      meta.locationUpdatedAt
    ].some((t) => getIstDateKey(t) === dateKey);

    if (!isToday) continue;

    const clean10 = normalizePhone(meta.phone) || normalizePhone(jidOrPhone);
    const dedupKey = clean10 || jidOrPhone;

    const existing = activeChatsByPhone.get(dedupKey);
    const currentLatest = Math.max(meta.lastUserMsgTime || 0, meta.lastBotMsgTime || 0, meta.lastHumanMsgTime || 0);
    const existingLatest = existing ? existing.latestTs : -1;

    // Merge JID preference (prefer @s.whatsapp.net or @lid over raw 10-digit key)
    const jidCandidate = String(jidOrPhone).includes('@') ? jidOrPhone : (existing?.jid || jidOrPhone);

    if (!existing || currentLatest >= existingLatest) {
      activeChatsByPhone.set(dedupKey, {
        key: dedupKey,
        phone: clean10,
        jid: jidCandidate,
        meta: { ...(existing?.meta || {}), ...meta },
        latestTs: Math.max(currentLatest, existingLatest)
      });
    } else if (String(jidOrPhone).includes('@') && !String(existing.jid).includes('@')) {
      existing.jid = jidOrPhone;
    }
  }

  // Ensure every JSONL participant also has an entry even if metadata was absent
  for (const [key, evs] of jsonlByKey.entries()) {
    if (!activeChatsByPhone.has(key)) {
      const first = evs[0] || {};
      const last = evs[evs.length - 1] || {};
      activeChatsByPhone.set(key, {
        key,
        phone: normalizePhone(first.phone) || (key.length === 10 ? key : ''),
        jid: first.jid || key,
        meta: {
          pushName: first.name || '',
          lastUserText: last.text || '',
          lastUserMsgTime: Date.parse(last.ts) || Date.now()
        },
        latestTs: Date.parse(last.ts) || Date.now()
      });
    }
  }

  // Parse PM2 stdout log for target date if present (catches full untruncated turns & Human Entry events)
  const pm2LogPath = path.join(rawDayDir, 'pm2_out.log');
  const pm2ErrPath = path.join(rawDayDir, 'pm2_err.log');
  const pm2ChatBlocks = [];
  const pm2HumanInterventions = [];
  const pm2Errors = [];

  if (fs.existsSync(pm2LogPath)) {
    const logLines = fs.readFileSync(pm2LogPath, 'utf8').split(/\r?\n/);
    let capturingBlock = false;
    let currentBlock = [];
    for (const line of logLines) {
      if (line.includes('[INCOMING WHATSAPP CHAT]') && line.includes(pm2DateLabel)) {
        capturingBlock = true;
        currentBlock = [line];
        continue;
      }
      if (line.includes('[LOCATION PIN RECEIVED]') && line.includes(pm2DateLabel)) {
        capturingBlock = true;
        currentBlock = [line];
        continue;
      }
      if (capturingBlock) {
        currentBlock.push(line);
        if (line.includes('└─')) {
          pm2ChatBlocks.push(currentBlock.join('\n'));
          capturingBlock = false;
          currentBlock = [];
        }
      }
      if (line.includes('[Human Entry]') || line.includes('[CUSTOMER ESCALATION DETECTED]') || line.includes('[QR Guard]')) {
        pm2HumanInterventions.push(line.trim());
      }
    }
  }
  if (fs.existsSync(pm2ErrPath)) {
    const errLines = fs.readFileSync(pm2ErrPath, 'utf8').split(/\r?\n/).filter(Boolean);
    pm2Errors.push(...errLines.slice(-30));
  }

  // Orders created or updated on target date
  const todayOrders = [];
  for (const [k, ord] of Object.entries(orders)) {
    if (!ord || typeof ord !== 'object') continue;
    const isOrderToday = [ord.createdAt, ord.updatedAt, ord.paidAt].some((t) => getIstDateKey(t) === dateKey);
    if (isOrderToday) {
      todayOrders.push({ key: k, ...ord });
    }
  }

  // Build Supervised Learning Priority Signals
  const sortedChats = Array.from(activeChatsByPhone.values()).sort((a, b) => b.latestTs - a.latestTs);
  const supervisedPriorities = [];

  for (const c of sortedChats) {
    const m = c.meta || {};
    const jidHist = histories[c.jid] || histories[`91${c.phone}@s.whatsapp.net`] || [];
    const evs = jsonlByKey.get(c.key) || [];
    const hasOwnerManual = evs.some((e) => e.role === 'owner_manual') || m.lastMsgRole === 'human';
    const hasEscalation = evs.some((e) => e.meta && e.meta.escalation);
    const pendingUser = m.lastMsgRole === 'user';
    const reasons = [];
    if (hasOwnerManual) reasons.push('Owner took over manually (check what AI missed)');
    if (hasEscalation) reasons.push('Customer escalation detected');
    if (pendingUser) reasons.push('Last message was from customer (verify if answered or paused)');
    if (!m.localityName || m.localityName.includes('Pending')) reasons.push('Location still pending');

    if (reasons.length > 0) {
      supervisedPriorities.push({
        phone: c.phone || c.jid,
        name: m.pushName || contactsMap[c.jid] || contactsMap[`91${c.phone}@s.whatsapp.net`] || 'Unknown',
        area: m.localityName || 'Unknown',
        reasons,
        lastUser: m.lastUserText || '',
        lastBot: m.lastBotReply || '',
        lastHuman: m.lastHumanReply || '',
        msgCount: Math.max(evs.length, jidHist.length)
      });
    }
  }

  // Compose Markdown Daily Review
  const out = [];
  out.push(`# Urban Trout Daily Chat & Supervised Learning Record — ${dateKey} (${pm2DateLabel})`);
  out.push('');
  out.push(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  out.push('');
  out.push('## Summary');
  out.push(`- **Active Customer Chats (${dateKey}):** ${sortedChats.length}`);
  out.push(`- **Full Logged Turns (JSONL):** ${jsonlEvents.length}`);
  out.push(`- **PM2 Log Turn Blocks (${pm2DateLabel}):** ${pm2ChatBlocks.length}`);
  out.push(`- **Orders Touched Today:** ${todayOrders.length}`);
  out.push(`- **Supervised Review Priorities:** ${supervisedPriorities.length}`);
  out.push('');

  out.push('## 1. Supervised Learning Priorities (Review & Teach AI From These)');
  if (supervisedPriorities.length === 0) {
    out.push('_No manual interventions or escalations flagged in metadata for this date._');
  } else {
    for (const p of supervisedPriorities) {
      out.push(`### ${p.name} (+91 ${p.phone}) — Area: ${p.area}`);
      out.push(`- **Flags:** ${p.reasons.join(' | ')}`);
      if (p.lastUser) out.push(`- **Last Customer Msg:** "${p.lastUser.replace(/\n+/g, ' ')}"`);
      if (p.lastBot) out.push(`- **Last AI Reply:** "${p.lastBot.replace(/\n+/g, ' ')}"`);
      if (p.lastHuman) out.push(`- **Owner Manual Reply:** "${p.lastHuman.replace(/\n+/g, ' ')}"`);
      out.push('');
    }
  }
  out.push('');

  out.push(`## 2. Orders Created / Updated on ${dateKey}`);
  if (todayOrders.length === 0) {
    out.push('_No orders recorded in customer_orders.json for this date._');
  } else {
    for (const o of todayOrders) {
      out.push(`- **#${o.orderRef || o.key}** | ${o.name || 'Customer'} (+91 ${o.phone || 'N/A'}) | ${o.items || ''} | **${o.amount || ''}** | Status: \`${o.status || ''}\` | Area: ${o.deliveryArea || 'N/A'}`);
    }
  }
  out.push('');

  out.push(`## 3. Customer Conversations Active on ${dateKey}`);
  if (sortedChats.length === 0) {
    out.push(`_No active conversations found for ${dateKey}._`);
  } else {
    for (const c of sortedChats) {
      const m = c.meta || {};
      const displayName = m.pushName || contactsMap[c.jid] || contactsMap[`91${c.phone}@s.whatsapp.net`] || 'Customer';
      const timeLabel = getIstTimeStr(c.latestTs);
      out.push(`### ${displayName} (${c.phone ? `+91 ${c.phone}` : c.jid}) — ${m.localityName || 'Area Unknown'} (${timeLabel})`);
      if (m.googleMapsUrl) out.push(`- **Maps:** ${m.googleMapsUrl}${m.distanceKm ? ` (${m.distanceKm} km)` : ''}`);
      out.push('');

      const evs = jsonlByKey.get(c.key);
      if (evs && evs.length > 0) {
        for (const e of evs) {
          const badge = e.role === 'customer' ? '**Customer**' : e.role === 'owner_manual' ? '**Owner (Manual)**' : e.role === 'owner_command' ? '**Owner (Cmd)**' : '**AI Bot**';
          out.push(`- [${e.istTime || ''}] ${badge}: ${String(e.text || '').replace(/\r?\n+/g, ' ')}`);
        }
      } else {
        const hist = histories[c.jid] || histories[`91${c.phone}@s.whatsapp.net`] || [];
        if (hist.length > 0) {
          for (const msg of hist) {
            const badge = msg.role === 'user' ? '**Customer**' : '**AI Bot**';
            out.push(`- ${badge}: ${String(msg.text || '').replace(/\r?\n+/g, ' ')}`);
          }
        } else {
          if (m.lastUserText) out.push(`- **Last Customer:** ${m.lastUserText.replace(/\r?\n+/g, ' ')}`);
          if (m.lastBotReply) out.push(`- **Last AI Reply:** ${m.lastBotReply.replace(/\r?\n+/g, ' ')}`);
        }
      }
      out.push('');
    }
  }

  if (pm2ChatBlocks.length > 0) {
    out.push(`## 4. Raw PM2 Console Turn Transcript (${pm2DateLabel})`);
    out.push('```text');
    out.push(pm2ChatBlocks.join('\n\n'));
    out.push('```');
    out.push('');
  }

  if (pm2HumanInterventions.length > 0) {
    out.push('## 5. Recent PM2 Override / Guard / Escalation Log Lines');
    out.push('```text');
    out.push(pm2HumanInterventions.slice(-40).join('\n'));
    out.push('```');
    out.push('');
  }

  if (pm2Errors.length > 0) {
    out.push('## 6. Recent PM2 Error Log Tail');
    out.push('```text');
    out.push(pm2Errors.join('\n'));
    out.push('```');
    out.push('');
  }

  const mdContent = out.join('\n');

  // 1. Save in agent daily archive
  const agentMdPath = path.join(archiveDayDir, 'Daily_Review.md');
  fs.writeFileSync(agentMdPath, mdContent, 'utf8');

  // 2. Save in organized Desktop\Urban Trout\Daily Chat Records\
  const desktopDir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null;
  let desktopMdPath = null;
  if (desktopDir && fs.existsSync(desktopDir)) {
    const recordsDir = path.join(desktopDir, 'Urban Trout', 'Daily Chat Records');
    if (!fs.existsSync(recordsDir)) fs.mkdirSync(recordsDir, { recursive: true });
    desktopMdPath = path.join(recordsDir, `${dateKey}_Chats_Review.md`);
    fs.writeFileSync(desktopMdPath, mdContent, 'utf8');
  }

  console.log(`✅ Daily Chat & Supervised Learning Review generated for ${dateKey}!`);
  console.log(`   • Active chats today: ${sortedChats.length}`);
  console.log(`   • Priorities flagged: ${supervisedPriorities.length}`);
  console.log(`   • Workspace Record:   ${agentMdPath}`);
  if (desktopMdPath) console.log(`   • Desktop Record:     ${desktopMdPath}`);
}

if (require.main === module) {
  const argDate = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : null;
  generateDailyReview(argDate);
}

module.exports = { generateDailyReview };
