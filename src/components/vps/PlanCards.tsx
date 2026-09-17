"use client";

import Link from "next/link";
import { useState } from "react";
import Carousel from "./Carousel";
import {
  PLANS, PERIODS, PERIOD_DAYS, PERIOD_LABEL, PLAN_CONTENT, PLAN_SPEED, DEVICE_LIMIT,
  discountPercent, formatRub, pricePerMonth, type PlanId, type Period,
} from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";

const TAG: Record<Period, string> = { 1: "Начальный", 3: "", 6: "", 12: "Выгодно" };

/**
 * Тарифы чёрными карточками: переключатель Basic / Plus и карусель сроков.
 * Цены, скидки, скорость и лимит устройств — только из src/lib.
 * `href(plan, period)` — куда ведёт «Подключиться».
 */
export default function PlanCards({
  cta = "Подключиться",
  href = (plan, period) => `/subscribe?plan=${plan}&period=${period}`,
  initialPlan = "basic",
}: {
  cta?: string;
  href?: (plan: PlanId, period: Period) => string;
  initialPlan?: PlanId;
}) {
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  return (
    <>
      <div className="v-seg" role="tablist" aria-label="Тариф" style={{ maxWidth: 420, margin: "32px auto 0" }}>
        {(["basic", "plus"] as PlanId[]).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={plan === id} onClick={() => setPlan(id)}>
            {PLAN_CONTENT[id].name} · {PLAN_SPEED[id]} Гбит/с
          </button>
        ))}
      </div>
      <Carousel label={`Сроки тарифа ${PLAN_CONTENT[plan].name}`} key={plan}>
        {PERIODS.map((p) => {
          const off = discountPercent(plan, p);
          const tag = off > 0 ? `${TAG[p] ? `${TAG[p]} · ` : ""}−${off}%` : TAG[p];
          return (
            <article key={p} className="v-dcard" aria-label={`${PLAN_CONTENT[plan].name}, ${PERIOD_LABEL[p].full}`}>
              <span className={`v-badge v-badge-lg v-dcard-tag ${p === 12 ? "v-badge-solid-blue" : "v-badge-dark"}`}>{tag}</span>
              <h3 className="v-dcard-title">{PERIOD_LABEL[p].full}</h3>
              <p className="v-dcard-desc">{PLAN_CONTENT[plan].name}: доступ к Atlas Secure VPS на {PERIOD_DAYS[p]} дней.</p>
              <ul className="v-checks">
                <li>До {DEVICE_LIMIT} устройств на подписке</li>
                <li>Все {COUNTRY_COUNT} стран — выбор локации</li>
                <li>Скорость канала {PLAN_SPEED[plan]} Гбит/с</li>
                <li>Без автосписаний</li>
              </ul>
              <p className="v-price-row">
                Стоимость подключения:
                <b>{formatRub(PLANS[plan][p])} ₽</b>
                {p > 1 ? <span>{formatRub(pricePerMonth(plan, p))} ₽ в месяц</span> : null}
              </p>
              <Link href={href(plan, p)} prefetch={false} className="v-btn v-btn-primary v-btn-block">{cta}</Link>
            </article>
          );
        })}
      </Carousel>
    </>
  );
}
