/*
Component: bg-grid
Trigger selector: [data-grid]

Paired with the BG Grid embed in Global / Styles, which owns the static CSS
lattice. Everything here needs measured layout, which CSS cannot do. None of it
runs in the Designer, so Preview shows the static grid — that is expected, not
a bug.
*/

/* -- shared ------------------------------------------------------------ */
/* --cell resolves through a chain of var()s, so reading it as a string is
   unreliable. Measure it with a throwaway element instead. */
function probe(section, css) {
  const el = document.createElement('div')
  el.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;width:0;' + css
  section.appendChild(el)
  const cs = getComputedStyle(el)
  const out = { h: el.getBoundingClientRect().height, color: cs.color }
  el.remove()
  return out
}

function cellOf(section) {
  return probe(section, 'height:var(--cell)').h
}

/* -- 3. interactive deformation ---------------------------------------- */
/* CSS gradients cannot bend, so an interactive section gets a canvas that
   redraws the SAME lattice the CSS would have drawn - same cell, same phase -
   and lets it deform near the cursor. Getting the lattice identical is what
   keeps this section aligned with its static neighbours. */
function initInteractive(section) {
  const host = section.querySelector('.bg-grid')
  if (!host || host.querySelector('canvas')) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'
  host.appendChild(canvas)
  section.setAttribute('data-grid-canvas', '')

  const ctx = canvas.getContext('2d')
  let pts = [],
    cols = 0,
    rows = 0,
    W = 0,
    H = 0,
    cell = 0
  let rgb = '145,205,231',
    rest = 0.28,
    blocks = []
  let px = -9999,
    py = -9999,
    active = false,
    running = false,
    onScreen = true

  function inBlock(x, y) {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (x >= b.l && x <= b.r && y >= b.t && y <= b.b) return true
    }
    return false
  }

  function build() {
    const r = host.getBoundingClientRect()
    W = r.width
    H = r.height
    if (!W || !H) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const p = probe(section, 'height:var(--cell);color:var(--line)')
    cell = p.h
    const m = p.color.match(/[\d.]+/g)
    if (m) rgb = m[0] + ',' + m[1] + ',' + m[2]
    rest =
      parseFloat(
        getComputedStyle(section).getPropertyValue('--grid-opacity')
      ) || 0.28
    if (!cell) return

    /* Same phase the CSS uses. Horizontal: background-position-x is
       calc(50% + phase), which resolves to (W - cell) / 2 + phase.
       Vertical: whatever phaseRows wrote to --grid-offset. */
    const phase =
      parseFloat(getComputedStyle(section).getPropertyValue('--grid-phase')) ||
      0
    const x0 = ((((W - cell) / 2 + phase) % cell) + cell) % cell
    const y0raw =
      parseFloat(section.style.getPropertyValue('--grid-offset')) || 0
    const y0 = ((y0raw % cell) + cell) % cell

    cols = Math.ceil((W - x0) / cell) + 3
    rows = Math.ceil((H - y0) / cell) + 3

    blocks = Array.prototype.map.call(
      section.querySelectorAll('[data-grid-exclude]'),
      (el) => {
        const b = el.getBoundingClientRect()
        return {
          l: b.left - r.left - 48,
          r: b.right - r.left + 48,
          t: b.top - r.top - 32,
          b: b.bottom - r.top + 32,
        }
      }
    )

    pts = []
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const bx = x0 + (i - 1) * cell
        const by = y0 + (j - 1) * cell
        /* the outer ring sits off-canvas and never moves, so visible lines
           cannot tear at the edges */
        const edge = i === 0 || j === 0 || i === cols - 1 || j === rows - 1
        pts.push({
          bx,
          by,
          x: bx,
          y: by,
          vx: 0,
          vy: 0,
          e: 0,
          lock: edge || inBlock(bx, by),
        })
      }
    }
  }

  function at(row, col) {
    return pts[row * cols + col]
  }

  function step() {
    const radius = cell * 2.6
    const live = active && !inBlock(px, py)
    let moving = false

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      let tx = p.bx,
        ty = p.by,
        influence = 0

      if (live && !p.lock) {
        const dx = p.bx - px,
          dy = p.by - py
        const d = Math.hypot(dx, dy)
        if (d < radius) {
          influence = 1 - d / radius
          const eased = influence * influence * (3 - 2 * influence)
          const safe = Math.max(d, 1)
          tx -= (dx / safe) * (cell * 0.16) * eased
          ty -= (dy / safe) * (cell * 0.16) * eased
          ty -= cell * 0.18 * eased * Math.cos(((p.bx - p.by) / cell) * 0.42)
        }
      }

      p.e += (influence - p.e) * 0.12

      /* critically damped - settles instead of wobbling */
      p.vx += (tx - p.x) * 0.13
      p.vy += (ty - p.y) * 0.13
      p.vx *= 0.68
      p.vy *= 0.68
      p.x += p.vx
      p.y += p.vy

      if (p.lock) {
        p.x += (p.bx - p.x) * 0.28
        p.y += (p.by - p.y) * 0.28
        p.e *= 0.82
      }

      if (p.e > 0.002 || Math.abs(p.vx) > 0.02 || Math.abs(p.vy) > 0.02)
        moving = true
    }
    return moving || live
  }

  function line(a, b) {
    const e = Math.max(a.e, b.e)
    ctx.strokeStyle =
      'rgba(' + rgb + ',' + (rest + e * (1 - rest) * 0.9).toFixed(3) + ')'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }

  function draw() {
    ctx.clearRect(0, 0, W, H)
    ctx.lineWidth = 1

    let r, c
    for (r = 0; r < rows; r++)
      for (c = 0; c < cols - 1; c++) line(at(r, c), at(r, c + 1))
    for (c = 0; c < cols; c++)
      for (r = 0; r < rows - 1; r++) line(at(r, c), at(r + 1, c))

    /* diagonals only where the grid is actually being pushed */
    for (r = 0; r < rows - 1; r++) {
      for (c = 0; c < cols - 1; c++) {
        const a = at(r, c),
          b = at(r, c + 1),
          d = at(r + 1, c + 1),
          e2 = at(r + 1, c)
        const en = Math.max(a.e, b.e, d.e, e2.e)
        if (en <= 0.2 || a.lock || b.lock || d.lock || e2.lock) continue

        const fwd = (r + c) % 2 === 0
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (en * 0.5).toFixed(3) + ')'
        ctx.beginPath()
        ctx.moveTo(fwd ? e2.x : a.x, fwd ? e2.y : a.y)
        ctx.lineTo(fwd ? b.x : d.x, fwd ? b.y : d.y)
        ctx.stroke()
      }
    }
  }

  function frame() {
    const busy = step()
    draw()
    if (busy && onScreen) {
      requestAnimationFrame(frame)
    } else {
      running = false
    }
  }

  function kick() {
    if (running || !onScreen) return
    running = true
    requestAnimationFrame(frame)
  }

  section.addEventListener('pointermove', (ev) => {
    const r = host.getBoundingClientRect()
    px = ev.clientX - r.left
    py = ev.clientY - r.top
    active = true
    kick()
  })
  section.addEventListener('pointerleave', () => {
    active = false
    kick()
  })

  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting
      if (onScreen) kick()
    }).observe(section)
  }

  section._gridRebuild = function () {
    build()
    draw()
  }
  build()
  draw()
}

