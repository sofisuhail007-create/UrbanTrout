import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/adminAuth";
import { getAuditLogs, recordAuditLog, resolveActorFromRequest } from "@/lib/auditLog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/audit-log
 * Fetches the staff audit trail logs with optional filters.
 */
export async function GET(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "200", 10);
    const actor = searchParams.get("actor") || undefined;
    const action = searchParams.get("action") || undefined;
    const date = searchParams.get("date") || undefined;
    const entityId = searchParams.get("entity_id") || undefined;
    const search = searchParams.get("search") || undefined;

    const logs = await getAuditLogs({
      limit,
      actor,
      action,
      date,
      entityId,
      search,
    });

    return NextResponse.json({ success: true, logs, total: logs.length });
  } catch (err: any) {
    console.error("[api/audit-log] GET error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/audit-log
 * Allows manual or client-side dispatch of custom audit events.
 */
export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const actor = await resolveActorFromRequest(req, body.logged_by || body.actor_name);

    const entry = await recordAuditLog({
      action: body.action || "UPDATE_ENTRY",
      entity_type: body.entity_type || "vending_sale",
      entity_id: body.entity_id || "general",
      actor_name: actor.actor_name,
      actor_email: actor.actor_email,
      actor_role: actor.actor_role,
      summary: body.summary || "Staff action performed",
      changes: body.changes,
      previous_snapshot: body.previous_snapshot,
      new_snapshot: body.new_snapshot,
    });

    return NextResponse.json({ success: true, entry });
  } catch (err: any) {
    console.error("[api/audit-log] POST error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
