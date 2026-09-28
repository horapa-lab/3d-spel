// OWNER: fishing/world-state agent. Stub — deterministic UTC clock (improve: weather blend, events, overrides).
import type { EnvState, Season, Weather, WorldClockAPI } from '../../core/types';
import { DAY_CYCLE_MS, SEASON_MS, WORLD_EPOCH } from '../../data/constants';

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function createWorldClock(): WorldClockAPI & { debugSet?(o: { dayProgress?: number; weather?: Weather; event?: string | null; season?: Season }): void } {
  const start = performance.now();
  let debug: { dayProgress?: number; weather?: Weather; event?: string | null; season?: Season } = {};
  const get = (): EnvState => {
    const utcMs = Date.now();
    const t = utcMs - WORLD_EPOCH;
    const dayProgress = debug.dayProgress ?? (t % DAY_CYCLE_MS) / DAY_CYCLE_MS;
    const sunElevation = Math.sin(dayProgress * Math.PI * 2);
    const weather = debug.weather ?? 'clear';
    return {
      utcMs, dayProgress, isNight: dayProgress >= 0.5, sunElevation,
      weather, nextWeather: weather, weatherBlend: 0,
      season: debug.season ?? SEASONS[Math.floor(t / SEASON_MS) % 4],
      event: debug.event ?? null, windDir: 0.6, windStrength: 0.4,
      time: (performance.now() - start) / 1000,
    };
  };
  return {
    get,
    msUntilEvent: () => Infinity,
    msUntilPhaseChange: () => {
      const t = (Date.now() - WORLD_EPOCH) % (DAY_CYCLE_MS / 2);
      return DAY_CYCLE_MS / 2 - t;
    },
    forecast: () => [],
    applyOverride() {},
    update() {},
    debugSet(o) { debug = { ...debug, ...o }; },
  };
}
