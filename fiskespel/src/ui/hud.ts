// OWNER: ui. Heads-up display: profile, compass, clock/weather/forecast, events, boosts,
// dock, equipped chip, interaction prompt, toasts, location banner, level-up, new species.
import * as THREE from 'three';
import type { Boost, Interactable } from '../core/types';
import type { ToastKind, UIC } from './common';
import { fishThumb, rodThumb, zoneName } from './common';
import { coinIcon, icon, seasonIcon, weatherIcon, xpIcon } from './icons';
import { clamp, el, esc, fishDef, fmtClock, fmtCoins, fmtInt, gameTime, rarityColor } from './util';
import { LOCATION_BY_ID, WEATHERS, WORLD_EVENTS } from '../data/world';
import { NPC_BY_ID } from '../data/npcs';
import { RODS, ROD_BY_ID } from '../data/rods';
import { BAIT_BY_ID } from '../data/baits';

export interface Hud {
  el: HTMLElement;
  update(dt: number): void;
  toast(text: string, kind?: ToastKind, iconName?: string): void;
  location(id: string, discovered: boolean): void;
  levelUp(level: number): number;
  newSpecies(fishId: string, zone: string): void;
  setWaypoint(w: { x: number; z: number; label: string } | null): void;
  coinsDelta(delta: number): void;
  xpDelta(delta: number): void;
  setFishing(on: boolean): void;
  closePopovers(): void;
}

const DOCK: { id: string; panel: string; icon: string; label: string; key: string }[] = [
  { id: 'backpack', panel: 'backpack', icon: 'backpack', label: 'Backpack', key: 'B' },
  { id: 'rods', panel: 'rods', icon: 'rod', label: 'Rods', key: 'R' },
  { id: 'items', panel: 'items', icon: 'bait', label: 'Bait & Items', key: 'I' },
  { id: 'bestiary', panel: 'bestiary', icon: 'book', label: 'Bestiary', key: 'N' },
  { id: 'map', panel: 'map', icon: 'map', label: 'Map', key: 'M' },
  { id: 'settings', panel: 'settings', icon: 'gear', label: 'Settings', key: 'O' },
];

const WEATHER_NAME: Record<string, string> = Object.fromEntries(WEATHERS.map((w) => [w.id, w.name]));
const PPD = 2.6; // compass pixels per degree

export function interactVerb(t: Interactable): { verb: string; name: string; icon: string } {
  const npc = t.npcId ? NPC_BY_ID[t.npcId] : null;
  switch (t.kind) {
    case 'npc': return { verb: 'Talk to', name: npc?.name ?? t.label, icon: 'talk' };
    case 'altar': return { verb: 'Use', name: t.label || 'Altar', icon: 'wand' };
    case 'sign': return { verb: 'Read', name: t.label || 'Sign', icon: 'scroll' };
    case 'chest': return { verb: 'Open', name: t.label || 'Treasure', icon: 'chest' };
    case 'boat_spawn': return { verb: 'Use', name: t.label || 'Boat dock', icon: 'boat' };
    case 'bestiary': return { verb: 'Open', name: t.label || 'Bestiary', icon: 'book' };
    case 'bell': return { verb: 'Ring', name: t.label || 'Bell', icon: 'info' };
    default: return { verb: 'Use', name: t.label, icon: 'hand' };
  }
}

