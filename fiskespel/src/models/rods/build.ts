/**
 * Procedural fishing-rod builder. One RodVisual → one THREE.Group (≤ 4k tris, few draw calls).
 * Anatomy (butt → tip): butt cap, rear grip, reel seat (+ reel), fore grip, winding check,
 * decorative butt wrap, hook keeper, tapered blank with thread-wrapped guides, ferrule, tip-top.
 */
import * as THREE from 'three';
import { ROD_GRIP_NAME, ROD_TIP_NAME, type ModelBuildOptions } from '../../core/types';
import { band, cyl, gemGeo, gradient, Kit, lathe, path, ring, tube, xf, type Geo, type V3 } from './kit/geo';
import { gem, M, P, type MatSpec } from './kit/mat';
import type { MatRef, RodVisual } from './spec';
import { buildReel } from './reels';
import { buildDecos } from './decos';

export function mref(r: MatRef | undefined, fallback: MatRef = 'steel'): THREE.Material {
  const x = r ?? fallback;
  if (typeof x === 'string') {
    const p = (P as Record<string, MatSpec>)[x];
    if (!p) throw new Error(`unknown material preset ${x}`);
    return M(p);
  }
  return M(x);
}

export function mspec(r: MatRef | undefined, fallback: MatRef = 'steel'): MatSpec {
  const x = r ?? fallback;
  return typeof x === 'string' ? (P as Record<string, MatSpec>)[x] : x;
}

export interface RodCtx {
  v: RodVisual;
  k: Kit;
  root: THREE.Group;
  L: number;
  side: 1 | -1;
  layout: 'spin' | 'fly' | 'cast';
  buttH: number;
  seatA: number;
  seatB: number;
  rs: number;
  rg: number;
  /** Visible blank start (fore grip end). */
  y0: number;
  rb0: number;
  rb1: number;
  segs: number;
  lod: number;
  guides: { y: number; R: number; d: number }[];
  tip: THREE.Vector3;
  lineStart: THREE.Vector3 | null;
  anims: ((t: number) => void)[];
  clip: [number, number];
  /** Blank radius at height y. */
  rb(y: number): number;
  /** y at fraction t of the visible blank (0 = fore grip end, 1 = tip). */
  yAt(t: number): number;
  /** Add geometry if it intersects the clip range. */
  add(g: Geo, m: THREE.Material): void;
}

const TAU = Math.PI * 2;

export function buildRod(v: RodVisual, opts: ModelBuildOptions = {}): THREE.Group {
  const lod = opts.lod ?? 0;
  const layout: RodCtx['layout'] = v.reel.type === 'fly' ? 'fly' : v.reel.type === 'baitcast' || v.reel.type === 'conventional' ? 'cast' : 'spin';
  const L = v.len;
  const th = v.thick ?? 1;
  const rg = v.grip.radius ?? 0.0165 * Math.sqrt(th);
  const rs = 0.0118 * Math.sqrt(th);
  const buttH = v.butt?.kind === 'knob' || v.butt?.kind === 'crystal' || v.butt?.kind === 'skull' || v.butt?.kind === 'orb' || v.butt?.kind === 'shell' || v.butt?.kind === 'claw' || v.butt?.kind === 'sun' ? 0.05 : 0.032;
  let seatA: number;
  let seatB: number;
  let y0: number;
  if (layout === 'fly') {
    seatA = buttH;
    seatB = seatA + 0.105;
    y0 = seatB + (v.grip.rear ?? 0.2) + 0.004;
  } else {
    const rear = v.grip.rear ?? (layout === 'cast' ? 0.24 : L >= 2.4 ? 0.27 : 0.23);
    seatA = buttH + rear;
    seatB = seatA + (layout === 'cast' ? 0.115 : 0.125);
    y0 = seatB + (v.grip.fore ?? (layout === 'cast' ? 0.085 : 0.1));
  }
  const rb0 = 0.0088 * th;
  const rb1 = 0.0024 * Math.max(0.8, th * 0.85);
  const clip: [number, number] = [-1, 99];
  const pose = opts.pose ?? '';
  if (pose === 'butt') clip[1] = Math.max(y0 + 0.36, 0.95);
  else if (pose === 'reel') {
    clip[0] = seatA - 0.1;
    clip[1] = seatB + 0.1;
  } else if (pose === 'tip') clip[0] = L - 0.75;
  else if (pose === 'mid') {
    clip[0] = L * 0.3;
    clip[1] = L * 0.72;
  }

  const k = new Kit();
  const root = new THREE.Group();
  root.name = 'rod';
  const ctx: RodCtx = {
    v,
    k,
    root,
    L,
    side: layout === 'cast' ? -1 : 1,
    layout,
    buttH,
    seatA,
    seatB,
    rs,
    rg,
    y0,
    rb0,
    rb1,
    segs: lod === 0 ? 14 : lod === 1 ? 9 : 6,
    lod,
    guides: [],
    tip: new THREE.Vector3(0, L, 0),
    lineStart: null,
    anims: [],
    clip,
    rb(y: number) {
      const s = Math.min(1, Math.max(0, (y - y0) / (L - y0)));
      return rb1 + (rb0 - rb1) * Math.pow(1 - s, 0.85);
    },
    yAt(t: number) {
      return y0 + (L - y0) * t;
    },
    add(g: Geo, m: THREE.Material) {
      if (clip[0] > -1 || clip[1] < 99) {
        g.computeBoundingBox();
        const bb = g.boundingBox!;
        if (bb.max.y < clip[0] || bb.min.y > clip[1]) return;
      }
      k.add(g, m);
    },
  };

  buildButt(ctx);
  buildGrips(ctx);
  buildSeat(ctx);
  buildBlank(ctx);
  buildWraps(ctx);
  buildGuides(ctx);
  buildTip(ctx);
  buildReel(ctx);
  if (v.deco && lod < 2) buildDecos(ctx, v.deco);
  if (lod === 0) buildLine(ctx);

  k.flush(root, 'rod');

  const tipObj = new THREE.Object3D();
  tipObj.name = ROD_TIP_NAME;
  tipObj.position.copy(ctx.tip);
  root.add(tipObj);
  const grip = new THREE.Object3D();
  grip.name = ROD_GRIP_NAME;
  grip.position.set(0, layout === 'fly' ? seatB + 0.09 : (seatA + seatB) / 2, 0);
  root.add(grip);
  if (ctx.anims.length) {
    const anims = ctx.anims;
    root.userData.animate = (t: number) => {
      for (const a of anims) a(t);
    };
  }
  return root;
}

