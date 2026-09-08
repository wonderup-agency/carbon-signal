/*
Component: light-block
Triggered by the .light-block class — see components.js for why.

Drives the light-block scroll bleed, which used to be a CSS view() timeline.
Firefox has no scroll-driven animation support and Safari only gained it in 26,
so on a meaningful slice of traffic the @supports guard dropped the whole
effect and the block stayed a static card. This restores it everywhere.

WHAT THIS PUBLISHES
One scalar, --light-bleed-p, from 0 (inset rounded card) to 1 (full bleed).
The Light Block CSS in the CUSTOM STYLES embed composes the clip-path from it,
so everything about how the effect LOOKS still lives on the Webflow canvas and
still renders in the Designer. See CONVENTIONS.md.

That split is deliberate and it is what keeps the port honest: the geometry
(--light-gap-x, --light-bleed-y, --light-bleed-radius) is untouched, and this
file only decides how far along the reveal is. One scalar drives all three
insets, so the rest state stays exactly as exact as it was — at p = 0 the
pseudo lands precisely on the block's box.

NO ANIMATION LIBRARY
The job is one number per frame per element. GSAP's ScrollTrigger would be
~46KB gzipped for that, and it would need to be proxied onto Lenis, giving the
page two sources of truth about scroll position. It also could not interpolate
the clip-path directly — the keyframe values are built from var()/calc() on
100vw, which GSAP cannot resolve — so it would end up animating a scalar custom
property regardless. That is this file.

NOT COUPLED TO LENIS
Reads window.scrollY and listens to the native scroll event rather than calling
lenis.on('scroll'). Lenis sets the genuine scroll position every frame, so
native scroll events fire and window.scrollY is accurate — the effect therefore
works identically with smooth scroll on, off, or absent.
*/

/*
Positions along the block's pass through the viewport, matching the keyframe
percentages the CSS animation used. Growing runs between growStart and growEnd,
the block holds fully bled between growEnd and shrinkStart, then mirrors back.

Note these are the values that SHIPPED (10/42/58/90). The prose comment in the
embed described 20/42/58/80 and had drifted from the code; the numbers here are
the ones people have actually signed off on visually.
*/
const growStart = 0.1
const growEnd = 0.42
const shrinkStart = 0.58
const shrinkEnd = 0.9

/*
CSS `ease-in-out` is cubic-bezier(0.42, 0, 0.58, 1), and the animation applied
it to each keyframe interval. Chrome and Safari 26 have been running the CSS
version in production, so approximating the curve with a smoothstep would be a
visible regression for most of the traffic — the y component of this bezier is
smoothstep in the curve's own parameter, but the x mapping is not the identity,
so the two are not the same function of progress.
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
function easeInOut(x) {
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

// How far the fill has grown, for a given position through the viewport.
function bleedAt(position) {
  if (position <= growStart || position >= shrinkEnd) return 0
  if (position >= growEnd && position <= shrinkStart) return 1

  if (position < growEnd) {
    return easeInOut((position - growStart) / (growEnd - growStart))
  }

  return 1 - easeInOut((position - shrinkStart) / (shrinkEnd - shrinkStart))
}

/**
 * @param {HTMLElement[]} elements - All elements matching .light-block
 */
export default function (elements) {
  /*
  Reduced motion drops the effect rather than shortening it, matching what the
  CSS did. The stylesheet keeps its own prefers-reduced-motion guard, so with
  nothing written here the pseudo is not created at all.
  */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  /*
  Page-relative geometry is cached so the per-frame path does no layout reads.
  Only the block's own box is needed: the CSS derives the horizontal gap from
  100vw itself, so a width change needs no new measurement here beyond top and
  height, which a resize already re-reads.
  */
  const blocks = elements.map((el) => ({ el, top: 0, height: 0, last: null }))

  let frame = null

  function measure() {
    blocks.forEach((block) => {
      const rect = block.el.getBoundingClientRect()
      block.top = rect.top + window.scrollY
      block.height = rect.height
    })
  }

  function paint() {
    frame = null

    const viewport = window.innerHeight
    const scrolled = window.scrollY

    blocks.forEach((block) => {
      /*
      The cover range of a view() timeline: 0 when the block's top edge is at
      the bottom of the viewport, 1 when its bottom edge has passed the top.
      */
      const top = block.top - scrolled
      const span = viewport + block.height
      const position = span > 0 ? (viewport - top) / span : 0

      const p = bleedAt(position)

      // Skip the write when nothing meaningful changed — a block parked
      // outside the range would otherwise re-set the same 0 every frame.
      if (block.last !== null && Math.abs(p - block.last) < 0.0005) return

      block.last = p
      block.el.style.setProperty('--light-bleed-p', p.toFixed(4))
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
  A ResizeObserver on the body rather than on the blocks themselves: the
  block's own height matters, but so does its page position, which anything
  above it can change. Same reasoning as bg-grid.
  */
  const observer = new ResizeObserver(remeasure)
  observer.observe(document.body)

  // Late-landing fonts and images reflow the block and everything above it.
  if (document.fonts) document.fonts.ready.then(remeasure)
  window.addEventListener('load', remeasure)

  return {
    // Viewport height is part of the progress calculation and a height-only
    // window resize does not change the body's box, so the ResizeObserver
    // above will not always catch it.
    resize: remeasure,
  }
}
