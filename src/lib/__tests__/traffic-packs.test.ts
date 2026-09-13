/**
 * «Пакеты трафика» on the site (13.09.2026): payment → bypass grant →
 * the panel entity. Against the in-memory DB and panel of the link tests.
 *
 *   amount only from traffic-packs.ts (a client-sent price is ignored);
 *   double confirmation = one credit; first purchase creates ST…_bp with
 *   exact fields; a linked person is credited in the bot's {telegram_id};
 *   the trial 500 MB once (and not for blocked users); BOTH entities on
 *   sign-up; panel down → owed → the worker applies it once; a lost create
 *   answer → A019 adopt, no duplicate; refund keeps the GB; the premium
 *   term is never touched; admin grant idempotent; unlink keeps ST…_bp.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../db", async () => {
  const m = await import("./link-fake");
  return { pool: m.linkDb.pool, dbReady: Promise.resolve(), waitForDb: async () => {} };
});
vi.mock("../locks", () => ({
  withUserSyncLock: async (_id: string, fn: () => Promise<unknown>) => ({ acquired: true, result: await fn() }),
  withJobLock: async (_k: number, fn: () => Promise<unknown>) => ({ acquired: true, result: await fn() }),
  lockLinkKey: async (c: { query: (s: string, p: unknown[]) => Promise<unknown> }, key: string) => {
    await c.query("SELECT pg_advisory_xact_lock($1::int, hashtext($2))", [1, key]);
  },
  LOCK_KEYS: { SYNC_PENDING: 1, RECONCILE: 2, CRON_CLEANUP: 3, HEALTH_SAMPLE: 4 },
  LINK_LOCK_NS: 1,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const panelRef = vi.hoisted(() => ({ current: null as any }));
vi.mock("../remnawave", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../remnawave")>();
  return {
    ...actual,
    getUserById: (id: number) => panelRef.current.getUserById(id),
    getUserByUsername: (u: string) => panelRef.current.getUserByUsername(u),
    findUsersByEmail: (e: string) => panelRef.current.findUsersByEmail(e),
    updateUser: (b: import("../remnawave").UpdateUserBody) => panelRef.current.updateUser(b),
    createUser: (b: Record<string, unknown>) => panelRef.current.createUser(b),
  };
});
vi.mock("../email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../email")>()),
  sendPaymentSucceededEmail: vi.fn(async () => true),
  sendTrafficPackEmail: vi.fn(async () => true),
  sendRefundAdminAlertEmail: vi.fn(async () => true),
}));
vi.mock("../push", () => ({ sendPushToUser: async () => {} }));
vi.mock("../settings", () => ({ isBotSyncEnabled: async () => true }));
vi.mock("../yookassa", () => ({
  createPayment: vi.fn(async () => ({ transactionId: `yk-${Math.random().toString(36).slice(2)}`, redirect: "https://yoomoney.test/checkout", status: "pending" })),
  getPaymentStatus: vi.fn(),
  getRefund: vi.fn(),
  PaymentStatus: { PENDING: "pending", WAITING_FOR_CAPTURE: "waiting_for_capture", SUCCEEDED: "succeeded", CANCELED: "canceled" },
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sessionRef = vi.hoisted(() => ({ user: null as any }));
vi.mock("../session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../session")>()),
  getSessionUser: async () => (sessionRef.user ? { user: sessionRef.user, sessionId: "s1", token: "t" } : null),
}));

import { linkDb, fakePanel, seedSiteUser, inDays, DAY } from "./link-fake";
import { confirmPayment, handleRefund } from "../payments";
import { applyBypassGrants, runBypassGrantsPass, adminGrantBypass } from "../bypass-grants";
import { clearBypassCache } from "../bypass";
import { getOrCreateUser, getUserById, rowToUser } from "../store";
import { syncUserToPanel } from "../subscription-sync";
import { unlinkTelegramAccount } from "../telegram-link";
import { BYPASS_EXPIRE_AT, DEFAULT_BYPASS_SQUAD_UUID, DEFAULT_MAINSERVER_SQUAD_UUID, SITE_BYPASS_TAG } from "../remnawave";
import { DEVICE_LIMIT } from "../plans";
import { TRIAL_DURATION_MS } from "../remnawave";
import { trafficPackById, TRAFFIC_TRIAL_BYTES } from "../traffic-packs";
import * as yk from "../yookassa";

panelRef.current = fakePanel;

const GB = 1024 ** 3;
const BYPASS_SQUAD = DEFAULT_BYPASS_SQUAD_UUID;

beforeEach(() => {
  linkDb.reset();
  fakePanel.reset();
  clearBypassCache();
  sessionRef.user = null;
  delete process.env.REMNAWAVE_BYPASS_SQUAD_UUID;
  delete process.env.REMNAWAVE_BYPASS_DEVICE_LIMIT;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

let paySeq = 0;
/** A pending traffic payment row, as /api/payments/create writes it. */
function seedTrafficPayment(userId: string, packId: "gb15" | "gb50" | "gb100" = "gb50", status = "pending") {
  const pack = trafficPackById(packId)!;
  const id = `pay-${++paySeq}`;
  linkDb.payments.set(id, {
    id, user_id: userId, transaction_id: `yk-${id}`, plan: "traffic", period: 0, amount: `${pack.priceRub}.00`, currency: "RUB",
    status, redirect_url: null, expires_at: new Date(Date.now() + 15 * 60_000), created_at: new Date(), paid_at: null, applied_at: null,
    refunded_at: null, refund_id: null, product: "traffic", traffic_pack_id: pack.id, traffic_bytes: String(pack.gb * GB),
  });
  return id;
}

