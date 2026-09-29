import { createClient } from "@supabase/supabase-js";

export interface AuditDiff {
  from: any;
  to: any;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO string e.g. "2026-09-29T14:16:21.000Z"
  ist_date: string; // "YYYY-MM-DD" in Asia/Kolkata
  ist_time: string; // e.g. "07:46 pm" in Asia/Kolkata
  action:
    | "CREATE_ENTRY"
    | "UPDATE_ENTRY"
    | "DELETE_ENTRY"
    | "CREATE_EXPENSE"
    | "UPDATE_EXPENSE"
    | "DELETE_EXPENSE"
    | "UPDATE_BALANCE"
    | "CREATE_BILL"
    | "DELETE_BILL";
  entity_type: "vending_sale" | "vending_expense" | "customer_balance" | "billing_invoice";
  entity_id: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  summary: string;
  changes?: Record<string, AuditDiff>;
  previous_snapshot?: any;
  new_snapshot?: any;
  ip_address?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const AUDIT_SETTINGS_KEY = "staff_audit_trail_logs";
const MAX_LOGS_RETAINED = 2000;

export function getIstDateTime(dateObj?: Date) {
  const d = dateObj || new Date();
  const ist_date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  const ist_time = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d).toLowerCase();

  return { ist_date, ist_time };
}

/**
 * Resolves actor name, email, and role from incoming Request headers / token.
 */
