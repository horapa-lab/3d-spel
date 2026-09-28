/**
 * Reels: spinning, baitcaster, fly, antique spool (centre-pin) and conventional trolling reels.
 * All reels attach to the reel seat of the RodCtx. Spinning/fly/spool hang on +Z (underside),
 * baitcast/conventional sit on top (−Z). Optional themed emblem on the non-handle side.
 */
import * as THREE from 'three';
import { band, cyl, extrude, gemGeo, lathe, path, rbox, ring, starShape, tube, xf, type Geo, type V3 } from './kit/geo';
import { gem, M, mref, mspec, type MatSpec } from './kit/mat';
import { addSkull } from './parts';
import type { RodCtx } from './build';
import type { ReelSpec, ReelTheme } from './spec';

const TAU = Math.PI * 2;

/** Rotate a lathe (built around +Y) so its axis points along +X. */
function axisX(g: Geo): Geo {
  return g.rotateZ(-Math.PI / 2);
}

/** Map geometry local axes onto world axes (columns ex, ey, ez) and translate. */
function basis(g: Geo, ex: V3, ey: V3, ez: V3, o: V3): Geo {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...ex), new THREE.Vector3(...ey), new THREE.Vector3(...ez));
  m.setPosition(o[0], o[1], o[2]);
  g.applyMatrix4(m);
  return g;
}

function lineMat(color: string): THREE.Material {
  return M({ c: color, r: 0.42, tex: 'thread', bump: 0.6, sheen: 0.4, sheenC: '#ffffff' });
}

function knurled(ref: ReelSpec['accent']): THREE.Material {
  const s = mspec(ref, 'chrome') as MatSpec;
  return M({ ...s, tex: 'knurl', useMap: false, bump: 0.9 });
}

export function buildReel(c: RodCtx): void {
  const r = c.v.reel;
  switch (r.type) {
    case 'spinning':
      spinning(c, r);
      break;
    case 'baitcast':
      baitcast(c, r);
      break;
    case 'fly':
      fly(c, r);
      break;
    case 'spool':
      spoolReel(c, r);
      break;
    case 'conventional':
      conventional(c, r);
      break;
  }
}

/** Handle knob along +X starting at x=0 (length ~0.016*s). */
function knobGeo(s: number, style: 'barrel' | 'round' | 'paddle' | 'tbar' = 'barrel'): Geo {
  if (style === 'round')
    return axisX(
      lathe(
        [
          [0, 0],
          [0.0035 * s, 0.001 * s],
          [0.0072 * s, 0.006 * s],
          [0.0078 * s, 0.011 * s],
          [0.006 * s, 0.0155 * s],
          [0, 0.0172 * s],
        ],
        12,
      ),
    );
  if (style === 'tbar') {
    const g = new THREE.CapsuleGeometry(0.0055 * s, 0.026 * s, 4, 10);
    g.translate(0.012 * s, 0, 0);
    return g;
  }
  return axisX(
    lathe(
      [
        [0, 0],
        [0.0038 * s, 0.0008 * s],
        [0.0056 * s, 0.0035 * s],
        [0.0062 * s, 0.0085 * s],
        [0.0058 * s, 0.0135 * s],
        [0.0036 * s, 0.0155 * s],
        [0, 0.016 * s],
      ],
      12,
    ),
  );
}

