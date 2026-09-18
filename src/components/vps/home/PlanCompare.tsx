import { PLANS, PLAN_CONTENT, PLAN_SPEED, DEVICE_LIMIT, formatRub } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";

/**
 * «Basic или Plus» — короткая таблица выбора под карточками сроков.
 *
 * Выбор между двумя тарифами — место, где человек застревает и уходит
 * «подумать». Шесть строк отвечают на единственный вопрос, который он
 * себе задаёт: «мне-то какой?» Числа — из `src/lib/plans.ts`.
 */
const ROWS: { label: string; basic: string; plus: string }[] = [
  { label: "Кому", basic: "Видео, соцсети, работа, учёба", plus: "Игры, стримы, созвоны, тяжёлые загрузки" },
  { label: "Ширина канала", basic: `${PLAN_SPEED.basic} Гбит/с`, plus: `${PLAN_SPEED.plus} Гбит/с — приоритет` },
  { label: "Страны", basic: `Все ${COUNTRY_COUNT}`, plus: `Все ${COUNTRY_COUNT} + выделенные серверы` },
  { label: "Устройства", basic: `До ${DEVICE_LIMIT}`, plus: `До ${DEVICE_LIMIT}` },
  { label: "Резервные каналы", basic: "—", plus: "Есть: доступ работает всегда" },
  { label: "Цена от", basic: `${formatRub(PLANS.basic[1])} ₽`, plus: `${formatRub(PLANS.plus[1])} ₽` },
];

export default function PlanCompare() {
  return (
    <div className="vh-cmp">
      <table className="vh-cmp-table">
        <caption className="v-sr">Сравнение тарифов {PLAN_CONTENT.basic.name} и {PLAN_CONTENT.plus.name}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="v-sr">Свойство</span></th>
            <th scope="col">
              <b>{PLAN_CONTENT.basic.name}</b>
              <span>{PLAN_CONTENT.basic.tagline}</span>
            </th>
            <th scope="col" className="vh-cmp-hot">
              <b>{PLAN_CONTENT.plus.name}</b>
              <span>{PLAN_CONTENT.plus.tagline}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.basic}</td>
              <td className="vh-cmp-hot">{r.plus}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="v-car-note">
        Не уверены — начните с {PLAN_CONTENT.basic.name}: пробные дни одинаковые для обоих тарифов, а выбрать вы
        успеете при первой оплате.
      </p>
    </div>
  );
}
