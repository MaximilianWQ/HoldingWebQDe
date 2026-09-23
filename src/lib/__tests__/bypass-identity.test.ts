/**
 * Опознание сущности обхода бота по имени.
 *
 * Замер стороны бота 23.09.2026: у четверых из десяти связанных поле
 * `telegramId` в панели пустое — сущности заведены до бэкфилла 3.x, и
 * заполниться оно уже не может. Пока опознание требовало это поле
 * непустым, сайт отдавал `bypass: null` людям с 65 ГБ, 125 ГБ, 210 ГБ
 * и 1,29 ТБ на руках.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ pool: { query: async () => ({ rows: [] }) }, dbReady: Promise.resolve() }));

import { isBotBypassFor } from "../bypass";
import type { PanelUser } from "../remnawave";

const entity = (over: Partial<PanelUser>): PanelUser =>
  ({ id: 1, username: "289126237", telegramId: null, status: "ACTIVE", trafficLimitBytes: 0, usedTrafficBytes: 0, subscriptionUrl: null, ...over }) as PanelUser;

describe("isBotBypassFor", () => {
  it("имя совпадает, поле панели пустое — это его обход", () => {
    expect(isBotBypassFor(entity({ telegramId: null }), "289126237")).toBe(true);
    expect(isBotBypassFor(entity({ telegramId: "" as unknown as number }), "289126237")).toBe(true);
  });

  it("имя и поле совпадают — как и раньше", () => {
    expect(isBotBypassFor(entity({ telegramId: 289126237 }), "289126237")).toBe(true);
  });

  it("поле заполнено ЧУЖИМ идентификатором — не его", () => {
    // Ослабление ровно на «пусто»: разошедшиеся имя и владелец —
    // по-прежнему повод не показывать сущность человеку.
    expect(isBotBypassFor(entity({ telegramId: 206960827 }), "289126237")).toBe(false);
  });

  it("чужое имя и наши сущности не принимаются", () => {
    expect(isBotBypassFor(entity({ username: "tg_289126237_premium" }), "289126237")).toBe(false);
    expect(isBotBypassFor(entity({ username: "ST00000042_bp" }), "289126237")).toBe(false);
    expect(isBotBypassFor(entity({ username: "206960827" }), "289126237")).toBe(false);
  });
});
