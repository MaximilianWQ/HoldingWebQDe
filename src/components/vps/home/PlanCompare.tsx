import { PLANS, PLAN_SPEED, DEVICE_LIMIT, formatRub, planContent } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { dict, fill } from "@/i18n";
import { count } from "@/i18n/plural";
import type { Locale } from "@/lib/locale";

/**
 * «Basic или Plus» — короткая таблица выбора под карточками сроков.
 *
 * Выбор между двумя тарифами — место, где человек застревает и уходит
 * «подумать». Шесть строк отвечают на единственный вопрос, который он
 * себе задаёт: «мне-то какой?» Числа — из `src/lib/plans.ts`.
 */
export default function PlanCompare({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const c = planContent(locale);
  const names = { a: c.basic.name, b: c.plus.name };
  const vars = {
    ...names,
    basicSpeed: PLAN_SPEED.basic,
    plusSpeed: PLAN_SPEED.plus,
    countries: count(locale, COUNTRY_COUNT, d.units.country),
    devices: count(locale, DEVICE_LIMIT, d.units.device),
    basicPrice: formatRub(PLANS.basic[1], locale),
    plusPrice: formatRub(PLANS.plus[1], locale),
  };

  return (
    <div className="vh-cmp">
      <table className="vh-cmp-table">
        <caption className="v-sr">{fill(d.compare.caption, names)}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="v-sr">{d.compare.property}</span></th>
            <th scope="col">
              <b>{c.basic.name}</b>
              <span>{c.basic.tagline}</span>
            </th>
            <th scope="col" className="vh-cmp-hot">
              <b>{c.plus.name}</b>
              <span>{c.plus.tagline}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {d.compare.rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{fill(r.basic, vars)}</td>
              <td className="vh-cmp-hot">{fill(r.plus, vars)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="v-car-note">{fill(d.compare.note, names)}</p>
    </div>
  );
}
