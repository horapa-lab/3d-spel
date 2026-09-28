/**
 * Themed rod decorations (coral, frost, mushrooms, filigree, runes, tentacles, orbiting stars…).
 * Static parts merge into the rod kit; animated parts get their own small group.
 */
import * as THREE from 'three';
import { band, cyl, extrude, gemGeo, Kit, lathe, path, ring, starShape, tube, type Geo, type V3 } from './kit/geo';
import { gem, M, mref } from './kit/mat';
import type { RodCtx } from './build';
import type { Deco } from './spec';
import { addSkull } from './parts';
import { rng } from './kit/noise';

const TAU = Math.PI * 2;

/** Point on the blank surface at height y, angle a (0 = +Z, π/2 = +X), offset out. */
function surf(c: RodCtx, y: number, a: number, out = 0): V3 {
  const r = c.rb(y) + out;
  return [Math.sin(a) * r, y, Math.cos(a) * r];
}

function animGroup(c: RodCtx, y: number, build: (k: Kit) => void, anim?: (g: THREE.Group, t: number) => void): void {
  if (y < c.clip[0] - 0.1 || y > c.clip[1] + 0.1) return;
  const k = new Kit();
  build(k);
  const g = new THREE.Group();
  g.position.y = y;
  k.flush(g, 'deco');
  if (anim) c.anims.push((t) => anim(g, t));
  c.root.add(g);
}

