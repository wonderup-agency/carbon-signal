/*
Component: nav
Webflow attribute: data-component="nav"

No stylesheet import: the scrolled-state rules live in the "Nav CSS" embed in
the Global / Styles component on the Webflow canvas, so they render in the
Designer. See CONVENTIONS.md — CSS defaults to Webflow, not the bundle.
*/

// Distance in px before the nav switches to its scrolled state.
const threshold = 100

/**
 * @param {HTMLElement[]} elements - All elements matching [data-component='nav']
 */
export default function (elements) {
  const update = () => {
    const scrolled = window.scrollY > threshold
    elements.forEach((nav) =>
      nav.setAttribute('data-scrolled', scrolled ? 'true' : 'false')
    )
  }

  // Run once up front so a refresh partway down the page starts in the
  // correct state rather than flashing the resting one.
  update()

  window.addEventListener('scroll', update, { passive: true })
}
