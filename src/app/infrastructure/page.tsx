import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import BrandMark from "@/components/pixel/BrandMark";
import Icon from "@/components/pixel/Icon";
import NetMap from "./NetMap";
import Rack from "./Rack";
import { BRAND } from "@/components/vps/links";
import { COUNTRY_COUNT, CITY_COUNT } from "@/lib/locations";
import { PLAN_SPEED, DEVICE_LIMIT } from "@/lib/plans";
import { SERVERS, SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { protection } from "@/lib/protection";
import { VACANCIES } from "@/lib/careers";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { count, pluralize } from "@/i18n/plural";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
import "@/app/tech.css";
import "./infra.css";

/**
 * /infrastructure — тёмный технологический корпус (владелец,
 * 18.09.2026: «сделать тёмным, технологичным, детализированным, как
 * ecom.tech; рендеры дата-центров и структуры, интерактив, анимации»).
 *
 * Тёмными делаются ровно две страницы — эта и /careers. Они про
 * инженерию и наём, а не про покупку: человек приходит сюда из меню и
 * подвала, и смена материала читается как смена раздела. Витрина и путь
 * оплаты остаются белым корпусом.
 *
 * Чем заменены «рендеры дата-центров»: карта узлов из настоящих
 * координат (`locations.ts` + текстовая маска суши `world-map.ts`) и
 * векторная схема стойки. Фотографий наших площадок у нас нет, а чужие
 * снимки серверной — тот самый сток, который на сайте запрещён.
 *
 * ЧТО НЕ ПОКАЗЫВАЕМ: отклик по городам (в `locations.ts` это оценка, а
 * не замер), названия площадок и точек обмена трафиком (нужно право
 * упоминания), сертификаты (нужен документ). Список — в
 * COMPLIANCE-CHECK.md; на странице его нет: покупателю не показывают
 * внутреннюю сверку.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const d = dict(locale);
  return {
    title: fill(d.infra.meta.title, {
      countriesIn: count(locale, COUNTRY_COUNT, d.units.countryIn),
    }),
    description: fill(d.infra.meta.description, {
      brand: BRAND,
      countries: count(locale, COUNTRY_COUNT, d.units.country),
      cities: count(locale, CITY_COUNT, d.units.city),
      speed: PLAN_SPEED.plus,
    }),
  };
}

export default async function InfrastructurePage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.infra;
  const to = (href: string) => localeHref(href, locale);
  const countries = count(locale, COUNTRY_COUNT, d.units.country);
  const cities = count(locale, CITY_COUNT, d.units.city);

  // Крупные числа — из кода, подписи — из словаря по тому же месту.
  const FIGURES = [
    { n: String(COUNTRY_COUNT), cap: fill(t.figures[0], { word: pluralize(locale, COUNTRY_COUNT, d.units.country) }) },
    { n: String(CITY_COUNT), cap: fill(t.figures[1], { word: pluralize(locale, CITY_COUNT, d.units.city) }) },
    { n: `${PLAN_SPEED.plus}`, cap: fill(t.figures[2], { basic: PLAN_SPEED.basic }) },
    { n: String(DEVICE_LIMIT), cap: fill(t.figures[3], { word: pluralize(locale, DEVICE_LIMIT, d.units.device) }) },
  ];

  /**
   * Слои. Защита идёт первой и во всю ширину дорожки (`ti-layer-wide`):
   * из пяти слоёв она единственный, у которого есть имя, а не описание,
   * — и единственный, о котором спрашивают до покупки. Её текст
   * собирается из `protection.ts` и в словаре оставлен пустым: имя
   * защиты и её описание живут в одном месте на весь сайт.
   */
  const pr = protection(locale);
  const LAYERS = [
    { icon: "shield" as const, t: t.layers[0].t, d: `${pr.name}. ${pr.plain} ${pr.scope}`, wide: true },
    { icon: "globe" as const, t: t.layers[1].t, d: t.layers[1].d },
    { icon: "key" as const, t: t.layers[2].t, d: t.layers[2].d },
    { icon: "receipt" as const, t: t.layers[3].t, d: t.layers[3].d },
    { icon: "bell" as const, t: t.layers[4].t, d: t.layers[4].d },
  ];

  return (
    <VShell>
      <div className="t">
        {/* 01 · первый экран */}
        <section className="t-sec ti-hero" aria-labelledby="ti-title">
          <div className="t-wrap">
            <p className="t-label ti-mark">
              <span className="ti-mark-logo" aria-hidden><BrandMark size={16} /></span>
              {t.kicker}
            </p>
            <h1 id="ti-title" className="t-h1">
              {t.title}
            </h1>
            <p className="t-lead">{fill(t.lead, { countries, cities })}</p>
            <div className="t-actions">
              <Link className="t-btn" href={to("/auth")} prefetch={false}>
                {fill(d.common.tryFree, { trial: count(locale, TRIAL_DAYS, d.units.day) })}
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link className="t-btn t-btn-accent" href={to("/careers")}>
                {t.vacancies} · {VACANCIES.length}
              </Link>
            </div>
          </div>
        </section>

        {/* 02 · числа */}
        <section className="t-sec t-reveal" aria-labelledby="ti-figures">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="ti-figures" className="t-split-title">{t.figuresTitle}</h2>
              <div className="t-figures">
                {FIGURES.map((f) => (
                  <div key={f.cap} className="ti-figure">
                    <b className="t-num">{f.n}</b>
                    <p className="t-num-cap">{f.cap}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 03 · карта узлов */}
        <section className="t-sec t-reveal" id="map" aria-labelledby="ti-map-h">
          <div className="t-wrap">
            <div className="t-split">
              <div>
                <h2 id="ti-map-h" className="t-split-title">{t.mapTitle}</h2>
                <p className="t-text">{t.mapText1}</p>
                <p className="t-text">{t.mapText2}</p>
              </div>
              <NetMap locale={locale} hint={t.mapHint} cityWord={d.units.city} />
            </div>
          </div>
        </section>

        {/* 04 · стойка */}
        <section className="t-sec t-reveal" aria-labelledby="ti-rack-h">
          <div className="t-wrap">
            <div className="t-split">
              <div>
                <h2 id="ti-rack-h" className="t-split-title">{t.rackTitle}</h2>
                <p className="t-text">{t.rackText}</p>
              </div>
              <Rack units={t.rackUnits} />
            </div>
          </div>
        </section>

        {/* 05 · слои */}
        <section className="t-sec t-reveal" aria-labelledby="ti-layers-h">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="ti-layers-h" className="t-split-title">{t.layersTitle}</h2>
              <div className="t-cards t-cards-2">
                {LAYERS.map((l) => (
                  <article key={l.t} className={`t-panel ti-layer${"wide" in l && l.wide ? " ti-layer-wide" : ""}`}>
                    <span className="ti-layer-icon" aria-hidden><Icon name={l.icon} size={26} /></span>
                    <h3 className="t-card-h">{l.t}</h3>
                    <p className="t-card-t">{l.d}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 06 · выделенные серверы */}
        <section className="t-sec t-reveal" aria-labelledby="ti-vds-h">
          <div className="t-wrap">
            <div className="ti-final">
              <div>
                <h2 id="ti-vds-h" className="t-h2">{t.vdsTitle}</h2>
                <p className="t-lead">
                  {fill(t.vdsLead, {
                    count: SERVERS.length,
                    word: pluralize(locale, SERVERS.length, d.vds.configWord),
                    price: formatUsd(SERVER_ENTRY_USD, locale),
                  })}
                </p>
                <div className="t-actions">
                  <Link className="t-btn" href={to("/vds")}>
                    {t.vdsCta}
                    <Icon name="arrow-right" size={16} />
                  </Link>
                  <Link className="t-btn t-btn-accent" href={to("/careers")}>
                    {t.careersCta}
                  </Link>
                </div>
              </div>
              <p className="ti-final-note t-mono">
                {fill(t.footNote, { countries, cities, speed: PLAN_SPEED.plus })}
              </p>
            </div>
          </div>
        </section>
      </div>
    </VShell>
  );
}
