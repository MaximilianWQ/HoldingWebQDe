/**
 * Linking from the bot by email (bot first): /api/bot/email/start sends
 * a 6-digit code to the address, /api/bot/email/confirm checks it and
 * runs the one link function. Without the right code the email is never
 * written anywhere (owner decision 5).
 *
 * Codes live in their own table (bot_email_codes), apart from the
 * site's sign-in codes: one active code per Telegram id, 10 minutes,
 * 5 attempts, only a salted SHA-256 stored (survives restarts, useless
 * if the table leaks after the 10 minutes).
 */

import crypto from "crypto";
import { pool, waitForDb } from "./db";
import { generateCode, sendTelegramLinkCodeEmail } from "./email";
import { isDisposableEmail } from "./disposable-emails";
import { checkRateLimit } from "./rate-limit";
import { getUserByTelegramId, isPlaceholderEmail } from "./store";
import { isValidTelegramId, linkTelegramAccount, LinkResult } from "./telegram-link";

export const LINK_CODE_TTL_MS = 10 * 60_000;
export const LINK_CODE_MAX_ATTEMPTS = 5;

/** Limits (in-memory, per process — same limiter as the site's sign-in). */
export const LINK_LIMITS = {
  /** All bot calls come from the bot's server: a coarse valve, not a per-person limit. */
  perIp: { max: 120, windowMs: 60_000 },
  perTelegram: { max: 3, windowMs: 10 * 60_000 },
  perTelegramDay: { max: 10, windowMs: 24 * 60 * 60_000 },
  perEmail: { max: 3, windowMs: 10 * 60_000 },
  perEmailDay: { max: 10, windowMs: 24 * 60 * 60_000 },
  confirmPerIp: { max: 300, windowMs: 10 * 60_000 },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LinkApiError = {
  ok: false;
  status: 400 | 404 | 409 | 429 | 502 | 503;
  code: string;
  error: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
};

const err = (status: LinkApiError["status"], code: string, error: string, extra: Partial<LinkApiError> = {}): LinkApiError => ({ ok: false, status, code, error, ...extra });

function hashCode(salt: string, code: string): string {
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function normalizeLinkEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e) || isPlaceholderEmail(e)) return null;
  return e;
}

function limited(key: string, l: { max: number; windowMs: number }): LinkApiError | null {
  const r = checkRateLimit(key, l.max, l.windowMs);
  return r.allowed ? null : err(429, "RATE_LIMITED", `Слишком много запросов. Повторите через ${r.retryAfterSeconds} сек.`, { retryAfterSeconds: r.retryAfterSeconds });
}

export type StartResult = { ok: true; sent: true; expiresInSeconds: number } | { ok: true; sent: false; alreadyLinked: true } | LinkApiError;

export async function startBotEmailLink(input: { telegramId: unknown; email: unknown; ip: string | null }): Promise<StartResult> {
  const telegramId = String(input.telegramId ?? "").trim();
  if (!isValidTelegramId(telegramId)) return err(400, "VALIDATION", "telegramId: только цифры");
  const email = normalizeLinkEmail(input.email);
  if (!email) return err(400, "VALIDATION", "Некорректный email");
  if (isDisposableEmail(email)) return err(400, "DISPOSABLE_EMAIL", "Одноразовые адреса не поддерживаются. Укажите постоянную почту.");

  const lim =
    limited(`bot-link-ip:${input.ip || "unknown"}`, LINK_LIMITS.perIp) ??
    limited(`bot-link-tg:${telegramId}`, LINK_LIMITS.perTelegram) ??
    limited(`bot-link-tg-day:${telegramId}`, LINK_LIMITS.perTelegramDay) ??
    limited(`bot-link-email:${email}`, LINK_LIMITS.perEmail) ??
    limited(`bot-link-email-day:${email}`, LINK_LIMITS.perEmailDay);
  if (lim) return lim;

  await waitForDb();
  // Only facts about THIS Telegram id are revealed (the bot's own user);
  // whether the email has an account stays hidden until the code is proven.
  const byTg = await getUserByTelegramId(telegramId);
  if (byTg && !isPlaceholderEmail(byTg.email)) {
    if (byTg.email === email) return { ok: true, sent: false, alreadyLinked: true };
    return err(409, "TELEGRAM_LINKED_OTHER", "Этот Telegram уже связан с другим аккаунтом сайта. Сначала отвяжите его, затем привяжите новую почту.");
  }

  const code = generateCode();
  const salt = crypto.randomBytes(16).toString("hex");
  await pool.query(
    `INSERT INTO bot_email_codes (telegram_id, email, code_salt, code_hash, attempts, created_at, expires_at, request_ip)
     VALUES ($1, $2, $3, $4, 0, NOW(), $5, $6)
     ON CONFLICT (telegram_id) DO UPDATE SET email = EXCLUDED.email, code_salt = EXCLUDED.code_salt, code_hash = EXCLUDED.code_hash,
       attempts = 0, created_at = NOW(), expires_at = EXCLUDED.expires_at, request_ip = EXCLUDED.request_ip`,
    [telegramId, email, salt, hashCode(salt, code), new Date(Date.now() + LINK_CODE_TTL_MS), input.ip]
  );
  const sent = await sendTelegramLinkCodeEmail(email, code);
  if (!sent) {
    await pool.query("DELETE FROM bot_email_codes WHERE telegram_id = $1 AND code_hash = $2", [telegramId, hashCode(salt, code)]);
    return err(502, "EMAIL_SEND_FAILED", "Не удалось отправить письмо. Попробуйте позже.");
  }
  return { ok: true, sent: true, expiresInSeconds: LINK_CODE_TTL_MS / 1000 };
}

