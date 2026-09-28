/**
 * Audio engine: one per (Offline)AudioContext. Owns the bus graph, the master dynamics chain,
 * the shared reverb/echo, a cache of pre-rendered buffers and lightweight "voices".
 *
 *   music ─ duck ─ vol ─ musicLP ─────────────────────────────┐
 *   sfx   ─ vol ─────────────────┐                             │
 *   amb   ─ duck ─ vol ──────────┼─ worldLP (underwater) ──────┼─ mix ─ comp ─ master ─ softclip ─ out
 *   reverb (convolver) ──────────┘                             │
 *   ui    ─ vol ───────────────────────────────────────────────┘   (UI is never muffled)
 *
 * Every bus has a dry input and a wet input (→ reverb) that share the bus volume/duck.
 * OWNER: audio.
 */
import type { QualityTier } from '../core/types';
import { renderCrickets, renderFrogChorus, renderImpulse, renderKarplus, renderLavaCrackle, renderNoise, renderRainPatter, renderRatchet, type NoiseKind } from './dsp';
import { Rng, clamp, distanceGain, midiToFreq, softClipCurve } from './util';

export type BusName = 'music' | 'sfx' | 'amb' | 'ui';

export interface BusIO {
  dry: AudioNode;
  wet: AudioNode;
  echo?: AudioNode;
}

/** Linear level trims per bus (mix balance). */
const TRIM = { music: 0.62, sfx: 1.0, amb: 0.85, ui: 0.8 };

export interface EngineOptions {
  quality: QualityTier;
  offline?: boolean;
  seed?: number;
}

export interface Listener {
  x: number;
  y: number;
  z: number;
  /** Unit right vector (x, z) of the camera, for stereo panning. */
  rx: number;
  rz: number;
}

export class Engine {
  readonly ac: BaseAudioContext;
  readonly sr: number;
  readonly offline: boolean;
  readonly quality: QualityTier;
  readonly rng: Rng;
  readonly mix: GainNode;
  readonly comp: DynamicsCompressorNode;
  readonly master: GainNode;
  readonly out: WaveShaperNode;
  readonly worldLP: BiquadFilterNode;
  readonly musicLP: BiquadFilterNode;
  readonly reverb: ConvolverNode;
  readonly reverbIn: GainNode;
  readonly reverbOut: GainNode;
  readonly echoDelayL: DelayNode;
  readonly echoDelayR: DelayNode;
  readonly buses: Record<BusName, BusIO>;
  /** Per-bus volume nodes: [dry, wet(, echo)]. */
  private vols: Record<BusName, GainNode[]>;
  private ducks: { music: GainNode[]; amb: GainNode[] };
  private ambWetExtra: GainNode;
  private duckUntil = 0;
  readonly listener: Listener = { x: 0, y: 2, z: 0, rx: 1, rz: 0 };
  readonly active: Record<BusName, number> = { music: 0, sfx: 0, amb: 0, ui: 0 };
  readonly maxVoices: number;
  private buffers = new Map<string, AudioBuffer>();
  private plucks = new Map<string, AudioBuffer>();
  private waves = new Map<string, PeriodicWave>();

