/**
 * Remnawave 3.4.3 API client.
 *
 * Contract verified against the backend source at tag 3.4.3
 * (commit f8ad8ad3, contract package @remnawave/backend-contract 3.4.13):
 *
 *   - Auth: `Authorization: Bearer <API token>`.
 *   - Every request must carry `X-Forwarded-For` and
 *     `X-Forwarded-Proto: https` unless the panel runs with
 *     NODE_ENV=development — otherwise the panel destroys the socket
 *     without an HTTP answer (src/common/middlewares/proxy-check.middleware.ts).
 *     Controlled by REMNAWAVE_FORWARDED_HEADERS (default on).
 *   - Users are identified by an integer `id`. There is no user `uuid`
 *     since 3.0.0. All `/api/users/{id}` routes take the number.
 *   - PATCH /api/users takes `id` (number) or `username`; `status` only
 *     ACTIVE | DISABLED; `expireAt` must be in the future.
 *   - Lookups: GET /api/users/by-username/{u}, GET /api/users/stream?email=…
 *     (`by-email`, `by-telegram-id`, `?search=` do not exist in 3.x).
 *   - Errors: `{ message, errorCode }` or 400 `{ message: "Validation failed", errors }`.
 *
 * Every function returns a typed RwResult — callers must distinguish
 * "the panel says this user does not exist" (not_found) from "we could
 * not ask" (unavailable / auth / server). Only the former may ever lead
 * to wiping a stored panel link.
 */

import { TRIAL_DAYS } from "./brand-facts";
import { DEVICE_LIMIT } from "./plans";

// ─── Error codes (libs/contract/constants/errors/errors.ts @ 3.4.3) ──

export const PANEL_ERROR = {
  UNAUTHORIZED: "A003",
  USERNAME_EXISTS: "A019",
  SHORT_UUID_EXISTS: "A020",
  USER_NOT_FOUND: "A025",
  ALREADY_DISABLED: "A029",
  ALREADY_ENABLED: "A030",
  USERS_NOT_FOUND: "A062",
  USER_NOT_FOUND_BY_PARAMS: "A063",
  FORBIDDEN: "A068",
  HWID_LIMIT: "A099",
  HWID_DEVICE_NOT_FOUND: "A204",
} as const;

// ─── Types ───────────────────────────────────────────────────────

export type PanelStatus = "ACTIVE" | "DISABLED" | "LIMITED" | "EXPIRED";

export type RwErrorKind =
  | "not_found"
  | "conflict"
  | "validation"
  | "auth"
  | "unavailable"
  | "server"
  | "config";

export interface RwError {
  ok: false;
  kind: RwErrorKind;
  status: number | null;
  errorCode: string | null;
  message: string;
  method: string;
  path: string;
}

export interface RwOk<T> {
  ok: true;
  data: T;
  status: number;
}

export type RwResult<T> = RwOk<T> | RwError;

export interface PanelUser {
  id: number;
  username: string;
  shortUuid: string;
  status: PanelStatus | string;
  expireAt: string;
  subscriptionUrl: string;
  email: string | null;
  telegramId: number | null;
  description: string | null;
  tag: string | null;
  hwidDeviceLimit: number | null;
  trafficLimitBytes: number;
  trafficLimitStrategy: string | null;
  usedTrafficBytes: number;
  lifetimeUsedTrafficBytes: number;
  onlineAt: string | null;
  firstConnectedAt: string | null;
  subRevokedAt: string | null;
  createdAt: string | null;
  activeInternalSquads: Array<{ uuid: string; name: string }>;
}

export interface CreateUserBody {
  username: string;
  status: "ACTIVE";
  expireAt: string;
  email: string | null;
  description: string;
  tag: string | null;
  trafficLimitBytes: number;
  trafficLimitStrategy: "NO_RESET";
  hwidDeviceLimit: number;
  activeInternalSquads: string[];
}

export interface UpdateUserBody {
  id?: number;
  username?: string;
  status?: "ACTIVE" | "DISABLED";
  expireAt?: string;
  tag?: string | null;
  description?: string | null;
  email?: string | null;
  /** Telegram id on the panel user — written on link, cleared on unlink. */
  telegramId?: number | null;
  hwidDeviceLimit?: number | null;
  trafficLimitBytes?: number;
  activeInternalSquads?: string[];
}

