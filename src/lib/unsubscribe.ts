/**
 * Отписка от рекламных писем по ссылке из письма.
 *
 * Токен — 32 байта из crypto.randomBytes (base64url, 43 символа), по
 * одному на человека (users.unsubscribe_token), выдаётся лениво перед
 * первой отправкой. Хранится открыто, а не хэшем: одна и та же ссылка
 * должна стоять во всех будущих письмах, а по хэшу её не собрать. Всё,
 * что ссылка умеет, — выключить рекламную рассылку одному человеку, а у
 * того, кто прочёл таблицу users, и так есть куда больше.
 *
 *   /unsubscribe?t=…      страница с кнопкой (GET ничего не меняет:
 *                         почтовые сканеры открывают ссылки сами);
 *   POST /api/unsubscribe  подтверждение и one-click (RFC 8058,
 *                         заголовок List-Unsubscribe-Post).
 *
 * Отписка действует на kind = 'marketing'. Служебные письма (начисления,
 * изменения условий) приходят всем — это сказано в письме и на странице.
 */

import crypto from "crypto";
import { pool } from "./db";
import { setMarketingConsent, type ConsentQueryable } from "./consent";

export const UNSUBSCRIBE_TOKEN_BYTES = 32;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function generateUnsubscribeToken(): string {
  return crypto.randomBytes(UNSUBSCRIBE_TOKEN_BYTES).toString("base64url");
}

export function isUnsubscribeTokenShape(v: unknown): v is string {
  return typeof v === "string" && TOKEN_RE.test(v);
}

/** Публичный адрес сайта для ссылок в письмах (как в payments.ts). */
export function siteBaseUrl(): string {
  return (process.env.SITE_BASE_URL || "https://qodev.dev").trim().replace(/\/+$/, "");
}

export function unsubscribeLinks(token: string): { page: string; oneClick: string } {
  const t = encodeURIComponent(token);
  const base = siteBaseUrl();
  return { page: `${base}/unsubscribe?t=${t}`, oneClick: `${base}/api/unsubscribe?t=${t}` };
}

/** «gr***@gmail.com» — на странице отписки видно, какой адрес, но не целиком. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${shown}***${email.slice(at)}`;
}

type Q = ConsentQueryable["query"];

/**
 * Токены для этих пользователей: у кого нет — выдаём (CSPRNG в Node,
 * одним UPDATE; параллельный писатель не перетирается — IS NULL в WHERE).
 */
export async function ensureUnsubscribeTokens(query: Q, userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const cur = await query("SELECT id, unsubscribe_token FROM users WHERE id = ANY($1::text[])", [userIds]);
  const missing: string[] = [];
  for (const r of cur.rows) {
    if (typeof r.unsubscribe_token === "string" && r.unsubscribe_token) out.set(String(r.id), r.unsubscribe_token);
    else missing.push(String(r.id));
  }
  if (missing.length > 0) {
    const tokens = missing.map(() => generateUnsubscribeToken());
    await query(
      `UPDATE users AS u SET unsubscribe_token = v.tok
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS tok) AS v
       WHERE u.id = v.id AND u.unsubscribe_token IS NULL`,
      [missing, tokens]
    );
    const again = await query("SELECT id, unsubscribe_token FROM users WHERE id = ANY($1::text[])", [missing]);
    for (const r of again.rows) if (typeof r.unsubscribe_token === "string") out.set(String(r.id), r.unsubscribe_token);
  }
  return out;
}

export interface TokenOwner {
  id: string;
  email: string;
  optedOut: boolean;
}

export async function findByUnsubscribeToken(token: string, c: ConsentQueryable = pool): Promise<TokenOwner | null> {
  if (!isUnsubscribeTokenShape(token)) return null;
  const r = await c.query("SELECT id, email, marketing_opt_out_at FROM users WHERE unsubscribe_token = $1", [token]);
  const row = r.rows[0];
  return row ? { id: String(row.id), email: String(row.email), optedOut: row.marketing_opt_out_at != null } : null;
}

export async function unsubscribeByToken(
  token: string,
  c: ConsentQueryable = pool
): Promise<{ ok: true; userId: string; email: string; already: boolean } | { ok: false }> {
  const owner = await findByUnsubscribeToken(token, c);
  if (!owner) return { ok: false };
  const r = await setMarketingConsent(c, owner.id, false, "unsubscribe");
  return { ok: true, userId: owner.id, email: owner.email, already: !r.changed && owner.optedOut };
}
