/**
 * Telegram ↔ site account linking — «один человек, одна подписка, один
 * ключ» (owner, 13.09.2026). Contract for the bot:
 * docs/bot/TZ_BOT_EMAIL_LINK.md.
 *
 * ONE function, linkTelegramAccount, for every path:
 *   - bot first:  /api/bot/email/confirm (email proven by a code);
 *   - site first: /api/bot/link with a one-time token from the
 *                 dashboard (or, for compatibility, the old permanent
 *                 telegram_link_token, rotated on use).
 *
 * Steps:
 *   1. Accounts: the target (by email or by token's user id) and the
 *      account already holding this Telegram id. Conflicts → 409
 *      TELEGRAM_LINKED_OTHER / EMAIL_LINKED_OTHER. The same pair again
 *      is an idempotent success. The bot's email-less placeholder
 *      account (telegram_<id>@tg.…) is not a conflict: it is renamed
 *      (no account for the email yet) or absorbed.
 *   2. Panel reads, BEFORE the transaction: the target's entity, the
 *      bot's premium `tg_{id}_premium` (or the id the bot passed,
 *      checked against its telegramId) and the bot's bypass `{id}`.
 *      A panel that cannot be asked → 503 PANEL_UNAVAILABLE, nothing
 *      written, the code/token stays valid — the merge cannot be decided
 *      without knowing the bot's term.
 *   3. One transaction under advisory locks (telegram id, then email):
 *      re-read the accounts (retry if they moved), create the account
 *      without a trial if needed, decide the merge (decideMerge: the
 *      LONGER live term wins, days are not added), write the term via
 *      the ledger (`link_merge`, deterministic source id), point
 *      panel_user_id at the kept entity, record the losers in
 *      link_disable_ids and link_panel_state = 'pending'.
 *   4. After commit: +TELEGRAM_BONUS_DAYS once (grantTelegramBonus's own
 *      uniqueness — per account and per Telegram id), bypass merge if
 *      both sides had one, then syncUserToPanel — which performs the
 *      owed panel writes (src/lib/link-panel.ts) and pushes the term. If
 *      the panel is down at that point, the link is still complete in
 *      the DB and the sync worker finishes the panel side.
 */

import { pool, waitForDb } from "./db";
import { lockLinkKey } from "./locks";
import { applySubscriptionEvent, Queryable, withTransaction } from "./subscription-ledger";
import {
  createAuditLog,
  createNotificationForUser,
  getUserByEmail,
  getUserById,
  getUserByTelegramId,
  grantTelegramBonus,
  insertUserRow,
  isPlaceholderEmail,
  NewUserResult,
  rowToUser,
  UserRecord,
} from "./store";
import { recordTrialUsage } from "./trial";
import { generateTelegramLinkToken } from "./tokens";
import {
  botPremiumUsername,
  describeRwError,
  findUsersByEmail,
  getUserById as rwGetUserById,
  getUserByUsername,
  hasMarker,
  isBypassEntity,
  isSiteUsername,
  isUserGone,
  PANEL_MARKERS,
  PanelUser,
  planFromBotDescription,
  planFromSiteTag,
  RwError,
  updateUser,
  withMarkers,
} from "./remnawave";
import { MIN_REMAINING_MS, requestPanelSync, syncUserToPanel } from "./subscription-sync";
import { findBotBypass, mergeBypassEntities, panelIdOwner } from "./bypass";
import { TELEGRAM_BONUS_DAYS } from "./brand-facts";
import { plural } from "./ru-words";

// ─── Types ───────────────────────────────────────────────────────

/** relink: the bot asks to re-run the merge for an EXISTING link (migration of people linked before 13.09.2026). */
export type LinkVia = "bot_email" | "site_token" | "legacy_token" | "relink";
export type KeptSide = "bot" | "site" | "only-bot" | "only-site" | "none";
export type LinkErrorCode = "TELEGRAM_LINKED_OTHER" | "EMAIL_LINKED_OTHER" | "PANEL_UNAVAILABLE" | "USER_NOT_FOUND" | "VALIDATION" | "BUSY";

export interface LinkInput {
  telegramId: string | number;
  /** Bot-first path: the verified email. */
  email?: string;
  /** Site-first path: the account of the token. */
  userId?: string;
  via: LinkVia;
  /** Optional hint from the bot: id of its premium panel user (checked against telegramId). */
  premiumPanelUserId?: number | null;
  ip?: string | null;
}

export interface LinkSuccess {
  ok: true;
  user: UserRecord;
  alreadyLinked: boolean;
  created: boolean;
  kept: KeptSide;
  keptPanelUserId: number | null;
  disabledPanelUserId: number | null;
  disabledPanelUserIds: number[];
  bonusDays: number;
  bonusReason: string | null;
  panelSynced: boolean;
  bypassPanelUserId: number | null;
}

export interface LinkFailure {
  ok: false;
  status: 400 | 404 | 409 | 503;
  code: LinkErrorCode;
  error: string;
}

export type LinkResult = LinkSuccess | LinkFailure;

const TELEGRAM_ID_RE = /^\d{3,20}$/;
/** A premium term beyond this is not a subscription (the bot's bypass uses 2099). */
const SANE_PREMIUM_MAX_MS = Date.UTC(2090, 0, 1);

const fail = (status: LinkFailure["status"], code: LinkErrorCode, error: string): LinkFailure => ({ ok: false, status, code, error });

