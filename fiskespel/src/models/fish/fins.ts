/**
 * Fin membranes: median (dorsal/anal), caudal fans, paired (pectoral/pelvic), adipose, finlets.
 * Each fin is a pleated grid mapped into a slot of the species fin atlas.
 */
import type { BodyProfile } from './body';
import { zOf } from './body';
import { Geo, v3, type V3 } from './geo';
import { finSlotRect } from './textures';
import type { CaudalFin, MedianFin, PairedFin } from './types';
import { bump, clamp, monotone, smoothstep } from './util';

const slotUV = (slot: number) => {
  const [u0, v0, u1, v1] = finSlotRect(slot);
  return (a: number, b: number): [number, number] => [u0 + (u1 - u0) * a, v0 + (v1 - v0) * b];
};

export interface FinBuildCtx {
  prof: BodyProfile;
  depth: number;
  lod: number;
}

function cols(rays: number, lod: number): number {
  const r = Math.max(2, rays);
  if (lod >= 2) return 4;
  if (lod === 1) return Math.min(10, r);
  return Math.min(40, (r - 1) * 2);
}

/** Dorsal (up = +1) or anal (up = -1) fin. */
export function medianFin(g: Geo, ctx: FinBuildCtx, f: MedianFin, up: 1 | -1, slot: number): void {
  const { prof } = ctx;
  const D = ctx.depth;
  const prof5 = f.prof ?? [1, 0.9, 0.7, 0.5, 0.35];
  const hp = monotone([0, 0.25, 0.5, 0.75, 1], prof5);
  const rays = f.rays ?? 10;
  const na = cols(rays, ctx.lod);
  const nb = ctx.lod >= 2 ? 2 : ctx.lod === 1 ? 3 : 5;
  const sweep = ((f.sweep ?? 35) * Math.PI) / 180;
  const pleat = ctx.lod >= 1 ? 0 : 0.03;
  const uvf = slotUV(slot);
  const thick = f.thick ?? 0;
  const side = f.side ?? 0;
  const fn = (a: number, b: number, off: number): V3 => {
    const s = f.s0 + (f.s1 - f.s0) * a;
    const yBase = up > 0 ? prof.topAt(s) - D * 0.02 : prof.botAt(s) + D * 0.02;
    const H = f.h * D * Math.max(0.02, hp(a));
    const phi = sweep + (a - 0.5) * 0.25;
    const dir: V3 = [0, Math.cos(phi) * up, -Math.sin(phi)];
    let p: V3 = [side, yBase, zOf(s)];
    p = v3.add(p, v3.mul(dir, H * b));
    p[2] -= H * 0.1 * b * b;
    const pl = pleat * H * b * Math.cos(Math.PI * (rays - 1) * a);
    p[0] += pl + 0.03 * H * Math.sin(Math.PI * a) * b * b + off * (1 - b * b) * Math.pow(Math.sin(Math.PI * clamp(a * 0.98 + 0.01)), 0.3);
    return p;
  };
  const flut = (a: number, b: number): [number, number, number, number] => [0.02 * b * f.h, 0, 0, a * 3];
  if (thick > 0) {
    const t = thick * D;
    g.grid(na, nb, (a, b) => fn(a, b, t), uvf, { flutter: flut });
    g.grid(na, nb, (a, b) => fn(a, b, -t), uvf, { flutter: flut, flip: true });
  } else {
    g.grid(na, nb, (a, b) => fn(a, b, 0), uvf, { flutter: flut, flip: up < 0 });
  }
}

