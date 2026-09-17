"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/pixel/Icon";

/**
 * Карусель карточек: родная прокрутка со scroll-snap (свайп на телефоне),
 * стрелки по бокам и точки снизу. Без библиотек; активная точка
 * считается по ближайшей к центру карточке.
 */
export default function Carousel({ children, label, initial = 0 }: { children: ReactNode; label: string; initial?: number }) {
  const track = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const [active, setActive] = useState(initial);
  const [edges, setEdges] = useState({ start: true, end: items.length <= 1 });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    kids.forEach((k, i) => {
      const d = Math.abs(k.offsetLeft + k.offsetWidth / 2 - mid);
      if (d < dist) { dist = d; best = i; }
    });
    setActive(best);
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  }, []);

  const go = useCallback((i: number) => {
    const el = track.current;
    const kid = el?.children[i] as HTMLElement | undefined;
    if (!el || !kid) return;
    el.scrollTo({ left: kid.offsetLeft - (el.clientWidth - kid.offsetWidth) / 2, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    if (initial > 0) {
      const kid = el.children[initial] as HTMLElement | undefined;
      if (kid) el.scrollLeft = kid.offsetLeft - (el.clientWidth - kid.offsetWidth) / 2;
    }
    measure();
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, [measure, initial]);

  return (
    <div className="v-carousel" role="region" aria-roledescription="карусель" aria-label={label}>
      <button type="button" className="v-car-arrow v-car-prev" aria-label="Назад" disabled={edges.start} onClick={() => go(Math.max(0, active - 1))}>
        <Icon name="chevron-left" size={28} />
      </button>
      <div className="v-track" ref={track}>
        {items}
      </div>
      <button type="button" className="v-car-arrow v-car-next" aria-label="Вперёд" disabled={edges.end} onClick={() => go(Math.min(items.length - 1, active + 1))}>
        <Icon name="chevron-right" size={28} />
      </button>
      {items.length > 1 ? (
        <div className="v-dots">
          {items.map((_, i) => (
            <button key={i} type="button" aria-label={`Карточка ${i + 1} из ${items.length}`} aria-current={i === active} onClick={() => go(i)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
