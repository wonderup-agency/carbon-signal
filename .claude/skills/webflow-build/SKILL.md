---
name: webflow-build
description: Conventions, guardrails, and MCP-specific gotchas for building and editing Webflow sites at a professional standard — semantics, accessibility, performance, componentization, CMS architecture, and safe write discipline. Framework-agnostic: works with Client-First, Mast, or any in-house system. Use this skill for ANY Webflow work — building pages or sections, creating or refactoring components, naming or reorganizing classes, styling via variables, setting up or auditing CMS collections, fixing hover/focus/variant behavior, writing custom code for a Webflow site, running pre-launch QA, or any task that touches the Webflow MCP or Data API. Trigger it even when the request sounds small ("rename these classes", "add a section", "why isn't this hover working") — the MCP quirks documented here cause silent failures that look like success.
---

# Webflow Build

## 0. Communication contract — read first

This skill exists to keep momentum. Long explanations break flow state.

- **Be brief.** Answer in the fewest words that fully answer. No preamble, no recap of the request, no summary of what you just did beyond one line.
- **Lead with the answer**, then at most 2–3 lines of "why" if the why changes a decision.
- **No postambles.** After a write or a file, stop. Don't offer three follow-ups.
- **Bullets over prose** for anything with more than two parts. No tables unless comparing ≥3 things on ≥3 axes.
- **Flag uncertainty in one clause**, not a paragraph. "Not sure X survives publish — verifying" beats a disclaimer block.
- **Don't narrate tool calls.** Call them, report the outcome.
- **Don't act unless asked.** Diagnose, propose, wait. A read is free; a write is not. If the ask is ambiguous between "tell me" and "do it", assume "tell me."
- **When corrected, correct and move on.** No apology spirals.

## 1. Framework agnosticism

The framework is a decision the project already made. Detect it, don't impose it.

**Detect before styling.** Read the style guide page, the class list, or an existing section. Signals:
- `u-` utilities, `cc-` combos, `col-lg-*`, Build Mode components → Mast
- `_` folder separator, `padding-global`, `container-large`, `is-*` combos → Client-First
- Neither → in-house; infer the pattern from what's there and match it

**If unclear, ask in one line.** Never guess between frameworks — mixing conventions is more expensive to undo than the 10 seconds of asking.

### Project overrides beat this document

Everything below — semantics, component naming, prop groups, class patterns, asset folders — is the **default**, not a mandate. A project that already does it differently wins.

- **Read before you write.** Open an existing section/component in the project and match its conventions: how components are named, how props are grouped and ordered, class patterns, folder structure. What's there is the spec.
- **Precedence:** explicit instruction for this project > the project's existing pattern > this document > your own preference. Never the other way around.
- **A conflict is a question, not a decision.** If the project's pattern contradicts something here, say so in one line and ask which to follow. Don't silently "fix" the project toward this document, and don't silently abandon a rule here because one section deviates.
- **Half-migrated is the trap.** If a project is mid-change between conventions, ask which side new work should land on before building. Two live conventions is worse than either one.
- **One deviating instance ≠ a project convention.** Three sections one way and one the other means the one is the mistake. Check more than a single example before concluding the project does it differently.
- Once a project-specific convention is established in a conversation, hold it for the rest of that work without re-asking.

**These hold regardless of framework:**
- Consistency with what exists beats correctness in the abstract. A project half-migrated to your preferred convention is worse than one fully in its own.
- One base class carries the shared style; modifiers/combos carry the difference. Never duplicate a base style into a second class.
- Never ship auto-generated names: `Div Block 7`, `Heading 3`, or the ` 2` / ` 30` / ` 38` suffix duplicates that paste and third-party embeds create. Reassign to the real class and delete the orphan.
- No raw values where a token exists. Colors, spacing, radii, typography → variables. Sizing in `rem`, not `px` (accessibility: respects browser font scaling). Hairlines and borders can stay `px`.
- Class names describe the thing, not the look. `card_meta`, not `small-gray-text`.
- **Always reuse the existing text components / type classes before creating anything new.** Every framework ships a typography layer — heading styles, body sizes, eyebrow/label, rich text. Use it. A new class for text is a last resort, and if one is genuinely needed it extends the existing component rather than restating its properties.

