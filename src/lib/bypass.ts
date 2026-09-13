/**
 * Bypass (обход) panel entities.
 *
 * The bot keeps one bypass panel user per Telegram id: username
 * `{telegram_id}`, expireAt 2099, limited by TRAFFIC, its own squad
 * (docs/bot/PANEL_USER_MODEL.md). A site account knows it through
 * users.bypass_panel_user_id.
 *
 * Rules:
 *   - the premium machinery (ledger, sync worker, reconciliation) NEVER
 *     touches a bypass entity — no expireAt, no status, no squads, no
 *     device limit, no traffic strategy;
 *   - the only write is an explicit traffic operation: add bytes by an
 *     idempotent read-modify-write of trafficLimitBytes (one row per
 *     operation in bypass_traffic_ops) — used by the link merge now and
 *     by site purchases of «Пакеты трафика» in the next phase (op id =
 *     payment id);
 *   - reads for the dashboard / bot status are bounded in time and
 *     cached, and simply return null when the panel does not answer.
 */

import { pool } from "./db";
import {
  botBypassUsername,
  describeRwError,
  getUserById as rwGetUserById,
  getUserByUsername,
  isBypassEntity,
  isSiteUsername,
  PanelUser,
  RwError,
  updateUser,
} from "./remnawave";

/**
 * Owner decision (13.09.2026): when a person has a bypass entity on
 * both sides at link time, the REMAINING traffic (limit − used) of the
 * other one is added to the bot's `{telegram_id}` entity, and the other
 * one is DISABLED. Premium follows a different rule (larger term wins).
 */
export const BYPASS_MERGE_RULE = "sum_remaining_into_bot" as const;

export interface BypassSnapshot {
  panelUserId: number;
  username: string;
  subscriptionUrl: string | null;
  limitBytes: number;
  usedBytes: number;
  /** null when the entity has no limit (trafficLimitBytes = 0). */
  remainingBytes: number | null;
  unlimited: boolean;
  status: string;
}

export function toBypassSnapshot(u: PanelUser): BypassSnapshot {
  const unlimited = u.trafficLimitBytes === 0;
  return {
    panelUserId: u.id,
    username: u.username,
    subscriptionUrl: u.subscriptionUrl || null,
    limitBytes: u.trafficLimitBytes,
    usedBytes: u.usedTrafficBytes,
    remainingBytes: unlimited ? null : Math.max(0, u.trafficLimitBytes - u.usedTrafficBytes),
    unlimited,
    status: String(u.status || ""),
  };
}

/** The bot's bypass entity of THIS Telegram id: exact username and the same panel telegramId. */
export function isBotBypassFor(u: PanelUser, telegramId: string): boolean {
  return u.username === botBypassUsername(telegramId) && String(u.telegramId) === telegramId && !isSiteUsername(u.username);
}

export type BypassLookup = { ok: true; user: PanelUser | null } | { ok: false; error: RwError };

export async function findBotBypass(telegramId: string): Promise<BypassLookup> {
  const r = await getUserByUsername(botBypassUsername(telegramId));
  if (r.ok) return { ok: true, user: isBotBypassFor(r.data, telegramId) ? r.data : null };
  if (r.kind === "not_found" || r.kind === "validation") return { ok: true, user: null };
  return { ok: false, error: r };
}

/** Local account (other than `exceptUserId`) that already holds this panel id as its key or bypass. */
export async function panelIdOwner(
  q: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> },
  panelId: number,
  exceptUserId: string
): Promise<string | null> {
  const r = await q.query(
    "SELECT id FROM users WHERE id <> $2 AND (panel_user_id = $1 OR bypass_panel_user_id = $1 OR remnawave_user_uuid = $3) LIMIT 1",
    [panelId, exceptUserId, String(panelId)]
  );
  return r.rows[0] ? String(r.rows[0].id) : null;
}

// ─── Read for the dashboard and the bot status ───────────────────

const POSITIVE_TTL_MS = 30_000;
const NEGATIVE_TTL_MS = 10 * 60_000;
const DEFAULT_READ_TIMEOUT_MS = 2_500;

