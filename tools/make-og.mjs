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
const lightValue = (name) => tokens.match(new RegExp(`--${name}:\\s*light-dark\\(\\s*([^,]+),`))[1];
// Embedded because a file:// page can't load a font from another file:// path.
const font = readFileSync(new URL('../assets/fonts/hanken-grotesk-latin-wght-normal.woff2', import.meta.url)).toString('base64');

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Hanken Grotesk";
    font-weight: 100 900;
    src: url(data:font/woff2;base64,${font}) format("woff2");
  }
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body {
    background: ${lightValue('bg')};
    color: ${lightValue('text')};
    font-family: "Hanken Grotesk", sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 72px;
    box-sizing: border-box;
  }
  h1 { font-size: 152px; line-height: 0.98; letter-spacing: -0.045em; margin: 0 0 28px; font-weight: 800; }
  p { font-size: 34px; line-height: 1.3; margin: 0; color: ${lightValue('text-soft')}; }
  i { background: ${lightValue('btn-bg')}; display: block; width: 216px; height: 64px; border-radius: 999px; margin-top: 48px; }
</style>
<h1>${NAME}</h1>
<p>${SUBLINE}</p>
<i></i>`;

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
    '--virtual-time-budget=3000',
    `--user-data-dir=${join(directory, 'profile')}`,
    `--screenshot=${fileURLToPath(new URL('../assets/img/og.png', import.meta.url))}`,
    pathToFileURL(page).href,
  ], { stdio: 'pipe' });
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log('Wrote assets/img/og.png');