export function isValidTelegramId(v: unknown): v is string {
  return typeof v === "string" && TELEGRAM_ID_RE.test(v);
}

/** "ab***@mail.ru" — for the bot's confirmation screen. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${shown}***@${email.slice(at + 1)}`;
}

// ─── Merge decision (pure) ───────────────────────────────────────

export interface MergeCandidate {
  side: "site" | "placeholder" | "bot";
  /** Term in ms (site: DB subscription_end; bot: panel expireAt). */
  end: number;
  live: boolean;
  entity: PanelUser | null;
}

export interface MergeDecision {
  kept: KeptSide;
  winner: MergeCandidate | null;
  keptEntity: PanelUser | null;
  /** New term for the account; null → unchanged. Includes `addedMs`. */
  newEnd: number | null;
  /** Остаток проигравшей стороны, прибавленный к сроку (0 — складывать было нечего). */
  addedMs: number;
  /** Live panel entities that lose (status → DISABLED, term untouched). */
  disable: number[];
}

export function panelEntityLive(u: PanelUser | null, now = Date.now()): boolean {
  if (!u) return false;
  const exp = Date.parse(u.expireAt);
  return (u.status === "ACTIVE" || u.status === "LIMITED") && Number.isFinite(exp) && exp - now > MIN_REMAINING_MS;
}

/**
 * Правило слияния (владелец, 20.09.2026: «если у него подписка есть —
 * лучше сложить»). ЗАМЕНЯЕТ прежнее «остаётся больший срок, дни не
 * складываются».
 *
 * Есть подписка и в боте, и на сайте: остаётся ОДИН ключ, а срок ему
 * ставится равным сумме остатков обеих подписок. Человек заплатил
 * дважды, и прежнее правило молча отнимало у него оплаченное — это
 * единственное, что нельзя объяснить в поддержке.
 *
 * СКЛАДЫВАЮТСЯ ОСТАТКИ, А НЕ СРОКИ. Остаток считается от «сейчас»:
 * сорок дней впереди на сайте плюс сто двадцать в боте дают сто
 * шестьдесят от сегодняшнего дня. Истёкшая сторона даёт ноль, а не
 * отрицательные дни, — отсюда `Math.max(0, …)`.
 *
 * ВЫЖИВАЕТ КЛЮЧ С БОЛЬШИМ СРОКОМ — это осталось прежним, и намеренно:
 * ключ, в который вложено больше времени, скорее и есть тот, что
 * прописан у человека в приложении. Второй гасится, ничего
 * перенастраивать не нужно. При равенстве остаётся сайт.
 *
 * Сторона сайта — сам аккаунт или ботовская «заготовка», если её срок
 * больше. Когда живого нет ни у кого, аккаунт остаётся при своей
 * сущности (или забирает истёкшую ботовскую, чтобы будущая оплата
 * оживила ОДИН ключ).
 */
/**
 * Сторона, на которой в эту секунду стоит человек. Из неё следует, какой
 * ключ прописан у него в приложении (раздел 17 ТЗ).
 * `null` — человека рядом нет (сверка): решаем по сроку, как раньше.
 */
export type ActorSide = "bot" | "site" | null;

/** Откуда пришла связка → на какой стороне человек. */
export function actorSideOf(via: LinkVia): ActorSide {
  if (via === "bot_email") return "bot";
  if (via === "site_token" || via === "legacy_token") return "site";
  return null; // relink — сверка, человека рядом нет
}

export function decideMerge(
  c: { site: MergeCandidate | null; placeholder: MergeCandidate | null; bot: MergeCandidate | null },
  now = Date.now(),
  actor: ActorSide = null
): MergeDecision {
  const siteSide = [c.site, c.placeholder]
    .filter((x): x is MergeCandidate => !!x && x.live)
    .sort((a, b) => b.end - a.end)[0] ?? null;
  const bot = c.bot && c.bot.live ? c.bot : null;

  let kept: KeptSide;
  let winner: MergeCandidate | null;
  /** Остаток проигравшей стороны, который прибавится к сроку победителя. */
  let addMs = 0;
  if (siteSide && bot) {
    /**
     * КЛЮЧ ТОЙ СТОРОНЫ, ОТКУДА ПРИШЁЛ ЧЕЛОВЕК (владелец, 20.09.2026,
     * раздел 17 ТЗ). Отменяет прежнее «остаётся больший срок».
     *
     * Человек всю жизнь пользовался ботом, ключ прописан у него в
     * приложении, он вводит почту — а на сайте подписка оказалась
     * длиннее. По старому правилу гасился именно ботовский ключ, тот
     * самый, что у него настроен: нажал нашу кнопку и остался без
     * интернета.
     *
     * Он стоит на одной из сторон, и ключ в приложении — её. Её и
     * оставляем. Выбирать «подлиннее» больше незачем: дни складываются
     * ниже, и срок не теряется при любом исходе.
     *
     * Человека рядом нет (сверка, `actor === null`) — тогда решает срок,
     * как раньше: гадать, каким ключом он пользуется, мы не можем.
     */
    if (actor === "bot") winner = bot;
    else if (actor === "site") winner = siteSide;
    else winner = bot.end > siteSide.end ? bot : siteSide;
    kept = winner === bot ? "bot" : "site";
    const loser = winner === bot ? siteSide : bot;
    addMs = Math.max(0, loser.end - now);
  } else if (bot) {
    winner = bot;
    kept = "only-bot";
  } else if (siteSide) {
    winner = siteSide;
    kept = "only-site";
  } else {
    winner = null;
    kept = "none";
  }

  const keptEntity = winner ? winner.entity : c.site?.entity ?? c.placeholder?.entity ?? c.bot?.entity ?? null;
  const disable = [c.site, c.placeholder, c.bot]
    .filter((x): x is MergeCandidate => !!x && !!x.entity && x.entity.id !== keptEntity?.id && panelEntityLive(x.entity, now))
    .map((x) => x.entity!.id);
  return {
    kept,
    winner,
    keptEntity,
    newEnd: winner ? winner.end + addMs : null,
    addedMs: addMs,
    disable: Array.from(new Set(disable)),
  };
}

