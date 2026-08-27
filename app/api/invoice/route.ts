import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { invoiceId, data } = body;

    if (!invoiceId || !data) {
      return NextResponse.json({ success: false, error: "Missing invoiceId or data" }, { status: 400 });
    }

    const cleanDigits = String(invoiceId).replace(/\D/g, "");
    const key = `inv_${cleanDigits || invoiceId}`;

    const { error } = await supabase.from("app_settings").upsert(
      {
        key,
        value: typeof data === "string" ? data : JSON.stringify(data),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("Error saving invoice in app_settings:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, key });
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
    const key = `inv_${cleanDigits || id}`;

    // 1. Try fetching from app_settings
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .single();

    if (settingRow?.value) {
      try {
        const parsed = JSON.parse(settingRow.value);
        return NextResponse.json({ success: true, invoice: parsed, source: "app_settings" });
      } catch (e) {}
    }

    // 2. Try fetching from orders table (for online orders)
    const numId = parseInt(cleanDigits, 10);
    let query = supabase.from("orders").select("*");
    if (!isNaN(numId)) {
      query = query.eq("order_number", numId);
    } else {
      query = query.eq("id", id);
    }

    const { data: dbOrder } = await query.single();
    if (dbOrder) {
      const orderItems = Array.isArray(dbOrder.items) ? dbOrder.items : [];
      const tw = orderItems.reduce((s: number, i: any) => s + (parseFloat(i.quantity) || 0), 0);
      const orderCreated = new Date(dbOrder.created_at).getTime();

      const invoiceData = {
        num: `UT-INV-${dbOrder.order_number || dbOrder.id.slice(0, 6)}`,
        name: dbOrder.customer_name || "Valued Customer",
        phone: dbOrder.customer_phone || "N/A",
        items: orderItems.map((i: any) => ({
          n: i.name,
          w: parseFloat(i.quantity) || 1,
          r: i.price || 550,
          t: (parseFloat(i.quantity) || 1) * (i.price || 550),
        })),
        tw,
        tot: dbOrder.total || 0,
        ts: orderCreated,
      };

      return NextResponse.json({ success: true, invoice: invoiceData, source: "orders" });
    }

    return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
  } catch (err: any) {
    console.error("API Invoice GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
