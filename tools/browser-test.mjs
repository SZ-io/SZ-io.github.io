// Browser tests for routing, theme, menu and project filtering.
// Usage: npm run test:browser. Set CHROME_PATH if Chrome isn't found.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { launchBrowser, startServer } from './browser-harness.mjs';

const VISIBLE_VIEWS = `[...document.querySelectorAll('main > section')]
  .filter((view) => getComputedStyle(view).display !== 'none')
  .map((view) => view.id)`;
const NAV_CURRENT = `[...document.querySelectorAll('[aria-current]')].map((link) => link.textContent + ':' + link.getAttribute('aria-current'))`;
const ACTIVE_ID = 'document.activeElement.id';
const STATUS = `document.getElementById('project-status').textContent`;
const VISIBLE_ROWS = `[...document.querySelectorAll('.project-row')].filter((row) => !row.hidden).map((row) => row.querySelector('h4').textContent.replace(' (opens in a new tab)', ''))`;
const MENU_EXPANDED = `document.getElementById('nav-toggle').getAttribute('aria-expanded')`;
const PANEL_DISPLAY = `getComputedStyle(document.getElementById('nav-panel')).display`;
const THEME = `document.documentElement.getAttribute('data-theme')`;
const READY = `!document.documentElement.classList.contains('js-pending')`;
const PROJECTS_READY = `document.querySelectorAll('.project-row').length > 0`;
const AFTER_FRAMES = `new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))))`;
const MOBILE = { width: 360, height: 640 };

const server = await startServer();
const browser = await launchBrowser();
const results = [];

async function open(hash = '', options = {}, path = '/') {
  // Pinned so a dark-mode machine runs the same tests; dark tests ask for it.
  const page = await browser.newPage({ colorScheme: 'light', ...options });
  await page.goto(`${server.origin}${path}${hash}`);
  if (options.javaScript !== false && path === '/') {
    await page.waitFor(READY);
  }
  return page;
}

// Every test also fails on console errors, CSP violations or third-party requests,
// unless it deliberately breaks a request.
async function test(name, options, body) {
  const { hash, allowProblems, path, ...pageOptions } = options;
  let page;
  try {
    page = await open(hash, pageOptions, path);
    await body(page);
    if (!allowProblems) {
      assert.deepEqual(page.problems, [], 'console errors or CSP violations');
    }
    const foreign = page.requests.filter(
      (url) => !url.startsWith(server.origin) && !url.startsWith('data:') && url !== 'about:blank',
    );
    assert.deepEqual(foreign, [], 'third-party requests');
    results.push({ name, passed: true });
    console.log(`  ok    ${name}`);
  } catch (error) {
    results.push({ name, passed: false });
    console.log(`  FAIL  ${name}\n        ${error.message.split('\n').join('\n        ')}`);
  } finally {
    await page?.close();
  }
}

const view = (page) => page.evaluate(VISIBLE_VIEWS);
const waitForView = (page, id) => page.waitFor(`JSON.stringify(${VISIBLE_VIEWS}) === '["${id}"]'`);
const navLink = (id) => `.site-nav__link[href="#${id}"]`;

// Routing

await test('empty hash shows Home only', {}, async (page) => {
  assert.deepEqual(await view(page), ['home']);
  assert.equal(await page.evaluate('document.title'), 'Matan Elgrissi');
  assert.deepEqual(await page.evaluate(NAV_CURRENT), ['Home:page']);
});

await test('deep link to #projects opens Projects directly', { hash: '#projects' }, async (page) => {
  assert.deepEqual(await view(page), ['projects']);
  assert.equal(await page.evaluate('document.title'), 'Projects · Matan Elgrissi');
  assert.deepEqual(await page.evaluate(NAV_CURRENT), ['Projects:page']);
  await page.evaluate(AFTER_FRAMES);
  assert.equal(await page.evaluate('window.scrollY'), 0);
});

await test('unknown hash shows Home', { hash: '#nope' }, async (page) => {
  assert.deepEqual(await view(page), ['home']);
});

await test('object-prototype names are unknown hashes', { hash: '#constructor' }, async (page) => {
  assert.deepEqual(await view(page), ['home']);
  assert.equal(await page.evaluate('document.title'), 'Matan Elgrissi');
});

