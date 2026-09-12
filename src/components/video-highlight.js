/*
Component: video-highlight
Webflow attribute: data-component="video-highlight"

Drives the Technology video card's scroll bleed. The card rests as a 3-by-3
grid-snapped square holding a muted background video; the video grows out of
that frame to a full-bleed 16:9 band as the card passes through the middle of
the viewport, then settles back.

WHAT THIS PUBLISHES
One scalar, --video-bleed-p, from 0 (resting card) to 1 (full bleed). The
"Video Highlight CSS" embed in Global / Styles composes every inset from it, so
the target width, the target aspect and the overhang cap all stay on the
Webflow canvas and still render in the Designer. See CONVENTIONS.md.

WHY THE BLOCK IS NOT WHAT GROWS
The block carries data-grid-snap, so its box IS the grid geometry, and bg-grid
derives every section's row phase from section heights. Growing the block would
change the section height on every scroll frame, firing bg-grid's
ResizeObserver on document.body and re-running growCards, phaseRows and the
canvas rebuild continuously. The embed grows the absolutely positioned lightbox
instead, which cannot affect its containing block — so this file writes one
number and never disturbs the grid.

Growing the lightbox rather than a pseudo-element is also what keeps the click
working: the lightbox is the trigger, so the thing that opens the video and the
thing that visibly bleeds are the same element and cannot drift apart.

SHARED SHAPE WITH light-block.js
The progress maths, the cubic-bezier solve and the rAF-coalesced scroll loop
below are the same as light-block.js, held at the same timing positions so the
two reveals on the site read as one effect. They are currently two copies.
Extracting the driver is the obvious next change and was deliberately left out
of this one, rather than refactoring an effect shipped on four pages in order
to deliver an unrelated section. See video-highlight.md.
*/

/*
Positions along the card's pass through the viewport. Same four numbers as
light-block, on purpose — a second reveal on the same site that eased on a
different schedule would read as a bug rather than as a variation.
*/
const growStart = 0.1
const growEnd = 0.42
const shrinkStart = 0.58
const shrinkEnd = 0.9

/*
CSS `ease-in-out` is cubic-bezier(0.42, 0, 0.58, 1). Solved properly rather
than approximated with a smoothstep: the y component of this bezier IS
smoothstep in the curve's own parameter, but the x mapping is not the identity,
so smoothstep(x) is a different function of progress.
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

// How far the video has bled out, for a given position through the viewport.
function bleedAt(position) {
  if (position <= growStart || position >= shrinkEnd) return 0
  if (position >= growEnd && position <= shrinkStart) return 1

  if (position < growEnd) {
    return easeInOut((position - growStart) / (growEnd - growStart))
  }

  return 1 - easeInOut((position - shrinkStart) / (shrinkEnd - shrinkStart))
}

/**
 * @param {HTMLElement[]} elements - All elements matching [data-component='video-highlight']
 */
export default function (elements) {
  /*
  Reduced motion drops the reveal rather than shortening it: writing nothing
  leaves the embed's var(--video-bleed-p, 0) fallback holding the card exactly
  at rest.

  The looping background video is stopped too. It is the other half of the
  motion the setting is asking us to turn off, and unlike the Rive elements in
  rive-scroll there is no risk of reading as a broken canvas — a paused video
  still paints its first frame, so the card looks like a still. The lightbox
  still opens the full video on click, which is the deliberate way in.
  */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    elements.forEach((el) => {
      el.querySelectorAll('video').forEach((video) => {
        video.autoplay = false
        video.pause()
      })
    })
    return
  }

  /*
  Page-relative geometry is cached so the per-frame path does no layout reads.
  Only the card's own box is needed: the embed derives the bleed target from
  100vw itself, so a width change needs no new measurement here beyond top and
  height, which a resize already re-reads.
  */
  const cards = elements.map((el) => ({ el, top: 0, height: 0, last: null }))

  let frame = null

  function measure() {
    cards.forEach((card) => {
      const rect = card.el.getBoundingClientRect()
      card.top = rect.top + window.scrollY
      card.height = rect.height
    })
  }

  function paint() {
    frame = null

    const viewport = window.innerHeight
    const scrolled = window.scrollY

    cards.forEach((card) => {
      /*
      The cover range of a view() timeline: 0 when the card's top edge is at
      the bottom of the viewport, 1 once its bottom edge has passed the top.
      */
      const top = card.top - scrolled
      const span = viewport + card.height
      const position = span > 0 ? (viewport - top) / span : 0

      const p = bleedAt(position)

      // Skip the write when nothing meaningful changed — a card parked outside
      // the range would otherwise re-set the same 0 every frame.
      if (card.last !== null && Math.abs(p - card.last) < 0.0005) return

      card.last = p
      card.el.style.setProperty('--video-bleed-p', p.toFixed(4))
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
  A ResizeObserver on the body rather than on the cards themselves: the card's
  own height matters, but so does its page position, which anything above it
  can change. Same reasoning as bg-grid and light-block.

  Note this cannot loop with the bleed itself. The lightbox is absolutely
  positioned, so growing it never changes the body's box — which is the same
  property that keeps bg-grid asleep.
  */
  const observer = new ResizeObserver(remeasure)
  observer.observe(document.body)

  // Late-landing fonts and images reflow the card and everything above it.
  if (document.fonts) document.fonts.ready.then(remeasure)
  window.addEventListener('load', remeasure)

  return {
    // Viewport height is part of the progress calculation, and a height-only
    // window resize does not change the body's box, so the ResizeObserver
    // above will not always catch it.
    resize: remeasure,
  }
}