// ───────────────────────────────────────────────────────────── butt cap

function buildButt(c: RodCtx): void {
  const b = c.v.butt ?? { kind: 'rubber' };
  const r = c.rg;
  const h = c.buttH;
  const s = c.segs;
  const metal = mref(b.mat, 'steel');
  switch (b.kind) {
    case 'rubber': {
      c.add(
        lathe(
          [
            [0, 0],
            [r * 0.6, 0],
            [r * 0.86, 0.0015],
            [r * 0.99, 0.007],
            [r * 1.01, 0.018],
            [r * 0.99, h - 0.004],
            [r * 0.95, h],
          ],
          s,
          { tile: 0.05 },
        ),
        mref(b.mat, 'rubber'),
      );
      c.add(band(h - 0.005, h + 0.001, r * 1.0, 0.001, s), mref('chrome'));
      break;
    }
    case 'cap':
    case 'gem':
    case 'fight': {
      c.add(
        lathe(
          [
            [0, 0],
            [r * 0.72, 0],
            [r * 0.92, 0.0018],
            [r * 1.02, 0.007],
            [r * 1.02, 0.011],
            [r * 0.97, 0.0125],
            [r * 0.97, 0.018],
            [r * 1.03, 0.0195],
            [r * 1.03, h - 0.004],
            [r * 0.96, h],
          ],
          s,
          { tile: 0.04 },
        ),
        metal,
      );
      if (b.kind === 'gem') {
        const gm = gem(b.gem ?? '#d0304a', 0.35);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + Math.PI / 4;
          c.add(xf(gemGeo(0.0042, 'round'), { r: [Math.PI / 2, 0, 0], p: [0, 0, 0] }).rotateY(a).translate(Math.sin(a) * r * 1.02, 0.0155, Math.cos(a) * r * 1.02), gm);
        }
        c.add(xf(gemGeo(0.007, 'round'), { r: [Math.PI, 0, 0], p: [0, 0.0005, 0] }), gm);
      }
      if (b.kind === 'fight') {
        const dark = mref('blackAnod');
        c.add(xf(new THREE.BoxGeometry(r * 1.6, 0.003, 0.004), { p: [0, 0.0012, 0] }), dark);
        c.add(xf(new THREE.BoxGeometry(0.004, 0.003, r * 1.6), { p: [0, 0.0012, 0] }), dark);
      }
      break;
    }
    case 'knob': {
      c.add(
        lathe(
          [
            [0, 0],
            [r * 0.55, 0.001],
            [r * 0.95, 0.008],
            [r * 1.18, 0.02],
            [r * 1.2, 0.03],
            [r * 1.08, 0.04],
            [r * 0.9, h - 0.003],
            [r * 0.88, h],
          ],
          s,
          { tile: 0.06 },
        ),
        mref(b.mat, { c: '#ffffff', tex: 'wood', ta: 'walnut', r: 0.35, cc: 0.8 }),
      );
      c.add(band(h - 0.006, h + 0.001, r * 0.93, 0.001, s), mref('brass'));
      break;
    }
    case 'crystal': {
      const cm = mref(b.mat ?? { c: b.gem ?? '#8fe8ff', m: 0.1, r: 0.08, cc: 1, irid: 0.5, flat: true, e: b.gem ?? '#8fe8ff', ei: 0.35, op: 0.92 });
      c.add(
        lathe(
          [
            [0, 0],
            [r * 0.9, 0.022],
            [r * 1.05, 0.036],
            [r * 0.75, h],
          ],
          6,
        ).toNonIndexed(),
        cm,
      );
      c.add(band(h - 0.012, h + 0.001, r * 0.95, 0.0015, s), mref('silver'));
      break;
    }
    case 'orb': {
      const col = b.gem ?? '#a070ff';
      const orb = new THREE.SphereGeometry(r * 1.05, 16, 12);
      orb.translate(0, r * 1.1, 0);
      c.add(orb, M({ c: col, e: col, ei: 1.4, r: 0.15, cc: 1, irid: 0.4 }));
      c.add(
        lathe(
          [
            [r * 0.4, r * 1.9],
            [r * 0.85, r * 2.05],
            [r * 1.0, h - 0.006],
            [r * 0.96, h],
          ],
          s,
        ),
        metal,
      );
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        const pts: V3[] = [];
        for (let j = 0; j <= 6; j++) {
          const t = j / 6;
          const ang = Math.PI * (0.18 + 0.72 * t);
          const rr = r * 1.18 * Math.sin(ang) + 0.0006;
          pts.push([Math.sin(a) * rr, r * 1.1 - Math.cos(ang) * r * 1.2 + 0.004, Math.cos(a) * rr]);
        }
        c.add(tube(path(pts), (t) => 0.0016 * (1 - t * 0.6), 8, 4, { cap1: true }), metal);
      }
      break;
    }
    case 'skull': {
      addSkull(c, 0, 0.004, 0, r * 1.25, mref(b.mat, { c: '#e8dcc0', r: 0.55, tex: 'bone', bump: 0.8 }));
      c.add(band(h - 0.008, h + 0.001, r * 0.95, 0.0015, s), mref('oldBrass'));
      break;
    }
    case 'claw': {
      const bm = mref(b.mat, { c: '#ffffff', tex: 'bone', r: 0.55 });
      c.add(
        lathe(
          [
            [0, 0.004],
            [r * 0.8, 0.008],
            [r * 1.02, 0.02],
            [r * 1.0, h - 0.004],
            [r * 0.95, h],
          ],
          s,
          { tile: 0.05 },
        ),
        bm,
      );
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + 0.3;
        const pts: V3[] = [
          [Math.sin(a) * r * 0.9, 0.03, Math.cos(a) * r * 0.9],
          [Math.sin(a) * r * 1.35, 0.016, Math.cos(a) * r * 1.35],
          [Math.sin(a) * r * 1.1, 0.002, Math.cos(a) * r * 1.1],
        ];
        c.add(tube(path(pts), (t) => 0.0045 * (1 - t * 0.9), 8, 5, { cap0: true }), mref({ c: '#3a2c20', r: 0.3, cc: 0.6 }));
      }
      break;
    }
    case 'shell': {
      // conch spiral pommel
      const sm = mref(b.mat, { c: '#ffffff', tex: 'coral', ta: '#f4c9a8', r: 0.35, cc: 0.6 });
      const pts: V3[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const a = t * TAU * 1.6;
        const rr = r * (0.2 + 0.75 * t);
        pts.push([Math.sin(a) * rr * 0.6, 0.002 + t * (h - 0.012), Math.cos(a) * rr * 0.6]);
      }
      c.add(tube(path(pts), (t) => r * (0.25 + 0.75 * t) * 0.85, 20, 8, { cap0: true }), sm);
      c.add(band(h - 0.008, h + 0.001, r * 0.95, 0.0015, s), mref('pearl'));
      break;
    }
    case 'sun': {
      const gm = mref(b.mat, 'gold');
      c.add(
        lathe(
          [
            [0, 0.002],
            [r * 0.9, 0.006],
            [r * 1.05, 0.02],
            [r * 1.0, h - 0.004],
            [r * 0.95, h],
          ],
          s,
        ),
        gm,
      );
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const g = new THREE.ConeGeometry(0.0035, 0.012, 4);
        g.rotateZ(-Math.PI / 2);
        g.translate(r * 1.05 + 0.005, 0, 0);
        g.rotateY(a);
        g.translate(0, 0.02, 0);
        c.add(g, gm);
      }
      c.add(xf(gemGeo(0.006, 'round'), { r: [Math.PI, 0, 0], p: [0, 0.002, 0] }), gem(b.gem ?? '#ff8a1a', 0.6));
      break;
    }
    case 'lantern': {
      const gm = mref(b.mat, 'oldBrass');
      c.add(cyl(0, 0.004, r * 0.8, r * 1.0, c.segs, { cap0: true }), gm);
      c.add(cyl(0.004, h - 0.004, r * 0.85, r * 0.85, 10), M({ c: b.gem ?? '#ffb347', e: b.gem ?? '#ffb347', ei: 1.6, r: 0.2 }));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        c.add(cyl(0.004, h - 0.004, 0.0012, 0.0012, 4).translate(Math.sin(a) * r * 0.95, 0, Math.cos(a) * r * 0.95), gm);
      }
      c.add(cyl(h - 0.004, h, r * 1.0, r * 0.9, c.segs), gm);
      break;
    }
  }
}

