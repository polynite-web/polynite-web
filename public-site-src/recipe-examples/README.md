# Recipes & operators

Public route: https://explore.polynite.io/docs/recipes/

One source, three consumers: human pages, progressive JSON/Markdown for assistants,
and regression fixtures. `catalog.json` contains editorial content, compatibility,
operator tags and executable verification expectations. Each entry owns immutable
`vN.scene` and `vN.recipes.json` files with SHA256 hashes. Recipes are extracted
from the actual exported film; never substitute a later state or generic template.

Add an entry by copying this structure and using the smallest existing check type
that expresses its behaviour. Add a shared check only for a new reusable invariant.
Native operator IDs must come from discovery. No native function per example.
Change scene/recipe bytes only under a new version. Preserve published versions.
Large catalogues should paginate their summary index; detailed programs remain
separate files. Do not embed every recipe into MCP tool schemas or every prompt.

Build: `node build_public_site.cjs`, then
`node build_explore_site.cjs --output <existing Worker site directory>`.
Both call `build_recipe_examples.cjs`; do not edit generated HTML.

Integrity checks: `node test_recipe_examples.cjs [Worker site directory]`.
Live regression requires an idle desktop and explicit endpoint/pinned-scene path:

```powershell
node test_recipe_examples_live.mjs --endpoint http://127.0.0.1:8790/mcp --pin D:/dev/wnex/wk/emp/src/mesh/meshopt/scene/m/arunangshubanerjee-g-clef-1600.glb.json --report D:/dev/mcp-production-dry-run/recipe-examples-result.json
```

Choose the actual current model pin, not the example path above blindly. Preserve
user edits, never interrupt exports or change the OS window. Report data checks
separately from visual QA. Live regression loads exact public fixtures, checks
motion/loop closure, support heights and live path geometry/corridor clearance,
then restores the scene/camera and pin even on failure. Do not run concurrently
with other scene editing tests or the user's scene changes.

Desktop verification is explicit. Browser support is scoped to the actual tested
engine and browser; a successful import alone does not prove playback or editing.
The Open & test action uses `/examples/view.html?id=...`, an isolated MEMFS viewer.
No browsing or playback touches the visitor's saved scene. Save downloads a copy;
Reset explicitly returns to the immutable reference. A prompt is a creative
interpretation; versioned scene/recipes are the reproduction reference.

## Showcase and the shared player

`public-site-src/showcase.json` selects existing Atelier scenes or recipe IDs.
`build_experiences.cjs` merges those references into a compact common registry,
then copies exact scene bytes into versioned public data files. Add a selection
here rather than creating another engine generator. Category, atmosphere, tags,
prompt and media drive the editorial page and filters. The player discovers
parameter controls from the recipe schema; no controls branch on an example ID.

Run `node test_experiences.cjs` after building. For a browser regression, open the
player with `&qa=1` and click Check example; it uses the same shared invariants as
the desktop fixtures and restores its temporary document afterward. Keep the
browser tab visible during animation tests. Check actual pixels as well as data.

## Data collections and variants

The Japanese garden adds four focused studies and one composed scene, each with
two named variants. See [its authoring guide](../collections/japanese-garden/README.md).
The generic collection composer resolves shared recipe JSON and parameter patches.
The native exporter produces the exact public references; an importer refuses
unverified runs and changes to an already versioned reference.

A variant is a versioned complete scene with a SHA256 hash and a real rendered
poster. It is loaded into the same isolated player. Reset restores the selected
variant; Save keeps current edits. Failed loading retains the current copy;
variant changes refuse to interrupt a recording. Browser and native regression
runners share `recipe-checks.js`; no test dispatch depends on a scene ID.

For assistants, read the compact collection index first, then only the relevant
recipe or scene detail. The MCP recipe book links collections without embedding
every program into its tool definitions. Variants, palettes, canopy styles and
building proportions are data; the existing WebGPU operators execute them.
