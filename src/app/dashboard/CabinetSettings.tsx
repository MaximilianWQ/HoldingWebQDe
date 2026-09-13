"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import Icon from "@/components/pixel/Icon";

/**
 * Кабинет · уведомления и вход. Push — логика PushToggleButton, быстрый
 * вход (passkey) — логика SettingsCard, обе один в один. Раньше passkey
 * прятался за кнопкой «Настройки», и статус грузился только после её
 * нажатия; теперь обе строки видны сразу, статус грузится при открытии
 * кабинета.
 */
const urlB64 = (b: string) => {
  const p = "=".repeat((4 - (b.length % 4)) % 4);
  const raw = atob((b + p).replace(/-/g, "+").replace(/_/g, "/"));
  const a = new Uint8Array(raw.length);
  for (let k = 0; k < raw.length; k++) a[k] = raw.charCodeAt(k);
  return a;
};

export default function CabinetSettings({ i }: { i: number }) {
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<"" | "success" | "error">("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Новости и предложения — согласие на рекламные письма (владелец,
  // 13.09.2026). null — ещё не знаем состояние.
  const [newsOn, setNewsOn] = useState<boolean | null>(null);
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsError, setNewsError] = useState(false);

  useEffect(() => {
    fetch("/api/user/marketing-consent")
      .then((r) => r.json())
      .then((d) => setNewsOn(d.success ? !!d.data.on : null))
      .catch(() => setNewsOn(null));
  }, []);

  const toggleNews = async () => {
    if (newsSaving || newsOn === null) return;
    const next = !newsOn;
    setNewsSaving(true);
    setNewsError(false);
    setNewsOn(next);
    try {
      const r = await fetch("/api/user/marketing-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      const d = await r.json();
      if (!d.success) throw new Error();
    } catch {
      setNewsOn(!next);
      setNewsError(true);
    } finally {
      setNewsSaving(false);
    }
  };

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushEnabled(!!sub))
        .catch(() => setPushEnabled(false));
    }
    fetch("/api/auth/passkey/check")
      .then((r) => r.json())
      .then((d) => setHasPasskey(!!(d.success && d.data.hasPasskey)))
      .catch(() => setHasPasskey(false));
  }, []);

  const togglePush = async () => {
    if (pushLoading) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } else {
        const res = await fetch("/api/push/vapid-key");
        const data = await res.json();
        if (!data.success || !data.data.publicKey) return;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(data.data.publicKey) });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        setPushEnabled(true);
      }
    } catch {
      /* как раньше: молча */
    } finally {
      setPushLoading(false);
    }
  };

  const setupPasskey = async () => {
    setPasskeyLoading(true);
    setPasskeyStatus("");
    try {
      const o = await fetch("/api/auth/passkey/register");
      const od = await o.json();
      if (!od.success) throw new Error();
      const cred = await startRegistration({ optionsJSON: od.data });
      const v = await fetch("/api/auth/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cred),
      });
      const vd = await v.json();
      if (vd.success) {
        setPasskeyStatus("success");
        setHasPasskey(true);
        setTimeout(() => setPasskeyStatus(""), 3000);
      } else setPasskeyStatus("error");
    } catch (e) {
      if ((e as Error).name !== "NotAllowedError") setPasskeyStatus("error");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const removePasskey = async () => {
    setPasskeyLoading(true);
    try {
      const r = await fetch("/api/auth/passkey/delete", { method: "POST" });
      const d = await r.json();
      if (d.success) setHasPasskey(false);
    } catch {
      /* как раньше */
    } finally {
      setPasskeyLoading(false);
      setConfirmRemove(false);
    }
  };

  return (
    <section id="ak-set" className="ak-card ak-set" data-sheet="20" style={{ "--i": i } as CSSProperties} aria-labelledby="ak-set-h">
      <div className="ak-card-head" style={{ marginBottom: "0.25rem" }}>
        <h2 id="ak-set-h" className="ak-eyebrow">Уведомления и вход</h2>
      </div>

      <div className="ak-set-row">
        <span className="ak-set-ico"><Icon name="bell" size={16} /></span>
        <div className="ak-set-copy">
          <p className="ak-row-title" id="ak-push-l">Push-уведомления</p>
          <p className="ak-row-text">
            {!pushSupported ? "Этот браузер их не поддерживает" : pushEnabled ? "Включены — напомним о продлении" : "Выключены"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={pushEnabled}
          aria-labelledby="ak-push-l"
          className="ak-switch"
          onClick={togglePush}
          disabled={!pushSupported || pushLoading}
        />
      </div>

      <div className="ak-set-row">
        <span className="ak-set-ico"><Icon name="send" size={16} /></span>
        <div className="ak-set-copy">
          <p className="ak-row-title" id="ak-news-l">Новости и предложения</p>
          <p className="ak-row-text">
            {newsOn === null
              ? "Загружаем…"
              : newsOn
                ? "Присылаем акции и новости на почту"
                : "Выключено — приходят только письма о подписке"}
          </p>
          {newsError && <p className="ak-err">Не удалось сохранить. Попробуйте ещё раз.</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!newsOn}
          aria-labelledby="ak-news-l"
          className="ak-switch"
          onClick={toggleNews}
          disabled={newsOn === null || newsSaving}
        />
      </div>

      <div className="ak-set-row">
        <span className="ak-set-ico"><Icon name="lock" size={16} /></span>
        <div className="ak-set-copy">
          <p className="ak-row-title">Быстрый вход</p>
          <p className="ak-row-text">
            {passkeyStatus === "success" ? "Настроен" : hasPasskey ? "Face ID или Touch ID вместо кода" : "Вход без кода из письма"}
          </p>
          {passkeyStatus === "error" && <p className="ak-err">Не удалось. Попробуйте позже.</p>}
        </div>
        {passkeyLoading ? (
          <span className="ak-row-text" aria-live="polite">…</span>
        ) : hasPasskey ? (
          confirmRemove ? (
            <span style={{ display: "flex", gap: "0.4rem" }}>
              <button type="button" className="a-btn ak-btn-soft" onClick={() => setConfirmRemove(false)}>Нет</button>
              <button type="button" className="a-btn ak-btn-danger" onClick={removePasskey}>Отвязать</button>
            </span>
          ) : (
            <button type="button" className="a-btn ak-btn-soft" onClick={() => setConfirmRemove(true)}>Отвязать</button>
          )
        ) : (
          <button type="button" className="a-btn a-btn-primary" onClick={setupPasskey}>Настроить</button>
        )}
      </div>
    </section>
  );
}
