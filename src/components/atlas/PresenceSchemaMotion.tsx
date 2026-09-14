"use client";

import { useEffect, useRef } from "react";
import { LOCATIONS, SERVER_POINTS } from "@/lib/locations";

/**
 * Живой слой карты присутствия (раздел 03, PresenceSchema).
 *   · вход в кадр — провода прочерчиваются (data-in, один раз);
 *   · вне кадра — пульс и пакеты встают (data-paused, pauseAnimations);
 *   · ближайший к читателю город — по часовому поясу браузера: известные
 *     пояса — координатами города, остальные — долгота по смещению от
 *     UTC и широта по части света; сервер показал ближайшую точку сети,
 *     здесь подпись и подсветка уточняются;
 *   · регионы — нажатие на пилюлю закрепляет подсветку её стран
 *     (aria-pressed), повторное нажатие снимает; наведение и фокус
 *     подсвечивают без скрипта (home-map.css, :has()).
 * reduced-motion и ?static=1 — провода сразу прочерчены, пакеты не бегут.
 */
type Node = { id: string; code: string; city: string; px: number; py: number; x: number; y: number };

/** Координаты крупных городов для часовых поясов, где живут наши читатели. */
const TZ_AT: Record<string, [number, number]> = {
  "Europe/Moscow": [55.75, 37.62], "Europe/Minsk": [53.9, 27.56], "Europe/Kiev": [50.45, 30.52], "Europe/Kyiv": [50.45, 30.52],
  "Europe/Samara": [53.2, 50.15], "Europe/Volgograd": [48.71, 44.51], "Europe/Kaliningrad": [54.71, 20.51],
  "Asia/Yekaterinburg": [56.84, 60.6], "Asia/Omsk": [54.99, 73.37], "Asia/Novosibirsk": [55.03, 82.92],
  "Asia/Krasnoyarsk": [56.01, 92.87], "Asia/Irkutsk": [52.29, 104.28], "Asia/Vladivostok": [43.12, 131.9],
  "Asia/Almaty": [43.24, 76.89], "Asia/Tashkent": [41.3, 69.24], "Asia/Bishkek": [42.87, 74.59],
  "Asia/Tbilisi": [41.72, 44.79], "Asia/Yerevan": [40.18, 44.51], "Asia/Baku": [40.41, 49.87],
  "Europe/Istanbul": [41.01, 28.98], "Asia/Dubai": [25.2, 55.27], "Europe/Berlin": [52.52, 13.4],
  "Europe/London": [51.5, -0.12], "Europe/Paris": [48.86, 2.35], "America/New_York": [40.71, -74],
  "America/Los_Angeles": [34.05, -118.24], "Asia/Tokyo": [35.68, 139.69], "Asia/Shanghai": [31.23, 121.47],
  "Asia/Singapore": [1.29, 103.85],
};

function visitorAt(): [number, number] | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (TZ_AT[tz]) return TZ_AT[tz];
    const lon = (-new Date().getTimezoneOffset() / 60) * 15;
    const lat = tz.startsWith("Europe/") ? 50 : tz.startsWith("Asia/") ? 35 : tz.startsWith("America/") ? 38 : tz.startsWith("Africa/") ? 5 : tz.startsWith("Australia/") ? -30 : 45;
    return [lat, lon];
  } catch {
    return null;
  }
}

/** Расстояние по большому кругу, км. */
function km(a: [number, number], b: [number, number]): number {
  const r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r;
  const dLon = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export default function PresenceSchemaMotion({ nodes }: { nodes: Node[] }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const panel = ref.current?.closest<HTMLElement>(".a-pm-panel");
    if (!panel) return;
    const svgs = [...panel.querySelectorAll<SVGSVGElement>("svg")];
    const pills = [...panel.querySelectorAll<HTMLButtonElement>("[data-pill]")];

    // Ближайший город по часовому поясу.
    const at = visitorAt();
    if (at) {
      let best = nodes[0];
      let bestKm = Infinity;
      for (const n of nodes) {
        const s = SERVER_POINTS.find((p) => p.city === n.city);
        if (!s) continue;
        const d = km(at, [s.lat, s.lon]);
        if (d < bestKm) {
          bestKm = d;
          best = n;
        }
      }
      const stage = panel.querySelector<HTMLElement>(".a-pm-stage");
      const label = panel.querySelector<HTMLElement>(".a-pm-near");
      const name = panel.querySelector<HTMLElement>("[data-near-name]");
      const country = LOCATIONS.find((l) => l.code === best.code)?.country ?? "";
      if (stage && label && name) {
        // Подпись и линия-указатель читают --nxv/--nyv (доли рамки, home-map.css).
        stage.style.setProperty("--nxv", best.px.toFixed(2));
        stage.style.setProperty("--nyv", best.py.toFixed(2));
        const side = best.px > 62 ? "end" : best.px < 18 ? "start" : "";
        if (side) label.setAttribute("data-side", side);
        else label.removeAttribute("data-side");
        name.textContent = `${country}, ${best.city}`;
      }
      panel.querySelectorAll("[data-near]").forEach((e) => e.removeAttribute("data-near"));
      panel.querySelectorAll(`[data-id="${best.id}"]`).forEach((e) => e.setAttribute("data-near", ""));
    }

    // Закрепление региона по нажатию.
    const onPill = (e: Event) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-pill]");
      if (!b) return;
      const r = b.dataset.pill ?? "";
      const next = panel.dataset.region === r ? "" : r;
      panel.dataset.region = next;
      pills.forEach((p) => p.setAttribute("aria-pressed", String(p.dataset.pill === next && next !== "")));
    };
    panel.addEventListener("click", onPill);

    const root = document.documentElement;
    if (root.hasAttribute("data-static") || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panel.setAttribute("data-still", "");
      panel.setAttribute("data-in", "");
      svgs.forEach((s) => s.pauseAnimations?.());
      return () => panel.removeEventListener("click", onPill);
    }

    // Провода прочерчиваются при первом входе; вне кадра — пауза.
    panel.setAttribute("data-armed", "");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          panel.setAttribute("data-in", "");
          panel.removeAttribute("data-paused");
          svgs.forEach((s) => s.unpauseAnimations?.());
        } else {
          panel.setAttribute("data-paused", "");
          svgs.forEach((s) => s.pauseAnimations?.());
        }
      },
      { threshold: 0.2 },
    );
    io.observe(panel);

    return () => {
      io.disconnect();
      panel.removeEventListener("click", onPill);
    };
  }, [nodes]);

  return <span ref={ref} hidden />;
}
