"use client";

import { useState } from "react";
import Link from "next/link";
import "./unsubscribe.css";

export type UnsubscribeState = "ready" | "already" | "invalid" | "error";
type State = UnsubscribeState | "done" | "busy";

const COPY: Record<State, { title: string; text: (email: string) => string }> = {
  ready: { title: "Отписаться от рассылки?", text: (e) => `Больше не будем присылать новости и предложения на ${e}.` },
  busy: { title: "Отписываем…", text: () => "Секунду." },
  done: { title: "Готово, вы отписаны", text: (e) => `Новости и предложения на ${e} больше не придут.` },
  already: { title: "Вы уже отписаны", text: (e) => `Новости и предложения на ${e} не приходят. Передумаете — напишите в поддержку.` },
  invalid: { title: "Ссылка не работает", text: () => "Похоже, ссылка из письма открылась не целиком. Откройте её из письма ещё раз или напишите в поддержку — отпишем вручную." },
  error: { title: "Не получилось", text: () => "Сервер не ответил. Попробуйте ещё раз через минуту." },
};

/**
 * Тело /unsubscribe: одна карточка корпуса «Атлас», одна кнопка.
 * Служебные письма (начисления, условия) отписка не выключает — это
 * сказано прямо, чтобы человек не удивился письму о подарке.
 */
export default function UnsubscribeView({ token, initial, email }: { token: string; initial: UnsubscribeState; email: string | null }) {
  const [state, setState] = useState<State>(initial);
  const [err, setErr] = useState<string | null>(null);
  const shown = email ?? "ваш адрес";

  const confirm = async () => {
    setState("busy");
    setErr(null);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        setState(json.data?.already ? "already" : "done");
        return;
      }
      setErr(json?.error || `Сервер ответил ${res.status}`);
      setState(res.status === 404 || res.status === 400 ? "invalid" : "ready");
    } catch {
      setErr("Нет связи с сервером");
      setState("ready");
    }
  };

  const c = COPY[state];
  return (
    <section className="v-section v-center">
      <div className="v-wrap v-narrow">
        <div className="v-card v-card-pad unsub-card" aria-labelledby="unsub-h" aria-live="polite">
          <span className="v-badge">Рассылка</span>
          <h1 id="unsub-h" className="v-h3 unsub-h1">
            {c.title}
          </h1>
          <p className="v-text unsub-text">{c.text(shown)}</p>
          {err && (
            <p className="v-error" role="alert">
              {err}
            </p>
          )}
          <div className="v-actions">
            {(state === "ready" || state === "busy") && (
              <>
                <button type="button" className="v-btn v-btn-primary" onClick={confirm} disabled={state === "busy"}>
                  {state === "busy" ? "Отписываем…" : "Отписаться"}
                </button>
                <Link href="/" className="v-btn v-btn-soft">
                  Остаться
                </Link>
              </>
            )}
            {state === "error" && (
              <button type="button" className="v-btn v-btn-primary" onClick={() => location.reload()}>
                Попробовать ещё раз
              </button>
            )}
            {(state === "done" || state === "already" || state === "invalid") && (
              <>
                <Link href="/" className="v-btn v-btn-primary">
                  На главную
                </Link>
                <Link href="/support" className="v-btn v-btn-soft">
                  Поддержка
                </Link>
              </>
            )}
          </div>
          <p className="v-small unsub-fine">
            Служебные письма — о начислениях, оплате и изменениях условий сервиса — приходят всем: отписка на них не действует.
          </p>
        </div>
      </div>
    </section>
  );
}
