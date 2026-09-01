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
| `data-slider-drag`   | `true`  | `"false"` turns dragging off and clicking a card selects it |

### `data-slider-drag="false"` — browse-and-pick

For a slider that reads as a list you choose from rather than a filmstrip. A
widening active card also makes dragging feel like it fights the snap, so the two
tend to go together.

It is deliberately **one** knob rather than two: a slider you cannot drag needs
some other way to reach a card, and a slider you *can* drag should not also
hijack clicks. So the attribute sets `allowTouchMove` and wires click-to-select
as a pair.

Click-to-select is wired directly rather than through Swiper's
`slideToClickedSlide`, which lives inside the touch handlers that
`allowTouchMove: false` switches off — it would silently never fire. The listener
sits on the track, so slides added later still work; it skips clicks inside an
`a` or `button` so an interactive card behaves normally, and no-ops on the
already-active slide.

### Sizing

Set these custom properties on the root in Webflow — per slider, per breakpoint:

| Property           | Default                       | Meaning                |
| ------------------ | ----------------------------- | ---------------------- |
| `--slide-w`        | `22rem` (352px)               | Slide width            |
| `--slide-w-active` | `27.5rem` (440px)             | Active (leftmost) width — **and the opt-in** |
| `--slider-ease`    | `cubic-bezier(0.22,1,0.36,1)` | Shared easing          |

### Two kinds of slider

`--slide-w` sizes the slides. Declaring `--slide-w-active` **as well, with a
different value**, additionally opts that slider into the widening-active-card
behaviour — the derived grid and the `activeIndex`-driven arrows below.

Leave `--slide-w-active` off and you get an ordinary equal-width slider: Swiper
measures its own grid and does its own `isBeginning`/`isEnd` bookkeeping, with
none of this component's machinery involved. That default is deliberate, because
the machinery would *break* an equal-width slider — it would build a grid around
an active width the slides never take.

The property is therefore read **without** the fallback the table lists, so
"absent" stays distinguishable from "set to the default". Comparison is on the
resolved length, so `--slide-w: 22rem` with `--slide-w-active: 352px` counts as
equal-width, not variable.

Everything in the two sections below applies only to the variable-width case.

`--slider-speed` is **written by the JS** from `data-slider-speed` — do not set
it by hand, or the width transition and Swiper's translate will drift apart and
the row tears mid-transition.

`--slider-ease` has to govern **both** the slide width and Swiper's transform, or
the same tearing happens for the easing rather than the duration. `slider.css`
therefore feeds it into `--swiper-wrapper-transition-timing-function`, which is
Swiper's own hook for the wrapper's curve — `swiper/css` only mentions that
variable inside a comment, so left alone it falls back to `ease`. The mismatch is
invisible going backwards and obvious going forwards: the arriving slide's left
edge is the outgoing slide's shrinking width *plus* the translate, so with two
different curves it drifts out of the viewport mid-transition and gets clipped,
while backwards that edge is the translate alone.

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

### The snap grid is defined, not measured

Swiper assumes slides keep the width it measured, which is exactly what this
component breaks — so the grid is written from the tokens instead of being
measured. This is the one non-optional mechanism; everything else follows from it.

Swiper measures the slides once, with whichever one happened to be active at the
time, so the step from the active slide to its neighbour gets recorded as the
*active* width. Collapse that slide on the next move and the step is stale.
Observed live at `activeIndex` 2:

```
sizes:    [278.625, 278.625, 348.288, 278.625, 278.625]
snapGrid: [0, 278.625, 557.25, 905.538, 1114.71]
```

Slide 3 actually sits at `3 × 278.625 = 835.875`, but the grid says `905.538` —
out by `348.288 − 278.625 = 69.663`, exactly the active-width delta. Swiper
translated ~70px too far and clipped the left of the incoming card. Entries
*below* the active index were measured from collapsed slides and are correct,
which is why only forward moves misbehaved.

Correcting the translate after the fact cannot fix this, because the same grid is
wrong for every subsequent move. Every slide but the active one is collapsed, so
the geometry is fully determined:

```
slidesSizesGrid[i] = i === activeIndex ? activeWidth : collapsedWidth
slidesGrid[i]      = i * (collapsedWidth + gap)
snapGrid[i]        = i * (collapsedWidth + gap)
virtualSize        = (n - 1) * (collapsedWidth + gap) + activeWidth
```

Applied on `slidesUpdated`, which Swiper emits at the end of `updateSlides`, so
it holds after init, after resize, and after every `update()`.

Two consequences:

- `maxTranslate()` returns `-snapGrid[snapGrid.length - 1]`, so it becomes
  `−((n − 1) × (collapsed + gap))` — the last slide resting at the left edge,
  which is what a trailing `slidesOffsetAfter` was previously approximating.
- `snapGrid.length` is always greater than one, so `checkOverflow` never sets
  `isLocked`, and the arrows stop being hidden by `slider.css`'s
  `.is-locked { display: none }`.
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

On a **variable-width** slider, `is-disabled` is written onto the arrows **by
this component**, from `activeIndex` — `prev` at index 0, `next` at the last
index, neither when `loop` is on. Swiper's own `disabledClass` is left at its
unstyled library default there, so the two cannot fight.

On an **equal-width** slider it is the reverse: Swiper's `disabledClass` is set to
`is-disabled` and its own bookkeeping drives it, exactly as stock.

`is-locked` is Swiper's in both cases (renamed from its default so it reads as a
Webflow class), though a derived grid means it never fires.

### Why the arrows are not Swiper's job

Swiper's navigation module derives disabled from `isBeginning` / `isEnd`, and
those describe the **translate** — progress compares it against `maxTranslate()`.
With the grid derived, that bound is right (`4 × 352 = 1408` on the About page)
but the translate never quite settles on it, so `isEnd` stayed `false` while
sitting on the last card. Live: `activeIndex: 4, isEnd: false`. The arrow stayed
live, the next click did nothing, and only the click after that disabled it —
mirrored at the start.

The flags and the active card stop coinciding as soon as the active slide is a
different width from the rest, and the end state that matters here is "the last
card is at the left edge" — a statement about `activeIndex`.

Hooked on `activeIndexChange`, plus once after init. Not `slideChange`, which
reports `realIndex` and folds the non-looping edges together.

Swiper's own `disabledClass` is left at the library default, which nothing styles
(`swiper/css/navigation` is not imported). That is deliberate: its navigation
update also runs on `fromEdge`, which can fire *after* `activeIndexChange` and
would re-enable the next arrow. Letting both write `is-disabled` would make the
result depend on event order.
