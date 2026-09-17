import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon from "@/components/pixel/Icon";
import { BRAND, TRIAL } from "@/components/vps/links";
import { DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import "./security-vps.css";

/**
 * /security — корпус Atlas Secure VPS (владелец, 17.09.2026).
 *
 * Главный объект прежней версии сохранён: два списка — что лежит в
 * базе и чего в ней нет. Второй длиннее, и это по-прежнему видно с
 * первого взгляда (сравнение колонок).
 *
 * ЧТО СНЯТО ПРИ ПЕРЕВОДЕ (было на «Атлас-издании»): полоса из 13 ячеек
 * на первом экране и закреплённая сцена «что видит провайдер» с
 * перечёркиванием по прокрутке — декоративный моушн прежнего корпуса.
 * Смысл сохранён простым абзацем в тёмной плите.
 *
 * ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ: «не храним посещённые сайты, DNS-запросы,
 * историю подключений» — COMPLIANCE-CHECK.md §4. Строка оставлена, как
 * и в прежней версии — файл советует её подтвердить, а не снимать.
 */
export const metadata: Metadata = {
  title: "Безопасность: что мы храним о вас",
  description:
    "Для входа нужна только почта. Не храним ни посещённых сайтов, ни DNS-запросов, " +
    "ни истории подключений, ни IP-адреса. Оба списка — что храним и что нет — целиком на странице.",
  alternates: { canonical: "/security" },
};

const STORED = [
  "Адрес электронной почты",
  "Дата окончания подписки",
  "Служебный номер, по которому выдаётся ключ",
  "Реферальный код, если вы им пользуетесь",
];

const NOT_STORED = [
  "Посещённые сайты",
  "Запросы адресов сайтов (DNS-запросы)",
  "История подключений: когда, откуда, как долго",
  "IP-адрес, с которого вы подключаетесь",
  "Имя, фамилия, отчество",
  "Номер телефона",
  "Почтовый адрес",
  "Данные банковской карты — они остаются у платёжного сервиса",
  "Содержимое трафика",
];

const SEEN = ["Какой сайт вы открыли", "Что вы на нём запросили"];

export default function SecurityPage() {
  const facts: Array<{ v: string; label: string }> = [
    { v: String(STORED.length), label: `${plural(STORED.length, ["поле", "поля", "полей"])} о вас в базе` },
    { v: String(NOT_STORED.length), label: `${plural(NOT_STORED.length, ["пункт", "пункта", "пунктов"])}, которых нет` },
    { v: "1", label: "поле нужно для входа — почта" },
    { v: String(TRIAL_DAYS), label: `${plural(TRIAL_DAYS, ["день", "дня", "дней"])} бесплатно, без карты` },
    { v: String(DEVICE_LIMIT), label: `${plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])} на подписке` },
    { v: String(COUNTRY_COUNT), label: `${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} на выбор` },
  ];

  return (
    <VShell>
      {/* 01 · ответ */}
      <section className="v-section v-center" aria-labelledby="ps-title">
        <div className="v-wrap v-narrow">
          <h1 id="ps-title" className="v-h1">
            Что мы знаем о вас? <span className="v-accent">Почту. И всё.</span>
          </h1>
          <p className="v-lead">
            Ниже — оба списка целиком: что лежит в базе {BRAND} и чего в ней нет. Чего у нас нет, того
            нельзя ни украсть, ни передать.
          </p>
        </div>
      </section>

      {/* 02 · храним и не храним */}
      <section className="v-section v-reveal" id="lists" aria-labelledby="ps-lists-title">
        <div className="v-wrap">
          <h2 id="ps-lists-title" className="v-sr">Храним и не храним</h2>
          <div className="ps-cols">
            <div>
              <h3 className="ps-col-h">Храним <b>{STORED.length}</b></h3>
              <ul className="ps-list">
                {STORED.map((t) => (
                  <li key={t} className="ps-item">
                    <Icon name="check" size={18} className="ps-mark" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="ps-col-h">Не храним <b>{NOT_STORED.length}</b></h3>
              <ul className="ps-list">
                {NOT_STORED.map((t) => (
                  <li key={t} className="ps-item ps-item-no">
                    <Icon name="close" size={18} className="ps-mark ps-mark-off" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 03 · что видит провайдер */}
      <section className="v-section v-reveal" aria-labelledby="ps-see-title">
        <div className="v-wrap v-narrow">
          <div className="v-panel">
            <h2 id="ps-see-title" className="v-h3">
              <span className="v-dot" aria-hidden />
              Что видит ваш провайдер
            </h2>
            <p>
              Без {BRAND} провайдер видит, какой сайт вы открыли и что на нём запросили. С {BRAND} он
              видит только подключение к нашему серверу — что внутри, нет.
            </p>
            <ul className="v-checks" style={{ marginTop: 24 }}>
              {SEEN.map((t) => (
                <li key={t}>{t} — скрыто</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 04 · в цифрах */}
      <section className="v-section v-reveal" aria-labelledby="ps-facts-title">
        <div className="v-wrap">
          <h2 id="ps-facts-title" className="v-sr">В цифрах</h2>
          <div className="ps-facts">
            {facts.map((f) => (
              <div key={f.label} className="ps-fact">
                <b className="ps-fact-v">{f.v}</b>
                <span className="ps-fact-label">{f.label}</span>
              </div>
            ))}
          </div>
          <p className="v-small" style={{ marginTop: 24, textAlign: "center" }}>
            Названий стандартов, аудитов и сертификатов на этой странице нет — они появятся вместе с
            самими документами.
          </p>
        </div>
      </section>

      {/* 05 · финал */}
      <section className="v-section v-center v-reveal" aria-labelledby="ps-final-title">
        <div className="v-wrap v-narrow">
          <h2 id="ps-final-title" className="v-h2">Для входа нужна только почта</h2>
          <p className="v-lead">{TRIAL} бесплатно, без карты. Не понравится — просто не продлевайте.</p>
          <div className="v-actions">
            <Link href="/auth" prefetch={false} className="v-btn v-btn-primary">Попробовать бесплатно</Link>
            <Link href="/privacy" className="v-btn v-btn-soft">Политика приватности</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
