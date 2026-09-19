import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { pool } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";
import { sendJobApplicationEmail } from "@/lib/email";
import { SUPPORT_DESK } from "@/lib/contacts";
import { VACANCIES, RESUME_EXTENSIONS, RESUME_MAX_BYTES, RESUME_MAX_MB } from "@/lib/careers";

/**
 * Отклик на вакансию: `POST /api/careers/apply`, multipart/form-data.
 *
 * Владелец, 19.09.2026: «форма обратной связи с загрузкой файлов
 * резюме, которая сразу же мне на почту автоматом этот отклик даст
 * именно мне, и также в админ-дашборд пусть приходит». Отсюда три
 * адресата у одного отклика, и порядок между ними важен:
 *
 *   1. запись в `job_applications` — она же архив и она же резервная
 *      копия резюме. Пишется первой: пока строки нет, терять нечего;
 *   2. письмо владельцу с резюме во вложении — сигнал «пришёл отклик»;
 *   3. уведомление в админке — память, к которой можно вернуться.
 *
 * Падение почты или уведомления НЕ роняет отклик: человек нажал
 * кнопку один раз, и его труд не должен пропасть из-за нашего
 * внутреннего канала. Ошибку видно в журнале.
 *
 * ФАЙЛ ЛЕЖИТ В БАЗЕ. Файловая система Railway живёт до следующей
 * выкладки. Резюме в `BYTEA` переживает её и не требует ни S3, ни
 * ключей к нему.
 *
 * ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ: распаковки и разбора содержимого файла.
 * Мы его не открываем — только кладём в базу и прикладываем к письму.
 * Всё, что мы о нём утверждаем, — размер, расширение и имя, и имя
 * чистится от путей и управляющих символов.
 */
const MAX_LEN = { name: 120, email: 254, contact: 120, message: 2000 };

/** Имя файла приходит от клиента: путь и управляющие символы убираем. */
function safeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "resume";
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\x00-\x1F<>:"|?*]/g, "").trim();
  return (clean || "resume").slice(0, 120);
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
  try {
    // Ограничений два, и это не перестраховка. Человек, опечатавшийся
    // в почте три раза подряд, не должен получить «приходите через
    // час»: считать неудачные попытки за отклики нельзя. Поэтому
    // здесь — широкий предел на ПОПЫТКИ (ими robot упрётся раньше,
    // чем доберётся до базы), а узкий, на принятые отклики, стоит
    // ниже, перед записью.
    const ip = clientIpKey(request.headers);
    const tries = checkRateLimit(`careers-try:${ip}`, 20, 60 * 60_000);
    if (!tries.allowed) {
      const minutes = Math.ceil(tries.retryAfterSeconds / 60);
      return bad(`Слишком много попыток. Повторите через ${minutes} мин.`, 429);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return bad("Не удалось прочитать форму. Попробуйте ещё раз.");
    }

    const str = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v.trim() : "";
    };

    const vacancyId = str("vacancyId");
    const name = str("name");
    const email = str("email").toLowerCase();
    const contact = str("contact");
    const message = str("message");
    const consent = str("consent");

    const vacancy = VACANCIES.find((v) => v.id === vacancyId);
    if (!vacancy) return bad("Вакансия не найдена. Обновите страницу.");
    if (!name) return bad("Укажите имя.");
    if (!email) return bad("Укажите почту.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Проверьте адрес почты.");
    if (consent !== "yes") return bad("Нужно согласие на обработку данных.");
    if (
      name.length > MAX_LEN.name || email.length > MAX_LEN.email ||
      contact.length > MAX_LEN.contact || message.length > MAX_LEN.message
    ) {
      return bad("Слишком длинное значение в одном из полей.");
    }

    const file = form.get("resume");
    if (!(file instanceof File) || file.size === 0) return bad("Приложите резюме файлом.");
    if (file.size > RESUME_MAX_BYTES) return bad(`Файл больше ${RESUME_MAX_MB} МБ.`);

    const filename = safeFilename(file.name);
    const ext = extensionOf(filename);
    if (!(RESUME_EXTENSIONS as readonly string[]).includes(ext)) {
      return bad("Такой формат файла мы не принимаем.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    // Размер сверяется ещё раз по факту: `file.size` приходит от
    // клиента и может расходиться с тем, что реально доехало.
    if (bytes.length === 0) return bad("Файл пустой.");
    if (bytes.length > RESUME_MAX_BYTES) return bad(`Файл больше ${RESUME_MAX_MB} МБ.`);

    const accepted = checkRateLimit(`careers:${ip}`, 3, 60 * 60_000);
    if (!accepted.allowed) {
      const minutes = Math.ceil(accepted.retryAfterSeconds / 60);
      return bad(`Вы уже отправили несколько откликов. Следующий — через ${minutes} мин.`, 429);
    }

    const id = uuidv4();
    await pool.query(
      `INSERT INTO job_applications
         (id, vacancy_id, vacancy_title, name, email, contact, message,
          resume_name, resume_type, resume_size, resume_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id, vacancy.id, vacancy.title, name, email,
        contact || null, message || null,
        filename, file.type || "application/octet-stream", bytes.length, bytes,
      ]
    );

    const adminEmail = process.env.ADMIN_EMAIL || SUPPORT_DESK.email;
    try {
      await sendJobApplicationEmail({
        to: adminEmail,
        id,
        vacancyTitle: vacancy.title,
        name,
        email,
        contact: contact || null,
        message: message || null,
        resume: { filename, content: bytes },
        resumeNote: null,
      });
    } catch (err) {
      console.error("[CAREERS] notification email failed:", err);
    }

    // Уведомление в админке: письмо можно пропустить, список — нет.
    try {
      const admin = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [process.env.ADMIN_EMAIL || ""]);
      const adminUserId = admin.rows[0]?.id;
      if (adminUserId) {
        await pool.query(
          `INSERT INTO notifications (id, title, message, target) VALUES ($1, $2, $3, $4)`,
          [
            uuidv4(),
            `Отклик на вакансию: ${vacancy.title}`,
            [`Имя: ${name}`, `Почта: ${email}`, contact ? `Связь: ${contact}` : null, `Резюме: ${filename}`]
              .filter(Boolean)
              .join("\n"),
            adminUserId,
          ]
        );
      }
    } catch (err) {
      console.error("[CAREERS] admin notification failed:", err);
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("[CAREERS] application error:", error);
    return NextResponse.json({ success: false, error: "Не удалось отправить отклик" }, { status: 500 });
  }
}
