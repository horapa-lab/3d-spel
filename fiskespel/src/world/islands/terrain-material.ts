/**
 * Terrain shading: MeshStandardMaterial + injected splat shader.
 * Five procedural layers per biome — sand · cover · dirt · rock · special — chosen per vertex
 * on the CPU (aSplat) and blended per pixel with height-based transitions, triplanar rock,
 * multi-scale noise (no visible tiling), a wet-sand band at the waterline, underwater caustics
 * and bump-perturbed normals.
 */
import * as THREE from 'three';

export interface TerrainPalette {
  sand: [string, string];
  cover: [string, string];
  dirt: [string, string];
  rock: [string, string];
  spec: [string, string];
  /** roughness per layer: sand, cover, dirt, rock, spec */
  rough?: [number, number, number, number, number];
  /** 0 grass, 1 dry grass, 2 jungle, 3 snow, 4 moss/turf */
  coverKind?: number;
  /** 0 granite, 1 sandstone strata, 2 basalt, 3 limestone/pale */
  rockKind?: number;
  /** 0 snow, 1 ash, 2 moss, 3 mud, 4 coral, 5 cobble/plaza */
  specKind?: number;
  /** 0 sand, 1 black sand, 2 mud, 3 shingle */
  sandKind?: number;
}

// ─────────────────────────────────────────────────────────── shared noise texture

let noiseTex: THREE.DataTexture | null = null;

function tileNoise(size: number, period: number, seed: number, x: number, y: number): number {
  // tileable value noise with quintic fade
  const fx = (x / size) * period;
  const fy = (y / size) * period;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const h = (a: number, b: number) => {
    a = ((a % period) + period) % period;
    b = ((b % period) + period) % period;
    let v = Math.imul(a * 374761393 + b * 668265263 + seed * 1442695041, 0x27d4eb2d);
    v = Math.imul(v ^ (v >>> 15), 0x85ebca6b);
    v ^= v >>> 13;
    return (v >>> 0) / 4294967296;
  };
  const u = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
  const v = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
  const a = h(ix, iy);
  const b = h(ix + 1, iy);
  const c = h(ix, iy + 1);
  const d = h(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function tileFbm(size: number, period: number, seed: number, x: number, y: number, oct: number): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  let p = period;
  for (let i = 0; i < oct; i++) {
    s += tileNoise(size, p, seed + i * 13, x, y) * amp;
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return s / norm;
}

function tileWorley(size: number, period: number, seed: number, x: number, y: number): number {
  const fx = (x / size) * period;
  const fy = (y / size) * period;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  let d1 = 9;
  let d2 = 9;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox;
      const cy = iy + oy;
      const wx = ((cx % period) + period) % period;
      const wy = ((cy % period) + period) % period;
      let v = Math.imul(wx * 1619 + wy * 31337 + seed * 6971, 0x5bd1e995);
      v ^= v >>> 13;
      v = Math.imul(v, 0x27d4eb2d);
      const rx = ((v >>> 0) & 1023) / 1023;
      const ry = ((v >>> 10) & 1023) / 1023;
      const dx = cx + rx - fx;
      const dy = cy + ry - fy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
  }
  return Math.min(1, d2 - d1); // cell edges → 0
}

/** 256² RGBA tileable noise: R broad fbm, G mid fbm, B fine fbm, A worley cell-edge distance. */
export function getTerrainNoise(): THREE.DataTexture {
  if (noiseTex) return noiseTex;
  const S = 256;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      data[i] = Math.round(tileFbm(S, 4, 1, x, y, 5) * 255);
      data[i + 1] = Math.round(tileFbm(S, 8, 7, x, y, 4) * 255);
      data[i + 2] = Math.round(tileFbm(S, 16, 3, x, y, 3) * 255);
      data[i + 3] = Math.round(tileWorley(S, 12, 5, x, y) * 255);
    }
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  noiseTex = t;
  return t;
}

/** Shared time uniform for all animated world shaders. */
export const worldTime = { value: 0 };

// ─────────────────────────────────────────────────────────── shader chunks

const VERT_PARS = /* glsl */ `
attribute vec4 aSplat;
attribute vec2 aAux;
varying vec4 vSplat;
varying vec2 vAux;
varying vec3 vWPos;
varying vec3 vWNrm;
`;