export function buildDecos(c: RodCtx, decos: Deco[]): void {
  const R = rng(Math.round(c.L * 1000));
  for (const d of decos) {
    switch (d.kind) {
      case 'coral': {
        const y = c.yAt(d.at);
        const m1 = M({ c: '#ffffff', tex: 'coral', ta: d.color ?? '#ff6f86', r: 0.6 });
        const m2 = M({ c: '#ffffff', tex: 'coral', ta: d.color2 ?? '#ffa24a', r: 0.6 });
        const n = d.count ?? 5;
        // encrusted base
        const prof: [number, number][] = [];
        for (let i = 0; i <= 6; i++) prof.push([c.rb(y) + 0.003 + Math.sin(i * 2.1) * 0.0015, y - 0.03 + i * 0.01]);
        c.add(lathe(prof, 10, { tile: 0.04 }), m1);
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (i / n) * TAU + R() * 0.4;
          const yy = y - 0.02 + R() * 0.04;
          const p0 = surf(c, yy, a, 0.002);
          const out = 0.03 + R() * 0.025;
          const p1: V3 = [Math.sin(a) * out * 0.6, yy + 0.02 + R() * 0.02, Math.cos(a) * out * 0.6];
          const p2: V3 = [Math.sin(a + 0.3) * out, yy + 0.05 + R() * 0.03, Math.cos(a + 0.3) * out];
          const m = i % 2 ? m2 : m1;
          c.add(tube(path([p0, p1, p2]), (t) => 0.0038 * (1 - t * 0.55), 8, 5, { cap1: true }), m);
          const q: V3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
          const q2: V3 = [q[0] + Math.sin(a - 0.8) * 0.018, q[1] + 0.022, q[2] + Math.cos(a - 0.8) * 0.018];
          c.add(tube(path([q, q2]), (t) => 0.0024 * (1 - t * 0.5), 4, 5, { cap1: true }), m);
        }
        break;
      }
      case 'shells':
      case 'barnacles': {
        const y0 = d.kind === 'shells' ? c.yAt(d.at) - 0.03 : c.yAt(d.from);
        const y1 = d.kind === 'shells' ? c.yAt(d.at) + 0.03 : c.yAt(d.to);
        const bm = M({ c: '#d8d0bf', tex: 'stone', r: 0.8 });
        const n = d.kind === 'shells' ? 6 : 10;
        for (let i = 0; i < n; i++) {
          const y = y0 + (y1 - y0) * R();
          const a = R() * TAU;
          const p = surf(c, y, a, -0.0005);
          const s = 0.003 + R() * 0.003;
          const g = lathe([[s, 0], [s * 0.8, s * 0.7], [s * 0.45, s * 1.0], [s * 0.3, s * 0.8]], 6);
          g.rotateX(Math.PI / 2).rotateY(a).translate(p[0], p[1], p[2]);
          c.add(g, bm);
        }
        break;
      }
      case 'frost':
      case 'crystals': {
        const isFrost = d.kind === 'frost';
        const col = d.color ?? (isFrost ? '#bfefff' : '#7fe8ff');
        const m = M({ c: col, e: col, ei: isFrost ? 0.25 : 0.6, r: 0.08, cc: 1, irid: 0.4, flat: true, op: 0.9 });
        const n = d.count ?? (isFrost ? 12 : 6);
        const y0 = isFrost ? c.yAt(d.from) : c.yAt(d.at) - 0.02;
        const y1 = isFrost ? c.yAt(d.to) : c.yAt(d.at) + 0.02;
        const size = !isFrost && d.size ? d.size : 1;
        for (let i = 0; i < n; i++) {
          const y = y0 + (y1 - y0) * (isFrost ? i / n + R() * 0.05 : R());
          const a = Math.PI / 2 + (R() - 0.5) * 4.2;
          const s = (isFrost ? 0.004 + R() * 0.006 : 0.006 + R() * 0.008) * size;
          const g = gemGeo(s, 'shard');
          g.rotateZ(-0.5 - R() * 0.5);
          g.rotateY(a - Math.PI / 2);
          const p = surf(c, y, a, 0);
          c.add(g.translate(p[0], p[1], p[2]), m);
        }
        break;
      }
      case 'mushrooms': {
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        const cap = M({ c: '#ffffff', tex: 'spots', ta: `${d.cap ?? '#c43a5a'}|${d.spot ?? '#fff2c0'}`, r: 0.45, cc: 0.4, e: '#ffffff', ei: 0.35, useEm: true });
        const stem = M({ c: '#efe3c8', r: 0.7 });
        const n = d.count ?? 4;
        for (let i = 0; i < n; i++) {
          const y = y0 + ((y1 - y0) * (i + 0.5)) / n;
          const a = Math.PI / 2 + (i % 2 ? 1 : -1) * (0.6 + R() * 0.8);
          const s = 0.008 + R() * 0.007;
          const p0 = surf(c, y, a, 0);
          const p1: V3 = [Math.sin(a) * (c.rb(y) + s * 1.3), y + s * 1.4, Math.cos(a) * (c.rb(y) + s * 1.3)];
          c.add(tube(path([p0, [(p0[0] + p1[0]) / 2, y + s * 0.5, (p0[2] + p1[2]) / 2], p1]), s * 0.22, 5, 5), stem);
          const cg = lathe([[s * 0.2, -s * 0.05], [s * 1.0, 0], [s * 0.95, s * 0.3], [s * 0.6, s * 0.65], [0, s * 0.75]], 10);
          c.add(cg.translate(p1[0], p1[1], p1[2]), cap);
        }
        break;
      }
      case 'moss': {
        const m = M({ c: d.color ?? '#5d7a2a', tex: 'noise', ta: '3', bump: 2, r: 0.95 });
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        const prof: [number, number][] = [];
        const N = 8;
        for (let i = 0; i <= N; i++) {
          const y = y0 + ((y1 - y0) * i) / N;
          prof.push([c.rb(y) + (i === 0 || i === N ? 0.0002 : 0.0018 + R() * 0.0018), y]);
        }
        c.add(lathe(prof, 9), m);
        break;
      }
      case 'vertebrae': {
        const m = M({ c: '#ffffff', tex: 'bone', r: 0.55 });
        const n = d.count ?? 7;
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        for (let i = 0; i < n; i++) {
          const y = y0 + ((y1 - y0) * i) / Math.max(1, n - 1);
          const r = c.rb(y);
          c.add(lathe([[r, y - 0.007], [r * 2.1, y - 0.004], [r * 2.3, y], [r * 2.0, y + 0.004], [r, y + 0.007]], 8), m);
          for (const a of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
            const g = new THREE.ConeGeometry(0.0028, 0.016, 5);
            g.rotateZ(-Math.PI / 2 - 0.35).rotateY(a - Math.PI / 2);
            const p = surf(c, y, a, r * 1.2 + 0.006);
            c.add(g.translate(p[0], p[1] + 0.003, p[2]), m);
          }
        }
        break;
      }
      case 'ribs': {
        const m = M({ c: '#ffffff', tex: 'bone', r: 0.55 });
        const y = c.yAt(d.at);
        for (let i = 0; i < 3; i++) {
          const yy = y + i * 0.03;
          for (const sgn of [-1, 1]) {
            const pts: V3[] = [];
            for (let j = 0; j <= 5; j++) {
              const a = Math.PI + sgn * (j / 5) * Math.PI * 0.85;
              const rr = c.rb(yy) + 0.004 + Math.sin((j / 5) * Math.PI) * 0.012;
              pts.push([Math.sin(a) * rr, yy - (j / 5) * 0.02, Math.cos(a) * rr]);
            }
            c.add(tube(path(pts), (t) => 0.0022 * (1 - t * 0.6), 10, 4, { cap1: true }), m);
          }
        }
        break;
      }
      case 'filigree': {
        const m = mref(d.mat ?? 'gold');
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        for (const ph of [0, Math.PI]) {
          for (const dir of [1, -1]) {
            const pts: V3[] = [];
            const turns = Math.max(1, Math.round((y1 - y0) / 0.07));
            const N = turns * 8;
            for (let i = 0; i <= N; i++) {
              const t = i / N;
              const y = y0 + (y1 - y0) * t;
              const a = ph + dir * t * turns * TAU;
              const p = surf(c, y, a, 0.0006);
              pts.push(p);
            }
            c.add(tube(path(pts), 0.0007, N * 2, 3), m);
          }
        }
        c.add(band(y0 - 0.006, y0, c.rb(y0) + 0.0012, 0.0006, 12), m);
        c.add(band(y1, y1 + 0.006, c.rb(y1) + 0.0012, 0.0006, 12), m);
        break;
      }
      case 'gems': {
        const gm = gem(d.color, 0.45);
        const gold = mref('gold');
        for (const t of d.at) {
          const y = c.yAt(t);
          const s = (d.size ?? 1) * 0.0045;
          for (const a of [Math.PI / 2, -Math.PI / 2]) {
            const p = surf(c, y, a, 0.0005);
            c.add(ring(s * 1.05, 0.0009, 4, 10).rotateZ(Math.PI / 2).rotateY(a - Math.PI / 2).translate(p[0], p[1], p[2]), gold);
            c.add(gemGeo(s, 'round').rotateZ(-Math.PI / 2).rotateY(a - Math.PI / 2).translate(p[0], p[1], p[2]), gm);
          }
          c.add(band(y - 0.009, y - 0.006, c.rb(y) + 0.0012, 0.0005, 10), gold);
          c.add(band(y + 0.006, y + 0.009, c.rb(y) + 0.0012, 0.0005, 10), gold);
        }
        break;
      }
      case 'runeRings': {
        for (let i = 0; i < d.at.length; i++) {
          const y = c.yAt(d.at[i]);
          const rr = c.rb(y) + 0.02 + i * 0.002;
          const m = M({ c: d.color, tex: 'runes', ta: String(3 + i), add: true, ds: true });
          const frame = M({ c: d.color, e: d.color, ei: 0.5, m: 0.8, r: 0.3 });
          animGroup(
            c,
            y,
            (k) => {
              k.add(cyl(-0.006, 0.006, rr, rr, 28, { uRep: 2 }), m);
              k.add(ring(rr, 0.0009, 4, 28).translate(0, 0.0065, 0), frame);
              k.add(ring(rr, 0.0009, 4, 28).translate(0, -0.0065, 0), frame);
            },
            d.spin === false ? undefined : (g, t) => {
              g.rotation.y = t * (i % 2 ? -0.6 : 0.8);
            },
          );
        }
        break;
      }
      case 'tentacle': {
        const col = d.color ?? '#7a3a8a';
        const m = M({ c: col, r: 0.35, cc: 0.8, tex: 'scales', bump: 0.6, sheen: 0.5, sheenC: '#ff9ad0' });
        const sucker = M({ c: '#f0b8d0', r: 0.5 });
        const n = d.count ?? 1;
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        for (let k = 0; k < n; k++) {
          const turns = d.turns ?? 1.6;
          const pts: V3[] = [];
          const N = 18;
          const ph = Math.PI / 2 + k * Math.PI;
          for (let i = 0; i <= N; i++) {
            const t = i / N;
            const y = y0 + (y1 - y0) * t;
            const a = ph + t * turns * TAU;
            const th = 0.0055 * (1 - t * 0.8);
            const curl = t > 0.85 ? (t - 0.85) * 0.25 : 0;
            pts.push(surf(c, y, a, th * 0.8 + curl));
          }
          const rad = (t: number) => 0.0058 * (1 - t * 0.85) + 0.0004;
          c.add(tube(path(pts), rad, 44, 6, { cap0: true }), m);
          // sucker dots along the inner side
          for (let i = 2; i < N - 2; i += 2) {
            const t = i / N;
            const y = y0 + (y1 - y0) * t;
            const a = ph + t * turns * TAU + 0.5;
            const p = surf(c, y, a, rad(t) * 0.9);
            c.add(new THREE.SphereGeometry(rad(t) * 0.35, 5, 4).translate(p[0], p[1], p[2]), sucker);
          }
        }
        break;
      }
      case 'orbit': {
        const y = c.yAt(d.at);
        const n = d.count ?? 5;
        const rad = d.radius ?? 0.05;
        const m = M({ c: d.color, e: d.color, ei: 1.8, r: 0.3, m: 0.4 });
        const trail = M({ c: d.color, add: true, op: 0.35 });
        animGroup(
          c,
          y,
          (k) => {
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU;
              const yy = Math.sin(a * 2) * 0.012;
              let g: Geo;
              if ((d.shape ?? 'star') === 'star') g = extrude(starShape(5, 0.009, 0.004), 0.003, 0.0008, 1, 1);
              else if (d.shape === 'shard') g = gemGeo(0.006, 'shard');
              else g = new THREE.SphereGeometry(0.006, 10, 8);
              g.rotateY(a);
              k.add(g.translate(Math.sin(a) * rad, yy, Math.cos(a) * rad), m);
            }
            k.add(ring(rad, 0.0006, 3, 40).rotateX(0.12), trail);
          },
          (g, t) => {
            g.rotation.y = t * 0.9;
          },
        );
        break;
      }
      case 'halo': {
        const y = c.yAt(d.at);
        const rad = d.radius ?? 0.035;
        const m = M({ c: d.color, e: d.color, ei: 2.2, r: 0.3 });
        const soft = M({ c: d.color, add: true, op: 0.4 });
        animGroup(
          c,
          y,
          (k) => {
            k.add(ring(rad, 0.0016, 5, 36), m);
            k.add(ring(rad, 0.006, 4, 36), soft);
          },
          (g, t) => {
            g.rotation.z = Math.sin(t * 0.7) * 0.15;
            g.rotation.x = Math.cos(t * 0.5) * 0.15;
          },
        );
        break;
      }
      case 'ribbon': {
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        const turns = d.turns ?? 2;
        const N = 80;
        const pos: number[] = [];
        const uv: number[] = [];
        const idx: number[] = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const y = y0 + (y1 - y0) * t;
          const a = t * turns * TAU;
          const r = c.rb(y) + 0.014 + Math.sin(t * Math.PI) * 0.01;
          for (const h of [-0.009, 0.009]) {
            pos.push(Math.sin(a) * r, y + h, Math.cos(a) * r);
            uv.push(t, h > 0 ? 1 : 0);
          }
          if (i < N) {
            const b = i * 2;
            idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        const tex = ribbonTex(d.colors);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(g, mat);
        mesh.name = 'ribbon';
        c.root.add(mesh);
        c.anims.push((t) => {
          tex.offset.x = -t * 0.08;
        });
        break;
      }
      case 'sunDisc': {
        const y = c.yAt(d.at);
        const m = mref(d.mat ?? 'gold');
        const sh = starShape(14, 0.034, 0.024);
        const hole = new THREE.Path();
        hole.absarc(0, 0, c.rb(y) + 0.0015, 0, TAU, true);
        sh.holes.push(hole);
        const g = extrude(sh, 0.003, 0.001, 2, 1);
        g.rotateX(Math.PI / 2);
        c.add(g.translate(0, y, 0), m);
        c.add(ring(0.018, 0.0022, 5, 24).translate(0, y, 0), gem('#ff9a2a', 0.8));
        break;
      }
      case 'vine': {
        const vm = M({ c: d.color ?? '#4a5a24', r: 0.7, tex: 'wood', ta: 'elder' });
        const lm = M({ c: d.leaf ?? '#5f9a34', r: 0.5, cc: 0.4, ds: true });
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        const turns = d.turns ?? 3;
        const pts: V3[] = [];
        const N = turns * 8;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const y = y0 + (y1 - y0) * t;
          pts.push(surf(c, y, Math.PI / 2 + t * turns * TAU, 0.0014));
        }
        c.add(tube(path(pts), (t) => 0.0018 * (1 - t * 0.5), N * 3, 4), vm);
        for (let i = 1; i < N; i += 2) {
          const t = i / N;
          const y = y0 + (y1 - y0) * t;
          const a = Math.PI / 2 + t * turns * TAU;
          const leaf = new THREE.Shape();
          leaf.moveTo(0, 0);
          leaf.quadraticCurveTo(0.007, 0.008, 0, 0.018);
          leaf.quadraticCurveTo(-0.007, 0.008, 0, 0);
          const g = new THREE.ShapeGeometry(leaf, 3);
          g.rotateX(-0.6).rotateZ((i % 4 ? 1 : -1) * 0.7).rotateY(a);
          const p = surf(c, y, a, 0.002);
          c.add(g.translate(p[0], p[1], p[2]), lm);
        }
        break;
      }
      case 'chain':
      case 'rope': {
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        if (d.kind === 'rope') {
          c.add(band(y0, y1, Math.max(c.rb(y0), c.rb(y1)) + 0.0018, 0.001, 12, { tile: 0.02 }), M({ c: d.color ?? '#b89a6a', tex: 'cord', r: 0.85 }));
        } else {
          const m = mref(d.mat ?? 'gold');
          const n = Math.max(4, Math.round((y1 - y0) / 0.012));
          for (let i = 0; i < n; i++) {
            const t = i / n;
            const y = y0 + (y1 - y0) * t;
            const a = Math.PI / 2 + t * TAU * 1.5;
            const p = surf(c, y, a, 0.003);
            const g = ring(0.0045, 0.0011, 4, 8).rotateZ(Math.PI / 2 + (i % 2) * 0.0).rotateX(i % 2 ? Math.PI / 2 : 0).rotateY(a);
            c.add(g.translate(p[0], p[1], p[2]), m);
          }
        }
        break;
      }
      case 'scarab': {
        const y = c.yAt(d.at);
        const p = surf(c, y, Math.PI / 2, 0.003);
        const gold = mref('gold');
        const shell = gem(d.color ?? '#1fa38a', 0.3);
        const body = new THREE.SphereGeometry(0.008, 10, 8).scale(0.45, 1, 0.8);
        c.add(body.translate(p[0], p[1], p[2]), shell);
        c.add(new THREE.SphereGeometry(0.004, 8, 6).scale(0.5, 0.8, 0.9).translate(p[0], p[1] + 0.009, p[2]), gold);
        for (const s of [-1, 1]) {
          const leg = tube(path([[p[0], p[1], p[2] + s * 0.005], [p[0] - 0.001, p[1] + 0.002, p[2] + s * 0.011], [p[0] - 0.003, p[1] - 0.004, p[2] + s * 0.014]]), 0.0008, 4, 3);
          c.add(leg, gold);
        }
        c.add(band(y - 0.014, y - 0.011, c.rb(y) + 0.001, 0.0005, 10), gold);
        c.add(band(y + 0.013, y + 0.016, c.rb(y) + 0.001, 0.0005, 10), gold);
        break;
      }
      case 'plates': {
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        const m = mref(d.mat ?? { c: '#8a5a24', r: 0.3, cc: 1, tex: 'stone', ta: '4' });
        const n = Math.max(2, Math.round((y1 - y0) / 0.028));
        for (let i = 0; i < n; i++) {
          const y = y0 + ((y1 - y0) * i) / n;
          const r = c.rb(y) + 0.003;
          c.add(lathe([[r * 0.9, y], [r * 1.25, y + 0.004], [r * 1.25, y + 0.02], [r * 0.9, y + 0.026]], 6, { phi0: (i % 2) * 0.5 }).toNonIndexed(), m);
        }
        break;
      }
      case 'cracks': {
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        const em = M({ c: '#ff7a1a', e: '#ff5a0a', ei: 2.4, r: 0.5 });
        const basalt = M({ c: '#2a2422', tex: 'stone', ta: '7', r: 0.9 });
        const n = Math.max(2, Math.round((y1 - y0) / 0.09));
        for (let i = 0; i < n; i++) {
          const y = y0 + ((y1 - y0) * i) / n;
          const r = c.rb(y);
          c.add(lathe([[r, y - 0.01], [r * 1.5, y - 0.006], [r * 1.55, y + 0.006], [r, y + 0.01]], 7).toNonIndexed(), basalt);
          c.add(band(y - 0.0015, y + 0.0015, r * 1.58, 0.0005, 10), em);
        }
        break;
      }
      case 'bolts': {
        const y0 = c.yAt(d.from);
        const y1 = c.yAt(d.to);
        const m = M({ c: d.color ?? '#9fe6ff', e: d.color ?? '#9fe6ff', ei: 2.5, r: 0.3 });
        for (const a0 of [Math.PI / 2, -Math.PI / 2]) {
          const pts: V3[] = [];
          const N = 10;
          for (let i = 0; i <= N; i++) {
            const t = i / N;
            pts.push(surf(c, y0 + (y1 - y0) * t, a0 + (i % 2 ? 0.5 : -0.5), 0.0008));
          }
          c.add(tube(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'chordal', 0), 0.0008, N * 4, 3), m);
        }
        break;
      }
      case 'feather':
      case 'charm':
      case 'tassel': {
        const y = c.layout === 'fly' ? c.seatB + 0.01 : c.seatB + 0.02;
        const a = Math.PI / 2 + 0.2;
        const top = surf(c, y, a, 0.0);
        top[0] = Math.sin(a) * (c.rs + 0.004);
        top[2] = Math.cos(a) * (c.rs + 0.004);
        const cord = M({ c: '#3a2a1a', r: 0.8 });
        const bottom: V3 = [top[0] + 0.006, y - 0.05, top[2] + 0.002];
        c.add(tube(path([top, [top[0] + 0.005, y - 0.02, top[2]], bottom]), 0.0007, 8, 3), cord);
        c.add(band(y - 0.003, y + 0.003, c.rs + 0.0015, 0.0006, 10), cord);
        const bead = gem(d.kind === 'tassel' ? d.color : '#c0392b', 0.2);
        c.add(new THREE.SphereGeometry(0.0035, 8, 6).translate(bottom[0], bottom[1] + 0.012, bottom[2]), bead);
        if (d.kind === 'tassel') {
          const tm = M({ c: d.color, tex: 'thread', r: 0.6, sheen: 0.8, sheenC: '#ffffff' });
          c.add(lathe([[0.001, 0], [0.004, -0.004], [0.006, -0.03], [0.0045, -0.034]], 10, { tile: 0.004 }).translate(bottom[0], bottom[1], bottom[2]), tm);
        } else if (d.kind === 'feather') {
          const fm = M({ c: d.color ?? '#f2efe6', r: 0.7, ds: true, sheen: 0.5 });
          const sh = new THREE.Shape();
          sh.moveTo(0, 0);
          sh.quadraticCurveTo(0.012, -0.02, 0.002, -0.055);
          sh.quadraticCurveTo(-0.01, -0.025, 0, 0);
          const g = new THREE.ShapeGeometry(sh, 5);
          g.rotateY(a + Math.PI / 2);
          c.add(g.translate(bottom[0], bottom[1], bottom[2]), fm);
          c.add(tube(path([bottom, [bottom[0] + 0.001, bottom[1] - 0.03, bottom[2]], [bottom[0] + 0.002, bottom[1] - 0.056, bottom[2]]]), 0.0006, 6, 3), M({ c: d.color2 ?? '#6a4a2a', r: 0.6 }));
        } else {
          const cm = mref(d.mat ?? 'gold');
          const p: V3 = [bottom[0], bottom[1] - 0.01, bottom[2]];
          switch (d.shape) {
            case 'coin':
              c.add(new THREE.CylinderGeometry(0.009, 0.009, 0.0015, 16).rotateX(Math.PI / 2).rotateY(a).translate(p[0], p[1], p[2]), cm);
              break;
            case 'skull':
              addSkull(c, p[0], p[1] - 0.012, p[2], 0.016, M({ c: '#efe6cf', tex: 'bone', r: 0.5 }));
              break;
            case 'star':
            case 'moon':
            case 'anchor':
            case 'shell':
            case 'bell':
            case 'tooth': {
              let g: Geo;
              if (d.shape === 'star') g = extrude(starShape(5, 0.01, 0.0045), 0.002, 0.0006, 1, 1);
              else if (d.shape === 'tooth') g = new THREE.ConeGeometry(0.004, 0.018, 6).rotateX(Math.PI);
              else if (d.shape === 'bell') g = lathe([[0.001, 0.004], [0.004, 0.002], [0.005, -0.006], [0.007, -0.01], [0, -0.01]], 10);
              else {
                const s = new THREE.Shape();
                s.absarc(0, 0, 0.009, Math.PI * 0.3, Math.PI * 1.7, false);
                s.absarc(0.004, 0, 0.007, Math.PI * 1.6, Math.PI * 0.4, true);
                g = extrude(s, 0.002, 0.0006, 8, 1);
              }
              g.rotateY(a);
              c.add(g.translate(p[0], p[1] - 0.004, p[2]), cm);
              break;
            }
          }
        }
        break;
      }
      case 'lure': {
        const L = c.L;
        const y = L - 0.06;
        const p0 = surf(c, y, -Math.PI / 2, 0.001);
        const stalk = M({ c: '#2a2238', r: 0.5 });
        const bulbM = M({ c: d.color, e: d.color, ei: 2.6, r: 0.2 });
        const pts: V3[] = [p0, [p0[0] - 0.02, y + 0.02, 0], [p0[0] - 0.045, y + 0.0, 0], [p0[0] - 0.05, y - 0.05, 0]];
        c.add(tube(path(pts), (t) => 0.0016 * (1 - t * 0.4), 14, 4), stalk);
        const e = pts[3];
        c.add(new THREE.SphereGeometry(0.009, 12, 10).translate(e[0], e[1] - 0.008, e[2]), bulbM);
        c.add(new THREE.SphereGeometry(0.016, 12, 10).translate(e[0], e[1] - 0.008, e[2]), M({ c: d.color, add: true, op: 0.25 }));
        break;
      }
      case 'flames': {
        const y = c.yAt(d.at);
        const col = d.color ?? '#ff7a1a';
        const m = M({ c: col, add: true, op: 0.8 });
        animGroup(
          c,
          y,
          (k) => {
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * TAU;
              const g = new THREE.ConeGeometry(0.004, 0.022, 6);
              g.translate(Math.sin(a) * (c.rb(y) + 0.003), 0.011, Math.cos(a) * (c.rb(y) + 0.003));
              k.add(g, m);
            }
          },
          (g, t) => {
            g.scale.y = 0.85 + Math.sin(t * 9) * 0.15;
          },
        );
        break;
      }
      case 'wings': {
        const y = c.yAt(d.at);
        const wm = M({ c: d.color ?? '#f4f1ea', r: 0.55, sheen: 0.6, ds: true });
        for (const s of [-1, 1]) {
          const sh = new THREE.Shape();
          sh.moveTo(0, 0);
          sh.quadraticCurveTo(0.03, 0.04, 0.06, 0.035);
          sh.lineTo(0.05, 0.022);
          sh.lineTo(0.056, 0.016);
          sh.lineTo(0.044, 0.008);
          sh.lineTo(0.048, 0.0);
          sh.quadraticCurveTo(0.02, -0.005, 0, 0);
          const g = extrude(sh, 0.002, 0.0008, 6, 1);
          g.scale(s, 1, 1);
          c.add(g.translate(0, y, -c.rb(y) - 0.001), wm);
        }
        break;
      }
    }
  }
}

const ribbonCache = new Map<string, THREE.CanvasTexture>();
function ribbonTex(colors: string[]): THREE.CanvasTexture {
  const key = colors.join();
  let t = ribbonCache.get(key);
  if (t) return t;
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 32;
  const x = cv.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 256, 0);
  colors.forEach((col, i) => g.addColorStop(i / Math.max(1, colors.length - 1), col));
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 32);
  const fade = x.createLinearGradient(0, 0, 0, 32);
  fade.addColorStop(0, 'rgba(0,0,0,1)');
  fade.addColorStop(0.5, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = fade;
  x.fillRect(0, 0, 256, 32);
  t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  ribbonCache.set(key, t);
  return t;
}
