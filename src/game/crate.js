// The loot crate in the middle of the base + the two upgrade stations.
// Walk onto a pad and it fills up -> action happens (classic idle-mobile style).

import * as THREE from 'three';
import { buildCrate, buildLuckStation, buildClover, buildVault, buildCoinStack, buildPad, crateTierForLevel } from '../gfx/props.js';
import { RARITIES } from '../data/rarities.js';
import * as E from '../core/economy.js';
import { rand, easeOutBack } from '../util/math.js';
import * as L from './layout.js';

export class Pad {
  constructor(game, { x, z, r, color, fill = 0.55, onActivate, canActivate, onDenied }) {
    this.game = game;
    this.x = x;
    this.z = z;
    this.r = r;
    this.fillTime = fill;
    this.progress = 0;
    this.streak = 0;
    this.inside = false;
    this.onActivate = onActivate;
    this.canActivate = canActivate;
    this.onDenied = onDenied;
    this.deniedT = 0;
    this.obj = buildPad(r, color);
    this.obj.position.set(x, 0, z);
    game.scene.add(this.obj);
  }

  update(dt) {
    const p = this.game.player;
    const inside = p.distTo(this.x, this.z) < this.r * 0.95;
    if (inside && !this.inside) {
      this.progress = 0;
      this.streak = 0;
    }
    this.inside = inside;
    const fill = this.obj.userData.fill;
    const ring = this.obj.userData.ring;
    const pulse = 1 + Math.sin(this.game.time * 4 + this.x) * 0.04;
    ring.scale.setScalar(inside ? 1.08 : pulse);
    if (this.deniedT > 0) this.deniedT -= dt;
    if (inside) {
      const ok = this.canActivate();
      if (ok === true) {
        const t = Math.max(0.18, this.fillTime * Math.pow(0.7, this.streak));
        this.progress += dt / t;
        if (this.progress >= 1) {
          this.progress = 0;
          this.streak++;
          this.onActivate();
          this.game.fx.rings.spawn(this.x, 0.08, this.z, 0.4, this.r * 1.6, 0xffffff, 0.35);
        }
      } else {
        this.progress = Math.max(0, this.progress - dt * 3);
        if (ok === 'poor' && this.deniedT <= 0) {
          this.deniedT = 1.4;
          if (this.onDenied) this.onDenied();
        }
      }
    } else {
      this.progress = Math.max(0, this.progress - dt * 4);
    }
    fill.scale.setScalar(Math.max(0.001, this.progress));
  }
}

