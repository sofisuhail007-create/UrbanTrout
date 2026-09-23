import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/adminAuth";
import {
  broadcastPushToAll,
  sendPushToCustomer,
  getActiveSubscriptions,
} from "@/lib/pushNotifications";

export const dynamic = "force-dynamic";

// ─── GET: View Subscriber Stats ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const subscriptions = await getActiveSubscriptions();
    return NextResponse.json({
      success: true,
      totalSubscribers: subscriptions.length,
      sampleSubscribers: subscriptions.slice(0, 10).map((s) => ({
        phone: s.customer_phone,
        email: s.customer_email,
        userAgent: s.user_agent,
        lastUsedAt: s.last_used_at || s.created_at,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch subscriber stats." },
      { status: 500 }
    );
  }
}

// ─── POST: Send Push Notification (Broadcast or Targeted) ─────────────
export async function POST(req: NextRequest) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { mode, title, body: msgBody, url, phone, email, userId } = body;

    if (!title || !msgBody) {
      return NextResponse.json(
        { success: false, error: "Title and message body are required." },
        { status: 400 }
      );
    }

    if (mode === "targeted") {
      if (!phone && !email && !userId) {
        return NextResponse.json(
          { success: false, error: "Recipient phone, email, or userId is required for targeted push." },
          { status: 400 }
        );
      }

      const result = await sendPushToCustomer({
        phone,
        email,
        userId,
        title,
        body: msgBody,
        url: url || "/account",
      });

      return NextResponse.json({
        success: true,
        sent: result.sent,
        total: result.total,
        message: `Push delivered to ${result.sent} of ${result.total} device(s).`,
      });
    }

    // Default: Broadcast to ALL active subscribers
    const broadcastResult = await broadcastPushToAll({
      title,
      body: msgBody,
      url: url || "/shop",
    });

    return NextResponse.json({
      success: true,
      sent: broadcastResult.sent,
      failed: broadcastResult.failed,
      total: broadcastResult.total,
      message: `Broadcast pushed to ${broadcastResult.sent} subscriber(s).`,
    });
  } catch (err: any) {
    console.error("[api/push/send] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to send push notification." },
      { status: 500 }
    );
  }
}
