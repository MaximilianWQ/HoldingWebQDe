/**
 * Daily series: Moscow day boundaries and bucketing.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("../db", () => ({ pool: { query: vi.fn() }, dbReady: Promise.resolve(), waitForDb: async () => {} }));

import { buildDailySeries, mskDay, mskDayRange, mskDayStart } from "../admin-series";

describe("Moscow day boundaries", () => {
  it("21:00 UTC is already the next Moscow day", () => {
    expect(mskDay(new Date("2026-09-11T20:59:59Z"))).toBe("2026-09-11");
    expect(mskDay(new Date("2026-09-11T21:00:00Z"))).toBe("2026-09-12");
  });

  it("mskDayStart is 00:00 in Moscow (21:00 UTC of the previous day)", () => {
    expect(mskDayStart("2026-09-12").toISOString()).toBe("2026-09-11T21:00:00.000Z");
  });

  it("range is `days` consecutive Moscow days ending today", () => {
    const r = mskDayRange(3, new Date("2026-09-12T22:30:00Z")); // 01:30 MSK on the 13th
    expect(r).toEqual(["2026-09-11", "2026-09-12", "2026-09-13"]);
  });
});

describe("buildDailySeries", () => {
  const range = ["2026-09-11", "2026-09-12"];

  it("buckets by Moscow day and ignores events outside the range", () => {
    const pts = buildDailySeries(
      {
        payments: [
          // 23:30 MSK on the 11th
          { userId: "a", amount: 199, paidAt: new Date("2026-09-11T20:30:00Z"), refundedAt: null, hasEarlierPaid: false, hadTrial: true },
          // 00:30 MSK on the 12th, refunded on the 12th
          { userId: "b", amount: 349, paidAt: new Date("2026-09-11T21:30:00Z"), refundedAt: new Date("2026-09-12T10:00:00Z"), hasEarlierPaid: true, hadTrial: false },
          // first payment without a trial — neither conversion nor renewal
          { userId: "c", amount: 499.5, paidAt: new Date("2026-09-12T09:00:00Z"), refundedAt: null, hasEarlierPaid: false, hadTrial: false },
          // outside the range
          { userId: "d", amount: 1000, paidAt: new Date("2026-09-09T09:00:00Z"), refundedAt: null, hasEarlierPaid: false, hadTrial: false },
        ],
        registrations: [new Date("2026-09-11T20:59:00Z"), new Date("2026-09-11T21:01:00Z")],
        trials: [new Date("2026-09-12T12:00:00Z")],
        expirations: [new Date("2026-09-11T05:00:00Z"), new Date("2026-09-12T05:00:00Z"), new Date("2026-09-12T06:00:00Z")],
      },
      range
    );
    expect(pts).toEqual([
      { day: "2026-09-11", revenue: 199, refunds: 0, refundsCount: 0, payments: 1, registrations: 1, trials: 0, conversions: 1, renewals: 0, expirations: 1, trafficRevenue: 0, trafficPayments: 0 },
      { day: "2026-09-12", revenue: 848.5, refunds: 349, refundsCount: 1, payments: 2, registrations: 1, trials: 1, conversions: 0, renewals: 1, expirations: 2, trafficRevenue: 0, trafficPayments: 0 },
    ]);
  });

  it("«Пакеты трафика»: in revenue and payments and in traffic*, never a conversion or renewal", () => {
    const pts = buildDailySeries(
      {
        payments: [
          { userId: "a", amount: 199, paidAt: new Date("2026-09-12T09:00:00Z"), refundedAt: null, hasEarlierPaid: false, hadTrial: true, product: "subscription" },
          { userId: "a", amount: 269, paidAt: new Date("2026-09-12T10:00:00Z"), refundedAt: null, hasEarlierPaid: true, hadTrial: true, product: "traffic" },
          { userId: "b", amount: 89, paidAt: new Date("2026-09-12T11:00:00Z"), refundedAt: null, hasEarlierPaid: false, hadTrial: true, product: "traffic" },
        ],
        registrations: [],
        trials: [],
        expirations: [],
      },
      range
    );
    expect(pts[1]).toMatchObject({ revenue: 557, payments: 3, trafficRevenue: 358, trafficPayments: 2, conversions: 1, renewals: 0 });
  });

  it("returns zero points for empty days", () => {
    const pts = buildDailySeries({ payments: [], registrations: [], trials: [], expirations: [] }, range);
    expect(pts.map((p) => p.day)).toEqual(range);
    expect(pts.every((p) => p.revenue === 0 && p.payments === 0)).toBe(true);
  });
});
