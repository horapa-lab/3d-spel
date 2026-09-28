/**
 * Pure audio helpers (no DOM, no Web Audio) — unit tested in tests/audio-util.test.ts.
 * OWNER: audio.
 */
import type { Biome, Rarity, Weather } from '../core/types';

// ─────────────────────────────────────────────────────────────── math

export const clamp = (v: number, lo = 0, hi = 1): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f: number): number => 69 + 12 * Math.log2(f / 440);
export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const gainToDb = (g: number): number => (g <= 0 ? -Infinity : 20 * Math.log10(g));
/** Semitones → playback-rate / frequency ratio. */
export const semis = (s: number): number => Math.pow(2, s / 12);

// ─────────────────────────────────────────────────────────────── rng

/** Small, fast, seedable PRNG (mulberry32). */
export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length) % arr.length];
  }
  /** Signed random in [-1, 1). */
  sign(): number {
    return this.next() * 2 - 1;
  }
  /** Index chosen by weight. */
  weighted(weights: readonly number[]): number {
    let sum = 0;
    for (const w of weights) sum += Math.max(0, w);
    if (sum <= 0) return 0;
    let r = this.next() * sum;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i]);
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
  /** Exponentially distributed wait with the given mean (Poisson process). */
  exp(mean: number): number {
    return -Math.log(1 - this.next() * 0.999999) * mean;
  }
}

// ─────────────────────────────────────────────────────────────── volume

/** Accepts 0..1 or 0..100 (settings UIs vary), NaN/undefined → 1. */
export function normalizeVolume(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return clamp(n > 1.0001 ? n / 100 : n);
}

/** Perceptual slider → linear gain (≈ -40 dB at 1 %, 0 dB at 100 %). */
export function volumeToGain(v: unknown): number {
  const x = normalizeVolume(v);
  return x <= 0 ? 0 : x * x;
}

/** Simple inverse-distance attenuation with a reference distance and a hard max. */
export function distanceGain(d: number, ref = 6, rolloff = 1, max = 220): number {
  if (d >= max) return 0;
  const g = ref / (ref + rolloff * Math.max(0, d - ref));
  // fade the last 25 % to exactly zero at max
  const edge = clamp((max - d) / (max * 0.25));
  return clamp(g) * edge;
}

// ─────────────────────────────────────────────────────────────── buffers

/**
 * Makes a sample buffer loop seamlessly by cross-fading its tail over its head.
 * Returns a new array `fade` samples shorter. Equal-power for noise (uncorrelated) material.
 */
export function makeLoopable(data: Float32Array, fade: number, equalPower = true): Float32Array {
  const f = Math.max(1, Math.min(fade | 0, Math.floor(data.length / 2)));
  const len = data.length - f;
  const out = data.slice(0, len);
  for (let i = 0; i < f; i++) {
    const x = i / f;
    const a = equalPower ? Math.sin(x * Math.PI * 0.5) : x; // head weight
    const b = equalPower ? Math.cos(x * Math.PI * 0.5) : 1 - x; // tail weight
    out[i] = data[i] * a + data[len + i] * b;
  }
  return out;
}

export interface AudioStats {
  rms: number;
  peak: number;
  /** Seconds from the first to the last sample above the floor. */
  dur: number;
  start: number;
  end: number;
  /** Largest sample-to-sample jump (click detector). */
  maxStep: number;
}

/** RMS (over the active region), true peak, active duration of a multichannel buffer. */
export function audioStats(channels: Float32Array[], sampleRate: number, floorDb = -50): AudioStats {
  const floor = dbToGain(floorDb);
  let peak = 0;
  let first = -1;
  let last = -1;
  let maxStep = 0;
  const n = channels[0]?.length ?? 0;
  for (const ch of channels) {
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = ch[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      if (a > floor) {
        if (first < 0 || i < first) first = i;
        if (i > last) last = i;
      }
      const st = Math.abs(v - prev);
      if (st > maxStep) maxStep = st;
      prev = v;
    }
  }
  let sum = 0;
  let count = 0;
  if (first >= 0) {
    for (const ch of channels) {
      for (let i = first; i <= last; i++) sum += ch[i] * ch[i];
      count += last - first + 1;
    }
  }
  return {
    rms: count ? Math.sqrt(sum / count) : 0,
    peak,
    start: first < 0 ? 0 : first / sampleRate,
    end: last < 0 ? 0 : last / sampleRate,
    dur: first < 0 ? 0 : (last - first + 1) / sampleRate,
    maxStep,
  };
}

/**
 * Soft-clip transfer curve for a WaveShaper: linear up to `knee`, then a tanh shoulder that
 * never exceeds `ceiling`. Guarantees no hard clipping at the very end of the chain.
 */
