// OWNER: ui. Compact panels: bait & items (+loot reveal), quest, appraiser, enchant, map, boats, settings.
import type { CaughtFish, QualityTier } from '../../core/types';
import type { PanelFactory } from './host';
import {
  baitStatsHTML, baitThumb, boatThumb, emptyState, fishCell, fishThumb, itemFactsHTML, itemIconName, itemThumb, keepScroll, mutationChip, panelFrame, rarityPill, tabsHTML, zoneName,
} from '../common';
import { coinIcon, icon, weatherIcon, xpIcon } from '../icons';
import { clamp, el, esc, fishDef, fmtClock, fmtCoins, fmtInt, fmtKg, prettyId } from '../util';
import { BAIT_BY_ID } from '../../data/baits';
import { ITEM_BY_ID } from '../../data/items';
import { BOATS } from '../../data/boats';
import { NPC_BY_ID } from '../../data/npcs';
import { ENCHANT_BY_ID } from '../../data/enchants';
import { ROD_BY_ID } from '../../data/rods';
import { LOCATION_BY_ID, WORLD_EVENTS, WEATHERS } from '../../data/world';

const safe = <T,>(fn: () => T, fb: T): T => {
  try {
    return fn() ?? fb;
  } catch {
    return fb;
  }
};
const act = (root: HTMLElement, fn: (a: string, t: HTMLElement) => void) =>
  root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (t && !t.hasAttribute('disabled')) fn(t.dataset.act!, t);
  });

