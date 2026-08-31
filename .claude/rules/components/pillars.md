# pillars

## Purpose

Possibilities pillars accordion. Moves the `data-pillar-state` attribute between
panels and publishes two measurements the CSS cannot derive on its own:
`--pillar-h` (each body's own scrollHeight, for the stacked max-height
transition) and `--pillar-open-w` (the width the open panel will have, so desktop
copy does not re-wrap mid-transition).

Migrated from a script-only HTML Embed inside the `Section / Possibilities
Pillars` component.

## Webflow Setup

No `data-component` attribute. Triggered by the existing `[data-pillars]` group
containers, same reasoning as `bg-grid`.

Related attributes:

- `data-pillars` — the accordion group (the trigger)
- `data-pillar` — an individual panel inside the group
- `data-pillar-state` — `"open"` or `"closed"`, written by this component
- `data-pillars-ready` — set to `"true"` on the group once the panel states have
  been normalised; released to the CSS as a gate (see below)

### Two kinds of markup

Groups reach this component two ways, and both have to end up in the same state:

- **Hand-authored** (Possibilities) — the panels are written out individually and
  exactly one carries `data-pillar-state="open"`.
- **Collection List repeated** (Resources) — one template panel is repeated, so
  *every* rendered panel inherits the template's `data-pillar-state="open"` and
  the whole group reads as open.

`normaliseState` reduces either shape to exactly one open panel before anything
measures: a single authored open panel is honoured, and anything else — none, or
the all-open CMS state — falls back to the first panel.

The all-open case is not only a visual problem. `measureWidth` needs at least one
closed panel as a stable width reference, so it returns early on
`if (!closed.length)` and `--pillar-open-w` is never published — the desktop copy
then re-wraps mid-transition with no obvious cause.

Once normalised, the group is flagged `data-pillars-ready="true"`. That releases
a pre-script gate in the **Pillars CSS embed** which holds CMS panels after the
first in their closed presentation, so the all-open markup never flashes before
the JS runs. The gate must key off that attribute or it will keep overriding the
normalised state.

## Behavior

- **Init**: Per group, normalises the panel states (above), then wires click /
  pointerenter / pointerleave / keydown on each panel, sets `role="button"`,
  `tabindex="0"` and `aria-expanded`, then measures. The normalise step runs
  first on purpose — both `aria-expanded` and the first `measure()` read
  `data-pillar-state`. Hover opens on a 90ms delay so a cursor crossing the strip does not
  fire several 600ms width transitions back to back. Arrow keys move between
  panels; Enter and Space open. Also re-measures on late-loading images and on
  `document.fonts.ready`.
- **Resize**: Re-measures every group — width first, then heights, since the new
  width decides how the copy wraps and therefore how tall it is. This replaces
  the embed's own 150ms debounce; `main.js` debounces the hook by the same
  interval.
- **Breakpoint**: Not used. The desktop/stacked split is read per-call via
  `matchMedia('(max-width: 991px)')`.

## Dependencies

None in the bundle. The open/closed state rules — keyed off `data-pillar-state`
so nothing depends on `:has()` — live in the **"Pillars CSS" embed** inside the
`Global / Styles` component on the Webflow canvas
(element `b14023a6-4266-7c63-ad50-b4cfd88d57bd`), not in
`src/components/styles/`.

They sit there so the states render on the Designer canvas; CSS that ships in
`dist/styles.css` never does. `bg-grid` splits the same way. The trade-off is
that this stylesheet is outside version control — edit it in Webflow, and keep
the variable contract (`--pillar-h`, `--pillar-open-w`) in sync with this
component by hand.

## DOM Expectations

Groups matching `[data-pillars]` containing at least two `[data-pillar]` panels.
Bodies are `.pillars_panel_visual-wrapper` and `.pillars_panel_para`. Groups with
fewer than two panels are skipped.