function siteBypass(publicId: string) {
  return fakePanel.raw(`${publicId}_bp`);
}

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/payments/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/payments/create — the amount comes from the server only", () => {
  it("a traffic pack: amount from traffic-packs.ts, client price and amount ignored", async () => {
    const row = seedSiteUser("u101", { email: "buyer@example.com" });
    sessionRef.user = rowToUser(row);
    const { POST } = await import("@/app/api/payments/create/route");
    const res = await POST(makeReq({ product: "traffic", packId: "gb50", amount: 1, priceRub: 1, gb: 5000 }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({ amount: 269, product: "traffic", packId: "gb50", trafficBytes: 50 * GB });
    expect(vi.mocked(yk.createPayment)).toHaveBeenCalledWith(expect.objectContaining({ amount: 269, metadata: expect.objectContaining({ product: "traffic", packId: "gb50" }) }));
    const pay = linkDb.payments.get(json.data.paymentId)!;
    expect(pay).toMatchObject({ amount: "269", product: "traffic", traffic_pack_id: "gb50", traffic_bytes: 50 * GB, plan: "traffic", period: 0 });
  });

  it("an unknown pack is refused; the subscription path is unchanged", async () => {
    sessionRef.user = rowToUser(seedSiteUser("u102"));
    const { POST } = await import("@/app/api/payments/create/route");
    const bad = await POST(makeReq({ product: "traffic", packId: "gb16", amount: 1 }));
    expect(bad.status).toBe(400);
    const sub = await POST(makeReq({ plan: "basic", period: 1, amount: 1 }));
    expect((await sub.json()).data).toMatchObject({ amount: 199, product: "subscription" });
  });
});

