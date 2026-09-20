import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getBypassForUser } from "@/lib/bypass";
import { getOwedBypassBytes } from "@/lib/bypass-grants";
import { getUserById } from "@/lib/store";

/**
 * GET /api/user/bypass — key 2 («Обход») live: remaining / used / limit.
 *
 * Fetched by the cabinet, /devices and /add-device AFTER the first
 * render (GET /api/user/subscription stays DB-only). The panel is asked
 * with a 2.5 s timeout and a 30 s cache (bypass.ts); when it does not
 * answer, `state: "unavailable"` and the cached link from the DB — the
 * page keeps the key usable and just hides the numbers.
 *
 *   state "ok"           entity read: numbers + link
 *   state "none"         the person has no bypass entity (yet)
 *   state "unavailable"  the panel did not answer in time
 */
export async function GET(request: NextRequest) {
  const auth = await getSessionUser(request);
  if (!auth) return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
  const user = auth.user;
  try {
    const [snap, owedBytes] = await Promise.all([
      // `panelUserId` в условии — тот самый живой случай 20.09.2026:
      // аккаунт связан, но `telegram_id` в строке пуст, и обход раньше
      // не искался вовсе. Теперь Telegram ID берётся с премиум-ключа.
      user.bypassPanelUserId || user.telegramId || user.panelUserId
        ? getBypassForUser(user, { timeoutMs: 2_500 }).catch(() => null)
        : Promise.resolve(null),
      getOwedBypassBytes(user.id).catch(() => 0),
    ]);
    // A linked account may have just had its bot bypass remembered.
    const fresh = snap && !user.bypassPanelUserId ? await getUserById(user.id) : user;
    const known = !!(fresh?.bypassPanelUserId ?? user.bypassPanelUserId);
    const origin = known ? ((fresh ?? user).bypassOrigin === "site" ? "site" : "bot") : null;
    const state = snap ? "ok" : known ? "unavailable" : "none";
    return NextResponse.json({
      success: true,
      data: {
        state,
        origin,
        subscriptionUrl: snap?.subscriptionUrl ?? (known ? (fresh ?? user).bypassSubscriptionUrl : null),
        limitBytes: snap?.limitBytes ?? null,
        usedBytes: snap?.usedBytes ?? null,
        remainingBytes: snap?.remainingBytes ?? null,
        unlimited: snap?.unlimited ?? false,
        status: snap?.status ?? null,
        owedBytes,
      },
    });
  } catch (err) {
    console.error("[USER/BYPASS] error:", err);
    return NextResponse.json({ success: false, error: "Не удалось получить остаток трафика" }, { status: 500 });
  }
}
