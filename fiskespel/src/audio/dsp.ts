/**
 * Pure sample generators (Float32Array in, Float32Array out). No Web Audio, no DOM —
 * everything here is pre-rendered ONCE per context and cached as AudioBuffers by the engine.
 * OWNER: audio. Tested in tests/audio-dsp.test.ts.
 */
import { Rng, clamp, makeLoopable } from './util';

const TAU = Math.PI * 2;

function normalize(data: Float32Array, target = 0.9): Float32Array {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  if (peak > 0) {
    const k = target / peak;
    for (let i = 0; i < data.length; i++) data[i] *= k;
  }
  return data;
}

function fadeEdges(data: Float32Array, inS: number, outS: number): Float32Array {
  const n = data.length;
  for (let i = 0; i < inS && i < n; i++) data[i] *= i / inS;
  for (let i = 0; i < outS && i < n; i++) data[n - 1 - i] *= i / outS;
  return data;
}

// ─────────────────────────────────────────────────────────────── noise

export type NoiseKind = 'white' | 'pink' | 'brown';

/** Seamlessly loopable noise. */
export function renderNoise(kind: NoiseKind, sr: number, seconds: number, seed = 1): Float32Array {
  const fade = Math.floor(sr * 0.05);
  const n = Math.floor(sr * seconds) + fade;
  const rng = new Rng(seed);
  const d = new Float32Array(n);
  if (kind === 'white') {
    for (let i = 0; i < n; i++) d[i] = rng.sign();
  } else if (kind === 'pink') {
    // Paul Kellet's refined pink filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = rng.sign();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else {
    let b = 0;
    for (let i = 0; i < n; i++) {
      b = (b + 0.02 * rng.sign()) / 1.02;
      d[i] = b;
    }
    // remove DC drift with a gentle one-pole high-pass (~8 Hz)
    const a = Math.exp((-TAU * 8) / sr);
    let px = 0, py = 0;
    for (let i = 0; i < n; i++) {
      const y = a * (py + d[i] - px);
      px = d[i];
      py = y;
      d[i] = y;
    }
  }
  return normalize(makeLoopable(d, fade, kind !== 'brown'), 0.95);
}

// ─────────────────────────────────────────────────────────────── plucked string

export interface PluckOpts {
  /** 0..1 excitation brightness (pick hardness). */
  brightness?: number;
  /** Seconds to decay by 60 dB at this pitch. */
  t60?: number;
  /** 0..0.5 pluck position along the string (comb colouring). */
  pick?: number;
  seed?: number;
  /** Seconds of the returned buffer. */
  seconds?: number;
}

/**
 * Extended Karplus–Strong plucked string with allpass fractional-delay tuning (accurate pitch
 * at any sample rate), loss scaled to a target T60, pick-position comb and a soft body filter.
 */
export function renderKarplus(freq: number, sr: number, o: PluckOpts = {}): Float32Array {
  const bright = clamp(o.brightness ?? 0.55);
  const t60 = o.t60 ?? 2.2;
  const seconds = o.seconds ?? 2;
  const rng = new Rng(o.seed ?? Math.floor(freq * 131));
  const len = Math.floor(sr * seconds);
  const out = new Float32Array(len);

  const P = sr / freq; // total loop delay in samples
  const N = Math.max(2, Math.floor(P - 0.5 - 0.15));
  const frac = P - 0.5 - N; // allpass delay, in [0.15, 1.15)
  const C = (1 - frac) / (1 + frac);
  const g = Math.pow(10, -3 / (t60 * freq)); // per-period decay for the requested T60
  const rho = Math.min(0.99995, g / Math.max(0.2, Math.cos((Math.PI * freq) / sr)));

  // excitation: low-passed noise (brightness), DC removed, pick-position comb
  const exc = new Float32Array(N);
  const a = 0.08 + 0.9 * bright * bright;
  let lp = 0;
  for (let i = 0; i < N; i++) {
    lp += a * (rng.sign() - lp);
    exc[i] = lp;
  }
  let mean = 0;
  for (let i = 0; i < N; i++) mean += exc[i];
  mean /= N;
  const pd = Math.max(1, Math.round((o.pick ?? 0.18) * N));
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = exc[i] - mean - 0.85 * (i >= pd ? exc[i - pd] - mean : 0);

  let idx = 0;
  let prev = 0;
  let apx = 0;
  let apy = 0;
  for (let n = 0; n < len; n++) {
    const x = buf[idx];
    out[n] = x;
    const f = rho * 0.5 * (x + prev);
    prev = x;
    const y = C * f + apx - C * apy;
    apx = f;
    apy = y;
    buf[idx] = y;
    if (++idx === N) idx = 0;
  }

  // soft "body": gentle one-pole low-pass that closes with lower brightness, and DC blocker
  const cut = 1800 + 7000 * bright;
  const k = 1 - Math.exp((-TAU * cut) / sr);
  const hp = Math.exp((-TAU * 30) / sr);
  let s = 0, px = 0, py = 0;
  for (let n = 0; n < len; n++) {
    s += k * (out[n] - s);
    const y = hp * (py + s - px);
    px = s;
    py = y;
    out[n] = y;
  }
  fadeEdges(out, Math.floor(sr * 0.0015), Math.floor(sr * Math.min(0.25, seconds * 0.2)));
  return normalize(out, 0.9);
}

