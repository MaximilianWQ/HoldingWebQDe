"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { mountStage } from "./gl/stage";
import type { Composition, HeroLive } from "./gl/hero";

/**
 * Мягкая 3D-сцена реального времени в любом блоке главной (three.js,
 * WebGPU с уходом на WebGL 2). Сцена — `gl/hero.ts`: "mission-soft"
 * (раздел 07).
 *
 * БЛОК. Нужны только размер и `position` (класс или `style`, обычно
 * `{ position: "absolute", inset: 0 }` внутри обёртки с размером):
 * постер и холст лежат в нём слоями, сцена меряет его сама.
 *
 * ПОСТЕР — `<img>` из разметки сервера. Он снят с этой же сцены в покое
 * (t = 0) и вписан в блок так же, как кадр камеры (`object-fit: contain`,
 * `object-position` из `--hx-ox/--hx-oy`, по умолчанию центр), поэтому
 * смена постера на холст не видна: она мгновенная, в одном кадре
 * (плавная смена удваивала тени). reduced-motion, ?static=1, экономия
 * трафика, нет WebGL — только постер, three.js не грузится (`gl/stage.ts`).
 *
 * ПРОКРУТКА. Пока любая часть блока в кадре, сцена непрозрачна и стоит
 * на месте — растворения при уходе раздела нет (владелец, 14.09.2026:
 * сцена на 16 % при почти целиком видимом блоке читалась «белой дырой»).
 * Целиком вне кадра — цикл отрисовки встаёт (`gl/stage.ts`).
 */
export interface HeroPoster {
  src: string;
  srcSet: string;
  sizes: string;
  w: number;
  h: number;
}

interface Props {
  composition: Composition;
  poster: HeroPoster;
  className?: string;
  style?: CSSProperties;
}

export default function HeroGL({ composition, poster, className, style }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const h = host.current;
    const c = cvs.current;
    if (!h || !c) return;
    const readAlign = (): [number, number] => {
      const cs = getComputedStyle(h);
      const n = (v: string, d: number) => {
        const x = parseFloat(v);
        return Number.isFinite(x) ? x : d;
      };
      return [n(cs.getPropertyValue("--hx-ox"), 0.5), n(cs.getPropertyValue("--hx-oy"), 0.5)];
    };
    // Смена постера на холст — здесь, мгновенно, в одном кадре, без CSS
    // страницы: stage.ts ставит data-mode="gl", когда собран первый кадр.
    const poster = () => h.querySelector<HTMLImageElement>(".a-reel-poster");
    const swap = () => {
      if (h.dataset.mode !== "gl") return;
      c.style.transition = "none";
      c.style.opacity = "1";
      const img = poster();
      if (img) img.style.visibility = "hidden";
    };
    const mo = new MutationObserver(swap);
    mo.observe(h, { attributes: true, attributeFilter: ["data-mode"] });
    // Тот же object-position, что у постера: читается при каждой
    // перекладке холста.
    const live: HeroLive = { align: readAlign };
    const unmount = mountStage(h, c, {
      scene: () => import("./gl/hero").then((m) => m.makeHero(live, composition)),
      hasPoster: true,
      budget: 60_000,
      // Блок небольшой — резкость по DPR до 2 дешёвая; адаптивный DPR в
      // stage.ts снижает, если кадры пропускаются.
      maxDpr: 2,
      // Кадрирование делает сама сцена (`frame` в gl/hero.ts).
      place: () => ({ cx: 0.5, cy: 0.5, r: 1 }),
    });
    return () => {
      mo.disconnect();
      c.style.opacity = "";
      const img = poster();
      if (img) img.style.visibility = "";
      unmount();
    };
  }, [composition]);

  return (
    <div ref={host} className={className} style={style} aria-hidden>
      {/* Обычный <img> из разметки сервера, высокий приоритет. */}
      <img
        className="a-reel-poster"
        src={poster.src}
        srcSet={poster.srcSet}
        sizes={poster.sizes}
        alt=""
        width={poster.w}
        height={poster.h}
        fetchPriority="high"
        draggable={false}
      />
      <canvas ref={cvs} className="a-reel-canvas" />
    </div>
  );
}