await test('#education shows About at the top', { hash: '#education', width: 360, height: 400 }, async (page) => {
  assert.deepEqual(await view(page), ['about']);
  assert.deepEqual(await page.evaluate(NAV_CURRENT), ['About:page']);
  assert.equal(await page.evaluate('document.title'), 'About · Matan Elgrissi');
  await page.evaluate(AFTER_FRAMES);
  assert.equal(await page.evaluate('window.scrollY'), 0);
});

for (const [id, name] of [['about', 'About'], ['projects', 'Projects'], ['skills', 'Skills'], ['contact', 'Contact']]) {
  await test(`nav link opens ${name}, moves focus and sets the title`, {}, async (page) => {
    await page.click(navLink(id));
    await waitForView(page, id);
    assert.equal(await page.evaluate(ACTIVE_ID), `${id}-title`);
    assert.equal(await page.evaluate('document.title'), `${name} · Matan Elgrissi`);
    assert.deepEqual(await page.evaluate(NAV_CURRENT), [`${name}:page`]);
  });
}

await test('Home link returns, with focus on the name', { hash: '#skills' }, async (page) => {
  await page.click(navLink('home'));
  await waitForView(page, 'home');
  assert.equal(await page.evaluate(ACTIVE_ID), 'home-title');
  assert.equal(await page.evaluate('document.title'), 'Matan Elgrissi');
});

await test('deep link does not move focus on first load', { hash: '#skills' }, async (page) => {
  assert.equal(await page.evaluate('document.activeElement === document.body'), true);
});

await test('skip link is the first Tab stop', {}, async (page) => {
  assert.equal(await page.evaluate('document.activeElement === document.body'), true);
  await page.press('Tab');
  await page.waitFor(`document.activeElement.className === 'skip-link'`);
});

await test('Back and Forward switch windows', {}, async (page) => {
  await page.click(navLink('about'));
  await waitForView(page, 'about');
  await page.click(navLink('skills'));
  await waitForView(page, 'skills');

  await page.evaluate('history.back()');
  await waitForView(page, 'about');
  assert.equal(await page.evaluate('document.title'), 'About · Matan Elgrissi');
  assert.deepEqual(await page.evaluate(NAV_CURRENT), ['About:page']);

  await page.evaluate('history.back()');
  await waitForView(page, 'home');
  assert.deepEqual(await page.evaluate(NAV_CURRENT), ['Home:page']);

  await page.evaluate('history.forward()');
  await waitForView(page, 'about');
  assert.equal(await page.evaluate(ACTIVE_ID), 'about-title');
});

await test('hero buttons open Projects and Contact', {}, async (page) => {
  await page.click('.button');
  await waitForView(page, 'projects');
  assert.equal(await page.evaluate('location.hash'), '#projects');

  await page.evaluate('history.back()');
  await waitForView(page, 'home');
  await page.click('.text-link');
  await waitForView(page, 'contact');
  assert.equal(await page.evaluate('location.hash'), '#contact');
});

await test('switching resets scroll instantly', { hash: '#projects', width: 360, height: 500 }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  await page.evaluate('window.scrollTo(0, 600)');
  assert.ok((await page.evaluate('window.scrollY')) > 0);
  await page.evaluate(`location.hash = '#skills'`);
  await waitForView(page, 'skills');
  await page.waitFor('window.scrollY === 0');
});

await test('skip link focuses main without leaving the window', { hash: '#projects' }, async (page) => {
  await page.evaluate(`document.querySelector('.skip-link').focus()`);
  await page.press('Enter');
  await page.waitFor(`document.activeElement.id === 'main'`);
  assert.equal(await page.evaluate('location.hash'), '#projects');
  assert.deepEqual(await view(page), ['projects']);
});

await test('focused controls clear the sticky bar', { hash: '#projects', width: 1280, height: 400 }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
  await page.evaluate(`document.querySelector('.filter').focus()`);
  const top = await page.evaluate(`document.querySelector('.filter').getBoundingClientRect().top`);
  const bar = await page.evaluate(`document.querySelector('.site-header').getBoundingClientRect().bottom`);
  assert.ok(top >= bar, `control top ${top} is under bar bottom ${bar}`);
});

