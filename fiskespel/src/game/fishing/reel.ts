/**
 * Reel minigame physics — pure and steppable (unit-tested, also used by the auto-reel bot).
 *
 * Track is normalised 0..1.
 *  - Player bar: hold → accelerate right, release → accelerate left, capped speed, soft bounce
 *    at the edges. Width = REEL.baseBarWidth + rod control (clamped).
 *  - Fish: Fisch-style resilience timing — every frame a random interval in [2, 5.1] × resilience
 *    is compared with the time since the last dart; once exceeded the fish darts to a new target
 *    (hazard made frame-rate independent). Rarer fish dart further and faster.
 *  - Progress: +gain/s while the fish is inside the bar, −loss/s outside. Starts at
 *    REEL.startProgress. For the first REEL.lockSeconds (or until +20 % progress) input is
 *    ignored and progress cannot drop. Catch at 1, escape at 0. Perfect = never outside after lock.
 */
import type { Rarity } from '../../core/types';
import { RARITIES } from '../../data/rarities';
import { REEL } from '../../data/constants';

export type Rng = () => number;

export const REEL_PHYS = {
  /** Bar acceleration while holding (track widths / s²). */
  accel: 3.3,
  /** Bar acceleration to the left while released. */
  gravity: 3.3,
  maxSpeed: 1.25,
  /** Velocity kept (and reversed) when the bar hits an edge. */
  bounce: 0.3,
  /** Resilience interval range (× resilience). */
  intervalMin: 2,
  intervalMax: 5.1,
  /** Fish keeps this far from the track ends. */
  margin: 0.045,
  /** Inside-test tolerance (half the fish icon). */
  tolerance: 0.006,
  /** Physics sub-step (s). */
  substep: 1 / 120,
  /** Auto-reel progress multiplier. */
  autoGain: 0.6,
  autoLoss: 1,
};

/** Difficulty tier for fish behaviour (limited event fish fight like mythicals). */
export function rarityTier(r: Rarity): number {
  if (r === 'limited') return 6;
  return RARITIES[r]?.order ?? 1;
}

export function barWidthFor(control: number): number {
  const w = REEL.baseBarWidth + (Number.isFinite(control) ? control : 0);
  return Math.min(REEL.maxBarWidth, Math.max(REEL.minBarWidth, w));
}

/** Fish movement profile from rarity + effective resilience. */
export function fishProfile(rarity: Rarity, resilience: number) {
  const tier = rarityTier(rarity);
  const res = Math.max(0.05, resilience);
  const frantic = Math.min(1.25, Math.max(0.85, 1.28 - 0.25 * res));
  return {
    tier,
    /** Max distance of one dart (track fraction). */
    maxJump: Math.min(0.74, 0.26 + 0.06 * tier),
    /** Spring stiffness (1/s). */
    omega: (3.0 + 0.45 * tier) * frantic,
    /** Max fish speed (track widths / s). */
    maxSpeed: Math.min(0.95, (0.5 + 0.065 * tier) * frantic),
    /** Legendary+ occasionally chain a second dart right away ("rush"). */
    rushChance: tier >= 5 ? 0.12 + 0.05 * (tier - 5) : 0,
  };
}

/** 0..1 difficulty for UI colour/shake. */
export function reelDifficulty(rarity: Rarity, resilience: number, barWidth: number): number {
  const tier = rarityTier(rarity);
  const res = Math.min(2, Math.max(0, resilience));
  const d = 0.45 * (tier / 8) + 0.4 * (1 - res / 2) + 0.15 * (1 - Math.min(1, barWidth / 0.4));
  return Math.min(1, Math.max(0, d));
}

export interface ReelParams {
  barWidth: number;
  /** Effective resilience: fish × (1 + rod resilience) × (1 + calm_waters) × … Higher = calmer. */
  resilience: number;
  rarity: Rarity;
  /** Multiplier on progress gain (rarity × fish × overweight × reel_power). */
  gainMult: number;
  /** Multiplier on progress loss. Default 1. */
  lossMult?: number;
  /** Bot plays: gain × REEL_PHYS.autoGain, never perfect. */
  auto?: boolean;
  startProgress?: number;
  lockSeconds?: number;
}

