"use client";

import { useEffect, useRef } from "react";
import { mountStage } from "./gl/stage";
import type { HeroLive } from "./gl/hero";

/**
 * Фон первого экрана — объёмные формы в реальном времени (three.js,
 * WebGPU с уходом на WebGL 2): кобальтовое кольцо-канал, сквозь которое
 * летят хромированные капсулы, керамические и стеклянная сферы,
 * ступенчатая шайба. Сцена — `gl/hero.ts`.
 *
 * Прежде здесь играла петля из Blender (30 fps, сцена «AtlasObjects»).
 * Владелец: «видео 30 fps — резко», «120 фпс анимации нужны». Теперь
 * кадр рисуется на частоте экрана, движение идёт по реальному времени.
 *
 * ПЕРВЫЙ КАДР — постер `<img>` из разметки сервера: он элемент LCP и не
 * ждёт ни скрипта, ни three.js. Сцена грузится отдельным чанком и
 * сменяет постер плавно, когда собран первый кадр (`data-mode="gl"`).
 * reduced-motion, ?static=1, экономия трафика, нет WebGL — остаётся
 * постер (`data-mode="poster"`).
 *
 * Жизнь: сцена сама идёт за рукой (сглаживание в `stage.ts`) и «ныряет»
 * при уходе первого экрана — камера подходит к формам (прогресс ухода
 * считает этот компонент, сцена сглаживает его по времени). Постер
 * делает то же в CSS: --px/--py от PointerDrift и шкала `view()`
 * (atlas.css, 6.6).
 */
export const POSTER = "/media/hero-objects.jpg";

/** Кадр постера, px. Сцена `hero.ts` разложена в тех же пропорциях: 16 × 9 единиц. */
const FRAME_W = 1600;
const FRAME_H = 900;
/** Единиц сцены на ширину кадра — `FRAME_UNITS` в `gl/hero.ts`. */
const FRAME_UNITS = 16;
/** Радиус описанной сферы сцены — `radius` в `gl/hero.ts`. */
const RADIUS = 6;
const FOV = 30;

export default function HeroGL() {
  const host = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);
  const live = useRef<HeroLive>({ dive: 0 });

  // Доля ухода первого экрана — та же шкала, что `animation-range: exit`
  // у постера: 0, пока блок целиком в кадре, 1, когда ушёл за верх.
  // Читается по событию прокрутки, не каждый кадр; сцена сглаживает.
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    const read = () => {
      const r = h.getBoundingClientRect();
      const vh = window.innerHeight;
      const tall = r.height > vh;
      const start = tall ? r.bottom - vh : r.top;
      const len = tall ? vh : r.height;
      live.current.dive = Math.min(1, Math.max(0, -start / Math.max(1, len)));
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  useEffect(() => {
    const h = host.current;
    const c = cvs.current;
    if (!h || !c) return;
    const liveRef = live.current;
    const wide = matchMedia("(min-width: 720px)").matches;
    const half = (FOV * Math.PI) / 360;
    return mountStage(h, c, {
      scene: () => import("./gl/hero").then((m) => m.makeHero(liveRef)),
      hasPoster: true,
      budget: 60_000,
      fov: FOV,
      // Холст во весь первый экран: на широком DPR не выше 1,5 — формы
      // мягкие, а частота кадров важнее резкости (адаптивный DPR в
      // stage.ts снижает дальше, если кадры пропускаются).
      maxDpr: wide ? 1.5 : 2,
      // Кадрирование как у постера (object-fit: cover): на широком кадр
      // шире блока на 8 % (inset −4 % у .a-reel-move), на телефоне — вровень.
      place: (w, hh) => {
        const k = matchMedia("(max-width: 719px)").matches ? 1 : 1.08;
        const scale = Math.max((w * k) / FRAME_W, (hh * k) / FRAME_H);
        const unit = (scale * FRAME_W) / FRAME_UNITS; // px на единицу сцены в плоскости z = 0
        const s = Math.min(0.95, (unit * RADIUS * Math.tan(half)) / (hh / 2));
        return { cx: 0.5, cy: 0.5, r: ((hh / 2) * Math.tan(Math.asin(s))) / Math.tan(half) };
      },
    });
  }, []);

  return (
    <div ref={host} className="a-reel" aria-hidden>
      <div className="a-reel-move">
        {/* Элемент LCP: обычный <img> из разметки сервера, высокий приоритет. */}
        <img
          className="a-reel-poster"
          src={POSTER}
          alt=""
          width={FRAME_W}
          height={FRAME_H}
          fetchPriority="high"
          draggable={false}
        />
      </div>
      <canvas ref={cvs} className="a-reel-canvas" />
    </div>
  );
}
