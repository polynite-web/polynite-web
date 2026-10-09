# Brick wall and wrecking ball

300 staggered fired-clay bricks, a 100 kg ball and 16 alternating closed torus links. Each link has a hollow compound collider made from 16 capsules. Spherical joints at local attachment points let the links bend and twist; adjacent links also collide. A seventeenth dynamic torus is welded to the ball as its attachment eye. The top attachment ring and bottom brick course are static; all other bricks are dynamic, including both edge columns. Dynamic bricks weigh 2 kg, suspension links 2.5 kg. The scene has 319 bodies and 18 joints.

All suspension rings explicitly set vis=true. Their alternating planes share the same long axis along the initial suspension direction, rather than the mirrored pitch used by the old scene. Removing the static side columns prevents unsupported brick towers from remaining suspended after the impact. This is a rigid-body chain approximation with hollow capsule colliders and articulated constraints, not a material deformation or mortar fracture simulation.

The native floor is procedural beige marble with planar reflections. No duplicate ground plane or slab is added. Clay grain, seeded mottling and cellular fissures are shared material settings, stored with the scene. Clay texture offsets vary deterministically with brick IDs.

Open brick-wall-wrecking-ball.scene and play the timeline to replay the impact. The initial camera faces the ball side of the wall. preview.mp4 was regenerated from this corrected scene: portrait 1080x1920 at 60 fps with audio and polynite-ending-v4. It includes the collapse of unanchored bricks; the ending returns to the normal viewport. The film document restores the complete scene on Start/replay.

## Custom scene settings

The Settings icon opens this scene's generated controls: impact speed, ball mass, brick mass, release angle, friction and chain visibility. The defaults form the Percée preset (100 kg ball, 6 m/s launch, 2 kg bricks); Doux and Démolition offer contrasting presets. Replay restarts the existing sequence without recording. Reset settings restores the declared defaults. Editing a slider applies on release and returns the full construction to its initial pose paused.

`settings.json` contains the reusable declarative schema. Install it with `polynite_scene operation=settings_define schema=<contents> action_id=<fresh UUID>`. Read with settings_status; edit with settings_set values={impact_speed:7,ball_mass:90}; select with settings_preset preset=breach|gentle|demolition. settings_reset restores defaults; settings_replay starts the sequence. Definitions and values are embedded in the .scene and the MP4's companion film document. Native equivalents use scene.controls request.command=define|status|set|preset|reset|replay. Check capabilities.commands.scene_controls before use; WebGPU requires the owner's rebuild.

## MCP controls

- `polynite_scene operation=material_configure material=clay settings={grain:0.85,cracks:0.8,crack_width:0.018,tile:2.4,seed:137,relief:0.65,roughness:0.94}` with a fresh action_id.
- `polynite_scene operation=floor_configure material=marble settings={reflection:0.5,reflection_blur:0.12,scale:0.72,vein_strength:0.68,seed:73}` with a fresh action_id.
- `material_status` and `floor_status` read; `material_reset` and `floor_reset` restore defaults.

Native method equivalents are scene.material and scene.floor, params.request.command=status|configure|reset. Geometry, bodies and joints must be assembled atomically with physics_build. Check capabilities.commands.procedural_materials, procedural_floor and physics_torus. Recompile WebGPU before using these new features in the web viewer. Individual brick fracture and airborne dust are not implemented yet.

Optional photo study: photoreal-study.scene keeps the same physical construction and controls, with finer cube bevels, dark steel, subdued fired clay and cloudy marble. It needs capabilities.commands.geometry_bevel; rebuild WebGPU before using its edge settings in the browser. The original tutorial and its preview remain separate.
