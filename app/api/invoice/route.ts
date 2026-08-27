import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use anon key — the invoices table has open RLS policies (public insert/select)
// No service role key needed for this to work on Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { invoiceId, data } = body;

    if (!invoiceId || !data) {
      return NextResponse.json({ success: false, error: "Missing invoiceId or data" }, { status: 400 });
    }

    const cleanDigits = String(invoiceId).replace(/\D/g, "");
    const id = cleanDigits || String(invoiceId);

    const { error } = await supabase.from("invoices").upsert(
      {
        id,
        data: typeof data === "object" ? data : JSON.parse(data),
        expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Error saving invoice:", error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("API Invoice POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "";

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing invoice id" }, { status: 400 });
    }

    const cleanDigits = id.replace(/\D/g, "");
    const lookupId = cleanDigits || id;

    // Fetch from invoices table
    const { data: row, error } = await supabase
      .from("invoices")
      .select("data, expires_at")
      .eq("id", lookupId)
      .single();

    if (row?.data) {
      return NextResponse.json({ success: true, invoice: row.data, expiresAt: row.expires_at });
    }

    if (error && error.code !== "PGRST116") {
      console.error("Supabase invoice fetch error:", error.message);
    }

    return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  } catch (err: any) {
    console.error("API Invoice GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
