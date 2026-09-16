// Поля бланка — первым импортом: в каскаде они должны стоять до
// atlas.css и business-atlas.css, как раньше в корневом layout.
import "@/app/px-forms.css";
import Chars from "@/components/atlas/Chars";
import Link from "next/link";
import AtlasShell from "@/components/atlas/AtlasShell";
import PointerDrift from "@/components/atlas/PointerDrift";
import BusinessRequestForm from "./BusinessRequestForm";
import { DEVICE_LIMIT } from "@/lib/plans";
import { CITY_COUNT, COUNTRY_COUNT } from "@/lib/locations";
import { plural } from "@/lib/ru-words";
import "./business-atlas.css";

/**
 * /business — лист 13 «Для бизнеса», корпус «Атлас-издание».
 *
 * Порядок разговора обратный частному: компания сначала узнаёт себя
 * в задаче, потом видит, что входит, и только потом оставляет заявку.
 * Цен на странице нет — корпоративный расчёт зависит от числа мест, и
 * обещать сумму до разговора нельзя.
 *
 * Состав: 01 обещание · 02 задачи · 03 один счёт (закреплённая сцена:
 * десять личных подписок сходятся в одну полосу) · 04 что входит ·
 * 05 заявка на кобальтовой плите. Форма и есть финальное действие
 * страницы: второй призыв под ней уводил бы заполнившего мимо цели.
 *
 * Тело — серверный компонент: движение ведёт MotionController оболочки,
 * клиентский только сам бланк (BusinessRequestForm).
 *
 * ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ (COMPLIANCE-CHECK.md §4–§5): договор и
 * закрывающие документы, единый счёт, выдача и отзыв доступа
 * администратором, поддержка вне очереди, «до 14 устройств на
 * человека», ответ за четыре рабочих часа, «не храним ни истории
 * подключений, ни DNS-запросов». Все строки были на странице и
 * оставлены как есть.
 *
 * Весь моушн — business-atlas.css, раздел «Движение».
 */
const CASES = [
  {
    title: "Сотрудники работают откуда угодно",
    body:
      "Дом, коворкинг, гостиница, чужой Wi-Fi в аэропорту. Соединение одинаковое везде, и рабочие сервисы открываются так же, как в офисе.",
  },
  {
    title: "Созвоны рассыпаются",
    body:
      "Видео замирает, звук отстаёт, экран видно через раз. Широкий канал снимает вопрос до того, как встреча превратится в переписку.",
  },
  {
    title: "Данные ходят по открытым сетям",
    body:
      "Публичный Wi-Fi не защищает трафик. Мы не храним ни истории подключений, ни DNS-запросов — хранить нечего, значит, нечего и передать.",
  },
  {
    title: "Нужны серверы под задачу",
    body:
      "Тестовый стенд, база данных, сборка. Выделенный сервер — с железом, которое не делится ни с кем.",
  },
];

/** Что входит в корпоративное подключение. Число устройств — plans.ts,
 *  страны и города — locations.ts. */
const INCLUDED: Array<{ term: string; detail: string }> = [
  {
    term: "Договор и закрывающие документы",
    detail:
      "Работаем с юридическим лицом по безналичному расчёту. Акты и счета-фактуры — в обычном порядке, без карт сотрудников и авансовых отчётов.",
  },
  {
    term: "Единый счёт за всю команду",
    detail:
      "Подключения живут в общем аккаунте компании. Одна оплата вместо десятка личных подписок, которые бухгалтерия не может принять к учёту.",
  },
  {
    term: "Управление доступами",
    detail:
      "Администратор компании выдаёт и отзывает доступ сам. Сотрудник ушёл — доступ снимается в тот же день вместе со всеми его устройствами.",
  },
  {
    term: `До ${DEVICE_LIMIT} ${plural(DEVICE_LIMIT, ["устройства", "устройств", "устройств"])} на человека`,
    detail:
      "Ноутбук, телефон, планшет, рабочий компьютер — одно место закрывает все устройства сотрудника, доплачивать за каждое не нужно.",
  },
  {
    term: `${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} и ${CITY_COUNT} ${plural(CITY_COUNT, ["город", "города", "городов"])} на выбор`,
    detail:
      "Страну выбирает сотрудник или назначает администратор — в зависимости от того, какие сервисы нужны команде.",
  },
  {
    term: "Поддержка вне общей очереди",
    detail:
      "Отдельный канал связи для компаний и приоритет в обработке обращений. Заявка сотрудника не ждёт в общем потоке.",
  },
];

