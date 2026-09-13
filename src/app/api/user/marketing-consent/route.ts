import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { pool } from "@/lib/db";
import { getMarketingConsent, setMarketingConsent } from "@/lib/consent";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/store";

/**
 * Согласие на новости и специальные предложения (переключатель
 * «Получать новости и предложения» в кабинете — подключит владелец).
 *
 *   GET  → { on, consentAt, optOutAt }
 *   POST { on: boolean } → { on, changed }
 *
 * Рекламные рассылки уходят только при on = true (src/lib/consent.ts).
 */
export async function GET(request: NextRequest) {
  const su = await getSessionUser(request);
  if (!su) return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
  const c = await getMarketingConsent(pool, su.user.id);
  if (!c) return NextResponse.json({ success: false, error: "Пользователь не найден" }, { status: 404 });
  return NextResponse.json({ success: true, data: c });
}

export async function POST(request: NextRequest) {
  const su = await getSessionUser(request);
  if (!su) return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
  const rl = checkRateLimit(`marketing-consent:${su.user.id}`, 10, 60_000);
  if (!rl.allowed) return NextResponse.json({ success: false, error: `Слишком часто. Повторите через ${rl.retryAfterSeconds} сек.` }, { status: 429 });
  let on: unknown;
  try {
    on = (await request.json())?.on;
  } catch {
    on = undefined;
  }
  if (typeof on !== "boolean") return NextResponse.json({ success: false, error: "Укажите on: true или false" }, { status: 400 });
  try {
    const r = await setMarketingConsent(pool, su.user.id, on, "dashboard");
    if (r.changed) {
      await createAuditLog(on ? "user.marketing_consent_on" : "user.marketing_consent_off", on ? "Согласие на новости в кабинете" : "Отказ от новостей в кабинете", su.user.id, su.user.email);
    }
    return NextResponse.json({ success: true, data: { on, changed: r.changed } });
  } catch (err) {
    console.error("[MARKETING-CONSENT] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Не удалось сохранить" }, { status: 500 });
  }
}
