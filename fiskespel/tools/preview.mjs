#!/usr/bin/env node
/**
 * Builds a single-file preview of the game (all JS + CSS inlined) for sharing as an Artifact.
 *   node tools/preview.mjs <outFile.html>
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? join(root, 'dist-preview.html'));
const outDir = join(tmpdir(), `reel-preview-${Date.now()}`);

await build({ root, logLevel: 'warn', build: { outDir, emptyOutDir: true, modulePreload: false } });

const assets = join(outDir, 'assets');
const files = readdirSync(assets);
const js = files.filter((f) => f.endsWith('.js'));
const css = files.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`expected 1 JS chunk, got ${js.join(', ')}`);
const jsText = readFileSync(join(assets, js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const cssText = css.map((f) => readFileSync(join(assets, f), 'utf8')).join('\n');

const built = readFileSync(join(outDir, 'index.html'), 'utf8');
const bodyInner = built.split(/<body[^>]*>/i)[1].split(/<\/body>/i)[0].replace(/<script[^>]*src=[^>]*><\/script>/gi, '');
const html = `<title>Reel Isles</title>
<style>${cssText}</style>
${bodyInner.trim()}
<script type="module">${jsText}</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(JSON.stringify({ out, bytes: html.length, js: js[0], css }));
