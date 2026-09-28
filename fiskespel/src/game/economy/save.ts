/**
 * Player save: defaults, versioned migration and sanitising. Pure (no DOM, no THREE).
 * OWNER: economy.
 *
 * Version history
 *  1  lead stub (`newSave()` in the original economy stub).
 *  2  economy v1: decoded treasure maps carry `chest`/`location`; undecoded maps live in `items`;
 *     optional stats counters; `settings`/`spawn` filled; boosts pruned.
 */
import type { BestiaryEntry, Boost, CaughtFish, PlayerSave, QuestState, SizeLabel } from '../../core/types';
import { BACKPACK_START, START_LOCATION, STARTER_BOBBER, STARTER_ROD } from '../../data/constants';

export const SAVE_VERSION = 2;
export const MAX_LEVEL = 150;
/** Hard cap so a corrupted/abused save cannot grow without bound. */
export const BACKPACK_MAX = 400;

export function newSave(now = Date.now()): PlayerSave {
  return {
    version: SAVE_VERSION,
    coins: 0,
    xp: 0,
    level: 1,
    rods: [STARTER_ROD],
    equippedRod: STARTER_ROD,
    rodEnchants: {},
    baits: {},
    equippedBait: null,
    items: {},
    bobbers: [STARTER_BOBBER],
    equippedBobber: STARTER_BOBBER,
    boats: [],
    equippedBoat: null,
    backpack: [],
    backpackSize: BACKPACK_START,
    bestiary: {},
    claimedBestiaryZones: [],
    discovered: [START_LOCATION],
    quests: [],
    questCooldowns: {},
    questCounts: {},
    treasureMaps: [],
    boosts: [],
    stats: {
      catches: 0,
      perfect: 0,
      coinsEarned: 0,
      playSeconds: 0,
      biggestKg: 0,
      rarest: null,
      fishSold: 0,
      questsCompleted: 0,
      treasuresFound: 0,
      cratesOpened: 0,
      appraisals: 0,
      enchants: 0,
      bestiaryClaims: 0,
    },
    settings: { music: 0.6, sfx: 0.8, quality: 'auto', autoReelUnlocked: false, showTutorial: true },
    spawn: { location: START_LOCATION },
    lastSeen: now,
  };
}

/** Known content ids, injected so this module stays testable with any data set. */
export interface SaveCatalog {
  rods: Record<string, unknown>;
  baits: Record<string, unknown>;
  items: Record<string, { kind?: string } | undefined>;
  boats: Record<string, unknown>;
  fish: Record<string, unknown>;
  locations: Record<string, unknown>;
  enchants: Record<string, unknown>;
  /** Item id used for undecoded treasure maps (if any). */
  treasureMapId: string | null;
}

// ─────────────────────────────────────────────────────────── small validators

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, def: number, min = -Infinity, max = Infinity): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
};
const int = (v: unknown, def: number, min = -Infinity, max = Infinity): number => Math.round(num(v, def, min, max));
const str = (v: unknown, def: string): string => (typeof v === 'string' && v.length > 0 ? v : def);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0))] : [];
const countMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, n] of Object.entries(v)) {
    const c = int(n, 0, 0, 1e9);
    if (c > 0) out[k] = c;
  }
  return out;
};

const SIZES: SizeLabel[] = ['tiny', 'small', 'normal', 'big', 'giant'];

function sanitizeFish(v: unknown): CaughtFish | null {
  if (!isObj(v)) return null;
  const uid = strOrNull(v.uid);
  const fishId = strOrNull(v.fishId);
  if (!uid || !fishId) return null;
  const size = SIZES.includes(v.size as SizeLabel) ? (v.size as SizeLabel) : 'normal';
  return {
    uid,
    fishId,
    kg: num(v.kg, 0, 0, 1e9),
    mutation: strOrNull(v.mutation),
    attributes: strArr(v.attributes),
    size,
    value: int(v.value, 0, 0, 1e12),
    zone: str(v.zone, START_LOCATION),
    caughtAt: num(v.caughtAt, 0, 0),
    perfect: bool(v.perfect, false),
    odds: num(v.odds, 1, 1),
    ...(v.favorite === true ? { favorite: true } : {}),
  };
}

