import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface AquariumStockEntry {
  id: string;
  stock_date: string;
  stock_time: string;
  supplier_name: string;
  product_type: string; // 'Gutted' | 'Non Gutted'
  weight_kg: number;
  cost_per_kg: number;
  total_cost: number;
  batch_notes?: string;
  logged_by?: string;
  created_at: string;
}

// ─── GET: Fetch all stock procurement entries ───
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("aquarium_stock_log")
      .select("*")
      .order("stock_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (
        error.message?.includes("does not exist") ||
        error.code === "42P01"
      ) {
        return NextResponse.json({
          success: true,
          entries: [],
          isTableAvailable: false,
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      entries: data || [],
      isTableAvailable: true,
    });
  } catch (err: any) {
    console.error("[aquarium-stock GET]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch stock log" },
      { status: 500 }
    );
  }
}

// ─── POST: Add a new procurement entry ───
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      stock_date,
      stock_time,
      supplier_name,
      product_type,
      weight_kg,
      cost_per_kg,
      batch_notes,
      logged_by,
    } = body;

    if (!weight_kg || Number(weight_kg) <= 0) {
      return NextResponse.json(
        { success: false, error: "weight_kg must be a positive number" },
        { status: 400 }
      );
    }
    if (!cost_per_kg || Number(cost_per_kg) <= 0) {
      return NextResponse.json(
        { success: false, error: "cost_per_kg must be a positive number" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("aquarium_stock_log")
      .insert([
        {
          stock_date:
            stock_date ||
            new Intl.DateTimeFormat("en-CA", {
              timeZone: "Asia/Kolkata",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date()),
          stock_time:
            stock_time ||
            new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            }),
          supplier_name: supplier_name || "Khyber Aquaculture",
          product_type: product_type || "Non Gutted",
          weight_kg: Number(weight_kg),
          cost_per_kg: Number(cost_per_kg),
          batch_notes: batch_notes || null,
          logged_by: logged_by || "Admin",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry: data }, { status: 201 });
  } catch (err: any) {
    console.error("[aquarium-stock POST]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save stock entry" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Remove a stock entry by id ───
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id parameter" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("aquarium_stock_log")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[aquarium-stock DELETE]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete entry" },
      { status: 500 }
    );
  }
}
