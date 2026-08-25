/*
Component: nav
Webflow attribute: data-component="nav"
*/

import './styles/nav.css'

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
