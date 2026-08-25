import './styles/base.css'
import './styles/explore.css'

/*
Site-wide setup.

The imports above are stylesheet-only concerns migrated out of Webflow's head
custom code. They live here rather than on a component because Rollup extracts
all CSS into a single dist/styles.css at build time — so the rules apply on
every page regardless of which component JS happens to load.

pillars.css is not here — it belongs to the pillars component, which imports
it directly. Rollup extracts all CSS to one dist/styles.css regardless of which
chunk imports it, so the rules still apply on every page.
*/
export default function () {}
