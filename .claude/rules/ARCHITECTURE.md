# Architecture

## Overview

The project has two distinct parts:

1. **Browser code** (`src/`) — components and pages that run on the Webflow site
2. **Tooling** (`scripts/`, config files) — build pipeline, scaffolding scripts

These never mix. Browser code is bundled by Rollup into `dist/`. Tooling runs in Node.js only.

## Browser Runtime Flow

```
Webflow page loads
  → <script src="main.js" type="module" defer>
    → main.js waits for DOMContentLoaded (or runs immediately if DOM is ready)
    → main.js imports components.js (the registry)
    → main.js dynamically imports global.js
      → global.js default function runs (site-wide setup)
    → main.js iterates the registry:
      → For each component, checks if selector exists on the page
      → If yes: dynamically imports the component module
      → Calls the default function with matching elements
      → Stores returned lifecycle hooks (resize, breakpoint)
    → Window resize event (debounced 150ms) fires hooks on all active components
    → Breakpoint changes fire breakpoint hooks with current and previous values
```

Key design decisions:

- **Code splitting**: Components only load if their DOM selector is present. A page with no `data-component` attributes loads zero component code.
- **Isolation**: Each component is independent. A failing component doesn't break others (try/catch per component).
- **No framework**: Vanilla JS. Components receive raw DOM elements and work with them directly.

## Component System

### Registry (`src/components.js`)

An array of `{ selector, importFn }` objects. The selector uses `data-component` attribute matching. The `importFn` is a dynamic import function for code splitting.

### Loading (`src/main.js`)

1. Queries DOM for each selector
2. Skips components with no matching elements
3. Dynamically imports the module
4. Calls the default export with the element array
5. Collects lifecycle hooks from the return value

### Global (`src/components/global.js`)

Loaded before any components. Runs on every page regardless of data attributes. Use for analytics, global event listeners, shared setup.

It also initialises **smooth scroll** (`smooth-scroll.js`, wrapping Lenis). That module is not in the registry: it has no markup to match a selector against, so `global.js` calls it directly. The trade-off is that it ships in the global chunk and therefore loads on every page — about 5.5KB gzipped — where everything else heavy in this project is code-split behind a selector. See `components/smooth-scroll.md`.

It does **not** carry `scroll-progress.js`, despite that also being an unregistered module. Unlike `smooth-scroll.js` nothing calls it at import time, so Rollup emits it as a shared chunk behind the components that import it — a page with no scroll effect never requests it.

It also carries `styles/base.css` — the only stylesheet left in the bundle. It hides the authoring-only Webflow Style Guide component, which is a specific need rather than component appearance, and it cannot move to a canvas embed because those embeds live inside the very component it hides.

`pillars.css` used to live here, and is no longer in the bundle at all. It now lives in the **"Pillars CSS" embed** in the `Global / Styles` component on the Webflow canvas, so the accordion's open/closed states render in the Designer — CSS extracted into `dist/styles.css` never does. `bg-grid`, `nav` and `light-block` split the same way, for the same reason.

### The reverse direction: CSS that moved into JS

`light-block` is the one case that went the other way. The scroll bleed was a pure CSS `view()` timeline, and its appearance still is — but the *driver* is now `light-block.js`, which publishes a `--light-bleed-p` scalar that the CUSTOM STYLES embed composes a `clip-path` from.

The reason is browser support, not architecture: scroll-driven animations are Chrome 115+ and Safari 26+, with no Firefox support at all, so the `@supports (animation-timeline: view())` guard silently dropped the effect for a large share of visitors, who saw a static card. See `components/light-block.md`.

Read it as a template for the shape rather than licence to move CSS into JS generally: what crossed the boundary was one number, and every length stayed on the canvas.

`video-highlight` is the second instance of that same shape, and it is the one that shows why the shape is worth having. Its card is `[data-grid-snap]`, so its box *is* the grid geometry that `bg-grid` phases every section from — animating the card itself would change the section height on every scroll frame and re-run `growCards()`, `phaseRows()` and the canvas rebuild continuously. Publishing one scalar and letting the embed grow an *absolutely positioned* child instead means the layout that `bg-grid` measures never moves at all. See `components/video-highlight.md`.

`parallax` is the third, and it is the one that forced the shared driver out into the open. All three are now a few lines of configuration over `scroll-progress.js`, which owns the cover-range maths, the cached measurement, the rAF-coalesced scroll loop, the remeasure hooks and — for the two reveals — the bezier curve. See `components/scroll-progress.md`.

The rule that module imposes on its callers is worth stating here rather than only there: **whatever the published property moves must not be able to resize its own containing block.** The driver re-measures on any `document.body` height change, so an in-flow target would re-measure itself every frame and drag `bg-grid` along with it. All three callers move an absolutely positioned element, which is why none of them wakes the grid.

### Where a stylesheet belongs

