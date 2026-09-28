// OWNER: ui. Shop: tabs by kind, stat comparison vs equipped, level locks, buy/equip.
import type { ShopEntry } from '../../core/types';
import type { PanelFactory } from './host';
import {
  baitStatsHTML, baitThumb, boatThumb, coins, emptyState, itemFactsHTML, itemThumb, keepScroll, panelFrame, passiveHTML, rarityPill, rodStatBars, rodThumb, tabsHTML, zoneName,
} from '../common';
import { coinIcon, icon } from '../icons';
import { esc, fmtCoins, fmtInt } from '../util';
import { NPC_BY_ID } from '../../data/npcs';
import { ROD_BY_ID } from '../../data/rods';
import { BAIT_BY_ID } from '../../data/baits';
import { ITEM_BY_ID } from '../../data/items';
import { BOAT_BY_ID } from '../../data/boats';

const KIND_TAB: Record<ShopEntry['kind'], { label: string; icon: string }> = {
  rod: { label: 'Rods', icon: 'rod' },
  bait: { label: 'Bait', icon: 'bait' },
  item: { label: 'Items', icon: 'gift' },
  bobber: { label: 'Bobbers', icon: 'bobber' },
  boat: { label: 'Boats', icon: 'boat' },
};

export function entryName(e: ShopEntry): string {
  return (e.kind === 'rod' ? ROD_BY_ID[e.id]?.name : e.kind === 'bait' ? BAIT_BY_ID[e.id]?.name : e.kind === 'boat' ? BOAT_BY_ID[e.id]?.name : ITEM_BY_ID[e.id]?.name) ?? e.id;
}

