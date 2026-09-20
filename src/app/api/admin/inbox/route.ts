import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../middleware";
import { pool } from "@/lib/db";
import { attachmentsFor, type AttachmentMeta } from "@/lib/attachments";
import { VISITOR_ROLES, VISITOR_DOCS } from "@/lib/contacts";

/**
 * Обращения с сайта — одна лента на все формы (владелец, 19.09.2026:
 * «специальная вкладка: отклики на вакансию и любые формы обратной
 * связи, которые мы делаем в коде или уже сделали»).
 *
 *   GET   /api/admin/inbox?kind=all|career|contact&status=all|new|done&limit=
 *   PATCH /api/admin/inbox  { id, kind, status }
 *
 * ПОЧЕМУ ОДИН МАРШРУТ, А НЕ ДВА. Формы живут в разных таблицах, но
 * для того, кто их разбирает, это один список дел, отсортированный по
 * времени. Два списка рядом означали бы два места, где можно
 * пропустить обращение.
 *
 * ПОЧЕМУ ЗАПРОСА ДВА, А ОБЪЕДИНЕНИЕ В КОДЕ. UNION по разным таблицам
 * пришлось бы выравнивать по колонкам, и каждая новая форма ломала бы
 * общий запрос. Записей тут десятки, а не миллионы: два запроса с
 * LIMIT и слияние по дате дешевле любой хитрости.
 *
 * НОВАЯ ФОРМА ДОБАВЛЯЕТСЯ ТАК: свой `load…` ниже и ветка в PATCH.
 * Больше ничего — ни в админке, ни в выдаче файлов.
 */
const KINDS = new Set(["career", "contact", "pass"]);
const STATUSES = new Set(["new", "done"]);

export type InboxKind = "career" | "contact" | "pass";

export interface InboxItem {
  id: string;
  kind: InboxKind;
  /** Чем обращение является: «Отклик · Сетевой инженер», «Заявка · бизнес». */
  topic: string;
  name: string;
  email: string;
  /** Телефон или Telegram, если человек его оставил. */
  contact: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  attachments: AttachmentMeta[];
}

async function loadCareer(limit: number, status: string): Promise<InboxItem[]> {
  const where = status === "all" ? "" : "WHERE status = $2";
  const params: unknown[] = [limit];
  if (status !== "all") params.push(status);
  const r = await pool.query(
    `SELECT id, vacancy_title, name, email, contact, message, status, created_at
       FROM job_applications ${where}
      ORDER BY created_at DESC
      LIMIT $1`,
    params
  );
  const files = await attachmentsFor("career", r.rows.map((x) => x.id));
  return r.rows.map((row) => ({
    id: row.id,
    kind: "career" as const,
    topic: `Отклик · ${row.vacancy_title}`,
    name: row.name,
    email: row.email,
    contact: row.contact,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    attachments: files.get(row.id) ?? [],
  }));
}

async function loadContact(limit: number, status: string): Promise<InboxItem[]> {
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
  const files = await attachmentsFor("contact", r.rows.map((x) => x.id));
  return r.rows.map((row) => ({
    id: row.id,
    kind: "contact" as const,
    topic: `Заявка · ${row.interest}`,
    name: row.name,
    email: row.email,
    contact: null,
    message: row.message,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    attachments: files.get(row.id) ?? [],
  }));
}

/**
 * Заявки на пропуск в бизнес-центр (20.09.2026). Вложений у них нет:
 * номера документа мы не собираем, а копий и подавно.
 */
async function loadPass(limit: number, status: string): Promise<InboxItem[]> {
  const where = status === "all" ? "" : "WHERE status = $2";
  const params: unknown[] = [limit];
  if (status !== "all") params.push(status);
  const r = await pool.query(
    `SELECT id, full_name, email, contact, role, doc_type, company, purpose, visit_at, status, created_at
       FROM office_pass_requests ${where}
      ORDER BY created_at DESC
      LIMIT $1`,
    params
  );
  return r.rows.map((row) => ({
    id: row.id,
    kind: "pass" as const,
    topic: `Пропуск · ${VISITOR_ROLES.find((x) => x.value === row.role)?.label ?? row.role}`,
    name: row.full_name,
    email: row.email,
    contact: row.contact,
    // Всё, что нужно охране и хозяину кабинета, — одной строкой.
    message: [
      `Когда: ${row.visit_at}`,
      `Документ: ${VISITOR_DOCS.find((x) => x.value === row.doc_type)?.label ?? row.doc_type}`,
      row.company ? `Компания: ${row.company}` : null,
      `Цель: ${row.purpose}`,
    ]
      .filter(Boolean)
      .join("\n"),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    attachments: [],
  }));
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }
  const sp = request.nextUrl.searchParams;
  const kind = sp.get("kind") ?? "all";
  const status = sp.get("status") ?? "new";
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 100, 1), 300);
  if (kind !== "all" && !KINDS.has(kind)) {
    return NextResponse.json({ success: false, error: "Неизвестный тип" }, { status: 400 });
  }
  if (status !== "all" && !STATUSES.has(status)) {
    return NextResponse.json({ success: false, error: "Неизвестный статус" }, { status: 400 });
  }

  try {
    const parts: InboxItem[][] = [];
    if (kind === "all" || kind === "career") parts.push(await loadCareer(limit, status));
    if (kind === "all" || kind === "contact") parts.push(await loadContact(limit, status));
    if (kind === "all" || kind === "pass") parts.push(await loadPass(limit, status));
    const data = parts
      .flat()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    // Счётчики считаются по всем записям, а не по выборке: цифра
    // «ждут ответа» должна быть верной и при открытом фильтре.
    const counts = { career: 0, contact: 0, pass: 0, total: 0 };
    const c1 = await pool.query(`SELECT COUNT(*)::int AS n FROM job_applications WHERE status = 'new'`);
    const c2 = await pool.query(`SELECT COUNT(*)::int AS n FROM contact_requests WHERE status = 'new'`);
    counts.career = c1.rows[0]?.n ?? 0;
    counts.contact = c2.rows[0]?.n ?? 0;
    const c3 = await pool.query(`SELECT COUNT(*)::int AS n FROM office_pass_requests WHERE status = 'new'`);
    counts.pass = c3.rows[0]?.n ?? 0;
    counts.total = counts.career + counts.contact + counts.pass;

    return NextResponse.json({ success: true, data, counts });
  } catch (err) {
    console.error("[ADMIN/INBOX] error:", err);
    return NextResponse.json({ success: false, error: "Не удалось загрузить обращения" }, { status: 500 });
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
    const kind = typeof body?.kind === "string" ? body.kind : null;
    const status = typeof body?.status === "string" ? body.status : null;
    if (!id || !kind || !KINDS.has(kind) || !status || !STATUSES.has(status)) {
      return NextResponse.json({ success: false, error: "Нужны id, тип и статус" }, { status: 400 });
    }
    const table =
      kind === "career" ? "job_applications" : kind === "pass" ? "office_pass_requests" : "contact_requests";
    const r = await pool.query(`UPDATE ${table} SET status = $2 WHERE id = $1 RETURNING id`, [id, status]);
    if (!r.rows.length) {
      return NextResponse.json({ success: false, error: "Обращение не найдено" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { id, kind, status } });
  } catch (err) {
    console.error("[ADMIN/INBOX] patch error:", err);
    return NextResponse.json({ success: false, error: "Не удалось обновить обращение" }, { status: 500 });
  }
}
