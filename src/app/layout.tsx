import type { Metadata, Viewport } from "next";
import { atlasWide } from "./atlas-fonts";
import { brand } from "./fonts";
import { PLANS, DEVICE_LIMIT, formatRub } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
// Общий слой: Tailwind, сброс и служебные элементы layout. Корпус
// «Атлас-издания» подключают AtlasShell (atlas.css) и сами страницы.
import "./globals.css";
// Нижние карточки и диалоги (cookie, установка, быстрый вход) — одно
// оформление на весь сайт, без мостов старых слоёв.
import "./overlays.css";
import CookieConsent from "@/components/CookieConsent";
import PwaManager from "@/components/PwaManager";
import IosInstallBanner from "@/components/IosInstallBanner";
import { I18nProvider } from "@/lib/i18n";
import SiteJsonLd from "@/components/pixel/SiteJsonLd";
import PageTransition from "@/components/brand/PageTransition";
import BackToTop from "@/components/brand/BackToTop";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://qodev.dev"),
  // Заголовок по умолчанию для страниц, которые не объявили свой.
  // Шаблон добавляет имя компании к заголовку раздела — иначе в
  // выдаче все страницы сайта выглядят одинаково.
  // Ребрендинг 2027: продукт называется тем, чем является. Прежний
  // заголовок («ускоритель интернета») был эвфемизмом — он заставлял
  // читателя думать, что это другой продукт.
  title: {
    default: "Atlas Secure VPS — быстрый и приватный интернет",
    template: "%s — Atlas Secure VPS",
  },
  // Числа собираются из источников истины, а не пишутся руками:
  // страны — locations.ts, устройства и цена — plans.ts, срок
  // пробного доступа — brand-facts.ts. Раньше «199 ₽» и «19 стран»
  // стояли здесь строкой и молча разъезжались с тарифом.
  description:
    "Atlas Secure VPS — быстрый и приватный интернет на телефоне, компьютере и телевизоре. " +
    "Шифрование трафика, смена страны, пакеты трафика. " +
    `${COUNTRY_COUNT} стран, ${DEVICE_LIMIT} устройств на подписке, ` +
    `${formatRub(PLANS.basic[1])} ₽ в месяц. ` +
    `${TRIAL_DAYS === 3 ? "Три дня" : `${TRIAL_DAYS} дня`} бесплатно, без карты.`,
  // Аббревиатура на витрине — VPS. Решение владельца от 8 сентября
  // 2026: тексты остаются написанными про то же самое, меняется
  // только слово. Риск зафиксирован в docs/QUESTIONS.md №3: VPS —
  // общепринятое имя виртуального сервера, а выделенные серверы мы
  // тут же и продаём.
  keywords: [
    "Atlas Secure VPS",
    "Atlas VPS",
    "VPS",
    "VPS для телефона",
    "быстрый VPS",
    "VPS без логов",
    "VPS 19 стран",
    "VPS подписка",
  ],
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/icon-192", type: "image/png", sizes: "192x192" },
      { url: "/icon-512", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon",
    shortcut: "/icon",
  },
  manifest: "/manifest.json",
  openGraph: {
    // Описание повторяет числа страниц, а не живёт своей жизнью:
    // страны — src/lib/locations.ts, устройства и цена —
    // src/lib/plans.ts, срок пробного доступа — src/lib/brand-facts.ts.
    title: "Atlas Secure VPS — быстрый и приватный интернет",
    description:
      "Шифрует трафик, меняет страну, открывает то, что перестало открываться. " +
      `${COUNTRY_COUNT} стран, ${DEVICE_LIMIT} устройств, ${formatRub(PLANS.basic[1])} ₽ в месяц. ` +
      `${TRIAL_DAYS === 3 ? "Три дня" : `${TRIAL_DAYS} дня`} бесплатно, без карты.`,
    type: "website",
    locale: "ru_RU",
    siteName: "Atlas Secure VPS",
  },
};

/* Корпус «Атлас-издание»: класс `.a-js` (или `data-static` при
   ?static=1) ставится во время разбора HTML, до первой отрисовки —
   иначе содержимое, скрытое до входа в кадр, мигало бы. Живёт здесь, а
   не в AtlasShell: layout не перерисовывается при переходах, и React не
   видит <script> в клиентском рендере. На страницах без `.a` класс
   ничего не меняет. */
const ATLAS_BOOT =
  "(function(){var d=document.documentElement;" +
  "if(/[?&]static\\b/.test(location.search)){d.setAttribute('data-static','')}" +
  "else{d.classList.add('a-js')}})();";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Масштабирование пальцами не запрещаем. Запрет стоял ради того,
  // чтобы Safari не увеличивал страницу при фокусе на поле ввода, —
  // но это лечится кеглем поля в 16px (.px-input), а не отключением
  // зума. Отключённый зум — прямое нарушение WCAG 1.4.4 и провал
  // аудита meta-viewport в Lighthouse.
  viewportFit: "cover",
  // Цвет системной панели браузера. Тёмное значение осталось от
  // прежнего корпуса: на светлом сайте оно давало чёрную полосу над
  // белой страницей.
  themeColor: "#FFFFFF",
};

/**
 * Шрифты (13.09.2026). MTS Wide — одна гарнитура всего сайта, два
 * предзагруженных файла (atlas-fonts.ts). Переменная стоит на <html>,
 * а не на `.a`: нижние карточки живут здесь, вне страницы, и раньше
 * качали тот же Medium второй раз через сырой @font-face.
 *
 * Sofia Sans (fonts.ts) — без предзагрузки, только для «К содержимому»
 * и подписи «наверх»; файл приезжает, когда элемент показан. Sofia Sans
 * Condensed убрана: ей не набрано ни одного видимого знака.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`${atlasWide.variable} ${brand.variable}`} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: ATLAS_BOOT }} />
        {/* Структурированные данные всего сайта: организация, её
            принадлежность группе и сам сайт. Один источник на проект —
            иначе поиск получает несколько расходящихся карточек одной
            компании. */}
        <SiteJsonLd />
        <I18nProvider>
          <div className="relative min-h-dvh flex flex-col">
            {children}
          </div>
          <CookieConsent />
          {/* Курсор бренда и зерно (`.b-cursor`, `.b-grain`) убраны
              13.09.2026: оба включались только при `.b-root` на
              странице, а чернильной оболочки нет ни на одной — курсор
              вешал слушатель и рисовал пустой div, зерно было
              display: none. */}
          {/* Возврат к первому экрану: страница высокая, а закреплённые
              сцены забирают по несколько экранов прокрутки каждая. */}
          <BackToTop />
          {/* Смена страницы как монтажная склейка. */}
          <PageTransition />
          <PwaManager />
          <IosInstallBanner />
        </I18nProvider>
      </body>
    </html>
  );
}