export function softClipCurve(n = 4096, knee = 0.72, ceiling = 0.97): Float32Array {
  const c = new Float32Array(n);
  const room = ceiling - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

// ─────────────────────────────────────────────────────────────── game mapping

export const RARITY_TIER: Record<Rarity, number> = {
  trash: 0,
  common: 1,
  uncommon: 2,
  unusual: 3,
  rare: 4,
  legendary: 5,
  mythical: 6,
  exotic: 7,
  secret: 8,
  limited: 6,
};
export const ALL_RARITIES: Rarity[] = ['trash', 'common', 'uncommon', 'unusual', 'rare', 'legendary', 'mythical', 'exotic', 'secret', 'limited'];

export function rarityTier(r: string | null | undefined): number {
  return r && r in RARITY_TIER ? RARITY_TIER[r as Rarity] : 1;
}

/** Seconds the music stays ducked for a catch fanfare of this rarity. */
export function fanfareLength(r: Rarity): number {
  return [1.1, 0.9, 1.2, 1.5, 2.2, 3.0, 3.5, 4.0, 5.6][Math.min(8, rarityTier(r))] + (r === 'limited' ? 0.3 : 0);
}

export type MoodId =
  | 'day'
  | 'night'
  | 'storm'
  | 'crimson'
  | 'meteor'
  | 'golden'
  | 'migration'
  | 'aurora'
  | 'grotto'
  | 'abyss'
  | 'volcano';

export interface MoodEnv {
  isNight: boolean;
  weather: Weather;
  nextWeather?: Weather;
  weatherBlend?: number;
  event: string | null;
}

/** Music mood from the world state. Priority: world event > storm > special location > aurora > day/night. */
export function pickMood(env: MoodEnv, location: string | null): MoodId {
  switch (env.event) {
    case 'crimson_moon':
      return 'crimson';
    case 'meteor_shower':
      return 'meteor';
    case 'golden_tide':
      return 'golden';
    case 'great_migration':
      return 'migration';
  }
  const w = (env.weatherBlend ?? 0) > 0.5 && env.nextWeather ? env.nextWeather : env.weather;
  if (w === 'storm') return 'storm';
  if (location === 'glimmer_grotto') return 'grotto';
  if (location === 'abyssal_trench') return 'abyss';
  if (location === 'ashen_reach' || location === 'ashen_lava') return 'volcano';
  if (env.isNight && w === 'aurora') return 'aurora';
  return env.isNight ? 'night' : 'day';
}

/** Blended amount 0..1 of weather conditions (handles the weather transition). */
export function weatherAmount(env: MoodEnv, weights: Partial<Record<Weather, number>>): number {
  const a = weights[env.weather] ?? 0;
  const b = weights[env.nextWeather ?? env.weather] ?? 0;
  return lerp(a, b, clamp(env.weatherBlend ?? 0));
}

export type Surface = 'grass' | 'sand' | 'wood' | 'stone' | 'snow' | 'mud' | 'water' | 'gravel';
export const SURFACES: Surface[] = ['grass', 'sand', 'wood', 'stone', 'snow', 'mud', 'water', 'gravel'];

/**
 * Footstep surface guess.
 * @param feetY player feet height; @param terrainY terrain height under the player.
 */
export function surfaceFor(biome: Biome | null | undefined, feetY: number, terrainY: number): Surface {
  // standing on something built above the terrain (pier, deck, floor)
  if (feetY - terrainY > 0.35) return biome === 'monolith' || biome === 'grotto' ? 'stone' : 'wood';
  // wading
  if (feetY < 0.08 && terrainY < 0.05) return 'water';
  switch (biome) {
    case 'desert':
    case 'atoll':
      return 'sand';
    case 'tropical':
    case 'pirate':
      return terrainY < 3 ? 'sand' : 'grass';
    case 'snow':
      return 'snow';
    case 'swamp':
      return 'mud';
    case 'rock':
    case 'monolith':
    case 'grotto':
      return 'stone';
    case 'volcanic':
      return 'gravel';
    case 'jungle':
      return 'grass';
    case 'temperate':
    default:
      return terrainY < 1.6 ? 'sand' : 'grass';
  }
}

/** Footsteps per second for a horizontal speed (m/s). 0 when standing. */
export function stepRate(speed: number): number {
  if (speed < 0.6) return 0;
  // walk ≈ 4 m/s → 1.9 steps/s, run ≈ 8 m/s → 2.9 steps/s
  return clamp(1.1 + speed * 0.23, 1.2, 3.4);
}

/** Map an id with an optional rarity suffix: 'catch_rare' → ['catch', 'rare']. */
export function splitRarity(id: string): [string, Rarity | null] {
  const i = id.lastIndexOf('_');
  if (i > 0) {
    const r = id.slice(i + 1);
    if (r in RARITY_TIER) return [id.slice(0, i), r as Rarity];
  }
  return [id, null];
}
