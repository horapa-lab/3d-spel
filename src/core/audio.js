// All sound is synthesized with WebAudio (no files to download): punchy gun
// shots, explosions, coins, crate fanfares and a small looping music track.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.sfxVol = 0.8;
    this.musicVol = 0.5;
    this.muted = false;
    this.last = {};
    this.window = { t: 0, n: 0 };
    this.music = { on: false, step: 0, next: 0, timer: null, bar: 0 };
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !this.muted) this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.2;
    this.master.connect(this.comp);
    this.comp.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    this.mus = c.createGain();
    this.mus.connect(this.master);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    this.startMusic();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : 1;
    this.sfx.gain.value = this.sfxVol * m;
    this.mus.gain.value = this.musicVol * 0.55 * m;
  }

  setVolumes(sfx, music) {
    this.sfxVol = sfx;
    this.musicVol = music;
    this.applyVolumes();
  }

  setMuted(m) {
    this.muted = m;
    this.applyVolumes();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) this.ctx.resume();
  }

  // ------------------------------------------------------------ primitives
  _out(pan = 0) {
    const c = this.ctx;
    if (!pan || !c.createStereoPanner) return this.sfx;
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    p.connect(this.sfx);
    return p;
  }

  _noise(t, { dur = 0.1, type = 'lowpass', f0 = 2000, f1 = 400, q = 0.8, gain = 0.4, attack = 0.002, out, rate = 1 }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = rate;
    const flt = c.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(out || this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  _tone(t, { type = 'sine', f0 = 440, f1 = null, dur = 0.1, gain = 0.3, attack = 0.004, out, release = null }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (release || dur));
    o.connect(g);
    g.connect(out || this.sfx);
    o.start(t);
    o.stop(t + (release || dur) + 0.05);
  }

  _ok(name, minGap) {
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < minGap) return false;
    this.last[name] = now;
    return true;
  }

  // ------------------------------------------------------------ gun shots
  shot(kind, x = 0) {
    if (!this.ctx || this.muted || this.sfxVol <= 0) return;
    const now = this.ctx.currentTime;
    if (now - this.window.t > 0.1) {
      this.window.t = now;
      this.window.n = 0;
    }
    if (this.window.n > 9) return;
    const gaps = { minigun: 0.05, smg: 0.045, lmg: 0.05, plasma: 0.05, flame: 0.13, rainbow: 0.06 };
    if (!this._ok('shot_' + kind, gaps[kind] || 0.035)) return;
    this.window.n++;
    const t = now + 0.001;
    const out = this._out(x / 14);
    const v = 0.9 + Math.random() * 0.2;
    switch (kind) {
      case 'pistol':
        this._noise(t, { dur: 0.09, f0: 3500, f1: 700, gain: 0.32, out, rate: v });
        this._tone(t, { type: 'square', f0: 220 * v, f1: 70, dur: 0.05, gain: 0.12, out });
        break;
      case 'revolver':
        this._noise(t, { dur: 0.18, f0: 2800, f1: 300, gain: 0.45, out });
        this._tone(t, { type: 'sine', f0: 160, f1: 45, dur: 0.12, gain: 0.35, out });
        break;
      case 'smg':
        this._noise(t, { dur: 0.05, type: 'bandpass', f0: 2600 * v, f1: 1200, q: 1.2, gain: 0.3, out });
        break;
      case 'shotgun':
        this._noise(t, { dur: 0.28, f0: 2000, f1: 200, gain: 0.55, out });
        this._tone(t, { type: 'sine', f0: 110, f1: 40, dur: 0.2, gain: 0.45, out });
        break;
      case 'rifle':
        this._noise(t, { dur: 0.1, type: 'bandpass', f0: 2000 * v, f1: 700, q: 0.9, gain: 0.4, out });
        this._tone(t, { type: 'triangle', f0: 150, f1: 50, dur: 0.07, gain: 0.25, out });
        break;
      case 'lmg':
        this._noise(t, { dur: 0.08, type: 'bandpass', f0: 1600 * v, f1: 500, q: 0.9, gain: 0.38, out });
        this._tone(t, { type: 'sine', f0: 120, f1: 50, dur: 0.06, gain: 0.25, out });
        break;
      case 'sniper':
        this._noise(t, { dur: 0.45, f0: 5000, f1: 150, gain: 0.5, out });
        this._tone(t, { type: 'sine', f0: 90, f1: 35, dur: 0.3, gain: 0.5, out });
        this._tone(t, { type: 'square', f0: 1800, f1: 400, dur: 0.04, gain: 0.08, out });
        break;
      case 'minigun':
        this._noise(t, { dur: 0.045, type: 'bandpass', f0: 1800 * v, f1: 900, q: 1.5, gain: 0.3, out });
        this._tone(t, { type: 'square', f0: 90, f1: 60, dur: 0.03, gain: 0.1, out });
        break;
      case 'launcher':
        this._tone(t, { type: 'sine', f0: 260, f1: 70, dur: 0.18, gain: 0.5, out });
        this._noise(t, { dur: 0.12, f0: 900, f1: 200, gain: 0.25, out });
        break;
      case 'rocket':
        this._noise(t, { dur: 0.55, type: 'bandpass', f0: 300, f1: 1800, q: 1.2, gain: 0.45, attack: 0.03, out });
        this._tone(t, { type: 'sine', f0: 120, f1: 50, dur: 0.25, gain: 0.35, out });
        break;
      case 'flame':
        this._noise(t, { dur: 0.2, f0: 900, f1: 500, gain: 0.22, attack: 0.03, out });
        break;
      case 'tesla':
        this._tone(t, { type: 'sawtooth', f0: 1400, f1: 180, dur: 0.16, gain: 0.16, out });
        this._noise(t, { dur: 0.14, type: 'highpass', f0: 3000, f1: 6000, gain: 0.25, out });
        break;
      case 'plasma':
        this._tone(t, { type: 'square', f0: 900 * v, f1: 260, dur: 0.07, gain: 0.1, out });
        break;
      case 'rail':
        this._tone(t, { type: 'sine', f0: 2400, f1: 90, dur: 0.45, gain: 0.35, out });
        this._noise(t, { dur: 0.35, type: 'bandpass', f0: 4000, f1: 300, gain: 0.35, out });
        break;
      case 'nuke':
        this._tone(t, { type: 'sine', f0: 200, f1: 60, dur: 0.4, gain: 0.4, out });
        this._noise(t, { dur: 0.7, type: 'bandpass', f0: 250, f1: 1400, gain: 0.4, attack: 0.05, out });
        break;
      case 'vortex':
        this._tone(t, { type: 'sine', f0: 600, f1: 120, dur: 0.35, gain: 0.25, out });
        break;
      case 'rainbow': {
        const n = [72, 74, 76, 79, 81][Math.floor(Math.random() * 5)];
        this._tone(t, { type: 'triangle', f0: NOTE(n), dur: 0.12, gain: 0.14, out });
        this._tone(t, { type: 'sine', f0: NOTE(n + 12), dur: 0.08, gain: 0.08, out });
        break;
      }
      default:
        this._noise(t, { dur: 0.08, f0: 3000, f1: 600, gain: 0.3, out });
    }
  }

  // ------------------------------------------------------------ effects
  play(name, o = {}) {
    if (!this.ctx || this.muted || this.sfxVol <= 0) return;
    const t = this.ctx.currentTime + 0.001;
    const out = o.x !== undefined ? this._out(o.x / 14) : this.sfx;
    switch (name) {
      case 'explosion':
        if (!this._ok(name, 0.06)) return;
        this._noise(t, { dur: 0.8, f0: 1200, f1: 80, gain: 0.7 * (o.vol || 1), out });
        this._tone(t, { type: 'sine', f0: 95, f1: 30, dur: 0.6, gain: 0.7 * (o.vol || 1), out });
        break;
      case 'nuke':
        this._noise(t, { dur: 2.6, f0: 600, f1: 40, gain: 0.9, attack: 0.02 });
        this._tone(t, { type: 'sine', f0: 60, f1: 22, dur: 2.2, gain: 0.9 });
        this._noise(t + 0.05, { dur: 1.2, type: 'highpass', f0: 3000, f1: 800, gain: 0.3 });
        break;
      case 'vortex':
        this._tone(t, { type: 'sine', f0: 300, f1: 35, dur: 1.4, gain: 0.5 });
        this._noise(t, { dur: 1.2, type: 'bandpass', f0: 2000, f1: 100, q: 3, gain: 0.3 });
        break;
      case 'splat':
        if (!this._ok(name, 0.05)) return;
        this._noise(t, { dur: 0.13, type: 'bandpass', f0: 700, f1: 250, q: 1.5, gain: 0.35, out });
        this._tone(t, { type: 'sine', f0: 240 + Math.random() * 60, f1: 70, dur: 0.1, gain: 0.2, out });
        break;
      case 'coin': {
        if (!this._ok(name, 0.045)) return;
        const p = 1 + (Math.random() - 0.5) * 0.1;
        this._tone(t, { type: 'sine', f0: 1318 * p, dur: 0.09, gain: 0.12 });
        this._tone(t + 0.05, { type: 'sine', f0: 1976 * p, dur: 0.14, gain: 0.1 });
        break;
      }
      case 'thud':
        if (!this._ok(name, 0.12)) return;
        this._tone(t, { type: 'sine', f0: 120, f1: 45, dur: 0.16, gain: 0.35 });
        this._noise(t, { dur: 0.12, f0: 500, f1: 150, gain: 0.25 });
        break;
      case 'crateShake':
        for (let i = 0; i < 9; i++) {
          const tt = t + i * 0.11;
          this._noise(tt, { dur: 0.07, type: 'bandpass', f0: 450 + i * 40, f1: 250, q: 2, gain: 0.25 + i * 0.03 });
        }
        break;
      case 'escalate': {
        const n = [67, 71, 74, 79, 83, 86, 91][Math.min(6, o.step || 0)];
        this._tone(t, { type: 'triangle', f0: NOTE(n), dur: 0.22, gain: 0.25 });
        this._tone(t, { type: 'sine', f0: NOTE(n + 12), dur: 0.18, gain: 0.1 });
        break;
      }
      case 'crateOpen': {
        const r = o.rarity || 0;
        this._noise(t, { dur: 0.5, type: 'highpass', f0: 2000, f1: 8000, gain: 0.25, attack: 0.02 });
        this._tone(t, { type: 'sine', f0: 90, f1: 40, dur: 0.3, gain: 0.5 });
        const chord = [60, 64, 67, 72, 76, 79, 84];
        const notes = 3 + Math.min(4, r);
        for (let i = 0; i < notes; i++) {
          const tt = t + 0.05 + i * (r >= 4 ? 0.09 : 0.07);
          this._tone(tt, { type: 'triangle', f0: NOTE(chord[i] + (r >= 3 ? 2 : 0)), dur: 0.5, gain: 0.2 });
          this._tone(tt, { type: 'square', f0: NOTE(chord[i] + 12), dur: 0.25, gain: 0.04 });
        }
        if (r >= 4) {
          for (let i = 0; i < 12; i++) this._tone(t + 0.6 + i * 0.04, { type: 'sine', f0: NOTE(84 + ((i * 5) % 12)), dur: 0.2, gain: 0.07 });
        }
        break;
      }
      case 'lidClose':
        this._tone(t, { type: 'sine', f0: 140, f1: 60, dur: 0.12, gain: 0.3 });
        this._noise(t, { dur: 0.1, f0: 800, f1: 200, gain: 0.2 });
        break;
      case 'land':
        this._tone(t, { type: 'sine', f0: 180, f1: 60, dur: 0.14, gain: 0.4 });
        this._noise(t, { dur: 0.08, type: 'highpass', f0: 2500, f1: 5000, gain: 0.2 });
        this._tone(t + 0.04, { type: 'triangle', f0: NOTE(84), dur: 0.12, gain: 0.12 });
        break;
      case 'buy':
        this._tone(t, { type: 'square', f0: NOTE(76), dur: 0.07, gain: 0.08 });
        this._tone(t + 0.07, { type: 'square', f0: NOTE(83), dur: 0.12, gain: 0.08 });
        this._tone(t, { type: 'sine', f0: 1976, dur: 0.18, gain: 0.1 });
        break;
      case 'deny':
        if (!this._ok(name, 0.3)) return;
        this._tone(t, { type: 'square', f0: 150, f1: 110, dur: 0.18, gain: 0.1 });
        break;
      case 'click':
        this._tone(t, { type: 'triangle', f0: 880, f1: 1200, dur: 0.05, gain: 0.12 });
        break;
      case 'wave':
        [60, 64, 67].forEach((n, i) => this._tone(t + i * 0.07, { type: 'triangle', f0: NOTE(n + 5), dur: 0.3, gain: 0.16 }));
        this._tone(t + 0.21, { type: 'triangle', f0: NOTE(77), dur: 0.5, gain: 0.18 });
        break;
      case 'boss':
        this._tone(t, { type: 'sawtooth', f0: 55, dur: 1.3, gain: 0.25, attack: 0.05 });
        this._tone(t, { type: 'sawtooth', f0: 82.4, dur: 1.3, gain: 0.18, attack: 0.05 });
        this._tone(t + 0.6, { type: 'sawtooth', f0: 51.9, dur: 1.2, gain: 0.25, attack: 0.05 });
        this._noise(t, { dur: 0.6, f0: 300, f1: 60, gain: 0.5 });
        break;
      case 'bossDown':
        this._noise(t, { dur: 1.0, f0: 1500, f1: 60, gain: 0.7 });
        [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this._tone(t + 0.2 + i * 0.08, { type: 'triangle', f0: NOTE(n), dur: 0.6, gain: 0.18 }));
        break;
      case 'breach':
        for (let i = 0; i < 4; i++) {
          this._tone(t + i * 0.22, { type: 'square', f0: i % 2 ? 520 : 740, dur: 0.18, gain: 0.12 });
        }
        this._noise(t, { dur: 0.8, f0: 900, f1: 60, gain: 0.6 });
        break;
      case 'levelup':
        [72, 76, 79, 84].forEach((n, i) => this._tone(t + i * 0.06, { type: 'square', f0: NOTE(n), dur: 0.14, gain: 0.07 }));
        break;
      case 'zone':
        this._noise(t, { dur: 1.2, type: 'bandpass', f0: 200, f1: 3000, q: 0.8, gain: 0.3, attack: 0.3 });
        [57, 64, 69, 73].forEach((n) => this._tone(t + 0.3, { type: 'triangle', f0: NOTE(n), dur: 1.4, gain: 0.1, attack: 0.1 }));
        break;
      case 'pop':
        this._tone(t, { type: 'sine', f0: 500, f1: 900, dur: 0.08, gain: 0.15 });
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------ music
  startMusic() {
    if (!this.ctx || this.music.on) return;
    this.music.on = true;
    this.music.next = this.ctx.currentTime + 0.1;
    this.music.step = 0;
    this.music.timer = setInterval(() => this._schedule(), 30);
  }

  _schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const m = this.music;
    const bpm = 116;
    const stepDur = 60 / bpm / 4;
    const prog = [
      [48, 52, 55, 60], // C
      [43, 47, 50, 55], // G
      [45, 48, 52, 57], // Am
      [41, 45, 48, 53], // F
    ];
    while (m.next < c.currentTime + 0.12) {
      const t = m.next;
      const s = m.step % 16;
      const bar = Math.floor(m.step / 16) % 4;
      const phrase = Math.floor(m.step / 64) % 4;
      const ch = prog[bar];
      const out = this.mus;
      if (this.musicVol > 0) {
        // drums
        if (s === 0 || s === 8 || (phrase === 3 && s === 10)) {
          this._tone(t, { type: 'sine', f0: 140, f1: 45, dur: 0.16, gain: 0.55, out });
        }
        if (s === 4 || s === 12) {
          this._noise(t, { dur: 0.12, type: 'highpass', f0: 1500, f1: 900, gain: 0.22, out });
          this._tone(t, { type: 'triangle', f0: 220, f1: 160, dur: 0.06, gain: 0.12, out });
        }
        if (s % 2 === 0) this._noise(t, { dur: 0.035, type: 'highpass', f0: 7000, f1: 9000, gain: s % 4 === 2 ? 0.08 : 0.04, out });
        // bass
        if ([0, 3, 6, 8, 11, 14].includes(s)) {
          const n = s === 6 || s === 14 ? ch[0] + 12 : ch[0];
          this._tone(t, { type: 'triangle', f0: NOTE(n - 12), dur: stepDur * 1.8, gain: 0.32, out });
          this._tone(t, { type: 'square', f0: NOTE(n - 12), dur: stepDur * 1.2, gain: 0.03, out });
        }
        // plucky arp on phrases 1-3
        if (phrase > 0 && s % 2 === 0) {
          const pat = [0, 1, 2, 3, 2, 1, 3, 2];
          const n = ch[pat[(s / 2) % 8]] + 12;
          this._tone(t, { type: 'triangle', f0: NOTE(n), dur: stepDur * 1.6, gain: 0.07, out });
        }
        // little lead hook on the last phrase
        if (phrase === 2 && (s === 0 || s === 3 || s === 6 || s === 10)) {
          const hook = [72, 74, 76, 79];
          this._tone(t, { type: 'square', f0: NOTE(hook[[0, 3, 6, 10].indexOf(s)] - (bar === 1 ? 2 : 0)), dur: stepDur * 2.5, gain: 0.035, out });
        }
      }
      m.step++;
      m.next += stepDur;
    }
  }
}
