# Comprehensive Bug Audit & Vulnerability Report
**System:** Urban Trout WhatsApp AI Sales Agent (`urban-trout-app/agent/index.js` & `urban-trout-agent/index.js`)  
**Audited Lines:** 7,777 lines of Node.js / Baileys / Gemini API  
**Date:** 16 November 2026  

---

## Executive Summary

A line-by-line static analysis and simulation of the WhatsApp AI Sales Agent revealed **15 distinct bugs and failure modes** spanning:
1. **Quantity & Pricing Errors**: Accidental 2 kg / 5 kg QR generation, over-eager QR dispatch, and broken unit matching.
2. **Payment & Image Blind Spots**: Complete silent dropping of payment screenshots, and lack of HDFC Soundbox auto-detection.
3. **Escalation False Positives**: Customer dietary/medical questions triggering emergency food-safety alarms.
4. **Geolocation Collisions**: Casual numbers ("2, 3 pieces") parsed as African GPS coordinates (8,215 km away) causing immediate order rejections.
5. **State Corruption & Concurrency**: Unlocked, non-atomic JSON disk writes risking total database truncation upon server reboot.

---

## Summary of Findings

| ID | Severity | Category | Flaw / Trigger | Impact |
|:---|:---|:---|:---|:---|
| **BUG-01** | **CRITICAL** | QR & Pricing | `parseCustomerQuantityRequest` unit is optional (`\b(\d+)\s*(?:kg)?\b`) | "Can you deliver at 5 PM?" orders 5 kg trout |
| **BUG-02** | **CRITICAL** | QR & Logic | Proactive Auto-QR regex triggers on casual mentions of "payment link" / "UPI QR" | Agent sends ₹1,160 locked QR to customers who just said hello |
| **BUG-03** | **CRITICAL** | Geolocation | Pattern 4 in `extractCoordinates` matches bare integers as Lat/Lng | "I need 2, 3 pieces" -> Lat 2, Lng 3 (8,215 km away) -> Rejection |
| **BUG-04** | **HIGH** | Intent Hijack | `isCustomerRequestingQr` intercepts bare keywords (`gpay`, `phonepe`, `upi`) | "Do you take UPI?" or "My gpay failed" skips Gemini and sends QR |
| **BUG-05** | **HIGH** | UX & Support | `detectCustomerEscalation` triggers on words like `sick`, `stale`, `smell` | Medical/dietary questions trigger 60-min pause & Telegram fraud alarm |
| **BUG-06** | **HIGH** | Payment | Zero handling of image attachments without caption (Line 7320) | Customer payment screenshots are silently ignored with 0 response |
| **BUG-07** | **HIGH** | Order Intent | `isOrderIntent` fails for `"1 kg please"` | Fails fast-path parser on simple starter pack requests |
| **BUG-08** | **HIGH** | Geolocation | Line 695 `baghati` shadows Line 839 `Baghati Kanipora` | Out-of-zone customers (>16 km) get free Zone 1 delivery (1.0 km) |
| **BUG-09** | **MEDIUM** | Geolocation | `Brein (Nishat)` regex matches English word `brain` | "Does trout help brain health?" resolves location to Brein (11 km) |
| **BUG-10** | **MEDIUM** | Data Safety | `customer_orders.json` and `chat_histories.json` non-atomic direct writes | Server crash/reboot during `fs.writeFileSync` truncates file to 0 bytes |
| **BUG-11** | **MEDIUM** | API Fallback | Non-existent Gemini model names in fallback array (`gemini-3.5-flash-lite`, etc.) | Wastes API calls and introduces latency on failover |
| **BUG-12** | **MEDIUM** | Inventory | `checkStockAvailable` checks `amount > 1000 ? 2 : 1` regardless of actual kg | Bulk orders of 10–20 kg pass even when tanks only have 3 kg left |
| **BUG-13** | **MEDIUM** | Automated Follow-Up | Late-night automated nudges and nudging customers who said "No" | Sends follow-up at 9:30 PM and bothers uninterested leads |
| **BUG-14** | **LOW** | LID Handling | Unmapped WhatsApp LID suffixes sliced as 10-digit phone numbers | Bogus phone numbers recorded in CRM and Razorpay notes |
| **BUG-15** | **LOW** | Address Sync | `customer_pincode` is hardcoded to `"190001"` for all Srinagar orders | Inaccurate postal code stored in Supabase orders table |

