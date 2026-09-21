"use client";

import type { Dict } from "@/i18n";

import { useEffect, useRef, useState } from "react";
import BrandMark from "@/components/pixel/BrandMark";
import { requestOverlay, releaseOverlay, whenConsentSettled, whenEngaged, snoozed, snooze } from "@/lib/overlay-queue";
import { holdScroll } from "@/lib/scroll-lock";

const SNOOZE_KEY = "ios-install-dismissed";

/**
 * «На экран Домой» для iPhone и iPad.
 *
 * ИСПРАВЛЕНО 11.09.2026:
 *   · Показывался каждый час и одновременно с согласием на cookie —
 *     теперь общий слот очереди, со второго визита, после 30 с на
 *     странице или прокрутки половины документа; отказ — пауза 7 дней.
 *   · Логотип был залит белым и на светлой странице пропадал; иконки
 *     и карточки — старой тёмной темы. Оформление — overlays.css.
 *   · Инструкция — не отдельный полноэкранный слой, а диалог поверх
 *     страницы: Esc закрывает, фокус на «Понятно».
 */
export default function IosInstallBanner({ t }: { t: Dict["install"] }) {
  const [show, setShow] = useState(false);
  const [guide, setGuide] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    // В кабинете — свой нижний лист IosInstallSheet (сразу, через 2,5 с);
    // на странице инструкции предлагать установку незачем.
    const path = window.location.pathname;
    if (path.startsWith("/dashboard") || path.startsWith("/install-ios")) return;
    if (!ios || standalone || snoozed(SNOOZE_KEY, 7)) return;

    let cancelSlot = () => {};
    let cancelEngaged = () => {};
    const cancelConsent = whenConsentSettled(() => {
      cancelEngaged = whenEngaged(() => {
        cancelSlot = requestOverlay("install", () => setShow(true));
      });
    });
    return () => {
      cancelConsent();
      cancelEngaged();
      cancelSlot();
    };
  }, []);

  useEffect(() => {
    if (!guide) return;
    const release = holdScroll();
    doneRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      release();
      window.removeEventListener("keydown", onKey);
    };
    // dismiss стабилен по смыслу: пишет в хранилище и закрывает слот.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide]);

  const dismiss = () => {
    snooze(SNOOZE_KEY);
    setGuide(false);
    setShow(false);
    releaseOverlay("install");
  };

  if (!show) return null;

  if (guide) {
    return (
      <div className="ov-dialog" onClick={dismiss}>
        <div
          className="ov-dialog-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-guide-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ov-dialog-head">
            <h2 id="ios-guide-title" className="ov-title">{t.onHome}</h2>
            <button type="button" onClick={dismiss} className="ov-x" aria-label={t.close}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ol className="ov-steps">
            <li>
              <span className="ov-step-n" aria-hidden>1</span>
              <div>
                <p className="ov-item-name">{t.step1}</p>
                <p className="ov-note">
                  {t.shareIconBefore}{" "}
                  <svg className="ov-inline-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>{" "}
                  {t.shareIconAfter}
                </p>
              </div>
            </li>
            <li>
              <span className="ov-step-n" aria-hidden>2</span>
              <div>
                <p className="ov-item-name">{t.step2}</p>
                <p className="ov-note">{t.step2note}</p>
              </div>
            </li>
            <li>
              <span className="ov-step-n" aria-hidden>3</span>
              <div>
                <p className="ov-item-name">{t.step3}</p>
                <p className="ov-note">{t.step3done}</p>
              </div>
            </li>
          </ol>
          <div className="ov-dialog-foot">
            <button ref={doneRef} type="button" onClick={dismiss} className="ov-btn ov-btn-primary">{t.done}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ov-card" role="dialog" aria-labelledby="ios-install-title">
      <div className="ov-row">
        <span className="ov-mark" aria-hidden>
          <BrandMark size={18} />
        </span>
        <div className="ov-copy">
          <p id="ios-install-title" className="ov-title">{t.onHome}</p>
          <p className="ov-note">{t.step3note}</p>
        </div>
        <button type="button" onClick={dismiss} className="ov-x" aria-label={t.close}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="ov-actions">
        {/* Пошаговая инструкция с рендерами — отдельный экран /install-ios. */}
        <a href="/install-ios" onClick={dismiss} className="ov-btn ov-btn-primary">{t.title}</a>
        <button type="button" onClick={dismiss} className="ov-btn ov-btn-text">{t.later}</button>
      </div>
    </div>
  );
}
