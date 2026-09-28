/**
 * Sculpted procedural head: skull + face sculpt, eyes with ringed irises and blinking lids,
 * brows, nose, lips, ears, hair styles, beards and hats (OWNER: player author).
 * Everything is built in model space (rest pose) and bound to the head / lid joints.
 */
import * as THREE from 'three';
import { CharBuilder, type SurfaceProps } from './material';
import { clamp, ellipsoid, gauss, gauss2, lerp, patch, smooth, surface, surfaceOut, tube, type SurfFn } from './geo';
import { BI } from './rig';

const I4 = new THREE.Matrix4();

export interface HeadParams {
  C: THREE.Vector3;
  rx: number;
  ryT: number;
  ryB: number;
  rz: number;
  fem: boolean;
  age: 'young' | 'adult' | 'old';
  jaw: number;
  chin: number;
  cheek: number;
  brow: number;
  eyeDepth: number;
  eyeTh: number;
  eyeY: number;
  eyeR: number;
  noseLen: number;
  noseW: number;
  noseProj: number;
  noseHook: number;
  lipFull: number;
  mouthW: number;
  smile: number;
  earSize: number;
  cheekHollow: number;
}

const _d = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _p3 = new THREE.Vector3();

export class HeadShape {
  constructor(public h: HeadParams) {}

