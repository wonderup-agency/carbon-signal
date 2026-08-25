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
[data-slider]                 root
  [data-slider-track]         direct parent of the slides
    [data-slider-slide]       one per slide (direct children of the track)
  [data-slider-prev]          optional
  [data-slider-next]          optional
```

The arrows do not have to be inside the root's slide area, only inside the root.

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
| `--slide-w`        | `11rem`                       | Collapsed slide width  |
| `--slide-w-active` | `22rem`                       | Active (leftmost) width|
| `--slider-ease`    | `cubic-bezier(0.22,1,0.36,1)` | Shared easing          |

`--slider-speed` is **written by the JS** from `data-slider-speed` — do not set
it by hand, or the width transition and Swiper's translate will drift apart and
the row tears mid-transition.

## Behavior

- **Init**: Per root, finds the track and its direct `[data-slider-slide]`
  children, applies Swiper's structural classes (`swiper`, `swiper-wrapper`,
  `swiper-slide`) so the Designer markup stays semantic, then constructs Swiper
  with the Navigation, A11y and Keyboard modules. Skipped if the track is
  missing or there are fewer than two slides.
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

Because it carries Swiper, this is the heaviest chunk in the bundle. It only
loads on pages with a `[data-slider]`.

## DOM Expectations

A root matching `[data-slider]` containing one `[data-slider-track]` whose direct
children are `[data-slider-slide]`. Nested sliders are safe — only direct
children of a track are claimed by that track.

Swiper writes `is-disabled` and `is-locked` onto the arrow elements (renamed from
Swiper's defaults so they read as Webflow classes).