describe("confirmPayment for a traffic pack", () => {
  it("first purchase creates ST…_bp with exact fields; double confirmation = one credit; premium untouched", async () => {
    const end = inDays(10);
    seedSiteUser("u201", { email: "anna@example.com", subscription_end: end, subscription_plan: "plus", email_verified_at: new Date("2026-09-10T00:00:00Z") });
    const pid = seedTrafficPayment("u201", "gb50");

    const [a, b] = await Promise.all([confirmPayment(pid, "webhook"), confirmPayment(pid, "status")]);
    expect([a.outcome, b.outcome].sort()).toEqual(["already_applied", "applied"]);
    expect(linkDb.grants.size).toBe(1);

    const bp = siteBypass("ST00000201")!;
    expect(bp).toMatchObject({
      username: "ST00000201_bp",
      status: "ACTIVE",
      expireAt: BYPASS_EXPIRE_AT,
      trafficLimitBytes: 50 * GB,
      trafficLimitStrategy: "NO_RESET",
      hwidDeviceLimit: 5,
      email: "anna@example.com",
      tag: SITE_BYPASS_TAG,
    });
    expect(bp.activeInternalSquads).toEqual([{ uuid: BYPASS_SQUAD, name: "squad" }]);
    expect(bp.description).toBe("atlas-site:u201 | atlas-email-verified:2026-09-10T00:00:00.000Z");
    expect(bp.externalSquadUuid ?? null).toBeNull();

    const u = linkDb.users.get("u201")!;
    expect(Number(u.bypass_panel_user_id)).toBe(bp.id);
    expect(u.bypass_origin).toBe("site");
    expect(u.bypass_subscription_url).toBe(bp.subscriptionUrl);
    expect(linkDb.payments.get(pid)!.applied_to_remnawave_at).toBeInstanceOf(Date);
    expect(linkDb.grants.get(`payment:${pid}`)).toMatchObject({ state: "applied", panel_user_id: bp.id });

    // A later replay changes nothing.
    expect((await confirmPayment(pid, "webhook")).outcome).toBe("already_applied");
    expect(siteBypass("ST00000201")!.trafficLimitBytes).toBe(50 * GB);
    expect(fakePanel.calls.filter((c) => c.fn === "createUser")).toHaveLength(1);

    // Premium: same end, no ledger payment event, no premium entity written.
    expect(new Date(u.subscription_end).getTime()).toBe(end.getTime());
    expect(u.subscription_plan).toBe("plus");
    expect(linkDb.events.filter((e) => e.kind === "payment")).toHaveLength(0);
    expect(fakePanel.raw("ST00000201")).toBeUndefined();
  });

  it("a second purchase adds to the remaining limit (read-modify-write, never a reset)", async () => {
    seedSiteUser("u202");
    await confirmPayment(seedTrafficPayment("u202", "gb50"), "webhook");
    const bp = siteBypass("ST00000202")!;
    // The person used 20 GB meanwhile.
    (bp.userTraffic as Record<string, unknown>).usedTrafficBytes = 20 * GB;
    clearBypassCache();
    await confirmPayment(seedTrafficPayment("u202", "gb15"), "webhook");
    expect(siteBypass("ST00000202")!.trafficLimitBytes).toBe(65 * GB);
    expect(fakePanel.calls.filter((c) => c.fn === "createUser")).toHaveLength(1);
    expect(linkDb.bypassOps.size).toBe(1);
  });

  it("a linked person is credited in the bot's {telegram_id} entity — no ST…_bp", async () => {
    const tg = "700123";
    const bot = fakePanel.add({ id: 4210, username: tg, telegramId: Number(tg), description: "Bypass via bot (10gb)", tag: null, expireAt: BYPASS_EXPIRE_AT, trafficLimitBytes: 10 * GB, activeInternalSquads: [{ uuid: BYPASS_SQUAD, name: "b" }], userTraffic: { usedTrafficBytes: 3 * GB, lifetimeUsedTrafficBytes: 3 * GB } });
    seedSiteUser("u203", { telegram_id: tg, telegram_linked: true });
    await confirmPayment(seedTrafficPayment("u203", "gb15"), "webhook");
    expect(fakePanel.get(bot.id)!.trafficLimitBytes).toBe(25 * GB);
    expect(siteBypass("ST00000203")).toBeUndefined();
    const u = linkDb.users.get("u203")!;
    expect(Number(u.bypass_panel_user_id)).toBe(bot.id);
    expect(u.bypass_origin).toBe("bot");
    // The bot entity's term, squad, device limit were not written.
    const patches = fakePanel.updates(bot.id);
    expect(patches).toHaveLength(1);
    expect(Object.keys(patches[0]).sort()).toEqual(["id", "trafficLimitBytes"]);
  });

  it("panel down → owed with a backoff; the worker applies it exactly once", async () => {
    seedSiteUser("u204");
    fakePanel.down = true;
    const pid = seedTrafficPayment("u204", "gb100");
    const r = await confirmPayment(pid, "webhook");
    expect(r.outcome).toBe("applied");
    expect(r.panelSynced).toBe(false);
    const g = linkDb.grants.get(`payment:${pid}`)!;
    expect(g.state).toBe("seeding");
    expect(g.attempts).toBe(1);
    expect(new Date(g.next_attempt_at).getTime()).toBeGreaterThan(Date.now());
    expect(linkDb.payments.get(pid)!.status).toBe("confirmed");

    fakePanel.down = false;
    // Backoff not elapsed → the worker skips it.
    expect((await runBypassGrantsPass()).scanned).toBe(0);
    g.next_attempt_at = new Date(Date.now() - 1000);
    expect(await runBypassGrantsPass()).toMatchObject({ scanned: 1, ok: 1 });
    expect(await runBypassGrantsPass()).toMatchObject({ scanned: 0 });
    expect(siteBypass("ST00000204")!.trafficLimitBytes).toBe(100 * GB);
    expect(linkDb.grants.get(`payment:${pid}`)!.state).toBe("applied");
  });

  it("a lost create answer → A019 → adopt our entity, seed applied, no duplicate", async () => {
    seedSiteUser("u205");
    fakePanel.loseNextCreate = true;
    const pid = seedTrafficPayment("u205", "gb50");
    const r = await confirmPayment(pid, "webhook");
    expect(r.panelSynced).toBe(false);
    expect(siteBypass("ST00000205")).toBeDefined();
    expect(linkDb.users.get("u205")!.bypass_panel_user_id).toBeNull();

    const again = await applyBypassGrants("u205");
    expect(again).toMatchObject({ ok: true, created: true, applied: 1 });
    expect([...fakePanel.users.values()].filter((u) => u.username === "ST00000205_bp")).toHaveLength(1);
    expect(siteBypass("ST00000205")!.trafficLimitBytes).toBe(50 * GB);
    expect(linkDb.grants.get(`payment:${pid}`)!.state).toBe("applied");
  });

  it("refund.succeeded marks the payment; the gigabytes stay (no automatic removal)", async () => {
    seedSiteUser("u206", { subscription_end: inDays(3) });
    const pid = seedTrafficPayment("u206", "gb50");
    await confirmPayment(pid, "webhook");
    const endBefore = new Date(linkDb.users.get("u206")!.subscription_end).getTime();
    const refund = { id: "rf-9", payment_id: `yk-${pid}`, status: "succeeded" as const, amount: { value: "269.00", currency: "RUB" }, created_at: new Date().toISOString() };
    expect(await handleRefund(refund)).toBe("recorded");
    expect(linkDb.payments.get(pid)!.status).toBe("refunded");
    expect(siteBypass("ST00000206")!.trafficLimitBytes).toBe(50 * GB);
    expect(new Date(linkDb.users.get("u206")!.subscription_end).getTime()).toBe(endBefore);
    expect(linkDb.audit.find((a) => a.action === "payment.refunded")!.details).toMatch(/ГБ не сняты/);
    expect(await handleRefund(refund)).toBe("duplicate");
  });

  it("referral cashback on a pack, like any paid purchase (one reward per payment)", async () => {
    seedSiteUser("ref1", { referral_code: "REFCODE9", paid_referrals: 0, balance: 0 });
    seedSiteUser("u207", { referred_by: "REFCODE9", referral_paid_counted_at: null });
    const pid = seedTrafficPayment("u207", "gb50");
    const r = await confirmPayment(pid, "webhook");
    expect(r.referral).toMatchObject({ referrerId: "ref1", percent: 10, rewardRubles: 26.9 });
    await confirmPayment(pid, "status");
    expect(linkDb.rewards).toHaveLength(1);
  });
});

