/**
 * In-memory pg stand-in for the security tests: sessions, Telegram
 * sign-in nonces, users, payments. Like fake-db.ts it matches the exact
 * statements the code issues and THROWS on anything else, so a changed
 * query cannot silently pass.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
type Result = { rows: Row[]; rowCount: number };

const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();
const res = (rows: Row[] = []): Result => ({ rows, rowCount: rows.length });
const t = (v: any) => new Date(v).getTime();

export class SecFakeDb {
  users = new Map<string, Row>();
  sessions: Row[] = [];
  nonces = new Map<string, Row>();
  payments = new Map<string, Row>();
  passwordWrites: Array<{ by: "id" | "email"; key: string }> = [];
  log: string[] = [];

  reset() {
    this.users.clear();
    this.sessions = [];
    this.nonces.clear();
    this.payments.clear();
    this.passwordWrites = [];
    this.log = [];
  }

  pool: any = {
    query: async (sql: string, params: any[] = []) => {
      await Promise.resolve();
      const s = norm(sql);
      this.log.push(s);
      return this.exec(s, params);
    },
  };

  private exec(s: string, p: any[]): Result {
    // ── sessions ──
    if (s.startsWith("INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, ip, user_agent")) {
      this.sessions.push({ id: p[0], user_id: p[1], token_hash: p[2], created_at: p[3], last_seen_at: p[3], expires_at: p[4], ip: p[5], user_agent: p[6], auth_method: p[7] ?? null, revoked_at: null });
      return res();
    }
    if (s === "UPDATE users SET last_login_at = NOW() WHERE id = $1") return res();
    if (s.startsWith("SELECT s.id AS s_id, s.created_at AS s_created_at, s.last_seen_at AS s_last_seen_at, s.expires_at AS s_expires_at")) {
      const sess = this.sessions.find((x) => x.token_hash === p[0] && x.revoked_at === null && t(x.expires_at) > t(p[1]));
      const u = sess && this.users.get(sess.user_id);
      if (!sess || !u) return res();
      return res([{ ...u, s_id: sess.id, s_created_at: sess.created_at, s_last_seen_at: sess.last_seen_at, s_expires_at: sess.expires_at, s_auth_method: sess.auth_method ?? null }]);
    }
    if (s === "UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE id = $1 AND revoked_at IS NULL") {
      const sess = this.sessions.find((x) => x.id === p[0] && x.revoked_at === null);
      if (sess) {
        sess.last_seen_at = p[1];
        sess.expires_at = p[2];
      }
      return { rows: [], rowCount: sess ? 1 : 0 };
    }
    if (s === "UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL") {
      const hit = this.sessions.filter((x) => x.token_hash === p[0] && x.revoked_at === null);
      hit.forEach((x) => (x.revoked_at = new Date()));
      return { rows: [], rowCount: hit.length };
    }
    if (s === "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL AND id <> $2") {
      const hit = this.sessions.filter((x) => x.user_id === p[0] && x.revoked_at === null && x.id !== p[1]);
      hit.forEach((x) => (x.revoked_at = new Date()));
      return { rows: [], rowCount: hit.length };
    }
    if (s === "UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL") {
      const hit = this.sessions.filter((x) => x.user_id === p[0] && x.revoked_at === null);
      hit.forEach((x) => (x.revoked_at = new Date()));
      return { rows: [], rowCount: hit.length };
    }
    if (s.startsWith("DELETE FROM sessions WHERE")) return res();

    // ── telegram nonces ──
    if (s.startsWith("INSERT INTO telegram_auth_nonces (nonce, browser_hash, confirm_code, request_ip, request_ua, created_at, expires_at)")) {
      this.nonces.set(p[0], { nonce: p[0], browser_hash: p[1], confirm_code: p[2], request_ip: p[3], request_ua: p[4], created_at: p[5], expires_at: p[6], user_id: null, telegram_id: null, used: false });
      return res();
    }
    if (s.startsWith("UPDATE telegram_auth_nonces SET user_id = $2, telegram_id = $3, confirmed_at = $4 WHERE nonce = $1 AND user_id IS NULL AND used = FALSE AND browser_hash IS NOT NULL AND expires_at > $4")) {
      const n = this.nonces.get(p[0]);
      if (!n || n.user_id !== null || n.used || !n.browser_hash || t(n.expires_at) <= t(p[3])) return res();
      Object.assign(n, { user_id: p[1], telegram_id: p[2], confirmed_at: p[3] });
      return res([{ confirm_code: n.confirm_code, request_ip: n.request_ip, request_ua: n.request_ua, created_at: n.created_at, expires_at: n.expires_at }]);
    }
    if (s === "SELECT browser_hash, user_id, used, expires_at FROM telegram_auth_nonces WHERE nonce = $1") {
      const n = this.nonces.get(p[0]);
      return res(n ? [{ browser_hash: n.browser_hash, user_id: n.user_id, used: n.used, expires_at: n.expires_at }] : []);
    }
    if (s.startsWith("UPDATE telegram_auth_nonces SET used = TRUE WHERE nonce = $1 AND used = FALSE AND user_id IS NOT NULL AND expires_at > $2 AND browser_hash = $3")) {
      const n = this.nonces.get(p[0]);
      if (!n || n.used || !n.user_id || t(n.expires_at) <= t(p[1]) || n.browser_hash !== p[2]) return res();
      n.used = true;
      return res([{ user_id: n.user_id }]);
    }
    if (s.startsWith("DELETE FROM telegram_auth_nonces")) return res();

    // ── users ──
    if (s === "SELECT * FROM users WHERE email = $1") {
      return res([...this.users.values()].filter((u) => u.email === p[0]).map((u) => ({ ...u })));
    }
    if (s === "SELECT * FROM users WHERE id = $1") {
      const u = this.users.get(p[0]);
      return res(u ? [{ ...u }] : []);
    }
    if (s === "SELECT * FROM users WHERE telegram_id = $1 ORDER BY created_at ASC LIMIT 1") {
      const u = [...this.users.values()].find((x) => x.telegram_id === p[0]);
      return res(u ? [{ ...u }] : []);
    }
    if (s === "UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id") {
      const u = [...this.users.values()].find((x) => x.email === p[1]);
      if (!u) return res();
      u.password_hash = p[0];
      this.passwordWrites.push({ by: "email", key: p[1] });
      return res([{ id: u.id }]);
    }
    if (s === "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id") {
      const u = this.users.get(p[1]);
      if (!u) return res();
      u.password_hash = p[0];
      this.passwordWrites.push({ by: "id", key: p[1] });
      return res([{ id: u.id }]);
    }

    // ── payments ──
    if (s === "SELECT * FROM payments WHERE id = $1") {
      const pay = this.payments.get(p[0]);
      return res(pay ? [{ ...pay }] : []);
    }

    // ── audit (fire-and-forget) ──
    if (s.startsWith("INSERT INTO audit_logs")) return res();
    if (s.startsWith("INSERT INTO notifications")) return res();

    throw new Error(`session-fake: unexpected SQL: ${s}`);
  }
}

export const secDb = new SecFakeDb();

export function seedUser(id: string, extra: Row = {}): Row {
  const row = {
    id,
    email: `${id}@example.com`,
    created_at: new Date("2026-01-01T00:00:00Z"),
    subscription_end: new Date(Date.now() + 5 * 86400000),
    referral_code: `REF${id}`.toUpperCase().slice(0, 8),
    subscription_plan: "trial",
    telegram_id: null,
    telegram_linked: false,
    password_hash: null,
    balance: 0,
    ...extra,
  };
  secDb.users.set(id, row);
  return row;
}
