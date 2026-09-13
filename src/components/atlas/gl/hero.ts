/**
 * Первый экран — «канал» (замена петли Blender «AtlasObjects», 30 fps).
 *
 * Кобальтовое кольцо-канал стоит почти ребром к зрителю, ось — вдоль
 * кадра; сквозь него слева направо летят хромированные капсулы — пакеты
 * данных, по пути они проходят и сквозь стеклянную сферу. Вокруг —
 * керамические сферы, кобальтовая бусина, хромированный кубик со
 * скруглёнными гранями, ступенчатая шайба и малое кольцо, лежащее на
 * полу плашмя. Всё мягко покачивается; у каждой формы — мягкая тень.
 *
 * КАДР. Сцена разложена в плоскости z = 0 по кадру постера: 16 × 9
 * единиц на 1600 × 900 px (`FRAME_UNITS`), начало координат — центр
 * кадра. HeroGL кадрирует камеру тем же cover, что у постера, — формы
 * встают туда же, где они на картинке.
 *
 * БУМАГА. Фон непрозрачный, цвета листа (#FFFFFF), тонмаппинга нет:
 * белое остаётся ровно 255 и уходит в лист через маску блока. Прозрачный
 * холст не годится: стекло с пропусканием берёт то, что за ним, и на
 * прозрачном фоне становится чёрным, а тень на «пустоте» не видна.
 *
 * СТЕКЛО. Уровень 2 — физическое пропускание (преломляет капсулу и лист
 * за собой; один дополнительный проход копии кадра). Уровни 0–1 —
 * прозрачная сфера с френелевым краем и лаком, без прохода.
 *
 * ТЕНИ — не карта теней (второй проход всей сцены каждый кадр), а
 * гауссовы пятна на полу одной инстансной отрисовкой. Чем выше форма над
 * полом, тем пятно шире и бледнее; сдвиг — от ключевого света слева.
 *
 * ДВИЖЕНИЕ — только от времени `t` (с): покачивание, повороты, путь
 * капсул. Частота кадров на него не влияет; 60, 120 и 144 Гц дают один и
 * тот же ход, только плавнее. «Нырок» при уходе первого экрана — сцена
 * подходит к камере, прогресс сглаживается экспонентой от dt.
 *
 * БЮДЖЕТ (треугольники, замер `data-tris` на блоке 13.09.2026). Уровень
 * 2 — 48 342, уровень 1 — 29 598, уровень 0 — 19 462 при потолке 60k.
 * Отрисовок — 16, материалов — 5 (стекло с пропусканием — только уровень 2).
 */
import * as THREE from "three/webgpu";
import {
  color,
  exp,
  float,
  instancedDynamicBufferAttribute,
  mix,
  normalView,
  positionViewDirection,
  reflectVector,
  saturate,
  smoothstep,
  uv,
} from "three/tsl";
import type { Builder, Tier } from "./stage";

/** Живые параметры: HeroGL пишет долю ухода первого экрана, сцена читает каждый кадр. */
export interface HeroLive {
  dive: number;
}

/** Единиц сцены на ширину кадра постера (1600 px). HeroGL кадрирует по нему. */
export const FRAME_UNITS = 16;

/** Альбедо кобальта: в свете студии выходит к #2A3AD6 постера. */
const COBALT = 0x1026a8;
const FLOOR = -3;
const TAU = Math.PI * 2;
/** Камера смотрит чуть сверху, как в рендере Blender. */
const TILT = 0.14;
/** Путь капсул: от −SPAN/2 до SPAN/2 по x — за краями кадра при любом cover. */
const SPAN = 26;
const SPEED = 3.4;
/** Точка, к которой «ныряет» камера (42 % / 60 % кадра — как у CSS-нырка постера). */
const FOCUS = { x: -0.08 * FRAME_UNITS, y: -0.1 * 9 };

const pick = <T>(tier: Tier, v: readonly [T, T, T]): T => v[tier];

/** Куб со скруглёнными рёбрами: сетка BoxGeometry сжата к граням и обёрнута радиусом. */
function roundedBox(size: number, radius: number, seg: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const h = size / 2 - radius;
  // Один шаг сетки от центра — плоская часть грани, остальные — скругление:
  // иначе на ребро приходилось два шага и оно шло гранями.
  const flat = 1 / seg;
  const map = (v: number) => {
    const a = Math.abs(v);
    return Math.sign(v) * (a <= flat ? (a / flat) * h : h + ((a - flat) / (0.5 - flat)) * radius);
  };
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.set(map(pos.getX(i)), map(pos.getY(i)), map(pos.getZ(i)));
    c.set(THREE.MathUtils.clamp(p.x, -h, h), THREE.MathUtils.clamp(p.y, -h, h), THREE.MathUtils.clamp(p.z, -h, h));
    n.subVectors(p, c);
    if (n.lengthSq() < 1e-10) n.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    n.normalize();
    p.copy(c).addScaledVector(n, radius);
    pos.setXYZ(i, p.x, p.y, p.z);
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  return g;
}