export interface ReelSimState {
  barPos: number;
  barVel: number;
  barWidth: number;
  fishPos: number;
  fishVel: number;
  fishTarget: number;
  progress: number;
  inside: boolean;
  locked: boolean;
  perfect: boolean;
  time: number;
  sinceDart: number;
  darts: number;
  /** Seconds the fish spent outside the bar (after the lock). */
  outsideTime: number;
  /** Holding state actually applied last step (auto or player). */
  holding: boolean;
  result: 'caught' | 'escaped' | null;
}

export interface ReelSim {
  readonly params: ReelParams;
  readonly state: ReelSimState;
  /** Advance by dt seconds. `holding` = primary held. Returns the result once finished. */
  step(dt: number, holding: boolean): 'caught' | 'escaped' | null;
  /** Switch the auto-reel bot on/off mid-fight (turning it on forfeits "perfect"). */
  setAuto(on: boolean): void;
  readonly auto: boolean;
}

/**
 * Auto-reel controller: decide whether to hold (bang-bang PD). `fishPos`/`fishVel` are what the
 * bot "sees" — the sim feeds it a lagged estimate so it plays like a steady human, not a robot.
 */
export function autoHold(s: Pick<ReelSimState, 'barPos' | 'barVel' | 'barWidth' | 'fishPos' | 'fishVel'>): boolean {
  const centre = s.barPos + s.barWidth / 2;
  const err = s.fishPos + s.fishVel * 0.12 - centre;
  return err * 14 - s.barVel * 2.6 > -0.12;
}

/** Perception lag of the auto-reel bot (s). */
export const AUTO_LAG = 0.14;