// ─── Panel reads ─────────────────────────────────────────────────

type Read = { ok: true; user: PanelUser | null } | { ok: false; error: RwError };

async function readPanelId(id: number | null): Promise<Read> {
  if (id === null) return { ok: true, user: null };
  const r = await rwGetUserById(id);
  if (r.ok) return { ok: true, user: r.data };
  if (isUserGone(r)) return { ok: true, user: null };
  return { ok: false, error: r };
}

function acceptableBotPremium(u: PanelUser, telegramId: string, strictTelegramId: boolean): boolean {
  if (isSiteUsername(u.username) || isBypassEntity(u)) return false;
  const exp = Date.parse(u.expireAt);
  if (Number.isFinite(exp) && exp > SANE_PREMIUM_MAX_MS) return false;
  return strictTelegramId ? String(u.telegramId) === telegramId : u.telegramId === null || String(u.telegramId) === telegramId;
}

/** The bot's premium entity of this Telegram id: the hinted id (must carry telegramId = id) or `tg_{id}_premium`. */
export async function findBotPremium(telegramId: string, hintId: number | null): Promise<Read> {
  if (hintId !== null) {
    const r = await rwGetUserById(hintId);
    if (r.ok && acceptableBotPremium(r.data, telegramId, true)) return { ok: true, user: r.data };
    if (!r.ok && r.kind !== "not_found") return { ok: false, error: r };
    if (r.ok) console.warn(`[LINK] premiumPanelUserId ${hintId} is not the bot premium of TG:${telegramId} — ignored`);
  }
  const r = await getUserByUsername(botPremiumUsername(telegramId));
  if (r.ok) return { ok: true, user: acceptableBotPremium(r.data, telegramId, false) ? r.data : null };
  if (r.kind === "not_found" || r.kind === "validation") return { ok: true, user: null };
  return { ok: false, error: r };
}

interface PanelSide {
  site: PanelUser | null;
  placeholder: PanelUser | null;
  bot: PanelUser | null;
  botBypass: PanelUser | null;
}

async function readPanelSide(telegramId: string, hintId: number | null, target: UserRecord | null, placeholder: UserRecord | null): Promise<{ ok: true; side: PanelSide } | { ok: false; error: RwError }> {
  const [site, ph, bot] = await Promise.all([
    readPanelId(target?.panelUserId ?? null),
    readPanelId(placeholder?.panelUserId ?? null),
    findBotPremium(telegramId, hintId),
  ]);
  for (const r of [site, ph, bot]) if (!r.ok) return { ok: false, error: r.error };
  // Bypass is not needed to decide the premium merge: a failed read only
  // means it is remembered later (getBypassForUser), not a failed link.
  const bp = await findBotBypass(telegramId);
  return {
    ok: true,
    side: {
      site: (site as { user: PanelUser | null }).user,
      placeholder: (ph as { user: PanelUser | null }).user,
      bot: (bot as { user: PanelUser | null }).user,
      botBypass: bp.ok ? bp.user : null,
    },
  };
}

// ─── SQL shared by link and adoption ─────────────────────────────

const MARK_VERIFIED_SQL = `UPDATE users SET email = COALESCE($2, email),
       email_verified_at = COALESCE(email_verified_at, NOW()),
       trial_used_at = CASE WHEN $3::boolean THEN COALESCE(trial_used_at, NOW()) ELSE trial_used_at END
     WHERE id = $1`;

const LINK_UPDATE_SQL = `UPDATE users SET
       telegram_id = $2, telegram_linked = ($2::text IS NOT NULL),
       telegram_linked_at = CASE WHEN $2::text IS NOT NULL THEN NOW() ELSE telegram_linked_at END,
       link_kept = $3, link_disabled_panel_user_id = $4, link_disable_ids = $5, link_panel_state = 'pending',
       panel_user_id = $6, remnawave_user_uuid = $7, remnawave_short_uuid = $8, subscription_url = $9,
       panel_username = $10, panel_status = $11, panel_expire_at = $12,
       bypass_origin = CASE WHEN $13::bigint IS NOT NULL AND $13::bigint IS DISTINCT FROM bypass_panel_user_id THEN 'bot' ELSE bypass_origin END,
       bypass_subscription_url = CASE WHEN $13::bigint IS NOT NULL AND $13::bigint IS DISTINCT FROM bypass_panel_user_id THEN NULL ELSE bypass_subscription_url END,
       bypass_panel_user_id = COALESCE($13, bypass_panel_user_id),
       happ_crypto_link = NULL, crypto_link_updated_at = NULL,
       panel_sync_state = 'pending', panel_sync_attempts = 0, panel_next_sync_at = NOW()
     WHERE id = $1`;

