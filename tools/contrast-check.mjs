// Computes WCAG contrast ratios for the color tokens in assets/css/tokens.css
// and exits non-zero if any pair is below its minimum.

import { readFile } from 'node:fs/promises';

const TEXT_MIN = 4.5;
const UI_MIN = 3;

// --rule, --float-border, --dot-grid and the --laptop-* tokens are exempt: they
// only draw decoration, which carries no meaning. The grid still sits behind Home's
// text, so bg-with-dots is --bg with a dot on top, the worst case for a glyph.
const PAIRS = [
  ['text', 'bg', TEXT_MIN, 'body text'],
  ['text', 'bg-with-dots', TEXT_MIN, 'hero name over a grid dot'],
  ['text', 'float', TEXT_MIN, 'sheet text, nav name, fact pills'],
  ['text', 'float-hover', TEXT_MIN, 'project title on hovered row'],
  ['text-soft', 'bg', TEXT_MIN, 'hero sub-line'],
  ['text-soft', 'bg-with-dots', TEXT_MIN, 'hero sub-line over a grid dot'],
  ['text-soft', 'float', TEXT_MIN, 'summaries, messages'],
  ['text-soft', 'float-hover', TEXT_MIN, 'summary on hovered row'],
  ['muted', 'bg', TEXT_MIN, 'status line, role line, footer'],
  ['muted', 'bg-with-dots', TEXT_MIN, 'muted text over a grid dot'],
  ['muted', 'float', TEXT_MIN, 'nav links, filters, keys, tags'],
  ['muted', 'float-hover', TEXT_MIN, 'tags on hovered row'],
  ['btn-text', 'btn-bg', TEXT_MIN, 'buttons, active nav pill, active filter'],
  ['btn-text', 'btn-bg-hover', TEXT_MIN, 'button hover'],
  ['control-border', 'bg', UI_MIN, 'control border on the page'],
  ['control-border', 'float', UI_MIN, 'search input border, link underline'],
  ['focus-ring', 'bg', UI_MIN, 'focus ring on the page'],
  ['focus-ring', 'bg-with-dots', UI_MIN, 'focus ring over a grid dot'],
  ['focus-ring', 'float', UI_MIN, 'focus ring on a sheet or the nav'],
  ['focus-ring', 'float-hover', UI_MIN, 'focus ring on a hovered row'],
];

function parseTokens(css) {
  const tokens = new Map();
  const color = '#[0-9a-f]{3,6}|rgba\\([^)]*\\)';
  const pattern = new RegExp(`--([\\w-]+):\\s*light-dark\\(\\s*(${color})\\s*,\\s*(${color})\\s*\\)`, 'gi');
  for (const [, name, light, dark] of css.matchAll(pattern)) {
    tokens.set(name, { light, dark });
  }
  return tokens;
}

function luminance(hex) {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  const [r, g, b] = [0, 2, 4].map((start) => {
    const value = parseInt(full.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channels(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// The solid color of an rgba() overlay on a #rrggbb background.
function composite(overlay, background) {
  const [r, g, b, alpha] = overlay.match(/[\d.]+/g).map(Number);
  const mixed = channels(background).map((value, i) => Math.round([r, g, b][i] * alpha + value * (1 - alpha)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const css = await readFile(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');
const tokens = parseTokens(css);
tokens.set('bg-with-dots', {
  light: composite(tokens.get('dot-grid').light, tokens.get('bg').light),
  dark: composite(tokens.get('dot-grid').dark, tokens.get('bg').dark),
});
let failures = 0;

for (const theme of ['light', 'dark']) {
  console.log(`\n${theme}`);
  for (const [foreground, background, minimum, use] of PAIRS) {
    if (!tokens.has(foreground) || !tokens.has(background)) {
      console.log(`  FAIL  missing token: --${foreground} or --${background}`);
      failures += 1;
      continue;
    }
    const ratio = contrast(tokens.get(foreground)[theme], tokens.get(background)[theme]);
    // Compare the unrounded ratio: 4.499 must fail even though it prints as 4.50.
    const passed = ratio >= minimum;
    failures += passed ? 0 : 1;
    const pair = `--${foreground} on --${background}`.padEnd(38);
    console.log(`  ${passed ? 'ok  ' : 'FAIL'}  ${pair} ${ratio.toFixed(2).padStart(5)}:1  (min ${minimum})  ${use}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} pair(s) below minimum contrast.`);
  process.exit(1);
}
console.log('\nAll pairs meet their minimum contrast.');
