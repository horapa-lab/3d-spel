#!/usr/bin/env node
/**
 * Headless screenshot tool (Chromium + SwiftShader WebGL).
 *
 *   node tools/render.mjs --url "lab.html?kind=fish&page=0" --out review/renders/fish/p0.png [--w 1600 --h 1000] [--wait 500] [--stats]
 *   node tools/render.mjs --batch jobs.json      // [{ "url": "...", "out": "...", "w":1600, "h":1000 }]
 *
 * Uses the shared dev server at $RENDER_BASE (default http://127.0.0.1:5173/). If it is not
 * running, a private Vite server is started for this call.
 * Waits for window.__labReady (lab) or window.__gameReady (game) before capturing.
 * Prints console errors from the page — fix them!
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

let jobs;
if (opt('batch')) jobs = JSON.parse(readFileSync(opt('batch'), 'utf8'));
else jobs = [{ url: opt('url'), out: opt('out'), w: Number(opt('w', 1600)), h: Number(opt('h', 1000)), wait: Number(opt('wait', 400)) }];

let base = process.env.RENDER_BASE ?? 'http://127.0.0.1:5173/';
let server = null;
try {
  const r = await fetch(base, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(String(r.status));
} catch {
  const { createServer } = await import('vite');
  server = await createServer({ root, server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  const addr = server.httpServer.address();
  base = `http://127.0.0.1:${addr.port}/`;
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const timeout = Number(opt('timeout', 180000));
let failed = 0;
for (const job of jobs) {
  const page = await browser.newPage({ viewport: { width: job.w ?? 1600, height: job.h ?? 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  const t0 = Date.now();
  try {
    await page.goto(new URL(job.url, base).href, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForFunction(() => window.__labReady || window.__gameReady, null, { timeout, polling: 250 });
    await page.waitForTimeout(job.wait ?? 400);
    mkdirSync(dirname(resolve(root, job.out)), { recursive: true });
    await page.screenshot({ path: resolve(root, job.out) });
    let stats = null;
    if (flag('stats') || job.stats) {
      stats = await page.evaluate(() => {
        if (window.__labInfo) return window.__labInfo;
        const c = window.__ctx;
        if (!c) return null;
        const i = c.render.renderer.info;
        return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, fps: c.render.fps() };
      });
    }
    console.log(JSON.stringify({ out: job.out, ms: Date.now() - t0, errors: errors.slice(0, 20), stats }));
  } catch (err) {
    failed++;
    console.log(JSON.stringify({ out: job.out, failed: String(err).slice(0, 300), errors: errors.slice(0, 20) }));
  }
  await page.close();
}
await browser.close();
if (server) await server.close();
process.exit(failed ? 1 : 0);
