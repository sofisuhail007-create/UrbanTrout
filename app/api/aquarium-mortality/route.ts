import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AquariumMortalityEntry {
  id: string;
  mortality_date: string; // YYYY-MM-DD
  mortality_time: string; // e.g. "09:30 AM"
  weight_kg: number;
  fish_count: number;
  reason: string; // "Transport Stress" | "Water Temp Shock" | "Aeration / DO Drop" | "Handling Damage" | "Natural Mortality" | "Other"
  notes?: string;
  logged_by?: string;
  created_at: string;
}

const SETTINGS_KEY = "aquarium_mortality_ledger";

async function getStoredMortalityLedger(): Promise<AquariumMortalityEntry[]> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("Error reading mortality ledger from app_settings:", err);
  }
  return [];
}

async function saveStoredMortalityLedger(
  entries: AquariumMortalityEntry[]
): Promise<boolean> {
  try {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: JSON.stringify(entries),
        description: "Aquarium live fish mortality and scrap loss ledger",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) {
      console.warn("Error saving mortality ledger to app_settings:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Exception saving mortality ledger to app_settings:", err);
    return false;
  }
}

// ─── GET: Fetch all mortality logs ───
export async function GET(req: NextRequest) {
  try {
    // 1. Try dedicated table first
    const { data, error } = await supabase
      .from("aquarium_mortality_log")
      .select("*")
      .order("mortality_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      return NextResponse.json({
        success: true,
        entries: data,
        source: "table",
      });
    }

    // 2. Fallback to app_settings
    const fallback = await getStoredMortalityLedger();
    return NextResponse.json({
      success: true,
      entries: fallback,
      source: "app_settings",
    });
  } catch (err: any) {
    console.error("[aquarium-mortality GET]", err);
    const fallback = await getStoredMortalityLedger();
    return NextResponse.json({
      success: true,
      entries: fallback,
      source: "fallback",
    });
  }
}

// ─── POST: Add a new mortality log ───
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mortality_date,
      mortality_time,
      weight_kg,
      fish_count,
      reason,
      notes,
      logged_by,
    } = body;

    const w = Number(weight_kg);
    if (isNaN(w) || w <= 0) {
      return NextResponse.json(
        { success: false, error: "weight_kg must be a positive number" },
        { status: 400 }
      );
    }

    const count = Math.max(1, parseInt(fish_count, 10) || 1);
    const now = new Date();
    const defaultDate = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const defaultTime = now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const newEntry: AquariumMortalityEntry = {
      id: "mort_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      mortality_date: mortality_date || defaultDate,
      mortality_time: mortality_time || defaultTime,
      weight_kg: Math.round(w * 1000) / 1000,
      fish_count: count,
      reason: reason || "Natural Mortality",
      notes: notes || "",
      logged_by: logged_by || "Admin",
      created_at: new Date().toISOString(),
    };

    // 1. Try dedicated table
    let tableSuccess = false;
    try {
      const { data, error } = await supabase
        .from("aquarium_mortality_log")
        .insert([newEntry])
        .select()
        .single();

      if (!error && data) {
        tableSuccess = true;
      }
    } catch (_) {}

    // 2. Always sync/fallback to app_settings
    const current = await getStoredMortalityLedger();
    const updated = [newEntry, ...current.filter((e) => e.id !== newEntry.id)];
    await saveStoredMortalityLedger(updated);

    return NextResponse.json(
      {
        success: true,
        entry: newEntry,
        storage: tableSuccess ? "table+cache" : "cache",
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[aquarium-mortality POST]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save mortality log" },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete a mortality log by ID ───
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

    // 1. Try deleting from table
    try {
      await supabase.from("aquarium_mortality_log").delete().eq("id", id);
    } catch (_) {}

    // 2. Delete from app_settings
    const current = await getStoredMortalityLedger();
    const filtered = current.filter((e) => e.id !== id);
    await saveStoredMortalityLedger(filtered);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[aquarium-mortality DELETE]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete mortality log" },
      { status: 500 }
    );
  }
}
