# Conventions

## Language & Modules

- ES modules everywhere (`import`/`export`), never CommonJS (`require`/`module.exports`)
- `type: "module"` is set in package.json
- 2-space indentation
- Prettier defaults for all formatting (no config file, `.prettierignore` excludes `dist`)

## Naming

- **Files**: lowercase, hyphen-separated (`create-component.js`, `rollup.config.dev.js`)
- **Components**: named after their `data-component` attribute value (`calculator.js` → `data-component="calculator"`)
- **Nested components**: mirror directory path (`forms/contact.js` → `data-component="contact"`)
- **Pages**: named to match the Webflow page they target (`pricing.js`, `blog/post.js`)
- **Variables/functions**: camelCase
- **Constants**: camelCase (not UPPER_SNAKE — e.g., `flatItems`, not `FLAT_ITEMS`), except for module-level config-like objects which use UPPER_SNAKE (`MENU_SECTIONS`)

## Exports

- **Components**: default export a function that receives `elements` array
- **Page bundles**: no export required, they're standalone entry points
- **Utilities/config**: named exports preferred, destructure on import
- **Config object** (`src/config.js`): default export

## Component Pattern

Every component follows the same structure:

```js
export default function (elements) {
  // Init logic
  elements.forEach((el) => {
    /* ... */
  })

  // Optional lifecycle hooks
  return {
    resize() {},
    breakpoint(current, previous) {},
  }
}
```

- The function receives all matching DOM elements as an array
- Only runs if matching elements exist on the page (after DOMContentLoaded)
- Return lifecycle hooks only if needed — omit if not used
- `resize` is debounced (150ms) — fires once after the user stops resizing
- `breakpoint` fires only when crossing a Webflow breakpoint threshold. Values: `1920` (2XL), `1440` (XL), `1280` (Large), `992` (Desktop/base), `768` (Tablet), `480` (Mobile Landscape), `0` (Mobile Portrait). Receives the new and previous breakpoint values

## Component Registration

Components are registered in `src/components.js` as an array of `{ selector, importFn }` objects. The `create-component` script manages this automatically. Manual edits follow the same pattern:

```js
{
  selector: "[data-component='name']",
  importFn: () => import('./components/name.js'),
}
```

### Non-`data-component` selectors

A component may register against an existing attribute instead of a new
`data-component` one when the script coordinates across every matching element
at once rather than acting on each in isolation. `bg-grid` does this with
`[data-grid]`: the sections are already marked up for the CSS lattice, and the
phasing logic is inherently page-wide. Prefer `data-component` by default —
reach for this only when a dedicated attribute would be redundant markup, and
document the reason inline in the registry entry.

### Registering on a class

The narrower case, and so far only `light-block` with `.light-block`: when the
JS has to drive **exactly** the set of elements a canvas stylesheet already
matches, register on that same class rather than adding an attribute.

The argument is drift, not brevity. A separate `data-component` value can be
forgotten on a new instance, leaving an element styled but never animated —
failing silently and only in the browsers that need the JS. Sharing one
selector makes that impossible: being styled *is* being animated.

Use it only when a class is genuinely the existing contract between JS and CSS.
A class that merely happens to be on the right element is not a reason — prefer
`data-component` there.

### When a shared class cannot be the opt-in

`parallax` is the inverse of that case and worth keeping distinct. Every
background-image section shares `.section_bg-image-wrapper`, but only some
should drift and the strength varies, so the class cannot carry the decision —
`data-parallax` does.

The no-drift property is preserved by making the **stylesheet key off the same
attribute**: the Parallax CSS embed matches `[data-parallax] .section_bg-image`,
never `.section_bg-image` alone. A section is therefore animated and styled for
it, or neither. Hold that rule whenever an attribute opts a subset of a shared
class into an effect — if the CSS keys off the class instead, the attribute
becomes forgettable and the failure is silent.

### When one shared class serves two sections

`section-tags` is the case where the markup is shared but only one instance of
it is scripted. `.section-tags_*` are the resources filter's own classes,
renamed when the homepage needed the same pills — one design, one set of rules,
generic names so a third section can use them.

Two rules make that safe:

- **The attribute marks the scripted row, not the styled one.**
  `data-section-tags` is on the homepage row only. The resources row is styled
  identically and has no JS, and must not get the attribute.
- **Anything state-like is scoped to it.** The active dot is written
  `[data-section-tags] .section-tags_pill::before`, so it cannot appear on the
  filter row — which has its own unrelated active state (`.is-filter-active`,
  written by Finsweet). Two notions of "active" on one class is fine as long as
  neither selector can reach the other's row.

Per-section differences go on **combos**, never into the base class:
`.is-steps` makes the homepage row sticky and hides it tablet-down; `.is-filled`
gives its pills a background. The base class stays what both rows share.

Note the limit of the sharing. The pills look identical but are not
interchangeable elements — the filter's is a `<label>` wrapping a checkbox that
Finsweet binds to, the homepage's is an `<a>`. The class is shared; the element
is not, and no variant should try to unify them.

### Modules that are not registered at all

A browser module with **no markup to match** does not belong in the registry.
`smooth-scroll.js` is the case: it applies to the whole document, so `global.js`
imports and calls it directly. It still lives in `src/components/` — that is
where browser modules go — and still gets a doc under `.claude/rules/components/`.

`scroll-progress.js` is the second case, and a cheaper one: it is a helper the
components import, not something anything calls on its own. Nothing runs it at
import time, so Rollup emits it as a shared chunk behind the components that
import it — a page with no scroll effect never requests it.

Reach for this only when there is genuinely no selector. The registry exists so
code loads only on pages that need it. Stepping outside it costs nothing for a
pure helper like `scroll-progress.js`, but a module `global.js` *calls* ships in
the global chunk on every page — say so in its doc, with the cost.

## CSS

**Default: custom and component CSS goes in Webflow, not the bundle.** Add it as
a named embed inside the `Global / Styles` component — one embed per concern,
named for what it covers (`BG Grid`, `Pillars CSS`). The reason is authoring:
CSS extracted into `dist/styles.css` does not render in the Designer, so
anything shaping a component's appearance or states is invisible while you work
on the canvas.

Because that CSS sits outside version control, record the JS↔CSS contract — the
custom properties each side reads and writes — in the component's doc.

- **In the bundle** (`src/components/styles/<name>.css`, imported from JS) — the
  narrower case: rules tied to a specific need rather than to a component's
  appearance, e.g. an initial/pre-hydration state, or a fix that has to ship
  and version together with the JS that depends on it.
- Import bundled CSS directly in JS files: `import './styles/component.css'`
- PostCSS handles nesting and autoprefixer (stage 2)
- All CSS extracts to a single `dist/styles.css`
- No CSS-in-JS, no CSS modules

## Error Handling

- Components wrap in try/catch — a failing component doesn't break others
- `global.js` loads with its own try/catch
- Use `console.log` for loading info, `console.warn` for non-critical issues, `console.error` for failures
- Production builds strip all `console.*` calls via Terser

## Scripts

- Node scripts live in `scripts/`
- Scripts use `picocolors` for terminal output coloring
- Scripts are Node-only, never bundled for the browser
