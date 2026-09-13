/**
 * Токен отписки и согласия: CSPRNG-токен, ленивая выдача, отписка по
 * токену снимает согласие на рекламу, повтор — успех.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", () => ({ pool: { query: vi.fn() }, dbReady: Promise.resolve(), waitForDb: async () => {} }));

import {
  ensureUnsubscribeTokens,
  generateUnsubscribeToken,
  isUnsubscribeTokenShape,
  maskEmail,
  unsubscribeByToken,
  unsubscribeLinks,
} from "../unsubscribe";
import { canReceiveMarketing, getMarketingConsent, recordPrivacyConsent, setMarketingConsent, PRIVACY_POLICY_VERSION } from "../consent";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const users = new Map<string, Row>();
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Ровно те запросы, что шлют unsubscribe.ts и consent.ts. */
const db = {
  query: async (sql: string, p: any[] = []) => {
    const s = norm(sql);
    const out = (rows: Row[]) => ({ rows, rowCount: rows.length });
    if (s === "SELECT id, unsubscribe_token FROM users WHERE id = ANY($1::text[])") {
      return out([...users.values()].filter((u) => p[0].includes(u.id)).map((u) => ({ id: u.id, unsubscribe_token: u.unsubscribe_token ?? null })));
    }
    if (s.startsWith("UPDATE users AS u SET unsubscribe_token = v.tok")) {
      let n = 0;
      (p[0] as string[]).forEach((id, i) => {
        const u = users.get(id);
        if (u && !u.unsubscribe_token) {
          u.unsubscribe_token = p[1][i];
          n += 1;
        }
      });
      return { rows: [], rowCount: n };
    }
    if (s === "SELECT id, email, marketing_opt_out_at FROM users WHERE unsubscribe_token = $1") {
      return out([...users.values()].filter((u) => u.unsubscribe_token === p[0]).map((u) => ({ id: u.id, email: u.email, marketing_opt_out_at: u.marketing_opt_out_at ?? null })));
    }
    if (s.startsWith("UPDATE users SET marketing_consent_at = NOW(), marketing_consent_source = $2, marketing_opt_out_at = NULL")) {
      const u = users.get(p[0]);
      if (!u || (u.marketing_consent_at && !u.marketing_opt_out_at)) return out([]);
      Object.assign(u, { marketing_consent_at: new Date(), marketing_consent_source: p[1], marketing_opt_out_at: null });
      return out([{ id: u.id }]);
    }
    if (s.startsWith("UPDATE users SET marketing_consent_at = NULL, marketing_consent_source = $2")) {
      const u = users.get(p[0]);
      if (!u || (!u.marketing_consent_at && u.marketing_opt_out_at)) return out([]);
      Object.assign(u, { marketing_consent_at: null, marketing_consent_source: p[1], marketing_opt_out_at: u.marketing_opt_out_at ?? new Date() });
      return out([{ id: u.id }]);
    }
    if (s === "UPDATE users SET privacy_consent_at = NOW(), privacy_consent_version = $2 WHERE id = $1") {
      Object.assign(users.get(p[0])!, { privacy_consent_at: new Date(), privacy_consent_version: p[1] });
      return out([]);
    }
    if (s === "SELECT marketing_consent_at, marketing_opt_out_at FROM users WHERE id = $1") {
      const u = users.get(p[0]);
      return out(u ? [{ marketing_consent_at: u.marketing_consent_at ?? null, marketing_opt_out_at: u.marketing_opt_out_at ?? null }] : []);
    }
    throw new Error(`unhandled SQL: ${s}`);
  },
};
const q = (sql: string, params?: unknown[]) => db.query(sql, params as any[]);

beforeEach(() => {
  users.clear();
  users.set("u1", { id: "u1", email: "anna@example.com" });
  users.set("u2", { id: "u2", email: "boris@example.com", unsubscribe_token: generateUnsubscribeToken() });
});

describe("токен отписки", () => {
  it("32 случайных байта в base64url — 43 символа, без повторов", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const t = generateUnsubscribeToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(t, "base64url")).toHaveLength(32);
      seen.add(t);
    }
    expect(seen.size).toBe(2000);
  });

  it("форма проверяется до запроса к базе", async () => {
    for (const bad of ["", "short", "x".repeat(44), "../../etc/passwd".padEnd(43, "a"), null, 42]) expect(isUnsubscribeTokenShape(bad)).toBe(false);
    expect(await unsubscribeByToken("not-a-token", db)).toEqual({ ok: false });
  });

  it("выдаётся лениво и только тем, у кого его нет", async () => {
    const before = users.get("u2")!.unsubscribe_token;
    const m = await ensureUnsubscribeTokens(q, ["u1", "u2"]);
    expect(m.get("u2")).toBe(before);
    expect(isUnsubscribeTokenShape(m.get("u1"))).toBe(true);
    expect(users.get("u1")!.unsubscribe_token).toBe(m.get("u1"));
    const again = await ensureUnsubscribeTokens(q, ["u1"]);
    expect(again.get("u1")).toBe(m.get("u1"));
  });

  it("ссылки строятся от SITE_BASE_URL", () => {
    process.env.SITE_BASE_URL = "https://qodev.dev/";
    const l = unsubscribeLinks("abc");
    expect(l.page).toBe("https://qodev.dev/unsubscribe?t=abc");
    expect(l.oneClick).toBe("https://qodev.dev/api/unsubscribe?t=abc");
  });

  it("адрес на странице показывается не целиком", () => {
    expect(maskEmail("grant@gmail.com")).toBe("gr***@gmail.com");
    expect(maskEmail("a@x.ru")).toBe("a***@x.ru");
  });
});

describe("отписка и согласие", () => {
  it("отписка по токену снимает согласие на рекламу; повтор — already", async () => {
    await setMarketingConsent(db, "u2", true, "signup");
    expect(canReceiveMarketing({ marketingConsentAt: users.get("u2")!.marketing_consent_at, marketingOptOutAt: users.get("u2")!.marketing_opt_out_at })).toBe(true);
    const token = users.get("u2")!.unsubscribe_token;
    const r1 = await unsubscribeByToken(token, db);
    expect(r1).toMatchObject({ ok: true, userId: "u2", already: false });
    expect(users.get("u2")!.marketing_opt_out_at).toBeInstanceOf(Date);
    expect(users.get("u2")!.marketing_consent_at).toBeNull();
    expect(users.get("u2")!.marketing_consent_source).toBe("unsubscribe");
    const r2 = await unsubscribeByToken(token, db);
    expect(r2).toMatchObject({ ok: true, already: true });
  });

  it("чужой токен той же формы — не найден", async () => {
    expect(await unsubscribeByToken(generateUnsubscribeToken(), db)).toEqual({ ok: false });
  });

  it("согласие можно вернуть — отписка снимается", async () => {
    await setMarketingConsent(db, "u1", false, "dashboard");
    expect((await getMarketingConsent(db, "u1"))!.on).toBe(false);
    const r = await setMarketingConsent(db, "u1", true, "dashboard");
    expect(r.changed).toBe(true);
    expect(users.get("u1")!.marketing_opt_out_at).toBeNull();
    expect((await getMarketingConsent(db, "u1"))!.on).toBe(true);
    expect((await setMarketingConsent(db, "u1", true, "dashboard")).changed).toBe(false);
  });

  it("согласие с политикой хранит версию документа", async () => {
    await recordPrivacyConsent(db, "u1");
    expect(users.get("u1")!.privacy_consent_version).toBe(PRIVACY_POLICY_VERSION);
  });
});
