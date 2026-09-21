/**
 * Приложения для подключения — единственный источник ссылок на магазины,
 * установщики и открытие подписки в приложении. Используют /devices,
 * /add-device, кабинет и главная.
 *
 * Проверено 17.09.2026:
 * - Happ iOS/macOS: App Store Россия — id6788279553 (ссылка владельца),
 *   другие страны — id6504287215 (Flyfrog LLC, v5.8.0).
 * - Happ Android / Android TV: Google Play com.happproxy.
 * - Happ Windows / macOS (установщик): github.com/Happ-proxy/happ-desktop,
 *   releases/latest/download/<файл> (v4.2.1: setup-Happ.x64.exe,
 *   setup-Happ.arm64.exe, Happ.macOS.universal.dmg).
 * - Incy iOS/iPadOS/macOS/tvOS: App Store id6756943388 (LLC ITDEV, v2.6.1),
 *   один идентификатор для России и других стран.
 * - Incy Android / Android TV: Google Play llc.itdev.incy (ссылка с incy.cc).
 * - Incy Windows / macOS (установщик): github.com/INCY-DEV/incy-platforms,
 *   releases/latest/download/<файл> (desktop-v3.8.6: incy-windows-portable.zip,
 *   incy-macos-arm64.dmg, incy-macos-intel.dmg).
 *
 * Открытие подписки в приложении — через страницу-переход бота
 * api.atlassecure.ru/open/{happ|incy|v2raytun}: Telegram и часть
 * браузеров блокируют схемы happ:// и incy://, страница открывает их сама
 * и показывает запасной вариант.
 */

import type { Locale } from "./locale";

/**
 * Значение на двух языках (21.09.2026).
 *
 * Подпись приложения и его шаги неотделимы от самого приложения:
 * добавится клиент — его придётся описать обоими языками в одном
 * месте. Поля обязательные, поэтому забыть перевод нельзя: новый
 * клиент без английского описания не соберётся.
 */
export interface L<T = string> { ru: T; en: T }
export function pick<T>(v: L<T>, locale: Locale): T {
  return v[locale];
}

export type Platform = "ios" | "android" | "macos" | "windows" | "tv";
export type AppId = "happ" | "incy" | "v2raytun";

export interface AppLink {
  /** Подпись кнопки: «App Store · Россия», «Google Play», «Скачать для Windows». */
  label: L;
  href: string;
  /** Вторичная ссылка (другой регион, другой процессор). */
  secondary?: boolean;
}

export interface ClientApp {
  id: AppId;
  name: string;
  /** Одна строка под названием. */
  note: L;
  links: AppLink[];
  /** Ссылка подписки нужна в формате JSON (Happ). */
  jsonFormat?: boolean;
  /** Кнопка «Открыть в приложении»; нет — только копирование и QR. */
  openUrl?: (subscriptionUrl: string) => string;
  /** Как добавить подписку вручную. */
  steps: L<string[]>;
}

export const STORE = {
  happIosRu: "https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6788279553",
  happIosGlobal: "https://apps.apple.com/us/app/happ-proxy-utility/id6504287215",
  happAndroid: "https://play.google.com/store/apps/details?id=com.happproxy",
  happWindowsX64: "https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.x64.exe",
  happWindowsArm64: "https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.arm64.exe",
  happMacDmg: "https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.macOS.universal.dmg",
  incyApple: "https://apps.apple.com/ru/app/incy/id6756943388",
  incyAppleGlobal: "https://apps.apple.com/us/app/incy/id6756943388",
  incyAndroid: "https://play.google.com/store/apps/details?id=llc.itdev.incy",
  incyWindows: "https://github.com/INCY-DEV/incy-platforms/releases/latest/download/incy-windows-portable.zip",
  incyMacArm: "https://github.com/INCY-DEV/incy-platforms/releases/latest/download/incy-macos-arm64.dmg",
  incyMacIntel: "https://github.com/INCY-DEV/incy-platforms/releases/latest/download/incy-macos-intel.dmg",
  incyReleases: "https://github.com/INCY-DEV/incy-platforms/releases",
  v2raytunAndroid: "https://play.google.com/store/apps/details?id=com.v2raytun.android",
} as const;

const OPEN_BASE = "https://api.atlassecure.ru/open";
const openVia = (client: AppId) => (url: string) => `${OPEN_BASE}/${client}?url=${encodeURIComponent(url)}`;

