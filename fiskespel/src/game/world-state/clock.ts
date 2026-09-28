/**
 * Shared world clock. OWNER: fishing/world-state.
 *
 * Everything is a pure function of UTC time so every player in the world sees the same
 * day/night, weather, season and world events at the same moment — no server needed.
 *
 *   half-cycle h = floor((utc - WORLD_EPOCH) / (DAY_CYCLE_MS / 2))
 *   even h = day, odd h = night
 *   weather(h)  = weighted pick from WEATHERS by hash(h)   (nightOnly weathers only at night)
 *   event(h)    = at most one WORLD_EVENTS entry whose `time` matches, each with its probability
 *   season      = SEASONS[floor((utc - WORLD_EPOCH) / SEASON_MS) % 4]
 *
 * Weather blends smoothly over the last WEATHER_BLEND_MS of a half-cycle (`nextWeather` +
 * `weatherBlend`); the gameplay `weather` switches exactly at the boundary.
 * Totems apply local overrides (`applyOverride`) that expire; a day/night override spins
 * the sun quickly into the target phase and back again when it ends.
 */
import type { EventBus } from '../../core/events';
import type { EnvState, GameEvents, Season, Weather, WorldClockAPI } from '../../core/types';
import { hash01 } from '../../core/rng';
import { DAY_CYCLE_MS, SEASON_MS, WORLD_EPOCH } from '../../data/constants';
import { WEATHERS, WORLD_EVENTS } from '../../data/world';

export const HALF_CYCLE_MS = DAY_CYCLE_MS / 2;
/** Visual cross-fade between two scheduled weathers (end of a half-cycle). */
export const WEATHER_BLEND_MS = 40_000;
/** Cross-fade used when a totem forces a weather (and when it wears off). */
export const OVERRIDE_BLEND_MS = 8_000;
/** Duration of the "sun spin" when a totem flips day/night (and back). */
export const PHASE_SPIN_MS = 5_000;
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const SALT_WEATHER = 0x51a7e1;
const SALT_EVENT = 0x3e7e9a;
const SALT_WIND = 0x0d1a2b;
/** How far ahead msUntilEvent scans (≈ 28 days of half-cycles). */
const EVENT_SCAN = 5040;

/** Base wind strength per weather (0..1). */
export const WIND_BY_WEATHER: Record<Weather, number> = {
  clear: 0.22,
  cloudy: 0.36,
  rain: 0.55,
  fog: 0.1,
  windy: 0.84,
  storm: 0.96,
  aurora: 0.16,
};

// ─────────────────────────────────────────────────────────────── pure schedule helpers

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

export function halfCycleIndex(utcMs: number): number {
  return Math.floor((utcMs - WORLD_EPOCH) / HALF_CYCLE_MS);
}
export function halfCycleStart(h: number): number {
  return WORLD_EPOCH + h * HALF_CYCLE_MS;
}
export function isNightHalf(h: number): boolean {
  return mod(h, 2) === 1;
}
/** Natural day progress 0..1 (0 sunrise, .25 noon, .5 sunset, .75 midnight). */
export function naturalDayProgress(utcMs: number): number {
  return mod(utcMs - WORLD_EPOCH, DAY_CYCLE_MS) / DAY_CYCLE_MS;
}
export function seasonAt(utcMs: number): Season {
  return SEASONS[mod(Math.floor((utcMs - WORLD_EPOCH) / SEASON_MS), 4)];
}

/** Deterministic weather for half-cycle h (same for every player). */
export function weatherForHalf(h: number): Weather {
  const night = isNightHalf(h);
  let total = 0;
  for (const w of WEATHERS) if (night || !w.nightOnly) total += Math.max(0, w.weight);
  let r = hash01(SALT_WEATHER, h) * total;
  let last: Weather = 'clear';
  for (const w of WEATHERS) {
    if (!night && w.nightOnly) continue;
    const wt = Math.max(0, w.weight);
    if (wt <= 0) continue;
    last = w.id;
    r -= wt;
    if (r < 0) return w.id;
  }
  return last;
}

