// PostgreSQL-backed store for user data.
// Verification codes remain in-memory (ephemeral, 10min TTL).
//
// Subscription end dates change ONLY through the ledger
// (src/lib/subscription-ledger.ts) — never by writing subscription_end
// directly — so every change is idempotent and auditable.

import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { pool, waitForDb } from "./db";
import { TRIAL_DURATION_MS } from "./remnawave";
import { TELEGRAM_BONUS_DAYS } from "./brand-facts";
import { applySubscriptionEvent, DAY, Queryable, withTransaction } from "./subscription-ledger";
import { checkTrialEligibility, recordTrialUsage, TrialBlockReason } from "./trial";
import { generateTelegramLinkToken } from "./tokens";
import { auditLevelFor } from "./audit-level";
import { revokeAllSessions } from "./session-store";
import { grantId, insertBypassGrant } from "./bypass-ledger";
import { TRAFFIC_TRIAL_BYTES } from "./traffic-packs";
import { loyaltyNextTier, loyaltyTierFor } from "./loyalty";
import crypto from "crypto";

// Hard ceiling for direct subscription_end writes through updateUser.
// Ledger events are not subject to it (stacked paid renewals may go
// past 400 days); the ledger caps a single event instead.
const MAX_DIRECT_END_DAYS = 400;

// ─── Types ───────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  createdAt: string;
  /**
   * Язык, на котором человек зарегистрировался. Нужен письмам: сайт
   * двуязычный, а письмо уходит без запроса — спросить язык в этот
   * момент негде. `null` у всех, кто завёлся до английской версии;
   * читатели трактуют его как русский.
   */
  locale: string | null;
  subscriptionEnd: string;
  /** Legacy Xray fields — no longer written; kept so old rows still map. */
  vpnKey: string | null;
  xrayUuid: string | null;
  telegramId: string | null;
  telegramLinked: boolean;
  referralCode: string;
  referredBy: string | null;
  referrals: number;
  paidReferrals: number;
  subscriptionPlan: string;
  subToken: string | null;
  subId: string | null;
  keyRegenCount: number;
  keyRegenWindowStart: string | null;
  telegramLinkToken: string | null;
  registrationIp: string | null;
  balance: number;
  /** Panel integer id as text (historical column name). */
  remnawaveUserUuid: string | null;
  remnawaveShortUuid: string | null;
  subscriptionUrl: string | null;
  /** Always null since 3.x (the panel has no crypto-link endpoint). */
  happCryptoLink: string | null;
  cryptoLinkUpdatedAt: string | null;
  trialUsedAt: string | null;
  panelId: string | null;
  publicId: string | null;
  panelUsername: string | null;
  panelUserId: number | null;
  panelSyncState: string | null;
  panelSyncError: string | null;
  panelStatus: string | null;
  panelSyncedAt: string | null;
  telegramBonusGrantedAt: string | null;
  /** When this account was (last) linked to Telegram through the link flow. */
  telegramLinkedAt: string | null;
  /** Which panel entity survived the link merge (see src/lib/telegram-link.ts). */
  linkKept: string | null;
  linkDisabledPanelUserId: number | null;
  /** Panel writes still owed after a link/unlink ('pending' | 'unlink_pending' | 'ok'). */
  linkPanelState: string | null;
  /** Bypass (обход) panel entity of this person, if known. */
  bypassPanelUserId: number | null;
  /** 'site' — our ST…_bp (stays with the account on unlink); 'bot' / null — the bot's {telegram_id}. */
  bypassOrigin: string | null;
  /** Last seen subscriptionUrl of the bypass entity (cache; the panel is the truth). */
  bypassSubscriptionUrl: string | null;
  emailVerifiedAt: string | null;
}

export interface CodeRecord {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

// ─── Row → UserRecord mapper ────────────────────────────────────

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash ?? null,
    locale: row.locale ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    subscriptionEnd: new Date(row.subscription_end).toISOString(),
    vpnKey: row.vpn_key ?? null,
    xrayUuid: row.xray_uuid ?? null,
    telegramId: row.telegram_id ?? null,
    telegramLinked: !!row.telegram_linked,
    referralCode: row.referral_code,
    referredBy: row.referred_by ?? null,
    referrals: row.referrals ?? 0,
    paidReferrals: row.paid_referrals ?? 0,
    subscriptionPlan: row.subscription_plan || "trial",
    subToken: row.sub_token ?? null,
    subId: row.sub_id ?? null,
    keyRegenCount: row.key_regen_count ?? 0,
    keyRegenWindowStart: iso(row.key_regen_window_start),
    telegramLinkToken: row.telegram_link_token ?? null,
    registrationIp: row.registration_ip ?? null,
    balance: row.balance ?? 0,
    remnawaveUserUuid: row.remnawave_user_uuid ?? null,
    remnawaveShortUuid: row.remnawave_short_uuid ?? null,
    subscriptionUrl: row.subscription_url ?? null,
    happCryptoLink: null,
    cryptoLinkUpdatedAt: null,
    trialUsedAt: iso(row.trial_used_at),
    panelId: row.panel_id ?? null,
    publicId: row.public_id ?? null,
    panelUsername: row.panel_username ?? null,
    panelUserId: row.panel_user_id != null ? Number(row.panel_user_id) : null,
    panelSyncState: row.panel_sync_state ?? null,
    panelSyncError: row.panel_sync_error ?? null,
    panelStatus: row.panel_status ?? null,
    panelSyncedAt: iso(row.panel_synced_at),
    telegramBonusGrantedAt: iso(row.telegram_bonus_granted_at),
    telegramLinkedAt: iso(row.telegram_linked_at),
    linkKept: row.link_kept ?? null,
    linkDisabledPanelUserId: row.link_disabled_panel_user_id != null ? Number(row.link_disabled_panel_user_id) : null,
    linkPanelState: row.link_panel_state ?? null,
    bypassPanelUserId: row.bypass_panel_user_id != null ? Number(row.bypass_panel_user_id) : null,
    bypassOrigin: row.bypass_origin ?? null,
    bypassSubscriptionUrl: row.bypass_subscription_url ?? null,
    emailVerifiedAt: iso(row.email_verified_at),
  };
}

