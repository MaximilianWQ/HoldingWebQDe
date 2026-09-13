import { NextRequest, NextResponse } from "next/server";
import { startBotEmailLink } from "@/lib/bot-email-link";
import { clientIpFrom } from "@/lib/client-ip";
import { verifyBotApiKey, unauthorizedResponse } from "../../auth";
import { botSyncDisabledResponse } from "../../sync-guard";
import { linkErrorResponse } from "../../link-http";

/**
 * POST /api/bot/email/start { telegramId, email }
 *
 * Bot first: sends a 6-digit code «Код для привязки Telegram к Atlas
 * Secure» to the address (10 min, 5 attempts). The answer is neutral —
 * it never says whether the email has a site account.
 *   200 { sent: true, expiresInSeconds: 600 }
 *   200 { sent: false, alreadyLinked: true }  — this Telegram is already linked to this email
 *   400 VALIDATION | DISPOSABLE_EMAIL · 409 TELEGRAM_LINKED_OTHER · 429 RATE_LIMITED · 502 EMAIL_SEND_FAILED
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return linkErrorResponse({ status: 400, code: "VALIDATION", error: "JSON body required" });
    const r = await startBotEmailLink({ telegramId: body.telegramId, email: body.email, ip: clientIpFrom(request.headers) });
    if (!r.ok) return linkErrorResponse(r);
    return NextResponse.json({
      success: true,
      data: r.sent ? { sent: true, expiresInSeconds: r.expiresInSeconds } : { sent: false, alreadyLinked: true },
    });
  } catch (err) {
    console.error("[BOT/EMAIL/START] error:", err);
    return linkErrorResponse({ status: 500, code: "INTERNAL", error: "Internal error" });
  }
}
