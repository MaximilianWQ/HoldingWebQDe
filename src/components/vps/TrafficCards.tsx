import Link from "next/link";
import Carousel from "./Carousel";
import Icon from "@/components/pixel/Icon";
import { TRAFFIC_PACKS } from "@/lib/traffic-packs";
import { formatRub, formatDecimal } from "@/lib/plans";
import { dict, fill } from "@/i18n";
import type { Locale } from "@/lib/locale";

/**
 * Пакеты трафика.
 *
 * Плашка показывает ВЫГОДУ, а не тип карточки (владелец, 18.09.2026:
 * «на 50 ГБ пишем выгодно, на 100 — супервыгодно; выгоду пометить»).
 * Прежние подписи «Пакет / Пакет / Пакет» не говорили ничего и стояли
 * на всех карточках подряд.
 *
 * ЛЕСТНИЦА СЧИТАЕТСЯ ПО МЕСТУ В РЯДУ, А НЕ ПО ПОРОГУ. Первая версия
 * ставила «Супервыгодно» всем, у кого гигабайт дешевле старта на 20 %,
 * — и слово оказалось на девяти карточках из одиннадцати, то есть снова
 * ничего не значило. Теперь «Супервыгодно» получают только три пакета с
 * самым дешёвым гигабайтом после лучшего, лучший — жёлтую скошенную
 * плашку «Лучшая цена за ГБ», остальные — «Выгодно · −N%». Проценты
 * настоящие: считаются из цен `traffic-packs.ts`.
 *
 * `ids` — показать не весь список: на главной длинная лента из
 * одиннадцати карточек стоит между тарифами и вопросами, ровно там, где
 * человек решает. Места в лестнице считаются по ПОЛНОМУ списку, поэтому
 * «лучшая цена» не переедет на другой пакет из-за подборки.
 */
const SUPER_RANKS = 3;

export default function TrafficCards({
  locale,
  cta,
  ids,
}: {
  locale: Locale;
  cta?: string;
  ids?: string[];
}) {
  const t = dict(locale).cards;
  const button = cta ?? t.trafficBuy;
  const perGb = (p: (typeof TRAFFIC_PACKS)[number]) => p.priceRub / p.gb;
  const base = perGb(TRAFFIC_PACKS[0]);
  const ranked = [...TRAFFIC_PACKS].sort((a, b) => perGb(a) - perGb(b));
  const rankOf = (id: string) => ranked.findIndex((p) => p.id === id);
  const shown = ids ? TRAFFIC_PACKS.filter((p) => ids.includes(p.id)) : TRAFFIC_PACKS;

  return (
    <Carousel label={t.trafficLabel}>
      {shown.map((p, i) => {
        const gbPrice = perGb(p);
        const off = Math.round((1 - gbPrice / base) * 100);
        const rank = rankOf(p.id);
        const isBest = rank === 0;
        const tag =
          isBest ? { text: t.tagBestGb, tone: "v-badge-yellow v-dcard-tag-hero" }
          : i === 0 && p.id === TRAFFIC_PACKS[0].id ? { text: t.tagStart, tone: "v-badge-soft" }
          : rank <= SUPER_RANKS ? { text: fill(t.tagSuper, { off }), tone: "v-badge-solid-blue" }
          : off > 0 ? { text: fill(t.tagGood, { off }), tone: "v-badge-blue" }
          : { text: t.tagPack, tone: "v-badge-soft" };

        return (
          <article key={p.id} className={`v-dcard${isBest ? " v-dcard-pop" : ""}`} aria-label={fill(t.trafficAria, { gb: p.gb, price: p.priceRub })}>
            <span className={`v-badge v-dcard-tag ${tag.tone}`}>
              {isBest ? <Icon name="bolt" size={14} /> : null}
              {tag.text}
            </span>

            <h3 className="v-dcard-title">{fill(t.trafficTitle, { gb: formatRub(p.gb, locale) })}</h3>

            <p className="v-dcard-price">
              <b>{formatRub(p.priceRub, locale)} ₽</b>
              <span>{t.trafficOnce}</span>
            </p>

            <p className="v-dcard-sum">
              {fill(t.trafficPerGb, { price: formatDecimal(gbPrice, locale, 2) })}
              {off > 0 ? fill(t.trafficCheaper, { off }) : ""}
            </p>

            <ul className="v-checks">
              {t.trafficChecks.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>

            <Link
              href={`/subscribe?product=traffic&pack=${p.id}`}
              prefetch={false}
              className={`v-btn v-btn-block ${isBest ? "v-btn-white" : "v-btn-primary"}`}
            >
              {button} · {formatRub(p.gb, locale)} {t.stickerGbShort}
            </Link>
          </article>
        );
      })}
    </Carousel>
  );
}