function knobFor(c: RodCtx, r: ReelSpec, s: number, at: V3, style: 'barrel' | 'round' | 'paddle' | 'tbar' = 'barrel'): void {
  const km = mref(r.knob, { c: '#1f1f22', tex: 'eva', r: 0.85 });
  const th = r.theme ?? 'none';
  if (th === 'skull') {
    const g = new THREE.Group();
    const parts: { g: Geo; m: THREE.Material }[] = [];
    addSkull({ add: (gg, m) => parts.push({ g: gg, m }) }, 0, 0, 0, 0.012 * s, M({ c: '#efe6cf', tex: 'bone', r: 0.5 }));
    for (const p of parts) {
      p.g.rotateZ(-Math.PI / 2).rotateX(-Math.PI / 2);
      p.g.translate(at[0] + 0.004 * s, at[1], at[2]);
      c.add(p.g, p.m);
    }
    void g;
    c.add(cyl(0, 0.005 * s, 0.0016 * s, 0.0016 * s, 6).rotateZ(-Math.PI / 2).translate(at[0], at[1], at[2]), mref('chrome'));
    return;
  }
  if (th === 'crystal' || th === 'eye' || th === 'moon' || th === 'star') {
    const col = th === 'eye' ? '#40f0ff' : th === 'crystal' ? '#8ff0ff' : th === 'moon' ? '#dfe6ff' : '#ffd86a';
    c.add(cyl(0, 0.006 * s, 0.0017 * s, 0.0017 * s, 6).rotateZ(-Math.PI / 2).translate(at[0], at[1], at[2]), mref(r.accent ?? 'gold'));
    const orb = th === 'crystal' ? gemGeo(0.0075 * s, 'shard').rotateZ(-Math.PI / 2) : new THREE.SphereGeometry(0.0068 * s, 12, 10);
    orb.translate(at[0] + 0.012 * s, at[1], at[2]);
    c.add(orb, M({ c: col, e: col, ei: th === 'eye' ? 1.3 : 0.6, r: 0.1, cc: 1, irid: 0.4, flat: th === 'crystal' }));
    return;
  }
  if (th === 'shell') {
    c.add(cyl(0, 0.006 * s, 0.0017 * s, 0.0017 * s, 6).rotateZ(-Math.PI / 2).translate(at[0], at[1], at[2]), mref(r.accent ?? 'gold'));
    c.add(new THREE.SphereGeometry(0.0068 * s, 14, 10).translate(at[0] + 0.011 * s, at[1], at[2]), mref('pearl'));
    return;
  }
  c.add(cyl(0, 0.004 * s, 0.0015 * s, 0.0015 * s, 6).rotateZ(-Math.PI / 2).translate(at[0], at[1], at[2]), mref('chrome'));
  c.add(knobGeo(s, style).translate(at[0] + 0.0035 * s, at[1], at[2]), km);
}

// ───────────────────────────────────────────────────────────── spinning