interface CodeRow {
  telegram_id: string;
  email: string;
  code_salt: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
}

export type ConfirmResult = LinkResult | LinkApiError;

export async function confirmBotEmailLink(input: {
  telegramId: unknown;
  email: unknown;
  code: unknown;
  premiumPanelUserId?: unknown;
  ip: string | null;
}): Promise<ConfirmResult> {
  const telegramId = String(input.telegramId ?? "").trim();
  if (!isValidTelegramId(telegramId)) return err(400, "VALIDATION", "telegramId: только цифры");
  const email = normalizeLinkEmail(input.email);
  if (!email) return err(400, "VALIDATION", "Некорректный email");
  const code = typeof input.code === "string" || typeof input.code === "number" ? String(input.code).trim() : "";
  if (!/^\d{6}$/.test(code)) return err(400, "VALIDATION", "Код — 6 цифр");
  const hint = input.premiumPanelUserId == null || input.premiumPanelUserId === "" ? null : Number(input.premiumPanelUserId);
  if (hint !== null && (!Number.isSafeInteger(hint) || hint <= 0)) return err(400, "VALIDATION", "premiumPanelUserId: целое число");

  const lim = limited(`bot-link-confirm-ip:${input.ip || "unknown"}`, LINK_LIMITS.confirmPerIp);
  if (lim) return lim;

  await waitForDb();
  const row = (
    await pool.query<CodeRow>("SELECT telegram_id, email, code_salt, code_hash, attempts, expires_at FROM bot_email_codes WHERE telegram_id = $1", [telegramId])
  ).rows[0];
  if (!row || row.email !== email) return err(400, "CODE_NOT_FOUND", "Код не запрошен для этой почты. Запросите новый код.");
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await pool.query("DELETE FROM bot_email_codes WHERE telegram_id = $1 AND code_hash = $2", [telegramId, row.code_hash]);
    return err(400, "CODE_EXPIRED", "Код истёк. Запросите новый код.");
  }
  if (row.attempts >= LINK_CODE_MAX_ATTEMPTS) {
    await pool.query("DELETE FROM bot_email_codes WHERE telegram_id = $1 AND code_hash = $2", [telegramId, row.code_hash]);
    return err(400, "CODE_ATTEMPTS_EXCEEDED", "Превышено число попыток. Запросите новый код.");
  }
  const a = Buffer.from(hashCode(row.code_salt, code), "hex");
  const b = Buffer.from(row.code_hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const upd = await pool.query<{ attempts: number }>(
      "UPDATE bot_email_codes SET attempts = attempts + 1 WHERE telegram_id = $1 AND code_hash = $2 RETURNING attempts",
      [telegramId, row.code_hash]
    );
    const left = Math.max(0, LINK_CODE_MAX_ATTEMPTS - (upd.rows[0]?.attempts ?? LINK_CODE_MAX_ATTEMPTS));
    if (left === 0) await pool.query("DELETE FROM bot_email_codes WHERE telegram_id = $1 AND code_hash = $2", [telegramId, row.code_hash]);
    return err(400, "CODE_INVALID", left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Неверный код. Попытки закончились — запросите новый код.", { attemptsLeft: left });
  }

  // Proven. The code is consumed only by a successful link: a 503 (panel
  // down) or a 409 leaves it usable for its remaining minutes.
  const result = await linkTelegramAccount({ telegramId, email, via: "bot_email", premiumPanelUserId: hint, ip: input.ip });
  if (result.ok) await pool.query("DELETE FROM bot_email_codes WHERE telegram_id = $1 AND code_hash = $2", [telegramId, row.code_hash]);
  return result;
}
