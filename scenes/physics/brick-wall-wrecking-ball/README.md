# Brick wall and wrecking ball

300 staggered fired-clay bricks, a 70 kg ball and 16 alternating closed torus links. Each link has a hollow compound collider made from 16 capsules. Distance joints support the suspension; adjacent links also collide. The edge columns and bottom brick course are static; the interior bricks fall under real impacts and gravity.

The native floor is procedural beige marble with planar reflections. No duplicate ground plane or slab is added. Clay grain, seeded mottling and cellular fissures are shared material settings, stored with the scene. Clay texture offsets vary deterministically with brick IDs.

Open brick-wall-wrecking-ball.scene and play the timeline to replay the impact. preview.mp4 is portrait 1080x1920 at 60 fps with audio and polynite-ending-v4.

## MCP controls

- `polynite_scene operation=material_configure material=clay settings={grain:0.85,cracks:0.8,crack_width:0.018,tile:2.4,seed:137,relief:0.65,roughness:0.94}` with a fresh action_id.
- `polynite_scene operation=floor_configure material=marble settings={reflection:0.5,reflection_blur:0.12,scale:0.72,vein_strength:0.68,seed:73}` with a fresh action_id.
- `material_status` and `floor_status` read; `material_reset` and `floor_reset` restore defaults.

Native method equivalents are scene.material and scene.floor, params.request.command=status|configure|reset. Geometry, bodies and joints must be assembled atomically with physics_build. Check capabilities.commands.procedural_materials, procedural_floor and physics_torus. Recompile WebGPU before using these new features in the web viewer. Individual brick fracture and airborne dust are not implemented yet.
