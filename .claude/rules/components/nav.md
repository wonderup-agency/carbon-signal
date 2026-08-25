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

## DOM Expectations

Elements matching `[data-component='nav']`. The CSS additionally expects
`.nav_bg` inside, and optionally any `[data-scroll-fade='in']` descendants.
