import Link from "next/link";
import Carousel from "./Carousel";
import Icon from "@/components/pixel/Icon";
import { TRAFFIC_PACKS } from "@/lib/traffic-packs";
import { formatRub } from "@/lib/plans";

/**
 * Пакеты трафика.
 *
 * Плашка показывает ВЫГОДУ, а не тип карточки (владелец, 18.09.2026:
 * «на 50 ГБ пишем выгодно, на 100 — супервыгодно; выгоду пометить»).
 * Прежние подписи «Пакет / Пакет / Пакет» не говорили ничего и стояли
 * на всех карточках подряд.
 *
 * Лестница считается от цены гигабайта в стартовом пакете — это и есть
 * то, что покупатель сравнивает, когда выбирает объём:
 *   · первый пакет            — «Для старта»;
 *   · дешевле старта до 20 %  — «Выгодно»;
 *   · дешевле старта от 20 %  — «Супервыгодно»;
 *   · самый дешёвый гигабайт  — «Лучшая цена за ГБ», жёлтая скошенная
 *     плашка, одна на весь ряд (тот же приём, что у срока подписки).
 * Процент в плашке настоящий: он считается из цен `traffic-packs.ts`,
 * а не выбирается вручную под красивое число.
 */
export default function TrafficCards({ cta = "Купить" }: { cta?: string }) {
  const perGb = (p: (typeof TRAFFIC_PACKS)[number]) => p.priceRub / p.gb;
  const base = perGb(TRAFFIC_PACKS[0]);
  const best = Math.min(...TRAFFIC_PACKS.map(perGb));

  return (
    <Carousel label="Пакеты трафика">
      {TRAFFIC_PACKS.map((p, i) => {
        const gbPrice = perGb(p);
        const off = Math.round((1 - gbPrice / base) * 100);
        const isBest = gbPrice === best;
        const tag =
          isBest ? { text: "Лучшая цена за ГБ", tone: "v-badge-yellow v-dcard-tag-hero" }
          : i === 0 ? { text: "Для старта", tone: "v-badge-soft" }
          : off >= 20 ? { text: `Супервыгодно · −${off}%`, tone: "v-badge-solid-blue" }
          : { text: `Выгодно · −${off}%`, tone: "v-badge-blue" };

        return (
          <article key={p.id} className={`v-dcard${isBest ? " v-dcard-pop" : ""}`} aria-label={`${p.gb} ГБ за ${p.priceRub} ₽`}>
            <span className={`v-badge v-dcard-tag ${tag.tone}`}>
              {isBest ? <Icon name="bolt" size={14} /> : null}
              {tag.text}
            </span>

            <h3 className="v-dcard-title">{formatRub(p.gb)} ГБ трафика</h3>

            <p className="v-dcard-price">
              <b>{formatRub(p.priceRub)} ₽</b>
              <span>разово</span>
            </p>

            <p className="v-dcard-sum">
              {gbPrice.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽ за гигабайт
              {off > 0 ? ` · на ${off}% дешевле стартового пакета` : ""}
            </p>

            <ul className="v-checks">
              <li>Гигабайты без срока — не сгорают</li>
              <li>Пакеты складываются друг с другом</li>
              <li>Усиленные серверы для сложных сетей</li>
            </ul>

            <Link
              href={`/subscribe?product=traffic&pack=${p.id}`}
              prefetch={false}
              className={`v-btn v-btn-block ${isBest ? "v-btn-white" : "v-btn-primary"}`}
            >
              {cta} · {formatRub(p.gb)} ГБ
            </Link>
          </article>
        );
      })}
    </Carousel>
  );
}
