# Webflow `variable_tool` — value formats & call shapes

All actions go in the `actions[]` array of a single `variable_tool` call. Every call needs top-level `siteId` and `context`. Each action needs a `label`.

## Reads
```jsonc
// list collections + their modes
{ "label": "cols", "get_variable_collections": { "query": "all" } }

// list variables in a collection (include responsive modes)
{ "label": "vars", "get_variables": {
    "variable_collection_id": "collection-…",
    "include_all_modes": true } }
```

## Value object (one of three, never combine)
- `static_value` — a typed literal (shape depends on variable type, below).
- `existing_variable_id` — alias this variable to another (e.g. focus = brand accent).
- `custom_value` — raw CSS expression string: `"clamp(1rem, 2vw, 1.5rem)"`, `"color-mix(in srgb, …)"`.

## Per-type `static_value` shapes
| Type | create / update action | static_value shape |
|---|---|---|
| Color | `create_color_variable` / `update_color_variable` | `"#FBD07C"` (hex string) |
| Size | `create_size_variable` / `update_size_variable` | `{ "value": 3.375, "unit": "rem" }` (units: `rem`, `px`, `em`, `%`, …) |
| Number | `create_number_variable` / `update_number_variable` | `1.5` (e.g. line-height, font-weight `400`) |
| Percentage | `create_percentage_variable` / `update_percentage_variable` | `50` (number = %) |
| FontFamily | `create_font_family_variable` / `update_font_family_variable` | `"Inter"` (family name as stored in Site Fonts) |

## Update (base value)
```jsonc
{ "label": "h1size", "update_size_variable": {
    "variable_collection_id": "collection-…",
    "variable_id": "variable-…",
    "value": { "static_value": { "value": 3.375, "unit": "rem" } } } }
```

## Update a specific responsive mode
Add `mode_id` (get mode IDs from `get_variable_collections`). To keep a property consistent across breakpoints, repeat the update for the base (no `mode_id`) **and** each mode.
```jsonc
{ "label": "h1w-tablet", "update_number_variable": {
    "variable_collection_id": "collection-…",
    "variable_id": "variable-…",
    "mode_id": "mode-…",
    "value": { "static_value": 400 } } }
```

## Create
```jsonc
{ "label": "greyline", "create_color_variable": {
    "variable_collection_id": "collection-…",
    "variable_name": "Base/grey line",   // "/" creates a group folder
    "value": { "static_value": "#E4E2DD" } } }
```

## Rename (keeps the variable ID; aliases survive; cssName changes)
```jsonc
{ "label": "rn", "rename_variable": {
    "variable_collection_id": "collection-…",
    "variable_id": "variable-…",
    "new_name": "Base/gold" } }
```

## Other actions
- `delete_variable` — destructive; confirm with the user first.
- `create_variable_collection`, `create_variable_mode` — when the structure is missing.
- `set_style_variable_mode` / `get_style_variable_modes` / `remove_style_variable_mode` — bind a collection's mode to a style/breakpoint/variant.

## Gotchas learned
- Aliasing (`existing_variable_id`) can fail with a generic error on some variables (e.g. a System color) — fall back to a `static_value`.
- A variable's `value` field is the **base/default (desktop)**; `modeValues[]` are the per-breakpoint overrides. Both can hold independent values.
- Renaming a `--base--*` color does NOT rewire the semantic tokens that alias it — they follow by ID. Good for revalue, but if you want different semantics, update the alias target explicitly.
- Letter-spacing variables are usually type **Size** with unit `em` (not Percentage).
