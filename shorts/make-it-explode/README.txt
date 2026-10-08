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

Portrait header trial: short-portrait-header-v10.mp4, portrait-header.scene and short-portrait-header-resolved.scene.
Command row box=[0.075,0.17,0.64,0.034], typing_volume=0.002, send_volume=0.003.
Regenerate: python render_shorts.py --format portrait --suffix header-v10 --header-prompt
The prior lower-panel variant remains available for comparison.

Five 2160x3840 thumbnails are in thumbnails-header; 01-make-it.jpg uses frame 1.80s to leave the action unexplained. Header exports regenerate this set automatically.

Header v3 lowers Send by another 3.5 dB and adds a subtle 0.24s text_appear cue 0.08s after the EXPLODE title begins (volume 0.003).

Header v4: validation flash, chevron halo and popup fade share the Send onset and 160ms sound duration. The popup disappears while illuminated and never returns to idle. This exit is part of command-input-v1.

Header v7: a glowing check confirms Send; the panel compresses gently and fades upward over 250ms without returning to idle. The portrait ending is raised to the EXPLODE title height (box y=0.29). Portrait export watermarks occupy the upper-left safe area instead of a bottom corner.

Header v8: orange EXPLODE glow=0.55. Portrait Shorts omit the persistent watermark (watermark=0) and keep the closing signature.

Header v9 reduces the EXPLODE halo to glow=0.12 for a discreet edge light without an orange cloud.

Header v10 adds a quiet 200ms text_appear cue 20ms into the portrait closing logo entrance (volume=0.0008), separately from the existing shine sound.
