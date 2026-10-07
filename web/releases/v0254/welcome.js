/* The opening belongs to the link; rendering, content readiness and playback
 * are separate milestones. No gesture is needed to download or explore. */
(function () {
  'use strict';
  var id = new URL(location.href).searchParams.get('s') || '';
  var arrival = window.pnArrival = { id: id, mode: id ? 'shared' : 'restore',
    data: null, previewTaken: false, requested: false, busy: true,
    journey: false, touched: false, failed: false, editing: false };
  // Studio belongs to this browser, never to a minted scene or its author.
  var studioKey = 'polynite.studio';
  var studioSaved = false, studioTouched = false;
  try { studioSaved = localStorage.getItem(studioKey) === '1'; } catch (_) {}
  window.vmeshStudio = id ? false : studioSaved;
  function studioState(enabled) {
    enabled = !!enabled;
    if (window.vmeshStudio === enabled) return;
    window.vmeshStudio = enabled;
    window.dispatchEvent(new CustomEvent('polynite:studio-changed', { detail: { enabled: enabled } }));
  }
  window.vmeshStudioSet = function (enabled) {
    studioTouched = true;
    studioState(enabled);
    try { localStorage.setItem(studioKey, enabled ? '1' : '0'); } catch (_) {}
  };
  window.vmeshSceneEntered = false;
  window.vmeshAudioEntered = false;
  window.vmeshCommittedFrames = 0;
  var panel = document.createElement('div');
  panel.id = 'arrival';
  panel.innerHTML = '<div id="arrivalTitle"></div><div id="arrivalAuthor"></div>' +
    '<button id="journeyStart" type="button" disabled>Preparing your world...</button>' +
    '<div id="journeyHint" role="status" aria-live="polite"></div>' +
    '<button id="arrivalDiscover" type="button">Explore Discover</button>';
  document.body.appendChild(panel);
  var title = document.getElementById('arrivalTitle');
  var author = document.getElementById('arrivalAuthor');
  var start = document.getElementById('journeyStart');
  var hint = document.getElementById('journeyHint');
  var discover = document.getElementById('arrivalDiscover');
  window.vmeshArrivalDock = function (x, y, w, h) {
    // Keep the invitation legible without moving its bottom edge or centre.
    // Its dimensions do not change between loading and the ready state.
    var viewport = window.innerWidth || w + 32;
    var width = Math.min(Math.max(w, 360), Math.max(0, viewport - 32));
    var height = Math.max(h, 72);
    x += (w - width) * 0.5; y += h - height;
    w = width; h = height;
    var geometry = [x, y, w, h].join(',');
    if (panel.dataset.dock !== geometry) {
      panel.dataset.dock = geometry;
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
      panel.style.width = w + 'px'; panel.style.height = h + 'px';
      panel.classList.add('docked');
      var loader = document.getElementById('loader');
      if (loader) {
        // One parent owns the frame, loader and their visibility transition.
        panel.appendChild(loader);
        loader.style.left = '0px'; loader.style.top = '0px';
        loader.style.height = h + 'px';
        loader.style.width = w + 'px'; loader.classList.add('docked-loader');
      }
    }
    var open = ((arrival.requested || arrival.editing) && !arrival.busy) || arrival.mode === 'discover' || arrival.failed;
    if (!open) { arrival.dockStarted = null; return 0; }
    if (arrival.dockStarted == null) arrival.dockStarted = performance.now();
    return Math.min(1, (performance.now() - arrival.dockStarted) / 320);
  };
  function paint() {
    var data = arrival.data || {};
    title.textContent = data.title || (arrival.mode === 'restore' && arrival.busy ? 'Returning to your world' : '');
    author.textContent = data.author ? 'by ' + data.author : '';
    start.hidden = arrival.failed || arrival.mode === 'discover' || arrival.editing;
    start.disabled = arrival.busy;
    start.textContent = arrival.busy ? 'Preparing\u2026' : arrival.requested ? 'Awakening...' : 'Tap to awaken';
    hint.textContent = arrival.failed ? 'This scene could not be opened.' :
      arrival.busy ? '' :
      arrival.requested || arrival.editing ? '' : 'Sound on with a touch \u00b7 drag to explore';
    discover.hidden = !arrival.failed && (arrival.mode !== 'restore' || !arrival.busy);
    panel.classList.toggle('has-discover', !discover.hidden);
    panel.classList.toggle('quiet', !arrival.busy && (arrival.requested || arrival.editing || arrival.mode === 'discover'));
  }
  function awaken() {
    if (arrival.requested || arrival.failed || arrival.mode === 'discover') return;
    arrival.requested = true;
    window.vmeshAudioEntered = true;
    if (!arrival.busy) window.vmeshSceneEntered = true;
    window.dispatchEvent(new CustomEvent('polynite:scene-entered'));
    paint();
  }
  start.addEventListener('click', awaken);
  window.vmeshToolsReady = function () {
    return arrival.mode === 'discover' || arrival.editing || (arrival.requested && !arrival.busy);
  };
  // Called only for input accepted by the world's own hit testing.
  window.vmeshArrivalGesture = function () { arrival.touched = true; awaken(); };
  discover.addEventListener('click', function () { window.vmeshDiscoverRequested = true; });
  window.vmeshWorldFrame = function () {
    if (window.vmeshCommittedFrames !== 1) return;
    document.body.classList.add('world-visible');
    performance.mark('polynite-world-visible');
    if(window.__pnStartup) window.__pnStartup.mark('first_visible_frame');
    console.info('[arrival] first world frame');
  };
  window.vmeshArrivalState = function (mode, busy, journey, failed) {
    // Geometry added to the already visible empty workspace is editing, not a
    // new shared-link arrival. Keep audio gated on a real world gesture.
    if (arrival.mode === 'discover' && mode === 'restore' && !failed) arrival.editing = true;
    arrival.mode = mode;
    if (mode === 'discover' && !studioTouched) studioState(false);
    arrival.busy = !!busy;
    arrival.failed = !!failed;
    arrival.journey = !!journey || !!(arrival.data && arrival.data.journey && busy);
    if (!busy && !failed && (arrival.requested || !arrival.journey)) window.vmeshSceneEntered = true;
    document.body.classList.toggle('arrival-busy', !!busy);
    document.body.classList.toggle('arrival-failed', !!failed);
    document.body.classList.toggle('arrival-shared', mode === 'shared');
    document.body.classList.toggle('scene-ready', !busy);
    paint();
  };
  window.vmeshArrivalBegin = function (nextId) {
    if (nextId === arrival.id) return;
    arrival.id = nextId;
    studioState(false);
    studioTouched = false;
    arrival.mode = 'shared';
    arrival.data = null;
    arrival.previewTaken = false;
    arrival.requested = false;
    arrival.editing = false;
    arrival.dockStarted = null;
    arrival.touched = false;
    arrival.busy = true;
    arrival.failed = false;
    arrival.journeyStarted = false;
    window.vmeshSceneEntered = false;
    window.vmeshAudioEntered = false;
    paint();
  };
  window.vmeshArrivalInfo = function (infoId, info) {
    if (infoId !== arrival.id || !info) return;
    arrival.data = info.welcome || { title: info.name, author: info.author };
    paint();
  };
  if (id && window.__pnApiBase) {
    fetch(window.__pnApiBase + '/api/share/info?id=' + encodeURIComponent(id) + '&welcome=1',
      { cache: 'no-store', signal: AbortSignal.timeout(8000) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || data.version !== 1 || arrival.previewTaken || arrival.id !== id) return;
        arrival.data = data;
        arrival.journey = !!data.journey;
        paint();
      }).catch(function () { /* Full share loading remains authoritative. */ });
  }
  paint();
})();