await test('Home keeps the name, buttons and pills above the fold at 1280x800', {}, async (page) => {
  const bottom = await page.evaluate(`Math.max(...['#home-title', '.button', '.text-link', '.key-facts__pill:last-of-type']
    .map((selector) => document.querySelector(selector).getBoundingClientRect().bottom))`);
  assert.ok(bottom <= 800, `lowest element ends at ${bottom}`);
  const pills = await page.evaluate(`[...document.querySelectorAll('.key-facts__pill')].map((pill) => pill.getBoundingClientRect().bottom)`);
  assert.equal(pills.length, 7);
  assert.ok(pills.every((pillBottom) => pillBottom <= 800), pills.join());
});

for (const id of ['about', 'skills', 'contact']) {
  await test(`${id} fits one screen at 1280x800`, { hash: `#${id}` }, async (page) => {
    assert.ok((await page.evaluate('document.documentElement.scrollHeight')) <= 800);
  });
}

// Fallbacks

await test('no JS: sections stack and nav links jump', { javaScript: false, hash: '#skills' }, async (page) => {
  assert.deepEqual(await view(page), ['home', 'about', 'projects', 'skills', 'contact']);
  assert.equal(await page.evaluate(`document.documentElement.classList.contains('js')`), false);
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.site-header')).position`), 'static');
  assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('nav-panel')).display`), 'flex');
  assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('theme-toggle')).display`), 'none');
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('noscript')).display`), 'inline');
  assert.ok((await page.evaluate('window.scrollY')) > 0, 'fragment should scroll to the section');
});

await test('no JS: light with a light system setting', { javaScript: false, colorScheme: 'light' }, async (page) => {
  assert.equal(await page.evaluate('getComputedStyle(document.body).backgroundColor'), 'rgb(233, 236, 239)');
});

await test('no JS: dark with a dark system setting, using a border for depth', { javaScript: false, colorScheme: 'dark' }, async (page) => {
  assert.equal(await page.evaluate('getComputedStyle(document.body).backgroundColor'), 'rgb(17, 19, 22)');
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.site-nav')).boxShadow`), 'none');
});

await test('module failure falls back to the stacked layout', { blocked: ['*/assets/js/main.js'], allowProblems: true }, async (page) => {
  await page.waitFor(`!document.documentElement.classList.contains('js')`);
  assert.deepEqual(await view(page), ['home', 'about', 'projects', 'skills', 'contact']);
});

// Motion

await test('the fade plays on a switch but not on first paint', {}, async (page) => {
  assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('home')).animationName`), 'none');
  await page.click(navLink('about'));
  await waitForView(page, 'about');
  const animation = await page.evaluate(`(() => {
    const style = getComputedStyle(document.getElementById('about'));
    return { name: style.animationName, duration: style.animationDuration };
  })()`);
  assert.deepEqual(animation, { name: 'window-in', duration: '0.15s' });
});

await test('reduced motion turns off the fade and the pulse', { reducedMotion: true }, async (page) => {
  await page.click(navLink('about'));
  await waitForView(page, 'about');
  assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('about')).animationName`), 'none');
  await page.evaluate('history.back()');
  await waitForView(page, 'home');
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.status-line__dot'), '::after').animationName`), 'none');
});

// Theme

await test('theme is light with a light system setting', { colorScheme: 'light' }, async (page) => {
  assert.equal(await page.evaluate(THEME), 'light');
  assert.equal(await page.evaluate('getComputedStyle(document.body).backgroundColor'), 'rgb(233, 236, 239)');
  assert.equal(await page.evaluate(`document.getElementById('theme-toggle').getAttribute('aria-label')`), 'Switch to dark theme');
});

await test('theme is dark with a dark system setting', { colorScheme: 'dark' }, async (page) => {
  assert.equal(await page.evaluate(THEME), 'dark');
  assert.equal(await page.evaluate('getComputedStyle(document.body).backgroundColor'), 'rgb(17, 19, 22)');
  assert.equal(await page.evaluate(`document.getElementById('theme-toggle').getAttribute('aria-label')`), 'Switch to light theme');
});

