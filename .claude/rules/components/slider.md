# slider

## Purpose

One component for every slider on the site. Wraps Swiper and is configured
entirely from data attributes, so adding a slider is Webflow markup only — no JS
change.

The active slide is the leftmost one and is wider than the rest. That is not
custom logic: with `slidesPerView: 'auto'` Swiper aligns the active slide to the
container's start, so "active" and "leftmost" are the same slide, and the CSS
just gives `.swiper-slide-active` a bigger width.

## Webflow Setup

No `data-component` attribute. Triggered by `[data-slider]`, so the same markup
that configures a slider also loads it — same reasoning as `bg-grid` and
`pillars`.

### Structure

```
[data-slider]                 root — config lives here
  [data-slider-prev]          optional, anywhere inside the root
  [data-slider-next]          optional
  [data-slider-viewport]      optional; the clipping/drag area
    [data-slider-track]       direct parent of the slides
      [data-slider-slide]     one per slide (direct children of the track)
```

**`[data-slider-viewport]` is what you want whenever the arrows or a label sit
outside the scrolling strip** (as in the About page design). Swiper measures its
own root and treats it as the drag surface, so that root must wrap the track and
nothing else — put a header row inside it and dragging the header scrolls the
track. The viewport gives the arrows somewhere to live inside `[data-slider]`
without being inside the swipe area.

Omit it and the root becomes the viewport, which is fine for a bare slider.
`slider.css` handles both shapes: the root only clips when there is no inner
viewport.

### Config attributes

All optional, all on the root:

| Attribute            | Default | Meaning                              |
| -------------------- | ------- | ------------------------------------ |
| `data-slider-speed`  | `600`   | Transition duration in ms            |
| `data-slider-gap`    | `0`     | Space between slides in px           |
| `data-slider-loop`   | `false` | Wrap around; any value but `"false"` is true |

### Sizing

Set these custom properties on the root in Webflow — per slider, per breakpoint:

| Property           | Default                       | Meaning                |
| ------------------ | ----------------------------- | ---------------------- |
| `--slide-w`        | `22rem` (352px)               | Collapsed slide width  |
| `--slide-w-active` | `27.5rem` (440px)             | Active (leftmost) width|
| `--slider-ease`    | `cubic-bezier(0.22,1,0.36,1)` | Shared easing          |

`--slider-speed` is **written by the JS** from `data-slider-speed` — do not set
it by hand, or the width transition and Swiper's translate will drift apart and
the row tears mid-transition.

`--slide-w` and `--slide-w-active` are also **read by the JS**, which is why they
are the contract rather than a convenience. Both the end-offset and the
retargeted translate (below) are computed from them, and neither can be measured
off the DOM instead: while the active card is widening, `offsetWidth` returns an
interpolated value. Use **px or rem only** — the JS converts rem against the root
font size and falls back to the defaults above for any other unit. The fallbacks
are duplicated as `fallbackRem` in `slider.js`; change one, change both.

## Behavior

- **Init**: Per root, finds the track and its direct `[data-slider-slide]`
  children, applies Swiper's structural classes (`swiper`, `swiper-wrapper`,
  `swiper-slide`) so the Designer markup stays semantic, then constructs Swiper
  with the Navigation, A11y and Keyboard modules. Skipped if the track is
  missing or there are fewer than two slides.

### Two things the variable width forces

Both exist because Swiper assumes slides keep the width it measured, which is
exactly what this component breaks. Neither is optional.

- **Trailing offset so the last slides can go active.** Swiper clamps the
  translate at "last slide flush right", so under `slidesPerView: 'auto'` the
  final cards can never reach the left edge — and since active *is* leftmost,
  they could never activate. `params.slidesOffsetAfter` is set to
  `viewport width − active slide width`, recomputed on init, on resize, after
  every slide change, and on `document.fonts.ready`, because the value moves with
  the active card. Skipped entirely when `loop` is on, which already makes every
  slide reachable. Without it the track barely moves on the first arrow click and
  the arrows pick up `is-locked` — `slider.css` hides those with `display: none`,
  so the controls vanish.
- **Retargeting the translate so the row does not jump.** Swiper caches slide
  widths when it builds its snap grid, so the instant the active class moves, the
  offset it is animating *towards* was derived from the pre-change widths — the
  stale value is the destination, not the origin. On
  `slideChangeTransitionStart` the translate is retargeted to
  `−(activeIndex × (collapsed + gap))`: every slide left of the active one is
  collapsed, so that is the correct offset by construction. `translateBounds` is
  passed as `false` because the stale grid's bounds are wrong for the same
  reason. `update()` still runs on `slideChangeTransitionEnd` to resync the grid
  once widths have settled — by then the translate already equals what it
  computes, so nothing moves.
- **Resize**: Not used. Swiper runs its own `ResizeObserver`, so wiring the
  debounced window `resize` hook would only duplicate work. Also re-measures on
  `document.fonts.ready`, which Swiper's observer does not catch.
- **Breakpoint**: Not used — sizing is CSS, so breakpoints are handled by
  overriding the custom properties.

## Dependencies

- `swiper` (npm, runtime dependency) — core plus the Navigation, A11y and
  Keyboard modules only, so Rollup tree-shakes the rest.
- `swiper/css` and `swiper/css/a11y` — Swiper's own structural CSS. Navigation
  CSS is deliberately **not** imported: the arrows are Webflow elements, so
  Swiper's default button styling is dead weight.
- `./styles/slider.css` — the variable-width mechanism. In the bundle rather
  than a Webflow embed because the JS depends on it to work at all (see
  CONVENTIONS.md); appearance still belongs on the Webflow classes.

`slider.css` also has to undo part of `swiper/css`. Swiper declares
`.swiper-slide { display: block; width: 100%; height: 100% }`, and
`dist/styles.css` is appended to `<head>` at runtime — so it lands *after*
Webflow's stylesheet and those three would outrank any Webflow class on the card.
A `[data-slider-slide]` rule reverts them, handing card layout back to Webflow;
the mechanism rule then re-claims `width` at higher specificity, since the JS
depends on it.

Because it carries Swiper, this is the heaviest chunk in the bundle. It only
loads on pages with a `[data-slider]`.

## DOM Expectations

A root matching `[data-slider]` containing one `[data-slider-track]` whose direct
children are `[data-slider-slide]`. Nested sliders are safe — only direct
children of a track are claimed by that track.

Swiper writes `is-disabled` and `is-locked` onto the arrow elements (renamed from
Swiper's defaults so they read as Webflow classes).
