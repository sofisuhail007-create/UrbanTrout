import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface WhatsAppDispatchPayload {
  orderRef: string;
  phone: string;
  customerName?: string;
  status: string;
  messageText: string;
}

export async function enqueueWhatsAppDispatch(dispatch: WhatsAppDispatchPayload): Promise<boolean> {
  if (!dispatch.phone) return false;
  const cleanPhone = String(dispatch.phone).replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) return false;

  try {
    const { data: row } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "whatsapp_dispatch_queue")
      .maybeSingle();

    let queue: any[] = [];
    if (row?.value) {
      try {
        queue = JSON.parse(row.value);
      } catch (_) {}
    }

    const newEntry = {
      id: `disp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      orderRef: dispatch.orderRef,
      phone: cleanPhone,
      customerName: dispatch.customerName || "Valued Customer",
      status: dispatch.status,
      messageText: dispatch.messageText,
      dispatched: false,
      queuedAt: new Date().toISOString(),
    };

    queue.push(newEntry);
    if (queue.length > 50) queue = queue.slice(-50);

    const { error } = await supabase.from("app_settings").upsert({
      key: "whatsapp_dispatch_queue",
      value: JSON.stringify(queue),
      description: "Pending WhatsApp customer notifications from orders & Telegram status updates",
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

    if (error) {
      console.error("[WhatsApp Dispatch Queue] Upsert error:", error);
      return false;
    }

    console.log(`[WhatsApp Dispatch Queue] Enqueued ${dispatch.status} message for +91 ${cleanPhone}`);
    return true;
  } catch (err) {
    console.error("[WhatsApp Dispatch Queue] Error enqueuing message:", err);
    return false;
  }
}