- **In a Webflow canvas embed under `Global / Styles`** — the default for custom and component CSS. Bundled CSS does not render in the Designer, so anything shaping a component's appearance or states has to live on the canvas to be authorable. Currently `BG Grid` (static lattice), `Pillars CSS` (accordion states), `Nav CSS` (scrolled state), `Video Highlight CSS` (the video card's bleed geometry), `Parallax CSS` (the background-image drift), `Section Tags CSS` (the pill row shared by the resources filters and the homepage step tags — its separators and its active dot) and the light-block bleed inside the shared `CUSTOM STYLES` embed.
- **In the bundle** (`src/components/styles/`, imported from JS) — the narrower case: rules tied to a specific need rather than to a component's appearance — an initial/pre-hydration state, or a fix that must ship and version together with the JS depending on it.

The cost of the default is that the CSS leaves version control, so keep the JS↔CSS contract (the custom properties each side reads and writes) documented in the component's doc.

### Lifecycle

- **Init**: The default function body (runs once on load, after DOMContentLoaded)
- **Resize**: Optional hook called on `window.resize` (debounced 150ms)
- **Breakpoint**: Optional hook called when the window crosses a Webflow breakpoint. Receives `(currentBreakpoint, previousBreakpoint)` as arguments. Values: `1920` (2XL), `1440` (XL), `1280` (Large), `992` (Desktop/base), `768` (Tablet), `480` (Mobile Landscape), `0` (Mobile Portrait).

## Page Bundles (`src/pages/`)

Standalone entry points that Rollup discovers automatically. Each `.js` file becomes a separate bundle in `dist/`. Completely independent from the component system — loaded via separate `<script>` tags on specific Webflow pages.

Page bundles can import from `src/components/` if they need shared logic, but they don't participate in the `data-component` loading system.

## Configuration (`src/config.js`)

A shared config object importable by any component or page. Holds project-level values (API endpoints, feature flags, etc.). Default-exported.

## Build Pipeline

### Dev (`npm run dev`)

```
concurrently:
  → Rollup watch (rollup.config.dev.js)
    → del (clean dev/ once on first build)
    → checkGlobalJs plugin (warns if global.js missing)
    → resolve + commonjs (handle npm packages)
    → postcss (extract CSS to dev/styles.css)
  → http-server (serves dev/ on :8080)
```

Dev writes to `dev/`, not `dist/`. `dist/` is the committed deploy artifact, and
a watch build writing there overwrites the shipped bundle with unminified,
sourcemapped scratch code. `dev/` is gitignored and disposable. See ROLLUP.md.

### Prod (`npm run build`)

```
prebuild: eslint src/ && prettier . --write
  → rollup (rollup.config.prod.js)
    → del (clean dist/ — every build, so dist/ only ever holds the current release)
    → checkGlobalJs plugin
    → resolve + commonjs
    → postcss (extract + minimize CSS)
    → terser (minify JS, strip console.*, strip comments)
```

## Deployment Flow

```
Local dev → build → commit dist/ → push to GitHub → WUP Dev Extension pins Webflow to the new SHA → publish the site
```

**The live site must always run on an immutable ref.** jsDelivr sends
`max-age=604800`, so a mutable ref like `@main` sits in each visitor's browser
cache for up to 7 days. Because every prod build renames the hashed chunks, a
stale `main.js` imports chunk filenames that no longer exist and 404s — the
component silently never loads. Purging jsDelivr fixes the edge but cannot clear
a visitor's browser cache; only a new URL can.

That requirement used to be met by tagging each release and hand-editing the
snippet. It is now met by the **WUP Dev Extension**, which reads `HEAD` of `main`
from the GitHub API and rewrites every `@{ref}` in the Webflow project to that
SHA — global custom code, every page, and CMS template pages. So the ref the site
actually serves is `@<sha>`, which is immutable in exactly the way a tag was, and
the coverage is wider: page bundles and CMS templates get pinned too, not just the
global snippet.

`webflow-snippet.html` therefore carries `@main` as a **placeholder**. It is the
value you paste; the extension is what turns it into the value that ships. During
local development the snippet points to `localhost:8080` with that CDN URL as the
production fallback.

Two consequences worth knowing:

- **The push is not the deploy.** Until the extension runs, the site keeps serving
  the previously pinned SHA. That is a safe failure — an old but coherent bundle,
  not a broken one — which is the main reason this is an improvement on `@main`.
  Webflow custom code only reaches the live domain on publish, so the site has to
  be republished after the rewrite.
- **Never put a jsDelivr URL inside a Webflow Component.** The extension scans
  site-level custom code and page `head`/`postBody` only; a reference inside a
  Symbol/Component embed is invisible to it and would silently stay on whatever
  ref it was pasted with. This matters here because the project deliberately keeps
  CSS in embeds inside the `Global / Styles` component — those are CSS-only, and
  must stay that way.

