const STORAGE_KEY = 'theme';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked; the toggle still works for this page view.
  }
}

export function initTheme() {
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const themeColors = document.querySelectorAll('meta[name="theme-color"]');
  const systemLight = matchMedia('(prefers-color-scheme: light)');

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    const background = getComputedStyle(document.body).backgroundColor;
    themeColors.forEach((meta) => meta.setAttribute('content', background));
  }

  apply(root.getAttribute('data-theme'));

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    store(next);
    apply(next);
  });

  systemLight.addEventListener('change', (event) => {
    const stored = readStored();
    if (stored !== 'light' && stored !== 'dark') {
      apply(event.matches ? 'light' : 'dark');
    }
  });
}
