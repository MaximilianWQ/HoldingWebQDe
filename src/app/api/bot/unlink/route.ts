import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId } from "@/lib/store";
import { unlinkTelegramAccount, type UnlinkKeep } from "@/lib/telegram-link";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";

/**
 * POST /api/bot/unlink { telegramId, keep?: "site" | "bot" }
 *
 * Отвязка Telegram от аккаунта сайта. `keep` — где остаётся подписка
 * (ТЗ, разделы 16–17; решение владельца 20.09.2026):
 *
 *   "site" (умолчание, прежнее поведение) — ключ остаётся за аккаунтом
 *          сайта, с сущности снимается Telegram ID и ставится маркер
 *          atlas-unlinked. Бот после этого считает человека
 *          непривязанным и забирать ключ обратно не должен.
 *   "bot"  — ключ возвращается боту: маркер atlas-site снят, Telegram ID
 *          на сущности сохранён, аккаунт сайта остался без подписки.
 *
 * Умолчание — прежнее поведение, поэтому старые вызовы без `keep` не
 * ломаются.
 *
 * КЛЮЧ НЕ МЕНЯЕТСЯ НИ В ОДНОМ ИЗ ВАРИАНТОВ. Меняется только то, кто
 * ведёт срок и куда человек платит; настроенное приложение продолжает
 * работать. Бонус +7 не выплачивается повторно ни при каком выборе.
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json().catch(() => null);
    const telegramId = body?.telegramId != null ? String(body.telegramId).trim() : "";
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "telegramId required" }, { status: 400 });
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found or not linked", code: "NOT_LINKED" }, { status: 404 });
    }
    const rawKeep = body?.keep;
    if (rawKeep !== undefined && rawKeep !== "site" && rawKeep !== "bot") {
      return NextResponse.json({ success: false, error: 'keep: "site" | "bot"', code: "VALIDATION" }, { status: 400 });
    }
    const keep: UnlinkKeep = rawKeep === "bot" ? "bot" : "site";

    const r = await unlinkTelegramAccount(user.id, "bot", keep);
    if (!r.ok) return NextResponse.json({ success: false, error: r.error, code: r.code }, { status: r.status });

    return NextResponse.json({
      success: true,
      data: {
        userId: r.user.id,
        email: r.user.email,
        unlinked: true,
        keep: r.keep,
        // Авторитетный срок на момент отвязки: при keep: "bot" его
        // забирает бот. Из своего зеркала он потерял бы дни, начисленные
        // сайтом после последнего опроса статуса.
        subscriptionEnd: r.subscriptionEnd,
        // Ключ, оставшийся у человека. Принимающая сторона сверяет его
        // с привязанным: разошлось — ключ в приложении умер (правило 17).
        subscriptionUrl: r.subscriptionUrl,
        // Снят ли маркер atlas-site. false → бот НЕ считает сущность
        // своей и не начинает её править.
        siteMarkerRemoved: r.siteMarkerRemoved,
        panelUserId: r.keep === "bot" ? (user.panelUserId ?? null) : r.user.panelUserId,
        keyStaysWithAccount: r.keep === "site",
      },
    });
  } catch (err) {
    console.error("[BOT] Unlink error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