function sanitizeBestiary(v: unknown): BestiaryEntry | null {
  if (!isObj(v)) return null;
  const caught = int(v.caught, 0, 0, 1e9);
  if (caught <= 0) return null;
  return {
    caught,
    bestKg: num(v.bestKg, 0, 0),
    bestValue: int(v.bestValue, 0, 0),
    mutations: strArr(v.mutations),
    firstCaughtAt: num(v.firstCaughtAt, 0, 0),
  };
}

function sanitizeQuest(v: unknown): QuestState | null {
  if (!isObj(v)) return null;
  const id = strOrNull(v.id);
  const npcId = strOrNull(v.npcId);
  const fishId = strOrNull(v.fishId);
  if (!id || !npcId || !fishId) return null;
  return {
    id,
    npcId,
    fishId,
    rewardCoins: int(v.rewardCoins, 0, 0),
    rewardXp: int(v.rewardXp, 0, 0),
    bonusItem: strOrNull(v.bonusItem),
    ...(typeof v.expiresAt === 'number' ? { expiresAt: v.expiresAt } : {}),
  };
}

function sanitizeBoost(v: unknown, now: number): Boost | null {
  if (!isObj(v)) return null;
  const id = strOrNull(v.id);
  const expiresAt = num(v.expiresAt, 0);
  if (!id || expiresAt <= now) return null;
  const b: Boost = { id, label: str(v.label, id), expiresAt };
  for (const k of ['luckMult', 'lureMult', 'xpMult', 'sellMult', 'mutationMult'] as const) {
    if (typeof v[k] === 'number' && Number.isFinite(v[k]) && (v[k] as number) > 0) b[k] = v[k] as number;
  }
  return b;
}

// ─────────────────────────────────────────────────────────── migration

/** Structural upgrades between versions (raw JSON → raw JSON of the next version). */
function migrateRaw(raw: Record<string, unknown>, catalog: SaveCatalog | null): Record<string, unknown> {
  let v = int(raw.version, 1, 0);
  if (v < 1) v = 1;
  if (v === 1) {
    // v1 → v2: undecoded maps (target null) become items; decoded ones keep their target.
    const maps = Array.isArray(raw.treasureMaps) ? raw.treasureMaps : [];
    const items = isObj(raw.items) ? { ...raw.items } : {};
    const kept: unknown[] = [];
    for (const m of maps) {
      if (isObj(m) && Array.isArray(m.target) && m.target.length === 2) kept.push(m);
      else if (catalog?.treasureMapId) items[catalog.treasureMapId] = int(items[catalog.treasureMapId], 0, 0) + 1;
    }
    raw = { ...raw, treasureMaps: kept, items, version: 2 };
    v = 2;
  }
  // future: if (v === 2) { ...; v = 3 }
  return raw;
}

export interface LoadResult {
  save: PlayerSave;
  /** Version found in the stored data (0 = nothing stored / unreadable). */
  fromVersion: number;
  /** Coins refunded for content that no longer exists (unknown fish sold). */
  refunded: number;
  notes: string[];
}

/**
 * Parse + migrate + sanitise a stored save. Never throws; returns a fresh save for garbage input.
 * `catalog` (known ids) prunes content that no longer exists; pass null to keep everything.
 */
