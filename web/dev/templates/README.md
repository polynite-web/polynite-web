# Starting points for New scene

Gallery > History > New scene (or MCP `scene.cinematic {request:{command:"scene_new", template}}`)
keeps the scene on screen in History, then opens one of these:

| File | What it is |
|---|---|
| `empty.scene` | The garden emptied: no objects, walls, grass or field; mirrored floor |
| `studio.scene` | Empty, with a plain dark floor and backdrop (no sky dome, clouds, moon or mist), neutral key light, close camera, fov 35: for presenting a device or a prop |
| `garden.scene` | Copy of `demo/adaptive-garden.scene` |
| `infinite.scene` | Copy of `demo/infinite/ship-modular.scene` (the recipe ship over endless mountains) |

Regenerate with `python tools/gen_templates.py`. A scene opened from a template has no file
name, so saving it never writes over the template.

## Showcase demos

`demo-*.scene` are the scenes behind the Showcase entries of the Plugins panel (`plugins/glade_demo_*.plugin.json`,
category showcase, subcategory Glade demos). Adding one (`scene.controls {request:{command:"plugin_add", plugin}}` or
its card's Open demo) keeps the scene on screen in History and opens the demo; the card unfolds a tutorial whose
every step carries the MCP call that does it (`plugin_catalog` lists them too).

| File | Shows |
|---|---|
| `demo-glade-levels.scene` | Ground levels, boulder cliffs, stairs, hills on the horizon |
| `demo-glade-water.scene` | A pond and a moat (`terrain.pond`), arched bridges (`build.bridge`) |
| `demo-glade-trees.scene` | The tree styles (`terrace_style trees`) in golden light |
| `demo-glade-sky.scene` | The cartoon clouds and sun at evening |
| `demo-glade-floating.scene` | Floating islands (`terrace_style base floating`) |
| `demo-glade-forest.scene` | A clearing: the forest ring round the island (`terrace_style horizon forest`) |
| `demo-glade-paths.scene` | Earth paths with pebbles (`terrain.path`) |
| `demo-glade-arcade.scene` | A stone arcade and a house with pointed arches (`build.wall`, `build.shape`, `build.arcade`, `build.roof`) |

They were built over MCP from an empty scene (seed 4); rebuild them the same way, then save the document here.

## Tutorial films

`film-<demo>.scene` (tools/make_glade_films.py) is a demo emptied of what its tutorial builds, with a film that
builds it again: each scene step is the glade operator itself (`op: "glade"`), a caption shows the call, the camera
turns round the work. The Showcase card's Watch (MCP `plugin_watch {plugin}`) keeps the scene on screen and plays it;
`scene.cinematic record` turns it into an MP4.
