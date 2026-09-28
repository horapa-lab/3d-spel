/**
 * Physically based single-scattering atmosphere (Rayleigh + Mie + ozone, with a cheap
 * multiple-scattering term), evaluated on the GPU into a sky-view LUT and mirrored on the CPU
 * for light / fog / ambient colours.  Units: km, radiance per unit solar irradiance.
 */
import * as THREE from 'three';

export const ATMOS_GLSL = /* glsl */ `
#define PI 3.14159265359
const float Rg = 6360.0;
const float Rt = 6460.0;
const vec3 betaR = vec3(5.802, 13.558, 33.1) * 1e-3;
const float betaMs = 3.996e-3;
const float betaMe = 4.40e-3;
const vec3 betaO = vec3(0.650, 1.881, 0.085) * 1e-3;
const float HR = 8.0;
const float HM = 1.2;

vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float d = b * b - c;
  if (d < 0.0) return vec2(-1.0);
  d = sqrt(d);
  return vec2(-b - d, -b + d);
}
vec3 atmDensity(float h) {
  return vec3(exp(-h / HR), exp(-h / HM), max(0.0, 1.0 - abs(h - 25.0) / 15.0));
}
float phaseRay(float mu) { return 3.0 / (16.0 * PI) * (1.0 + mu * mu); }
float phaseMie(float mu, float g) {
  float g2 = g * g;
  return 3.0 / (8.0 * PI) * ((1.0 - g2) * (1.0 + mu * mu)) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5));
}
`;

export const SKY_LUT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uMie;
uniform float uMs;
uniform vec2 uSize;
${ATMOS_GLSL}

vec3 sunTrans(vec3 p, vec3 s) {
  vec2 tg = raySphere(p, s, Rg);
  if (tg.x > 0.0) return vec3(0.0);
  vec2 ta = raySphere(p, s, Rt);
  float dt = ta.y / 6.0;
  vec3 od = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    vec3 q = p + s * ((float(i) + 0.5) * dt);
    od += atmDensity(length(q) - Rg) * dt;
  }
  return exp(-(betaR * od.x + vec3(betaMe * uMie) * od.y + betaO * od.z));
}

vec3 inscatter(vec3 rd, vec3 s) {
  vec3 ro = vec3(0.0, Rg + 0.01, 0.0);
  vec2 ta = raySphere(ro, rd, Rt);
  vec2 tg = raySphere(ro, rd, Rg);
  float tmax = ta.y;
  if (tg.x > 0.0) tmax = min(tmax, tg.x);
  float mu = dot(rd, s);
  float pR = phaseRay(mu);
  float pM = phaseMie(mu, 0.78);
  vec3 L = vec3(0.0);
  vec3 T = vec3(1.0);
  float tPrev = 0.0;
  const int N = 30;
  for (int i = 0; i < N; i++) {
    float f = (float(i) + 1.0) / float(N);
    float t = tmax * f * f;
    float dt = t - tPrev;
    float tm = tPrev + 0.5 * dt;
    tPrev = t;
    vec3 p = ro + rd * tm;
    float h = length(p) - Rg;
    vec3 d = atmDensity(h);
    vec3 ext = betaR * d.x + vec3(betaMe * uMie) * d.y + betaO * d.z;
    vec3 Ts = sunTrans(p, s);
    vec3 sR = betaR * d.x;
    vec3 sM = vec3(betaMs * uMie * d.y);
    // single scattering + isotropic multiple-scattering approximation
    float msLight = uMs * smoothstep(-0.12, 0.25, s.y);
    vec3 S = (sR * pR + sM * pM) * Ts + (sR + sM) * msLight * 0.1 * (0.5 * Ts + 0.5 * vec3(0.55, 0.75, 1.0));
    vec3 segT = exp(-ext * dt);
    L += T * (S - S * segT) / max(ext, vec3(1e-7));
    T *= segT;
  }
  return L;
}

