import { NextRequest, NextResponse } from "next/server";
import { isUnsubscribeTokenShape, unsubscribeByToken } from "@/lib/unsubscribe";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";
import { createAuditLog } from "@/lib/store";

/**
 * POST /api/unsubscribe — отписка от рекламных писем по токену из письма.
 *
 *   ?t=<токен>                  one-click почтового клиента (RFC 8058:
 *                               тело List-Unsubscribe=One-Click, без cookie);
 *   { token } / t=<токен>       кнопка на странице /unsubscribe.
 *
 * Действует на рекламные письма; служебные (начисления, условия) идут
 * всем. Повторная отписка — успех (already: true). GET ничего не меняет:
 * почтовые сканеры открывают ссылки сами — GET ведёт на страницу с кнопкой.
 */
async function tokenFrom(request: NextRequest): Promise<string | null> {
  const q = request.nextUrl.searchParams.get("t");
  if (q) return q;
  const type = request.headers.get("content-type") || "";
  try {
    if (type.includes("application/json")) {
      const b = await request.json();
      return typeof b?.token === "string" ? b.token : typeof b?.t === "string" ? b.t : null;
    }
    if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
      const f = await request.formData();
      const t = f.get("t") ?? f.get("token");
      return typeof t === "string" ? t : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(`unsubscribe:${clientIpKey(request.headers)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Слишком много запросов. Повторите через минуту." }, { status: 429 });
  }
  const token = await tokenFrom(request);
  if (!isUnsubscribeTokenShape(token)) {
    return NextResponse.json({ success: false, error: "Ссылка недействительна" }, { status: 400 });
  }
  try {
    const r = await unsubscribeByToken(token);
    if (!r.ok) return NextResponse.json({ success: false, error: "Ссылка недействительна или устарела" }, { status: 404 });
    if (!r.already) await createAuditLog("user.marketing_opt_out", "Отписка от рекламных писем по ссылке из письма", r.userId, r.email);
    return NextResponse.json({ success: true, data: { already: r.already } });
  } catch (err) {
    console.error("[UNSUBSCRIBE] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Не получилось. Попробуйте ещё раз." }, { status: 500 });
  }
}

export function GET(request: NextRequest) {
  const t = request.nextUrl.searchParams.get("t") ?? "";
  const url = new URL("/unsubscribe", request.nextUrl.origin);
  if (t) url.searchParams.set("t", t);
  return NextResponse.redirect(url, 303);
}
