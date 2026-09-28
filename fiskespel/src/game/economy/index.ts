/**
 * Economy / progression system. OWNER: economy/platform author.
 *
 * Save/load (versioned, debounced, flushed on pagehide), coins, XP + level curve, backpack, selling,
 * shops per NPC, equipment, appraiser, relic enchanting, bestiary rewards, angler quests, treasure
 * maps + chests, consumables (crates, totems, potions, backpack upgrades), boosts + event
 * multipliers, discovery, stats, `interact` routing, midgame ads at natural breaks, rewarded ads.
 *
 * Pure logic lives in the sibling modules (save, progression, shops, quests, bestiary, enchanting,
 * loot, treasure, boosts, fishmath) and is unit-tested in tests/economy-*.test.ts.
 *
 * Debug URL params: ?save=fresh (ignore + never write the stored save), ?coins=N, ?level=N
 * (both only together with save=fresh), ?maps=N (grant N treasure maps, save=fresh only).
 */
import * as THREE from 'three';
import type {
  ActiveEffect,
  BaitDef,
  BestiaryEntry,
  Boost,
  CaughtFish,
  EconomyAPI,
  EnchantDef,
  EnchantResult,
  GameContext,
  Interactable,
  ItemDef,
  LootEntry,
  PanelId,
  PlayerSave,
  QuestState,
  RodDef,
  RodStats,
  ShopEntry,
} from '../../core/types';
import type { Rng } from '../../core/rng';
import { uid } from '../../core/rng';
import { FISH, FISH_BY_ID } from '../../data/fish';
import { RODS, ROD_BY_ID } from '../../data/rods';
import { BAITS, BAIT_BY_ID } from '../../data/baits';
import { ITEMS, ITEM_BY_ID } from '../../data/items';
import { BOATS, BOAT_BY_ID } from '../../data/boats';
import { NPCS, NPC_BY_ID } from '../../data/npcs';
import { LOCATIONS, LOCATION_BY_ID, WORLD_EVENTS } from '../../data/world';
import { RARITIES } from '../../data/rarities';
import { ENCHANT_BY_ID, ENCHANT_SLOT } from '../../data/enchants';
import { SAVE_KEY, STARTER_ROD } from '../../data/constants';
import { BACKPACK_MAX, loadSave, newSave, serializeSave, type LoadResult, type SaveCatalog } from './save';
import { applyXp, AUTO_REEL_LEVEL, discoveryXp, xpForLevel, MAX_LEVEL } from './progression';
import { buildShop, rodForSale, type ShopData } from './shops';
import { generateQuest, QUEST_COOLDOWN_MS } from './quests';
import { claimablePages, completionRods, GLOBAL_PAGE, pageFish, pageProgress, pageReward } from './bestiary';
import { applyEnchantToSlots, collectEffects, effectiveStats, enchantDefs, rollEnchant } from './enchanting';
import { rollLoot, type LootDrop } from './loot';
import { findTreasureSpot, pickChest, TREASURE_DECODE_COST } from './treasure';
import { boostProduct, eventDef, mergeBoost, pruneBoosts } from './boosts';
import { appraiseCostFor, appraiseFish } from './fishmath';

export { newSave, SAVE_VERSION, loadSave } from './save';
export { xpForLevel, totalXpToReach, MAX_LEVEL } from './progression';
export { TREASURE_DECODE_COST } from './treasure';

// ─────────────────────────────────────────────────────────── tuning

const BACKUP_SUFFIX = '.bak';
const LOAD_TIMEOUT_MS = 4000;
const SAVE_DEBOUNCE_MS = 1500;
const SAVE_MAX_DELAY_MS = 10000;
const SAVE_PERIODIC_MS = 30000;
const MIDGAME_GAP_MS = 3 * 60 * 1000;
const MAX_ACTIVE_MAPS = 5;
/** Closing one of these panels is a natural break for a midgame ad. */
const BREAK_PANELS = new Set<PanelId>(['shop', 'dialog', 'bestiary', 'appraiser', 'quest', 'enchant', 'boats']);

type AdKind = 'luck' | 'sell' | 'bait' | 'xp';
const AD_BOOST_MS = 5 * 60 * 1000;
/** luck/xp: offered again once less than this remains (so at most ~15 min can be banked). */
const AD_BANK_MS = 10 * 60 * 1000;
const AD_COOLDOWN_MS: Record<AdKind, number> = { luck: 0, xp: 0, sell: 10 * 60 * 1000, bait: 5 * 60 * 1000 };

/** Coins given instead of a rod the player already owns (loot). */
const DUPLICATE_ROD_REFUND = 0.3;
/** Extra chance per chest to contain an unowned treasure-only rod not listed in any loot table. */
const TREASURE_ROD_CHANCE = 0.04;

type ToastKind = 'info' | 'good' | 'bad' | 'rare';

// ─────────────────────────────────────────────────────────── helpers

function safeParams(): URLSearchParams {
  try {
    return new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  } catch {
    return new URLSearchParams();
  }
}

function makeCatalog(): SaveCatalog {
  const mapItem = ITEMS.find((i) => i.kind === 'treasure_map');
  return {
    rods: ROD_BY_ID,
    baits: BAIT_BY_ID,
    items: ITEM_BY_ID,
    boats: BOAT_BY_ID,
    fish: FISH_BY_ID,
    locations: LOCATION_BY_ID,
    enchants: ENCHANT_BY_ID,
    treasureMapId: mapItem?.id ?? null,
  };
}

