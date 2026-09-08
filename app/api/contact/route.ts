import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;

export async function POST(request: Request) {
  // Rate limit: max 10 contact requests per minute per IP
  const { limited } = checkRateLimit(request, 10, 60 * 1000);
  if (limited) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a minute before trying again." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { name, phone, email, subject, message, token } = body;

    // 1. Validate required fields
    if (!name || !phone || !message) {
      return NextResponse.json(
        { success: false, error: "Please fill in Name, Phone number, and Message." },
        { status: 400 }
      );
    }

    // 2. Validate Google reCAPTCHA token if provided
    if (token) {
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
      });

      const verifyData = await verifyRes.json();

      // Check if reCAPTCHA verification failed or detected a bot (score < 0.3 for v3)
      if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.3)) {
        return NextResponse.json(
          { success: false, error: "Security check failed. Please refresh and try again." },
          { status: 403 }
        );
      }
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    // 3. Save contact inquiry to customers table as lead / inquiry
    try {
      await supabase.from("customers").upsert({
        phone: cleanPhone,
        name: name.trim(),
        locality: "Srinagar (Inquiry)",
        pincode: "190006",
        notes: `[Contact Form] ${subject ? `Subject: ${subject} | ` : ''}${message.trim()}${email ? ` | Email: ${email}` : ''}`,
        last_order_at: new Date().toISOString(),
      }, { onConflict: "phone" });
    } catch (dbErr) {
      console.warn("Contact inquiry DB notice:", dbErr);
    }

    // 4. Send Instant Telegram Alert
    try {
      const { notifyContactInquiry } = await import("@/lib/telegram");
      await notifyContactInquiry({
        name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || undefined,
        subject: subject || "General Inquiry",
        message: message.trim(),
      });
    } catch (tgErr) {
      console.warn("Telegram contact alert notice:", tgErr);
    }

    // 5. Send Resend Email Alert to Admin
    try {
      const { sendContactInquiryEmail } = await import("@/lib/email");
      await sendContactInquiryEmail({
        name: name.trim(),
        phone: cleanPhone,
        email: email?.trim() || undefined,
        subject: subject || "General Inquiry",
        message: message.trim(),
      });
    } catch (emailErr) {
      console.warn("Resend contact alert notice:", emailErr);
    }

    return NextResponse.json({
      success: true,
      message: "Thank you! Your message has been sent to our farm team. We will get back to you shortly.",
    });

  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try WhatsApp support." },
      { status: 500 }
    );
  }
}

// ─── DELETE: Delete Customer Record (Admin) ───
export async function DELETE(request: Request) {
  const { requireAdminAuth } = await import("@/lib/adminAuth");
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const phone = searchParams.get("phone");

    if (!id && !phone) {
      return NextResponse.json({ success: false, error: "Missing customer id or phone" }, { status: 400 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const client = createClient(url, key);

    if (id) {
      await client.from("customers").delete().eq("id", id);
    }
    if (phone) {
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);
      await client.from("customers").delete().eq("phone", cleanPhone);
    }

    return NextResponse.json({ success: true, message: "Customer deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to delete customer" }, { status: 500 });
  }
}
