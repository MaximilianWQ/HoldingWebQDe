/**
 * Trial on sign-up (К6) and referral cashback counting.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../db", async () => {
  const m = await import("./fake-db");
  return { pool: m.fakeDb.pool, dbReady: Promise.resolve(), waitForDb: async () => {} };
});

import { fakeDb } from "./fake-db";
import { checkTrialEligibility, realIp, TRIALS_PER_IP_LIMIT } from "../trial";
import { creditReferrerOnPayment, getOrCreateUser } from "../store";
import { TRIAL_DURATION_MS } from "../remnawave";

beforeEach(() => {
  fakeDb.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("trial eligibility", () => {
  it("blocks gmail aliases of an email that already had a trial", async () => {
    fakeDb.blocklist.push({ email_normalized: "johndoe@gmail.com", ip: null, device_fingerprint: null, trial_count: 1 });
    expect(await checkTrialEligibility(fakeDb.pool, { email: "John.Doe+vpn@gmail.com" })).toBe("already_used_email");
  });

  it("limits distinct emails per IP", async () => {
    for (let i = 0; i < TRIALS_PER_IP_LIMIT; i++) {
      fakeDb.blocklist.push({ email_normalized: `u${i}@example.com`, ip: "203.0.113.7", device_fingerprint: null, trial_count: 1 });
    }
    expect(await checkTrialEligibility(fakeDb.pool, { email: "new@example.com", ip: "203.0.113.7" })).toBe("ip_limit");
    expect(await checkTrialEligibility(fakeDb.pool, { email: "new@example.com", ip: "198.51.100.1" })).toBeNull();
  });

  it("ignores non-IP markers like 'telegram-bot' and 'unknown'", () => {
    expect(realIp("telegram-bot")).toBeNull();
    expect(realIp("unknown")).toBeNull();
    expect(realIp("203.0.113.7")).toBe("203.0.113.7");
  });
});

describe("getOrCreateUser grants the trial inside user creation", () => {
  it("new eligible user: trial event, end = now + TRIAL, blocklist recorded", async () => {
    const before = Date.now();
    const u = await getOrCreateUser("fresh@example.com", undefined, "203.0.113.9", "fp-0123456789");
    expect(u.isNew).toBe(true);
    expect(u.trialGranted).toBe(true);
    expect(new Date(u.subscriptionEnd).getTime()).toBeGreaterThanOrEqual(before + TRIAL_DURATION_MS - 1000);
    expect(fakeDb.events.filter((e) => e.kind === "trial")).toHaveLength(1);
    expect(fakeDb.blocklist.map((b) => b.email_normalized)).toContain("fresh@example.com");
    // …and the 500 MB bypass, in the same transaction, once.
    const g = fakeDb.grants.get(`trial:${u.id}`);
    expect(g).toMatchObject({ kind: "trial", bytes: 500 * 1024 * 1024, state: "pending", user_id: u.id });
  });

  it("the bot's /api/bot/register path (bypassTrial: false) gets the trial days but no site bypass", async () => {
    const u = await getOrCreateUser("telegram_42@tg.atlassecure.uk", undefined, "telegram-bot", undefined, { bypassTrial: false });
    expect(u.trialGranted).toBe(true);
    expect(fakeDb.grants.size).toBe(0);
  });

  it("blocked user is created WITHOUT a trial (subscription already ended)", async () => {
    fakeDb.blocklist.push({ email_normalized: "again@example.com", ip: null, device_fingerprint: null, trial_count: 1 });
    const u = await getOrCreateUser("again@example.com", undefined, "203.0.113.9");
    expect(u.isNew).toBe(true);
    expect(u.trialGranted).toBe(false);
    expect(u.trialBlockedReason).toBe("already_used_email");
    expect(new Date(u.subscriptionEnd).getTime()).toBeLessThanOrEqual(Date.now());
    expect(fakeDb.events).toHaveLength(0);
    // Anti-abuse blocks the 500 MB too — neither days nor gigabytes.
    expect(fakeDb.grants.size).toBe(0);
  });

  it("existing user: no second trial", async () => {
    await getOrCreateUser("x@example.com");
    const again = await getOrCreateUser("x@example.com");
    expect(again.isNew).toBe(false);
    expect(fakeDb.events.filter((e) => e.kind === "trial")).toHaveLength(1);
    expect([...fakeDb.grants.values()].filter((g) => g.kind === "trial")).toHaveLength(1);
  });
});

describe("creditReferrerOnPayment", () => {
  function seedReferral() {
    fakeDb.users.set("ref", { id: "ref", email: "ref@example.com", referral_code: "REFCODE1", paid_referrals: 0, balance: 0 });
    fakeDb.users.set("buyer", { id: "buyer", email: "buyer@example.com", referred_by: "REFCODE1", referral_paid_counted_at: null, paid_referrals: 0, balance: 0 });
  }

  it("counts a referee once across several purchases; cashback per purchase", async () => {
    seedReferral();
    await creditReferrerOnPayment("buyer", 199, "pay-1", fakeDb.pool);
    await creditReferrerOnPayment("buyer", 499, "pay-2", fakeDb.pool);
    const ref = fakeDb.users.get("ref")!;
    expect(ref.paid_referrals).toBe(1);
    expect(ref.balance).toBe(1990 + 4990);
    expect(fakeDb.balanceTx).toHaveLength(2);
  });

  it("is idempotent per purchase id", async () => {
    seedReferral();
    const first = await creditReferrerOnPayment("buyer", 199, "pay-1", fakeDb.pool);
    const second = await creditReferrerOnPayment("buyer", 199, "pay-1", fakeDb.pool);
    expect(first?.rewardRubles).toBe(19.9);
    expect(second).toBeNull();
    expect(fakeDb.users.get("ref")!.balance).toBe(1990);
    expect(fakeDb.users.get("ref")!.paid_referrals).toBe(1);
  });
});
