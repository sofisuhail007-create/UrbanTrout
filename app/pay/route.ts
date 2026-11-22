import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const link = searchParams.get("link") || searchParams.get("url");
  const id = searchParams.get("id") || searchParams.get("slug");
  const am = searchParams.get("am") || searchParams.get("amount");
  const ord = searchParams.get("ord") || searchParams.get("order");

  // 1. Direct explicit link query param
  if (link) {
    if (link.startsWith("https://payments.cashfree.com/") || link.startsWith("https://rzp.io/")) {
      return NextResponse.redirect(link, 307);
    }
  }

  // 2. Slug / ID query param
  if (id) {
    return NextResponse.redirect(`https://payments.cashfree.com/links/${id}`, 307);
  }

  // 3. Amount & Order query param -> Route to official branded QR page
  if (am) {
    const qrUrl = new URL("/qr", request.url);
    qrUrl.searchParams.set("am", am);
    if (ord) qrUrl.searchParams.set("ord", ord);
    return NextResponse.redirect(qrUrl, 307);
  }

  // Default fallback
  return NextResponse.redirect(new URL("/shop", request.url), 307);
}
