/**
 * Test fixtures for economy tests (not a test file itself). OWNER: economy.
 * A fake GameContext with just what createEconomy() touches.
 */
import * as THREE from 'three';
import { EventBus } from '../src/core/events';
import type { EnvState, GameContext, GameEvents, PlatformAPI, WorldAPI } from '../src/core/types';

export interface FakeOpts {
  night?: boolean;
  event?: string | null;
  stored?: Record<string, string>;
  rewardedOk?: boolean;
}

export function fakeCtx(opts: FakeOpts = {}) {
  const events = new EventBus<GameEvents>();
  const store = new Map<string, string>(Object.entries(opts.stored ?? {}));
  const env: EnvState = {
    utcMs: Date.now(),
    dayProgress: opts.night ? 0.75 : 0.25,
    isNight: !!opts.night,
    sunElevation: opts.night ? -1 : 1,
    weather: 'clear',
    nextWeather: 'clear',
    weatherBlend: 0,
    season: 'spring',
    event: opts.event ?? null,
    windDir: 0,
    windStrength: 0,
    time: 0,
  };
  const overrides: unknown[] = [];
  const clock = {
    get: () => ({ ...env }),
    msUntilEvent: () => Infinity,
    msUntilPhaseChange: () => 1000,
    forecast: () => [],
    applyOverride: (o: unknown) => overrides.push(o),
    update() {},
  };
  const counters = { midgame: 0, rewarded: 0, happy: 0, writes: 0 };
  const platform: PlatformAPI = {
    env: 'local',
    loadingStart() {},
    loadingStop() {},
    gameplayStart() {},
    gameplayStop() {},
    happytime() {
      counters.happy++;
    },
    rewarded: async () => {
      counters.rewarded++;
      return opts.rewardedOk ?? true;
    },
    midgame: async () => {
      counters.midgame++;
    },
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => {
      counters.writes++;
      store.set(k, v);
    },
    setItemSync: (k, v) => {
      counters.writes++;
      store.set(k, v);
    },
    username: async () => null,
    adPlaying: () => false,
  };
  const built: string[] = [];
  const registry = {
    register() {},
    has: () => true,
    list: () => [],
    describe: () => '',
    build: (kind: string, id: string) => {
      built.push(`${kind}:${id}`);
      const g = new THREE.Group();
      g.name = `${kind}:${id}`;
      return g;
    },
  };
  // A round island at the origin: land (h = 2) inside r < 70, beach slope to −20 by r = 90.
  const terrainHeight = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    if (r < 70) return 2;
    if (r < 90) return 2 - ((r - 70) / 20) * 22;
    return -20;
  };
  const world = {
    group: new THREE.Group(),
    halfSize: 3000,
    islands: [
      { id: 'driftwood_harbor', name: 'Driftwood Harbor', biome: 'temperate', center: { x: 0, z: 0 }, radius: 80, spawn: new THREE.Vector3(0, 2, 0), boatSpawn: new THREE.Vector3(0, 0, 100) },
    ],
    npcs: [],
    interactables: [] as WorldAPI['interactables'],
    terrainHeight,
    zoneAt: () => 'driftwood_harbor',
    locationAt: () => 'driftwood_harbor',
    collide() {},
    update() {},
  } as unknown as WorldAPI;
  const scene = new THREE.Scene();
  const toasts: { text: string; kind?: string }[] = [];
  events.on('ui:toast', (t) => toasts.push(t));
  const emitted: { type: string; payload: unknown }[] = [];
  const origEmit = events.emit.bind(events);
  (events as unknown as { emit: typeof events.emit }).emit = ((type: keyof GameEvents, payload: never) => {
    emitted.push({ type, payload });
    origEmit(type, payload);
  }) as typeof events.emit;
  const ctx = { events, clock, platform, registry, world, scene } as unknown as GameContext;
  return { ctx, env, store, overrides, counters, built, toasts, emitted, world, scene, platform };
}

/** Deterministic rng for tests. */
export function seqRng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
