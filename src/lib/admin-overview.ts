/**
 * GET /api/admin/overview data: health, business, worker, bot switch.
 *
 * Every block is independent (Promise.allSettled): a panel outage shows
 * up as that block's `{ error }`, never hides the DB numbers. The whole
 * overview is cached per instance for 30 s (`?fresh=1` bypasses).
 */

import { pool } from "./db";
import {
  ALL_SITE_TAGS,
  LEGACY_SITE_TAGS,
  describeRwError,
  getBandwidthStats,
  getNodes,
  getSystemHealth,
  getSystemStats,
  streamUsersByTag,
  RwResult,
} from "./remnawave";
import { getExpirations } from "./admin-series";
import { getHealthHistory } from "./health";
import { getWorkerStatus } from "./worker-state";
import { isBotSyncEnabled } from "./settings";

// ─── Small utilities ────────────────────────────────────────────

/** Run `fn` over items with at most `limit` in flight; results keep input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Per-instance TTL cache with in-flight sharing. */
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  let value: { at: number; data: T } | null = null;
  let inflight: Promise<T> | null = null;
  return {
    async get(loader: () => Promise<T>, opts: { fresh?: boolean } = {}): Promise<{ data: T; cached: boolean; cachedAt: number }> {
      if (!opts.fresh && value && now() - value.at < ttlMs) return { data: value.data, cached: true, cachedAt: value.at };
      if (!opts.fresh && inflight) {
        const data = await inflight;
        return { data, cached: true, cachedAt: value?.at ?? now() };
      }
      const p = loader();
      inflight = p;
      try {
        const data = await p;
        value = { at: now(), data };
        return { data, cached: false, cachedAt: value.at };
      } finally {
        if (inflight === p) inflight = null;
      }
    },
    clear() {
      value = null;
    },
  };
}

function unwrap<T>(r: RwResult<T>): { ok: true; data: T } | { ok: false; error: string } {
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: describeRwError(r) };
}

function settled<T>(r: PromiseSettledResult<T>): T | { error: string } {
  return r.status === "fulfilled" ? r.value : { error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
}

// ─── Blocks ─────────────────────────────────────────────────────

const TAG_STREAM_CONCURRENCY = 3;

async function panelBlock() {
  const t0 = Date.now();
  const health = await getSystemHealth();
  const latencyMs = Date.now() - t0;
  const tags = [...ALL_SITE_TAGS, ...LEGACY_SITE_TAGS];
  const [stats, bandwidth, nodes, tagResults] = await Promise.all([
    getSystemStats(),
    getBandwidthStats(),
    getNodes(),
    mapLimit(tags, TAG_STREAM_CONCURRENCY, (tag) => streamUsersByTag(tag, 20)),
  ]);

  const siteByTag: Record<string, { total: number; byStatus: Record<string, number>; onlineLast5m: number; truncated: boolean } | { error: string }> = {};
  tags.forEach((tag, i) => {
    const r = tagResults[i];
    if (!r.ok) {
      siteByTag[tag] = { error: describeRwError(r) };
      return;
    }
    const byStatus: Record<string, number> = {};
    let online = 0;
    for (const u of r.data.users) {
      byStatus[u.status] = (byStatus[u.status] || 0) + 1;
      if (u.onlineAt && Date.now() - Date.parse(u.onlineAt) < 5 * 60 * 1000) online += 1;
    }
    siteByTag[tag] = { total: r.data.users.length, byStatus, onlineLast5m: online, truncated: r.data.truncated };
  });

  const nodeList = nodes.ok ? nodes.data : [];
  return {
    reachable: health.ok,
    latencyMs,
    health: unwrap(health),
    stats: unwrap(stats),
    bandwidth: unwrap(bandwidth),
    nodes: nodes.ok
      ? {
          ok: true as const,
          total: nodeList.length,
          connected: nodeList.filter((n) => n.isConnected && !n.isDisabled).length,
          disabled: nodeList.filter((n) => n.isDisabled).length,
          usersOnline: nodeList.reduce((s, n) => s + (n.usersOnline || 0), 0),
          list: nodeList,
        }
      : { ok: false as const, error: describeRwError(nodes) },
    siteUsersByTag: siteByTag,
  };
}

async function dbBlock() {
  const t0 = Date.now();
  await pool.query("SELECT 1");
  return { latencyMs: Date.now() - t0, pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount } };
}

async function syncBlock() {
  const [states, oldest, errors, lastOk] = await Promise.all([
    pool.query<{ state: string; n: number }>("SELECT panel_sync_state AS state, COUNT(*)::int AS n FROM users GROUP BY panel_sync_state"),
    pool.query<{ at: Date | null }>("SELECT MIN(COALESCE(panel_next_sync_at, created_at)) AS at FROM users WHERE panel_sync_state IN ('pending','error')"),
    pool.query(
      `SELECT id, email, public_id, panel_sync_error, panel_sync_attempts, panel_next_sync_at
       FROM users WHERE panel_sync_state = 'error' ORDER BY panel_next_sync_at DESC NULLS LAST LIMIT 10`
    ),
    pool.query<{ at: Date | null }>("SELECT MAX(panel_synced_at) AS at FROM users"),
  ]);
  return {
    byState: Object.fromEntries(states.rows.map((r) => [r.state, r.n])),
    oldestQueuedAt: oldest.rows[0]?.at ?? null,
    lastSuccessfulSyncAt: lastOk.rows[0]?.at ?? null,
    recentErrors: errors.rows,
  };
}

