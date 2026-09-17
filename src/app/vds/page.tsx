import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Carousel from "@/components/vps/Carousel";
import Icon from "@/components/pixel/Icon";
import { PLANS, formatRub } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural, wordsFeminine, capitalize } from "@/lib/ru-words";
import {
  SERVERS,
  SERVER_ENTRY_USD,
  SERVER_MAX_GBPS,
  GUARANTEES,
  formatUsd,
  type ServerTier,
} from "@/lib/servers";
import "@/app/vps-info.css";

/**
 * /vds — корпус Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple»).
 *
 * Серверный компонент без состояния: конфигурации — чёрные карточки
 * `.v-dcard` в общей карусели (`Carousel`), данные — только
 * `src/lib/servers.ts`. Незакрытые параметры каждой ступени показаны
 * прямо на карточке строкой «Уточняется», а не спрятаны
 * (COMPLIANCE-CHECK.md). Заказ — переписка с инженером
 * (`/contact?topic=vds`), как и было.
 */
export const metadata: Metadata = {
  title: `Выделенные серверы от ${formatUsd(SERVER_ENTRY_USD)} в месяц`,
  description:
    `${capitalize(wordsFeminine(SERVERS.length))} ${plural(SERVERS.length, ["конфигурация", "конфигурации", "конфигураций"])} ` +
    `выделенных серверов Atlas Secure VPS от ${formatUsd(SERVER_ENTRY_USD)} в месяц. Сервер целиком ваш — ` +
    "цена, память, диски и скорость порта указаны на странице, ещё до заявки.",
  alternates: { canonical: "/vds" },
};

const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;

function specs(s: ServerTier): Array<[string, string]> {
  return [
    ["Процессор", s.cpu],
    ["Память", `${s.ramGb} ГБ ECC`],
    ["Диски", s.disks],
    ["Порт", `${s.portGbps} Гбит/с · ${s.meteredTraffic ? "трафик считается" : "без учёта трафика"}`],
    ["Защита от атак", s.ddos],
  ];
}

export default function VdsPage() {
  return (
    <VShell>
      <section className="v-section v-center v-glow" aria-labelledby="v-vds-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-vds-title" className="v-h1">
            Выделенные серверы <span className="v-accent">от {formatUsd(SERVER_ENTRY_USD)}</span>
          </h1>
          <p className="v-lead">Сервер целиком ваш: процессор, память и порт ни с кем не делятся.</p>
          <div className="v-actions">
            <Link href="#servers" className="v-btn v-btn-primary">Подобрать сервер</Link>
            <Link href="/pricing" className="v-btn v-btn-soft">Тарифы ускорителя</Link>
          </div>
          <p className="v-small">Отвечает инженер, а не отдел продаж.</p>

          <div className="v-bento" style={{ marginTop: "clamp(32px, 5vw, 48px)" }}>
            <div className="v-tile v-span-2">
              <span className="v-tile-icon" aria-hidden><Icon name="grid" size={22} /></span>
              <h3>Ступеней линейки</h3>
              <b className="v-tile-num">{SERVERS.length}</b>
            </div>
            <div className="v-tile v-tile-blue v-span-2">
              <span className="v-tile-icon" aria-hidden><Icon name="bolt" size={22} /></span>
              <h3>Порт до</h3>
              <b className="v-tile-num">{SERVER_MAX_GBPS} Гбит/с</b>
            </div>
            <div className="v-tile v-tile-dark v-span-2">
              <span className="v-tile-icon" aria-hidden><Icon name="receipt" size={22} /></span>
              <h3>Входная цена</h3>
              <b className="v-tile-num">{formatUsd(SERVER_ENTRY_USD)}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section v-center v-reveal" id="servers" aria-labelledby="v-vds-servers">
        <div className="v-wrap">
          <h2 id="v-vds-servers" className="v-h2">
            {capitalize(wordsFeminine(SERVERS.length))} {plural(SERVERS.length, ["конфигурация", "конфигурации", "конфигураций"])}
          </h2>
          <p className="v-lead">Чем шире порт, тем больше данных сервер отдаёт одновременно — поэтому линейка растёт по скорости порта, а не по числу ядер.</p>
          <Carousel label="Конфигурации выделенных серверов">
            {SERVERS.map((s) => (
              <article key={s.id} className="v-dcard v-lift" aria-label={`${s.name}: ${s.role}`}>
                <h3 className="v-dcard-title">{s.name}</h3>
                <p className="v-dcard-desc">{s.role}</p>
                <ul className="vp-specs" aria-label="Характеристики">
                  {specs(s).map(([k, val]) => (
                    <li key={k}>
                      <span className="vp-specs-k">{k}</span>
                      <span className="vp-specs-v">{val}</span>
                    </li>
                  ))}
                </ul>
                {s.confirm.length > 0 && <p className="vp-confirm">Уточняется: {s.confirm.join(", ")}.</p>}
                <p className="v-price-row">
                  {s.from ? "от " : ""}
                  <b>{formatUsd(s.usd)}</b>
                  <span>в месяц</span>
                </p>
                <Link href="/contact?topic=vds" prefetch={false} className="v-btn v-btn-primary v-btn-block">Подобрать сервер</Link>
              </article>
            ))}
          </Carousel>
        </div>
      </section>

      <section className="v-section v-center v-reveal" aria-labelledby="v-vds-guarantee">
        <div className="v-wrap v-narrow">
          <h2 id="v-vds-guarantee" className="v-h2">Что гарантируем</h2>
          <p className="v-lead">Названная граница честнее общих слов: вот что обещано, а что ещё уточняется.</p>
          <div className="vp-cols vp-cols-3">
            <div className="v-card v-card-pad vp-col-card v-lift">
              <h3 className="vp-col-h">Гарантируем <b>{GUARANTEES.yes.length}</b></h3>
              <ul className="vp-list">
                {GUARANTEES.yes.map((t) => (
                  <li key={t} className="vp-item">
                    <Icon name="check" size={18} className="vp-item-mark" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="v-card v-card-pad vp-col-card v-lift">
              <h3 className="vp-col-h">Не гарантируем <b>{GUARANTEES.no.length}</b></h3>
              <ul className="vp-list">
                {GUARANTEES.no.map((t) => (
                  <li key={t} className="vp-item vp-item-no">
                    <Icon name="close" size={18} className="vp-item-mark vp-item-mark-off" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="v-card v-card-pad vp-col-card v-lift">
              <h3 className="vp-col-h">Уточняем <b>{GUARANTEES.confirm.length}</b></h3>
              <ul className="vp-list">
                {GUARANTEES.confirm.map((t) => (
                  <li key={t} className="vp-item">
                    <Icon name="clock" size={18} className="vp-item-mark vp-item-mark-off" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section v-center v-reveal" aria-labelledby="v-vds-pick">
        <div className="v-wrap v-narrow">
          <h2 id="v-vds-pick" className="v-h2">Нужен просто быстрый интернет?</h2>
          <p className="v-lead">Для себя — тарифы VPS-ускорителя от {formatRub(PLANS.basic[1])} ₽ в месяц. Первые {TRIAL} бесплатно.</p>
          <div className="v-actions">
            <Link href="/pricing" className="v-btn v-btn-primary">Смотреть тарифы</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