export function caudalFin(g: Geo, ctx: FinBuildCtx, c: CaudalFin, slot: number): void {
  if (c.type === 'none') return;
  const { prof } = ctx;
  const D = ctx.depth;
  const sEnd = 1;
  const yt = prof.topAt(sEnd) - D * 0.01;
  const yb = prof.botAt(sEnd) + D * 0.01;
  const z0 = zOf(sEnd) + 0.03;
  const rays = c.rays ?? 18;
  const na = cols(rays, ctx.lod);
  const nb = ctx.lod >= 2 ? 2 : ctx.lod === 1 ? 3 : 6;
  const spread = (c.spread * Math.PI) / 180;
  const fork = c.fork ?? 0.5;
  const up = c.up ?? 1;
  const down = c.down ?? 1;
  const tilt = ((c.tilt ?? 0) * Math.PI) / 180;
  const pleat = ctx.lod >= 1 ? 0 : 0.025;
  const uvf = slotUV(slot);
  const lenAt = (a: number): number => {
    const q = 2 * a - 1;
    const aq = Math.abs(q);
    let L = 1;
    switch (c.type) {
      case 'forked':
        L = fork + (1 - fork) * Math.pow(aq, 1.4);
        L *= 1 - 0.3 * Math.pow(smoothstep(0.86, 1, aq), 2);
        break;
      case 'lunate':
        L = fork + (1 - fork) * Math.pow(aq, 0.75);
        L *= 1 - 0.15 * Math.pow(smoothstep(0.93, 1, aq), 2);
        break;
      case 'emarginate':
        L = 0.82 + 0.18 * aq * aq;
        L *= 1 - 0.2 * Math.pow(smoothstep(0.85, 1, aq), 2);
        break;
      case 'truncate':
        L = 0.92 + 0.08 * (1 - q * q);
        L *= 1 - 0.25 * Math.pow(smoothstep(0.8, 1, aq), 2);
        break;
      case 'rounded':
        L = Math.sqrt(Math.max(0.05, 1 - 0.8 * q * q));
        break;
      case 'pointed':
        L = 0.08 + 0.92 * Math.pow(1 - Math.pow(aq, 1.3), 1.2);
        break;
      case 'heterocercal':
        L = q > 0 ? 0.25 + 0.75 * Math.pow(q, 1.05) : 0.25 + 0.75 * Math.pow(aq, 1.25);
        L *= 1 - 0.25 * Math.pow(smoothstep(0.85, 1, aq), 2);
        break;
      case 'diphycercal':
        L = 0.55 + 0.35 * Math.sqrt(1 - q * q) + 0.45 * bump(q, 0, 0.12);
        break;
    }
    return L * (q > 0 ? up : down);
  };
  const fn = (a: number, b: number): V3 => {
    const q = 2 * a - 1;
    let phi = q * spread + tilt;
    if (c.type === 'heterocercal') phi = (q > 0 ? q * spread * 1.1 : q * spread * 0.9) + tilt;
    const L = lenAt(a) * c.len;
    const base: V3 = [0, yb + (yt - yb) * a, z0];
    const dir: V3 = [0, Math.sin(phi), -Math.cos(phi)];
    const p = v3.add(base, v3.mul(dir, L * b));
    // lobes sweep slightly outward-back; membrane pleats
    p[0] += pleat * L * b * Math.cos(Math.PI * (rays - 1) * a) + 0.02 * L * b * b * Math.sin(Math.PI * a);
    if (c.type === 'lunate') p[2] -= 0.08 * L * b * b * Math.abs(q);
    return p;
  };
  const flut = (a: number, b: number): [number, number, number, number] => [0.015 * b, 0, 0, 1.5 + a];
  const thick = c.thick ?? 0;
  if (thick > 0) {
    const t = thick * D;
    const fnT = (sgn: number) => (a: number, b: number): V3 => {
      const p = fn(a, b);
      p[0] += sgn * t * (1 - b) * Math.pow(Math.sin(Math.PI * clamp(a * 0.96 + 0.02)), 0.4);
      return p;
    };
    g.grid(na, nb, fnT(1), uvf, { flutter: flut, flip: true });
    g.grid(na, nb, fnT(-1), uvf, { flutter: flut });
  } else g.grid(na, nb, fn, uvf, { flutter: flut, flip: true });
}

