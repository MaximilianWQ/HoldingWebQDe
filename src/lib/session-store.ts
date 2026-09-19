/**
 * Server-side sessions — the database half (no cookies, no Next APIs).
 *
 * The cookie carries a random 256-bit token; the table keeps only its
 * SHA-256. A leaked database row therefore cannot be replayed as a
 * cookie, and knowing a user id (visible in the admin, logs, bot
 * responses) no longer gives a session — that was the old scheme.
 *
 * Lifetime: sliding SESSION_TTL_MS from the last activity, never longer
 * than SESSION_ABSOLUTE_MS from sign-in. Activity is written at most
 * once per SESSION_TOUCH_MS, so a busy dashboard does not turn every
 * request into a write.
 *
 * Kept free of imports from store.ts so that store.ts can revoke
 * sessions (password reset) without an import cycle.
 */

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { pool, waitForDb } from "./db";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION_TTL_MS = 30 * DAY_MS;
export const SESSION_ABSOLUTE_MS = 90 * DAY_MS;
export const SESSION_TOUCH_MS = 60 * 60 * 1000;

/** base64url of 32 random bytes = 43 characters. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Чем человек доказал, что аккаунт его (аудит безопасности
 * 19.09.2026). Раньше сессия этого не помнила, и «свежая сессия»
 * считалась доказательством владения почтой, кем бы она ни была
 * открыта — в том числе входом через Telegram или ключом passkey.
 * Смена пароля без знания старого опиралась именно на это.
 */
export type AuthMethod = "email_code" | "password" | "passkey" | "telegram";

export interface SessionRow {
  id: string;
  userId: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  authMethod: AuthMethod | null;
}

/** Pure: the new expiry for a session touched at `now`. */
export function slidingExpiry(createdAt: Date, now: Date = new Date()): Date {
  return new Date(Math.min(now.getTime() + SESSION_TTL_MS, createdAt.getTime() + SESSION_ABSOLUTE_MS));
}

const clip = (s: string | null | undefined, n: number) => (s ? s.slice(0, n) : null);

export async function createSession(
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null; authMethod?: AuthMethod } = {},
  now: Date = new Date()
): Promise<{ token: string; session: SessionRow }> {
  await waitForDb();
  const token = generateToken();
  const id = uuidv4();
  const expiresAt = slidingExpiry(now, now);
  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, ip, user_agent, auth_method)
     VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8)`,
    [id, userId, hashToken(token), now, expiresAt, clip(meta.ip, 64), clip(meta.userAgent, 400), meta.authMethod ?? null]
  );
  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [userId]).catch(() => undefined);
  // Opportunistic cleanup of long-dead rows (cheap: indexed on expires_at).
  if (Math.random() < 0.02) void deleteExpiredSessions().catch(() => undefined);
  return { token, session: { id, userId, createdAt: now, lastSeenAt: now, expiresAt, authMethod: meta.authMethod ?? null } };
}

/**
 * Live session for a token plus the user row (`u.*`), or null. Touches
 * the session (sliding expiry) when the last write is older than
 * SESSION_TOUCH_MS; `touched` tells the caller to re-issue the cookie.
 */
export async function findSessionWithUser(
  token: string,
  now: Date = new Date()
): Promise<{ session: SessionRow; touched: boolean; userRow: Record<string, unknown> } | null> {
  if (!isWellFormedToken(token)) return null;
  await waitForDb();
  const r = await pool.query(
    `SELECT s.id AS s_id, s.created_at AS s_created_at, s.last_seen_at AS s_last_seen_at, s.expires_at AS s_expires_at, s.auth_method AS s_auth_method, u.*
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2`,
    [hashToken(token), now]
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const session: SessionRow = {
    id: String(row.s_id),
    userId: String(row.id),
    createdAt: new Date(row.s_created_at as string),
    lastSeenAt: new Date(row.s_last_seen_at as string),
    expiresAt: new Date(row.s_expires_at as string),
    authMethod: (row.s_auth_method as AuthMethod | null) ?? null,
  };

  let touched = false;
  if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_MS) {
    const expiresAt = slidingExpiry(session.createdAt, now);
    await pool
      .query("UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE id = $1 AND revoked_at IS NULL", [session.id, now, expiresAt])
      .then(() => {
        session.lastSeenAt = now;
        session.expiresAt = expiresAt;
        touched = true;
      })
      .catch((err) => console.warn("[SESSION] touch failed:", err instanceof Error ? err.message : err));
  }
  return { session, touched, userRow: row };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  if (!isWellFormedToken(token)) return;
  await pool.query("UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL", [hashToken(token)]);
}

/** Revoke every live session of a user, optionally keeping one (the caller's). Returns the count. */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<number> {
  await waitForDb();
  const r = exceptSessionId
    ? await pool.query("UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL AND id <> $2", [userId, exceptSessionId])
    : await pool.query("UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  return r.rowCount ?? 0;
}

/** Rows expired or revoked more than a week ago are of no use even for the audit. */
export async function deleteExpiredSessions(): Promise<number> {
  const r = await pool.query(
    "DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days' OR revoked_at < NOW() - INTERVAL '7 days'"
  );
  return r.rowCount ?? 0;
}