---

## Detailed Findings

### BUG-01: Quantity Unit is Optional in Regex
- **Location:** `urban-trout-app/agent/index.js`, Line 2835
- **Category:** Quantity & Pricing Logic (CRITICAL)
- **The Code:**
  ```javascript
  const numMatch = msg.match(/\b(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kg)?\b/i);
  ```
- **Scenario:** The unit `(?:kgs?|kilos?|kg)?` has a `?` quantifier, making it optional.
  - If a customer types: *"Can you deliver at 5 PM?"*, `numMatch[1]` captures `5`.
  - Because `deliver` matches `isOrderIntent`, the parser concludes the customer asked for **5.0 kg**!
  - In VIP fast-path reorders, this immediately generates a locked order and payment link for **5 kg (₹2,900)**!
- **Fix:** Remove the `?` so the unit is required when searching for numbers, or require `kg|kilo` unless preceded by explicit quantity verbs.

---

### BUG-02: Proactive Auto-QR Triggered on Conversational Replies
- **Location:** `urban-trout-app/agent/index.js`, Lines 7440–7470
- **Category:** QR Generation Logic (CRITICAL)
- **The Code:**
  ```javascript
  const hasPaymentInReply = (
    /(?:rzp\.io|https:\/\/rzp\.io|payment link|UPI QR)/i.test(aiReply) ||
    /(?:🧾\s*)?(?:URBAN TROUT\s*[•·-]\s*)?(?:Order Summary|ORDER SUMMARY)/i.test(aiReply) ||
    /(?:Total Payable:\s*\*?₹?\s*\d+)/i.test(aiReply)
  ) && !aiReply.includes("✅ *Payment Received") && !aiReply.includes("OUT FOR DELIVERY");
  ```
- **Scenario:** If Gemini generates a conversational greeting such as:
  > *"Hello! Welcome to Urban Trout. We accept payment via payment link or UPI QR code. Which area in Srinagar are you in?"*
  `hasPaymentInReply` evaluates to `true`! Because there is no amount in the text, `forceAmount` is `null`. At line 5859, `dispatchLockedQrImage` falls back to:
  ```javascript
  amt = detectedWeightKg ? minExpectedBase : 1160; // Standard 2 kg Cleaned & Gutted
  ```
  And because `bypassLocationGuard: true` is passed, the agent **dispatches a locked QR image for ₹1,160 to a customer who only asked how payment works!**
- **Fix:** `hasPaymentInReply` must strictly require an actual URL (`https://rzp.io`) OR both an `ORDER SUMMARY` header AND a confirmed `Total Payable: ₹...`.

---

### BUG-03: Two Numbers in Text Parsed as African GPS Coordinates
- **Location:** `urban-trout-app/agent/index.js`, Line 660 & Line 6990
- **Category:** Geolocation & Order Disruption (CRITICAL)
- **The Code:**
  ```javascript
  // 4. Raw lat, lng in text: e.g. 34.144556, 74.824501
  const rawMatch = decoded.match(/\b([1-8]?\d(?:\.\d+)?|90(?:\.0+)?)[,\s]+(-?(?:180(?:\.0+)?|(?:1[0-7]\d|\d{1,2})(?:\.\d+)?))\b/);
  ```
- **Scenario:** This regex accepts single/double digit integers without decimal points.
  - If a customer says: *"I need 2, 3 pieces"* or *"Deliver between 4, 5 PM"* or *"We are 5, 6 people"*:
  - `lat = 2`, `lng = 3`.
  - The agent enters `isGpsCheck = true`.
  - Distance from Malabagh farm to (2, 3) is **8,215 km**!
  - The agent immediately fires the out-of-zone rejection:
    > *"📍 Location Check: Outside Delivery Perimeter ⚠️ Your location is 8215.0 km from our Malabagh farm..."*
- **Fix:** Raw GPS coordinates must require decimal precision: `/\b(3[34]\.\d{4,8})[,\s]+(7[45]\.\d{4,8})\b/` (specifically tuned to J&K / Kashmir coordinates, or require at least 3+ decimal digits).

---

### BUG-04: `isCustomerRequestingQr` Intercepts Inquiries & Objections
- **Location:** `urban-trout-app/agent/index.js`, Line 5625 & Line 7370
- **Category:** Intent Recognition (HIGH)
- **The Code:**
  ```javascript
  const directRegex = /\b(?:...|gpay|phonepe|paytm|upi)\b/i;
  ```
