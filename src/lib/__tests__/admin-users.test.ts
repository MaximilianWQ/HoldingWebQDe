/**
 * GET /api/admin/users — params, SQL builder, pagination, counts;
 * GET /api/admin/logs — params; per-user history.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({ pool: { query }, dbReady: Promise.resolve(), waitForDb: async () => {} }));

import {
  buildUsersQuery,
  decodeCursor,
  encodeCursor,
  listUsers,
  parseLogsParams,
  parseUsersParams,
  USER_FILTERS,
} from "../admin-users";

const sp = (s: string) => new URLSearchParams(s);

function userRow(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: `u${i}`,
    email: `u${i}@example.com`,
    created_at: new Date(Date.UTC(2026, 8, 1, 0, i)),
    subscription_end: new Date(Date.now() + 86400000),
    subscription_plan: "basic",
    telegram_linked: false,
    referrals: 0,
    paid_referrals: 0,
    registration_ip: "203.0.113.1",
    panel_id: null,
    public_id: `ST0000000${i}`,
    panel_username: `ST0000000${i}`,
    remnawave_user_uuid: String(100 + i),
    panel_user_id: String(100 + i),
    subscription_url: "https://s/x",
    panel_sync_state: "ok",
    panel_sync_error: null,
    accounts_on_ip: 2,
    last_payment_at: new Date("2026-09-10T10:00:00Z"),
    ...extra,
  };
}

const countsRow = { all: 10, active: 7, paid: 4, trial: 3, expiring: 1, expired: 3, shared_ip: 2, no_link: 1, sync_error: 1, telegram_linked: 5 };

beforeEach(() => {
  query.mockReset();
});

describe("parseUsersParams", () => {
  it("no params → legacy mode (no pagination)", () => {
    const r = parseUsersParams(sp(""));
    expect(r.ok && r.params).toEqual({ q: null, filter: "all", sort: "new", limit: null, offset: 0, paginated: false });
  });

  it("any param → paginated with the default limit; caps the limit", () => {
    const a = parseUsersParams(sp("filter=paid"));
    expect(a.ok && a.params.limit).toBe(100);
    const b = parseUsersParams(sp("limit=99999"));
    expect(b.ok && b.params.limit).toBe(500);
  });

  it("accepts the UI's filter names as aliases", () => {
    const soon = parseUsersParams(sp("filter=soon"));
    const shared = parseUsersParams(sp("filter=shared"));
    const nokey = parseUsersParams(sp("filter=nokey"));
    expect(soon.ok && soon.params.filter).toBe("expiring");
    expect(shared.ok && shared.params.filter).toBe("shared_ip");
    expect(nokey.ok && nokey.params.filter).toBe("no_link");
  });

  it("rejects unknown filters, sorts, bad limits and cursors in Russian", () => {
    for (const q of ["filter=vip", "sort=random", "limit=0", "limit=1.5", "cursor=%%%"]) {
      const r = parseUsersParams(sp(q));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/[а-яё]/i);
    }
  });

  it("cursor round-trips to an offset", () => {
    expect(decodeCursor(encodeCursor(200))).toBe(200);
    const r = parseUsersParams(sp(`cursor=${encodeCursor(200)}`));
    expect(r.ok && r.params.offset).toBe(200);
  });
});

describe("buildUsersQuery", () => {
  it("search escapes LIKE wildcards and matches email / public id / ip / panel username / exact ids", () => {
    const q = buildUsersQuery({ q: "a%b_c", filter: "all", sort: "new", limit: 10, offset: 20, paginated: true });
    expect(q.list.values).toEqual(["%a\\%b\\_c%", "a%b_c", 11, 20]);
    expect(q.list.sql).toContain("b.email ILIKE $1");
    expect(q.list.sql).toContain("b.registration_ip ILIKE $1");
    expect(q.list.sql).toContain("b.panel_username ILIKE $1");
    expect(q.list.sql).toContain("b.id = $2");
    expect(q.list.sql).toContain("LIMIT $3 OFFSET $4");
    expect(q.counts.values).toEqual(["%a\\%b\\_c%", "a%b_c"]);
  });

  it("each filter adds its condition; counts cover every filter", () => {
    expect(buildUsersQuery({ q: null, filter: "sync_error", sort: "new", limit: null, offset: 0, paginated: false }).list.sql).toContain("b.panel_sync_state = 'error'");
    expect(buildUsersQuery({ q: null, filter: "shared_ip", sort: "new", limit: null, offset: 0, paginated: false }).list.sql).toContain("b.accounts_on_ip > 1");
    expect(buildUsersQuery({ q: null, filter: "no_link", sort: "soon", limit: null, offset: 0, paginated: false }).list.sql).toContain("ORDER BY b.subscription_end ASC");
    const counts = buildUsersQuery({ q: null, filter: "all", sort: "new", limit: null, offset: 0, paginated: false }).counts.sql;
    for (const f of USER_FILTERS) expect(counts).toContain(`AS ${f}`);
  });

  it("legacy mode has no LIMIT", () => {
    expect(buildUsersQuery({ q: null, filter: "all", sort: "new", limit: null, offset: 0, paginated: false }).list.sql).not.toContain("LIMIT");
  });
});

describe("listUsers", () => {
  it("paginated: returns limit rows, nextCursor when there are more, total = count of the filter", async () => {
    query.mockImplementation(async (sql: string) => (sql.includes("COUNT(*) FILTER") ? { rows: [countsRow] } : { rows: [userRow(1), userRow(2), userRow(3)] }));
    const p = parseUsersParams(sp("filter=paid&limit=2"));
    if (!p.ok) throw new Error("parse");
    const r = await listUsers(p.params);
    expect(r.users.map((u) => u.id)).toEqual(["u1", "u2"]);
    expect(r.nextCursor).toBe(encodeCursor(2));
    expect(r.total).toBe(4);
    expect(r.counts.sync_error).toBe(1);
    expect(r.stats).toEqual({ total: 10, active: 7, expired: 3, telegramLinked: 5 });
    expect(r.users[0]).toMatchObject({ panelSyncState: "ok", panelSyncError: null, lastPaymentAt: "2026-09-10T10:00:00.000Z", accountsOnIp: 2, panelUserId: 101 });
  });

  it("last page has nextCursor = null", async () => {
    query.mockImplementation(async (sql: string) => (sql.includes("COUNT(*) FILTER") ? { rows: [countsRow] } : { rows: [userRow(1)] }));
    const p = parseUsersParams(sp("limit=2"));
    if (!p.ok) throw new Error("parse");
    expect((await listUsers(p.params)).nextCursor).toBeNull();
  });

  it("legacy mode: every row, no total / nextCursor keys", async () => {
    query.mockImplementation(async (sql: string) => (sql.includes("COUNT(*) FILTER") ? { rows: [countsRow] } : { rows: [userRow(1), userRow(2)] }));
    const p = parseUsersParams(sp(""));
    if (!p.ok) throw new Error("parse");
    const r = await listUsers(p.params);
    expect(r.users).toHaveLength(2);
    expect(r).not.toHaveProperty("nextCursor");
    expect(r).not.toHaveProperty("total");
  });

  it("with a search, stats are still computed over all users", async () => {
    query.mockImplementation(async (sql: string, values: unknown[]) => {
      if (!sql.includes("COUNT(*) FILTER")) return { rows: [] };
      return { rows: [values.length ? { ...countsRow, all: 1 } : countsRow] };
    });
    const p = parseUsersParams(sp("q=u1"));
    if (!p.ok) throw new Error("parse");
    const r = await listUsers(p.params);
    expect(r.counts.all).toBe(1);
    expect(r.stats.total).toBe(10);
  });
});

describe("parseLogsParams", () => {
  it("defaults and validation", () => {
    const d = parseLogsParams(sp(""));
    expect(d.ok && d.params).toEqual({ userId: null, level: null, limit: 200, cursor: null });
    expect(parseLogsParams(sp("level=debug")).ok).toBe(false);
    const w = parseLogsParams(sp("level=warn&userId=u1&limit=9999"));
    expect(w.ok && w.params).toMatchObject({ level: "warn", userId: "u1", limit: 500 });
  });
});
