# bg-grid

## Purpose

Everything about the background grid system that needs measured layout, which
CSS cannot do: continuous row phasing across section seams, snapping card
heights to whole cells, and the canvas-based cursor deformation.

Paired with the BG Grid embed in Global / Styles, which owns the static CSS
lattice. None of this runs in the Designer, so Preview shows the static grid —
expected, not a bug.

## Webflow Setup

No `data-component` attribute. The component is triggered by the existing
`[data-grid]` sections, since the script coordinates across all of them at once.

Related attributes already in use:

- `data-grid` — marks a grid section (the trigger)
- `data-grid-offset` — opt out of automatic row phasing; the section's phase is
  deliberate so a snapped element's top edge lands on a line
- `data-grid-snap` + `data-grow` — a card whose height snaps up to whole cells
- `data-cols` / `data-rows` — column span (or `full`) and minimum row count
- `data-grid-interactive` — enable the deformation canvas on this section
- `data-grid-exclude` — a region the deformation must not disturb
- `data-grid-canvas` — set by the script once a canvas is attached

## Behavior

- **Init**: Runs `growCards()` then `phaseRows()` (order matters — growing a
  card changes section heights, which changes every phase below it), then
  attaches a deformation canvas to each `[data-grid-interactive]` section.
- **Resize**: Not used — a `ResizeObserver` on `document.body` is used instead,
  because it also catches content-driven height changes (fonts landing, images
  decoding, a CMS list rendering) that the debounced window `resize` hook would
  miss. Also re-runs on `document.fonts.ready` and `window.load`.
- **Breakpoint**: Not used

### The deformation loop stops when the picture stops changing

`step()` reports whether anything actually **changed** this frame — the
frame-over-frame delta in each point's energy and position — not whether the
lattice is currently deformed.

It used to test magnitudes (`p.e > 0.002`) and OR in `live`, and `active` only
clears on `pointerleave`. So a cursor resting anywhere inside an interactive
section held `p.e` at a steady non-zero value with `active` still true, `step()`
could never report idle, and `frame()` redrew an identical lattice at full rate
for as long as the pointer stayed put — thousands of `beginPath`/`stroke` pairs
per frame, on a 2× backing store on Retina, for no visible change.

Because the canvas already shows the settled shape when the loop exits,
stopping is visually correct; the next `pointermove` calls `kick()` and picks it
back up.

Note this does **not** make the deformation follow a scroll. `px`/`py` are
section-relative and only written on `pointermove`, so after a scroll the
lattice stays deformed wherever the cursor last was in the section until the
next pointer move — as it always has. The loop is simply idle while that is
true instead of burning frames on it.

## Dependencies

None. The static grid CSS lives in the Webflow canvas embed, not here.

## DOM Expectations

Sections matching `[data-grid]`. Interactive sections must contain a `.bg-grid`
child to host the canvas. Reads the `--cell`, `--line`, `--grid-opacity`,
`--grid-divisor` and `--grid-phase` custom properties; writes `--grid-offset`
and `--snap-rows`.
