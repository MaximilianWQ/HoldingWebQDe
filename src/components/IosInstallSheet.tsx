"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/pixel/BrandMark";
import { requestOverlay, releaseOverlay, whenConsentSettled, snoozed, snooze } from "@/lib/overlay-queue";

const SNOOZE_KEY = "ios-install-dismissed";

/**
 * «Atlas на iPhone» — нижний лист в кабинете (владелец, 11.09.2026:
 * «когда пользователь зашёл на дашборд, через пару секунд снизу плавно
 * выскакивает корректный попап с закруглёнными краями — установить
 * мини-приложение; показывать только на iOS»).
 *
 * Показывается только в Safari на iPhone/iPad и только если кабинет
 * открыт в браузере, а не с экрана «Домой». Встаёт в общую очередь
 * нижних карточек (после cookie) через 2,5 с. «Установить» ведёт на
 * пошаговую инструкцию /install-ios; «Не сейчас» и «Установить» — пауза
 * 3 дня (у кого не получилось с первого раза — предложим снова).
 */
export function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/**
 * Не Safari: встроенный браузер Telegram/Instagram (WKWebView — в строке
 * агента нет «Safari/») или Chrome/Firefox/Edge/Яндекс на iPhone. Там
 * пункта «На экран „Домой“» нет или он ведёт себя иначе, поэтому лист
 * предлагает открыть кабинет в Safari (13.09.2026: владелец не видел
 * инструкции — в том числе из-за этих браузеров).
 */
export function isIosNonSafari(): boolean {
  const ua = navigator.userAgent;
  return /CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS|GSA\//.test(ua) || !/Safari\//.test(ua);
}

export default function IosInstallSheet() {
  const [show, setShow] = useState(false);
  const [nonSafari, setNonSafari] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // ?install=1 — показать сразу, без паузы после отказа (проверка
    // владельцем и ссылка из поддержки).
    const force = new URLSearchParams(window.location.search).has("install");
    if (!isIosBrowser() || (!force && snoozed(SNOOZE_KEY, 3))) return;
    setNonSafari(isIosNonSafari());
    let cancelSlot = () => {};
    let timer = 0;
    const cancelConsent = whenConsentSettled(() => {
      timer = window.setTimeout(() => {
        cancelSlot = requestOverlay("install", () => setShow(true));
      }, force ? 600 : 2500);
    });
    return () => {
      cancelConsent();
      window.clearTimeout(timer);
      cancelSlot();
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // close стабилен по смыслу: пишет паузу и отпускает слот.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const close = () => {
    snooze(SNOOZE_KEY);
    setShow(false);
    releaseOverlay("install");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!show) return null;

  if (nonSafari) {
    return (
      <div className="ov-sheet-wrap" onClick={close}>
        <div className="ov-sheet" role="dialog" aria-modal="true" aria-labelledby="ios-sheet-title" aria-describedby="ios-sheet-sub" onClick={(e) => e.stopPropagation()}>
          <span className="ov-sheet-grip" aria-hidden />
          <div className="ov-sheet-head">
            <span className="ov-sheet-icon" aria-hidden>
              <BrandMark size={26} />
            </span>
            <div>
              <p id="ios-sheet-title" className="ov-sheet-title">Откройте кабинет в Safari</p>
              <p id="ios-sheet-sub" className="ov-sheet-sub">
                Поставить Atlas на экран «Домой» можно только из Safari. Скопируйте ссылку и вставьте её в адресную строку Safari.
              </p>
            </div>
          </div>
          <div className="ov-sheet-actions">
            <button type="button" className="ov-btn ov-btn-primary" onClick={copyLink} aria-live="polite">
              {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
            </button>
            <button type="button" className="ov-btn ov-sheet-later" onClick={close}>
              Не сейчас
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ov-sheet-wrap" onClick={close}>
      <div
        className="ov-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-sheet-title"
        aria-describedby="ios-sheet-sub"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="ov-sheet-grip" aria-hidden />
        <div className="ov-sheet-head">
          <span className="ov-sheet-icon" aria-hidden>
            <BrandMark size={26} />
          </span>
          <div>
            <p id="ios-sheet-title" className="ov-sheet-title">Atlas на экран «Домой»</p>
            <p id="ios-sheet-sub" className="ov-sheet-sub">Кабинет откроется как приложение — одним касанием.</p>
          </div>
        </div>
        <ul className="ov-sheet-perks">
          <li>Во весь экран, без адресной строки</li>
          <li>Ключ и подписка всегда под рукой</li>
          <li>Уведомления о продлении — на iPhone они приходят только приложениям с экрана «Домой»</li>
        </ul>
        <p className="ov-sheet-note">Для iPhone и iPad в Safari · около 30 секунд</p>
        <div className="ov-sheet-actions">
          <Link href="/install-ios" className="ov-btn ov-btn-primary" onClick={close}>
            Установить
          </Link>
          <button type="button" className="ov-btn ov-sheet-later" onClick={close}>
            Не сейчас
          </button>
        </div>
      </div>
    </div>
  );
}
