# Nested architecture workshop

`pagoda.json` is a data-only recipe using shared geometry and nested composition.
The engine has no Japanese building branch. Reuse bracket/frontage/storey
definitions or replace them with another composition; presets do not constrain
what an LLM can author.

Open & test > Variant / Adjust exposes storeys, width, taper, eave lift, balcony
and roof ribs. Desktop: Scene settings > Living architecture > temple. The
downloaded scene includes the recipe, materials and shared geometry definitions.

This real-time study takes inspiration from Golden Temple's layered silhouette,
vermilion frame, roof detail and gold fittings. It does not reproduce its full
landscape or offline lighting quality. No reference source code/assets are copied.

Run the existing native collection verifier with `--collection` and a separate
`--output` proof directory. It validates all three scenes, edits a parameter,
checks invalid rollback, captures native images and exports the original MP4.
Import only a passed/restored proof with `import_recipe_collection.cjs`, then
build the public examples. Preserve published versions and user edits.

Nested calls accept yaw and uniform scale. Leaves keep rigid local rotation.
Current runtime budgets are explicit; estimate each composition before applying.
Compatible copies share GPU geometry even after assembly expansion.
