import { Pool } from "pg";
import { backfillTelegramLinkTokens } from "./tokens";
import { WARN_ACTIONS } from "./audit-level";

const globalPool = globalThis as unknown as { __pgPool?: Pool };

if (!globalPool.__pgPool) {
  globalPool.__pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DATABASE_URL?.includes("sslmode=require") || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

export const pool = globalPool.__pgPool;

/** Initialize database tables. Every statement is additive and idempotent. */
export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      subscription_end TIMESTAMPTZ NOT NULL,
      vpn_key TEXT,
      xray_uuid TEXT,
      sub_token TEXT UNIQUE,
      sub_id TEXT UNIQUE,
      telegram_id TEXT,
      password_hash TEXT,
      key_regen_count INTEGER NOT NULL DEFAULT 0,
      key_regen_window_start TIMESTAMPTZ,
      telegram_linked BOOLEAN NOT NULL DEFAULT FALSE,
      telegram_link_token TEXT UNIQUE,
      registration_ip TEXT,
      referral_code TEXT UNIQUE NOT NULL,
      referred_by TEXT,
      referrals INTEGER NOT NULL DEFAULT 0,
      paid_referrals INTEGER NOT NULL DEFAULT 0,
      subscription_plan TEXT NOT NULL DEFAULT 'trial',
      balance INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
    CREATE INDEX IF NOT EXISTS idx_users_subscription_end ON users(subscription_end);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      transaction_id TEXT,
      plan TEXT NOT NULL,
      period INTEGER NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'RUB',
      status TEXT NOT NULL DEFAULT 'pending',
      redirect_url TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT 'all',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      user_id TEXT NOT NULL REFERENCES users(id),
      notification_id TEXT NOT NULL REFERENCES notifications(id),
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, notification_id)
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

    CREATE TABLE IF NOT EXISTS contact_requests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      interest TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_contact_created ON contact_requests(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_requests(status);

    -- Отклики на вакансии (19.09.2026). Файл резюме лежит здесь же,
    -- в BYTEA: файловая система Railway живёт до следующей выкладки,
    -- а резюме должно пережить её. Размер ограничен на входе
    -- (RESUME_MAX_MB в careers.ts), так что таблица не разрастётся.
    CREATE TABLE IF NOT EXISTS job_applications (
      id TEXT PRIMARY KEY,
      vacancy_id TEXT NOT NULL,
      vacancy_title TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      contact TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_jobapp_created ON job_applications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobapp_status ON job_applications(status);

    -- Вложения форм — одно место на все формы сайта (19.09.2026).
    -- Резюме на вакансию лежало прямо в job_applications. Как только
    -- файл понадобился второй форме, стало ясно: хранить вложение в
    -- таблице своей формы — значит заводить новую колонку BYTEA на
    -- каждую следующую. Здесь source + entity_id указывают на запись
    -- любой формы, а админка читает вложения одним запросом и не
    -- знает, откуда они.
    CREATE TABLE IF NOT EXISTS form_attachments (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_form_att_entity ON form_attachments(source, entity_id);
    CREATE INDEX IF NOT EXISTS idx_form_att_created ON form_attachments(created_at DESC);

    CREATE TABLE IF NOT EXISTS passkey_credentials (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      credential_id TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter BIGINT NOT NULL DEFAULT 0,
      device_name TEXT,
      transports TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkey_credentials(user_id);
    CREATE INDEX IF NOT EXISTS idx_passkey_cred ON passkey_credentials(credential_id);

    CREATE TABLE IF NOT EXISTS balance_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      source TEXT,
      description TEXT,
      related_user_id TEXT,
      synced_to_bot BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_balance_tx_user ON balance_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_balance_tx_created ON balance_transactions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_balance_tx_unsynced ON balance_transactions(user_id, synced_to_bot) WHERE synced_to_bot = FALSE;

    CREATE TABLE IF NOT EXISTS referral_rewards (
      id TEXT PRIMARY KEY,
      referrer_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      purchase_id TEXT,
      purchase_amount INTEGER NOT NULL,
      percent INTEGER NOT NULL,
      reward_amount INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_unique ON referral_rewards(buyer_id, purchase_id);

    CREATE TABLE IF NOT EXISTS trial_blocklist (
      email_normalized TEXT PRIMARY KEY,
      ip TEXT,
      device_fingerprint TEXT,
      trial_count INTEGER NOT NULL DEFAULT 1,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_trial_blocklist_ip ON trial_blocklist(ip, first_seen_at);

    CREATE TABLE IF NOT EXISTS kv_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    );
  `);

  // ─── Migrations: additive + idempotent. A failure is logged with the
  //     statement and reported at the end — never swallowed. ───
  const migrations = [
    // Чем человек доказал, что аккаунт его: код из письма, пароль,
    // passkey или Telegram (аудит безопасности 19.09.2026). Без этого
    // «свежая сессия» считалась доказательством владения почтой, кем
    // бы она ни была открыта, и пароль можно было сменить не зная
    // старого.
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method TEXT",
    // Резюме переезжают из job_applications в form_attachments — один
    // раз и только если старые колонки ещё есть. Проверка колонки
    // нужна потому, что миграции прогоняются на каждом запуске: без
    // неё запрос после переезда падал бы вечно и писал ошибку в лог.
    `DO $do$
     BEGIN
       IF EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_name = 'job_applications' AND column_name = 'resume_data'
       ) THEN
         INSERT INTO form_attachments (id, source, entity_id, filename, mime, size, data, created_at)
         SELECT id, 'career', id, resume_name, resume_type, resume_size, resume_data, created_at
           FROM job_applications
          WHERE resume_data IS NOT NULL
         ON CONFLICT (id) DO NOTHING;

         ALTER TABLE job_applications
           DROP COLUMN resume_data,
           DROP COLUMN resume_name,
           DROP COLUMN resume_type,
           DROP COLUMN resume_size;
       END IF;
     END
     $do$;`,
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS key_regen_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS key_regen_window_start TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_token TEXT UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS device_fingerprint TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_token TEXT UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS sub_id TEXT UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'trial'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE balance_transactions ADD COLUMN IF NOT EXISTS synced_to_bot BOOLEAN NOT NULL DEFAULT TRUE",
    // ── Remnawave integration ──
    // Historical name: holds the panel's integer user id as text (3.x has no user uuid).
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS remnawave_user_uuid TEXT UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS remnawave_short_uuid TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_url TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS happ_crypto_link TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS crypto_link_updated_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
    // Legacy 8-char hex id; some old panel users carry it as username.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_id TEXT UNIQUE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_username TEXT",
    // "ST" + 8-digit sequence — the panel username of site users.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE",
    "CREATE SEQUENCE IF NOT EXISTS user_public_id_seq START 1",
    // ── Payments lifecycle ──
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS applied_to_remnawave_at TIMESTAMPTZ",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_logged_at TIMESTAMPTZ",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_kopeks INTEGER",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_code TEXT",
    // ── Phase 1 (12.09.2026): panel sync state, ledger, bonuses ──
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_user_id BIGINT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_panel_user_id ON users(panel_user_id) WHERE panel_user_id IS NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_sync_state TEXT NOT NULL DEFAULT 'pending'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_sync_attempts INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_next_sync_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_sync_error TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_synced_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_status TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS panel_expire_at TIMESTAMPTZ",
    "CREATE INDEX IF NOT EXISTS idx_users_panel_sync ON users(panel_sync_state, panel_next_sync_at)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_bonus_granted_at TIMESTAMPTZ",
    // Set on the BUYER the first time a paid purchase counts toward the
    // referrer's paid_referrals — makes that counter "unique referees".
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_paid_counted_at TIMESTAMPTZ",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS refund_id TEXT",
    `CREATE TABLE IF NOT EXISTS subscription_events (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL REFERENCES users(id),
       kind TEXT NOT NULL,
       source_id TEXT NOT NULL,
       days NUMERIC(12,4),
       old_end TIMESTAMPTZ,
       new_end TIMESTAMPTZ,
       plan TEXT,
       actor TEXT,
       meta JSONB,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE (kind, source_id)
     )`,
    "CREATE INDEX IF NOT EXISTS idx_sub_events_user ON subscription_events(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_sub_events_kind_created ON subscription_events(kind, created_at DESC)",
    `CREATE TABLE IF NOT EXISTS telegram_bonus_claims (
       telegram_id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL REFERENCES users(id),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS panel_webhook_events (
       dedupe_key TEXT PRIMARY KEY,
       event TEXT NOT NULL,
       received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    "CREATE INDEX IF NOT EXISTS idx_trial_blocklist_fp ON trial_blocklist(device_fingerprint, first_seen_at)",
    // ── Phase 2 (admin): journal level, series indexes, health, worker state ──
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'info'",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_level_created ON audit_logs(level, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at)",
    "CREATE INDEX IF NOT EXISTS idx_payments_refunded_at ON payments(refunded_at) WHERE refunded_at IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_users_trial_used_at ON users(trial_used_at) WHERE trial_used_at IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_sub_events_new_end ON subscription_events(new_end)",
    `CREATE TABLE IF NOT EXISTS health_samples (
       ts TIMESTAMPTZ PRIMARY KEY DEFAULT NOW(),
       panel_ms INTEGER,
       panel_ok BOOLEAN NOT NULL,
       db_ms INTEGER,
       nodes_online INTEGER,
       nodes_total INTEGER,
       queue_pending INTEGER NOT NULL DEFAULT 0,
       queue_error INTEGER NOT NULL DEFAULT 0
     )`,
    `CREATE TABLE IF NOT EXISTS worker_state (
       key TEXT PRIMARY KEY,
       value JSONB,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    // ── Security (13.09.2026): server-side sessions ──
    // The cookie holds a random token; only its SHA-256 is stored here.
    `CREATE TABLE IF NOT EXISTS sessions (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       token_hash TEXT NOT NULL UNIQUE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       expires_at TIMESTAMPTZ NOT NULL,
       ip TEXT,
       user_agent TEXT,
       revoked_at TIMESTAMPTZ
     )`,
    "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL",
    "CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)",
    // ── Security (13.09.2026): Telegram sign-in nonces ──
    // Used to be created lazily by /api/bot/auth-login. Now the SITE
    // creates the nonce (bound to the browser by browser_hash); the bot
    // can only confirm an existing pending one.
    `CREATE TABLE IF NOT EXISTS telegram_auth_nonces (
       nonce TEXT PRIMARY KEY,
       user_id TEXT,
       telegram_id TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       expires_at TIMESTAMPTZ NOT NULL,
       used BOOLEAN NOT NULL DEFAULT FALSE
     )`,
    "ALTER TABLE telegram_auth_nonces ALTER COLUMN user_id DROP NOT NULL",
    "ALTER TABLE telegram_auth_nonces ALTER COLUMN telegram_id DROP NOT NULL",
    "ALTER TABLE telegram_auth_nonces ADD COLUMN IF NOT EXISTS browser_hash TEXT",
    "ALTER TABLE telegram_auth_nonces ADD COLUMN IF NOT EXISTS confirm_code TEXT",
    "ALTER TABLE telegram_auth_nonces ADD COLUMN IF NOT EXISTS request_ip TEXT",
    "ALTER TABLE telegram_auth_nonces ADD COLUMN IF NOT EXISTS request_ua TEXT",
    "ALTER TABLE telegram_auth_nonces ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ",
    "CREATE INDEX IF NOT EXISTS idx_tg_nonces_expires ON telegram_auth_nonces(expires_at)",
    // ── Telegram ↔ site linking, one key per person (13.09.2026) ──
    // docs/bot/TZ_BOT_EMAIL_LINK.md. link_kept: which panel entity survived
    // the merge (bot | site | only-bot | only-site | none | adopted);
    // link_panel_state: panel writes still owed by the sync worker
    // ('pending' after a link, 'unlink_pending' after an unlink, 'ok').
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS link_kept TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS link_disabled_panel_user_id BIGINT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS link_disable_ids BIGINT[]",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS link_panel_state TEXT",
    // Bypass (обход) panel entity of this person — the bot's `{telegram_id}`
    // user for now; site-sold bypass (`ST…_bp`) plugs in here later.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bypass_panel_user_id BIGINT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_bypass_panel_user_id ON users(bypass_panel_user_id) WHERE bypass_panel_user_id IS NOT NULL",
    // Email codes for linking from the bot — separate from the site's
    // sign-in codes; only a salted SHA-256 of the code is stored.
    `CREATE TABLE IF NOT EXISTS bot_email_codes (
       telegram_id TEXT PRIMARY KEY,
       email TEXT NOT NULL,
       code_salt TEXT NOT NULL,
       code_hash TEXT NOT NULL,
       attempts INTEGER NOT NULL DEFAULT 0,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       expires_at TIMESTAMPTZ NOT NULL,
       request_ip TEXT
     )`,
    // One-time "link Telegram" tokens from the dashboard (SHA-256 stored).
    `CREATE TABLE IF NOT EXISTS telegram_link_tokens (
       token_hash TEXT PRIMARY KEY,
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       expires_at TIMESTAMPTZ NOT NULL,
       used_at TIMESTAMPTZ,
       used_by_telegram_id TEXT
     )`,
    "CREATE INDEX IF NOT EXISTS idx_tg_link_tokens_user ON telegram_link_tokens(user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_tg_link_tokens_expires ON telegram_link_tokens(expires_at)",
    // Idempotent read-modify-write of a bypass traffic limit (merge now,
    // site purchases later): one row per operation id.
    `CREATE TABLE IF NOT EXISTS bypass_traffic_ops (
       op_id TEXT PRIMARY KEY,
       panel_user_id BIGINT NOT NULL,
       add_bytes BIGINT NOT NULL,
       base_limit BIGINT,
       state TEXT NOT NULL DEFAULT 'pending',
       note TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       applied_at TIMESTAMPTZ
     )`,
    // ── «Пакеты трафика» on the site (13.09.2026) ──
    // A payment is either a subscription (plan/period) or a traffic pack.
    // Old rows are subscriptions by default; plan='traffic', period=0
    // for packs (the columns are NOT NULL).
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS product TEXT NOT NULL DEFAULT 'subscription'",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS traffic_pack_id TEXT",
    "ALTER TABLE payments ADD COLUMN IF NOT EXISTS traffic_bytes BIGINT",
    "CREATE INDEX IF NOT EXISTS idx_payments_product_paid ON payments(product, paid_at)",
    // Where the bypass entity came from: 'site' (our ST…_bp, stays with the
    // account on unlink) or 'bot' / NULL (the bot's {telegram_id}).
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bypass_origin TEXT",
    // Last subscriptionUrl of the bypass entity we saw — the cabinet shows
    // key 2 from the DB without waiting for the panel.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bypass_subscription_url TEXT",
    // Bypass traffic ledger — the source of truth for GB the site owes a
    // person (trial 500 MB, paid packs, admin grants). One row per source
    // (id = 'trial:<user>' | 'payment:<payment>' | 'admin:<request>'),
    // applied to the panel by src/lib/bypass-grants.ts; state
    // pending → applied | skipped | conflict. 'seeding' = the grant the
    // entity is being created with (limit = its bytes).
    `CREATE TABLE IF NOT EXISTS bypass_grants (
       id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL REFERENCES users(id),
       kind TEXT NOT NULL,
       bytes BIGINT NOT NULL,
       pack_id TEXT,
       payment_id TEXT,
       actor TEXT,
       note TEXT,
       state TEXT NOT NULL DEFAULT 'pending',
       panel_user_id BIGINT,
       attempts INTEGER NOT NULL DEFAULT 0,
       last_error TEXT,
       next_attempt_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       applied_at TIMESTAMPTZ
     )`,
    "CREATE INDEX IF NOT EXISTS idx_bypass_grants_user ON bypass_grants(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_bypass_grants_due ON bypass_grants(state, next_attempt_at)",
    // ── Рассылки и массовые начисления (13.09.2026) ──
    // Unsubscribe token: 32 CSPRNG bytes (base64url), filled lazily in
    // Node (unsubscribe.ts), never by SQL. Stored in the clear on purpose:
    // the same link has to go into every future letter, and the only
    // thing it can do is switch off marketing mail for that one person.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unsubscribe_token ON users(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_opt_out_at TIMESTAMPTZ",
    // Consent (owner, 13.09.2026): privacy/terms at sign-up (required) and
    // marketing (optional, off by default) — src/lib/consent.ts. Marketing
    // campaigns go only to consent IS NOT NULL AND opt_out IS NULL.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_version TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_consent_source TEXT",
    // `grant` is a reserved word in Postgres — the column is grant_spec
    // ({ plan?, days?, trafficGb? } or NULL); the API field is still `grant`.
    `CREATE TABLE IF NOT EXISTS email_campaigns (
       id TEXT PRIMARY KEY,
       kind TEXT NOT NULL CHECK (kind IN ('service', 'marketing')),
       subject TEXT NOT NULL,
       body_md TEXT NOT NULL,
       audience JSONB NOT NULL,
       channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'site', 'both')),
       grant_spec JSONB,
       status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'sending', 'paused', 'done', 'cancelled')),
       created_by TEXT,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       started_at TIMESTAMPTZ,
       finished_at TIMESTAMPTZ,
       counts JSONB,
       last_error TEXT
     )`,
    "CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status, created_at)",
    // One row per (campaign, person): the primary key is what makes «one
    // letter per person per campaign» hold across retries and restarts.
    // batch_id = the Resend batch the row went out in (its idempotency key);
    // granted_at / notified_at — side effects done before the letter.
    `CREATE TABLE IF NOT EXISTS email_deliveries (
       campaign_id TEXT NOT NULL REFERENCES email_campaigns(id),
       user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       email TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped_optout', 'skipped_no_consent', 'skipped_invalid', 'skipped_placeholder')),
       attempts INTEGER NOT NULL DEFAULT 0,
       last_error TEXT,
       resend_id TEXT,
       sent_at TIMESTAMPTZ,
       batch_id TEXT,
       next_attempt_at TIMESTAMPTZ,
       granted_at TIMESTAMPTZ,
       notified_at TIMESTAMPTZ,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (campaign_id, user_id)
     )`,
    "CREATE INDEX IF NOT EXISTS idx_email_deliveries_sent ON email_deliveries(sent_at) WHERE status = 'sent'",
    "CREATE INDEX IF NOT EXISTS idx_email_deliveries_queue ON email_deliveries(campaign_id, status, next_attempt_at)",
    "CREATE INDEX IF NOT EXISTS idx_email_deliveries_batch ON email_deliveries(campaign_id, batch_id) WHERE batch_id IS NOT NULL",
  ];

  const failed: string[] = [];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      failed.push(sql.split("\n")[0]);
      console.error("[DB] migration failed", { sql: sql.split("\n")[0], error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Backfills are batched/set-based so a first deploy on a big table does
  // not do one round trip per row. Secret values (link tokens) are
  // generated in Node with crypto.randomBytes, 1000 rows per UPDATE —
  // never with SQL random(). Only non-secret values use SQL generation.
  await backfill("telegram_link_token", () => backfillTelegramLinkTokens((sql, params) => pool.query(sql, params)));

  // public_id is not a secret; the sequence keeps it unique.
  await backfill("public_id", async () => {
    const r = await pool.query(
      `UPDATE users SET public_id = 'ST' || LPAD(NEXTVAL('user_public_id_seq')::text, 8, '0')
       WHERE public_id IS NULL`
    );
    return r.rowCount ?? 0;
  });

  // Panel integer id: the old column already holds it as text for users
  // provisioned on 3.x. Non-numeric (2.x UUID) values are left alone —
  // the sync re-discovers those by username.
  await backfill("panel_user_id", async () => {
    const r = await pool.query(
      `UPDATE users SET panel_user_id = remnawave_user_uuid::bigint
       WHERE panel_user_id IS NULL AND remnawave_user_uuid ~ '^[0-9]{1,18}$'`
    );
    return r.rowCount ?? 0;
  });

  await backfill("payments.applied_at", async () => {
    const r = await pool.query(
      `UPDATE payments SET applied_at = COALESCE(paid_at, created_at)
       WHERE applied_at IS NULL AND status = 'confirmed'`
    );
    return r.rowCount ?? 0;
  });

  // Journal levels for rows written before the column existed (set-based,
  // not a secret; idempotent — only rows still at the default are touched).
  await backfill("audit_logs.level", async () => {
    const r = await pool.query(
      `UPDATE audit_logs SET level = CASE WHEN action ~* '(fail|error)' THEN 'error' ELSE 'warn' END
       WHERE level = 'info' AND (action ~* '(fail|error)' OR action = ANY($1))`,
      [WARN_ACTIONS]
    );
    return r.rowCount ?? 0;
  });

  await backfill("referral_paid_counted_at", async () => {
    const r = await pool.query(
      `UPDATE users u SET referral_paid_counted_at = rr.first_at
       FROM (SELECT buyer_id, MIN(created_at) AS first_at FROM referral_rewards GROUP BY buyer_id) rr
       WHERE u.id = rr.buyer_id AND u.referral_paid_counted_at IS NULL`
    );
    return r.rowCount ?? 0;
  });

  // Unique indexes that would fail on existing duplicates: check first,
  // log the duplicates for manual cleanup, never delete data.
  await uniqueIndexIfClean(
    "idx_payments_transaction_id_unique",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id_unique ON payments(transaction_id) WHERE transaction_id IS NOT NULL",
    `SELECT transaction_id AS key, COUNT(*)::int AS n FROM payments
     WHERE transaction_id IS NOT NULL GROUP BY transaction_id HAVING COUNT(*) > 1 LIMIT 50`
  );
  await uniqueIndexIfClean(
    "idx_users_telegram_id_unique",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id_unique ON users(telegram_id) WHERE telegram_id IS NOT NULL",
    `SELECT telegram_id AS key, COUNT(*)::int AS n FROM users
     WHERE telegram_id IS NOT NULL GROUP BY telegram_id HAVING COUNT(*) > 1 LIMIT 50`
  );

  if (failed.length > 0) {
    throw new Error(`[DB] ${failed.length} migration(s) failed: ${failed.join(" | ")}`);
  }
  console.log("[DB] Tables initialized");
}

async function backfill(name: string, fn: () => Promise<number>): Promise<void> {
  try {
    const n = await fn();
    if (n > 0) console.log(`[DB] backfill ${name}: ${n} row(s)`);
  } catch (err) {
    console.error(`[DB] backfill ${name} failed`, err instanceof Error ? err.message : String(err));
  }
}

async function uniqueIndexIfClean(name: string, createSql: string, dupSql: string): Promise<void> {
  try {
    const exists = await pool.query("SELECT 1 FROM pg_indexes WHERE indexname = $1", [name]);
    if (exists.rows.length > 0) return;
    const dups = await pool.query<{ key: string; n: number }>(dupSql);
    if (dups.rows.length > 0) {
      console.error(`[DB] ${name} NOT created — duplicates must be resolved manually:`, JSON.stringify(dups.rows));
      return;
    }
    await pool.query(createSql);
    console.log(`[DB] created ${name}`);
  } catch (err) {
    console.error(`[DB] ${name} failed`, err instanceof Error ? err.message : String(err));
  }
}

/**
 * Schema readiness — initDb() runs once per process (memoized).
 *
 *   dbReady     rejects if any migration failed. The sync worker awaits
 *               it strictly and stays stopped on a half-migrated schema.
 *   waitForDb() waits for migrations to FINISH (success or failure) —
 *               for request paths (payments, sign-in, webhooks), which
 *               must not race the migrations but also must not refuse
 *               every login because one optional statement failed; a
 *               genuinely missing table still fails the query itself.
 */
const globalReady = globalThis as unknown as { __atlasDbReady?: Promise<void> };

export function ensureDb(): Promise<void> {
  if (!globalReady.__atlasDbReady) {
    globalReady.__atlasDbReady = initDb();
    globalReady.__atlasDbReady.catch((err) => {
      console.error("[DB] INITIALIZATION FAILED — panel sync worker will not start:", err);
    });
  }
  return globalReady.__atlasDbReady;
}

export const dbReady: Promise<void> = typeof window === "undefined" ? ensureDb() : Promise.resolve();

export function waitForDb(): Promise<void> {
  return dbReady.then(
    () => undefined,
    () => undefined
  );
}
