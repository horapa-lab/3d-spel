/** Procedural piers / docks / boardwalks, bridges and stairs (merged per material). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BridgeSpec, PierSpec, StairSpec, Structure } from './plan';
import { propMaterials } from '../../models/props/materials';

type Acc = Map<THREE.Material, THREE.BufferGeometry[]>;

function push(acc: Acc, mat: THREE.Material, g: THREE.BufferGeometry): void {
  let a = acc.get(mat);
  if (!a) acc.set(mat, (a = []));
  a.push(g.index ? g.toNonIndexed() : g);
}

/** Oriented box from a to b (centre line) with given width/height. UVs in metres along length. */
function beam(ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, h: number): THREE.BufferGeometry {
  const len = Math.hypot(bx - ax, by - ay, bz - az);
  const g = new THREE.BoxGeometry(w, h, len);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    if (nx > 0.5) uv.setXY(i, z * 0.5, y * 0.5);
    else if (ny > 0.5) uv.setXY(i, z * 0.5, x * 0.5);
    else uv.setXY(i, x * 0.5, y * 0.5);
  }
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz), new THREE.Vector3(0, 1, 0));
  if (Math.abs(by - ay) > len * 0.99) m.lookAt(new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz), new THREE.Vector3(1, 0, 0));
  g.applyMatrix4(m);
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  return g;
}

function post(x: number, z: number, y0: number, y1: number, r: number): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r * 0.92, r, y1 - y0, 7, 1);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 6, uv.getY(i) * (y1 - y0) * 0.5);
  g.translate(x, (y0 + y1) / 2, z);
  return g;
}

function buildPier(acc: Acc, sp: PierSpec, ground: (x: number, z: number) => number, lamps: THREE.Vector3[]): void {
  const M = propMaterials();
  const W = sp.width;
  const top = sp.deckY;
  const plankT = 0.07;
  const low = sp.style === 'boardwalk' || sp.style === 'jetty';
  const deckMat = sp.style === 'pier' ? M.woodWeathered : M.wood;
  const segs: { ax: number; az: number; bx: number; bz: number; w: number }[] = [];
  for (let k = 0; k < sp.pts.length - 1; k++) segs.push({ ax: sp.pts[k][0], az: sp.pts[k][1], bx: sp.pts[k + 1][0], bz: sp.pts[k + 1][1], w: W });
  if (sp.endPlatform > 0) {
    const a = sp.pts[sp.pts.length - 2];
    const b = sp.pts[sp.pts.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / L;
    const dz = (b[1] - a[1]) / L;
    const E = sp.endPlatform;
    segs.push({ ax: b[0] - dx * W * 0.3, az: b[1] - dz * W * 0.3, bx: b[0] + dx * (E - W * 0.3), bz: b[1] + dz * (E - W * 0.3), w: E });
  }
  let lampAcc = 0;
  segs.forEach((sg, si) => {
    const L = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az);
    const dx = (sg.bx - sg.ax) / L;
    const dz = (sg.bz - sg.az) / L;
    const px = -dz;
    const pz = dx;
    // planks across the deck with small gaps and jitter
    const pw = 0.24;
    const n = Math.floor(L / (pw + 0.025));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * (L / n);
      const jit = Math.sin(i * 12.9898 + si * 7.1) * 0.5;
      const cx = sg.ax + dx * t;
      const cz = sg.az + dz * t;
      const hw = sg.w / 2 + 0.06 * jit;
      const y = top - plankT / 2 + Math.abs(jit) * 0.012;
      push(acc, deckMat, beam(cx - px * hw, y, cz - pz * hw, cx + px * hw, y, cz + pz * hw, pw, plankT));
    }
    // stringers
    for (const side of [-1, 1]) {
      const o = side * (sg.w / 2 - 0.25);
      push(acc, M.woodDark, beam(sg.ax + px * o, top - plankT - 0.14, sg.az + pz * o, sg.bx + px * o, top - plankT - 0.14, sg.bz + pz * o, 0.16, 0.26));
    }
    // posts + cross beams every ~3.2 m
    const spacing = low ? 3.6 : 3.2;
    const np = Math.max(1, Math.round(L / spacing));
    for (let i = 0; i <= np; i++) {
      const t = (i / np) * L;
      const cx = sg.ax + dx * t;
      const cz = sg.az + dz * t;
      for (const side of [-1, 1]) {
        const o = side * (sg.w / 2 - 0.12);
        const x = cx + px * o;
        const z = cz + pz * o;
        const g = Math.min(ground(x, z), top - 0.4);
        const extra = sp.rail && sg.w === W && t > (sp.railStart ?? 0) && si < sp.pts.length - 1 ? 0.95 : sg.w !== W && sp.rail ? 0.95 : 0.25;
        push(acc, M.woodDark, post(x, z, g - 0.8, top + extra, low ? 0.11 : 0.15));
        // barnacle / algae band near the waterline for tall posts
        if (!low && g < -0.3) push(acc, M.algae, post(x, z, Math.max(g, -1.2), 0.25, (low ? 0.11 : 0.15) + 0.012));
      }
      const g0 = Math.min(ground(cx - px * sg.w * 0.5, cz - pz * sg.w * 0.5), ground(cx + px * sg.w * 0.5, cz + pz * sg.w * 0.5));
      const hw = sg.w / 2 - 0.12;
      push(acc, M.woodDark, beam(cx - px * hw, top - plankT - 0.34, cz - pz * hw, cx + px * hw, top - plankT - 0.34, cz + pz * hw, 0.14, 0.2));
      if (!low && top - g0 > 2.4 && i % 2 === 0) {
        const yb = Math.max(g0 + 0.3, -0.9);
        push(acc, M.woodDark, beam(cx - px * hw, top - 0.5, cz - pz * hw, cx + px * hw, yb, cz + pz * hw, 0.1, 0.14));
      }
      // rope rail between rail posts
      if (sp.rail && i < np && sg.w === W && t + L / np > (sp.railStart ?? 0) && si < sp.pts.length - 1) {
        const t2 = ((i + 1) / np) * L;
        for (const side of [-1, 1]) {
          const o = side * (sg.w / 2 - 0.12);
          const x0 = cx + px * o;
          const z0 = cz + pz * o;
          const x1 = sg.ax + dx * t2 + px * o;
          const z1 = sg.az + dz * t2 + pz * o;
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, top + 0.85, z0), new THREE.Vector3((x0 + x1) / 2, top + 0.62, (z0 + z1) / 2), new THREE.Vector3(x1, top + 0.85, z1));
          push(acc, M.rope, new THREE.TubeGeometry(curve, 6, 0.028, 4, false));
        }
      }
      if (sp.lamps > 0 && si < sp.pts.length - 1) {
        lampAcc += L / np;
        if (lampAcc >= sp.lamps && i > 0 && i < np) {
          lampAcc = 0;
          lamps.push(new THREE.Vector3(cx + px * (sg.w / 2 - 0.12), top + 0.95, cz + pz * (sg.w / 2 - 0.12)));
        }
      }
    }
  });
}

