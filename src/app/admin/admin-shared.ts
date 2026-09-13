/**
 * Общие для админки типы, подписи и форматирование.
 *
 * Формы ответов повторяют route-файлы src/app/api/admin/** один в один —
 * при правке API правится и этот файл. Даты показываются по Москве:
 * админ и поддержка работают по одному времени, где бы ни стоял сервер.
 */

import { formatRub } from "@/lib/plans";
import { plural } from "@/lib/locations";

/* ─── Пользователи: GET /api/admin/users ─────────────────────────── */

export interface UserInfo {
  id: string;
  email: string;
  createdAt: string;
  subscriptionEnd: string;
  subscriptionPlan: string;
  telegramLinked: boolean;
  registrationIp: string | null;
  accountsOnIp: number;
  referrals: number;
  paidReferrals: number;
  isActive: boolean;
  publicId: string | null;
  panelId: string | null;
  panelUsername: string | null;
  remnawaveUserUuid: string | null;
  subscriptionUrl: string | null;
  happCryptoLink: string | null;
  /** Новые поля (f164a67): у старого бэкенда их нет — поэтому необязательные. */
  panelUserId?: number | null;
  panelSyncState?: string | null;
  panelSyncError?: string | null;
  lastPaymentAt?: string | null;
  /** Связка с Telegram (13.09.2026). */
  telegramId?: string | null;
  linkKept?: string | null;
  linkDisabledPanelUserId?: number | null;
  bypassPanelUserId?: number | null;
}

export type UserFilter = "all" | "active" | "paid" | "trial" | "expiring" | "expired" | "shared_ip" | "no_link" | "sync_error";
export type UserSort = "new" | "old" | "soon" | "long" | "email" | "last_payment";

/** GET /api/admin/users?q=&filter=&sort=&limit=&cursor= — одна страница. */
export interface UsersPage {
  users: UserInfo[];
  stats: UsersStats;
  counts: Record<UserFilter, number>;
  total?: number;
  nextCursor?: string | null;
}

/* ─── История пользователя: GET /api/admin/users/{id}/history ────── */

export interface HistoryPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  plan: string;
  period: number;
  transactionId: string | null;
  createdAt: string;
  paidAt: string | null;
  appliedAt: string | null;
  refundedAt: string | null;
  refundId: string | null;
  /** «Пакеты трафика» (13.09.2026): у старого бэкенда полей нет. */
  product?: "subscription" | "traffic";
  trafficPackId?: string | null;
  trafficBytes?: number | null;
}

/* ─── Обход пользователя: GET /api/admin/users/{id}/bypass ────────── */

export interface BypassEntityInfo {
  panelUserId: number;
  username: string;
  subscriptionUrl: string | null;
  limitBytes: number;
  usedBytes: number;
  remainingBytes: number | null;
  unlimited: boolean;
  status: string;
  trafficLimitStrategy: string | null;
  hwidDeviceLimit: number | null;
  expireAt: string;
  tag: string | null;
}

export type BypassGrantKind = "trial" | "payment" | "admin";
export type BypassGrantState = "pending" | "seeding" | "applied" | "skipped" | "conflict";

