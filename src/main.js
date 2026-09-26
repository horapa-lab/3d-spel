import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/luckiest-guy/latin-400.css';
import './ui/style.css';
import { Platform } from './core/platform.js';
import { Game } from './game/game.js';

const TIPS = [
  'Loading the armory...',
  'Tip: rarer guns are MUCH stronger',
  'Tip: boss crates always drop Rare or better',
  'Tip: upgrade the Idle Vault to earn while offline',
  'Tip: duplicates merge and level up your guns',
];

const fill = document.getElementById('loadFill');
const tip = document.getElementById('loadTip');
let tipI = 0;
const tipTimer = setInterval(() => {
  tipI = (tipI + 1) % TIPS.length;
  tip.textContent = TIPS[tipI];
}, 1600);

function setProgress(p) {
  fill.style.width = `${Math.round(p * 100)}%`;
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot() {
  setProgress(0.05);
  if (!webglAvailable()) {
    clearInterval(tipTimer);
    tip.outerHTML = '<div class="load-err">Your browser or device does not support WebGL, which this 3D game needs. Try a recent Chrome, Edge, Firefox or Safari.</div>';
    return;
  }
  await Platform.init();
  Platform.loadingStart();
  // make sure the fonts are ready before the first frame (canvas text uses them)
  try {
    await Promise.race([
      Promise.all([document.fonts.load('20px "Lilita One"'), document.fonts.load('20px "Luckiest Guy"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* fonts are optional */
  }
  const game = new Game(document.getElementById('app'));
  // test hook only on local dev servers
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__game = game;
  try {
    await game.init((p) => setProgress(0.1 + p * 0.9));
  } catch (e) {
    console.error(e);
    clearInterval(tipTimer);
    tip.outerHTML = `<div class="load-err">Something went wrong while loading. Please reload the page.<br><small>${String(e && e.message)}</small></div>`;
    return;
  }
  Platform.loadingStop();
  clearInterval(tipTimer);
  setProgress(1);
  game.start();
  const loading = document.getElementById('loading');
  setTimeout(() => {
    loading.classList.add('done');
    setTimeout(() => loading.remove(), 600);
  }, 200);
}

const showcase = new URLSearchParams(location.search).get('showcase');
if (showcase) {
  clearInterval(tipTimer);
  document.fonts.load('20px "Lilita One"').finally(() => import('./debug/showcase.js').then((m) => m.runShowcase(showcase)));
} else {
  boot();
}