/** Десять личных подписок: откуда каждая приезжает в общую полосу.
 *  Сдвиг — в долях собственного размера плитки, по золотому углу:
 *  разброс ровный, без случайности между сборками. */
const TILES = Array.from({ length: 10 }, (_, i) => {
  const a = (i * 137.5 * Math.PI) / 180;
  const r = 1 + (i % 3) * 0.45;
  return {
    x: `${Math.round(Math.cos(a) * 150 * r)}%`,
    y: `${Math.round(Math.sin(a) * 150 * r)}%`,
    r: `${((i * 37) % 24) - 12}deg`,
  };
});

const HERO_1 = "интернет и серверы";
const HERO_2 = "для команды";

/** Полоса доказательств первого экрана — только на телефоне (ab-proof):
 *  там, где на широком экране места сотрудников читаются волной, на
 *  узком экране это была решётка едва заметных квадратиков в пустоте.
 *  Числа — те же, что ниже на странице (plans.ts, locations.ts) и в
 *  самом обещании («в течение четырёх рабочих часов»), не новые. */
const HERO_PROOF: Array<{ value: string; label: string }> = [
  { value: `${DEVICE_LIMIT}`, label: `${plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])} на человека` },
  { value: `${COUNTRY_COUNT}`, label: `${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} на выбор` },
  { value: "4 ч", label: "срок расчёта" },
];


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

