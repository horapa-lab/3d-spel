import { describe, expect, it } from 'vitest';
import {
  createWorldClock,
  eventForHalf,
  halfCycleIndex,
  halfCycleStart,
  HALF_CYCLE_MS,
  isNightHalf,
  naturalEnvAt,
  OVERRIDE_BLEND_MS,
  PHASE_SPIN_MS,
  WEATHER_BLEND_MS,
  weatherForHalf,
  WIND_BY_WEATHER,
} from '../src/game/world-state/clock';
import { DAY_CYCLE_MS, SEASON_MS, WORLD_EPOCH } from '../src/data/constants';
import { WEATHERS, WORLD_EVENTS } from '../src/data/world';
import { EventBus } from '../src/core/events';
import type { GameEvents } from '../src/core/types';

function fakeTime(start: number) {
  const s = { t: start };
  return { s, now: () => s.t, perf: () => s.t - start };
}

describe('world clock — determinism', () => {
  it('two clocks at the same UTC time agree on everything', () => {
    for (const t of [WORLD_EPOCH + 123_456_789, Date.UTC(2026, 8, 28, 13, 37), Date.UTC(2027, 1, 3, 2, 5, 9)]) {
      const a = createWorldClock(() => t, () => 0).get();
      const b = createWorldClock(() => t, () => 0).get();
      expect(a).toEqual(b);
      expect(a).toEqual({ ...naturalEnvAt(t), time: 0 });
    }
  });

  it('half-cycles alternate day / night and match dayProgress', () => {
    const h0 = halfCycleIndex(Date.UTC(2026, 5, 1));
    for (let h = h0; h < h0 + 50; h++) {
      const mid = halfCycleStart(h) + HALF_CYCLE_MS / 2;
      const env = naturalEnvAt(mid);
      expect(env.isNight).toBe(isNightHalf(h));
      expect(env.isNight).toBe(h % 2 === 1);
      expect(env.isNight ? env.sunElevation < 0 : env.sunElevation > 0).toBe(true);
    }
    expect(naturalEnvAt(WORLD_EPOCH).dayProgress).toBe(0);
    expect(naturalEnvAt(WORLD_EPOCH + DAY_CYCLE_MS / 4).dayProgress).toBeCloseTo(0.25);
  });

  it('weather and events are constant within a half-cycle (outside the blend window)', () => {
    const h = halfCycleIndex(Date.UTC(2026, 9, 1)) + 7;
    const start = halfCycleStart(h);
    const w = weatherForHalf(h);
    for (let dt = 0; dt < HALF_CYCLE_MS - WEATHER_BLEND_MS; dt += 17_000) {
      const env = naturalEnvAt(start + dt);
      expect(env.weather).toBe(w);
      expect(env.nextWeather).toBe(w);
      expect(env.weatherBlend).toBe(0);
      expect(env.event).toBe(eventForHalf(h));
    }
  });
});

describe('world clock — distributions', () => {
  const N = 40_000;
  it('day weather follows the WEATHERS weights and never shows night-only weather', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const w = weatherForHalf(i * 2);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    const total = WEATHERS.filter((w) => !w.nightOnly).reduce((s, w) => s + w.weight, 0);
    for (const w of WEATHERS) {
      if (w.nightOnly) expect(counts[w.id] ?? 0).toBe(0);
      else expect((counts[w.id] ?? 0) / N).toBeCloseTo(w.weight / total, 1.6);
    }
  });

  it('night weather includes night-only weather at its weight', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const w = weatherForHalf(i * 2 + 1);
      counts[w] = (counts[w] ?? 0) + 1;
    }
    const total = WEATHERS.reduce((s, w) => s + w.weight, 0);
    for (const w of WEATHERS) expect((counts[w.id] ?? 0) / N).toBeCloseTo(w.weight / total, 1.6);
  });

  it('events happen with their probability, only at their time of day, one at a time', () => {
    const counts: Record<string, number> = {};
    let dayN = 0;
    let nightN = 0;
    for (let h = 0; h < 2 * N; h++) {
      const night = isNightHalf(h);
      if (night) nightN++;
      else dayN++;
      const e = eventForHalf(h);
      if (!e) continue;
      const def = WORLD_EVENTS.find((d) => d.id === e)!;
      expect(def.time === 'any' || (def.time === 'night') === night).toBe(true);
      counts[e] = (counts[e] ?? 0) + 1;
    }
    for (const e of WORLD_EVENTS) {
      const denom = e.time === 'any' ? dayN + nightN : e.time === 'night' ? nightN : dayN;
      expect((counts[e.id] ?? 0) / denom).toBeCloseTo(e.probability, 1.6);
    }
  });

  it('wind is strong in storms / windy weather and light when clear', () => {
    expect(WIND_BY_WEATHER.storm).toBeGreaterThan(0.8);
    expect(WIND_BY_WEATHER.windy).toBeGreaterThan(0.7);
    expect(WIND_BY_WEATHER.clear).toBeLessThan(0.3);
    const sums: Record<string, [number, number]> = {};
    for (let h = 0; h < 4000; h++) {
      const env = naturalEnvAt(halfCycleStart(h) + 60_000);
      expect(env.windStrength).toBeGreaterThanOrEqual(0);
      expect(env.windStrength).toBeLessThanOrEqual(1);
      expect(env.windDir).toBeGreaterThanOrEqual(0);
      expect(env.windDir).toBeLessThan(Math.PI * 2);
      const s = (sums[env.weather] ??= [0, 0]);
      s[0] += env.windStrength;
      s[1]++;
    }
    expect(sums.storm[0] / sums.storm[1]).toBeGreaterThan(sums.clear[0] / sums.clear[1] + 0.5);
  });

  it('wind direction changes smoothly', () => {
    let prev = naturalEnvAt(WORLD_EPOCH + 5e9).windDir;
    for (let i = 1; i < 3000; i++) {
      const d = naturalEnvAt(WORLD_EPOCH + 5e9 + i * 1000).windDir;
      let delta = Math.abs(d - prev);
      delta = Math.min(delta, Math.PI * 2 - delta);
      expect(delta).toBeLessThan(0.02);
      prev = d;
    }
  });
});

