"use client";

import { useEffect, useRef, useState } from "react";

interface Row { what: string; was: string; now: string }

/** Перенос идеи прежней главной (Atlas, раздел 02 «что меняется, когда
 *  включено»): большой переключатель переводит бытовые ситуации из
 *  «без» в «с» — по прокрутке (в первый раз, когда блок появляется в
 *  кадре) и по нажатию. Без слова «VPN» — только польза. */
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      triggered.current = true;
      // Кадр покоя сразу конечный — без промежуточного «выключено».
      Promise.resolve().then(() => { if (mounted) setOn(true); });
      return () => { mounted = false; };
    }
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current && mounted) {
          triggered.current = true;
          setOn(true);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => { mounted = false; io.disconnect(); };
  }, []);

  return (
    <div className="vh-diff" data-on={on ? "" : undefined} ref={rootRef}>
      <div className="vh-diff-head">
        <button type="button" className="vh-diff-switch" aria-pressed={on} onClick={() => { triggered.current = true; setOn((v) => !v); }}>
          <span className="vh-switch-track" aria-hidden><span className="vh-switch-thumb" /></span>
          <span className="vh-switch-label">{on ? "Включено" : "Выключено"}</span>
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