const VERT_MAIN = /* glsl */ `
vSplat = aSplat;
vAux = aAux;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNrm = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_PARS = /* glsl */ `
uniform sampler2D uNoise;
uniform vec3 uSandA; uniform vec3 uSandB;
uniform vec3 uCoverA; uniform vec3 uCoverB;
uniform vec3 uDirtA; uniform vec3 uDirtB;
uniform vec3 uRockA; uniform vec3 uRockB;
uniform vec3 uSpecA; uniform vec3 uSpecB;
uniform vec4 uRough; uniform float uRoughSpec;
uniform vec4 uKinds;
uniform float uTime;
varying vec4 vSplat;
varying vec2 vAux;
varying vec3 vWPos;
varying vec3 vWNrm;

vec4 tn(vec2 p) { return texture2D(uNoise, p); }

vec3 terrainPerturb(vec3 surfPos, vec3 surfNorm, float h) {
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1);
  float dhx = dFdx(h);
  float dhy = dFdy(h);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

const FRAG_MAP = /* glsl */ `
vec3 tP = vWPos;
vec3 tN = normalize(vWNrm);
float tDist = length(vViewPosition);
float tNear = 1.0 - smoothstep(30.0, 140.0, tDist);
float tMid = 1.0 - smoothstep(120.0, 600.0, tDist);

// --- shared multi-scale noise (rotated octaves to kill tiling)
vec2 q = tP.xz;
vec2 qr = mat2(0.8, -0.6, 0.6, 0.8) * q;
vec4 nBroad = tn(q * 0.0021 + 0.37);
vec4 nLarge = tn(qr * 0.0117);
vec4 nMid = tn(q * 0.061 + 0.21);
vec4 nFine = tn(qr * 0.43 + 0.5);
vec4 nMicro = tn(q * 2.3);
float macro = nBroad.r * 0.6 + nLarge.g * 0.4;

// --- triplanar rock sampling
vec3 bw = pow(abs(tN), vec3(4.0));
bw /= (bw.x + bw.y + bw.z);
vec4 rX = tn(tP.zy * vec2(0.07, 0.11) + 0.13);
vec4 rY = tn(tP.xz * 0.07);
vec4 rZ = tn(tP.xy * vec2(0.07, 0.11) + 0.71);
vec4 rN = rX * bw.x + rY * bw.y + rZ * bw.z;
vec4 rXf = tn(tP.zy * 0.33);
vec4 rYf = tn(tP.xz * 0.33 + 0.4);
vec4 rZf = tn(tP.xy * 0.33 + 0.2);
vec4 rF = rXf * bw.x + rYf * bw.y + rZf * bw.z;

// ================= layer: SAND
float sandKind = uKinds.w;
float ripple = sin(dot(q, vec2(0.83, 0.55)) * 5.2 + nMid.g * 9.0 + nLarge.r * 6.0) * 0.5 + 0.5;
float grain = nMicro.b;
vec3 cSand = mix(uSandA, uSandB, smoothstep(0.3, 0.75, nLarge.g * 0.7 + nMid.r * 0.3));
cSand *= 0.93 + 0.1 * grain * tNear + 0.06 * (macro - 0.5);
if (sandKind > 0.5 && sandKind < 1.5) { // black sand: glittery basalt grains
  cSand *= 0.85 + 0.35 * step(0.82, nMicro.a) * tNear;
}
if (sandKind > 1.5 && sandKind < 2.5) { // mud: wet dark streaks
  cSand = mix(cSand, uSandA * 0.6, smoothstep(0.45, 0.7, nMid.b));
}
if (sandKind > 2.5) { // shingle pebbles
  float peb = smoothstep(0.05, 0.25, nFine.a);
  cSand = mix(cSand * 0.7, cSand * (0.95 + 0.25 * nMid.b), peb);
}
float hSand = 0.35 + 0.12 * ripple * tNear + 0.08 * grain;

// ================= layer: COVER (grass / snow / jungle floor)
float coverKind = uKinds.x;
float patch = smoothstep(0.32, 0.72, nLarge.r * 0.55 + nMid.g * 0.45);
vec3 cCover = mix(uCoverA, uCoverB, patch);
float blades = nFine.b * 0.6 + nMicro.g * 0.4;
cCover *= 0.86 + 0.26 * blades * mix(0.4, 1.0, tNear);
if (coverKind < 0.5 || (coverKind > 1.5 && coverKind < 2.5)) {
  // clover/flower speckles in lush grass
  float fl = step(0.93, nMicro.r) * tNear * step(nLarge.b, 0.55);
  cCover = mix(cCover, vec3(0.93, 0.9, 0.72), fl * 0.5);
}
if (coverKind > 2.5 && coverKind < 3.5) { // snow cover: soft drifts, blue shadows
  float drift = nLarge.g * 0.6 + nMid.r * 0.4;
  cCover = mix(uCoverB, uCoverA, smoothstep(0.25, 0.7, drift));
  cCover += step(0.97, nMicro.a) * 0.25 * tNear;
}
float hCover = 0.45 + 0.25 * blades;

// ================= layer: DIRT
float peb = 1.0 - smoothstep(0.0, 0.22, nFine.a);
vec3 cDirt = mix(uDirtA, uDirtB, smoothstep(0.3, 0.7, nMid.r * 0.7 + nLarge.b * 0.3));
cDirt = mix(cDirt, cDirt * 1.25 + 0.04, (1.0 - peb) * 0.35 * tNear * step(0.5, nMid.b));
cDirt *= 0.9 + 0.15 * nMicro.r;
float hDirt = 0.3 + 0.35 * (1.0 - peb) * tNear + 0.1 * nMid.b;

// ================= layer: ROCK (triplanar)
float rockKind = uKinds.y;
float crack = smoothstep(0.0, 0.14, rN.a);
float crackF = smoothstep(0.0, 0.2, rF.a);
vec3 cRock = mix(uRockA, uRockB, smoothstep(0.3, 0.7, rN.g * 0.7 + rF.b * 0.3));
float strata = 0.0;
if (rockKind > 0.5 && rockKind < 1.5) { // sandstone strata bands
  float band = fract(tP.y * 0.23 + rN.r * 0.9);
  strata = smoothstep(0.0, 0.08, band) * smoothstep(1.0, 0.85, band);
  cRock = mix(cRock * 0.78, cRock * 1.08, strata);
  cRock = mix(cRock, uRockB * 1.15, smoothstep(0.62, 0.8, fract(tP.y * 0.071 + rN.g * 0.4)) * 0.45);
}
if (rockKind > 1.5 && rockKind < 2.5) { // basalt: dark glassy with column joints
  cRock *= 0.8 + 0.3 * rF.b;
}
if (rockKind > 2.5) { // pale limestone with dark weathering streaks
  cRock = mix(cRock, cRock * 0.72, smoothstep(0.55, 0.8, tn(vec2(tP.x + tP.z, tP.y * 0.12) * 0.09).g) * (1.0 - bw.y));
}
cRock *= mix(0.62, 1.0, crack) * mix(0.8, 1.0, crackF * tNear + (1.0 - tNear));
// lichen / weathered tops on flatter rock
cRock = mix(cRock, cRock * vec3(1.02, 1.04, 0.92), smoothstep(0.55, 0.9, tN.y) * 0.5);
float hRock = 0.55 + 0.3 * rN.g + 0.35 * crack + 0.2 * crackF * tNear + 0.15 * strata;

// ================= layer: SPECIAL
float specKind = uKinds.z;
vec3 cSpec = mix(uSpecA, uSpecB, smoothstep(0.3, 0.7, nMid.g * 0.6 + nLarge.r * 0.4));
float hSpec = 0.5 + 0.2 * nFine.g;
if (specKind < 0.5) { // snow
  cSpec = mix(uSpecB, uSpecA, smoothstep(0.2, 0.75, nLarge.g * 0.5 + nMid.r * 0.5));
  cSpec += step(0.975, nMicro.a) * 0.3 * tNear;
  hSpec = 0.6 + 0.15 * nMid.b;
} else if (specKind < 1.5) { // ash with ember-dark streaks
  cSpec *= 0.8 + 0.35 * nFine.r;
  hSpec = 0.45 + 0.15 * nFine.r;
} else if (specKind < 2.5) { // moss
  cSpec *= 0.8 + 0.4 * nFine.b;
  hSpec = 0.6 + 0.25 * nFine.b;
} else if (specKind < 3.5) { // mud
  cSpec = mix(cSpec, uSpecA * 0.55, smoothstep(0.5, 0.75, nMid.b));
  hSpec = 0.3 + 0.1 * nMid.b;
} else if (specKind < 4.5) { // coral rubble
  float cc = smoothstep(0.05, 0.3, nFine.a);
  cSpec = mix(uSpecB, uSpecA, cc) * (0.85 + 0.3 * nMid.b);
  hSpec = 0.4 + 0.3 * cc;
} else { // cobble plaza
  float cob = smoothstep(0.02, 0.16, tn(q * 0.29).a);
  cSpec = mix(uSpecA * 0.5, mix(uSpecA, uSpecB, tn(q * 0.29 + 0.5).r), cob);
  hSpec = 0.3 + 0.45 * cob;
}

// ================= height-based blend
vec4 sp = clamp(vSplat, 0.0, 1.0);
float wSand = clamp(1.0 - sp.x - sp.y - sp.z - sp.w, 0.0, 1.0);
float bSand = wSand + hSand * 0.5;
float bCover = sp.x + hCover * 0.5;
float bDirt = sp.y + hDirt * 0.5;
float bRock = sp.z + hRock * 0.5;
float bSpec = sp.w + hSpec * 0.5;
float top = max(max(max(bSand, bCover), max(bDirt, bRock)), bSpec) - 0.18;
float kSand = max(bSand - top, 0.0) * step(0.001, wSand);
float kCover = max(bCover - top, 0.0) * step(0.001, sp.x);
float kDirt = max(bDirt - top, 0.0) * step(0.001, sp.y);
float kRock = max(bRock - top, 0.0) * step(0.001, sp.z);
float kSpec = max(bSpec - top, 0.0) * step(0.001, sp.w);
float kSum = kSand + kCover + kDirt + kRock + kSpec + 1e-5;
kSand /= kSum; kCover /= kSum; kDirt /= kSum; kRock /= kSum; kSpec /= kSum;

vec3 tCol = cSand * kSand + cCover * kCover + cDirt * kDirt + cRock * kRock + cSpec * kSpec;
float tRough = uRough.x * kSand + uRough.y * kCover + uRough.z * kDirt + uRough.w * kRock + uRoughSpec * kSpec;
float tBump = hSand * kSand * 0.35 + hCover * kCover * 0.6 + hDirt * kDirt * 0.7 + hRock * kRock * 1.6 + hSpec * kSpec * 0.6;

// macro tint variation + baked AO
tCol *= 0.92 + 0.16 * macro;
float ao = vAux.x;
tCol *= mix(0.55, 1.0, ao);

// --- wet band at the waterline (irregular tide line)
float tide = 0.55 + 0.45 * nLarge.b + 0.15 * sin(uTime * 0.35 + q.x * 0.02);
float wet = (1.0 - smoothstep(tide - 0.25, tide + 0.35, tP.y));
float porous = kSand + kDirt * 0.8 + kSpec * 0.5 + kCover * 0.3 + kRock * 0.35;
tCol *= mix(1.0, 0.58, wet * porous);
tRough = mix(tRough, 0.22, wet * 0.85);
// seabed: slight green-blue cast and caustics
float under = smoothstep(0.0, -1.5, tP.y);
tCol = mix(tCol, tCol * vec3(0.8, 0.95, 0.95), under * 0.6);
float cA = tn(q * 0.09 + vec2(uTime * 0.021, uTime * 0.013)).g;
float cB = tn(qr * 0.083 - vec2(uTime * 0.017, -uTime * 0.019)).g;
float caust = pow(1.0 - abs(cA - cB) * 2.2, 8.0);
tCol += vec3(0.55, 0.75, 0.7) * caust * under * smoothstep(-14.0, -1.0, tP.y) * 0.35;

diffuseColor.rgb *= tCol;
`;

