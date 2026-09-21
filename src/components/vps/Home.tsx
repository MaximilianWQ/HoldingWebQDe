import Link from "next/link";
import VShell from "./VShell";
import Icon from "@/components/pixel/Icon";
import StoreBadges from "./StoreBadges";
import PlanCards from "./PlanCards";
import TrafficCards from "./TrafficCards";
import CountryMarquee from "./home/CountryMarquee";
import WhyBento from "./home/WhyBento";
import FaqAccordion from "./home/FaqAccordion";
import ProofBar from "./home/ProofBar";
import PlanCompare from "./home/PlanCompare";
import Referral from "./home/Referral";
import { BRAND, SUPPORT_TG } from "./links";
import { DEVICE_LIMIT, PLANS, formatRub, planContent, pricePerMonth } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRAFFIC_ENTRY_RUB, TRAFFIC_PACKS } from "@/lib/traffic-packs";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { count } from "@/i18n/plural";
import { rich } from "@/i18n/rich";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
import { POPULAR } from "./PlanCards";
import "@/app/home-vps.css";
import "@/app/home-clay.css";

/**
 * Главная Atlas Secure VPS.
 *
 * Стилистика — Apple (владелец, 17.09.2026: «очень простой, очень
 * приятный сайт, минимум текста, продающе»). Порядок блоков — разбор
 * 18.09.2026 («подойти к тексту и кнопкам с позиции продаж, маркетинга
 * и психологии»), выстроен по одному правилу: сначала снять причину
 * уйти, потом объяснить, потом продать.
 *
 *   01 Первый экран     — обещание и одно действие
 *   02 Полоса возражений — «карта не нужна», «списаний нет», «это минута»
 *   03 Страны            — масштаб сети одной лентой
 *   04 Как это работает  — снимает страх сложности
 *   05 Почему Atlas      — выгоды числами из src/lib
 *   06 Тарифы            — лестница решения с выделенным средним сроком
 *   07 Пакеты трафика    — второй продукт
 *   09 Кешбэк            — причина остаться и привести своих
 *   10 Вопросы           — шесть возражений перед кнопкой
 *   11 Финал             — последнее предложение без риска
 *
 * СНЯТО 19.09.2026 по решению владельца: блок «Знакомо? Так быть не
 * должно» (переключатель «до и после») — «спорно»; схема «Что
 * происходит, когда вы нажимаете „Подключить"» — «зачем». Первый
 * обещал разницу, которую страница показать не может: она проверяется
 * на своих сервисах, для чего и есть пробные дни. Второй объяснял
 * устройство продукта — эта работа осталась за полосой возражений
 * («минута на подключение») и вопросами внизу («Это сложно
 * настроить?», «Что видно из моего трафика?»).
 *
 * Блока «подключение в три шага» здесь нет намеренно (владелец,
 * 18.09.2026: «зачем оно на главной, подключение простое — пустая
 * трата места»). Путь после оплаты описан в шаге «минута на
 * подключение» в полосе возражений и полностью — на /devices.
 *
 * Все числа — из `src/lib`; на витрине нет слова «VPN» и инженерных
 * терминов (CLAUDE.md, «Два языка продукта»).
 *
 * Текст — из словаря по языку запроса (`home.*`). Числа в него не
 * пишутся: страница подставляет их из `src/lib` через `fill()`, чтобы
 * у двух языков не разъехались цены и страны.
 */
