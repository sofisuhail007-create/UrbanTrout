import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const cleanSlug = (slug || "").trim();

  if (!cleanSlug) {
    return NextResponse.redirect(new URL("/shop", request.url), 307);
  }

  // 1. Direct Cashfree Link Slug (e.g. Mbbpg0fpahtg_AAAAAAAVSuc or link_ut_cf_...)
  // Cashfree slugs are base64-like alphanumeric with underscores and typically >16 chars
  const isCashfreeSlug = /^[a-zA-Z0-9_\-]{16,}$/.test(cleanSlug);
  if (isCashfreeSlug && !cleanSlug.toUpperCase().startsWith("UT-")) {
    const destination = `https://payments.cashfree.com/links/${cleanSlug}`;
    return NextResponse.redirect(destination, 307);
  }

  // 2. Order Reference Slug (e.g. UT-CF-VERIFY-1 or UT-WA-12345)
  if (cleanSlug.toUpperCase().startsWith("UT-") || /^\d{4,8}$/.test(cleanSlug)) {
    try {
      const { data: order } = await supabase
        .from("orders")
        .select("id, order_number, notes, delivery_notes")
        .or(`order_number.eq.${cleanSlug},id.eq.${cleanSlug}`)
        .maybeSingle();

      if (order) {
        // Check if there is an embedded payment link in notes or metadata
        const notesStr = `${order.notes || ""} ${order.delivery_notes || ""}`;
        const cfMatch = notesStr.match(/https:\/\/payments\.cashfree\.com\/links\/([a-zA-Z0-9_\-]+)/i);
        if (cfMatch) {
          return NextResponse.redirect(cfMatch[0], 307);
        }
        const rzpMatch = notesStr.match(/https:\/\/rzp\.io\/(?:rzp|l)\/[a-zA-Z0-9_\-]+/i);
        if (rzpMatch) {
          return NextResponse.redirect(rzpMatch[0], 307);
        }
      }
    } catch (e) {
      console.warn("[/pay/[slug]] Order lookup notice:", e);
    }

    // Fallback: send to the official interactive QR page with this order ref
    return NextResponse.redirect(new URL(`/qr?ord=${encodeURIComponent(cleanSlug)}`, request.url), 307);
  }

  // 3. General Fallback: If it looks like a Cashfree link ID or payment link, send to Cashfree
  if (cleanSlug.startsWith("link_") || cleanSlug.startsWith("cf_")) {
    return NextResponse.redirect(`https://payments.cashfree.com/links/${cleanSlug}`, 307);
  }

  return NextResponse.redirect(new URL(`/qr?ord=${encodeURIComponent(cleanSlug)}`, request.url), 307);
}
