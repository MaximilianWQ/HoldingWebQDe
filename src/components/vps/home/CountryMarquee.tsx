import { LOCATIONS, COUNTRY_COUNT } from "@/lib/locations";
import { plural } from "@/lib/ru-words";

/**
 * Бегущая строка стран сети — только названия из src/lib/locations.ts
 * (эмодзи-флаги запрещены). Контент продублирован дважды для
 * бесшовной ленты (`.v-marquee` / `.v-marquee-track` из vps.css).
 */
export default function CountryMarquee() {
  const names = LOCATIONS.map((l) => l.country);
  const track = [...names, ...names];
  return (
    <div className="vh-countries">
      <p className="vh-countries-label">
        Серверы в {COUNTRY_COUNT} {plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}
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
