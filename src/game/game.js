// The game: renderer, main loop, follow camera, economy actions and glue
// between systems.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { kitMaterials } from '../gfx/kit.js';
import { createGunModel, gunTemplate } from '../gfx/gunModels.js';
import { World } from './world.js';
import { Zombies } from './zombies.js';
import { Guns } from './guns.js';
import { Projectiles } from './projectiles.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { CrateSystem } from './crate.js';
import { Reveal } from './reveal.js';
import { Waves } from './waves.js';
import { UI } from '../ui/ui.js';
import { Input } from '../core/input.js';
import { AudioSys } from '../core/audio.js';
import { Platform } from '../core/platform.js';
import { loadState, saveState, wipeSave, defaultState } from '../core/save.js';
import * as E from '../core/economy.js';
import { WEAPON_BY_ID, WEAPONS } from '../data/weapons.js';
import { RARITIES, EPIC } from '../data/rarities.js';
import { zoneIndexForWave } from '../data/zones.js';
import { fmt } from '../util/format.js';
import { clamp, rand, easeInOutCubic, damp } from '../util/math.js';
import * as L from './layout.js';

const QUALITY = {
  low: { pr: 0.8, shadows: 'low', fx: 0.5, maxZ: 70 },
  medium: { pr: 1.25, shadows: 'medium', fx: 0.8, maxZ: 110 },
  high: { pr: 2, shadows: 'high', fx: 1, maxZ: 140 },
};

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const isLocalHost = () => /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);

export class Game {
  constructor(root) {
    this.root = root;
    this.canvas = document.getElementById('game');
    this.time = 0;
    this.realTime = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.shakeAmt = 0;
    this.fmt = fmt;
    this.lastT = performance.now();
    this.saveT = 0;
    this.incomeAcc = 0;
    this.incomeT = 0;
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.fpsLow = 0;
    this.fpsHigh = 0;
    this.fpsBad = 0;
    this.pendingFly = null;
    this.pendingBreach = false;
    this.lastMidgame = performance.now();
    this.hiddenAt = 0;
    this.adPause = false;
    this.rewardPending = false;
    this.resetting = false;
    this.zoom = 1;
    this.frame = this.frame.bind(this);
  }

  /** The simulation is frozen while a blocking menu / ad is up. */
  get frozen() {
    const open = this.ui && this.ui.open;
    return this.adPause || this.rewardPending || open === 'settings' || open === 'confirm' || open === 'offline';
  }

