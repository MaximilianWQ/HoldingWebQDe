import Link from "next/link";
import VShell from "@/components/vps/VShell";
import PlanCards from "@/components/vps/PlanCards";
import TrafficCards from "@/components/vps/TrafficCards";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BRAND } from "@/components/vps/links";
import { faqByIds } from "@/lib/faq";
import { DEVICE_LIMIT, PLAN_SPEED, formatRub, planContent, pricePerMonth } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { count, pluralize } from "@/lib/text/plural";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
import "./pricing-vps.css";

/**
 * /pricing на корпусе Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple — минимум текста»).
 *
 * Одна мысль на экран: тарифы → пакеты трафика → чем отличаются
 * Basic и Plus → вопросы до оплаты → одно действие. Числа — только из
 * src/lib. Сравнение — двумя карточками, не таблицей.
 */

const IDS = ["basic", "plus"] as const;

/**
 * Три-пять вопросов, которые чаще всего мешают решиться на оплату.
 * Тот же набор размечен как FAQPage в page.tsx — вопросы должны
 * совпадать один в один, поэтому и там, и здесь берётся этот список.
 *
 * ВЫБОР ПО `id`, А НЕ ПО ТЕКСТУ (21.09.2026). Раньше список хранил
 * русские формулировки и сверял их строкой; на английской странице
 * ни одна не совпала бы, и блок вопросов оказался бы пустым.
 */
export const PRICING_FAQ_IDS = ["setup", "after-trial", "auto-charge", "refund", "logs"] as const;

/** Значки плиток «в каждом тарифе» — порядок задаёт их, а не слова. */
const TILE_ICONS: { icon: IconName; tone: string }[] = [
  { icon: "globe", tone: "" },
  { icon: "devices", tone: " v-tile-dark" },
  { icon: "clock", tone: " v-tile-blue" },
  { icon: "lock", tone: "" },
];

