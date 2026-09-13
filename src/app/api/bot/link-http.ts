import { NextResponse } from "next/server";
import { linkedSummary, LinkSuccess } from "@/lib/telegram-link";
import type { BypassSnapshot } from "@/lib/bypass";

/**
 * Response shapes shared by /api/bot/link and /api/bot/email/confirm
 * (contract: docs/bot/TZ_BOT_EMAIL_LINK.md). Errors carry a stable
 * `code` the bot branches on; `error` is human text (Russian).
 */

export interface LinkHttpError {
  status: number;
  code: string;
  error: string;
  retryAfterSeconds?: number;
  attemptsLeft?: number;
}

export function linkErrorResponse(e: LinkHttpError): NextResponse {
  const body: Record<string, unknown> = { success: false, error: e.error, code: e.code };
  if (e.attemptsLeft !== undefined) body.attemptsLeft = e.attemptsLeft;
  if (e.retryAfterSeconds !== undefined) body.retryAfterSeconds = e.retryAfterSeconds;
  const res = NextResponse.json(body, { status: e.status });
  if (e.retryAfterSeconds) res.headers.set("Retry-After", String(e.retryAfterSeconds));
  if (e.status === 503) res.headers.set("Retry-After", "30");
  return res;
}

export function bypassJson(b: BypassSnapshot | null | undefined) {
  if (!b) return null;
  return {
    panelUserId: b.panelUserId,
    subscriptionUrl: b.subscriptionUrl,
    limitBytes: b.limitBytes,
    usedBytes: b.usedBytes,
    remainingBytes: b.remainingBytes,
    unlimited: b.unlimited,
    status: b.status,
  };
}

export function linkSuccessData(r: LinkSuccess) {
  const s = linkedSummary(r.user);
  const msLeft = Math.max(0, new Date(r.user.subscriptionEnd).getTime() - Date.now());
  return {
    ...s,
    linked: true,
    alreadyLinked: r.alreadyLinked,
    accountCreated: r.created,
    kept: r.kept,
    keptPanelUserId: r.keptPanelUserId,
    disabledPanelUserId: r.disabledPanelUserId,
    bonusDays: r.bonusDays,
    panelSynced: r.panelSynced,
    bypassPanelUserId: r.bypassPanelUserId,
    // Fields of the old /api/bot/link answer, kept for the current bot.
    telegramId: r.user.telegramId,
    hoursLeft: Math.floor((msLeft / 3_600_000) % 24),
    hasActiveSubscription: !s.isExpired && !!s.subscriptionUrl,
    subscriptionPlan: s.plan,
    vpnKey: s.subscriptionUrl,
    xrayUuid: null,
    referralCode: r.user.referralCode,
    telegramBonus: { granted: r.bonusDays > 0, days: r.bonusDays, reason: r.bonusDays > 0 ? undefined : r.bonusReason ?? undefined },
  };
}
