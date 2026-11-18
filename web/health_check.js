/* POLYNITE'S PLUGIN HEALTH CHECK - every plugin of the catalog, one at a time, in an empty scene, through
   polynite.rpc only (what any agent can do): added without error? something to see? errors in the console?
   A picture of each. Run it in an ISOLATED page - http://127.0.0.1:6931/ has its own browser storage, so its
   empty scenes never touch the scenes of localhost:6931 - with
     const {healthCheck} = await import('/health_check.js'); const report = await healthCheck();
   The report is data (no file, no network): the caller keeps it (tools/plugin_health.md says how). */

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpc(method, params = {}) {
  const r = await window.polynite.rpc({ jsonrpc: '2.0', id: 1, method, params });
  if (r && r.error) throw new Error(r.error.message || JSON.stringify(r.error));
  return r ? r.result : null;
}
const ui = request => rpc('scene.ui', { request });
const controls = request => rpc('scene.controls', { request });

/* what is in the scene: objects, creatures, assemblies - a sum a generator changes */
async function contents() {
  const d = await rpc('scene.describe');
  const n = o => (Array.isArray(o) ? o.length : o && typeof o === 'object' ? Object.keys(o).length : 0);
  return { objects: n(d.objects), creatures: n(d.creatures), build: n(d.build && (d.build.assemblies || d.build)), total: n(d.objects) + n(d.creatures) };
}

/* an empty scene, truly there: the menu opened if it is shut, a save in progress waited for ("already being
   kept"), then the contents polled until they are few and stop changing */
async function emptyScene() {
  let done = false, last = '';
  for (let i = 0; i < 12 && !done; i++) {
    try { await ui({ command: 'click', target: 'new_scene_empty' }); done = true; }
    catch (e) {
      last = e.message;
      if (/open the New scene menu/i.test(e.message)) await ui({ command: 'click', target: 'new_scene_menu' }).catch(() => {});
      else await sleep(1000);   // a save in progress, a gesture: try again in a moment
    }
  }
  if (!done) throw new Error('no empty scene: ' + last);
  /* the new scene comes once the old one is kept: wait for the history to be done, or a plugin added now is
     stopped by the new scene arriving after it (a scene loaded stops the builds in progress) */
  for (let t = 0; t < 20000; t += 400) {
    const h = await rpc('scene.cinematic', { request: { command: 'history_list' } }).catch(() => null);
    if (h && h.busy === false && t >= 800) break;
    await sleep(400);
  }
  let prev = -1, stable = 0;
  for (let t = 0; t < 15000 && stable < 2; t += 750) {
    await sleep(750);
    const c = await contents().catch(() => null);
    if (!c) continue;
    stable = c.total === prev ? stable + 1 : 0; prev = c.total;
  }
  await sleep(500);
  return Math.max(0, prev);   // what is still there: a generation of the last plugin still running into the new scene
}

/* a small picture of the scene, and its pixels to compare */
async function picture() {
  let start = null;
  for (let i = 0; i < 8 && !start; i++) {   // another capture or a save may hold it a moment
    try { start = await rpc('scene.capture', { request: { command: 'render', width: 320, height: 240 } }); }
    catch (e) { if (i === 7) throw e; await sleep(700); }
  }
  const id = start.id;
  for (let i = 0; i < 40; i++) {
    const s = await rpc('scene.capture', { request: { command: 'status', id } });
    if (s.error) throw new Error(s.error);
    if (!s.pending && (s.done || s.path || s.ok)) break;
    await sleep(250);
  }
  const img = await rpc('scene.capture', { request: { command: 'image', id, max_side: 256, format: 'jpeg' } });
  const b64 = img.data || img.base64 || img.image || '';
  const url = b64.startsWith('data:') ? b64 : 'data:image/jpeg;base64,' + b64;
  const el = new Image(); el.src = url; await el.decode();
  const c = document.createElement('canvas'); c.width = 64; c.height = 48;
  const g = c.getContext('2d'); g.drawImage(el, 0, 0, 64, 48);
  return { url, px: g.getImageData(0, 0, 64, 48).data };
}
function difference(a, b) {   /* mean absolute difference, 0..255 */
  if (!a || !b) return null;
  let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
  return s / (a.length / 4) / 3;
}

