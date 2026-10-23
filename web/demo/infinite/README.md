# Infinite world — ship over endless mountains

`ship-mountains.scene` is the reference scene for `vmesh_infinite.hh`: an
endless, deterministic mountain terrain and a procedural ship flying through it
on a terrain-following autopilot, with a chase camera.

## Open and play

Desktop: open `ship-mountains.scene` (file picker or drop), then Play.
MCP: `scene.cinematic {command:"load_document", document:<file>, start_paused:true}`.

## Settings

**Scene settings > Infinite world** (scene.controls, live):

| Control | Binding | Range |
|---|---|---|
| Ship speed | `infinite.speed` | 0..600 m/s (0 parks the ship) |
| Flight height above relief | `infinite.clearance` | 10..300 m |
| Chase camera distance | `infinite.cam_dist` | 8..150 m |
| Chase camera pitch | `infinite.cam_pitch` | -10..60 deg |
| World seed | `infinite.seed` | 0..9999 (regenerates the world) |
| Lake level | `infinite.water` | -100..300 m |
| Forest cover | `infinite.forest` | 0..1 |

MCP: `scene.apply {actions:[{op:"infinite", speed, clearance, follow, cam_dist,
cam_pitch, seed, autopilot, ship:{sx,sz,local,heading}}]}`; read
`scene.describe.infinite` (sector, local position, chunks, rebases, ms).
`follow`: 0 free camera, 1 target only (orbit by hand), 2 chase.

## Terrain edits (persistent, Minecraft-like)

`{op:"infinite", edit:{kind:"crater"|"raise"|"flatten", radius, depth}}` digs,
raises or flattens under the ship (or at `sx, sz, local`). Edits are the only
part of the world that is saved (`initial.infinite.edits`); only the touched
chunks are rebuilt. `edits_clear:true` removes them all.

## Objects and physics on the relief

Scene objects, lamps and Box3D bodies placed on the relief stay in place when
the render origin moves (double-precision anchors). The near ring carries
Box3D height-field colliders; a dynamic body outside it sleeps until the
camera comes back. Physics positions up to 4096 m are accepted in this mode.

## Save / restore

A saved scene stores `initial.infinite`: seed, ship sector (`sx`,`sz` as
int64 strings), local position, heading and flight state, render origin.
The terrain itself is never saved: it is regenerated from the seed.
Starting far away: `ship:{sx:"3906250", sz:"3906250"}` is 10^9 m from the origin.

## Proofs (2026-10-16 and 2026-10-17)

`E:\genarate\polynite\infinite-2026-10-17\` — edits, physics on the relief,
anchored round trips (1.5 km and 10^9 m), live state across a JIT reload,
TAA with and without the ship velocity.


`E:\genarate\polynite\infinite-2026-10-16\` — MP4s, captures, scenes and
`index.html`. Rebase continuity measured on the film with TAA and motion blur,
save/restore pixel comparison, captures at 10^9 m and 10^15 m.

## ship-modular.scene

The same flight with the ship built from `recipes/ship_miro.json` (ship_model 4):
generic operators, parts on bones, live sliders in **Scene settings > Ship recipe**
(nacelle offsets, nose, girth, spread, span, sweep, chord, thrust, seed, variety)
and the film **Recipe - wing lost** (a wing breaks off at 31 s). Regenerate the
recipe with `python recipes/gen_ship_miro.py`. Guide: `prompt/guides/ship-recipes.md`.
