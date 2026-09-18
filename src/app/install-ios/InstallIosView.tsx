"use client";

import { useState } from "react";
import Link from "next/link";
import IosPhone from "./IosPhone";

/**
 * Тело /install-ios — корпус Atlas Secure VPS (17.09.2026, доработка
 * поверх перевода того же дня): заголовок с акцентом и `.v-glow`,
 * короткий лид, чек-лист шагов `.v-steps` рядом с живым телефоном (одна
 * сцена "tour" вместо пяти повторов рендера), тёмная плита-переход в
 * кабинет. `IosPhone` — своя механика (см. IosPhone.tsx), тут только
 * читаем текущий шаг тура через `onScene`, чтобы подсветить чек-лист в
 * такт анимации; клиентский компонент — чтобы держать это состояние,
 * метаданные страницы остаются в серверном page.tsx.
 */

type Scene = 1 | 2 | 3 | 4 | 5;

const STEPS: { t: string; d: string; tip?: string }[] = [
  {
    t: "Откройте меню Safari",
    d: "Внизу справа, рядом с адресной строкой, нажмите «•••».",
    tip: "В iOS 18 и раньше этот шаг не нужен: кнопка «Поделиться» стоит прямо в нижней панели Safari.",
  },
  {
    t: "Нажмите «Поделиться»",
    d: "Первый пункт меню — с квадратом и стрелкой вверх.",
  },
  {
    t: "Выберите «На экран „Домой“»",
    d: "Пункт с плюсом в квадрате. Не видно — потяните лист вверх и прокрутите список.",
  },
  {
    t: "Нажмите «Добавить»",
    d: "Оставьте включённым «Открыть как веб-приложение» — так Atlas откроется во весь экран.",
  },
  {
    t: "Готово",
    d: "На экране «Домой» появилась иконка Atlas. Нажмите её — сразу откроется кабинет.",
  },
];

const TOUR_LABEL =
  "iPhone 17 Pro Max: кабинет Atlas в Safari, по очереди показаны все пять шагов — «•••», «Поделиться», «На экран „Домой“», «Добавить» и иконка на экране «Домой»";

export default function InstallIosView() {
  const [active, setActive] = useState<Scene>(1);

  return (
    <>
      <section className="v-section v-glow" aria-labelledby="vi-title">
        <div className="v-wrap vi-grid">
          <figure className="vi-hero-art">
            <IosPhone scene="tour" eager onScene={setActive} label={TOUR_LABEL} />
          </figure>
          <div className="vi-copy">
            <p className="vi-kicker">Для iPhone и iPad · Safari · около 30 секунд</p>
            <h1 id="vi-title" className="v-h2" style={{ textAlign: "left" }}>
              Atlas на экран «<span className="v-accent">Домой</span>»
            </h1>
            <p className="v-lead" style={{ textAlign: "left" }}>
              Пять касаний — кабинет открывается как приложение: во весь экран, без адресной строки.
            </p>
            <ol className="v-steps vi-steps">
              {STEPS.map((s, k) => {
                const n = (k + 1) as Scene;
                return (
                  <li key={s.t} className="v-step vi-step" data-active={active === n ? "true" : undefined}>
                    <div className="v-step-head">
                      <span className="v-step-check" aria-hidden>
                        {n}
                      </span>
                      <h3>{s.t}</h3>
                    </div>
                    <p>{s.d}</p>
                    {s.tip && <p className="vi-tip">{s.tip}</p>}
                  </li>
                );
              })}
            </ol>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href="/dashboard" className="v-btn v-btn-soft">
                Вернуться в кабинет
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="v-section vi-done v-reveal" aria-labelledby="vi-done-title">
        <div className="v-wrap">
          <div className="vi-done-card">
            <h2 id="vi-done-title" className="vi-h2">
              Не получилось?
            </h2>
            <p className="vi-text">
              Пункт «На экран „Домой“» есть только в Safari. Если кабинет открыт в другом браузере — скопируйте
              адрес и откройте его в Safari. Остались вопросы — напишите в поддержку, поможем.
            </p>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href="/dashboard" className="v-btn v-btn-white">
                Открыть кабинет
              </Link>
              <Link href="/support" className="v-btn v-btn-outline">
                Поддержка
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
