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
  - `rollup-plugin-delete` — cleans the output dir (`dist/` before every prod build, `dev/` once per watch session)
  - `rollup-plugin-postcss` — CSS processing and extraction

## CSS

- **PostCSS** with `postcss-preset-env` (stage 2) — nesting, autoprefixer
- CSS is extracted to `styles.css` alongside the JS in both dev and prod (`dev/styles.css` in dev, `dist/styles.css` in prod)
- CSS is imported directly in JS files — no separate CSS build step

## Linting & Formatting

- **ESLint** (v9, flat config) — `eslint.config.js` uses `@eslint/js` recommended + `eslint-config-prettier`
- **globals** — supplies the full `globals.browser` set to ESLint. Replaces a hand-rolled three-entry list (`document`/`window`/`console`) that failed on `src/main.js`, which uses `setTimeout`/`clearTimeout`
- **Prettier** — default config (no `.prettierrc` file, uses Prettier defaults)
- Runs automatically before prod builds via `prebuild` script

## Dev Server

- **http-server** — serves `dev/` on `http://127.0.0.1:8080` with CORS enabled. Not `dist/`: that is the committed prod artifact and the dev build never touches it (see ROLLUP.md)
- **concurrently** — runs Rollup watch + http-server in parallel for `npm run dev`

## CDN & Deployment

- **jsDelivr** — serves production assets from GitHub via `cdn.jsdelivr.net/gh/owner/repo@version/dist/`
- **A pinned commit SHA is what the site actually serves** (`@a1b2c3d`), written
  into the Webflow project by the **WUP Dev Extension** after every deploy. It
  rewrites every `@{ref}` — global custom code, all pages, CMS templates — to
  `HEAD` of `main`. Republish the site afterwards; custom code only reaches the
  live domain on publish.
- `@main` must NOT be what the live site runs on. jsDelivr sends
  `max-age=604800`, so a mutable ref sits in visitors' browsers for up to 7 days;
  since each build renames the hashed chunks, a stale `main.js` imports filenames
  that no longer exist and 404s. Purging fixes the edge only — not a visitor's
  browser cache. `@main` appears in `webflow-snippet.html` purely as the
  placeholder the extension rewrites.
- **Extension limits that shape our conventions**: public repos only, `main`
  only, Chrome only, and it does **not** scan Symbols/Components — so a jsDelivr
  URL must never live inside a Webflow Component embed.

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
  `position: sticky`, `IntersectionObserver`, and anything reading
  `window.scrollY` (`nav`, `bg-grid`, `light-block`) keep working — all of
  which this site uses. Skipped entirely under
  `prefers-reduced-motion`, and `syncTouch` left off so native momentum
  scrolling survives on touch devices.
- Unlike Swiper it is **not code-split**: it has no selector to trigger on, so it
  ships in the global chunk and loads on every page (~5.5KB gzipped, plus ~130
  bytes of its CSS).

## Animation

- **No animation library.** Motion is CSS transitions and keyframes on the
  Webflow canvas, plus a small amount of JS that publishes scroll progress as a
  custom property (`light-block`). `CLAUDE.md` registers GSAP skills and they
  are kept deliberately — see below — but GSAP is **not** currently a
  dependency, so don't assume `gsap` is importable.
- **The criterion for adopting GSAP** is choreography, not one effect. It was
  weighed and declined for `light-block`: core plus ScrollTrigger is ~46KB
  gzipped against a 5.5KB global chunk, it cannot interpolate a `clip-path`
  built from `var()`/`calc()` so it would end up animating a scalar custom
  property regardless, and ScrollTrigger would need proxying onto Lenis for a
  second source of truth about scroll position. See
  `components/light-block.md`.
- Pinning, sequenced multi-element reveals, SplitText or Flip would flip that
  judgement — pay the bytes once and standardise rather than hand-rolling the
  third one. GSAP is free for all plugins since v3.13, and Webflow's own
  Interactions are GSAP-backed, so the cost is bytes and integration only.

## Dependencies

- **Runtime**: `swiper` and `lenis` (both bundled to the browser), `picocolors`
  (used by scripts only, not bundled to browser)
- **Dev**: All other deps are devDependencies (Rollup, ESLint, Prettier, etc.)
- No frontend framework — vanilla JavaScript only
