// --------------------------------------------------
// Component Registry
// --------------------------------------------------
// Each entry maps a data-component attribute to a lazy import.
// Components only load when their selector exists on the page.
//
// 2 ways to add a component:
//
// 1. Ask Claude  → "create a component called calculator"
// 2. Terminal    → npm run create-component -- calculator
//
// Both scaffold the file and add an entry here automatically.
// --------------------------------------------------

export default [
  // Registered on data-play-on-scroll rather than a data-component value
  // because that attribute is both the opt-in and the config: it says which
  // Rive elements are gated on visibility and whether each one replays. A
  // second attribute to carry the same decision would be markup that can
  // disagree with itself.
  {
    selector: '[data-play-on-scroll]',
    importFn: () => import('./components/rive-scroll.js'),
  },
  {
    selector: "[data-component='nav']",
    importFn: () => import('./components/nav.js'),
  },
  // Triggered by the existing data-grid attribute rather than a new
  // data-component one: the grid script operates across every grid section on
  // the page at once, so the sections it already marks up are the selector.
  {
    selector: '[data-grid]',
    importFn: () => import('./components/bg-grid.js'),
  },
  // Same reasoning as bg-grid: the accordion groups already mark themselves
  // with data-pillars, so that attribute is the selector.
  {
    selector: '[data-pillars]',
    importFn: () => import('./components/pillars.js'),
  },
  // Registered on the .light-block class rather than a data-component
  // attribute, because that class is already the contract: the CUSTOM STYLES
  // rules are keyed off it, and the JS has to drive exactly the elements those
  // rules match. Keying both off one selector means they cannot drift — a new
  // light block anywhere on the site is animated by virtue of being styled.
  {
    selector: '.light-block',
    importFn: () => import('./components/light-block.js'),
  },
  // The Technology video card's scroll bleed. Unlike light-block this one does
  // take a data-component attribute: the card lives inside the Section / Video
  // Highlight component, so the attribute and the class it is styled by travel
  // together by construction and cannot drift the way hand-placed markup can.
  {
    selector: "[data-component='video-highlight']",
    importFn: () => import('./components/video-highlight.js'),
  },
  // Every slider on the site, configured from data attributes. Registered on
  // data-slider rather than a data-component value so the same markup that
  // configures it also triggers it. Carries Swiper, so this chunk is the
  // heaviest — it only loads on pages that actually have a slider.
  {
    selector: '[data-slider]',
    importFn: () => import('./components/slider.js'),
  },
]