void main() {
  // left half: sun, right half: moon
  float side = step(0.5, vUv.x);
  float ux = fract(vUv.x * 2.0);
  // undo half-texel so each half spans [0,1] exactly at texel centres
  float halfW = uSize.x * 0.5;
  ux = (ux * halfW - 0.5) / (halfW - 1.0);
  float vy = (vUv.y * uSize.y - 0.5) / (uSize.y - 1.0);
  float az = clamp(ux, 0.0, 1.0) * PI;
  float v = clamp(vy, 0.0, 1.0) * 2.0 - 1.0;
  float l = sign(v) * v * v * 0.5 * PI;
  vec3 rd = vec3(cos(l) * cos(az), sin(l), cos(l) * sin(az));
  vec3 L = mix(uSunDir, uMoonDir, side);
  float sy = clamp(L.y, -1.0, 1.0);
  vec3 s = vec3(sqrt(1.0 - sy * sy), sy, 0.0);
  vec3 col = inscatter(rd, s);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** GLSL to sample the LUT (needs uniforms uSkyLut, uSkyLutSize). */
export const SKY_LUT_SAMPLE_GLSL = /* glsl */ `
vec2 skyLutUv(vec3 v, vec3 s, float side) {
  float l = asin(clamp(v.y, -1.0, 1.0));
  float vv = 0.5 + 0.5 * sign(l) * sqrt(abs(l) / (0.5 * PI));
  float lv = length(v.xz);
  float ls = length(s.xz);
  float az = 0.0;
  if (lv > 1e-5 && ls > 1e-5) az = acos(clamp(dot(v.xz / lv, s.xz / ls), -1.0, 1.0));
  float halfW = uSkyLutSize.x * 0.5;
  float u = (az / PI * (halfW - 1.0) + 0.5) / halfW;
  float y = (vv * (uSkyLutSize.y - 1.0) + 0.5) / uSkyLutSize.y;
  return vec2((u + side) * 0.5, y);
}
`;

// ───────────────────────────────────────────────────────────── CPU mirror

const Rg = 6360;
const Rt = 6460;
const BR = [5.802e-3, 13.558e-3, 33.1e-3];
const BMs = 3.996e-3;
const BMe = 4.4e-3;
const BO = [0.65e-3, 1.881e-3, 0.085e-3];

function raySphere(oy: number, dx: number, dy: number, dz: number, r: number): [number, number] {
  // origin (0, oy, 0)
  const b = oy * dy;
  const c = oy * oy - r * r;
  const d = b * b - c;
  if (d < 0) return [-1, -1];
  const s = Math.sqrt(d);
  void dx;
  void dz;
  return [-b - s, -b + s];
}

/** Transmittance from sea level toward direction with sine elevation `sy`. RGB 0..1. */
export function sunTransmittance(sy: number, mie: number, out: THREE.Color): THREE.Color {
  const cy = Math.sqrt(Math.max(0, 1 - sy * sy));
  const oy = Rg + 0.01;
  const tg = raySphere(oy, cy, sy, 0, Rg);
  if (tg[0] > 0) return out.setRGB(0, 0, 0);
  const ta = raySphere(oy, cy, sy, 0, Rt);
  const n = 24;
  const dt = ta[1] / n;
  let odR = 0;
  let odM = 0;
  let odO = 0;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * dt;
    const px = cy * t;
    const py = oy + sy * t;
    const h = Math.sqrt(px * px + py * py) - Rg;
    odR += Math.exp(-h / 8) * dt;
    odM += Math.exp(-h / 1.2) * dt;
    odO += Math.max(0, 1 - Math.abs(h - 25) / 15) * dt;
  }
  return out.setRGB(
    Math.exp(-(BR[0] * odR + BMe * mie * odM + BO[0] * odO)),
    Math.exp(-(BR[1] * odR + BMe * mie * odM + BO[1] * odO)),
    Math.exp(-(BR[2] * odR + BMe * mie * odM + BO[2] * odO)),
  );
}

function phaseR(mu: number) {
  return (3 / (16 * Math.PI)) * (1 + mu * mu);
}
function phaseM(mu: number, g: number) {
  const g2 = g * g;
  return ((3 / (8 * Math.PI)) * ((1 - g2) * (1 + mu * mu))) / ((2 + g2) * Math.pow(Math.max(1 + g2 - 2 * g * mu, 1e-4), 1.5));
}

const _t = new THREE.Color();
/**
 * In-scattered radiance (per unit irradiance) for view direction rd and light direction s.
 * Mirrors SKY_LUT_FRAG (lower sample counts).
 */
export function inscatterCPU(rd: THREE.Vector3, s: THREE.Vector3, mie: number, ms: number, out: THREE.Color): THREE.Color {
  const oy = Rg + 0.01;
  const ta = raySphere(oy, rd.x, rd.y, rd.z, Rt);
  const tg = raySphere(oy, rd.x, rd.y, rd.z, Rg);
  let tmax = ta[1];
  if (tg[0] > 0) tmax = Math.min(tmax, tg[0]);
  const mu = rd.x * s.x + rd.y * s.y + rd.z * s.z;
  const pR = phaseR(mu);
  const pM = phaseM(mu, 0.78);
  let L0 = 0;
  let L1 = 0;
  let L2 = 0;
  let T0 = 1;
  let T1 = 1;
  let T2 = 1;
  let tPrev = 0;
  const N = 16;
  const msLight = ms * THREE.MathUtils.smoothstep(s.y, -0.12, 0.25);
  const msc = [0.55, 0.75, 1.0];
  for (let i = 0; i < N; i++) {
    const f = (i + 1) / N;
    const t = tmax * f * f;
    const dt = t - tPrev;
    const tm = tPrev + 0.5 * dt;
    tPrev = t;
    const px = rd.x * tm;
    const py = oy + rd.y * tm;
    const pz = rd.z * tm;
    const r = Math.sqrt(px * px + py * py + pz * pz);
    const h = r - Rg;
    const dR = Math.exp(-h / 8);
    const dM = Math.exp(-h / 1.2);
    const dO = Math.max(0, 1 - Math.abs(h - 25) / 15);
    // transmittance to light from p: approximate using local elevation of s at p
    const upx = px / r;
    const upy = py / r;
    const upz = pz / r;
    const sy = upx * s.x + upy * s.y + upz * s.z;
    sunTransmittance(sy, mie, _t);
    // correct for altitude: thinner air above p
    const altF = Math.exp(-h / 8);
    const tr = Math.pow(_t.r, altF);
    const tgc = Math.pow(_t.g, altF);
    const tb = Math.pow(_t.b, altF);
    const ts = [tr, tgc, tb];
    const Tn = [T0, T1, T2];
    const out3 = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const ext = BR[c] * dR + BMe * mie * dM + BO[c] * dO;
      const sR = BR[c] * dR;
      const sM = BMs * mie * dM;
      const S = (sR * pR + sM * pM) * ts[c] + (sR + sM) * msLight * 0.1 * (0.5 * ts[c] + 0.5 * msc[c]);
      const segT = Math.exp(-ext * dt);
      out3[c] = (Tn[c] * (S - S * segT)) / Math.max(ext, 1e-7);
      Tn[c] *= segT;
    }
    L0 += out3[0];
    L1 += out3[1];
    L2 += out3[2];
    T0 = Tn[0];
    T1 = Tn[1];
    T2 = Tn[2];
  }
  return out.setRGB(L0, L1, L2);
}
