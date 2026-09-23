/**
 * Route-level security checks (security audit 13.09.2026): IDOR on
 * payments, admin gate, set-password re-auth, Telegram sign-in end to
 * end, bot/register refusing to hand over existing accounts, client IP
 * and the new rate limits.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

vi.mock("../db", async () => {
  const m = await import("./session-fake");
  return { pool: m.secDb.pool, dbReady: Promise.resolve(), waitForDb: async () => {} };
});
vi.mock("../settings", () => ({ isBotSyncEnabled: async () => true }));

// Server components / verifyAdmin read cookies through next/headers.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined) }),
  headers: async () => new Headers(),
}));

import { secDb, seedUser } from "./session-fake";
import { createSession } from "../session-store";
import { SESSION_COOKIE } from "../session";
import { clientIpFrom } from "../client-ip";
import { checkRateLimit, rateLimitEmailDaily, rateLimitLoginEmail } from "../rate-limit";

const BOT_KEY = "test-bot-key-0123456789";
process.env.BOT_API_KEY = BOT_KEY;
process.env.ADMIN_EMAIL = "Admin@Example.com";

function makeReq(url: string, opts: { method?: string; cookies?: Record<string, string>; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.cookies) headers.cookie = Object.entries(opts.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost${url}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

beforeEach(() => {
  secDb.reset();
  jar.clear();
  seedUser("alice");
  seedUser("bob");
  seedUser("admin", { email: "admin@example.com" });
});

describe("IDOR: payments/status", () => {
  beforeEach(() => {
    secDb.payments.set("pay-bob", {
      id: "pay-bob", user_id: "bob", plan: "basic", period: 1, amount: "199.00", currency: "RUB",
      status: "confirmed", expires_at: new Date(), created_at: new Date(),
    });
  });

  it("another user's payment id → 404, the owner → 200", async () => {
    const { GET } = await import("@/app/api/payments/status/route");
    const alice = await createSession("alice");
    const bob = await createSession("bob");

    const r1 = await GET(makeReq("/api/payments/status?id=pay-bob", { cookies: { [SESSION_COOKIE]: alice.token } }));
    expect(r1.status).toBe(404);

    const r2 = await GET(makeReq("/api/payments/status?id=pay-bob", { cookies: { [SESSION_COOKIE]: bob.token } }));
    expect(r2.status).toBe(200);
    expect((await r2.json()).data.status).toBe("confirmed");
  });

  it("a raw user id as the cookie (old scheme) → 401", async () => {
    const { GET } = await import("@/app/api/payments/status/route");
    const r = await GET(makeReq("/api/payments/status?id=pay-bob", { cookies: { [SESSION_COOKIE]: "bob" } }));
    expect(r.status).toBe(401);
  });
});

describe("admin gate", () => {
  it("only a live session of ADMIN_EMAIL (case-insensitive) passes", async () => {
    const { verifyAdmin } = await import("@/app/api/admin/middleware");

    expect((await verifyAdmin()).authorized).toBe(false);

    jar.set(SESSION_COOKIE, "admin"); // raw id — the old bypass
    expect((await verifyAdmin()).authorized).toBe(false);

    jar.set(SESSION_COOKIE, (await createSession("alice")).token);
    expect(await verifyAdmin()).toMatchObject({ authorized: false, error: "Доступ запрещён" });

    jar.set(SESSION_COOKIE, (await createSession("admin")).token);
    expect(await verifyAdmin()).toEqual({ authorized: true, userId: "admin" });
  });
});

describe("set-password", () => {
  beforeAll(() => undefined);

  it("replacing an existing password from an old session needs the current one; others are signed out", async () => {
    const { POST } = await import("@/app/api/auth/set-password/route");
    secDb.users.get("alice")!.password_hash = bcrypt.hashSync("OldPassw0rd", 4);

    const old = await createSession("alice", {}, new Date(Date.now() - 60 * 60 * 1000));
    const other = await createSession("alice");

    const denied = await POST(makeReq("/api/auth/set-password", { method: "POST", cookies: { [SESSION_COOKIE]: old.token }, body: { password: "NewPassw0rd1" } }));
    expect(denied.status).toBe(403);
    expect(secDb.passwordWrites).toHaveLength(0);

    const wrong = await POST(makeReq("/api/auth/set-password", { method: "POST", cookies: { [SESSION_COOKIE]: old.token }, body: { password: "NewPassw0rd1", currentPassword: "nope" } }));
    expect(wrong.status).toBe(403);

    const ok = await POST(makeReq("/api/auth/set-password", { method: "POST", cookies: { [SESSION_COOKIE]: old.token }, body: { password: "NewPassw0rd1", currentPassword: "OldPassw0rd" } }));
    expect(ok.status).toBe(200);
    const kept = secDb.sessions.find((s) => s.id === old.session.id)!;
    const revoked = secDb.sessions.find((s) => s.id === other.session.id)!;
    expect(kept.revoked_at).toBeNull();
    expect(revoked.revoked_at).not.toBeNull();
  });

  it("a fresh session (just signed in by email code) sets the first password without extra checks", async () => {
    const { POST } = await import("@/app/api/auth/set-password/route");
    const s = await createSession("bob");
    const r = await POST(makeReq("/api/auth/set-password", { method: "POST", cookies: { [SESSION_COOKIE]: s.token }, body: { password: "FirstPassw0rd" } }));
    expect(r.status).toBe(200);
  });
});

describe("telegram sign-in end to end", () => {
  it("only the browser that started the login receives the session", async () => {
    seedUser("tguser", { telegram_id: "555", telegram_linked: true });
    const start = await import("@/app/api/auth/telegram-start/route");
    const check = await import("@/app/api/auth/telegram-check/route");
    const bot = await import("@/app/api/bot/auth-login/route");

    const r0 = await start.POST(makeReq("/api/auth/telegram-start", { method: "POST" }));
    const { nonce } = (await r0.json()).data;
    const secret = r0.cookies.get("tg_login")?.value;
    expect(secret).toBeTruthy();

    // the bot cannot confirm without its key
    const noKey = await bot.POST(makeReq("/api/bot/auth-login", { method: "POST", body: { telegramId: "555", nonce } }));
    expect(noKey.status).toBe(401);

    const confirmed = await bot.POST(makeReq("/api/bot/auth-login", { method: "POST", headers: { "X-Bot-Api-Key": BOT_KEY }, body: { telegramId: "555", nonce } }));
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).data.confirmCode).toMatch(/^\d{4}$/);

    // attacker polls with the nonce but without the browser cookie
    const stranger = await check.GET(makeReq(`/api/auth/telegram-check?nonce=${nonce}`));
    expect(await stranger.json()).toEqual({ success: false, status: "pending" });
    expect(stranger.cookies.get(SESSION_COOKIE)).toBeUndefined();

    const mine = await check.GET(makeReq(`/api/auth/telegram-check?nonce=${nonce}`, { cookies: { tg_login: secret! } }));
    expect((await mine.json()).success).toBe(true);
    const token = mine.cookies.get(SESSION_COOKIE)?.value;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toBe("tguser");

    // replay
    const again = await check.GET(makeReq(`/api/auth/telegram-check?nonce=${nonce}`, { cookies: { tg_login: secret! } }));
    expect((await again.json()).status).toBe("used");
  });

  it("the bot can no longer create a nonce by itself", async () => {
    seedUser("tguser", { telegram_id: "555", telegram_linked: true });
    const bot = await import("@/app/api/bot/auth-login/route");
    const r = await bot.POST(makeReq("/api/bot/auth-login", { method: "POST", headers: { "X-Bot-Api-Key": BOT_KEY }, body: { telegramId: "555", nonce: "attackerChosenNonce123" } }));
    expect(r.status).toBe(404);
    expect((await r.json()).code).toBe("NONCE_INVALID");
  });
});

describe("bot/register", () => {
  it("refuses to link a Telegram id to an EXISTING account by an unverified email", async () => {
    const { POST } = await import("@/app/api/bot/register/route");
    const r = await POST(makeReq("/api/bot/register", { method: "POST", headers: { "X-Bot-Api-Key": BOT_KEY }, body: { telegramId: "999", email: "Admin@Example.com" } }));
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("EMAIL_TAKEN");
    expect(secDb.users.get("admin")!.telegram_id).toBeNull();
  });
});

describe("bot/linked", () => {
  it("список связанных не отдаётся без ключа бота", async () => {
    // Маршрут отдаёт множество Telegram ID разом. Проверка ключа стоит
    // ДО обращения к базе, поэтому отказ виден и на голом маршруте.
    const { GET } = await import("@/app/api/bot/linked/route");
    const r = await GET(makeReq("/api/bot/linked"));
    expect(r.status).toBe(401);
    const wrong = await GET(makeReq("/api/bot/linked", { headers: { "X-Bot-Api-Key": BOT_KEY + "x" } }));
    expect(wrong.status).toBe(401);
  });
});

describe("client IP and limits", () => {
  const h = (o: Record<string, string>) => new Headers(o);

  // 15.09.2026: the site is behind Railway's edge, not Cloudflare. A prod test
  // showed forged cf-connecting-ip values bypassing the send-code IP limit.
  it("ignores a client-supplied cf-connecting-ip (no Cloudflare in front)", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
    expect(clientIpFrom(h({ "cf-connecting-ip": "203.0.113.7" }))).toBeNull();
  });

  it("takes the RIGHTMOST public x-forwarded-for entry (the one the proxy appended)", () => {
    // client prepended a fake address; the proxy appended the real one
    expect(clientIpFrom(h({ "x-forwarded-for": "198.51.100.99, 203.0.113.50" }))).toBe("203.0.113.50");
    // internal platform hops after the real client are skipped
    expect(clientIpFrom(h({ "x-forwarded-for": "203.0.113.50, 10.0.0.1, 100.64.3.2" }))).toBe("203.0.113.50");
    // a single entry (proxy overwrote the header) works the same
    expect(clientIpFrom(h({ "x-forwarded-for": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("falls back to x-real-ip, then to a private hop, and rejects junk", () => {
    expect(clientIpFrom(h({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIpFrom(h({ "x-forwarded-for": "10.0.0.5" }))).toBe("10.0.0.5");
    expect(clientIpFrom(h({ "x-forwarded-for": "<script>" }))).toBeNull();
    expect(clientIpFrom(h({}))).toBeNull();
  });

  it("daily code cap per email and per-account password cap", () => {
    const email = `cap-${Date.now()}@example.com`;
    for (let i = 0; i < 15; i++) expect(rateLimitEmailDaily(email).allowed).toBe(true);
    expect(rateLimitEmailDaily(email).allowed).toBe(false);

    for (let i = 0; i < 10; i++) expect(rateLimitLoginEmail(email).allowed).toBe(true);
    expect(rateLimitLoginEmail(email).allowed).toBe(false);
  });

  it("checkRateLimit reports retry-after", () => {
    const k = `k-${Date.now()}`;
    checkRateLimit(k, 1, 60_000);
    const r = checkRateLimit(k, 1, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });
});
