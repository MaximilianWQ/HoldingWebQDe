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
import { BRAND, TRIAL } from "./links";
import { DEVICE_LIMIT, PLANS, PLAN_CONTENT, PLAN_SPEED, formatRub, pricePerMonth } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRAFFIC_ENTRY_RUB, TRAFFIC_PACKS } from "@/lib/traffic-packs";
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
 */
export default async function Home({ referralCode }: { referralCode?: string }) {
  const enter = referralCode ? `/auth?ref=${encodeURIComponent(referralCode)}` : "/auth";
  return (
    <VShell>
      {/* 01 · первый экран */}
      <section className="v-section v-center v-glow vh-hero-sec" aria-labelledby="v-hero">
        <div className="v-wrap vh-hero">
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
            {/* Кнопка стоит ДО кадра. Разбор 18.09.2026: в макете по
                центру кадр высотой в пол-экрана уводил её под сгиб, а
                выравнивание само по себе на конверсию почти не влияет —
                влияет то, видно ли действие без прокрутки. */}
            <div className="v-actions">
              <Link href={enter} prefetch={false} className="v-btn v-btn-primary">Попробовать {TRIAL} бесплатно</Link>
              <Link href="/pricing" className="v-btn v-btn-soft">Тарифы от {formatRub(PLANS.basic[1])} ₽</Link>
            </div>
            <p className="vh-hero-note">
              Карта не нужна. Вход по почте, ключ приходит сразу — подключение занимает минуту.
            </p>
          </div>

          {/* Одна сцена, а не коллаж: ноутбук и телефон сняты вместе,
              с общим светом и общей тенью на общем полу
              (design/blender/hero_build.py). Вокруг — стеклянные плашки
              с числами из src/lib и две геометрические фигуры. */}
          <div className="vh-stage" aria-hidden>
            <img
              src="/media/hero/stage-860.v3.webp"
              srcSet="/media/hero/stage-860.v3.webp 860w, /media/hero/stage-1720.v3.webp 1720w"
              sizes="(min-width: 1100px) 1000px, 100vw"
              alt=""
              width={860}
              height={613}
              fetchPriority="high"
              decoding="async"
            />

            <span className="vh-chip vh-chip-a">
              <Icon name="globe" size={16} />
              {COUNTRY_COUNT} стран
            </span>
            <span className="vh-chip vh-chip-b">
              <Icon name="lock" size={16} />
              Шифрование включено
            </span>
            <span className="vh-chip vh-chip-c">
              <Icon name="bolt" size={16} />
              до {PLAN_SPEED.plus} Гбит/с
            </span>
            <span className="vh-chip vh-chip-d">
              <Icon name="devices" size={16} />
              до {DEVICE_LIMIT} устройств
            </span>
            <i className="vh-shape vh-shape-square" />
            <i className="vh-shape vh-shape-dot" />
          </div>

          <StoreBadges />
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

      {/* 04 · почему Atlas Secure VPS */}
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

      {/* 05 · тарифы */}
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

      {/* 06 · трафик */}
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
          {/* На главной — короткая подборка, а не все одиннадцать
              пакетов: длинная лента стоит ровно там, где человек
              решает, и листать её вместо решения он не будет. Места в
              лестнице выгоды считаются по полному списку, поэтому
              «лучшая цена за ГБ» не переезжает из-за подборки. */}
          <TrafficCards ids={["gb15", "gb100", "gb300", "gb600"]} />
          <div className="v-actions">
            <Link href="/pricing#traffic" className="v-btn v-btn-soft">
              Все {TRAFFIC_PACKS.length} пакетов — до {formatRub(TRAFFIC_PACKS[TRAFFIC_PACKS.length - 1].gb)} ГБ
            </Link>
          </div>
          <p className="v-car-note">Пакет работает рядом с подпиской и не заменяет её.</p>
        </div>
      </section>

      {/* 07 · кешбэк за приглашённых */}
      <section className="v-section v-reveal" aria-labelledby="v-ref">
        <div className="v-wrap">
          <div className="v-panel vh-ref-panel">
            <Referral enter={enter} />
          </div>
        </div>
      </section>

      {/* 08 · частые вопросы */}
      <section className="v-section v-center v-reveal" aria-labelledby="v-faq">
        <div className="v-wrap v-narrow">
          <h2 id="v-faq" className="v-h2">Вопросы, которые задают перед покупкой</h2>
          <p className="v-lead">Если вашего здесь нет — напишите в поддержку, ответим до оплаты.</p>
          <FaqAccordion />
        </div>
      </section>

      {/* 09 · финал */}
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
