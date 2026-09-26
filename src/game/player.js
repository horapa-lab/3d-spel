// The little commander you walk around the base with.

import * as THREE from 'three';
import { buildPlayerModel } from '../gfx/characters.js';
import { angleDiff, damp } from '../util/math.js';
import * as L from './layout.js';

const SPEED = 8.5;
const RADIUS = 0.45;

// Solid things in the plaza (axis aligned boxes: cx, cz, half x, half z)
const OBSTACLES = [
  { x: L.CRATE_POS.x, z: L.CRATE_POS.z, hx: 2.3, hz: 1.2 },
  { x: L.LUCK_POS.x, z: L.LUCK_POS.z, hx: 0.8, hz: 0.6 },
  { x: L.VAULT_POS.x, z: L.VAULT_POS.z, hx: 0.8, hz: 0.7 },
];

export class Player {
  constructor(game) {
    this.game = game;
    const m = buildPlayerModel();
    this.m = m;
    this.obj = m.root;
    this.obj.position.set(L.PLAYER_START.x, 0, L.PLAYER_START.z);
    this.obj.rotation.y = Math.PI;
    game.scene.add(this.obj);
    this.vx = 0;
    this.vz = 0;
    this.phase = 0;
    this.yaw = Math.PI;
    this.target = null; // auto walk destination
    this.onArrive = null;
    this.moving = false;
    this.stepT = 0;
    this.lastX = L.PLAYER_START.x;
    this.lastZ = L.PLAYER_START.z;
    this.stuckT = 0;
    // ground marker for click-to-move
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    game.scene.add(ring);
    this.marker = ring;
  }

  get x() {
    return this.obj.position.x;
  }
  get z() {
    return this.obj.position.z;
  }

  walkTo(x, z, onArrive = null) {
    const [cx, cz] = L.clampWalkable(x, z);
    this.target = { x: cx, z: cz };
    this.onArrive = onArrive;
    this.marker.visible = true;
    this.marker.position.set(this.target.x, 0.06, this.target.z);
    this.marker.scale.setScalar(1.4);
  }

  update(dt) {
    const input = this.game.input;
    let ix = input.moveX;
    let iz = input.moveZ;
    const manual = Math.hypot(ix, iz) > 0.12;
    if (manual) {
      this.target = null;
      this.onArrive = null;
      this.marker.visible = false;
    } else if (this.target) {
      const dx = this.target.x - this.x;
      const dz = this.target.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.25 || (this.stuckT > 0.8)) {
        const cb = this.onArrive;
        this.target = null;
        this.onArrive = null;
        this.marker.visible = false;
        if (cb) cb();
      } else {
        const k = Math.min(1, d / 0.8);
        ix = (dx / d) * k;
        iz = (dz / d) * k;
      }
    }
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    this.vx = damp(this.vx, ix * SPEED, 14, dt);
    this.vz = damp(this.vz, iz * SPEED, 14, dt);
    const p = this.obj.position;
    p.x += this.vx * dt;
    p.z += this.vz * dt;
    for (const c of this.game.guns.colliders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const rr = c.r + RADIUS;
      if (d < rr && d > 1e-4) {
        p.x = c.x + (dx / d) * rr;
        p.z = c.z + (dz / d) * rr;
      }
    }
    const [wx, wz] = L.clampWalkable(p.x, p.z);
    p.x = wx;
    p.z = wz;
    for (const o of OBSTACLES) {
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const ox = o.hx + RADIUS - Math.abs(dx);
      const oz = o.hz + RADIUS - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    }

    // give up auto-walking when blocked (e.g. target behind an obstacle)
    const moved = Math.hypot(p.x - this.lastX, p.z - this.lastZ);
    this.stuckT = this.target && moved < 0.01 ? (this.stuckT || 0) + dt : 0;
    this.lastX = p.x;
    this.lastZ = p.z;
    const speed = Math.hypot(this.vx, this.vz);
    this.moving = speed > 0.6;
    if (this.moving) {
      const want = Math.atan2(this.vx, this.vz);
      this.yaw += angleDiff(this.yaw, want) * Math.min(1, dt * 14);
      this.phase += dt * speed * 1.5;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.28;
        this.game.fx.smoke.spawn(p.x, 0.1, p.z, 0, 0.3, 0, 0.4, 0.25, 0.7, 0xe8dcc8, 0.45);
      }
    } else {
      this.phase += dt * 2;
    }
    this.obj.rotation.y = this.yaw;
    const m = this.m;
    const k = Math.min(1, speed / SPEED);
    const sw = Math.sin(this.phase) * 0.85 * k;
    m.legL.rotation.x = sw;
    m.legR.rotation.x = -sw;
    m.armL.rotation.x = -sw * 0.9;
    m.armR.rotation.x = sw * 0.9;
    m.body.position.y = Math.abs(Math.cos(this.phase)) * 0.1 * k + (1 - k) * Math.sin(this.game.time * 2.2) * 0.02;
    m.head.rotation.z = Math.sin(this.phase * 0.5) * 0.05 * k;
    if (this.marker.visible) {
      this.marker.scale.setScalar(1 + Math.sin(this.game.time * 8) * 0.12);
    }
  }

  distTo(x, z) {
    return Math.hypot(this.x - x, this.z - z);
  }
}
