# Shared shapes workshop

Three data-only studies exercise the same local tools: profile-studio, swept-arcade and modular-facade. Each includes two variants, a native film, an exact scene, exposed inputs and a reproduction prompt. They demonstrate geometry operators; they are not a full architecture or botanical simulation.

- profile.json: custom width profile, lathe, shared vessel and plinth geometry.
- arcade.json: authored polyline sweep, repeated ribs and shared footings.
- facade.json: parametric floor/bay layout with shared pilasters, frames and sills.

Definitions belong to program.prototypes; instance nodes choose placement and material roles. Style and proportions remain in JSON. Reuse the existing context/spatial/anchor operators when composing these shapes with terrain or paths. No native generator branches on an example name.

For multi-object composition, see the separate nested-architecture collection.
It adds local assembly definitions while reusing these same mesh operators.

Open the public example, choose Variant, then Adjust. The same inputs are available in Scene settings > Living architecture > study. Discovery flags recipe_instances, surface_profiles and surface_paths distinguish engines with the required capabilities. GPU batch counters describe actual mesh sharing; a lower vertex count is not an FPS benchmark.

The native collection runner verifies all nine scenes with the shared geometry contract and restores the user scene. The shared mesh regression additionally checks persistence, GPU/CPU sharing, overrides, motion vectors, invalid inputs and gallery-free captures. The browser QA button verifies the same geometry rules, a live parameter edit and actual GPU sharing.

Publish a new immutable version when changing a published scene. Preserve the collection fingerprint and actual recording sidecars. See the website recipe-examples README for the verified import workflow.
