import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json({ success: false, error: "Missing threadId" }, { status: 400 });
    }

    const { data: messages, error } = await supabase
      .from("live_chat_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message, messages: [] });
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message, messages: [] }, { status: 500 });
  }
}
