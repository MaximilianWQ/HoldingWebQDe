/**
 * Background panel sync.
 *
 *   every 60 s — push users whose panel_sync_state is 'pending', or
 *                'error' with an elapsed backoff (panel_next_sync_at);
 *                and write one health sample (health_samples);
 *   every hour — reconciliation: compare local ↔ panel, repair only
 *                what differs (src/lib/reconciliation.ts).
 *
 * All passes run under Postgres advisory locks (one runner across all
 * instances) and only after the migrations succeeded (dbReady). Run
 * times and errors are recorded for the admin overview (worker-state).
 */

import { dbReady, pool } from "./db";
import { LOCK_KEYS, withJobLock } from "./locks";
import { runReconciliation, ReconciliationReport } from "./reconciliation";
import { syncUserToPanel } from "./subscription-sync";
import { recordHealthSample } from "./health";
import { recordWorkerError, recordWorkerEvent, setWorkerRunning } from "./worker-state";
import { runBypassGrantsPass } from "./bypass-grants";
import { runCampaignPassLocked } from "./campaigns-pg";
import { runRetentionPass } from "./retention";

const PENDING_INTERVAL_MS = 60 * 1000;
const HEALTH_INTERVAL_MS = 60 * 1000;
const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;
/** Рассылки и массовые начисления (campaigns-pg.ts) — свой замок и свой таймер. */
const CAMPAIGN_INTERVAL_MS = 30 * 1000;
/* Сроки хранения считаются сутками — чаще раза в день смысла нет. */
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PENDING_BATCH = 50;

export interface PendingPassResult {
  acquired: boolean;
  scanned: number;
  ok: number;
  failed: number;
  bypass?: { scanned: number; ok: number; failed: number };
}

export async function runPendingPass(limit = PENDING_BATCH): Promise<PendingPassResult> {
  await dbReady; // never run on a half-migrated schema (rejects → caller logs)
  try {
    const locked = await withJobLock(LOCK_KEYS.SYNC_PENDING, async () => {
      const rows = (
        await pool.query<{ id: string }>(
          `SELECT id FROM users
           WHERE panel_sync_state IN ('pending', 'error')
             AND (panel_next_sync_at IS NULL OR panel_next_sync_at <= NOW())
           ORDER BY panel_next_sync_at NULLS FIRST, subscription_end DESC
           LIMIT $1`,
          [limit]
        )
      ).rows;
      let ok = 0;
      let failed = 0;
      for (const r of rows) {
        const res = await syncUserToPanel(r.id);
        if (res.ok) ok += 1;
        else if (res.action !== "busy") failed += 1;
      }
      if (rows.length > 0) console.log(`[SYNC-WORKER] pending pass: scanned=${rows.length} ok=${ok} failed=${failed}`);
      // Bypass grants owed to the panel (trial 500 MB, packs, admin) — a
      // separate pass: it never touches premium keys, and a failure here
      // does not fail the premium pass.
      let bypass = { scanned: 0, ok: 0, failed: 0 };
      try {
        bypass = await runBypassGrantsPass(limit);
      } catch (err) {
        console.error("[SYNC-WORKER] bypass grants pass failed:", err instanceof Error ? err.message : err);
      }
      return { scanned: rows.length, ok, failed, bypass };
    });
    if (!locked.acquired) return { acquired: false, scanned: 0, ok: 0, failed: 0 };
    await recordWorkerEvent("pending", { ...locked.result });
    return { acquired: true, ...locked.result };
  } catch (err) {
    await recordWorkerError("pending", err);
    throw err;
  }
}

export async function runReconcilePass(): Promise<{ acquired: boolean; report: ReconciliationReport | null }> {
  await dbReady;
  try {
    const locked = await withJobLock(LOCK_KEYS.RECONCILE, () => runReconciliation());
    if (!locked.acquired) return { acquired: false, report: null };
    const r = locked.result;
    await recordWorkerEvent("reconcile", { scanned: r.scanned, needed_fix: r.needed_fix, fixed: r.fixed, failed: r.failed, durationMs: r.durationMs });
    return { acquired: true, report: r };
  } catch (err) {
    await recordWorkerError("reconcile", err);
    throw err;
  }
}

