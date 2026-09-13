/**
 * Транспорт рассылок: Resend batch API (до 100 писем в запросе) с
 * ключом идемпотентности на пачку. Отправитель — как в email.ts.
 *
 * Без RESEND_API_KEY:
 *   production  — «fatal»: кампания встаёт на паузу с понятной ошибкой,
 *                 письма не теряются и не считаются отправленными;
 *   разработка  — письма пишутся в лог (и в CAMPAIGN_DEV_OUTBOX, если
 *                 задан путь к файлу — для сквозных проверок), наружу не
 *                 уходит ничего.
 */

import { appendFile } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { Resend } from "resend";
import type { Mailer, MailerFailure, OutgoingEmail } from "./campaigns";

/** Тот же отправитель, что у писем входа и оплаты (email.ts). */
export const CAMPAIGN_FROM = "Atlas Secure <noreply@qodev.dev>";

/** Ошибка Resend → что делать очереди. */
export function classifyResendError(e: { name?: string | null; statusCode?: number | null }): MailerFailure {
  switch (e.name) {
    case "rate_limit_exceeded":
    case "concurrent_idempotent_requests":
      return "rate_limit";
    case "daily_quota_exceeded":
    case "monthly_quota_exceeded":
      return "quota";
    case "validation_error":
    case "invalid_parameter":
    case "missing_required_field":
    case "invalid_idempotent_request":
    case "invalid_idempotency_key":
      return "invalid";
    case "missing_api_key":
    case "invalid_api_key":
    case "restricted_api_key":
    case "invalid_from_address":
    case "invalid_access":
    case "security_error":
    case "invalid_region":
      return "fatal";
    default:
      break;
  }
  const s = e.statusCode ?? 0;
  if (s === 429) return "rate_limit";
  if (s === 401 || s === 403) return "fatal";
  if (s === 400 || s === 409 || s === 422) return "invalid";
  return "transient";
}

function devMailer(): Mailer {
  return {
    async sendBatch(emails: OutgoingEmail[], idempotencyKey: string) {
      const ids = emails.map(() => `dev_${uuidv4()}`);
      for (const e of emails) console.log(`[DEV campaign email → ${e.to}] ${e.subject} (key ${idempotencyKey})`);
      const outbox = process.env.CAMPAIGN_DEV_OUTBOX;
      if (outbox) {
        const lines = emails.map((e, i) => JSON.stringify({ id: ids[i], key: idempotencyKey, at: new Date().toISOString(), ...e })).join("\n");
        await appendFile(outbox, `${lines}\n`).catch((err) => console.warn("[DEV campaign outbox] write failed:", err instanceof Error ? err.message : err));
      }
      return { ok: true as const, ids };
    },
  };
}

export function resendMailer(): Mailer {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      return { sendBatch: async () => ({ ok: false, kind: "fatal", message: "RESEND_API_KEY не задан — письма не отправляются" }) };
    }
    return devMailer();
  }
  const resend = new Resend(apiKey);
  return {
    async sendBatch(emails: OutgoingEmail[], idempotencyKey: string) {
      try {
        const payload = emails.map((e) => ({ from: CAMPAIGN_FROM, to: e.to, subject: e.subject, html: e.html, text: e.text, headers: e.headers }));
        const r = await resend.batch.send(payload, { idempotencyKey });
        if (r.error) {
          return { ok: false, kind: classifyResendError(r.error), message: `${r.error.name}: ${r.error.message}`.slice(0, 400) };
        }
        const got = r.data?.data ?? [];
        return { ok: true, ids: emails.map((_, i) => got[i]?.id ?? null) };
      } catch (err) {
        // Сеть, таймаут, неразобранный ответ — повторим с тем же ключом.
        return { ok: false, kind: "transient", message: (err instanceof Error ? err.message : String(err)).slice(0, 400) };
      }
    },
  };
}
