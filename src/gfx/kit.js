// ModelKit: build low-poly models out of primitives and merge them into a few
// vertex-colored meshes (1-3 draw calls per model instead of dozens).
//
//   const k = new Kit();
//   k.box(w, h, d, color, x, y, z, { rx, ry, rz, m: 'metal' | 'glow' });
//   k.cyl(r, len, color, x, y, z, { r2, axis: 'z'|'x'|'y', seg });   // along +Z by default
//   const spin = k.sub('spin', px, py, pz);  // separately animated child
//   k.anchor('muzzle', x, y, z);
//   const group = k.build();

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

const AXIS_Z = new THREE.Matrix4().makeRotationX(Math.PI / 2); // +Y -> +Z
const AXIS_X = new THREE.Matrix4().makeRotationZ(-Math.PI / 2); // +Y -> +X
const TOR_Y = new THREE.Matrix4().makeRotationX(Math.PI / 2); // ring around Y
const TOR_X = new THREE.Matrix4().makeRotationY(Math.PI / 2); // ring around X

let MATS = null;
/** Shared materials for every kit model (so the game can tweak env maps once). */
export function kitMaterials() {
  if (!MATS) {
    MATS = {
      solid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.08 }),
      metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }),
      glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      matte: new THREE.MeshLambertMaterial({ vertexColors: true }),
    };
  }
  return MATS;
}

export class Kit {
  constructor(opts = {}) {
    this.lists = { solid: [], metal: [], glow: [], matte: [] };
    this.subs = [];
    this.anchors = {};
    this.colorFn = opts.colorFn || null;
    this.defaultMat = opts.mat || 'solid';
    this.forceMat = opts.forceMat || null;
  }

  _add(geo, color, o, axisMat) {
    let g = geo;
    if (g.index) {
      g = geo.toNonIndexed();
      geo.dispose();
    }
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (axisMat) g.applyMatrix4(axisMat);
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
    _q.setFromEuler(_e);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);

    let list = o.m || this.defaultMat;
    if (this.forceMat && list !== 'glow') list = this.forceMat;
    _c.set(color);
    if (this.colorFn) this.colorFn(_c, o.m || this.defaultMat);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = _c.r;
      arr[i * 3 + 1] = _c.g;
      arr[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.lists[list].push(g);
    return this;
  }

  box(w, h, d, c, x = 0, y = 0, z = 0, o = {}) {
    return this._add(new THREE.BoxGeometry(w, h, d), c, { ...o, x, y, z });
  }

  /** Rounded box (soft toy look). */
  rbox(w, h, d, r, c, x = 0, y = 0, z = 0, o = {}) {
    const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
    return this._add(new RoundedBoxGeometry(w, h, d, o.seg || 2, rr), c, { ...o, x, y, z });
  }

  /** Cylinder along +Z (default). r = radius at the back (-Z), o.r2 = radius at the front. */
  cyl(r, len, c, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.CylinderGeometry(o.r2 ?? r, r, len, o.seg || 14, 1, !!o.open);
    const axis = o.axis || 'z';
    return this._add(g, c, { ...o, x, y, z }, axis === 'z' ? AXIS_Z : axis === 'x' ? AXIS_X : null);
  }

  /** Cone with its tip pointing +Z (default). */
  cone(r, len, c, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.ConeGeometry(r, len, o.seg || 14);
    const axis = o.axis || 'z';
    return this._add(g, c, { ...o, x, y, z }, axis === 'z' ? AXIS_Z : axis === 'x' ? AXIS_X : null);
  }

  sph(r, c, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.SphereGeometry(r, o.seg || 14, o.segH || 10);
    return this._add(g, c, { ...o, x, y, z });
  }

  /** Torus: by default the ring encircles the Z axis (rings around a barrel). */
  tor(r, t, c, x = 0, y = 0, z = 0, o = {}) {
    const g = new THREE.TorusGeometry(r, t, o.rs || 8, o.seg || 20, o.arc || Math.PI * 2);
    const axis = o.axis || 'z';
    return this._add(g, c, { ...o, x, y, z }, axis === 'y' ? TOR_Y : axis === 'x' ? TOR_X : null);
  }

  /** Any custom geometry (e.g. extrusions). */
  geo(geometry, c, x = 0, y = 0, z = 0, o = {}) {
    return this._add(geometry, c, { ...o, x, y, z });
  }

  /** A separately transformable child (rotating barrels, crate lid...). */
  sub(name, x = 0, y = 0, z = 0) {
    const kit = new Kit({ colorFn: this.colorFn, mat: this.defaultMat, forceMat: this.forceMat });
    this.subs.push({ name, kit, pivot: new THREE.Vector3(x, y, z) });
    return kit;
  }

  anchor(name, x, y, z) {
    this.anchors[name] = new THREE.Vector3(x, y, z);
    return this;
  }

  /** Merge everything of one material list into a single geometry. */
  mergedGeometry(list = this.defaultMat) {
    const arr = this.lists[list];
    if (!arr.length) return null;
    const g = mergeGeometries(arr, false);
    g.computeBoundingSphere();
    return g;
  }

  /** Merge all lists into one geometry (vertex colors keep the look). */
  allGeometry() {
    const arr = [...this.lists.solid, ...this.lists.metal, ...this.lists.glow, ...this.lists.matte];
    const g = mergeGeometries(arr, false);
    g.computeBoundingSphere();
    return g;
  }

  build({ shadows = true } = {}) {
    const M = kitMaterials();
    const group = new THREE.Group();
    for (const key of ['solid', 'metal', 'matte', 'glow']) {
      const g = this.mergedGeometry(key);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, M[key]);
      mesh.castShadow = shadows && key !== 'glow';
      mesh.receiveShadow = false;
      mesh.name = 'kit_' + key;
      group.add(mesh);
    }
    for (const s of this.subs) {
      const child = s.kit.build({ shadows });
      child.name = s.name;
      child.position.copy(s.pivot);
      group.add(child);
    }
    return group;
  }
}

// ---------------------------------------------------------------- recolor helpers
const GOLD_DARK = new THREE.Color(0x5c3a06);
const GOLD_MID = new THREE.Color(0xe0a21a);
const GOLD_LIGHT = new THREE.Color(0xfff0a0);
/** Turns any palette into shiny gold while keeping light/dark contrast. */
export function goldColor(c, list) {
  if (list === 'glow') return;
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; // linear luminance
  const t = Math.min(1, Math.pow(l * 1.4 + 0.06, 0.55));
  if (t < 0.55) c.copy(GOLD_DARK).lerp(GOLD_MID, t / 0.55);
  else c.copy(GOLD_MID).lerp(GOLD_LIGHT, (t - 0.55) / 0.45);
}

/** Pale semi-transparent looking "ghost" palette (used for silhouettes). */
export function flatColor(hex) {
  const col = new THREE.Color(hex);
  return (c, list) => {
    if (list !== 'glow') c.copy(col);
  };
}
