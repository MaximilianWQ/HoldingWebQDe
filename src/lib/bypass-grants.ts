/**
 * Apply bypass grants (src/lib/bypass-ledger.ts) to the panel.
 *
 * The DB is the source of truth: a grant row is written in the same
 * transaction as its cause (trial at sign-up, confirmPayment, admin
 * form). This module then makes the panel match, exactly once per grant:
 *
 *   1. Find the person's bypass entity:
 *        stored users.bypass_panel_user_id (only a positive 404 clears it)
 *        → the bot's `{telegram_id}` for a linked account
 *        → none: create the SITE entity `ST…_bp` (buildBypassCreateBody),
 *          seeded with the oldest owed grant (limit = its bytes; the panel
 *          reads 0 as "unlimited", so an entity is never created empty).
 *          A lost create answer is recovered by A019 → adopt the entity
 *          marked `atlas-site:<id>`; the seed counts as applied only if the
 *          adopted limit equals it (otherwise 'conflict', manual review).
 *   2. Every other owed grant: addBypassTraffic (bypass.ts) — idempotent
 *      read-modify-write of trafficLimitBytes, op id `grant:<id>`.
 *      Never a reset, never an absolute value from our DB.
 *   3. Panel unavailable → the grants stay owed with a backoff; the sync
 *      worker (sync-worker.ts) retries them.
 *
 * A trial grant is SKIPPED when the person's entity is the bot's: the
 * bot gave its own trial traffic there.
 *
 * Premium is never touched here (no ledger event, no expireAt, no plan).
 */

import { pool } from "./db";
import { withUserSyncLock } from "./locks";
import { addBypassTraffic, clearBypassCache, findBotBypass, isBotBypassFor, mergeBypassEntities, panelIdOwner } from "./bypass";
import { GrantKind, GrantState, grantId, insertBypassGrant } from "./bypass-ledger";
import {
  buildBypassCreateBody,
  createUser,
  describeRwError,
  getUserById as rwGetUserById,
  getUserByUsername,
  isBypassEntity,
  isSiteBypassFor,
  isUserGone,
  PanelUser,
  siteBypassUsername,
} from "./remnawave";
import { GB, formatTraffic } from "./traffic-packs";
import { withTransaction } from "./subscription-ledger";
import { createAuditLog, createNotificationForUser } from "./store";

export { grantId, insertBypassGrant };
export type { GrantKind, GrantState };

export interface BypassGrant {
  id: string;
  userId: string;
  kind: GrantKind;
  bytes: number;
  packId: string | null;
  paymentId: string | null;
  actor: string | null;
  note: string | null;
  state: GrantState;
  panelUserId: number | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  appliedAt: string | null;
}

const isoOrNull = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToGrant(r: any): BypassGrant {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    bytes: Number(r.bytes),
    packId: r.pack_id ?? null,
    paymentId: r.payment_id ?? null,
    actor: r.actor ?? null,
    note: r.note ?? null,
    state: r.state,
    panelUserId: r.panel_user_id != null ? Number(r.panel_user_id) : null,
    attempts: Number(r.attempts ?? 0),
    lastError: r.last_error ?? null,
    nextAttemptAt: isoOrNull(r.next_attempt_at),
    createdAt: new Date(r.created_at).toISOString(),
    appliedAt: isoOrNull(r.applied_at),
  };
}

export interface ApplyResult {
  ok: boolean;
  busy?: boolean;
  applied: number;
  skipped: number;
  conflicts: number;
  /** Grants still owed after this run (panel down, busy…). */
  owed: number;
  created: boolean;
  panelUserId: number | null;
  error?: string;
}

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;
export function grantBackoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

interface UserRow {
  id: string;
  email: string;
  public_id: string | null;
  telegram_id: string | null;
  bypass_panel_user_id: string | number | null;
  bypass_origin: string | null;
  email_verified_at: Date | string | null;
}

