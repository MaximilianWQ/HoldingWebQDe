"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/pixel/Icon";
import {
  PLAYABLE,
  RACK_SLOTS,
  RACK_UNITS,
  rackSrc,
  unitTop,
  type RackUnit,
} from "./rack-data";
import { startHum, type Hum } from "./rack-hum";

/**
 * Доска мини-игры «Соберите свой дата-центр».
 *
 * СЛОВАРЬ ЭТОТ КОМПОНЕНТ НЕ ИМПОРТИРУЕТ. Подписи приходят пропсами от
 * серверной обёртки: один импорт из `@/i18n` в клиентском файле утянул
 * бы в браузер оба словаря — замер по проекту даёт 240 КБ на двенадцати
 * маршрутах и 292 КБ в кабинете.
 *
 * ПОЧЕМУ БЕЗ ПЕРЕТАСКИВАНИЯ. Одно нажатие — модуль встаёт на своё
 * место; ещё одно по гнезду — провод дорастает сам. Перетаскивание
 * требовало бы равноценной альтернативы по WCAG 2.5.7 и на сенсоре
 * работает плохо; мы сразу делаем ту альтернативу единственным путём.
 *
 * ПОЧЕМУ ОГНИ РИСУЕТ РАЗМЕТКА, А НЕ КАРТИНКА. Состояний у огонька
 * четыре; четыре кадра на модуль — четырёхкратный вес набора. Кроме
 * того, `prefers-reduced-motion` в корпусе `v-` гасит анимацию через
 * `!important`, и состояние внутри картинки показать было бы нечем, а
 * скринридеру — нечего прочесть.
 */

export interface RackCopy {
  how: string;
  rackLabel: string;
  shelfLabel: string;
  slotEmpty: string;
  slotFilled: string;
  count: string;
  place: string;
  placed: string;
  connect: string;
  connected: string;
  auto: string;
  start: string;
  running: string;
  sound: string;
  soundHint: string;
  names: Record<string, string>;
  hints: Record<string, string>;
  done: { title: string; text: string; bullets: string[]; cta: string; again: string };
}

type Phase = "idle" | "running";

interface State {
  /** Ключи поставленных модулей. */
  placed: string[];
  /** Ключи подключённых. */
  wired: string[];
  phase: Phase;
}

const EMPTY: State = { placed: [], wired: [], phase: "idle" };

/** Модули, которым нужен провод. */
const NEEDS_WIRE = PLAYABLE.filter((u) => u.port).map((u) => u.id);

function nextStep(s: State): { kind: "place" | "wire" | "start"; id?: string } | null {
  for (const u of PLAYABLE) {
    if (!s.placed.includes(u.id)) return { kind: "place", id: u.id };
    if (u.port && !s.wired.includes(u.id)) return { kind: "wire", id: u.id };
  }
  return s.phase === "idle" ? { kind: "start" } : null;
}

