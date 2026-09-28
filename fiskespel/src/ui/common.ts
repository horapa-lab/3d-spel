// OWNER: ui. Internal UI context + shared markup builders.
import type * as THREE from 'three';
import type {
  BaitDef, CaughtFish, EconomyAPI, FishingAPI, GameContext, Interactable, ItemDef, PanelId, Rarity, RodDef, RodStats, WorldClockAPI,
} from '../core/types';
import type { Thumbs, ThumbOpts } from './thumbs';
import { coinIcon, icon } from './icons';
import {
  attributeName, esc, fishDef, fishName, fmtCoins, fmtKg, fmtOdds, fmtPct, mutationColor, mutationName, rarityColor, rarityName, SIZE_NAMES,
} from './util';
import { ITEM_BY_ID } from '../data/items';
import { BAIT_BY_ID } from '../data/baits';

export type ToastKind = 'info' | 'good' | 'bad' | 'rare';

/** Internal UI context shared by all UI modules. */
export interface UIC {
  game: GameContext;
  eco: EconomyAPI;
  fishing: FishingAPI;
  clock: WorldClockAPI;
  thumbs: Thumbs;
  touch: boolean;
  dev: string | null;
  params: URLSearchParams;
  root: HTMLElement;
  open(panel: PanelId | string, data?: Record<string, unknown>): void;
  close(): void;
  isOpen(): boolean;
  current(): string | null;
  toast(text: string, kind?: ToastKind, iconName?: string): void;
  nearest(): Interactable | null;
  playerPos(): THREE.Vector3 | null;
  sfx(id: string, volume?: number): void;
  isNight(): boolean;
  /** npcId of a merchant the player is talking to / standing next to, else null. */
  merchantNearby(): string | null;
  /** Queue a big centre celebration (level-up etc.) so they never overlap the catch card. */
  celebrate(fn: () => number): void;
  save(): void;
}

// ───────────────────────────────────────────── fallback icons (when no 3D model exists)

export function fallbackIcon(kind: string, id: string, rarity?: Rarity | null): string {
  const c = rarity ? rarityColor(rarity) : '#9fe6ff';
  const name = kind === 'fish' ? 'fish' : kind === 'rod' ? 'rod' : kind === 'bait' ? 'bait' : kind === 'boat' ? 'boat' : kind === 'npc' ? 'user' : itemIconName(id);
  return `<span class="ri-fb" style="--fc:${c}">${icon(name)}</span>`;
}

export function itemIconName(id: string): string {
  const it = ITEM_BY_ID[id];
  if (!it) return BAIT_BY_ID[id] ? 'bait' : 'gift';
  return ({ bait_crate: 'crate', treasure_chest: 'chest', relic: 'relic', totem: 'totem', treasure_map: 'map', bobber: 'bobber', lantern: 'fire', potion: 'potion', misc: 'gift' } as Record<string, string>)[it.kind] ?? 'gift';
}

export function fishThumb(u: UIC, fishId: string, opts: ThumbOpts = {}, cls = ''): string {
  const def = fishDef(fishId);
  return u.thumbs.html('fish', fishId, opts, fallbackIcon('fish', fishId, opts.silhouette ? null : def?.rarity), `${cls}${opts.silhouette ? ' ri-th-sil' : ''}`);
}
export function rodThumb(u: UIC, rodId: string, cls = ''): string {
  return u.thumbs.html('rod', rodId, {}, fallbackIcon('rod', rodId), cls);
}
export function baitThumb(u: UIC, id: string, cls = ''): string {
  return u.thumbs.html('bait', id, {}, fallbackIcon('bait', id, BAIT_BY_ID[id]?.rarity), cls);
}
export function itemThumb(u: UIC, id: string, cls = ''): string {
  const it = ITEM_BY_ID[id];
  const kind = it?.kind === 'bobber' ? 'bobber' : 'item';
  return u.thumbs.html(kind, id, {}, fallbackIcon('item', id, it?.rarity), cls);
}
export function boatThumb(u: UIC, id: string, cls = ''): string {
  return u.thumbs.html('boat', id, {}, fallbackIcon('boat', id), cls);
}
export function npcThumb(u: UIC, id: string, cls = ''): string {
  return u.thumbs.html('npc', id, {}, fallbackIcon('npc', id), cls);
}

// ───────────────────────────────────────────── small markup pieces

export const coins = (n: number, cls = '') => `<span class="ri-coins ${cls}">${coinIcon()}<b>${fmtCoins(n)}</b></span>`;

