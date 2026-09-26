// DOM user interface: HUD, world labels, panels, popups, banners and the
// crate reveal text. Deliberately chunky & playful (mobile idle game style).

import * as THREE from 'three';
import { icon, setIconFactory, iconUrl } from './icons.js';
import { IconFactory } from './icons3d.js';
import { Overlay2D } from './overlay2d.js';
import { Thumbs } from './thumbs.js';
import { fmt, fmtTime, pct, fmtInt, fmtClock } from '../util/format.js';
import * as E from '../core/economy.js';
import { UPGRADES } from '../data/upgrades.js';
import { WEAPONS, WEAPON_BY_ID, baseDps } from '../data/weapons.js';
import { RARITIES } from '../data/rarities.js';
import { zoneName, ZONES, zoneIndexForWave } from '../data/zones.js';
import { CRATE_TIERS, crateTierForLevel } from '../gfx/props.js';
import { Platform } from '../core/platform.js';
import * as L from '../game/layout.js';

const $ = (sel, root = document) => root.querySelector(sel);
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
const _v = new THREE.Vector3();

// ------------------------------------------------------------------ world labels
// Each label is an absolutely positioned wrapper (moved every frame) around the
// visible element (which may animate freely without breaking the position).
class Labels {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.items = {};
    this.add('crate', `<div class="wl wl-crate">
        <div class="wl-title" data-k="title">OPEN CRATE</div>
        <div class="price-chip" data-k="price">${icon('coin')}<span class="v">0</span></div>
        <div class="pity"><div class="pity-fill" data-k="pity"></div><span data-k="pityTxt">EPIC+ IN 30</span></div>
      </div>`, L.CRATE_POS.x, 3.1, L.CRATE_POS.z);
    this.add('luck', `<div class="wl wl-station green">
        <div class="wl-title">${icon('clover')}<span>CRATE LUCK</span></div>
        <div class="wl-sub" data-k="sub">Lv 1</div>
        <div class="price-chip" data-k="price">${icon('coin')}<span class="v">0</span></div>
      </div>`, L.LUCK_POS.x, 4.0, L.LUCK_POS.z);
    this.add('vault', `<div class="wl wl-station purple">
        <div class="wl-title">${icon('vault')}<span>IDLE VAULT</span></div>
        <div class="wl-sub" data-k="sub">Lv 0</div>
        <div class="price-chip" data-k="price">${icon('coin')}<span class="v">0</span></div>
      </div>`, L.VAULT_POS.x, 3.0, L.VAULT_POS.z);
    this.add('barricade', `<div class="wl wl-hp">${icon('shield')}<div class="bar"><div class="fill" data-k="fill"></div><span data-k="txt"></span></div></div>`, 0, 2.4, L.BARRICADE_Z);
    this.add('slot', `<button class="wl wl-slot">${icon('slot')}<div><b>NEW GUN SLOT</b><div class="price-chip small" data-k="price">${icon('coin')}<span class="v">0</span></div></div></button>`, 0, 1.6, 0);
    this.add('arrow', `<div class="wl wl-arrow">${icon('arrowDown')}</div>`, L.CRATE_PAD.x, 1.4, L.CRATE_PAD.z);
    this.gunLabels = [];
    for (let i = 0; i < 3; i++) {
      const key = 'gun' + i;
      this.add(key, `<div class="wl wl-gun">
          <div class="wl-gname" data-k="name"></div>
          <div class="wl-glv"><span data-k="lv"></span> ${icon('up')} <span data-k="dps"></span></div>
          <div class="price-chip small" data-k="price">${icon('coin')}<span class="v">0</span></div>
        </div>`, 0, 0, 0);
      this.items[key].slot = -1;
      this.set(key, false);
      this.gunLabels.push(this.items[key]);
    }
    this.items.slot.el.addEventListener('click', (e) => {
      e.stopPropagation();
      game.onUserGesture();
      const n = E.slotCount(game.state);
      const sl = L.SLOTS[n];
      if (sl) game.player.walkTo(sl.x, sl.z);
    });
    for (const k of ['crate', 'luck', 'vault']) {
      this.items[k].el.addEventListener('click', (e) => {
        e.stopPropagation();
        game.onUserGesture();
        const pad = k === 'crate' ? L.CRATE_PAD : k === 'luck' ? L.LUCK_PAD : L.VAULT_PAD;
        game.player.walkTo(pad.x, pad.z);
      });
    }
  }

  add(key, html, x, y, z) {
    const inner = el(html);
    const wrap = document.createElement('div');
    wrap.className = 'wl-pos';
    wrap.appendChild(inner);
    this.root.appendChild(wrap);
    const refs = {};
    inner.querySelectorAll('[data-k]').forEach((n) => (refs[n.dataset.k] = n));
    this.items[key] = { el: inner, wrap, refs, pos: new THREE.Vector3(x, y, z), visible: true };
  }

  deny(key) {
    const it = this.items[key];
    if (!it) return;
    it.el.classList.remove('shake');
    void it.el.offsetWidth;
    it.el.classList.add('shake');
    this.game.audio.play('deny');
  }

  set(key, visible) {
    const it = this.items[key];
    if (it.visible !== visible) {
      it.visible = visible;
      it.wrap.style.display = visible ? '' : 'none';
    }
  }

  update() {
    const cam = this.game.camera;
    const w = this.game.width;
    const h = this.game.height;
    for (const k in this.items) {
      const it = this.items[k];
      if (!it.visible) continue;
      _v.copy(it.pos).project(cam);
      if (_v.z > 1 || _v.x < -1.3 || _v.x > 1.3 || _v.y < -1.3 || _v.y > 1.3) {
        it.wrap.style.transform = 'translate(-9999px,0)';
        continue;
      }
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h;
      // keep world labels out from under the top HUD
      const hidden = y < (this.game.portrait ? 150 : 118);
      it.wrap.style.opacity = hidden ? '0' : '1';
      it.wrap.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
}

// ------------------------------------------------------------------ UI
export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.icons = new IconFactory(game.renderer);
    setIconFactory(this.icons);
    this.overlay = new Overlay2D(game, document.getElementById('fx2d'));
    this.overlay.setCoinImage(iconUrl('coin'));
    this.labels = new Labels(game, document.getElementById('labels'));
    this.thumbs = new Thumbs(game.renderer);
    this.lastWeaponFlash = 0;
    this.coinShown = game.state.coins;
    this.dpsShown = 0;
    this.refreshT = 0;
    this.buyN = 1;
    this.open = null;
    this.hintKey = null;
    this.tipT = 0;
    this.flashA = 0;
    this.buildHud();
    this.buildPanels();
    this.onResize();
  }

  // ---------------------------------------------------------------- HUD
  buildHud() {
    const g = this.game;
    const hud = el(`<div id="hud">
      <div class="flash" id="flash"></div>
      <div class="zone-fade" id="zoneFade"></div>
      <div class="hud-tl">
        <div class="pill coin-pill" id="coinPill">${icon('coin', 'big')}<span class="val" id="coinVal">0</span></div>
        <div class="pill dps-pill" id="dpsPill">${icon('bolt')}<span class="val" id="dpsVal">0</span><span class="unit">DPS</span></div>
      </div>
      <div class="hud-tc">
        <div class="wave-card">
          <div class="wave-line"><span class="wave-title" id="waveNum">WAVE 1</span><span class="zone-name" id="zoneName">Desert Outpost</span></div>
          <div class="bar wave-bar"><div class="fill" id="waveFill"></div><span id="waveTxt"></span></div>
        </div>
        <div class="boss-bar hidden" id="bossBar">${icon('skull')}<div class="bar"><div class="fill" id="bossFill"></div><span id="bossName">BOSS</span></div></div>
      </div>
      <div class="hud-tr">
        <button class="round-btn gloss" id="btnSettings" aria-label="Settings">${icon('gear')}</button>
      </div>
      <div class="hud-r" id="boosts">
        <button class="boost luck gloss" data-boost="luck">${icon('clover')}<div><b>LUCK x3</b><small class="bt"></small></div></button>
        <button class="boost coins gloss" data-boost="coins">${icon('coin')}<div><b>2X COINS</b><small class="bt"></small></div></button>
      </div>
      <div class="hud-bl"><button class="big-btn orange gloss" id="btnUpgrades">${icon('up')}<span>UPGRADES</span><i class="badge hidden" id="upBadge"></i></button></div>
      <div class="hud-br"><button class="big-btn blue gloss" id="btnArsenal">${icon('gun')}<span>ARSENAL</span><i class="badge hidden" id="arsBadge">NEW</i></button></div>
      <div class="hint hidden" id="hint"></div>
      <div class="toasts" id="toasts"></div>
      <div class="banner" id="banner"></div>
      <div class="gun-tip hidden" id="gunTip"></div>
      <div class="fps hidden" id="fps"></div>
    </div>`);
    this.root.appendChild(hud);
    this.hud = hud;
    const click = (id, fn) =>
      $(id, hud).addEventListener('click', (e) => {
        e.stopPropagation();
        g.onUserGesture();
        g.audio.play('click');
        fn();
      });
    click('#btnSettings', () => this.togglePanel('settings'));
    click('#btnUpgrades', () => this.togglePanel('upgrades'));
    click('#btnArsenal', () => this.togglePanel('arsenal'));
    hud.querySelectorAll('.boost').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        g.onUserGesture();
        g.activateBoost(b.dataset.boost);
      })
    );
    this.els = {
      coinVal: $('#coinVal', hud), coinPill: $('#coinPill', hud), dpsVal: $('#dpsVal', hud), dpsPill: $('#dpsPill', hud),
      waveNum: $('#waveNum', hud), zoneName: $('#zoneName', hud), waveFill: $('#waveFill', hud), waveTxt: $('#waveTxt', hud),
      bossBar: $('#bossBar', hud), bossFill: $('#bossFill', hud), bossName: $('#bossName', hud),
      upBadge: $('#upBadge', hud), arsBadge: $('#arsBadge', hud), hint: $('#hint', hud), toasts: $('#toasts', hud),
      banner: $('#banner', hud), flash: $('#flash', hud), tip: $('#gunTip', hud), zoneFade: $('#zoneFade', hud), fps: $('#fps', hud),
      btnUp: $('#btnUpgrades', hud), boosts: hud.querySelectorAll('.boost'),
    };
    if (g.debug) this.els.fps.classList.remove('hidden');
  }

  onResize() {
    this.overlay.resize();
    requestAnimationFrame(() => this._updateCoinTarget());
  }

  _updateCoinTarget() {
    const ic = this.els.coinPill.querySelector('.ic');
    const r = ic.getBoundingClientRect();
    this.overlay.setTarget(r.left + r.width / 2, r.top + r.height / 2);
  }

  coinArrived() {
    const p = this.els.coinPill;
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
    this.game.audio.play('coin');
  }

  bumpDps() {
    const p = this.els.dpsPill;
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  }

  floatCost(cost) {
    const r = this.els.coinPill.getBoundingClientRect();
    this.overlay.floatScreen(r.left + r.width * 0.6, r.bottom + 14, '-$' + fmt(cost), '#ff6b6b', 22, 1.0);
  }

  floatWorldText(x, y, z, text, color) {
    this.overlay.floatText(x, y, z, text, color, 1.6);
  }

  flash(a, color, fromWeapon = false) {
    // JS driven (CSS transitions can stall when frames are throttled)
    if (this.game.settings.flashes === false) a *= 0.25;
    if (fromWeapon) {
      const now = performance.now();
      if (now - this.lastWeaponFlash < 2500) return;
      this.lastWeaponFlash = now;
      a = Math.min(a, 0.12);
    }
    if (a < this.flashA) return;
    this.flashA = a;
    this.els.flash.style.background = color;
  }

  zoneTransition(cb, zi) {
    const f = this.els.zoneFade;
    f.classList.add('on');
    setTimeout(() => {
      cb();
      const name = ZONES[zi % ZONES.length].name;
      this.banner('NEW ZONE!', name, 'zone');
      setTimeout(() => f.classList.remove('on'), 120);
    }, 450);
  }

  // ---------------------------------------------------------------- messages
  banner(title, sub = '', kind = '') {
    const b = this.els.banner;
    b.className = 'banner ' + kind;
    b.innerHTML = `<div class="b-title">${title}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), 2400);
  }

  toast(title, sub) {
    const t = el(`<div class="toast"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`);
    this.els.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1800);
    setTimeout(() => t.remove(), 2300);
    while (this.els.toasts.children.length > 3) this.els.toasts.firstChild.remove();
  }

  hint(key) {
    const g = this.game;
    const h = this.els.hint;
    this.hintKey = key;
    const H = {
      tut0: ['hand', 'Walk to the glowing CRATE to open it!', 'WASD / Arrow keys · or click / drag'],
      tut1: ['gun', 'Your guns shoot automatically!', 'Kill monsters → earn coins → open more crates'],
      tut2: ['up', 'You can afford an upgrade!', 'Open UPGRADES to power up your army'],
      gunpad: ['up', 'Walk up to a gun on the wall!', 'Stand on its blue pad to level it up'],
      slot: ['slot', 'Build a new gun slot!', 'Walk to the green pad on the wall'],
      boss: ['skull', 'BOSS! Focus fire!', 'Beat it for a free BOSS CRATE'],
      breach: ['shield', 'The horde broke through!', 'Upgrade Barricade, level up guns or open more crates'],
    };
    const d = H[key];
    if (!d) return;
    h.innerHTML = `${icon(d[0], key === 'tut0' ? 'wiggle' : '')}<div><b>${d[1]}</b><span>${d[2]}</span></div>`;
    h.classList.remove('hidden');
    clearTimeout(this.hintT);
    if (key !== 'tut0' && key !== 'tut2') {
      this.hintT = setTimeout(() => {
        if (this.hintKey === key) {
          this.hideHint();
          if (key === 'tut1' && g.state.tut < 2) g.state.tut = 2;
        }
      }, key === 'tut1' ? 7000 : 6500);
    }
  }

  /** Contextual one-time tips. */
  hintOnce(key) {
    const s = this.game.state;
    s.hints = s.hints || {};
    if (s.hints[key] || this.hintKey || s.tut < 1) return;
    s.hints[key] = 1;
    this.hint(key);
  }

  hideHint() {
    this.hintKey = null;
    this.els.hint.classList.add('hidden');
  }

  showGunTip(slot, tapped = false) {
    const g = slot.data;
    if (!g) return;
    const w = WEAPON_BY_ID[g.t];
    const r = RARITIES[w.rarity];
    const dps = E.gunDps(g, this.game.state);
    const tip = this.els.tip;
    tip.innerHTML = `<div class="tip-name" style="color:${g.g ? '#ffd23f' : r.color}">${g.g ? '★ GOLDEN ' : ''}${w.name}</div>
      <div class="tip-row"><span class="rtag r-${r.id}">${r.name}</span><span class="lv">Lv ${g.l}</span></div>
      <div class="tip-row">${icon('bolt')} <b>${fmt(dps)}</b>&nbsp;DPS</div>`;
    tip.classList.remove('hidden');
    this.tipSlot = slot;
    this.tipT = tapped ? 2.5 : 0.15;
  }

  // ---------------------------------------------------------------- reveal
  showReveal(res, w) {
    const r = RARITIES[res.rarity];
    const s = this.game.state;
    const d = res.place;
    let outcome = '';
    if (d.kind === 'place') outcome = `${icon('slot')} Added to your army!`;
    else if (d.kind === 'replace') outcome = `${icon('up')} Replaces your ${WEAPON_BY_ID[res.old.t].name} <em>+$${fmt(res.scrap)}</em>`;
    else if (d.kind === 'levelup') outcome = `${icon('star')} Merged! ${w.name} is now <em>Lv ${res.newLevel}</em>`;
    else {
      const m = res.mastery;
      const next = E.masteryNext(m.level);
      outcome = m.up
        ? `${icon('star')} <b>MASTERY ${m.level}!</b> All ${w.name}s deal <em>+${m.level * 25}%</em>`
        : `${icon('star')} Mastery ${m.copies}/${next} · <em>+$${fmt(res.scrap)}</em>`;
    }
    const lvl = d.kind === 'levelup' ? res.newLevel : 1;
    const dps = E.gunDps({ t: res.t, l: lvl, g: res.g }, s);
    const ui = el(`<div id="reveal-ui" class="rv r-${r.id}${res.g ? ' gold' : ''}${res.quick ? ' quick' : ''}">
      <div class="rv-top">
        ${res.isNew ? '<div class="rv-new">NEW GUN!</div>' : ''}
        <div class="rv-rarity">${res.g ? 'GOLDEN ' : ''}${r.name.toUpperCase()}</div>
        ${res.kind === 'boss' ? '<div class="rv-kind">BOSS CRATE</div>' : ''}
      </div>
      <div class="rv-bottom">
        <div class="rv-name">${w.name}</div>
        <div class="rv-stats"><span>${icon('bolt')} ${fmt(dps)} DPS</span><span>${icon('fire')} ${fmt(w.dmg * (w.pellets || 1))} DMG</span>${res.g ? `<span class="gold-tag">${icon('star')} x2 DAMAGE</span>` : ''}</div>
        <div class="rv-desc">${w.desc}</div>
        <div class="rv-outcome">${outcome}</div>
        ${res.quick ? '' : '<div class="rv-tap">TAP TO CONTINUE</div>'}
      </div>
    </div>`);
    const old = $('#reveal-ui');
    if (old) old.remove();
    ui.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.game.onUserGesture();
      this.game.reveal.dismiss();
    });
    this.root.appendChild(ui);
    requestAnimationFrame(() => ui.classList.add('show'));
    if (res.rarity >= 4) {
      this.game.fx.confetti(L.CRATE_POS.x, 3, L.CRATE_POS.z, 70);
      this.flash(0.35, r.color);
    }
    if (this.hintKey === 'tut0') this.hideHint();
  }

  hideReveal() {
    const ui = $('#reveal-ui');
    if (!ui) return;
    ui.classList.remove('show');
    ui.classList.add('hide');
    setTimeout(() => ui.remove(), 300);
    this.refreshAll();
  }

  // ---------------------------------------------------------------- panels
  buildPanels() {
    const g = this.game;
    this.panels = {};
    const mk = (id, color, iconName, title, extraHead = '', cls = '') => {
      const m = el(`<div class="modal hidden" id="panel-${id}">
        <div class="panel ${cls}">
          <div class="panel-head ${color}">${icon(iconName)}<h2>${title}</h2>${extraHead}<button class="x gloss" aria-label="Close">${icon('close')}</button></div>
          <div class="panel-body"></div>
        </div></div>`);
      m.addEventListener('pointerdown', (e) => {
        if (e.target === m) this.closeTop();
      });
      $('.x', m).addEventListener('click', () => {
        g.audio.play('click');
        this.closeTop();
      });
      this.root.appendChild(m);
      this.panels[id] = { el: m, body: $('.panel-body', m) };
      return m;
    };

    // upgrades
    const up = mk('upgrades', 'orange', 'up', 'UPGRADES', `<div class="seg" id="buyMode"><button data-n="1" class="on">x1</button><button data-n="10">x10</button><button data-n="9999">MAX</button></div>`);
    up.querySelectorAll('#buyMode button').forEach((b) =>
      b.addEventListener('click', () => {
        this.buyN = Number(b.dataset.n);
        up.querySelectorAll('#buyMode button').forEach((x) => x.classList.toggle('on', x === b));
        g.audio.play('click');
        this.renderUpgrades();
      })
    );
    const body = this.panels.upgrades.body;
    for (const u of UPGRADES) {
      const row = el(`<div class="up-row" data-id="${u.id}">
        <div class="up-icon" style="--c:${u.color}">${icon(u.icon)}</div>
        <div class="up-info"><div class="up-name">${u.name} <span class="lvl"></span></div><div class="up-desc">${u.desc}</div><div class="up-eff"></div></div>
        <button class="buy-btn gloss">${icon('coin')}<span class="cost"></span><small class="cnt"></small></button>
      </div>`);
      const btn = $('.buy-btn', row);
      let holdT = null;
      const buy = () => {
        g.onUserGesture();
        if (g.buyUpgrade(u.id, this.buyN)) {
          row.classList.remove('flash-ok');
          void row.offsetWidth;
          row.classList.add('flash-ok');
        }
        this.renderUpgrades();
      };
      btn.addEventListener('click', buy);
      btn.addEventListener('pointerdown', () => {
        clearInterval(holdT);
        let n = 0;
        holdT = setInterval(() => {
          n++;
          if (n > 3) buy();
        }, 120);
      });
      const stop = () => clearInterval(holdT);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      body.appendChild(row);
    }

    // arsenal
    mk('arsenal', 'blue', 'gun', 'ARSENAL', `<div class="head-count" id="arsCount"></div>`, 'wide');
    this.panels.arsenal.body.innerHTML = `
      <div class="odds" id="odds"></div>
      <div class="tabs"><button class="tab on" data-tab="collection">COLLECTION</button><button class="tab" data-tab="army">MY ARMY</button></div>
      <div class="grid" id="arsGrid"></div>
      <div class="army hidden" id="armyList"></div>`;
    this.panels.arsenal.el.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => {
        g.audio.play('click');
        this.panels.arsenal.el.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
        const army = t.dataset.tab === 'army';
        $('#arsGrid').classList.toggle('hidden', army);
        $('#armyList').classList.toggle('hidden', !army);
        this.renderArsenal();
      })
    );

    // settings
    mk('settings', 'purple', 'gear', 'SETTINGS');
    this.panels.settings.body.innerHTML = `
      <div class="set-row">${icon('music')}<label>Music</label><input type="range" min="0" max="1" step="0.05" id="setMusic"></div>
      <div class="set-row">${icon('sound')}<label>Sound FX</label><input type="range" min="0" max="1" step="0.05" id="setSfx"></div>
      <div class="set-row">${icon('gear')}<label>Graphics</label><div class="seg" id="setQuality"><button data-q="auto">AUTO</button><button data-q="low">LOW</button><button data-q="medium">MED</button><button data-q="high">HIGH</button></div></div>
      <div class="set-row">${icon('bolt')}<label>Damage numbers</label><button class="toggle" id="setDmg"></button></div>
      <div class="set-row">${icon('fire')}<label>Screen shake</label><button class="toggle" id="setShake"></button></div>
      <div class="set-row">${icon('crate')}<label>Auto-continue reveals</label><button class="toggle" id="setAuto"></button></div>
      <div class="set-row">${icon('star')}<label>Screen flashes</label><button class="toggle" id="setFlash"></button></div>
      <div class="set-box"><h3>HOW TO PLAY</h3>
        <p><b>Move:</b> WASD / Arrow keys, or click &amp; drag anywhere. Click the ground to walk there. Mouse wheel zooms.</p>
        <p><b>Crate:</b> Stand on the yellow circle to open it. Better guns fill your walls automatically.</p>
        <p><b>Guns:</b> Walk onto the decks along the road. Stand on a gun's blue pad to level it up, or on the green pad to build a new slot.</p>
        <p><b>Shortcuts:</b> U = Upgrades · I = Arsenal · E/Space = go to crate · M = mute · Esc = menu</p></div>
      <div class="set-box"><h3>STATS</h3><div class="stats" id="statsGrid"></div></div>
      <div class="set-actions"><button class="btn red small gloss" id="setReset">RESET PROGRESS</button></div>
      <div class="credits">Build a Gun Army · v1.0</div>`;
    const sb = this.panels.settings.body;
    const music = $('#setMusic', sb);
    const sfx = $('#setSfx', sb);
    music.addEventListener('input', () => {
      g.settings.music = Number(music.value);
      g.audio.setVolumes(g.settings.sfx, g.settings.music);
      g.save();
    });
    sfx.addEventListener('input', () => {
      g.settings.sfx = Number(sfx.value);
      g.audio.setVolumes(g.settings.sfx, g.settings.music);
    });
    sfx.addEventListener('change', () => {
      g.audio.play('coin');
      g.save();
    });
    sb.querySelectorAll('#setQuality button').forEach((b) =>
      b.addEventListener('click', () => {
        g.setQualitySetting(b.dataset.q);
        g.audio.play('click');
        this.renderSettings();
      })
    );
    const tog = (id, key) =>
      $(id, sb).addEventListener('click', () => {
        g.settings[key] = !g.settings[key];
        g.audio.play('click');
        g.save();
        this.renderSettings();
      });
    tog('#setDmg', 'dmgNumbers');
    tog('#setShake', 'shake');
    tog('#setAuto', 'autoContinue');
    tog('#setFlash', 'flashes');
    $('#setReset', sb).addEventListener('click', () => this.confirmReset());

    // offline popup
    const off = el(`<div class="modal hidden" id="popup-offline"><div class="panel small pop">
      <div class="panel-head purple">${icon('vault')}<h2>WELCOME BACK!</h2></div>
      <div class="panel-body center">
        <div class="off-sub">Your army kept shooting while you were away</div>
        <div class="off-amount">${icon('coin', 'big')}<span id="offAmt">0</span></div>
        <div class="off-time" id="offTime"></div>
        <div class="off-btns"><button class="btn green gloss" id="offCollect">COLLECT</button><button class="btn purple gloss" id="offDouble">${icon('play')}<span>COLLECT x2</span></button></div>
        <div class="off-tip">Upgrade the <b>Idle Vault</b> to earn more while offline</div>
      </div></div></div>`);
    this.root.appendChild(off);
    this.panels.offline = { el: off, body: $('.panel-body', off) };

    // confirm
    const conf = el(`<div class="modal hidden" id="popup-confirm"><div class="panel small pop">
      <div class="panel-head red">${icon('skull')}<h2>RESET?</h2></div>
      <div class="panel-body center"><p class="conf-txt">This deletes ALL progress: coins, guns, upgrades and waves. Are you sure?</p>
      <div class="off-btns"><button class="btn gloss" id="confNo">CANCEL</button><button class="btn red gloss" id="confYes">DELETE</button></div></div></div></div>`);
    this.root.appendChild(conf);
    this.panels.confirm = { el: conf, body: $('.panel-body', conf) };
    $('#confNo', conf).addEventListener('click', () => this.closeTop());
    $('#confYes', conf).addEventListener('click', () => g.hardReset());
  }

  togglePanel(id) {
    if (this.open === id) this.closeTop();
    else this.openPanel(id);
  }

  openPanel(id) {
    if (this.open === 'offline') return;
    if (this.open) this.panels[this.open].el.classList.add('hidden');
    this.open = id;
    const p = this.panels[id];
    p.el.classList.remove('hidden');
    p.el.classList.remove('anim');
    void p.el.offsetWidth;
    p.el.classList.add('anim');
    if (id === 'upgrades') {
      this.renderUpgrades();
      if (this.game.state.tut === 2) {
        this.game.state.tut = 3;
        this.hideHint();
      }
    }
    if (id === 'arsenal') this.renderArsenal();
    if (id === 'settings') {
      this.renderSettings();
      Platform.gameplayStop();
    }
  }

  closeTop() {
    if (!this.open) return false;
    const id = this.open;
    if (id === 'offline') {
      this.collectOfflineNow();
      return true;
    }
    this.panels[id].el.classList.add('hidden');
    this.open = null;
    if (id === 'settings') Platform.gameplayStart();
    if (id === 'arsenal') {
      for (const w of WEAPONS) if (this.game.state.seen[w.id]) this.game.state.viewed[w.id] = 1;
      this.refreshAll();
    }
    if (id === 'confirm') this.openPanel('settings');
    return true;
  }

  confirmReset() {
    this.openPanel('confirm');
  }

  showOffline(r, seconds) {
    const g = this.game;
    const p = this.panels.offline;
    $('#offAmt', p.el).textContent = fmt(r.amount);
    $('#offTime', p.el).innerHTML = `${icon('clock')} Away ${fmtTime(seconds)}${r.capped ? ` (vault max ${E.vaultHours(g.state)}h)` : ''} · ${Math.round(E.vaultRate(g.state) * 100)}% rate`;
    const done = (dbl) => {
      if (this.offlineDone !== done) return;
      this.offlineDone = null;
      p.el.classList.add('hidden');
      if (this.open === 'offline') this.open = null;
      g.collectOffline(r.amount, dbl);
    };
    this.offlineDone = done;
    $('#offCollect', p.el).onclick = () => {
      g.onUserGesture();
      done(false);
    };
    $('#offDouble', p.el).onclick = () => {
      g.onUserGesture();
      done(true);
    };
    if (this.open) this.panels[this.open].el.classList.add('hidden');
    this.open = 'offline';
    p.el.classList.remove('hidden');
  }

  collectOfflineNow() {
    if (this.offlineDone) this.offlineDone(false);
  }

  gunPadDenied(i) {
    const lb = this.labels.gunLabels.find((l) => l.slot === i);
    if (lb) {
      lb.el.classList.remove('shake');
      void lb.el.offsetWidth;
      lb.el.classList.add('shake');
    }
    this.game.audio.play('deny');
  }

  renderUpgrades() {
    const s = this.game.state;
    const body = this.panels.upgrades.body;
    for (const u of UPGRADES) {
      const row = $(`.up-row[data-id="${u.id}"]`, body);
      const lvl = E.upgradeLevel(s, u.id);
      const maxed = lvl >= u.max;
      const eff = E.upgradeEffect(u.id, lvl);
      $('.lvl', row).textContent = u.id === 'slots' ? `${E.slotCount(s)}/${E.MAX_SLOTS}` : `Lv ${u.id === 'crate' ? lvl + 1 : lvl}`;
      $('.up-eff', row).innerHTML = maxed ? `<b>${eff.now}</b> · MAX` : `${eff.now} → <b>${eff.next}</b>`;
      const btn = $('.buy-btn', row);
      if (maxed) {
        btn.classList.add('maxed');
        btn.disabled = true;
        $('.cost', row).textContent = 'MAX';
        $('.cnt', row).textContent = '';
        continue;
      }
      btn.classList.remove('maxed');
      btn.disabled = false;
      const want = this.buyN;
      const aff = E.affordableLevels(u.id, lvl, s.coins, want);
      let n = aff.n;
      let cost = aff.cost;
      if (n === 0) {
        n = want >= 9999 ? 1 : Math.min(want, u.max - lvl);
        cost = E.upgradeCostN(u.id, lvl, n);
      }
      $('.cost', row).textContent = fmt(cost);
      $('.cnt', row).textContent = n > 1 ? `x${n}` : '';
      btn.classList.toggle('poor', aff.n === 0);
    }
  }

  renderArsenal() {
    const s = this.game.state;
    const found = WEAPONS.filter((w) => s.seen[w.id]).length;
    $('#arsCount').textContent = `${found}/${WEAPONS.length}`;
    // odds
    const lvl = E.crateLevel(s);
    const luck = this.game.luckMult();
    const odds = E.rarityOdds(lvl, luck);
    const tier = CRATE_TIERS[crateTierForLevel(lvl)];
    $('#odds').innerHTML = `<div class="odds-title">${icon('crate')} ${tier.name.toUpperCase()} · LUCK LV ${lvl}${luck > 1 ? ' <span class="luckon">LUCK x3!</span>' : ''}</div>
      <div class="odds-bar">${odds.map((o, i) => `<i class="r-${RARITIES[i].id}" style="flex-grow:${Math.max(o * 100, 0.6)}"></i>`).join('')}</div>
      <div class="odds-list">${odds.map((o, i) => `<span class="r-${RARITIES[i].id}"><b>${RARITIES[i].name}</b> ${pct(o)}</span>`).join('')}</div>
      <div class="odds-pity">Guaranteed <b class="r-epic">EPIC+</b> within ${E.PITY_EVERY - s.pity} crates</div>`;
    // grid
    const grid = $('#arsGrid');
    if (!grid.classList.contains('hidden')) {
      const owned = {};
      for (let i = 0; i < E.slotCount(s); i++) if (s.guns[i]) owned[s.guns[i].t] = (owned[s.guns[i].t] || 0) + 1;
      grid.innerHTML = '';
      let lastR = -1;
      for (const w of WEAPONS) {
        const r = RARITIES[w.rarity];
        if (w.rarity !== lastR) {
          lastR = w.rarity;
          grid.appendChild(el(`<div class="grid-head r-${r.id}">${r.name.toUpperCase()}</div>`));
        }
        const seen = !!s.seen[w.id];
        const isNew = seen && !s.viewed[w.id];
        const card = el(`<div class="card r-${r.id}${seen ? '' : ' locked'}">
          <div class="thumb"><img alt="" draggable="false"></div>
          <div class="card-name">${seen ? w.name : '???'}</div>
          <div class="card-dps">${seen ? `${icon('bolt')}${fmt(baseDps(w))}` : r.name}</div>
          ${owned[w.id] ? `<i class="own">x${owned[w.id]}</i>` : ''}${isNew ? '<i class="new">NEW</i>' : ''}
        </div>`);
        $('img', card).src = this.thumbs.get(w.id);
        if (seen) card.addEventListener('click', () => this.showWeapon(w));
        grid.appendChild(card);
      }
    }
    // army list
    const army = $('#armyList');
    if (!army.classList.contains('hidden')) {
      const rows = [];
      let total = 0;
      for (let i = 0; i < E.slotCount(s); i++) {
        const g = s.guns[i];
        if (!g) {
          rows.push(`<div class="army-row empty"><span class="slotn">#${i + 1}</span><span>Empty slot - open crates!</span></div>`);
          continue;
        }
        const w = WEAPON_BY_ID[g.t];
        const r = RARITIES[w.rarity];
        const d = E.gunDps(g, s);
        total += d;
        rows.push(`<div class="army-row r-${r.id}"><span class="slotn">#${i + 1}</span><img src="${this.thumbs.get(g.t, !!g.g)}" alt=""><span class="an">${g.g ? '★ ' : ''}${w.name}</span><span class="rtag r-${r.id}">${r.name}</span><span class="lv">Lv ${g.l}</span><span class="ad">${icon('bolt')}${fmt(d)}</span></div>`);
      }
      army.innerHTML = `<div class="army-total">${icon('bolt')} TOTAL <b>${fmt(total)}</b> DPS · ${E.slotCount(s)}/${E.MAX_SLOTS} slots</div>` + rows.join('');
    }
  }

  showWeapon(w) {
    const s = this.game.state;
    const r = RARITIES[w.rarity];
    const specials = [];
    if (w.pellets) specials.push(`${w.pellets} pellets`);
    if (w.pierce) specials.push(w.pierce > 50 ? 'Pierces everything' : `Pierces ${w.pierce}`);
    if (w.aoe) specials.push(`Blast radius ${w.aoe}m`);
    if (w.chain) specials.push(`Chains to ${w.chain} zombies`);
    if (w.fire === 'flame') specials.push('Burns a whole cone');
    if (w.fire === 'vortex') specials.push('Pulls zombies in');
    if (w.target === 'strong') specials.push('Targets the biggest zombie');
    const pop = el(`<div class="modal detail"><div class="panel small pop r-${r.id}">
      <div class="panel-head ${'rh-' + r.id}"><h2>${w.name}</h2><button class="x gloss">${icon('close')}</button></div>
      <div class="panel-body center">
        <div class="detail-img"><img src="${this.thumbs.get(w.id)}" alt=""></div>
        <div class="rtag big r-${r.id}">${r.name}</div>
        <p class="detail-desc">${w.desc}</p>
        <div class="detail-stats">
          <div><small>DAMAGE</small><b>${fmt(w.dmg * (w.pellets || 1))}</b></div>
          <div><small>FIRE RATE</small><b>${w.rate}/s</b></div>
          <div><small>DPS (Lv1)</small><b>${fmt(baseDps(w))}</b></div>
          <div><small>RANGE</small><b>${w.range}m</b></div>
        </div>
        ${specials.length ? `<div class="detail-special">${specials.join(' · ')}</div>` : ''}
        <div class="detail-owned">Unboxed ${s.seen[w.id] || 0}x</div>
      </div></div></div>`);
    const close = () => pop.remove();
    pop.addEventListener('pointerdown', (e) => {
      if (e.target === pop) close();
    });
    $('.x', pop).addEventListener('click', close);
    this.root.appendChild(pop);
  }

  renderSettings() {
    const g = this.game;
    const sb = this.panels.settings.body;
    $('#setMusic', sb).value = g.settings.music;
    $('#setSfx', sb).value = g.settings.sfx;
    sb.querySelectorAll('#setQuality button').forEach((b) => b.classList.toggle('on', b.dataset.q === (g.settings.quality || 'auto')));
    $('#setDmg', sb).classList.toggle('on', !!g.settings.dmgNumbers);
    $('#setShake', sb).classList.toggle('on', !!g.settings.shake);
    $('#setAuto', sb).classList.toggle('on', g.settings.autoContinue !== false);
    $('#setFlash', sb).classList.toggle('on', g.settings.flashes !== false);
    const st = g.state.stats;
    $('#statsGrid', sb).innerHTML = [
      ['Zombies killed', fmtInt(st.kills)],
      ['Bosses defeated', fmtInt(st.bosses)],
      ['Crates opened', fmtInt(st.crates)],
      ['Best wave', fmtInt(g.state.bestWave)],
      ['Coins earned', fmt(st.earned)],
      ['Time played', fmtTime(st.time)],
    ].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('');
  }

  // ---------------------------------------------------------------- refresh
  refreshAll() {
    this.refreshT = 0;
    this._refresh();
  }

  _refresh() {
    const g = this.game;
    const s = g.state;
    // upgrade badge = number of affordable upgrades
    let affordable = 0;
    let cheapest = Infinity;
    for (const u of UPGRADES) {
      const lvl = E.upgradeLevel(s, u.id);
      if (lvl >= u.max) continue;
      const c = E.upgradeCost(u.id, lvl);
      cheapest = Math.min(cheapest, c);
      if (s.coins >= c) affordable++;
    }
    const ub = this.els.upBadge;
    ub.textContent = affordable;
    ub.classList.toggle('hidden', affordable === 0);
    this.els.btnUp.classList.toggle('pulse', affordable > 0 && s.tut === 2);
    if (s.tut === 2 && affordable > 0 && !this.hintKey && !this.open) this.hint('tut2');
    const newGuns = WEAPONS.some((w) => s.seen[w.id] && !s.viewed[w.id]);
    this.els.arsBadge.classList.toggle('hidden', !newGuns);

    // world labels
    const lb = this.labels.items;
    const free = s.bossCrates > 0 || s.freeCrates > 0;
    const cost = E.crateCost(s);
    lb.crate.refs.title.textContent = s.bossCrates > 0 ? 'BOSS CRATE!' : 'OPEN CRATE';
    const pc = lb.crate.refs.price;
    pc.querySelector('.v').textContent = free ? 'FREE' : fmt(cost);
    pc.classList.toggle('ok', free || s.coins >= cost);
    pc.classList.toggle('no', !(free || s.coins >= cost));
    pc.classList.toggle('free', free);
    lb.crate.refs.pity.style.width = `${(s.pity / E.PITY_EVERY) * 100}%`;
    lb.crate.refs.pityTxt.textContent = `EPIC+ IN ${E.PITY_EVERY - s.pity}`;

    const luckL = E.upgradeLevel(s, 'crate');
    lb.luck.refs.sub.textContent = `Lv ${luckL + 1}`;
    this._chip(lb.luck.refs.price, E.isMaxed(s, 'crate') ? null : E.upgradeCost('crate', luckL), s.coins);
    const vL = E.upgradeLevel(s, 'vault');
    lb.vault.refs.sub.textContent = `Lv ${vL} · ${Math.round(E.vaultRate(s) * 100)}% · ${E.vaultHours(s)}h`;
    this._chip(lb.vault.refs.price, E.isMaxed(s, 'vault') ? null : E.upgradeCost('vault', vL), s.coins);

    const n = E.slotCount(s);
    if (n < E.MAX_SLOTS) {
      const slot = L.SLOTS[n];
      lb.slot.pos.set(slot.x, 2.2, slot.z);
      const sc = E.upgradeCost('slots', E.upgradeLevel(s, 'slots'));
      this._chip(lb.slot.refs.price, sc, s.coins);
      this.labels.set('slot', !g.reveal.active);
      if (s.coins >= sc) this.hintOnce('slot');
    } else this.labels.set('slot', false);
    this.labels.set('arrow', s.tut === 0);

    // labels for the gun pads closest to the player
    const px = g.player.x;
    const pz = g.player.z;
    const near = [];
    for (let i = 0; i < n; i++) {
      const gun = s.guns[i];
      if (!gun) continue;
      const sl = L.SLOTS[i];
      const d = Math.hypot(sl.padX - px, sl.padZ - pz);
      if (d < 4.5) near.push([d, i]);
    }
    near.sort((a, b) => a[0] - b[0]);
    this.labels.gunLabels.forEach((lab, j) => {
      const e = j === 0 ? near[0] : null;
      const show = !!e && !g.reveal.active;
      this.labels.set('gun' + j, show);
      if (!show) {
        lab.slot = -1;
        return;
      }
      const i = e[1];
      const gun = s.guns[i];
      const w = WEAPON_BY_ID[gun.t];
      const sl = L.SLOTS[i];
      lab.slot = i;
      lab.pos.set(sl.padX, 1.35, sl.padZ);
      lab.refs.name.textContent = (gun.g ? '★ ' : '') + w.name;
      lab.refs.name.style.color = gun.g ? '#ffd23f' : RARITIES[w.rarity].color;
      const maxed = gun.l >= E.MAX_GUN_LEVEL;
      lab.refs.lv.textContent = maxed ? `Lv ${gun.l} MAX` : `Lv ${gun.l} → ${gun.l + 1}`;
      lab.refs.dps.textContent = `${fmt(E.gunDps(gun, s))} DPS`;
      this._chip(lab.refs.price, maxed ? null : E.gunUpgradeCost(gun), s.coins);
    });
    if (s.tut >= 1 && n >= 4 && s.guns.filter(Boolean).length >= Math.min(4, n)) this.hintOnce('gunpad');

    // boosts
    this.els.boosts.forEach((b) => {
      const k = b.dataset.boost;
      const left = s.boosts[k];
      const cd = s.boostCd[k];
      const t = $('.bt', b);
      b.classList.toggle('active', left > 0);
      b.classList.toggle('cool', left <= 0 && cd > 0);
      if (left > 0) t.textContent = fmtClock(left);
      else if (cd > 0) t.textContent = `ready in ${fmtClock(cd)}`;
      else t.innerHTML = Platform.hasAds ? `${'&#9654;'} WATCH AD` : 'FREE!';
    });

    if (this.open === 'upgrades') this.renderUpgrades();
  }

  _chip(chip, cost, coins) {
    const span = chip.querySelector('.v');
    if (cost === null) {
      span.textContent = 'MAX';
      chip.classList.remove('ok', 'no');
      return;
    }
    span.textContent = fmt(cost);
    chip.classList.toggle('ok', coins >= cost);
    chip.classList.toggle('no', coins < cost);
  }

  update(dt) {
    const g = this.game;
    const s = g.state;
    if (this.flashA > 0 || this.flashShown) {
      this.flashA = Math.max(0, this.flashA - dt * 1.4);
      this.els.flash.style.opacity = this.flashA.toFixed(3);
      this.flashShown = this.flashA > 0;
    }
    // reveal: hide world labels, dim the HUD
    const rv = g.reveal.active;
    if (rv !== this.revealShown) {
      this.revealShown = rv;
      document.getElementById('labels').classList.toggle('dimmed', rv);
      this.hud.classList.toggle('revealing', rv);
    }
    // rolling coin counter
    const diff = s.coins - this.coinShown;
    if (Math.abs(diff) < 0.5) this.coinShown = s.coins;
    else this.coinShown += diff * Math.min(1, dt * 8);
    this.els.coinVal.textContent = fmt(Math.floor(this.coinShown));
    const dps = E.totalDps(s);
    this.dpsShown += (dps - this.dpsShown) * Math.min(1, dt * 5);
    this.els.dpsVal.textContent = fmt(this.dpsShown);

    // wave
    const w = s.wave;
    this.els.waveNum.textContent = `WAVE ${w}`;
    this.els.zoneName.textContent = zoneName(w);
    const boss = g.zombies.boss;
    if (E.isBossWave(w)) {
      this.els.waveFill.style.width = boss ? `${(1 - boss.hp / boss.maxHp) * 100}%` : '0%';
      this.els.waveTxt.textContent = 'DEFEAT THE BOSS';
      this.els.waveFill.parentElement.classList.add('boss');
    } else {
      const need = E.killsNeeded(w);
      this.els.waveFill.style.width = `${Math.min(100, (s.waveKills / need) * 100)}%`;
      this.els.waveTxt.textContent = `${s.waveKills}/${need}`;
      this.els.waveFill.parentElement.classList.remove('boss');
    }
    if (boss) {
      this.els.bossBar.classList.remove('hidden');
      this.els.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
      this.els.bossName.textContent = `${boss.name.toUpperCase()} · ${fmt(Math.max(0, boss.hp))}`;
    } else this.els.bossBar.classList.add('hidden');

    // barricade bar
    const bf = g.barricadeHp / g.barricadeMax;
    const lb = this.labels.items.barricade;
    lb.refs.fill.style.width = `${Math.max(0, bf * 100)}%`;
    lb.refs.txt.textContent = fmt(Math.max(0, g.barricadeHp));
    lb.el.classList.toggle('danger', bf < 0.35);
    this.labels.set('barricade', bf < 0.999 || g.zombies.list.some((z) => z.state === 'attack'));

    // tooltip on hover
    if (this.tipT > 0) this.tipT -= dt;
    const inp = g.input;
    if (inp && inp.hoverX >= 0 && !inp.joy && !this.open) {
      const slot = g.guns.pickAt(inp.hoverX, inp.hoverY, g.camera, g.width, g.height, 40);
      if (slot) {
        if (slot !== this.tipSlot || this.tipT <= 0) this.showGunTip(slot);
        this.tipT = Math.max(this.tipT, 0.15);
      }
    }
    if (this.tipT <= 0) this.els.tip.classList.add('hidden');
    else if (this.tipSlot) {
      _v.set(this.tipSlot.x, this.tipSlot.y + 2.4, this.tipSlot.z).project(g.camera);
      const x = (_v.x * 0.5 + 0.5) * g.width;
      const y = (-_v.y * 0.5 + 0.5) * g.height;
      this.els.tip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }

    this.refreshT -= dt;
    if (this.refreshT <= 0) {
      this.refreshT = 0.25;
      this._refresh();
      if (g.debug && g.fps) this.els.fps.textContent = `${g.fps.toFixed(0)} fps · pr ${g.pr.toFixed(2)} · ${g.quality} · z ${g.zombies.list.length}`;
    }
    this.labels.update();
    this.overlay.update(dt);
  }
}

export { zoneIndexForWave };
