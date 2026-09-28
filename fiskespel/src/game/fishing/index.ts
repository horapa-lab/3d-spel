// OWNER: fishing/world-state agent. Stub.
import type { FishingAPI, GameContext } from '../../core/types';

export function createFishing(_ctx: GameContext): FishingAPI {
  return {
    phase: 'idle', castPower: 0, shakeButtons: [], clickShake() {}, reel: null, hookedRarity: null,
    lastCatch: null, bobberPosition: null, currentZone: null, autoReel: false, setAutoReel() {},
    canRetryEscaped: () => false, retryEscaped() {}, cancel() {}, update() {},
  };
}