function spinning(c: RodCtx, r: ReelSpec): void {
  const s = r.size ?? 1;
  const ys = (c.seatA + c.seatB) / 2;
  const z0 = c.rs;
  const body = mref(r.body);
  const acc = mref(r.accent ?? r.body);
  const spoolM = mref(r.spool ?? r.accent ?? r.body);
  const metal = mref('chrome');
  const zA = z0 + 0.05 * s;
  const seg = c.segs;
  const Y = (v: number) => ys + v * s;
  // foot + stem
  c.add(rbox(0.0095 * s, 0.054 * s, 0.003 * s, 0.0012, 1, 0.05).translate(0, ys, z0 + 0.0014), body);
  c.add(
    tube(
      path([
        [0, Y(-0.004), z0 + 0.002],
        [0, Y(-0.004), z0 + 0.018 * s],
        [0, Y(0.0), zA - 0.02 * s],
      ]),
      (t) => (0.0034 + 0.0022 * t) * s,
      6,
      6,
      { flat: 0.5, up: [0, 1, 0] },
    ),
    body,
  );
  // gearbox (disc, axis X)
  const bc: V3 = [0, Y(-0.007), zA + 0.007 * s];
  const gb = axisX(
    lathe(
      [
        [0, -0.0125 * s],
        [0.0165 * s, -0.0125 * s],
        [0.0222 * s, -0.0113 * s],
        [0.0252 * s, -0.0072 * s],
        [0.0258 * s, 0],
        [0.0252 * s, 0.0072 * s],
        [0.0222 * s, 0.0113 * s],
        [0.0165 * s, 0.0125 * s],
        [0, 0.0125 * s],
      ],
      seg + 2,
    ),
  );
  gb.scale(1, 1, 1.06);
  c.add(gb.translate(bc[0], bc[1], bc[2]), body);
  // nose toward rotor
  c.add(cyl(Y(-0.006), Y(0.023), 0.0158 * s, 0.0108 * s, seg).translate(0, 0, zA), body);
  // rotor cup
  c.add(
    lathe(
      [
        [0.0106 * s, Y(0.0205)],
        [0.0158 * s, Y(0.0238)],
        [0.0196 * s, Y(0.0292)],
        [0.0206 * s, Y(0.0338)],
        [0.0192 * s, Y(0.0352)],
      ],
      seg,
    ).translate(0, 0, zA),
    acc,
  );
  // rotor arms
  for (const xs of [-1, 1]) {
    c.add(
      tube(
        path([
          [xs * 0.0188 * s, Y(0.027), zA],
          [xs * 0.0222 * s, Y(0.038), zA],
          [xs * 0.0236 * s, Y(0.0485), zA],
        ]),
        (t) => (0.0036 - t * 0.0012) * s,
        5,
        5,
        { flat: 0.45, up: [0, 0, 1], cap1: true },
      ),
      acc,
    );
  }
  // spool
  c.add(
    lathe(
      [
        [0.0196 * s, Y(0.0312)],
        [0.0212 * s, Y(0.0326)],
        [0.0212 * s, Y(0.0388)],
        [0.0189 * s, Y(0.0404)],
        [0.0181 * s, Y(0.0412)],
      ],
      seg,
    ).translate(0, 0, zA),
    spoolM,
  );
  c.add(cyl(Y(0.041), Y(0.0572), 0.0181 * s, 0.0181 * s, seg, { tile: 0.012 }).translate(0, 0, zA), lineMat(r.line ?? '#dfe9e4'));
  c.add(
    lathe(
      [
        [0.0181 * s, Y(0.0571)],
        [0.0199 * s, Y(0.0578)],
        [0.0206 * s, Y(0.0596)],
        [0.0196 * s, Y(0.0612)],
        [0.0128 * s, Y(0.0626)],
      ],
      seg,
    ).translate(0, 0, zA),
    spoolM,
  );
  // drag knob
  c.add(
    lathe(
      [
        [0.0128 * s, Y(0.0622)],
        [0.0094 * s, Y(0.0632)],
        [0.0094 * s, Y(0.0702)],
        [0.0078 * s, Y(0.0722)],
        [0.0035 * s, Y(0.0734)],
        [0, Y(0.0736)],
      ],
      seg,
      { tile: 0.012 },
    ).translate(0, 0, zA),
    knurled(r.accent ?? r.body),
  );
  // bail
  const Rb = 0.0238 * s;
  const bpts: V3[] = [];
  for (let j = 0; j <= 10; j++) {
    const a = (Math.PI * j) / 10;
    bpts.push([Math.cos(a) * Rb, Y(0.0485 + Math.sin(a) * 0.0095), zA + Math.sin(a) * Rb]);
  }
  c.add(tube(path(bpts), 0.00115 * s, 18, 5), metal);
  c.add(cyl(Y(0.0445), Y(0.0525), 0.0026 * s, 0.0026 * s, 8, { cap0: true, cap1: true }).translate(Rb, 0, zA), metal);
  // handle: shaft + crank arm + knob (right side, +X)
  const hx = 0.0125 * s;
  c.add(axisX(cyl(0, 0.009 * s, 0.0036 * s, 0.003 * s, 8)).translate(hx, bc[1], bc[2]), metal);
  const dir = new THREE.Vector3(0, -0.4, 0.92).normalize();
  const la = 0.038 * s;
  const ax = hx + 0.009 * s;
  const end: V3 = [ax + 0.002 * s, bc[1] + dir.y * la, bc[2] + dir.z * la];
  c.add(
    tube(
      path([
        [ax, bc[1], bc[2]],
        [ax + 0.0025 * s, bc[1] + dir.y * la * 0.5, bc[2] + dir.z * la * 0.5],
        end,
      ]),
      (t) => (0.0036 - 0.0012 * t) * s,
      6,
      6,
      { flat: 0.42, up: [0, 0, 1], cap0: true, cap1: true },
    ),
    acc,
  );
  knobFor(c, r, s, end);
  // side hub (handle side) + emblem cap (other side)
  c.add(axisX(lathe([[0.0115 * s, 0], [0.0108 * s, 0.0012 * s], [0, 0.0016 * s]], seg)).translate(hx, bc[1], bc[2]), acc);
  const capR = 0.0192 * s;
  c.add(
    axisX(
      lathe(
        [
          [capR, 0],
          [capR * 0.92, 0.0012 * s],
          [capR * 0.55, 0.0018 * s],
          [0, 0.002 * s],
        ],
        seg,
      ),
    )
      .rotateY(Math.PI)
      .translate(-hx, bc[1], bc[2]),
    acc,
  );
  emblem(c, r.theme ?? 'none', [-hx - 0.002 * s, bc[1], bc[2]], -1, capR * 0.8, r);
  c.lineStart = new THREE.Vector3(Rb, Y(0.049), zA);
}

// ───────────────────────────────────────────────────────────── baitcaster

