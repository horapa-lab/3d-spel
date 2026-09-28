/**
 * Generative composer — PURE (no Web Audio). Produces note events bar by bar for a mood.
 * The music director (music.ts) turns them into sound. Tested in tests/audio-composer.test.ts.
 *
 * Structure: 4/4 bars of 16 steps. Chords change every 2 bars; a section is 8 bars with one
 * arrangement (which layers play). Melodies are 2-bar motifs with call/answer variation and rests.
 * OWNER: audio.
 */
import type { InstrumentId } from './instruments';
import { Rng, type MoodId } from './util';

export type Part = 'pad' | 'arp' | 'lead' | 'bass' | 'perc' | 'fx';

export interface NoteEvent {
  /** Step within the bar (0..15, fractional allowed). */
  step: number;
  /** Length in steps (held instruments). */
  len: number;
  midi: number;
  vel: number;
  inst: InstrumentId;
  part: Part;
}

export interface Arrangement {
  w: number;
  pad?: boolean;
  arp?: boolean;
  lead?: boolean;
  bass?: boolean;
  perc?: boolean;
  fx?: boolean;
}

export interface MoodDef {
  id: MoodId;
  bpm: number;
  /** MIDI note of the tonic (octave around 3–4). */
  root: number;
  scale: number[];
  /** Chord roots as scale degrees (0-based); each chord lasts 2 bars. */
  progressions: number[][];
  sevenths: number;
  ninths: number;
  swing: number;
  density: number;
  pad: InstrumentId | null;
  arp: InstrumentId[];
  lead: InstrumentId[];
  bass: InstrumentId | null;
  perc: InstrumentId | null;
  fx: InstrumentId | null;
  arpPatterns: number[][][];
  arpRange: [number, number];
  leadRange: [number, number];
  arrangements: Arrangement[];
  /** Overall level of this mood (linear). */
  level: number;
  /** Root (MIDI) of a major key that sits well over this mood — used by fanfares. */
  fanfareRoot: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const HARM_MINOR = [0, 2, 3, 5, 7, 8, 11];

// arp patterns: [step, chordToneIndex]
const FLOW: number[][] = [[0, 0], [2, 2], [4, 1], [6, 3], [8, 2], [10, 4], [12, 3], [14, 1]];
const TRAVIS: number[][] = [[0, 0], [3, 2], [6, 4], [8, 1], [11, 3], [14, 2]];
const QUARTERS: number[][] = [[0, 0], [4, 2], [8, 3], [12, 2]];
const FALLING: number[][] = [[0, 5], [2, 4], [4, 3], [6, 2], [8, 4], [10, 3], [12, 2], [14, 1]];
const TWINKLE: number[][] = [[0, 2], [1, 4], [2, 5], [3, 6], [8, 3], [9, 5], [10, 6], [12, 4]];
const SPARSE: number[][] = [[0, 0], [6, 3], [10, 2]];
const OSTINATO: number[][] = [[0, 0], [2, 0], [3, 1], [6, 0], [8, 0], [10, 2], [11, 1], [14, 0]];
const ROLLING: number[][] = [[0, 0], [2, 1], [4, 2], [6, 3], [8, 4], [10, 3], [12, 2], [14, 1]];

export const MOODS: Record<MoodId, MoodDef> = {
  day: {
    id: 'day', bpm: 84, root: 62, scale: MAJOR,
    progressions: [[0, 4, 5, 3], [0, 3, 0, 4], [5, 3, 0, 4], [0, 5, 3, 4], [3, 4, 0, 0]],
    sevenths: 0.35, ninths: 0.3, swing: 0.12, density: 0.7,
    pad: 'pad_warm', arp: ['pluck', 'pluck', 'harp'], lead: ['marimba', 'kalimba', 'pluck'], bass: 'bass', perc: 'shaker', fx: null,
    arpPatterns: [FLOW, TRAVIS, QUARTERS, ROLLING], arpRange: [55, 79], leadRange: [67, 86],
    arrangements: [
      { w: 3, pad: true, arp: true, bass: true },
      { w: 3, pad: true, arp: true, lead: true, bass: true },
      { w: 2, arp: true, lead: true },
      { w: 1.5, pad: true, lead: true, bass: true, perc: true },
      { w: 1, pad: true },
    ],
    level: 0.95, fanfareRoot: 62,
  },
  night: {
    id: 'night', bpm: 64, root: 57, scale: DORIAN,
    progressions: [[0, 3, 0, 6], [0, 5, 3, 4], [0, 6, 5, 3], [3, 0, 6, 0]],
    sevenths: 0.6, ninths: 0.45, swing: 0.08, density: 0.45,
    pad: 'pad_warm', arp: ['pluck_soft', 'kalimba'], lead: ['kalimba', 'celesta'], bass: 'bass', perc: null, fx: null,
    arpPatterns: [TRAVIS, SPARSE, QUARTERS, FLOW], arpRange: [52, 76], leadRange: [64, 84],
    arrangements: [
      { w: 3, pad: true, arp: true },
      { w: 2, pad: true, lead: true, bass: true },
      { w: 2, pad: true, arp: true, lead: true },
      { w: 1.5, pad: true },
      { w: 1, arp: true, bass: true },
    ],
    level: 0.85, fanfareRoot: 55,
  },
  storm: {
    id: 'storm', bpm: 72, root: 50, scale: AEOLIAN,
    progressions: [[0, 5, 6, 0], [0, 0, 5, 4], [0, 6, 5, 6]],
    sevenths: 0.2, ninths: 0.1, swing: 0, density: 0.75,
    pad: 'pad_dark', arp: ['pluck_soft'], lead: ['celesta'], bass: 'sub', perc: 'taiko', fx: null,
    arpPatterns: [OSTINATO], arpRange: [45, 64], leadRange: [62, 76],
    arrangements: [
      { w: 3, pad: true, arp: true, bass: true },
      { w: 2, pad: true, arp: true, perc: true, bass: true },
      { w: 1.5, pad: true, perc: true },
      { w: 1, pad: true, lead: true },
    ],
    level: 0.8, fanfareRoot: 53,
  },
  crimson: {
    id: 'crimson', bpm: 58, root: 49, scale: HARM_MINOR,
    progressions: [[0, 5, 0, 4], [0, 1, 0, 4], [0, 3, 5, 4]],
    sevenths: 0.3, ninths: 0, swing: 0, density: 0.4,
    pad: 'choir', arp: ['pluck_soft'], lead: ['celesta', 'bell'], bass: 'sub', perc: 'heartbeat', fx: 'bell_low',
    arpPatterns: [SPARSE, QUARTERS], arpRange: [49, 68], leadRange: [61, 80],
    arrangements: [
      { w: 3, pad: true, perc: true, fx: true },
      { w: 2, pad: true, lead: true, bass: true },
      { w: 2, pad: true, arp: true, perc: true },
      { w: 1, pad: true, fx: true },
    ],
    level: 0.85, fanfareRoot: 52,
  },
  meteor: {
    id: 'meteor', bpm: 76, root: 64, scale: LYDIAN,
    progressions: [[0, 1, 0, 1], [0, 4, 1, 5], [5, 1, 0, 4]],
    sevenths: 0.7, ninths: 0.5, swing: 0, density: 0.65,
    pad: 'pad_glass', arp: ['celesta', 'glock', 'harp'], lead: ['kalimba', 'celesta'], bass: 'bass', perc: null, fx: 'sparkle',
    arpPatterns: [TWINKLE, FLOW, FALLING], arpRange: [64, 91], leadRange: [72, 91],
    arrangements: [
      { w: 3, pad: true, arp: true, fx: true },
      { w: 2, pad: true, arp: true, lead: true, bass: true },
      { w: 2, pad: true, lead: true, fx: true },
      { w: 1, pad: true, fx: true },
    ],
    level: 0.85, fanfareRoot: 64,
  },
  golden: {
    id: 'golden', bpm: 96, root: 65, scale: MAJOR,
    progressions: [[0, 3, 4, 0], [0, 5, 3, 4], [3, 4, 2, 5], [0, 4, 3, 4]],
    sevenths: 0.3, ninths: 0.35, swing: 0.16, density: 0.8,
    pad: 'pad_warm', arp: ['marimba', 'harp'], lead: ['marimba', 'glock', 'kalimba'], bass: 'bass', perc: 'shaker', fx: 'sparkle',
    arpPatterns: [FLOW, ROLLING, TRAVIS], arpRange: [60, 84], leadRange: [72, 91],
    arrangements: [
      { w: 3, pad: true, arp: true, bass: true, perc: true },
      { w: 3, arp: true, lead: true, bass: true, perc: true },
      { w: 2, pad: true, lead: true, fx: true, bass: true },
      { w: 1, pad: true, arp: true },
    ],
    level: 0.95, fanfareRoot: 65,
  },
  migration: {
    id: 'migration', bpm: 88, root: 55, scale: MIXOLYDIAN,
    progressions: [[0, 6, 3, 0], [0, 3, 6, 3], [0, 4, 6, 3]],
    sevenths: 0.4, ninths: 0.4, swing: 0.1, density: 0.75,
    pad: 'pad_warm', arp: ['kalimba', 'pluck'], lead: ['marimba', 'kalimba'], bass: 'bass', perc: 'shaker', fx: null,
    arpPatterns: [ROLLING, FLOW, TRAVIS], arpRange: [55, 79], leadRange: [67, 86],
    arrangements: [
      { w: 3, pad: true, arp: true, bass: true },
      { w: 2, arp: true, lead: true, bass: true, perc: true },
      { w: 2, pad: true, lead: true },
      { w: 1, pad: true, arp: true, perc: true },
    ],
    level: 0.9, fanfareRoot: 55,
  },
  aurora: {
    id: 'aurora', bpm: 60, root: 58, scale: LYDIAN,
    progressions: [[0, 1, 0, 4], [0, 5, 1, 0], [3, 1, 0, 0]],
    sevenths: 0.7, ninths: 0.6, swing: 0, density: 0.4,
    pad: 'pad_glass', arp: ['celesta', 'harp'], lead: ['kalimba'], bass: 'sub', perc: null, fx: 'sparkle',
    arpPatterns: [SPARSE, FALLING, QUARTERS], arpRange: [58, 86], leadRange: [70, 89],
    arrangements: [
      { w: 3, pad: true, arp: true },
      { w: 2, pad: true, lead: true, fx: true },
      { w: 1.5, pad: true, bass: true, fx: true },
    ],
    level: 0.8, fanfareRoot: 58,
  },
  grotto: {
    id: 'grotto', bpm: 70, root: 52, scale: AEOLIAN,
    progressions: [[0, 5, 3, 4], [0, 3, 0, 5], [0, 6, 5, 4]],
    sevenths: 0.5, ninths: 0.5, swing: 0, density: 0.45,
    pad: 'pad_glass', arp: ['kalimba', 'celesta'], lead: ['kalimba'], bass: 'sub', perc: null, fx: 'sparkle',
    arpPatterns: [SPARSE, TWINKLE, QUARTERS], arpRange: [59, 84], leadRange: [68, 88],
    arrangements: [
      { w: 3, pad: true, arp: true },
      { w: 2, pad: true, lead: true, fx: true },
      { w: 1.5, arp: true, fx: true },
    ],
    level: 0.8, fanfareRoot: 55,
  },
  abyss: {
    id: 'abyss', bpm: 50, root: 45, scale: PHRYGIAN,
    progressions: [[0, 1, 0, 6], [0, 0, 5, 1], [0, 3, 1, 0]],
    sevenths: 0.2, ninths: 0, swing: 0, density: 0.3,
    pad: 'pad_dark', arp: ['pluck_soft'], lead: ['bell'], bass: 'sub', perc: null, fx: 'bell_low',
    arpPatterns: [SPARSE], arpRange: [45, 64], leadRange: [60, 76],
    arrangements: [
      { w: 3, pad: true, bass: true, fx: true },
      { w: 2, pad: true, lead: true },
      { w: 1, pad: true, arp: true },
    ],
    level: 0.8, fanfareRoot: 48,
  },
  volcano: {
    id: 'volcano', bpm: 66, root: 53, scale: PHRYGIAN,
    progressions: [[0, 1, 0, 6], [0, 5, 6, 0], [0, 1, 5, 1]],
    sevenths: 0.2, ninths: 0, swing: 0, density: 0.55,
    pad: 'pad_dark', arp: ['pluck_soft'], lead: ['marimba'], bass: 'sub', perc: 'taiko', fx: 'bell_low',
    arpPatterns: [OSTINATO, SPARSE], arpRange: [48, 67], leadRange: [60, 79],
    arrangements: [
      { w: 3, pad: true, arp: true, perc: true },
      { w: 2, pad: true, lead: true, bass: true },
      { w: 1.5, pad: true, fx: true, perc: true },
    ],
    level: 0.85, fanfareRoot: 53,
  },
};

// melody rhythms over 2 bars (32 steps): [step, len]
const RHYTHMS: number[][][] = [
  [[0, 4], [4, 2], [6, 2], [8, 6], [16, 4], [20, 4], [24, 8]],
  [[0, 3], [3, 3], [6, 2], [8, 8], [20, 2], [22, 2], [24, 8]],
  [[2, 2], [4, 2], [6, 4], [12, 4], [16, 8]],
  [[0, 6], [6, 2], [8, 4], [12, 4], [16, 2], [18, 2], [20, 12]],
  [[0, 2], [2, 2], [4, 4], [8, 8], [24, 8]],
  [[4, 4], [8, 2], [10, 2], [12, 4], [16, 16]],
];

// phrase plans for a section (4 slots of 2 bars): 'A' motif, 'a' variation, 'B' new, '-' rest
const PLANS = ['Aa-A', 'A-a-', 'AaB-', '-A-a', 'A-B-', 'AB-a'];

interface Motif {
  rhythm: number[][];
  /** Scale-index offsets relative to the phrase anchor. */
  degrees: number[];
}

/** Scale-index ↔ MIDI helpers. */
export function degreeToMidi(mood: MoodDef, deg: number): number {
  const n = mood.scale.length;
  const oct = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return mood.root + oct * 12 + mood.scale[i];
}

/** Chord tones (scale indices) built diatonically on a degree. */
export function chordDegrees(root: number, seventh: boolean, ninth: boolean): number[] {
  const c = [root, root + 2, root + 4];
  if (seventh) c.push(root + 6);
  if (ninth) c.push(root + 8);
  return c;
}

/** Spread chord tones into a MIDI range, ascending (used by arps). */
export function voiceInRange(mood: MoodDef, chord: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let oct = -3; oct <= 4; oct++) {
    for (const d of chord) {
      const m = degreeToMidi(mood, d + oct * mood.scale.length);
      if (m >= lo && m <= hi) out.push(m);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

export class Composer {
  readonly mood: MoodDef;
  private rng: Rng;
  bar = 0;
  private section: Arrangement = { w: 1, pad: true };
  private prog: number[] = [0];
  private pattern: number[][] = QUARTERS;
  private arpInst: InstrumentId = 'pluck';
  private leadInst: InstrumentId = 'marimba';
  private plan = 'A-a-';
  private motifA: Motif | null = null;
  private motifB: Motif | null = null;
  private chordCache: { bar: number; tones: number[]; seventh: boolean; ninth: boolean } | null = null;
  private lastLead = 0;

  constructor(mood: MoodDef, seed: number) {
    this.mood = mood;
    this.rng = new Rng(seed);
  }

  /** Scale-degree chord (with optional extensions) for the chord starting at the given bar. */
  private chordAt(bar: number): number[] {
    const idx = Math.floor((bar % 8) / 2) % this.prog.length;
    const start = bar - (bar % 2);
    if (!this.chordCache || this.chordCache.bar !== start) {
      this.chordCache = {
        bar: start,
        tones: [],
        seventh: this.rng.chance(this.mood.sevenths),
        ninth: this.rng.chance(this.mood.ninths),
      };
      this.chordCache.tones = chordDegrees(this.prog[idx], this.chordCache.seventh, this.chordCache.ninth);
    }
    return this.chordCache.tones;
  }

  private newSection(): void {
    const m = this.mood;
    this.section = m.arrangements[this.rng.weighted(m.arrangements.map((a) => a.w))];
    this.prog = this.rng.pick(m.progressions);
    this.pattern = this.rng.pick(m.arpPatterns);
    this.arpInst = this.rng.pick(m.arp);
    this.leadInst = this.rng.pick(m.lead);
    this.plan = this.rng.pick(PLANS);
    this.motifA = this.makeMotif();
    this.motifB = this.makeMotif();
  }

  private makeMotif(): Motif {
    const rhythm = this.rng.pick(RHYTHMS);
    const degrees: number[] = [];
    let d = 0;
    for (let i = 0; i < rhythm.length; i++) {
      degrees.push(d);
      d += this.rng.pick([-2, -1, -1, 1, 1, 2, 0, 3, -3, 1]);
      d = Math.max(-4, Math.min(6, d));
    }
    return { rhythm, degrees };
  }

  /** Arrangement active in the current section (for tests / debugging). */
  get arrangement(): Arrangement {
    return this.section;
  }

  /** Generates all events of the next bar. */
  nextBar(): NoteEvent[] {
    const m = this.mood;
    const bar = this.bar++;
    const inSection = bar % 8;
    if (inSection === 0) this.newSection();
    const s = this.section;
    const chord = this.chordAt(bar);
    const ev: NoteEvent[] = [];
    const r = this.rng;
    const dens = m.density;

    // pad — whole chord, held for 2 bars
    if (s.pad && m.pad && bar % 2 === 0) {
      const tones = voiceInRange(m, chord, 50, 74).slice(0, 5);
      for (const midi of tones) ev.push({ step: 0, len: 32, midi, vel: 0.8, inst: m.pad, part: 'pad' });
    }

    // bass — root on the chord's downbeat, optional fifth in the second bar
    if (s.bass && m.bass) {
      const rootMidi = degreeToMidi(m, chord[0] - m.scale.length * 2);
      const midi = rootMidi < 33 ? rootMidi + 12 : rootMidi > 52 ? rootMidi - 12 : rootMidi;
      if (bar % 2 === 0) ev.push({ step: 0, len: 24, midi, vel: 0.75, inst: m.bass, part: 'bass' });
      else if (r.chance(0.55)) ev.push({ step: r.pick([0, 8, 10]), len: 8, midi: midi + (r.chance(0.6) ? 7 : 12), vel: 0.55, inst: m.bass, part: 'bass' });
    }

    // arp — pattern over voiced chord tones, density-gated
    if (s.arp && m.arp.length) {
      const tones = voiceInRange(m, chord, m.arpRange[0], m.arpRange[1]);
      if (tones.length) {
        for (const [step, ti] of this.pattern) {
          if (step !== 0 && !r.chance(0.35 + dens * 0.65)) continue;
          const midi = tones[Math.min(tones.length - 1, ti)];
          const accent = step % 8 === 0 ? 1 : step % 4 === 0 ? 0.85 : 0.7;
          ev.push({ step, len: 4, midi, vel: accent * r.range(0.75, 1), inst: this.arpInst, part: 'arp' });
        }
      }
    }

    // lead — motif-based phrases with rests
    if (s.lead && m.lead.length) {
      const slot = Math.floor(inSection / 2);
      const kind = this.plan[slot];
      const half = bar % 2; // first or second bar of the 2-bar phrase
      if (kind && kind !== '-') {
        const motif = kind === 'B' ? this.motifB! : this.motifA!;
        const phraseChord = this.chordAt(bar - half);
        const center = Math.round((m.leadRange[0] + m.leadRange[1]) / 2);
        // anchor = chord tone nearest the centre of the lead range
        const anchorTones = voiceInRange(m, phraseChord, center - 7, center + 7);
        const anchorMidi = anchorTones.length ? anchorTones[Math.floor(anchorTones.length / 2)] : center;
        const anchorDeg = this.midiToDegree(anchorMidi);
        for (let i = 0; i < motif.rhythm.length; i++) {
          const [st, len] = motif.rhythm[i];
          if (Math.floor(st / 16) !== half) continue;
          let deg = anchorDeg + motif.degrees[i];
          if (kind === 'a' && i >= motif.rhythm.length - 2) deg += r.pick([-1, 1, 2, -2]);
          let midi = degreeToMidi(m, deg);
          // strong beats land on chord tones
          if (st % 8 === 0) midi = this.nearestChordTone(midi, phraseChord);
          // last note resolves to a chord tone
          if (i === motif.rhythm.length - 1) midi = this.nearestChordTone(midi, this.chordAt(bar));
          while (midi > m.leadRange[1]) midi -= 12;
          while (midi < m.leadRange[0]) midi += 12;
          ev.push({ step: st % 16, len, midi, vel: (st % 8 === 0 ? 0.95 : 0.8) * r.range(0.85, 1), inst: this.leadInst, part: 'lead' });
          this.lastLead = midi;
        }
      }
    }

    // perc
    if (s.perc && m.perc) {
      if (m.perc === 'shaker') {
        for (const st of [2, 6, 10, 14]) if (r.chance(0.4 + dens * 0.5)) ev.push({ step: st, len: 1, midi: 0, vel: st % 4 === 2 ? 0.8 : 0.55, inst: 'shaker', part: 'perc' });
      } else if (m.perc === 'heartbeat') {
        if (bar % 2 === 0) {
          ev.push({ step: 0, len: 1, midi: 0, vel: 0.9, inst: 'heartbeat', part: 'perc' });
          ev.push({ step: 2.5, len: 1, midi: 0, vel: 0.6, inst: 'heartbeat', part: 'perc' });
        }
      } else if (m.perc === 'taiko') {
        if (bar % 2 === 0) ev.push({ step: 0, len: 1, midi: 0, vel: 0.85, inst: 'taiko', part: 'perc' });
        if (r.chance(0.35)) ev.push({ step: r.pick([10, 12, 14]), len: 1, midi: 0, vel: 0.5, inst: 'taiko', part: 'perc' });
      }
    }

    // fx — tolls / sparkles at section starts
    if (s.fx && m.fx && (inSection === 0 || (inSection === 4 && r.chance(0.5)))) {
      if (m.fx === 'sparkle') ev.push({ step: r.pick([0, 4, 8]), len: 2.5, midi: degreeToMidi(m, 14), vel: 0.6, inst: 'sparkle', part: 'fx' });
      else ev.push({ step: 0, len: 16, midi: degreeToMidi(m, chord[0]), vel: 0.6, inst: m.fx, part: 'fx' });
    }

    return ev;
  }

  private midiToDegree(midi: number): number {
    const m = this.mood;
    const n = m.scale.length;
    let best = 0;
    let bestD = Infinity;
    for (let d = -3 * n; d <= 4 * n; d++) {
      const dd = Math.abs(degreeToMidi(m, d) - midi);
      if (dd < bestD) {
        bestD = dd;
        best = d;
      }
    }
    return best;
  }

  private nearestChordTone(midi: number, chord: number[]): number {
    const tones = voiceInRange(this.mood, chord, midi - 7, midi + 7);
    let best = midi;
    let bestD = Infinity;
    for (const t of tones) {
      const d = Math.abs(t - midi);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}
