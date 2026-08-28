import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { FarmVisit, VisitStatus } from "@/lib/supabase";

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || "6Le7xJQtAAAAAKgkdHH240Wiov0Fn__lr6jryN8D";

// ─── POST: Pre-Notify a Farm Visit ───
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      visitor_name,
      phone,
      email,
      visit_date,
      time_slot,
      guest_count,
      visit_purpose,
      special_requests,
      token,
    } = body;

    // 1. Validate required fields
    if (!visitor_name?.trim() || !phone?.trim() || !visit_date || !time_slot) {
      return NextResponse.json(
        { success: false, error: "Please provide your Name, Phone number, Visit Date, and Preferred Time Slot." },
        { status: 400 }
      );
    }

    // 2. Validate Google reCAPTCHA if token provided
    if (token) {
      try {
        const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${RECAPTCHA_SECRET}&response=${token}`,
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.3)) {
          return NextResponse.json(
            { success: false, error: "Security check failed. Please refresh and try again." },
            { status: 403 }
          );
        }
      } catch (recaptchaErr) {
        console.warn("reCAPTCHA check warning:", recaptchaErr);
      }
    }

    const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
    const guests = Math.max(1, parseInt(String(guest_count || 1), 10));
    const purpose = visit_purpose || "Live Trout Purchase / Viewing";
    const nowIso = new Date().toISOString();

    const newVisit: FarmVisit = {
      id: `visit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      visitor_name: visitor_name.trim(),
      phone: cleanPhone,
      email: email?.trim() || null,
      visit_date,
      time_slot,
      guest_count: guests,
      visit_purpose: purpose,
      special_requests: special_requests?.trim() || null,
      status: "pending",
      admin_notes: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let dbSaved = false;

    // 3. Try saving to public.farm_visits table
    try {
      const { error: insertErr } = await supabase.from("farm_visits").insert({
        id: newVisit.id,
        visitor_name: newVisit.visitor_name,
        phone: newVisit.phone,
        email: newVisit.email,
        visit_date: newVisit.visit_date,
        time_slot: newVisit.time_slot,
        guest_count: newVisit.guest_count,
        visit_purpose: newVisit.visit_purpose,
        special_requests: newVisit.special_requests,
        status: "pending",
        admin_notes: null,
        created_at: nowIso,
      });

      if (!insertErr) {
        dbSaved = true;
      } else {
        console.warn("Supabase farm_visits table insert notice:", insertErr.message);
      }
    } catch (dbErr) {
      console.warn("farm_visits table not reachable directly:", dbErr);
    }

    // 4. Fallback: Save to leads table with [FARM_VISIT] metadata tag if table not yet migrated
    if (!dbSaved) {
      try {
        const visitPayload = JSON.stringify({
          visit_id: newVisit.id,
          visitor_name: newVisit.visitor_name,
          date: newVisit.visit_date,
          slot: newVisit.time_slot,
          guests: newVisit.guest_count,
          purpose: newVisit.visit_purpose,
          requests: newVisit.special_requests,
          status: "pending",
        });

        await supabase.from("leads").insert({
          customer_name: newVisit.visitor_name,
          customer_phone: cleanPhone,
          customer_email: newVisit.email,
          customer_locality: "Srinagar (Farm Visit)",
          customer_address: `Farm Visit Request: ${newVisit.visit_date} @ ${newVisit.time_slot}`,
          customer_pincode: "190006",
          cart_items: [],
          estimated_total: 0,
          status: "abandoned",
          notes: `[FARM_VISIT] ${visitPayload}`,
          created_at: nowIso,
          updated_at: nowIso,
        });
      } catch (leadErr) {
        console.warn("Leads fallback notice:", leadErr);
      }
    }

    // 5. Upsert to customers table for CRM tracking
    try {
      await supabase.from("customers").upsert({
        phone: cleanPhone,
        name: newVisit.visitor_name,
        locality: "Srinagar (Farm Visitor)",
        pincode: "190006",
        notes: `[Farm Visit Pre-Notified] Date: ${newVisit.visit_date} (${newVisit.time_slot}) | ${newVisit.guest_count} Guests | Purpose: ${newVisit.visit_purpose}`,
        last_order_at: nowIso,
      }, { onConflict: "phone" });
    } catch (custErr) {
      console.warn("Customers upsert notice:", custErr);
    }

    // 6. Instant Telegram Alert
    try {
      const { notifyFarmVisit } = await import("@/lib/telegram");
      await notifyFarmVisit(newVisit);
    } catch (tgErr) {
      console.warn("Telegram visit notification notice:", tgErr);
    }

    // 7. Resend Email Alert
    try {
      const { sendFarmVisitEmail } = await import("@/lib/email");
      await sendFarmVisitEmail(newVisit);
    } catch (emailErr) {
      console.warn("Email visit notification notice:", emailErr);
    }

    return NextResponse.json({
      success: true,
      visit: newVisit,
      message: "Your farm visit pre-notification has been submitted! Our team will prepare for your arrival.",
    });

  } catch (error: any) {
    console.error("Farm Visits POST error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to submit farm visit request." },
      { status: 500 }
    );
  }
}

