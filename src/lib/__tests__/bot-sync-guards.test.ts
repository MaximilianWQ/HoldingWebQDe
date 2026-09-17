/**
 * Разбор синхронизации с ботом (17.09.2026):
 *  - sync-balance: один и тот же кешбэк не уходит боту дважды при
 *    одновременных вызовах (ретрай по таймауту);
 *  - overwrite_site: общий ключ связанного не укорачивается, отзыв — можно.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", async () => {
  const m = await import("./fake-db");
  return { pool: m.fakeDb.pool, dbReady: Promise.resolve(), waitForDb: async () => {} };
});

import { fakeDb } from "./fake-db";
import { claimCashbackForBot, botOverwriteSubscription, peekCashbackForBot, ackCashbackForBot } from "../store";

const DAY = 86400000;

beforeEach(() => {
  fakeDb.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("claimCashbackForBot", () => {
  it("два одновременных вызова: кешбэк получает ровно один", async () => {
    fakeDb.users.set("u", { id: "u", email: "u@example.com", balance: 0, created_at: new Date(), subscription_end: new Date() });
    fakeDb.balanceTx.push(
      { id: "t1", user_id: "u", amount: 2990, synced_to_bot: false, description: "Кешбэк", related_user_id: "b", created_at: new Date() },
      { id: "t2", user_id: "u", amount: 1000, synced_to_bot: false, description: "Кешбэк", related_user_id: "c", created_at: new Date() },
    );
    const [a, b] = await Promise.all([claimCashbackForBot("u", 100000), claimCashbackForBot("u", 100000)]);
    const total = [...a.claimed, ...b.claimed].reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(3990);
    expect(a.claimed.length + b.claimed.length).toBe(2);
    expect(new Set([...a.claimed, ...b.claimed].map((t) => t.id)).size).toBe(2);
    const again = await claimCashbackForBot("u", 103990);
    expect(again.claimed).toHaveLength(0);
    expect(again.balance).toBe(103990);
    expect(fakeDb.users.get("u")!.balance).toBe(103990);
  });

  it("баланс = баланс бота + забранный кешбэк", async () => {
    fakeDb.users.set("u", { id: "u", email: "u@example.com", balance: 5, created_at: new Date(), subscription_end: new Date() });
    fakeDb.balanceTx.push({ id: "t1", user_id: "u", amount: 2990, synced_to_bot: false, description: null, related_user_id: null, created_at: new Date() });
    const r = await claimCashbackForBot("u", 100000);
    expect(r.balance).toBe(102990);
    expect(fakeDb.users.get("u")!.balance).toBe(102990);
  });
});

describe("двухфазный обмен кешбэком", () => {
  it("потерянный ответ: повтор возвращает те же записи; после ack — пусто", async () => {
    fakeDb.users.set("u", { id: "u", email: "u@example.com", balance: 0, created_at: new Date(), subscription_end: new Date() });
    fakeDb.balanceTx.push({ id: "t1", user_id: "u", amount: 2990, synced_to_bot: false, description: null, related_user_id: null, created_at: new Date() });
    const first = await peekCashbackForBot("u", 100000);
    const retry = await peekCashbackForBot("u", 100000);
    expect(first.pending.map((t) => t.id)).toEqual(["t1"]);
    expect(retry.pending.map((t) => t.id)).toEqual(["t1"]);
    expect(retry.balance).toBe(102990);
    expect(await ackCashbackForBot("u", ["t1", "t1", "чужой"])).toEqual(["t1"]);
    expect(await ackCashbackForBot("u", ["t1"])).toEqual([]);
    const after = await peekCashbackForBot("u", 102990);
    expect(after.pending).toHaveLength(0);
    expect(after.balance).toBe(102990);
  });
});

describe("botOverwriteSubscription", () => {
  const seed = (end: Date) =>
    fakeDb.users.set("u", { id: "u", email: "u@example.com", telegram_id: "700", subscription_end: end, subscription_plan: "plus", created_at: new Date(), balance: 0 });

  it("дата раньше текущей — отказ, срок не меняется, события нет", async () => {
    const end = new Date(Date.now() + 30 * DAY);
    seed(end);
    const r = await botOverwriteSubscription("u", new Date(Date.now() + 5 * DAY), "basic", "700");
    expect(r.ok).toBe(false);
    expect((fakeDb.users.get("u")!.subscription_end as Date).getTime()).toBe(end.getTime());
    expect(fakeDb.events.filter((e) => e.kind === "bot_overwrite")).toHaveLength(0);
  });

  it("дата позже текущей — применяется", async () => {
    seed(new Date(Date.now() + 5 * DAY));
    const later = new Date(Date.now() + 30 * DAY);
    const r = await botOverwriteSubscription("u", later, "plus", "700");
    expect(r.ok).toBe(true);
    expect((fakeDb.users.get("u")!.subscription_end as Date).getTime()).toBe(later.getTime());
  });

  it("явный отзыв укорачивает", async () => {
    seed(new Date(Date.now() + 30 * DAY));
    const now = new Date();
    const r = await botOverwriteSubscription("u", now, "trial", "700", { revocation: true });
    expect(r.ok).toBe(true);
    expect((fakeDb.users.get("u")!.subscription_end as Date).getTime()).toBe(now.getTime());
  });
});