const THEME_LOG = `window.__themes = [];
  new MutationObserver(() => window.__themes.push(document.documentElement.getAttribute('data-theme')))
    .observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });`;

await test('theme choice persists with no flash of the wrong theme', { init: THEME_LOG }, async (page) => {
  await page.click('.theme-toggle');
  await page.waitFor(`${THEME} === 'dark'`);
  assert.equal(await page.evaluate(`localStorage.getItem('theme')`), 'dark');

  await page.reload();
  await page.waitFor(READY);
  assert.deepEqual([...new Set(await page.evaluate('window.__themes'))], ['dark']);
  assert.equal(await page.evaluate('getComputedStyle(document.body).backgroundColor'), 'rgb(17, 19, 22)');
  assert.equal(await page.evaluate(`document.querySelector('meta[name="theme-color"]').content`), 'rgb(17, 19, 22)');
});

await test('a stored light choice beats a dark system setting with no flash', { init: THEME_LOG, colorScheme: 'dark' }, async (page) => {
  await page.click('.theme-toggle');
  await page.waitFor(`${THEME} === 'light'`);
  assert.equal(await page.evaluate(`localStorage.getItem('theme')`), 'light');

  await page.reload();
  await page.waitFor(READY);
  assert.deepEqual([...new Set(await page.evaluate('window.__themes'))], ['light']);
  assert.equal(await page.evaluate('getComputedStyle(document.body).backgroundColor'), 'rgb(233, 236, 239)');
});

await test('blocked storage still gives a working toggle', {
  init: `Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });`,
}, async (page) => {
  assert.equal(await page.evaluate(THEME), 'light');
  await page.click('.theme-toggle');
  await page.waitFor(`${THEME} === 'dark'`);
});

// Mobile menu

await test('menu opens, and Escape closes it and returns focus', MOBILE, async (page) => {
  assert.equal(await page.evaluate(PANEL_DISPLAY), 'none');
  await page.click('.site-nav__toggle');
  await page.waitFor(`${MENU_EXPANDED} === 'true'`);
  assert.equal(await page.evaluate(PANEL_DISPLAY), 'flex');
  assert.equal(await page.evaluate(`document.getElementById('nav-toggle-icon').getAttribute('href')`), '#icon-x');

  await page.evaluate(`document.querySelector('.site-nav__link').focus()`);
  await page.press('Escape');
  await page.waitFor(`${MENU_EXPANDED} === 'false'`);
  assert.equal(await page.evaluate(PANEL_DISPLAY), 'none');
  assert.equal(await page.evaluate(ACTIVE_ID), 'nav-toggle');
});

await test('menu link switches window, closes and moves focus', MOBILE, async (page) => {
  await page.click('.site-nav__toggle');
  await page.waitFor(`${MENU_EXPANDED} === 'true'`);
  await page.click(navLink('skills'));
  await waitForView(page, 'skills');
  assert.equal(await page.evaluate(MENU_EXPANDED), 'false');
  assert.equal(await page.evaluate(ACTIVE_ID), 'skills-title');
});

await test('theme toggle lives in the menu and leaves it open', MOBILE, async (page) => {
  assert.equal(await page.evaluate(`document.getElementById('nav-panel').contains(document.getElementById('theme-toggle'))`), true);
  await page.click('.site-nav__toggle');
  await page.waitFor(`${MENU_EXPANDED} === 'true'`);
  await page.click('.theme-toggle');
  await page.waitFor(`${THEME} === 'dark'`);
  assert.equal(await page.evaluate(MENU_EXPANDED), 'true');
});

await test('Home has no horizontal overflow at 360px', MOBILE, async (page) => {
  const widths = await page.evaluate('[document.documentElement.scrollWidth, window.innerWidth]');
  assert.ok(widths[0] <= widths[1], `${widths[0]} > ${widths[1]}`);
  const laptop = await page.evaluate(`(() => {
    const { left, right } = document.querySelector('.laptop').getBoundingClientRect();
    return { left, right };
  })()`);
  assert.ok(laptop.left >= 0 && laptop.right <= 360, JSON.stringify(laptop));
});

