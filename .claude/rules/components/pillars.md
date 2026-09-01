# pillars

## Purpose

Pillars accordion, **desktop only**. Moves the `data-pillar-state` attribute
between panels and computes the geometry the CSS cannot derive on its own.

### Desktop runs on transforms, not flex

Animating `flex-grow` relaid out the whole row every frame — four panels, their
subtrees and the row height — and `flex-grow` is not compositable, so it stayed
on the main thread regardless. `contain: layout paint` helped the subtrees but
not the row, and the stutter survived hiding the images, the rails and the grid
canvas.

Panels are therefore absolutely positioned above 992px and placed with
`translateX`, which composites. Each panel still transitions its own width, but
that is one contained element rather than a row reflow.

The trade is that flex was doing the geometry and now this component does. It
publishes four custom properties, all read by the Pillars CSS embed:

| Property | On | Meaning |
| --- | --- | --- |
| `--pillar-collapsed-w` | group | a closed panel, border box — from the panel's `min-width` |
| `--pillar-panel-w` | group | the open panel, border box — drives its width and the x offsets |
| `--pillar-open-w` | group | the content box *inside* that panel |
| `--pillar-x` | each panel | its x offset, a running total across the row |
| `--pillars-h` | group | row height — absolute children give it none |

**The two open widths are not interchangeable.** `--pillar-open-w` subtracts the
panel's padding and border because its job is locking the head, para and visual
so the copy cannot re-wrap while the panel is moving. Using it as the panel width
too made the panel one padding narrower than the row's arithmetic assumed, while
its children stayed at full content width and spilled past the right padding.
`--pillar-panel-w` is the border-box value the layout needs.

`open()` re-places without re-measuring: only *which* panel is wide changes, not
the widths, so hovering across the strip no longer forces a synchronous reflow
per panel.

**`--pillars-h` has to be cleared before it is read.** The embed sets
`height: var(--pillars-h, auto)` on the panels as well as the row, so measuring a
panel while the variable is set just returns the value already in it — the row
could never grow to fit its content, which collapsed the visual and wrapped the
vertical rail titles into columns. `measureHeight` removes the property first so
the panels fall back to `height: auto` and report their real height. That is one
deliberate forced reflow; it is why the measurement is confined to init, resize
and image load rather than running on every open. The height is read from
`getBoundingClientRect()` and rounded **up** — `offsetHeight` rounds to the
nearest integer, which can land half a pixel short and clip the panel's bottom
border.

**`data-pillars-ready` now does double duty.** It was the CMS gate; it also
switches the desktop layout from the flex fallback to the absolute/transform
mode. The Designer canvas never runs the script, so without that gate every panel
would sit at x=0 with no width while you edit. Everything between setting the
flag and the first `place()` is synchronous inside `initGroup`, so no frame
renders in between.

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

The all-open case is not only a visual problem. `place()` hands the open panel
the entire remaining width, so a group with two open panels would stack them on
top of each other and run the row off its right edge.

Once normalised, the group is flagged `data-pillars-ready="true"`. That releases
a pre-script gate in the **Pillars CSS embed** which holds CMS panels after the
first in their closed presentation, so the all-open markup never flashes before
the JS runs. The gate must key off that attribute or it will keep overriding the
normalised state.

## Behavior

- **Init**: Per group, normalises the panel states (above), then wires click /
  pointerenter / pointerleave / keydown on each panel, sets `role="button"`,
  `tabindex="0"` and `aria-expanded` — but only above 992px, see `syncMode`
  below — then computes the geometry and places the row. The normalise step runs
  first on purpose:
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

An image-load hook re-runs `measureHeight` only. Once the panels leave flow the
row's height is content-derived again, so a late-decoding image can change it.
Panel visuals carry an `aspect-ratio`, which makes the height deterministic
before decode — but a panel added without one would not be, so the hook stays as
the safety net. No `document.fonts.ready` hook: a font swap changes how the copy
wraps, and the copy is width-locked to `--pillar-open-w`.

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
the variable contract in sync with this component by hand — the embed reads all
four of `--pillar-collapsed-w`, `--pillar-open-w`, `--pillar-x` and `--pillars-h`.

The embed also carries three things this component never reads, so they are CSS
only: `.pillars_panel_title.is-two-line` clamps a title to two lines,
`.pillars_panel_rail-tag.is-vertical` fixes the rotated tag's padding axes, and
`.item-link` is the stretched link a panel may wrap.

## DOM Expectations

Groups matching `[data-pillars]` containing at least two `[data-pillar]` panels;
groups with fewer than two are skipped. The component no longer queries the panel
bodies — `.pillars_panel_visual-wrapper` and `.pillars_panel_para` are now the
stylesheet's concern alone, since nothing measures their height any more.