const ABSORB_PLACEHOLDER_SQL = `UPDATE users SET
       telegram_id = NULL, telegram_linked = FALSE, link_kept = 'absorbed',
       panel_user_id = NULL, remnawave_user_uuid = NULL, remnawave_short_uuid = NULL, subscription_url = NULL,
       panel_username = NULL, panel_status = NULL, panel_expire_at = NULL, bypass_panel_user_id = NULL,
       panel_sync_state = 'ok', panel_sync_attempts = 0, panel_next_sync_at = NULL
     WHERE id = $1`;

function linkUpdateParams(userId: string, telegramId: string | null, kept: string, disable: number[], entity: PanelUser | null, bypassId: number | null): unknown[] {
  return [
    userId,
    telegramId,
    kept,
    disable[0] ?? null,
    disable.length > 0 ? disable : null,
    entity?.id ?? null,
    entity ? String(entity.id) : null,
    entity?.shortUuid || null,
    entity?.subscriptionUrl || null,
    entity?.username ?? null,
    entity?.status || null,
    entity?.expireAt ? new Date(entity.expireAt) : null,
    bypassId,
  ];
}

async function oneUser(c: Queryable, sql: string, params: unknown[]): Promise<UserRecord | null> {
  const r = await c.query(sql, params);
  return r.rows[0] ? rowToUser(r.rows[0]) : null;
}

function conflictFor(target: UserRecord | null, byTg: UserRecord | null, telegramId: string): LinkFailure | null {
  if (byTg && !isPlaceholderEmail(byTg.email) && byTg.id !== target?.id) {
    return fail(409, "TELEGRAM_LINKED_OTHER", "Этот Telegram уже связан с другим аккаунтом сайта. Сначала отвяжите его.");
  }
  if (target?.telegramId && target.telegramId !== telegramId) {
    return fail(409, "EMAIL_LINKED_OTHER", "Этот аккаунт сайта уже связан с другим Telegram. Сначала отвяжите его в кабинете.");
  }
  return null;
}

const same = (a: UserRecord | null, b: UserRecord | null) =>
  (a?.id ?? null) === (b?.id ?? null) &&
  (a?.panelUserId ?? null) === (b?.panelUserId ?? null) &&
  (a?.bypassPanelUserId ?? null) === (b?.bypassPanelUserId ?? null) &&
  (a?.telegramId ?? null) === (b?.telegramId ?? null);

// ─── The link ────────────────────────────────────────────────────

type TxOut =
  | { kind: "retry" }
  | { kind: "fail"; result: LinkFailure }
  | {
      kind: "done";
      userId: string;
      kept: KeptSide;
      keptId: number | null;
      disable: number[];
      created: boolean;
      alreadyLinked: boolean;
      changed: boolean;
      bypassId: number | null;
      bypassMerge: { keep: PanelUser; otherId: number } | null;
    };

