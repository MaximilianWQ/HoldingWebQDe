"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/pixel/Icon";
import { Spin } from "@/app/admin/AdminConfirm";

/**
 * Push админу на телефон (владелец, 19.09.2026: «сделай push-уведомления
 * в мини-приложении iOS админу для админ-панели, только админу»).
 *
 * Подписка привязана к аккаунту: сервер шлёт на неё только через
 * `sendPushToAdmin`, а тот ищет адресата по `ADMIN_EMAIL`. Отдельного
 * списка «кому ещё слать» нет — он разошёлся бы с правом входа.
 *
 * ПРО iPHONE. Safari разрешает Web Push только приложению, добавленному
 * на экран «Домой», и только после жеста человека. Поэтому кнопка
 * живёт в админке, а не подписывает молча при загрузке, и на iPhone вне
 * установленного приложения вместо кнопки стоит объяснение со ссылкой
 * на установку.
 *
 * Разрешение, однажды отклонённое, браузер второй раз не спросит —
 * кнопка это говорит прямо, иначе нажатие выглядит сломанным.
 */
function urlB64(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out.buffer;
}

type State = "checking" | "off" | "on" | "unsupported" | "needs-install" | "denied";

export default function AdminPushButton() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState(isIos && !standalone ? "needs-install" : "unsupported");
      return;
    }
    if (isIos && !standalone) {
      setState("needs-install");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (state === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setState("off");
        return;
      }

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const res = await fetch("/api/push/vapid-key");
      const data = await res.json();
      if (!data.success || !data.data.publicKey) {
        setNote("Ключи уведомлений не настроены на сервере.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64(data.data.publicKey),
      });
      const save = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!save.ok) {
        setNote("Подписку не удалось сохранить. Попробуйте ещё раз.");
        return;
      }
      setState("on");
    } catch {
      setNote("Не получилось включить уведомления на этом устройстве.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "checking") return null;

  if (state === "needs-install") {
    return (
      <p className="adm-push adm-push-note">
        <Icon name="bell" size={16} />
        Чтобы уведомления приходили на iPhone, откройте админку из приложения на экране «Домой» —{" "}
        <a href="/install-ios">как его добавить</a>.
      </p>
    );
  }
  if (state === "unsupported") {
    return (
      <p className="adm-push adm-push-note">
        <Icon name="bell" size={16} />
        Этот браузер не умеет push-уведомления.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className="adm-push adm-push-note">
        <Icon name="bell" size={16} />
        Уведомления запрещены в настройках браузера для этого сайта — второй раз он не спросит, снимите запрет вручную.
      </p>
    );
  }

  return (
    <div className="adm-push">
      <button type="button" className="adm-chip adm-push-btn" data-on={state === "on" ? "" : undefined} onClick={toggle} disabled={busy}>
        {busy ? <Spin /> : <Icon name="bell" size={16} />}
        {state === "on" ? "Уведомления включены" : "Уведомлять о новых обращениях"}
      </button>
      <span className="adm-push-hint">
        {state === "on"
          ? "Приходят на это устройство, как только кто-то заполнил форму."
          : "Придёт на это устройство, как только кто-то заполнит форму на сайте."}
      </span>
      {note && <span className="adm-push-err">{note}</span>}
    </div>
  );
}
