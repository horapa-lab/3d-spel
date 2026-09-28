// OWNER: ui. Rod collection: stats, passive, enchants, equip; unowned rods show how to obtain.
import type { PanelFactory } from './host';
import { keepScroll, panelFrame, passiveHTML, rodStatBars, rodThumb, tabsHTML, zoneName } from '../common';
import { coinIcon, icon } from '../icons';
import { esc, fmtCoins } from '../util';
import { RODS, ROD_BY_ID } from '../../data/rods';

export const rodsPanel: PanelFactory = (u, data, nav) => {
  const fr = panelFrame({ id: 'rods', title: 'Rods', icon: 'rod', back: !!nav.back });
  let sel = String(data.rodId ?? u.eco.save.equippedRod ?? '');
  let tab: 'owned' | 'all' = 'owned';

  function render() {
    const save = u.eco.save;
    const ownedIds = new Set(save.rods ?? []);
    const all = [...RODS].sort((a, b) => a.tier - b.tier || a.price - b.price);
    fr.setHead('Rods', `${ownedIds.size} / ${all.length} collected`);
    fr.tabs.innerHTML = tabsHTML([{ id: 'owned', label: 'My rods', icon: 'rod', count: ownedIds.size }, { id: 'all', label: 'Collection', icon: 'book', count: all.length }], tab);
    const list = tab === 'owned' ? all.filter((r) => ownedIds.has(r.id)) : all;
    if (!list.some((r) => r.id === sel)) sel = list[0]?.id ?? '';
    const rod = ROD_BY_ID[sel];
    keepScroll(fr.body, () => {
      fr.body.innerHTML = `<div class="ri-split">
      <div class="ri-list" data-scroll="list">${list
        .map((r) => {
          const own = ownedIds.has(r.id);
          const eq = save.equippedRod === r.id;
          return `<button class="ri-row${r.id === sel ? ' sel' : ''}${own ? '' : ' unowned'}" data-act="sel" data-id="${esc(r.id)}">
            <span class="ri-row-th">${rodThumb(u, r.id)}</span>
            <span class="ri-row-t"><b>${esc(r.name)}</b><small>Tier ${r.tier}${r.passive ? ` · ${esc(r.passive.name)}` : ''}</small></span>
            ${eq ? `<em class="ri-tag teal">${icon('check')}Equipped</em>` : own ? '' : `<em class="ri-tag">${icon('lock')}</em>`}
          </button>`;
        })
        .join('')}</div>
      <div class="ri-detail" data-scroll="detail">${rod ? detail(rod.id) : ''}</div></div>`;
    });
    fr.foot.innerHTML = '';
  }

  function detail(id: string): string {
    const rod = ROD_BY_ID[id];
    const save = u.eco.save;
    const own = save.rods?.includes(id);
    const eq = save.equippedRod === id;
    let ench: { name: string; description: string; pool: string }[] = [];
    try {
      ench = u.eco.rodEnchants(id) ?? [];
    } catch {
      ench = [];
    }
    const eqRod = ROD_BY_ID[save.equippedRod];
    const stats = eq ? safeStats(() => u.eco.effectiveRodStats()) ?? rod.stats : rod.stats;
    return `<div class="ri-det-hero rod"><div class="ri-det-glow"></div>${rodThumb(u, id, 'ri-det-th')}</div>
      <div class="ri-det-head"><h3>${esc(rod.name)}</h3><span class="ri-tier">Tier ${rod.tier}</span>${eq ? `<span class="ri-tag teal">${icon('check')}Equipped</span>` : ''}</div>
      <p class="ri-det-desc">${esc(rod.description)}</p>
      ${!eq && eqRod ? `<div class="ri-cmp-note">Compared to your <b>${esc(eqRod.name)}</b></div>` : eq ? '<div class="ri-cmp-note">Including enchants & boosts</div>' : ''}
      ${rodStatBars(stats, !eq && eqRod ? eqRod.stats : null)}
      ${passiveHTML(rod)}
      ${ench.length ? `<div class="ri-sec">${icon('wand')}Enchants</div>${ench.map((e) => `<div class="ri-ench pool-${esc(e.pool)}">${icon('sparkles')}<div><b>${esc(e.name)}</b><span>${esc(e.description)}</span></div></div>`).join('')}` : own ? `<div class="ri-hintline">${icon('wand')}No enchant yet — bring a relic to the Keeper’s altar at night.</div>` : ''}
      <div class="ri-det-act">${
        own
          ? eq
            ? `<button class="ri-btn wide" disabled>${icon('check')}Equipped</button>`
            : `<button class="ri-btn teal wide" data-act="equip" data-id="${esc(id)}">${icon('rod')}Equip</button>`
          : `<div class="ri-obtain">${icon('info')}<div><b>How to get it</b><span>${esc(rod.obtainHint || (rod.soldAt ? `Sold at ${zoneName(rod.soldAt)}` : 'Unknown'))}</span>${rod.price > 0 ? `<span class="ri-price">${coinIcon()}${fmtCoins(rod.price)} · Lv ${rod.unlockLevel}</span>` : ''}</div></div>`
      }</div>`;
  }

  fr.root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    if (t.dataset.act === '__tab') {
      tab = t.dataset.tab as typeof tab;
      render();
    } else if (t.dataset.act === 'sel') {
      sel = t.dataset.id!;
      u.sfx('ui_click');
      render();
    } else if (t.dataset.act === 'equip') {
      let ok = false;
      try {
        ok = u.eco.equipRod(t.dataset.id!);
        if (ok) u.game.player?.equipRod?.(t.dataset.id!);
      } catch (err) {
        console.error(err);
      }
      if (ok) {
        u.sfx('equip');
        u.toast(`Equipped ${ROD_BY_ID[t.dataset.id!]?.name}`, 'good', 'rod');
      }
      render();
    }
  });

  return { root: fr.root, render };
};

function safeStats<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