  constructor(ac: BaseAudioContext, opts: EngineOptions) {
    this.ac = ac;
    this.sr = ac.sampleRate;
    this.offline = !!opts.offline;
    this.quality = opts.quality;
    this.rng = new Rng(opts.seed ?? ((Date.now() & 0xffffff) | 1));
    this.maxVoices = opts.quality === 'low' ? 28 : opts.quality === 'medium' ? 40 : 56;

    const g = (v = 1) => {
      const n = ac.createGain();
      n.gain.value = v;
      return n;
    };

    // ── master chain
    this.mix = g(1);
    this.comp = ac.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 14;
    this.comp.ratio.value = 3.2;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.28;
    this.master = g(0.62);
    this.out = ac.createWaveShaper();
    this.out.curve = softClipCurve() as Float32Array<ArrayBuffer>;
    this.mix.connect(this.comp).connect(this.master).connect(this.out);

    this.worldLP = ac.createBiquadFilter();
    this.worldLP.type = 'lowpass';
    this.worldLP.frequency.value = 20000;
    this.worldLP.Q.value = 0.5;
    this.worldLP.connect(this.mix);
    this.musicLP = ac.createBiquadFilter();
    this.musicLP.type = 'lowpass';
    this.musicLP.frequency.value = 20000;
    this.musicLP.Q.value = 0.4;
    this.musicLP.connect(this.mix);

    // ── reverb
    this.reverb = ac.createConvolver();
    const rt = opts.quality === 'low' ? 1.3 : opts.quality === 'medium' ? 1.9 : 2.5;
    const [il, ir] = renderImpulse(this.sr, rt, 3);
    this.reverb.buffer = this.makeBuffer([il, ir], this.sr);
    this.reverbIn = g(1);
    this.reverbOut = g(0.5);
    const revHP = ac.createBiquadFilter();
    revHP.type = 'highpass';
    revHP.frequency.value = 180;
    this.reverbIn.connect(revHP).connect(this.reverb).connect(this.reverbOut).connect(this.worldLP);

    // ── ping-pong echo (music only)
    const echoIn = g(1);
    const echoLP = ac.createBiquadFilter();
    echoLP.type = 'lowpass';
    echoLP.frequency.value = 2600;
    this.echoDelayL = ac.createDelay(2);
    this.echoDelayR = ac.createDelay(2);
    this.echoDelayL.delayTime.value = 0.42;
    this.echoDelayR.delayTime.value = 0.42;
    const fbL = g(0.42);
    const fbR = g(0.42);
    const panL = ac.createStereoPanner();
    const panR = ac.createStereoPanner();
    panL.pan.value = -0.75;
    panR.pan.value = 0.75;
    const echoOut = g(0.55);
    echoIn.connect(echoLP).connect(this.echoDelayL);
    this.echoDelayL.connect(fbL).connect(this.echoDelayR);
    this.echoDelayR.connect(fbR).connect(this.echoDelayL);
    this.echoDelayL.connect(panL).connect(echoOut);
    this.echoDelayR.connect(panR).connect(echoOut);
    echoOut.connect(this.musicLP);
    const echoToRev = g(0.3);
    echoOut.connect(echoToRev).connect(this.reverbIn);

    // ── buses
    const mDuck = [g(1), g(1), g(1)];
    const mVol = [g(TRIM.music), g(TRIM.music), g(TRIM.music)];
    const mDry = g(1), mWet = g(1), mEcho = g(1);
    mDry.connect(mDuck[0]).connect(mVol[0]).connect(this.musicLP);
    mWet.connect(mDuck[1]).connect(mVol[1]).connect(this.reverbIn);
    mEcho.connect(mDuck[2]).connect(mVol[2]).connect(echoIn);

    const sVol = [g(TRIM.sfx), g(TRIM.sfx)];
    const sDry = g(1), sWet = g(1);
    sDry.connect(sVol[0]).connect(this.worldLP);
    sWet.connect(sVol[1]).connect(this.reverbIn);

    const aDuck = [g(1), g(1)];
    const aVol = [g(TRIM.amb), g(TRIM.amb)];
    const aDry = g(1), aWet = g(1);
    this.ambWetExtra = g(1);
    aDry.connect(aDuck[0]).connect(aVol[0]).connect(this.worldLP);
    aWet.connect(aDuck[1]).connect(aVol[1]).connect(this.ambWetExtra).connect(this.reverbIn);

    const uVol = [g(TRIM.ui), g(TRIM.ui)];
    const uDry = g(1), uWet = g(1);
    uDry.connect(uVol[0]).connect(this.mix);
    const uiRev = g(0.5);
    uWet.connect(uVol[1]).connect(uiRev).connect(this.reverbIn);

    this.buses = {
      music: { dry: mDry, wet: mWet, echo: mEcho },
      sfx: { dry: sDry, wet: sWet },
      amb: { dry: aDry, wet: aWet },
      ui: { dry: uDry, wet: uWet },
    };
    this.vols = { music: mVol, sfx: sVol, amb: aVol, ui: uVol };
    this.ducks = { music: mDuck, amb: aDuck };
  }

  get now(): number {
    return this.ac.currentTime;
  }

  connectOutput(dest: AudioNode = this.ac.destination): void {
    this.out.connect(dest);
  }

  // ─────────────────────────────────────────────────────────── mixer controls

