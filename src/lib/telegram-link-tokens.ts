/**
 * One-time "link Telegram" tokens (site first).
 *
 * The dashboard asks POST /api/user/telegram-link → a 32-byte random
 * token (base64url, 43 chars) valid 15 minutes, stored as SHA-256 only
 * → https://t.me/<bot>?start=link_<token>. The bot confirms with the
 * person and calls /api/bot/link; the token is consumed only by a
 * successful link.
 *
 * The old permanent users.telegram_link_token (16 hex) is still
 * accepted for compatibility and rotated as soon as it is used.
 */

import crypto from "crypto";
import { pool, waitForDb } from "./db";
import { getUserByTelegramLinkToken } from "./store";
import { generateTelegramLinkToken } from "./tokens";

export const LINK_TOKEN_TTL_MS = 15 * 60_000;
export const ONE_TIME_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const LEGACY_TOKEN_RE = /^[0-9a-f]{16}$/;
const BOT_USERNAME_RE = /^[A-Za-z0-9_]{3,64}$/;

export function hashLinkToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Основной бот (владелец, 13.09.2026); env TELEGRAM_BOT_USERNAME переопределяет. */
export const DEFAULT_BOT_USERNAME = "atlassecure_bot";

/** `https://t.me/<bot>?start=<param>` — one place for every link into the bot. */
export function botStartUrl(startParam: string): string | null {
  const bot = (process.env.TELEGRAM_BOT_USERNAME || DEFAULT_BOT_USERNAME).trim().replace(/^@/, "");
  return BOT_USERNAME_RE.test(bot) ? `https://t.me/${bot}?start=${startParam}` : null;
}

export async function createTelegramLinkToken(userId: string): Promise<{ token: string; startParam: string; expiresAt: Date }> {
  await waitForDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);
  await pool.query("INSERT INTO telegram_link_tokens (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, NOW(), $3)", [
    hashLinkToken(token),
    userId,
    expiresAt,
  ]);
  return { token, startParam: `link_${token}`, expiresAt };
}

export type TokenLookup =
  | { kind: "one_time"; userId: string; hash: string; expiresAt: Date }
  | { kind: "legacy"; userId: string; token: string }
  | { kind: "used"; userId: string; usedByTelegramId: string | null }
  | { kind: "expired" }
  | { kind: "invalid" };

/** Accepts `link_<token>`, `<token>` or a legacy 16-hex token. */
export async function lookupLinkToken(raw: unknown): Promise<TokenLookup> {
  if (typeof raw !== "string") return { kind: "invalid" };
  const t = raw.trim().replace(/^link_/, "");
  await waitForDb();
  if (ONE_TIME_TOKEN_RE.test(t)) {
    const hash = hashLinkToken(t);
    const r = await pool.query<{ user_id: string; expires_at: Date; used_at: Date | null; used_by_telegram_id: string | null }>(
      "SELECT user_id, expires_at, used_at, used_by_telegram_id FROM telegram_link_tokens WHERE token_hash = $1",
      [hash]
    );
    const row = r.rows[0];
    if (!row) return { kind: "invalid" };
    if (row.used_at) return { kind: "used", userId: row.user_id, usedByTelegramId: row.used_by_telegram_id };
    if (new Date(row.expires_at).getTime() <= Date.now()) return { kind: "expired" };
    return { kind: "one_time", userId: row.user_id, hash, expiresAt: new Date(row.expires_at) };
  }
  if (LEGACY_TOKEN_RE.test(t)) {
    const user = await getUserByTelegramLinkToken(t);
    return user ? { kind: "legacy", userId: user.id, token: t } : { kind: "invalid" };
  }
  return { kind: "invalid" };
}

/** Consume after a successful link. False when someone consumed it first. */
export async function consumeLinkToken(hash: string, telegramId: string): Promise<boolean> {
  const r = await pool.query(
    "UPDATE telegram_link_tokens SET used_at = NOW(), used_by_telegram_id = $2 WHERE token_hash = $1 AND used_at IS NULL RETURNING user_id",
    [hash, telegramId]
  );
  return r.rows.length > 0;
}

/** A legacy permanent token is single-use from now on: replace it after it linked. */
export async function rotateLegacyLinkToken(userId: string, oldToken: string): Promise<void> {
  await pool.query("UPDATE users SET telegram_link_token = $2 WHERE id = $1 AND telegram_link_token = $3", [userId, generateTelegramLinkToken(), oldToken]);
}