export const shopPanel: PanelFactory = (u, data, nav) => {
  const npcId = String(data.npcId ?? '');
  const npc = NPC_BY_ID[npcId];
  const fr = panelFrame({ id: 'shop', title: npc ? `${npc.name.split(' ')[0]}’s Shop` : 'Shop', subtitle: npc ? zoneName(npc.location) : undefined, icon: 'shop', back: !!nav.back });
  let entries: ShopEntry[] = [];
  let tab: ShopEntry['kind'] | '' = '';
  let sel = 0;
  let qty = 1;
  let bought = false;
  let flash = '';

  function load() {
    try {
      entries = u.eco.shopFor(npcId) ?? [];
    } catch {
      entries = [];
    }
  }
  function owned(e: ShopEntry): boolean {
    const s = u.eco.save;
    if (e.owned != null) return e.owned;
    if (e.kind === 'rod') return s.rods?.includes(e.id);
    if (e.kind === 'boat') return s.boats?.includes(e.id);
    if (e.kind === 'bobber') return s.bobbers?.includes(e.id);
    return false;
  }
  function count(e: ShopEntry): number {
    const s = u.eco.save;
    if (e.kind === 'bait') return s.baits?.[e.id] ?? 0;
    if (e.kind === 'item') return s.items?.[e.id] ?? 0;
    return 0;
  }
  const stackable = (e: ShopEntry) => e.kind === 'bait' || e.kind === 'item';

  function thumb(e: ShopEntry, cls: string) {
    if (e.kind === 'rod') return rodThumb(u, e.id, cls);
    if (e.kind === 'bait') return baitThumb(u, e.id, cls);
    if (e.kind === 'boat') return boatThumb(u, e.id, cls);
    return itemThumb(u, e.id, cls);
  }
  function rarityOf(e: ShopEntry) {
    return e.kind === 'bait' ? BAIT_BY_ID[e.id]?.rarity : e.kind === 'item' || e.kind === 'bobber' ? ITEM_BY_ID[e.id]?.rarity : null;
  }

  function render() {
    load();
    const kinds = [...new Set(entries.map((e) => e.kind))];
    if (!tab || !kinds.includes(tab as ShopEntry['kind'])) tab = kinds[0] ?? '';
    fr.tabs.innerHTML = kinds.length > 1 ? tabsHTML(kinds.map((k) => ({ id: k, label: KIND_TAB[k].label, icon: KIND_TAB[k].icon, count: entries.filter((e) => e.kind === k).length })), tab) : '';
    fr.head.innerHTML = coins(u.eco.coins(), 'big');
    const list = entries.filter((e) => e.kind === tab);
    if (!list.length) {
      fr.body.innerHTML = emptyState('shop', 'Sold out', 'Nothing for sale here right now. Come back later!');
      fr.foot.innerHTML = '';
      return;
    }
    sel = Math.min(sel, list.length - 1);
    const lvl = u.eco.level();
    const money = u.eco.coins();
    keepScroll(fr.body, () => {
      fr.body.innerHTML = `<div class="ri-split">
        <div class="ri-grid ri-shopgrid" data-scroll="grid">${list
          .map((e, i) => {
            const locked = e.unlockLevel > lvl;
            const own = owned(e);
            const r = rarityOf(e);
            const price = own && !stackable(e) ? `<span class="ri-owned">${icon('check')}Owned</span>` : locked ? `<span class="ri-lockp">${icon('lock')}Lv ${e.unlockLevel}</span>` : `<span class="ri-price${money < e.price ? ' short' : ''}">${coinIcon()}${fmtCoins(e.price)}</span>`;
            return `<button class="ri-scard${i === sel ? ' sel' : ''}${locked ? ' locked' : ''}${own ? ' own' : ''}" data-act="sel" data-i="${i}" ${r ? `style="--rc:var(--r-${r})"` : ''}>
              <span class="ri-scard-th">${thumb(e, '')}</span>
              <span class="ri-scard-name">${esc(entryName(e))}</span>
              ${price}
              ${stackable(e) && count(e) ? `<em class="ri-scard-n">×${fmtInt(count(e))}</em>` : ''}
            </button>`;
          })
          .join('')}</div>
        <div class="ri-detail" data-scroll="detail">${detail(list[sel])}</div>
      </div>`;
    });
    fr.foot.innerHTML = '';
  }

  function detail(e: ShopEntry): string {
    const lvl = u.eco.level();
    const money = u.eco.coins();
    const locked = e.unlockLevel > lvl;
    const own = owned(e);
    let body = '';
    let title = entryName(e);
    let sub = '';
    let desc = '';
    if (e.kind === 'rod') {
      const rod = ROD_BY_ID[e.id];
      const eq = u.eco.equippedRod?.() ?? ROD_BY_ID[u.eco.save.equippedRod];
      desc = rod?.description ?? '';
      sub = `<span class="ri-tier">Tier ${rod?.tier ?? '?'}</span>`;
      body = rod
        ? `<div class="ri-cmp-note">${eq && eq.id !== rod.id ? `Compared to your <b>${esc(eq.name)}</b>` : 'Your equipped rod'}</div>${rodStatBars(rod.stats, eq && eq.id !== rod.id ? eq.stats : null)}${passiveHTML(rod)}`
        : '';
    } else if (e.kind === 'bait') {
      const b = BAIT_BY_ID[e.id];
      desc = b?.description ?? '';
      sub = rarityPill(b?.rarity);
      body = b ? baitStatsHTML(b) : '';
    } else if (e.kind === 'boat') {
      const b = BOAT_BY_ID[e.id];
      desc = b?.description ?? '';
      body = b ? `<div class="ri-bstats"><div class="ri-bstat up">${icon('sprint')}<span>Top speed</span><b>${b.speed} m/s</b></div><div class="ri-bstat up">${icon('refresh')}<span>Turning</span><b>${b.turnRate.toFixed(1)} rad/s</b></div></div>` : '';
    } else {
      const it = ITEM_BY_ID[e.id];
      desc = it?.description ?? '';
      sub = rarityPill(it?.rarity);
      body = it ? itemFactsHTML(it) : '';
    }
    const total = e.price * (stackable(e) ? qty : 1);
    let action = '';
    if (locked) action = `<button class="ri-btn wide" disabled>${icon('lock')}Unlocks at level ${e.unlockLevel}</button>`;
    else if (own && !stackable(e)) {
      if (e.kind === 'rod') {
        const eq = u.eco.save.equippedRod === e.id;
        action = eq ? `<button class="ri-btn wide" disabled>${icon('check')}Equipped</button>` : `<button class="ri-btn teal wide" data-act="equip">${icon('rod')}Equip</button>`;
      } else if (e.kind === 'boat') action = `<button class="ri-btn teal wide" data-act="equip">${icon('boat')}${u.eco.save.equippedBoat === e.id ? 'Selected' : 'Select boat'}</button>`;
      else if (e.kind === 'bobber') action = `<button class="ri-btn teal wide" data-act="equip">${icon('bobber')}${u.eco.save.equippedBobber === e.id ? 'Equipped' : 'Equip'}</button>`;
    } else {
      action = `${stackable(e) ? `<div class="ri-qty">${[1, 5, 10, 25].map((n) => `<button class="${qty === n ? 'on' : ''}" data-act="qty" data-n="${n}">×${n}</button>`).join('')}</div>` : ''}
        <button class="ri-btn gold wide buy" data-act="buy"${money < total ? ' disabled' : ''}>${icon('shop')}Buy<span class="ri-btn-price">${coinIcon()}${fmtCoins(total)}</span></button>
        ${money < total ? `<div class="ri-short">${icon('info')}You need ${fmtCoins(total - money)} more coins</div>` : ''}`;
    }
    return `<div class="ri-det-hero${flash === e.id ? ' pop' : ''}"><div class="ri-det-glow"></div>${thumb(e, 'ri-det-th')}</div>
      <div class="ri-det-head"><h3>${esc(title)}</h3>${sub}${stackable(e) && count(e) ? `<span class="ri-have">You have ×${fmtInt(count(e))}</span>` : ''}</div>
      <p class="ri-det-desc">${esc(desc)}</p>
      ${body}
      <div class="ri-det-act">${action}</div>`;
  }

  fr.root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    const list = entries.filter((e) => e.kind === tab);
    const e = list[sel];
    switch (t.dataset.act) {
      case '__tab': tab = t.dataset.tab as ShopEntry['kind']; sel = 0; qty = 1; u.sfx('ui_tab'); render(); break;
      case 'sel': sel = Number(t.dataset.i); qty = 1; u.sfx('ui_click'); render(); break;
      case 'qty': qty = Number(t.dataset.n); render(); break;
      case 'buy': {
        if (!e) break;
        let ok = false;
        try {
          ok = u.eco.buy(e, stackable(e) ? qty : 1);
        } catch (err) {
          console.error(err);
        }
        if (ok) {
          bought = true;
          flash = e.id;
          u.sfx('buy');
          u.toast(`Purchased ${entryName(e)}${stackable(e) && qty > 1 ? ` ×${qty}` : ''}`, 'good', 'shop');
          setTimeout(() => (flash = ''), 600);
        } else u.toast('Purchase failed', 'bad', 'warn');
        render();
        break;
      }
      case 'equip': {
        if (!e) break;
        let ok = false;
        try {
          ok = e.kind === 'rod' ? u.eco.equipRod(e.id) : e.kind === 'boat' ? u.eco.equipBoat(e.id) : u.eco.equipBobber(e.id);
          if (ok && e.kind === 'rod') u.game.player?.equipRod?.(e.id);
        } catch (err) {
          console.error(err);
        }
        if (ok) u.toast(`Equipped ${entryName(e)}`, 'good', 'check');
        render();
        break;
      }
    }
  });

  return {
    root: fr.root,
    render,
    onClose() {
      if (bought) u.game.platform.midgame?.().catch(() => undefined);
    },
  };
};
