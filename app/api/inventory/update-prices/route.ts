import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminAuth } from "@/lib/adminAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/inventory/update-prices
 * Updates price_per_kg for one or more products in the Supabase inventory table.
 * Body: { products: [{ product_id: string, product_name: string, price_per_kg: number }] }
 */
export async function POST(request: Request) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { products } = body as {
      products: Array<{ product_id: string; product_name: string; price_per_kg: number }>;
    };

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing or empty products array" },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    const updated: string[] = [];

    for (const prod of products) {
      if (!prod.product_id || !prod.price_per_kg || prod.price_per_kg <= 0) {
        errors.push(`Invalid product entry: ${JSON.stringify(prod)}`);
        continue;
      }

      const { error } = await supabase.from("inventory").upsert(
        {
          product_id: prod.product_id,
          product_name: prod.product_name,
          price_per_kg: prod.price_per_kg,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id" }
      );

      if (error) {
        errors.push(`Failed to update ${prod.product_id}: ${error.message}`);
      } else {
        updated.push(prod.product_id);
      }
    }

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: errors.join("; ") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updated,
      errors: errors.length > 0 ? errors : undefined,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("update-prices error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
