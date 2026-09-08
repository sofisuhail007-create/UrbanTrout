import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

// Use anon key — the invoices table has open RLS policies (public insert/select)
// No service role key needed for this to work on Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

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

    // If no ID is passed, return list of all recent invoices/remote orders
    if (!id) {
      const limit = parseInt(searchParams.get("limit") || "100", 10);
      const { data: rows, error } = await supabase
        .from("invoices")
        .select("id, data, created_at, expires_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("Supabase list invoices error:", error.message);
        // Fallback check in app_settings
        try {
          const { data: fb } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "remote_invoices_cache")
            .single();
          if (fb?.value) {
            return NextResponse.json({ success: true, invoices: JSON.parse(fb.value) });
          }
        } catch (_) {}
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const list = (rows || []).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        expires_at: r.expires_at,
        ...(typeof r.data === "object" ? r.data : JSON.parse(r.data || "{}")),
      }));

      // Cache recent list in app_settings for safety
      try {
        supabase.from("app_settings").upsert({
          key: "remote_invoices_cache",
          value: JSON.stringify(list.slice(0, 100)),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" }).then(() => {});
      } catch (_) {}

      return NextResponse.json({ success: true, invoices: list });
    }

    const cleanDigits = id.replace(/\D/g, "");
    const lookupId = cleanDigits || id;

    // Fetch single invoice
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

export async function PATCH(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { invoiceId, paymentStatus, paymentId, paymentMethod, notes } = body;
    if (!invoiceId) {
      return NextResponse.json({ success: false, error: "Missing invoiceId" }, { status: 400 });
    }

    const cleanDigits = String(invoiceId).replace(/\D/g, "") || String(invoiceId);

    const { data: row } = await supabase
      .from("invoices")
      .select("id, data")
      .eq("id", cleanDigits)
      .single();

    if (!row) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const existingData = typeof row.data === "object" ? row.data : JSON.parse(row.data || "{}");
    const updatedData = {
      ...existingData,
      paymentStatus: paymentStatus || existingData.paymentStatus,
      paymentId: paymentId !== undefined ? paymentId : existingData.paymentId,
      paymentMethod: paymentMethod || existingData.paymentMethod,
      notes: notes !== undefined ? notes : existingData.notes,
      paidAt: paymentStatus === "PAID" ? new Date().toISOString() : existingData.paidAt,
    };

    const { error: updateErr } = await supabase
      .from("invoices")
      .update({ data: updatedData })
      .eq("id", cleanDigits);

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, invoice: updatedData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

    const cleanDigits = String(id).replace(/\D/g, "") || String(id);
    await supabase.from("invoices").delete().eq("id", cleanDigits);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
