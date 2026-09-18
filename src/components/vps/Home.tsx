import Link from "next/link";
import { headers } from "next/headers";
import VShell from "./VShell";
import StoreBadges from "./StoreBadges";
import PlanCards from "./PlanCards";
import TrafficCards from "./TrafficCards";
import Steps from "./Steps";
import AppsRow from "./home/AppsRow";
import CountryMarquee from "./home/CountryMarquee";
import WhyBento from "./home/WhyBento";
import DiffSwitch from "./home/DiffSwitch";
import FaqAccordion from "./home/FaqAccordion";
import ProofBar from "./home/ProofBar";
import TunnelFlow from "./home/TunnelFlow";
import PlanCompare from "./home/PlanCompare";
import Referral from "./home/Referral";
import { BRAND, TRIAL } from "./links";
import { detectPlatform } from "@/lib/apps";
import { DEVICE_LIMIT, PLANS, PLAN_CONTENT, formatRub, pricePerMonth } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRAFFIC_ENTRY_RUB } from "@/lib/traffic-packs";
import "@/app/home-vps.css";

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
 *   04 До и после        — узнавание: «да, у меня так же»
 *   05 Как это работает  — снимает страх сложности
 *   06 Почему Atlas      — выгоды числами из src/lib
 *   07 Тарифы            — лестница решения с выделенным средним сроком
 *   08 Пакеты трафика    — второй продукт
 *   09 Три шага          — путь после оплаты виден заранее
 *   10 Кешбэк            — причина остаться и привести своих
 *   11 Вопросы           — шесть возражений перед кнопкой
 *   12 Финал             — последнее предложение без риска
 *
 * Все числа — из `src/lib`; на витрине нет слова «VPN» и инженерных
 * терминов (CLAUDE.md, «Два языка продукта»).
 */
