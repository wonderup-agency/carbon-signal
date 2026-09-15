# scroll-progress

## Purpose

The measurement and scheduling half of every scroll-driven effect on the site.
Takes a set of elements, works out how far each has travelled through the
viewport, maps that to a number and publishes it as a custom property.

`light-block`, `video-highlight` and `parallax` are all one call to it.

## Not a registered component

It has no markup to match a selector against — it is a helper the components
import. It lives in `src/components/` because that is where browser modules go,
not because it participates in the registry. Same arrangement as
`smooth-scroll.js`, with one difference that matters: **this one is not in the
global chunk.**

Because three lazily-imported components share it, Rollup emits it as its own
shared chunk (`scroll-progress-<hash>.js`, ~1.2KB) rather than inlining it into
each. A page with no scroll effect never requests it; a page with one or more
requests it once. That is the right shape here — inlining it into three chunks
would ship three copies to the Technology page, which has two of them.

## API

```js
import { trackScrollProgress, revealProgress } from './scroll-progress.js'

return trackScrollProgress(elements, {
  property: '--light-bleed-p',
  map: revealProgress,
})
```

| Option | Required | Meaning |
| --- | --- | --- |
| `property` | yes | custom property to write on each element |
| `map` | yes | `(position) => value`; see the range below |
| `epsilon` | no | skip writes smaller than this, default `0.0005` |

Returns `{ resize }` — hand it straight back from the component's default
export and `main.js` wires it up.

### The position it hands `map`

`position` replicates a `view()` timeline's default `cover` range: 0 when the
element's top edge sits at the bottom of the viewport, 1 once its bottom edge
has passed the top.

```
position = (viewportHeight - top) / (viewportHeight + elementHeight)
```

It is **not clamped**. Outside the range it keeps going negative and past 1,
and each `map` decides what that means — `revealProgress` returns 0, `parallax`
clamps. Clamping here would have hidden that choice.

### Measurement is cached, not per frame

`top` comes from a cached page offset minus the current scroll, not from a
fresh `getBoundingClientRect()`, so the per-frame path does no layout reads.
Measurement is confined to init, `resize`, a `ResizeObserver` on
`document.body`, `document.fonts.ready` and `window.load`.

The observer watches the body rather than the tracked elements because an
element's *page position* is changed by anything above it, not only by its own
height — the same reasoning as `bg-grid`.

### The rule every caller has to honour

**Whatever the published property ends up moving must not be able to resize its
own containing block.** The `ResizeObserver` above fires on any body height
change, so an effect that grows an in-flow element would re-measure itself every
frame, and on this site would also re-run `bg-grid`'s `growCards()`,
`phaseRows()` and canvas rebuild alongside it.

In practice that means the moving element is absolutely positioned. All three
callers satisfy it: `light-block` moves a `::before`, `video-highlight` moves an
absolutely positioned lightbox, `parallax` moves an image inside an absolutely
positioned frame. See `video-highlight.md` for the long version.

## `revealProgress`

The shared curve for the two reveals: nothing until 10, open between 10 and 42,
hold fully open to 58, settle back by 90, nothing after.

It lives here rather than in either component because the two reveals are meant
to read as one effect — holding the schedule in one place makes that true by
construction instead of by two files agreeing. `easeInOut` is exported too, for
anything that wants the curve without the hold.

### The easing is the real curve, not an approximation

CSS `ease-in-out` is `cubic-bezier(0.42, 0, 0.58, 1)`, and the animation this
replaced applied it to each keyframe interval. Chrome and Safari 26 ran the CSS
version in production, so eyeballing the curve would have been a visible
regression for most of the traffic.

`easeInOut` therefore inverts the bezier's x component with Newton-Raphson and
reads off y. Worth knowing why a smoothstep will not do: the y component of this
curve *is* `3t² − 2t³` in the curve's own parameter, but the x mapping is not the
identity, so `smoothstep(x)` is a different function of progress.

**The extraction was verified numerically, not by eye** — 1400 samples across
`-0.2 … 1.2` against the shipped `bleedAt`, max absolute difference `0`. Re-run
that against `git show <pre-extraction-sha>:src/components/light-block.js` if
the curve is ever touched again.

## Not coupled to smooth scroll

Reads `window.scrollY` and listens to the native `scroll` event rather than
`lenis.on('scroll')`. Lenis sets the genuine scroll position every frame, so
every effect built on this behaves identically with smooth scroll on, off or
absent, and carries no dependency on `global.js` having run first.

Scroll events are coalesced through one `requestAnimationFrame`, so several
events landing in a frame do one paint.

## Dependencies

None.

## DOM Expectations

None of its own. It measures whatever elements it is handed and writes to them.
