/**
 * Одна блокировка прокрутки на все окна поверх страницы.
 *
 * ПОЧЕМУ ФАЙЛ ПОЯВИЛСЯ (владелец, 20.09.2026: «нажал отвязать, закрыл
 * окно, хотел перейти — сайт подвис»). Три компонента правили
 * `document.body.style.overflow` напрямую и каждый по-своему: один
 * запоминал прежнее значение и возвращал его, другой просто ставил
 * пустую строку. Стоило двум окнам наложиться — и внутреннее
 * возвращало «hidden», оставленное внешним. Прокрутка после этого не
 * включалась уже никогда, и страница выглядела зависшей: нажатия
 * работают, а лист не едет.
 *
 * Здесь счётчик. Блокировка снимается, когда закрылось ПОСЛЕДНЕЕ окно,
 * а не первое попавшееся. Прежнее значение стиля запоминается один раз
 * — при переходе от нуля к единице.
 */
let depth = 0;
let saved = "";

export function lockScroll(): void {
  if (typeof document === "undefined") return;
  if (depth === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  depth += 1;
}

export function unlockScroll(): void {
  if (typeof document === "undefined") return;
  depth = Math.max(0, depth - 1);
  if (depth === 0) document.body.style.overflow = saved;
}

/** Для useEffect: `useEffect(() => (open ? holdScroll() : undefined), [open])`. */
export function holdScroll(): () => void {
  lockScroll();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    unlockScroll();
  };
}
