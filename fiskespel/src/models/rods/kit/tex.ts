/**
 * Procedural texture library for gear (rods, reels, baits, chests, relics, bobbers…).
 * Every generator is cached by key: a texture is generated once and shared.
 * Most "detail" maps are grayscale (~0.6..1.0) and get multiplied by the material colour,
 * so one texture serves many colour variants.
 */
import * as THREE from 'three';
import { clamp01, fbm, hash2, hexRGB, mixRGB, rng, sstep, vnoise, worley, type RGB } from './noise';

export interface TexSet {
  map?: THREE.Texture;
  bump?: THREE.Texture;
  rough?: THREE.Texture;
  emissive?: THREE.Texture;
  alpha?: THREE.Texture;
}

const cache = new Map<string, TexSet>();

function once(key: string, make: () => TexSet): TexSet {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTex(c: HTMLCanvasElement, srgb: boolean, clampWrap = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = clampWrap ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

type PixFn = (u: number, v: number, out: number[]) => void;

/** Fill a canvas per pixel. fn writes r,g,b(,a) 0..255 into out. u,v in [0,1). */
function pix(w: number, h: number, fn: PixFn, alpha = false): HTMLCanvasElement {
  const c = mkCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[3] = 255;
      fn(x / w, y / h, out);
      const i = (y * w + x) * 4;
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
      d[i + 3] = alpha ? out[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Build colour + grayscale (bump) maps from one sampler returning [rgb, height]. */
function pair(w: number, h: number, fn: (u: number, v: number) => [RGB, number], extra?: (u: number, v: number) => number): {
  map: THREE.Texture;
  bump: THREE.Texture;
  rough?: THREE.Texture;
} {
  const col = new Float32Array(w * h * 3);
  const hgt = new Float32Array(w * h);
  const rgh = extra ? new Float32Array(w * h) : null;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const [c, hh] = fn(x / w, y / h);
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
      hgt[i] = hh;
      if (rgh && extra) rgh[i] = extra(x / w, y / h);
    }
  const cm = pix(w, h, (u, v, o) => {
    const i = Math.floor(v * h) * w + Math.floor(u * w);
    o[0] = col[i * 3];
    o[1] = col[i * 3 + 1];
    o[2] = col[i * 3 + 2];
  });
  const bm = pix(w, h, (u, v, o) => {
    const i = Math.floor(v * h) * w + Math.floor(u * w);
    o[0] = o[1] = o[2] = clamp01(hgt[i]) * 255;
  });
  const res: { map: THREE.Texture; bump: THREE.Texture; rough?: THREE.Texture } = { map: toTex(cm, true), bump: toTex(bm, false) };
  if (rgh) {
    const rm = pix(w, h, (u, v, o) => {
      const i = Math.floor(v * h) * w + Math.floor(u * w);
      o[0] = o[1] = o[2] = clamp01(rgh[i]) * 255;
    });
    res.rough = toTex(rm, false);
  }
  return res;
}

const g3 = (v: number): RGB => [v * 255, v * 255, v * 255];

// ───────────────────────────────────────────────────────────── grip materials

/** Natural cork rings: tan with dark pits and filler flecks. Colour map (not tinted). */
export function corkTex(): TexSet {
  return once('cork', () => {
    const base0 = hexRGB('#b0804f');
    const base1 = hexRGB('#dcb482');
    const pit = hexRGB('#4a2c16');
    const fill = hexRGB('#e8cc9c');
    return pair(256, 256, (u, v) => {
      const n = fbm(u * 8, v * 8, 4, 8, 8, 3);
      const fine = hash2(Math.floor(u * 256), Math.floor(v * 256), 9);
      let c = mixRGB(base0, base1, sstep(0.25, 0.75, n) * 0.85 + fine * 0.15);
      let h = 0.62 + (fine - 0.5) * 0.18 + (n - 0.5) * 0.2;
      // pits
      const [f1] = worley(u * 26, v * 26, 26, 26, 5);
      const pr = 0.12 + hash2(Math.floor(u * 26), Math.floor(v * 26), 77) * 0.22;
      const pitT = 1 - sstep(pr * 0.55, pr, f1);
      const [g1] = worley(u * 9, v * 9, 9, 9, 11);
      const big = hash2(Math.floor(u * 9), Math.floor(v * 9), 12) > 0.72 ? 1 - sstep(0.1, 0.22, g1) : 0;
      const pt = Math.max(pitT * 0.85, big);
      c = mixRGB(c, pit, pt);
      h -= pt * 0.55;
      // light filler specks
      const [k1] = worley(u * 40, v * 40, 40, 40, 21);
      const fl = hash2(Math.floor(u * 40), Math.floor(v * 40), 22) > 0.8 ? 1 - sstep(0.05, 0.16, k1) : 0;
      c = mixRGB(c, fill, fl * 0.6);
      // cork ring seams (4 rings per tile)
      const ring = Math.abs(((v * 4) % 1) - 0.5) * 2;
      const seam = sstep(0.93, 1.0, ring);
      c = mixRGB(c, pit, seam * 0.35);
      h -= seam * 0.25;
      return [c, h];
    });
  });
}

/** EVA foam: fine closed-cell grain, grayscale (tinted by material colour). */
export function evaTex(): TexSet {
  return once('eva', () =>
    pair(128, 128, (u, v) => {
      const [f1] = worley(u * 36, v * 36, 36, 36, 3);
      const n = fbm(u * 6, v * 6, 3, 6, 6, 1);
      const cell = sstep(0.0, 0.5, f1);
      const g = 0.82 + cell * 0.12 + (n - 0.5) * 0.1;
      return [g3(g), 0.5 + cell * 0.35];
    }),
  );
}

/** Cord / diamond grip wrap (tsuka-ito style), grayscale. */
export function cordTex(): TexSet {
  return once('cord', () =>
    pair(128, 128, (u, v) => {
      // two diagonal families, 4 bands each across the tile
      const a = (u + v) * 4;
      const b = (u - v) * 4 + 8;
      const fa = a - Math.floor(a);
      const fb = b - Math.floor(b);
      const ia = Math.floor(a);
      const ib = Math.floor(b);
      const topA = (ia + ib) % 2 === 0;
      const prof = (f: number) => Math.sin(Math.PI * f);
      const pa = prof(fa);
      const pb = prof(fb);
      const hTop = topA ? pa : pb;
      const hBot = topA ? pb : pa;
      let hgt = Math.max(hTop, hBot * 0.7);
      // twisted strands across each band
      const strand = 0.85 + 0.15 * Math.sin((topA ? fb : fa) * Math.PI * 10 + (topA ? a : b) * 3);
      const gap = hgt < 0.25 ? 0.45 : 1;
      hgt = hgt * strand;
      const g = (0.55 + 0.45 * hgt) * gap;
      return [g3(Math.min(1, g)), hgt];
    }),
  );
}

/** Pebbled leather with a stitch row, grayscale. */
export function leatherTex(): TexSet {
  return once('leather', () =>
    pair(256, 256, (u, v) => {
      const [f1, f2] = worley(u * 30, v * 30, 30, 30, 8);
      const edge = sstep(0.0, 0.18, f2 - f1);
      const n = fbm(u * 5, v * 5, 3, 5, 5, 4);
      const g = 0.7 + edge * 0.2 + (n - 0.5) * 0.18;
      return [g3(g), 0.35 + edge * 0.5];
    }),
  );
}

/** Thread wrap: fine parallel threads (along u), grayscale. */
export function threadTex(): TexSet {
  return once('thread', () =>
    pair(64, 64, (u, v) => {
      const t = Math.abs(Math.sin(v * Math.PI * 16));
      const n = hash2(Math.floor(u * 8), Math.floor(v * 16), 2);
      const g = 0.72 + t * 0.26 - n * 0.04;
      return [g3(g), t];
    }),
  );
}

/** Knurled metal (diamond grid), grayscale. */
export function knurlTex(): TexSet {
  return once('knurl', () =>
    pair(64, 64, (u, v) => {
      const a = Math.abs(Math.sin((u + v) * Math.PI * 8));
      const b = Math.abs(Math.sin((u - v) * Math.PI * 8));
      const hgt = Math.min(a, b);
      return [g3(0.65 + hgt * 0.35), hgt];
    }),
  );
}

// ───────────────────────────────────────────────────────────── wood & natural

export interface WoodStyle {
  dark: string;
  light: string;
  /** Grain line count across the tile width. */
  lines?: number;
  warp?: number;
  /** 0..1 weathered cracks/grey (driftwood). */
  weathered?: number;
  knots?: number;
  /** 0..1 contrast of fine pores. */
  pores?: number;
}

export const WOODS: Record<string, WoodStyle> = {
  drift: { dark: '#6f6456', light: '#b9ad99', lines: 9, warp: 0.5, weathered: 1, pores: 0.5 },
  cane: { dark: '#a86f2c', light: '#e3b86a', lines: 14, warp: 0.08, pores: 0.25 },
  walnut: { dark: '#3a2416', light: '#7a5130', lines: 10, warp: 0.35, pores: 0.4 },
  mahogany: { dark: '#4a1a10', light: '#9a4a2a', lines: 12, warp: 0.25, pores: 0.35 },
  oak: { dark: '#6b4a2a', light: '#c09360', lines: 8, warp: 0.4, pores: 0.6, knots: 1 },
  pine: { dark: '#9a6a38', light: '#e2bf86', lines: 7, warp: 0.45, pores: 0.2, knots: 2 },
  ebony: { dark: '#120c0a', light: '#3a2c24', lines: 12, warp: 0.2, pores: 0.2 },
  teak: { dark: '#5a3818', light: '#a87038', lines: 11, warp: 0.3, pores: 0.45 },
  ash: { dark: '#9d8766', light: '#e8d9b8', lines: 8, warp: 0.35, pores: 0.5 },
  elder: { dark: '#3d3a22', light: '#7d7a4a', lines: 9, warp: 0.6, pores: 0.5 },
  bog: { dark: '#2a2418', light: '#5e5236', lines: 9, warp: 0.7, weathered: 0.4, pores: 0.5 },
  crate: { dark: '#7a5230', light: '#c89a62', lines: 7, warp: 0.4, pores: 0.45, knots: 2 },
  darkplank: { dark: '#2e1c12', light: '#6a4428', lines: 8, warp: 0.4, pores: 0.45, knots: 1 },
  redplank: { dark: '#4a160e', light: '#8e3a22', lines: 9, warp: 0.35, pores: 0.4, knots: 1 },
  bleached: { dark: '#8e836f', light: '#e0d6c2', lines: 8, warp: 0.5, weathered: 0.6, pores: 0.4, knots: 1 },
};

/** Wood grain running along V (tile width = across grain). Colour map + bump + roughness. */
export function woodTex(style: keyof typeof WOODS | WoodStyle): TexSet {
  const s = typeof style === 'string' ? WOODS[style] : style;
  const key = 'wood:' + JSON.stringify(s);
  return once(key, () => {
    const dk = hexRGB(s.dark);
    const lt = hexRGB(s.light);
    const grey = hexRGB('#8c877e');
    const lines = s.lines ?? 9;
    const warp = s.warp ?? 0.35;
    const wth = s.weathered ?? 0;
    const pores = s.pores ?? 0.4;
    const r = rng(lines * 31 + Math.round(warp * 100));
    const knots: { u: number; v: number; r: number }[] = [];
    for (let i = 0; i < (s.knots ?? 0); i++) knots.push({ u: r(), v: r(), r: 0.035 + r() * 0.03 });
    const sample = (u: number, v: number): [RGB, number] => {
      let phase = u * lines + (fbm(u * 3, v * 2, 4, 3, 2, 7) - 0.5) * warp * 6;
      let kn = 0;
      for (const k of knots) {
        let du = Math.abs(u - k.u);
        du = Math.min(du, 1 - du);
        let dv = Math.abs(v - k.v);
        dv = Math.min(dv, 1 - dv);
        const d = Math.sqrt((du * du) / (k.r * k.r) + (dv * dv) / (k.r * k.r * 4));
        if (d < 3) {
          phase += Math.exp(-d * d) * 2.2 * Math.sign(u - k.u || 1);
          kn = Math.max(kn, 1 - sstep(0.2, 0.55, d));
        }
      }
      const band = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
      const late = Math.pow(band, 2.2);
      const fine = fbm(u * 48, v * 3, 3, 48, 3, 13);
      const pore = hash2(Math.floor(u * 256), Math.floor(v * 64), 5);
      let t = 0.15 + late * 0.55 + (fine - 0.5) * 0.5;
      t -= pore > 1 - pores * 0.15 ? 0.25 : 0;
      t = clamp01(t);
      let c = mixRGB(dk, lt, t);
      c = mixRGB(c, dk, kn * 0.85);
      let h = 0.5 + (late - 0.5) * 0.35 + (fine - 0.5) * 0.35 - (pore > 1 - pores * 0.15 ? 0.2 : 0);
      if (wth > 0) {
        const cr = fbm(u * 40, v * 2.5, 3, 40, 3, 19);
        const crack = sstep(0.68, 0.78, cr) * wth;
        c = mixRGB(c, grey, 0.25 * wth * (1 - band));
        c = mixRGB(c, mixRGB(dk, [20, 16, 12], 0.5), crack * 0.8);
        h -= crack * 0.45;
      }
      return [c, h];
    };
    return pair(256, 256, sample, (u, v) => 0.55 + (fbm(u * 6, v * 2, 3, 6, 2, 3) - 0.5) * 0.3);
  });
}

/** Bamboo culm: longitudinal fibres + speckles. Colour map (node rings are geometry). */
export function bambooTex(tone: 'green' | 'gold' | 'black'): TexSet {
  return once('bamboo:' + tone, () => {
    const pal: Record<string, [string, string]> = {
      green: ['#6f8a2e', '#b6c25a'],
      gold: ['#b3812f', '#ecc873'],
      black: ['#1f1a16', '#4a3c30'],
    };
    const a = hexRGB(pal[tone][0]);
    const b = hexRGB(pal[tone][1]);
    const sp = hexRGB('#5a3a1c');
    return pair(128, 256, (u, v) => {
      const fib = fbm(u * 40, v * 1.5, 3, 40, 2, 4);
      const tone2 = fbm(u * 3, v * 1.2, 3, 3, 2, 6);
      let c = mixRGB(a, b, clamp01(tone2 * 0.8 + fib * 0.4));
      const [f1] = worley(u * 12, v * 20, 12, 20, 2);
      const spot = hash2(Math.floor(u * 12), Math.floor(v * 20), 3) > 0.86 ? 1 - sstep(0.08, 0.3, f1) : 0;
      c = mixRGB(c, sp, spot * 0.55);
      return [c, 0.5 + (fib - 0.5) * 0.6];
    });
  });
}

/** Stone: granular with fine cracks, grayscale (tint via material). */
export function stoneTex(seed = 1): TexSet {
  return once('stone:' + seed, () =>
    pair(256, 256, (u, v) => {
      const n = fbm(u * 5, v * 5, 5, 5, 5, seed);
      const sp = hash2(Math.floor(u * 256), Math.floor(v * 256), seed + 4);
      const [f1, f2] = worley(u * 7, v * 7, 7, 7, seed + 9);
      const crack = 1 - sstep(0.0, 0.05, f2 - f1);
      let g = 0.62 + (n - 0.5) * 0.45 + (sp - 0.5) * 0.12;
      g -= crack * 0.28;
      g += sp > 0.97 ? 0.15 : 0;
      return [g3(clamp01(g)), clamp01(0.5 + (n - 0.5) * 0.8 - crack * 0.5 + (sp - 0.5) * 0.1)];
    }),
  );
}

/** Warm sandstone strata (colour). */
export function sandstoneTex(): TexSet {
  return once('sandstone', () => {
    const cols = ['#d9b27a', '#c98f55', '#e8c890', '#b8703e', '#dcae70'].map(hexRGB);
    return pair(256, 256, (u, v) => {
      const w = (fbm(u * 3, v * 2, 4, 3, 2, 8) - 0.5) * 0.25;
      const s = (v + w) * 6;
      const i = Math.floor(s);
      const f = s - i;
      const c0 = cols[((i % 5) + 5) % 5];
      const c1 = cols[(((i + 1) % 5) + 5) % 5];
      let c = mixRGB(c0, c1, sstep(0.75, 1, f));
      const gr = hash2(Math.floor(u * 256), Math.floor(v * 256), 1);
      c = mixRGB(c, [90, 60, 35], (gr > 0.9 ? 0.25 : 0) + (1 - fbm(u * 10, v * 10, 3, 10, 10, 2)) * 0.12);
      const h = 0.5 + (gr - 0.5) * 0.25 - sstep(0.9, 1, f) * 0.25;
      return [c, h];
    });
  });
}

/** Ivory / bone with pores and hairline cracks (colour). */
export function boneTex(): TexSet {
  return once('bone', () => {
    const a = hexRGB('#b9a887');
    const b = hexRGB('#efe5cc');
    return pair(256, 256, (u, v) => {
      const n = fbm(u * 4, v * 8, 4, 4, 8, 5);
      const st = fbm(u * 30, v * 2, 3, 30, 2, 7);
      let c = mixRGB(a, b, clamp01(n * 0.9 + st * 0.3));
      const [f1] = worley(u * 40, v * 40, 40, 40, 6);
      const pore = hash2(Math.floor(u * 40), Math.floor(v * 40), 1) > 0.55 ? 1 - sstep(0.05, 0.12, f1) : 0;
      c = mixRGB(c, [95, 78, 55], pore * 0.7);
      const [w1, w2] = worley(u * 5, v * 5, 5, 5, 3);
      const crack = 1 - sstep(0, 0.035, w2 - w1);
      c = mixRGB(c, [110, 90, 62], crack * 0.45);
      return [c, 0.55 + (n - 0.5) * 0.4 - pore * 0.4 - crack * 0.3];
    });
  });
}

/** Porous coral (colour). */
export function coralTex(hex = '#ff7a8a'): TexSet {
  return once('coral:' + hex, () => {
    const base = hexRGB(hex);
    const lt = mixRGB(base, [255, 240, 230], 0.45);
    const dk = mixRGB(base, [60, 10, 20], 0.55);
    return pair(128, 128, (u, v) => {
      const [f1] = worley(u * 14, v * 14, 14, 14, 4);
      const hole = 1 - sstep(0.12, 0.3, f1);
      const n = fbm(u * 4, v * 4, 3, 4, 4, 2);
      let c = mixRGB(lt, base, clamp01(0.4 + n * 0.8));
      c = mixRGB(c, dk, hole * 0.75);
      return [c, 0.7 - hole * 0.6 + (n - 0.5) * 0.2];
    });
  });
}

/** Scales (fish skin) grayscale: overlapping rows. */
export function scalesTex(): TexSet {
  return once('scales', () =>
    pair(128, 128, (u, v) => {
      const rows = 8;
      const y = v * rows;
      const row = Math.floor(y);
      const x = u * rows + (row % 2) * 0.5;
      const cx = Math.floor(x) + 0.5;
      const dx = x - cx;
      const dy = y - row;
      const d = Math.sqrt(dx * dx + dy * dy * 1.2);
      const edge = sstep(0.42, 0.52, d);
      const g = 0.75 + dy * 0.25 - edge * 0.25;
      return [g3(g), 0.45 + dy * 0.45 - edge * 0.35];
    }),
  );
}

// ───────────────────────────────────────────────────────────── metal & synthetic

/** Brushed metal roughness/colour variation (grayscale), streaks along U. */
export function brushedTex(): TexSet {
  return once('brushed', () => {
    const c = pix(256, 256, (u, v, o) => {
      const s = fbm(u * 2, v * 96, 3, 2, 96, 4);
      const g = 0.72 + (s - 0.5) * 0.4;
      o[0] = o[1] = o[2] = clamp01(g) * 255;
    });
    const r = pix(256, 256, (u, v, o) => {
      const s = fbm(u * 2, v * 96, 3, 2, 96, 4);
      o[0] = o[1] = o[2] = clamp01(0.45 + (s - 0.5) * 0.5) * 255;
    });
    return { map: toTex(c, true), rough: toTex(r, false) };
  });
}

/** Hammered / cast iron: dents + mottling (grayscale). */
export function hammeredTex(): TexSet {
  return once('hammered', () =>
    pair(256, 256, (u, v) => {
      const [f1] = worley(u * 10, v * 10, 10, 10, 12);
      const n = fbm(u * 6, v * 6, 4, 6, 6, 5);
      const pit = hash2(Math.floor(u * 128), Math.floor(v * 128), 3);
      const g = 0.62 + (n - 0.5) * 0.4 + f1 * 0.15 - (pit > 0.985 ? 0.2 : 0);
      return [g3(clamp01(g)), clamp01(0.3 + f1 * 0.6 - (pit > 0.985 ? 0.3 : 0))];
    }, (u, v) => 0.5 + (fbm(u * 5, v * 5, 3, 5, 5, 8) - 0.5) * 0.5),
  );
}

/** Carbon fibre 2x2 twill (colour: near-black with sheen variation). */
export function carbonTex(): TexSet {
  return once('carbon', () =>
    pair(128, 128, (u, v) => {
      const n = 8;
      const x = u * n;
      const y = v * n;
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const warpTop = (((ix + iy) % 4) + 4) % 4 < 2;
      const f = warpTop ? x - ix : y - iy;
      const along = warpTop ? y : x;
      const shade = Math.sin(Math.PI * f);
      const fil = 0.9 + 0.1 * Math.sin(along * 60 + f * 3);
      const base = warpTop ? 0.2 : 0.11;
      const g = (base + shade * 0.1) * fil;
      return [g3(g), 0.4 + shade * 0.4];
    }, (u, v) => {
      const n = 8;
      const ix = Math.floor(u * n);
      const iy = Math.floor(v * n);
      return (((ix + iy) % 4) + 4) % 4 < 2 ? 0.25 : 0.4;
    }),
  );
}

/** Gold filigree scroll-work (grayscale bump/map), tiles along U. */
export function filigreeTex(): TexSet {
  return once('filigree', () => {
    const W = 256;
    const H = 64;
    const c = mkCanvas(W, H);
    const x = c.getContext('2d')!;
    x.fillStyle = '#6a6a6a';
    x.fillRect(0, 0, W, H);
    x.strokeStyle = '#ffffff';
    x.lineCap = 'round';
    x.lineWidth = 4;
    for (let k = -1; k < 5; k++) {
      const cx = k * 64 + 32;
      x.beginPath();
      x.moveTo(cx - 32, H / 2);
      x.bezierCurveTo(cx - 16, 6, cx + 16, 6, cx + 32, H / 2);
      x.bezierCurveTo(cx + 48, H - 6, cx + 80, H - 6, cx + 96, H / 2);
      x.stroke();
      x.beginPath();
      x.arc(cx, 20, 9, Math.PI * 0.2, Math.PI * 1.7);
      x.stroke();
      x.beginPath();
      x.arc(cx + 32, H - 20, 9, Math.PI * 1.2, Math.PI * 2.7);
      x.stroke();
      x.fillStyle = '#ffffff';
      x.beginPath();
      x.arc(cx + 16, H / 2, 3.5, 0, Math.PI * 2);
      x.fill();
    }
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(0, 4);
    x.lineTo(W, 4);
    x.moveTo(0, H - 4);
    x.lineTo(W, H - 4);
    x.stroke();
    const map = toTex(c, true);
    const bump = toTex(c, false);
    return { map, bump };
  });
}

// ───────────────────────────────────────────────────────────── magical / elemental

/** Basalt with glowing lava cracks: map + emissive + bump. */
export function lavaTex(): TexSet {
  return once('lava', () => {
    const W = 256;
    const crackAt = (u: number, v: number) => {
      const [f1, f2] = worley(u * 6, v * 9, 6, 9, 31);
      const wob = (fbm(u * 8, v * 8, 3, 8, 8, 4) - 0.5) * 0.06;
      return 1 - sstep(0.02, 0.1 + wob, f2 - f1);
    };
    const map = pix(W, W, (u, v, o) => {
      const n = fbm(u * 6, v * 6, 4, 6, 6, 2);
      const cr = crackAt(u, v);
      const g = 0.06 + n * 0.1;
      const c = mixRGB([g * 255, g * 240, g * 230], [60, 18, 6], cr);
      o[0] = c[0];
      o[1] = c[1];
      o[2] = c[2];
    });
    const em = pix(W, W, (u, v, o) => {
      const cr = crackAt(u, v);
      const hot = cr * cr;
      const c = mixRGB([255, 60, 0], [255, 220, 120], hot * hot);
      o[0] = c[0] * cr;
      o[1] = c[1] * cr;
      o[2] = c[2] * cr;
    });
    const bump = pix(W, W, (u, v, o) => {
      const n = fbm(u * 10, v * 10, 4, 10, 10, 6);
      const cr = crackAt(u, v);
      o[0] = o[1] = o[2] = clamp01(0.55 + (n - 0.5) * 0.6 - cr * 0.5) * 255;
    });
    return { map: toTex(map, true), emissive: toTex(em, true), bump: toTex(bump, false) };
  });
}

/** Frost: white feathery streaks on blue (colour + bump). */
export function frostTex(): TexSet {
  return once('frost', () => {
    const a = hexRGB('#9fd8f2');
    const b = hexRGB('#f4fdff');
    return pair(256, 256, (u, v) => {
      const [f1, f2] = worley(u * 8, v * 8, 8, 8, 17);
      const edge = 1 - sstep(0.0, 0.07, f2 - f1);
      const n = fbm(u * 10, v * 10, 4, 10, 10, 3);
      const fr = sstep(0.55, 0.8, fbm(u * 24, v * 24, 3, 24, 24, 9));
      const c = mixRGB(a, b, clamp01(edge * 0.8 + fr * 0.6 + (n - 0.5) * 0.4));
      return [c, 0.4 + edge * 0.4 + fr * 0.3];
    });
  });
}

/** Night sky: nebula colour map + emissive star specks. */
export function starTex(hueA = '#1a1450', hueB = '#4a1f7a'): TexSet {
  return once('stars:' + hueA + hueB, () => {
    const A = hexRGB(hueA);
    const B = hexRGB(hueB);
    const map = pix(256, 256, (u, v, o) => {
      const n = fbm(u * 4, v * 4, 5, 4, 4, 12);
      const c = mixRGB(mixRGB([6, 6, 18], A, sstep(0.3, 0.7, n)), B, sstep(0.55, 0.85, n) * 0.8);
      o[0] = c[0];
      o[1] = c[1];
      o[2] = c[2];
    });
    const em = pix(256, 256, (u, v, o) => {
      const [f1] = worley(u * 24, v * 24, 24, 24, 5);
      const h = hash2(Math.floor(u * 24), Math.floor(v * 24), 6);
      const size = h > 0.93 ? 0.16 : h > 0.6 ? 0.08 : 0;
      const s = size > 0 ? 1 - sstep(size * 0.3, size, f1) : 0;
      const n = fbm(u * 4, v * 4, 5, 4, 4, 12);
      const neb = sstep(0.6, 0.9, n) * 0.18;
      const c = mixRGB([B[0] * neb, B[1] * neb, B[2] * neb], [255, 250, 230], s);
      o[0] = c[0];
      o[1] = c[1];
      o[2] = c[2];
    });
    return { map: toTex(map, true), emissive: toTex(em, true) };
  });
}

/** Rune band: glowing glyph strip (emissive/alpha mask), 8 glyphs along U. */
export function runeTex(seed = 3): TexSet {
  return once('runes:' + seed, () => {
    const W = 512;
    const H = 64;
    const c = mkCanvas(W, H);
    const x = c.getContext('2d')!;
    x.fillStyle = '#000';
    x.fillRect(0, 0, W, H);
    const r = rng(seed * 97 + 5);
    x.strokeStyle = '#fff';
    x.lineCap = 'round';
    x.lineJoin = 'round';
    const N = 8;
    for (let g = 0; g < N; g++) {
      const ox = g * (W / N) + 14;
      const oy = 10;
      const s = 36;
      const pts: [number, number][] = [];
      for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) pts.push([ox + (xx * s) / 2, oy + (yy * s) / 2 + 4]);
      x.lineWidth = 4.5;
      x.shadowColor = '#fff';
      x.shadowBlur = 6;
      const strokes = 3 + Math.floor(r() * 3);
      let cur = pts[Math.floor(r() * 9)];
      x.beginPath();
      x.moveTo(cur[0], cur[1]);
      for (let k = 0; k < strokes; k++) {
        const nx = pts[Math.floor(r() * 9)];
        if (r() < 0.3) {
          x.moveTo(nx[0], nx[1]);
        } else x.lineTo(nx[0], nx[1]);
        cur = nx;
      }
      x.stroke();
      if (r() < 0.5) {
        x.beginPath();
        x.arc(ox + s / 2, oy + s / 2 + 4, 6 + r() * 6, 0, Math.PI * 2);
        x.stroke();
      }
    }
    // border lines
    x.shadowBlur = 0;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(0, 3);
    x.lineTo(W, 3);
    x.moveTo(0, H - 3);
    x.lineTo(W, H - 3);
    x.stroke();
    const t = toTex(c, true);
    return { emissive: t, map: t, alpha: toTex(c, false) };
  });
}

/** Spots for mushroom caps: colour map with cream spots + emissive spots mask. */
export function spotsTex(cap: string, spot: string): TexSet {
  return once('spots:' + cap + spot, () => {
    const C = hexRGB(cap);
    const S = hexRGB(spot);
    const D = mixRGB(C, [20, 10, 10], 0.4);
    const spotAt = (u: number, v: number) => {
      const [f1] = worley(u * 7, v * 5, 7, 5, 44);
      const h = hash2(Math.floor(u * 7), Math.floor(v * 5), 45);
      const r = 0.18 + h * 0.18;
      return h > 0.25 ? 1 - sstep(r * 0.8, r, f1) : 0;
    };
    const map = pix(128, 128, (u, v, o) => {
      const n = fbm(u * 5, v * 5, 3, 5, 5, 2);
      const grad = v; // lathe: v runs rim->top
      let c = mixRGB(D, C, clamp01(0.3 + grad * 0.6 + (n - 0.5) * 0.4));
      c = mixRGB(c, S, spotAt(u, v));
      o[0] = c[0];
      o[1] = c[1];
      o[2] = c[2];
    });
    const em = pix(128, 128, (u, v, o) => {
      const s = spotAt(u, v);
      o[0] = S[0] * s;
      o[1] = S[1] * s;
      o[2] = S[2] * s;
    });
    return { map: toTex(map, true), emissive: toTex(em, true) };
  });
}

/** Woven canvas / sack cloth (grayscale). */
export function canvasClothTex(): TexSet {
  return once('cloth', () =>
    pair(128, 128, (u, v) => {
      const n = 24;
      const a = Math.sin(u * Math.PI * n * 2);
      const b = Math.sin(v * Math.PI * n * 2);
      const over = (Math.floor(u * n * 2) + Math.floor(v * n * 2)) % 2 === 0;
      const h = over ? Math.abs(b) : Math.abs(a);
      const nn = fbm(u * 6, v * 6, 3, 6, 6, 3);
      return [g3(0.72 + h * 0.2 + (nn - 0.5) * 0.15), h];
    }),
  );
}

/** Soft vertical glow gradient (for flame / beam sprites), alpha in map. */
export function glowTex(): THREE.Texture {
  return once('glow', () => {
    const c = pix(64, 64, (u, v, o) => {
      const dx = u - 0.5;
      const dy = v - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.pow(clamp01(1 - d), 2);
      o[0] = o[1] = o[2] = 255;
      o[3] = a * 255;
    }, true);
    return { map: toTex(c, true, true) };
  }).map!;
}

/** Generic grayscale noise for roughness variation. */
export function noiseTex(seed = 1, scale = 6): TexSet {
  return once('noise:' + seed + ':' + scale, () => {
    const c = pix(128, 128, (u, v, o) => {
      o[0] = o[1] = o[2] = clamp01(0.5 + (fbm(u * scale, v * scale, 4, scale, scale, seed) - 0.5) * 0.9) * 255;
    });
    return { rough: toTex(c, false), bump: toTex(c, false) };
  });
}

/** Horizontal gradient 1D texture (u across) – used by ribbons/auroras. */
export function gradientTex(stops: string[], alphaFade = false): THREE.Texture {
  return once('grad:' + stops.join() + alphaFade, () => {
    const cols = stops.map(hexRGB);
    const c = pix(256, 16, (u, v, o) => {
      const s = u * (cols.length - 1);
      const i = Math.min(cols.length - 2, Math.floor(s));
      const cc = mixRGB(cols[i], cols[i + 1], s - i);
      o[0] = cc[0];
      o[1] = cc[1];
      o[2] = cc[2];
      o[3] = alphaFade ? Math.sin(Math.PI * v) * 255 : 255;
    }, alphaFade);
    return { map: toTex(c, true, true) };
  }).map!;
}

export { vnoise };
