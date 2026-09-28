import { describe, expect, it } from 'vitest';
import { makeRng } from '../src/core/rng';
import { REEL } from '../src/data/constants';
import { RARITIES } from '../src/data/rarities';
import type { Rarity } from '../src/core/types';
import { barWidthFor, createReelSim, fishProfile, REEL_PHYS, reelDifficulty } from '../src/game/fishing/reel';

const base = { barWidth: 0.25, resilience: 1, rarity: 'common' as Rarity, gainMult: 1 };

describe('reel — player bar physics', () => {
  it('holding accelerates right, releasing accelerates left, speed is capped', () => {
    const sim = createReelSim({ ...base, lockSeconds: 0 }, makeRng(1), 0.5);
    const x0 = sim.state.barPos;
    for (let i = 0; i < 3; i++) sim.step(0.1, true);
    expect(sim.state.barVel).toBeGreaterThan(0.9);
    expect(sim.state.barPos).toBeGreaterThan(x0);
    for (let i = 0; i < 10; i++) sim.step(0.1, true);
    expect(sim.state.barVel).toBeLessThanOrEqual(REEL_PHYS.maxSpeed);
    const sim2 = createReelSim({ ...base, lockSeconds: 0 }, makeRng(1), 0.5);
    sim2.step(0.2, false);
    expect(sim2.state.barVel).toBeLessThan(0);
  });

  it('bounces softly at the edges and stays on the track', () => {
    const sim = createReelSim({ ...base, lockSeconds: 0, gainMult: 0.0001 }, makeRng(2), 0.5);
    let bounced = false;
    for (let i = 0; i < 300; i++) {
      const v = sim.state.barVel;
      sim.step(1 / 60, true);
      if (v > 0.5 && sim.state.barVel < 0) bounced = true;
      expect(sim.state.barPos).toBeGreaterThanOrEqual(0);
      expect(sim.state.barPos).toBeLessThanOrEqual(1 - sim.state.barWidth + 1e-9);
    }
    expect(bounced).toBe(true);
  });

  it('bar width = base + control, clamped', () => {
    expect(barWidthFor(0)).toBeCloseTo(REEL.baseBarWidth);
    expect(barWidthFor(0.1)).toBeCloseTo(REEL.baseBarWidth + 0.1);
    expect(barWidthFor(5)).toBe(REEL.maxBarWidth);
    expect(barWidthFor(-5)).toBe(REEL.minBarWidth);
  });
});

describe('reel — lock, progress, results', () => {
  it('input is ignored and progress cannot drop during the lock', () => {
    const sim = createReelSim({ ...base }, makeRng(3), 0.5);
    const x0 = sim.state.barPos;
    sim.step(REEL.lockSeconds * 0.8, true);
    expect(sim.state.locked).toBe(true);
    expect(Math.abs(sim.state.barPos - x0)).toBeLessThan(1e-6);
    expect(sim.state.progress).toBeGreaterThan(REEL.startProgress);
    sim.step(REEL.lockSeconds * 0.3, true);
    expect(sim.state.locked).toBe(false);
  });

  it('progress rises at progressGain × mult while inside', () => {
    const sim = createReelSim({ ...base, barWidth: 0.6, resilience: 100, gainMult: 0.5 }, makeRng(4), 0.5);
    sim.step(1, false); // lock (bar frozen, fish inside)
    const p0 = sim.state.progress;
    expect(p0).toBeCloseTo(REEL.startProgress + REEL.progressGain * 0.5, 3);
  });

  it('progress falls outside the bar after the lock → escape at 0, perfect lost', () => {
    const sim = createReelSim({ ...base, barWidth: 0.1, resilience: 100 }, makeRng(5), 0.9);
    let res = null;
    for (let i = 0; i < 60 * 20 && !res; i++) res = sim.step(1 / 60, false); // bar slides left, fish stays right
    expect(res).toBe('escaped');
    expect(sim.state.perfect).toBe(false);
    expect(sim.state.progress).toBe(0);
  });

  it('a fish that never leaves the bar is a perfect catch', () => {
    const sim = createReelSim({ ...base, barWidth: 0.6, resilience: 100 }, makeRng(6), 0.5);
    let res = null;
    let t = 0;
    // feather the button to hover
    while (!res && t < 30) {
      res = sim.step(1 / 60, sim.state.barPos + 0.3 < sim.state.fishPos || sim.state.barVel < -0.05);
      t += 1 / 60;
    }
    expect(res).toBe('caught');
    expect(sim.state.perfect).toBe(true);
    expect(t).toBeCloseTo((1 - REEL.startProgress) / REEL.progressGain, 0);
  });
});