function baitcast(c: RodCtx, r: ReelSpec): void {
  const s = r.size ?? 1;
  const ys = (c.seatA + c.seatB) / 2;
  const body = mref(r.body);
  const acc = mref(r.accent ?? r.body);
  const spoolM = mref(r.spool ?? r.accent ?? r.body);
  const metal = mref('chrome');
  const zA = -(c.rs + 0.024 * s);
  const cy = ys + 0.004 * s;
  const W = 0.0215 * s;
  // side plates: rounded bean shape in (along-rod, away-from-rod) coords
  const sh = new THREE.Shape();
  sh.absellipse(0.002 * s, 0, 0.034 * s, 0.024 * s, 0, TAU, false, 0);
  for (const xs of [-1, 1]) {
    const g = extrude(sh, 0.0062 * s, 0.0016 * s, 12, 2, 0.05);
    basis(g, [0, 1, 0], [0, 0, -1], [-1, 0, 0], [xs * W, cy, zA]);
    c.add(g, xs > 0 ? acc : body);
  }
  // palm cover over the top/back
  const cover = new THREE.CylinderGeometry(0.0255 * s, 0.0255 * s, W * 2, 14, 1, true, Math.PI * 0.5, Math.PI * 1.05);
  cover.rotateZ(Math.PI / 2);
  cover.translate(0, cy - 0.004 * s, zA);
  c.add(cover, body);
  // base bar onto seat
  c.add(rbox(0.012 * s, 0.056 * s, 0.006 * s, 0.002, 1, 0.05).translate(0, ys, -(c.rs + 0.002)), body);
  c.add(rbox(W * 2, 0.03 * s, 0.006 * s, 0.002, 1, 0.05).translate(0, cy - 0.012 * s, -(c.rs + 0.005)), body);
  // spool + line
  c.add(axisX(cyl(-W + 0.001, W - 0.001, 0.0145 * s, 0.0145 * s, c.segs, { tile: 0.012 })).translate(0, cy, zA), lineMat(r.line ?? '#3fae5a'));
  for (const xs of [-1, 1])
    c.add(axisX(band(-0.0008 * s, 0.0008 * s, 0.0172 * s, 0.0004, c.segs)).translate(xs * (W - 0.0022 * s), cy, zA), spoolM);
  // level wind
  const lwY = cy + 0.034 * s;
  const lwZ = zA + 0.008 * s;
  c.add(axisX(cyl(-W, W, 0.0026 * s, 0.0026 * s, 8)).translate(0, lwY, lwZ), metal);
  c.add(rbox(0.008 * s, 0.006 * s, 0.009 * s, 0.0015, 1, 0.05).translate(0.004 * s, lwY, lwZ - 0.002 * s), acc);
  // star drag + power handle on +X
  const star = extrude(starShape(6, 0.0112 * s, 0.0074 * s), 0.0028 * s, 0.0006, 1, 1);
  star.rotateY(Math.PI / 2);
  c.add(star.translate(W + 0.0055 * s, cy, zA), metal);
  c.add(axisX(cyl(0, 0.008 * s, 0.003 * s, 0.003 * s, 8)).translate(W + 0.003 * s, cy, zA), metal);
  const ax = W + 0.0095 * s;
  c.add(
    tube(
      path([
        [ax, cy - 0.034 * s, zA - 0.004 * s],
        [ax + 0.0015 * s, cy, zA],
        [ax, cy + 0.034 * s, zA - 0.004 * s],
      ]),
      0.003 * s,
      10,
      6,
      { flat: 0.45, up: [0, 0, 1], cap0: true, cap1: true },
    ),
    acc,
  );
  for (const ey of [-1, 1]) {
    const k = new THREE.SphereGeometry(0.0078 * s, 12, 8);
    k.scale(0.7, 1.05, 0.55);
    k.translate(ax + 0.0075 * s, cy + ey * 0.038 * s, zA - 0.004 * s);
    c.add(cyl(0, 0.005 * s, 0.0014 * s, 0.0014 * s, 6).rotateZ(-Math.PI / 2).translate(ax, cy + ey * 0.038 * s, zA - 0.004 * s), metal);
    c.add(k, mref(r.knob, { c: '#1f1f22', tex: 'eva', r: 0.85 }));
  }
  // cast control cap on -X
  c.add(axisX(lathe([[0.0085 * s, 0], [0.0085 * s, 0.003 * s], [0.006 * s, 0.0045 * s], [0, 0.005 * s]], c.segs, { tile: 0.01 })).rotateY(Math.PI).translate(-W - 0.003 * s, cy, zA), knurled(r.accent ?? r.body));
  emblem(c, r.theme ?? 'none', [-W - 0.003 * s, cy + 0.016 * s, zA - 0.006 * s], -1, 0.007 * s, r);
  c.lineStart = new THREE.Vector3(0, lwY + 0.003 * s, lwZ);
}

// ───────────────────────────────────────────────────────────── fly reel