export default function RackGameBoard({ copy, ctaHref }: { copy: RackCopy; ctaHref: string }) {
  const [s, setS] = useState<State>(EMPTY);
  const [soundOn, setSoundOn] = useState(false);
  const [auto, setAuto] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const humRef = useRef<Hum | null>(null);

  const total = PLAYABLE.length + NEEDS_WIRE.length;
  const doneCount = s.placed.length + s.wired.length;
  const step = nextStep(s);
  const finished = s.phase === "running";

  // Гул. Контекст создаётся ТОЛЬКО внутри обработчика нажатия —
  // иначе браузер отдаст его в состоянии suspended и звука не будет.
  const hum = useCallback(() => {
    if (!soundOn) return null;
    if (!humRef.current) humRef.current = startHum();
    return humRef.current;
  }, [soundOn]);

  useEffect(() => {
    const h = humRef.current;
    if (!h) return;
    h.setLoad(finished ? 1 : doneCount / Math.max(1, total));
  }, [doneCount, total, finished]);

  useEffect(() => {
    return () => {
      humRef.current?.stop();
      humRef.current = null;
    };
  }, []);

  // Гул не должен преследовать человека вниз по странице.
  useEffect(() => {
    const el = boardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => humRef.current?.setAudible(e.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const place = (id: string) => {
    setS((p) => (p.placed.includes(id) ? p : { ...p, placed: [...p.placed, id] }));
    hum()?.click();
  };
  const wire = (id: string) => {
    setS((p) => (p.wired.includes(id) ? p : { ...p, wired: [...p.wired, id] }));
    hum()?.click();
  };
  const start = () => {
    setS((p) => ({ ...p, phase: "running" }));
    hum()?.spinUp();
  };
  const reset = () => {
    setS(EMPTY);
    setAuto(false);
    humRef.current?.setLoad(0);
  };

  // «Собрать за меня» — для тех, кто не собирался играть.
  useEffect(() => {
    if (!auto) return;
    const st = nextStep(s);
    if (!st) {
      setAuto(false);
      return;
    }
    const t = setTimeout(() => {
      if (st.kind === "place" && st.id) place(st.id);
      else if (st.kind === "wire" && st.id) wire(st.id);
      else start();
    }, 900);
    return () => clearTimeout(t);
    // place/wire/start стабильны по смыслу; следим за состоянием
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, s]);

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    if (on) {
      humRef.current = humRef.current ?? startHum();
      humRef.current.setAudible(true);
      humRef.current.setLoad(finished ? 1 : doneCount / Math.max(1, total));
    } else {
      humRef.current?.stop();
      humRef.current = null;
    }
    try {
      localStorage.setItem("atlas-rack-sound", on ? "1" : "0");
    } catch {
      /* приватное окно — просто не запомним */
    }
  };

  // Подсказка ведёт по текущему шагу. Когда шагов не осталось —
  // говорит о результате, а не возвращается к первому модулю.
  const hint = finished
    ? copy.running
    : step?.kind === "start"
      ? copy.start
      : copy.hints[step?.id ?? PLAYABLE[0].id] ?? copy.how;

  return (
    <div className="vr" ref={boardRef} data-done={finished ? "" : undefined}>
      <div className="vr-stage">
        <div
          className="vr-rack"
          role="list"
          aria-label={copy.rackLabel.replace("{total}", String(RACK_SLOTS))}
        >
          <img
            className="vr-frame"
            src={rackSrc("rack", 1400)}
            srcSet={`${rackSrc("rack", 700)} 700w, ${rackSrc("rack", 1400)} 1400w`}
            sizes="(min-width: 1100px) 60vw, 92vw"
            alt=""
            width={1400}
            height={881}
            decoding="async"
            draggable={false}
          />

          {RACK_UNITS.map((u) => {
            const shown = u.preset || s.placed.includes(u.id);
            const live = u.preset || finished || s.wired.includes(u.id) || !u.port;
            return (
              <div
                key={u.id}
                role="listitem"
                className="vr-unit"
                data-in={shown ? "" : undefined}
                data-live={shown && live ? "" : undefined}
                style={{
                  top: `calc(${unitTop(u)} * 100cqw)`,
                  height: `calc(${u.frameH / 1400} * 100cqw)`,
                }}
                aria-label={
                  shown
                    ? copy.slotFilled.replace("{name}", copy.names[u.id] ?? u.id)
                    : copy.slotEmpty
                }
              >
                <img
                  src={rackSrc(u.id, 1400)}
                  srcSet={`${rackSrc(u.id, 700)} 700w, ${rackSrc(u.id, 1400)} 1400w`}
                  sizes="(min-width: 1100px) 60vw, 92vw"
                  alt=""
                  width={1400}
                  height={u.frameH}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
                {u.leds.map((l) => (
                  <span
                    key={l.name}
                    className="vr-led"
                    aria-hidden
                    style={{ left: `${l.x * 100}%`, top: `${l.y * 100}%` }}
                  />
                ))}
                {u.port && (
                  <button
                    type="button"
                    className="vr-jack"
                    style={{ left: `${u.port.x * 100}%`, top: `${u.port.y * 100}%` }}
                    data-wired={s.wired.includes(u.id) ? "" : undefined}
                    disabled={!shown || s.wired.includes(u.id)}
                    onClick={() => wire(u.id)}
                    // Дублирует кнопку из списка: в дерево доступности
                    // одна и та же команда попадать дважды не должна.
                    tabIndex={-1}
                    aria-hidden
                  >
                    <span className="vr-jack-dot" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="vr-side">
        <p className="vr-hint" role="status">{hint}</p>

        <p className="vr-count">
          <span className="vr-bar" aria-hidden>
            <span style={{ width: `${(doneCount / total) * 100}%` }} />
          </span>
          {copy.count
            .replace("{done}", String(doneCount))
            .replace("{total}", String(total))}
        </p>

        <ul className="vr-list" aria-label={copy.shelfLabel}>
          {PLAYABLE.map((u: RackUnit) => {
            const isPlaced = s.placed.includes(u.id);
            const isWired = s.wired.includes(u.id);
            const needsWire = Boolean(u.port);
            const ready = isPlaced && (!needsWire || isWired);
            return (
              <li key={u.id} className="vr-row" data-ready={ready ? "" : undefined}>
                <span className="vr-row-name">{copy.names[u.id] ?? u.id}</span>
                {!isPlaced ? (
                  <button type="button" className="v-btn v-btn-sm" onClick={() => place(u.id)}>
                    {copy.place}
                  </button>
                ) : needsWire && !isWired ? (
                  <button
                    type="button"
                    className="v-btn v-btn-sm v-btn-primary"
                    onClick={() => wire(u.id)}
                  >
                    {copy.connect}
                  </button>
                ) : (
                  <span className="vr-ok">
                    <Icon name="check" size={16} />
                    {needsWire ? copy.connected : copy.placed}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="vr-actions">
          {!finished ? (
            <>
              <button
                type="button"
                className="v-btn v-btn-primary"
                disabled={step?.kind !== "start"}
                onClick={start}
              >
                {copy.start}
              </button>
              <button
                type="button"
                className="v-btn v-btn-soft"
                onClick={() => setAuto(true)}
                disabled={auto || step?.kind === "start"}
              >
                {copy.auto}
              </button>
            </>
          ) : (
            <>
              <a className="v-btn v-btn-primary" href={ctaHref}>{copy.done.cta}</a>
              <button type="button" className="v-btn v-btn-soft" onClick={reset}>
                {copy.done.again}
              </button>
            </>
          )}
          <button
            type="button"
            className="vr-sound"
            aria-pressed={soundOn}
            onClick={toggleSound}
          >
            <Icon name={soundOn ? "bell" : "close"} size={16} />
            {copy.sound}
          </button>
        </div>

        {!soundOn && !finished && <p className="vr-note">{copy.soundHint}</p>}

        {finished && (
          <div className="vr-done">
            <h3 className="v-h3">{copy.done.title}</h3>
            <p>{copy.done.text}</p>
            <ul>
              {copy.done.bullets.map((b) => (
                <li key={b}>
                  <Icon name="check" size={16} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
