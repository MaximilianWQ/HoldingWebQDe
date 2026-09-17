"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

/**
 * Короткое плавное уведомление сверху (≈1,8 с). Одно на экране: новое
 * заменяет прежнее. `role="status"` — чтец экрана произносит текст.
 */
type Show = (text: string) => void;
const ToastContext = createContext<Show>(() => {});

export function useToast(): Show {
  return useContext(ToastContext);
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<Show>((text) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text });
    timer.current = window.setTimeout(() => setToast(null), 1850);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="v-toast-host" role="status" aria-live="polite">
        {toast ? <div key={toast.id} className="v-toast">{toast.text}</div> : null}
      </div>
    </ToastContext.Provider>
  );
}
