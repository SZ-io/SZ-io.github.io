// Classic blocking script: runs before first paint to set the theme and js class.
(function () {
  var root = document.documentElement;
  var stored = null;

  root.classList.add('js');

  try {
    stored = localStorage.getItem('theme');
  } catch (error) {
    // Storage can be blocked; fall back to the system preference.
  }

  if (stored !== 'light' && stored !== 'dark') {
    stored = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  root.setAttribute('data-theme', stored);
})();
