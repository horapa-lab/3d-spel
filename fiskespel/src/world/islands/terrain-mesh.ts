/** Builds renderable terrain geometry (local to island centre) from a baked HeightGrid. */
import * as THREE from 'three';
import type { HeightGrid, IslandTerrain, SplatOut } from './terrain';

export interface TerrainMeshOpts {
  /** include quads whose highest corner is above this */
  minH: number;
  /** ...and below this */
  maxH?: number;
  /** vertex stride (LOD) */
  step?: number;
  /** vertical offset applied to all vertices */
  yOffset?: number;
}

export function buildTerrainGeometry(t: IslandTerrain, g: HeightGrid, o: TerrainMeshOpts): THREE.BufferGeometry | null {
  const step = o.step ?? 1;
  const n = g.n;
  const H = g.h;
  const maxH = o.maxH ?? Infinity;
  const L = t.layout;
  const cells = Math.floor((n - 1) / step);
  const vn = cells + 1;
  const remap = new Int32Array(vn * vn).fill(-1);
  const idx: number[] = [];
  const vid = (ci: number, cj: number) => cj * step * n + ci * step;
  let count = 0;
  const use = (ci: number, cj: number) => {
    const k = cj * vn + ci;
    if (remap[k] < 0) remap[k] = count++;
    return remap[k];
  };
  for (let cj = 0; cj < cells; cj++) {
    for (let ci = 0; ci < cells; ci++) {
      const ha = H[vid(ci, cj)];
      const hb = H[vid(ci, cj + 1)];
      const hc = H[vid(ci + 1, cj)];
      const hd = H[vid(ci + 1, cj + 1)];
      const mx = Math.max(ha, hb, hc, hd);
      if (mx <= o.minH || mx >= maxH) continue;
      const a = use(ci, cj);
      const b = use(ci, cj + 1);
      const c = use(ci + 1, cj);
      const d = use(ci + 1, cj + 1);
      // same diagonal as HeightGrid.sample: b–c
      idx.push(a, b, c, c, b, d);
    }
  }
  if (count === 0) return null;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const splat = new Uint8Array(count * 4);
  const aux = new Uint8Array(count * 2);
  const nv: [number, number, number] = [0, 1, 0];
  const so: SplatOut = { cover: 0, dirt: 0, rock: 0, spec: 0 };
  const yOff = o.yOffset ?? 0;
  const cs = g.cell * step;
  for (let cj = 0; cj < vn; cj++) {
    for (let ci = 0; ci < vn; ci++) {
      const r = remap[cj * vn + ci];
      if (r < 0) continue;
      const i = ci * step;
      const j = cj * step;
      const k = j * n + i;
      const x = g.x0 + i * g.cell;
      const z = g.z0 + j * g.cell;
      const h = H[k];
      pos[r * 3] = x - L.x;
      pos[r * 3 + 1] = h + yOff;
      pos[r * 3 + 2] = z - L.z;
      // normal with stride-aware differences
      const i0 = Math.max(0, i - step);
      const i1 = Math.min(n - 1, i + step);
      const j0 = Math.max(0, j - step);
      const j1 = Math.min(n - 1, j + step);
      const dx = (H[j * n + i1] - H[j * n + i0]) / ((i1 - i0) * g.cell);
      const dz = (H[j1 * n + i] - H[j0 * n + i]) / ((j1 - j0) * g.cell);
      const l = Math.sqrt(dx * dx + 1 + dz * dz);
      nv[0] = -dx / l;
      nv[1] = 1 / l;
      nv[2] = -dz / l;
      nrm[r * 3] = nv[0];
      nrm[r * 3 + 1] = nv[1];
      nrm[r * 3 + 2] = nv[2];
      // splat
      so.cover = so.dirt = so.rock = so.spec = 0;
      t.def.splat({ lx: x - L.x, lz: z - L.z, h, slope: 1 - nv[1], dirt: g.dirt[k] / 255, plaza: g.plaza[k] / 255 }, so);
      splat[r * 4] = Math.round(Math.min(1, Math.max(0, so.cover)) * 255);
      splat[r * 4 + 1] = Math.round(Math.min(1, Math.max(0, so.dirt)) * 255);
      splat[r * 4 + 2] = Math.round(Math.min(1, Math.max(0, so.rock)) * 255);
      splat[r * 4 + 3] = Math.round(Math.min(1, Math.max(0, so.spec)) * 255);
      // cheap AO from local concavity
      const r1 = 4;
      const r2 = 13;
      const s1 = (g.sample(x + r1, z) + g.sample(x - r1, z) + g.sample(x, z + r1) + g.sample(x, z - r1)) * 0.25;
      const s2 = (g.sample(x + r2, z + r2 * 0.3) + g.sample(x - r2, z - r2 * 0.3) + g.sample(x - r2 * 0.3, z + r2) + g.sample(x + r2 * 0.3, z - r2)) * 0.25;
      const conc = Math.max(0, s1 - h) * 0.35 + Math.max(0, s2 - h) * 0.09;
      const ao = Math.max(0.35, Math.min(1, 1 - conc * 0.55));
      aux[r * 2] = Math.round(ao * 255);
      aux[r * 2 + 1] = 0;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4, true));
  geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 2, true));
  geo.setIndex(count > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}
