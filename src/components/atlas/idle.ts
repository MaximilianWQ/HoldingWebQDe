/**
 * Тяжёлая подготовка главной — вне пути прокрутки (аудит 14.09.2026:
 * «при скроллинге между экранами есть подвисания»). Сборка 3D-сцен
 * (чанк three, рендерер, шейдеры) и кадры ноутбука раньше начинались при
 * подходе блока к кадру — то есть ровно тогда, когда читатель листает, и
 * давали кадры по 60–600 мс.
 *
 * `whenQuiet(fn)` — после события load, в простое браузера и когда
 * страница хотя бы QUIET_MS не прокручивалась. LCP это не задерживает:
 * до load ничего не запускается.
 */
const QUIET_MS = 400;

let lastScroll = -1e9;
let tracking = false;

function track() {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  window.addEventListener("scroll", () => (lastScroll = performance.now()), { passive: true });
}

const idle = (fn: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 2000 });
  else window.setTimeout(fn, 120);
};

/** Выполнить `fn` после load, в простое и в паузе прокрутки. Возвращает отмену. */
export function whenQuiet(fn: () => void): () => void {
  track();
  let cancelled = false;
  let timer = 0;
  const attempt = () => {
    if (cancelled) return;
    idle(() => {
      if (cancelled) return;
      const wait = QUIET_MS - (performance.now() - lastScroll);
      if (wait > 0) timer = window.setTimeout(attempt, wait);
      else fn();
    });
  };
  const onLoad = () => attempt();
  if (document.readyState === "complete") attempt();
  else window.addEventListener("load", onLoad, { once: true });
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    window.removeEventListener("load", onLoad);
  };
}

/**
 * Очередь «по одному»: задачи выполняются строго друг за другом, каждая —
 * в своём тихом окне. Для сборки 3D-сцен: две сборки подряд в одном окне
 * снова дали бы долгий кадр.
 */
type Job = { run: () => Promise<void>; dead: boolean };
const jobs: Job[] = [];
let pumping = false;

function pump() {
  if (pumping) return;
  const job = jobs.shift();
  if (!job) return;
  pumping = true;
  whenQuiet(() => {
    const done = () => {
      pumping = false;
      pump();
    };
    if (job.dead) return done();
    job.run().then(done, done);
  });
}

/** Поставить подготовку в очередь. Возвращает отмену (задача пропускается). */
export function enqueueQuiet(run: () => Promise<void>): () => void {
  const job: Job = { run, dead: false };
  jobs.push(job);
  pump();
  return () => {
    job.dead = true;
  };
}
