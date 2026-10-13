/* Browser HTTP decoding and Wasm streaming compilation share the download phase. */
(function () {
  "use strict";
  function size(bytes) { return (bytes / 1000000).toFixed(2) + " MB"; }
  window.pnLoadWasm = function (url, imports, receive, report) {
    var finished = false, observer, encoding = "", FR = /^fr/i.test(navigator.language || "");
    var absolute = new URL(url, location.href).href;
    function update(phase, detail) { if (!finished) report(phase, detail || ""); }
    function timing(entry) {
      if (entry.name !== absolute || !entry.decodedBodySize) return;
      var cached = entry.transferSize === 0;
      var validated = entry.transferSize > 0 && entry.transferSize < entry.encodedBodySize;
      var summary = cached ? (FR ? "Cache du navigateur" : "Browser cache") :
        validated ? (FR ? "Cache revalide" : "Revalidated cache") :
        size(entry.encodedBodySize) + (encoding ? " " + encoding : "");
      summary += " → " + size(entry.decodedBodySize);
      window.pnEngineTransfer = { encodedBytes: entry.encodedBodySize, decodedBytes: entry.decodedBodySize,
        transferredBytes: entry.transferSize, encoding: encoding, cached: cached, durationMs: entry.duration };
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
    return fetch(url, { credentials: "same-origin", cache: window.__pnDeployTier === "dev" ? "no-store" : "default" })
      .then(function (response) {
        if (!response.ok) throw new Error("Engine HTTP " + response.status);
        encoding = response.headers.get("Content-Encoding") || "";
        update(encoding ? (FR ? "Telechargement et decompression" : "Downloading and decompressing") :
          (FR ? "Telechargement du moteur" : "Downloading engine"), encoding === "br" ? "Brotli" : encoding);
        // The browser decodes Content-Encoding before Wasm receives the response body.
        if (typeof WebAssembly.instantiateStreaming === "function" &&
            (response.headers.get("Content-Type") || "").split(";")[0].trim() === "application/wasm")
          return WebAssembly.instantiateStreaming(Promise.resolve(response), imports);
        return response.arrayBuffer().then(function (bytes) {
          update(FR ? "Preparation du moteur" : "Preparing engine");
          return WebAssembly.instantiate(bytes, imports);
        });
      }).then(function (result) {
        try { performance.getEntriesByName(absolute, "resource").slice(-1).forEach(timing); } catch (error) {}
        finished = true;
        if (observer) observer.disconnect();
        report(FR ? "Initialisation du moteur" : "Initializing engine", null);
        receive(result.instance, result.module);
      }, function (error) {
        finished = true;
        if (observer) observer.disconnect();
        throw error;
      });
  };
})();
