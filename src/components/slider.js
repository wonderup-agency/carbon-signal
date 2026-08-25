/*
Component: slider
Trigger selector: [data-slider]

One component for every slider on the site. Behaviour is configured entirely
from data attributes, so a new slider needs Webflow markup and no JS change.

The active slide is the leftmost one and is wider than the rest. That falls out
of Swiper's own behaviour: with slidesPerView:'auto' the active slide is aligned
to the container's start, so "active" and "leftmost" are the same slide. The
widths live in ./styles/slider.css.

Swiper needs .swiper / .swiper-wrapper / .swiper-slide on specific elements.
Rather than make you hand-maintain those in the Designer next to Client-First
classes, they are applied here at init — Webflow markup stays semantic and
Swiper's own stylesheet still matches.
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
      /* Slide widths change with the active class, so the dimensions Swiper
         cached are stale the moment that class moves. Recompute after the
         transition settles rather than during it — updating mid-flight resets
         the translate and the row jumps. */
      slideChangeTransitionEnd(instance) {
        instance.update()
      },
    },
  })

  /* Webfonts landing after init change how the copy wraps, which changes slide
     heights. Swiper's own observer catches resizes but not this. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => swiper.update())
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
