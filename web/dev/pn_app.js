/* POLYNITE APPS - a published scene played as an app (Dice first), and the person's own changes
 * kept through every update of that scene. Plan: llm/polynite/progress/2026-10-30-apps-scene-dice-partage.md
 *
 * An app is a scene plus a manifest (meshopt/apps/<id>.app.json). The manifest says which parts
 * of the scene belong to the person who plays it:
 *   user_paths    dotted paths ("initial.dice") - merged key by key inside an object
 *   user_objects  [{match:"dice_*", in:["initial.geo","initial.physics.bodies"]}] - objects whose id
 *                 matches; an object is ONE unit across every container it is in (a die is never
 *                 kept without its body)
 *   customize     {paths:[...], sun, looks, controls} - what the app's Customize panel and its
 *                 ambiances write (sky, sun, floor, light); those paths are the person's too
 * A path may end in "*" ("initial.sky_*"): every key of that object with that prefix.
 * Everything else belongs to the app's author, and an update replaces it.
 *
 * THE SAVE (one per app, IndexedDB "polynite-apps"):
 *   {app_id, schema:1, current, tables:[{table_id, name, base_version, from_share, updated_at,
 *    document, previous?}]}
 * base_version is the published version the document was made from: the merge needs it.
 * A shared link adds a table; nothing ever overwrites another table.
 *
 * THE MERGE (A = old base, B = new base, U = the person's document), for every user-owned part:
 *   U equal to A (untouched)  -> B: the update arrives
 *   U different from A        -> U: the person's choice stays
 * Inside an object both sides are walked key by key, so a new default in B reaches a person who
 * changed something else in the same object. Parts the person does not own come from B; those
 * the person had changed anyway are listed in `replaced` and the old document stays in `previous`.
 *
 * A SHARED LINK carries only the user-owned parts (+ the scene materials its objects use) and the
 * version it was made on. Opening it is the same merge, with U = that base plus the payload. A
 * payload is data from a stranger: only the manifest's paths and object ids get in, and its size
 * is bounded.
 *
 * Pure functions run in Node (pn_app.test.cjs); IndexedDB is touched only by load/save.
 */
