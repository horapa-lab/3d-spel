// Hypercasual "stand here" pad: fills up while the player stands on it, then
// triggers its action (repeats faster while you keep standing on it).

import { buildPad } from '../gfx/props.js';

export class Pad {
  constructor(game, { x, z, r, color, fill = 0.55, icon = null, onActivate, canActivate, onDenied }) {
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
    this.obj = buildPad(r, color, icon);
    this.obj.position.set(x, 0, z);
    game.scene.add(this.obj);
  }

  setPos(x, z) {
    this.x = x;
    this.z = z;
    this.obj.position.set(x, 0, z);
  }

  setVisible(v) {
    this.obj.visible = v;
    this.enabled = v;
  }

  update(dt) {
    if (this.enabled === false) return;
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

