import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServer = createClient(supabaseUrl, supabaseKey);

export async function GET(req: NextRequest) {
  // 1. Rate limiting: 30 requests per minute per IP
  const { limited } = checkRateLimit(req, 30, 60 * 1000);
  if (limited) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const phoneParam = searchParams.get("phone");

    // 2. Check for authenticated user via Authorization header
    let authUserEmail: string | null = null;
    let authUserId: string | null = null;
    let authUserPhone: string | null = null;

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.substring(7).trim();
      try {
        const { data: { user }, error: authErr } = await supabaseServer.auth.getUser(token);
        if (!authErr && user) {
          authUserId = user.id;
          authUserEmail = user.email ? user.email.toLowerCase().trim() : null;
          authUserPhone = user.user_metadata?.phone
            ? String(user.user_metadata.phone).replace(/\D/g, "").slice(-10)
            : null;
        }
      } catch (_) {}
    }

    // Determine search criteria
    const cleanPhone = phoneParam ? String(phoneParam).replace(/\D/g, "").slice(-10) : null;

    if (!authUserEmail && !authUserId && !cleanPhone) {
      return NextResponse.json(
        { success: false, error: "Authentication or valid phone number required to view orders." },
        { status: 401 }
      );
    }

    // 3. Build query for customer orders
    let query = supabaseServer
      .from("orders")
      .select("id, order_number, customer_name, customer_phone, customer_address, customer_locality, customer_pincode, items, subtotal, delivery_fee, total, delivery_zone, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (authUserEmail && cleanPhone) {
      query = query.or(
        `customer_phone.eq.${cleanPhone},customer_address.ilike.%${authUserEmail}%`
      );
    } else if (authUserEmail) {
      // Search by email in address/notes, or if customer has phone in metadata
      if (authUserPhone) {
        query = query.or(
          `customer_phone.eq.${authUserPhone},customer_address.ilike.%${authUserEmail}%`
        );
      } else {
        query = query.ilike("customer_address", `%${authUserEmail}%`);
      }
    } else if (cleanPhone) {
      query = query.eq("customer_phone", cleanPhone);
    }

    const { data: orders, error: dbError } = await query;

    if (dbError) {
      console.error("[api/customer/orders] Database error:", dbError);
      return NextResponse.json(
        { success: false, error: "Could not retrieve order history." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orders: orders || [],
    });
  } catch (err: any) {
    console.error("[api/customer/orders] Internal error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch orders." },
      { status: 500 }
    );
  }
}