export async function resolveActorFromRequest(
  request?: Request,
  fallbackName?: string
): Promise<{ actor_name: string; actor_email: string; actor_role: string }> {
  let actor_name = fallbackName ? String(fallbackName).trim() : "Staff";
  let actor_email = "counter.staff@urbantrout.in";
  let actor_role = "Sales Staff";

  if (!request) {
    if (actor_name.toLowerCase().includes("suhail")) {
      return { actor_name: "Suhail", actor_email: "sofisuhail007@gmail.com", actor_role: "Super Admin" };
    }
    if (actor_name.toLowerCase().includes("amin")) {
      return { actor_name: "Mohd Amin", actor_email: "work.suhail007@gmail.com", actor_role: "Sales Staff" };
    }
    return { actor_name, actor_email, actor_role };
  }

  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearerToken = authHeader.substring(7).trim();
    try {
      const { data: { user } } = await supabase.auth.getUser(bearerToken);
      if (user?.email) {
        actor_email = user.email.toLowerCase().trim();

        if (actor_email === "sofisuhail007@gmail.com") {
          actor_name = "Suhail";
          actor_role = "Super Admin";
          return { actor_name, actor_email, actor_role };
        }

        if (actor_email === "info.urbantrout@gmail.com") {
          actor_name = "Urban Trout Admin";
          actor_role = "Super Admin";
          return { actor_name, actor_email, actor_role };
        }

        if (actor_email === "work.suhail007@gmail.com" || actor_email === "worksuhail007@gmail.com") {
          actor_name = "Mohd Amin";
          actor_role = "Sales Staff (Counter)";
          return { actor_name, actor_email, actor_role };
        }

        // Check staff permissions list in app_settings
        try {
          const { data: staffRow } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "staff_permissions")
            .maybeSingle();

          if (staffRow?.value) {
            const list = JSON.parse(staffRow.value);
            if (Array.isArray(list)) {
              const member = list.find((s: any) => s.email?.toLowerCase().trim() === actor_email);
              if (member) {
                actor_name = member.name || member.display_name || actor_name;
                actor_role = member.role || "Sales Staff";
                return { actor_name, actor_email, actor_role };
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Fallback if staff header or body name provided
  if (fallbackName) {
    const lower = fallbackName.toLowerCase();
    if (lower.includes("amin")) {
      actor_name = "Mohd Amin";
      actor_email = "work.suhail007@gmail.com";
      actor_role = "Sales Staff (Counter)";
    } else if (lower.includes("suhail")) {
      actor_name = "Suhail";
      actor_email = "sofisuhail007@gmail.com";
      actor_role = "Super Admin";
    }
  }

  return { actor_name, actor_email, actor_role };
}

/**
 * Records an immutable audit log entry into the dual-storage audit store.
 */
export async function recordAuditLog(payload: {
  action: AuditLogEntry["action"];
  entity_type: AuditLogEntry["entity_type"];
  entity_id: string;
  actor_name?: string;
  actor_email?: string;
  actor_role?: string;
  summary: string;
  changes?: Record<string, AuditDiff>;
  previous_snapshot?: any;
  new_snapshot?: any;
  ip_address?: string;
}): Promise<AuditLogEntry> {
  const now = new Date();
  const { ist_date, ist_time } = getIstDateTime(now);

  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    ist_date,
    ist_time,
    action: payload.action,
    entity_type: payload.entity_type,
    entity_id: String(payload.entity_id || ""),
    actor_name: payload.actor_name || "Staff",
    actor_email: payload.actor_email || "counter.staff@urbantrout.in",
    actor_role: payload.actor_role || "Sales Staff",
    summary: payload.summary,
    changes: payload.changes || undefined,
    previous_snapshot: payload.previous_snapshot || undefined,
    new_snapshot: payload.new_snapshot || undefined,
    ip_address: payload.ip_address || undefined,
  };

  // 1. Try writing to dedicated table public.staff_audit_logs (if present)
  try {
    await supabase.from("staff_audit_logs").insert([entry]);
  } catch (_) {}

  // 2. Dual-redundancy storage in app_settings (key: staff_audit_trail_logs)
  try {
    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", AUDIT_SETTINGS_KEY)
      .maybeSingle();

    let logs: AuditLogEntry[] = [];
    if (row?.value) {
      try {
        logs = JSON.parse(row.value);
        if (!Array.isArray(logs)) logs = [];
      } catch (_) {}
    }

    logs.unshift(entry);
    if (logs.length > MAX_LOGS_RETAINED) {
      logs = logs.slice(0, MAX_LOGS_RETAINED);
    }

    await supabase.from("app_settings").upsert(
      {
        key: AUDIT_SETTINGS_KEY,
        value: JSON.stringify(logs),
        description: "Immutable audit trail of all staff activities, sales modifications, additions, and deletions",
        updated_at: now.toISOString(),
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("[auditLog] Error saving to app_settings audit store:", err);
  }

  return entry;
}

/**
 * Retrieves audit logs with optional filtering.
 */
export async function getAuditLogs(options?: {
  limit?: number;
  actor?: string;
  action?: string;
  date?: string;
  entityId?: string;
  search?: string;
}): Promise<AuditLogEntry[]> {
  const limit = options?.limit || 200;

  // 1. Try reading from dedicated table if available
  try {
    let query = supabase
      .from("staff_audit_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    if (options?.actor && options.actor !== "all") {
      query = query.ilike("actor_name", `%${options.actor}%`);
    }
    if (options?.action && options.action !== "all") {
      query = query.eq("action", options.action);
    }
    if (options?.date && options.date !== "all") {
      query = query.eq("ist_date", options.date);
    }
    if (options?.entityId) {
      query = query.eq("entity_id", options.entityId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (_) {}

  // 2. Read from app_settings fallback store
  try {
    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", AUDIT_SETTINGS_KEY)
      .maybeSingle();

    if (row?.value) {
      let logs: AuditLogEntry[] = JSON.parse(row.value);
      if (!Array.isArray(logs)) return [];

      if (options?.actor && options.actor !== "all") {
        const aLower = options.actor.toLowerCase();
        logs = logs.filter(
          (l) =>
            l.actor_name.toLowerCase().includes(aLower) ||
            l.actor_email.toLowerCase().includes(aLower)
        );
      }

      if (options?.action && options.action !== "all") {
        logs = logs.filter((l) => l.action === options.action);
      }

      if (options?.date && options.date !== "all") {
        logs = logs.filter((l) => l.ist_date === options.date);
      }

      if (options?.entityId) {
        logs = logs.filter((l) => l.entity_id === options.entityId);
      }

      if (options?.search) {
        const sLower = options.search.toLowerCase();
        logs = logs.filter(
          (l) =>
            l.summary.toLowerCase().includes(sLower) ||
            l.actor_name.toLowerCase().includes(sLower) ||
            l.entity_id.toLowerCase().includes(sLower)
        );
      }

      return logs.slice(0, limit);
    }
  } catch (err) {
    console.warn("[auditLog] Error retrieving audit logs:", err);
  }

  return [];
}