export function addSkull(c: { add(g: Geo, m: THREE.Material): void }, x: number, y: number, z: number, s: number, bone: THREE.Material): void {
  const cran = new THREE.SphereGeometry(s * 0.5, 12, 10);
  cran.scale(1, 1.05, 1.1);
  cran.translate(x, y + s * 0.62, z);
  c.add(cran, bone);
  const jaw = new THREE.SphereGeometry(s * 0.34, 10, 6, 0, TAU, Math.PI * 0.35, Math.PI * 0.65);
  jaw.scale(1, 0.9, 1.1);
  jaw.translate(x, y + s * 0.34, z + s * 0.08);
  c.add(jaw, bone);
  const dark = M({ c: '#140c08', r: 0.9 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(s * 0.14, 8, 6);
    eye.scale(1, 0.9, 0.5);
    eye.translate(x + sx * s * 0.18, y + s * 0.6, z + s * 0.5);
    c.add(eye, dark);
  }
  const nose = new THREE.ConeGeometry(s * 0.06, s * 0.12, 3);
  nose.rotateX(Math.PI);
  nose.translate(x, y + s * 0.42, z + s * 0.52);
  c.add(nose, dark);
}

// ───────────────────────────────────────────────────────────── grips

function gripMat(c: RodCtx): THREE.Material {
  const g = c.v.grip;
  if (g.mat) return mref(g.mat);
  switch (g.kind) {
    case 'cork':
      return M({ c: '#ffffff', tex: 'cork', r: 0.82 });
    case 'eva':
      return M({ c: g.color ?? '#2a2a2e', tex: 'eva', r: 0.88 });
    case 'wood':
      return M({ c: '#ffffff', tex: 'wood', ta: g.color ?? 'walnut', r: 0.32, cc: 0.9, ccr: 0.12 });
    case 'cord':
      return M({ c: g.color ?? '#2b2f5a', tex: 'cord', r: 0.78 });
    case 'leather':
      return M({ c: g.color ?? '#6b3a1e', tex: 'leather', r: 0.6, sheen: 0.3 });
    case 'bamboo':
      return M({ c: '#ffffff', tex: 'bamboo', ta: g.color ?? 'gold', r: 0.4, cc: 0.6 });
    case 'stone':
      return M({ c: g.color ?? '#9a948a', tex: 'stone', r: 0.85 });
    case 'bone':
      return M({ c: '#ffffff', tex: 'bone', r: 0.55 });
    default:
      return M({ c: g.color ?? '#555555', r: 0.6 });
  }
}

function gripTile(c: RodCtx): number {
  switch (c.v.grip.kind) {
    case 'cork':
      return 0.07;
    case 'cord':
      return 0.03;
    case 'wood':
      return 0.12;
    default:
      return 0.06;
  }
}

function profileFor(shape: string, y0: number, y1: number, r: number, rEnd: number): [number, number][] {
  const h = y1 - y0;
  switch (shape) {
    case 'cigar':
      return [
        [rEnd, y0],
        [r * 0.86, y0 + 0.004],
        [r * 0.97, y0 + h * 0.28],
        [r * 0.95, y0 + h * 0.55],
        [r * 0.78, y0 + h * 0.86],
        [r * 0.62, y1 - 0.003],
        [r * 0.55, y1],
      ];
    case 'wells':
      return [
        [rEnd, y0],
        [r * 0.95, y0 + 0.006],
        [r * 1.04, y0 + 0.026],
        [r * 0.9, y0 + h * 0.35],
        [r * 0.86, y0 + h * 0.6],
        [r * 1.02, y1 - 0.04],
        [r * 1.0, y1 - 0.018],
        [r * 0.72, y1 - 0.004],
        [r * 0.6, y1],
      ];
    case 'fore':
      return [
        [rEnd, y0],
        [r * 0.93, y0 + 0.005],
        [r * 0.92, y0 + h * 0.3],
        [r * 0.8, y0 + h * 0.7],
        [r * 0.66, y1 - 0.004],
        [r * 0.6, y1],
      ];
    default:
      // straight rear grip (thick at the butt, tapering toward the seat)
      return [
        [r * 0.93, y0],
        [r * 1.0, y0 + 0.004],
        [r * 1.01, y0 + 0.02],
        [r * 0.96, y0 + h * 0.55],
        [r * 0.9, y1 - 0.018],
        [r * 0.86, y1 - 0.004],
        [rEnd, y1],
      ];
  }
}

function buildGrips(c: RodCtx): void {
  const g = c.v.grip;
  const m = gripMat(c);
  const tile = gripTile(c);
  const s = c.segs + 2;
  const trim = g.trim ? mref(g.trim) : null;
  const addTrim = (y: number, r: number) => {
    if (trim) c.add(band(y - 0.0025, y + 0.0025, r, 0.0008, c.segs), trim);
  };
  if (c.layout === 'fly') {
    const a = c.seatB;
    const b = c.y0 - 0.004;
    c.add(lathe(profileFor(g.shape ?? 'wells', a, b, c.rg, c.rs * 1.02), s, { tile }), m);
    addTrim(a + 0.003, c.rs * 1.08);
    return;
  }
  const shape = g.shape ?? 'straight';
  const r0 = c.buttH;
  const r1 = c.seatA;
  if (shape === 'split') {
    const aEnd = r0 + Math.min(0.075, (r1 - r0) * 0.3);
    const bStart = r1 - Math.min(0.12, (r1 - r0) * 0.45);
    c.add(lathe(profileFor('straight', r0, aEnd, c.rg, c.rg * 0.9), s, { tile }), m);
    c.add(lathe(profileFor('straight', bStart, r1, c.rg * 0.97, c.rs * 1.05), s, { tile }), m);
    // exposed blank / shrink tube between the two sections
    c.add(cyl(aEnd - 0.002, bStart + 0.002, c.rg * 0.52, c.rg * 0.5, c.segs, { tile: 0.1 }), blankMat(c));
    addTrim(aEnd, c.rg * 0.9);
    addTrim(bStart, c.rg * 0.95);
  } else {
    c.add(lathe(profileFor(shape === 'fighting' ? 'straight' : shape === 'cigar' ? 'straight' : shape, r0, r1, c.rg, c.rs * 1.05), s, { tile }), m);
    addTrim(r0 + 0.0025, c.rg * 1.01);
  }
  // fore grip
  const fa = c.seatB;
  const fb = c.y0;
  if (fb - fa > 0.012) {
    c.add(lathe(profileFor('fore', fa, fb, c.rg * 0.98, c.rs * 1.04), s, { tile }), m);
    addTrim(fa + 0.0025, c.rs * 1.1);
  }
  // winding check
  c.add(
    lathe(
      [
        [c.rb0 * 1.02, fb - 0.002],
        [c.rb0 * 1.7, fb - 0.0015],
        [c.rb0 * 1.75, fb + 0.001],
        [c.rb0 * 1.25, fb + 0.004],
        [c.rb0 * 1.05, fb + 0.0045],
      ],
      c.segs,
    ),
    mref(c.v.seat?.hood ?? 'chrome'),
  );
}

// ───────────────────────────────────────────────────────────── reel seat

function buildSeat(c: RodCtx): void {
  const seat = c.v.seat ?? { mat: 'blackAnod' };
  const sm = mref(seat.mat);
  const hm = mref(seat.hood ?? seat.mat);
  const a = c.seatA;
  const b = c.seatB;
  const rs = c.rs;
  const s = c.segs;
  if (seat.insert) {
    c.add(cyl(a + 0.02, b - 0.034, rs * 0.99, rs * 0.99, s, { tile: 0.08 }), mref(seat.insert));
    c.add(cyl(a, a + 0.021, rs, rs, s), sm);
    c.add(cyl(b - 0.035, b, rs, rs, s), sm);
  } else c.add(cyl(a, b, rs, rs, s, { tile: 0.05 }), sm);
  // lower hood
  c.add(
    lathe(
      [
        [c.rg * 0.86, a - 0.001],
        [rs + 0.0044, a + 0.0015],
        [rs + 0.0046, a + 0.017],
        [rs + 0.0032, a + 0.023],
        [rs + 0.0006, a + 0.026],
      ],
      s,
    ),
    hm,
  );
  // threaded locking nut + upper hood
  const knurl = M({ ...mspec(seat.hood ?? seat.mat), tex: 'knurl', useMap: false, bump: 0.8 });
  c.add(band(b - 0.036, b - 0.017, rs + 0.0048, 0.0012, s, { tile: 0.01 }), knurl);
  c.add(
    lathe(
      [
        [rs + 0.0006, b - 0.017],
        [rs + 0.0034, b - 0.0145],
        [rs + 0.0046, b - 0.009],
        [rs + 0.0044, b - 0.0015],
        [c.rs * 1.04, b + 0.001],
      ],
      s,
    ),
    hm,
  );
  if (c.layout === 'cast') {
    // trigger on the underside (+Z)
    const pts: V3[] = [
      [0, a + 0.03, rs * 0.9],
      [0, a + 0.026, rs + 0.012],
      [0, a + 0.014, rs + 0.024],
      [0, a + 0.004, rs + 0.026],
    ];
    c.add(tube(path(pts), (t) => 0.0042 * (1 - t * 0.35), 10, 6, { flat: 0.55, cap1: true, up: [1, 0, 0] }), hm);
  }
}

// ───────────────────────────────────────────────────────────── blank

export function blankMat(c: RodCtx): THREE.Material {
  const spec = mspec(c.v.blank.mat, { c: '#333333', r: 0.3, cc: 1 });
  return M(c.v.blank.grad ? { ...spec, vc: true } : spec);
}

function buildBlank(c: RodCtx): void {
  const m = blankMat(c);
  const y0 = c.y0 - 0.02;
  const yT = c.L - 0.004;
  const pts: [number, number][] = [];
  const N = c.lod === 0 ? 16 : 8;
  const lo = Math.max(y0, c.clip[0] - 0.05);
  const hi = Math.min(yT, c.clip[1] + 0.05);
  if (hi <= lo) return;
  for (let i = 0; i <= N; i++) {
    const y = lo + ((hi - lo) * i) / N;
    pts.push([c.rb(y), y]);
  }
  if (hi >= yT - 1e-6) pts.push([c.rb(yT) * 0.6, yT + 0.0006], [0, yT + 0.0008]);
  const radial = c.lod === 0 ? 10 : 7;
  const g = lathe(pts, radial, { tile: 0.12, uRep: 1 });
  if (c.v.blank.grad) gradient(g, 'y', c.y0, c.L, c.v.blank.grad);
  c.add(g, m);
  const bs = c.v.blank;
  if (bs.nodes) {
    const nm = M({ ...mspec(bs.mat), c: '#8a6a3a', vc: false });
    for (let y = c.y0 + 0.22; y < c.L - 0.25; y += 0.26 + (Math.sin(y * 13) * 0.04)) {
      const r = c.rb(y);
      c.add(
        lathe(
          [
            [r * 0.99, y - 0.007],
            [r * 1.1, y - 0.0015],
            [r * 1.13, y],
            [r * 1.1, y + 0.0015],
            [r * 0.99, y + 0.007],
          ],
          radial,
        ),
        nm,
      );
    }
  }
  if (bs.segments) {
    const sm = mref(bs.segMat ?? bs.mat);
    for (let y = c.y0 + bs.segments; y < c.L - 0.12; y += bs.segments) {
      const r = c.rb(y);
      c.add(
        lathe(
          [
            [r * 1.0, y - 0.006],
            [r * 1.22, y - 0.002],
            [r * 1.24, y + 0.001],
            [r * 1.05, y + 0.005],
          ],
          radial,
          { tile: 0.05 },
        ),
        sm,
      );
    }
  }
}

// ───────────────────────────────────────────────────────────── wraps

export function wrapMat(color: string, metallic = false): THREE.Material {
  return M({ c: color, r: metallic ? 0.28 : 0.42, m: metallic ? 0.85 : 0, cc: 1, ccr: 0.12, tex: 'thread', bump: 0.5 });
}

function wrapBand(c: RodCtx, y0: number, y1: number, m: THREE.Material, extra = 0.0007): void {
  const r = Math.max(c.rb(y0), c.rb(y1)) + extra;
  c.add(band(y0, y1, r, 0.0005, c.lod === 0 ? 10 : 7, { tile: 0.018, uRep: 1 }), m);
}

function buildWraps(c: RodCtx): void {
  const w = c.v.wraps;
  const main = wrapMat(w.color, w.metallic);
  const trim = wrapMat(w.trim ?? w.color, !!w.trim && w.metallic);
  let y = c.y0 + 0.006;
  const deco = w.deco ?? 'bands';
  if (deco !== 'none') {
    const len = w.decoLen ?? 0.055;
    if (deco === 'bands') {
      const seq: [number, THREE.Material][] = [
        [0.003, trim],
        [len * 0.55, main],
        [0.0025, trim],
        [0.004, main],
        [0.0025, trim],
        [0.006, main],
        [0.002, trim],
      ];
      for (const [h, m] of seq) {
        wrapBand(c, y, y + h, m);
        y += h;
      }
    } else {
      // diamond-ish: alternating thin bands of the two colours with a thick centre
      const n = 9;
      for (let i = 0; i < n; i++) {
        const h = i === 4 ? len * 0.3 : len * 0.7 / (n - 1);
        wrapBand(c, y, y + h, i % 2 === 0 ? main : trim);
        y += h;
      }
    }
  }
  // hook keeper
  const hk = y + 0.03;
  wrapBand(c, hk - 0.004, hk + 0.006, main);
  const r = c.rb(hk);
  c.add(
    xf(ring(0.0042, 0.00065, 4, 10, Math.PI * 1.2), { r: [0, 0, Math.PI / 2] }).rotateY(Math.PI / 2).translate(0, hk + 0.009, c.side * (r + 0.0015)),
    mref(c.v.guides?.frame ?? 'chrome'),
  );
  // ferrule
  if (c.v.blank.ferrule !== false && c.L > 2.0) {
    const fy = c.y0 + (c.L - c.y0) * 0.48;
    wrapBand(c, fy - 0.022, fy - 0.019, trim, 0.0012);
    wrapBand(c, fy - 0.019, fy + 0.01, main, 0.0012);
    wrapBand(c, fy + 0.01, fy + 0.013, trim, 0.0012);
  }
}

// ───────────────────────────────────────────────────────────── guides

function buildGuides(c: RodCtx): void {
  const gs = c.v.guides ?? {};
  const style = gs.style ?? (c.layout === 'fly' ? 'snake' : 'modern');
  const n = gs.count ?? Math.round(4 + c.L * 1.45);
  const frame = mref(gs.frame ?? 'chrome');
  const insert = mref(gs.ring ?? 'ceramic');
  const wm = wrapMat(c.v.wraps.color, c.v.wraps.metallic);
  const size = gs.size ?? 1;
  const start = c.y0 + (c.layout === 'fly' ? 0.1 : 0.16);
  const span = c.L - start - 0.05;
  const R0 = (c.layout === 'spin' ? 0.0145 : c.layout === 'fly' ? 0.0085 : 0.0082) * size;
  const R1 = 0.0032 * Math.max(0.8, size * 0.9);
  const seg = c.lod === 0 ? 12 : 8;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.35) / n;
    const y = start + span * (1 - Math.pow(1 - s, 1.28));
    const R = R0 + (R1 - R0) * Math.pow(i / Math.max(1, n - 1), 0.55);
    const rb = c.rb(y);
    const d = rb + R * 1.35 + 0.004 + (c.layout === 'spin' ? R * 0.35 : 0);
    const z = c.side * d;
    c.guides.push({ y, R, d });
    const tr = Math.max(0.0007, R * 0.13);
    if (style === 'snake' && i > 0) {
      // twisted wire snake guide
      const pts: V3[] = [];
      const f = 0.009 + R * 0.6;
      for (let j = 0; j <= 10; j++) {
        const t = j / 10;
        const a = t * TAU * 0.92 - Math.PI / 2;
        const yy = y - f + t * f * 2;
        const rr = t < 0.15 || t > 0.85 ? 0 : R;
        pts.push([Math.cos(a) * rr * 1.0, yy, c.side * (rb + 0.0012 + (rr > 0 ? R + Math.sin(a) * R : 0))]);
      }
      c.add(tube(path(pts), tr * 0.9, 18, 4), frame);
      wrapBand(c, y - f - 0.004, y - f + 0.004, wm, 0.0009);
      wrapBand(c, y + f - 0.004, y + f + 0.004, wm, 0.0009);
      continue;
    }
    // ring (frame) + insert
    c.add(xf(ring(R + tr * 0.7, tr, 4, seg), { p: [0, y, z] }), frame);
    if (style !== 'wire' && R > 0.0035) c.add(xf(ring(R, tr * 0.72, 4, seg), { p: [0, y, z] }), insert);
    if (style === 'ornate') {
      // small filigree crown: 4 beads around the ring
      for (let q = 0; q < 4; q++) {
        const a = (q / 4) * TAU + Math.PI / 4;
        c.add(new THREE.SphereGeometry(tr * 1.25, 6, 4).translate(Math.sin(a) * (R + tr * 1.8), y, z + Math.cos(a) * (R + tr * 1.8)), frame);
      }
    }
    // legs
    const zBottom = c.side * (d - R - tr * 1.5);
    const zFoot = c.side * (rb + 0.0011);
    const f = 0.008 + R * 0.9;
    const legR = Math.max(0.0006, tr * 0.8);
    const double = R > 0.0055;
    const legPairs: [number, number][] = double ? [[-1, 1], [1, 1]] : [[-1, 1]];
    for (const [dir] of legPairs) {
      for (const xs of double ? [0] : [-1, 1]) {
        const p0: V3 = [xs * R * 0.35, y, zBottom];
        const p1: V3 = [xs * R * 0.1, y + dir * f, zFoot];
        const pm: V3 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + dir * f * 0.08, (p0[2] + p1[2]) / 2];
        c.add(tube(path([p0, pm, p1]), legR, 4, 4, { flat: 0.6 }), frame);
      }
      // foot + wrap
      const fy = y + dir * f;
      const fy0 = dir < 0 ? fy - 0.006 : fy - 0.003;
      const fy1 = dir < 0 ? fy + 0.003 : fy + 0.006;
      wrapBand(c, fy0 - 0.003, fy1 + 0.003, wm, 0.0011);
    }
    if (double) {
      // side struts for the ring
      for (const xs of [-1, 1]) {
        const p0: V3 = [xs * (R + tr), y, z];
        const p1: V3 = [xs * R * 0.4, y, zBottom];
        c.add(tube(path([p0, [xs * R * 0.9, y, (z + zBottom) / 2 - c.side * R * 0.25], p1]), legR, 4, 3), frame);
      }
    }
  }
}