  async init(progress = () => {}) {
    const loaded = loadState();
    this.state = loaded.state;
    this.fresh = loaded.fresh;
    this.settings = this.state.settings;
    this.applyDebugParams();
    const state = this.state;
    const fresh = this.fresh;

    // ---------------- renderer
    const q = this.resolveQuality();
    this.quality = q;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q !== 'low', powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1000);
    this.camFocus = new THREE.Vector3(L.PLAYER_START.x, 0, L.PLAYER_START.z - 4);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = clamp(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.75, 1.9);
    }, { passive: false });

    // image based lighting for the toy-plastic look
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const M = kitMaterials();
    for (const k of ['solid', 'metal']) {
      M[k].envMap = env;
      M[k].envMapIntensity = k === 'metal' ? 0.9 : 0.5;
      M[k].needsUpdate = true;
    }
    this.envMap = env;
    progress(0.15);
    await nextFrame();

    // ---------------- systems
    this.audio = new AudioSys();
    this.audio.setVolumes(this.settings.sfx, this.settings.music);
    this.audio.setMuted(Platform.muted);
    this.fx = new Effects(this);
    this.world = new World(this);
    progress(0.35);
    await nextFrame();
    this.zombies = new Zombies(this);
    this.zombies.setEnvMap(env);
    this.projectiles = new Projectiles(this);
    this.guns = new Guns(this);
    this.player = new Player(this);
    this.reveal = new Reveal(this);
    progress(0.5);
    await nextFrame();
    for (let i = 0; i < WEAPONS.length; i++) {
      gunTemplate(WEAPONS[i].id);
      if (i % 6 === 5) {
        progress(0.5 + (i / WEAPONS.length) * 0.3);
        await nextFrame();
      }
    }
    this.ui = new UI(this);
    this.crate = new CrateSystem(this);
    this.waves = new Waves(this);
    this.input = new Input(this, this.canvas);

    this.applyQuality(q);
    this.zoneShown = this.zoneIndex();
    this.world.applyZone(this.zoneShown);
    this.guns.sync();
    this.crate.refresh();
    this.barricadeMax = E.barricadeMaxHp(state);
    this.barricadeHp = this.barricadeMax;
    this.lastBarricadeHit = -10;
    progress(0.9);
    await nextFrame();

    this.updateCamera(1);
    this.renderer.compile(this.scene, this.camera);
    this.waves.reset();
    this.ui.refreshAll();

    Platform.on('adStart', () => {
      this.adPause = true;
      this.audio.suspend();
    });
    Platform.on('adEnd', () => {
      this.adPause = false;
      this.audio.resume();
    });
    Platform.on('mute', (m) => this.audio.setMuted(m));

    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => this.save());

    const away = (Date.now() - (state.last || Date.now())) / 1000;
    if (!fresh && away > 60) this.offerOffline(away);
    progress(1);
  }

  /** Zone follows the best wave reached (a breach never sends you back a zone). */
  zoneIndex() {
    return zoneIndexForWave(Math.max(this.state.wave, this.state.bestWave));
  }

  applyDebugParams() {
    // test hooks only work on a local dev server, never on portals
    if (!isLocalHost()) return;
    const q = new URLSearchParams(location.search);
    this.debug = q.has('debug');
    if (q.has('reset')) {
      wipeSave();
      this.state = loadState().state;
      this.fresh = true;
      this.settings = this.state.settings;
    }
    if (q.has('coins')) this.state.coins = Number(q.get('coins')) || 0;
    if (q.has('wave')) this.state.wave = this.state.bestWave = Math.max(1, Number(q.get('wave')) || 1);
    if (q.has('tut')) this.state.tut = Number(q.get('tut')) || 0;
    if (q.has('q')) this.settings.quality = q.get('q');
    if (q.has('army')) {
      const n = Number(q.get('army')) || 16;
      this.state.up.slots = Math.max(0, Math.min(28, n - 4));
      this.state.guns = [];
      for (let i = 0; i < n; i++) {
        const w = WEAPONS[(i * 7 + 3) % WEAPONS.length];
        this.state.guns.push({ t: w.id, l: 1 + (i % 4), g: i % 9 === 0 ? 1 : 0 });
        this.state.seen[w.id] = 1;
      }
      this.state.tut = 9;
      this.state.freeCrates = 0;
    }
  }

  resolveQuality() {
    const q = this.settings.quality;
    if (q && q !== 'auto' && QUALITY[q]) return q;
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
    const cores = navigator.hardwareConcurrency || 4;
    if (mobile || cores <= 4) return 'medium';
    // weak integrated GPUs start on medium, auto-resolution promotes/demotes later
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/Intel|UHD|HD Graphics|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(name)) return 'medium';
    } catch {
      /* ignore */
    }
    return 'high';
  }

  applyQuality(q) {
    this.quality = q;
    const p = QUALITY[q];
    this.targetPr = Math.min(window.devicePixelRatio || 1, p.pr);
    this.pr = this.targetPr;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(this.width, this.height, false);
    this.world.setShadowQuality(p.shadows);
    this.zombies.setShadows(p.shadows !== 'low');
    this.fx.setDensity(p.fx);
    this.maxZombies = p.maxZ;
  }

  setQualitySetting(q) {
    this.settings.quality = q;
    this.applyQuality(q === 'auto' ? this.resolveQuality() : q);
    this.save();
  }

  resize() {
    const w = this.root.clientWidth || window.innerWidth;
    const h = this.root.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    if (this.renderer) this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.portrait = w / h < 1;
    this.camera.fov = this.portrait ? 58 : 46;
    this.camera.updateProjectionMatrix();
    if (this.reveal) this.reveal.resize(w, h);
    if (this.ui) this.ui.onResize();
  }

  start() {
    this.lastT = performance.now();
    requestAnimationFrame(this.frame);
    Platform.gameplayStart();
    if (this.state.tut === 0) this.ui.hint('tut0');
  }

  // ---------------------------------------------------------------- loop
  frame(now) {
    requestAnimationFrame(this.frame);
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.25) dt = 0.016;
    dt = Math.min(dt, 0.05);
    this.update(dt);
    this.render(dt);
    this.autoResolution(dt);
  }

  update(dt) {
    this.realTime += dt;
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.timeScale = this.slowT > 0 ? 0.3 : 1;
    }
    const frozen = this.frozen;
    const gdt = frozen ? 0 : dt * this.timeScale;
    this.time += gdt;
    this.input.update();
    if (!frozen) {
      this.player.update(gdt);
      this.crate.update(gdt);
      this.guns.updatePads(gdt);
      this.waves.update(gdt);
      this.zombies.update(gdt);
      if (this.pendingBreach) {
        this.pendingBreach = false;
        this.waves.breach();
      }
      this.guns.update(gdt);
      this.projectiles.update(gdt);
      this.tickEconomy(gdt, dt);
    }
    this.fx.update(gdt);
    this.world.update(gdt);
    this.reveal.update(frozen ? 0 : dt);
    this.updateFly(gdt);
  }

  render(dt) {
    this.zombies.render();
    this.updateCamera(dt);
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    if (this.reveal.active) {
      this.renderer.autoClear = false;
      this.reveal.render(this.renderer);
      this.renderer.autoClear = true;
    }
    this.ui.update(dt);
  }

  /** Debug/testing: advance the simulation without rendering. */
  debugStep(seconds, dt = 1 / 30) {
    for (let t = 0; t < seconds; t += dt) {
      this.update(dt);
      this.updateCamera(dt);
      this.fx.streaks.flush(0);
    }
  }

  tickEconomy(gdt, dt) {
    const s = this.state;
    s.stats.time += dt;
    this.barricadeMax = E.barricadeMaxHp(s);
    if (this.time - this.lastBarricadeHit > 2 && this.barricadeHp < this.barricadeMax) {
      this.barricadeHp = Math.min(this.barricadeMax, this.barricadeHp + this.barricadeMax * E.barricadeRegen(s) * gdt);
    }
    for (const k of ['luck', 'coins']) {
      if (s.boosts[k] > 0) s.boosts[k] = Math.max(0, s.boosts[k] - dt);
      if (s.boostCd[k] > 0) s.boostCd[k] = Math.max(0, s.boostCd[k] - dt);
    }
    // income estimate for offline earnings (EMA, ~40s window, boosts excluded)
    this.incomeT += dt;
    if (this.incomeT >= 1) {
      const rate = this.incomeAcc / this.incomeT;
      s.income = s.income * 0.96 + rate * 0.04;
      this.incomeAcc = 0;
      this.incomeT = 0;
    }
    this.saveT += dt;
    if (this.saveT > 10) {
      this.saveT = 0;
      this.save();
    }
  }

  autoResolution(dt) {
    if (this.settings.quality !== 'auto') return;
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc < 2) return;
    const fps = this.fpsN / this.fpsAcc;
    this.fpsAcc = 0;
    this.fpsN = 0;
    this.fps = fps;
    if (document.hidden) return;
    if (fps < 42) {
      this.fpsLow++;
      this.fpsHigh = 0;
      if (fps < 28) this.fpsBad++;
      if (this.fpsBad >= 3 && this.quality !== 'low') {
        this.applyQualityKeepPr('low');
        this.fpsBad = 0;
      }
      if (this.fpsLow >= 2 && this.pr > 0.6) {
        this.pr = Math.max(0.6, this.pr * 0.85);
        this.renderer.setPixelRatio(this.pr);
        this.renderer.setSize(this.width, this.height, false);
        this.fpsLow = 0;
        if (this.pr < 1 && this.quality === 'high') this.applyQualityKeepPr('medium');
      }
    } else if (fps > 57) {
      this.fpsHigh++;
      this.fpsLow = 0;
      this.fpsBad = 0;
      if (this.fpsHigh >= 4 && this.pr < this.targetPr) {
        this.pr = Math.min(this.targetPr, this.pr * 1.1);
        this.renderer.setPixelRatio(this.pr);
        this.renderer.setSize(this.width, this.height, false);
        this.fpsHigh = 0;
      }
    }
  }

  applyQualityKeepPr(q) {
    const p = QUALITY[q];
    this.quality = q;
    this.world.setShadowQuality(p.shadows);
    this.zombies.setShadows(p.shadows !== 'low');
    this.fx.setDensity(p.fx);
    this.maxZombies = p.maxZ;
  }

  /** Third person follow camera (idle-game angle), mouse wheel zooms. */
  updateCamera(dt) {
    const c = this.camera;
    const p = this.player.obj.position;
    const fx = clamp(p.x * 0.75, -8, 8);
    const fz = clamp(p.z, -27, 15);
    const k = 1 - Math.exp(-6 * Math.min(dt, 0.1));
    this.camFocus.x += (fx - this.camFocus.x) * k;
    this.camFocus.z += (fz - this.camFocus.z) * k;
    const z = this.zoom;
    const f = this.camFocus;
    if (this.portrait) {
      c.position.set(f.x * 0.6, 26 * z, f.z + 17 * z);
      this._look = [f.x * 0.6, 0, f.z - 7 * z];
    } else {
      c.position.set(f.x, 15.5 * z, f.z + 13.5 * z);
      this._look = [f.x, 0.5, f.z - 6.5 * z];
    }
    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * (this.settings.shake ? 1 : 0.15);
      c.position.x += (Math.random() - 0.5) * s;
      c.position.y += (Math.random() - 0.5) * s;
      c.position.z += (Math.random() - 0.5) * s * 0.5;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.2);
    }
    c.lookAt(this._look[0], this._look[1], this._look[2]);
    this.world.followShadow(f.x, f.z - 7);
  }

  shake(a) {
    this.shakeAmt = Math.min(1.4, Math.max(this.shakeAmt, a));
  }

  flash(a = 0.4, color = '#ffffff', fromWeapon = false) {
    this.ui.flash(a, color, fromWeapon);
  }

  // ---------------------------------------------------------------- economy
  canAfford(c) {
    return this.state.coins >= c;
  }

  addCoins(v, src = 'kill') {
    const s = this.state;
    s.coins += v;
    s.stats.earned += v;
    if (src === 'kill' || src === 'wave') this.incomeAcc += v / this.coinBoost();
  }

  spend(c) {
    this.state.coins = Math.max(0, this.state.coins - c);
  }

  coinBoost() {
    return this.state.boosts.coins > 0 ? 2 : 1;
  }

  luckMult() {
    return this.state.boosts.luck > 0 ? 3 : 1;
  }

  crateFree() {
    return this.state.bossCrates > 0 || this.state.freeCrates > 0;
  }

  canOpenCrate() {
    return this.crateFree() || this.state.coins >= E.crateCost(this.state);
  }

  crateBusy() {
    return this.crate.busy || this.reveal.active || !!this.pendingFly;
  }

  openCrate() {
    const s = this.state;
    if (this.crateBusy()) return false;
    let minRarity = 0;
    let kind = 'coins';
    if (s.bossCrates > 0) {
      s.bossCrates--;
      const n = s.stats.bossOpened || 0;
      // scripted highlights: 1st boss crate = Epic+, 2nd = Legendary+, then Rare+
      minRarity = n === 0 ? EPIC : n === 1 ? EPIC + 1 : 2;
      s.stats.bossOpened = n + 1;
      kind = 'boss';
    } else if (s.freeCrates > 0) {
      s.freeCrates--;
      kind = 'free';
    } else {
      const cost = E.crateCost(s);
      if (s.coins < cost) return false;
      this.spend(cost);
      this.ui.floatCost(cost);
    }
    const res = E.rollCrate(s, { luck: this.luckMult(), minRarity });
    s.pity = res.rarity >= EPIC ? 0 : s.pity + 1;
    s.pityL = res.rarity >= EPIC + 1 ? 0 : (s.pityL || 0) + 1;
    s.opens++;
    s.stats.crates++;
    res.isNew = !s.seen[res.t];
    s.seen[res.t] = (s.seen[res.t] || 0) + 1;
    res.kind = kind;

    const d = E.decidePlacement(s, res);
    res.place = d;
    if (d.kind === 'place') {
      s.guns[d.slot] = { t: res.t, l: 1, g: res.g };
    } else if (d.kind === 'replace') {
      const old = s.guns[d.slot];
      res.old = old;
      res.scrap = E.scrapValue(s, WEAPON_BY_ID[old.t].rarity);
      s.guns[d.slot] = { t: res.t, l: 1, g: res.g };
      this.addCoins(res.scrap, 'scrap');
    } else if (d.kind === 'levelup') {
      const g = s.guns[d.slot];
      res.old = { ...g };
      g.l++;
      if (res.g) g.g = 1;
      res.newLevel = g.l;
    } else {
      // duplicate the army doesn't need: weapon mastery (+ a few coins)
      s.mastery = s.mastery || {};
      const before = E.masteryLevel(s.mastery[res.t] || 0);
      s.mastery[res.t] = (s.mastery[res.t] || 0) + 1;
      res.mastery = { copies: s.mastery[res.t], level: E.masteryLevel(s.mastery[res.t]), up: E.masteryLevel(s.mastery[res.t]) > before };
      res.scrap = Math.ceil(E.scrapValue(s, res.rarity) * 0.5);
      this.addCoins(res.scrap, 'scrap');
      this.guns.refreshStats();
    }
    // quick reveal for routine results, the full show for anything exciting
    res.quick = !res.isNew && res.rarity < EPIC && !res.g && d.kind !== 'replace';
    if (d.slot !== undefined) this.guns.hold = d.slot;
    this.crate.open(res);
    if (s.tut === 0) s.tut = 1;
    if (res.rarity >= 4) Platform.happytime();
    this.save();
    return true;
  }

  /** Reveal dismissed: fly the gun from the crate to its spot on the wall. */
  onRevealClosed(res) {
    const d = res.place;
    const from = new THREE.Vector3(L.CRATE_POS.x, 2.4, L.CRATE_POS.z);
    const m = createGunModel(res.t, !!res.g);
    const holder = new THREE.Group();
    m.obj.scale.setScalar(WEAPON_BY_ID[res.t].scale * 1.6);
    holder.add(m.obj);
    holder.position.copy(from);
    this.scene.add(holder);
    let to;
    if (d.kind === 'mastery') to = new THREE.Vector3(L.CRATE_POS.x, 7, L.CRATE_POS.z - 1);
    else {
      const slot = L.SLOTS[d.slot];
      to = new THREE.Vector3(slot.x, slot.mountH + 0.4, slot.z);
    }
    this.pendingFly = { res, holder, from, to, t: 0, dur: d.kind === 'mastery' ? 0.45 : 0.8 };
    this.audio.play('pop');
    if (this.state.tut === 1) this.ui.hint('tut1');
  }

  updateFly(dt) {
    const f = this.pendingFly;
    if (!f) return;
    f.t += dt / f.dur;
    const k = Math.min(1, f.t);
    const e = easeInOutCubic(k);
    const p = f.holder.position;
    p.lerpVectors(f.from, f.to, e);
    p.y += Math.sin(k * Math.PI) * 5;
    f.holder.rotation.y += dt * 10;
    f.holder.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.4);
    this.fx.spark.spawn(p.x, p.y, p.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.4, 0.5, 0.05, RARITIES[f.res.rarity].hex, 1);
    if (k < 1) return;
    this.scene.remove(f.holder);
    this.pendingFly = null;
    const res = f.res;
    const d = res.place;
    this.guns.hold = -1;
    if (d.kind === 'mastery') {
      this.fx.sparkleBurst(p.x, p.y, p.z, RARITIES[res.rarity].hex, 26, 6);
      this.ui.overlay.coinFlyWorld(p.x, p.y, p.z, 5);
      this.ui.floatWorldText(p.x, p.y + 1, p.z, res.mastery.up ? `MASTERY ${res.mastery.level}!` : 'MASTERY +1', res.mastery.up ? '#ffd23f' : '#b9f0ff');
      this.audio.play(res.mastery.up ? 'levelup' : 'buy');
    } else {
      this.guns.sync();
      this.guns.celebrate(d.slot);
      this.audio.play(d.kind === 'levelup' ? 'levelup' : 'land');
      this.shake(0.15);
      if (d.kind === 'levelup') this.ui.floatWorldText(p.x, p.y + 1, p.z, `LEVEL ${res.newLevel}!`, '#ffd23f');
      if (d.kind === 'replace') this.ui.floatWorldText(p.x, p.y + 1, p.z, 'UPGRADE!', '#52e052');
      this.ui.bumpDps();
    }
    this.ui.refreshAll();
  }

  /** Walk up to a gun and pay to level it up. */
  upgradeGun(i) {
    const s = this.state;
    const g = s.guns[i];
    if (!g || g.l >= E.MAX_GUN_LEVEL) return false;
    const cost = E.gunUpgradeCost(g);
    if (s.coins < cost) return false;
    this.spend(cost);
    g.l++;
    this.guns.refreshStats();
    this.guns.celebrate(i, true);
    const sl = L.SLOTS[i];
    this.ui.floatWorldText(sl.x, sl.mountH + 2, sl.z, `LV ${g.l}!`, '#7fd8ff');
    this.ui.floatCost(cost);
    this.ui.bumpDps();
    this.audio.play('levelup');
    if (s.tut < 4 && s.tut >= 2) s.tut = Math.max(s.tut, 3);
    this.ui.refreshAll();
    this.save();
    return true;
  }

  buyUpgrade(id, n = 1) {
    const s = this.state;
    const lvl = E.upgradeLevel(s, id);
    const { n: count, cost } = E.affordableLevels(id, lvl, s.coins, n);
    if (count <= 0) {
      this.audio.play('deny');
      return false;
    }
    this.spend(cost);
    s.up[id] = lvl + count;
    this.audio.play('buy');
    this.ui.floatCost(cost);
    if (id === 'slots') {
      this.guns.sync();
      for (let i = 0; i < count; i++) {
        const idx = E.slotCount(s) - 1 - i;
        if (L.SLOTS[idx]) {
          this.fx.dust(L.SLOTS[idx].x, L.SLOTS[idx].z, 10, 0xe8d3a8);
          this.guns.celebrate(idx);
        }
      }
    }
    if (id === 'firepower' || id === 'firerate') {
      this.guns.refreshStats();
      this.ui.bumpDps();
    }
    if (id === 'barricade') {
      const oldMax = this.barricadeMax;
      this.barricadeMax = E.barricadeMaxHp(s);
      this.barricadeHp += this.barricadeMax - oldMax;
    }
    if (id === 'crate' || id === 'vault') {
      this.crate.refresh();
      const pos = id === 'crate' ? L.LUCK_POS : L.VAULT_POS;
      this.fx.sparkleBurst(pos.x, 2.4, pos.z, id === 'crate' ? 0x52e052 : 0xb45cff, 20, 5);
    }
    this.ui.refreshAll();
    this.save();
    return true;
  }

  async activateBoost(kind) {
    const s = this.state;
    if (s.boosts[kind] > 0 || s.boostCd[kind] > 0 || this.rewardPending) return;
    this.rewardPending = true;
    const ok = await Platform.rewarded();
    this.rewardPending = false;
    if (!ok) {
      this.ui.toast('No ad available', 'Try again later');
      return;
    }
    s.boosts[kind] = kind === 'luck' ? 180 : 240;
    s.boostCd[kind] = Platform.hasAds ? s.boosts[kind] : s.boosts[kind] + 300;
    this.audio.play('levelup');
    this.ui.toast(kind === 'luck' ? 'LUCK x3 ACTIVE!' : '2X COINS ACTIVE!', kind === 'luck' ? 'Rare guns are way more likely' : 'Every monster pays double');
    this.ui.refreshAll();
    this.save();
  }

  // ---------------------------------------------------------------- events
  onZombieKilled(z) {
    const s = this.state;
    const coins = Math.ceil(z.reward * E.coinMultOf(s) * this.coinBoost());
    this.addCoins(coins, 'kill');
    s.stats.kills++;
    const y = this.zombies.aimY(z);
    this.fx.goo(z.x, y, z.z, z.def.goo, z.isBoss ? 40 : 8, z.isBoss ? 12 : 5);
    this.fx.coinBurst(z.x, y, z.z, z.isBoss ? 8 : 2);
    this.ui.overlay.coinFlyWorld(z.x, y, z.z, z.isBoss ? 12 : 1);
    this.ui.overlay.floatText(z.x, y + 1.2 * z.scale, z.z, '+$' + fmt(coins), '#ffd23f', z.isBoss ? 1.8 : 0.9);
    this.audio.play('splat', { x: z.x });
    if (z.isBoss) this.onBossKilled(z);
    this.waves.onKill(z);
  }

  onBossKilled(z) {
    const s = this.state;
    s.stats.bosses++;
    s.bossCrates++;
    this.slowT = 0.9;
    this.shake(1);
    this.flash(0.3);
    this.fx.explosion(z.x, 1, z.z, 5, z.def.goo);
    this.fx.confetti(z.x, 4, z.z, 60);
    this.audio.play('bossDown');
    const n = s.stats.bossOpened || 0;
    this.ui.banner('BOSS DEFEATED!', n === 0 ? '+1 BOSS CRATE · guaranteed EPIC!' : n === 1 ? '+1 BOSS CRATE · guaranteed LEGENDARY!' : '+1 BOSS CRATE (Rare or better!)', 'good');
    Platform.happytime();
  }

  onBarricadeHit(dmg, z) {
    this.barricadeHp -= dmg;
    this.lastBarricadeHit = this.time;
    this.world.shakeBarricade(z.isBoss ? 0.4 : 0.1);
    this.fx.dust(z.x, L.BARRICADE_Z - 0.8, 3, 0xd9bd86);
    this.audio.play('thud');
    if (z.isBoss) this.shake(0.3);
    if (this.barricadeHp <= 0) this.pendingBreach = true;
  }

  /** Called when the wave changes; visuals only move forward. */
  checkZone(forward) {
    const zi = this.zoneIndex();
    if (zi === this.zoneShown) return;
    this.zoneShown = zi;
    this.ui.zoneTransition(() => this.world.applyZone(zi), zi);
    this.audio.play('zone');
    if (forward && performance.now() - this.lastMidgame > 180000) {
      this.lastMidgame = performance.now();
      setTimeout(() => Platform.midgame(), 1600);
    }
  }

  // ---------------------------------------------------------------- offline
  offerOffline(seconds) {
    const r = E.offlineEarnings(this.state, seconds);
    if (r.amount <= 0) return;
    this.ui.showOffline(r, seconds);
  }

  collectOffline(amount, double) {
    const give = (mult) => {
      this.addCoins(amount * mult, 'offline');
      this.ui.overlay.coinBurstScreen(24);
      this.audio.play('buy');
      this.ui.refreshAll();
      this.save();
    };
    if (!double) return give(1);
    this.rewardPending = true;
    Platform.rewarded().then((ok) => {
      this.rewardPending = false;
      give(ok ? 2 : 1);
    });
  }

  onVisibility() {
    if (document.hidden) {
      this.hiddenAt = Date.now();
      this.save();
      this.audio.suspend();
      Platform.gameplayStop();
    } else {
      this.audio.resume();
      if (!this.frozen) Platform.gameplayStart();
      const away = this.hiddenAt ? (Date.now() - this.hiddenAt) / 1000 : 0;
      this.hiddenAt = 0;
      this.lastT = performance.now();
      if (away > 60 && this.ui.open !== 'offline') this.offerOffline(away);
    }
  }

  // ---------------------------------------------------------------- input
  onUserGesture() {
    this.audio.unlock();
  }

  onKey(e) {
    this.onUserGesture();
    const ui = this.ui;
    if (ui.open === 'offline') {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') ui.collectOfflineNow();
      return;
    }
    if (this.reveal.active && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) {
      this.reveal.dismiss();
      return;
    }
    if (e.code === 'Escape') {
      if (ui.closeTop()) return;
      ui.openPanel('settings');
      return;
    }
    if (ui.open === 'settings' || ui.open === 'confirm') return;
    if (e.code === 'KeyU') ui.togglePanel('upgrades');
    else if (e.code === 'KeyI' || e.code === 'Tab') {
      e.preventDefault();
      ui.togglePanel('arsenal');
    } else if (e.code === 'KeyM') {
      const muted = this.settings.sfx === 0 && this.settings.music === 0;
      if (muted) {
        this.settings.sfx = this.settings.lastSfx ?? 0.8;
        this.settings.music = this.settings.lastMusic ?? 0.5;
      } else {
        this.settings.lastSfx = this.settings.sfx;
        this.settings.lastMusic = this.settings.music;
        this.settings.sfx = 0;
        this.settings.music = 0;
      }
      this.audio.setVolumes(this.settings.sfx, this.settings.music);
      ui.toast(muted ? 'Sound ON' : 'Sound OFF', '');
      this.save();
      ui.refreshAll();
    } else if ((e.code === 'KeyE' || e.code === 'Space') && !ui.open) {
      this.goToCrate();
    }
  }

  goToCrate() {
    this.player.walkTo(L.CRATE_PAD.x, L.CRATE_PAD.z);
  }

  onTap(x, y) {
    this.onUserGesture();
    if (this.reveal.active) {
      this.reveal.dismiss();
      return;
    }
    const v = new THREE.Vector3();
    const hit = (wx, wy, wz, r) => {
      v.set(wx, wy, wz).project(this.camera);
      if (v.z > 1) return false;
      const px = (v.x * 0.5 + 0.5) * this.width;
      const py = (-v.y * 0.5 + 0.5) * this.height;
      return Math.hypot(px - x, py - y) < r;
    };
    const scale = Math.min(1.4, this.height / 720);
    if (hit(L.CRATE_POS.x, 0.8, L.CRATE_POS.z, 110 * scale)) return this.goToCrate();
    if (hit(L.LUCK_POS.x, 1.2, L.LUCK_POS.z, 80 * scale)) return this.player.walkTo(L.LUCK_PAD.x, L.LUCK_PAD.z);
    if (hit(L.VAULT_POS.x, 1.2, L.VAULT_POS.z, 80 * scale)) return this.player.walkTo(L.VAULT_PAD.x, L.VAULT_PAD.z);
    const slot = this.guns.pickAt(x, y, this.camera, this.width, this.height, 50 * scale);
    if (slot) {
      this.ui.showGunTip(slot, true);
      this.player.walkTo(slot.padX, slot.padZ);
      return;
    }
    const ndc = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, p)) this.player.walkTo(p.x, p.z);
  }

  // ---------------------------------------------------------------- save
  save() {
    if (this.resetting) return;
    saveState(this.state);
  }

  hardReset() {
    this.resetting = true;
    wipeSave();
    try {
      // overwrite too, in case a late pagehide handler tries to save
      saveState(defaultState());
      wipeSave();
    } catch {
      /* ignore */
    }
    location.reload();
  }
}
