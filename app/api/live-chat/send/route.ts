import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyLiveChatMessage } from "@/lib/telegram";
import { checkRateLimit } from "@/lib/rateLimit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  // Rate limit: max 25 messages per minute per IP
  const { limited } = checkRateLimit(request, 25, 60 * 1000);
  if (limited) {
    return NextResponse.json(
      { success: false, error: "Too many messages. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { threadId, senderName, phone, locality, text } = body;

    if (!threadId || !text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing threadId or message text." },
        { status: 400 }
      );
    }

    const cleanText = text.trim();
    const cleanPhone = phone ? String(phone).replace(/\D/g, "").slice(-10) : undefined;
    const name = (senderName || "Website Visitor").trim();
    const nowIso = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Ensure thread exists or update thread
    try {
      await supabase.from("live_chat_threads").upsert({
        id: threadId,
        customer_name: name,
        customer_phone: cleanPhone || null,
        customer_locality: locality || "Srinagar",
        status: "active",
        last_message: cleanText,
        last_message_at: nowIso,
        updated_at: nowIso,
      }, { onConflict: "id" });
    } catch (threadErr) {
      console.warn("Could not upsert live_chat_threads:", threadErr);
    }

    // 2. Insert message into live_chat_messages
    try {
      await supabase.from("live_chat_messages").insert({
        id: messageId,
        thread_id: threadId,
        sender: "customer",
        sender_name: name,
        text: cleanText,
        created_at: nowIso,
      });
    } catch (msgErr) {
      console.warn("Could not insert into live_chat_messages:", msgErr);
    }

    // 3. Send Telegram Notification to Admin / Farm Team
    let telegramMsgId: number | undefined;
    try {
      const tgRes = await notifyLiveChatMessage({
        threadId,
        senderName: name,
        phone: cleanPhone,
        locality,
        text: cleanText,
      });

      if (tgRes?.ok && tgRes.result?.message_id) {
        telegramMsgId = tgRes.result.message_id;
        // Update thread with telegram_message_id for swipe-reply matching
        try {
          await supabase.from("live_chat_threads").update({
            telegram_message_id: telegramMsgId,
            telegram_chat_id: String(tgRes.result.chat?.id || ""),
          }).eq("id", threadId);
        } catch (_) {}
      }
    } catch (tgErr) {
      console.warn("Failed to notify Telegram:", tgErr);
    }

    return NextResponse.json({
      success: true,
      messageId,
      telegramNotified: !!telegramMsgId,
    });

  } catch (error: any) {
    console.error("Live Chat Send error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to send message." },
      { status: 500 }
    );
  }
}
