# smooth-scroll

## Purpose

Site-wide smooth scrolling, wrapping [Lenis](https://lenis.darkroom.engineering/).

## Not a registered component

It has no markup to match a selector against and applies to every page, so
`global.js` imports and calls it directly rather than `components.js` matching it
on a selector. It lives in `src/components/` because that is where browser
modules go, not because it participates in the registry.

The cost of that: it ships in the **global chunk**, which loads on every page —
roughly **5.5KB gzipped**, plus ~130 bytes for Lenis's own CSS in
`dist/styles.css`. Everything else heavy in this project (Swiper) is code-split
behind a selector; this one is not, because it has no selector.

## Why Lenis and not a transformed wrapper

Older smooth-scroll libraries fake it: the page sits in a wrapper that gets
translated while the document never actually scrolls. That breaks a lot of the
platform quietly — `position: sticky`, `IntersectionObserver`, scroll anchoring,
and CSS scroll-driven animations all read the real scroll position and find it
frozen at zero.

Lenis intercepts the wheel event, eases toward a target, and sets the genuine
scroll position each frame, so everything native keeps working. That matters
concretely here:

- `.light-block_scroll_rive` is `position: sticky`
- the light-block bleed in the **CUSTOM STYLES** embed runs on a `view()` timeline
- `nav` reads `window.scrollY` on every scroll event
- `bg-grid` phases rows from `getBoundingClientRect().top + window.scrollY`

A wrapper-based library would have broken all four.

## Behavior

- **Init**: Called from `global.js`. Starts a `requestAnimationFrame` loop
  driving `lenis.raf(time)`.
- **Reduced motion**: Skipped entirely rather than shortened — smooth scroll is
  exactly the motion the setting exists to turn off, and an instance with the
  easing removed still intercepts the wheel for no benefit. Returns `null`.
- **Touch**: `syncTouch` is off on purpose. Mobile momentum scrolling is already
  tuned by the OS; hijacking it tends to feel worse and costs battery. Wheel and
  keyboard get the easing, fingers get native behaviour.

### Hash links

Webflow writes plain `#hash` hrefs for section links and relies on the browser to
jump. Lenis owns the scroll position, so a native jump would fight it and land in
the wrong place. A delegated `click` listener on `document` intercepts
`a[href^="#"]` and routes it through `lenis.scrollTo()`, so CMS and component
links added later are covered without re-binding.

`data-lenis-prevent` on a link opts it back out to native behaviour.

## Controlling it

`getLenis()` returns the instance, or `null` under reduced motion. For anything
that needs to freeze the page behind it — a modal, a mobile nav:

```js
import { getLenis } from './smooth-scroll.js'
getLenis()?.stop() // on open
getLenis()?.start() // on close
```

The optional call matters: under reduced motion there is no instance.

## Dependencies

- `lenis` (npm, runtime dependency) — bundled into the global chunk.
- `lenis/dist/lenis.css` — the library's own structural CSS. In the bundle rather
  than a Webflow embed for the same reason as `swiper/css`: it has to ship and
  version with the JS that depends on it (see CONVENTIONS.md).

## DOM Expectations

None. It attaches to the document and the window.
