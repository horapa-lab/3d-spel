// Produces a set of review screenshots + a functional log for the critics.
// node tools/review.mjs <outDir>
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
import fs from 'node:fs';
const { chromium } = pw;
const out = process.argv[2] || 'tools/out/review';
fs.mkdirSync(out, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const log = [];
const errors = [];
// headless software rendering runs ~2 fps: freeze CSS animations to their end state for clean stills
const STILL_CSS = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}';
async function open(query, w = 1280, h = 720) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${query}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${query}: [pageerror] ${e.message}`));
  await page.goto(BASE + '?' + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.ui && !document.getElementById('loading'), null, { timeout: 90000 });
  await page.addStyleTag({ content: STILL_CSS });
  await page.waitForTimeout(300);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
async function shot(page, name) {
  await ev(page, () => { __game.ui.refreshAll(); __game.render(0.016); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
}

// 1. fresh start + first crate
let p = await open('reset=1');
await ev(p, () => __game.debugStep(5));
await shot(p, '01_start');
await ev(p, () => { __game.player.obj.position.set(0, 0, 12.6); __game.debugStep(2.4); });
await shot(p, '02_first_reveal');
log.push('first open: ' + JSON.stringify(await ev(p, () => ({ reveal: __game.reveal.active, res: __game.reveal.result && __game.reveal.result.t, guns: __game.state.guns }))));
await ev(p, () => { __game.debugStep(5); __game.player.obj.position.set(0, 0, 15); __game.debugStep(20); });
await shot(p, '03_early_fight');
log.push('after ~25s: ' + JSON.stringify(await ev(p, () => ({ wave: __game.state.wave, kills: __game.state.stats.kills, coins: Math.round(__game.state.coins), monsters: __game.zombies.list.length, types: [...new Set(__game.zombies.list.map((z) => z.type))] }))));
await p.close();

// 2. mid game army, walking the deck, upgrading a gun
p = await open('reset=1&army=14&wave=9&coins=60000');
await ev(p, () => { __game.player.obj.position.set(8.8, 0, -5.9); __game.debugStep(8); });
await shot(p, '04_deck_walk');
const before = await ev(p, () => __game.state.guns[4] && __game.state.guns[4].l);
await ev(p, () => { __game.player.obj.position.set(8.75, 0, -5.8); __game.debugStep(1.2); });
await shot(p, '05_gun_upgrade');
log.push('gun pad upgrade: level ' + before + ' -> ' + (await ev(p, () => __game.state.guns[4] && __game.state.guns[4].l)));
await ev(p, () => { __game.player.obj.position.set(0, 0, 14); __game.debugStep(6); __game.ui.openPanel('upgrades'); });
await shot(p, '06_upgrades');
await ev(p, () => { __game.ui.closeTop(); __game.ui.openPanel('arsenal'); });
await shot(p, '07_arsenal');
await ev(p, () => { document.querySelector('.tab[data-tab="army"]').click(); });
await shot(p, '08_army_list');
await ev(p, () => { __game.ui.closeTop(); __game.ui.openPanel('settings'); });
await shot(p, '09_settings');
log.push('pause while settings open: ' + JSON.stringify(await ev(p, () => { const t = __game.time; __game.debugStep(1); return { frozen: __game.frozen, advanced: __game.time - t }; })));
await ev(p, () => { __game.ui.closeTop(); });
log.push('after close: ' + JSON.stringify(await ev(p, () => ({ frozen: __game.frozen }))));
await p.close();

// 3. boss wave with a modest army
p = await open('reset=1&army=6&wave=10');
await ev(p, () => { __game.player.obj.position.set(-8.8, 0, -12); __game.debugStep(9); });
await shot(p, '10_boss');
log.push('boss: ' + JSON.stringify(await ev(p, () => ({ wave: __game.state.wave, boss: __game.zombies.boss && __game.zombies.boss.type, hp: __game.zombies.boss && Math.round(__game.zombies.boss.hp) }))));
await p.close();

// 4. epic reveal (pity)
p = await open('reset=1&army=8&wave=3&coins=1000');
await ev(p, () => { const s = __game.state; s.opens = 10; s.pity = 29; s.freeCrates = 1; __game.player.obj.position.set(0, 0, 12.6); __game.debugStep(3.6); });
await shot(p, '11_epic_reveal');
await p.close();

// 5. mobile portrait
p = await open('reset=1&army=10&wave=4', 390, 844);
await ev(p, () => __game.debugStep(10));
await shot(p, '12_mobile');
await p.close();

// 6. later zone
p = await open('reset=1&army=24&wave=24');
await ev(p, () => { __game.player.obj.position.set(-9.3, 0, -3); __game.debugStep(10); });
await shot(p, '13_zone_frozen');
await p.close();

// 7. breach safety (no exceptions)
p = await open('reset=1&wave=30');
await ev(p, () => __game.debugStep(40));
log.push('breach run: ' + JSON.stringify(await ev(p, () => ({ wave: __game.state.wave, breaches: __game.state.stats.breaches }))));
await p.close();

// 8. model showcases
for (const kind of ['guns', 'chars']) {
  const sp = await browser.newPage({ viewport: { width: 1600, height: kind === 'guns' ? 1000 : 900 } });
  await sp.goto(BASE + '?showcase=' + kind, { waitUntil: 'load' });
  await sp.waitForFunction(() => window.__showcaseReady, null, { timeout: 90000 });
  await sp.waitForTimeout(1500);
  await sp.screenshot({ path: `${out}/showcase_${kind}.png` });
  await sp.close();
}

fs.writeFileSync(`${out}/log.txt`, log.join('\n') + '\n\nERRORS:\n' + (errors.join('\n') || 'none'));
console.log(log.join('\n'));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
