// Regenerates assets/img/og.png (1200x630) with headless Chrome.
// Usage: node tools/make-og.mjs. Set CHROME_PATH if Chrome isn't found.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NAME = 'Matan Elgrissi';
const SUBLINE = 'Computer Science student focused on cybersecurity and DevSecOps.';

const chrome =
  process.env.CHROME_PATH ||
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
    existsSync,
  );

if (!chrome) {
  console.error('Chrome not found. Set CHROME_PATH.');
  process.exit(1);
}

const tokens = readFileSync(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');
const darkValue = (name) => tokens.match(new RegExp(`--${name}:\\s*light-dark\\([^,]+,\\s*([^)]+)\\)`))[1];

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body {
    background: ${darkValue('bg')};
    color: ${darkValue('text')};
    font-family: system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 96px;
    box-sizing: border-box;
  }
  h1 { font-size: 88px; line-height: 1.1; margin: 0 0 24px; font-weight: 600; }
  p { font-size: 40px; line-height: 1.3; margin: 0; color: ${darkValue('muted')}; }
</style>
<h1>${NAME}</h1>
<p>${SUBLINE}</p>`;

const directory = mkdtempSync(join(tmpdir(), 'make-og-'));
try {
  const page = join(directory, 'og.html');
  writeFileSync(page, html);
  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    `--user-data-dir=${join(directory, 'profile')}`,
    `--screenshot=${fileURLToPath(new URL('../assets/img/og.png', import.meta.url))}`,
    pathToFileURL(page).href,
  ], { stdio: 'pipe' });
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log('Wrote assets/img/og.png');
