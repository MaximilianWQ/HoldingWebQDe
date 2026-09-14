/**
 * Сцена реального времени для объектов главной — общий рантайм.
 *
 * Этот модуль лёгкий и живёт в основном бандле: он решает, рисовать ли
 * вообще, и тянет three.js и саму сцену отдельными чанками (`./core`,
 * `./hero`, `./orb`) — в простое после load по одной сцене (`../idle`)
 * или при подходе блока к кадру, что раньше.
 *
 * ПЛАВНОСТЬ. Кадр рисуется на частоте экрана (requestAnimationFrame —
 * 60, 120, 144 или 240 Гц, сколько даёт монитор), а всё движение
 * считается от реального времени: скорость вращения не зависит от
 * частоты и не дёргается после долгого кадра. Сглаживание курсора —
 * экспонентой от dt, тоже не зависит от частоты.
 *
 * СТОИМОСТЬ.
 *   · Уровень устройства (0–2) задаёт потолок DPR и плотность сцены.
 *   · Если кадры регулярно пропускаются, DPR снижается ступенями —
 *     плавность важнее резкости.
 *   · Цикл стоит, когда блок вне кадра или вкладка скрыта.
 *   · reduced-motion и ?static=1 — один неподвижный кадр (или постер,
 *     если он передан); saveData и отсутствие WebGL/WebGPU — постер,
 *     three.js не скачивается вовсе.
 */
import type { PerspectiveCamera, RenderTarget, Scene, WebGPURenderer } from "three/webgpu";
import { enqueueQuiet } from "../idle";

export type Tier = 0 | 1 | 2;

export interface Frame {
  /** Время сцены, с. Идёт только пока цикл идёт. */
  t: number;
  /** Шаг кадра, с (не больше 0,1). */
  dt: number;
  /** Сглаженное положение курсора, −1…1 по окну. */
  px: number;
  py: number;
}

export interface SceneParts {
  /** Радиус описанной сферы объекта — по нему камера кадрирует. */
  radius: number;
  /** Время, на котором снимается неподвижный кадр. */
  stillT: number;
  update(f: Frame): void;
  /** Освободить то, что не висит на сцене (сцена чистится сама). */
  dispose(): void;
  /**
   * Своё кадрирование камеры под холст w × h (CSS px). Если задано,
   * `place` и `radius` для камеры не используются: так сцена первого
   * экрана держит тот же кадр, что постер с `object-fit: contain`.
   */
  frame?(w: number, h: number): void;
}

export interface BuildCtx {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGPURenderer;
  tier: Tier;
  /** Неподвижный режим (reduced-motion, ?static=1): сцена рисует конечный кадр. */
  still: boolean;
}

export type Builder = (ctx: BuildCtx) => SceneParts;

/** Место объекта на холсте: центр в долях, радиус в CSS-пикселях. */
export interface Placement {
  cx: number;
  cy: number;
  r: number;
}

export interface StageOptions {
  /** Ленивая загрузка сцены — отдельный чанк вместе с three. */
  scene: () => Promise<Builder>;
  place: (w: number, h: number) => Placement;
  /** Есть постер — во всех неподвижных режимах показывается он. */
  hasPoster: boolean;
  /** Бюджет треугольников сцены (проверяется в разработке). */
  budget: number;
  fov?: number;
  /** Потолок DPR поверх потолка уровня устройства (холст во весь экран — ниже). */
  maxDpr?: number;
  /**
   * Получить управление живой сценой после первого кадра. `redraw`
   * перерисовывает неподвижный кадр (reduced-motion, ?static=1), когда
   * сцена поменяла параметры без пересборки; в идущем цикле не нужен.
   */
  bind?: (api: StageApi) => void;
}

export interface StageApi {
  redraw(): void;
}

type Still = "static" | "reduced" | "save-data" | null;

function stillReason(): Still {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData === true) return "save-data";
  if (document.documentElement.hasAttribute("data-static")) return "static";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
  return null;
}

