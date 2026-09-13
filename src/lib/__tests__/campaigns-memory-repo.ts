/**
 * CampaignRepo в памяти — для тестов движка (campaigns.ts) без Postgres.
 * Пользователи берутся из fakeDb.users (там же идут начисления через
 * настоящий журнал подписки), поэтому дни подарка проверяются по тем же
 * строкам, что и у остальных тестов.
 *
 * Семантика повторяет SQL campaigns-pg.ts; расхождения ловит
 * campaigns-pg.test.ts — те же сценарии на настоящем Postgres.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { fakeDb } from "./fake-db";
import {
  deliveryStatusFor,
  EMPTY_COUNTS,
  type Audience,
  type AudiencePreview,
  type Campaign,
  type CampaignChannel,
  type CampaignInput,
  type CampaignKind,
  type CampaignRepo,
  type CampaignStatus,
  type DeliveryCounts,
  type DeliveryRow,
  type DeliveryStatus,
} from "../campaigns";
import { generateUnsubscribeToken } from "../unsubscribe";

export interface MemDelivery {
  campaign_id: string;
  user_id: string;
  email: string;
  status: DeliveryStatus;
  attempts: number;
  last_error: string | null;
  resend_id: string | null;
  sent_at: Date | null;
  batch_id: string | null;
  next_attempt_at: Date | null;
  granted_at: Date | null;
  notified_at: Date | null;
}

type Stored = Campaign & { _n: number };

const OPEN: DeliveryStatus[] = ["queued", "skipped_invalid", "skipped_placeholder"];
const NO_EMAIL: DeliveryStatus[] = ["skipped_invalid", "skipped_placeholder"];
const isDue = (d: MemDelivery, now: Date) => !d.next_attempt_at || d.next_attempt_at.getTime() <= now.getTime();
const byUser = (a: MemDelivery, b: MemDelivery) => (a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0);

export class MemoryCampaignRepo implements CampaignRepo {
  campaigns = new Map<string, Stored>();
  deliveries = new Map<string, MemDelivery>();
  notifications = new Map<string, { id: string; userId: string; title: string; message: string }>();
  private n = 0;
  private batchSeq = 0;

  reset() {
    this.campaigns.clear();
    this.deliveries.clear();
    this.notifications.clear();
    this.n = 0;
    this.batchSeq = 0;
  }

  rowsOf(cid: string): MemDelivery[] {
    return [...this.deliveries.values()].filter((d) => d.campaign_id === cid).sort(byUser);
  }

  private d(cid: string, uid: string) {
    return this.deliveries.get(`${cid}|${uid}`);
  }

  private clone(c: Stored): Campaign {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _n, ...rest } = c;
    return structuredClone(rest);
  }

  private toRow(d: MemDelivery): DeliveryRow {
    const u = fakeDb.users.get(d.user_id)!;
    return {
      userId: d.user_id,
      email: d.email,
      status: d.status,
      attempts: d.attempts,
      batchId: d.batch_id,
      token: u.unsubscribe_token ?? null,
      subscriptionEnd: new Date(u.subscription_end),
      plan: u.subscription_plan ?? null,
      grantedAt: d.granted_at,
      notifiedAt: d.notified_at,
    };
  }

  private audienceUsers(aud: Audience): any[] {
    const all = [...fakeDb.users.values()];
    if (aud.type === "list") {
      const set = new Set(aud.entries.map((e) => (e.includes("@") ? e.toLowerCase() : e)));
      const up = new Set(aud.entries.map((e) => e.toUpperCase()));
      return all.filter((u) => set.has(String(u.email).toLowerCase()) || set.has(u.id) || (u.public_id && up.has(String(u.public_id).toUpperCase())));
    }
    const now = Date.now();
    const live = (u: any) => new Date(u.subscription_end).getTime() > now;
    const f: Record<string, (u: any) => boolean> = {
      all: () => true,
      active: live,
      expired: (u) => !live(u),
      paid: (u) => live(u) && ["basic", "plus"].includes(u.subscription_plan),
      trial: (u) => live(u) && u.subscription_plan === "trial",
    };
    const pick = f[aud.filter];
    if (!pick) throw new Error(`memory repo: filter ${aud.filter} is not emulated`);
    return all.filter(pick).filter((u) => !aud.q || String(u.email).includes(aud.q));
  }

  private statusOf(u: any, kind: CampaignKind, channel: CampaignChannel) {
    return deliveryStatusFor(kind, channel, { email: u.email, marketingConsentAt: u.marketing_consent_at ?? null, marketingOptOutAt: u.marketing_opt_out_at ?? null });
  }

  async create(input: CampaignInput, createdBy: string | null) {
    const id = `cmp${++this.n}`;
    const now = new Date().toISOString();
    const c: Stored = { ...structuredClone(input), id, status: "draft", createdBy, createdAt: now, updatedAt: now, startedAt: null, finishedAt: null, counts: null, lastError: null, _n: this.n };
    this.campaigns.set(id, c);
    return this.clone(c);
  }

  async updateDraft(id: string, input: CampaignInput) {
    const c = this.campaigns.get(id);
    if (!c || c.status !== "draft") return null;
    Object.assign(c, structuredClone(input), { updatedAt: new Date().toISOString() });
    return this.clone(c);
  }

  async get(id: string) {
    const c = this.campaigns.get(id);
    return c ? this.clone(c) : null;
  }

  async list(limit: number) {
    return [...this.campaigns.values()].sort((a, b) => b._n - a._n).slice(0, limit).map((c) => this.clone(c));
  }

  async transition(id: string, from: CampaignStatus[], to: CampaignStatus, patch: { started?: boolean; finished?: boolean; lastError?: string | null } = {}) {
    const c = this.campaigns.get(id);
    if (!c || !from.includes(c.status)) return null;
    c.status = to;
    if (patch.started) c.startedAt ??= new Date().toISOString();
    if (patch.finished) c.finishedAt = new Date().toISOString();
    if (patch.lastError !== undefined) c.lastError = patch.lastError;
    return this.clone(c);
  }

  async setLastError(id: string, error: string | null) {
    const c = this.campaigns.get(id);
    if (c) c.lastError = error;
  }

  async saveCounts(id: string, counts: DeliveryCounts) {
    const c = this.campaigns.get(id);
    if (c) c.counts = { ...counts };
  }

  async counts(c: Campaign) {
    const k: DeliveryCounts = { ...EMPTY_COUNTS };
    for (const d of this.rowsOf(c.id)) {
      k.total += 1;
      (k as any)[d.status] += 1;
      if (d.granted_at) k.granted += 1;
      if (d.notified_at) k.notified += 1;
      if (c.grant && !d.granted_at && OPEN.includes(d.status)) k.grant_pending += 1;
    }
    return k;
  }

  async failures(id: string, limit: number) {
    return this.rowsOf(id)
      .filter((d) => d.status === "failed" || d.last_error)
      .slice(0, limit)
      .map((d) => ({ email: d.email, status: d.status, error: d.last_error, attempts: d.attempts }));
  }

  async previewAudience(aud: Audience, kind: CampaignKind, channel: CampaignChannel): Promise<AudiencePreview> {
    const users = this.audienceUsers(aud);
    const byStatus = { queued: 0, skipped_optout: 0, skipped_no_consent: 0, skipped_invalid: 0, skipped_placeholder: 0 };
    let optedOut = 0;
    const queued: any[] = [];
    for (const u of users) {
      const s = this.statusOf(u, kind, channel) as keyof typeof byStatus;
      byStatus[s] += 1;
      if (u.marketing_opt_out_at) optedOut += 1;
      if (s === "queued") queued.push(u);
    }
    queued.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || (a.id < b.id ? -1 : 1));
    let notFound: string[] = [];
    if (aud.type === "list") {
      notFound = aud.entries.filter(
        (e) => !users.some((u) => String(u.email).toLowerCase() === e.toLowerCase() || u.id === e || String(u.public_id ?? "").toUpperCase() === e.toUpperCase())
      );
    }
    const f = queued[0];
    return {
      total: users.length,
      byStatus,
      optedOut,
      notFound,
      sample: queued.slice(0, 20).map((u) => u.email),
      first: f ? { userId: f.id, email: f.email, subscriptionEnd: new Date(f.subscription_end), plan: f.subscription_plan ?? null } : null,
    };
  }

  async queueCampaign(id: string) {
    const c = this.campaigns.get(id);
    if (!c || c.status !== "draft") return null;
    let inserted = 0;
    for (const u of this.audienceUsers(c.audience)) {
      const key = `${id}|${u.id}`;
      if (this.deliveries.has(key)) continue;
      this.deliveries.set(key, {
        campaign_id: id,
        user_id: u.id,
        email: u.email,
        status: this.statusOf(u, c.kind, c.channel),
        attempts: 0,
        last_error: null,
        resend_id: null,
        sent_at: null,
        batch_id: null,
        next_attempt_at: null,
        granted_at: null,
        notified_at: null,
      });
      inserted += 1;
    }
    c.status = "queued";
    c.startedAt = new Date().toISOString();
    c.lastError = null;
    return { campaign: this.clone(c), inserted };
  }

  async active() {
    return [...this.campaigns.values()].filter((c) => c.status === "queued" || c.status === "sending").sort((a, b) => a._n - b._n).map((c) => this.clone(c));
  }

  async sideEffectsDue(c: Campaign, now: Date, limit: number) {
    const grant = !!c.grant;
    const notifyAll = c.channel !== "email";
    const site = c.channel === "site";
    return this.rowsOf(c.id)
      .filter(
        (d) =>
          OPEN.includes(d.status) &&
          isDue(d, now) &&
          ((grant && !d.granted_at) || (!d.notified_at && (notifyAll || (grant && NO_EMAIL.includes(d.status)))) || (site && d.status === "queued"))
      )
      .slice(0, limit)
      .map((d) => this.toRow(d));
  }

  async markGranted(id: string, uid: string, at: Date) {
    const d = this.d(id, uid);
    if (d) Object.assign(d, { granted_at: at, last_error: null, next_attempt_at: null });
  }

  async markNotified(id: string, uid: string, at: Date) {
    const d = this.d(id, uid);
    if (d) d.notified_at = at;
  }

  async insertNotification(nid: string, userId: string, title: string, message: string) {
    if (this.notifications.has(nid)) return false;
    this.notifications.set(nid, { id: nid, userId, title, message });
    return true;
  }

  async markSiteSent(id: string, uid: string, at: Date) {
    const d = this.d(id, uid);
    if (d && d.status === "queued") Object.assign(d, { status: "sent", sent_at: at });
  }

  async skipIneligibleMarketing(id: string) {
    let n = 0;
    for (const d of this.rowsOf(id)) {
      if (d.status !== "queued") continue;
      const u = fakeDb.users.get(d.user_id)!;
      if (u.marketing_opt_out_at) d.status = "skipped_optout";
      else if (!u.marketing_consent_at) d.status = "skipped_no_consent";
      else continue;
      n += 1;
    }
    return n;
  }

  async sentEmailsSince(since: Date) {
    let n = 0;
    for (const d of this.deliveries.values()) {
      const c = this.campaigns.get(d.campaign_id)!;
      if (d.status === "sent" && d.sent_at && d.sent_at.getTime() > since.getTime() && c.channel !== "site") n += 1;
    }
    return n;
  }

  async queuedEmails(excludeId: string | null) {
    let n = 0;
    for (const d of this.deliveries.values()) {
      const c = this.campaigns.get(d.campaign_id)!;
      if (d.status === "queued" && (c.status === "queued" || c.status === "sending") && c.channel !== "site" && c.id !== excludeId) n += 1;
    }
    return n;
  }

  async claimBatch(c: Campaign, max: number, now: Date) {
    const rows = this.rowsOf(c.id);
    let batch =
      rows
        .filter((d) => d.status === "queued" && d.batch_id && isDue(d, now))
        .map((d) => d.batch_id!)
        .sort()[0] ?? null;
    if (!batch) {
      const pick = rows
        .filter((d) => d.status === "queued" && !d.batch_id && isDue(d, now) && (!c.grant || d.granted_at) && (c.channel !== "both" || d.notified_at))
        .slice(0, max);
      if (pick.length === 0) return [];
      batch = `b${String(++this.batchSeq).padStart(4, "0")}`;
      for (const d of pick) d.batch_id = batch;
    }
    return rows.filter((d) => d.batch_id === batch && d.status === "queued").map((d) => this.toRow(d));
  }

  async releaseBatch(id: string, batchId: string) {
    for (const d of this.rowsOf(id)) if (d.batch_id === batchId && d.status === "queued") d.batch_id = null;
  }

  async markSent(id: string, sent: Array<{ userId: string; resendId: string | null }>, at: Date) {
    for (const s of sent) {
      const d = this.d(id, s.userId);
      if (d && d.status === "queued") Object.assign(d, { status: "sent", sent_at: at, resend_id: s.resendId, attempts: d.attempts + 1, last_error: null, next_attempt_at: null });
    }
  }

  async markRetry(id: string, uids: string[], error: string, nextAt: Date, max: number) {
    for (const uid of uids) {
      const d = this.d(id, uid);
      if (!d || !OPEN.includes(d.status)) continue;
      d.attempts += 1;
      d.last_error = error;
      d.next_attempt_at = nextAt;
      if (d.attempts >= max) d.status = "failed";
    }
  }

  async markFailed(id: string, uids: string[], error: string) {
    for (const uid of uids) {
      const d = this.d(id, uid);
      if (d && OPEN.includes(d.status)) Object.assign(d, { status: "failed", attempts: d.attempts + 1, last_error: error });
    }
  }

  async defer(id: string, uids: string[], nextAt: Date, error: string) {
    for (const uid of uids) {
      const d = this.d(id, uid);
      if (d && OPEN.includes(d.status)) Object.assign(d, { next_attempt_at: nextAt, last_error: error });
    }
  }

  async ensureTokens(uids: string[]) {
    const m = new Map<string, string>();
    for (const id of uids) {
      const u = fakeDb.users.get(id);
      if (!u) continue;
      u.unsubscribe_token ??= generateUnsubscribeToken();
      m.set(id, u.unsubscribe_token);
    }
    return m;
  }

  async remaining(c: Campaign) {
    const g = !!c.grant;
    const all = c.channel !== "email";
    return this.rowsOf(c.id).filter((d) => d.status === "queued" || (NO_EMAIL.includes(d.status) && ((g && (!d.granted_at || !d.notified_at)) || (all && !d.notified_at)))).length;
  }

  async userForTest(email: string) {
    const u = [...fakeDb.users.values()].find((x) => String(x.email).toLowerCase() === email.toLowerCase());
    return u ? { userId: u.id, email: u.email, subscriptionEnd: new Date(u.subscription_end), plan: u.subscription_plan ?? null, token: u.unsubscribe_token ?? null } : null;
  }
}