function fly(c: RodCtx, r: ReelSpec): void {
  const s = r.size ?? 1;
  const ys = (c.seatA + c.seatB) / 2;
  const body = mref(r.body);
  const acc = mref(r.accent ?? r.body);
  const spoolM = mref(r.spool ?? r.accent ?? r.body);
  const Rf = 0.036 * s;
  const zF = c.rs + 0.008 * s + Rf;
  const seg = c.segs + 6;
  // frame back plate + rim (axis X)
  c.add(
    axisX(
      lathe(
        [
          [0, -0.0132 * s],
          [Rf * 0.94, -0.0132 * s],
          [Rf, -0.0118 * s],
          [Rf, -0.0035 * s],
          [Rf * 0.975, -0.0022 * s],
          [Rf * 0.94, -0.0022 * s],
        ],
        seg,
      ),
    ).translate(0, ys, zF),
    body,
  );
  // fly line
  c.add(axisX(cyl(-0.0025 * s, 0.0092 * s, Rf * 0.8, Rf * 0.8, seg, { tile: 0.01 })).translate(0, ys, zF), lineMat(r.line ?? '#ff9a2a'));
  // spool rim
  c.add(
    axisX(
      lathe(
        [
          [Rf * 0.93, -0.0008 * s],
          [Rf * 0.975, 0.0008 * s],
          [Rf * 0.975, 0.0106 * s],
          [Rf * 0.93, 0.0118 * s],
        ],
        seg,
      ),
    ).translate(0, ys, zF),
    spoolM,
  );
  // ported spool face
  const face = new THREE.Shape();
  face.absarc(0, 0, Rf * 0.94, 0, TAU, false);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * Rf * 0.58, Math.sin(a) * Rf * 0.58, Rf * 0.2, 0, TAU, true);
    face.holes.push(h);
  }
  const fg = extrude(face, 0.0022 * s, 0.0007 * s, 10, 1, 0.05);
  fg.rotateY(Math.PI / 2);
  c.add(fg.translate(0.0112 * s, ys, zF), spoolM);
  // hub
  c.add(axisX(lathe([[Rf * 0.22, 0], [Rf * 0.2, 0.0022 * s], [Rf * 0.08, 0.0034 * s], [0, 0.0036 * s]], 12)).translate(0.0122 * s, ys, zF), acc);
  // handle knob on the face + counterweight
  const ka = Math.PI * 0.25;
  const kp: V3 = [0.0128 * s, ys + Math.cos(ka) * Rf * 0.66, zF + Math.sin(ka) * Rf * 0.66];
  knobFor(c, r, s, kp);
  c.add(new THREE.SphereGeometry(0.0038 * s, 8, 6).scale(0.5, 1, 1).translate(0.0128 * s, ys - Math.cos(ka) * Rf * 0.66, zF - Math.sin(ka) * Rf * 0.66), acc);
  // frame pillars (cage) around the back
  for (const a of [-0.6, 0, 0.6]) {
    const ang = Math.PI + a;
    c.add(axisX(cyl(-0.012 * s, -0.001 * s, 0.0017 * s, 0.0017 * s, 6)).translate(0, ys + Math.sin(ang) * Rf * 0.985, zF + Math.cos(ang) * Rf * 0.985), body);
  }
  // foot stem
  c.add(rbox(0.009 * s, 0.018 * s, zF - Rf - c.rs + 0.003, 0.002, 1, 0.05).translate(-0.006 * s, ys, (zF - Rf + c.rs) / 2), body);
  c.add(rbox(0.0095 * s, 0.056 * s, 0.003 * s, 0.0012, 1, 0.05).translate(0, ys, c.rs + 0.0014), body);
  // drag knob on back
  c.add(axisX(lathe([[0.0085 * s, 0], [0.0085 * s, 0.004 * s], [0.006 * s, 0.0055 * s], [0, 0.006 * s]], 12, { tile: 0.01 })).rotateY(Math.PI).translate(-0.0132 * s, ys, zF), knurled(r.accent ?? r.body));
  emblem(c, r.theme ?? 'none', [-0.019 * s, ys, zF], -1, 0.011 * s, r);
  c.lineStart = new THREE.Vector3(0, ys + Rf * 0.3, zF - Rf * 0.76);
}

// ───────────────────────────────────────────────────────────── antique centre-pin spool