## 2. Structure and semantics

- One `<main>` per page, wrapping everything between the navbar and footer.
- **Navbar is `<nav>`. The hero section is `<header>`.** Every other content block is `<section>`. `<footer>` for the site footer. This is how both MAST and Client-First handle it, and it's the better read for search engines — the hero is the page's introductory content, not the site's navigation chrome.
- One `<h1>` per page. Never skip heading levels. Visual size is a class, not a tag: use `h2` with a display-size class rather than an `h1` for looks.
- Lists that are lists get `<ul>`/`<li>`. Nav links live in a list.
- Buttons that act are `<button>`; things that navigate are links. Don't put a link inside a link.
- Landmarks over div soup: `<nav>`, `<aside>`, `<figure>`/`<figcaption>` where they apply.

## 3. Componentization

**Default: componentize everything.** Sections, cards, CTAs, nav, footer, text blocks — even single-use sections. Componentizing is what makes Build Mode usable for the client and keeps every edit surface in one place. Don't ask whether something "repeats enough."

**Variants are the thing to be selective about.** Add a variant only when the difference is a genuine styling state (primary/secondary, light/dark, small). If two instances differ *structurally*, that's a separate component or a slot — not a fifth variant. Variant sprawl is the failure mode, not component count.

**Rules:**
- Props for content that changes per instance (text, image, link, visibility toggles). Variants for styling states only.
- Name variants for intent, not appearance: `is-secondary`, not `is-white`.
- Slots for structurally variable children instead of a boolean prop per possible child.
- Global components (nav, footer) get their own edit context — element work inside them requires opening the component, and their children won't show up in a plain page-level element query.
- Before creating a component, search existing ones. Agencies accumulate three near-identical CTAs fast.
- Variant naming and its compiled attribute are **not** the same string. Webflow emits `data-wf--{component-slug}--variant`, and the slug is per-component — `cta-primary` and `cta-primary-small` are different attributes. Never assume the attribute from the component's display name; read it off the published HTML/CSS.

### Component naming

Name components so the layer/Navigator label tells you what the thing *is*, not that it's a component. `Section / Horizontal Tabs`, `Section / Quote Carousel`, `CTA / Primary`. Never leave several layers reading just "Section" because the section happens to be prop-driven — a marketing person scanning Build Mode needs to know which section they're in without clicking into it.

### Prop grouping convention

Group props so Build Mode reads like a form, not a dump. MAST's default of everything under "Settings" / "Advanced" is too coarse for section-level components — use explicit, named groups instead:

- **Padding** — top and bottom padding only
- **Main Properties** — the section's own content. **Section ID goes first**, always, so in-page linking is the first thing anyone sees and it never gets buried under copy fields. Then eyebrow, section title, section paragraph, primary CTA.
- **One group per repeated element** — `Tab 1`, `Tab 2`, `Card 1`, `Card 2`, `Stat 1`… each collapsed, holding that item's own props
- **Advanced** — MAST's own grouping style still earns its place here: dev-oriented props that are useful to expose but that a marketing person should never need to touch (theme, container width, visibility, tag override, animation toggles, custom attributes). Keep it last and collapsed. The rule is about audience, not about avoiding MAST's pattern — marketing-facing props get explicit named groups, dev-facing props can live under Settings/Advanced as MAST does it.

Order them top-down in the order someone editing the section would work through it: spacing, then the section's own copy, then its children, then dev controls. Skip a group entirely if it doesn't apply rather than shipping an empty one.

## 4. Accessibility

Non-negotiable, and cheaper to do during the build than in QA.