const HAPP_STEPS: L<string[]> = {
  ru: [
    "Откройте Happ и нажмите «+»",
    "Выберите «Добавить подписку» или «Из буфера обмена»",
    "Подписка добавится автоматически",
    "Нажмите кнопку подключения и разрешите добавить конфигурацию",
  ],
  en: [
    "Open Happ and tap “+”",
    "Choose “Add subscription” or “From clipboard”",
    "The subscription is added automatically",
    "Tap connect and allow the configuration to be added",
  ],
};
const INCY_STEPS: L<string[]> = {
  ru: [
    "Откройте Incy и нажмите «+»",
    "Выберите «Импорт из буфера обмена» или «Сканировать QR-код»",
    "Подписка добавится автоматически",
    "Выберите страну и нажмите кнопку подключения",
  ],
  en: [
    "Open Incy and tap “+”",
    "Choose “Import from clipboard” or “Scan QR code”",
    "The subscription is added automatically",
    "Pick a country and tap connect",
  ],
};
const DESKTOP_STEPS = (name: string): L<string[]> => ({
  ru: [
    `Установите и откройте ${name}`,
    "Нажмите «+» → «Добавить подписку» и вставьте ссылку",
    "Подписка добавится автоматически",
    "Нажмите подключиться и разрешите доступ, если система спросит",
  ],
  en: [
    `Install and open ${name}`,
    "Press “+” → “Add subscription” and paste the link",
    "The subscription is added automatically",
    "Press connect and allow access if the system asks",
  ],
});

