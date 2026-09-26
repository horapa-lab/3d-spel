// Builds dist/artifact.html: the game page without the document wrapper
// (the claude.ai artifact host adds its own), for the live preview link.
import fs from 'node:fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = head
  .split('\n')
  .filter((l) => /<title>|<link rel="stylesheet"|<script type="module"|<link rel="icon"|name="description"/.test(l))
  .join('\n');
fs.writeFileSync('dist/artifact.html', `${keep}\n${body}\n`);
const files = {};
for (const f of fs.readdirSync('dist/assets')) files[`assets/${f}`] = `dist/assets/${f}`;
files['favicon.svg'] = 'dist/favicon.svg';
console.log(JSON.stringify(files));
