// OWNER: ui. NPC dialog: portrait, name, role, a line, role-based options.
import type { NpcDef } from '../../core/types';
import type { PanelFactory } from './host';
import { npcThumb, zoneName } from '../common';
import { coinIcon, icon } from '../icons';
import { el, esc, fmtClock, fmtCoins } from '../util';
import { NPC_BY_ID } from '../../data/npcs';
import { ITEM_BY_ID } from '../../data/items';
import { LOCATIONS } from '../../data/world';

export const ROLE_TITLE: Record<NpcDef['role'], string> = {
  merchant: 'Merchant',
  shipwright: 'Shipwright',
  appraiser: 'Appraiser',
  angler: 'Angler',
  totem_carver: 'Totem Carver',
  keeper: 'Keeper of the Altar',
  treasure_hunter: 'Treasure Hunter',
  innkeeper: 'Innkeeper',
  bait_vendor: 'Bait Vendor',
  rod_crafter: 'Rod Crafter',
  bestiary_keeper: 'Archivist',
  villager: 'Villager',
};
export const ROLE_ICON: Record<NpcDef['role'], string> = {
  merchant: 'shop', shipwright: 'anchor', appraiser: 'appraise', angler: 'quest', totem_carver: 'totem', keeper: 'wand',
  treasure_hunter: 'map', innkeeper: 'bed', bait_vendor: 'bait', rod_crafter: 'rod', bestiary_keeper: 'book', villager: 'user',
};

interface Opt { id: string; label: string; icon: string; sub?: string; disabled?: boolean; accent?: 'gold' | 'teal' | 'violet'; badge?: string }

