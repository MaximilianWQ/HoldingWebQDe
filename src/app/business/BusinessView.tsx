"use client";

import Icon, { type IconName } from "@/components/pixel/Icon";
import BusinessRequestForm from "./BusinessRequestForm";
import { DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { SALES_DESK } from "@/lib/contacts";
import type { Dict } from "@/i18n";
import type { Locale } from "@/lib/locale";
import "@/app/vps-info.css";

/**
 * /business — тело страницы, корпус Atlas Secure VPS (владелец,
 * 17.09.2026: «очень простой, очень приятный сайт стилистики Apple»).
 * Обёртку `VShell` и метаданные держит `page.tsx`.
 *
 * Короткое предложение, четыре пункта пользы, одна форма заявки.
 * Цен на странице нет — корпоративный расчёт зависит от числа мест.
 * Форма и есть финальное действие страницы.
 */
/**
 * Плитки «что входит». Значок, оформление и число от языка не зависят;
 * заголовок и текст берутся из словаря по тому же месту в списке.
 */
const POINTS: Array<{ icon: IconName; tile?: "dark" | "blue"; num?: string }> = [
  { icon: "globe", tile: "blue", num: String(COUNTRY_COUNT) },
  { icon: "devices", tile: "dark", num: String(DEVICE_LIMIT) },
  { icon: "receipt" },
  { icon: "key" },
];

export default function BusinessView({ locale, t }: { locale: Locale; t: Dict["business"] }) {
  const points = POINTS.map((p, i) => ({ ...p, ...t.points[i] }));
  return (
    <>
      <section className="v-section v-center v-glow" aria-labelledby="v-business-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-business-title" className="v-h1">
            {t.title} <span className="v-accent">{t.titleAccent}</span>
          </h1>
          <p className="v-lead">{t.lead}</p>
          <div className="v-actions">
            <a href="#request" className="v-btn v-btn-primary">{t.cta}</a>
            <a href={`mailto:${SALES_DESK.email}`} className="v-btn v-btn-soft">{SALES_DESK.email}</a>
          </div>
        </div>
      </section>

      <section className="v-section v-reveal" style={{ paddingTop: 0 }} aria-label={t.includedLabel}>
        <div className="v-wrap v-narrow">
          <div className="v-bento">
            {points.map((p) => (
              <div key={p.title} className={`v-tile v-span-3${p.tile ? ` v-tile-${p.tile}` : ""}`}>
                <span className="v-tile-icon" aria-hidden><Icon name={p.icon} size={22} /></span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
                {p.num && <b className="v-tile-num">{p.num}</b>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="v-section v-center v-reveal" id="request" aria-labelledby="request-title">
        <div className="v-wrap v-narrow">
          <h2 id="request-title" className="v-h2">{t.formTitle}</h2>
          <p className="v-lead" style={{ marginBottom: 8 }}>{t.formLead}</p>
          <div style={{ marginTop: 32, textAlign: "left" }}>
            <BusinessRequestForm locale={locale} t={t} />
          </div>
        </div>
      </section>
    </>
  );
}