- **Scenario:** Matches single isolated words like `upi`, `gpay`, `phonepe`.
  - If a customer asks: *"Do you accept UPI?"*, *"Is cash on delivery or only UPI?"*, *"My gpay is not working"*, or *"PhonePe payment failed"*:
  - `isCustomerRequestingQr` returns `true`.
  - The agent intercepts the turn BEFORE Gemini sees it, ignoring the question, and immediately attempts to send another QR code or asks for their location.
- **Fix:** Negative lookahead / intent guard: exclude question patterns like `(?:accept|allow|available|working|failed|error|kya|hai|dont\s*have|not\s*working)`.

---

### BUG-05: False Escalations on Medical & Dietary Questions
- **Location:** `urban-trout-app/agent/index.js`, Line 1640
- **Category:** Customer Sentiment & Escalation (HIGH)
- **The Code:**
  ```javascript
  if (/\b(?:spoiled|stale|kharab|bad\s*smell|sick|bimar|hospitalized|loose\s*motion)\b/i.test(sanitizedForThreat))
  ```
- **Scenario:** Customers regularly ask if trout is good for recovering patients or ask about smell:
  - *"I was sick last week, doctor recommended trout for protein"* -> Matches `sick`.
  - *"Does fresh trout have any bad smell?"* -> Matches `bad smell`.
  - *"My father was hospitalized, can he eat fish?"* -> Matches `hospitalized`.
  - In all these cases, the agent flags an emergency `Food Safety Escalation`, freezes the chat for 60 minutes, alerts Telegram, and apologizes for selling bad fish!
- **Fix:** Require complaint verbs / past-tense purchase indicators: `(?:received|delivered|sent|got|bought|aaya|diya|tha|hai)\b.*?\b(?:spoiled|stale|kharab|smelling)`.

---

### BUG-06: Payment Screenshots Silently Dropped
- **Location:** `urban-trout-app/agent/index.js`, Line 7320 & Line 7601
- **Category:** Payment & Media Handling (HIGH)
- **The Code:**
  ```javascript
  if (!text || text.trim().length === 0) return;
  ```
- **Scenario:** The bot instructs customers: *"Please share your payment screenshot here once transferred!"*
  - When the customer sends an image without text caption, `text` is `""`.
  - Line 7320 silently returns. The bot sends zero acknowledgement, leaving the customer stranded.
- **Fix:** Detect `inner.imageMessage`, download image or send an immediate friendly receipt:
  > *"Thank you! We received your image / screenshot. Our Malabagh farm team is verifying the transaction reference right now. 🐟"*
  And notify Telegram with the customer's phone number.

---

### BUG-07: `"1 kg please"` Fails Order Intent
- **Location:** `urban-trout-app/agent/index.js`, Line 2855
- **Category:** Intent Recognition (HIGH)
- **The Code:**
  ```javascript
  /^(?:[0-9]+(?:\.[0-9]+)?\s*(?:kg|kgs|kilos?|kilo)?(?:\s+(?:cleaned|gutted|whole|fresh|steaks|curry|cut))?)[!.,\s]*$/i
  ```
- **Scenario:** If a customer sends `"1 kg please"`, the trailing `"please"` is not in the regex, causing `isOrderIntent` to return `false` and `parseCustomerQuantityRequest` to return `null`.
- **Fix:** Allow standard polite closers `(?:please|plz|bhai|sahib|janab)?` at the end of the quantity regex.

---

### BUG-08: Out-of-Zone `Baghati Kanipora` Shadowed by `Baghati Shoora`
- **Location:** `urban-trout-app/agent/index.js`, Line 695 vs Line 839
- **Category:** Delivery Zone Integrity (HIGH)
- **The Code:**
  ```javascript
  // Line 695 (Zone 1 - In-Zone 1.0 km):
  { pattern: /\b(?:baghati\s*shoora|baghati)\b/i, name: "Baghati Shoora", dist: 1.0 },

  // Line 839 (Out-of-Zone >16 km):
  { pattern: /\b(?:bagati\s*kanipora|b\.?k\.?\s*pora|bk\s*pora|kanipora\s*budgam|kanipora)\b/i, name: "Baghati Kanipora (BK Pora)" },
  ```
