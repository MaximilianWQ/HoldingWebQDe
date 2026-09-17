"use client";

import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/pixel/Icon";
import { APPS, type Platform, type AppId } from "@/lib/apps";

const APP_TABS: { id: AppId; name: string }[] = [
  { id: "happ", name: "Happ" },
  { id: "incy", name: "Incy" },
];

/**
 * Три шага подключения — пунктирная рамка, синие галочки. `platform`
 * (по умолчанию iOS) выбирает набор ссылок из src/lib/apps.ts —
 * единственного источника адресов магазинов и установщиков; сегмент
 * `.v-seg` переключает между приложениями Happ и Incy без перезагрузки.
 * `keyHref` — гостю ведёт на `/auth`, вошедшему — на `/dashboard`.
 */
export default function Steps({ keyHref = "/dashboard", platform = "ios" }: { keyHref?: string; platform?: Platform }) {
  const [appId, setAppId] = useState<AppId>("happ");
  const apps = APPS[platform];
  const app = apps.find((a) => a.id === appId) ?? apps[0];
  return (
    <ol className="v-steps">
      <li className="v-step">
        <div className="v-step-head"><span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span><h3>Выберите приложение и установите</h3></div>
        <p>{app.note}</p>
        <div className="v-seg vh-app-seg" role="tablist" aria-label="Приложение подключения">
          {APP_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={appId === t.id} onClick={() => setAppId(t.id)}>{t.name}</button>
          ))}
        </div>
        <div className="vh-app-links">
          {app.links.map((l) => (
            <a key={l.label} className={`v-btn ${l.secondary ? "v-btn-outline" : "v-btn-dark"} v-btn-sm`} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
          ))}
        </div>
      </li>
      <li className="v-step">
        <div className="v-step-head"><span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span><h3>Добавьте подписку в {app.name}</h3></div>
        <p>Нажмите кнопку — откроется приложение, и подписка добавится автоматически.</p>
        <Link href={keyHref} prefetch={false} className="v-btn v-btn-outline v-btn-block">Получить подписку</Link>
      </li>
      <li className="v-step">
        <div className="v-step-head"><span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span><h3>Подключитесь и пользуйтесь</h3></div>
        <p>Выберите страну из списка и нажмите кнопку включения на главном экране приложения.</p>
        <Link href="/support" className="v-btn v-btn-primary v-btn-block"><Icon name="chat" size={20} /> Поддержка</Link>
      </li>
    </ol>
  );
}
