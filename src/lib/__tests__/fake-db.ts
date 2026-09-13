/**
 * In-memory stand-in for the pg Pool, for tests only.
 *
 * It understands exactly the SQL statements the ledger, payments,
 * sync, trial and referral code issue (matched on normalised text) and
 * throws on anything else, so a changed query cannot silently pass.
 *
 * Conditional UPDATEs (`… WHERE status IN (…) RETURNING`) are evaluated
 * synchronously inside one call, i.e. atomically — the same guarantee
 * Postgres gives a single statement. Every call yields a microtask
 * first, so concurrent callers really interleave.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Row = Record<string, any>;
type Result = { rows: Row[]; rowCount: number };

const norm = (sql: string) => sql.replace(/\s+/g, " ").trim();
const res = (rows: Row[] = []): Result => ({ rows, rowCount: rows.length });

export class FakeDb {
  users = new Map<string, Row>();
  payments = new Map<string, Row>();
  events: Row[] = [];
  rewards: Row[] = [];
  balanceTx: Row[] = [];
  blocklist: Row[] = [];
  /** bypass_grants (bypass-ledger.ts / bypass-grants.ts). */
  grants = new Map<string, Row>();
  log: string[] = [];
  private seq = 0;
  private grantSeq = 0;

  reset() {
    this.users.clear();
    this.payments.clear();
    this.events = [];
    this.rewards = [];
    this.balanceTx = [];
    this.blocklist = [];
    this.grants.clear();
    this.log = [];
    this.seq = 0;
    this.grantSeq = 0;
  }

  /** Owed grants in the order bypass-grants.ts reads them: seeding first, then oldest. */
  private owed(userId: string): Row[] {
    return [...this.grants.values()]
      .filter((g) => g.user_id === userId && (g.state === "pending" || g.state === "seeding"))
      .sort((a, b) => (a.state === "seeding" ? 0 : 1) - (b.state === "seeding" ? 0 : 1) || a._n - b._n);
  }

  query = async (sql: string, params: any[] = []): Promise<Result> => {
    await Promise.resolve();
    const s = norm(sql);
    this.log.push(s);
    return this.exec(s, params);
  };

  // Typed loosely on purpose: it stands in for both pg's Pool and the
  // ledger's Queryable, whose overloaded `query` signature a fake cannot mirror.
  pool: any = {
    query: (sql: string, params?: any[]) => this.query(sql, params),
    connect: async () => ({ query: (sql: string, params?: any[]) => this.query(sql, params), release: () => {} }),
  };

  protected user(id: string): Row {
    const u = this.users.get(id);
    if (!u) throw new Error(`fake-db: no user ${id}`);
    return u;
  }

  protected exec(s: string, p: any[]): Result {
    // ── transaction control / locks ──
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT)\b/.test(s)) return res();
    if (s.startsWith("SELECT pg_try_advisory_lock")) return res([{ ok: true }]);
    if (s.startsWith("SELECT pg_advisory_unlock")) return res();

    // ── users ──
    if (s === "SELECT subscription_end, subscription_plan FROM users WHERE id = $1 FOR UPDATE") {
      const u = this.users.get(p[0]);
      return res(u ? [{ subscription_end: u.subscription_end, subscription_plan: u.subscription_plan }] : []);
    }
    if (s.startsWith("SELECT id, email, public_id, panel_id, panel_username, panel_user_id")) {
      const u = this.users.get(p[0]);
      return res(u ? [{ ...u }] : []);
    }
    if (s === "SELECT * FROM users WHERE id = $1") {
      const u = this.users.get(p[0]);
      return res(u ? [{ ...u }] : []);
    }
    if (s === "SELECT * FROM users WHERE email = $1") {
      return res([...this.users.values()].filter((u) => u.email === p[0]).map((u) => ({ ...u })));
    }
    if (s.startsWith("UPDATE users SET subscription_end = $2, subscription_plan = COALESCE($3, subscription_plan), panel_sync_state = 'pending'")) {
      const u = this.user(p[0]);
      u.subscription_end = p[1];
      if (p[2] != null) u.subscription_plan = p[2];
      u.panel_sync_state = "pending";
      u.panel_sync_attempts = 0;
      return res();
    }
    if (s.startsWith("UPDATE users SET panel_user_id = NULL")) {
      const u = this.user(p[0]);
      Object.assign(u, { panel_user_id: null, remnawave_user_uuid: null, remnawave_short_uuid: null, subscription_url: null, panel_status: null, panel_expire_at: null });
      return res();
    }
    if (s.startsWith("UPDATE users SET panel_user_id = $2")) {
      const u = this.user(p[0]);
      const same = new Date(u.subscription_end).getTime() === new Date(p[8]).getTime() && (u.subscription_plan ?? null) === (p[9] ?? null);
      Object.assign(u, {
        panel_user_id: String(p[1]),
        remnawave_user_uuid: p[2],
        remnawave_short_uuid: p[3],
        subscription_url: p[4],
        panel_username: p[5],
        panel_status: p[6],
        panel_expire_at: p[7],
        panel_sync_state: same ? "ok" : "pending",
        panel_sync_attempts: 0,
        panel_sync_error: null,
      });
      return res();
    }
    if (s.startsWith("UPDATE users SET panel_sync_state = CASE")) {
      const u = this.user(p[0]);
      const same = new Date(u.subscription_end).getTime() === new Date(p[1]).getTime() && (u.subscription_plan ?? null) === (p[2] ?? null);
      Object.assign(u, { panel_sync_state: same ? "ok" : "pending", panel_sync_attempts: 0, panel_sync_error: null });
      return res();
    }
    if (s.startsWith("UPDATE users SET panel_sync_state = 'error'")) {
      const u = this.user(p[0]);
      Object.assign(u, { panel_sync_state: "error", panel_sync_attempts: p[1], panel_sync_error: p[2], panel_next_sync_at: p[3] });
      return res();
    }
    if (s.startsWith("SELECT email FROM users WHERE (panel_user_id = $1")) {
      return res([...this.users.values()].filter((u) => u.id !== p[2] && (String(u.panel_user_id) === String(p[0]) || u.remnawave_user_uuid === p[1])).map((u) => ({ email: u.email })));
    }
    if (s.startsWith("INSERT INTO users (id, email, created_at, subscription_end")) {
      if ([...this.users.values()].some((u) => u.email === p[1])) return res();
      const row: Row = {
        id: p[0],
        email: p[1],
        created_at: p[2],
        subscription_end: p[2],
        referral_code: p[3],
        referred_by: p[4],
        telegram_link_token: p[5],
        registration_ip: p[6],
        device_fingerprint: p[7],
        public_id: `ST${String(++this.seq).padStart(8, "0")}`,
        subscription_plan: "trial",
        referrals: 0,
        paid_referrals: 0,
        balance: 0,
        telegram_linked: false,
        panel_sync_state: "pending",
        panel_sync_attempts: 0,
        trial_used_at: null,
        referral_paid_counted_at: null,
      };
      this.users.set(row.id, row);
      return res([{ ...row }]);
    }
    if (s.startsWith("UPDATE users SET referrals = referrals + 1 WHERE referral_code = $1")) {
      for (const u of this.users.values()) if (u.referral_code === p[0] && u.id !== p[1]) u.referrals += 1;
      return res();
    }
    if (s === "UPDATE users SET trial_used_at = NOW() WHERE id = $1") {
      this.user(p[0]).trial_used_at = new Date();
      return res();
    }

    // ── ledger ──
    if (s.startsWith("INSERT INTO subscription_events")) {
      const [id, user_id, kind, source_id, days, old_end, new_end, plan, actor, meta] = p;
      if (this.events.some((e) => e.kind === kind && e.source_id === source_id)) return res();
      this.events.push({ id, user_id, kind, source_id, days, old_end, new_end, plan, actor, meta: meta ? JSON.parse(meta) : null, created_at: new Date() });
      return res([{ id }]);
    }
    if (s.startsWith("SELECT source_id FROM subscription_events WHERE user_id = $1 AND kind = 'bot_extend'")) {
      const since = Date.now() - Number(p[1]) * 1000;
      const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
      const hit = this.events
        .filter(
          (e) =>
            e.user_id === p[0] &&
            e.kind === "bot_extend" &&
            e.created_at.getTime() > since &&
            text(e.meta?.requestedDays) === p[2] &&
            (e.plan ?? null) === (p[3] ?? null) &&
            text(e.meta?.amount) === (p[4] ?? null)
        )
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      return res(hit.slice(0, 1).map((e) => ({ source_id: e.source_id })));
    }
    // ── bypass grants (bypass-ledger.ts, bypass-grants.ts) ──
    if (s.startsWith("INSERT INTO bypass_grants (id, user_id, kind, bytes, pack_id, payment_id, actor, note)")) {
      if (this.grants.has(p[0])) return res();
      this.grants.set(p[0], {
        id: p[0], user_id: p[1], kind: p[2], bytes: p[3], pack_id: p[4], payment_id: p[5], actor: p[6], note: p[7],
        state: "pending", panel_user_id: null, attempts: 0, last_error: null, next_attempt_at: null,
        created_at: new Date(), applied_at: null, _n: ++this.grantSeq,
      });
      return res([{ id: p[0] }]);
    }
    if (s.startsWith("SELECT * FROM bypass_grants WHERE user_id = $1 AND state IN ('pending', 'seeding') ORDER BY")) {
      return res(this.owed(p[0]).map((g) => ({ ...g })));
    }
    if (s === "UPDATE bypass_grants SET state = 'seeding' WHERE id = $1 AND state = 'pending'") {
      const g = this.grants.get(p[0]);
      if (g && g.state === "pending") g.state = "seeding";
      return res();
    }
    if (s === "UPDATE bypass_grants SET state = 'pending' WHERE id = $1 AND state = 'seeding'") {
      const g = this.grants.get(p[0]);
      if (g && g.state === "seeding") g.state = "pending";
      return res();
    }
    if (s.startsWith("UPDATE bypass_grants SET state = $2, panel_user_id = COALESCE($3, panel_user_id)")) {
      const g = this.grants.get(p[0]);
      if (g && (g.state === "pending" || g.state === "seeding")) {
        Object.assign(g, { state: p[1], panel_user_id: p[2] ?? g.panel_user_id, note: p[3] ?? g.note, last_error: null, applied_at: new Date() });
      }
      return res();
    }
    if (s.startsWith("UPDATE bypass_grants SET attempts = attempts + 1, last_error = $2, next_attempt_at = $3")) {
      for (const g of this.owed(p[0])) Object.assign(g, { attempts: g.attempts + 1, last_error: p[1], next_attempt_at: p[2] });
      return res();
    }
    if (s.startsWith("SELECT user_id FROM bypass_grants WHERE state IN ('pending', 'seeding') AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())")) {
      const now = Date.now();
      const due = [...this.grants.values()]
        .filter((g) => (g.state === "pending" || g.state === "seeding") && (!g.next_attempt_at || new Date(g.next_attempt_at).getTime() <= now))
        .sort((a, b) => a._n - b._n);
      const ids = [...new Set(due.map((g) => g.user_id))].slice(0, Number(p[0]));
      return res(ids.map((user_id) => ({ user_id })));
    }
    if (s.startsWith("SELECT COALESCE(SUM(bytes), 0) AS n FROM bypass_grants WHERE user_id = $1")) {
      return res([{ n: this.owed(p[0]).reduce((sum, g) => sum + Number(g.bytes), 0) }]);
    }
    if (s === "SELECT state FROM bypass_grants WHERE id = $1" || s === "SELECT * FROM bypass_grants WHERE id = $1") {
      const g = this.grants.get(p[0]);
      return res(g ? [{ ...g }] : []);
    }
    if (s.startsWith("SELECT * FROM bypass_grants WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2")) {
      return res([...this.grants.values()].filter((g) => g.user_id === p[0]).sort((a, b) => b._n - a._n).slice(0, Number(p[1])).map((g) => ({ ...g })));
    }
    if (s === "UPDATE payments SET applied_to_remnawave_at = NOW() WHERE id = $1 AND applied_to_remnawave_at IS NULL") {
      const pay = this.payments.get(p[0]);
      if (pay && !pay.applied_to_remnawave_at) pay.applied_to_remnawave_at = new Date();
      return res();
    }
    // ── users: bypass entity of the account ──
    if (s === "SELECT id, email, public_id, telegram_id, bypass_panel_user_id, bypass_origin, email_verified_at FROM users WHERE id = $1") {
      const u = this.users.get(p[0]);
      return res(u ? [{ ...u }] : []);
    }
    if (s.startsWith("UPDATE users SET bypass_panel_user_id = $2, bypass_origin = $3, bypass_subscription_url = COALESCE($4, bypass_subscription_url)")) {
      const u = this.user(p[0]);
      if (u.bypass_panel_user_id == null || String(u.bypass_panel_user_id) === String(p[1])) {
        Object.assign(u, { bypass_panel_user_id: p[1], bypass_origin: p[2], bypass_subscription_url: p[3] ?? u.bypass_subscription_url ?? null });
      }
      return res();
    }
    if (s.startsWith("UPDATE users SET bypass_panel_user_id = NULL, bypass_origin = NULL, bypass_subscription_url = NULL WHERE id = $1 AND bypass_panel_user_id = $2")) {
      const u = this.user(p[0]);
      if (String(u.bypass_panel_user_id) === String(p[1])) Object.assign(u, { bypass_panel_user_id: null, bypass_origin: null, bypass_subscription_url: null });
      return res();
    }
    if (s.startsWith("UPDATE users SET bypass_subscription_url = $3 WHERE id = $1 AND bypass_panel_user_id = $2")) {
      const u = this.users.get(p[0]);
      if (u && String(u.bypass_panel_user_id) === String(p[1])) u.bypass_subscription_url = p[2];
      return res();
    }
    if (s.startsWith("UPDATE users SET public_id = 'ST' || LPAD(NEXTVAL('user_public_id_seq')::text, 8, '0') WHERE id = $1 AND public_id IS NULL")) {
      const u = this.user(p[0]);
      if (u.public_id) return res();
      u.public_id = `ST${String(++this.seq).padStart(8, "0")}`;
      return res([{ public_id: u.public_id }]);
    }
    if (s === "SELECT public_id FROM users WHERE id = $1") {
      const u = this.users.get(p[0]);
      return res(u ? [{ public_id: u.public_id ?? null }] : []);
    }
    // ── payments: create (api/payments/create) ──
    if (s.startsWith("INSERT INTO payments (id, user_id, plan, period, amount, transaction_id, redirect_url, expires_at, product, traffic_pack_id, traffic_bytes)")) {
      const row: Row = {
        id: p[0], user_id: p[1], plan: p[2], period: p[3], amount: String(p[4]), transaction_id: p[5], redirect_url: p[6], expires_at: p[7],
        product: p[8], traffic_pack_id: p[9], traffic_bytes: p[10], currency: "RUB", status: "pending", created_at: new Date(),
        paid_at: null, applied_at: null, refunded_at: null, refund_id: null,
      };
      this.payments.set(row.id, row);
      return res([{ ...row }]);
    }
    if (s.startsWith("UPDATE payments SET transaction_id = $2, redirect_url = COALESCE($3, redirect_url) WHERE id = $1")) {
      const pay = this.payments.get(p[0]);
      if (pay && (pay.transaction_id == null || pay.transaction_id === p[1])) Object.assign(pay, { transaction_id: p[1], redirect_url: p[2] ?? pay.redirect_url });
      return res();
    }

    // ── admin history ──
    if (s.startsWith("SELECT id, status, amount, currency, plan, period, transaction_id, created_at, paid_at, applied_at, refunded_at, refund_id, product, traffic_pack_id, traffic_bytes FROM payments WHERE user_id = $1")) {
      return res(
        [...this.payments.values()]
          .filter((x) => x.user_id === p[0])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, Number(p[1]))
          .map((x) => ({ ...x }))
      );
    }
    if (s.startsWith("SELECT id, kind, days, old_end, new_end, plan, actor, source_id, meta, created_at FROM subscription_events WHERE user_id = $1")) {
      return res(
        this.events
          .filter((e) => e.user_id === p[0])
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
          .slice(0, Number(p[1]))
          .map((e) => ({ ...e }))
      );
    }
    if (s === "SELECT id FROM users WHERE id = $1 FOR UPDATE") {
      const u = this.users.get(p[0]);
      return res(u ? [{ id: u.id }] : []);
    }
    if (s === "SELECT * FROM users WHERE telegram_id = $1 ORDER BY created_at ASC LIMIT 1") {
      const u = [...this.users.values()].find((x) => x.telegram_id === p[0]);
      return res(u ? [{ ...u }] : []);
    }

    // ── payments ──
    if (s.startsWith("UPDATE payments SET status = 'confirmed', paid_at = COALESCE(paid_at, NOW()), applied_at = NOW() WHERE id = $1 AND status IN ('pending', 'expired') RETURNING *")) {
      const pay = this.payments.get(p[0]);
      if (!pay || !["pending", "expired"].includes(pay.status)) return res();
      Object.assign(pay, { status: "confirmed", paid_at: pay.paid_at ?? new Date(), applied_at: new Date() });
      return res([{ ...pay }]);
    }
    if (s === "SELECT * FROM payments WHERE id = $1") {
      const pay = this.payments.get(p[0]);
      return res(pay ? [{ ...pay }] : []);
    }
    if (s === "SELECT * FROM payments WHERE transaction_id = $1") {
      return res([...this.payments.values()].filter((x) => x.transaction_id === p[0]).map((x) => ({ ...x })));
    }
    if (s === "UPDATE payments SET applied_to_remnawave_at = NOW() WHERE id = $1") {
      const pay = this.payments.get(p[0]);
      if (pay) pay.applied_to_remnawave_at = new Date();
      return res();
    }
    if (s === "UPDATE payments SET status = $2 WHERE id = $1 AND status = ANY($3) RETURNING *") {
      const pay = this.payments.get(p[0]);
      if (!pay || !(p[2] as string[]).includes(pay.status)) return res();
      pay.status = p[1];
      return res([{ ...pay }]);
    }
    if (s.startsWith("UPDATE payments SET status = 'refunded'")) {
      const pay = this.payments.get(p[0]);
      if (pay) Object.assign(pay, { status: "refunded", refunded_at: pay.refunded_at ?? new Date(), refund_id: p[1] });
      return res();
    }

    // ── referral cashback ──
    if (s === "SELECT referred_by, email FROM users WHERE id = $1") {
      const u = this.users.get(p[0]);
      return res(u ? [{ referred_by: u.referred_by ?? null, email: u.email }] : []);
    }
    if (s === "SELECT id, email, paid_referrals FROM users WHERE referral_code = $1 FOR UPDATE") {
      return res([...this.users.values()].filter((u) => u.referral_code === p[0]).map((u) => ({ id: u.id, email: u.email, paid_referrals: u.paid_referrals })));
    }
    if (s.startsWith("INSERT INTO referral_rewards")) {
      const [id, referrer_id, buyer_id, purchase_id, purchase_amount, percent, reward_amount] = p;
      if (this.rewards.some((r) => r.buyer_id === buyer_id && r.purchase_id === purchase_id)) return res();
      this.rewards.push({ id, referrer_id, buyer_id, purchase_id, purchase_amount, percent, reward_amount });
      return res([{ id }]);
    }
    if (s === "UPDATE users SET referral_paid_counted_at = NOW() WHERE id = $1 AND referral_paid_counted_at IS NULL RETURNING id") {
      const u = this.user(p[0]);
      if (u.referral_paid_counted_at) return res();
      u.referral_paid_counted_at = new Date();
      return res([{ id: u.id }]);
    }
    if (s === "UPDATE users SET balance = balance + $1, paid_referrals = paid_referrals + $2 WHERE id = $3") {
      const u = this.user(p[2]);
      u.balance += p[0];
      u.paid_referrals += p[1];
      return res();
    }
    if (s.startsWith("INSERT INTO balance_transactions")) {
      this.balanceTx.push({ id: p[0], user_id: p[1], amount: p[2] });
      return res();
    }

    // ── trial blocklist ──
    if (s === "SELECT 1 FROM trial_blocklist WHERE email_normalized = $1") {
      return res(this.blocklist.filter((b) => b.email_normalized === p[0]).map(() => ({ "?column?": 1 })));
    }
    if (s.startsWith("SELECT COUNT(DISTINCT email_normalized)::text AS c FROM trial_blocklist WHERE ip = $1")) {
      return res([{ c: String(new Set(this.blocklist.filter((b) => b.ip === p[0]).map((b) => b.email_normalized)).size) }]);
    }
    if (s.startsWith("SELECT COUNT(DISTINCT email_normalized)::text AS c FROM trial_blocklist WHERE device_fingerprint = $1")) {
      return res([{ c: String(new Set(this.blocklist.filter((b) => b.device_fingerprint === p[0]).map((b) => b.email_normalized)).size) }]);
    }
    if (s.startsWith("INSERT INTO trial_blocklist")) {
      const existing = this.blocklist.find((b) => b.email_normalized === p[0]);
      if (existing) existing.trial_count += 1;
      else this.blocklist.push({ email_normalized: p[0], ip: p[1], device_fingerprint: p[2], trial_count: 1 });
      return res();
    }

    throw new Error(`fake-db: unhandled SQL: ${s}`);
  }
}

export const fakeDb = new FakeDb();