  setVolumes(musicGain: number, sfxGain: number, smooth = 0.06): void {
    const t = this.now;
    const set = (nodes: GainNode[], v: number) => {
      for (const n of nodes) {
        n.gain.cancelScheduledValues(t);
        n.gain.setTargetAtTime(v, t, smooth);
      }
    };
    set(this.vols.music, musicGain * TRIM.music);
    set(this.vols.sfx, sfxGain * TRIM.sfx);
    set(this.vols.amb, sfxGain * TRIM.amb);
    set(this.vols.ui, sfxGain * TRIM.ui);
  }

  /** Duck music (and a little ambience) for `hold` seconds, e.g. during a catch fanfare. */
  duck(depth: number, hold: number, release = 1.6, at = this.now): void {
    const until = at + hold;
    const extend = until > this.duckUntil;
    this.duckUntil = Math.max(this.duckUntil, until);
    const apply = (nodes: GainNode[], level: number) => {
      for (const n of nodes) {
        const p = n.gain;
        p.cancelScheduledValues(at);
        p.setTargetAtTime(level, at, 0.05);
        p.setTargetAtTime(1, this.duckUntil, release / 3);
      }
    };
    if (extend || depth < 1) {
      apply(this.ducks.music, clamp(depth, 0, 1));
      apply(this.ducks.amb, clamp(0.45 + depth * 0.55, 0, 1));
    }
  }

  /** 0 = dry air, 1 = fully underwater. */
  setUnderwater(amount: number, t = this.now): void {
    const a = clamp(amount);
    this.worldLP.frequency.setTargetAtTime(20000 * Math.pow(420 / 20000, a), t, 0.08);
    this.worldLP.Q.setTargetAtTime(0.5 + a * 1.2, t, 0.08);
    this.musicLP.frequency.setTargetAtTime(20000 * Math.pow(1300 / 20000, a), t, 0.1);
  }

  /** Extra reverb for ambience (caves, arches). 1 = normal. */
  setAmbReverb(mult: number, t = this.now): void {
    this.ambWetExtra.gain.setTargetAtTime(mult, t, 0.8);
  }

  setEchoTime(seconds: number, t = this.now): void {
    const s = clamp(seconds, 0.15, 1.5);
    this.echoDelayL.delayTime.setTargetAtTime(s, t, 0.2);
    this.echoDelayR.delayTime.setTargetAtTime(s, t, 0.2);
  }

  // ─────────────────────────────────────────────────────────── spatial

  /** Gain/pan/low-pass for a world position relative to the listener. */
  spatial(x: number, y: number, z: number, ref = 6, max = 220): { gain: number; pan: number; lp: number; dist: number } {
    const L = this.listener;
    const dx = x - L.x, dy = y - L.y, dz = z - L.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const h = Math.sqrt(dx * dx + dz * dz) || 1;
    const side = (dx * L.rx + dz * L.rz) / h;
    const pan = clamp(side * Math.min(1, dist / 4), -0.85, 0.85);
    return { gain: distanceGain(dist, ref, 1, max), pan, lp: 20000 * Math.pow(0.12, clamp(dist / max)), dist };
  }

  // ─────────────────────────────────────────────────────────── buffers

  makeBuffer(channels: ArrayLike<number>[], sampleRate: number): AudioBuffer {
    const b = this.ac.createBuffer(channels.length, channels[0].length, sampleRate);
    for (let c = 0; c < channels.length; c++) b.getChannelData(c).set(channels[c]);
    return b;
  }

  /** Lazily rendered, cached buffers. */
  buffer(name: 'white' | 'pink' | 'brown' | 'rain' | 'crickets' | 'frogs' | 'lava' | 'ratchet' | 'drag'): AudioBuffer {
    let b = this.buffers.get(name);
    if (b) return b;
    const sr = this.sr;
    const low = 22050;
    switch (name) {
      case 'white':
        b = this.makeBuffer([renderNoise('white', sr, 2, 101), renderNoise('white', sr, 2, 102)], sr);
        break;
      case 'pink':
        b = this.makeBuffer([renderNoise('pink', sr, 4, 201), renderNoise('pink', sr, 4, 202)], sr);
        break;
      case 'brown':
        b = this.makeBuffer([renderNoise('brown', low, 5, 301), renderNoise('brown', low, 5, 302)], low);
        break;
      case 'rain':
        b = this.makeBuffer(renderRainPatter(sr, 3.2), sr);
        break;
      case 'crickets':
        b = this.makeBuffer(renderCrickets(low, 7), low);
        break;
      case 'frogs':
        b = this.makeBuffer(renderFrogChorus(low, 9), low);
        break;
      case 'lava':
        b = this.makeBuffer(renderLavaCrackle(low, 5), low);
        break;
      case 'ratchet':
        b = this.makeBuffer([renderRatchet(sr, 8, 8 / 22, 0, 5)], sr);
        break;
      case 'drag':
        b = this.makeBuffer([renderRatchet(sr, 12, 12 / 34, 1, 9)], sr);
        break;
    }
    this.buffers.set(name, b!);
    return b!;
  }

