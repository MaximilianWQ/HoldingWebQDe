import Link from "next/link";
import VShell from "@/components/vps/VShell";
import PlanCards from "@/components/vps/PlanCards";
import TrafficCards from "@/components/vps/TrafficCards";
import Icon from "@/components/pixel/Icon";
import { BRAND, TRIAL } from "@/components/vps/links";
import { FAQ } from "@/lib/faq";
import { DEVICE_LIMIT, PLAN_CONTENT, PLAN_SPEED, formatRub, pricePerMonth } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
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
      <section className="v-section v-center v-glow" aria-labelledby="vp-title">
        <div className="v-wrap">
          <h1 id="vp-title" className="v-h1 vp-hero-h v-stagger">
            <span className="vp-hero-line">Выберите тариф</span>
            <span className="vp-hero-line vp-hero-line-2 v-accent">{BRAND}</span>
          </h1>
          <p className="v-lead">
            {PLAN_CONTENT.basic.name} хватает для видео и работы, {PLAN_CONTENT.plus.name} — для игр и стримов.
            {" "}{TRIAL} бесплатно, без карты.
          </p>
        </div>
      </section>

      {/* 02 · тарифы */}
      <section className="v-section v-center v-reveal" id="tariffs" aria-labelledby="vp-plans">
        <div className="v-wrap">
          <h2 id="vp-plans" className="v-sr">Тарифы</h2>
          <PlanCards />
        </div>
      </section>

      {/* 03 · чем отличаются тарифы */}
      <section className="v-section v-center v-reveal" aria-labelledby="vp-compare-title">
        <div className="v-wrap v-narrow">
          <h2 id="vp-compare-title" className="v-h2">Чем отличаются тарифы</h2>
          <p className="v-lead">Устройства, страны и надёжность — одинаковые. Разница только в скорости канала.</p>
          <div className="vp-compare">
            {IDS.map((id) => {
              const dark = id === "plus";
              return (
                <div key={id} className={`vp-compare-card v-lift ${dark ? "v-dcard" : "v-card v-card-pad"}`}>
                  {dark && (
                    <span className="v-badge v-badge-lg v-dcard-tag v-badge-solid-blue">Популярный</span>
                  )}
                  <div className="vp-compare-head">
                    <h3 className={dark ? "v-dcard-title" : "vp-compare-name"}>{PLAN_CONTENT[id].name}</h3>
                    <span className={`vp-compare-speed${dark ? " vp-compare-speed-dark" : ""}`}>{PLAN_SPEED[id]} Гбит/с</span>
                  </div>
                  <p className={dark ? "v-dcard-desc" : "v-text"} style={dark ? undefined : { marginTop: 8 }}>
                    {PLAN_CONTENT[id].tagline}.
                  </p>
                  <ul className={`v-checks${dark ? "" : " v-checks-light"}`}>
                    {PLAN_CONTENT[id].features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <p className={`vp-compare-price ${dark ? "v-price-row" : "v-text"}`}>
                    {dark ? (
                      <>
                        от <b>{formatRub(pricePerMonth(id, 12))} ₽</b>
                        <span>в месяц при оплате за год</span>
                      </>
                    ) : (
                      <>от <b style={{ color: "var(--v-ink)" }}>{formatRub(pricePerMonth(id, 12))} ₽</b> в месяц при оплате за год</>
                    )}
                  </p>
                  <Link
                    href={`/subscribe?plan=${id}&period=12`}
                    prefetch={false}
                    className={`v-btn v-btn-block ${dark ? "v-btn-white" : "v-btn-primary"}`}
                  >
                    Выбрать {PLAN_CONTENT[id].name}
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
          <h2 id="vp-bento-title" className="v-h2">В каждом тарифе</h2>
          <p className="v-lead">Одинаково на Basic и Plus — разница только в скорости канала.</p>
          <div className="v-bento vp-bento">
            <div className="v-tile v-span-3 v-lift">
              <span className="v-tile-icon" aria-hidden><Icon name="globe" size={22} /></span>
              <h3>Серверы по всему миру</h3>
              <p>Меняете страну в приложении одним касанием.</p>
              <span className="v-tile-num">
                {COUNTRY_COUNT}
                <span className="vp-tile-unit">{plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}</span>
              </span>
            </div>
            <div className="v-tile v-tile-dark v-span-3 v-lift">
              <span className="v-tile-icon" aria-hidden><Icon name="devices" size={22} /></span>
              <h3>Все ваши устройства</h3>
              <p>Телефон, ноутбук и телевизор — одна подписка.</p>
              <span className="v-tile-num">
                {DEVICE_LIMIT}
                <span className="vp-tile-unit">{plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])}</span>
              </span>
            </div>
            <div className="v-tile v-tile-blue v-span-3 v-lift">
              <span className="v-tile-icon" aria-hidden><Icon name="clock" size={22} /></span>
              <h3>Пробный период</h3>
              <p>Нужна только почта — карту не просим.</p>
              <span className="v-tile-num">
                {TRIAL_DAYS}
                <span className="vp-tile-unit">{plural(TRIAL_DAYS, ["день", "дня", "дней"])} бесплатно</span>
              </span>
            </div>
            <div className="v-tile v-span-3 v-lift">
              <span className="v-tile-icon" aria-hidden><Icon name="lock" size={22} /></span>
              <h3>Платите, когда сами решите</h3>
              <p>Оплата разовая, за выбранный срок.</p>
              <span className="v-tile-num">
                0
                <span className="vp-tile-unit">автосписаний</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 05 · пакеты трафика */}
      <section className="v-section v-center v-reveal" id="traffic" aria-labelledby="vp-traffic">
        <div className="v-wrap">
          <h2 id="vp-traffic" className="v-h2">Пакеты трафика</h2>
          <p className="v-lead">Отдельный ключ с запасом гигабайт — без срока действия, пакеты складываются.</p>
          <TrafficCards />
        </div>
      </section>

      {/* 06 · вопросы */}
      <section className="v-section v-center v-reveal" aria-labelledby="vp-faq-title">
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

      {/* 07 · финал */}
      <section className="v-section v-reveal" aria-labelledby="vp-final-title">
        <div className="v-wrap">
          <div className="v-panel v-center vp-final">
            <h2 id="vp-final-title" className="v-h2">Попробуйте, прежде чем платить</h2>
            <p>Нужна только почта. Карту не просим — ничего не спишется.</p>
            <div className="v-actions">
              <Link href="/auth" prefetch={false} className="v-btn v-btn-white">Попробовать {TRIAL} бесплатно</Link>
            </div>
          </div>
        </div>
      </section>
    </VShell>
  );
}
