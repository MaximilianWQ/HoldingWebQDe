/**
 * Subscription ledger — the only way `users.subscription_end` changes.
 *
 * Every change is one row in `subscription_events` with a UNIQUE
 * (kind, source_id). Applying the same event twice is a no-op, which is
 * what makes payment confirmation, bot extensions and bonuses
 * idempotent under retries and races.
 *
 * The event row and the users row are written in the SAME transaction
 * as the caller's other writes (payment status, bonus claim, …). The
 * users row is locked with SELECT … FOR UPDATE so two concurrent events
 * for one user extend from the correct base.
 *
 * Each applied event marks the user `panel_sync_state = 'pending'`; the
 * sync worker (or an inline sync right after commit) pushes it to the
 * panel.
 */

import { v4 as uuidv4 } from "uuid";
import type { PoolClient } from "pg";
import { pool, waitForDb } from "./db";

export type LedgerKind =
  | "trial"
  | "payment"
  | "admin_grant"
  | "admin_revoke"
  | "admin_set_plan"
  | "telegram_bonus"
  | "bot_extend"
  | "bot_overwrite"
  | "refund"
  | "ghost_repair_manual"
  /** Telegram ↔ site link: the account takes the term of the surviving panel entity. */
  | "link_merge"
  /** A linked (shared) key got a later term in the panel than in our DB — pulled, never shortened. */
  | "panel_pull";

/** Minimal query interface — a pg PoolClient in production, a fake in tests. */
export interface Queryable {
  query: PoolClient["query"];
}

export interface LedgerEventInput {
  /** Row id; generated when omitted. Callers pass it when the source id is derived from it. */
  id?: string;
  userId: string;
  kind: LedgerKind;
  /** Idempotency key within `kind` (payment id, refund id, user id for one-off bonuses, …). */
  sourceId: string;
  /** Extend from max(now, current end) by this many milliseconds. */
  extendMs?: number;
  /** Set the end to exactly this value (admin revoke, bot overwrite). */
  setEnd?: Date;
  /** New plan slug; omitted/null keeps the current plan. */
  plan?: string | null;
  actor?: string;
  meta?: Record<string, unknown>;
}

export interface LedgerResult {
  /** false when an event with the same (kind, source_id) already existed. */
  applied: boolean;
  oldEnd: Date;
  newEnd: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Sanity cap for a SINGLE event (the longest product is 12 months).
 * This replaces the old cap on the resulting end date, which rejected
 * legitimate stacked renewals (К4).
 */
export const MAX_SINGLE_EXTENSION_MS = 400 * DAY_MS;

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await waitForDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch((rbErr) => {
      console.error("[LEDGER] rollback failed", rbErr instanceof Error ? rbErr.message : String(rbErr));
    });
    throw err;
  } finally {
    client.release();
  }
}

/** Pure: compute the new end for an extension. Exported for tests. */
export function extendFrom(oldEnd: Date, extendMs: number, now: Date = new Date()): Date {
  const base = oldEnd.getTime() > now.getTime() ? oldEnd.getTime() : now.getTime();
  return new Date(base + extendMs);
}

/**
 * Apply one ledger event inside the caller's transaction.
 * Throws on invalid input or a missing user — the caller's transaction
 * then rolls back as a whole.
 */
export async function applySubscriptionEvent(client: Queryable, ev: LedgerEventInput): Promise<LedgerResult> {
  await waitForDb();
  if (ev.extendMs !== undefined) {
    if (!Number.isFinite(ev.extendMs) || ev.extendMs <= 0 || ev.extendMs > MAX_SINGLE_EXTENSION_MS) {
      throw new Error(`ledger: extendMs out of range (${ev.extendMs}) for ${ev.kind}/${ev.sourceId}`);
    }
  }
  if (ev.setEnd !== undefined && !Number.isFinite(ev.setEnd.getTime())) {
    throw new Error(`ledger: invalid setEnd for ${ev.kind}/${ev.sourceId}`);
  }

  const cur = await client.query<{ subscription_end: Date; subscription_plan: string | null }>(
    "SELECT subscription_end, subscription_plan FROM users WHERE id = $1 FOR UPDATE",
    [ev.userId]
  );
  if (cur.rows.length === 0) throw new Error(`ledger: user ${ev.userId} not found`);
  const oldEnd = new Date(cur.rows[0].subscription_end);

  let newEnd = oldEnd;
  if (ev.extendMs !== undefined) newEnd = extendFrom(oldEnd, ev.extendMs);
  else if (ev.setEnd !== undefined) newEnd = ev.setEnd;

  const days = (newEnd.getTime() - oldEnd.getTime()) / DAY_MS;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO subscription_events (id, user_id, kind, source_id, days, old_end, new_end, plan, actor, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (kind, source_id) DO NOTHING
     RETURNING id`,
    [
      ev.id ?? uuidv4(),
      ev.userId,
      ev.kind,
      ev.sourceId,
      Math.round(days * 10000) / 10000,
      oldEnd,
      newEnd,
      ev.plan ?? null,
      ev.actor ?? null,
      ev.meta ? JSON.stringify(ev.meta) : null,
    ]
  );
  if (inserted.rows.length === 0) {
    return { applied: false, oldEnd, newEnd: oldEnd };
  }

  const endChanged = newEnd.getTime() !== oldEnd.getTime();
  const planChanged = ev.plan != null && ev.plan !== cur.rows[0].subscription_plan;
  if (endChanged || planChanged) {
    await client.query(
      `UPDATE users SET
         subscription_end = $2,
         subscription_plan = COALESCE($3, subscription_plan),
         panel_sync_state = 'pending',
         panel_sync_attempts = 0,
         panel_next_sync_at = NOW()
       WHERE id = $1`,
      [ev.userId, newEnd, ev.plan ?? null]
    );
  }
  return { applied: true, oldEnd, newEnd };
}

export const DAY = DAY_MS;
