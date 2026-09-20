import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { pool } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";
import { VISITOR_ROLES, VISITOR_DOCS } from "@/lib/contacts";
import { sendPushToAdmin } from "@/lib/push";

/**
 * Заявка на пропуск в бизнес-центр: `POST /api/office-pass`.
 *
 * Владелец, 20.09.2026: «для визита в офис необходимо оформить пропуск,
 * сделай форму — цель визита, кем является человек, имя и фамилия, и
 * чтобы приходило админу в дашборд».
 *
 * НОМЕРА ДОКУМЕНТА ЗДЕСЬ НЕТ, и это решение, а не упущение. Номер
 * паспорта или HKID — чувствительные данные: хранение пришлось бы
 * объявлять в Политике, защищать и удалять по сроку. Бизнес-центру
 * номер заранее не нужен: документ проверяют на стойке, а в заявке
 * важно, чтобы имя в пропуске совпало с именем в документе. Поэтому
 * просим имя латиницей и ТИП документа.
 *
 * Путь тот же, что у откликов и обращений: запись в базу, затем push
 * администратору. Письма админу нет (владелец, 20.09.2026) — заявка
 * видна в разделе «Обращения».
 */
const MAX_LEN = { fullName: 120, email: 254, contact: 120, company: 160, purpose: 1000, visitAt: 64 };

const ROLES = new Set(VISITOR_ROLES.map((r) => r.value as string));
const DOCS = new Set(VISITOR_DOCS.map((d) => d.value as string));

/** Имя для пропуска: латиница, пробелы, дефис и апостроф. */
const LATIN_NAME_RE = /^[A-Za-z][A-Za-z '\-.]{1,118}$/;

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIpKey(request.headers);
    const limit = checkRateLimit(`office-pass:${ip}`, 5, 60 * 60_000);
    if (!limit.allowed) {
      const minutes = Math.ceil(limit.retryAfterSeconds / 60);
      return bad(`Слишком много заявок. Повторите через ${minutes} мин.`, 429);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Не удалось прочитать форму.");

    const str = (k: string) => (typeof body[k] === "string" ? body[k].trim() : "");
    const fullName = str("fullName");
    const email = str("email").toLowerCase();
    const contact = str("contact");
    const company = str("company");
    const purpose = str("purpose");
    const visitAt = str("visitAt");
    const role = str("role");
    const docType = str("docType");
    const consent = str("consent");

    if (!LATIN_NAME_RE.test(fullName)) {
      return bad("Имя и фамилию впишите латиницей — как в документе.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Проверьте адрес почты.");
    if (!ROLES.has(role)) return bad("Выберите, кем вы приходите.");
    if (!DOCS.has(docType)) return bad("Выберите документ для входа.");
    if (!purpose) return bad("Напишите цель визита.");
    if (!visitAt) return bad("Укажите дату и время визита.");
    if (consent !== "yes") return bad("Нужно согласие на обработку данных.");
    if (
      fullName.length > MAX_LEN.fullName || email.length > MAX_LEN.email ||
      contact.length > MAX_LEN.contact || company.length > MAX_LEN.company ||
      purpose.length > MAX_LEN.purpose || visitAt.length > MAX_LEN.visitAt
    ) {
      return bad("Слишком длинное значение в одном из полей.");
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO office_pass_requests
         (id, full_name, email, contact, role, doc_type, company, purpose, visit_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, fullName, email, contact || null, role, docType, company || null, purpose, visitAt]
    );

    const roleLabel = VISITOR_ROLES.find((r) => r.value === role)?.label ?? role;

    // Письма админу здесь нет (владелец, 20.09.2026: «не надо отправлять
    // по почте админу, просто push в админ-дашборд»). Обращение живёт в
    // базе и видно в разделе «Обращения»; push зовёт туда. Квота Resend
    // при этом общая с кодами входа — служебные письма её съедали.

    try {
      await sendPushToAdmin(`Пропуск: ${fullName}`, `${roleLabel} · ${visitAt}`, "/admin?tab=inbox");
    } catch (err) {
      console.error("[OFFICE-PASS] admin push failed:", err);
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("[OFFICE-PASS] error:", error);
    return NextResponse.json({ success: false, error: "Не удалось отправить заявку" }, { status: 500 });
  }
}
