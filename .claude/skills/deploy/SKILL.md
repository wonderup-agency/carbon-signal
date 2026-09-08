---
name: deploy
description: Build, commit and push a release, then hand off the Webflow pin and publish
argument-hint: ''
---

# Deploy

Run the full release flow: build production assets, commit and push, then hand
off the two steps that actually make it live.

> **Critical rule**: `dist/` must always be built with `npm run build` (`rollup.config.prod.js`) before deploying. Never commit a `dist/` built with `npm run dev` — dev builds contain sourcemaps and unminified code. This skill enforces this automatically.

## Step 1 — Check for uncommitted changes

Run `git status --porcelain`.

If there are **staged or unstaged changes** (excluding untracked files — i.e. `M`, `A`, `D`, `R` entries), stop and tell the user:

> You have uncommitted changes. Please commit or stash them before deploying.

Untracked files (`??`) are fine — they won't be included in the deploy commit.

## Step 2 — Run the production build

Run:

```
npm run build
```

This runs `eslint src/ && prettier . --write` (prebuild hook), then Rollup with `rollup.config.prod.js` — minified, no sourcemaps, no console logs.

If the build fails, stop and show the error output. Do not proceed to commit.

After the build, verify no `.map` files exist in `dist/`:

```
ls dist/*.map 2>/dev/null
```

If any `.map` files are found, the build used the wrong config. Stop and tell the user to run `npm run build` manually and check for errors.

## Step 3 — Commit and push

Run these commands sequentially:

```
git add dist/
git commit -m "build"
git push
```

If any git command fails, stop and show the error.

## Step 4 — Confirm, and hand off the two manual steps

The push is **not** the deploy. The live site keeps serving the previously pinned
SHA until Webflow is repointed, so tell the user the build and push succeeded and
that two steps remain — both outside this repo, both theirs to run:

1. **Open the Webflow Designer and click the purple `↺` (WUP Dev Extension).**
   It rewrites every jsDelivr `@{ref}` in the project — global custom code, every
   page, CMS templates — to the SHA just pushed. Check the modal for any row that
   reports `✗ failed`.
2. **Publish the site.** Custom code changes only reach the live domain on
   publish.

Until step 1 runs, the site serves an old but coherent bundle — a safe stale
state, not a broken one. Do not suggest pointing anything at `@main` as a
shortcut: it is cached in visitors' browsers for up to 7 days, and hashed chunk
names mean a stale `main.js` 404s on imports that no longer exist.

### Fallback for anyone without the extension

The extension is Chrome-only and installed by hand. If the user does not have it,
read the SHA that was just pushed:

```
git rev-parse HEAD
```

and give them the pinned base URL to paste into Webflow → Project Settings →
Custom Code, replacing `@main` in the snippet:

```
https://cdn.jsdelivr.net/gh/wonderup-agency/carbon-signal@<sha>/dist
```

Say plainly what this does and does not cover: it pins the **global** snippet
only. Page bundles (`src/pages/`) and CMS template pages keep whatever ref they
were last pasted with, and only the extension reaches those. Never write this SHA
back into `webflow-snippet.html` — that file is the placeholder template, and a
stored copy of a live value is what drifts.

### CDN purging

No action needed on the normal path. A freshly pinned `@<sha>` URL has never been
requested by anyone, so there is nothing cached to purge.
`.github/workflows/purge-cdn.yml` purges `@main` only, which matters solely in the
window between pasting the raw snippet and pinning it.
