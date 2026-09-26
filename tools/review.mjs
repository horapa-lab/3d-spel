// Produces a set of review screenshots + a functional log.
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
async function open(query, w = 1280, h = 720) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${query}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${query}: [pageerror] ${e.message}`));
  await page.goto(BASE + '?' + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.ui && !document.getElementById('loading'), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

// 1. fresh start
let p = await open('reset=1');
await ev(p, () => __game.debugStep(6));
await settle(p);
await p.screenshot({ path: `${out}/01_start.png` });
// walk to crate pad & open the first (free) crate
await ev(p, () => { const pl = __game.player; pl.obj.position.set(0, 0, 11.9); });
await ev(p, () => __game.debugStep(2.2));
await settle(p, 1500);
await p.screenshot({ path: `${out}/02_reveal.png` });
log.push('after first open: ' + JSON.stringify(await ev(p, () => ({ reveal: __game.reveal.active, res: __game.reveal.result && __game.reveal.result.t, guns: __game.state.guns, opens: __game.state.opens }))));
await ev(p, () => { __game.debugStep(4.5); __game.player.obj.position.set(0, 0, 14.5); __game.debugStep(1.5); });
log.push('after fly: ' + JSON.stringify(await ev(p, () => ({ reveal: __game.reveal.active, fly: !!__game.pendingFly, guns: __game.state.guns, slots: __game.guns.slots.slice(0, 4).map((s) => s.key) }))));
await ev(p, () => __game.debugStep(25));
await settle(p);
await p.screenshot({ path: `${out}/03_wave_fight.png` });
log.push('after 25s: ' + JSON.stringify(await ev(p, () => ({ wave: __game.state.wave, kills: __game.state.stats.kills, coins: Math.round(__game.state.coins), zombies: __game.zombies.list.length, bar: Math.round(__game.barricadeHp) }))));
await p.close();

// 2. big army mid game
p = await open('reset=1&army=20&wave=12&coins=50000');
await ev(p, () => __game.debugStep(22));
await settle(p);
await p.screenshot({ path: `${out}/04_army_battle.png` });
log.push('army battle: ' + JSON.stringify(await ev(p, () => ({ wave: __game.state.wave, zombies: __game.zombies.list.length, proj: __game.projectiles.list.length, dps: 0 })).catch(() => null)));
await ev(p, () => { __game.ui.openPanel('upgrades'); });
await settle(p, 800);
await p.screenshot({ path: `${out}/05_upgrades.png` });
await ev(p, () => { __game.ui.closeTop(); __game.ui.openPanel('arsenal'); });
await settle(p, 1500);
await p.screenshot({ path: `${out}/06_arsenal.png` });
await ev(p, () => { document.querySelector('.tab[data-tab="army"]').click(); });
await settle(p, 800);
await p.screenshot({ path: `${out}/07_army_list.png` });
await ev(p, () => { __game.ui.closeTop(); __game.ui.openPanel('settings'); });
await settle(p, 800);
await p.screenshot({ path: `${out}/08_settings.png` });
await p.close();

// 3. boss wave
p = await open('reset=1&army=6&wave=10');
await ev(p, () => __game.debugStep(9));
await settle(p);
await p.screenshot({ path: `${out}/09_boss.png` });
log.push('boss: ' + JSON.stringify(await ev(p, () => ({ wave: __game.state.wave, boss: !!__game.zombies.boss, bhp: __game.zombies.boss && Math.round(__game.zombies.boss.hp) }))));
await p.close();

// 4. legendary reveal
p = await open('reset=1&army=8&wave=3&coins=1000');
await ev(p, () => { const s = __game.state; s.opens = 10; s.pity = 29; s.freeCrates = 1; __game.player.obj.position.set(0, 0, 11.9); });
await ev(p, () => __game.debugStep(3.2));
await settle(p, 1500);
await p.screenshot({ path: `${out}/10_rare_reveal.png` });
await p.close();

// 5. mobile portrait
p = await open('reset=1&army=10&wave=4', 390, 844);
await ev(p, () => __game.debugStep(15));
await settle(p);
await p.screenshot({ path: `${out}/11_mobile.png` });
await p.close();

// 6. later zone
p = await open('reset=1&army=28&wave=24');
await ev(p, () => __game.debugStep(12));
await settle(p);
await p.screenshot({ path: `${out}/12_zone3.png` });
await p.close();

// 7. model showcases
for (const kind of ['guns', 'chars']) {
  const sp = await browser.newPage({ viewport: { width: 1600, height: kind === 'guns' ? 1000 : 900 } });
  await sp.goto(BASE + '?showcase=' + kind, { waitUntil: 'load' });
  await sp.waitForFunction(() => window.__showcaseReady, null, { timeout: 60000 });
  await sp.waitForTimeout(1500);
  await sp.screenshot({ path: `${out}/showcase_${kind}.png` });
  await sp.close();
}

fs.writeFileSync(`${out}/log.txt`, log.join('\n') + '\n\nERRORS:\n' + (errors.join('\n') || 'none'));
console.log(log.join('\n'));
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