/** Accounts the bot's /api/bot/register created without an email. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && /^telegram_\d+@tg\./i.test(email);
}

/**
 * INSERT a new users row (expired subscription, fresh referral code and
 * legacy link token, next ST public id). Returns the row, or null when
 * the email already exists. The ONE insert used by sign-up, the bot
 * link flow and panel adoption.
 */
export async function insertUserRow(
  c: Queryable,
  input: {
    email: string;
    referredBy?: string | null;
    ip?: string | null;
    fingerprint?: string | null;
    id?: string;
    /** Язык страницы, с которой человек вошёл. */
    locale?: string | null;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const inserted = await c.query(
    `INSERT INTO users (id, email, created_at, subscription_end, referral_code, referred_by,
                        telegram_link_token, registration_ip, device_fingerprint, locale, public_id)
     VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, 'ST' || LPAD(NEXTVAL('user_public_id_seq')::text, 8, '0'))
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [
      input.id ?? uuidv4(),
      input.email,
      new Date(),
      generateReferralCode(),
      input.referredBy || null,
      generateTelegramLinkToken(),
      input.ip || null,
      input.fingerprint || null,
      input.locale || null,
    ]
  );
  return inserted.rows[0] ?? null;
}

// ─── Helpers ─────────────────────────────────────────────────────

function generateReferralCode(): string {
  return uuidv4().slice(0, 8).toUpperCase();
}

// ─── Verification Codes (in-memory, ephemeral) ──────────────────

const globalCodes = globalThis as unknown as { __codes?: Map<string, CodeRecord> };
if (!globalCodes.__codes) {
  globalCodes.__codes = new Map();
}
const codes = globalCodes.__codes;

const MAX_CODE_ATTEMPTS = 5;

/**
 * Неверные попытки по АДРЕСУ, а не по коду (аудит безопасности
 * 19.09.2026).
 *
 * Прежде счётчик жил внутри записи кода, а `saveCode` создавал запись
 * заново — то есть каждый новый запрос кода обнулял бюджет попыток.
 * Пятнадцать писем в сутки давали 75 попыток к шестизначному коду по
 * одному адресу. На одного человека это мало, но разосланное по
 * десяти тысячам адресов давало примерно один захваченный аккаунт в
 * день. Этот счётчик переживает повторную выдачу кода.
 */
const globalFails = globalThis as unknown as { __codeFails?: Map<string, { n: number; until: number }> };
if (!globalFails.__codeFails) globalFails.__codeFails = new Map();
const codeFails = globalFails.__codeFails;

const MAX_CODE_FAILS_PER_EMAIL = 10;
const CODE_FAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

function bumpCodeFailure(email: string): number {
  const now = Date.now();
  const cur = codeFails.get(email);
  if (!cur || now > cur.until) {
    codeFails.set(email, { n: 1, until: now + CODE_FAIL_WINDOW_MS });
    return 1;
  }
  cur.n += 1;
  return cur.n;
}

function codeFailuresExceeded(email: string): boolean {
  const cur = codeFails.get(email);
  return !!cur && Date.now() <= cur.until && cur.n >= MAX_CODE_FAILS_PER_EMAIL;
}

export function saveCode(email: string, code: string): void {
  codes.set(email, {
    email,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
  });
}

/**
 * Ответ один на все неудачи — «код неверный или истёк».
 *
 * Раньше ответы различались: «код не найден», «код истёк», «осталось
 * попыток: N». По ним со стороны было видно, есть ли сейчас на адресе
 * живой код и сколько попыток осталось, — то есть когда выгоднее
 * запросить свежий и продолжить подбор. Само сравнение тоже стало
 * постоянным по времени: так во всём остальном коде (токены сброса,
 * ключ бота, вход Telegram), и разнобоя здесь быть не должно.
 */
const CODE_FAIL = "Код неверный или истёк. Запросите новый.";

export function verifyCode(email: string, code: string): { valid: boolean; error?: string } {
  if (codeFailuresExceeded(email)) {
    codes.delete(email);
    return { valid: false, error: "Слишком много неверных кодов. Попробуйте завтра или напишите в поддержку." };
  }

  const record = codes.get(email);
  if (!record) {
    bumpCodeFailure(email);
    return { valid: false, error: CODE_FAIL };
  }

  if (Date.now() > record.expiresAt) {
    codes.delete(email);
    bumpCodeFailure(email);
    return { valid: false, error: CODE_FAIL };
  }

  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    codes.delete(email);
    bumpCodeFailure(email);
    return { valid: false, error: CODE_FAIL };
  }

  const a = Buffer.from(record.code, "utf-8");
  const b = Buffer.from(typeof code === "string" ? code : "", "utf-8");
  const same = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!same) {
    record.attempts++;
    bumpCodeFailure(email);
    return { valid: false, error: CODE_FAIL };
  }

  codes.delete(email);
  codeFails.delete(email);
  return { valid: true };
}

// ─── User Management (PostgreSQL) ───────────────────────────────

export type NewUserResult = UserRecord & {
  isNew: boolean;
  /** True when this call created the user AND granted the trial. */
  trialGranted: boolean;
  /** Why the trial was not granted to a new user (null when granted or not new). */
  trialBlockedReason: TrialBlockReason | null;
};

/**
 * Find or create a user by email. A NEW user is created with an
 * already-ended subscription and gets the trial only if the
 * anti-abuse checks pass — in the same transaction, through the
 * ledger (kind `trial`, source = user id, so it can never be granted
 * twice). The panel user is created afterwards by the sync.
 */
export async function getOrCreateUser(
  email: string,
  referredByCode?: string,
  ip?: string,
  fingerprint?: string,
  /**
   * bypassTrial: the 500 MB bypass that comes with the site trial (owner,
   * 13.09.2026) — a grant in the SAME transaction as the trial, so it is
   * granted exactly when the trial is (same anti-abuse). The bot's
   * /api/bot/register passes false: the bot gives its own trial traffic.
   */
  opts: { bypassTrial?: boolean; locale?: string | null } = {}
): Promise<NewUserResult> {
  await waitForDb(); // user creation must not race the startup migrations
  const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return { ...rowToUser(existing.rows[0]), isNew: false, trialGranted: false, trialBlockedReason: null };
  }

  return withTransaction(async (c) => {
    const id = uuidv4();
    const inserted = await insertUserRow(c, { id, email, referredBy: referredByCode, ip, fingerprint, locale: opts.locale });
    if (!inserted) {
      // Lost a race with a concurrent sign-in for the same email.
      const again = await c.query("SELECT * FROM users WHERE email = $1", [email]);
      return { ...rowToUser(again.rows[0]), isNew: false, trialGranted: false, trialBlockedReason: null };
    }

    if (referredByCode) {
      await c.query(`UPDATE users SET referrals = referrals + 1 WHERE referral_code = $1 AND id <> $2`, [referredByCode, id]);
    }

    const blocked = await checkTrialEligibility(c, { email, ip, fingerprint });
    if (!blocked) {
      await applySubscriptionEvent(c, {
        userId: id,
        kind: "trial",
        sourceId: id,
        extendMs: TRIAL_DURATION_MS,
        plan: "trial",
        actor: "signup",
      });
      await c.query("UPDATE users SET trial_used_at = NOW() WHERE id = $1", [id]);
      await recordTrialUsage(c, { email, ip, fingerprint });
      if (opts.bypassTrial !== false) {
        // Applied to the panel after commit (bypass-grants.ts) — creates ST…_bp.
        await insertBypassGrant(c, { id: grantId.trial(id), userId: id, kind: "trial", bytes: TRAFFIC_TRIAL_BYTES, actor: "signup" });
      }
    } else {
      console.warn(`[TRIAL] not granted to ${email}: ${blocked}`);
    }

    const row = await c.query("SELECT * FROM users WHERE id = $1", [id]);
    return { ...rowToUser(row.rows[0]), isNew: true, trialGranted: !blocked, trialBlockedReason: blocked };
  });
}

// Чтения пользователя на пути входа ждут миграций: на пустой базе первый
// запрос кода приходил раньше CREATE TABLE users (e2e 13.09.2026).
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  await waitForDb();
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  await waitForDb();
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

/**
 * Update plain profile fields. Do NOT use it for subscription changes —
 * those go through the ledger. The subscriptionEnd guard stays as a
 * last line of defence for any remaining direct writer.
 */
export async function updateUser(id: string, updates: Partial<UserRecord>): Promise<UserRecord | null> {
  if (updates.subscriptionEnd !== undefined && updates.subscriptionEnd !== null) {
    const ts = new Date(updates.subscriptionEnd).getTime();
    if (Number.isFinite(ts) && ts > Date.now() + MAX_DIRECT_END_DAYS * DAY) {
      throw new Error(`updateUser: subscriptionEnd ${updates.subscriptionEnd} exceeds NOW+${MAX_DIRECT_END_DAYS}d — use the ledger`);
    }
  }

  const fieldMap: Record<string, string> = {
    email: "email",
    passwordHash: "password_hash",
    subscriptionEnd: "subscription_end",
    telegramId: "telegram_id",
    telegramLinked: "telegram_linked",
    referralCode: "referral_code",
    referredBy: "referred_by",
    referrals: "referrals",
    paidReferrals: "paid_referrals",
    subscriptionPlan: "subscription_plan",
    telegramLinkToken: "telegram_link_token",
    registrationIp: "registration_ip",
    balance: "balance",
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    const column = fieldMap[key];
    if (!column) continue;
    setClauses.push(`${column} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  if (setClauses.length === 0) return getUserById(id);

  values.push(id);
  const result = await pool.query(
    `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function linkTelegram(userId: string, telegramId: string): Promise<UserRecord | null> {
  const user = await getUserById(userId);
  if (!user) return null;
  if (user.telegramLinked) return user;

  return updateUser(userId, {
    telegramId,
    telegramLinked: true,
  });
}

// ─── Telegram Bot Sync ──────────────────────────────────────────

export async function getUserByTelegramLinkToken(token: string): Promise<UserRecord | null> {
  const result = await pool.query("SELECT * FROM users WHERE telegram_link_token = $1", [token]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function getUserByTelegramId(telegramId: string): Promise<UserRecord | null> {
  await waitForDb();
  const result = await pool.query("SELECT * FROM users WHERE telegram_id = $1 ORDER BY created_at ASC LIMIT 1", [telegramId]);
  if (result.rows.length === 0) return null;
  return rowToUser(result.rows[0]);
}

export async function linkTelegramByToken(token: string, telegramId: string): Promise<UserRecord | null> {
  const user = await getUserByTelegramLinkToken(token);
  if (!user) return null;
  if (user.telegramLinked && user.telegramId === telegramId) return user; // Already linked to this account

  // Check if this telegram_id is already linked to another account
  const existingByTg = await getUserByTelegramId(telegramId);
  if (existingByTg && existingByTg.id !== user.id) {
    // If linked to a placeholder bot account (telegram_*@tg.*), unlink it first
    if (existingByTg.email.startsWith("telegram_") && existingByTg.email.includes("@tg.")) {
      await updateUser(existingByTg.id, { telegramId: null, telegramLinked: false });
      console.log(`[LINK] Unlinked TG:${telegramId} from placeholder ${existingByTg.email} → linking to ${user.email}`);
    } else {
      // Already linked to a real account — don't override
      return existingByTg;
    }
  }

  return updateUser(user.id, {
    telegramId,
    telegramLinked: true,
  });
}

/**
 * +TELEGRAM_BONUS_DAYS for linking Telegram — once per site account AND
 * once per Telegram id (unlink/relink or moving the Telegram id to
 * another account never pays twice).
 */
export async function grantTelegramBonus(
  userId: string,
  telegramId: string
): Promise<{ granted: boolean; reason?: "telegram_id_already_used" | "account_already_rewarded"; newEnd?: string }> {
  return withTransaction(async (c) => {
    const claim = await c.query(
      `INSERT INTO telegram_bonus_claims (telegram_id, user_id) VALUES ($1, $2)
       ON CONFLICT (telegram_id) DO NOTHING RETURNING telegram_id`,
      [telegramId, userId]
    );
    if (claim.rows.length === 0) return { granted: false, reason: "telegram_id_already_used" as const };

    const mark = await c.query(
      `UPDATE users SET telegram_bonus_granted_at = NOW()
       WHERE id = $1 AND telegram_bonus_granted_at IS NULL RETURNING id`,
      [userId]
    );
    if (mark.rows.length === 0) {
      // Roll the claim back with the transaction: the Telegram id stays free
      // for… nobody else either — but an account that already got the
      // bonus must not consume a new Telegram id's claim.
      throw new AccountAlreadyRewarded();
    }

    const led = await applySubscriptionEvent(c, {
      userId,
      kind: "telegram_bonus",
      sourceId: userId,
      extendMs: TELEGRAM_BONUS_DAYS * DAY,
      actor: `telegram:${telegramId}`,
    });
    return { granted: led.applied, newEnd: led.newEnd.toISOString() };
  }).catch((err) => {
    if (err instanceof AccountAlreadyRewarded) return { granted: false, reason: "account_already_rewarded" as const };
    throw err;
  });
}

class AccountAlreadyRewarded extends Error {
  constructor() {
    super("account already rewarded");
  }
}

/** A bot call without paymentId repeating (days, plan, amount) within this window is a retry. */
export const BOT_EXTEND_DEDUPE_SECONDS = 120;

export interface BotExtendResult {
  user: UserRecord;
  applied: boolean;
  /** True when the call was recognised as a repeat and nothing was applied. */
  duplicate: boolean;
  /** Ledger source id — also the cashback purchase id (one key for both). */
  sourceId: string;
  referral: ReferralCredit | null;
}

/**
 * Bot-side paid extension + referral cashback, in ONE transaction under
 * the user row lock.
 *
 *   with paymentId / Idempotency-Key → source `bot:<key>`: fully idempotent.
 *   without → a `bot_extend` event of this user with the same (days, plan,
 *     amount) in the last 120 s means "retry after a dropped response":
 *     nothing is applied, `duplicate: true`. Otherwise a new event with a
 *     source id derived from its own id. No random fallback for the
 *     cashback purchase id anywhere — it is always the ledger source id.
 */
export async function botExtendSubscription(
  telegramId: string,
  days: number,
  opts: { plan?: string; amount?: number; idempotencyKey?: string } = {}
): Promise<BotExtendResult | null> {
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0 || days > 400) {
    throw new Error(`botExtendSubscription: days out of range (got ${days}, max 400)`);
  }
  const user = await getUserByTelegramId(telegramId);
  if (!user) return null;
  const planSlug = opts.plan && ["basic", "plus"].includes(opts.plan) ? opts.plan : null;
  const amount = typeof opts.amount === "number" && Number.isFinite(opts.amount) && opts.amount > 0 ? opts.amount : null;
  const key = opts.idempotencyKey?.trim() || null;

  const out = await withTransaction(async (c): Promise<Omit<BotExtendResult, "user">> => {
    await c.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [user.id]);

    let sourceId: string;
    let eventId: string | undefined;
    if (key) {
      sourceId = `bot:${key}`;
    } else {
      console.warn(JSON.stringify({ lvl: "warn", evt: "bot-extend.no-payment-id", telegramId, userId: user.id, days, plan: planSlug, amount }));
      const dup = await c.query<{ source_id: string }>(
        `SELECT source_id FROM subscription_events
         WHERE user_id = $1 AND kind = 'bot_extend'
           AND created_at > NOW() - ($2::int * INTERVAL '1 second')
           AND meta->>'requestedDays' = $3
           AND plan IS NOT DISTINCT FROM $4
           AND meta->>'amount' IS NOT DISTINCT FROM $5
         ORDER BY created_at DESC LIMIT 1`,
        [user.id, BOT_EXTEND_DEDUPE_SECONDS, String(days), planSlug, amount === null ? null : String(amount)]
      );
      if (dup.rows.length > 0) {
        return { applied: false, duplicate: true, sourceId: dup.rows[0].source_id, referral: null };
      }
      eventId = uuidv4();
      sourceId = `bot:auto:${eventId}`;
    }

    const led = await applySubscriptionEvent(c, {
      id: eventId,
      userId: user.id,
      kind: "bot_extend",
      sourceId,
      extendMs: days * DAY,
      plan: planSlug,
      actor: `bot:${telegramId}`,
      meta: { requestedDays: days, amount, telegramId, idempotencyKey: key },
    });
    if (!led.applied) return { applied: false, duplicate: true, sourceId, referral: null };

    // Cashback must never block the extension: isolate it in a savepoint.
    let referral: ReferralCredit | null = null;
    await c.query("SAVEPOINT bot_referral");
    try {
      referral = await creditReferrerOnPayment(user.id, amount ?? undefined, sourceId, c);
      await c.query("RELEASE SAVEPOINT bot_referral");
    } catch (err) {
      await c.query("ROLLBACK TO SAVEPOINT bot_referral");
      console.error(`[BOT-EXTEND] referral credit failed for ${sourceId}:`, err instanceof Error ? err.message : err);
    }
    return { applied: true, duplicate: false, sourceId, referral };
  });

  const fresh = await getUserById(user.id);
  return fresh ? { ...out, user: fresh } : null;
}

/** Bot overwrite of the subscription end (action=overwrite_site). */
export type BotOverwriteResult =
  | { ok: true; user: UserRecord | null }
  | { ok: false; reason: "would_shorten"; currentEnd: Date };

/**
 * `POST /api/bot/sync` (overwrite_site). Для связанного человека срок —
 * ОБЩИЙ ключ бота и сайта (docs/bot/TZ_BOT_EMAIL_LINK.md, 4.3): перезапись
 * датой из БД бота укоротила бы его. Поэтому раньше текущего срока дату
 * можно поставить только явным отзывом (`revocation`); всё остальное —
 * отказ `would_shorten`. Проверка и запись — в одной транзакции под
 * блокировкой строки, чтобы параллельный `extend` не проскочил между ними.
 */
export async function botOverwriteSubscription(
  userId: string,
  end: Date,
  plan: string | null,
  telegramId: string,
  opts: { revocation?: boolean } = {}
): Promise<BotOverwriteResult> {
  const rejected = await withTransaction(async (c) => {
    if (!opts.revocation) {
      const cur = await c.query<{ subscription_end: Date; subscription_plan: string | null }>(
        "SELECT subscription_end, subscription_plan FROM users WHERE id = $1 FOR UPDATE",
        [userId]
      );
      const currentEnd = cur.rows[0] ? new Date(cur.rows[0].subscription_end) : null;
      if (currentEnd && end.getTime() < currentEnd.getTime()) return currentEnd;
    }
    await applySubscriptionEvent(c, {
      userId,
      kind: "bot_overwrite",
      sourceId: `bot:${uuidv4()}`,
      setEnd: end,
      plan,
      actor: `bot:${telegramId}`,
    });
    return null;
  });
  if (rejected) return { ok: false, reason: "would_shorten", currentEnd: rejected };
  return { ok: true, user: await getUserById(userId) };
}

// ─── Payment Management ─────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  userId: string;
  transactionId: string | null;
  plan: string;
  period: number;
  amount: number;
  currency: string;
  status: string;
  redirectUrl: string | null;
  expiresAt: string;
  createdAt: string;
  paidAt: string | null;
  appliedAt: string | null;
  refundedAt: string | null;
  refundId: string | null;
  /** 'subscription' (plan/period) or 'traffic' (a «Пакет трафика»: plan='traffic', period=0). */
  product: "subscription" | "traffic";
  trafficPackId: string | null;
  trafficBytes: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToPayment(row: any): PaymentRecord {
  return {
    id: row.id,
    userId: row.user_id,
    transactionId: row.transaction_id ?? null,
    plan: row.plan,
    period: Number(row.period),
    amount: parseFloat(row.amount),
    currency: row.currency,
    status: row.status,
    redirectUrl: row.redirect_url ?? null,
    expiresAt: new Date(row.expires_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    paidAt: iso(row.paid_at),
    appliedAt: iso(row.applied_at),
    refundedAt: iso(row.refunded_at),
    refundId: row.refund_id ?? null,
    product: row.product === "traffic" ? "traffic" : "subscription",
    trafficPackId: row.traffic_pack_id ?? null,
    trafficBytes: row.traffic_bytes != null ? Number(row.traffic_bytes) : null,
  };
}

export async function createPaymentRecord(
  id: string,
  userId: string,
  plan: string,
  period: number,
  amount: number,
  transactionId: string | null,
  redirectUrl: string | null,
  expiresAt: Date,
  traffic?: { packId: string; bytes: number }
): Promise<PaymentRecord> {
  const result = await pool.query(
    `INSERT INTO payments (id, user_id, plan, period, amount, transaction_id, redirect_url, expires_at, product, traffic_pack_id, traffic_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [id, userId, plan, period, amount, transactionId, redirectUrl, expiresAt, traffic ? "traffic" : "subscription", traffic?.packId ?? null, traffic?.bytes ?? null]
  );
  return rowToPayment(result.rows[0]);
}

export async function setPaymentTransaction(id: string, transactionId: string, redirectUrl: string | null): Promise<void> {
  await pool.query(
    "UPDATE payments SET transaction_id = $2, redirect_url = COALESCE($3, redirect_url) WHERE id = $1 AND (transaction_id IS NULL OR transaction_id = $2)",
    [id, transactionId, redirectUrl]
  );
}

export async function getPaymentById(id: string): Promise<PaymentRecord | null> {
  const result = await pool.query("SELECT * FROM payments WHERE id = $1", [id]);
  if (result.rows.length === 0) return null;
  return rowToPayment(result.rows[0]);
}

export async function getPaymentByTransactionId(transactionId: string): Promise<PaymentRecord | null> {
  const result = await pool.query("SELECT * FROM payments WHERE transaction_id = $1", [transactionId]);
  if (result.rows.length === 0) return null;
  return rowToPayment(result.rows[0]);
}

/** Conditional status change: only from one of `from`. Returns the row if it changed. */
export async function transitionPaymentStatus(id: string, from: string[], to: string): Promise<PaymentRecord | null> {
  const result = await pool.query("UPDATE payments SET status = $2 WHERE id = $1 AND status = ANY($3) RETURNING *", [id, to, from]);
  return result.rows.length ? rowToPayment(result.rows[0]) : null;
}

// ─── Loyalty Tiers & Cashback ───────────────────────────────────

export interface LoyaltyInfo {
  tier: string;
  percent: number;
  paidReferrals: number;
  nextTier: string | null;
  referralsToNextTier: number;
}

/** Get cashback percentage based on paid referrals count */
export function getCashbackPercent(paidReferrals: number): number {
  return loyaltyTierFor(paidReferrals).percent;
}

/**
 * Get full loyalty tier info. Пороги и проценты — только из
 * `src/lib/loyalty.ts`: ту же таблицу читает витрина, которой нельзя
 * импортировать этот модуль вместе с пулом базы.
 */
export function getLoyaltyInfo(paidReferrals: number): LoyaltyInfo {
  const current = loyaltyTierFor(paidReferrals);
  const next = loyaltyNextTier(paidReferrals);
  return {
    tier: current.tier,
    percent: current.percent,
    paidReferrals,
    nextTier: next?.tier ?? null,
    referralsToNextTier: next ? next.from - paidReferrals : 0,
  };
}

// ─── Balance Operations ─────────────────────────────────────────

/**
 * Increase user balance (amount in kopecks). Returns new balance.
 * @param syncedToBot - false for site-originated cashback (pending bot sync)
 */
export async function increaseBalance(
  userId: string,
  amountKopecks: number,
  type: string,
  source: string,
  description: string,
  relatedUserId?: string,
  syncedToBot: boolean = true
): Promise<number> {
  return withTransaction(async (c) => {
    const result = await c.query(`UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`, [amountKopecks, userId]);
    if (result.rows.length === 0) return 0;
    await c.query(
      `INSERT INTO balance_transactions (id, user_id, amount, type, source, description, related_user_id, synced_to_bot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [uuidv4(), userId, amountKopecks, type, source, description, relatedUserId || null, syncedToBot]
    );
    return result.rows[0].balance;
  });
}

/** Get user balance in kopecks */
export async function getUserBalance(userId: string): Promise<number> {
  const result = await pool.query("SELECT balance FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.balance ?? 0;
}

/** Get unsynced cashback transactions for a user (pending bot sync) */
export async function getUnsyncedCashback(userId: string): Promise<Array<{
  id: string;
  amount: number;
  description: string | null;
  relatedUserId: string | null;
  createdAt: string;
}>> {
  const result = await pool.query(
    `SELECT id, amount, description, related_user_id, created_at
     FROM balance_transactions
     WHERE user_id = $1 AND synced_to_bot = FALSE
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    amount: r.amount,
    description: r.description,
    relatedUserId: r.related_user_id,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

/** Mark cashback transactions as synced to bot */
type CashbackItem = { id: string; amount: number; description: string | null; relatedUserId: string | null; createdAt: string };

function rowsToCashback(rows: Array<{ id: string; amount: number; description: string | null; related_user_id: string | null; created_at: Date }>): CashbackItem[] {
  return rows
    .map((r) => ({
      id: r.id,
      amount: r.amount,
      description: r.description,
      relatedUserId: r.related_user_id,
      createdAt: new Date(r.created_at).toISOString(),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Двухфазный обмен кешбэком с ботом (ТЗ для бота v2, 17.09.2026), фаза 1:
 * отдать неподтверждённый кешбэк, НЕ помечая его отданным, и выставить
 * баланс сайта = баланс бота + неподтверждённое. Бот зачисляет записи с
 * дедупликацией по `id` у себя и подтверждает их (`ackCashbackForBot`).
 * Потерянный в сети ответ больше не теряет деньги: повторный запрос вернёт
 * те же записи, а бот не зачислит их дважды.
 */
export async function peekCashbackForBot(userId: string, botBalance: number): Promise<{ pending: CashbackItem[]; balance: number }> {
  return withTransaction(async (c) => {
    await c.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const r = await c.query<{ id: string; amount: number; description: string | null; related_user_id: string | null; created_at: Date }>(
      `SELECT id, amount, description, related_user_id, created_at
       FROM balance_transactions
       WHERE user_id = $1 AND synced_to_bot = FALSE`,
      [userId]
    );
    const pending = rowsToCashback(r.rows);
    const balance = botBalance + pending.reduce((sum, tx) => sum + tx.amount, 0);
    await c.query("UPDATE users SET balance = $2 WHERE id = $1", [userId, balance]);
    return { pending, balance };
  });
}

/** Фаза 2: бот подтвердил зачисление — пометить ровно эти записи отданными. */
export async function ackCashbackForBot(userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const r = await pool.query<{ id: string }>(
    `UPDATE balance_transactions SET synced_to_bot = TRUE
     WHERE user_id = $1 AND id = ANY($2) AND synced_to_bot = FALSE
     RETURNING id`,
    [userId, ids]
  );
  return r.rows.map((x) => x.id);
}

/**
 * `POST /api/bot/sync-balance`: забрать неотданный боту кешбэк и выставить
 * баланс сайта = баланс бота + забранное — одной транзакцией.
 *
 * Раньше чтение (`getUnsyncedCashback`) и пометка шли двумя отдельными
 * запросами: два одновременных вызова (ретрай бота по таймауту) оба
 * получали тот же кешбэк в `pendingCashback`, и бот по контракту начислял
 * его дважды — лишние деньги на балансе. Теперь кешбэк «забирается»
 * условным UPDATE … RETURNING: каждую запись получает ровно один вызов,
 * второй получает пустой список.
 */
export async function claimCashbackForBot(userId: string, botBalance: number): Promise<{
  claimed: Array<{ id: string; amount: number; description: string | null; relatedUserId: string | null; createdAt: string }>;
  balance: number;
}> {
  return withTransaction(async (c) => {
    await c.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const taken = await c.query<{ id: string; amount: number; description: string | null; related_user_id: string | null; created_at: Date }>(
      `UPDATE balance_transactions SET synced_to_bot = TRUE
       WHERE user_id = $1 AND synced_to_bot = FALSE
       RETURNING id, amount, description, related_user_id, created_at`,
      [userId]
    );
    const claimed = taken.rows
      .map((r) => ({
        id: r.id,
        amount: r.amount,
        description: r.description,
        relatedUserId: r.related_user_id,
        createdAt: new Date(r.created_at).toISOString(),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const balance = botBalance + claimed.reduce((sum, tx) => sum + tx.amount, 0);
    await c.query("UPDATE users SET balance = $2 WHERE id = $1", [userId, balance]);
    return { claimed, balance };
  });
}

// ─── Referral Cashback System ───────────────────────────────────

export interface ReferralCredit {
  referrerId: string;
  percent: number;
  rewardRubles: number;
}

/**
 * Credit the referrer on a referee's payment — atomic and idempotent.
 *
 *   - cashback: one reward per (buyer, purchase) — the referral_rewards
 *     row is inserted FIRST and gates the balance change;
 *   - paid_referrals counts UNIQUE referees: it grows only the first
 *     time a given buyer pays (users.referral_paid_counted_at on the buyer).
 *
 * Pass `client` to run inside the caller's transaction (payment
 * confirmation does); otherwise a transaction is opened here.
 */
export async function creditReferrerOnPayment(
  userId: string,
  purchaseAmountRubles?: number,
  purchaseId?: string,
  client?: Queryable
): Promise<ReferralCredit | null> {
  const run = async (c: Queryable): Promise<ReferralCredit | null> => {
    const buyer = await c.query<{ referred_by: string | null; email: string }>("SELECT referred_by, email FROM users WHERE id = $1", [userId]);
    const code = buyer.rows[0]?.referred_by;
    if (!code) return null;

    const refRes = await c.query<{ id: string; email: string; paid_referrals: number }>(
      "SELECT id, email, paid_referrals FROM users WHERE referral_code = $1 FOR UPDATE",
      [code]
    );
    const referrer = refRes.rows[0];
    if (!referrer || referrer.id === userId) return null;

    const hasAmount = typeof purchaseAmountRubles === "number" && Number.isFinite(purchaseAmountRubles) && purchaseAmountRubles > 0;
    let rewardKopecks = 0;
    let percent = 0;
    if (hasAmount) {
      percent = getCashbackPercent(referrer.paid_referrals);
      rewardKopecks = Math.round((purchaseAmountRubles! * percent) / 100 * 100);
      const purchaseKopecks = Math.round(purchaseAmountRubles! * 100);
      const ins = await c.query(
        `INSERT INTO referral_rewards (id, referrer_id, buyer_id, purchase_id, purchase_amount, percent, reward_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (buyer_id, purchase_id) DO NOTHING
         RETURNING id`,
        [uuidv4(), referrer.id, userId, purchaseId || uuidv4(), purchaseKopecks, percent, rewardKopecks]
      );
      if (ins.rows.length === 0) {
        console.log(`[REFERRAL] purchase ${purchaseId} already credited — skipping`);
        return null;
      }
    }

    const counted = await c.query(
      "UPDATE users SET referral_paid_counted_at = NOW() WHERE id = $1 AND referral_paid_counted_at IS NULL RETURNING id",
      [userId]
    );
    const increment = counted.rows.length > 0 ? 1 : 0;

    if (rewardKopecks > 0 || increment > 0) {
      await c.query("UPDATE users SET balance = balance + $1, paid_referrals = paid_referrals + $2 WHERE id = $3", [
        rewardKopecks,
        increment,
        referrer.id,
      ]);
    }
    if (rewardKopecks > 0) {
      await c.query(
        `INSERT INTO balance_transactions (id, user_id, amount, type, source, description, related_user_id, synced_to_bot)
         VALUES ($1, $2, $3, 'cashback', 'referral', $4, $5, FALSE)`,
        [uuidv4(), referrer.id, rewardKopecks, `Кешбэк ${percent}% от покупки ${purchaseAmountRubles}₽`, userId]
      );
      console.log(`[REFERRAL] Credited ${referrer.email}: ${rewardKopecks / 100}₽ (${percent}%) from ${buyer.rows[0].email}`);
      return { referrerId: referrer.id, percent, rewardRubles: rewardKopecks / 100 };
    }
    return null;
  };
  return client ? run(client) : withTransaction(run);
}

export async function expirePendingPayments(): Promise<number> {
  const result = await pool.query(
    `UPDATE payments SET status = 'expired'
     WHERE status = 'pending' AND expires_at <= NOW()
     RETURNING id`
  );
  return result.rows.length;
}

// ─── Password Management ────────────────────────────────────────

const BCRYPT_ROUNDS = 10;

/**
 * Смена пароля молчать не должна (аудит безопасности 19.09.2026).
 * Если пароль сменил не владелец, единственный шанс заметить это
 * вовремя — увидеть запись в кабинете. Уведомление пишется рядом с
 * самой сменой, а не в обработчике: путей смены два, и забыть его в
 * одном из них не должно быть возможности.
 */
const PASSWORD_CHANGED_TITLE = "Пароль изменён";
const PASSWORD_CHANGED_TEXT =
  "Пароль от аккаунта только что изменили. Если это были не вы — сразу напишите в поддержку: доступ к аккаунту у кого-то ещё.";

export async function setUserPassword(userId: string, password: string): Promise<boolean> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id",
    [hash, userId]
  );
  if (result.rows.length === 0) return false;
  await createNotificationForUser(userId, PASSWORD_CHANGED_TITLE, PASSWORD_CHANGED_TEXT).catch((err) =>
    console.error("[PASSWORD] set: notification failed:", err instanceof Error ? err.message : err)
  );
  return true;
}

// A real bcrypt hash of a random string, computed once: accounts without a
// password (or unknown emails) still pay one bcrypt comparison, so the
// response time does not tell whether an email is registered.
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= bcrypt.hash(uuidv4(), BCRYPT_ROUNDS));

export async function verifyUserPassword(email: string, password: string): Promise<UserRecord | null> {
  const user = await getUserByEmail(email);
  if (!user || !user.passwordHash) {
    await bcrypt.compare(password, await getDummyHash());
    return null;
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  return match ? user : null;
}

export async function resetUserPassword(email: string, password: string): Promise<boolean> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const result = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id",
    [hash, email]
  );
  if (result.rows.length === 0) return false;
  await createNotificationForUser(String(result.rows[0].id), PASSWORD_CHANGED_TITLE, PASSWORD_CHANGED_TEXT).catch((err) =>
    console.error("[PASSWORD] reset: notification failed:", err instanceof Error ? err.message : err)
  );
  // A reset means "someone else may be in my account": sign out everywhere.
  await revokeAllSessions(String(result.rows[0].id)).catch((err) =>
    console.error("[PASSWORD] reset: could not revoke sessions:", err instanceof Error ? err.message : err)
  );
  return true;
}

export async function userHasPassword(email: string): Promise<boolean> {
  await waitForDb();
  const result = await pool.query(
    "SELECT password_hash FROM users WHERE email = $1",
    [email]
  );
  return result.rows.length > 0 && !!result.rows[0].password_hash;
}

// ─── Notifications ────────────────────────────────────────────

export async function createNotificationForUser(userId: string, title: string, message: string): Promise<void> {
  try {
    const id = uuidv4();
    await pool.query(
      "INSERT INTO notifications (id, title, message, target) VALUES ($1, $2, $3, $4)",
      [id, title, message, userId]
    );

    import("./push")
      .then(({ sendPushToUser }) => sendPushToUser(userId, title, message))
      .catch((err) => console.warn("[STORE] push failed:", err instanceof Error ? err.message : err));
  } catch (err) {
    console.error("[STORE] Failed to create notification:", err);
  }
}

// ─── Audit Logs ──────────────────────────────────────────────

export async function createAuditLog(
  action: string,
  details?: string,
  userId?: string,
  userEmail?: string,
  ip?: string
): Promise<void> {
  try {
    await waitForDb(); // the level column is added at startup
    const id = uuidv4();
    await pool.query(
      "INSERT INTO audit_logs (id, user_id, user_email, action, details, ip, level) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, userId || null, userEmail || null, action, details || null, ip || null, auditLevelFor(action)]
    );
  } catch (err) {
    console.error("[AUDIT] Failed to create log:", err);
  }
}

export async function getAuditLogs(limit = 100, offset = 0): Promise<Array<{
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  details: string | null;
  ip: string | null;
  createdAt: string;
}>> {
  const result = await pool.query(
    "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  return result.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userEmail: r.user_email,
    action: r.action,
    details: r.details,
    ip: r.ip,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

// Background panel sync worker (pending every 60 s, reconcile hourly,
// both under advisory locks). Server-side only; not in tests.
if (typeof window === "undefined" && process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  import("./sync-worker")
    .then((m) => m.startSyncWorker())
    .catch((err) => console.error("[SYNC-WORKER] failed to start:", err));
}
