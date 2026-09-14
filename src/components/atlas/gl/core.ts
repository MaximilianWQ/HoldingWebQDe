/**
 * Тяжёлая часть рантайма: three.js, рендерер, студийный свет.
 * Грузится только из `stage.ts` динамическим импортом — в основной
 * бандл не попадает.
 *
 * Рендерер — WebGPURenderer: WebGPU там, где он есть, и сам уходит на
 * WebGL 2, где его нет. Шейдеры сцен написаны на TSL и собираются под
 * оба бэкенда.
 */
import * as THREE from "three/webgpu";
import type { Tier } from "./stage";

export { THREE };

export async function createRenderer(canvas: HTMLCanvasElement, tier: Tier): Promise<THREE.WebGPURenderer> {
  const r = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: true,
    // Слабому устройству — 8-битный буфер вывода: вдвое меньше полосы.
    outputBufferType: tier === 0 ? THREE.UnsignedByteType : THREE.HalfFloatType,
  });
  r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.NeutralToneMapping;
  r.toneMappingExposure = 1;
  await r.init();
  return r;
}

export function isWebGPU(r: THREE.WebGPURenderer): boolean {
  return (r.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
}

/**
 * Мягкая студия для отражений: светлая комната и четыре софтбокса.
 * Строится процедурно (без HDR-файла и без аддона RoomEnvironment,
 * который тянет WebGL-сборку three целиком) и сворачивается в PMREM.
 */
export function studioEnv(r: THREE.WebGPURenderer, tier: Tier): THREE.RenderTarget {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(12, 12, 12),
    new THREE.MeshBasicNodeMaterial({ color: 0xdcdde0, side: THREE.BackSide })
  );
  env.add(room);
  const panel = (pw: number, ph: number, power: number, x: number, y: number, z: number, tint = 0xffffff) => {
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    m.color = new THREE.Color(tint).multiplyScalar(power);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), m);
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    env.add(p);
  };
  panel(7, 7, 2.2, 0, 5.8, 0.5); // потолок
  panel(3.2, 5, 4.5, -5.8, 2.0, 3.2); // ключ слева спереди
  panel(2.4, 4, 1.2, 5.8, 0.4, 2.6); // заполнение справа
  panel(4, 1.6, 2.2, 1.6, 1.8, -5.8); // контровой сзади

  const pm = new THREE.PMREMGenerator(r);
  const rt = pm.fromScene(env, 0.04, 0.1, 30, { size: tier === 0 ? 128 : 256 });
  pm.dispose();
  disposeScene(env);
  return rt;
}

/** Небесный свет + ключ + мягкое заполнение. Без теней. */
export function addLights(scene: THREE.Scene, key = 1.5): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd1d6, 0.55));
  const k = new THREE.DirectionalLight(0xffffff, key);
  k.position.set(-3, 4, 5);
  scene.add(k);
  const f = new THREE.DirectionalLight(0xf3f4f8, 0.35);
  f.position.set(4, -1.5, 3);
  scene.add(f);
}

export function countTriangles(scene: THREE.Object3D): number {
  let n = 0;
  scene.traverse((o) => {
    // Инстансный спрайт: по два треугольника на экземпляр.
    const sp = o as THREE.Sprite & { count?: number };
    if (sp.isSprite) {
      n += 2 * (sp.count ?? 1);
      return;
    }
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const verts = g.index ? g.index.count : g.getAttribute("position").count;
    const inst = (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1;
    n += (verts / 3) * inst;
  });
  return Math.round(n);
}

export function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) mat?.dispose();
    if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
  });
  scene.clear();
}