export function rarityPill(r: Rarity | string | null | undefined, extra = ''): string {
  return `<span class="ri-rpill" style="--rc:${rarityColor(r)}">${esc(rarityName(r))}${extra}</span>`;
}
export function mutationChip(id: string | null | undefined): string {
  if (!id) return '';
  return `<span class="ri-mchip" style="--mc:${mutationColor(id)}">${icon('sparkle')}${esc(mutationName(id))}</span>`;
}
export function attributeChips(ids: string[] | undefined): string {
  return (ids ?? []).map((a) => `<span class="ri-achip">${icon('sparkles')}${esc(attributeName(a))}</span>`).join('');
}
export function sizeChip(size: string | undefined): string {
  if (!size || size === 'normal') return '';
  return `<span class="ri-szchip ri-sz-${esc(size)}">${esc(SIZE_NAMES[size as keyof typeof SIZE_NAMES] ?? size)}</span>`;
}

/** Backpack-style fish cell. */
export function fishCell(u: UIC, f: CaughtFish, o: { selected?: boolean; act?: string; compact?: boolean; showValue?: boolean } = {}): string {
  const def = fishDef(f.fishId);
  const r = def?.rarity ?? 'common';
  return `<button class="ri-fcell${o.selected ? ' sel' : ''}${f.favorite ? ' fav' : ''} r-${r}" style="--rc:${rarityColor(r)}" data-act="${o.act ?? 'fish'}" data-uid="${esc(f.uid)}">
  <span class="ri-fcell-glow"></span>
  ${fishThumb(u, f.fishId, { mutation: f.mutation, attributes: f.attributes }, 'ri-fcell-th')}
  ${f.favorite ? `<span class="ri-fcell-fav">${icon('heart')}</span>` : ''}
  ${f.mutation ? `<span class="ri-fcell-mut" style="--mc:${mutationColor(f.mutation)}" title="${esc(mutationName(f.mutation))}">${esc(mutationName(f.mutation))}</span>` : ''}
  <span class="ri-fcell-name">${esc(def?.name ?? fishName(f.fishId))}</span>
  <span class="ri-fcell-meta"><span>${fmtKg(f.kg)}</span>${o.showValue !== false ? `<span class="ri-fcell-val">${coinIcon()}${fmtCoins(f.value)}</span>` : ''}</span>
  ${o.selected ? `<span class="ri-fcell-check">${icon('check')}</span>` : ''}
</button>`;
}

/** Detailed stat line used in fish detail panes. */
export function fishFacts(f: CaughtFish): string {
  return `<div class="ri-facts">
  <div><span>${icon('weight')}Weight</span><b>${fmtKg(f.kg)} ${sizeChip(f.size)}</b></div>
  <div><span>${coinIcon()}Value</span><b class="gold">${fmtCoins(f.value)}</b></div>
  <div><span>${icon('target')}Odds</span><b>${fmtOdds(f.odds)}</b></div>
  <div><span>${icon('pin')}Caught at</span><b>${esc(zoneName(f.zone))}</b></div>
</div>`;
}