/**
 * @param {HTMLElement[]} elements - All elements matching [data-grid]
 */
export default function (elements) {
  /* -- 1. continuous row phase ------------------------------------------- */
  /* Rows normally start at each section top, so a section whose height is not a
     whole number of cells leaves a short row at its bottom edge and the next
     section restarts a full row - the stub you see at a seam. Phasing each
     section from the PAGE top instead means the cut row is completed by the
     next section and the rhythm runs unbroken.
     Sections declaring data-grid-offset are skipped: their phase is deliberate,
     so a snapped element's top edge lands on a line. */
  function phaseRows() {
    elements.forEach((section) => {
      if (section.hasAttribute('data-grid-offset')) return
      const cell = cellOf(section)
      if (!cell) return

      const top = section.getBoundingClientRect().top + window.scrollY
      const value = (-(((top % cell) + cell) % cell)).toFixed(2) + 'px'

      if (section.style.getPropertyValue('--grid-offset') !== value) {
        section.style.setProperty('--grid-offset', value)
      }
    })
  }

  /* -- 2. snap card heights to whole cells ------------------------------- */
  function growCards() {
    document.querySelectorAll('[data-grid-snap][data-grow]').forEach((el) => {
      const section = el.closest('[data-grid]')
      const content = el.firstElementChild
      if (!section || !content) return

      const breathing = 32
      const declared = el.getAttribute('data-cols')
      const cols =
        declared === 'full' || declared === null
          ? parseFloat(
              getComputedStyle(section).getPropertyValue('--grid-divisor')
            )
          : parseFloat(declared)
      const min = parseFloat(el.getAttribute('data-rows')) || 3
      if (!cols) return

      const cell = el.getBoundingClientRect().width / cols
      if (!cell) return

      const needed = Math.ceil(
        (content.getBoundingClientRect().height + breathing) / cell
      )
      const rows = String(Math.max(min, needed))

      if (el.style.getPropertyValue('--snap-rows') !== rows) {
        el.style.setProperty('--snap-rows', rows)
      }
    })
  }

  /* -- run --------------------------------------------------------------- */
  /* Order matters: growing a card changes section heights, which changes every
     phase below it, which changes where the canvas lattice starts. */
  function update() {
    growCards()
    phaseRows()
    document.querySelectorAll('[data-grid-interactive]').forEach((s) => {
      if (s._gridRebuild) s._gridRebuild()
    })
  }

  growCards()
  phaseRows()
  document.querySelectorAll('[data-grid-interactive]').forEach(initInteractive)

  /* A ResizeObserver on body rather than the component's resize() hook: this
     has to react to content-driven height changes too (fonts landing, images
     decoding, a CMS list rendering), not just window resizes. The resize hook
     would miss all of those. */
  if (window.ResizeObserver) {
    new ResizeObserver(update).observe(document.body)
  } else {
    window.addEventListener('resize', update)
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(update)
  window.addEventListener('load', update)
}
