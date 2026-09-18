import Link from "next/link";
import Logo from "./Logo";
import { FOOT_LINKS, FOOT_APPS, LEGAL, SUPPORT_TG, BRAND, TRIAL } from "./links";
import { SUPPORT_DESK } from "@/lib/contacts";
import { COUNTRY_COUNT, CITY_COUNT } from "@/lib/locations";
import { FOUNDED } from "@/lib/nav";
import { PLANS, formatRub } from "@/lib/plans";
import { plural } from "@/lib/ru-words";

/**
 * Подвал — чёрная плита.
 *
 * Полный (витрина). Владелец 18.09.2026: «низ сайта сделай как в прошлой
 * нашей версии, он очень понравился» — то есть подвал «Атлас-издания»:
 * знак, фраза пользы и главное действие слева, четыре колонки ссылок
 * справа, контурное имя во всю ширину, строка реквизитов. Здесь тот же
 * состав, набранный материалом корпуса VPS (белое поле, синие кнопки).
 *
 * Последний экран сайта — это ещё одна возможность начать: человек,
 * докрутивший до низа, ищет либо ответ, либо кнопку. Поэтому в подвале
 * стоят обе: действие и адрес поддержки.
 *
 * `slim` — рабочие экраны (кабинет, оплата, вход): только реквизиты и
 * документы, без разделов.
 */
export default function VFooter({ slim = false }: { slim?: boolean }) {
  const year = new Date().getFullYear();
  const span = year > FOUNDED ? `${FOUNDED}–${year}` : String(FOUNDED);
  const where = `${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}`;

  if (slim) {
    return (
      <footer className="v-foot v-foot-slim">
        <div className="v-wrap v-foot-base">
          <p>© {span} {BRAND} · часть группы QoDev, Гонконг (SAR)</p>
          <p className="v-foot-legal">
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} prefetch={false}>{l.label}</Link>
            ))}
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="v-foot">
      <div className="v-wrap">
        <div className="v-foot-top">
          <div className="v-foot-brand">
            <Logo />
            <p className="v-foot-pitch">
              Ускоритель интернета для телефона, компьютера и телевизора.{" "}
              <span>Видео, сайты и игры открываются сразу.</span>
            </p>
            <div className="v-foot-cta">
              <Link href="/auth" prefetch={false} className="v-btn v-btn-white">Попробовать {TRIAL} бесплатно</Link>
              <Link href="/pricing" className="v-btn v-btn-ghost">Тарифы от {formatRub(PLANS.basic[1])} ₽</Link>
            </div>
            <p className="v-foot-support">
              Вопрос перед покупкой? Пишите в Telegram{" "}
              <a href={SUPPORT_TG.href} target="_blank" rel="noopener noreferrer">{SUPPORT_TG.handle}</a>{" "}
              или на почту{" "}
              <a href={`mailto:${SUPPORT_DESK.email}`}>{SUPPORT_DESK.email}</a>
            </p>
          </div>

          <nav className="v-foot-cols" aria-label="Разделы сайта">
            {FOOT_LINKS.map((group, i) => (
              <div key={group.title} style={{ ["--i" as string]: i }}>
                <p className="v-foot-group-title">{group.title}</p>
                <ul className="v-foot-links">
                  {group.links.map((l) => (
                    <li key={l.href}><Link href={l.href} prefetch={false}>{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="v-foot-apps">
          Работает в приложениях <b>{FOOT_APPS}</b> · серверы в {where}, {CITY_COUNT}{" "}
          {plural(CITY_COUNT, ["город", "города", "городов"])}
        </p>

        {/* Контурное имя во всю ширину — тот приём из прошлой версии,
            из-за которого низ сайта перестал выглядеть пустым. */}
        <div className="v-foot-word" aria-hidden>
          <p>atlas secure</p>
        </div>

        <div className="v-foot-base">
          <p>© {span} {BRAND} · часть группы QoDev, Гонконг (SAR)</p>
          <p className="v-foot-legal">
            {LEGAL.map((l) => (
              <Link key={l.href} href={l.href} prefetch={false}>{l.label}</Link>
            ))}
          </p>
        </div>
      </div>
    </footer>
  );
}
