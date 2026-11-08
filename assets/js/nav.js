export function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const toggleIcon = document.getElementById('nav-toggle-icon');
  const list = document.getElementById('nav-list');
  const links = [...list.querySelectorAll('a')];
  const sections = links.map((link) => document.querySelector(link.getAttribute('href')));

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggleIcon.setAttribute('href', open ? '#icon-x' : '#icon-menu');
    list.classList.toggle('site-nav__list--open', open);
  }

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  // Focus stays with the browser here so keyboard users continue from the
  // section they chose rather than being sent back to the header.
  list.addEventListener('click', (event) => {
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

  function highlightCurrent() {
    const atBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;
    let current = 0;

    if (atBottom) {
      current = sections.length - 1;
    } else {
      const margin = parseFloat(getComputedStyle(sections[0]).scrollMarginBlockStart) || 0;
      sections.forEach((section, index) => {
        if (section.getBoundingClientRect().top - margin <= 1) {
          current = index;
        }
      });
    }

    links.forEach((link, index) => {
      if (index === current) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  let frame = 0;

  function scheduleHighlight() {
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        highlightCurrent();
      });
    }
  }

  window.addEventListener('scroll', scheduleHighlight, { passive: true });
  window.addEventListener('resize', scheduleHighlight);
  highlightCurrent();

  return highlightCurrent;
}
