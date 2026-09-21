/**
 * Собрать письмо о подарке и положить рядом файлом, ничего не отправляя.
 *
 * Нужен, потому что письмо нельзя проверить в браузере обычным способом:
 * оно не страница сайта, у него своя разметка (таблицы ради Outlook) и
 * два языка. Запуск:
 *
 *   npx tsx scripts/preview-gift-email.ts
 *
 * Кладёт `/tmp/gift-ru.html` и `/tmp/gift-en.html`.
 */
import { writeFileSync } from "fs";
import { renderGiftEmail } from "../src/lib/email";
import { DEVICE_LIMIT } from "../src/lib/plans";
import { COUNTRY_COUNT } from "../src/lib/locations";

const until = new Date("2026-09-28T12:00:00Z");
for (const locale of ["ru", "en"] as const) {
  const { subject, html } = renderGiftEmail({
    email: "person@example.com",
    minutes: 7 * 24 * 60,
    until,
    dashboardUrl: "https://qodev.dev/dashboard",
    locale,
    devices: DEVICE_LIMIT,
    countries: COUNTRY_COUNT,
  });
  const path = `/tmp/gift-${locale}.html`;
  writeFileSync(path, html);
  console.log(locale, "→", path, "| тема:", subject);
}
