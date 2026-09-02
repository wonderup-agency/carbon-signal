import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

/*
Smooth scroll.

Not a registered component. It has no markup to attach to and applies to every
page, so global.js calls it directly rather than components.js matching it on a
selector.

WHY LENIS AND NOT A TRANSFORMED WRAPPER
Older smooth-scroll libraries fake it: the page sits in a wrapper that gets
translated while the document never actually scrolls. That breaks a lot of the
platform quietly — position: sticky, IntersectionObserver, scroll anchoring,
and CSS scroll-driven animations all read the real scroll position and find it
frozen at zero.

Lenis intercepts the wheel event, eases toward a target, and sets the genuine
scroll position each frame. Everything native keeps working. That matters here
specifically: .light-block_scroll_rive is position: sticky, and the light block
bleed in CUSTOM STYLES runs on a view() timeline. A wrapper-based library would
have killed both.

TOUCH IS LEFT ALONE
syncTouch is off on purpose. Mobile momentum scrolling is already tuned by the
OS and hijacking it tends to feel worse, not better, as well as costing
battery. Wheel and keyboard get the easing; fingers get the native behaviour.

REDUCED MOTION
The whole thing is skipped rather than shortened. Smooth scroll is exactly the
kind of motion the setting exists to turn off, and a Lenis instance with the
easing removed still intercepts the wheel for no benefit.
*/

let lenis = null

export default function initSmoothScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return null
  }

  lenis = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
  })

  function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  /*
  Webflow writes plain #hash hrefs for section links and relies on the browser
  to jump. Lenis owns the scroll position now, so a native jump would fight it
  and land in the wrong place. Delegated from the document so CMS and component
  links added later are covered without re-binding.

  data-lenis-prevent on a link opts it back out to native behaviour.
  */
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]')
    if (!link || link.hasAttribute('data-lenis-prevent')) return

    const hash = link.getAttribute('href')
    if (!hash || hash === '#') return

    const target = document.querySelector(hash)
    if (!target) return

    event.preventDefault()
    lenis.scrollTo(target)
  })

  return lenis
}

/*
For anything that needs to stop the page behind it — a modal, a mobile nav.
Call getLenis()?.stop() on open and .start() on close.
*/
export function getLenis() {
  return lenis
}
