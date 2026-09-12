# nav

## Purpose

Tracks page scroll and flags the navbar once past a threshold, so the nav
background and any fade-in children can switch to their scrolled appearance.

## Webflow Setup

Add to any element in Webflow:

data-component="nav"

Place it on `.nav_component`.

## Behavior

- **Init**: Sets `data-scrolled="true"|"false"` on every matched nav, once
  immediately (so a refresh partway down the page starts correct) and again on
  every scroll event. Threshold is 100px.
- **Resize**: Not used
- **Breakpoint**: Not used

## Dependencies

None in the bundle. The scrolled-state rules live in the **"Nav CSS" embed**
inside the `Global / Styles` component on the Webflow canvas
(element `db5a13b0-1a41-4a16-77a8-74f023994a02`, under the `Nav` wrapper).

Both rules push toward `opacity: 1` only, so each element keeps whatever resting
value its own Webflow variant defines.

The contract with this component is the single attribute `data-scrolled`, which
the JS writes and the CSS reads. Since that CSS is outside version control, keep
the attribute name in sync by hand.

### `.nav_component` needs an explicit `z-index`, and it is load-bearing

A Designer-class property rather than an embed one, so it is easy to lose to a
"tidy up" pass: **`.nav_component` must carry `z-index: 100`.**

`position: fixed` makes it a stacking context but does not lift it out of the
`z-index: auto` paint group, so *any* page content with `z-index: 1` or higher
paints over it — and hit testing follows paint order, so those boxes swallow the
taps. It shipped without one, and the symptom was the nav going dead at the top
of `/technology`, `/about` and `/connect`: the hamburger sat under
`.center-section_gradients-wrapper` (`z-index: 1`, `inset: 0%`, covering the
whole hero including the strip behind the nav bar), and the open mobile menu sat
under the hero's `.padding-global.z-index-2`. Scrolling past the hero moved both
boxes off the nav's rectangle and everything started working again, which is
what made it look like a performance problem rather than a stacking one.

Two consequences worth holding on to:

- **The children ride along.** `.nav_menu` is `position: absolute` inside the
  nav and `.nav_dropdown_panel` is `z-index: 1` inside it — both are capped by
  the nav's own stacking context, so raising the nav is the whole fix. Raising
  them individually would not have worked.
- **`.center-section_gradients-wrapper` also carries `pointer-events: none`**
  for the same bug. Its decorative blob children (`.center-section_blur-gradient`,
  `.center-section_blur-dark-gradient`) always had it; the wrapper did not, so
  it ate taps across the entire hero. Both halves are needed — the wrapper is
  the only reason the *closed* nav was unreachable.

## DOM Expectations

Elements matching `[data-component='nav']`. The CSS additionally expects
`.nav_bg` inside, and optionally any `[data-scroll-fade='in']` descendants.
