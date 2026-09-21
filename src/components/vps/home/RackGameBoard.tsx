"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/pixel/Icon";
import {
  FRAME_W,
  FREE_SLOTS,
  PATCH_JACKS,
  PLAYABLE,
  POWER_SWITCHES,
  RACK_H,
  RACK_SLOTS,
  RACK_UNITS,
  UNIT_PER_FRAME,
  anchorInRack,
  rackSrc,
  slotCentre,
  type RackUnit,
} from "./rack-data";
import { makeDragger, near, type DragPoint } from "./rack-drag";
import { startRig, type Rig } from "./rack-hum";

/**
 * Симулятор сборки стойки.
 *
 * ЧЕЛОВЕК ДЕЛАЕТ ВСЁ САМ: тянет модуль мышью в свободное место, тянет
 * штекер с панели в гнездо модуля, щёлкает тумблер питания, жмёт пуск.
 * Ошибётся — стойка уходит в аварию, и её надо ПОЧИНИТЬ, а не начать
 * заново: авария всегда называет причину и всегда лечится одним
 * понятным действием.
 *
 * СЛОВАРЬ ЭТОТ ФАЙЛ НЕ ИМПОРТИРУЕТ — подписи приходят пропсами: один
 * импорт из `@/i18n` в клиентском компоненте утянул бы в браузер оба
 * языка (замер по проекту: 240 КБ на двенадцати маршрутах).
 *
 * У ПЕРЕТАСКИВАНИЯ ЕСТЬ РАВНОЦЕННАЯ ЗАМЕНА, и это не уступка, а
 * требование WCAG 2.5.7: то же действие делается одним нажатием — по
 * детали, потом по цели, — и кнопкой в списке. На телефоне это
 * основной путь, мышью — жест; обе дорожки ведут в одно состояние.
 *
 * ЗВУК НЕ ВКЛЮЧАЕТСЯ САМ. Ни одного звука до того, как человек нажал
 * кнопку звука. Браузеры этого и не позволят, но дело не в них: гул без
 * спроса во вкладке на работе хуже, чем отсутствие гула.
 */

export interface RackCopy {
  how: string;
  howDrag: string;
  rackLabel: string;
  shelfLabel: string;
  slotEmpty: string;
  slotFilled: string;
  count: string;
  place: string;
  placed: string;
  connect: string;
  connected: string;
  pickUp: string;
  dropHere: string;
  start: string;
  running: string;
  powerOn: string;
  powerOff: string;
  sound: string;
  soundHint: string;
  names: Record<string, string>;
  hints: Record<string, string>;
  faults: Record<string, { title: string; fix: string }>;
  done: { title: string; text: string; bullets: string[]; cta: string; again: string };
}

type Phase = "build" | "running" | "fault";
type FaultKind = "noPower" | "unwired" | "unplugged";

interface State {
  /** Ключ модуля → место, куда его поставили. */
  placed: Record<string, number>;
  wired: string[];
  power: boolean;
  phase: Phase;
  fault: { kind: FaultKind; unit?: string } | null;
}

const EMPTY: State = { placed: {}, wired: [], power: false, phase: "build", fault: null };

/**
 * Радиус попадания при броске, в долях ширины кадра. 0,055 — это
 * примерно три четверти высоты юнита: бросок «примерно туда»
 * засчитывается, бросок в соседний модуль — нет.
 */
const SNAP = 0.055;

const WIRED_UNITS = PLAYABLE.filter((u) => u.port);
const PATCH = RACK_UNITS.find((u) => u.id === "patch")!;
const POWER = RACK_UNITS.find((u) => u.id === "power")!;

/** Гнездо на панели, закреплённое за модулем. */
function jackFor(id: string) {
  const i = WIRED_UNITS.findIndex((u) => u.id === id);
  return PATCH_JACKS[i] ?? PATCH_JACKS[0];
}

/** Верх кадра модуля, поставленного в произвольное место. */
function unitTopAt(u: RackUnit, slot: number): number {
  return slotCentre(slot, u.u) - u.frameH / FRAME_W / 2;
}