export function createHud(u: UIC): Hud {
  const g = u.game;
  const root = el('div', 'ri-layer ri-hud');
  root.innerHTML = `
  <div class="ri-tl">
    <div class="ri-profile">
      <button class="ri-lvl" data-hud="lvl" aria-label="Level">
        <svg viewBox="0 0 64 64"><defs><linearGradient id="ri-g-xpring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b6fff3"/><stop offset="1" stop-color="#27b7d6"/></linearGradient></defs>
          <circle class="trk" cx="32" cy="32" r="27"/><circle class="bar" cx="32" cy="32" r="27" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg>
        <span class="ri-lvl-in"><small>LV</small><b>1</b></span>
      </button>
      <div class="ri-prof-r">
        <div class="ri-coinpill">${coinIcon()}<b class="ri-coinval">0</b><span class="ri-coinfloat"></span></div>
        <div class="ri-xprow">${xpIcon()}<span class="ri-xpbar"><i></i></span><span class="ri-xptxt">0 / 100</span></div>
      </div>
    </div>
  </div>
  <div class="ri-top">
    <div class="ri-compass"><div class="ri-cmp-strip"></div><div class="ri-cmp-marks"></div><i class="ri-cmp-needle"></i><span class="ri-cmp-deg">N</span></div>
    <div class="ri-locline"><span class="ri-locname">—</span></div>
    <div class="ri-toasts"></div>
  </div>
  <div class="ri-tr">
    <button class="ri-clock" data-hud="clock">
      <span class="ri-clock-ph"></span>
      <span class="ri-clock-t">06:00</span>
      <span class="ri-clock-wx"></span>
      <span class="ri-clock-se"></span>
      <span class="ri-clock-cv">${icon('chevD')}</span>
    </button>
    <div class="ri-forecast" hidden></div>
    <button class="ri-event" data-hud="event" hidden></button>
    <div class="ri-boosts"></div>
  </div>
  <div class="ri-dock">
    <button class="ri-luckbtn" data-hud="luck"><span class="ri-luck-ic">${icon('clover')}</span><span class="ri-luck-t"><b>2× Luck</b><small>${icon('ad')}5 min</small></span></button>
    ${DOCK.map((d) => `<button class="ri-dockbtn" data-panel="${d.panel}" aria-label="${d.label}"><span class="ri-dock-ic">${icon(d.icon)}</span><span class="ri-dock-tip">${d.label}<kbd>${d.key}</kbd></span><kbd class="ri-dock-key">${d.key}</kbd>${d.id === 'backpack' ? '<em class="ri-bpbadge">0/30</em>' : ''}</button>`).join('')}
  </div>
  <div class="ri-bl">
    <button class="ri-equip" data-panel="rods">
      <span class="ri-equip-th"></span>
      <span class="ri-equip-txt"><b class="ri-equip-rod">Rod</b><small class="ri-equip-bait"></small>
        <span class="ri-equip-bp"><i></i></span></span>
    </button>
  </div>
  <div class="ri-prompt" hidden><kbd>E</kbd><span class="ri-prompt-ic"></span><span class="ri-prompt-t"></span></div>
  <div class="ri-banners"></div>`;
  u.root.appendChild(root);

  const q = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector(s) as T;
  const lvlB = q('.ri-lvl-in b');
  const lvlRing = q<HTMLElement>('.ri-lvl .bar') as unknown as SVGCircleElement;
  const coinVal = q('.ri-coinval');
  const coinFloat = q('.ri-coinfloat');
  const xpBar = q('.ri-xpbar i');
  const xpTxt = q('.ri-xptxt');
  const cmpStrip = q('.ri-cmp-strip');
  const cmpMarks = q('.ri-cmp-marks');
  const cmpDeg = q('.ri-cmp-deg');
  const locName = q('.ri-locname');
  const toasts = q('.ri-toasts');
  const clockBtn = q('.ri-clock');
  const clockPh = q('.ri-clock-ph');
  const clockT = q('.ri-clock-t');
  const clockWx = q('.ri-clock-wx');
  const clockSe = q('.ri-clock-se');
  const forecast = q('.ri-forecast');
  const eventBtn = q('.ri-event');
  const boostsEl = q('.ri-boosts');
  const luckBtn = q('.ri-luckbtn');
  const luckSmall = q('.ri-luck-t small');
  const bpBadge = q('.ri-bpbadge');
  const equipTh = q('.ri-equip-th');
  const equipRod = q('.ri-equip-rod');
  const equipBait = q('.ri-equip-bait');
  const equipBp = q('.ri-equip-bp i');
  const prompt = q('.ri-prompt');
  const promptIc = q('.ri-prompt-ic');
  const promptT = q('.ri-prompt-t');
  const banners = q('.ri-banners');

  // ── compass strip (built once) ──
  const labels: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  let strip = '';
  for (let d = -180; d < 560; d += 15) {
    const dd = ((d % 360) + 360) % 360;
    const lab = labels[dd];
    const x = (d + 180) * PPD;
    strip += lab
      ? `<span class="ri-cmp-l${lab.length === 1 ? ' major' : ''}${lab === 'N' ? ' north' : ''}" style="left:${x}px">${lab}</span>`
      : `<i class="ri-cmp-t${dd % 45 === 0 ? '' : ' minor'}" style="left:${x}px"></i>`;
  }
  cmpStrip.innerHTML = strip;

  // ── state ──
  let shownCoins = u.eco.coins();
  let lastCoinsText = '';
  let lastLevel = -1;
  let lastXpFrac = -1;
  let slowT = 0;
  let clockT2 = 0;
  let waypoint: { x: number; z: number; label: string } | null = null;
  const markEls = new Map<string, HTMLElement>();
  const dir = new THREE.Vector3();
  const boostTotals = new Map<string, number>();
  let lastEquipKey = '';
  let lastPromptKey = '';
  let lastBoostKey = '';
  let luckCooldownUntil = 0;
  let lastLoc = '';

  const setText = (e: HTMLElement, t: string) => {
    if (e.textContent !== t) e.textContent = t;
  };

  // ── clicks ──
  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const pb = t.closest<HTMLElement>('[data-panel]');
    if (pb) {
      u.sfx('ui_click');
      u.open(pb.dataset.panel!);
      return;
    }
    const hb = t.closest<HTMLElement>('[data-hud]');
    if (!hb) return;
    const k = hb.dataset.hud;
    if (k === 'clock' || k === 'event') {
      toggleForecast();
    } else if (k === 'luck') {
      watchLuckAd();
    } else if (k === 'lvl') {
      u.open('settings', { tab: 'stats' });
    }
  });
  prompt.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    g.input.setVirtualButton('interact', true);
    setTimeout(() => g.input.setVirtualButton('interact', false), 60);
  });

  async function watchLuckAd() {
    const active = u.eco.activeBoosts().find((b) => b.id === 'ad_luck');
    if (active) {
      u.toast('Luck boost already active', 'info', 'clover');
      return;
    }
    luckBtn.classList.add('busy');
    try {
      const ok = await g.platform.rewarded('luck');
      if (ok) {
        u.eco.addBoost({ id: 'ad_luck', label: '2× Luck', luckMult: 2, expiresAt: Date.now() + 5 * 60_000 });
        u.toast('2× Luck for 5 minutes!', 'rare', 'clover');
        u.sfx('reward');
      } else {
        u.toast('No reward this time — try again later', 'bad', 'ad');
        luckCooldownUntil = Date.now() + 20_000;
      }
    } catch {
      u.toast('Ad unavailable right now', 'bad', 'ad');
    }
    luckBtn.classList.remove('busy');
  }

  // ── forecast popover ──
  function toggleForecast(force?: boolean) {
    const show = force ?? forecast.hidden;
    forecast.hidden = !show;
    clockBtn.classList.toggle('open', show);
    if (show) renderForecast();
  }
  function renderForecast() {
    const env = u.clock.get();
    let fc: ReturnType<typeof u.clock.forecast> = [];
    try {
      fc = u.clock.forecast(6) ?? [];
    } catch {
      fc = [];
    }
    const phaseMs = safe(() => u.clock.msUntilPhaseChange(), NaN);
    const rows = fc.length
      ? fc
          .map((f, i) => {
            const ev = f.event ? WORLD_EVENTS.find((e) => e.id === f.event) : null;
            return `<div class="ri-fc-row${i === 0 && f.startsInMs <= 0 ? ' now' : ''}${ev ? ' ev' : ''}" ${ev ? `style="--ec:${ev.color}"` : ''}>
            <span class="ri-fc-when">${f.startsInMs <= 0 ? 'Now' : `in ${fmtClock(f.startsInMs / 1000)}`}</span>
            <span class="ri-fc-ph">${icon(f.isNight ? 'moon' : 'sunFill')}${f.isNight ? 'Night' : 'Day'}</span>
            <span class="ri-fc-wx">${weatherIcon(f.weather)}${esc(WEATHER_NAME[f.weather] ?? f.weather)}</span>
            ${ev ? `<span class="ri-fc-ev">${icon('sparkles')}${esc(ev.name)}</span>` : ''}
          </div>`;
          })
          .join('')
      : `<div class="ri-fc-empty">${icon('info')}The forecast is still being charted…</div>`;
    const evs = WORLD_EVENTS.map((e) => ({ e, ms: safe(() => u.clock.msUntilEvent(e.id), Infinity) }))
      .sort((a, b) => a.ms - b.ms)
      .map(({ e, ms }) => `<div class="ri-fc-evrow" style="--ec:${e.color}"><i></i><span><b>${esc(e.name)}</b><small>${esc(e.description)}</small></span><em>${ms <= 0 ? 'Active' : Number.isFinite(ms) ? fmtClock(ms / 1000) : '—'}</em></div>`)
      .join('');
    const wx = WEATHERS.find((w) => w.id === env.weather);
    forecast.innerHTML = `<div class="ri-fc-head">${icon(env.isNight ? 'moon' : 'sunFill')}<div><b>${env.isNight ? 'Night' : 'Day'} · ${esc(wx?.name ?? env.weather)}</b><small>${esc(wx?.description ?? '')}</small></div>
      <span class="ri-fc-phase">${env.isNight ? 'Dawn' : 'Dusk'} in <b>${Number.isFinite(phaseMs) ? fmtClock(phaseMs / 1000) : '—'}</b></span></div>
      <div class="ri-fc-sec">Forecast</div><div class="ri-fc-rows">${rows}</div>
      <div class="ri-fc-sec">World events</div><div class="ri-fc-evs">${evs}</div>
      <div class="ri-fc-foot">${seasonIcon(env.season)} ${cap(env.season)} season · the whole world shares this sky</div>`;
  }

  // ── toasts ──
  function toast(text: string, kind: ToastKind = 'info', iconName?: string) {
    const ic = iconName ?? ({ info: 'info', good: 'check', bad: 'warn', rare: 'sparkles' } as const)[kind];
    const t = el('div', `ri-toast k-${kind}`, `<span class="ri-toast-ic">${icon(ic)}</span><span class="ri-toast-t">${esc(text)}</span>`);
    toasts.prepend(t);
    while (toasts.children.length > 4) toasts.lastElementChild?.remove();
    const life = kind === 'rare' ? 4200 : 3000;
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 380);
    }, life);
  }

  // ── location banner ──
  let bannerTimer = 0;
  function location(id: string, discovered: boolean) {
    const loc = LOCATION_BY_ID[id];
    if (!loc) return;
    banners.querySelector('.ri-locbanner')?.remove();
    const b = el(
      'div',
      `ri-locbanner${discovered ? ' disc' : ''}`,
      `<small>${discovered ? `${icon('sparkles')}New location discovered${icon('sparkles')}` : 'Now entering'}</small>
      <h1>${esc(loc.name)}</h1>
      <div class="ri-lb-rule"><i></i>${icon(loc.kind === 'water' ? 'waves' : 'pin')}<i></i></div>
      <p>${esc(loc.description)}</p>
      <span class="ri-lb-tier">Recommended level ${loc.tier}${discovered ? ' · Bestiary page unlocked' : ''}</span>`,
    );
    banners.appendChild(b);
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => b.remove(), 700);
    }, discovered ? 5200 : 3600);
  }

  // ── level up ──
  function levelUp(level: number): number {
    const unlocked = RODS.filter((r) => r.unlockLevel === level && r.price > 0).map((r) => r.name);
    const locs = Object.values(LOCATION_BY_ID).filter((l) => l.tier === level).map((l) => l.name);
    const extra = [...unlocked.map((n) => `${icon('rod')}${esc(n)}`), ...locs.map((n) => `${icon('pin')}${esc(n)}`)].slice(0, 3);
    const conf = Array.from({ length: 28 }, (_, i) => {
      const hue = [48, 172, 196, 330, 90][i % 5];
      return `<i style="--x:${(Math.random() * 2 - 1).toFixed(2)};--d:${(Math.random() * 0.5).toFixed(2)}s;--r:${Math.round(Math.random() * 720 - 360)}deg;--h:${hue}"></i>`;
    }).join('');
    const o = el(
      'div',
      'ri-levelup',
      `<div class="ri-lu-rays"></div><div class="ri-lu-conf">${conf}</div>
      <div class="ri-lu-card">
        <div class="ri-lu-badge"><svg viewBox="0 0 120 120"><path d="M60 6l47 27v54l-47 27-47-27V33z"/></svg><small>LEVEL</small><b>${level}</b></div>
        <h1>Level up!</h1>
        <p>${extra.length ? `<span class="ri-lu-new">Now unlocked</span>${extra.map((x) => `<span class="ri-lu-item">${x}</span>`).join('')}` : 'Your reputation among anglers grows.'}</p>
      </div>`,
    );
    banners.appendChild(o);
    u.sfx('level_up');
    setTimeout(() => {
      o.classList.add('out');
      setTimeout(() => o.remove(), 600);
    }, 3400);
    return 3700;
  }

  // ── new species ──
  function newSpecies(fishId: string, zone: string) {
    const def = fishDef(fishId);
    let prog = { caught: 0, total: 0 };
    try {
      prog = u.eco.bestiaryProgress(zone);
    } catch {
      /* stub */
    }
    const c = el(
      'div',
      'ri-newsp',
      `<span class="ri-newsp-th">${fishThumb(u, fishId, {}, '')}</span>
      <span class="ri-newsp-t"><small>${icon('book')}New species logged</small><b style="color:${rarityColor(def?.rarity)}">${esc(def?.name ?? fishId)}</b>
      <span class="ri-newsp-p"><em>${esc(zoneName(zone))}</em>${prog.total ? `<i><b style="width:${(prog.caught / prog.total) * 100}%"></b></i><em>${prog.caught}/${prog.total}</em>` : ''}</span></span>`,
    );
    c.addEventListener('click', () => u.open('bestiary', { zone, fishId }));
    root.appendChild(c);
    setTimeout(() => {
      c.classList.add('out');
      setTimeout(() => c.remove(), 600);
    }, 5200);
  }

  function coinsDelta(delta: number) {
    if (!delta) return;
    const f = el('span', `ri-cf ${delta > 0 ? 'up' : 'down'}`, `${delta > 0 ? '+' : '−'}${fmtCoins(Math.abs(delta))}`);
    coinFloat.appendChild(f);
    setTimeout(() => f.remove(), 1400);
    const pill = q('.ri-coinpill');
    pill.classList.remove('bump');
    void pill.offsetWidth;
    pill.classList.add('bump');
  }
  function xpDelta(delta: number) {
    if (delta <= 0) return;
    const row = q('.ri-xprow');
    row.classList.remove('bump');
    void row.offsetWidth;
    row.classList.add('bump');
  }

  // ── per-frame ──
  function updateCompass() {
    const cam = g.camera;
    cam.getWorldDirection(dir);
    const bearing = ((Math.atan2(dir.x, -dir.z) * 180) / Math.PI + 360) % 360;
    const w = 300;
    cmpStrip.style.transform = `translate3d(${(w / 2 - (bearing + 180) * PPD).toFixed(1)}px,0,0)`;
    const card = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
    setText(cmpDeg, `${card} ${Math.round(bearing)}°`);
    const pos = u.playerPos();
    if (!pos) return;
    const seen = new Set<string>();
    const place = (key: string, x: number, z: number, label: string, cls: string, ic: string) => {
      const dx = x - pos.x;
      const dz = z - pos.z;
      const dist = Math.hypot(dx, dz);
      const b = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      let rel = b - bearing;
      rel = ((rel + 540) % 360) - 180;
      const half = w / 2 / PPD - 4;
      let m = markEls.get(key);
      if (!m) {
        m = el('span', `ri-cmp-m ${cls}`, `${icon(ic)}<b></b><small></small>`);
        cmpMarks.appendChild(m);
        markEls.set(key, m);
      }
      seen.add(key);
      const vis = Math.abs(rel) < half && dist > 30;
      m.style.opacity = vis ? String(clamp(1.3 - Math.abs(rel) / half, 0.25, 1)) : '0';
      m.style.transform = `translate3d(${(w / 2 + clamp(rel, -half, half) * PPD).toFixed(1)}px,0,0)`;
      setText(m.querySelector('b')!, label);
      setText(m.querySelector('small')!, dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist / 10) * 10} m`);
    };
    const disc = new Set(u.eco.save.discovered ?? []);
    const isl = u.game.world?.islands ?? [];
    // nearest 5 islands (excluding current one)
    const near = isl
      .map((i) => ({ i, d: Math.hypot(i.center.x - pos.x, i.center.z - pos.z) }))
      .filter((o) => o.d > o.i.radius * 1.1)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5);
    for (const { i } of near) place(`isl:${i.id}`, i.center.x, i.center.z, disc.has(i.id) ? i.name : '???', disc.has(i.id) ? 'isl' : 'isl unk', 'pin');
    if (waypoint) place('wp', waypoint.x, waypoint.z, waypoint.label, 'wp', 'flag');
    for (const [k, m] of markEls) {
      if (!seen.has(k)) {
        m.remove();
        markEls.delete(k);
      }
    }
  }

  function updateProfile(dt: number) {
    const coinsNow = u.eco.coins();
    shownCoins = Math.abs(coinsNow - shownCoins) < 1 ? coinsNow : shownCoins + (coinsNow - shownCoins) * Math.min(1, dt * 7);
    const ct = fmtCoins(Math.round(shownCoins));
    if (ct !== lastCoinsText) {
      coinVal.textContent = ct;
      lastCoinsText = ct;
    }
    const lvl = u.eco.level();
    if (lvl !== lastLevel) {
      lvlB.textContent = String(lvl);
      lastLevel = lvl;
      root.querySelector('.ri-lvl')!.classList.toggle('big', lvl >= 100);
    }
    const need = Math.max(1, u.eco.xpToNext());
    const xp = u.eco.xp();
    const frac = clamp(xp / need, 0, 1);
    if (Math.abs(frac - lastXpFrac) > 0.001) {
      lastXpFrac = frac;
      xpBar.style.width = `${(frac * 100).toFixed(1)}%`;
      lvlRing.setAttribute('stroke-dashoffset', String((100 - frac * 100).toFixed(2)));
    }
    setText(xpTxt, `${fmtInt(xp)} / ${fmtInt(need)} XP`);
  }

  function updateClock() {
    const env = u.clock.get();
    const gt = gameTime(env.dayProgress);
    setText(clockT, gt.text);
    const key = `${env.isNight}|${env.weather}|${env.season}`;
    if (clockPh.dataset.k !== key) {
      clockPh.dataset.k = key;
      clockPh.innerHTML = icon(env.isNight ? 'moon' : 'sunFill');
      clockBtn.classList.toggle('night', env.isNight);
      clockWx.innerHTML = `${weatherIcon(env.weather)}<span>${esc(WEATHER_NAME[env.weather] ?? env.weather)}</span>`;
      clockSe.innerHTML = seasonIcon(env.season);
      clockSe.title = cap(env.season);
      clockSe.className = `ri-clock-se s-${env.season}`;
      clockBtn.dataset.wx = env.weather;
    }
    // event banner
    let evHtml = '';
    let evKey = '';
    if (env.event) {
      const ev = WORLD_EVENTS.find((e) => e.id === env.event);
      const ms = safe(() => u.clock.msUntilPhaseChange(), NaN);
      evKey = `a|${env.event}`;
      evHtml = `<span class="ri-ev-ic">${icon('sparkles')}</span><span class="ri-ev-t"><small>World event · active</small><b>${esc(ev?.name ?? env.event)}</b></span><span class="ri-ev-c">${Number.isFinite(ms) ? fmtClock(ms / 1000) : ''}</span>`;
      eventBtn.style.setProperty('--ec', ev?.color ?? '#ffcf5c');
    } else {
      let best: { id: string; ms: number } | null = null;
      for (const e of WORLD_EVENTS) {
        const ms = safe(() => u.clock.msUntilEvent(e.id), Infinity);
        if (Number.isFinite(ms) && ms > 0 && (!best || ms < best.ms)) best = { id: e.id, ms };
      }
      if (best && best.ms < 90 * 60_000) {
        const ev = WORLD_EVENTS.find((e) => e.id === best!.id)!;
        evKey = `n|${ev.id}`;
        evHtml = `<span class="ri-ev-ic">${icon('hourglass')}</span><span class="ri-ev-t"><small>Next world event</small><b>${esc(ev.name)}</b></span><span class="ri-ev-c">${fmtClock(best.ms / 1000)}</span>`;
        eventBtn.style.setProperty('--ec', ev.color);
      }
    }
    eventBtn.hidden = !evHtml;
    eventBtn.classList.toggle('active', evKey.startsWith('a|'));
    if (evHtml && eventBtn.innerHTML !== evHtml) eventBtn.innerHTML = evHtml;
    if (!forecast.hidden) renderForecast();
  }

  function boostIcon(b: Boost): string {
    if (b.luckMult) return 'clover';
    if (b.lureMult) return 'lure';
    if (b.xpMult) return 'xp';
    if (b.sellMult) return 'coinsStack';
    if (b.mutationMult) return 'sparkles';
    return 'sparkle';
  }
  function updateBoosts() {
    let list: Boost[] = [];
    try {
      list = u.eco.activeBoosts() ?? [];
    } catch {
      list = [];
    }
    const nowMs = Date.now();
    list = list.filter((b) => b.expiresAt > nowMs);
    const key = list.map((b) => `${b.id}@${b.expiresAt}`).join(',');
    if (key !== lastBoostKey) {
      lastBoostKey = key;
      boostsEl.innerHTML = list
        .map((b) => {
          const mult = b.luckMult ?? b.lureMult ?? b.xpMult ?? b.sellMult ?? b.mutationMult;
          return `<div class="ri-boost b-${boostIcon(b)}" data-b="${esc(b.id)}@${b.expiresAt}">
          <span class="ri-boost-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" pathLength="100"/></svg>${icon(boostIcon(b))}</span>
          <span class="ri-boost-t"><b>${esc(b.label)}</b><small>${mult ? `×${mult}` : ''}</small></span><em>0:00</em></div>`;
        })
        .join('');
      for (const b of list) {
        const k = `${b.id}@${b.expiresAt}`;
        if (!boostTotals.has(k)) boostTotals.set(k, Math.max(b.expiresAt - nowMs, 1000));
      }
    }
    boostsEl.querySelectorAll<HTMLElement>('.ri-boost').forEach((n) => {
      const [id, exp] = n.dataset.b!.split('@');
      const left = Number(exp) - nowMs;
      const tot = boostTotals.get(`${id}@${exp}`) ?? 60000;
      setText(n.querySelector('em')!, fmtClock(left / 1000));
      n.querySelector('circle')!.setAttribute('stroke-dashoffset', String((100 - clamp(left / tot, 0, 1) * 100).toFixed(1)));
      n.classList.toggle('low', left < 30_000);
    });
    // luck button state
    const ad = list.find((b) => b.id === 'ad_luck');
    luckBtn.classList.toggle('active', !!ad);
    const cool = luckCooldownUntil > nowMs;
    luckBtn.classList.toggle('cool', cool);
    const txt = ad ? `${icon('hourglass')}${fmtClock((ad.expiresAt - nowMs) / 1000)}` : cool ? `${icon('hourglass')}${fmtClock((luckCooldownUntil - nowMs) / 1000)}` : `${icon('ad')}5 min`;
    if (luckSmall.innerHTML !== txt) luckSmall.innerHTML = txt;
  }

  function updateEquip() {
    const save = u.eco.save;
    const bait = save.equippedBait ? BAIT_BY_ID[save.equippedBait] : null;
    const baitN = save.equippedBait ? save.baits?.[save.equippedBait] ?? 0 : 0;
    const bp = save.backpack?.length ?? 0;
    const size = Math.max(1, save.backpackSize ?? 30);
    const key = `${save.equippedRod}|${save.equippedBait}|${baitN}|${bp}|${size}`;
    if (key === lastEquipKey) return;
    lastEquipKey = key;
    const rod = ROD_BY_ID[save.equippedRod];
    equipRod.textContent = rod?.name ?? 'No rod';
    equipBait.innerHTML = bait ? `${icon('bait')}${esc(bait.name)} <em>×${fmtInt(baitN)}</em>` : `${icon('bait')}<span class="dim">No bait equipped</span>`;
    if (equipTh.dataset.rod !== save.equippedRod) {
      equipTh.dataset.rod = save.equippedRod;
      equipTh.innerHTML = rodThumb(u, save.equippedRod);
    }
    const f = bp / size;
    equipBp.style.width = `${Math.min(100, f * 100)}%`;
    equipBp.parentElement!.className = `ri-equip-bp${f >= 1 ? ' full' : f >= 0.8 ? ' warn' : ''}`;
    equipBp.parentElement!.dataset.t = `${bp}/${size}`;
    bpBadge.textContent = `${bp}/${size}`;
    bpBadge.className = `ri-bpbadge${f >= 1 ? ' full' : f >= 0.8 ? ' warn' : ''}`;
  }

  function updatePrompt() {
    const t = u.nearest();
    const hide = !t || u.isOpen() || fishingOn;
    const key = hide ? '' : `${t!.id}`;
    if (key === lastPromptKey) return;
    lastPromptKey = key;
    if (hide) {
      prompt.hidden = true;
      return;
    }
    const v = interactVerb(t!);
    promptIc.innerHTML = icon(v.icon);
    promptT.innerHTML = `${esc(v.verb)} <b>${esc(v.name)}</b>`;
    prompt.hidden = false;
    prompt.classList.remove('pop');
    void prompt.offsetWidth;
    prompt.classList.add('pop');
  }

  function updateLocation() {
    const pos = u.playerPos();
    if (!pos) return;
    let id = '';
    try {
      id = u.game.world.locationAt(pos.x, pos.z);
    } catch {
      id = '';
    }
    if (id === lastLoc) return;
    lastLoc = id;
    const loc = LOCATION_BY_ID[id];
    locName.innerHTML = loc ? `${icon(loc.kind === 'water' ? 'waves' : 'pin')}${esc(loc.name)}<em>Lv ${loc.tier}+</em>` : esc(zoneName(id));
  }

  let fishingOn = false;
  function setFishing(on: boolean) {
    if (fishingOn === on) return;
    fishingOn = on;
    root.classList.toggle('fishing', on);
    lastPromptKey = '#';
  }

  document.addEventListener('pointerdown', (e) => {
    if (forecast.hidden) return;
    const t = e.target as HTMLElement;
    if (!t.closest('.ri-forecast') && !t.closest('.ri-clock') && !t.closest('.ri-event')) toggleForecast(false);
  });

  return {
    el: root,
    update(dt) {
      updateProfile(dt);
      updateCompass();
      slowT -= dt;
      if (slowT <= 0) {
        slowT = 0.2;
        updateEquip();
        updatePrompt();
        updateLocation();
        updateBoosts();
      }
      clockT2 -= dt;
      if (clockT2 <= 0) {
        clockT2 = 0.5;
        updateClock();
      }
    },
    toast,
    location,
    levelUp,
    newSpecies,
    setWaypoint(w) {
      waypoint = w;
    },
    coinsDelta,
    xpDelta,
    setFishing,
    closePopovers() {
      toggleForecast(false);
    },
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
