import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import BrandMark from "@/components/pixel/BrandMark";
import Icon from "@/components/pixel/Icon";
import NetMap from "./NetMap";
import Rack from "./Rack";
import { BRAND, TRIAL } from "@/components/vps/links";
import { COUNTRY_COUNT, CITY_COUNT, LOCATIONS } from "@/lib/locations";
import { PLAN_SPEED, DEVICE_LIMIT } from "@/lib/plans";
import { SERVERS, SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { VACANCIES } from "@/lib/careers";
import { plural } from "@/lib/ru-words";
import "@/app/tech.css";
import "./infra.css";

/**
 * /infrastructure — тёмный технологический корпус (владелец,
 * 18.09.2026: «сделать тёмным, технологичным, детализированным, как
 * ecom.tech; рендеры дата-центров и структуры, интерактив, анимации»).
 *
 * Тёмными делаются ровно две страницы — эта и /careers. Они про
 * инженерию и наём, а не про покупку: человек приходит сюда из меню и
 * подвала, и смена материала читается как смена раздела. Витрина и путь
 * оплаты остаются белым корпусом.
 *
 * Чем заменены «рендеры дата-центров»: карта узлов из настоящих
 * координат (`locations.ts` + текстовая маска суши `world-map.ts`) и
 * векторная схема стойки. Фотографий наших площадок у нас нет, а чужие
 * снимки серверной — тот самый сток, который на сайте запрещён.
 *
 * ЧТО НЕ ПОКАЗЫВАЕМ: отклик по городам (в `locations.ts` это оценка, а
 * не замер), названия площадок и точек обмена трафиком (нужно право
 * упоминания), сертификаты (нужен документ). Список — в
 * COMPLIANCE-CHECK.md; на странице его нет: покупателю не показывают
 * внутреннюю сверку.
 */
const COUNTRY_WORD = plural(COUNTRY_COUNT, ["страна", "страны", "стран"]);
const CITY_WORD = plural(CITY_COUNT, ["город", "города", "городов"]);

export const metadata: Metadata = {
  title: `Инфраструктура: узлы в ${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}`,
  description:
    `Как устроена сеть ${BRAND}: узлы в ${COUNTRY_COUNT} ${COUNTRY_WORD} и ${CITY_COUNT} ${CITY_WORD}, ` +
    `ширина канала до ${PLAN_SPEED.plus} Гбит/с, резервные каналы и наблюдаемость. Числа — из кода сервиса.`,
  alternates: { canonical: "/infrastructure" },
};

const FIGURES = [
  { n: String(COUNTRY_COUNT), cap: `${COUNTRY_WORD} на выбор — страна меняется в приложении, а не покупается отдельно` },
  { n: String(CITY_COUNT), cap: `${CITY_WORD} с узлами: чем ближе узел, тем меньше дорога до сервиса` },
  { n: `${PLAN_SPEED.plus}`, cap: `Гбит/с — ширина канала на тарифе Plus, ${PLAN_SPEED.basic} Гбит/с на Basic` },
  { n: String(DEVICE_LIMIT), cap: `${plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])} на одной подписке, каждое со своим ключом` },
];

const LAYERS = [
  {
    icon: "globe" as const,
    t: "Сеть",
    d: "Узлы в разных странах, балансировка внутри площадки и резервные каналы между ними.",
  },
  {
    icon: "key" as const,
    t: "Ключи и доступ",
    d: "Каждому устройству свой ключ. Отозвать один — остальные продолжают работать.",
  },
  {
    icon: "receipt" as const,
    t: "Биллинг",
    d: "Срок подписки — событие в журнале, а не поле в базе: историю можно проследить целиком.",
  },
  {
    icon: "shield" as const,
    t: "Наблюдаемость",
    d: "Метрики и алерты на каждом участке: инцидент видит дежурный, а не пользователь.",
  },
];

export default function InfrastructurePage() {
  return (
    <VShell>
      <div className="t">
        {/* 01 · первый экран */}
        <section className="t-sec ti-hero" aria-labelledby="ti-title">
          <div className="t-wrap">
            <p className="t-label ti-mark">
              <span className="ti-mark-logo" aria-hidden><BrandMark size={16} /></span>
              Инфраструктура
            </p>
            <h1 id="ti-title" className="t-h1">
              Сеть, на которой всё держится
            </h1>
            <p className="t-lead">
              Узлы в {COUNTRY_COUNT} {COUNTRY_WORD} и {CITY_COUNT} {CITY_WORD}, панель, биллинг и дежурство. Ниже —
              как это устроено и что из этого можно проверить.
            </p>
            <div className="t-actions">
              <Link className="t-btn" href="/auth" prefetch={false}>
                Попробовать {TRIAL} бесплатно
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link className="t-btn t-btn-accent" href="/careers">
                Вакансии · {VACANCIES.length}
              </Link>
            </div>
          </div>
        </section>

        {/* 02 · числа */}
        <section className="t-sec t-reveal" aria-labelledby="ti-figures">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="ti-figures" className="t-split-title">Статистика</h2>
              <div className="t-figures">
                {FIGURES.map((f) => (
                  <div key={f.cap} className="ti-figure">
                    <b className="t-num">{f.n}</b>
                    <p className="t-num-cap">{f.cap}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 03 · карта узлов */}
        <section className="t-sec t-reveal" id="map" aria-labelledby="ti-map-h">
          <div className="t-wrap">
            <div className="t-split">
              <div>
                <h2 id="ti-map-h" className="t-split-title">Карта узлов</h2>
                <p className="t-text">
                  Города берутся из того же списка, по которому приложение показывает страны. Дуги — не украшение:
                  так выглядит обмен между опорным узлом и дальними площадками.
                </p>
                <p className="t-text">
                  Отклик по городам на странице не пишем: сейчас это расчёт по расстоянию, а не замер. Появится
                  замер — появится число.
                </p>
              </div>
              <NetMap />
            </div>
          </div>
        </section>

        {/* 04 · стойка */}
        <section className="t-sec t-reveal" aria-labelledby="ti-rack-h">
          <div className="t-wrap">
            <div className="t-split">
              <div>
                <h2 id="ti-rack-h" className="t-split-title">Что стоит за подключением</h2>
                <p className="t-text">
                  Наведите на юнит — увидите, за что он отвечает. Это схема состава, а не фотография помещения:
                  снимков наших площадок мы не публикуем, а чужие показывать нечестно.
                </p>
              </div>
              <Rack />
            </div>
          </div>
        </section>

        {/* 05 · слои */}
        <section className="t-sec t-reveal" aria-labelledby="ti-layers-h">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="ti-layers-h" className="t-split-title">Из чего собрано</h2>
              <div className="t-cards t-cards-2">
                {LAYERS.map((l) => (
                  <article key={l.t} className="t-panel ti-layer">
                    <span className="ti-layer-icon" aria-hidden><Icon name={l.icon} size={26} /></span>
                    <h3 className="t-card-h">{l.t}</h3>
                    <p className="t-card-t">{l.d}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 06 · выделенные серверы */}
        <section className="t-sec t-reveal" aria-labelledby="ti-vds-h">
          <div className="t-wrap">
            <div className="ti-final">
              <div>
                <h2 id="ti-vds-h" className="t-h2">Нужен сервер целиком?</h2>
                <p className="t-lead">
                  {SERVERS.length} {plural(SERVERS.length, ["конфигурация", "конфигурации", "конфигураций"])} по
                  ширине канала, от {formatUsd(SERVER_ENTRY_USD)} в месяц. Железо ни с кем не делится.
                </p>
                <div className="t-actions">
                  <Link className="t-btn" href="/vds">
                    Выделенные серверы
                    <Icon name="arrow-right" size={16} />
                  </Link>
                  <Link className="t-btn t-btn-accent" href="/careers">
                    Идите к нам работать
                  </Link>
                </div>
              </div>
              <p className="ti-final-note t-mono">
                {LOCATIONS.length} {COUNTRY_WORD} · {CITY_COUNT} {CITY_WORD} · до {PLAN_SPEED.plus} Гбит/с
              </p>
            </div>
          </div>
        </section>
      </div>
    </VShell>
  );
}
