// 2D canvas drawn over the 3D view: damage numbers, floating texts, coins that
// fly into the HUD counter and small zombie health bars.

import * as THREE from 'three';
import { fmt } from '../util/format.js';

const _v = new THREE.Vector3();
const INK = '#2b1d3a';

export class Overlay2D {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.items = [];
    this.coins = [];
    this.target = { x: 40, y: 40 };
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    const w = this.game.width || window.innerWidth;
    const h = this.game.height || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.w = w;
    this.h = h;
  }

  project(x, y, z) {
    _v.set(x, y, z).project(this.game.camera);
    if (_v.z > 1) return null;
    return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h };
  }

  damageNumber(x, y, z, amount, crit) {
    if (!this.game.settings.dmgNumbers) return;
    if (this.items.length > 70) return;
    const p = this.project(x + (Math.random() - 0.5) * 0.6, y, z);
    if (!p) return;
    this.items.push({
      kind: 'dmg', x: p.x, y: p.y, vx: (Math.random() - 0.5) * 30, vy: -70, t: 0, life: crit ? 0.95 : 0.7,
      text: fmt(amount), color: crit ? '#ffd23f' : '#ffffff', size: crit ? 26 : 18, crit,
    });
  }

  floatText(x, y, z, text, color = '#ffd23f', scale = 1) {
    if (this.items.length > 90) return;
    const p = this.project(x, y, z);
    if (!p) return;
    this.items.push({ kind: 'txt', x: p.x, y: p.y, vx: 0, vy: -55, t: 0, life: 1.0, text, color, size: 20 * scale });
  }

  floatScreen(x, y, text, color, size = 28, life = 1.2) {
    this.items.push({ kind: 'txt', x, y, vx: 0, vy: -60, t: 0, life, text, color, size });
  }

  setTarget(x, y) {
    this.target.x = x;
    this.target.y = y;
  }

  coinFlyWorld(x, y, z, n = 1) {
    const p = this.project(x, y, z);
    if (!p) return;
    for (let i = 0; i < n; i++) this._coin(p.x + (Math.random() - 0.5) * 30, p.y + (Math.random() - 0.5) * 30, i * 0.03);
  }

  coinBurstScreen(n = 20) {
    for (let i = 0; i < n; i++) this._coin(this.w / 2 + (Math.random() - 0.5) * 200, this.h / 2 + (Math.random() - 0.5) * 120, i * 0.025);
  }

  _coin(x, y, delay) {
    if (this.coins.length > 60) return;
    const cx = x + (Math.random() - 0.5) * 160;
    const cy = y - 80 - Math.random() * 120;
    this.coins.push({ sx: x, sy: y, cx, cy, t: -delay, dur: 0.55 + Math.random() * 0.25, spin: Math.random() * 6 });
  }

  update(dt) {
    const g = this.g;
    const dpr = this.dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    this._hpBars(g);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t >= it.life) {
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop();
        continue;
      }
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.vy += 60 * dt;
      const k = it.t / it.life;
      const pop = it.t < 0.12 ? 0.6 + (it.t / 0.12) * 0.7 : 1.3 - Math.min(0.3, (it.t - 0.12) * 2);
      const alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      g.globalAlpha = alpha;
      const size = Math.round(it.size * pop);
      g.font = `${size}px "Lilita One", sans-serif`;
      g.lineWidth = Math.max(3, size * 0.22);
      g.strokeStyle = INK;
      const text = it.crit ? it.text + '!' : it.text;
      g.strokeText(text, it.x, it.y);
      g.fillStyle = it.color;
      g.fillText(text, it.x, it.y);
    }
    g.globalAlpha = 1;

    // coins flying to the HUD counter
    const tx = this.target.x;
    const ty = this.target.y;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt;
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / c.dur);
      if (k >= 1) {
        this.coins[i] = this.coins[this.coins.length - 1];
        this.coins.pop();
        this.game.ui.coinArrived();
        continue;
      }
      const e = k * k;
      const a = 1 - e;
      // quadratic bezier: start -> control -> HUD
      const x = a * a * c.sx + 2 * a * e * c.cx + e * e * tx;
      const y = a * a * c.sy + 2 * a * e * c.cy + e * e * ty;
      const r = 11 * (1 - k * 0.35);
      const sq = Math.abs(Math.cos(c.spin + c.t * 12));
      g.save();
      g.translate(x, y);
      g.scale(0.35 + sq * 0.65, 1);
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fillStyle = '#ffd23f';
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = INK;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.55, 0, Math.PI * 2);
      g.strokeStyle = '#e0a21a';
      g.lineWidth = 2;
      g.stroke();
      g.restore();
    }
  }

  _hpBars(g) {
    const zs = this.game.zombies;
    for (const z of zs.list) {
      if (z.dying || z.isBoss || z.hpShow <= 0 || z.hp >= z.maxHp) continue;
      const p = this.project(z.x, 2.75 * z.scale, z.z);
      if (!p) continue;
      const w = 30 * Math.min(1.6, z.scale);
      const h = 5;
      const f = Math.max(0, z.hp / z.maxHp);
      g.globalAlpha = Math.min(1, z.hpShow * 2);
      g.fillStyle = INK;
      g.fillRect(p.x - w / 2 - 1.5, p.y - 1.5, w + 3, h + 3);
      g.fillStyle = f > 0.5 ? '#52e052' : f > 0.25 ? '#ffc62e' : '#ff4d5e';
      g.fillRect(p.x - w / 2, p.y, w * f, h);
    }
    g.globalAlpha = 1;
  }
}