- **Focus states on everything interactive.** Never `outline: none` without a replacement. Focus styling must be visible against its background, and should use `:focus-visible` for keyboard-only affordance.
- **Contrast:** 4.5:1 body text, 3:1 large text and UI boundaries. Check the actual token pairs, not the design's vibe.
- **Alt text** on every content image; empty `alt=""` on decorative ones. CMS images need an alt field or a sensible binding.
- **Full-card / overlay links:** the pattern is an absolutely-positioned link covering the parent, with a visually-hidden (`sr-only`) child carrying the accessible label — `.u-link-cover` in MAST, `.item-link` in CF, or whatever the project's equivalent is. Never wrap the whole card in an anchor, and never rely on the visible heading alone for the accessible name. Know the trade-off: that overlay sits above siblings in z-order, so any `:hover` on a sibling underneath **will stop firing**. Move the hover to the shared parent (`.card:hover .card_bg`) or drive it from the link. This is a recurring source of "the hover broke and nothing changed" bugs.
- **Forms:** real `<label>` bound to the input. Placeholder is not a label. Error messages must be text, not color alone. Required fields marked in text.
- **Motion:** honor `prefers-reduced-motion` — kill or shorten scroll-driven and parallax effects. Nothing essential may depend on hover alone (touch devices have none).
- **Keyboard:** tab order follows visual order; modals and mobile nav trap focus and close on Escape; skip-to-content link on every page.
- **Don't remove semantics for styling convenience.** If styling forces a non-semantic element, say so and note the cost rather than silently degrading.

## 5. Performance

- Images: correct dimensions, WebP/AVIF where possible, `loading="lazy"` below the fold, **eager + high priority** for the LCP hero image. Never lazy-load the hero.
- Fonts: subset, `woff2`, 2 families max, `font-display: swap`, preload the one used above the fold.
- Third-party JS is the biggest lever. Every library needs a justification. Prefer native Webflow interactions or the GSAP that Webflow already ships over adding a second animation runtime. Self-host what stays. Defer anything non-critical.
- **On projects WonderUp starts, custom JS/CSS ships from the WonderUp repo**, not pasted inline. Author it there, load the built bundle, and keep the in-Designer embeds to the loader plus anything genuinely project-specific. Use the dev extension for cache-busting while working in the Designer. Inline embeds are for inherited projects or one-off client-owned snippets.
- Whatever isn't in the repo goes in one place per scope (site-wide vs page), commented with what it does and why. No orphan snippets.
- One `<canvas>`/WebGL/Spline embed per page maximum, and only above-the-fold if it *is* the fold. Cap `devicePixelRatio` at 2.
- Prefer `transform`/`opacity` for animation. Avoid animating layout properties.
- Fluid type via `clamp()` or `max()` with a floor of `0.75rem` so scaling never drops below readable — and remember a root floor doesn't protect descendants sized in `rem`.
- Set a target and measure: Lighthouse mobile ≥ 90 for perf and 100 for a11y before handoff. Mobile is what Google scores.

## 6. Project organization

- Style guide page exists, is current, and is where tokens live. It's the contract for the whole build.
- **Assets panel is foldered on every project:** `Icons`, `Logos`, `Regular Images`, `Visuals`. Nothing stays in "No folder" — file it on upload, not at QA. Same four folders across projects so anyone can find anything without asking.
- Page folders mirror URL structure. Archive folder for superseded pages — and set them to **Draft**, not published, so empty shells don't get indexed.
- Never archive: style guide, components page, CMS collection template pages, 404, password, and system/account pages.
- SEO title/meta templates and OG defaults set at project level, not page-by-page.
- Form notifications and spam protection configured before launch, not after the first spam wave.

## 7. CMS architecture

- Model the schema before building templates. Changing field types later breaks bindings.
- Decide slug structure early; it's an SEO commitment. Plan redirects if slugs change.
- Reference vs multi-reference vs option: option fields for fixed short taxonomies, reference for anything the client will manage.
- Every collection list needs an **empty state** and a **conditional visibility** pass for optional fields. Missing images and empty rich text are the two most common launch bugs.
- Rich text from imports is almost never clean: flattened heading levels break TOC nesting, figures duplicate, and body content ends up in the wrong field. Audit against the source before trusting it.
- Know the platform ceilings (nested collection list item caps, collection and field limits per plan) and design around them rather than discovering them at build time.

## 8. Webflow MCP — operational reality