/* the console's errors while one plugin runs */
function watchErrors() {
  const seen = [], orig = console.error;
  const onErr = e => seen.push(String(e.message || e.reason || e));
  console.error = (...a) => { seen.push(a.map(String).join(' ').slice(0, 300)); orig.apply(console, a); };
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
  return () => { console.error = orig; window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr); return seen; };
}

const VISIBLE = new Set(['generators', 'worlds', 'showcase']);   // these build something: expected to show it (a look needs content to show on)
const BUILDS = VISIBLE;

export async function healthCheck({ only = null, settle = 8000, shots = true, log = () => {}, post = null } = {}) {
  if (!window.polynite || !window.polynite.rpc) throw new Error('no engine on this page');
  if (/^localhost$/i.test(location.hostname)) throw new Error('run it on http://127.0.0.1:6931/ - an isolated page: it makes empty scenes');
  const catalog = (await controls({ command: 'plugin_catalog' })).plugins || [];
  const list = catalog.filter(p => !only || only.includes(p.id));
  const report = { at: new Date().toISOString(), page: location.href, engine: (window.__pnVersion || null), plugins: [] };
  for (const p of list) {
    const row = { id: p.id, title: p.title, category: p.category, kind: p.kind };
    const t0 = performance.now();
    try {
      const left = await emptyScene();
      const prevRow = report.plugins[report.plugins.length - 1];
      if (left > 0) {   /* the plugin before kept building into this new scene: its fault, said on its row */
        if (prevRow && BUILDS.has(prevRow.category)) { prevRow.leaks_into_next_scene = left; if (prevRow.verdict === 'ok') prevRow.verdict = 'suspect: keeps building after a new scene'; }
        else if (prevRow) prevRow.scene_not_empty_after = left;   /* not its doing: an earlier generation still running */
        /* then the next plugin starts on a truly empty scene: emptied again until nothing more arrives, so one
           generation still running is not blamed on the plugins after it */
        for (let k = 0, n = left; k < 6 && n > 0; k++) { await sleep(5000); n = await emptyScene(); }
      }
      const before = await contents(); const base = shots ? await picture().catch(() => null) : null;
      const stop = watchErrors();
      try { await controls({ command: 'plugin_add', plugin: p.id }); row.added = true; }
      catch (e) { row.added = false; row.add_error = e.message.slice(0, 300); }
      /* a generator builds over a few seconds: wait until the scene stops changing, or settle ms */
      let after = await contents(), last = after.total, stable = 0;
      for (let t = 0; row.added && t < settle && stable < 3; t += 1000) { await sleep(1000); after = await contents(); stable = after.total === last ? stable + 1 : 0; last = after.total; }
      const shot = shots ? await picture().catch(e => ({ error: e.message })) : null;
      row.errors = stop().filter(m => !/favicon|net::ERR_|Failed to load resource/i.test(m)).slice(0, 5);
      row.before = before; row.after = after; row.added_things = after.total - before.total;
      row.picture_change = base && shot && shot.px ? Math.round(difference(base.px, shot.px) * 10) / 10 : null;
      if (shot && shot.url) row.picture = shot.url;
      const visible = row.added_things > 0 || (row.picture_change !== null && row.picture_change > 3);
      row.verdict = !row.added ? 'broken: not added'
        : row.errors.length ? 'broken: errors'
        : VISIBLE.has(p.category) && !visible ? 'suspect: nothing to see'
        : p.category === 'look' && !visible ? 'ok: effect not checked (an empty scene has nothing to show it on)'
        : 'ok';
    } catch (e) { row.verdict = 'broken: check failed'; row.check_error = e.message.slice(0, 300); }
    row.seconds = Math.round((performance.now() - t0) / 100) / 10;
    report.plugins.push(row); log(row.id + ': ' + row.verdict);
  }
  report.summary = report.plugins.reduce((s, r) => { const k = r.verdict.split(':')[0]; s[k] = (s[k] || 0) + 1; return s; }, {});
  if (post) {   /* tools/plugin_health_receiver.mjs: it writes the report and its pictures, and the draft missions */
    try { const r = await fetch(post, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) }); report.saved = await r.text(); }
    catch (e) { report.saved = 'not saved: ' + e.message; }
  }
  return report;
}
