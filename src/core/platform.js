// Thin wrapper around portal SDKs. Works with the CrazyGames SDK v3 when the
// game runs on CrazyGames (or with ?sdk=crazygames for local testing) and
// falls back to a no-op "standalone" mode everywhere else.

const CG_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

function loadScript(src, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    s.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error('load error'));
    };
    document.head.appendChild(s);
  });
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

function onCrazyGames() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('sdk') === 'crazygames') return true;
    if (/crazygames/i.test(location.hostname)) return true;
    if (/crazygames/i.test(document.referrer || '')) return true;
    const anc = location.ancestorOrigins;
    if (anc) for (let i = 0; i < anc.length; i++) if (/crazygames/i.test(anc[i])) return true;
  } catch {
    /* ignore */
  }
  return false;
}

const memoryStore = {};

export const Platform = {
  name: 'standalone',
  sdk: null,
  adPlaying: false,
  listeners: { adStart: [], adEnd: [], mute: [] },

  async init() {
    if (!onCrazyGames()) return;
    try {
      await loadScript(CG_SDK_URL, 5000);
      const sdk = window.CrazyGames && window.CrazyGames.SDK;
      if (!sdk) return;
      await withTimeout(Promise.resolve(sdk.init()), 5000);
      if (sdk.environment === 'crazygames' || sdk.environment === 'local') {
        this.sdk = sdk;
        this.name = 'crazygames';
        try {
          const settings = sdk.game && sdk.game.settings;
          if (settings && settings.muteAudio) this._emit('mute', true);
          if (sdk.game && sdk.game.addSettingsChangeListener) {
            sdk.game.addSettingsChangeListener((s) => this._emit('mute', !!(s && s.muteAudio)));
          }
        } catch {
          /* optional api */
        }
      }
    } catch (e) {
      console.info('[platform] CrazyGames SDK unavailable:', e && e.message);
    }
  },

  on(evt, fn) {
    this.listeners[evt].push(fn);
  },
  _emit(evt, v) {
    for (const fn of this.listeners[evt]) fn(v);
  },

  get hasAds() {
    return !!this.sdk;
  },

  _call(fn) {
    try {
      if (this.sdk) fn(this.sdk);
    } catch (e) {
      console.info('[platform]', e && e.message);
    }
  },
  loadingStart() {
    this._call((s) => s.game.loadingStart());
  },
  loadingStop() {
    this._call((s) => s.game.loadingStop());
  },
  gameplayStart() {
    this._call((s) => s.game.gameplayStart());
  },
  gameplayStop() {
    this._call((s) => s.game.gameplayStop());
  },
  happytime() {
    this._call((s) => s.game.happytime());
  },

  /** Rewarded ad. Resolves true when the reward should be granted. */
  rewarded() {
    if (!this.sdk) return Promise.resolve(true);
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        this.adPlaying = false;
        this._emit('adEnd', ok);
        resolve(ok);
      };
      try {
        this.sdk.ad.requestAd('rewarded', {
          adStarted: () => {
            this.adPlaying = true;
            this._emit('adStart');
          },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
      }
    });
  },

  /** Midgame (interstitial) ad at natural breaks. Never blocks the game for long. */
  midgame() {
    if (!this.sdk) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.adPlaying = false;
        this._emit('adEnd', true);
        resolve();
      };
      try {
        this.sdk.ad.requestAd('midgame', {
          adStarted: () => {
            this.adPlaying = true;
            this._emit('adStart');
          },
          adFinished: finish,
          adError: finish,
        });
        setTimeout(finish, 60000);
      } catch {
        finish();
      }
    });
  },

  // -------- storage (CrazyGames data module when available, else localStorage)
  getItem(key) {
    try {
      if (this.sdk && this.sdk.data) {
        const v = this.sdk.data.getItem(key);
        if (v !== null && v !== undefined) return v;
      }
    } catch {
      /* fall through */
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore[key] ?? null;
    }
  },
  setItem(key, value) {
    try {
      if (this.sdk && this.sdk.data) this.sdk.data.setItem(key, value);
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStore[key] = value;
    }
  },
  removeItem(key) {
    try {
      if (this.sdk && this.sdk.data) this.sdk.data.removeItem(key);
    } catch {
      /* ignore */
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      delete memoryStore[key];
    }
  },
};
