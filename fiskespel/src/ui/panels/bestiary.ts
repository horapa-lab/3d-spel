// OWNER: ui. Bestiary: zones, completion %, silhouettes, per-fish details, claim rewards.
import type { BestiaryEntry, FishDef } from '../../core/types';
import type { PanelFactory } from './host';
import { fishThumb, keepScroll, mutationChip, panelFrame, rarityPill, zoneName } from '../common';
import { coinIcon, icon, weatherIcon } from '../icons';
import { esc, fishDef, fmtCoins, fmtInt, fmtKg, fmtOdds, rarityOrder } from '../util';
import { FISH } from '../../data/fish';
import { LOCATIONS } from '../../data/world';
import { BAIT_BY_ID } from '../../data/baits';

export const bestiaryPanel: PanelFactory = (u, data, nav) => {
  const fr = panelFrame({ id: 'bestiary', title: 'Bestiary', icon: 'book', back: !!nav.back });
  const zones = () => {
    const ids = LOCATIONS.map((l) => l.id).filter((id) => FISH.some((f) => f.zone === id));
    if (FISH.some((f) => f.zone === '*')) ids.push('*');
    return ids;
  };
  let zone = String(data.zone ?? '');
  let fishSel = String(data.fishId ?? '');

  function zoneFish(z: string): { fishId: string; entry: BestiaryEntry | null }[] {
    let out: { fishId: string; entry: BestiaryEntry | null }[] = [];
    try {
      out = z === '*' ? [] : u.eco.bestiaryZone(z) ?? [];
    } catch {
      out = [];
    }
    if (!out.length) out = FISH.filter((f) => f.zone === z).map((f) => ({ fishId: f.id, entry: u.eco.save.bestiary?.[f.id] ?? null }));
    return out.sort((a, b) => rarityOrder(fishDef(a.fishId)?.rarity) - rarityOrder(fishDef(b.fishId)?.rarity));
  }
  function progress(z: string) {
    const list = zoneFish(z);
    let p = { caught: list.filter((x) => x.entry && x.entry.caught > 0).length, total: list.length, claimed: false };
    try {
      if (z !== '*') {
        const e = u.eco.bestiaryProgress(z);
        if (e && e.total) p = e;
        else p.claimed = u.eco.save.claimedBestiaryZones?.includes(z) ?? false;
      }
    } catch {
      /* stub */
    }
    return p;
  }
  function odds(def: FishDef): number {
    const pool = FISH.filter((f) => f.zone === def.zone && !f.event);
    const sum = pool.reduce((s, f) => s + f.chance, 0);
    return def.chance > 0 && sum > 0 ? Math.round(sum / def.chance) : 0;
  }

  function render() {
    const zs = zones();
    const disc = new Set(u.eco.save.discovered ?? []);
    if (!zone || !zs.includes(zone)) zone = zs.find((z) => disc.has(z)) ?? zs[0] ?? '';
    let totC = 0;
    let totT = 0;
    const zoneRows = zs
      .map((z) => {
        const p = progress(z);
        totC += p.caught;
        totT += p.total;
        const known = z === '*' || disc.has(z) || p.caught > 0;
        const pct = p.total ? Math.round((p.caught / p.total) * 100) : 0;
        const ready = p.total > 0 && p.caught >= p.total && !p.claimed && z !== '*';
        return `<button class="ri-zrow${z === zone ? ' sel' : ''}${known ? '' : ' unk'}${ready ? ' ready' : ''}${p.claimed ? ' done' : ''}" data-act="zone" data-z="${esc(z)}">
          <span class="ri-zring" style="--p:${pct}"><b>${pct}%</b></span>
          <span class="ri-zrow-t"><b>${known ? esc(zoneName(z)) : '???'}</b><small>${p.caught}/${p.total} species</small></span>
          ${ready ? `<em class="ri-tag gold">${icon('gift')}</em>` : p.claimed ? `<em class="ri-tag teal">${icon('check')}</em>` : ''}
        </button>`;
      })
      .join('');
    fr.setHead('Bestiary', `${totC} / ${totT} species discovered`);
    fr.head.innerHTML = `<div class="ri-bigprog"><i style="width:${totT ? (totC / totT) * 100 : 0}%"></i><span>${totT ? Math.round((totC / totT) * 100) : 0}%</span></div>`;
    fr.tabs.innerHTML = '';
    const list = zoneFish(zone);
    const p = progress(zone);
    if (!list.some((x) => x.fishId === fishSel)) fishSel = list.find((x) => x.entry)?.fishId ?? list[0]?.fishId ?? '';
    const ready = p.total > 0 && p.caught >= p.total && !p.claimed && zone !== '*';
    keepScroll(fr.body, () => {
      fr.body.innerHTML = `<div class="ri-bsplit">
        <div class="ri-zlist" data-scroll="zones">${zoneRows}</div>
        <div class="ri-bmain">
          <div class="ri-zhead">
            <div><h3>${esc(zoneName(zone))}</h3><small>${p.caught} of ${p.total} species · ${p.claimed ? 'reward claimed' : 'complete the page for coins, XP & a unique bobber'}</small></div>
            <div class="ri-zbar"><i style="width:${p.total ? (p.caught / p.total) * 100 : 0}%"></i></div>
            ${ready ? `<button class="ri-btn gold" data-act="claim">${icon('gift')}Claim reward</button>` : p.claimed ? `<span class="ri-tag teal">${icon('check')}Claimed</span>` : ''}
          </div>
          <div class="ri-grid ri-bgrid" data-scroll="fish">${list
            .map(({ fishId, entry }) => {
              const def = fishDef(fishId);
              const got = !!entry && entry.caught > 0;
              const r = def?.rarity ?? 'common';
              return `<button class="ri-bcell${fishId === fishSel ? ' sel' : ''}${got ? '' : ' unk'}" data-act="fish" data-id="${esc(fishId)}" style="--rc:var(--r-${r})">
                ${fishThumb(u, fishId, { silhouette: !got }, 'ri-bcell-th')}
                <span class="ri-bcell-n">${got ? esc(def?.name ?? fishId) : '???'}</span>
                <span class="ri-bcell-r"></span>
                ${got ? `<em>×${fmtInt(entry!.caught)}</em>` : ''}
              </button>`;
            })
            .join('')}</div>
        </div>
        <div class="ri-detail" data-scroll="detail">${fishSel ? detail(fishSel) : ''}</div>
      </div>`;
    });
    fr.foot.innerHTML = '';
  }

  function detail(id: string): string {
    const def = fishDef(id);
    if (!def) return '';
    const entry = u.eco.save.bestiary?.[id] ?? null;
    const got = !!entry && entry.caught > 0;
    const hints: string[] = [];
    if (def.time) hints.push(`<span class="ri-hint">${icon(def.time === 'night' ? 'moon' : 'sunFill')}${def.time === 'night' ? 'Night' : 'Day'}</span>`);
    for (const w of def.weather ?? []) hints.push(`<span class="ri-hint">${weatherIcon(w)}${esc(w[0].toUpperCase() + w.slice(1))}</span>`);
    for (const s of def.season ?? []) hints.push(`<span class="ri-hint">${icon('leaf')}${esc(s[0].toUpperCase() + s.slice(1))}</span>`);
    if (def.event) hints.push(`<span class="ri-hint ev">${icon('sparkles')}${esc(def.event.replace(/_/g, ' '))} only</span>`);
    for (const b of def.preferredBait ?? []) hints.push(`<span class="ri-hint">${icon('bait')}${esc(BAIT_BY_ID[b]?.name ?? b)}</span>`);
    if (!hints.length) hints.push(`<span class="ri-hint">${icon('clock')}Any time, any weather</span>`);
    return `<div class="ri-det-hero fish${got ? '' : ' unk'}" style="--rc:var(--r-${def.rarity})"><div class="ri-det-glow"></div>${fishThumb(u, id, { silhouette: !got }, 'ri-det-th')}</div>
      <div class="ri-det-head"><h3>${got ? esc(def.name) : 'Undiscovered'}</h3>${rarityPill(def.rarity)}</div>
      <p class="ri-det-desc">${got ? esc(def.description) : 'Catch this fish to learn more about it.'}</p>
      <div class="ri-facts">
        <div><span>${icon('target')}Base odds</span><b>${fmtOdds(odds(def))}</b></div>
        <div><span>${icon('weight')}Size range</span><b>${got ? `${fmtKg(def.minKg)} – ${fmtKg(def.maxKg)}` : '?'}</b></div>
        <div><span>${icon('trophy')}Best catch</span><b>${got ? fmtKg(entry!.bestKg) : '—'}</b></div>
        <div><span>${coinIcon()}Best value</span><b class="gold">${got ? fmtCoins(entry!.bestValue) : '—'}</b></div>
        <div><span>${icon('fish')}Caught</span><b>${got ? `${fmtInt(entry!.caught)}×` : '0'}</b></div>
        <div><span>${icon('pin')}Found in</span><b>${esc(zoneName(def.zone))}</b></div>
      </div>
      <div class="ri-sec">${icon('info')}Best conditions</div><div class="ri-hints">${hints.join('')}</div>
      <div class="ri-sec">${icon('sparkles')}Mutations seen</div><div class="ri-chiprow">${got && entry!.mutations?.length ? entry!.mutations.map((m) => mutationChip(m)).join('') : '<span class="ri-dim">None yet</span>'}</div>`;
  }

  fr.root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'zone') {
      zone = t.dataset.z!;
      fishSel = '';
      u.sfx('ui_tab');
      render();
    } else if (t.dataset.act === 'fish') {
      fishSel = t.dataset.id!;
      u.sfx('ui_click');
      render();
    } else if (t.dataset.act === 'claim') {
      let ok = false;
      try {
        ok = u.eco.claimBestiary(zone);
      } catch (err) {
        console.error(err);
      }
      if (ok) {
        u.sfx('reward');
        u.toast(`${zoneName(zone)} page complete — reward claimed!`, 'rare', 'gift');
        u.game.platform.midgame?.().catch(() => undefined);
      } else u.toast('Could not claim yet', 'bad', 'warn');
      render();
    }
  });

  return { root: fr.root, render };
};