describe('world clock — transitions', () => {
  it('weather cross-fades over the last 40 s and switches exactly at the boundary', () => {
    // find a boundary with a real change
    let h = halfCycleIndex(Date.UTC(2026, 3, 1));
    while (weatherForHalf(h) === weatherForHalf(h + 1)) h++;
    const boundary = halfCycleStart(h + 1);
    const before = naturalEnvAt(boundary - WEATHER_BLEND_MS - 1);
    expect(before.weatherBlend).toBe(0);
    let prevBlend = -1;
    for (let dt = WEATHER_BLEND_MS; dt >= 1; dt -= 2500) {
      const env = naturalEnvAt(boundary - dt);
      expect(env.weather).toBe(weatherForHalf(h));
      expect(env.nextWeather).toBe(weatherForHalf(h + 1));
      expect(env.weatherBlend).toBeGreaterThanOrEqual(prevBlend);
      prevBlend = env.weatherBlend;
    }
    expect(naturalEnvAt(boundary - 1).weatherBlend).toBeGreaterThan(0.99);
    const after = naturalEnvAt(boundary);
    expect(after.weather).toBe(weatherForHalf(h + 1));
    expect(after.weatherBlend).toBe(0);
  });

  it('seasons rotate once per UTC day', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 8; d++) {
      const env = naturalEnvAt(WORLD_EPOCH + d * SEASON_MS + 3600_000);
      seen.add(env.season);
      expect(naturalEnvAt(WORLD_EPOCH + d * SEASON_MS + SEASON_MS - 1).season).toBe(env.season);
    }
    expect(seen.size).toBe(4);
    expect(naturalEnvAt(WORLD_EPOCH + 1000).season).toBe('spring');
  });

  it('msUntilPhaseChange lands exactly on the next day/night flip', () => {
    const { s, now, perf } = fakeTime(Date.UTC(2026, 8, 28, 10, 3, 17));
    const clock = createWorldClock(now, perf);
    for (let i = 0; i < 20; i++) {
      const night = clock.get().isNight;
      const ms = clock.msUntilPhaseChange();
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(HALF_CYCLE_MS);
      s.t += ms - 1;
      expect(clock.get().isNight).toBe(night);
      s.t += 1;
      expect(clock.get().isNight).toBe(!night);
      s.t += 12_345;
    }
  });
});

describe('world clock — forecast & event countdowns', () => {
  it('forecast matches what the clock reports when the time comes', () => {
    const { s, now, perf } = fakeTime(Date.UTC(2026, 10, 2, 7, 11, 5));
    const clock = createWorldClock(now, perf);
    const fc = clock.forecast(12);
    expect(fc.length).toBe(12);
    expect(fc[0].startsInMs).toBe(0);
    const t0 = s.t;
    for (let i = 0; i < fc.length; i++) {
      const f = fc[i];
      if (i > 0) expect(f.startsInMs).toBeGreaterThan(fc[i - 1].startsInMs);
      s.t = t0 + f.startsInMs + (i === 0 ? 0 : 1000);
      const env = clock.get();
      expect(env.isNight).toBe(f.isNight);
      expect(env.weather).toBe(f.weather);
      expect(env.event).toBe(f.event);
    }
  });

  it('msUntilEvent points at the first half-cycle hosting the event', () => {
    const { s, now, perf } = fakeTime(Date.UTC(2026, 6, 14, 18, 0, 0));
    const clock = createWorldClock(now, perf);
    for (const e of WORLD_EVENTS) {
      s.t = Date.UTC(2026, 6, 14, 18, 0, 0);
      const ms = clock.msUntilEvent(e.id);
      expect(Number.isFinite(ms)).toBe(true);
      if (ms > 0) {
        // nothing earlier
        for (let h = halfCycleIndex(s.t) + 1; halfCycleStart(h) < s.t + ms; h++) expect(eventForHalf(h)).not.toBe(e.id);
        s.t += ms;
        expect(clock.get().event).toBe(e.id);
        expect(clock.msUntilEvent(e.id)).toBe(0);
      } else {
        expect(clock.get().event).toBe(e.id);
      }
    }
    expect(clock.msUntilEvent('no_such_event')).toBe(Infinity);
  });
});

