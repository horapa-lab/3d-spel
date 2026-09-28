/**
 * The character "uber" material + mesh builder (OWNER: player author).
 *
 * Every character (player + all NPCs) is ONE rigidly-skinned mesh drawn with ONE shared material:
 * colour, secondary pattern colour, roughness, metalness, AO, detail-bump strength, detail channel
 * selection and emissive are all per-vertex attributes. A single tiling 512² detail texture holds
 * four height fields (R weave, G knit, B skin/leather grain, A hair strands) used both as bump
 * and as subtle albedo variation. => 1 draw call (+1 shadow) per character, no per-NPC textures.
 */
import * as THREE from 'three';

// ──────────────────────────────────────────────────────────── detail texture

function hashI(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Periodic value noise (period = cells). */
function vnoise(x: number, y: number, cells: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (v: number) => ((v % cells) + cells) % cells;
  const a = hashI(w(xi), w(yi), seed);
  const b = hashI(w(xi + 1), w(yi), seed);
  const c = hashI(w(xi), w(yi + 1), seed);
  const d = hashI(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x: number, y: number, baseCells: number, oct: number, seed: number): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let cells = baseCells;
  for (let o = 0; o < oct; o++) {
    sum += vnoise((x * cells) / 512, (y * cells) / 512, cells, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
    cells *= 2;
  }
  return sum / norm;
}

let detailTex: THREE.DataTexture | null = null;

export function characterDetailTexture(): THREE.DataTexture {
  if (detailTex) return detailTex;
  const N = 512;
  const data = new Uint8Array(N * N * 4);
  // precompute cellular pores for skin
  const cellN = 48;
  const pts: [number, number][] = [];
  for (let j = 0; j < cellN; j++) for (let i = 0; i < cellN; i++) pts.push([(i + hashI(i, j, 5)) * (N / cellN), (j + hashI(i, j, 9)) * (N / cellN)]);
  const cellSize = N / cellN;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const k = (y * N + x) * 4;
      // R: plain weave, 8px threads
      const P = 8;
      const ix = Math.floor(x / P);
      const iy = Math.floor(y / P);
      const fx = (x % P) / P;
      const fy = (y % P) / P;
      const slubX = 0.85 + 0.3 * vnoise(x / 64, iy + 0.5, 8, 3);
      const slubY = 0.85 + 0.3 * vnoise(ix + 0.5, y / 64, 64, 4);
      const warp = Math.sin(Math.PI * fx);
      const weft = Math.sin(Math.PI * fy);
      let weave = (ix + iy) % 2 === 0 ? warp * (0.55 + 0.45 * weft) * slubY : weft * (0.55 + 0.45 * warp) * slubX;
      weave = weave * 0.85 + 0.15 * fbm(x, y, 16, 3, 11);
      // G: knit V-stitches, 16px columns, 14..16px rows
      const KC = 16;
      const kx = (x % KC) / KC;
      const ky = (y % KC) / KC;
      const seg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
        const vx = bx - ax;
        const vy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
        return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
      };
      const dl = seg(kx, ky, 0.06, 1.0, 0.47, 0.05);
      const dr = seg(kx, ky, 0.94, 1.0, 0.53, 0.05);
      const leg = (d: number) => Math.pow(Math.max(0, 1 - d / 0.24), 0.8);
      let knit = Math.max(leg(dl), leg(dr));
      knit = knit * (0.9 + 0.1 * vnoise(x / 8, y / 8, 64, 21));
      // B: skin / leather grain: cellular pores + soft fbm
      const cx = Math.floor(x / cellSize);
      const cy = Math.floor(y / cellSize);
      let dmin = 1e9;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const gx = (cx + ox + cellN) % cellN;
          const gy = (cy + oy + cellN) % cellN;
          const p = pts[gy * cellN + gx];
          let dx = p[0] - x;
          let dy = p[1] - y;
          if (dx > N / 2) dx -= N;
          if (dx < -N / 2) dx += N;
          if (dy > N / 2) dy -= N;
          if (dy < -N / 2) dy += N;
          dmin = Math.min(dmin, Math.hypot(dx, dy));
        }
      }
      const cell = Math.min(1, dmin / (cellSize * 0.75));
      const grain = 0.55 * cell + 0.45 * fbm(x, y, 32, 4, 31);
      // A: hair strands (vary along x, stretched along y)
      const wav = 6 * Math.sin((y / N) * Math.PI * 2 * 2 + vnoise(x / 32, 0.5, 16, 41) * 6);
      const sx = x + wav;
      const strands = 0.6 * vnoise(sx / 3, y / 96, 171, 51) + 0.4 * vnoise(sx / 9, y / 160, 57, 52);
      data[k] = Math.round(Math.max(0, Math.min(1, weave)) * 255);
      data[k + 1] = Math.round(Math.max(0, Math.min(1, knit)) * 255);
      data[k + 2] = Math.round(Math.max(0, Math.min(1, grain)) * 255);
      data[k + 3] = Math.round(Math.max(0, Math.min(1, strands)) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  detailTex = tex;
  return tex;
}

