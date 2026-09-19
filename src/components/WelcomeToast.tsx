"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { requestOverlay, releaseOverlay, whenConsentSettled } from "@/lib/overlay-queue";

const STORAGE_KEY = "atlas_welcome_dismissed";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

interface WelcomeToastProps {
  subscriptionEnd?: string | null;
}

function formatTimeLeft(subscriptionEnd: string): string {
  const diff = new Date(subscriptionEnd).getTime() - Date.now();
  if (diff <= 0) return "0 ч";
  const totalHours = Math.floor(diff / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days >= 1) return `${days} дн ${hours} ч`;
  if (totalHours >= 1) return `${totalHours} ч ${minutes} мин`;
  return `${minutes} мин`;
}

/**
 * Остаток пробного периода (кабинет).
 *
 * ИСПРАВЛЕНО 11.09.2026: карточка встаёт в общую очередь нижних карточек
 * (`overlay-queue.ts`, место «welcome» — после cookie, до быстрого
 * входа) и больше не выходит одновременно с ними; оформление —
 * overlays.css вместо старой темы. Кабинет показывает её только на
 * пробном периоде. Пауза после закрытия — сутки, как было.
 */
export default function WelcomeToast({ subscriptionEnd }: WelcomeToastProps) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed && Date.now() - parseInt(dismissed, 10) < COOLDOWN_MS) return;
    } catch {
      // хранилище недоступно — покажем
    }
    let cancelSlot = () => {};
    const cancelConsent = whenConsentSettled(() => {
      cancelSlot = requestOverlay("welcome", () => setVisible(true));
    });
    return () => {
      cancelConsent();
      cancelSlot();
    };
  }, []);

  useEffect(() => {
    if (!visible || !subscriptionEnd) return;
    setTimeLeft(formatTimeLeft(subscriptionEnd));
    const interval = setInterval(() => setTimeLeft(formatTimeLeft(subscriptionEnd)), 60000);
    return () => clearInterval(interval);
  }, [visible, subscriptionEnd]);

  const handleClose = () => {
    setVisible(false);
    releaseOverlay("welcome");
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // silent
    }
  };

  if (!visible) return null;

  return (
    <div className="ov-card" role="dialog" aria-labelledby="welcome-title" aria-live="polite">
      <div className="ov-row">
        <span className="ov-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
        <div className="ov-copy">
          <p id="welcome-title" className="ov-title">Пробный период: осталось {timeLeft || "…"}</p>
          <p className="ov-note">Подписку можно оформить в Telegram-боте — ключ останется тем же.</p>
        </div>
        <button type="button" onClick={handleClose} className="ov-x" aria-label="Закрыть">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="ov-actions">
        <a
          // Секрет привязки в адресе не передаём (аудит 19.09.2026):
          // это адрес бота ПОДДЕРЖКИ, а `?start=` уходит ему целиком
          // и оседает в его журнале. Привязка — своей кнопкой в
          // кабинете, одноразовым токеном.
          href="https://t.me/atlas_suppbot"
          target="_blank"
          rel="noopener noreferrer"
          className="ov-btn ov-btn-primary"
        >
          Открыть Telegram-бот
        </a>
        <button
          type="button"
          onClick={() => {
            handleClose();
            router.push("/devices");
          }}
          className="ov-btn ov-btn-text"
        >
          Подключить ключ
        </button>
      </div>
    </div>
  );
}
