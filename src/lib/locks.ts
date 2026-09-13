/**
 * Postgres advisory locks for background jobs and per-user panel sync.
 *
 * Session-level locks need the SAME connection for lock and unlock, so
 * each helper checks out a dedicated client and holds it for the
 * duration of `fn`. `fn` itself may use the pool freely.
 *
 * Why: the app may run in more than one process (Railway restarts,
 * scaling, dev hot reload). Without a lock every process runs the
 * hourly jobs and two concurrent syncs of the same user could both
 * create a panel user.
 */

import { pool } from "./db";

/** Namespace for two-key locks: pg_try_advisory_lock(LOCK_NS, key). */
const LOCK_NS = 0x41544c; // "ATL"

export const LOCK_KEYS = {
  SYNC_PENDING: 1,
  RECONCILE: 2,
  CRON_CLEANUP: 3,
  HEALTH_SAMPLE: 4,
  /** Email campaigns / mass grants (src/lib/campaigns-pg.ts). */
  CAMPAIGNS: 5,
} as const;

export type LockResult<T> = { acquired: true; result: T } | { acquired: false };

async function withLock<T>(lockSql: string, unlockSql: string, params: unknown[], fn: () => Promise<T>): Promise<LockResult<T>> {
  const client = await pool.connect();
  let locked = false;
  try {
    const r = await client.query<{ ok: boolean }>(lockSql, params);
    locked = r.rows[0]?.ok === true;
    if (!locked) return { acquired: false };
    const result = await fn();
    return { acquired: true, result };
  } finally {
    if (locked) {
      await client.query(unlockSql, params).catch((err) => {
        console.error("[LOCK] unlock failed", { params, error: err instanceof Error ? err.message : String(err) });
      });
    }
    client.release();
  }
}

/** Process-wide job lock (one runner across all app instances). */
export function withJobLock<T>(key: number, fn: () => Promise<T>): Promise<LockResult<T>> {
  return withLock(
    "SELECT pg_try_advisory_lock($1::int, $2::int) AS ok",
    "SELECT pg_advisory_unlock($1::int, $2::int)",
    [LOCK_NS, key],
    fn
  );
}

/** Namespace of transaction-level locks around a Telegram ↔ site link. */
export const LINK_LOCK_NS = LOCK_NS + 2;

type TxQuery = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

/**
 * pg_advisory_xact_lock inside the caller's transaction (released on
 * COMMIT/ROLLBACK). Take keys in a fixed order (telegram, then email)
 * so two links never deadlock.
 */
export async function lockLinkKey(client: TxQuery, key: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock($1::int, hashtext($2))", [LINK_LOCK_NS, key]);
}

/** Per-user lock around a panel sync, so two syncs never race on create. */
export function withUserSyncLock<T>(userId: string, fn: () => Promise<T>): Promise<LockResult<T>> {
  return withLock(
    "SELECT pg_try_advisory_lock($1::int, hashtext($2)) AS ok",
    "SELECT pg_advisory_unlock($1::int, hashtext($2))",
    [LOCK_NS + 1, userId],
    fn
  );
}
