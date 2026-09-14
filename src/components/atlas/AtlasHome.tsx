import Link from "next/link";
import AtlasShell from "./AtlasShell";
import AtlasDefs from "./AtlasDefs";
import HeroGL, { type HeroPoster } from "./HeroGL";
import LaptopScrub from "./LaptopScrub";
import HeroSchema from "./HeroSchema";
import Corner from "./Corner";
import Chars from "./Chars";
import Icon, { type IconName } from "@/components/pixel/Icon";
import type { ReactNode } from "react";
import "@/app/home-v5.css";
import "@/app/home-hero.css";
import {
  PLANS, PLAN_SPEED, PLAN_CONTENT, DEVICE_LIMIT, formatRub, pricePerMonth, type PlanId,
} from "@/lib/plans";
import { LOCATIONS, COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { plural } from "@/lib/ru-words";
import { FOUNDED } from "@/lib/nav";

/**
 * Главная — «Атлас-издание», редакция 6 (разбор владельца 11.09.2026,
 * второй проход).
 *
 *   01 буквы поднимаются, в строке лида — переключатель, который
 *      включается при загрузке
 *   02 закреплённая сцена «что меняется, когда Atlas включён»: большой
 *      переключатель щёлкает, ситуации по очереди переходят из «без
 *      Atlas» в «с Atlas»
 *   03 глобус реального времени за текстом — без закрепления и зума,
 *      одно проявление на входе, вращение самого глобуса
 *   04 стоп и заливка: раздел держится, заголовок заливается кобальтом,
 *      под ним бежит линия, шкалы канала дотягиваются
 *   05 линия по прокрутке идёт от кружка к кружку и расплывается
 *   06 стоп и заливка + ноутбук открывается по прокрутке (LaptopScrub),
 *      платформы загораются по очереди
 *   07 миссия: заливка заголовка, три числа, ценности плитками
 *   08 кольцо из бесплатных дней заполняется по прокрутке
 *
 * Тексты — польза и короткое объяснение, числа из src/lib.
 *
 * Моушн: atlas.css, раздел 6 (блоки 01, 03), home-v5.css (02, 04–08).
 * Только transform, opacity, переменные и позиция фона у заливки
 * заголовка; холостой слой на паузе вне кадра; без скрипта, без шкал
 * прокрутки и при reduced-motion — конечный кадр.
 */

const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;
const COUNTRY_WORD = plural(COUNTRY_COUNT, ["страна", "страны", "стран"]);
const DEVICE_WORD = plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"]);

/* 01 — первый экран (владелец, 14.09.2026: утверждён вариант лаборатории
   V6, режим E): фраза пользы крупно, плоско и плотно вместо имени;
   справа — «Схема» (HeroSchema: огромный знак, модули-плиты, пластина
   шлифованного металла, провода; вариант лаборатории 7). Имя и позиция
   «VPS-ускоритель» — в скрытой части заголовка для читалок и поиска. */
const HERO_A = "Видео, сайты и игры —";
const HERO_B = "без тормозов.";

/** Постеры мягких сцен: кадр покоя той же сцены, прозрачный WebP. */
const softPoster = (name: string, w: number, h: number, sizes: string): HeroPoster => ({
  src: `/media/${name}-1000.webp`,
  srcSet: `/media/${name}-700.webp 700w, /media/${name}-1000.webp 1000w, /media/${name}-1400.webp 1400w`,
  sizes,
  w,
  h,
});
const GLOBE_POSTER = softPoster("globe-soft", 1000, 1000, "(min-width: 721px) 55vw, 100vw");
const MISSION_POSTER = softPoster("mission-soft", 1000, 1000, "(min-width: 900px) 60vw, 100vw");

/** Изобаты под плитой: линии глубины, светлее плиты. */
const ISOBATHS = Array.from({ length: 7 }, (_, k) => {
  const y0 = 30 + k * 55;
  let d = "";
  for (let x = 0; x <= 1200; x += 40) {
    const y = y0 + 16 * Math.sin(x / 170 + k * 0.9) + 6 * Math.sin(x / 61 + k);
    d += `${x ? "L" : "M"}${x} ${y.toFixed(1)}`;
  }
  return d;
});

function Isobaths() {
  return (
    <svg className="a-isobaths a-idle" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden focusable="false">
      <g className="a-iso-g">
        {ISOBATHS.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
}


/**
 * Заголовок «стоп и заливка»: текст заливается кобальтом слева направо
 * по строкам (фон-градиент под текстом, позиция идёт по прокрутке), под
 * ним бежит тонкая линия с точкой. Конечный кадр — залит целиком.
 */
function FillTitle({ id, no, children }: { id: string; no: string; children: ReactNode }) {
  return (
    <>
      <h2 id={id} className="a-h2 h5-h2">
        <span className="a-no">{no}</span>
        <span className="h5-fill">{children}</span>
      </h2>
      <div className="h5-rule" aria-hidden><i /></div>
    </>
  );
}

/** 01 — три стеклянные карточки на краю поля: «чем рискую», «где
 *  работает», «сколько стоит». Первая — тёмная. «Без автосписаний», а не
 *  «отмена в один клик»: оплата разовая (COMPLIANCE-CHECK.md). */
const HERO_CARDS: { t: string; d: string; dark?: boolean }[] = [
  { t: `${TRIAL} бесплатно`, d: "без карты", dark: true },
  { t: `${COUNTRY_COUNT} ${COUNTRY_WORD}`, d: "смена страны в один тап" },
  { t: `от ${formatRub(PLANS.basic[1])} ₽ в месяц`, d: "без автосписаний" },
];

/** 08 — возражения перед финальным призывом. Факты: оплата — экран
 *  /subscribe (Visa, Mastercard, МИР, СБП); устройства и «не храним
 *  историю» — src/lib/faq.ts; пробный без карты — /auth. */
const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "Это сложно настроить?",
    a: "Нет. Войдите по почте, поставьте приложение и отсканируйте QR-код из личного кабинета — вручную ничего настраивать не нужно. Для каждого устройства есть пошаговая инструкция.",
  },
  {
    q: "Что будет, когда пробные дни закончатся?",
    a: `Ничего не спишется: карту для пробного периода мы не просим. Понравится — выберите тариф от ${formatRub(PLANS.basic[1])} ₽ в месяц, нет — просто не продлевайте.`,
  },
  {
    q: "Это безопасно?",
    a: "Да. Трафик шифруется на пути от вашего устройства до нашего сервера, а история посещений не записывается и не хранится.",
  },
  {
    q: "Заработает на моём устройстве?",
    a: `iPhone и iPad, Android, Windows, macOS и Android TV. Одна подписка — до ${DEVICE_LIMIT} ${DEVICE_WORD}, их можно менять в любой момент.`,
  },
  {
    q: "Как оплатить?",
    a: "Картой Visa, Mastercard, МИР или через СБП. Подписка включается сразу после оплаты.",
  },
  {
    q: "Можно выбрать страну?",
    a: `Да, все ${COUNTRY_COUNT} ${COUNTRY_WORD} входят в любой тариф. Страна меняется в приложении в один тап: чем ближе сервер, тем быстрее.`,
  },
];

/** 02 — что меняется, когда Atlas включён. Без чисел: только польза. */
const DIFF: { what: string; was: string; now: string }[] = [
  { what: "Видео", was: "долго грузится и встаёт на паузу", now: "запускается сразу и идёт без пауз" },
  { what: "Сайты и приложения", was: "открываются через раз", now: "открываются сразу и целиком" },
  { what: "Игры и созвоны", was: "звук отстаёт, картинка дёргается", now: "звук и картинка идут ровно" },
  { what: "Wi-Fi в кафе и отеле", was: "чужие могут видеть, что вы открываете", now: "всё, что вы открываете, зашифровано" },
];

/** 05 — три шага. */
const STEPS: { t: string; d: ReactNode }[] = [
  { t: "Войдите по почте", d: "Нужны только адрес и код из письма. Без пароля и без карты." },
  { t: "Поставьте приложение", d: "Ключ и QR-код уже ждут в личном кабинете — отсканируйте код в приложении." },
  {
    t: "Включите",
    d: (
      <>
        Одно касание — дальше всё работает само. <span className="a-on a-idle">включено</span>
      </>
    ),
  },
];

/** 06 — платформы. Список повторяет PLATFORMS в src/app/devices/DevicesView.tsx. */
const OS: { icon: IconName; name: string }[] = [
  { icon: "iphone", name: "iPhone и iPad" },
  { icon: "android", name: "Android" },
  { icon: "windows", name: "Windows" },
  { icon: "macos", name: "macOS" },
  { icon: "tv", name: "Android TV" },
];

/** 07 — ценности компании. */
const VALUES: { icon: IconName; t: string; d: string }[] = [
  { icon: "bolt", t: "Скорость по умолчанию", d: "Сайты, видео и игры открываются сразу, где бы вы ни были." },
  { icon: "check", t: "Простота", d: "Вход по почте, ключ в кабинете, включение одним касанием." },
  { icon: "clock", t: "Честные условия", d: `${TRIAL} бесплатно без карты, понятные цены и никаких автосписаний.` },
  { icon: "lock", t: "Приватность", d: "Трафик шифруется на пути от вашего устройства до нашего сервера." },
];

/** 08 — дуги кольца: по одной на каждый бесплатный день, с зазорами. */
function arc(r: number, a0: number, a1: number) {
  const pt = (a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(100 + r * Math.cos(t)).toFixed(2)} ${(100 + r * Math.sin(t)).toFixed(2)}`;
  };
  return `M${pt(a0)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(a1)}`;
}
const DAY_ARCS = Array.from({ length: TRIAL_DAYS }, (_, k) => {
  const s = 360 / TRIAL_DAYS;
  return arc(86, k * s + 6, (k + 1) * s - 6);
});

/** Разбивка по словам для сцен, где слова проявляются по прокрутке. */
function Words({ text, start = 0 }: { text: string; start?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="a-word" style={{ ["--i" as string]: start + i }}>{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

export default function AtlasHome({ referralCode }: { referralCode?: string }) {
  const enter = referralCode ? `/auth?ref=${encodeURIComponent(referralCode)}` : "/auth";

  return (
    <AtlasShell sheetNo="01" sheetTitle="Главная">
      <AtlasDefs />
      <main id="main" className="a-main h5-home">
        {/* ── 01 · Обещание ─────────────────────────────────────── */}
        {/* Утверждённый вариант V6 режим E (владелец, 14.09.2026; стиль —
            Yandex Tech): нейтральное поле #EDF0F6 со светом кобальта,
            фраза пользы крупно, короткий лид с живым переключателем,
            чёрная и стеклянная пилюли, справа «Схема», внизу три
            стеклянные карточки на краю поля. Буквы фразы поднимаются при
            загрузке (Chars / .a-char), на уходе — мягкий спуск без зума.
            Стили — src/app/home-hero.css. */}
        <section className="a-sheet a-cover a-hero" data-sheet="01" data-title="Главная" aria-labelledby="a-cover-title">
          <div className="a-hero-panel">
            <div className="a-field a-hero-grid">
              <h1 id="a-cover-title" className="a-hero-title">
                <span className="sr-only">Atlas Secure — VPS-ускоритель: видео, сайты и игры без тормозов</span>
                <span aria-hidden>
                  <Chars text={HERO_A} />{" "}
                  <em><Chars text={HERO_B} start={HERO_A.length + 1} /></em>
                </span>
              </h1>

              {/* «Схема» — только в правой колонке (на телефоне — полосой
                  под фразой): формы не заходят на текст. Декоративная
                  (aria-hidden): те же факты — в тексте и карточках. */}
              <HeroSchema />

              <div className="a-hero-text">
                {/* «Включаете Atlas» показано жестом: переключатель щёлкает,
                    когда буквы фразы поднялись (atlas.css, 6.6). */}
                <p className="a-lead a-hero-lead" style={{ ["--i" as string]: 3 }}>
                  Включаете{" "}
                  <span style={{ whiteSpace: "nowrap" }}>
                    Atlas <span className="a-switch" aria-hidden><i /></span>
                  </span>{" "}
                  — и&nbsp;всё открывается сразу, на&nbsp;полной скорости.
                </p>
                <div className="a-hero-actions" style={{ ["--i" as string]: 4 }}>
                  <Link href={enter} className="a-hero-btn a-hero-btn-ink">Попробовать {TRIAL} бесплатно</Link>
                  <Link href="#tariffs" className="a-hero-btn a-hero-btn-glass">Тарифы от {formatRub(PLANS.basic[1])} ₽</Link>
                </div>
              </div>

            </div>
          </div>

          <ul className="a-field a-hero-cards" aria-label="Коротко об Atlas">
            {HERO_CARDS.map((c, k) => (
              <li key={c.t} className="a-hero-card" data-dark={c.dark ? "" : undefined} style={{ ["--i" as string]: 6 + k }}>
                <b>{c.t}</b>
                <span>{c.d}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 02 · Что меняется — закреплённая сцена ────────────── */}
        {/* Владелец, 11.09.2026: «Сайты перестали открываться?» — «крайне
            глупо, полностью переделать». Новый блок — польза в быту: пока
            читатель листает, большой переключатель щёлкает, и четыре
            знакомые ситуации по очереди переходят из «без Atlas» в
            «с Atlas». Сцена держится, только если помещается в экран. */}
        <section className="a-sheet a-plate h5-diff" data-sheet="02" data-title="Что меняется" aria-labelledby="h5-diff-title">
          <Isobaths />
          <div className="h5-diff-hold">
            <div className="h5-diff-stage">
              <div className="a-field h5-diff-grid">
                <div className="h5-diff-head">
                  <h2 id="h5-diff-title" className="a-h2">
                    <span className="a-no">02</span>что меняется, когда Atlas включён
                  </h2>
                  <p className="a-p">
                    Одна кнопка в приложении. Дальше Atlas работает сам — вот что вы заметите в первый же вечер.
                  </p>
                  <div className="h5-toggle" aria-hidden>
                    <span className="h5-toggle-sw"><i /></span>
                    <span className="h5-toggle-label">
                      <b className="h5-toggle-off">Atlas выключен</b>
                      <b className="h5-toggle-on">Atlas включён</b>
                    </span>
                  </div>
                </div>
                <ul className="h5-diff-list">
                  {DIFF.map((r, k) => (
                    <li key={r.what} className="h5-diff-row" style={{ ["--k" as string]: k }}>
                      <span className="h5-diff-what">{r.what}</span>
                      <span className="h5-diff-was">
                        <span className="b-sr">Без Atlas: </span>
                        <span className="h5-strike">{r.was}</span>
                      </span>
                      <span className="h5-diff-arrow" aria-hidden><i /></span>
                      <span className="h5-diff-now">
                        <span className="b-sr">С Atlas: </span>
                        {r.now}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── 03 · Страны ───────────────────────────────────────── */}
        {/* 14.09.2026 (владелец: «кривая при прокрутке — сначала большая,
            потом маленькая, и идёт зум»): закрепления и зума нет. Раздел
            высотой в экран, глобус постоянного размера вращается за
            текстом; на входе — одно мягкое проявление (atlas.css, 6.8). */}
        <section className="a-sheet a-map a-pin" data-sheet="03" data-title="Страны" aria-labelledby="a-map-title">
          <div className="a-pin-stage">
            {/* Мягкий глобус реального времени (HeroGL "globe-soft",
                14.09.2026): белая керамика, кобальтовые точки суши, города
                наших локаций, дуги с огнями. Кадр на частоте экрана; без
                WebGL, при reduced-motion и экономии трафика — постер той
                же сцены. Стоит в правой части сцены — не под текстом. */}
            <HeroGL className="a-pin-art a-pin-soft" composition="globe-soft" poster={GLOBE_POSTER} />
            <div className="a-field a-pin-copy">
              {/* Без a-settle: текст сцены проявляет шкала раздела (6.8),
                  второе скрытие оставляло его пустым (аудит 13.09.2026). */}
              <h2 id="a-map-title" className="a-h2">
                <span className="a-no">03</span>{COUNTRY_COUNT} {COUNTRY_WORD}. выбирайте ближайшую
              </h2>
              <p className="a-p">
                Чем ближе сервер, тем меньше задержка и тем быстрее открываются сайты и видео. Все{" "}
                {COUNTRY_COUNT} {COUNTRY_WORD} входят в каждый тариф — доплачивать за страну не нужно.
              </p>
            </div>
          </div>
          <div className="a-field">
            {/* Всё, что есть на глобусе, — словами, для чтеца экрана. */}
            <table className="b-sr">
              <caption>Серверы Atlas Secure и примерный отклик из Москвы</caption>
              <thead>
                <tr><th scope="col">страна</th><th scope="col">город</th><th scope="col">отклик, мс</th></tr>
              </thead>
              <tbody>
                {[...LOCATIONS].sort((a, b) => a.latencyMs - b.latencyMs).map((l) => (
                  <tr key={l.code}>
                    <td>{l.country}</td>
                    <td>{l.cities.join(", ")}</td>
                    <td>примерно {l.latencyMs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 04 · Тарифы — стоп и заливка ──────────────────────── */}
        {/* Владелец, 11.09.2026: «во время прокрутки экран останавливается,
            заголовок заполняется синим, под ним линия-бегунок». Закреплён
            только кадр с заголовком и карточками; строки ниже идут
            обычным потоком. Числа — из src/lib/plans.ts. */}
        <section className="a-sheet a-legend h5-plans-sec" data-sheet="04" data-title="Тарифы" id="tariffs" aria-labelledby="a-legend-title">
          <div className="h5-hold">
            <div className="h5-hold-stage">
              <div className="a-field">
                <FillTitle id="a-legend-title" no="04">два тарифа. всё уже включено</FillTitle>
                <p className="a-p a-settle" style={{ ["--i" as string]: 1 }}>
                  Тарифы отличаются только шириной канала — тем, сколько данных проходит одновременно.
                  {" "}{PLAN_CONTENT.basic.name} хватает для сайтов, видео и работы. {PLAN_CONTENT.plus.name}{" "}— для
                  игр, стримов и созвонов, где важен каждый кадр.
                </p>

                <div className="h5-plans">
                  {(["basic", "plus"] as PlanId[]).map((id, i) => (
                    <article
                      key={id}
                      className="h5-plan a-slide"
                      data-plan={id}
                      aria-labelledby={`h5-plan-${id}`}
                      style={{
                        ["--i" as string]: i,
                        ["--dir" as string]: i ? 1 : -1,
                        ["--sp" as string]: PLAN_SPEED[id] / PLAN_SPEED.plus,
                      }}
                    >
                      <Corner href="/pricing" label={`Подробнее о тарифе ${PLAN_CONTENT[id].name}`} />
                      <div className="h5-plan-top">
                        <h3 id={`h5-plan-${id}`} className="h5-plan-name">{PLAN_CONTENT[id].name}</h3>
                        <p className="h5-plan-tagline">{PLAN_CONTENT[id].tagline}</p>
                      </div>
                      <div className="h5-plan-mid">
                        <div className="h5-speed">
                          <p className="h5-speed-label">Ширина канала</p>
                          <div className="h5-speed-bar" aria-hidden>
                            <i><b className="a-idle" /></i>
                          </div>
                          <p className="h5-speed-val"><b className="a-num">{PLAN_SPEED[id]}</b> Гбит/с</p>
                        </div>
                        <div className="h5-price-box">
                          <p className="h5-price"><b className="a-num">{formatRub(PLANS[id][1])} ₽</b> в месяц</p>
                          <p className="h5-price-year">за год — {formatRub(pricePerMonth(id, 12))} ₽ в месяц</p>
                        </div>
                      </div>
                      <ul className="h5-feats">
                        {PLAN_CONTENT[id].features.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      <Link href="/pricing" className={`a-btn ${id === "plus" ? "a-btn-invert" : "a-btn-primary"}`}>
                        Выбрать {PLAN_CONTENT[id].name}
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="a-field h5-plans-after">
            <p className="a-legend-note a-settle" style={{ ["--i" as string]: 4 }}>
              В каждом тарифе — до {DEVICE_LIMIT} {DEVICE_WORD}, все {COUNTRY_COUNT} {COUNTRY_WORD} и никаких
              автосписаний — продлеваете, когда сами решите. За год выходит дешевле, чем помесячно.
            </p>
            {/* Выделенные серверы — карточкой с кружком в углу: переход на
                отдельный продукт. */}
            <div className="h5-vds a-settle" style={{ ["--i" as string]: 5 }}>
              <Corner href="/vds" label="Выделенные серверы" />
              <p className="h5-vds-kicker">Для проекта или компании</p>
              <p className="h5-vds-text">
                Нужен целый сервер? <Link href="/vds">Выделенные серверы</Link> — от {formatUsd(SERVER_ENTRY_USD)} в месяц.
              </p>
            </div>
          </div>
        </section>

        {/* ── 05 · Подключение ──────────────────────────────────── */}
        {/* Линия по прокрутке идёт от кружка к кружку и расплывается на
            третьем (владелец, 11.09.2026). На широком экране раздел
            закреплён; шкала — его прокрутка (home-v5.css). */}
        <section className="a-sheet h5-steps" data-sheet="05" data-title="Подключение" id="how" aria-labelledby="a-steps-title">
          <div className="h5-stage">
            <div className="a-field">
              <h2 id="a-steps-title" className="a-h2 a-settle">
                <span className="a-no">05</span>три шага — и всё работает
              </h2>
              <p className="a-p a-settle" style={{ ["--i" as string]: 1 }}>
                Настраивать вручную ничего не нужно. Регистрация, ключ и инструкция — в одном месте.
              </p>
              <div className="h5-track">
                {/* Кружки — в центрах трёх равных колонок (1/6, 1/2, 5/6 ширины).
                    Координаты 1200×72: без non-scaling-stroke, иначе Chrome
                    считает штрих в экранных единицах и линия рвётся на куски. */}
                <svg className="h5-path" viewBox="0 0 1200 72" preserveAspectRatio="none" aria-hidden focusable="false">
                  <path className="h5-path-glow" d="M200 36 C 330 -4, 470 -4, 600 36 S 870 76, 1000 36" pathLength="1" />
                  <path className="h5-path-line" d="M200 36 C 330 -4, 470 -4, 600 36 S 870 76, 1000 36" pathLength="1" />
                </svg>
                <ol className="h5-list">
                  {STEPS.map((s, k) => (
                    <li key={s.t} className="h5-step">
                      <span className="h5-dot" aria-hidden>{k + 1}</span>
                      <h3>{s.t}</h3>
                      <p>{s.d}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* ── 06 · Устройства — стоп и заливка ──────────────────── */}
        {/* Разбор 11.09.2026: прежнее закрепление на 260svh давало экран
            пустой прокрутки после того, как ноутбук открылся, а заголовок
            стоял в узкой колонке в три строки. Теперь заголовок во всю
            ширину, закрепление короче и занято целиком: заливка →
            ноутбук открывается → платформы загораются по очереди. */}
        <section className="a-sheet h5-dev" data-sheet="06" data-title="Устройства" aria-labelledby="a-devices-title">
          <div className="h5-hold" data-scrub>
            <div className="h5-hold-stage">
              <div className="a-field">
                <FillTitle id="a-devices-title" no="06">одна подписка на {DEVICE_LIMIT} {DEVICE_WORD}</FillTitle>
                <div className="h5-dev-grid">
                  <div className="h5-dev-copy">
                    <p className="a-lead a-settle" style={{ ["--i" as string]: 1 }}>
                      Телефон, ноутбук, планшет и телевизор — подключайте всё, что есть дома, без доплаты
                      за каждое устройство.
                    </p>
                    <ul className="h5-os" aria-label="Atlas работает на">
                      {OS.map((o, k) => (
                        <li key={o.name} style={{ ["--k" as string]: k }}>
                          <Icon name={o.icon} size={18} />
                          {o.name}
                        </li>
                      ))}
                    </ul>
                    <p className="a-p a-settle" style={{ ["--i" as string]: 3 }}>
                      Для каждого устройства есть пошаговая инструкция.
                    </p>
                    <div className="a-actions a-settle" style={{ ["--i" as string]: 4 }}>
                      <Link href="/devices" className="a-btn a-btn-quiet">Инструкции для устройств</Link>
                    </div>
                  </div>
                  <LaptopScrub className="h5-laptop" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 07 · Миссия и компания ────────────────────────────── */}
        {/* Разбор 11.09.2026: «сплошной текст, нет приоритетов». Иерархия:
            утверждение миссии → три числа → ценности плитками → ссылка.
            Сфера-сеть реального времени — за текстом справа; на телефоне
            — приглушённым фоном за заголовком и числами (home-v5.css). */}
        <section className="a-sheet h5-mission" data-sheet="07" data-title="Компания" aria-labelledby="a-company-title">
          {/* Мягкая сеть (HeroGL "mission-soft", 14.09.2026): белые и
              кобальтовые узлы на хромированных связях вокруг матового ядра. */}
          <HeroGL className="h5-mission-art" composition="mission-soft" poster={MISSION_POSTER} />
          <div className="a-field">
            <FillTitle id="a-company-title" no="07">свободный и быстрый интернет для каждого</FillTitle>
            <p className="a-lead h5-mission-lead a-settle" style={{ ["--i" as string]: 1 }}>
              Наша миссия — чтобы интернет у каждого работал свободно и быстро: без тормозов и
              сложных настроек. Atlas Secure — технологическая компания в составе группы QoDev.
            </p>
            <ul className="h5-facts">
              <li style={{ ["--k" as string]: 0 }}>
                <b className="a-num">{FOUNDED}</b>
                <span>год основания</span>
              </li>
              <li style={{ ["--k" as string]: 1 }}>
                <b className="a-num">{COUNTRY_COUNT}</b>
                <span>{plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} с нашими серверами</span>
              </li>
              <li style={{ ["--k" as string]: 2 }}>
                <b className="a-num">100+</b>
                <span>человек в команде</span>
              </li>
            </ul>
            <ul className="h5-values">
              {VALUES.map((v, k) => (
                <li key={v.t} className="h5-value" style={{ ["--k" as string]: k }}>
                  <span className="h5-value-ico" aria-hidden><Icon name={v.icon} size={22} /></span>
                  <h3>{v.t}</h3>
                  <p>{v.d}</p>
                </li>
              ))}
            </ul>
            <div className="a-actions a-settle" style={{ ["--i" as string]: 7 }}>
              <Link href="/about" className="a-btn a-btn-quiet">Подробнее о компании</Link>
            </div>
          </div>
        </section>

        {/* ── 08 · Коротко о главном — возражения ───────────────── */}
        {/* Разбор продажника 12.09.2026: на главной не было ответов на
            «сложно ли», «что после пробного», «безопасно ли», «как
            оплатить» — человек уходил искать их или не возвращался.
            Раскрывающиеся ответы: первый открыт, строки поднимаются по
            прокрутке лесенкой (home-v5.css). */}
        <section className="a-sheet h5-faq" data-sheet="08" data-title="Вопросы" aria-labelledby="h5-faq-title">
          <div className="a-field h5-faq-grid">
            <div className="h5-faq-head">
              <h2 id="h5-faq-title" className="a-h2 a-settle">
                <span className="a-no">08</span>коротко о главном
              </h2>
              <p className="a-p a-settle" style={{ ["--i" as string]: 1 }}>
                Ответы на то, что обычно спрашивают перед подключением.
              </p>
              <div className="a-actions a-settle" style={{ ["--i" as string]: 2 }}>
                <Link href={enter} className="a-btn a-btn-primary">Попробовать {TRIAL} бесплатно</Link>
                <Link href="/support" className="a-btn a-btn-quiet">Все вопросы</Link>
              </div>
            </div>
            <div className="h5-faq-list">
              {HOME_FAQ.map((f, k) => (
                <details key={f.q} className="h5-q" name="h5-faq" open={k === 0} style={{ ["--k" as string]: k }}>
                  <summary>
                    <span>{f.q}</span>
                    <span className="h5-q-ico" aria-hidden><Icon name="arrow-right" size={16} /></span>
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 09 · Попробовать ──────────────────────────────────── */}
        <section className="a-sheet a-plate a-final" data-sheet="09" data-title="Попробовать" aria-labelledby="a-final-title">
          <Isobaths />
          <div className="a-field">
            <h2 id="a-final-title" className="a-h2">
              <span className="a-no">09</span>
              <Words text={`попробуйте ${TRIAL} бесплатно`} />
            </h2>
            <p className="a-p a-settle" style={{ ["--i" as string]: 6 }}>
              Без карты и без обязательств. Понравится — выберите тариф, нет — просто не продлевайте.
            </p>
            <div className="a-actions a-settle" style={{ ["--i" as string]: 8 }}>
              <Link href={enter} className="a-btn a-btn-invert a-idle">Начать бесплатно</Link>
              <Link href="/contact" className="a-btn a-btn-line">Написать нам</Link>
            </div>
          </div>
          {/* Кольцо из бесплатных дней: заполняется по прокрутке по одному
              дню, по кольцу идёт светлая точка (владелец, 11.09.2026). После
              текста — на телефоне стоит под ним, на широком экране справа. */}
          <div className="h5-days" aria-hidden>
            <svg viewBox="0 0 200 200" focusable="false">
              <circle className="h5-days-track" cx="100" cy="100" r="86" />
              {DAY_ARCS.map((d, k) => (
                <path key={k} className="h5-day" d={d} pathLength="1" style={{ ["--k" as string]: k }} />
              ))}
            </svg>
            <span className="h5-days-orbit a-idle"><i /></span>
            <p className="h5-days-num">
              <b className="a-num">{TRIAL_DAYS}</b>
              {plural(TRIAL_DAYS, ["день", "дня", "дней"])} бесплатно
            </p>
          </div>
        </section>
      </main>
    </AtlasShell>
  );
}
