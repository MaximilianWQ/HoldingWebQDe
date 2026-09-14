/**
 * Мягкие сцены главной (14.09.2026) — рисует `HeroGL`.
 *
 * "globe-soft" — раздел 03: большой мягкий глобус. Белая керамика,
 * кобальтовые точки суши (src/lib/world-map.ts), глянцевые бусины
 * городов наших локаций (src/lib/locations.ts), низкие дуги от Москвы,
 * по которым бегут кометы; медленное вращение.
 *
 * "mission-soft" — раздел 07: мягкая сеть. Икосфера из белых и
 * кобальтовых узлов на хромированных стержнях вокруг матового стеклянного
 * ядра с кобальтовым сердцем; по стержням бегут огни.
 *
 * КАДР. Квадратный кадр 6,4 единицы по высоте вписан в блок как
 * `object-fit: contain` (`frame`, смещение камеры `setViewOffset`) с тем
 * же `object-position`, что у постера (`--hx-ox/--hx-oy`, по умолчанию
 * центр), — поэтому постер (снятый с этой же сцены в покое, t = 0) и
 * живой кадр совпадают попиксельно. Холст прозрачный: сцена лежит на
 * фоне раздела.
 *
 * ДВИЖЕНИЕ — только от времени `t`: в t = 0 всё в позе постера,
 * вращение и покачивание нарастают с нуля за ~1,6 с (`run` — интеграл
 * пробуждения), поэтому смена постера на холст незаметна. Частота кадров
 * на ход не влияет: 60 и 120 Гц дают одно движение. Лёгкий наклон всей
 * группы за рукой.
 *
 * СВЕТ И МАТЕРИАЛЫ. Мягкая студия без тонмаппинга; тени на полу —
 * гауссовы пятна одной инстансной отрисовкой. Матовое стекло ядра считает
 * размытое кобальтовое сердце за собой само (преломлённый луч по полю
 * расстояний сферы) — одинаково на WebGPU и WebGL 2, без копии кадра.
 *
 * БЮДЖЕТ (треугольники, уровень 2, замер 14.09.2026): globe-soft —
 * 30 448, mission-soft — 34 708 при потолке 60k (`budget` в HeroGL).
 * Ни копии кадра, ни карты теней, ни постобработки.
 */
import * as THREE from "three/webgpu";
import {
  cameraPosition,
  color,
  exp,
  float,
  instancedDynamicBufferAttribute,
  length,
  min,
  mix,
  normalView,
  normalWorld,
  normalize,
  positionViewDirection,
  positionWorld,
  reflectVector,
  refract,
  saturate,
  smoothstep,
  uniform,
  uv,
  vec3,
} from "three/tsl";
import type { Builder, Tier } from "./stage";
import { LOCATIONS } from "../../../lib/locations";
import { CELL_DEG, LAT_TOP, LON_LEFT, WORLD_ROWS } from "../../../lib/world-map";

/** Живые параметры от HeroGL. */
export interface HeroLive {
  /** Положение кадра в блоке (как `object-position` постера), доли 0…1. */
  align(): [number, number];
}

const COBALT = 0x1432b8;

export type Composition = "globe-soft" | "mission-soft";

type P3 = readonly [number, number, number];
/** Раскладка сцены: кадр (пропорция, высота в единицах, угол камеры), пол, форма, подложка-тень. */
interface Layout {
  aspect: number;
  frameH: number;
  /** Вертикальный угол камеры, °. */
  fov: number;
  floor: number;
  /** Общая подложка-тень: центр по x, размер, сила. */
  under: { x: number; sx: number; sz: number; k: number };
  /** Мягкий глобус: радиус, центр, наклон оси; прореживание точек суши по уровням устройства. */
  softGlobe?: { r: number; at: P3; tilt: number; density: readonly [number, number, number] };
  /** Мягкая решётка: узлы-сферы белые и кобальтовые на хромированных стержнях, внутри — матовое стеклянное ядро. */
  softLattice?: { r: number; at: P3; tilt: number };
  /** Загрузка «форма садится»: лёгкий подъём и посадка (от позы постера). */
  settle?: boolean;
}

