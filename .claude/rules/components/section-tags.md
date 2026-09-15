# section-tags

## Purpose

Publishes two states the row's stylesheet cannot derive on its own: which step
currently covers the middle of the viewport, so the tag pointing at it can show
its dot, and whether the row has pinned under the nav, so the flanking hairlines
can retract. Two `IntersectionObserver`s per row; no measurement, no scroll
listener.

The **row** it runs on is shared markup rather than anything this component
owns — see below. This component only supplies the active state.

## The row is the resources filter row, generalised

`.section-tags_layout` / `_item` / `_pill` / `_wrapper` / `_list` were
`.resources-filter_*` until the homepage needed the same pills. They were
renamed rather than copied: same design, same padding, same border, one set of
rules. The names are generic so a third section can use them without inheriting
resources vocabulary.

What stayed behind on resources is only what is genuinely page-specific —
`.section-tags_pill.is-filter-active` (written by fs-list) and the resource-card
hover. `.resources-filter_component`, the `w-form` shell, kept its name because
it really is the form, not the row.

### Two rows, two unrelated notions of "active"

| Row | Active means | Written by | Looks like |
| --- | --- | --- | --- |
| Resources filters | this filter is on | fs-list, via `fs-list-activeclass` | `.is-filter-active` — filled black pill |
| Homepage steps | this is the step you are in | `section-tags.js` | `data-section-tag-active` — teal dot |

They are named apart on purpose, and the dot rule is scoped to
`[data-section-tags]` so it can never appear on the filter row. Do not try to
merge them: one is a click-driven toggle, the other a scroll-derived position.

### Why the dot cannot be CSS or a Webflow current state

The three obvious approaches all fail, recorded so none gets tried again:

- **Webflow's `w--current`** is assigned by **URL match**, not scroll position.
  On a `#hash` link it only lights when the address bar carries that hash — so
  click Engineers, scroll two screens to Executives, and it still says
  Engineers.
- **Worse, it would never fire at all here.** `smooth-scroll.js` delegates
  `a[href^="#"]`, calls `preventDefault()` and hands off to `lenis.scrollTo()`
  without writing the hash, so the URL never changes.
- **`:target`** fails from the other side: the tag is neither a descendant nor a
  sibling of the step it points at, and CSS cannot select upward or across.

### Why no click handler

`smooth-scroll.js` already owns `a[href^="#"]` site-wide and routes it through
Lenis. A second listener here would duplicate that or fight it. Under reduced
motion that delegate is never registered and the browser's native hash jump
takes over, which is equally correct — so clicking works with the bundle, with
smooth scroll off, and with no JS at all.

## Webflow Setup

No `data-component` attribute. Triggered by `data-section-tags` on the row, same
reasoning as `bg-grid` and `slider` — and here it carries a second meaning: it
is what separates a JS-driven row from a plain one. The resources row does not
have it, and must not get it.

```
[data-section-tags]  .section-tags_layout.is-steps     the row
  .section-tags_item                                    separator carrier
    a.section-tags_pill.is-filled     href="#..."       the pill and the link
      div[data-text-size="eyebrow"]                     the label
  .section-tags_item   ...
```

The href is the whole contract — there is no second attribute naming the
target, which could drift from the link the user actually follows. Set it in
the Designer as a **Section** link; Webflow compiles it to `#id`.

The pill **is** the anchor, not a wrapper around one. That mirrors the resources
row's static Documentation pill, which is also `a.section-tags_pill`, and it
means there is no extra element between the class and the thing you click.

### The two homepage-only combos

The base classes stay neutral so the resources row keeps working; everything the
step nav needs sits on combos:

| Combo | On | Carries |
| --- | --- | --- |
| `is-steps` | `.section-tags_layout` | `position: sticky`, `top: var(--_components---nav--height)`, `z-index: 2`, canvas background, 1rem block padding, and `display: none` from `medium` down |
| `is-filled` | `.section-tags_pill` | white background |

**`is-steps` is why the dot is worth having at all.** Without sticky the row
scrolls out of view before step 2 is active and the indicator is never seen. The
background and padding go with the sticky rather than being separate decisions:
the steps scroll underneath, so a transparent row would show text sliding
through the flanking hairlines.

`is-filled` is a combo rather than a base change because the resources pills sit
on their own section colour and do not want it.

#### The row must carry no bottom margin

A sticky element's pin range is its containing block's content box **inset by
its own margins**. The row's containing block is `.container-large`, whose
bottom edge is exactly where `.light-block`'s 7rem bottom padding begins — so a
`margin-bottom` on `is-steps` is subtracted straight off the end of the pin, and
the row releases that much early over the last step.

It used to carry `margin-bottom: var(--_spacers---96)`, which cost 6rem of pin.
That gap now lives on `.light-block_scroll_item-layout` as `margin-top`
instead: the spacing below the row is identical, and the pin runs to the full
height of the content box. Put spacing below this row on the next element, never
on the row.