  dir(th: number, yN: number, out: THREE.Vector3): THREE.Vector3 {
    const y = clamp(yN, -1, 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    return out.set(r * Math.sin(th), y, r * Math.cos(th));
  }

  /** Surface point for a unit direction `d` (+ optional outward offset in metres). */
  pointDir(d: THREE.Vector3, out: THREE.Vector3, offset = 0): THREE.Vector3 {
    const h = this.h;
    const yN = d.y;
    const th = Math.atan2(d.x, d.z);
    const a = Math.abs(th);
    let x = d.x * h.rx;
    const y = d.y * (yN > 0 ? h.ryT : h.ryB);
    let z = d.z * h.rz;
    const low = smooth(0.12, -0.95, yN);
    x *= 1 - (0.2 + 0.14 * (1 - h.jaw)) * Math.pow(low, 1.25);
    if (d.z < 0) z *= 1 - 0.32 * smooth(0.0, -0.9, yN);
    else z *= 1 - 0.05 * low;
    if (d.z < 0) z *= 1 + 0.08 * gauss(yN, 0.18, 0.34);
    if (d.z > 0) z *= 1 + 0.045 * gauss(yN, 0.42, 0.22) * gauss(th, 0, 0.75);
    x *= 1 - 0.045 * gauss2(a, yN, 1.2, 0.36, 0.35, 0.2);
    let disp = offset;
    disp -= h.eyeDepth * gauss2(a, yN, h.eyeTh, h.eyeY + 0.01, 0.15, 0.085);
    disp += h.brow * gauss2(a, yN, h.eyeTh - 0.03, h.eyeY + 0.175, 0.27, 0.055);
    disp += h.cheek * gauss2(a, yN, 0.8, h.eyeY - 0.17, 0.26, 0.12);
    disp -= h.cheekHollow * gauss2(a, yN, 0.85, h.eyeY - 0.42, 0.24, 0.12);
    disp += 0.004 * gauss2(th, yN, 0, h.eyeY - 0.05, 0.09, 0.14);
    disp += 0.0075 * gauss2(th, yN, 0, -0.5, 0.42, 0.17);
    disp += h.chin * gauss2(th, yN, 0, -0.9, 0.27, 0.11);
    disp -= 0.0022 * gauss2(th, yN, 0, -0.7, 0.2, 0.04);
    disp += 0.0035 * h.jaw * gauss2(a, yN, 1.3, -0.58, 0.28, 0.14);
    return out.set(h.C.x + x + d.x * disp, h.C.y + y + d.y * disp, h.C.z + z + d.z * disp);
  }

  at(th: number, yN: number, out: THREE.Vector3, offset = 0): THREE.Vector3 {
    return this.pointDir(this.dir(th, yN, _d), out, offset);
  }

  normalAt(th: number, yN: number, out: THREE.Vector3): THREE.Vector3 {
    const e = 0.004;
    this.at(th - e, yN, _p0);
    this.at(th + e, yN, _p1);
    this.at(th, yN - e, _p2);
    this.at(th, yN + e, _p3);
    const a = _p1.sub(_p0);
    const b = _p3.sub(_p2);
    return out.crossVectors(a, b).normalize();
  }

  /** Approx (th, yN) of a model-space point for colour zoning. */
  coords(p: THREE.Vector3): { th: number; yN: number } {
    const h = this.h;
    const th = Math.atan2(p.x - h.C.x, p.z - h.C.z);
    const dy = p.y - h.C.y;
    const yN = clamp(dy / (dy > 0 ? h.ryT : h.ryB), -1, 1);
    return { th, yN };
  }
}

/** u in [0,1] → azimuth with extra density on the face. u = 0/1 is the back seam. */
export const thOfU = (u: number) => {
  const s = 2 * u - 1;
  return Math.PI * s * (0.42 + 0.58 * s * s);
};
const phOfV = (v: number) => Math.PI * (v + (0.38 * Math.sin(2 * Math.PI * v)) / (2 * Math.PI));

export interface HeadLook {
  skin: THREE.Color;
  lip: THREE.Color;
  hair: THREE.Color;
  brow: THREE.Color;
  eye: THREE.Color;
  blush: number;
  stubble: number;
  redNose: number;
}

function skinProps(sh: HeadShape, look: HeadLook, extra?: Partial<SurfaceProps>): SurfaceProps {
  const skin = look.skin;
  const lip = look.lip;
  const tmp = new THREE.Color();
  const blushC = new THREE.Color(0.75, 0.22, 0.2);
  const stubC = new THREE.Color(0.18, 0.2, 0.24);
  return {
    color: skin,
    rough: 0.52,
    bump: 0.16,
    detail: [0, 0, 1, 0],
    uvScale: 2.2,
    colorFn: (p, _n, out) => {
      const { th, yN } = sh.coords(p);
      const a = Math.abs(th);
      out.copy(skin);
      // warm cheeks / ears / nose
      const blush = look.blush * gauss2(a, yN, 0.72, -0.2, 0.28, 0.18) + look.redNose * gauss2(th, yN, 0, -0.2, 0.12, 0.12);
      out.lerp(tmp.copy(skin).multiply(blushC).multiplyScalar(1.9), clamp(blush, 0, 0.6));
      // lips tint
      const lipW = sh.h.mouthW;
      const lipM = gauss2(th, yN, 0, -0.535, lipW * 0.55, 0.05);
      out.lerp(lip, clamp(lipM * 0.6, 0, 1));
      // eye sockets slightly darker
      const sock = gauss2(a, yN, sh.h.eyeTh, sh.h.eyeY - 0.02, 0.2, 0.09);
      out.multiplyScalar(1 - 0.12 * sock);
      // stubble / 5 o'clock shadow on jaw
      const jaw = smooth(-0.22, -0.55, yN) * smooth(1.55, 1.1, a) * (1 - gauss2(th, yN, 0, -0.53, 0.3, 0.06));
      out.lerp(tmp.copy(skin).multiply(stubC).multiplyScalar(2.2), clamp(jaw * look.stubble, 0, 0.5));
      // underside of chin / neck shadow
      if (yN < -0.85) out.multiplyScalar(0.92);
    },
    ...extra,
  };
}

// ────────────────────────────────────────────────────────────────── head + face

export function buildHead(b: CharBuilder, sh: HeadShape, look: HeadLook, opts: { eyepatch?: 'L' | 'R' | null; glowEyes?: boolean }): void {
  const h = sh.h;
  const hb = BI.head;
  // skull
  const fn: SurfFn = (u, v, out) => {
    const th = thOfU(u);
    const ph = phOfV(v);
    _d.set(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
    sh.pointDir(_d, out);
  };
  const headGeo = surfaceOut(fn, 34, 24, h.C, { wrapU: true });
  b.add(headGeo, I4, hb, skinProps(sh, look));

  // ── eyes
  for (const side of [1, -1]) {
    const th = side * h.eyeTh;
    const S = sh.at(th, h.eyeY, new THREE.Vector3());
    const N = sh.normalAt(th, h.eyeY, new THREE.Vector3());
    const E = S.clone().addScaledVector(N, -h.eyeR * 0.42);
    E.x *= 0.985;
    const patched = opts.eyepatch && (opts.eyepatch === 'L') === side > 0;
    // eyeball with pole forward (+Z), rings placed at iris / pupil boundaries
    const rings = [0, 0.14, 0.2, 0.24, 0.33, 0.43, 0.5, 0.56, 0.75, 1.05, 1.45, 1.95];
    const eyeFn: SurfFn = (u, v, out) => {
      const idx = v * (rings.length - 1);
      const i0 = Math.min(rings.length - 2, Math.floor(idx));
      const ph = lerp(rings[i0], rings[i0 + 1], idx - i0);
      const az = u * Math.PI * 2;
      out.set(Math.sin(ph) * Math.cos(az), Math.sin(ph) * Math.sin(az), Math.cos(ph)).multiplyScalar(h.eyeR).add(E);
    };
    const eyeGeo = surfaceOut(eyeFn, 14, rings.length - 1, E, { wrapU: true });
    const iris = look.eye;
    const irisDark = iris.clone().multiplyScalar(0.45);
    const irisLight = iris.clone().lerp(new THREE.Color(1, 0.95, 0.8), 0.25);
    const sclera = new THREE.Color(0.86, 0.84, 0.8);
    const pupil = new THREE.Color(0.012, 0.01, 0.01);
    b.add(eyeGeo, I4, hb, {
      color: sclera,
      rough: 0.1,
      bump: 0,
      detail: [0, 0, 0, 0],
      emissive: opts.glowEyes ? 0.4 : 0,
      colorFn: (p, _n, out) => {
        const q = p.clone().sub(E).normalize();
        const ph = Math.acos(clamp(q.z, -1, 1));
        if (ph < 0.21) out.copy(pupil);
        else if (ph < 0.3) out.copy(irisLight);
        else if (ph < 0.46) out.copy(iris);
        else if (ph < 0.53) out.copy(irisDark);
        else out.copy(sclera).lerp(new THREE.Color(0.78, 0.6, 0.58), smooth(0.9, 1.6, ph) * 0.5);
        if (opts.glowEyes) out.copy(new THREE.Color(0.55, 0.95, 1.0));
      },
    });
    // eyelids (upper: arched margin; lower: shallow)
    const lidBone = side > 0 ? BI.lidL : BI.lidR;
    const rl = h.eyeR * 1.1;
    const up: SurfFn = (s, t, out) => {
      const az = lerp(-1.25, 1.25, s);
      const archEl = 0.36 + 0.2 * Math.sin(Math.PI * s) - 0.08 * (side > 0 ? s : 1 - s);
      const el = lerp(archEl, 1.35, Math.pow(t, 0.8));
      const r = rl * (1 + 0.1 * t);
      out.set(Math.sin(az * side) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r).add(E);
    };
    const lidCol = look.skin.clone().multiplyScalar(0.94).lerp(new THREE.Color(0.6, 0.35, 0.35), 0.06);
    const lash = new THREE.Color(0.05, 0.035, 0.03);
    b.add(patch(up, 10, 4, new THREE.Vector3(0, 0.5, 1)), I4, lidBone, {
      color: lidCol,
      rough: 0.5,
      bump: 0.1,
      detail: [0, 0, 1, 0],
      colorFn: (p, _n, out) => {
        const q = p.clone().sub(E);
        const el = Math.asin(clamp(q.y / q.length(), -1, 1));
        const az = Math.atan2(q.x * side, q.z);
        const s = (az + 1.25) / 2.5;
        const archEl = 0.36 + 0.2 * Math.sin(Math.PI * s);
        if (el < archEl + 0.12) out.copy(lash);
      },
    });
    // lash line roll (thickness at the margin)
    const lashCurve = (s: number, out: THREE.Vector3) => {
      up(0.04 + s * 0.92, 0, out);
      out.sub(E).multiplyScalar(1.015).add(E);
    };
    b.add(tube(lashCurve, (s) => 0.0011 * (0.6 + 0.4 * Math.sin(Math.PI * s)), 5, 10), I4, lidBone, { color: lash, rough: 0.6, bump: 0 });
    const low: SurfFn = (s, t, out) => {
      const az = lerp(-1.1, 1.1, s);
      const el = lerp(-0.5 - 0.1 * Math.sin(Math.PI * s), -1.2, t);
      const r = rl * 0.99;
      out.set(Math.sin(az * side) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r).add(E);
    };
    b.add(patch(low, 8, 2, new THREE.Vector3(0, -0.3, 1)), I4, hb, {
      color: lidCol,
      rough: 0.5,
      bump: 0.1,
      detail: [0, 0, 1, 0],
      colorFn: (p, _n, out) => {
        const q = p.clone().sub(E);
        const el = Math.asin(clamp(q.y / q.length(), -1, 1));
        if (el > -0.62) out.lerp(new THREE.Color(0.55, 0.32, 0.3), 0.35);
      },
    });
    if (patched) {
      // leather eyepatch
      const pf: SurfFn = (s, t, out) => {
        const az = lerp(-0.85, 0.85, s);
        const el = lerp(-0.75, 0.75, t);
        const sh2 = Math.cos((s - 0.5) * 2.4) * Math.cos((t - 0.5) * 2.0);
        const r = h.eyeR * (1.45 + 0.25 * sh2);
        out.set(Math.sin(az * side) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r).add(E);
      };
      b.add(patch(pf, 7, 7, new THREE.Vector3(0, 0, 1)), I4, hb, {
        color: new THREE.Color(0.06, 0.045, 0.04),
        rough: 0.45,
        bump: 0.5,
        detail: [0, 0, 1, 0],
        uvScale: 2,
      });
      // strap around the head
      const strap = (s: number, out: THREE.Vector3) => {
        const thS = lerp(side * h.eyeTh, side * h.eyeTh - side * Math.PI * 1.98, s);
        const yN = h.eyeY + 0.05 + 0.28 * Math.sin(Math.PI * s);
        sh.at(thS, yN, out, 0.0028);
      };
      b.add(tube(strap, () => 0.0028, 4, 40), I4, hb, { color: new THREE.Color(0.05, 0.04, 0.035), rough: 0.5, bump: 0 });
    }
  }

  // ── brows
  for (const side of [1, -1]) {
    const curve = (s: number, out: THREE.Vector3) => {
      const th = side * lerp(0.13, 0.66, s);
      const yN = h.eyeY + 0.2 + 0.055 * Math.sin(Math.PI * (0.15 + s * 0.85)) - 0.03 * s;
      sh.at(th, yN, out, 0.0022);
    };
    const thick = h.fem ? 0.0024 : h.age === 'old' ? 0.0042 : 0.0033;
    b.add(
      tube(curve, (s, u) => thick * (1.05 - 0.55 * s) * (0.62 + 0.38 * Math.abs(Math.cos(u * Math.PI * 2))), 6, 10, {
        capStart: true,
        capEnd: true,
      }),
      I4,
      hb,
      { color: look.brow, rough: 0.8, bump: 0.6, detail: [0, 0, 0, 1], uvScale: 3 },
    );
  }

  // ── nose
  const top = sh.at(0, h.eyeY - 0.02, new THREE.Vector3());
  const tipBase = sh.at(0, h.eyeY - h.noseLen, new THREE.Vector3());
  const tipN = sh.normalAt(0, h.eyeY - h.noseLen, new THREE.Vector3());
  const tip = tipBase.clone().addScaledVector(tipN, h.noseProj);
  const noseCurve = (s: number, out: THREE.Vector3) => {
    out.lerpVectors(top, tip, s);
    const bulge = Math.sin(Math.PI * s) * (0.0035 + h.noseHook * 0.004);
    out.z += bulge * (s < 0.2 ? s / 0.2 : 1) - 0.002 * (1 - s);
  };
  const nw = h.noseW;
  b.add(
    tube(
      noseCurve,
      (s, u) => {
        const base = lerp(nw * 0.34, nw * 0.52, s) + nw * 0.3 * smooth(0.72, 1, s);
        const flat = 0.75 + 0.25 * Math.abs(Math.sin(u * Math.PI * 2));
        return base * flat;
      },
      10,
      10,
      { capEnd: true, up: new THREE.Vector3(1, 0, 0) },
    ),
    I4,
    hb,
    skinProps(sh, look, { colorFn: (p, _n, out) => out.copy(look.skin).lerp(new THREE.Color(0.8, 0.35, 0.3), 0.08 + look.redNose * 0.5) }),
  );
  // alae (nostril wings) + columella
  for (const side of [1, -1]) {
    const c = tip.clone().add(new THREE.Vector3(side * nw * 0.72, -nw * 0.3, -nw * 0.75));
    const g = ellipsoid(nw * 0.42, nw * 0.36, nw * 0.52, 10, 7);
    const m = new THREE.Matrix4().makeRotationY(side * 0.35).setPosition(c);
    b.add(g, m, hb, skinProps(sh, look, {
      colorFn: (p, _n, out) => {
        out.copy(look.skin).lerp(new THREE.Color(0.75, 0.38, 0.33), 0.1 + look.redNose * 0.4);
        if (p.y < c.y - nw * 0.12 && p.x * side < c.x * side) out.multiplyScalar(0.35);
      },
    }));
  }

  // ── lips + mouth line
  const mouthY = -0.515;
  const lipCurve = (yOff: number, wMul: number, bow: number) => (s: number, out: THREE.Vector3) => {
    const t = s * 2 - 1;
    const th = t * h.mouthW * wMul;
    const yN = mouthY + yOff + bow * (Math.abs(t) < 0.35 ? -0.02 * Math.cos((t / 0.35) * Math.PI) : 0) + h.smile * 0.05 * t * t;
    sh.at(th, yN, out, -0.0008);
  };
  const lipCol = look.lip;
  const upperLip = tube(lipCurve(0.026, 1.0, 1), (s, u) => (0.0022 + 0.0022 * h.lipFull) * Math.pow(Math.sin(Math.PI * s), 0.6) * (0.7 + 0.3 * Math.abs(Math.cos(u * Math.PI * 2))), 6, 12, {
    capStart: true,
    capEnd: true,
  });
  b.add(upperLip, I4, hb, { color: lipCol.clone().multiplyScalar(0.92), rough: 0.35, bump: 0.12, detail: [0, 0, 1, 0], uvScale: 3 });
  const lowerLip = tube(lipCurve(-0.03, 0.9, 0), (s, u) => (0.0028 + 0.003 * h.lipFull) * Math.pow(Math.sin(Math.PI * s), 0.55) * (0.72 + 0.28 * Math.abs(Math.cos(u * Math.PI * 2))), 6, 12, {
    capStart: true,
    capEnd: true,
  });
  b.add(lowerLip, I4, hb, { color: lipCol, rough: 0.32, bump: 0.12, detail: [0, 0, 1, 0], uvScale: 3 });
  const mouthLine = tube(lipCurve(-0.002, 1.05, 0.4), (s) => 0.0011 * Math.pow(Math.sin(Math.PI * s), 0.3), 4, 12, { capStart: true, capEnd: true });
  b.add(mouthLine, I4, hb, { color: new THREE.Color(0.16, 0.05, 0.05), rough: 0.6, bump: 0 });

  // ── ears
  for (const side of [1, -1]) {
    const th = side * 1.66;
    const P = sh.at(th, 0.0, new THREE.Vector3(), -0.004);
    const s = h.earSize;
    const earFn: SurfFn = (u, v, out) => {
      // ellipsoid; outward face (+x local) gets a concave bowl + raised helix rim
      const az = u * Math.PI * 2;
      const ph = v * Math.PI;
      const dx = Math.sin(ph) * Math.cos(az);
      const dy = Math.cos(ph);
      const dz = Math.sin(ph) * Math.sin(az);
      let rx = 0.0085;
      const r2 = Math.sqrt(dy * dy + dz * dz);
      if (dx > 0) rx += 0.0045 * smooth(0.55, 0.9, r2) - 0.0055 * smooth(0.75, 0.2, r2);
      // lobe: bottom narrower
      const ry = 0.031 * s;
      const rz = (dy < 0 ? 0.015 + 0.004 * (1 + dy) : 0.019) * s;
      out.set(dx * rx, dy * ry, dz * rz);
    };
    const g = surfaceOut(earFn, 14, 10, new THREE.Vector3(), { wrapU: true });
    const m = new THREE.Matrix4()
      .makeRotationY(side > 0 ? -0.35 : Math.PI + 0.35)
      .premultiply(new THREE.Matrix4().makeRotationX(-0.12))
      .setPosition(P.x, P.y, P.z - 0.004);
    b.add(g, m, hb, skinProps(sh, look, {
      colorFn: (p, _n, out) => {
        out.copy(look.skin).lerp(new THREE.Color(0.82, 0.4, 0.36), 0.12 + look.blush * 0.15);
      },
      ao: (p) => {
        const q = p.clone().sub(P);
        const rr = Math.hypot(q.y / 0.03, q.z / 0.018);
        return rr < 0.55 && q.x * side > -0.002 ? 0.7 : 1;
      },
    }));
  }
}

// ────────────────────────────────────────────────────────────────── hair

export type HairStyle =
  | 'short'
  | 'crop'
  | 'bald'
  | 'receding'
  | 'bun'
  | 'ponytail'
  | 'long'
  | 'braid'
  | 'curly'
  | 'swept'
  | 'bob'
  | 'pigtails'
  | 'spiky';

interface HairlineKey {
  a: number;
  y: number;
}

function interpKeys(keys: HairlineKey[], a: number): number {
  if (a <= keys[0].a) return keys[0].y;
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i];
    const k1 = keys[i + 1];
    if (a <= k1.a) {
      const t = (a - k0.a) / (k1.a - k0.a);
      const s = t * t * (3 - 2 * t);
      return lerp(k0.y, k1.y, s);
    }
  }
  return keys[keys.length - 1].y;
}

