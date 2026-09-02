# Tech Stack

## Runtime & Language

- **JavaScript (ES modules)** — all source uses `import`/`export`, `type: "module"` in package.json
- **Node.js** — scripts, build tooling
- **Browser target** — components run in the browser, loaded as ES modules via `<script type="module">`

## Bundler

- **Rollup** — two configs: `rollup.config.dev.js` (dev) and `rollup.config.prod.js` (prod)
  - `@rollup/plugin-node-resolve` — resolves node_modules imports
  - `@rollup/plugin-commonjs` — converts CJS dependencies to ESM
  - `@rollup/plugin-terser` — minification (prod only)
  - `rollup-plugin-delete` — cleans `dist/` before prod builds
  - `rollup-plugin-postcss` — CSS processing and extraction

## CSS

- **PostCSS** with `postcss-preset-env` (stage 2) — nesting, autoprefixer
- CSS is extracted to `dist/styles.css` in both dev and prod
- CSS is imported directly in JS files — no separate CSS build step

## Linting & Formatting

- **ESLint** (v9, flat config) — `eslint.config.js` uses `@eslint/js` recommended + `eslint-config-prettier`
- **globals** — supplies the full `globals.browser` set to ESLint. Replaces a hand-rolled three-entry list (`document`/`window`/`console`) that failed on `src/main.js`, which uses `setTimeout`/`clearTimeout`
- **Prettier** — default config (no `.prettierrc` file, uses Prettier defaults)
- Runs automatically before prod builds via `prebuild` script

## Dev Server

- **http-server** — serves `dist/` on `http://127.0.0.1:8080` with CORS enabled
- **concurrently** — runs Rollup watch + http-server in parallel for `npm run dev`

## CDN & Deployment

- **jsDelivr** — serves production assets from GitHub via `cdn.jsdelivr.net/gh/owner/repo@version/dist/`
- **Tagged releases are what the site actually uses** (`@v1.0.0`). Bump the tag every deploy and update the snippet in Webflow Project Settings.
- `@main` must NOT be used in production. jsDelivr sends `max-age=604800`, so a mutable ref sits in visitors' browsers for up to 7 days; since each build renames the hashed chunks, a stale `main.js` imports filenames that no longer exist and 404s. Purging fixes the edge only — not a visitor's browser cache.

## Tunneling

- **Cloudflare Tunnel** (`cloudflared`) — exposes local server for testing on real devices/Webflow preview

## Sliders

- **Swiper** (v14) — powers every slider via the `slider` component. Imported as
  ES modules (core + Navigation, A11y, Keyboard) so Rollup tree-shakes the rest,
  and code-split into its own chunk that loads only on pages with a
  `[data-slider]`. Chosen over a hand-rolled slider for touch/drag, a11y and
  keyboard handling. Swiper's Navigation *CSS* is intentionally not imported —
  the arrows are Webflow elements.

## Smooth scroll

- **Lenis** (v1) — site-wide smooth scrolling via `smooth-scroll.js`. Chosen over
  wrapper-transform libraries because it drives the *real* scroll position, so
  `position: sticky`, `IntersectionObserver` and CSS `view()` timelines keep
  working — all of which this site uses. Skipped entirely under
  `prefers-reduced-motion`, and `syncTouch` left off so native momentum
  scrolling survives on touch devices.
- Unlike Swiper it is **not code-split**: it has no selector to trigger on, so it
  ships in the global chunk and loads on every page (~5.5KB gzipped, plus ~130
  bytes of its CSS).

## Dependencies

- **Runtime**: `swiper` and `lenis` (both bundled to the browser), `picocolors`
  (used by scripts only, not bundled to browser)
- **Dev**: All other deps are devDependencies (Rollup, ESLint, Prettier, etc.)
- No frontend framework — vanilla JavaScript only
