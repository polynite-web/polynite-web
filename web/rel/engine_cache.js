/* One decoded release engine per origin; IndexedDB replaces the record atomically. */
(function () {
  "use strict";
  var database, MAX_AGE = 31536000000;
  var api = window.pnWasmCache = { available: false, read: read, save: save, remove: remove };
  function identity(url) {
    var u = new URL(url, location.href), hash = u.pathname.match(/\/engine\/([a-f0-9]{64})\/app[.]wasm$/);
    return hash && window.__pnDeployTier === "release" ? u.origin + "/engine/" + hash[1] : "";
  }
  function open() {
    if (!database) database = new Promise(function (resolve) {
      if (typeof indexedDB === "undefined") { resolve(null); return; }
      var request;
      try { request = indexedDB.open("polynite-engine-cache", 1); }
      catch (_) { resolve(null); return; }
      request.onupgradeneeded = function () { request.result.createObjectStore("wasm"); };
      request.onerror = request.onblocked = function () { resolve(null); };
      request.onsuccess = function () {
        api.available = true;
        request.result.onversionchange = function () { request.result.close(); api.available = false; database = null; };
        resolve(request.result);
      };
    });
    return database;
  }
  function transaction(id, action) {
    if (!id) return Promise.resolve(null);
    return open().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        var tx, result = null;
        try { tx = db.transaction("wasm", "readwrite"); }
        catch (_) { api.available = false; resolve(null); return; }
        var store = tx.objectStore("wasm"), request = store.get("latest");
        request.onsuccess = function () { result = action(store, request.result); };
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = tx.onabort = function () { resolve(null); };
      });
    });
  }
  function read(url) {
    var id = identity(url);
    return transaction(id, function (store, entry) {
      if (entry && Date.now() - entry.storedAt >= MAX_AGE) { store.delete("latest"); return null; }
      return entry && entry.id === id ? entry.bytes : null;
    });
  }
  function save(url, bytes) {
    var id = identity(url), version = Number(String(window.__spinVerFrozen || window.__pnBuildVersion || "").replace(/^v/, "")) || 0;
    return transaction(id, function (store, entry) {
      // An older tab finishing later must not replace a newer release.
      if (entry && entry.version > version) return null;
      store.put({ id: id, bytes: bytes, version: version, storedAt: Date.now() }, "latest");
      return true;
    });
  }
  function remove(url) {
    var id = identity(url);
    return transaction(id, function (store, entry) { if (entry && entry.id === id) store.delete("latest"); });
  }
})();
