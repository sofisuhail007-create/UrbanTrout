/**
 * Ad Traffic & Conversion Rate Protection Shield
 * 
 * Ensures that paid ad traffic (Meta/Instagram/Google Ads), in-app browsers,
 * and active checkout sessions are NEVER distracted by secondary popups (PWA install, Push prompts).
 */

export function isDistractionFreeSession(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const path = window.location.pathname;

    // 1. Strict route suppression: Checkout, Invoices, Admin, Auth
    if (
      path.startsWith("/checkout") ||
      path.startsWith("/admin") ||
      path.startsWith("/invoice") ||
      path.startsWith("/auth")
    ) {
      return true;
    }

    // 2. Suppress for Paid Ad Traffic (Meta fbclid, Google gclid, UTM campaigns)
    const search = window.location.search;
    const isAdReferral =
      search.includes("fbclid=") ||
      search.includes("gclid=") ||
      search.includes("utm_source=") ||
      search.includes("utm_campaign=") ||
      search.includes("utm_medium=") ||
      search.includes("ttclid=") ||
      search.includes("ref=ad");

    if (isAdReferral) {
      // Lock for entire session so navigating between shop pages stays 100% ad-optimized
      sessionStorage.setItem("ut_ad_session", "true");
      return true;
    }

    if (sessionStorage.getItem("ut_ad_session") === "true") {
      return true;
    }

    // 3. Suppress for In-App Browsers (Instagram Webview, Facebook App, TikTok)
    // In-app webviews do not support PWA installation or Web Push anyway.
    const ua = (window.navigator.userAgent || "").toLowerCase();
    const isInAppBrowser =
      ua.includes("instagram") ||
      ua.includes("fban") ||
      ua.includes("fbav") ||
      ua.includes("messenger") ||
      ua.includes("musical_ly") ||
      ua.includes("bytedance");

    if (isInAppBrowser) {
      return true;
    }

    return false;
  } catch (_) {
    return false;
  }
}
