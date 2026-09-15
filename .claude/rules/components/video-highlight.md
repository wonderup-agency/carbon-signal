# video-highlight

## Purpose

Drives the Technology video card's scroll bleed. The card rests as a 3-by-3
grid-snapped square holding a muted background video, and the video grows out
of that frame to a full-bleed 16:9 band as the card passes through the middle
of the viewport, then settles back.

Clicking it opens the Webflow lightbox, which is unchanged — this component
never touches the lightbox behaviour, only its size.

## Webflow Setup

`data-component="video-highlight"` on `.video-highlight_block`, inside the
`Section / Video Highlight` component.

### Why this one takes an attribute when light-block does not

`light-block` registers on its class because its blocks are hand-placed and a
forgotten attribute would leave one styled but never animated. That argument
does not apply here: the card lives inside a Webflow Component, so the
attribute and the class it is styled by are part of the same definition and
travel to every instance together. The conventional `data-component` is
therefore the right default — see CONVENTIONS.md.

## The JS ↔ CSS contract

This component **writes** one property and reads none:

| Property | On | Meaning |
| --- | --- | --- |
| `--video-bleed-p` | `.video-highlight_block` | reveal progress, `0` = resting card, `1` = full bleed |

Everything else stays in the embed. `--video-bleed-cols`, `--video-bleed-rows`,
`--video-bleed-w` and `--video-bleed-h` are never read by the JS, so the
geometry can be retuned per breakpoint on the canvas without touching the
bundle. The two to reach for are `--video-bleed-cols` and `--video-bleed-rows`,
which set the grown size in whole grid cells — subject to the parity rules
below.

The embed also **reads** `--cell` from the enclosing `[data-grid]` section, so
the grown size tracks the grid rather than restating it.

`p` scales both insets together via `calc(p * (100% - target) / 2)`. That is why
the rest state is exact: there is no second set of "closed" numbers that could
drift from the open ones.

**The `var(--video-bleed-p, 0)` fallback is load-bearing.** Before the bundle
arrives — or if it never arrives — `p` resolves to 0, every inset collapses to
0, and the lightbox lands precisely on the block's padding box. That is the
resting card, and it is also what the Designer canvas renders.

Since the stylesheet is outside version control, keep the property name in sync
by hand. It is the only shared name.

## Behavior

- **Init**: Caches each card's page-relative `top` and `height`, paints once so
  a refresh partway down the page starts correct, then listens for scroll. All
  of it via `scroll-progress.js`.
- **Resize**: Re-measures. Load-bearing rather than an optimisation — viewport
  height is part of the progress calculation, and a height-only window resize
  does not change the body's box, so the `ResizeObserver` will not catch it.
- **Breakpoint**: Not used. The effect runs at every width.

### Which element is which

The two elements have swapped roles from how the section was originally built,
and that split is the whole design:

| Element | Role |
| --- | --- |
| `.video-highlight_block` | a **bare 3-by-3 anchor**. No border, no padding, no brackets — only `data-grid-snap`, which sizes it, and `position: relative`, which makes it the reference the growth is measured from. It must never change size. |
| `.video-highlight_lightbox` | the **visible box**. Carries the dashed frame, the padding, the backdrop blur and `data-brackets`, and it is what actually grows. |

The frame properties and the `data-brackets` attribute were moved off the block
onto the lightbox as part of this. Editing the card's appearance now means
selecting the lightbox, not the block.

**Why the growing box has to be out of flow.** The anchor's box *is* the grid
geometry — `[data-grid-snap]` sizes it at `--cell × --snap-cols` by
`--cell × --snap-rows` — and `bg-grid` derives every section's row phase from
section heights, watching `document.body` with a `ResizeObserver`.

If the growing box were in flow, the section would get taller on every scroll
frame: the page below it would visibly shift as you scrolled, and that observer
would re-run `growCards()`, `phaseRows()` and the interactive canvas rebuild
continuously — a page-wide relayout per frame to move one card. An absolutely
positioned element cannot resize its containing block, so the anchor never moves
and none of that fires.