// ─────────────────────────────────────────────────────────────── helpers for event loops

/** Adds `src` into `dst` at `at` samples with wrap-around (for seamless loops). */
function addWrapped(dst: Float32Array, at: number, src: ArrayLike<number>, gain: number): void {
  const n = dst.length;
  let j = ((at % n) + n) % n;
  for (let i = 0; i < src.length; i++) {
    dst[j] += src[i] * gain;
    if (++j === n) j = 0;
  }
}

/** Damped sine burst (optionally chirping by `ratio` over its life). */
function damped(sr: number, f: number, tau: number, ratio = 1, len = tau * 6): Float32Array {
  const n = Math.max(1, Math.floor(sr * len));
  const d = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const fi = f * Math.pow(ratio, Math.min(1, t / len));
    ph += (TAU * fi) / sr;
    const att = Math.min(1, i / (sr * 0.0006));
    d[i] = Math.sin(ph) * Math.exp(-t / tau) * att;
  }
  return d;
}

// ─────────────────────────────────────────────────────────────── rain patter

/** Stereo loop of many droplets hitting water (clicks + tiny rising bubble "plinks"). */
export function renderRainPatter(sr: number, seconds: number, seed = 7): [Float32Array, Float32Array] {
  const n = Math.floor(sr * seconds);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const rng = new Rng(seed);
  const drops = Math.floor(seconds * 260);
  for (let k = 0; k < drops; k++) {
    const at = Math.floor(rng.next() * n);
    const amp = Math.pow(rng.next(), 2.6) * 0.9 + 0.02;
    const pan = rng.next();
    let snd: Float32Array;
    if (rng.chance(0.28)) {
      // bubble plink: rising damped sine
      snd = damped(sr, rng.range(1400, 4200), rng.range(0.004, 0.012), rng.range(1.2, 1.8));
    } else {
      // click: differentiated noise burst
      const m = Math.floor(sr * rng.range(0.0008, 0.003));
      snd = new Float32Array(m);
      let p = 0;
      for (let i = 0; i < m; i++) {
        const w = rng.sign() * Math.exp(-i / (m * 0.3));
        snd[i] = w - p * 0.6;
        p = w;
      }
    }
    addWrapped(L, at, snd, amp * Math.sqrt(1 - pan));
    addWrapped(R, at, snd, amp * Math.sqrt(pan));
  }
  normalize(L, 0.85);
  normalize(R, 0.85);
  return [L, R];
}

// ─────────────────────────────────────────────────────────────── crickets

/** Stereo loop of a night cricket chorus (field crickets + a soft tree-cricket trill). */
export function renderCrickets(sr: number, seconds: number, seed = 11): [Float32Array, Float32Array] {
  const n = Math.floor(sr * seconds);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const rng = new Rng(seed);
  const crickets = 7;
  for (let c = 0; c < crickets; c++) {
    const f = rng.range(3900, 5200);
    const near = c < 3;
    const amp = near ? rng.range(0.5, 0.9) : rng.range(0.12, 0.3);
    const pan = near ? rng.range(0.1, 0.9) : rng.range(0.35, 0.65);
    // periodic chirps that divide the loop exactly → seamless without cross-fade
    const chirps = rng.int(Math.round(seconds * 1.2), Math.round(seconds * 2.2));
    const period = n / chirps;
    const pulses = rng.int(2, 4);
    const pulseLen = rng.range(0.011, 0.016);
    const gap = rng.range(0.009, 0.013);
    const offset = rng.next() * period;
    const pl = Math.floor(sr * pulseLen);
    const pulse = new Float32Array(pl);
    for (let i = 0; i < pl; i++) {
      const x = i / pl;
      const env = Math.sin(Math.PI * x) ** 1.5;
      pulse[i] = (Math.sin((TAU * f * i) / sr) + 0.18 * Math.sin((TAU * 2 * f * i) / sr)) * env;
    }
    for (let k = 0; k < chirps; k++) {
      if (rng.chance(0.08)) continue; // occasional skipped chirp
      const t0 = offset + k * period + rng.range(-0.01, 0.01) * sr;
      for (let p = 0; p < pulses; p++) {
        const at = Math.floor(t0 + p * (pulseLen + gap) * sr);
        const a = amp * (p === pulses - 1 ? 0.8 : 1);
        addWrapped(L, at, pulse, a * Math.sqrt(1 - pan));
        addWrapped(R, at, pulse, a * Math.sqrt(pan));
      }
    }
  }
  // tree-cricket trill: continuous 45 Hz pulses at ~2.9 kHz, slowly swelling
  const tf = rng.range(2700, 3100);
  const pr = Math.round(seconds * 45) / seconds; // integer pulses per loop
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const gate = Math.max(0, Math.sin(TAU * pr * t)) ** 3;
    const swell = 0.5 + 0.5 * Math.sin((TAU * t) / seconds);
    const v = Math.sin(TAU * tf * t) * gate * swell * 0.16;
    L[i] += v * 0.8;
    R[i] += v * 0.6;
  }
  normalize(L, 0.8);
  normalize(R, 0.8);
  return [L, R];
}

