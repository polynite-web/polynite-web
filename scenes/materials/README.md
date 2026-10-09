# Procedural texture recipes

The Ground UI selects tiles, marble or a shared texture. Five marble variants remain available: Flowing (the original broad winding lines), Organic (fractal veins), Cloudy, Breccia and Banded. Texture size is in metres; Randomize changes only the saved seed.

procedural-recipes.json contains three named examples: rose_marble, amber_marble and dark_mineral. Define each with polynite_scene operation=material_define, then use material_assign on scene geometry or floor_configure material=texture texture=<ID>. shared-floor-objects.scene demonstrates the identical generated texture maps on a cube, sphere, cylinder and native floor.

Recipes are data-only and saved in the materials dictionary. Geometry m fields and floor_texture reference the recipe ID. The renderer supports 32 material definitions including 12 built-ins, and reuses cached albedo/normal maps per recipe. Settings include size, seed, variant, colors, warp, direction, contrast, grain, cracks, roughness and relief. These controls apply to procedural scene geometry; imported model materials are separate.

See majify-api/worker/polynite-auth/docs/procedural-surfaces.md for exact MCP calls and bounds. Recompile WebGPU before publishing the engine changes. The renderer screenshots verify the native controls and variants; they do not claim a rebuilt browser engine.

The shared-floor-objects scene now includes a short camera orbit. Load its full film document with scene.cinematic command=load_document, start_paused=true, then use the Cinematic HUD to play, pause or return to the beginning.
