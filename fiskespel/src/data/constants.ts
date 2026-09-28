/** Global tuning constants shared by several systems. */
export const GAME_TITLE = 'Reel Isles';

/** One full day+night cycle (real ms). Day = first half, night = second half. */
export const DAY_CYCLE_MS = 16 * 60 * 1000;
/** Seasons rotate once per real UTC day. */
export const SEASON_MS = 24 * 60 * 60 * 1000;
/** UTC epoch the world clock counts from. */
export const WORLD_EPOCH = Date.UTC(2026, 0, 1);

export const STARTER_ROD = 'starter_rod';
export const STARTER_BOBBER = 'classic_bobber';
export const START_LOCATION = 'driftwood_harbor';
export const BACKPACK_START = 30;
export const SAVE_KEY = 'reel-isles-save-v1';

/** Reel minigame core tuning (Fisch-like). */
export const REEL = {
  baseBarWidth: 0.2,
  minBarWidth: 0.08,
  maxBarWidth: 0.6,
  progressGain: 0.12, // per second inside
  progressLoss: 0.12, // per second outside
  startProgress: 0.2,
  lockSeconds: 1.2,
  perfectXpMult: 1.5,
  perfectBonusCoins: 10,
};

/** Bite timing. */
export const BITE = {
  minSeconds: 4,
  maxSeconds: 11,
  minFloor: 0.8,
  shakeReduce: 0.5,
};