function listNames(names: string[], max = 3): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} +${names.length - max} more`;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** First integer in a text (e.g. "Complete 15 quests"), or null. */
function firstInt(s: string): number | null {
  const m = /(\d[\d,]*)/.exec(s);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// ─────────────────────────────────────────────────────────── factory

export async function createEconomy(ctx: GameContext): Promise<EconomyAPI> {
  const { events, platform } = ctx;
  const params = safeParams();
  const ephemeral = params.get('save') === 'fresh' || params.get('save') === 'off';
  const rng: Rng = Math.random;
  const now = () => Date.now();

  // ── load ─────────────────────────────────────────────────────────────
  const catalog = makeCatalog();
  const readKey = async (key: string): Promise<string | null> => {
    try {
      return await Promise.race([
        platform.getItem(key),
        new Promise<null>((r) => setTimeout(() => r(null), LOAD_TIMEOUT_MS)),
      ]);
    } catch {
      return null;
    }
  };
  let loaded: LoadResult = loadSave(null, catalog);
  if (!ephemeral) {
    const raw = await readKey(SAVE_KEY);
    loaded = loadSave(raw, catalog);
    if (raw && loaded.fromVersion === 0) {
      const b = loadSave(await readKey(SAVE_KEY + BACKUP_SUFFIX), catalog);
      if (b.fromVersion > 0) {
        console.warn('[economy] save unreadable — restored the backup copy');
        loaded = b;
      }
    } else if (raw && loaded.fromVersion > 0) {
      // Keep the last known-good save as a backup (once per session).
      platform.setItem(SAVE_KEY + BACKUP_SUFFIX, raw).catch(() => {});
    }
    if (loaded.notes.length && raw) console.info('[economy] save:', loaded.notes.join('; '));
  }
  const save: PlayerSave = loaded.save;
  if (ephemeral) {
    const c = Number(params.get('coins'));
    if (Number.isFinite(c) && c > 0) save.coins = Math.floor(c);
    const l = Number(params.get('level'));
    if (Number.isFinite(l) && l > 1) save.level = Math.min(MAX_LEVEL, Math.floor(l));
    const maps = Number(params.get('maps'));
    if (Number.isFinite(maps) && maps > 0 && catalog.treasureMapId) save.items[catalog.treasureMapId] = Math.floor(maps);
  }

  // ── persistence ──────────────────────────────────────────────────────
  let dirty = false;
  let dirtySince = 0;
  let lastChange = 0;
  let lastSaveAt = now();
  let lastJson = '';

  function markDirty() {
    const t = now();
    if (!dirty) dirtySince = t;
    dirty = true;
    lastChange = t;
  }

  function persist(sync = false) {
    dirty = false;
    lastSaveAt = now();
    if (ephemeral) return;
    save.lastSeen = now();
    let json: string;
    try {
      json = serializeSave(save);
    } catch (err) {
      console.error('[economy] could not serialise save', err);
      return;
    }
    if (json === lastJson) return;
    lastJson = json;
    try {
      if (sync && platform.setItemSync) {
        platform.setItemSync(SAVE_KEY, json);
        events.emit('save:done', {});
      } else {
        platform.setItem(SAVE_KEY, json).then(
          () => events.emit('save:done', {}),
          (err) => console.warn('[economy] save failed', err),
        );
      }
    } catch (err) {
      console.warn('[economy] save failed', err);
    }
  }

  if (typeof document !== 'undefined' && typeof addEventListener !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persist(true);
    });
    addEventListener('pagehide', () => persist(true));
    addEventListener('beforeunload', () => persist(true));
  }

  // ── small utilities ─────────────────────────────────────────────────
  const toast = (text: string, kind: ToastKind = 'info') => events.emit('ui:toast', { text, kind });

  let envEvent: string | null = null;
  let envNight = false;
  const refreshEnv = () => {
    try {
      const e = ctx.clock.get();
      envEvent = e.event;
      envNight = e.isNight;
    } catch {
      /* clock not ready */
    }
  };
  refreshEnv();

  const rodName = (id: string) => ROD_BY_ID[id]?.name ?? id;
  const itemName = (id: string) =>
    ITEM_BY_ID[id]?.name ?? BAIT_BY_ID[id]?.name ?? ROD_BY_ID[id]?.name ?? BOAT_BY_ID[id]?.name ?? id;
  const locName = (id: string) => LOCATION_BY_ID[id]?.name ?? id;

  // ── coins & xp ──────────────────────────────────────────────────────
  function addCoins(amount: number, reason: string) {
    const a = Math.round(amount);
    if (!Number.isFinite(a) || a === 0) return;
    save.coins = Math.max(0, save.coins + a);
    if (a > 0) save.stats.coinsEarned += a;
    events.emit('economy:coins', { delta: a, total: save.coins, reason });
    markDirty();
  }

  function spend(amount: number, reason: string): boolean {
    const a = Math.max(0, Math.round(amount));
    if (!Number.isFinite(a) || save.coins < a) return false;
    if (a === 0) return true;
    save.coins -= a;
    events.emit('economy:coins', { delta: -a, total: save.coins, reason });
    markDirty();
    return true;
  }

  function addXp(amount: number, reason: string) {
    const a = Math.max(0, Math.round(amount));
    if (!Number.isFinite(a) || a === 0) return;
    const r = applyXp(save.level, save.xp, a);
    save.level = r.level;
    save.xp = r.xp;
    events.emit('economy:xp', { delta: a, level: save.level, xp: save.xp });
    if (r.gained.length) onLevelsGained(r.gained);
    markDirty();
    void reason;
  }

  function onLevelsGained(levels: number[]) {
    for (const L of levels) events.emit('level:up', { level: L });
    const from = levels[0];
    const to = levels[levels.length - 1];
    const unlocked: string[] = [];
    for (const r of RODS) {
      if (r.obtain === 'shop' && r.price > 0 && r.unlockLevel >= from && r.unlockLevel <= to) unlocked.push(r.name);
    }
    for (const b of BOATS) if (b.price > 0 && b.unlockLevel >= from && b.unlockLevel <= to) unlocked.push(b.name);
    const granted = ensureLevelGrants(true);
    const areas = LOCATIONS.filter((l) => l.tier >= from && l.tier <= to && l.kind !== 'sub').map((l) => l.name);
    let text = levels.length > 1 ? `Level ${to}! (+${levels.length})` : `Level ${to}!`;
    if (unlocked.length) text += ` New in shops: ${listNames(unlocked)}.`;
    toast(text, 'good');
    if (granted.length) toast(`Level reward: ${listNames(granted)}!`, 'rare');
    if (areas.length) toast(`You are ready for ${listNames(areas, 2)}.`, 'info');
    if (from <= AUTO_REEL_LEVEL && to >= AUTO_REEL_LEVEL) toast('Auto-reel unlocked! Toggle it in the reel HUD.', 'good');
    if (levels.some((l) => l % 10 === 0)) platform.happytime();
  }

  /** Level-gated freebies (obtain:'level' rods, free boats, auto-reel). Returns granted names. */
  function ensureLevelGrants(announce: boolean): string[] {
    const names: string[] = [];
    for (const r of RODS) {
      if (r.obtain === 'level' && r.unlockLevel <= save.level && !save.rods.includes(r.id)) {
        save.rods.push(r.id);
        names.push(r.name);
      }
    }
    for (const b of BOATS) {
      if (!(b.price > 0) && b.unlockLevel <= save.level && !save.boats.includes(b.id)) {
        save.boats.push(b.id);
        if (announce) names.push(b.name);
      }
    }
    if (!save.equippedBoat && save.boats.length) save.equippedBoat = save.boats[0];
    if (save.level >= AUTO_REEL_LEVEL && !save.settings.autoReelUnlocked) save.settings.autoReelUnlocked = true;
    if (names.length) markDirty();
    return names;
  }
  ensureLevelGrants(false);

  // ── gear ────────────────────────────────────────────────────────────
  function equippedRod(): RodDef {
    return ROD_BY_ID[save.equippedRod] ?? ROD_BY_ID[STARTER_ROD] ?? RODS[0];
  }

  function rodEnchants(rodId: string): EnchantDef[] {
    return enchantDefs(save.rodEnchants[rodId]);
  }

  function grantRod(id: string, source: string): boolean {
    const r = ROD_BY_ID[id];
    if (!r || save.rods.includes(id)) return false;
    save.rods.push(id);
    toast(`New rod: ${r.name}!`, 'rare');
    // Auto-equip reward rods that are an upgrade.
    if ((r.tier ?? 0) > (equippedRod().tier ?? 0)) api.equipRod(id);
    markDirty();
    void source;
    return true;
  }

  function grantItem(id: string, qty: number) {
    const q = Math.max(1, Math.floor(Number.isFinite(qty) ? qty : 1));
    if (ROD_BY_ID[id]) {
      grantRod(id, 'grant');
      return;
    }
    if (BAIT_BY_ID[id]) {
      save.baits[id] = (save.baits[id] ?? 0) + q;
      markDirty();
      return;
    }
    if (BOAT_BY_ID[id]) {
      if (!save.boats.includes(id)) save.boats.push(id);
      if (!save.equippedBoat) save.equippedBoat = id;
      markDirty();
      return;
    }
    const it = ITEM_BY_ID[id];
    if (!it) {
      console.warn(`[economy] grantItem: unknown id "${id}"`);
      return;
    }
    if (it.kind === 'bobber') {
      if (!save.bobbers.includes(id)) save.bobbers.push(id);
      markDirty();
      return;
    }
    save.items[id] = (save.items[id] ?? 0) + q;
    if (it.kind === 'treasure_map') toast('You found a treasure map! One-Eyed Rosa at Wreckers’ Cove can read it.', 'rare');
    markDirty();
  }

  // ── multipliers ─────────────────────────────────────────────────────
  const ev = () => eventDef(WORLD_EVENTS, envEvent);
  const luckMultiplier = () => boostProduct(save.boosts, 'luckMult', now()) * (ev()?.effects.luckMult ?? 1);
  const lureMultiplier = () => boostProduct(save.boosts, 'lureMult', now());
  const xpMultiplier = () => boostProduct(save.boosts, 'xpMult', now()) * (ev()?.effects.xpMult ?? 1);
  const sellMultiplier = () => boostProduct(save.boosts, 'sellMult', now());
  const mutationMultiplier = () => boostProduct(save.boosts, 'mutationMult', now());

  function addBoost(b: Boost) {
    if (!b || !b.id || !(b.expiresAt > now())) return;
    save.boosts = mergeBoost(save.boosts, b, now());
    markDirty();
  }

  // ── catches, bestiary, selling ──────────────────────────────────────
  function rarityOrder(fishId: string | null): number {
    const d = fishId ? FISH_BY_ID[fishId] : undefined;
    return d ? RARITIES[d.rarity].order : -1;
  }

  function pageComplete(zone: string): boolean {
    const p = pageProgress(zone, FISH, save.bestiary);
    return p.total > 0 && p.caught >= p.total;
  }

  function addCatch(c: CaughtFish): boolean {
    const def = FISH_BY_ID[c.fishId];
    const st = save.stats;
    st.catches++;
    if (c.perfect) st.perfect++;
    if (c.kg > st.biggestKg) st.biggestKg = c.kg;
    if (def) {
      const cur = st.rarest ? FISH_BY_ID[st.rarest] : undefined;
      const o = RARITIES[def.rarity].order;
      if (!cur || o > RARITIES[cur.rarity].order) st.rarest = c.fishId;
    }
    // Bestiary
    const prev = save.bestiary[c.fishId];
    const zone = def?.zone ?? c.zone;
    const wasComplete = def ? pageComplete(zone) : true;
    const e: BestiaryEntry = prev ?? { caught: 0, bestKg: 0, bestValue: 0, mutations: [], firstCaughtAt: c.caughtAt || now() };
    e.caught++;
    e.bestKg = Math.max(e.bestKg, c.kg);
    e.bestValue = Math.max(e.bestValue, c.value);
    if (c.mutation && !e.mutations.includes(c.mutation)) e.mutations.push(c.mutation);
    save.bestiary[c.fishId] = e;
    if (!prev) {
      events.emit('bestiary:new', { fishId: c.fishId, zone });
      if (def && !wasComplete && pageComplete(zone) && !save.claimedBestiaryZones.includes(zone)) {
        events.emit('bestiary:complete', { zone });
        toast(`${locName(zone)} bestiary page complete! Claim your reward from Archivist Juno.`, 'rare');
      }
    }
    if (def && (RARITIES[def.rarity].order >= RARITIES.legendary.order || def.rarity === 'limited')) platform.happytime();
    markDirty();
    // Backpack
    if (save.backpack.length >= save.backpackSize) {
      toast('Backpack full! Sell fish to make room.', 'bad');
      return false;
    }
    save.backpack.push({ ...c });
    return true;
  }

  function sellable(uids: readonly string[] | null): CaughtFish[] {
    const set = uids ? new Set(uids) : null;
    return save.backpack.filter((f) => !f.favorite && (!set || set.has(f.uid)));
  }

  function sell(uids: string[]): number {
    const set = new Set(uids);
    let total = 0;
    let count = 0;
    const keep: CaughtFish[] = [];
    for (const f of save.backpack) {
      if (set.has(f.uid) && !f.favorite) {
        total += f.value;
        count++;
      } else keep.push(f);
    }
    if (!count) return 0;
    const coins = Math.round(total * sellMultiplier());
    save.backpack.length = 0;
    save.backpack.push(...keep);
    save.stats.fishSold = (save.stats.fishSold ?? 0) + count;
    // The rewarded "double sale" boost is used up by one sale.
    if (save.boosts.some((b) => b.id === 'ad_sell')) save.boosts = save.boosts.filter((b) => b.id !== 'ad_sell');
    addCoins(coins, 'sell');
    return coins;
  }

  // ── shops ───────────────────────────────────────────────────────────
  const shopData: ShopData = { npcs: NPCS, rods: RODS, baits: BAITS, items: ITEMS, boats: BOATS, events: WORLD_EVENTS };

  interface Priced {
    price: number;
    unlockLevel: number;
    unique: boolean;
    owned: boolean;
    name: string;
  }

  function priced(entry: ShopEntry): Priced | null {
    switch (entry.kind) {
      case 'rod': {
        const r = ROD_BY_ID[entry.id];
        if (!r || !rodForSale(r, envEvent, WORLD_EVENTS)) return null;
        return { price: r.price, unlockLevel: r.unlockLevel, unique: true, owned: save.rods.includes(r.id), name: r.name };
      }
      case 'bait': {
        const b = BAIT_BY_ID[entry.id];
        if (!b || b.price === null || !(b.price > 0)) return null;
        return { price: b.price, unlockLevel: 1, unique: false, owned: false, name: b.name };
      }
      case 'bobber':
      case 'item': {
        const it = ITEM_BY_ID[entry.id];
        if (!it || it.price === null || !(it.price > 0)) return null;
        const bob = it.kind === 'bobber';
        return { price: it.price, unlockLevel: it.unlockLevel ?? 1, unique: bob, owned: bob && save.bobbers.includes(it.id), name: it.name };
      }
      case 'boat': {
        const b = BOAT_BY_ID[entry.id];
        if (!b) return null;
        return { price: Math.max(0, b.price), unlockLevel: b.unlockLevel, unique: true, owned: save.boats.includes(b.id), name: b.name };
      }
    }
    return null;
  }

  function buyCheck(entry: ShopEntry, qty = 1): { ok: boolean; reason?: string } {
    const p = priced(entry);
    if (!p) return { ok: false, reason: 'Not for sale.' };
    const q = Math.floor(qty);
    if (!(q >= 1 && q <= 999)) return { ok: false, reason: 'Invalid amount.' };
    if (p.unique && p.owned) return { ok: false, reason: 'Already owned.' };
    if (p.unique && q !== 1) return { ok: false, reason: 'Only one can be owned.' };
    if (save.level < p.unlockLevel) return { ok: false, reason: `Reach level ${p.unlockLevel} first.` };
    if (save.coins < p.price * q) return { ok: false, reason: `Not enough coins (${fmt(p.price * q)} needed).` };
    return { ok: true };
  }

  function buy(entry: ShopEntry, qty = 1): boolean {
    const q = Math.max(1, Math.floor(qty || 1));
    const check = buyCheck(entry, q);
    const p = priced(entry);
    if (!check.ok || !p) {
      toast(check.reason ?? 'Cannot buy that.', 'bad');
      return false;
    }
    if (!spend(p.price * q, `buy:${entry.kind}`)) return false;
    switch (entry.kind) {
      case 'rod':
        save.rods.push(entry.id);
        api.equipRod(entry.id);
        break;
      case 'bait':
        save.baits[entry.id] = (save.baits[entry.id] ?? 0) + q;
        if (!save.equippedBait) api.equipBait(entry.id);
        break;
      case 'bobber':
        if (!save.bobbers.includes(entry.id)) save.bobbers.push(entry.id);
        api.equipBobber(entry.id);
        break;
      case 'boat':
        if (!save.boats.includes(entry.id)) save.boats.push(entry.id);
        api.equipBoat(entry.id);
        break;
      case 'item': {
        save.items[entry.id] = (save.items[entry.id] ?? 0) + q;
        // Backpack upgrades apply straight away.
        if (ITEM_BY_ID[entry.id]?.backpack) for (let i = 0; i < q; i++) api.useItem(entry.id);
        break;
      }
    }
    events.emit('shop:buy', { kind: entry.kind, id: entry.id });
    toast(q > 1 ? `Bought ${q}× ${p.name}.` : `Bought ${p.name}!`, 'good');
    markDirty();
    return true;
  }

  // ── loot ────────────────────────────────────────────────────────────
  const referencedRods = new Set<string>();
  for (const it of ITEMS) for (const e of it.loot?.table ?? []) if (e.kind === 'rod' && e.id) referencedRods.add(e.id);

  function fallbackCrateTable(): LootEntry[] {
    const priced = BAITS.filter((b) => b.price !== null && b.price > 0);
    return priced.map((b) => ({ kind: 'bait', id: b.id, min: 2, max: 5, weight: 1 / Math.sqrt(b.price ?? 10) }));
  }

  function fallbackChestTable(tier: number): LootEntry[] {
    const c = Math.round(150 * Math.pow(1 + tier, 1.3));
    const t: LootEntry[] = [{ kind: 'coins', min: c, max: c * 3, weight: 10 }];
    for (const it of ITEMS) if (it.kind === 'relic') t.push({ kind: 'item', id: it.id, min: 1, max: 1, weight: 2 });
    for (const it of ITEMS) if (it.kind === 'bait_crate') t.push({ kind: 'item', id: it.id, min: 1, max: 2, weight: 3 });
    return t;
  }

  /** Apply loot; returns what the player actually received (duplicate rods → coins). */
  function applyLoot(drops: LootDrop[], source: string): { kind: string; id?: string; amount: number }[] {
    const out: { kind: string; id?: string; amount: number }[] = [];
    for (const d of drops) {
      switch (d.kind) {
        case 'coins':
          addCoins(d.amount, source);
          out.push({ kind: 'coins', amount: d.amount });
          break;
        case 'xp':
          addXp(d.amount, source);
          out.push({ kind: 'xp', amount: d.amount });
          break;
        case 'bait':
          if (d.id && BAIT_BY_ID[d.id]) {
            save.baits[d.id] = (save.baits[d.id] ?? 0) + d.amount;
            out.push({ kind: 'bait', id: d.id, amount: d.amount });
          }
          break;
        case 'item':
          if (d.id && (ITEM_BY_ID[d.id] || BOAT_BY_ID[d.id])) {
            grantItem(d.id, d.amount);
            out.push({ kind: 'item', id: d.id, amount: d.amount });
          }
          break;
        case 'rod':
          if (!d.id || !ROD_BY_ID[d.id]) break;
          if (save.rods.includes(d.id)) {
            const refund = Math.max(100, Math.round((ROD_BY_ID[d.id].price || 5000) * DUPLICATE_ROD_REFUND));
            addCoins(refund, source);
            out.push({ kind: 'coins', amount: refund });
          } else {
            grantRod(d.id, source);
            out.push({ kind: 'rod', id: d.id, amount: 1 });
          }
          break;
      }
    }
    markDirty();
    return out;
  }

  function lootSummary(loot: { kind: string; id?: string; amount: number }[]): string {
    return listNames(
      loot.map((l) =>
        l.kind === 'coins' ? `${fmt(l.amount)} coins` : l.kind === 'xp' ? `${fmt(l.amount)} XP` : `${l.amount > 1 ? `${l.amount}× ` : ''}${itemName(l.id ?? '')}`,
      ),
      4,
    );
  }

  function rollContainer(it: ItemDef, tier: number): LootDrop[] {
    const luck = Math.max(0, luckMultiplier() - 1);
    const table = it.loot?.table?.length ? it.loot.table : it.kind === 'treasure_chest' ? fallbackChestTable(tier) : fallbackCrateTable();
    const rolls = it.loot?.rolls ?? (it.kind === 'treasure_chest' ? 3 : 5);
    const drops = rollLoot(table, rolls, rng, luck);
    if (it.kind === 'treasure_chest') {
      // Chests always carry some XP (Fisch-like 1.5–2.5 levels' worth at the current level).
      if (!drops.some((d) => d.kind === 'xp')) {
        drops.push({ kind: 'xp', amount: Math.round(xpForLevel(save.level) * (1.5 + rng())) });
      }
      // Treasure-only rods that no table lists get a small chance here.
      if (rng() < TREASURE_ROD_CHANCE) {
        const cand = RODS.filter((r) => r.obtain === 'treasure' && !referencedRods.has(r.id) && !save.rods.includes(r.id)).sort((a, b) => a.tier - b.tier);
        if (cand.length) drops.push({ kind: 'rod', id: cand[0].id, amount: 1 });
      }
    }
    return drops;
  }

  // ── treasure maps & chests ──────────────────────────────────────────
  interface ChestRuntime {
    obj: THREE.Object3D;
    beacon: THREE.Mesh | null;
    inter: Interactable;
  }
  const chestRuntime = new Map<string, ChestRuntime>();
  let beaconMat: THREE.MeshBasicMaterial | null = null;
  let beaconGeo: THREE.CylinderGeometry | null = null;

  function beaconMesh(): THREE.Mesh | null {
    try {
      if (!beaconMat || !beaconGeo) {
        const H = 64;
        const data = new Uint8Array(4 * H);
        for (let i = 0; i < H; i++) {
          const v = i / (H - 1); // 0 bottom → 1 top
          const a = Math.pow(1 - v, 1.6) * Math.min(1, v * 12 + 0.25);
          data.set([255, Math.round(a * 255), 255, 255], i * 4);
        }
        const tex = new THREE.DataTexture(data, 1, H, THREE.RGBAFormat);
        tex.needsUpdate = true;
        beaconMat = new THREE.MeshBasicMaterial({
          color: 0xffd36a,
          alphaMap: tex,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        beaconGeo = new THREE.CylinderGeometry(0.35, 0.9, 48, 14, 1, true);
        beaconGeo.translate(0, 24, 0);
      }
      const m = new THREE.Mesh(beaconGeo, beaconMat);
      m.name = 'treasureBeacon';
      m.renderOrder = 5;
      m.frustumCulled = true;
      return m;
    } catch {
      return null;
    }
  }

  function spawnChest(map: PlayerSave['treasureMaps'][number]) {
    const world = ctx.world;
    if (!world || !map.target || chestRuntime.has(map.id)) return;
    const [x, z] = map.target;
    const h = world.terrainHeight(x, z);
    const y = Number.isFinite(h) ? h : 0;
    const chestId = map.chest ?? ITEMS.find((i) => i.kind === 'treasure_chest')?.id ?? 'treasure_chest';
    const group = new THREE.Group();
    group.name = `treasure:${map.id}`;
    try {
      const model = ctx.registry.build('item', chestId);
      model.rotation.y = (map.id.length * 1.7) % (Math.PI * 2);
      group.add(model);
    } catch (err) {
      console.warn('[economy] chest model failed', err);
    }
    const beacon = beaconMesh();
    if (beacon) group.add(beacon);
    group.position.set(x, y, z);
    ctx.scene.add(group);
    const inter: Interactable = {
      id: `treasure:${map.id}`,
      kind: 'chest',
      position: new THREE.Vector3(x, y, z),
      radius: 3,
      label: 'Open treasure chest',
      locationId: map.location ?? world.locationAt(x, z),
      data: { mapId: map.id, treasureId: chestId },
    };
    world.interactables.push(inter);
    chestRuntime.set(map.id, { obj: group, beacon, inter });
  }

  function despawnChest(mapId: string, openPose: boolean) {
    const rt = chestRuntime.get(mapId);
    if (!rt) return;
    chestRuntime.delete(mapId);
    const list = ctx.world?.interactables;
    if (list) {
      const i = list.indexOf(rt.inter);
      if (i >= 0) list.splice(i, 1);
    }
    const pos = rt.obj.position.clone();
    const rotY = rt.obj.children[0]?.rotation.y ?? 0;
    ctx.scene.remove(rt.obj);
    if (openPose) {
      try {
        const id = (rt.inter.data?.treasureId as string) ?? '';
        const open = ctx.registry.build('item', id, { pose: 'open' });
        open.position.copy(pos);
        open.rotation.y = rotY;
        ctx.scene.add(open);
        setTimeout(() => ctx.scene.remove(open), 6000);
      } catch {
        /* no open pose: fine */
      }
    }
  }

  function openChest(mapId: string) {
    const map = save.treasureMaps.find((m) => m.id === mapId);
    if (!map) {
      despawnChest(mapId, false);
      return;
    }
    const chestDef = (map.chest && ITEM_BY_ID[map.chest]) || ITEMS.find((i) => i.kind === 'treasure_chest');
    const tier = LOCATION_BY_ID[map.location ?? '']?.tier ?? 1;
    save.treasureMaps = save.treasureMaps.filter((m) => m.id !== mapId);
    despawnChest(mapId, true);
    save.stats.treasuresFound = (save.stats.treasuresFound ?? 0) + 1;
    const pseudo: ItemDef = chestDef ?? { id: 'treasure_chest', name: 'Treasure Chest', kind: 'treasure_chest', rarity: 'rare', description: '', price: null, soldAt: null, visual: {} };
    const loot = applyLoot(rollContainer(pseudo, tier), 'treasure');
    const title = pseudo.name;
    events.emit('ui:open', { panel: 'items', data: { loot, title, source: pseudo.id } });
    toast(`${title}: ${lootSummary(loot)}`, 'rare');
    platform.happytime();
    markDirty();
  }

  function mapItemIds(): string[] {
    return ITEMS.filter((i) => i.kind === 'treasure_map' && (save.items[i.id] ?? 0) > 0).map((i) => i.id);
  }

  function decodeMap(): { ok: boolean; message: string; target?: [number, number]; locationId?: string } {
    const mapId = mapItemIds()[0];
    if (!mapId) return { ok: false, message: 'You have no treasure map. They turn up while fishing (1 in 200 catches).' };
    if (save.treasureMaps.length >= MAX_ACTIVE_MAPS) return { ok: false, message: 'Dig up the treasures you already have marked first.' };
    const world = ctx.world;
    if (!world) return { ok: false, message: 'The sea is not ready yet.' };
    if (save.coins < TREASURE_DECODE_COST) return { ok: false, message: `Rosa wants ${TREASURE_DECODE_COST} coins to read a map.` };
    const discovered = world.islands.filter((i) => save.discovered.includes(i.id) && LOCATION_BY_ID[i.id]?.kind !== 'water');
    const islands = discovered.length ? discovered : world.islands;
    if (!islands.length) return { ok: false, message: 'No islands to search.' };
    const tmp = new THREE.Vector3();
    const blocked = (x: number, z: number) => {
      const h = world.terrainHeight(x, z);
      tmp.set(x, h, z);
      try {
        world.collide(tmp, 1.0);
      } catch {
        return false;
      }
      return Math.hypot(tmp.x - x, tmp.z - z) > 0.05;
    };
    let spot: { x: number; z: number; y: number } | null = null;
    let island = islands[0];
    for (let attempt = 0; attempt < 6 && !spot; attempt++) {
      island = islands[Math.floor(rng() * islands.length)];
      spot = findTreasureSpot(island, (x, z) => world.terrainHeight(x, z), rng, blocked);
    }
    if (!spot) return { ok: false, message: 'Rosa squints… “This one’s smudged. Try again later.”' };
    spend(TREASURE_DECODE_COST, 'treasure_decode');
    save.items[mapId] = (save.items[mapId] ?? 1) - 1;
    if (save.items[mapId] <= 0) delete save.items[mapId];
    const tier = LOCATION_BY_ID[island.id]?.tier ?? 1;
    const entry = {
      id: uid(),
      target: [Math.round(spot.x * 10) / 10, Math.round(spot.z * 10) / 10] as [number, number],
      chest: pickChest(ITEMS, tier, rng) ?? undefined,
      location: island.id,
    };
    if (!entry.chest) delete entry.chest;
    save.treasureMaps.push(entry);
    spawnChest(entry);
    events.emit('item:used', { itemId: mapId });
    const msg = `Rosa marks an X on ${locName(island.id)}. Look for the golden light!`;
    toast(msg, 'good');
    markDirty();
    return { ok: true, message: msg, target: entry.target, locationId: island.id };
  }

  // Chests from earlier sessions.
  for (const m of save.treasureMaps) spawnChest(m);

  // ── quests ──────────────────────────────────────────────────────────
  const lastQuestFish: Record<string, string> = {};

  interface QuestRodRule {
    rodId: string;
    npcId: string | null;
    count: number;
  }
  const questRodRules: QuestRodRule[] = RODS.filter((r) => r.obtain === 'quest').map((r, i) => {
    const text = `${r.obtainHint} ${r.description}`;
    const t = ` ${norm(text)} `;
    const npc = NPCS.find((n) => n.role === 'angler' && (t.includes(` ${norm(n.name)} `) || t.includes(` ${norm(n.name.split(' ').pop() ?? n.name)} `)));
    const n = firstInt(r.obtainHint);
    return { rodId: r.id, npcId: npc?.id ?? null, count: n && n > 0 && n < 10000 ? n : npc ? 10 : 25 * (i + 1) };
  });

  function checkQuestRods() {
    const counts = save.questCounts ?? (save.questCounts = {});
    const total = save.stats.questsCompleted ?? 0;
    for (const rule of questRodRules) {
      if (save.rods.includes(rule.rodId)) continue;
      const have = rule.npcId ? counts[rule.npcId] ?? 0 : total;
      if (have >= rule.count) grantRod(rule.rodId, 'quest');
    }
  }

  function questFor(npcId: string): QuestState | null {
    const npc = NPC_BY_ID[npcId];
    if (!npc || npc.role !== 'angler') return null;
    const active = save.quests.find((q) => q.npcId === npcId);
    if (active) return active;
    if ((save.questCooldowns[npcId] ?? 0) > now()) return null;
    const q = generateQuest(npc, FISH, LOCATIONS, ITEMS, rng, now(), lastQuestFish[npcId]);
    if (!q) return null;
    save.quests.push(q);
    events.emit('quest:new', { quest: q });
    markDirty();
    return q;
  }

  function turnInQuest(npcId: string): boolean {
    const q = save.quests.find((x) => x.npcId === npcId);
    if (!q) return false;
    const fishName = FISH_BY_ID[q.fishId]?.name ?? q.fishId;
    const matches = save.backpack.filter((f) => f.fishId === q.fishId && !f.favorite).sort((a, b) => a.value - b.value);
    if (!matches.length) {
      const fav = save.backpack.some((f) => f.fishId === q.fishId);
      toast(fav ? `Your ${fishName} is a favourite — unfavourite it to hand it in.` : `Bring a ${fishName} in your backpack.`, 'bad');
      return false;
    }
    const idx = save.backpack.indexOf(matches[0]);
    save.backpack.splice(idx, 1);
    save.quests = save.quests.filter((x) => x !== q);
    save.questCooldowns[npcId] = now() + QUEST_COOLDOWN_MS;
    const counts = save.questCounts ?? (save.questCounts = {});
    counts[npcId] = (counts[npcId] ?? 0) + 1;
    save.stats.questsCompleted = (save.stats.questsCompleted ?? 0) + 1;
    lastQuestFish[npcId] = q.fishId;
    addCoins(q.rewardCoins, 'quest');
    addXp(q.rewardXp, 'quest');
    let extra = '';
    if (q.bonusItem && (ITEM_BY_ID[q.bonusItem] || BAIT_BY_ID[q.bonusItem] || ROD_BY_ID[q.bonusItem])) {
      grantItem(q.bonusItem, 1);
      extra = ` and ${itemName(q.bonusItem)}`;
    }
    events.emit('quest:complete', { quest: q });
    toast(`Quest complete! +${fmt(q.rewardCoins)} coins, +${fmt(q.rewardXp)} XP${extra}.`, 'good');
    checkQuestRods();
    markDirty();
    return true;
  }

  // ── bestiary ────────────────────────────────────────────────────────
  const bestiaryRodsOnCompletion = completionRods(RODS, LOCATIONS);

  function bestiaryReward(zoneId: string) {
    if (zoneId === GLOBAL_PAGE) return { coins: 0, xp: 0, bobber: null, rod: null };
    return pageReward(zoneId, LOCATION_BY_ID[zoneId], ITEMS, RODS);
  }

  function claimBestiary(zoneId: string): boolean {
    if (zoneId === GLOBAL_PAGE || save.claimedBestiaryZones.includes(zoneId)) return false;
    if (!pageComplete(zoneId)) return false;
    const r = bestiaryReward(zoneId);
    save.claimedBestiaryZones.push(zoneId);
    save.stats.bestiaryClaims = (save.stats.bestiaryClaims ?? 0) + 1;
    addCoins(r.coins, 'bestiary');
    addXp(r.xp, 'bestiary');
    const parts = [`${fmt(r.coins)} coins`, `${fmt(r.xp)} XP`];
    if (r.bobber && !save.bobbers.includes(r.bobber)) {
      save.bobbers.push(r.bobber);
      parts.push(itemName(r.bobber));
    }
    toast(`${locName(zoneId)} bestiary claimed: ${parts.join(', ')}!`, 'rare');
    if (r.rod) grantRod(r.rod, 'bestiary');
    const pages = claimablePages(FISH, LOCATIONS);
    if (pages.length && pages.every((z) => save.claimedBestiaryZones.includes(z))) {
      for (const id of bestiaryRodsOnCompletion) grantRod(id, 'bestiary');
    }
    platform.happytime();
    markDirty();
    return true;
  }

  // ── enchanting ──────────────────────────────────────────────────────
  function nearAltar(): boolean {
    const altars = ctx.world?.interactables?.filter((i) => i.kind === 'altar') ?? [];
    const p = ctx.player?.position;
    if (!altars.length || !p) return true;
    return altars.some((a) => a.position.distanceTo(p) <= a.radius + 8);
  }

  function canEnchant(): { ok: boolean; reason?: string } {
    refreshEnv();
    if (!envNight) return { ok: false, reason: 'The altar only wakes under the stars. Come back at night.' };
    if (!nearAltar()) return { ok: false, reason: 'Stand at the Keeper’s altar to enchant.' };
    return { ok: true };
  }

  function enchant(relicItemId: string): EnchantResult {
    const it = ITEM_BY_ID[relicItemId];
    if (!it || it.kind !== 'relic' || !it.relic) return { ok: false, message: 'That is not a relic.' };
    if ((save.items[relicItemId] ?? 0) <= 0) return { ok: false, message: `You have no ${it.name}.` };
    const can = canEnchant();
    if (!can.ok) return { ok: false, message: can.reason ?? 'The altar is silent.' };
    const rod = equippedRod();
    const slots = save.rodEnchants[rod.id] ?? [];
    const slot = ENCHANT_SLOT[it.relic.pool];
    const e = rollEnchant(it.relic.pool, rng, slots[slot] || null);
    if (!e) return { ok: false, message: 'The relic crumbles, but nothing happens.' };
    save.items[relicItemId]--;
    if (save.items[relicItemId] <= 0) delete save.items[relicItemId];
    save.rodEnchants[rod.id] = applyEnchantToSlots(slots, e);
    save.stats.enchants = (save.stats.enchants ?? 0) + 1;
    events.emit('enchant:applied', { rodId: rod.id, enchantId: e.id });
    events.emit('item:used', { itemId: relicItemId });
    const message = `${rod.name} is now ${e.name}: ${e.description}`;
    toast(message, 'rare');
    platform.happytime();
    markDirty();
    return { ok: true, enchantId: e.id, message };
  }

  // ── items ───────────────────────────────────────────────────────────
  type UseResult = ReturnType<EconomyAPI['useItem']>;

  function consume(id: string) {
    save.items[id] = (save.items[id] ?? 0) - 1;
    if (save.items[id] <= 0) delete save.items[id];
  }

  function useItem(itemId: string): UseResult {
    const it = ITEM_BY_ID[itemId];
    if (!it) return { ok: false, message: 'Unknown item.' };
    if (it.kind === 'bobber') {
      return api.equipBobber(itemId) ? { ok: true, message: `${it.name} equipped.` } : { ok: false, message: `You do not own ${it.name}.` };
    }
    if ((save.items[itemId] ?? 0) <= 0) return { ok: false, message: `You have no ${it.name}.` };
    let result: UseResult;
    switch (it.kind) {
      case 'bait_crate':
      case 'treasure_chest': {
        consume(itemId);
        const tier = Math.max(...save.discovered.map((d) => LOCATION_BY_ID[d]?.tier ?? 1), 1);
        const loot = applyLoot(rollContainer(it, tier), it.kind);
        save.stats.cratesOpened = (save.stats.cratesOpened ?? 0) + 1;
        const msg = `${it.name}: ${lootSummary(loot)}`;
        toast(msg, 'good');
        result = { ok: true, message: msg, loot };
        break;
      }
      case 'totem': {
        const t = it.totem;
        if (!t) return { ok: false, message: 'This totem is inert.' };
        refreshEnv();
        if (t.isNight !== undefined && !t.weather && !t.event && t.isNight === envNight) {
          return { ok: false, message: t.isNight ? 'It is already night.' : 'It is already day.' };
        }
        consume(itemId);
        ctx.clock.applyOverride({ weather: t.weather ?? null, isNight: t.isNight ?? null, event: t.event ?? null, durationMs: Math.max(1, t.durationMin) * 60000 });
        const what = t.event ? WORLD_EVENTS.find((e) => e.id === t.event)?.name ?? t.event : t.weather ? t.weather : t.isNight ? 'night' : 'day';
        const msg = `${it.name}: ${what} for ${t.durationMin} min.`;
        toast(msg, 'rare');
        result = { ok: true, message: msg };
        break;
      }
      case 'potion': {
        const p = it.potion;
        if (!p) return { ok: false, message: 'This potion has gone flat.' };
        consume(itemId);
        addBoost({
          id: `potion_${it.id}`,
          label: it.name,
          ...(p.luckMult ? { luckMult: p.luckMult } : {}),
          ...(p.lureMult ? { lureMult: p.lureMult } : {}),
          ...(p.xpMult ? { xpMult: p.xpMult } : {}),
          ...(p.sellMult ? { sellMult: p.sellMult } : {}),
          ...(p.mutationMult ? { mutationMult: p.mutationMult } : {}),
          expiresAt: now() + Math.max(1, p.durationMin) * 60000,
        });
        const msg = `${it.name} active for ${p.durationMin} min.`;
        toast(msg, 'good');
        result = { ok: true, message: msg };
        break;
      }
      case 'misc': {
        if (!it.backpack) return { ok: false, message: `${it.name} can’t be used.` };
        if (save.backpackSize >= BACKPACK_MAX) return { ok: false, message: 'Your backpack cannot grow any bigger.' };
        consume(itemId);
        save.backpackSize = Math.min(BACKPACK_MAX, save.backpackSize + it.backpack.slots);
        const msg = `Backpack upgraded to ${save.backpackSize} slots!`;
        toast(msg, 'good');
        result = { ok: true, message: msg };
        break;
      }
      case 'relic':
        return { ok: false, message: 'Place relics on the Keeper’s altar at night (Keeper’s Monolith).' };
      case 'treasure_map':
        return { ok: false, message: 'Take treasure maps to One-Eyed Rosa at Wreckers’ Cove.' };
      case 'lantern':
        return { ok: false, message: 'Lanterns light your way automatically at night.' };
      default:
        return { ok: false, message: `${it.name} can’t be used.` };
    }
    events.emit('item:used', { itemId });
    markDirty();
    return result;
  }

  // ── discovery ───────────────────────────────────────────────────────
  function discover(locationId: string): boolean {
    const loc = LOCATION_BY_ID[locationId];
    if (!loc || save.discovered.includes(locationId)) return false;
    save.discovered.push(locationId);
    const xp = discoveryXp(loc.tier);
    events.emit('location:discovered', { locationId });
    toast(`Discovered ${loc.name}! +${fmt(xp)} XP`, 'good');
    addXp(xp, 'discovery');
    markDirty();
    return true;
  }

  // ── ads ─────────────────────────────────────────────────────────────
  let lastAdAt = now(); // session start counts as an ad break (no midgame in the first minutes)
  const adCooldownUntil: Record<AdKind, number> = { luck: 0, xp: 0, sell: 0, bait: 0 };

  function fishingBusy(): boolean {
    const ph = ctx.fishing?.phase;
    return !!ph && ph !== 'idle';
  }

  function maybeMidgame() {
    if (now() - lastAdAt < MIDGAME_GAP_MS) return;
    if (fishingBusy() || platform.adPlaying?.()) return;
    lastAdAt = now();
    platform.midgame().catch(() => {});
  }

  function adRewardCooldownMs(kind: AdKind): number {
    const t = now();
    let ms = Math.max(0, adCooldownUntil[kind] - t);
    if (kind === 'luck' || kind === 'xp') {
      const b = save.boosts.find((x) => x.id === `ad_${kind}`);
      if (b) ms = Math.max(ms, b.expiresAt - t - AD_BANK_MS);
    }
    return Math.max(0, ms);
  }

  async function adReward(kind: AdKind): Promise<boolean> {
    if (adRewardCooldownMs(kind) > 0) {
      toast('That reward is not ready yet.', 'info');
      return false;
    }
    let ok = false;
    try {
      ok = await platform.rewarded(`reward_${kind}`);
    } catch {
      ok = false;
    }
    lastAdAt = now();
    if (!ok) {
      toast('No ad available right now — try again in a bit.', 'bad');
      return false;
    }
    const t = now();
    switch (kind) {
      case 'luck':
        addBoost({ id: 'ad_luck', label: 'Lucky Tide (2× luck)', luckMult: 2, expiresAt: t + AD_BOOST_MS });
        toast('2× luck for 5 minutes!', 'rare');
        break;
      case 'xp':
        addBoost({ id: 'ad_xp', label: 'Quick Study (2× XP)', xpMult: 2, expiresAt: t + AD_BOOST_MS });
        toast('2× XP for 5 minutes!', 'rare');
        break;
      case 'sell':
        addBoost({ id: 'ad_sell', label: 'Double Sale (next sale ×2)', sellMult: 2, expiresAt: t + 10 * 60 * 1000 });
        toast('Your next sale pays double!', 'rare');
        break;
      case 'bait': {
        const best = bestBaitForLevel();
        if (best) {
          const n = best.price !== null && best.price >= 200 ? 5 : 10;
          save.baits[best.id] = (save.baits[best.id] ?? 0) + n;
          if (!save.equippedBait) save.equippedBait = best.id;
          toast(`Free bait: ${n}× ${best.name}!`, 'rare');
        }
        break;
      }
    }
    adCooldownUntil[kind] = t + AD_COOLDOWN_MS[kind];
    markDirty();
    return true;
  }

  /** Priciest shop bait from a location the player's level is ready for. */
  function bestBaitForLevel(): BaitDef | null {
    const ok = BAITS.filter((b) => b.price !== null && b.price > 0 && (!b.soldAt || (LOCATION_BY_ID[b.soldAt]?.tier ?? 1) <= save.level));
    ok.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return ok[0] ?? BAITS[0] ?? null;
  }

  // ── event wiring ────────────────────────────────────────────────────
  let lastPanel: PanelId | null = null;
  events.on('ui:open', ({ panel }) => {
    lastPanel = panel;
  });
  events.on('ui:close', () => {
    const p = lastPanel;
    lastPanel = null;
    if (p && BREAK_PANELS.has(p)) maybeMidgame();
  });
  events.on('location:enter', ({ locationId }) => {
    discover(locationId);
  });

  events.on('interact', ({ target }) => {
    switch (target.kind) {
      case 'npc': {
        const npc = target.npcId ? NPC_BY_ID[target.npcId] : undefined;
        if (!npc) return;
        if (npc.role === 'angler') questFor(npc.id);
        events.emit('ui:open', { panel: 'dialog', data: { npcId: npc.id, role: npc.role, name: npc.name } });
        break;
      }
      case 'altar': {
        const c = canEnchant();
        events.emit('ui:open', { panel: 'enchant', data: { night: envNight, ok: c.ok, reason: c.reason ?? null } });
        break;
      }
      case 'chest': {
        const mapId = target.data?.mapId;
        if (typeof mapId === 'string') openChest(mapId);
        break;
      }
      case 'boat_spawn': {
        if (!save.boats.length) {
          toast('You need a boat first — visit a shipwright.', 'bad');
          break;
        }
        if (!save.equippedBoat) save.equippedBoat = save.boats[0];
        const ok = ctx.player?.spawnBoat?.();
        if (ok === false) toast('No room to launch a boat here.', 'bad');
        break;
      }
      case 'bestiary':
        events.emit('ui:open', { panel: 'bestiary', data: { zone: target.locationId } });
        break;
      case 'sign':
        if (target.label) toast(target.label, 'info');
        break;
      default:
        break;
    }
  });

  // ── api ─────────────────────────────────────────────────────────────
  let boostTimer = 0;
  let pulse = 0;

  const api: EconomyAPI = {
    save,
    coins: () => save.coins,
    level: () => save.level,
    xp: () => save.xp,
    xpToNext: () => xpForLevel(save.level),
    addCoins,
    spendCoins: (amount: number) => spend(amount, 'spend'),
    addXp,
    grantItem,

    equippedRod,
    effectiveRodStats(): RodStats {
      const rod = equippedRod();
      return effectiveStats(rod, rodEnchants(rod.id));
    },
    rodEnchants,
    equippedBait(): BaitDef | null {
      const id = save.equippedBait;
      if (!id || !((save.baits[id] ?? 0) > 0)) return null;
      return BAIT_BY_ID[id] ?? null;
    },
    consumeBait() {
      const id = save.equippedBait;
      if (!id) return;
      const left = (save.baits[id] ?? 0) - 1;
      if (left > 0) save.baits[id] = left;
      else {
        delete save.baits[id];
        save.equippedBait = null;
        toast(`Out of ${BAIT_BY_ID[id]?.name ?? 'bait'}.`, 'info');
      }
      markDirty();
    },

    luckMultiplier,
    lureMultiplier,
    xpMultiplier,
    sellMultiplier,
    mutationMultiplier,

    addCatch,
    sell,
    sellAll: () => sell(sellable(null).map((f) => f.uid)),
    toggleFavorite(uidStr: string) {
      const f = save.backpack.find((x) => x.uid === uidStr);
      if (!f) return;
      if (f.favorite) delete f.favorite;
      else f.favorite = true;
      markDirty();
    },

    shopFor(npcId: string): ShopEntry[] {
      const npc = NPC_BY_ID[npcId];
      if (!npc) return [];
      refreshEnv();
      return buildShop(npc, shopData, {
        level: save.level,
        rods: save.rods,
        boats: save.boats,
        bobbers: save.bobbers,
        baits: save.baits,
        items: save.items,
        event: envEvent,
      });
    },
    buy,
    equipRod(id: string): boolean {
      if (!ROD_BY_ID[id] || !save.rods.includes(id)) return false;
      if (save.equippedRod !== id) {
        save.equippedRod = id;
        events.emit('equip:rod', { rodId: id });
        markDirty();
      }
      return true;
    },
    equipBait(id: string | null): boolean {
      if (id === null) {
        save.equippedBait = null;
        markDirty();
        return true;
      }
      if (!BAIT_BY_ID[id] || !((save.baits[id] ?? 0) > 0)) return false;
      save.equippedBait = id;
      markDirty();
      return true;
    },
    equipBobber(id: string): boolean {
      if (!save.bobbers.includes(id)) return false;
      save.equippedBobber = id;
      markDirty();
      return true;
    },
    equipBoat(id: string): boolean {
      if (!save.boats.includes(id) || !BOAT_BY_ID[id]) return false;
      save.equippedBoat = id;
      markDirty();
      return true;
    },
    useItem,

    appraiseCost(uidStr: string): number {
      const f = save.backpack.find((x) => x.uid === uidStr);
      return f ? appraiseCostFor(f) : 0;
    },
    appraise(uidStr: string): CaughtFish | null {
      const idx = save.backpack.findIndex((x) => x.uid === uidStr);
      if (idx < 0) return null;
      const f = save.backpack[idx];
      const def = FISH_BY_ID[f.fishId];
      if (!def) return null;
      const cost = appraiseCostFor(f);
      if (!spend(cost, 'appraise')) {
        toast(`Appraising costs ${fmt(cost)} coins.`, 'bad');
        return null;
      }
      const nf = appraiseFish(f, def, rng, mutationMultiplier());
      save.backpack[idx] = nf;
      const e = save.bestiary[nf.fishId];
      if (e) {
        e.bestKg = Math.max(e.bestKg, nf.kg);
        e.bestValue = Math.max(e.bestValue, nf.value);
        if (nf.mutation && !e.mutations.includes(nf.mutation)) e.mutations.push(nf.mutation);
      }
      if (nf.kg > save.stats.biggestKg) save.stats.biggestKg = nf.kg;
      save.stats.appraisals = (save.stats.appraisals ?? 0) + 1;
      events.emit('appraise:done', { fish: nf });
      markDirty();
      return nf;
    },
    enchant,

    bestiaryZone(zoneId: string) {
      return pageFish(zoneId, FISH).map((f) => ({ fishId: f.id, entry: save.bestiary[f.id] ?? null }));
    },
    bestiaryProgress(zoneId: string) {
      const p = pageProgress(zoneId, FISH, save.bestiary);
      return { caught: p.caught, total: p.total, claimed: save.claimedBestiaryZones.includes(zoneId) };
    },
    claimBestiary,

    questFor,
    turnInQuest,

    addBoost,
    activeBoosts: () => pruneBoosts(save.boosts, now()),

    discover,
    save_: () => persist(false),
    update(dt: number) {
      if (!(dt >= 0)) return;
      save.stats.playSeconds += dt;
      refreshEnv();
      boostTimer += dt;
      if (boostTimer >= 1) {
        boostTimer = 0;
        const before = save.boosts.length;
        save.boosts = pruneBoosts(save.boosts, now());
        if (save.boosts.length !== before) markDirty();
      }
      if (beaconMat && chestRuntime.size) {
        pulse += dt;
        beaconMat.opacity = 0.42 + 0.12 * Math.sin(pulse * 2.2);
      }
      const t = now();
      if (dirty && (t - lastChange >= SAVE_DEBOUNCE_MS || t - dirtySince >= SAVE_MAX_DELAY_MS)) persist(false);
      else if (!dirty && t - lastSaveAt >= SAVE_PERIODIC_MS) persist(false);
    },

    // optional extras
    activeEffects(): ActiveEffect[] {
      const rod = equippedRod();
      return collectEffects(rod, rodEnchants(rod.id));
    },
    buyCheck,
    sellPreview(uids?: string[]): number {
      const list = sellable(uids ?? null);
      return Math.round(list.reduce((a, f) => a + f.value, 0) * sellMultiplier());
    },
    canEnchant,
    bestiaryReward,
    questCooldownMs: (npcId: string) => Math.max(0, (save.questCooldowns[npcId] ?? 0) - now()),
    decodeMap,
    mapCount: () => mapItemIds().reduce((a, id) => a + (save.items[id] ?? 0), 0),
    setSpawn(locationId: string) {
      if (!LOCATION_BY_ID[locationId]) return;
      save.spawn.location = locationId;
      toast(`You will now wake up at ${locName(locationId)}.`, 'good');
      markDirty();
    },
    adReward,
    adRewardCooldownMs,
  };

  // Sanity: a save migrated from an older data set may have lost its equipped rod.
  if (!ROD_BY_ID[save.equippedRod]) save.equippedRod = STARTER_ROD;
  checkQuestRods();
  if (loaded.refunded > 0) markDirty();
  return api;
}