// ─────────────────────────────────────────────────────────────── frogs

function harmonicCall(sr: number, dur: number, f0: number, f1: number, formant: number, bw: number, pulseHz: number, harmonics: number): Float32Array {
  const n = Math.floor(sr * dur);
  const d = new Float32Array(n);
  const amps: number[] = [];
  for (let h = 1; h <= harmonics; h++) {
    const x = (h * (f0 + f1) * 0.5 - formant) / bw;
    amps.push(Math.exp(-x * x) + 0.15 / h);
  }
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = f0 + (f1 - f0) * t;
    ph += (TAU * f) / sr;
    let v = 0;
    for (let h = 0; h < harmonics; h++) {
      if ((h + 1) * f > sr * 0.45) break;
      v += amps[h] * Math.sin(ph * (h + 1));
    }
    const env = Math.min(1, t * 12) * Math.min(1, (1 - t) * 6);
    const am = pulseHz > 0 ? 0.35 + 0.65 * Math.max(0, Math.sin((TAU * pulseHz * i) / sr)) : 1;
    d[i] = v * env * am;
  }
  return normalize(d, 1);
}

/** Stereo loop: tree-frog "rib-bit"s, a few peepers and a distant bullfrog. */
export function renderFrogChorus(sr: number, seconds: number, seed = 23): [Float32Array, Float32Array] {
  const n = Math.floor(sr * seconds);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const rng = new Rng(seed);
  const place = (snd: Float32Array, at: number, amp: number, pan: number) => {
    addWrapped(L, Math.floor(at), snd, amp * Math.sqrt(1 - pan));
    addWrapped(R, Math.floor(at), snd, amp * Math.sqrt(pan));
  };
  // tree frogs: 2-syllable calls
  for (let fIdx = 0; fIdx < 6; fIdx++) {
    const f0 = rng.range(200, 330);
    const pan = rng.range(0.1, 0.9);
    const amp = rng.range(0.25, 0.8);
    const syl = harmonicCall(sr, rng.range(0.07, 0.1), f0, f0 * 1.12, rng.range(1100, 1900), 500, rng.range(55, 80), 12);
    const calls = rng.int(Math.round(seconds * 0.5), Math.round(seconds * 1.1));
    for (let k = 0; k < calls; k++) {
      const at = rng.next() * n;
      place(syl, at, amp, pan);
      place(syl, at + sr * rng.range(0.13, 0.17), amp * 0.9, pan);
    }
  }
  // spring peepers: single rising peeps
  for (let p = 0; p < 4; p++) {
    const f = rng.range(2700, 3200);
    const pan = rng.range(0.2, 0.8);
    const snd = damped(sr, f * 0.9, 0.04, 1.15, 0.09);
    fadeEdges(snd, Math.floor(sr * 0.01), Math.floor(sr * 0.01));
    const period = n / rng.int(Math.round(seconds * 0.8), Math.round(seconds * 1.4));
    const off = rng.next() * period;
    for (let t = off; t < n; t += period * rng.range(0.9, 1.1)) place(snd, t, rng.range(0.1, 0.22), pan);
  }
  // distant bullfrog "jug-o-rum"
  const bull = harmonicCall(sr, 0.55, 105, 92, 330, 180, 18, 10);
  for (let k = 0; k < Math.max(1, Math.round(seconds / 6)); k++) place(bull, rng.next() * n, 0.5, rng.range(0.3, 0.7));
  normalize(L, 0.8);
  normalize(R, 0.8);
  return [L, R];
}

// ─────────────────────────────────────────────────────────────── lava

