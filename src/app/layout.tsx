import type { Metadata, Viewport } from "next";
import { getLocale, getPath } from "@/lib/locale-server";
import { alternatesFor } from "@/lib/locale";
import { dict, fill } from "@/i18n";
import { count } from "@/i18n/plural";
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
import SiteJsonLd from "@/components/pixel/SiteJsonLd";
import PageTransition from "@/components/brand/PageTransition";
import BackToTop from "@/components/brand/BackToTop";

const BASE: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://qodev.dev"),
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
};

/**
 * Метаданные страницы: общая часть плюс пара ссылок на другую языковую
 * версию (21.09.2026).
 *
 * `alternates.languages` объявляется ОДИН РАЗ НА ВЕСЬ САЙТ, здесь.
 * Страница своего адреса корневому layout не сообщает — его кладёт в
 * заголовок middleware. Альтернативой было дописать пару в каждый из
 * двух десятков `generateMetadata`, и однажды кто-нибудь завёл бы
 * страницу без неё: для поиска это две несвязанные страницы, которые
 * конкурируют друг с другом в выдаче.
 *
 * `x-default` — куда вести того, чей язык нам неизвестен. Это русская
 * версия: основной рынок русскоязычный, английская — вторая.
 *
 * ПОЭТОМУ У СТРАНИЦ СВОЕГО `alternates` БЫТЬ НЕ ДОЛЖНО. Метаданные
 * страницы замещают одноимённое поле слоя выше ЦЕЛИКОМ, а не
 * дополняют его: строка `alternates: { canonical: … }` на странице
 * стирает вместе с собой обе `hreflang`, и для поиска русская и
 * английская версии становятся двумя конкурирующими страницами. Так и
 * было первые полчаса после правки — отсюда и этот абзац. Канонический
 * адрес страницы совпадает с её путём, и считается он здесь же.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [locale, path] = await Promise.all([getLocale(), getPath()]);
  const d = dict(locale);
  const languages = alternatesFor(path);
  // Канонический адрес — СВОЙ У КАЖДОГО ЯЗЫКА. Первая версия ставила
  // сюда русский путь на обеих, то есть английская страница сама
  // просила поиск индексировать вместо себя русскую. Поймано
  // проверкой выдачи `/en/pricing` перед выкладкой.
  const self = languages[locale];
  // Числа собираются из источников истины, а не пишутся руками: страны
  // — locations.ts, устройства и цена — plans.ts, срок пробного
  // доступа — brand-facts.ts. Раньше «199 ₽» и «19 стран» стояли в
  // описании строкой и молча разъезжались с тарифом.
  const facts = {
    countries: count(locale, COUNTRY_COUNT, d.units.country),
    devices: count(locale, DEVICE_LIMIT, d.units.device),
    price: formatRub(PLANS.basic[1]),
    trial: count(locale, TRIAL_DAYS, d.units.day),
  };
  return {
    ...BASE,
    // Шаблон добавляет имя компании к заголовку раздела — иначе в
    // выдаче все страницы сайта выглядят одинаково. Заголовок по
    // умолчанию — для страниц, не объявивших свой.
    title: { default: d.meta.title, template: "%s — Atlas Secure VPS" },
    description: fill(d.meta.description, facts),
    // Аббревиатура на витрине — VPS (решение владельца от 8 сентября
    // 2026). Риск зафиксирован в docs/QUESTIONS.md №3: VPS —
    // общепринятое имя виртуального сервера, а выделенные серверы мы
    // тут же и продаём.
    keywords: [...d.meta.keywords, fill("VPS {countries}", facts)],
    alternates: { canonical: self, languages: { ...languages, "x-default": languages.ru } },
    openGraph: {
      title: d.meta.title,
      description: fill(d.meta.ogDescription, facts),
      type: "website",
      locale: d.meta.ogLocale,
      alternateLocale: dict(locale === "ru" ? "en" : "ru").meta.ogLocale,
      siteName: "Atlas Secure VPS",
      url: self,
    },
  };
}

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
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  // Нижние карточки — клиентские и живут вне страницы, поэтому текст им
  // отдаёт layout: сами словарь они не читают, иначе в браузер уехали бы
  // оба языка (см. CLAUDE.md, «Сайт на двух языках»).
  const d = dict(locale);
  return (
    <html lang={locale} className={`${atlasWide.variable} ${brand.variable}`} suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: ATLAS_BOOT }} />
        {/* Структурированные данные всего сайта: организация, её
            принадлежность группе и сам сайт. Один источник на проект —
            иначе поиск получает несколько расходящихся карточек одной
            компании. */}
        <SiteJsonLd />
        <div className="relative min-h-dvh flex flex-col">
          {children}
        </div>
        <CookieConsent t={d.cookie} />
        {/* Курсор бренда и зерно (`.b-cursor`, `.b-grain`) убраны
            13.09.2026: оба включались только при `.b-root` на
            странице, а чернильной оболочки нет ни на одной — курсор
            вешал слушатель и рисовал пустой div, зерно было
            display: none. */}
        {/* Возврат к первому экрану: страница высокая, а закреплённые
            сцены забирают по несколько экранов прокрутки каждая. */}
        <BackToTop label={d.a11y.toTop} short={d.a11y.toTopShort} />
        {/* Смена страницы как монтажная склейка. */}
        <PageTransition />
        <PwaManager />
        <IosInstallBanner t={d.install} />
      </body>
    </html>
  );
}
