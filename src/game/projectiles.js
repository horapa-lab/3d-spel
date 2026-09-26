// Bullets, rockets, grenades, plasma, rainbow bolts, nukes and black holes.

import * as THREE from 'three';
import { Kit } from '../gfx/kit.js';
import { rand } from '../util/math.js';

const _c = new THREE.Color();
const RAINBOW = [0xff4d4d, 0xff9f1a, 0xffe14d, 0x5ee65e, 0x4db8ff, 0xa66bff].map((h) => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
});
const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);

function rocketModel(big = false) {
  const k = new Kit();
  const s = big ? 1.9 : 1;
  k.cyl(0.14 * s, 0.7 * s, big ? 0x9aa3ad : 0x6b7a3a, 0, 0, 0, { m: big ? 'metal' : 'solid' });
  k.cone(0.14 * s, 0.32 * s, big ? 0xffc62e : 0xe53935, 0, 0, 0.51 * s);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    k.box(0.02, 0.18 * s, 0.22 * s, 0x2c3139, Math.cos(a) * 0.14 * s, Math.sin(a) * 0.14 * s, -0.32 * s, { rz: a + Math.PI / 2 });
  }
  if (big) k.cyl(0.145 * s, 0.1, 0x1d2026, 0, 0, 0.1);
  return k.build({ shadows: false });
}

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.vortexes = [];
    const scene = game.scene;
    this.rocketPool = [];
    this.nukePool = [];
    const rTmpl = rocketModel(false);
    const nTmpl = rocketModel(true);
    for (let i = 0; i < 40; i++) {
      const m = rTmpl.clone();
      m.visible = false;
      scene.add(m);
      this.rocketPool.push(m);
    }
    for (let i = 0; i < 6; i++) {
      const m = nTmpl.clone();
      m.visible = false;
      scene.add(m);
      this.nukePool.push(m);
    }
    this.grenadePool = [];
    const gGeo = new THREE.SphereGeometry(0.2, 10, 8);
    const gMat = new THREE.MeshStandardMaterial({ color: 0x4c5628, roughness: 0.5 });
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(gGeo, gMat);
      m.visible = false;
      scene.add(m);
      this.grenadePool.push(m);
    }
    this.holePool = [];
    const hGeo = new THREE.SphereGeometry(1, 20, 14);
    const hMat = new THREE.MeshBasicMaterial({ color: 0x050008 });
    const diskGeo = new THREE.RingGeometry(1.1, 2.4, 40);
    diskGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(hGeo, hMat);
      const disk = new THREE.Mesh(
        diskGeo,
        new THREE.MeshBasicMaterial({ color: 0xb26bff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
      );
      disk.rotation.x = 0.35;
      g.add(core, disk);
      g.userData.disk = disk;
      g.visible = false;
      scene.add(g);
      this.holePool.push(g);
    }
  }

  _take(pool) {
    const m = pool.find((o) => !o.visible);
    if (m) m.visible = true;
    return m || null;
  }

  /** Called by guns. m = muzzle world position. */
  fire(w, stats, mx, my, mz, target, crit) {
    const zs = this.game.zombies;
    const dmg = stats.dmg * (crit ? stats.critMult : 1);
    const ty = zs.aimY(target);
    _c.set(w.tracer || 0xffe08a);
    const col = [_c.r, _c.g, _c.b];
    switch (w.fire) {
      case 'bullet':
      case 'plasma': {
        const pierce = w.pierce || 0;
        const p = {
          kind: w.fire, x: mx, y: my, z: mz, speed: w.speed, dmg, crit, target, tuid: target.uid,
          pierce, hit: pierce ? new Set() : null, life: 2.2, col, width: w.width || 0.08, len: w.len || 1.2,
          aoe: w.aoe || 0, straight: pierce > 0,
        };
        if (p.straight) this._aimStraight(p, target, ty, 1.0);
        else target.incoming += dmg;
        this.list.push(p);
        break;
      }
      case 'rainbow': {
        const p = {
          kind: 'rainbow', x: mx, y: my, z: mz, speed: w.speed, dmg, crit, target, tuid: target.uid,
          pierce: w.pierce || 0, hit: new Set(), life: 2.2, col: RAINBOW[Math.floor(Math.random() * 6)],
          width: w.width, len: w.len, straight: true, ci: Math.floor(Math.random() * 6),
        };
        this._aimStraight(p, target, ty, 1.0);
        this.list.push(p);
        break;
      }
      case 'pellet': {
        const n = w.pellets;
        for (let i = 0; i < n; i++) {
          const p = {
            kind: 'pellet', x: mx, y: my, z: mz, speed: w.speed * rand(0.9, 1.1), dmg, crit, target, tuid: target.uid,
            pierce: 0, hit: null, life: 0.9, col, width: w.width, len: w.len, straight: true,
          };
          const sp = w.spread || 1;
          this._aimStraight(p, target, ty, 1.0, rand(-sp, sp), rand(-sp, sp) * 0.6);
          this.list.push(p);
        }
        break;
      }
      case 'rocket': {
        const mesh = this._take(this.rocketPool);
        this.list.push({
          kind: 'rocket', x: mx, y: my, z: mz, speed: w.speed, dmg, crit, target, tuid: target.uid, tx: target.x, ty, tz: target.z,
          aoe: w.aoe, life: 3, mesh, trail: 0, col,
        });
        target.incoming += dmg;
        break;
      }
      case 'grenade':
      case 'nuke':
      case 'vortex': {
        const lead = w.fire === 'vortex' ? 0 : 1;
        const dist = Math.hypot(target.x - mx, target.z - mz);
        const dur = Math.max(0.45, dist / w.speed);
        const moving = target.state === 'walk' && !target.dying;
        const tz = target.z + (moving ? target.speed * dur * lead : 0);
        const mesh = w.fire === 'grenade' ? this._take(this.grenadePool) : w.fire === 'nuke' ? this._take(this.nukePool) : null;
        this.list.push({
          kind: w.fire, x: mx, y: my, z: mz, sx: mx, sy: my, sz: mz, ex: target.x, ez: tz, ey: 0.3,
          t: 0, dur, arc: w.fire === 'nuke' ? 9 : w.fire === 'grenade' ? 2.6 : 1.2, dmg, crit, aoe: w.aoe,
          mesh, trail: 0, col, w,
        });
        break;
      }
      default:
        break;
    }
  }

  _aimStraight(p, target, ty, lead = 1, offX = 0, offZ = 0) {
    const dist = Math.hypot(target.x - p.x, target.z - p.z);
    const tt = dist / p.speed;
    const tz = target.z + (target.state === 'walk' ? target.speed * tt * lead : 0) + offZ;
    const tx = target.x + offX;
    _dir.set(tx - p.x, ty - p.y, tz - p.z).normalize();
    p.vx = _dir.x * p.speed;
    p.vy = _dir.y * p.speed;
    p.vz = _dir.z * p.speed;
  }

  update(dt) {
    const game = this.game;
    const zs = game.zombies;
    const fx = game.fx;
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      let dead = false;
      if (p.kind === 'bullet' || p.kind === 'plasma') {
        if (p.straight) dead = this._moveStraight(p, dt);
        else dead = this._moveHoming(p, dt);
      } else if (p.kind === 'pellet' || p.kind === 'rainbow') {
        dead = this._moveStraight(p, dt);
      } else if (p.kind === 'rocket') {
        dead = this._moveRocket(p, dt);
      } else {
        dead = this._moveArc(p, dt);
      }
      if (dead) {
        if (p.mesh) p.mesh.visible = false;
        list[i] = list[list.length - 1];
        list.pop();
      }
    }
    this._updateVortexes(dt);
    void fx;
    void zs;
  }

  _drawTracer(p, dx, dy, dz) {
    const len = p.len;
    const w = p.width;
    const c = p.col;
    this.game.fx.streaks.push(p.x - dx * len, p.y - dy * len, p.z - dz * len, p.x, p.y, p.z, w, c[0] * 1.6, c[1] * 1.6, c[2] * 1.6);
    if (p.kind === 'plasma' || p.kind === 'rainbow') {
      this.game.fx.streaks.push(p.x - dx * len * 0.6, p.y - dy * len * 0.6, p.z - dz * len * 0.6, p.x, p.y, p.z, w * 0.45, 1.4, 1.4, 1.4);
    }
  }

  _moveHoming(p, dt) {
    const zs = this.game.zombies;
    const t = p.target;
    const alive = t && t.uid === p.tuid && !t.dying;
    p.life -= dt;
    if (alive) {
      const ty = zs.aimY(t);
      const dx = t.x - p.x;
      const dy = ty - p.y;
      const dz = t.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      const step = p.speed * dt;
      if (d <= step + zs.radius(t) * 0.5) {
        t.incoming = Math.max(0, t.incoming - p.dmg);
        p.x = t.x;
        p.y = ty;
        p.z = t.z;
        this._impact(p, t);
        return true;
      }
      p.vx = (dx / d) * p.speed;
      p.vy = (dy / d) * p.speed;
      p.vz = (dz / d) * p.speed;
    } else if (t && t.uid === p.tuid) {
      t.incoming = Math.max(0, t.incoming - p.dmg);
      p.target = null;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const inv = 1 / p.speed;
    this._drawTracer(p, p.vx * inv, p.vy * inv, p.vz * inv);
    if (p.y < 0.05) {
      this.game.fx.hit(p.x, 0.1, p.z, 0xd8c9a8);
      return true;
    }
    return p.life <= 0;
  }

  _moveStraight(p, dt) {
    const zs = this.game.zombies;
    p.life -= dt;
    const x0 = p.x;
    const z0 = p.z;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const inv = 1 / p.speed;
    if (p.kind === 'rainbow') {
      p.ci = (p.ci + dt * 12) % 6;
      p.col = RAINBOW[Math.floor(p.ci)];
      if (Math.random() < 0.5) this.game.fx.rainbowTrail(p.x, p.y, p.z);
    }
    this._drawTracer(p, p.vx * inv, p.vy * inv, p.vz * inv);
    // swept collision in XZ
    const sx = p.x - x0;
    const sz = p.z - z0;
    const len2 = sx * sx + sz * sz || 1e-6;
    for (const t of zs.list) {
      if (t.dying) continue;
      if (p.hit && p.hit.has(t.uid)) continue;
      const r = zs.radius(t) + 0.15;
      // quick reject
      if (Math.abs(t.z - p.z) > Math.abs(sz) + r + 1) continue;
      const u = Math.max(0, Math.min(1, ((t.x - x0) * sx + (t.z - z0) * sz) / len2));
      const cx = x0 + sx * u - t.x;
      const cz = z0 + sz * u - t.z;
      if (cx * cx + cz * cz > r * r) continue;
      if (p.y > zs.aimY(t) * 1.9 + 0.5) continue;
      this._impact(p, t);
      if (p.pierce > 0 && p.hit) {
        p.hit.add(t.uid);
        p.pierce--;
        continue;
      }
      return true;
    }
    if (p.y < 0.05) {
      this.game.fx.hit(p.x, 0.1, p.z, 0xd8c9a8);
      return true;
    }
    return p.life <= 0 || p.z < -80;
  }

  _impact(p, t) {
    const game = this.game;
    const zs = game.zombies;
    const knock = p.kind === 'pellet' ? 0.25 : p.dmg > 0 ? 0.08 : 0;
    const col = p.kind === 'plasma' ? 0xe07bff : p.kind === 'rainbow' ? 0xffffff : 0xffe08a;
    game.fx.hit(p.x, p.y, p.z, col, p.kind !== 'pellet' && p.width > 0.11);
    if (p.aoe) {
      const r = p.aoe;
      game.fx.glow.spawn(p.x, p.y, p.z, 0, 0, 0, 0.18, r * 1.4, r * 2.2, 0xd46bff, 0.9);
      zs.forEachInRadius(p.x, p.z, r, (z) => zs.damage(z, z === t ? p.dmg : p.dmg * 0.5, { crit: p.crit, knock: 0.1 }));
    } else {
      zs.damage(t, p.dmg, { crit: p.crit, knock });
    }
  }

  _moveRocket(p, dt) {
    const zs = this.game.zombies;
    const fx = this.game.fx;
    p.life -= dt;
    const t = p.target;
    if (t && t.uid === p.tuid && !t.dying) {
      p.tx = t.x;
      p.ty = zs.aimY(t);
      p.tz = t.z;
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dz = p.tz - p.z;
    const d = Math.hypot(dx, dy, dz);
    const step = p.speed * dt;
    if (d <= step + 0.4 || p.life <= 0) {
      if (t && t.uid === p.tuid) t.incoming = Math.max(0, t.incoming - p.dmg);
      this.explode(p.tx, p.tz, p.aoe, p.dmg, p.crit, 0xff8a1f);
      return true;
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    p.z += (dz / d) * step;
    if (p.mesh) {
      p.mesh.position.set(p.x, p.y, p.z);
      _dir.set(dx / d, dy / d, dz / d);
      _q.setFromUnitVectors(Z, _dir);
      p.mesh.quaternion.copy(_q);
    }
    p.trail -= dt;
    if (p.trail <= 0) {
      p.trail = 0.025;
      fx.smoke.spawn(p.x - (dx / d) * 0.4, p.y, p.z - (dz / d) * 0.4, rand(-0.3, 0.3), rand(0.2, 0.6), rand(-0.3, 0.3), 0.7, 0.3, 1.1, 0xe6e0d6, 0.6, { drag: 2 });
      fx.glow.spawn(p.x - (dx / d) * 0.45, p.y, p.z - (dz / d) * 0.45, 0, 0, 0, 0.06, 0.7, 0.3, 0xffb347, 1);
    }
    return false;
  }

  _moveArc(p, dt) {
    const fx = this.game.fx;
    p.t += dt / p.dur;
    const k = Math.min(1, p.t);
    const x = p.sx + (p.ex - p.sx) * k;
    const z = p.sz + (p.ez - p.sz) * k;
    const y = p.sy + (p.ey - p.sy) * k + Math.sin(k * Math.PI) * p.arc;
    const vx = x - p.x;
    const vy = y - p.y;
    const vz = z - p.z;
    p.x = x;
    p.y = y;
    p.z = z;
    if (p.mesh) {
      p.mesh.position.set(x, y, z);
      const l = Math.hypot(vx, vy, vz);
      if (l > 1e-5) {
        _dir.set(vx / l, vy / l, vz / l);
        _q.setFromUnitVectors(Z, _dir);
        p.mesh.quaternion.copy(_q);
      }
    }
    p.trail -= dt;
    if (p.trail <= 0) {
      p.trail = p.kind === 'nuke' ? 0.02 : 0.04;
      if (p.kind === 'grenade') fx.smoke.spawn(x, y, z, 0, 0.3, 0, 0.45, 0.2, 0.6, 0xcfd8c0, 0.5);
      else if (p.kind === 'nuke') {
        fx.smoke.spawn(x, y, z, rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), 1.2, 0.6, 2.4, 0xdedad2, 0.7, { drag: 1.5 });
        fx.glow.spawn(x, y, z, 0, 0, 0, 0.08, 1.4, 0.6, 0xb6ff4a, 1);
      } else {
        fx.glow.spawn(x, y, z, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.35, 1.2, 0.2, 0xb26bff, 1);
        fx.spark.spawn(x, y, z, rand(-2, 2), rand(-2, 2), rand(-2, 2), 0.3, 0.5, 0.05, 0xffffff, 1);
      }
    }
    if (p.kind === 'vortex') fx.glow.spawn(x, y, z, 0, 0, 0, 0.05, 1.6, 1.4, 0x9c4dff, 0.8);
    if (k >= 1) {
      if (p.kind === 'grenade') this.explode(x, z, p.aoe, p.dmg, p.crit, 0x9adf5a);
      else if (p.kind === 'nuke') this.nuke(x, z, p.aoe, p.dmg, p.crit);
      else this.openVortex(x, z, p.w, p.dmg);
      return true;
    }
    return false;
  }

  explode(x, z, radius, dmg, crit, color) {
    const game = this.game;
    const zs = game.zombies;
    game.fx.explosion(x, 0.4, z, radius, color);
    game.shake(Math.min(0.35, 0.08 + radius * 0.03));
    game.audio.play('explosion', { vol: 0.6, x, z });
    zs.forEachInRadius(x, z, radius, (t, d) => {
      const f = 1 - Math.min(1, d / (radius + 0.5)) * 0.5;
      zs.damage(t, dmg * f, { crit, knock: 0.6, fromX: x });
    });
  }

  nuke(x, z, radius, dmg, crit) {
    const game = this.game;
    const zs = game.zombies;
    game.fx.nukeBlast(x, z, radius);
    game.shake(1.1);
    game.flash(0.3, '#ffffff', true);
    game.audio.play('nuke');
    zs.forEachInRadius(x, z, radius, (t) => zs.damage(t, dmg, { crit, knock: 1.5, fromX: x }));
  }

  openVortex(x, z, w, dps) {
    const mesh = this._take(this.holePool);
    this.vortexes.push({ x, z, t: 0, dur: w.dur, r: w.aoe, dps, mesh });
    this.game.audio.play('vortex');
    this.game.shake(0.2);
  }

  _updateVortexes(dt) {
    const game = this.game;
    const zs = game.zombies;
    for (let i = this.vortexes.length - 1; i >= 0; i--) {
      const v = this.vortexes[i];
      v.t += dt;
      const k = v.t / v.dur;
      const grow = Math.min(1, v.t * 4) * (k > 0.85 ? (1 - k) / 0.15 : 1);
      if (v.mesh) {
        v.mesh.position.set(v.x, 1.6, v.z);
        v.mesh.scale.setScalar(0.1 + grow * 1.0);
        v.mesh.userData.disk.rotation.y += dt * 6;
        v.mesh.userData.disk.rotation.z = Math.sin(v.t * 2) * 0.2;
      }
      zs.forEachInRadius(v.x, v.z, v.r, (t) => {
        t.pull = v;
        zs.damage(t, v.dps * dt, { fromX: v.x });
      });
      // spiral particles
      for (let n = 0; n < 3; n++) {
        const a = Math.random() * Math.PI * 2;
        const r = v.r * (0.6 + Math.random() * 0.5);
        const px = v.x + Math.cos(a) * r;
        const pz = v.z + Math.sin(a) * r;
        game.fx.glow.spawn(px, 0.6 + Math.random() * 2.5, pz, (v.x - px) * 1.4 - Math.sin(a) * 5, 0, (v.z - pz) * 1.4 + Math.cos(a) * 5, 0.5, 0.7, 0.1, n ? 0xb26bff : 0xff7bf3, 0.9, { drag: 0.5 });
      }
      if (v.t >= v.dur) {
        if (v.mesh) v.mesh.visible = false;
        game.fx.glow.spawn(v.x, 1.6, v.z, 0, 0, 0, 0.3, 2, 8, 0xd9a6ff, 1);
        game.fx.rings.spawn(v.x, 0.2, v.z, 0.5, v.r * 1.4, 0xb26bff, 0.5);
        this.vortexes.splice(i, 1);
      }
    }
  }

  clear() {
    for (const p of this.list) if (p.mesh) p.mesh.visible = false;
    this.list.length = 0;
    for (const v of this.vortexes) if (v.mesh) v.mesh.visible = false;
    this.vortexes.length = 0;
  }
}

export { UP };
