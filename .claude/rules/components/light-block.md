# light-block

## Purpose

Drives the light-block scroll bleed: each `.light-block` starts as an inset
rounded card and its surface grows out to full bleed as the block passes
through the middle of the viewport, then settles back on the way out.

The effect itself is not new — it was a CSS `view()` timeline in the **CUSTOM
STYLES embed**. This component replaces the *driver*, not the appearance.

### Why it left CSS

Scroll-driven animations are Chrome 115+ and Safari 26+. Firefox has no support
at all (still behind `layout.css.scroll-driven-animations.enabled`), and every
Safari below 26 is out. The rule sat behind
`@supports (animation-timeline: view())`, so for that share of visitors the
whole thing was dropped and the block rendered as a static card — correct, but
not the design. The client asked for the effect everywhere.

### Why not GSAP

ScrollTrigger plus GSAP core is ~46KB gzipped, against 5.5KB for the entire
current global chunk, to produce one number per frame per element. Three
specific reasons beyond the size:

- **It could not interpolate the property anyway.** The keyframes ran from
  `inset(var(--light-bleed-y) var(--light-gap-x) round var(--light-bleed-radius))`
  to `inset(0px 0px round 0px)`, and `--light-gap-x` is itself a `calc()` on
  `100vw`. GSAP's string interpolation needs resolved numbers of matching
  structure, so it would have had to animate a scalar custom property — which
  is what this file does directly.
- **It would contend with Lenis for scroll.** Lenis already owns the real
  scroll position; ScrollTrigger would need `scrollerProxy` wiring and a second
  source of truth.
- **The project already has this pattern twice.** `pillars` and `bg-grid` both
  measure in JS and publish custom properties that a canvas embed renders.

GSAP remains the right call if this site later grows real scroll
choreography — pinning, sequenced multi-element reveals, SplitText. It is not
the right call for one scalar.

## Webflow Setup

Nothing to add. The component is triggered by the **`.light-block` class**,
which is already the contract: the CUSTOM STYLES rules are keyed off that same
class, so styling a block is what animates it.

That is a deliberate departure from `data-component` — see CONVENTIONS.md. The
reason is drift: the JS has to drive exactly the set of elements the CSS rule
matches, and one shared selector makes divergence impossible. A separate
attribute could be forgotten on a new block, leaving it styled but frozen.

Currently one instance each on Home, Technology, Careers and Resources, all via
the `Section / Light Block` component — but nothing is per-page. Add a light
block to any page and it animates with no code change.

## The JS ↔ CSS contract

This component **writes** one property and reads none:

| Property | On | Meaning |
| --- | --- | --- |
| `--light-bleed-p` | each `.light-block` | reveal progress, `0` = inset card, `1` = full bleed |

Everything else stays in the embed. `--light-gap-x`, `--light-bleed-y` and
`--light-bleed-radius` are never read by the JS, so the geometry can be retuned
on the canvas without touching the bundle.

`p` scales all three insets together via `calc(<length> * (1 - p))`. That is why
the rest state stays exact: there is no second set of "closed" numbers that
could drift from the open one, which was the property the original comment was
careful to preserve.

**The `var(--light-bleed-p, 0)` fallback is load-bearing.** Before the bundle
arrives — or if it never arrives — `p` resolves to 0, the pseudo lands precisely
on the block's box in the block's own colour, and the result is the static
resting card. That is the same graceful degradation `@supports` used to give,
so a CDN failure costs the animation and nothing else.

Since the stylesheet is outside version control, keep the property name in sync
by hand. It is the only shared name.

## Behavior

- **Init**: Caches each block's page-relative `top` and `height`, paints once
  so a refresh partway down the page starts correct, then listens for scroll.
- **Resize**: Re-measures. This hook is load-bearing rather than an
  optimisation — viewport height is part of the progress calculation, and a
  height-only window resize does not change the body's box, so the
  `ResizeObserver` below will not always catch it.
- **Breakpoint**: Not used. The effect runs at every width, as the CSS did.

### Progress, and why it is not measured per frame

