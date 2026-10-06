// Copies the single-file build to the repository root, next to the other
// STOOPID tools, so GitHub Pages serves it with no build step.
import { copyFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../dist/index.html');
const dest = resolve(here, '../../../stoopid_please_hold.html');
copyFileSync(src, dest);
console.log(`published ${dest} (${(statSync(dest).size / 1024).toFixed(0)} KB)`);