function hairProps(look: HeadLook, sh: HeadShape): SurfaceProps {
  const base = look.hair;
  const dark = base.clone().multiplyScalar(0.55);
  const light = base.clone().lerp(new THREE.Color(1, 0.95, 0.85), 0.18);
  return {
    color: base,
    rough: 0.55,
    bump: 0.9,
    detail: [0, 0, 0, 1],
    uvScale: 1.6,
    colorFn: (p, n, out) => {
      const { yN } = sh.coords(p);
      out.copy(base);
      out.lerp(light, clamp(n.y, 0, 1) * 0.4 * smooth(0.2, 0.9, yN));
      out.lerp(dark, clamp(-n.y, 0, 1) * 0.5 + smooth(0.1, -0.6, yN) * 0.25);
    },
    ao: (_p, n) => 0.82 + 0.18 * clamp(n.y * 0.5 + 0.5, 0, 1),
  };
}

export function buildHair(b: CharBuilder, sh: HeadShape, look: HeadLook, style: HairStyle, opts: { hat: string; seed: number }): void {
  const h = sh.h;
  const hb = BI.head;
  if (style === 'bald') return;
  const underHat = opts.hat !== 'none' && opts.hat !== 'bandana';
  const fem = h.fem;
  // hairline keypoints over |theta|
  let keys: HairlineKey[] = [
    { a: 0, y: 0.47 },
    { a: 0.5, y: 0.41 },
    { a: 0.95, y: 0.26 },
    { a: 1.22, y: -0.02 },
    { a: 1.38, y: 0.1 },
    { a: 1.58, y: 0.26 },
    { a: 1.85, y: 0.18 },
    { a: 2.15, y: -0.2 },
    { a: 2.7, y: -0.42 },
    { a: Math.PI, y: -0.46 },
  ];
  if (style === 'receding') keys = keys.map((k) => ({ a: k.a, y: k.a < 1.1 ? k.y + 0.18 * (1 - k.a / 1.1) : k.y }));
  if (fem || style === 'bob' || style === 'long') {
    keys = keys.map((k) => ({ a: k.a, y: k.a > 1.3 && k.a < 2.2 ? Math.min(k.y, 0.05) : k.y }));
  }
  let thick = 0.011;
  let volTop = 0.006;
  let lockAmp = 0.0028;
  let nLocks = 22;
  if (style === 'crop') {
    thick = 0.004;
    volTop = 0.001;
    lockAmp = 0.0006;
  } else if (style === 'curly') {
    thick = 0.016;
    volTop = 0.012;
    lockAmp = 0.005;
    nLocks = 16;
  } else if (style === 'swept' || style === 'spiky') {
    volTop = 0.016;
  } else if (style === 'bob' || style === 'long') {
    thick = 0.013;
  }
  if (underHat) {
    volTop = 0;
    thick *= 0.6;
  }
  // parting side (fem: side part; male: slightly off)
  const part = (opts.seed % 2 === 0 ? 1 : -1) * 0.35;
  const fringe = style === 'bob' || style === 'swept' || (fem && style !== 'bun' && style !== 'braid' && style !== 'ponytail');
  const fn: SurfFn = (u, v, out) => {
    const th = thOfU(u);
    const a = Math.abs(th);
    let edge = interpKeys(keys, a);
    if (fringe) edge -= 0.12 * gauss(th, -part * 0.4, 0.4);
    // v: 0 = crown, 1 = hairline
    const yN = lerp(1, edge, Math.pow(v, 0.9));
    const edgeT = smooth(1, 0.82, v);
    const lock = Math.sin(th * nLocks + Math.sin(v * 5 + opts.seed) * 0.8) * 0.5 + 0.5;
    let t = thick * (0.12 + 0.88 * edgeT) + volTop * smooth(0.2, 0.8, yN) * gauss(th, 0, 1.2);
    t += lockAmp * lock * smooth(0.05, 0.4, v) * (0.3 + 0.7 * edgeT);
    if (style === 'curly') t += 0.004 * Math.sin(th * 23 + opts.seed) * Math.sin(v * 27);
    if (style === 'spiky') t += 0.01 * Math.max(0, Math.sin(th * 9) * Math.sin(v * 10)) * smooth(0.3, 0.7, yN);
    // parting groove
    t -= 0.004 * gauss(th, part, 0.05) * smooth(0.6, 0.95, yN) * (style === 'crop' ? 0 : 1);
    sh.at(th, yN, out, t);
    // hair hangs slightly: pull lower side hair outward/down
    if (style === 'bob' || style === 'long') {
      const hang = smooth(0.3, -0.2, yN) * (1 - gauss(th, 0, 0.7));
      out.y -= hang * 0.02 * v;
    }
  };
  const g = surfaceOut(fn, 36, 14, h.C, { wrapU: true, lenU: 0.5, lenV: 0.25 });
  b.add(g, I4, hb, hairProps(look, sh));

  const back = (yN: number, off = 0) => sh.at(Math.PI, yN, new THREE.Vector3(), off);
  // long hair curtain / bob sides
  if (style === 'long' || style === 'bob') {
    const len = style === 'long' ? 0.3 : 0.1;
    const curtain: SurfFn = (u, v, out) => {
      // u across from left ear around back to right ear; v downwards from head
      const th = lerp(1.25, 2 * Math.PI - 1.25, u);
      const thN = th > Math.PI ? th - 2 * Math.PI : th;
      const yN0 = lerp(0.35, -0.1, gauss(thN, Math.PI, 1.2));
      const top = sh.at(thN, yN0, new THREE.Vector3(), thick + 0.004);
      const n = sh.normalAt(thN, yN0, new THREE.Vector3());
      const d = v * len;
      const flare = 0.018 * v + 0.008 * Math.sin(u * 40 + opts.seed) * v;
      out.copy(top).addScaledVector(n, flare * 0.6);
      out.y -= d + 0.06 * v;
      out.z -= 0.02 * v * gauss(thN, Math.PI, 1.0);
      out.x += Math.sign(out.x) * flare * 0.5;
    };
    b.add(patch(curtain, 24, 8, new THREE.Vector3(0, 0, -1), { lenU: 0.4, lenV: len }), I4, hb, { ...hairProps(look, sh), colorFn: undefined, color: look.hair });
  }
  if (style === 'bun') {
    const c = back(0.35, 0.03);
    c.y += 0.02;
    const g2 = ellipsoid(0.038, 0.034, 0.034, 14, 10, (d) => 0.003 * Math.sin(Math.atan2(d.x, d.y) * 7));
    b.add(g2, new THREE.Matrix4().makeTranslation(c.x, c.y, c.z - 0.01), hb, { ...hairProps(look, sh), colorFn: undefined });
  }
  if (style === 'ponytail' || style === 'braid') {
    const start = back(0.25, 0.01);
    const len = style === 'braid' ? 0.34 : 0.26;
    const curve = (s: number, out: THREE.Vector3) => {
      out.copy(start);
      out.z -= 0.035 * Math.sin(s * 2.2) + 0.01;
      out.y -= s * len;
    };
    const rad = (s: number, u: number) => {
      const r = style === 'braid' ? 0.017 * (1 - s * 0.35) : 0.022 * Math.sin(Math.PI * clamp(s * 1.05 + 0.08, 0, 1)) + 0.004;
      const braid = style === 'braid' ? 0.004 * Math.abs(Math.sin(s * 30 + u * Math.PI * 2)) : 0.0015 * Math.sin(u * 30);
      return r + braid;
    };
    b.add(tube(curve, rad, 10, 18, { capStart: true, capEnd: true }), I4, hb, { ...hairProps(look, sh), colorFn: undefined });
    // hair tie
    const tieC = new THREE.Vector3();
    curve(0.03, tieC);
    b.add(tube((s, out) => {
      out.copy(tieC);
      const a = s * Math.PI * 2;
      out.x += Math.cos(a) * 0.016;
      out.z += Math.sin(a) * 0.016;
    }, () => 0.0035, 5, 14), I4, hb, { color: look.lip.clone().multiplyScalar(0.8), rough: 0.6, bump: 0.2 });
  }
  if (style === 'pigtails') {
    for (const side of [1, -1]) {
      const start = sh.at(side * 2.1, 0.0, new THREE.Vector3(), 0.01);
      b.add(
        tube((s, out) => {
          out.copy(start);
          out.x += side * 0.02 * Math.sin(s * 2);
          out.y -= s * 0.18;
        }, (s) => 0.016 * (1 - s * 0.4) + 0.003 * Math.abs(Math.sin(s * 22)), 8, 12, { capStart: true, capEnd: true }),
        I4,
        hb,
        { ...hairProps(look, sh), colorFn: undefined },
      );
    }
  }
}

