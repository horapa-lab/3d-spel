/**
 * Cached material factory for gear. A material is described by a small spec object and cached by
 * its JSON key, so identical specs share one material (and one shader program).
 */
import * as THREE from 'three';
import {
  bambooTex,
  boneTex,
  brushedTex,
  canvasClothTex,
  carbonTex,
  coralTex,
  cordTex,
  corkTex,
  evaTex,
  filigreeTex,
  frostTex,
  hammeredTex,
  knurlTex,
  lavaTex,
  leatherTex,
  noiseTex,
  runeTex,
  sandstoneTex,
  scalesTex,
  spotsTex,
  starTex,
  stoneTex,
  threadTex,
  woodTex,
  type TexSet,
  WOODS,
} from './tex';

export type TexName =
  | 'cork'
  | 'eva'
  | 'cord'
  | 'leather'
  | 'thread'
  | 'knurl'
  | 'wood'
  | 'bamboo'
  | 'stone'
  | 'sandstone'
  | 'bone'
  | 'coral'
  | 'scales'
  | 'brushed'
  | 'hammered'
  | 'carbon'
  | 'filigree'
  | 'lava'
  | 'frost'
  | 'stars'
  | 'runes'
  | 'spots'
  | 'cloth'
  | 'noise';

export interface MatSpec {
  /** Base colour (css hex). */
  c?: string;
  m?: number;
  r?: number;
  /** Clearcoat 0..1 (lacquer / epoxy). */
  cc?: number;
  ccr?: number;
  e?: string;
  ei?: number;
  tex?: TexName;
  /** Texture argument (wood style, coral colour, spots "cap|spot", stars "a|b", seed). */
  ta?: string;
  /** Bump scale (default per texture). */
  bump?: number;
  /** Use texture colour map (default true when texture has one). */
  useMap?: boolean;
  /** Use texture emissive map. */
  useEm?: boolean;
  op?: number;
  irid?: number;
  sheen?: number;
  sheenC?: string;
  flat?: boolean;
  vc?: boolean;
  ds?: boolean;
  /** Unlit (MeshBasicMaterial). */
  basic?: boolean;
  add?: boolean;
  env?: number;
  /** Skip depth write (for transparent glows). */
  nodw?: boolean;
  /** Alpha test using the texture's alpha map. */
  alphaMap?: boolean;
  spec?: number;
}

const cache = new Map<string, THREE.Material>();

function texSet(name: TexName, arg?: string): TexSet {
  switch (name) {
    case 'cork':
      return corkTex();
    case 'eva':
      return evaTex();
    case 'cord':
      return cordTex();
    case 'leather':
      return leatherTex();
    case 'thread':
      return threadTex();
    case 'knurl':
      return knurlTex();
    case 'wood':
      return woodTex((arg as keyof typeof WOODS) ?? 'oak');
    case 'bamboo':
      return bambooTex((arg as 'green' | 'gold' | 'black') ?? 'gold');
    case 'stone':
      return stoneTex(Number(arg ?? 1));
    case 'sandstone':
      return sandstoneTex();
    case 'bone':
      return boneTex();
    case 'coral':
      return coralTex(arg ?? '#ff7a8a');
    case 'scales':
      return scalesTex();
    case 'brushed':
      return brushedTex();
    case 'hammered':
      return hammeredTex();
    case 'carbon':
      return carbonTex();
    case 'filigree':
      return filigreeTex();
    case 'lava':
      return lavaTex();
    case 'frost':
      return frostTex();
    case 'stars': {
      const [a, b] = (arg ?? '#1a1450|#4a1f7a').split('|');
      return starTex(a, b);
    }
    case 'runes':
      return runeTex(Number(arg ?? 3));
    case 'spots': {
      const [a, b] = (arg ?? '#c0392b|#fff2d0').split('|');
      return spotsTex(a, b);
    }
    case 'cloth':
      return canvasClothTex();
    case 'noise':
      return noiseTex(Number(arg ?? 1));
  }
}

const DEFAULT_BUMP: Partial<Record<TexName, number>> = {
  cork: 2.2,
  eva: 0.8,
  cord: 2.5,
  leather: 1.2,
  thread: 0.8,
  knurl: 1.2,
  wood: 1.0,
  bamboo: 0.6,
  stone: 2.0,
  sandstone: 1.4,
  bone: 1.2,
  coral: 2.2,
  scales: 1.2,
  hammered: 1.6,
  carbon: 0.5,
  filigree: 1.6,
  lava: 1.8,
  frost: 1.0,
  cloth: 1.0,
  noise: 0.6,
};

