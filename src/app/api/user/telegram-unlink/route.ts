import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { unlinkTelegramAccount } from "@/lib/telegram-link";

/**
 * POST /api/user/telegram-unlink — unlink from the dashboard. The
 * subscription and the key stay with this account (same rule as
 * /api/bot/unlink); the bonus is not paid again on a relink.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
    }
    const r = await unlinkTelegramAccount(auth.user.id, "site");
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 400 });
    // Постоянный токен привязки наружу не отдаём (аудит 19.09.2026):
    // новая привязка идёт одноразовым токеном.
    return NextResponse.json({ success: true, data: { unlinked: true } });
  } catch (err) {
    console.error("[USER/TELEGRAM-UNLINK] error:", err);
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
