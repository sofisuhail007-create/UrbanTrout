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
    const { threadId, senderName, email, phone, locality, text, recaptchaToken } = body;

    if (!threadId || !text || !text.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing threadId or message text." },
        { status: 400 }
      );
    }

    // Optional reCAPTCHA v3 verification (bot filter)
    if (recaptchaToken && process.env.RECAPTCHA_SECRET_KEY) {
      try {
        const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
        });
        const verifyData = await verifyRes.json();
        // Only block if Google explicitly reports low bot score < 0.1
        if (verifyData.success && typeof verifyData.score === "number" && verifyData.score < 0.1) {
          return NextResponse.json(
            { success: false, error: "Security check failed. Please try again." },
            { status: 403 }
          );
        }
      } catch (rcErr) {
        console.warn("reCAPTCHA check notice:", rcErr);
      }
    }

    const cleanText = text.trim();
    const rawDigits = phone ? String(phone).replace(/\D/g, "") : "";
    const cleanPhone = rawDigits.length >= 10 ? rawDigits.slice(-10) : undefined;
    const cleanEmail = email && typeof email === "string" ? email.trim().toLowerCase() : undefined;
    const name = (senderName || "Website Visitor").trim();

    // Strict Phone Validation if phone is submitted
    if (cleanPhone) {
      const isFakeSequence = ["1234567890", "0123456789", "9876543210", "0987654321", "9898989898", "9191919191", "9090909090", "9999900000"].includes(cleanPhone);
      const isRepeated = /^(\d)\1{9}$/.test(cleanPhone);
      const uniqueDigits = new Set(cleanPhone.split("")).size;
      const isValidMobile = /^[6-9]\d{9}$/.test(cleanPhone);

      if (!isValidMobile || isRepeated || isFakeSequence || uniqueDigits < 4) {
        return NextResponse.json(
          { success: false, error: "Please provide a genuine 10-digit mobile number." },
          { status: 400 }
        );
      }
    }

    // Strict Email Validation if email is submitted
    if (cleanEmail) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
      if (!emailRegex.test(cleanEmail)) {
        return NextResponse.json(
          { success: false, error: "Please provide a valid email address." },
          { status: 400 }
        );
      }
    }

    const nowIso = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Ensure thread exists and check for existing telegram_message_id
    let existingTelegramMsgId: number | undefined;
    try {
      const { data: existingThread } = await supabase
        .from("live_chat_threads")
        .select("telegram_message_id")
        .eq("id", threadId)
        .maybeSingle();

      if (existingThread?.telegram_message_id) {
        existingTelegramMsgId = Number(existingThread.telegram_message_id);
      }

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

      // If phone is present, record/update lead in customers table
      if (cleanPhone) {
        await supabase.from("customers").upsert({
          phone: cleanPhone,
          name: name,
          email: cleanEmail || null,
          locality: locality || "Srinagar (Live Chat)",
          updated_at: nowIso,
        }, { onConflict: "phone" });
      }
    } catch (threadErr) {
      console.warn("Could not upsert live_chat_threads / customers:", threadErr);
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

    // 3. Send Telegram Notification (Chained to existing thread if follow-up)
    let telegramMsgId: number | undefined;
    try {
      const tgRes = await notifyLiveChatMessage({
        threadId,
        senderName: name,
        phone: cleanPhone,
        email: cleanEmail,
        locality,
        text: cleanText,
        parentTelegramMsgId: existingTelegramMsgId,
      });

      if (tgRes?.ok && tgRes.result?.message_id) {
        telegramMsgId = tgRes.result.message_id;
        // If this was the first message in thread, store its message_id
        if (!existingTelegramMsgId) {
          try {
            await supabase.from("live_chat_threads").update({
              telegram_message_id: telegramMsgId,
              telegram_chat_id: String(tgRes.result.chat?.id || ""),
            }).eq("id", threadId);
          } catch (_) {}
        }
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
