import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { threadId, closedBy } = body;

    if (!threadId) {
      return NextResponse.json({ success: false, error: "Missing threadId" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const closer = closedBy === "staff" ? "Farm Staff" : "Visitor";

    // 1. Mark thread closed in Supabase
    try {
      await supabase.from("live_chat_threads").update({
        status: "closed",
        updated_at: nowIso,
      }).eq("id", threadId);
    } catch (_) {}

    // 2. Insert closing system message into chat
    try {
      await supabase.from("live_chat_messages").insert({
        id: `msg_${Date.now()}_close`,
        thread_id: threadId,
        sender: "staff",
        sender_name: "Urban Trout Support",
        text: "This chat conversation has been ended. Thank you for connecting with Urban Trout! 🐟",
        created_at: nowIso,
      });
    } catch (_) {}

    // 3. Notify Telegram if closed by customer
    if (closedBy !== "staff") {
      try {
        const { data: thread } = await supabase
          .from("live_chat_threads")
          .select("customer_name, telegram_message_id")
          .eq("id", threadId)
          .maybeSingle();

        await sendTelegramMessage(
          `🔴 <b>CHAT SESSION ENDED BY VISITOR</b>\n━━━━━━━━━━━━━━━━━━━━\n<b>Visitor:</b> ${thread?.customer_name || "Customer"}\n<code>#chat_${threadId}</code>\n<i>Conversation marked as closed.</i>`,
          "HTML",
          undefined,
          undefined,
          thread?.telegram_message_id ? Number(thread.telegram_message_id) : undefined
        );
      } catch (_) {}
    }

    return NextResponse.json({ success: true, status: "closed" });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
