/* The opening belongs to the link; rendering, content readiness and playback
 * are separate milestones. No gesture is needed to download or explore. */
(function () {
  'use strict';
  var id = new URL(location.href).searchParams.get('s') || '';
  var arrival = window.pnArrival = { id: id, mode: id ? 'shared' : 'restore',
    data: null, previewTaken: false, requested: false, busy: true,
    journey: false, touched: false, failed: false };
  window.vmeshSceneEntered = false;
  window.vmeshAudioEntered = false;
  window.vmeshCommittedFrames = 0;
  var panel = document.createElement('div');
  panel.id = 'arrival';
  panel.innerHTML = '<div id="arrivalTitle"></div><div id="arrivalAuthor"></div>' +
    '<button id="journeyStart" type="button">Tap to awaken</button>' +
    '<div id="journeyHint" role="status" aria-live="polite"></div>' +
    '<button id="arrivalDiscover" type="button">Explore Discover</button>';
  document.body.appendChild(panel);
  var title = document.getElementById('arrivalTitle');
  var author = document.getElementById('arrivalAuthor');
  var start = document.getElementById('journeyStart');
  var hint = document.getElementById('journeyHint');
  var discover = document.getElementById('arrivalDiscover');
  window.vmeshArrivalDock = function (x, y, w, h) {
    var geometry = [x, y, w, h].join(',');
    if (panel.dataset.dock !== geometry) {
      panel.dataset.dock = geometry;
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
      panel.style.width = w + 'px'; panel.style.height = h + 'px';
      panel.classList.add('docked');
      var loader = document.getElementById('loader');
      if (loader) {
        loader.style.left = x + 'px'; loader.style.top = y + 'px';
        loader.style.height = h + 'px';
        loader.style.width = w + 'px'; loader.classList.add('docked-loader');
      }
    }
    var open = (arrival.requested && !arrival.busy) || arrival.mode === 'discover' || arrival.failed;
    if (!open) { arrival.dockStarted = null; return 0; }
    if (arrival.dockStarted == null) arrival.dockStarted = performance.now();
    return Math.min(1, (performance.now() - arrival.dockStarted) / 320);
  };
  function paint() {
    var data = arrival.data || {};
    title.textContent = data.title || (arrival.mode === 'restore' && arrival.busy ? 'Returning to your world' : '');
    author.textContent = data.author ? 'by ' + data.author : '';
    start.hidden = arrival.failed || arrival.mode === 'discover';
    start.disabled = arrival.requested && arrival.busy;
    start.textContent = arrival.requested ? 'Your world is awakening' : 'Tap to awaken';
    hint.textContent = arrival.failed ? 'This scene could not be opened.' :
      arrival.requested && arrival.busy ? 'Continue exploring \u00b7 we\u2019ll begin when ready' :
      arrival.requested ? '' : 'Sound on with a touch \u00b7 drag to explore';
    discover.hidden = !arrival.failed && (arrival.mode !== 'restore' || !arrival.busy);
    panel.classList.toggle('quiet', (arrival.requested && !arrival.busy) || arrival.mode === 'discover');
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
  // Called only for input accepted by the world's own hit testing.
  window.vmeshArrivalGesture = function () { arrival.touched = true; awaken(); };
  discover.addEventListener('click', function () { window.vmeshDiscoverRequested = true; });
  window.vmeshWorldFrame = function () {
    if (window.vmeshCommittedFrames !== 1) return;
    document.body.classList.add('world-visible');
    performance.mark('polynite-world-visible');
    console.info('[arrival] first world frame');
  };
  window.vmeshArrivalState = function (mode, busy, journey, failed) {
    arrival.mode = mode;
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
    arrival.mode = 'shared';
    arrival.data = null;
    arrival.previewTaken = false;
    arrival.requested = false;
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
