/**
 * Перетаскивание для симулятора стойки.
 *
 * ПОЧЕМУ СВОЁ, А НЕ HTML5 DRAG AND DROP. Родной `dragstart`/`drop` не
 * работает пальцем вовсе, не даёт поставить произвольную картинку под
 * курсор без мороки с `setDragImage`, и его нельзя прервать по своему
 * условию. Указательные события (`pointerdown`/`move`/`up`) одинаковы
 * для мыши, пальца и пера, и `setPointerCapture` не теряет жест, когда
 * рука ушла за край элемента.
 *
 * ЧТО ЭТОТ ФАЙЛ НЕ ДЕЛАЕТ. Он не знает ни про стойку, ни про модули:
 * отдаёт только «взяли», «ведут», «отпустили» и текущую точку в долях
 * сцены. Правила игры живут в доске.
 */

export interface DragPoint {
  /** Доля ширины сцены от её левого края. */
  x: number;
  /** Доля ШИРИНЫ (не высоты) от верха сцены — как в манифесте. */
  y: number;
  /** Пиксели относительно сцены: нужны курсорной подсказке. */
  px: number;
  py: number;
}

export interface DragHandlers {
  /** Сцена, в долях которой считаются координаты. */
  stage: () => HTMLElement | null;
  onStart?: (p: DragPoint) => void;
  onMove?: (p: DragPoint) => void;
  onEnd?: (p: DragPoint) => void;
  /** Порог, после которого жест считается перетаскиванием, в пикселях. */
  threshold?: number;
  /** Нажали и отпустили, не сдвинувшись: это не перетаскивание, а клик. */
  onTap?: () => void;
}

/**
 * Порог в 6 пикселей взят не с потолка: меньше — и дрожание руки на
 * тачпаде превращает каждый клик в перетаскивание; больше — и короткий
 * уверенный бросок в соседнее место не засчитывается.
 */
const DEFAULT_THRESHOLD = 6;

export function makeDragger(h: DragHandlers) {
  const threshold = h.threshold ?? DEFAULT_THRESHOLD;

  function point(e: PointerEvent): DragPoint | null {
    const el = h.stage();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Ширина — общий знаменатель и для X, и для Y. Так же считает
    // манифест сцены Blender, и вертикальная доля остаётся верной при
    // любой высоте блока.
    const w = r.width || 1;
    return {
      x: (e.clientX - r.left) / w,
      y: (e.clientY - r.top) / w,
      px: e.clientX - r.left,
      py: e.clientY - r.top,
    };
  }

  return function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    // Правой кнопкой не таскают.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    const move = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < threshold) return;
        dragging = true;
        const p = point(ev);
        if (p) h.onStart?.(p);
      }
      const p = point(ev);
      if (p) h.onMove?.(p);
    };

    const up = (ev: PointerEvent) => {
      try {
        target.releasePointerCapture?.(ev.pointerId);
      } catch {
        /* захвата и не было */
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (!dragging) {
        // Нажали и отпустили на месте — это клик, и он обязан работать:
        // равноценная замена жесту нужна по WCAG 2.5.7, а на телефоне
        // она вообще основной путь.
        h.onTap?.();
        return;
      }
      const p = point(ev);
      if (p) h.onEnd?.(p);
    };

    // Захват может не удаться: указателя с этим номером уже нет (жест
    // прервали системой, пришло синтетическое событие). Бросок отсюда
    // обрывал бы весь обработчик, и перетаскивание не начиналось бы
    // вовсе — а без захвата оно просто работает чуть хуже у края.
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {
      /* обойдёмся без захвата */
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
}

/** Расстояние между точками в долях сцены. */
export function near(a: { x: number; y: number }, b: { x: number; y: number }, r: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= r;
}
