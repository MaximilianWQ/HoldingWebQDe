"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * 06 — ноутбук открывается по прокрутке (владелец, 11.09.2026: «хочу,
 * чтобы при прокрутке открывался MacBook»).
 *
 * Кадры из Blender (сцена «AtlasLaptop», public/media/laptop/f000…f119.webp)
 * перелистываются прокруткой, как на сайтах Apple. Прогресс: если раздел
 * с [data-scrub] закреплён (выше полутора окон) — прокрутка раздела; иначе
 * (телефон) — проход ноутбука через окно.
 *
 * ПЛАВНОСТЬ (12.09.2026, «прокрутку намного мягче»). Кадр не прыгает за
 * колесом: показанное открытие догоняет прокрутку по экспоненте, а между
 * соседними кадрами идёт перетекание (второй кадр поверх с долей), так
 * что 120 кадров читаются как непрерывное движение. Открытие занимает
 * середину закрепления (OPEN_FROM…OPEN_TO): сначала заливается заголовок,
 * в конце — свечение экрана и платформы. Доля открытия пишется в
 * `--open` (0…1) — от неё в CSS подъём ноутбука и свечение под экраном.
 *
 * СТОИМОСТЬ. Кадры грузятся за полтора экрана до блока и декодируются
 * заранее (img.decode); цикл rAF крутится только пока открытие догоняет
 * прокрутку. reduced-motion, экономия трафика и ?static=1 — только постер
 * (открытый ноутбук).
 */
const N = 120;
const OPEN_FROM = 0.1;
const OPEN_TO = 0.7;
const frameSrc = (k: number) => `/media/laptop/f${String(k).padStart(3, "0")}.webp`;
const POSTER = "/media/laptop/poster.jpg";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function LaptopScrub({ className }: { className: string }) {
  const box = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = box.current;
    const canvas = cv.current;
    if (!host || !canvas) return;
    const root = document.documentElement;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const still =
      root.hasAttribute("data-static") ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      nav.connection?.saveData === true;
    const ctx = canvas.getContext("2d");
    if (still || !ctx) {
      host.setAttribute("data-mode", "poster");
      return;
    }

    const frames: (HTMLImageElement | undefined)[] = new Array(N);
    const pin = host.closest<HTMLElement>("[data-scrub]");
    let started = false;
    let shown = -1; // показанная доля открытия; −1 — ещё не рисовали
    let dirty = true;
    let raf = 0;
    let last = 0;

    const target = () => {
      const vh = window.innerHeight;
      if (pin && pin.offsetHeight > vh * 1.5) {
        const r = pin.getBoundingClientRect();
        const p = -r.top / Math.max(1, r.height - vh);
        return clamp01((p - OPEN_FROM) / (OPEN_TO - OPEN_FROM));
      }
      const r = host.getBoundingClientRect();
      // Телефон: открыт, когда верх ноутбука дошёл до середины окна.
      // Прежде (0,9 → 0,25 окна) он оставался закрытым почти до верха
      // экрана — «появляется поздно, мелко и внизу» (аудит 13.09.2026).
      return clamp01((vh * 0.95 - r.top) / (vh * 0.45));
    };
    // Ближайший уже загруженный кадр — чтобы на медленной сети не было дыр.
    const nearest = (k: number) => {
      for (let d = 0; d < N; d++) {
        if (frames[k - d]) return k - d;
        if (frames[k + d]) return k + d;
      }
      return -1;
    };
    const paint = (p: number) => {
      const f = p * (N - 1);
      const a = nearest(Math.floor(f));
      if (a < 0) return;
      const b = nearest(Math.min(N - 1, Math.ceil(f)));
      const mix = f - Math.floor(f);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.drawImage(frames[a] as HTMLImageElement, 0, 0, w, h);
      if (b >= 0 && b !== a && mix > 0.02) {
        ctx.globalAlpha = mix;
        ctx.drawImage(frames[b] as HTMLImageElement, 0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      host.style.setProperty("--open", p.toFixed(4));
      if (!host.hasAttribute("data-mode")) host.setAttribute("data-mode", "scrub");
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const t = target();
      // Первый кадр — сразу в позицию; дальше догоняем (~0,16 с до 90%):
      // колесо уже сглажено Lenis, вторая доводка — лёгкая, для сенсора.
      const next = shown < 0 ? t : shown + (t - shown) * (1 - Math.exp(-dt * 14));
      const settled = Math.abs(t - next) < 0.0015;
      const p = settled ? t : next;
      if (p !== shown || dirty) {
        shown = p;
        dirty = false;
        paint(p);
      }
      if (!settled) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const tick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const size = () => {
      // Размер раскладки, а не getBoundingClientRect: у ноутбука есть
      // transform (подъём по --open), он не должен менять разрешение холста.
      const d = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(host.clientWidth * d));
      canvas.height = Math.max(1, Math.round(host.clientHeight * d));
      dirty = true;
      tick();
    };
    const load = () => {
      if (started) return;
      started = true;
      // Первый и последний кадры — вперёд: есть что показать сразу.
      const order = [0, N - 1, ...Array.from({ length: N - 2 }, (_, i) => i + 1)];
      for (const k of order) {
        const img = new Image();
        img.decoding = "async";
        img.src = frameSrc(k);
        img
          .decode()
          .then(() => {
            frames[k] = img;
            dirty = true;
            tick();
          })
          .catch(() => {});
      }
    };

    // 0,6 экрана до блока, а не полтора: 120 кадров (~1,6 МБ) иначе
    // забирали канал у первого экрана на медленной сети (замер 13.09.2026).
    const io = new IntersectionObserver(([e]) => e.isIntersecting && load(), { rootMargin: "60% 0px" });
    io.observe(host);
    const ro = new ResizeObserver(size);
    ro.observe(host);
    window.addEventListener("scroll", tick, { passive: true });
    size();

    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", tick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={box} className={className} style={{ "--poster": `url("${POSTER}")` } as CSSProperties} aria-hidden>
      <canvas ref={cv} />
    </div>
  );
}
