import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, LOCALES, LOCALE_HEADER, LOCALE_PARAM, PATH_HEADER } from "@/lib/locale";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * script-src keeps 'unsafe-inline': the App Router streams its payload
 * through inline <script> tags, and the only alternative — a per-request
 * nonce — would force every page to render dynamically. 'unsafe-eval' is
 * needed only by the dev server (React Refresh / source maps); the
 * production build does not use eval, so it is dropped there.
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://api.yookassa.ru",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ") + ";";

/**
 * Язык из адреса (21.09.2026). Русский живёт в корне, английский — под
 * префиксом `/en`. Здесь префикс срезается, а язык уезжает дальше
 * заголовком `x-locale`: страницы читают его через `getLocale()`.
 *
 * Маршруты API не трогаются: у них нет языка, они отдают данные.
 */
function localeFrom(pathname: string): { locale: string; rest: string } | null {
  for (const l of LOCALES) {
    if (l === DEFAULT_LOCALE) continue;
    if (pathname === `/${l}`) return { locale: l, rest: "/" };
    if (pathname.startsWith(`/${l}/`)) return { locale: l, rest: pathname.slice(l.length + 1) };
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hit = pathname.startsWith("/api/") ? null : localeFrom(pathname);
  const locale = hit?.locale ?? DEFAULT_LOCALE;
  // Язык уезжает дальше заголовком запроса: страницы читают его через
  // `getLocale()`. Префикс `/en` при этом из адреса срезается — файлов
  // маршрутов у английской версии своих нет.
  const forwarded = new Headers(request.headers);
  forwarded.set(LOCALE_HEADER, locale);
  // Путь без префикса языка — корневому layout, чтобы он объявил обе
  // версии страницы поисковику. Заголовок запроса, а не ответа: его
  // читает серверный рендер, наружу он не уходит.
  forwarded.set(PATH_HEADER, hit ? hit.rest : pathname);

  // Security headers for every route. (The legacy Xray /api/sub/* CORS
  // branch is gone together with the route — subscriptions are served
  // by the Remnawave panel on its own domain.)
  // Адрес назначения помечается языком. Без метки `/en/pricing` и
  // `/pricing` — один маршрут, и клиентский роутер Next не считал
  // переход переходом: адрес в строке менялся, страница оставалась
  // русской (замер 21.09.2026). В адресной строке метки не видно —
  // перезапись адрес не меняет.
  let response: NextResponse;
  if (hit) {
    const dest = new URL(hit.rest, request.url);
    dest.search = request.nextUrl.search;
    dest.searchParams.set(LOCALE_PARAM, hit.locale);
    response = NextResponse.rewrite(dest, { request: { headers: forwarded } });
  } else {
    response = NextResponse.next({ request: { headers: forwarded } });
  }

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer policy — don't leak full URL to third parties
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // The legacy XSS auditor is itself exploitable; modern guidance is to turn it off.
  response.headers.set("X-XSS-Protection", "0");
  // Permissions policy — disable unnecessary browser features
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()");
  // No cross-origin window may keep a handle on ours (tab-nabbing, XS-leaks).
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // HTTPS only (production). Subdomains are not included on purpose: not
  // every *.qodev.dev host is known to serve HTTPS.
  if (isProd) response.headers.set("Strict-Transport-Security", "max-age=31536000");
  // Content Security Policy
  response.headers.set("Content-Security-Policy", CSP);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
