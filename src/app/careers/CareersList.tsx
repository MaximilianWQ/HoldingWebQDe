"use client";

import { useState } from "react";
import Icon from "@/components/pixel/Icon";
import { VACANCIES, CAREERS_SUBJECT } from "@/lib/careers";
import { SUPPORT_DESK, TELEGRAM_SUPPORT } from "@/lib/contacts";

/**
 * Список вакансий — как на макете владельца: крупная вилка контуром,
 * под ней должность и теги. Строка раскрывается: задачи, требования и
 * «будет плюсом» лежат внутри, а не вываливаются все сразу — иначе
 * страница превращается в шесть простыней, и человек не находит свою.
 *
 * Раскрытая строка — одна: сравнивать вакансии всё равно приходится по
 * вилке и названию, а читают их по очереди.
 */
export default function CareersList() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="tc-list">
      {VACANCIES.map((v) => {
        const isOpen = open === v.id;
        const mailto = `mailto:${SUPPORT_DESK.email}?subject=${encodeURIComponent(`${CAREERS_SUBJECT}: ${v.title}`)}`;
        return (
          <article key={v.id} className="tc-row" data-open={isOpen ? "" : undefined}>
            <h3 className="tc-row-head">
              <button
                type="button"
                className="tc-row-btn"
                aria-expanded={isOpen}
                aria-controls={`tc-panel-${v.id}`}
                onClick={() => setOpen(isOpen ? null : v.id)}
              >
                <span className="tc-pay-wrap">
                  <span className="t-num tc-pay">
                    {v.from}–{v.to}k
                  </span>
                  {/* Единица стоит под вилкой, как на макете: «350–450k»
                      без «₽/мес» читается как что угодно — от рублей в
                      год до долларов. */}
                  <span className="tc-pay-unit t-mono">₽/мес · {v.mode}</span>
                </span>
                <span className="tc-row-main">
                  <b className="tc-row-title">{v.title}</b>
                  <span className="tc-row-tags">
                    {v.tags.map((t) => (
                      <span key={t} className="tc-row-tag">{t}</span>
                    ))}
                  </span>
                </span>
                <span className="tc-row-mark" aria-hidden>
                  <Icon name="chevron-down" size={18} />
                </span>
              </button>
            </h3>

            <div className="tc-panel" id={`tc-panel-${v.id}`} role="region">
              <div className="tc-panel-in">
                <p className="tc-about">{v.about}</p>
                <div className="tc-cols">
                  <div>
                    <p className="t-label">Что делать</p>
                    <ul className="tc-ul">
                      {v.tasks.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="t-label">Что ждём</p>
                    <ul className="tc-ul">
                      {v.need.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="t-label">Будет плюсом</p>
                    <ul className="tc-ul tc-ul-plus">
                      {v.plus.map((t) => <li key={t}>{t}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="t-actions">
                  <a className="t-btn" href={mailto}>
                    Откликнуться
                    <Icon name="arrow-right" size={16} />
                  </a>
                  <a className="t-btn t-btn-accent" href={TELEGRAM_SUPPORT.href} target="_blank" rel="noopener noreferrer">
                    Написать в Telegram
                  </a>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
