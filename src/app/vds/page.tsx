import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import AtlasShell from "@/components/atlas/AtlasShell";
import {
  SERVERS,
  SERVER_ENTRY_USD,
  SERVER_MAX_GBPS,
  GUARANTEES,
  formatUsd,
  type ServerTier,
} from "@/lib/servers";
import { PLANS, formatRub } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { capitalize, plural, wordsFeminine } from "@/lib/ru-words";
import "./vds-atlas.css";

/**
 * /vds — лист 11 «Выделенные серверы» на корпусе «Атлас-издание».
 *
 * Серверный компонент: состояния на странице нет, заказ — переписка с
 * инженером (/contact?topic=vds), как и было. Все числа — из
 * src/lib/servers.ts; неподтверждённые параметры каждой конфигурации
 * показаны на странице строкой «Уточняется», а не спрятаны.
 *
 * Блоки:
 *   01 первый экран — буквы поднимаются, дорожки порта вытягиваются
 *   02 конфигурации — сцена: строки раскрываются шторкой по прокрутке
 *   03 что обещаем, а что нет
 *   04 сервер или ускоритель — две строки, куда идти
 *   05 финал — кобальтовая плита, одно действие
 *
 * Весь моушн — vds-atlas.css, раздел «Движение».
 */
export const metadata: Metadata = {
  title: `Выделенные серверы (VDS) от ${formatUsd(SERVER_ENTRY_USD)} в месяц`,
  description:
    `${capitalize(wordsFeminine(SERVERS.length))} ${plural(SERVERS.length, ["конфигурация", "конфигурации", "конфигураций"])} ` +
    `выделенных серверов от ${formatUsd(SERVER_ENTRY_USD)} в месяц, порт до ${SERVER_MAX_GBPS} Гбит/с. ` +
    "Сервер целиком ваш. Цена, память, диски и скорость порта указаны на странице, ещё до заявки.",
  alternates: { canonical: "/vds" },
};

const HERO_1 = "выделенные серверы";
const HERO_2 = `от ${formatUsd(SERVER_ENTRY_USD)} в месяц`;
const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;
const TIERS_WORD = plural(SERVERS.length, ["конфигурация", "конфигурации", "конфигураций"]);

const v = (vars: Record<string, string | number>) => vars as CSSProperties;

/** Длина полосы порта: линейно, с порогом видимости 6% (гигабит иначе — невидимая чёрточка). */
const portLen = (s: ServerTier) => `${Math.max(6, (s.portGbps / SERVER_MAX_GBPS) * 100)}%`;

/** Поток по дорожке тем быстрее, чем шире порт; у гигабита — медленный. */
const portFlow = (s: ServerTier) => `${Math.min(12, (2.4 * SERVER_MAX_GBPS) / s.portGbps).toFixed(2)}s`;

function spec(s: ServerTier): Array<[string, string]> {
  return [
    ["Процессор", s.cpu],
    ["Память", `${s.ramGb} ГБ ECC`],
    ["Диски", s.disks],
    ["Защита от атак", s.ddos],
    ["IP-адреса", s.ip],
  ];
}

const PROMISE: Array<{ kind: "yes" | "no" | "ask"; title: string; items: string[] }> = [
  { kind: "yes", title: "Гарантируем", items: GUARANTEES.yes },
  { kind: "no", title: "Не гарантируем", items: GUARANTEES.no },
  { kind: "ask", title: "Уточняем", items: GUARANTEES.confirm },
];

