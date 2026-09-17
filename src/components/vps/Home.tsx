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
import { BRAND, TRIAL } from "./links";
import { detectPlatform } from "@/lib/apps";
import { DEVICE_LIMIT, PLANS, formatRub } from "@/lib/plans";
import "@/app/home-vps.css";

/**
 * Главная Atlas Secure VPS (владелец, 17.09.2026: «очень простой, очень
 * приятный сайт стилистики Apple — минимум текста, максимально просто,
 * продающе»; доработка того же дня: «более плавным, больше элементов»).
 * Одна мысль на экран; все числа — из src/lib.
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
            <h1 id="v-hero" className="v-h1">
              Любимые сервисы <span className="v-accent">на максимум</span>
            </h1>
            <p className="v-lead">
              Добро пожаловать в {BRAND} — быстрый и приватный интернет на всех ваших устройствах.
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
          <StoreBadges />
          <AppsRow />
        </div>
      </section>

      {/* 01b · бегущая строка стран */}
      <section className="v-section v-reveal" aria-label="Страны сети">
        <div className="v-wrap"><CountryMarquee /></div>
      </section>

      {/* 02 · почему Atlas Secure VPS */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-why">
        <div className="v-wrap">
          <span className="v-chip">Почему {BRAND}?</span>
          <h2 id="v-why" className="v-h2" style={{ marginTop: 24 }}>
            Всё нужное <span className="v-accent">в одной подписке</span>
          </h2>
          <p className="v-lead vh-why-lead">
            Быстрое соединение, серверы по всему миру и честные условия — без мелкого шрифта.
          </p>
          <WhyBento />
        </div>
      </section>

      {/* 03 · что меняется, когда включено */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-diff">
        <div className="v-wrap v-narrow">
          <h2 id="v-diff" className="v-h2">
            Что меняется, <span className="v-accent">когда включено</span>
          </h2>
          <p className="v-lead">Четыре знакомые ситуации — до и после.</p>
          <DiffSwitch />
        </div>
      </section>

      {/* 04 · управление */}
      <section className="v-section v-reveal" aria-labelledby="v-manage">
        <div className="v-wrap">
          <div className="v-panel">
            <h2 id="v-manage" className="v-h3"><span className="v-dot" aria-hidden />Управляйте подпиской как пожелаете</h2>
            <p>
              Ключ, устройства и продление — в личном кабинете. Страну меняете в приложении в одно касание, а трафик
              шифруется на всём пути от устройства до нашего сервера.
            </p>
            <p>Оплата разовая, без автосписаний: продлеваете, когда сами решите.</p>
          </div>
        </div>
      </section>

      {/* 05 · тарифы */}
      <section className="v-section v-center v-reveal" id="tariffs" aria-labelledby="v-plans">
        <div className="v-wrap">
          <h2 id="v-plans" className="v-h2">Выберите свой тариф {BRAND}</h2>
          <p className="v-lead">Гибкие планы на любой срок. {TRIAL} бесплатно — без карты.</p>
          <PlanCards />
          <div className="v-actions-col" style={{ maxWidth: 560, marginInline: "auto" }}>
            <Link href={enter} prefetch={false} className="v-btn v-btn-primary v-btn-block">Попробовать {TRIAL} бесплатно</Link>
            <Link href="/auth" prefetch={false} className="v-link" style={{ justifySelf: "center", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Зарегистрированы? Войти</Link>
          </div>
        </div>
      </section>

      {/* 06 · трафик */}
      <section className="v-section v-center v-reveal" id="traffic" aria-labelledby="v-traffic">
        <div className="v-wrap">
          <div className="v-stickers" aria-hidden>
            <span className="v-sticker v-sticker-a"><small>NEW</small>новинка</span>
            <span className="v-sticker v-sticker-b">ГБ</span>
          </div>
          <h2 id="v-traffic" className="v-h2">Пакеты трафика</h2>
          <p className="v-lead">Выберите подходящий объём — гигабайты не сгорают.</p>
          <TrafficCards />
          <p className="v-car-note">Пакет работает на отдельном ключе усиленных серверов и дополняет подписку.</p>
        </div>
      </section>

      {/* 07 · как подключиться */}
      <section className="v-section v-reveal" aria-labelledby="v-how">
        <div className="v-wrap v-narrow">
          <h2 id="v-how" className="v-h2">
            Подключение <span className="v-accent">в три шага</span>
          </h2>
          <p className="v-lead" style={{ marginInline: 0 }}>Подписка начинает работать за минуту — вот и всё, что нужно сделать.</p>
          <Steps keyHref={enter} platform={platform} />
        </div>
      </section>

      {/* 08 · частые вопросы */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-faq">
        <div className="v-wrap v-narrow">
          <h2 id="v-faq" className="v-h2">Частые вопросы</h2>
          <FaqAccordion />
        </div>
      </section>

      {/* 09 · финал */}
      <section className="v-section v-reveal" aria-labelledby="v-final">
        <div className="v-wrap v-narrow">
          <div className="v-panel vh-cta">
            <h2 id="v-final" className="v-h2">Попробуйте {TRIAL} бесплатно</h2>
            <p>Без карты — оцените скорость и решите, продлевать ли подписку. До {DEVICE_LIMIT} устройств сразу.</p>
            <div className="v-actions">
              <Link href={enter} prefetch={false} className="v-btn v-btn-white">Начать бесплатно</Link>
            </div>
          </div>
        </div>
      </section>
    </VShell>
  );
}