import { LOCATION_BY_ID } from '../data/world';
export function zoneName(id: string | null | undefined): string {
  if (!id) return 'Unknown waters';
  if (id === '*') return 'Anywhere';
  return LOCATION_BY_ID[id]?.name ?? id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ───────────────────────────────────────────── rod stats

export const STAT_META: { key: keyof RodStats; label: string; icon: string; fmt: (v: number) => string; max: number }[] = [
  { key: 'lureSpeed', label: 'Lure speed', icon: 'lure', fmt: (v) => fmtPct(v), max: 1.5 },
  { key: 'luck', label: 'Luck', icon: 'luck', fmt: (v) => fmtPct(v), max: 3 },
  { key: 'control', label: 'Control', icon: 'control', fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`, max: 0.4 },
  { key: 'resilience', label: 'Resilience', icon: 'resilience', fmt: (v) => fmtPct(v), max: 1 },
  { key: 'maxKg', label: 'Max weight', icon: 'weight', fmt: (v) => (Number.isFinite(v) ? fmtKg(v) : 'Unlimited'), max: 100000 },
];

function statFrac(key: keyof RodStats, v: number, max: number): number {
  if (key === 'maxKg') {
    if (!Number.isFinite(v)) return 1;
    return Math.min(1, Math.log10(Math.max(1, v)) / Math.log10(max));
  }
  return Math.max(0, Math.min(1, (v + (key === 'lureSpeed' ? 0.5 : 0)) / (max + (key === 'lureSpeed' ? 0.5 : 0))));
}

/** Stat bars with optional comparison vs another rod (green gain / red loss). */
export function rodStatBars(stats: RodStats, compare?: RodStats | null): string {
  return `<div class="ri-stats">${STAT_META.map((m) => {
    const v = stats[m.key];
    const f = statFrac(m.key, v, m.max);
    let delta = '';
    let cf = f;
    if (compare) {
      const c = compare[m.key];
      cf = statFrac(m.key, c, m.max);
      const d = m.key === 'maxKg' ? (v === c ? 0 : v > c ? 1 : -1) : v - c;
      if (Math.abs(d) > 1e-6) {
        const up = d > 0;
        const txt = m.key === 'maxKg' ? (up ? 'heavier' : 'lighter') : m.key === 'control' ? `${up ? '+' : ''}${d.toFixed(2)}` : fmtPct(d);
        delta = `<i class="${up ? 'up' : 'down'}">${icon(up ? 'arrowUp' : 'arrowDown')}${txt}</i>`;
      }
    }
    const lo = Math.min(f, cf);
    const hi = Math.max(f, cf);
    return `<div class="ri-stat"><span class="ri-stat-l">${icon(m.icon)}${m.label}</span>
      <span class="ri-stat-bar"><b style="width:${(lo * 100).toFixed(1)}%"></b>${compare && hi > lo ? `<em class="${f > cf ? 'up' : 'down'}" style="left:${(lo * 100).toFixed(1)}%;width:${((hi - lo) * 100).toFixed(1)}%"></em>` : ''}</span>
      <span class="ri-stat-v">${m.fmt(v)}${delta}</span></div>`;
  }).join('')}</div>`;
}

export function baitStatsHTML(b: BaitDef): string {
  const rows: string[] = [];
  const s = b.stats;
  const add = (label: string, ic: string, v: number) => {
    if (!v) return;
    rows.push(`<div class="ri-bstat ${v > 0 ? 'up' : 'down'}">${icon(ic)}<span>${label}</span><b>${fmtPct(v)}</b></div>`);
  };
  add('Lure speed', 'lure', s.lureSpeed);
  add('Luck', 'luck', s.luck);
  add('Resilience', 'resilience', s.resilience);
  if (s.preferredLuck) {
    const pref = b.preferred;
    const what = pref?.rarities?.length
      ? pref.rarities.map((r) => rarityName(r)).join(', ') + ' fish'
      : pref?.zones?.length
        ? pref.zones.map(zoneName).join(', ')
        : pref?.time
          ? `${pref.time === 'night' ? 'Night' : 'Day'} fish`
          : pref?.fishIds?.length
            ? pref.fishIds.map(fishName).slice(0, 3).join(', ')
            : 'Preferred fish';
    rows.push(`<div class="ri-bstat up">${icon('target')}<span>${esc(what)}</span><b>${fmtPct(s.preferredLuck)}</b></div>`);
  }
  if (!rows.length) rows.push(`<div class="ri-bstat">${icon('info')}<span>No stat changes</span><b></b></div>`);
  return `<div class="ri-bstats">${rows.join('')}</div>`;
}

export function itemFactsHTML(it: ItemDef): string {
  const rows: string[] = [];
  if (it.potion) {
    const p = it.potion;
    if (p.luckMult) rows.push(`<div class="ri-bstat up">${icon('luck')}<span>Luck</span><b>×${p.luckMult}</b></div>`);
    if (p.lureMult) rows.push(`<div class="ri-bstat up">${icon('lure')}<span>Lure speed</span><b>×${p.lureMult}</b></div>`);
    if (p.xpMult) rows.push(`<div class="ri-bstat up">${icon('xp')}<span>XP</span><b>×${p.xpMult}</b></div>`);
    rows.push(`<div class="ri-bstat">${icon('hourglass')}<span>Duration</span><b>${p.durationMin} min</b></div>`);
  }
  if (it.totem) {
    const t = it.totem;
    if (t.weather) rows.push(`<div class="ri-bstat up">${icon('cloud')}<span>Weather</span><b>${esc(t.weather)}</b></div>`);
    if (t.isNight != null) rows.push(`<div class="ri-bstat up">${icon(t.isNight ? 'moon' : 'sun')}<span>Time</span><b>${t.isNight ? 'Night' : 'Day'}</b></div>`);
    if (t.event) rows.push(`<div class="ri-bstat up">${icon('sparkles')}<span>Event</span><b>${esc(t.event.replace(/_/g, ' '))}</b></div>`);
    rows.push(`<div class="ri-bstat">${icon('hourglass')}<span>Duration</span><b>${t.durationMin} min</b></div>`);
  }
  if (it.relic) rows.push(`<div class="ri-bstat up">${icon('wand')}<span>Enchant pool</span><b class="pool-${it.relic.pool}">${esc(it.relic.pool)}</b></div>`);
  if (it.loot) rows.push(`<div class="ri-bstat">${icon('gift')}<span>Contains</span><b>${it.loot.rolls} rewards</b></div>`);
  return rows.length ? `<div class="ri-bstats">${rows.join('')}</div>` : '';
}

export function passiveHTML(rod: RodDef): string {
  if (!rod.passive) return '';
  return `<div class="ri-passive">${icon('sparkles')}<div><b>${esc(rod.passive.name)}</b><span>${esc(rod.passive.description)}</span></div></div>`;
}

export function emptyState(ic: string, title: string, text: string): string {
  return `<div class="ri-empty">${icon(ic)}<b>${esc(title)}</b><span>${esc(text)}</span></div>`;
}

/** Standard modal chrome. Returns root + body; `setHead` updates title/subtitle. */
export function panelFrame(o: { id: string; title: string; subtitle?: string; icon: string; accent?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; back?: boolean }): {
  root: HTMLElement; body: HTMLElement; head: HTMLElement; tabs: HTMLElement; foot: HTMLElement; setHead(title: string, subtitle?: string): void;
} {
  const root = document.createElement('section');
  root.className = `ri-panel ri-p-${o.id} ri-size-${o.size ?? 'lg'}`;
  if (o.accent) root.style.setProperty('--pa', o.accent);
  root.setAttribute('role', 'dialog');
  root.innerHTML = `<header class="ri-phead">
    ${o.back ? `<button class="ri-iconbtn ri-pback" data-act="__back" aria-label="Back">${icon('back')}</button>` : ''}
    <span class="ri-picon">${icon(o.icon)}</span>
    <div class="ri-ptitles"><h2></h2><p></p></div>
    <div class="ri-phead-x"></div>
    <button class="ri-iconbtn ri-pclose" data-act="__close" aria-label="Close">${icon('close')}</button>
  </header>
  <nav class="ri-tabs"></nav>
  <div class="ri-pbody"></div>
  <footer class="ri-pfoot"></footer>`;
  const h2 = root.querySelector('h2')!;
  const sub = root.querySelector('.ri-ptitles p')!;
  const setHead = (t: string, s?: string) => {
    h2.textContent = t;
    sub.textContent = s ?? '';
    (sub as HTMLElement).style.display = s ? '' : 'none';
  };
  setHead(o.title, o.subtitle);
  return {
    root,
    body: root.querySelector('.ri-pbody') as HTMLElement,
    head: root.querySelector('.ri-phead-x') as HTMLElement,
    tabs: root.querySelector('.ri-tabs') as HTMLElement,
    foot: root.querySelector('.ri-pfoot') as HTMLElement,
    setHead,
  };
}

export function tabsHTML(tabs: { id: string; label: string; icon?: string; count?: number | string }[], active: string): string {
  return tabs
    .map((t) => `<button class="ri-tab${t.id === active ? ' on' : ''}" data-act="__tab" data-tab="${esc(t.id)}">${t.icon ? icon(t.icon) : ''}<span>${esc(t.label)}</span>${t.count != null && t.count !== '' ? `<em>${esc(t.count)}</em>` : ''}</button>`)
    .join('');
}

/** Save and restore scroll positions of [data-scroll] containers around a re-render. */
export function keepScroll(root: HTMLElement, fn: () => void): void {
  const pos = new Map<string, number>();
  root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((e) => pos.set(e.dataset.scroll!, e.scrollTop));
  fn();
  root.querySelectorAll<HTMLElement>('[data-scroll]').forEach((e) => {
    const v = pos.get(e.dataset.scroll!);
    if (v) e.scrollTop = v;
  });
}

export { esc, fmtCoins, fmtKg, fmtOdds, fmtPct, rarityColor, rarityName, mutationName, mutationColor, fishDef, fishName };
