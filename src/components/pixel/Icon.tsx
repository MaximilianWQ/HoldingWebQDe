/**
 * Единый набор иконок лендинга — принцип 7 (research/concept.md).
 *
 * Один источник правды вместо SVG, разбросанных по восьми секциям.
 * Все глифы нарисованы под одну сетку 24×24, одну толщину штриха и
 * скруглённые концы — поэтому набор читается как один шрифт, а не как
 * коллекция иконок из разных библиотек.
 *
 * Никаких внешних icon-library: каждый глиф — часть дизайн-системы.
 */

export type IconName =
  | "arrow-right"
  | "check"
  | "iphone"
  | "android"
  | "macos"
  | "windows"
  | "tv"
  | "shield"
  | "bolt"
  | "globe"
  | "clock"
  | "menu"
  | "close"
  // Кабинет (11.09.2026): тот же штрих и та же сетка 24.
  | "bell"
  | "copy"
  | "qr"
  | "users"
  | "logout"
  | "send"
  | "lock"
  | "refresh"
  | "share"
  | "devices"
  | "chat"
  // Atlas Secure VPS (17.09.2026): кабинет-вкладки и карусели.
  | "bag"
  | "receipt"
  | "grid"
  | "plus"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "coins"
  | "key"
  | "user"
  | "download"
  // /install-happ (17.09.2026): вкладка «Настройки» в мокапе приложения.
  | "settings";

interface IconProps {
  name: IconName;
  /** Сторона квадрата в px. Штрих компенсируется, чтобы вес глифа
   *  visually совпадал на 14px и на 40px. */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** Тоньше на крупных размерах — оптическая компенсация веса штриха. */
function strokeFor(size: number): number {
  if (size <= 16) return 1.9;
  if (size <= 24) return 1.6;
  if (size <= 32) return 1.45;
  return 1.3;
}

export default function Icon({ name, size = 20, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeFor(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

const PATHS: Record<IconName, React.ReactNode> = {
  "arrow-right": <path d="M4 12h15M13 6l6 6-6 6" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  iphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
      <path d="M10.5 5.6h3" />
    </>
  ),
  android: (
    <>
      <path d="M4 15.5V11a8 8 0 0 1 16 0v4.5" />
      <path d="M4 15.5h16v2.2a2.3 2.3 0 0 1-2.3 2.3H6.3A2.3 2.3 0 0 1 4 17.7z" />
      <path d="M7.6 5.2 6.2 3M16.4 5.2 17.8 3" />
      <path d="M9.6 9.4h.01M14.4 9.4h.01" />
    </>
  ),
  // Ноутбук: экран + трапеция деки. Раньше рисовался как монитор и в
  // мелком кегле сливался с Android TV.
  macos: (
    <>
      <rect x="3.2" y="3.6" width="17.6" height="11.4" rx="1.6" />
      <path d="M1.4 19.8 4.2 15h15.6l2.8 4.8z" />
    </>
  ),
  windows: (
    <>
      <path d="M3.5 6.2 10.4 5v6.3H3.5z" />
      <path d="M12.2 4.7 20.5 3.4v7.9h-8.3z" />
      <path d="M3.5 12.7h6.9V19L3.5 17.8z" />
      <path d="M12.2 12.7h8.3v7.9l-8.3-1.3z" />
    </>
  ),
  // Телевизор: широкий экран на ножке с опорой — силуэт, который
  // невозможно спутать с ноутбуком.
  tv: (
    <>
      <rect x="2.4" y="3.8" width="19.2" height="12.4" rx="2" />
      <path d="M12 16.2v3.2" />
      <path d="M8 20.4h8" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.9 4.6 6v6.1c0 4.3 3 8.1 7.4 9.3 4.4-1.2 7.4-5 7.4-9.3V6z" />
      <path d="M9.2 12.1 11.3 14.2 15 10.5" />
    </>
  ),
  bolt: <path d="M13.4 2.8 5.2 13.4h5.5l-.9 7.8 8.2-10.6h-5.5z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M2.9 12h18.2" />
      <path d="M12 2.8a13.5 13.5 0 0 1 0 18.4 13.5 13.5 0 0 1 0-18.4z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 6.8V12l3.4 2" />
    </>
  ),
  menu: <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bell: <path d="M18 9a6 6 0 1 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15.5 18 9M13.7 20.5a2 2 0 0 1-3.4 0" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  qr: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <path d="M13.5 13.5h3v3M20.5 13.5v3M13.5 17v3.5M17 20.5h3.5" />
    </>
  ),
  users: <path d="M16 20.5V19a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1.5M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20.5V19a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />,
  logout: <path d="M9 20.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2H9M16 16.5l4.5-4.5L16 7.5M20.5 12H9" />,
  send: <path d="M21 3.5 10.5 14M21 3.5l-6.5 17-4-6.5-6.5-4z" />,
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3" />
    </>
  ),
  refresh: <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1l2.6 2.6M20.5 3.5v5h-5" />,
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.2 13.3 7.6 4M15.8 6.7l-7.6 4" />
    </>
  ),
  devices: <path d="M3.5 5.5h17v10h-17zM2 19.5h20M9 15.5v4M15 15.5v4" />,
  chat: <path d="M20.5 12a8 8 0 0 1-11.6 7.1l-5.4 1.4 1.4-5.3A8 8 0 1 1 20.5 12" />,
  bag: (
    <>
      <path d="M5 8.5h14l-1 11.2a2 2 0 0 1-2 1.8H8a2 2 0 0 1-2-1.8z" />
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
    </>
  ),
  receipt: (
    <>
      <rect x="4.5" y="3" width="15" height="14.5" rx="3" />
      <path d="M8.5 8h7M8.5 11.5h7M8.5 17.5V21M15.5 17.5V21" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
      <path d="M17 3.2 20.8 7 17 10.8 13.2 7z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "chevron-left": <path d="M15 4.5 7.5 12l7.5 7.5" />,
  "chevron-right": <path d="M9 4.5l7.5 7.5L9 19.5" />,
  "chevron-down": <path d="M4.5 9 12 16.5 19.5 9" />,
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="3" />
      <path d="M4.5 6v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6M4.5 10v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-4M4.5 14v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="M11.2 11.8 20 3M16.5 6.5l2.5 2.5M14 9l2 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  download: <path d="M12 3.5v12M7 10.5l5 5 5-5M4.5 20.5h15" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7M17.8 17.8l-1.7-1.7M7.9 7.9 6.2 6.2" />
    </>
  ),
};
