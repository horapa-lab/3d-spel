// OWNER: ui. Small DOM + formatting helpers shared by every UI module.
import type { CaughtFish, FishDef, Rarity, SizeLabel } from '../core/types';
import { RARITIES } from '../data/rarities';
import { FISH_BY_ID } from '../data/fish';
import { MUTATION_BY_ID, ATTRIBUTE_BY_ID } from '../data/mutations';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const fmtInt = (n: number): string => (Number.isFinite(n) ? nf.format(Math.round(n)) : '∞');

/** Coins: full digits up to 1M, then compact (1.25M, 3.4B). */
export function fmtCoins(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 1_000_000) return fmtInt(n);
  if (a < 1e9) return `${trim(n / 1e6, a < 1e7 ? 2 : 1)}M`;
  if (a < 1e12) return `${trim(n / 1e9, 2)}B`;
  return `${trim(n / 1e12, 2)}T`;
}
/** Very compact: 950, 12.4K, 1.2M. */
export function fmtShort(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 10_000) return fmtInt(n);
  if (a < 1e6) return `${trim(n / 1e3, a < 1e5 ? 1 : 0)}K`;
  return fmtCoins(n);
}
function trim(v: number, d: number): string {
  return v.toFixed(d).replace(/\.?0+$/, '');
}

export function fmtKg(kg: number): string {
  if (!Number.isFinite(kg)) return '∞ kg';
  if (kg < 1) return `${kg.toFixed(2)} kg`;
  if (kg < 100) return `${kg.toFixed(1)} kg`;
  return `${fmtInt(kg)} kg`;
}

/** 75 → "1:15", 3725 → "1:02:05" (input seconds). */
export function fmtClock(sec: number): string {
  if (!Number.isFinite(sec)) return '--:--';
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
/** Human duration: "3m", "1h 20m", "45s". */
export function fmtDur(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}
export const fmtOdds = (n: number): string => (n > 0 && Number.isFinite(n) ? `1 in ${fmtInt(n)}` : '—');
export const fmtPct = (f: number, signed = true): string => `${signed && f > 0 ? '+' : ''}${Math.round(f * 100)}%`;

export function rarityColor(r: Rarity | string | null | undefined): string {
  return (r && RARITIES[r as Rarity]?.color) || '#e8edf2';
}
export function rarityName(r: Rarity | string | null | undefined): string {
  return (r && RARITIES[r as Rarity]?.name) || 'Unknown';
}
export function rarityOrder(r: Rarity | string | null | undefined): number {
  return (r && RARITIES[r as Rarity]?.order) ?? 0;
}

export const SIZE_NAMES: Record<SizeLabel, string> = { tiny: 'Tiny', small: 'Small', normal: 'Normal', big: 'Big', giant: 'Giant' };

/** Fish def lookup that tolerates unknown ids (dev data, removed fish). */
const extraFish: Record<string, FishDef> = {};
export function registerExtraFish(defs: FishDef[]): void {
  for (const d of defs) extraFish[d.id] = d;
}
export function fishDef(id: string): FishDef | null {
  return FISH_BY_ID[id] ?? extraFish[id] ?? null;
}
export function fishName(id: string): string {
  return fishDef(id)?.name ?? prettyId(id);
}
export function prettyId(id: string): string {
  return id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mutationColor(id: string | null | undefined): string {
  if (!id) return '#9fb6c6';
  const m = MUTATION_BY_ID[id];
  if (!m) return '#9fb6c6';
  return m.visual.emissive && (m.visual.emissiveStrength ?? 0) > 0.5 ? m.visual.emissive : m.visual.tint;
}
export function mutationName(id: string | null | undefined): string {
  if (!id) return '';
  return MUTATION_BY_ID[id]?.name ?? prettyId(id);
}
export function attributeName(id: string): string {
  return ATTRIBUTE_BY_ID[id]?.name ?? prettyId(id);
}

/** Relative luminance-based readable text colour for a background hex. */
export function inkFor(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length < 6) return '#08131d';
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return l > 0.55 ? '#08131d' : '#ffffff';
}

export function sortFish(list: CaughtFish[], mode: 'value' | 'rarity' | 'weight' | 'recent' | 'name'): CaughtFish[] {
  const arr = [...list];
  const rOrd = (f: CaughtFish) => rarityOrder(fishDef(f.fishId)?.rarity);
  switch (mode) {
    case 'value': arr.sort((a, b) => b.value - a.value); break;
    case 'rarity': arr.sort((a, b) => rOrd(b) - rOrd(a) || b.value - a.value); break;
    case 'weight': arr.sort((a, b) => b.kg - a.kg); break;
    case 'name': arr.sort((a, b) => fishName(a.fishId).localeCompare(fishName(b.fishId))); break;
    default: arr.sort((a, b) => b.caughtAt - a.caughtAt);
  }
  return arr;
}

/** Game-clock string from dayProgress (0 = sunrise 06:00, 0.25 = noon, 0.5 = 18:00, 0.75 = midnight). */
export function gameTime(dayProgress: number): { h: number; m: number; text: string } {
  const mins = ((((dayProgress % 1) + 1) % 1) * 24 * 60 + 6 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return { h, m, text: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}

export const now = () => Date.now();

/** Deterministic string hash → 0..1 (dev data, decorative variation). */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
