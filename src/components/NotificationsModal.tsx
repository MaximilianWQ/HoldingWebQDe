"use client";

import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import Icon from "@/components/pixel/Icon";

export interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsModalProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

/**
 * Шторка уведомлений кабинета. Телефон: шторка снизу у большого
 * пальца; шире — панель под колокольчиком.
 *
 * ПОЧЕМУ КЛАССЫ ПЕРЕИМЕНОВАНЫ (19.09.2026). Шторка была набрана
 * классами `.ak-*` из `work-atlas.css`, а кабинет при переводе на
 * корпус Atlas Secure VPS перестал подключать этот файл: его теперь
 * подключает только админка. Правил не было ни одного, шторка
 * выходила без размеров и фона — владелец нажимал колокольчик и
 * видел пустоту. Стили переехали в `cabinet-vps.css` под префикс
 * `vc-`, рядом с остальным кабинетом.
 *
 * Отсюда правило: у компонента, который рисуется на конкретном
 * экране, стили живут в CSS этого экрана. Общий компонент на чужих
 * классах молча ломается при первом же переезде корпуса.
 *
 * Логика прежняя: загрузка /api/user/notifications, при открытии всё
 * отмечается прочитанным (/api/user/notifications/read), Esc и клик
 * мимо закрывают, прокрутка страницы на время шторки заперта.
 *
 * Новое — «Очистить» и крестик у записи. Удаления в API нет, а общие
 * рассылки (target = 'all') — одна строка на всех: удалять её нельзя.
 * Поэтому очищенные скрываются на клиенте: список id в localStorage
 * этого браузера (не больше 200 последних). Серверные данные не
 * меняются; об этом шторка говорит прямо.
 */
const CLEARED_KEY = "atlas_notifications_cleared";
const CLEARED_MAX = 200;

function readCleared(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLEARED_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeCleared(ids: string[]) {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify(ids.slice(-CLEARED_MAX)));
  } catch {
    // хранилище недоступно — скрытие проживёт до перезагрузки
  }
}

export default function NotificationsModal({ open, onClose, onUnreadCountChange }: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cleared, setCleared] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/user/notifications");
      const result = await res.json();
      if (result.success) {
        const hidden = new Set(readCleared());
        setCleared([...hidden]);
        setNotifications(result.data);
        const unread = result.data.filter((n: Notification) => !n.read && !hidden.has(n.id)).length;
        onUnreadCountChange?.(unread);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Animate in/out
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Фокус — на «Закрыть»: Esc и Tab работают сразу.
  useEffect(() => {
    if (open && visible) closeRef.current?.focus({ preventScroll: true });
  }, [open, visible]);

  // Mark as read on open
  useEffect(() => {
    if (!open) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const markRead = async () => {
      try {
        await fetch("/api/user/notifications/read", { method: "POST" });
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        onUnreadCountChange?.(0);
      } catch {
        // silent
      }
    };
    markRead();
  }, [open, notifications, onUnreadCountChange]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll when open on mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open && !visible) return null;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return "Только что";
    if (mins < 60) return `${mins} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  };

  const hiddenSet = new Set(cleared);
  const list = notifications.filter((n) => !hiddenSet.has(n.id));
  const clearedHere = notifications.length - list.length;
  const shown = visible && open;

  const hide = (ids: string[]) => {
    const next = [...new Set([...cleared, ...ids])];
    writeCleared(next);
    setCleared(next);
    const nextSet = new Set(next);
    onUnreadCountChange?.(notifications.filter((n) => !n.read && !nextSet.has(n.id)).length);
    // Фокус не теряется вместе с убранной записью.
    closeRef.current?.focus({ preventScroll: true });
  };

  return (
    <>
      {/* Подложка: клик мимо шторки закрывает её. */}
      <div className="vc-sheet-veil" data-open={shown ? "" : undefined} onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        className="vc-sheet"
        data-open={shown ? "" : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vc-sheet-h"
      >
        <div className="vc-sheet-head">
          <h2 id="vc-sheet-h" className="vc-sheet-h">Уведомления</h2>
          {list.length > 0 && <span className="vc-sheet-count" aria-label={`Всего: ${list.length}`}>{list.length}</span>}
          <span className="vc-sheet-tools">
            {list.length > 0 && (
              <button type="button" className="v-btn v-btn-soft v-btn-sm" onClick={() => hide(list.map((n) => n.id))}>
                Очистить
              </button>
            )}
            <button ref={closeRef} type="button" className="vc-sheet-x" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" size={18} />
            </button>
          </span>
        </div>

        <div className="vc-sheet-body">
          {loading ? (
            <div className="vc-sheet-empty" role="status">
              <span className="vc-sheet-spin" aria-hidden />
              <span className="b-sr">Загружаем уведомления…</span>
            </div>
          ) : list.length === 0 ? (
            <div className="vc-sheet-empty">
              <span className="vc-sheet-empty-ico" aria-hidden><Icon name="bell" size={20} /></span>
              <p className="vc-sheet-h">Нет уведомлений</p>
              <p className="vc-sheet-fine">
                {clearedHere > 0 ? "Очищенные скрыты на этом устройстве. Новые появятся здесь." : "Новые появятся здесь."}
              </p>
            </div>
          ) : (
            <ul className="vc-notes">
              {list.map((n, i) => (
                <li key={n.id} className="vc-note" data-unread={!n.read ? "" : undefined} style={{ "--k": Math.min(i, 8) } as CSSProperties}>
                  <div className="vc-note-copy">
                    <p className="vc-note-title">
                      {n.title}
                      {!n.read && <span className="b-sr"> — новое</span>}
                    </p>
                    <p className="vc-note-text">{n.message}</p>
                    <p className="vc-note-time">{formatTime(n.createdAt)}</p>
                  </div>
                  <button type="button" className="vc-note-x" onClick={() => hide([n.id])} aria-label={`Убрать уведомление «${n.title}»`}>
                    <Icon name="close" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {list.length > 0 && <p className="vc-sheet-fine vc-sheet-foot">Очистка скрывает уведомления на этом устройстве.</p>}
      </div>
    </>
  );
}
