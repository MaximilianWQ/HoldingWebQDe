import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BRAND, TRIAL } from "@/components/vps/links";
import { CITY_COUNT, COUNTRY_COUNT } from "@/lib/locations";
import { DEVICE_LIMIT, PLANS, PLAN_SPEED, formatRub } from "@/lib/plans";
import { SERVER_ENTRY_USD, formatUsd } from "@/lib/servers";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { FOUNDED } from "@/lib/nav";

/**
 * Год случая, с которого началась история компании (вводные владельца,
 * 18.09.2026). Оба события осени 2014 года — проверяемые, ссылки стоят
 * на самой странице: 28.09.2014 материковый Китай закрыл Instagram
 * из-за фотографий из Гонконга; с 16.09.2014 по мессенджерам расходилось
 * поддельное «приложение для координации» Code4HK, которое ставило на
 * телефон шпионскую программу (бюллетень HKCERT).
 */
const STORY_YEAR = 2014;
import { plural } from "@/lib/ru-words";
import "./about-vps.css";

/**
 * /about — корпус Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple — минимум текста»).
 *
 * Одна мысль на экран: обещание → числа → три правила (тёмная плита)
 * → чем мы занимаемся → тарифы. Все числа — из src/lib, как и раньше.
 *
 * СНЯТО ПРИ ПЕРЕВОДЕ (было в прежней версии на «Атлас-издании»):
 * анимированный глобус первого экрана и закреплённая сцена «три
 * правила, проявляющиеся по словам» — декоративный моушн прежнего
 * корпуса, в новом корпусе таких сцен нет ни на одной странице.
 * Смысл текста сохранён целиком.
 */
export const metadata: Metadata = {
  title: "О компании",
  description:
    `${BRAND} — VPS-ускоритель для телефона и компьютера и выделенные серверы. ` +
    `${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}, ` +
    `до ${DEVICE_LIMIT} устройств на подписке. Во что мы верим и что можем подтвердить.`,
  alternates: { canonical: "/about" },
};

const FACTS: Array<{ v: string; label: string; icon: IconName; tile?: "dark" | "blue"; span?: 2 | 3 }> = [
  { v: String(COUNTRY_COUNT), label: `${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} на выбор`, icon: "globe", tile: "blue", span: 3 },
  { v: String(DEVICE_LIMIT), label: `${plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])} на подписке`, icon: "devices", tile: "dark", span: 3 },
  { v: String(CITY_COUNT), label: `${plural(CITY_COUNT, ["город", "города", "городов"])} с серверами`, icon: "grid", span: 2 },
  { v: String(PLAN_SPEED.plus), label: "Гбит/с на тарифе Plus", icon: "bolt", span: 2 },
  { v: String(TRIAL_DAYS), label: `${plural(TRIAL_DAYS, ["день", "дня", "дней"])} бесплатно`, icon: "clock", span: 2 },
];


