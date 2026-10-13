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