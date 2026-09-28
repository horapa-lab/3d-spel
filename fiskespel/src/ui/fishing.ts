// OWNER: ui. Fishing overlays: cast power, shake buttons, bite indicator, reel minigame,
// catch reveal card and the rewarded "try again" after an escape.
import type { CaughtFish, FishDef, FishingPhase, Rarity, ShakeButton } from '../core/types';
import type { UIC } from './common';
import { attributeChips, fishThumb, mutationChip, sizeChip, zoneName } from './common';
import { coinIcon, icon } from './icons';
import { clamp, el, esc, fishDef, fmtCoins, fmtInt, fmtKg, fmtOdds, rarityColor, rarityName, rarityOrder } from './util';
import { RARITIES } from '../data/rarities';
import { MUTATION_BY_ID } from '../data/mutations';

export interface FishingUI {
  el: HTMLElement;
  update(dt: number): void;
  showCatch(fish: CaughtFish, def: FishDef | null, firstTime: boolean): void;
  showEscape(rarity: Rarity | null, force?: boolean): void;
  catchVisible(): boolean;
  dismissCatch(): void;
  addXp(delta: number): void;
  active(): boolean;
}

const ARC = 'M26.06 93.94 A48 48 0 1 1 93.94 93.94';

export function createFishingUI(u: UIC, onCatchClosed: () => void): FishingUI {
  const root = el('div', 'ri-layer ri-fish');
  root.innerHTML = `
  <div class="ri-charge" hidden>
    <svg viewBox="0 0 120 120">
      <defs><linearGradient id="ri-g-charge" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3fe0cf"/><stop offset=".55" stop-color="#ffe066"/><stop offset="1" stop-color="#ff7a4d"/></linearGradient></defs>
      <path class="trk" d="${ARC}"/>
      <path class="tks" d="${ARC}" pathLength="100"/>
      <path class="fill" d="${ARC}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
    </svg>
    <div class="ri-charge-t"><b>0%</b><small>Cast power</small></div>
    <div class="ri-charge-hint"></div>
  </div>
  <div class="ri-shakes"></div>
  <div class="ri-wait" hidden><span class="ri-wait-bob"><i></i></span><span class="ri-wait-t">Waiting for a bite<em><i>.</i><i>.</i><i>.</i></em></span></div>
  <div class="ri-bite" hidden><div class="ri-bite-burst"></div><div class="ri-bite-ring"></div><b></b><small></small></div>
  <div class="ri-reel" hidden>
    <div class="ri-reel-card">
      <div class="ri-reel-gauge">
        <svg viewBox="0 0 80 80"><circle class="trk" cx="40" cy="40" r="33"/><circle class="bar" cx="40" cy="40" r="33" pathLength="100" stroke-dasharray="100" stroke-dashoffset="80"/></svg>
        <span class="ri-spool"><i></i><i></i><i></i></span>
        <b class="ri-reel-pct">20%</b>
      </div>
      <div class="ri-reel-main">
        <div class="ri-reel-head">
          <span class="ri-reel-rar"></span>
          <span class="ri-reel-name">???</span>
          <span class="ri-reel-heavy" hidden>${icon('warn')}Too heavy · half speed</span>
          <span class="ri-reel-dif" title="Difficulty"></span>
        </div>
        <div class="ri-track">
          <div class="ri-track-water"></div>
          <div class="ri-track-ticks"></div>
          <div class="ri-pbar"><i></i><i></i><i></i></div>
          <div class="ri-fishm"><span class="ri-fishm-rip"></span>${icon('fish')}</div>
          <div class="ri-lock"><span>${icon('lock')}Get ready…</span></div>
        </div>
        <div class="ri-reel-foot">
          <span class="ri-reel-hint"></span>
          <span class="ri-perfect on">${icon('star')}Perfect</span>
        </div>
      </div>
    </div>
  </div>
  <div class="ri-escape" hidden></div>`;
  u.root.appendChild(root);

  const q = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as unknown as T;
  const charge = q('.ri-charge');
  const chargeFill = q<SVGPathElement>('.ri-charge .fill');
  const chargeB = q('.ri-charge-t b');
  const chargeHint = q('.ri-charge-hint');
  const shakes = q('.ri-shakes');
  const wait = q('.ri-wait');
  const bite = q('.ri-bite');
  const reel = q('.ri-reel');
  const reelCard = q('.ri-reel-card');
  const gaugeBar = q<SVGCircleElement>('.ri-reel-gauge .bar');
  const spool = q('.ri-spool');
  const pct = q('.ri-reel-pct');
  const rar = q('.ri-reel-rar');
  const nameEl = q('.ri-reel-name');
  const heavy = q('.ri-reel-heavy');
  const dif = q('.ri-reel-dif');
  const track = q('.ri-track');
  const pbar = q('.ri-pbar');
  const fishm = q('.ri-fishm');
  const perfectEl = q('.ri-perfect');
  const hint = q('.ri-reel-hint');
  const escape = q('.ri-escape');

  q('.ri-track-ticks').innerHTML = Array.from({ length: 19 }, (_, i) => `<i style="left:${((i + 1) / 20) * 100}%"${(i + 1) % 5 === 0 ? ' class="maj"' : ''}></i>`).join('');
  hint.innerHTML = u.touch
    ? `Hold <kbd class="wide">${icon('hand')}REEL</kbd> to pull right · release to drift`
    : `Hold <kbd class="wide">${icon('mouse')}Click</kbd> or <kbd class="wide">Space</kbd> to pull right`;

  // state
  let lastPhase: FishingPhase | 'none' = 'none';
  let trackW = 400;
  let prevFish = 0.5;
  let fishDir = 1;
  let prevProgress = 0.2;
  let spoolRot = 0;
  let wasPerfect = true;
  let reelRarity: Rarity | null = null;
  let biteT = 0;
  let catchEl: HTMLElement | null = null;
  let catchTimer = 0;
  let escapeTimer = 0;
  let lastShownUid = '';
  const shakeEls = new Map<number, { el: HTMLElement; ttl0: number }>();

  const ro = new ResizeObserver(() => {
    trackW = track.clientWidth || trackW;
  });
  ro.observe(track);

  // shake clicks
  shakes.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.ri-shake');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const id = Number(b.dataset.id);
    try {
      u.fishing.clickShake(id);
    } catch (err) {
      console.error(err);
    }
    u.sfx('shake');
    const r = b.getBoundingClientRect();
    const burst = el('div', 'ri-shake-pop', `<i></i><i></i><b>−0.5s</b>`);
    burst.style.left = `${r.left + r.width / 2}px`;
    burst.style.top = `${r.top + r.height / 2}px`;
    shakes.appendChild(burst);
    setTimeout(() => burst.remove(), 700);
    b.classList.add('hit');
    const entry = shakeEls.get(id);
    shakeEls.delete(id);
    setTimeout(() => entry?.el.remove(), 160);
  });

  function syncShakes(list: ShakeButton[], show: boolean) {
    const W = innerWidth;
    const H = innerHeight;
    const seen = new Set<number>();
    if (show) {
      for (const s of list) {
        seen.add(s.id);
        let e = shakeEls.get(s.id);
        if (!e) {
          const b = el('button', 'ri-shake', `<svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="28"/><circle class="ring" cx="32" cy="32" r="28" pathLength="100"/></svg><span class="ri-shake-in">${icon('waves')}<b>Shake</b></span>`);
          b.dataset.id = String(s.id);
          shakes.appendChild(b);
          e = { el: b, ttl0: Math.max(0.3, s.ttl) };
          shakeEls.set(s.id, e);
        }
        // keep buttons inside the safe area, clear of the top HUD and bottom controls
        const x = clamp(s.x, 0.08, 0.92) * W;
        const y = clamp(s.y, 0.18, 0.78) * H;
        e.el.style.transform = `translate3d(${x.toFixed(0)}px,${y.toFixed(0)}px,0)`;
        const f = clamp(s.ttl / e.ttl0, 0, 1);
        (e.el.querySelector('.ring') as SVGCircleElement).style.strokeDashoffset = String((100 - f * 100).toFixed(1));
        e.el.classList.toggle('urgent', f < 0.3);
      }
    }
    for (const [id, e] of shakeEls) {
      if (!seen.has(id)) {
        e.el.classList.add('gone');
        const n = e.el;
        setTimeout(() => n.remove(), 200);
        shakeEls.delete(id);
      }
    }
  }

  function showBite(r: Rarity | null) {
    const rr = r ?? 'common';
    const def = RARITIES[rr];
    bite.style.setProperty('--rc', rarityColor(rr));
    bite.className = `ri-bite r-${rr} t${tier(rr)}`;
    bite.querySelector('b')!.textContent = def?.indicator ?? '!';
    bite.querySelector('small')!.textContent = rarityOrder(rr) >= 5 ? `${rarityName(rr)} bite!` : 'Fish on!';
    bite.hidden = false;
    biteT = 1.1;
    u.sfx(rarityOrder(rr) >= 5 ? 'bite_rare' : 'bite');
  }

  function enterReel() {
    reel.hidden = false;
    reel.classList.remove('out');
    reel.classList.add('in');
    prevProgress = u.fishing.reel?.progress ?? 0.2;
    wasPerfect = true;
    perfectEl.className = 'ri-perfect on';
    trackW = track.clientWidth || trackW;
  }
  function exitReel() {
    if (reel.hidden) return;
    reel.classList.add('out');
    setTimeout(() => {
      if (reel.classList.contains('out')) reel.hidden = true;
    }, 320);
  }

  function updateReel(dt: number) {
    const r = u.fishing.reel;
    if (!r) return;
    if (r.rarity !== reelRarity) {
      reelRarity = r.rarity;
      const c = rarityColor(r.rarity);
      reel.style.setProperty('--rc', c);
      reel.dataset.tier = String(tier(r.rarity));
      rar.innerHTML = `<i>${esc(RARITIES[r.rarity]?.indicator ?? '!')}</i>${esc(rarityName(r.rarity))}`;
    }
    const nm = r.fishName ?? '???';
    if (nameEl.textContent !== nm) nameEl.textContent = nm;
    nameEl.classList.toggle('unk', !r.fishName);
    heavy.hidden = !r.overweight;
    const d = clamp(r.difficulty, 0, 1);
    const dn = 1 + Math.round(d * 4);
    if (dif.dataset.n !== String(dn)) {
      dif.dataset.n = String(dn);
      dif.innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < dn ? 'on' : ''}"></i>`).join('');
    }
    reelCard.style.setProperty('--dif', d.toFixed(2));
    reel.classList.toggle('hard', d > 0.55);
    // bar + fish
    const bw = clamp(r.barWidth, 0.02, 1) * trackW;
    pbar.style.width = `${bw.toFixed(1)}px`;
    pbar.style.transform = `translate3d(${(clamp(r.barPos, 0, 1) * trackW).toFixed(1)}px,0,0)`;
    const df = r.fishPos - prevFish;
    if (Math.abs(df) > 0.0008) fishDir = df > 0 ? 1 : -1;
    prevFish = r.fishPos;
    fishm.style.transform = `translate3d(${(clamp(r.fishPos, 0, 1) * trackW).toFixed(1)}px,0,0)`;
    fishm.classList.toggle('left', fishDir < 0);
    reel.classList.toggle('inside', r.inside);
    reel.classList.toggle('locked', r.locked);
    // progress
    const p = clamp(r.progress, 0, 1);
    gaugeBar.setAttribute('stroke-dashoffset', (100 - p * 100).toFixed(2));
    const pt = `${Math.round(p * 100)}%`;
    if (pct.textContent !== pt) pct.textContent = pt;
    const dp = p - prevProgress;
    spoolRot += dp * 1400 + (r.inside ? dt * 120 : -dt * 40);
    spool.style.transform = `rotate(${spoolRot.toFixed(1)}deg)`;
    reel.classList.toggle('danger', p < 0.22 && dp < 0);
    reel.classList.toggle('gaining', dp > 0);
    prevProgress = p;
    // perfect
    if (wasPerfect && !r.perfect && !r.locked) {
      wasPerfect = false;
      perfectEl.className = 'ri-perfect lost';
    } else if (r.perfect && !wasPerfect) {
      wasPerfect = true;
      perfectEl.className = 'ri-perfect on';
    }
  }

  // ── catch reveal ──
  function tier(r: Rarity | string | null | undefined): number {
    const o = rarityOrder(r);
    if (r === 'limited' || o >= 6) return 3;
    if (o >= 4) return 2;
    if (o >= 2) return 1;
    return 0;
  }

  let xpAdded = 0;
  let catchShownAt = 0;
  function showCatch(fish: CaughtFish, def0: FishDef | null, first: boolean) {
    const def = def0 ?? fishDef(fish.fishId);
    lastShownUid = fish.uid;
    dismissCatch(true);
    exitReel();
    const r = def?.rarity ?? 'common';
    const c = rarityColor(r);
    const t = tier(r);
    const save = u.eco.save;
    const inBag = save.backpack?.some((f) => f.uid === fish.uid);
    const entry = save.bestiary?.[fish.fishId];
    const pb = entry && entry.caught > 1 && Math.abs(entry.bestKg - fish.kg) < 1e-6;
    const mut = fish.mutation ? MUTATION_BY_ID[fish.mutation] : null;
    const sparkles = t >= 2 ? Array.from({ length: t === 3 ? 18 : 10 }, () => `<i style="--x:${Math.round(Math.random() * 100)}%;--y:${Math.round(Math.random() * 100)}%;--d:${(Math.random() * 2).toFixed(2)}s;--s:${(0.5 + Math.random()).toFixed(2)}"></i>`).join('') : '';
    const card = el(
      'div',
      `ri-catch t${t} r-${r}${fish.perfect ? ' perfect' : ''}${first ? ' first' : ''}`,
      `<div class="ri-catch-flash"></div>
      <div class="ri-catch-card" style="--rc:${c}${mut ? `;--mc:${mutColor(mut.visual.emissive ?? mut.visual.tint)}` : ''}">
        <div class="ri-catch-rays"></div>
        <div class="ri-catch-spark">${sparkles}</div>
        <div class="ri-catch-top">
          <span class="ri-catch-rar"><i>${esc(RARITIES[r]?.indicator ?? '!')}</i>${esc(rarityName(r))}</span>
        </div>
        ${first ? `<span class="ri-ribbon">${icon('book')}New species</span>` : ''}
        ${fish.perfect ? `<span class="ri-stamp">${icon('star')}<b>Perfect</b><small>catch</small></span>` : ''}
        <div class="ri-catch-art${fish.mutation ? ' mut' : ''}"><span class="ri-catch-plinth"></span>${fishThumb(u, fish.fishId, { mutation: fish.mutation, attributes: fish.attributes }, 'ri-catch-th')}</div>
        <div class="ri-catch-caught">You caught</div>
        <h2>${esc(def?.name ?? fish.fishId)}</h2>
        <div class="ri-catch-chips">${mutationChip(fish.mutation)}${attributeChips(fish.attributes)}${sizeChip(fish.size)}${pb ? `<span class="ri-pbchip">${icon('trophy')}Personal best</span>` : ''}</div>
        <div class="ri-catch-stats">
          <div><small>${icon('weight')}Weight</small><b>${fmtKg(fish.kg)}</b></div>
          <div class="val"><small>${coinIcon()}Value</small><b>${fmtCoins(fish.value)}</b></div>
          <div><small>${icon('target')}Odds</small><b>${fmtOdds(fish.odds)}</b></div>
        </div>
        <div class="ri-catch-foot">
          <span class="ri-catch-xp" hidden></span>
          <span class="ri-catch-zone">${icon('pin')}${esc(zoneName(fish.zone))}</span>
          <span class="ri-catch-bp${inBag === false ? ' lost' : ''}">${icon('backpack')}${inBag === false ? 'Backpack full — released!' : `${save.backpack?.length ?? 0}/${save.backpackSize ?? 30}`}</span>
        </div>
        <div class="ri-catch-tap">${u.touch ? 'Tap' : 'Click'} to continue</div>
      </div>`,
    );
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (performance.now() - catchShownAt > 450) dismissCatch();
    });
    root.appendChild(card);
    catchEl = card;
    catchShownAt = performance.now();
    xpAdded = 0;
    catchTimer = [4.2, 5, 6, 7.5][t];
    u.sfx(t >= 2 ? 'catch_rare' : 'catch');
    if (rarityOrder(r) >= 5) {
      try {
        u.game.platform.happytime();
      } catch {
        /* ignore */
      }
    }
  }
  function mutColor(hex: string | undefined): string {
    return hex ?? '#ffffff';
  }
  function dismissCatch(silent = false) {
    if (!catchEl) return;
    const c = catchEl;
    catchEl = null;
    c.classList.add('out');
    setTimeout(() => c.remove(), 420);
    if (!silent) onCatchClosed();
  }
  function addXp(delta: number) {
    if (!catchEl || performance.now() - catchShownAt > 2500) return;
    xpAdded += delta;
    const x = catchEl.querySelector<HTMLElement>('.ri-catch-xp');
    if (x) {
      x.hidden = false;
      x.innerHTML = `${icon('xp')}+${fmtInt(xpAdded)} XP`;
    }
  }

  // ── escape ──
  function showEscape(r: Rarity | null, force = false) {
    let can = force;
    try {
      can = can || u.fishing.canRetryEscaped();
    } catch {
      /* ignore */
    }
    exitReel();
    const rr = r ?? reelRarity ?? 'common';
    escape.style.setProperty('--rc', rarityColor(rr));
    escape.innerHTML = `<div class="ri-esc-ic">${icon('snap')}</div>
      <div class="ri-esc-t"><b>It got away!</b><small>${rarityOrder(rr) >= 4 ? `A <em>${esc(rarityName(rr))}</em> fish slipped the hook.` : 'The line went slack…'}</small></div>
      ${can ? `<div class="ri-esc-btns"><button class="ri-btn gold" data-act="retry">${icon('ad')}Try again</button><button class="ri-btn ghost" data-act="skip">Let it go</button></div><i class="ri-esc-timer"></i>` : ''}`;
    escape.hidden = false;
    escape.classList.remove('out');
    escapeTimer = can ? 8 : 2.6;
    u.sfx('escape');
  }
  escape.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'retry') {
      b.setAttribute('disabled', '');
      escapeTimer = 999;
      try {
        const ok = await u.game.platform.rewarded('retry');
        if (ok) {
          u.fishing.retryEscaped();
          u.toast('The fish is back on the line!', 'good', 'hook');
        } else u.toast('No reward — the fish is gone', 'bad', 'ad');
      } catch {
        u.toast('Ad unavailable right now', 'bad', 'ad');
      }
    }
    hideEscape();
  });
  function hideEscape() {
    escape.classList.add('out');
    setTimeout(() => {
      if (escape.classList.contains('out')) escape.hidden = true;
    }, 300);
    escapeTimer = 0;
  }

  return {
    el: root,
    update(dt) {
      const f = u.fishing;
      const phase = f.phase;
      if (phase !== lastPhase) {
        const prev = lastPhase;
        lastPhase = phase;
        charge.hidden = phase !== 'charging';
        wait.hidden = phase !== 'waiting';
        if (phase === 'charging') {
          dismissCatch();
          if (!escape.hidden) hideEscape();
        }
        if (phase === 'bite') showBite(f.hookedRarity);
        if (phase === 'reeling') {
          if (prev !== 'bite' && bite.hidden) showBite(f.hookedRarity ?? f.reel?.rarity ?? null);
          enterReel();
        } else exitReel();
        if (phase === 'caught' && f.lastCatch && f.lastCatch.uid !== lastShownUid && !catchEl) {
          // fallback when no fish:caught event arrives
          const lc = f.lastCatch;
          setTimeout(() => {
            if (lastShownUid !== lc.uid) showCatch(lc, fishDef(lc.fishId), false);
          }, 120);
        }
      }
      if (phase === 'charging') {
        const p = clamp(f.castPower, 0, 1);
        chargeFill.setAttribute('stroke-dashoffset', (100 - p * 100).toFixed(2));
        chargeB.textContent = `${Math.round(p * 100)}%`;
        charge.classList.toggle('max', p > 0.97);
        chargeHint.textContent = p > 0.97 ? 'Max distance!' : u.touch ? 'Release to cast' : 'Release to cast';
      }
      syncShakes(f.shakeButtons ?? [], phase === 'waiting' || phase === 'bite');
      if (!bite.hidden) {
        biteT -= dt;
        if (biteT <= 0) {
          bite.hidden = true;
        }
      }
      if (phase === 'reeling') updateReel(dt);
      if (catchEl) {
        catchTimer -= dt;
        if (catchTimer <= 0) dismissCatch();
      }
      if (escapeTimer > 0 && !escape.hidden) {
        escapeTimer -= dt;
        const tm = escape.querySelector<HTMLElement>('.ri-esc-timer');
        if (tm) tm.style.transform = `scaleX(${clamp(escapeTimer / 8, 0, 1)})`;
        if (escapeTimer <= 0) hideEscape();
      }
    },
    showCatch,
    showEscape,
    catchVisible: () => !!catchEl,
    dismissCatch: () => dismissCatch(),
    addXp,
    active: () => lastPhase !== 'idle' && lastPhase !== 'none',
  };
}
