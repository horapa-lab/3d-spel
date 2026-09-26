// Gun slots on the side walls: models, auto-aim and firing.

import * as THREE from 'three';
import { createGunModel } from '../gfx/gunModels.js';
import { buildMount } from '../gfx/props.js';
import { WEAPON_BY_ID } from '../data/weapons.js';
import { RARITIES } from '../data/rarities.js';
import * as E from '../core/economy.js';
import { angleDiff, rand, easeOutElastic } from '../util/math.js';
import { SLOTS } from './layout.js';

const _v = new THREE.Vector3();
const MOUNT_H = 0.86;
const GUN_SCALE = 1.55; // guns are chunky toys, bigger than real life

export class Guns {
  constructor(game) {
    this.game = game;
    this.mountTmpl = buildMount();
    const ringGeo = new THREE.RingGeometry(0.62, 0.78, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringGeo = ringGeo;
    this.slots = SLOTS.map((s, i) => {
      const restYaw = Math.atan2(-s.side * 0.22, -1);
      return {
        i, ...s, restYaw, yaw: restYaw, pitch: 0, root: null, yawNode: null, model: null, muzzle: null,
        spinner: null, data: null, key: '', cd: rand(0, 0.6), target: null, tuid: 0, retarget: 0,
        recoil: 0, spinV: 0, pop: 0, stats: null, ring: null, flameOn: 0, weapon: null,
      };
    });
    this.hold = -1; // slot whose new gun is still flying in from the crate
  }

  /** Make sure mounts/models match the saved state. */
  sync() {
    const s = this.game.state;
    const n = E.slotCount(s);
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (i < n && !slot.root) this._buildMount(slot);
      if (i >= n && slot.root) {
        this.game.scene.remove(slot.root);
        slot.root = null;
        slot.model = null;
        slot.key = '';
      }
      if (i === this.hold) continue;
      const g = i < n ? s.guns[i] : null;
      const key = g ? `${g.t}|${g.g ? 1 : 0}` : '';
      if (slot.root && key !== slot.key) this._setModel(slot, g);
      slot.data = g || null;
    }
    this.refreshStats();
  }

