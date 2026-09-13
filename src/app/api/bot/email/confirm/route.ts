import { NextRequest, NextResponse } from "next/server";
import { confirmBotEmailLink } from "@/lib/bot-email-link";
import { clientIpFrom } from "@/lib/client-ip";
import { verifyBotApiKey, unauthorizedResponse } from "../../auth";
import { botSyncDisabledResponse } from "../../sync-guard";
import { linkErrorResponse, linkSuccessData } from "../../link-http";

/**
 * POST /api/bot/email/confirm { telegramId, email, code, premiumPanelUserId? }
 *
 * Checks the code, then links (src/lib/telegram-link.ts): one account,
 * one key — the longer subscription survives, the other entity is
 * DISABLED; +7 days once. Repeating a successful confirm is idempotent.
 *   200 { linked, userId, email, subscriptionUrl, panelUserId, subscriptionEnd, plan, kept,
 *         disabledPanelUserId, bonusDays, … }
 *   400 VALIDATION | CODE_NOT_FOUND | CODE_EXPIRED | CODE_INVALID (+attemptsLeft) | CODE_ATTEMPTS_EXCEEDED
 *   409 TELEGRAM_LINKED_OTHER | EMAIL_LINKED_OTHER · 429 RATE_LIMITED · 503 PANEL_UNAVAILABLE | BUSY (retry; the code stays valid)
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return linkErrorResponse({ status: 400, code: "VALIDATION", error: "JSON body required" });
    const r = await confirmBotEmailLink({
      telegramId: body.telegramId,
      email: body.email,
      code: body.code,
      premiumPanelUserId: body.premiumPanelUserId,
      ip: clientIpFrom(request.headers),
    });
    if (!r.ok) return linkErrorResponse(r);
    return NextResponse.json({ success: true, data: linkSuccessData(r) });
  } catch (err) {
    console.error("[BOT/EMAIL/CONFIRM] error:", err);
    return linkErrorResponse({ status: 500, code: "INTERNAL", error: "Internal error" });
  }
}
