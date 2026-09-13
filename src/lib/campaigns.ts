/**
 * Рассылки и массовые начисления (владелец, 13.09.2026).
 *
 * Кампания = аудитория + содержимое + канал (+ начисление). Черновик
 * запускается один раз: получатели фиксируются строками email_deliveries
 * (PRIMARY KEY (campaign_id, user_id) — одно письмо на человека на
 * кампанию), дальше очередь идёт фоном под advisory lock:
 *
 *   фаза 1 — начисления и уведомления в кабинете, всем получателям сразу,
 *            без суточной квоты писем (подарок не ждёт дни, пока уйдут
 *            письма). Дни — событие журнала admin_grant с
 *            source_id = campaign:<id>:user:<userId> (повтор не начисляет);
 *            ГБ обхода — строка bypass_grants с тем же ключом + ':traffic',
 *            панель применяет bypass-grants.ts (создаёт ST…_bp, если его
 *            нет). Панель недоступна → получатель ждёт («начисление в
 *            очереди»), письмо ему уйдёт только после начисления;
 *   фаза 2 — письма пачками Resend batch (≤ 100), не больше
 *            RESEND_DAILY_LIMIT за скользящие 24 часа (счёт по
 *            email_deliveries.sent_at). Ключ идемпотентности пачки
 *            закреплён за строками (batch_id), поэтому повтор после сбоя
 *            или рестарта отправляет ту же пачку с тем же ключом и Resend
 *            её не дублирует.
 *
 * Кому что уходит:
 *   service   — всем с настоящим адресом (согласие и отписка не важны:
 *               начисления, изменения условий);
 *   marketing — только marketing_consent_at IS NOT NULL AND
 *               marketing_opt_out_at IS NULL (consent.ts); остальные —
 *               skipped_optout / skipped_no_consent. Начисление в рекламной
 *               кампании запрещено: письмо о подарке — сервисное.
 *   Адреса-заглушки бота (telegram_<id>@tg.…) — skipped_placeholder: без
 *   письма, но с начислением и уведомлением в кабинете.
 *
 * Движок не знает про Postgres и Resend: он получает CampaignRepo, Mailer
 * и TrafficGranter (campaigns-pg.ts — боевые, тесты — свои).
 */

import { applySubscriptionEvent, DAY, extendFrom, withTransaction } from "./subscription-ledger";
import { USER_FILTERS, type UserFilter } from "./admin-users";
import {
  buildCampaignEmail,
  PLAN_TITLES,
  recipientVars,
  renderMarkdown,
  renderSubject,
  unknownPlaceholders,
  PLACEHOLDERS,
  type CampaignEmail,
  type TemplateVars,
} from "./campaign-email";
import { siteBaseUrl, unsubscribeLinks } from "./unsubscribe";
import { GB, formatTraffic } from "./traffic-packs";

// ─── Модель ──────────────────────────────────────────────────────

