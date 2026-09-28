/**
 * Numerical "look" of the environment per weather/event, blended smoothly.
 * Written by the sky each frame (renderState.look), read by the ocean and post.
 */
import type { EnvState, Weather } from '../core/types';

export interface Look {
  /** Wind speed (m/s) driving the wind sea. */
  windSpeed: number;
  windDir: number;
  /** Significant wave height of the wind sea (m). */
  waveHeight: number;
  swellHeight: number;
  swellLength: number;
  /** Horizontal choppiness 0..1. */
  chop: number;
  /** Whitecap coverage bias 0..1. */
  whitecaps: number;
  cloudCover: number;
  cloudDensity: number;
  cloudDark: number;
  /** Exponential fog density (1/m) at sea level. */
  fog: number;
  /** Fog height falloff scale (m). */
  fogHeight: number;
  rain: number;
  lightning: number;
  spray: number;
  /** Fraction of direct sun blocked by clouds. */
  sunDim: number;
  /** Sky desaturation toward grey. */
  desat: number;
  /** Water murkiness (lower clarity, greener). */
  murk: number;
  aurora: number;
  // events
  crimson: number;
  meteors: number;
  golden: number;
  migration: number;
}

type WeatherLook = Omit<Look, 'windDir' | 'crimson' | 'meteors' | 'golden' | 'migration'>;

const W: Record<Weather, WeatherLook> = {
  clear: {
    windSpeed: 3.6, waveHeight: 0.22, swellHeight: 0.5, swellLength: 85, chop: 0.4, whitecaps: 0,
    cloudCover: 0.3, cloudDensity: 0.55, cloudDark: 0.05, fog: 0.00011, fogHeight: 900,
    rain: 0, lightning: 0, spray: 0, sunDim: 0, desat: 0, murk: 0, aurora: 0,
  },
  cloudy: {
    windSpeed: 6.5, waveHeight: 0.6, swellHeight: 0.55, swellLength: 95, chop: 0.55, whitecaps: 0.12,
    cloudCover: 0.74, cloudDensity: 0.85, cloudDark: 0.4, fog: 0.00035, fogHeight: 700,
    rain: 0, lightning: 0, spray: 0, sunDim: 0.55, desat: 0.3, murk: 0.15, aurora: 0,
  },
  rain: {
    windSpeed: 8.5, waveHeight: 0.9, swellHeight: 0.6, swellLength: 100, chop: 0.62, whitecaps: 0.28,
    cloudCover: 0.97, cloudDensity: 1.0, cloudDark: 0.62, fog: 0.0016, fogHeight: 500,
    rain: 0.75, lightning: 0, spray: 0.15, sunDim: 0.86, desat: 0.5, murk: 0.35, aurora: 0,
  },
  fog: {
    windSpeed: 1.8, waveHeight: 0.1, swellHeight: 0.38, swellLength: 110, chop: 0.25, whitecaps: 0,
    cloudCover: 0.6, cloudDensity: 0.7, cloudDark: 0.2, fog: 0.011, fogHeight: 60,
    rain: 0, lightning: 0, spray: 0, sunDim: 0.45, desat: 0.45, murk: 0.2, aurora: 0,
  },
  windy: {
    windSpeed: 13, waveHeight: 1.45, swellHeight: 0.8, swellLength: 115, chop: 0.8, whitecaps: 0.6,
    cloudCover: 0.45, cloudDensity: 0.7, cloudDark: 0.15, fog: 0.00045, fogHeight: 700,
    rain: 0, lightning: 0, spray: 0.55, sunDim: 0.1, desat: 0.1, murk: 0.2, aurora: 0,
  },
  storm: {
    windSpeed: 20, waveHeight: 2.6, swellHeight: 1.4, swellLength: 150, chop: 0.95, whitecaps: 1,
    cloudCover: 1, cloudDensity: 1.25, cloudDark: 0.92, fog: 0.0028, fogHeight: 450,
    rain: 1, lightning: 1, spray: 1, sunDim: 0.96, desat: 0.6, murk: 0.6, aurora: 0,
  },
  aurora: {
    windSpeed: 2.6, waveHeight: 0.15, swellHeight: 0.42, swellLength: 95, chop: 0.3, whitecaps: 0,
    cloudCover: 0.12, cloudDensity: 0.5, cloudDark: 0.1, fog: 0.0001, fogHeight: 900,
    rain: 0, lightning: 0, spray: 0, sunDim: 0, desat: 0, murk: 0, aurora: 1,
  },
};

export function defaultLook(): Look {
  return { ...W.clear, windDir: 0.6, crimson: 0, meteors: 0, golden: 0, migration: 0 };
}

const KEYS = Object.keys(W.clear) as (keyof WeatherLook)[];

/** Target look for the given env (weather blend + wind + events), no temporal smoothing. */
export function targetLook(env: EnvState, out: Look): Look {
  const a = W[env.weather] ?? W.clear;
  const b = W[env.nextWeather] ?? a;
  const t = Math.min(1, Math.max(0, env.weatherBlend || 0));
  for (const k of KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  // Wind strength from the clock modulates the sea state around the weather preset.
  const ws = Math.min(1, Math.max(0, env.windStrength ?? 0.4));
  const wm = 0.78 + 0.55 * ws;
  out.windSpeed *= wm;
  out.waveHeight *= 0.72 + 0.7 * ws;
  out.windDir = env.windDir ?? 0.6;
  out.crimson = env.event === 'crimson_moon' ? 1 : 0;
  out.meteors = env.event === 'meteor_shower' ? 1 : 0;
  out.golden = env.event === 'golden_tide' ? 1 : 0;
  out.migration = env.event === 'great_migration' ? 1 : 0;
  return out;
}

/** Exponential smoothing toward the target (rate in 1/s). Angles wrap. */
export function smoothLook(cur: Look, target: Look, dt: number, rate = 0.6): void {
  const k = 1 - Math.exp(-dt * rate);
  for (const key of Object.keys(target) as (keyof Look)[]) {
    if (key === 'windDir') {
      let d = target.windDir - cur.windDir;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      cur.windDir += d * k;
    } else {
      cur[key] += (target[key] - cur[key]) * k;
    }
  }
}

export function copyLook(dst: Look, src: Look): void {
  Object.assign(dst, src);
}