// ──────────────────────────────────────────────────────────── uber material

let uber: THREE.MeshStandardMaterial | null = null;

const VERT_PARS = /* glsl */ `
attribute vec3 col2;
attribute vec4 rmd;
attribute vec4 dsel;
attribute vec3 pat;
varying vec3 vCol2;
varying vec4 vRMD;
varying vec4 vDsel;
varying vec3 vPat;
`;

const FRAG_PARS = /* glsl */ `
varying vec3 vCol2;
varying vec4 vRMD;
varying vec4 vDsel;
varying vec3 vPat;
uniform sampler2D bumpMap;
uniform float bumpScale;
float detailH(vec2 uv) { return dot(texture2D(bumpMap, uv), vDsel); }
vec2 dHdxy_fwd() {
  vec2 dSTdx = dFdx(vBumpMapUv);
  vec2 dSTdy = dFdy(vBumpMapUv);
  float s = bumpScale * vRMD.z;
  float Hll = s * detailH(vBumpMapUv);
  float dBx = s * detailH(vBumpMapUv + dSTdx) - Hll;
  float dBy = s * detailH(vBumpMapUv + dSTdy) - Hll;
  return vec2(dBx, dBy);
}
vec3 perturbNormalArb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
float aaStep(float edge, float x) {
  float w = max(fwidth(x), 1e-4) * 0.75;
  return smoothstep(edge - w, edge + w, x);
}
float stripe(float x, float duty) {
  float f = fract(x);
  return aaStep(1.0 - duty, f) ;
}
// pattern mask: type 1 = horizontal stripes, 2 = plaid, 3 = vertical pinstripes, 4 = check, 5 = chevron trim
float patternMask(vec2 uv, float type, float freq) {
  if (type < 0.5) return 0.0;
  if (type < 1.5) return stripe(uv.y * freq, 0.5);
  if (type < 2.5) {
    float a = stripe(uv.x * freq, 0.34);
    float b = stripe(uv.y * freq, 0.34);
    float fine = stripe(uv.x * freq * 3.0 + 0.5, 0.12) * 0.5 + stripe(uv.y * freq * 3.0 + 0.5, 0.12) * 0.5;
    return clamp(max(a, b) * 0.75 + a * b * 0.25 + fine * 0.25, 0.0, 1.0);
  }
  if (type < 3.5) return stripe(uv.x * freq, 0.14);
  if (type < 4.5) return abs(stripe(uv.x * freq, 0.5) - stripe(uv.y * freq, 0.5));
  return stripe(uv.x * freq + abs(fract(uv.y * freq) - 0.5) * 2.0, 0.5);
}
`;

export function characterMaterial(): THREE.MeshStandardMaterial {
  if (uber) return uber;
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    metalness: 1,
    vertexColors: true,
    bumpMap: characterDetailTexture(),
    bumpScale: 1,
  });
  m.name = 'character-uber';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <color_pars_vertex>', '#include <color_pars_vertex>\n' + VERT_PARS)
      .replace('#include <color_vertex>', '#include <color_vertex>\n vCol2 = col2; vRMD = rmd; vDsel = dsel; vPat = pat;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <bumpmap_pars_fragment>', FRAG_PARS)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        float dh = detailH(vBumpMapUv);
        vec3 baseCol = vColor.rgb;
        float pm = patternMask(vBumpMapUv, floor(vPat.x + 0.5), vPat.y * 0.25);
        baseCol = mix(baseCol, vCol2, pm);
        baseCol *= 1.0 + (dh - 0.5) * min(vRMD.z * 1.6, 0.55);
        baseCol *= vRMD.w;
        diffuseColor.rgb *= baseCol;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n roughnessFactor = clamp(vRMD.x * (1.0 + (0.5 - dh) * vRMD.z * 0.6), 0.04, 1.0);',
      )
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = vRMD.y;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n totalEmissiveRadiance += baseCol * (vPat.z / 255.0) * 4.0;',
      );
  };
  m.customProgramCacheKey = () => 'reel-isles-character-uber-v1';
  uber = m;
  return m;
}