Read this section before any MCP write. These are confirmed behaviors, not theory.

**Connection**
- The Designer tab must be **open and the active foreground window**. Backgrounded tabs cause silent timeouts that return no data — not an error. If a query returns nothing unexpectedly, check the tab before debugging your query.
- Tools are gated behind `get_more_tools`. Request the categories you need (CMS, PAGES, etc.) **at session start** with a substantive brief describing the workflow, what you've tried, and what's blocking. One-line briefs return nothing.
- Known server-side bug: `data_cms_tool` and `data_pages_tool` can stop being advertised mid-session after a reconnection, and `get_more_tools` will claim it already showed everything. No in-session fix — start a fresh chat.
- Being "connected" ≠ having scope. CMS tools only appear if the connector was authorized with `cms:read`/`cms:write`, and OAuth grants can be scoped to a single workspace, so `list_sites` returning fewer sites than expected is a scoping problem, not a connection failure.

**Writes that lie**
- `"success"` means the call was accepted, not that the change persisted. **Verify after every structural write.**
- Form-typed elements (`<label>`, `<input>`, sometimes `<button>`) created outside a real `<form>` wrapper are **silently purged** by Webflow's validation pass moments later. Create the form block first, then children.
- `update_style` with `breakpoint_id: "main"` passed explicitly is a silent no-op. **Omit `breakpoint_id`** for main; specify it only for `small` / `medium` / `tiny`.
- `variable_as_value` expects `variable-{uuid}` — with the prefix, not the bare UUID.

**Reads that mislead**
- `query_elements` with `element_filter: {style: "..."}` is unreliable for class names containing spaces. Use a substring match instead.
- For verifying compiled selectors, variant attributes, and which classes are actually in use, **curl the published CSS/HTML** from the CDN. It's more trustworthy than style queries.
- Component reads need `includeProps: true, includeVariants: true` to return variant IDs and display names. Per-variant overrides come from the variant styles action, keyed by variant ID + pseudo state.

**Hard limits — don't try to work around these**
- Element operations are scoped to the **current active page**. There is no cross-page copy and no page duplication. Rebuilding a page's section tree element-by-element loses styles, interactions, CMS bindings, and component identity. Say so and hand the copy/paste step back to the human.
- HtmlEmbed inner content (your custom CSS/JS payloads) **cannot be read or written** via MCP. Attributes and styles yes, embed contents no. Those edits are Designer-manual — write the CSS out for the human to paste.
- CMS `update` via MCP requires resending the **entire** field, with no diff. For large rich-text bodies containing exact data, that's a corruption risk.

**When to drop to the Data API instead**
Use the Data API (`api.webflow.com/v2`, site token, 60 req/min standard) for: bulk CMS writes, partial field updates (`PATCH` accepts only the fields being changed plus `name` and `slug`), byte-identical read-back verification before publish, batch publishing (`POST /items/publish` with `itemIds`), redirect imports, and anything where MCP's full-resend model risks silent data loss.

## 9. Write discipline

- Read → diagnose → propose → **wait** → write. The proposal is usually the deliverable.
- One revertible change at a time on live pages. No bulk renames or mass deletions without an explicit go-ahead on the exact list.
- Before deleting: confirm nothing references it. Before renaming: confirm nothing keys off the name — third-party integrations often bind to data attributes, so class renames are safe there but never assume it.
- If a change is destructive and hard to revert, say that in one line and stop.
- When something goes wrong, revert first, explain second.

## 10. Pre-handoff pass

Run this, report only failures:

- Responsive at all four breakpoints; no horizontal scroll; no orphaned breakpoint-only styles
- Keyboard-only walkthrough of every page; visible focus throughout
- Contrast check on final token pairs
- All links resolve; forms submit and notify; CMS empty and max-length states render
- Alt text present; heading order valid; one `<h1>` per page
- Lighthouse mobile: perf ≥ 90, a11y 100
- 404 and password pages styled; redirects in place; sitemap and robots correct; drafts still drafted
- No auto-generated class names, no duplicate-suffix classes, no unused styles
- Custom code commented and consolidated
