# SZ-io.github.io

Personal portfolio of Matan Elgrissi, a Computer Science student at HIT focused on cybersecurity and DevSecOps. It is a static site with no framework and no build step: plain HTML, CSS and native ES modules, published to https://sz-io.github.io/.

## Preview

ES modules don't load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/.

To run the checks:

```sh
npm ci --ignore-scripts
npm run check
npm run test:browser
```

The browser tests need Node 22 or later and an installed Chrome. Set `CHROME_PATH` if Chrome isn't found.

## File map

```
index.html                 The five views, including the inline SVG icon sprite
404.html                   Not-found page (uses root-absolute paths)
robots.txt, sitemap.xml    Crawler files
package.json               Dev tooling only, nothing here ships
assets/css/tokens.css      Every color, font stack, spacing step, radius and size
assets/css/base.css        Reset, element defaults, utilities
assets/css/components.css  Component styles
assets/js/theme-init.js    Blocking script: sets theme and js classes before first paint
assets/js/main.js          Module entry point
assets/js/theme.js         Theme toggle
assets/js/router.js        Hash routing between the views
assets/js/nav.js           Mobile menu
assets/js/projects.js      Project rows, search and filters
assets/data/projects.json  Project data
assets/data/projects.schema.json  Schema for the project data
assets/fonts/              Hanken Grotesk (latin, variable) and its license
assets/img/                Favicon and social preview image
tools/make-og.mjs          Regenerates og.png with headless Chrome
tools/contrast-check.mjs   Checks WCAG contrast of the color tokens
tools/browser-test.mjs     Browser tests for routing, theme, menu and projects
tools/browser-harness.mjs  Static server and headless Chrome driver for the tests
.github/                   Workflows, Dependabot and lychee config
```

## Add a project

Add an entry to `assets/data/projects.json`:

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Lowercase words joined with hyphens |
| `title` | yes | |
| `summary` | yes | |
| `group` | yes | `selected` or `earlier` |
| `tags` | yes | Any of Security, Networking, Linux, Python, C, Rust, ML |
| `status` | no | `planned` shows a "Planned" badge |
| `repo` | no | GitHub URL. Without one, the row's title isn't a link |

Run `npm run lint:json` to validate it. A new tag must be added to the schema and to `TAG_ORDER` in `assets/js/projects.js`.

## Restyle

Edit `assets/css/tokens.css` first, then `assets/css/components.css`. Each color is written as `light-dark(light value, dark value)`, which is the format `npm run contrast` reads. Run that command after changing a color.

`base.css` and `components.css` must not contain hard-coded colors. Selectors stay single-class, except for the `.js` class and `data-theme` attribute on the root element.

To regenerate the social image after changing the name, sub-line or colors, run `node tools/make-og.mjs`. Set `CHROME_PATH` if Chrome isn't found.

## What the CI does

`pages.yml` runs on pull requests, pushes to `main` and manual dispatch:

1. **validate** runs html-validate and checks `projects.json` against its schema. It also prints a non-blocking list of TODO markers.
2. **links** runs lychee offline against internal links and fragments.
3. **workflow-security** runs zizmor on the workflows.
4. **build** assembles `_site/` with only the public files and uploads it.
5. **deploy** runs only on pushes to `main`, after all of the above pass.

`links.yml` checks external links weekly, separately, so a dead external link never blocks a deploy. LinkedIn is excluded because it returns errors to bots.

Every third-party action is pinned to a full commit SHA. The workflow token is read-only by default, and only the deploy job gets `pages: write` and `id-token: write`. Dependabot updates actions and npm packages weekly.

`package.json` overrides `fast-json-patch` to 3.1.1 because the version `ajv-cli` requests has a known vulnerability.

## Security headers

The Content Security Policy is set with a `<meta>` tag because GitHub Pages can't set response headers. As a result, `frame-ancestors` can't be enforced, since browsers ignore that directive in `<meta>` policies.

## Font license

Hanken Grotesk is used under the SIL Open Font License 1.1. The license text is in `assets/fonts/OFL.txt`. The latin variable file comes from `@fontsource-variable/hanken-grotesk` 5.3.0.

## Icon license

Icons are from [Lucide](https://lucide.dev), used under the ISC license. The GitHub and LinkedIn icons come from lucide-static 0.577.0, because Lucide 1.x removed brand icons. The others come from lucide-static 1.70.0.

## TODO list

Collected with `grep -rn "TODO" index.html`:

- [ ] Confirm the education start year
- [ ] Add relevant courses
- [ ] Review the About text
- [ ] Add Security skills, once confirmed
- [ ] Add the Experience section (intentionally omitted for now)
- [ ] Add the "Download CV" button when a PDF exists in `assets/cv/`

## Manual checklist

1. Rename the repo to `SZ-io.github.io`. On 2026-11-08 GitHub already reported this name, so this may only need `git remote set-url origin https://github.com/SZ-io/SZ-io.github.io.git` locally.
2. Settings → Pages → Source: GitHub Actions. Do this before merging to `main`. While the source is "Deploy from a branch", a merge publishes the whole repo as it stands.
3. Update the old project-page URL anywhere you shared it. If the site was at `sz-io.github.io/SZ-io.github.pages/`, that URL stops working after the rename.
4. Enable Dependabot alerts, secret scanning and CodeQL default setup.
5. Optionally protect `main` and require the `validate` and `links` checks.
