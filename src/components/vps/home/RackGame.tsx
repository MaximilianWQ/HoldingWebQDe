import RackGameBoard, { type RackCopy } from "./RackGameBoard";
import { PLAYABLE, RACK_SLOTS } from "./rack-data";
import { dict } from "@/i18n";
import { fill } from "@/lib/text/fill";
import { count } from "@/lib/text/plural";
import { DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { localeHref, type Locale } from "@/lib/locale";
import "@/app/home-rack.css";

/**
 * Раздел «Соберите свой дата-центр» — серверная обёртка.
 *
 * Она и только она читает словарь: клиентская доска получает готовые
 * строки пропсами. Правило шире, чем кажется, — серверный компонент, к
 * которому тянется клиент, тоже не смеет звать `dict()`: именно так в
 * первую загрузку кабинета однажды уехал чанк 292 КБ с обоими языками.
 * Здесь клиент тянется к `RackGameBoard`, а не к этому файлу, поэтому
 * `dict()` тут допустим.
 *
 * Числа в подписях — из `src/lib`, руками не пишутся.
 */
export default function RackGame({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const t = d.home.rack;

  const vars = {
    countries: count(locale, COUNTRY_COUNT, d.units.country),
    countriesIn: count(locale, COUNTRY_COUNT, d.units.countryIn),
    devices: count(locale, DEVICE_LIMIT, d.units.device),
    trial: count(locale, TRIAL_DAYS, d.units.day),
    total: String(RACK_SLOTS),
  };

  // Подписи собираются по КЛЮЧУ модуля, а не по месту в списке:
  // проверка типов ловит забытый ключ, но не разъехавшуюся длину
  // массива, и связка по индексу сломалась бы молча.
  const names: Record<string, string> = {};
  const hints: Record<string, string> = {};
  for (const u of PLAYABLE) {
    const m = t.modules[u.id as keyof typeof t.modules];
    names[u.id] = fill(m.name, vars);
    hints[u.id] = fill(m.hint, vars);
  }
  for (const [id, m] of Object.entries(t.preset)) {
    names[id] = fill(m.name, vars);
    hints[id] = fill(m.hint, vars);
  }

  const copy: RackCopy = {
    how: t.how,
    rackLabel: t.rackLabel,
    shelfLabel: t.shelfLabel,
    slotEmpty: t.slotEmpty,
    slotFilled: t.slotFilled,
    count: t.count,
    place: t.place,
    placed: t.placed,
    howDrag: t.howDrag,
    pickUp: t.pickUp,
    dropHere: t.dropHere,
    powerOn: t.powerOn,
    powerOff: t.powerOff,
    faults: t.faults,
    connect: t.connect,
    connected: t.connected,
    start: t.start,
    running: t.running,
    sound: t.sound,
    soundHint: t.soundHint,
    names,
    hints,
    done: {
      title: t.done.title,
      text: t.done.text,
      bullets: t.done.bullets.map((b) => fill(b, vars)),
      cta: t.done.cta,
      again: t.done.again,
    },
  };

  return (
    <section className="v-section v-center v-reveal" id="rack" aria-labelledby="v-rack">
      <div className="v-wrap">
        <h2 id="v-rack" className="v-h2">
          {t.title} <span className="v-accent">{t.titleAccent}</span>
        </h2>
        <p className="v-lead">{t.lead}</p>
        <RackGameBoard copy={copy} ctaHref={localeHref("/auth", locale)} />
      </div>
    </section>
  );
}
