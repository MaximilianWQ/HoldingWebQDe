import Link from "next/link";
import VShell from "@/components/vps/VShell";
import PlanCards from "@/components/vps/PlanCards";
import TrafficCards from "@/components/vps/TrafficCards";
import { BRAND, TRIAL } from "@/components/vps/links";
import { FAQ } from "@/lib/faq";
import { DEVICE_LIMIT, PLAN_CONTENT, PLAN_SPEED, formatRub, pricePerMonth } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { plural } from "@/lib/ru-words";
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

/** Три-пять вопросов, которые чаще всего мешают решиться на оплату.
 *  Тот же текст размечен как FAQPage в page.tsx — вопросы должны
 *  совпадать один в один. */
const PRICING_QUESTIONS = [
  "Сложно ли настроить?",
  "Что будет, когда закончатся бесплатные дни?",
  "Будут ли списывать деньги автоматически?",
  "Можно ли вернуть деньги?",
  "Хранит ли Atlas историю подключений?",
];

export const PRICING_FAQ = FAQ.filter((item) => PRICING_QUESTIONS.includes(item.q));

export default function PricingView() {
  return (
    <VShell>
      {/* 01 · первый экран */}
      <section className="v-section v-center" aria-labelledby="vp-title">
        <div className="v-wrap">
          <h1 id="vp-title" className="v-h1">
            Выберите свой тариф <span className="v-accent">{BRAND}</span>
          </h1>
          <p className="v-lead">
            {PLAN_CONTENT.basic.name} хватает для видео и работы, {PLAN_CONTENT.plus.name} — для игр и стримов.
            {" "}{TRIAL} бесплатно, без карты.
          </p>
        </div>
      </section>

      {/* 02 · тарифы */}
      <section className="v-section v-center" id="tariffs" aria-labelledby="vp-plans">
        <div className="v-wrap">
          <h2 id="vp-plans" className="v-sr">Тарифы</h2>
          <PlanCards />
        </div>
      </section>

      {/* 03 · пакеты трафика */}
      <section className="v-section v-center" id="traffic" aria-labelledby="vp-traffic">
        <div className="v-wrap">
          <h2 id="vp-traffic" className="v-h2">Пакеты трафика</h2>
          <p className="v-lead">Отдельный ключ с запасом гигабайт — без срока действия, пакеты складываются.</p>
          <TrafficCards />
        </div>
      </section>

      {/* 04 · чем отличаются тарифы */}
      <section className="v-section v-center" aria-labelledby="vp-compare-title">
        <div className="v-wrap v-narrow">
          <h2 id="vp-compare-title" className="v-h2">Чем отличаются тарифы</h2>
          <p className="v-lead">Устройства, страны и надёжность — одинаковые. Разница только в скорости канала.</p>
          <div className="vp-compare">
            {IDS.map((id) => (
              <div key={id} className="v-card v-card-pad vp-compare-card">
                <div className="vp-compare-head">
                  <h3 className="vp-compare-name">{PLAN_CONTENT[id].name}</h3>
                  <span className="vp-compare-speed">{PLAN_SPEED[id]} Гбит/с</span>
                </div>
                <p className="v-text" style={{ marginTop: 8 }}>{PLAN_CONTENT[id].tagline}.</p>
                <ul className="v-checks v-checks-light">
                  {PLAN_CONTENT[id].features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="v-text" style={{ marginTop: 20 }}>
                  от <b style={{ color: "var(--v-ink)" }}>{formatRub(pricePerMonth(id, 12))} ₽</b> в месяц при оплате за год
                </p>
              </div>
            ))}
          </div>
          <p className="v-small" style={{ marginTop: 24 }}>
            В обоих тарифах: {COUNTRY_COUNT} {plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} на выбор, до{" "}
            {DEVICE_LIMIT} устройств на подписке, без автосписаний.
          </p>
        </div>
      </section>

      {/* 05 · вопросы */}
      <section className="v-section v-center" aria-labelledby="vp-faq-title">
        <div className="v-wrap v-narrow">
          <h2 id="vp-faq-title" className="v-h2">Вопросы до оплаты</h2>
          <div className="vp-faq">
            {PRICING_FAQ.map((item, i) => (
              <details key={item.q} className="vp-q" name="vp-faq" open={i === 0}>
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

      {/* 06 · финал */}
      <section className="v-section v-center" aria-labelledby="vp-final-title">
        <div className="v-wrap">
          <h2 id="vp-final-title" className="v-h2">Попробуйте, прежде чем платить</h2>
          <p className="v-lead">Нужна только почта. Карту не просим — ничего не спишется.</p>
          <div className="v-actions">
            <Link href="/auth" prefetch={false} className="v-btn v-btn-primary">Попробовать {TRIAL} бесплатно</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