async function revenueBlock() {
  const [sums, refunds, byPlan, traffic] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow'), 0)::float AS today,
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= NOW() - INTERVAL '7 days'), 0)::float AS d7,
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days'), 0)::float AS d30,
         COALESCE(SUM(amount), 0)::float AS all_time,
         COUNT(*) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days')::int AS count30
       FROM payments WHERE status IN ('confirmed', 'refunded') AND paid_at IS NOT NULL`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::float AS amount
       FROM payments WHERE refunded_at >= NOW() - INTERVAL '30 days'`
    ),
    pool.query(
      `SELECT plan, period, COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::float AS amount
       FROM payments WHERE status IN ('confirmed', 'refunded') AND paid_at >= NOW() - INTERVAL '30 days'
         AND product = 'subscription'
       GROUP BY plan, period ORDER BY plan, period`
    ),
    // «Пакеты трафика» — отдельной строкой: в gross они входят (это деньги),
    // в разбивку по тарифам и в конверсию пробный → подписка — нет.
    pool.query(
      `SELECT traffic_pack_id AS pack, COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::float AS amount,
              COALESCE(SUM(traffic_bytes), 0)::float AS bytes
       FROM payments WHERE status IN ('confirmed', 'refunded') AND paid_at >= NOW() - INTERVAL '30 days'
         AND product = 'traffic'
       GROUP BY traffic_pack_id ORDER BY amount DESC`
    ),
  ]);
  const packs = traffic.rows as Array<{ pack: string | null; n: number; amount: number; bytes: number }>;
  return {
    gross: sums.rows[0],
    refunds30d: refunds.rows[0],
    byPlan30d: byPlan.rows,
    traffic30d: {
      n: packs.reduce((s, x) => s + x.n, 0),
      amount: packs.reduce((s, x) => s + x.amount, 0),
      bytes: packs.reduce((s, x) => s + x.bytes, 0),
      byPack: packs,
    },
    currency: "RUB",
  };
}

export const EXPIRATION_RULE_NOTE =
  "expired_* — пользователи, у которых подписка закончилась без продления до момента окончания: " +
  "по журналу subscription_events (последнее событие до даты окончания; отзыв админом тоже считается), " +
  "для истории до журнала — по дате окончания, без аккаунтов, у которых доступа не было вовсе";

async function funnelBlock() {
  const now = Date.now();
  const [trials, renewals, users, exp30] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS trials,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status IN ('confirmed','refunded') AND p.product = 'subscription'
              ))::int AS converted
       FROM users u WHERE u.trial_used_at >= NOW() - INTERVAL '30 days'`
    ),
    // Продления — подписки: пакет трафика продлением не считается.
    pool.query(
      `SELECT COUNT(*)::int AS n FROM payments p
       WHERE p.status IN ('confirmed','refunded') AND p.paid_at >= NOW() - INTERVAL '30 days' AND p.product = 'subscription'
         AND EXISTS (SELECT 1 FROM payments q WHERE q.user_id = p.user_id AND q.status IN ('confirmed','refunded') AND q.product = 'subscription' AND q.paid_at < p.paid_at)`
    ),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE subscription_end > NOW())::int AS live,
              COUNT(*) FILTER (WHERE subscription_end > NOW() AND subscription_plan = 'trial')::int AS live_trial,
              COUNT(*) FILTER (WHERE subscription_end > NOW() AND subscription_plan IN ('basic','plus'))::int AS live_paid,
              COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_7d
       FROM users`
    ),
    getExpirations(new Date(now - 30 * 86400000)),
  ]);
  const distinct = (sinceMs: number) => new Set(exp30.filter((e) => e.endedAt.getTime() >= sinceMs).map((e) => e.userId)).size;
  const t = trials.rows[0];
  return {
    trials30d: t.trials,
    trialsConverted30d: t.converted,
    trialConversionRate: t.trials > 0 ? Math.round((t.converted / t.trials) * 1000) / 10 : null,
    renewals30d: renewals.rows[0].n,
    users: { ...users.rows[0], expired_7d: distinct(now - 7 * 86400000), expired_30d: distinct(now - 30 * 86400000) },
    note: EXPIRATION_RULE_NOTE,
  };
}

async function ledgerBlock() {
  const r = await pool.query<{ kind: string; n: number }>(
    "SELECT kind, COUNT(*)::int AS n FROM subscription_events WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY kind"
  );
  return Object.fromEntries(r.rows.map((x) => [x.kind, x.n]));
}

async function botBlock() {
  return { enabled: await isBotSyncEnabled() };
}

export async function buildOverview() {
  const [panel, db, sync, revenue, funnel, ledger, healthHistory, worker, bot] = await Promise.allSettled([
    panelBlock(),
    dbBlock(),
    syncBlock(),
    revenueBlock(),
    funnelBlock(),
    ledgerBlock(),
    getHealthHistory(),
    getWorkerStatus(),
    botBlock(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    panel: settled(panel),
    db: settled(db),
    sync: settled(sync),
    revenue: settled(revenue),
    funnel: settled(funnel),
    ledger30d: settled(ledger),
    healthHistory: settled(healthHistory),
    worker: settled(worker),
    bot: settled(bot),
  };
}

export type OverviewData = Awaited<ReturnType<typeof buildOverview>>;

export const OVERVIEW_TTL_MS = 30_000;
const g = globalThis as unknown as { __atlasOverviewCache?: ReturnType<typeof createTtlCache<OverviewData>> };

export function overviewCache() {
  if (!g.__atlasOverviewCache) g.__atlasOverviewCache = createTtlCache<OverviewData>(OVERVIEW_TTL_MS);
  return g.__atlasOverviewCache;
}

export async function getOverview(opts: { fresh?: boolean } = {}) {
  const r = await overviewCache().get(buildOverview, opts);
  return { ...r.data, cached: r.cached, cachedAt: new Date(r.cachedAt).toISOString() };
}