function log(level: "info" | "warn" | "error", userId: string, msg: string) {
  const line = `[BYPASS-GRANTS ${userId.slice(0, 8)}] ${msg}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// ─── SQL ──────────────────────────────────────────────────────────

async function loadOwed(userId: string): Promise<BypassGrant[]> {
  const r = await pool.query(
    `SELECT * FROM bypass_grants WHERE user_id = $1 AND state IN ('pending', 'seeding')
     ORDER BY CASE WHEN state = 'seeding' THEN 0 ELSE 1 END, created_at, id`,
    [userId]
  );
  return r.rows.map(rowToGrant);
}

async function loadUser(userId: string): Promise<UserRow | null> {
  const r = await pool.query<UserRow>(
    "SELECT id, email, public_id, telegram_id, bypass_panel_user_id, bypass_origin, email_verified_at FROM users WHERE id = $1",
    [userId]
  );
  return r.rows[0] ?? null;
}

async function ensurePublicId(userId: string): Promise<string | null> {
  const r = await pool.query<{ public_id: string }>(
    `UPDATE users SET public_id = 'ST' || LPAD(NEXTVAL('user_public_id_seq')::text, 8, '0')
     WHERE id = $1 AND public_id IS NULL
     RETURNING public_id`,
    [userId]
  );
  if (r.rows.length > 0) return r.rows[0].public_id;
  const again = await pool.query<{ public_id: string | null }>("SELECT public_id FROM users WHERE id = $1", [userId]);
  return again.rows[0]?.public_id ?? null;
}

async function markSeeding(id: string): Promise<void> {
  await pool.query("UPDATE bypass_grants SET state = 'seeding' WHERE id = $1 AND state = 'pending'", [id]);
}

async function finishGrant(g: BypassGrant, state: "applied" | "skipped" | "conflict", panelUserId: number | null, note: string | null): Promise<void> {
  await pool.query(
    `UPDATE bypass_grants SET state = $2, panel_user_id = COALESCE($3, panel_user_id), note = COALESCE($4, note),
            last_error = NULL, applied_at = NOW()
     WHERE id = $1 AND state IN ('pending', 'seeding')`,
    [g.id, state, panelUserId, note]
  );
  if (state === "applied" && g.paymentId) {
    await pool.query("UPDATE payments SET applied_to_remnawave_at = NOW() WHERE id = $1 AND applied_to_remnawave_at IS NULL", [g.paymentId]);
  }
}

async function deferOwed(userId: string, attempts: number, error: string): Promise<void> {
  await pool.query(
    `UPDATE bypass_grants SET attempts = attempts + 1, last_error = $2, next_attempt_at = $3
     WHERE user_id = $1 AND state IN ('pending', 'seeding')`,
    [userId, error.slice(0, 500), new Date(Date.now() + grantBackoffMs(attempts + 1))]
  );
}

async function storeBypassId(userId: string, entity: PanelUser, origin: "site" | "bot"): Promise<void> {
  await pool.query(
    `UPDATE users SET bypass_panel_user_id = $2, bypass_origin = $3, bypass_subscription_url = COALESCE($4, bypass_subscription_url)
     WHERE id = $1 AND (bypass_panel_user_id IS NULL OR bypass_panel_user_id = $2)`,
    [userId, entity.id, origin, entity.subscriptionUrl || null]
  );
}

async function clearStaleBypassId(userId: string, panelUserId: number): Promise<void> {
  await pool.query("UPDATE users SET bypass_panel_user_id = NULL, bypass_origin = NULL, bypass_subscription_url = NULL WHERE id = $1 AND bypass_panel_user_id = $2", [userId, panelUserId]);
}

// ─── Resolve the person's bypass entity ───────────────────────────

type Resolved =
  | { kind: "found"; entity: PanelUser; origin: "site" | "bot" }
  | { kind: "none" }
  | { kind: "error"; error: string };

async function resolveEntity(u: UserRow): Promise<Resolved> {
  const storedId = u.bypass_panel_user_id != null ? Number(u.bypass_panel_user_id) : null;
  if (storedId) {
    const r = await rwGetUserById(storedId);
    if (r.ok) {
      if (isBypassEntity(r.data) || (u.telegram_id && isBotBypassFor(r.data, u.telegram_id))) {
        return { kind: "found", entity: r.data, origin: u.bypass_origin === "site" ? "site" : "bot" };
      }
      return { kind: "error", error: `stored bypass ${storedId} (${r.data.username}) is not a bypass entity — not written` };
    }
    if (isUserGone(r)) {
      await clearStaleBypassId(u.id, storedId);
      log("warn", u.id, `stored bypass ${storedId} is gone from the panel (${r.errorCode}) — link cleared`);
    } else {
      return { kind: "error", error: describeRwError(r) };
    }
  }
  if (u.telegram_id && /^\d+$/.test(u.telegram_id)) {
    const f = await findBotBypass(u.telegram_id);
    if (!f.ok) return { kind: "error", error: describeRwError(f.error) };
    if (f.user) {
      const owner = await panelIdOwner(pool, f.user.id, u.id);
      if (!owner) {
        await storeBypassId(u.id, f.user, "bot");
        return { kind: "found", entity: f.user, origin: "bot" };
      }
      log("warn", u.id, `bot bypass ${f.user.id} is held by another account — using a site entity`);
    }
  }
  return { kind: "none" };
}

// ─── Apply ────────────────────────────────────────────────────────

const empty = (over: Partial<ApplyResult> = {}): ApplyResult => ({ ok: true, applied: 0, skipped: 0, conflicts: 0, owed: 0, created: false, panelUserId: null, ...over });

async function doApply(userId: string): Promise<ApplyResult> {
  const owed = await loadOwed(userId);
  if (owed.length === 0) return empty();
  const u = await loadUser(userId);
  if (!u) return empty({ ok: false, owed: owed.length, error: "user_not_found" });
  const attempts = Math.max(...owed.map((g) => g.attempts));
  const res = empty({ owed: owed.length });
  const defer = async (error: string) => {
    await deferOwed(userId, attempts, error);
    log("warn", userId, `deferred ${res.owed} grant(s): ${error}`);
    return { ...res, ok: false, error };
  };

  const found = await resolveEntity(u);
  if (found.kind === "error") return defer(found.error);

  let entity: PanelUser | null = found.kind === "found" ? found.entity : null;
  let origin: "site" | "bot" = found.kind === "found" ? found.origin : "site";
  let rest = owed;

  // A grant left 'seeding' means a create was sent for it. If the entity
  // we now resolved is not that site entity (the person linked the bot in
  // between), the seed may sit in an orphan ST…_bp: merge it over.
  const seeding = owed.find((g) => g.state === "seeding");
  if (entity && seeding) {
    if (origin === "site") {
      // The create succeeded and the id was stored; only the grant row lagged.
      await finishGrant(seeding, "applied", entity.id, "seed of the site entity (recovered)");
      res.applied += 1;
    } else {
      const publicId = u.public_id;
      const orphan = publicId ? await getUserByUsername(siteBypassUsername(publicId)) : null;
      if (orphan && !orphan.ok && !(orphan.kind === "not_found" || orphan.kind === "validation")) return defer(describeRwError(orphan));
      if (orphan && orphan.ok && isSiteBypassFor(orphan.data, u.id)) {
        const m = await mergeBypassEntities(entity, orphan.data);
        if (!m.ok) return defer(`merge of orphan ${orphan.data.id}: ${m.error}`);
        await finishGrant(seeding, "applied", entity.id, `created in ${orphan.data.id}, merged into ${entity.id}`);
        res.applied += 1;
      } else {
        // Never created: apply it like any other owed grant.
        await pool.query("UPDATE bypass_grants SET state = 'pending' WHERE id = $1 AND state = 'seeding'", [seeding.id]);
        seeding.state = "pending";
      }
    }
    // The seed is either finished (still 'seeding' in memory) or back to 'pending'.
    rest = owed.filter((g) => g.state === "pending");
  }

  if (!entity) {
    const seed = owed[0];
    if (seed.state === "pending") await markSeeding(seed.id);
    const publicId = u.public_id ?? (await ensurePublicId(u.id));
    if (!publicId) return defer("no_public_id");
    const body = buildBypassCreateBody({
      publicId,
      email: u.email,
      userId: u.id,
      emailVerifiedAt: isoOrNull(u.email_verified_at),
      bytes: seed.bytes,
    });
    const c = await createUser(body);
    let seedApplied = false;
    if (c.ok) {
      entity = c.data;
      seedApplied = true;
      log("info", userId, `created bypass ${c.data.id} (${c.data.username}) with ${formatTraffic(seed.bytes)} (${seed.id})`);
    } else if (c.kind === "conflict") {
      // A019: a previous create whose answer was lost. Adopt only our own.
      const again = await getUserByUsername(body.username);
      if (!again.ok) return defer(describeRwError(again));
      if (!isSiteBypassFor(again.data, u.id)) return defer(`username ${body.username} is taken by a panel user not marked atlas-site:${u.id}`);
      const owner = await panelIdOwner(pool, again.data.id, u.id);
      if (owner) return defer(`panel user ${again.data.id} is linked to another account`);
      entity = again.data;
      seedApplied = again.data.trafficLimitBytes === seed.bytes;
      log("info", userId, `adopted bypass ${again.data.id} after a lost create answer (limit ${again.data.trafficLimitBytes}, seed ${seed.bytes})`);
    } else {
      return defer(describeRwError(c));
    }
    origin = "site";
    res.created = true;
    await storeBypassId(u.id, entity, "site");
    if (seedApplied) {
      await finishGrant(seed, "applied", entity.id, null);
      res.applied += 1;
    } else {
      await finishGrant(seed, "conflict", entity.id, `adopted ${entity.id} with limit ${entity.trafficLimitBytes} ≠ seed ${seed.bytes} — manual review`);
      res.conflicts += 1;
    }
    rest = owed.slice(1);
  }

  res.panelUserId = entity.id;
  for (const g of rest) {
    if (g.kind === "trial" && origin === "bot") {
      await finishGrant(g, "skipped", entity.id, "the person already has the bot's bypass (bot trial)");
      res.skipped += 1;
      continue;
    }
    const r = await addBypassTraffic({ panelUserId: entity.id, addBytes: g.bytes, opId: `grant:${g.id}`, note: `${g.kind}${g.packId ? ` ${g.packId}` : ""}` });
    if (r.ok) {
      await finishGrant(g, "applied", entity.id, r.note === "unlimited" ? "entity is unlimited — nothing added" : null);
      res.applied += 1;
    } else if (r.state === "panel_error") {
      res.owed = rest.length - rest.indexOf(g);
      return defer(r.error);
    } else {
      await finishGrant(g, "conflict", entity.id, `${r.state}: ${r.error}`);
      res.conflicts += 1;
      log("error", userId, `grant ${g.id}: ${r.state} — ${r.error}`);
    }
  }
  res.owed = 0;
  clearBypassCache();
  return res;
}

/**
 * Push every owed grant of one account to the panel. Idempotent, safe
 * from anywhere (payment confirmation, sign-up, the worker, admin). A
 * per-user lock (namespace separate from the premium sync) keeps two runs
 * from creating twice.
 */
export async function applyBypassGrants(userId: string): Promise<ApplyResult> {
  try {
    const locked = await withUserSyncLock(`bp:${userId}`, () => doApply(userId));
    if (!locked.acquired) return empty({ ok: false, busy: true, error: "busy" });
    return locked.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", userId, `apply threw: ${message}`);
    return empty({ ok: false, error: message });
  }
}

/** Fire-and-forget after a commit; a failure stays owed for the worker. */
export function requestBypassApply(userId: string, context: string): void {
  applyBypassGrants(userId)
    .then((r) => {
      if (!r.ok && !r.busy) console.warn(`[BYPASS-GRANTS] ${context}: ${userId.slice(0, 8)} → ${r.error}`);
    })
    .catch((err) => console.error(`[BYPASS-GRANTS] ${context}: unexpected`, err));
}

/** Worker pass: accounts with owed grants whose backoff has passed. */
export async function runBypassGrantsPass(limit = 50): Promise<{ scanned: number; ok: number; failed: number }> {
  const rows = (
    await pool.query<{ user_id: string }>(
      `SELECT user_id FROM bypass_grants
       WHERE state IN ('pending', 'seeding') AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
       GROUP BY user_id ORDER BY MIN(created_at) LIMIT $1`,
      [limit]
    )
  ).rows;
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    const res = await applyBypassGrants(r.user_id);
    if (res.ok) ok += 1;
    else if (!res.busy) failed += 1;
  }
  if (rows.length > 0) console.log(`[BYPASS-GRANTS] pass: scanned=${rows.length} ok=${ok} failed=${failed}`);
  return { scanned: rows.length, ok, failed };
}

// ─── Reads ────────────────────────────────────────────────────────

/** Bytes bought/granted but not yet in the panel — the dashboard says «зачисляем». */
export async function getOwedBypassBytes(userId: string): Promise<number> {
  const r = await pool.query<{ n: string | number | null }>(
    "SELECT COALESCE(SUM(bytes), 0) AS n FROM bypass_grants WHERE user_id = $1 AND state IN ('pending', 'seeding')",
    [userId]
  );
  return Number(r.rows[0]?.n ?? 0);
}

export async function getBypassGrant(id: string): Promise<BypassGrant | null> {
  const r = await pool.query("SELECT * FROM bypass_grants WHERE id = $1", [id]);
  return r.rows[0] ? rowToGrant(r.rows[0]) : null;
}

/** The site trial bypass was granted to this account (the bot must not give its own again). */
export async function hasSiteBypassTrial(userId: string): Promise<boolean> {
  const r = await pool.query("SELECT state FROM bypass_grants WHERE id = $1", [grantId.trial(userId)]);
  return r.rows.length > 0 && r.rows[0].state !== "skipped";
}

export async function listBypassGrants(userId: string, limit = 100): Promise<BypassGrant[]> {
  const r = await pool.query("SELECT * FROM bypass_grants WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2", [userId, limit]);
  return r.rows.map(rowToGrant);
}

export interface BypassOpRow {
  opId: string;
  panelUserId: number;
  addBytes: number;
  baseLimit: number | null;
  state: string;
  note: string | null;
  createdAt: string;
  appliedAt: string | null;
}

/** bypass_traffic_ops of the person's entity and of their grants (newest first). */
export async function listBypassOps(panelUserId: number | null, grantIds: string[], limit = 100): Promise<BypassOpRow[]> {
  const r = await pool.query(
    `SELECT op_id, panel_user_id, add_bytes, base_limit, state, note, created_at, applied_at FROM bypass_traffic_ops
     WHERE panel_user_id = $1 OR op_id = ANY($2) ORDER BY created_at DESC LIMIT $3`,
    [panelUserId ?? -1, grantIds.map((id) => `grant:${id}`), limit]
  );
  return r.rows.map((o) => ({
    opId: o.op_id,
    panelUserId: Number(o.panel_user_id),
    addBytes: Number(o.add_bytes),
    baseLimit: o.base_limit != null ? Number(o.base_limit) : null,
    state: o.state,
    note: o.note ?? null,
    createdAt: new Date(o.created_at).toISOString(),
    appliedAt: isoOrNull(o.applied_at),
  }));
}

// ─── Admin: manual grant ──────────────────────────────────────────

export const ADMIN_BYPASS_MAX_GB = 5000;
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;

/** Pure validation of the admin form. */
export function parseAdminBypassGrant(input: { gb?: unknown; requestId?: unknown }): { ok: true; bytes: number; gb: number; requestId: string } | { ok: false; status: number; error: string } {
  const gb = typeof input.gb === "string" ? Number(input.gb.replace(",", ".")) : Number(input.gb);
  if (!Number.isFinite(gb) || gb <= 0 || gb > ADMIN_BYPASS_MAX_GB || Math.round(gb * 10) !== gb * 10) {
    return { ok: false, status: 400, error: `Объём — от 0,1 до ${ADMIN_BYPASS_MAX_GB} ГБ, с точностью до десятой` };
  }
  if (typeof input.requestId !== "string" || !REQUEST_ID_RE.test(input.requestId)) {
    return { ok: false, status: 400, error: "Нет ключа запроса — обновите карточку" };
  }
  return { ok: true, gb, bytes: Math.round(gb * GB), requestId: input.requestId };
}

/**
 * Admin «Начислить ГБ»: one grant per form submit (requestId), written to
 * the ledger and applied like a purchase. A repeat of the same submit is
 * a duplicate, never a second credit.
 */
export async function adminGrantBypass(
  userId: string,
  input: { gb?: unknown; requestId?: unknown },
  adminEmail: string | null
): Promise<{ ok: true; duplicate: boolean; grantId: string; bytes: number; apply: ApplyResult } | { ok: false; status: number; error: string }> {
  const p = parseAdminBypassGrant(input);
  if (!p.ok) return p;
  const id = grantId.admin(p.requestId);
  const inserted = await withTransaction((c) =>
    insertBypassGrant(c, { id, userId, kind: "admin", bytes: p.bytes, actor: adminEmail ? `admin:${adminEmail}` : "admin", note: `${p.gb} ГБ вручную` })
  );
  const apply = await applyBypassGrants(userId);
  if (inserted) {
    await createAuditLog("admin.bypass_grant", `+${formatTraffic(p.bytes)} обхода (${id}); панель: ${apply.ok ? "применено" : `отложено — ${apply.error ?? ""}`}`, userId);
    await createNotificationForUser(userId, "Начислен трафик", `Вам начислено ${formatTraffic(p.bytes)} для ключа «Обход». Гигабайты прибавлены к остатку.`);
  }
  return { ok: true, duplicate: !inserted, grantId: id, bytes: p.bytes, apply };
}
