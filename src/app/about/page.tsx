import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BRAND } from "@/components/vps/links";
import { CITY_COUNT, COUNTRY_COUNT } from "@/lib/locations";
import { DEVICE_LIMIT, PLANS, PLAN_SPEED, formatRub } from "@/lib/plans";
import { SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { FOUNDED } from "@/lib/nav";
import { dict, fill } from "@/i18n";
import { count, pluralize } from "@/lib/text/plural";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
import "./about-vps.css";

/**
 * Год случая, с которого началась история компании (вводные владельца,
 * 18.09.2026). Оба события осени 2014 года — проверяемые, ссылки стоят
 * на самой странице: 28.09.2014 материковый Китай закрыл Instagram
 * из-за фотографий из Гонконга; с 16.09.2014 по мессенджерам расходилось
 * поддельное «приложение для координации» Code4HK, которое ставило на
 * телефон шпионскую программу (бюллетень HKCERT).
 */
const STORY_YEAR = 2014;

/**
 * /about — корпус Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple — минимум текста»).
 *
 * Одна мысль на экран: обещание → числа → три правила (тёмная плита)
 * → чем мы занимаемся → тарифы. Все числа — из src/lib, как и раньше.
 *
 * СНЯТО ПРИ ПЕРЕВОДЕ (было в прежней версии на «Атлас-издании»):
 * анимированный глобус первого экрана и закреплённая сцена «три
 * правила, проявляющиеся по словам» — декоративный моушн прежнего
 * корпуса, в новом корпусе таких сцен нет ни на одной странице.
 * Смысл текста сохранён целиком.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const d = dict(locale);
  return {
    title: d.about.meta.title,
    description: fill(d.about.meta.description, {
      brand: BRAND,
      countries: count(locale, COUNTRY_COUNT, d.units.country),
      devices: count(locale, DEVICE_LIMIT, d.units.device),
    }),
  };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.about;
  const to = (href: string) => localeHref(href, locale);
  // Числа, которые встречаются в нескольких абзацах сразу.
  const vars = {
    brand: BRAND,
    year: STORY_YEAR,
    founded: FOUNDED,
    countries: count(locale, COUNTRY_COUNT, d.units.country),
    countriesIn: count(locale, COUNTRY_COUNT, d.units.countryIn),
    devices: count(locale, DEVICE_LIMIT, d.units.device),
  };

  const FACTS: Array<{ v: string; label: string; icon: IconName; tile?: "dark" | "blue"; span?: 2 | 3 }> = [
    { v: String(COUNTRY_COUNT), label: fill(t.facts.countries, { word: pluralize(locale, COUNTRY_COUNT, d.units.country) }), icon: "globe", tile: "blue", span: 3 },
    { v: String(DEVICE_LIMIT), label: fill(t.facts.devices, { word: pluralize(locale, DEVICE_LIMIT, d.units.device) }), icon: "devices", tile: "dark", span: 3 },
    { v: String(CITY_COUNT), label: fill(t.facts.cities, { word: pluralize(locale, CITY_COUNT, d.units.city) }), icon: "grid", span: 2 },
    { v: String(PLAN_SPEED.plus), label: t.facts.speed, icon: "bolt", span: 2 },
    { v: String(TRIAL_DAYS), label: fill(t.facts.trial, { word: pluralize(locale, TRIAL_DAYS, d.units.day) }), icon: "clock", span: 2 },
  ];

  return (
    <VShell>
      {/* 01 · обещание */}
      <section className="v-section v-center v-glow" aria-labelledby="pa-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="pa-title" className="v-h1">
            {t.title} <span className="v-accent">{t.titleAccent}</span>
          </h1>
          <p className="v-lead">{fill(t.lead, vars)}</p>
        </div>
      </section>

      {/* 02 · история */}
      <section className="v-section v-reveal" aria-labelledby="pa-story-title">
        <div className="v-wrap pa-story">
          <div className="pa-story-text">
            <h2 id="pa-story-title" className="v-h2">{t.storyTitle}</h2>
            {t.story.map((para) => (
              <p key={para.slice(0, 24)}>{fill(para, vars)}</p>
            ))}
            <p className="pa-story-src">
              {t.sources}{" "}
              <a href="https://www.nbcnews.com/news/world/instagram-blocked-china-amid-occupycentral-movement-n213556" target="_blank" rel="noopener noreferrer">
                {t.source1}
              </a>{" "}
              ·{" "}
              <a href="https://www.hkcert.org/security-bulletin/fake-code4hk-mobile-application-attack" target="_blank" rel="noopener noreferrer">
                {t.source2}
              </a>
            </p>
          </div>
          <ol className="pa-story-line">
            {t.timeline.map((row) => (
              <li key={row.b}>
                <b>{fill(row.b, vars)}</b>
                <span>{fill(row.t, vars)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 03 · миссия */}
      <section className="v-section v-reveal" aria-labelledby="pa-mission-title">
        <div className="v-wrap">
          <div className="v-panel pa-mission">
            <p className="pa-mission-kicker">{t.missionKicker}</p>
            <h2 id="pa-mission-title" className="v-h2">
              {t.missionTitle} <span className="pa-mission-accent">{t.missionAccent}</span>
            </h2>
            <p className="pa-mission-lead">{t.missionLead}</p>
            <ul className="pa-mission-list">
              {t.missionList.map((row) => (
                <li key={row.b}>
                  <b>{row.b}</b>
                  {row.t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 04 · в цифрах — бенто */}
      <section className="v-section v-reveal" aria-labelledby="pa-facts-title">
        <div className="v-wrap">
          <h2 id="pa-facts-title" className="v-sr">{t.factsHeading}</h2>
          <div className="v-bento">
            {FACTS.map((f) => (
              <div key={f.label} className={`v-tile v-span-${f.span ?? 2}${f.tile ? ` v-tile-${f.tile}` : ""}`}>
                <span className="v-tile-icon" aria-hidden><Icon name={f.icon} size={22} /></span>
                <h3>{f.label}</h3>
                <b className="v-tile-num">{f.v}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 · что мы делаем */}
      <section className="v-section v-center v-reveal" aria-labelledby="pa-make-title">
        <div className="v-wrap">
          <h2 id="pa-make-title" className="v-h2">{t.makeTitle}</h2>
          <div className="pa-make">
            <Link href={to("/pricing")} className="v-card v-card-pad pa-make-card v-lift">
              <span className="pa-make-icon" aria-hidden><Icon name="bolt" size={24} /></span>
              <h3 className="pa-make-title">{t.makeVps}</h3>
              <p className="v-text">{t.makeVpsText}</p>
              <p className="pa-make-price">
                {t.from} <b>{formatRub(PLANS.basic[1], locale)} ₽</b> {t.perMonth}
              </p>
            </Link>
            <Link href={to("/vds")} className="v-card v-card-pad pa-make-card v-lift">
              <span className="pa-make-icon" aria-hidden><Icon name="grid" size={24} /></span>
              <h3 className="pa-make-title">{t.makeVds}</h3>
              <p className="v-text">{t.makeVdsText}</p>
              <p className="pa-make-price">
                {t.from} <b>{formatUsd(SERVER_ENTRY_USD, locale)}</b> {t.perMonth}
              </p>
            </Link>
          </div>
          <p className="v-small" style={{ marginTop: 24 }}>
            {t.forTeamBefore} <Link href={to("/business")} className="v-link">{t.forTeamLink}</Link>{t.dataBefore}{" "}
            <Link href={to("/security")} className="v-link">{t.dataLink}</Link>.
          </p>
        </div>
      </section>

      {/* 06 · финал */}
      <section className="v-section v-center v-reveal" aria-labelledby="pa-final-title">
        <div className="v-wrap v-narrow">
          <h2 id="pa-final-title" className="v-h2">{t.finalTitle}</h2>
          <p className="v-lead">{fill(t.finalLead, vars)}</p>
          <div className="v-actions">
            <Link href={to("/pricing")} className="v-btn v-btn-primary">{t.seePlans}</Link>
            <Link href={to("/auth")} prefetch={false} className="v-btn v-btn-soft">
              {fill(d.common.tryFree, { trial: count(locale, TRIAL_DAYS, d.units.day) })}
            </Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
