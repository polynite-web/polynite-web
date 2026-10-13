# polinite-web
## Build, test, publish

The Cwc WebGPU build writes `dev/`. The publication directory is `web/`.

- Run `deploy_dev_to_site.bat` after a successful build. It prepares both
  `web/dev/` (explicit dev mode) and `web/rel/` (explicit release mode), with
  matching engine files and one deployment version. The public engine stays unchanged.
- Test `https://polynite.io/dev/` and `https://polynite.io/rel/` after Git publication.
- Once validated, run `deploy_rel_to_site.bat`. It checks the frozen rel manifest
  and promotes that candidate to `web/`, preserving the tested engine and version.
- Both scripts offer Git publication. `--local` only prepares/copies files and
  exits without a prompt, commit, push or pause.

Gzip and Brotli assets are prepared during packaging. Cloudflare Pages already
serves normal asset URLs with negotiated Brotli/gzip; the `.br` and `.gz` siblings
are retained as precompressed artifacts, not forced onto uncompressed responses.
Check `Content-Encoding` in the browser network panel to verify the actual transfer.
The app metadata, model index, compression and engine-pair hashes are validated
before promotion. Models above the Pages 25 MiB per-file limit are excluded.
Explicit package mode overrides localhost and debug query detection. Test manifests
and service workers are scoped to their own directory; dev/rel are marked noindex.
## Reliable deployment and engine loading

Preparation captures one verified source snapshot before building either stage.
If compilation changes the inputs during capture, preparation fails. Both stage
folders are swapped as one operation and restored if either replacement fails.

The engine is also stored under `engine/<content-hash>/app.js` and `app.wasm`.
The HTML binds both requests to that immutable path. The current engine and two
previous engines are retained; older managed archives are removed on publication.
A version-only HTML update reuses the same engine URL when its bytes are unchanged.

Public promotion builds a complete temporary site copy, then swaps it with `web/`.
A failed swap restores the complete previous site. This requires temporary disk
space for a full site copy. The Git push remains a separate, explicit step.

The Wasm loader keeps native streaming compilation and reports download activity.
It aborts after 25 seconds without decoded-byte progress, allows up to 120 seconds
for compilation after download, and caps the complete engine load at five minutes.
A loader stall displays a reloadable error instead of marking a scene as ready.