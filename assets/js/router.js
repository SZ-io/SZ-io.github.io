const SITE_TITLE = 'Matan Elgrissi';
const DEFAULT_VIEW = 'home';
const VIEW_NAMES = new Map([
  ['home', null],
  ['about', 'About'],
  ['projects', 'Projects'],
  ['skills', 'Skills'],
  ['contact', 'Contact'],
]);
const ALIASES = new Map([['education', 'about']]);

function viewFromHash() {
  const hash = location.hash.slice(1);
  const id = ALIASES.get(hash) ?? hash;
  return VIEW_NAMES.has(id) ? id : DEFAULT_VIEW;
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function initRouter() {
  const views = new Map([...VIEW_NAMES.keys()].map((id) => [id, document.getElementById(id)]));
  const links = [...document.querySelectorAll('.site-nav__link')];
  let current = null;

  function show(id) {
    const name = VIEW_NAMES.get(id);

    for (const [viewId, view] of views) {
      view.hidden = viewId !== id;
    }
    for (const link of links) {
      if (link.getAttribute('href') === `#${id}`) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
    document.title = name ? `${name} · ${SITE_TITLE}` : SITE_TITLE;
    current = id;
  }

  function onHashChange() {
    const id = viewFromHash();
    const view = views.get(id);

    if (id !== current) {
      // The fade only plays for a switch, never for the first paint.
      view.classList.add('view--entering');
      show(id);
    }
    view.querySelector('h1, h2').focus({ preventScroll: true });
    scrollToTop();
  }

  // Scroll is handled here, so the browser must not restore it on Back and Forward.
  history.scrollRestoration = 'manual';
  show(viewFromHash());
  document.documentElement.classList.remove('js-pending');

  window.addEventListener('hashchange', onHashChange);
  // The browser's own scroll to a fragment such as #education lands just after load.
  window.addEventListener('load', () => requestAnimationFrame(scrollToTop), { once: true });

  // "#main" isn't a view, so following it as a hash would switch to Home.
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('main').focus();
  });
}
