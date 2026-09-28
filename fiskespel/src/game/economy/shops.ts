/**
 * Shops: who sells what, derived from data (`soldAt` + NPC role + location). Pure. OWNER: economy.
 *
 * Rules
 *  - Each sellable kind has seller roles (SELLERS). Every NPC with one of those roles at the item's
 *    `soldAt` location sells it. If that location has none of those roles, the location's first NPC
 *    in FALLBACK_ORDER sells it instead, so no priced item is ever orphaned.
 *  - Items/boats with `soldAt: null` and a price are "global": sold by every NPC whose role is the
 *    kind's primary seller (e.g. every totem carver, every merchant for potions).
 *  - Rods: only `obtain: 'shop'` rods with price > 0 (plus `obtain: 'event'` rods while the event
 *    named in their hint is active). Baits: price !== null.
 */
import type { BaitDef, BoatDef, ItemDef, ItemKind, NpcDef, RodDef, ShopEntry, WorldEventDef } from '../../core/types';

export type NpcRole = NpcDef['role'];
export type SellKind = 'rod' | 'bait' | 'boat' | ItemKind;

export const SELLERS: Record<SellKind, NpcRole[]> = {
  rod: ['merchant', 'rod_crafter'],
  bait: ['merchant', 'bait_vendor'],
  bait_crate: ['bait_vendor', 'merchant'],
  relic: ['keeper', 'merchant'],
  totem: ['totem_carver'],
  boat: ['shipwright'],
  potion: ['merchant'],
  bobber: ['merchant'],
  lantern: ['merchant'],
  misc: ['merchant'],
  treasure_map: ['treasure_hunter'],
  treasure_chest: ['treasure_hunter'],
};

export const FALLBACK_ORDER: NpcRole[] = [
  'merchant', 'rod_crafter', 'bait_vendor', 'shipwright', 'totem_carver', 'keeper', 'treasure_hunter',
  'innkeeper', 'appraiser', 'bestiary_keeper', 'angler', 'villager',
];

/** Kinds that may be sold globally (soldAt null) by their primary seller role. */
const GLOBAL_KINDS = new Set<SellKind>(['relic', 'totem', 'potion', 'bobber', 'lantern', 'misc', 'bait_crate', 'boat']);

export interface ShopData {
  npcs: readonly NpcDef[];
  rods: readonly RodDef[];
  baits: readonly BaitDef[];
  items: readonly ItemDef[];
  boats: readonly BoatDef[];
  events: readonly WorldEventDef[];
}

export interface ShopState {
  level: number;
  rods: readonly string[];
  boats: readonly string[];
  bobbers: readonly string[];
  baits: Readonly<Record<string, number>>;
  items: Readonly<Record<string, number>>;
  /** Active world event id (for event rods). */
  event: string | null;
}

/** NPCs that sell `kind` items whose soldAt is `location`. */
export function sellersAt(kind: SellKind, location: string, npcs: readonly NpcDef[]): NpcDef[] {
  const here = npcs.filter((n) => n.location === location);
  const direct = here.filter((n) => SELLERS[kind].includes(n.role));
  if (direct.length) return direct;
  for (const role of FALLBACK_ORDER) {
    const n = here.find((x) => x.role === role);
    if (n) return [n];
  }
  return [];
}