Progress replicates a `view()` timeline's default `cover` range: 0 when the
block's top edge sits at the bottom of the viewport, 1 once its bottom edge has
passed the top.

```
position = (viewportHeight - top) / (viewportHeight + blockHeight)
```

`top` comes from the cached page offset minus the current scroll, not from a
fresh `getBoundingClientRect()`, so the per-frame path does no layout reads at
all. Measurement is confined to init, resize, a `ResizeObserver` on
`document.body`, `document.fonts.ready` and `window.load`.

The observer watches the body rather than the blocks because a block's *page
position* is changed by anything above it, not only by its own height — the same
reasoning as `bg-grid`.

Writes are skipped when `p` moves less than 0.0005, so a block parked outside
the range stops re-setting the same 0 every frame.

### The easing is the real curve, not an approximation

The keyframes carried `ease-in-out`, i.e. `cubic-bezier(0.42, 0, 0.58, 1)`,
applied to each keyframe interval. Chrome and Safari 26 have been running the
CSS version in production, so eyeballing the curve would have been a visible
regression for most of the traffic.

`easeInOut` therefore inverts the bezier's x component with Newton-Raphson and
reads off y. Worth knowing why a smoothstep will not do: the y component of
this curve *is* `3t² − 2t³` in the curve's own parameter, but the x mapping is
not the identity, so `smoothstep(x)` is a different function of progress.

Verified against an independent bisection solve of the same curve: max error
1.7e-5, about a thousandth of a pixel on the 64px vertical inset.

### Timing

Positions through the viewport, with an ease-in-out on each ramp:

| Position | State |
| --- | --- |
| 0–10 | nothing happens, the block is still arriving |
| 10–42 | grows out to full bleed |
| 42–58 | holds fully bled through the middle |
| 58–90 | shrinks back to a card |
| 90–100 | nothing happens, the block is leaving |

These are `growStart` / `growEnd` / `shrinkStart` / `shrinkEnd` in the module.
10 and 90 mirror, so moving them together keeps entry and exit symmetric.

**These are the values that shipped.** The embed's prose comment described
`20 / 42 / 58 / 80` and had drifted from its own keyframes, which were
`0–10 / 42–58 / 90–100`. The code was the source of truth, since that is what
was signed off visually; the comment has been corrected.

### Reduced motion

Skipped entirely rather than shortened, matching the CSS. The stylesheet keeps
its own `prefers-reduced-motion: no-preference` guard, so with nothing written
the pseudo-element is never created — this is a decorative reveal driven purely
by scrolling, exactly what the setting exists to turn off.

### Not coupled to smooth scroll

Reads `window.scrollY` and listens to the native `scroll` event rather than
calling `lenis.on('scroll')`. Lenis sets the genuine scroll position every
frame, so native scroll events fire and `window.scrollY` is accurate — which
means the effect behaves identically with smooth scroll on, off, or absent, and
the component carries no dependency on `global.js` having run first.

Scroll events are coalesced through one `requestAnimationFrame`, so several
events landing in a frame do one paint.

## Dependencies

None in the bundle. No stylesheet import — the rules live in the **"CUSTOM
STYLES" embed** inside the `Global / Styles` component on the Webflow canvas
(element `d59e009d-e031-8f66-15a2-1323f5cc88c6`), under
`LIGHT BLOCK SCROLL BLEED`.

They sit there so the resting card renders on the Designer canvas; CSS shipped
in `dist/styles.css` never does. `bg-grid`, `pillars` and `nav` split the same
way.

Note this embed is shared — it also holds the heading italic/highlight rules,
the marquee loop, the About eyebrow override and the arrow-on-hover block. It
is not the light block's own file, so edits need care.

## DOM Expectations

Elements matching `.light-block`. The CSS additionally expects an ancestor
`.section_light-block` to carry `position: relative; z-index: 1`, which is what
lets the growing surface spill over the next section rather than being painted
over by it.

Nothing is measured inside the block, and the block's children are never
touched — the growing surface is a `::before`, so the in-flow content cannot be
stretched or dragged by the reveal.
