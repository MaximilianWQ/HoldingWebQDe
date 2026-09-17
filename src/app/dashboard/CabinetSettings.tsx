"use client";

import { useEffect, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import Link from "next/link";
import Icon from "@/components/pixel/Icon";
import { isIosBrowser } from "@/components/IosInstallSheet";

/**
 * Профиль · уведомления и вход. Push — логика PushToggleButton, быстрый
 * вход (passkey) — логика SettingsCard, обе один в один. Строки — общий
 * `.v-row` (иконка, заголовок и подпись, переключатель/кнопка справа).
 */
const urlB64 = (b: string) => {
  const p = "=".repeat((4 - (b.length % 4)) % 4);
  const raw = atob((b + p).replace(/-/g, "+").replace(/_/g, "/"));
  const a = new Uint8Array(raw.length);
  for (let k = 0; k < raw.length; k++) a[k] = raw.charCodeAt(k);
  return a;
};

export default function CabinetSettings() {
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState<"" | "success" | "error">("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [newsOn, setNewsOn] = useState<boolean | null>(null);
  const [newsSaving, setNewsSaving] = useState(false);
  const [newsError, setNewsError] = useState(false);

  const [iosInstall, setIosInstall] = useState(false);
  useEffect(() => setIosInstall(isIosBrowser()), []);

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
    <section aria-labelledby="vc-set-h">
      <div className="vc-kblock-head">
        <h3 id="vc-set-h">Уведомления и вход</h3>
      </div>

      <div className="v-rows v-stagger">
        <div className="v-row">
          <span className="v-row-icon" aria-hidden><Icon name="bell" size={20} /></span>
          <span className="v-row-main">
            <b id="vc-push-l">Push-уведомления</b>
            <span className="v-small">
              {!pushSupported ? "Этот браузер их не поддерживает" : pushEnabled ? "Включены — напомним о продлении" : "Выключены"}
            </span>
          </span>
          <span className="v-row-side">
            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              aria-labelledby="vc-push-l"
              className="vc-switch"
              onClick={togglePush}
              disabled={!pushSupported || pushLoading}
            />
          </span>
        </div>

        <div className="v-row">
          <span className="v-row-icon" aria-hidden><Icon name="send" size={20} /></span>
          <span className="v-row-main">
            <b id="vc-news-l">Новости и предложения</b>
            <span className="v-small">
              {newsOn === null ? "Загружаем…" : newsOn ? "Присылаем акции и новости на почту" : "Выключено — приходят только письма о подписке"}
            </span>
            {newsError && <span className="v-error">Не удалось сохранить. Попробуйте ещё раз.</span>}
          </span>
          <span className="v-row-side">
            <button
              type="button"
              role="switch"
              aria-checked={!!newsOn}
              aria-labelledby="vc-news-l"
              className="vc-switch"
              onClick={toggleNews}
              disabled={newsOn === null || newsSaving}
            />
          </span>
        </div>

        {iosInstall && (
          <div className="v-row">
            <span className="v-row-icon" aria-hidden><Icon name="iphone" size={20} /></span>
            <span className="v-row-main">
              <b>Atlas на экран «Домой»</b>
              <span className="v-small">Кабинет как приложение и уведомления о продлении</span>
            </span>
            <span className="v-row-side">
              <Link href="/install-ios" className="v-btn v-btn-primary v-btn-sm">Установить</Link>
            </span>
          </div>
        )}

        <div className="v-row">
          <span className="v-row-icon" aria-hidden><Icon name="lock" size={20} /></span>
          <span className="v-row-main">
            <b>Быстрый вход</b>
            <span className="v-small">
              {passkeyStatus === "success" ? "Настроен" : hasPasskey ? "Face ID или Touch ID вместо кода" : "Вход без кода из письма"}
            </span>
            {passkeyStatus === "error" && <span className="v-error">Не удалось. Попробуйте позже.</span>}
          </span>
          <span className="v-row-side">
            {passkeyLoading ? (
              <span className="v-small" aria-live="polite">…</span>
            ) : hasPasskey ? (
              confirmRemove ? (
                <span style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="v-btn v-btn-soft v-btn-sm" onClick={() => setConfirmRemove(false)}>Нет</button>
                  <button type="button" className="v-btn vc-btn-danger v-btn-sm" onClick={removePasskey}>Отвязать</button>
                </span>
              ) : (
                <button type="button" className="v-btn v-btn-soft v-btn-sm" onClick={() => setConfirmRemove(true)}>Отвязать</button>
              )
            ) : (
              <button type="button" className="v-btn v-btn-primary v-btn-sm" onClick={setupPasskey}>Настроить</button>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