export async function linkTelegramAccount(input: LinkInput): Promise<LinkResult> {
  const telegramId = String(input.telegramId ?? "").trim();
  if (!isValidTelegramId(telegramId)) return fail(400, "VALIDATION", "telegramId: только цифры");
  const email = input.email ? input.email.trim().toLowerCase() : null;
  if (!input.userId && !email) return fail(400, "VALIDATION", "email или userId обязателен");
  await waitForDb();

  for (let attempt = 0; attempt < 3; attempt++) {
    // ── 1. Accounts, as seen before asking the panel ──
    const target0 = input.userId ? await getUserById(input.userId) : await getUserByEmail(email!);
    if (input.userId && !target0) return fail(404, "USER_NOT_FOUND", "Аккаунт не найден");
    const byTg0 = await getUserByTelegramId(telegramId);
    const early = conflictFor(target0, byTg0, telegramId);
    if (early) return early;
    const placeholder0 = byTg0 && isPlaceholderEmail(byTg0.email) && byTg0.id !== target0?.id ? byTg0 : null;

    // ── 2. Panel ──
    const read = await readPanelSide(telegramId, input.premiumPanelUserId ?? null, target0, placeholder0);
    if (!read.ok) {
      console.warn(`[LINK] TG:${telegramId}: panel unavailable — ${describeRwError(read.error)}`);
      return fail(503, "PANEL_UNAVAILABLE", "Панель подписок сейчас недоступна. Повторите через минуту.");
    }
    const side = read.side;

    // ── 3. Transaction ──
    const tx: TxOut = await withTransaction(async (c): Promise<TxOut> => {
      await lockLinkKey(c, `tg:${telegramId}`);
      await lockLinkKey(c, `email:${(email ?? target0!.email).toLowerCase()}`);
      // Строки аккаунтов — под FOR UPDATE: решение о сроке (decideMerge)
      // пишется абсолютной датой, и параллельный /api/bot/extend (он берёт
      // ту же блокировку строки) иначе мог закоммитить продление между
      // чтением и записью — связка затёрла бы свежий срок старым.
      let target = input.userId
        ? await oneUser(c, "SELECT * FROM users WHERE id = $1 FOR UPDATE", [input.userId])
        : await oneUser(c, "SELECT * FROM users WHERE email = $1 FOR UPDATE", [email]);
      const byTg = await oneUser(c, "SELECT * FROM users WHERE telegram_id = $1 ORDER BY created_at ASC LIMIT 1 FOR UPDATE", [telegramId]);
      if (!same(target, target0) || !same(byTg, byTg0)) return { kind: "retry" };
      const conflict = conflictFor(target, byTg, telegramId);
      if (conflict) return { kind: "fail", result: conflict };

      const alreadyLinked = !!target && !!byTg && target.id === byTg.id;
      let placeholder = byTg && isPlaceholderEmail(byTg.email) && byTg.id !== target?.id ? byTg : null;
      let siteEntity = side.site;
      let phEntity = side.placeholder;
      let created = false;
      let markTrial = false;

      if (!target) {
        if (placeholder) {
          // The bot's email-less account IS this person (same Telegram):
          // it takes the verified email instead of a second account.
          target = placeholder;
          siteEntity = phEntity;
          placeholder = null;
          phEntity = null;
        } else {
          const row = await insertUserRow(c, { email: email!, ip: input.ip || "telegram-bot" });
          if (!row) return { kind: "retry" }; // lost a race with a sign-up of this email
          target = rowToUser(row);
          created = true;
        }
        markTrial = true; // an account born from the link never gets the site trial
      }
      if (input.via === "bot_email") {
        await c.query(MARK_VERIFIED_SQL, [target.id, email !== target.email ? email : null, markTrial]);
        if (markTrial) await recordTrialUsage(c, { email: email!, ip: null, fingerprint: null });
        if (email) target = { ...target, email };
      }

      // Entities another account holds are theirs (e.g. the key stayed
      // with the old account after an unlink) — not a candidate here.
      const foreign = async (u: PanelUser | null) => {
        if (!u) return false;
        const owner = await panelIdOwner(c, u.id, target!.id);
        return owner !== null && owner !== placeholder?.id;
      };
      let bot = side.bot;
      if (bot && (bot.id === siteEntity?.id || bot.id === phEntity?.id)) bot = null;
      if (bot && (await foreign(bot))) bot = null;
      let botBypass = side.botBypass;
      if (botBypass && (await foreign(botBypass))) botBypass = null;

      const now = Date.now();
      const cand = (s: "site" | "placeholder", u: UserRecord | null, entity: PanelUser | null): MergeCandidate | null => {
        if (!u) return null;
        const end = new Date(u.subscriptionEnd).getTime();
        return { side: s, end, live: end - now > MIN_REMAINING_MS, entity };
      };
      const decision = decideMerge(
        {
          site: cand("site", target, siteEntity),
          placeholder: cand("placeholder", placeholder, phEntity),
          bot: bot ? { side: "bot", end: Date.parse(bot.expireAt), live: panelEntityLive(bot, now), entity: bot } : null,
        },
        now,
        actorSideOf(input.via)
      );
      const keptId = decision.keptEntity?.id ?? null;

      // Term (ledger — never a direct write).
      let plan: string | null = null;
      if (decision.winner?.side === "bot" && bot) plan = planFromBotDescription(bot.description) ?? planFromSiteTag(bot.tag) ?? "basic";
      else if (decision.winner?.side === "placeholder" && placeholder) plan = placeholder.subscriptionPlan;
      let ledgerApplied = false;
      const curEnd = new Date(target.subscriptionEnd).getTime();
      if (decision.newEnd !== null && (Math.abs(decision.newEnd - curEnd) > 1000 || (plan && plan !== target.subscriptionPlan))) {
        const led = await applySubscriptionEvent(c, {
          userId: target.id,
          kind: "link_merge",
          sourceId: `link:${telegramId}:${target.id}:${keptId ?? "none"}:${new Date(decision.newEnd).toISOString()}`,
          setEnd: new Date(decision.newEnd),
          plan,
          actor: `link:${input.via}`,
          meta: { telegramId, kept: decision.kept, keptPanelUserId: keptId, disabled: decision.disable, via: input.via },
        });
        ledgerApplied = led.applied;
      }

      // The placeholder hands its Telegram, key and bypass over and ends.
      if (placeholder) {
        const phEnd = new Date(placeholder.subscriptionEnd).getTime();
        if (phEnd > now) {
          await applySubscriptionEvent(c, {
            userId: placeholder.id,
            kind: "link_merge",
            sourceId: `link:absorbed:${placeholder.id}:${target.id}`,
            setEnd: new Date(now),
            actor: `link:${input.via}`,
            meta: { absorbedInto: target.id, telegramId },
          });
        }
        await c.query(ABSORB_PLACEHOLDER_SQL, [placeholder.id]);
      }

      // Bypass: the bot's `{id}` entity is the person's bypass. A different
      // one already on the account is merged into it after commit.
      let bypassId = target.bypassPanelUserId ?? placeholder?.bypassPanelUserId ?? null;
      let bypassMerge: { keep: PanelUser; otherId: number } | null = null;
      if (botBypass) {
        if (bypassId && bypassId !== botBypass.id) bypassMerge = { keep: botBypass, otherId: bypassId };
        bypassId = botBypass.id;
      }

      const changed =
        !alreadyLinked ||
        created ||
        ledgerApplied ||
        decision.disable.length > 0 ||
        keptId !== (target.panelUserId ?? null) ||
        bypassId !== (target.bypassPanelUserId ?? null);
      const keptLabel: KeptSide = changed ? decision.kept : ((target.linkKept as KeptSide | null) ?? decision.kept);
      if (changed) {
        await c.query(LINK_UPDATE_SQL, linkUpdateParams(target.id, telegramId, keptLabel, decision.disable, decision.keptEntity, bypassId));
      }
      return {
        kind: "done",
        userId: target.id,
        kept: keptLabel,
        keptId,
        disable: changed ? decision.disable : [],
        created,
        alreadyLinked,
        changed,
        bypassId,
        bypassMerge,
      };
    });

    if (tx.kind === "retry") continue;
    if (tx.kind === "fail") return tx.result;

    // ── 4. After commit ──
    const bonus = await grantTelegramBonus(tx.userId, telegramId).catch((err) => {
      console.error(`[LINK] bonus failed for ${tx.userId}:`, err instanceof Error ? err.message : err);
      return { granted: false as const, reason: "error" as const };
    });

    let bypassNote = "";
    if (tx.bypassMerge) {
      const other = await readPanelId(tx.bypassMerge.otherId);
      if (other.ok && other.user) {
        const m = await mergeBypassEntities(tx.bypassMerge.keep, other.user);
        bypassNote = m.ok ? `; bypass merged +${m.addedBytes}B, ${other.user.id} disabled` : `; bypass merge FAILED: ${m.error}`;
        if (!m.ok) console.error(`[LINK] bypass merge failed for ${tx.userId}: ${m.error}`);
      }
    }

    const sync = await syncUserToPanel(tx.userId);
    if (!sync.ok && sync.action !== "busy") console.warn(`[LINK] ${tx.userId.slice(0, 8)}: panel side deferred to the worker — ${sync.reason} ${sync.panelError ?? ""}`);

    const user = (await getUserById(tx.userId))!;
    if (tx.changed || bonus.granted) {
      await createNotificationForUser(user.id, "Telegram привязан", linkNotice(tx.kept, tx.disable.length > 0, bonus.granted));
    }
    await createAuditLog(
      "telegram.link",
      `TG:${telegramId} via ${input.via}; kept=${tx.kept} panel=${tx.keptId ?? "—"}; disabled=${tx.disable.join(",") || "—"}; bonus=${bonus.granted ? "granted" : bonus.reason}${tx.created ? "; account created" : ""}${tx.alreadyLinked ? "; repeat" : ""}${bypassNote}`,
      user.id,
      user.email
    );

    return {
      ok: true,
      user,
      alreadyLinked: tx.alreadyLinked,
      created: tx.created,
      kept: tx.kept,
      keptPanelUserId: tx.keptId,
      disabledPanelUserId: tx.disable[0] ?? (tx.changed ? null : user.linkDisabledPanelUserId),
      disabledPanelUserIds: tx.disable,
      bonusDays: bonus.granted ? TELEGRAM_BONUS_DAYS : 0,
      bonusReason: bonus.granted ? null : (bonus.reason ?? null),
      panelSynced: sync.ok,
      bypassPanelUserId: tx.bypassId,
    };
  }
  return fail(503, "BUSY", "Аккаунт меняется параллельным запросом. Повторите через несколько секунд.");
}