export type BeardStyle = 'none' | 'stubble' | 'full' | 'long' | 'goatee' | 'mustache' | 'chinstrap';

export function buildBeard(b: CharBuilder, sh: HeadShape, look: HeadLook, style: BeardStyle): void {
  if (style === 'none' || style === 'stubble') return;
  const h = sh.h;
  const hb = BI.head;
  const mw = h.mouthW;
  const long = style === 'long';
  const full = style === 'full' || long;
  const aMax = full || style === 'chinstrap' ? 1.5 : 0.55;
  const fn: SurfFn = (u, v, out) => {
    const th = lerp(-aMax, aMax, u);
    const a = Math.abs(th);
    // top edge
    let top: number;
    if (full) top = a < mw * 1.1 ? -0.64 : lerp(-0.64, -0.1, smooth(mw * 1.1, 1.05, a)) + 0.12 * smooth(1.1, 1.45, a);
    else if (style === 'chinstrap') top = lerp(-0.72, -0.1, smooth(0.4, 1.3, a));
    else top = -0.66;
    const bottom = -0.995;
    const yN = lerp(top, bottom, v);
    const edgeT = smooth(0, 0.18, v) * smooth(aMax, aMax - 0.2, a);
    let t = (full ? 0.008 : 0.006) * edgeT + 0.004 * smooth(0.3, 0.9, v) * gauss(th, 0, 0.6);
    t += 0.0022 * (0.5 + 0.5 * Math.sin(th * 26 + v * 3)) * edgeT;
    if (style === 'chinstrap') t *= 0.7;
    sh.at(th, yN, out, t);
    if (full) {
      const drop = (long ? 0.12 : 0.028) * smooth(0.45, 1, v) * gauss(th, 0, long ? 0.55 : 0.75);
      out.y -= drop;
      out.z += drop * (long ? 0.12 : 0.35);
    }
  };
  b.add(surfaceOut(fn, 22, 10, h.C, { sampleU: 0.5, lenU: 0.2, lenV: 0.1 }), I4, hb, {
    color: look.hair,
    rough: 0.62,
    bump: 0.9,
    detail: [0, 0, 0, 1],
    uvScale: 1.8,
    colorFn: (_p, n, out) => out.copy(look.hair).multiplyScalar(0.8 + 0.3 * clamp(n.y + 0.5, 0, 1)),
  });
  // check winding visually: second pass flipped gives robust double-sided look at edges
  b.add(surfaceOut(fn, 22, 10, h.C, { sampleU: 0.5, inward: true, lenU: 0.2, lenV: 0.1 }), I4, hb, {
    color: look.hair.clone().multiplyScalar(0.6),
    rough: 0.7,
    bump: 0.5,
    detail: [0, 0, 0, 1],
    uvScale: 1.8,
  });
  // moustache
  if (style !== 'chinstrap') {
    const curve = (s: number, out: THREE.Vector3) => {
      const t = s * 2 - 1;
      const th = t * mw * 1.25;
      const yN = -0.455 - 0.07 * Math.pow(Math.abs(t), 1.6) * (full ? 1.2 : 1);
      sh.at(th, yN, out, 0.0045);
    };
    b.add(
      tube(curve, (s, u) => (0.0055 - 0.0025 * Math.abs(s * 2 - 1)) * (0.7 + 0.3 * Math.abs(Math.cos(u * Math.PI * 2))), 7, 14, {
        capStart: true,
        capEnd: true,
      }),
      I4,
      hb,
      { color: look.hair, rough: 0.6, bump: 0.9, detail: [0, 0, 0, 1], uvScale: 2 },
    );
  }
}