describe("trial: 3 days of premium + 500 MB of bypass, once per person", () => {
  it("sign-up with a trial → BOTH panel entities with exact fields; relogin creates nothing more", async () => {
    const before = Date.now();
    const u = await getOrCreateUser("new.person@example.com", undefined, "203.0.113.50", "fp-traffic-0001");
    expect(u.trialGranted).toBe(true);
    // What auth-flow.ts does after a trial sign-up (requestPanelSync + requestBypassApply), awaited here.
    const [prem, bp] = await Promise.all([syncUserToPanel(u.id), applyBypassGrants(u.id)]);
    expect(prem.ok).toBe(true);
    expect(bp).toMatchObject({ ok: true, created: true, applied: 1 });

    const row = linkDb.users.get(u.id)!;
    const publicId = row.public_id as string;
    const premium = fakePanel.raw(publicId)!;
    const bypass = fakePanel.raw(`${publicId}_bp`)!;
    const report = {
      premium: { username: premium.username, squads: premium.activeInternalSquads, tag: premium.tag, expireAt: premium.expireAt, hwidDeviceLimit: premium.hwidDeviceLimit, email: premium.email, trafficLimitBytes: premium.trafficLimitBytes },
      bypass: { username: bypass.username, squads: bypass.activeInternalSquads, tag: bypass.tag, expireAt: bypass.expireAt, hwidDeviceLimit: bypass.hwidDeviceLimit, email: bypass.email, trafficLimitBytes: bypass.trafficLimitBytes, trafficLimitStrategy: bypass.trafficLimitStrategy, description: bypass.description },
    };
    console.info("[TRIAL ENTITIES]", JSON.stringify(report));

    expect(premium.username).toMatch(/^ST\d{8}$/);
    expect(premium.activeInternalSquads).toEqual([{ uuid: "squad-uuid-xyz", name: "squad" }]); // REMNAWAVE_MAINSERVER_SQUAD_UUID of the test env
    expect(premium.tag).toBe("SITE_TRIAL");
    expect(Math.abs(Date.parse(premium.expireAt as string) - (before + TRIAL_DURATION_MS))).toBeLessThan(5_000);
    expect(premium.hwidDeviceLimit).toBe(DEVICE_LIMIT);
    expect(premium.email).toBe("new.person@example.com");
    expect(premium.trafficLimitBytes).toBe(0);

    expect(bypass.username).toBe(`${publicId}_bp`);
    expect(bypass.activeInternalSquads).toEqual([{ uuid: BYPASS_SQUAD, name: "squad" }]);
    expect(bypass.trafficLimitBytes).toBe(TRAFFIC_TRIAL_BYTES);
    expect(TRAFFIC_TRIAL_BYTES).toBe(524_288_000);
    expect(bypass.trafficLimitStrategy).toBe("NO_RESET");
    expect(bypass.expireAt).toBe("2099-12-31T23:59:59Z");
    expect(bypass.hwidDeviceLimit).toBe(5);
    expect(bypass.email).toBe("new.person@example.com");
    expect(bypass.tag).toBe("SITE_BYPASS");
    expect(bypass.description).toBe(`atlas-site:${u.id}`);
    expect(Number(row.bypass_panel_user_id)).toBe(bypass.id);
    expect(Number(row.panel_user_id)).toBe(premium.id);

    // Relogin / repeated runs: no second trial, no second entity.
    const again = await getOrCreateUser("new.person@example.com");
    expect(again.isNew).toBe(false);
    await applyBypassGrants(u.id);
    await syncUserToPanel(u.id);
    expect(fakePanel.calls.filter((c) => c.fn === "createUser")).toHaveLength(2);
    expect([...linkDb.grants.values()].filter((g) => g.kind === "trial")).toHaveLength(1);
    // The premium sync never wrote the bypass entity.
    expect(fakePanel.updates(bypass.id as number)).toHaveLength(0);
  });

  it("panel down at sign-up → both owed; the worker creates both on the next pass, once", async () => {
    fakePanel.down = true;
    const u = await getOrCreateUser("later@example.com", undefined, "203.0.113.51", "fp-traffic-0002");
    const [prem, bp] = await Promise.all([syncUserToPanel(u.id), applyBypassGrants(u.id)]);
    expect(prem.ok).toBe(false);
    expect(bp.ok).toBe(false);
    fakePanel.down = false;
    linkDb.grants.get(`trial:${u.id}`)!.next_attempt_at = new Date(Date.now() - 1000);
    await syncUserToPanel(u.id); // the pending premium pass
    await runBypassGrantsPass();
    await runBypassGrantsPass();
    const publicId = linkDb.users.get(u.id)!.public_id as string;
    expect(fakePanel.raw(publicId)).toBeDefined();
    expect(fakePanel.raw(`${publicId}_bp`)!.trafficLimitBytes).toBe(TRAFFIC_TRIAL_BYTES);
    // One entity each in the panel (the attempt while it was down created nothing).
    expect([...fakePanel.users.values()].filter((x) => x.username === `${publicId}_bp`)).toHaveLength(1);
    expect([...fakePanel.users.values()].filter((x) => x.username === publicId)).toHaveLength(1);
  });

  it("a user blocked by the trial anti-abuse gets neither days nor the 500 MB", async () => {
    linkDb.blocklist.push({ email_normalized: "abuser@example.com", ip: null, device_fingerprint: null, trial_count: 1 });
    const u = await getOrCreateUser("abuser@example.com", undefined, "203.0.113.52");
    expect(u.trialGranted).toBe(false);
    expect(linkDb.grants.size).toBe(0);
    expect(await applyBypassGrants(u.id)).toMatchObject({ ok: true, applied: 0, created: false });
    expect(fakePanel.calls.filter((c) => c.fn === "createUser")).toHaveLength(0);
  });

  it("a linked person who already has the bot's bypass: the site trial 500 MB is skipped", async () => {
    const tg = "700999";
    const bot = fakePanel.add({ id: 4300, username: tg, telegramId: Number(tg), description: "Bypass via bot (trial)", tag: null, expireAt: BYPASS_EXPIRE_AT, trafficLimitBytes: 500 * 1024 * 1024 });
    seedSiteUser("u301", { telegram_id: tg, telegram_linked: true });
    linkDb.grants.set("trial:u301", { id: "trial:u301", user_id: "u301", kind: "trial", bytes: TRAFFIC_TRIAL_BYTES, state: "pending", attempts: 0, created_at: new Date(), _n: 1 });
    const r = await applyBypassGrants("u301");
    expect(r).toMatchObject({ ok: true, skipped: 1, applied: 0 });
    expect(fakePanel.get(bot.id)!.trafficLimitBytes).toBe(500 * 1024 * 1024);
    expect(linkDb.grants.get("trial:u301")!.state).toBe("skipped");
  });
});