function linkNotice(kept: KeptSide, disabled: boolean, bonus: boolean): string {
  const days = `${TELEGRAM_BONUS_DAYS} ${plural(TELEGRAM_BONUS_DAYS, ["день", "дня", "дней"])}`;
  const parts: string[] = [];
  if (kept === "bot") {
    parts.push("Подписка из бота длиннее — теперь её ключ общий для бота и сайта.");
    if (disabled) parts.push("Прежний ключ сайта отключён: обновите подписку в приложении по ссылке из кабинета.");
  } else if (kept === "site") {
    parts.push("Общий ключ для бота и сайта — ключ из кабинета.");
    if (disabled) parts.push("Ключ, выданный ботом, отключён.");
  } else if (kept === "only-bot") {
    parts.push("Подписка из бота подключена к аккаунту — ключ общий для бота и сайта.");
  } else {
    parts.push("Бот и сайт теперь работают с одной подпиской.");
  }
  if (bonus) parts.push(`+${days} к подписке за привязку.`);
  return parts.join(" ");
}

// ─── Response shape shared by the bot endpoints ──────────────────

export function linkedSummary(user: UserRecord) {
  const msLeft = Math.max(0, new Date(user.subscriptionEnd).getTime() - Date.now());
  const isExpired = msLeft === 0;
  const link = isExpired ? null : user.subscriptionUrl;
  return {
    linked: !!user.telegramId,
    userId: user.id,
    email: user.email,
    panelUserId: user.panelUserId,
    subscriptionUrl: link,
    subscriptionEnd: user.subscriptionEnd,
    plan: isExpired ? "expired" : user.subscriptionPlan || "trial",
    daysLeft: Math.floor(msLeft / 86_400_000),
    isExpired,
  };
}

// ─── Unlink ──────────────────────────────────────────────────────

/**
 * Unlink keeps the subscription AND the key with the site account (owner
 * model); the panel entity loses its telegramId and gets the marker
 * `atlas-unlinked` (link-panel.ts). The bonus is never paid again
 * (telegram_bonus_claims). The bot's bypass stays the bot's.
 */
