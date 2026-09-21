"use client";

import { useState } from "react";
import Link from "next/link";
import { localeHref, type Locale } from "@/lib/locale";
import type { Dict } from "@/i18n";
import IosPhone from "./IosPhone";

/**
 * Тело /install-ios — корпус Atlas Secure VPS (17.09.2026, доработка
 * поверх перевода того же дня): заголовок с акцентом и `.v-glow`,
 * короткий лид, чек-лист шагов `.v-steps` рядом с живым телефоном (одна
 * сцена "tour" вместо пяти повторов рендера), тёмная плита-переход в
 * кабинет. `IosPhone` — своя механика (см. IosPhone.tsx), тут только
 * читаем текущий шаг тура через `onScene`, чтобы подсветить чек-лист в
 * такт анимации; клиентский компонент — чтобы держать это состояние,
 * метаданные страницы остаются в серверном page.tsx.
 *
 * Подписи приходят пропсом `t` оттуда же: клиентский компонент словарь
 * не импортирует, иначе в браузер уехали бы оба языка (21.09.2026).
 */

type Scene = 1 | 2 | 3 | 4 | 5;

export default function InstallIosView({ locale, t }: { locale: Locale; t: Dict["installIos"] }) {
  const [active, setActive] = useState<Scene>(1);
  const to = (href: string) => localeHref(href, locale);
  const steps: { t: string; d: string; tip?: string }[] = [t.s1, t.s2, t.s3, t.s4, t.s5];

  return (
    <>
      <section className="v-section v-glow" aria-labelledby="vi-title">
        <div className="v-wrap vi-grid">
          <figure className="vi-hero-art">
            <IosPhone scene="tour" eager onScene={setActive} label={t.tourLabel} t={t.phone} />
          </figure>
          <div className="vi-copy">
            <p className="vi-kicker">{t.kicker}</p>
            <h1 id="vi-title" className="v-h2" style={{ textAlign: "left" }}>
              {t.titleBefore}
              <span className="v-accent">{t.titleAccent}</span>
              {t.titleAfter}
            </h1>
            <p className="v-lead" style={{ textAlign: "left" }}>
              {t.lead}
            </p>
            <ol className="v-steps vi-steps">
              {steps.map((s, k) => {
                const n = (k + 1) as Scene;
                return (
                  <li key={s.t} className="v-step vi-step" data-active={active === n ? "true" : undefined}>
                    <div className="v-step-head">
                      <span className="v-step-check" aria-hidden>
                        {n}
                      </span>
                      <h3>{s.t}</h3>
                    </div>
                    <p>{s.d}</p>
                    {s.tip && <p className="vi-tip">{s.tip}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href={to("/dashboard")} className="v-btn v-btn-soft">
                {t.back}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section vi-done v-reveal" aria-labelledby="vi-done-title">
        <div className="v-wrap">
          <div className="vi-done-card">
            <h2 id="vi-done-title" className="vi-h2">
              {t.doneTitle}
            </h2>
            <p className="vi-text">{t.doneText}</p>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href={to("/dashboard")} className="v-btn v-btn-white">
                {t.doneCabinet}
              </Link>
              <Link href={to("/support")} className="v-btn v-btn-outline">
                {t.doneSupport}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