  _buildMount(slot) {
    const root = new THREE.Group();
    root.position.set(slot.x, slot.y, slot.z);
    const mount = this.mountTmpl.clone();
    root.add(mount);
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false }));
    ring.position.y = 0.18;
    ring.visible = false;
    root.add(ring);
    const yawNode = new THREE.Group();
    yawNode.position.y = MOUNT_H;
    root.add(yawNode);
    this.game.scene.add(root);
    slot.root = root;
    slot.yawNode = yawNode;
    slot.ring = ring;
    slot.yaw = slot.restYaw;
    root.scale.setScalar(0.01);
    slot.pop = 1;
  }

  _setModel(slot, g) {
    if (slot.model) slot.yawNode.remove(slot.model);
    slot.model = null;
    slot.spinner = null;
    slot.key = '';
    slot.ring.visible = false;
    if (!g) return;
    const w = WEAPON_BY_ID[g.t];
    const m = createGunModel(g.t, !!g.g);
    const holder = new THREE.Group();
    holder.add(m.obj);
    m.obj.scale.setScalar(w.scale * GUN_SCALE);
    m.obj.position.y = 0.42;
    holder.userData.baseY = 0.42;
    slot.yawNode.add(holder);
    slot.model = holder;
    slot.inner = m.obj;
    slot.muzzleLocal = m.muzzle.clone();
    slot.spinner = m.spinner;
    slot.key = `${g.t}|${g.g ? 1 : 0}`;
    slot.weapon = w;
    slot.ring.visible = true;
    slot.ring.material.color.set(g.g ? 0xffd23f : RARITIES[w.rarity].hex);
    slot.pop = 1;
  }

  refreshStats() {
    const s = this.game.state;
    const dmgMult = E.dmgMultOf(s);
    const rateMult = E.rateMultOf(s);
    for (const slot of this.slots) {
      const g = slot.data;
      if (!g) {
        slot.stats = null;
        continue;
      }
      const w = WEAPON_BY_ID[g.t];
      slot.weapon = w;
      const lvl = E.gunLevelMult(g.l) * (g.g ? E.GOLD_MULT : 1);
      slot.stats = {
        dmg: w.dmg * lvl * dmgMult,
        interval: 1 / (w.rate * rateMult),
        range: w.range,
        critMult: E.CRIT_MULT,
      };
    }
  }

  /** Little bounce + ring flash when a gun lands or levels up. */
  celebrate(i) {
    const slot = this.slots[i];
    if (!slot || !slot.root) return;
    slot.pop = 1;
    const p = slot.root.position;
    this.game.fx.dust(p.x, p.z, 10, 0xe8d3a8);
    this.game.fx.rings.spawn(p.x, p.y + 0.2, p.z, 0.3, 2.2, slot.ring.material.color.getHex(), 0.6);
    this.game.fx.sparkleBurst(p.x, p.y + 1.2, p.z, slot.ring.material.color.getHex(), 18, 5);
  }

  muzzleWorld(slot, out) {
    slot.model.updateMatrixWorld(true);
    out.copy(slot.muzzleLocal);
    return slot.inner.localToWorld(out);
  }

  update(dt) {
    const game = this.game;
    const zs = game.zombies;
    for (const slot of this.slots) {
      if (!slot.root) continue;
      if (slot.pop > 0) {
        slot.pop = Math.max(0, slot.pop - dt * 1.4);
        const k = easeOutElastic(1 - slot.pop);
        slot.root.scale.setScalar(Math.max(0.01, k));
      }
      if (slot.ring.visible) slot.ring.material.opacity = 0.65 + Math.sin(game.time * 3 + slot.i) * 0.25;
      if (!slot.model || !slot.stats) continue;
      const w = slot.weapon;
      const st = slot.stats;

      // targeting
      slot.retarget -= dt;
      let t = slot.target;
      if (t && (t.uid !== slot.tuid || t.dying)) t = null;
      if (t) {
        const dx = t.x - slot.x;
        const dz = t.z - slot.z;
        if (dx * dx + dz * dz > st.range * st.range) t = null;
      }
      if (!t || slot.retarget <= 0) {
        slot.retarget = 0.25 + Math.random() * 0.1;
        const nt = w.target === 'strong' ? zs.findStrongest(slot.x, slot.z, st.range) : zs.findFirst(slot.x, slot.z, st.range);
        if (nt) t = nt;
      }
      slot.target = t;
      slot.tuid = t ? t.uid : 0;

      // aim
      let aimed = false;
      if (t) {
        const want = Math.atan2(t.x - slot.x, t.z - slot.z);
        const d = angleDiff(slot.yaw, want);
        const turn = 9 * dt;
        slot.yaw += Math.abs(d) < turn ? d : Math.sign(d) * turn;
        aimed = Math.abs(angleDiff(slot.yaw, want)) < 0.3;
        const dist = Math.hypot(t.x - slot.x, t.z - slot.z);
        slot.pitch = Math.atan2(slot.y + MOUNT_H + 0.3 - zs.aimY(t), dist) * 0.8;
      } else {
        const idle = slot.restYaw + Math.sin(game.time * 0.6 + slot.i) * 0.15;
        slot.yaw += angleDiff(slot.yaw, idle) * Math.min(1, dt * 2);
        slot.pitch *= 1 - Math.min(1, dt * 3);
      }
      slot.yawNode.rotation.y = slot.yaw;
      slot.model.rotation.x = slot.pitch;

      // recoil + spin
      slot.recoil = Math.max(0, slot.recoil - dt * 5);
      slot.inner.position.z = -slot.recoil * 0.6;
      slot.inner.position.y = slot.model.userData.baseY + slot.recoil * 0.12;
      if (slot.spinner) {
        const target = t && aimed ? 22 : 0;
        slot.spinV += (target - slot.spinV) * Math.min(1, dt * 3);
        slot.spinner.rotation.z += slot.spinV * dt;
      }

      // fire
      slot.cd -= dt;
      if (w.fire === 'flame') {
        this._updateFlame(slot, t, aimed, dt);
        continue;
      }
      if (t && aimed && slot.cd <= 0) {
        slot.cd = Math.max(slot.cd + st.interval, st.interval * 0.3);
        if (w.spin && slot.spinV < 10) continue;
        this._fire(slot, t);
      } else if (slot.cd < 0) slot.cd = 0;
    }
  }

  _fire(slot, t) {
    const game = this.game;
    const w = slot.weapon;
    const st = slot.stats;
    const m = this.muzzleWorld(slot, _v);
    const dx = Math.sin(slot.yaw);
    const dz = Math.cos(slot.yaw);
    const crit = Math.random() < E.CRIT_CHANCE;
    const heavy = w.fire === 'rocket' || w.fire === 'nuke' || w.fire === 'rail' || w.rarity >= 3;
    slot.recoil = Math.min(1, slot.recoil + (heavy ? 0.9 : w.rate > 12 ? 0.25 : 0.5));
    const flashCol = w.fire === 'tesla' || w.fire === 'rail' ? w.tracer : w.fire === 'plasma' || w.fire === 'vortex' ? 0xd46bff : 0xffd27a;
    if (w.fire !== 'vortex') game.fx.muzzle(m.x, m.y, m.z, dx, dz, flashCol, heavy ? 1.6 : w.rate > 12 ? 0.8 : 1);
    game.audio.shot(w.sound, m.x);

    if (w.fire === 'tesla') {
      this._tesla(slot, t, m, crit);
    } else if (w.fire === 'rail') {
      this._rail(slot, t, m, crit);
    } else {
      game.projectiles.fire(w, st, m.x, m.y, m.z, t, crit);
    }
    if (w.fire === 'rocket' || w.fire === 'nuke') {
      // back blast
      game.fx.smokePuff(m.x - dx * 3.2, m.y, m.z - dz * 3.2, 1.6);
      game.fx.glow.spawn(m.x - dx * 3, m.y, m.z - dz * 3, -dx * 3, 0, -dz * 3, 0.15, 1.2, 2.2, 0xffb347, 0.8);
    }
  }

  _tesla(slot, t, m, crit) {
    const game = this.game;
    const zs = game.zombies;
    const w = slot.weapon;
    let dmg = slot.stats.dmg * (crit ? E.CRIT_MULT : 1);
    const hit = new Set();
    let from = { x: m.x, y: m.y, z: m.z };
    let cur = t;
    for (let n = 0; n < w.chain && cur; n++) {
      const ty = zs.aimY(cur);
      game.fx.lightning(from.x, from.y, from.z, cur.x, ty, cur.z, 0x8ff0ff, n === 0 ? 0.14 : 0.1);
      hit.add(cur.uid);
      zs.damage(cur, dmg, { crit, knock: 0.2 });
      from = { x: cur.x, y: ty, z: cur.z };
      dmg *= 0.85;
      let best = null;
      let bd = 7 * 7;
      for (const o of zs.list) {
        if (o.dying || hit.has(o.uid)) continue;
        const d = (o.x - cur.x) ** 2 + (o.z - cur.z) ** 2;
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      cur = best;
    }
  }

  _rail(slot, t, m, crit) {
    const game = this.game;
    const zs = game.zombies;
    const dmg = slot.stats.dmg * (crit ? E.CRIT_MULT : 1);
    const ty = zs.aimY(t);
    let dx = t.x - m.x;
    let dy = ty - m.y;
    let dz = t.z - m.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    dx /= d;
    dy /= d;
    dz /= d;
    const L = 75;
    const ex = m.x + dx * L;
    const ey = Math.max(0.3, m.y + dy * L);
    const ez = m.z + dz * L;
    game.fx.beam(m.x, m.y, m.z, ex, ey, ez, 0x55e6ff, 0.28, 0.4);
    game.shake(0.12);
    // pierce everything close to the line
    for (const o of zs.list) {
      if (o.dying) continue;
      const px = o.x - m.x;
      const pz = o.z - m.z;
      const u = px * dx + pz * dz;
      if (u < 0) continue;
      const cx = px - dx * u;
      const cz = pz - dz * u;
      const r = zs.radius(o) + 0.5;
      if (cx * cx + cz * cz <= r * r) {
        zs.damage(o, dmg, { crit, knock: 0.3 });
        game.fx.hit(o.x, zs.aimY(o), o.z, 0x9ff4ff, true);
      }
    }
  }

  _updateFlame(slot, t, aimed, dt) {
    const game = this.game;
    const zs = game.zombies;
    const w = slot.weapon;
    const st = slot.stats;
    if (!(t && aimed)) {
      slot.flameOn = Math.max(0, slot.flameOn - dt * 4);
      return;
    }
    slot.flameOn = 1;
    const m = this.muzzleWorld(slot, _v);
    const dx = Math.sin(slot.yaw);
    const dz = Math.cos(slot.yaw);
    game.fx.flame(m.x, m.y, m.z, dx, dz, w.cone * 0.7);
    game.audio.shot('flame', m.x);
    if (slot.cd <= 0) {
      slot.cd += st.interval;
      if (slot.cd < 0) slot.cd = 0;
      const cosCone = Math.cos(w.cone);
      for (const o of zs.list) {
        if (o.dying) continue;
        const px = o.x - m.x;
        const pz = o.z - m.z;
        const dist = Math.hypot(px, pz);
        if (dist > st.range || dist < 0.01) continue;
        if ((px * dx + pz * dz) / dist < cosCone) continue;
        const crit = Math.random() < E.CRIT_CHANCE;
        zs.damage(o, st.dmg * (crit ? E.CRIT_MULT : 1), { crit });
        if (Math.random() < 0.3) game.fx.glow.spawn(o.x, zs.aimY(o), o.z, 0, 1.5, 0, 0.4, 0.6, 1.2, 0xff7a1a, 0.8);
      }
    }
  }

  /** Nearest gun slot to a screen position (for hover tooltips). */
  pickAt(sx, sy, camera, w, h, maxDist = 42) {
    let best = null;
    let bd = maxDist * maxDist;
    for (const slot of this.slots) {
      if (!slot.root || !slot.data) continue;
      _v.set(slot.x, slot.y + MOUNT_H + 0.3, slot.z).project(camera);
      const px = (_v.x * 0.5 + 0.5) * w;
      const py = (-_v.y * 0.5 + 0.5) * h;
      const d = (px - sx) ** 2 + (py - sy) ** 2;
      if (d < bd) {
        bd = d;
        best = slot;
      }
    }
    return best;
  }
}