/**
 * Отвязка Telegram. `keep` — где остаётся подписка (раздел 16–17 ТЗ,
 * решение владельца 20.09.2026).
 *
 * `"site"` (умолчание, прежнее поведение) — ключ остаётся за аккаунтом
 * сайта, с сущности снимается Telegram ID и ставится маркер отвязки.
 *
 * `"bot"` — ключ возвращается боту: с сущности снимается маркер
 * `atlas-site`, Telegram ID на ней СОХРАНЯЕТСЯ, аккаунт сайта остаётся
 * без подписки. Дни при этом не пропадают: они на сущности, которой
 * теперь распоряжается бот.
 *
 * КЛЮЧ НЕ МЕНЯЕТСЯ НИ В ОДНОМ ИЗ ВАРИАНТОВ (правило 17). Сущность в
 * панели одна и та же; меняется только то, кто ведёт срок и куда
 * человек платит. Настроенное приложение продолжает работать.
 *
 * ПОЧЕМУ ПАНЕЛЬ ПРАВИТСЯ ДО БАЗЫ, А НЕ ВОРКЕРОМ. Боту нужен ответ
 * сейчас: пока маркер `atlas-site` не снят, сущность для него чужая и
 * трогать её нельзя. Поэтому при `keep: "bot"` панель правится в этом
 * же запросе, и результат уезжает полем `siteMarkerRemoved`. Не
 * получилось — ничего не меняем и честно говорим «не вышло»: отдать
 * владение на словах хуже, чем не отдать вовсе.
 */
export type UnlinkKeep = "site" | "bot";

export interface UnlinkOk {
  ok: true;
  user: UserRecord;
  previousTelegramId: string | null;
  telegramLinkToken: string;
  keep: UnlinkKeep;
  /** Срок на момент отвязки — авторитетный, его забирает бот при keep: "bot". */
  subscriptionEnd: string | null;
  /** Снят ли с сущности маркер `atlas-site`. Всегда true при keep: "site". */
  siteMarkerRemoved: boolean;
}

export async function unlinkTelegramAccount(
  userId: string,
  via: "bot" | "site",
  keep: UnlinkKeep = "site"
): Promise<UnlinkOk | { ok: false; status: 404 | 503; code: "NOT_LINKED" | "PANEL_UNAVAILABLE"; error: string }> {
  await waitForDb();
  const before = await getUserById(userId);
  if (!before || (!before.telegramId && !before.telegramLinked)) return { ok: false, status: 404, code: "NOT_LINKED", error: "Telegram не привязан" };
  const subscriptionEnd = before.subscriptionEnd ? new Date(before.subscriptionEnd).toISOString() : null;

  // keep: "bot" — сначала панель, и только при её согласии трогаем базу.
  let markerRemoved = true;
  if (keep === "bot" && before.panelUserId) {
    const cur = await rwGetUserById(before.panelUserId);
    if (!cur.ok) {
      return { ok: false, status: 503, code: "PANEL_UNAVAILABLE", error: "Панель недоступна. Попробуйте позже." };
    }
    const description = withMarkers(cur.data.description, { [PANEL_MARKERS.site]: null, [PANEL_MARKERS.unlinked]: null });
    const patched = await updateUser({ id: before.panelUserId, description });
    if (!patched.ok) {
      return { ok: false, status: 503, code: "PANEL_UNAVAILABLE", error: "Не удалось передать подписку боту. Попробуйте позже." };
    }
    markerRemoved = true;
  }

  const token = generateTelegramLinkToken();
  const row = await withTransaction(async (c) => {
    if (before.telegramId) await lockLinkKey(c, `tg:${before.telegramId}`);
    await lockLinkKey(c, `email:${before.email.toLowerCase()}`);
    const r = await c.query(
      keep === "bot"
        ? // Подписка уходит боту: аккаунт сайта расстаётся с ключом и со
          // сроком. Сущность в панели при этом не гасится и не меняется —
          // маркер уже снят выше, Telegram ID на ней остался, и бот
          // продолжает вести её сам. Ключ у человека тот же.
          `UPDATE users SET telegram_id = NULL, telegram_linked = FALSE, telegram_link_token = $2,
                  panel_user_id = NULL, remnawave_user_uuid = NULL, remnawave_short_uuid = NULL,
                  subscription_url = NULL, panel_username = NULL, panel_status = NULL, panel_expire_at = NULL,
                  subscription_end = NOW(), link_kept = 'given-to-bot',
                  bypass_panel_user_id = CASE WHEN bypass_origin = 'site' THEN bypass_panel_user_id ELSE NULL END,
                  bypass_origin = CASE WHEN bypass_origin = 'site' THEN 'site' ELSE NULL END,
                  bypass_subscription_url = CASE WHEN bypass_origin = 'site' THEN bypass_subscription_url ELSE NULL END,
                  link_panel_state = 'ok', panel_sync_state = 'ok'
           WHERE id = $1 AND (telegram_id IS NOT NULL OR telegram_linked) RETURNING *`
        : `UPDATE users SET telegram_id = NULL, telegram_linked = FALSE, telegram_link_token = $2,
              bypass_panel_user_id = CASE WHEN bypass_origin = 'site' THEN bypass_panel_user_id ELSE NULL END,
              bypass_origin = CASE WHEN bypass_origin = 'site' THEN 'site' ELSE NULL END,
              bypass_subscription_url = CASE WHEN bypass_origin = 'site' THEN bypass_subscription_url ELSE NULL END,
              link_panel_state = CASE WHEN panel_user_id IS NULL THEN link_panel_state ELSE 'unlink_pending' END,
              panel_sync_state = CASE WHEN panel_user_id IS NULL THEN panel_sync_state ELSE 'pending' END,
              panel_next_sync_at = CASE WHEN panel_user_id IS NULL THEN panel_next_sync_at ELSE NOW() END
       WHERE id = $1 AND (telegram_id IS NOT NULL OR telegram_linked) RETURNING *`,
      [userId, token]
    );
    return r.rows[0] ?? null;
  });
  if (!row) return { ok: false, status: 404, code: "NOT_LINKED", error: "Telegram не привязан" };
  const user = rowToUser(row);
  if (keep === "site" && user.panelUserId) requestPanelSync(user.id, "telegram-unlink");
  await createAuditLog(
    "telegram.unlink",
    keep === "bot"
      ? `TG:${before.telegramId} unlinked (${via}); key ${before.panelUserId ?? "—"} GIVEN TO BOT, site account left without a subscription`
      : `TG:${before.telegramId} unlinked (${via}); key ${user.panelUserId ?? "—"} stays with the account`,
    user.id,
    user.email
  );
  return {
    ok: true,
    user,
    previousTelegramId: before.telegramId,
    telegramLinkToken: token,
    keep,
    subscriptionEnd,
    siteMarkerRemoved: markerRemoved,
  };
}

