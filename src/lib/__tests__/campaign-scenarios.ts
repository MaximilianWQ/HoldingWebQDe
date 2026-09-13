/**
 * Сценарии очереди рассылок — одни и те же для репозитория в памяти
 * (campaigns.test.ts) и для настоящего Postgres (campaigns-pg.test.ts).
 * Движок приходит через harness.engine, чтобы файл с Postgres не
 * загружал db.ts, когда базы нет.
 */

import { it, expect, beforeEach } from "vitest";
import type * as EngineModule from "../campaigns";
import type { CampaignInput, CampaignRepo, EngineDeps, Mailer, MailerResult, OutgoingEmail, TrafficCredit, TrafficGranter } from "../campaigns";

type Engine = typeof EngineModule;
const DAY = 86_400_000;
const GB = 1024 ** 3;

export interface SeedUser {
  id: string;
  email: string;
  endInDays: number;
  plan?: string;
  consent?: boolean;
  optOut?: boolean;
  publicId?: string;
}

export interface Harness {
  engine: Engine;
  repo: CampaignRepo;
  reset(): Promise<void>;
  seedUser(u: SeedUser): Promise<void>;
  user(id: string): Promise<{ end: Date; plan: string | null; token: string | null }>;
  events(): Promise<Array<{ user_id: string; kind: string; source_id: string }>>;
  notifications(): Promise<Array<{ id: string; target: string }>>;
  delivery(cid: string, uid: string): Promise<{ status: string; attempts: number; batch_id: string | null; granted_at: Date | null; notified_at: Date | null; next_attempt_at: Date | null } | null>;
  setOptOut(id: string): Promise<void>;
  clearGranted(cid: string, uid: string): Promise<void>;
}

type Step = MailerResult | "crash";

/** Resend понарошку: запоминает вызовы; одинаковый ключ — одна доставка (как у Resend). */
export class FakeMailer implements Mailer {
  calls: Array<{ key: string; to: string[]; emails: OutgoingEmail[] }> = [];
  accepted = new Map<string, string[]>();
  script: Step[] = [];
  async sendBatch(emails: OutgoingEmail[], key: string): Promise<MailerResult> {
    this.calls.push({ key, to: emails.map((e) => e.to), emails });
    const next = this.script.shift();
    if (next === "crash") {
      // Resend принял пачку, а процесс умер до записи в базу.
      this.accepted.set(key, emails.map((e) => e.to));
      throw new Error("process died");
    }
    if (next && !next.ok) return next;
    if (!this.accepted.has(key)) this.accepted.set(key, emails.map((e) => e.to));
    return next ?? { ok: true, ids: emails.map((_, i) => `re_${this.calls.length}_${i}`) };
  }
  /** Сколько писем реально дошло до каждого адреса. */
  delivered(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const list of this.accepted.values()) for (const to of list) out[to] = (out[to] ?? 0) + 1;
    return out;
  }
}

/** Начисление ГБ понарошку: идемпотентно по ключу, «создаёт» сущность обхода, если её не было. */
export class FakeTraffic implements TrafficGranter {
  credited = new Map<string, number>();
  calls = 0;
  hasBypass = new Set<string>();
  created = new Set<string>();
  owed = new Set<string>();
  async credit(campaignId: string, userId: string, bytes: number): Promise<TrafficCredit> {
    this.calls += 1;
    if (this.owed.has(userId)) return { state: "owed", error: "панель не отвечает" };
    const id = `campaign:${campaignId}:user:${userId}:traffic`;
    if (!this.credited.has(id)) {
      this.credited.set(id, bytes);
      if (!this.hasBypass.has(userId)) {
        this.created.add(userId);
        this.hasBypass.add(userId);
      }
    }
    return { state: "done" };
  }
}

