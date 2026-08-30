import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const DEFAULT_SETTINGS: Record<string, string> = {
  delivery_radius_km: "5",
  farm_latitude: "34.144709",
  farm_longitude: "74.824525",
  farm_address_label: "Urban Trout Farm (Malabagh, Naseem Bagh, Srinagar)",
  delivery_fee_outside_5km: "40",
  allow_outside_radius_delivery: "false",
  max_dispatch_mins: "60",
  upi_id: "urbantrout@ybl",
  primary_phone: "+918491006127",
  alternate_phone: "+917006604148",
  email: "info.urbantrout@gmail.com",
};

const CACHE_FILE = path.join(process.cwd(), ".app_settings_cache.json");

function readLocalCache(): Record<string, string> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    }
  } catch (e) {
    // fallback
  }
  return { ...DEFAULT_SETTINGS };
}

function writeLocalCache(settings: Record<string, string>) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    // ignore
  }
}

export async function GET() {
  try {
    let settingsMap: Record<string, string> = readLocalCache();

    // Try reading from Supabase app_settings table
    try {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (!error && data && data.length > 0) {
        data.forEach((row: { key: string; value: string }) => {
          if (row.key && row.value !== undefined) {
            settingsMap[row.key] = row.value;
          }
        });
        writeLocalCache(settingsMap);
      }
    } catch (_) {
      // Supabase table not created yet, use local cache
    }

    const rows = Object.entries(settingsMap).map(([key, value]) => ({
      key,
      value,
    }));

    return NextResponse.json({
      success: true,
      settings: rows,
      settingsMap,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message, settingsMap: readLocalCache() },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let updates: Array<{ key: string; value: string; description?: string }> = [];

    if (Array.isArray(body)) {
      updates = body;
    } else if (body.updates && Array.isArray(body.updates)) {
      updates = body.updates;
    } else if (typeof body === "object") {
      updates = Object.entries(body).map(([key, value]) => ({
        key,
        value: String(value),
      }));
    }

    const currentCache = readLocalCache();
    updates.forEach((item) => {
      if (item.key && item.value !== undefined) {
        currentCache[item.key] = String(item.value);
      }
    });
    writeLocalCache(currentCache);

    // Try saving to Supabase
    let supabaseSaved = false;
    try {
      for (const item of updates) {
        const { error } = await supabase.from("app_settings").upsert(
          {
            key: item.key,
            value: String(item.value),
            description: item.description || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
        if (!error) supabaseSaved = true;
      }
    } catch (_) {
      // ignore if table doesn't exist
    }

    return NextResponse.json({
      success: true,
      supabaseSaved,
      settingsMap: currentCache,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
