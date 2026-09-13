/**
 * Fakes for the Telegram ↔ site link tests: the DB (FakeDb + the
 * statements of telegram-link, link-panel, bot-email-link, tokens,
 * bypass, bonus) and an in-memory Remnawave panel. Unknown SQL throws,
 * like fake-db.ts, so a changed query cannot silently pass.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { FakeDb } from "./fake-db";
import { contractUser } from "./fixtures";
import { parsePanelUser, PanelUser, RwResult, UpdateUserBody } from "../remnawave";

type Row = Record<string, any>;
const res = (rows: Row[] = []) => ({ rows, rowCount: rows.length });
const t = (v: any) => new Date(v).getTime();

export class LinkFakeDb extends FakeDb {
  codes = new Map<string, Row>();
  tokens = new Map<string, Row>();
  claims = new Map<string, Row>();
  notifications: Row[] = [];
  audit: Row[] = [];
  bypassOps = new Map<string, Row>();

  reset() {
    super.reset();
    this.codes.clear();
    this.tokens.clear();
    this.claims.clear();
    this.notifications = [];
    this.audit = [];
    this.bypassOps.clear();
  }

  private owner(id: any, except: any): Row | undefined {
    return [...this.users.values()].find(
      (u) => u.id !== except && (String(u.panel_user_id ?? "") === String(id) || String(u.bypass_panel_user_id ?? "") === String(id) || u.remnawave_user_uuid === String(id))
    );
  }

  protected exec(s: string, p: any[]) {
    if (s.startsWith("SELECT pg_advisory_xact_lock")) return res([{}]);

    // ── users (link) ──
    if (s.startsWith("UPDATE users SET email = COALESCE($2, email), email_verified_at")) {
      const u = this.user(p[0]);
      if (p[1] != null) u.email = p[1];
      u.email_verified_at = u.email_verified_at ?? new Date();
      if (p[2]) u.trial_used_at = u.trial_used_at ?? new Date();
      return res();
    }
    if (s === "SELECT id FROM users WHERE id <> $2 AND (panel_user_id = $1 OR bypass_panel_user_id = $1 OR remnawave_user_uuid = $3) LIMIT 1") {
      const o = this.owner(p[0], p[1]);
      return res(o ? [{ id: o.id }] : []);
    }
    if (s.startsWith("UPDATE users SET telegram_id = NULL, telegram_linked = FALSE, link_kept = 'absorbed'")) {
      Object.assign(this.user(p[0]), {
        telegram_id: null, telegram_linked: false, link_kept: "absorbed", panel_user_id: null, remnawave_user_uuid: null,
        remnawave_short_uuid: null, subscription_url: null, panel_username: null, panel_status: null, panel_expire_at: null,
        bypass_panel_user_id: null, panel_sync_state: "ok", panel_sync_attempts: 0,
      });
      return res();
    }
    if (s.startsWith("UPDATE users SET telegram_id = $2, telegram_linked = ($2::text IS NOT NULL)")) {
      const u = this.user(p[0]);
      Object.assign(u, {
        telegram_id: p[1], telegram_linked: p[1] != null, telegram_linked_at: p[1] != null ? new Date() : u.telegram_linked_at ?? null,
        link_kept: p[2], link_disabled_panel_user_id: p[3], link_disable_ids: p[4], link_panel_state: "pending",
        panel_user_id: p[5], remnawave_user_uuid: p[6], remnawave_short_uuid: p[7], subscription_url: p[8],
        panel_username: p[9], panel_status: p[10], panel_expire_at: p[11],
        bypass_panel_user_id: p[12] ?? u.bypass_panel_user_id ?? null,
        panel_sync_state: "pending", panel_sync_attempts: 0,
      });
      return res();
    }
    if (s.startsWith("UPDATE users SET telegram_id = NULL, telegram_linked = FALSE, telegram_link_token = $2")) {
      const u = this.users.get(p[0]);
      if (!u || (u.telegram_id == null && !u.telegram_linked)) return res();
      Object.assign(u, { telegram_id: null, telegram_linked: false, telegram_link_token: p[1], bypass_panel_user_id: null });
      if (u.panel_user_id != null) Object.assign(u, { link_panel_state: "unlink_pending", panel_sync_state: "pending" });
      return res([{ ...u }]);
    }
    if (s === "UPDATE users SET link_panel_state = 'ok', link_disable_ids = NULL WHERE id = $1 AND link_panel_state = $2") {
      const u = this.user(p[0]);
      if (u.link_panel_state === p[1]) Object.assign(u, { link_panel_state: "ok", link_disable_ids: null });
      return res();
    }
    if (s === "SELECT * FROM users WHERE telegram_link_token = $1") {
      return res([...this.users.values()].filter((u) => u.telegram_link_token === p[0]).map((u) => ({ ...u })));
    }
    if (s === "UPDATE users SET telegram_link_token = $2 WHERE id = $1 AND telegram_link_token = $3") {
      const u = this.user(p[0]);
      if (u.telegram_link_token === p[2]) u.telegram_link_token = p[1];
      return res();
    }
    if (s === "UPDATE users SET bypass_panel_user_id = $2 WHERE id = $1 AND bypass_panel_user_id IS NULL") {
      const u = this.user(p[0]);
      if (u.bypass_panel_user_id == null) u.bypass_panel_user_id = p[1];
      return res();
    }

    // ── bonus ──
    if (s.startsWith("INSERT INTO telegram_bonus_claims")) {
      if (this.claims.has(p[0])) return res();
      this.claims.set(p[0], { telegram_id: p[0], user_id: p[1] });
      return res([{ telegram_id: p[0] }]);
    }
    if (s.startsWith("UPDATE users SET telegram_bonus_granted_at = NOW()")) {
      const u = this.user(p[0]);
      if (u.telegram_bonus_granted_at) return res();
      u.telegram_bonus_granted_at = new Date();
      return res([{ id: u.id }]);
    }

    // ── side effects ──
    if (s.startsWith("INSERT INTO notifications")) {
      this.notifications.push({ id: p[0], title: p[1], message: p[2], target: p[3] });
      return res();
    }
    if (s.startsWith("INSERT INTO audit_logs")) {
      this.audit.push({ action: p[3], details: p[4], user_id: p[1] });
      return res();
    }

    // ── bot email codes ──
    if (s.startsWith("INSERT INTO bot_email_codes")) {
      this.codes.set(p[0], { telegram_id: p[0], email: p[1], code_salt: p[2], code_hash: p[3], attempts: 0, expires_at: p[4], request_ip: p[5] });
      return res();
    }
    if (s === "SELECT telegram_id, email, code_salt, code_hash, attempts, expires_at FROM bot_email_codes WHERE telegram_id = $1") {
      const c = this.codes.get(p[0]);
      return res(c ? [{ ...c }] : []);
    }
    if (s === "UPDATE bot_email_codes SET attempts = attempts + 1 WHERE telegram_id = $1 AND code_hash = $2 RETURNING attempts") {
      const c = this.codes.get(p[0]);
      if (!c || c.code_hash !== p[1]) return res();
      c.attempts += 1;
      return res([{ attempts: c.attempts }]);
    }
    if (s === "DELETE FROM bot_email_codes WHERE telegram_id = $1 AND code_hash = $2") {
      const c = this.codes.get(p[0]);
      if (c && c.code_hash === p[1]) this.codes.delete(p[0]);
      return res();
    }

    // ── one-time link tokens ──
    if (s.startsWith("INSERT INTO telegram_link_tokens")) {
      this.tokens.set(p[0], { token_hash: p[0], user_id: p[1], expires_at: p[2], used_at: null, used_by_telegram_id: null });
      return res();
    }
    if (s === "SELECT user_id, expires_at, used_at, used_by_telegram_id FROM telegram_link_tokens WHERE token_hash = $1") {
      const tk = this.tokens.get(p[0]);
      return res(tk ? [{ ...tk }] : []);
    }
    if (s.startsWith("UPDATE telegram_link_tokens SET used_at = NOW(), used_by_telegram_id = $2")) {
      const tk = this.tokens.get(p[0]);
      if (!tk || tk.used_at) return res();
      Object.assign(tk, { used_at: new Date(), used_by_telegram_id: p[1] });
      return res([{ user_id: tk.user_id }]);
    }

    // ── bypass traffic ops ──
    if (s.startsWith("INSERT INTO bypass_traffic_ops")) {
      if (!this.bypassOps.has(p[0])) this.bypassOps.set(p[0], { op_id: p[0], panel_user_id: p[1], add_bytes: p[2], note: p[3], base_limit: null, state: "pending" });
      return res();
    }
    if (s === "SELECT op_id, panel_user_id, add_bytes, base_limit, state FROM bypass_traffic_ops WHERE op_id = $1") {
      const o = this.bypassOps.get(p[0]);
      return res(o ? [{ ...o }] : []);
    }
    if (s.startsWith("UPDATE bypass_traffic_ops SET base_limit = COALESCE(base_limit, $2)")) {
      const o = this.bypassOps.get(p[0])!;
      o.base_limit = o.base_limit ?? p[1];
      return res([{ base_limit: o.base_limit }]);
    }
    if (s.startsWith("UPDATE bypass_traffic_ops SET state = $2")) {
      const o = this.bypassOps.get(p[0])!;
      Object.assign(o, { state: p[1], note: p[2] ?? o.note, applied_at: new Date() });
      return res();
    }

    return super.exec(s, p);
  }
}

export const linkDb = new LinkFakeDb();

// ─── In-memory panel ─────────────────────────────────────────────

export class FakePanel {
  users = new Map<number, Record<string, unknown>>();
  down = false;
  calls: Array<{ fn: string; arg: unknown }> = [];
  private nextId = 900;

  reset() {
    this.users.clear();
    this.down = false;
    this.calls = [];
    this.nextId = 900;
  }

  add(overrides: Record<string, unknown>): PanelUser {
    const raw = contractUser(overrides);
    this.users.set(Number(raw.id), raw);
    return parsePanelUser(raw)!;
  }

  get(id: number): PanelUser | null {
    const raw = this.users.get(id);
    return raw ? parsePanelUser(raw) : null;
  }

  private unavailable(method: string, path: string): RwResult<never> {
    return { ok: false, kind: "unavailable", status: null, errorCode: null, message: "timeout", method, path };
  }
  private notFound(path: string): RwResult<never> {
    return { ok: false, kind: "not_found", status: 404, errorCode: "A025", message: "User not found", method: "GET", path };
  }

  getUserById = async (id: number): Promise<RwResult<PanelUser>> => {
    this.calls.push({ fn: "getUserById", arg: id });
    if (this.down) return this.unavailable("GET", `/api/users/${id}`);
    const u = this.get(id);
    return u ? { ok: true, status: 200, data: u } : this.notFound(`/api/users/${id}`);
  };

  getUserByUsername = async (username: string): Promise<RwResult<PanelUser>> => {
    this.calls.push({ fn: "getUserByUsername", arg: username });
    if (this.down) return this.unavailable("GET", `/api/users/by-username/${username}`);
    const raw = [...this.users.values()].find((u) => u.username === username);
    return raw ? { ok: true, status: 200, data: parsePanelUser(raw)! } : { ...this.notFound(`/api/users/by-username/${username}`), errorCode: "A063" } as RwResult<PanelUser>;
  };

  findUsersByEmail = async (email: string): Promise<RwResult<PanelUser[]>> => {
    this.calls.push({ fn: "findUsersByEmail", arg: email });
    if (this.down) return this.unavailable("GET", "/api/users/stream");
    const list = [...this.users.values()].filter((u) => String(u.email || "").toLowerCase() === email.toLowerCase()).map((u) => parsePanelUser(u)!);
    return { ok: true, status: 200, data: list };
  };

  updateUser = async (body: UpdateUserBody): Promise<RwResult<PanelUser>> => {
    this.calls.push({ fn: "updateUser", arg: body });
    if (this.down) return this.unavailable("PATCH", "/api/users");
    const raw = this.users.get(Number(body.id));
    if (!raw) return this.notFound("/api/users");
    const { id: _id, ...rest } = body;
    void _id;
    Object.assign(raw, rest);
    return { ok: true, status: 200, data: parsePanelUser(raw)! };
  };

  createUser = async (body: Record<string, unknown>): Promise<RwResult<PanelUser>> => {
    this.calls.push({ fn: "createUser", arg: body });
    if (this.down) return this.unavailable("POST", "/api/users");
    const id = this.nextId++;
    const raw = contractUser({ ...body, id, shortUuid: `short${id}`, subscriptionUrl: `https://sub.test/short${id}`, telegramId: null });
    this.users.set(id, raw);
    return { ok: true, status: 201, data: parsePanelUser(raw)! };
  };

  updates(id: number) {
    return this.calls.filter((c) => c.fn === "updateUser" && (c.arg as UpdateUserBody).id === id).map((c) => c.arg as UpdateUserBody);
  }
}

export const fakePanel = new FakePanel();

export const DAY = 86_400_000;
export const inDays = (d: number) => new Date(Date.now() + d * DAY);
export const near = (a: unknown, b: Date, tolMs = 5_000) => Math.abs(t(a) - b.getTime()) <= tolMs;

/** A site account row as the DB would hold it. */
export function seedSiteUser(id: string, extra: Row = {}): Row {
  const row: Row = {
    id,
    email: `${id}@example.com`,
    created_at: new Date("2026-01-01T00:00:00Z"),
    subscription_end: new Date(Date.now() - DAY),
    subscription_plan: "trial",
    referral_code: `R${id}`.toUpperCase().slice(0, 8),
    referrals: 0,
    paid_referrals: 0,
    balance: 0,
    telegram_id: null,
    telegram_linked: false,
    telegram_link_token: null,
    public_id: `ST${id.replace(/\D/g, "").padStart(8, "0").slice(-8)}`,
    panel_user_id: null,
    remnawave_user_uuid: null,
    subscription_url: null,
    panel_expire_at: null,
    bypass_panel_user_id: null,
    panel_sync_state: "ok",
    panel_sync_attempts: 0,
    trial_used_at: new Date("2026-01-01T00:00:00Z"),
    telegram_bonus_granted_at: null,
    ...extra,
  };
  linkDb.users.set(id, row);
  return row;
}