export interface BypassGrantRow {
  id: string;
  userId: string;
  kind: BypassGrantKind;
  bytes: number;
  packId: string | null;
  paymentId: string | null;
  actor: string | null;
  note: string | null;
  state: BypassGrantState;
  panelUserId: number | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface BypassOpRow {
  opId: string;
  panelUserId: number;
  addBytes: number;
  baseLimit: number | null;
  state: string;
  note: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface UserBypass {
  panelUserId: number | null;
  origin: "site" | "bot" | null;
  entity: BypassEntityInfo | null;
  panelError: string | null;
  grants: BypassGrantRow[];
  ops: BypassOpRow[];
  owedBytes: number;
}

/** POST manage grant-traffic → data. */
export interface GrantTrafficResult {
  duplicate: boolean;
  grantId: string;
  bytes: number;
  panelApplied: boolean;
  created: boolean;
  panelUserId: number | null;
  panelError?: string;
}

export const BYPASS_GRANT_KIND: Record<string, string> = {
  trial: "Пробные",
  payment: "Пакет трафика",
  admin: "Вручную",
};

export const BYPASS_GRANT_STATE: Record<string, { label: string; tone?: "warn" | "off" | "mute" | "ink" }> = {
  applied: { label: "в панели" },
  pending: { label: "ждёт панели", tone: "warn" },
  seeding: { label: "создаётся", tone: "warn" },
  skipped: { label: "пропущено", tone: "mute" },
  conflict: { label: "конфликт — вручную", tone: "off" },
};

export const BYPASS_OP_STATE: Record<string, { label: string; tone?: "warn" | "off" | "mute" | "ink" }> = {
  applied: { label: "прибавлено" },
  pending: { label: "в процессе", tone: "warn" },
  conflict: { label: "конфликт", tone: "off" },
};

/** «Пакет трафика 50 ГБ» — заголовок оплаты пакета в истории. */
export function trafficTitle(bytesN: number | null | undefined, packId: string | null | undefined): string {
  if (bytesN && bytesN > 0) return `Пакет трафика ${bytes(bytesN)}`;
  const m = /^gb(\d+)$/.exec(packId || "");
  return m ? `Пакет трафика ${num(Number(m[1]))} ГБ` : "Пакет трафика";
}

export interface HistoryEvent {
  id: string;
  kind: string;
  days: number | null;
  oldEnd: string | null;
  newEnd: string | null;
  plan: string | null;
  actor: string | null;
  sourceId: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface UserHistory {
  payments: HistoryPayment[];
  events: HistoryEvent[];
}

/* ─── Ряды по дням: GET /api/admin/overview/series?days=30|90 ────── */

export interface SeriesPoint {
  day: string;
  revenue: number;
  refunds: number;
  refundsCount: number;
  payments: number;
  registrations: number;
  trials: number;
  conversions: number;
  renewals: number;
  expirations: number;
  /** «Пакеты трафика» — уже внутри revenue и payments; у старого бэкенда нет. */
  trafficRevenue?: number;
  trafficPayments?: number;
}

export interface DailySeries {
  days: number;
  timezone: string;
  from: string;
  to: string;
  points: SeriesPoint[];
  totals: Omit<SeriesPoint, "day">;
  notes: string[];
}

export interface UsersStats {
  total: number;
  active: number;
  expired: number;
  telegramLinked: number;
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  /** info | warn | error — выводится сервером из действия (audit-level.ts). */
  level?: LogLevel;
  details: string | null;
  ip: string | null;
  createdAt: string;
}

export type LogLevel = "info" | "warn" | "error";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  target: string;
  createdAt: string;
}

/* ─── Сводка: GET /api/admin/overview ────────────────────────────── */

export type BlockErr = { error: string };
export type Unwrapped<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PanelNodeInfo {
  uuid: string;
  name: string;
  address: string | null;
  countryCode: string | null;
  isConnected: boolean;
  isDisabled: boolean;
  isConnecting: boolean;
  lastStatusMessage: string | null;
  usersOnline: number | null;
  trafficUsedBytes: number | null;
  xrayUptime: string | number | null;
  versions: { xray: string | null; node: string | null } | null;
}

export type TagBlock = { total: number; byStatus: Record<string, number>; onlineLast5m: number; truncated: boolean } | BlockErr;

export interface OverviewPanel {
  reachable: boolean;
  latencyMs: number;
  health: Unwrapped<Record<string, unknown>>;
  stats: Unwrapped<Record<string, unknown>>;
  bandwidth: Unwrapped<Record<string, unknown>>;
  nodes:
    | { ok: true; total: number; connected: number; disabled: number; usersOnline: number; list: PanelNodeInfo[] }
    | { ok: false; error: string };
  siteUsersByTag: Record<string, TagBlock>;
}

export interface OverviewDb {
  latencyMs: number;
  pool: { total: number; idle: number; waiting: number };
}

export interface SyncErrorRow {
  id: string;
  email: string;
  public_id: string | null;
  panel_sync_error: string | null;
  panel_sync_attempts: number | null;
  panel_next_sync_at: string | null;
}

export interface OverviewSync {
  byState: Record<string, number>;
  oldestQueuedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  recentErrors: SyncErrorRow[];
}

export interface OverviewRevenue {
  gross: { today: number; d7: number; d30: number; all_time: number; count30: number };
  refunds30d: { n: number; amount: number };
  /** Только подписки (пакеты трафика — в traffic30d). */
  byPlan30d: Array<{ plan: string; period: number; n: number; amount: number }>;
  /** «Пакеты трафика» за 30 дней; суммы уже входят в gross. */
  traffic30d?: { n: number; amount: number; bytes: number; byPack: Array<{ pack: string | null; n: number; amount: number; bytes: number }> };
  currency: string;
}

export interface OverviewFunnel {
  trials30d: number;
  trialsConverted30d: number;
  trialConversionRate: number | null;
  renewals30d: number;
  users: { total: number; live: number; live_trial: number; live_paid: number; expired_7d: number; expired_30d: number; new_7d: number };
  note: string;
}

export interface Overview {
  generatedAt: string;
  panel: OverviewPanel | BlockErr;
  db: OverviewDb | BlockErr;
  sync: OverviewSync | BlockErr;
  revenue: OverviewRevenue | BlockErr;
  funnel: OverviewFunnel | BlockErr;
  ledger30d: Record<string, number> | BlockErr;
  /** 24 ч, ≤ 96 точек; пишет воркер раз в минуту. */
  healthHistory?: HealthPoint[] | BlockErr;
  worker?: WorkerStatus | BlockErr;
  bot?: { enabled: boolean } | BlockErr;
  /** Сводка из кэша сервера (30 с); ?fresh=1 пересобирает. */
  cached?: boolean;
  cachedAt?: string;
}

export interface HealthPoint {
  ts: string;
  samples: number;
  panelMs: number | null;
  /** Доля замеров в интервале, когда панель ответила (0…1). */
  panelOkRatio: number;
  dbMs: number | null;
  nodesOnline: number | null;
  nodesTotal: number | null;
  queuePending: number;
  queueError: number;
}

export interface WorkerStatus {
  thisInstance: { running: boolean; startedAt: string | null; reason: string | null };
  lastPendingAt: string | null;
  lastPendingResult: Record<string, unknown> | null;
  lastReconcileAt: string | null;
  lastReconcileResult: Record<string, unknown> | null;
  lastHealthSampleAt: string | null;
  lastError: { where: string; message: string; at: string } | null;
}

/** Блок сводки упал целиком (Promise.allSettled → { error }). */
export function isErr(v: unknown): v is BlockErr {
  return !!v && typeof v === "object" && typeof (v as { error?: unknown }).error === "string";
}

/** Одна точка истории замеров, копится с каждым обновлением сводки. */
export interface Probe {
  t: number;
  panel: number | null;
  db: number | null;
}

/* ─── Тоны ───────────────────────────────────────────────────────── */

/** ok — кобальт (успех показывается набором, зелёного в корпусе нет). */
export type Tone = "ok" | "warn" | "off" | "idle";

export const TONE_WORD: Record<Tone, string> = {
  ok: "Работает",
  warn: "Внимание",
  off: "Сбой",
  idle: "Нет данных",
};

export function worst(...tones: Tone[]): Tone {
  if (tones.includes("off")) return "off";
  if (tones.includes("warn")) return "warn";
  if (tones.every((t) => t === "idle")) return "idle";
  return "ok";
}

/* ─── Подписи ────────────────────────────────────────────────────── */

export const PLAN_LABELS: Record<string, string> = {
  trial: "Пробный",
  basic: "Basic",
  plus: "Plus",
  expired: "Истёк",
};

/** Тон метки тарифа: Basic — кобальт, Plus — чернила, истёк — красный. */
export function planTone(planKey: string): "ink" | "off" | "mute" | undefined {
  if (planKey === "plus") return "ink";
  if (planKey === "expired") return "off";
  if (planKey === "basic") return undefined;
  return "mute";
}

export const ACTION_LABELS: Record<string, { label: string; tone?: "warn" | "off" | "ink" | "mute" }> = {
  "user.register": { label: "Регистрация" },
  "user.login": { label: "Вход", tone: "mute" },
  "payment.success": { label: "Оплата", tone: "ink" },
  "payment.canceled": { label: "Оплата отменена", tone: "off" },
  "payment.refunded": { label: "Возврат", tone: "off" },
  "admin.grant": { label: "Выдача подписки" },
  "admin.revoke": { label: "Отзыв подписки", tone: "off" },
  "admin.regen": { label: "Новая ссылка", tone: "warn" },
  "admin.set_plan": { label: "Смена тарифа", tone: "warn" },
  "admin.device_delete": { label: "Устройство отвязано", tone: "warn" },
  "admin.devices_delete_all": { label: "Все устройства отвязаны", tone: "warn" },
  "admin.bypass_grant": { label: "Начислен трафик" },
  "telegram.link": { label: "Telegram привязан", tone: "mute" },
  "telegram.unlink": { label: "Telegram отвязан", tone: "mute" },
  "sync.overwrite": { label: "Перезапись ботом", tone: "warn" },
  "bot_sync.enabled": { label: "Бот включён", tone: "mute" },
  "bot_sync.disabled": { label: "Бот выключен", tone: "warn" },
  "admin.campaign_start": { label: "Рассылка запущена" },
  "admin.campaign_pause": { label: "Рассылка на паузе", tone: "warn" },
  "admin.campaign_resume": { label: "Рассылка продолжена" },
  "admin.campaign_cancel": { label: "Рассылка отменена", tone: "warn" },
  "admin.campaign_test": { label: "Тестовое письмо", tone: "mute" },
  "user.marketing_opt_out": { label: "Отписка от рассылки", tone: "mute" },
  "user.marketing_consent_on": { label: "Согласие на новости", tone: "mute" },
  "user.marketing_consent_off": { label: "Отказ от новостей", tone: "mute" },
};

export const LEDGER_LABELS: Record<string, string> = {
  trial: "Пробный период",
  payment: "Оплата",
  admin_grant: "Выдано вручную",
  admin_revoke: "Отозвано вручную",
  admin_set_plan: "Смена тарифа",
  telegram_bonus: "Бонус за Telegram",
  bot_extend: "Продление ботом",
  bot_overwrite: "Перезапись ботом",
  refund: "Возврат",
  ghost_repair_manual: "Правка даты",
  link_merge: "Связка с Telegram",
  panel_pull: "Срок из панели (общий ключ)",
};

/** users.link_kept → which panel entity survived the Telegram link. */
export const LINK_KEPT_LABELS: Record<string, string> = {
  bot: "ключ бота (длиннее)",
  site: "ключ сайта (длиннее)",
  "only-bot": "ключ бота (у сайта не было)",
  "only-site": "ключ сайта (у бота не было)",
  none: "без подписки",
  adopted: "усыновлён при входе",
  absorbed: "поглощён другим аккаунтом",
};

export const SYNC_STATE_LABELS: Record<string, string> = {
  ok: "Сверено",
  pending: "Ждут отправки",
  error: "С ошибкой",
};

/** Состояние одного пользователя в очереди синхронизации. */
export const SYNC_ONE: Record<string, { label: string; tone?: "warn" | "off" }> = {
  ok: { label: "сверено" },
  pending: { label: "ждёт отправки", tone: "warn" },
  error: { label: "ошибка", tone: "off" },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone?: "warn" | "off" | "mute" | "ink" }> = {
  confirmed: { label: "оплачен", tone: "ink" },
  pending: { label: "ждёт оплаты", tone: "warn" },
  canceled: { label: "отменён", tone: "mute" },
  expired: { label: "не оплачен", tone: "mute" },
  refunded: { label: "возврат", tone: "off" },
};

export const ACTOR_LABELS: Record<string, string> = {
  admin: "админ",
  bot: "бот",
  system: "система",
  user: "пользователь",
  webhook: "касса",
  worker: "синхронизатор",
};

export const LEVEL_LABELS: Record<LogLevel, string> = { info: "Обычные", warn: "Внимание", error: "Ошибки" };

/* ─── Форматирование ─────────────────────────────────────────────── */

const TZ = "Europe/Moscow";

export const formatDate = (d: string | number | Date) =>
  new Date(d).toLocaleDateString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

export const formatDateTime = (d: string | number | Date) =>
  new Date(d).toLocaleString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const formatShort = (d: string | number | Date) =>
  new Date(d).toLocaleString("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export const formatClock = (d: string | number | Date) =>
  new Date(d).toLocaleTimeString("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Рубли без копеек: суммы в сводке — ориентир, не бухгалтерия. */
export const money = (n: number | null | undefined) => `${formatRub(Math.round(Number(n) || 0))} ₽`;

export const num = (n: number | null | undefined) => (Number(n) || 0).toLocaleString("ru-RU");

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Доля строкой по-русски: «53,9 %». */
export const pcs = (part: number, whole: number) => `${pct(part, whole).toLocaleString("ru-RU")} %`;

export function bytes(n: number | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ", "ПБ"];
  const k = Math.min(units.length - 1, Math.floor(Math.log(v) / Math.log(1024)));
  const x = v / 1024 ** k;
  return `${x.toLocaleString("ru-RU", { maximumFractionDigits: x < 10 ? 1 : 0 })} ${units[k]}`;
}

/** «5 мин назад», «3 ч назад», «2 дн назад». */
export function ago(d: string | number | Date | null | undefined, now = Date.now()): string {
  if (!d) return "—";
  const ms = now - new Date(d).getTime();
  if (!Number.isFinite(ms)) return "—";
  if (ms < 0) return `через ${span(-ms)}`;
  if (ms < 45_000) return "только что";
  return `${span(ms)} назад`;
}

/** Длительность: «12 мин», «3 ч 20 мин», «4 дн 2 ч». */
export function span(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} ч ${min % 60} мин` : `${h} ч`;
  const d = Math.floor(h / 24);
  return h % 24 && d < 10 ? `${d} дн ${h % 24} ч` : `${d} дн`;
}

/** Осталось до конца подписки — словами, для карточки пользователя. */
export function leftWords(end: string, now = Date.now()): string {
  const ms = new Date(end).getTime() - now;
  if (ms <= 0) return "Истекла";
  const days = Math.floor(ms / 864e5);
  if (days >= 1) {
    const h = Math.floor((ms % 864e5) / 36e5);
    return `${days} ${plural(days, ["день", "дня", "дней"])}${days < 10 && h ? ` ${h} ч` : ""}`;
  }
  return span(ms);
}

export const daysLeft = (end: string, now = Date.now()) => Math.ceil((new Date(end).getTime() - now) / 864e5);

export { plural };

/* ─── Безопасное чтение ответов панели (формы из Remnawave 3.4.3) ── */

export function pick(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export const pickNum = (obj: unknown, path: string): number | null => {
  const v = pick(obj, path);
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

export const pickStr = (obj: unknown, path: string): string | null => {
  const v = pick(obj, path);
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : null;
};

/** fetch + JSON, который не падает на HTML-странице ошибки сервера. */
export async function getJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T; raw: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, init);
    const raw = await res.text();
    let json: { success?: boolean; data?: T; error?: string } | null = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    // raw — весь ответ: у журнала nextCursor лежит рядом с data.
    if (json?.success) return { ok: true, data: json.data as T, raw: json as Record<string, unknown> };
    return { ok: false, status: res.status, error: json?.error || `Сервер ответил ${res.status}` };
  } catch {
    return { ok: false, status: 0, error: "Нет связи с сервером" };
  }
}

export const deleteJson = <T = unknown>(url: string, body?: unknown) =>
  getJson<T>(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** «2026-09-12» (московский день из рядов) → «12.09». */
export const dayShort = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
/** «2026-09-12» → «пт, 12 сент.». */
export const dayLong = (day: string) =>
  new Date(`${day}T12:00:00+03:00`).toLocaleDateString("ru-RU", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

export const postJson = <T = unknown>(url: string, body?: unknown) =>
  getJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