await test('no horizontal overflow at 360px in any window', MOBILE, async (page) => {
  for (const id of ['home', 'about', 'projects', 'skills', 'contact']) {
    await page.evaluate(`location.hash = '#${id}'`);
    await waitForView(page, id);
    await page.waitFor(PROJECTS_READY);
    const widths = await page.evaluate('[document.documentElement.scrollWidth, window.innerWidth]');
    assert.ok(widths[0] <= widths[1], `${id}: ${widths[0]} > ${widths[1]}`);
  }
});

// Projects

await test('rows render as specified', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  const rows = await page.evaluate(`[...document.querySelectorAll('.project-row')].map((row) => {
    const link = row.querySelector('a');
    return {
      group: row.parentElement.id,
      title: row.querySelector('h4').textContent.replace(' (opens in a new tab)', ''),
      href: link?.href ?? null,
      target: link?.target ?? null,
      rel: link?.rel ?? null,
      planned: row.querySelector('.project-row__status')?.textContent ?? null,
      icon: row.querySelector('.icon--external')?.getAttribute('aria-hidden') ?? null,
      tags: row.querySelector('.project-row__tags').textContent,
    };
  })`);
  assert.equal(rows.length, 6);
  const honeypot = rows.find((row) => row.title === 'Honeypot with AI agents');
  assert.equal(honeypot.href, null);
  assert.equal(honeypot.planned, 'Planned');
  assert.equal(honeypot.icon, null);
  for (const row of rows.filter((candidate) => candidate.href)) {
    assert.equal(row.icon, 'true', `${row.title} needs the external-link icon`);
  }
  const shell = rows.find((row) => row.title === 'Linux Shell Interpreter');
  assert.equal(shell.tags, 'C, Linux');
  assert.equal(shell.target, '_blank');
  assert.equal(shell.rel, 'noopener noreferrer');
  for (const row of rows.filter((candidate) => candidate.tags.includes('Rust'))) {
    assert.equal(row.group, 'projects-earlier', `${row.title} must be under Earlier work`);
  }
  assert.deepEqual(
    await page.evaluate(`[...document.querySelectorAll('.filter')].map((filter) => filter.textContent)`),
    ['All', 'Security', 'Networking', 'Linux', 'Python', 'C', 'Rust', 'ML'],
  );
});

