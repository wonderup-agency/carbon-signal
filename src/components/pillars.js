/*
Component: pillars
Trigger selector: [data-pillars]

Pillars accordion, desktop only. The CSS owns the animation; this moves one
attribute and publishes the one measurement the CSS cannot work out on its own.

On desktop the panels are absolutely positioned and moved with transforms.
Animating flex-grow relaid out the whole row every frame and could not be
composited, which showed as a stutter no amount of containment fixed; a
translate runs off the main thread. The cost is that the geometry the flex box
used to work out — widths, offsets, row height — now has to be computed here.

Below 992px the panels are a plain stacked list with everything open. Featured
resources have to be tappable straight away, so a tap-to-expand card fights the
link sitting inside it; once one page stopped collapsing there was no reason for
the other to differ. That removed the stacked accordion entirely, and with it
--pillar-h and the height measuring that fed it.

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
data-pillar-state="open" and the whole group reads as open. normaliseState
settles both shapes before anything measures: place() hands the open panel the
whole remainder, so a group with two of them would lay panels on top of each
other and run off the end of the row.
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

/* Wires up one group and returns its update function, so the component's
   resize hook can re-sync and re-measure every group. Resize is also how a
   breakpoint crossing reaches syncMode. */
function initGroup(group) {
  const panels = Array.from(group.querySelectorAll('[data-pillar]'))
  if (panels.length < 2) return null

  normaliseState(group, panels)

  let timer = null
  let lastGeom = null

  const isStacked = () => window.matchMedia(stacked).matches

  /* Below 992px every panel is open and may carry its own stretched link, so
     the button semantics have to come off — otherwise a screen reader is
     offered a button wrapping an anchor, and the click handler competes with
     the link for the same tap. Reapplied on the way back up. */
  function syncMode() {
    const off = isStacked()
    panels.forEach((panel) => {
      if (off) {
        panel.removeAttribute('role')
        panel.removeAttribute('tabindex')
        panel.removeAttribute('aria-expanded')
        return
      }
      panel.setAttribute('role', 'button')
      panel.setAttribute('tabindex', '0')
      panel.setAttribute(
        'aria-expanded',
        panel.getAttribute('data-pillar-state') === 'open' ? 'true' : 'false'
      )
    })
  }

  /* Panels are taken out of flow on desktop and placed by transform, so the
     geometry has to be computed rather than left to flex. Widths come from the
     collapsed width declared on the panel class; the open panel takes whatever
     is left over.

     --pillar-open-w doubles as the content width lock it always was, so the
     copy never re-wraps mid-transition. */
  function measureGeometry() {
    if (isStacked()) {
      group.style.removeProperty('--pillar-open-w')
      group.style.removeProperty('--pillar-collapsed-w')
      group.style.removeProperty('--pillars-h')
      panels.forEach((p) => p.style.removeProperty('--pillar-x'))
      return null
    }

    const groupStyle = getComputedStyle(group)
    const gap = parseFloat(groupStyle.columnGap) || 0
    const panelStyle = getComputedStyle(panels[0])
    const collapsed = parseFloat(panelStyle.minWidth) || 0
    const pad =
      (parseFloat(panelStyle.paddingLeft) || 0) +
      (parseFloat(panelStyle.paddingRight) || 0)

    const openW =
      group.clientWidth - (panels.length - 1) * (gap + collapsed) - pad
    if (openW <= 0) return null

    group.style.setProperty('--pillar-open-w', Math.floor(openW) + 'px')
    group.style.setProperty('--pillar-collapsed-w', collapsed + 'px')

    return { gap, collapsed, openW: Math.floor(openW) }
  }

  /* Walks the row once and writes each panel's x offset. Every panel before
     the open one sits at a collapsed width, the open one is wide, everything
     after is collapsed again — so the offsets are just a running total.

     This is the whole point of the rewrite: the browser composites a
     translate, where animating flex-grow forced the row to lay out all four
     panels every frame. */
  function place(geom) {
    if (!geom) return
    let x = 0
    panels.forEach((panel) => {
      panel.style.setProperty('--pillar-x', Math.round(x) + 'px')
      const isOpen = panel.getAttribute('data-pillar-state') === 'open'
      x += (isOpen ? geom.openW : geom.collapsed) + geom.gap
    })
  }

  /* Absolute panels give the row no height of its own, so it gets one from the
     tallest panel. The measurement has to clear --pillars-h first: the panels
     size themselves from that same variable, so reading them while it is set
     just returns the value already in it and the row can never grow to fit its
     content. Cleared, they fall back to height:auto and report the real thing.

     One forced reflow, on init and resize only. */
  function measureHeight() {
    if (isStacked()) {
      group.style.removeProperty('--pillars-h')
      return
    }
    group.style.removeProperty('--pillars-h')
    const tallest = panels.reduce((max, p) => Math.max(max, p.offsetHeight), 0)
    if (tallest > 0) {
      group.style.setProperty('--pillars-h', tallest + 'px')
    }
  }

  function update() {
    syncMode()
    lastGeom = measureGeometry()
    place(lastGeom)
    measureHeight()
  }

  function open(panel) {
    if (isStacked()) return
    if (panel.getAttribute('data-pillar-state') === 'open') return
    panels.forEach((p) => {
      const isOpen = p === panel
      p.setAttribute('data-pillar-state', isOpen ? 'open' : 'closed')
      p.setAttribute('aria-expanded', isOpen ? 'true' : 'false')
    })
    /* Re-place only. Re-measuring here would read layout mid-transition and
       force a synchronous reflow on every hover; the widths have not changed,
       only which panel is wide. */
    place(lastGeom)
  }

  panels.forEach((panel, i) => {
    panel.addEventListener('click', () => {
      clearTimeout(timer)
      open(panel)
    })

    /* Hover opens too, but on a short delay: a cursor crossing the strip on
       its way somewhere else would otherwise fire two or three 600ms width
       transitions back to back. */
    panel.addEventListener('pointerenter', (ev) => {
      if (ev.pointerType === 'touch') return
      if (isStacked()) return
      clearTimeout(timer)
      timer = setTimeout(() => open(panel), hoverDelay)
    })

    panel.addEventListener('pointerleave', () => {
      clearTimeout(timer)
    })

    panel.addEventListener('keydown', (ev) => {
      if (isStacked()) return
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

  update()

  /* The row's height is content-derived again, so a late-decoding image can
     change it. Panel visuals carry an aspect-ratio, which makes the height
     deterministic before decode, but a panel without one would not be. */
  group.querySelectorAll('img').forEach((img) => {
    if (img.complete) return
    img.addEventListener('load', measureHeight)
  })

  return update
}

/**
 * @param {HTMLElement[]} elements - All elements matching [data-pillars]
 */
export default function (elements) {
  const updates = elements.map(initGroup).filter(Boolean)

  return {
    // Replaces the embed's own 150ms debounced resize listener — main.js
    // already debounces this hook by the same interval.
    resize() {
      updates.forEach((update) => update())
    },
  }
}
