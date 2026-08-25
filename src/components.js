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
]
