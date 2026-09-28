// OWNER: ui. Backpack: thumbnail grid, sort/filter, favourite, sell selected/all at a merchant.
import type { CaughtFish, Rarity } from '../../core/types';
import type { PanelFactory } from './host';
import { attributeChips, emptyState, fishCell, fishFacts, fishThumb, keepScroll, mutationChip, panelFrame, rarityPill, tabsHTML } from '../common';
import { coinIcon, icon } from '../icons';
import { esc, fishDef, fmtCoins, rarityOrder, sortFish } from '../util';
import { NPC_BY_ID } from '../../data/npcs';
import { RARITY_ORDER } from '../../data/rarities';

type SortMode = 'recent' | 'value' | 'rarity' | 'weight';

export const backpackPanel: PanelFactory = (u, data, nav) => {
  const fr = panelFrame({ id: 'backpack', title: 'Backpack', icon: 'backpack', back: !!nav.back });
  let sort: SortMode = 'recent';
  let filter: 'all' | 'fav' | Rarity = 'all';
  let selUid = '';
  const picked = new Set<string>();

  const merchant = () => (data.sell ? String(data.npcId ?? '') || 'merchant' : u.merchantNearby());
  const mult = () => {
    try {
      const m = u.eco.sellMultiplier();
      return Number.isFinite(m) && m > 0 ? m : 1;
    } catch {
      return 1;
    }
  };

  function render() {
    const save = u.eco.save;
    const all = save.backpack ?? [];
    const size = save.backpackSize ?? 30;
    const total = all.reduce((s, f) => s + f.value, 0);
    fr.setHead('Backpack', `${all.length} / ${size} fish · worth ${fmtCoins(total)} coins`);
    const present = RARITY_ORDER.filter((r) => all.some((f) => fishDef(f.fishId)?.rarity === r)).reverse();
    fr.tabs.innerHTML = tabsHTML(
      [
        { id: 'all', label: 'All', count: all.length },
        { id: 'fav', label: 'Favourites', icon: 'heart', count: all.filter((f) => f.favorite).length || '' },
        ...present.map((r) => ({ id: r, label: r[0].toUpperCase() + r.slice(1), count: all.filter((f) => fishDef(f.fishId)?.rarity === r).length })),
      ],
      filter,
    );
    fr.head.innerHTML = `<div class="ri-seg">${(['recent', 'value', 'rarity', 'weight'] as SortMode[]).map((m) => `<button class="${sort === m ? 'on' : ''}" data-act="sort" data-m="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>`;
    let list = all.filter((f) => (filter === 'all' ? true : filter === 'fav' ? f.favorite : fishDef(f.fishId)?.rarity === filter));
    list = sortFish(list, sort);
    const mer = merchant();
    for (const uid of [...picked]) if (!all.some((f) => f.uid === uid)) picked.delete(uid);
    if (!all.length) {
      fr.body.innerHTML = emptyState('fish', 'Your backpack is empty', 'Cast your line — every fish you catch lands here.');
      fr.foot.innerHTML = '';
      return;
    }
    if (!list.some((f) => f.uid === selUid)) selUid = list[0]?.uid ?? '';
    const sel = all.find((f) => f.uid === selUid) ?? null;
    keepScroll(fr.body, () => {
      fr.body.innerHTML = `<div class="ri-split">
        <div class="ri-grid ri-fgrid" data-scroll="grid">${list.map((f) => fishCell(u, f, { selected: mer ? picked.has(f.uid) : f.uid === selUid, act: 'fish' })).join('') || emptyState('filter', 'No fish match', 'Try another filter.')}</div>
        <div class="ri-detail" data-scroll="detail">${sel ? detail(sel) : ''}</div>
      </div>`;
    });
    // footer
    if (mer) {
      const m = mult();
      const pickedVal = all.filter((f) => picked.has(f.uid)).reduce((s, f) => s + f.value, 0) * m;
      const allVal = all.filter((f) => !f.favorite).reduce((s, f) => s + f.value, 0) * m;
      const npc = NPC_BY_ID[mer];
      fr.foot.innerHTML = `<span class="ri-foot-info">${icon('shop')}${npc ? `Selling to <b>${esc(npc.name)}</b>` : 'Merchant nearby'}${m !== 1 ? `<em class="ri-boosttag">×${m} sell boost</em>` : ''}</span>
        <button class="ri-btn ghost" data-act="pickall">${icon('check')}${picked.size ? 'Clear' : 'Select all'}</button>
        <button class="ri-btn teal" data-act="sellsel"${picked.size ? '' : ' disabled'}>${icon('tag')}Sell ${picked.size || ''} <span class="ri-btn-price">${coinIcon()}${fmtCoins(Math.round(pickedVal))}</span></button>
        <button class="ri-btn gold" data-act="sellall"${allVal > 0 ? '' : ' disabled'}>${icon('sellAll')}Sell all <span class="ri-btn-price">${coinIcon()}${fmtCoins(Math.round(allVal))}</span></button>`;
    } else {
      fr.foot.innerHTML = `<span class="ri-foot-info">${icon('pin')}Visit a <b>merchant</b> to sell your catch · favourites are never sold by “Sell all”</span>`;
    }
  }

  function detail(f: CaughtFish): string {
    const def = fishDef(f.fishId);
    const mer = merchant();
    return `<div class="ri-det-hero fish" style="--rc:${`var(--r-${def?.rarity ?? 'common'})`}"><div class="ri-det-glow"></div>${fishThumb(u, f.fishId, { mutation: f.mutation, attributes: f.attributes }, 'ri-det-th')}</div>
      <div class="ri-det-head"><h3>${esc(def?.name ?? f.fishId)}</h3>${rarityPill(def?.rarity)}</div>
      <div class="ri-chiprow">${mutationChip(f.mutation)}${attributeChips(f.attributes)}${f.perfect ? `<span class="ri-achip gold">${icon('star')}Perfect</span>` : ''}</div>
      ${fishFacts(f)}
      <p class="ri-det-desc">${esc(def?.description ?? '')}</p>
      <div class="ri-det-act">
        <button class="ri-btn ${f.favorite ? 'pink' : 'ghost'}" data-act="fav" data-uid="${esc(f.uid)}">${icon(f.favorite ? 'heart' : 'heartLine')}${f.favorite ? 'Favourited' : 'Favourite'}</button>
        ${mer && !f.favorite ? `<button class="ri-btn gold" data-act="sellone" data-uid="${esc(f.uid)}">${icon('tag')}Sell <span class="ri-btn-price">${coinIcon()}${fmtCoins(Math.round(f.value * mult()))}</span></button>` : ''}
      </div>`;
  }

  function doSell(uids: string[]) {
    if (!uids.length) return;
    let got = 0;
    try {
      got = u.eco.sell(uids);
    } catch (err) {
      console.error(err);
    }
    for (const id of uids) picked.delete(id);
    u.sfx('sell');
    u.toast(`Sold ${uids.length} fish for ${fmtCoins(got)} coins`, 'good', 'coinsStack');
    render();
  }

  fr.root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    const all = u.eco.save.backpack ?? [];
    switch (t.dataset.act) {
      case '__tab': filter = t.dataset.tab as typeof filter; u.sfx('ui_tab'); render(); break;
      case 'sort': sort = t.dataset.m as SortMode; render(); break;
      case 'fish': {
        const uid = t.dataset.uid!;
        selUid = uid;
        if (merchant()) {
          const f = all.find((x) => x.uid === uid);
          if (f && !f.favorite) picked.has(uid) ? picked.delete(uid) : picked.add(uid);
        }
        u.sfx('ui_click');
        render();
        break;
      }
      case 'fav': {
        try {
          u.eco.toggleFavorite(t.dataset.uid!);
        } catch (err) {
          console.error(err);
        }
        picked.delete(t.dataset.uid!);
        render();
        break;
      }
      case 'pickall':
        if (picked.size) picked.clear();
        else all.filter((f) => !f.favorite).forEach((f) => picked.add(f.uid));
        render();
        break;
      case 'sellsel': doSell([...picked]); break;
      case 'sellone': doSell([t.dataset.uid!]); break;
      case 'sellall': {
        const n = all.filter((f) => !f.favorite).length;
        let got = 0;
        try {
          got = u.eco.sellAll();
        } catch (err) {
          console.error(err);
        }
        picked.clear();
        u.sfx('sell');
        u.toast(`Sold ${n} fish for ${fmtCoins(got)} coins`, 'good', 'coinsStack');
        render();
        break;
      }
    }
  });

  void rarityOrder;
  return { root: fr.root, render };
};
