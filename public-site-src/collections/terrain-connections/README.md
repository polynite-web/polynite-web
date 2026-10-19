# Terrain connections: recipes, not native building generators

`terrain_path.json`, `terrain_bridge.json` and `terrain_landing.json` compose the
existing context, height, expression, constraint, repeat, primitive, beam and
anchor operators. No native operator, rendering branch or MCP tool is added.
The existing WebGPU v0315 can execute them after capability verification.

`author_terrain_connections.cjs` is an offline data authoring helper. Its small
functions produce bounded JSON expressions; it is never evaluated by the engine
or shipped as executable recipe code. To change the composition, edit its data
construction functions and regenerate the JSON/book entries, then run the real
native and browser tests before publishing new immutable example versions.

## Bind and adjust

Read `recipe:structures`, then only `structures.terrain_path`,
`structures.terrain_bridge` or `structures.terrain_landing` through operation help.
Check `commands.recipe_terrain`; discover `architecture.operators` for context,
spatial and let. Bind `ground` to an enabled infinite terrain or a supported cube.
Bind `left` and `right` to real construction anchors or cube top points.

A landing exposes centre `top000000`, end edges `in000000` / `out000000`
and lateral edge `side000000`; use edge anchors to meet the slab boundary.
Connections expose `left000000`, `rght000000`
and stable `markNNN000` stations. Inspect the chosen source instead of guessing
an arbitrary component ID. Estimate first, then apply to the current scene with
a fresh action ID. Do not replace a user's scene to demonstrate the recipe.

**Adjust > path/bridge/approach > recipe controls**, or **Scene settings > Living
architecture**, exposes width, segments, thickness, clearance, bend, arch,
rail_height, post_width and max_grade. Landing lift/width/depth change dependent
connections. A new style changes materials/profiles/composition in data.

## Geometry policy and limits

- A sampled station uses the maximum terrain height at the centre and both
  tangent-oriented edges, plus deck thickness and clearance.
- The path follows this ground profile. Fourth-power end influences smoothly
  connect it to raised construction anchors. Small supports reach the ground.
- The bridge takes the maximum of the ground profile and an arched interpolation
  of its end anchors. Deck, rails and posts use that same sampled profile.
- Curvature is an explicit sine offset from the end chord. Multiple connections
  through reusable landings make longer routes or corners. This does not search
  for an obstacle-free route or perform arbitrary mesh collision/earthworks.
- Limits: 0.5..20 m horizontal span, 8..20 segments, 0.4..2.4 m width, 23 anchors
  at maximum detail; existing 512-part and expression budgets remain enforced.
- `max_grade` checks **end-to-end** rise/span, not every local segment. Sampled
  clearance is not a continuous collision guarantee between stations. Increase
  samples and inspect bends/steep relief; use explicit intermediate landings.
- End tops must be at least sampled ground + thickness + clearance. Invalid
  spans, buried ends, missing sources and cycles reject transactionally. The UI
  retains the old valid value; source edits retain overrides and locks.
- Editing adapts declared dependants. Films use explicit transactional terrain
  or architecture cues, not a hidden per-frame topology rebuild.

`test_terrain_connections_live.mjs <proof-directory> [--record]` preserves the
idle live document and camera, tests the two studies and complete Japanese garden
with variants, rejection, dependency edits, locks, saved input and real films.
No source compilation, app restart or OS window change is needed for recipe data.
The website/browser uses the common `connection` invariant in `recipe-checks.js`.

Keep actual MP4/PNG/scene proofs together. Public examples have versioned scene
and recipe hashes; preserve old bytes when revising an example.
