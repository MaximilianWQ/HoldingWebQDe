import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import BrandMark from "@/components/pixel/BrandMark";
import Icon, { type IconName } from "@/components/pixel/Icon";
import CareersList from "./CareersList";
import TeamFigures from "./TeamFigures";
import { VACANCIES } from "@/lib/careers";
import { TELEGRAM_SUPPORT } from "@/lib/contacts";
import { COUNTRY_COUNT, CITY_COUNT } from "@/lib/locations";
import { FOUNDED } from "@/lib/nav";
import { plural } from "@/lib/ru-words";
import "@/app/tech.css";
import "./careers.css";

/**
 * /careers — вакансии на тёмном технологическом корпусе.
 *
 * Разворот переписан 19.09.2026 по разбору владельца («сделай похожее
 * на эти экраны, технологичным») с девятью снимками ecom.tech. Что
 * взято как приём и почему:
 *
 *   — ДИСПЛЕЙНЫЙ ЗАГОЛОВОК прописными и лаймом. Лайм на витрине не
 *     используется: он живёт только здесь и на /infrastructure, и
 *     этого достаточно, чтобы раздел про найм читался как другой
 *     разговор, а не как продажа подписки;
 *   — РАЗВОРОТ «название слева — содержимое справа» (`t-split`) как
 *     единственная сетка страницы: у ecom.tech так собран весь сайт,
 *     и это честнее сетки из одинаковых карточек;
 *   — ПИЛЮЛИ-СТРОКИ со стрелкой вместо списка ссылок;
 *   — ЧИСЛА КОНТУРОМ для шагов найма — приём корпуса уже был
 *     (`t-num`, вилки вакансий), здесь он просто применён второй раз;
 *   — ПОЛОСА-ПРИЗЫВ внизу: одна широкая плита, слева фраза, справа
 *     контурная кнопка.
 *
 * ЧТО НЕ ВЗЯТО: пиксельные бегуны и фотографии сотрудников (у нас нет
 * ни своих съёмок, ни права на чужие), кислотные плашки поверх
 * фотографий, счётчики «нас уже N». Фигуры первого экрана нарисованы
 * блоками — тем же штрихом, что и иконки корпуса (`TeamFigures.tsx`).
 *
 * Слова «VPN» на странице нет вовсе (владелец, 18.09.2026): правило
 * витрины действует и в найме. Инфраструктура называется
 * «VPS-инфраструктурой», технология — «туннельными протоколами».
 */
export const metadata: Metadata = {
  title: "Вакансии",
  description:
    `Atlas Secure ищет инженеров и не только: ${VACANCIES.length} открытых ролей, удалённая работа, оплата в рублях. ` +
    `Инфраструктура в ${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}.`,
};

/** Чем занята команда. Иконки — из собственного набора корпуса. */
const WORK: Array<{ icon: IconName; t: string }> = [
  { icon: "globe", t: "Узлы и маршруты" },
  { icon: "shield", t: "Защита и антифрод" },
  { icon: "receipt", t: "Биллинг и платежи" },
  { icon: "devices", t: "Приложения" },
  { icon: "chat", t: "Поддержка" },
  { icon: "grid", t: "Панель и админка" },
];

/**
 * Что мы даём. Каждая строка — то, что можно проверить в первом же
 * разговоре. Ни «обучения за счёт компании», ни «ДМС», ни
 * «печенек»: обещать то, чего у нас нет, здесь дороже, чем на
 * витрине — человек придёт и увидит.
 */
const OFFER = [
  { t: "Удалённо и в рублях", d: "Команда распределена с " + FOUNDED + " года. Место работы выбираете вы." },
  { t: "Вилка на первом созвоне", d: "Называем её до задач и тестовых, чтобы никто не тратил время впустую." },
  { t: "Свой участок целиком", d: "Команда маленькая: у каждого направления один ответственный, а не половина роли." },
  { t: "Решения без комитетов", d: "От идеи до боевой выкладки — дни, а не кварталы. Это видно по истории изменений." },
];

const STEPS = [
  { n: "01", t: "Отклик", d: "Форма на этой странице: имя, почта и резюме файлом." },
  { n: "02", t: "Знакомство", d: "Созвон на полчаса: чем занимаемся мы, чем хотите заниматься вы." },
  { n: "03", t: "Техническое интервью", d: "Разбор реальных задач направления, без головоломок на смекалку." },
  { n: "04", t: "Оффер", d: "Вилка обсуждается на первом созвоне, так что сюрприза в конце не будет." },
];

