// Publish web/ to Cloudflare Pages by direct upload - exactly the committed files of HEAD.
// Git stays the history (commit/push as usual); this sends the same commit to Cloudflare
// without its build server cloning the whole repository (3+ GB, the 20-minute build limit).
//
//   node deploy_cloudflare.cjs                 production (branch main), after a push
//   node deploy_cloudflare.cjs --branch test   a preview deployment only
//   options: --project polynite-web, --allow-unpushed
//
// Text files come from the commit's blobs (LF, as the Git build served them); binary files
// are hard-linked from the working tree when unchanged (no copy of the gigabytes). Files
// ignored by Git (local .wmesh caches...) are never sent. Wrangler uploads only new content.
'use strict';
const fs = require('node:fs'), path = require('node:path'), { spawnSync } = require('node:child_process');
const root = __dirname, args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const branch = opt('--branch', 'main'), project = opt('--project', 'polynite-web');
const KNOWN = new Set(['--branch', '--project', '--allow-unpushed', '--no-pause']);
for (let i = 0; i < args.length; i++){ if (!KNOWN.has(args[i])) { console.error('[cloudflare] unknown option ' + args[i] + ' (--branch <name>, --project <name>, --allow-unpushed)'); process.exit(2); } if (args[i] === '--branch' || args[i] === '--project') i++; }
const NODE_DIR = 'D:/dev/majify-api/node-v24.15.0-win-x64', WRANGLER_CWD = __dirname   /* no wrangler.jsonc here: a plain Pages upload */;
const MAX_FILE = 25 * 1024 * 1024, MAX_FILES = 20000;
const BINARY = new Set(['.wasm', '.br', '.gz', '.glb', '.gltf', '.wmesh', '.mp4', '.webm', '.mp3', '.ogg', '.wav', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.bin', '.zip', '.ktx2', '.hdr', '.exr']);
const started = Date.now(), say = m => console.log('[cloudflare +' + ((Date.now() - started) / 1000).toFixed(1) + 's] ' + m);
function git(a, input) {
   const r = spawnSync('git', a, { cwd: root, input, maxBuffer: 1 << 30, windowsHide: true });
   if (r.status !== 0) throw Error('git ' + a.join(' ') + ': ' + (r.stderr || '').toString());
   return r.stdout;
}
function blobs(shas) {   /* git cat-file --batch: "<sha> blob <size>\n<content>\n" per object */
   const out = new Map();
   for (let i = 0; i < shas.length; i += 400) {
      const part = shas.slice(i, i + 400), buf = git(['cat-file', '--batch'], part.join('\n') + '\n');
      let p = 0;
      for (const sha of part) {
         const nl = buf.indexOf(10, p), head = buf.toString('latin1', p, nl).split(' ');
         if (head[0] !== sha || head[1] !== 'blob') throw Error('unexpected object for ' + sha);
         const size = Number(head[2]); out.set(sha, buf.subarray(nl + 1, nl + 1 + size)); p = nl + 1 + size + 1;
      }
   }
   return out;
}
function main() {
   const head = git(['rev-parse', 'HEAD']).toString().trim(), subject = git(['log', '-1', '--format=%s']).toString().trim();
   if (branch === 'main' && !args.includes('--allow-unpushed')) {
      const up = spawnSync('git', ['rev-parse', '@{u}'], { cwd: root, encoding: 'utf8', windowsHide: true });
      if (up.status !== 0 || up.stdout.trim() !== head) throw Error('HEAD ' + head.slice(0, 7) + ' is not pushed: push first so Git holds what the site serves (or --allow-unpushed)');
   }
   say('Commit ' + head.slice(0, 7) + ' - ' + subject);
   /* what HEAD holds under web/: mode, sha, path */
   const tree = git(['ls-tree', '-r', '-z', '--full-tree', head, '--', 'web']).toString('utf8').split('\0').filter(Boolean).map(l => {
      const tab = l.indexOf('\t'), [mode, type, sha] = l.slice(0, tab).split(' '); return { mode, type, sha, path: l.slice(tab + 1) };
   }).filter(e => e.type === 'blob');
   if (!tree.length) throw Error('nothing under web/ in HEAD');
   if (tree.length > MAX_FILES) throw Error(tree.length + ' files: above the Pages limit of ' + MAX_FILES);
   const changed = new Set(git(['diff', '--name-only', '-z', head, '--', 'web']).toString('utf8').split('\0').filter(Boolean));
   const stage = path.join(root, '.deploy-work', 'cloudflare-' + process.pid);
   fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
   try {
      const fromBlob = [], linked = [];
      for (const e of tree) {
         const ext = path.extname(e.path).toLowerCase();
         if (BINARY.has(ext) && !changed.has(e.path) && e.mode !== '120000' && fs.existsSync(path.join(root, e.path))) linked.push(e); else fromBlob.push(e);
      }
      say('Staging ' + tree.length + ' files: ' + linked.length + ' binary links, ' + fromBlob.length + ' from the commit' + (changed.size ? ' (' + changed.size + ' differ locally: the committed version is sent)' : ''));
      let bytes = 0;
      for (const e of linked) {
         const src = path.join(root, e.path), dest = path.join(stage, e.path.slice(4)), size = fs.statSync(src).size;
         if (size > MAX_FILE) throw Error('above 25 MiB: ' + e.path);
         fs.mkdirSync(path.dirname(dest), { recursive: true });
         try { fs.linkSync(src, dest); } catch { fs.copyFileSync(src, dest); }
         bytes += size;
      }
      const content = blobs([...new Set(fromBlob.map(e => e.sha))]);
      for (const e of fromBlob) {
         const data = content.get(e.sha), dest = path.join(stage, e.path.slice(4));
         if (data.length > MAX_FILE) throw Error('above 25 MiB: ' + e.path);
         fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, data); bytes += data.length;
      }
      say('Staged ' + (bytes / 1e9).toFixed(2) + ' GB; uploading new content with wrangler (branch ' + branch + ').');
      const node = path.join(NODE_DIR, process.platform === 'win32' ? 'node.exe' : 'bin/node'), npx = path.join(NODE_DIR, 'node_modules/npm/bin/npx-cli.js');
      const r = spawnSync(node, [npx, '--yes', 'wrangler', 'pages', 'deploy', stage, '--project-name', project, '--branch', branch, '--commit-hash=' + head, '--commit-message=' + subject.slice(0, 380), '--commit-dirty=false'   /* (=: a message starting with '-- ' is not an option) */],
         { cwd: WRANGLER_CWD, stdio: 'inherit', windowsHide: true, env: { ...process.env, PATH: NODE_DIR + path.delimiter + process.env.PATH } });
      if (r.error) throw r.error;
      if (r.status !== 0) throw Error('wrangler pages deploy failed (' + r.status + ')');
      say('Deployed ' + head.slice(0, 7) + ' to ' + project + (branch === 'main' ? ' (production)' : ' (preview ' + branch + ')') + '.');
   } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
try { main(); } catch (e) { console.error('[cloudflare] ' + e.message); process.exit(1); }
