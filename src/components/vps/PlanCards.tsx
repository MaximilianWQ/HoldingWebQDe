"use client";

import Link from "next/link";
import { useState } from "react";
import Carousel from "./Carousel";
import Icon from "@/components/pixel/Icon";
import {
  PLANS, PERIODS, PERIOD_DAYS, PLAN_SPEED, DEVICE_LIMIT, periodLabel, planContent,
  discountPercent, formatRub, formatDecimal, pricePerMonth, savings, type PlanId, type Period,
} from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import type { Dict } from "@/i18n";
import { fill } from "@/i18n";
import { count } from "@/i18n/plural";
import type { Locale } from "@/lib/locale";

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
 *
 * Компонент клиентский (переключатель тарифа и лента сроков), поэтому
 * словарь не импортирует — текст приходит пропсом `t` от серверного
 * родителя. Цена за день форматируется по языку: «6,6» в русском и
 * «6.6» в английском, иначе запятая читается как разряды.
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
const TONE: Record<Period, string> = {
  1: "v-badge-soft",
  3: "v-badge-blue",
  6: "v-badge-yellow v-dcard-tag-hero",
  12: "v-badge-solid-blue",
};

function perDay(plan: PlanId, period: Period, locale: Locale): string {
  return formatDecimal(PLANS[plan][period] / PERIOD_DAYS[period], locale, 1);
}

export default function PlanCards({
  locale,
  t,
  units,
  cta,
  href = (plan, period) => `/subscribe?plan=${plan}&period=${period}`,
  initialPlan = "basic",
}: {
  locale: Locale;
  t: Dict["cards"];
  units: Dict["units"];
  cta?: string;
  href?: (plan: PlanId, period: Period) => string;
  initialPlan?: PlanId;
}) {
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const label = periodLabel(locale);
  const content = planContent(locale);
  const tag: Record<Period, string> = { 1: t.tagTry, 3: t.tagShort, 6: t.tagBest, 12: t.tagMax };
  const button = cta ?? t.connect;
  return (
    <>
      <div className="v-seg v-seg-plans" role="tablist" aria-label={t.planTab}>
        {(["basic", "plus"] as PlanId[]).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={plan === id} onClick={() => setPlan(id)}>
            {content[id].name} · {PLAN_SPEED[id]} {t.speedUnit}
          </button>
        ))}
      </div>

      <Carousel label={fill(t.periods, { plan: content[plan].name })} key={plan} initial={PERIODS.indexOf(POPULAR)} wide>
        {PERIODS.map((p) => {
          const off = discountPercent(plan, p);
          const pop = p === POPULAR;
          const monthly = PLANS[plan][1] * p;
          return (
            <article
              key={p}
              className={`v-dcard${pop ? " v-dcard-pop" : ""}`}
              aria-label={`${content[plan].name}, ${label[p].full}${pop ? `, ${t.recommended}` : ""}`}
            >
              <span className={`v-badge v-dcard-tag ${TONE[p]}`}>
                {pop ? <Icon name="bolt" size={14} /> : null}
                {tag[p]}{off > 0 ? ` · −${off}%` : ""}
              </span>

              <h3 className="v-dcard-title">{label[p].full}</h3>

              <p className="v-dcard-price">
                <b>{formatRub(pricePerMonth(plan, p), locale)} ₽</b>
                <span>{t.perMonth}</span>
              </p>

              <p className="v-dcard-sum">
                {fill(t.forPeriod, {
                  sum: formatRub(PLANS[plan][p], locale),
                  period: label[p].accusative,
                  day: perDay(plan, p, locale),
                })}
              </p>

              {off > 0 ? (
                <p className="v-dcard-save">
                  <s>{formatRub(monthly, locale)} ₽</s> {t.saving}{" "}
                  <b>{fill(t.savingBold, { amount: formatRub(savings(plan, p), locale) })}</b>
                </p>
              ) : (
                <p className="v-dcard-save v-dcard-save-flat">{t.oneOff}</p>
              )}

              <ul className="v-checks">
                {t.planChecks.map((line) => (
                  <li key={line}>
                    {fill(line, {
                      devices: count(locale, DEVICE_LIMIT, units.device),
                      countries: count(locale, COUNTRY_COUNT, units.country),
                      speed: PLAN_SPEED[plan],
                    })}
                  </li>
                ))}
              </ul>

              <Link
                href={href(plan, p)}
                prefetch={false}
                className={`v-btn v-btn-block ${pop ? "v-btn-white" : "v-btn-primary"}`}
              >
                {button} · {label[p].short}
              </Link>
            </article>
          );
        })}
      </Carousel>
    </>
  );
}