  /** Karplus–Strong pluck buffer for a MIDI note (cached, LRU-capped). */
  pluck(midi: number, bright = 0.55, t60 = 2.2): AudioBuffer {
    const m = Math.round(midi);
    const key = `${m}|${Math.round(bright * 5)}|${Math.round(t60 * 2)}`;
    let b = this.plucks.get(key);
    if (b) {
      this.plucks.delete(key);
      this.plucks.set(key, b);
      return b;
    }
    const sr = 24000;
    const f = midiToFreq(m);
    const seconds = clamp(t60 * 0.75, 0.6, 2.8);
    b = this.makeBuffer([renderKarplus(f, sr, { brightness: bright, t60, seconds, seed: m * 7 + 1 })], sr);
    this.plucks.set(key, b);
    if (this.plucks.size > 64) this.plucks.delete(this.plucks.keys().next().value!);
    return b;
  }

  /** Cached PeriodicWave from harmonic amplitudes. */
  wave(name: string, harmonics: number[]): PeriodicWave {
    let w = this.waves.get(name);
    if (!w) {
      const real = new Float32Array(harmonics.length + 1);
      const imag = new Float32Array(harmonics.length + 1);
      for (let i = 0; i < harmonics.length; i++) imag[i + 1] = harmonics[i];
      w = this.ac.createPeriodicWave(real, imag);
      this.waves.set(name, w);
    }
    return w;
  }

  // ─────────────────────────────────────────────────────────── voices

  /**
   * Allocates a voice routed to a bus (or a custom BusIO). Returns null when the voice budget is
   * exhausted and the priority is too low.
   */
  voice(bus: BusName | BusIO, opts: { gain?: number; wet?: number; echo?: number; pan?: number; priority?: number; kind?: BusName } = {}): Voice | null {
    const kind: BusName = opts.kind ?? (typeof bus === 'string' ? bus : 'music');
    if (kind !== 'music') {
      const total = this.active.sfx + this.active.amb + this.active.ui;
      const pri = opts.priority ?? 1;
      if (total >= this.maxVoices && pri < 3) return null;
      if (total >= this.maxVoices * 0.75 && pri < 1) return null;
    } else if (this.active.music > this.maxVoices) return null;
    const io = typeof bus === 'string' ? this.buses[bus] : bus;
    return new Voice(this, io, kind, opts.gain ?? 1, opts.wet ?? 0, opts.echo ?? 0, opts.pan ?? 0);
  }

  // node helpers
  gain(v = 1): GainNode {
    const n = this.ac.createGain();
    n.gain.value = v;
    return n;
  }
  filter(type: BiquadFilterType, freq: number, q = 0.707, gainDb = 0): BiquadFilterNode {
    const f = this.ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = clamp(freq, 10, this.sr * 0.49);
    f.Q.value = q;
    f.gain.value = gainDb;
    return f;
  }
  panner(p: number): StereoPannerNode {
    const n = this.ac.createStereoPanner();
    n.pan.value = clamp(p, -1, 1);
    return n;
  }
  /** Looping noise source starting at a random offset (unstarted). */
  noiseSource(kind: NoiseKind, rate = 1): AudioBufferSourceNode {
    const s = this.ac.createBufferSource();
    s.buffer = this.buffer(kind);
    s.loop = true;
    s.playbackRate.value = rate;
    return s;
  }
}

/** A one-shot sound: tracks its sources and disconnects itself after the last one ends. */
export class Voice {
  readonly out: GainNode;
  private lastSrc: AudioScheduledSourceNode | null = null;
  private lastEnd = -1;
  private finished = false;
  private extra: AudioNode[] = [];