- **Scenario:** Because Line 695 contains bare `baghati` and is evaluated first in the array, a customer in **Baghati Kanipora** (18 km away in Budgam) matches Line 695 and is granted free Zone 1 delivery!
- **Fix:** Change Line 695 to `/\b(?:baghati\s*shoora)\b/i` so it never matches `Baghati Kanipora`.

---

### BUG-09: English Word `brain` Collides with `Brein (Nishat)`
- **Location:** `urban-trout-app/agent/index.js`, Line 796
- **Category:** Locality Recognition (MEDIUM)
- **The Code:**
  ```javascript
  { pattern: /\b(?:brein|brain)\b/i, name: "Brein (Nishat)", dist: 11.0, minKg: 3 },
  ```
- **Scenario:** Customer asks: *"Does rainbow trout improve brain function?"*
  - Matched to `Brein (Nishat)` (11 km away, Tier 3 MOQ 3 kg).
- **Fix:** Use `/\b(?:brein(?:\s*nishat)?|brain\s*nishat)\b/i`.

---

### BUG-10: Non-Atomic File Writes Risk Order Database Truncation
- **Location:** `urban-trout-app/agent/index.js`, Lines 1105 & 1695
- **Category:** Data Loss & Crash Recovery (MEDIUM)
- **The Code:**
  ```javascript
  fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf-8");
  ```
- **Scenario:** If the server process is killed or power cycles during `fs.writeFileSync`, `customer_orders.json` is truncated to 0 bytes or incomplete JSON, permanently corrupting active orders.
- **Fix:** Write to `customer_orders.json.tmp` first, then atomically rename using `fs.renameSync`.

---

### BUG-11: Obsolete / Non-Existent Gemini API Model Names
- **Location:** `urban-trout-app/agent/index.js`, Lines 4660–4666
- **Category:** Reliability & Latency (MEDIUM)
- **The Code:**
  ```javascript
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.6-flash"
  ];
  ```
- **Scenario:** Fictional model names return 404 from the Gemini API, forcing the agent to fail through several models before finding a working endpoint, causing 5–10 second response delays.
- **Fix:** Update list to verified production models: `["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]`.

---

### BUG-12: Tank Stock Check Disregards Real Order Weight
- **Location:** `urban-trout-app/agent/index.js`, Lines 4576 & 4763
- **Category:** Inventory Protection (MEDIUM)
- **The Code:**
  ```javascript
  const isStockOk = await checkStockAvailable(amount > 1000 ? 2 : 1);
  ```
- **Scenario:** An order of 10 kg or 20 kg checks whether tanks have at least 2 kg. If only 3 kg remains in the aquarium, the order is accepted and payment is taken for 10 kg.
- **Fix:** Pass actual calculated kg: `await checkStockAvailable(detectedWeightKg || 2)`.

---

### BUG-13: Inappropriate Late-Night Inactive Lead Follow-Ups
- **Location:** `urban-trout-app/agent/index.js`, Lines 5285–5340
- **Category:** Customer Experience (MEDIUM)
- **The Code:**
  ```javascript
  if (istHour >= 22 || istHour < 8) continue;
  ```
- **Scenario:** Since evening deliveries close at 8:00 PM, an inquiry received at 8:30 PM triggers an automated follow-up ping at 9:30 PM at night.
  - Also pings customers who explicitly declined ("Nahi chahiye"), because it only checks `meta.lastMsgRole === "model"`.
- **Fix:** Change sleep window to `istHour >= 20 || istHour < 8.5`, and check chat history for decline phrases before following up.

---

### BUG-14: Raw WhatsApp LID Suffix Sliced as Phone Number
- **Location:** `urban-trout-app/agent/index.js`, Line 1585
- **Category:** Integration & Data Quality (LOW)
- **Scenario:** For WhatsApp Linked Device IDs (`@lid`), `resolveCustomerPhone` falls back to `cleanId.slice(-10)` when reverse mapping is missing, generating arbitrary numbers.
- **Fix:** Verify `cleanId.startsWith("91")` or prompt the customer for their mobile number.

---

### BUG-15: Hardcoded Pincode 190001 for All Srinagar Orders
- **Location:** `urban-trout-app/agent/index.js`, Line 1850
- **Category:** Dispatch Accuracy (LOW)
- **Scenario:** Hardcodes `customer_pincode: "190001"` for all orders inserted into Supabase, regardless of whether the order is in Soura (190011) or Hazratbal (190006).
- **Fix:** Map locality to its official Srinagar postal pincode.
