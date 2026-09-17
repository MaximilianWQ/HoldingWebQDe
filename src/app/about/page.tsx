import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BRAND, TRIAL } from "@/components/vps/links";
import { CITY_COUNT, COUNTRY_COUNT } from "@/lib/locations";
import { DEVICE_LIMIT, PLANS, PLAN_SPEED, formatRub } from "@/lib/plans";
import { SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import "./about-vps.css";

/**
 * /about — корпус Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple — минимум текста»).
 *
 * Одна мысль на экран: обещание → числа → три правила (тёмная плита)
 * → чем мы занимаемся → тарифы. Все числа — из src/lib, как и раньше.
 *
 * СНЯТО ПРИ ПЕРЕВОДЕ (было в прежней версии на «Атлас-издании»):
 * анимированный глобус первого экрана и закреплённая сцена «три
 * правила, проявляющиеся по словам» — декоративный моушн прежнего
 * корпуса, в новом корпусе таких сцен нет ни на одной странице.
 * Смысл текста сохранён целиком.
 */
export const metadata: Metadata = {
  title: "О компании",
  description:
    `${BRAND} — VPS-ускоритель для телефона и компьютера и выделенные серверы. ` +
    `${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}, ` +
    `до ${DEVICE_LIMIT} устройств на подписке. Во что мы верим и что можем подтвердить.`,
  alternates: { canonical: "/about" },
};

const FACTS: Array<{ v: string; label: string; icon: IconName; tile?: "dark" | "blue"; span?: 2 | 3 }> = [
  { v: String(COUNTRY_COUNT), label: `${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} на выбор`, icon: "globe", tile: "blue", span: 3 },
  { v: String(DEVICE_LIMIT), label: `${plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])} на подписке`, icon: "devices", tile: "dark", span: 3 },
  { v: String(CITY_COUNT), label: `${plural(CITY_COUNT, ["город", "города", "городов"])} с серверами`, icon: "grid", span: 2 },
  { v: String(PLAN_SPEED.plus), label: "Гбит/с на тарифе Plus", icon: "bolt", span: 2 },
  { v: String(TRIAL_DAYS), label: `${plural(TRIAL_DAYS, ["день", "дня", "дней"])} бесплатно`, icon: "clock", span: 2 },
];

const RULES: Array<{ t: string; d: string }> = [
  { t: "Чего не собираем, того не украдут.", d: "Храним почту и срок подписки. Посещённые сайты и историю подключений не записываем." },
  { t: "Шифрование включено всегда.", d: "В каждом тарифе и на каждом устройстве, без доплаты и без отдельной настройки." },
  { t: "Пишем только то, что можем показать.", d: "Числа на этом сайте берутся из того же кода, по которому работает сервис." },
];

export default function AboutPage() {
  return (
    <VShell>
      {/* 01 · обещание */}
      <section className="v-section v-center v-glow" aria-labelledby="pa-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="pa-title" className="v-h1">
            Интернет, который <span className="v-accent">просто работает</span>
          </h1>
          <p className="v-lead">
            {BRAND} — VPS-ускоритель для телефона и компьютера и выделенные серверы для проектов.
            Вот во что мы верим и что можем подтвердить.
          </p>
        </div>
      </section>

      {/* 02 · в цифрах — бенто */}
      <section className="v-section v-reveal" aria-labelledby="pa-facts-title">
        <div className="v-wrap">
          <h2 id="pa-facts-title" className="v-sr">Atlas в цифрах</h2>
          <div className="v-bento">
            {FACTS.map((f) => (
              <div key={f.label} className={`v-tile v-span-${f.span ?? 2}${f.tile ? ` v-tile-${f.tile}` : ""}`}>
                <span className="v-tile-icon" aria-hidden><Icon name={f.icon} size={22} /></span>
                <h3>{f.label}</h3>
                <b className="v-tile-num">{f.v}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 03 · три правила */}
      <section className="v-section v-reveal" aria-labelledby="pa-rules-title">
        <div className="v-wrap v-narrow">
          <div className="v-panel">
            <h2 id="pa-rules-title" className="v-h3">
              <span className="v-dot" aria-hidden />
              Три правила
            </h2>
            <ul className="v-checks" style={{ marginTop: 28 }}>
              {RULES.map((r) => (
                <li key={r.t}>
                  <b>{r.t}</b> {r.d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 04 · что мы делаем */}
      <section className="v-section v-center v-reveal" aria-labelledby="pa-make-title">
        <div className="v-wrap">
          <h2 id="pa-make-title" className="v-h2">Что мы делаем</h2>
          <div className="pa-make">
            <Link href="/pricing" className="v-card v-card-pad pa-make-card v-lift">
              <span className="pa-make-icon" aria-hidden><Icon name="bolt" size={24} /></span>
              <h3 className="pa-make-title">VPS-ускоритель</h3>
              <p className="v-text">
                Для телефона и компьютера: сайты и приложения снова открываются на полной скорости.
              </p>
              <p className="pa-make-price">от <b>{formatRub(PLANS.basic[1])} ₽</b> в месяц</p>
            </Link>
            <Link href="/vds" className="v-card v-card-pad pa-make-card v-lift">
              <span className="pa-make-icon" aria-hidden><Icon name="grid" size={24} /></span>
              <h3 className="pa-make-title">Выделенные серверы</h3>
              <p className="v-text">
                Сервер целиком: железо ни с кем не делится, ширину канала выбираете сами.
              </p>
              <p className="pa-make-price">от <b>{formatUsd(SERVER_ENTRY_USD)}</b> в месяц</p>
            </Link>
          </div>
          <p className="v-small" style={{ marginTop: 24 }}>
            Для команды — <Link href="/business" className="v-link">подключения по договору</Link>. Как
            обращаемся с данными — <Link href="/security" className="v-link">безопасность</Link>.
          </p>
        </div>
      </section>

      {/* 05 · финал */}
      <section className="v-section v-center v-reveal" aria-labelledby="pa-final-title">
        <div className="v-wrap v-narrow">
          <h2 id="pa-final-title" className="v-h2">Выберите свой тариф</h2>
          <p className="v-lead">
            Два тарифа, до {DEVICE_LIMIT} {plural(DEVICE_LIMIT, ["устройства", "устройств", "устройств"])} и
            все {COUNTRY_COUNT} {plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} в каждом.
          </p>
          <div className="v-actions">
            <Link href="/pricing" className="v-btn v-btn-primary">Посмотреть тарифы</Link>
            <Link href="/auth" prefetch={false} className="v-btn v-btn-soft">Попробовать {TRIAL} бесплатно</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