export const dialogPanel: PanelFactory = (u, data, nav) => {
  const npc = NPC_BY_ID[String(data.npcId ?? '')] ?? null;
  const root = el('section', 'ri-dialog');
  let lineIdx = Math.floor(Math.random() * Math.max(1, npc?.lines.length ?? 1));
  let line = npc?.lines[lineIdx] ?? '…';
  let typed = 0;
  let confirmSellAll = false;
  let override: string | null = null;

  function options(): Opt[] {
    if (!npc) return [];
    const o: Opt[] = [];
    const save = u.eco.save;
    switch (npc.role) {
      case 'merchant': {
        const sellable = (save.backpack ?? []).filter((f) => !f.favorite);
        const total = Math.round(sellable.reduce((s, f) => s + f.value, 0) * safeMult(() => u.eco.sellMultiplier()));
        o.push({ id: 'shop', label: 'Browse shop', icon: 'shop', accent: 'teal' });
        o.push({ id: 'sell', label: 'Sell fish…', icon: 'tag', sub: `${save.backpack?.length ?? 0} in backpack` });
        o.push({
          id: 'sellall', label: confirmSellAll ? 'Confirm: sell all' : 'Sell all', icon: 'sellAll', accent: 'gold',
          sub: sellable.length ? `${sellable.length} fish · ${fmtCoins(total)} coins` : 'Nothing to sell', disabled: !sellable.length,
        });
        break;
      }
      case 'bait_vendor':
        o.push({ id: 'shop', label: 'Buy bait & crates', icon: 'bait', accent: 'teal' });
        break;
      case 'rod_crafter':
        o.push({ id: 'shop', label: 'Browse rods', icon: 'rod', accent: 'teal' });
        break;
      case 'totem_carver':
        o.push({ id: 'shop', label: 'Browse totems', icon: 'totem', accent: 'teal' });
        break;
      case 'appraiser':
        o.push({ id: 'appraise', label: 'Appraise a fish', icon: 'appraise', accent: 'violet', sub: 'Re-roll weight & mutation' });
        break;
      case 'angler': {
        const qst = safe(() => u.eco.questFor(npc.id), null);
        const cd = save.questCooldowns?.[npc.id] ?? 0;
        const has = qst ? (save.backpack ?? []).some((f) => f.fishId === qst.fishId) : false;
        o.push({ id: 'quest', label: qst ? (has ? 'Hand in quest' : 'Current request') : 'Ask for work', icon: 'quest', accent: 'gold', badge: has ? '!' : undefined, sub: !qst && cd > Date.now() ? `Back in ${fmtClock((cd - Date.now()) / 1000)}` : undefined });
        break;
      }
      case 'keeper': {
        const night = u.isNight();
        const ms = safe(() => u.clock.msUntilPhaseChange(), NaN);
        o.push({ id: 'enchant', label: 'Enchant a rod', icon: 'wand', accent: 'violet', disabled: !night, sub: night ? 'The altar is awake' : `Altar sleeps · night in ${Number.isFinite(ms) ? fmtClock(ms / 1000) : '—'}` });
        break;
      }
      case 'treasure_hunter': {
        const maps = mapItems();
        o.push({ id: 'decode', label: 'Decode a map', icon: 'map', accent: 'gold', disabled: !maps.length && !(save.treasureMaps ?? []).some((m) => !m.target), sub: maps.length ? `${maps.length} map${maps.length > 1 ? 's' : ''} to decode` : 'Bring me a treasure map' });
        if (safe(() => u.eco.shopFor(npc.id).length, 0)) o.push({ id: 'shop', label: 'Trade', icon: 'shop' });
        break;
      }
      case 'shipwright':
        o.push({ id: 'boats', label: 'Boats', icon: 'boat', accent: 'teal' });
        o.push({ id: 'spawnboat', label: 'Launch my boat', icon: 'anchor', disabled: !(save.boats?.length), sub: save.boats?.length ? 'At the nearest dock' : 'You don’t own a boat yet' });
        break;
      case 'bestiary_keeper': {
        const claim = claimable();
        o.push({ id: 'bestiary', label: 'Bestiary rewards', icon: 'book', accent: 'gold', badge: claim ? String(claim) : undefined, sub: claim ? `${claim} page${claim > 1 ? 's' : ''} ready to claim` : 'Complete a page to earn rewards' });
        break;
      }
      case 'innkeeper': {
        const here = save.spawn?.location === npc.location;
        o.push({ id: 'rest', label: here ? 'Rest a while' : 'Rest & set spawn here', icon: 'bed', accent: 'teal', sub: here ? 'Your spawn point is here' : `Respawn at ${zoneName(npc.location)}` });
        break;
      }
      default:
        break;
    }
    o.push({ id: 'bye', label: 'Goodbye', icon: 'exit' });
    return o;
  }

  function mapItems(): string[] {
    const items = u.eco.save.items ?? {};
    return Object.keys(items).filter((id) => (items[id] ?? 0) > 0 && ITEM_BY_ID[id]?.kind === 'treasure_map');
  }
  function claimable(): number {
    let n = 0;
    for (const l of LOCATIONS) {
      const p = safe(() => u.eco.bestiaryProgress(l.id), { caught: 0, total: 0, claimed: false });
      if (p.total > 0 && p.caught >= p.total && !p.claimed) n++;
    }
    return n;
  }

  function say(text: string) {
    override = text;
    line = text;
    typed = 0;
    render();
  }

  function render() {
    if (!npc) {
      root.innerHTML = `<div class="ri-dlg-main"><p class="ri-dlg-line">Nobody’s here.</p></div>`;
      return;
    }
    const opts = options();
    root.innerHTML = `
    <div class="ri-dlg-portrait"><span class="ri-dlg-frame">${npcThumb(u, npc.id, 'ri-dlg-th')}</span><span class="ri-dlg-roleic">${icon(ROLE_ICON[npc.role])}</span></div>
    <div class="ri-dlg-main">
      <div class="ri-dlg-name"><b>${esc(npc.name)}</b><span>${esc(ROLE_TITLE[npc.role])} · ${esc(zoneName(npc.location))}</span></div>
      <p class="ri-dlg-line"><span class="ri-dlg-typed"></span><span class="ri-dlg-rest"></span></p>
      <div class="ri-dlg-opts">${opts
        .map(
          (o, i) => `<button class="ri-dopt${o.accent ? ` a-${o.accent}` : ''}${o.id === 'bye' ? ' bye' : ''}" data-opt="${o.id}"${o.disabled ? ' disabled' : ''}>
          <kbd>${i + 1}</kbd><span class="ri-dopt-ic">${icon(o.icon)}</span><span class="ri-dopt-t"><b>${esc(o.label)}</b>${o.sub ? `<small>${o.id === 'sellall' && !o.disabled ? coinIcon() : ''}${esc(o.sub)}</small>` : ''}</span>${o.badge ? `<em>${esc(o.badge)}</em>` : ''}</button>`,
        )
        .join('')}</div>
    </div>
    <button class="ri-iconbtn ri-dlg-x" data-act="__close" aria-label="Close">${icon('close')}</button>`;
    paintLine();
  }
  function paintLine() {
    const a = root.querySelector('.ri-dlg-typed');
    const b = root.querySelector('.ri-dlg-rest');
    if (!a || !b) return;
    const n = Math.floor(typed);
    a.textContent = `“${line.slice(0, n)}`;
    b.textContent = `${line.slice(n)}”`;
  }

  async function choose(id: string) {
    if (!npc) return;
    u.sfx('ui_click');
    const save = u.eco.save;
    switch (id) {
      case 'shop': nav.go('shop', { npcId: npc.id }); break;
      case 'sell': nav.go('backpack', { sell: true, npcId: npc.id }); break;
      case 'sellall': {
        if (!confirmSellAll) {
          confirmSellAll = true;
          render();
          return;
        }
        confirmSellAll = false;
        const n = (save.backpack ?? []).filter((f) => !f.favorite).length;
        const got = safe(() => u.eco.sellAll(), 0);
        if (got > 0 || n > 0) {
          u.toast(`Sold ${n} fish for ${fmtCoins(got)} coins`, 'good', 'coinsStack');
          u.sfx('sell');
          say(n > 5 ? 'Now that’s a haul! Pleasure doing business.' : 'Thank you kindly. Come back with more!');
        }
        break;
      }
      case 'appraise': nav.go('appraiser', { npcId: npc.id }); break;
      case 'quest': nav.go('quest', { npcId: npc.id }); break;
      case 'enchant': nav.go('enchant', { npcId: npc.id }); break;
      case 'boats': nav.go('boats', { npcId: npc.id }); break;
      case 'bestiary': nav.go('bestiary', { claim: true, npcId: npc.id }); break;
      case 'spawnboat': {
        const ok = safe(() => u.game.player.spawnBoat(), false);
        if (ok) {
          u.toast('Your boat is waiting at the dock', 'good', 'boat');
          nav.close();
        } else say('No room at the dock right now — try again near the water.');
        break;
      }
      case 'decode': {
        const maps = mapItems();
        const eco = u.eco as typeof u.eco & { decodeMap?: (itemId?: string) => { ok: boolean; message: string } };
        let res: { ok: boolean; message: string } | null = null;
        if (typeof eco.decodeMap === 'function') res = safe(() => eco.decodeMap!(maps[0]), null);
        else if (maps.length) res = safe(() => u.eco.useItem(maps[0]), null);
        if (res?.ok) {
          u.toast(res.message || 'Map decoded! Check your world map.', 'rare', 'map');
          say('There — X marks the spot. Mind the sharks.');
        } else say(res?.message || 'That scrap of paper? Worthless. Bring me a real map.');
        break;
      }
      case 'rest': {
        if (save.spawn) save.spawn.location = npc.location;
        u.save();
        restFx();
        u.toast(`Spawn point set: ${zoneName(npc.location)}`, 'good', 'bed');
        say(npc.lines[0] ?? 'Sleep well.');
        break;
      }
      case 'bye':
      default:
        nav.close();
    }
  }

  function restFx() {
    const fx = el('div', 'ri-restfx', `<span>${icon('moon')}<b>Z</b><b>z</b><b>z</b></span>`);
    u.root.appendChild(fx);
    setTimeout(() => fx.classList.add('out'), 1300);
    setTimeout(() => fx.remove(), 2000);
  }

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-opt]');
    if (b && !b.hasAttribute('disabled')) choose(b.dataset.opt!);
    else if ((e.target as HTMLElement).closest('.ri-dlg-line')) typed = line.length;
  });

  return {
    root,
    kind: 'dialog',
    render,
    update(dt) {
      if (typed < line.length) {
        typed = Math.min(line.length, typed + dt * 55);
        paintLine();
      }
    },
    onKey(e) {
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const b = root.querySelectorAll<HTMLElement>('[data-opt]')[n - 1];
        if (b && !b.hasAttribute('disabled')) choose(b.dataset.opt!);
        return true;
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (typed < line.length) typed = line.length;
        else if (!override && npc && npc.lines.length > 1) {
          lineIdx = (lineIdx + 1) % npc.lines.length;
          line = npc.lines[lineIdx];
          typed = 0;
          paintLine();
        }
        return true;
      }
      return false;
    },
  };
};

function safe<T>(fn: () => T, fb: T): T {
  try {
    return fn() ?? fb;
  } catch {
    return fb;
  }
}
function safeMult(fn: () => number): number {
  const v = safe(fn, 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}
