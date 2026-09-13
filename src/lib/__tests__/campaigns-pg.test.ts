/**
 * Те же сценарии очереди рассылок — на настоящем Postgres (SQL
 * campaigns-pg.ts, миграции db.ts, журнал подписки). Запускается, только
 * если задан CAMPAIGNS_TEST_PG_URL (отдельная пустая база: таблицы
 * users/email_* очищаются перед каждым сценарием). Иначе — пропуск.
 *
 *   CAMPAIGNS_TEST_PG_URL=postgresql://atlas:atlas@localhost:55433/atlas npx vitest run campaigns-pg
 */

import { describe, beforeAll, afterAll } from "vitest";
import { defineCampaignScenarios, type Harness } from "./campaign-scenarios";

const PG = process.env.CAMPAIGNS_TEST_PG_URL;
const DAY = 86_400_000;

describe.skipIf(!PG)("очередь рассылок (Postgres)", () => {
  const holder: { h?: Harness } = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = PG;
    const db = await import("../db");
    await db.ensureDb();
    const engine = await import("../campaigns");
    const { pgCampaignRepo } = await import("../campaigns-pg");
    const pool = db.pool;
    let n = 0;
    holder.h = {
      engine,
      repo: pgCampaignRepo,
      async reset() {
        await pool.query("TRUNCATE users, email_campaigns, notifications CASCADE");
        n = 0;
      },
      async seedUser(u) {
        await pool.query(
          `INSERT INTO users (id, email, subscription_end, subscription_plan, referral_code, marketing_consent_at, marketing_opt_out_at, public_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            u.id,
            u.email,
            new Date(Date.now() + u.endInDays * DAY),
            u.plan ?? "trial",
            `R${u.id}`,
            u.consent ? new Date() : null,
            u.optOut ? new Date() : null,
            u.publicId ?? null,
            new Date(Date.now() - ++n * 1000),
          ]
        );
      },
      async user(id) {
        const r = await pool.query("SELECT subscription_end, subscription_plan, unsubscribe_token FROM users WHERE id = $1", [id]);
        return { end: new Date(r.rows[0].subscription_end), plan: r.rows[0].subscription_plan, token: r.rows[0].unsubscribe_token };
      },
      async events() {
        return (await pool.query("SELECT user_id, kind, source_id FROM subscription_events")).rows;
      },
      async notifications() {
        return (await pool.query("SELECT id, target FROM notifications ORDER BY id")).rows;
      },
      async delivery(cid, uid) {
        const r = await pool.query(
          "SELECT status, attempts, batch_id, granted_at, notified_at, next_attempt_at FROM email_deliveries WHERE campaign_id = $1 AND user_id = $2",
          [cid, uid]
        );
        return r.rows[0] ?? null;
      },
      async setOptOut(id) {
        await pool.query("UPDATE users SET marketing_opt_out_at = NOW(), marketing_consent_at = NULL WHERE id = $1", [id]);
      },
      async clearGranted(cid, uid) {
        await pool.query("UPDATE email_deliveries SET granted_at = NULL WHERE campaign_id = $1 AND user_id = $2", [cid, uid]);
      },
    };
  }, 60_000);

  afterAll(async () => {
    const db = await import("../db");
    await db.pool.end();
  });

  defineCampaignScenarios(() => holder.h!);
});
