"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/pixel/Icon";
import { PLAN_CONTENT, type PlanId } from "@/lib/plans";
import { trafficPackById } from "@/lib/traffic-packs";
import type { Dict } from "@/i18n";
import { fill } from "@/lib/text/fill";
import type { Locale } from "@/lib/locale";

type T = Dict["cabinet"]["payments"];

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

function title(p: PaymentRow, t: T): string {
  if (p.product === "traffic") {
    const gb = trafficPackById(p.trafficPackId ?? "")?.gb ?? (p.trafficBytes ? Math.round(p.trafficBytes / 1024 ** 3) : null);
    return gb ? fill(t.trafficGb, { gb }) : t.traffic;
  }
  const planName = isPlanId(p.plan) ? PLAN_CONTENT[p.plan].name : t.subscription;
  return fill(t.subscriptionPlan, { plan: planName, months: p.period });
}

function statusBadge(status: string, t: T) {
  switch (status) {
    case "confirmed":
      return <span className="v-badge v-badge-green">{t.confirmed}</span>;
    case "pending":
      return <span className="v-badge v-badge-amber">{t.pending}</span>;
    case "refunded":
      return <span className="v-badge">{t.refunded}</span>;
    case "canceled":
      return <span className="v-badge">{t.canceled}</span>;
    case "expired":
      return <span className="v-badge">{t.expired}</span>;
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
export default function CabinetPayments({ locale, t }: { locale: Locale; t: T }) {
  const intl = locale === "ru" ? "ru-RU" : "en-GB";
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
        {t.title}
      </h2>

      {state === "loading" ? (
        <div className="vc-loading" aria-hidden>
          <div className="vc-skel" />
          <div className="vc-skel" />
          <div className="vc-skel" />
        </div>
      ) : state === "error" ? (
        <p className="v-empty">{t.loadFail}</p>
      ) : rows.length === 0 ? (
        <p className="v-empty">{t.empty}</p>
      ) : (
        <div className="v-rows v-stagger">
          {rows.map((p) => {
            const date = new Date(p.paidAt ?? p.createdAt).toLocaleDateString(intl, { day: "numeric", month: "short", year: "numeric" });
            return (
              <div className="v-row v-lift" key={p.id}>
                <span className={`v-row-icon ${p.product === "traffic" ? "v-row-icon-green" : ""}`} aria-hidden>
                  <Icon name={p.product === "traffic" ? "coins" : "bag"} size={22} />
                </span>
                <span className="v-row-main">
                  <b>{title(p, t)}</b>
                  <span className="v-small">{date}</span>
                </span>
                <span className="v-row-side">
                  <span className="v-row-amount">{p.amount.toLocaleString(intl)} {p.currency === "RUB" ? "₽" : p.currency}</span>
                  {statusBadge(p.status, t)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
