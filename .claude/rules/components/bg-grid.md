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

## Dependencies

None. The static grid CSS lives in the Webflow canvas embed, not here.

## DOM Expectations

Sections matching `[data-grid]`. Interactive sections must contain a `.bg-grid`
child to host the canvas. Reads the `--cell`, `--line`, `--grid-opacity`,
`--grid-divisor` and `--grid-phase` custom properties; writes `--grid-offset`
and `--snap-rows`.
