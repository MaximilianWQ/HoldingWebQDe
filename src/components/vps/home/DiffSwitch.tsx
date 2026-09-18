"use client";

import { useEffect, useRef, useState } from "react";

interface Row { what: string; was: string; now: string }

/**
 * «Знакомо?» — четыре бытовые ситуации до и после.
 *
 * ПОРЯДОК ВАЖНЕЕ АНИМАЦИИ (владелец, 18.09.2026). Раньше блок
 * переключался в «после» сразу, как только попадал в кадр: человек
 * читал заголовок «Знакомо? Так быть не должно» и видел под ним
 * «видео запускается сразу» — то есть узнавания, ради которого блок
 * и существует, не происходило вовсе.
 *
 * Теперь при появлении в кадре блок ДЕРЖИТ состояние «без Atlas»
 * (`HOLD_MS`) — ровно столько, чтобы прочитать свою проблему, — и
 * только потом переключается сам. Нажатие переключает в любой момент
 * и отменяет автоматический показ: дальше рычаг принадлежит читателю.
 */
const HOLD_MS = 1600;
const ROWS: Row[] = [
  { what: "Видео", was: "долго грузится и встаёт на паузу", now: "запускается сразу и идёт без пауз" },
  { what: "Сайты и приложения", was: "открываются через раз", now: "открываются сразу и целиком" },
  { what: "Игры и созвоны", was: "звук отстаёт, картинка дёргается", now: "звук и картинка идут ровно" },
  { what: "Wi-Fi в кафе и отеле", was: "чужие могут видеть, что вы открываете", now: "всё, что вы открываете, зашифровано" },
];

export default function DiffSwitch() {
  const [on, setOn] = useState(false);
  const triggered = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let timer = 0;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || triggered.current || !mounted) return;
        triggered.current = true;
        timer = window.setTimeout(() => { if (mounted) setOn(true); }, HOLD_MS);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => { mounted = false; window.clearTimeout(timer); io.disconnect(); };
  }, []);

  return (
    <div className="vh-diff" data-on={on ? "" : undefined} ref={rootRef}>
      <div className="vh-diff-head">
        <button type="button" className="vh-diff-switch" aria-pressed={on} onClick={() => { triggered.current = true; setOn((v) => !v); }}>
          <span className="vh-switch-track" aria-hidden><span className="vh-switch-thumb" /></span>
          <span className="vh-switch-label">{on ? "С Atlas Secure" : "Без Atlas Secure"}</span>
        </button>
      </div>
      <ul className="vh-diff-list">
        {ROWS.map((r) => (
          <li key={r.what} className="vh-diff-row">
            <b>{r.what}</b>
            <span className="vh-diff-state">
              <span className="vh-diff-was" aria-hidden={on}>{r.was}</span>
              <span className="vh-diff-now" aria-hidden={!on}>{r.now}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