describe('world clock — overrides, debug and events', () => {
  it('weather totem blends in, holds, then wears off', () => {
    const { s, now, perf } = fakeTime(Date.UTC(2026, 2, 3, 12, 0, 30));
    const clock = createWorldClock(now, perf);
    const natural = clock.get().weather;
    const target = natural === 'storm' ? 'clear' : 'storm';
    clock.applyOverride({ weather: target, durationMs: 120_000 });
    const mid = clock.get();
    expect(mid.nextWeather).toBe(target);
    s.t += OVERRIDE_BLEND_MS + 10;
    expect(clock.get().weather).toBe(target);
    s.t += 60_000;
    expect(clock.get().weather).toBe(target);
    expect(clock.overrides().weather?.value).toBe(target);
    s.t += 60_000;
    clock.update(0);
    expect(clock.get().weather).toBe(naturalEnvAt(s.t).weather);
    expect(clock.overrides().weather).toBeUndefined();
  });

  it('day/night totem spins into the forced phase and back', () => {
    const start = halfCycleStart(halfCycleIndex(Date.UTC(2026, 2, 3, 12)) | 0) + 60_000;
    const { s, now, perf } = fakeTime(start);
    const clock = createWorldClock(now, perf);
    const was = clock.get().isNight;
    clock.applyOverride({ isNight: !was, durationMs: 180_000 });
    s.t += PHASE_SPIN_MS + 1;
    expect(clock.get().isNight).toBe(!was);
    s.t += 100_000;
    expect(clock.get().isNight).toBe(!was);
    // progresses smoothly
    let prev = clock.get().dayProgress;
    for (let i = 0; i < 50; i++) {
      s.t += 1000;
      const p = clock.get().dayProgress;
      expect(Math.abs(p - prev)).toBeLessThan(0.05);
      prev = p;
    }
    s.t = start + 180_000 + PHASE_SPIN_MS + 1;
    clock.update(0);
    expect(clock.get().dayProgress).toBeCloseTo(naturalEnvAt(s.t).dayProgress, 6);
  });

  it('event totem forces an event for its duration', () => {
    const { s, now, perf } = fakeTime(Date.UTC(2026, 4, 5, 3, 0, 0));
    const clock = createWorldClock(now, perf);
    clock.applyOverride({ event: 'crimson_moon', durationMs: 30_000 });
    expect(clock.get().event).toBe('crimson_moon');
    expect(clock.msUntilEvent('crimson_moon')).toBe(0);
    s.t += 30_001;
    expect(clock.get().event).toBe(naturalEnvAt(s.t).event);
  });

  it('debugSet pins values', () => {
    const clock = createWorldClock(() => Date.UTC(2026, 1, 1), () => 0);
    clock.debugSet({ dayProgress: 0.75, weather: 'aurora', event: 'meteor_shower' });
    const env = clock.get();
    expect(env.dayProgress).toBe(0.75);
    expect(env.isNight).toBe(true);
    expect(env.weather).toBe('aurora');
    expect(env.event).toBe('meteor_shower');
  });

  it('attach() emits env:* only on changes', () => {
    let h = halfCycleIndex(Date.UTC(2026, 7, 7));
    while (weatherForHalf(h) === weatherForHalf(h + 1)) h++;
    const { s, now, perf } = fakeTime(halfCycleStart(h + 1) - 5000);
    const clock = createWorldClock(now, perf);
    const bus = new EventBus<GameEvents>();
    const got: string[] = [];
    bus.on('env:weather', (e) => got.push(`w:${e.weather}`));
    bus.on('env:phase', (e) => got.push(`p:${e.isNight}`));
    bus.on('env:event', (e) => got.push(`e:${e.event}`));
    clock.attach!(bus);
    clock.update(0.016);
    expect(got).toEqual([]);
    s.t += 6000;
    clock.update(0.016);
    expect(got).toContain(`w:${weatherForHalf(h + 1)}`);
    expect(got).toContain(`p:${isNightHalf(h + 1)}`);
    const evChanged = eventForHalf(h) !== eventForHalf(h + 1);
    expect(got.some((g) => g.startsWith('e:'))).toBe(evChanged);
    const n = got.length;
    clock.update(0.016);
    expect(got.length).toBe(n);
  });
});
