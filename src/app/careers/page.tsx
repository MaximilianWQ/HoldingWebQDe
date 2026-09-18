import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import BrandMark from "@/components/pixel/BrandMark";
import Icon from "@/components/pixel/Icon";
import CareersList from "./CareersList";
import { VACANCIES } from "@/lib/careers";
import { SUPPORT_DESK, TELEGRAM_SUPPORT } from "@/lib/contacts";
import { COUNTRY_COUNT, CITY_COUNT } from "@/lib/locations";
import { FOUNDED } from "@/lib/nav";
import { plural } from "@/lib/ru-words";
import "@/app/tech.css";
import "./careers.css";

/**
 * /careers — вакансии на тёмном технологическом корпусе (владелец,
 * 18.09.2026: «вакансии размещаем как на скринах, в таком же стиле»).
 *
 * Состав вакансий и вилки — с макетов владельца, требования и «будет
 * плюсом» собраны по рынку РФ 2026 (см. шапку src/lib/careers.ts).
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
  alternates: { canonical: "/careers" },
};

const STEPS = [
  { n: "01", t: "Отклик", d: "Письмо или сообщение в Telegram — коротко, кто вы и что делали." },
  { n: "02", t: "Знакомство", d: "Созвон на полчаса: чем занимаемся мы, чем хотите заниматься вы." },
  { n: "03", t: "Техническое интервью", d: "Разбор реальных задач направления, без головоломок на смекалку." },
  { n: "04", t: "Оффер", d: "Вилка обсуждается на первом созвоне, чтобы никто не тратил время впустую." },
];

export default function CareersPage() {
  const mailto = `mailto:${SUPPORT_DESK.email}?subject=${encodeURIComponent("Вакансия")}`;
  return (
    <VShell>
      <div className="t">
        {/* 01 · первый экран */}
        <section className="t-sec tc-hero" aria-labelledby="tc-title">
          <div className="t-wrap">
            <p className="t-label tc-mark">
              <span className="tc-mark-logo" aria-hidden><BrandMark size={16} /></span>
              Atlas Secure · вакансии
            </p>
            <h1 id="tc-title" className="t-h1">В команду требуются</h1>
            <p className="t-lead">
              Мы держим сеть в {COUNTRY_COUNT} {plural(COUNTRY_COUNT, ["стране", "странах", "странах"])} и{" "}
              {CITY_COUNT} {plural(CITY_COUNT, ["городе", "городах", "городах"])}, панель, биллинг и поддержку. Команда
              распределённая с {FOUNDED} года — работаем удалённо и платим в рублях.
            </p>
            <div className="t-actions">
              <a className="t-btn" href={mailto}>
                Напиши нам
                <Icon name="arrow-right" size={16} />
              </a>
              <a className="t-btn t-btn-accent" href={TELEGRAM_SUPPORT.href} target="_blank" rel="noopener noreferrer">
                {TELEGRAM_SUPPORT.handle}
              </a>
            </div>
          </div>
        </section>

        {/* 02 · список вакансий */}
        <section className="t-sec t-reveal" aria-labelledby="tc-open">
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

        {/* 03 · как проходит найм */}
        <section className="t-sec t-reveal" aria-labelledby="tc-how">
          <div className="t-wrap">
            <div className="t-split">
              <h2 id="tc-how" className="t-split-title">Как проходит найм</h2>
              <ol className="tc-steps">
                {STEPS.map((s) => (
                  <li key={s.n} className="tc-step">
                    <span className="tc-step-n t-mono">{s.n}</span>
                    <b>{s.t}</b>
                    <span>{s.d}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 04 · финал */}
        <section className="t-sec t-reveal" aria-labelledby="tc-final">
          <div className="t-wrap">
            <div className="tc-final">
              <h2 id="tc-final" className="t-h2">
                Не нашли свою роль?
              </h2>
              <p className="t-lead">
                Напишите всё равно: если вы делаете сети, данные или продукт лучше, чем мы умеем сейчас, — роль найдётся.
                В письме хватит двух абзацев и ссылки на то, что вы сделали.
              </p>
              <div className="t-actions">
                <a className="t-btn" href={mailto}>
                  {SUPPORT_DESK.email}
                  <Icon name="arrow-right" size={16} />
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
