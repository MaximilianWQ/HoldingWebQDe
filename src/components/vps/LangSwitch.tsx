"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeHref, stripLocale, type Locale } from "@/lib/locale";

/**
 * Переключатель языка (владелец, 21.09.2026).
 *
 * ССЫЛКА, А НЕ КНОПКА. Переключение — это переход на другой адрес
 * (`/pricing` ↔ `/en/pricing`), а не состояние в памяти. Поэтому
 * обычная ссылка: её можно открыть в новой вкладке, скопировать и
 * прислать, и она работает без скрипта. Кнопка с обработчиком всего
 * этого не умеет.
 *
 * ОСТАЁМСЯ НА ТОЙ ЖЕ СТРАНИЦЕ. Переключая язык на тарифах, человек
 * ожидает увидеть тарифы, а не главную. Поэтому берётся текущий путь,
 * с него срезается префикс языка и наклеивается нужный.
 *
 * `hreflang` на ссылке — для поисковика: он так понимает, что это одна
 * страница на двух языках, а не две разные.
 */

/**
 * Имя языка на нём самом. Переводу не подлежит: «Русский» пишется
 * по-русски и на английской странице — иначе человек, зашедший не на
 * свой язык, не найдёт кнопку обратно. По той же причине это не в
 * словаре: там оно было бы одинаковым в обеих версиях.
 */
const NAME: Record<Locale, string> = { ru: "Русский", en: "English" };
export default function LangSwitch({
  locale,
  label,
  block = false,
}: {
  locale: Locale;
  label: string;
  /** В меню телефона — строкой во всю ширину, а не значком в капсуле. */
  block?: boolean;
}) {
  const pathname = usePathname() || "/";
  const other: Locale = locale === "ru" ? "en" : "ru";
  const href = localeHref(stripLocale(pathname), other);

  return (
    <Link
      href={href}
      hrefLang={other}
      prefetch={false}
      className={block ? "v-lang v-lang-block" : "v-lang"}
      aria-label={label}
      title={label}
    >
      {block ? NAME[other] : other.toUpperCase()}
    </Link>
  );
}
