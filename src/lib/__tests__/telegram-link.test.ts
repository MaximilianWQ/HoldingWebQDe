/**
 * Telegram ↔ site linking — «один человек, одна подписка, один ключ»
 * (docs/bot/TZ_BOT_EMAIL_LINK.md):
 *   C  bot first / site first / both → longer wins, other DISABLED /
 *      only bot / only site / conflicts 409 / repeat idempotent / bonus once;
 *   A  email proven only by the code: wrong code, other email, limits, panel down;
 *   B  one-time token: reuse, expiry, legacy token rotation;
 *   D  shared key: pull a later panel term, never shorten; deliberate revoke still pushed;
 *   E  sign-in adoption only with the atlas-email-verified marker;
 *   bypass: never synced as the key; merge sums the remaining traffic.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mail = vi.hoisted(() => {
  process.env.BOT_API_KEY = "test-bot-key-link-0123456789";
  return { sent: [] as Array<{ email: string; code: string }>, fail: false };
});

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
// The panel fake is reached through a hoisted holder: importing link-fake
// here would deadlock (link-fake → fixtures → this very mock).
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
  sendTelegramLinkCodeEmail: async (email: string, code: string) => {
    if (mail.fail) return false;
    mail.sent.push({ email, code });
    return true;
  },
}));
vi.mock("../push", () => ({ sendPushToUser: async () => {} }));
vi.mock("../settings", () => ({ isBotSyncEnabled: async () => true }));

import { linkDb, fakePanel, seedSiteUser, inDays, near, DAY } from "./link-fake";
import { startBotEmailLink, confirmBotEmailLink, LINK_CODE_MAX_ATTEMPTS } from "../bot-email-link";
import { decideMerge, linkTelegramAccount, unlinkTelegramAccount, adoptVerifiedPanelAccount, maskEmail, MergeCandidate } from "../telegram-link";
import { createTelegramLinkToken, hashLinkToken } from "../telegram-link-tokens";
import { syncUserToPanel } from "../subscription-sync";
import { mergeBypassEntities, clearBypassCache, getBypassForUser } from "../bypass";
import { PANEL_MARKERS, hasMarker, withMarkers, PanelUser } from "../remnawave";

panelRef.current = fakePanel;

const GB = 1024 ** 3;
let tgSeq = 700000;
let panelSeq = 5000;
const nextTg = () => String(++tgSeq);

function botPremium(tg: string, days: number, extra: Record<string, unknown> = {}): PanelUser {
  const id = ++panelSeq;
  return fakePanel.add({
    id,
    username: `tg_${tg}_premium`,
    telegramId: Number(tg),
    tag: null,
    email: null,
    description: "Premium via bot (plus)",
    expireAt: inDays(days).toISOString(),
    status: "ACTIVE",
    hwidDeviceLimit: 5,
    shortUuid: `bot${id}`,
    subscriptionUrl: `https://sub.test/bot${id}`,
    ...extra,
  });
}

function botBypass(tg: string, limitGb: number, usedGb: number): PanelUser {
  const id = ++panelSeq;
  return fakePanel.add({
    id,
    username: tg,
    telegramId: Number(tg),
    tag: null,
    email: null,
    description: "Bypass via bot (10gb)",
    expireAt: "2099-12-31T23:59:59.000Z",
    trafficLimitBytes: limitGb * GB,
    userTraffic: { usedTrafficBytes: usedGb * GB, lifetimeUsedTrafficBytes: usedGb * GB, onlineAt: null, firstConnectedAt: null, lastConnectedNodeUuid: null },
    shortUuid: `bp${id}`,
    subscriptionUrl: `https://sub.test/bp${id}`,
  });
}

/** A site account with a live ST entity of `days`. */
function siteWithKey(id: string, days: number, extra: Record<string, unknown> = {}) {
  const pid = ++panelSeq;
  const end = inDays(days);
  const row = seedSiteUser(id, {
    subscription_end: end,
    subscription_plan: "basic",
    panel_user_id: pid,
    remnawave_user_uuid: String(pid),
    subscription_url: `https://sub.test/site${pid}`,
    panel_expire_at: end,
    ...extra,
  });
  const entity = fakePanel.add({
    id: pid,
    username: row.public_id,
    telegramId: null,
    tag: "SITE_BASIC",
    email: row.email,
    description: `atlas-site:${id}`,
    expireAt: end.toISOString(),
    status: "ACTIVE",
    shortUuid: `site${pid}`,
    subscriptionUrl: `https://sub.test/site${pid}`,
  });
  return { row, entity };
}

