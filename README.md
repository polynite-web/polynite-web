# polinite-web
## Build, test, publish

The Cwc WebGPU build writes `dev/`. The publication directory is `web/`.

- Run `deploy_dev_to_site.bat` after a successful build. It prepares both
  `web/dev/` (explicit dev mode) and `web/rel/` (explicit release mode), with
  matching engine files and one deployment version. The public engine stays unchanged.
- Test `https://polynite.io/dev/` and `https://polynite.io/rel/` after Git publication.
- Once validated, run `deploy_rel_to_site.bat`. It checks the frozen rel manifest
  and promotes that candidate to `web/`, preserving the tested engine and version.
- Both scripts publish through Git automatically, without confirmation. The
  double-click workflow pauses at the end to keep the result visible. For an LLM
  or unattended run, use `deploy_dev_to_site.bat --no-pause` and, after validation,
  `deploy_rel_to_site.bat --no-pause`. Failures return a nonzero exit code.
- `--local` only prepares/copies files and exits without a prompt, commit, push
  or pause. `--help` prints usage without changing files.
- Wait for the Cloudflare Pages build after each push before checking public URLs.
- Cloudflare Pages: `deploy_dev_to_site.bat` and `deploy_rel_to_site.bat` push to Git (the
  history) and then send that same commit to Cloudflare by direct upload
  (`deploy_cloudflare.cjs`): only `web/` exactly as committed in HEAD (text from the commit,
  binaries hard-linked, Git-ignored local files never sent), only new content uploaded, about
  2-3 minutes, no clone of the multi-gigabyte repository by the Cloudflare build (its 20-minute
  limit failed once). `--git-only` skips the upload. After a manual commit + push (Showcase,
  Atelier...), run `deploy_cloudflare.bat` (or `--branch <name>` for a preview URL only).
- Shared media: tutorial videos (`docs/media`), models (`models/`) and Atelier videos
  (`atelier/media`) live once, at the public root of `web/`. `/dev/` and `/rel/` hold only the
  engine, pages and small files (~260 MB each) and read those media through internal rewrites
  in `_redirects` (`/rel/models/* /models/:splat 200`). Preparation leaves them out of the
  snapshots and manifests; promotion keeps the public ones and copies new ones from their
  sources (`deploy_site.cjs` SHARED: same name + same size = same file, names are immutable).
- If Explore pages changed, run `../majify-api/worker/polynite-auth/deploy_explore.bat`
  afterwards (`--no-pause` for unattended use). It already deploys the production
  Worker, so a separate `deploy_polynite.bat` run is unnecessary. A change to only
  the engine does not require an Explore or Worker deployment.

Gzip and Brotli assets are prepared during packaging. Cloudflare Pages already
serves normal asset URLs with negotiated Brotli/gzip; the `.br` and `.gz` siblings
are retained as precompressed artifacts, not forced onto uncompressed responses.
Check `Content-Encoding` in the browser network panel to verify the actual transfer.
Packaging reports its steps and elapsed time, and uses Brotli quality 6 instead
of the much slower maximum quality 11. Compression is shared between dev/rel
for identical content; decompressed engine bytes are verified before installation.
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
If Windows Explorer locks a directory, promotion falls back to atomic file
replacements with backups, committing the manifest last. Only managed payload
files are changed; other local files are preserved. An installation error rolls
back completed changes. If rollback itself fails, backups remain under the
reported `.deploy-work/public-files-*` path for recovery. Do not interrupt this
local operation or push until validation completes successfully.

The Wasm loader keeps native streaming compilation and reports download activity.
It aborts after 25 seconds without decoded-byte progress, allows up to 120 seconds
for compilation after download, and caps the complete engine load at five minutes.
A loader stall displays a reloadable error instead of marking a scene as ready.
