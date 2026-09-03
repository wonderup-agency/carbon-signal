# Rollup Configuration

Two separate configs: `rollup.config.dev.js` (development) and `rollup.config.prod.js` (production).

## Dev and prod write to different directories

`dist/` is the **deploy artifact**: prod-only, committed to git, served by
jsDelivr. `dev/` is **scratch**: dev-only, gitignored, served by http-server.

They used to share `dist/`, and that was a bug in two directions. A watch build
overwrote the committed bundle with unminified, `console`-laden, sourcemapped
code — so whatever was in `dist/` after a dev session was no longer what had been
deployed. And because the dev config cleans only once (`runOnce`) while chunk
names carry a content hash, every save emitted a *new* filename and left the old
chunk behind: one edit to `bg-grid.js`, one more `bg-grid-<hash>.js` forever.

Both are fixed at the root — separate directories, and no hash in dev (below).

## Shared structure

Both configs share the same entry points and helper functions:

### Entry points

- `src/main.js` — always included as the `main` entry.
- `src/pages/*.js` — automatically discovered by `getPageEntries()`, which recursively reads `src/pages/` and maps each `.js` file to a named entry (e.g., `src/pages/blog/post.js` → entry name `blog/post`). Silently returns `{}` if the directory doesn't exist.

### `checkGlobalJs` plugin

Custom Rollup plugin that runs at `buildStart`. Checks if `src/components/global.js` exists using `accessSync`. If missing, emits a Rollup warning (not an error) — `main.js` handles the missing file gracefully at runtime with a try/catch.

### Output

Both use `format: 'es'` and `entryFileNames: '[name].js'`. They differ in
directory and chunk naming:

|                  | Dev              | Prod                  |
| ---------------- | ---------------- | --------------------- |
| `dir`            | `dev`            | `dist`                |
| `chunkFileNames` | `[name].js`      | `[name]-[hash].js`    |

The content hash exists to bust the jsDelivr cache, and jsDelivr is not involved
in dev — http-server runs with `-c-1`, so nothing is cached to bust. Dropping it
locally means a rebuilt chunk overwrites itself in place instead of accumulating
a new file per save.

## Dev config (`rollup.config.dev.js`)

Plugins: `del` → `checkGlobalJs` → `resolve` → `commonjs` → `postcss`

- **Sourcemaps**: Enabled (`sourcemap: true` in output, `sourceMap: true` in postcss).
- **PostCSS**: Extracts CSS to `dev/styles.css` (`extract: 'styles.css'` — relative to the output `dir`, so it follows dev/prod). Uses `postcss-preset-env` at stage 2 (nesting, autoprefixer). CSS is minimized. A `<link>` tag is needed in both dev and prod.
- **Clean**: `rollup-plugin-delete` removes `dev/*` once on the first build (`runOnce: true`). In watch mode, subsequent rebuilds do not re-clean, so the dev server is never serving a directory that is mid-delete. Unhashed chunk names are what make that safe — a rebuild replaces files rather than adding to them, so stale output cannot pile up between cleans.
- **No terser**: Code is not minified.

## Prod config (`rollup.config.prod.js`)

Plugins: `del` → `checkGlobalJs` → `resolve` → `commonjs` → `postcss` → `terser`

- **Sourcemaps**: Disabled (`sourcemap: false`).
- **Clean**: `rollup-plugin-delete` removes `dist/*` before each build.
- **PostCSS**: Extracts CSS to `dist/styles.css` (`extract: 'styles.css'`). Same `postcss-preset-env` stage 2 + minimize. Same as dev.
- **Terser**: Minifies JS, strips all `console.*` calls (`drop_console: true`), removes all comments (`comments: false`).
- **Prebuild**: The `npm run build` script has a `prebuild` hook in package.json that runs `eslint src/ && prettier . --write` before Rollup executes.

## Key differences summary

|               | Dev                                    | Prod                                 |
| ------------- | -------------------------------------- | ------------------------------------ |
| Output dir    | `dev/` (gitignored)                    | `dist/` (committed, on jsDelivr)     |
| Chunk names   | `[name].js`                            | `[name]-[hash].js`                   |
| Sourcemaps    | Yes                                    | No                                   |
| CSS handling  | Extracted to `dev/styles.css`          | Extracted to `dist/styles.css`       |
| Minification  | No                                     | Terser (JS) + PostCSS minimize (CSS) |
| Console logs  | Kept                                   | Stripped                             |
| Comments      | Kept                                   | Stripped                             |
| Clean output  | Yes, once on first build (`runOnce`)   | Yes, every build (`del`)             |
| Lint + format | No                                     | Yes (prebuild hook)                  |

## Adding plugins

- Dev plugins go in `rollup.config.dev.js` only.
- Prod plugins go in `rollup.config.prod.js` only. Keep `del` first (cleans the output dir) and `terser` last (minifies final output).
- Shared plugins (resolve, commonjs, postcss) must be updated in both files — they are not shared via a common module.
