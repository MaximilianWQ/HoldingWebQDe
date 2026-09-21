"use client";

import { useState } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { APPS, PLATFORMS, pick, type Platform } from "@/lib/apps";
import { localeHref, type Locale } from "@/lib/locale";
import { mainKey, switchHint, type KeyAudience } from "@/lib/key-names";
import { fill, type Dict } from "@/i18n";
import HappPhone from "./HappPhone";

/**
 * Тело /install-happ — корпус Atlas Secure VPS (17.09.2026).
 *
 * Устроено как /install-ios: один живой телефон (HappPhone, сцена
 * "tour") рядом с чек-листом шагов, текущий шаг читается через
 * `onScene` и подсвечивается в такт анимации. Клиентский компонент —
 * ради этого состояния; метаданные страницы остаются в серверном
 * page.tsx.
 *
 * Ссылки на приложение — только из src/lib/apps.ts (единственный
 * источник адресов магазинов и установщиков), слова про ключи — из
 * src/lib/key-names.ts (гостю без «VPN», на обоих языках).
 *
 * Подписи приходят пропсом `t` от серверного page.tsx: клиентский
 * компонент словарь не импортирует, иначе в браузер уехали бы оба
 * языка (21.09.2026).
 */

type Scene = 1 | 2 | 3 | 4 | 5 | 6;

const PLATFORM_ICON: Record<Platform, IconName> = {
  ios: "iphone",
  android: "android",
  macos: "macos",
  windows: "windows",
  tv: "tv",
};

export default function InstallHappView({
  aud,
  locale,
  t,
}: {
  aud: KeyAudience;
  locale: Locale;
  t: Dict["installHapp"];
}) {
  const [active, setActive] = useState<Scene>(1);
  const to = (href: string) => localeHref(href, locale);

  const steps: { t: string; d: string; tip?: string }[] = [
    { ...t.s1, d: fill(t.s1.d, { key: mainKey(aud, locale).name }) },
    t.s2,
    t.s3,
    t.s4,
    t.s5,
    { ...t.s6, tip: switchHint(aud, locale) },
  ];

  return (
    <>
      <section className="v-section v-glow ih-hero" aria-labelledby="ih-title">
        <div className="v-wrap ih-grid">
          <figure className="ih-art">
            <HappPhone scene="tour" eager audience={aud} locale={locale} onScene={setActive} label={t.tourLabel} t={t.phone} />
          </figure>
          <div className="ih-copy">
            <p className="ih-kicker">{t.kicker}</p>
            <h1 id="ih-title" className="v-h2" style={{ textAlign: "left" }}>
              {t.titleBefore}
              <span className="v-accent">{t.titleAccent}</span>
              {t.titleAfter}
            </h1>
            <p className="v-lead" style={{ textAlign: "left" }}>
              {t.lead}
            </p>
            <ol className="v-steps ih-steps">
              {steps.map((s, k) => {
                const n = (k + 1) as Scene;
                return (
                  <li key={s.t} className="v-step ih-step" data-active={active === n ? "true" : undefined}>
                    <div className="v-step-head">
                      <span className="v-step-check" aria-hidden>
                        {n}
                      </span>
                      <h3>{s.t}</h3>
                    </div>
                    <p>{s.d}</p>
                    {s.tip && <p className="ih-tip">{s.tip}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href={to(aud === "member" ? "/dashboard" : "/auth")} className="v-btn v-btn-primary">
                {aud === "member" ? t.ctaMember : t.ctaGuest}
              </Link>
              <Link href={to("/devices")} className="v-btn v-btn-soft">
                {t.ctaApps}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section ih-get v-reveal" aria-labelledby="ih-get-title">
        <div className="v-wrap">
          <div className="ih-get-head">
            <h2 id="ih-get-title" className="v-h2" style={{ textAlign: "left" }}>
              {t.getTitle}
            </h2>
            <p className="v-lead" style={{ textAlign: "left" }}>
              {t.getLead}
            </p>
          </div>
          <div className="ih-cards">
            {PLATFORMS.map((p) => {
              const app = APPS[p.id].find((a) => a.id === "happ");
              if (!app) return null;
              return (
                <div key={p.id} className="ih-card">
                  <div className="ih-card-head">
                    <span className="ih-card-ico" aria-hidden>
                      <Icon name={PLATFORM_ICON[p.id]} size={22} />
                    </span>
                    <h3>{p.name}</h3>
                  </div>
                  <p className="ih-card-note">{pick(app.note, locale)}</p>
                  <div className="ih-card-links">
                    {app.links.map((l) => (
                      <a
                        key={l.href}
                        className={`v-btn v-btn-sm ${l.secondary ? "v-btn-outline" : "v-btn-dark"}`}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {pick(l.label, locale)}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="v-section ih-done v-reveal" aria-labelledby="ih-done-title">
        <div className="v-wrap">
          <div className="ih-done-card">
            <h2 id="ih-done-title" className="ih-h2">
              {t.doneTitle}
            </h2>
            <p className="ih-text">{t.doneText}</p>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href={to("/support")} className="v-btn v-btn-white">
                {t.doneSupport}
              </Link>
              <Link href={to("/devices")} className="v-btn v-btn-outline">
                {t.doneAll}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
