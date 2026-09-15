/*
Component: section-tags
Webflow attribute: data-section-tags

WHAT THIS IS
The row of tags above the homepage's three possibilities steps. Each tag is an
anchor link to one step; this marks whichever step currently covers the middle
of the viewport so the stylesheet can light that tag's dot.

It publishes a second flag, for whether the row has pinned under the nav, which
the stylesheet uses to retract the flanking hairlines. Two independent states,
both written here because neither is expressible in CSS.

The row itself is shared markup: .section-tags_* are the resources filter's
classes, generalised. Only this row is JS-driven, which is what
data-section-tags says.

WHY THE DOT NEEDS JS AT ALL
Webflow's own w--current is assigned by URL match, not scroll position, so it
would only ever light the tag whose hash is in the address bar — and
smooth-scroll.js preventDefaults these clicks and hands off to Lenis without
writing the hash, so it would never light at all. :target has the same problem
from the other side: the tag is neither a descendant nor a sibling of the step,
and CSS cannot select across. See components/section-tags.md.

WHY NO CLICK HANDLER
smooth-scroll.js already delegates a[href^="#"] on the document and routes it
through lenis.scrollTo(). A second listener here would either duplicate that
work or fight it. Under reduced motion that delegate is never registered and
the browser's native hash jump takes over, which is also correct.

NOT REGISTERED ON data-component
Same reasoning as bg-grid and slider: data-section-tags is both the opt-in and
the thing the stylesheet keys off, so one attribute cannot disagree with
itself.
*/

/*
An element is reported intersecting only while it crosses the viewport's
horizontal midline. With the steps stacked contiguously that makes exactly one
active at a time and the handover happens at the boundary, with no thresholds
to tune and no measuring of our own.
*/
const midlineOnly = { rootMargin: '-50% 0px -50% 0px', threshold: 0 }

/**
 * Flags the row once it has pinned under the nav, so the stylesheet can retract
 * the flanking hairlines. Reverses on the way back up.
 *
 * WHY A SENTINEL
 * position: sticky has no state to read and fires no event. The alternative is
 * observing the row itself with a negative root margin, but the row's top edge
 * lands exactly on the margin while stuck, so the ratio sits on the boundary
 * and subpixel rounding makes it flicker between states — visible here because
 * a 0.4s transition is attached to it. A zero-height marker sitting where the
 * row *would* be in flow crosses that line once, cleanly.
 *
 * It is created here rather than authored on the canvas because it is an
 * implementation detail of this effect, with nothing to see and nothing to
 * configure — on the canvas it would read as a stray empty div and eventually
 * be tidied away.
 *
 * @param {HTMLElement} row - the [data-section-tags] element
 */
function trackStuck(row) {
  /*
  Read from the panel rather than hard-coded, so moving the sticky offset in
  Webflow moves the trigger with it. A row that is not sticky computes to
  'auto' and opts itself out — which is what the resources row would do if it
  ever took the attribute.
  */
  const stickyTop = parseFloat(getComputedStyle(row).top)
  if (!Number.isFinite(stickyTop)) return

  const sentinel = document.createElement('div')
  sentinel.setAttribute('aria-hidden', 'true')
  sentinel.style.height = '0'
  row.parentNode.insertBefore(sentinel, row)

  const observer = new IntersectionObserver(
    ([entry]) => {
      row.setAttribute('data-section-tags-stuck', String(!entry.isIntersecting))
    },
    { rootMargin: `-${stickyTop}px 0px 0px 0px`, threshold: 0 }
  )

  observer.observe(sentinel)
}

/**
 * @param {HTMLElement[]} rows - all elements matching [data-section-tags]
 */
export default function (rows) {
  rows.forEach((row) => {
    trackStuck(row)

    /*
    The href still resolves the link, but what gets *observed* is the step it
    lands in, not the landing point itself.

    Those are two different elements on purpose. The landing point is an
    .anchor-scroll marker — a zero-height div pulled up by a negative margin so
    the heading clears the nav and the sticky row. A zero-height box is exactly
    what the midline observer below cannot see: its root region is a zero-height
    line, and two zero-height rects essentially never report as intersecting, so
    observing the marker silently means no step is ever active.

    So we climb to the nearest [data-section-step]. Those are the 100vh step
    wrappers, which tile the section contiguously — that contiguity is what
    makes the handover at each boundary clean. Falling back to the target keeps
    a row working whose links point straight at something with a real box.
    */
    const pairs = []

    row.querySelectorAll('a[href^="#"]').forEach((link) => {
      const hash = link.getAttribute('href')
      if (!hash || hash === '#') return

      let landing = null
      try {
        landing = document.querySelector(hash)
      } catch {
        // An id that is not a valid selector. Authored by hand, so this means
        // a typo rather than a case worth supporting.
        console.warn(`[section-tags] not a valid target: ${hash}`)
      }
      if (!landing) return

      const step = landing.closest('[data-section-step]') ?? landing
      pairs.push({ link, target: step })
    })

    if (pairs.length < 2) return

    /*
    Written on the link itself, which is also the pill — .section-tags_pill is
    on the anchor, so the stylesheet's ::before dot and the accessibility tree
    both key off the same element the user actually activates.
    */
    function setActive(activeLink) {
      pairs.forEach(({ link }) => {
        const isActive = link === activeLink
        link.setAttribute('data-section-tag-active', String(isActive))
        if (isActive) {
          link.setAttribute('aria-current', 'location')
        } else {
          link.removeAttribute('aria-current')
        }
      })
    }

    const observer = new IntersectionObserver((entries) => {
      const entered = entries.find((entry) => entry.isIntersecting)
      if (!entered) return

      /*
      Only ever act on something entering. Leaving the midline means another
      step is taking it, and that step's own entry does the work — clearing on
      exit would blank the row for a frame at every boundary.

      It also leaves the last step lit once the section has scrolled past,
      which is the honest reading: that is still the step you came out of.
      */
      const pair = pairs.find(({ target }) => target === entered.target)
      if (pair) setActive(pair.link)
    }, midlineOnly)

    /*
    observe() reports initial state, so a refresh partway down the page paints
    correctly with no separate first pass. Below 992px the whole scroll layout
    is display:none, so the targets have no box, nothing ever intersects, and
    the row — hidden at the same breakpoint — is left alone for free.
    */
    pairs.forEach(({ target }) => observer.observe(target))
  })
}
