import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { unlinkTelegramAccount, type UnlinkKeep } from "@/lib/telegram-link";

/**
 * POST /api/user/telegram-unlink { keep?: "site" | "bot" } — отвязка из
 * кабинета. Тот же выбор, что и в боте (ТЗ 16–17): подписка остаётся
 * на сайте или возвращается боту.
 *
 * Умолчание здесь — `"site"`: человек стоит в кабинете, и ключ его
 * стороны — сайтовый. Бонус +7 на повторной привязке не платится ни
 * при каком выборе.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const rawKeep = body?.keep;
    if (rawKeep !== undefined && rawKeep !== "site" && rawKeep !== "bot") {
      return NextResponse.json({ success: false, error: "Неизвестный выбор" }, { status: 400 });
    }
    const keep: UnlinkKeep = rawKeep === "bot" ? "bot" : "site";

    const r = await unlinkTelegramAccount(auth.user.id, "site", keep);
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status === 503 ? 503 : 400 });
    // Постоянный токен привязки наружу не отдаём (аудит 19.09.2026):
    // новая привязка идёт одноразовым токеном.
    return NextResponse.json({ success: true, data: { unlinked: true, keep: r.keep } });
  } catch (err) {
    console.error("[USER/TELEGRAM-UNLINK] error:", err);
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
