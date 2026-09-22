/**
 * Admin data access: user list (search, filters, sort, pagination,
 * counts), admin journal (filters, keyset pagination) and per-user
 * history (payments + ledger).
 */

import { pool } from "./db";
import { AuditLevel, isAuditLevel } from "./audit-level";

// ─── Users list ─────────────────────────────────────────────────

export const USER_FILTERS = ["all", "active", "paid", "trial", "expiring", "expired", "shared_ip", "no_link", "sync_error"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

/** The current UI's filter names map onto the API ones. */
export const USER_FILTER_ALIASES: Record<string, UserFilter> = { soon: "expiring", shared: "shared_ip", nokey: "no_link" };

export const USER_SORTS = {
  new: "b.created_at DESC, b.id DESC",
  old: "b.created_at ASC, b.id ASC",
  soon: "b.subscription_end ASC, b.id ASC",
  long: "b.subscription_end DESC, b.id DESC",
  email: "b.email ASC, b.id ASC",
  last_payment: "b.last_payment_at DESC NULLS LAST, b.id DESC",
} as const;
export type UserSort = keyof typeof USER_SORTS;

const FILTER_SQL: Record<UserFilter, string> = {
  all: "TRUE",
  active: "b.subscription_end > NOW()",
  paid: "b.subscription_end > NOW() AND b.subscription_plan IN ('basic', 'plus')",
  trial: "b.subscription_end > NOW() AND b.subscription_plan = 'trial'",
  expiring: "b.subscription_end > NOW() AND b.subscription_end <= NOW() + INTERVAL '3 days'",
  expired: "b.subscription_end <= NOW()",
  shared_ip: "b.registration_ip IS NOT NULL AND b.accounts_on_ip > 1",
  no_link: "b.subscription_end > NOW() AND b.subscription_url IS NULL",
  sync_error: "b.panel_sync_state = 'error'",
};

export const USERS_DEFAULT_LIMIT = 100;
export const USERS_MAX_LIMIT = 500;

export interface UsersParams {
  q: string | null;
  filter: UserFilter;
  sort: UserSort;
  /** null = no pagination (legacy "everything" response). */
  limit: number | null;
  offset: number;
  paginated: boolean;
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

export function decodeCursor(cursor: string): number | null {
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return Number.isInteger(v?.o) && v.o >= 0 ? v.o : null;
  } catch {
    return null;
  }
}

export function parseUsersParams(sp: URLSearchParams): { ok: true; params: UsersParams } | { ok: false; error: string } {
  const has = ["q", "filter", "sort", "limit", "cursor"].some((k) => sp.has(k));
  const q = (sp.get("q") || "").trim().slice(0, 200) || null;

  const rawFilter = (sp.get("filter") || "all").trim();
  const filter = (USER_FILTER_ALIASES[rawFilter] ?? rawFilter) as UserFilter;
  if (!(USER_FILTERS as readonly string[]).includes(filter)) return { ok: false, error: `Неизвестный фильтр «${rawFilter}»` };

  const sort = (sp.get("sort") || "new").trim() as UserSort;
  if (!(sort in USER_SORTS)) return { ok: false, error: `Неизвестная сортировка «${sort}»` };

  let limit: number | null = null;
  if (has) {
    const raw = sp.get("limit");
    limit = raw === null ? USERS_DEFAULT_LIMIT : Number(raw);
    if (!Number.isInteger(limit) || limit < 1) return { ok: false, error: "limit должен быть целым числом ≥ 1" };
    limit = Math.min(limit, USERS_MAX_LIMIT);
  }

  let offset = 0;
  const cursor = sp.get("cursor");
  if (cursor) {
    const o = decodeCursor(cursor);
    if (o === null) return { ok: false, error: "Неверный курсор" };
    offset = o;
  }
  return { ok: true, params: { q, filter, sort, limit, offset, paginated: has } };
}

const BASE_CTE = `
  WITH b AS (
    SELECT u.id, u.email, u.created_at, u.subscription_end, u.subscription_plan, u.telegram_linked,
           u.referrals, u.paid_referrals, u.registration_ip, u.panel_id, u.public_id, u.panel_username,
           u.remnawave_user_uuid, u.panel_user_id, u.subscription_url, u.panel_sync_state, u.panel_sync_error,
           u.telegram_id, u.link_kept, u.link_disabled_panel_user_id, u.bypass_panel_user_id,
           COUNT(*) OVER (PARTITION BY COALESCE(u.registration_ip, 'unknown'))::int AS accounts_on_ip,
           (SELECT MAX(p.paid_at) FROM payments p WHERE p.user_id = u.id AND p.status IN ('confirmed', 'refunded')) AS last_payment_at
    FROM users u
  )`;

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Pure: SQL for one page, the counts per filter and the unfiltered stats. */
export function buildUsersQuery(p: UsersParams): {
  list: { sql: string; values: unknown[] };
  counts: { sql: string; values: unknown[] };
} {
  const values: unknown[] = [];
  let where = "TRUE";
  if (p.q) {
    values.push(`%${escapeLike(p.q)}%`, p.q);
    where = `(b.email ILIKE $1 OR b.public_id ILIKE $1 OR b.registration_ip ILIKE $1 OR b.panel_username ILIKE $1 OR b.id = $2 OR b.panel_user_id::text = $2)`;
  }
  const countValues = [...values];
  const countCols = USER_FILTERS.map((f) => `COUNT(*) FILTER (WHERE ${FILTER_SQL[f]})::int AS ${f}`).join(", ");

  let listSql = `${BASE_CTE} SELECT * FROM b WHERE ${where} AND ${FILTER_SQL[p.filter]} ORDER BY ${USER_SORTS[p.sort]}`;
  if (p.limit !== null) {
    values.push(p.limit + 1, p.offset);
    listSql += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;
  }
  return {
    list: { sql: listSql, values },
    counts: { sql: `${BASE_CTE} SELECT ${countCols}, COUNT(*) FILTER (WHERE b.telegram_linked)::int AS telegram_linked FROM b WHERE ${where}`, values: countValues },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToAdminUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    createdAt: new Date(row.created_at).toISOString(),
    subscriptionEnd: new Date(row.subscription_end).toISOString(),
    subscriptionPlan: row.subscription_plan || "trial",
    telegramLinked: !!row.telegram_linked,
    telegramId: row.telegram_id ?? null,
    linkKept: row.link_kept ?? null,
    linkDisabledPanelUserId: row.link_disabled_panel_user_id != null ? Number(row.link_disabled_panel_user_id) : null,
    bypassPanelUserId: row.bypass_panel_user_id != null ? Number(row.bypass_panel_user_id) : null,
    referrals: row.referrals ?? 0,
    paidReferrals: row.paid_referrals ?? 0,
    isActive: new Date(row.subscription_end) > new Date(),
    registrationIp: row.registration_ip || null,
    accountsOnIp: Number(row.accounts_on_ip) || 1,
    publicId: row.public_id || null,
    panelId: row.panel_id || null,
    panelUsername: row.panel_username || null,
    remnawaveUserUuid: row.remnawave_user_uuid || null,
    panelUserId: row.panel_user_id != null ? Number(row.panel_user_id) : null,
    subscriptionUrl: row.subscription_url || null,
    happCryptoLink: null,
    panelSyncState: row.panel_sync_state ?? null,
    panelSyncError: row.panel_sync_error ?? null,
    lastPaymentAt: row.last_payment_at ? new Date(row.last_payment_at).toISOString() : null,
  };
}

export type AdminUser = ReturnType<typeof rowToAdminUser>;
export type UserCounts = Record<UserFilter, number>;

export interface UsersListResult {
  users: AdminUser[];
  stats: { total: number; active: number; expired: number; telegramLinked: number };
  counts: UserCounts;
  /** Only in paginated mode. */
  total?: number;
  nextCursor?: string | null;
}

export async function listUsers(p: UsersParams): Promise<UsersListResult> {
  const qy = buildUsersQuery(p);
  const [listRes, countRes] = await Promise.all([pool.query(qy.list.sql, qy.list.values), pool.query(qy.counts.sql, qy.counts.values)]);
  const c = countRes.rows[0] ?? {};
  const counts = Object.fromEntries(USER_FILTERS.map((f) => [f, Number(c[f]) || 0])) as UserCounts;

  // Stats stay "all users" (legacy meaning) even when a search is active.
  let statsRow = c;
  if (p.q) {
    const all = buildUsersQuery({ ...p, q: null, limit: null });
    statsRow = (await pool.query(all.counts.sql, all.counts.values)).rows[0] ?? {};
  }
  const stats = {
    total: Number(statsRow.all) || 0,
    active: Number(statsRow.active) || 0,
    expired: Number(statsRow.expired) || 0,
    telegramLinked: Number(statsRow.telegram_linked) || 0,
  };

  let rows = listRes.rows;
  const out: UsersListResult = { users: [], stats, counts };
  if (p.limit !== null) {
    const hasMore = rows.length > p.limit;
    rows = rows.slice(0, p.limit);
    out.total = counts[p.filter];
    out.nextCursor = hasMore ? encodeCursor(p.offset + p.limit) : null;
  }
  out.users = rows.map(rowToAdminUser);
  return out;
}

// ─── Admin journal ──────────────────────────────────────────────

export const LOGS_DEFAULT_LIMIT = 200;
export const LOGS_MAX_LIMIT = 500;

export interface LogsParams {
  userId: string | null;
  level: AuditLevel | null;
  /**
   * Точное имя действия (`telegram.unlink`, `admin.grant`, …). Поиск в
   * карточке журнала идёт по уже загруженным строкам, поэтому найти
   * редкое событие в старой истории через него нельзя — для этого и
   * нужен фильтр на стороне базы.
   */
  action: string | null;
  limit: number;
  cursor: { createdAt: string; id: string } | null;
}

/** Имена действий пишутся кодом: латиница, точка, подчёркивание. */
const ACTION_RE = /^[a-z0-9_.]{1,64}$/;

export function encodeLogCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt, i: id })).toString("base64url");
}