// ────────────────────────────────────────────────────────────────── hats

export type HatStyle = 'none' | 'cap' | 'beanie' | 'straw' | 'captain' | 'tricorn' | 'hood' | 'fur' | 'bandana' | 'wizard' | 'bucket' | 'sou_wester';

export interface HatColors {
  main: THREE.Color;
  accent: THREE.Color;
  seed: number;
  mushrooms?: boolean;
}

function cloth(color: THREE.Color, extra?: Partial<SurfaceProps>): SurfaceProps {
  return { color, rough: 0.85, bump: 0.55, detail: [1, 0, 0, 0], uvScale: 1.5, ...extra };
}

/** Hat crown dome that follows the skull: covers yN >= edgeY with an outward offset. */
function domeOverHead(sh: HeadShape, edgeY: (th: number) => number, off: (th: number, v: number) => number, nu = 30, nv = 8): THREE.BufferGeometry {
  const fn: SurfFn = (u, v, out) => {
    const th = thOfU(u);
    const yN = lerp(1, edgeY(th), v);
    sh.at(th, yN, out, off(th, v));
  };
  return surfaceOut(fn, nu, nv, sh.h.C, { wrapU: true, lenU: 0.6, lenV: 0.2 });
}

export function buildHat(b: CharBuilder, sh: HeadShape, style: HatStyle, c: HatColors): void {
  if (style === 'none') return;
  const h = sh.h;
  const hb = BI.head;
  const crownY = h.C.y + h.ryT;
  const browY = h.eyeY + 0.3;
  const rim = (yN: number, off: number) => (s: number, out: THREE.Vector3) => sh.at(thOfU(s), yN, out, off);
  switch (style) {
    case 'cap': {
      const edge = () => browY + 0.02;
      b.add(domeOverHead(sh, edge, (_th, v) => 0.012 + 0.004 * v), I4, hb, cloth(c.main, { pattern: 0 }));
      // seams: six panel ridges
      for (let i = 0; i < 6; i++) {
        const th0 = (i / 6) * Math.PI * 2 - Math.PI;
        b.add(tube((s, out) => sh.at(th0, lerp(0.99, edge() + 0.03, s), out, 0.0155), () => 0.0012, 3, 8), I4, hb, cloth(c.main.clone().multiplyScalar(0.8)));
      }
      // button
      const top = sh.at(0, 1, new THREE.Vector3(), 0.016);
      b.add(ellipsoid(0.008, 0.004, 0.008, 8, 4), new THREE.Matrix4().makeTranslation(top.x, top.y, top.z), hb, cloth(c.accent));
      // visor
      const front = sh.at(0, edge() + 0.02, new THREE.Vector3(), 0.012);
      const visor: SurfFn = (u, v, out) => {
        const a = lerp(-1.05, 1.05, u);
        const r = lerp(0.0, 0.075, v);
        const curve = 0.012 * Math.pow(Math.abs(a) / 1.05, 2);
        out.set(Math.sin(a) * (h.rx + 0.012) * (1 + v * 0.1), front.y - 0.004 - r * 0.12 - curve * 1.2, 0);
        out.z = h.C.z + Math.cos(a) * (h.rz * 0.92 + r) - 0.004;
        out.y -= 0.01 * v * v;
      };
      addPlate(b, visor, 16, 5, 0.006, cloth(c.accent, { rough: 0.7 }), hb);
      break;
    }
    case 'beanie': {
      const edge = () => browY - 0.01;
      b.add(
        domeOverHead(sh, edge, (th, v) => 0.012 + 0.012 * (1 - v) * (1 - v) + 0.0015 * Math.sin(th * 20)),
        I4,
        hb,
        { color: c.main, rough: 0.95, bump: 1, detail: [0, 1, 0, 0], uvScale: 1.2, pattern: 0 },
      );
      // folded cuff
      b.add(
        tube(rim(edge() + 0.05, 0.02), (_s, u) => 0.02 * (0.55 + 0.45 * Math.abs(Math.cos(u * Math.PI))) * 0.9, 8, 34, { up: new THREE.Vector3(0, 1, 0) }),
        I4,
        hb,
        { color: c.main.clone().multiplyScalar(0.92), rough: 0.95, bump: 1, detail: [0, 1, 0, 0], uvScale: 1.2, pattern: 3, color2: c.main.clone().multiplyScalar(0.7), patFreq: 6 },
      );
      break;
    }
    case 'straw':
    case 'bucket':
    case 'sou_wester': {
      const straw = style === 'straw';
      const edge = () => browY + 0.035;
      const crownH = straw ? 0.03 : 0.02;
      const crownFn: SurfFn = (u, v, out) => {
        const th = thOfU(u);
        const yN = lerp(1, edge(), v);
        sh.at(th, yN, out, 0.016 + (1 - v) * 0.004);
        out.y += crownH * (1 - v * 0.6) + (straw ? -0.012 * gauss(th, 0, 0.35) * (1 - v) : 0);
      };
      const mat: SurfaceProps = straw
        ? { color: c.main, rough: 0.8, bump: 1, detail: [1, 0, 0, 0], uvScale: 0.35 }
        : style === 'sou_wester'
          ? { color: c.main, rough: 0.35, bump: 0.2, detail: [0, 0, 1, 0], uvScale: 0.5 }
          : cloth(c.main, { uvScale: 1.2 });
      b.add(surfaceOut(crownFn, 30, 8, h.C, { wrapU: true, lenU: 0.6, lenV: 0.2 }), I4, hb, mat);
      // brim
      const brimW = straw ? 0.105 : style === 'sou_wester' ? 0.07 : 0.055;
      const e0 = edge();
      const brim: SurfFn = (u, v, out) => {
        const th = thOfU(u);
        sh.at(th, e0 + 0.02, out, 0.016);
        const dx = out.x - h.C.x;
        const dz = out.z - h.C.z;
        const L = Math.hypot(dx, dz) || 1;
        const w = brimW * (style === 'sou_wester' ? 1 + 0.6 * smooth(0.5, -1, Math.cos(th)) : 1);
        out.x += (dx / L) * w * v;
        out.z += (dz / L) * w * v;
        const droop = straw ? 0.02 * v * v * (0.6 + 0.4 * Math.sin(th * 2 + c.seed)) : 0.03 * v * v;
        out.y -= droop + (style === 'sou_wester' ? 0.025 * v * smooth(0.3, -1, Math.cos(th)) : 0);
      };
      addPlate(b, brim, 36, 4, 0.004, { ...mat, uvScale: straw ? 0.35 : mat.uvScale }, hb, true);
      // band
      b.add(tube(rim(e0 + 0.055, 0.0175), () => 0.0055, 4, 34), I4, hb, cloth(c.accent, { rough: 0.7 }));
      break;
    }
    case 'captain': {
      const edge = () => browY + 0.04;
      // band
      b.add(domeOverHead(sh, edge, () => 0.013, 30, 3), I4, hb, cloth(c.main.clone().multiplyScalar(0.5)));
      // flat-topped crown, flaring out
      const e0 = edge();
      const crown: SurfFn = (u, v, out) => {
        const th = thOfU(u);
        sh.at(th, e0 + 0.06, out, 0.014);
        const dx = out.x - h.C.x;
        const dz = out.z - h.C.z;
        const L = Math.hypot(dx, dz) || 1;
        const flare = 0.012 * smooth(0, 0.5, v);
        const top = lerp(out.y, crownY + 0.03 + 0.012 * Math.cos(th), smooth(0, 0.55, v));
        const shrink = v > 0.55 ? (1 - v) / 0.45 : 1;
        out.x = h.C.x + (dx + (dx / L) * flare) * shrink;
        out.z = h.C.z + (dz + (dz / L) * flare) * shrink + 0.008 * v;
        out.y = top;
      };
      b.add(surfaceOut(crown, 30, 10, h.C, { wrapU: true, sampleV: 0.3, lenU: 0.6, lenV: 0.25 }), I4, hb, cloth(c.main));
      // glossy visor
      const front = sh.at(0, e0 + 0.02, new THREE.Vector3(), 0.013);
      const visor: SurfFn = (u, v, out) => {
        const a = lerp(-1.2, 1.2, u);
        const r = lerp(0, 0.055, v);
        out.set(Math.sin(a) * (h.rx + 0.013 + r * 0.3), front.y - 0.006 - r * 0.35, h.C.z + Math.cos(a) * (h.rz * 0.95 + r));
      };
      addPlate(b, visor, 16, 4, 0.004, { color: new THREE.Color(0.02, 0.02, 0.025), rough: 0.18, bump: 0 }, hb);
      // gold cord + badge
      const cordY = e0 + 0.03;
      b.add(tube((s, out) => {
        const a = lerp(-1.25, 1.25, s);
        sh.at(a, cordY, out, 0.0155);
      }, () => 0.0022, 4, 18), I4, hb, { color: c.accent, rough: 0.3, metal: 1, bump: 0.3, detail: [1, 0, 0, 0] });
      const badge = sh.at(0, e0 + 0.12, new THREE.Vector3(), 0.017);
      b.add(ellipsoid(0.014, 0.011, 0.004, 10, 6, (d) => 0.001 * Math.sin(Math.atan2(d.x, d.y) * 8)), new THREE.Matrix4().makeTranslation(badge.x, badge.y, badge.z + 0.004), hb, {
        color: c.accent,
        rough: 0.25,
        metal: 1,
        bump: 0,
      });
      break;
    }
    case 'tricorn': {
      const edge = () => browY + 0.02;
      const e0 = edge();
      b.add(domeOverHead(sh, edge, (_th, v) => 0.016 + 0.01 * (1 - v)), I4, hb, cloth(c.main, { detail: [0.5, 0, 0.5, 0] }));
      // brim turned up into three corners
      const brim: SurfFn = (u, v, out) => {
        const th = thOfU(u);
        sh.at(th, e0 + 0.03, out, 0.014);
        const dx = out.x - h.C.x;
        const dz = out.z - h.C.z;
        const L = Math.hypot(dx, dz) || 1;
        const corner = Math.pow(Math.abs(Math.cos((th * 3) / 2)), 3);
        const w = 0.06 + 0.035 * corner;
        const up = 0.075 * Math.pow(v, 1.6) * (1 - corner * 0.5);
        out.x += (dx / L) * w * v * (1 - 0.35 * v);
        out.z += (dz / L) * w * v * (1 - 0.35 * v);
        out.y += up;
      };
      addPlate(b, brim, 42, 5, 0.005, cloth(c.main, { detail: [0.5, 0, 0.5, 0] }), hb, true);
      // gold trim on the brim edge
      b.add(tube((s, out) => {
        brim(s, 1, out);
      }, () => 0.003, 4, 60), I4, hb, { color: c.accent, rough: 0.35, metal: 0.9, bump: 0.3, detail: [1, 0, 0, 0] });
      break;
    }
    case 'bandana': {
      const edge = (th: number) => browY + 0.02 - 0.2 * smooth(1.2, 2.6, Math.abs(th));
      b.add(domeOverHead(sh, edge, (th, v) => 0.006 + 0.002 * Math.sin(th * 5 + v * 3)), I4, hb, cloth(c.main, { pattern: 4, color2: c.main.clone().lerp(c.accent, 0.35), patFreq: 3 }));
      // knot + tails at the back
      const knot = sh.at(Math.PI, 0.05, new THREE.Vector3(), 0.012);
      b.add(ellipsoid(0.018, 0.014, 0.012, 8, 6), new THREE.Matrix4().makeTranslation(knot.x, knot.y, knot.z), hb, cloth(c.main));
      for (const side of [1, -1]) {
        const tail: SurfFn = (u, v, out) => {
          out.set(knot.x + side * (0.006 + v * 0.03) + (u - 0.5) * 0.028, knot.y - v * 0.085, knot.z - 0.008 - v * 0.02);
        };
        addPlate(b, tail, 3, 5, 0.003, cloth(c.main), hb, true);
      }
      break;
    }
    case 'fur': {
      const edge = () => browY - 0.015;
      const e0 = edge();
      const crown: SurfFn = (u, v, out) => {
        const th = thOfU(u);
        const yN = lerp(1, e0, v);
        sh.at(th, yN, out, 0.03 + 0.004 * Math.sin(th * 14 + v * 9));
        out.y += 0.035 * (1 - v);
      };
      b.add(surfaceOut(crown, 30, 8, h.C, { wrapU: true, lenU: 0.6, lenV: 0.2 }), I4, hb, { color: c.main, rough: 0.9, bump: 1, detail: [0, 0, 0, 1], uvScale: 0.9 });
      // fluffy fur band
      b.add(
        tube(rim(e0 + 0.03, 0.03), (s, u) => 0.026 + 0.0035 * Math.sin(u * 20 + s * 90), 10, 36),
        I4,
        hb,
        { color: c.accent, rough: 1, bump: 1, detail: [0, 0, 0, 1], uvScale: 0.8 },
      );
      break;
    }
    case 'wizard': {
      const edge = () => browY + 0.03;
      const e0 = edge();
      const base = sh.at(0, e0 + 0.05, new THREE.Vector3(), 0.016);
      // cone that bends back at the tip
      const coneFn: SurfFn = (u, v, out) => {
        const th = u * Math.PI * 2;
        const r = lerp(Math.max(h.rx, h.rz) + 0.02, 0.004, Math.pow(v, 0.85));
        const bend = 0.12 * Math.pow(v, 2.2);
        const y = base.y + v * 0.26;
        out.set(h.C.x + Math.sin(th) * r * 1.02, y - bend * 0.3, h.C.z - 0.01 + Math.cos(th) * r - bend);
        out.y += 0.006 * Math.sin(th * 3 + v * 6) * (1 - v);
      };
      b.add(surfaceOut(coneFn, 24, 12, new THREE.Vector3(h.C.x, base.y + 0.06, h.C.z - 0.02), { wrapU: true, sampleV: 0.2 }), I4, hb, cloth(c.main, { detail: [0.7, 0, 0.3, 0] }));
      // wide floppy brim
      const brim: SurfFn = (u, v, out) => {
        const th = u * Math.PI * 2;
        const r = lerp(Math.max(h.rx, h.rz) + 0.015, Math.max(h.rx, h.rz) + 0.13, v);
        out.set(h.C.x + Math.sin(th) * r, base.y - 0.004 - 0.035 * v * v * (0.7 + 0.3 * Math.sin(th * 3 + c.seed)), h.C.z - 0.01 + Math.cos(th) * r);
      };
      addPlate(b, brim, 40, 4, 0.004, cloth(c.main), hb, true, true);
      // band
      b.add(tube((s, out) => {
        const th = s * Math.PI * 2;
        const r = Math.max(h.rx, h.rz) + 0.022;
        out.set(h.C.x + Math.sin(th) * r * 1.02, base.y + 0.012, h.C.z - 0.01 + Math.cos(th) * r);
      }, () => 0.008, 4, 30), I4, hb, cloth(c.accent));
      if (c.mushrooms) {
        const spots = [
          [0.4, 0.18],
          [1.1, 0.33],
          [2.4, 0.12],
          [-0.5, 0.42],
        ];
        for (const [th, v] of spots) {
          const p = new THREE.Vector3();
          coneFn(((th / (Math.PI * 2)) % 1 + 1) % 1, v, p);
          const stemH = 0.02;
          b.add(ellipsoid(0.005, stemH / 2, 0.005, 6, 4), new THREE.Matrix4().makeTranslation(p.x, p.y + stemH * 0.3, p.z), hb, { color: new THREE.Color(0.9, 0.86, 0.75), rough: 0.7, bump: 0.2 });
          b.add(
            ellipsoid(0.016, 0.009, 0.016, 10, 5, (d) => (d.y < 0 ? -0.006 : 0)),
            new THREE.Matrix4().makeTranslation(p.x, p.y + stemH, p.z),
            hb,
            {
              color: c.accent,
              rough: 0.5,
              bump: 0.2,
              emissive: 0.15,
              colorFn: (q, _n, out) => {
                const k = Math.sin(q.x * 900) * Math.sin(q.z * 900);
                if (k > 0.6) out.setRGB(0.95, 0.92, 0.85);
              },
            },
          );
        }
      }
      break;
    }
    case 'hood': {
      // cowl around the head, open at the face, draping to the shoulders
      const open = (yN: number) => lerp(0.38, 1.02, smooth(0.95, 0.2, yN)) * (yN < -0.4 ? lerp(1, 0.75, smooth(-0.4, -1, yN)) : 1);
      const fn: SurfFn = (u, v, out) => {
        // v: 0 top -> 1 bottom (drape)
        const yN = lerp(1, -1, Math.min(1, v * 1.15));
        const o = open(yN);
        const th = lerp(o, Math.PI * 2 - o, u);
        const thN = th > Math.PI ? th - Math.PI * 2 : th;
        const face = smooth(1.5, 0.6, Math.abs(thN));
        const loose = 0.022 + 0.018 * (1 - face) + 0.01 * smooth(0.2, -0.6, yN);
        sh.at(thN, yN, out, loose);
        // pointed peak at the back
        out.y += 0.03 * gauss(thN, Math.PI, 0.5) * smooth(0.5, 0.95, yN);
        out.z -= 0.025 * gauss(thN, Math.PI, 0.5) * smooth(0.5, 0.95, yN);
        // drape outward/down beyond the head
        const drape = smooth(0.8, 1, v);
        out.y -= drape * 0.1;
        const dx = out.x - h.C.x;
        const dz = out.z - h.C.z;
        out.x += dx * drape * 1.2;
        out.z += dz * drape * 0.9 - drape * 0.015;
        out.x += 0.003 * Math.sin(thN * 9 + v * 5) * smooth(0.3, 0.9, v);
      };
      const g = surfaceOut(fn, 30, 14, h.C, { sampleU: 0.5, sampleV: 0.3, lenU: 0.6, lenV: 0.4 });
      b.add(g, I4, hb, cloth(c.main, { ao: (p) => (p.z > h.C.z + 0.02 && p.y < h.C.y + 0.05 ? 0.8 : 1) }));
      b.add(surfaceOut(fn, 30, 14, h.C, { sampleU: 0.5, sampleV: 0.3, inward: true, lenU: 0.6, lenV: 0.4 }), I4, hb, cloth(c.main.clone().multiplyScalar(0.45)));
      // hem roll around the opening
      b.add(tube((s, out) => {
        const t = s * 2 - 1;
        const yN = lerp(-0.9, 1, 1 - Math.abs(t));
        const o = open(yN) + 0.02;
        fn(0, 0, out);
        const th = t < 0 ? o : -o;
        const face = smooth(1.5, 0.6, o);
        sh.at(th, yN, out, 0.022 + 0.018 * (1 - face) + 0.01 * smooth(0.2, -0.6, yN));
      }, () => 0.006, 5, 30, { capStart: true, capEnd: true }), I4, hb, cloth(c.accent));
      break;
    }
  }
}

