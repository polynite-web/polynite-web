# Japanese garden: one data collection, shared local operators

`collection.json` contains the scene compositions and named variants. The seven
recipe JSON files contain the reusable programs. Native code contains no branch
for this collection, its plants, its buildings or its seasons.

- `compose_recipe_collection.cjs` resolves local recipe references and parameter
  patches without changing the shared source objects.
- `test_recipe_collection_live.mjs` starts from authored geometry, materializes
  build paths, estimates/applies recipes, checks geometry and animation, renders
  captures and optionally exports the five films. It preserves the idle user's
  scene, camera and pin; it never moves or resizes the OS window.
- `import_recipe_collection.cjs` accepts a complete successful restored run and
  copies its exact exported scenes and movies into immutable public references.
- `build_recipe_collections.cjs` publishes a compact discovery index followed by
  optional material, composition and individual recipe files. The public player
  uses a generic Variant selector and introspected parameter controls.
- `public-site-src/recipe-checks.js` supplies the same motion, support, span and
  corridor invariants to browser and native tests.

Authoring checks: `node test_recipe_collections.cjs` and
`node test_example_viewer.cjs`. For live verification, pass the actual current
model's pin path explicitly:

```text
node test_recipe_collection_live.mjs --collection public-site-src/collections/japanese-garden/collection.json --output <proof-directory> --pin <actual-current-model.scene-json> --record
node import_recipe_collection.cjs public-site-src/collections/japanese-garden/collection.json <proof-directory>
```

Create JPEG posters from the run's real rendered PNGs; keep the original PNGs,
MP4s and scenes in the proof directory. Do not replace engine renders with
illustrative images. Then run the public site builders and integrity checks,
prepare/promote the validated release, commit/push and deploy Explore. Check the
public bytes and actual WebGPU viewer after publication.

A published version's scene bytes must not change. Increment the collection
version for a new revision and preserve earlier public references. Add future
collections through the same data format, not another native module. Material,
shape, colour and season choices stay in data. Extend operators only for a
missing reusable mechanism, with a separate contract and observable tests.

Limits: explicit analytic cube supports, flat named paths, cached rigid petal
articulation. Trees are composed stylised canopies, not botanical simulation.
The base water material is a shaded surface; it is not a fluid simulation.

Version 2 corrects the assembled garden: low foundation, parameterised entrance
steps, separate pond crossing, connected paths and spaced planting. Its layout
contract checks selected world-space envelopes (including parent transforms),
path contact and stair rise; it is not a general mesh collision solver. Native
review renders front, access and top views for all three garden variants.
The original four isolated studies and immutable v1 scenes remain available.
For a partial collection revision, pass `--ids japanese-garden` to both live
verification and import; all selected variants must pass and restore the scene.
