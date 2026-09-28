// OWNER: economy/platform agent. Stub (local only).
import type { PlatformAPI } from '../core/types';

export async function createPlatform(): Promise<PlatformAPI> {
  return {
    env: 'local',
    loadingStart() {}, loadingStop() {}, gameplayStart() {}, gameplayStop() {}, happytime() {},
    rewarded: async () => true,
    midgame: async () => {},
    getItem: async (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    setItem: async (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
    username: async () => null,
  };
}