  constructor(readonly e: Engine, io: BusIO, readonly kind: BusName, gain: number, wet: number, echo: number, pan: number) {
    const ac = e.ac;
    this.out = ac.createGain();
    this.out.gain.value = gain;
    let head: AudioNode = this.out;
    if (pan) {
      const p = e.panner(pan);
      this.out.connect(p);
      head = p;
      this.extra.push(p);
    }
    head.connect(io.dry);
    if (wet > 0) {
      const w = e.gain(wet);
      head.connect(w).connect(io.wet);
      this.extra.push(w);
    }
    if (echo > 0 && io.echo) {
      const w = e.gain(echo);
      head.connect(w).connect(io.echo);
      this.extra.push(w);
    }
    e.active[kind]++;
  }

  get ac(): BaseAudioContext {
    return this.e.ac;
  }

  track(src: AudioScheduledSourceNode, end: number): void {
    if (end > this.lastEnd) {
      this.lastEnd = end;
      this.lastSrc = src;
    }
  }

  osc(type: OscillatorType | PeriodicWave, freq: number, t0: number, t1: number, detune = 0): OscillatorNode {
    const o = this.e.ac.createOscillator();
    if (typeof type === 'string') o.type = type;
    else o.setPeriodicWave(type);
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    o.start(t0);
    o.stop(t1);
    this.track(o, t1);
    return o;
  }

  noise(kind: NoiseKind, t0: number, t1: number, rate = 1): AudioBufferSourceNode {
    const s = this.e.noiseSource(kind, rate);
    const dur = s.buffer!.duration;
    s.start(t0, this.e.rng.next() * dur * 0.9);
    s.stop(t1);
    this.track(s, t1);
    return s;
  }

  buffer(buf: AudioBuffer, t0: number, rate = 1, t1?: number, loop = false, offset = 0): AudioBufferSourceNode {
    const s = this.e.ac.createBufferSource();
    s.buffer = buf;
    s.loop = loop;
    s.playbackRate.value = rate;
    s.start(t0, offset);
    const end = t1 ?? t0 + (buf.duration - offset) / rate;
    if (t1 !== undefined || loop) s.stop(end);
    this.track(s, end);
    return s;
  }

  gain(v = 1): GainNode {
    return this.e.gain(v);
  }
  filter(type: BiquadFilterType, freq: number, q = 0.707, gainDb = 0): BiquadFilterNode {
    return this.e.filter(type, freq, q, gainDb);
  }
  pan(p: number): StereoPannerNode {
    return this.e.panner(p);
  }

  /** Connect nodes in series; the last one goes to the voice output (or `dest`). */
  chain(...nodes: AudioNode[]): AudioNode {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(this.out);
    return nodes[0];
  }

  /** Must be called once all sources are scheduled. */
  done(): void {
    if (this.finished) return;
    this.finished = true;
    const cleanup = () => {
      try {
        this.out.disconnect();
        for (const n of this.extra) n.disconnect();
      } catch {
        /* already gone */
      }
      this.e.active[this.kind] = Math.max(0, this.e.active[this.kind] - 1);
    };
    if (this.lastSrc) this.lastSrc.onended = cleanup;
    else cleanup();
  }

  get end(): number {
    return this.lastEnd;
  }
}

// ─────────────────────────────────────────────────────────────── envelopes

/** Percussive: 0 → peak in `attack`, exponential decay reaching -60 dB after `t60`. */
export function perc(p: AudioParam, t: number, peak: number, attack: number, t60: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + Math.max(0.0005, attack));
  p.setTargetAtTime(0, t + attack, Math.max(0.001, t60 / 6.9));
  return t + attack + t60;
}

/** Attack / hold / release swell with linear attack and exponential release. */
export function swell(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + Math.max(0.001, attack));
  p.setValueAtTime(peak, t + attack + hold);
  p.setTargetAtTime(0, t + attack + hold, Math.max(0.002, release / 5));
  return t + attack + hold + release * 1.1;
}

/** Exponential glide of a (positive) param from `a` to `b`. */
export function glide(p: AudioParam, t: number, a: number, b: number, dur: number): void {
  p.setValueAtTime(Math.max(1e-4, a), t);
  p.exponentialRampToValueAtTime(Math.max(1e-4, b), t + Math.max(0.001, dur));
}
