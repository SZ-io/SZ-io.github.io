const DATA_URL = new URL('../data/projects.json', import.meta.url);
const GITHUB_URL = 'https://github.com/SZ-io';
const TAG_ORDER = ['Security', 'Networking', 'Linux', 'Python', 'C', 'Rust', 'ML'];
const SVG_NS = 'http://www.w3.org/2000/svg';

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function externalLinkIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const use = document.createElementNS(SVG_NS, 'use');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', '#icon-external-link');
  svg.append(use);
  return svg;
}

function createCard(project) {
  const card = element('li', 'project-card');
  card.append(element('h4', 'project-card__title', project.title));

  if (project.status === 'planned') {
    card.append(element('p', 'project-card__badge', 'Planned'));
  }

  card.append(element('p', 'project-card__summary', project.summary));

  const tags = element('ul', 'project-card__tags');
  tags.append(...project.tags.map((tag) => element('li', 'project-card__tag', tag)));
  card.append(tags);

  if (project.repo) {
    const link = element('a', 'project-card__link', 'View repository');
    link.href = project.repo;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(
      element('span', 'visually-hidden', ` for ${project.title} (opens in a new tab)`),
      externalLinkIcon(),
    );
    card.append(link);
  }

  return card;
}

function showLoadError(status, controls) {
  const link = element('a', 'projects__status-link', 'See them on GitHub');
  link.href = GITHUB_URL;
  link.rel = 'noopener noreferrer';
  controls.hidden = true;
  status.replaceChildren("Projects couldn't load. ", link, '.');
}

export async function initProjects() {
  const controls = document.getElementById('project-controls');
  const search = document.getElementById('project-search');
  const filters = document.getElementById('project-filters');
  const status = document.getElementById('project-status');

  const groups = [
    { name: 'selected', title: 'projects-selected-title', list: 'projects-selected' },
    { name: 'earlier', title: 'projects-earlier-title', list: 'projects-earlier' },
  ].map((group) => ({
    name: group.name,
    title: document.getElementById(group.title),
    list: document.getElementById(group.list),
    items: [],
  }));

  let projects;
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    projects = await response.json();
    if (!Array.isArray(projects)) {
      throw new TypeError('Expected an array of projects');
    }
  } catch (error) {
    console.warn('Project data failed to load:', error);
    showLoadError(status, controls);
    return;
  }

  const state = { query: '', tag: null };
  const items = projects.map((project) => {
    const item = {
      card: createCard(project),
      tags: project.tags,
      text: [project.title, project.summary, ...project.tags].join(' ').toLowerCase(),
    };
    const group = groups.find((candidate) => candidate.name === project.group);
    group.items.push(item);
    group.list.append(item.card);
    return item;
  });

  const presentTags = new Set(projects.flatMap((project) => project.tags));
  const chips = [null, ...TAG_ORDER.filter((tag) => presentTags.has(tag))].map((tag) => {
    const chip = element('button', 'filter-chip', tag ?? 'All');
    chip.type = 'button';
    chip.addEventListener('click', () => {
      state.tag = state.tag === tag ? null : tag;
      applyState();
    });
    filters.append(chip);
    return { chip, tag };
  });

  function applyState() {
    const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    let visibleCount = 0;

    for (const item of items) {
      const matchesTag = state.tag === null || item.tags.includes(state.tag);
      const matchesSearch = terms.every((term) => item.text.includes(term));
      item.card.hidden = !(matchesTag && matchesSearch);
      visibleCount += item.card.hidden ? 0 : 1;
    }

    for (const group of groups) {
      const empty = group.items.every((item) => item.card.hidden);
      group.title.hidden = empty;
      group.list.hidden = empty;
    }

    for (const { chip, tag } of chips) {
      chip.setAttribute('aria-pressed', String(state.tag === tag));
    }

    status.textContent =
      visibleCount === 0
        ? 'No projects match. Clear the search or choose All.'
        : `Showing ${visibleCount} ${visibleCount === 1 ? 'project' : 'projects'}`;
  }

  search.addEventListener('input', () => {
    state.query = search.value;
    applyState();
  });

  controls.hidden = false;
  applyState();
}