const FRAG_ROUGH = /* glsl */ `
float roughnessFactor = tRough;
`;

const FRAG_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  float bumpAmt = mix(0.018, 0.09, tNear) * tMid;
  normal = terrainPerturb(-vViewPosition, normal, tBump * bumpAmt);
}
`;

export function makeTerrainMaterial(p: TerrainPalette): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const c = (s: string) => new THREE.Color(s);
  const rough = p.rough ?? [0.92, 0.95, 0.96, 0.85, 0.9];
  const uniforms = {
    uNoise: { value: getTerrainNoise() },
    uSandA: { value: c(p.sand[0]) },
    uSandB: { value: c(p.sand[1]) },
    uCoverA: { value: c(p.cover[0]) },
    uCoverB: { value: c(p.cover[1]) },
    uDirtA: { value: c(p.dirt[0]) },
    uDirtB: { value: c(p.dirt[1]) },
    uRockA: { value: c(p.rock[0]) },
    uRockB: { value: c(p.rock[1]) },
    uSpecA: { value: c(p.spec[0]) },
    uSpecB: { value: c(p.spec[1]) },
    uRough: { value: new THREE.Vector4(rough[0], rough[1], rough[2], rough[3]) },
    uRoughSpec: { value: rough[4] },
    uKinds: { value: new THREE.Vector4(p.coverKind ?? 0, p.rockKind ?? 0, p.specKind ?? 0, p.sandKind ?? 0) },
    uTime: worldTime,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <map_fragment>', FRAG_MAP)
      .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', FRAG_NORMAL);
  };
  mat.customProgramCacheKey = () => 'reel-terrain-v1';
  mat.userData.terrainUniforms = uniforms;
  return mat;
}