export function pairedFin(g: Geo, ctx: FinBuildCtx, f: PairedFin, kind: 'pectoral' | 'pelvic', slot: number): void {
  const { prof } = ctx;
  const D = ctx.depth;
  const rays = f.rays ?? 12;
  const na = cols(rays, ctx.lod);
  const nb = ctx.lod >= 2 ? 2 : ctx.lod === 1 ? 3 : 5;
  const uvf = slotUV(slot);
  const len = f.len;
  const baseLen = (f.base ?? 0.3) * len;
  const ang = ((f.ang ?? 30) * Math.PI) / 180;
  const droop = ((f.droop ?? 15) * Math.PI) / 180;
  const tilt = ((f.tilt ?? 20) * Math.PI) / 180;
  const spread = Math.tan((((f.spread ?? 50) * Math.PI) / 180) * 0.5);
  const shape = f.shape ?? 'round';
  const start = g.count;
  const startI = g.idx.length;
  const th = prof.thetaFor(f.y);
  const P0 = prof.point(f.s, th);
  const Nn = prof.normal(f.s, th);
  const inset = D * 0.03;
  const P: V3 = [P0.x - Nn.x * inset, P0.y - Nn.y * inset, P0.z - Nn.z * inset];
  let B: V3;
  let Dir: V3;
  if (kind === 'pectoral') {
    B = v3.norm([0, Math.cos(tilt), Math.sin(tilt)]);
    Dir = v3.norm([Math.sin(ang), -Math.sin(droop), -Math.cos(ang) * Math.cos(droop)]);
  } else {
    B = v3.norm([0, Math.sin(tilt) * 0.6, 1]);
    Dir = v3.norm([Math.sin(ang), -Math.sin(droop), -Math.cos(droop) * Math.cos(ang)]);
  }
  // make B perpendicular to Dir
  B = v3.norm(v3.sub(B, v3.mul(Dir, v3.dot(B, Dir))));
  const Nf = v3.norm(v3.cross(B, Dir));
  const pleat = ctx.lod >= 1 ? 0 : 0.03;
  const lenAt = (a: number): number => {
    switch (shape) {
      case 'point':
        return 0.35 + 0.65 * bump(a, 0.78, 0.38);
      case 'wing':
        return 0.25 + 0.75 * Math.pow(a, 1.6);
      case 'fan':
        return 0.75 + 0.25 * Math.sin(Math.PI * a);
      case 'filament':
        return 0.15 + 0.85 * Math.pow(bump(a, 0.8, 0.2), 2);
      case 'paddle':
        return 0.6 + 0.4 * Math.sqrt(Math.max(0, Math.sin(Math.PI * a)));
      default:
        return 0.55 + 0.45 * Math.pow(Math.sin(Math.PI * clamp(a * 0.9 + 0.1)), 0.7);
    }
  };
  const lobe = (f.lobe ?? 0) * len;
  const fn = (a: number, b: number): V3 => {
    const bp = v3.add(v3.add(P, v3.mul(B, (a - 0.5) * baseLen)), v3.mul(Dir, lobe));
    const dir = v3.norm(v3.add(Dir, v3.mul(B, (a - 0.5) * spread * 2)));
    const L = lenAt(a) * len;
    let p = v3.add(bp, v3.mul(dir, L * b));
    p = v3.add(p, v3.mul(Nf, pleat * L * b * Math.cos(Math.PI * (rays - 1) * a) + 0.08 * L * b * b * Math.sin(Math.PI * a)));
    return p;
  };
  const flut = (a: number, b: number): [number, number, number, number] => {
    const k = 0.05 * b * len * 3;
    return [Nf[0] * k, Nf[1] * k, Nf[2] * k, a * 1.2 + (kind === 'pelvic' ? 2 : 0)];
  };
  const thick = f.thick ?? 0;
  if (thick > 0) {
    const t = thick * D;
    g.grid(na, nb, (a, b) => v3.add(fn(a, b), v3.mul(Nf, t * (1 - b))), uvf, { flutter: flut });
    g.grid(na, nb, (a, b) => v3.add(fn(a, b), v3.mul(Nf, -t * (1 - b))), uvf, { flutter: flut, flip: true });
  } else g.grid(na, nb, fn, uvf, { flutter: flut });
  g.mirrorRange(start, startI);
}

/** Small fleshy adipose fin. */
export function adiposeFin(g: Geo, ctx: FinBuildCtx, a: { s: number; h: number; len: number }, slot: number): void {
  medianFin(g, ctx, { s0: a.s, s1: a.s + a.len, h: a.h, prof: [0.5, 1, 0.9, 0.6, 0.2], sweep: 50, rays: 2, thick: 0.012 }, 1, slot);
}

export function finlets(g: Geo, ctx: FinBuildCtx, f: { n: number; s0: number; s1: number; size: number; bottom?: boolean }, slot: number): void {
  const { prof } = ctx;
  const D = ctx.depth;
  const uvf = slotUV(slot);
  const sides: (1 | -1)[] = f.bottom === false ? [1] : [1, -1];
  for (const up of sides) {
    for (let i = 0; i < f.n; i++) {
      const s = f.s0 + ((f.s1 - f.s0) * (i + 0.5)) / f.n;
      const w = (f.s1 - f.s0) / f.n;
      const fn = (a: number, b: number): V3 => {
        const ss = s - w * 0.4 + a * w * 0.8;
        const y = up > 0 ? prof.topAt(ss) - D * 0.01 : prof.botAt(ss) + D * 0.01;
        const H = f.size * D * (1 - a * 0.7);
        return [0, y + up * H * b * 0.8, zOf(ss) - H * b * 0.9 * (0.3 + a)];
      };
      g.grid(2, 1, fn, uvf, { flip: up < 0 });
    }
  }
}

export function clampFinS(x: number): number {
  return clamp(x, 0, 1);
}
