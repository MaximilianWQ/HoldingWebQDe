/**
 * Общее для /api/admin/campaigns/**: проверка прав, ответы, вид кампании
 * с прогрессом и оценкой времени. Сами действия — src/lib/campaigns.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../middleware";
import { getUserById } from "@/lib/store";
import { pgCampaignRepo } from "@/lib/campaigns-pg";
import { campaignView, dailyLimit, estimateSend, sendsEmail, type Campaign } from "@/lib/campaigns";
import { DAY } from "@/lib/subscription-ledger";

export const repo = pgCampaignRepo;

export type Admin = { userId: string; email: string | null };

export async function requireAdmin(): Promise<{ ok: true; admin: Admin } | { ok: false; res: NextResponse }> {
  const auth = await verifyAdmin();
  if (!auth.authorized || !auth.userId) {
    return { ok: false, res: NextResponse.json({ success: false, error: auth.error ?? "Доступ запрещён" }, { status: 403 }) };
  }
  const u = await getUserById(auth.userId);
  return { ok: true, admin: { userId: auth.userId, email: u?.email ?? null } };
}

export const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });
export const ok = (data: unknown) => NextResponse.json({ success: true, data });

export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const v = await request.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Кампания + прогресс + оценка, сколько ещё идти письмам. */
export async function viewOf(c: Campaign) {
  const counts = await repo.counts(c);
  let estimate = null;
  if (sendsEmail(c) && counts.queued > 0 && ["queued", "sending", "paused"].includes(c.status)) {
    const [sentLast24h, ahead] = await Promise.all([repo.sentEmailsSince(new Date(Date.now() - DAY)), repo.queuedEmails(c.id)]);
    estimate = estimateSend({ emails: counts.queued, ahead, limit: dailyLimit(), sentLast24h });
  }
  return campaignView(c, counts, estimate);
}

export async function limitInfo() {
  const [sentLast24h, queued] = await Promise.all([repo.sentEmailsSince(new Date(Date.now() - DAY)), repo.queuedEmails(null)]);
  const daily = dailyLimit();
  return { daily, sentLast24h, available: Math.max(0, daily - sentLast24h), queued };
}

/** Кому слать тест, если адрес не введён. */
export function defaultTestAddress(admin: Admin): string {
  return (process.env.ADMIN_EMAIL || admin.email || "").trim();
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
