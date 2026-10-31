/* THE APP SHELL - a Polynite scene played as an app (Dice), on top of the normal engine page.
 * Plan: llm/polynite/progress/2026-10-30-apps-scene-dice-partage.md, step 4. Data: pn_app.js.
 *
 * On: ?app=<id>, or a host named for an app (dice.polynite.io). Off: the page is the editor as before.
 *
 *   1. fetch the manifest (apps/<id>.app.json) and the published base (apps/<id>/v<N>.scene)
 *   2. read the save (IndexedDB, pnApp.load); no table -> the base becomes "My dice";
 *      a table made on an older base is merged up (pnApp.upgradeTable, the older base fetched too)
 *   3. once the engine answers, load the current table (scene.cinematic load_document)
 *   4. keep it: the engine's document is read back after each change and when the page hides,
 *      and written to the table only when it differs
 *
 * THE PANEL IS THE ENGINE'S (meshopt/vmesh_app_ui.hh), drawn with the HUD's widgets: Dice,
 * Ambiance, Customize, Tables. This file only holds what the page owns - the manifest and the
 * tables - and answers it: text(what) is read by the panel, action(what, arg) is what it asks.
 * Nothing here is drawn, except a line if the app cannot start at all.
 */
(function () {
  "use strict";
  var appId = window.__pnAppMode || "";   /* set in index.html's <head>, before the engine starts */
  if (!appId) return;
  document.documentElement.classList.add("pn-app-mode");

  var A = window.pnApp, manifest = null, bases = {}, store = null, current = null;
  var lastSaved = "", ready = false;
  var shell = window.pnAppShell = { appId: appId, state: "starting", error: "" };

  function fail(text) {
    shell.state = "failed"; shell.error = text;
    console.error("[app] " + text);
    var line = document.createElement("div");
    line.textContent = "This app could not start: " + text;
    line.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;max-width:calc(100vw - 32px);" +
      "background:rgba(10,16,25,.92);color:#ffb4a8;font:14px system-ui,sans-serif;padding:10px 14px;border-radius:10px";
    document.body.appendChild(line);
  }
  function getJson(url) { return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url + ": " + r.status); return r.json(); }); }
  function baseUrl(v) { return manifest.scene.replace("{version}", String(v)); }
  function base(v) { return bases[v] ? Promise.resolve(bases[v]) : getJson(baseUrl(v)).then(function (d) { bases[v] = d; return d; }, function () { return null; }); }

  function engine() { return window.polynite && typeof window.polynite.call === "function" ? window.polynite : null; }
  function call(method, request) { return engine().call(method, { request: request }); }
  function whenEngine() {
    return new Promise(function (resolve) {
      (function poll() {
        var p = engine();
        if (p) { try { p.call("scene.cinematic", { request: { command: "status" } }); resolve(p); return; } catch (_) {} }
        setTimeout(poll, 250);
      })();
    });
  }

  /* ---- the save ---- */
  function open() {
    return getJson("apps/" + appId + ".app.json").then(function (m) {
      var bad = A.checkManifest(m);
      if (bad) throw new Error("manifest: " + bad);
      manifest = m;
      return Promise.all([base(m.version), A.load(appId)]);
    }).then(function (r) {
      if (!r[0]) throw new Error("the published scene is missing (" + baseUrl(manifest.version) + ")");
      store = r[1];
      if (!store.tables.length) A.addTable(store, { name: "My dice", base_version: manifest.version, document: JSON.parse(JSON.stringify(r[0])) }, true);
      current = A.table(store, store.current) || store.tables[0];
      store.current = current.table_id;
      return upgrade(current);
    }).then(function () { return A.save(store); });
  }
  function upgrade(t) {
    if (t.base_version === manifest.version) return Promise.resolve(null);
    return base(t.base_version).then(function () {
      var r = A.upgradeTable(manifest, t, bases);
      if (r && r.replaced.length) console.info("[app] " + t.name + ": updated to v" + manifest.version + "; replaced " + r.replaced.join(", ") + " (kept in previous)");
      return r;
    });
  }

  function load(t) {
    call("scene.cinematic", { command: "load_document", document: JSON.parse(JSON.stringify(t.document)) });
    lastSaved = JSON.stringify(read() || {});
  }
  function read() { try { return call("scene.cinematic", { command: "document" }); } catch (e) { return null; } }
  /* The engine's document, back into the table - only when it changed. */
  function keep() {
    if (!ready || !current) return Promise.resolve(false);
    var doc = read();
    if (!doc) return Promise.resolve(false);
    var text = JSON.stringify(doc);
    if (text === lastSaved) return Promise.resolve(false);
    lastSaved = text;
    current.document = doc; current.updated_at = new Date().toISOString();
    return A.save(store).then(function () { return true; }, function (e) { console.error("[app] could not save: " + e.message); return false; });
  }
  function keepSoon() { clearTimeout(keepSoon.t); keepSoon.t = setTimeout(keep, 1500); }

  /* ---- what the engine's panel asks ---- */
  function switchTable(id) {
    return keep().then(function () {
      var t = A.table(store, id);
      if (!t || t === current) return;
      return upgrade(t).then(function () { current = t; store.current = id; load(t); return A.save(store); });
    });
  }
  function newTable() {
    return keep().then(function () {
      var t = A.addTable(store, { name: "Table " + (store.tables.length + 1), base_version: manifest.version, document: JSON.parse(JSON.stringify(bases[manifest.version])) }, true);
      current = t; load(t); return A.save(store);
    });
  }
  function download(name, text) {
    var a = document.createElement("a"), url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function importSave() {
    var file = document.createElement("input");
    file.type = "file"; file.accept = ".json,application/json";
    file.addEventListener("change", function () {
      if (!file.files[0]) return;
      file.files[0].text().then(function (text) { var added = A.importStore(store, text); console.info("[app] imported " + added.length + " table(s)"); return A.save(store); })
        .catch(function (e) { console.error("[app] import refused: " + e.message); });
    });
    file.click();
  }
  var actions = {
    changed: function () { keepSoon(); },
    "switch": function (id) { return switchTable(id); },
    "new": function () { return newTable(); },
    "export": function () { return keep().then(function () { download(appId + "-save.json", A.exportStore(store)); }); },
    "import": function () { importSave(); },
    open_in_polynite: function () {
      return keep().then(function () { download((current.name || appId).replace(/[^A-Za-z0-9 _-]/g, "") + ".scene", JSON.stringify(current.document)); });
    }
  };
  shell.action = function (what, arg) {
    if (!ready || !actions[what]) return;
    try { var r = actions[what](arg); if (r && r.catch) r.catch(function (e) { console.error("[app] " + what + ": " + e.message); }); }
    catch (e) { console.error("[app] " + what + ": " + e.message); }
  };
  /* what the panel reads: a short plain text, never markup */
  shell.text = function (what) {
    if (!ready) return "";
    if (what === "storage") return storageState;
    if (what === "looks") return ((manifest.customize && manifest.customize.looks) || []).join(",");
    if (what === "tables") return store.tables.map(function (t) {
      return t.table_id + "\t" + String(t.name).replace(/[\t\n]/g, " ") + "\t" + (t === current ? 1 : 0) + "\t" + (t.from_share ? 1 : 0);
    }).join("\n");
    return "";
  };

  /* KEPT ON THE DEVICE: ask the browser not to evict this origin's storage (games, gallery, history)
     under pressure. Granted to installed apps (PWA / Play) and engaged sites; "Clear data" still clears. */
  var storageState = "";
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    navigator.storage.persisted().then(function (on) { return on || navigator.storage.persist(); })
      .then(function (on) { storageState = on ? "persistent" : "best-effort"; console.info("[app] storage " + storageState); })
      .catch(function () { storageState = "best-effort"; });
  }
  document.title = "Polynite " + appId.charAt(0).toUpperCase() + appId.slice(1);
  Promise.all([open(), whenEngine()]).then(function () {
    load(current);
    ready = true;
    window.vmeshSceneEntered = true;   /* an app opens on its world: no "tap to awaken" before the dice move */
    shell.state = "ready";
    /* the engine persists its own session on each change: follow it, and on the way out */
    setInterval(keep, 10000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") keep(); });
    window.addEventListener("pagehide", keep);
  }).catch(function (e) {
    if (document.body) fail(e.message); else document.addEventListener("DOMContentLoaded", function () { fail(e.message); }, { once: true });
  });
  shell.keep = keep; shell.store = function () { return store; }; shell.current = function () { return current; };
})();