/** Get (or create) the material for a spec. */
export function M(spec: MatSpec): THREE.Material {
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  let mat: THREE.Material;
  if (spec.basic || spec.add) {
    const b = new THREE.MeshBasicMaterial({ color: spec.c ?? '#ffffff' });
    if (spec.tex) {
      const t = texSet(spec.tex, spec.ta);
      b.map = t.emissive ?? t.map ?? null;
    }
    if (spec.add) {
      b.blending = THREE.AdditiveBlending;
      b.transparent = true;
      b.depthWrite = false;
    }
    if (spec.op !== undefined) {
      b.transparent = true;
      b.opacity = spec.op;
    }
    if (spec.nodw) b.depthWrite = false;
    if (spec.ds) b.side = THREE.DoubleSide;
    b.toneMapped = !spec.add;
    b.fog = true;
    mat = b;
  } else {
    const needsPhysical = !!(spec.cc || spec.irid || spec.sheen || spec.spec !== undefined);
    const p = needsPhysical ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
    p.color.set(spec.c ?? '#ffffff');
    p.metalness = spec.m ?? 0;
    p.roughness = spec.r ?? 0.5;
    if (spec.e) {
      p.emissive.set(spec.e);
      p.emissiveIntensity = spec.ei ?? 1;
    }
    if (spec.tex) {
      const t = texSet(spec.tex, spec.ta);
      if (t.map && spec.useMap !== false) p.map = t.map;
      if (t.bump) {
        p.bumpMap = t.bump;
        p.bumpScale = spec.bump ?? DEFAULT_BUMP[spec.tex] ?? 1;
      }
      if (t.rough) p.roughnessMap = t.rough;
      if (t.emissive && spec.useEm !== false && (spec.e || spec.useEm)) {
        p.emissiveMap = t.emissive;
        if (!spec.e) p.emissive.set('#ffffff');
      }
      if (spec.alphaMap && t.alpha) {
        p.alphaMap = t.alpha;
        p.transparent = true;
        p.depthWrite = false;
      }
    }
    if (spec.op !== undefined && spec.op < 1) {
      p.transparent = true;
      p.opacity = spec.op;
      if (spec.nodw) p.depthWrite = false;
    }
    if (spec.flat) p.flatShading = true;
    if (spec.vc) p.vertexColors = true;
    if (spec.ds) p.side = THREE.DoubleSide;
    if (spec.env !== undefined) p.envMapIntensity = spec.env;
    if (p instanceof THREE.MeshPhysicalMaterial) {
      if (spec.cc) {
        p.clearcoat = spec.cc;
        p.clearcoatRoughness = spec.ccr ?? 0.08;
      }
      if (spec.irid) {
        p.iridescence = spec.irid;
        p.iridescenceIOR = 1.6;
        p.iridescenceThicknessRange = [180, 520];
      }
      if (spec.sheen) {
        p.sheen = spec.sheen;
        p.sheenColor.set(spec.sheenC ?? '#ffffff');
        p.sheenRoughness = 0.5;
      }
      if (spec.spec !== undefined) p.specularIntensity = spec.spec;
    }
    mat = p;
  }
  mat.name = key;
  cache.set(key, mat);
  return mat;
}

/** Named material presets (metals, gems, synthetic parts). */
export const P = {
  chrome: { c: '#eef1f5', m: 1, r: 0.12 },
  steel: { c: '#b8bec6', m: 1, r: 0.32, tex: 'brushed' as TexName, useMap: false },
  gunmetal: { c: '#4a4f57', m: 1, r: 0.35, tex: 'brushed' as TexName, useMap: false },
  blackAnod: { c: '#1b1d22', m: 0.85, r: 0.3 },
  brass: { c: '#d8a84e', m: 1, r: 0.3, tex: 'brushed' as TexName, useMap: false },
  oldBrass: { c: '#a8823c', m: 1, r: 0.45, tex: 'hammered' as TexName, useMap: false },
  gold: { c: '#ffc94a', m: 1, r: 0.2 },
  roseGold: { c: '#f0a58a', m: 1, r: 0.22 },
  copper: { c: '#d0784a', m: 1, r: 0.3 },
  bronze: { c: '#a2703e', m: 1, r: 0.38, tex: 'hammered' as TexName, useMap: false },
  silver: { c: '#dfe4ea', m: 1, r: 0.18 },
  iron: { c: '#55575c', m: 0.9, r: 0.55, tex: 'hammered' as TexName },
  rubber: { c: '#1d1d1f', m: 0, r: 0.75, tex: 'noise' as TexName, bump: 0.3 },
  ceramic: { c: '#2a2e36', m: 0.2, r: 0.12, cc: 1 },
  ceramicGold: { c: '#e8c060', m: 0.9, r: 0.15 },
  pearl: { c: '#f4efe6', m: 0.1, r: 0.25, irid: 0.8, cc: 0.6 },
  line: { c: '#e8f0e0', m: 0, r: 0.45, tex: 'thread' as TexName, bump: 0.4 },
} satisfies Record<string, MatSpec>;

/** Gem material (faceted, flat shaded, iridescent). */
export function gem(c: string, glow = 0.25): THREE.Material {
  return M({ c, m: 0.1, r: 0.06, cc: 1, ccr: 0.02, irid: 0.35, flat: true, e: c, ei: glow, env: 1.6 });
}

/** Lacquered paint (clearcoat). */
export function lacquer(c: string, r = 0.35, m = 0.1): THREE.Material {
  return M({ c, m, r, cc: 1, ccr: 0.06 });
}

/** Emissive glow (lit but bright). */
export function glow(c: string, ei = 2): THREE.Material {
  return M({ c, e: c, ei, r: 0.4 });
}

/** Material from a preset name (see `P`) or a spec. */
export function mref(r: string | MatSpec | undefined, fallback: string | MatSpec = 'steel'): THREE.Material {
  return M(mspec(r, fallback));
}

export function mspec(r: string | MatSpec | undefined, fallback: string | MatSpec = 'steel'): MatSpec {
  const x = r ?? fallback;
  if (typeof x === 'string') {
    const p = (P as Record<string, MatSpec>)[x];
    if (!p) throw new Error(`unknown material preset ${x}`);
    return p;
  }
  return x;
}
