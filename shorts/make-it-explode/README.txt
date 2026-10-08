Make it explode

short.scene / portrait.scene / landscape.scene: blue construction, illustrative AI command, explosion.
tutorial.scene: construction and explosion without command UI.
preview.scene: immediate explosion without construction or input.

Masters: 4K 60fps, Maximum quality, stereo audio with headroom.
The shared ending preset installs branding implicitly.
AI COMMAND / PROMPT DEMO is illustrative and does not execute a live assistant call.

Regenerate: python render_shorts.py
Uses your running native instance and restores the original scene.
New presets require the updated engine.

Command input audio is included by default in command-input-v1.
MCP clip overrides: command_audio (boolean), typing_volume and send_volume (0..1), send_at (local seconds, default in).
Defaults: typing_volume=0.015, send_volume=0.045. No extra sound clips or prompt details needed.
Silent seeking suppresses cues; replay resets them; recording includes them.

Latest masters: short-portrait-youtube.mp4 and short-landscape-chevron.mp4.
Tech construction keeps blue edges without floor birth ripples.
The command-input preset illuminates the chevron with a cyan halo and pulses the panel for 0.24s at send_at, synchronized with the confirmation sound; no detached button rectangle.

Portrait ending is shifted left by 5% of frame width for Shorts controls; the authored position survives mandatory signature installation at export.

Portrait command panel is narrower and shifted left, keeping the rightmost 17.5% of the frame clear at the prompt height.

Portrait header trial: short-portrait-header-v3.mp4, portrait-header.scene and short-portrait-header-resolved.scene.
Command row box=[0.075,0.17,0.64,0.034], typing_volume=0.002, send_volume=0.003.
Regenerate: python render_shorts.py --format portrait --suffix header-v3 --header-prompt
The prior lower-panel variant remains available for comparison.

Five 2160x3840 thumbnails are in thumbnails-header; 01-make-it.jpg uses frame 1.80s to leave the action unexplained. Header exports regenerate this set automatically.

Header v3 lowers Send by another 3.5 dB and adds a subtle 0.24s text_appear cue 0.08s after the EXPLODE title begins (volume 0.003).
