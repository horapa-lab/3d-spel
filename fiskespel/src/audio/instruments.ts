/**
 * Note-level instruments shared by the music director and the fanfare SFX.
 * All are "acoustic-feeling" physical/modal models built from cheap nodes:
 *  - plucked strings: Karplus–Strong buffers (pre-rendered, cached per note)
 *  - mallets & bells: sums of damped sine modes with measured partial ratios
 *  - pads / choir / brass: detuned periodic waves through (formant) filters
 * OWNER: audio.
 */
import { perc, swell, type Voice } from './engine';
import { clamp, midiToFreq } from './util';

export type InstrumentId =
  | 'pluck'
  | 'pluck_soft'
  | 'harp'
  | 'bass'
  | 'marimba'
  | 'kalimba'
  | 'celesta'
  | 'glock'
  | 'bell'
  | 'bell_low'
  | 'pad_warm'
  | 'pad_dark'
  | 'pad_glass'
  | 'choir'
  | 'brass'
  | 'sub'
  | 'shaker'
  | 'heartbeat'
  | 'taiko'
  | 'sparkle';

type Mode = [ratio: number, amp: number, decayMul: number];

/** Sum of damped sine modes. Returns end time. */
function modal(v: Voice, t: number, f: number, vel: number, modes: Mode[], t60: number, attack = 0.0015, dest: AudioNode = v.out): number {
  const nyq = v.e.sr * 0.45;
  let end = t;
  for (const [ratio, amp, dm] of modes) {
    const fr = f * ratio;
    if (fr > nyq || amp <= 0) continue;
    const o = v.osc('sine', fr, t, t + attack + t60 * dm + 0.05);
    const g = v.gain(0);
    const e = perc(g.gain, t, amp * vel, attack, t60 * dm);
    o.connect(g).connect(dest);
    end = Math.max(end, e);
  }
  return end;
}

/** Short filtered noise tick (mallet / hammer contact). */
function contact(v: Voice, t: number, freq: number, q: number, amp: number, len: number, dest: AudioNode = v.out): void {
  const n = v.noise('white', t, t + len + 0.02);
  const f = v.filter('bandpass', freq, q);
  const g = v.gain(0);
  perc(g.gain, t, amp, 0.0008, len);
  n.connect(f).connect(g).connect(dest);
}

const WARM = [1, 0.42, 0.3, 0.16, 0.12, 0.07, 0.05, 0.03, 0.022, 0.015, 0.01, 0.007];
const DARK = [1, 0.3, 0.12, 0.06, 0.03, 0.015, 0.008];
const GLASS = [1, 0.02, 0.33, 0.01, 0.16, 0.01, 0.08, 0.005, 0.04];
const SAW = Array.from({ length: 24 }, (_, i) => 1 / (i + 1));

/**
 * Plays one note. `dur` is the held length in seconds (sustaining instruments only).
 * Returns the time the note has fully decayed.
 */
