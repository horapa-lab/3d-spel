// Keyboard + pointer input. Drag anywhere = floating joystick, tap = click.

export class Input {
  constructor(game, el) {
    this.game = game;
    this.el = el;
    this.keys = new Set();
    this.moveX = 0;
    this.moveZ = 0;
    this.joy = null; // { id, sx, sy, x, y, moved }
    this.hoverX = -1;
    this.hoverY = -1;
    this.joyEl = document.getElementById('joystick');
    this.knobEl = this.joyEl ? this.joyEl.querySelector('.knob') : null;

    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      game.onKey(e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this._endJoy();
    });

    el.addEventListener('pointerdown', (e) => {
      if (this.joy) return;
      el.setPointerCapture?.(e.pointerId);
      this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, t: performance.now() };
      game.onUserGesture();
    });
    el.addEventListener('pointermove', (e) => {
      this.hoverX = e.clientX;
      this.hoverY = e.clientY;
      if (!this.joy || e.pointerId !== this.joy.id) return;
      this.joy.x = e.clientX;
      this.joy.y = e.clientY;
      const d = Math.hypot(this.joy.x - this.joy.sx, this.joy.y - this.joy.sy);
      if (d > 12 && !this.joy.moved) {
        this.joy.moved = true;
        this._showJoy(true);
      }
      this._updateJoyVisual();
    });
    const up = (e) => {
      if (!this.joy || e.pointerId !== this.joy.id) return;
      const j = this.joy;
      this._endJoy();
      if (!j.moved && performance.now() - j.t < 600) game.onTap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => {
      this.hoverX = -1;
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _endJoy() {
    this.joy = null;
    this._showJoy(false);
  }

  _showJoy(on) {
    if (!this.joyEl) return;
    this.joyEl.style.display = on ? 'block' : 'none';
    if (on && this.joy) {
      this.joyEl.style.left = this.joy.sx + 'px';
      this.joyEl.style.top = this.joy.sy + 'px';
    }
  }

  _updateJoyVisual() {
    if (!this.knobEl || !this.joy) return;
    const R = 46;
    let dx = this.joy.x - this.joy.sx;
    let dy = this.joy.y - this.joy.sy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx *= R / d;
      dy *= R / d;
    }
    this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  update() {
    let x = 0;
    let z = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
    if (this.joy && this.joy.moved) {
      const dx = this.joy.x - this.joy.sx;
      const dy = this.joy.y - this.joy.sy;
      const d = Math.hypot(dx, dy);
      const m = Math.min(1, d / 46);
      if (d > 4) {
        x += (dx / d) * m;
        z += (dy / d) * m;
      }
    }
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    this.moveX = x;
    this.moveZ = z;
  }
}
