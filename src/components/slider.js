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
source of truth for the geometry — this module derives Swiper's whole snap grid
from them rather than letting Swiper measure it:

  --slide-w         read     collapsed slide width
  --slide-w-active  read     active (leftmost) slide width
  --slider-ease     read     shared easing — by the stylesheet only, never here
  --slider-speed    written  from data-slider-speed, so the width transition
                             and Swiper's translate share one duration

Why the grid is defined and not measured
----------------------------------------
Swiper measures the slides once, with whichever one happened to be active at the
time, so the step from the active slide to its neighbour gets recorded as the
ACTIVE width. Collapse that slide on the next move and the step is stale. Live,
at activeIndex 2, sizes of [278.625, 278.625, 348.288, 278.625, 278.625] produced
a snapGrid of [0, 278.625, 557.25, 905.538, 1114.71] — but slide 3 actually sits
at 3 * 278.625 = 835.875. The 69.663px error is exactly 348.288 - 278.625, the
active-width delta, so Swiper translated too far and clipped the left of the
incoming card. Entries *below* the active index were measured from collapsed
slides and are correct, which is why only forward moves misbehaved.

Correcting the translate afterwards cannot fix that, because the same grid is
wrong for every subsequent move too. And a measured width is the wrong input
either way: mid-transition it is a frame-by-frame interpolation, and once the
transition ends it still reflects whichever slide was active when the
measurement ran.

Every slide except the active one is collapsed, so the geometry is fully
determined by the two tokens and can simply be written down. Two things follow
from doing that: maxTranslate becomes -((n - 1) * (collapsed + gap)), i.e. the
last slide resting at the left edge — which is what a trailing offset was
previously approximating — and snapGrid always holds more than one entry, so
Swiper stops reporting isLocked and slider.css stops hiding the arrows.
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

/* Resolved per call rather than cached: the site's root font size is fluid, so
   a rem token is worth a different number of pixels at different viewports. */
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

  /* Replaces Swiper's measured grid with the one the tokens imply — see the
     header for why measuring cannot work here. Every slide but the active one
     is collapsed, so each position is a whole number of collapsed steps. */
  function defineGrid(instance) {
    const { collapsed, active } = widths()
    const step = collapsed + gap
    const count = instance.slides.length
    const sizes = []
    const positions = []

    for (let i = 0; i < count; i++) {
      sizes.push(i === instance.activeIndex ? active : collapsed)
      positions.push(i * step)
    }

    instance.slidesSizesGrid = sizes
    instance.slidesGrid = positions
    /* A separate array: Swiper mutates the two independently. */
    instance.snapGrid = positions.slice()
    /* Only the last slide sits beyond the final step, and it is the one that
       can still widen — hence active rather than collapsed here. */
    instance.virtualSize = (count - 1) * step + active
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
      /* Swiper emits this at the end of updateSlides, so the derived grid lands
         after init, after every resize and after every update() — everywhere
         the measurement would otherwise take hold. */
      slidesUpdated(instance) {
        defineGrid(instance)
      },

      afterInit(instance) {
        instance.update()
      },

      resize(instance) {
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
