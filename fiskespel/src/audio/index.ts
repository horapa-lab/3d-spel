// OWNER: audio agent. Stub.
import type { AudioAPI, GameContext } from '../core/types';

export function createAudio(_ctx: GameContext): AudioAPI {
  return { play() {}, setVolumes() {}, unlock() {}, update() {} };
}