const LAYOUTS: Record<Composition, Layout> = {
  "globe-soft": {
    aspect: 1,
    frameH: 6.4,
    fov: 20,
    floor: -3.0,
    softGlobe: { r: 2.3, at: [0, 0.15, 0], tilt: 0.36, density: [2, 1, 1] },
    under: { x: 0, sx: 5.5, sz: 3.2, k: 0.05 },
  },
  "mission-soft": {
    aspect: 1,
    frameH: 6.4,
    fov: 20,
    floor: -3.0,
    settle: true,
    softLattice: { r: 2.05, at: [0, 0.15, 0], tilt: 0.3 },
    under: { x: 0, sx: 5, sz: 3, k: 0.05 },
  },
};
const TAU = Math.PI * 2;
/** Камера смотрит чуть сверху. */
const TILT = 0.2;

const pick = <T>(tier: Tier, v: readonly [T, T, T]): T => v[tier];

/** Детерминированный «случай» 0…1 — раскладка городов, узлов и комет одна на каждом запуске. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Кривая в локальных координатах объекта, отдаваемая в координатах корня сцены (дуги и стержни вращаются вместе с формой). */
class LocalCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private base: THREE.Curve<THREE.Vector3>, private obj: THREE.Object3D) {
    super();
  }
  getPoint(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    this.base.getPoint(t, out);
    // До корня сцены: матрицы объекта и его родителей ниже корня.
    let o: THREE.Object3D | null = this.obj;
    while (o && o.parent && o.parent.type !== "Scene") {
      out.applyMatrix4(o.matrix);
      o = o.parent;
    }
    return out;
  }
}

const v3 = () => uniform(new THREE.Vector3());
type U3 = ReturnType<typeof v3>;
/** Узел float в TSL (для приведения типов, как в globe.ts). */
type F = ReturnType<typeof float>;

/** Форма сцены: своё движение и пятно тени на полу. */
interface Body {
  obj: THREE.Object3D;
  /** Очередь пробуждения (0, 1, 2…). */
  order: number;
  /** Расстояние от центра до низа формы — высота над полом для тени. */
  low: number;
  /** Пятно тени: ширина по x и z, сила. */
  sx: number;
  sz: number;
  k: number;
  /** Положение и поворот формы в момент t. */
  drive: (t: number) => void;
}

