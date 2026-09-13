import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/store";
import { linkTelegramAccount, maskEmail } from "@/lib/telegram-link";
import { consumeLinkToken, lookupLinkToken, rotateLegacyLinkToken } from "@/lib/telegram-link-tokens";
import { clientIpFrom } from "@/lib/client-ip";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";
import { linkErrorResponse, linkSuccessData } from "../link-http";

/**
 * Site first: the dashboard issues a one-time token (15 min) and opens
 * the bot with `/start link_<token>`.
 *
 * GET  /api/bot/link?token=…  — preview for the confirmation screen:
 *      { valid, maskedEmail, kind: "one_time" | "legacy", expiresAt, telegramLinked }
 * POST /api/bot/link { token, telegramId, premiumPanelUserId? } — link
 *      (src/lib/telegram-link.ts). The token is consumed only by a
 *      successful link; a repeat by the same Telegram id is idempotent.
 *      Old permanent 16-hex tokens are accepted and rotated on use.
 *   404 TOKEN_INVALID · 410 TOKEN_EXPIRED | TOKEN_USED · 409 TELEGRAM_LINKED_OTHER | EMAIL_LINKED_OTHER
 *   503 PANEL_UNAVAILABLE | BUSY (retry, the token stays valid)
 */
export async function GET(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  try {
    const t = await lookupLinkToken(request.nextUrl.searchParams.get("token"));
    if (t.kind === "invalid") return linkErrorResponse({ status: 404, code: "TOKEN_INVALID", error: "Ссылка привязки недействительна" });
    if (t.kind === "expired") return linkErrorResponse({ status: 410, code: "TOKEN_EXPIRED", error: "Ссылка привязки устарела — получите новую в кабинете" });
    if (t.kind === "used") return linkErrorResponse({ status: 410, code: "TOKEN_USED", error: "Ссылка привязки уже использована" });
    const user = await getUserById(t.userId);
    if (!user) return linkErrorResponse({ status: 404, code: "TOKEN_INVALID", error: "Ссылка привязки недействительна" });
    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        kind: t.kind,
        maskedEmail: maskEmail(user.email),
        expiresAt: t.kind === "one_time" ? t.expiresAt.toISOString() : null,
        telegramLinked: !!user.telegramId,
      },
    });
  } catch (err) {
    console.error("[BOT/LINK] preview error:", err);
    return linkErrorResponse({ status: 500, code: "INTERNAL", error: "Internal error" });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json().catch(() => null);
    const token = body?.token;
    const telegramId = body?.telegramId != null ? String(body.telegramId).trim() : "";
    if (!token || !telegramId) return linkErrorResponse({ status: 400, code: "VALIDATION", error: "token and telegramId required" });
    const hint = body.premiumPanelUserId == null || body.premiumPanelUserId === "" ? null : Number(body.premiumPanelUserId);
    if (hint !== null && (!Number.isSafeInteger(hint) || hint <= 0)) return linkErrorResponse({ status: 400, code: "VALIDATION", error: "premiumPanelUserId: целое число" });

    const t = await lookupLinkToken(token);
    if (t.kind === "invalid") return linkErrorResponse({ status: 404, code: "TOKEN_INVALID", error: "Ссылка привязки недействительна" });
    if (t.kind === "expired") return linkErrorResponse({ status: 410, code: "TOKEN_EXPIRED", error: "Ссылка привязки устарела — получите новую в кабинете" });
    if (t.kind === "used" && t.usedByTelegramId !== telegramId) {
      return linkErrorResponse({ status: 410, code: "TOKEN_USED", error: "Ссылка привязки уже использована" });
    }

    const via = t.kind === "legacy" ? "legacy_token" : "site_token";
    const r = await linkTelegramAccount({ telegramId, userId: t.userId, via, premiumPanelUserId: hint, ip: clientIpFrom(request.headers) });
    if (!r.ok) return linkErrorResponse(r);

    if (t.kind === "one_time") await consumeLinkToken(t.hash, telegramId);
    if (t.kind === "legacy") await rotateLegacyLinkToken(t.userId, t.token);
    return NextResponse.json({ success: true, data: linkSuccessData(r) });
  } catch (err) {
    console.error("[BOT/LINK] error:", err);
    return linkErrorResponse({ status: 500, code: "INTERNAL", error: "Internal error" });
  }
}
