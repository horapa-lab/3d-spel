/**
 * Gerstner (trochoidal) wave set drawn from a Pierson–Moskowitz-like wind spectrum + swell.
 * Wavelengths/directions are FIXED per slot (so phases stay continuous); only amplitudes follow
 * the weather. The same sum runs on the GPU (vertex shader) and the CPU (heightAt / normalAt),
 * both driven by env.time and the same per-distance LOD weights.
 */
import type { Look } from '../../render/look';

export const MAX_WAVES = 24;
const G = 9.81;

export interface WaveSet {
  count: number;
  /** per wave: dirX, dirZ, k, omega */
  a: Float32Array;
  /** per wave: amplitude, chop (Q), phase0, wavelength */
  b: Float32Array;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Slot {
  lambda: number;
  dirOffset: number;
  phase: number;
  swell: boolean;
}

export function createWaveSet(count: number, baseDir: number): { set: WaveSet; slots: Slot[]; baseDir: number } {
  const r = rng(1337);
  const slots: Slot[] = [];
  const nSwell = 3;
  const swellL = [132, 97, 71];
  const swellD = [0.0, 0.16, -0.21];
  for (let i = 0; i < nSwell; i++) slots.push({ lambda: swellL[i], dirOffset: swellD[i], phase: r() * Math.PI * 2, swell: true });
  const nWind = count - nSwell;
  const lMin = 2.6;
  const lMax = 190;
  for (let i = 0; i < nWind; i++) {
    const f = (i + 0.25 + 0.5 * r()) / nWind;
    const lambda = lMax * Math.pow(lMin / lMax, f);
    const spread = 0.35 + 0.75 * f; // short waves spread wider
    const side = i % 2 === 0 ? 1 : -1;
    const dirOffset = side * spread * (0.15 + 0.85 * r());
    slots.push({ lambda, dirOffset, phase: r() * Math.PI * 2, swell: false });
  }
  const set: WaveSet = { count, a: new Float32Array(MAX_WAVES * 4), b: new Float32Array(MAX_WAVES * 4) };
  for (let i = 0; i < count; i++) {
    const s = slots[i];
    const k = (2 * Math.PI) / s.lambda;
    const d = baseDir + s.dirOffset + (s.swell ? 0.7 : 0);
    set.a[i * 4] = Math.cos(d);
    set.a[i * 4 + 1] = Math.sin(d);
    set.a[i * 4 + 2] = k;
    set.a[i * 4 + 3] = Math.sqrt(G * k);
    set.b[i * 4 + 2] = s.phase;
    set.b[i * 4 + 3] = s.lambda;
  }
  return { set, slots, baseDir };
}

/** Update amplitudes / chop from the look (called every frame, cheap). */
export function updateAmplitudes(ws: { set: WaveSet; slots: Slot[]; baseDir: number }, look: Look): void {
  const { set, slots } = ws;
  const U = Math.max(0.5, look.windSpeed);
  const lp = 0.877 * U * U; // peak wavelength of a developed sea
  let eWind = 0;
  let eSwell = 0;
  const e = new Float32Array(set.count);
  for (let i = 0; i < set.count; i++) {
    const s = slots[i];
    if (s.swell) {
      const x = Math.log(s.lambda / Math.max(40, look.swellLength));
      e[i] = Math.exp(-x * x / 0.18) + 0.15;
      eSwell += e[i];
    } else {
      const x = s.lambda / lp;
      let en = x * x * Math.exp(-1.25 * x * x);
      // keep a small high-frequency tail so the surface is never glassy-flat
      en += 0.004 * Math.min(1, 12 / s.lambda);
      // directional spreading relative to the current wind
      const d = ws.baseDir + s.dirOffset - look.windDir;
      const c = Math.cos(d);
      en *= 0.12 + 0.88 * Math.max(0, c) * Math.max(0, c);
      e[i] = en;
      eWind += en;
    }
  }
  // significant wave height Hs = 4 * sqrt(sum a^2 / 2)
  const targetW = (look.waveHeight / 4) ** 2 * 2;
  const targetS = (look.swellHeight / 4) ** 2 * 2;
  let steep = 0;
  for (let i = 0; i < set.count; i++) {
    const s = slots[i];
    const tot = s.swell ? eSwell : eWind;
    const target = s.swell ? targetS : targetW;
    const a2 = tot > 0 ? (e[i] / tot) * target : 0;
    let amp = Math.sqrt(a2);
    const k = set.a[i * 4 + 2];
    // physical steepness limit
    amp = Math.min(amp, 0.11 / k);
    set.b[i * 4] = amp;
    steep += amp * k;
  }
  const chop = (0.35 + 0.9 * look.chop);
  const qScale = steep > 0 ? Math.min(chop, 0.92 / steep) : chop;
  for (let i = 0; i < set.count; i++) set.b[i * 4 + 1] = qScale;
}

/** LOD weight of a wave of wavelength `lambda` at vertex spacing `spacing` (matches GLSL). */
export function lodWeight(lambda: number, spacing: number): number {
  const r = lambda / Math.max(spacing, 1e-3);
  const t = Math.min(1, Math.max(0, (r - 3) / 3));
  return t * t * (3 - 2 * t);
}

export const WAVES_GLSL = /* glsl */ `
uniform vec4 uWaveA[${MAX_WAVES}];
uniform vec4 uWaveB[${MAX_WAVES}];
uniform int uWaveCount;
uniform float uWaveTime;
uniform float uSpacingK;
uniform float uSpacingMin;

float waveLod(float lambda, float spacing) {
  float t = clamp((lambda / max(spacing, 1e-3) - 3.0) / 3.0, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Displaced position offset, tangent derivatives and Jacobian of the Gerstner sum.
void gerstner(vec2 p, float spacing, float shore, out vec3 disp, out vec3 dPdx, out vec3 dPdz, out float unresolved) {
  disp = vec3(0.0);
  dPdx = vec3(1.0, 0.0, 0.0);
  dPdz = vec3(0.0, 0.0, 1.0);
  unresolved = 0.0;
  for (int i = 0; i < ${MAX_WAVES}; i++) {
    if (i >= uWaveCount) break;
    vec4 A = uWaveA[i];
    vec4 B = uWaveB[i];
    float lambda = B.w;
    float damp = clamp(shore / (1.5 + 0.03 * lambda), 0.0, 1.0);
    float amp = B.x * damp;
    float w = waveLod(lambda, spacing);
    float ak = amp * A.z;
    unresolved += (1.0 - w) * ak * ak * 0.5;
    amp *= w;
    if (amp <= 0.0) continue;
    float th = A.z * dot(A.xy, p) - A.w * uWaveTime + B.z;
    float s = sin(th);
    float c = cos(th);
    float q = B.y;
    disp.x -= q * amp * A.x * s;
    disp.z -= q * amp * A.y * s;
    disp.y += amp * c;
    float qak = q * amp * A.z;
    dPdx.x -= qak * A.x * A.x * c;
    dPdx.z -= qak * A.x * A.y * c;
    dPdz.x -= qak * A.x * A.y * c;
    dPdz.z -= qak * A.y * A.y * c;
    dPdx.y -= amp * A.z * A.x * s;
    dPdz.y -= amp * A.z * A.y * s;
  }
}
`;

/**
 * CPU mirror: displacement at rest position (x0,z0). Writes [dx, dy, dz, dYdx0, dYdz0, J].
 */
export function evalWaves(set: WaveSet, x0: number, z0: number, t: number, spacing: number, shore: number, out: Float64Array): void {
  let dx = 0;
  let dy = 0;
  let dz = 0;
  let xx = 1;
  let xz = 0;
  let zz = 1;
  let yx = 0;
  let yz = 0;
  for (let i = 0; i < set.count; i++) {
    const ax = set.a[i * 4];
    const az = set.a[i * 4 + 1];
    const k = set.a[i * 4 + 2];
    const om = set.a[i * 4 + 3];
    const lambda = set.b[i * 4 + 3];
    const damp = Math.min(1, Math.max(0, shore / (1.5 + 0.03 * lambda)));
    const amp = set.b[i * 4] * damp * lodWeight(lambda, spacing);
    if (amp <= 0) continue;
    const q = set.b[i * 4 + 1];
    const th = k * (ax * x0 + az * z0) - om * t + set.b[i * 4 + 2];
    const s = Math.sin(th);
    const c = Math.cos(th);
    dx -= q * amp * ax * s;
    dz -= q * amp * az * s;
    dy += amp * c;
    const qak = q * amp * k;
    xx -= qak * ax * ax * c;
    xz -= qak * ax * az * c;
    zz -= qak * az * az * c;
    yx -= amp * k * ax * s;
    yz -= amp * k * az * s;
  }
  out[0] = dx;
  out[1] = dy;
  out[2] = dz;
  // surface normal ~ cross(dPdz, dPdx); expose slopes in displaced space
  const det = xx * zz - xz * xz;
  out[3] = (yx * zz - yz * xz) / (Math.abs(det) > 1e-4 ? det : 1e-4);
  out[4] = (yz * xx - yx * xz) / (Math.abs(det) > 1e-4 ? det : 1e-4);
  out[5] = det;
}
