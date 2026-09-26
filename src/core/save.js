// Save game state (versioned JSON).

import { Platform } from './platform.js';

const KEY = 'build-a-gun-army-save-v1';
export const SAVE_VERSION = 1;

export function defaultSettings() {
  return {
    music: 0.5,
    sfx: 0.8,
    quality: 'auto',
    dmgNumbers: true,
    shake: true,
    autoContinue: true,
    flashes: true,
  };
}

export function defaultState() {
  return {
    v: SAVE_VERSION,
    coins: 0,
    wave: 1,
    bestWave: 1,
    waveKills: 0,
    opens: 0,
    pity: 0,
    freeCrates: 1,
    bossCrates: 0,
    up: { firepower: 0, firerate: 0, coins: 0, slots: 0, barricade: 0, crate: 0, vault: 0 },
    guns: [{ t: 'pistol', l: 1, g: 0 }],
    seen: { pistol: 1 },
    viewed: { pistol: 1 },
    stats: { kills: 0, bosses: 0, crates: 0, time: 0, earned: 0, breaches: 0, bossOpened: 0 },
    mastery: {},
    hints: {},
    pityL: 0,
    income: 0,
    last: Date.now(),
    boosts: { luck: 0, coins: 0 },
    boostCd: { luck: 0, coins: 0 },
    tut: 0,
    settings: defaultSettings(),
  };
}

export function loadState() {
  const base = defaultState();
  let raw = null;
  try {
    raw = Platform.getItem(KEY);
  } catch {
    raw = null;
  }
  if (!raw) return { state: base, fresh: true };
  try {
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return { state: base, fresh: true };
    // merge so new fields get defaults
    const merged = { ...base, ...s };
    merged.up = { ...base.up, ...(s.up || {}) };
    merged.stats = { ...base.stats, ...(s.stats || {}) };
    merged.boosts = { ...base.boosts, ...(s.boosts || {}) };
    merged.boostCd = { ...base.boostCd, ...(s.boostCd || {}) };
    merged.settings = { ...base.settings, ...(s.settings || {}) };
    merged.seen = { ...(s.seen || base.seen) };
    merged.mastery = { ...(s.mastery || {}) };
    merged.hints = { ...(s.hints || {}) };
    merged.viewed = { ...(s.viewed || base.viewed) };
    merged.guns = Array.isArray(s.guns) ? s.guns.map((g) => (g && g.t ? { t: g.t, l: g.l || 1, g: g.g ? 1 : 0 } : null)) : base.guns;
    for (const k of ['coins', 'wave', 'bestWave', 'opens', 'pity', 'income']) {
      if (!Number.isFinite(merged[k])) merged[k] = base[k];
    }
    merged.wave = Math.max(1, Math.floor(merged.wave));
    return { state: merged, fresh: false };
  } catch {
    return { state: base, fresh: true };
  }
}

export function saveState(state) {
  state.last = Date.now();
  try {
    Platform.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / blocked: ignore */
  }
}

export function wipeSave() {
  Platform.removeItem(KEY);
}
