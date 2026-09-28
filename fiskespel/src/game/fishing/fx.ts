/**
 * Fishing visuals: the line (camera-facing ribbon with sag / wind bow / vibration), expanding
 * water rings, and small fallback models (bobber / fish) for when the registry has none yet.
 * OWNER: fishing.
 */
import * as THREE from 'three';
import { BOBBER_LINE_NAME } from '../../core/types';

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpD = new THREE.Vector3();

export interface LineShape {
  /** Downward sag at the middle (m). */
  sag: number;
  /** Sideways bow at the middle (world vector, m) — wind. */
  bow?: THREE.Vector3;
  /** Vibration amplitude (m) and time. */
  vib?: number;
  time?: number;
  /** Keep the line above this height except at the very end (water surface). */
  floorY?: number;
}

/**
 * A thin monofilament drawn as a camera-facing triangle strip (one draw call), at least
 * ~1.3 px wide at any distance so it never aliases away.
 */
export class FishingLine {
  readonly mesh: THREE.Mesh;
  private readonly n: number;
  private readonly pos: Float32Array;
  private readonly pts: THREE.Vector3[];
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly baseColor = new THREE.Color('#eef4f2');

  constructor(segments = 48) {
    this.n = segments;
    const verts = (segments + 1) * 2;
    this.pos = new Float32Array(verts * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    const alpha = new Float32Array(verts);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // fade out right at the rod tip and where the line enters the water
      const a = Math.min(1, t / 0.02) * Math.min(1, (1 - t) / 0.015 + 0.25);
      alpha[i * 2] = a;
      alpha[i * 2 + 1] = a;
    }
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    const idx: number[] = [];
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.mat = new THREE.MeshBasicMaterial({
      color: this.baseColor.clone(),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: true,
    });
    this.mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float alpha;\nvarying float vLineAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLineAlpha = alpha;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLineAlpha;')
        .replace('#include <opaque_fragment>', 'diffuseColor.a *= vLineAlpha;\n#include <opaque_fragment>');
    };
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.name = 'fishingLine';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.pts = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
  }

  set visible(v: boolean) {
    this.mesh.visible = v;
  }
  get visible(): boolean {
    return this.mesh.visible;
  }

  /** Dim the (unlit) line at night. light = 0..1. */
  setLight(light: number): void {
    this.mat.color.copy(this.baseColor).multiplyScalar(0.28 + 0.72 * light);
  }

  /** Recompute the curve from `a` (rod tip) to `b` (bobber) and rebuild the ribbon. */
  update(a: THREE.Vector3, b: THREE.Vector3, shape: LineShape, camera: THREE.PerspectiveCamera, viewportH: number): void {
    const n = this.n;
    const bow = shape.bow;
    const vib = shape.vib ?? 0;
    const time = shape.time ?? 0;
    // vibration axis: horizontal, perpendicular to the line
    tmpC.subVectors(b, a);
    tmpD.set(-tmpC.z, 0, tmpC.x);
    if (tmpD.lengthSq() < 1e-8) tmpD.set(1, 0, 0);
    tmpD.normalize();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = this.pts[i].lerpVectors(a, b, t);
      // catenary-ish sag, heavier towards the water end
      const s = 4 * t * (1 - t);
      p.y -= shape.sag * s * (0.75 + 0.5 * t);
      if (bow) p.addScaledVector(bow, s);
      if (vib > 0) {
        const w = Math.sin(Math.PI * t) * (Math.sin(time * 61 + t * 9) * 0.6 + Math.sin(time * 37 - t * 5) * 0.4);
        p.addScaledVector(tmpD, vib * w);
        p.y += vib * 0.5 * Math.sin(Math.PI * t) * Math.sin(time * 53 + t * 7);
      }
      if (shape.floorY !== undefined && t < 0.985 && p.y < shape.floorY) p.y = shape.floorY;
    }
    // camera-facing ribbon
    const pxAngle = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(1, viewportH);
    const cam = camera.position;
    for (let i = 0; i <= n; i++) {
      const p = this.pts[i];
      const q = this.pts[Math.min(n, i + 1)];
      const r = this.pts[Math.max(0, i - 1)];
      tmpA.subVectors(q, r); // tangent
      tmpB.subVectors(p, cam);
      const dist = tmpB.length();
      tmpA.cross(tmpB);
      if (tmpA.lengthSq() < 1e-12) tmpA.set(0, 1, 0);
      tmpA.normalize();
      const half = Math.max(0.0015, dist * pxAngle * 0.68);
      const o = i * 6;
      this.pos[o] = p.x + tmpA.x * half;
      this.pos[o + 1] = p.y + tmpA.y * half;
      this.pos[o + 2] = p.z + tmpA.z * half;
      this.pos[o + 3] = p.x - tmpA.x * half;
      this.pos[o + 4] = p.y - tmpA.y * half;
      this.pos[o + 5] = p.z - tmpA.z * half;
    }
    const attr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

// ─────────────────────────────────────────────────────────────── rings

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  dur: number;
  radius: number;
  strength: number;
}

/** Pool of expanding ripple rings on a water surface (bite, landing, fight). */
export class RingPool {
  readonly group = new THREE.Group();
  private rings: Ring[] = [];
  private static geo: THREE.RingGeometry | null = null;

