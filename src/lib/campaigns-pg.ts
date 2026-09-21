/**
 * Рассылки на Postgres: CampaignRepo для движка (campaigns.ts),
 * начисление ГБ обхода через журнал bypass_grants и проход очереди под
 * advisory lock для воркера (sync-worker.ts, каждые 30 с) и для «пинка»
 * сразу после запуска / возобновления из админки.
 *
 * Аудитория-фильтр — те же SQL-фильтры, что в списке пользователей
 * админки (admin-users.buildUsersQuery): «Истекают» в рассылке значит
 * ровно то же, что в разделе «Пользователи».
 */

import { v4 as uuidv4 } from "uuid";
import { dbReady, pool } from "./db";
import { LOCK_KEYS, withJobLock } from "./locks";
import { buildUsersQuery } from "./admin-users";
import { withTransaction } from "./subscription-ledger";
import { ensureUnsubscribeTokens } from "./unsubscribe";
import { recordWorkerError } from "./worker-state";
import { insertBypassGrant } from "./bypass-ledger";
import { applyBypassGrants, getBypassGrant } from "./bypass-grants";
import { resendMailer } from "./campaign-mailer";
import {
  campaignTrafficGrantId,
  dailyLimit,
  EMPTY_COUNTS,
  runCampaignPass,
  type Audience,
  type AudiencePreview,
  type Campaign,
  type CampaignChannel,
  type CampaignInput,
  type CampaignKind,
  type CampaignRepo,
  type CampaignStatus,
  type DeliveryCounts,
  type DeliveryRow,
  type DeliveryStatus,
  type EngineDeps,
  type GrantSpec,
  type PassSummary,
  type TrafficGranter,
} from "./campaigns";

// ─── Строки → модель ─────────────────────────────────────────────

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const json = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

