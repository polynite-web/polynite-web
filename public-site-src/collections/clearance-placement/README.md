# Explicit reservations and editable placement

The native `footprint` operator declares a named horizontal rectangle. It emits
no render mesh and shares the existing 24-anchor budget. Bind it through
`context:{name,instance,anchor}` and reuse `distance`. Check
`commands.recipe_footprints`; older engines cannot execute this composition.

`author_clearance_placement.cjs` is an offline authoring helper. It generates
JSON recipes, not executable code for the engine. `placement(names)` composes
existing calculations, constraints, height queries and anchors: preferred point,
then east/west/north/south at `search` metres. A candidate must clear every
explicit source by **radius + margin**. The first valid candidate wins; no valid
candidate rejects the edit atomically. There is no hidden scene-wide search.

The attached object's *complete* projected bounds must fit inside `radius`,
including its roof/canopy. The recipe author owns that declaration. A footprint
does not automatically measure arbitrary meshes or follow a manually stretched
component. Update bounds with the geometry, inspect and verify the pixels.
The garden's tree and lantern recipes also check their current horizontal size
against their slot radius. Increasing canopy spread beyond that bound rejects
the edit; enlarge the reservation first. The slot/plant dependency is one-way,
avoiding a cycle between a plant's placement and its own footprint.

`spacing(count)` composes 1..15 pair checks for 2..6 explicit placed objects.
It rejects overlapping declared object circles. It never silently repositions
another user object. Larger layouts should be divided into explicit local groups,
with shared edge reservations; do not add unbounded all-pairs work to every part.

The Japanese garden reuses its pavilion, trees, lanterns and terrain connections.
The pavilion reserves its roof. Each connection reserves a conservative rectangle
covering its chord, complete sine bend and rails; its length also includes the
full deck width, so the turned end edges fit even on a very short, sharp bend.
An additional 0.4m in both dimensions covers the supported post widths, deck
thickness projection and segment overlap. This can intentionally exclude more
area than the actual curved deck. Placement slots also reserve the pond and
landing pads. A separate pair constraint protects the placed objects from one
another. The water flowers intentionally remain in the pond.

Controls: **Adjust > slot0..slot5 / place · recipe controls**: x, z, search,
radius, margin. **temple > width/overhang** changes its reservation and dependants.
**spacing > margin** adjusts space between the placed objects. Rules are in the
downloadable JSON, not a native Japanese-garden generator.

Run `node author_clearance_placement.cjs`, `node test_clearance_placement.cjs`,
then `node test_clearance_placement_live.mjs <proof-directory> --record` against
an idle local engine. The latter preserves/restores the document and camera,
captures offscreen and never moves/resizes the OS window. Final evidence and
its source hashes must match before `import_clearance_placement.cjs` publishes
new immutable examples. Check the final WebGPU build in a real browser too.
`test_footprint_envelope_live.mjs` verifies actual bridge bounds at maximum width,
thickness, post size and bend in both directions, and detects the previous short
end-cap envelope.

This is bounded horizontal placement, not 3D collision, universal packing,
navigation, arbitrary mesh raycasting or avoidance during continuous animation.
Abrupt candidate changes are deliberate edit-time choices; films demonstrate
explicit transactions, rather than continuous physics.
