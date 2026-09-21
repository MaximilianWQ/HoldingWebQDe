import { Fragment } from "react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { COUNTRY_COUNT } from "@/lib/locations";
import { DEVICE_LIMIT, PLAN_SPEED, formatRub } from "@/lib/plans";
import { TRAFFIC_ENTRY_RUB } from "@/lib/traffic-packs";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { pluralize } from "@/i18n/plural";
import type { Locale } from "@/lib/locale";

/**
 * Бенто «Почему Atlas Secure VPS» — шесть плиток, числа только из
 * src/lib. Появление — `.v-reveal`, приподнимание под курсором —
 * `.v-lift` (оба приёма уже есть в vps.css, раздел 13a).
 *
 * Плитка описана здесь тремя вещами, которые от языка не зависят:
 * значок, оформление и крупное число под текстом. Заголовок и строка
 * под ним — из словаря, по тому же месту в списке.
 */
const TILES: { icon: IconName; tone: string }[] = [
  { icon: "globe", tone: " v-tile-blue" },
  { icon: "devices", tone: "" },
  { icon: "bolt", tone: " v-tile-dark" },
  { icon: "clock", tone: "" },
  { icon: "bag", tone: "" },
  { icon: "lock", tone: " v-tile-blue" },
];

export default function WhyBento({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const t = d.home.why;
  // Крупная цифра под текстом плитки. У шестой её нет намеренно:
  // шифрование числом не измеряется, а подставить туда что-нибудь
  // ради симметрии значило бы выдумать показатель.
  //
  // Обёртка — Fragment, а не span: `.vh-tile-fig` это flex, и `b` со
  // `span` обязаны остаться его ПРЯМЫМИ детьми, иначе выравнивание по
  // базовой линии собирается в один блок.
  const figures: (React.ReactNode | null)[] = [
    <Fragment key="c"><b>{COUNTRY_COUNT}</b><span>{pluralize(locale, COUNTRY_COUNT, d.units.country)}</span></Fragment>,
    <Fragment key="d"><b>{DEVICE_LIMIT}</b><span>{pluralize(locale, DEVICE_LIMIT, d.units.device)}</span></Fragment>,
    <Fragment key="s"><b>{PLAN_SPEED.basic}–{PLAN_SPEED.plus}</b><span>{d.cards.speedUnit}</span></Fragment>,
    <Fragment key="t"><b>{TRIAL_DAYS}</b><span>{pluralize(locale, TRIAL_DAYS, d.units.day)} {t.freeSuffix}</span></Fragment>,
    <Fragment key="p"><b>{fill(t.fromPrice, { price: formatRub(TRAFFIC_ENTRY_RUB, locale) })}</b></Fragment>,
    null,
  ];

  return (
    <div className="v-bento vh-bento">
      {t.tiles.map((tile, i) => (
        <article key={tile.h} className={`v-span-2 v-tile${TILES[i].tone} v-lift`}>
          <span className="v-tile-icon"><Icon name={TILES[i].icon} size={22} /></span>
          <h3>{tile.h}</h3>
          <p>{tile.p}</p>
          {figures[i] ? <div className="vh-tile-fig">{figures[i]}</div> : null}
        </article>
      ))}
    </div>
  );
}
