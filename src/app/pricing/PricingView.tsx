"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { FAQ } from "@/lib/faq";
import {
  DEVICE_LIMIT,
  PERIODS,
  PERIOD_LABEL,
  PLANS,
  PLAN_CONTENT,
  PLAN_SPEED,
  discountPercent,
  formatRub,
  pricePerMonth,
  savings,
  type Period,
  type PlanId,
} from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { TRAFFIC_ENTRY_RUB, TRAFFIC_PACKS, TRAFFIC_TRIAL_MB, formatPricePerGb } from "@/lib/traffic-packs";
import { plural } from "@/lib/ru-words";
import "./pricing-atlas.css";

/**
 * /pricing — тело листа 10 на корпусе «Атлас-издание».
 *
 * Логика прежняя, один в один: срок по умолчанию — 12 месяцев,
 * переключатель срока (aria-pressed), скидка на кнопке считается по
 * Basic, цена за месяц, сумма за срок и экономия — из plans.ts, того же
 * файла, который читает касса. Оформление — через /auth, как и было.
 *
 * Блоки:
 *   01 первый экран — буквы поднимаются, знаки канала текут
 *   02 срок и цена — сцена: смена срока перелистывает цифры цены
 *   03 что входит — строки ложатся, наведение переворачивает строку
 *   04 пакеты трафика — строки пакетов из traffic-packs.ts (цены только
 *      оттуда, как у тарифов — plans.ts); полоса запаса наливается по
 *      прокрутке, наведение переворачивает строку; «Купить» ведёт в
 *      оплату пакета (/subscribe?product=traffic&pack=…, без сессии —
 *      через вход с возвратом)
 *   05 вопросы — те же, что в разметке FAQPage (page.tsx)
 *   06 финал — кобальтовая плита, одно действие
 *
 * Весь моушн — pricing-atlas.css, раздел «Движение».
 */

const IDS: PlanId[] = ["basic", "plus"];
const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;
const COUNTRY_WORD = plural(COUNTRY_COUNT, ["страна", "страны", "стран"]);
const DEVICE_WORD = plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"]);

const HERO_1 = "два тарифа";
const HERO_2 = "разница в скорости";

/**
 * Пакеты трафика на витрине. Слов «VPN» и «обход» здесь нет (правила
 * витрины, CLAUDE.md): отдельный ключ с запасом гигабайт, без срока,
 * пакеты складываются. «Чем больше, тем дешевле гигабайт» не пишем —
 * цена за ГБ у пакетов не монотонна; она показана у каждой строки.
 */
const TRAFFIC_FACTS: [string, string][] = [
  ["Без срока действия", "Ключ не сгорает в конце месяца — он работает, пока есть гигабайты."],
  ["Пакеты складываются", "Купили ещё — новые гигабайты прибавились к тому, что осталось."],
  ["Отдельно от подписки", "Свой ключ и своя ссылка. Покупать подписку для него не нужно."],
];

const GB_MIN = Math.min(...TRAFFIC_PACKS.map((p) => p.gb));
const GB_MAX = Math.max(...TRAFFIC_PACKS.map((p) => p.gb));
/** Длина полосы запаса: объём в логарифмической шкале (15 ГБ … 5000 ГБ). */
const packLen = (gb: number) => (0.1 + (0.9 * Math.log(gb / GB_MIN)) / Math.log(GB_MAX / GB_MIN)).toFixed(3);

/** Пользовательские свойства в style без приведения на каждом месте. */
const v = (vars: Record<string, string | number>) => vars as CSSProperties;

/**
 * Знак канала: толщина пропорциональна скорости тарифа, поток по нему
 * во столько же раз быстрее (та же формула, что на главной).
 */
function lane(id: PlanId, max: number): CSSProperties {
  return v({
    "--w": `${Math.max(2, Math.round((PLAN_SPEED[id] / PLAN_SPEED.plus) * max))}px`,
    "--flow": `${((2.4 * PLAN_SPEED.plus) / PLAN_SPEED[id]).toFixed(2)}s`,
  });
}

/**
 * Разбивка по буквам делается сервером: разметка приезжает разобранной.
 * Слово держится целиком (nowrap), иначе на телефоне строка рвётся
 * между буквами. Чтец экрана получает строку из aria-label заголовка.
 */