export function parseLogsParams(sp: URLSearchParams): { ok: true; params: LogsParams } | { ok: false; error: string } {
  const userId = (sp.get("userId") || "").trim() || null;
  const rawLevel = (sp.get("level") || "").trim() || null;
  if (rawLevel && !isAuditLevel(rawLevel)) return { ok: false, error: "level: info, warn или error" };
  const action = (sp.get("action") || "").trim() || null;
  if (action && !ACTION_RE.test(action)) return { ok: false, error: "action: латиница, цифры, точка и подчёркивание, до 64 знаков" };
  const rawLimit = sp.get("limit");
  const limit = rawLimit === null ? LOGS_DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1) return { ok: false, error: "limit должен быть целым числом ≥ 1" };
  let cursor: LogsParams["cursor"] = null;
  const rawCursor = sp.get("cursor");
  if (rawCursor) {
    try {
      const v = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      if (typeof v?.t !== "string" || typeof v?.i !== "string" || !Number.isFinite(Date.parse(v.t))) throw new Error("bad");
      cursor = { createdAt: v.t, id: v.i };
    } catch {
      return { ok: false, error: "Неверный курсор" };
    }
  }
  return { ok: true, params: { userId, level: rawLevel as AuditLevel | null, action, limit: Math.min(limit, LOGS_MAX_LIMIT), cursor } };
}

