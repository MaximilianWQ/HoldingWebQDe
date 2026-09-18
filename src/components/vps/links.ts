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
  { label: "Вакансии", href: "/careers" },
  { label: "Контакты", href: "/contact" },
];

export interface VLinkGroup { title: string; links: VLink[] }

/**
 * Подвал — четыре группы ссылок (владелец, 18.09.2026: «низ сайта как в
 * прошлой версии»). Состав повторяет FOOTER_COLUMNS прежнего корпуса,
 * плюс то, что появилось после него: пакеты трафика и приложения.
 */
export const FOOT_LINKS: VLinkGroup[] = [
  {
    title: "Продукт",
    links: [
      { label: "Тарифы", href: "/pricing" },
      { label: "Пакеты трафика", href: "/pricing#traffic" },
      { label: "Устройства и приложения", href: "/devices" },
      { label: "Выделенные серверы", href: "/vds" },
    ],
  },
  {
    title: "Помощь",
    links: [
      { label: "Поддержка", href: "/support" },
      { label: "Частые вопросы", href: "/support#faq" },
      { label: "Установка на iPhone", href: "/install-ios" },
      { label: "Контакты", href: "/contact" },
    ],
  },
  {
    title: "Компания",
    links: [
      { label: "О компании", href: "/about" },
      { label: "Инфраструктура", href: "/infrastructure" },
      { label: "Вакансии", href: "/careers" },
      { label: "Безопасность", href: "/security" },
      { label: "Для бизнеса", href: "/business" },
    ],
  },
  {
    title: "Документы",
    links: [
      { label: "Пользовательское соглашение", href: "/terms" },
      { label: "Политика конфиденциальности", href: "/privacy" },
    ],
  },
];

/** Правовые ссылки отдельной строкой внизу подвала. */
export const LEGAL: VLink[] = [
  { label: "Соглашение", href: "/terms" },
  { label: "Конфиденциальность", href: "/privacy" },
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
