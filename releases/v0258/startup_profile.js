/* Startup probe shared with polynite-auth/src/mcp_startup.js.
   Numeric snapshots only; no model contents or resource URLs in the report. */
function startupProbe() {
  if (window.__pnStartup) return;
  const clock = () => window.performance?.now?.() ?? Date.now();
  const born = clock(), data = { model_fetch_count: 0, fetch_failures: 0, wasm_instrumented: 0, gpu_instrumented: 0, resource_observer: 0, longtask_observer: 0 };
  const active = () => clock() - born < 120000;
  const mark = name => { const key = name + '_ms'; if (!(key in data)) data[key] = Math.max(0, clock() - born); };
  const add = (name, duration, error = false) => {
    if (!active()) return;
    duration = Math.max(0, duration);
    data[name + '_count'] = (data[name + '_count'] || 0) + 1;
    data[name + '_total_ms'] = (data[name + '_total_ms'] || 0) + duration;
    data[name + '_max_ms'] = Math.max(data[name + '_max_ms'] || 0, duration);
    if (error) data[name + '_errors'] = (data[name + '_errors'] || 0) + 1;
  };
  const wrap = (target, method, category) => {
    if (!target || typeof target[method] !== 'function') return false;
    const original = target[method];
    try {
      target[method] = function (...args) {
        const t = clock();
        let result;
        try { result = original.apply(this, args); }
        catch (error) { add(category, clock() - t, true); throw error; }
        if (result && typeof result.then === 'function') return result.then(value => { add(category, clock() - t); return value; }, error => { add(category, clock() - t, true); throw error; });
        add(category, clock() - t); return result;
      };
      return target[method] !== original;
    } catch { return false; }
  };
  // These API timings may overlap. instantiateStreaming includes download and
  // compilation; synchronous shader calls do not expose driver compile time.
  for (const method of ['compile', 'compileStreaming', 'instantiate', 'instantiateStreaming'])
    if (wrap(window.WebAssembly, method, 'wasm')) data.wasm_instrumented = 1;
  if (wrap(window.GPUAdapter?.prototype, 'requestDevice', 'device')) data.gpu_instrumented++;
  for (const [method, category] of [
    ['createShaderModule', 'shader'], ['createRenderPipeline', 'pipeline_sync'], ['createComputePipeline', 'pipeline_sync'],
    ['createRenderPipelineAsync', 'pipeline_async'], ['createComputePipelineAsync', 'pipeline_async'],
  ]) if (wrap(window.GPUDevice?.prototype, method, category)) data.gpu_instrumented++;
  const group = name => {
    try {
      const path = new URL(name, window.location?.href || 'https://embed-staging.polynite.io/').pathname.toLowerCase();
      if (/\.(glb|gltf|obj|wmesh)$/.test(path)) return 'model';
      if (path.endsWith('.wasm')) return 'wasm';
      if (path.endsWith('/app.js')) return 'engine';
    } catch {}
    return 'other';
  };
  const fetchOriginal = window.fetch?.bind(window);
  if (fetchOriginal) window.fetch = function (input, options) {
    if (active() && group(typeof input === 'string' ? input : input?.url || input?.href) === 'model') data.model_fetch_count++;
    return fetchOriginal(input, options).then(response => { if (active() && !response.ok) data.fetch_failures++; return response; }, error => { if (active()) data.fetch_failures++; throw error; });
  };
  const observers = [];
  const observe = (type, callback) => {
    if (!window.PerformanceObserver?.supportedEntryTypes?.includes(type)) return false;
    try { const observer = new window.PerformanceObserver(list => { if (active()) callback(list.getEntries()); else observer.disconnect(); });
      observer.observe({ type, buffered: true }); observers.push(observer); return true;
    } catch { return false; }
  };
  data.resource_observer = Number(observe('resource', entries => {
    for (const entry of entries) {
      const kind = group(entry.name);
      data['resource_' + kind + '_ms'] = (data['resource_' + kind + '_ms'] || 0) + Math.max(0, entry.duration || 0);
      data['resource_' + kind + '_bytes'] = (data['resource_' + kind + '_bytes'] || 0) + Math.max(0, entry.encodedBodySize || 0);
    }
  }));
  data.longtask_observer = Number(observe('longtask', entries => { for (const entry of entries) add('longtask', entry.duration); }));
  window.__pnStartup = { mark, read: () => ({ ...data, elapsed_ms: Math.max(0, clock() - born) }) };
  // Frame gaps also work in Firefox, where Long Tasks may be unavailable.
  // They include GPU/browser scheduling and tab suspension, not just CPU work.
  if (typeof window.requestAnimationFrame === 'function') {
    let last = clock();
    const tick = () => {
      const now = clock(), gap = now - last; last = now;
      if (!active()) return;
      if (gap > 100) {
        data.frame_gap_count = (data.frame_gap_count || 0) + 1;
        data.frame_gap_total_ms = (data.frame_gap_total_ms || 0) + gap;
        data.frame_gap_max_ms = Math.max(data.frame_gap_max_ms || 0, gap);
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }
  window.setTimeout?.(() => observers.forEach(observer => observer.disconnect()), 120000);
}

startupProbe();
(function () {
  // Observe completion without awaiting it in the render loop. These elapsed
  // times include queue backlog/browser scheduling; they are not GPU timers.
  var proto = window.GPUQueue && window.GPUQueue.prototype;
  if (!proto || typeof proto.submit !== 'function' || typeof proto.onSubmittedWorkDone !== 'function') return;
  var original = proto.submit, born = window.performance.now();
  var stats = window.__pnGpuStartup = { queue_samples: 0, queue_completed: 0, queue_errors: 0, queue_max_ms: 0 };
  proto.submit = function () {
    var result = original.apply(this, arguments);
    if (stats.queue_samples >= 16 || window.performance.now() - born > 15000) return result;
    var sample = ++stats.queue_samples, started = window.performance.now();
    try {
      this.onSubmittedWorkDone().then(function () {
        var elapsed = window.performance.now() - started;
        stats.queue_completed++;
        stats.queue_max_ms = Math.max(stats.queue_max_ms, elapsed);
        console.info('[startup-queue] ' + JSON.stringify({ sample: sample, submitted_page_ms: started, completed_page_ms: window.performance.now(), elapsed_ms: elapsed }));
      }, function () { stats.queue_errors++; });
    } catch (error) { stats.queue_errors++; }
    return result;
  };
})();
(function () {
  function report(label) {
    var snapshot = window.__pnStartup.read();
    if (window.__pnGpuStartup) Object.assign(snapshot, window.__pnGpuStartup);
    if (window.vmeshRuntimeInitialized && window.polynite && window.polynite.call) {
      try { snapshot.model_present = Number(!!window.polynite.call('scene.describe').model); } catch (error) {}
    }
    console.info('[startup-profile] ' + label + ' ' + JSON.stringify(snapshot));
  }
  window.pnStartupReport = function () { report('manual'); return window.__pnStartup.read(); };
  [1000, 5000, 15000].forEach(function (delay) {
    window.setTimeout(function () { report('timer-' + delay + 'ms'); }, delay);
  });
})();
