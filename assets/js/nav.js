export function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const toggleIcon = document.getElementById('nav-toggle-icon');
  const panel = document.getElementById('nav-panel');

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggleIcon.setAttribute('href', open ? '#icon-x' : '#icon-menu');
    panel.classList.toggle('site-nav__panel--open', open);
  }

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  // The router moves focus to the new window's heading.
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
}
