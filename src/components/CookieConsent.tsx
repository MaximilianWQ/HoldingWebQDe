"use client";

import { useEffect, useRef, useState } from "react";
import {
  announceConsentSettled, hasCookieConsent, rememberCookieConsent, requestOverlay, releaseOverlay,
} from "@/lib/overlay-queue";
import { holdScroll } from "@/lib/scroll-lock";
import type { Dict } from "@/i18n";

/**
 * Согласие на cookie — первое в очереди нижних карточек.
 *
 * ПЕРЕДЕЛАНО 11.09.2026 (владелец: «отображаются в одно время и много
 * там ошибок»). Карточка теперь занимает общий слот очереди
 * (`overlay-queue.ts`): пока она на экране, ни установка, ни быстрый
 * вход не показываются. Оформление — `overlays.css`, одно на все
 * страницы, без мостов старых слоёв: белая карточка в углу, MTS Wide,
 * кобальтовая кнопка.
 *
 * «Подробнее» — диалог: фокус на кнопке закрытия, Esc закрывает,
 * страница под ним не прокручивается, фокус возвращается на кнопку,
 * которая его открыла.
 *
 * Правовой текст сохранён дословно — он согласован и не является
 * предметом редизайна. С 21.09.2026 он живёт в словарях (`src/i18n`,
 * раздел `cookie`) и приходит сюда пропсом: компонент клиентский, и
 * импортируй он словарь сам — в браузер уехали бы оба языка. Язык
 * определяет корневой layout, он же и передаёт текст.
 *
 * 11.09.2026 (владелец: «каждый раз, когда пользователь заходит на сайт,
 * он должен соглашаться; маленькое корректное уведомление»): выбор
 * хранится в sessionStorage — до закрытия браузера, поэтому новый заход
 * снова спрашивает. Карточка короче, рядом с «Принять» — «Отклонить»:
 * сайт работает и так (cookie строго необходимые), отказ тоже закрывает
 * карточку до конца визита и отпускает очередь.
 */
export default function CookieConsent({ t }: { t: Dict["cookie"] }) {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (hasCookieConsent()) return;
    // В установленном приложении карточку не показываем (владелец,
    // 20.09.2026). Человек уже прошёл согласие в браузере, когда
    // добавлял приложение на экран «Домой», а во весь экран телефона
    // она там особенно мешает: приложение должно открываться сразу.
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    ) {
      return;
    }
    let cancel = () => {};
    // Не `t`: так зовётся проп со словарём.
    const timer = window.setTimeout(() => {
      cancel = requestOverlay("cookie", () => setVisible(true));
    }, 1200);
    return () => {
      window.clearTimeout(timer);
      cancel();
    };
  }, []);

  // Диалог: Esc, блокировка прокрутки, фокус.
  useEffect(() => {
    if (!details) return;
    const release = holdScroll();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetails(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      release();
      window.removeEventListener("keydown", onKey);
      moreRef.current?.focus();
    };
  }, [details]);

  // Выбор запоминается на пять суток (см. hasCookieConsent).
  const settle = (value: "1" | "0") => {
    rememberCookieConsent(value);
    setDetails(false);
    setVisible(false);
    releaseOverlay("cookie");
    announceConsentSettled();
  };
  const accept = () => settle("1");
  const decline = () => settle("0");

  if (!visible) return null;

  return (
    <>
      <div className="ov-card ov-card-cookie" role="region" aria-label={t.region} hidden={details}>
        <p className="ov-text">{t.short}</p>
        <div className="ov-actions">
          <button type="button" onClick={accept} className="ov-btn ov-btn-primary">
            {t.accept}
          </button>
          <button type="button" onClick={decline} className="ov-btn ov-btn-text">
            {t.decline}
          </button>
          <button ref={moreRef} type="button" onClick={() => setDetails(true)} className="ov-btn ov-btn-text">
            {t.more}
          </button>
        </div>
      </div>

      {details && (
        <div className="ov-dialog" onClick={() => setDetails(false)}>
          <div
            className="ov-dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-policy-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ov-dialog-head">
              <h2 id="cookie-policy-title" className="ov-title">{t.title}</h2>
              <button ref={closeRef} type="button" onClick={() => setDetails(false)} className="ov-x" aria-label={t.close}>
                <Cross />
              </button>
            </div>

            <div className="ov-dialog-body">
              <section>
                <h3 className="ov-h">{t.whatH}</h3>
                <p className="ov-note">{t.whatP}</p>
              </section>

              <section>
                <h3 className="ov-h">{t.typesH}</h3>
                <ul className="ov-list">
                  {t.types.map((c) => (
                    <li key={c.name} className="ov-item">
                      <div className="ov-item-head">
                        <span className="ov-item-name">{c.name}</span>
                        <span className="ov-tag">{c.tag}</span>
                      </div>
                      <p className="ov-note">{c.text}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="ov-h">{t.neverH}</h3>
                <ul className="ov-never">
                  {t.never.map((line) => (
                    <li key={line}>
                      <Cross small />
                      {line}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="ov-h">{t.legalH}</h3>
                <p className="ov-note">{t.legalP}</p>
              </section>

              <section>
                <h3 className="ov-h">{t.manageH}</h3>
                <p className="ov-note">{t.manageP}</p>
              </section>
            </div>

            <div className="ov-dialog-foot">
              <button type="button" onClick={accept} className="ov-btn ov-btn-primary">
                {t.acceptClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Собственный глиф крестика — вместо типографского ✗, который в ОС рисуется по-разному. */
function Cross({ small = false }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}