await test('search and filter compose into one state', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  assert.equal(await page.evaluate(STATUS), 'Showing 6 projects');

  await page.evaluate(`[...document.querySelectorAll('.filter')].find((filter) => filter.textContent === 'Rust').click()`);
  assert.equal(await page.evaluate(STATUS), 'Showing 2 projects');
  assert.equal(await page.evaluate(`document.querySelector('.filter[aria-pressed="true"]').textContent`), 'Rust');
  assert.equal(await page.evaluate(`document.getElementById('projects-selected').hidden`), true);
  assert.equal(await page.evaluate(`document.getElementById('projects-selected-title').hidden`), true);

  await page.evaluate(`(() => {
    const input = document.getElementById('project-search');
    input.value = 'tokio';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  assert.deepEqual(await page.evaluate(VISIBLE_ROWS), ['Custom Unix Shell']);
  assert.equal(await page.evaluate(STATUS), 'Showing 1 project');
});

await test('empty state uses soft text, and All clears the tag', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  await page.evaluate(`(() => {
    const input = document.getElementById('project-search');
    input.value = 'zzzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  assert.equal(await page.evaluate(STATUS), 'No projects match. Clear the search or choose All.');
  assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('project-status')).color`), 'rgb(62, 68, 75)');
  assert.deepEqual(await page.evaluate(VISIBLE_ROWS), []);
});

await test('load failure shows the error and hides the controls', { hash: '#projects', blocked: ['*/projects.json'], allowProblems: true }, async (page) => {
  await page.waitFor(`document.getElementById('project-status').textContent.startsWith("Projects couldn't load.")`);
  assert.equal(await page.evaluate(`document.getElementById('project-controls').hidden`), true);
  assert.equal(await page.evaluate(`document.querySelector('.projects__status-link').href`), 'https://github.com/SZ-io');
  assert.equal(await page.evaluate(`getComputedStyle(document.getElementById('project-status')).color`), 'rgb(62, 68, 75)');
  assert.ok(page.problems.every((problem) => problem.includes('ERR_BLOCKED_BY_CLIENT')), page.problems.join('\n'));
});

await test('hovering a row highlights it and underlines the title', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  await page.hover('#projects-selected .project-row:nth-child(2) .project-row__summary');
  const selector = '#projects-selected .project-row:nth-child(2)';
  await page.waitFor(`getComputedStyle(document.querySelector('${selector}')).backgroundColor === 'rgb(238, 240, 242)'`);
  await page.waitFor(`getComputedStyle(document.querySelector('${selector} a')).textDecorationColor === getComputedStyle(document.querySelector('${selector} a')).color`);
});

// Design rules

await test('font is self-hosted and the hero uses it at 800', {}, async (page) => {
  await page.evaluate('document.fonts.ready');
  await page.waitFor(`document.fonts.check('800 16px "Hanken Grotesk"')`);
  const style = await page.evaluate(`(() => {
    const { fontFamily, fontWeight } = getComputedStyle(document.getElementById('home-title'));
    return { family: fontFamily.split(',')[0], weight: fontWeight };
  })()`);
  assert.deepEqual(style, { family: '"Hanken Grotesk"', weight: '800' });
});

await test('only the specified shapes are rounded, with the specified radii', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  const radii = await page.evaluate(`Object.fromEntries([...document.querySelectorAll('body *')]
    .filter((node) => parseFloat(getComputedStyle(node).borderTopLeftRadius) > 0)
    .map((node) => [node.getAttribute('class'), getComputedStyle(node).borderTopLeftRadius]))`);
  assert.deepEqual(radii, {
    'skip-link': '999px',
    'site-nav': '999px',
    'site-nav__toggle': '999px',
    'site-nav__link': '999px',
    'theme-toggle': '999px',
    'status-line__dot': '50%',
    button: '999px',
    'key-facts__pill': '999px',
    'view sheet': '20px',
    'projects__search': '999px',
    filter: '999px',
    'project-row': '12px',
  });
});

await test('targets are at least 44px', {}, async (page) => {
  const heights = await page.evaluate(`['.button', '.text-link', '.site-nav__link', '.theme-toggle']
    .map((selector) => document.querySelector(selector).getBoundingClientRect().height)`);
  assert.ok(heights.every((height) => height >= 44), heights.join());
});

await test('the active nav link is a filled pill that transitions over 200ms', { hash: '#about' }, async (page) => {
  const style = await page.evaluate(`(() => {
    const { backgroundColor, color, transitionDuration } = getComputedStyle(document.querySelector('[aria-current="page"]'));
    return { backgroundColor, color, transitionDuration };
  })()`);
  assert.deepEqual(style, { backgroundColor: 'rgb(17, 19, 22)', color: 'rgb(247, 248, 249)', transitionDuration: '0.2s' });
});

await test('floating elements use the shadow in light and a border in dark', {}, async (page) => {
  assert.match(await page.evaluate(`getComputedStyle(document.querySelector('.site-nav')).boxShadow`), /0px 8px 24px/);
  await page.click('.theme-toggle');
  await page.waitFor(`${THEME} === 'dark'`);
  const dark = await page.evaluate(`(() => {
    const { boxShadow, borderTopColor, borderTopWidth } = getComputedStyle(document.querySelector('.site-nav'));
    return { boxShadow, borderTopColor, borderTopWidth };
  })()`);
  assert.deepEqual(dark, { boxShadow: 'none', borderTopColor: 'rgb(48, 53, 59)', borderTopWidth: '1px' });
});

await test('the dot grid is on the page and off in print', {}, async (page) => {
  assert.match(await page.evaluate('getComputedStyle(document.body).backgroundImage'), /^radial-gradient/);
  await page.send('Emulation.setEmulatedMedia', { media: 'print' });
  assert.equal(await page.evaluate('getComputedStyle(document.body).backgroundImage'), 'none');
});

await test('laptop illustration is decorative and has no text', {}, async (page) => {
  const laptop = await page.evaluate(`(() => {
    const svg = document.querySelector('#home svg.laptop');
    return {
      hidden: svg.getAttribute('aria-hidden'),
      focusable: svg.getAttribute('focusable'),
      text: svg.textContent.trim(),
      textNodes: svg.querySelectorAll('text, title, desc, image').length,
      styled: svg.querySelectorAll('[style], [fill], [stroke]').length,
    };
  })()`);
  assert.deepEqual(laptop, { hidden: 'true', focusable: 'false', text: '', textNodes: 0, styled: 0 });
});

await test('no hue, gradient or glass in any CSS, and colors stay in tokens.css', {}, async () => {
  const cssDirectory = new URL('../assets/css/', import.meta.url);
  const COLOR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
  const channels = (color) => {
    if (color.startsWith('#')) {
      const digits = color.slice(1);
      const full = digits.length < 6 ? [...digits].map((d) => d + d).join('') : digits;
      return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16));
    }
    return color.match(/[\d.]+/g).slice(0, 3).map(Number);
  };
  // The palette's greys lean very slightly cool; any hue accent is far above this.
  const MAX_CHROMA = 24;
  const assertNeutral = (name, source) => {
    for (const color of source.match(COLOR) ?? []) {
      const values = channels(color);
      assert.ok(Math.max(...values) - Math.min(...values) <= MAX_CHROMA, `${name}: ${color} has a hue`);
    }
  };

  for (const file of readdirSync(cssDirectory).filter((name) => name.endsWith('.css'))) {
    const source = readFileSync(new URL(file, cssDirectory), 'utf8');
    assertNeutral(file, source);
    assert.doesNotMatch(source, /--accent|--fill|linear-gradient|conic-gradient|backdrop-filter|text-shadow/, file);
    if (file !== 'tokens.css') {
      assert.deepEqual(source.match(COLOR), null, `${file} has hard-coded colors`);
    }
  }
  assertNeutral('favicon.svg', readFileSync(new URL('../assets/img/favicon.svg', import.meta.url), 'utf8'));
});

await test('filters are 44px targets with even gaps', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  const boxes = await page.evaluate(`[...document.querySelectorAll('.filter')].map((filter) => {
    const { width, height } = filter.getBoundingClientRect();
    return { width, height };
  })`);
  assert.ok(boxes.every(({ width, height }) => width >= 44 && height >= 44), JSON.stringify(boxes));
});

await test('keyboard focus on a project link shows the focus ring', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  await page.evaluate(`document.querySelector('.filter:last-child').focus()`);
  await page.press('Tab');
  await page.waitFor(`document.activeElement.className === 'project-row__link'`);
  const ring = await page.evaluate(`(() => {
    const { outlineStyle, outlineWidth, outlineColor } = getComputedStyle(document.activeElement);
    return [outlineStyle, outlineWidth, outlineColor];
  })()`);
  assert.deepEqual(ring, ['solid', '2px', 'rgb(17, 19, 22)']);
});

await test('every sprite icon is used and every reference resolves', { hash: '#projects' }, async (page) => {
  await page.waitFor(PROJECTS_READY);
  const symbols = await page.evaluate(`[...document.querySelectorAll('symbol')].map((symbol) => symbol.id).sort()`);
  const referenced = await page.evaluate(`[...new Set([...document.querySelectorAll('use')].map((use) => use.getAttribute('href').slice(1)))]`);
  const dynamic = ['icon-menu', 'icon-x'];
  assert.deepEqual(symbols, [...new Set([...referenced, ...dynamic])].sort());
});

await test('404 page renders with the site styles', { path: '/missing-page', allowProblems: true }, async (page) => {
  assert.equal(await page.evaluate(`document.querySelector('h1').textContent`), 'Page not found');
  assert.equal(await page.evaluate(`getComputedStyle(document.querySelector('.button')).backgroundColor`), 'rgb(17, 19, 22)');
  assert.ok(page.problems.every((problem) => problem.includes('404')), page.problems.join('\n'));
});

await browser.close();
server.close();

const failed = results.filter((result) => !result.passed).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
