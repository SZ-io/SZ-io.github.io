// Computes WCAG contrast ratios for the color tokens in assets/css/tokens.css
// and exits non-zero if any pair is below its minimum.

import { readFile } from 'node:fs/promises';

const TEXT_MIN = 4.5;
const UI_MIN = 3;

// --rule is exempt: it only draws decorative dividers, which carry no meaning.
const PAIRS = [
  ['text', 'bg', TEXT_MIN, 'body text'],
  ['text', 'surface', TEXT_MIN, 'project title on hovered row'],
  ['text-soft', 'bg', TEXT_MIN, 'summaries, sub-line, messages'],
  ['text-soft', 'surface', TEXT_MIN, 'summary on hovered row'],
  ['muted', 'bg', TEXT_MIN, 'muted text'],
  ['muted', 'surface', TEXT_MIN, 'tags on hovered row'],
  ['accent-text', 'bg', TEXT_MIN, 'link text'],
  ['accent-text', 'surface', TEXT_MIN, 'link text on hovered row'],
  ['on-fill', 'fill', TEXT_MIN, 'primary button'],
  ['on-fill', 'fill-hover', TEXT_MIN, 'primary button hover'],
  ['control-border', 'bg', UI_MIN, 'search input border'],
  ['accent', 'bg', UI_MIN, 'focus ring, active underline'],
  ['accent', 'surface', UI_MIN, 'focus ring on hovered row'],
];

function parseTokens(css) {
  const tokens = new Map();
  const pattern = /--([\w-]+):\s*light-dark\(\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s*\)/gi;
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

function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const css = await readFile(new URL('../assets/css/tokens.css', import.meta.url), 'utf8');
const tokens = parseTokens(css);
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
    const pair = `--${foreground} on --${background}`.padEnd(32);
    console.log(`  ${passed ? 'ok  ' : 'FAIL'}  ${pair} ${ratio.toFixed(2).padStart(5)}:1  (min ${minimum})  ${use}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} pair(s) below minimum contrast.`);
  process.exit(1);
}
console.log('\nAll pairs meet their minimum contrast.');
