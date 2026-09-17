/**
 * Ссылки и подписи корпуса Atlas Secure VPS — единственный источник для
 * шапки, меню и подвала (структура сайта — src/lib/nav.ts).
 */
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";

export const BRAND = "Atlas Secure VPS";
export const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;

export interface VLink { label: string; href: string }

/** Шапка на широком экране. */
export const HEAD_LINKS: VLink[] = [
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

/** Подвал. */
export const FOOT_LINKS: VLink[] = [
  { label: "Поддержка", href: "/support" },
  { label: "Инструкции", href: "/devices" },
  { label: "Тарифы", href: "/pricing" },
  { label: "Часто задаваемые вопросы", href: "/support#faq" },
  { label: "Выделенные серверы", href: "/vds" },
  { label: "Для бизнеса", href: "/business" },
  { label: "О компании", href: "/about" },
  { label: "Безопасность", href: "/security" },
  { label: "Контакты", href: "/contact" },
  { label: "Политика конфиденциальности", href: "/privacy" },
  { label: "Пользовательское соглашение", href: "/terms" },
];

/** Приложение Happ — те же ссылки, что в инструкциях (DevicesView.tsx). */
export const STORE = {
  appStore: "https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973",
  googlePlay: "https://play.google.com/store/apps/details?id=com.happproxy",
  windows: "https://www.happ.su/main",
};