export const APPS: Record<Platform, ClientApp[]> = {
  ios: [
    {
      id: "happ",
      name: "Happ",
      note: { ru: "Самый простой вариант для iPhone и iPad", en: "The simplest option for iPhone and iPad" },
      jsonFormat: true,
      openUrl: openVia("happ"),
      links: [
        { label: { ru: "App Store · Россия", en: "App Store · Russia" }, href: STORE.happIosRu },
        { label: { ru: "App Store · другие страны", en: "App Store · other countries" }, href: STORE.happIosGlobal, secondary: true },
      ],
      steps: HAPP_STEPS,
    },
    {
      id: "incy",
      name: "Incy",
      note: { ru: "Современный клиент с быстрым выбором страны", en: "A modern client with quick country switching" },
      openUrl: openVia("incy"),
      links: [{ label: { ru: "App Store", en: "App Store" }, href: STORE.incyApple }],
      steps: INCY_STEPS,
    },
  ],
  android: [
    {
      id: "happ",
      name: "Happ",
      note: { ru: "Самый простой вариант для Android", en: "The simplest option for Android" },
      jsonFormat: true,
      openUrl: openVia("happ"),
      links: [{ label: { ru: "Google Play", en: "Google Play" }, href: STORE.happAndroid }],
      steps: HAPP_STEPS,
    },
    {
      id: "incy",
      name: "Incy",
      note: { ru: "Современный клиент с быстрым выбором страны", en: "A modern client with quick country switching" },
      openUrl: openVia("incy"),
      links: [{ label: { ru: "Google Play", en: "Google Play" }, href: STORE.incyAndroid }],
      steps: INCY_STEPS,
    },
    {
      id: "v2raytun",
      name: "V2RayTun",
      note: { ru: "Лёгкий запасной клиент", en: "A lightweight backup client" },
      openUrl: openVia("v2raytun"),
      links: [{ label: { ru: "Google Play", en: "Google Play" }, href: STORE.v2raytunAndroid }],
      steps: {
        ru: [
          "Откройте V2RayTun и нажмите «+»",
          "Выберите «Импорт из буфера обмена»",
          "Сервер добавится автоматически",
          "Нажмите кнопку подключения и разрешите добавить конфигурацию",
        ],
        en: [
          "Open V2RayTun and tap “+”",
          "Choose “Import from clipboard”",
          "The server is added automatically",
          "Tap connect and allow the configuration to be added",
        ],
      },
    },
  ],
  macos: [
    {
      id: "happ",
      name: "Happ",
      note: { ru: "Для Mac на Apple Silicon и Intel", en: "For Macs on Apple Silicon and Intel" },
      jsonFormat: true,
      openUrl: openVia("happ"),
      links: [
        { label: { ru: "App Store · Россия", en: "App Store · Russia" }, href: STORE.happIosRu },
        { label: { ru: "App Store · другие страны", en: "App Store · other countries" }, href: STORE.happIosGlobal, secondary: true },
        { label: { ru: "Установщик .dmg", en: ".dmg installer" }, href: STORE.happMacDmg, secondary: true },
      ],
      steps: DESKTOP_STEPS("Happ"),
    },
    {
      id: "incy",
      name: "Incy",
      note: { ru: "Для Mac на Apple Silicon (M1 и новее)", en: "For Macs on Apple Silicon (M1 and newer)" },
      openUrl: openVia("incy"),
      links: [
        { label: { ru: "App Store", en: "App Store" }, href: STORE.incyApple },
        { label: { ru: ".dmg · Apple Silicon", en: ".dmg · Apple Silicon" }, href: STORE.incyMacArm, secondary: true },
        { label: { ru: ".dmg · Intel", en: ".dmg · Intel" }, href: STORE.incyMacIntel, secondary: true },
      ],
      steps: DESKTOP_STEPS("Incy"),
    },
  ],
  windows: [
    {
      id: "happ",
      name: "Happ",
      note: { ru: "Установщик для Windows 10 и 11", en: "Installer for Windows 10 and 11" },
      jsonFormat: true,
      links: [
        { label: { ru: "Скачать для Windows", en: "Download for Windows" }, href: STORE.happWindowsX64 },
        { label: { ru: "Windows на ARM", en: "Windows on ARM" }, href: STORE.happWindowsArm64, secondary: true },
      ],
      steps: DESKTOP_STEPS("Happ"),
    },
    {
      id: "incy",
      name: "Incy",
      note: { ru: "Портативная версия — без установки", en: "Portable version — no installation" },
      links: [
        { label: { ru: "Скачать для Windows", en: "Download for Windows" }, href: STORE.incyWindows },
        { label: { ru: "Все версии", en: "All releases" }, href: STORE.incyReleases, secondary: true },
      ],
      steps: {
        ru: [
          "Распакуйте архив и запустите Incy",
          "Нажмите «+» → «Импорт из буфера обмена» и вставьте ссылку",
          "Подписка добавится автоматически",
          "Нажмите подключиться и разрешите доступ, если система спросит",
        ],
        en: [
          "Unpack the archive and run Incy",
          "Press “+” → “Import from clipboard” and paste the link",
          "The subscription is added automatically",
          "Press connect and allow access if the system asks",
        ],
      },
    },
  ],
  tv: [
    {
      id: "happ",
      name: "Happ",
      note: { ru: "Для Android TV и Google TV", en: "For Android TV and Google TV" },
      jsonFormat: true,
      links: [{ label: { ru: "Google Play", en: "Google Play" }, href: STORE.happAndroid }],
      steps: {
        ru: [
          "Установите Happ из Google Play на телевизоре",
          "Нажмите «+» и отсканируйте QR-код с экрана телефона или компьютера",
          "Подписка добавится автоматически",
          "Выберите страну и нажмите подключиться пультом",
        ],
        en: [
          "Install Happ from Google Play on your TV",
          "Press “+” and scan the QR code from your phone or computer screen",
          "The subscription is added automatically",
          "Pick a country and press connect with the remote",
        ],
      },
    },
    {
      id: "incy",
      name: "Incy",
      note: { ru: "Для Android TV", en: "For Android TV" },
      links: [{ label: { ru: "Google Play", en: "Google Play" }, href: STORE.incyAndroid }],
      steps: {
        ru: [
          "Установите Incy из Google Play на телевизоре",
          "Нажмите «+» и отсканируйте QR-код",
          "Подписка добавится автоматически",
          "Выберите страну и нажмите подключиться пультом",
        ],
        en: [
          "Install Incy from Google Play on your TV",
          "Press “+” and scan the QR code",
          "The subscription is added automatically",
          "Pick a country and press connect with the remote",
        ],
      },
    },
    {
      id: "v2raytun",
      name: "V2RayTun",
      note: { ru: "Лёгкий запасной клиент", en: "A lightweight backup client" },
      links: [{ label: { ru: "Google Play на TV", en: "Google Play on TV" }, href: STORE.v2raytunAndroid }],
      steps: {
        ru: [
          "Откройте V2RayTun на телевизоре и нажмите «+»",
          "Введите ссылку подписки или отсканируйте QR-код",
          "Сервер добавится автоматически",
          "Выберите сервер и нажмите подключиться пультом",
        ],
        en: [
          "Open V2RayTun on your TV and press “+”",
          "Enter the subscription link or scan the QR code",
          "The server is added automatically",
          "Pick a server and press connect with the remote",
        ],
      },
    },
  ],
};

/**
 * Платформы. Ни имя, ни уточнение переводить не нужно: «iPhone / iPad»,
 * «Apple Silicon / Intel» и «10 / 11» пишутся одинаково на обоих
 * языках — это названия, а не слова.
 */
export const PLATFORMS: { id: Platform; name: string; detail: string }[] = [
  { id: "ios", name: "iPhone / iPad", detail: "iOS 15+" },
  { id: "android", name: "Android", detail: "Android 8+" },
  { id: "macos", name: "Mac", detail: "Apple Silicon / Intel" },
  { id: "windows", name: "Windows", detail: "10 / 11" },
  { id: "tv", name: "Android TV", detail: "Google TV" },
];

/** Платформа по userAgent — для предвыбора. */
export function detectPlatform(ua: string): Platform | null {
  const s = ua.toLowerCase();
  if (/android tv|googletv|aft[a-z]|bravia|smart-tv|smarttv/.test(s)) return "tv";
  if (/iphone|ipad|ipod/.test(s)) return "ios";
  if (/android/.test(s)) return "android";
  if (/macintosh|mac os x/.test(s)) return "macos";
  if (/windows/.test(s)) return "windows";
  return null;
}