describe("admin grant and unlink", () => {
  it("admin «Начислить ГБ» is idempotent per request id", async () => {
    seedSiteUser("u401");
    await confirmPayment(seedTrafficPayment("u401", "gb15"), "webhook");
    const first = await adminGrantBypass("u401", { gb: "2,5", requestId: "req-abcdef12" }, "admin@example.com");
    const second = await adminGrantBypass("u401", { gb: 2.5, requestId: "req-abcdef12" }, "admin@example.com");
    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(second).toMatchObject({ ok: true, duplicate: true });
    expect(siteBypass("ST00000401")!.trafficLimitBytes).toBe(15 * GB + Math.round(2.5 * GB));
    expect(linkDb.audit.filter((a) => a.action === "admin.bypass_grant")).toHaveLength(1);
    expect((await adminGrantBypass("u401", { gb: 0, requestId: "req-abcdef13" }, null)).ok).toBe(false);
    expect((await adminGrantBypass("u401", { gb: 1, requestId: "x" }, null)).ok).toBe(false);
  });

  it("unlink keeps the site's ST…_bp with the account; a bot bypass goes back to the bot", async () => {
    seedSiteUser("u402", { telegram_id: "700402", telegram_linked: true, bypass_panel_user_id: 5402, bypass_origin: "site", bypass_subscription_url: "https://sub.test/bp" });
    seedSiteUser("u403", { telegram_id: "700403", telegram_linked: true, bypass_panel_user_id: 5403, bypass_origin: "bot" });
    await unlinkTelegramAccount("u402", "site");
    await unlinkTelegramAccount("u403", "site");
    expect(linkDb.users.get("u402")).toMatchObject({ bypass_panel_user_id: 5402, bypass_origin: "site", bypass_subscription_url: "https://sub.test/bp" });
    expect(linkDb.users.get("u403")).toMatchObject({ bypass_panel_user_id: null, bypass_origin: null });
    const u = await getUserById("u402");
    expect(u?.bypassOrigin).toBe("site");
  });
});

void DAY;
void DEFAULT_MAINSERVER_SQUAD_UUID;
