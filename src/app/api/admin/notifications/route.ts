import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { pool } from "@/lib/db";
import { verifyAdmin } from "../middleware";

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }

  // Личные уведомления рассылок (id «cmp:<кампания>:<человек>») — по одному
  // на получателя; их прогресс показывает карточка «Рассылки и начисления».
  const result = await pool.query(
    "SELECT * FROM notifications WHERE id NOT LIKE 'cmp:%' ORDER BY created_at DESC LIMIT 100"
  );

  const notifications = result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    target: row.target,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return NextResponse.json({ success: true, data: notifications });
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }

  const body = await request.json();
  const { title, message, target } = body;

  if (!title || !message) {
    return NextResponse.json({ success: false, error: "Заголовок и сообщение обязательны" }, { status: 400 });
  }

  const id = uuidv4();
  // target: 'all' for everyone, or specific user_id
  await pool.query(
    "INSERT INTO notifications (id, title, message, target) VALUES ($1, $2, $3, $4)",
    [id, title, message, target || "all"]
  );

  // Send push notifications
  try {
    const { sendPushToUser, sendPushToAll } = await import("@/lib/push");
    if (target && target !== "all") {
      await sendPushToUser(target, title, message);
    } else {
      await sendPushToAll(title, message);
    }
  } catch {
    // Push is optional
  }

  return NextResponse.json({ success: true, data: { id } });
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "ID обязателен" }, { status: 400 });
  }

  await pool.query("DELETE FROM notification_reads WHERE notification_id = $1", [id]);
  await pool.query("DELETE FROM notifications WHERE id = $1", [id]);

  return NextResponse.json({ success: true });
}