function Chars({ text, start = 0 }: { text: string; start?: number }) {
  let n = start;
  const words = text.split(" ");
  return (
    <>
      {words.map((word, w) => (
        <span key={w}>
          <span className="ap-w">
            {[...word].map((ch) => {
              const i = n++;
              return (
                <span key={i} className="a-char" style={v({ "--i": i })}>
                  {ch}
                </span>
              );
            })}
          </span>
          {w < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/** Разбивка по словам: слова финала проявляются по прокрутке (atlas.css). */
function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="a-word" style={v({ "--i": i })}>{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

/**
 * Перелистывание цены. Каждая цифра — окно высотой в строку; сменившаяся
 * цифра уезжает вверх, новая поднимается снизу. Не счётчик 0 → N: цифра
 * не перебирает промежуточные значения, меняется только то, что
 * изменилось. Без смены срока (первая отрисовка) ничего не движется.
 */
function Flip({ value, from, tick }: { value: string; from?: string; tick: number }) {
  const now = [...value];
  const was = from !== undefined ? [...from] : null;
  const aligned = was !== null && was.length === now.length;
  return (
    <span className="ap-flip" aria-hidden>
      {now.map((ch, i) => {
        const changed = was !== null && (!aligned || was[i] !== ch);
        return (
          <span key={i} className="ap-cell" style={v({ "--i": i })}>
            {changed ? (
              <>
                <span key={`o${tick}`} className="ap-out">{aligned ? was?.[i] : " "}</span>
                <span key={`n${tick}`} className="ap-in">{ch}</span>
              </>
            ) : (
              <span className="ap-still">{ch}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export default function PricingView() {
  const [period, setPeriod] = useState<Period>(12);
  // Только для перелистывания цифр: какой срок уходит и номер смены.
  // На выбор срока, суммы и ссылки не влияет.
  const [flip, setFlip] = useState<{ from: Period; tick: number } | null>(null);

  function choose(p: Period) {
    if (p !== period) setFlip((f) => ({ from: period, tick: (f?.tick ?? 0) + 1 }));
    setPeriod(p);
  }

  return (
    <main id="main" className="a-main">
      {/* ── 01 · Первый экран ─────────────────────────────────────── */}
      <section className="a-sheet ap-cover" data-sheet="10" data-title="Тарифы" aria-labelledby="ap-title">
        <div className="a-field">
          <h1 id="ap-title" className="ap-display" aria-label={`${HERO_1}: ${HERO_2}`}>
            <span className="ap-line ap-line-1" aria-hidden><Chars text={HERO_1} /></span>
            <span className="ap-line ap-line-2" aria-hidden><Chars text={HERO_2} start={HERO_1.length} /></span>
          </h1>

          <div className="ap-cover-grid">
            <div>
              <p className="a-lead a-settle">
                {PLAN_CONTENT.basic.name} хватает для видео, сайтов и работы, {PLAN_CONTENT.plus.name} — для
                игр и созвонов. Остальное одинаково: {COUNTRY_COUNT} {COUNTRY_WORD}, до {DEVICE_LIMIT}{" "}
                {DEVICE_WORD} на подписке. Первые {TRIAL} бесплатно, карта не нужна.
              </p>
              <div className="a-actions a-settle" style={v({ "--i": 2 })}>
                <Link href="/auth" className="a-btn a-btn-primary">Попробовать {TRIAL} бесплатно</Link>
                <a href="#plans" className="a-btn a-btn-quiet">Сравнить цены</a>
              </div>
            </div>

            <div
              className="ap-lanes"
              role="img"
              aria-label={`Скорость: ${PLAN_CONTENT.basic.name} — ${PLAN_SPEED.basic} Гбит/с, ${PLAN_CONTENT.plus.name} — ${PLAN_SPEED.plus} Гбит/с`}
            >
              {IDS.map((id, i) => (
                <div key={id} className="ap-lane a-slide" style={v({ "--i": i + 2, "--dir": 1 })}>
                  <span className="ap-lane-name">{PLAN_CONTENT[id].name}</span>
                  <span className="a-sym a-print" style={lane(id, 18)}>
                    <span className="a-sym-flow a-idle" />
                  </span>
                  <span className="ap-lane-val"><b className="a-num">{PLAN_SPEED[id]}</b> Гбит/с</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 · Срок и цена — сцена перелистывания ───────────────── */}
      <section className="a-sheet ap-plans" data-sheet="10" data-title="Срок и цена" id="plans" aria-labelledby="ap-plans-title">
        <div className="a-field">
          <div className="ap-plans-head">
            <div>
              <h2 id="ap-plans-title" className="a-h2 a-settle">
                <span className="a-no">02</span>выберите срок
              </h2>
              <p className="a-p a-settle" style={v({ "--i": 1 })}>
                Чем дольше срок, тем дешевле месяц: за год {PLAN_CONTENT.basic.name} выходит{" "}
                {formatRub(pricePerMonth("basic", 12))} ₽ в месяц вместо {formatRub(PLANS.basic[1])} ₽.
              </p>
            </div>

            <div
              className="ap-period a-settle"
              role="group"
              aria-label="Срок оплаты"
              style={v({ "--k": PERIODS.indexOf(period), "--n": PERIODS.length, "--i": 2 })}
            >
              <span className="ap-period-mark" aria-hidden />
              {PERIODS.map((p) => {
                const off = discountPercent("basic", p);
                return (
                  <button
                    key={p}
                    type="button"
                    className="ap-period-btn"
                    aria-pressed={p === period}
                    onClick={() => choose(p)}
                  >
                    <span className="ap-period-full">{PERIOD_LABEL[p].full}</span>
                    <span className="ap-period-short">{PERIOD_LABEL[p].short}</span>
                    {off > 0 && <span className="ap-period-off">−{off}%</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ap-plan-list">
            {IDS.map((id, i) => {
              const save = savings(id, period);
              const month = formatRub(pricePerMonth(id, period));
              return (
                <div key={id} className="a-slide" style={v({ "--i": i + 3, "--dir": i ? 1 : -1 })}>
                  <article className={`ap-plan ap-plan-${id}`} aria-labelledby={`ap-plan-${id}`}>
                    <div className="ap-plan-head">
                      <h3 id={`ap-plan-${id}`} className="ap-plan-name">{PLAN_CONTENT[id].name}</h3>
                      <p className="ap-plan-tag">{PLAN_CONTENT[id].tagline}</p>
                    </div>

                    <div className="ap-plan-speed">
                      <span className="a-sym" style={lane(id, 6)} aria-hidden>
                        <span className="a-sym-flow a-idle" />
                      </span>
                      <span className="ap-plan-val"><b className="a-num">{PLAN_SPEED[id]}</b> Гбит/с</span>
                    </div>

                    <div className="ap-plan-price">
                      <p className="ap-price">
                        <Flip
                          value={month}
                          from={flip ? formatRub(pricePerMonth(id, flip.from)) : undefined}
                          tick={flip?.tick ?? 0}
                        />
                        <span className="b-sr">{month}</span>
                        <span className="ap-unit">₽ в месяц</span>
                      </p>
                      <p key={period} className={`ap-total${flip ? " ap-swap" : ""}`}>
                        {formatRub(PLANS[id][period])} ₽ за {PERIOD_LABEL[period].accusative}
                        {save > 0 && (
                          <>
                            {" · "}
                            <span className="ap-save">экономия {formatRub(save)} ₽</span>
                          </>
                        )}
                      </p>
                    </div>

                    <Link href="/auth" className="a-btn a-btn-quiet ap-plan-cta">
                      Начать с {PLAN_CONTENT[id].name}
                    </Link>
                  </article>
                </div>
              );
            })}
          </div>

          <p className="ap-fine a-settle" style={v({ "--i": 6 })}>
            Цены в рублях. Платите один раз за весь срок, цена за месяц — для сравнения. Автосписаний нет:
            срок закончился — подписка просто остановится.
          </p>
        </div>
      </section>

      {/* ── 03 · Что входит ──────────────────────────────────────── */}
      <section className="a-sheet ap-inc" data-sheet="10" data-title="Что входит" aria-labelledby="ap-inc-title">
        <div className="a-field">
          <h2 id="ap-inc-title" className="a-h2 a-settle">
            <span className="a-no">03</span>что входит
          </h2>

          <div className="ap-inc-grid">
            {IDS.map((id, k) => (
              <div key={id} className="a-slide" style={v({ "--i": k + 1, "--dir": k ? 1 : -1 })}>
                <h3 className="ap-inc-name">
                  {PLAN_CONTENT[id].name}
                  <span className="a-num">{PLAN_SPEED[id]} Гбит/с</span>
                </h3>
                <ul className="ap-list">
                  {PLAN_CONTENT[id].features.map((f, i) => (
                    <li key={f} className="a-settle" style={v({ "--i": k * 2 + i + 3 })}>
                      <span className="ap-row">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h3 className="ap-both-head a-settle">в обоих тарифах</h3>
          <ul className="ap-list ap-both">
            {[
              `${COUNTRY_COUNT} ${COUNTRY_WORD} на выбор`,
              `До ${DEVICE_LIMIT} ${DEVICE_WORD} на одной подписке`,
              "Историю подключений не храним",
              "Данные не продаём и не передаём",
              "Без автосписаний — продлеваете, когда сами решите",
              "Оплата через платёжного оператора, данные карты к нам не попадают",
            ].map((t, i) => (
              <li key={t} className="a-settle" style={v({ "--i": i + 1 })}>
                <span className="ap-row">{t}</span>
              </li>
            ))}
          </ul>

          <p className="ap-servers a-settle" style={v({ "--i": 8 })}>
            Нужен целый сервер? <Link href="/vds">Выделенные серверы</Link> — от {formatUsd(SERVER_ENTRY_USD)} в месяц.
          </p>
          <p className="ap-servers ap-servers-next a-settle" style={v({ "--i": 9 })}>
            Нужны гигабайты без срока? <a href="#traffic">Пакеты трафика</a> — от {formatRub(TRAFFIC_ENTRY_RUB)} ₽.
          </p>
        </div>
      </section>

      {/* ── 04 · Пакеты трафика ──────────────────────────────────── */}
      <section className="a-sheet ap-traffic" data-sheet="10" data-title="Пакеты трафика" id="traffic" aria-labelledby="ap-traffic-title">
        <div className="a-field">
          <div className="ap-traffic-head">
            <div>
              <h2 id="ap-traffic-title" className="a-h2 a-settle">
                <span className="a-no">04</span>пакеты трафика
              </h2>
              <p className="a-p a-settle" style={v({ "--i": 1 })}>
                Отдельный ключ с запасом гигабайт. Срока у него нет: ключ работает, пока гигабайты не закончатся.
                Докупите пакет — новые гигабайты прибавятся к остатку.
              </p>
            </div>
            <ul className="ap-traffic-facts">
              {TRAFFIC_FACTS.map(([title, text], i) => (
                <li key={title} className="a-settle" style={v({ "--i": i + 2 })}>
                  <b>{title}</b>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <ol className="ap-pack-list" aria-label="Пакеты трафика: объём, цена, цена за гигабайт">
            {TRAFFIC_PACKS.map((p, i) => {
              const price = formatRub(p.priceRub);
              const volume = `${formatRub(p.gb)} ГБ`;
              return (
                <li key={p.id} className="a-slide" style={v({ "--i": Math.min(i, 6) + 1, "--dir": i % 2 ? 1 : -1 })}>
                  <div className="ap-pack">
                    <p className="ap-pack-vol">
                      <b className="a-num">{formatRub(p.gb)}</b> ГБ
                    </p>
                    <span className="ap-pack-bar" style={v({ "--len": packLen(p.gb) })} aria-hidden>
                      <i />
                    </span>
                    <p className="ap-pack-price">
                      <b className="a-num">{price}</b> ₽
                    </p>
                    <p className="ap-pack-per a-num">{formatPricePerGb(p)} ₽ за ГБ</p>
                    <Link
                      href={`/subscribe?product=traffic&pack=${p.id}`}
                      className="a-btn a-btn-quiet ap-pack-cta"
                      aria-label={`Купить ${volume} за ${price} ₽`}
                    >
                      Купить
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="ap-fine a-settle" style={v({ "--i": 4 })}>
            Цены в рублях, оплата разовая, без автосписаний. В пробный период входят {TRAFFIC_TRIAL_MB} МБ на этом ключе.
          </p>
        </div>
      </section>

      {/* ── 05 · Вопросы ─────────────────────────────────────────── */}
      <section className="a-sheet ap-faq" data-sheet="10" data-title="Вопросы" aria-labelledby="ap-faq-title">
        <div className="a-field">
          <h2 id="ap-faq-title" className="a-h2 a-settle">
            <span className="a-no">05</span>вопросы до оплаты
          </h2>
          {/* Один открытый ответ за раз — атрибутом name у <details>, без
              стейта: ответы остаются в разметке и находятся поиском. */}
          <div className="ap-faq-list">
            {FAQ.map((item, i) => (
              <details key={item.q} className="ap-q a-settle" name="ap-faq" open={i === 0} style={v({ "--i": i + 1 })}>
                <summary>
                  <span>{item.q}</span>
                  <span className="ap-q-sign" aria-hidden />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── 06 · Финал ───────────────────────────────────────────── */}
      <section className="a-sheet a-plate a-final ap-final" data-sheet="10" data-title="Попробовать" aria-labelledby="ap-final-title">
        <div className="a-field">
          <h2 id="ap-final-title" className="a-h2">
            <span className="a-no">06</span>
            <Words text={`попробуйте ${TRIAL} бесплатно`} />
          </h2>
          <p className="a-p a-settle" style={v({ "--i": 6 })}>
            Нужна только почта. Карту не просим, поэтому ничего не спишется. Понравится — выберете тариф в кабинете.
          </p>
          <div className="a-actions a-settle" style={v({ "--i": 8 })}>
            <Link href="/auth" className="a-btn a-btn-invert a-idle">Попробовать бесплатно</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
