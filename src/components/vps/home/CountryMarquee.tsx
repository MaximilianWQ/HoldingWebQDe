import { LOCATIONS, COUNTRY_COUNT, countryName } from "@/lib/locations";
import { dict, fill } from "@/i18n";
import { count } from "@/i18n/plural";
import type { Locale } from "@/lib/locale";

/**
 * Бегущая строка стран сети — только названия из src/lib/locations.ts
 * (эмодзи-флаги запрещены). Контент продублирован дважды для
 * бесшовной ленты (`.v-marquee` / `.v-marquee-track` из vps.css).
 */
export default function CountryMarquee({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const names = LOCATIONS.map((l) => countryName(l, locale));
  const track = [...names, ...names];
  return (
    <div className="vh-countries">
      <p className="vh-countries-label">
        {fill(d.home.countries.label, { countries: count(locale, COUNTRY_COUNT, d.units.countryIn) })}
      </p>
      <div className="v-marquee" aria-hidden>
        <div className="v-marquee-track">
          {track.map((name, i) => (
            <span key={`${name}-${i}`} className="vh-country-pill">{name}</span>
          ))}
        </div>
      </div>
      <span className="v-sr">{names.join(", ")}</span>
    </div>
  );
}