function spoolReel(c: RodCtx, r: ReelSpec): void {
  const s = r.size ?? 1;
  const ys = (c.seatA + c.seatB) / 2;
  const body = mref(r.body, { c: '#ffffff', tex: 'wood', ta: 'walnut', r: 0.35, cc: 0.9 });
  const acc = mref(r.accent ?? 'oldBrass');
  const Rs = 0.04 * s;
  const zS = c.rs + 0.009 * s + Rs;
  const seg = c.segs + 6;
  // back plate (brass) with rim
  c.add(
    axisX(
      lathe(
        [
          [0, -0.012 * s],
          [Rs * 0.96, -0.012 * s],
          [Rs, -0.0105 * s],
          [Rs, -0.0075 * s],
          [Rs * 0.9, -0.0072 * s],
        ],
        seg,
      ),
    ).translate(0, ys, zS),
    acc,
  );
  // line drum
  c.add(axisX(cyl(-0.0075 * s, 0.006 * s, Rs * 0.78, Rs * 0.78, seg, { tile: 0.01 })).translate(0, ys, zS), lineMat(r.line ?? '#d8c9a0'));
  // wooden front drum face with spokes (wagon wheel)
  const face = new THREE.Shape();
  face.absarc(0, 0, Rs * 0.97, 0, TAU, false);
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * TAU + 0.25;
    const a1 = a0 + TAU / 4 - 0.5;
    const h = new THREE.Path();
    h.absarc(0, 0, Rs * 0.78, a0, a1, false);
    h.absarc(0, 0, Rs * 0.32, a1, a0, true);
    h.closePath();
    face.holes.push(h);
  }
  const fg = extrude(face, 0.005 * s, 0.001 * s, 10, 1, 0.08);
  fg.rotateY(Math.PI / 2);
  c.add(fg.translate(0.0085 * s, ys, zS), body);
  // brass rim ring on the face
  c.add(axisX(band(-0.0012 * s, 0.0012 * s, Rs * 0.985, 0.0005, seg)).translate(0.0115 * s, ys, zS), acc);
  // hub + screw
  c.add(axisX(lathe([[Rs * 0.3, 0], [Rs * 0.28, 0.003 * s], [Rs * 0.12, 0.0045 * s], [0, 0.005 * s]], 12)).translate(0.011 * s, ys, zS), acc);
  // two handle knobs
  for (const a of [Math.PI * 0.3, Math.PI * 1.3]) {
    const kp: V3 = [0.012 * s, ys + Math.cos(a) * Rs * 0.62, zS + Math.sin(a) * Rs * 0.62];
    c.add(cyl(0, 0.004 * s, 0.0018 * s, 0.0018 * s, 6).rotateZ(-Math.PI / 2).translate(kp[0], kp[1], kp[2]), acc);
    c.add(knobGeo(s * 0.95, 'barrel').translate(kp[0] + 0.0035 * s, kp[1], kp[2]), mref(r.knob, { c: '#ffffff', tex: 'wood', ta: 'ebony', r: 0.3, cc: 0.8 }));
  }
  // foot: brass stem + plate
  c.add(rbox(0.008 * s, 0.02 * s, zS - Rs - c.rs + 0.004, 0.002, 1, 0.05).translate(-0.004 * s, ys, (zS - Rs + c.rs) / 2), acc);
  c.add(rbox(0.0095 * s, 0.058 * s, 0.003 * s, 0.0012, 1, 0.05).translate(0, ys, c.rs + 0.0014), acc);
  // check button
  c.add(new THREE.SphereGeometry(0.003 * s, 8, 6).translate(-0.012 * s, ys + Rs * 0.7, zS + Rs * 0.3), acc);
  emblem(c, r.theme ?? 'none', [-0.0125 * s, ys, zS], -1, 0.013 * s, r);
  c.lineStart = new THREE.Vector3(0, ys, zS - Rs * 0.76);
}

// ───────────────────────────────────────────────────────────── conventional (trolling)

