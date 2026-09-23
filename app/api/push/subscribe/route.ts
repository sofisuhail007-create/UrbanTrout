import { NextRequest, NextResponse } from "next/server";
import { savePushSubscription, removePushSubscription } from "@/lib/pushNotifications";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 30 subscribe requests per minute per IP
  const { limited } = checkRateLimit(req, 30, 60 * 1000);
  if (limited) {
    return NextResponse.json({ success: false, error: "Too many requests." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { subscription, phone, email, userId } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { success: false, error: "Invalid push subscription object." },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") || null;

    const result = await savePushSubscription(subscription, {
      phone: phone || null,
      email: email || null,
      userId: userId || null,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Push notification subscription saved." });
  } catch (err: any) {
    console.error("[api/push/subscribe] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save subscription." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json({ success: false, error: "Missing endpoint." }, { status: 400 });
    }

    await removePushSubscription(endpoint);
    return NextResponse.json({ success: true, message: "Push notification subscription removed." });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to remove subscription." },
      { status: 500 }
    );
  }
}