  constructor(count = 6) {
    this.group.name = 'fishingRings';
    RingPool.geo ??= new THREE.RingGeometry(0.82, 1, 48, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: true });
      const mesh = new THREE.Mesh(RingPool.geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, t: 1, dur: 1, radius: 1, strength: 0 });
    }
  }

  spawn(pos: THREE.Vector3, radius: number, duration: number, strength = 0.7, color: THREE.ColorRepresentation = 0xffffff): void {
    let r = this.rings.find((x) => x.t >= 1);
    if (!r) r = this.rings.reduce((a, b) => (a.t > b.t ? a : b));
    r.t = 0;
    r.dur = duration;
    r.radius = radius;
    r.strength = strength;
    r.mat.color.set(color);
    r.mesh.position.set(pos.x, pos.y + 0.025, pos.z);
    r.mesh.visible = true;
  }

  update(dt: number, heightAt?: (x: number, z: number) => number): void {
    for (const r of this.rings) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt / r.dur);
      const e = 1 - Math.pow(1 - r.t, 2.2);
      const s = 0.08 + r.radius * e;
      r.mesh.scale.set(s, 1, s);
      r.mat.opacity = r.strength * Math.pow(1 - r.t, 1.4);
      if (heightAt) r.mesh.position.y = heightAt(r.mesh.position.x, r.mesh.position.z) + 0.025;
      if (r.t >= 1) r.mesh.visible = false;
    }
  }

  clear(): void {
    for (const r of this.rings) {
      r.t = 1;
      r.mesh.visible = false;
    }
  }
}

// ─────────────────────────────────────────────────────────────── fallback models

let bobberMats: { red: THREE.MeshStandardMaterial; white: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial } | null = null;

/** Classic red/white float (used only when no 'bobber' model is registered). ~0.12 m, waterline y = 0. */
export function buildFallbackBobber(): THREE.Object3D {
  bobberMats ??= {
    red: new THREE.MeshStandardMaterial({ color: '#c8202b', roughness: 0.28, metalness: 0.0 }),
    white: new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1c1a19', roughness: 0.5 }),
  };
  const g = new THREE.Group();
  g.name = 'bobber:fallback';
  const r = 0.042;
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), bobberMats.red);
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bobberMats.white);
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.995, 0.0035, 6, 28).rotateX(Math.PI / 2), bobberMats.dark);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.005, 0.07, 8), bobberMats.red);
  stem.position.y = r + 0.03;
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.0025, 0.035, 8), bobberMats.white);
  keel.position.y = -r - 0.012;
  for (const m of [top, bottom, band]) m.position.y = 0.012;
  g.add(top, bottom, band, stem, keel);
  const attach = new THREE.Object3D();
  attach.name = BOBBER_LINE_NAME;
  attach.position.y = r + 0.066;
  g.add(attach);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return g;
}

/** Simple stylised fish (used only when the registry has no model for a species). Length 1, head +Z. */
export function buildFallbackFish(color: THREE.ColorRepresentation, accent: THREE.ColorRepresentation = '#f4efe2'): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'fish:fallback';
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 16),
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  );
  body.scale.set(0.22, 0.34, 0.8);
  body.position.z = 0.06;
  const finMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.quadraticCurveTo(-0.08, 0.16, -0.02, 0.2);
  tailShape.lineTo(0.02, 0.02);
  tailShape.lineTo(0.02, -0.02);
  tailShape.lineTo(-0.02, -0.2);
  tailShape.quadraticCurveTo(-0.08, -0.16, 0, 0);
  const tail = new THREE.Mesh(new THREE.ShapeGeometry(tailShape, 8), finMat);
  tail.rotation.y = Math.PI / 2;
  tail.position.z = -0.36;
  tail.scale.setScalar(1.3);
  const dorsal = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0.14, 0), new THREE.Vector2(-0.12, 0), new THREE.Vector2(-0.08, 0.1)])), finMat);
  dorsal.rotation.y = Math.PI / 2;
  dorsal.position.set(0, 0.15, 0.04);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.1 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), eyeMat);
  eyeL.position.set(0.075, 0.045, 0.33);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.075;
  g.add(body, tail, dorsal, eyeL, eyeR);
  tail.userData.animate = (t: number) => {
    tail.rotation.x = 0;
    tail.rotation.y = Math.PI / 2 + Math.sin(t * 9) * 0.35;
  };
  return g;
}

/** Collect `userData.animate` callbacks of a model (fish tail sway etc.). */
export function collectAnimators(obj: THREE.Object3D): ((t: number) => void)[] {
  const out: ((t: number) => void)[] = [];
  obj.traverse((o) => {
    const f = o.userData?.animate;
    if (typeof f === 'function') out.push(f as (t: number) => void);
  });
  return out;
}

/**
 * Free a caught-fish model after its reveal. Calls `userData.dispose()` when the builder provides
 * one; otherwise frees geometries only (safe even if shared — three re-uploads on next use) and
 * leaves materials/textures alone because model families cache and share them.
 */
export function disposeModel(obj: THREE.Object3D): void {
  const custom = obj.userData?.dispose;
  if (typeof custom === 'function') {
    (custom as () => void)();
    return;
  }
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry && !m.userData?.sharedGeometry) m.geometry.dispose();
  });
}
