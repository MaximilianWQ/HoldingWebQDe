import type { NextConfig } from "next";

/**
 * Домены, с которых разрешены server actions (вход по коду).
 *
 * Next сверяет заголовок Origin с x-forwarded-host / host и при
 * расхождении отклоняет действие («Invalid Server Actions request»,
 * код E80) — страница падает в «This page couldn't load». За прокси
 * Railway и на своих доменах эти заголовки расходятся, поэтому
 * перечисляем свои домены явно. Дополнительные — через
 * SERVER_ACTIONS_ALLOWED_ORIGINS (хосты через запятую).
 */
const hostOf = (url?: string) => {
  try {
    return url ? new URL(url).host : undefined;
  } catch {
    return undefined;
  }
};

const allowedOrigins = [
  // Боевой домен сайта (Railway), 12.09.2026.
  "qodev.dev",
  "*.qodev.dev",
  "atlassecure.uk",
  "*.atlassecure.uk",
  "atlassecure.ru",
  "*.atlassecure.ru",
  // `*.up.railway.app` здесь стоять не должно (аудит безопасности
  // 19.09.2026). Этот домен общий: адрес вида `чужое-приложение.up
  // .railway.app` получает любой, кто зарегистрировался в Railway, и
  // список доверенных источников впускал бы их страницы к нашим
  // server actions. Свой адрес Railway приходит переменной
  // RAILWAY_PUBLIC_DOMAIN и уже перечислен ниже — именно он, а не
  // весь домен провайдера.
  hostOf(process.env.NEXT_PUBLIC_SITE_URL),
  hostOf(process.env.NEXT_PUBLIC_APP_URL),
  process.env.RAILWAY_PUBLIC_DOMAIN,
  ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()),
].filter((s): s is string => !!s);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // No "X-Powered-By: Next.js" — do not advertise the stack and version.
  poweredByHeader: false,
  experimental: {
    serverActions: { allowedOrigins },
  },
  async rewrites() {
    return [
      {
        source: "/favicon.ico",
        destination: "/icon",
      },
    ];
  },
  async headers() {
    // Files in public/ are not content-hashed, so a week + SWR rather than
    // a year + immutable. _next/static is left to Next (already immutable).
    // Security headers (CSP, HSTS, …) stay in src/middleware.ts.
    const assetCache = { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" };
    return [
      { source: "/media/:path*", headers: [assetCache] },
      { source: "/fonts/:path*", headers: [assetCache] },
    ];
  },
};

export default nextConfig;
