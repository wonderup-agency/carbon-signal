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

It also carries `styles/base.css` — the only stylesheet left in the bundle. It hides the authoring-only Webflow Style Guide component, which is a specific need rather than component appearance, and it cannot move to a canvas embed because those embeds live inside the very component it hides.

`pillars.css` used to live here, and is no longer in the bundle at all. It now lives in the **"Pillars CSS" embed** in the `Global / Styles` component on the Webflow canvas, so the accordion's open/closed states render in the Designer — CSS extracted into `dist/styles.css` never does. `bg-grid` splits the same way, for the same reason.

### Where a stylesheet belongs

- **In a Webflow canvas embed under `Global / Styles`** — the default for custom and component CSS. Bundled CSS does not render in the Designer, so anything shaping a component's appearance or states has to live on the canvas to be authorable. Currently `BG Grid` (static lattice) and `Pillars CSS` (accordion states).
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
    → del (clean dist/ once on first build)
    → checkGlobalJs plugin (warns if global.js missing)
    → resolve + commonjs (handle npm packages)
    → postcss (extract CSS to dist/styles.css)
  → http-server (serves dist/ on :8080)
```

### Prod (`npm run build`)

```
prebuild: eslint src/ && prettier . --write
  → rollup (rollup.config.prod.js)
    → del (clean dist/)
    → checkGlobalJs plugin
    → resolve + commonjs
    → postcss (extract + minimize CSS)
    → terser (minify JS, strip console.*, strip comments)
```

## Deployment Flow

```
Local dev → build → commit dist/ → push to GitHub → tag the release → jsDelivr serves the tag
```

The Webflow site loads assets from an **immutable tagged release** on jsDelivr (`@v1.0.0`), not from `@main`. During local development the snippet in `webflow-snippet.html` points to `localhost:8080` with the pinned CDN URL as the production fallback.

**Bump the tag on every deploy**, and update the snippet in Webflow Project Settings to match. This is not cosmetic: jsDelivr sends `max-age=604800`, so a mutable ref like `@main` sits in each visitor’s browser cache for up to 7 days. Because every build renames the hashed chunks, a stale `main.js` imports chunk filenames that no longer exist and 404s — the component silently never loads. Purging jsDelivr fixes the edge but cannot clear a visitor’s browser cache; only a new URL can. Pinning per release makes that class of bug impossible.

