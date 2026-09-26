// High level visual effects built on the particle primitives.

import * as THREE from 'three';
import { Billboards, CubeBits, Streaks, RingPool } from '../gfx/particles.js';
import { rand } from '../util/math.js';

const RAINBOW = [0xff4d4d, 0xff9f1a, 0xffe14d, 0x5ee65e, 0x4db8ff, 0xa66bff];

export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.density = 1;
    this.glow = new Billboards(1100, { additive: true, shape: 0, renderOrder: 12 });
    this.smoke = new Billboards(600, { additive: false, shape: 1, renderOrder: 8 });
    this.spark = new Billboards(500, { additive: true, shape: 2, renderOrder: 13 });
    this.bits = new CubeBits(520, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial());
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.14, 14);
    coinGeo.rotateX(Math.PI / 2);
    this.coins = new CubeBits(140, coinGeo, new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.7, roughness: 0.3, emissive: 0x4a3000 }));
    this.streaks = new Streaks(1600);
    this.rings = new RingPool(scene, 20);
    for (const s of [this.glow, this.smoke, this.spark, this.bits, this.coins, this.streaks]) scene.add(s.mesh);
    this.flashT = 0;
  }

  setDensity(d) {
    this.density = d;
  }

  _n(n) {
    return Math.max(1, Math.round(n * this.density));
  }

  muzzle(x, y, z, dx, dz, color = 0xffd27a, size = 1) {
    this.glow.spawn(x, y, z, dx * 2, 0.3, dz * 2, 0.07, 0.9 * size, 1.4 * size, color, 1, { drag: 8 });
    this.glow.spawn(x + dx * 0.3, y, z + dz * 0.3, dx * 6, 0, dz * 6, 0.06, 0.5 * size, 0.2 * size, 0xffffff, 0.9, { drag: 8 });
    if (Math.random() < 0.5 * this.density) {
      this.smoke.spawn(x, y, z, dx * 1.5 + rand(-0.3, 0.3), 0.8, dz * 1.5 + rand(-0.3, 0.3), 0.5, 0.35 * size, 1.0 * size, 0xd9d4cc, 0.35, { drag: 3 });
    }
  }

  hit(x, y, z, color = 0xffe08a, big = false) {
    const n = this._n(big ? 6 : 3);
    for (let i = 0; i < n; i++) {
      this.spark.spawn(x, y, z, rand(-5, 5), rand(1, 6), rand(-5, 5), rand(0.12, 0.25), big ? 0.5 : 0.32, 0.05, color, 1, { drag: 4, grav: 10 });
    }
    this.glow.spawn(x, y, z, 0, 0, 0, 0.08, big ? 1.1 : 0.6, 0.2, color, 0.9);
  }

  goo(x, y, z, color, n = 8, speed = 5) {
    n = this._n(n);
    for (let i = 0; i < n; i++) {
      this.bits.spawn(x + rand(-0.3, 0.3), y + rand(-0.2, 0.4), z + rand(-0.3, 0.3), rand(-speed, speed), rand(2, speed + 3), rand(-speed, speed), rand(0.12, 0.26), color, rand(0.6, 1.1));
    }
    this.smoke.spawn(x, y, z, 0, 1, 0, 0.45, 0.8, 2.2, 0xe8f5d0, 0.5, { drag: 3 });
  }

  explosion(x, y, z, radius = 3, color = 0xff8a1f) {
    const n = this._n(10 + radius * 3);
    this.glow.spawn(x, y + 0.5, z, 0, 0, 0, 0.18, radius * 1.2, radius * 2.6, 0xfff2c0, 1);
    this.glow.spawn(x, y + 0.6, z, 0, 1, 0, 0.35, radius * 1.4, radius * 2.2, color, 0.9, { drag: 2 });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(3, 8) * (radius / 3);
      this.glow.spawn(x, y + 0.4, z, Math.cos(a) * sp, rand(2, 7), Math.sin(a) * sp, rand(0.25, 0.5), radius * 0.5, radius * 0.1, i % 3 ? color : 0xffe14d, 1, { drag: 3, grav: 4 });
      this.smoke.spawn(x + rand(-0.5, 0.5), y + 0.4, z + rand(-0.5, 0.5), Math.cos(a) * sp * 0.4, rand(1.5, 4), Math.sin(a) * sp * 0.4, rand(0.8, 1.5), radius * 0.35, radius * 1.1, i % 2 ? 0x57514b : 0x8a8178, 0.7, { drag: 2 });
    }
    for (let i = 0; i < this._n(8); i++) {
      this.bits.spawn(x, y + 0.3, z, rand(-7, 7), rand(4, 11), rand(-7, 7), rand(0.14, 0.3), i % 2 ? 0x3b3530 : 0x6b5e52, rand(0.6, 1.2));
    }
    this.rings.spawn(x, 0.15, z, 0.3, radius * 1.3, color, 0.45);
  }

  nukeBlast(x, z, radius) {
    this.glow.spawn(x, 2, z, 0, 0, 0, 0.5, radius * 2, radius * 5, 0xffffff, 1);
    this.glow.spawn(x, 3, z, 0, 2, 0, 1.4, radius * 1.5, radius * 3, 0xffb347, 1, { drag: 1 });
    for (let i = 0; i < this._n(40); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(6, 18);
      this.glow.spawn(x, 1, z, Math.cos(a) * sp, rand(1, 6), Math.sin(a) * sp, rand(0.5, 1.1), 3, 0.5, i % 2 ? 0xff7a1a : 0xffe14d, 1, { drag: 2.5 });
    }
    // mushroom cloud
    for (let i = 0; i < this._n(26); i++) {
      const h = rand(0, 1);
      this.smoke.spawn(x + rand(-1, 1), 1 + h * 2, z + rand(-1, 1), rand(-0.5, 0.5), 6 + h * 5, rand(-0.5, 0.5), rand(1.8, 2.6), 2.5, 7, h > 0.5 ? 0xffa45c : 0x7a6a5e, 0.75, { drag: 1.2 });
    }
    for (let i = 0; i < this._n(16); i++) {
      const a = (i / 16) * Math.PI * 2;
      this.smoke.spawn(x, 7, z, Math.cos(a) * 6, 5.5, Math.sin(a) * 6, 2.2, 3, 7, 0xb36b3c, 0.7, { drag: 1.3 });
    }
    this.rings.spawn(x, 0.2, z, 1, radius * 2.2, 0xfff2c0, 0.9);
    this.rings.spawn(x, 0.3, z, 0.5, radius * 1.4, 0xff8a1f, 0.7);
    this.flashT = 0.45;
  }

  smokePuff(x, y, z, size = 1, color = 0xd8d2c8) {
    this.smoke.spawn(x, y, z, rand(-0.4, 0.4), rand(0.4, 1.2), rand(-0.4, 0.4), rand(0.6, 1.0), size * 0.5, size * 1.6, color, 0.55, { drag: 2 });
  }

  dust(x, z, n = 6, color = 0xe0c090) {
    for (let i = 0; i < this._n(n); i++) {
      const a = Math.random() * Math.PI * 2;
      this.smoke.spawn(x + Math.cos(a) * 0.4, 0.3, z + Math.sin(a) * 0.4, Math.cos(a) * 3, rand(0.5, 1.5), Math.sin(a) * 3, rand(0.5, 0.9), 0.5, 1.6, color, 0.6, { drag: 3 });
    }
  }

  flame(x, y, z, dx, dz, spread) {
    for (let i = 0; i < 2; i++) {
      const sp = rand(14, 20);
      const ox = rand(-spread, spread);
      const vx = (dx - dz * ox) * sp;
      const vz = (dz + dx * ox) * sp;
      this.glow.spawn(x, y, z, vx, rand(0.5, 2), vz, rand(0.55, 0.8), 0.4, 2.4, i ? 0xff6a1a : 0xffc23a, 0.95, { drag: 2.2, grav: -2 });
    }
    if (Math.random() < 0.3 * this.density) {
      this.smoke.spawn(x + dx * 6, y + 1, z + dz * 6, dx * 4, 2.5, dz * 4, 1.0, 1, 3, 0x4a4040, 0.35, { drag: 2 });
    }
  }

  /** Jagged lightning between two points. */
  lightning(ax, ay, az, bx, by, bz, color = 0x6fe8ff, width = 0.12) {
    const segs = 7;
    let px = ax;
    let py = ay;
    let pz = az;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const j = i === segs ? 0 : 0.6;
      const nx = ax + (bx - ax) * t + rand(-j, j);
      const ny = ay + (by - ay) * t + rand(-j, j) * 0.6;
      const nz = az + (bz - az) * t + rand(-j, j);
      this.streaks.add(px, py, pz, nx, ny, nz, width, color, 0.16);
      this.streaks.add(px, py, pz, nx, ny, nz, width * 3, 0x1d5a70, 0.12);
      px = nx;
      py = ny;
      pz = nz;
    }
    this.glow.spawn(bx, by, bz, 0, 0, 0, 0.15, 1.4, 0.4, color, 1);
  }

  beam(ax, ay, az, bx, by, bz, color, width = 0.35, life = 0.35) {
    this.streaks.add(ax, ay, az, bx, by, bz, width, 0xffffff, life * 0.7);
    this.streaks.add(ax, ay, az, bx, by, bz, width * 2.6, color, life);
    const n = this._n(14);
    for (let i = 0; i < n; i++) {
      const t = Math.random();
      this.spark.spawn(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, rand(-1, 1), rand(0, 2), rand(-1, 1), rand(0.2, 0.5), 0.45, 0.05, color, 1, { drag: 2 });
    }
  }

  confetti(x, y, z, n = 40) {
    n = this._n(n);
    for (let i = 0; i < n; i++) {
      const col = RAINBOW[i % RAINBOW.length];
      this.bits.spawn(x + rand(-1, 1), y, z + rand(-1, 1), rand(-6, 6), rand(8, 15), rand(-6, 6), rand(0.16, 0.24), col, rand(1.4, 2.4), { grav: 9, bounce: 0.1, spin: 14, flat: true });
    }
  }

  coinBurst(x, y, z, n = 3) {
    n = Math.min(8, n);
    for (let i = 0; i < n; i++) {
      this.coins.spawn(x + rand(-0.2, 0.2), y, z + rand(-0.2, 0.2), rand(-2.5, 2.5), rand(6, 10), rand(-2.5, 2.5), 0.55, 0xffffff, rand(0.55, 0.75), { spin: 20, grav: 22, bounce: 0.3 });
    }
  }

  sparkleBurst(x, y, z, color, n = 16, speed = 6) {
    n = this._n(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = rand(-1, 1);
      this.spark.spawn(x, y, z, Math.cos(a) * speed, b * speed + 2, Math.sin(a) * speed, rand(0.4, 0.9), rand(0.5, 0.9), 0.05, color, 1, { drag: 2.5, grav: 3 });
    }
  }

  rainbowTrail(x, y, z) {
    const col = RAINBOW[Math.floor(Math.random() * RAINBOW.length)];
    this.spark.spawn(x, y, z, rand(-0.5, 0.5), rand(-0.2, 0.8), rand(-0.5, 0.5), 0.4, 0.45, 0.05, col, 1, { drag: 2 });
  }

  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    this.spark.update(dt);
    this.bits.update(dt);
    this.coins.update(dt);
    this.rings.update(dt);
    this.streaks.flush(dt);
    if (this.flashT > 0) this.flashT -= dt;
  }

  clearAll() {
    this.glow.clear();
    this.smoke.clear();
    this.spark.clear();
    this.bits.clear();
    this.coins.clear();
  }
}
