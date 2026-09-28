/**
 * Walkable surfaces (piers, boardwalks, ice, stairs) and colliders (buildings, trunks, rocks).
 * Stored in a coarse spatial hash; everything in world coordinates.
 */

export interface Walkable {
  cx: number;
  cz: number;
  /** half width (local x) / half length (local z) */
  hw: number;
  hl: number;
  /** rotation about Y (radians); local +z = direction (sin a, cos a) */
  ang: number;
  /** surface height at local z = -hl and z = +hl (ramps/stairs) */
  y0: number;
  y1: number;
  /** optional circular shape instead of rectangle */
  circle?: boolean;
  /** holes (circles, world coords) — e.g. ice fishing holes */
  holes?: { x: number; z: number; r: number }[];
}

export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number; y0: number; y1: number }
  | { kind: 'box'; cx: number; cz: number; hw: number; hd: number; ang: number; y0: number; y1: number };

const CELL = 32;
const key = (ix: number, iz: number) => ix * 73856093 + iz * 19349663;

export class SpatialHash<T> {
  private map = new Map<number, T[]>();
  add(item: T, minX: number, minZ: number, maxX: number, maxZ: number): void {
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = key(ix, iz);
        let arr = this.map.get(k);
        if (!arr) this.map.set(k, (arr = []));
        arr.push(item);
      }
    }
  }
  query(x: number, z: number): T[] | undefined {
    return this.map.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  }
}

export class Physics {
  walkables = new SpatialHash<Walkable>();
  colliders = new SpatialHash<Collider>();
  walkableList: Walkable[] = [];
  colliderList: Collider[] = [];

  addWalkable(w: Walkable): void {
    const r = w.circle ? w.hw : Math.hypot(w.hw, w.hl);
    this.walkables.add(w, w.cx - r, w.cz - r, w.cx + r, w.cz + r);
    this.walkableList.push(w);
  }

  addCollider(c: Collider): void {
    if (c.kind === 'circle') this.colliders.add(c, c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r);
    else {
      const r = Math.hypot(c.hw, c.hd);
      this.colliders.add(c, c.cx - r, c.cz - r, c.cx + r, c.cz + r);
    }
    this.colliderList.push(c);
  }

  /** Highest walkable surface at x,z or -Infinity. */
  walkHeight(x: number, z: number): number {
    const list = this.walkables.query(x, z);
    if (!list) return -Infinity;
    let best = -Infinity;
    for (const w of list) {
      const dx = x - w.cx;
      const dz = z - w.cz;
      let y: number;
      if (w.circle) {
        if (dx * dx + dz * dz > w.hw * w.hw) continue;
        y = w.y0;
      } else {
        const s = Math.sin(w.ang);
        const c = Math.cos(w.ang);
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        if (lx < -w.hw || lx > w.hw || lz < -w.hl || lz > w.hl) continue;
        y = w.y0 + ((lz + w.hl) / (2 * w.hl)) * (w.y1 - w.y0);
      }
      if (w.holes) {
        let inHole = false;
        for (const h of w.holes) {
          if ((x - h.x) ** 2 + (z - h.z) ** 2 < h.r * h.r) {
            inHole = true;
            break;
          }
        }
        if (inHole) continue;
      }
      if (y > best) best = y;
    }
    return best;
  }

  /** Push a circle (feet position) out of colliders. */
  collide(pos: { x: number; y: number; z: number }, radius: number): void {
    const list = this.colliders.query(pos.x, pos.z);
    if (!list) return;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of list) {
        if (pos.y > c.y1 - 0.25 || pos.y + 1.7 < c.y0) continue;
        if (c.kind === 'circle') {
          const dx = pos.x - c.x;
          const dz = pos.z - c.z;
          const d = Math.hypot(dx, dz);
          const min = c.r + radius;
          if (d < min) {
            if (d < 1e-4) {
              pos.x += min;
            } else {
              pos.x = c.x + (dx / d) * min;
              pos.z = c.z + (dz / d) * min;
            }
          }
        } else {
          const s = Math.sin(c.ang);
          const co = Math.cos(c.ang);
          const dx = pos.x - c.cx;
          const dz = pos.z - c.cz;
          // world → local (local x axis = (cos, -sin)) consistent with walkables
          const lx = dx * co - dz * s;
          const lz = dx * s + dz * co;
          const hx = c.hw + radius;
          const hz = c.hd + radius;
          if (lx > -hx && lx < hx && lz > -hz && lz < hz) {
            // push out along the shallowest axis
            const px = hx - Math.abs(lx);
            const pz = hz - Math.abs(lz);
            let nlx = lx;
            let nlz = lz;
            if (px < pz) nlx = Math.sign(lx || 1) * hx;
            else nlz = Math.sign(lz || 1) * hz;
            // local → world (inverse rotation)
            pos.x = c.cx + nlx * co + nlz * s;
            pos.z = c.cz - nlx * s + nlz * co;
          }
        }
      }
    }
  }
}
