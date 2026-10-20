// Builds chess/ into the single self-contained page ../stoopid_chess.html (no CDN, nothing fetched).
// The ES modules are concatenated with their import/export lines stripped, so top-level names
// must be unique across modules (checked below). THE HOUSE's worker is inlined as text and
// started from a Blob.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(here, p), 'utf8');

function strip(src) {
  return src
    .replace(/^import[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*$/gm, '')
    .replace(/^export\s+\{[^}]*\};?[ \t]*$/gm, '')
    .replace(/^export\s+(?=(const|let|var|function|class|async)\b)/gm, '');
}

function bundle(name, files, prelude = '') {
  const parts = files.map(f => `// ---- ${f} ----\n${strip(read(f))}`);
  const code = prelude + parts.join('\n');
  const seen = new Map();
  for (const f of files) {
    for (const m of strip(read(f)).matchAll(/^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (seen.has(m[1])) throw new Error(`${name}: "${m[1]}" is declared in both ${seen.get(m[1])} and ${f}`);
      seen.set(m[1], f);
    }
  }
  if (/<\/script|<!--/i.test(code)) throw new Error(`${name}: contains a sequence that would break the inline <script>`);
  return `(() => {\n'use strict';\n${code}\n})();\n`;
}

// Pieces: the classic Cburnett set (see NOTICE.md), inlined as data URIs.
const pieces = {};
for (const f of readdirSync(join(here, 'pieces')).filter(f => f.endsWith('.svg')).sort()) {
  const svg = read(join('pieces', f)).trim();
  pieces[f.replace('.svg', '')] = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
if (Object.keys(pieces).length !== 12) throw new Error('Expected 12 piece SVGs in chess/pieces/');
const pieceCss = Object.entries(pieces).map(([k, v]) => `.${k}{background-image:url("${v}")}`).join('\n');

const worker = bundle('worker', ['core/rules.js', 'core/engine.js', 'core/worker.js']);
const app = bundle('app', ['core/rules.js', 'core/commentary.js', 'core/levels.js', 'app/main.js'],
  `const PIECE_URL = ${JSON.stringify(pieces)};\n`);

let html = read('app/index.html');
const put = (marker, text) => {
  if (!html.includes(marker)) throw new Error('Template is missing ' + marker);
  html = html.split(marker).join(text);
};
put('/*@CSS*/', read('app/style.css') + '\n' + pieceCss);
put('/*@WORKER*/', worker);
put('/*@APP*/', app);
html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- Built from chess/ by `npm run build` — edit the sources there, not this file. -->');

const out = join(here, '..', 'stoopid_chess.html');
writeFileSync(out, html);
console.log(`stoopid_chess.html — ${(html.length / 1024).toFixed(1)} KB`);
