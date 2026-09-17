import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import IosPhone from "./IosPhone";
import "./install-ios.css";
import "./ios-phone.css";

/**
 * /install-ios — как добавить кабинет Atlas на экран «Домой» iPhone и
 * iPad (владелец, 11.09.2026: «инструкция шаг за шагом, iPhone 17 Pro Max
 * — наш дашборд в Safari, куда нажимать, текстом рядом»; 13.09.2026:
 * «рендеры плавные, чтобы постепенно анимировалось, что делать»;
 * 17.09.2026 — переведено на корпус Atlas Secure VPS: только оболочка
 * (VShell) и рамка вокруг рендеров (install-ios.css, префикс `vi-`),
 * сам анимированный IosPhone и его стили (ios-phone.css) не менялись).
 *
 * Сюда ведёт нижний лист из кабинета (IosInstallSheet) и подсказка
 * IosInstallBanner. Шаги — для Safari в iOS 26 («•••» → «Поделиться» →
 * «На экран «Домой»» → «Добавить»), с оговоркой для iOS 18 и раньше.
 *
 * Телефон — IosPhone: корпус iPhone 17 Pro Max из Blender
 * (public/media/ios/shell.webp, design/blender/iphone_shell.py) и живой
 * экран на HTML/CSS поверх снимка кабинета (public/media/ios/dash.webp).
 * У каждого шага своя петля; на первом экране — все пять шагов подряд.
 */
export const metadata: Metadata = {
  title: "Atlas на iPhone",
  description: "Как добавить кабинет Atlas на экран «Домой» iPhone и iPad — пять касаний в Safari.",
  alternates: { canonical: "/install-ios" },
};

const STEPS: { t: string; d: string; tip?: string; alt: string }[] = [
  {
    t: "Откройте меню Safari",
    d: "Внизу справа, рядом с адресной строкой, нажмите «•••».",
    tip: "В iOS 18 и раньше этот шаг не нужен: кнопка «Поделиться» — квадрат со стрелкой — стоит прямо в нижней панели Safari.",
    alt: "iPhone 17 Pro Max: кабинет Atlas в Safari, палец нажимает «•••» справа внизу — открывается меню",
  },
  {
    t: "Нажмите «Поделиться»",
    d: "Первый пункт меню — с квадратом и стрелкой вверх.",
    alt: "iPhone 17 Pro Max: в меню Safari нажат пункт «Поделиться» — снизу поднимается лист",
  },
  {
    t: "Выберите «На экран „Домой“»",
    d: "Пункт с плюсом в квадрате. Если его не видно — потяните лист вверх и прокрутите список.",
    alt: "iPhone 17 Pro Max: лист «Поделиться» вытянут вверх, нажат пункт «На экран „Домой“»",
  },
  {
    t: "Нажмите «Добавить»",
    d: "Оставьте включённым «Открыть как веб-приложение» — так Atlas откроется во весь экран, без адресной строки.",
    alt: "iPhone 17 Pro Max: экран добавления, включено «Открыть как веб-приложение», нажата кнопка «Добавить»",
  },
  {
    t: "Готово",
    d: "На экране «Домой» появилась иконка Atlas. Нажмите её — сразу откроется ваш кабинет.",
    alt: "iPhone 17 Pro Max: на экране «Домой» появляется иконка Atlas Secure, касание открывает кабинет во весь экран",
  },
];

export default function InstallIosPage() {
  return (
    <VShell work account="member">
      <section className="v-section vi-hero" aria-labelledby="vi-title">
        <div className="v-wrap vi-hero-grid">
          <div>
            <p className="vi-kicker">Для iPhone и iPad · Safari · около 30 секунд</p>
            <h1 id="vi-title" className="v-h2" style={{ textAlign: "left" }}>
              Atlas на экране «Домой»
            </h1>
            <p className="v-lead">
              Пять касаний — и кабинет открывается как приложение: во весь экран и без адресной строки.
            </p>
            <ul className="vi-perks">
              <li><b>Одно касание</b> — ключ и подписка сразу под рукой</li>
              <li><b>Во весь экран</b> — без панелей браузера</li>
              <li><b>Уведомления о продлении</b> — на iPhone они приходят только приложениям с экрана «Домой»</li>
            </ul>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <a href="#step-1" className="v-btn v-btn-primary">Показать по шагам</a>
              <Link href="/dashboard" className="v-btn v-btn-soft">Вернуться в кабинет</Link>
            </div>
          </div>
          <figure className="vi-hero-art">
            <IosPhone
              scene="tour"
              eager
              label="iPhone 17 Pro Max с кабинетом Atlas в Safari: по очереди показаны все пять шагов — «•••», «Поделиться», «На экран „Домой“», «Добавить» и иконка на экране «Домой»"
            />
          </figure>
        </div>
      </section>

      <ol className="vi-steps">
        {STEPS.map((s, k) => (
          // Телефон чётных шагов слева от текста, нечётных — справа: полоса
          // читается зигзагом, а не колонкой одинаковых карточек.
          <li key={s.t} id={`step-${k + 1}`} className="vi-step" data-flip={k % 2 ? undefined : ""}>
            <div className="v-wrap vi-step-grid">
              <figure className="vi-shot">
                <IosPhone scene={(k + 1) as 1 | 2 | 3 | 4 | 5} label={s.alt} />
              </figure>
              <div className="vi-card">
                <p className="vi-step-no">
                  <b>{k + 1}</b> / {STEPS.length}
                </p>
                <h2 className="vi-h2">{s.t}</h2>
                <p className="vi-text">{s.d}</p>
                {s.tip && <p className="vi-tip">{s.tip}</p>}
                <span className="vi-rail" aria-hidden><i /></span>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="v-section vi-done" aria-labelledby="vi-done-title">
        <div className="v-wrap">
          <div className="vi-done-card">
            <h2 id="vi-done-title" className="vi-h2">Не получилось?</h2>
            <p className="vi-text">
              Пункт «На экран „Домой“» есть только в Safari. Если кабинет открыт в другом браузере — скопируйте
              адрес и откройте его в Safari. Остались вопросы — напишите в поддержку, поможем.
            </p>
            <div className="v-actions" style={{ justifyContent: "flex-start" }}>
              <Link href="/dashboard" className="v-btn v-btn-white">Открыть кабинет</Link>
              <Link href="/support" className="v-btn v-btn-outline" style={{ color: "#FFFFFF", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.3)" }}>Поддержка</Link>
            </div>
          </div>
        </div>
      </section>
    </VShell>
  );
}