export function createReelSim(params: ReelParams, rng: Rng = Math.random, startFish?: number): ReelSim {
  const w = Math.min(REEL.maxBarWidth, Math.max(REEL.minBarWidth, params.barWidth));
  const prof = fishProfile(params.rarity, params.resilience);
  const res = Math.max(0.05, params.resilience);
  const start = params.startProgress ?? REEL.startProgress;
  const lockSeconds = params.lockSeconds ?? REEL.lockSeconds;
  const lossMult = params.lossMult ?? 1;
  let auto = !!params.auto;
  let gain = 0;
  let loss = 0;
  const setRates = () => {
    gain = REEL.progressGain * Math.max(0, params.gainMult) * (auto ? REEL_PHYS.autoGain : 1);
    loss = REEL.progressLoss * Math.max(0, lossMult) * (auto ? REEL_PHYS.autoLoss : 1);
  };
  setRates();
  const f0 = startFish ?? 0.3 + rng() * 0.4;
  const phase = rng() * 10;

  const s: ReelSimState = {
    barPos: Math.min(1 - w, Math.max(0, f0 - w / 2)),
    barVel: 0,
    barWidth: w,
    fishPos: f0,
    fishVel: 0,
    fishTarget: f0,
    progress: start,
    inside: true,
    locked: true,
    perfect: !auto,
    time: 0,
    sinceDart: 0,
    darts: 0,
    outsideTime: 0,
    holding: false,
    result: null,
  };
  let core = f0; // fish position without the idle wiggle
  let seenPos = f0; // auto-reel perception (low-passed)
  let seenVel = 0;

  const newTarget = () => {
    const m = REEL_PHYS.margin;
    let dir = rng() < 0.5 ? -1 : 1;
    const dist = prof.maxJump * (0.35 + 0.65 * rng());
    let t = core + dir * dist;
    if (t < m || t > 1 - m) {
      dir = -dir;
      t = core + dir * dist;
    }
    s.fishTarget = Math.min(1 - m, Math.max(m, t));
    s.sinceDart = 0;
    s.darts++;
  };

  const sub = (h: number, holdingIn: boolean) => {
    s.time += h;
    s.locked = s.time < lockSeconds && s.progress < start + 0.2;
    let holding = holdingIn;
    if (auto) {
      const k = 1 - Math.exp(-h / AUTO_LAG);
      const prev = seenPos;
      seenPos += (s.fishPos - seenPos) * k;
      seenVel += ((seenPos - prev) / h - seenVel) * k;
      holding = autoHold({ barPos: s.barPos, barVel: s.barVel, barWidth: w, fishPos: seenPos, fishVel: seenVel });
    }
    s.holding = holding;

    // ── player bar
    if (s.locked) {
      s.barVel *= Math.exp(-10 * h);
    } else {
      s.barVel += (holding ? REEL_PHYS.accel : -REEL_PHYS.gravity) * h;
      if (s.barVel > REEL_PHYS.maxSpeed) s.barVel = REEL_PHYS.maxSpeed;
      if (s.barVel < -REEL_PHYS.maxSpeed) s.barVel = -REEL_PHYS.maxSpeed;
    }
    s.barPos += s.barVel * h;
    if (s.barPos < 0) {
      s.barPos = 0;
      if (s.barVel < 0) s.barVel = -s.barVel * REEL_PHYS.bounce;
    } else if (s.barPos > 1 - w) {
      s.barPos = 1 - w;
      if (s.barVel > 0) s.barVel = -s.barVel * REEL_PHYS.bounce;
    }

    // ── fish
    s.sinceDart += h;
    if (!s.locked) {
      const p = Math.min(1, Math.max(0, (s.sinceDart / res - REEL_PHYS.intervalMin) / (REEL_PHYS.intervalMax - REEL_PHYS.intervalMin)));
      if (p > 0) {
        const pStep = 1 - Math.pow(1 - p, h * 60);
        if (rng() < pStep) {
          newTarget();
          // occasional rush: queue an early follow-up dart
          if (prof.rushChance > 0 && rng() < prof.rushChance) s.sinceDart = res * REEL_PHYS.intervalMin * 0.8;
        }
      }
    }
    const om = s.locked ? prof.omega * 0.5 : prof.omega;
    const acc = om * om * (s.fishTarget - core) - 2 * om * s.fishVel;
    s.fishVel += acc * h;
    const vmax = s.locked ? prof.maxSpeed * 0.3 : prof.maxSpeed;
    if (s.fishVel > vmax) s.fishVel = vmax;
    if (s.fishVel < -vmax) s.fishVel = -vmax;
    core += s.fishVel * h;
    core = Math.min(1 - REEL_PHYS.margin * 0.5, Math.max(REEL_PHYS.margin * 0.5, core));
    const wiggle = 0.006 * Math.sin(s.time * 7.1 + phase) + 0.004 * Math.sin(s.time * 12.7 + phase * 2);
    s.fishPos = core + wiggle;

    // ── progress
    const tol = REEL_PHYS.tolerance;
    s.inside = s.fishPos >= s.barPos - tol && s.fishPos <= s.barPos + w + tol;
    if (s.inside) s.progress += gain * h;
    else if (!s.locked) {
      s.progress -= loss * h;
      s.outsideTime += h;
      s.perfect = false;
    }
    if (s.progress >= 1) {
      s.progress = 1;
      s.result = 'caught';
    } else if (s.progress <= 0) {
      s.progress = 0;
      s.result = 'escaped';
    }
  };

  return {
    params,
    state: s,
    get auto() {
      return auto;
    },
    setAuto(on) {
      if (on === auto) return;
      auto = on;
      if (on) {
        s.perfect = false;
        seenPos = s.fishPos;
        seenVel = s.fishVel;
      }
      setRates();
    },
    step(dt, holding) {
      if (s.result) return s.result;
      let left = Math.max(0, Math.min(1, dt));
      while (left > 1e-9 && !s.result) {
        const h = Math.min(REEL_PHYS.substep, left);
        sub(h, holding);
        left -= h;
      }
      return s.result;
    },
  };
}