export function playNote(v: Voice, inst: InstrumentId, t: number, midi: number, vel: number, dur = 1, dest: AudioNode = v.out): number {
  const e = v.e;
  const f = midiToFreq(midi);
  vel = clamp(vel, 0, 1.5);
  switch (inst) {
    case 'pluck':
    case 'pluck_soft':
    case 'harp': {
      const bright = inst === 'pluck_soft' ? 0.3 : inst === 'harp' ? 0.6 : 0.42 + 0.2 * clamp(vel);
      const t60 = inst === 'harp' ? 3.2 : inst === 'pluck_soft' ? 1.9 : 2.4;
      const s = v.buffer(e.pluck(midi, bright, t60), t);
      const g = v.gain(vel * 0.8);
      s.connect(g).connect(dest);
      return v.end;
    }
    case 'bass': {
      const s = v.buffer(e.pluck(midi, 0.26, 3.2), t);
      const g = v.gain(vel * 0.85);
      s.connect(g).connect(dest);
      // round sine body under the string
      const o = v.osc('sine', f, t, t + 1.4);
      const gb = v.gain(0);
      perc(gb.gain, t, vel * 0.32, 0.01, 1.2);
      o.connect(gb).connect(dest);
      return v.end;
    }
    case 'marimba': {
      const t60 = clamp(1.9 - (midi - 60) * 0.035, 0.45, 2.2);
      contact(v, t, f * 2.2, 1.2, 0.18 * vel, 0.02, dest);
      return modal(v, t, f, vel * 0.55, [[1, 1, 1], [3.93, 0.26, 0.28], [9.2, 0.06, 0.1]], t60, 0.0018, dest);
    }
    case 'kalimba': {
      const t60 = clamp(2.6 - (midi - 60) * 0.03, 0.8, 2.8);
      const o = v.osc('sine', f, t, t + t60 + 0.1);
      o.frequency.setValueAtTime(f * 1.008, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      const g = v.gain(0);
      perc(g.gain, t, vel * 0.5, 0.0012, t60);
      o.connect(g).connect(dest);
      contact(v, t, 3200, 1.5, 0.05 * vel, 0.012, dest);
      return Math.max(t + t60, modal(v, t, f, vel * 0.5, [[2, 0.06, 0.4], [5.4, 0.2, 0.12], [11.3, 0.07, 0.05]], t60, 0.0012, dest));
    }
    case 'celesta': {
      const t60 = clamp(1.8 - (midi - 72) * 0.03, 0.6, 2.2);
      contact(v, t, 4500, 1, 0.04 * vel, 0.01, dest);
      return modal(v, t, f, vel * 0.42, [[1, 1, 1], [2, 0.3, 0.55], [3.01, 0.12, 0.35], [4.17, 0.07, 0.22]], t60, 0.001, dest);
    }
    case 'glock':
      return modal(v, t, f, vel * 0.36, [[1, 1, 1], [2.76, 0.36, 0.45], [5.4, 0.16, 0.25], [8.93, 0.06, 0.15]], clamp(dur, 0.25, 3), 0.0008, dest);
    case 'bell':
    case 'bell_low': {
      const low = inst === 'bell_low';
      const t60 = low ? 6 : 4;
      const out = low ? v.filter('lowpass', 1800, 0.5) : dest;
      if (low) out.connect(dest);
      contact(v, t, f * 3, 2, 0.12 * vel, 0.03, out);
      return modal(
        v,
        t,
        f,
        vel * (low ? 0.4 : 0.3),
        [[0.5, 0.35, 1], [1, 1, 0.85], [1.19, 0.45, 0.6], [1.5, 0.28, 0.5], [2, 0.5, 0.42], [2.51, 0.18, 0.3], [3.01, 0.2, 0.25], [4.05, 0.1, 0.18]],
        t60,
        0.001,
        out,
      );
    }
    case 'pad_warm':
    case 'pad_dark':
    case 'pad_glass': {
      const table = inst === 'pad_warm' ? WARM : inst === 'pad_dark' ? DARK : GLASS;
      const w = e.wave(inst, table);
      const atk = inst === 'pad_dark' ? 2.2 : inst === 'pad_glass' ? 1.8 : 1.3;
      const rel = 2.4;
      const end = t + atk + dur + rel * 1.1;
      const lp = v.filter('lowpass', Math.min(9000, f * (inst === 'pad_dark' ? 2.2 : 3.4) + 300), 0.6);
      const g = v.gain(0);
      swell(g.gain, t, vel * 0.1, atk, Math.max(0, dur - atk * 0.5), rel);
      for (const [det, pan] of [[-7, -0.55], [7, 0.55]] as const) {
        const o = v.osc(w, f, t, end, det + (Math.random() - 0.5) * 3);
        const p = v.pan(pan);
        o.connect(p).connect(lp);
      }
      lp.connect(g).connect(dest);
      return end;
    }
    case 'choir': {
      const w = e.wave('saw', SAW);
      const atk = 0.9;
      const rel = 1.8;
      const end = t + atk + dur + rel * 1.1;
      const sum = v.gain(1);
      const lfo = v.osc('sine', 5.1 + Math.random() * 0.6, t, end);
      const depth = v.gain(11);
      lfo.connect(depth);
      for (const det of [-10, 0, 10]) {
        const o = v.osc(w, f, t, end, det);
        depth.connect(o.detune);
        o.connect(sum);
      }
      // "ah" formants
      const g = v.gain(0);
      swell(g.gain, t, vel * 0.16, atk, Math.max(0, dur - atk * 0.5), rel);
      for (const [ff, q, a] of [[730, 7, 1], [1090, 9, 0.5], [2440, 11, 0.22], [320, 4, 0.3]] as const) {
        const bp = v.filter('bandpass', ff, q);
        const ga = v.gain(a);
        sum.connect(bp).connect(ga).connect(g);
      }
      g.connect(dest);
      return end;
    }
    case 'brass': {
      const w = e.wave('saw', SAW);
      const atk = 0.05;
      const rel = 0.45;
      const end = t + atk + dur + rel * 1.2;
      const lp = v.filter('lowpass', f * 1.2, 1.2);
      lp.frequency.setValueAtTime(f * 1.2, t);
      lp.frequency.linearRampToValueAtTime(Math.min(9000, f * 7), t + 0.07);
      lp.frequency.setTargetAtTime(Math.min(7000, f * 3.6), t + 0.07, 0.15);
      const g = v.gain(0);
      swell(g.gain, t, vel * 0.13, atk, dur, rel);
      for (const det of [-6, 6]) {
        const o = v.osc(w, f, t, end, det);
        o.detune.setValueAtTime(det - 35, t);
        o.detune.linearRampToValueAtTime(det, t + 0.07);
        o.connect(lp);
      }
      lp.connect(g).connect(dest);
      return end;
    }
    case 'sub': {
      const end = t + dur + 1.5;
      const o = v.osc('sine', f, t, end);
      const g = v.gain(0);
      swell(g.gain, t, vel * 0.35, 0.6, dur, 1.2);
      o.connect(g).connect(dest);
      return end;
    }
    case 'shaker': {
      const n = v.noise('white', t, t + 0.12);
      const hp = v.filter('highpass', 5200, 0.7);
      const g = v.gain(0);
      perc(g.gain, t, vel * 0.1, 0.006, 0.08);
      n.connect(hp).connect(g).connect(dest);
      return t + 0.12;
    }
    case 'heartbeat': {
      const o = v.osc('sine', 58, t, t + 0.5);
      o.frequency.setValueAtTime(62, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      const g = v.gain(0);
      perc(g.gain, t, vel * 0.55, 0.004, 0.35);
      o.connect(g).connect(dest);
      return t + 0.5;
    }
    case 'taiko': {
      const o = v.osc('sine', 95, t, t + 1.3);
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.22);
      const g = v.gain(0);
      perc(g.gain, t, vel * 0.6, 0.003, 1.1);
      o.connect(g).connect(dest);
      const n = v.noise('pink', t, t + 0.3);
      const lp = v.filter('lowpass', 420, 0.8);
      const gn = v.gain(0);
      perc(gn.gain, t, vel * 0.35, 0.002, 0.22);
      n.connect(lp).connect(gn).connect(dest);
      return t + 1.3;
    }
    case 'sparkle': {
      // `dur` = spread; `midi` = lowest note; pentatonic grains above it
      const pent = [0, 2, 4, 7, 9];
      const grains = Math.round(clamp(dur * 9, 3, 16));
      let end = t;
      for (let i = 0; i < grains; i++) {
        const tt = t + (i / grains) * dur + e.rng.range(0, dur / grains);
        const m = midi + pent[e.rng.int(0, 4)] + 12 * e.rng.int(0, 2);
        const a = vel * (1 - (i / grains) * 0.5) * e.rng.range(0.4, 0.9);
        end = Math.max(end, modal(v, tt, midiToFreq(m), a * 0.22, [[1, 1, 1], [2.76, 0.3, 0.4]], 0.5, 0.0006, dest));
      }
      return end;
    }
  }
}