export async function runHealthSample(): Promise<boolean> {
  await dbReady;
  try {
    const locked = await withJobLock(LOCK_KEYS.HEALTH_SAMPLE, () => recordHealthSample());
    return locked.acquired;
  } catch (err) {
    await recordWorkerError("health", err);
    throw err;
  }
}

/**
 * Уборка по срокам хранения. Под замком: инстанс может быть не один,
 * а удалять одно и то же дважды незачем.
 */
async function runRetentionPassLocked(): Promise<void> {
  try {
    await withJobLock(LOCK_KEYS.CRON_CLEANUP, () => runRetentionPass());
  } catch (err) {
    await recordWorkerError("retention", err);
    throw err;
  }
}

type Timers = {
  pending: ReturnType<typeof setInterval>;
  reconcile: ReturnType<typeof setInterval>;
  health: ReturnType<typeof setInterval>;
  campaigns: ReturnType<typeof setInterval>;
  retention: ReturnType<typeof setInterval>;
};
const g = globalThis as unknown as { __atlasSyncWorker?: Timers; __atlasSyncWorkerStarting?: boolean };

/**
 * Starts only after the migrations succeeded (dbReady). If they failed,
 * the worker stays stopped and says so — loudly in the log and in the
 * admin overview (worker.thisInstance.reason).
 */
export function startSyncWorker(): void {
  if (g.__atlasSyncWorker || g.__atlasSyncWorkerStarting) return;
  g.__atlasSyncWorkerStarting = true;
  setWorkerRunning(false, "ожидает окончания миграций базы");
  dbReady.then(
    () => {
      if (g.__atlasSyncWorker) return;
      const safe = (name: string, fn: () => Promise<unknown>) => () => {
        fn().catch((err) => console.error(`[SYNC-WORKER] ${name} error:`, err instanceof Error ? err.message : err));
      };
      const pending = setInterval(safe("pending", () => runPendingPass()), PENDING_INTERVAL_MS);
      const health = setInterval(safe("health", () => runHealthSample()), HEALTH_INTERVAL_MS);
      const reconcile = setInterval(safe("reconcile", () => runReconcilePass()), RECONCILE_INTERVAL_MS);
      const campaigns = setInterval(safe("campaigns", () => runCampaignPassLocked()), CAMPAIGN_INTERVAL_MS);
      const retention = setInterval(safe("retention", () => runRetentionPassLocked()), RETENTION_INTERVAL_MS);
      pending.unref?.();
      health.unref?.();
      reconcile.unref?.();
      campaigns.unref?.();
      retention.unref?.();
      g.__atlasSyncWorker = { pending, reconcile, health, campaigns, retention };
      setWorkerRunning(true, null);
      safe("pending", () => runPendingPass())();
      safe("health", () => runHealthSample())();
      // После рестарта рассылка продолжается с того места, где встала.
      safe("campaigns", () => runCampaignPassLocked())();
      // Первый проход сразу: инстанс мог простоять дольше суток.
      safe("retention", () => runRetentionPassLocked())();
      console.log(
        `[SYNC-WORKER] started (pending every ${PENDING_INTERVAL_MS / 1000}s, health every ${HEALTH_INTERVAL_MS / 1000}s, reconcile every ${RECONCILE_INTERVAL_MS / 60000}min, campaigns every ${CAMPAIGN_INTERVAL_MS / 1000}s)`
      );
    },
    (err) => {
      g.__atlasSyncWorkerStarting = false;
      const message = err instanceof Error ? err.message : String(err);
      setWorkerRunning(false, `база не инициализирована: ${message}`);
      console.error("[SYNC-WORKER] NOT STARTED — database initialization failed; fix the migration and restart:", message);
    }
  );
}
