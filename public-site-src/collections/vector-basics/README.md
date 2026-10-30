# Vector basics: twelve small films, one use case each

Short films (6 to 8 s) that cover what people ask for most often: charts,
dashboards, progress, titles, diagrams, timelines, countdowns, HUD widgets and a
logo reveal. Each one is drawn only with `scene.shape` and comes with the prompt
that makes it, so a reader can paste the prompt into their own agent and get the
same film, then change it.

| Recipe | Film | Use case | Shows |
| --- | --- | --- | --- |
| `vb-01-line-chart` | 8 s | Line chart | `data`, `plot` line with `reveal`, head ring `#c.b`, live value `{$rev[$v0*11]:0}K` |
| `vb-02-bar-chart` | 7 s | Bar chart | `repeat` with `$i`, staggered growth `smooth(sat($v0*1.6-$i*0.15))`, counting labels |
| `vb-03-donut` | 7 s | Donut / pie | `sector` angles driven by `$v0`, centre counter `{expr:,0}`, traced legend |
| `vb-04-kpi-cards` | 7 s | Dashboard | cards sliding in with `keys.move`, counters, sparklines (`plot` area + line), `paint:'order'` |
| `vb-05-progress` | 7 s | Progress / loading | `arc` and bar filled by `$v0`, linear keys with a pause, traced check mark |
| `vb-06-lower-third` | 6.5 s | Titles over 3D | a screen strip over the live 3D view, slide in/out, typing clicks |
| `vb-07-flow-diagram` | 8 s | Process diagram | boxes traced in turn, `arrow`, pulses with `fract($t...)` |
| `vb-08-timeline` | 8 s | Timeline | a playhead on `$v0`, milestones shown in sequence |
| `vb-09-checklist` | 7 s | Checklist | ticks traced one by one, strike lines, clicks |
| `vb-10-countdown` | 6 s | Countdown | `{3-floor($t):0}`, an arc emptying each second, `sfx.repeat`, a white flash key |
| `vb-11-gauges` | 6.5 s | HUD widgets | the `gauge` widget on `$v0`/`$v1` |
| `vb-12-logo-reveal` | 6 s | Logo / title | traced mark, `fx.reveal` energy front with sparks |

Each recipe holds `prompt`, `shapes` (for `scene.shape upsert`) and `seq` (the
film). `scenes/` holds the `.scene` the engine attached to each recorded MP4.
`tutorials.json` holds the tutorial and showcase drafts.

## Reader settings: the Vector drawings plugin

Agents draw; readers choose how they see it. The **Vector drawings** plugin
(`vector_draw` capability, Look > Vector graphics) offers:

- show or hide every drawing, an opacity, and calm motion (no flicker, blink or glitch);
- a vector HUD of the reader's own, drawn with the same grammar: the film's time
  and progress, in six styles and four corners;
- its panel line (drawing count, GPU tiles) as an overlay, like the other plugins.

The **Performance** plugin draws its frame-time chart the same way, as a vector
HUD you switch on and off (`performance.hud`, or hold its icon).

These are reader preferences: never written to a scene, never in a recording.
Agents set them with `scene.controls plugin_set {path:'vector.hud', value:'film'}`
or `{path:'performance.hud', value:true}` (`plugin_params` lists them).

## Recording

Recorded by the engine from zero (`scene.cinematic record`, 1080p, 30 fps,
landscape) with the user's export choices kept. Outputs:
`E:/genarate/polynite/vector-basics-2026-10-30/<film>.<date>/` (MP4, attached
`.scene`, thumbnails). Video files are not copied here.

## Availability

Desktop JIT engine of 2026-10-30. The public viewer predates `plot`, `data`,
`$i`, `along` and the plugin: check `commands.shape_charts` before loading these
scenes, and rebuild the web engine before publishing.
