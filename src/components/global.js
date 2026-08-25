import './styles/base.css'
import './styles/explore.css'

/*
Site-wide setup.

The imports above are stylesheet-only concerns migrated out of Webflow's head
custom code. They live here rather than on a component because Rollup extracts
all CSS into a single dist/styles.css at build time — so the rules apply on
every page regardless of which component JS happens to load.

pillars.css is not here, and is not in the bundle at all: it lives in the
"Pillars CSS" embed in the Global / Styles component on the Webflow canvas, so
the accordion's open/closed states render in the Designer. Same split as
bg-grid, whose static lattice CSS is a canvas embed for the same reason.
*/
export default function () {}
