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

export type Platform = "ios" | "android" | "macos" | "windows" | "tv";
export type AppId = "happ" | "incy" | "v2raytun";

export interface AppLink {
  /** Подпись кнопки: «App Store · Россия», «Google Play», «Скачать для Windows». */
  label: string;
  href: string;
  /** Вторичная ссылка (другой регион, другой процессор). */
  secondary?: boolean;
}

export interface ClientApp {
  id: AppId;
  name: string;
  /** Одна строка под названием. */
  note: string;
  links: AppLink[];
  /** Ссылка подписки нужна в формате JSON (Happ). */
  jsonFormat?: boolean;
  /** Кнопка «Открыть в приложении»; нет — только копирование и QR. */
  openUrl?: (subscriptionUrl: string) => string;
  /** Как добавить подписку вручную. */
  steps: string[];
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

const HAPP_STEPS = [
  "Откройте Happ и нажмите «+»",
  "Выберите «Добавить подписку» или «Из буфера обмена»",
  "Подписка добавится автоматически",
  "Нажмите кнопку подключения и разрешите добавить конфигурацию",
];
const INCY_STEPS = [
  "Откройте Incy и нажмите «+»",
  "Выберите «Импорт из буфера обмена» или «Сканировать QR-код»",
  "Подписка добавится автоматически",
  "Выберите страну и нажмите кнопку подключения",
];
const DESKTOP_STEPS = (name: string) => [
  `Установите и откройте ${name}`,
  "Нажмите «+» → «Добавить подписку» и вставьте ссылку",
  "Подписка добавится автоматически",
  "Нажмите подключиться и разрешите доступ, если система спросит",
];

export const APPS: Record<Platform, ClientApp[]> = {
  ios: [
    {
      id: "happ",
      name: "Happ",
      note: "Самый простой вариант для iPhone и iPad",
      jsonFormat: true,
      openUrl: openVia("happ"),
      links: [
        { label: "App Store · Россия", href: STORE.happIosRu },
        { label: "App Store · другие страны", href: STORE.happIosGlobal, secondary: true },
      ],
      steps: HAPP_STEPS,
    },
    {
      id: "incy",
      name: "Incy",
      note: "Современный клиент с быстрым выбором страны",
      openUrl: openVia("incy"),
      links: [{ label: "App Store", href: STORE.incyApple }],
      steps: INCY_STEPS,
    },
  ],
  android: [
    {
      id: "happ",
      name: "Happ",
      note: "Самый простой вариант для Android",
      jsonFormat: true,
      openUrl: openVia("happ"),
      links: [{ label: "Google Play", href: STORE.happAndroid }],
      steps: HAPP_STEPS,
    },
    {
      id: "incy",
      name: "Incy",
      note: "Современный клиент с быстрым выбором страны",
      openUrl: openVia("incy"),
      links: [{ label: "Google Play", href: STORE.incyAndroid }],
      steps: INCY_STEPS,
    },
    {
      id: "v2raytun",
      name: "V2RayTun",
      note: "Лёгкий запасной клиент",
      openUrl: openVia("v2raytun"),
      links: [{ label: "Google Play", href: STORE.v2raytunAndroid }],
      steps: [
        "Откройте V2RayTun и нажмите «+»",
        "Выберите «Импорт из буфера обмена»",
        "Сервер добавится автоматически",
        "Нажмите кнопку подключения и разрешите добавить конфигурацию",
      ],
    },
  ],
  macos: [
    {
      id: "happ",
      name: "Happ",
      note: "Для Mac на Apple Silicon и Intel",
      jsonFormat: true,
      openUrl: openVia("happ"),
      links: [
        { label: "App Store · Россия", href: STORE.happIosRu },
        { label: "App Store · другие страны", href: STORE.happIosGlobal, secondary: true },
        { label: "Установщик .dmg", href: STORE.happMacDmg, secondary: true },
      ],
      steps: DESKTOP_STEPS("Happ"),
    },
    {
      id: "incy",
      name: "Incy",
      note: "Для Mac на Apple Silicon (M1 и новее)",
      openUrl: openVia("incy"),
      links: [
        { label: "App Store", href: STORE.incyApple },
        { label: ".dmg · Apple Silicon", href: STORE.incyMacArm, secondary: true },
        { label: ".dmg · Intel", href: STORE.incyMacIntel, secondary: true },
      ],
      steps: DESKTOP_STEPS("Incy"),
    },
  ],
  windows: [
    {
      id: "happ",
      name: "Happ",
      note: "Установщик для Windows 10 и 11",
      jsonFormat: true,
      links: [
        { label: "Скачать для Windows", href: STORE.happWindowsX64 },
        { label: "Windows на ARM", href: STORE.happWindowsArm64, secondary: true },
      ],
      steps: DESKTOP_STEPS("Happ"),
    },
    {
      id: "incy",
      name: "Incy",
      note: "Портативная версия — без установки",
      links: [
        { label: "Скачать для Windows", href: STORE.incyWindows },
        { label: "Все версии", href: STORE.incyReleases, secondary: true },
      ],
      steps: [
        "Распакуйте архив и запустите Incy",
        "Нажмите «+» → «Импорт из буфера обмена» и вставьте ссылку",
        "Подписка добавится автоматически",
        "Нажмите подключиться и разрешите доступ, если система спросит",
      ],
    },
  ],
  tv: [
    {
      id: "happ",
      name: "Happ",
      note: "Для Android TV и Google TV",
      jsonFormat: true,
      links: [{ label: "Google Play", href: STORE.happAndroid }],
      steps: [
        "Установите Happ из Google Play на телевизоре",
        "Нажмите «+» и отсканируйте QR-код с экрана телефона или компьютера",
        "Подписка добавится автоматически",
        "Выберите страну и нажмите подключиться пультом",
      ],
    },
    {
      id: "incy",
      name: "Incy",
      note: "Для Android TV",
      links: [{ label: "Google Play", href: STORE.incyAndroid }],
      steps: [
        "Установите Incy из Google Play на телевизоре",
        "Нажмите «+» и отсканируйте QR-код",
        "Подписка добавится автоматически",
        "Выберите страну и нажмите подключиться пультом",
      ],
    },
    {
      id: "v2raytun",
      name: "V2RayTun",
      note: "Лёгкий запасной клиент",
      links: [{ label: "Google Play на TV", href: STORE.v2raytunAndroid }],
      steps: [
        "Откройте V2RayTun на телевизоре и нажмите «+»",
        "Введите ссылку подписки или отсканируйте QR-код",
        "Сервер добавится автоматически",
        "Выберите сервер и нажмите подключиться пультом",
      ],
    },
  ],
};

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
