// Headless screenshot + console error check.
// node tools/shot.mjs <url> <out.png> [waitMs] [w] [h] [actions-json]
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const [url, out, wait = '4000', w = '1280', h = '720', actions = '[]'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message + '\n' + e.stack));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
for (const a of JSON.parse(actions)) {
  if (a.eval) { const r = await page.evaluate(a.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r)); }
  if (a.key) await page.keyboard.down(a.key), await page.waitForTimeout(a.hold || 300), await page.keyboard.up(a.key);
  if (a.click) await page.mouse.click(a.click[0], a.click[1]);
  if (a.wait) await page.waitForTimeout(a.wait);
  if (a.shot) await page.screenshot({ path: a.shot });
}
await page.screenshot({ path: out });
console.log(errors.length ? errors.slice(0, 30).join('\n') : 'NO ERRORS');
await browser.close();