const g = globalThis as unknown as { __bypassCache?: Map<string, { at: number; snap: BypassSnapshot | null }> };
if (!g.__bypassCache) g.__bypassCache = new Map();
const cache = g.__bypassCache;

/** Test hook. */
export function clearBypassCache(): void {
  cache.clear();
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      }
    );
  });
}

/**
 * Bypass of a site account, or null (none known, or the panel did not
 * answer in time — the caller then simply does not show it). A linked
 * account without a stored bypass id gets the bot's `{telegram_id}`
 * entity looked up once and remembered.
 */
export async function getBypassForUser(
  user: { id: string; telegramId: string | null; bypassPanelUserId: number | null },
  opts: { timeoutMs?: number } = {}
): Promise<BypassSnapshot | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS;
  const now = Date.now();
  let id = user.bypassPanelUserId;

  if (!id && user.telegramId && /^\d+$/.test(user.telegramId)) {
    const negKey = `tg:${user.telegramId}`;
    const neg = cache.get(negKey);
    if (neg && now - neg.at < NEGATIVE_TTL_MS) return null;
    const found = await withTimeout(findBotBypass(user.telegramId), timeoutMs);
    if (!found || !found.ok) return null; // not asked → do not remember a "no"
    if (!found.user) {
      cache.set(negKey, { at: now, snap: null });
      return null;
    }
    const owner = await panelIdOwner(pool, found.user.id, user.id).catch(() => "?");
    if (owner) return null;
    await pool
      .query("UPDATE users SET bypass_panel_user_id = $2 WHERE id = $1 AND bypass_panel_user_id IS NULL", [user.id, found.user.id])
      .catch((err) => console.warn("[BYPASS] could not remember bypass id:", err instanceof Error ? err.message : err));
    const snap = toBypassSnapshot(found.user);
    cache.set(`id:${found.user.id}`, { at: now, snap });
    return snap;
  }
  if (!id) return null;

  const hit = cache.get(`id:${id}`);
  if (hit && now - hit.at < POSITIVE_TTL_MS) return hit.snap;
  const r = await withTimeout(rwGetUserById(id), timeoutMs);
  if (!r || !r.ok) return null;
  if (!isBypassEntity(r.data) && !(user.telegramId && isBotBypassFor(r.data, user.telegramId))) {
    console.warn(`[BYPASS] panel user ${id} stored as bypass of ${user.id.slice(0, 8)} does not look like a bypass entity — not shown`);
    return null;
  }
  const snap = toBypassSnapshot(r.data);
  cache.set(`id:${id}`, { at: now, snap });
  return snap;
}

// ─── Traffic operations (the only writes) ─────────────────────────

export type BypassOpResult =
  | { ok: true; applied: boolean; duplicate: boolean; limitBytes: number; note?: string }
  | { ok: false; state: "panel_error" | "conflict" | "invalid"; error: string };

interface OpRow {
  op_id: string;
  panel_user_id: string | number;
  add_bytes: string | number;
  base_limit: string | number | null;
  state: string;
}

async function finishOp(opId: string, state: "applied" | "conflict", note: string | null): Promise<void> {
  await pool.query("UPDATE bypass_traffic_ops SET state = $2, applied_at = NOW(), note = COALESCE($3, note) WHERE op_id = $1", [opId, state, note]);
}

/**
 * Add `addBytes` to a bypass entity's trafficLimitBytes, exactly once
 * per `opId`. The panel has no compare-and-set, so the operation
 * records the limit it saw first (base) and on a retry decides from the
 * current limit: base → apply, base + add → already applied (lost
 * response), anything else → someone changed it in between: 'conflict'
 * for manual review (never guess).
 */