export default async function PricingView() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.pricing;
  const to = (href: string) => localeHref(href, locale);
  const c = planContent(locale);
  const names = { a: c.basic.name, b: c.plus.name };
  const trial = count(locale, TRIAL_DAYS, d.units.day);
  const faq = faqByIds(PRICING_FAQ_IDS, locale);

  // Крупное число под плиткой «в каждом тарифе». Четвёртое —
  // «0 автосписаний»: единственный показатель, который меряется нулём,
  // и именно поэтому он тут стоит.
  const figures = [
    { n: COUNTRY_COUNT, unit: pluralize(locale, COUNTRY_COUNT, d.units.country) },
    { n: DEVICE_LIMIT, unit: pluralize(locale, DEVICE_LIMIT, d.units.device) },
    { n: TRIAL_DAYS, unit: `${pluralize(locale, TRIAL_DAYS, d.units.day)} ${t.included.freeSuffix}` },
    { n: 0, unit: t.included.noCharges },
  ];

  return (
    <VShell>
      {/* 01 · первый экран */}
      <section className="v-section v-center v-glow" aria-labelledby="vp-title">
        <div className="v-wrap">
          <h1 id="vp-title" className="v-h1 vp-hero-h v-stagger">
            <span className="vp-hero-line">{t.title}</span>
            <span className="vp-hero-line vp-hero-line-2 v-accent">{BRAND}</span>
          </h1>
          <p className="v-lead">{fill(t.lead, { ...names, trial })}</p>
        </div>
      </section>

      {/* 02 · тарифы */}
      <section className="v-section v-center v-reveal" id="tariffs" aria-labelledby="vp-plans">
        <div className="v-wrap">
          <h2 id="vp-plans" className="v-sr">{t.plansHeading}</h2>
          <PlanCards locale={locale} t={d.cards} units={d.units} />
        </div>
      </section>

      {/* 03 · чем отличаются тарифы */}
      <section className="v-section v-center v-reveal" aria-labelledby="vp-compare-title">
        <div className="v-wrap v-narrow">
          <h2 id="vp-compare-title" className="v-h2">{t.compare.title}</h2>
          <p className="v-lead">{t.compare.lead}</p>
          <div className="vp-compare">
            {IDS.map((id) => {
              const dark = id === "plus";
              const price = formatRub(pricePerMonth(id, 12), locale);
              return (
                <div key={id} className={`vp-compare-card v-lift ${dark ? "v-dcard" : "v-card v-card-pad"}`}>
                  {/* Было «Популярный» — утверждение о том, что мы
                      проверить не можем (распределение покупок). Замена
                      считается из PLAN_SPEED и остаётся верной, даже
                      если скорости поменяются. */}
                  {dark && (
                    <span className="v-badge v-badge-lg v-dcard-tag v-badge-solid-blue">
                      {fill(t.compare.faster, { times: Math.round(PLAN_SPEED.plus / PLAN_SPEED.basic) })}
                    </span>
                  )}
                  <div className="vp-compare-head">
                    <h3 className={dark ? "v-dcard-title" : "vp-compare-name"}>{c[id].name}</h3>
                    <span className={`vp-compare-speed${dark ? " vp-compare-speed-dark" : ""}`}>
                      {PLAN_SPEED[id]} {d.cards.speedUnit}
                    </span>
                  </div>
                  <p className={dark ? "v-dcard-desc" : "v-text"} style={dark ? undefined : { marginTop: 8 }}>
                    {c[id].tagline}.
                  </p>
                  <ul className={`v-checks${dark ? "" : " v-checks-light"}`}>
                    {c[id].features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className={`vp-compare-price ${dark ? "v-price-row" : "v-text"}`}>
                    {dark ? (
                      <>
                        {t.compare.from} <b>{price} ₽</b>
                        <span>{t.compare.fromMonth}</span>
                      </>
                    ) : (
                      <>
                        {t.compare.from} <b style={{ color: "var(--v-ink)" }}>{price} ₽</b> {t.compare.fromMonth}
                      </>
                    )}
                  </p>
                  <Link
                    href={to(`/subscribe?plan=${id}&period=12`)}
                    prefetch={false}
                    className={`v-btn v-btn-block ${dark ? "v-btn-white" : "v-btn-primary"}`}
                  >
                    {fill(t.compare.choose, { plan: c[id].name })}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 04 · в каждом тарифе */}
      <section className="v-section v-center v-reveal" aria-labelledby="vp-bento-title">
        <div className="v-wrap">
          <h2 id="vp-bento-title" className="v-h2">{t.included.title}</h2>
          <p className="v-lead">{fill(t.included.lead, names)}</p>
          <div className="v-bento vp-bento">
            {t.included.tiles.map((tile, i) => (
              <div key={tile.h} className={`v-tile${TILE_ICONS[i].tone} v-span-3 v-lift`}>
                <span className="v-tile-icon" aria-hidden><Icon name={TILE_ICONS[i].icon} size={22} /></span>
                <h3>{tile.h}</h3>
                <p>{tile.p}</p>
                <span className="v-tile-num">
                  {figures[i].n}
                  <span className="vp-tile-unit">{figures[i].unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 · пакеты трафика */}
      <section className="v-section v-center v-reveal" id="traffic" aria-labelledby="vp-traffic">
        <div className="v-wrap">
          <h2 id="vp-traffic" className="v-h2">{t.traffic.title}</h2>
          <p className="v-lead">{t.traffic.lead}</p>
          <TrafficCards locale={locale} t={d.cards} />
        </div>
      </section>

      {/* 06 · вопросы */}
      <section className="v-section v-center v-reveal" aria-labelledby="vp-faq-title">
        <div className="v-wrap v-narrow">
          <h2 id="vp-faq-title" className="v-h2">{t.faqTitle}</h2>
          <div className="vp-faq">
            {faq.map((item, i) => (
              <details key={item.id} className="vp-q" name="vp-faq" open={i === 0}>
                <summary>
                  <span>{item.q}</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4.5 9 12 16.5 19.5 9" />
                  </svg>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 07 · финал */}
      <section className="v-section v-reveal" aria-labelledby="vp-final-title">
        <div className="v-wrap">
          <div className="v-panel v-center vp-final">
            <h2 id="vp-final-title" className="v-h2">{t.final.title}</h2>
            <p>{t.final.text}</p>
            <div className="v-actions">
              <Link href={to("/auth")} prefetch={false} className="v-btn v-btn-white">
                {fill(d.common.tryFree, { trial })}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </VShell>
  );
}
