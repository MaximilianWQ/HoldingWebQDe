/**
 * Очередь нижних карточек: согласие на cookie, быстрый вход, установка.
 *
 * ПЕРЕДЕЛАНО 11.09.2026 (владелец: «отображаются в одно время и много
 * там ошибок»). Прежняя версия умела одно — отложить установку до
 * согласия на cookie. Но iOS-подсказка и промпт Chrome не знали друг о
 * друге, быстрый вход в очереди не участвовал вовсе, а предложение
 * установки выскакивало на первом визите через 3–5 секунд — поверх
 * первого экрана и закреплённых сцен.
 *
 * Правила:
 *   1. На экране не больше одной карточки. Слот занимает `requestOverlay`,
 *      освобождает `releaseOverlay`; следующая ждёт в очереди.
 *   2. Приоритет: cookie → быстрый вход → установка.
 *   3. Установку предлагаем только вовлечённому посетителю
 *      (`whenEngaged`): со второго визита и после 30 с на странице или
 *      прокрутки половины документа.
 *   4. Отказ — пауза (`snooze`), срок задаёт карточка.
 */

export const CONSENT_KEY = "cookie_consent";
export const CONSENT_EVENT = "atlas:cookie-consent";

/* `welcome` — остаток пробного периода в кабинете (11.09.2026): раньше
   стоял вне очереди и выходил одновременно с быстрым входом. */
export type OverlayId = "cookie" | "welcome" | "passkey" | "install";
/* Установка на iPhone — сразу после cookie (владелец, 11.09.2026: «зашёл
   на дашборд — через пару секунд предлагаем установить»). */
const PRIORITY: Record<OverlayId, number> = { cookie: 0, install: 1, welcome: 2, passkey: 3 };
/** Пауза между карточками: следующая не выпрыгивает в тот же кадр. */
const GAP_MS = 900;

let active: OverlayId | null = null;
let waiting: Array<{ id: OverlayId; run: () => void }> = [];

/**
 * Занять слот. `run` вызывается, когда слот свободен и эта карточка
 * первая по приоритету. Возвращает отмену (для размонтирования).
 */
export function requestOverlay(id: OverlayId, run: () => void): () => void {
  if (active === id || waiting.some((w) => w.id === id)) return () => {};
  if (active === null) {
    active = id;
    run();
  } else {
    waiting.push({ id, run });
    waiting.sort((a, b) => PRIORITY[a.id] - PRIORITY[b.id]);
  }
  return () => {
    waiting = waiting.filter((w) => w.id !== id);
    if (active === id) releaseOverlay(id);
  };
}

/** Освободить слот и через паузу отдать его следующей карточке. */
export function releaseOverlay(id: OverlayId): void {
  if (active !== id) return;
  active = null;
  const next = waiting.shift();
  if (!next) return;
  active = next.id;
  window.setTimeout(next.run, GAP_MS);
}

/**
 * Выбор по cookie уже сделан В ЭТОМ ВИЗИТЕ.
 *
 * Владелец, 11.09.2026: «каждый раз, когда пользователь заходит на
 * сайт, он должен соглашаться». Поэтому выбор хранится в
 * ПАМЯТЬ — 5 ДНЕЙ (владелец, 20.09.2026: «на любом устройстве очень
 * часто высвечивается, надо запоминать хотя бы на пять дней»).
 *
 * Раньше выбор жил в `sessionStorage`, то есть до закрытия вкладки:
 * человек отвечал на вопрос заново при каждом заходе, а на телефоне —
 * практически при каждом открытии сайта. Теперь ответ лежит в
 * `localStorage` с отметкой времени и действует пять суток.
 *
 * Срок, а не «навсегда»: согласие на обработку данных положено
 * переспрашивать, и пять дней — разумная середина между «раз в жизни»
 * и «каждый заход».
 */
const CONSENT_TTL_MS = 5 * 24 * 60 * 60 * 1000;

export function hasCookieConsent(): boolean {
  try {
    // Старый ключ визита уважаем до конца вкладки — чтобы у тех, кто
    // уже ответил сегодня, карточка не выскочила снова после выкладки.
    if (sessionStorage.getItem(CONSENT_KEY) !== null) return true;
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const at = Number(raw.split("|")[1]);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < CONSENT_TTL_MS;
  } catch {
    // Хранилище недоступно: считаем согласие данным, иначе остальные
    // карточки не покажутся никогда.
    return true;
  }
}

/** Значение выбора: "1" — принял, "0" — отклонил; null — ещё не отвечал. */
export function cookieConsentValue(): "1" | "0" | null {
  try {
    const s = sessionStorage.getItem(CONSENT_KEY);
    if (s === "1" || s === "0") return s;
    const raw = localStorage.getItem(CONSENT_KEY);
    const v = raw?.split("|")[0];
    return v === "1" || v === "0" ? v : null;
  } catch {
    return null;
  }
}

/** Запомнить ответ: на вкладку и на пять суток. */
export function rememberCookieConsent(value: "1" | "0"): void {
  try {
    sessionStorage.setItem(CONSENT_KEY, value);
    localStorage.setItem(CONSENT_KEY, `${value}|${Date.now()}`);
  } catch {
    // Хранилище недоступно — выбор проживёт до перезагрузки страницы.
  }
}

/**
 * Вызвать `run`, когда согласие получено: сразу, если оно уже есть,
 * иначе — по событию. Возвращает функцию отписки.
 */
export function whenConsentSettled(run: () => void): () => void {
  if (hasCookieConsent()) {
    run();
    return () => {};
  }
  const handler = () => run();
  window.addEventListener(CONSENT_EVENT, handler, { once: true });
  return () => window.removeEventListener(CONSENT_EVENT, handler);
}

/** Сообщить остальным карточкам, что согласие получено. */
export function announceConsentSettled(): void {
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

const VISITS_KEY = "atlas-visits";
const VISIT_MARK = "atlas-visit-counted";

/** Номер визита: считается один раз за сессию браузера. */
function visitNumber(): number {
  try {
    let n = Number(localStorage.getItem(VISITS_KEY) || "0");
    if (!sessionStorage.getItem(VISIT_MARK)) {
      n += 1;
      localStorage.setItem(VISITS_KEY, String(n));
      sessionStorage.setItem(VISIT_MARK, "1");
    }
    return n;
  } catch {
    return 0;
  }
}

/**
 * Вызвать `run`, когда посетитель вовлечён: второй визит и больше, и
 * либо 30 с на странице, либо прокручена половина документа. На первом
 * визите не вызывается никогда — человек ещё не решил, нужен ли ему
 * сервис, какое уж тут приложение.
 */
export function whenEngaged(run: () => void, { seconds = 30, depth = 0.5 } = {}): () => void {
  if (visitNumber() < 2) return () => {};
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    run();
  };
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max > 0 && window.scrollY / max >= depth) fire();
  };
  const timer = window.setTimeout(fire, seconds * 1000);
  window.addEventListener("scroll", onScroll, { passive: true });
  function cleanup() {
    window.clearTimeout(timer);
    window.removeEventListener("scroll", onScroll);
  }
  return () => {
    done = true;
    cleanup();
  };
}

/** Отложена ли карточка после отказа (срок — в днях). */
export function snoozed(key: string, days: number): boolean {
  try {
    const at = Number(localStorage.getItem(key) || "0");
    return at > 0 && Date.now() - at < days * 86_400_000;
  } catch {
    return true;
  }
}

/** Запомнить отказ. */
export function snooze(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Хранилище недоступно — карточка вернётся в следующем визите.
  }
}
