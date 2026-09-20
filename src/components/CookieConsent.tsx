"use client";

import { useEffect, useRef, useState } from "react";
import {
  announceConsentSettled, hasCookieConsent, rememberCookieConsent, requestOverlay, releaseOverlay,
} from "@/lib/overlay-queue";
import { holdScroll } from "@/lib/scroll-lock";

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
 * предметом редизайна.
 *
 * 11.09.2026 (владелец: «каждый раз, когда пользователь заходит на сайт,
 * он должен соглашаться; маленькое корректное уведомление»): выбор
 * хранится в sessionStorage — до закрытия браузера, поэтому новый заход
 * снова спрашивает. Карточка короче, рядом с «Принять» — «Отклонить»:
 * сайт работает и так (cookie строго необходимые), отказ тоже закрывает
 * карточку до конца визита и отпускает очередь.
 */
export default function CookieConsent() {
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
    const t = window.setTimeout(() => {
      cancel = requestOverlay("cookie", () => setVisible(true));
    }, 1200);
    return () => {
      window.clearTimeout(t);
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
      <div className="ov-card ov-card-cookie" role="region" aria-label="Использование cookie" hidden={details}>
        <p className="ov-text">
          Мы используем только необходимые cookie — для входа и защиты аккаунта. Рекламных и
          аналитических нет.
        </p>
        <div className="ov-actions">
          <button type="button" onClick={accept} className="ov-btn ov-btn-primary">
            Принять
          </button>
          <button type="button" onClick={decline} className="ov-btn ov-btn-text">
            Отклонить
          </button>
          <button ref={moreRef} type="button" onClick={() => setDetails(true)} className="ov-btn ov-btn-text">
            Подробнее
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
              <h2 id="cookie-policy-title" className="ov-title">Политика использования cookie</h2>
              <button ref={closeRef} type="button" onClick={() => setDetails(false)} className="ov-x" aria-label="Закрыть">
                <Cross />
              </button>
            </div>

            <div className="ov-dialog-body">
              <section>
                <h3 className="ov-h">Какие данные мы обрабатываем</h3>
                <p className="ov-note">
                  Atlas Secure использует исключительно функциональные cookie-файлы, необходимые
                  для корректной работы сервиса. Мы не собираем и не обрабатываем данные в рекламных
                  или маркетинговых целях.
                </p>
              </section>

              <section>
                <h3 className="ov-h">Типы используемых cookie</h3>
                <ul className="ov-list">
                  {COOKIE_TYPES.map((c) => (
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
                <h3 className="ov-h">Чего мы не делаем</h3>
                <ul className="ov-never">
                  {NEVER.map((t) => (
                    <li key={t}>
                      <Cross small />
                      {t}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="ov-h">Правовое основание</h3>
                <p className="ov-note">
                  Обработка данных осуществляется на основании законного интереса оператора в обеспечении
                  функционирования сервиса (статья 6(1)(f) GDPR). Используемые cookie являются строго
                  необходимыми для предоставления запрошенной вами услуги и не требуют отдельного
                  согласия в соответствии с рекомендациями ePrivacy Directive. Ваше согласие запрашивается
                  в информационных целях для обеспечения прозрачности обработки данных.
                </p>
              </section>

              <section>
                <h3 className="ov-h">Управление cookie</h3>
                <p className="ov-note">
                  Вы можете в любой момент удалить cookie через настройки вашего браузера. Обратите
                  внимание, что удаление сессионного cookie приведёт к необходимости повторной
                  авторизации в сервисе.
                </p>
              </section>
            </div>

            <div className="ov-dialog-foot">
              <button type="button" onClick={accept} className="ov-btn ov-btn-primary">
                Принять и закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const COOKIE_TYPES = [
  {
    name: "Сессионный cookie",
    tag: "Обязательный",
    text: "Идентифицирует вашу авторизованную сессию. Без него вход в личный кабинет невозможен. Хранится 3 часа и автоматически удаляется. Передаётся только по защищённому HTTPS-соединению.",
  },
  {
    name: "Cookie верификации",
    tag: "Обязательный",
    text: "Временный cookie для процесса подтверждения email. Хранится 10 минут и удаляется сразу после завершения верификации.",
  },
  {
    name: "Согласие на cookie",
    tag: "Локальное",
    text: "Сохраняется в sessionStorage вашего браузера до его закрытия — при следующем визите мы спросим снова. Не передаётся на сервер.",
  },
];

const NEVER = [
  "Не используем рекламные или аналитические cookie",
  "Не отслеживаем поведение пользователей на сайте",
  "Не передаём данные третьим лицам и рекламным сетям",
  "Не используем пиксели отслеживания и фингерпринтинг",
];

/** Собственный глиф крестика — вместо типографского ✗, который в ОС рисуется по-разному. */
function Cross({ small = false }: { small?: boolean }) {
  const s = small ? 12 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden focusable="false">
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}