export const CAMPAIGN_KINDS = ["service", "marketing"] as const;
export type CampaignKind = (typeof CAMPAIGN_KINDS)[number];
export const CAMPAIGN_CHANNELS = ["email", "site", "both"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];
export const CAMPAIGN_STATUSES = ["draft", "queued", "sending", "paused", "done", "cancelled"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const DELIVERY_STATUSES = ["queued", "sent", "failed", "skipped_optout", "skipped_no_consent", "skipped_invalid", "skipped_placeholder"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export const GRANT_PLANS = ["trial", "basic", "plus"] as const;
export type GrantPlan = (typeof GRANT_PLANS)[number];

export type Audience = { type: "filter"; filter: UserFilter; q: string | null } | { type: "list"; entries: string[] };

/** Хотя бы одно: дни (с тарифом) или ГБ обхода. */
export interface GrantSpec {
  plan: GrantPlan | null;
  days: number | null;
  trafficGb: number | null;
}

export interface CampaignInput {
  kind: CampaignKind;
  channel: CampaignChannel;
  subject: string;
  bodyMd: string;
  audience: Audience;
  grant: GrantSpec | null;
}

export interface DeliveryCounts {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  skipped_optout: number;
  skipped_no_consent: number;
  skipped_invalid: number;
  skipped_placeholder: number;
  /** Начисление сделано. */
  granted: number;
  /** Начисление ещё не сделано (ждёт панель или очередь). */
  grant_pending: number;
  /** Уведомление в кабинете создано. */
  notified: number;
}

export const EMPTY_COUNTS: DeliveryCounts = {
  total: 0,
  queued: 0,
  sent: 0,
  failed: 0,
  skipped_optout: 0,
  skipped_no_consent: 0,
  skipped_invalid: 0,
  skipped_placeholder: 0,
  granted: 0,
  grant_pending: 0,
  notified: 0,
};

export interface Campaign extends CampaignInput {
  id: string;
  status: CampaignStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  counts: DeliveryCounts | null;
  lastError: string | null;
}

export const SUBJECT_MAX = 150;
export const BODY_MAX = 20_000;
export const LIST_MAX = 5_000;
/** Как у разовой выдачи (admin-actions.ts) и потолка одного события журнала. */
export const GRANT_MAX_DAYS = 400;
/** Как у ручного начисления ГБ в карточке (bypass-grants.ts). */
export const GRANT_MAX_GB = 5_000;
export const EMAIL_BATCH_MAX = 100;
export const MAX_ATTEMPTS = 6;
export const BATCH_PAUSE_MS = 1_000;
export const SIDE_EFFECTS_PER_PASS = 300;
export const MAX_BATCHES_PER_PASS = 50;
const OWED_RECHECK_MS = 5 * 60 * 1000;
const QUOTA_RETRY_MS = 60 * 60 * 1000;

export function retryBackoffMs(attempts: number): number {
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * RESEND_DAILY_LIMIT — писем рассылок за скользящие 24 ч. По умолчанию 80:
 * бесплатный Resend даёт 100 в сутки на всё, и 20 остаются кодам входа.
 */
export const DEFAULT_DAILY_LIMIT = 80;

export function dailyLimit(raw: string | undefined = process.env.RESEND_DAILY_LIMIT): number {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 1 ? n : DEFAULT_DAILY_LIMIT;
}

export const sendsEmail = (c: Pick<CampaignInput, "channel">) => c.channel !== "site";

/** Строки, у которых письма не будет, но есть начисление (и уведомление о нём). */
export const NO_EMAIL_STATUSES: readonly DeliveryStatus[] = ["skipped_invalid", "skipped_placeholder"];

// ─── Адреса ──────────────────────────────────────────────────────

/** Та же проверка, что isPlaceholderEmail в store.ts (аккаунты бота без почты). */
export function isPlaceholderAddress(email: string): boolean {
  return /^telegram_\d+@tg\./i.test(email);
}

export function isDeliverableAddress(email: string): boolean {
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !isPlaceholderAddress(email);
}

/** Статус получателя при запуске — то же правило, что CASE в campaigns-pg.ts. */
export function deliveryStatusFor(
  kind: CampaignKind,
  channel: CampaignChannel,
  u: { email: string; marketingConsentAt: unknown; marketingOptOutAt: unknown }
): DeliveryStatus {
  if (kind === "marketing" && u.marketingOptOutAt != null) return "skipped_optout";
  if (kind === "marketing" && u.marketingConsentAt == null) return "skipped_no_consent";
  if (channel !== "site" && isPlaceholderAddress(u.email)) return "skipped_placeholder";
  if (channel !== "site" && !isDeliverableAddress(u.email)) return "skipped_invalid";
  return "queued";
}

// ─── Проверка ввода ──────────────────────────────────────────────

type Fail = { ok: false; error: string };

/** Столбец адресов / ID / ST-номеров: переводы строк, запятые, пробелы. */
export function parseAudienceList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const t = raw.trim().replace(/^<|>$/g, "");
    if (!t) continue;
    const v = t.includes("@") ? t.toLowerCase() : t;
    if (v.length > 254 || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function parseAudience(raw: unknown): { ok: true; audience: Audience } | Fail {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Выберите аудиторию" };
  const a = raw as Record<string, unknown>;
  if (a.type === "filter") {
    const filter = String(a.filter ?? "");
    if (!(USER_FILTERS as readonly string[]).includes(filter)) return { ok: false, error: `Неизвестный фильтр аудитории «${filter}»` };
    const q = typeof a.q === "string" ? a.q.trim().slice(0, 200) || null : null;
    return { ok: true, audience: { type: "filter", filter: filter as UserFilter, q } };
  }
  if (a.type === "list") {
    const entries = Array.isArray(a.entries)
      ? parseAudienceList(a.entries.filter((x): x is string => typeof x === "string").join("\n"))
      : typeof a.text === "string"
        ? parseAudienceList(a.text)
        : [];
    if (entries.length === 0) return { ok: false, error: "Вставьте адреса или ID — по одному в строке" };
    if (entries.length > LIST_MAX) return { ok: false, error: `Список — не больше ${LIST_MAX.toLocaleString("ru-RU")} строк` };
    return { ok: true, audience: { type: "list", entries } };
  }
  return { ok: false, error: "Аудитория: фильтр или список" };
}

export function parseGrant(raw: unknown): { ok: true; grant: GrantSpec | null } | Fail {
  if (raw === null || raw === undefined || raw === false) return { ok: true, grant: null };
  if (typeof raw !== "object") return { ok: false, error: "Неверное начисление" };
  const g = raw as Record<string, unknown>;
  // 0 — не «пусто», а ошибка ввода: пустое поле формы приходит null / "".
  const empty = (v: unknown) => v === null || v === undefined || v === "";

  let days: number | null = null;
  let plan: GrantPlan | null = null;
  if (!empty(g.days)) {
    const d = Number(g.days);
    if (!Number.isInteger(d) || d < 1 || d > GRANT_MAX_DAYS) return { ok: false, error: `Дни — целое число от 1 до ${GRANT_MAX_DAYS}` };
    if (typeof g.plan !== "string" || !(GRANT_PLANS as readonly string[]).includes(g.plan)) return { ok: false, error: "Выберите тариф для дней: Пробный, Basic или Plus" };
    days = d;
    plan = g.plan as GrantPlan;
  }
  let trafficGb: number | null = null;
  if (!empty(g.trafficGb)) {
    const gb = Number(g.trafficGb);
    if (!Number.isInteger(gb) || gb < 1 || gb > GRANT_MAX_GB) return { ok: false, error: `Трафик — целое число гигабайт от 1 до ${GRANT_MAX_GB.toLocaleString("ru-RU")}` };
    trafficGb = gb;
  }
  if (days === null && trafficGb === null) return { ok: true, grant: null };
  return { ok: true, grant: { plan, days, trafficGb } };
}

export function parseCampaignInput(raw: unknown): { ok: true; input: CampaignInput } | Fail {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Пустой запрос" };
  const b = raw as Record<string, unknown>;
  const kind = b.kind;
  if (typeof kind !== "string" || !(CAMPAIGN_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Тип: служебная или рекламная" };
  const channel = b.channel ?? "email";
  if (typeof channel !== "string" || !(CAMPAIGN_CHANNELS as readonly string[]).includes(channel)) return { ok: false, error: "Канал: письмо, кабинет или оба" };
  const subject = typeof b.subject === "string" ? b.subject.replace(/[\r\n\t]+/g, " ").trim() : "";
  if (!subject) return { ok: false, error: "Укажите тему (заголовок уведомления)" };
  if (subject.length > SUBJECT_MAX) return { ok: false, error: `Тема — не длиннее ${SUBJECT_MAX} символов` };
  const bodyMd = typeof b.bodyMd === "string" ? b.bodyMd.replace(/\r\n?/g, "\n").trim() : "";
  if (!bodyMd) return { ok: false, error: "Напишите текст" };
  if (bodyMd.length > BODY_MAX) return { ok: false, error: `Текст — не длиннее ${BODY_MAX.toLocaleString("ru-RU")} символов` };
  const bad = unknownPlaceholders(subject, bodyMd);
  if (bad.length > 0) {
    return { ok: false, error: `Неизвестная подстановка {{${bad[0]}}}. Можно: ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}` };
  }
  const aud = parseAudience(b.audience);
  if (!aud.ok) return aud;
  const g = parseGrant(b.grant);
  if (!g.ok) return g;
  if (g.grant && kind === "marketing") {
    return { ok: false, error: "Письмо о подарке — сервисное: выберите тип «Служебная». С призывом купить — рекламное, но без начисления" };
  }
  return { ok: true, input: { kind: kind as CampaignKind, channel: channel as CampaignChannel, subject, bodyMd, audience: aud.audience, grant: g.grant } };
}

// ─── Оценка времени ──────────────────────────────────────────────

export interface Estimate {
  emails: number;
  /** Уйдут в ближайшие минуты (в пределах свободной квоты). */
  soon: number;
  /** Ждут следующих суток. */
  later: number;
  /** Сколько суток займёт остаток (0 — всё сразу). */
  days: number;
  text: string;
}

const sutki = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "сутки" : "суток");

/**
 * Письма уходят не быстрее limit за скользящие 24 часа. Письма других
 * активных кампаний (ahead) идут раньше. Оценка грубая, но честная: не
 * обещает быстрее, чем позволяет квота.
 */
export function estimateSend(p: { emails: number; ahead: number; limit: number; sentLast24h: number }): Estimate {
  const emails = Math.max(0, p.emails);
  const limit = Math.max(1, p.limit);
  const free = Math.max(0, limit - p.sentLast24h);
  const aheadNow = Math.min(p.ahead, free);
  const soon = Math.min(emails, free - aheadNow);
  const later = emails - soon;
  const days = later > 0 ? Math.ceil((later + (p.ahead - aheadNow)) / limit) : 0;
  let text: string;
  if (emails === 0) text = "Писем не будет";
  else if (later === 0) text = `Все ${emails.toLocaleString("ru-RU")} уйдут в ближайшие минуты`;
  else if (soon === 0) text = `Квота на сутки занята — письма пойдут по мере её освобождения, около ${days} ${sutki(days)} (лимит ${limit} писем за 24 часа)`;
  else text = `${soon.toLocaleString("ru-RU")} — в ближайшие минуты, остальные ${later.toLocaleString("ru-RU")} — примерно за ${days} ${sutki(days)} (лимит ${limit} писем за 24 часа)`;
  return { emails, soon, later, days, text };
}

// ─── Зависимости движка ──────────────────────────────────────────

export interface OutgoingEmail extends CampaignEmail {
  to: string;
}

export type MailerFailure = "rate_limit" | "quota" | "transient" | "invalid" | "fatal";
export type MailerResult = { ok: true; ids: Array<string | null> } | { ok: false; kind: MailerFailure; message: string };

export interface Mailer {
  sendBatch(emails: OutgoingEmail[], idempotencyKey: string): Promise<MailerResult>;
}

export type TrafficCredit = { state: "done" } | { state: "owed"; error: string | null } | { state: "conflict"; error: string | null };

/** Начисление ГБ обхода одному человеку, идемпотентно по (кампания, человек). */
export interface TrafficGranter {
  credit(campaignId: string, userId: string, bytes: number, note: string): Promise<TrafficCredit>;
}

export interface DeliveryRow {
  userId: string;
  email: string;
  status: DeliveryStatus;
  attempts: number;
  batchId: string | null;
  token: string | null;
  subscriptionEnd: Date;
  plan: string | null;
  grantedAt: Date | null;
  notifiedAt: Date | null;
}

export interface AudiencePreview {
  /** Совпало пользователей. */
  total: number;
  byStatus: Record<Exclude<DeliveryStatus, "sent" | "failed">, number>;
  /** Отписались от рекламы (для служебной — всё равно получат). */
  optedOut: number;
  /** Строки списка, которых нет на сайте. */
  notFound: string[];
  /** Первые 20 адресов, кому уйдёт письмо (для кабинета — всем). */
  sample: string[];
  first: { userId: string; email: string; subscriptionEnd: Date; plan: string | null } | null;
}

export interface CampaignRepo {
  create(input: CampaignInput, createdBy: string | null): Promise<Campaign>;
  updateDraft(id: string, input: CampaignInput): Promise<Campaign | null>;
  get(id: string): Promise<Campaign | null>;
  list(limit: number): Promise<Campaign[]>;
  transition(id: string, from: CampaignStatus[], to: CampaignStatus, patch?: { started?: boolean; finished?: boolean; lastError?: string | null }): Promise<Campaign | null>;
  setLastError(id: string, error: string | null): Promise<void>;
  saveCounts(id: string, counts: DeliveryCounts): Promise<void>;
  counts(c: Campaign): Promise<DeliveryCounts>;
  failures(id: string, limit: number): Promise<Array<{ email: string; status: DeliveryStatus; error: string | null; attempts: number }>>;
  previewAudience(aud: Audience, kind: CampaignKind, channel: CampaignChannel): Promise<AudiencePreview>;
  /** draft → queued + строки получателей, атомарно. null — это уже не черновик. */
  queueCampaign(id: string): Promise<{ campaign: Campaign; inserted: number } | null>;
  active(): Promise<Campaign[]>;
  sideEffectsDue(c: Campaign, now: Date, limit: number): Promise<DeliveryRow[]>;
  markGranted(id: string, userId: string, at: Date): Promise<void>;
  markNotified(id: string, userId: string, at: Date): Promise<void>;
  /** Уведомление в кабинете с детерминированным id; false — уже было. */
  insertNotification(notificationId: string, userId: string, title: string, message: string): Promise<boolean>;
  markSiteSent(id: string, userId: string, at: Date): Promise<void>;
  /** Рекламная: кто отписался / снял согласие после запуска — не получает. */
  skipIneligibleMarketing(id: string): Promise<number>;
  sentEmailsSince(since: Date): Promise<number>;
  queuedEmails(excludeId: string | null): Promise<number>;
  claimBatch(c: Campaign, max: number, now: Date): Promise<DeliveryRow[]>;
  releaseBatch(id: string, batchId: string): Promise<void>;
  markSent(id: string, sent: Array<{ userId: string; resendId: string | null }>, at: Date): Promise<void>;
  markRetry(id: string, userIds: string[], error: string, nextAt: Date, maxAttempts: number): Promise<void>;
  markFailed(id: string, userIds: string[], error: string): Promise<void>;
  /** Отложить без траты попытки (квота, панель недоступна). */
  defer(id: string, userIds: string[], nextAt: Date, error: string): Promise<void>;
  ensureTokens(userIds: string[]): Promise<Map<string, string>>;
  /** Строк, по которым ещё что-то должно случиться. */
  remaining(c: Campaign): Promise<number>;
  userForTest(email: string): Promise<{ userId: string; email: string; subscriptionEnd: Date; plan: string | null; token: string | null } | null>;
}

export interface EngineDeps {
  repo: CampaignRepo;
  mailer: Mailer;
  traffic: TrafficGranter;
  limit: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  batchSize?: number;
}

// ─── Начисление ──────────────────────────────────────────────────

export const campaignGrantSourceId = (campaignId: string, userId: string) => `campaign:${campaignId}:user:${userId}`;
export const campaignTrafficGrantId = (campaignId: string, userId: string) => `campaign:${campaignId}:user:${userId}:traffic`;

const PLAN_RANK: Record<string, number> = { trial: 0, basic: 1, plus: 2 };

/**
 * Какой тариф поставить при подарке. Подарок не понижает: у кого сейчас
 * действует тариф выше подарочного (Plus при подарке Basic), тариф
 * остаётся, прибавляются только дни. У истёкших — тариф подарка.
 * null — оставить текущий.
 */
export function planAfterGrant(current: string | null, currentEnd: Date, grantPlan: GrantPlan, now: Date): GrantPlan | null {
  const active = currentEnd.getTime() > now.getTime();
  if (active && (PLAN_RANK[current ?? ""] ?? -1) > PLAN_RANK[grantPlan]) return null;
  return grantPlan;
}

/** Дни подарка — одно событие журнала на человека на кампанию. */
export async function applyCampaignDays(
  campaignId: string,
  userId: string,
  grant: { plan: GrantPlan; days: number },
  now: Date = new Date()
): Promise<{ applied: boolean; newEnd: Date; plan: string | null }> {
  return withTransaction(async (c) => {
    const cur = await c.query<{ subscription_end: Date; subscription_plan: string | null }>(
      "SELECT subscription_end, subscription_plan FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (cur.rows.length === 0) throw new Error("пользователь не найден");
    const oldPlan = cur.rows[0].subscription_plan ?? null;
    const setPlan = planAfterGrant(oldPlan, new Date(cur.rows[0].subscription_end), grant.plan, now);
    const r = await applySubscriptionEvent(c, {
      userId,
      kind: "admin_grant",
      sourceId: campaignGrantSourceId(campaignId, userId),
      extendMs: grant.days * DAY,
      plan: setPlan,
      actor: "admin",
      meta: { via: "campaign", campaignId, label: `${grant.days} дн.`, grantPlan: grant.plan },
    });
    return { applied: r.applied, newEnd: r.newEnd, plan: r.applied && setPlan ? setPlan : oldPlan };
  });
}

// ─── Письмо одному получателю ────────────────────────────────────

function varsFor(r: { email: string; subscriptionEnd: Date; plan: string | null }, now: Date): TemplateVars {
  return recipientVars(r, now, siteBaseUrl());
}

export function composeEmail(c: Pick<CampaignInput, "subject" | "bodyMd" | "kind">, r: DeliveryRow, now: Date): OutgoingEmail {
  const mail = buildCampaignEmail({ subject: c.subject, bodyMd: c.bodyMd, kind: c.kind, vars: varsFor(r, now), links: unsubscribeLinks(r.token ?? "") });
  return { to: r.email, ...mail };
}

// ─── Проход очереди ──────────────────────────────────────────────

export interface PassSummary {
  campaigns: number;
  granted: number;
  grantPending: number;
  notified: number;
  emailed: number;
  retried: number;
  failed: number;
  finished: number;
  stoppedBy: "limit" | MailerFailure | null;
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

function grantNote(c: Campaign): string {
  return `подарок: рассылка ${c.id.slice(0, 8)} «${c.subject.slice(0, 60)}»`;
}

async function sideEffectsFor(d: EngineDeps, c: Campaign, r: DeliveryRow, now: Date, sum: PassSummary): Promise<void> {
  let end = r.subscriptionEnd;
  let plan = r.plan;
  if (c.grant && !r.grantedAt) {
    if (c.grant.days && c.grant.plan) {
      const g = await applyCampaignDays(c.id, r.userId, { plan: c.grant.plan, days: c.grant.days }, now);
      end = g.newEnd;
      plan = g.plan;
    }
    if (c.grant.trafficGb) {
      const t = await d.traffic.credit(c.id, r.userId, Math.round(c.grant.trafficGb * GB), grantNote(c));
      if (t.state === "owed") {
        // Дни уже в журнале (повтор их не удвоит); ждём панель без траты попытки.
        await d.repo.defer(c.id, [r.userId], new Date(now.getTime() + OWED_RECHECK_MS), `Трафик ждёт панель: ${t.error ?? "нет ответа"}`);
        sum.grantPending += 1;
        return;
      }
      if (t.state === "conflict") {
        await d.repo.markFailed(c.id, [r.userId], `Трафик не начислен: ${t.error ?? "конфликт в панели"} — проверьте вручную`);
        sum.failed += 1;
        return;
      }
    }
    await d.repo.markGranted(c.id, r.userId, now);
    sum.granted += 1;
  }
  const notify = c.channel !== "email" || (!!c.grant && NO_EMAIL_STATUSES.includes(r.status));
  if (notify && !r.notifiedAt) {
    const vars = varsFor({ email: r.email, subscriptionEnd: end, plan }, now);
    const title = renderSubject(c.subject, vars);
    const message = renderMarkdown(c.bodyMd, vars).text.slice(0, 4000);
    await d.repo.insertNotification(`cmp:${c.id}:${r.userId}`, r.userId, title, message);
    await d.repo.markNotified(c.id, r.userId, now);
    sum.notified += 1;
  }
  if (c.channel === "site") await d.repo.markSiteSent(c.id, r.userId, now);
}

async function runSideEffects(d: EngineDeps, c: Campaign, now: Date, sum: PassSummary): Promise<void> {
  if (!c.grant && c.channel === "email") return;
  let done = 0;
  while (done < SIDE_EFFECTS_PER_PASS) {
    const rows = await d.repo.sideEffectsDue(c, now, Math.min(100, SIDE_EFFECTS_PER_PASS - done));
    if (rows.length === 0) return;
    for (const r of rows) {
      done += 1;
      try {
        await sideEffectsFor(d, c, r, now, sum);
      } catch (err) {
        await d.repo.markRetry(c.id, [r.userId], `Начисление: ${errText(err)}`, new Date(now.getTime() + retryBackoffMs(r.attempts + 1)), MAX_ATTEMPTS);
        sum.failed += 1;
      }
    }
    const cur = await d.repo.get(c.id);
    if (!cur || cur.status !== "sending") return;
  }
}

type Stop = MailerFailure | null;

async function handleFailure(
  d: EngineDeps,
  c: Campaign,
  rows: DeliveryRow[],
  res: { kind: MailerFailure; message: string },
  now: Date,
  sum: PassSummary
): Promise<Stop> {
  const ids = rows.map((r) => r.userId);
  if (res.kind === "rate_limit" || res.kind === "transient") {
    const attempts = Math.max(...rows.map((r) => r.attempts)) + 1;
    await d.repo.markRetry(c.id, ids, `Resend: ${res.message}`, new Date(now.getTime() + retryBackoffMs(attempts)), MAX_ATTEMPTS);
    sum.retried += ids.length;
    return res.kind;
  }
  if (res.kind === "quota") {
    await d.repo.defer(c.id, ids, new Date(now.getTime() + QUOTA_RETRY_MS), `Resend: ${res.message}`);
    await d.repo.setLastError(c.id, `Квота Resend исчерпана — продолжим позже (${res.message})`);
    return "quota";
  }
  // fatal: ключ, домен отправителя — дальше слать бессмысленно.
  await d.repo.transition(c.id, ["sending"], "paused", { lastError: `Отправка остановлена: ${res.message}` });
  return "fatal";
}

async function sendRows(d: EngineDeps, c: Campaign, rows: DeliveryRow[], now: Date, sum: PassSummary): Promise<{ sent: number; stop: Stop }> {
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const missing = rows.filter((r) => !r.token).map((r) => r.userId);
  if (missing.length > 0) {
    const t = await d.repo.ensureTokens(missing);
    for (const r of rows) if (!r.token) r.token = t.get(r.userId) ?? null;
  }
  const emails = rows.map((r) => composeEmail(c, r, now));
  const res = await d.mailer.sendBatch(emails, `cmp-${c.id}-${rows[0].batchId}`);
  if (res.ok) {
    await d.repo.markSent(c.id, rows.map((r, i) => ({ userId: r.userId, resendId: res.ids[i] ?? null })), now);
    sum.emailed += rows.length;
    return { sent: rows.length, stop: null };
  }
  if (res.kind !== "invalid") return { sent: 0, stop: await handleFailure(d, c, rows, res, now, sum) };

  // Пачку отклонила проверка (один плохой адрес губит все сто) — по одному,
  // с ключом на человека: повтор этого же пути ничего не задвоит.
  let sent = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const one = await d.mailer.sendBatch([emails[i]], `cmp-${c.id}-u-${r.userId}`);
    if (one.ok) {
      await d.repo.markSent(c.id, [{ userId: r.userId, resendId: one.ids[0] ?? null }], now);
      sent += 1;
      sum.emailed += 1;
    } else if (one.kind === "invalid") {
      await d.repo.markFailed(c.id, [r.userId], `Resend отклонил письмо: ${one.message}`);
      sum.failed += 1;
    } else {
      return { sent, stop: await handleFailure(d, c, rows.slice(i), one, now, sum) };
    }
    if (i < rows.length - 1) await sleep(BATCH_PAUSE_MS);
  }
  return { sent, stop: null };
}

/**
 * Один проход очереди. Вызывается воркером под advisory lock
 * (campaigns-pg.ts); сам по себе ничего не блокирует.
 */
export async function runCampaignPass(d: EngineDeps): Promise<PassSummary> {
  const now = d.now ?? (() => new Date());
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const batchSize = Math.max(1, Math.min(d.batchSize ?? EMAIL_BATCH_MAX, EMAIL_BATCH_MAX));
  const sum: PassSummary = { campaigns: 0, granted: 0, grantPending: 0, notified: 0, emailed: 0, retried: 0, failed: 0, finished: 0, stoppedBy: null };

  const list = await d.repo.active();
  sum.campaigns = list.length;
  if (list.length === 0) return sum;

  // Фаза 1: начисления и кабинет — без квоты писем.
  for (let c of list) {
    if (c.status === "queued") {
      const moved = await d.repo.transition(c.id, ["queued"], "sending", { started: true });
      if (!moved) continue;
      c = moved;
    }
    if (c.status !== "sending") continue;
    await runSideEffects(d, c, now(), sum);
  }

  // Фаза 2: письма под суточным лимитом.
  let budget = Math.max(0, d.limit - (await d.repo.sentEmailsSince(new Date(now().getTime() - DAY))));
  let batches = 0;
  outer: for (const c0 of list) {
    if (!sendsEmail(c0)) continue;
    if (budget <= 0) {
      sum.stoppedBy = "limit";
      break;
    }
    if (c0.kind === "marketing") await d.repo.skipIneligibleMarketing(c0.id);
    while (budget > 0 && batches < MAX_BATCHES_PER_PASS) {
      const c = await d.repo.get(c0.id);
      if (!c || c.status !== "sending") break;
      const rows = await d.repo.claimBatch(c, Math.min(batchSize, budget), now());
      if (rows.length === 0) break;
      if (rows.length > budget) {
        // Пачка на повтор больше, чем осталось квоты. Если она не влезет
        // и в полные сутки (лимит уменьшили) — разбираем её на новые.
        if (rows.length > d.limit && rows[0].batchId) await d.repo.releaseBatch(c.id, rows[0].batchId);
        sum.stoppedBy = "limit";
        break outer;
      }
      batches += 1;
      const out = await sendRows(d, c, rows, now(), sum);
      budget -= out.sent;
      if (out.stop) {
        sum.stoppedBy = out.stop;
        break outer;
      }
      if (budget > 0) await sleep(BATCH_PAUSE_MS);
    }
    if (budget <= 0) sum.stoppedBy = "limit";
  }

  // Итоги и завершение.
  for (const c0 of list) {
    const c = await d.repo.get(c0.id);
    if (!c) continue;
    await d.repo.saveCounts(c.id, await d.repo.counts(c));
    if (c.status === "sending" && (await d.repo.remaining(c)) === 0) {
      if (await d.repo.transition(c.id, ["sending"], "done", { finished: true })) sum.finished += 1;
    }
  }
  return sum;
}

// ─── Действия админки ────────────────────────────────────────────

export type ActionResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export interface GrantTotals {
  plan: GrantPlan | null;
  days: number | null;
  trafficGb: number | null;
  recipients: number;
  totalGb: number;
  label: string;
}

export function grantLabel(g: GrantSpec): string {
  const parts: string[] = [];
  if (g.days && g.plan) parts.push(`${PLAN_TITLES[g.plan]} +${g.days} дн.`);
  if (g.trafficGb) parts.push(`+${formatTraffic(g.trafficGb * GB)} обхода`);
  return parts.join(" и ");
}

export interface PreviewResult {
  audience: AudiencePreview;
  toEmail: number;
  toNotify: number;
  grant: GrantTotals | null;
  email: { subject: string; html: string; text: string } | null;
  notification: { title: string; message: string } | null;
  estimate: Estimate;
  limit: { daily: number; sentLast24h: number };
}

/** Кому достанется начисление и уведомление (все, кроме пропущенных рекламных). */
function eligible(a: AudiencePreview): number {
  return a.byStatus.queued + a.byStatus.skipped_invalid + a.byStatus.skipped_placeholder;
}

export async function previewCampaign(
  repo: CampaignRepo,
  input: CampaignInput,
  opts: { limit: number; now?: Date; excludeId?: string | null }
): Promise<PreviewResult> {
  const now = opts.now ?? new Date();
  const [audience, sentLast24h, ahead] = await Promise.all([
    repo.previewAudience(input.audience, input.kind, input.channel),
    repo.sentEmailsSince(new Date(now.getTime() - DAY)),
    repo.queuedEmails(opts.excludeId ?? null),
  ]);
  const toEmail = sendsEmail(input) ? audience.byStatus.queued : 0;
  const all = eligible(audience);
  const toNotify = input.channel === "email" ? (input.grant ? audience.byStatus.skipped_invalid + audience.byStatus.skipped_placeholder : 0) : all;
  const grant: GrantTotals | null = input.grant
    ? {
        plan: input.grant.plan,
        days: input.grant.days,
        trafficGb: input.grant.trafficGb,
        recipients: all,
        totalGb: (input.grant.trafficGb ?? 0) * all,
        label: grantLabel(input.grant),
      }
    : null;

  // Образец — первый получатель; дни подарка уже учтены в {{days_left}}.
  const f = audience.first;
  let end = f ? f.subscriptionEnd : new Date(now.getTime() + 30 * DAY);
  let plan = f ? f.plan : "plus";
  if (input.grant?.days && input.grant.plan) {
    end = extendFrom(end, input.grant.days * DAY, now);
    plan = planAfterGrant(plan, f ? f.subscriptionEnd : now, input.grant.plan, now) ?? plan;
  }
  const row: DeliveryRow = {
    userId: f?.userId ?? "preview",
    email: f?.email ?? "user@example.com",
    status: "queued",
    attempts: 0,
    batchId: null,
    token: "PREVIEW",
    subscriptionEnd: end,
    plan,
    grantedAt: null,
    notifiedAt: null,
  };
  const mail = composeEmail(input, row, now);
  const vars = varsFor(row, now);
  return {
    audience,
    toEmail,
    toNotify,
    grant,
    email: sendsEmail(input) ? { subject: mail.subject, html: mail.html, text: mail.text } : null,
    notification: toNotify > 0 || input.channel !== "email" ? { title: renderSubject(input.subject, vars), message: renderMarkdown(input.bodyMd, vars).text } : null,
    estimate: estimateSend({ emails: toEmail, ahead, limit: opts.limit, sentLast24h }),
    limit: { daily: opts.limit, sentLast24h },
  };
}

export async function startCampaign(repo: CampaignRepo, id: string, limit: number): Promise<ActionResult<{ campaign: Campaign; inserted: number; preview: PreviewResult }>> {
  const c = await repo.get(id);
  if (!c) return { ok: false, status: 404, error: "Рассылка не найдена" };
  if (c.status !== "draft") return { ok: false, status: 409, error: "Эта рассылка уже запущена" };
  const valid = parseCampaignInput(c);
  if (!valid.ok) return { ok: false, status: 400, error: valid.error };
  const preview = await previewCampaign(repo, valid.input, { limit, excludeId: id });
  if (preview.toEmail === 0 && preview.toNotify === 0 && !preview.grant?.recipients) {
    return { ok: false, status: 400, error: c.kind === "marketing" ? "Некому отправлять: никто из аудитории не согласился на рекламные письма" : "Некому отправлять: в аудитории нет получателей" };
  }
  const q = await repo.queueCampaign(id);
  if (!q) return { ok: false, status: 409, error: "Эта рассылка уже запущена" };
  return { ok: true, data: { campaign: q.campaign, inserted: q.inserted, preview } };
}

export async function pauseCampaign(repo: CampaignRepo, id: string): Promise<ActionResult<Campaign>> {
  const c = await repo.transition(id, ["queued", "sending"], "paused");
  return c ? { ok: true, data: c } : { ok: false, status: 409, error: "Поставить на паузу можно только идущую рассылку" };
}

export async function resumeCampaign(repo: CampaignRepo, id: string): Promise<ActionResult<Campaign>> {
  const c = await repo.transition(id, ["paused"], "sending", { started: true, lastError: null });
  return c ? { ok: true, data: c } : { ok: false, status: 409, error: "Продолжить можно только рассылку на паузе" };
}

export async function cancelCampaign(repo: CampaignRepo, id: string): Promise<ActionResult<Campaign>> {
  const c = await repo.transition(id, ["draft", "queued", "sending", "paused"], "cancelled", { finished: true });
  return c ? { ok: true, data: c } : { ok: false, status: 409, error: "Рассылка уже завершена или отменена" };
}

/** Тестовое письмо — без кампании и без записи в очередь. */
export async function sendTestEmail(
  repo: CampaignRepo,
  mailer: Mailer,
  input: CampaignInput,
  to: string,
  fallback: { email: string; subscriptionEnd: Date; plan: string | null } | null,
  now: Date = new Date()
): Promise<ActionResult<{ to: string; id: string | null }>> {
  if (!sendsEmail(input)) return { ok: false, status: 400, error: "Для уведомления в кабинете письма нет — смотрите предпросмотр" };
  if (!isDeliverableAddress(to)) return { ok: false, status: 400, error: "Неверный адрес для теста" };
  const u = await repo.userForTest(to);
  let token = "test";
  if (u) token = u.token ?? (await repo.ensureTokens([u.userId])).get(u.userId) ?? "test";
  const src = u ?? fallback;
  const row: DeliveryRow = {
    userId: u?.userId ?? "test",
    email: to,
    status: "queued",
    attempts: 0,
    batchId: null,
    token,
    subscriptionEnd: src?.subscriptionEnd ?? new Date(now.getTime() + 30 * DAY),
    plan: src?.plan ?? "plus",
    grantedAt: null,
    notifiedAt: null,
  };
  const mail = composeEmail(input, row, now);
  const res = await mailer.sendBatch([{ ...mail, subject: `[Тест] ${mail.subject}` }], `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  if (!res.ok) return { ok: false, status: 502, error: `Resend не принял письмо: ${res.message}` };
  return { ok: true, data: { to, id: res.ids[0] ?? null } };
}

/** Что отдаёт API админке. */
export function campaignView(c: Campaign, counts: DeliveryCounts, estimate: Estimate | null) {
  return {
    id: c.id,
    kind: c.kind,
    channel: c.channel,
    subject: c.subject,
    bodyMd: c.bodyMd,
    audience: c.audience,
    grant: c.grant,
    grantLabel: c.grant ? grantLabel(c.grant) : null,
    status: c.status,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
    lastError: c.lastError,
    counts,
    estimate,
  };
}

export type CampaignView = ReturnType<typeof campaignView>;
