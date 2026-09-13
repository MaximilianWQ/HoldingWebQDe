import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId } from "@/lib/store";
import { linkTelegramAccount } from "@/lib/telegram-link";
import { clientIpFrom } from "@/lib/client-ip";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";
import { linkErrorResponse, linkSuccessData } from "../link-http";

/**
 * POST /api/bot/relink { telegramId, premiumPanelUserId? }
 *
 * Migration of people linked BEFORE 13.09.2026 (two live keys: the
 * site's ST one and the bot's tg_{id}_premium). Only for a Telegram id
 * that is ALREADY linked: it re-runs the same idempotent merge as a new
 * link (the longer term wins, the other key is DISABLED). It never
 * links anything new and never changes the email. Safe to repeat.
 *   200 — as /api/bot/link · 404 NOT_LINKED · 503 PANEL_UNAVAILABLE | BUSY
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json().catch(() => null);
    const telegramId = body?.telegramId != null ? String(body.telegramId).trim() : "";
    if (!telegramId) return linkErrorResponse({ status: 400, code: "VALIDATION", error: "telegramId required" });
    const hint = body.premiumPanelUserId == null || body.premiumPanelUserId === "" ? null : Number(body.premiumPanelUserId);
    if (hint !== null && (!Number.isSafeInteger(hint) || hint <= 0)) return linkErrorResponse({ status: 400, code: "VALIDATION", error: "premiumPanelUserId: целое число" });

    const user = await getUserByTelegramId(telegramId);
    if (!user) return linkErrorResponse({ status: 404, code: "NOT_LINKED", error: "Telegram не связан с аккаунтом сайта" });
    const r = await linkTelegramAccount({ telegramId, userId: user.id, via: "relink", premiumPanelUserId: hint, ip: clientIpFrom(request.headers) });
    if (!r.ok) return linkErrorResponse(r);
    return NextResponse.json({ success: true, data: linkSuccessData(r) });
  } catch (err) {
    console.error("[BOT/RELINK] error:", err);
    return linkErrorResponse({ status: 500, code: "INTERNAL", error: "Internal error" });
  }
}