function Chars({ text, start = 0 }: { text: string; start?: number }) {
  let n = start;
  const words = text.split(" ");
  return (
    <>
      {words.map((word, w) => (
        <span key={w}>
          <span className="av-w">
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

export default function VdsPage() {
  return (
    <AtlasShell sheetNo="11" sheetTitle="Выделенные серверы">
      <main id="main" className="a-main">
        {/* ── 01 · Первый экран ─────────────────────────────────────── */}
        <section className="a-sheet av-cover" data-sheet="11" data-title="Выделенные серверы" aria-labelledby="av-title">
          <div className="a-field">
            <h1 id="av-title" className="av-display" aria-label={`${HERO_1} ${HERO_2}`}>
              <span className="av-line av-line-1" aria-hidden><Chars text={HERO_1} /></span>
              <span className="av-line av-line-2" aria-hidden><Chars text={HERO_2} start={HERO_1.length} /></span>
            </h1>

            <div className="av-cover-grid">
              <div>
                <p className="a-lead a-settle">
                  Сервер целиком ваш: процессор, память и порт ни с кем не делятся. Цена, скорость
                  порта, память и диски написаны ниже — ещё до заявки.
                </p>
                <div className="a-actions a-settle" style={v({ "--i": 2 })}>
                  <Link href="/contact?topic=vds" className="a-btn a-btn-primary">Подобрать сервер</Link>
                  <Link href="/pricing" className="a-btn a-btn-quiet">Тарифы ускорителя</Link>
                </div>
                <p className="a-fine a-settle" style={v({ "--i": 3 })}>Отвечает инженер, а не отдел продаж.</p>
              </div>

              <div className="av-lanes a-settle" style={v({ "--i": 2 })}>
                <p className="av-lanes-head a-wide">скорость порта, Гбит/с</p>
                <div
                  role="img"
                  aria-label={`Скорость порта: ${SERVERS.map((s) => `${s.name} — ${s.portGbps} Гбит/с`).join(", ")}`}
                >
                  {SERVERS.map((s, i) => (
                    <div key={s.id} className="av-lane" style={v({ "--i": i })}>
                      <span className="av-lane-name">{s.name}</span>
                      <span className="av-lane-track">
                        <span className="a-sym" style={v({ "--w": "8px", "--flow": portFlow(s), "--len": portLen(s) })}>
                          <span className="a-sym-flow a-idle" />
                        </span>
                      </span>
                      <span className="av-lane-val a-num">{s.portGbps}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 · Конфигурации — строки раскрываются шторкой ──────── */}
        <section className="a-sheet av-tiers" data-sheet="11" data-title="Конфигурации" id="servers" aria-labelledby="av-tiers-title">
          <div className="a-field">
            <h2 id="av-tiers-title" className="a-h2 a-settle">
              <span className="a-no">02</span>
              {wordsFeminine(SERVERS.length)} {TIERS_WORD}
            </h2>
            <p className="a-p a-settle" style={v({ "--i": 2 })}>
              Чем шире порт, тем больше данных сервер отдаёт одновременно. Поэтому конфигурации
              растут по скорости порта, а не по числу ядер.
            </p>
            <p className="av-swipe-hint a-settle" style={v({ "--i": 2 })} aria-hidden>Листайте карточки →</p>

            <ol className="av-rows">
              {SERVERS.map((s, i) => (
                <li key={s.id} className="a-settle" style={v({ "--i": i + 3 })}>
                  <article className="av-card" aria-labelledby={`av-${s.id}`}>
                    <div className="av-head">
                      <h3 id={`av-${s.id}`} className="av-name">{s.name}</h3>
                      <p className="av-role">{s.role}</p>
                    </div>

                    <div className="av-port">
                      <span className="av-track" aria-hidden>
                        <span
                          className={`av-fill${s.meteredTraffic ? " av-fill-metered" : ""}`}
                          style={v({ "--len": portLen(s) })}
                        />
                      </span>
                      <p className="av-port-val">
                        <b className="a-num">{s.portGbps}</b> Гбит/с
                        <span> · {s.meteredTraffic ? "трафик считается" : "без учёта трафика"}</span>
                      </p>
                    </div>

                    <p className="av-price">
                      <b className="a-num">
                        {s.from ? "от " : ""}
                        {formatUsd(s.usd)}
                      </b>
                      в месяц
                    </p>

                    <div className="av-more">
                      <dl className="av-spec">
                        {spec(s).map(([k, val]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{val}</dd>
                          </div>
                        ))}
                      </dl>
                      {/* Незакрытые параметры показываются, а не прячутся. */}
                      <p className="av-confirm">Уточняется: {s.confirm.join(", ")}.</p>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 03 · Что обещаем, а что нет ──────────────────────────── */}
        <section className="a-sheet av-promise" data-sheet="11" data-title="Что обещаем" aria-labelledby="av-promise-title">
          <div className="a-field">
            <h2 id="av-promise-title" className="a-h2 a-settle">
              <span className="a-no">03</span>что обещаем, а что нет
            </h2>
            <p className="a-p a-settle" style={v({ "--i": 2 })}>
              Пишем заранее, за что отвечаем, — чтобы после оплаты не было сюрпризов.
            </p>

            <div className="av-groups">
              {PROMISE.map((g, k) => (
                <div key={g.kind} className="av-group" data-kind={g.kind}>
                  <h3 className="av-group-head a-slide" style={v({ "--i": k * 2 + 2, "--dir": -1 })}>{g.title}</h3>
                  <ul className="av-list">
                    {g.items.map((t, i) => (
                      <li key={t} className="a-settle" style={v({ "--i": k * 2 + i + 3 })}>
                        <span className="av-row">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 04 · Сервер или ускоритель ───────────────────────────── */}
        <section className="a-sheet av-pick" data-sheet="11" data-title="Что выбрать" aria-labelledby="av-pick-title">
          <div className="a-field">
            <h2 id="av-pick-title" className="a-h2 a-settle">
              <span className="a-no">04</span>сервер или ускоритель
            </h2>

            <div className="av-pick-list">
              <div className="a-slide" style={v({ "--i": 1, "--dir": -1 })}>
                <Link href="#servers" className="av-pick-row">
                  <span className="av-pick-name">выделенный сервер</span>
                  <span className="av-pick-for">
                    Для своего проекта: сайт, база, сервис. Сервер целиком ваш и ни с кем не делится.
                  </span>
                  <span className="av-pick-price">
                    <b className="a-num">от {formatUsd(SERVER_ENTRY_USD)}</b> в месяц
                  </span>
                </Link>
              </div>
              <div className="a-slide" style={v({ "--i": 2, "--dir": 1 })}>
                <Link href="/pricing" className="av-pick-row">
                  <span className="av-pick-name">VPS-ускоритель</span>
                  <span className="av-pick-for">
                    Для себя: чтобы на телефоне и компьютере всё открывалось и не тормозило. Первые {TRIAL} бесплатно.
                  </span>
                  <span className="av-pick-price">
                    <b className="a-num">от {formatRub(PLANS.basic[1])} ₽</b> в месяц
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 05 · Финал ───────────────────────────────────────────── */}
        <section className="a-sheet a-plate a-final av-final" data-sheet="11" data-title="Заявка" aria-labelledby="av-final-title">
          <div className="a-field">
            <h2 id="av-final-title" className="a-h2">
              <span className="a-no">05</span>
              <Words text="подберём сервер под вашу задачу" />
            </h2>
            <p className="a-p a-settle" style={v({ "--i": 6 })}>
              Напишите, что будет работать на сервере. Отвечает инженер. Если подходящей
              конфигурации нет — так и скажем.
            </p>
            <div className="a-actions a-settle" style={v({ "--i": 8 })}>
              <Link href="/contact?topic=vds" className="a-btn a-btn-invert a-idle">Написать инженеру</Link>
            </div>
          </div>
        </section>
      </main>
    </AtlasShell>
  );
}
