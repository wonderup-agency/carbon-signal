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

`./styles/nav.css` — the scrolled-state rules. Both rules push toward
`opacity: 1` only, so each element keeps whatever resting value its own Webflow
variant defines.

## DOM Expectations

Elements matching `[data-component='nav']`. The CSS additionally expects
`.nav_bg` inside, and optionally any `[data-scroll-fade='in']` descendants.