// ─── GET: Fetch Farm Visits (Admin) ───
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    let visits: FarmVisit[] = [];

    // 1. Try querying farm_visits table
    try {
      let query = supabase.from("farm_visits").select("*").order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        visits = data as FarmVisit[];
      }
    } catch (tableErr) {
      console.warn("farm_visits table query fallback:", tableErr);
    }

    // 2. Fallback: Parse from leads table if farm_visits table is empty or uncreated
    if (visits.length === 0) {
      try {
        const { data: leadsData } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        if (leadsData) {
          const parsedVisits: FarmVisit[] = [];
          for (const item of leadsData) {
            if (item.notes && item.notes.includes("[FARM_VISIT]")) {
              try {
                const jsonStr = item.notes.replace("[FARM_VISIT]", "").trim();
                const parsed = JSON.parse(jsonStr);
                parsedVisits.push({
                  id: parsed.visit_id || item.id,
                  visitor_name: parsed.visitor_name || item.customer_name || "Visitor",
                  phone: item.customer_phone,
                  email: item.customer_email || null,
                  visit_date: parsed.date || item.created_at?.split("T")[0],
                  time_slot: parsed.slot || "Morning (10:00 AM - 12:00 PM)",
                  guest_count: parsed.guests || 1,
                  visit_purpose: parsed.purpose || "Live Trout Purchase / Viewing",
                  special_requests: parsed.requests || null,
                  status: (parsed.status as VisitStatus) || (item.status === "converted" ? "completed" : "pending"),
                  admin_notes: parsed.admin_notes || null,
                  created_at: item.created_at,
                  updated_at: item.updated_at,
                });
              } catch (_) {
                parsedVisits.push({
                  id: item.id,
                  visitor_name: item.customer_name || "Visitor",
                  phone: item.customer_phone,
                  email: item.customer_email || null,
                  visit_date: item.created_at?.split("T")[0],
                  time_slot: "Flexible",
                  guest_count: 1,
                  visit_purpose: "Farm Visit",
                  special_requests: item.notes,
                  status: "pending",
                  admin_notes: null,
                  created_at: item.created_at,
                  updated_at: item.updated_at,
                });
              }
            }
          }

          if (parsedVisits.length > 0) {
            visits = statusFilter && statusFilter !== "all"
              ? parsedVisits.filter(v => v.status === statusFilter)
              : parsedVisits;
          }
        }
      } catch (leadFallbackErr) {
        console.warn("Error parsing visits from leads:", leadFallbackErr);
      }
    }

    return NextResponse.json({
      success: true,
      visits,
      count: visits.length,
    });

  } catch (error: any) {
    console.error("Farm Visits GET error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch farm visits." },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update Visit Status & Admin Notes (Admin) ───
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, admin_notes } = body;

    if (!id || !status) {
      return NextResponse.json(
        { success: false, error: "Missing visit ID or new status." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    let updated = false;

    // 1. Try updating farm_visits table
    try {
      const updatePayload: any = { status, updated_at: nowIso };
      if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes;

      const { error } = await supabase
        .from("farm_visits")
        .update(updatePayload)
        .eq("id", id);

      if (!error) updated = true;
    } catch (_) {}

    // 2. Fallback: Update leads record if matched
    if (!updated) {
      try {
        const { data: leads } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
        if (leads) {
          for (const lead of leads) {
            if (lead.id === id || (lead.notes && lead.notes.includes(id))) {
              let updatedNotes = lead.notes;
              try {
                const jsonStr = lead.notes.replace("[FARM_VISIT]", "").trim();
                const parsed = JSON.parse(jsonStr);
                parsed.status = status;
                if (admin_notes !== undefined) parsed.admin_notes = admin_notes;
                updatedNotes = `[FARM_VISIT] ${JSON.stringify(parsed)}`;
              } catch (_) {}

              await supabase.from("leads").update({
                notes: updatedNotes,
                status: status === "completed" ? "converted" : "abandoned",
                updated_at: nowIso,
              }).eq("id", lead.id);

              updated = true;
              break;
            }
          }
        }
      } catch (leadUpdateErr) {
        console.warn("Lead fallback update notice:", leadUpdateErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Visit status updated to ${status}`,
    });

  } catch (error: any) {
    console.error("Farm Visits PATCH error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update visit." },
      { status: 500 }
    );
  }
}
