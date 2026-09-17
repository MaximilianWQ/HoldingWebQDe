"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/pixel/Icon";
import Carousel from "@/components/vps/Carousel";
import {
  PERIODS,
  PERIOD_LABEL,
  PLANS as PLAN_PRICES,
  PLAN_CONTENT,
  PLAN_SPEED,
  discountPercent,
  formatRub,
  isPeriod,
  isPlanId,
  pricePerMonth,
  savings,
  type Period,
  type PlanId,
} from "@/lib/plans";
import {
  TRAFFIC_PACKS,
  formatPricePerGb,
  formatTraffic,
  isTrafficPackId,
  trafficPackById,
  type TrafficPack,
} from "@/lib/traffic-packs";
import "./subscribe-vps.css";

/**
 * /subscribe — оплата на корпусе Atlas Secure VPS (VShell, лист кабинета).
 *
 * Логика прежней страницы перенесена один в один: машина состояний
 * (plans → periods → payment-methods; processing / success / failed /
 * expired), возврат из кассы по `?payment=<id>` с опросом
 * /api/payments/status (10 попыток раз в 3 с), создание платежа
 * POST /api/payments/create { plan, period } и переход на redirectUrl,
 * «Назад» по шагам и уход на /pricing и /dashboard. Без сессии — на
 * /auth?next=<этот адрес> (возврат к тому же выбору после входа).
 *
 * Второй продукт — «Пакет трафика»: переключатель «Подписка / Пакет
 * трафика» над воронкой, шаги «Пакет → Оплата»,
 * POST /api/payments/create { product: "traffic", packId } — сумму
 * берёт сервер из traffic-packs.ts.
 *
 * Предвыбор по ссылке (17.09.2026): `?plan=basic|plus&period=1|3|6|12` —
 * карточки тарифов на главной и /pricing ведут сюда с уже выбранным
 * тарифом и сроком, человек сразу видит шаг оплаты; один `?plan=` без
 * срока открывает шаг «Срок» с этим тарифом. `?product=traffic&pack=gbN`
 * — прежний адрес с витрины пакетов.
 *
 * Оформление — сегменты `.v-seg` для выбора тарифа и срока, карточки
 * пакетов — чёрные `.v-dcard`, сводка заказа — белая `.v-card` с одной
 * синей кнопкой оплаты.
 */

type Plan = PlanId;
type Product = "subscription" | "traffic";
type PackId = TrafficPack["id"];

const PACK_IDS: PackId[] = TRAFFIC_PACKS.map((p) => p.id);
/** Отмеченный по умолчанию пакет, если адрес не назвал другой. */
const DEFAULT_PACK: PackId = TRAFFIC_PACKS[Math.min(1, TRAFFIC_PACKS.length - 1)].id;
const gbLabel = (p: TrafficPack) => `${formatRub(p.gb)} ГБ`;

/** Что показал ответ /api/payments/status — для экранов после кассы. */
interface PaidInfo {
  product: Product;
  trafficBytes: number | null;
  /** Состояние начисления гигабайт: applied | pending | seeding | conflict | null. */
  trafficState: string | null;
}

interface PeriodOption {
  months: number;
  label: string;
  price: number;
  perMonth: number;
  discount?: string;
}

function periodOption(plan: Plan, p: Period): PeriodOption {
  const off = discountPercent(plan, p);
  return {
    months: p,
    label: PERIOD_LABEL[p].full,
    price: PLAN_PRICES[plan][p],
    perMonth: pricePerMonth(plan, p),
    discount: off > 0 ? `-${off}%` : undefined,
  };
}

const PRICES: Record<Plan, PeriodOption[]> = {
  basic: PERIODS.map((p) => periodOption("basic", p)),
  plus: PERIODS.map((p) => periodOption("plus", p)),
};

const PLAN_ORDER: Plan[] = ["basic", "plus"];

const STEPS: Record<Product, readonly string[]> = {
  subscription: ["Тариф", "Срок", "Оплата"],
  traffic: ["Пакет", "Оплата"],
};

