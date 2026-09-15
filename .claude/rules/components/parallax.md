# parallax

## Purpose

Drifts a section's background image against the page as it scrolls, so the
image reads as sitting behind the content rather than pasted onto it.

One component for every such section. Adding it to a new section is Webflow
markup only — no JS change.

## Webflow Setup

Add `data-parallax="true"` to the section's `.section_bg-image-wrapper`.

That is the whole opt-in. **There is no false value** — presence is the switch,
so remove the attribute to turn it off. Same shape as `data-grid-interactive`
and `data-brackets`.

| Value | Effect |
| --- | --- |
| `"true"` | drift forward — the image lags the page, so it reads as sitting behind the content |
| `"reverse"` | drift the other way — the image leads the page |
| anything else | same as `"true"`; only `"reverse"` is special-cased |
| attribute absent | no parallax, and no parallax styling either |

### Reversing is CSS, and deliberately not JS

`data-parallax="reverse"` sets `--parallax-direction: -1`, which multiplies into
the translate. **`parallax.js` knows nothing about it** — there is no branch in
the bundle, and adding the option required no JS change at all.

That is the boundary being protected, not an implementation accident. Direction
is presentation, like travel and crop. Inverting inside the component would make
`--parallax-p` mean *the frame is entering* on some elements and *leaving* on
others, which breaks the one sentence that defines the property and would
mislead anything that later reads it. The scalar stays a statement about
geometry; what to do with it stays on the canvas.

`--parallax-direction` is the real mechanism and the attribute is a convenience
over it, which matters in one case: **an attribute cannot vary by breakpoint.**
For a section that should drift one way on desktop and the other on mobile,
leave the attribute at `"true"` and set the property inside a media query.

Only `1` and `-1` are intended. It multiplies rather than switching, so a
fractional value would also scale the motion — don't use it that way;
`--parallax-travel` is the magnitude knob.

Because the range is symmetric about the midpoint, reversing costs nothing:
both directions travel between the same two extremes, so the frame stays
covered and the image needs no extra height.

### It is set on the component definitions, not on page instances

Both current sections are their own Webflow Components, and the wrapper lives
inside each definition — so a page-level element query cannot see it, and the
attribute is written once per component rather than once per instance.

| Component | Id | Wrapper element |
| --- | --- | --- |
| `Section / Image Quote` | `eaf564e9-61e8-049d-d185-ab5f64d8a4f9` | `46f3fad7-4b00-ef65-4d27-4a61cc93ef4e` |
| `Section / Center Header / BG Image` | `66db5754-d9dd-4630-b619-2a9dc47a209e` | `66db5754-d9dd-4630-b619-2a9dc47a209f` |

The consequence worth knowing: **every instance of those two components now
parallaxes**, and a new instance gets it for free. The opt-in granularity is
therefore per *component*, not per placement. If one instance ever needs to sit
still, the answer is `--parallax-travel: 0rem` on that instance rather than
stripping the attribute, which would leave it styled-but-frozen — the exact
drift the shared selector exists to prevent.

The structure it expects is the one every bg-image section on this site now
shares:

```
.section_bg-image-wrapper     position: absolute; inset: 0; overflow: hidden
  .section_bg-image           object-fit: cover; width/height 100%
```

The enclosing section must be `position: relative`, or the wrapper's `inset: 0`
resolves against the wrong containing block. `.section_center-header` already
carried it; **`.section_image-quote` did not** and was given it as part of this
change — it had shipped with `background-color` and two paddings only, so its
absolutely positioned background had no positioned ancestor at all.

### Why an attribute, and why on the frame

**Why an attribute and not the class.** Every bg-image section shares
`.section_bg-image-wrapper`, but not every one should drift, and the travel is
not uniform. So the class cannot be the opt-in.

This is the `data-slider` / `data-play-on-scroll` case rather than the
`light-block` one: the attribute is both the opt-in and the selector — the
Parallax CSS embed keys its rules off `[data-parallax]` too, not off
`.section_bg-image`. A section is therefore either animated **and** styled for
it, or neither. That is the same no-drift property `light-block` gets from
sharing a class, obtained the other way round. See CONVENTIONS.md.

**Why on the frame rather than the image.** Custom properties inherit, so
publishing on the wrapper makes the value readable by anything inside it. The
frame is also the thing worth measuring — it is the window the image is seen
through, and its pass through the viewport is what the drift should track. The
element that actually moves is then the embed's business, not the JS's.

## The JS ↔ CSS contract

This component **writes** one property and reads none:

| Property | On | Meaning |
| --- | --- | --- |
| `--parallax-p` | `[data-parallax]` | `0` = frame's top edge at the viewport bottom, `1` = bottom edge past the top |

Neither `--parallax-travel` nor `--parallax-direction` is read by the JS, so
both the strength and the direction can be retuned per section and per
breakpoint on the canvas without touching the bundle. They are the only two
knobs, and `--parallax-p` is the only name shared with the bundle.

**The `var(--parallax-p, 0.5)` fallback is load-bearing.** Before the bundle
arrives — or if it never arrives, or under reduced motion — `p` resolves to
`0.5`, the translate resolves to `0`, and the image sits centred in its frame.
That is the resting state, and it is also what the Designer canvas renders.