**Caution when editing this combo over MCP:** `update_style` with
`remove_properties` dropped `background-color` along with the named property,
silently. Read the style back after any removal.

### Why the row is desktop-only

`display: none` from `medium` (≤991px) down on `is-steps`, because the thing it
points at does not exist there: the section swaps
`.light-block_scroll_item-layout` (three 100vh steps, desktop) for
`.light-block_item-layout.is-bigger-possibilities` (a plain stacked list, tablet
down). Two parallel DOM trees, and an id can only live on one.

Load-bearing, not a preference. It is also free on the JS side: hidden targets
have no box, so nothing intersects and the observer idles without a `matchMedia`
guard. The hide sits on the **combo**, not the base class — the resources row
stacks below 992px rather than disappearing.

### The anchor targets

Each step wrapper carries `data-section-step` (what the observer tracks) and
contains an `.anchor-scroll` marker carrying the id (what the links point at):

| Step | marker id |
| --- | --- |
| `.light-block_scroll_item-wrapper.is-1` | `possibilities-engineers` |
| `.light-block_scroll_item-wrapper.is-2` | `possibilities-strategy` |
| `.light-block_scroll_item-wrapper.is-3` | `possibilities-executives` |

See the landing-offset section below for why those are two different elements.

The ids live inside a component definition with exactly **one** instance. If
`Section / Light Block / Steps 1` is ever placed a second time the page gets
duplicate ids and every tag links to the first. Give the second instance its own
ids, or bind them to props, before doing that.

Labels are props on that component (`Item 1/2/3 → Tag - Text`) so they stay
editable in Build Mode.

## The JS ↔ CSS contract

This component **writes** two attributes and reads one property:

| Attribute | On | Meaning |
| --- | --- | --- |
| `data-section-tag-active` | each `.section-tags_pill` in the row | `"true"` on the step crossing the viewport midline, `"false"` on the rest |
| `data-section-tags-stuck` | the row | `"true"` once the row has pinned under the nav |

It also writes `aria-current="location"` on the active pill and removes it from
the others — the standard token for "current location within a page".

The property it reads is the row's own computed `top`, to know where "pinned"
is. That is deliberate: move the sticky offset in the Webflow panel and the
trigger moves with it, with nothing to keep in sync.

Since the stylesheet is outside version control, keep the attribute name in sync
by hand. It is the only shared name.

**Nothing breaks without the bundle.** Neither attribute is written, every dot
stays hidden, the hairlines stay extended, and the row is still a working set of
anchor links — Webflow's own anchor scroller takes over the jump, and the
`.anchor-scroll` markers plus `scroll-padding-top` still land it correctly.

### The dot is a pseudo, and it collapses at rest

`[data-section-tags] .section-tags_pill::before` — markup-free, because it is
purely a state. At rest it is zero width with zero margin, so an inactive pill
carries no dot space. That is the design.

It was briefly built the other way, reserving the space on every pill, on the
worry that a dot entering the flow would shove the row sideways on every step
change. That worry does not survive the arithmetic: **exactly one pill carries
the dot at a time**, so the width one gains is the width another loses, the
row's total width is conserved, and only the pills *between* the old and new
active one move at all. Width and margin transition alongside opacity, which is
why this is not `display: none` — display cannot be transitioned, and the
movement reads as the dot growing rather than as a jump.

The one moment the row is genuinely narrower is between paint and the first
observer callback, and `observe()` reports initial state synchronously enough
that it is not visible.

The halo matches `.cs-dot_wrapper` in the `Text / Tag` component, which is the
same dot drawn in markup elsewhere on the site. `Text / Tag` itself is **not**
used here — its vertical padding is larger than the filter pill's, and matching
the filter pill was the point.

### The landing offset, and the two elements it splits apart

Jumping to a step puts its top at the viewport top — underneath both the nav and
this row once pinned, so the heading you asked for is the one thing you cannot
read.

That is solved on the canvas, not here. Each step carries an **`.anchor-scroll`
marker**: a zero-height div with a negative top margin
(`calc(-1 * var(--_components---nav--height) * 2)`), and the tags link to *that*
rather than to the step. `html { scroll-padding-top: 5rem }` in CORE STYLES
clears the fixed navbar for every anchor on the site, and the two compose, so
the marker only has to account for this row.

**So the link target and the observed element are two different elements**, and
that split is the whole of what makes this work:

| | Element | Why |
| --- | --- | --- |
| Scrolled to | `.anchor-scroll` (`#possibilities-*`) | zero height and negatively offset, so the landing point can sit anywhere without disturbing the step's box |
| Observed | `[data-section-step]` — the 100vh wrappers | has a real box, and the wrappers tile the section contiguously, so the handover at each boundary is clean |

