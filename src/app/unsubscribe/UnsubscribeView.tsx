"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dict } from "@/i18n";
import { fill } from "@/i18n";
import { localeHref, type Locale } from "@/lib/locale";
import "./unsubscribe.css";

export type UnsubscribeState = "ready" | "already" | "invalid" | "error";
type State = UnsubscribeState | "done" | "busy";

/**
 * Заголовок и текст для каждого состояния. Собирается из словаря:
 * компонент клиентский, поэтому сам словарь не читает.
 */
function copyFor(t: Dict["unsubscribe"]): Record<State, { title: string; text: (email: string) => string }> {
  const at = (s: string) => (email: string) => fill(s, { email });
  return {
    ready: { title: t.readyTitle, text: at(t.readyText) },
    busy: { title: t.busyTitle, text: () => t.busyText },
    done: { title: t.doneTitle, text: at(t.doneText) },
    already: { title: t.alreadyTitle, text: at(t.alreadyText) },
    invalid: { title: t.invalidTitle, text: () => t.invalidText },
    error: { title: t.errorTitle, text: () => t.errorText },
  };
}

/**
 * Тело /unsubscribe: одна карточка корпуса «Атлас», одна кнопка.
 * Служебные письма (начисления, условия) отписка не выключает — это
 * сказано прямо, чтобы человек не удивился письму о подарке.
 */
export default function UnsubscribeView({
  token,
  initial,
  email,
  locale,
  t,
}: {
  token: string;
  initial: UnsubscribeState;
  email: string | null;
  locale: Locale;
  t: Dict["unsubscribe"];
}) {
  const to = (href: string) => localeHref(href, locale);
  const [state, setState] = useState<State>(initial);
  const [err, setErr] = useState<string | null>(null);
  const shown = email ?? t.yourAddress;

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
      setErr(json?.error || fill(t.serverSaid, { status: res.status }));
      setState(res.status === 404 || res.status === 400 ? "invalid" : "ready");
    } catch {
      setErr(t.noConnection);
      setState("ready");
    }
  };

  const c = copyFor(t)[state];
  return (
    <section className="v-section v-center">
      <div className="v-wrap v-narrow">
        <div className="v-card v-card-pad unsub-card" aria-labelledby="unsub-h" aria-live="polite">
          <span className="v-badge">{t.badge}</span>
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
                  {state === "busy" ? t.busyTitle : t.unsubscribe}
                </button>
                <Link href={to("/")} className="v-btn v-btn-soft">
                  {t.stay}
                </Link>
              </>
            )}
            {state === "error" && (
              <button type="button" className="v-btn v-btn-primary" onClick={() => location.reload()}>
                {t.retry}
              </button>
            )}
            {(state === "done" || state === "already" || state === "invalid") && (
              <>
                <Link href={to("/")} className="v-btn v-btn-primary">
                  {t.home}
                </Link>
                <Link href={to("/support")} className="v-btn v-btn-soft">
                  {t.support}
                </Link>
              </>
            )}
          </div>
          <p className="v-small unsub-fine">
            {t.fine}
          </p>
        </div>
      </div>
    </section>
  );
}
