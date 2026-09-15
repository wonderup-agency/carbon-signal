/*
Component: parallax
Triggered by data-parallax — see components.js for why.

Drifts a section's background image against the page as it scrolls, so the
image reads as sitting behind the content rather than pasted onto it.

WHAT THIS PUBLISHES
One scalar, --parallax-p, from 0 (the frame's top edge at the bottom of the
viewport) to 1 (its bottom edge past the top). The Parallax CSS embed in
Global / Styles composes the transform from it, so the travel distance stays a
length on the canvas and can be retuned per section and per breakpoint without
touching the bundle. See CONVENTIONS.md.

THE ATTRIBUTE GOES ON THE FRAME, NOT THE IMAGE
Custom properties inherit, so publishing on .section_bg-image-wrapper makes the
value readable by whatever moves inside it. That is what lets one component
serve any section: the frame is the thing worth measuring — it is the window
the image is seen through — while the element that actually moves is the
embed's business.

WHY LINEAR AND NOT THE REVEAL CURVE
light-block and video-highlight ease with a hold in the middle, which is right
for something that opens and closes. Parallax is a positional mapping: easing
it would make the image drift faster and slower under a steady scroll, which
reads as a stutter rather than as depth.

The clamp is load-bearing rather than tidiness. Outside the cover range the
raw position keeps going, and an unclamped value would push the image past its
travel and expose the frame's edge.

NOT COUPLED TO LENIS
Inherited from scroll-progress.js, which reads window.scrollY and the native
scroll event. See that file.
*/

import { trackScrollProgress } from './scroll-progress.js'

/**
 * @param {HTMLElement[]} elements - All elements matching [data-parallax]
 */
export default function (elements) {
  /*
  Skipped entirely rather than shortened, matching light-block. Parallax is the
  archetype of the motion prefers-reduced-motion exists to turn off, and with
  nothing written the embed's var(--parallax-p, 0.5) fallback holds the image
  centred in its frame — the same picture the Designer canvas shows.
  */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  return trackScrollProgress(elements, {
    property: '--parallax-p',
    map: (position) => Math.min(1, Math.max(0, position)),
  })
}