function sells(npc: NpcDef, kind: SellKind, soldAt: string | null, priced: boolean, npcs: readonly NpcDef[]): boolean {
  if (!priced) return false;
  if (soldAt === null) return GLOBAL_KINDS.has(kind) && npc.role === SELLERS[kind][0];
  if (soldAt !== npc.location) return false;
  return sellersAt(kind, soldAt, npcs).some((n) => n.id === npc.id);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

/** World event an `obtain: 'event'` rod belongs to (named in its hint/description), or null. */
export function rodEvent(rod: RodDef, events: readonly WorldEventDef[]): string | null {
  const t = ` ${norm(`${rod.obtainHint} ${rod.description}`)} `;
  const e = events.find((ev) => t.includes(` ${norm(ev.name).trim()} `) || t.includes(` ${norm(ev.id).trim()} `));
  return e?.id ?? null;
}

export function rodForSale(rod: RodDef, event: string | null, events: readonly WorldEventDef[]): boolean {
  if (!(rod.price > 0)) return false;
  if (rod.obtain === 'shop') return true;
  if (rod.obtain === 'event') {
    const ev = rodEvent(rod, events);
    return ev !== null && ev === event;
  }
  return false;
}

export function packSize(unitPrice: number): number {
  return unitPrice < 50 ? 10 : unitPrice < 500 ? 5 : 1;
}

export function buildShop(npc: NpcDef, data: ShopData, st: ShopState): ShopEntry[] {
  const rods: ShopEntry[] = [];
  const baits: ShopEntry[] = [];
  const items: ShopEntry[] = [];
  const boats: ShopEntry[] = [];

  for (const r of data.rods) {
    if (!rodForSale(r, st.event, data.events)) continue;
    // Event rods with soldAt null are carried by every rod seller while the event lasts.
    const at = r.soldAt ?? (r.obtain === 'event' && SELLERS.rod.includes(npc.role) ? npc.location : null);
    if (!sells(npc, 'rod', at, true, data.npcs)) continue;
    rods.push({ kind: 'rod', id: r.id, price: r.price, unlockLevel: r.unlockLevel, owned: st.rods.includes(r.id) });
  }
  for (const b of data.baits) {
    if (b.price === null || !(b.price > 0)) continue;
    if (!sells(npc, 'bait', b.soldAt, true, data.npcs)) continue;
    baits.push({ kind: 'bait', id: b.id, price: b.price, unlockLevel: 1, count: st.baits[b.id] ?? 0, pack: packSize(b.price) });
  }
  for (const it of data.items) {
    if (it.price === null || !(it.price > 0)) continue;
    if (!sells(npc, it.kind, it.soldAt, true, data.npcs)) continue;
    if (it.kind === 'bobber') {
      items.push({ kind: 'bobber', id: it.id, price: it.price, unlockLevel: it.unlockLevel ?? 1, owned: st.bobbers.includes(it.id) });
    } else {
      items.push({ kind: 'item', id: it.id, price: it.price, unlockLevel: it.unlockLevel ?? 1, count: st.items[it.id] ?? 0 });
    }
  }
  for (const b of data.boats) {
    // Free boats are granted automatically (economy); shipwrights still list them as owned/claimable.
    const listed = b.price > 0
      ? sells(npc, 'boat', b.soldAt, true, data.npcs)
      : npc.role === 'shipwright' && (b.soldAt === null || b.soldAt === npc.location);
    if (!listed) continue;
    boats.push({ kind: 'boat', id: b.id, price: Math.max(0, b.price), unlockLevel: b.unlockLevel, owned: st.boats.includes(b.id) });
  }

  const byLevelPrice = (a: ShopEntry, b: ShopEntry) => a.unlockLevel - b.unlockLevel || a.price - b.price || a.id.localeCompare(b.id);
  rods.sort(byLevelPrice);
  baits.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  const kindOrder = (e: ShopEntry) => {
    const def = data.items.find((i) => i.id === e.id);
    return ['bait_crate', 'potion', 'misc', 'bobber', 'lantern', 'totem', 'relic', 'treasure_map', 'treasure_chest'].indexOf(def?.kind ?? 'misc');
  };
  items.sort((a, b) => kindOrder(a) - kindOrder(b) || byLevelPrice(a, b));
  boats.sort(byLevelPrice);
  return [...rods, ...baits, ...items, ...boats];
}

/** Every (npc, entry) pair in the world — for tests: detects orphaned priced items. */
export function allShopEntries(data: ShopData, st: ShopState): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const npc of data.npcs) {
    for (const e of buildShop(npc, data, st)) {
      const key = `${e.kind}:${e.id}`;
      m.set(key, [...(m.get(key) ?? []), npc.id]);
    }
  }
  return m;
}
