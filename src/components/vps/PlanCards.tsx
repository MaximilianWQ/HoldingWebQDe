"use client";

import Link from "next/link";
import { useState } from "react";
import Carousel from "./Carousel";
import Icon from "@/components/pixel/Icon";
import {
  PLANS, PERIODS, PERIOD_DAYS, PERIOD_LABEL, PLAN_CONTENT, PLAN_SPEED, DEVICE_LIMIT,
  discountPercent, formatRub, pricePerMonth, savings, type PlanId, type Period,
} from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";

/**
 * Карточки тарифов.
 *
 * ПОЧЕМУ ВЫДЕЛЕН СРЕДНИЙ СРОК (владелец, 18.09.2026: «выделить средний
 * тариф с позиции продаж — что это супервыгодно»).
 *
 * Четыре равновеликие карточки — это не выбор, а задача на сравнение:
 * человек считает в уме и уходит «подумать». Поэтому ряд построен как
 * лестница решения:
 *   · 1 месяц — якорь. Самый дорогой месяц (199 ₽), и он показан первым:
 *     всё, что правее, читается относительно него.
 *   · 3 месяца — промежуточный: скидка есть, но месяц дороже, чем у
 *     полугода. Он делает следующую карточку очевидной.
 *   · 6 месяцев — РЕКОМЕНДАЦИЯ. Тёмная плита, лента, кольцо, крупная
 *     цена за месяц, зачёркнутая сумма помесячной оплаты за тот же срок
 *     и экономия в рублях. Честная формулировка — «оптимально», а не
 *     «выбирают чаще всего»: распределение покупок мы проверить не
 *     можем, а выдуманная популярность — то же враньё, что выдуманная
 *     сертификация (COMPLIANCE-CHECK.md).
 *   · 12 месяцев — максимальная скидка, но год вперёд; стоит спокойной
 *     карточкой, чтобы не спорить с рекомендацией.
 *
 * Цена показана тремя способами: за месяц (её сравнивают), за период
 * (её платят) и за день (её примеряют к бытовым тратам). Все три —
 * из `src/lib/plans.ts`, ни одно число не написано руками.
 */

/** Рекомендуемый срок — тот самый «средний». */
export const POPULAR: Period = 6;

/**
 * Плашка над карточкой: подпись и цвет.
 *
 * Цвет здесь работает как указатель, а не украшение. Четыре одинаковые
 * плашки не помогают выбрать — поэтому внимание нарастает слева
 * направо: серая «Попробовать» (нейтрально) → светло-синий короткий
 * срок → ЖЁЛТАЯ рекомендация (самое яркое пятно на белом листе) →
 * синяя «максимум выгоды». Жёлтая одна на весь ряд: два ярких пятна
 * рядом гасят друг друга, и выбор снова становится задачей.
 */
const TAG: Record<Period, { text: string; tone: string }> = {
  1: { text: "Попробовать", tone: "v-badge-soft" },
  3: { text: "Короткий срок", tone: "v-badge-blue" },
  6: { text: "Оптимально", tone: "v-badge-yellow" },
  12: { text: "Максимум выгоды", tone: "v-badge-solid-blue" },
};

function perDay(plan: PlanId, period: Period): string {
  const v = PLANS[plan][period] / PERIOD_DAYS[period];
  return v.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function PlanCards({
  cta = "Подключить",
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
      <div className="v-seg v-seg-plans" role="tablist" aria-label="Тариф">
        {(["basic", "plus"] as PlanId[]).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={plan === id} onClick={() => setPlan(id)}>
            {PLAN_CONTENT[id].name} · {PLAN_SPEED[id]} Гбит/с
          </button>
        ))}
      </div>

      <Carousel label={`Сроки тарифа ${PLAN_CONTENT[plan].name}`} key={plan} initial={PERIODS.indexOf(POPULAR)} wide>
        {PERIODS.map((p) => {
          const off = discountPercent(plan, p);
          const pop = p === POPULAR;
          const monthly = PLANS[plan][1] * p;
          return (
            <article
              key={p}
              className={`v-dcard${pop ? " v-dcard-pop" : ""}`}
              aria-label={`${PLAN_CONTENT[plan].name}, ${PERIOD_LABEL[p].full}${pop ? ", рекомендуем" : ""}`}
            >
              <span className={`v-badge v-dcard-tag ${TAG[p].tone}`}>
                {pop ? <Icon name="bolt" size={14} /> : null}
                {TAG[p].text}{off > 0 ? ` · −${off}%` : ""}
              </span>

              <h3 className="v-dcard-title">{PERIOD_LABEL[p].full}</h3>

              <p className="v-dcard-price">
                <b>{formatRub(pricePerMonth(plan, p))} ₽</b>
                <span>в месяц</span>
              </p>

              <p className="v-dcard-sum">
                {formatRub(PLANS[plan][p])} ₽ за {PERIOD_LABEL[p].accusative} · ≈ {perDay(plan, p)} ₽ в день
              </p>

              {off > 0 ? (
                <p className="v-dcard-save">
                  <s>{formatRub(monthly)} ₽</s> помесячно за тот же срок — <b>экономия {formatRub(savings(plan, p))} ₽</b>
                </p>
              ) : (
                <p className="v-dcard-save v-dcard-save-flat">Разовый платёж за месяц — попробовать без обязательств</p>
              )}

              <ul className="v-checks">
                <li>До {DEVICE_LIMIT} устройств на одной подписке</li>
                <li>Все {COUNTRY_COUNT} стран — страна меняется в приложении</li>
                <li>Канал {PLAN_SPEED[plan]} Гбит/с</li>
                <li>Без автосписаний — продлеваете сами</li>
              </ul>

              <Link
                href={href(plan, p)}
                prefetch={false}
                className={`v-btn v-btn-block ${pop ? "v-btn-white" : "v-btn-primary"}`}
              >
                {cta} · {PERIOD_LABEL[p].short}
              </Link>
            </article>
          );
        })}
      </Carousel>
    </>
  );
}
