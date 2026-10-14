/* Browser HTTP decoding and Wasm streaming compilation share the download phase. */
(function () {
  "use strict";
  var pending;
  function request(url) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var info = { url: url, controller: controller, decoded: false }, cache = window.pnWasmCache;
    function network() { return fetch(url, { credentials: "same-origin",
      cache: window.__pnDeployTier === "dev" || (cache && cache.available) ? "no-store" : "default",
      signal: controller ? controller.signal : undefined }); }
    var promise = cache ? cache.read(url).then(function (bytes) {
      if (controller && controller.signal.aborted) throw new Error("Engine request cancelled");
      if (!bytes) return network();
      info.decoded = true;
      return new Response(bytes, { headers: { "Content-Type": "application/wasm", "Content-Length": String(bytes.byteLength) } });
    }) : network();
    promise.catch(function () {});
    if(window.__pnStartup) window.__pnStartup.mark("engine_download_requested");
    info.promise = promise;
    return info;
  }
  window.pnCancelWasm = function () {
    if(pending && pending.controller) pending.controller.abort();
    pending = null;
  };
  // Download while app.js arrives; retain the native Response for compiled-code caching.
  window.pnPrefetchWasm = function (url) {
    if(pending && pending.url === url) return;
    window.pnCancelWasm(); pending = request(url);
  };
  function size(bytes) { return (bytes / 1000000).toFixed(2) + " MB"; }
  window.pnLoadWasm = function (url, imports, receive, report, limits) {
    limits = limits || {};
    var finished = false, observer, reader, idleTimer, hardTimer, rejectTimeout, encoding = "", decodedBytes;
    var FR = /^fr/i.test(navigator.language || "");
    var download = pending && pending.url === url ? pending : request(url), controller = download.controller;
    pending = null;
    window.pnEngineLoading = true;
    var deadline = new Promise(function (_, reject) { rejectTimeout = reject; });
    function expire() {
      rejectTimeout(new Error(FR ? "Le chargement du moteur ne progresse plus. Rechargez la page." : "Engine loading timed out. Reload the page."));
      if (controller) controller.abort();
    }
    function alive(compile) {
      clearTimeout(idleTimer);
      // An idle network/compiler is not a failed engine. Keep the in-flight
      // request alive; only the overall request budget or a real error aborts.
      idleTimer = setTimeout(function () {
        if (!finished) update(FR ? "Chargement en cours" : "Still loading engine",
          FR ? "Le chargement continue…" : "Loading continues…");
      }, compile ? (limits.compileMs || 120000) : (limits.idleMs || 25000));
      report(null, null);
    }
    function cleanup() {
      finished = true; window.pnEngineLoading = false;
      clearTimeout(idleTimer); clearTimeout(hardTimer);
      if (observer) observer.disconnect();
      if (reader) reader.cancel().catch(function () {});
    }
    alive(false); hardTimer = setTimeout(expire, limits.totalMs || 300000);
    var absolute = new URL(url, location.href).href;
    function update(phase, detail) { if (!finished) report(phase, detail || ""); }
    function timing(entry) {
      if (download.decoded || entry.name !== absolute || !entry.decodedBodySize) return;
      var cached = entry.transferSize === 0;
      var validated = entry.transferSize > 0 && entry.transferSize < entry.encodedBodySize;
      var summary = cached ? (FR ? "Cache du navigateur" : "Browser cache") :
        validated ? (FR ? "Cache revalide" : "Revalidated cache") :
        size(entry.encodedBodySize) + (encoding ? " " + encoding : "");
      summary += " → " + size(entry.decodedBodySize);
      window.pnEngineTransfer = { encodedBytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize,
        transferredBytes: entry.transferSize, encoding: encoding, cached: cached, validated: validated, durationMs: entry.duration };
      update(FR ? "Preparation du moteur" : "Preparing engine", summary);
      report(null, summary);
    }
    try {
      if (typeof PerformanceObserver === "function") {
        observer = new PerformanceObserver(function (list) { list.getEntries().forEach(timing); });
        observer.observe({ type: "resource", buffered: true });
      }
    } catch (error) { observer = null; }
    update(FR ? "Chargement du moteur" : "Loading engine");
    function instantiate(response) {
        if (!response.ok) throw new Error("Engine HTTP " + response.status);
        encoding = response.headers.get("Content-Encoding") || "";
        alive(false);
        if(download.decoded) {
          window.pnEngineTransfer = { decodedBytes: Number(response.headers.get("Content-Length")) || 0,
            encoding: "", cached: true, decodedCache: true, transferredBytes: 0 };
          update(FR ? "Preparation du moteur" : "Preparing engine", FR ? "Cache decompresse" : "Decoded cache");
          console.info("[engine-cache] decoded engine reused: " + size(window.pnEngineTransfer.decodedBytes));
        } else if(window.pnWasmCache && window.pnWasmCache.available)
          decodedBytes = response.clone().arrayBuffer().catch(function () { return null; });
        if(!download.decoded) update(encoding ? (FR ? "Telechargement et decompression" : "Downloading and decompressing") :
          (FR ? "Telechargement du moteur" : "Downloading engine"), encoding === "br" ? "Brotli" : encoding);
        // A parallel reader observes progress without replacing the native Response/URL.
        if (response.body && typeof response.clone === "function") {
          reader = response.clone().body.getReader();
          (function pump() {
            reader.read().then(function (chunk) {
              if (finished) return;
              alive(chunk.done);
              if (!chunk.done) pump();
              else {
                if(window.__pnStartup) window.__pnStartup.mark(download.decoded ? "engine_cache_read_completed" : "engine_download_completed");
                update(FR ? "Preparation du moteur" : "Preparing engine");
              }
            }).catch(function () {});
          })();
        }
        // The browser decodes Content-Encoding before Wasm receives the response body.
        if (typeof WebAssembly.instantiateStreaming === "function" &&
            (response.headers.get("Content-Type") || "").split(";")[0].trim() === "application/wasm")
          return WebAssembly.instantiateStreaming(Promise.resolve(response), imports);
        return response.arrayBuffer().then(function (bytes) {
          update(FR ? "Preparation du moteur" : "Preparing engine");
          return WebAssembly.instantiate(bytes, imports);
        });
    }
    var loading = download.promise.then(instantiate).catch(function (error) {
      if(!download.decoded || finished || (controller && controller.signal.aborted)) throw error;
      // Discard an unreadable local record and retry the matching network engine once.
      download.decoded = false; alive(false);
      return window.pnWasmCache.remove(url).then(function () {
        return fetch(url, { credentials: "same-origin", cache: "no-store", signal: controller ? controller.signal : undefined });
      }).then(instantiate);
    });
    return Promise.race([loading, deadline]).then(function (result) {
        try { performance.getEntriesByName(absolute, "resource").slice(-1).forEach(timing); } catch (error) {}
        cleanup();
        if(decodedBytes) window.pnEngineCacheReady = decodedBytes.then(function (bytes) {
          return bytes ? window.pnWasmCache.save(url, bytes) : null;
        }).catch(function () {});
        if(window.__pnStartup) window.__pnStartup.mark("engine_instantiated");
        report(FR ? "Initialisation du moteur" : "Initializing engine", null);
        receive(result.instance, result.module);
      }, function (error) {
        cleanup();
        throw error;
      });
  };
})();
