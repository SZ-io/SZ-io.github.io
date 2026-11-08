import { initTheme } from './theme.js';
import { initNav } from './nav.js';
import { initProjects } from './projects.js';

initTheme();
const highlightCurrent = initNav();

initProjects().finally(() => {
  // Rendering cards moves everything below them, so restore any deep link.
  document.getElementById(location.hash.slice(1))?.scrollIntoView();
  highlightCurrent();
});