function toGrant(v: unknown): GrantSpec | null {
  const g = json<Partial<GrantSpec> | null>(v);
  if (!g) return null;
  return { plan: g.plan ?? null, days: g.days ?? null, trafficGb: g.trafficGb ?? null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCampaign(r: any): Campaign {
  return {
    id: r.id,
    kind: r.kind,
    channel: r.channel,
    subject: r.subject,
    bodyMd: r.body_md,
    template: r.template === "gift" ? "gift" : "markdown",
    audience: json<Audience>(r.audience),
    grant: toGrant(r.grant_spec),
    status: r.status,
    createdBy: r.created_by ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at ?? r.created_at).toISOString(),
    startedAt: iso(r.started_at),
    finishedAt: iso(r.finished_at),
    counts: r.counts ? json<DeliveryCounts>(r.counts) : null,
    lastError: r.last_error ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDelivery(r: any): DeliveryRow {
  return {
    userId: r.user_id,
    email: r.email,
    status: r.status,
    attempts: Number(r.attempts ?? 0),
    batchId: r.batch_id ?? null,
    token: r.unsubscribe_token ?? null,
    subscriptionEnd: new Date(r.subscription_end),
    plan: r.subscription_plan ?? null,
    grantedAt: r.granted_at ? new Date(r.granted_at) : null,
    notifiedAt: r.notified_at ? new Date(r.notified_at) : null,
    locale: r.locale ?? null,
  };
}

// ─── Аудитория ───────────────────────────────────────────────────

const PLACEHOLDER_SQL = "(u.email ~* '^telegram_[0-9]+@tg[.]')";
const DELIVERABLE_SQL = "(length(u.email) <= 254 AND u.email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')";

/** То же правило, что deliveryStatusFor в campaigns.ts. */
function statusCase(kind: string, channel: string): string {
  return `CASE
      WHEN ${kind}::text = 'marketing' AND u.marketing_opt_out_at IS NOT NULL THEN 'skipped_optout'
      WHEN ${kind}::text = 'marketing' AND u.marketing_consent_at IS NULL THEN 'skipped_no_consent'
      WHEN ${channel}::text <> 'site' AND ${PLACEHOLDER_SQL} THEN 'skipped_placeholder'
      WHEN ${channel}::text <> 'site' AND NOT ${DELIVERABLE_SQL} THEN 'skipped_invalid'
      ELSE 'queued' END`;
}

function splitList(entries: string[]) {
  const emails = entries.filter((e) => e.includes("@")).map((e) => e.toLowerCase());
  const ids = entries.filter((e) => !e.includes("@"));
  return { emails, ids, pids: ids.map((x) => x.toUpperCase()) };
}

/** Подзапрос с колонкой id и его параметры ($1…$n). */
function audienceIds(aud: Audience): { sql: string; values: unknown[] } {
  if (aud.type === "filter") {
    const q = buildUsersQuery({ q: aud.q, filter: aud.filter, sort: "new", limit: null, offset: 0, paginated: false }).list;
    return { sql: `SELECT aud.id FROM (${q.sql}) aud`, values: q.values };
  }
  const l = splitList(aud.entries);
  return {
    sql: "SELECT u0.id FROM users u0 WHERE lower(u0.email) = ANY($1::text[]) OR u0.id = ANY($2::text[]) OR upper(u0.public_id) = ANY($3::text[])",
    values: [l.emails, l.ids, l.pids],
  };
}

function recipients(aud: Audience, kind: CampaignKind, channel: CampaignChannel): { sql: string; values: unknown[]; next: number } {
  const a = audienceIds(aud);
  const k = `$${a.values.length + 1}`;
  const ch = `$${a.values.length + 2}`;
  const sql = `WITH r AS (
      SELECT u.id, u.email, u.subscription_end, u.subscription_plan, u.created_at, u.marketing_opt_out_at, ${statusCase(k, ch)} AS st
      FROM users u WHERE u.id IN (${a.sql})
    )`;
  return { sql, values: [...a.values, kind, channel], next: a.values.length + 3 };
}

const DELIVERY_COLS = `d.user_id, d.email, d.status, d.attempts, d.batch_id, d.granted_at, d.notified_at,
       u.unsubscribe_token, u.subscription_end, u.subscription_plan, u.locale`;
const OPEN_STATUSES = "('queued', 'skipped_invalid', 'skipped_placeholder')";

// ─── Репозиторий ─────────────────────────────────────────────────

export const pgCampaignRepo: CampaignRepo = {
  async create(input: CampaignInput, createdBy: string | null) {
    const r = await pool.query(
      `INSERT INTO email_campaigns (id, kind, subject, body_md, audience, channel, grant_spec, created_by, template)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [uuidv4(), input.kind, input.subject, input.bodyMd, JSON.stringify(input.audience), input.channel, input.grant ? JSON.stringify(input.grant) : null, createdBy, input.template ?? "markdown"]
    );
    return rowToCampaign(r.rows[0]);
  },

  async updateDraft(id: string, input: CampaignInput) {
    const r = await pool.query(
      `UPDATE email_campaigns SET kind = $2, subject = $3, body_md = $4, audience = $5, channel = $6, grant_spec = $7,
         template = $8, updated_at = NOW()
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [id, input.kind, input.subject, input.bodyMd, JSON.stringify(input.audience), input.channel, input.grant ? JSON.stringify(input.grant) : null, input.template ?? "markdown"]
    );
    return r.rows[0] ? rowToCampaign(r.rows[0]) : null;
  },

  async get(id: string) {
    const r = await pool.query("SELECT * FROM email_campaigns WHERE id = $1", [id]);
    return r.rows[0] ? rowToCampaign(r.rows[0]) : null;
  },

  async list(limit: number) {
    const r = await pool.query("SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT $1", [limit]);
    return r.rows.map(rowToCampaign);
  },

  async transition(id: string, from: CampaignStatus[], to: CampaignStatus, patch = {}) {
    const r = await pool.query(
      `UPDATE email_campaigns SET status = $3, updated_at = NOW(),
         started_at = CASE WHEN $4::boolean THEN COALESCE(started_at, NOW()) ELSE started_at END,
         finished_at = CASE WHEN $5::boolean THEN NOW() ELSE finished_at END,
         last_error = CASE WHEN $6::boolean THEN $7::text ELSE last_error END
       WHERE id = $1 AND status = ANY($2::text[]) RETURNING *`,
      [id, from, to, !!patch.started, !!patch.finished, patch.lastError !== undefined, patch.lastError ?? null]
    );
    return r.rows[0] ? rowToCampaign(r.rows[0]) : null;
  },

  async setLastError(id: string, error: string | null) {
    await pool.query("UPDATE email_campaigns SET last_error = $2, updated_at = NOW() WHERE id = $1", [id, error]);
  },

  async saveCounts(id: string, counts: DeliveryCounts) {
    await pool.query("UPDATE email_campaigns SET counts = $2 WHERE id = $1", [id, JSON.stringify(counts)]);
  },

  async counts(c: Campaign) {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
              COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
              COUNT(*) FILTER (WHERE status = 'skipped_optout')::int AS skipped_optout,
              COUNT(*) FILTER (WHERE status = 'skipped_no_consent')::int AS skipped_no_consent,
              COUNT(*) FILTER (WHERE status = 'skipped_invalid')::int AS skipped_invalid,
              COUNT(*) FILTER (WHERE status = 'skipped_placeholder')::int AS skipped_placeholder,
              COUNT(granted_at)::int AS granted,
              COUNT(*) FILTER (WHERE $2::boolean AND granted_at IS NULL AND status IN ${OPEN_STATUSES})::int AS grant_pending,
              COUNT(notified_at)::int AS notified
       FROM email_deliveries WHERE campaign_id = $1`,
      [c.id, !!c.grant]
    );
    return { ...EMPTY_COUNTS, ...(r.rows[0] ?? {}) } as DeliveryCounts;
  },

  async failures(id: string, limit: number) {
    const r = await pool.query(
      `SELECT email, status, last_error, attempts FROM email_deliveries
       WHERE campaign_id = $1 AND (status = 'failed' OR last_error IS NOT NULL)
       ORDER BY (status = 'failed') DESC, user_id LIMIT $2`,
      [id, limit]
    );
    return r.rows.map((x) => ({ email: x.email as string, status: x.status as DeliveryStatus, error: (x.last_error as string | null) ?? null, attempts: Number(x.attempts) }));
  },

  async previewAudience(aud: Audience, kind: CampaignKind, channel: CampaignChannel): Promise<AudiencePreview> {
    const r = recipients(aud, kind, channel);
    const [grouped, sample] = await Promise.all([
      pool.query(`${r.sql} SELECT st, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE marketing_opt_out_at IS NOT NULL)::int AS opted FROM r GROUP BY st`, r.values),
      pool.query(`${r.sql} SELECT id, email, subscription_end, subscription_plan FROM r WHERE st = 'queued' ORDER BY created_at DESC, id LIMIT 20`, r.values),
    ]);
    const byStatus = { queued: 0, skipped_optout: 0, skipped_no_consent: 0, skipped_invalid: 0, skipped_placeholder: 0 };
    let total = 0;
    let optedOut = 0;
    for (const g of grouped.rows) {
      byStatus[g.st as keyof typeof byStatus] = Number(g.n);
      total += Number(g.n);
      optedOut += Number(g.opted);
    }
    let notFound: string[] = [];
    if (aud.type === "list") {
      const l = splitList(aud.entries);
      const m = await pool.query(
        "SELECT lower(email) AS email, id, upper(public_id) AS pid FROM users WHERE lower(email) = ANY($1::text[]) OR id = ANY($2::text[]) OR upper(public_id) = ANY($3::text[])",
        [l.emails, l.ids, l.pids]
      );
      const seen = new Set<string>();
      for (const x of m.rows) {
        seen.add(String(x.email));
        seen.add(String(x.id));
        if (x.pid) seen.add(String(x.pid));
      }
      notFound = aud.entries.filter((e) => !seen.has(e.includes("@") ? e.toLowerCase() : e) && !seen.has(e.toUpperCase()));
    }
    const f = sample.rows[0];
    return {
      total,
      byStatus,
      optedOut,
      notFound,
      sample: sample.rows.map((x) => String(x.email)),
      first: f ? { userId: f.id, email: f.email, subscriptionEnd: new Date(f.subscription_end), plan: f.subscription_plan ?? null } : null,
    };
  },

  async queueCampaign(id: string) {
    return withTransaction(async (c) => {
      const cur = await c.query("SELECT * FROM email_campaigns WHERE id = $1 FOR UPDATE", [id]);
      if (!cur.rows[0] || cur.rows[0].status !== "draft") return null;
      const camp = rowToCampaign(cur.rows[0]);
      const r = recipients(camp.audience, camp.kind, camp.channel);
      const ins = await c.query(
        `${r.sql} INSERT INTO email_deliveries (campaign_id, user_id, email, status)
         SELECT $${r.next}, id, email, st FROM r
         ON CONFLICT (campaign_id, user_id) DO NOTHING`,
        [...r.values, id]
      );
      const upd = await c.query("UPDATE email_campaigns SET status = 'queued', started_at = NOW(), updated_at = NOW(), last_error = NULL WHERE id = $1 RETURNING *", [id]);
      return { campaign: rowToCampaign(upd.rows[0]), inserted: ins.rowCount ?? 0 };
    });
  },

  async active() {
    const r = await pool.query("SELECT * FROM email_campaigns WHERE status IN ('queued', 'sending') ORDER BY created_at ASC LIMIT 20");
    return r.rows.map(rowToCampaign);
  },

  async sideEffectsDue(c: Campaign, now: Date, limit: number) {
    const r = await pool.query(
      `SELECT ${DELIVERY_COLS}
       FROM email_deliveries d JOIN users u ON u.id = d.user_id
       WHERE d.campaign_id = $1 AND d.status IN ${OPEN_STATUSES}
         AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= $2)
         AND (($3::boolean AND d.granted_at IS NULL)
              OR (d.notified_at IS NULL AND ($4::boolean OR ($3::boolean AND d.status IN ('skipped_invalid', 'skipped_placeholder'))))
              OR ($5::boolean AND d.status = 'queued'))
       ORDER BY d.user_id LIMIT $6`,
      [c.id, now, !!c.grant, c.channel !== "email", c.channel === "site", limit]
    );
    return r.rows.map(rowToDelivery);
  },

  async markGranted(id: string, userId: string, at: Date) {
    await pool.query("UPDATE email_deliveries SET granted_at = $3, last_error = NULL, next_attempt_at = NULL WHERE campaign_id = $1 AND user_id = $2", [id, userId, at]);
  },

  async markNotified(id: string, userId: string, at: Date) {
    await pool.query("UPDATE email_deliveries SET notified_at = $3 WHERE campaign_id = $1 AND user_id = $2", [id, userId, at]);
  },

  async insertNotification(notificationId: string, userId: string, title: string, message: string) {
    const r = await pool.query(
      "INSERT INTO notifications (id, title, message, target) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING RETURNING id",
      [notificationId, title, message, userId]
    );
    if (r.rows.length === 0) return false;
    import("./push")
      .then(({ sendPushToUser }) => sendPushToUser(userId, title, message))
      .catch((err) => console.warn("[CAMPAIGNS] push failed:", err instanceof Error ? err.message : err));
    return true;
  },

  async markSiteSent(id: string, userId: string, at: Date) {
    await pool.query("UPDATE email_deliveries SET status = 'sent', sent_at = $3 WHERE campaign_id = $1 AND user_id = $2 AND status = 'queued'", [id, userId, at]);
  },

  async skipIneligibleMarketing(id: string) {
    const r = await pool.query(
      `UPDATE email_deliveries d
       SET status = CASE WHEN u.marketing_opt_out_at IS NOT NULL THEN 'skipped_optout' ELSE 'skipped_no_consent' END
       FROM users u
       WHERE d.campaign_id = $1 AND d.status = 'queued' AND u.id = d.user_id
         AND (u.marketing_opt_out_at IS NOT NULL OR u.marketing_consent_at IS NULL)`,
      [id]
    );
    return r.rowCount ?? 0;
  },

  async sentEmailsSince(since: Date) {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM email_deliveries d JOIN email_campaigns c ON c.id = d.campaign_id
       WHERE d.status = 'sent' AND d.sent_at > $1 AND c.channel IN ('email', 'both')`,
      [since]
    );
    return Number(r.rows[0]?.n ?? 0);
  },

  async queuedEmails(excludeId: string | null) {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM email_deliveries d JOIN email_campaigns c ON c.id = d.campaign_id
       WHERE d.status = 'queued' AND c.status IN ('queued', 'sending') AND c.channel IN ('email', 'both')
         AND ($1::text IS NULL OR c.id <> $1)`,
      [excludeId]
    );
    return Number(r.rows[0]?.n ?? 0);
  },

  async claimBatch(c: Campaign, max: number, now: Date) {
    // Сначала — пачка, уже отправлявшаяся (повтор после ошибки или
    // рестарта): тот же состав, тот же ключ идемпотентности.
    const due = await pool.query(
      `SELECT batch_id FROM email_deliveries
       WHERE campaign_id = $1 AND status = 'queued' AND batch_id IS NOT NULL
         AND (next_attempt_at IS NULL OR next_attempt_at <= $2)
       ORDER BY batch_id LIMIT 1`,
      [c.id, now]
    );
    let batchId: string | null = due.rows[0]?.batch_id ?? null;
    if (!batchId) {
      batchId = uuidv4();
      const r = await pool.query(
        `UPDATE email_deliveries SET batch_id = $3
         WHERE campaign_id = $1 AND user_id IN (
           SELECT user_id FROM email_deliveries
           WHERE campaign_id = $1 AND status = 'queued' AND batch_id IS NULL
             AND (next_attempt_at IS NULL OR next_attempt_at <= $2)
             AND (NOT $5::boolean OR granted_at IS NOT NULL)
             AND (NOT $6::boolean OR notified_at IS NOT NULL)
           ORDER BY user_id LIMIT $4)`,
        [c.id, now, batchId, max, !!c.grant, c.channel === "both"]
      );
      if (!r.rowCount) return [];
    }
    const rows = await pool.query(
      `SELECT ${DELIVERY_COLS}
       FROM email_deliveries d JOIN users u ON u.id = d.user_id
       WHERE d.campaign_id = $1 AND d.batch_id = $2 AND d.status = 'queued'
       ORDER BY d.user_id`,
      [c.id, batchId]
    );
    return rows.rows.map(rowToDelivery);
  },

  async releaseBatch(id: string, batchId: string) {
    await pool.query("UPDATE email_deliveries SET batch_id = NULL WHERE campaign_id = $1 AND batch_id = $2 AND status = 'queued'", [id, batchId]);
  },

  async markSent(id: string, sent: Array<{ userId: string; resendId: string | null }>, at: Date) {
    if (sent.length === 0) return;
    await pool.query(
      `UPDATE email_deliveries AS d
       SET status = 'sent', sent_at = $2, resend_id = v.rid, attempts = d.attempts + 1, last_error = NULL, next_attempt_at = NULL
       FROM (SELECT unnest($3::text[]) AS uid, unnest($4::text[]) AS rid) AS v
       WHERE d.campaign_id = $1 AND d.user_id = v.uid AND d.status = 'queued'`,
      [id, at, sent.map((s) => s.userId), sent.map((s) => s.resendId)]
    );
  },

  async markRetry(id: string, userIds: string[], error: string, nextAt: Date, maxAttempts: number) {
    await pool.query(
      `UPDATE email_deliveries
       SET attempts = attempts + 1, last_error = $3, next_attempt_at = $4,
           status = CASE WHEN attempts + 1 >= $5 THEN 'failed' ELSE status END
       WHERE campaign_id = $1 AND user_id = ANY($2::text[]) AND status IN ${OPEN_STATUSES}`,
      [id, userIds, error.slice(0, 500), nextAt, maxAttempts]
    );
  },

  async markFailed(id: string, userIds: string[], error: string) {
    await pool.query(
      `UPDATE email_deliveries SET status = 'failed', attempts = attempts + 1, last_error = $3
       WHERE campaign_id = $1 AND user_id = ANY($2::text[]) AND status IN ${OPEN_STATUSES}`,
      [id, userIds, error.slice(0, 500)]
    );
  },

  async defer(id: string, userIds: string[], nextAt: Date, error: string) {
    await pool.query(
      `UPDATE email_deliveries SET next_attempt_at = $3, last_error = $4
       WHERE campaign_id = $1 AND user_id = ANY($2::text[]) AND status IN ${OPEN_STATUSES}`,
      [id, userIds, nextAt, error.slice(0, 500)]
    );
  },

  async ensureTokens(userIds: string[]) {
    return ensureUnsubscribeTokens((sql, params) => pool.query(sql, params), userIds);
  },

  async remaining(c: Campaign) {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM email_deliveries
       WHERE campaign_id = $1 AND (
         status = 'queued'
         OR (status IN ('skipped_invalid', 'skipped_placeholder')
             AND (($2::boolean AND (granted_at IS NULL OR notified_at IS NULL)) OR ($3::boolean AND notified_at IS NULL))))`,
      [c.id, !!c.grant, c.channel !== "email"]
    );
    return Number(r.rows[0]?.n ?? 0);
  },

  async userForTest(email: string) {
    const r = await pool.query("SELECT id, email, subscription_end, subscription_plan, unsubscribe_token FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);
    const u = r.rows[0];
    return u ? { userId: u.id, email: u.email, subscriptionEnd: new Date(u.subscription_end), plan: u.subscription_plan ?? null, token: u.unsubscribe_token ?? null } : null;
  },
};