export default async function Home({ referralCode }: { referralCode?: string }) {
  const enter = referralCode ? `/auth?ref=${encodeURIComponent(referralCode)}` : "/auth";
  const hdrs = await headers();
  const platform = detectPlatform(hdrs.get("user-agent") ?? "") ?? "ios";

  return (
    <VShell>
      {/* 01 · первый экран */}
      <section className="v-section v-center v-glow" aria-labelledby="v-hero">
        <div className="v-wrap">
          <div className="vh-hero-in">
            <p className="vh-hero-kicker">
              <span className="v-live" aria-hidden /> Серверы в {COUNTRY_COUNT} странах · пробный доступ {TRIAL}
            </p>
            <h1 id="v-hero" className="v-h1">
              Любимые сервисы <span className="v-accent">на максимум</span>
            </h1>
            <p className="v-lead">
              Видео без пауз, игры без рывков, сайты открываются сразу — на телефоне, компьютере и телевизоре.
            </p>
          </div>
          <div className="v-devices" aria-hidden>
            <div className="v-devices-laptop vh-devices-laptop">
              <img src="/media/laptop/poster.jpg" alt="" width={1400} height={900} fetchPriority="high" />
            </div>
            <div className="v-phone vh-devices-phone">
              <div className="v-phone-screen"><img src="/media/ios/dash.webp" alt="" width={880} height={1788} /></div>
              <img className="v-phone-shell" src="/media/ios/shell.webp" alt="" width={960} height={1992} />
            </div>
          </div>
          <div className="v-actions">
            <Link href={enter} prefetch={false} className="v-btn v-btn-primary">Попробовать {TRIAL} бесплатно</Link>
            <Link href="/pricing" className="v-btn v-btn-soft">Тарифы от {formatRub(PLANS.basic[1])} ₽</Link>
          </div>
          <p className="vh-hero-note">
            Карта не нужна. Вход по почте, ключ приходит сразу — подключение занимает минуту.
          </p>
          <StoreBadges />
          <AppsRow />
        </div>
      </section>

      {/* 02 · возражения, которые закрывают страницу */}
      <section className="v-section v-reveal" aria-label="Условия пробного доступа">
        <div className="v-wrap"><ProofBar /></div>
      </section>

      {/* 03 · бегущая строка стран */}
      <section className="v-section v-reveal" aria-label="Страны сети">
        <div className="v-wrap"><CountryMarquee /></div>
      </section>

      {/* 04 · до и после */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-diff">
        <div className="v-wrap v-narrow">
          <h2 id="v-diff" className="v-h2">
            Знакомо? <span className="v-accent">Так быть не должно</span>
          </h2>
          <p className="v-lead">Четыре ситуации, из-за которых обычно и приходят. Переключите — и увидите разницу.</p>
          <DiffSwitch />
        </div>
      </section>

      {/* 05 · как это работает */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-flow">
        <div className="v-wrap">
          <h2 id="v-flow" className="v-h2">
            Что происходит, когда вы нажимаете <span className="v-accent">«Подключить»</span>
          </h2>
          <p className="v-lead">
            Три узла и одна закрытая линия между ними. Настраивать в этой схеме нечего — всё делает приложение.
          </p>
          <TunnelFlow />
          <p className="v-car-note">
            Провайдер и публичный Wi-Fi видят зашифрованный поток, а сайт — адрес выбранной вами страны.
          </p>
        </div>
      </section>

      {/* 06 · почему Atlas Secure VPS */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-why">
        <div className="v-wrap">
          <h2 id="v-why" className="v-h2">
            Всё нужное <span className="v-accent">в одной подписке</span>
          </h2>
          <p className="v-lead vh-why-lead">
            Скорость, страны и устройства входят в любой тариф — доплачивать за «расширения» не придётся.
          </p>
          <WhyBento />
        </div>
      </section>

      {/* 07 · тарифы */}
      <section className="v-section v-center v-reveal" id="tariffs" aria-labelledby="v-plans">
        <div className="v-wrap">
          <h2 id="v-plans" className="v-h2">Чем длиннее срок, тем дешевле месяц</h2>
          <p className="v-lead">
            Мы советуем полгода: {formatRub(pricePerMonth("basic", 6))} ₽ в месяц вместо{" "}
            {formatRub(PLANS.basic[1])} ₽ — и это не год вперёд. Пробные {TRIAL} входят в оба тарифа.
          </p>
          <PlanCards />
          <PlanCompare />
          <div className="v-actions-col vh-plans-foot">
            <Link href={enter} prefetch={false} className="v-btn v-btn-primary v-btn-block">
              Сначала попробовать {TRIAL} бесплатно
            </Link>
            <Link href="/auth" prefetch={false} className="v-link vh-plans-login">Уже есть аккаунт — войти</Link>
          </div>
        </div>
      </section>

      {/* 08 · трафик */}
      <section className="v-section v-center v-reveal" id="traffic" aria-labelledby="v-traffic">
        <div className="v-wrap">
          <div className="v-stickers" aria-hidden>
            <span className="v-sticker v-sticker-a"><small>NEW</small>новинка</span>
            <span className="v-sticker v-sticker-b">ГБ</span>
          </div>
          <h2 id="v-traffic" className="v-h2">Пакеты трафика</h2>
          <p className="v-lead">
            Отдельный ключ на усиленные серверы — для сетей, где обычное подключение не проходит. От{" "}
            {formatRub(TRAFFIC_ENTRY_RUB)} ₽, гигабайты не сгорают и складываются.
          </p>
          <TrafficCards />
          <p className="v-car-note">Пакет работает рядом с подпиской и не заменяет её.</p>
        </div>
      </section>

      {/* 09 · как подключиться */}
      <section className="v-section v-reveal" aria-labelledby="v-how">
        <div className="v-wrap v-narrow">
          <h2 id="v-how" className="v-h2">
            Подключение <span className="v-accent">в три шага</span>
          </h2>
          <p className="v-lead" style={{ marginInline: 0 }}>
            Весь путь — на одном экране, чтобы решать не вслепую: вот что вас ждёт после кнопки.
          </p>
          <Steps keyHref={enter} platform={platform} />
        </div>
      </section>

      {/* 10 · кешбэк за приглашённых */}
      <section className="v-section v-reveal" aria-labelledby="v-ref">
        <div className="v-wrap">
          <div className="v-panel vh-ref-panel">
            <Referral enter={enter} />
          </div>
        </div>
      </section>

      {/* 11 · частые вопросы */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-faq">
        <div className="v-wrap v-narrow">
          <h2 id="v-faq" className="v-h2">Вопросы, которые задают перед покупкой</h2>
          <p className="v-lead">Если вашего здесь нет — напишите в поддержку, ответим до оплаты.</p>
          <FaqAccordion />
        </div>
      </section>

      {/* 12 · финал */}
      <section className="v-section v-reveal" aria-labelledby="v-final">
        <div className="v-wrap v-narrow">
          <div className="v-panel vh-cta">
            <h2 id="v-final" className="v-h2">{TRIAL} ничего не стоят</h2>
            <p>
              Проверьте {BRAND} на своих сервисах: без карты, без автосписаний, до {DEVICE_LIMIT} устройств сразу.
              Не подойдёт — просто не продлевайте.
            </p>
            <div className="v-actions">
              <Link href={enter} prefetch={false} className="v-btn v-btn-white">Начать бесплатно</Link>
              <Link href="/pricing" className="v-btn v-btn-ghost">
                Посмотреть тарифы · {PLAN_CONTENT.basic.name} и {PLAN_CONTENT.plus.name}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </VShell>
  );
}
