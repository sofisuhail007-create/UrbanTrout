import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    const { data, error } = await supabase.from("inventory").select("*");
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, inventory: data || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const productId = searchParams.get("productId");

    if (!id && !productId) {
      return NextResponse.json(
        { success: false, error: "Missing required parameter: 'id' or 'productId'" },
        { status: 400 }
      );
    }

    let query = supabase.from("inventory").delete();
    if (id) {
      query = query.eq("id", id);
    } else if (productId) {
      query = query.eq("product_id", productId);
    }

    const { error: invError } = await query;
    if (invError) {
      return NextResponse.json({ success: false, error: invError.message }, { status: 500 });
    }

    // Clean up product metadata from app_settings if productId is known
    if (productId) {
      await supabase.from("app_settings").delete().eq("key", `product_meta_${productId}`);
    }

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully from inventory",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