export default function BusinessView() {
  return (
    <AtlasShell sheetNo="13" sheetTitle="Для бизнеса">
      <PointerDrift target=".ab-cover" />
      <main id="main" className="a-main">
        {/* ── 01 · Обещание ─────────────────────────────────────── */}
        <section className="a-sheet ab-cover" data-sheet="13" data-title="Для бизнеса" aria-labelledby="ab-title">
          <div className="a-field">
            <h1 id="ab-title" className="ab-display" aria-label={`${HERO_1} ${HERO_2}`}>
              <span className="ab-line" aria-hidden><Chars text={HERO_1} /></span>
              <span className="ab-line ab-line-2" aria-hidden><Chars text={HERO_2} start={HERO_1.length} /></span>
            </h1>

            {/* Места команды: волна проходит по рядам, как подключения.
                На телефоне решётка нечитаема (72 квадратика по 14px) —
                там вместо неё полоса доказательств ab-proof. */}
            <div className="ab-seats" aria-hidden>
              <div className="ab-seats-move">
                {Array.from({ length: 72 }, (_, i) => (
                  <i
                    key={i}
                    className="ab-seat a-idle"
                    style={{ ["--c" as string]: i % 24, ["--r" as string]: Math.floor(i / 24) }}
                  />
                ))}
              </div>
            </div>
            <ul className="ab-proof">
              {HERO_PROOF.map((p, i) => (
                <li key={p.label} className="a-settle" style={{ ["--i" as string]: i + 1 }}>
                  <b className="a-num">{p.value}</b>
                  <span>{p.label}</span>
                </li>
              ))}
            </ul>

            <div className="ab-cover-grid">
              <p className="a-lead">
                Подключения для сотрудников и серверы под задачи — по договору и на одном счёте.
                Расскажите про команду: вернёмся с расчётом в течение четырёх рабочих часов.
              </p>
              <div className="a-actions">
                <a href="#request" className="a-btn a-btn-primary">Получить расчёт</a>
                {/* Адрес продаж совпадает с /contact. При смене менять везде. */}
                <a href="mailto:sales@atlas.secure" className="a-btn a-btn-quiet">sales@atlas.secure</a>
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 · Задачи ───────────────────────────────────────── */}
        <section className="a-sheet ab-cases-sheet" data-sheet="13" data-title="Задачи" aria-labelledby="ab-cases-title">
          <div className="a-field">
            <h2 id="ab-cases-title" className="a-h2 a-settle">
              <span className="a-no">02</span>с чем приходят команды
            </h2>
            <p className="ab-cases-hint a-settle" style={{ ["--i" as string]: 2 }} aria-hidden>Листайте карточки →</p>
            <ol className="ab-cases">
              {CASES.map((c, i) => (
                <li
                  key={c.title}
                  className="ab-case a-slide"
                  style={{ ["--i" as string]: i, ["--dir" as string]: i % 2 ? 1 : -1 }}
                >
                  <span className="ab-case-n a-wide" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 03 · Один счёт — закреплённая сцена ───────────────── */}
        <section className="a-sheet ab-one" data-sheet="13" data-title="Один счёт" aria-labelledby="ab-one-title">
          <div className="ab-one-stick">
            <div className="a-field">
              <h2 id="ab-one-title" className="a-h2">
                <span className="a-no">03</span>
                <Words text="одна оплата вместо десятка подписок" />
              </h2>

              <div className="ab-merge">
                <p className="ab-merge-before a-wide" aria-hidden>десять личных подписок</p>
                <div className="ab-bill" aria-hidden>
                  {TILES.map((t, i) => (
                    <span
                      key={i}
                      className="ab-tile"
                      style={{ ["--x" as string]: t.x, ["--y" as string]: t.y, ["--rot" as string]: t.r, ["--i" as string]: i }}
                    >
                      <span className="a-wide">{i + 1}</span>
                    </span>
                  ))}
                  <i className="ab-bill-glint a-idle" />
                </div>
                <p className="ab-merge-after a-wide">один счёт компании</p>
              </div>

              <p className="a-p ab-one-end">
                Подключения живут в общем аккаунте компании. Бухгалтерия получает одну оплату и
                закрывающие документы, а не десяток личных чеков.
              </p>
            </div>
          </div>
        </section>

        {/* ── 04 · Что входит ───────────────────────────────────── */}
        <section className="a-sheet ab-inc-sheet" data-sheet="13" data-title="Что входит" aria-labelledby="ab-inc-title">
          <div className="a-field">
            <h2 id="ab-inc-title" className="a-h2 a-settle">
              <span className="a-no">04</span>что входит в доступ для компании
            </h2>
            <dl className="ab-inc">
              {INCLUDED.map((it, i) => (
                <div key={it.term} className="ab-inc-row a-settle" style={{ ["--i" as string]: i + 1 }}>
                  <dt>
                    <span className="ab-inc-mark a-print" aria-hidden />
                    {it.term}
                  </dt>
                  <dd>{it.detail}</dd>
                </div>
              ))}
            </dl>
            <p className="ab-vds-line a-settle" style={{ ["--i" as string]: 8 }}>
              Нужны выделенные серверы — <Link href="/vds">параметры опубликованы отдельно</Link>. В заявке
              можно указать конфигурацию.
            </p>
          </div>
        </section>

        {/* ── 05 · Заявка — финальная плита ─────────────────────── */}
        <section className="a-sheet a-plate ab-request" id="request" data-sheet="13" data-title="Заявка" aria-labelledby="request-title">
          <div className="a-field">
            <h2 id="request-title" className="a-h2">
              <span className="a-no">05</span>
              <Words text="расскажите про команду" />
            </h2>
            <BusinessRequestForm />
          </div>
        </section>
      </main>
    </AtlasShell>
  );
}
