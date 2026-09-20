/**
 * Sign-in through the Telegram bot.
 *
 * The old flow let the bot UPSERT any nonce → user id, and anyone who
 * polled /api/auth/telegram-check with that nonce got the session. So an
 * attacker could pick a nonce, send the victim a t.me/…?start=tglogin_<nonce>
 * link, and after one tap in the bot poll the victim's session out.
 *
 * Now:
 *   1. The SITE creates the nonce (POST /api/auth/telegram-start) and
 *      binds it to the browser: a 256-bit secret goes to an httpOnly
 *      cookie, only its SHA-256 is stored (browser_hash).
 *   2. The bot (/api/bot/auth-login) can only CONFIRM an existing,
 *      pending, unexpired nonce — once; it cannot create or rebind one.
 *      It receives a 4-digit confirm code and the requesting browser's
 *      IP / user agent to show the person before confirming.
 *   3. /api/auth/telegram-check hands out the session only to the browser
 *      holding the secret, once (atomic used=false → true).
 *   TTL 5 minutes.
 */

import crypto from "crypto";
import { pool, waitForDb } from "./db";

export const TG_LOGIN_COOKIE = "tg_login";
export const TG_LOGIN_COOKIE_PATH = "/api/auth";
export const TG_LOGIN_TTL_MS = 5 * 60 * 1000;

const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{43}$/;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

export function isValidNonce(n: unknown): n is string {
  return typeof n === "string" && NONCE_RE.test(n);
}

export async function startTelegramLogin(
  meta: { ip?: string | null; userAgent?: string | null } = {},
  now: Date = new Date()
): Promise<{ nonce: string; secret: string; confirmCode: string; expiresAt: Date }> {
  await waitForDb();
  const nonce = crypto.randomBytes(16).toString("base64url");
  const secret = crypto.randomBytes(32).toString("base64url");
  const confirmCode = crypto.randomInt(1000, 10000).toString();
  const expiresAt = new Date(now.getTime() + TG_LOGIN_TTL_MS);
  await pool.query(
    `INSERT INTO telegram_auth_nonces (nonce, browser_hash, confirm_code, request_ip, request_ua, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [nonce, sha256(secret), confirmCode, clip(meta.ip, 64), clip(meta.userAgent, 400), now, expiresAt]
  );
  return { nonce, secret, confirmCode, expiresAt };
}

export interface TelegramLoginConfirmation {
  confirmCode: string | null;
  requestIp: string | null;
  requestUserAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

/** Bot side: bind a PENDING site-created nonce to the user. Null = unknown / expired / already bound. */
export async function confirmTelegramLogin(
  nonce: string,
  userId: string,
  telegramId: string,
  now: Date = new Date()
): Promise<TelegramLoginConfirmation | null> {
  if (!isValidNonce(nonce)) return null;
  await waitForDb();
  const r = await pool.query(
    `UPDATE telegram_auth_nonces SET user_id = $2, telegram_id = $3, confirmed_at = $4
     WHERE nonce = $1 AND user_id IS NULL AND used = FALSE AND browser_hash IS NOT NULL AND expires_at > $4
     RETURNING confirm_code, request_ip, request_ua, created_at, expires_at`,
    [nonce, userId, telegramId, now]
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    confirmCode: (row.confirm_code as string) ?? null,
    requestIp: (row.request_ip as string) ?? null,
    requestUserAgent: (row.request_ua as string) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    expiresAt: new Date(row.expires_at as string).toISOString(),
  };
}

/**
 * Посмотреть запрос на вход, НЕ подтверждая его (20.09.2026).
 *
 * Понадобилось после разбора команды бота. `confirmTelegramLogin`
 * подтверждает вход и только потом возвращает четыре цифры — значит
 * бот мог показать их человеку лишь ПОСЛЕ того, как вход уже разрешён.
 * Смысл этих цифр в том и был, чтобы человек сверил их ДО того, как
 * что-то подтвердит: иначе одно нажатие «Старт» по присланной ссылке
 * впускает чужого в аккаунт.
 *
 * Поэтому шага два: бот сначала смотрит (этот запрос), показывает код
 * и устройство, и только на кнопку «Подтвердить» вызывает
 * `confirmTelegramLogin`. Здесь не пишется ничего.
 */
export interface TelegramLoginPeek {
  confirmCode: string | null;
  requestIp: string | null;
  requestUserAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export async function peekTelegramLogin(nonce: string, now: Date = new Date()): Promise<TelegramLoginPeek | null> {
  if (!isValidNonce(nonce)) return null;
  await waitForDb();
  const r = await pool.query(
    `SELECT confirm_code, request_ip, request_ua, created_at, expires_at
       FROM telegram_auth_nonces
      WHERE nonce = $1 AND user_id IS NULL AND used = FALSE AND browser_hash IS NOT NULL AND expires_at > $2
      LIMIT 1`,
    [nonce, now]
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    confirmCode: (row.confirm_code as string) ?? null,
    requestIp: (row.request_ip as string) ?? null,
    requestUserAgent: (row.request_ua as string) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    expiresAt: new Date(row.expires_at as string).toISOString(),
  };
}

export type TelegramClaim =
  | { status: "ok"; userId: string }
  | { status: "pending" | "expired" | "used" | "invalid" };

/** Site side: the browser holding the secret takes the confirmed nonce — exactly once. */
export async function claimTelegramLogin(nonce: string, secret: string, now: Date = new Date()): Promise<TelegramClaim> {
  if (!isValidNonce(nonce) || typeof secret !== "string" || !SECRET_RE.test(secret)) return { status: "invalid" };
  await waitForDb();
  const r = await pool.query("SELECT browser_hash, user_id, used, expires_at FROM telegram_auth_nonces WHERE nonce = $1", [nonce]);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row || !row.browser_hash) return { status: "invalid" };

  const a = Buffer.from(String(row.browser_hash));
  const b = Buffer.from(sha256(secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { status: "invalid" };

  if (row.used) return { status: "used" };
  if (new Date(row.expires_at as string).getTime() <= now.getTime()) return { status: "expired" };
  if (!row.user_id) return { status: "pending" };

  const claimed = await pool.query(
    `UPDATE telegram_auth_nonces SET used = TRUE
     WHERE nonce = $1 AND used = FALSE AND user_id IS NOT NULL AND expires_at > $2 AND browser_hash = $3
     RETURNING user_id`,
    [nonce, now, row.browser_hash]
  );
  const uid = claimed.rows[0]?.user_id;
  return uid ? { status: "ok", userId: String(uid) } : { status: "used" };
}

export async function deleteOldTelegramNonces(): Promise<number> {
  const r = await pool.query("DELETE FROM telegram_auth_nonces WHERE expires_at < NOW() - INTERVAL '1 day'");
  return r.rowCount ?? 0;
}