// ──────────────────────────────────────────────────────────── builder

export interface SurfaceProps {
  color: THREE.ColorRepresentation;
  /** optional per-vertex colour override: (local pos in model space, normal) → writes into out */
  colorFn?: (p: THREE.Vector3, n: THREE.Vector3, out: THREE.Color) => void;
  color2?: THREE.ColorRepresentation;
  /** 0 none, 1 h-stripes, 2 plaid, 3 pinstripe, 4 check, 5 chevron */
  pattern?: number;
  /** stripes per UV unit ×4 (uv unit = 10 cm): freq 4 = one stripe period per 10 cm */
  patFreq?: number;
  rough: number;
  metal?: number;
  /** detail bump strength 0..1 */
  bump?: number;
  /** channel weights [weave, knit, grain, strands] */
  detail?: [number, number, number, number];
  /** ambient occlusion 0..1 (1 = none). Or a function of model-space position. */
  ao?: number | ((p: THREE.Vector3, n: THREE.Vector3) => number);
  emissive?: number;
  /** multiply UVs (bigger = finer detail) */
  uvScale?: number;
}

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _nm = new THREE.Matrix3();

/** Accumulates geometry into one rigidly-skinned buffer (skinIndex = bone, weight 1). */
export class CharBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  col2: number[] = [];
  rmd: number[] = [];
  dsel: number[] = [];
  pat: number[] = [];
  bone: number[] = [];
  idx: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /**
   * Add a geometry. `matrix` maps geometry-local coords into MODEL space (rest pose).
   * `bone` = index of the rigid bone that moves it.
   */
  add(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, bone: number, s: SurfaceProps): void {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const t = geo.attributes.uv;
    _nm.getNormalMatrix(matrix);
    const base = this.vertexCount;
    const col = new THREE.Color(s.color);
    const col2 = new THREE.Color(s.color2 ?? s.color);
    const det = s.detail ?? [1, 0, 0, 0];
    const uvs = s.uvScale ?? 1;
    const emi = Math.round((s.emissive ?? 0) * 255);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      if (n) _n.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
      else _n.set(0, 1, 0);
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      if (t) this.uv.push(t.getX(i) * uvs, t.getY(i) * uvs);
      else this.uv.push(_v.x * 10 * uvs, _v.y * 10 * uvs);
      _c.copy(col);
      if (s.colorFn) s.colorFn(_v, _n, _c);
      this.col.push(_c.r, _c.g, _c.b);
      _c2.copy(col2);
      this.col2.push(_c2.r, _c2.g, _c2.b);
      const ao = typeof s.ao === 'function' ? s.ao(_v, _n) : s.ao ?? 1;
      this.rmd.push(s.rough, s.metal ?? 0, s.bump ?? 0.3, ao);
      this.dsel.push(det[0], det[1], det[2], det[3]);
      this.pat.push(s.pattern ?? 0, Math.round((s.patFreq ?? 4) * 4), emi);
      this.bone.push(bone);
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) this.idx.push(geo.index.getX(i) + base);
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    }
  }

  build(): THREE.BufferGeometry {
    const vc = this.vertexCount;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    const u16 = (arr: number[]) => {
      const a = new Uint16Array(arr.length);
      for (let i = 0; i < arr.length; i++) a[i] = Math.round(Math.max(0, Math.min(1, arr[i])) * 65535);
      return a;
    };
    const u8n = (arr: number[]) => {
      const a = new Uint8Array(arr.length);
      for (let i = 0; i < arr.length; i++) a[i] = Math.round(Math.max(0, Math.min(1, arr[i])) * 255);
      return a;
    };
    g.setAttribute('color', new THREE.BufferAttribute(u16(this.col), 3, true));
    g.setAttribute('col2', new THREE.BufferAttribute(u16(this.col2), 3, true));
    g.setAttribute('rmd', new THREE.BufferAttribute(u8n(this.rmd), 4, true));
    g.setAttribute('dsel', new THREE.BufferAttribute(u8n(this.dsel), 4, true));
    const pat = new Uint8Array(this.pat.length);
    for (let i = 0; i < this.pat.length; i++) pat[i] = Math.max(0, Math.min(255, Math.round(this.pat[i])));
    g.setAttribute('pat', new THREE.BufferAttribute(pat, 3, false));
    const si = new Uint8Array(vc * 4);
    const sw = new Uint8Array(vc * 4);
    for (let i = 0; i < vc; i++) {
      si[i * 4] = this.bone[i];
      sw[i * 4] = 255;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4, false));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4, true));
    g.setIndex(vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    return g;
  }
}