describe('reel — fish behaviour', () => {
  const meanInterval = (res: number, dt: number, rarity: Rarity = 'common') => {
    const sim = createReelSim({ ...base, rarity, resilience: res, lockSeconds: 0, gainMult: 0, lossMult: 0, barWidth: 0.6 }, makeRng(9), 0.5);
    let t = 0;
    while (t < 400) {
      sim.step(dt, false);
      t += dt;
      if (sim.state.result) break;
    }
    return t / Math.max(1, sim.state.darts);
  };

  it('dart interval follows the resilience formula (≈ 2.2–2.5 × resilience) independent of frame rate', () => {
    for (const res of [0.4, 1, 1.5]) {
      const a = meanInterval(res, 1 / 30);
      const b = meanInterval(res, 1 / 144);
      expect(a / res).toBeGreaterThan(2.05);
      expect(a / res).toBeLessThan(2.8);
      expect(Math.abs(a - b) / a).toBeLessThan(0.12);
    }
  });

  it('rarer fish dart further and faster', () => {
    const c = fishProfile('common', 1);
    const m = fishProfile('mythical', 1);
    expect(m.maxJump).toBeGreaterThan(c.maxJump);
    expect(m.maxSpeed).toBeGreaterThan(c.maxSpeed);
    expect(m.omega).toBeGreaterThan(c.omega);
    expect(fishProfile('limited', 1).maxJump).toBe(fishProfile('mythical', 1).maxJump);
    expect(reelDifficulty('secret', 0.3, 0.2)).toBeGreaterThan(reelDifficulty('common', 1.3, 0.3));
  });

  it('the fish stays on the track', () => {
    const sim = createReelSim({ ...base, rarity: 'secret', resilience: 0.25, lockSeconds: 0, gainMult: 0, lossMult: 0, barWidth: 0.6 }, makeRng(10), 0.5);
    for (let i = 0; i < 60 * 60; i++) {
      sim.step(1 / 60, i % 20 < 10);
      expect(sim.state.fishPos).toBeGreaterThan(0);
      expect(sim.state.fishPos).toBeLessThan(1);
    }
  });
});

describe('reel — auto reel & balance', () => {
  const play = (rarity: Rarity, res: number, width: number, auto: boolean, seed: number) => {
    const sim = createReelSim({ barWidth: width, resilience: res, rarity, gainMult: RARITIES[rarity].progressMult, auto }, makeRng(seed));
    let t = 0;
    while (!sim.state.result && t < 120) {
      sim.step(1 / 60, false);
      t += 1 / 60;
    }
    return { res: sim.state.result, t, perfect: sim.state.perfect };
  };

  it('auto-reel lands commons at ~60 % speed and is never perfect', () => {
    let caught = 0;
    let time = 0;
    for (let i = 0; i < 40; i++) {
      const r = play('common', 1.2, 0.2, true, i + 1);
      expect(r.perfect).toBe(false);
      if (r.res === 'caught') {
        caught++;
        time += r.t;
      }
    }
    expect(caught).toBe(40);
    const ideal = (1 - REEL.startProgress) / REEL.progressGain;
    expect(time / caught).toBeGreaterThan(ideal / 0.6 * 0.95);
    expect(time / caught).toBeLessThan(ideal / 0.6 * 1.35);
  });

  it('auto-reel struggles with a secret fish on a starter bar', () => {
    let caught = 0;
    for (let i = 0; i < 20; i++) if (play('secret', 0.25, 0.2, true, 100 + i).res === 'caught') caught++;
    expect(caught).toBeLessThan(10);
  });

  it('doing nothing loses non-trivial fish', () => {
    let escaped = 0;
    for (let i = 0; i < 20; i++) if (play('rare', 0.75, 0.2, false, 200 + i).res === 'escaped') escaped++;
    expect(escaped).toBeGreaterThan(15);
  });
});