/** Thin plate with thickness: builds top & bottom surfaces + edge rim tube. */
function addPlate(b: CharBuilder, fn: SurfFn, nu: number, nv: number, thick: number, props: SurfaceProps, bone: number, wrap = false, flipTop = false): void {
  const top: SurfFn = (u, v, out) => {
    fn(u, v, out);
    out.y += thick / 2;
  };
  const bot: SurfFn = (u, v, out) => {
    fn(u, v, out);
    out.y -= thick / 2;
  };
  const up = new THREE.Vector3(0, 1, 0);
  const gTop = wrap ? surface(top, nu, nv, { wrapU: true, flip: !flipTop }) : patch(top, nu, nv, up);
  const gBot = wrap ? surface(bot, nu, nv, { wrapU: true, flip: flipTop }) : patch(bot, nu, nv, up.clone().negate());
  // ensure normals point up / down respectively
  fixNormals(gTop, 1);
  fixNormals(gBot, -1);
  b.add(gTop, I4, bone, props);
  b.add(gBot, I4, bone, { ...props, color: new THREE.Color(props.color as THREE.ColorRepresentation).multiplyScalar(0.7), colorFn: undefined });
  b.add(tube((s, out) => fn(s, 1, out), () => thick / 2, 4, nu * 2), I4, bone, { ...props, colorFn: undefined });
}

/** Flip a geometry's normals+winding so that its average normal.y has the given sign. */
export function fixNormals(g: THREE.BufferGeometry, sign: number): void {
  const n = g.attributes.normal as THREE.BufferAttribute;
  let s = 0;
  for (let i = 0; i < n.count; i++) s += n.getY(i);
  if (Math.sign(s) === sign || s === 0) return;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  const idx = g.index!;
  for (let i = 0; i < idx.count; i += 3) {
    const a = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, a);
  }
}