/** Stereo loop of lava crackle: clustered sharp crackles + occasional low bubble pops. */
export function renderLavaCrackle(sr: number, seconds: number, seed = 31): [Float32Array, Float32Array] {
  const n = Math.floor(sr * seconds);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const rng = new Rng(seed);
  const clusters = Math.floor(seconds * 3.5);
  for (let c = 0; c < clusters; c++) {
    const t0 = rng.next() * n;
    const count = rng.int(2, 9);
    const pan = rng.range(0.1, 0.9);
    for (let k = 0; k < count; k++) {
      const at = t0 + rng.exp(0.03) * sr;
      const m = Math.floor(sr * rng.range(0.0005, 0.004));
      const s = new Float32Array(m);
      let p = 0;
      const pol = rng.chance(0.5) ? 1 : -1;
      for (let i = 0; i < m; i++) {
        const w = (rng.sign() * 0.6 + pol * 0.4) * Math.exp(-i / (m * 0.25));
        s[i] = w - p * 0.8;
        p = w;
      }
      const amp = Math.pow(rng.next(), 2) * 0.9 + 0.05;
      addWrapped(L, Math.floor(at), s, amp * Math.sqrt(1 - pan));
      addWrapped(R, Math.floor(at), s, amp * Math.sqrt(pan));
    }
  }
  // thick bubble pops
  for (let k = 0; k < Math.floor(seconds * 0.8); k++) {
    const pop = damped(sr, rng.range(55, 90), 0.05, rng.range(1.8, 2.6), 0.16);
    const pan = rng.range(0.25, 0.75);
    const at = Math.floor(rng.next() * n);
    addWrapped(L, at, pop, 0.55 * Math.sqrt(1 - pan));
    addWrapped(R, at, pop, 0.55 * Math.sqrt(pan));
  }
  normalize(L, 0.85);
  normalize(R, 0.85);
  return [L, R];
}

// ─────────────────────────────────────────────────────────────── reel ratchets

/**
 * A loop of `clicks` ratchet clicks spread evenly over `seconds` (so playbackRate sets the click rate).
 * `harsh` > 0 adds brighter partials and a buzzing bed (drag / line screaming out).
 */
export function renderRatchet(sr: number, clicks: number, seconds: number, harsh = 0, seed = 5): Float32Array {
  const n = Math.floor(sr * seconds);
  const d = new Float32Array(n);
  const rng = new Rng(seed);
  const partials = harsh > 0
    ? [[3200, 0.0018, 1], [5600, 0.0012, 0.7], [1500, 0.003, 0.45], [8200, 0.0008, 0.35]]
    : [[2300, 0.0024, 1], [4100, 0.0016, 0.55], [950, 0.004, 0.5], [6400, 0.001, 0.25]];
  for (let k = 0; k < clicks; k++) {
    const at = Math.floor((k * n) / clicks + rng.range(-0.04, 0.04) * (n / clicks));
    const amp = rng.range(0.7, 1);
    for (const [f, tau, a] of partials) {
      const s = damped(sr, f * rng.range(0.97, 1.03), tau, 1, tau * 7);
      addWrapped(d, at, s, amp * a);
    }
    // transient tick
    const m = Math.floor(sr * 0.0007);
    const tick = new Float32Array(m);
    for (let i = 0; i < m; i++) tick[i] = rng.sign() * (1 - i / m);
    addWrapped(d, at, tick, 0.6 * amp);
  }
  if (harsh > 0) {
    let lp = 0;
    for (let i = 0; i < n; i++) {
      lp += 0.3 * (rng.sign() - lp);
      d[i] += lp * 0.18 * harsh;
    }
  }
  return normalize(d, 0.9);
}

// ─────────────────────────────────────────────────────────────── reverb

/**
 * Stereo impulse response: pre-delay, a handful of early reflections, then decorrelated
 * exponentially-decaying noise whose high frequencies die faster (natural "air" damping).
 */
export function renderImpulse(sr: number, rt60: number, seed = 3, damping = 0.6): [Float32Array, Float32Array] {
  const len = Math.floor(sr * rt60 * 1.05);
  const pre = Math.floor(sr * 0.012);
  const rng = new Rng(seed);
  const chans: Float32Array[] = [];
  for (let c = 0; c < 2; c++) {
    const d = new Float32Array(len);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp((-6.9 * t) / rt60);
      // low-pass coefficient: bright at first, darker later
      const k = clamp(0.95 - damping * (t / rt60) * 1.2, 0.08, 0.95);
      lp += k * (rng.sign() - lp);
      const fadeIn = Math.min(1, (i - pre) / (sr * 0.008));
      d[i] = lp * env * fadeIn;
    }
    // early reflections
    for (let r = 0; r < 7; r++) {
      const at = pre + Math.floor(sr * rng.range(0.004, 0.07));
      const a = rng.range(0.25, 0.7) * (1 - r / 9) * (rng.chance(0.5) ? 1 : -1);
      if (at < len) d[at] += a;
    }
    fadeEdges(d, 0, Math.floor(sr * 0.05));
    chans.push(normalize(d, 0.9));
  }
  return [chans[0], chans[1]];
}