// ─── ГБ обхода: журнал bypass_grants + bypass-grants.ts ──────────

/**
 * Одна строка bypass_grants на (кампания, человек) — id и есть ключ
 * идемпотентности. applyBypassGrants находит сущность обхода или создаёт
 * сайтовую ST…_bp (сквад обхода, 5 устройств, без срока) и прибавляет
 * ГБ через bypass_traffic_ops (op id grant:<id>). Панель недоступна —
 * строка остаётся должной, её дожимает и этот проход, и воркер обхода.
 */
export const bypassTrafficGranter: TrafficGranter = {
  async credit(campaignId, userId, bytes, note) {
    const id = campaignTrafficGrantId(campaignId, userId);
    await withTransaction((c) => insertBypassGrant(c, { id, userId, kind: "admin", bytes, actor: "campaign", note }));
    let g = await getBypassGrant(id);
    if (g && (g.state === "pending" || g.state === "seeding")) {
      await applyBypassGrants(userId);
      g = await getBypassGrant(id);
    }
    if (!g) return { state: "owed", error: "строка начисления не найдена" };
    if (g.state === "applied" || g.state === "skipped") return { state: "done" };
    if (g.state === "conflict") return { state: "conflict", error: g.note };
    return { state: "owed", error: g.lastError };
  },
};

