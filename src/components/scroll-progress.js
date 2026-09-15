/*
Module: scroll-progress
Not registered in components.js — it has no markup of its own. Imported by the
components that need a scroll-driven scalar.

WHAT THIS IS
The measurement and scheduling half of light-block, video-highlight and
parallax, which were three copies of the same twenty lines. Each component
supplies the two things that actually differ: the custom property it publishes
and the function mapping viewport position to a value.

WHY IT IS A DRIVER AND NOT A COMPONENT
Everything here is about *when* to compute and *what geometry to compute from*.
Nothing here decides how anything looks — that still lives in a Webflow canvas
embed, composed from the published property. See CONVENTIONS.md.

NOT COUPLED TO LENIS
Reads window.scrollY and listens to the native scroll event rather than
lenis.on('scroll'). Lenis sets the genuine scroll position every frame, so
native scroll events fire and window.scrollY is accurate — every effect built
on this behaves identically with smooth scroll on, off, or absent.
*/

// A block parked outside its range would otherwise re-set the same value every
// frame. Small enough that no curve visibly steps.
const defaultEpsilon = 0.0005

/**
 * Publishes a scalar custom property on each element, derived from how far it
 * has travelled through the viewport.
 *
 * @param {HTMLElement[]} elements - the elements to track and write to
 * @param {object} options
 * @param {string} options.property - custom property name, e.g. '--light-bleed-p'
 * @param {(position: number) => number} options.map - viewport position -> value
 * @param {number} [options.epsilon] - skip writes smaller than this
 * @returns {{ resize: () => void }} lifecycle hooks for main.js
 */
export function trackScrollProgress(
  elements,
  { property, map, epsilon = defaultEpsilon }
) {
  /*
  Page-relative geometry is cached so the per-frame path does no layout reads.
  Only each element's own box is needed — everything about how far the effect
  travels is a length on the canvas, which the CSS resolves itself.
  */
  const tracked = elements.map((el) => ({ el, top: 0, height: 0, last: null }))

  let frame = null

  function measure() {
    tracked.forEach((item) => {
      const rect = item.el.getBoundingClientRect()
      item.top = rect.top + window.scrollY
      item.height = rect.height
    })
  }

  function paint() {
    frame = null

    const viewport = window.innerHeight
    const scrolled = window.scrollY

    tracked.forEach((item) => {
      /*
      The cover range of a view() timeline: 0 when the element's top edge is at
      the bottom of the viewport, 1 once its bottom edge has passed the top.
      */
      const top = item.top - scrolled
      const span = viewport + item.height
      const position = span > 0 ? (viewport - top) / span : 0

      const value = map(position)

      if (item.last !== null && Math.abs(value - item.last) < epsilon) return

      item.last = value
      item.el.style.setProperty(property, value.toFixed(4))
    })
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(paint)
  }

  function remeasure() {
    measure()
    schedule()
  }

  measure()
  paint()

  window.addEventListener('scroll', schedule, { passive: true })

  /*
  A ResizeObserver on the body rather than on the elements themselves: an
  element's own height matters, but so does its page position, which anything
  above it can change. Same reasoning as bg-grid.

  Every effect built on this must move something that cannot resize its own
  containing block, or this observer and the effect feed each other. In
  practice that means an absolutely positioned target — see video-highlight.md.
  */
  const observer = new ResizeObserver(remeasure)
  observer.observe(document.body)

  // Late-landing fonts and images reflow the element and everything above it.
  if (document.fonts) document.fonts.ready.then(remeasure)
  window.addEventListener('load', remeasure)

  return {
    // Viewport height is part of the progress calculation, and a height-only
    // window resize does not change the body's box, so the ResizeObserver
    // above will not always catch it.
    resize: remeasure,
  }
}

/*
The reveal curve shared by light-block and video-highlight: hold, grow, hold
fully open through the middle, settle back, hold. Held in one place on purpose —
a second reveal on the same site easing on a different schedule would read as a
bug rather than as a variation.

These are the values that SHIPPED. The prose comment in the light block's embed
described 20/42/58/80 and had drifted from its own keyframes; the numbers here
are the ones signed off visually.
*/
const growStart = 0.1
const growEnd = 0.42
const shrinkStart = 0.58
const shrinkEnd = 0.9

/*
CSS `ease-in-out` is cubic-bezier(0.42, 0, 0.58, 1), applied to each keyframe
interval. Solved properly rather than approximated with a smoothstep: the y
component of this bezier IS smoothstep in the curve's own parameter, but the x
mapping is not the identity, so smoothstep(x) is a different function of
progress. Chrome and Safari 26 ran the CSS version in production, so eyeballing
it would have been a visible regression for most of the traffic.
*/
const easeX1 = 0.42
const easeX2 = 0.58
const easeY1 = 0
const easeY2 = 1

// Cubic bezier with endpoints pinned at 0 and 1, so only the two control
// values vary. Used for both the x and y components.
function bezier(t, a, b) {
  const u = 1 - t
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t
}

function bezierSlope(t, a, b) {
  const u = 1 - t
  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b)
}

// Invert the x component with Newton-Raphson, then read off y. The curve is
// monotonic and gently sloped, so this converges in a handful of iterations.
export function easeInOut(x) {
  if (x <= 0) return 0
  if (x >= 1) return 1

  let t = x
  for (let i = 0; i < 6; i++) {
    const dx = bezier(t, easeX1, easeX2) - x
    if (Math.abs(dx) < 1e-5) break

    const slope = bezierSlope(t, easeX1, easeX2)
    if (Math.abs(slope) < 1e-6) break

    t -= dx / slope
  }

  return bezier(t, easeY1, easeY2)
}

/**
 * How far a reveal has opened, for a given position through the viewport.
 *
 * @param {number} position - 0 when the top edge is at the viewport bottom,
 *                            1 once the bottom edge has passed the top
 * @returns {number} 0 at rest, 1 fully revealed
 */
export function revealProgress(position) {
  if (position <= growStart || position >= shrinkEnd) return 0
  if (position >= growEnd && position <= shrinkStart) return 1

  if (position < growEnd) {
    return easeInOut((position - growStart) / (growEnd - growStart))
  }

  return 1 - easeInOut((position - shrinkStart) / (shrinkEnd - shrinkStart))
}
