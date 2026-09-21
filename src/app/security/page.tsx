import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BRAND } from "@/components/vps/links";
import { DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { count, pluralize } from "@/i18n/plural";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
import "@/app/vps-info.css";

/**
 * /security — корпус Atlas Secure VPS (владелец, 17.09.2026).
 *
 * Главный объект прежней версии сохранён: два списка — что лежит в
 * базе и чего в ней нет. Второй длиннее, и это по-прежнему видно с
 * первого взгляда (сравнение колонок).
 *
 * ЧТО СНЯТО ПРИ ПЕРЕВОДЕ (было на «Атлас-издании»): полоса из 13 ячеек
 * на первом экране и закреплённая сцена «что видит провайдер» с
 * перечёркиванием по прокрутке — декоративный моушн прежнего корпуса.
 * Смысл сохранён простым абзацем в тёмной плите.
 *
 * ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ: «не храним посещённые сайты, DNS-запросы,
 * историю подключений» — COMPLIANCE-CHECK.md §4. Строка оставлена, как
 * и в прежней версии — файл советует её подтвердить, а не снимать.
 */
export async function generateMetadata(): Promise<Metadata> {
  const m = dict(await getLocale()).security.meta;
  return { title: m.title, description: m.description };
}

export default async function SecurityPage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.security;
  const to = (href: string) => localeHref(href, locale);
  const STORED = t.storedList;
  const NOT_STORED = t.notStoredList;

  // Длина списков — сама по себе факт страницы: пунктов «чего нет»
  // вдвое больше, и это видно цифрой. Поэтому числа считаются, а не
  // пишутся, и на обоих языках совпадают по построению.
  const facts: Array<{ v: string; label: string; icon: IconName; tile?: "dark" | "blue" }> = [
    { v: String(STORED.length), label: t.facts.stored, icon: "user", tile: "dark" },
    { v: String(NOT_STORED.length), label: t.facts.notStored, icon: "shield", tile: "blue" },
    { v: String(TRIAL_DAYS), label: fill(t.facts.trial, { word: pluralize(locale, TRIAL_DAYS, d.units.day) }), icon: "clock" },
    { v: String(DEVICE_LIMIT), label: fill(t.facts.devices, { word: pluralize(locale, DEVICE_LIMIT, d.units.device) }), icon: "devices" },
    { v: String(COUNTRY_COUNT), label: fill(t.facts.countries, { word: pluralize(locale, COUNTRY_COUNT, d.units.country) }), icon: "globe" },
  ];

  return (
    <VShell>
      {/* 01 · ответ */}
      <section className="v-section v-center v-glow" aria-labelledby="ps-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="ps-title" className="v-h1">
            {t.title} <span className="v-accent">{t.titleAccent}</span>
          </h1>
          <p className="v-lead">{fill(t.lead, { brand: BRAND })}</p>
        </div>
      </section>

      {/* 02 · храним и не храним — две карточки */}
      <section className="v-section v-reveal" id="lists" aria-labelledby="ps-lists-title">
        <div className="v-wrap">
          <h2 id="ps-lists-title" className="v-sr">{t.listsHeading}</h2>
          <div className="vp-cols vp-cols-2">
            <div className="v-card v-card-pad vp-col-card v-lift">
              <h3 className="vp-col-h">{t.stored} <b>{STORED.length}</b></h3>
              <ul className="vp-list">
                {STORED.map((line) => (
                  <li key={line} className="vp-item">
                    <Icon name="check" size={18} className="vp-item-mark" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="v-card v-card-pad vp-col-card v-lift">
              <h3 className="vp-col-h">{t.notStored} <b>{NOT_STORED.length}</b></h3>
              <ul className="vp-list">
                {NOT_STORED.map((line) => (
                  <li key={line} className="vp-item vp-item-no">
                    <Icon name="close" size={18} className="vp-item-mark vp-item-mark-off" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 03 · что видит провайдер */}
      <section className="v-section v-reveal" aria-labelledby="ps-see-title">
        <div className="v-wrap v-narrow">
          <div className="v-panel">
            <h2 id="ps-see-title" className="v-h3">
              <span className="v-dot" aria-hidden />
              {t.seeTitle}
            </h2>
            <p>{fill(t.seeText, { brand: BRAND })}</p>
            <ul className="v-checks" style={{ marginTop: 24 }}>
              {t.seenList.map((line) => (
                <li key={line}>{line} — {t.hidden}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 04 · в цифрах — бенто */}
      <section className="v-section v-reveal" aria-labelledby="ps-facts-title">
        <div className="v-wrap">
          <h2 id="ps-facts-title" className="v-sr">{t.factsHeading}</h2>
          <div className="v-bento">
            {facts.map((f) => (
              <div key={f.label} className={`v-tile v-span-2${f.tile ? ` v-tile-${f.tile}` : ""}`}>
                <span className="v-tile-icon" aria-hidden><Icon name={f.icon} size={22} /></span>
                <h3>{f.label}</h3>
                <b className="v-tile-num">{f.v}</b>
              </div>
            ))}
          </div>
          <p className="v-small" style={{ marginTop: 24, textAlign: "center" }}>
            {t.noCerts}
          </p>
        </div>
      </section>

      {/* 05 · финал */}
      <section className="v-section v-center v-reveal" aria-labelledby="ps-final-title">
        <div className="v-wrap v-narrow">
          <h2 id="ps-final-title" className="v-h2">{t.finalTitle}</h2>
          <p className="v-lead">{fill(t.finalLead, { trial: count(locale, TRIAL_DAYS, d.units.day) })}</p>
          <div className="v-actions">
            <Link href={to("/auth")} prefetch={false} className="v-btn v-btn-primary">{t.tryFree}</Link>
            <Link href={to("/privacy")} className="v-btn v-btn-soft">{t.privacyLink}</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
