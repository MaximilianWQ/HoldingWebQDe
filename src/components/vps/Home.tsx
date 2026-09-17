import Link from "next/link";
import VShell from "./VShell";
import StoreBadges from "./StoreBadges";
import PlanCards from "./PlanCards";
import TrafficCards from "./TrafficCards";
import Steps from "./Steps";
import { BRAND, TRIAL } from "./links";
import { COUNTRY_COUNT } from "@/lib/locations";
import { DEVICE_LIMIT, PLAN_SPEED, PLANS, formatRub } from "@/lib/plans";

/**
 * Главная Atlas Secure VPS (владелец, 17.09.2026: «очень простой, очень
 * приятный сайт стилистики Apple — минимум текста, максимально просто,
 * продающе»). Одна мысль на экран; все числа — из src/lib.
 */
export default function Home({ referralCode }: { referralCode?: string }) {
  const enter = referralCode ? `/auth?ref=${encodeURIComponent(referralCode)}` : "/auth";
  return (
    <VShell>
      {/* 01 · первый экран */}
      <section className="v-section v-center" aria-labelledby="v-hero">
        <div className="v-wrap">
          <h1 id="v-hero" className="v-h1">
            Любимые сервисы <span className="v-accent">на максимум</span>
          </h1>
          <p className="v-lead">
            Добро пожаловать в {BRAND} — быстрый и приватный интернет на всех ваших устройствах.
          </p>
          <div className="v-devices" aria-hidden>
            <div className="v-devices-laptop">
              <img src="/media/laptop/poster.jpg" alt="" width={1400} height={900} fetchPriority="high" />
            </div>
            <div className="v-phone">
              <div className="v-phone-screen"><img src="/media/ios/dash.webp" alt="" width={880} height={1788} /></div>
              <img className="v-phone-shell" src="/media/ios/shell.webp" alt="" width={960} height={1992} />
            </div>
          </div>
          <div className="v-actions">
            <Link href={enter} prefetch={false} className="v-btn v-btn-primary">Попробовать {TRIAL} бесплатно</Link>
            <Link href="/pricing" className="v-btn v-btn-soft">Тарифы от {formatRub(PLANS.basic[1])} ₽</Link>
          </div>
          <StoreBadges />
        </div>
      </section>

      {/* 02 · что это */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-what">
        <div className="v-wrap">
          <span className="v-chip">Что такое {BRAND}?</span>
          <h2 id="v-what" className="v-h2" style={{ marginTop: 24 }}>
            Надёжный VPS <span className="v-accent">для каждого дня</span>
          </h2>
          <p className="v-lead">
            Готовое решение: быстрое соединение, серверы в {COUNTRY_COUNT} странах и пакеты трафика для сложных сетей.
          </p>
          <div className="v-stat-stage">
            <div className="v-stat-card" style={{ textAlign: "left" }}>
              <p className="v-stat" style={{ margin: 0 }}><i aria-hidden /><b>{COUNTRY_COUNT} стран</b><span>Серверы на выбор в каждом тарифе</span></p>
              <p className="v-stat" style={{ margin: 0 }}><i aria-hidden /><b>до {PLAN_SPEED.plus} Гбит/с</b><span>Ширина канала на тарифе Plus</span></p>
              <p className="v-stat" style={{ margin: 0 }}><i aria-hidden /><b>{DEVICE_LIMIT} устройств</b><span>На одной подписке</span></p>
            </div>
          </div>
          <div className="v-actions-col" style={{ maxWidth: 560, marginInline: "auto" }}>
            <Link href={enter} prefetch={false} className="v-btn v-btn-primary v-btn-block">Подключить</Link>
            <Link href="/infrastructure" className="v-btn v-btn-soft v-btn-block">Подробности →</Link>
          </div>
        </div>
      </section>

      {/* 03 · управление */}
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

      {/* 04 · тарифы */}
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

      {/* 05 · трафик */}
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

      {/* 06 · как подключиться */}
      <section className="v-section v-reveal" aria-labelledby="v-how">
        <div className="v-wrap v-narrow">
          <h2 id="v-how" className="v-h2">
            Подключение <span className="v-accent">в три шага</span>
          </h2>
          <p className="v-lead" style={{ marginInline: 0 }}>Подписка начинает работать за минуту — вот и всё, что нужно сделать.</p>
          <Steps />
        </div>
      </section>
    </VShell>
  );
}
