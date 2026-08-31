# pillars

## Purpose

Pillars accordion, **desktop only**. Moves the `data-pillar-state` attribute
between panels and publishes the one measurement the CSS cannot derive on its
own: `--pillar-open-w`, the width the open panel will have, so desktop copy does
not re-wrap mid-transition.

Below 992px there is no accordion on either page — the panels are a plain stacked
list with everything open. Featured resources have to be tappable straight away,
so a tap-to-expand card fights the link sitting inside it; once one page stopped
collapsing there was no reason for the other to differ. That removed the stacked
height animation entirely, and with it `--pillar-h` and the measuring that fed
it.

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
  `tabindex="0"` and `aria-expanded` — but only above 992px, see `syncMode`
  below — then measures the open width. The normalise step runs first on purpose:
  both `aria-expanded` and the first measurement read `data-pillar-state`. Hover
  opens on a 90ms delay so a cursor crossing the strip does not fire several
  600ms width transitions back to back. Arrow keys move between panels; Enter and
  Space open.
- **Resize**: Re-syncs the mode and re-measures every group. This replaces the
  embed's own 150ms debounce; `main.js` debounces the hook by the same interval.
  Resize is also the **only** route by which a breakpoint crossing reaches
  `syncMode`, so the hook is load-bearing rather than an optimisation.
- **Breakpoint**: Not used. The desktop/stacked split is read per-call via
  `matchMedia('(max-width: 991px)')`.

No image-load or `document.fonts.ready` hooks: they existed to re-measure heights
after late layout shifts. The remaining measurement reads the group's own width
and a collapsed panel's flex-basis, neither of which moves when an image decodes
or a font swaps.

### Below 992px the button semantics come off

`syncMode` strips `role`, `tabindex` and `aria-expanded` from every panel under
the breakpoint, and restores them on the way back up. A stacked panel may carry
its own stretched link, so leaving the attributes on would offer a screen reader
a button wrapping an anchor and put the click handler in competition with the
link for the same tap. `open()` and the click and keydown handlers no-op there
too, so `data-pillar-state` simply stops being read — nothing under 992px reacts
to it.

## Dependencies

None in the bundle. The open/closed state rules — keyed off `data-pillar-state`
so nothing depends on `:has()` — live in the **"Pillars CSS" embed** inside the
`Global / Styles` component on the Webflow canvas
(element `b14023a6-4266-7c63-ad50-b4cfd88d57bd`), not in
`src/components/styles/`.

They sit there so the states render on the Designer canvas; CSS that ships in
`dist/styles.css` never does. `bg-grid` splits the same way. The trade-off is
that this stylesheet is outside version control — edit it in Webflow, and keep
the variable contract (`--pillar-open-w`) in sync with this component by hand.

The embed also carries two opt-ins this component never reads, so they are CSS
only: `data-pillars-rail="stacked"` on a group rotates the rail's category tag,
and `.item-link` is the stretched link a panel may wrap.

## DOM Expectations

Groups matching `[data-pillars]` containing at least two `[data-pillar]` panels;
groups with fewer than two are skipped. The component no longer queries the panel
bodies — `.pillars_panel_visual-wrapper` and `.pillars_panel_para` are now the
stylesheet's concern alone, since nothing measures their height any more.
