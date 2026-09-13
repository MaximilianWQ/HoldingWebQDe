"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/**
 * Петля из Blender на странице — общий проигрыватель для первого экрана
 * (HeroReel) и глобуса стран (раздел 03).
 *
 * СТОИМОСТЬ.
 *   · Видео не грузится, пока блок далеко от кадра. У первого экрана
 *     (`eager`) — сразу после монтирования: оно и есть элемент LCP
 *     (замер 13.09.2026), откладывать его нельзя. До готовности на месте
 *     плоская заглушка, видео появляется плавно, когда может играть.
 *   · Играет только в кадре и во видимой вкладке.
 *   · reduced-motion, режим экономии трафика и ?static=1 — видео нет,
 *     остаётся неподвижный постер того же кадра.
 */
type Props = {
  webm: string;
  mp4: string;
  poster: string;
  className: string;
  /** Грузить сразу после монтирования (первый экран, элемент LCP). */
  eager?: boolean;
  /** Скорость воспроизведения: меньше 1 — спокойнее, без перерендера. */
  rate?: number;
};

export default function Reel({ webm, mp4, poster, className, eager = false, rate = 1 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const host = box.current;
    const v = vid.current;
    if (!host || !v) return;
    const root = document.documentElement;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const still =
      root.hasAttribute("data-static") ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      nav.connection?.saveData === true;

    if (still) {
      host.setAttribute("data-mode", "poster");
      return;
    }

    let loaded = false;
    let inView = false;
    // Видео не пошло (ошибка сети, режим энергосбережения iOS запрещает
    // автозапуск) — вместо пустого места неподвижный кадр той же сцены.
    const toPoster = () => {
      if (host.getAttribute("data-mode") !== "video") host.setAttribute("data-mode", "poster");
    };
    const play = () => {
      if (loaded && inView && !document.hidden) v.play().catch(toPoster);
    };
    const load = () => {
      if (loaded) return;
      loaded = true;
      v.src = v.canPlayType('video/webm; codecs="vp9"') ? webm : mp4;
      v.load();
    };
    const onReady = () => {
      v.playbackRate = rate;
      host.setAttribute("data-mode", "video");
      play();
    };
    v.addEventListener("canplay", onReady, { once: true });
    v.addEventListener("error", toPoster, { once: true });
    // Загрузка началась, а играть видео так и не может — постер через 4 с.
    let slow = 0;
    const armSlow = () => {
      slow = window.setTimeout(() => {
        if (host.getAttribute("data-mode") !== "video") toPoster();
      }, 4000);
    };
    v.addEventListener("loadstart", armSlow, { once: true });

    // Подгрузка — за экран до блока; игра — только когда он в кадре.
    const near = new IntersectionObserver(([e]) => e.isIntersecting && load(), { rootMargin: "100% 0px" });
    const seen = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView) play();
      else v.pause();
    });
    near.observe(host);
    seen.observe(host);
    const onVis = () => (document.hidden ? v.pause() : play());
    document.addEventListener("visibilitychange", onVis);

    // Первый экран — сразу после монтирования: замер 13.09.2026 показал,
    // что это видео и есть элемент LCP, а ожидание свободного времени
    // (до 1,5 с) давало ~0,9 с «задержки загрузки» из 1,66 с LCP.
    if (eager) load();

    return () => {
      near.disconnect();
      seen.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      v.removeEventListener("canplay", onReady);
      v.removeEventListener("error", toPoster);
      v.removeEventListener("loadstart", armSlow);
      window.clearTimeout(slow);
      v.pause();
    };
  }, [webm, mp4, eager, rate]);

  return (
    <div ref={box} className={className} style={{ "--poster": `url("${poster}")` } as CSSProperties} aria-hidden>
      <div className="a-reel-move">
        <video ref={vid} className="a-reel-video" muted loop playsInline preload="none" poster={poster} />
      </div>
    </div>
  );
}
