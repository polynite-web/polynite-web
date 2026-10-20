# Architecture that joins

The engine supplies bounded roof, wall and convex-prism operators. All Japanese
proportions, curved profiles, material roles, columns, brackets, ornaments,
repetitions and courtyard placement are editable recipe data.

Start with joined-shell.json. temple-hall.json composes the same shell with
shared geometry. The courtyard reuses the existing pagoda and garden recipes.
Add another architectural tradition by changing data, not the native operator.

Open & test → Adjust exposes roof rise, eave lift, door width, windows and detail.
Save retains the program, material definitions and current values in the scene.
For MCP, discover roof/wall and check commands.recipe_junctions before estimate
and apply. Patch params on the same instance to continue an existing creation.

Local roof/wall nodes accept no direct repeat/pose/let/when: wrap a joined shell
in an assembly for those operations. Roof references stay inside that group.
Roof upper faces form a trimmed envelope; underside seams are not a general
watertight solid Boolean. Separate wall chains are not globally welded.

Author data with author_joined_architecture.cjs. Verify every original/variant
with test_recipe_collection_live.mjs, --record and an explicit --pin backup.
Import only a passed/restored run with import_recipe_collection.cjs. Keep
published versions immutable; increment the version for later fixture changes.
