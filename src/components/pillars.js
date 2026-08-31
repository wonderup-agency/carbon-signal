/*
Component: pillars
Trigger selector: [data-pillars]

Possibilities pillars accordion. The CSS owns the animation; this moves one
attribute and publishes two measurements the CSS cannot work out on its own.

Migrated from a script-only HTML Embed inside the Section / Possibilities
Pillars component. The embed's window.__csPillarsInit guard is gone: it existed
because two component instances meant two copies of the script tag, and the
bundle only ever evaluates this module once.

No stylesheet import: the pillars CSS lives in the "Pillars CSS" embed in the
Global / Styles component on the Webflow canvas, so the open/closed states
render in the Designer — bundled CSS never does. Same split as bg-grid.

Groups arrive from two kinds of markup. Possibilities hand-authors its panels
and opens exactly one of them. Resources repeats a single template through a
Webflow Collection List, so every rendered panel inherits the template's
data-pillar-state="open" and the whole group reads as open — which also stops
measureWidth publishing --pillar-open-w, since it needs at least one closed
panel as a stable width reference. normaliseState settles both shapes before
anything measures.
*/

const hoverDelay = 90 // ms — see pointerenter below
const stacked = '(max-width: 991px)'

/* Reduces the group to exactly one open panel. A single authored open panel is
   honoured; anything else — none, or the all-open state a Collection List
   produces — falls back to the first.

   Flagging the group afterwards releases the pre-script CSS gate in the
   Pillars CSS embed, which holds CMS panels after the first in their closed
   presentation. Without the flag the gate would keep overriding this. */
function normaliseState(group, panels) {
  const authored = panels.filter(
    (p) => p.getAttribute('data-pillar-state') === 'open'
  )
  const initial = authored.length === 1 ? authored[0] : panels[0]

  panels.forEach((p) => {
    p.setAttribute('data-pillar-state', p === initial ? 'open' : 'closed')
  })

  group.setAttribute('data-pillars-ready', 'true')
}

/* Wires up one group and returns its measure function, so the component's
   resize hook can re-measure every group. */
function initGroup(group) {
  const panels = Array.from(group.querySelectorAll('[data-pillar]'))
  if (panels.length < 2) return null

  normaliseState(group, panels)

  const bodies = Array.from(
    group.querySelectorAll('.pillars_panel_visual-wrapper, .pillars_panel_para')
  )
  let timer = null

  /* 1. Stacked accordion animates max-height, and max-height cannot resolve
     'auto'. Guessing a ceiling makes opening feel abrupt: the easing spends
     most of its duration travelling through empty space above the real
     content. Publish each element's own height instead. scrollHeight is
     readable even while the element is clipped to 0, so closed panels
     measure fine too. */
  function measureHeights() {
    bodies.forEach((el) => {
      el.style.removeProperty('--pillar-h')
      el.style.setProperty('--pillar-h', el.scrollHeight + 'px')
    })
  }

  /* 2. Desktop content is locked to the width the panel has when open, so it
     never re-wraps mid-transition. Derived rather than read off a live
     element, because the open panel is the thing that is moving. Closed
     panels sit at their flex-basis the whole time, so their width is a
     stable reference. */
  function measureWidth() {
    if (window.matchMedia(stacked).matches) {
      group.style.removeProperty('--pillar-open-w')
      return
    }
    const closed = panels.filter(
      (p) => p.getAttribute('data-pillar-state') !== 'open'
    )
    if (!closed.length) return

    const gap = parseFloat(getComputedStyle(group).columnGap) || 0
    const collapsed = closed[0].getBoundingClientRect().width
    const panelStyle = getComputedStyle(panels[0])
    const pad =
      (parseFloat(panelStyle.paddingLeft) || 0) +
      (parseFloat(panelStyle.paddingRight) || 0)

    const openW =
      group.clientWidth - (panels.length - 1) * (gap + collapsed) - pad

    if (openW > 0) {
      group.style.setProperty('--pillar-open-w', Math.floor(openW) + 'px')
    }
  }

  /* width first, then heights: the new width decides how the copy wraps,
     which decides how tall it is */
  function measure() {
    measureWidth()
    measureHeights()
  }

  function open(panel) {
    if (panel.getAttribute('data-pillar-state') === 'open') return
    measure() // copy may have reflowed since load
    panels.forEach((p) => {
      const isOpen = p === panel
      p.setAttribute('data-pillar-state', isOpen ? 'open' : 'closed')
      p.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    })
  }

  panels.forEach((panel, i) => {
    panel.setAttribute('role', 'button')
    panel.setAttribute('tabindex', '0')
    panel.setAttribute(
      'aria-expanded',
      panel.getAttribute('data-pillar-state') === 'open' ? 'true' : 'false'
    )

    panel.addEventListener('click', () => {
      clearTimeout(timer)
      open(panel)
    })

    /* Hover opens too, but on a short delay: a cursor crossing the strip on
       its way somewhere else would otherwise fire two or three 600ms width
       transitions back to back. */
    panel.addEventListener('pointerenter', (ev) => {
      if (ev.pointerType === 'touch') return
      if (window.matchMedia(stacked).matches) return
      clearTimeout(timer)
      timer = setTimeout(() => open(panel), hoverDelay)
    })

    panel.addEventListener('pointerleave', () => {
      clearTimeout(timer)
    })

    panel.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        open(panel)
        return
      }
      const dir = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0
      if (!dir) return
      ev.preventDefault()
      const next = panels[(i + dir + panels.length) % panels.length]
      open(next)
      next.focus()
    })
  })

  measure()

  /* images settle late and change the real height under us */
  group.querySelectorAll('img').forEach((img) => {
    if (img.complete) return
    img.addEventListener('load', measure)
  })

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(measure)
  }

  return measure
}

/**
 * @param {HTMLElement[]} elements - All elements matching [data-pillars]
 */
export default function (elements) {
  const measures = elements.map(initGroup).filter(Boolean)

  return {
    // Replaces the embed's own 150ms debounced resize listener — main.js
    // already debounces this hook by the same interval.
    resize() {
      measures.forEach((measure) => measure())
    },
  }
}