**Why the lightbox and not an inner element.** Two reasons. It is the click
trigger, so the thing that opens the video and the thing that visibly bleeds are
one element and cannot drift apart. And the padding rides on the growing box, so
the video stays inset by it at every size, with the value held once in the
Webflow panel rather than copied into the embed.

### `max-width: none` on the lightbox is not optional

Webflow puts `max-width: 100%` on `w-inline-block`, which every lightbox link
carries. That one declaration breaks the entire effect.

With the width clamped, `left` and `right` are over-constrained, so the browser
drops `right` and honours `left` alone — and since `left` is negative, the box
**slides sideways at constant size instead of growing**. The symptom is a video
drifting off to the left, out of its frame, while the frame sits empty.

The embed overrides it. Do not remove that line, and expect the same trap on any
other effect that grows a Webflow link element with insets.

### Progress and timing live in the driver

The cover-range maths, the cached measurement and the rAF-coalesced scroll loop
are all in `scroll-progress.js` — see `components/scroll-progress.md`.

The curve is `revealProgress`, the *same function* `light-block` uses rather
than a second copy of the same numbers. That is the point of holding it there: a
second reveal on the same site easing on a different schedule would read as a
bug rather than as a variation, and now it cannot happen. Moving the timing
moves both.

| Position | State |
| --- | --- |
| 0–10 | nothing happens, the card is still arriving |
| 10–42 | the video grows out to full bleed |
| 42–58 | holds fully bled through the middle |
| 58–90 | settles back into the frame |
| 90–100 | nothing happens, the card is leaving |

### The grown size is measured in grid cells, so it snaps too

`--video-bleed-w` and `--video-bleed-h` are `--cell` multiplied by
`--video-bleed-cols` / `--video-bleed-rows`. Both the resting box and the grown
box therefore land on grid lines.

**Two rules govern every span, and breaking either puts the box half a cell off
its lines — instantly visible against the lattice:**

1. **The span must be odd.** The box is centred and both grids run at
   `--grid-phase: 0px`, which puts the centre mid-cell, so only odd spans land
   on lines. This is the PARITY rule in the BG Grid embed.
2. **The span minus the anchor's span must be even.** Growth is symmetric, so
   each side gains `(target − 3) / 2` cells, which has to be a whole number.
   With an anchor of 3 the first rule already implies this — but this is the
   rule that actually matters if the anchor's `data-cols`/`data-rows` changes.

Usable values are **3, 5, 7, 9, 11**. Never 4, 6, 8 or 10. A span equal to the
anchor's 3 is how you switch an axis **off**: the inset arithmetic resolves to 0
and the box does not move on it.

| Breakpoint | `--grid-divisor` | cols × rows |
| --- | --- | --- |
| ≥ 1360px | 9 | 11 × 5 |
| 992–1359px | 9 | 9 × 5 |
| ≤ 991px | 7 | 7 × 3 — wide only |
| ≤ 767px | 5 | 5 × 3 — wide only |
| ≤ 479px | 3 | 3 × 3 — inert |

**From tablet down the box grows wide only.** The row span drops to the anchor's
own 3 at 991px and stays there, so every narrow breakpoint widens without
getting taller. Vertical space is the scarce one on a short landscape viewport,
and a box growing on both axes there would eat the screen rather than read as a
reveal. Because `max-width` queries stack, the 991px rule is the only place rows
are set below desktop — the 767px and 479px rules move columns alone.

**Why the column count steps down.** The cell is `--grid-width / --grid-divisor`
and `--grid-width` caps at the `66.25rem` container, so on a wide screen 11
cells is a fixed 1296px and only fits from about 1360px of viewport up. The
divisor also drops at each Webflow breakpoint (9 → 7 → 5 → 3), so the cell gets
bigger as the screen gets smaller and a given span grows in real terms twice
over.

