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
property regardless. That is what scroll-progress.js does.
*/

import { trackScrollProgress, revealProgress } from './scroll-progress.js'

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
  The measurement, the rAF-coalesced scroll loop and the reveal curve are all
  shared with video-highlight — held in scroll-progress.js so the two reveals
  cannot drift onto different schedules. The two lines below are the whole of
  what is specific to the light block.
  */
  return trackScrollProgress(elements, {
    property: '--light-bleed-p',
    map: revealProgress,
  })
}
