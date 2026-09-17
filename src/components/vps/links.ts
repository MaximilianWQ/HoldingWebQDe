/**
 * Ссылки и подписи корпуса Atlas Secure VPS — единственный источник для
 * шапки, меню и подвала (структура сайта — src/lib/nav.ts).
 */
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import { APPS, STORE as APP_STORE } from "@/lib/apps";

export const BRAND = "Atlas Secure VPS";
export const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;

export interface VLink { label: string; href: string }

/** Шапка на широком экране. */
export const HEAD_LINKS: VLink[] = [
  { label: "Главная", href: "/" },
  { label: "Тарифы", href: "/pricing" },
  { label: "Устройства", href: "/devices" },
  { label: "Выделенные серверы", href: "/vds" },
  { label: "Поддержка", href: "/support" },
];

/** Меню на телефоне. */
export const MENU_LINKS: VLink[] = [
  { label: "Главная", href: "/" },
  { label: "Тарифы", href: "/pricing" },
  { label: "Пакеты трафика", href: "/pricing#traffic" },
  { label: "Инструкции", href: "/devices" },
  { label: "Выделенные серверы", href: "/vds" },
  { label: "Для бизнеса", href: "/business" },
  { label: "Поддержка", href: "/support" },
  { label: "Контакты", href: "/contact" },
];

export interface VLinkGroup { title: string; links: VLink[] }

/** Подвал — три группы ссылок (владелец, 17.09.2026: «богаче»). */
export const FOOT_LINKS: VLinkGroup[] = [
  {
    title: "Продукт",
    links: [
      { label: "Тарифы", href: "/pricing" },
      { label: "Пакеты трафика", href: "/pricing#traffic" },
      { label: "Инструкции", href: "/devices" },
      { label: "Выделенные серверы", href: "/vds" },
      { label: "Для бизнеса", href: "/business" },
    ],
  },
  {
    title: "Помощь",
    links: [
      { label: "Поддержка", href: "/support" },
      { label: "Частые вопросы", href: "/support#faq" },
      { label: "Контакты", href: "/contact" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "О компании", href: "/about" },
      { label: "Безопасность", href: "/security" },
      { label: "Политика конфиденциальности", href: "/privacy" },
      { label: "Пользовательское соглашение", href: "/terms" },
    ],
  },
];

/** Имена клиентов для подписи в подвале — из единого источника приложений. */
export const FOOT_APPS = APPS.ios.map((a) => a.name).join(", ");

/** Значки магазинов на витрине (Happ) — из единого списка src/lib/apps.ts. */
export const STORE = {
  appStore: APP_STORE.happIosRu,
  googlePlay: APP_STORE.happAndroid,
  windows: APP_STORE.happWindowsX64,
};