export interface AdminLogItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  level: AuditLevel;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

export async function listLogs(p: LogsParams): Promise<{ logs: AdminLogItem[]; nextCursor: string | null }> {
  const r = await pool.query(
    `SELECT id, user_id, user_email, action, level, details, ip, created_at FROM audit_logs
     WHERE ($1::text IS NULL OR user_id = $1)
       AND ($2::text IS NULL OR level = $2)
       AND ($3::timestamptz IS NULL OR created_at < $3 OR (created_at = $3 AND id < $4))
       AND ($6::text IS NULL OR action = $6)
     ORDER BY created_at DESC, id DESC
     LIMIT $5`,
    [p.userId, p.level, p.cursor?.createdAt ?? null, p.cursor?.id ?? "", p.limit + 1, p.action]
  );
  const hasMore = r.rows.length > p.limit;
  const rows = r.rows.slice(0, p.limit);
  const logs: AdminLogItem[] = rows.map((x) => ({
    id: x.id,
    userId: x.user_id,
    userEmail: x.user_email,
    action: x.action,
    level: isAuditLevel(x.level) ? x.level : "info",
    details: x.details,
    ip: x.ip,
    createdAt: new Date(x.created_at).toISOString(),
  }));
  const last = logs[logs.length - 1];
  return { logs, nextCursor: hasMore && last ? encodeLogCursor(last.createdAt, last.id) : null };
}

// ─── Per-user history ───────────────────────────────────────────

export const HISTORY_LIMIT = 200;

export interface UserHistory {
  payments: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    plan: string;
    period: number;
    transactionId: string | null;
    createdAt: string;
    paidAt: string | null;
    appliedAt: string | null;
    refundedAt: string | null;
    refundId: string | null;
    product: "subscription" | "traffic";
    trafficPackId: string | null;
    trafficBytes: number | null;
  }>;
  events: Array<{
    id: string;
    kind: string;
    days: number | null;
    oldEnd: string | null;
    newEnd: string | null;
    plan: string | null;
    actor: string | null;
    sourceId: string;
    meta: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

const isoOrNull = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function getUserHistory(userId: string, limit = HISTORY_LIMIT): Promise<UserHistory> {
  const [payments, events] = await Promise.all([
    pool.query(
      `SELECT id, status, amount, currency, plan, period, transaction_id, created_at, paid_at, applied_at, refunded_at, refund_id,
              product, traffic_pack_id, traffic_bytes
       FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    ),
    pool.query(
      `SELECT id, kind, days, old_end, new_end, plan, actor, source_id, meta, created_at
       FROM subscription_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    ),
  ]);
  return {
    payments: payments.rows.map((r) => ({
      id: r.id,
      status: r.status,
      amount: parseFloat(r.amount),
      currency: r.currency || "RUB",
      plan: r.plan,
      period: Number(r.period),
      transactionId: r.transaction_id ?? null,
      createdAt: new Date(r.created_at).toISOString(),
      paidAt: isoOrNull(r.paid_at),
      appliedAt: isoOrNull(r.applied_at),
      refundedAt: isoOrNull(r.refunded_at),
      refundId: r.refund_id ?? null,
      product: r.product === "traffic" ? ("traffic" as const) : ("subscription" as const),
      trafficPackId: r.traffic_pack_id ?? null,
      trafficBytes: r.traffic_bytes != null ? Number(r.traffic_bytes) : null,
    })),
    events: events.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      days: r.days === null || r.days === undefined ? null : Number(r.days),
      oldEnd: isoOrNull(r.old_end),
      newEnd: isoOrNull(r.new_end),
      plan: r.plan ?? null,
      actor: r.actor ?? null,
      sourceId: r.source_id,
      meta: typeof r.meta === "string" ? JSON.parse(r.meta) : r.meta ?? null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  };
}