export default function RackGameBoard({ copy, ctaHref }: { copy: RackCopy; ctaHref: string }) {
  const [s, setS] = useState<State>(EMPTY);
  const [soundOn, setSoundOn] = useState(false);
  /**
   * Выбор человека помнится между визитами. Писали мы его и раньше, а
   * читать забыли — и каждый заход начинался с выключенного звука даже
   * у того, кто его включал.
   *
   * Включаем по памяти только ПОСЛЕ первого жеста на странице: звук
   * без жеста браузер всё равно не пустит, а гул сам по себе при
   * открытии страницы — худшее, что может сделать витрина.
   */
  const remembered = useRef<boolean | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("atlas-rack-sound");
      remembered.current = v === "1" ? true : v === "0" ? false : null;
    } catch {
      remembered.current = null;
    }
  }, []);
  const [drag, setDrag] = useState<
    { kind: "unit" | "plug"; id: string; at: DragPoint; over: number | null } | null
  >(null);
  /** Деталь, взятая одним нажатием: ждёт нажатия по цели. */
  const [held, setHeld] = useState<{ kind: "unit" | "plug"; id: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<Rig | null>(null);

  const total = PLAYABLE.length + WIRED_UNITS.length;
  const doneCount = Object.keys(s.placed).length + s.wired.length;
  const allPlaced = Object.keys(s.placed).length === PLAYABLE.length;
  const running = s.phase === "running";
  const faulted = s.phase === "fault";

  const stage = useCallback(() => stageRef.current, []);
  const rig = () => rigRef.current;

  useEffect(() => {
    rigRef.current?.setLoad(running ? 1 : doneCount / Math.max(1, total));
  }, [doneCount, total, running]);

  useEffect(
    () => () => {
      rigRef.current?.stop();
      rigRef.current = null;
    },
    [],
  );

  // Гул не должен преследовать человека вниз по странице.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => rigRef.current?.setAudible(e.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ─── Действия ───────────────────────────────────────────────────

  const freeSlots = FREE_SLOTS.filter((n) => !Object.values(s.placed).includes(n));

  const placeAt = (id: string, slot: number) => {
    setS((p) => ({ ...p, placed: { ...p.placed, [id]: slot } }));
    rig()?.slideIn();
  };

  const wireUp = (id: string) => {
    setS((p) => {
      if (p.wired.includes(id)) return p;
      const wired = [...p.wired, id];
      // Авария гаснет сама, когда устранена её причина. Кнопки
      // «починить» в симуляторе нет принципиально: она бы отменяла
      // аварию, а не чинила её, и человек не понял бы, что было не так.
      const fixed = p.fault?.unit === id;
      return {
        ...p,
        wired,
        phase: fixed ? "build" : p.phase,
        fault: fixed ? null : p.fault,
      };
    });
    rig()?.latch();
    if (s.fault?.unit === id) rig()?.recover();
  };

  const unplug = (id: string) => {
    const wasRunning = s.phase === "running";
    setS((p) => ({
      ...p,
      wired: p.wired.filter((w) => w !== id),
      // Выдернуть провод у работающей стойки — это авария, а не отмена
      // действия: машина теряет связь с миром, и это надо увидеть.
      phase: wasRunning ? "fault" : p.phase,
      fault: wasRunning ? { kind: "unplugged", unit: id } : p.fault,
    }));
    if (wasRunning) rig()?.alarm();
    else rig()?.reject();
  };

  const togglePower = () => {
    setS((p) => {
      const power = !p.power;
      if (!power && p.phase === "running") {
        return { ...p, power, phase: "fault", fault: { kind: "noPower" } };
      }
      // Включили питание — гаснет только авария «нет питания».
      const fixed = p.phase === "fault" && p.fault?.kind === "noPower";
      if (fixed) rig()?.recover();
      return { ...p, power, phase: fixed ? "build" : p.phase, fault: fixed ? null : p.fault };
    });
    rig()?.flip();
  };

  const tryStart = () => {
    if (!s.power) {
      setS((p) => ({ ...p, phase: "fault", fault: { kind: "noPower" } }));
      rig()?.alarm();
      return;
    }
    const bad = WIRED_UNITS.find((u) => s.placed[u.id] !== undefined && !s.wired.includes(u.id));
    if (bad) {
      setS((p) => ({ ...p, phase: "fault", fault: { kind: "unwired", unit: bad.id } }));
      rig()?.alarm();
      return;
    }
    setS((p) => ({ ...p, phase: "running", fault: null }));
    rig()?.spinUp();
  };

  const reset = () => {
    setS(EMPTY);
    setHeld(null);
    rigRef.current?.setLoad(0);
  };

  // ─── Перетаскивание ─────────────────────────────────────────────

  const slotUnderPoint = (p: DragPoint): number | null => {
    if (p.x < 0.06 || p.x > 0.96) return null;
    let best: number | null = null;
    let bestD = Infinity;
    for (const n of freeSlots) {
      const d = Math.abs(slotCentre(n) - p.y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return bestD <= UNIT_PER_FRAME * 0.85 ? best : null;
  };

  const unitDrag = (id: string) =>
    makeDragger({
      stage,
      onStart: (at) => setDrag({ kind: "unit", id, at, over: slotUnderPoint(at) }),
      onMove: (at) => setDrag((d) => (d ? { ...d, at, over: slotUnderPoint(at) } : d)),
      onEnd: (at) => {
        const slot = slotUnderPoint(at);
        setDrag(null);
        if (slot !== null) placeAt(id, slot);
        else rig()?.reject();
      },
      onTap: () => setHeld((h) => (h?.id === id ? null : { kind: "unit", id })),
    });

  const plugDrag = (id: string) => {
    const unit = PLAYABLE.find((u) => u.id === id)!;
    return makeDragger({
      stage,
      onStart: (at) => setDrag({ kind: "plug", id, at, over: null }),
      onMove: (at) => setDrag((d) => (d ? { ...d, at } : d)),
      onEnd: (at) => {
        setDrag(null);
        const slot = s.placed[id];
        if (slot === undefined || !unit.port) return;
        const target = anchorInRack({ ...unit, slot }, unit.port);
        if (near(at, target, SNAP)) wireUp(id);
        else rig()?.reject();
      },
      onTap: () => {
        if (s.wired.includes(id)) unplug(id);
        else wireUp(id);
      },
    });
  };

  /** Нажали по цели, держа деталь одним нажатием. */
  const dropHeld = (slot: number) => {
    if (held?.kind === "unit") placeAt(held.id, slot);
    setHeld(null);
  };

  // ─── Звук ───────────────────────────────────────────────────────

  const toggleSound = () => {
    const on = !soundOn;
    setSoundOn(on);
    if (on) {
      // Контекст создаётся ТОЛЬКО здесь, внутри обработчика нажатия:
      // созданный раньше браузер отдаёт в состоянии suspended.
      rigRef.current = rigRef.current ?? startRig();
      rigRef.current.setAudible(true);
      rigRef.current.setLoad(running ? 1 : doneCount / Math.max(1, total));
    } else {
      rigRef.current?.stop();
      rigRef.current = null;
    }
    try {
      localStorage.setItem("atlas-rack-sound", on ? "1" : "0");
    } catch {
      /* приватное окно — просто не запомним */
    }
  };

  // ─── Подсказка ──────────────────────────────────────────────────

  const nextUnit = PLAYABLE.find((u) => s.placed[u.id] === undefined);
  const nextWire = WIRED_UNITS.find((u) => s.placed[u.id] !== undefined && !s.wired.includes(u.id));

  let hint: string;
  if (faulted && s.fault) hint = copy.faults[s.fault.kind]?.fix ?? copy.how;
  else if (running) hint = copy.running;
  else if (drag?.kind === "unit") hint = copy.dropHere;
  else if (nextUnit) {
    hint = Object.keys(s.placed).length === 0 ? copy.howDrag : copy.hints[nextUnit.id] ?? copy.how;
  } else if (nextWire) hint = copy.connect;
  else if (!s.power) hint = copy.powerOn;
  else hint = copy.start;

  // ─── Разметка ───────────────────────────────────────────────────

  const vb = `0 0 ${FRAME_W} ${Math.round(RACK_H * FRAME_W)}`;
  const shelf = PLAYABLE.filter((u) => s.placed[u.id] === undefined);
  const showSlots = drag?.kind === "unit" || held?.kind === "unit";

  return (
    <div className="vr" data-phase={s.phase} data-dragging={drag ? "" : undefined}>
      <div className="vr-stage" ref={stageRef}>
        <div
          className="vr-rack"
          role="list"
          aria-label={copy.rackLabel.replace("{total}", String(RACK_SLOTS))}
        >
          <img
            className="vr-frame"
            src={rackSrc("rack", 1400)}
            srcSet={`${rackSrc("rack", 700)} 700w, ${rackSrc("rack", 1400)} 1400w`}
            sizes="(min-width: 1100px) 58vw, 92vw"
            alt=""
            width={1400}
            height={881}
            decoding="async"
            draggable={false}
          />

          {/* Свободные места видны, только когда в руке модуль: иначе
              пустая стойка пестрит рамками ни о чём. */}
          {showSlots &&
            freeSlots.map((n) => (
              <button
                key={n}
                type="button"
                className="vr-slot"
                data-over={drag?.over === n ? "" : undefined}
                style={{
                  top: `calc(${slotCentre(n) - UNIT_PER_FRAME / 2} * 100cqw)`,
                  height: `calc(${UNIT_PER_FRAME} * 100cqw)`,
                }}
                onClick={() => dropHeld(n)}
                aria-label={copy.slotEmpty}
              />
            ))}

          {RACK_UNITS.map((u) => {
            const slot = u.preset ? u.slot : s.placed[u.id];
            if (slot === undefined) return null;
            const wired = u.preset || !u.port || s.wired.includes(u.id);
            const broken = faulted && s.fault?.unit === u.id;
            return (
              <div
                key={u.id}
                role="listitem"
                className="vr-unit"
                data-live={wired && s.power && !broken ? "" : undefined}
                data-broken={broken ? "" : undefined}
                style={{
                  top: `calc(${unitTopAt(u, slot)} * 100cqw)`,
                  height: `calc(${u.frameH / FRAME_W} * 100cqw)`,
                }}
                aria-label={copy.slotFilled.replace("{name}", copy.names[u.id] ?? u.id)}
              >
                <img
                  src={rackSrc(u.id, 1400)}
                  srcSet={`${rackSrc(u.id, 700)} 700w, ${rackSrc(u.id, 1400)} 1400w`}
                  sizes="(min-width: 1100px) 58vw, 92vw"
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
              </div>
            );
          })}

          {/* Шнуры. Кривая — вектор, а не рендер: отрендерить шнур,
              который тянется за рукой, нельзя — он обязан гнуться. */}
          <svg className="vr-cords" viewBox={vb} preserveAspectRatio="none" aria-hidden>
            {WIRED_UNITS.map((u) => {
              const slot = s.placed[u.id];
              if (slot === undefined) return null;
              const a = anchorInRack(PATCH, jackFor(u.id));
              const dragging = drag?.kind === "plug" && drag.id === u.id;
              const b = dragging
                ? drag.at
                : s.wired.includes(u.id)
                  ? anchorInRack({ ...u, slot }, u.port!)
                  : null;
              if (!b) return null;
              const ax = a.x * FRAME_W;
              const ay = a.y * FRAME_W;
              const bx = b.x * FRAME_W;
              const by = b.y * FRAME_W;
              // Провис: шнур идёт не по прямой, он тяжёлый.
              const sag = Math.max(26, Math.abs(by - ay) * 0.45);
              return (
                <path
                  key={u.id}
                  className="vr-cord"
                  data-live={s.wired.includes(u.id) ? "" : undefined}
                  d={`M ${ax} ${ay} C ${ax} ${ay + sag}, ${bx} ${by - sag}, ${bx} ${by}`}
                />
              );
            })}
          </svg>

          {/* Штекеры: лежат на панели, пока не подключены. */}
          {WIRED_UNITS.map((u) => {
            const slot = s.placed[u.id];
            if (slot === undefined) return null;
            const wired = s.wired.includes(u.id);
            const dragging = drag?.kind === "plug" && drag.id === u.id;
            const home = anchorInRack(PATCH, jackFor(u.id));
            const port = anchorInRack({ ...u, slot }, u.port!);
            const at = dragging ? drag.at : wired ? port : home;
            return (
              <button
                key={u.id}
                type="button"
                className="vr-plug"
                data-wired={wired ? "" : undefined}
                style={{ left: `${at.x * 100}%`, top: `calc(${at.y} * 100cqw)` }}
                onPointerDown={plugDrag(u.id)}
                aria-label={
                  wired
                    ? `${copy.connected}: ${copy.names[u.id]}`
                    : `${copy.connect}: ${copy.names[u.id]}`
                }
              >
                <img src={rackSrc("plug", 560)} alt="" width={560} height={560} draggable={false} />
              </button>
            );
          })}

          {/* Тумблеры питания — кликаются прямо на панели. Второй в
              дерево доступности не идёт: одна команда не должна попадать
              туда дважды. */}
          {POWER_SWITCHES.map((sw, i) => {
            const at = anchorInRack(POWER, sw);
            return (
              <button
                key={sw.name}
                type="button"
                className="vr-switch"
                data-on={s.power ? "" : undefined}
                style={{ left: `${at.x * 100}%`, top: `calc(${at.y} * 100cqw)` }}
                onClick={togglePower}
                aria-pressed={i === 0 ? s.power : undefined}
                aria-label={i === 0 ? (s.power ? copy.powerOff : copy.powerOn) : undefined}
                tabIndex={i === 0 ? 0 : -1}
                aria-hidden={i === 0 ? undefined : true}
              >
                <img
                  src={rackSrc(s.power ? "switch-on" : "switch-off", 560)}
                  alt=""
                  width={560}
                  height={560}
                  draggable={false}
                />
              </button>
            );
          })}

          {/* Модуль в руке. */}
          {drag?.kind === "unit" && (
            <div
              className="vr-ghost"
              style={{
                top: `calc(${drag.at.y - UNIT_PER_FRAME / 2} * 100cqw)`,
                height: `calc(${(PLAYABLE.find((u) => u.id === drag.id)?.frameH ?? 147) / FRAME_W} * 100cqw)`,
              }}
              aria-hidden
            >
              <img src={rackSrc(drag.id, 1400)} alt="" width={1400} height={147} draggable={false} />
            </div>
          )}
        </div>
      </div>

      <div className="vr-side">
        <p className="vr-hint" role="status" data-fault={faulted ? "" : undefined}>
          {faulted && s.fault && <b>{copy.faults[s.fault.kind]?.title} </b>}
          {hint}
        </p>

        <p className="vr-count">
          <span className="vr-bar" aria-hidden>
            <span style={{ width: `${(doneCount / total) * 100}%` }} />
          </span>
          {copy.count.replace("{done}", String(doneCount)).replace("{total}", String(total))}
        </p>

        {/* Полка. Модуль отсюда тянут мышью или берут нажатием. */}
        {shelf.length > 0 && (
          <ul className="vr-shelf" aria-label={copy.shelfLabel}>
            {shelf.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="vr-card"
                  data-held={held?.kind === "unit" && held.id === u.id ? "" : undefined}
                  onPointerDown={unitDrag(u.id)}
                  aria-label={`${copy.pickUp}: ${copy.names[u.id]}`}
                >
                  <img
                    src={rackSrc(u.id, 700)}
                    alt=""
                    width={700}
                    height={Math.round(u.frameH / 2)}
                    draggable={false}
                  />
                  <span>{copy.names[u.id]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <ul className="vr-list">
          {PLAYABLE.map((u) => {
            const isPlaced = s.placed[u.id] !== undefined;
            const isWired = s.wired.includes(u.id);
            const needsWire = Boolean(u.port);
            const done = isPlaced && (!needsWire || isWired);
            return (
              <li key={u.id} className="vr-row" data-ready={done ? "" : undefined}>
                <span className="vr-row-name">{copy.names[u.id]}</span>
                {!isPlaced ? (
                  <button
                    type="button"
                    className="v-btn v-btn-sm"
                    onClick={() => placeAt(u.id, freeSlots[0] ?? FREE_SLOTS[0])}
                  >
                    {copy.place}
                  </button>
                ) : needsWire && !isWired ? (
                  <button
                    type="button"
                    className="v-btn v-btn-sm v-btn-primary"
                    onClick={() => wireUp(u.id)}
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
          {/* В АВАРИИ ОРГАНЫ УПРАВЛЕНИЯ ОСТАЮТСЯ НА МЕСТЕ. Сначала здесь
              была одна кнопка «устранить», и починить причину было
              физически нечем: тумблер и пуск пропадали с экрана. */}
          {running ? (
            <>
              <a className="v-btn v-btn-primary" href={ctaHref}>
                {copy.done.cta}
              </a>
              <button type="button" className="v-btn v-btn-soft" onClick={reset}>
                {copy.done.again}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="v-btn v-btn-primary"
                onClick={tryStart}
                disabled={!allPlaced}
              >
                {copy.start}
              </button>
              <button
                type="button"
                className="v-btn v-btn-soft"
                onClick={togglePower}
                aria-pressed={s.power}
              >
                {s.power ? copy.powerOff : copy.powerOn}
              </button>
            </>
          )}
          <button type="button" className="vr-sound" aria-pressed={soundOn} onClick={toggleSound}>
            <Icon name={soundOn ? "bell" : "close"} size={16} />
            {copy.sound}
          </button>
        </div>

        {!soundOn && !running && <p className="vr-note">{copy.soundHint}</p>}

        {running && (
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