export default function CareersPage() {
  const roleWord = plural(VACANCIES.length, ["роль", "роли", "ролей"]);
  return (
    <VShell>
      <div className="t tc">
        {/* 01 · первый экран */}
        <section className="t-sec tc-hero" aria-labelledby="tc-title">
          <div className="t-wrap">
            <div className="tc-hero-grid">
              <div className="tc-hero-left">
                <p className="t-label tc-mark">
                  <span className="tc-mark-logo" aria-hidden><BrandMark size={16} /></span>
                  Atlas Secure · вакансии
                </p>
                <h1 id="tc-title" className="tc-display">
                  Приходи<br />в команду
                </h1>
                <TeamFigures />
              </div>

              <div className="tc-hero-right">
                <p className="tc-hero-text">
                  Мы держим сеть в {COUNTRY_COUNT} {plural(COUNTRY_COUNT, ["стране", "странах", "странах"])} и{" "}
                  {CITY_COUNT} {plural(CITY_COUNT, ["городе", "городах", "городах"])}, панель, биллинг и поддержку.
                  Команда распределённая, работаем удалённо и платим в рублях.
                </p>
                <p className="t-label tc-hero-label">Открытые роли:</p>
                <ul className="tc-pills">
                  {VACANCIES.map((v) => (
                    <li key={v.id}>
                      <a className="tc-pill" href={`#vac-${v.id}`}>
                        <span>{v.title}</span>
                        <Icon name="arrow-right" size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 02 · чем занята команда */}
        <section className="t-sec t-reveal" aria-labelledby="tc-work">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-work" className="t-split-title">Над чем работаем</h2>
              <ul className="tc-work">
                {WORK.map((w) => (
                  <li key={w.t} className="tc-work-item">
                    <span className="tc-work-icon" aria-hidden><Icon name={w.icon} size={30} /></span>
                    <b>{w.t}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 03 · что даём */}
        <section className="t-sec t-reveal" aria-labelledby="tc-offer">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-offer" className="t-split-title">Что даём</h2>
              <ul className="tc-offer">
                {OFFER.map((o) => (
                  <li key={o.t} className="tc-offer-item">
                    <b>{o.t}</b>
                    <span>{o.d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 04 · список вакансий */}
        <section className="t-sec t-reveal" id="roles" aria-labelledby="tc-open">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-open" className="t-split-title">
                Открытые роли
                <span className="tc-count t-mono">{VACANCIES.length}</span>
              </h2>
              <div>
                <CareersList />
              </div>
            </div>
          </div>
        </section>

        {/* 05 · как проходит найм */}
        <section className="t-sec t-reveal" aria-labelledby="tc-how">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-how" className="t-split-title">Как к нам попасть</h2>
              <ol className="tc-steps">
                {STEPS.map((s) => (
                  <li key={s.n} className="tc-step">
                    <b className="t-num tc-step-num">{s.n}</b>
                    <b className="tc-step-t">{s.t}</b>
                    <span>{s.d}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 06 · полоса-призыв */}
        <section className="t-sec t-reveal" aria-label="Перейти к вакансиям">
          <div className="t-wrap">
            <div className="tc-bar">
              <p className="tc-bar-t">Все {VACANCIES.length} {roleWord} — выше</p>
              <a className="tc-bar-btn" href="#roles">
                Перейти к вакансиям
                <Icon name="arrow-right" size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* 07 · финал */}
        <section className="t-sec t-reveal" aria-labelledby="tc-final">
          <div className="t-wrap">
            <div className="tc-final">
              <h2 id="tc-final" className="t-h2">Не нашли свою роль?</h2>
              <p className="t-lead">
                Откликнитесь на самую близкую и напишите в паре слов, чем хотели бы заниматься. Если вы делаете сети,
                данные или продукт лучше, чем мы умеем сейчас, — роль найдётся.
              </p>
              <div className="t-actions">
                <a className="t-btn" href="#roles">
                  Выбрать вакансию
                  <Icon name="arrow-right" size={16} />
                </a>
                <a className="t-btn t-btn-accent" href={TELEGRAM_SUPPORT.href} target="_blank" rel="noopener noreferrer">
                  {TELEGRAM_SUPPORT.handle}
                </a>
                <Link className="t-btn t-btn-accent" href="/infrastructure">
                  С чем придётся работать
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </VShell>
  );
}
