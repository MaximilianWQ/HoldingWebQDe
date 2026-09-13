/**
 * Рассылки и массовые начисления: проверка ввода, оценка времени,
 * правило тарифа при подарке, классификация ошибок Resend, начисление ГБ
 * через журнал bypass_grants — и сценарии очереди на репозитории в памяти.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", async () => {
  const m = await import("./fake-db");
  return { pool: m.fakeDb.pool, dbReady: Promise.resolve(), waitForDb: async () => {} };
});
vi.mock("../bypass-grants", async () => {
  const { fakeDb } = await import("./fake-db");
  const getBypassGrant = vi.fn(async (id: string) => {
    const g = fakeDb.grants.get(id);
    return g ? { id: g.id, state: g.state, note: g.note ?? null, lastError: g.last_error ?? null, bytes: Number(g.bytes) } : null;
  });
  return { applyBypassGrants: vi.fn(), getBypassGrant };
});

import { fakeDb } from "./fake-db";
import { MemoryCampaignRepo } from "./campaigns-memory-repo";
import { defineCampaignScenarios, type Harness } from "./campaign-scenarios";
import * as engine from "../campaigns";
import { estimateSend, parseCampaignInput, planAfterGrant, deliveryStatusFor, dailyLimit } from "../campaigns";
import { classifyResendError } from "../campaign-mailer";
import { bypassTrafficGranter } from "../campaigns-pg";
import * as bg from "../bypass-grants";

const DAY = 86_400_000;
const GB = 1024 ** 3;

const base = {
  kind: "service",
  channel: "email",
  subject: "Тема",
  bodyMd: "Текст",
  audience: { type: "filter", filter: "all" },
};

describe("проверка ввода", () => {
  it("подарок — только в служебной рассылке", () => {
    const r = parseCampaignInput({ ...base, kind: "marketing", grant: { plan: "plus", days: 30 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/сервисное/);
  });

  it("дни 1–400 с тарифом, ГБ 1–5000; пустой подарок — без подарка", () => {
    for (const bad of [{ plan: "plus", days: 0 }, { plan: "plus", days: 401 }, { plan: "plus", days: 2.5 }, { days: 5 }, { plan: "gold", days: 5 }, { trafficGb: 0.5 }, { trafficGb: 5001 }]) {
      const r = parseCampaignInput({ ...base, grant: bad });
      expect(r.ok, JSON.stringify(bad)).toBe(false);
    }
    const ok = parseCampaignInput({ ...base, grant: { plan: "basic", days: 30, trafficGb: 10 } });
    expect(ok).toMatchObject({ ok: true, input: { grant: { plan: "basic", days: 30, trafficGb: 10 } } });
    expect(parseCampaignInput({ ...base, grant: { trafficGb: 7 } })).toMatchObject({ ok: true, input: { grant: { plan: null, days: null, trafficGb: 7 } } });
    expect(parseCampaignInput({ ...base, grant: { days: "", trafficGb: "" } })).toMatchObject({ ok: true, input: { grant: null } });
  });

  it("неизвестные подстановки, пустые поля и чужие фильтры — ошибки по-русски", () => {
    for (const bad of [
      { ...base, bodyMd: "Привет, {{name}}" },
      { ...base, subject: "" },
      { ...base, bodyMd: "   " },
      { ...base, audience: { type: "filter", filter: "vip" } },
      { ...base, audience: { type: "list", text: "  \n " } },
      { ...base, channel: "sms" },
    ]) {
      const r = parseCampaignInput(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/[а-яё]/i);
    }
  });

  it("список: дубли и регистр адресов схлопываются, ID и ST-номера остаются как есть", () => {
    const r = parseCampaignInput({ ...base, audience: { type: "list", text: "A@x.ru, a@x.ru; ST00000012\n<b@y.ru>\n\nu-1" } });
    expect(r).toMatchObject({ ok: true, input: { audience: { type: "list", entries: ["a@x.ru", "ST00000012", "b@y.ru", "u-1"] } } });
  });
});

describe("правила", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  it("подарок не понижает действующий тариф", () => {
    const live = new Date(now.getTime() + DAY);
    const dead = new Date(now.getTime() - DAY);
    expect(planAfterGrant("plus", live, "basic", now)).toBeNull();
    expect(planAfterGrant("plus", dead, "basic", now)).toBe("basic");
    expect(planAfterGrant("basic", live, "plus", now)).toBe("plus");
    expect(planAfterGrant("basic", live, "trial", now)).toBeNull();
    expect(planAfterGrant("trial", live, "basic", now)).toBe("basic");
  });

  it("статус получателя", () => {
    const u = (email: string, c: unknown = null, o: unknown = null) => ({ email, marketingConsentAt: c, marketingOptOutAt: o });
    expect(deliveryStatusFor("service", "email", u("a@x.ru", null, new Date()))).toBe("queued");
    expect(deliveryStatusFor("marketing", "email", u("a@x.ru"))).toBe("skipped_no_consent");
    expect(deliveryStatusFor("marketing", "email", u("a@x.ru", new Date(), new Date()))).toBe("skipped_optout");
    expect(deliveryStatusFor("service", "email", u("telegram_1@tg.atlas"))).toBe("skipped_placeholder");
    expect(deliveryStatusFor("service", "site", u("telegram_1@tg.atlas"))).toBe("queued");
    expect(deliveryStatusFor("service", "both", u("not-an-email"))).toBe("skipped_invalid");
  });

  it("RESEND_DAILY_LIMIT: по умолчанию 80 (20 из 100 бесплатных — кодам входа)", () => {
    expect(dailyLimit(undefined)).toBe(80);
    expect(dailyLimit("")).toBe(80);
    expect(dailyLimit("abc")).toBe(80);
    expect(dailyLimit("0")).toBe(80);
    expect(dailyLimit("3000")).toBe(3000);
  });

  it("ошибки Resend → что делать очереди", () => {
    expect(classifyResendError({ name: "rate_limit_exceeded", statusCode: 429 })).toBe("rate_limit");
    expect(classifyResendError({ name: "daily_quota_exceeded", statusCode: 429 })).toBe("quota");
    expect(classifyResendError({ name: "validation_error", statusCode: 422 })).toBe("invalid");
    expect(classifyResendError({ name: "invalid_api_key", statusCode: 403 })).toBe("fatal");
    expect(classifyResendError({ name: "internal_server_error", statusCode: 500 })).toBe("transient");
    expect(classifyResendError({ name: null, statusCode: 503 })).toBe("transient");
  });
});

describe("оценка времени", () => {
  it("всё в пределах свободной квоты — сразу", () => {
    expect(estimateSend({ emails: 40, ahead: 0, limit: 100, sentLast24h: 10 })).toMatchObject({ soon: 40, later: 0, days: 0 });
  });
  it("больше квоты — остаток по суткам, с учётом очереди других кампаний", () => {
    const e = estimateSend({ emails: 1000, ahead: 50, limit: 100, sentLast24h: 20 });
    expect(e).toMatchObject({ soon: 30, later: 970, days: 10 });
    expect(e.text).toMatch(/примерно за 10 суток/);
    expect(estimateSend({ emails: 5, ahead: 0, limit: 100, sentLast24h: 100 }).text).toMatch(/Квота на сутки занята/);
    expect(estimateSend({ emails: 150, ahead: 0, limit: 100, sentLast24h: 0 }).text).toMatch(/1 сутки/);
  });
});

describe("ГБ подарка через журнал bypass_grants", () => {
  beforeEach(() => {
    fakeDb.reset();
    fakeDb.users.set("u1", { id: "u1", email: "u1@example.com", subscription_end: new Date(), subscription_plan: "trial", referral_code: "R1" });
    vi.mocked(bg.applyBypassGrants).mockReset();
  });

  it("одна строка на (кампания, человек); применяет bypass-grants — там же создаётся ST…_bp", async () => {
    vi.mocked(bg.applyBypassGrants).mockImplementation(async (userId: string) => {
      // Как doApply: сущности не было — создаём сайтовую и засеваем начислением.
      for (const g of fakeDb.grants.values()) if (g.user_id === userId && g.state === "pending") g.state = "applied";
      fakeDb.users.get(userId)!.bypass_panel_user_id = 9001;
      return { ok: true, applied: 1, skipped: 0, conflicts: 0, owed: 0, created: true, panelUserId: 9001 };
    });
    const r1 = await bypassTrafficGranter.credit("c1", "u1", 10 * GB, "подарок");
    const r2 = await bypassTrafficGranter.credit("c1", "u1", 10 * GB, "подарок");
    expect(r1).toEqual({ state: "done" });
    expect(r2).toEqual({ state: "done" });
    expect([...fakeDb.grants.keys()]).toEqual(["campaign:c1:user:u1:traffic"]);
    expect(fakeDb.grants.get("campaign:c1:user:u1:traffic")).toMatchObject({ kind: "admin", bytes: 10 * GB, actor: "campaign" });
    expect(bg.applyBypassGrants).toHaveBeenCalledTimes(1);
    expect(fakeDb.users.get("u1")!.bypass_panel_user_id).toBe(9001);
  });

  it("панель не ответила — начисление остаётся должным", async () => {
    vi.mocked(bg.applyBypassGrants).mockImplementation(async (userId: string) => {
      for (const g of fakeDb.grants.values()) if (g.user_id === userId) g.last_error = "timeout";
      return { ok: false, applied: 0, skipped: 0, conflicts: 0, owed: 1, created: false, panelUserId: null, error: "timeout" };
    });
    expect(await bypassTrafficGranter.credit("c1", "u1", GB, "подарок")).toEqual({ state: "owed", error: "timeout" });
    expect(fakeDb.grants.get("campaign:c1:user:u1:traffic")!.state).toBe("pending");
  });
});

describe("очередь рассылок (память)", () => {
  const repo = new MemoryCampaignRepo();
  let n = 0;
  const h: Harness = {
    engine,
    repo,
    async reset() {
      fakeDb.reset();
      repo.reset();
      n = 0;
    },
    async seedUser(u) {
      fakeDb.users.set(u.id, {
        id: u.id,
        email: u.email,
        created_at: new Date(Date.now() - ++n * 1000),
        subscription_end: new Date(Date.now() + u.endInDays * DAY),
        subscription_plan: u.plan ?? "trial",
        referral_code: `R${u.id}`,
        public_id: u.publicId ?? null,
        marketing_consent_at: u.consent ? new Date() : null,
        marketing_opt_out_at: u.optOut ? new Date() : null,
        panel_sync_state: "ok",
      });
    },
    async user(id) {
      const u = fakeDb.users.get(id)!;
      return { end: new Date(u.subscription_end), plan: u.subscription_plan ?? null, token: u.unsubscribe_token ?? null };
    },
    async events() {
      return fakeDb.events.map((e) => ({ user_id: e.user_id, kind: e.kind, source_id: e.source_id }));
    },
    async notifications() {
      return [...repo.notifications.values()].map((x) => ({ id: x.id, target: x.userId }));
    },
    async delivery(cid, uid) {
      return repo.deliveries.get(`${cid}|${uid}`) ?? null;
    },
    async setOptOut(id) {
      Object.assign(fakeDb.users.get(id)!, { marketing_opt_out_at: new Date(), marketing_consent_at: null });
    },
    async clearGranted(cid, uid) {
      repo.deliveries.get(`${cid}|${uid}`)!.granted_at = null;
    },
  };
  defineCampaignScenarios(() => h);
});
