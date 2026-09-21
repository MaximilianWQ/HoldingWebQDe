/**
 * Ссылки и подписи корпуса Atlas Secure VPS — единственный источник для
 * шапки, меню и подвала (структура сайта — src/lib/nav.ts).
 *
 * ПОДПИСЕЙ ЗДЕСЬ БОЛЬШЕ НЕТ (21.09.2026, английская версия сайта).
 * Раздел описывается ключом и адресом; слово берётся из словаря
 * (`src/i18n`). Иначе у нас было бы два списка разделов — русский и
 * английский, — и новый раздел неизбежно появился бы в одном.
 *
 * Разворачивает ключи в слова `labelAll()` — на сервере, где язык
 * запроса уже известен. В браузер уезжают готовые подписи, а не оба
 * словаря.
 */
import type { Dict } from "@/i18n";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import { APPS, STORE as APP_STORE } from "@/lib/apps";

export const BRAND = "Atlas Secure VPS";

/**
 * Срок пробного периода словами, по-русски.
 *
 * Остаётся для страниц, которые ещё не переведены: они набраны
 * по-русски целиком, и подсовывать им английское «3 days» было бы
 * хуже, чем оставить как есть. Переведённая страница берёт срок через
 * `count(locale, TRIAL_DAYS, d.units.day)`.
 */
export const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;

/** Ключ подписи в словаре: `links.vds` и так далее. */
export type LinkKey = keyof Dict["links"];

/** Раздел до перевода: ключ и адрес. */
export interface VLink { k: LinkKey; href: string }
/** Раздел после перевода: то, что рисует компонент. */
export interface VItem { label: string; href: string }

export function labelAll(d: Dict, list: VLink[]): VItem[] {
  return list.map((l) => ({ label: d.links[l.k], href: l.href }));
}

/** Шапка на широком экране. */
export const HEAD_LINKS: VLink[] = [
  { k: "home", href: "/" },
  { k: "pricing", href: "/pricing" },
  { k: "devices", href: "/devices" },
  { k: "vds", href: "/vds" },
  { k: "support", href: "/support" },
];

/**
 * Шапка на рабочих экранах (кабинет, оплата, новое устройство).
 *
 * «Главной» здесь нет намеренно (владелец, 20.09.2026: «нажимаю
 * „Главная“, а он не уходит»). Причина была не в ссылке: главная
 * принудительно возвращает вошедшего человека в кабинет
 * (`src/app/page.tsx`), поэтому нажатие выглядело как зависшее. Вместо
 * того чтобы чинить симптом, у кабинета теперь свой островок — из
 * разделов, куда вошедшему действительно есть смысл идти.
 */
export const WORK_HEAD_LINKS: VLink[] = [
  { k: "pricing", href: "/pricing" },
  { k: "devices", href: "/devices" },
  { k: "vds", href: "/vds" },
  { k: "support", href: "/support" },
];

/** Меню на телефоне. */
export const MENU_LINKS: VLink[] = [
  { k: "home", href: "/" },
  { k: "pricing", href: "/pricing" },
  { k: "traffic", href: "/pricing#traffic" },
  { k: "guides", href: "/devices" },
  { k: "vds", href: "/vds" },
  { k: "business", href: "/business" },
  { k: "support", href: "/support" },
  { k: "careers", href: "/careers" },
  { k: "contact", href: "/contact" },
];

/** Разделы, которых нет ни в шапке, ни в меню телефона. */
export const EXTRA_SECTIONS: VLink[] = [
  { k: "infrastructure", href: "/infrastructure" },
  { k: "about", href: "/about" },
  { k: "security", href: "/security" },
];

/**
 * Раздел, открытый сейчас, — для шапки. В её узком списке нет ни
 * «Вакансий», ни «Инфраструктуры», ни «О компании», и на этих
 * страницах бар показывал пустую дорожку: человек не понимал, где он
 * (владелец, 19.09.2026: «бар должен корректно отображаться под
 * конкретный экран»). Если открытого раздела в шапке нет — он
 * добавляется в неё отдельным пунктом.
 *
 * Работает уже с переведённым списком: путь сравнивается с адресом, а
 * адрес от языка не зависит (префикс `/en` снимается до сравнения —
 * см. `VHeader`).
 */
export function currentSection(pathname: string, all: VItem[], head: VItem[]): VItem | null {
  const hit = all.find((l) => l.href === pathname);
  if (!hit) return null;
  return head.some((l) => l.href === pathname) ? null : hit;
}

export interface VLinkGroup { title: keyof Dict["groups"]; links: VLink[] }

/**
 * Подвал — четыре группы ссылок (владелец, 18.09.2026: «низ сайта как в
 * прошлой версии»). Состав повторяет FOOTER_COLUMNS прежнего корпуса,
 * плюс то, что появилось после него: пакеты трафика и приложения.
 */
export const FOOT_LINKS: VLinkGroup[] = [
  {
    title: "product",
    links: [
      { k: "pricing", href: "/pricing" },
      { k: "traffic", href: "/pricing#traffic" },
      { k: "devicesApps", href: "/devices" },
      { k: "vds", href: "/vds" },
    ],
  },
  {
    title: "help",
    links: [
      { k: "support", href: "/support" },
      { k: "faq", href: "/support#faq" },
      { k: "installIos", href: "/install-ios" },
      { k: "contact", href: "/contact" },
    ],
  },
  {
    title: "company",
    links: [
      { k: "about", href: "/about" },
      { k: "infrastructure", href: "/infrastructure" },
      { k: "careers", href: "/careers" },
      { k: "security", href: "/security" },
      { k: "business", href: "/business" },
    ],
  },
  {
    title: "docs",
    links: [
      { k: "termsFull", href: "/terms" },
      { k: "privacyFull", href: "/privacy" },
    ],
  },
];

/** Правовые ссылки отдельной строкой внизу подвала. */
export const LEGAL: VLink[] = [
  { k: "terms", href: "/terms" },
  { k: "privacy", href: "/privacy" },
];

/** Поддержка — адреса берём из единственного источника. */
export { TELEGRAM_SUPPORT as SUPPORT_TG, SUPPORT_DESK } from "@/lib/contacts";

/** Имена клиентов для подписи в подвале — из единого источника приложений. */
export const FOOT_APPS = APPS.ios.map((a) => a.name).join(", ");

/** Значки магазинов на витрине (Happ) — из единого списка src/lib/apps.ts. */
export const STORE = {
  appStore: APP_STORE.happIosRu,
  googlePlay: APP_STORE.happAndroid,
  windows: APP_STORE.happWindowsX64,
};