// ───────────────────────────────────────────── Bait & items
export const itemsPanel: PanelFactory = (u, data, nav) => {
  const fr = panelFrame({ id: 'items', title: 'Bait & Items', icon: 'bait', back: !!nav.back });
  let tab: 'bait' | 'items' | 'bobbers' = (data.tab as 'bait') ?? 'bait';
  let sel = '';
  let reveal = false;

  function render() {
    const s = u.eco.save;
    const baits = Object.keys(s.baits ?? {}).filter((k) => (s.baits[k] ?? 0) > 0);
    const items = Object.keys(s.items ?? {}).filter((k) => (s.items[k] ?? 0) > 0 && ITEM_BY_ID[k]?.kind !== 'bobber');
    const bobbers = s.bobbers ?? [];
    fr.tabs.innerHTML = tabsHTML([
      { id: 'bait', label: 'Bait', icon: 'bait', count: baits.length },
      { id: 'items', label: 'Items', icon: 'gift', count: items.length },
      { id: 'bobbers', label: 'Bobbers', icon: 'bobber', count: bobbers.length },
    ], tab);
    const ids = tab === 'bait' ? baits : tab === 'items' ? items : bobbers;
    if (!ids.includes(sel)) sel = ids[0] ?? '';
    if (!ids.length) {
      fr.body.innerHTML = emptyState(tab === 'bait' ? 'bait' : tab === 'items' ? 'gift' : 'bobber', `No ${tab} yet`, tab === 'bait' ? 'Buy bait from a merchant or bait vendor.' : 'Open crates, complete quests and find treasure.');
      return;
    }
    keepScroll(fr.body, () => {
      fr.body.innerHTML = `<div class="ri-split"><div class="ri-grid ri-shopgrid" data-scroll="g">${ids
        .map((id) => {
          const n = tab === 'bait' ? s.baits[id] : tab === 'items' ? s.items[id] : 0;
          const eq = tab === 'bait' ? s.equippedBait === id : tab === 'bobbers' ? s.equippedBobber === id : false;
          const r = tab === 'bait' ? BAIT_BY_ID[id]?.rarity : ITEM_BY_ID[id]?.rarity;
          return `<button class="ri-scard${id === sel ? ' sel' : ''}${eq ? ' own' : ''}" data-act="sel" data-id="${esc(id)}" ${r ? `style="--rc:var(--r-${r})"` : ''}>
            <span class="ri-scard-th">${tab === 'bait' ? baitThumb(u, id) : itemThumb(u, id)}</span>
            <span class="ri-scard-name">${esc((tab === 'bait' ? BAIT_BY_ID[id]?.name : ITEM_BY_ID[id]?.name) ?? prettyId(id))}</span>
            ${eq ? `<span class="ri-owned">${icon('check')}Equipped</span>` : n ? `<em class="ri-scard-n">×${fmtInt(n)}</em>` : ''}
          </button>`;
        })
        .join('')}</div><div class="ri-detail" data-scroll="d">${detail()}</div></div>`;
    });
  }
  function detail(): string {
    const s = u.eco.save;
    if (tab === 'bait') {
      const b = BAIT_BY_ID[sel];
      const eq = s.equippedBait === sel;
      return `<div class="ri-det-hero"><div class="ri-det-glow"></div>${baitThumb(u, sel, 'ri-det-th')}</div>
        <div class="ri-det-head"><h3>${esc(b?.name ?? prettyId(sel))}</h3>${rarityPill(b?.rarity)}<span class="ri-have">×${fmtInt(s.baits[sel] ?? 0)}</span></div>
        <p class="ri-det-desc">${esc(b?.description ?? '')}</p>${b ? baitStatsHTML(b) : ''}
        <div class="ri-det-act">${eq ? `<button class="ri-btn ghost wide" data-act="unequip">${icon('close')}Unequip</button>` : `<button class="ri-btn teal wide" data-act="equipbait">${icon('hook')}Equip bait</button>`}</div>`;
    }
    const it = ITEM_BY_ID[sel];
    if (tab === 'bobbers') {
      const eq = s.equippedBobber === sel;
      return `<div class="ri-det-hero"><div class="ri-det-glow"></div>${itemThumb(u, sel, 'ri-det-th')}</div>
        <div class="ri-det-head"><h3>${esc(it?.name ?? prettyId(sel))}</h3>${rarityPill(it?.rarity)}</div><p class="ri-det-desc">${esc(it?.description ?? '')}</p>
        <div class="ri-det-act">${eq ? `<button class="ri-btn wide" disabled>${icon('check')}Equipped</button>` : `<button class="ri-btn teal wide" data-act="equipbob">${icon('bobber')}Equip</button>`}</div>`;
    }
    const usable = it && ['bait_crate', 'treasure_chest', 'totem', 'potion', 'treasure_map'].includes(it.kind);
    const hint = it?.kind === 'relic' ? `<div class="ri-hintline">${icon('wand')}Place it on the Keeper’s altar at night to enchant your rod.</div>` : '';
    return `<div class="ri-det-hero"><div class="ri-det-glow"></div>${itemThumb(u, sel, 'ri-det-th')}</div>
      <div class="ri-det-head"><h3>${esc(it?.name ?? prettyId(sel))}</h3>${rarityPill(it?.rarity)}<span class="ri-have">×${fmtInt(s.items[sel] ?? 0)}</span></div>
      <p class="ri-det-desc">${esc(it?.description ?? '')}</p>${it ? itemFactsHTML(it) : ''}${hint}
      <div class="ri-det-act">${usable ? `<button class="ri-btn gold wide" data-act="use">${icon(it!.kind === 'bait_crate' || it!.kind === 'treasure_chest' ? 'gift' : 'play')}${it!.kind === 'bait_crate' || it!.kind === 'treasure_chest' ? 'Open' : 'Use'}</button>` : ''}</div>`;
  }
  act(fr.root, (a, t) => {
    const s = u.eco.save;
    if (a === '__tab') { tab = t.dataset.tab as typeof tab; sel = ''; render(); }
    else if (a === 'sel') { sel = t.dataset.id!; u.sfx('ui_click'); render(); }
    else if (a === 'equipbait') { safe(() => u.eco.equipBait(sel), false); u.toast(`Equipped ${BAIT_BY_ID[sel]?.name ?? sel}`, 'good', 'bait'); render(); }
    else if (a === 'unequip') { safe(() => u.eco.equipBait(null), false); render(); }
    else if (a === 'equipbob') { safe(() => u.eco.equipBobber(sel), false); render(); }
    else if (a === 'use') {
      const it = ITEM_BY_ID[sel];
      const res = safe(() => u.eco.useItem(sel), { ok: false, message: 'Nothing happened.' });
      if (res.ok && res.loot?.length && it) {
        reveal = true;
        lootReveal(u, sel, res.loot, () => {
          reveal = false;
          render();
        });
      } else u.toast(res.message || (res.ok ? 'Used!' : 'Can’t use that now'), res.ok ? 'good' : 'bad', itemIconName(sel));
      void s;
      render();
    }
  });
  return { root: fr.root, render, busy: () => reveal };
};

