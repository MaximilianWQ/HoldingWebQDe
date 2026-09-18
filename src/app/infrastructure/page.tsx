import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon from "@/components/pixel/Icon";
import { BRAND, TRIAL } from "@/components/vps/links";
import { COUNTRY_COUNT, CITY_COUNT, LOCATIONS } from "@/lib/locations";
import { PLAN_SPEED, DEVICE_LIMIT } from "@/lib/plans";
import { SERVERS, SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { plural } from "@/lib/ru-words";
import "./infra-vps.css";

/**
 * /infrastructure — корпус Atlas Secure VPS (владелец, 17.09.2026).
 *
 * Одна мысль на экран: путь трафика → страны компактной сеткой чипов
 * (вместо векторной карты) → три участка пути → что подтверждено.
 *
 * СНЯТО ПРИ ПЕРЕВОДЕ (было на «Атлас-издании»): SVG-маршрут с бегущей
 * точкой и векторная карта присутствия (`Chart`, `AtlasDefs`) — тяжёлые
 * декоративные сцены прежнего корпуса; бриф прямо просит сетку чипов
 * вместо карты. Список стран и задержек сохранён целиком.
 *
 * ЧТО ОСТАЁТСЯ НЕПОДТВЕРЖДЁННЫМ (как и в прежней версии): отклик по
 * городам — оценка по расстоянию, а не замер; сертификаты, аудиты и
 * названия площадок обмена трафиком не публикуются без документа.
 */
const COUNTRY_WORD = plural(COUNTRY_COUNT, ["страна", "страны", "стран"]);
const CITY_WORD = plural(CITY_COUNT, ["город", "города", "городов"]);

export const metadata: Metadata = {
  title: `Серверы в ${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}: где проходит ваш трафик`,
  description:
    `Путь трафика: ваше устройство, сервер Atlas, сайт. ${COUNTRY_COUNT} ${COUNTRY_WORD}, ` +
    `${CITY_COUNT} ${CITY_WORD}, ширина канала до ${PLAN_SPEED.plus} Гбит/с. ` +
    "Страну выбираете сами: чем ближе сервер, тем быстрее открываются сайты.",
  alternates: { canonical: "/infrastructure" },
};

export default function InfrastructurePage() {
  const byLatency = [...LOCATIONS].sort((a, b) => a.latencyMs - b.latencyMs);
  const closest = byLatency[0];
  const far = byLatency[byLatency.length - 1];

  return (
    <VShell>
      {/* 01 · маршрут */}
      <section className="v-section v-center v-glow" aria-labelledby="pi-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="pi-title" className="v-h1">
            Где проходит <span className="v-accent">ваш трафик</span>
          </h1>
          <p className="v-lead">
            Три участка пути: ваше устройство, сервер {BRAND} и сайт. На каждом — только то, что мы
            можем подтвердить.
          </p>
          <div className="v-actions">
            <Link href="/auth" prefetch={false} className="v-btn v-btn-primary">Попробовать {TRIAL} бесплатно</Link>
            <Link href="#map" className="v-btn v-btn-soft">Смотреть страны</Link>
          </div>
        </div>

        <div className="v-marquee pi-marquee" aria-hidden="true">
          <div className="v-marquee-track">
            {[...byLatency, ...byLatency].map((l, i) => (
              <span key={`${l.code}-${i}`} className="pi-marquee-item">{l.country}</span>
            ))}
          </div>
        </div>
      </section>

      {/* 02 · страны — сетка чипов */}
      <section className="v-section v-center v-reveal" id="map" aria-labelledby="pi-map-title">
        <div className="v-wrap">
          <h2 id="pi-map-title" className="v-h2">{COUNTRY_COUNT} {COUNTRY_WORD}, {CITY_COUNT} {CITY_WORD}</h2>
          <p className="pi-note v-text">
            Страну выбираете вы, и чем ближе сервер, тем быстрее открываются сайты. Ближайшая —{" "}
            {closest.country} ({closest.cities[0]}), около {closest.latencyMs} мс из Москвы; самая
            дальняя — {far.country} ({far.cities[0]}), около {far.latencyMs} мс. Это оценки по
            расстоянию, а не замеры.
          </p>
          <ul className="pi-chips" aria-label="Страны и примерный отклик из Москвы">
            {byLatency.map((l) => (
              <li key={l.code} className="pi-chip">
                <b>{l.country}</b>
                <span>{l.cities.join(", ")} · ≈{l.latencyMs} мс</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 03 · три участка пути */}
      <section className="v-section v-center v-reveal" aria-labelledby="pi-path-title">
        <div className="v-wrap">
          <h2 id="pi-path-title" className="v-h2">Три участка пути</h2>
          <ol className="pi-path">
            <li className="pi-stage v-lift">
              <span className="pi-stage-n" aria-hidden>1</span>
              <div>
                <h3>Шифрование начинается у вас</h3>
                <p>
                  Приложение шифрует трафик прямо на телефоне или компьютере. Провайдер видит, что
                  соединение есть, и не видит, что внутри.
                </p>
              </div>
            </li>
            <li className="pi-stage v-lift">
              <span className="pi-stage-n" aria-hidden>2</span>
              <div>
                <h3>Страну выбираете вы</h3>
                <p>Сервер в выбранной стране передаёт запрос дальше. Что вы открывали, у нас не записывается.</p>
              </div>
            </li>
            <li className="pi-stage v-lift">
              <span className="pi-stage-n" aria-hidden>3</span>
              <div>
                <h3>Ширина канала, а не обещание</h3>
                <p>
                  Чем шире канал, тем реже просадки вечером: {PLAN_SPEED.basic} Гбит/с на Basic и до{" "}
                  {PLAN_SPEED.plus} Гбит/с на Plus.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* 04 · проверяемые числа
          Здесь стоял блок «Что подтверждено, а что ещё нет» с колонкой
          «Ещё не подтверждено — и мы этого не пишем»: площадки,
          сертификаты, отклик по городам. Владелец 18.09.2026 попросил
          убрать, и он прав — покупателю показывали внутреннюю сверку,
          то есть рекламировали отсутствие. Список того, что ждёт
          документов, живёт в COMPLIANCE-CHECK.md; на странице остались
          только числа, которые можно проверить. */}
      <section className="v-section v-center v-reveal" aria-labelledby="pi-honest-title">
        <div className="v-wrap">
          <h2 id="pi-honest-title" className="v-h2">Числа, которые можно проверить</h2>
          <p className="v-lead">
            Всё, что написано на этой странице, берётся из того же кода, по которому работает сервис. Разойтись
            витрине и продукту негде: список стран, состав тарифов и лимит устройств лежат в одном месте.
          </p>
          <div className="v-bento" style={{ marginTop: "clamp(32px, 5vw, 48px)", textAlign: "left" }}>
            <article className="v-span-2 v-tile v-tile-blue v-lift">
              <span className="v-tile-icon" aria-hidden><Icon name="globe" size={22} /></span>
              <h3>География сети</h3>
              <p>Список стран и городов — один на сайт, из него же строится карта</p>
              <b className="v-tile-num">{COUNTRY_COUNT}</b>
              <p>{COUNTRY_WORD}, {CITY_COUNT} {CITY_WORD}</p>
            </article>
            <article className="v-span-2 v-tile v-tile-dark v-lift">
              <span className="v-tile-icon" aria-hidden><Icon name="bolt" size={22} /></span>
              <h3>Ширина канала</h3>
              <p>Из состава тарифов: Basic и Plus</p>
              <b className="v-tile-num">{PLAN_SPEED.basic}–{PLAN_SPEED.plus}</b>
              <p>Гбит/с</p>
            </article>
            <article className="v-span-2 v-tile v-lift">
              <span className="v-tile-icon" aria-hidden><Icon name="devices" size={22} /></span>
              <h3>Устройства</h3>
              <p>Одна подписка на все ваши экраны</p>
              <b className="v-tile-num">{DEVICE_LIMIT}</b>
              <p>{plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])} сразу</p>
            </article>
          </div>
          <div className="v-actions">
            <Link href="/security" className="v-btn v-btn-soft">Что мы знаем о вас</Link>
          </div>
        </div>
      </section>

      {/* 05 · финал */}
      <section className="v-section v-center v-reveal" aria-labelledby="pi-final-title">
        <div className="v-wrap v-narrow">
          <h2 id="pi-final-title" className="v-h2">Нужен сервер целиком?</h2>
          <p className="v-lead">
            Выделенные серверы — от {formatUsd(SERVER_ENTRY_USD)} в месяц, {SERVERS.length}{" "}
            {plural(SERVERS.length, ["ступень", "ступени", "ступеней"])} по ширине канала.
          </p>
          <div className="v-actions">
            <Link href="/vds" className="v-btn v-btn-primary">Выделенные серверы</Link>
            <Link href="/auth" prefetch={false} className="v-btn v-btn-soft">Попробовать ускоритель бесплатно</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