export default function AboutPage() {
  return (
    <VShell>
      {/* 01 · обещание */}
      <section className="v-section v-center v-glow" aria-labelledby="pa-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="pa-title" className="v-h1">
            Интернет, который <span className="v-accent">просто работает</span>
          </h1>
          <p className="v-lead">
            {BRAND} — VPS-ускоритель для телефона и компьютера и выделенные серверы для проектов.
            Вот во что мы верим и что можем подтвердить.
          </p>
        </div>
      </section>

      {/* 02 · история */}
      <section className="v-section v-reveal" aria-labelledby="pa-story-title">
        <div className="v-wrap pa-story">
          <div className="pa-story-text">
            <h2 id="pa-story-title" className="v-h2">Как появился Atlas Secure</h2>
            <p>
              Нас двое. Один закончил Department of Information Engineering в Китайском университете Гонконга
              (CUHK), второй — МГИМО, бакалавриат «Информационные технологии в международном бизнесе». Один считал
              сети инженерной задачей, второй — рынком; оказалось, что задача одна и та же.
            </p>
            <p>
              Осенью {STORY_YEAR} года, когда один из нас учился в Гонконге, стало видно, из чего эта задача
              состоит. 28 сентября материковый Китай закрыл Instagram — из-за фотографий с гонконгских улиц. А за
              полторы недели до этого по мессенджерам разошлась ссылка на «приложение для координации» Code4HK: у
              тех, кто его поставил, чужие люди читали переписку, список контактов, историю звонков и видели точку
              на карте. Людей одним движением отключили от мира — и в тот же момент прочитали.
            </p>
            <p>
              Начинали мы не с этого. Сначала был маленький магазин: сетевое оборудование и цифровые товары. Он
              кормил двоих и научил тому, чего нет в спецификациях, — люди платят за понятную вещь, которая
              работает без инструкции. Уже потом, для себя и знакомых, мы собрали первое подключение, которое
              открывало заблокированные сайты. Оно оказалось нужнее магазина.
            </p>
            <p>
              Дальше были инвестиции, несколько заходов, которые ничем не кончились, и ещё один раунд. К нему мы
              вернулись к той самой мысли {STORY_YEAR} года — и в {FOUNDED} году зарегистрировали Atlas Secure в
              Гонконге. Сегодня это часть группы QoDev: ускоритель интернета, выделенные серверы и пакеты трафика.
            </p>
            <p className="pa-story-src">
              Что это было:{" "}
              <a href="https://www.nbcnews.com/news/world/instagram-blocked-china-amid-occupycentral-movement-n213556" target="_blank" rel="noopener noreferrer">
                блокировка Instagram, 28.09.2014
              </a>{" "}
              ·{" "}
              <a href="https://www.hkcert.org/security-bulletin/fake-code4hk-mobile-application-attack" target="_blank" rel="noopener noreferrer">
                бюллетень HKCERT о поддельном приложении Code4HK
              </a>
            </p>
          </div>
          <ol className="pa-story-line">
            <li>
              <b>{STORY_YEAR}</b>
              <span>Гонконг. Сайты закрывают, телефоны читают. То, из-за чего всё дальше и случилось.</span>
            </li>
            <li>
              <b>Магазин</b>
              <span>Сетевое оборудование и цифровые товары — первое общее дело на двоих.</span>
            </li>
            <li>
              <b>Первое подключение</b>
              <span>Собрали для себя и знакомых, чтобы открывались заблокированные сайты. Спрос оказался больше.</span>
            </li>
            <li>
              <b>{FOUNDED}</b>
              <span>Инвестиции, неудачные заходы, новый раунд — и компания в Гонконге.</span>
            </li>
            <li>
              <b>Сегодня</b>
              <span>
                Часть группы QoDev: серверы в {COUNTRY_COUNT}{" "}
                {plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}, до {DEVICE_LIMIT} устройств на подписке,
                выделенные серверы и пакеты трафика.
              </span>
            </li>
          </ol>
        </div>
      </section>

      {/* 03 · миссия */}
      <section className="v-section v-reveal" aria-labelledby="pa-mission-title">
        <div className="v-wrap">
          <div className="v-panel pa-mission">
            <p className="pa-mission-kicker">Миссия</p>
            <h2 id="pa-mission-title" className="v-h2">
              Сделать защищённый интернет <span className="pa-mission-accent">обычным делом</span>
            </h2>
            <p className="pa-mission-lead">
              Не навыком, не отдельной покупкой, не поводом разбираться в настройках. Открыл приложение — и всё
              работает так, как должно работать по умолчанию: сайты открываются, видео идёт, а то, что вы делаете
              в сети, остаётся вашим делом.
            </p>
            <ul className="pa-mission-list">
              <li>
                <b>Свобода и защита ходят парой</b>
                Доступ нужен, чтобы пользоваться интернетом. Шифрование — чтобы этим пользовались только вы.
                По отдельности мы это не продаём.
              </li>
              <li>
                <b>По умолчанию, а не за доплату</b>
                Шифрование включено в каждом тарифе и на каждом устройстве. Отдельной строки «безопасность» в
                счёте нет и не будет.
              </li>
              <li>
                <b>Обещаем только то, что можем показать</b>
                Числа на сайте берутся из того же кода, по которому работает сервис. Чего нет — о том молчим.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 04 · в цифрах — бенто */}
      <section className="v-section v-reveal" aria-labelledby="pa-facts-title">
        <div className="v-wrap">
          <h2 id="pa-facts-title" className="v-sr">Atlas в цифрах</h2>
          <div className="v-bento">
            {FACTS.map((f) => (
              <div key={f.label} className={`v-tile v-span-${f.span ?? 2}${f.tile ? ` v-tile-${f.tile}` : ""}`}>
                <span className="v-tile-icon" aria-hidden><Icon name={f.icon} size={22} /></span>
                <h3>{f.label}</h3>
                <b className="v-tile-num">{f.v}</b>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 05 · что мы делаем */}
      <section className="v-section v-center v-reveal" aria-labelledby="pa-make-title">
        <div className="v-wrap">
          <h2 id="pa-make-title" className="v-h2">Что мы делаем</h2>
          <div className="pa-make">
            <Link href="/pricing" className="v-card v-card-pad pa-make-card v-lift">
              <span className="pa-make-icon" aria-hidden><Icon name="bolt" size={24} /></span>
              <h3 className="pa-make-title">VPS-ускоритель</h3>
              <p className="v-text">
                Для телефона и компьютера: сайты и приложения снова открываются на полной скорости.
              </p>
              <p className="pa-make-price">от <b>{formatRub(PLANS.basic[1])} ₽</b> в месяц</p>
            </Link>
            <Link href="/vds" className="v-card v-card-pad pa-make-card v-lift">
              <span className="pa-make-icon" aria-hidden><Icon name="grid" size={24} /></span>
              <h3 className="pa-make-title">Выделенные серверы</h3>
              <p className="v-text">
                Сервер целиком: железо ни с кем не делится, ширину канала выбираете сами.
              </p>
              <p className="pa-make-price">от <b>{formatUsd(SERVER_ENTRY_USD)}</b> в месяц</p>
            </Link>
          </div>
          <p className="v-small" style={{ marginTop: 24 }}>
            Для команды — <Link href="/business" className="v-link">подключения по договору</Link>. Как
            обращаемся с данными — <Link href="/security" className="v-link">безопасность</Link>.
          </p>
        </div>
      </section>

      {/* 06 · финал */}
      <section className="v-section v-center v-reveal" aria-labelledby="pa-final-title">
        <div className="v-wrap v-narrow">
          <h2 id="pa-final-title" className="v-h2">Выберите свой тариф</h2>
          <p className="v-lead">
            Два тарифа, до {DEVICE_LIMIT} {plural(DEVICE_LIMIT, ["устройства", "устройств", "устройств"])} и
            все {COUNTRY_COUNT} {plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} в каждом.
          </p>
          <div className="v-actions">
            <Link href="/pricing" className="v-btn v-btn-primary">Посмотреть тарифы</Link>
            <Link href="/auth" prefetch={false} className="v-btn v-btn-soft">Попробовать {TRIAL} бесплатно</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