/** Deterministic world event for half-cycle h, or null. At most one event at a time. */
export function eventForHalf(h: number): string | null {
  const night = isNightHalf(h);
  let total = 0;
  for (const e of WORLD_EVENTS) if (e.time === 'any' || (e.time === 'night') === night) total += Math.max(0, e.probability);
  if (total <= 0) return null;
  const scale = total > 1 ? 1 / total : 1;
  let r = hash01(SALT_EVENT, h);
  for (const e of WORLD_EVENTS) {
    if (!(e.time === 'any' || (e.time === 'night') === night)) continue;
    r -= Math.max(0, e.probability) * scale;
    if (r < 0) return e.id;
  }
  return null;
}

/** Smooth, deterministic wind direction (radians, 0 = +X). */
export function windDirAt(utcMs: number): number {
  const t = (utcMs - WORLD_EPOCH) / 1000;
  const base = hash01(SALT_WIND, Math.floor(t / 86400)) * Math.PI * 2; // new prevailing wind each UTC day
  const next = hash01(SALT_WIND, Math.floor(t / 86400) + 1) * Math.PI * 2;
  let d = next - base;
  d = mod(d + Math.PI, Math.PI * 2) - Math.PI; // shortest way
  const dayFrac = mod(t, 86400) / 86400;
  const drift = d * smooth((dayFrac - 0.9) / 0.1); // turn towards tomorrow's wind in the last 10 % of the day
  return mod(
    base + drift + 0.7 * Math.sin((t / 2220) * Math.PI * 2) + 0.35 * Math.sin((t / 660) * Math.PI * 2 + 1.3) + 0.08 * Math.sin((t / 97) * Math.PI * 2),
    Math.PI * 2,
  );
}

export interface NaturalWeather {
  weather: Weather;
  nextWeather: Weather;
  weatherBlend: number;
}

/** Scheduled weather with the end-of-half-cycle cross-fade. */
export function naturalWeatherAt(utcMs: number): NaturalWeather {
  const h = halfCycleIndex(utcMs);
  const weather = weatherForHalf(h);
  const remain = halfCycleStart(h + 1) - utcMs;
  if (remain <= WEATHER_BLEND_MS) {
    const nextWeather = weatherForHalf(h + 1);
    if (nextWeather !== weather) return { weather, nextWeather, weatherBlend: smooth(1 - remain / WEATHER_BLEND_MS) };
  }
  return { weather, nextWeather: weather, weatherBlend: 0 };
}

/** Wind strength for a (possibly blending) weather state, with a little deterministic gustiness. */
export function windStrengthAt(utcMs: number, w: NaturalWeather): number {
  const a = WIND_BY_WEATHER[w.weather] ?? 0.3;
  const b = WIND_BY_WEATHER[w.nextWeather] ?? 0.3;
  const base = a + (b - a) * w.weatherBlend;
  const h = halfCycleIndex(utcMs);
  const jitter = (hash01(SALT_WIND ^ 0x77, h) - 0.5) * 0.1;
  const t = (utcMs - WORLD_EPOCH) / 1000;
  const gust = 0.1 * Math.sin(t * 0.83) * Math.sin(t * 2.1 + 0.7) + 0.05 * Math.sin(t * 0.21);
  return clamp01(base * (1 + gust) + jitter);
}

/** Pure natural environment at a UTC time (no overrides). `time` is left at 0. */
export function naturalEnvAt(utcMs: number): EnvState {
  const dayProgress = naturalDayProgress(utcMs);
  const w = naturalWeatherAt(utcMs);
  return {
    utcMs,
    dayProgress,
    isNight: dayProgress >= 0.5,
    sunElevation: Math.sin(dayProgress * Math.PI * 2),
    weather: w.weather,
    nextWeather: w.nextWeather,
    weatherBlend: w.weatherBlend,
    season: seasonAt(utcMs),
    event: eventForHalf(halfCycleIndex(utcMs)),
    windDir: windDirAt(utcMs),
    windStrength: windStrengthAt(utcMs, w),
    time: 0,
  };
}

/** Move forward from a to b on the 0..1 circle (short way if the gap is small, else forward). */
function spinLerp(a: number, b: number, s: number): number {
  let d = mod(b - a, 1);
  if (d > 0.75) d -= 1; // small backwards correction instead of a full lap
  return mod(a + d * s, 1);
}

// ─────────────────────────────────────────────────────────────── the clock

