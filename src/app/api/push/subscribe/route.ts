import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { savePushSubscription, trimPushSubscriptions } from "@/lib/push";

const MAX_FIELD = 2048;

export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
    }

    const { subscription } = await request.json();
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const authKey = subscription?.keys?.auth;
    if (
      typeof endpoint !== "string" || typeof p256dh !== "string" || typeof authKey !== "string" ||
      !endpoint.startsWith("https://") || endpoint.length > MAX_FIELD || p256dh.length > MAX_FIELD || authKey.length > MAX_FIELD
    ) {
      return NextResponse.json({ success: false, error: "Invalid subscription" }, { status: 400 });
    }

    await savePushSubscription(auth.user.id, { endpoint, keys: { p256dh, auth: authKey } });
    await trimPushSubscriptions(auth.user.id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Unsubscribe: only the signed-in owner can remove their own endpoint. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
    }
    const { endpoint } = await request.json();
    if (typeof endpoint === "string" && endpoint) {
      await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [endpoint, auth.user.id]);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