/** Диск со скруглённой кромкой — ступени шайбы. */
function roundedDisc(r: number, height: number, bevel: number, seg: number): THREE.LatheGeometry {
  const b = Math.min(bevel, height / 2, r);
  const pts = [new THREE.Vector2(0, -height / 2)];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, -height / 2 + b + Math.sin(a) * b));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, height / 2 - b + Math.sin(a) * b));
  }
  pts.push(new THREE.Vector2(0, height / 2));
  return new THREE.LatheGeometry(pts, seg);
}

/** Форма, которая покачивается и отбрасывает тень. */
interface Body {
  obj: THREE.Object3D;
  base: THREE.Vector3;
  /** Амплитуда и период покачивания, фаза. */
  amp: number;
  period: number;
  phase: number;
  /** Расстояние от центра до низа формы — для высоты над полом. */
  low: number;
  /** Пятно тени у пола: ширина по x и z, сила. */
  sx: number;
  sz: number;
  k: number;
}

export function makeHero(live: HeroLive): Builder {
  return ({ scene, camera, renderer, tier }) => {
    // Бумага: непрозрачный белый без тонмаппинга (см. шапку файла).
    renderer.setClearColor(0xffffff, 1);
    renderer.toneMapping = THREE.NoToneMapping;
    // Свет свой, не addLights: без тонмаппинга общий небесный свет
    // размывал кобальт в пастель. Здесь небо слабее, ключ сильнее —
    // тело кольца глубокое, блики резкие, как в рендере.
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc3c7d0, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(-3, 4, 5);
    const fill = new THREE.DirectionalLight(0xf1f3f8, 0.3);
    fill.position.set(4, -1, 3);
    scene.add(key, fill);
    scene.environmentIntensity = 0.8;

    const root = new THREE.Group(); // наклон камеры, рука, нырок
    scene.add(root);

    // ── Материалы ───────────────────────────────────────────────────
    // Отражение светлой студии ложится на лак ровной белёсой пеленой:
    // зеркальность ниже, лак тоньше — кобальт остаётся кобальтом.
    const cobalt = new THREE.MeshPhysicalNodeMaterial({
      color: COBALT,
      roughness: 0.3,
      metalness: 0,
      specularIntensity: 0.3,
      clearcoat: 0.5,
      clearcoatRoughness: 0.05,
    });
    const ceramic = new THREE.MeshPhysicalNodeMaterial({
      color: 0xe6e6e6,
      roughness: 0.4,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.16,
    });
    // Зеркало в светлой студии выходит плоско-серым. В рендере хром
    // читается металлом по тёмной полосе горизонта (пол и фон белые):
    // её и даём — узкая тёмная полоса у горизонта отражения, низ чуть
    // серее верха.
    const chrome = new THREE.MeshPhysicalNodeMaterial({ metalness: 1, roughness: 0.08 });
    {
      const ry = reflectVector.y;
      const horizon = float(1).sub(smoothstep(0.0, 0.2, ry.add(0.03).abs()));
      const sky = mix(color(0xdcdfe5), color(0xf7f8fa), smoothstep(-0.3, 0.3, ry));
      chrome.colorNode = mix(sky, color(0x3f444d), horizon.mul(0.85));
    }

    // На белом стеклу нечего преломлять, и сфера выходила молочной. В
    // рендере её читают по трём признакам — их и даём: край темнее
    // середины, перевёрнутый горизонт серой полосой выше центра, тёмный
    // серп пола внизу.
    const fres = float(1).sub(saturate(normalView.dot(positionViewDirection)));
    const ny = normalView.y;
    const glassBand = float(1)
      .sub(smoothstep(0.0, 0.14, ny.sub(0.24).abs()))
      .mul(0.55)
      .add(smoothstep(-0.25, -0.8, ny).mul(0.45));
    const glassTint = mix(mix(color(0xffffff), color(0x8e95a1), glassBand), color(0x7d838e), fres.pow(1.8));
    let glass: THREE.MeshPhysicalNodeMaterial;
    if (tier === 2) {
      glass = new THREE.MeshPhysicalNodeMaterial({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.03,
        transmission: 1,
        thickness: 1.6,
        ior: 1.4,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        transparent: true,
      });
      // Цвет стекла умножает пропущенный свет.
      glass.colorNode = glassTint;
    } else {
      glass = new THREE.MeshPhysicalNodeMaterial({
        metalness: 0,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        transparent: true,
        depthWrite: false,
      });
      glass.colorNode = glassTint;
      glass.opacityNode = mix(float(0.05), float(0.8), fres.pow(2)).add(glassBand.mul(0.35));
    }

    // ── Геометрия ───────────────────────────────────────────────────
    const sphereGeo = new THREE.SphereGeometry(1, pick(tier, [40, 48, 64] as const), pick(tier, [28, 36, 48] as const));
    const bodies: Body[] = [];
    const add = (mesh: THREE.Object3D, b: Omit<Body, "obj" | "base">, at: [number, number, number]) => {
      mesh.position.set(...at);
      root.add(mesh);
      bodies.push({ obj: mesh, base: new THREE.Vector3(...at), ...b });
      return mesh;
    };
    const ball = (mat: THREE.Material, r: number) => {
      const m = new THREE.Mesh(sphereGeo, mat);
      m.scale.setScalar(r);
      return m;
    };

    // Кольцо-канал: ось почти вдоль кадра, капсулы проходят сквозь него.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.75, 0.6, pick(tier, [24, 32, 40] as const), pick(tier, [84, 104, 128] as const)),
      cobalt
    );
    add(ring, { amp: 0.1, period: 7.5, phase: 0, low: 3.3, sx: 1.6, sz: 4.2, k: 0.34 }, [0, 0.45, 0]);

    // Малое кольцо лежит на полу впереди.
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.3, pick(tier, [14, 20, 24] as const), pick(tier, [48, 60, 72] as const)),
      cobalt
    );
    hoop.rotation.x = -Math.PI / 2 + 0.12;
    add(hoop, { amp: 0.04, period: 6, phase: 1.2, low: 0.3, sx: 2.9, sz: 2.9, k: 0.3 }, [1.9, FLOOR + 0.32, 2.3]);

    add(ball(cobalt, 0.55), { amp: 0.2, period: 6.4, phase: 0.6, low: 0.55, sx: 1.3, sz: 1.3, k: 0.22 }, [-3.6, 2.2, -1]);
    add(ball(ceramic, 0.75), { amp: 0.16, period: 8, phase: 2.1, low: 0.75, sx: 1.7, sz: 1.7, k: 0.2 }, [5.6, 2.6, -2]);
    add(ball(ceramic, 1.1), { amp: 0.12, period: 9, phase: 4, low: 1.1, sx: 2.4, sz: 2.4, k: 0.26 }, [-5.2, 0.05, -1.5]);
    add(ball(glass, 1.3), { amp: 0.14, period: 7, phase: 3, low: 1.3, sx: 2.8, sz: 2.8, k: 0.16 }, [3.2, -0.2, -0.3]).renderOrder = 2;

    const cube = new THREE.Mesh(roundedBox(1.55, 0.26, pick(tier, [8, 10, 14] as const)), chrome);
    cube.rotation.set(0.08, 0.55, 0.04);
    add(cube, { amp: 0.1, period: 6.8, phase: 5, low: 0.8, sx: 2, sz: 2, k: 0.3 }, [-3.6, -0.95, 0.2]);

    // Шайба: хромированное основание на полу, белая ступень, кобальтовая крышка над ней.
    const discSeg = pick(tier, [40, 48, 64] as const);
    const puck = new THREE.Group();
    const base = new THREE.Mesh(roundedDisc(1.9, 0.14, 0.06, discSeg), chrome);
    const mid = new THREE.Mesh(roundedDisc(1.35, 0.46, 0.14, discSeg), ceramic);
    const cap = new THREE.Mesh(roundedDisc(0.86, 0.26, 0.11, discSeg), cobalt);
    base.position.y = 0.07;
    mid.position.y = 0.14 + 0.23;
    cap.position.y = 0.14 + 0.46 + 0.22 + 0.13;
    puck.add(base, mid, cap);
    puck.rotation.set(0.04, 0, -0.03);
    add(puck, { amp: 0, period: 1, phase: 0, low: 0, sx: 4.4, sz: 4.4, k: 0.24 }, [-5.3, FLOOR, 2]);
    const capBase = cap.position.y;

    // Капсулы — пакеты данных: одна инстансная отрисовка на три.
    const capGeo = new THREE.CapsuleGeometry(0.26, 1.9, pick(tier, [5, 6, 8] as const), pick(tier, [16, 20, 24] as const));
    capGeo.rotateZ(Math.PI / 2);
    const LANES = [
      { y: 0.55, z: 0.1 },
      { y: 0.3, z: -0.1 },
      { y: 0.8, z: 0.45 },
    ];
    const capsules = new THREE.InstancedMesh(capGeo, chrome, LANES.length);
    capsules.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    root.add(capsules);

    // ── Тени: гауссовы пятна на полу ────────────────────────────────
    const NS = bodies.length + LANES.length;
    const shadowK = new THREE.InstancedBufferAttribute(new Float32Array(NS), 1);
    shadowK.setUsage(THREE.DynamicDrawUsage);
    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicNodeMaterial({ color: 0x262a34, transparent: true, depthWrite: false });
    {
      // Приведение только для TS: перегрузки mul в типах three не
      // принимают узел атрибута (так же в globe.ts). В шейдере — float.
      type F = ReturnType<typeof float>;
      const strength = instancedDynamicBufferAttribute(shadowK, "float") as unknown as F;
      const d = uv().sub(0.5).length().mul(2);
      shadowMat.opacityNode = exp(d.mul(d).mul(-4.2))
        .mul(float(1).sub(smoothstep(0.8, 1.0, d)))
        .mul(strength);
    }
    const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, NS);
    shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Раньше стекла: пропускание берёт кадр вместе с тенью под сферой.
    shadows.renderOrder = 1;
    root.add(shadows);

    // ── Движение ────────────────────────────────────────────────────
    let dive = 0;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const wp = new THREE.Vector3();

    const shadowAt = (i: number, x: number, y: number, z: number, low: number, sx: number, sz: number, k: number, yaw = 0) => {
      const hgt = Math.max(0, y - low - FLOOR);
      const spread = 1 + 0.32 * hgt;
      // Ключевой свет слева спереди — тень уходит вправо и назад.
      p.set(x + 0.28 * hgt, FLOOR + 0.004, z - 0.18 * hgt);
      q.setFromEuler(e.set(0, yaw, 0));
      s.set(sx * spread, 1, sz * spread);
      shadows.setMatrixAt(i, m.compose(p, q, s));
      shadowK.array[i] = k / (1 + 0.55 * hgt);
    };

    return {
      radius: 6,
      stillT: 2.2,
      update({ t, dt, px, py }) {
        // dt = 0 — первый кадр: сразу в цель.
        dive += (live.dive - dive) * (dt === 0 ? 1 : 1 - Math.exp(-dt * 7));

        bodies.forEach((b, i) => {
          b.obj.position.y = b.base.y + b.amp * Math.sin((TAU * t) / b.period + b.phase);
          wp.copy(b.obj.position);
          const yaw = b.obj === ring ? ring.rotation.y : 0;
          shadowAt(i, wp.x, wp.y, wp.z, b.low, b.sx, b.sz, b.k, yaw);
        });

        ring.rotation.set(0.04 * Math.sin((TAU * t) / 11), 1.3 + 0.13 * Math.sin((TAU * t) / 9), 0.05);
        hoop.rotation.z = 0.25 + 0.05 * Math.sin((TAU * t) / 6);
        cube.rotation.y = 0.55 + t * 0.11;
        cube.rotation.x = 0.08 + 0.05 * Math.sin((TAU * t) / 7);
        cap.position.y = capBase + 0.05 * Math.sin((TAU * t) / 4.6);

        LANES.forEach((l, i) => {
          const x = -SPAN / 2 + ((t * SPEED + (i * SPAN) / LANES.length) % SPAN);
          const y = l.y + 0.08 * Math.sin(t * 1.3 + i * 2.1);
          p.set(x, y, l.z);
          q.setFromEuler(e.set(0.3 * t + i, 0.08 * Math.sin(t * 0.9 + i), 0.04 * Math.sin(t * 1.1 + i)));
          s.setScalar(1);
          capsules.setMatrixAt(i, m.compose(p, q, s));
          shadowAt(bodies.length + i, x, y, l.z, 0.26, 3.2, 0.9, 0.12);
        });
        capsules.instanceMatrix.needsUpdate = true;
        shadows.instanceMatrix.needsUpdate = true;
        shadowK.needsUpdate = true;

        // Рука: поворот всей сцены — настоящий параллакс по глубине.
        root.rotation.set(TILT + py * 0.05, px * 0.1, 0);
        // Нырок: сцена подходит к камере, точка FOCUS стоит на месте.
        const dz = dive * 5.5;
        const dist = camera.position.z || 1;
        root.position.set((-FOCUS.x * dz) / dist, (-FOCUS.y * dz) / dist, dz);
      },
      dispose() {},
    };
  };
}
