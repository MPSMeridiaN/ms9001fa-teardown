// Builds the single-file page and writes it to index.html, which is what GitHub Pages serves.
//
//   node build.mjs
//
// The page itself comes from the `teardown` skill (github.com/elvarofficial/teardown). The skill is not
// vendored here: point TEARDOWN_SKILL at it if it lives somewhere else.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL =
  process.env.TEARDOWN_SKILL ||
  path.join(process.env.USERPROFILE || process.env.HOME || '', '.config/opencode/skills/teardown');
const BUILDER = path.join(SKILL, 'sims', 'build.mjs');

if (!fs.existsSync(BUILDER)) {
  console.error(`teardown skill not found at ${SKILL}\nSet TEARDOWN_SKILL to the folder that holds sims/build.mjs.`);
  process.exit(1);
}

console.log(`building gt9fa with ${SKILL}`);
execFileSync(process.execPath, [BUILDER, './gt9fa'], {cwd: HERE, stdio: 'inherit'});

const site = fs.existsSync(path.join(HERE, 'site.json')) ? JSON.parse(fs.readFileSync(path.join(HERE, 'site.json'), 'utf8')) : {};
const url = (site.url || '').replace(/\/$/, '');

const TITLE = 'GE MS9001FA — gas turbine teardown';
const DESC =
  'An interactive 3D cutaway of the GE MS9001FA (PG9351FA) 50 Hz heavy-duty gas turbine: 18-stage compressor, 14 DLN-2.0+ cans, 3-stage turbine. Take it apart, read the gas path, watch it tour itself.';
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%2316181b'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%23e8491d' stroke-width='2.5'/%3E%3Ccircle cx='16' cy='16' r='2.5' fill='%23ecedef'/%3E%3C/svg%3E";

const head = [
  `<title>${TITLE}</title>`,
  `<meta name="description" content="${DESC}">`,
  `<meta name="theme-color" content="#ecedef">`,
  `<link rel="icon" href="${FAVICON}">`,
  `<meta property="og:type" content="website">`,
  `<meta property="og:title" content="${TITLE}">`,
  `<meta property="og:description" content="${DESC}">`,
  url ? `<meta property="og:url" content="${url}/">` : '',
  url ? `<meta property="og:image" content="${url}/docs/hero.png">` : '',
  `<meta name="twitter:card" content="summary_large_image">`,
  url ? `<meta name="twitter:image" content="${url}/docs/hero.png">` : '',
]
  .filter(Boolean)
  .join('\n');

let html = fs.readFileSync(path.join(HERE, 'teardown-out', 'dist', 'gt9fa.html'), 'utf8');
html = html.replace(/<title>[\s\S]*?<\/title>/, head);
fs.writeFileSync(path.join(HERE, 'index.html'), html);
console.log(`index.html  ${(html.length / 1024).toFixed(0)} KB`);