export async function addBypassTraffic(input: { panelUserId: number; addBytes: number; opId: string; note?: string }): Promise<BypassOpResult> {
  if (!Number.isSafeInteger(input.addBytes) || input.addBytes <= 0) return { ok: false, state: "invalid", error: `addBytes must be a positive integer (${input.addBytes})` };
  await pool.query(
    "INSERT INTO bypass_traffic_ops (op_id, panel_user_id, add_bytes, note) VALUES ($1, $2, $3, $4) ON CONFLICT (op_id) DO NOTHING",
    [input.opId, input.panelUserId, input.addBytes, input.note ?? null]
  );
  const op = (await pool.query<OpRow>("SELECT op_id, panel_user_id, add_bytes, base_limit, state FROM bypass_traffic_ops WHERE op_id = $1", [input.opId])).rows[0];
  if (!op) return { ok: false, state: "invalid", error: "operation row missing" };
  if (Number(op.panel_user_id) !== input.panelUserId) return { ok: false, state: "invalid", error: `op ${input.opId} belongs to panel user ${op.panel_user_id}` };
  const add = Number(op.add_bytes); // the first call's amount wins on retries
  if (op.state === "applied") return { ok: true, applied: false, duplicate: true, limitBytes: NaN };
  if (op.state === "conflict") return { ok: false, state: "conflict", error: `op ${input.opId} is in conflict — manual review` };

  const cur = await rwGetUserById(input.panelUserId);
  if (!cur.ok) return { ok: false, state: "panel_error", error: describeRwError(cur) };
  const limit = cur.data.trafficLimitBytes;
  if (limit === 0) {
    await finishOp(input.opId, "applied", "entity is unlimited — nothing added");
    return { ok: true, applied: false, duplicate: false, limitBytes: 0, note: "unlimited" };
  }
  const baseRow = (
    await pool.query<{ base_limit: string | number }>(
      "UPDATE bypass_traffic_ops SET base_limit = COALESCE(base_limit, $2) WHERE op_id = $1 RETURNING base_limit",
      [input.opId, limit]
    )
  ).rows[0];
  const base = Number(baseRow?.base_limit ?? limit);
  const target = base + add;
  if (limit === target) {
    await finishOp(input.opId, "applied", null);
    return { ok: true, applied: false, duplicate: true, limitBytes: limit };
  }
  if (limit !== base) {
    await finishOp(input.opId, "conflict", `limit moved from ${base} to ${limit} between attempts`);
    console.error(`[BYPASS] op ${input.opId}: limit moved ${base} → ${limit}, not ${target} — marked conflict`);
    return { ok: false, state: "conflict", error: `limit moved from ${base} to ${limit}` };
  }
  const r = await updateUser({ id: input.panelUserId, trafficLimitBytes: target });
  if (!r.ok) return { ok: false, state: "panel_error", error: describeRwError(r) };
  await finishOp(input.opId, "applied", null);
  cache.delete(`id:${input.panelUserId}`);
  return { ok: true, applied: true, duplicate: false, limitBytes: r.data.trafficLimitBytes };
}

/**
 * Merge two bypass entities of one person (BYPASS_MERGE_RULE): add the
 * other's remaining traffic to `keep`, then DISABLE the other. Safe to
 * repeat: the add is idempotent by op id, the disable is skipped when
 * already done. The other is disabled only after the add succeeded.
 */
export async function mergeBypassEntities(keep: PanelUser, other: PanelUser): Promise<{ ok: true; addedBytes: number; disabledId: number | null } | { ok: false; error: string }> {
  if (keep.id === other.id) return { ok: true, addedBytes: 0, disabledId: null };
  const remaining = other.trafficLimitBytes === 0 ? 0 : Math.max(0, other.trafficLimitBytes - other.usedTrafficBytes);
  let added = 0;
  if (remaining > 0) {
    const r = await addBypassTraffic({
      panelUserId: keep.id,
      addBytes: remaining,
      opId: `bypass-merge:${other.id}->${keep.id}`,
      note: `merge of bypass ${other.id} (${other.username})`,
    });
    if (!r.ok) return { ok: false, error: `${r.state}: ${r.error}` };
    added = remaining;
  }
  if (other.status !== "DISABLED") {
    const d = await updateUser({ id: other.id, status: "DISABLED" });
    if (!d.ok) return { ok: false, error: describeRwError(d) };
  }
  cache.delete(`id:${other.id}`);
  return { ok: true, addedBytes: added, disabledId: other.id };
}