type PageStep = "plans" | "periods" | "packs" | "payment-methods" | "processing" | "success" | "failed" | "expired";

function periodFor(plan: Plan, months: number): PeriodOption {
  return PRICES[plan].find((o) => o.months === months) ?? PRICES[plan][PRICES[plan].length - 1];
}

const cheapest = (plan: Plan) => Math.min(...PRICES[plan].map((p) => p.perMonth));

export default function SubscribeView() {
  return (
    <Suspense
      fallback={
        <section className="v-section v-center" aria-busy="true">
          <div className="v-wrap">
            <p className="b-sr" aria-live="polite">Загружаем оплату…</p>
            <div className="vs-skel" aria-hidden />
          </div>
        </section>
      }
    >
      <SubscribeContent />
    </Suspense>
  );
}

function SubscribeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProduct: Product = searchParams.get("product") === "traffic" ? "traffic" : "subscription";
  const queryPack = searchParams.get("pack");

  // Предвыбор тарифа и срока по ссылке (карточки на главной и /pricing).
  const queryPlanRaw = searchParams.get("plan");
  const queryPlan: Plan | null = initialProduct === "subscription" && isPlanId(queryPlanRaw) ? queryPlanRaw : null;
  const queryPeriodRaw = Number(searchParams.get("period"));
  const queryPeriod: Period | null = queryPlan && isPeriod(queryPeriodRaw) ? queryPeriodRaw : null;
  const initialSelectedPeriod = queryPlan && queryPeriod ? periodOption(queryPlan, queryPeriod) : null;
  const initialStep: PageStep =
    initialProduct === "traffic" ? "packs" : initialSelectedPeriod ? "payment-methods" : queryPlan ? "periods" : "plans";

  const [product, setProduct] = useState<Product>(initialProduct);
  const [step, setStep] = useState<PageStep>(initialStep);
  const [draftPack, setDraftPack] = useState<PackId>(isTrafficPackId(queryPack) ? queryPack : DEFAULT_PACK);
  const [selectedPack, setSelectedPack] = useState<PackId | null>(null);
  const [paid, setPaid] = useState<PaidInfo>({ product: initialProduct, trafficBytes: null, trafficState: null });
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(queryPlan);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption | null>(initialSelectedPeriod);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [, setPaymentId] = useState<string | null>(null);
  // Только подача: какой тариф и срок отмечены до нажатия. На запросы
  // не влияет — в кассу уходят selectedPlan и selectedPeriod.
  const [draftPlan, setDraftPlan] = useState<Plan>(queryPlan ?? "basic");
  const [draftMonths, setDraftMonths] = useState<number>(initialSelectedPeriod?.months ?? 12);

  // Без сессии оплатить нельзя — вход с возвратом ровно сюда (тот же адрес,
  // тариф и срок из ссылки сохранятся в query и после входа откроются снова).
  const toAuth = useCallback(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    router.replace(`/auth?next=${encodeURIComponent(here)}`);
  }, [router]);

  useEffect(() => {
    let alive = true;
    fetch("/api/user/subscription")
      .then((r) => {
        if (alive && r.status === 401) toAuth();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [toAuth]);

  // Возврат из кассы (YooKassa) по ?payment=
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment) {
      setPaymentId(payment);
      setStep("processing");
      checkPaymentStatus(payment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const checkPaymentStatus = useCallback(async (id: string) => {
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payments/status?id=${id}`);
        if (res.status === 401) {
          toAuth();
          return;
        }
        const data = await res.json();

        if (data.success) {
          const d = data.data;
          const info: PaidInfo = {
            product: d.product === "traffic" ? "traffic" : "subscription",
            trafficBytes: typeof d.traffic?.bytes === "number" ? d.traffic.bytes : null,
            trafficState: typeof d.traffic?.state === "string" ? d.traffic.state : null,
          };
          setPaid(info);
          if (d.status === "confirmed") {
            setStep("success");
            const settled = ["applied", "skipped", "conflict"].includes(info.trafficState ?? "");
            if (info.product === "traffic" && !settled && ++attempts < maxAttempts) setTimeout(poll, 3000);
            return;
          }
          if (data.data.status === "canceled") {
            setStep("failed");
            return;
          }
          if (data.data.status === "expired") {
            setStep("expired");
            return;
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          setStep("processing");
        }
      } catch {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        }
      }
    };

    poll();
  }, [toAuth]);

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep("periods");
    setError("");
  };

  const handleSelectPeriod = (opt: PeriodOption) => {
    setSelectedPeriod(opt);
    setStep("payment-methods");
    setError("");
  };

  const handleSelectPack = (id: PackId) => {
    setSelectedPack(id);
    setStep("payment-methods");
    setError("");
  };

  const handlePayYooKassa = async () => {
    // Сумму не отправляем: сервер берёт её из plans.ts / traffic-packs.ts.
    const body =
      product === "traffic"
        ? selectedPack
          ? { product: "traffic", packId: selectedPack }
          : null
        : selectedPlan && selectedPeriod
          ? { plan: selectedPlan, period: selectedPeriod.months }
          : null;
    if (!body) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        toAuth();
        return;
      }
      const data = await res.json();
      if (data.success && data.data.redirectUrl) {
        setPaymentId(data.data.paymentId);
        window.location.href = data.data.redirectUrl;
      } else {
        setError(data.error || "Не удалось создать платёж");
      }
    } catch {
      setError("Ошибка соединения. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "payment-methods") {
      setStep(product === "traffic" ? "packs" : "periods");
    } else if (step === "periods") {
      setStep("plans");
      setSelectedPlan(null);
    } else if (step === "plans") {
      router.push("/pricing");
    } else if (step === "packs") {
      router.push("/pricing#traffic");
    } else {
      router.push("/dashboard");
    }
  };

  const restart = () => {
    // После кассы продукт берём из платежа: адрес возврата его не несёт.
    setProduct(paid.product);
    setStep(paid.product === "traffic" ? "packs" : "plans");
    setSelectedPlan(null);
    setSelectedPack(null);
    setError("");
  };

  /** Переключатель «Подписка / Пакет трафика»: воронка — с первого шага, адрес — в тон. */
  const switchProduct = (next: Product) => {
    if (next === product) return;
    setProduct(next);
    setSelectedPlan(null);
    setSelectedPack(null);
    setError("");
    setStep(next === "traffic" ? "packs" : "plans");
    const url = new URL(window.location.href);
    if (next === "traffic") {
      url.searchParams.set("product", "traffic");
      url.searchParams.set("pack", draftPack);
      url.searchParams.delete("plan");
      url.searchParams.delete("period");
    } else {
      url.searchParams.delete("product");
      url.searchParams.delete("pack");
    }
    window.history.replaceState(null, "", url.toString());
  };

  // ── Подача ─────────────────────────────────────────────────────────
  const commitPlan = (plan: Plan) => {
    setDraftPlan(plan);
    handleSelectPlan(plan);
  };
  const commitPeriod = (opt: PeriodOption) => {
    setDraftMonths(opt.months);
    handleSelectPeriod(opt);
  };
  const commitPack = (id: PackId) => {
    setDraftPack(id);
    handleSelectPack(id);
  };

  // Пройденный шаг в индикаторе — те же переходы, что у «Назад».
  const goToStep = (n: number) => {
    if (product === "traffic") {
      if (n === 1) {
        setStep("packs");
        setError("");
      }
      return;
    }
    if (n === 1) {
      setStep("plans");
      setSelectedPlan(null);
      setError("");
    } else if (n === 2) {
      setStep("periods");
    }
  };

  const inFunnel = step === "plans" || step === "periods" || step === "packs" || step === "payment-methods";
  const steps = STEPS[product];
  const isTraffic = product === "traffic";
  const stepNum = isTraffic ? (step === "packs" ? 1 : 2) : step === "plans" ? 1 : step === "periods" ? 2 : 3;
  // Пакет: выбранный, а до выбора — отмеченный.
  const pack = trafficPackById(selectedPack ?? draftPack) ?? TRAFFIC_PACKS[0];

  // Сводка: тариф и срок — выбранные, а до выбора — отмеченные.
  const plan: Plan = selectedPlan ?? draftPlan;
  const months = step === "payment-methods" && selectedPeriod ? selectedPeriod.months : draftMonths;
  const order = periodFor(plan, months);
  const save = savings(plan, order.months as Period);

  const total = isTraffic ? pack.priceRub : order.price;
  const backLabel = step === "plans" ? "К тарифам" : step === "packs" ? "К пакетам на витрине" : inFunnel ? "Назад" : "В кабинет";
  const title =
    step === "plans"
      ? "Выберите тариф"
      : step === "periods"
        ? "Выберите срок"
        : step === "packs"
          ? "Выберите пакет трафика"
          : step === "payment-methods"
            ? "Проверьте и оплатите"
            : paid.product === "traffic"
              ? "Оплата пакета трафика"
              : "Оплата подписки";

  // Главное действие сводки и нижней панели.
  const primary =
    step === "plans"
      ? { label: "Дальше — срок", run: () => commitPlan(draftPlan), busy: false }
      : step === "periods"
        ? { label: "Дальше — оплата", run: () => commitPeriod(order), busy: loading }
        : step === "packs"
          ? { label: "Дальше — оплата", run: () => commitPack(draftPack), busy: false }
          : { label: loading ? "Создаём платёж…" : `Оплатить ${formatRub(total)} ₽`, run: handlePayYooKassa, busy: loading };

  // Смена шага: заголовок получает фокус (чтец экрана слышит новый шаг),
  // а если верх страницы ушёл из кадра — страница возвращается к нему.
  const headRef = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const h = headRef.current;
    if (!h) return;
    if (h.getBoundingClientRect().top < 0) {
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      h.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
    }
    h.focus({ preventScroll: true });
  }, [step]);

  if (!inFunnel) {
    return (
      <section className="v-section v-center">
        <div className="v-wrap v-narrow">
          <Result step={step} paid={paid} onRestart={restart} />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="v-section vs-top">
        <div className="v-wrap v-narrow">
          <button type="button" className="vs-back" onClick={handleBack}>
            <Icon name="chevron-left" size={18} />
            {backLabel}
          </button>
          <h1 ref={headRef} tabIndex={-1} className="v-h2 vs-title">{title}</h1>

          <div className="v-seg vs-pick vs-product" role="tablist" aria-label="Что оплачиваем">
            <button type="button" role="tab" aria-selected={!isTraffic} onClick={() => switchProduct("subscription")}>
              <Icon name="clock" size={16} /> Подписка
            </button>
            <button type="button" role="tab" aria-selected={isTraffic} onClick={() => switchProduct("traffic")}>
              <Icon name="bolt" size={16} /> Пакет трафика
            </button>
          </div>

          <p className="vs-safe"><Icon name="lock" size={16} /> Безопасная оплата через защищённый платёжный шлюз</p>

          <nav className="v-seg vs-pick vs-steps" aria-label="Шаги оплаты">
            {steps.map((label, k) => {
              const n = k + 1;
              const state = n < stepNum ? "done" : n === stepNum ? "now" : "next";
              return (
                <button
                  key={label}
                  type="button"
                  aria-selected={state === "now"}
                  disabled={state === "next"}
                  onClick={() => state === "done" && goToStep(n)}
                >
                  {state === "done" ? <Icon name="check" size={14} /> : <span className="vs-step-n">{n}</span>}
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      <section className="v-section vs-body">
        <div className="v-wrap">
          <div className="vs-grid">
            <div className="vs-flow">
              {/* ── Шаг 1 · Тариф ───────────────────────────────────── */}
              {step === "plans" && (
                <div className="v-card v-card-pad vs-panel" aria-labelledby="vs-plans-h">
                  <h2 id="vs-plans-h" className="vs-eyebrow">Шаг 1 · Тариф</h2>
                  <p className="v-text">Два тарифа на одной инфраструктуре — отличаются только скоростью канала.</p>
                  <div className="v-seg vs-pick" role="tablist" aria-label="Тариф">
                    {PLAN_ORDER.map((id) => (
                      <button key={id} type="button" role="tab" aria-selected={draftPlan === id} onClick={() => setDraftPlan(id)}>
                        {PLAN_CONTENT[id].name} · {PLAN_SPEED[id]} Гбит/с
                      </button>
                    ))}
                  </div>
                  <div className="vs-detail">
                    <h3 className="vs-detail-name">{PLAN_CONTENT[draftPlan].name}</h3>
                    <p className="v-text">{PLAN_CONTENT[draftPlan].tagline}.</p>
                    <ul className="v-checks v-checks-light">
                      {PLAN_CONTENT[draftPlan].features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p className="vs-detail-price">от <b>{formatRub(cheapest(draftPlan))}</b> ₽/мес</p>
                  </div>
                  <button type="button" className="v-btn v-btn-primary v-btn-block" onClick={() => commitPlan(draftPlan)}>
                    Дальше — срок <Icon name="arrow-right" size={16} />
                  </button>
                </div>
              )}

              {/* ── Шаг 2 · Срок ────────────────────────────────────── */}
              {step === "periods" && selectedPlan && (
                <div className="v-card v-card-pad vs-panel" aria-labelledby="vs-periods-h">
                  <h2 id="vs-periods-h" className="vs-eyebrow">
                    Шаг 2 · Срок <span className="v-badge v-badge-blue">{PLAN_CONTENT[selectedPlan].name}</span>
                  </h2>
                  <p className="v-text">Чем дольше срок — тем ниже цена за месяц. Оплата разовая, без автосписаний.</p>
                  <div className="v-seg vs-pick vs-pick-4" role="tablist" aria-label="Срок">
                    {PRICES[selectedPlan].map((o) => (
                      <button key={o.months} type="button" role="tab" aria-selected={draftMonths === o.months} onClick={() => setDraftMonths(o.months)}>
                        {PERIOD_LABEL[o.months as Period].short}
                        {o.discount ? <b className="vs-off">{o.discount.replace("-", "−")}</b> : null}
                      </button>
                    ))}
                  </div>
                  <div className="vs-detail">
                    <p className="vs-detail-price"><b>{formatRub(order.perMonth)}</b> ₽ в месяц</p>
                    <p className="v-text">
                      {formatRub(order.price)} ₽ за {PERIOD_LABEL[order.months as Period].accusative}
                      {save > 0 ? <> · экономия <b>{formatRub(save)} ₽</b></> : null}
                    </p>
                  </div>
                  {error && <ErrorNote>{error}</ErrorNote>}
                  <button type="button" className="v-btn v-btn-primary v-btn-block" disabled={loading} onClick={() => commitPeriod(order)}>
                    {loading ? "Создаём платёж…" : "Дальше — оплата"} <Icon name="arrow-right" size={16} />
                  </button>
                  <p className="v-small">Оплата через защищённую платёжную систему · 15 минут на оплату</p>
                </div>
              )}

              {/* ── Пакет трафика · Шаг 1 · Пакет ───────────────────── */}
              {step === "packs" && (
                <div className="v-card v-card-pad vs-panel" aria-labelledby="vs-packs-h">
                  <h2 id="vs-packs-h" className="vs-eyebrow">Шаг 1 · Пакет</h2>
                  <p className="v-text">
                    Гигабайты для отдельного ключа «Обход» — без срока действия. Новый пакет прибавится к остатку.
                  </p>
                  <Carousel label="Пакеты трафика" initial={Math.max(0, PACK_IDS.indexOf(draftPack))}>
                    {TRAFFIC_PACKS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="v-dcard vs-pack"
                        aria-pressed={draftPack === p.id}
                        onClick={() => commitPack(p.id)}
                      >
                        <span className="v-badge v-badge-lg v-dcard-tag v-badge-dark">{formatPricePerGb(p)} ₽/ГБ</span>
                        <span className="v-dcard-title">{formatRub(p.gb)} ГБ</span>
                        <span className="v-dcard-desc">Без срока действия — пакеты складываются</span>
                        <span className="v-price-row"><b>{formatRub(p.priceRub)} ₽</b></span>
                      </button>
                    ))}
                  </Carousel>
                </div>
              )}

              {/* ── Шаг 3 · Оплата (у пакета — шаг 2) ─────────────── */}
              {step === "payment-methods" && (isTraffic ? !!selectedPack : !!(selectedPlan && selectedPeriod)) && (
                <div className="v-card v-card-pad vs-panel" aria-labelledby="vs-pay-h">
                  <h2 id="vs-pay-h" className="vs-eyebrow">
                    Шаг {isTraffic ? 2 : 3} · Способ оплаты
                    {isTraffic && <span className="v-badge v-badge-blue">{gbLabel(pack)}</span>}
                  </h2>
                  <div className="vs-method">
                    <span className="vs-method-ico" aria-hidden><Icon name="shield" size={22} /></span>
                    <span className="vs-method-copy">
                      <b>Карта или СБП</b>
                      <span>Visa, Mastercard, МИР, СБП</span>
                    </span>
                  </div>
                  <ol className="vs-next">
                    <li>Откроется страница платёжной системы — на оплату 15 минут.</li>
                    <li>После оплаты вы вернётесь сюда, и мы проверим платёж.</li>
                    <li>
                      {isTraffic
                        ? "Гигабайты прибавятся к остатку ключа «Обход» — он виден в кабинете."
                        : "Подписка продлится — срок будет виден в кабинете."}
                    </li>
                  </ol>
                  {error && <ErrorNote>{error}</ErrorNote>}
                </div>
              )}
            </div>

            {/* ── Сводка заказа ─────────────────────────────────────── */}
            <aside className="v-card v-card-pad vs-summary" aria-labelledby="vs-sum-h">
              <h2 id="vs-sum-h" className="vs-eyebrow">Ваш заказ</h2>

              {isTraffic ? (
                <dl className="vs-sum-list">
                  <div className="vs-sum-row"><dt>Пакет трафика</dt><dd>{formatRub(pack.gb)} ГБ</dd></div>
                  <div className="vs-sum-row"><dt>Срок</dt><dd>без срока действия</dd></div>
                  <div className="vs-sum-row"><dt>За гигабайт</dt><dd>{formatPricePerGb(pack)} ₽</dd></div>
                </dl>
              ) : (
                <dl className="vs-sum-list">
                  <div className="vs-sum-row"><dt>Тариф</dt><dd>{PLAN_CONTENT[plan].name} · {PLAN_SPEED[plan]} Гбит/с</dd></div>
                  <div className="vs-sum-row"><dt>Срок</dt><dd>{order.label}</dd></div>
                  <div className="vs-sum-row"><dt>В месяц</dt><dd>{formatRub(order.perMonth)} ₽</dd></div>
                  {save > 0 && <div className="vs-sum-row"><dt>Экономия</dt><dd>{formatRub(save)} ₽</dd></div>}
                </dl>
              )}

              <p className="vs-total"><b>{formatRub(total)}</b> ₽ <span>к оплате</span></p>
              <p className="v-small">
                {isTraffic
                  ? "Без срока действия — прибавится к остатку ключа «Обход». Оплата разовая, без автосписаний."
                  : step === "plans"
                    ? "Срок можно поменять на следующем шаге. Оплата сразу за весь срок."
                    : "Оплата сразу за весь срок, цена за месяц — для сравнения."}
              </p>

              <button type="button" className="v-btn v-btn-primary v-btn-block vs-summary-cta" onClick={primary.run} disabled={primary.busy}>
                {primary.label}
              </button>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Нижняя панель телефона: итог и главное действие ─────────── */}
      <div className="vs-dock" role="region" aria-label="Итог и оплата">
        <p className="vs-dock-sum">
          <span>{isTraffic ? `${gbLabel(pack)} · без срока` : `${PLAN_CONTENT[plan].name} · ${PERIOD_LABEL[order.months as Period].short}`}</span>
          <b>{formatRub(total)} ₽</b>
        </p>
        <button type="button" className="v-btn v-btn-primary" onClick={primary.run} disabled={primary.busy}>
          {primary.label}
        </button>
      </div>
    </>
  );
}

// ─── Состояния после кассы ───────────────────────────────────────────

/** Текст успеха пакета: зачислено или ещё зачисляется (по ответу /api/payments/status). */
function trafficSuccessText(paid: PaidInfo): string {
  const volume = paid.trafficBytes ? formatTraffic(paid.trafficBytes) : null;
  if (paid.trafficState === "applied") {
    return volume
      ? `${volume} зачислены — гигабайты прибавлены к остатку ключа «Обход».`
      : "Гигабайты зачислены — они прибавлены к остатку ключа «Обход».";
  }
  if (paid.trafficState === "conflict") {
    return "Пакет оплачен. Зачисление проверяет поддержка — остаток появится в кабинете, писать никуда не нужно.";
  }
  return volume
    ? `${volume} оплачены. Зачислим их в течение нескольких минут — остаток будет виден в кабинете.`
    : "Пакет оплачен. Зачислим гигабайты в течение нескольких минут — остаток будет виден в кабинете.";
}

function Result({ step, paid, onRestart }: { step: PageStep; paid: PaidInfo; onRestart: () => void }) {
  if (step === "processing") {
    return (
      <div className="v-card v-card-pad vs-result" aria-labelledby="vs-res-h" aria-busy="true">
        <span className="vs-result-ico vs-result-ico-wait" aria-hidden><span className="vs-spin" /></span>
        <span className="v-badge">Ждём ответ платёжной системы</span>
        <h2 id="vs-res-h" className="v-h3">Проверяем оплату</h2>
        <p className="v-text" role="status">Пожалуйста, подождите. Проверяем статус вашего платежа.</p>
        <p className="v-small">
          Если статус долго не меняется, откройте кабинет и нажмите «Проверить подписку» — оплата подхватится.
        </p>
        <div className="v-actions-col">
          <Link href="/dashboard" className="v-btn v-btn-soft v-btn-block">В кабинет</Link>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="v-card v-card-pad vs-result" aria-labelledby="vs-res-h">
        <span className="vs-result-ico vs-result-ico-ok" aria-hidden><Icon name="check" size={28} /></span>
        <span className="v-badge v-badge-green">Оплачено</span>
        <h2 id="vs-res-h" className="v-h3" role="status">Оплата принята</h2>
        <p className="v-text" aria-live="polite">
          {paid.product === "traffic" ? trafficSuccessText(paid) : "Подписка успешно продлена. Ключ активен и готов к использованию."}
        </p>
        <div className="v-actions-col">
          <Link href="/dashboard" className="v-btn v-btn-primary v-btn-block">Перейти в кабинет</Link>
        </div>
      </div>
    );
  }

  const failed = step === "failed";
  return (
    <div className="v-card v-card-pad vs-result" aria-labelledby="vs-res-h">
      <span className={`vs-result-ico vs-result-ico-${failed ? "bad" : "warn"}`} aria-hidden>
        <Icon name={failed ? "close" : "clock"} size={26} />
      </span>
      <span className={`v-badge ${failed ? "v-badge-red" : "v-badge-amber"}`}>{failed ? "Платёж отклонён" : "Платёж аннулирован"}</span>
      <h2 id="vs-res-h" className="v-h3" role="alert">{failed ? "Оплата не прошла" : "Время истекло"}</h2>
      <p className="v-text">
        {failed
          ? "Платёж отклонён или отменён. Попробуйте ещё раз или используйте другую карту."
          : "Платёж не был оплачен в течение 15 минут и аннулирован. Создайте новый."}
      </p>
      <div className="v-actions-col">
        <button type="button" onClick={onRestart} className="v-btn v-btn-primary v-btn-block">
          {failed ? "Попробовать снова" : "Создать новый платёж"}
        </button>
        <Link href="/dashboard" className="v-btn v-btn-soft v-btn-block">Вернуться в кабинет</Link>
      </div>
    </div>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="vs-error" role="alert">
      <Icon name="close" size={16} />
      <span>{children}</span>
    </p>
  );
}
