/**
 * Shared procedural textures + materials for props/buildings/structures.
 * Generated once, cached, shared (never per instance).
 */
import * as THREE from 'three';

function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 1442695041, 0x27d4eb2d);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, p: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = (a: number) => ((a % p) + p) % p;
  const a = hash(w(ix), w(iy), s);
  const b = hash(w(ix + 1), w(iy), s);
  const c = hash(w(ix), w(iy + 1), s);
  const d = hash(w(ix + 1), w(iy + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

interface TexSet {
  map: THREE.DataTexture;
  normal: THREE.DataTexture;
}

function makeSet(S: number, fn: (x: number, y: number) => [number, number, number, number], normalStrength: number): TexSet {
  const col = new Uint8Array(S * S * 4);
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const [r, g, b, h] = fn(x, y);
      const i = y * S + x;
      col[i * 4] = Math.max(0, Math.min(255, r * 255));
      col[i * 4 + 1] = Math.max(0, Math.min(255, g * 255));
      col[i * 4 + 2] = Math.max(0, Math.min(255, b * 255));
      col[i * 4 + 3] = 255;
      hgt[i] = h;
    }
  }
  const nrm = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const hx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x - 1 + S) % S)];
      const hy = hgt[((y + 1) % S) * S + x] - hgt[((y - 1 + S) % S) * S + x];
      let nx = -hx * normalStrength;
      let ny = -hy * normalStrength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const i = (y * S + x) * 4;
      nrm[i] = (nx * 0.5 + 0.5) * 255;
      nrm[i + 1] = (ny * 0.5 + 0.5) * 255;
      nrm[i + 2] = (nz * 0.5 + 0.5) * 255;
      nrm[i + 3] = 255;
    }
  }
  const mk = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { map: mk(col, true), normal: mk(nrm, false) };
}

let woodSet: TexSet | null = null;
/** Greyscale plank-grain texture (1 texture unit = 2 m); tinted by material colour. */
function wood(): TexSet {
  if (woodSet) return woodSet;
  const S = 256;
  woodSet = makeSet(
    S,
    (x, y) => {
      const u = x / S;
      const v = y / S;
      // planks run along u; 8 planks per tile
      const plank = Math.floor(v * 8);
      const pv = v * 8 - plank;
      const shade = 0.78 + 0.3 * hash(plank, 0, 3);
      const grain = vnoise(u * 6 + plank * 3.1, pv * 2 + vnoise(u * 3, pv * 4, 64, 5) * 3, 64, 1);
      const fine = vnoise(u * 40, pv * 30 + plank * 7, 64, 2);
      let g = shade * (0.8 + 0.25 * grain + 0.1 * fine);
      const gap = pv < 0.04 || pv > 0.96 ? 1 : 0;
      const end = Math.abs(((u * 2 + hash(plank, 1, 4)) % 1) - 0.5) > 0.495 ? 1 : 0;
      if (gap || end) g *= 0.35;
      const knot = Math.hypot((u * 4 - Math.floor(u * 4) - 0.5) * 2, (pv - 0.5) * 3) < 0.18 && hash(Math.floor(u * 4), plank, 9) > 0.8 ? 0.6 : 1;
      g *= knot;
      const h = gap || end ? 0 : 0.6 + 0.2 * grain + 0.1 * fine;
      return [g, g * 0.97, g * 0.93, h];
    },
    2.2,
  );
  return woodSet;
}

let stoneSet: TexSet | null = null;
function stone(): TexSet {
  if (stoneSet) return stoneSet;
  const S = 256;
  stoneSet = makeSet(
    S,
    (x, y) => {
      const u = x / S;
      const v = y / S;
      const row = Math.floor(v * 5);
      const off = (row % 2) * 0.5;
      const bu = u * 3 + off;
      const col = Math.floor(bu);
      const fu = bu - col;
      const fv = v * 5 - row;
      const edge = Math.min(fu, 1 - fu, fv * 0.6, (1 - fv) * 0.6);
      const mortar = edge < 0.05 ? 1 : 0;
      const n = vnoise(u * 16, v * 16, 16, 3) * 0.6 + vnoise(u * 64, v * 64, 64, 4) * 0.4;
      const tone = 0.7 + 0.35 * hash(col, row, 11);
      const g = mortar ? 0.45 : tone * (0.75 + 0.35 * n);
      const h = mortar ? 0 : Math.min(1, edge * 6) * 0.6 + n * 0.3;
      return [g, g * 0.98, g * 0.94, h];
    },
    3,
  );
  return stoneSet;
}