`0.5` rather than `0` because the travel is symmetric: the image is oversized by
`--parallax-travel` and offset by half of it, so the midpoint is the state where
the frame is covered with equal slack top and bottom.

Since the stylesheet is outside version control, keep the property name in sync
by hand. `--parallax-p` is the only shared name — `--parallax-travel` and
`--parallax-direction` exist purely on the CSS side.

### The stylesheet

In the **"Parallax CSS" embed** inside the `Global / Styles` component
(element `194eb675-a27a-3a9e-eb2d-81bca994970e`, last item in
`styles_components-list`). Unlike the light block's rules it has an embed to
itself rather than sharing `CUSTOM STYLES`:

```css
[data-parallax] {
  --parallax-travel: 8rem;
}

[data-parallax] .section_bg-image {
  position: absolute;
  left: 0;
  width: 100%;
  height: calc(100% + var(--parallax-travel));
  top: calc(var(--parallax-travel) * -0.5);
  transform: translate3d(
    0,
    calc((var(--parallax-p, 0.5) - 0.5) * var(--parallax-travel)),
    0
  );
  will-change: transform;
}
```

**`position: absolute` is required, not decoration.** `.section_bg-image` is a
static-flow `img` at `height: 100%`; `top` does nothing to it until it is
positioned.

**`--parallax-travel` must be a length, never a percentage.** `translateY`
percentages resolve against the element's *own* height, which is now
`100% + travel` — so a percentage travel would come out scaled by that factor
and the arithmetic would silently stop matching the frame.

## Behavior

- **Init**: Caches each frame's page-relative `top` and `height`, paints once so
  a refresh partway down the page starts correct, then listens for scroll. All
  of it via `scroll-progress.js`.
- **Resize**: Re-measures. Load-bearing rather than an optimisation — viewport
  height is part of the progress calculation, and a height-only window resize
  does not change the body's box, so the `ResizeObserver` will not catch it.
- **Breakpoint**: Not used. The effect runs at every width; the travel is
  overridden per breakpoint in CSS.

### Linear, and clamped

`map` is `clamp(position, 0, 1)` — no easing.

`light-block` and `video-highlight` ease with a hold in the middle, which is
right for something that opens and closes. Parallax is a positional mapping:
easing it would make the image drift faster and slower under a steady scroll,
which reads as a stutter rather than as depth. Do not "make it consistent" with
the reveals.

The clamp is load-bearing rather than tidiness. `scroll-progress.js` hands over
an unclamped position, so outside the cover range an unclamped value would push
the image past its travel and expose the frame's edge.

### It cannot disturb the grid

The moving image is absolutely positioned inside an absolutely positioned
frame, so it cannot resize its containing block. That is the rule every caller
of `scroll-progress.js` has to satisfy — see that doc — and here it also means
`bg-grid`'s `ResizeObserver` never wakes.

### Reduced motion

Skipped entirely rather than shortened. Parallax is the archetype of the motion
the setting exists to turn off, and writing nothing leaves the embed's
`var(--parallax-p, 0.5)` fallback holding the image exactly at rest.

### An above-the-fold frame only uses half its travel

The About hero sits at the top of the page, so its position starts near `0.47`
and can never reach `0` — nothing above it can scroll it down to the bottom of
the viewport. It therefore only ever uses the upper half of the travel.

Not a defect, and not worth special-casing, but size `--parallax-travel` there
knowing it: the visible drift is roughly half what the same value gives a
mid-page section.

### The crop moves with the height

Both current frames use `object-position: 50% 100%`. Growing the image by
`--parallax-travel` and offsetting it re-centres what you see, so raising the
travel is a composition change as well as a motion one. Check the crop on the
About hero after any large change.

## Dependencies

- `./scroll-progress.js` — the whole of the measurement and scheduling.
- No stylesheet import. The rules live in the **"Parallax CSS" embed** inside
  the `Global / Styles` component on the Webflow canvas (element
  `194eb675-a27a-3a9e-eb2d-81bca994970e`), so the resting image
  renders on the Designer canvas; CSS shipped in `dist/styles.css` never does.
  `bg-grid`, `pillars`, `nav`, `light-block` and `video-highlight` all split the
  same way.

## DOM Expectations

Elements matching `[data-parallax]` — in practice `.section_bg-image-wrapper`,
which must be `position: absolute; inset: 0; overflow: hidden` and must contain
a `.section_bg-image`. The enclosing section must be `position: relative`.

Currently one instance each on Home (`.section_image-quote`) and About
(`.section_center-header.is-image`), but nothing is per-page or per-section.

### Known cost: the quote card's backdrop filter

`.image-quote_text` on the home page carries
`backdrop-filter: blur(5.625rem)` and sits directly over the moving image. A
backdrop filter re-samples whenever its backdrop changes, so that blur now runs
on scroll rather than once.

This site already has one recorded performance bug of exactly this shape — four
`filter: blur()` blobs made the nav untappable on mobile, see `nav.md`. Measure
on a real device before assuming it is fine; the cheap outs are a smaller radius
or dropping the parallax below 992px by setting `--parallax-travel: 0rem`.