export function defineCampaignScenarios(getH: () => Harness) {
  let h: Harness;
  let t = 0;
  let mailer: FakeMailer;
  let traffic: FakeTraffic;
  const now = () => new Date(t);
  const deps = (limit = 100): EngineDeps => ({ repo: h.repo, mailer, traffic, limit, now, sleep: async () => {} });
  const pass = (limit = 100) => h.engine.runCampaignPass(deps(limit));

  async function launch(over: Partial<Record<keyof CampaignInput, unknown>> = {}, limit = 100): Promise<string> {
    const p = h.engine.parseCampaignInput({
      kind: "service",
      channel: "email",
      subject: "Подарок для {{email}}",
      bodyMd: "Осталось {{days_left}} дн. на {{plan}}. [Кабинет]({{dashboard_url}})",
      audience: { type: "filter", filter: "all" },
      grant: null,
      ...over,
    });
    if (!p.ok) throw new Error(p.error);
    const c = await h.repo.create(p.input, "admin@example.com");
    const r = await h.engine.startCampaign(h.repo, c.id, limit);
    if (!r.ok) throw new Error(r.error);
    return c.id;
  }

  const counts = async (id: string) => h.repo.counts((await h.repo.get(id))!);

  beforeEach(async () => {
    h = getH();
    await h.reset();
    t = Date.now();
    mailer = new FakeMailer();
    traffic = new FakeTraffic();
    await h.seedUser({ id: "u1", email: "anna@example.com", endInDays: 10, plan: "plus" });
    await h.seedUser({ id: "u2", email: "boris@example.com", endInDays: -30, plan: "basic" });
    await h.seedUser({ id: "u3", email: "vera@example.com", endInDays: 2, plan: "trial", consent: true });
    await h.seedUser({ id: "u4", email: "telegram_777@tg.atlas", endInDays: -90, plan: "trial" });
    await h.seedUser({ id: "u5", email: "gleb@example.com", endInDays: 5, plan: "basic", consent: true, optOut: true });
  });

  it("запуск фиксирует получателей: служебная — всем с адресом, рекламная — только согласившимся", async () => {
    const s = await launch();
    const got = async (id: string) => (await h.delivery(id, "u1"))!.status;
    expect(await got(s)).toBe("queued");
    expect((await h.delivery(s, "u4"))!.status).toBe("skipped_placeholder");
    expect((await h.delivery(s, "u5"))!.status).toBe("queued"); // служебное — и отписавшемуся

    const m = await launch({ kind: "marketing" });
    expect((await h.delivery(m, "u1"))!.status).toBe("skipped_no_consent");
    expect((await h.delivery(m, "u3"))!.status).toBe("queued");
    expect((await h.delivery(m, "u5"))!.status).toBe("skipped_optout");
    expect((await h.delivery(m, "u4"))!.status).toBe("skipped_no_consent");
  });

  it("одно письмо на человека: дубли в списке, повторный запуск и второй проход ничего не добавляют", async () => {
    const id = await launch({ audience: { type: "list", text: "anna@example.com\nANNA@example.com, u1\nnobody@example.com" } });
    expect((await counts(id)).total).toBe(1);
    const again = await h.engine.startCampaign(h.repo, id, 100);
    expect(again).toMatchObject({ ok: false, status: 409 });
    await pass();
    await pass();
    expect(mailer.delivered()).toEqual({ "anna@example.com": 1 });
    expect((await h.repo.get(id))!.status).toBe("done");
  });

  it("подарок всем: дни и ГБ каждому, заглушки бота — без письма, но с начислением и уведомлением", async () => {
    traffic.hasBypass.add("u1");
    const id = await launch({ grant: { plan: "basic", days: 30, trafficGb: 10 } });
    const before = await h.user("u1");
    const s = await pass();
    expect(s.granted).toBe(5);

    const ev = (await h.events()).filter((e) => e.kind === "admin_grant");
    expect(ev.map((e) => e.source_id).sort()).toEqual(["u1", "u2", "u3", "u4", "u5"].map((u) => `campaign:${id}:user:${u}`));
    // Plus при подарке Basic не понижается; истёкшему — Basic с сегодняшнего дня.
    const u1 = await h.user("u1");
    expect(u1.plan).toBe("plus");
    expect(u1.end.getTime() - before.end.getTime()).toBe(30 * DAY);
    const u2 = await h.user("u2");
    expect(u2.plan).toBe("basic");
    expect(Math.abs(u2.end.getTime() - (Date.now() + 30 * DAY))).toBeLessThan(60_000);
    expect((await h.user("u3")).plan).toBe("basic");

    // ГБ: каждому по 10, сущность обхода создана тем, у кого её не было.
    expect(traffic.credited.size).toBe(5);
    expect([...traffic.credited.values()].every((b) => b === 10 * GB)).toBe(true);
    expect([...traffic.created].sort()).toEqual(["u2", "u3", "u4", "u5"]);

    expect(Object.keys(mailer.delivered()).sort()).toEqual(["anna@example.com", "boris@example.com", "gleb@example.com", "vera@example.com"]);
    expect((await h.notifications()).map((n) => n.id)).toEqual([`cmp:${id}:u4`]);
    // {{days_left}} в письме — уже после подарка.
    const letter = mailer.calls[0].emails.find((e) => e.to === "anna@example.com")!;
    expect(letter.text).toContain(`Осталось ${Math.ceil((u1.end.getTime() - t) / DAY)} дн. на Plus`);
    expect(letter.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    const k = await counts(id);
    expect(k).toMatchObject({ total: 5, sent: 4, skipped_placeholder: 1, granted: 5, grant_pending: 0, notified: 1, queued: 0 });
    expect((await h.repo.get(id))!.status).toBe("done");
  });

  it("повтор не начисляет дважды — ни проходом, ни после сбоя между начислением и отметкой", async () => {
    const id = await launch({ grant: { plan: "plus", days: 7, trafficGb: 5 } });
    await pass();
    const end2 = (await h.user("u2")).end.getTime();
    const events = (await h.events()).length;
    await pass();
    await h.clearGranted(id, "u2"); // процесс умер после журнала, до отметки granted_at
    await pass();
    expect((await h.events()).length).toBe(events);
    expect((await h.user("u2")).end.getTime()).toBe(end2);
    expect(traffic.credited.size).toBe(5);
    expect(mailer.delivered()["boris@example.com"]).toBe(1);
  });

  it("начисления не ждут квоту писем: лимит 1 — подарок всем сразу, письма по одному в сутки", async () => {
    const id = await launch({ audience: { type: "list", text: "anna@example.com\nboris@example.com\nvera@example.com" }, grant: { plan: "basic", days: 3 } }, 1);
    const s = await pass(1);
    expect(s).toMatchObject({ granted: 3, emailed: 1, stoppedBy: "limit" });
    expect(await counts(id)).toMatchObject({ granted: 3, sent: 1, queued: 2 });
    await pass(1);
    expect(mailer.calls).toHaveLength(1);
    t += 25 * 3600_000;
    await pass(1);
    expect(mailer.calls).toHaveLength(2);
    expect(await counts(id)).toMatchObject({ sent: 2, queued: 1 });
  });

  it("суточный лимит — по скользящим 24 часам и общий для всех кампаний", async () => {
    await launch({ audience: { type: "list", text: "anna@example.com\nboris@example.com" } }, 3);
    await launch({ audience: { type: "list", text: "vera@example.com\ngleb@example.com" } }, 3);
    await pass(3);
    expect(Object.keys(mailer.delivered())).toHaveLength(3);
    t += 23 * 3600_000;
    await pass(3);
    expect(Object.keys(mailer.delivered())).toHaveLength(3);
    t += 2 * 3600_000;
    await pass(3);
    expect(Object.keys(mailer.delivered())).toHaveLength(4);
  });

  it("отписка после запуска: рекламное не уходит, служебное уходит", async () => {
    const m = await launch({ kind: "marketing" });
    const s = await launch();
    await h.setOptOut("u3");
    await pass();
    expect((await h.delivery(m, "u3"))!.status).toBe("skipped_optout");
    expect((await h.delivery(s, "u3"))!.status).toBe("sent");
    expect(mailer.delivered()["vera@example.com"]).toBe(1);
  });

  it("429: отступ, затем повтор той же пачки с тем же ключом", async () => {
    const id = await launch({ audience: { type: "list", text: "anna@example.com\nboris@example.com" } });
    mailer.script = [{ ok: false, kind: "rate_limit", message: "rate_limit_exceeded" }];
    expect((await pass()).stoppedBy).toBe("rate_limit");
    const d = (await h.delivery(id, "u1"))!;
    expect(d.attempts).toBe(1);
    expect(d.next_attempt_at!.getTime()).toBeGreaterThan(t);
    await pass();
    expect(mailer.calls).toHaveLength(1);
    t += 2 * 3600_000;
    await pass();
    expect(mailer.calls).toHaveLength(2);
    expect(mailer.calls[1].key).toBe(mailer.calls[0].key);
    expect(await counts(id)).toMatchObject({ sent: 2, failed: 0 });
  });

  it("5xx без конца: после шести попыток — «ошибка», рассылка завершается", async () => {
    const id = await launch({ audience: { type: "list", text: "anna@example.com" } });
    for (let i = 0; i < 6; i++) {
      mailer.script = [{ ok: false, kind: "transient", message: "internal_server_error" }];
      await pass();
      t += 2 * 3600_000;
    }
    expect((await h.delivery(id, "u1"))!.status).toBe("failed");
    await pass();
    expect((await h.repo.get(id))!.status).toBe("done");
    expect(mailer.calls).toHaveLength(6);
  });

  it("пачку отклонила проверка — по одному: плохой адрес «ошибка», остальные уходят", async () => {
    const id = await launch({ audience: { type: "list", text: "anna@example.com\nboris@example.com\nvera@example.com" } });
    mailer.script = [
      { ok: false, kind: "invalid", message: "validation_error" },
      { ok: true, ids: ["a"] },
      { ok: false, kind: "invalid", message: "bad address" },
      { ok: true, ids: ["c"] },
    ];
    await pass();
    expect((await h.delivery(id, "u2"))!.status).toBe("failed");
    expect((await h.delivery(id, "u1"))!.status).toBe("sent");
    expect((await h.delivery(id, "u3"))!.status).toBe("sent");
    expect(mailer.calls.slice(1).map((c) => c.key)).toEqual([`cmp-${id}-u-u1`, `cmp-${id}-u-u2`, `cmp-${id}-u-u3`]);
  });

  it("неверный ключ Resend — пауза с причиной; «Продолжить» доотправляет", async () => {
    const id = await launch({ audience: { type: "list", text: "anna@example.com" } });
    mailer.script = [{ ok: false, kind: "fatal", message: "invalid_api_key" }];
    await pass();
    const c = (await h.repo.get(id))!;
    expect(c.status).toBe("paused");
    expect(c.lastError).toContain("invalid_api_key");
    expect((await h.engine.resumeCampaign(h.repo, id)).ok).toBe(true);
    await pass();
    expect(mailer.delivered()).toEqual({ "anna@example.com": 1 });
  });

  it("пауза и возобновление: на паузе не начисляется и не отправляется ничего", async () => {
    const id = await launch({ grant: { plan: "basic", days: 1 } });
    expect((await h.engine.pauseCampaign(h.repo, id)).ok).toBe(true);
    await pass();
    expect(mailer.calls).toHaveLength(0);
    expect((await h.events()).filter((e) => e.kind === "admin_grant")).toHaveLength(0);
    await h.engine.resumeCampaign(h.repo, id);
    await pass();
    expect((await counts(id)).granted).toBe(5);
    expect((await h.repo.get(id))!.status).toBe("done");
  });

  it("рестарт посреди пачки: та же пачка, тот же ключ — письмо не задваивается", async () => {
    const id = await launch({ audience: { type: "list", text: "anna@example.com\nboris@example.com" } });
    mailer.script = ["crash"];
    await expect(pass()).rejects.toThrow("process died");
    expect((await h.delivery(id, "u1"))!.status).toBe("queued");
    await pass(); // «после рестарта»
    expect(mailer.calls).toHaveLength(2);
    expect(mailer.calls[1].key).toBe(mailer.calls[0].key);
    expect(mailer.delivered()).toEqual({ "anna@example.com": 1, "boris@example.com": 1 });
    expect(await counts(id)).toMatchObject({ sent: 2, queued: 0 });
  });

  it("отмена: оставшиеся письма не уходят", async () => {
    const id = await launch();
    expect((await h.engine.cancelCampaign(h.repo, id)).ok).toBe(true);
    await pass();
    expect(mailer.calls).toHaveLength(0);
    expect((await counts(id)).queued).toBe(4);
    expect((await h.engine.cancelCampaign(h.repo, id)).ok).toBe(false);
  });

  it("только кабинет: уведомление один раз, писем нет, квоту не тратит", async () => {
    const id = await launch({ channel: "site", grant: { plan: "trial", days: 2 } });
    await pass();
    await pass();
    expect(mailer.calls).toHaveLength(0);
    expect((await h.notifications()).length).toBe(5);
    expect(await h.repo.sentEmailsSince(new Date(t - DAY))).toBe(0);
    expect(await counts(id)).toMatchObject({ sent: 5, notified: 5, granted: 5 });
    expect((await h.repo.get(id))!.status).toBe("done");
  });

  it("панель недоступна для ГБ: получатель ждёт начисления, письмо — только после него", async () => {
    traffic.owed.add("u2");
    const id = await launch({ audience: { type: "list", text: "anna@example.com\nboris@example.com" }, grant: { plan: "basic", days: 5, trafficGb: 3 } });
    await pass();
    expect(await counts(id)).toMatchObject({ granted: 1, grant_pending: 1, sent: 1 });
    expect(mailer.delivered()["boris@example.com"]).toBeUndefined();
    traffic.owed.clear();
    t += 6 * 60_000;
    await pass();
    expect(mailer.delivered()["boris@example.com"]).toBe(1);
    expect((await h.events()).filter((e) => e.user_id === "u2" && e.kind === "admin_grant")).toHaveLength(1);
    expect((await h.repo.get(id))!.status).toBe("done");
  });
}
