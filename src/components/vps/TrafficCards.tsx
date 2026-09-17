import Link from "next/link";
import Carousel from "./Carousel";
import { TRAFFIC_PACKS } from "@/lib/traffic-packs";
import { formatRub } from "@/lib/plans";

/**
 * Пакеты трафика чёрными карточками. Цены — src/lib/traffic-packs.ts.
 * На витрине — «Пакеты трафика» и «усиленные серверы» (без «обхода»).
 */
export default function TrafficCards({ cta = "Купить ГБ" }: { cta?: string }) {
  const cheapestPerGb = Math.min(...TRAFFIC_PACKS.map((p) => p.priceRub / p.gb));
  return (
    <Carousel label="Пакеты трафика">
      {TRAFFIC_PACKS.map((p, i) => {
        const perGb = p.priceRub / p.gb;
        const tag = perGb === cheapestPerGb ? "Супер выгодно" : i === 0 ? "Для старта" : p.gb >= 100 ? "Выгодно" : "Пакет";
        return (
          <article key={p.id} className="v-dcard" aria-label={`${p.gb} ГБ за ${p.priceRub} ₽`}>
            <span className={`v-badge v-badge-lg v-dcard-tag ${tag === "Супер выгодно" ? "v-badge-yellow" : tag === "Выгодно" ? "v-badge-solid-blue" : "v-badge-dark"}`}>{tag}</span>
            <h3 className="v-dcard-title">{formatRub(p.gb)} ГБ трафика</h3>
            <p className="v-dcard-desc">Отдельный ключ на усиленные серверы. Гигабайты без срока — пакеты складываются.</p>
            <ul className="v-checks">
              <li>{formatRub(p.gb)} ГБ без срока действия</li>
              <li>Усиленные серверы для сложных сетей</li>
              <li>{perGb.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽ за гигабайт</li>
            </ul>
            <p className="v-price-row">Стоимость подключения: <b>{formatRub(p.priceRub)} ₽</b></p>
            <Link href={`/subscribe?product=traffic&pack=${p.id}`} prefetch={false} className="v-btn v-btn-primary v-btn-block">{cta}</Link>
          </article>
        );
      })}
    </Carousel>
  );
}
