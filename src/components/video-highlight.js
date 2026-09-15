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
*/

import { trackScrollProgress, revealProgress } from './scroll-progress.js'

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
  Same driver and the same reveal curve as light-block, which is the point —
  the two reveals on this site are meant to read as one effect, and holding the
  schedule in scroll-progress.js is what makes that true by construction rather
  than by two files agreeing.
  */
  return trackScrollProgress(elements, {
    property: '--video-bleed-p',
    map: revealProgress,
  })
}