function conventional(c: RodCtx, r: ReelSpec): void {
  const s = r.size ?? 1;
  const ys = (c.seatA + c.seatB) / 2;
  const body = mref(r.body);
  const acc = mref(r.accent ?? r.body);
  const metal = mref('chrome');
  const Rc = 0.034 * s;
  const zC = -(c.rs + 0.008 * s + Rc);
  const W = 0.024 * s;
  const seg = c.segs + 6;
  // side plates
  for (const xs of [-1, 1]) {
    const g = axisX(
      lathe(
        [
          [0, -0.0045 * s],
          [Rc * 0.9, -0.0045 * s],
          [Rc, -0.003 * s],
          [Rc, 0.003 * s],
          [Rc * 0.9, 0.0045 * s],
          [Rc * 0.35, 0.0055 * s],
          [0, 0.0058 * s],
        ],
        seg,
      ),
    );
    if (xs < 0) g.rotateY(Math.PI);
    c.add(g.translate(xs * W, ys, zC), xs > 0 ? acc : body);
    // bevel ring
    c.add(axisX(band(-0.0014 * s, 0.0014 * s, Rc * 1.01, 0.0006, seg)).translate(xs * (W - 0.004 * s), ys, zC), metal);
  }
  // line
  c.add(axisX(cyl(-W + 0.004 * s, W - 0.004 * s, Rc * 0.82, Rc * 0.82, seg, { tile: 0.012 })).translate(0, ys, zC), lineMat(r.line ?? '#2f6fd6'));
  // pillars
  for (const a of [0.9, 2.3, 3.6, 5.0]) {
    c.add(axisX(cyl(-W, W, 0.0022 * s, 0.0022 * s, 6)).translate(0, ys + Math.sin(a) * Rc * 0.93, zC + Math.cos(a) * Rc * 0.93), metal);
  }
  // clamp to seat
  c.add(rbox(0.014 * s, 0.05 * s, zC + Rc * 0.9 + c.rs, 0.002, 1, 0.05).translate(0, ys, (zC + Rc * 0.9 - c.rs) / 2), body);
  // lever drag on +X
  c.add(
    tube(
      path([
        [W + 0.006 * s, ys, zC],
        [W + 0.008 * s, ys + 0.012 * s, zC - Rc * 0.55],
        [W + 0.009 * s, ys + 0.016 * s, zC - Rc * 0.85],
      ]),
      (t) => (0.0038 - 0.0012 * t) * s,
      6,
      6,
      { flat: 0.45, up: [0, 0, 1], cap1: true },
    ),
    metal,
  );
  // crank arm + T-bar knob
  const ax = W + 0.008 * s;
  const end: V3 = [ax + 0.004 * s, ys - 0.044 * s, zC + 0.012 * s];
  c.add(axisX(cyl(0, 0.008 * s, 0.0045 * s, 0.004 * s, 8)).translate(W, ys, zC), metal);
  c.add(tube(path([[ax, ys + 0.008 * s, zC], [ax + 0.002 * s, ys - 0.018 * s, zC + 0.006 * s], end]), (t) => (0.0045 - 0.0012 * t) * s, 6, 6, { flat: 0.45, up: [0, 0, 1], cap0: true, cap1: true }), acc);
  knobFor(c, r, s * 1.15, end, 'tbar');
  emblem(c, r.theme ?? 'none', [-W - 0.006 * s, ys, zC], -1, 0.014 * s, r);
  c.lineStart = new THREE.Vector3(0, ys, zC + Rc * 0.82);
}

// ───────────────────────────────────────────────────────────── themed emblems

/**
 * Emblem on a reel face: centre `at`, facing ±X (`dir`), radius `R`.
 */
