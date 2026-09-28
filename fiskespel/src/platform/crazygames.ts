/**
 * Platform layer. OWNER: economy/platform author.
 *
 * `createPlatform()` detects whether we run inside CrazyGames (iframe whose referrer / ancestor
 * origins mention crazygames, a crazygames host, or `?sdk=1`). Only then the CrazyGames HTML5 SDK v3
 * is loaded from their CDN and initialised. Everything else (local dev, other hosts, blocked SDK,
 * init timeout) falls back to a local implementation: localStorage saves and a fake 1.5 s ad overlay
 * so every ad flow is testable. Nothing here may ever throw into the game.
 *
 * Debug params: `?sdk=1` force the SDK, `?sdk=0` force local, `?noads=1` local ads resolve instantly
 * (midgame skipped, rewarded granted), `?adfail=1` local rewarded ads fail (no reward).
 */
import type { PlatformAPI } from '../core/types';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const SCRIPT_TIMEOUT_MS = 6000;
const INIT_TIMEOUT_MS = 6000;
/** An ad that has not started within this time counts as failed. */
const AD_START_TIMEOUT_MS = 8000;
/** Hard cap for a running ad (the SDK should call adFinished long before this). */
const AD_RUN_TIMEOUT_MS = 120000;
const FAKE_AD_MS = 1500;
const HAPPYTIME_MIN_GAP_MS = 20000;

// ─────────────────────────────────────────────────────────── minimal SDK v3 typing (subset we use)

interface CgAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

interface CgSdk {
  init(): Promise<void>;
  /** 'crazygames' | 'local' | 'disabled' */
  environment?: string;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
  };
  ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks: CgAdCallbacks): void | Promise<unknown>;
    hasAdblock?(): Promise<boolean>;
  };
  data?: {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem?(key: string): void;
  };
  user?: {
    isUserAccountAvailable?: boolean;
    getUser(): Promise<{ username?: string } | null>;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CgSdk };
  }
}

// ─────────────────────────────────────────────────────────── helpers

function params(): URLSearchParams {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
}

/** True when the page looks like it is hosted by CrazyGames. Pure-ish (reads location/document). */
export function detectCrazyGames(): boolean {
  try {
    const p = params();
    if (p.get('sdk') === '1') return true;
    if (p.get('sdk') === '0') return false;
    const re = /crazygames/i;
    if (re.test(location.hostname)) return true;
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true; // cross-origin access to top throws → we are framed
    }
    if (!inIframe) return false;
    if (re.test(document.referrer || '')) return true;
    const ao = (location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
    if (ao) for (let i = 0; i < ao.length; i++) if (re.test(ao[i] ?? '')) return true;
    return false;
  } catch {
    return false;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function loadScript(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      const t = setTimeout(() => reject(new Error('sdk script timeout')), timeoutMs);
      s.onload = () => {
        clearTimeout(t);
        resolve();
      };
      s.onerror = () => {
        clearTimeout(t);
        reject(new Error('sdk script failed to load'));
      };
      document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota / privacy mode: ignore */
  }
}

/** Fake ad overlay for local testing. Resolves after `ms`. */
function fakeAdOverlay(kind: 'rewarded' | 'midgame', ms: number): Promise<void> {
  return new Promise((resolve) => {
    let el: HTMLDivElement | null = null;
    try {
      el = document.createElement('div');
      el.setAttribute('data-fake-ad', kind);
      el.style.cssText =
        'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;gap:14px;background:rgba(8,12,20,.88);color:#e8eef6;' +
        'font:600 18px/1.3 system-ui,sans-serif;letter-spacing:.02em;pointer-events:all;user-select:none';
      const title = document.createElement('div');
      title.textContent = kind === 'rewarded' ? 'Rewarded ad (local test)' : 'Advertisement (local test)';
      const track = document.createElement('div');
      track.style.cssText = 'width:min(320px,70vw);height:6px;border-radius:3px;background:rgba(255,255,255,.15);overflow:hidden';
      const bar = document.createElement('div');
      bar.style.cssText = `height:100%;width:0;background:#ffcc33;transition:width ${ms}ms linear`;
      track.appendChild(bar);
      el.append(title, track);
      document.body.appendChild(el);
      requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = '100%')));
    } catch {
      el = null;
    }
    setTimeout(() => {
      try {
        el?.remove();
      } catch {
        /* ignore */
      }
      resolve();
    }, ms);
  });
}

// ─────────────────────────────────────────────────────────── factory

