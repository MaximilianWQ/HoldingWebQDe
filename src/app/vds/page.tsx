import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Carousel from "@/components/vps/Carousel";
import Icon from "@/components/pixel/Icon";
import { PLANS, formatRub } from "@/lib/plans";
import { protection } from "@/lib/protection";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import {
  SERVERS,
  SERVER_ENTRY_USD,
  SERVER_MAX_GBPS,
  guarantees,
  contractNote,
  serverText,
  formatUsd,
  type ServerTier,
} from "@/lib/servers";
import { dict, fill, type Dict } from "@/i18n";
import { count, pluralize } from "@/i18n/plural";
import { getLocale } from "@/lib/locale-server";
import { localeHref, type Locale } from "@/lib/locale";
import "@/app/vps-info.css";

/**
 * /vds — корпус Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple»).
 *
 * Серверный компонент без состояния: конфигурации — чёрные карточки
 * `.v-dcard` в общей карусели (`Carousel`), данные — только
 * `src/lib/servers.ts`. Незакрытые параметры каждой ступени показаны
 * прямо на карточке строкой «Уточняется», а не спрятаны
 * (COMPLIANCE-CHECK.md). Заказ — переписка с инженером
 * (`/contact?topic=vds`), как и было.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = dict(locale).vds;
  const vars = {
    price: formatUsd(SERVER_ENTRY_USD, locale),
    count: SERVERS.length,
    word: pluralize(locale, SERVERS.length, t.meta.metaWord),
  };
  return {
    title: fill(t.meta.title, vars),
    description: fill(t.meta.description, vars),
  };
}

function specs(s: ServerTier, locale: Locale, t: Dict["vds"]): Array<[string, string]> {
  const x = serverText(s, locale);
  return [
    [t.spec.cpu, x.cpu],
    [t.spec.ram, fill(t.ramUnit, { n: s.ramGb })],
    [t.spec.disks, x.disks],
    [
      t.spec.port,
      `${s.portGbps} ${t.speedUnit} · ${s.meteredTraffic ? t.portMetered : t.portUnmetered}`,
    ],
    [t.spec.protection, protection(locale).row],
  ];
}

export default async function VdsPage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.vds;
  const to = (href: string) => localeHref(href, locale);
  const entry = formatUsd(SERVER_ENTRY_USD, locale);
  const configs = fill(t.configsTitle, {
    count: SERVERS.length,
    word: pluralize(locale, SERVERS.length, t.configWord),
  });
  const g = guarantees(locale);
  return (
    <VShell>
      <section className="v-section v-center v-glow" aria-labelledby="v-vds-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-vds-title" className="v-h1">
            {t.title} <span className="v-accent">{fill(t.titleAccent, { price: entry })}</span>
          </h1>
          <p className="v-lead">{t.lead}</p>
          <div className="v-actions">
            <Link href="#servers" className="v-btn v-btn-primary">{t.pick}</Link>
            <Link href={to("/pricing")} className="v-btn v-btn-soft">{t.plansLink}</Link>
          </div>
          <p className="v-small">{t.engineer}</p>

          <div className="v-bento" style={{ marginTop: "clamp(32px, 5vw, 48px)" }}>
            <div className="v-tile v-span-2">
              <span className="v-tile-icon" aria-hidden><Icon name="grid" size={22} /></span>
              <h3>{t.tiles.steps}</h3>
              <b className="v-tile-num">{SERVERS.length}</b>
            </div>
            <div className="v-tile v-tile-blue v-span-2">
              <span className="v-tile-icon" aria-hidden><Icon name="bolt" size={22} /></span>
              <h3>{t.tiles.port}</h3>
              <b className="v-tile-num">{SERVER_MAX_GBPS} {t.speedUnit}</b>
            </div>
            <div className="v-tile v-tile-dark v-span-2">
              <span className="v-tile-icon" aria-hidden><Icon name="receipt" size={22} /></span>
              <h3>{t.tiles.entry}</h3>
              <b className="v-tile-num">{entry}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section v-center v-reveal" id="servers" aria-labelledby="v-vds-servers">
        <div className="v-wrap">
          <h2 id="v-vds-servers" className="v-h2">
            {configs}
          </h2>
          <p className="v-lead">{t.configsLead}</p>
          <Carousel label={t.carouselLabel}>
            {SERVERS.map((s) => (
              <article key={s.id} className="v-dcard v-lift" aria-label={`${s.name}: ${serverText(s, locale).role}`}>
                <h3 className="v-dcard-title">{s.name}</h3>
                <p className="v-dcard-desc">{serverText(s, locale).role}</p>
                <ul className="vp-specs" aria-label={t.specsLabel}>
                  {specs(s, locale, t).map(([k, val]) => (
                    <li key={k}>
                      <span className="vp-specs-k">{k}</span>
                      <span className="vp-specs-v">{val}</span>
                    </li>
                  ))}
                </ul>
                {serverText(s, locale).confirm.length > 0 && (
                  <p className="vp-confirm">{t.confirmPrefix} {serverText(s, locale).confirm.join(", ")}.</p>
                )}
                <p className="v-price-row">
                  {s.from ? `${t.from} ` : ""}
                  <b>{formatUsd(s.usd, locale)}</b>
                  <span>{t.perMonth}</span>
                </p>
                <Link href={to("/contact?topic=vds")} prefetch={false} className="v-btn v-btn-primary v-btn-block">{t.pick}</Link>
              </article>
            ))}
          </Carousel>
        </div>
      </section>

      <section className="v-section v-center v-reveal" aria-labelledby="v-vds-guarantee">
        <div className="v-wrap v-narrow">
          <h2 id="v-vds-guarantee" className="v-h2">{t.guaranteeTitle}</h2>
          <p className="v-lead">{t.guaranteeLead}</p>
          <div className="vp-cols vp-cols-2">
            <div className="v-card v-card-pad vp-col-card v-lift">
              <h3 className="vp-col-h vp-col-h-yes">{t.weDo}</h3>
              <ul className="vp-list">
                {g.own.map((item) => (
                  <li key={item.t} className="vp-item">
                    <Icon name="check" size={18} className="vp-item-mark" />
                    <span>
                      <b>{item.t}</b>
                      {item.note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="v-card v-card-pad vp-col-card v-lift">
              <h3 className="vp-col-h">{t.notUs}</h3>
              <ul className="vp-list">
                {g.outside.map((item) => (
                  <li key={item.t} className="vp-item">
                    <Icon name="globe" size={18} className="vp-item-mark vp-item-mark-off" />
                    <span>
                      <b>{item.t}</b>
                      {item.note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="v-car-note">{contractNote(locale)}</p>
        </div>
      </section>

      <section className="v-section v-center v-reveal" aria-labelledby="v-vds-pick">
        <div className="v-wrap v-narrow">
          <h2 id="v-vds-pick" className="v-h2">{t.pickTitle}</h2>
          <p className="v-lead">
            {fill(t.pickLead, {
              price: formatRub(PLANS.basic[1], locale),
              trial: count(locale, TRIAL_DAYS, d.units.day),
            })}
          </p>
          <div className="v-actions">
            <Link href={to("/pricing")} className="v-btn v-btn-primary">{t.pickCta}</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