function emblem(c: RodCtx, theme: ReelTheme, at: V3, dir: 1 | -1, R: number, r: ReelSpec): void {
  if (theme === 'none') return;
  const face = (g: Geo) => {
    // built facing +Z → rotate to face ±X
    g.rotateY(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    return g.translate(at[0], at[1], at[2]);
  };
  const gold = mref(r.accent ?? 'gold');
  switch (theme) {
    case 'shell': {
      const sh = new THREE.Shape();
      const n = 7;
      sh.moveTo(0, -R * 0.55);
      for (let i = 0; i <= n; i++) {
        const a = Math.PI * 0.08 + (Math.PI * 0.84 * i) / n;
        const a2 = Math.PI * 0.08 + (Math.PI * 0.84 * (i + 0.5)) / n;
        const px = Math.cos(a) * R;
        const py = Math.sin(a) * R - R * 0.35;
        if (i === 0) sh.lineTo(px, py);
        else sh.quadraticCurveTo(Math.cos(a2 - Math.PI * 0.84 / n) * R * 1.12, Math.sin(a2 - Math.PI * 0.84 / n) * R * 1.12 - R * 0.35, px, py);
      }
      sh.lineTo(0, -R * 0.55);
      const g = extrude(sh, R * 0.12, R * 0.08, 6, 2, 0.02);
      c.add(face(g), M({ c: '#ffd9c9', r: 0.3, cc: 1, irid: 0.6 }));
      return;
    }
    case 'skull': {
      const parts: { g: Geo; m: THREE.Material }[] = [];
      addSkull({ add: (g, m) => parts.push({ g, m }) }, 0, -R * 0.7, -R * 0.2, R * 1.2, M({ c: '#efe6cf', tex: 'bone', r: 0.5 }));
      for (const p of parts) c.add(face(p.g), p.m);
      return;
    }
    case 'gear': {
      const sh = new THREE.Shape();
      const teeth = 10;
      for (let i = 0; i < teeth * 2; i++) {
        const a0 = (i / (teeth * 2)) * TAU;
        const a1 = ((i + 1) / (teeth * 2)) * TAU;
        const rr = i % 2 === 0 ? R : R * 0.8;
        if (i === 0) sh.moveTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
        else sh.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
        sh.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
      }
      const hole = new THREE.Path();
      hole.absarc(0, 0, R * 0.45, 0, TAU, true);
      sh.holes.push(hole);
      c.add(face(extrude(sh, R * 0.18, R * 0.04, 2, 1, 0.02)), mref('bronze'));
      c.add(face(new THREE.CylinderGeometry(R * 0.46, R * 0.46, R * 0.1, 14).rotateX(Math.PI / 2)), M({ c: '#ff6a1a', e: '#ff5a0a', ei: 2.2, r: 0.4 }));
      return;
    }
    case 'crystal': {
      c.add(face(gemGeo(R * 0.55, 'round').rotateX(-Math.PI / 2)), gem('#7fe8ff', 0.5));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        c.add(face(new THREE.SphereGeometry(R * 0.1, 6, 4).translate(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, 0)), gold);
      }
      return;
    }
    case 'star': {
      c.add(face(extrude(starShape(5, R, R * 0.45), R * 0.14, R * 0.05, 1, 1)), gold);
      c.add(face(gemGeo(R * 0.3, 'round').rotateX(-Math.PI / 2).translate(0, 0, R * 0.12)), gem('#ffe9a8', 0.8));
      return;
    }
    case 'sun': {
      c.add(face(extrude(starShape(12, R, R * 0.72), R * 0.1, R * 0.04, 1, 1)), gold);
      c.add(face(gemGeo(R * 0.55, 'round').rotateX(-Math.PI / 2).translate(0, 0, R * 0.08)), gem('#ff8a1a', 0.7));
      return;
    }
    case 'leaf': {
      const sh = new THREE.Shape();
      sh.moveTo(0, -R);
      sh.quadraticCurveTo(R * 0.9, 0, 0, R);
      sh.quadraticCurveTo(-R * 0.9, 0, 0, -R);
      c.add(face(extrude(sh, R * 0.08, R * 0.05, 6, 1, 0.02)), M({ c: '#4f8a2a', r: 0.45, cc: 0.6 }));
      c.add(face(cyl(-R * 0.9, R * 0.9, R * 0.05, R * 0.03, 4).translate(0, 0, R * 0.1)), M({ c: '#c6d86a', r: 0.5 }));
      return;
    }
    case 'eye': {
      c.add(face(new THREE.SphereGeometry(R * 0.75, 14, 10).scale(1, 1, 0.6)), M({ c: '#e8f4ff', r: 0.15, cc: 1 }));
      c.add(face(new THREE.CircleGeometry(R * 0.42, 14).translate(0, 0, R * 0.455)), M({ c: '#20e0ff', e: '#20e0ff', ei: 1.4, r: 0.2 }));
      c.add(face(new THREE.CircleGeometry(R * 0.16, 10).scale(0.5, 1.2, 1).translate(0, 0, R * 0.462)), M({ c: '#05060a', r: 0.3 }));
      c.add(face(ring(R * 0.78, R * 0.1, 5, 16).rotateX(Math.PI / 2)), mref(r.accent ?? 'blackAnod'));
      return;
    }
    case 'moon': {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, R, Math.PI * 0.35, Math.PI * 1.65, false);
      sh.absarc(R * 0.42, 0, R * 0.78, Math.PI * 1.55, Math.PI * 0.45, true);
      c.add(face(extrude(sh, R * 0.12, R * 0.05, 12, 1, 0.02)), mref('silver'));
      c.add(face(extrude(starShape(4, R * 0.35, R * 0.12), R * 0.08, R * 0.02, 1, 1).translate(R * 0.45, R * 0.1, 0)), M({ c: '#fff4c8', e: '#ffe9a0', ei: 1.2, r: 0.2 }));
      return;
    }
    case 'snow': {
      const ice = M({ c: '#dff6ff', e: '#9fe0ff', ei: 0.4, r: 0.1, cc: 1, irid: 0.3 });
      for (let i = 0; i < 3; i++) {
        const g = new THREE.BoxGeometry(R * 2, R * 0.14, R * 0.08);
        g.rotateZ((i / 3) * Math.PI);
        c.add(face(g), ice);
        for (const sgn of [-1, 1]) {
          for (const side of [-1, 1]) {
            const b = new THREE.BoxGeometry(R * 0.5, R * 0.1, R * 0.07);
            b.rotateZ(side * 0.8);
            b.translate(sgn * R * 0.62, side * R * 0.16, 0);
            b.rotateZ((i / 3) * Math.PI);
            c.add(face(b), ice);
          }
        }
      }
      return;
    }
    case 'bone': {
      c.add(face(new THREE.SphereGeometry(R * 0.6, 10, 8).scale(1, 1, 0.5)), M({ c: '#efe6cf', tex: 'bone', r: 0.5 }));
      return;
    }
  }
}

export { band };