// ───────────────────────────────────────────────────────────── tip-top

function buildTip(c: RodCtx): void {
  const frame = mref(c.v.guides?.frame ?? 'chrome');
  const L = c.L;
  const rb = c.rb(L);
  c.add(cyl(L - 0.016, L + 0.001, rb + 0.0005, rb + 0.0004, 8, { cap1: true }), frame);
  const R = 0.0026;
  const z = c.side * (rb + R + 0.0012);
  c.add(xf(ring(R, 0.0006, 4, 10), { p: [0, L - 0.0035, z] }), frame);
  c.add(xf(ring(R * 0.8, 0.00045, 4, 10), { p: [0, L - 0.0035, z] }), mref(c.v.guides?.ring ?? 'ceramic'));
  c.add(cyl(L - 0.009, L - 0.001, 0.0008, 0.0008, 4).translate(0, 0, c.side * (rb + 0.0006)), frame);
  c.tip.set(0, L - 0.0035, z);
}

// ───────────────────────────────────────────────────────────── line

function buildLine(c: RodCtx): void {
  if (!c.lineStart || c.clip[0] > -1 || c.clip[1] < 99) return;
  const pts: THREE.Vector3[] = [c.lineStart.clone()];
  for (const g of c.guides) pts.push(new THREE.Vector3(0, g.y, c.side * g.d));
  pts.push(c.tip.clone());
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, lineMaterial(c.v.line ?? c.v.reel.line ?? '#e8f4f0'));
  line.name = 'rodLine';
  line.raycast = () => {};
  c.root.add(line);
}

const lineMats = new Map<string, THREE.LineBasicMaterial>();
function lineMaterial(color: string): THREE.LineBasicMaterial {
  let m = lineMats.get(color);
  if (!m) {
    m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 });
    lineMats.set(color, m);
  }
  return m;
}