// ─── E: sign-in adoption ─────────────────────────────────────────

/**
 * Sign-in by email code for an email with no site account: if the panel
 * holds a user with this email AND the marker `atlas-email-verified`
 * (the email was proven through OUR code flow), the new account takes
 * that key and its term, without a trial. Without the marker → null,
 * i.e. ordinary registration. Panel unavailable → null as well (sign-in
 * must not depend on the panel).
 */
export async function adoptVerifiedPanelAccount(emailRaw: string, ctx: { ip?: string | null } = {}): Promise<NewUserResult | null> {
  const email = emailRaw.trim().toLowerCase();
  const found = await findUsersByEmail(email);
  if (!found.ok) {
    console.warn(`[ADOPT] panel lookup failed for sign-up — ordinary registration: ${describeRwError(found)}`);
    return null;
  }
  const verified = found.data.filter((u) => hasMarker(u.description, PANEL_MARKERS.emailVerified) && u.status !== "DISABLED");
  const candidates = verified
    .filter((u) => !isBypassEntity(u))
    .sort((a, b) => Date.parse(b.expireAt) - Date.parse(a.expireAt));
  const best = candidates[0];
  if (!best) return null;

  /**
   * Ключ обхода того же человека (владелец, 20.09.2026: «если
   * пользователь найден, отдаются два ключа — `tg_{id}_premium` и
   * `{id}`»).
   *
   * Отдельного запроса к панели не делаем: бот пишет подтверждённую
   * почту в ОБЕ свои сущности, поэтому обход уже пришёл этим же
   * поиском по адресу. Берём тот, у которого Telegram ID совпадает с
   * премиум-ключом, — у одного адреса теоретически может оказаться
   * несколько.
   */
  const bypass = verified.find(
    (u) => isBypassEntity(u) && u.telegramId != null && best.telegramId != null && String(u.telegramId) === String(best.telegramId)
  ) ?? null;

  const out = await withTransaction(async (c) => {
    const tg = best.telegramId != null ? String(best.telegramId) : null;
    if (tg) await lockLinkKey(c, `tg:${tg}`);
    await lockLinkKey(c, `email:${email}`);
    const existing = await oneUser(c, "SELECT * FROM users WHERE email = $1", [email]);
    if (existing) return { kind: "exists" as const, user: existing };
    if (await panelIdOwner(c, best.id, "")) return { kind: "owned" as const };
    const row = await insertUserRow(c, { email, ip: ctx.ip ?? null });
    if (!row) return { kind: "owned" as const };
    const id = String(row.id);
    await c.query(MARK_VERIFIED_SQL, [id, null, true]);
    await recordTrialUsage(c, { email, ip: ctx.ip ?? null, fingerprint: null });
    if (panelEntityLive(best)) {
      await applySubscriptionEvent(c, {
        userId: id,
        kind: "link_merge",
        sourceId: `adopt:${best.id}:${new Date(Date.parse(best.expireAt)).toISOString()}`,
        setEnd: new Date(Date.parse(best.expireAt)),
        plan: planFromSiteTag(best.tag) ?? planFromBotDescription(best.description) ?? "basic",
        actor: "signin:adopt",
        meta: { panelUserId: best.id, panelUsername: best.username },
      });
    }
    let linkTg = tg;
    if (linkTg && (await oneUser(c, "SELECT * FROM users WHERE telegram_id = $1 ORDER BY created_at ASC LIMIT 1", [linkTg]))) linkTg = null;
    await c.query(LINK_UPDATE_SQL, linkUpdateParams(id, linkTg, "adopted", [], best, bypass ? bypass.id : null));
    return { kind: "created" as const, user: (await oneUser(c, "SELECT * FROM users WHERE id = $1", [id]))! };
  });

  if (out.kind === "owned") return null;
  if (out.kind === "exists") return { ...out.user, isNew: false, trialGranted: false, trialBlockedReason: null };
  requestPanelSync(out.user.id, "signin-adopt");
  await createAuditLog(
    "user.adopt_panel",
    `panel user ${best.id} (${best.username}) adopted on sign-in; no trial${bypass ? `; bypass ${bypass.id} (${bypass.username})` : ""}`,
    out.user.id,
    out.user.email,
    ctx.ip || undefined
  );
  return { ...out.user, isNew: true, trialGranted: false, trialBlockedReason: null };
}

/** Owner of a panel id among local accounts — exported for routes that need a quick check. */
export async function localOwnerOfPanelId(panelId: number, exceptUserId = ""): Promise<string | null> {
  return panelIdOwner(pool, panelId, exceptUserId);
}