function canRender(): boolean {
  if ((navigator as Navigator & { gpu?: unknown }).gpu) return true;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Грубый уровень устройства. Не бенчмарк — ориентир для плотности и
 * DPR; от ошибки страхует адаптивный DPR в цикле.
 */
export function deviceTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory ?? 8;
  const coarse = matchMedia("(pointer: coarse)").matches;
  if (cores <= 4 || mem <= 2) return 0;
  if (coarse || mem <= 4 || cores <= 6) return 1;
  return 2;
}

/** Подключить сцену к блоку. Возвращает функцию размонтирования. */
export function mountStage(host: HTMLElement, canvas: HTMLCanvasElement, o: StageOptions): () => void {
  const setMode = (m: "gl" | "poster") => host.setAttribute("data-mode", m);
  const reason = stillReason();

  if (reason === "save-data" || (reason && o.hasPoster)) {
    setMode("poster");
    return () => {};
  }
  const still = reason !== null;
  const tier = deviceTier();
  // Постер — сразу, 3D сменяет его, когда соберётся первый кадр. Раньше
  // до готовности (чанк three + init + компиляция шейдеров: на телефоне
  // до 3–6 с после быстрой прокрутки) блок стоял пустым — белое место
  // (аудит 13.09.2026).
  if (o.hasPoster) setMode("poster");

  let disposed = false;
  let started = false;
  let inView = false;
  let running = false;
  let raf = 0;

  let renderer: WebGPURenderer | null = null;
  let scene: Scene | null = null;
  let camera: PerspectiveCamera | null = null;
  let env: RenderTarget | null = null;
  let parts: SceneParts | null = null;
  let core: typeof import("./core") | null = null;

  const target = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };
  let t = 0;
  let last = -1;
  let w = 0;
  let h = 0;
  const dprCap = Math.min(tier === 0 ? 1.5 : 2, o.maxDpr ?? 2);
  let dpr = Math.min(window.devicePixelRatio || 1, dprCap);

  const draw = () => {
    if (renderer && scene && camera) renderer.render(scene, camera);
  };

  /** Размер холста и кадрирование: объект вписан по радиусу в пикселях. */
  const layout = (force = false) => {
    if (!renderer || !camera || !parts) return false;
    const nw = host.clientWidth;
    const nh = host.clientHeight;
    if (!nw || !nh) return false;
    if (!force && nw === w && nh === h) return false;
    w = nw;
    h = nh;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (parts.frame) {
      parts.frame(w, h);
      return true;
    }
    const p = o.place(w, h);
    const half = (camera.fov * Math.PI) / 360;
    const ang = Math.atan((p.r / (h / 2)) * Math.tan(half));
    const dist = parts.radius / Math.sin(ang);
    camera.position.set(0, 0, dist);
    camera.near = Math.max(0.01, dist - parts.radius * 1.8);
    camera.far = dist + parts.radius * 1.8;
    camera.aspect = w / h;
    // Сдвиг главной точки, а не объекта: объект остаётся на оси камеры,
    // перспектива его не перекашивает, параллакс симметричен.
    camera.setViewOffset(w, h, w / 2 - p.cx * w, h / 2 - p.cy * h, w, h);
    camera.updateProjectionMatrix();
    return true;
  };

  // Адаптивный DPR: 120 кадров подряд в среднем в 1,7 раза длиннее
  // лучшего — значит, кадры пропускаются. Не больше трёх ступеней.
  let best = 1e9;
  let acc = 0;
  let count = 0;
  let steps = 0;
  const watch = (ms: number) => {
    if (ms <= 0) return;
    best = Math.min(best, ms);
    acc += ms;
    if (++count < 120) return;
    const avg = acc / count;
    acc = 0;
    count = 0;
    if (avg > best * 1.7 && dpr > 1 && steps < 3) {
      steps++;
      dpr = Math.max(1, dpr - 0.25);
      layout(true);
    }
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 0.1);
    if (last >= 0) watch(now - last);
    last = now;
    t += dt;
    const k = 1 - Math.exp(-dt * 2.4);
    smooth.x += (target.x - smooth.x) * k;
    smooth.y += (target.y - smooth.y) * k;
    parts?.update({ t, dt, px: smooth.x, py: smooth.y });
    draw();
  };

  const sync = () => {
    const want = !!parts && !still && !disposed && inView && !document.hidden;
    if (want && !running) {
      running = true;
      last = -1;
      raf = requestAnimationFrame(frame);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };

  const teardown = () => {
    running = false;
    cancelAnimationFrame(raf);
    parts?.dispose();
    if (core && scene) core.disposeScene(scene);
    env?.dispose();
    renderer?.dispose();
    parts = null;
    scene = null;
    camera = null;
    env = null;
    renderer = null;
  };

  const init = async () => {
    started = true;
    if (!canRender()) {
      setMode("poster");
      return;
    }
    try {
      const [c, build] = await Promise.all([import("./core"), o.scene()]);
      if (disposed) return;
      core = c;
      const r = await c.createRenderer(canvas, tier);
      if (disposed) {
        r.dispose();
        return;
      }
      renderer = r;
      r.onDeviceLost = () => {
        teardown();
        setMode("poster");
      };
      scene = new c.THREE.Scene();
      camera = new c.THREE.PerspectiveCamera(o.fov ?? 26, 1, 0.1, 100);
      env = c.studioEnv(r, tier);
      scene.environment = env.texture;
      parts = build({ scene, camera, renderer: r, tier, still });

      const tris = c.countTriangles(scene);
      host.setAttribute("data-tris", String(tris));
      host.setAttribute("data-backend", c.isWebGPU(r) ? "webgpu" : "webgl2");
      host.setAttribute("data-tier", String(tier));
      if (process.env.NODE_ENV !== "production" && tris > o.budget) {
        console.warn(`[gl] сцена ${tris} треугольников при бюджете ${o.budget}`);
      }

      layout(true);
      t = still ? parts.stillT : 0;
      parts.update({ t, dt: 0, px: 0, py: 0 });
      // Шейдеры собираются до первого кадра и не рвут цикл потом.
      await r.compileAsync(scene, camera);
      if (disposed || !parts) return;
      draw();
      setMode("gl");
      if (still) host.setAttribute("data-still", "");
      sync();
      o.bind?.({
        redraw: () => {
          if (running || !parts) return;
          parts.update({ t, dt: 0, px: smooth.x, py: smooth.y });
          draw();
        },
      });
    } catch (e) {
      // В разработке причину видно в консоли; на проде — молча постер.
      if (process.env.NODE_ENV !== "production") console.error("[gl] сцена не собралась", e);
      if (disposed) return;
      teardown();
      setMode("poster");
    }
  };

  // Сборка — заранее, в простое после load и в паузе прокрутки, по одной
  // сцене за раз (`../idle`): чанк three (~85 мс разбора), рендерер и
  // шейдеры при подходе к блоку давали кадры 60–600 мс посреди прокрутки
  // (профиль 14.09.2026). Подход к блоку — запасной путь, если читатель
  // долистал раньше, чем очередь дошла до сцены.
  const cancelPre = enqueueQuiet(() => (started || disposed ? Promise.resolve() : init()));
  const near = new IntersectionObserver(
    (es) => {
      if (!started && es.some((e) => e.isIntersecting)) void init();
    },
    // За два экрана до блока: к быстрой прокрутке сцена уже собрана.
    { rootMargin: "200% 0px" }
  );
  const seen = new IntersectionObserver((es) => {
    inView = es[es.length - 1].isIntersecting;
    sync();
  });
  const ro = new ResizeObserver(() => {
    if (layout() && !running) draw();
  });
  near.observe(host);
  seen.observe(host);
  ro.observe(host);

  const onVis = () => sync();
  document.addEventListener("visibilitychange", onVis);

  const fine = !still && matchMedia("(pointer: fine)").matches;
  const onMove = (e: PointerEvent) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (fine) window.addEventListener("pointermove", onMove, { passive: true });

  return () => {
    disposed = true;
    cancelPre();
    near.disconnect();
    seen.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    if (fine) window.removeEventListener("pointermove", onMove);
    teardown();
  };
}