(function (root) {
  "use strict";
  var SCHEMA = 1, MAX_OBJECTS = 1000, MAX_PAYLOAD = 4 << 20;

  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function split(path) { return String(path).split("."); }
  function get(doc, path) {
    var parts = split(path), n = doc;
    for (var i = 0; i < parts.length; i++) { if (!isObj(n) || !(parts[i] in n)) return undefined; n = n[parts[i]]; }
    return n;
  }
  function set(doc, path, value) {
    var parts = split(path), n = doc;
    for (var i = 0; i < parts.length - 1; i++) { if (!isObj(n[parts[i]])) n[parts[i]] = {}; n = n[parts[i]]; }
    if (value === undefined) delete n[parts[parts.length - 1]]; else n[parts[parts.length - 1]] = value;
  }
  /* Floats come back from the engine as float32 written in decimal (0.349999994): two documents
     that hold the same value may differ in the last digits. */
  function near(a, b) { return a === b || Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)); }
  function equal(a, b) {
    if (typeof a === "number" && typeof b === "number") return near(a, b);
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!equal(a[i], b[i])) return false;
      return true;
    }
    if (isObj(a) && isObj(b)) {
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) if (!(ka[j] in b) || !equal(a[ka[j]], b[ka[j]])) return false;
      return true;
    }
    return a === b;
  }
  function matchId(pattern, id) {
    var star = pattern.indexOf("*");
    if (star < 0) return pattern === id;
    var head = pattern.slice(0, star), tail = pattern.slice(star + 1);
    return id.length >= head.length + tail.length && id.slice(0, head.length) === head && id.slice(id.length - tail.length) === tail;
  }

  function userPaths(m) { return m.user_paths.concat((m.customize && m.customize.paths) || []); }
  function sharePaths(m) { var sh = m.share || {}; return (sh.paths || []).concat(sh.customize && m.customize ? m.customize.paths || [] : []); }
  function pathMatch(pattern, path) {
    if (pattern.charAt(pattern.length - 1) !== "*") return pattern === path;
    var head = pattern.slice(0, -1);
    return path.indexOf(head) === 0 && path.indexOf(".", head.length) < 0;
  }
  function anyMatch(patterns, path) { for (var i = 0; i < patterns.length; i++) if (pathMatch(patterns[i], path)) return true; return false; }
  /* Patterns made concrete against the documents at hand: "initial.sky_*" -> initial.sky_on, ... */
  function expand(patterns, docs) {
    var out = [], seen = {};
    patterns.forEach(function (p) {
      if (p.charAt(p.length - 1) !== "*") { if (!seen[p]) { seen[p] = 1; out.push(p); } return; }
      var dot = p.lastIndexOf("."), parent = p.slice(0, dot);
      docs.forEach(function (d) {
        var box = d && get(d, parent);
        if (isObj(box)) Object.keys(box).forEach(function (k) { var q = parent + "." + k; if (!seen[q] && pathMatch(p, q)) { seen[q] = 1; out.push(q); } });
      });
    });
    return out;
  }

  function checkManifest(m) {
    if (!isObj(m) || m.app !== 1) return "not an app manifest (app:1)";
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(m.app_id || "")) return "app_id: lowercase letters, digits, - and _";
    if (!(m.version >= 1 && (m.version | 0) === m.version)) return "version: an integer from 1";
    if (!Array.isArray(m.user_paths) || !Array.isArray(m.user_objects || [])) return "user_paths and user_objects are lists";
    if (m.customize !== undefined && (!isObj(m.customize) || !Array.isArray(m.customize.paths || []))) return "customize: {paths:[...]}";
    var all = userPaths(m).concat((m.share && m.share.paths) || []);
    for (var i = 0; i < all.length; i++) if (!/^initial\.[A-Za-z0-9_.]*[A-Za-z0-9_]\*?$/.test(all[i])) return "paths: under initial., * only at the end - " + all[i];
    var rules = m.user_objects || [];
    for (var j = 0; j < rules.length; j++) {
      var r = rules[j];
      if (!isObj(r) || !/^[A-Za-z0-9_]*\*?[A-Za-z0-9_]*$/.test(r.match || "") || !Array.isArray(r.in) || !r.in.length) return "user_objects[" + j + "]: {match, in:[...]}";
    }
    return "";
  }

  /* Three-way merge of one value. a may be undefined (no old base). */
  function mergeValue(a, b, u) {
    if (u === undefined) return clone(b);
    if (isObj(a) && isObj(b) && isObj(u)) {
      var out = {}, k;
      for (k in b) if (!(k in u) && !(k in a)) out[k] = clone(b[k]);              /* new in B */
      for (k in u) {
        if (k in a && equal(u[k], a[k])) { if (k in b) out[k] = clone(b[k]); }   /* untouched: B, or gone in B */
        else out[k] = mergeValue(a[k], b[k], u[k]);
      }
      return out;
    }
    if (a !== undefined && equal(u, a)) return clone(b);
    return clone(u);
  }

  function ownedIds(rule, doc) {
    var ids = {};
    rule.in.forEach(function (c) { var box = get(doc, c); if (isObj(box)) Object.keys(box).forEach(function (id) { if (matchId(rule.match, id)) ids[id] = 1; }); });
    return ids;
  }
  function unit(rule, doc, id) { return rule.in.map(function (c) { var box = get(doc, c); return isObj(box) ? box[id] : undefined; }); }
  function putUnit(rule, doc, id, parts) {
    rule.in.forEach(function (c, i) {
      var box = get(doc, c);
      if (parts[i] === undefined) { if (isObj(box)) delete box[id]; return; }
      if (!isObj(box)) { set(doc, c, {}); box = get(doc, c); }
      box[id] = clone(parts[i]);
    });
  }

  /* The scene materials the person's objects name ("m") and the result does not have. */
  function carryMaterials(m, from, out) {
    var where = m.share && m.share.materials, mats = where && get(from, where);
    if (!isObj(mats)) return [];
    var carried = [];
    (m.user_objects || []).forEach(function (rule) {
      Object.keys(ownedIds(rule, out)).forEach(function (id) {
        unit(rule, out, id).forEach(function (part) {
          var name = isObj(part) && part.m;
          if (typeof name === "string" && mats[name] && get(out, where + "." + name) === undefined) { set(out, where + "." + name, clone(mats[name])); carried.push(name); }
        });
      });
    });
    return carried;
  }

  function merge(m, A, B, U) {
    var bad = checkManifest(m);
    if (bad) throw new Error(bad);
    var out = clone(B), kept = [], replaced = [];
    expand(userPaths(m), [A, B, U]).forEach(function (p) {
      var a = A && get(A, p), u = get(U, p);
      if (u === undefined) return;
      var v = mergeValue(a, get(B, p), u);
      set(out, p, v);
      if (!equal(v, get(B, p))) kept.push(p);
    });
    (m.user_objects || []).forEach(function (rule) {
      var inA = A ? ownedIds(rule, A) : {}, inB = ownedIds(rule, B), inU = ownedIds(rule, U), id;
      for (id in inB) if (!inU[id] && inA[id]) putUnit(rule, out, id, rule.in.map(function () { return undefined; }));  /* the person removed it */
      for (id in inU) {
        var u = unit(rule, U, id), a = inA[id] ? unit(rule, A, id) : null;
        if (a && equal(u, a)) continue;                                      /* untouched: B's (or none) */
        putUnit(rule, out, id, u);
        kept.push(rule.in[0] + "." + id);
      }
    });
    var carried = carryMaterials(m, U, out);
    /* What the person changed outside what they own: replaced by B, reported, kept in `previous`. */
    var ua = isObj(U.initial) ? U.initial : {}, aa = A && isObj(A.initial) ? A.initial : null;
    if (aa) Object.keys(ua).forEach(function (k) {
      var p = "initial." + k;
      if (owned(m, p) || equal(ua[k], aa[k])) return;
      if (!equal(ua[k], get(out, p))) replaced.push(p);
    });
    return { document: out, kept: kept, replaced: replaced, materials: carried };
  }
  function owned(m, p) {
    if (anyMatch(userPaths(m), p)) return true;
    var rules = m.user_objects || [];
    for (var j = 0; j < rules.length; j++) for (var c = 0; c < rules[j].in.length; c++) {
      var box = rules[j].in[c];
      if (p === box || box.indexOf(p + ".") === 0) return true;   /* geo, physics: their objects are walked one by one */
    }
    return false;
  }

  /* ---- the save ---- */
  function newStore(appId) { return { app_id: appId, schema: SCHEMA, current: "", tables: [] }; }
  function newId(store) { var n = 1, ids = {}; store.tables.forEach(function (t) { ids[t.table_id] = 1; }); while (ids["t" + n]) n++; return "t" + n; }
  function addTable(store, table, makeCurrent) {
    var t = { table_id: newId(store), name: String(table.name || "My dice").slice(0, 60), base_version: table.base_version | 0,
              from_share: table.from_share || null, updated_at: table.updated_at || new Date().toISOString(), document: table.document };
    store.tables.push(t);
    if (makeCurrent || !store.current) store.current = t.table_id;
    return t;
  }
  function table(store, id) { for (var i = 0; i < store.tables.length; i++) if (store.tables[i].table_id === id) return store.tables[i]; return null; }
  /* One table brought to the app's current version. bases: {version: document}. The document
     before the merge stays in `previous` (one step) so nothing the update replaced is lost. */
  function upgradeTable(m, t, bases) {
    if (t.base_version === m.version) return null;
    var B = bases[m.version];
    if (!B) throw new Error("no base scene for version " + m.version);
    var r = merge(m, bases[t.base_version] || null, B, t.document);
    t.previous = { base_version: t.base_version, document: t.document };
    t.document = r.document; t.base_version = m.version; t.updated_at = new Date().toISOString();
    return r;
  }
  function exportStore(store) { return JSON.stringify(store); }
  /* An import ADDS the tables it carries; it never replaces what is here. */
  function importStore(store, text) {
    var other = JSON.parse(text), added = [];
    if (!isObj(other) || other.app_id !== store.app_id || other.schema !== SCHEMA || !Array.isArray(other.tables)) throw new Error("not a save of " + store.app_id);
    other.tables.forEach(function (t) { if (isObj(t) && isObj(t.document)) added.push(addTable(store, t, false).table_id); });
    return added;
  }

  /* ---- sharing ---- */
  function sharePayload(m, doc, baseVersion) {
    var bad = checkManifest(m);
    if (bad) throw new Error(bad);
    var part = {};
    expand(sharePaths(m), [doc]).forEach(function (p) { var v = get(doc, p); if (v !== undefined) set(part, p, clone(v)); });
    if (!m.share || m.share.objects !== false) (m.user_objects || []).forEach(function (rule) {
      Object.keys(ownedIds(rule, doc)).forEach(function (id) { putUnit(rule, part, id, unit(rule, doc, id)); });
    });
    carryMaterials(m, doc, part);
    return { app: 1, app_id: m.app_id, base_version: baseVersion | 0, doc: part };
  }
  /* What may come in from a payload: the manifest's share paths, its objects, and materials
     named by those objects. Anything else is refused, not dropped silently. */
  function checkPayload(m, p) {
    if (!isObj(p) || p.app !== 1 || p.app_id !== m.app_id || !isObj(p.doc)) return "not a shared " + m.app_id;
    if (JSON.stringify(p).length > MAX_PAYLOAD) return "shared scene too large";
    var allowed = sharePaths(m), count = 0, err = "";
    var mats = m.share && m.share.materials;
    function walk(n, path) {
      if (err) return;
      if (path && anyMatch(allowed, path)) return;
      if (path === mats) return;
      var rule = null;
      (m.user_objects || []).forEach(function (r) { if (r.in.indexOf(path) >= 0) rule = r; });
      if (rule) { if (!isObj(n)) { err = path + " is not a list of objects"; return; } Object.keys(n).forEach(function (id) { if (!matchId(rule.match, id)) err = "object " + id + " is not part of " + m.app_id; else if (++count > MAX_OBJECTS * rule.in.length) err = "too many objects"; }); return; }
      if (!isObj(n)) { err = path + " is not shared by " + m.app_id; return; }
      Object.keys(n).forEach(function (k) { walk(n[k], path ? path + "." + k : k); });
    }
    walk(p.doc, "");
    return err;
  }
  /* bases: {version: document}; the payload's own base may be missing (then the current one). */
  function openShare(m, p, bases) {
    var bad = checkPayload(m, p);
    if (bad) throw new Error(bad);
    var B = bases[m.version], A = bases[p.base_version] || B, U = clone(A);
    (m.user_objects || []).forEach(function (rule) {
      Object.keys(ownedIds(rule, U)).forEach(function (id) { putUnit(rule, U, id, rule.in.map(function () { return undefined; })); });
    });
    expand(sharePaths(m), [p.doc]).forEach(function (q) { var v = get(p.doc, q); if (v !== undefined) set(U, q, clone(v)); });
    (m.user_objects || []).forEach(function (rule) {
      Object.keys(ownedIds(rule, p.doc)).forEach(function (id) { putUnit(rule, U, id, unit(rule, p.doc, id)); });
    });
    var mats = m.share && m.share.materials, pm = mats && get(p.doc, mats);
    if (isObj(pm)) Object.keys(pm).forEach(function (k) { if (get(U, mats + "." + k) === undefined) set(U, mats + "." + k, clone(pm[k])); });
    return merge(m, A, B, U);
  }

  /* ---- IndexedDB ---- */
  var database;
  function open() {
    if (!database) database = new Promise(function (resolve) {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      var request;
      try { request = indexedDB.open("polynite-apps", 1); } catch (_) { resolve(null); return; }
      request.onupgradeneeded = function () { request.result.createObjectStore("saves"); };
      request.onerror = request.onblocked = function () { resolve(null); };
      request.onsuccess = function () { request.result.onversionchange = function () { request.result.close(); database = null; }; resolve(request.result); };
    });
    return database;
  }
  function io(mode, work) {
    return open().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve, reject) {
        var tx = db.transaction("saves", mode), req = work(tx.objectStore("saves"));
        tx.oncomplete = function () { resolve(req.result); };
        tx.onerror = tx.onabort = function () { reject(tx.error); };
      });
    });
  }
  function load(appId) { return io("readonly", function (s) { return s.get(appId); }).then(function (v) { return isObj(v) && v.schema === SCHEMA ? v : newStore(appId); }); }
  function save(store) { return io("readwrite", function (s) { return s.put(store, store.app_id); }); }

  var api = { SCHEMA: SCHEMA, checkManifest: checkManifest, merge: merge, equal: equal, matchId: matchId, userPaths: userPaths, expand: expand,
              newStore: newStore, addTable: addTable, table: table, upgradeTable: upgradeTable,
              exportStore: exportStore, importStore: importStore,
              sharePayload: sharePayload, checkPayload: checkPayload, openShare: openShare,
              load: load, save: save };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.pnApp = api;
})(typeof window !== "undefined" ? window : this);