Below 992px the container is the viewport minus the global padding, so the full
divisor span lands exactly on the container edges. That is the widest value that
fits, which is why each step uses it.

At 479px and below the anchor is **already** the full 3-cell container width, so
there is nowhere to grow on either axis: both spans equal the anchor's and every
inset stays 0. The reveal is inert there by arithmetic, not by a special case.

**The scrollbar problem went away with `100vw`.** An earlier version targeted
`100vw` and had to carry a gutter, because `100vw` includes the scrollbar and a
box at exactly that width overflowed the visible area by ~15px and got cropped
by the section's `overflow: hidden`. `--cell` derives from `100cqi`, which
excludes the scrollbar, so the gutter — along with the aspect token and the two
`max`/`min` bounds that guarded the viewport-relative height — is gone.

**Vertical fit.** At desktop, 5 rows is 589px against a 353px anchor, so the
overhang is 118px a side against the section's 17.25rem (276px)
`section-statement` padding. Comfortable. Going to 7 rows would be 825px, an
overhang of 236px — still inside, but close enough that it is worth re-checking
against the section padding rather than assuming.

### Reduced motion

The reveal is skipped entirely rather than shortened — writing nothing leaves
the embed's `var(--video-bleed-p, 0)` fallback holding the card exactly at rest.

The looping background video is **also stopped**, which is a deliberate
departure from `rive-scroll`. It is the other half of the motion the setting
exists to turn off, and unlike a Rive element there is no risk of reading as a
broken canvas: a paused `video` still paints its first frame, so the card simply
looks like a still. The lightbox still opens the full video on click, which is
the deliberate way in.

**Not covered:** with reduced motion _off_, the background video autoplays and
loops with no pause control, which WCAG 2.2.2 asks for on auto-playing motion
longer than five seconds. Adding one is a design change, not a code fix.

### Not coupled to smooth scroll

Inherited from `scroll-progress.js`, same as `light-block`. See that doc.

## Dependencies

- `./scroll-progress.js` — the whole of the measurement, scheduling and easing.

No stylesheet import — the rules live in the **"Video
Highlight CSS" embed** inside the `Global / Styles` component on the Webflow
canvas (element `d352dd95-91dd-2847-15a0-79b9c5a5ad0f`).

They sit there so the resting card renders on the Designer canvas; CSS shipped
in `dist/styles.css` never does. `bg-grid`, `pillars`, `nav` and `light-block`
split the same way. Unlike the light block's rules, these have an embed to
themselves rather than sharing the `CUSTOM STYLES` one.

## DOM Expectations

Elements matching `[data-component='video-highlight']` — in practice
`.video-highlight_block`, which must also carry `data-grid-snap` and sit inside
a `[data-grid]` section, and must contain the `.video-highlight_lightbox`
element. Nothing inside the lightbox is measured.

The block must keep `position: relative`: it is the containing block the
lightbox's insets resolve against, so without it the frame would grow relative
to some ancestor further up and land nowhere near the card.

The background video comes from an `Element / Video` component instance inside
the lightbox — a native `video` element with `autoplay`, `loop`, `muted` and
`playsinline`, its `src` on the instance's **Url** prop. `playsinline` was added
to that component's definition because without it iOS Safari refuses to play a
video inline and takes it fullscreen instead.

### Two existing markup bugs fixed alongside this

- `data-grow` was on the block. The BG Grid embed's own docs forbid it on a
  fixed-aspect element — `growCards()` was writing `--snap-rows: 4`, so the
  "square" was 3 cells wide by 4 tall. Removed.
- `.video-highlight_block` carried `max-width: 22.1875rem`, the 3-cell width
  hardcoded. Below 992px the grid divisor drops to 7 and the cell grows, so that
  cap pulled the block off its own grid lines. Removed; `[data-grid-snap]` is
  what sizes it.

The block also lost `display: flex` and its centring properties, which only
existed to position the lightbox. The lightbox is absolutely positioned now, so
they had nothing left to do.
