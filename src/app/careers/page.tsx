import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import BrandMark from "@/components/pixel/BrandMark";
import Icon, { type IconName } from "@/components/pixel/Icon";
import CareersList from "./CareersList";
import TeamFigures from "./TeamFigures";
import { VACANCIES, RESUME_MAX_MB, vacancyText } from "@/lib/careers";
import { TELEGRAM_SUPPORT } from "@/lib/contacts";
import { COUNTRY_COUNT, CITY_COUNT } from "@/lib/locations";
import { FOUNDED } from "@/lib/nav";
import { dict, fill } from "@/i18n";
import { count, pluralize } from "@/lib/text/plural";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
import "@/app/tech.css";
import "./careers.css";

/**
 * /careers — вакансии на тёмном технологическом корпусе.
 *
 * Разворот переписан 19.09.2026 по разбору владельца («сделай похожее
 * на эти экраны, технологичным») с девятью снимками ecom.tech. Что
 * взято как приём и почему:
 *
 *   — ДИСПЛЕЙНЫЙ ЗАГОЛОВОК прописными и лаймом. Лайм на витрине не
 *     используется: он живёт только здесь и на /infrastructure, и
 *     этого достаточно, чтобы раздел про найм читался как другой
 *     разговор, а не как продажа подписки;
 *   — РАЗВОРОТ «название слева — содержимое справа» (`t-split`) как
 *     единственная сетка страницы: у ecom.tech так собран весь сайт,
 *     и это честнее сетки из одинаковых карточек;
 *   — ПИЛЮЛИ-СТРОКИ со стрелкой вместо списка ссылок;
 *   — ЧИСЛА КОНТУРОМ для шагов найма — приём корпуса уже был
 *     (`t-num`, вилки вакансий), здесь он просто применён второй раз;
 *   — ПОЛОСА-ПРИЗЫВ внизу: одна широкая плита, слева фраза, справа
 *     контурная кнопка.
 *
 * ЧТО НЕ ВЗЯТО: пиксельные бегуны и фотографии сотрудников (у нас нет
 * ни своих съёмок, ни права на чужие), кислотные плашки поверх
 * фотографий, счётчики «нас уже N». Фигуры первого экрана нарисованы
 * блоками — тем же штрихом, что и иконки корпуса (`TeamFigures.tsx`).
 *
 * Слова «VPN» на странице нет вовсе (владелец, 18.09.2026): правило
 * витрины действует и в найме. Инфраструктура называется
 * «VPS-инфраструктурой», технология — «туннельными протоколами».
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const d = dict(locale);
  return {
    title: d.careers.meta.title,
    description: fill(d.careers.meta.description, {
      count: VACANCIES.length,
      word: pluralize(locale, VACANCIES.length, d.careers.meta.metaWord),
      countriesIn: count(locale, COUNTRY_COUNT, d.units.countryIn),
    }),
  };
}

export default async function CareersPage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.careers;
  const to = (href: string) => localeHref(href, locale);
  const roleWord = pluralize(locale, VACANCIES.length, t.roleWord);

  /** Чем занята команда. Иконки — из собственного набора корпуса. */
  const WORK_ICONS: IconName[] = ["globe", "shield", "receipt", "devices", "chat", "grid"];

  return (
    <VShell>
      <div className="t tc">
        {/* 01 · первый экран */}
        <section className="t-sec tc-hero" aria-labelledby="tc-title">
          <div className="t-wrap">
            <div className="tc-hero-grid">
              <div className="tc-hero-left">
                <p className="t-label tc-mark">
                  <span className="tc-mark-logo" aria-hidden><BrandMark size={16} /></span>
                  {t.kicker}
                </p>
                <h1 id="tc-title" className="tc-display">
                  {t.title1}<br />{t.title2}
                </h1>
                <TeamFigures />
              </div>

              <div className="tc-hero-right">
                <p className="tc-hero-text">
                  {fill(t.heroText, {
                    countriesIn: count(locale, COUNTRY_COUNT, d.units.countryIn),
                    citiesIn: count(locale, CITY_COUNT, d.units.cityIn),
                  })}
                </p>
                <p className="t-label tc-hero-label">{t.openRolesLabel}</p>
                <ul className="tc-pills">
                  {VACANCIES.map((v) => (
                    <li key={v.id}>
                      <a className="tc-pill" href={`#vac-${v.id}`}>
                        <span>{vacancyText(v, locale).title}</span>
                        <Icon name="arrow-right" size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 02 · чем занята команда */}
        <section className="t-sec t-reveal" aria-labelledby="tc-work">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-work" className="t-split-title">{t.workTitle}</h2>
              <ul className="tc-work">
                {t.work.map((label, i) => (
                  <li key={label} className="tc-work-item">
                    <span className="tc-work-icon" aria-hidden><Icon name={WORK_ICONS[i]} size={30} /></span>
                    <b>{label}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 03 · что даём */}
        <section className="t-sec t-reveal" aria-labelledby="tc-offer">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-offer" className="t-split-title">{t.offerTitle}</h2>
              <ul className="tc-offer">
                {t.offer.map((o) => (
                  <li key={o.t} className="tc-offer-item">
                    <b>{o.t}</b>
                    <span>{fill(o.d, { founded: FOUNDED })}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 04 · список вакансий */}
        <section className="t-sec t-reveal" id="roles" aria-labelledby="tc-open">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-open" className="t-split-title">
                {t.openTitle}
                <span className="tc-count t-mono">{VACANCIES.length}</span>
              </h2>
              <div>
                <CareersList
                  locale={locale}
                  t={t.list}
                  tf={t.form}
                  hint={fill(t.form.hint, { mb: RESUME_MAX_MB })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 05 · как проходит найм */}
        <section className="t-sec t-reveal" aria-labelledby="tc-how">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-how" className="t-split-title">{t.howTitle}</h2>
              <ol className="tc-steps">
                {t.steps.map((step, i) => (
                  <li key={step.t} className="tc-step">
                    {/* Номер считается, а не пишется: шаги нумеруются
                        порядком, и на двух языках он один. */}
                    <b className="t-num tc-step-num">{String(i + 1).padStart(2, "0")}</b>
                    <b className="tc-step-t">{step.t}</b>
                    <span>{step.d}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 06 · полоса-призыв */}
        <section className="t-sec t-reveal" aria-label={t.barLabel}>
          <div className="t-wrap">
            <div className="tc-bar">
              <p className="tc-bar-t">{fill(t.barText, { count: VACANCIES.length, word: roleWord })}</p>
              <a className="tc-bar-btn" href="#roles">
                {t.goToRoles}
                <Icon name="arrow-right" size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* 07 · финал */}
        <section className="t-sec t-reveal" aria-labelledby="tc-final">
          <div className="t-wrap">
            <div className="tc-final">
              <h2 id="tc-final" className="t-h2">{t.finalTitle}</h2>
              <p className="t-lead">{t.finalLead}</p>
              <div className="t-actions">
                <a className="t-btn" href="#roles">
                  {t.pickRole}
                  <Icon name="arrow-right" size={16} />
                </a>
                <a className="t-btn t-btn-accent" href={TELEGRAM_SUPPORT.href} target="_blank" rel="noopener noreferrer">
                  {TELEGRAM_SUPPORT.handle}
                </a>
                <Link className="t-btn t-btn-accent" href={to("/infrastructure")}>
                  {t.infraLink}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </VShell>
  );
}