function buildBridge(acc: Acc, b: BridgeSpec): void {
  const M = propMaterials();
  const L = Math.hypot(b.bx - b.ax, b.bz - b.az);
  const dx = (b.bx - b.ax) / L;
  const dz = (b.bz - b.az) / L;
  const px = -dz;
  const pz = dx;
  const n = Math.floor(L / 0.28);
  const yAt = (t: number) => b.y0 + (b.y1 - b.y0) * t + b.arch * Math.sin(Math.PI * t);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const cx = b.ax + dx * t * L;
    const cz = b.az + dz * t * L;
    const y = yAt(t) - 0.04;
    push(acc, M.wood, beam(cx - px * b.width / 2, y, cz - pz * b.width / 2, cx + px * b.width / 2, y, cz + pz * b.width / 2, 0.25, 0.07));
  }
  for (const side of [-1, 1]) {
    const o = side * (b.width / 2 - 0.1);
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = b.ax + dx * t * L + px * o;
      const z = b.az + dz * t * L + pz * o;
      const y = yAt(t);
      const pnt = new THREE.Vector3(x, y - 0.18, z);
      if (prev) push(acc, M.woodDark, beam(prev.x, prev.y, prev.z, pnt.x, pnt.y, pnt.z, 0.14, 0.24));
      push(acc, M.woodDark, post(x, z, y - 0.3, y + 0.9, 0.07));
      if (prev) push(acc, M.woodDark, beam(prev.x, prev.y + 1.0, prev.z, pnt.x, pnt.y + 1.0, pnt.z, 0.08, 0.08));
      prev = pnt;
    }
  }
}

function buildStairs(acc: Acc, s: StairSpec): void {
  const M = propMaterials();
  const L = Math.hypot(s.bx - s.ax, s.bz - s.az);
  const dx = (s.bx - s.ax) / L;
  const dz = (s.bz - s.az) / L;
  const px = -dz;
  const pz = dx;
  const steps = Math.max(2, Math.round(Math.abs(s.y1 - s.y0) / 0.22));
  const mat = s.style === 'stone' ? M.stone : M.wood;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const y = s.y0 + (s.y1 - s.y0) * t1;
    const cx0 = s.ax + dx * t0 * L;
    const cz0 = s.az + dz * t0 * L;
    const cx1 = s.ax + dx * t1 * L;
    const cz1 = s.az + dz * t1 * L;
    const g = beam(cx0, y - 0.3, cz0, cx1, y - 0.3, cz1, s.width, 0.6);
    push(acc, mat, g);
    void px;
    void pz;
  }
}

/** Build all structures; returns merged meshes + lamp positions. */
export function buildStructures(list: Structure[], ground: (x: number, z: number) => number): { meshes: THREE.Mesh[]; lamps: THREE.Vector3[] } {
  const acc: Acc = new Map();
  const lamps: THREE.Vector3[] = [];
  for (const st of list) {
    if (st.type === 'pier') buildPier(acc, st, ground, lamps);
    else if (st.type === 'bridge') buildBridge(acc, st);
    else buildStairs(acc, st);
  }
  const meshes: THREE.Mesh[] = [];
  for (const [mat, geos] of acc) {
    const g = mergeGeometries(geos.map((x) => {
      for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
      return x;
    }), false);
    if (!g) continue;
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    meshes.push(m);
  }
  return { meshes, lamps };
}
