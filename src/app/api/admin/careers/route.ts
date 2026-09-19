import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../middleware";
import { pool } from "@/lib/db";

/**
 * Отклики на вакансии для админки (19.09.2026).
 *
 *   GET   /api/admin/careers?status=new|done|all&limit=
 *   PATCH /api/admin/careers  { id, status: "new" | "done" }
 *
 * Сам файл резюме здесь не отдаётся — за ним отдельный адрес
 * `/api/admin/careers/file`. Причина простая: список тянут при каждом
 * открытии раздела, и таскать вместе с ним мегабайты вложений незачем.
 *
 * Статуса два — «ждёт ответа» и «разобран», как у заявок с сайта.
 * Больше состояний завести легко, а вести их потом некому.
 */
const STATUSES = new Set(["new", "done"]);

export interface AdminApplicationItem {
  id: string;
  vacancyTitle: string;
  name: string;
  email: string;
  contact: string | null;
  message: string | null;
  resumeName: string;
  resumeSize: number;
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
      `SELECT id, vacancy_title, name, email, contact, message,
              resume_name, resume_size, status, created_at
         FROM job_applications ${where}
        ORDER BY created_at DESC
        LIMIT $1`,
      params
    );
    const data: AdminApplicationItem[] = r.rows.map((row) => ({
      id: row.id,
      vacancyTitle: row.vacancy_title,
      name: row.name,
      email: row.email,
      contact: row.contact,
      message: row.message,
      resumeName: row.resume_name,
      resumeSize: row.resume_size,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    }));
    const counts = await pool.query(`SELECT status, COUNT(*)::int AS n FROM job_applications GROUP BY status`);
    const byStatus: Record<string, number> = {};
    counts.rows.forEach((row) => { byStatus[row.status] = row.n; });
    return NextResponse.json({ success: true, data, counts: byStatus });
  } catch (err) {
    console.error("[ADMIN/CAREERS] error:", err);
    return NextResponse.json({ success: false, error: "Не удалось загрузить отклики" }, { status: 500 });
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
      `UPDATE job_applications SET status = $2 WHERE id = $1 RETURNING id`,
      [id, status]
    );
    if (!r.rows.length) {
      return NextResponse.json({ success: false, error: "Отклик не найден" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id, status } });
  } catch (err) {
    console.error("[ADMIN/CAREERS] patch error:", err);
    return NextResponse.json({ success: false, error: "Не удалось обновить отклик" }, { status: 500 });
  }
}