export async function createPlatform(): Promise<PlatformAPI> {
  const p = params();
  const noAds = p.get('noads') === '1';
  const adFail = p.get('adfail') === '1';

  let sdk: CgSdk | null = null;
  if (detectCrazyGames()) {
    try {
      if (!window.CrazyGames?.SDK) await loadScript(SDK_URL, SCRIPT_TIMEOUT_MS);
      const s = window.CrazyGames?.SDK;
      if (!s) throw new Error('SDK global missing after load');
      await withTimeout(Promise.resolve(s.init()), INIT_TIMEOUT_MS, 'SDK.init');
      if (s.environment === 'disabled') throw new Error('SDK environment disabled');
      sdk = s;
    } catch (err) {
      console.info('[platform] CrazyGames SDK unavailable, using local fallback:', String(err));
      sdk = null;
    }
  }

  let gameplayActive = false;
  let adActive = false;
  let lastHappy = -Infinity;

  const safe = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      console.info('[platform] sdk call failed', err);
    }
  };

  const api: PlatformAPI = {
    env: sdk ? 'crazygames' : 'local',
    loadingStart() {
      if (sdk) safe(() => sdk!.game.loadingStart());
    },
    loadingStop() {
      if (sdk) safe(() => sdk!.game.loadingStop());
    },
    gameplayStart() {
      if (gameplayActive) return;
      gameplayActive = true;
      if (sdk && !adActive) safe(() => sdk!.game.gameplayStart());
    },
    gameplayStop() {
      if (!gameplayActive) return;
      gameplayActive = false;
      if (sdk && !adActive) safe(() => sdk!.game.gameplayStop());
    },
    happytime() {
      const now = Date.now();
      if (now - lastHappy < HAPPYTIME_MIN_GAP_MS) return;
      lastHappy = now;
      if (sdk) safe(() => sdk!.game.happytime());
    },
    rewarded: (placement: string) => showAd('rewarded', placement),
    midgame: async () => {
      await showAd('midgame', 'midgame');
    },
    async getItem(key) {
      if (sdk?.data) {
        try {
          const v = await withTimeout(Promise.resolve(sdk.data.getItem(key)), 4000, 'data.getItem');
          if (v != null) return v;
        } catch (err) {
          console.info('[platform] SDK data.getItem failed, using localStorage', err);
        }
      }
      return lsGet(key);
    },
    async setItem(key, value) {
      api.setItemSync!(key, value);
    },
    setItemSync(key, value) {
      if (sdk?.data) {
        try {
          const r = sdk.data.setItem(key, value);
          if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => {});
        } catch (err) {
          console.info('[platform] SDK data.setItem failed', err);
        }
      }
      // Local mirror: survives SDK outages and lets a later cloud-less session continue.
      lsSet(key, value);
    },
    async username() {
      if (!sdk?.user) return null;
      try {
        if (sdk.user.isUserAccountAvailable === false) return null;
        const u = await withTimeout(sdk.user.getUser(), 4000, 'user.getUser');
        return u?.username ?? null;
      } catch {
        return null;
      }
    },
    adPlaying: () => adActive,
  };

  function adStart() {
    if (adActive) return;
    adActive = true;
    // Tell the SDK gameplay paused (without flipping our own flag so we can resume after).
    if (sdk && gameplayActive) safe(() => sdk!.game.gameplayStop());
    try {
      api.onAd?.('start');
    } catch (err) {
      console.error('[platform] onAd(start) handler failed', err);
    }
  }

  function adEnd() {
    if (!adActive) return;
    adActive = false;
    if (sdk && gameplayActive) safe(() => sdk!.game.gameplayStart());
    try {
      api.onAd?.('end');
    } catch (err) {
      console.error('[platform] onAd(end) handler failed', err);
    }
  }

  /** Resolves true when a rewarded ad finished (grant reward). Never rejects. */
  async function showAd(type: 'rewarded' | 'midgame', placement: string): Promise<boolean> {
    if (adActive) return false; // never stack ads
    if (!sdk) {
      if (noAds) return type === 'rewarded' ? !adFail : true;
      adStart();
      await fakeAdOverlay(type, FAKE_AD_MS);
      adEnd();
      return type === 'rewarded' ? !adFail : true;
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let started = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ok: boolean, why: string) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (started) adEnd();
        if (!ok) console.info(`[platform] ${type} ad (${placement}) not shown: ${why}`);
        resolve(ok);
      };
      timer = setTimeout(() => finish(false, 'start timeout'), AD_START_TIMEOUT_MS);
      try {
        const r = sdk!.ad.requestAd(type, {
          adStarted: () => {
            if (settled || started) return;
            started = true;
            adStart();
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => finish(false, 'run timeout'), AD_RUN_TIMEOUT_MS);
          },
          adFinished: () => finish(true, 'finished'),
          adError: (e) => finish(false, `error ${String((e as { code?: string })?.code ?? e)}`),
        });
        if (r && typeof (r as Promise<unknown>).catch === 'function') {
          (r as Promise<unknown>).catch((e) => finish(false, `rejected ${String(e)}`));
        }
      } catch (e) {
        finish(false, `threw ${String(e)}`);
      }
    });
  }

  return api;
}
