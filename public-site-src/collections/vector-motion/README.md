# Vector motion: charts and motion graphics as shape recipes

Four films drawn only with `scene.shape` data: a growth curve with a counter, two
bars compared, an agent reading a file, and a waveform with lit words. Each
chart is a recipe made of generic operators. No native chart type, no shader per
film and no MCP tool per chart is added.

| File | Film | Shows |
| --- | --- | --- |
| `recipes/vd-01-growth-curve.json` | 14.5 s | `data` series, `plot` line/area with `reveal`, head marker `#curve.b`, x gradient, counter `{expr:,0}`, a highlighted period |
| `recipes/vd-02-bars-counter.json` | 13.5 s | bars sized by `$v0`, a link between their tops, a counter whose caption changes |
| `recipes/vd-03-agent-tools.json` | 16 s | cubic links with pulses `#l0.along(fract($t*0.42+$i/2))`, a file scanned dot by dot (`$i`, `mod`, `floor`), dots flying to clusters (`hash`, `smooth`), names that change |
| `recipes/vd-04-waveform-words.json` | 13 s | an envelope as mirrored `plot` bars, lit to the playhead, words lit in time with synthesized notes |

Each recipe file holds `shapes` (for `scene.shape upsert`) and `seq` (for the film).
`scenes/` holds the `.scene` the engine attached to each recorded MP4.

## Engine contract used

Check `commands.shape_charts` in `scene.capabilities`, then read `shapes.help`.
The connected engine owns the grammar; these files are starting points to edit.

- `data: {name: [values or expressions]}` on a shape; read as `$name[i]` (a
  fractional index blends neighbours), `$name.n`, `.min`, `.max`, `.sum`.
- `plot: {data, at, size, min, max, kind: line|area|bars|dots, smooth, reveal, points, r, gap}`.
  Anchors: `a` first value, `b` the head (last value drawn), `box` the frame.
  A negative height mirrors bars (waveforms).
- `$i` inside a `repeat`: each copy computes its own numbers.
- Functions: `floor round mod hash smooth` beside `sin cos abs sqrt min max fract sat`.
- `"#id.along(f)"`: a point at fraction f of an earlier item's own ink, curves included.
- Text values `{expr:,0}` group thousands (22,353).
- A dynamic shape may draw nothing at first (a chart at `reveal` 0).

## Recording

Films were recorded by the engine from zero (`scene.cinematic record`, 1080p,
30 fps, landscape), never pre-played, with the user's watermark choice kept.
Outputs: `E:/genarate/polynite/vectordraw-2026-10-30/<film>.<date>/` (MP4,
attached `.scene`, two moment thumbnails). Video files are not copied here.

## Availability

Implemented on the desktop JIT engine on 2026-10-30. Local WebGPU build v0486
(`dev/`, not published) draws all four scenes identically to the recorded MP4s
(Chromium, checked with engine captures). The public viewer is older and does
not understand `plot`, `data`, `$i`, `along` or `{x:,0}`: check
`commands.shape_charts` before loading these scenes.

Rebuild the web engine once more before publishing: v0486 predates the native
fix that keeps a film's attached `.scene` faithful when shapes change value
types between films. Then merge `tutorials.json` into `tutorial-content.json` /
`showcase.json`, attach the MP4s and deploy Pages + Worker as usual.