async function codeFor(tg: string, email: string): Promise<string> {
  const r = await startBotEmailLink({ telegramId: tg, email, ip: "10.1.1.1" });
  expect(r).toMatchObject({ ok: true, sent: true });
  return mail.sent[mail.sent.length - 1].code;
}

const events = (userId: string, kind?: string) => linkDb.events.filter((e) => e.user_id === userId && (!kind || e.kind === kind));
const userByEmail = (email: string) => [...linkDb.users.values()].find((u) => u.email === email)!;

function req(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "x-bot-api-key": process.env.BOT_API_KEY!, "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  linkDb.reset();
  fakePanel.reset();
  clearBypassCache();
  mail.sent = [];
  mail.fail = false;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─── decideMerge (pure) ──────────────────────────────────────────

describe("decideMerge — owner rule 2", () => {
  const now = Date.now();
  const ent = (id: number, days: number, status = "ACTIVE") => ({ id, status, expireAt: new Date(now + days * DAY).toISOString() }) as PanelUser;
  const c = (side: MergeCandidate["side"], days: number, entity: PanelUser | null): MergeCandidate => ({ side, end: now + days * DAY, live: days > 0, entity });

  // Правило изменено владельцем 20.09.2026: дни СКЛАДЫВАЮТСЯ.
  // Раньше здесь ожидалось `now + 20 дней` — то есть пять оплаченных
  // дней сайта просто пропадали.
  it("both live: the longer term wins, the other entity is disabled, remaining days are ADDED", () => {
    const d = decideMerge({ site: c("site", 5, ent(1, 5)), placeholder: null, bot: c("bot", 20, ent(2, 20)) }, now);
    expect(d.kept).toBe("bot");
    expect(d.keptEntity?.id).toBe(2);
    expect(d.disable).toEqual([1]);
    expect(d.newEnd).toBe(now + 25 * DAY);
    expect(d.addedMs).toBe(5 * DAY);
  });
  it("истёкшая сторона добавляет ноль, а не отрицательные дни", () => {
    const d = decideMerge({ site: c("site", -8, ent(1, -8, "EXPIRED")), placeholder: null, bot: c("bot", 20, ent(2, 20)) }, now);
    expect(d.newEnd).toBe(now + 20 * DAY);
    expect(d.addedMs).toBe(0);
  });
  it("tie keeps the site", () => {
    expect(decideMerge({ site: c("site", 9, ent(1, 9)), placeholder: null, bot: c("bot", 9, ent(2, 9)) }, now).kept).toBe("site");
  });
  it("an expired bot entity is not disabled and not a competitor", () => {
    const d = decideMerge({ site: c("site", 9, ent(1, 9)), placeholder: null, bot: c("bot", -3, ent(2, -3, "EXPIRED")) }, now);
    expect(d).toMatchObject({ kept: "only-site", disable: [] });
  });
  it("nothing live: keep the site entity, else take the bot's (one key later)", () => {
    expect(decideMerge({ site: c("site", -1, null), placeholder: null, bot: c("bot", -2, ent(2, -2, "EXPIRED")) }, now)).toMatchObject({ kept: "none", newEnd: null });
    expect(decideMerge({ site: c("site", -1, null), placeholder: null, bot: c("bot", -2, ent(2, -2, "EXPIRED")) }, now).keptEntity?.id).toBe(2);
  });
});

describe("markers", () => {
  it("are appended to the bot's description without rewriting it, and replaced idempotently", () => {
    const d1 = withMarkers("Premium via bot (basic)", { [PANEL_MARKERS.emailVerified]: "T1", [PANEL_MARKERS.site]: "u1" });
    expect(d1).toBe("Premium via bot (basic) | atlas-email-verified:T1 | atlas-site:u1");
    const d2 = withMarkers(d1, { [PANEL_MARKERS.emailVerified]: "T2", [PANEL_MARKERS.unlinked]: null });
    expect(d2).toBe("Premium via bot (basic) | atlas-site:u1 | atlas-email-verified:T2");
    expect(hasMarker(d2, PANEL_MARKERS.emailVerified)).toBe(true);
    expect(maskEmail("alice@mail.ru")).toBe("al***@mail.ru");
  });
});

// ─── C via A: bot first ──────────────────────────────────────────

describe("bot first (email + code)", () => {
  it("only the bot has a subscription: a new site account WITHOUT trial takes the bot key and term; +7 once", async () => {
    const tg = nextTg();
    const prem = botPremium(tg, 20);
    const code = await codeFor(tg, "Bob@Example.com");
    const r = await confirmBotEmailLink({ telegramId: tg, email: "bob@example.com", code, ip: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ kept: "only-bot", created: true, keptPanelUserId: prem.id, disabledPanelUserId: null, bonusDays: 7 });

    const u = userByEmail("bob@example.com");
    expect(u.telegram_id).toBe(tg);
    expect(String(u.panel_user_id)).toBe(String(prem.id));
    expect(u.subscription_plan).toBe("plus");
    expect(u.trial_used_at).toBeTruthy();
    expect(linkDb.blocklist.some((b) => b.email_normalized === "bob@example.com")).toBe(true);
    expect(events(u.id, "trial")).toHaveLength(0);
    expect(events(u.id, "link_merge")).toHaveLength(1);
    expect(events(u.id, "telegram_bonus")).toHaveLength(1);
    expect(near(u.subscription_end, inDays(27))).toBe(true);

    // Panel: same entity, bot description kept + markers, email, telegramId, +7 pushed, tag written, username/limits untouched.
    const p = fakePanel.get(prem.id)!;
    expect(p.username).toBe(`tg_${tg}_premium`);
    expect(p.description).toContain("Premium via bot (plus)");
    expect(hasMarker(p.description, PANEL_MARKERS.emailVerified)).toBe(true);
    expect(p.email).toBe("bob@example.com");
    expect(p.telegramId).toBe(Number(tg));
    expect(p.hwidDeviceLimit).toBe(5);
    expect(p.tag).toBe("SITE_PLUS");
    expect(near(p.expireAt, inDays(27))).toBe(true);
    expect(u.link_panel_state).toBe("ok");
    expect(fakePanel.calls.some((c) => c.fn === "createUser")).toBe(false);
  });

  it("both have subscriptions, the bot's is longer: bot key shared, site key DISABLED, days ADDED", async () => {
    const tg = nextTg();
    const { row, entity: site } = siteWithKey("u-both-bot", 5);
    const prem = botPremium(tg, 20);
    const code = await codeFor(tg, row.email);
    const r = await confirmBotEmailLink({ telegramId: tg, email: row.email, code, ip: null });
    expect(r).toMatchObject({ ok: true, kept: "bot", disabledPanelUserId: site.id, keptPanelUserId: prem.id, created: false });
    const u = linkDb.users.get("u-both-bot")!;
    expect(String(u.panel_user_id)).toBe(String(prem.id));
    // 20 (бот) + 5 (остаток сайта) + 7 бонуса = 32. Прежде было 27:
    // пять оплаченных дней сайта пропадали (правило до 20.09.2026).
    expect(near(u.subscription_end, inDays(32))).toBe(true);
    const s = fakePanel.get(site.id)!;
    expect(s.status).toBe("DISABLED");
    expect(near(s.expireAt, inDays(5))).toBe(true);
  });

  it("both have subscriptions, the site's is longer: site key shared, bot key DISABLED", async () => {
    const tg = nextTg();
    const { row, entity: site } = siteWithKey("u-both-site", 40);
    const prem = botPremium(tg, 10);
    const code = await codeFor(tg, row.email);
    const r = await confirmBotEmailLink({ telegramId: tg, email: row.email, code, ip: null });
    expect(r).toMatchObject({ ok: true, kept: "site", disabledPanelUserId: prem.id, keptPanelUserId: site.id });
    expect(fakePanel.get(prem.id)!.status).toBe("DISABLED");
    // 40 (сайт) + 10 (остаток бота) + 7 бонуса = 57.
    expect(near(linkDb.users.get("u-both-site")!.subscription_end, inDays(57))).toBe(true);
    expect(fakePanel.get(site.id)!.telegramId).toBe(Number(tg));
  });

  it("the email of someone else is never linked without its code", async () => {
    const tg = nextTg();
    seedSiteUser("victim", { email: "victim@example.com" });
    const code = await codeFor(tg, "attacker@example.com");
    const r = await confirmBotEmailLink({ telegramId: tg, email: "victim@example.com", code, ip: null });
    expect(r).toMatchObject({ ok: false, code: "CODE_NOT_FOUND" });
    expect(linkDb.users.get("victim")!.telegram_id).toBeNull();
  });

  it("wrong code: attempts count down, then the code is burnt; nothing is written", async () => {
    const tg = nextTg();
    const code = await codeFor(tg, "carol@example.com");
    const wrong = code === "000000" ? "111111" : "000000";
    const first = await confirmBotEmailLink({ telegramId: tg, email: "carol@example.com", code: wrong, ip: null });
    expect(first).toMatchObject({ ok: false, code: "CODE_INVALID", attemptsLeft: LINK_CODE_MAX_ATTEMPTS - 1 });
    for (let i = 1; i < LINK_CODE_MAX_ATTEMPTS; i++) await confirmBotEmailLink({ telegramId: tg, email: "carol@example.com", code: wrong, ip: null });
    const after = await confirmBotEmailLink({ telegramId: tg, email: "carol@example.com", code, ip: null });
    expect(after.ok).toBe(false);
    expect([...linkDb.users.values()].some((u) => u.email === "carol@example.com")).toBe(false);
  });

  it("expired code", async () => {
    const tg = nextTg();
    const code = await codeFor(tg, "dan@example.com");
    linkDb.codes.get(tg)!.expires_at = new Date(Date.now() - 1000);
    expect(await confirmBotEmailLink({ telegramId: tg, email: "dan@example.com", code, ip: null })).toMatchObject({ ok: false, code: "CODE_EXPIRED" });
  });

  it("start: validation, disposable addresses, per-Telegram limit", async () => {
    const tg = nextTg();
    expect(await startBotEmailLink({ telegramId: "abc", email: "a@b.cd", ip: null })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(await startBotEmailLink({ telegramId: tg, email: "x@mailinator.com", ip: null })).toMatchObject({ ok: false, code: "DISPOSABLE_EMAIL" });
    expect(await startBotEmailLink({ telegramId: tg, email: "telegram_1@tg.atlassecure.uk", ip: null })).toMatchObject({ ok: false, code: "VALIDATION" });
    for (let i = 0; i < 3; i++) expect((await startBotEmailLink({ telegramId: tg, email: `e${i}@example.com`, ip: null })).ok).toBe(true);
    expect(await startBotEmailLink({ telegramId: tg, email: "e9@example.com", ip: null })).toMatchObject({ ok: false, status: 429, code: "RATE_LIMITED" });
  });

  it("panel down at confirm → 503, nothing written, the same code works after", async () => {
    const tg = nextTg();
    botPremium(tg, 15);
    const code = await codeFor(tg, "erin@example.com");
    fakePanel.down = true;
    expect(await confirmBotEmailLink({ telegramId: tg, email: "erin@example.com", code, ip: null })).toMatchObject({ ok: false, status: 503, code: "PANEL_UNAVAILABLE" });
    expect([...linkDb.users.values()].some((u) => u.email === "erin@example.com")).toBe(false);
    fakePanel.down = false;
    expect(await confirmBotEmailLink({ telegramId: tg, email: "erin@example.com", code, ip: null })).toMatchObject({ ok: true, kept: "only-bot" });
  });

  it("the bot's email-less placeholder account is renamed, not duplicated", async () => {
    const tg = nextTg();
    seedSiteUser("ph1", { email: `telegram_${tg}@tg.atlassecure.uk`, telegram_id: tg, telegram_linked: true, subscription_end: inDays(2) });
    const code = await codeFor(tg, "fay@example.com");
    const r = await confirmBotEmailLink({ telegramId: tg, email: "fay@example.com", code, ip: null });
    expect(r).toMatchObject({ ok: true, created: false });
    expect(linkDb.users.get("ph1")!.email).toBe("fay@example.com");
    expect([...linkDb.users.values()].filter((u) => u.telegram_id === tg)).toHaveLength(1);
  });
});

// ─── C: conflicts, idempotency, bonus ────────────────────────────

describe("conflicts and repeats", () => {
  it("409 TELEGRAM_LINKED_OTHER: this Telegram is already linked to another real account", async () => {
    const tg = nextTg();
    seedSiteUser("owner", { telegram_id: tg, telegram_linked: true });
    seedSiteUser("other");
    expect(await startBotEmailLink({ telegramId: tg, email: "other@example.com", ip: null })).toMatchObject({ ok: false, status: 409, code: "TELEGRAM_LINKED_OTHER" });
    expect(await linkTelegramAccount({ telegramId: tg, userId: "other", via: "site_token" })).toMatchObject({ ok: false, status: 409, code: "TELEGRAM_LINKED_OTHER" });
  });

  it("409 EMAIL_LINKED_OTHER: the account is linked to another Telegram", async () => {
    const tg = nextTg();
    seedSiteUser("taken", { telegram_id: "123456789", telegram_linked: true });
    expect(await linkTelegramAccount({ telegramId: tg, userId: "taken", via: "site_token" })).toMatchObject({ ok: false, status: 409, code: "EMAIL_LINKED_OTHER" });
  });

  it("the same pair again is an idempotent success: no new term event, no bonus, no more disables", async () => {
    const tg = nextTg();
    const { entity: site } = siteWithKey("u-rep", 5);
    botPremium(tg, 20);
    const a = await linkTelegramAccount({ telegramId: tg, userId: "u-rep", via: "site_token" });
    expect(a).toMatchObject({ ok: true, kept: "bot", bonusDays: 7 });
    const merges = events("u-rep", "link_merge").length;
    const disables = fakePanel.calls.filter((c) => c.fn === "updateUser" && (c.arg as { status?: string }).status === "DISABLED").length;
    const b = await linkTelegramAccount({ telegramId: tg, userId: "u-rep", via: "site_token" });
    expect(b).toMatchObject({ ok: true, alreadyLinked: true, kept: "bot", bonusDays: 0 });
    expect(events("u-rep", "link_merge")).toHaveLength(merges);
    expect(fakePanel.calls.filter((c) => c.fn === "updateUser" && (c.arg as { status?: string }).status === "DISABLED")).toHaveLength(disables);
    expect(fakePanel.get(site.id)!.status).toBe("DISABLED");
  });

  it("unlink keeps the key with the account; relinking never pays the bonus twice", async () => {
    const tg = nextTg();
    const prem = botPremium(tg, 20);
    seedSiteUser("u-un");
    expect(await linkTelegramAccount({ telegramId: tg, userId: "u-un", via: "site_token" })).toMatchObject({ ok: true, bonusDays: 7 });
    const un = await unlinkTelegramAccount("u-un", "bot");
    expect(un.ok).toBe(true);
    const u = linkDb.users.get("u-un")!;
    expect(u.telegram_id).toBeNull();
    expect(String(u.panel_user_id)).toBe(String(prem.id)); // key stays
    await syncUserToPanel("u-un");
    const p = fakePanel.get(prem.id)!;
    expect(p.telegramId).toBeNull();
    expect(hasMarker(p.description, PANEL_MARKERS.unlinked)).toBe(true);
    expect(p.status).toBe("ACTIVE");

    const again = await linkTelegramAccount({ telegramId: tg, userId: "u-un", via: "site_token" });
    expect(again).toMatchObject({ ok: true, bonusDays: 0 });
    expect(events("u-un", "telegram_bonus")).toHaveLength(1);
    expect(hasMarker(fakePanel.get(prem.id)!.description, PANEL_MARKERS.unlinked)).toBe(false);
  });

  it("after an unlink the old key is NOT taken by another account linking the same Telegram", async () => {
    const tg = nextTg();
    const prem = botPremium(tg, 20);
    seedSiteUser("first");
    await linkTelegramAccount({ telegramId: tg, userId: "first", via: "site_token" });
    await unlinkTelegramAccount("first", "site");
    seedSiteUser("second");
    const r = await linkTelegramAccount({ telegramId: tg, userId: "second", via: "site_token" });
    expect(r).toMatchObject({ ok: true, kept: "none", keptPanelUserId: null });
    expect(String(linkDb.users.get("first")!.panel_user_id)).toBe(String(prem.id));
  });
});

describe("relink (migration of people linked before 13.09.2026)", () => {
  it("an old link with two live keys is merged: longer wins, days added, the other DISABLED; unknown Telegram → 404", async () => {
    const { POST } = await import("@/app/api/bot/relink/route");
    const tg = nextTg();
    const { entity: site } = siteWithKey("u-old", 30, { telegram_id: tg, telegram_linked: true, telegram_bonus_granted_at: new Date() });
    linkDb.claims.set(tg, { telegram_id: tg, user_id: "u-old" });
    const prem = botPremium(tg, 60);
    const r = await POST(req("/api/bot/relink", "POST", { telegramId: tg, premiumPanelUserId: prem.id }));
    expect(r.status).toBe(200);
    expect((await r.json()).data).toMatchObject({ kept: "bot", disabledPanelUserId: site.id, bonusDays: 0, alreadyLinked: true });
    expect(fakePanel.get(site.id)!.status).toBe("DISABLED");
    // 60 (бот) + 30 (остаток сайта) = 90; бонуса нет, он уже был выдан.
    expect(near(linkDb.users.get("u-old")!.subscription_end, inDays(90))).toBe(true);
    const again = await POST(req("/api/bot/relink", "POST", { telegramId: tg }));
    expect((await again.json()).data).toMatchObject({ kept: "bot", alreadyLinked: true });
    const none = await POST(req("/api/bot/relink", "POST", { telegramId: nextTg() }));
    expect(none.status).toBe(404);
  });
});

// ─── B: one-time tokens through the route ────────────────────────

describe("site first: one-time token", () => {
  it("links, is single-use, a repeat by the same Telegram is idempotent, preview masks the email", async () => {
    const { POST, GET } = await import("@/app/api/bot/link/route");
    const tg = nextTg();
    siteWithKey("u-tok", 30);
    const t = await createTelegramLinkToken("u-tok");

    const preview = await GET(req(`/api/bot/link?token=${t.startParam}`, "GET"));
    expect((await preview.json()).data).toMatchObject({ valid: true, maskedEmail: "u-***@example.com" });

    const r1 = await POST(req("/api/bot/link", "POST", { token: t.startParam, telegramId: tg }));
    expect(r1.status).toBe(200);
    expect((await r1.json()).data).toMatchObject({ linked: true, kept: "only-site", bonusDays: 7 });
    expect(linkDb.tokens.get(hashLinkToken(t.token))!.used_at).toBeTruthy();

    const r2 = await POST(req("/api/bot/link", "POST", { token: t.token, telegramId: tg }));
    expect((await r2.json()).data).toMatchObject({ alreadyLinked: true, bonusDays: 0 });

    const r3 = await POST(req("/api/bot/link", "POST", { token: t.token, telegramId: nextTg() }));
    expect(r3.status).toBe(410);
    expect((await r3.json()).code).toBe("TOKEN_USED");
  });

  it("an expired token → 410 TOKEN_EXPIRED; garbage → 404", async () => {
    const { POST } = await import("@/app/api/bot/link/route");
    seedSiteUser("u-exp");
    const t = await createTelegramLinkToken("u-exp");
    linkDb.tokens.get(hashLinkToken(t.token))!.expires_at = new Date(Date.now() - 1);
    const r = await POST(req("/api/bot/link", "POST", { token: t.token, telegramId: nextTg() }));
    expect(r.status).toBe(410);
    expect((await r.json()).code).toBe("TOKEN_EXPIRED");
    const g = await POST(req("/api/bot/link", "POST", { token: "nope", telegramId: nextTg() }));
    expect(g.status).toBe(404);
  });

  // Поведение изменено аудитом безопасности 19.09.2026: постоянный
  // токен привязки больше не принимается. Он выдавался при создании
  // аккаунта, жил вечно, хранился открытым текстом и уезжал в браузер
  // с каждой загрузкой кабинета — то есть был вечным ключом от
  // аккаунта, который легко утекал. Остался только одноразовый.
  it("постоянный токен привязки больше не принимается", async () => {
    const { POST } = await import("@/app/api/bot/link/route");
    seedSiteUser("u-leg", { telegram_link_token: "0123456789abcdef" });
    const r = await POST(req("/api/bot/link", "POST", { token: "0123456789abcdef", telegramId: nextTg() }));
    expect(r.status).toBe(404);
    // Привязка не состоялась: аккаунт остался без Telegram.
    expect(linkDb.users.get("u-leg")!.telegram_id ?? null).toBe(null);
  });
});

// ─── D: shared key is never shortened ────────────────────────────

describe("sync of a shared key", () => {
  it("panel extended elsewhere (later than ours, changed since we last saw it) → pulled into the DB, not shortened", async () => {
    const tg = nextTg();
    const prem = botPremium(tg, 40);
    seedSiteUser("u-pull", {
      telegram_id: tg, telegram_linked: true, subscription_end: inDays(10), subscription_plan: "plus",
      panel_user_id: prem.id, remnawave_user_uuid: String(prem.id), subscription_url: prem.subscriptionUrl,
      panel_expire_at: inDays(10), panel_sync_state: "pending",
    });
    const r = await syncUserToPanel("u-pull");
    expect(r.ok).toBe(true);
    const u = linkDb.users.get("u-pull")!;
    expect(near(u.subscription_end, inDays(40))).toBe(true);
    expect(events("u-pull", "panel_pull")).toHaveLength(1);
    for (const p of fakePanel.updates(prem.id)) if (p.expireAt) expect(near(p.expireAt, inDays(40))).toBe(true);
    // idempotent
    await syncUserToPanel("u-pull");
    expect(events("u-pull", "panel_pull")).toHaveLength(1);
  });

  it("a deliberate shortening (panel unchanged since our last push) is still pushed: revoke → DISABLED", async () => {
    const tg = nextTg();
    const prem = botPremium(tg, 10);
    seedSiteUser("u-rev", {
      telegram_id: tg, telegram_linked: true, subscription_end: new Date(Date.now() - 1000),
      panel_user_id: prem.id, remnawave_user_uuid: String(prem.id), panel_expire_at: new Date(prem.expireAt), panel_sync_state: "pending",
    });
    const r = await syncUserToPanel("u-rev");
    expect(r.action).toBe("disabled");
    expect(events("u-rev", "panel_pull")).toHaveLength(0);
  });
});

// ─── E: sign-in adoption ─────────────────────────────────────────

describe("sign-in adoption", () => {
  it("adopts only a panel user whose email carries atlas-email-verified; no trial", async () => {
    const tg = nextTg();
    const prem = botPremium(tg, 12, { email: "gus@example.com", description: "Premium via bot (basic) | atlas-email-verified:2026-09-13T00:00:00.000Z" });
    const u = await adoptVerifiedPanelAccount("gus@example.com", { ip: "10.0.0.9" });
    expect(u).toMatchObject({ isNew: true, trialGranted: false });
    const row = userByEmail("gus@example.com");
    expect(String(row.panel_user_id)).toBe(String(prem.id));
    expect(near(row.subscription_end, inDays(12))).toBe(true);
    expect(row.telegram_id).toBe(tg);
    expect(events(row.id, "trial")).toHaveLength(0);
  });

  it("without the marker → null (ordinary registration)", async () => {
    botPremium(nextTg(), 12, { email: "hal@example.com" });
    expect(await adoptVerifiedPanelAccount("hal@example.com")).toBeNull();
    expect([...linkDb.users.values()].some((u) => u.email === "hal@example.com")).toBe(false);
  });
});

// ─── Bypass ──────────────────────────────────────────────────────

describe("bypass (обход)", () => {
  it("merge: the other's REMAINING traffic is added to the bot's entity, the other is DISABLED; repeat is a no-op", async () => {
    const tg = nextTg();
    const keep = botBypass(tg, 10, 2);
    const other = fakePanel.add({ id: ++panelSeq, username: "ST00000099_bp", description: "atlas-site bypass", trafficLimitBytes: 5 * GB, userTraffic: { usedTrafficBytes: 1 * GB } });
    const r = await mergeBypassEntities(keep, other);
    expect(r).toMatchObject({ ok: true, addedBytes: 4 * GB, disabledId: other.id });
    expect(fakePanel.get(keep.id)!.trafficLimitBytes).toBe(14 * GB);
    expect(fakePanel.get(other.id)!.status).toBe("DISABLED");
    await mergeBypassEntities(keep, fakePanel.get(other.id)!);
    expect(fakePanel.get(keep.id)!.trafficLimitBytes).toBe(14 * GB);
    expect(fakePanel.get(keep.id)!.expireAt).toBe("2099-12-31T23:59:59.000Z");
  });

  it("link records the bot's bypass; the sync never touches it; the dashboard reads it", async () => {
    const tg = nextTg();
    botPremium(tg, 20);
    const bp = botBypass(tg, 10, 3);
    seedSiteUser("u-bp");
    const r = await linkTelegramAccount({ telegramId: tg, userId: "u-bp", via: "site_token" });
    expect(r).toMatchObject({ ok: true, bypassPanelUserId: bp.id });
    expect(fakePanel.updates(bp.id)).toHaveLength(0);
    const snap = await getBypassForUser({ id: "u-bp", telegramId: tg, bypassPanelUserId: bp.id });
    expect(snap).toMatchObject({ remainingBytes: 7 * GB, limitBytes: 10 * GB, unlimited: false });
  });

  it("a bypass id stored as the key is refused by the sync", async () => {
    const tg = nextTg();
    const bp = botBypass(tg, 10, 0);
    seedSiteUser("u-bad", { panel_user_id: bp.id, remnawave_user_uuid: String(bp.id), subscription_end: inDays(5), panel_sync_state: "pending" });
    const r = await syncUserToPanel("u-bad");
    expect(r).toMatchObject({ ok: false, reason: "bypass_as_premium" });
    expect(fakePanel.updates(bp.id)).toHaveLength(0);
  });
});
