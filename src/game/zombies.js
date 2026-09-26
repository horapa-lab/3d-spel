// Monster horde: logic + instanced rendering. Every monster type has its own
// instanced part meshes (head/torso/arms/legs, or a single blob body), so a
// big mixed horde costs only a few draw calls per type.

import * as THREE from 'three';
import { buildEnemyGeometries, HUMANOID } from '../gfx/characters.js';
import { ENEMIES, ALL_ENEMY_IDS } from '../data/enemies.js';
import { zombieStats } from '../core/economy.js';
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

let UID = 1;

class TypeRenderer {
  constructor(scene, geo, max, material, ghostMat) {
    this.rig = geo.rig;
    this.meshes = {};
    for (const [part, g] of Object.entries(geo.parts)) {
      const n = part === 'arm' || part === 'leg' ? max * 2 : max;
      const mat = this.rig === 'ghost' ? ghostMat : material;
      const m = new THREE.InstancedMesh(g, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.visible = false;
      m.frustumCulled = false;
      m.castShadow = true;
      scene.add(m);
      this.meshes[part] = m;
    }
    this.n = {};
  }
  begin() {
    for (const k in this.meshes) this.n[k] = 0;
  }
  put(part, matrix, r, g, b) {
    const m = this.meshes[part];
    const i = this.n[part]++;
    matrix.toArray(m.instanceMatrix.array, i * 16);
    const c = m.instanceColor.array;
    c[i * 3] = r;
    c[i * 3 + 1] = g;
    c[i * 3 + 2] = b;
  }
  end() {
    for (const k in this.meshes) {
      const m = this.meshes[k];
      m.count = this.n[k];
      m.visible = m.count > 0;
      if (m.visible) {
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.needsUpdate = true;
      }
    }
  }
  setShadows(on) {
    for (const k in this.meshes) this.meshes[k].castShadow = on;
  }
}

export class Zombies {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.pool = [];
    this.boss = null;
    const geos = buildEnemyGeometries();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
    const ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, transparent: true, opacity: 0.82, emissive: 0x223355, emissiveIntensity: 0.4 });
    this.material = mat;
    this.renderers = {};
    for (const id of ALL_ENEMY_IDS) {
      this.renderers[id] = new TypeRenderer(game.scene, geos[id], ENEMIES[id].boss ? 4 : MAX, mat, ghostMat);
    }
  }

  setEnvMap(env) {
    this.material.envMap = env;
    this.material.envMapIntensity = 0.35;
    this.material.needsUpdate = true;
  }

  setShadows(on) {
    for (const k in this.renderers) this.renderers[k].setShadows(on);
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
    z.rig = def.rig;
    z.isBoss = !!def.boss;
    z.x = opts.x ?? rand(-L.LANE_HALF, L.LANE_HALF);
    z.z = opts.z ?? L.SPAWN_Z + rand(-1.5, 1.5);
    z.laneX = z.x;
    z.speed = def.speed * rand(0.9, 1.1);
    z.hp = st.hp * (opts.hpMult || 1);
    z.maxHp = z.hp;
    z.reward = st.reward;
    z.dmg = st.dmg;
    z.scale = def.s * (def.boss ? 1 : rand(0.95, 1.06));
    z.w = 1;
    z.phase = Math.random() * 10;
    z.flash = 0;
    z.knock = 0;
    z.dying = false;
    z.deathT = 0;
    z.attackT = rand(0, 0.8);
    z.state = 'walk';
    z.stopZ = L.BARRICADE_Z - 1.3 - rand(0, 1.8) * (def.boss ? 0 : 1) - (def.boss ? 1.8 : 0) - (z.scale - 1) * 0.4;
    z.incoming = 0;
    z.dmgAcc = 0;
    z.dmgT = 0;
    z.crit = false;
    z.pull = null;
    z.spawnT = 0;
    z.hpShow = 0;
    z.name = def.name;
    z.tint = rand(0.9, 1.06);
    this.list.push(z);
    if (z.isBoss) this.boss = z;
    return z;
  }

  /** Hit point for projectiles (chest height). */
  aimY(z) {
    return (z.rig === 'blob' ? 0.6 : z.rig === 'ghost' ? 1.4 : 1.25) * z.scale;
  }

  radius(z) {
    return 0.55 * z.scale;
  }

  damage(z, amount, opts = {}) {
    if (z.dying) return false;
    z.hp -= amount;
    z.flash = 0.08;
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
    z.deathDir = opts.fromX !== undefined ? Math.sign(z.x - opts.fromX) || 1 : Math.random() < 0.5 ? -1 : 1;
    if (this.boss === z) this.boss = null;
    this.game.onZombieKilled(z, opts);
  }

  clear(withEffects = false) {
    for (const z of this.list) {
      if (withEffects && !z.dying) this.game.fx.goo(z.x, this.aimY(z), z.z, z.def.goo, 5);
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
        // slimes move in hops
        const hop = z.rig === 'blob' ? Math.max(0, Math.sin(z.phase)) * 1.6 : 1;
        z.z += z.speed * dt * hop;
        z.x += (z.laneX - z.x) * Math.min(1, dt * 0.8) + Math.sin(z.phase * 0.7) * dt * 0.15;
        z.phase += (dt * z.speed * (z.rig === 'blob' ? 2.2 : 2.6)) / z.scale;
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

      if (z.dmgAcc > 0) {
        z.dmgT -= dt;
        if (z.dmgT <= 0) {
          game.ui.overlay.damageNumber(z.x, this.aimY(z) + 0.9 * z.scale, z.z, z.dmgAcc, z.crit);
          z.dmgAcc = 0;
          z.crit = false;
          z.dmgT = z.isBoss ? 0.4 : 0.22;
        }
      }
    }
    list.sort((a, b) => b.z - a.z);
  }

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
    for (const k in this.renderers) this.renderers[k].begin();
    const t = this.game.time;
    for (const z of this.list) {
      const R = this.renderers[z.type];
      if (!R) continue;
      const s = z.scale;
      let sc = s;
      let tilt = 0;
      let sink = 0;
      let yaw = Math.sin(z.phase * 0.5) * 0.12;
      let bob = 0;
      let sx = 1;
      let sy = 1;
      const k = z.dying ? Math.min(1, z.deathT / 0.3) : 0;
      if (z.dying) {
        sink = Math.max(0, z.deathT - 0.35) * 2.2 * s;
        sc = s * (1 - Math.max(0, z.deathT - 0.45) * 3.2);
        yaw = z.deathDir * k * 0.5;
      }
      if (sc <= 0.01) continue;
      if (z.spawnT < 0.35) sc *= z.spawnT / 0.35;
      const f = z.flash > 0 ? 2.6 : z.tint;
      const cr = f;
      const cg = f;
      const cb = f;

      if (z.rig === 'blob') {
        // hop + squash & stretch
        const h = Math.max(0, Math.sin(z.phase));
        bob = z.state === 'walk' ? h * 0.9 * s : Math.abs(Math.sin(t * 6 + z.phase)) * 0.25 * s;
        const squash = z.state === 'walk' ? (h < 0.15 ? 1 - (0.15 - h) * 2 : 1 + h * 0.12) : 1 + Math.sin(t * 12 + z.phase) * 0.08;
        sy = squash;
        sx = 1 / Math.sqrt(Math.max(0.5, squash));
        if (z.dying) {
          sy = Math.max(0.05, 1 - k * 0.9);
          sx = 1 + k * 0.6;
        }
        _e.set(0, yaw, 0);
        _q.setFromEuler(_e);
        _p.set(z.x, bob - sink, z.z);
        _s.set(sc * sx, sc * sy, sc * sx);
        _root.compose(_p, _q, _s);
        R.put('body', _root, cr, cg, cb);
        continue;
      }

      if (z.rig === 'ghost') {
        bob = 0.45 + Math.sin(t * 3 + z.phase) * 0.18;
        _e.set(0.15 + (z.dying ? -k * 0.8 : 0), yaw, Math.sin(t * 2 + z.phase) * 0.1);
        _q.setFromEuler(_e);
        _p.set(z.x, (bob + (z.dying ? z.deathT * 3 : 0)) * s, z.z);
        _s.set(sc, sc, sc);
        _root.compose(_p, _q, _s);
        R.put('body', _root, cr, cg, cb);
        const wave = Math.sin(t * 5 + z.phase) * 0.25;
        for (const side of [-1, 1]) {
          _e.set(-1.3 + wave * side, 0, side * 0.15);
          this._local(0.62 * side, 1.05, 0.1, _e, 1);
          _m.multiplyMatrices(_root, _local);
          R.put('arm', _m, cr, cg, cb);
        }
        continue;
      }

      // humanoid
      let legA = 0;
      let armA = -1.35;
      let armB = -1.35;
      let lean = 0.08;
      if (z.dying) {
        tilt = -k * 1.45;
        armA = armB = -1.35 - k * 1.2;
      } else if (z.state === 'walk') {
        legA = Math.sin(z.phase) * 0.7;
        armA = -1.35 + Math.sin(z.phase + 1.2) * 0.16;
        armB = -1.35 - Math.sin(z.phase + 1.2) * 0.16;
        bob = Math.abs(Math.cos(z.phase)) * 0.08 * s;
      } else {
        const a = Math.sin(t * 9 + z.phase);
        armA = -1.9 + a * 0.6;
        armB = -1.9 - a * 0.6;
        lean = 0.22 + a * 0.08;
        legA = 0.15;
      }
      _e.set(tilt + lean, yaw, 0);
      _q.setFromEuler(_e);
      _p.set(z.x, bob - sink, z.z);
      _s.set(sc, sc, sc);
      _root.compose(_p, _q, _s);

      _e.set(0, 0, 0);
      this._local(0, HUMANOID.hipY, 0, _e, 1);
      _m.multiplyMatrices(_root, _local);
      R.put('torso', _m, cr, cg, cb);
      _e.set(-0.1 + (z.state === 'attack' ? 0.2 : 0), Math.sin(z.phase * 0.35) * 0.2, Math.sin(z.phase * 0.5) * 0.1);
      this._local(0, HUMANOID.neckY, 0.02, _e, 1);
      _m.multiplyMatrices(_root, _local);
      R.put('head', _m, cr, cg, cb);
      _e.set(armA, 0, 0.1);
      this._local(-HUMANOID.armX, HUMANOID.shoulderY, 0, _e, 1);
      _m.multiplyMatrices(_root, _local);
      R.put('arm', _m, cr, cg, cb);
      _e.set(armB, 0, -0.1);
      this._local(HUMANOID.armX, HUMANOID.shoulderY, 0, _e, 1);
      _m.multiplyMatrices(_root, _local);
      R.put('arm', _m, cr, cg, cb);
      _e.set(legA, 0, 0);
      this._local(-HUMANOID.legX, HUMANOID.hipY, 0, _e, 1);
      _m.multiplyMatrices(_root, _local);
      R.put('leg', _m, cr, cg, cb);
      _e.set(-legA, 0, 0);
      this._local(HUMANOID.legX, HUMANOID.hipY, 0, _e, 1);
      _m.multiplyMatrices(_root, _local);
      R.put('leg', _m, cr, cg, cb);
    }
    for (const k in this.renderers) this.renderers[k].end();
  }

  _local(x, y, z, euler, s) {
    _q.setFromEuler(euler);
    _p.set(x, y, z);
    _s.set(s, s, s);
    _local.compose(_p, _q, _s);
  }
}
