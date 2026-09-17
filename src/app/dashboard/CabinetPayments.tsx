"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/pixel/Icon";
import { PLAN_CONTENT, type PlanId } from "@/lib/plans";
import { trafficPackById } from "@/lib/traffic-packs";

/** Одна запись истории платежей — GET /api/user/payments. */
interface PaymentRow {
  id: string;
  product: "subscription" | "traffic";
  plan: string;
  period: number;
  trafficPackId: string | null;
  trafficBytes: number | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

function isPlanId(v: string): v is PlanId {
  return v === "basic" || v === "plus";
}

function title(p: PaymentRow): string {
  if (p.product === "traffic") {
    const gb = trafficPackById(p.trafficPackId ?? "")?.gb ?? (p.trafficBytes ? Math.round(p.trafficBytes / 1024 ** 3) : null);
    return gb ? `Пакет трафика ${gb} ГБ` : "Пакет трафика";
  }
  const planName = isPlanId(p.plan) ? PLAN_CONTENT[p.plan].name : "Подписка";
  return `Подписка ${planName} · ${p.period} мес.`;
}

function statusBadge(status: string) {
  switch (status) {
    case "confirmed":
      return <span className="v-badge v-badge-green">Оплачен</span>;
    case "pending":
      return <span className="v-badge v-badge-amber">В обработке</span>;
    case "refunded":
      return <span className="v-badge">Возврат</span>;
    case "canceled":
      return <span className="v-badge">Отменён</span>;
    case "expired":
      return <span className="v-badge">Истёк</span>;
    default:
      return <span className="v-badge">{status}</span>;
  }
}

/**
 * Кабинет · «История платежей» — грузится, когда открыта вкладка (нет
 * смысла тянуть платежи вместе с подпиской, которая нужна почти всегда).
 * Строки — общий `.v-row` (как «Мои подписки»): иконка, название и дата,
 * сумма и бейдж статуса.
 */
export default function CabinetPayments() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [rows, setRows] = useState<PaymentRow[]>([]);

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch("/api/user/payments")
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.success) {
          setRows(j.data as PaymentRow[]);
          setState("ok");
        } else {
          setState("error");
        }
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="vc-panel" aria-labelledby="vc-pay-h">
      <h2 id="vc-pay-h" className="vc-cab-title">
        <Icon name="receipt" size={26} />
        История платежей
      </h2>

      {state === "loading" ? (
        <div className="vc-loading" aria-hidden>
          <div className="vc-skel" />
          <div className="vc-skel" />
          <div className="vc-skel" />
        </div>
      ) : state === "error" ? (
        <p className="v-empty">Не удалось загрузить историю. Обновите страницу.</p>
      ) : rows.length === 0 ? (
        <p className="v-empty">Платежей пока нет — здесь появится история после первой оплаты.</p>
      ) : (
        <div className="v-rows">
          {rows.map((p) => {
            const date = new Date(p.paidAt ?? p.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div className="v-row" key={p.id}>
                <span className={`v-row-icon ${p.product === "traffic" ? "v-row-icon-green" : ""}`} aria-hidden>
                  <Icon name={p.product === "traffic" ? "coins" : "bag"} size={22} />
                </span>
                <span className="v-row-main">
                  <b>{title(p)}</b>
                  <span className="v-small">{date}</span>
                </span>
                <span className="v-row-side">
                  <span className="v-row-amount">{p.amount.toLocaleString("ru-RU")} {p.currency === "RUB" ? "₽" : p.currency}</span>
                  {statusBadge(p.status)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