export function makeHero(live: HeroLive, composition: Composition): Builder {
  const L = LAYOUTS[composition];
  const FLOOR = L.floor;
  const fov = L.fov;
  const DIST = L.frameH / 2 / Math.tan((fov * Math.PI) / 360);
  return ({ scene, camera, renderer, tier }) => {
    // Прозрачный холст без тонмаппинга: сцена лежит на фоне раздела.
    renderer.setClearColor(0xffffff, 0);
    renderer.toneMapping = THREE.NoToneMapping;

    // Мягкая студия: небо + ключ слева сверху + заполнение справа +
    // контровой сзади справа (светлый кант по краю форм).
    // Без тонмаппинга белое выгорает быстро: свет подобран так, чтобы
    // освещённая сторона керамики стояла у 245–250, теневая — у 175–190.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa9afbd, 0.32));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(-4, 6, 5);
    const fill = new THREE.DirectionalLight(0xeef1f8, 0.2);
    fill.position.set(5, 0.5, 4);
    const rim = new THREE.DirectionalLight(0xf2f5ff, 0.9);
    rim.position.set(4, 3, -6);
    scene.add(key, fill, rim);
    scene.environmentIntensity = 0.5;

    const root = new THREE.Group(); // наклон камеры и рука
    scene.add(root);

    // ── Материалы ───────────────────────────────────────────────────
    /** Кобальтовый лак (точки суши, бусины, узлы). */
    const lacquer = () =>
      new THREE.MeshPhysicalNodeMaterial({
        color: COBALT,
        roughness: 0.26,
        metalness: 0,
        specularIntensity: 0.5,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      });
    /** Белая матовая керамика. */
    const techWhite = new THREE.MeshPhysicalNodeMaterial({
      color: 0xececea,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.3,
      clearcoatRoughness: 0.2,
    });
    const beadMat = lacquer();

    // Хром в светлой студии выходит плоско-серым: металл читается по
    // тёмной полосе горизонта в отражении.
    const chrome = new THREE.MeshPhysicalNodeMaterial({ metalness: 1, roughness: 0.1 });
    {
      const ry = reflectVector.y;
      const horizon = float(1).sub(smoothstep(0.0, 0.24, ry.add(0.02).abs()));
      const sky = mix(color(0xd3d7de), color(0xffffff), smoothstep(-0.2, 0.45, ry));
      chrome.colorNode = mix(sky, color(0x2b2f37), horizon.mul(0.82));
    }

    // Матовое стекло — без физического пропускания (копия кадра с мипами
    // в половинной точности есть не везде в WebGL 2: в Safari сфера
    // выходила пустой). То, что видно сквозь стекло, считается прямо: луч
    // от камеры преломляется на поверхности и идёт 12 шагами мимо ядра
    // (поле расстояний сферы), ближайшее расстояние даёт размытое
    // кобальтовое сердце. Отражения и кант — физический слой поверх.
    const fres = float(1).sub(saturate(normalView.dot(positionViewDirection)));
    type V = ReturnType<typeof vec3>;
    /** Матовое стекло с кобальтовым ядром `core` внутри. */
    const frosted = (core: { c: U3; r: number }) => {
      const m = new THREE.MeshPhysicalNodeMaterial({
        color: 0x0b0e14,
        roughness: 0.26,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.035,
        specularIntensity: 0.75,
      });
      const eye = normalize(positionWorld.sub(cameraPosition));
      const ray = refract(eye, normalWorld, float(1 / 1.42));
      const at = (s: number) => positionWorld.add(ray.mul(s)) as unknown as V;
      const coreSdf = (q: V) => length(q.sub(core.c)).sub(core.r) as unknown as F;
      let dc = coreSdf(at(0.1));
      for (let i = 1; i < 12; i++) dc = min(dc, coreSdf(at(0.1 + i * 0.11))) as unknown as F;
      // Мягкий край — «матовость»: чем шире переход, тем сильнее размыто.
      const cover = float(1).sub(smoothstep(-0.2, 0.32, dc)).mul(0.92);
      const through = mix(color(0xf0f3f8), color(0x3a4ec6), cover);
      // Край стекла — холодный серый (толща по краю), середина светлее.
      m.emissiveNode = mix(through, color(0x8c95a8), fres.pow(1.6).mul(0.62));
      return m;
    };

    // ── Геометрия ───────────────────────────────────────────────────
    const bodies: Body[] = [];
    /** Пройденный «путь» для равномерного хода: интеграл пробуждения — скорость нарастает с нуля за 1,6 с, в t = 0 — поза постера. */
    const run = (t: number) => {
      const a = 0.1;
      const D = 1.6;
      const x = (t - a) / D;
      return t <= a ? 0 : x < 1 ? D * (x ** 3 - 0.5 * x ** 4) : D * 0.5 + (t - a - D);
    };
    /** Плавный старт: 0 → 1 за 1,6 с, по очереди с шагом 0,16 с. */
    const wake = (t: number, order: number) => {
      const x = Math.min(1, Math.max(0, (t - 0.1 - order * 0.16) / 1.6));
      return x * x * (3 - 2 * x);
    };
    /** То, что нужно пересчитать в мировых координатах каждый кадр (центр ядра). */
    const extras: (() => void)[] = [];
    const add = (obj: THREE.Object3D, at: P3, rot: P3, b: Omit<Body, "obj">) => {
      obj.position.set(...at);
      obj.rotation.set(...rot);
      root.add(obj);
      bodies.push({ obj, ...b });
    };

    const hiSphere = new THREE.SphereGeometry(1, pick(tier, [40, 56, 72] as const), pick(tier, [28, 40, 52] as const));
    const tm = new THREE.Matrix4();
    const tq = new THREE.Quaternion();
    const tp = new THREE.Vector3();
    const tsc = new THREE.Vector3();

    // Кометы света: голова и короткий хвост, аддитивно (дёшево — без
    // постобработки), яркость — атрибут на экземпляр.
    const pipLo = new THREE.SphereGeometry(1, 8, 6);
    const TRAIL = 5;
    const cometPaths: { curve: THREE.Curve<THREE.Vector3>; dir: 1 | -1; phase: number; period: number; size: number }[] = [];

    // ── Мягкий глобус ───────────────────────────────────────────────
    /** Дуги глобуса: прочерчивание светом при загрузке. */
    const softArcProg: ReturnType<typeof uniform>[] = [];
    const softArcAmp: ReturnType<typeof uniform>[] = [];
    let cityNodes: THREE.InstancedMesh | null = null;
    const cityPos: THREE.Vector3[] = [];
    const cityPhase: number[] = [];
    /** Масштаб узлов-городов — по радиусу глобуса. */
    let citySize = 1;
    const SG = L.softGlobe;
    if (SG) {
      const R0 = SG.r;
      const gg = new THREE.Group();
      const inner = new THREE.Group(); // вращение вокруг оси; наклон оси — на gg
      gg.add(inner);
      const ball = new THREE.Mesh(hiSphere, techWhite);
      ball.scale.setScalar(R0);
      inner.add(ball);
      // Точки суши — плоские кобальтовые диски на поверхности (8–10
      // треугольников на точку вместо сферы).
      const stepG = pick(tier, SG.density);
      const disc = new THREE.CircleGeometry(1, 10);
      const dotMat = lacquer();
      const pts: THREE.Vector3[] = [];
      WORLD_ROWS.forEach((row, ri) => {
        for (let ci = 0; ci < row.length; ci++) {
          if (row[ci] !== "#" || (ri + ci) % stepG !== 0) continue;
          const fl = THREE.MathUtils.degToRad(LAT_TOP - ri * CELL_DEG);
          const lo = THREE.MathUtils.degToRad(LON_LEFT + ci * CELL_DEG);
          pts.push(new THREE.Vector3(Math.cos(fl) * Math.sin(lo), Math.sin(fl), Math.cos(fl) * Math.cos(lo)));
        }
      });
      const dots = new THREE.InstancedMesh(disc, dotMat, pts.length);
      const discAxis = new THREE.Vector3(0, 0, 1);
      pts.forEach((n, i) => {
        tq.setFromUnitVectors(discAxis, n);
        // Размер точки не больше доли шага сетки — при полной плотности точки не слипаются.
        const rDot = Math.min(0.03 * R0 * (stepG === 3 ? 1.15 : 1), 0.38 * stepG * THREE.MathUtils.degToRad(CELL_DEG) * R0);
        dots.setMatrixAt(i, tm.compose(tp.copy(n).multiplyScalar(R0 * 1.004), tq, tsc.setScalar(rDot)));
      });
      inner.add(dots);
      // Города наших локаций — глянцевые кобальтовые бусины (пульсируют
      // после загрузки); дуги от Москвы — невысокие, чтобы не выходить из
      // кадра; по дугам бегут кометы.
      const onS = (lat: number, lon: number, rr: number) => {
        const fl = THREE.MathUtils.degToRad(lat);
        const lo = THREE.MathUtils.degToRad(lon);
        return new THREE.Vector3(rr * Math.cos(fl) * Math.sin(lo), rr * Math.sin(fl), rr * Math.cos(fl) * Math.cos(lo));
      };
      citySize = R0 / 1.05;
      for (const loc of LOCATIONS) {
        cityPos.push(onS(loc.lat, loc.lon, R0 * 1.012));
        cityPhase.push(hash(cityPos.length * 5.3));
      }
      cityNodes = new THREE.InstancedMesh(pipLo, lacquer(), cityPos.length);
      cityNodes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inner.add(cityNodes);
      const hub = onS(55.75, 37.62, R0);
      const byLat = [...LOCATIONS].sort((p1, p2) => p1.latencyMs - p2.latencyMs);
      const targets = [byLat[3], byLat[5], byLat[8], byLat[12], byLat[16]].filter(Boolean);
      targets.forEach((tl, k) => {
        const va = hub.clone().normalize();
        const vb = onS(tl.lat, tl.lon, R0).normalize();
        const ang = va.angleTo(vb);
        const ptsA: THREE.Vector3[] = [];
        for (let j = 0; j <= 24; j++) {
          const f = j / 24;
          const v = va.clone().multiplyScalar(Math.sin((1 - f) * ang)).addScaledVector(vb, Math.sin(f * ang)).divideScalar(Math.sin(ang) || 1);
          ptsA.push(v.multiplyScalar(R0 * (1.01 + 0.12 * ang * Math.sin(Math.PI * f))));
        }
        const arcCurve = new THREE.CatmullRomCurve3(ptsA);
        const prog = uniform(0);
        const amp = uniform(0);
        softArcProg.push(prog);
        softArcAmp.push(amp);
        const am = lacquer();
        {
          const ux = uv().x;
          const dh = ux.sub(prog).div(0.05);
          const head = exp(dh.mul(dh).negate());
          const trail = float(1).sub(smoothstep(prog.sub(0.004), prog, ux));
          am.emissiveNode = color(0xa9bcff).mul(head.mul(1.4).add(trail.mul(0.6)).mul(amp));
        }
        inner.add(new THREE.Mesh(new THREE.TubeGeometry(arcCurve, 40, 0.012 * (R0 / 1.35), 6, false), am));
        cometPaths.push({ curve: new LocalCurve(arcCurve, inner), dir: 1, phase: k * 0.23, period: 3.4, size: 0.05 * (R0 / 1.35) });
      });
      // Европа — к зрителю в кадре покоя.
      const lon0 = -THREE.MathUtils.degToRad(30);
      add(gg, SG.at, [SG.tilt, 0, 0.1], {
        order: 0,
        low: R0, sx: 1.9 * R0, sz: 1.9 * R0, k: 0.24,
        drive: (t) => {
          gg.position.set(SG.at[0], SG.at[1] + wake(t, 0) * 0.08 * Math.sin((TAU * t) / 11 + 0.4), SG.at[2]);
          gg.rotation.set(SG.tilt, 0, 0.1);
          inner.rotation.set(0, lon0 + (TAU / 60) * run(t), 0);
        },
      });
    }

    // ── Мягкая сеть: икосфера из узлов на стержнях вокруг матового ядра ──
    const SL = L.softLattice;
    if (SL) {
      const R0 = SL.r;
      const gg = new THREE.Group();
      const inner = new THREE.Group();
      gg.add(inner);
      const ico = new THREE.IcosahedronGeometry(R0, 1);
      const pos = ico.getAttribute("position") as THREE.BufferAttribute;
      const verts: THREE.Vector3[] = [];
      const idx: number[] = [];
      const seen = new Map<string, number>();
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        const vk = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
        if (!seen.has(vk)) {
          seen.set(vk, verts.length);
          verts.push(v);
        }
        idx.push(seen.get(vk)!);
      }
      ico.dispose();
      const edgeSet = new Set<string>();
      for (let i = 0; i < idx.length; i += 3)
        for (const [u, w] of [[idx[i], idx[i + 1]], [idx[i + 1], idx[i + 2]], [idx[i + 2], idx[i]]])
          edgeSet.add(u < w ? `${u}-${w}` : `${w}-${u}`);
      const edges = [...edgeSet].map((e2) => e2.split("-").map(Number) as [number, number]);
      const nodeGeo = new THREE.SphereGeometry(1, pick(tier, [12, 16, 20] as const), pick(tier, [8, 12, 14] as const));
      const whites = verts.filter((_, i) => hash(i * 2.9) > 0.42);
      const cobalts = verts.filter((_, i) => hash(i * 2.9) <= 0.42);
      const nodeR = 0.13 * (R0 / 2.05);
      const wNodes = new THREE.InstancedMesh(nodeGeo, techWhite, whites.length);
      whites.forEach((v, i) => wNodes.setMatrixAt(i, tm.compose(v, tq.identity(), tsc.setScalar(nodeR))));
      const cNodes = new THREE.InstancedMesh(nodeGeo, beadMat, cobalts.length);
      cobalts.forEach((v, i) => cNodes.setMatrixAt(i, tm.compose(v, tq.identity(), tsc.setScalar(nodeR * 0.9))));
      const rods = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), chrome, edges.length);
      const dirV = new THREE.Vector3();
      const Yax = new THREE.Vector3(0, 1, 0);
      edges.forEach(([u, w], i) => {
        dirV.subVectors(verts[w], verts[u]);
        tp.addVectors(verts[u], verts[w]).multiplyScalar(0.5);
        tq.setFromUnitVectors(Yax, dirV.clone().normalize());
        rods.setMatrixAt(i, tm.compose(tp, tq, tsc.set(0.022 * (R0 / 2.05), dirV.length(), 0.022 * (R0 / 2.05))));
      });
      // Ядро — матовое стекло с кобальтовым сердцем (поле расстояний).
      const coreC = v3();
      const core = new THREE.Mesh(hiSphere, frosted({ c: coreC, r: 0.38 * (R0 / 2.05) }));
      core.scale.setScalar(0.82 * (R0 / 2.05));
      inner.add(wNodes, cNodes, rods, core);
      // Огни по нескольким стержням — кометы в координатах решётки.
      for (let k = 0; k < 9; k++) {
        const [u, w] = edges[Math.floor(hash(k * 7.7) * edges.length)];
        cometPaths.push({
          curve: new LocalCurve(new THREE.LineCurve3(verts[u].clone(), verts[w].clone()), inner),
          dir: hash(k * 3.1) > 0.5 ? 1 : -1,
          phase: hash(k * 5.9),
          period: 1.6 + hash(k * 1.3) * 1.4,
          size: 0.055 * (R0 / 2.05),
        });
      }
      add(gg, SL.at, [SL.tilt, 0, 0], {
        order: 0,
        low: R0, sx: 1.8 * R0, sz: 1.8 * R0, k: 0.2,
        drive: (t) => {
          gg.position.set(SL.at[0], SL.at[1] + wake(t, 0) * 0.08 * Math.sin((TAU * t) / 11 + 0.4), SL.at[2]);
          gg.rotation.set(SL.tilt, 0, 0);
          inner.rotation.set(0, (TAU / 50) * run(t), 0);
        },
      });
      extras.push(() => core.getWorldPosition(coreC.value));
    }

    let comets: THREE.InstancedMesh | null = null;
    let cometK: THREE.InstancedBufferAttribute | null = null;
    if (cometPaths.length) {
      const n = cometPaths.length * TRAIL;
      cometK = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
      cometK.setUsage(THREE.DynamicDrawUsage);
      const cm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      cm.colorNode = color(0xb7c7ff);
      cm.opacityNode = instancedDynamicBufferAttribute(cometK, "float") as unknown as F;
      comets = new THREE.InstancedMesh(pipLo, cm, n);
      comets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      comets.renderOrder = 4;
      root.add(comets);
    }

    // ── Тени на полу: гауссовы пятна ────────────────────────────────
    const NS = bodies.length + 1; // + общая подложка под группой
    const shadowK = new THREE.InstancedBufferAttribute(new Float32Array(NS), 1);
    shadowK.setUsage(THREE.DynamicDrawUsage);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicNodeMaterial({ color: 0x252a36, transparent: true, depthWrite: false });
    {
      const strength = instancedDynamicBufferAttribute(shadowK, "float") as unknown as F;
      const d = uv().sub(0.5).length().mul(2);
      shadowMat.opacityNode = exp(d.mul(d).mul(-4.5))
        .mul(float(1).sub(smoothstep(0.78, 1.0, d)))
        .mul(strength);
    }
    const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, NS);
    shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    shadows.renderOrder = 1;
    root.add(shadows);

    // ── Движение ────────────────────────────────────────────────────
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    const shadowAt = (i: number, x: number, y: number, z: number, low: number, sx: number, sz: number, k: number) => {
      const hgt = Math.max(0, y - low - FLOOR);
      const spread = 1 + 0.24 * hgt;
      // Ключ слева сверху — тень уходит вправо и назад.
      p.set(x + 0.2 * hgt, FLOOR + 0.004, z - 0.12 * hgt);
      q.identity();
      s.set(sx * spread, 1, sz * spread);
      shadows.setMatrixAt(i, m4.compose(p, q, s));
      shadowK.array[i] = k / (1 + 0.5 * hgt);
    };
    // Общая подложка — очень слабое широкое пятно, «сажает» группу.
    p.set(L.under.x, FLOOR + 0.002, 0);
    s.set(L.under.sx, 1, L.under.sz);
    shadows.setMatrixAt(NS - 1, m4.compose(p, q.identity(), s));
    shadowK.array[NS - 1] = L.under.k;

    /** Плавная ступенька. */
    const sm = (a: number, b: number, x: number) => {
      const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return u * u * (3 - 2 * u);
    };

    return {
      radius: 6,
      stillT: 0,
      frame(w, h) {
        // Кадр вписан в блок как object-fit: contain — так же, как постер.
        const [ox, oy] = live.align();
        const fw = Math.min(w, h * L.aspect);
        const fh = fw / L.aspect;
        camera.fov = fov;
        camera.aspect = L.aspect;
        camera.position.set(0, 0, DIST);
        camera.near = Math.max(0.1, DIST - 12);
        camera.far = DIST + 14;
        camera.setViewOffset(fw, fh, -(w - fw) * ox, -(h - fh) * oy, w, h);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
      },
      update({ t, px, py }) {
        bodies.forEach((b, i) => {
          b.drive(t);
          if (L.settle) {
            // Загрузка: форма чуть приподнимается и садится (по очереди), от позы постера.
            const x = (t - 0.15 - b.order * 0.12) / 0.65;
            if (x > 0 && x < 1) b.obj.position.y += 0.16 * Math.sin(Math.PI * x);
          }
          const o = b.obj.position;
          shadowAt(i, o.x, o.y, o.z, b.low, b.sx, b.sz, b.k);
        });
        shadows.instanceMatrix.needsUpdate = true;
        shadowK.needsUpdate = true;

        // ЗАГРУЗКА (после кадра постера, ~2 с) и холостой ход. В t = 0 всё
        // в позе постера: дуги не прочерчены, комет нет.
        if (softArcProg.length) {
          const drawAmpS = sm(0.85, 0.95, t) * (1 - sm(1.9, 2.5, t));
          softArcProg.forEach((u, i) => {
            u.value = sm(0, 1, (t - 0.9 - i * 0.12) / 0.8);
            softArcAmp[i].value = drawAmpS;
          });
        }
        if (cityNodes) {
          for (let i = 0; i < cityPos.length; i++) {
            const pulse = 0.5 + 0.5 * Math.sin(TAU * (t / 2.6 + cityPhase[i]));
            const sz = (0.022 + 0.014 * pulse * sm(1.4, 2.0, t)) * citySize;
            cityNodes.setMatrixAt(i, m4.compose(cityPos[i], q.identity(), s.setScalar(sz)));
          }
          cityNodes.instanceMatrix.needsUpdate = true;
        }
        if (comets && cometK) {
          // Кометы начинают течь после загрузки.
          const flow = sm(1.6, 2.2, t);
          const ck = cometK.array as Float32Array;
          let k = 0;
          for (const cp of cometPaths) {
            const f0 = (((run(t) / cp.period + cp.phase) % 1) + 1) % 1;
            for (let j = 0; j < TRAIL; j++) {
              const fj = f0 - j * 0.022;
              const f = cp.dir === 1 ? fj : 1 - fj;
              const inside = fj >= 0 && fj <= 1;
              cp.curve.getPointAt(Math.min(1, Math.max(0, f)), p);
              const edge = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, fj))), 0.5);
              const sz = cp.size * (1 - j * 0.16) * (inside ? 1 : 0);
              comets.setMatrixAt(k, m4.compose(p, q.identity(), s.setScalar(sz)));
              ck[k] = (j === 0 ? 1 : 0.55 - j * 0.1) * edge * flow;
              k++;
            }
          }
          comets.instanceMatrix.needsUpdate = true;
          cometK.needsUpdate = true;
        }

        // Рука: наклон всей группы на несколько градусов — параллакс по глубине.
        root.rotation.set(TILT + py * 0.035, px * 0.07, 0);
        root.updateMatrixWorld(true);
        for (const f of extras) f();
      },
      dispose() {},
    };
  };
}