interface WeatherOverride {
  value: Weather;
  from: Weather;
  start: number;
  end: number;
}
interface PhaseOverride {
  night: boolean;
  fromProgress: number;
  /** Position inside the target half where the forced phase starts (0..0.5). */
  a: number;
  start: number;
  end: number;
}
interface EventOverride {
  value: string;
  start: number;
  end: number;
}

export interface DebugEnv {
  dayProgress?: number;
  weather?: Weather;
  event?: string | null;
  season?: Season;
}

export type WorldClock = WorldClockAPI & {
  debugSet(o: DebugEnv): void;
  /** Currently active local overrides (for a HUD timer). */
  overrides(): { weather?: { value: Weather; endsAt: number }; isNight?: { value: boolean; endsAt: number }; event?: { value: string; endsAt: number } };
};

/**
 * @param now   UTC ms source (tests inject a fake clock).
 * @param perf  monotonic ms source for EnvState.time.
 */
export function createWorldClock(now: () => number = () => Date.now(), perf: () => number = () => performance.now()): WorldClock {
  const t0 = perf();
  let debug: DebugEnv = {};
  let wOv: WeatherOverride | null = null;
  let pOv: PhaseOverride | null = null;
  let eOv: EventOverride | null = null;
  let bus: EventBus<GameEvents> | null = null;
  let last: { weather: Weather; event: string | null; isNight: boolean } | null = null;
  const eventCache = new Map<string, { h: number; at: number }>();

  function phaseProgress(t: number, natural: number): number {
    const o = pOv;
    if (!o || t < o.start || t >= o.end + PHASE_SPIN_MS) return natural;
    const half = o.night ? 0.5 : 0;
    const forced = (tt: number) => half + o.a + (0.42 - o.a) * clamp01((tt - o.start) / Math.max(1, o.end - o.start));
    if (t < o.start + PHASE_SPIN_MS) return spinLerp(o.fromProgress, forced(t), smooth((t - o.start) / PHASE_SPIN_MS));
    if (t < o.end) return forced(t);
    return spinLerp(forced(o.end), natural, smooth((t - o.end) / PHASE_SPIN_MS));
  }

  function weatherState(t: number): NaturalWeather {
    const nat = naturalWeatherAt(t);
    const o = wOv;
    if (!o || t < o.start || t >= o.end) return nat;
    if (t < o.start + OVERRIDE_BLEND_MS) {
      return o.from === o.value
        ? { weather: o.value, nextWeather: o.value, weatherBlend: 0 }
        : { weather: o.from, nextWeather: o.value, weatherBlend: smooth((t - o.start) / OVERRIDE_BLEND_MS) };
    }
    if (t >= o.end - OVERRIDE_BLEND_MS) {
      const after = naturalWeatherAt(o.end).weather;
      if (after !== o.value) return { weather: o.value, nextWeather: after, weatherBlend: smooth(1 - (o.end - t) / OVERRIDE_BLEND_MS) };
    }
    return { weather: o.value, nextWeather: o.value, weatherBlend: 0 };
  }

  function compute(t: number): EnvState {
    const natural = naturalDayProgress(t);
    let dayProgress = debug.dayProgress !== undefined ? mod(debug.dayProgress, 1) : phaseProgress(t, natural);
    if (!Number.isFinite(dayProgress)) dayProgress = natural;
    let w = weatherState(t);
    if (debug.weather) w = { weather: debug.weather, nextWeather: debug.weather, weatherBlend: 0 };
    let event = eventForHalf(halfCycleIndex(t));
    if (eOv && t >= eOv.start && t < eOv.end) event = eOv.value;
    if (debug.event !== undefined) event = debug.event;
    return {
      utcMs: t,
      dayProgress,
      isNight: dayProgress >= 0.5,
      sunElevation: Math.sin(dayProgress * Math.PI * 2),
      weather: w.weather,
      nextWeather: w.nextWeather,
      weatherBlend: w.weatherBlend,
      season: debug.season ?? seasonAt(t),
      event,
      windDir: windDirAt(t),
      windStrength: windStrengthAt(t, w),
      time: (perf() - t0) / 1000,
    };
  }

  let cacheT = NaN;
  let cache: EnvState | null = null;
  const get = (): EnvState => {
    const t = now();
    if (t !== cacheT || !cache) {
      cache = compute(t);
      cacheT = t;
    } else cache.time = (perf() - t0) / 1000;
    return { ...cache };
  };
  const invalidate = () => {
    cacheT = NaN;
  };

  function nextOccurrence(eventId: string, h0: number): number {
    const c = eventCache.get(eventId);
    if (c && c.h === h0) return c.at;
    let at = Infinity;
    for (let h = h0 + 1; h <= h0 + EVENT_SCAN; h++) {
      if (eventForHalf(h) === eventId) {
        at = halfCycleStart(h);
        break;
      }
    }
    eventCache.set(eventId, { h: h0, at });
    return at;
  }

  const clock: WorldClock = {
    get,
    msUntilEvent(eventId) {
      const t = now();
      if (get().event === eventId) return 0;
      if (!WORLD_EVENTS.some((e) => e.id === eventId)) return Infinity;
      const at = nextOccurrence(eventId, halfCycleIndex(t));
      return at === Infinity ? Infinity : Math.max(0, at - t);
    },
    msUntilPhaseChange() {
      const t = now();
      const naturalNext = halfCycleStart(halfCycleIndex(t) + 1) - t;
      const o = pOv;
      if (!o || t >= o.end + PHASE_SPIN_MS) return naturalNext;
      const natNightAtEnd = naturalDayProgress(o.end) >= 0.5;
      if (natNightAtEnd !== o.night) return Math.max(0, o.end + PHASE_SPIN_MS / 2 - t);
      return Math.max(0, halfCycleStart(halfCycleIndex(o.end) + 1) - t);
    },
    forecast(count) {
      const t = now();
      const h0 = halfCycleIndex(t);
      const out: { startsInMs: number; isNight: boolean; weather: Weather; event: string | null }[] = [];
      for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
        const h = h0 + i;
        out.push({ startsInMs: i === 0 ? 0 : halfCycleStart(h) - t, isNight: isNightHalf(h), weather: weatherForHalf(h), event: eventForHalf(h) });
      }
      return out;
    },
    applyOverride(o) {
      const t = now();
      const cur = compute(t);
      const dur = Math.max(0, o.durationMs || 0);
      if (dur <= 0) return;
      const end = t + dur;
      if (o.weather != null) wOv = { value: o.weather, from: cur.weather, start: t, end };
      if (o.isNight != null) {
        const inTarget = cur.isNight === o.isNight;
        const pos = cur.dayProgress - (cur.isNight ? 0.5 : 0);
        const a = inTarget ? Math.min(0.4, Math.max(0.08, pos)) : 0.08;
        pOv = { night: o.isNight, fromProgress: cur.dayProgress, a, start: t, end };
      }
      if (o.event != null) eOv = { value: o.event, start: t, end };
      invalidate();
    },
    update() {
      const t = now();
      if (wOv && t >= wOv.end) wOv = null;
      if (pOv && t >= pOv.end + PHASE_SPIN_MS) pOv = null;
      if (eOv && t >= eOv.end) eOv = null;
      if (!bus) return;
      const env = get();
      if (!last) {
        last = { weather: env.weather, event: env.event, isNight: env.isNight };
        return;
      }
      if (env.weather !== last.weather) {
        last.weather = env.weather;
        bus.emit('env:weather', { weather: env.weather });
      }
      if (env.event !== last.event) {
        last.event = env.event;
        bus.emit('env:event', { event: env.event });
      }
      if (env.isNight !== last.isNight) {
        last.isNight = env.isNight;
        bus.emit('env:phase', { isNight: env.isNight });
      }
    },
    attach(events) {
      bus = events;
      const env = get();
      last = { weather: env.weather, event: env.event, isNight: env.isNight };
    },
    debugSet(o) {
      debug = { ...debug, ...o };
      invalidate();
    },
    overrides() {
      const t = now();
      return {
        ...(wOv && t < wOv.end ? { weather: { value: wOv.value, endsAt: wOv.end } } : {}),
        ...(pOv && t < pOv.end ? { isNight: { value: pOv.night, endsAt: pOv.end } } : {}),
        ...(eOv && t < eOv.end ? { event: { value: eOv.value, endsAt: eOv.end } } : {}),
      };
    },
  };
  return clock;
}
