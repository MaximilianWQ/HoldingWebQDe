import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../middleware";
import { pool } from "@/lib/db";

/**
 * Заявки с форм обратной связи (`/contact` и `/business`).
 *
 * До 19.09.2026 таблицу `contact_requests` создавал `db.ts` — и больше
 * её не читал никто: заявки копились в базе молча, достать их можно
 * было только запросом руками. Владелец: «админка как память».
 *
 *   GET  /api/admin/contact?status=new|done|all&limit=
 *   PATCH /api/admin/contact  { id, status: "new" | "done" }
 *
 * Статус — ровно два значения: заявка либо ждёт ответа, либо
 * обработана. Больше состояний завести легко, а вести их потом некому.
 */
const STATUSES = new Set(["new", "done"]);

export interface AdminContactItem {
  id: string;
  name: string;
  email: string;
  interest: string;
  message: string | null;
  status: string;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") ?? "all";
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 50, 1), 200);
  if (status !== "all" && !STATUSES.has(status)) {
    return NextResponse.json({ success: false, error: "Неизвестный статус" }, { status: 400 });
  }
  try {
    const where = status === "all" ? "" : "WHERE status = $2";
    const params: unknown[] = [limit];
    if (status !== "all") params.push(status);
    const r = await pool.query(
      `SELECT id, name, email, interest, message, status, created_at
         FROM contact_requests ${where}
        ORDER BY created_at DESC
        LIMIT $1`,
      params
    );
    const data: AdminContactItem[] = r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      interest: row.interest,
      message: row.message,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    }));
    const counts = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM contact_requests GROUP BY status`
    );
    const byStatus: Record<string, number> = {};
    counts.rows.forEach((row) => { byStatus[row.status] = row.n; });
    return NextResponse.json({ success: true, data, counts: byStatus });
  } catch (err) {
    console.error("[ADMIN/CONTACT] error:", err);
    return NextResponse.json({ success: false, error: "Не удалось загрузить заявки" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : null;
    const status = typeof body?.status === "string" ? body.status : null;
    if (!id || !status || !STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Нужны id и статус" }, { status: 400 });
    }
    const r = await pool.query(
      `UPDATE contact_requests SET status = $2 WHERE id = $1 RETURNING id`,
      [id, status]
    );
    if (!r.rows.length) {
      return NextResponse.json({ success: false, error: "Заявка не найдена" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id, status } });
  } catch (err) {
    console.error("[ADMIN/CONTACT] patch error:", err);
    return NextResponse.json({ success: false, error: "Не удалось обновить заявку" }, { status: 500 });
  }
}