`section-tags.js` climbs from the link's target to
`closest('[data-section-step]')`, falling back to the target itself.

**Do not point the observer at the marker.** A zero-height box is exactly what
the midline observer cannot see — its root region is a zero-height line, and two
zero-height rects essentially never report as intersecting, so every step reads
as inactive and no dot ever lights. That is a silent failure, not an error, and
it is how the dot broke when the markers were introduced.

A `.light-block_scroll_item-wrapper { scroll-margin-top }` rule used to do this
job, from when the tags linked to the wrappers directly. It has been removed
rather than left inert — the wrappers are no longer scroll targets, so it did
nothing except invite someone to tune the wrong number.

**Lenis already honours `scroll-margin-top` and `scroll-padding-top`** and
subtracts both before it scrolls — read `scrollTo()` in `lenis/dist/lenis.mjs`.
A version shipped briefly that *also* passed `scroll-margin-top` to `scrollTo()`
as an `offset`, which double-counted it. Do not reintroduce that.

### The hairlines retract when the row pins

Once `data-section-tags-stuck` flips, both flanking rules collapse to nothing
over 0.4s, each **toward the pills** — the left line's origin is its right end,
the right line's is its left end. The outer tips travel inward and the lines
retract into the row. Scrolling back up past the pin point extends them out
again.

Those two origins are the whole of the effect's direction, and swapping them
reverses it — lines drawn off to the screen edges instead. That was the first
version and reads quite differently, so treat the pair as deliberate rather
than arbitrary.

**`transform: scaleX()`, not `width`.** The hairlines are `flex: 1 1 0`
children, so animating their size would hand the freed space straight to the
pills and let the row's content drift while the lines shrank. A scale changes no
layout at all, so the pills stay exactly where they are.

**Why a sentinel.** `position: sticky` exposes no state and fires no event. The
tidier-looking alternative — observing the row itself with a negative root
margin — puts the row's top edge exactly on that margin while stuck, so the
ratio sits on the boundary and subpixel rounding flickers it between states.
With a 0.4s transition attached, that flicker is visible. A zero-height marker
sitting where the row *would* be in flow crosses the line once, cleanly.

The sentinel is created in JS rather than authored on the canvas: it is an
implementation detail with nothing to see and nothing to configure, and on the
canvas it would read as a stray empty div and eventually be tidied away.

## Behavior

- **Init**: Per row, starts the sticky-state watch (above), then resolves each
  `a[href^="#"]` to its target and observes those targets with
  `rootMargin: '-50% 0px -50% 0px'`. Rows resolving fewer than two targets are
  skipped for the active state, but still get the sticky watch. `observe()`
  reports initial state on both, so a refresh partway down the page paints
  correctly with no separate first pass.
- **Resize**: Not used. `IntersectionObserver` re-evaluates against the current
  viewport on its own, and the root margin is a percentage.
- **Breakpoint**: Not used. The effect idles below 992px because its targets are
  hidden, not because it checks.

### Only entering counts

The callback acts on `isIntersecting` entries and ignores exits. Leaving the
midline means another step is taking it, and that step's own entry does the
work — clearing on exit would blank the row for a frame at every boundary. It
also leaves the last step lit once the section has scrolled past, which is the
honest reading: that is still the step you came out of.

### Reduced motion

Not skipped. Both states are information rather than decoration — which step
you are in, and whether the row has pinned — and neither is what the setting
exists to remove. The stylesheet drops only the *transitions* under
`prefers-reduced-motion`: the dot appears and the hairlines retract instantly
rather than animating.

## Dependencies

None in the bundle. The rules live in the **"Section Tags CSS" embed** inside
the `Global / Styles` component on the Webflow canvas (element
`6d3df546-51fe-2b4a-1df8-579626858456`).

They sit there so the row renders on the Designer canvas; CSS shipped in
`dist/styles.css` never does. `bg-grid`, `pillars`, `nav`, `light-block`,
`video-highlight` and `parallax` all split the same way.

The embed carries three things: the `+` separator (an adjacent-sibling
combinator, which the panel's pseudo-states cannot express, plus its
landscape-down hide), the retracting hairlines, and the active dot. Everything
else — the row's centring,
the flanking hairlines as `::before`/`::after`, the pill's border, colour,
transition, `:hover` and `:focus-within`, and both combos — is **on the Webflow
classes**. Edit those in the panel.

The resources-specific leftovers stay in the **Resources embed** (element
`71ac5077-0204-2e1a-0c87-605cbdd3a291`).

## DOM Expectations

Rows matching `[data-section-tags]`, containing at least two `a[href^="#"]`
descendants whose hrefs resolve to elements on the page. Nothing inside the link
is read — the label and the dot are the stylesheet's concern alone.
