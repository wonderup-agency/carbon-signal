/*
Component: slider
Trigger selector: [data-slider]

One component for every slider on the site. Behaviour is configured entirely
from data attributes, so a new slider needs Webflow markup and no JS change.

The active slide is the leftmost one and is wider than the rest. That falls out
of Swiper's own behaviour: with slidesPerView:'auto' the active slide is aligned
to the container's start, so "active" and "leftmost" are the same slide.

Swiper needs .swiper / .swiper-wrapper / .swiper-slide on specific elements.
Rather than make you hand-maintain those in the Designer next to Client-First
classes, they are applied here at init — Webflow markup stays semantic and
Swiper's own stylesheet still matches.

CSS contract with ./styles/slider.css. The custom properties are the single
source of truth for the geometry, and this module reads them rather than
measuring the slides, because while the active card is widening a measured width
is a frame-by-frame interpolation:

  --slide-w         read     collapsed slide width
  --slide-w-active  read     active (leftmost) slide width
  --slider-ease     read     shared easing — by the stylesheet only, never here
  --slider-speed    written  from data-slider-speed, so the width transition
                             and Swiper's translate share one duration
*/

import Swiper from 'swiper'
import { Navigation, A11y, Keyboard } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/a11y'

import './styles/slider.css'

const defaults = {
  speed: 600,
  gap: 0,
  loop: false,
}

/* Mirrors the var() fallbacks in slider.css. Two copies is the price of the
   tokens living in CSS; keep them in step. */
const fallbackRem = {
  collapsed: 22,
  active: 27.5,
}

function num(root, name, fallback) {
  const raw = root.getAttribute(name)
  if (raw === null) return fallback
  const value = parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

function bool(root, name, fallback) {
  const raw = root.getAttribute(name)
  if (raw === null) return fallback
  return raw !== 'false'
}

function rootFontSize() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
}

/* Custom properties come back as authored rather than resolved, so a rem value
   arrives as "22rem" and has to be converted by hand. px and rem are what the
   stylesheet uses; anything else falls back rather than guessing. */
function lengthOf(root, name, remFallback) {
  const raw = getComputedStyle(root).getPropertyValue(name).trim()
  const value = parseFloat(raw)
  if (!raw || !Number.isFinite(value)) return remFallback * rootFontSize()
  if (raw.endsWith('rem')) return value * rootFontSize()
  if (raw.endsWith('px')) return value
  return remFallback * rootFontSize()
}

/* Wires one slider and returns its Swiper instance, or null if the markup is
   incomplete or there is nothing to slide. */
function initSlider(root) {
  const track = root.querySelector('[data-slider-track]')
  if (!track) return null

  /* Swiper measures its own root and treats it as the drag surface, so that
     root must wrap the track and nothing else. The design puts the label and
     arrows above the scrolling area, so they need to live outside it while
     still being inside [data-slider] — hence an optional inner viewport.
     Without one, the root itself is the viewport. */
  const viewport = root.querySelector('[data-slider-viewport]') || root
  if (!viewport.contains(track)) return null

  /* Only direct slides of this track — a nested slider must not have its
     slides claimed by the outer one. */
  const slides = Array.from(track.children).filter((el) =>
    el.matches('[data-slider-slide]')
  )
  if (slides.length < 2) return null

  viewport.classList.add('swiper')
  track.classList.add('swiper-wrapper')
  slides.forEach((slide) => slide.classList.add('swiper-slide'))

  const speed = num(root, 'data-slider-speed', defaults.speed)
  const gap = num(root, 'data-slider-gap', defaults.gap)
  const loop = bool(root, 'data-slider-loop', defaults.loop)

  /* Publish the duration so the CSS widening the active slide uses exactly the
     same timing. If the two drift apart the slide resizes while Swiper is still
     translating and the row visibly tears. */
  root.style.setProperty('--slider-speed', speed + 'ms')

  const widths = () => ({
    collapsed: lengthOf(root, '--slide-w', fallbackRem.collapsed),
    active: lengthOf(root, '--slide-w-active', fallbackRem.active),
  })

  /* Swiper clamps the translate so the last slide finishes flush with the right
     edge. Under slidesPerView:'auto' that leaves the final cards unable to reach
     the left edge — and because the leftmost slide is the active one, they could
     never go active at all. The symptom was the track barely moving on the first
     arrow click and the arrows picking up is-locked, Swiper having concluded
     there was almost nothing left to scroll. Trailing space the size of the
     leftover viewport gives the last card somewhere to travel to. It derives
     from the active width, so it has to be recomputed whenever that moves.
     Looping makes every slide reachable on its own, so it is skipped there.

     Returns whether the value changed, leaving the caller to decide when an
     update() is safe. */
  function syncEndOffset(instance) {
    if (loop) return false
    const offset = Math.max(0, instance.width - widths().active)
    if (instance.params.slidesOffsetAfter === offset) return false
    instance.params.slidesOffsetAfter = offset
    return true
  }

  const prevEl = root.querySelector('[data-slider-prev]')
  const nextEl = root.querySelector('[data-slider-next]')

  const swiper = new Swiper(viewport, {
    modules: [Navigation, A11y, Keyboard],

    /* Widths come from CSS, not from a slide count — that is what lets the
       active slide be wider without the JS knowing any dimensions. */
    slidesPerView: 'auto',
    spaceBetween: gap,
    speed,
    loop,
    watchSlidesProgress: true,

    navigation:
      prevEl && nextEl
        ? {
            prevEl,
            nextEl,
            disabledClass: 'is-disabled',
            lockClass: 'is-locked',
          }
        : false,

    // onlyInViewport so arrow keys elsewhere on the page are not hijacked.
    keyboard: { enabled: true, onlyInViewport: true },
    a11y: { enabled: true },

    on: {
      afterInit(instance) {
        if (syncEndOffset(instance)) instance.update()
      },

      resize(instance) {
        if (syncEndOffset(instance)) instance.update()
      },

      /* Swiper built its snap grid from the widths that were in play before the
         active class moved, so the offset it is animating towards is the stale
         one — the wrong value is the destination, not the origin. Retarget it to
         what the tokens say it should be: every slide to the left of the active
         one is collapsed, so the translate is that many collapsed widths, plus
         the gaps between them. translateBounds is off because the stale grid's
         bounds are wrong for the same reason. */
      slideChangeTransitionStart(instance) {
        const { collapsed } = widths()
        instance.translateTo(
          -(instance.activeIndex * (collapsed + gap)),
          speed,
          false,
          false
        )
      },

      /* Widths have settled, so the grid can be rebuilt from real numbers. The
         translate already equals what update() derives, so this resyncs without
         moving anything. */
      slideChangeTransitionEnd(instance) {
        syncEndOffset(instance)
        instance.update()
      },
    },
  })

  /* Webfonts landing after init change how the copy wraps, which changes slide
     heights. Swiper's own observer catches resizes but not this. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      syncEndOffset(swiper)
      swiper.update()
    })
  }

  return swiper
}

/**
 * @param {HTMLElement[]} elements - All elements matching [data-slider]
 */
export default function (elements) {
  elements.forEach(initSlider)

  /* No resize hook: Swiper runs its own ResizeObserver and re-measures itself,
     so wiring the debounced window resize here would only duplicate work. */
}