// ─── Проход под замком ───────────────────────────────────────────

export function defaultCampaignDeps(): EngineDeps {
  return { repo: pgCampaignRepo, mailer: resendMailer(), traffic: bypassTrafficGranter, limit: dailyLimit() };
}

const g = globalThis as unknown as { __atlasCampaignPassRunning?: boolean };

export async function runCampaignPassLocked(): Promise<{ acquired: boolean; summary: PassSummary | null }> {
  await dbReady;
  if (g.__atlasCampaignPassRunning) return { acquired: false, summary: null };
  g.__atlasCampaignPassRunning = true;
  try {
    const locked = await withJobLock(LOCK_KEYS.CAMPAIGNS, () => runCampaignPass(defaultCampaignDeps()));
    if (!locked.acquired) return { acquired: false, summary: null };
    const s = locked.result;
    if (s.granted || s.grantPending || s.notified || s.emailed || s.retried || s.failed || s.finished) {
      console.log(
        `[CAMPAIGNS] pass: campaigns=${s.campaigns} granted=${s.granted} pending=${s.grantPending} notified=${s.notified} emailed=${s.emailed} retried=${s.retried} failed=${s.failed} finished=${s.finished}${s.stoppedBy ? ` stop=${s.stoppedBy}` : ""}`
      );
    }
    return { acquired: true, summary: s };
  } catch (err) {
    await recordWorkerError("campaigns", err);
    throw err;
  } finally {
    g.__atlasCampaignPassRunning = false;
  }
}

/** Сразу после запуска / возобновления — не ждать таймер воркера. */
export function kickCampaigns(): void {
  runCampaignPassLocked().catch((err) => console.error("[CAMPAIGNS] pass error:", err instanceof Error ? err.message : err));
}
