import './styles/base.css'
import './styles/pillars.css'
import './styles/explore.css'

/*
Site-wide setup.

The imports above are stylesheet-only concerns migrated out of Webflow's head
custom code. They live here rather than on a component because Rollup extracts
all CSS into a single dist/styles.css at build time — so the rules apply on
every page regardless of which component JS happens to load.

pillars.css keys off data-pillar-state. The script that sets that attribute is
still an HTML Embed on the Webflow canvas and has not been migrated yet.
*/
export default function () {}
