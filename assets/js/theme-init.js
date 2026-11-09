// Classic blocking script: runs before first paint to set the theme and js classes.
(function () {
  var root = document.documentElement;
  var stored = null;
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // js-pending keeps the stacked views off screen until the router has picked one.
  root.classList.add('js', 'js-pending');

  try {
    stored = localStorage.getItem('theme');
  } catch (error) {
    // Storage can be blocked; fall back to the system preference.
  }

  if (stored !== 'light' && stored !== 'dark') {
    stored = prefersDark ? 'dark' : 'light';
  }

  root.setAttribute('data-theme', stored);

  // Modules run before load. If the router never ran, use the no-JS layout.
  window.addEventListener('load', function () {
    if (root.classList.contains('js-pending')) {
      root.classList.remove('js', 'js-pending');
    }
  });
})();