/** Loot-box reveal: 3D model (lid via userData.open) or CSS fallback, then reward cards. */
export function lootReveal(u: Parameters<PanelFactory>[0], itemId: string, loot: { kind: string; id?: string; amount: number }[], done: () => void): void {
  const it = ITEM_BY_ID[itemId];
  const o = el('div', 'ri-loot', `<div class="ri-loot-rays"></div><div class="ri-loot-stage"><canvas width="360" height="360"></canvas><span class="ri-loot-fb">${icon(it?.kind === 'treasure_chest' ? 'chest' : 'crate')}</span></div>
    <h2>${esc(it?.name ?? 'Crate')}</h2><div class="ri-loot-items"></div><button class="ri-btn gold ri-loot-ok" hidden>${icon('check')}Collect</button>`);
  u.root.appendChild(o);
  const cv = o.querySelector('canvas')!;
  const stage = u.thumbs.stage(cv, 'item', itemId);
  if (stage) o.classList.add('has3d');
  const t0 = performance.now();
  let raf = 0;
  const frame = () => {
    const t = (performance.now() - t0) / 1000;
    const shake = t < 1.1 ? Math.sin(t * 40) * 0.06 * (t / 1.1) : 0;
    const open = clamp((t - 1.1) / 0.5, 0, 1);
    stage?.draw(t, 1 - Math.pow(1 - open, 3), 0.5 + shake + t * 0.15);
    o.style.setProperty('--open', String(open));
    if (t > 1.2 && !o.classList.contains('opened')) {
      o.classList.add('opened');
      u.sfx('reward');
      o.querySelector('.ri-loot-items')!.innerHTML = loot
        .map((l, i) => {
          const name = l.kind === 'coins' ? 'Coins' : l.kind === 'xp' ? 'XP' : l.id ? (BAIT_BY_ID[l.id]?.name ?? ITEM_BY_ID[l.id]?.name ?? ROD_BY_ID[l.id]?.name ?? prettyId(l.id)) : prettyId(l.kind);
          const th = l.kind === 'coins' ? coinIcon() : l.kind === 'xp' ? xpIcon() : l.kind === 'bait' && l.id ? baitThumb(u, l.id) : l.kind === 'rod' && l.id ? u.thumbs.html('rod', l.id, {}, icon('rod')) : l.id ? itemThumb(u, l.id) : icon('gift');
          const r = l.id ? BAIT_BY_ID[l.id]?.rarity ?? ITEM_BY_ID[l.id]?.rarity : null;
          return `<div class="ri-loot-card" style="--i:${i};${r ? `--rc:var(--r-${r})` : ''}"><span class="ri-loot-th">${th}</span><b>${esc(name)}</b><em>×${fmtInt(l.amount)}</em></div>`;
        })
        .join('');
      (o.querySelector('.ri-loot-ok') as HTMLElement).hidden = false;
    }
    if (t < 3.5) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  o.querySelector('.ri-loot-ok')!.addEventListener('click', () => {
    cancelAnimationFrame(raf);
    stage?.dispose();
    o.classList.add('out');
    setTimeout(() => o.remove(), 300);
    done();
  });
}

// ───────────────────────────────────────────── Angler quest
export const questPanel: PanelFactory = (u, data, nav) => {
  const npcId = String(data.npcId ?? '');
  const npc = NPC_BY_ID[npcId];
  const fr = panelFrame({ id: 'quest', title: 'Angler Request', subtitle: npc ? `${npc.name} · ${zoneName(npc.location)}` : undefined, icon: 'quest', size: 'sm', back: !!nav.back });
  function render() {
    const q = safe(() => u.eco.questFor(npcId), null);
    const cd = u.eco.save.questCooldowns?.[npcId] ?? 0;
    if (!q) {
      fr.body.innerHTML = emptyState('hourglass', cd > Date.now() ? 'No work right now' : 'No request', cd > Date.now() ? `Come back in ${fmtClock((cd - Date.now()) / 1000)}.` : 'Check back soon.');
      fr.foot.innerHTML = '';
      return;
    }
    const def = fishDef(q.fishId);
    const known = (u.eco.save.bestiary?.[q.fishId]?.caught ?? 0) > 0;
    const have = (u.eco.save.backpack ?? []).filter((f) => f.fishId === q.fishId);
    fr.body.innerHTML = `<div class="ri-quest">
      <div class="ri-det-hero fish" style="--rc:var(--r-${def?.rarity ?? 'common'})"><div class="ri-det-glow"></div>${fishThumb(u, q.fishId, { silhouette: !known }, 'ri-det-th')}</div>
      <p class="ri-quest-line">“Bring me a <b>${esc(def?.name ?? q.fishId)}</b>. Any size will do.”</p>
      <div class="ri-chiprow">${rarityPill(def?.rarity)}<span class="ri-hint">${icon('pin')}${esc(zoneName(def?.zone))}</span>${def?.time ? `<span class="ri-hint">${icon(def.time === 'night' ? 'moon' : 'sunFill')}${def.time}</span>` : ''}${(def?.weather ?? []).map((w) => `<span class="ri-hint">${weatherIcon(w)}${esc(w)}</span>`).join('')}</div>
      <div class="ri-sec">${icon('gift')}Rewards</div>
      <div class="ri-rewards"><span>${coinIcon()}<b>${fmtCoins(q.rewardCoins)}</b></span><span>${xpIcon()}<b>${fmtInt(q.rewardXp)} XP</b></span>${q.bonusItem ? `<span>${itemThumb(u, q.bonusItem)}<b>${esc(ITEM_BY_ID[q.bonusItem]?.name ?? prettyId(q.bonusItem))}</b></span>` : ''}</div>
      ${q.expiresAt ? `<div class="ri-hintline">${icon('hourglass')}Expires in ${fmtClock((q.expiresAt - Date.now()) / 1000)}</div>` : ''}
    </div>`;
    fr.foot.innerHTML = `<span class="ri-foot-info">${icon('backpack')}${have.length ? `You have <b>${have.length}</b> in your backpack` : 'You don’t have one yet'}</span><button class="ri-btn gold" data-act="turnin"${have.length ? '' : ' disabled'}>${icon('check')}Hand in</button>`;
  }
  act(fr.root, (a) => {
    if (a !== 'turnin') return;
    if (safe(() => u.eco.turnInQuest(npcId), false)) {
      u.sfx('reward');
      u.toast('Request complete!', 'rare', 'quest');
    } else u.toast('Could not hand in', 'bad', 'warn');
    render();
  });
  return { root: fr.root, render };
};

// ───────────────────────────────────────────── Appraiser
export const appraiserPanel: PanelFactory = (u, data, nav) => {
  const fr = panelFrame({ id: 'appraiser', title: 'Appraiser', subtitle: 'Re-roll a fish’s weight and mutation', icon: 'appraise', accent: '#b98cff', back: !!nav.back });
  let sel = '';
  let rolling = 0;
  let before: CaughtFish | null = null;
  let after: CaughtFish | null = null;
  function render() {
    const bp = u.eco.save.backpack ?? [];
    if (!bp.some((f) => f.uid === sel)) sel = bp[0]?.uid ?? '';
    const f = bp.find((x) => x.uid === sel) ?? null;
    if (!bp.length) {
      fr.body.innerHTML = emptyState('fish', 'Nothing to appraise', 'Catch a fish first.');
      fr.foot.innerHTML = '';
      return;
    }
    const cost = f ? safe(() => u.eco.appraiseCost(f.uid), 0) : 0;
    keepScroll(fr.body, () => {
      fr.body.innerHTML = `<div class="ri-split"><div class="ri-grid ri-fgrid" data-scroll="g">${bp.map((x) => fishCell(u, x, { selected: x.uid === sel, act: 'pick' })).join('')}</div>
      <div class="ri-detail ri-appr" data-scroll="d">${f ? `<div class="ri-det-hero fish${rolling ? ' rolling' : ''}" style="--rc:var(--r-${fishDef(f.fishId)?.rarity ?? 'common'})"><div class="ri-det-glow"></div>${fishThumb(u, f.fishId, { mutation: f.mutation, attributes: f.attributes }, 'ri-det-th')}</div>
        <div class="ri-det-head"><h3>${esc(fishDef(f.fishId)?.name ?? f.fishId)}</h3></div>
        <div class="ri-appr-roll"><div><small>Weight</small><b class="ri-roll-kg">${fmtKg(f.kg)}</b></div><div><small>Mutation</small><b class="ri-roll-mut">${f.mutation ? mutationChip(f.mutation) : '—'}</b></div><div><small>Value</small><b class="gold">${fmtCoins(f.value)}</b></div></div>
        ${after && before ? `<div class="ri-appr-res ${after.value >= before.value ? 'up' : 'down'}">${icon(after.value >= before.value ? 'arrowUp' : 'arrowDown')}${fmtCoins(before.value)} → <b>${fmtCoins(after.value)}</b></div>` : ''}
        <div class="ri-hintline">${icon('info')}Attributes like Gleaming are kept. The result may be better — or worse.</div>` : ''}</div></div>`;
    });
    fr.foot.innerHTML = f ? `<span class="ri-foot-info">${icon('coinsStack')}Cost <b>${fmtCoins(cost)}</b> coins</span><button class="ri-btn violet" data-act="appraise"${rolling || u.eco.coins() < cost ? ' disabled' : ''}>${icon('refresh')}Appraise</button>` : '';
  }
  act(fr.root, (a, t) => {
    if (a === 'pick' && !rolling) { sel = t.dataset.uid!; after = before = null; render(); }
    if (a === 'appraise' && !rolling) {
      const f = (u.eco.save.backpack ?? []).find((x) => x.uid === sel);
      if (!f) return;
      before = { ...f };
      const res = safe(() => u.eco.appraise(f.uid), null);
      if (!res) {
        u.toast('Appraisal failed', 'bad', 'warn');
        return;
      }
      rolling = 1.4;
      after = null;
      render();
      u.sfx('appraise');
      const res2 = res;
      setTimeout(() => {
        rolling = 0;
        after = res2;
        sel = res2.uid;
        render();
      }, 1400);
    }
  });
  return {
    root: fr.root,
    render,
    busy: () => rolling > 0,
    update(dt) {
      if (rolling <= 0) return;
      rolling -= dt;
      const f = (u.eco.save.backpack ?? []).find((x) => x.uid === sel);
      const def = f ? fishDef(f.fishId) : null;
      const kg = fr.body.querySelector('.ri-roll-kg');
      if (kg && def) kg.textContent = fmtKg(def.minKg + Math.random() * (def.maxKg - def.minKg));
    },
  };
};

// ───────────────────────────────────────────── Enchant altar
export const enchantPanel: PanelFactory = (u, _data, nav) => {
  const fr = panelFrame({ id: 'enchant', title: 'Enchanting Altar', subtitle: 'Offer a relic to reshape your rod', icon: 'wand', accent: '#b98cff', size: 'md', back: !!nav.back });
  let sel = '';
  let busy = false;
  let result: { name: string; desc: string; pool: string } | null = null;
  function render() {
    const s = u.eco.save;
    const rod = ROD_BY_ID[s.equippedRod];
    const relics = Object.keys(s.items ?? {}).filter((k) => (s.items[k] ?? 0) > 0 && ITEM_BY_ID[k]?.kind === 'relic');
    if (!relics.includes(sel)) sel = relics[0] ?? '';
    const night = u.isNight();
    const ench = safe(() => u.eco.rodEnchants(s.equippedRod), []);
    fr.body.innerHTML = `<div class="ri-altar${busy ? ' charging' : ''}${result ? ' done' : ''}">
      <div class="ri-altar-ring"><i></i><i></i><i></i><span>${u.thumbs.html('rod', s.equippedRod, {}, icon('rod'), 'ri-altar-rod')}</span></div>
      <div class="ri-altar-rod-n"><b>${esc(rod?.name ?? 'Your rod')}</b>${ench.length ? ench.map((e) => `<span class="ri-achip">${icon('sparkles')}${esc(e.name)}</span>`).join('') : '<span class="ri-dim">No enchant</span>'}</div>
      ${result ? `<div class="ri-ench-res pool-${esc(result.pool)}"><small>New enchant</small><b>${esc(result.name)}</b><span>${esc(result.desc)}</span></div>` : ''}
      ${!night ? `<div class="ri-hintline">${icon('moon')}The altar only answers under the stars. Night falls in ${fmtClock(safe(() => u.clock.msUntilPhaseChange(), 0) / 1000)}.</div>` : ''}
      <div class="ri-sec">${icon('relic')}Your relics</div>
      <div class="ri-relics">${relics.length ? relics.map((id) => `<button class="ri-scard${id === sel ? ' sel' : ''}" data-act="sel" data-id="${esc(id)}" style="--rc:var(--r-${ITEM_BY_ID[id]?.rarity ?? 'rare'})"><span class="ri-scard-th">${itemThumb(u, id)}</span><span class="ri-scard-name">${esc(ITEM_BY_ID[id]?.name ?? id)}</span><em class="ri-scard-n">×${s.items[id]}</em></button>`).join('') : '<span class="ri-dim">No relics — buy them from Warden Sable or find them in chests.</span>'}</div>
    </div>`;
    fr.foot.innerHTML = `<button class="ri-btn violet wide" data-act="enchant"${!night || !sel || busy ? ' disabled' : ''}>${icon('wand')}Enchant ${esc(rod?.name ?? '')}</button>`;
  }
  act(fr.root, (a, t) => {
    if (a === 'sel' && !busy) { sel = t.dataset.id!; result = null; render(); }
    if (a === 'enchant' && !busy) {
      const res = safe(() => u.eco.enchant(sel), { ok: false, message: 'The altar is silent.' });
      if (!res.ok) {
        u.toast(res.message, 'bad', 'wand');
        return;
      }
      busy = true;
      result = null;
      render();
      u.sfx('enchant');
      setTimeout(() => {
        busy = false;
        const e = res.enchantId ? ENCHANT_BY_ID[res.enchantId] : null;
        result = { name: e?.name ?? prettyId(res.enchantId ?? 'Enchant'), desc: e?.description ?? res.message, pool: e?.pool ?? 'standard' };
        u.toast(`Enchanted: ${result.name}`, 'rare', 'wand');
        render();
      }, 1800);
    }
  });
  return { root: fr.root, render, busy: () => busy };
};

// ───────────────────────────────────────────── World map
export const mapPanel: PanelFactory = (u, _data, nav) => {
  const fr = panelFrame({ id: 'map', title: 'World Map', icon: 'map', size: 'xl', back: !!nav.back });
  function render() {
    const w = u.game.world;
    const half = w?.halfSize || 3000;
    const disc = new Set(u.eco.save.discovered ?? []);
    const pos = u.playerPos();
    const env = u.clock.get();
    const px = (x: number) => ((x + half) / (half * 2)) * 1000;
    const isl = (w?.islands ?? [])
      .map((i) => {
        const known = disc.has(i.id);
        const r = Math.max(14, (i.radius / (half * 2)) * 1000 * 1.6);
        const loc = LOCATION_BY_ID[i.id];
        return `<g class="ri-map-isl b-${esc(i.biome)}${known ? '' : ' unk'}" transform="translate(${px(i.center.x).toFixed(1)},${px(i.center.z).toFixed(1)})">
          <circle r="${(r * 1.7).toFixed(1)}" class="shal"/><circle r="${r.toFixed(1)}" class="land"/>
          <text y="${(r + 22).toFixed(1)}">${known ? esc(i.name) : '???'}</text>${known && loc ? `<text y="${(r + 38).toFixed(1)}" class="lv">Lv ${loc.tier}+</text>` : ''}</g>`;
      })
      .join('');
    const maps = (u.eco.save.treasureMaps ?? []).filter((m) => m.target).map((m) => `<g class="ri-map-x" transform="translate(${px(m.target![0]).toFixed(1)},${px(m.target![1]).toFixed(1)})"><path d="M-9 -9L9 9M9 -9L-9 9"/></g>`).join('');
    const heading = u.game.player?.heading ?? 0;
    const me = pos ? `<g class="ri-map-me" transform="translate(${px(pos.x).toFixed(1)},${px(pos.z).toFixed(1)}) rotate(${(180 - (heading * 180) / Math.PI).toFixed(1)})"><circle r="18" class="pulse"/><path d="M0 -14L10 10L0 5L-10 10Z"/></g>` : '';
    const ev = env.event ? WORLD_EVENTS.find((e) => e.id === env.event) : null;
    const wx = WEATHERS.find((x) => x.id === env.weather);
    fr.head.innerHTML = `<span class="ri-chip">${weatherIcon(env.weather)}${esc(wx?.name ?? env.weather)}</span>${ev ? `<span class="ri-chip ev" style="--ec:${ev.color}">${icon('sparkles')}${esc(ev.name)}</span>` : ''}`;
    fr.body.innerHTML = `<div class="ri-mapwrap"><svg class="ri-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
      <defs><radialGradient id="ri-g-sea" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#1b6c8c"/><stop offset=".6" stop-color="#0e3f5d"/><stop offset="1" stop-color="#071f33"/></radialGradient>
      <pattern id="ri-p-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="rgba(160,230,255,.08)" stroke-width="1.5"/></pattern></defs>
      <rect width="1000" height="1000" fill="url(#ri-g-sea)"/><rect width="1000" height="1000" fill="url(#ri-p-grid)"/>
      <circle cx="500" cy="500" r="470" class="ri-map-ring"/>
      ${isl}${maps}${me}
      <g class="ri-map-rose" transform="translate(920,86)"><circle r="44"/><path d="M0 -36L8 0L0 36L-8 0Z" class="n"/><text y="-48">N</text></g>
    </svg></div>`;
  }
  return { root: fr.root, render, update: (() => { let t = 0; return (dt: number) => { t += dt; if (t > 0.5) { t = 0; render(); } }; })() };
};

// ───────────────────────────────────────────── Boats
export const boatsPanel: PanelFactory = (u, data, nav) => {
  const npcId = String(data.npcId ?? '');
  const fr = panelFrame({ id: 'boats', title: 'Boats', icon: 'boat', back: !!nav.back });
  function render() {
    const s = u.eco.save;
    const shop = npcId ? safe(() => u.eco.shopFor(npcId), []).filter((e) => e.kind === 'boat') : [];
    fr.body.innerHTML = BOATS.length
      ? `<div class="ri-grid ri-boatgrid">${BOATS.map((b) => {
          const own = s.boats?.includes(b.id);
          const eq = s.equippedBoat === b.id;
          const entry = shop.find((e) => e.id === b.id);
          const locked = b.unlockLevel > u.eco.level();
          return `<div class="ri-boatcard${eq ? ' eq' : ''}"><span class="ri-boat-th">${boatThumb(u, b.id)}</span><b>${esc(b.name)}</b><p>${esc(b.description)}</p>
            <div class="ri-bstats"><div class="ri-bstat">${icon('sprint')}<span>Speed</span><b>${b.speed} m/s</b></div><div class="ri-bstat">${icon('refresh')}<span>Turning</span><b>${b.turnRate.toFixed(1)}</b></div></div>
            ${own ? (eq ? `<button class="ri-btn teal wide" data-act="spawn">${icon('anchor')}Launch</button>` : `<button class="ri-btn ghost wide" data-act="equip" data-id="${esc(b.id)}">${icon('check')}Select</button>`) : locked ? `<button class="ri-btn wide" disabled>${icon('lock')}Level ${b.unlockLevel}</button>` : entry || b.price >= 0 ? `<button class="ri-btn gold wide" data-act="buy" data-id="${esc(b.id)}"${u.eco.coins() < b.price ? ' disabled' : ''}>${b.price ? `${coinIcon()}${fmtCoins(b.price)}` : 'Free'}</button>` : ''}</div>`;
        }).join('')}</div>`
      : emptyState('boat', 'No boats', 'The shipwright is still building.');
  }
  act(fr.root, (a, t) => {
    const b = BOATS.find((x) => x.id === t.dataset.id);
    if (a === 'buy' && b) {
      const ok = safe(() => u.eco.buy({ kind: 'boat', id: b.id, price: b.price, unlockLevel: b.unlockLevel }), false);
      u.toast(ok ? `${b.name} is yours!` : 'Purchase failed', ok ? 'good' : 'bad', 'boat');
      if (ok) safe(() => u.eco.equipBoat(b.id), false);
    } else if (a === 'equip' && b) safe(() => u.eco.equipBoat(b.id), false);
    else if (a === 'spawn') {
      const ok = safe(() => u.game.player.spawnBoat(), false);
      u.toast(ok ? 'Your boat is waiting at the dock' : 'No dock nearby', ok ? 'good' : 'bad', 'boat');
      if (ok) nav.close();
    }
    render();
  });
  return { root: fr.root, render };
};

// ───────────────────────────────────────────── Settings
export const SHORTCUTS: [string, string][] = [
  ['W A S D', 'Move'], ['Shift', 'Sprint'], ['Space', 'Jump · reel while fishing'], ['Mouse (hold)', 'Charge & cast · reel'], ['Right-drag', 'Look around'], ['Wheel', 'Zoom'],
  ['E', 'Talk / interact'], ['B', 'Backpack'], ['R', 'Rods'], ['I', 'Bait & items'], ['N', 'Bestiary'], ['M', 'World map'], ['O', 'Settings'], ['Esc', 'Close panel'],
];
export const settingsPanel: PanelFactory = (u, data, nav) => {
  const fr = panelFrame({ id: 'settings', title: 'Settings', icon: 'gear', size: 'md', back: !!nav.back });
  let tab = String(data.tab ?? 'general');
  function render() {
    const s = u.eco.save;
    const st = s.settings;
    fr.tabs.innerHTML = tabsHTML([{ id: 'general', label: 'General', icon: 'sliders' }, { id: 'controls', label: 'Controls', icon: 'keyboard' }, { id: 'stats', label: 'Stats', icon: 'trophy' }], tab);
    if (tab === 'controls') {
      fr.body.innerHTML = `<div class="ri-keys">${SHORTCUTS.map(([k, d]) => `<div><span>${k.split(' ').map((x) => `<kbd>${esc(x)}</kbd>`).join('')}</span><b>${esc(d)}</b></div>`).join('')}</div>
        <div class="ri-hintline">${icon('hand')}On touch screens: left stick moves, drag the right side to look, hold the big button to cast and reel.</div>`;
      return;
    }
    if (tab === 'stats') {
      const x = s.stats;
      fr.body.innerHTML = `<div class="ri-facts big">
        <div><span>${icon('fish')}Fish caught</span><b>${fmtInt(x.catches)}</b></div><div><span>${icon('star')}Perfect catches</span><b>${fmtInt(x.perfect)}</b></div>
        <div><span>${coinIcon()}Coins earned</span><b class="gold">${fmtCoins(x.coinsEarned)}</b></div><div><span>${icon('weight')}Biggest fish</span><b>${fmtKg(x.biggestKg)}</b></div>
        <div><span>${icon('clock')}Time played</span><b>${fmtClock(x.playSeconds)}</b></div><div><span>${icon('sparkles')}Rarest catch</span><b>${esc(x.rarest ? fishDef(x.rarest)?.name ?? x.rarest : '—')}</b></div>
        <div><span>${icon('book')}Species found</span><b>${Object.keys(s.bestiary ?? {}).length}</b></div><div><span>${icon('pin')}Places discovered</span><b>${(s.discovered ?? []).length}</b></div></div>`;
      return;
    }
    const q = st.quality;
    fr.body.innerHTML = `<div class="ri-set">
      <label class="ri-slider">${icon('music')}<span>Music</span><input type="range" min="0" max="100" value="${Math.round(st.music * 100)}" data-k="music"><b>${Math.round(st.music * 100)}</b></label>
      <label class="ri-slider">${icon('speaker')}<span>Sound effects</span><input type="range" min="0" max="100" value="${Math.round(st.sfx * 100)}" data-k="sfx"><b>${Math.round(st.sfx * 100)}</b></label>
      <div class="ri-setrow">${icon('eye')}<span>Graphics quality</span><div class="ri-seg">${(['auto', 'low', 'medium', 'high', 'ultra'] as const).map((x) => `<button class="${q === x ? 'on' : ''}" data-act="q" data-q="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div></div>
      <div class="ri-setrow${st.autoReelUnlocked ? '' : ' locked'}">${icon('refresh')}<span>Auto-reel${st.autoReelUnlocked ? '' : ' <em>(locked)</em>'}</span><button class="ri-toggle${u.fishing.autoReel ? ' on' : ''}" data-act="auto"${st.autoReelUnlocked ? '' : ' disabled'}><i></i></button></div>
      <div class="ri-setrow">${icon('flag')}<span>Tutorial tips</span><button class="ri-toggle${st.showTutorial ? ' on' : ''}" data-act="tut"><i></i></button></div>
    </div>`;
  }
  fr.root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.type !== 'range') return;
    const st = u.eco.save.settings;
    const v = Number(t.value) / 100;
    if (t.dataset.k === 'music') st.music = v;
    else st.sfx = v;
    (t.nextElementSibling as HTMLElement).textContent = t.value;
    safe(() => u.game.audio.setVolumes(st.music, st.sfx), undefined);
  });
  fr.root.addEventListener('change', () => u.save());
  act(fr.root, (a, t) => {
    const st = u.eco.save.settings;
    if (a === '__tab') tab = t.dataset.tab!;
    else if (a === 'q') {
      st.quality = t.dataset.q as QualityTier | 'auto';
      if (st.quality !== 'auto') safe(() => u.game.render.setQuality(st.quality as QualityTier), undefined);
      u.save();
    } else if (a === 'auto') safe(() => u.fishing.setAutoReel(!u.fishing.autoReel), undefined);
    else if (a === 'tut') {
      st.showTutorial = !st.showTutorial;
      u.save();
    }
    render();
  });
  return { root: fr.root, render };
};
