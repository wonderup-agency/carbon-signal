---
name: figma-to-webflow-variables
description: Migrate a Figma styleguide (colors + typography + spacing tokens) into a Webflow site's Variables via the Webflow MCP, without creating duplicates. Reads the Figma frame, maps tokens onto the site's existing variable collections (Client-First / starter aware), confirms the mapping, then renames/updates/creates variables. Use when the user wants to push Figma design tokens/variables into a Webflow project.
---

# Figma → Webflow variables migration

Reusable workflow to take a Figma **styleguide** (design tokens) and load it into a Webflow site's **Variables** through the Webflow MCP. Project-agnostic — works on any Figma file + any Webflow site.

The Figma frame is the **source of truth**. Never invent values. The golden rule: **read the site's existing variables first and modify them in place — do NOT create duplicates.** Most Webflow projects start from a Client-First starter (BYQ, Lumos, etc.) whose variable collections already exist.

## Inputs to gather first

1. **Figma styleguide URL** — `figma.com/design/:fileKey/:fileName?node-id=A-B`. The node should point at the styleguide / tokens frame. Parse `fileKey` and `nodeId` (convert `A-B` → `A:B`).
2. **Target Webflow site** — don't assume it. List sites and confirm with the user which one.
3. **Scope** — colors? typography? spacing? Confirm which token groups to migrate.

If any is missing, ask before proceeding.

## Steps

### 1. Read the Figma styleguide
- `mcp__claude_ai_Figma__get_variable_defs` (fileKey + nodeId) — the token list (colors, font families/sizes/weights/line-heights/letter-spacing, spacing).
- `mcp__claude_ai_Figma__get_screenshot` — download and view the styleguide so naming/intent is clear.
- Convert px → REM at base **1rem = 16px** unless told otherwise. Letter-spacing given as `%` → `em` (e.g. −2% = `-0.02em`).
- **Present a compact token table and STOP for the user to validate** before touching Webflow.

### 2. Connect the Webflow MCP
- Call `mcp__claude_ai_Webflow__webflow_guide_tool` once (required before other Webflow tools).
- `data_sites_tool > list_sites` — show the list, confirm the target `siteId`. **Never assume it.**
- If the target site is missing: the OAuth grant doesn't include its workspace. Tell the user to **disconnect and re-connect** Webflow in `/mcp` and, on the consent screen, **select the correct workspace** (a quick "reauthenticate" reuses the old grant and won't help). If still missing, they may need a Designer-access invite to that workspace.
- Designer variable tools (`variable_tool`) require the **Webflow Designer open**, the **MCP app running**, and the **tab foregrounded** — otherwise they fail with "Unable to connect to Webflow Designer" (the error returns a launch link to share with the user). All `variable_tool` calls need `siteId`.

### 3. Read existing variables (avoid duplicates)
- `variable_tool > get_variable_collections {query:"all"}` — note collection IDs and **modes** (responsive breakpoints often exist as modes: Tablet / Mobile L / Mobile).
- `variable_tool > get_variables {variable_collection_id, include_all_modes:true}` for each relevant collection — capture every variable's `id`, `name`, `cssName`, `type`, and per-mode values.

### 4. Build the mapping and CONFIRM
Map Figma tokens onto the existing variables. Scales rarely match 1:1 — surface the decisions and let the user choose (use AskUserQuestion). Common decisions:
- **Colors:** the starter's base palette names (e.g. `--base--blue*`) won't match the brand. Offer: (a) **rename + revalue** the base variables to the brand palette (clean), or (b) keep names, only change values (fast but misleading). Renaming is safe — semantic tokens (`--background-color--*`, `--text-color--*`, etc.) reference by **variable ID**, so they keep pointing to the renamed variable and auto-resolve to the new color. Renaming DOES change the `cssName` (`--base--blue` → `--base--gold`), so hand-written CSS using the old name breaks.
- **Type scale:** if Figma has more steps than the starter's h1–h6, map the closest sizes and create extra variables for the outliers (e.g. a display/`stats` size).
- **Body sizes** usually already match the starter (16/18/20/14/12 + lh 1.5) — verify before changing.

### 5. Apply the changes
Batch many actions in a single `variable_tool` call (the `actions` array). Use the right action per type:
- `rename_variable` then `update_color_variable` (revalue).
- `create_color_variable` for new ones (e.g. a missing `grey-line`).
- `update_font_family_variable`, `update_size_variable`, `update_number_variable`, `update_percentage_variable`.

**⚠️ Responsive modes:** if a property (weight, letter-spacing, family, line-height) is set **per mode**, updating only the base value leaves the mode overrides stale (e.g. headings stay weight 700 on tablet). For any property that must be consistent across breakpoints, update the **base value AND every mode** (`mode_id`). Sizes that are intentionally responsive (h1 smaller on mobile) can be left per-mode — confirm with the user; the Figma styleguide is usually desktop-only.

See `reference.md` for exact value formats per variable type.

### 6. Verify and report
- Re-read the changed variables (or trust the per-action success responses) and summarize: what was renamed, revalued, created.
- List the **resulting semantic resolutions** (which `background-*`/`text-*`/`border-*` tokens now resolve to which brand color) so the user can tweak.
- **Caveats to always flag:**
  - Fonts must be **uploaded/enabled in Site Settings → Fonts** or Webflow falls back — the variable only stores the family name.
  - Renamed `cssName`s break old hand-written CSS references.
  - Low-contrast brand colors on a focus-state variable hurt a11y.
  - Responsive (tablet/mobile) sizes were left as starter defaults unless a responsive scale was provided.

## Hard rules
- Read before write — never create a variable that already exists under another name; modify in place.
- Confirm the site and the mapping before any write. Writes to a live site are outward-facing.
- px → rem at 1rem = 16px; letter-spacing % → em.
- Keep the starter's variable structure and naming convention (Client-First) intact.