export default async function Home({ referralCode }: { referralCode?: string }) {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.home;
  const to = (href: string) => localeHref(href, locale);
  const enter = to(referralCode ? `/auth?ref=${encodeURIComponent(referralCode)}` : "/auth");
  const plans = planContent(locale);

  // Числа, которые встречаются в нескольких строках сразу. Считаются
  // один раз и подставляются во все — иначе «19 стран» на одном экране
  // и «19 странах» на другом начинают жить порознь.
  const trial = count(locale, TRIAL_DAYS, d.units.day);
  const vars = {
    trial,
    brand: BRAND,
    countries: count(locale, COUNTRY_COUNT, d.units.country),
    countriesIn: count(locale, COUNTRY_COUNT, d.units.countryIn),
    devices: count(locale, DEVICE_LIMIT, d.units.device),
    month: formatRub(PLANS.basic[1], locale),
    best: formatRub(pricePerMonth("basic", POPULAR), locale),
    tg: SUPPORT_TG.handle,
    tgHref: SUPPORT_TG.href,
    a: plans.basic.name,
    b: plans.plus.name,
  };
  const faq = t.faq.items.map((f) => ({ q: f.q, a: rich(fill(f.a, vars), locale) }));

  // Полоса фактов под плитой первого экрана. Четыре капсулы — ровно
  // те числа, которые человек ищет до прокрутки: сколько стран,
  // сколько устройств, сколько стоит и сколько бесплатно. Все из
  // src/lib, ни одно не написано строкой.
  const facts = [
    vars.countries,
    vars.devices,
    fill(t.why.fromPrice, { price: vars.month }),
    `${trial} ${t.why.freeSuffix}`,
  ];

  return (
    <VShell>
      {/* 01 · первый экран — плита и предмет.

          ПЕРЕСОБРАН 21.09.2026 по разбору владельца: он прислал два
          разворота Яндекс Практикума — «рендеры и сайт в таком стиле
          надо». Приёмы и то, что у них НЕ взято, разобраны в шапке
          `home-clay.css`; сам предмет собран в
          `design/blender/clay_build.py`.

          Текст остался прежним — переписывать его разбор не просили.
          Ушли две вещи: кикер с бегущей точкой (его работу теперь
          делает полоса фактов под плитой, и числа в ней те же) и
          знаки сервисов по бокам заголовка — на плите они спорили с
          предметом за внимание. */}
      <section className="v-section vh-hero-sec" aria-labelledby="v-hero">
        <div className="v-wrap">
          <div className="hc-plate">
            <div className="hc-grid">
              <div className="hc-copy">
                <h1 id="v-hero" className="hc-h1">
                  {t.hero.title} <span className="v-accent">{t.hero.titleAccent}</span>
                </h1>
                <p className="hc-lead">{t.hero.lead}</p>
                {/* Кнопка стоит ДО предмета. Разбор 18.09.2026: кадр
                    высотой в пол-экрана уводил её под сгиб, а на
                    конверсию влияет не выравнивание, а то, видно ли
                    действие без прокрутки. */}
                <div className="hc-actions">
                  <Link href={enter} prefetch={false} className="v-btn v-btn-primary">
                    {fill(d.common.tryFree, vars)}
                  </Link>
                  <Link href={to("/pricing")} className="v-btn v-btn-soft">
                    {fill(d.common.pricingFrom, { price: vars.month })}
                  </Link>
                </div>
                <p className="hc-note">{t.hero.note}</p>
              </div>

              {/* Предмет: матовый знак Atlas и два спутника. Формы
                  стрелок — один в один из BrandMark, то есть из того
                  же источника, что иконка приложения. Ширины кадра
                  две: широкий экран и телефон. */}
              <figure className="hc-object">
                <img
                  src="/media/clay/hero-1400.webp"
                  srcSet="/media/clay/hero-900.webp 900w, /media/clay/hero-1400.webp 1400w"
                  sizes="(min-width: 900px) 44vw, 90vw"
                  width={1400}
                  height={1213}
                  alt=""
                  /* Кадр декоративный: всё, что он сообщает, сказано
                     заголовком и полосой фактов под плитой. Пустой alt
                     — чтобы экранный диктор не читал его дважды. */
                  fetchPriority="high"
                  decoding="async"
                />
              </figure>
            </div>
          </div>

          {/* Полоса фактов под плитой. Числа считаются из src/lib —
              ни одно не написано здесь руками. */}
          <ul className="hc-facts">
            {facts.map((f) => (
              <li key={f} className="hc-fact">{f}</li>
            ))}
          </ul>

          <StoreBadges availableIn={d.store.availableIn} />
        </div>
      </section>

      {/* 02 · возражения, которые закрывают страницу */}
      <section className="v-section v-reveal" aria-label={t.proofLabel}>
        <div className="v-wrap"><ProofBar locale={locale} /></div>
      </section>

      {/* 03 · бегущая строка стран */}
      <section className="v-section v-reveal" aria-label={t.countries.section}>
        <div className="v-wrap"><CountryMarquee locale={locale} /></div>
      </section>

      {/* 04 · почему Atlas Secure VPS */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-why">
        <div className="v-wrap">
          <h2 id="v-why" className="v-h2">
            {t.why.title} <span className="v-accent">{t.why.titleAccent}</span>
          </h2>
          <p className="v-lead vh-why-lead">{t.why.lead}</p>
          <WhyBento locale={locale} />
        </div>
      </section>

      {/* 05 · тарифы */}
      <section className="v-section v-center v-reveal" id="tariffs" aria-labelledby="v-plans">
        <div className="v-wrap">
          <h2 id="v-plans" className="v-h2">{t.plans.title}</h2>
          <p className="v-lead">{fill(t.plans.lead, vars)}</p>
          <PlanCards locale={locale} t={d.cards} units={d.units} />
          <PlanCompare locale={locale} />
          <div className="v-actions-col vh-plans-foot">
            <Link href={enter} prefetch={false} className="v-btn v-btn-primary v-btn-block">
              {fill(t.plans.tryFirst, vars)}
            </Link>
            <Link href={to("/auth")} prefetch={false} className="v-link vh-plans-login">
              {t.plans.haveAccount}
            </Link>
          </div>
        </div>
      </section>

      {/* 06 · трафик */}
      <section className="v-section v-center v-reveal" id="traffic" aria-labelledby="v-traffic">
        <div className="v-wrap">
          <div className="v-stickers" aria-hidden>
            <span className="v-sticker v-sticker-a"><small>NEW</small>{t.traffic.stickerNew}</span>
            <span className="v-sticker v-sticker-b">{t.traffic.stickerGb}</span>
          </div>
          <h2 id="v-traffic" className="v-h2">{t.traffic.title}</h2>
          <p className="v-lead">
            {fill(t.traffic.lead, { price: formatRub(TRAFFIC_ENTRY_RUB, locale) })}
          </p>
          {/* На главной — короткая подборка, а не все одиннадцать
              пакетов: длинная лента стоит ровно там, где человек
              решает, и листать её вместо решения он не будет. Места в
              лестнице выгоды считаются по полному списку, поэтому
              «лучшая цена за ГБ» не переезжает из-за подборки. */}
          <TrafficCards locale={locale} ids={["gb15", "gb100", "gb300", "gb600"]} />
          <div className="v-actions">
            <Link href={to("/pricing#traffic")} className="v-btn v-btn-soft">
              {fill(t.traffic.all, {
                count: TRAFFIC_PACKS.length,
                max: formatRub(TRAFFIC_PACKS[TRAFFIC_PACKS.length - 1].gb, locale),
              })}
            </Link>
          </div>
          <p className="v-car-note">{t.traffic.note}</p>
        </div>
      </section>

      {/* 07 · кешбэк за приглашённых */}
      <section className="v-section v-reveal" aria-labelledby="v-ref">
        <div className="v-wrap">
          <div className="v-panel vh-ref-panel">
            <Referral enter={enter} locale={locale} />
          </div>
        </div>
      </section>

      {/* 08 · частые вопросы */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-faq">
        <div className="v-wrap v-narrow">
          <h2 id="v-faq" className="v-h2">{t.faq.title}</h2>
          <p className="v-lead">{t.faq.lead}</p>
          <FaqAccordion items={faq} />
        </div>
      </section>

      {/* 09 · финал */}
      <section className="v-section v-reveal" aria-labelledby="v-final">
        <div className="v-wrap v-narrow">
          <div className="v-panel vh-cta">
            <h2 id="v-final" className="v-h2">{fill(t.final.title, vars)}</h2>
            <p>{fill(t.final.text, vars)}</p>
            <div className="v-actions">
              <Link href={enter} prefetch={false} className="v-btn v-btn-white">{t.final.start}</Link>
              <Link href={to("/pricing")} className="v-btn v-btn-ghost">
                {fill(t.final.seePlans, vars)}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </VShell>
  );
}
