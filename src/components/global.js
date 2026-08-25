import './styles/base.css'

/*
Site-wide setup.

base.css is the one stylesheet still in the bundle. It hides the authoring-only
Webflow Style Guide component, which is a specific need rather than component
appearance — and it has to stay out of the canvas embeds, since those live
inside the very component it hides.

Everything else is a named embed in the Global / Styles component on the Webflow
canvas: BG Grid, Pillars CSS, Nav CSS. Bundled CSS never renders in the
Designer. See CONVENTIONS.md.
*/
export default function () {}