export interface HwidDevice {
  hwid: string;
  userId: number;
  platform: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  userAgent: string | null;
  requestIp: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface IpJobResult {
  isCompleted: boolean;
  isFailed: boolean;
  progress: unknown;
  result: {
    userId: number | string;
    nodes: Array<{
      nodeUuid: string;
      nodeName: string;
      countryCode: string | null;
      ips: Array<{ ip: string; lastSeen: string | null }>;
    }>;
  } | null;
}

export interface PanelNode {
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

// ─── Config ──────────────────────────────────────────────────────

/** Production defaults — kept on purpose (owner, 12.09.2026): Railway is configured with these. */
export const DEFAULT_REMNAWAVE_API_URL = "https://rmnw.atlassecure.ru";
export const DEFAULT_MAINSERVER_SQUAD_UUID = "2c8eba36-6e74-45b1-af5e-54ea0e65e19d";

export interface RemnawaveConfig {
  apiUrl: string;
  token: string;
  /** Squad(s) every site user gets unless a per-plan override is set. */
  mainSquadUuids: string[];
  /** Optional per-plan overrides (REMNAWAVE_SQUAD_TRIAL/BASIC/PLUS). */
  planSquads: Partial<Record<"trial" | "basic" | "plus", string[]>>;
  forwardedHeaders: boolean;
  /** Token present — URL always has a value (env or default). */
  isConfigured: boolean;
  /** Names of required env vars that are missing. */
  missing: string[];
}

const warnedDefaults = new Set<string>();
function warnDefaultOnce(name: string, value: string) {
  if (warnedDefaults.has(name)) return;
  warnedDefaults.add(name);
  console.warn(`[REMNAWAVE] ${name} is not set — using default ${value}`);
}

function csv(v: string | undefined): string[] {
  return (v || "").split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Read at call time (not at module load) so tests and hot reloads see
 * the current env. Env names are the ones production already uses;
 * defaults are the production values and log a one-time warning.
 */
export function getRemnawaveConfig(): RemnawaveConfig {
  let apiUrl = (process.env.REMNAWAVE_API_URL || "").trim().replace(/\/+$/, "");
  if (!apiUrl) {
    apiUrl = DEFAULT_REMNAWAVE_API_URL;
    warnDefaultOnce("REMNAWAVE_API_URL", apiUrl);
  }
  const token = (process.env.REMNAWAVE_API_TOKEN || "").trim();
  let mainSquadUuids = csv(process.env.REMNAWAVE_MAINSERVER_SQUAD_UUID);
  if (mainSquadUuids.length === 0) {
    mainSquadUuids = [DEFAULT_MAINSERVER_SQUAD_UUID];
    warnDefaultOnce("REMNAWAVE_MAINSERVER_SQUAD_UUID", DEFAULT_MAINSERVER_SQUAD_UUID);
  }
  const planSquads: RemnawaveConfig["planSquads"] = {};
  for (const plan of ["trial", "basic", "plus"] as const) {
    const list = csv(process.env[`REMNAWAVE_SQUAD_${plan.toUpperCase()}`]);
    if (list.length > 0) planSquads[plan] = list;
  }
  const fh = (process.env.REMNAWAVE_FORWARDED_HEADERS ?? "true").trim().toLowerCase();
  const forwardedHeaders = !["0", "false", "no", "off"].includes(fh);
  const missing: string[] = [];
  if (!token) missing.push("REMNAWAVE_API_TOKEN");
  return { apiUrl, token, mainSquadUuids, planSquads, forwardedHeaders, isConfigured: missing.length === 0, missing };
}

/** Squads for a plan: per-plan override if configured, else the main squad. */
export function squadsForPlan(plan: string | null | undefined, cfg: RemnawaveConfig = getRemnawaveConfig()): string[] {
  const key = (plan || "trial").toLowerCase() as "trial" | "basic" | "plus";
  return cfg.planSquads[key] ?? cfg.mainSquadUuids;
}

/** True when squads differ per plan — then a plan change must move the user between squads. */
export function hasPerPlanSquads(cfg: RemnawaveConfig = getRemnawaveConfig()): boolean {
  return Object.keys(cfg.planSquads).length > 0;
}

let lastConfigErrorLogAt = 0;
function logConfigError(msg: string) {
  // Loud but not flooding: at most once per 30 s per process.
  const now = Date.now();
  if (now - lastConfigErrorLogAt < 30_000) return;
  lastConfigErrorLogAt = now;
  console.error(`[REMNAWAVE] CONFIG ERROR: ${msg}`);
}

// ─── Transport ───────────────────────────────────────────────────

export const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 2;

interface RequestOptions<T> {
  body?: unknown;
  /** Map the parsed JSON body (null for 204) to the result, or null if the shape is wrong. */
  parse: (json: unknown) => T | null;
  /** Default: true for GET/PATCH, false otherwise. */
  retry?: boolean;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function errorKindFor(status: number, errorCode: string | null): RwErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (
    errorCode === PANEL_ERROR.USERNAME_EXISTS ||
    errorCode === PANEL_ERROR.SHORT_UUID_EXISTS ||
    errorCode === "A021"
  ) {
    return "conflict";
  }
  if (status === 400 || status === 422) return "validation";
  return "server";
}

function extractErrorInfo(json: unknown, fallbackText: string): { errorCode: string | null; message: string } {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const code = typeof o.errorCode === "string" ? o.errorCode : null;
    let message = typeof o.message === "string" ? o.message : "";
    if (Array.isArray(o.errors) && o.errors.length > 0) {
      const details = o.errors
        .slice(0, 5)
        .map((e) => {
          if (e && typeof e === "object") {
            const eo = e as Record<string, unknown>;
            const p = Array.isArray(eo.path) ? eo.path.join(".") : "";
            return `${p ? `${p}: ` : ""}${typeof eo.message === "string" ? eo.message : JSON.stringify(e)}`;
          }
          return String(e);
        })
        .join("; ");
      message = message ? `${message} (${details})` : details;
    }
    return { errorCode: code, message: message || fallbackText.slice(0, 200) };
  }
  return { errorCode: null, message: fallbackText.slice(0, 200) };
}

async function request<T>(method: string, path: string, opts: RequestOptions<T>): Promise<RwResult<T>> {
  const cfg = getRemnawaveConfig();
  if (!cfg.isConfigured) {
    const message = `missing env: ${cfg.missing.join(", ")}`;
    logConfigError(`${message} — ${method} ${path} not sent`);
    return { ok: false, kind: "config", status: null, errorCode: null, message, method, path };
  }

  const url = `${cfg.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (cfg.forwardedHeaders) {
    headers["X-Forwarded-For"] = "127.0.0.1";
    headers["X-Forwarded-Proto"] = "https";
  }

  const retry = opts.retry ?? (method === "GET" || method === "PATCH");
  const attempts = retry ? MAX_RETRIES + 1 : 1;
  let last: RwError = { ok: false, kind: "unavailable", status: null, errorCode: null, message: "not attempted", method, path };

  for (let attempt = 0; attempt < attempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      last = {
        ok: false,
        kind: "unavailable",
        status: null,
        errorCode: null,
        message: aborted ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : `network error: ${err instanceof Error ? err.message : String(err)}`,
        method,
        path,
      };
      if (attempt < attempts - 1) await sleep(300 * 2 ** attempt);
      continue;
    }
    clearTimeout(timer);

    const text = res.status === 204 ? "" : await res.text().catch(() => "");
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }

    if (res.ok) {
      const data = opts.parse(json);
      if (data === null) {
        return {
          ok: false,
          kind: "server",
          status: res.status,
          errorCode: null,
          message: `unexpected response shape: ${text.slice(0, 200)}`,
          method,
          path,
        };
      }
      return { ok: true, data, status: res.status };
    }

    const { errorCode, message } = extractErrorInfo(json, text);
    last = { ok: false, kind: errorKindFor(res.status, errorCode), status: res.status, errorCode, message, method, path };
    // Only server-side failures are worth retrying; a 4xx will not change.
    if (res.status < 500) return last;
    if (attempt < attempts - 1) await sleep(300 * 2 ** attempt);
  }

  if (last.kind === "server" || last.kind === "unavailable") {
    console.warn(`[REMNAWAVE] ${method} ${path} failed after ${attempts} attempt(s): ${last.kind} ${last.status ?? "-"} ${last.message}`);
  }
  return last;
}

/** Human-readable one-liner for logs and admin UI. */
export function describeRwError(e: RwError): string {
  return `${e.method} ${e.path} → ${e.kind}${e.status ? ` ${e.status}` : ""}${e.errorCode ? ` ${e.errorCode}` : ""}: ${e.message}`;
}

/**
 * True only when the panel positively said the user does not exist.
 * This is the ONE condition under which a stored panel link may be
 * wiped. Network errors, auth errors, 5xx and validation errors never
 * qualify.
 */
export function isUserGone(r: RwResult<unknown>): boolean {
  return (
    !r.ok &&
    r.kind === "not_found" &&
    (r.errorCode === PANEL_ERROR.USER_NOT_FOUND || r.errorCode === PANEL_ERROR.USER_NOT_FOUND_BY_PARAMS)
  );
}

// ─── Parsing ─────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Parse one user object (the `response` of any user route, or a stream item). */
export function parsePanelUser(raw: unknown): PanelUser | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const id = num(u.id);
  const username = str(u.username);
  if (id === null || !Number.isSafeInteger(id) || !username) return null;
  const traffic = (u.userTraffic && typeof u.userTraffic === "object" ? u.userTraffic : {}) as Record<string, unknown>;
  const squads = Array.isArray(u.activeInternalSquads)
    ? u.activeInternalSquads
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => ({ uuid: str(s.uuid) || "", name: str(s.name) || "" }))
    : [];
  return {
    id,
    username,
    shortUuid: str(u.shortUuid) || "",
    status: str(u.status) || "",
    expireAt: str(u.expireAt) || "",
    subscriptionUrl: str(u.subscriptionUrl) || "",
    email: str(u.email),
    telegramId: num(u.telegramId),
    description: str(u.description),
    tag: str(u.tag),
    hwidDeviceLimit: num(u.hwidDeviceLimit),
    trafficLimitBytes: num(u.trafficLimitBytes) ?? 0,
    trafficLimitStrategy: str(u.trafficLimitStrategy),
    usedTrafficBytes: num(traffic.usedTrafficBytes) ?? 0,
    lifetimeUsedTrafficBytes: num(traffic.lifetimeUsedTrafficBytes) ?? 0,
    onlineAt: str(traffic.onlineAt),
    firstConnectedAt: str(traffic.firstConnectedAt),
    subRevokedAt: str(u.subRevokedAt),
    createdAt: str(u.createdAt),
    activeInternalSquads: squads,
  };
}

function responseOf(json: unknown): unknown {
  if (json && typeof json === "object" && "response" in json) return (json as { response: unknown }).response;
  return undefined;
}

const parseUserEnvelope = (json: unknown) => parsePanelUser(responseOf(json));

function parseHwidDevice(raw: unknown): HwidDevice | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const hwid = str(d.hwid);
  if (!hwid) return null;
  return {
    hwid,
    userId: num(d.userId) ?? 0,
    platform: str(d.platform),
    osVersion: str(d.osVersion),
    deviceModel: str(d.deviceModel),
    userAgent: str(d.userAgent),
    requestIp: str(d.requestIp),
    createdAt: str(d.createdAt),
    updatedAt: str(d.updatedAt),
  };
}

function parseHwidList(json: unknown): { total: number; devices: HwidDevice[] } | null {
  const r = responseOf(json);
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const devices = Array.isArray(o.devices) ? o.devices.map(parseHwidDevice).filter((d): d is HwidDevice => !!d) : [];
  return { total: num(o.total) ?? devices.length, devices };
}

function parseNode(raw: unknown): PanelNode | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  const uuid = str(n.uuid);
  if (!uuid) return null;
  const v = n.versions && typeof n.versions === "object" ? (n.versions as Record<string, unknown>) : null;
  return {
    uuid,
    name: str(n.name) || "",
    address: str(n.address),
    countryCode: str(n.countryCode),
    isConnected: n.isConnected === true,
    isDisabled: n.isDisabled === true,
    isConnecting: n.isConnecting === true,
    lastStatusMessage: str(n.lastStatusMessage),
    usersOnline: num(n.usersOnline),
    trafficUsedBytes: num(n.trafficUsedBytes),
    xrayUptime: (typeof n.xrayUptime === "string" || typeof n.xrayUptime === "number") ? n.xrayUptime : null,
    versions: v ? { xray: str(v.xray), node: str(v.node) } : null,
  };
}

// ─── Site conventions ────────────────────────────────────────────

/** Tags of site-issued panel users (owner decision 12.09.2026). */
export const SITE_TAGS = {
  trial: "SITE_TRIAL",
  basic: "SITE_BASIC",
  plus: "SITE_PLUS",
} as const;
export const ALL_SITE_TAGS: string[] = Object.values(SITE_TAGS);

/** Tags the site wrote before 12.09.2026 — still recognised during migration. */
export const LEGACY_SITE_TAGS = ["TRIAL", "BASIC", "PLUS"] as const;

export function tagForPlan(plan: string | null | undefined): string | null {
  if (!plan) return null;
  const key = plan.toLowerCase() as keyof typeof SITE_TAGS;
  return SITE_TAGS[key] ?? null;
}

const PANEL_USERNAME_RE = /^[a-zA-Z0-9_-]{3,36}$/;
const SITE_USERNAME_RE = /^ST\d+$/;

/**
 * Strict ownership check. The panel is shared with the Telegram bot
 * service, so we must never modify or delete panel users that are not
 * ours. A panel user is ours when it carries a SITE_* tag, or when its
 * username is our `ST` + digits public id (legacy users, whose tag may
 * be TRIAL/BASIC/PLUS or empty). A legacy tag alone is NOT proof.
 */
export function isOurPanelUser(u: { username?: string | null; tag?: string | null }): boolean {
  if (typeof u.tag === "string" && ALL_SITE_TAGS.includes(u.tag)) return true;
  return typeof u.username === "string" && SITE_USERNAME_RE.test(u.username);
}

/** True for the site's own `ST` + digits usernames. */
export function isSiteUsername(username: string | null | undefined): boolean {
  return typeof username === "string" && SITE_USERNAME_RE.test(username);
}

// ─── Bot conventions (docs/bot/PANEL_USER_MODEL.md) ──────────────
//
// The Telegram bot keeps TWO panel users per Telegram id: premium
// `tg_{telegram_id}_premium` (term = subscription) and bypass
// `{telegram_id}` (expireAt 2099, limited by traffic). The site adopts
// the premium one when it is the longer subscription (one key per
// person) and only ever READS the bypass one, except for explicit
// traffic operations (src/lib/bypass.ts).

export const DEFAULT_BOT_PREMIUM_USERNAME_PATTERN = "tg_{telegram_id}_premium";
export const DEFAULT_BOT_BYPASS_USERNAME_PATTERN = "{telegram_id}";

function fillBotPattern(envName: string, fallback: string, telegramId: string): string {
  const pattern = (process.env[envName] || "").trim() || fallback;
  // The bot trims usernames to the panel's 32-character limit, so do we.
  return pattern.split("{telegram_id}").join(telegramId).slice(0, 32);
}

/** Username of the bot's premium panel user for a Telegram id (env BOT_PREMIUM_USERNAME_PATTERN). */
export function botPremiumUsername(telegramId: string): string {
  return fillBotPattern("BOT_PREMIUM_USERNAME_PATTERN", DEFAULT_BOT_PREMIUM_USERNAME_PATTERN, telegramId);
}

/** Username of the bot's bypass panel user for a Telegram id (env BOT_BYPASS_USERNAME_PATTERN). */
export function botBypassUsername(telegramId: string): string {
  return fillBotPattern("BOT_BYPASS_USERNAME_PATTERN", DEFAULT_BOT_BYPASS_USERNAME_PATTERN, telegramId);
}

/** Site-created bypass entity: `ST00000042_bp` (src/lib/bypass-grants.ts). */
export const SITE_BYPASS_USERNAME_SUFFIX = "_bp";
/**
 * Tag of site-created bypass entities. Deliberately NOT in SITE_TAGS /
 * ALL_SITE_TAGS: isOurPanelUser() must stay false for a bypass entity, so
 * the premium sync and reconciliation never treat it as a key.
 */
export const SITE_BYPASS_TAG = "SITE_BYPASS";
/** Bypass lives by traffic, not by time — the same "infinity" the bot uses. */
export const BYPASS_EXPIRE_AT = "2099-12-31T23:59:59Z";
export function siteBypassUsername(publicId: string): string {
  return `${publicId}${SITE_BYPASS_USERNAME_SUFFIX}`;
}

/** A bypass entity — the bot's (`Bypass via bot (…)`) or a future site one (`ST…_bp`). Never a premium key. */
export function isBypassEntity(u: { username?: string | null; description?: string | null }): boolean {
  if (typeof u.description === "string" && /^\s*bypass via bot\b/i.test(u.description)) return true;
  return typeof u.username === "string" && u.username.endsWith(SITE_BYPASS_USERNAME_SUFFIX) && isSiteUsername(u.username.slice(0, -SITE_BYPASS_USERNAME_SUFFIX.length));
}

/** Plan from the bot's description `Premium via bot ({tariff})`; null when it is not a bot premium description. */
export function planFromBotDescription(description: string | null | undefined): "basic" | "plus" | null {
  const m = /premium via bot\s*\(([^)]*)\)/i.exec(description || "");
  if (!m) return null;
  return /plus/i.test(m[1]) ? "plus" : "basic";
}

/** Plan from a SITE_* tag, or null. */
export function planFromSiteTag(tag: string | null | undefined): "trial" | "basic" | "plus" | null {
  const hit = (Object.entries(SITE_TAGS) as Array<[keyof typeof SITE_TAGS, string]>).find(([, t]) => t === tag);
  return hit ? hit[0] : null;
}

/** Bypass (обход) squad — owner, 13.09.2026; the bot's squad for bypass entities. */
export const DEFAULT_BYPASS_SQUAD_UUID = "6947418d-83b6-4050-a10c-3829e4cd4b2c";
/** Same device limit the bot gives its bypass entities (REMNAWAVE_BYPASS_DEVICE_LIMIT in the bot). */
export const DEFAULT_BYPASS_DEVICE_LIMIT = 5;

/**
 * Config for bypass entities created by the SITE («Пакеты трафика»,
 * src/lib/bypass-grants.ts). Env overrides, defaults are the production
 * values (one-time warning, like REMNAWAVE_MAINSERVER_SQUAD_UUID).
 */
export function getBypassConfig(): { squadUuids: string[]; deviceLimit: number } {
  let squadUuids = csv(process.env.REMNAWAVE_BYPASS_SQUAD_UUID);
  if (squadUuids.length === 0) {
    squadUuids = [DEFAULT_BYPASS_SQUAD_UUID];
    warnDefaultOnce("REMNAWAVE_BYPASS_SQUAD_UUID", DEFAULT_BYPASS_SQUAD_UUID);
  }
  const limit = Number((process.env.REMNAWAVE_BYPASS_DEVICE_LIMIT || "").trim());
  return {
    squadUuids,
    deviceLimit: Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_BYPASS_DEVICE_LIMIT,
  };
}

// ─── Description markers ─────────────────────────────────────────
//
// The panel description is shared with the bot ("Premium via bot
// (basic)"). The site only appends ` | key:value` tokens and replaces
// its own tokens; the bot's text is never rewritten.

export const PANEL_MARKERS = {
  /** Email confirmed through the site's code flow — the only proof E (sign-in adoption) accepts. */
  emailVerified: "atlas-email-verified",
  /** Site account that owns this panel user. */
  site: "atlas-site",
  /** Telegram unlinked; the key stays with the site account. */
  unlinked: "atlas-unlinked",
} as const;
export type PanelMarker = (typeof PANEL_MARKERS)[keyof typeof PANEL_MARKERS];

function markerTokens(description: string | null | undefined): string[] {
  return (description || "").split(/\s*\|\s*/).map((t) => t.trim()).filter(Boolean);
}

export function hasMarker(description: string | null | undefined, marker: PanelMarker): boolean {
  return markerTokens(description).some((t) => t.startsWith(`${marker}:`));
}

/** Set (value) or remove (null) our markers, keeping every other token in place. */
export function withMarkers(description: string | null | undefined, set: Partial<Record<PanelMarker, string | null>>): string {
  const keys = Object.keys(set) as PanelMarker[];
  const kept = markerTokens(description).filter((t) => !keys.some((k) => t.startsWith(`${k}:`)));
  for (const k of keys) {
    const v = set[k];
    if (v) kept.push(`${k}:${v}`);
  }
  return kept.join(" | ");
}

export function panelSafeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  // The panel validates with z.email(); anything that obviously would
  // not pass is sent as null rather than failing the whole create.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** Pure builder for POST /api/users — exported for tests. */
export function buildCreateUserBody(input: {
  publicId: string;
  email: string | null;
  userId: string;
  expireAt: Date;
  plan: string | null;
  squadUuids: string[];
}): CreateUserBody {
  return {
    username: input.publicId,
    status: "ACTIVE",
    expireAt: input.expireAt.toISOString(),
    email: panelSafeEmail(input.email),
    description: `atlas-site:${input.userId}`,
    tag: tagForPlan(input.plan) ?? SITE_TAGS.trial,
    trafficLimitBytes: 0,
    trafficLimitStrategy: "NO_RESET",
    hwidDeviceLimit: DEVICE_LIMIT,
    activeInternalSquads: input.squadUuids,
  };
}

/**
 * Pure builder for POST /api/users of a SITE bypass entity (`ST…_bp`).
 * expireAt 2099, limit = the seed grant's bytes (0 would mean unlimited,
 * so a bypass entity is never created without traffic), NO_RESET, the
 * bypass squad and device limit, no externalSquadUuid. Exported for tests.
 */
export function buildBypassCreateBody(input: {
  publicId: string;
  email: string | null;
  userId: string;
  emailVerifiedAt: string | null;
  bytes: number;
  cfg?: { squadUuids: string[]; deviceLimit: number };
}): CreateUserBody {
  const cfg = input.cfg ?? getBypassConfig();
  if (!Number.isSafeInteger(input.bytes) || input.bytes <= 0) throw new Error(`bypass create: bytes must be positive (${input.bytes})`);
  return {
    username: siteBypassUsername(input.publicId),
    status: "ACTIVE",
    expireAt: BYPASS_EXPIRE_AT,
    email: panelSafeEmail(input.email),
    description: withMarkers(null, { [PANEL_MARKERS.site]: input.userId, [PANEL_MARKERS.emailVerified]: input.emailVerifiedAt }),
    tag: SITE_BYPASS_TAG,
    trafficLimitBytes: input.bytes,
    trafficLimitStrategy: "NO_RESET",
    hwidDeviceLimit: cfg.deviceLimit,
    activeInternalSquads: cfg.squadUuids,
  };
}

/** A site bypass entity that belongs to THIS account (username shape + atlas-site marker). */
export function isSiteBypassFor(u: { username?: string | null; description?: string | null }, userId: string): boolean {
  return isBypassEntity({ username: u.username }) && markerTokens(u.description).includes(`${PANEL_MARKERS.site}:${userId}`);
}

// ─── Users ───────────────────────────────────────────────────────

export function getUserById(id: number): Promise<RwResult<PanelUser>> {
  return request("GET", `/api/users/${id}`, { parse: parseUserEnvelope });
}

export async function getUserByUsername(username: string): Promise<RwResult<PanelUser>> {
  if (!PANEL_USERNAME_RE.test(username)) {
    return { ok: false, kind: "validation", status: null, errorCode: null, message: `invalid username "${username}"`, method: "GET", path: "/api/users/by-username" };
  }
  const r = await request("GET", `/api/users/by-username/${encodeURIComponent(username)}`, { parse: parseUserEnvelope });
  if (r.ok && r.data.username !== username) {
    return { ok: false, kind: "server", status: r.status, errorCode: null, message: `panel returned username "${r.data.username}" for "${username}"`, method: "GET", path: `/api/users/by-username/${username}` };
  }
  return r;
}

function parseStream(json: unknown): { users: PanelUser[]; nextCursor: string | null; hasMore: boolean } | null {
  const r = responseOf(json);
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  if (!Array.isArray(o.users)) return null;
  return {
    users: o.users.map(parsePanelUser).filter((u): u is PanelUser => !!u),
    nextCursor: o.nextCursor == null ? null : String(o.nextCursor),
    hasMore: o.hasMore === true,
  };
}

/** GET /api/users/stream?email=… — exact (case-insensitive) matches only. */
export async function findUsersByEmail(email: string): Promise<RwResult<PanelUser[]>> {
  const target = email.trim().toLowerCase();
  const r = await request("GET", `/api/users/stream?email=${encodeURIComponent(target)}&size=1000`, { parse: parseStream });
  if (!r.ok) return r;
  return { ok: true, status: r.status, data: r.data.users.filter((u) => (u.email || "").toLowerCase() === target) };
}

/** Walk /api/users/stream?tag=… with the cursor. Bounded by maxPages × 1000 users. */
export async function streamUsersByTag(tag: string, maxPages = 50): Promise<RwResult<{ users: PanelUser[]; truncated: boolean }>> {
  const users: PanelUser[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const q: string = `/api/users/stream?tag=${encodeURIComponent(tag)}&size=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const r = await request("GET", q, { parse: parseStream });
    if (!r.ok) return r;
    users.push(...r.data.users);
    if (!r.data.hasMore || !r.data.nextCursor) return { ok: true, status: r.status, data: { users, truncated: false } };
    cursor = r.data.nextCursor;
  }
  return { ok: true, status: 200, data: { users, truncated: true } };
}

/** POST /api/users. Not retried: a lost response is recovered by the A019 adoption path. */
export async function createUser(body: CreateUserBody): Promise<RwResult<PanelUser>> {
  if (body.activeInternalSquads.length === 0) {
    const message = "no squad configured — refusing to create a panel user without squads";
    logConfigError(message);
    return { ok: false, kind: "config", status: null, errorCode: null, message, method: "POST", path: "/api/users" };
  }
  return request("POST", "/api/users", { body, parse: parseUserEnvelope, retry: false });
}

/** PATCH /api/users. Absolute values only — safe to retry. */
export function updateUser(body: UpdateUserBody): Promise<RwResult<PanelUser>> {
  if (body.id === undefined && !body.username) {
    return Promise.resolve({ ok: false, kind: "validation", status: null, errorCode: null, message: "updateUser needs id or username", method: "PATCH", path: "/api/users" });
  }
  return request("PATCH", "/api/users", { body, parse: parseUserEnvelope });
}

export function enableUser(id: number): Promise<RwResult<PanelUser>> {
  return request("POST", `/api/users/${id}/actions/enable`, { parse: parseUserEnvelope });
}

export function disableUser(id: number): Promise<RwResult<PanelUser>> {
  return request("POST", `/api/users/${id}/actions/disable`, { parse: parseUserEnvelope });
}

/**
 * POST /api/users/{id}/actions/revoke. Always rotates vlessUuid and
 * passwords. Without `revokeOnlyPasswords` it also rotates shortUuid,
 * i.e. the subscription URL changes.
 */
export function revokeUserSubscription(id: number, opts: { revokeOnlyPasswords?: boolean } = {}): Promise<RwResult<PanelUser>> {
  return request("POST", `/api/users/${id}/actions/revoke`, {
    body: { revokeOnlyPasswords: opts.revokeOnlyPasswords === true },
    parse: parseUserEnvelope,
  });
}

/** DELETE /api/users/{id} → 204. */
export function deleteUser(id: number): Promise<RwResult<true>> {
  return request("DELETE", `/api/users/${id}`, { parse: () => true });
}

// ─── HWID devices ────────────────────────────────────────────────

export function listHwidDevices(userId: number): Promise<RwResult<{ total: number; devices: HwidDevice[] }>> {
  return request("GET", `/api/hwid/devices/${userId}`, { parse: parseHwidList });
}

export function deleteHwidDevice(userId: number, hwid: string): Promise<RwResult<{ total: number; devices: HwidDevice[] }>> {
  return request("POST", "/api/hwid/devices/delete", { body: { userId, hwid }, parse: parseHwidList });
}

export function deleteAllHwidDevices(userId: number): Promise<RwResult<{ total: number; devices: HwidDevice[] }>> {
  return request("POST", "/api/hwid/devices/delete-all", { body: { userId }, parse: parseHwidList });
}

// ─── Connections (IP addresses) ──────────────────────────────────

export function startUserIpJob(userId: number): Promise<RwResult<{ jobId: string }>> {
  return request("POST", `/api/connections/by-user/${userId}`, {
    parse: (json) => {
      const r = responseOf(json) as Record<string, unknown> | undefined;
      const jobId = r && (typeof r.jobId === "string" || typeof r.jobId === "number") ? String(r.jobId) : null;
      return jobId ? { jobId } : null;
    },
  });
}

export function getUserIpJob(jobId: string): Promise<RwResult<IpJobResult>> {
  return request("GET", `/api/connections/by-user/${encodeURIComponent(jobId)}`, {
    parse: (json) => {
      const r = responseOf(json);
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      return {
        isCompleted: o.isCompleted === true,
        isFailed: o.isFailed === true,
        progress: o.progress ?? null,
        result: (o.result as IpJobResult["result"]) ?? null,
      };
    },
  });
}

// ─── System / nodes ──────────────────────────────────────────────

const parseAnyResponse = (json: unknown): Record<string, unknown> | null => {
  const r = responseOf(json);
  return r && typeof r === "object" ? (r as Record<string, unknown>) : null;
};

/** GET /api/system/stats — users by status, online stats, nodes online, cpu/mem/uptime. Whole panel, not only site users. */
export function getSystemStats(): Promise<RwResult<Record<string, unknown>>> {
  return request("GET", "/api/system/stats", { parse: parseAnyResponse });
}

export function getBandwidthStats(): Promise<RwResult<Record<string, unknown>>> {
  return request("GET", "/api/system/stats/bandwidth", { parse: parseAnyResponse });
}

export function getSystemHealth(): Promise<RwResult<Record<string, unknown>>> {
  return request("GET", "/api/system/health", { parse: parseAnyResponse });
}

export function getNodes(): Promise<RwResult<PanelNode[]>> {
  return request("GET", "/api/nodes", {
    parse: (json) => {
      const r = responseOf(json);
      return Array.isArray(r) ? r.map(parseNode).filter((n): n is PanelNode => !!n) : null;
    },
  });
}

// ─── Trial constants ─────────────────────────────────────────────

/* Значение живёт в src/lib/brand-facts.ts — файле без серверных
   зависимостей, чтобы витрина могла взять то же число, не втягивая в
   браузерный бандл клиент панели. Второй константы с тем же смыслом
   в проекте быть не должно. */
export const TRIAL_DURATION_DAYS = TRIAL_DAYS;
export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
