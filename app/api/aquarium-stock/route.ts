import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  stock_before_kg?: number; // Present stock in aquarium right before intake
  stock_after_kg?: number;  // Total stock in aquarium right after intake
  batch_notes?: string;
  logged_by?: string;
  created_at: string;
}

async function getStockMetadata(): Promise<Record<string, { stock_before_kg: number; stock_after_kg: number }>> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "aquarium_stock_metadata")
      .maybeSingle();
    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (_) {}
  return {};
}

async function saveStockMetadata(metadata: Record<string, { stock_before_kg: number; stock_after_kg: number }>) {
  try {
    await supabaseAdmin.from("app_settings").upsert(
      {
        key: "aquarium_stock_metadata",
        value: JSON.stringify(metadata),
        description: "Tracks aquarium stock present before and after each procurement intake batch",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("Could not save aquarium_stock_metadata:", err);
  }
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

    const [meta, { getLiveAquariumStock }] = await Promise.all([
      getStockMetadata(),
      import("@/lib/aquariumStock"),
    ]);
    const liveSummary = await getLiveAquariumStock();

    const entries: AquariumStockEntry[] = (data || []).map((row: any) => {
      const m = meta[row.id];
      const stockBefore = m?.stock_before_kg !== undefined ? Number(m.stock_before_kg) : undefined;
      const stockAfter = m?.stock_after_kg !== undefined
        ? Number(m.stock_after_kg)
        : (stockBefore !== undefined ? Math.round((stockBefore + Number(row.weight_kg || 0)) * 1000) / 1000 : undefined);

      return {
        ...row,
        weight_kg: Number(row.weight_kg || 0),
        cost_per_kg: Number(row.cost_per_kg || 0),
        total_cost: Number(row.total_cost || (row.weight_kg * row.cost_per_kg) || 0),
        stock_before_kg: stockBefore,
        stock_after_kg: stockAfter,
      };
    });

    return NextResponse.json(
      {
        success: true,
        entries,
        isTableAvailable: true,
        liveSummary,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        },
      }
    );
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
      stock_before_kg,
      stock_after_kg,
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

    // Determine present stock before adding this batch
    let beforeKg: number;
    if (stock_before_kg !== undefined && stock_before_kg !== null && !isNaN(Number(stock_before_kg))) {
      beforeKg = Math.round(Number(stock_before_kg) * 1000) / 1000;
    } else {
      const { getLiveAquariumStock } = await import("@/lib/aquariumStock");
      const live = await getLiveAquariumStock();
      beforeKg = live.remainingKg;
    }

    const afterKg =
      stock_after_kg !== undefined && stock_after_kg !== null && !isNaN(Number(stock_after_kg))
        ? Math.round(Number(stock_after_kg) * 1000) / 1000
        : Math.round((beforeKg + Number(weight_kg)) * 1000) / 1000;

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
          product_type: product_type || "Live Fish",
          weight_kg: Number(weight_kg),
          cost_per_kg: Number(cost_per_kg),
          batch_notes: batch_notes || null,
          logged_by: logged_by || "Admin",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Persist stock before/after metadata in app_settings
    try {
      const meta = await getStockMetadata();
      meta[data.id] = { stock_before_kg: beforeKg, stock_after_kg: afterKg };
      await saveStockMetadata(meta);
    } catch (e) {
      console.warn("Could not save stock metadata:", e);
    }

    const enrichedEntry: AquariumStockEntry = {
      ...data,
      stock_before_kg: beforeKg,
      stock_after_kg: afterKg,
    };

    return NextResponse.json({ success: true, entry: enrichedEntry }, { status: 201 });
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

    // Clean up metadata
    try {
      const meta = await getStockMetadata();
      if (meta[id]) {
        delete meta[id];
        await saveStockMetadata(meta);
      }
    } catch (_) {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[aquarium-stock DELETE]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete entry" },
      { status: 500 }
    );
  }
}
