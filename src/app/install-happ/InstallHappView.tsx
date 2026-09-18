"use client";

import { useState } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { APPS, PLATFORMS, type Platform } from "@/lib/apps";
import { MAIN_KEY, SWITCH_HINT, type KeyAudience } from "@/lib/key-names";
import HappPhone from "./HappPhone";

/**
 * Тело /install-happ — корпус Atlas Secure VPS (17.09.2026).
 *
 * Устроено как /install-ios: один живой телефон (HappPhone, сцена
 * "tour") рядом с чек-листом шагов, текущий шаг читается через
 * `onScene` и подсвечивается в такт анимации. Клиентский компонент —
 * ради этого состояния; метаданные страницы остаются в серверном
 * page.tsx.
 *
 * Ссылки на приложение — только из src/lib/apps.ts (единственный
 * источник адресов магазинов и установщиков), слова про ключи — из
 * src/lib/key-names.ts (гостю без «VPN»).
 */

type Scene = 1 | 2 | 3 | 4 | 5 | 6;

const PLATFORM_ICON: Record<Platform, IconName> = {
  ios: "iphone",
  android: "android",
  macos: "macos",
  windows: "windows",
  tv: "tv",
};

const TOUR_LABEL =
  "iPhone 17 Pro Max: по очереди показаны все шаги — копирование ссылки в кабинете, «+» в Happ, импорт из буфера обмена, добавленная подписка, выбор страны и подключение";

export default function InstallHappView({ aud }: { aud: KeyAudience }) {
  const [active, setActive] = useState<Scene>(1);

  const steps: { t: string; d: string; tip?: string }[] = [
    {
      t: "Скопируйте ссылку подписки",
      d: `В кабинете у карточки «${MAIN_KEY[aud].name}» нажмите «Скопировать» — ссылка окажется в буфере обмена.`,
      tip: "Ссылку можно не копировать вручную: в кабинете есть кнопка «Открыть в приложении» — она сама передаёт подписку в Happ.",
    },
    { t: "Откройте Happ и нажмите «+»", d: "Кнопка — в шапке списка профилей, справа." },
    {
      t: "Выберите «Импорт из буфера обмена»",
      d: "Happ прочитает ссылку сам. Рядом есть «Сканировать QR-код» — если ссылка открыта на другом устройстве.",
    },
    {
      t: "Подписка добавится сама",
      d: "Появится группа Atlas Secure со списком стран и остатком трафика. Обновляется автоматически раз в час.",
    },
    {
      t: "Выберите страну",
      d: "Первая строка — «Авто»: приложение само берёт самый быстрый сервер. Или выберите страну из списка.",
    },
    {
      t: "Нажмите кнопку подключения",
      d: "В первый раз система спросит разрешение добавить конфигурацию — согласитесь. Дальше подключение занимает пару секунд.",
      tip: SWITCH_HINT[aud],
    },
  ];

  return (
    <>
      <section className="v-section v-glow ih-hero" aria-labelledby="ih-title">
        <div className="v-wrap ih-grid">
          <figure className="ih-art">
            <HappPhone scene="tour" eager audience={aud} onScene={setActive} label={TOUR_LABEL} />
          </figure>
          <div className="ih-copy">
            <p className="ih-kicker">Happ · iPhone, Android, Mac, Windows · около минуты</p>
            <h1 id="ih-title" className="v-h2" style={{ textAlign: "left" }}>
              Подключение в <span className="v-accent">Happ</span> по шагам
            </h1>
            <p className="v-lead" style={{ textAlign: "left" }}>
              Шесть действий: скопировать ссылку в кабинете, вставить её в приложение и нажать кнопку подключения.
            </p>
            <ol className="v-steps ih-steps">
              {steps.map((s, k) => {
                const n = (k + 1) as Scene;
                return (
                  <li key={s.t} className="v-step ih-step" data-active={active === n ? "true" : undefined}>
                    <div className="v-step-head">
                      <span className="v-step-check" aria-hidden>
                        {n}
                      </span>
                      <h3>{s.t}</h3>
                    </div>
                    <p>{s.d}</p>
                    {s.tip && <p className="ih-tip">{s.tip}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href={aud === "member" ? "/dashboard" : "/auth"} className="v-btn v-btn-primary">
                {aud === "member" ? "Открыть кабинет" : "Получить подписку"}
              </Link>
              <Link href="/devices" className="v-btn v-btn-soft">
                Другие приложения
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section ih-get v-reveal" aria-labelledby="ih-get-title">
        <div className="v-wrap">
          <div className="ih-get-head">
            <h2 id="ih-get-title" className="v-h2" style={{ textAlign: "left" }}>
              Где скачать Happ
            </h2>
            <p className="v-lead" style={{ textAlign: "left" }}>
              Приложение бесплатное. Шаги одинаковые на всех системах — отличается только, откуда его ставить.
            </p>
          </div>
          <div className="ih-cards">
            {PLATFORMS.map((p) => {
              const app = APPS[p.id].find((a) => a.id === "happ");
              if (!app) return null;
              return (
                <div key={p.id} className="ih-card">
                  <div className="ih-card-head">
                    <span className="ih-card-ico" aria-hidden>
                      <Icon name={PLATFORM_ICON[p.id]} size={22} />
                    </span>
                    <h3>{p.name}</h3>
                  </div>
                  <p className="ih-card-note">{app.note}</p>
                  <div className="ih-card-links">
                    {app.links.map((l) => (
                      <a
                        key={l.label}
                        className={`v-btn v-btn-sm ${l.secondary ? "v-btn-outline" : "v-btn-dark"}`}
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {l.label}
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="v-section ih-done v-reveal" aria-labelledby="ih-done-title">
        <div className="v-wrap">
          <div className="ih-done-card">
            <h2 id="ih-done-title" className="ih-h2">
              Что-то пошло не так?
            </h2>
            <p className="ih-text">
              Если после «Импорта из буфера обмена» ничего не появилось — скопируйте ссылку ещё раз и повторите шаг:
              приложение читает именно буфер обмена. Не помогло — напишите в поддержку, подключим вместе.
            </p>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href="/support" className="v-btn v-btn-white">
                Поддержка
              </Link>
              <Link href="/devices" className="v-btn v-btn-outline">
                Все инструкции
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