let plainSet: TexSet | null = null;
function plain(): TexSet {
  if (plainSet) return plainSet;
  const S = 128;
  plainSet = makeSet(
    S,
    (x, y) => {
      const n = vnoise(x / 8, y / 8, 16, 7) * 0.5 + vnoise(x / 2, y / 2, 64, 8) * 0.5;
      const g = 0.86 + 0.18 * n;
      return [g, g, g, n];
    },
    1.2,
  );
  return plainSet;
}

export interface PropMaterials {
  wood: THREE.MeshStandardMaterial;
  woodWeathered: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  rope: THREE.MeshStandardMaterial;
  algae: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  rust: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  paintRed: THREE.MeshStandardMaterial;
  paintWhite: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  glowRed: THREE.MeshStandardMaterial;
  runeStone: THREE.MeshStandardMaterial;
  leaf: THREE.MeshStandardMaterial;
  palmLeaf: THREE.MeshStandardMaterial;
  pineLeaf: THREE.MeshStandardMaterial;
  bark: THREE.MeshStandardMaterial;
  palmBark: THREE.MeshStandardMaterial;
  snow: THREE.MeshStandardMaterial;
}

let cache: PropMaterials | null = null;
/** Materials whose emissive intensity rises at night. */
export const nightGlowMaterials: THREE.MeshStandardMaterial[] = [];

export function propMaterials(): PropMaterials {
  if (cache) return cache;
  const W = wood();
  const S = stone();
  const P = plain();
  const woodMat = (color: string, rough = 0.85) =>
    new THREE.MeshStandardMaterial({ color, map: W.map, normalMap: W.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: rough, metalness: 0 });
  const plainMat = (color: string, rough = 0.8, metal = 0) => new THREE.MeshStandardMaterial({ color, map: P.map, normalMap: P.normal, roughness: rough, metalness: metal });
  const glow = new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb45c', emissiveIntensity: 0.3, roughness: 0.4 });
  const glowRed = new THREE.MeshStandardMaterial({ color: '#ff6a5a', emissive: '#ff2a1a', emissiveIntensity: 0.6, roughness: 0.4 });
  const rune = new THREE.MeshStandardMaterial({ color: '#8f8a9a', map: S.map, normalMap: S.normal, emissive: '#6fd8ff', emissiveIntensity: 0, roughness: 0.8 });
  nightGlowMaterials.push(glow, glowRed, rune);
  cache = {
    wood: woodMat('#a07a52'),
    woodWeathered: woodMat('#9d9486', 0.9),
    woodDark: woodMat('#5b4431', 0.88),
    rope: plainMat('#b89a68', 0.95),
    algae: plainMat('#3d4a2a', 0.7),
    stone: new THREE.MeshStandardMaterial({ color: '#a7a198', map: S.map, normalMap: S.normal, roughness: 0.9 }),
    iron: plainMat('#3c3f44', 0.55, 0.6),
    rust: plainMat('#7a4a2e', 0.85, 0.3),
    brass: plainMat('#b8913e', 0.35, 0.85),
    paintRed: plainMat('#a8322a', 0.6),
    paintWhite: plainMat('#e8e4da', 0.6),
    glow,
    glowRed,
    runeStone: rune,
    leaf: new THREE.MeshStandardMaterial({ color: '#4e7d2e', map: P.map, roughness: 0.85, flatShading: false }),
    palmLeaf: new THREE.MeshStandardMaterial({ color: '#5e8f34', map: P.map, roughness: 0.8, side: THREE.DoubleSide }),
    pineLeaf: new THREE.MeshStandardMaterial({ color: '#2f5a33', map: P.map, roughness: 0.9 }),
    bark: woodMat('#5c4634', 0.95),
    palmBark: woodMat('#8a7353', 0.95),
    snow: plainMat('#f4f7fb', 0.6),
  };
  return cache;
}
