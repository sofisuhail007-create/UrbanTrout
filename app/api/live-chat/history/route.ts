import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { success: false, error: "Missing threadId", messages: [] },
        { status: 400, headers: noCacheHeaders }
      );
    }

    const { data: messages, error } = await supabase
      .from("live_chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message, messages: [] },
        { headers: noCacheHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        messages: messages || [],
      },
      { headers: noCacheHeaders }
    );

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message, messages: [] },
      { status: 500, headers: noCacheHeaders }
    );
  }
}