export function loadSave(json: string | null | undefined, catalog: SaveCatalog | null, now = Date.now()): LoadResult {
  const notes: string[] = [];
  if (!json) return { save: newSave(now), fromVersion: 0, refunded: 0, notes: ['no save'] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { save: newSave(now), fromVersion: 0, refunded: 0, notes: ['unparseable save'] };
  }
  if (!isObj(parsed)) return { save: newSave(now), fromVersion: 0, refunded: 0, notes: ['invalid save'] };
  const fromVersion = int(parsed.version, 1, 0);
  const raw = migrateRaw(parsed, catalog);
  const r = sanitize(raw, catalog, now, notes);
  if (fromVersion !== SAVE_VERSION) notes.push(`migrated v${fromVersion} → v${SAVE_VERSION}`);
  return { save: r.save, fromVersion, refunded: r.refunded, notes };
}

/** Deep-fill + validate every field. */
export function sanitize(
  raw: Record<string, unknown>,
  catalog: SaveCatalog | null,
  now = Date.now(),
  notes: string[] = [],
): { save: PlayerSave; refunded: number } {
  const d = newSave(now);
  const known = (map: keyof Omit<SaveCatalog, 'treasureMapId'>, id: string) => !catalog || id in catalog[map];
  let refunded = 0;

  const s: PlayerSave = d;
  s.version = SAVE_VERSION;
  s.coins = int(raw.coins, 0, 0, 1e13);
  s.level = int(raw.level, 1, 1, MAX_LEVEL);
  s.xp = int(raw.xp, 0, 0, 1e12);

  s.rods = strArr(raw.rods).filter((id) => known('rods', id));
  if (!s.rods.includes(STARTER_ROD)) s.rods.unshift(STARTER_ROD);
  s.equippedRod = str(raw.equippedRod, STARTER_ROD);
  if (!s.rods.includes(s.equippedRod)) s.equippedRod = STARTER_ROD;

  s.rodEnchants = {};
  if (isObj(raw.rodEnchants)) {
    for (const [rod, list] of Object.entries(raw.rodEnchants)) {
      if (!Array.isArray(list) || !known('rods', rod)) continue;
      const slots = list.slice(0, 2).map((e) => (typeof e === 'string' && known('enchants', e) ? e : ''));
      while (slots.length && !slots[slots.length - 1]) slots.pop();
      if (slots.some(Boolean)) s.rodEnchants[rod] = slots;
    }
  }

  s.baits = Object.fromEntries(Object.entries(countMap(raw.baits)).filter(([id]) => known('baits', id)));
  s.equippedBait = strOrNull(raw.equippedBait);
  if (s.equippedBait && !(s.baits[s.equippedBait] > 0)) s.equippedBait = null;

  s.items = Object.fromEntries(Object.entries(countMap(raw.items)).filter(([id]) => known('items', id)));

  s.bobbers = strArr(raw.bobbers).filter((id) => known('items', id) || id === STARTER_BOBBER);
  if (!s.bobbers.includes(STARTER_BOBBER)) s.bobbers.unshift(STARTER_BOBBER);
  s.equippedBobber = str(raw.equippedBobber, STARTER_BOBBER);
  if (!s.bobbers.includes(s.equippedBobber)) s.equippedBobber = STARTER_BOBBER;

  s.boats = strArr(raw.boats).filter((id) => known('boats', id));
  s.equippedBoat = strOrNull(raw.equippedBoat);
  if (s.equippedBoat && !s.boats.includes(s.equippedBoat)) s.equippedBoat = s.boats[0] ?? null;

  const seen = new Set<string>();
  s.backpack = [];
  for (const f of Array.isArray(raw.backpack) ? raw.backpack : []) {
    const c = sanitizeFish(f);
    if (!c || seen.has(c.uid)) continue;
    seen.add(c.uid);
    if (!known('fish', c.fishId)) {
      refunded += c.value; // species removed from the game → auto-sell
      continue;
    }
    s.backpack.push(c);
  }
  if (refunded > 0) notes.push(`refunded ${refunded} coins for removed species`);
  s.coins += refunded;
  s.backpackSize = int(raw.backpackSize, BACKPACK_START, BACKPACK_START, BACKPACK_MAX);
  // Over-full backpacks (e.g. capacity changed) are kept; addCatch just refuses new fish.

  s.bestiary = {};
  if (isObj(raw.bestiary)) {
    for (const [id, e] of Object.entries(raw.bestiary)) {
      if (!known('fish', id)) continue;
      const be = sanitizeBestiary(e);
      if (be) s.bestiary[id] = be;
    }
  }
  s.claimedBestiaryZones = strArr(raw.claimedBestiaryZones);
  s.discovered = strArr(raw.discovered).filter((id) => known('locations', id));
  if (!s.discovered.includes(START_LOCATION)) s.discovered.unshift(START_LOCATION);

  s.quests = (Array.isArray(raw.quests) ? raw.quests : [])
    .map(sanitizeQuest)
    .filter((q): q is QuestState => !!q && known('fish', q.fishId));
  s.questCooldowns = {};
  if (isObj(raw.questCooldowns)) {
    for (const [k, t] of Object.entries(raw.questCooldowns)) {
      const at = num(t, 0);
      if (at > now) s.questCooldowns[k] = at;
    }
  }

  s.questCounts = countMap(raw.questCounts);

  s.treasureMaps = [];
  for (const m of Array.isArray(raw.treasureMaps) ? raw.treasureMaps : []) {
    if (!isObj(m)) continue;
    const id = strOrNull(m.id);
    const t = m.target;
    if (!id || !Array.isArray(t) || t.length !== 2) continue;
    const x = num(t[0], NaN);
    const z = num(t[1], NaN);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const chest = strOrNull(m.chest);
    s.treasureMaps.push({
      id,
      target: [x, z],
      ...(chest && known('items', chest) ? { chest } : {}),
      ...(typeof m.location === 'string' ? { location: m.location } : {}),
    });
  }

  s.boosts = (Array.isArray(raw.boosts) ? raw.boosts : [])
    .map((b) => sanitizeBoost(b, now))
    .filter((b): b is Boost => !!b);

  const st = isObj(raw.stats) ? raw.stats : {};
  s.stats = {
    catches: int(st.catches, 0, 0),
    perfect: int(st.perfect, 0, 0),
    coinsEarned: int(st.coinsEarned, 0, 0),
    playSeconds: num(st.playSeconds, 0, 0),
    biggestKg: num(st.biggestKg, 0, 0),
    rarest: strOrNull(st.rarest),
    fishSold: int(st.fishSold, 0, 0),
    questsCompleted: int(st.questsCompleted, 0, 0),
    treasuresFound: int(st.treasuresFound, 0, 0),
    cratesOpened: int(st.cratesOpened, 0, 0),
    appraisals: int(st.appraisals, 0, 0),
    enchants: int(st.enchants, 0, 0),
    bestiaryClaims: int(st.bestiaryClaims, 0, 0),
  };
  if (s.stats.rarest && !known('fish', s.stats.rarest)) s.stats.rarest = null;

  const se = isObj(raw.settings) ? raw.settings : {};
  const q = se.quality;
  s.settings = {
    music: num(se.music, d.settings.music, 0, 1),
    sfx: num(se.sfx, d.settings.sfx, 0, 1),
    quality: q === 'low' || q === 'medium' || q === 'high' || q === 'ultra' || q === 'auto' ? q : 'auto',
    autoReelUnlocked: bool(se.autoReelUnlocked, false),
    showTutorial: bool(se.showTutorial, true),
  };
  const sp = isObj(raw.spawn) ? raw.spawn : {};
  s.spawn = { location: str(sp.location, START_LOCATION) };
  if (!known('locations', s.spawn.location)) s.spawn.location = START_LOCATION;
  s.lastSeen = num(raw.lastSeen, now, 0);

  // Keep any extra top-level keys other authors may have added (forward compatible).
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in s)) (s as unknown as Record<string, unknown>)[k] = v;
  }
  return { save: s, refunded };
}

export function serializeSave(s: PlayerSave): string {
  return JSON.stringify(s);
}
