// Zombie horde: logic + instanced rendering (a handful of draw calls for
// hundreds of animated blocky zombies).

import * as THREE from 'three';
import { buildZombieGeometries, RIG } from '../gfx/characters.js';
import { ENEMIES, BOSS_VARIANTS } from '../data/enemies.js';
import { zombieStats } from '../core/economy.js';
import { zoneIndexForWave } from '../data/zones.js';
import { rand, clamp } from '../util/math.js';
import * as L from './layout.js';

const MAX = 180;
const _m = new THREE.Matrix4();
const _root = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);

let UID = 1;

function colorArr(hex) {
  _c.set(hex);
  return [_c.r, _c.g, _c.b];
}

export class Zombies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.pool = [];
    this.boss = null;
    const geos = buildZombieGeometries();
    const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const accMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
    const mk = (geo, count, mat = bodyMat, tinted = true) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (tinted) {
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      }
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      game.scene.add(m);
      return m;
    };
    this.meshes = {
      head: mk(geos.head, MAX),
      torso: mk(geos.torso, MAX),
      arm: mk(geos.arm, MAX * 2),
      leg: mk(geos.leg, MAX * 2),
      helmet: mk(geos.helmet, MAX, accMat, false),
      horns: mk(geos.horns, MAX, accMat, false),
      crown: mk(geos.crown, 8, accMat, false),
      pads: mk(geos.pads, 60, accMat, false),
    };
    // simple blob shadows are handled by real shadows; hp bars by the UI overlay
  }

  setShadows(on) {
    for (const k in this.meshes) this.meshes[k].castShadow = on;
  }

  get aliveCount() {
    let n = 0;
    for (const z of this.list) if (!z.dying) n++;
    return n;
  }

  spawn(type, wave, opts = {}) {
    if (this.list.length >= MAX) return null;
    const def = ENEMIES[type];
    const st = zombieStats(type, wave);
    const z = this.pool.pop() || {};
    z.uid = UID++;
    z.type = type;
    z.def = def;
    z.isBoss = !!def.boss;
    z.x = opts.x ?? rand(-L.LANE_HALF, L.LANE_HALF) * (def.boss ? 0 : 1);
    z.z = opts.z ?? L.SPAWN_Z + rand(-1.5, 1.5);
    z.laneX = z.x;
    z.speed = def.speed * rand(0.9, 1.1);
    z.hp = st.hp * (opts.hpMult || 1);
    z.maxHp = z.hp;
    z.reward = st.reward;
    z.dmg = st.dmg;
    z.scale = def.s * (def.boss ? 1 : rand(0.95, 1.06));
    z.w = def.w;
    z.phase = Math.random() * 10;
    z.flash = 0;
    z.knock = 0;
    z.dying = false;
    z.deathT = 0;
    z.attackT = rand(0, 0.8);
    z.state = 'walk';
    z.stopZ = L.BARRICADE_Z - 1.35 - rand(0, 1.8) * (def.boss ? 0 : 1) - (def.boss ? 1.6 : 0) - (z.scale - 1) * 0.4;
    z.incoming = 0;
    z.dmgAcc = 0;
    z.dmgT = 0;
    z.crit = false;
    z.pull = null;
    z.spawnT = 0;
    z.yaw = 0;
    z.hpShow = 0;
    let skin = def.skin;
    let pants = def.pants;
    if (def.boss) {
      const v = BOSS_VARIANTS[zoneIndexForWave(wave) % BOSS_VARIANTS.length];
      skin = v.skin;
      pants = v.pants;
      z.name = v.name;
    }
    z.cSkin = colorArr(skin);
    z.cShirt = colorArr(def.boss ? skin : def.shirt);
    z.cPants = colorArr(pants);
    // slight color variation so hordes don't look cloned
    const v = rand(0.9, 1.08);
    for (const arr of [z.cSkin, z.cShirt]) for (let i = 0; i < 3; i++) arr[i] *= v;
    this.list.push(z);
    if (z.isBoss) this.boss = z;
    return z;
  }

  /** Hit point for projectiles (chest height). */
  aimY(z) {
    return 1.3 * z.scale;
  }

  radius(z) {
    return 0.55 * z.scale * z.w;
  }

  /**
   * Apply damage. Returns true if it killed the zombie.
   * opts: crit, knock, silent, source ('aoe' etc)
   */
  damage(z, amount, opts = {}) {
    if (z.dying) return false;
    z.hp -= amount;
    z.flash = 0.09;
    z.hpShow = 2.5;
    if (opts.knock) z.knock = Math.max(z.knock, opts.knock / (z.isBoss ? 6 : z.scale));
    z.dmgAcc += amount;
    if (opts.crit) z.crit = true;
    if (z.hp <= 0) {
      this.kill(z, opts);
      return true;
    }
    return false;
  }

  kill(z, opts = {}) {
    if (z.dying) return;
    z.dying = true;
    z.deathT = 0;
    z.hp = 0;
    z.deathDir = opts.fromX !== undefined ? Math.sign(z.x - opts.fromX) || 1 : rand(-1, 1) < 0 ? -1 : 1;
    if (this.boss === z) this.boss = null;
    this.game.onZombieKilled(z, opts);
  }

  /** Remove everything instantly (breach / reset). */
  clear(withEffects = false) {
    for (const z of this.list) {
      if (withEffects && !z.dying) {
        this.game.fx.goo(z.x, this.aimY(z), z.z, 0x8fcb4a, 5);
      }
      this.pool.push(z);
    }
    this.list.length = 0;
    this.boss = null;
  }

  update(dt) {
    const game = this.game;
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const z = list[i];
      z.spawnT += dt;
      if (z.dying) {
        z.deathT += dt;
        if (z.deathT > 0.75) {
          list[i] = list[list.length - 1];
          list.pop();
          this.pool.push(z);
        }
        continue;
      }
      if (z.flash > 0) z.flash -= dt;
      if (z.hpShow > 0) z.hpShow -= dt;

      // black hole pull
      if (z.pull) {
        const p = z.pull;
        const dx = p.x - z.x;
        const dz = p.z - z.z;
        const d = Math.hypot(dx, dz) || 1;
        const sp = Math.min(d, 7 * dt * (z.isBoss ? 0.25 : 1));
        z.x += (dx / d) * sp;
        z.z += (dz / d) * sp;
        z.pull = null;
      }

      if (z.knock > 0) {
        z.z -= z.knock * dt * 6;
        z.knock = Math.max(0, z.knock - dt * 8);
      }

      if (z.state === 'walk') {
        z.z += z.speed * dt;
        // drift back to lane, wobble
        z.x += (z.laneX - z.x) * Math.min(1, dt * 0.8) + Math.sin(z.phase * 0.7) * dt * 0.15;
        z.phase += dt * z.speed * 2.6 / z.scale;
        if (z.z >= z.stopZ) {
          z.z = z.stopZ;
          z.state = 'attack';
        }
      } else {
        z.phase += dt * 3;
        if (z.z < z.stopZ - 0.6) z.state = 'walk';
        z.attackT -= dt;
        if (z.attackT <= 0) {
          z.attackT = 1.0;
          game.onBarricadeHit(z.dmg, z);
        }
      }
      z.x = clamp(z.x, -L.ROAD_HALF + 0.4, L.ROAD_HALF - 0.4);

      // damage numbers are batched per zombie
      if (z.dmgAcc > 0) {
        z.dmgT -= dt;
        if (z.dmgT <= 0) {
          game.ui.overlay.damageNumber(z.x, this.aimY(z) + 0.8 * z.scale, z.z, z.dmgAcc, z.crit);
          z.dmgAcc = 0;
          z.crit = false;
          z.dmgT = 0.22;
        }
      }
    }
    // keep sorted by progress (closest to the barricade first) for targeting
    list.sort((a, b) => b.z - a.z);
  }

  /** First living zombie within range of a point (list is sorted by progress). */
  findFirst(x, z, range, skipOverkill = true) {
    const r2 = range * range;
    let fallback = null;
    for (const t of this.list) {
      if (t.dying || t.spawnT < 0.3) continue;
      const dx = t.x - x;
      const dz = t.z - z;
      if (dx * dx + dz * dz > r2) continue;
      if (skipOverkill && t.incoming >= t.hp) {
        fallback ||= t;
        continue;
      }
      return t;
    }
    return fallback;
  }

  findStrongest(x, z, range) {
    const r2 = range * range;
    let best = null;
    for (const t of this.list) {
      if (t.dying || t.spawnT < 0.3) continue;
      const dx = t.x - x;
      const dz = t.z - z;
      if (dx * dx + dz * dz > r2) continue;
      if (t.incoming >= t.hp) continue;
      if (!best || t.maxHp > best.maxHp || (t.maxHp === best.maxHp && t.z > best.z)) best = t;
    }
    return best || this.findFirst(x, z, range, false);
  }

  forEachInRadius(x, z, r, fn) {
    for (const t of this.list) {
      if (t.dying) continue;
      const dx = t.x - x;
      const dz = t.z - z;
      const rr = r + this.radius(t) * 0.6;
      if (dx * dx + dz * dz <= rr * rr) fn(t, Math.sqrt(dx * dx + dz * dz));
    }
  }

  // ---------------------------------------------------------------- render
  render() {
    const M = this.meshes;
    let nBody = 0;
    let nLimb = 0;
    let nHelmet = 0;
    let nHorns = 0;
    let nCrown = 0;
    let nPads = 0;
    const t = this.game.time;

    for (const z of this.list) {
      const s = z.scale;
      let tilt = 0;
      let sink = 0;
      let sc = s;
      let legA = 0;
      let armA = -1.35;
      let armB = -1.35;
      let bob = 0;
      let yaw = Math.sin(z.phase * 0.5) * 0.12;
      let lean = 0.08;
      if (z.dying) {
        const k = Math.min(1, z.deathT / 0.3);
        tilt = -k * 1.45; // fall backwards
        sink = Math.max(0, z.deathT - 0.35) * 2.2 * s;
        sc = s * (1 - Math.max(0, z.deathT - 0.45) * 3.2);
        armA = armB = -1.35 - k * 1.2;
        yaw = z.deathDir * k * 0.5;
      } else if (z.state === 'walk') {
        legA = Math.sin(z.phase) * 0.62;
        armA = -1.35 + Math.sin(z.phase + 1.2) * 0.14;
        armB = -1.35 - Math.sin(z.phase + 1.2) * 0.14;
        bob = Math.abs(Math.cos(z.phase)) * 0.07 * s;
      } else {
        const a = Math.sin(t * 9 + z.phase);
        armA = -1.9 + a * 0.6;
        armB = -1.9 - a * 0.6;
        lean = 0.2 + a * 0.08;
        legA = 0.15;
      }
      if (sc <= 0.01) continue;
      // spawn pop-in out of the portal
      if (z.spawnT < 0.35) sc *= z.spawnT / 0.35;

      _e.set(tilt + lean, yaw, 0);
      _q.setFromEuler(_e);
      _p.set(z.x, bob - sink, z.z);
      _s.set(sc, sc, sc);
      _root.compose(_p, _q, _s);

      const flash = z.flash > 0;
      const w = z.w;
      // torso
      this._part(M.torso, nBody, _root, 0, RIG.hipY, 0, 0, w, 1, 1, flash ? null : z.cShirt);
      // head (slight tilt)
      _e.set(-0.12 + (z.state === 'attack' ? 0.2 : 0), Math.sin(z.phase * 0.35) * 0.2, Math.sin(z.phase * 0.5) * 0.12);
      this._partE(M.head, nBody, _root, 0, RIG.neckY, 0.02, _e, 1, flash ? null : z.cSkin);
      nBody++;
      // arms
      _e.set(armA, 0, 0.08);
      this._partE(M.arm, nLimb, _root, -RIG.armX * w, RIG.shoulderY, 0, _e, w, flash ? null : z.cSkin);
      _e.set(armB, 0, -0.08);
      this._partE(M.arm, nLimb + 1, _root, RIG.armX * w, RIG.shoulderY, 0, _e, w, flash ? null : z.cSkin);
      // legs
      _e.set(legA, 0, 0);
      this._partE(M.leg, nLimb, _root, -RIG.legX * w, RIG.hipY, 0, _e, w, flash ? null : z.cPants);
      _e.set(-legA, 0, 0);
      this._partE(M.leg, nLimb + 1, _root, RIG.legX * w, RIG.hipY, 0, _e, w, flash ? null : z.cPants);
      nLimb += 2;

      const acc = z.def.acc;
      if (acc === 'helmet' || acc === 'horns' || acc === 'boss') {
        const mesh = acc === 'helmet' ? M.helmet : acc === 'horns' ? M.horns : M.crown;
        const idx = acc === 'helmet' ? nHelmet++ : acc === 'horns' ? nHorns++ : nCrown++;
        _e.set(-0.12, Math.sin(z.phase * 0.35) * 0.2, Math.sin(z.phase * 0.5) * 0.12);
        this._partE(mesh, idx, _root, 0, RIG.neckY, 0.02, _e, 1, undefined);
      }
      if (acc === 'pads' || acc === 'boss') {
        this._part(M.pads, nPads++, _root, 0, RIG.hipY, 0, 0, w, 1, 1, undefined);
      }
    }
    M.torso.count = M.head.count = nBody;
    M.arm.count = M.leg.count = nLimb;
    M.helmet.count = nHelmet;
    M.horns.count = nHorns;
    M.crown.count = nCrown;
    M.pads.count = nPads;
    for (const k in M) {
      M[k].instanceMatrix.needsUpdate = true;
      if (M[k].instanceColor) M[k].instanceColor.needsUpdate = true;
    }
  }

  _part(mesh, idx, root, x, y, z, rx, sx, sy, sz, color) {
    _e.set(rx, 0, 0);
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(sx, sy, sz);
    _local.compose(_p, _q, _s);
    _m.multiplyMatrices(root, _local);
    _m.toArray(mesh.instanceMatrix.array, idx * 16);
    this._color(mesh, idx, color);
  }

  _partE(mesh, idx, root, x, y, z, euler, sx, color) {
    _q.setFromEuler(euler);
    _p.set(x, y, z);
    _s.set(sx, 1, sx);
    _local.compose(_p, _q, _s);
    _m.multiplyMatrices(root, _local);
    _m.toArray(mesh.instanceMatrix.array, idx * 16);
    this._color(mesh, idx, color);
  }

  _color(mesh, idx, color) {
    if (color === undefined || !mesh.instanceColor) return;
    const a = mesh.instanceColor.array;
    if (color === null) {
      a[idx * 3] = WHITE.r * 2.2;
      a[idx * 3 + 1] = WHITE.g * 2.2;
      a[idx * 3 + 2] = WHITE.b * 2.2;
    } else {
      a[idx * 3] = color[0];
      a[idx * 3 + 1] = color[1];
      a[idx * 3 + 2] = color[2];
    }
  }
}
