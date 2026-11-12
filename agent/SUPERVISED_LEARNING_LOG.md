# Urban Trout AI Agent — Supervised Learning Log

This log records daily audits from pulled WhatsApp conversations, manual owner interventions, and the exact rules/code improvements taught to the AI agent.

---

## Daily Routine Workflow
1. **Pull Today's Chats:** Double-click `Desktop\Urban Trout\Bot & Operations\PULL_CHATS_AND_LEARN.bat`.
   - Downloads live `chat_histories.json`, `chat_metadata.json`, `customer_orders.json`, `daily_chat_archive/*.jsonl`, and PM2 logs from Hostinger VPS.
   - Generates a structured audit sheet at `Desktop\Urban Trout\Daily Chat Records\YYYY-MM-DD_Chats_Review.md`.
   - Re-runs privacy-safe Contact Export into `Desktop\Urban Trout\Contacts\Urban_Trout_Contacts.vcf`.
2. **Teach AI Together:** Review flagged chats (especially owner manual overrides) with Antigravity -> update `KNOWLEDGE_BASE.md` / `index.js`.
3. **Push Live:** Double-click `Desktop\Urban Trout\Bot & Operations\UPDATE_CLOUD_AGENT.bat`.

---

## Learning Entries

### [Completed] 2026-11-10
- **Infrastructure Deployed & Audited:**
  - Pulled live `2026-11-10` VPS chats, orders, metadata, and generated `2026-11-10_Chats_Review.md` (22 customer numbers contacted today).
  - Fixed Desktop organization (`Desktop\Urban Trout\`) and privacy-filtered Contact Exporter (`718` contacts exported to `Contacts\Urban_Trout_Contacts.vcf`, excluding `48` primary contacts).
- **Real-World Dispatch Audit & Margin Protection (Muz Sanat Nagar `+91 91589 11643` & Abdal Mehjoor Peerbagh `+91 94190 31082`):**
  - Rapido courier charged **₹190** to Sanat Nagar against a 4 kg ₹2,320 free-delivery order (dragging net selling price down to **₹531/kg** before Mohd Amin's **₹5/kg** gutting incentive). Peerbagh required owner manual delivery (2 kg + ₹150 courier).
  - **Policy Change Implemented (`v2.7.0` + Website & Calculators Synced):**
    1. Moved **Sanat Nagar, Peerbagh, Airport Road / Humhama, Nowgam, Rajbagh, Jawahar Nagar, Batamaloo** (alongside Bemina, Sonwar, Wazir Bagh, Chanapora, Hyderpora, Rawalpora, Lasjan, Pantha Chowk, Rangreth) into **Zone 4 — 5 kg Free Delivery** (₹2,900 Cleaned & Gutted).
    2. Shifted delivery courier subsidy across all 4 zones from **50/50** to **70% Customer / 30% Urban Trout** (+₹40 evening rush 4–8 PM IST unchanged):
       - **Zone 1 (0–4.0 km):** Free 2 kg+ | 1 kg: **+₹35**
       - **Zone 2 (4.0–7.0 km):** Free 3 kg+ | 2 kg: **+₹55** | 1 kg: **+₹65**
       - **Zone 3 (7.0–11.5 km):** Free 3 kg+ | 2 kg: **+₹89** | 1 kg: **+₹99**
       - **Zone 4 (11.5–16.0 km):** Free 5 kg+ | 4 kg: **+₹109** | 3 kg: **+₹129** | 2 kg: **+₹139** | 1 kg: **+₹149**
- **Escalation False-Positive Fix (`#13 OmkarSG` `+91 72761 60671`):**
  - Customer address `"Iqbal park Near Shergari police station 2 kg"` previously triggered false legal escalation on bare `"police"`.
  - Updated `detectCustomerEscalation` to strip innocent Srinagar landmarks (`police station`, `hospital`, `court` road/complex, etc.) before evaluating genuine legal/regulatory threats.
- **Vending Log, `#location` & 8:00 PM Contact Scan Upgrades (`v2.8.0`):**
  - Updated Vending Log **Final Sell Rate** across table rows, mobile cards, modal live calculator, KPI Avg Sell Rate, DB save, CSV, and Excel exports to show **Base Rate → Delivery Cost → Mohd Amin Gutting Incentive (`-₹5/kg`)** consistently for every entry (`computeEntrySellRateBreakdown`).
  - Added `#location <place>` (`#loc` / `#zone`) command for `+91 7006604148` and `"Message yourself"` — resolves distance, Zone tier, Free MOQ, and all `<MOQ` courier fees + totals ready to forward straight to customers.
  - Fixed `#1` Khyber milk question (`"Is it from Khyber?"` in Rafi Bakkal's chat no longer overrides customer locality to `Khayam (Khyber Hospital)`), blocked `fromMe` self `pushName` capture, repaired `UT UT UT` contact prefix accumulation + unmapped `@lid` false phone numbers, and added automated **8:00 PM IST nightly full chat-archive scan (`enrichContactsFromChats`)** to keep contacts named `Name - Location` cleanly (`798` exported, `26` personal primary contacts excluded).

### [Completed] 2026-11-11
- **Silent Non-Response After Location Pin Root Cause & Fix (`v2.9.0`):**
  - Audited `pm2_err.log` & `Daily_Review.md` (`Musavir +91 9622529700`, `SHABIR +91 9625453171`, `Wz +91 9596286799`).
  - **Root Cause 1:** `ReferenceError: Cannot access 'detectedLocalityName' before initialization at processSingleMessage` (Temporal Dead Zone — `detectedLocalityName` was declared on line `5927` after being accessed on `5812–5834` inside `hasAgreedOrder` when a customer with a previously discussed weight shared a WhatsApp location pin).
  - **Root Cause 2:** `hasAgreedOrder` & reverse weight lookup scanned both `user` and `model` messages (could match the bot's own `"5 kg"` upsell instead of the customer's weight); `resolveGoogleMapsUrl` also only followed a single redirect hop without HTML metadata fallback.
  - **Fix Deployed:** Declared `detectedLocalityName` before the GPS handler (falling back cleanly through text -> pin name/address -> `resolveNearestLocalityName` -> saved metadata), filtered weight extraction strictly to customer `user` turns (`userOnlyHist`), passed `deliveryFee` into `formatOrderSummaryCard`, upgraded multi-hop redirect + HTML meta resolution in `resolveGoogleMapsUrl` / `extractCoordinates`, and wrapped the GPS pin handler in a defensive `try/catch` safety boundary.
- **Confidentiality, Pin-Point Shared Location & In-Person Delivery Policy (`v2.9.0` + Website Public Pages):**
  - Audited customer-facing prompts, `#location` quotes, order confirmations, `KNOWLEDGE_BASE.md`, `lib/deliveryZones.ts`, `lib/geolocationEngine.ts`, `lib/email.ts`, `DeliveryCalculatorClient.tsx`, `checkout/page.tsx`, `page.tsx`, `shipping-policy/page.tsx`, `terms/page.tsx`, `trout-price-srinagar/page.tsx`, `shop/*`, and webhooks.
  - **Removed Confidential Terms:** Eliminated `"subsidized"`, `"subsidised"`, `"subsidy"`, `"70%"`, `"30%"`, `"Rapido"`, and `"third-party"` from all customer-facing outputs (kept internal Admin accounting intact) and added a deterministic sanitizer in `generateReply`.
  - **Replaced Doorstep Wording with Pin-Point GPS Policy:** Standardized all customer messaging on **"Urban Trout Cold-Chain Dispatch Partner"**, asking customers to share a **WhatsApp Location Pin or Google Maps link**, clarifying delivery is **strictly to the shared GPS pin** (not searching house numbers or knocking on doors), must be collected **in person**, and customers must keep their **phone reachable** because multi-order cold-chain routes cannot perform a second delivery attempt if unreachable or switched off.
- **Unsubsidized 1 kg Full Delivery Charge & WhatsApp Bold Normalization (`v2.9.1`):**
  - **Policy Change (Margin Protection on 1 kg Orders):** Removed the Urban Trout subsidy on **1 kg** orders so customers pay the full delivery cost below 2 kg, while keeping the 70/30 subsidized express delivery tiers intact for **2 kg+** orders and 100% FREE MOQs unchanged (`2 kg` / `3 kg` / `5 kg`):
    - **Zone 1 (0–4.0 km):** 1 kg: **₹45** (Gutted ₹625 / Whole ₹585) | 2 kg+: **FREE**
    - **Zone 2 (4.0–7.0 km):** 1 kg: **₹75** (Gutted ₹655 / Whole ₹615) | 2 kg: **₹55** | 3 kg+: **FREE**
    - **Zone 3 (7.0–11.5 km):** 1 kg: **₹130** (Gutted ₹710 / Whole ₹670) | 2 kg: **₹89** | 3 kg+: **FREE**
    - **Zone 4 (11.5–16.0 km):** 1 kg: **₹190** (Gutted ₹770 / Whole ₹730) | 2 kg: **₹139** | 3 kg: **₹129** | 4 kg: **₹109** | 5 kg+: **FREE**
    - **Evening Rush (4:00 PM – 8:00 PM IST):** `+₹40` surcharge applies across `1–4 kg` below MOQ (`₹85` / `₹115` / `₹170` / `₹230` for 1 kg); free MOQ packs remain `₹0`.
  - **WhatsApp Bold Formatting Fix:** Added sanitizer cleanup (`\*\*...\*\*` -> `\*...\*` plus stripping empty bold remnants) in `index.js` so Gemini responses never show literal `**double asterisks**` on WhatsApp.
- **Biodegradable 0%-Ice Packaging & Failed Delivery Attempt Pickup Rule (`v2.9.2`):**
  - **Removed Inaccurate "Cold-Chain" / "Chilled" Delivery Claims:** Eliminated `"cold-chain"`, `"cold chain"`, `"chilled delivery"`, `"delivered chilled"`, and `"chilled package"` across all WhatsApp prompts, GPS pin replies, order cards, `#location` quotes, `KNOWLEDGE_BASE.md`, public website pages, checkout flow, webhook, and emails. Replaced with **`Express Dispatch Partner`** and accurate packaging wording: **`100% food-grade biodegradable polythene (two polythenes) with 0% ice`**. Also added deterministic runtime sanitization in `index.js` (`COLD-CHAIN` / `CHILLED` guard).
  - **Failed-Attempt Manual Collection Policy:** Added the explicit rule across agent prompts, pin-point reminders, `#location`, order cards, checkout, emails, and policies: if a delivery attempt fails (unreachable phone, switched off, or customer unavailable at the shared GPS pin), **no second delivery attempt** can be made and **the customer will have to collect their package manually from our Live Vending Center in Malabagh**.
- **10-Scenario End-to-End Bulletproof Stress Test & `Send QR` Crash Fix (`v2.9.2`):**
  - **Caught & Fixed Live Bug (`dispatchLockedQrImage`):** Testing Scenario 4 (`Peerbagh 1kg -> ₹770 Link -> "Send QR"`) uncovered a live `ReferenceError: payUrl is not defined` inside `dispatchLockedQrImage` right after QR dispatch — which crashed order persistence and sent a duplicate fallback text card behind the QR PNG. Fixed to preserve `payUrl: targetOrder?.payUrl || null`, extended `mFixed` amount extraction to `8xx` evening rush totals (`₹810`), and enriched the QR PNG caption with biodegradable `0% ice` & manual Malabagh pickup policy.
  - **Caught & Fixed Delivery-Partner Denial Contradiction:** Scenario 1 red-teaming caught `"We do not use Express Dispatch Partner services..."` after regex replacement of a literal `"We do not use Rapido or third-party..."` denial. Added explicit prompt instruction not to deny third-party delivery falsely plus pre-replacement denial normalization in the Confidentiality Sanitizer, and unified remaining Night/Early/`pp` templates to omit internal km ranges (`2 kg nearby, 3–5 kg wider Srinagar`).
- **Quick Link (`#2kg +149`) & Quick QR (`#qr 2kg +149`) Fixes (`v2.9.2`):**
  - Fixed [`formatOrderSummaryCard`](file:///c:/Users/Suhail%20-%20CGIT/Desktop/Playgrpund%20-%20Urban%20Trout%20-%20Stitch%20-%202026/urban-trout-agent/index.js#L940) so any order with an explicit fee (`(+₹149 Delivery)` / `(+₹149 Express Delivery)`), weight-vs-amount fee spread, or custom flat total (`#1309`) **never** displays `(100% FREE)`, and removed `Valued Customer ()` placeholder from the `*Delivery:*` row.
  - Fixed live **`ReferenceError: Cannot access 'customerName' before initialization`** TDZ crash inside `#qr` (`#qr 2kg +149`) and `#paid`, unified quick-order parsing across `#link` / `#<weight>` / `#qr`, cleared stale `payUrl` when `#qr` overrides order amount, and displayed `• *Delivery Fee:* +₹149 (Express Delivery)` cleanly in QR PNG captions (`7/7` cases verified).

### [Completed] 2026-11-12
- **Real-Time Weather Radar & Rain/Snow Delivery Perimeter Policy (`v2.9.3`):**
  - Integrated Open-Meteo real-time Srinagar weather detection (`34.1445563, 74.8245018`, zero-key HTTPS API cached every 15 minutes + startup warm + persistent `weather_state.json`) classifying clear vs WMO rain/drizzle (`51–67, 80–82, 95–99`, `rain/precip` thresholds) vs snow/sleet (`71–77, 85–86`, `snowfall >= 0.05`).
  - Added owner `#weather` WhatsApp controls (`#weather`, `#weather auto`, `#weather rain`, `#weather snow`, `#weather clear`), live weather & active radius readout inside `#status`, and documentation inside `#help`.
  - Enforced the wet-weather perimeter across AI prompts (`generateGeminiReply`, VIP Fast Paths, `1 kg` intent), deterministic guards (`[PAY_LINK]` guard, VIP reorder guard, `[QR Guard]` for customer `Send QR`), live WhatsApp GPS pin handler, `formatOrderSummaryCard`, `#location`, Razorpay auto-confirmations, and `#paid` receipts:
    - **Active Rain / Snow `> 6.0 km`:** Pauses automated delivery & payment links/QR, explains `0%-ice` freshness & transit safety without leaking confidential terms (`Rapido`, `third-party`, `cold-chain`, `chilled`, `doorstep`, `70%`/`30%`), and invites pickup at Live Vending Center in Malabagh or waiting for clear weather (while preserving owner manual `#link`/`#qr` overrides).
    - **Active Rain / Snow `0–6.0 km` (covering `0–5 km` + edge gap cleanly):** Continues delivery normally with explicit weather-delay warnings on replies, GPS pin confirmations, Order Summary Cards, QR captions, and receipts.
    - **Clear Weather:** Full `0–16.0 km` perimeter operates unchanged.
