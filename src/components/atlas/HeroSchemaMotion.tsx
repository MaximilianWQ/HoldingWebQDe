"use client";

import { useEffect, useRef } from "react";

/**
 * Живой слой иллюстрации первого экрана («Схема», HeroSchema):
 *   · за рукой: положение указателя (−1…1) пишется в --px/--py сцены
 *     раз в кадр и только пока рука движется; слои сдвигаются на свою
 *     глубину (--depth) — CSS, со сглаживанием transition;
 *   · вне кадра: CSS-анимации сцены встают (data-paused), пакеты на
 *     проводах (SMIL) — pauseAnimations();
 *   · reduced-motion и ?static=1: конечный кадр, пакеты не бегут.
 * За рукой — только на точном указателе: палец двигает страницу, а не сцену.
 */
export default function HeroSchemaMotion() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = ref.current?.closest<HTMLElement>(".a-hs-host");
    if (!host) return;
    const svgs = [...host.querySelectorAll<SVGSVGElement>("svg")];
    const root = document.documentElement;
    if (root.hasAttribute("data-static") || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      host.setAttribute("data-still", "");
      svgs.forEach((s) => s.pauseAnimations?.());
      return;
    }

    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        host.removeAttribute("data-paused");
        svgs.forEach((s) => s.unpauseAnimations?.());
      } else {
        host.setAttribute("data-paused", "");
        svgs.forEach((s) => s.pauseAnimations?.());
      }
    });
    io.observe(host);

    let raf = 0;
    let x = 0;
    let y = 0;
    const write = () => {
      raf = 0;
      host.style.setProperty("--px", x.toFixed(3));
      host.style.setProperty("--py", y.toFixed(3));
    };
    const move = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth) * 2 - 1;
      y = (e.clientY / window.innerHeight) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(write);
    };
    const fine = matchMedia("(pointer: fine)").matches;
    if (fine) window.addEventListener("pointermove", move, { passive: true });

    return () => {
      io.disconnect();
      if (fine) window.removeEventListener("pointermove", move);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <span ref={ref} hidden />;
}