export class CrateSystem {
  constructor(game) {
    this.game = game;
    this.tier = -1;
    this.group = new THREE.Group();
    this.group.position.set(L.CRATE_POS.x, 0, L.CRATE_POS.z);
    game.scene.add(this.group);
    this.state = 'idle';
    this.t = 0;
    this.result = null;
    this.lidAngle = 0;
    this.escalate = 0;

    // light beam when opened
    const beamGeo = new THREE.CylinderGeometry(1.2, 1.6, 14, 24, 1, true);
    beamGeo.translate(0, 7, 0);
    const colors = [];
    const pos = beamGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 14;
      const a = 1 - y;
      colors.push(a, a, a);
    }
    beamGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    );
    this.beam.position.y = 0.8;
    this.beam.visible = false;
    this.group.add(this.beam);

    // stations
    this.luck = buildLuckStation();
    this.luck.position.set(L.LUCK_POS.x, 0, L.LUCK_POS.z);
    this.luck.rotation.y = 0.25;
    game.scene.add(this.luck);
    this.clover = buildClover();
    this.clover.position.set(L.LUCK_POS.x, 3.1, L.LUCK_POS.z);
    game.scene.add(this.clover);

    this.vault = buildVault();
    this.vault.position.set(L.VAULT_POS.x, 0, L.VAULT_POS.z);
    this.vault.rotation.y = -0.25;
    game.scene.add(this.vault);
    this.coinStacks = new THREE.Group();
    this.coinStacks.position.set(L.VAULT_POS.x, 0, L.VAULT_POS.z);
    game.scene.add(this.coinStacks);
    this.vaultLevelShown = -1;

    this.cratePad = new Pad(game, {
      ...L.CRATE_PAD, color: '#ffd23f', fill: 0.5,
      canActivate: () => (this.state !== 'idle' || game.reveal.active ? false : game.canOpenCrate() ? true : 'poor'),
      onActivate: () => game.openCrate(),
      onDenied: () => game.ui.labels.deny('crate'),
    });
    this.luckPad = new Pad(game, {
      ...L.LUCK_PAD, color: '#52e052', fill: 0.6,
      canActivate: () => (E.isMaxed(game.state, 'crate') ? false : game.canAfford(E.upgradeCost('crate', E.upgradeLevel(game.state, 'crate'))) ? true : 'poor'),
      onActivate: () => game.buyUpgrade('crate', 1),
      onDenied: () => game.ui.labels.deny('luck'),
    });
    this.vaultPad = new Pad(game, {
      ...L.VAULT_PAD, color: '#b45cff', fill: 0.6,
      canActivate: () => (E.isMaxed(game.state, 'vault') ? false : game.canAfford(E.upgradeCost('vault', E.upgradeLevel(game.state, 'vault'))) ? true : 'poor'),
      onActivate: () => game.buyUpgrade('vault', 1),
      onDenied: () => game.ui.labels.deny('vault'),
    });
  }

  refresh() {
    const tier = crateTierForLevel(E.crateLevel(this.game.state));
    if (tier !== this.tier) {
      if (this.model) this.group.remove(this.model);
      this.model = buildCrate(tier);
      this.lid = this.model.getObjectByName('lid');
      this.group.add(this.model);
      if (this.tier >= 0) {
        this.game.fx.sparkleBurst(L.CRATE_POS.x, 1.5, L.CRATE_POS.z, 0xffe27a, 40, 7);
        this.pop = 1;
      }
      this.tier = tier;
    }
    const vl = E.upgradeLevel(this.game.state, 'vault');
    if (vl !== this.vaultLevelShown) {
      this.vaultLevelShown = vl;
      this.coinStacks.clear();
      const stacks = Math.min(8, 1 + Math.floor(vl / 3));
      for (let i = 0; i < stacks; i++) {
        const st = buildCoinStack(3 + ((i * 5 + vl) % 7));
        st.position.set(i < 4 ? 1.2 : -1.2, 0, 0.9 - (i % 4) * 0.5);
        this.coinStacks.add(st);
      }
    }
  }

  get busy() {
    return this.state !== 'idle';
  }

  /** Start the opening sequence for an already rolled result. */
  open(result) {
    this.result = result;
    this.state = 'shake';
    this.t = 0;
    this.escalate = 0;
    this.shakeDur = 0.75 + Math.min(result.rarity, 6) * 0.22;
    this.game.audio.play('crateShake');
  }

  update(dt) {
    const game = this.game;
    this.cratePad.update(dt);
    this.luckPad.update(dt);
    this.vaultPad.update(dt);
    this.clover.rotation.y += dt * 1.6;
    this.clover.position.y = 3.1 + Math.sin(game.time * 2) * 0.15;

    this.t += dt;
    const lid = this.lid;
    if (this.pop > 0) {
      this.pop = Math.max(0, this.pop - dt * 2);
      this.model.scale.setScalar(1 + Math.sin(this.pop * Math.PI) * 0.25);
    }
    if (this.state === 'idle') {
      // idle "open me" wiggle when affordable
      const can = game.canOpenCrate();
      const w = can ? Math.sin(game.time * 7) * 0.035 * (Math.sin(game.time * 1.3) > 0.4 ? 1 : 0) : 0;
      this.model.rotation.z = w;
      this.lidAngle += (0 - this.lidAngle) * Math.min(1, dt * 8);
      this.beam.visible = false;
    } else if (this.state === 'shake') {
      const k = this.t / this.shakeDur;
      const amp = 0.03 + k * 0.09;
      this.model.rotation.z = Math.sin(this.t * 45) * amp;
      this.model.rotation.x = Math.cos(this.t * 38) * amp * 0.5;
      this.model.position.y = Math.abs(Math.sin(this.t * 22)) * 0.12 * k;
      this.lidAngle = -Math.abs(Math.sin(this.t * 30)) * 0.12 * k;
      // rarity escalation sparkles: step up through the colors
      const step = Math.min(this.result.rarity, Math.floor(k * (this.result.rarity + 1)));
      if (step > this.escalate || (this.escalate === 0 && this.t < dt * 1.5)) {
        if (step > this.escalate) game.audio.play('escalate', { step });
        this.escalate = step;
      }
      const col = RARITIES[this.escalate].hex;
      if (Math.random() < 0.6) {
        game.fx.spark.spawn(L.CRATE_POS.x + rand(-1.6, 1.6), rand(0.3, 1.4), L.CRATE_POS.z + rand(-0.8, 0.8), rand(-1, 1), rand(2, 5), rand(-1, 1), 0.6, 0.6, 0.05, col, 1, { drag: 1 });
      }
      if (this.t >= this.shakeDur) {
        this.state = 'open';
        this.t = 0;
        this.model.rotation.set(0, 0, 0);
        this.model.position.y = 0;
        const rc = RARITIES[this.result.rarity];
        this.beam.visible = true;
        this.beam.material.color.set(rc.hex);
        game.fx.sparkleBurst(L.CRATE_POS.x, 1.3, L.CRATE_POS.z, rc.hex, 40, 8);
        game.fx.glow.spawn(L.CRATE_POS.x, 1.2, L.CRATE_POS.z, 0, 0, 0, 0.4, 3, 9, rc.hex, 1);
        game.fx.rings.spawn(L.CRATE_POS.x, 0.1, L.CRATE_POS.z, 0.5, 6, rc.hex, 0.6);
        game.audio.play('crateOpen', { rarity: this.result.rarity });
        game.shake(0.12 + this.result.rarity * 0.05);
        game.reveal.show(this.result);
      }
    } else if (this.state === 'open') {
      const k = Math.min(1, this.t / 0.35);
      this.lidAngle = -1.95 * easeOutBack(k);
      this.beam.material.opacity = Math.min(0.85, this.t * 3);
      this.beam.rotation.y += dt;
      if (Math.random() < 0.4) {
        const rc = RARITIES[this.result.rarity];
        game.fx.spark.spawn(L.CRATE_POS.x + rand(-1, 1), rand(1, 5), L.CRATE_POS.z + rand(-0.6, 0.6), 0, rand(1, 3), 0, 0.8, 0.5, 0.05, rc.hex, 1);
      }
      if (!game.reveal.active && this.t > 0.4) {
        this.state = 'close';
        this.t = 0;
      }
    } else if (this.state === 'close') {
      const k = Math.min(1, this.t / 0.35);
      this.lidAngle = -1.95 * (1 - k);
      this.beam.material.opacity = 0.85 * (1 - k);
      if (k >= 1) {
        this.state = 'idle';
        this.beam.visible = false;
        game.audio.play('lidClose');
        game.fx.dust(L.CRATE_POS.x, L.CRATE_POS.z + 0.9, 6, 0xe8dcc8);
      }
    }
    if (lid) lid.rotation.x = this.lidAngle;
  }
}
