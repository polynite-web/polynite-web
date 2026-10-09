# Brick wall and wrecking ball

A first reconstruction from the supplied reference images: 300 separate staggered clay bricks, a 70 kg wrecking ball and 16 suspended links. The edge columns and bottom course are static; interior bricks are dynamic. Gravity, collisions and 17 distance joints produce the breach. No scripted brick explosion is used.

Open brick-wall-wrecking-ball.scene in Polynite and play the cinematic timeline to replay the impact from its authored initial poses. Pause physics while inspecting the starting arrangement. The ending uses polynite-ending-v4. preview.mp4 is a verified portrait 1080x1920, 60 fps sample with audio.

The clay material was added to the Wake engine in this task. Recompile WebGPU before using the texture on the web; older engines render an unknown material as plain. Brick fragmentation and dust are not implemented in this first version.
